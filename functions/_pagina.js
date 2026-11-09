// Sirve la página de la app (index.html) con los datos de vista previa correctos para compartir por WhatsApp y redes:
// título, descripción e imagen de la portada, o el nombre y el logo de cada tienda en /t/<tienda>.
export const SEGURIDAD = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://connect.facebook.net 'wasm-unsafe-eval'; worker-src 'self' blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://www.facebook.com https://connect.facebook.net; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};

const escAttr = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const okUrl = u => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u);

let CFG = null;   // claves públicas del sitio (las mismas de js/config.js), leídas una sola vez
async function config(request, env) {
  if (CFG) return CFG;
  try {
    const t = await (await env.ASSETS.fetch(new URL('/js/config.js', request.url))).text();
    const u = t.match(/SUPABASE_URL:\s*["']([^"']+)["']/), k = t.match(/SUPABASE_ANON_KEY:\s*["']([^"']+)["']/);
    if (u && k && /^https:\/\/.+\.supabase\.co/.test(u[1])) CFG = { url: u[1].replace(/\/$/, ''), key: k[1] };
  } catch (e) { }
  return CFG;
}

// Datos públicos de una tienda (nombre, frase y logo). Si algo falla, devuelve null y se usa la vista previa general.
export async function datosTienda(request, env, slug) {
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(slug || '')) return null;
  const c = await config(request, env); if (!c) return null;
  try {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch(`${c.url}/rest/v1/v_tiendas_publicas?slug=eq.${slug}&select=nombre,eslogan,logo_url`, { headers: { apikey: c.key, authorization: 'Bearer ' + c.key }, signal: ctl.signal });
    clearTimeout(tm);
    if (!r.ok) return null;
    const d = await r.json(); return Array.isArray(d) && d[0] ? d[0] : null;
  } catch (e) { return null; }
}

export async function pagina(request, env, meta = {}) {
  const u = new URL(request.url), r = await env.ASSETS.fetch(new URL('/', request.url));
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries(SEGURIDAD)) h.set(k, v);
  h.set('content-type', 'text/html; charset=utf-8');
  h.set('cache-control', 'no-cache');
  h.delete('location');
  const resp = new Response(r.body, { status: 200, headers: h });
  if (typeof HTMLRewriter === 'undefined') return resp;
  const m = { image: okUrl(meta.image) ? meta.image : u.origin + '/og.jpg', url: u.origin + u.pathname, title: meta.title, description: meta.description };
  const attr = v => ({ element(e) { if (v) e.setAttribute('content', v); } });
  return new HTMLRewriter()
    .on('title', { element(e) { if (m.title) e.setInnerContent(m.title); } })
    .on('meta[name="description"]', attr(m.description))
    .on('meta[property="og:title"]', attr(m.title))
    .on('meta[property="og:description"]', attr(m.description))
    .on('meta[property="og:image"]', attr(m.image))
    .on('head', { element(e) { e.append(`<meta property="og:url" content="${escAttr(m.url)}">`, { html: true }); } })
    .transform(resp);
}
