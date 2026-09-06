import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { checkUsageLimit } from '../../shared/rateLimit.ts';
import { createPhoneCode, hashPhoneCode, maskPhone, normalizePhone, sendVerificationSms } from '../../shared/phone.ts';

function nowIso() { return new Date().toISOString(); }

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const action = String(body?.action || 'status');

    if (action === 'status') {
      const rows = await base44.entities.PhoneIdentity.filter({ owner_id: user.id }, '-updated_date', 1);
      const current = Array.isArray(rows) ? rows[0] || null : null;
      const pending = !!current && current.verified !== true && !!current.code_hash && !!current.code_expires_at && new Date(current.code_expires_at).getTime() > Date.now();
      return Response.json({
        verified: current?.verified === true,
        pending,
        phone_masked: current ? maskPhone(current.phone_e164) : '',
        phone_e164: current?.phone_e164 || '',
      });
    }

    if (action === 'remove') {
      const rows = await base44.entities.PhoneIdentity.filter({ owner_id: user.id }, '-updated_date', 10);
      for (const row of Array.isArray(rows) ? rows : []) {
        try { await base44.asServiceRole.entities.PhoneIdentity.delete(row.id); } catch (_) {}
      }
      try { await base44.auth.updateMe({ sms_phone: '' }); } catch (_) {}
      return Response.json({ ok: true, verified: false });
    }

    if (action === 'start') {
      const quota = await checkUsageLimit({ base44, req, scope: 'phone-verify-start', minuteLimit: 3, dayLimit: 12 });
      if (!quota.ok) {
        return Response.json({ error: 'Too many confirmation texts. Try again later.' }, { status: 429, headers: { 'Retry-After': String(quota.retryAfter || 60) } });
      }
      const phone = normalizePhone(body?.phone);
      if (!phone) return Response.json({ error: 'Enter a valid phone number.' }, { status: 400 });

      const rows = await base44.asServiceRole.entities.PhoneIdentity.filter({ owner_id: user.id }, '-updated_date', 1);
      const current = Array.isArray(rows) ? rows[0] || null : null;
      if (current?.resend_after && new Date(current.resend_after).getTime() > Date.now()) {
        const retry = Math.max(1, Math.ceil((new Date(current.resend_after).getTime() - Date.now()) / 1000));
        return Response.json({ error: 'A code was just sent. Try again shortly.', retry_after: retry }, { status: 429, headers: { 'Retry-After': String(retry) } });
      }

      const code = createPhoneCode();
      const codeHash = await hashPhoneCode(user.id, phone, code);
      await sendVerificationSms(phone, code);
      const data = {
        owner_id: user.id,
        phone_e164: phone,
        verified: false,
        verified_at: '',
        code_hash: codeHash,
        code_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        attempts: 0,
        resend_after: new Date(Date.now() + 60 * 1000).toISOString(),
        last_sent_at: nowIso(),
      };
      if (current?.id) await base44.asServiceRole.entities.PhoneIdentity.update(current.id, data);
      else await base44.asServiceRole.entities.PhoneIdentity.create(data);
      return Response.json({ ok: true, phone_masked: maskPhone(phone), expires_seconds: 600, resend_seconds: 60 });
    }

    if (action === 'verify') {
      const quota = await checkUsageLimit({ base44, req, scope: 'phone-verify-code', minuteLimit: 8, dayLimit: 40 });
      if (!quota.ok) return Response.json({ error: 'Too many attempts. Try again shortly.' }, { status: 429 });
      const code = String(body?.code || '').replace(/\D/g, '').slice(0, 6);
      if (code.length !== 6) return Response.json({ error: 'Enter the 6-digit code.' }, { status: 400 });
      const rows = await base44.asServiceRole.entities.PhoneIdentity.filter({ owner_id: user.id }, '-updated_date', 1);
      const current = Array.isArray(rows) ? rows[0] || null : null;
      if (!current?.id || !current.phone_e164 || !current.code_hash) return Response.json({ error: 'Send a new confirmation code first.' }, { status: 400 });
      if (current.verified === true) return Response.json({ ok: true, verified: true, phone_masked: maskPhone(current.phone_e164) });
      if (!current.code_expires_at || new Date(current.code_expires_at).getTime() < Date.now()) return Response.json({ error: 'That code expired. Send a new one.' }, { status: 410 });
      const attempts = Number(current.attempts || 0);
      if (attempts >= 5) return Response.json({ error: 'Too many incorrect codes. Send a new code.' }, { status: 429 });
      const codeHash = await hashPhoneCode(user.id, current.phone_e164, code);
      if (codeHash !== current.code_hash) {
        await base44.asServiceRole.entities.PhoneIdentity.update(current.id, { attempts: attempts + 1 });
        return Response.json({ error: 'That code is not correct.', attempts_left: Math.max(0, 4 - attempts) }, { status: 400 });
      }

      const verifiedAt = nowIso();
      await base44.asServiceRole.entities.PhoneIdentity.update(current.id, {
        verified: true,
        verified_at: verifiedAt,
        code_hash: '',
        code_expires_at: '',
        attempts: 0,
      });
      try { await base44.auth.updateMe({ sms_phone: current.phone_e164 }); } catch (_) {}
      return Response.json({ ok: true, verified: true, phone_masked: maskPhone(current.phone_e164), phone_e164: current.phone_e164 });
    }

    return Response.json({ error: 'Unknown phone confirmation action.' }, { status: 400 });
  } catch (error: any) {
    return Response.json({ error: String(error?.message || error || 'Phone confirmation failed.') }, { status: 500 });
  }
}
