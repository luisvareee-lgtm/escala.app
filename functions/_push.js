// Avisos al celular (Web Push, estándar de los navegadores: RFC 8030 + 8291 + 8292), sin librerías.
// Las claves VAPID se generan solas la primera vez y quedan guardadas en la base (app_config, solo la ve el servidor).
import { rpc } from './_lib.js';

const te = new TextEncoder();
export const b64u = buf => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
export const deB64u = s => { s = String(s || '').replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); const r = atob(s), o = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; };
const unir = (...ps) => { const n = ps.reduce((a, p) => a + p.length, 0), o = new Uint8Array(n); let i = 0; for (const p of ps) { o.set(p, i); i += p.length; } return o; };

// Solo los servicios de avisos de los navegadores (evita que alguien use el servidor para llamar a otras direcciones).
const PUSH_HOSTS = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.push\.apple\.com|[a-z0-9-]+(\.[a-z0-9-]+)*\.notify\.windows\.com)$/i;
export function endpointValido(u) {
  let x; try { x = new URL(u); } catch (e) { return false; }
  return x.protocol === 'https:' && !x.username && !x.password && (!x.port || x.port === '443') && PUSH_HOSTS.test(x.hostname);
}

// Claves VAPID de la plataforma: si no existen, se crean y se guardan (si dos llamadas compiten, gana la primera).
export async function clavesVapid(env) {
  const d = await rpc(env, 'svc_vapid', {});
  if (d && d.pub && d.priv) return d;
  const k = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', k.publicKey));
  const priv = JSON.stringify(await crypto.subtle.exportKey('jwk', k.privateKey));
  return await rpc(env, 'svc_vapid_set', { p_pub: pub, p_priv: priv });
}

// Firma VAPID (JWT ES256) para el servicio de avisos del navegador.
export async function firmaVapid(endpoint, vapid, sub) {
  const aud = new URL(endpoint).origin;
  const h = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const p = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub })));
  const jwk = typeof vapid.priv === 'string' ? JSON.parse(vapid.priv) : vapid.priv;
  const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', d: jwk.d, x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const s = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(h + '.' + p));
  return `vapid t=${h}.${p}.${b64u(s)}, k=${vapid.pub}`;
}

async function hkdf(salt, ikm, info, bytes) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, bytes * 8));
}
// Cifrado del contenido (aes128gcm, RFC 8291): solo el celular del comercio lo puede leer.
export async function cifrar(p256dh, auth, texto, sal, eph) {   // sal y eph solo se pasan en las pruebas
  let ua, secreto; try { ua = deB64u(p256dh); secreto = deB64u(auth); } catch (e) { ua = secreto = new Uint8Array(0); }
  if (ua.length !== 65 || secreto.length !== 16) throw new Error('Suscripción inválida');
  eph = eph || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(secreto, ecdh, unir(te.encode('WebPush: info\0'), ua, asPub), 32);
  const salt = sal || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const k = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, k, unir(te.encode(texto), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);   // 4096
  return unir(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

// Envía un aviso a una suscripción. Devuelve { ok, status, borrar } (borrar = el celular ya no la usa).
export async function enviarAviso(sub, datos, vapid, quien) {
  if (!endpointValido(sub.endpoint)) return { ok: false, status: 0, borrar: true };
  try {
    const body = await cifrar(sub.p256dh, sub.auth, JSON.stringify(datos));
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { authorization: await firmaVapid(sub.endpoint, vapid, quien), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '86400', urgency: 'high' },
      body,
    });
    return { ok: r.status >= 200 && r.status < 300, status: r.status, borrar: r.status === 404 || r.status === 410 };
  } catch (e) { return { ok: false, status: 0, error: String(e.message || e) }; }
}

// Avisa a todos los celulares de un comercio y limpia los que ya no existen.
export async function avisarTodos(env, subs, datos, quien) {
  if (!subs || !subs.length) return [];
  const vapid = await clavesVapid(env);
  const res = await Promise.all(subs.slice(0, 10).map(s => enviarAviso(s, datos, vapid, quien)));
  await Promise.all(res.map((r, i) => rpc(env, 'svc_push_resultado', { p_endpoint: subs[i].endpoint, p_ok: !!r.ok, p_borrar: !!r.borrar }).catch(() => { })));
  return res.map(r => ({ ok: r.ok, status: r.status }));
}

const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
export function avisoDePedido(d) {
  const p = d.pedido, n = (d.items || []).reduce((a, i) => a + (Number(i.cantidad) || 0), 0);
  return {
    title: `🛒 Pedido nuevo · ${pesos(p.total)}`,
    body: `${String(p.cliente_nombre || 'Cliente').slice(0, 60)} · ${n} ${n === 1 ? 'producto' : 'productos'} · #${p.numero}`,
    url: '/app#/panel?tab=pedidos&pedido=' + p.id, tag: 'pedido-' + p.id,
  };
}
