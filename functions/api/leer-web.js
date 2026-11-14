// Lee UNA página pública (o una foto) de la web de un proveedor para el importador "Traer desde la web del proveedor".
// Solo para comercios con sesión iniciada. Reglas que respetamos siempre:
//  · solo https y dominios públicos (nada interno, sin IPs), revisando cada redirección;
//  · respetamos el robots.txt del sitio y nos identificamos como "EscalaBot" (no nos hacemos pasar por un navegador);
//  · nunca enviamos usuario, contraseña ni cookies: si el catálogo pide iniciar sesión, no se puede leer;
//  · límite de uso por tienda (lo controla la base) y tamaño máximo por respuesta.
import { json, rpc, usuarioDeToken, mismoOrigen, urlSegura, sitio } from '../_lib.js';

const MAX_TEXTO = 4 * 1024 * 1024, MAX_IMG = 8 * 1024 * 1024, ESPERA = 12000;
const TIPOS_TEXTO = /^(text\/|application\/(json|ld\+json|xml|xhtml\+xml|rss\+xml|atom\+xml)|[a-z]+\/[a-z.+-]*(json|xml))/i;
const robotsCache = new Map();          // por instancia: host → {reglas, hasta}

function ua(request, env) { return `Mozilla/5.0 (compatible; EscalaBot/1.0; +${sitio(request, env)}/bot)`; }

// ---------- robots.txt ----------
function parsearRobots(txt) {
  const grupos = []; let g = null, ultimoFueAgente = false;
  for (const linea of String(txt || '').split(/\r?\n/)) {
    const l = linea.replace(/#.*$/, '').trim(); if (!l) continue;
    const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { if (!g || !ultimoFueAgente) { g = { agentes: [], reglas: [] }; grupos.push(g); } g.agentes.push(v.toLowerCase()); ultimoFueAgente = true; continue; }
    ultimoFueAgente = false;
    if (!g) continue;
    if (k === 'allow' || k === 'disallow') g.reglas.push({ permitir: k === 'allow', ruta: v });
  }
  const nuestro = grupos.filter(x => x.agentes.some(a => a.includes('escalabot')));
  const todos = grupos.filter(x => x.agentes.includes('*'));
  return (nuestro.length ? nuestro : todos).flatMap(x => x.reglas);
}
const patron = r => new RegExp('^' + r.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
function permitido(reglas, ruta) {
  let mejor = null;
  for (const r of reglas) {
    if (!r.ruta) { continue; }                      // "Disallow:" vacío = permite todo
    if (!patron(r.ruta).test(ruta)) continue;
    if (!mejor || r.ruta.length > mejor.ruta.length || (r.ruta.length === mejor.ruta.length && r.permitir)) mejor = r;
  }
  return !mejor || mejor.permitir;
}
async function reglasDe(origen, request, env) {
  const c = robotsCache.get(origen); if (c && c.hasta > Date.now()) return c.reglas;
  let reglas = [];
  try {
    const r = await fetch(origen + '/robots.txt', { headers: { 'user-agent': ua(request, env), accept: 'text/plain' }, redirect: 'follow', signal: AbortSignal.timeout(6000) });
    if (r.ok && /text\/plain/i.test(r.headers.get('content-type') || 'text/plain')) reglas = parsearRobots((await r.text()).slice(0, 200000));
  } catch (e) { reglas = []; }                      // sin robots.txt = sin restricciones
  if (robotsCache.size > 300) robotsCache.clear();
  robotsCache.set(origen, { reglas, hasta: Date.now() + 3600 * 1000 });
  return reglas;
}

// ---------- lectura con límite de tamaño ----------
async function leerHasta(r, max) {
  const largo = Number(r.headers.get('content-length') || 0);
  if (largo > max) return null;
  if (!r.body) return new Uint8Array(0);
  const lector = r.body.getReader(), partes = []; let total = 0;
  for (;;) {
    const { done, value } = await lector.read(); if (done) break;
    total += value.byteLength; if (total > max) { try { await lector.cancel(); } catch (e) { } return null; }
    partes.push(value);
  }
  const out = new Uint8Array(total); let o = 0; for (const p of partes) { out.set(p, o); o += p.byteLength; }
  return out;
}
function decodificar(bytes, ct) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { }   // UTF-8 válido: es UTF-8 (aunque diga otra cosa)
  let cs = ((ct || '').match(/charset=["']?([\w-]+)/i) || [])[1];
  if (!cs) { const cab = new TextDecoder('latin1').decode(bytes.slice(0, 4096)); cs = ((cab.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1]) || 'windows-1252'; }
  if (/^utf-?8$/i.test(cs)) cs = 'windows-1252';
  try { return new TextDecoder(cs.toLowerCase()).decode(bytes); } catch (e) { return windows1252(bytes); }
}
// por si el entorno no trae decodificadores que no sean UTF-8: Latin-1 / Windows-1252 a mano
const CP1252 = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
function windows1252(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 8192), b => b >= 0x80 && b < 0xa0 ? CP1252.charCodeAt(b - 0x80) : b));
  return s;
}
const AVISOS = {
  401: 'Esa página pide iniciar sesión. Pedile al proveedor la lista en Excel o PDF y subila acá arriba.',
  403: 'El sitio del proveedor no permite la lectura automática (bloqueo o protección anti-robots). Pedile la lista en Excel o PDF, o subí las fotos de su catálogo.',
  404: 'Esa página no existe. Revisá el enlace.',
  429: 'El sitio del proveedor pidió que vayamos más despacio. Esperá unos minutos y probá de nuevo.',
};

export async function onRequestPost({ request, env }) {
  if (!mismoOrigen(request, env)) return json({ error: 'Origen no permitido' }, 403);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Falta configurar el servidor: cargá SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY en Cloudflare (ver LEEME, paso 3).' }, 503);
  const uid = await usuarioDeToken(env, request).catch(() => null);
  if (!uid) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
  const b = await request.json().catch(() => ({}));
  const tipo = b.tipo === 'imagen' ? 'imagen' : 'texto';
  let url = String(b.url || '').trim().slice(0, 2000);
  if (/^http:\/\//i.test(url)) url = 'https://' + url.slice(7);
  if (!/^https:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
  if (!urlSegura(url)) return json({ error: 'Ese enlace no es válido. Copiá la dirección completa de la página del proveedor (https://…).' }, 400);
  const host = new URL(url).hostname;
  try { await rpc(env, 'svc_permitir_web', { p_owner: uid, p_tipo: tipo, p_host: host, p_registrar: !!b.inicio }); }
  catch (e) { return json({ error: e.message || 'No se pudo verificar tu cuenta.' }, 429); }

  // encabezados: solo los que necesitan algunos catálogos públicos (nunca cookies ni credenciales)
  const h = { 'user-agent': ua(request, env), accept: tipo === 'imagen' ? 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.5' : 'text/html,application/json,application/xml;q=0.9,*/*;q=0.5', 'accept-language': 'es-AR,es;q=0.9' };
  const extra = b.headers && typeof b.headers === 'object' ? b.headers : {};
  if (/^\d{1,12}$/.test(String(extra.commerceid || ''))) h.commerceid = String(extra.commerceid);
  if (/^application\/[\w.+-]+$/.test(String(extra.accept || ''))) h.accept = String(extra.accept);

  let actual = url, r = null;
  for (let salto = 0; salto < 5; salto++) {
    const u = new URL(actual);
    const reglas = await reglasDe(u.origin, request, env);
    if (!permitido(reglas, u.pathname + u.search)) return json({ ok: false, status: 0, robots: true, url: actual, error: 'El sitio pide que los programas automáticos no lean esta sección (robots.txt). Respetamos esa regla: pedile al proveedor la lista en Excel o PDF.' });
    try { r = await fetch(actual, { headers: h, redirect: 'manual', signal: AbortSignal.timeout(ESPERA) }); }
    catch (e) { return json({ ok: false, status: 0, url: actual, error: 'El sitio del proveedor no respondió. Probá de nuevo en un rato.' }); }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      let sig; try { sig = new URL(r.headers.get('location'), actual).toString(); } catch (e) { sig = ''; }
      if (/^http:\/\//i.test(sig)) sig = 'https://' + sig.slice(7);
      if (!urlSegura(sig)) return json({ ok: false, status: r.status, url: actual, error: 'El sitio redirige a una dirección que no podemos abrir.' });
      actual = sig; continue;
    }
    break;
  }
  if (!r || (r.status >= 300 && r.status < 400)) return json({ ok: false, status: 310, url: actual, error: 'El sitio redirige demasiadas veces.' });
  const ct = r.headers.get('content-type') || '';
  if (!r.ok) {
    const aviso = AVISOS[r.status] || (r.status >= 500 ? 'El sitio del proveedor tiene un problema ahora. Probá más tarde.' : `El sitio respondió con un error (${r.status}).`);
    if (tipo === 'imagen') return json({ error: aviso, status: r.status }, 502);
    return json({ ok: false, status: r.status, url: actual, error: aviso, desafio: /cf-mitigated|challenge/i.test(r.headers.get('cf-mitigated') || '') || r.status === 403 });
  }
  if (tipo === 'imagen') {
    if (!/^image\/(png|jpe?g|webp|gif|avif)/i.test(ct)) return json({ error: 'Ese enlace no es una foto (JPG, PNG o WebP).' }, 415);
    const bytes = await leerHasta(r, MAX_IMG);
    if (!bytes) return json({ error: 'La foto pesa demasiado (más de 8 MB).' }, 413);
    return new Response(bytes, { status: 200, headers: { 'content-type': ct.split(';')[0], 'cache-control': 'no-store', 'x-url-final': actual } });
  }
  if (!TIPOS_TEXTO.test(ct) && ct) return json({ ok: false, status: r.status, url: actual, ct, error: /^image\//i.test(ct) ? 'Ese enlace es una foto, no una página.' : 'Ese enlace no es una página web ni un catálogo.' , esImagen: /^image\//i.test(ct) });
  const bytes = await leerHasta(r, MAX_TEXTO);
  if (!bytes) return json({ ok: false, status: r.status, url: actual, error: 'La página es demasiado grande para leerla de una vez. Probá con el enlace de una categoría.' });
  return json({ ok: true, status: r.status, url: actual, ct: ct.split(';')[0], cuerpo: decodificar(bytes, ct) });
}
