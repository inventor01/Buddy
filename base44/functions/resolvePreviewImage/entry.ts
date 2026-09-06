import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

const MAX_BYTES = 6 * 1024 * 1024;

function safeHttpUrl(value: unknown) {
  try {
    const u = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    const host = u.hostname.toLowerCase();
    if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null;
    if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) return null;
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return null;
    return u;
  } catch (_) {
    return null;
  }
}

function metaImage(html: string, pageUrl: URL) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (!m?.[1]) continue;
    try { return new URL(m[1].replace(/&amp;/g, '&'), pageUrl).toString(); } catch (_) {}
  }
  return '';
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    let body: any = {};
    try { body = await req.json(); } catch (_) { body = {}; }
    const page = safeHttpUrl(body.page_url);
    let image = safeHttpUrl(body.image_url);

    // If the caller has no durable image, resolve the page's declared preview.
    if (!image && page) {
      const pageRes = await fetchWithTimeout(page.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; BuddyPreview/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      if (pageRes.ok) {
        const html = (await pageRes.text()).slice(0, 1_500_000);
        image = safeHttpUrl(metaImage(html, page));
      }
    }

    if (!image) return Response.json({ image_url: '', cached: false });

    const imageRes = await fetchWithTimeout(image.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BuddyPreview/1.0)',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        ...(page ? { Referer: page.toString() } : {}),
      },
    });
    if (!imageRes.ok) return Response.json({ image_url: '', cached: false });

    const type = (imageRes.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) return Response.json({ image_url: '', cached: false });
    const declared = Number(imageRes.headers.get('content-length') || 0);
    if (declared > MAX_BYTES) return Response.json({ image_url: '', cached: false });

    const bytes = new Uint8Array(await imageRes.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) return Response.json({ image_url: '', cached: false });
    const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
    const file = new File([bytes], `buddy-preview-${Date.now()}.${ext}`, { type });
    const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const stable = typeof uploaded?.file_url === 'string' ? uploaded.file_url : '';
    return Response.json({ image_url: stable, cached: !!stable, source_image_url: image.toString() });
  } catch (_) {
    // Preview images must never make the actual result fail.
    return Response.json({ image_url: '', cached: false });
  }
}
