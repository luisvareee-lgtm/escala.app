// Utilidades compartidas de las Cloudflare Pages Functions.
// Variables de entorno (Pages > Settings > Variables and Secrets):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (SECRETA), FN_SECRET (SECRETA, la misma que cargás en app_config),
//   SITE_URL (opcional, ej. https://escala.pages.dev), RESEND_API_KEY y EMAIL_FROM (opcionales, para avisos por email).

export const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const esUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || ''));
export const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Llama a una función SQL "svc_*" con la clave de servicio. Esta clave NUNCA sale de este servidor.
export async function rpc(env, fn, args) {
  const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify(args || {}),
  });
  const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
  if (!r.ok) throw new Error((d && d.message) || `Error de base de datos (${r.status})`);
  return d;
}

// Identifica a quién llama (JWT de Supabase Auth). Devuelve el id de usuario o null.
export async function usuarioDeToken(env, request) {
  const h = request.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+([\w-]+\.[\w-]+\.[\w-]+)$/);
  if (!m) return null;
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, authorization: `Bearer ${m[1]}` } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return u && esUuid(u.id) ? u.id : null;
}

// Solo aceptamos llamadas del propio sitio (frena que otra web use tus funciones desde el navegador de un visitante).
export function mismoOrigen(request, env) {
  const o = request.headers.get('origin');
  if (!o) return false;
  const propio = env.SITE_URL ? new URL(env.SITE_URL).origin : new URL(request.url).origin;
  return o === propio;
}
export const sitio = (request, env) => (env.SITE_URL ? new URL(env.SITE_URL).origin : new URL(request.url).origin);

export function igualesSeguro(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length || !a) return false;
  let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
export async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return [...new Uint8Array(s)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Evita que un comercio apunte el webhook a direcciones internas (SSRF): solo https, dominio con punto, sin IPs, sin credenciales.
export function urlSegura(u) {
  let x; try { x = new URL(u); } catch (e) { return false; }
  if (x.protocol !== 'https:' || x.username || x.password) return false;
  if (x.port && x.port !== '443') return false;
  const h = x.hostname.toLowerCase();
  if (!h.includes('.') || /^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || h.startsWith('[')) return false;
  if (/(^|\.)(localhost|local|internal|intranet|lan|home|corp)$/.test(h)) return false;
  return true;
}

// Envía el webhook firmado. Reintenta una vez si falla la red o responde 5xx. No sigue redirecciones.
export async function enviarWebhook(url, secret, evento, payload, entrega) {
  if (!urlSegura(url)) return { ok: false, error: 'URL no permitida (usá https y un dominio público)' };
  const body = JSON.stringify(payload), ts = Math.floor(Date.now() / 1000);
  const firma = await hmacHex(secret, `${ts}.${body}`);
  const headers = { 'content-type': 'application/json', 'user-agent': 'Escala-Webhook/1.0', 'x-escala-event': evento, 'x-escala-delivery': entrega, 'x-escala-timestamp': String(ts), 'x-escala-signature': 'sha256=' + firma };
  let ultimo = { ok: false, error: 'sin respuesta' };
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(8000) });
      ultimo = { ok: r.status >= 200 && r.status < 300, status: r.status };
      if (r.status < 500) return ultimo;
    } catch (e) { ultimo = { ok: false, error: 'No se pudo conectar' }; }
    if (i === 0) await new Promise(res => setTimeout(res, 1500));
  }
  return ultimo;
}

export async function enviarEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { ok: false, error: 'email no configurado' };
  try {
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html }) });
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: false, error: 'No se pudo conectar' }; }
}

export function cargaPedido(d) {
  const p = d.pedido;
  return {
    evento: 'pedido.creado', entrega: crypto.randomUUID(),
    payload: {
      evento: 'pedido.creado', id: p.id, numero: p.numero, fecha: p.fecha,
      tienda: { slug: d.tenant.slug, nombre: d.tenant.nombre },
      cliente: { nombre: p.cliente_nombre, whatsapp: p.cliente_whatsapp, localidad: p.localidad },
      modalidad: p.modalidad, medio_pago: p.medio_pago, estado: p.estado, moneda: 'ARS', total: Number(p.total),
      items: d.items.map(i => ({ nombre: i.nombre, variante: i.variante || null, cantidad: i.cantidad, precio_unitario: Number(i.precio_unitario), subtotal: Number(i.subtotal) })),
    },
  };
}
