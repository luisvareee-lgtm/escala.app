// Tienda pública: catálogo, modo minorista/mayorista/híbrido, carrito, pedido y ticket por WhatsApp.
import { api } from './api.js';
import { $, esc, fmt, on, toast, copiar, normWsp, waLink, soloDigitos, store, debounce } from './util.js';
import { htmlCatalogo, imprimir } from './catalogo.js';
import { abrirFlyer } from './flyer.js';
import { anuncioHtml, heroHtml, beneficiosHtml, testimoniosHtml, popupHtml, firmaPopup, secOn, iniciarCarrusel, comprarCardHtml, comprarModalHtml, faqHtml } from './bloques.js';

const S = { ref: null, slug: '', tienda: null, prods: [], cart: [], may: null, codigo: '', cat: 'Todas', q: '', limite: 60, sel: {}, vista: 'cat', pay: 'transferencia', env: null, pedirCodigo: false, enviando: false, ultimo: null, fly: [] };
const pagoUi = k => (k === 'link' && S.tienda.mp_activo ? ['💳', 'Mercado Pago', 'Tarjeta, débito o dinero en cuenta · pagás online ahora'] : PAGO[k]);
const PAGO = { transferencia: ['🏦', 'Transferencia bancaria', 'Te pasamos alias / CBU en el ticket'], efectivo: ['💵', 'Efectivo / contra entrega', 'Lo coordinamos por WhatsApp'], link: ['📲', 'Link de pago (tarjeta / Mercado Pago)', 'Te lo enviamos por WhatsApp'] };

/* ---------- modo y precios (la base de datos ya calculó los precios; acá solo se elige cuál mostrar) ---------- */
const vista = () => { const m = S.tienda.modalidad; return m === 'minorista' ? 'min' : m === 'mayorista' ? 'may' : (S.may ? 'may' : 'min'); };
function tramos(p) {
  if (vista() !== 'may') return null;
  const src = S.tienda.modalidad === 'mayorista' ? p : (S.may && S.may.get(p.id));
  if (!src) return null;
  // precio único (o sin escalas cargadas): el mismo precio para cualquier cantidad, y se muestra como uno solo
  if (p.precio_unico || src.precio_3 == null) return { 1: +src.precio_1, 3: +src.precio_1, 6: +src.precio_1, 12: +src.precio_1, unico: true };
  return { 1: +src.precio_1, 3: +src.precio_3, 6: +src.precio_6, 12: +src.precio_12 };
}
// "por caja x12", "por kg"… (vacío si se vende por unidad)
const UNI = { par: 'par', docena: 'docena', pack: 'pack', bulto: 'bulto', caja: 'caja', display: 'display', kg: 'kg', gramos: 'gramo', litro: 'litro', metro: 'metro' };
export const unidadTxt = (u, n) => !u || u === 'unidad' || !UNI[u] ? '' : UNI[u] + (n && ['pack', 'bulto', 'caja', 'display'].includes(u) ? ' x' + n : '');
const porUnidad = p => { const u = unidadTxt(p.unidad, p.contenido); return u ? `<div class="flat-note">por ${esc(u)}</div>` : ''; };
const unidad = (p, q) => { const t = tramos(p); if (!t) return +p.precio_1; return q >= 12 ? t[12] : q >= 6 ? t[6] : q >= 3 ? t[3] : t[1]; };
const qtyDe = id => S.cart.filter(l => l.id === id).reduce((a, l) => a + l.qty, 0);
const prod = id => S.prods.find(p => p.id === id);
// "Tu ganancia": lo que gana el cliente que revende (solo en lista mayorista y si la tienda lo activó)
const ganOn = () => !!S.tienda.reventa_activa && vista() === 'may';
const pvpDe = p => +p.pvp_sugerido > 0 ? +p.pvp_sugerido : Math.ceil(unidad(p, 1) * (1 + (+S.tienda.reventa_margen || 0.6)) / 10) * 10;
function ganHtml(p, q) {
  if (!ganOn()) return '';
  const u = unidad(p, Math.max(1, q)), pv = pvpDe(p), g = pv - u; if (!(g > 0)) return '';
  return `<div class="gan"><span>🏷️ Vendelo a <b>${fmt(pv)}</b></span><span class="gan-g">💰 Ganás <b>${fmt(g)}</b> c/u · ${Math.round(g / u * 100)}%</span></div>`;
}
function ganCarrito() {
  if (!ganOn()) return '';
  const L = lineas(), inv = L.reduce((a, l) => a + l.sub, 0), fac = L.reduce((a, l) => a + pvpDe(l.p) * l.qty, 0), g = fac - inv; if (!(g > 0) || !inv) return '';
  return `<div class="gan gan-tot"><div class="srow"><span>Vendiendo todo al precio sugerido</span><span class="v">${fmt(fac)}</span></div><div class="srow tot"><span>💰 Tu ganancia estimada</span><span class="v">+${fmt(g)} · ${Math.round(g / inv * 100)}%</span></div></div>`;
}
function lineas() {
  return S.cart.map((l, i) => { const p = prod(l.id); if (!p) return null; const q = qtyDe(l.id); const pu = unidad(p, q); return { i, p, vr: l.vr, qty: l.qty, pu, sub: pu * l.qty, base: +p.precio_1 * l.qty }; }).filter(Boolean);
}
function totales() { const L = lineas(); return { n: L.reduce((a, l) => a + l.qty, 0), total: L.reduce((a, l) => a + l.sub, 0), ahorro: L.reduce((a, l) => a + (l.base - l.sub), 0) }; }
const envios = () => Array.isArray(S.tienda.envios) ? S.tienda.envios : [];
const envioSel = () => envios().find(e => e.id === S.env) || null;
// mismo criterio que el servidor (el servidor recalcula y es el que cobra)
const costoEnvio = (e, total) => !e ? 0 : e.tipo !== 'retiro' && +S.tienda.envio_gratis_desde > 0 && total >= +S.tienda.envio_gratis_desde ? 0 : +e.costo || 0;
const ENV_ICO = { retiro: '🏪', envio: '🚚', moto: '🛵', correo: '📮', acordar: '💬' };
const minimo = () => (vista() === 'may' ? +S.tienda.compra_minima || 0 : 0);
function pista() {
  if (vista() !== 'may' || !S.tienda.escalas_activas) return null;
  let mejor = null; const visto = {};
  S.cart.forEach(l => {
    if (visto[l.id]) return; visto[l.id] = 1; const p = prod(l.id); const t = p && tramos(p); if (!t) return;
    const q = qtyDe(l.id), nx = [3, 6, 12].find(x => x > q); if (!nx) return;
    const pc = unidad(p, q), pn = t[nx]; if (pn >= pc) return;
    const falta = nx - q, ahorro = (q + falta) * (pc - pn);
    if (!mejor || falta < mejor.falta) mejor = { falta, nombre: p.nombre, ahorro, q, nx };
  });
  return mejor;
}
const guardarCarrito = () => store.set('cart:' + S.slug, S.cart);

/* ---------- barra de escalas: cuánto falta para el próximo precio y cuánto se ahorra ---------- */
function escala(p, q) {
  const t = tramos(p); if (!t || t.unico || !S.tienda.escalas_activas || !(t[12] < t[1])) return null;
  const nx = [3, 6, 12].find(x => x > q) || null, pu = unidad(p, Math.max(1, q));
  const pos = q >= 12 ? 100 : q >= 6 ? 66.6 + (q - 6) / 6 * 33.4 : q >= 3 ? 33.3 + (q - 3) / 3 * 33.3 : q / 3 * 33.3;
  return { t, q, nx, falta: nx ? nx - q : 0, pu, pn: nx ? t[nx] : pu, ahorro: q * (t[1] - pu), nivel: q >= 12 ? 3 : q >= 6 ? 2 : q >= 3 ? 1 : 0, pos: Math.round(pos) };
}
function escalaHtml(p, q, compacta) {
  const e = escala(p, q); if (!e || (compacta && !q)) return '';
  const u = e.falta === 1 ? '1 unidad' : e.falta + ' unidades';
  const msg = !e.nx ? `🎉 ¡Mejor precio desbloqueado! Ahorrás <b>${fmt(e.ahorro)}</b>`
    : !q ? `Llevando ${e.nx} pagás <b>${fmt(e.pn)}</b> c/u`
    : `Te ${e.falta === 1 ? 'falta' : 'faltan'} <b>${u}</b> para el precio x${e.nx}${e.nx === 12 ? '+' : ''} (${fmt(e.pn)} c/u)${e.ahorro > 0 ? ` · ya ahorrás <b>${fmt(e.ahorro)}</b>` : ''}`;
  return `<div class="esc-bar lvl${e.nivel}" data-falta="${e.falta}" role="status"><div class="esc-msg">${msg}</div><div class="esc-track" aria-hidden="true"><i style="width:${e.pos}%"></i>${[3, 6, 12].map((n, i) => `<span class="${q >= n ? 'ok' : ''}" style="left:${[33.3, 66.6, 100][i]}%">x${n}</span>`).join('')}</div></div>`;
}
// "Tu ganancia estimada de reventa" para lo que lleva de un producto
function ganQty(p, q) {
  if (!ganOn() || !q) return '';
  const g = (pvpDe(p) - unidad(p, q)) * q; return g > 0 ? `<div class="gan-badge">💰 Tu ganancia estimada de reventa: <b>+${fmt(g)}</b></div>` : '';
}

/* ---------- cierre de pedidos (lo configura el comercio; el servidor es el que manda) ---------- */
const cierre = () => { const c = S.tienda.cierre_at ? new Date(S.tienda.cierre_at).getTime() : 0; return c ? { at: c, cerrado: Date.now() >= c, pausa: S.tienda.cierre_modo === 'pausar', texto: String(S.tienda.cierre_texto || '').trim() } : null; };
const pausado = () => { const c = cierre(); return !!(c && c.cerrado && c.pausa); };
const d2 = n => String(n).padStart(2, '0');
export function faltaTxt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d > 0 ? `${d2(d)}d ${d2(h)}h ${d2(m)}m` : `${d2(h)}h ${d2(m)}m ${d2(s % 60)}s`;
}
function cierreHtml() {
  const c = cierre(); if (!c) return '';
  if (!c.cerrado) return `<div class="st-cierre" id="st-cierre" role="timer" aria-live="off">⏳ Esta ronda de pedidos cierra en <b id="cierre-t">${faltaTxt(c.at - Date.now())}</b></div>`;
  return c.pausa ? `<div class="st-cierre cerrado" id="st-cierre" role="status">🔒 Los pedidos de esta ronda ya cerraron.${c.texto ? ' ' + esc(c.texto) : ' Volvé a entrar en unos días.'}</div>`
    : `<div class="st-cierre tanda" id="st-cierre" role="status">📦 La ronda cerró: lo que pidas ahora entra en la próxima tanda.${c.texto ? ' ' + esc(c.texto) : ''}</div>`;
}
let relojCierre = null;
function iniciarReloj() {
  clearInterval(relojCierre); const c = cierre(); if (!c || c.cerrado) return;
  relojCierre = setInterval(() => {
    const el = document.getElementById('cierre-t'); if (!el) { clearInterval(relojCierre); return; }
    if (Date.now() >= c.at) { clearInterval(relojCierre); if (S.vista === 'co') repintarCo(); else pintar(); return; }
    el.textContent = faltaTxt(c.at - Date.now());
  }, 1000);
}

/* ---------- flyers para revender (marca blanca): solo en la lista mayorista ---------- */
const flyOn = () => vista() === 'may';
const itemFlyer = p => ({ nombre: p.nombre, img: p.imagen_url || '', emoji: p.emoji, precio: pvpDe(p) });   // solo nombre, foto y precio de venta: nada del comercio ni del costo
const badgeFlyer = L => L.every(p => p.a_pedido) ? '📦 Por Encargo' : '🔥 En Stock';
function crearFlyer(ids) { const L = ids.map(prod).filter(Boolean); if (L.length) abrirFlyer({ modo: 'reventa', items: L.map(itemFlyer), badge: badgeFlyer(L) }); }
// foto en CSS (para el fondo difuminado): solo https y sin caracteres que rompan la regla
const cssUrl = u => /^https:\/\//.test(u || '') ? `--img:url('${encodeURI(decodeURI(u)).replace(/['()\\]/g, c => '%' + c.charCodeAt(0).toString(16))}')` : '';
const cssImg = u => { try { return cssUrl(u); } catch (e) { return ''; } };

/* ---------- marca del comercio: color, tema, logo ---------- */
const HEX = /^#[0-9a-fA-F]{6}$/;
function marca() {
  const t = S.tienda, c = HEX.test(t.color || '') ? t.color : '#1d4ba8';
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255, osc = x => Math.round(x * 0.82);
  const ac2 = '#' + [r, g, b].map(x => osc(x).toString(16).padStart(2, '0')).join('');
  const root = document.documentElement;
  if (t.tema === 'oscuro') root.setAttribute('data-theme', 'dark'); else if (t.tema === 'claro') root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
  return `--ac:${c};--ac2:${ac2};--acs:color-mix(in srgb, ${c} 14%, transparent);--on-ac:${lum > 0.62 ? '#0A0F1F' : '#FFFFFF'}`;
}

/* ---------- Meta Pixel (solo si el plan lo incluye y el comercio cargó su ID) ---------- */
function cargarPixel(id) {
  if (!id || window.fbq || !/^\d{5,20}$/.test(id)) return;
  const n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
  const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(s);
  window.fbq('init', id); window.fbq('track', 'PageView');
}
const evento = (n, d) => { try { if (window.fbq) window.fbq('track', n, d); } catch (e) { } };

/* ---------- entrada ---------- */
export async function mostrarTienda(slug, app) {
  app.innerHTML = '<div class="page center" style="padding-top:80px"><span class="spin"></span></div>';
  S.slug = slug;
  try {
    S.tienda = await api.tienda(slug);
    if (!S.tienda) { app.innerHTML = '<div class="page center"><h2>Esta tienda no existe o está pausada</h2><p class="muted" style="margin:10px 0 18px">Revisá el enlace que te pasaron.</p><a class="btn btn-p btn-sm" href="/">Ir al inicio</a></div>'; return; }
    S.prods = await api.productos(slug);
  } catch (e) { app.innerHTML = '<div class="page"><div class="err-box">' + esc(e.message) + '</div></div>'; return; }
  S.cart = (store.get('cart:' + slug, []) || []).filter(l => l && prod(l.id));
  try { const pg = new URLSearchParams(location.search).get('pago'); S.avisoPago = ({ ok: '✅ ¡Gracias! Estamos confirmando tu pago con Mercado Pago. El comercio te avisa por WhatsApp.', pendiente: '⏳ Tu pago quedó pendiente. Cuando se acredite, el comercio lo confirma.', error: 'El pago no se completó. Podés volver a intentar o coordinar por WhatsApp.' })[pg] || ''; } catch (e) { S.avisoPago = ''; }
  try { const r = new URLSearchParams(location.search).get('r'); if (r && /^[A-Za-z0-9_-]{8,64}$/.test(r)) store.set('ref:' + slug, { r, ts: Date.now() }); const g = store.get('ref:' + slug, null); S.ref = g && g.r && Date.now() - g.ts < 30 * 864e5 ? g.r : null; } catch (e) { S.ref = null; }   // la atribución al revendedor vence a los 30 días
  S.may = null; S.codigo = ''; S.vista = 'cat'; S.cat = 'Todas'; S.q = ''; S.limite = 60; S.pedirCodigo = false;
  cargarPixel(S.tienda.pixel_id);
  document.title = S.tienda.nombre;
  pintar();
}

/* ---------- pantallas ---------- */
function pintar() {
  const app = $('#root'), m = vista(), T = totales();
  app.innerHTML = `<div id="app" data-m="${m}" style="${marca()}">
    <div id="hdr"><div class="hdr-store" style="display:flex;gap:8px;align-items:center;font-weight:800;color:var(--t1);font-size:.95rem">${S.tienda.logo_url ? `<img src="${esc(S.tienda.logo_url)}" alt="" style="height:28px;border-radius:6px">` : ''}${esc(S.tienda.nombre)}</div>
      <button id="cart-fab" data-act="st-ir" data-v="cart" aria-label="Carrito">🛒${T.n ? `<span id="cart-n">${T.n}</span>` : ''}</button></div>
    ${cierreHtml()}${anuncioHtml(S.tienda.diseno)}<div id="content">${S.vista === 'cat' ? pantallaCat() : S.vista === 'cart' ? pantallaCarrito() : S.vista === 'co' ? pantallaCheckout() : pantallaOk()}</div></div>`;
  if (S.vista === 'cat') { pintarGrid(); pintarBarra(); pintarFlybar(); pintarPopup(); iniciarCarrusel(app); }
  iniciarReloj();
}
function pintarPopup() {
  const d = S.tienda.diseno, k = 'pop:' + S.slug, f = firmaPopup(d), r = $('#pop-root');
  if (!r || !f || S.popVisto || store.get(k, '') === f) return;
  const h = popupHtml(d); if (!h) return;
  r.innerHTML = h; S.popVisto = true; store.set(k, f);
}
on('st-pop-cerrar', () => { const r = $('#pop-root'); if (r) r.innerHTML = ''; });
on('st-pop-bg', (d, b, e) => { if (e.target === b) { const r = $('#pop-root'); if (r) r.innerHTML = ''; } });
on('st-pop-copiar', d => copiar(d.v));
const cerrarComprar = () => { const r = $('#pop-root'); if (r) r.innerHTML = ''; };
on('st-comprar', () => { const r = $('#pop-root'); if (r) { r.innerHTML = comprarModalHtml(S.tienda.diseno, S.tienda); const b = r.querySelector('[data-act=st-comprar-cerrar]'); if (b) b.focus(); } });
on('st-comprar-cerrar', cerrarComprar);
on('st-comprar-bg', (d, b, e) => { if (e.target === b) cerrarComprar(); });
on('st-hero', () => { const e = $('#search-row'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
function banner() {
  const aviso = S.avisoPago ? `<div class="ok-box" role="status" style="margin:12px 16px">${esc(S.avisoPago)}</div>` : '';
  const t = S.tienda, m = vista();
  let chips = m === 'min' ? '<span class="chip">🛍️ Comprás desde 1 unidad · sin mínimo</span>'
    : `<span class="chip">📦 ${t.escalas_activas ? 'Precios por volumen x1 · x3 · x6 · x12' : 'Lista mayorista'}${minimo() ? ' · mínimo ' + fmt(minimo()) : ''}</span>`;
  if (t.modalidad === 'hibrido') chips += S.may ? '<button class="chip" data-act="may-salir">✓ Lista mayorista activa · Salir</button>' : '<button class="chip" data-act="may-abrir">💼 Acceso Mayorista</button>';
  const caja = S.pedirCodigo && !S.may ? `<form data-submit="may-codigo" id="gremio-box"><input class="fi" name="codigo" placeholder="Código de revendedor" autocomplete="off" aria-label="Código de revendedor" required><button class="btn btn-p btn-sm" type="submit">Activar</button></form><div class="ferr" id="may-err" hidden></div>` : '';
  if (t.modo_stock === 'encargo') chips += `<span class="chip">📦 Por encargo · llega en ${+t.demora_encargo || 7} días</span>`;
  if (+t.envio_gratis_desde > 0 && envios().some(e => e.tipo !== 'retiro')) chips += `<span class="chip">🚚 Envío gratis desde ${fmt(t.envio_gratis_desde)}</span>`;
  chips += '<button class="chip" data-act="st-pdf">📄 Lista de precios (PDF)</button>';
  return aviso + heroHtml(t.diseno) + `<div id="store-banner"><div class="banner-name">${esc(t.nombre)}</div><div class="banner-sub">${esc(t.eslogan || '')}</div><div class="banner-row">${chips}</div>${caja}</div>` + beneficiosHtml(t.diseno) + comprarCardHtml(t.diseno);
}
function pantallaCat() {
  return `${banner()}<div id="search-row"><div class="srch-wrap"><span class="srch-ico">🔍</span><input class="fi" id="srch" data-input="st-q" placeholder="Buscar producto…" value="${esc(S.q)}" aria-label="Buscar producto"></div></div>
    <div id="cats"></div><div id="pgrid"></div><div id="mas"></div>${testimoniosHtml(S.tienda.diseno)}${faqHtml(S.tienda.diseno)}<div id="pdet-root"></div><div id="pop-root"></div><div class="cart-fixed"><div id="flybar" hidden></div><div id="cartbar" hidden></div></div><div style="height:90px"></div>`;
}
function pintarGrid() {
  const cats = ['Todas', ...new Set(S.prods.map(p => p.categoria))];
  $('#cats').hidden = !secOn(S.tienda.diseno, 'categorias');
  $('#cats').innerHTML = cats.map(c => `<button class="pill ${c === S.cat ? 'on' : ''}" data-act="st-cat" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  const q = S.q.toLowerCase().trim();
  const lista = S.prods.filter(p => (S.cat === 'Todas' || p.categoria === S.cat) && (!q || p.nombre.toLowerCase().includes(q) || (p.marca || '').toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)));
  const m = vista(), esc_ = S.tienda.escalas_activas, g = $('#pgrid');
  if (!lista.length) { g.innerHTML = '<div style="grid-column:1/-1" class="empty"><div class="ico">🔍</div><p>No encontramos productos.</p></div>'; $('#mas').innerHTML = ''; return; }
  const verCat = S.cat === 'Todas' && cats.length > 2;   // la etiqueta de categoría solo suma si hay varias
  g.innerHTML = lista.slice(0, S.limite).map(p => {
    const t = tramos(p), qty = qtyDe(p.id), vi = S.sel[p.id] || 0, vars = p.variantes || [];
    const hl = n => qty > 0 && ((n === 12 && qty >= 12) || (n === 6 && qty >= 6 && qty < 12) || (n === 3 && qty >= 3 && qty < 6) || (n === 1 && qty < 3)) ? 'hl' : '';
    const usd = n => S.tienda.mostrar_usd && S.tienda.cotizacion_usd ? `<div class="flat-note">≈ USD ${(n / S.tienda.cotizacion_usd).toFixed(2).replace('.', ',')}</div>` : '';
    const precio = m === 'min' || !t ? `<div><span class="retail-price">${fmt(p.precio_1)}</span>${porUnidad(p)}${usd(+p.precio_1)}</div>`
      : t.unico ? `<div><span class="retail-price">${fmt(t[1])}</span>${porUnidad(p)}<div class="flat-note">precio mayorista único</div>${usd(t[1])}</div>`
      : esc_ ? `${porUnidad(p)}<div class="ptiers">${[1, 3, 6, 12].map(n => `<div class="ptier ${hl(n)}"><div class="ptier-q">x${n}${n === 12 ? '+' : ''}</div><div class="ptier-p">${fmt(t[n])}</div>${n > 1 && t[1] ? `<div class="ptier-s">-${Math.round((1 - t[n] / t[1]) * 100)}%</div>` : ''}</div>`).join('')}</div>`
      : `<div><span class="retail-price">${fmt(t[1])}</span>${porUnidad(p)}<div class="flat-note">precio mayorista</div>${usd(t[1])}</div>`;
    const enFly = S.fly.includes(p.id);
    const ctrl = p.agotado ? '<button class="qadd" disabled>Agotado</button>' : qty > 0
      ? `<button class="qbtn" data-act="st-dec" data-id="${p.id}" aria-label="Quitar uno">−</button><span class="qnum">${qty}</span><button class="qbtn" data-act="st-add" data-id="${p.id}" aria-label="Agregar uno">+</button>`
      : `<button class="qadd" data-act="st-add" data-id="${p.id}">+ Agregar</button>`;
    return `<div class="pcard${qty ? ' in-cart' : ''}"><div class="pimg${p.imagen_url ? ' con-img' : ' noimg'}" data-act="st-ver" data-id="${p.id}" role="button" tabindex="0" aria-label="Ver ${esc(p.nombre)}" style="cursor:pointer;${p.imagen_url ? cssImg(p.imagen_url) : 'background:linear-gradient(145deg,var(--acs),transparent 70%),var(--bg2)'}">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}" loading="lazy">` : ''}${verCat ? `<span class="badge badge-cat">${esc(p.categoria)}</span>` : ''}${qty ? `<span class="badge badge-qty">${qty} u</span>` : ''}${p.agotado ? '<span class="badge badge-out">Sin stock</span>' : p.a_pedido && S.tienda.modo_stock === 'mixto' ? `<span class="badge badge-enc">Por encargo · llega en ${+p.demora_dias} días</span>` : p.ultimas ? `<span class="badge badge-low">¡Últimas ${+p.ultimas}!</span>` : ''}${p.imagen_url ? '' : `<div class="pimg-emoji">${esc(p.emoji)}</div>`}</div>
      <div class="pbody"><div class="pname" data-act="st-ver" data-id="${p.id}">${esc(p.nombre)}</div>${vars.length ? `<div class="vars" role="group" aria-label="Variante">${vars.map((v, i) => `<button class="vchip ${vi === i ? 'on' : ''}" data-act="st-var" data-id="${p.id}" data-i="${i}">${esc(v)}</button>`).join('')}</div>` : ''}${vars.length > 1 && !p.agotado ? `<button class="mx-link" data-act="st-ver" data-id="${p.id}" data-mx="1">▦ Cargar varias opciones a la vez</button>` : ''}${precio}${escalaHtml(p, qty, true)}${ganHtml(p, qty)}<div class="pqty">${ctrl}</div>${flyOn() ? `<button class="fly-btn${enFly ? ' on' : ''}" data-act="fly-sel" data-id="${p.id}" aria-pressed="${enFly}">${enFly ? '✓ En tu flyer' : '📸 Crear Flyer para Vender'}</button>` : ''}</div></div>`;
  }).join('');
  $('#mas').innerHTML = lista.length > S.limite ? `<div class="more"><button class="btn btn-s" data-act="st-mas">Ver más (${lista.length - S.limite} restantes)</button></div>` : '';
}
function pintarBarra() {
  const T = totales(), cb = $('#cartbar'); if (!cb) return;
  cb.hidden = T.n === 0; if (!T.n) return;
  const h = pista(), mc = minimo();
  cb.setAttribute('data-act', 'st-ir'); cb.dataset.v = 'cart';
  cb.innerHTML = `<div class="cb-main"><div class="cb-t">${T.n} u. · ${fmt(T.total)}</div><div class="cb-h">${h ? `Sumá ${h.falta} u. más y ahorrá ${fmt(h.ahorro)}` : (mc && T.total < mc ? `Faltan ${fmt(mc - T.total)} para el mínimo` : 'Listo para finalizar')}</div></div><div class="cb-go">Ver carrito →</div>`;
}
function pintarFlybar() {
  const fb = $('#flybar'); if (!fb) return;
  S.fly = S.fly.filter(prod); const n = S.fly.length; fb.hidden = !n || !flyOn(); if (fb.hidden) return;
  fb.innerHTML = `<div class="fb-t">${n === 1 ? '1 producto elegido' : n + ' productos elegidos'}<small>${n < 4 ? 'Podés sumar hasta 4' : 'Máximo 4 por flyer'}</small></div><button class="btn btn-p btn-sm" data-act="fly-crear">📸 Crear Flyer para Vender</button><button class="fb-x" data-act="fly-limpiar" aria-label="Quitar selección">✕</button>`;
}
on('fly-sel', d => {
  const i = S.fly.indexOf(d.id);
  if (i >= 0) S.fly.splice(i, 1); else if (S.fly.length >= 4) { toast('Un flyer lleva hasta 4 productos'); return; } else S.fly.push(d.id);
  pintarGrid(); pintarFlybar();
});
on('fly-crear', () => crearFlyer(S.fly));
on('fly-uno', d => { S.det = null; pintarDet(); crearFlyer([d.id]); });
on('fly-limpiar', () => { S.fly = []; pintarGrid(); pintarFlybar(); });
function bloquesProgreso(T) {
  let h = ''; const th = pista(), mc = minimo();
  if (th) { const base = { 3: 0, 6: 3, 12: 6 }[th.nx], pct = Math.min(100, Math.round((th.q - base) / (th.nx - base) * 100)); h += `<div class="prog"><div class="prog-t">Sumá <span>${th.falta} u. más</span> de ${esc(th.nombre)} y ahorrá <span>${fmt(th.ahorro)}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`; }
  if (mc) { const ok = T.total >= mc; h += `<div class="prog ${ok ? '' : 'warn'}"><div class="prog-t">${ok ? '✓ Superaste el mínimo de compra (' + fmt(mc) + ')' : 'Compra mínima ' + fmt(mc) + ' · te faltan <span>' + fmt(mc - T.total) + '</span>'}</div><div class="bar"><i style="width:${Math.min(100, Math.round(T.total / mc * 100))}%"></i></div></div>`; }
  return h;
}
function pantallaCarrito() {
  const L = lineas();
  if (!L.length) return '<div class="page"><button class="back" data-act="st-ir" data-v="cat">← Seguir comprando</button><div class="empty"><div class="ico">🛒</div><p>Todavía no agregaste productos.</p></div></div>';
  const T = totales(), mc = minimo(), bloq = mc && T.total < mc, pau = pausado(), visto = {};
  const extra = l => { if (visto[l.p.id]) return ''; visto[l.p.id] = 1; const q = qtyDe(l.p.id); return escalaHtml(l.p, q, true) + ganQty(l.p, q); };
  return `<div class="page"><button class="back" data-act="st-ir" data-v="cat">← Seguir comprando</button><div class="view-title">🛒 Mi carrito</div>${bloquesProgreso(T)}
    ${L.map(l => `${extra(l)}<div class="citem"><div class="citem-em">${esc(l.p.emoji)}</div><div class="citem-inf"><div class="citem-nm">${esc(l.p.nombre)}${l.vr ? ' · ' + esc(l.vr) : ''}</div><div class="citem-pr">${fmt(l.pu)} c/u · <b>${fmt(l.sub)}</b></div></div><div class="citem-ctrl"><button class="qbtn" data-act="st-lq" data-i="${l.i}" data-d="-1" aria-label="Quitar uno">−</button><span class="qnum">${l.qty}</span><button class="qbtn" data-act="st-lq" data-i="${l.i}" data-d="1" aria-label="Agregar uno">+</button></div></div>`).join('')}
    <div class="card"><div class="srow"><span>Unidades</span><span class="v">${T.n}</span></div>${T.ahorro > 0 ? `<div class="srow"><span>Ahorro por volumen</span><span class="v save">-${fmt(T.ahorro)}</span></div>` : ''}<div class="srow tot"><span>Total productos</span><span class="v">${fmt(T.total)}</span></div>${envios().length ? '<div class="hint" style="margin-top:6px">El envío lo elegís en el próximo paso.</div>' : ''}</div>${ganCarrito()}
    <button class="btn btn-p" ${bloq || pau ? 'disabled' : ''} data-act="st-ir" data-v="co">${pau ? '🔒 Pedidos cerrados por ahora' : bloq ? 'Faltan ' + fmt(mc - T.total) + ' para el mínimo' : 'Continuar →'}</button></div>`;
}
function pantallaCheckout() {
  if (!S.cart.length || pausado()) { S.vista = 'cart'; return pantallaCarrito(); }
  return `<div class="page"><button class="back" data-act="st-ir" data-v="cart">← Volver al carrito</button><div class="view-title">📋 Tus datos</div><div id="co-err"></div>
    <form data-submit="st-pedir" id="co-form">
      <div class="fg"><label class="flabel" for="co-nom">Nombre completo</label><input class="fi" id="co-nom" name="nombre" data-input="st-contacto" maxlength="80" required></div>
      <div class="fg"><label class="flabel" for="co-wsp">Tu WhatsApp</label><input class="fi" id="co-wsp" name="whatsapp" type="tel" inputmode="tel" placeholder="11 2345-6789" data-input="st-contacto" required></div>
      ${camposExtra()}
      ${envioUi()}
      <div class="fg"><label class="flabel">Medio de pago</label>${Object.keys(PAGO).map(k => { const [i, n, d] = pagoUi(k); return `<button type="button" class="opt ${S.pay === k ? 'on' : ''}" data-act="st-pay" data-p="${k}"><span class="opt-ico">${i}</span><span class="opt-tx"><div class="opt-nm">${n}</div><div class="opt-ds">${d}</div></span><span class="radio"></span></button>`; }).join('')}</div>
      ${tandaUi()}${encargoUi()}${notaUi()}
      ${resumenCo()}
      <button class="btn btn-p" type="submit" id="co-go">Confirmar pedido</button></form></div>`;
}
const PROVINCIAS = ['Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'];
const pide = k => { const c = S.tienda.datos_checkout || { localidad: 'opcional' }; return c[k] || 'no'; };
function camposExtra() {
  const lab = (k, t) => `${t}${pide(k) === 'opcional' ? ' <small class="muted">(opcional)</small>' : ''}`, req = k => pide(k) === 'obligatorio' ? 'required' : '';
  let h = '';
  if (pide('dni') !== 'no') h += `<div class="fg"><label class="flabel" for="co-dni">${lab('dni', 'DNI / CUIT')}</label><input class="fi" id="co-dni" name="dni" inputmode="numeric" maxlength="14" placeholder="Solo números" ${req('dni')}></div>`;
  if (pide('localidad') !== 'no') h += `<div class="fg"><label class="flabel" for="co-loc">${lab('localidad', 'Localidad')}</label><input class="fi" id="co-loc" name="localidad" maxlength="80" placeholder="Barrio / ciudad" ${req('localidad')}></div>`;
  if (pide('provincia') !== 'no' || pide('cp') !== 'no') {
    h += '<div class="row2">';
    if (pide('provincia') !== 'no') h += `<div class="fg"><label class="flabel" for="co-prov">${lab('provincia', 'Provincia')}</label><select class="fi" id="co-prov" name="provincia" ${req('provincia')}><option value="">Elegí…</option>${PROVINCIAS.map(p => `<option>${p}</option>`).join('')}</select></div>`;
    if (pide('cp') !== 'no') h += `<div class="fg"><label class="flabel" for="co-cp">${lab('cp', 'Código postal')}</label><input class="fi" id="co-cp" name="cp" maxlength="8" placeholder="Ej: 1846" autocomplete="postal-code" ${req('cp')}></div>`;
    h += '</div>';
  }
  return h;
}
const tandaUi = () => { const c = cierre(); return c && c.cerrado && !c.pausa ? `<div class="enc-note enc-co" id="co-tanda">📦 La ronda de pedidos ya cerró: este pedido entra en la <b>próxima tanda</b>.${c.texto ? ' ' + esc(c.texto) : ''}</div>` : ''; };
function encargoUi() {
  const L = lineas().filter(l => l.p.a_pedido); if (!L.length) return '';
  const max = Math.max(...L.map(l => +l.p.demora_dias || 0));
  return `<div class="enc-note enc-co">📦 ${S.tienda.modo_stock === 'encargo' ? 'Trabajamos por encargo' : (L.length === 1 ? '1 producto es por encargo' : L.length + ' productos son por encargo')}: tu pedido llega en hasta <b>${max} días</b> desde que lo confirmamos.</div>`;
}
const notaUi = () => pide('nota') !== 'no' ? `<div class="fg"><label class="flabel" for="co-nota">Aclaraciones para el vendedor${pide('nota') === 'opcional' ? ' <small class="muted">(opcional)</small>' : ''}</label><textarea class="fi" id="co-nota" name="nota" rows="2" maxlength="300" placeholder="Ej: horario de entrega, factura A, etc." ${pide('nota') === 'obligatorio' ? 'required' : ''}></textarea></div>` : '';
function envioUi() {
  const L = envios(); if (!L.length) return '';
  if (!envioSel()) S.env = L.length === 1 ? L[0].id : null;
  const T = totales(), e = envioSel();
  return `<div class="fg"><span class="flabel" id="env-lbl">¿Cómo lo recibís?</span><div role="radiogroup" aria-labelledby="env-lbl">${L.map(x => { const c = costoEnvio(x, T.total); return `<button type="button" role="radio" aria-checked="${S.env === x.id}" class="opt ${S.env === x.id ? 'on' : ''}" data-act="st-env" data-e="${esc(x.id)}"><span class="opt-ico">${ENV_ICO[x.tipo] || '🚚'}</span><span class="opt-tx"><div class="opt-nm">${esc(x.nombre)}</div><div class="opt-ds">${(x.tipo === 'acordar' || x.tipo === 'correo') && !c && !(+S.tienda.envio_gratis_desde > 0 && totales().total >= +S.tienda.envio_gratis_desde) ? 'Costo a coordinar' : c ? fmt(c) : x.tipo === 'retiro' ? 'Sin cargo' : 'Gratis'}${x.detalle ? ' · ' + esc(x.detalle) : ''}</div></span><span class="radio"></span></button>`; }).join('')}</div></div>
    ${e && e.tipo === 'acordar' ? `<div class="fg"><label class="flabel" for="co-dir">Dirección o zona <small class="muted">(opcional)</small></label><input class="fi" id="co-dir" name="direccion" maxlength="160" placeholder="Para coordinar la entrega (barrio, calle…)"></div>`
      : e && e.tipo !== 'retiro' ? `<div class="fg"><label class="flabel" for="co-dir">Dirección de entrega</label><input class="fi" id="co-dir" name="direccion" maxlength="160" required minlength="5" placeholder="Calle, número, piso / referencia"></div>` : ''}`;
}
function resumenCo() {
  const T = totales(), e = envioSel(), c = costoEnvio(e, T.total);
  if (!envios().length) return `<div class="card"><div class="srow tot"><span>Total</span><span class="v">${fmt(T.total)}</span></div></div>`;
  return `<div class="card"><div class="srow"><span>Productos</span><span class="v">${fmt(T.total)}</span></div><div class="srow"><span>Envío</span><span class="v">${e ? (c ? fmt(c) : e.tipo === 'retiro' ? 'Sin cargo' : (e.tipo === 'acordar' || e.tipo === 'correo') && !+e.costo ? 'A coordinar' : 'Gratis') : '—'}</span></div><div class="srow tot"><span>Total</span><span class="v">${fmt(T.total + c)}</span></div></div>`;
}
function ticket(r, cliente) {
  const ubic = [cliente.localidad, cliente.provincia, cliente.cp ? 'CP ' + cliente.cp : ''].filter(Boolean).join(' · ');
  let t = `*PEDIDO N° ${r.numero}* · ${r.tienda}\nCliente: ${cliente.nombre}${cliente.dni ? '\nDNI/CUIT: ' + cliente.dni : ''}\nWhatsApp: ${cliente.whatsapp}\n${ubic ? 'Ubicación: ' + ubic + '\n' : ''}${S.tienda.modalidad === 'minorista' ? '' : 'Modalidad: ' + (r.modo === 'mayorista' ? 'Mayorista' : 'Minorista') + '\n'}\nDetalle:\n`;
  r.items.forEach(i => { const u = unidadTxt(i.unidad, i.contenido); t += `• ${i.cantidad} × ${i.nombre}${i.variante ? ' (' + i.variante + ')' : ''}${u ? ' [' + u + ']' : ''} · ${fmt(i.precio_unitario)} c/${u || 'u'} = ${fmt(i.subtotal)}\n`; });
  if (r.envio) {
    const e = envioSel(), gratis = +S.tienda.envio_gratis_desde > 0 && +r.subtotal >= +S.tienda.envio_gratis_desde;
    const env = +r.envio_costo ? fmt(r.envio_costo) : e && e.tipo === 'retiro' ? 'sin cargo' : e && (e.tipo === 'acordar' || e.tipo === 'correo') && !gratis ? 'a coordinar' : 'gratis';
    t += `\nEntrega: ${r.envio}${cliente.direccion ? ' · ' + cliente.direccion : ''}\nProductos: ${fmt(r.subtotal)} · Envío: ${env}\n`;
  }
  t += `\nPago: ${PAGO[S.pay] ? pagoUi(S.pay)[1] : S.pay}\n`;
  if (S.pay === 'transferencia') t += `Alias/CBU: ${r.alias_cobro || 'pasámelo por acá'}\n`;
  if (cliente.nota) t += `Aclaraciones: ${cliente.nota}\n`;
  { const enc = lineas().filter(l => l.p.a_pedido); if (enc.length) t += `Por encargo: llega en hasta ${Math.max(...enc.map(l => +l.p.demora_dias || 0))} días\n`; }
  if (r.proxima_tanda) t += `Entra en la próxima tanda de pedidos\n`;
  { const e = envioSel(); if (r.envio && !+r.envio_costo && e && (e.tipo === 'acordar' || e.tipo === 'correo') && !(+S.tienda.envio_gratis_desde > 0 && +r.subtotal >= +S.tienda.envio_gratis_desde)) return t + `*TOTAL: ${fmt(r.total)}* (sin el envío)`; }
  return t + `*TOTAL: ${fmt(r.total)}*`;
}
function pantallaOk() {
  const u = S.ultimo; if (!u) return '';
  return `<div class="page"><div class="center"><div class="ok-ring">✅</div><h2 style="font-size:1.4rem">¡Pedido registrado!</h2><p class="muted" style="margin:6px 0 18px">N° <b>${esc(u.r.numero)}</b> · ${fmt(u.r.total)}. Falta un paso: enviá el ticket por WhatsApp para que ${esc(S.tienda.nombre)} lo confirme.</p>${u.r.proxima_tanda ? '<p class="enc-note enc-co" id="ok-tanda">📦 Tu pedido entra en la próxima tanda.</p>' : ''}</div>
    <div class="stack">${u.mp ? `<a class="btn btn-p" id="mp-pagar" href="${esc(u.mp)}" rel="noopener">💳 Pagar ahora con Mercado Pago</a>` : ''}${u.mpError ? `<div class="err-box">${esc(u.mpError)} Podés coordinar el pago por WhatsApp.</div>` : ''}<a class="btn btn-wa" href="${esc(u.link)}" target="_blank" rel="noopener">📲 Enviar ticket por WhatsApp</a><pre class="ticket">${esc(u.tk)}</pre>
    <button class="btn btn-s" data-act="st-copiar">Copiar ticket</button><button class="btn btn-s" data-act="st-ir" data-v="cat">Seguir comprando</button></div>
    <p class="hint center" style="margin-top:12px">Si WhatsApp no se abrió solo, tu navegador bloqueó la ventana: usá el botón verde.</p></div>`;
}

/* ---------- acciones ---------- */
const ir = v => { S.vista = v; S.det = null; pintar(); window.scrollTo(0, 0); };
on('st-ir', d => ir(d.v));
on('st-q', (d, el) => { S.q = el.value; S.limite = 60; pintarGrid(); });
on('st-cat', d => { S.cat = d.c; S.limite = 60; pintarGrid(); });
on('st-mas', () => { S.limite += 60; pintarGrid(); });
on('st-var', d => { S.sel[d.id] = +d.i; pintarGrid(); pintarDet(); });
on('st-add', d => {
  const p = prod(d.id); if (!p || p.agotado) return;
  const vr = (p.variantes || [])[S.sel[p.id] || 0] || '';
  const ex = S.cart.find(l => l.id === p.id && l.vr === vr); ex ? ex.qty++ : S.cart.push({ id: p.id, vr, qty: 1 });
  guardarCarrito(); evento('AddToCart', { content_name: p.nombre }); refrescar();
});
on('st-dec', d => {
  const p = prod(d.id), vr = (p.variantes || [])[S.sel[p.id] || 0] || '';
  const l = S.cart.find(x => x.id === d.id && x.vr === vr) || S.cart.find(x => x.id === d.id); if (!l) return;
  l.qty--; if (l.qty < 1) S.cart = S.cart.filter(x => x !== l); guardarCarrito(); refrescar();
});
on('st-lq', d => { const l = S.cart[+d.i]; if (!l) return; l.qty += +d.d; if (l.qty < 1) S.cart.splice(+d.i, 1); guardarCarrito(); pintar(); });
function refrescar() { const T = totales(); const f = $('#cart-fab'); if (f) f.innerHTML = '🛒' + (T.n ? `<span id="cart-n">${T.n}</span>` : ''); pintarGrid(); pintarBarra(); pintarDet(); }
/* ---------- ficha de producto (foto grande, descripción, variantes y escalas) ---------- */
function pintarDet() {
  const r = $('#pdet-root'); if (!r) return;
  const p = S.det && prod(S.det); if (!p) { r.innerHTML = ''; return; }
  const t = tramos(p), qty = qtyDe(p.id), vi = S.sel[p.id] || 0, vars = p.variantes || [], matriz = vars.length > 1 && !p.agotado;
  const precios = t && S.tienda.escalas_activas && !t.unico ? `${porUnidad(p)}<div class="ptiers" style="margin:10px 0">${[1, 3, 6, 12].map(n => `<div class="ptier"><div class="ptier-q">x${n}${n === 12 ? '+' : ''}</div><div class="ptier-p">${fmt(t[n])}</div>${n > 1 && t[1] ? `<div class="ptier-s">-${Math.round((1 - t[n] / t[1]) * 100)}%</div>` : ''}</div>`).join('')}</div>` : `<div class="retail-price" style="margin:8px 0">${fmt(t ? t[1] : p.precio_1)}</div>${porUnidad(p)}${t && t.unico ? '<div class="flat-note">precio mayorista único: el mismo para cualquier cantidad</div>' : ''}`;
  r.innerHTML = `<div class="modal-bg" data-act="st-det-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(p.nombre)}">
    <div class="pdet-img${p.imagen_url ? ' con-img' : ' noimg'}"${p.imagen_url ? ` style="${cssImg(p.imagen_url)}"` : ''}>${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}">` : esc(p.emoji)}</div>
    <div class="view-title" style="margin-bottom:2px">${esc(p.nombre)}</div><div class="muted" style="font-size:.8rem">${esc([p.categoria, p.marca, p.sku ? 'Cód. ' + p.sku : ''].filter(Boolean).join(' · '))}</div>
    ${p.descripcion ? `<div class="pdet-desc">${esc(p.descripcion)}</div>` : ''}
    ${precios}${p.a_pedido ? `<div class="enc-note">📦 Por encargo: llega en ${+p.demora_dias} días desde que confirmás el pedido.</div>` : ''}
    ${matriz ? `<div class="flabel" style="margin-top:10px">Elegí cuántas de cada una${tramos(p) && !tramos(p).unico ? ' <small class="muted">(todas suman para el precio por cantidad)</small>' : ''}</div><div class="mx" id="mx">${vars.map((v, i) => { const n = qtyVar(p.id, v); return `<div class="mx-row${n ? ' on' : ''}"><span class="mx-n">${esc(v)}</span><button class="qbtn" data-act="st-vq" data-id="${p.id}" data-i="${i}" data-d="-1" aria-label="Quitar uno de ${esc(v)}" ${n ? '' : 'disabled'}>−</button><input class="fi mx-q" inputmode="numeric" data-change="st-vset" data-id="${p.id}" data-i="${i}" value="${n}" aria-label="Cantidad de ${esc(v)}"><button class="qbtn" data-act="st-vq" data-id="${p.id}" data-i="${i}" data-d="1" aria-label="Agregar uno de ${esc(v)}">+</button></div>`; }).join('')}</div><div class="mx-tot">${qty ? `<b>${qty} u.</b> en total · ${fmt(unidad(p, qty))} c/u · <b>${fmt(unidad(p, qty) * qty)}</b>` : 'Todavía no sumaste ninguna.'}</div>`
      : vars.length ? `<div class="flabel" style="margin-top:10px">Elegí una opción</div><div class="vars">${vars.map((v, i) => `<button class="vchip ${vi === i ? 'on' : ''}" data-act="st-var" data-id="${p.id}" data-i="${i}">${esc(v)}</button>`).join('')}</div>` : ''}
    ${escalaHtml(p, qty)}${ganQty(p, qty) || ganHtml(p, qty)}
    ${p.agotado ? '<button class="btn btn-s" disabled>Sin stock</button>' : matriz ? '' : `<div style="display:flex;gap:8px;align-items:center">${qty ? `<button class="qbtn" data-act="st-dec" data-id="${p.id}" aria-label="Quitar uno">−</button><span class="qnum">${qty}</span>` : ''}<button class="btn btn-p" style="flex:1" data-act="st-add" data-id="${p.id}">${qty ? '+ Agregar otro' : '+ Agregar al carrito'}</button></div>`}
    ${flyOn() ? `<button class="btn btn-s" style="margin-top:8px" data-act="fly-uno" data-id="${p.id}">📸 Crear Flyer para Vender</button>` : ''}
    ${qty ? `<button class="btn btn-s" style="margin-top:8px" data-act="st-ir" data-v="cart">Ver carrito (${totales().n} u.)</button>` : ''}
    <button class="btn btn-s" style="margin-top:8px" data-act="st-det-cerrar">Seguir mirando</button></div></div>`;
}
on('st-ver', d => { S.det = d.id; pintarDet(); if (d.mx) { const m = $('#mx'); if (m) m.scrollIntoView({ block: 'center' }); } });
// matriz de variantes: cada opción con su cantidad; todas suman para la escala del producto
const qtyVar = (id, vr) => { const l = S.cart.find(x => x.id === id && x.vr === vr); return l ? l.qty : 0; };
function setVar(id, i, n) {
  const p = prod(id); if (!p || p.agotado) return; const vr = (p.variantes || [])[+i]; if (vr === undefined) return;
  n = Math.max(0, Math.min(9999, Math.round(Number(n) || 0)));
  const l = S.cart.find(x => x.id === id && x.vr === vr), antes = l ? l.qty : 0;
  if (!n) S.cart = S.cart.filter(x => x !== l); else if (l) l.qty = n; else S.cart.push({ id, vr, qty: n });
  if (n > antes) evento('AddToCart', { content_name: p.nombre });
  guardarCarrito(); refrescar();
}
on('st-vq', d => setVar(d.id, d.i, qtyVar(d.id, (prod(d.id).variantes || [])[+d.i]) + +d.d));
on('st-vset', (d, el) => setVar(d.id, d.i, String(el.value).replace(/\D/g, '')));
on('st-det-cerrar', () => { S.det = null; pintarDet(); });
on('st-det-bg', (d, b, e) => { if (e.target === b) { S.det = null; pintarDet(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.det) { S.det = null; pintarDet(); } });
const CAMPOS = ['nombre', 'whatsapp', 'localidad', 'direccion', 'dni', 'provincia', 'cp', 'nota'];
function repintarCo() { const v = CAMPOS.map(n => { const e = document.querySelector(`#co-form [name=${n}]`); return e ? e.value : ''; }); pintar(); CAMPOS.forEach((n, i) => { const e = document.querySelector(`#co-form [name=${n}]`); if (e && v[i]) e.value = v[i]; }); }
on('st-pay', d => { S.pay = d.p; repintarCo(); });
on('st-env', d => { S.env = d.e; repintarCo(); const e = $('#co-dir'); if (e && e.required && !e.value) e.focus(); });

on('may-abrir', async () => { if (S.tienda.requiere_codigo) { S.pedirCodigo = true; pintar(); const i = document.querySelector('#gremio-box input'); if (i) i.focus(); } else await activarMay(null); });
on('may-codigo', async (d, f) => { await activarMay(new FormData(f).get('codigo')); });
on('may-salir', () => { S.may = null; S.codigo = ''; S.pedirCodigo = false; pintar(); toast('Volviste a precios minoristas'); });
async function activarMay(codigo) {
  try {
    const lista = await api.listaMayorista(S.slug, codigo);
    S.may = new Map(lista.map(r => [r.producto_id, r])); S.codigo = codigo || ''; S.pedirCodigo = false; pintar(); toast('💼 Lista mayorista activada');
  } catch (e) { const er = $('#may-err'); if (er) { er.textContent = e.message; er.hidden = false; } else toast(e.message); }
}

const subirCarrito = debounce(async (nombre, wsp) => {
  if (!S.tienda.carritos_activos || soloDigitos(wsp).length < 8 || !S.cart.length) return;
  try { const T = totales(); await api.guardarCarrito(S.slug, nombre || 'Cliente', wsp, lineas().map(l => ({ n: l.p.nombre, v: l.vr, q: l.qty })), T.total); } catch (e) { }
}, 1500);
on('st-contacto', () => { const f = $('#co-form'); if (f) subirCarrito(f.nombre.value.trim(), f.whatsapp.value.trim()); });

on('st-pedir', async (d, f) => {
  if (S.enviando) return;
  const val = n => f[n] ? String(f[n].value || '').trim() : '';
  const cliente = { nombre: val('nombre'), whatsapp: val('whatsapp'), localidad: val('localidad') };
  ['dni', 'provincia', 'cp', 'nota'].forEach(k => { if (val(k)) cliente[k] = val(k); });
  if (envios().length) {
    if (!envioSel()) { $('#co-err').innerHTML = '<div class="err-box">Elegí cómo querés recibir el pedido.</div>'; window.scrollTo(0, 0); return; }
    cliente.envio = S.env; if (f.direccion) cliente.direccion = f.direccion.value.trim();
  }
  const items = S.cart.map(l => ({ producto_id: l.id, variante: l.vr, cantidad: l.qty }));
  const btn = $('#co-go'); S.enviando = true; btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    const r = await api.crearPedido(S.slug, cliente, items, vista() === 'may' ? 'mayorista' : 'minorista', S.codigo, S.pay, S.ref);
    const tk = ticket(r, cliente), link = waLink(normWsp(r.whatsapp), tk);
    S.ultimo = { r, tk, link }; S.cart = []; guardarCarrito(); evento('Purchase', { value: r.total, currency: 'ARS' });
    if (S.pay === 'link' && S.tienda.mp_activo) {   // link de pago de Mercado Pago (el monto lo calcula el servidor)
      try { S.ultimo.mp = (await api.mpPreferencia(S.slug, r.id)).init_point; } catch (e) { S.ultimo.mpError = e.message; }
    }
    S.vista = 'ok'; pintar(); window.scrollTo(0, 0);
    if (!S.ultimo.mp) { try { window.open(link, '_blank', 'noopener'); } catch (e) { } }
  } catch (e) {
    $('#co-err').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; window.scrollTo(0, 0);
    btn.disabled = false; btn.textContent = 'Confirmar pedido';
  } finally { S.enviando = false; }
});
on('st-copiar', () => copiar(S.ultimo.tk));

on('st-pdf', () => {
  const t = S.tienda, g = new Map();
  S.prods.filter(p => !p.agotado).forEach(p => { const tr = tramos(p); const l = g.get(p.categoria) || []; l.push({ sku: p.sku, nombre: p.nombre, variantes: p.variantes, stock: '—', precio: tr ? tr[1] : +p.precio_1 }); g.set(p.categoria, l); });
  const grupos = [...g.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cat, filas]) => ({ cat, filas: filas.sort((a, b) => a.nombre.localeCompare(b.nombre)) }));
  imprimir(htmlCatalogo({ nombre: t.nombre, logo: t.logo_url, color: t.color, eslogan: t.eslogan, titulo: vista() === 'may' ? 'Lista mayorista' : 'Lista de precios', grupos, conStock: false, nota: 'Precios en pesos argentinos, sujetos a cambio sin previo aviso.' }));
});
