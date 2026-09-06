import { secrets } from 'base44:runtime';

export function normalizePhone(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return digits.length >= 10 && digits.length <= 15 ? `+${digits}` : '';
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

export function maskPhone(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 4 ? `••• ••• ${digits.slice(-4)}` : '';
}

export async function hashPhoneCode(ownerId: string, phone: string, code: string) {
  const pepper = secrets.get('PHONE_VERIFICATION_PEPPER') || secrets.get('TWILIO_AUTH_TOKEN') || 'buddy-phone-v1';
  const input = new TextEncoder().encode(`${ownerId}|${phone}|${code}|${pepper}`);
  const digest = await crypto.subtle.digest('SHA-256', input);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function createPhoneCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

export async function sendVerificationSms(phone: string, code: string) {
  const sid = secrets.get('TWILIO_ACCOUNT_SID');
  const token = secrets.get('TWILIO_AUTH_TOKEN');
  const from = secrets.get('TWILIO_FROM_NUMBER');
  if (!sid || !token || !from) throw new Error('Text verification is not configured yet.');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${sid}:${token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: phone,
      From: from,
      Body: `Your Buddy confirmation code is ${code}. It expires in 10 minutes.`,
    }),
  });
  if (!res.ok) throw new Error(`Could not send the confirmation text (${res.status}).`);
}

export async function loadVerifiedPhone(base44: any, ownerId: string) {
  if (!ownerId) return '';
  try {
    const rows = await base44.asServiceRole.entities.PhoneIdentity.filter({ owner_id: ownerId, verified: true }, '-verified_at', 1);
    const phone = Array.isArray(rows) ? rows[0]?.phone_e164 : '';
    return normalizePhone(phone);
  } catch (_) {
    return '';
  }
}
