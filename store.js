// Tienda pública: catálogo, modo minorista/mayorista/híbrido, carrito, pedido y ticket por WhatsApp.
import { api } from './api.js';
import { $, esc, fmt, on, toast, copiar, normWsp, waLink, soloDigitos, store, debounce } from './util.js';
import { htmlCatalogo, imprimir, htmlPresupuesto } from './catalogo.js';
import { MARCA } from './marca.js';
import { origenDe } from './origen.js';
import { abrirFlyer } from './flyer.js';
import { promoOk, promoTxt, promoDesc, promoPartes, promoFalta, promosDelPedido, montoDesc, montoEscalon, montoTxt, cuponDesc, cuponTxt } from './promo.js';
import { tiraCierreHtml } from './cuenta.js';
import { rubroDe as rubroTienda, palabra, pareceTalle, losArt, conArt, ese } from './rubro.js';
import { anuncioHtml, heroHtml, beneficiosHtml, testimoniosHtml, popupHtml, firmaPopup, secOn, iniciarCarrusel, comprarCardHtml, comprarModalHtml, faqHtml, efectosOn, menosMovimiento, vitrinasCfg, vitrinaProds, catFotoCfg, catTilesHtml, rubrosCfg, claveCat, rubroDe, rubrosHtml, rubroCabHtml, lookDe } from './bloques.js';

const S = { ref: null, slug: '', tienda: null, prods: [], cart: [], may: null, codigo: '', cat: 'Todas', q: '', limite: 60, sel: {}, vista: 'cat', pay: 'transferencia', env: null, pedirCodigo: false, enviando: false, ultimo: null, fly: [], rubro: null, foco: null, niveles: null, orden: 'dest', ct: {} };
// Vista previa (v2.26): la tienda dentro del panel del comercio. No guarda carrito, no cuenta visitas y no manda pedidos;
// el panel le pasa lo que se está editando y le pide ir a una pantalla o resaltar una parte.
const PREVIA = (() => { try { return new URLSearchParams(location.search).get('vista') === 'previa' && window.parent !== window; } catch (e) { return false; } })();
const pagoUi = k => (k === 'link' && S.tienda.mp_activo ? ['💳', 'Mercado Pago', 'Tarjeta, débito o dinero en cuenta · pagás online ahora'] : PAGO[k]);
// medios de pago que la tienda tiene prendidos (panel: Tienda → Envíos y entregas → Medios de pago); si la base es vieja, los tres
const pagos = () => { const a = S.tienda && Array.isArray(S.tienda.pagos_activos) && S.tienda.pagos_activos.length ? S.tienda.pagos_activos : null; return Object.keys(PAGO).filter(k => !a || a.includes(k)); };
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
// Escalas acumulables (mismo criterio que el servidor): se cuentan por producto, sumando la misma categoría o todo el carrito.
// Los productos con precio único no suman ni restan.
const grupoModo = () => (S.tienda.escala_grupo === 'categoria' || S.tienda.escala_grupo === 'carrito' ? S.tienda.escala_grupo : 'producto');
const grupoDe = p => { const m = grupoModo(); return m === 'categoria' ? claveCat(S.tienda.diseno, p.categoria) : m === 'carrito' ? '*' : 'p:' + p.id; };
// nombre del grupo "por categoría": la categoría o, si su rubro suma junto, el rubro
const nombreCat = p => { const k = claveCat(S.tienda.diseno, p.categoria), r = k.startsWith('r:') ? rubroDe(S.tienda.diseno, k.slice(2)) : null; return r && r.titulo ? r.titulo : p.categoria || 'la categoría'; };
const qtyEsc = p => { if (!p) return 0; if (p.precio_unico) return qtyDe(p.id); const k = grupoDe(p); return S.cart.reduce((a, l) => { const o = prod(l.id); return o && !o.precio_unico && grupoDe(o) === k ? a + l.qty : a; }, 0); };
// " de Cuidado facial" / " (cualquier producto)" / "" para los mensajes
const grupoTxt = p => { const m = grupoModo(); return m === 'categoria' ? ' de ' + esc(nombreCat(p)) : m === 'carrito' ? ' de cualquier producto' : ''; };
// "Tu ganancia": lo que gana el cliente que revende (solo en lista mayorista y si la tienda lo activó)
const ganOn = () => !!S.tienda.reventa_activa && vista() === 'may';
const pvpDe = p => +p.pvp_sugerido > 0 ? +p.pvp_sugerido : Math.ceil(unidad(p, 1) * (1 + (+S.tienda.reventa_margen || 0.6)) / 10) * 10;
function ganHtml(p) {
  if (!ganOn()) return '';
  const u = unidad(p, Math.max(1, qtyEsc(p))), pv = pvpDe(p), g = pv - u; if (!(g > 0)) return '';
  return `<div class="gan"><span>🏷️ Vendelo a <b>${fmt(pv)}</b></span><span class="gan-g">💰 Ganás <b>${fmt(g)}</b> c/u · ${Math.round(g / u * 100)}%</span></div>`;
}
function ganCarrito() {
  if (!ganOn()) return '';
  const L = lineas(), inv = L.reduce((a, l) => a + l.sub, 0), fac = L.reduce((a, l) => a + pvpDe(l.p) * l.qty, 0), g = fac - inv; if (!(g > 0) || !inv) return '';
  return `<div class="gan gan-tot"><div class="srow"><span>Vendiendo todo al precio sugerido</span><span class="v">${fmt(fac)}</span></div><div class="srow tot"><span>💰 Tu ganancia estimada</span><span class="v">+${fmt(g)} · ${Math.round(g / inv * 100)}%</span></div></div>`;
}
function lineas() {
  return S.cart.map((l, i) => { const p = prod(l.id); if (!p) return null; const q = qtyEsc(p); const pu = unidad(p, q); return { i, p, vr: l.vr, qty: l.qty, pu, sub: pu * l.qty, base: +p.precio_1 * l.qty }; }).filter(Boolean);
}
// promo por cantidad (v2.25): solo al público (en la lista mayorista mandan las escalas). Se cuentan todas las unidades del producto.
const promoAplica = p => !!p && vista() === 'min' && promoOk(p.promo);
function promosCarrito() {
  const q = new Map(); S.cart.forEach(l => { const p = prod(l.id); if (promoAplica(p)) q.set(p.id, (q.get(p.id) || 0) + l.qty); });
  return [...q].map(([id, n]) => { const p = prod(id); return { p, q: n, d: promoDesc(p.promo, unidad(p, n), n), falta: promoFalta(p.promo, n) }; });
}
function totales() {
  const L = lineas(), PR = promosCarrito(), promo = PR.reduce((a, x) => a + x.d, 0), total = L.reduce((a, l) => a + l.sub, 0) - promo;
  // descuento general (v2.26): el cupón o el descuento por monto, el que más le conviene al cliente (igual que el pedido)
  const dmx = vista() === 'min' ? montoDesc(S.tienda.desc_monto, total) : 0, c = S.cupon && S.cupon.ok ? S.cupon : null;
  const conDesc = new Set(PR.filter(x => x.d > 0).map(x => x.p.id)), falta = c && total < +c.minimo ? +c.minimo - total : 0;
  const base = c && c.tipo !== 'envio' ? L.filter(l => !l.p.con_desc && !conDesc.has(l.p.id)).reduce((a, l) => a + l.sub, 0) : 0;
  const dcx = c && !falta ? cuponDesc(c, base) : 0, gana = dcx > 0 && dcx > dmx, dc = gana ? dcx : 0, dm = gana ? 0 : dmx;
  return { n: L.reduce((a, l) => a + l.qty, 0), total, ahorro: L.reduce((a, l) => a + (l.base - l.sub), 0), promo, PR, dm, dc, final: total - dc - dm,
    cupon: c, cuponFalta: falta, cuponSinBase: !!c && c.tipo !== 'envio' && !falta && base <= 0, cuponPierde: dcx > 0 && !gana, envioCupon: !!c && c.tipo === 'envio' && !falta };
}
const envios = () => Array.isArray(S.tienda.envios) ? S.tienda.envios : [];
const envioSel = () => envios().find(e => e.id === S.env) || null;
// mismo criterio que el servidor (el servidor recalcula y es el que cobra)
const costoEnvio = (e, total) => !e ? 0 : S.cupon && S.cupon.ok && S.cupon.tipo === 'envio' && !(totales().cuponFalta > 0) ? 0 : e.tipo !== 'retiro' && +S.tienda.envio_gratis_desde > 0 && total >= +S.tienda.envio_gratis_desde ? 0 : +e.costo || 0;
const ENV_ICO = { retiro: '🏪', envio: '🚚', moto: '🛵', correo: '📮', acordar: '💬' };
const minimo = () => (vista() === 'may' ? +S.tienda.compra_minima || 0 : 0);
function pista() {
  if (vista() !== 'may' || !S.tienda.escalas_activas) return null;
  let mejor = null; const visto = {};
  S.cart.forEach(l => {
    const p = prod(l.id); const t = p && tramos(p); if (!t || t.unico) return;
    const k = grupoDe(p); if (visto[k]) return; visto[k] = 1;
    const q = qtyEsc(p), nx = [3, 6, 12].find(x => x > q); if (!nx) return;
    // lo que baja todo lo que ya está en el grupo + las unidades que faltan (tomando este producto de referencia)
    let ahorro = 0;
    S.cart.forEach(m => { const o = prod(m.id), to = o && tramos(o); if (to && !to.unico && grupoDe(o) === k) ahorro += Math.max(0, unidad(o, q) - to[nx]) * m.qty; });
    if (!(ahorro > 0)) return;
    const falta = nx - q; ahorro += falta * Math.max(0, unidad(p, q) - t[nx]);
    const m = grupoModo(), de = m === 'categoria' ? 'de ' + nombreCat(p) : m === 'carrito' ? 'de cualquier producto' : 'de ' + p.nombre;
    if (!mejor || falta < mejor.falta) mejor = { falta, nombre: p.nombre, de, ahorro, q, nx };
  });
  return mejor;
}
// v2.31: en la demo el carrito va aparte (no se mezcla con una compra real en la misma tienda)
const claveCart = slug => (S.demo ? 'cart:demo:' : 'cart:') + slug;
const guardarCarrito = () => { if (!S.previa) store.set(claveCart(S.slug), S.cart); };

/* ---------- barra de escalas: cuánto falta para el próximo precio y cuánto se ahorra ---------- */
// q = unidades que cuentan para la escala (las del producto o, si la tienda lo eligió, las de su categoría o todo el carrito)
function escala(p) {
  const t = tramos(p); if (!t || t.unico || !S.tienda.escalas_activas || !(t[12] < t[1])) return null;
  const q = qtyEsc(p), nx = [3, 6, 12].find(x => x > q) || null, pu = unidad(p, Math.max(1, q));
  const pos = q >= 12 ? 100 : q >= 6 ? 66.6 + (q - 6) / 6 * 33.4 : q >= 3 ? 33.3 + (q - 3) / 3 * 33.3 : q / 3 * 33.3;
  // ahorro de todo lo que suma en el grupo frente al precio x1
  const k = grupoDe(p); let ahorro = 0;
  S.cart.forEach(l => { const o = prod(l.id), to = o && tramos(o); if (to && !to.unico && grupoDe(o) === k) ahorro += Math.max(0, to[1] - unidad(o, q)) * l.qty; });
  return { t, q, nx, falta: nx ? nx - q : 0, pu, pn: nx ? t[nx] : pu, ahorro, nivel: q >= 12 ? 3 : q >= 6 ? 2 : q >= 3 ? 1 : 0, pos: Math.round(pos) };
}
function escalaHtml(p, compacta) {
  const e = escala(p); if (!e || (compacta && !e.q)) return '';
  const q = e.q, u = e.falta === 1 ? '1 unidad' : e.falta + ' unidades', gr = grupoTxt(p), m = grupoModo();
  const msg = !e.nx ? `🎉 ¡Mejor precio desbloqueado${m === 'producto' ? '' : gr}!${e.ahorro > 0 ? ` Ahorrás <b>${fmt(e.ahorro)}</b>` : ''}`
    : !q ? `Llevando ${e.nx} pagás <b>${fmt(e.pn)}</b> c/u${m === 'categoria' ? ` · <small>podés combinar productos${gr}</small>` : m === 'carrito' ? ' · <small>podés combinar cualquier producto</small>' : ''}`
    : `Te ${e.falta === 1 ? 'falta' : 'faltan'} <b>${u}</b>${gr} para el precio x${e.nx}${e.nx === 12 ? '+' : ''} · ${fmt(e.pn)} c/u${e.ahorro > 0 ? ` · ya ahorrás <b>${fmt(e.ahorro)}</b>` : ''}`;
  return `<div class="esc-bar lvl${e.nivel}" data-falta="${e.falta}" role="status"><div class="esc-msg">${msg}</div><div class="esc-track" aria-hidden="true"><i style="width:${e.pos}%"></i>${[3, 6, 12].map((n, i) => `<span class="${q >= n ? 'ok' : ''}" style="left:${[33.3, 66.6, 100][i]}%">x${n}</span>`).join('')}</div></div>`;
}
// aclaración en la ficha cuando las escalas se suman entre productos
const escNota = p => { const t = tramos(p), m = grupoModo(); if (!t || t.unico || m === 'producto') return ''; return `<div class="flat-note">x3 · x6 · x12 ${m === 'categoria' ? 'sumando todos los productos' + grupoTxt(p) : 'sumando todo lo que lleves en el carrito'}</div>`; };
// "Tu ganancia estimada de reventa" para lo que lleva de un producto
function ganQty(p) {
  const q = qtyDe(p.id); if (!ganOn() || !q) return '';
  const g = (pvpDe(p) - unidad(p, qtyEsc(p))) * q; return g > 0 ? `<div class="gan-badge">💰 Tu ganancia estimada de reventa: <b>+${fmt(g)}</b></div>` : '';
}

/* ---------- cierre de pedidos (lo configura el comercio; el servidor es el que manda) ---------- */
const cierre = () => { const c = S.tienda.cierre_at ? new Date(S.tienda.cierre_at).getTime() : 0; return c ? { at: c, cerrado: Date.now() >= c, pausa: S.tienda.cierre_modo === 'pausar', texto: String(S.tienda.cierre_texto || '').trim() } : null; };
const pausado = () => { const c = cierre(); return !!(c && c.cerrado && c.pausa); };
const d2 = n => String(n).padStart(2, '0');
export function faltaTxt(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d > 0 ? `${d2(d)}d ${d2(h)}h ${d2(m)}m` : `${d2(h)}h ${d2(m)}m ${d2(s % 60)}s`;
}
// la tira con el reloj (días · horas · min · seg, corre cada segundo) vive en cuenta.js
function cierreHtml() {
  const c = cierre(); if (!c) return '';
  return tiraCierreHtml({ at: c.at, estado: !c.cerrado ? 'abierto' : c.pausa ? 'pausa' : 'tanda', texto: c.texto });
}
// al llegar a cero: se cambia la tira y se repinta (en pausa el carrito ya no deja continuar)
document.addEventListener('cuenta-fin', e => {
  if (!S.tienda || !e.target.closest('#st-cierre')) return;
  if (S.vista === 'co') { const t = document.getElementById('st-cierre'); if (t) t.outerHTML = cierreHtml(); repintarCo(); } else pintar();
});

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
  const pref = lookDe(t.diseno).modo ? temaPref() : null;      // lo que eligió el cliente con ☀️/🌙 manda sobre el tema de la tienda
  if (pref) root.setAttribute('data-theme', pref); else if (t.tema === 'oscuro') root.setAttribute('data-theme', 'dark'); else if (t.tema === 'claro') root.setAttribute('data-theme', 'light'); else root.removeAttribute('data-theme');
  return `--ac:${c};--ac2:${ac2};--acs:color-mix(in srgb, ${c} 14%, transparent);--on-ac:${lum > 0.62 ? '#0A0F1F' : '#FFFFFF'}`;
}

/* ---------- modo claro / oscuro que elige el cliente (se recuerda en su navegador, por tienda) ---------- */
const temaPref = () => { const v = store.get('tema:' + S.slug, null); return v === 'dark' || v === 'light' ? v : null; };
const oscuro = () => { const a = document.documentElement.getAttribute('data-theme'); if (a) return a === 'dark'; try { return matchMedia('(prefers-color-scheme: dark)').matches; } catch (e) { return false; } };
const temaBtn = () => `<button type="button" class="hdr-pill tema-btn" data-act="st-tema" aria-label="${oscuro() ? 'Pasar a modo claro' : 'Pasar a modo oscuro'}" title="${oscuro() ? 'Modo claro' : 'Modo oscuro'}">${oscuro() ? '☀️' : '🌙'}</button>`;
on('st-tema', () => {
  const nuevo = oscuro() ? 'light' : 'dark'; store.set('tema:' + S.slug, nuevo); document.documentElement.setAttribute('data-theme', nuevo);
  document.querySelectorAll('[data-act=st-tema]').forEach(b => { b.outerHTML = temaBtn(); });
});

/* ---------- Meta Pixel (solo si el plan lo incluye y el comercio cargó su ID) ---------- */
function cargarPixel(id) {
  if (!id || window.fbq || !/^\d{5,20}$/.test(id)) return;
  const n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
  n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
  const s = document.createElement('script'); s.async = true; s.src = 'https://connect.facebook.net/en_US/fbevents.js'; document.head.appendChild(s);
  window.fbq('init', id); window.fbq('track', 'PageView');
}
/* ---------- Google Analytics 4 (v2.33: desde Mayorista Pro, si el comercio cargó su ID G-…; nunca en la vista previa ni en la demo) ---------- */
function cargarGa4(id) {
  if (!id || window.gtag || !/^G-[A-Z0-9]{6,16}$/.test(id)) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date()); window.gtag('config', id);
  const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id); document.head.appendChild(s);
}
const GA4 = { ViewContent: 'view_item', AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout', Purchase: 'purchase' };
const ga4Datos = (n, d) => {
  const o = { currency: 'ARS' };
  if (d.value != null) o.value = Number(d.value) || 0;
  if (d.content_name) o.items = [{ item_id: (d.content_ids || [])[0] || d.content_name, item_name: d.content_name }];
  if (d.transaction_id) o.transaction_id = String(d.transaction_id);
  return o;
};
// Etapas de la visita para las estadísticas del panel (v2.33)
const ETAPA = { ViewContent: 'vio', AddToCart: 'carrito', Purchase: 'pedido' };
const evento = (n, d = {}) => {
  if (S.previa || S.demo) return;
  if (ETAPA[n]) etapa(ETAPA[n]);
  const fb = Object.assign({}, d); delete fb.transaction_id;
  try { if (window.fbq) window.fbq('track', n, fb); } catch (e) { }
  try { if (window.gtag && GA4[n]) window.gtag('event', GA4[n], ga4Datos(n, d)); } catch (e) { }
};

/* ---------- Estadísticas anónimas (v2.33): cada navegador cuenta 1 vez por día y por etapa: entró → miró → carrito → pedido ----------
   Se guarda solo de dónde llegó (Instagram, WhatsApp, Google…); nada de la persona. Ni la vista previa ni la demo cuentan. */
const ETAPAS = ['visita', 'vio', 'carrito', 'pedido'];
const esDueno = () => { try { return document.cookie.split(/;\s*/).includes('esk_dueno=' + encodeURIComponent(S.slug)); } catch (e) { return false; } };
function etapa(e) {
  if (!S.slug || S.previa || S.demo || esDueno()) return;
  const i = ETAPAS.indexOf(e); if (i < 0) return;
  const hoy = new Date().toLocaleDateString('sv'), k = 'vis:' + S.slug;
  let m = store.get(k, null);
  if (!m || m.d !== hoy || !Array.isArray(m.e)) m = { d: hoy, o: origenDe(location.href, document.referrer, navigator.userAgent, location.host), e: [] };
  const nuevas = ETAPAS.slice(0, i + 1).filter(x => !m.e.includes(x)); if (!nuevas.length) return;
  m.e = m.e.concat(nuevas); store.set(k, m);
  api.visita(S.slug, m.o, nuevas).catch(() => { });
}
const verProd = id => { marcarAct('v', id); const p = prod(id); if (p) evento('ViewContent', { content_name: p.nombre, content_ids: [p.id] }); };

/* ---------- entrada ---------- */
export async function mostrarTienda(slug, app) {
  app.innerHTML = '<div class="page center" style="padding-top:80px"><span class="spin"></span></div>';
  S.slug = slug;
  try {
    S.tienda = await api.tienda(slug);
    if (!S.tienda) { app.innerHTML = '<div class="page center"><h2>Esta tienda no existe o está pausada</h2><p class="muted" style="margin:10px 0 18px">Revisá el enlace que te pasaron.</p><a class="btn btn-p btn-sm" href="/">Ir al inicio</a></div>'; return; }
    S.prods = await api.productos(slug);
    // carruseles "Nuevos ingresos" / "Más vendidos": el orden lo da el servidor (si la base todavía no lo tiene, quedan automáticos)
    const modos = [...new Set(vitrinasCfg(S.tienda.diseno).map(v => v.modo).filter(m => m === 'nuevos' || m === 'vendidos'))];
    S.vitSrv = {}; await Promise.all(modos.map(async m => { try { S.vitSrv[m] = await api.vitrinaIds(slug, m); } catch (e) { S.vitSrv[m] = null; } }));
  } catch (e) { app.innerHTML = '<div class="page"><div class="err-box">' + esc(e.message) + '</div></div>'; return; }
  S.previa = PREVIA;
  // v2.31 · …?demo: la tienda real prestada como demo (con permiso de la dueña). El pedido no se manda ni se guarda.
  S.demo = false;
  try { if (!PREVIA && new URLSearchParams(location.search).has('demo')) S.demo = await api.tiendaDemo(slug); } catch (e) { S.demo = false; }
  S.cart = S.previa ? [] : (store.get(claveCart(slug), []) || []).filter(l => l && prod(l.id));
  // v2.29: vista elegida (tarjetas o pedido rápido), aviso de pedido sin terminar y el último pedido de este celular
  S.vmodo = store.get('vm:' + slug, 'tarj') === 'tabla' ? 'tabla' : 'tarj'; S.avisoCart = !S.previa && S.cart.length > 0; S.ultOculto = false;
  S.ult = S.previa || S.demo ? null : store.get('ult:' + slug, null);
  try { const cp = new URLSearchParams(location.search).get('cupon'); if (cp && /^[A-Za-z0-9_-]{3,20}$/.test(cp)) S.cuponPend = cp.toUpperCase(); } catch (e) { }
  try { const pg = new URLSearchParams(location.search).get('pago'); S.avisoPago = ({ ok: '✅ ¡Gracias! Estamos confirmando tu pago con Mercado Pago. El comercio te avisa por WhatsApp.', pendiente: '⏳ Tu pago quedó pendiente. Cuando se acredite, el comercio lo confirma.', error: 'El pago no se completó. Podés volver a intentar o coordinar por WhatsApp.' })[pg] || ''; } catch (e) { S.avisoPago = ''; }
  try { const r = new URLSearchParams(location.search).get('r'); if (r && /^[A-Za-z0-9_-]{8,64}$/.test(r)) store.set('ref:' + slug, { r, ts: Date.now() }); const g = store.get('ref:' + slug, null); S.ref = g && g.r && Date.now() - g.ts < 30 * 864e5 ? g.r : null; } catch (e) { S.ref = null; }   // la atribución al revendedor vence a los 30 días
  S.may = null; S.codigo = ''; S.vista = 'cat'; S.cat = 'Todas'; S.q = ''; S.limite = 60; S.pedirCodigo = false; S.vit = null; S.rubro = null; S.foco = null; S.niveles = null; S.orden = 'dest';
  if (!S.previa && !S.demo) { cargarPixel(S.tienda.pixel_id); cargarGa4(S.tienda.ga4_id); etapa('visita'); }
  if (S.demo && S.tienda.modalidad === 'hibrido') { try { const lista = await api.listaMayoristaDemo(slug); S.may = new Map(lista.map(r => [r.producto_id, r])); } catch (e) { } }
  document.title = S.tienda.nombre;
  // v2.30: …/t/tienda?presupuesto=… abre el presupuesto que te mandaron (sin costos; se puede aceptar y bajar en PDF)
  S.presu = null; S.presuTok = null;
  try { const pt = new URLSearchParams(location.search).get('presupuesto'); if (pt && /^[a-f0-9]{32,80}$/.test(pt) && !S.previa) { S.presuTok = pt; S.vista = 'presu'; try { S.presu = await api.verPresupuesto(pt); } catch (e) { S.presu = null; } } } catch (e) { }
  pintar();
  if (S.previa) { if (S.prevMsg) aplicarPrevia(S.prevMsg); try { window.parent.postMessage({ t: 'eskalapp-previa-lista' }, location.origin); } catch (e) { } }
}
/* ---------- vista previa dentro del panel ---------- */
const FOCO = { anuncios: '.st-anuncio', banners: '.st-heros', rubros: '#rubros', vitrinas: 'section.vt', catfoto: '#cats', categorias: '#cats', efectos: '#pgrid', productos: '#pgrid',
  beneficios: '.st-benef', comprar: '.st-howto', faq: '.st-faq', testimonios: '.st-testi', estilo: '#hdr', cierre: '#st-cierre', envios: '#store-banner' };
function irPrevia(v) {
  S.det = null; const pd = $('#pdet-root'); if (pd) pd.innerHTML = '';
  const disp = S.prods.filter(p => !p.agotado), muestra = disp.find(p => promoAplica(p)) || disp[0] || S.prods[0];
  if (v === 'inicio' || v === 'categoria') {
    S.vista = 'cat'; S.rubro = null; S.cat = 'Todas';
    if (v === 'categoria') { const c = [...new Set(disp.map(p => p.categoria))]; S.cat = c.includes(muestra && muestra.categoria) ? muestra.categoria : c[0] || 'Todas'; }
    pintar(); if (v === 'categoria') { const e = $('#search-row'); if (e) e.scrollIntoView(); } else window.scrollTo(0, 0); return;
  }
  if (v === 'producto') { S.vista = 'cat'; pintar(); if (muestra) { S.det = muestra.id; pintarDet(); } return; }
  if (!S.cart.length && muestra) S.cart.push({ id: muestra.id, vr: (muestra.variantes || [])[selVar(muestra)] || '', qty: promoAplica(muestra) ? Math.max(2, +muestra.promo.desde || 2) : 1 });
  S.vista = v === 'checkout' && S.cart.length ? 'co' : S.cart.length ? 'cart' : 'cat'; pintar(); window.scrollTo(0, 0);
}
function focoPrevia(k, otra) {
  if (k === 'popup') { S.popForzar = true; const r = $('#pop-root'); if (r) r.innerHTML = ''; pintarPopup(); return; }
  if (S.vista !== 'cat' || S.det) irPrevia('inicio');
  const el = document.querySelector(FOCO[k] || '#__nada'); if (!el) { if (!otra) setTimeout(() => focoPrevia(k, true), 450); return; }   // puede llegar justo antes que el cambio que la crea
  el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('prev-foco'); void el.offsetWidth; el.classList.add('prev-foco');
  setTimeout(() => el.classList.remove('prev-foco'), 1900);
}
async function aplicarPrevia(m) {
  if (m.recargar) { try { const t = await api.tienda(S.slug); if (t) S.tienda = Object.assign(t, S.borrador || {}); S.prods = await api.productos(S.slug); S.cart = S.cart.filter(l => prod(l.id)); } catch (e) { } }
  if (m.tienda) { S.borrador = m.tienda; Object.assign(S.tienda, m.tienda); }
  if (m.ir) irPrevia(m.ir);
  else if (m.tienda || m.recargar) { pintar(); if (S.det) pintarDet(); }
  if (m.foco) setTimeout(() => focoPrevia(m.foco), 80);
}
if (PREVIA) window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== window.parent) return;
  const m = e.data; if (!m || m.t !== 'eskalapp-previa') return;
  if (!S.tienda) { S.prevMsg = Object.assign(S.prevMsg || {}, m); return; }   // todavía cargando: se aplica al terminar
  aplicarPrevia(m);
});

/* ---------- pantallas ---------- */
function pintar() {
  const app = $('#root'), m = vista(), T = totales();
  const st = marca(), L = lookDe(S.tienda.diseno), c = L.compacto && S.vista === 'cat';
  app.innerHTML = `<div id="app" data-m="${m}" class="${fxOn() ? 'fx' : ''}${L.compacto ? ' compacto' : ''}" style="${st}">
    <div id="hdr"${L.compacto ? ' class="hdr-c"' : ''}><div class="hdr-store" style="display:flex;gap:8px;align-items:center;font-weight:800;color:var(--t1);font-size:.95rem">${S.tienda.logo_url ? `<img src="${esc(S.tienda.logo_url)}" alt="" style="height:28px;border-radius:6px">` : ''}${L.compacto ? `<span class="hdr-nm">${esc(S.tienda.nombre)}${S.tienda.eslogan ? `<small>${esc(S.tienda.eslogan)}</small>` : ''}</span>` : esc(S.tienda.nombre)}</div>
      <div class="hdr-acc">${L.modo ? temaBtn() : ''}${c && secOn(S.tienda.diseno, 'comprar') ? '<button type="button" class="hdr-pill" data-act="st-comprar">📖<span> Cómo comprar</span></button>' : ''}${c ? '<button type="button" class="hdr-pill" data-act="st-pdf">📄<span> Lista PDF</span></button>' : ''}<button id="cart-fab" data-act="st-ir" data-v="cart" aria-label="Carrito">${fabHtml(T)}</button></div></div>
    ${demoBarra()}${cierreHtml()}${anuncioHtml(S.tienda.diseno)}<div id="content">${S.vista === 'cat' ? pantallaCat() : S.vista === 'presu' ? pantallaPresu() : S.vista === 'cart' ? pantallaCarrito() : S.vista === 'co' ? pantallaCheckout() : pantallaOk()}</div>${firmaGratis()}</div>`;
  if (S.vista === 'cat') { pintarGrid(); pintarBarra(); pintarFlybar(); pintarPopup(); iniciarCarrusel(app); iniciarVitrina(); }
}

// v2.33: plan Gratis: firma discreta al pie (en los planes pagos, sin marca).
const firmaGratis = () => S.tienda.plan_gratis ? `<p class="st-firma"><a href="${esc((MARCA.DOMINIO ? 'https://' + MARCA.DOMINIO : location.origin) + '/?ref=firma')}" target="_blank" rel="noopener">Creado gratis con ${esc(MARCA.NOMBRE)}</a></p>` : '';
const fabHtml = T => (lookDe(S.tienda.diseno).compacto ? '🛒<span class="fab-tx"> Mi pedido</span>' : '🛒') + (T.n ? `<span id="cart-n">${T.n}</span>` : '');

/* ---------- ofertas y combos (los precios ya vienen con el descuento desde la base) ---------- */
const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function hastaTxt(iso) {
  const d = new Date(iso); if (!iso || isNaN(d)) return ''; const h = new Date(), m = new Date(h.getFullYear(), h.getMonth(), h.getDate() + 1);
  const ig = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  return ig(d, h) ? 'termina hoy' : ig(d, m) ? 'termina mañana' : `hasta el ${DIAS_C[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}
const ofPct = p => Math.round(Number(p.oferta_pct) || 0);
const comboTxt = p => Array.isArray(p.combo_items) && p.combo_items.length ? p.combo_items.map(c => `${+c.cant}× ${c.nombre}`).join(' · ') : '';
// precio tachado (lo que salía sin la oferta / comprando cada cosa por separado) y aclaraciones
const tachado = (p, ahora) => +p.precio_lista > +ahora ? ` <s class="was">${fmt(p.precio_lista)}</s>` : '';
function ofertaNota(p) {
  const o = ofPct(p), c = comboTxt(p);
  return `${o ? `<div class="of-nota">🏷️ Oferta -${o}% · ${esc(hastaTxt(p.oferta_hasta))}</div>` : ''}${promoAplica(p) ? `<div class="promo-chip">🎁 ${esc(promoTxt(p.promo))}</div>` : ''}${c ? `<div class="cb-inc">🧩 Incluye: ${esc(c)}</div>` : ''}`;
}
// recuadro de la ficha: "Comprá más, pagá menos"
function promoBox(p) {
  if (!promoAplica(p)) return '';
  const u = unidad(p, 1), pt = promoPartes(p.promo, u); if (!pt) return '';
  const q = qtyDe(p.id), d = promoDesc(p.promo, u, q), f = promoFalta(p.promo, q);
  return `<div class="promo-box"><div class="pb-h">🎁 Comprá más, pagá menos</div><div class="pb-r"><span class="pb-n">${pt[0]}</span><span class="pb-t">${esc(pt[1])}${pt[3] ? `<small>${esc(pt[3])}</small>` : ''}</span><b class="pb-v">${esc(pt[2])}</b></div>
    ${(p.variantes || []).length > 1 ? `<div class="pb-s">Podés combinar ${palP(p).w === 'talle' ? 'talles o colores' : palP(p).ws}: todos suman.</div>` : ''}${d > 0 ? `<div class="pb-ok">✓ Con lo que tenés en el carrito ahorrás ${fmt(d)}${f ? ` · sumá ${f} más y ahorrás todavía más` : ''}</div>` : q > 0 && f ? `<div class="pb-s">Tenés ${q} en el carrito: sumá ${f} más.</div>` : ''}</div>`;
}
/* ---------- combos con talles (v2.25): el cliente elige el talle de cada producto que trae ---------- */
const compsTalle = p => (Array.isArray(p.combo_items) ? p.combo_items : []).map(c => ({ c, q: c.id ? prod(c.id) : null })).filter(x => x.q && (x.q.variantes || []).length);
const pideTalles = p => !!p && compsTalle(p).length > 0;
const ctSel = p => (S.ct[p.id] = S.ct[p.id] || {});
function ctCompleto(p) { const s = ctSel(p); return compsTalle(p).every(({ c, q }) => { const a = s[q.id] || []; for (let k = 0; k < +c.cant; k++) if (a[k] == null) return false; return true; }); }
function ctDatos(p) {   // [{id, v, n}] y el texto "Zapa urbana 38, 40 · Sandalia 37" (igual que lo arma la base)
  const s = ctSel(p), out = [], txt = [];
  compsTalle(p).forEach(({ c, q }) => {
    const a = (s[q.id] || []).slice(0, +c.cant), n = new Map(); a.forEach(v => n.set(v, (n.get(v) || 0) + 1));
    const orden = [...n].sort((x, y) => q.variantes.indexOf(x[0]) - q.variantes.indexOf(y[0]));
    orden.forEach(([v, k]) => out.push({ id: q.id, v, n: k })); txt.push(q.nombre + ' ' + orden.map(([v, k]) => v + (k > 1 ? ' x' + k : '')).join(', '));
  });
  return { ct: out, vr: txt.join(' · ') };
}
function ctHtml(p) {
  const s = ctSel(p);
  return `<div class="flabel" style="margin-top:10px">Elegí ${losArt(talleSi(palabra(rubroT(), compsTalle(p).flatMap(x => x.q.variantes || []))))}</div><div class="ct-box">${compsTalle(p).map(({ c, q }) => Array.from({ length: +c.cant }, (_, k) => `<div class="ct-row"><span class="ct-n">${esc(q.nombre)}${+c.cant > 1 ? ` <small>(${k + 1} de ${+c.cant})</small>` : ''}</span><div class="vars">${q.variantes.map((v, i) => { const ag = varAgot(q, v), on_ = (s[q.id] || [])[k] === v; return `<button class="vchip${on_ ? ' on' : ''}${ag ? ' agot' : ''}" data-act="st-ct" data-id="${p.id}" data-c="${q.id}" data-k="${k}" data-i="${i}"${ag ? ` disabled aria-disabled="true" aria-label="${esc(v)} sin stock"` : ` aria-pressed="${on_}"`}>${esc(v)}</button>`; }).join('')}</div></div>`).join('')).join('')}</div>`;
}

/* ---------- visitas y "al carrito" por producto (para el panel del comercio) ----------
   Visita = abrió la ficha. Al carrito = lo agregó. Cada navegador cuenta 1 vez por producto y por día; se mandan juntas cada pocos segundos. */
const ACT = { v: new Set(), c: new Set(), t: null };
function marcarAct(tipo, id) {
  if (!id || !S.slug || S.previa || S.demo || esDueno()) return;
  const hoy = new Date().toLocaleDateString('sv'), k = 'act:' + S.slug;
  let m = store.get(k, null); if (!m || m.d !== hoy) m = { d: hoy, v: [], c: [] };
  if (m[tipo].includes(id)) return;
  m[tipo].push(id); if (m[tipo].length > 500) m[tipo] = m[tipo].slice(-500); store.set(k, m);
  ACT[tipo].add(id); clearTimeout(ACT.t); ACT.t = setTimeout(enviarAct, 4000);
}
function enviarAct() {
  clearTimeout(ACT.t); if (!ACT.v.size && !ACT.c.size) return;
  const v = [...ACT.v], c = [...ACT.c]; ACT.v.clear(); ACT.c.clear();
  api.actividad(S.slug, v, c).catch(() => { });
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') enviarAct(); });

/* ---------- efectos de movimiento (el comercio los prende o apaga en Tienda → Diseño) ---------- */
const fxOn = () => efectosOn(S.tienda.diseno) && !menosMovimiento();
// las tarjetas aparecen suaves la primera vez que entran en pantalla (no se repite al agregar al carrito)
let obsFx = null;
function revelar() {
  if (!fxOn() || typeof IntersectionObserver === 'undefined') return;
  S.vistos = S.vistos || new Set();
  if (!obsFx) obsFx = new IntersectionObserver(es => {
    es.filter(e => e.isIntersecting).forEach((e, i) => {
      const el = e.target; obsFx.unobserve(el); S.vistos.add(el.dataset.id);
      el.style.transitionDelay = Math.min(i, 5) * 60 + 'ms'; el.classList.remove('rv');
      setTimeout(() => { el.style.transitionDelay = ''; }, 900);
    });
  }, { rootMargin: '0px 0px -6% 0px' });
  obsFx.disconnect(); document.querySelectorAll('.pcard.rv').forEach(el => obsFx.observe(el));
}
// el carrito "salta" y un +1 sube desde el botón
function golpe(btn) {
  if (!fxOn()) return;
  ['#cart-fab', '#cartbar'].forEach(q => { const e = $(q); if (e) { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); } });
  if (btn && btn.getBoundingClientRect) {
    const r = btn.getBoundingClientRect(), m = document.createElement('span');
    m.className = 'fx-mas'; m.textContent = '+1'; m.setAttribute('aria-hidden', 'true');
    m.style.left = Math.round(r.left + r.width / 2) + 'px'; m.style.top = Math.round(r.top) + 'px';
    ($('#app') || document.body).appendChild(m); setTimeout(() => m.remove(), 800);   // dentro de #app: toma el color de la tienda
  }
}

/* ---------- carrusel de productos ("vitrina"): arriba del catálogo, pasa solo y se desliza ---------- */
function vtCard(p) {
  const t = tramos(p), q = qtyDe(p.id), escalas = t && !t.unico && S.tienda.escalas_activas;
  const precio = `<b>${fmt(t ? t[1] : p.precio_1)}${!t || vista() === 'min' || S.tienda.modalidad === 'mayorista' ? tachado(p, t ? t[1] : p.precio_1) : ''}</b>${escalas ? `<small>x12: ${fmt(t[12])} c/u</small>` : ''}`;
  return `<article class="vt-card${q ? ' in-cart' : ''}" data-id="${p.id}"><div class="vt-img${p.imagen_url ? ' con-img' : ''}" data-act="st-ver" data-id="${p.id}" role="button" tabindex="0" aria-label="Ver ${esc(p.nombre)}"${p.imagen_url ? ` style="${cssImg(p.imagen_url)}"` : ''}>${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="" loading="lazy">` : `<span class="vt-em">${esc(p.emoji)}</span>`}${ofPct(p) ? `<span class="badge badge-of">-${ofPct(p)}%</span>` : ''}${comboTxt(p) ? '<span class="badge badge-cat badge-cb">🧩 Combo</span>' : ''}<span class="vt-q"${q ? '' : ' hidden'}>${q} u</span></div>
    <div class="vt-tx"><div class="vt-n" data-act="st-ver" data-id="${p.id}">${esc(p.nombre)}</div><div class="vt-p">${precio}</div><button class="vt-add" data-act="st-add" data-id="${p.id}" aria-label="Agregar ${esc(p.nombre)}">+ Agregar</button></div></article>`;
}
function vitrinasHtml(pos) {
  const L = vitrinasCfg(S.tienda.diseno); if (!L.length) return '';
  if (!S.vit) S.vit = L.map(cfg => vitrinaProds(cfg, S.prods, Math.random, (S.vitSrv || {})[cfg.modo]).map(p => p.id));   // se eligen una vez por visita (no cambian al agregar)
  return L.map((cfg, i) => {
    if (cfg.pos !== pos) return '';
    const P_ = (S.vit[i] || []).map(prod).filter(p => p && !p.agotado); if (P_.length < 2) return '';
    return `<section class="vt" id="${i ? 'vitrina-' + i : 'vitrina'}" data-vi="${i}" aria-roledescription="carrusel" aria-label="${esc(cfg.titulo)}"><div class="vt-h"><h3>${esc(cfg.titulo)}</h3><div class="vt-nav"><button class="vt-b" data-act="vt-mov" data-d="-1" aria-label="Ver anteriores">‹</button><button class="vt-b" data-act="vt-mov" data-d="1" aria-label="Ver siguientes">›</button></div></div><div class="vt-track">${P_.map(vtCard).join('')}</div></section>`;
  }).join('');
}
let vtTimers = [];
function iniciarVitrina() {
  vtTimers.forEach(clearInterval); vtTimers = [];
  document.querySelectorAll('section.vt').forEach((sec, k) => {
    const tr = sec.querySelector('.vt-track'); if (!tr) return;
    const paso = () => { const c = tr.querySelector('.vt-card'); return c ? c.getBoundingClientRect().width + 12 : 180; };
    sec._mover = d => {
      const max = tr.scrollWidth - tr.clientWidth - 4;
      if (d > 0 && tr.scrollLeft >= max) tr.scrollTo({ left: 0, behavior: 'smooth' });
      else if (d < 0 && tr.scrollLeft <= 4) tr.scrollTo({ left: max, behavior: 'smooth' });
      else tr.scrollBy({ left: d * paso(), behavior: 'smooth' });
    };
    if (!fxOn() || tr.scrollWidth <= tr.clientWidth + 4) return;     // sin efectos (o si entra todo): se mueve solo a mano
    let encima = false, tocado = 0, visible = true;
    sec.addEventListener('mouseenter', () => { encima = true; }); sec.addEventListener('mouseleave', () => { encima = false; });
    ['pointerdown', 'touchstart', 'focusin', 'wheel'].forEach(ev => sec.addEventListener(ev, () => { tocado = Date.now(); }, { passive: true }));
    if (typeof IntersectionObserver !== 'undefined') new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(sec);
    // cada carrusel pasa a su ritmo (desfasados, para que no se muevan todos juntos)
    const t = setInterval(() => {
      if (!tr.isConnected) { clearInterval(t); return; }
      if (encima || document.hidden || !visible || Date.now() - tocado < 8000) return;   // se frena si la persona lo está usando
      sec._mover(1);
    }, 3500 + k * 700);
    vtTimers.push(t);
  });
}
on('vt-mov', (d, b) => { const sec = b.closest('section.vt'); if (sec && sec._mover) sec._mover(+d.d); });
function pintarPopup() {
  const d = S.tienda.diseno, k = 'pop:' + S.slug, f = firmaPopup(d), r = $('#pop-root');
  if (!r || !f) return;
  if (S.previa ? !S.popForzar : (S.popVisto || store.get(k, '') === f)) return;   // en la vista previa, solo cuando se edita la ventana
  const h = popupHtml(d); if (!h) return;
  r.innerHTML = h; S.popVisto = true; S.popForzar = false; if (!S.previa) store.set(k, f);
}
on('st-pop-cerrar', () => { const r = $('#pop-root'); if (r) r.innerHTML = ''; });
on('st-pop-bg', (d, b, e) => { if (e.target === b) { const r = $('#pop-root'); if (r) r.innerHTML = ''; } });
on('st-pop-copiar', d => copiar(d.v));
on('st-pop-usar', d => { S.cuponPend = String(d.v || '').toUpperCase(); S.cupon = null; const r = $('#pop-root'); if (r) r.innerHTML = ''; toast(`🎟️ Cupón ${S.cuponPend} listo: se aplica al confirmar tu pedido`); });
const cerrarComprar = () => { const r = $('#pop-root'); if (r) r.innerHTML = ''; };
on('st-comprar', () => { const r = $('#pop-root'); if (r) { r.innerHTML = comprarModalHtml(S.tienda.diseno, S.tienda); const b = r.querySelector('[data-act=st-comprar-cerrar]'); if (b) b.focus(); } });
on('st-comprar-cerrar', cerrarComprar);
on('st-comprar-bg', (d, b, e) => { if (e.target === b) cerrarComprar(); });
// botón de un banner de portada: a un rubro, a una categoría, a todo el catálogo o (sin destino) baja a los productos
on('st-hero', d => {
  const ir = String(d.ir || ''), rb = rubrosCfg(S.tienda.diseno, S.prods);
  if (ir.startsWith('r:') && rb && rb.lista.some(r => r.id === ir.slice(2))) return entrarRubro(ir.slice(2));
  if (ir === 'todo' && rb) return entrarRubro('*');
  if (ir.startsWith('c:') && S.prods.some(p => p.categoria === ir.slice(2))) {
    const c = ir.slice(2), r = rb && rb.lista.find(x => x.cats.includes(c));
    if (rb) return entrarRubro(r ? r.id : '*', c);
    S.cat = c; S.limite = 60; pintarGrid();
  }
  const e = $('#search-row'); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
// banners de rubro: entrar a uno (o a todo el catálogo con "*") y volver a la portada
function aRubros() {
  const e = $('#rubros'); if (!e) return;
  const tope = [...document.querySelectorAll('#hdr, #search-row')].filter(x => getComputedStyle(x).position === 'sticky').reduce((a, x) => a + x.offsetHeight, 0) + 6;
  window.scrollTo({ top: Math.max(0, e.getBoundingClientRect().top + window.scrollY - tope), behavior: menosMovimiento() ? 'auto' : 'smooth' });
}
function entrarRubro(id, cat) {
  const venia = S.rubro; S.rubro = id; S.cat = cat || 'Todas'; S.limite = 60;
  try { if (venia === null) history.pushState({ rb: id }, ''); else history.replaceState({ rb: id }, ''); } catch (e) { }   // el "atrás" del celular vuelve a la portada
  pintarGrid(); aRubros();
}
function volverRubros() { S.rubro = null; S.cat = 'Todas'; S.limite = 60; pintarGrid(); aRubros(); }
on('st-rubro', d => {
  if (d.r) return entrarRubro(d.r);
  if (history.state && history.state.rb) { try { history.back(); return; } catch (e) { } }
  volverRubros();
});
window.addEventListener('popstate', () => { if (S.tienda && S.vista === 'cat' && S.rubro !== null && $('#rubros')) volverRubros(); });
function banner() {
  const aviso = S.avisoPago ? `<div class="ok-box" role="status" style="margin:12px 16px">${esc(S.avisoPago)}</div>` : '';
  const t = S.tienda, m = vista();
  let chips = m === 'min' ? '<span class="chip">🛍️ Comprás desde 1 unidad · sin mínimo</span>'
    : `<span class="chip">📦 ${t.escalas_activas ? 'Precios por volumen x1 · x3 · x6 · x12' + (grupoModo() === 'categoria' ? ' · sumando la misma categoría' : grupoModo() === 'carrito' ? ' · sumando todo el carrito' : '') : 'Lista mayorista'}${minimo() ? ' · mínimo ' + fmt(minimo()) : ''}</span>`;
  if (t.modalidad === 'hibrido') chips += S.may ? '<button class="chip" data-act="may-salir">✓ Lista mayorista activa · Salir</button>' : '<button class="chip" data-act="may-abrir">💼 Acceso Mayorista</button>';
  const caja = S.pedirCodigo && !S.may ? `<form data-submit="may-codigo" id="gremio-box"><input class="fi" name="codigo" placeholder="Código de revendedor" autocomplete="off" aria-label="Código de revendedor" required><button class="btn btn-p btn-sm" type="submit">Activar</button></form><div class="ferr" id="may-err" hidden></div>` : '';
  if (t.modo_stock === 'encargo') chips += `<span class="chip">📦 Por encargo · llega en ${+t.demora_encargo || 7} días</span>`;
  if (m === 'min' && t.desc_monto && t.desc_monto.escalones) chips += `<span class="chip">🎁 ${esc(montoTxt(t.desc_monto).replace(/^s/, 'S'))}</span>`;
  if (S.cuponPend) chips += `<span class="chip">🎟️ Cupón ${esc(S.cuponPend)}: se aplica al confirmar</span>`;
  if (+t.envio_gratis_desde > 0 && envios().some(e => e.tipo !== 'retiro')) chips += `<span class="chip">🚚 Envío gratis desde ${fmt(t.envio_gratis_desde)}</span>`;
  chips += '<button class="chip" data-act="st-pdf">📄 Lista de precios (PDF)</button>';
  // encabezado compacto: el nombre va arriba y "Cómo comprar" y el PDF quedan como botones chicos
  if (lookDe(t.diseno).compacto) return aviso + heroHtml(t.diseno) + `<div id="store-banner" class="sb-c"><div class="banner-row">${chips.replace(/<button class="chip" data-act="st-pdf">[^<]*<\/button>/, '')}</div>${caja}</div>` + beneficiosHtml(t.diseno);
  return aviso + heroHtml(t.diseno) + `<div id="store-banner"><div class="banner-name">${esc(t.nombre)}</div><div class="banner-sub">${esc(t.eslogan || '')}</div><div class="banner-row">${chips}</div>${caja}</div>` + beneficiosHtml(t.diseno) + comprarCardHtml(t.diseno);
}
const ORDEN = [['dest', 'Destacados'], ['menor', 'Menor precio'], ['mayor', 'Mayor precio'], ['az', 'A – Z']];
function pantallaCat() {
  const c = lookDe(S.tienda.diseno).compacto, n = totales().n;
  return `${avisosCompra()}${banner()}${vitrinasHtml('arriba')}<div id="search-row"${c ? ' class="sr-c"' : ''}><div class="srch-wrap"><span class="srch-ico">🔍</span><input class="fi" id="srch" data-input="st-q" placeholder="Buscar producto…" value="${esc(S.q)}" aria-label="Buscar producto"></div>${c ? `<button type="button" class="sr-cart" data-act="st-ir" data-v="cart" aria-label="Mi pedido">🛒<span id="sr-n">${n || ''}</span></button>` : ''}</div>
    ${c ? `<div class="catalog-meta" id="cmeta"><span id="cm-n"></span><label class="cm-ord">Ordenar <select class="fi" data-change="st-orden" aria-label="Ordenar productos">${ORDEN.map(([k, t]) => `<option value="${k}" ${S.orden === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>` : ''}
    <div id="rubros"></div><div id="cats"></div><div id="vmodo"></div><div id="pgrid"></div><div id="mas"></div>${vitrinasHtml('abajo')}${testimoniosHtml(S.tienda.diseno)}${faqHtml(S.tienda.diseno)}<div id="pdet-root"></div><div id="pop-root"></div><div class="cart-fixed"><div id="flybar" hidden></div><div id="cartbar" hidden></div></div><div class="cart-esp"></div>`;
}
on('st-orden', (d, el) => { S.orden = ORDEN.some(o => o[0] === el.value) ? el.value : 'dest'; S.limite = 60; pintarGrid(); });
// encabezado compacto: la fila del buscador se esconde al bajar y vuelve apenas se sube
let ultY = 0;
window.addEventListener('scroll', () => {
  const sr = document.querySelector('#search-row.sr-c'); if (!sr) return;
  const y = window.scrollY, abajo = y > ultY + 6, arriba = y < ultY - 4;
  if (y > 200 && abajo && document.activeElement !== $('#srch')) sr.classList.add('oculta'); else if (arriba || y <= 200) sr.classList.remove('oculta');
  if (abajo || arriba) ultY = y;
}, { passive: true });
function pintarGrid() {
  const d = S.tienda.diseno, L = lookDe(d), q = S.q.toLowerCase().trim();
  // banners de rubro: portada ("Seleccioná la categoría"), adentro de un rubro o "todo el catálogo"
  const rb = rubrosCfg(d, S.prods);
  if (!rb) S.rubro = null; else if (S.rubro && S.rubro !== '*' && !rb.lista.some(r => r.id === S.rubro)) S.rubro = null;
  const rAct = rb && S.rubro && S.rubro !== '*' ? rb.lista.find(r => r.id === S.rubro) : null;
  const portada = !!rb && S.rubro === null && !q;
  const rbe = $('#rubros');
  if (rbe) rbe.innerHTML = !rb ? '' : portada ? rubrosHtml(rb, S.prods, S.prods.length) : S.rubro !== null ? rubroCabHtml(rAct, S.prods, S.cat) : '';
  const cats = ['Todas', ...new Set(S.prods.map(p => p.categoria))];
  const cf = catFotoCfg(d), ce = $('#cats'), xs = ce.querySelector('.ct-track') ? ce.querySelector('.ct-track').scrollLeft : 0;
  ce.hidden = !secOn(d, 'categorias') || (!!rb && S.rubro !== '*'); ce.classList.toggle('ct', !!cf);
  ce.innerHTML = rb && S.rubro !== '*' ? '' : cf && cats.length > 2 ? catTilesHtml(cf, cats.slice(1), S.prods, S.cat)
    : cats.map(c => `<button class="pill ${c === S.cat ? 'on' : ''}" data-act="st-cat" data-c="${esc(c)}">${esc(c)}</button>`).join('');
  if (xs) { const tr = ce.querySelector('.ct-track'); if (tr) tr.scrollLeft = xs; }   // no vuelve al principio al elegir una
  const g = $('#pgrid'), cm = $('#cmeta');
  if (portada) { g.innerHTML = ''; $('#mas').innerHTML = ''; if (cm) cm.hidden = true; return; }
  const base = rAct ? S.prods.filter(p => rAct.cats.includes(p.categoria)) : S.prods;
  let lista = base.filter(p => (S.cat === 'Todas' || p.categoria === S.cat) && (!q || p.nombre.toLowerCase().includes(q) || (p.marca || '').toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)));
  // orden (encabezado compacto) y, en "Todo el rubro", agrupado por subcategoría con un separador
  const precioDe = p => { const t = tramos(p); return t ? t[1] : +p.precio_1; };
  const cmp = { menor: (a, b) => precioDe(a) - precioDe(b), mayor: (a, b) => precioDe(b) - precioDe(a), az: (a, b) => a.nombre.localeCompare(b.nombre, 'es') }[S.orden];
  const separar = rAct && S.cat === 'Todas' && rAct.cats.length > 1 && !q;
  if (cmp || separar) { const ix = p => separar ? rAct.cats.indexOf(p.categoria) : 0; lista = lista.map((p, i) => [p, i]).sort((a, b) => (ix(a[0]) - ix(b[0])) || (cmp ? cmp(a[0], b[0]) : 0) || a[1] - b[1]).map(x => x[0]); }
  if (cm) { cm.hidden = false; const n = $('#cm-n'); if (n) n.textContent = `Mostrando ${lista.length} ${lista.length === 1 ? 'producto' : 'productos'}`; }
  const m = vista(), esc_ = S.tienda.escalas_activas;
  // v2.29 · ⚡ Pedido rápido: en la lista mayorista, una fila por producto para cargar cantidades sin scrollear fotos
  const vmEl = $('#vmodo'), conTabla = m === 'may' && S.prods.length >= 6, tabla = conTabla && S.vmodo === 'tabla';
  if (vmEl) vmEl.innerHTML = conTabla ? `<div class="vm-sw" role="group" aria-label="Cómo ver los productos"><button type="button" data-act="st-vmodo" data-v="tarj" class="${tabla ? '' : 'on'}" aria-pressed="${!tabla}">🖼️ Tarjetas</button><button type="button" data-act="st-vmodo" data-v="tabla" class="${tabla ? 'on' : ''}" aria-pressed="${tabla}">⚡ Pedido rápido</button></div>` : '';
  g.classList.toggle('ptabla', tabla);
  if (tabla && lista.length) { g.innerHTML = `<div class="tr-cab" aria-hidden="true"><span>Producto</span><span>Precio</span><span>Cantidad</span></div>` + lista.slice(0, S.limite).map(filaTabla).join(''); $('#mas').innerHTML = lista.length > S.limite ? `<div class="more"><button class="btn btn-s" data-act="st-mas">Ver más (${lista.length - S.limite} restantes)</button></div>` : ''; return; }
  if (!lista.length) { g.innerHTML = `<div style="grid-column:1/-1" class="empty"><div class="ico">🔍</div><p>No encontramos productos${rAct ? ' en ' + esc(rAct.titulo) : ''}.</p>${rAct && q ? '<button class="btn btn-s btn-sm" style="margin-top:8px" data-act="st-rubro" data-r="*">Buscar en todo el catálogo</button>' : ''}</div>`; $('#mas').innerHTML = ''; return; }
  const verCat = S.cat === 'Todas' && cats.length > 2 && !L.limpia && !separar;   // la etiqueta de categoría solo suma si hay varias
  let previa = null;
  g.innerHTML = lista.slice(0, S.limite).map(p => {
    const t = tramos(p), qty = qtyDe(p.id), qe = qtyEsc(p), vi = selVar(p), vars = p.variantes || [];
    const div = separar && p.categoria !== previa ? `<div class="pg-div"><b>${esc(p.categoria)}</b><span>${lista.filter(x => x.categoria === p.categoria).length} productos</span></div>` : ''; previa = p.categoria;
    const hl = n => qe > 0 && ((n === 12 && qe >= 12) || (n === 6 && qe >= 6 && qe < 12) || (n === 3 && qe >= 3 && qe < 6) || (n === 1 && qe < 3)) ? 'hl' : '';
    const usd = n => S.tienda.mostrar_usd && S.tienda.cotizacion_usd ? `<div class="flat-note">≈ USD ${(n / S.tienda.cotizacion_usd).toFixed(2).replace('.', ',')}</div>` : '';
    const limpio = L.limpia && m === 'may' && t && !t.unico && esc_ && t[12] < t[1];
    const hoy = limpio && qty && qe >= 3 && unidad(p, qe) < t[1];
    const precio = (limpio ? `${porUnidad(p)}<div class="price-clean"><div class="pc-l">Precio supermayorista</div><div class="pc-p">${fmt(t[12])} <small>c/u</small></div><div class="pc-q">llevando 12 o más</div><div class="pc-1">Precio por 1 unidad: ${fmt(t[1])}</div>${hoy ? `<div class="pc-hoy">✓ En tu pedido hoy: ${fmt(unidad(p, qe))} c/u</div>` : ''}</div>`
      : m === 'min' || !t ? `<div><span class="retail-price">${fmt(p.precio_1)}</span>${tachado(p, p.precio_1)}${porUnidad(p)}${usd(+p.precio_1)}</div>`
      : t.unico ? `<div><span class="retail-price">${fmt(t[1])}</span>${m === 'may' && S.tienda.modalidad === 'mayorista' ? tachado(p, t[1]) : ''}${porUnidad(p)}<div class="flat-note">precio mayorista único</div>${usd(t[1])}</div>`
      : esc_ ? `${porUnidad(p)}<div class="ptiers">${[1, 3, 6, 12].map(n => `<div class="ptier ${hl(n)}"><div class="ptier-q">x${n}${n === 12 ? '+' : ''}</div><div class="ptier-p">${fmt(t[n])}</div>${n > 1 && t[1] ? `<div class="ptier-s">-${Math.round((1 - t[n] / t[1]) * 100)}%</div>` : ''}</div>`).join('')}</div>`
      : `<div><span class="retail-price">${fmt(t[1])}</span>${porUnidad(p)}<div class="flat-note">precio mayorista</div>${usd(t[1])}</div>`) + ofertaNota(p);
    const enFly = S.fly.includes(p.id);
    const ctrl = p.agotado ? '<button class="qadd" disabled>Agotado</button>' : qty > 0
      ? `<button class="qbtn" data-act="st-dec" data-id="${p.id}" aria-label="Quitar uno">−</button><span class="qnum">${qty}</span>${L.limpia ? '<span class="q-en">en pedido</span>' : ''}<button class="qbtn" data-act="st-add" data-id="${p.id}" aria-label="Agregar uno">+</button>`
      : `<button class="qadd" data-act="st-add" data-id="${p.id}">${L.limpia ? '+ Agregar al pedido' : '+ Agregar'}</button>`;
    const rv = fxOn() && typeof IntersectionObserver !== 'undefined' && !(S.vistos && S.vistos.has(p.id)) ? ' rv' : '';
    const flyIco = flyOn() && L.limpia ? `<button type="button" class="fly-ico${enFly ? ' on' : ''}" data-act="fly-sel" data-id="${p.id}" aria-pressed="${enFly}" aria-label="${enFly ? 'Quitar del flyer' : 'Elegir para un flyer para vender'}" title="Flyer para vender">${enFly ? '✓' : '📲'}</button>` : '';
    return `${div}<div class="pcard${qty ? ' in-cart' : ''}${rv}${L.limpia ? ' limpia' : ''}" data-id="${p.id}"><div class="pimg${p.imagen_url ? ' con-img' : ' noimg'}" data-act="st-ver" data-id="${p.id}" role="button" tabindex="0" aria-label="Ver ${esc(p.nombre)}" style="cursor:pointer;${p.imagen_url ? cssImg(p.imagen_url) : 'background:linear-gradient(145deg,var(--acs),transparent 70%),var(--bg2)'}">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}" loading="lazy">` : ''}${comboTxt(p) ? '<span class="badge badge-cat badge-cb">🧩 Combo</span>' : verCat ? `<span class="badge badge-cat">${esc(p.categoria)}</span>` : ''}${ofPct(p) ? `<span class="badge badge-of">-${ofPct(p)}%</span>` : ''}${qty ? `<span class="badge badge-qty">${qty} u</span>` : ''}${p.agotado ? '<span class="badge badge-out">Sin stock</span>' : p.a_pedido && S.tienda.modo_stock === 'mixto' ? `<span class="badge badge-enc">Por encargo · llega en ${+p.demora_dias} días</span>` : p.ultimas ? `<span class="badge badge-low">¡Últimas ${+p.ultimas}!</span>` : ''}${p.imagen_url ? '' : `<div class="pimg-emoji">${esc(p.emoji)}</div>`}${flyIco}</div>
      <div class="pbody"><div class="pname" data-act="st-ver" data-id="${p.id}">${esc(p.nombre)}</div>${vars.length ? `<div class="vars" role="group" aria-label="Variante">${chipsVar(p, vi)}</div>` : ''}${vars.length > 1 && !p.agotado ? `<button class="mx-link" data-act="st-ver" data-id="${p.id}" data-mx="1">▦ Cargar varias opciones a la vez</button>` : ''}${precio}${gamiOn() ? '' : escalaHtml(p, true)}${ganHtml(p)}<div class="pqty">${ctrl}</div>${flyOn() && !L.limpia ? `<button class="fly-btn${enFly ? ' on' : ''}" data-act="fly-sel" data-id="${p.id}" aria-pressed="${enFly}">${enFly ? '✓ En tu flyer' : '📸 Crear Flyer para Vender'}</button>` : ''}</div></div>`;
  }).join('');
  $('#mas').innerHTML = lista.length > S.limite ? `<div class="more"><button class="btn btn-s" data-act="st-mas">Ver más (${lista.length - S.limite} restantes)</button></div>` : '';
  revelar();
}
// una fila del pedido rápido: mini foto, nombre y código, opción en línea, precio x12 (y x1 chico) y − [cantidad] +
function filaTabla(p) {
  const t = tramos(p), vars = p.variantes || [], vi = selVar(p), vr = vars[vi] || '', qv = vr ? qtyVar(p.id, vr) : qtyDe(p.id), tot = qtyDe(p.id);
  const escalas = S.tienda.escalas_activas && t && !t.unico && t[12] < t[1];
  const pr = escalas ? `<b>${fmt(t[12])}</b><small>c/u x12+ · x1 ${fmt(t[1])}</small>` : `<b>${fmt(t ? t[1] : p.precio_1)}</b><small>${t && t.unico ? 'precio único' : 'c/u'}</small>`;
  const img = p.imagen_url ? `<span class="tr-img" style="${cssImg(p.imagen_url)}"></span>` : `<span class="tr-img tr-em">${esc(p.emoji || '📦')}</span>`;
  const sel = vars.length ? `<select class="tr-var" data-change="st-tvar" data-id="${p.id}" aria-label="${esc(palP(p).w)} de ${esc(p.nombre)}">${vars.map((v, i) => `<option value="${i}" ${i === vi ? 'selected' : ''} ${varAgot(p, v) ? 'disabled' : ''}>${esc(v)}${varAgot(p, v) ? ' · sin stock' : ''}</option>`).join('')}</select>` : '';
  const q = p.agotado ? '<span class="tr-agot">Agotado</span>' : pideTalles(p) ? `<button type="button" class="btn btn-s btn-sm" data-act="st-ver" data-id="${p.id}">Elegir</button>`
    : `<div class="tr-q"><button type="button" class="qbtn" data-act="st-tq" data-id="${p.id}" data-d="-1" aria-label="Quitar uno de ${esc(p.nombre)}" ${qv ? '' : 'disabled'}>−</button><input class="tr-in" type="number" inputmode="numeric" min="0" max="9999" value="${qv || ''}" placeholder="0" data-change="st-tqin" data-id="${p.id}" aria-label="Cantidad de ${esc(p.nombre)}${vr ? ' ' + esc(vr) : ''}"><button type="button" class="qbtn" data-act="st-tq" data-id="${p.id}" data-d="1" aria-label="Sumar uno de ${esc(p.nombre)}">+</button></div>`;
  return `<div class="tr-f${tot ? ' in' : ''}" data-id="${p.id}">${img}<div class="tr-n"><b data-act="st-ver" data-id="${p.id}">${esc(p.nombre)}</b>${p.sku ? `<small>#${esc(p.sku)}</small>` : ''}${sel}${vars.length && tot > qv ? `<small class="tr-tot">${tot} u. en total</small>` : ''}</div><div class="tr-p">${pr}</div>${q}</div>`;
}
// pone una cantidad exacta (desde la tabla) y vuelve a dejar el foco donde estaba
function ponerCant(p, vr, q) {
  q = Math.max(0, Math.min(9999, Math.floor(+q || 0)));
  if (vr && q > 0 && varAgot(p, vr)) return toast(agotTxt(p));
  const l = S.cart.find(x => x.id === p.id && x.vr === vr), antes = l ? l.qty : 0;
  if (!q) { if (l) S.cart = S.cart.filter(x => x !== l); } else if (l) l.qty = q; else S.cart.push({ id: p.id, vr, qty: q });
  S.foco = p.id; guardarCarrito(); if (q > antes) { evento('AddToCart', { content_name: p.nombre }); marcarAct('c', p.id); }
  const a = document.activeElement, k = a && a.dataset && a.dataset.id ? `[data-id="${a.dataset.id}"]${a.dataset.act ? `[data-act="${a.dataset.act}"][data-d="${a.dataset.d}"]` : a.dataset.change ? `[data-change="${a.dataset.change}"]` : ''}` : '';
  refrescar();
  if (k) { const e = document.querySelector('#pgrid ' + k); if (e && !e.disabled) { e.focus(); if (e.select) e.select(); } }
}
on('st-vmodo', d => { S.vmodo = d.v === 'tabla' ? 'tabla' : 'tarj'; store.set('vm:' + S.slug, S.vmodo); S.limite = 60; pintarGrid(); });
on('st-tvar', (d, el) => { const p = prod(d.id); if (!p) return; S.sel[d.id] = +el.value; pintarGrid(); const e = document.querySelector(`#pgrid [data-change="st-tqin"][data-id="${d.id}"]`); if (e) e.focus(); });
on('st-tq', d => { const p = prod(d.id); if (!p || p.agotado) return; const vr = (p.variantes || [])[selVar(p)] || ''; ponerCant(p, vr, (vr ? qtyVar(p.id, vr) : qtyDe(p.id)) + Number(d.d)); });
on('st-tqin', (d, el) => { const p = prod(d.id); if (!p || p.agotado) return; const vr = (p.variantes || [])[selVar(p)] || ''; ponerCant(p, vr, el.value); });

/* ---------- v2.29 · pedido sin terminar y "Repetir mi último pedido" (todo queda en este celular) ---------- */
const ultDisp = () => { const u = S.ult; if (!u || !Array.isArray(u.items)) return []; return u.items.filter(l => { const p = prod(l.id), v = p && p.variantes || []; return p && !p.agotado && (l.vr ? v.includes(l.vr) && !varAgot(p, l.vr) : !v.length); }); };
const cuando = ts => { const d = Math.floor((Date.now() - ts) / 864e5); return d < 1 ? 'hoy' : d === 1 ? 'ayer' : d < 30 ? `hace ${d} días` : new Date(ts).toLocaleDateString('es-AR'); };
function avisosCompra() {
  if (S.previa) return '';
  if (S.avisoCart && S.cart.length) { const T = totales(); return `<div class="st-ret"><span>🛒 <b>Tenés un pedido sin terminar</b> · ${T.n} u. · ${fmt(T.final)}</span><button type="button" class="btn btn-p btn-sm" data-act="st-ir" data-v="cart">Seguir con mi pedido</button><button type="button" class="st-ret-x" data-act="st-ret-x" aria-label="Cerrar el aviso">✕</button></div>`; }
  const L = !S.cart.length && !S.ultOculto ? ultDisp() : [];
  return L.length ? `<div class="st-ret"><span>🔁 <b>¿Repetís tu último pedido?</b> · ${cuando(S.ult.at)} · ${L.length} ${L.length === 1 ? 'producto' : 'productos'}</span><button type="button" class="btn btn-s btn-sm" data-act="st-repetir">Repetir</button><button type="button" class="st-ret-x" data-act="st-ret-x" aria-label="Cerrar el aviso">✕</button></div>` : '';
}
on('st-ret-x', () => { S.avisoCart = false; S.ultOculto = true; pintar(); });
on('st-repetir', () => {
  const todos = (S.ult && S.ult.items) || [], L = ultDisp(), no = todos.length - L.length;
  if (!L.length) return toast('Los productos de tu último pedido ya no están disponibles.');
  L.forEach(l => { const nl = JSON.parse(JSON.stringify(l)), simple = Object.keys(nl).every(k => ['id', 'vr', 'qty'].includes(k)); const ex = simple && S.cart.find(x => x.id === nl.id && x.vr === nl.vr && Object.keys(x).length === 3); if (ex) ex.qty += nl.qty; else S.cart.push(nl); });
  S.avisoCart = false; guardarCarrito();
  toast(`🔁 Agregamos ${L.length} ${L.length === 1 ? 'producto' : 'productos'} con los precios de hoy${no ? ` · ${no} ya no ${no === 1 ? 'está disponible' : 'están disponibles'}` : ''}`);
  ir('cart');
});

/* ---------- v2.30 · presupuesto que te mandó la tienda ---------- */
const fechaAr = d => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-AR') : '';
function pantallaPresu() {
  const v = S.presu;
  if (!v) return `<div class="page"><div class="empty"><div class="ico">📝</div><p><b>Este presupuesto ya no está disponible.</b></p><p class="muted">Puede que la tienda lo haya anulado. Escribile para pedir uno nuevo.</p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${esc(waLink(normWsp(S.tienda.whatsapp), 'Hola! Quería pedirte un presupuesto.'))}">💬 Escribir por WhatsApp</a><button class="btn btn-s btn-sm" data-act="ps-tienda">Ver la tienda</button></div></div></div>`;
  const est = v.estado === 'convertido' ? ['conv', '🧾 Ya es un pedido'] : v.estado === 'aceptado' ? ['ok', '✅ Aceptado'] : v.vencido ? ['venc', '⌛ Vencido'] : ['env', v.vence ? 'Válido hasta el ' + fechaAr(v.vence) : 'Presupuesto'];
  const puede = !v.vencido && (v.estado === 'borrador' || v.estado === 'enviado');
  return `<div class="page ps"><div class="ps-cab"><div><div class="view-title" style="margin:0">Presupuesto N° ${esc(v.numero)}</div><small class="muted">Para ${esc(v.cliente)} · ${esc(fechaAr(v.fecha))}</small></div><span class="pr-est ${est[0]}">${esc(est[1])}</span></div>
    <div class="ps-ls">${(v.items || []).map(x => `<div class="ps-l"><span><span><b>${esc(x.nombre)}</b>${x.variante ? `<span class="muted"> · ${esc(x.variante)}</span>` : ''}</span><small class="muted">${esc(x.cantidad)} × ${fmt(x.precio_unitario)}</small></span><b>${fmt(x.subtotal)}</b></div>`).join('')}
      ${Number(v.envio_costo) > 0 ? `<div class="ps-l"><span>🚚 Envío${v.envio_nombre ? ' · ' + esc(v.envio_nombre) : ''}</span><b>${fmt(v.envio_costo)}</b></div>` : ''}
      <div class="ps-l ps-tot"><span>Total</span><b>${fmt(v.total)}</b></div></div>
    ${v.nota ? `<p class="ps-nota">${esc(v.nota)}</p>` : ''}
    ${v.vencido ? '<div class="ps-av">⌛ Este presupuesto venció: los precios pueden haber cambiado. Escribile a la tienda y te mandan uno nuevo.</div>' : ''}
    ${v.estado === 'aceptado' || v.estado === 'convertido' ? '<div class="ps-av ok">✅ ¡Listo! La tienda ya sabe que lo aceptaste y te escribe para coordinar el pago y la entrega.</div>' : ''}
    <div class="ps-acc">${puede ? '<button class="btn btn-p" data-act="ps-aceptar">✅ Aceptar presupuesto</button>' : ''}
      <a class="btn btn-wa" target="_blank" rel="noopener" href="${esc(waLink(normWsp(S.tienda.whatsapp), `Hola! Te escribo por el presupuesto N° ${v.numero}${v.vencido ? ': venció, ¿me mandás uno actualizado?' : '.'}`))}">💬 Consultar por WhatsApp</a>
      <button class="btn btn-s" data-act="ps-pdf">📄 Descargar PDF</button><button class="btn btn-s" data-act="ps-tienda">Ver la tienda</button></div></div>`;
}
on('ps-tienda', () => { S.vista = 'cat'; try { history.replaceState(history.state, '', location.pathname); } catch (e) { } pintar(); window.scrollTo(0, 0); });
on('ps-pdf', () => { if (S.presu) imprimir(htmlPresupuesto(S.presu)); });
on('ps-aceptar', async (d, b) => {
  b.disabled = true;
  try {
    await api.aceptarPresupuesto(S.presuTok); S.presu.estado = 'aceptado'; pintar();
    window.open(waLink(normWsp(S.tienda.whatsapp), `¡Hola! Acepto el presupuesto N° ${S.presu.numero} por ${fmt(S.presu.total)}. ¿Cómo seguimos con el pago y la entrega?`), '_blank', 'noopener');
  } catch (e) { b.disabled = false; toast(e.message); if (/venció/.test(e.message)) { S.presu.vencido = true; pintar(); } }
});

/* ---------- talles sin stock (ropa y calzado) ---------- */
const agotSet = p => new Set(Array.isArray(p.talles_agotados) ? p.talles_agotados : []);
const varAgot = (p, v) => agotSet(p).has(v);
// v2.27: las palabras siguen lo que vende la tienda (talle en ropa, tono en cosmética, sabor en almacén…)
let RT = { k: '', r: 'otro' };
const rubroT = () => { const k = (S.tienda && S.tienda.rubro) + ':' + (S.prods || []).length; if (RT.k !== k) RT = { k, r: rubroTienda(S.tienda, S.prods) }; return RT.r; };
const TALLE = { w: 'talle', ws: 'talles', el: 'el' }, talleSi = W => W.w === 'número' ? TALLE : W;   // en la tienda, 38 o 40 también son "talles"
const palP = p => talleSi(palabra(rubroT(), p && p.variantes));
const agotTxt = p => `${ese(palP(p))} no tiene stock`;
function selVar(p) {
  const v = p.variantes || [], s = S.sel[p.id], ag = agotSet(p);
  if (s != null && v[s] !== undefined && !ag.has(v[s])) return s;
  const i = v.findIndex(x => !ag.has(x)); return i < 0 ? 0 : i;
}
const chipsVar = (p, vi) => (p.variantes || []).map((v, i) => { const ag = varAgot(p, v); return `<button class="vchip ${vi === i && !ag ? 'on' : ''}${ag ? ' agot' : ''}" data-act="st-var" data-id="${p.id}" data-i="${i}"${ag ? ` disabled aria-disabled="true" title="Sin stock" aria-label="${esc(v)} sin stock"` : ''}>${esc(v)}</button>`; }).join('');
const guiaHtml = p => (p.variantes || []).length && S.tienda.guia_talles && (rubroT() === 'indumentaria' || pareceTalle(p.variantes)) ? `<details class="guia-t"><summary>📏 Guía de talles</summary><div class="guia-t-in">${esc(S.tienda.guia_talles)}</div></details>` : '';
/* ---------- barra del pedido con niveles (1u · 3u · 6u · 12u+): vibra, se sacude y avisa al desbloquear uno ---------- */
// v2.33: cada tienda puede cambiar los nombres en Ajustes (diseno.niveles); si no, los de siempre
const NIV_DEF = ['Inicial', 'Mayorista', 'Especial', '🏆 Super'];
const nivelesNom = () => { const n = S.tienda && S.tienda.diseno && S.tienda.diseno.niveles; return Array.isArray(n) && n.length === 4 && n.every(x => typeof x === 'string' && x.trim()) ? n : NIV_DEF; };
const NIVELES = [1, 3, 6, 12].map((q, i) => [q, NIV_DEF[i]]);
const niveles = () => { const n = nivelesNom(); return NIVELES.map(([q], i) => [q, n[i]]); };
const gamiOn = () => lookDe(S.tienda.diseno).barra && vista() === 'may' && !!S.tienda.escalas_activas;
const nivelDe = q => (q >= 12 ? 3 : q >= 6 ? 2 : q >= 3 ? 1 : 0);
const posNivel = q => (q >= 12 ? 100 : q >= 6 ? 66.67 + (q - 6) / 6 * 33.33 : q >= 3 ? 33.33 + (q - 3) / 3 * 33.34 : Math.max(0, (q - 1) / 2 * 33.33));
// el producto que se muestra: el último que tocó el cliente; si ese no tiene escala, el último del carrito que sí tenga
function focoEsc() {
  const ids = [S.foco, ...S.cart.map(l => l.id).reverse()];
  for (const id of ids) { const p = prod(id), e = p && escala(p); if (e && e.q > 0) return { p, e }; }
  return null;
}
const deGrupo = p => { const m = grupoModo(); return m === 'categoria' ? 'de ' + nombreCat(p) : m === 'carrito' ? 'de cualquier producto' : 'de ' + p.nombre; };
function celebrar(cb, nivel) {
  if (efectosOn(S.tienda.diseno)) { try { if (navigator.vibrate) navigator.vibrate(nivel >= 3 ? [65, 35, 130] : [45, 25, 70]); } catch (e) { } }
  setTimeout(() => { const x = cb.querySelector('.gb-pill'); if (x) x.remove(); }, 2400);
  if (!fxOn()) return;
  cb.classList.remove('gb-shake'); void cb.offsetWidth; cb.classList.add('gb-shake');
}
function pintarGami(cb, T) {
  const mc = minimo(), f = focoEsc(), mini = !!store.get('gbmini:' + S.slug, false);
  // niveles ya alcanzados al entrar (no se festejan de nuevo)
  if (!S.niveles) { S.niveles = {}; S.cart.forEach(l => { const p = prod(l.id), e = p && escala(p); if (e) S.niveles[grupoDe(p)] = nivelDe(e.q); }); }
  let msg, track = '', nivel = -1, subio = false;
  if (f) {
    const { p, e } = f, k = grupoDe(p), antes = S.niveles[k] === undefined ? -1 : S.niveles[k];
    nivel = nivelDe(e.q); subio = nivel > antes && nivel >= 1; S.niveles[k] = nivel;
    msg = e.nx ? `Sumá <b>${e.falta} u.</b> más ${esc(deGrupo(p))} y desbloqueá el precio ${esc(niveles()[nivel + 1][1])} · <b>${fmt(e.pn)} c/u</b>`
      : `🏆 ¡Desbloqueaste el precio ${esc(niveles()[3][1].replace(/^🏆\s*/u, ''))}!${e.ahorro > 0 ? ` · ahorrás <b>${fmt(e.ahorro)}</b>` : ''} ${esc(deGrupo(p).replace(/^de /, 'en '))}`;
    track = `<div class="gb-track" aria-hidden="true"><div class="gb-rail"><i style="width:${posNivel(e.q).toFixed(1)}%"></i></div>${niveles().map(([n, nm], i) => `<span class="gb-cp${e.q >= n ? ' ok' : ''}${subio && i === nivel ? ' pop' : ''}" style="left:${[0, 33.33, 66.67, 100][i]}%"><b></b><small>${n}u${n === 12 ? '+' : ''} · ${esc(nm)}</small></span>`).join('')}</div>`;
  } else msg = mc && T.total < mc ? `Te faltan <b>${fmt(mc - T.total)}</b> para desbloquear la compra mayorista` : 'Tu pedido está listo para enviar';
  const mcTxt = mc ? (T.total >= mc ? '✓ Mínimo cubierto' : `Faltan ${fmt(mc - T.total)} para el mínimo`) : '';
  cb.className = `gami lvl${Math.max(0, nivel)}${mini ? ' mini' : ''}`;
  cb.innerHTML = `<div class="gb-top"><div class="gb-msg" role="status">${msg}</div><button type="button" class="gb-tg" data-act="gb-min" aria-expanded="${!mini}">${mini ? '▴ Ver escala' : '▾ Minimizar'}</button></div>${track}
    <div class="gb-foot"><span class="gb-tot"><b>${T.n} u.</b> · ${fmt(T.total)}</span>${mcTxt ? `<span class="gb-mc${T.total >= mc ? ' ok' : ''}">${mcTxt}</span>` : ''}<span class="gb-go">Ver pedido →</span></div>${subio ? '<span class="gb-pill" role="status">¡Nivel desbloqueado!</span>' : ''}`;
  if (subio) celebrar(cb, nivel);
}
on('gb-min', () => { store.set('gbmini:' + S.slug, !store.get('gbmini:' + S.slug, false)); pintarBarra(); });
function pintarBarra() {
  const T = totales(), cb = $('#cartbar'); if (!cb) return;
  cb.hidden = T.n === 0; const app = $('#app'), gami = !!T.n && gamiOn(); if (app) app.classList.toggle('gb-on', gami);
  if (!T.n) return;
  const h = pista(), mc = minimo();
  cb.setAttribute('data-act', 'st-ir'); cb.dataset.v = 'cart';
  if (gami) return pintarGami(cb, T);
  cb.className = '';
  cb.innerHTML = `<div class="cb-main"><div class="cb-t">${T.n} u. · ${fmt(T.total)}</div><div class="cb-h">${h ? `Sumá ${h.falta} u. más${grupoModo() === 'producto' ? '' : ' ' + esc(h.de)} y ahorrá ${fmt(h.ahorro)}` : (mc && T.total < mc ? `Faltan ${fmt(mc - T.total)} para el mínimo` : 'Listo para finalizar')}</div></div><div class="cb-go">Ver carrito →</div>`;
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
const pctTxt = v => String(Math.round(+v * 100) / 100).replace('.', ',');
function barrasDesc(T) {
  let h = ''; const eg = +S.tienda.envio_gratis_desde;
  if (eg > 0 && envios().some(e => e.activo !== false && e.tipo !== 'retiro') && !T.envioCupon) {
    const ok = T.final >= eg;
    h += `<div class="prog prog-env${ok ? ' ok' : ''}"><div class="prog-t">${ok ? '🚚 ¡Tenés envío gratis!' : `🚚 Te faltan <span>${fmt(eg - T.final)}</span> para el envío gratis`}</div><div class="bar"><i style="width:${Math.min(100, Math.round(T.final / eg * 100))}%"></i></div></div>`;
  }
  const m = vista() === 'min' && S.tienda.desc_monto ? montoEscalon(S.tienda.desc_monto, T.total) : null;
  if (m && (m.act || m.sig)) {
    const tx = m.act && T.dm > 0 ? `🎁 ¡${pctTxt(m.act.pct)} % off en todo tu pedido!${m.sig ? ` Te faltan <span>${fmt(m.sig.desde - T.total)}</span> para ${pctTxt(m.sig.pct)} %` : ''}`
      : m.act ? `🎁 Ya llegaste al ${pctTxt(m.act.pct)} % off por monto${T.dc ? ' (tu cupón te conviene más)' : ''}` : `🎁 Te faltan <span>${fmt(m.sig.desde - T.total)}</span> para ${pctTxt(m.sig.pct)} % off en todo tu pedido`;
    h += `<div class="prog prog-monto${m.act ? ' ok' : ''}"><div class="prog-t">${tx}</div><div class="bar"><i style="width:${m.sig ? Math.min(100, Math.round(T.total / m.sig.desde * 100)) : 100}%"></i></div></div>`;
  }
  return h;
}
function bloquesProgreso(T) {
  let h = barrasDesc(T); const th = pista(), mc = minimo();
  if (th) { const base = { 3: 0, 6: 3, 12: 6 }[th.nx], pct = Math.min(100, Math.round((th.q - base) / (th.nx - base) * 100)); h += `<div class="prog"><div class="prog-t">Sumá <span>${th.falta} u. más</span> ${esc(th.de)} y ahorrá <span>${fmt(th.ahorro)}</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>`; }
  if (mc) { const ok = T.total >= mc; h += `<div class="prog ${ok ? '' : 'warn'}"><div class="prog-t">${ok ? '✓ Superaste el mínimo de compra (' + fmt(mc) + ')' : 'Compra mínima ' + fmt(mc) + ' · te faltan <span>' + fmt(mc - T.total) + '</span>'}</div><div class="bar"><i style="width:${Math.min(100, Math.round(T.total / mc * 100))}%"></i></div></div>`; }
  return h;
}
function pantallaCarrito() {
  const L = lineas();
  if (!L.length) { const U = S.previa ? [] : ultDisp(); return `<div class="page"><button class="back" data-act="st-ir" data-v="cat">← Seguir comprando</button><div class="empty"><div class="ico">🛒</div><p>Todavía no agregaste productos.</p>${U.length ? `<button type="button" class="btn btn-s btn-sm" style="margin-top:12px" data-act="st-repetir">🔁 Repetir mi último pedido (${U.length} ${U.length === 1 ? 'producto' : 'productos'})</button>` : ''}</div></div>`; }
  const T = totales(), mc = minimo(), bloq = mc && T.total < mc, pau = pausado(), visto = {};
  // barra de escala una vez por grupo (producto, categoría o carrito) y ganancia una vez por producto
  const extra = l => { const k = grupoDe(l.p), bar = visto[k] ? '' : escalaHtml(l.p, true); visto[k] = 1; if (visto['g' + l.p.id]) return bar; visto['g' + l.p.id] = 1; return bar + ganQty(l.p); };
  const ult = new Map(); L.forEach((l, k) => ult.set(l.p.id, k));
  const prRow = (l, k) => { if (ult.get(l.p.id) !== k) return ''; const x = T.PR.find(y => y.p.id === l.p.id); if (!x) return '';
    const masTalles = (l.p.variantes || []).length > 1 ? ` (de cualquier ${palP(l.p).w})` : '';
    return x.d > 0 ? `<div class="cpromo"><span>🎁 ${esc(promoTxt(l.p.promo))}${x.falta ? `<small>Sumá ${x.falta} más${masTalles} y ahorrás todavía más</small>` : ''}</span><b>−${fmt(x.d)}</b></div>`
      : x.falta ? `<div class="cpromo off"><span>🎁 Sumá ${x.falta} más${masTalles}: ${esc(promoTxt(l.p.promo))}</span></div>` : ''; };
  return `<div class="page"><button class="back" data-act="st-ir" data-v="cat">← Seguir comprando</button><div class="view-title">🛒 Mi carrito</div>${bloquesProgreso(T)}
    ${L.map((l, k) => `${extra(l)}<div class="citem"><div class="citem-em">${esc(l.p.emoji)}</div><div class="citem-inf"><div class="citem-nm">${esc(l.p.nombre)}${l.vr ? ' · ' + esc(l.vr) : ''}</div><div class="citem-pr">${fmt(l.pu)} c/u · <b>${fmt(l.sub)}</b></div></div><div class="citem-ctrl"><button class="qbtn" data-act="st-lq" data-i="${l.i}" data-d="-1" aria-label="Quitar uno">−</button><span class="qnum">${l.qty}</span><button class="qbtn" data-act="st-lq" data-i="${l.i}" data-d="1" aria-label="Agregar uno">+</button><button type="button" class="cdel" data-act="st-lx" data-i="${l.i}" aria-label="Sacar ${esc(l.p.nombre)} del pedido" title="Sacar del pedido">🗑</button></div></div>${prRow(l, k)}`).join('')}
    <button type="button" class="c-mas" data-act="st-ir" data-v="cat">＋ Agregar más productos</button>
    <div class="card"><div class="srow"><span>Unidades</span><span class="v">${T.n}</span></div>${T.ahorro > 0 ? `<div class="srow"><span>Ahorro por volumen</span><span class="v save">-${fmt(T.ahorro)}</span></div>` : ''}${T.promo > 0 ? `<div class="srow"><span>🎁 Promos</span><span class="v save">-${fmt(T.promo)}</span></div>` : ''}${descRows(T)}<div class="srow tot"><span>Total productos</span><span class="v">${fmt(T.final)}</span></div>${envios().length ? '<div class="hint" style="margin-top:6px">El envío lo elegís en el próximo paso.</div>' : ''}</div>${ganCarrito()}
    <button class="btn btn-p" ${bloq || pau ? 'disabled' : ''} data-act="st-ir" data-v="co">${pau ? '🔒 Pedidos cerrados por ahora' : bloq ? 'Faltan ' + fmt(mc - T.total) + ' para el mínimo' : 'Continuar →'}</button></div>`;
}
// "¿Tenés un cupón?" (v2.26): se valida al tocar Aplicar y de nuevo al confirmar el pedido
function cuponMsg(T) {
  const c = S.cupon; if (!c) return S.cuponPend ? `<div class="hint">🎟️ Tenés el cupón ${esc(S.cuponPend)}: tocá Aplicar.</div>` : '';
  if (c.err) return `<div class="cup-err">${esc(c.err)}</div>`;
  const nota = T.cuponFalta ? `Es para compras desde ${fmt(c.minimo)}: te faltan ${fmt(T.cuponFalta)}.` : T.cuponSinBase ? 'No se suma a productos que ya tienen descuento (promo, oferta o combo).'
    : T.cuponPierde ? 'Tu pedido ya tiene un descuento por monto que te conviene más: el cupón no se usa.' : c.primera_compra ? 'Es para tu primera compra: lo confirmamos al enviar el pedido.' : '';
  return `<div class="cup-ok">🎟️ <b>${esc(c.codigo)}</b> · ${esc(cuponTxt(c))}${T.dc ? ` · <b>-${fmt(T.dc)}</b>` : T.envioCupon ? ' · aplicado' : ''}</div>${nota ? `<div class="hint">${esc(nota)}</div>` : ''}`;
}
function cuponUi() {
  if (!S.tienda.hay_cupones && !S.cupon && !S.cuponPend) return '';
  const T = totales(), ok = S.cupon && S.cupon.ok;
  return `<div class="fg cup-box"><label class="flabel" for="co-cup">¿Tenés un cupón de descuento?</label><div class="cup-r"><input class="fi" id="co-cup" maxlength="20" autocomplete="off" autocapitalize="characters" value="${esc(S.cupon ? S.cupon.codigo : S.cuponPend || '')}" placeholder="Ej: HOLA10" ${ok ? 'readonly' : ''} aria-describedby="cup-msg"><button type="button" class="btn btn-s btn-sm" data-act="${ok ? 'st-cup-quitar' : 'st-cup'}">${ok ? 'Quitar' : 'Aplicar'}</button></div><div id="cup-msg" aria-live="polite">${cuponMsg(T)}</div></div>`;
}
async function aplicarCupon(cod) {
  cod = String(cod || '').trim().toUpperCase(); if (!cod) return;
  const w = document.querySelector('#co-form [name=whatsapp]'), wsp = w ? soloDigitos(w.value) : '';
  try { const r = await api.cuponVer(S.slug, cod, wsp.length >= 8 ? wsp : null); S.cupon = Object.assign({ ok: true }, r); S.cuponPend = ''; }
  catch (e) { S.cupon = { codigo: cod, err: e.message }; }
  repintarCo();
}
on('st-cup', () => { const i = $('#co-cup'); aplicarCupon(i && i.value); });
on('st-cup-quitar', () => { S.cupon = null; S.cuponPend = ''; repintarCo(); });
function pantallaCheckout() {
  if (S.cuponPend && !S.cupon && !S.cupAuto) { S.cupAuto = true; setTimeout(() => aplicarCupon(S.cuponPend), 0); }
  if (!S.cart.length || pausado()) { S.vista = 'cart'; return pantallaCarrito(); }
  if (!pagos().includes(S.pay)) S.pay = pagos()[0];   // si el comercio apagó el que estaba elegido
  return `<div class="page"><button class="back" data-act="st-ir" data-v="cart">← Volver al carrito</button><div class="view-title">📋 Tus datos</div><div id="co-err"></div>
    <form data-submit="st-pedir" id="co-form">
      <div class="fg"><label class="flabel" for="co-nom">Nombre completo</label><input class="fi" id="co-nom" name="nombre" data-input="st-contacto" maxlength="80" required></div>
      <div class="fg"><label class="flabel" for="co-wsp">Tu WhatsApp</label><input class="fi" id="co-wsp" name="whatsapp" type="tel" inputmode="tel" placeholder="11 2345-6789" data-input="st-contacto" required></div>
      ${camposExtra()}
      ${envioUi()}
      <div class="fg"><label class="flabel">Medio de pago</label>${pagos().map(k => { const [i, n, d] = pagoUi(k); return `<button type="button" class="opt ${S.pay === k ? 'on' : ''}" data-act="st-pay" data-p="${k}"><span class="opt-ico">${i}</span><span class="opt-tx"><div class="opt-nm">${n}</div><div class="opt-ds">${d}</div></span><span class="radio"></span></button>`; }).join('')}</div>
      ${tandaUi()}${encargoUi()}${notaUi()}
      ${cuponUi()}${resumenCo()}
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
  return `<div class="fg"><span class="flabel" id="env-lbl">¿Cómo lo recibís?</span><div role="radiogroup" aria-labelledby="env-lbl">${L.map(x => { const c = costoEnvio(x, T.final); return `<button type="button" role="radio" aria-checked="${S.env === x.id}" class="opt ${S.env === x.id ? 'on' : ''}" data-act="st-env" data-e="${esc(x.id)}"><span class="opt-ico">${ENV_ICO[x.tipo] || '🚚'}</span><span class="opt-tx"><div class="opt-nm">${esc(x.nombre)}</div><div class="opt-ds">${(x.tipo === 'acordar' || x.tipo === 'correo') && !c && !(+S.tienda.envio_gratis_desde > 0 && totales().final >= +S.tienda.envio_gratis_desde) ? 'Costo a coordinar' : c ? fmt(c) : x.tipo === 'retiro' ? 'Sin cargo' : 'Gratis'}${x.detalle ? ' · ' + esc(x.detalle) : ''}</div></span><span class="radio"></span></button>`; }).join('')}</div></div>
    ${e && e.tipo === 'acordar' ? `<div class="fg"><label class="flabel" for="co-dir">Dirección o zona <small class="muted">(opcional)</small></label><input class="fi" id="co-dir" name="direccion" maxlength="160" placeholder="Para coordinar la entrega (barrio, calle…)"></div>`
      : e && e.tipo !== 'retiro' ? `<div class="fg"><label class="flabel" for="co-dir">Dirección de entrega</label><input class="fi" id="co-dir" name="direccion" maxlength="160" required minlength="5" placeholder="Calle, número, piso / referencia"></div>` : ''}`;
}
const descRows = T => `${T.dm > 0 ? `<div class="srow"><span>🎁 Descuento por monto</span><span class="v save">-${fmt(T.dm)}</span></div>` : ''}${T.dc > 0 ? `<div class="srow"><span>🎟️ Cupón ${esc(T.cupon.codigo)}</span><span class="v save">-${fmt(T.dc)}</span></div>` : ''}`;
function resumenCo() {
  const T = totales(), e = envioSel(), c = costoEnvio(e, T.final);
  if (!envios().length) return `<div class="card">${T.dm || T.dc ? `<div class="srow"><span>Productos</span><span class="v">${fmt(T.total)}</span></div>${descRows(T)}` : ''}<div class="srow tot"><span>Total</span><span class="v">${fmt(T.final)}</span></div></div>`;
  return `<div class="card"><div class="srow"><span>Productos</span><span class="v">${fmt(T.total)}</span></div>${descRows(T)}<div class="srow"><span>Envío</span><span class="v">${e ? (c ? fmt(c) : e.tipo === 'retiro' ? 'Sin cargo' : (e.tipo === 'acordar' || e.tipo === 'correo') && !+e.costo ? 'A coordinar' : 'Gratis') : '—'}</span></div><div class="srow tot"><span>Total</span><span class="v">${fmt(T.final + c)}</span></div></div>`;
}
const cp0 = i => { const p = prod(i.producto_id); return !!(p && Array.isArray(i.talles) && i.talles.length); };
const ctTxt = i => { const L = []; (i.talles || []).forEach(x => { const q = prod(x.id), n = q ? q.nombre : 'Producto', o = L.find(y => y.n === n); const v = x.v + (+x.n > 1 ? ' x' + x.n : ''); o ? o.v.push(v) : L.push({ n, v: [v] }); }); return L.map(o => o.n + ' ' + o.v.join(', ')).join(' · '); };
function ticket(r, cliente) {
  const ubic = [cliente.localidad, cliente.provincia, cliente.cp ? 'CP ' + cliente.cp : ''].filter(Boolean).join(' · ');
  let t = `*PEDIDO N° ${r.numero}* · ${r.tienda}\nCliente: ${cliente.nombre}${cliente.dni ? '\nDNI/CUIT: ' + cliente.dni : ''}\nWhatsApp: ${cliente.whatsapp}\n${ubic ? 'Ubicación: ' + ubic + '\n' : ''}${S.tienda.modalidad === 'minorista' ? '' : 'Modalidad: ' + (r.modo === 'mayorista' ? 'Mayorista' : 'Minorista') + '\n'}\nDetalle:\n`;
  r.items.forEach(i => { const u = unidadTxt(i.unidad, i.contenido); t += `• ${i.cantidad} × ${i.nombre}${i.variante ? ' (' + i.variante + ')' : i.talles && cp0(i) ? ' (' + ctTxt(i) + ')' : ''}${u ? ' [' + u + ']' : ''} · ${fmt(i.precio_unitario)} c/${u || 'u'} = ${fmt(+i.subtotal + (+i.descuento || 0))}\n`; const cp = prod(i.producto_id), ct = cp ? comboTxt(cp) : ''; if (ct) t += `   ↳ trae: ${ct.replace(/ · /g, ', ')}\n`; });
  promosDelPedido(r.items, i => i.nombre).forEach(x => { t += `🎁 ${promoTxt(x.promo) || 'Promo'} · ${x.nombre}: -${fmt(x.d)}\n`; });
  if (+r.descuento_monto > 0) t += `🎁 Descuento por monto: -${fmt(r.descuento_monto)}\n`;
  if (r.cupon) t += +r.descuento_cupon > 0 ? `🎟️ Cupón ${r.cupon}: -${fmt(r.descuento_cupon)}\n` : r.cupon_envio ? `🎟️ Cupón ${r.cupon}: envío gratis\n` : '';
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
  if (u.demo) return `<div class="page"><div class="center"><div class="ok-ring">🎬</div><h2 style="font-size:1.4rem">¡Pedido de prueba armado!</h2><p class="muted" style="margin:6px 0 14px">En la tienda real, acá tu cliente toca “Enviar por WhatsApp” y a ${esc(S.tienda.nombre)} le llega este ticket, con el total ya calculado. <b>En la demo no se mandó ni se guardó nada.</b></p></div>
    <pre class="demo-tk">${esc(u.tk)}</pre>
    <div class="stack"><a class="btn btn-p" href="${esc(urlRegistro())}">Crear mi tienda gratis</a><button class="btn btn-s" data-act="st-ir" data-v="cat">Seguir mirando la demo</button></div></div>`;
  return `<div class="page"><div class="center"><div class="ok-ring">✅</div><h2 style="font-size:1.4rem">¡Pedido registrado!</h2><p class="muted" style="margin:6px 0 18px">N° <b>${esc(u.r.numero)}</b> · ${fmt(u.r.total)}. Falta un paso: enviá el ticket por WhatsApp para que ${esc(S.tienda.nombre)} lo confirme.</p>${u.r.proxima_tanda ? '<p class="enc-note enc-co" id="ok-tanda">📦 Tu pedido entra en la próxima tanda.</p>' : ''}</div>
    <div class="stack">${u.mp ? `<a class="btn btn-p" id="mp-pagar" href="${esc(u.mp)}" rel="noopener">💳 Pagar ahora con Mercado Pago</a>` : ''}${u.mpError ? `<div class="err-box">${esc(u.mpError)} Podés coordinar el pago por WhatsApp.</div>` : ''}<a class="btn btn-wa" href="${esc(u.link)}" target="_blank" rel="noopener">📲 Enviar ticket por WhatsApp</a><pre class="ticket">${esc(u.tk)}</pre>
    <button class="btn btn-s" data-act="st-copiar">Copiar ticket</button><button class="btn btn-s" data-act="st-ir" data-v="cat">Seguir comprando</button></div>
    <p class="hint center" style="margin-top:12px">Si WhatsApp no se abrió solo, tu navegador bloqueó la ventana: usá el botón verde.</p></div>`;
}

/* ---------- v2.31 · demo con la tienda real ---------- */
// el registro está en el sitio principal (si la tienda abre en su subdominio, se va al dominio de Eskalapp)
const urlRegistro = () => (MARCA.DOMINIO ? 'https://' + MARCA.DOMINIO : location.origin) + '/#/registro';
function demoBarra() {
  if (!S.demo) return '';
  return `<div class="demo-bar" role="note"><span>🎬 <b>Demo de Eskalapp</b> con la tienda real de ${esc(S.tienda.nombre)}. Armá un pedido de prueba: <b>no se manda ni se guarda</b>.</span><a class="btn btn-sm demo-bar-b" href="${esc(urlRegistro())}">Crear mi tienda gratis</a></div>`;
}
// el mismo ticket que le llega a la tienda, armado con los precios que ve el cliente (sin pasar por el servidor)
function pedidoDemo(cliente) {
  const T = totales(), e = envioSel(), env = costoEnvio(e, T.final);
  const items = lineas().map(l => ({ producto_id: l.p.id, nombre: l.p.nombre, variante: l.vr || '', talles: (S.cart[l.i] || {}).ct, cantidad: l.qty, precio_unitario: l.pu, subtotal: l.sub, unidad: l.p.unidad, contenido: l.p.contenido }));
  const r = { numero: 'DEMO', tienda: S.tienda.nombre, modo: vista() === 'may' ? 'mayorista' : 'minorista', items, total: T.final + env, subtotal: T.final, descuento_monto: T.dm, cupon: T.cupon ? T.cupon.codigo : null, descuento_cupon: T.dc,
    envio: e ? e.nombre : null, envio_costo: env, alias_cobro: S.tienda.alias_cobro || '', whatsapp: S.tienda.whatsapp };
  let tk = ''; try { tk = ticket(r, cliente); } catch (er) { tk = `*PEDIDO DE PRUEBA* · ${S.tienda.nombre}\nTotal: ${fmt(r.total)}`; }
  S.ultimo = { r, tk, link: null, demo: true }; S.cart = []; S.cupon = null; S.cuponPend = ''; guardarCarrito();
  S.vista = 'ok'; pintar(); window.scrollTo(0, 0);
}

/* ---------- acciones ---------- */
const ir = v => { if (v === 'cart') S.avisoCart = false; if (v === 'co' && S.vista !== 'co' && S.cart.length) evento('InitiateCheckout', { num_items: S.cart.reduce((a, l) => a + l.qty, 0) }); S.vista = v; S.det = null; pintar(); window.scrollTo(0, 0); };
on('st-ir', d => ir(d.v));
on('st-q', (d, el) => { S.q = el.value; S.limite = 60; pintarGrid(); });
on('st-cat', d => { S.cat = d.c; S.limite = 60; pintarGrid(); });
on('st-mas', () => { S.limite += 60; pintarGrid(); });
on('st-var', d => { const p = prod(d.id); if (p && varAgot(p, (p.variantes || [])[+d.i])) return toast(agotTxt(p)); S.sel[d.id] = +d.i; pintarGrid(); pintarDet(); });
on('st-add', (d, b) => {
  const p = prod(d.id); if (!p || p.agotado) return;
  if (pideTalles(p)) { verProd(p.id); S.det = p.id; pintarDet(); return; }   // combo con talles: se eligen en la ficha
  const vr = (p.variantes || [])[selVar(p)] || '';
  if (vr && varAgot(p, vr)) return toast(agotTxt(p));
  const ex = S.cart.find(l => l.id === p.id && l.vr === vr); ex ? ex.qty++ : S.cart.push({ id: p.id, vr, qty: 1 }); S.foco = p.id;
  guardarCarrito(); evento('AddToCart', { content_name: p.nombre }); marcarAct('c', p.id); refrescar(); golpe(b);
});
on('st-dec', d => {
  const p = prod(d.id), vr = (p.variantes || [])[selVar(p)] || '';
  const l = S.cart.find(x => x.id === d.id && x.vr === vr) || S.cart.find(x => x.id === d.id); if (!l) return;
  l.qty--; if (l.qty < 1) S.cart = S.cart.filter(x => x !== l); S.foco = d.id; guardarCarrito(); refrescar();
});
on('st-lx', d => { const l = S.cart[+d.i]; if (!l) return; const p = prod(l.id); S.cart.splice(+d.i, 1); guardarCarrito(); pintar(); toast(`Sacamos ${p ? p.nombre : 'el producto'} del pedido`); });
on('st-lq', d => { const l = S.cart[+d.i]; if (!l) return; l.qty += +d.d; if (l.qty < 1) S.cart.splice(+d.i, 1); guardarCarrito(); pintar(); });
function refrescar() { const T = totales(); const f = $('#cart-fab'); if (f) f.innerHTML = fabHtml(T); const sn = $('#sr-n'); if (sn) sn.textContent = T.n || ''; pintarGrid(); pintarBarra(); pintarDet(); pintarVitrina(); }
// en el carrusel solo se actualiza el "N u" (así no salta de lugar mientras la persona agrega)
function pintarVitrina() { document.querySelectorAll('section.vt .vt-card').forEach(c => { const q = qtyDe(c.dataset.id), b = c.querySelector('.vt-q'); c.classList.toggle('in-cart', !!q); if (b) { b.hidden = !q; b.textContent = q + ' u'; } }); }
/* ---------- ficha de producto (foto grande, descripción, variantes y escalas) ---------- */
function pintarDet() {
  const r = $('#pdet-root'); if (!r) return;
  const p = S.det && prod(S.det); if (!p) { r.innerHTML = ''; return; }
  const t = tramos(p), qty = qtyDe(p.id), qe = qtyEsc(p), vi = selVar(p), vars = p.variantes || [], matriz = vars.length > 1 && !p.agotado;
  const precios = t && S.tienda.escalas_activas && !t.unico ? `${porUnidad(p)}<div class="ptiers" style="margin:10px 0">${[1, 3, 6, 12].map(n => `<div class="ptier"><div class="ptier-q">x${n}${n === 12 ? '+' : ''}</div><div class="ptier-p">${fmt(t[n])}</div>${n > 1 && t[1] ? `<div class="ptier-s">-${Math.round((1 - t[n] / t[1]) * 100)}%</div>` : ''}</div>`).join('')}</div>${escNota(p)}` : `<div class="retail-price" style="margin:8px 0">${fmt(t ? t[1] : p.precio_1)}</div>${porUnidad(p)}${t && t.unico ? '<div class="flat-note">precio mayorista único: el mismo para cualquier cantidad</div>' : ''}`;
  r.innerHTML = `<div class="modal-bg" data-act="st-det-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(p.nombre)}">
    <div class="pdet-img${p.imagen_url ? ' con-img' : ' noimg'}"${p.imagen_url ? ` style="${cssImg(p.imagen_url)}"` : ''}>${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="${esc(p.nombre)}">` : esc(p.emoji)}</div>
    <div class="view-title" style="margin-bottom:2px">${esc(p.nombre)}</div><div class="muted" style="font-size:.8rem">${esc([p.categoria, p.marca, p.sku ? 'Cód. ' + p.sku : ''].filter(Boolean).join(' · '))}</div>
    ${p.descripcion ? `<div class="pdet-desc">${esc(p.descripcion)}</div>` : ''}
    ${precios}${p.precio_lista && (!t || t.unico || vista() === 'min') ? `<div class="was-l">Antes ${comboTxt(p) ? '(comprando cada uno por separado)' : ''} <s>${fmt(p.precio_lista)}</s></div>` : ''}${ofertaNota(p)}${promoBox(p)}${p.a_pedido ? `<div class="enc-note">📦 Por encargo: llega en ${+p.demora_dias} días desde que confirmás el pedido.</div>` : ''}
    ${matriz ? `<div class="flabel" style="margin-top:10px">Elegí cuántas de cada una${tramos(p) && !tramos(p).unico ? ' <small class="muted">(todas suman para el precio por cantidad)</small>' : ''}</div><div class="mx" id="mx">${vars.map((v, i) => { const n = qtyVar(p.id, v); if (varAgot(p, v) && !n) return `<div class="mx-row agot"><span class="mx-n">${esc(v)}</span><span class="mx-sin">Sin stock</span></div>`; return `<div class="mx-row${n ? ' on' : ''}"><span class="mx-n">${esc(v)}</span><button class="qbtn" data-act="st-vq" data-id="${p.id}" data-i="${i}" data-d="-1" aria-label="Quitar uno de ${esc(v)}" ${n ? '' : 'disabled'}>−</button><input class="fi mx-q" inputmode="numeric" data-change="st-vset" data-id="${p.id}" data-i="${i}" value="${n}" aria-label="Cantidad de ${esc(v)}"><button class="qbtn" data-act="st-vq" data-id="${p.id}" data-i="${i}" data-d="1" aria-label="Agregar uno de ${esc(v)}">+</button></div>`; }).join('')}</div><div class="mx-tot">${qty ? `<b>${qty} u.</b> en total · ${fmt(unidad(p, qe))} c/u · <b>${fmt(unidad(p, qe) * qty)}</b>` : 'Todavía no sumaste ninguna.'}</div>`
      : vars.length ? `<div class="flabel" style="margin-top:10px">Elegí una opción</div><div class="vars">${chipsVar(p, vi)}</div>` : ''}${guiaHtml(p)}${pideTalles(p) && !p.agotado ? ctHtml(p) : ''}
    ${escalaHtml(p)}${ganQty(p) || ganHtml(p)}
    ${p.agotado ? '<button class="btn btn-s" disabled>Sin stock</button>' : matriz ? '' : pideTalles(p) ? ctBtn(p, qty) : `<div style="display:flex;gap:8px;align-items:center">${qty ? `<button class="qbtn" data-act="st-dec" data-id="${p.id}" aria-label="Quitar uno">−</button><span class="qnum">${qty}</span>` : ''}<button class="btn btn-p" style="flex:1" data-act="st-add" data-id="${p.id}">${qty ? '+ Agregar otro' : '+ Agregar al carrito'}</button></div>`}
    ${flyOn() ? `<button class="btn btn-s" style="margin-top:8px" data-act="fly-uno" data-id="${p.id}">📸 Crear Flyer para Vender</button>` : ''}
    ${qty ? `<button class="btn btn-s" style="margin-top:8px" data-act="st-ir" data-v="cart">Ver carrito (${totales().n} u.)</button>` : ''}
    <button class="btn btn-s" style="margin-top:8px" data-act="st-det-cerrar">Seguir mirando</button></div></div>`;
}
const ctBtn = (p, qty) => `<button class="btn btn-p" style="width:100%" data-act="st-add-ct" data-id="${p.id}" ${ctCompleto(p) ? '' : 'disabled'}>${ctCompleto(p) ? '+ Agregar combo al carrito' : `Elegí ${losArt(talleSi(palabra(rubroT(), compsTalle(p).flatMap(x => x.q.variantes || []))))} para agregarlo`}</button>${qty ? `<div class="hint" style="margin-top:6px">Ya tenés ${qty} en el carrito.</div>` : ''}`;
on('st-ct', d => {
  const p = prod(d.id), q = prod(d.c); if (!p || !q) return; const v = (q.variantes || [])[+d.i]; if (v === undefined) return;
  if (varAgot(q, v)) return toast(agotTxt(q));
  const s = ctSel(p); (s[q.id] = s[q.id] || [])[+d.k] = v; pintarDet();
});
on('st-add-ct', d => {
  const p = prod(d.id); if (!p || p.agotado) return; if (!ctCompleto(p)) return toast(`Elegí ${conArt(talleSi(palabra(rubroT(), compsTalle(p).flatMap(x => x.q.variantes || []))))} de cada producto del combo`);
  const { ct, vr } = ctDatos(p), ex = S.cart.find(l => l.id === p.id && l.vr === vr);
  ex ? ex.qty++ : S.cart.push({ id: p.id, vr, qty: 1, ct }); S.foco = p.id;
  guardarCarrito(); evento('AddToCart', { content_name: p.nombre }); marcarAct('c', p.id); refrescar(); toast('🧩 Combo agregado · ' + vr);
});
on('st-ver', d => { verProd(d.id); S.det = d.id; pintarDet(); if (d.mx) { const m = $('#mx'); if (m) m.scrollIntoView({ block: 'center' }); } });
// matriz de variantes: cada opción con su cantidad; todas suman para la escala del producto
const qtyVar = (id, vr) => { const l = S.cart.find(x => x.id === id && x.vr === vr); return l ? l.qty : 0; };
function setVar(id, i, n) {
  const p = prod(id); if (!p || p.agotado) return; const vr = (p.variantes || [])[+i]; if (vr === undefined) return;
  if (varAgot(p, vr) && Number(n) > qtyVar(id, vr)) return toast(agotTxt(p));
  n = Math.max(0, Math.min(9999, Math.round(Number(n) || 0)));
  const l = S.cart.find(x => x.id === id && x.vr === vr), antes = l ? l.qty : 0;
  if (!n) S.cart = S.cart.filter(x => x !== l); else if (l) l.qty = n; else S.cart.push({ id, vr, qty: n });
  if (n > antes) evento('AddToCart', { content_name: p.nombre }); S.foco = id;
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

on('may-abrir', async () => { if (S.demo) { try { const lista = await api.listaMayoristaDemo(S.slug); S.may = new Map(lista.map(r => [r.producto_id, r])); pintar(); toast('💼 Lista mayorista activada'); } catch (e) { toast(e.message); } return; }
  if (S.tienda.requiere_codigo) { S.pedirCodigo = true; pintar(); const i = document.querySelector('#gremio-box input'); if (i) i.focus(); } else await activarMay(null); });
on('may-codigo', async (d, f) => { await activarMay(new FormData(f).get('codigo')); });
on('may-salir', () => { S.may = null; S.codigo = ''; S.pedirCodigo = false; pintar(); toast('Volviste a precios minoristas'); });
async function activarMay(codigo) {
  try {
    const lista = await api.listaMayorista(S.slug, codigo);
    S.may = new Map(lista.map(r => [r.producto_id, r])); S.codigo = codigo || ''; S.pedirCodigo = false; pintar(); toast('💼 Lista mayorista activada');
  } catch (e) { const er = $('#may-err'); if (er) { er.textContent = e.message; er.hidden = false; } else toast(e.message); }
}

const subirCarrito = debounce(async (nombre, wsp) => {
  if (S.previa || S.demo || !S.tienda.carritos_activos || soloDigitos(wsp).length < 8 || !S.cart.length) return;
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
  const items = S.cart.map(l => l.ct ? { producto_id: l.id, variante: '', cantidad: l.qty, talles: l.ct } : { producto_id: l.id, variante: l.vr, cantidad: l.qty });
  if (S.cupon && S.cupon.ok) cliente.cupon = S.cupon.codigo;
  if (S.previa) { $('#co-err').innerHTML = '<div class="ok-box">👁 Vista previa: así lo ve tu cliente. Desde acá no se envían pedidos.</div>'; window.scrollTo(0, 0); return; }
  if (S.demo) { pedidoDemo(cliente); return; }
  const btn = $('#co-go'); S.enviando = true; btn.disabled = true; btn.textContent = 'Enviando…';
  try {
    const r = await api.crearPedido(S.slug, cliente, items, vista() === 'may' ? 'mayorista' : 'minorista', S.codigo, S.pay, S.ref);
    const tk = ticket(r, cliente), link = waLink(normWsp(r.whatsapp), tk);
    if (!S.previa) { const u = { at: Date.now(), items: S.cart.map(l => JSON.parse(JSON.stringify(l))) }; store.set('ult:' + S.slug, u); S.ult = u; }
    S.ultimo = { r, tk, link }; S.cart = []; S.cupon = null; S.cuponPend = ''; S.cupAuto = false; guardarCarrito(); evento('Purchase', { value: r.total, currency: 'ARS', transaction_id: r.numero || r.id });
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

// v2.29 · PDF: en la lista por menor se descarga con los precios oficiales; en la mayorista además el revendedor
// arma su propia lista (precio base x1/x3/x6/x12 + su % de ganancia, redondeado a $100, con su nombre y WhatsApp)
function gruposPdf(precioDe, conSku) {
  const g = new Map();
  S.prods.filter(p => !p.agotado).forEach(p => { const tr = tramos(p); const l = g.get(p.categoria) || []; l.push({ sku: conSku ? p.sku : '', nombre: p.nombre, variantes: p.variantes, stock: '—', precio: precioDe(p, tr) }); g.set(p.categoria, l); });
  return [...g.entries()].sort((a, b) => String(a[0] || '').localeCompare(String(b[0] || ''))).map(([cat, filas]) => ({ cat, filas: filas.sort((a, b) => a.nombre.localeCompare(b.nombre)) }));
}
const NOTA_PDF = 'Precios en pesos argentinos, sujetos a cambio sin previo aviso.';
function pdfOficial() { const t = S.tienda; imprimir(htmlCatalogo({ nombre: t.nombre, logo: t.logo_url, color: t.color, eslogan: t.eslogan, titulo: vista() === 'may' ? 'Lista mayorista' : 'Lista de precios', grupos: gruposPdf((p, tr) => tr ? tr[1] : +p.precio_1, true), conStock: false, nota: NOTA_PDF })); }
const redondeo = (u, pct) => Math.ceil(u * (1 + pct / 100) / 100) * 100;
const baseDe = (p, tr, b) => { if (!tr) return +p.precio_1; return tr[b] != null ? tr[b] : tr[1]; };
// catálogo PDF con los precios del revendedor: desde Mayorista Pro (en Gratis queda la lista de precios de la tienda)
const revOk = () => vista() === 'may' && !S.tienda.plan_gratis;
function revCfg() { const c = store.get('rev:' + S.slug, null) || {}; return { base: [1, 3, 6, 12].includes(+c.base) ? +c.base : (S.tienda.escalas_activas ? 12 : 1), pct: Number.isFinite(+c.pct) && c.pct !== '' ? Math.max(0, Math.min(500, +c.pct)) : 50, nombre: String(c.nombre || '').slice(0, 60), wsp: String(c.wsp || '').slice(0, 30) }; }
function pintarRev() {
  let r = $('#rev-root'); if (!r) { r = document.createElement('div'); r.id = 'rev-root'; document.body.appendChild(r); }
  if (!S.rev) { r.innerHTML = ''; return; }
  const c = S.rev, ej = S.prods.find(p => !p.agotado && tramos(p)) || S.prods.find(p => !p.agotado), tr = ej && tramos(ej), u = ej ? baseDe(ej, tr, c.base) : 0;
  const bases = S.tienda.escalas_activas && S.prods.some(p => { const t = tramos(p); return t && !t.unico; });
  r.innerHTML = `<div class="modal-bg" data-act="rev-bg"><div class="modal rev-m" role="dialog" aria-modal="true" aria-labelledby="rev-t">
    <div class="view-title" id="rev-t" style="margin-bottom:4px">📥 Lista de precios en PDF</div>
    <button type="button" class="btn btn-s" style="width:100%" data-act="rev-oficial">Descargar con los precios de ${esc(S.tienda.nombre)}</button>
    <div class="rev-sep"><span>o</span></div>
    <div class="rev-box"><b>💼 Soy revendedor</b><p class="muted">Armá tu propia lista para tus clientes: con tu ganancia sumada, tu nombre y tu WhatsApp. No aparece el nombre de ${esc(S.tienda.nombre)}.</p>
    ${bases ? `<div class="flabel">Tu precio de compra</div><div class="rev-ch" role="group" aria-label="Tu precio de compra">${[1, 3, 6, 12].map(n => `<button type="button" class="chipf${c.base === n ? ' on' : ''}" data-act="rev-base" data-n="${n}" aria-pressed="${c.base === n}">x${n}${n === 12 ? '+' : ''}</button>`).join('')}</div>` : ''}
    <label class="flabel" for="rev-pct">Tu ganancia (%)</label><div class="rev-ch"><input id="rev-pct" class="fi rev-pct" type="number" inputmode="numeric" min="0" max="500" step="1" value="${c.pct}" data-change="rev-pct">${[30, 50, 80].map(n => `<button type="button" class="chipf${c.pct === n ? ' on' : ''}" data-act="rev-p" data-n="${n}">+${n}%</button>`).join('')}</div>
    <label class="flabel" for="rev-nom">Tu nombre o el de tu negocio</label><input id="rev-nom" class="fi" maxlength="60" value="${esc(c.nombre)}" placeholder="Ej: Cosmética Sofi" data-change="rev-nom">
    <label class="flabel" for="rev-wsp">Tu WhatsApp (opcional)</label><input id="rev-wsp" class="fi" inputmode="tel" maxlength="30" value="${esc(c.wsp)}" placeholder="Ej: 11 2345 6789" data-change="rev-wsp">
    ${ej ? `<div class="rev-ej" id="rev-ej">Ejemplo · ${esc(ej.nombre)}: lo comprás a <b>${fmt(u)}</b> y en tu lista sale <b>${fmt(redondeo(u, c.pct))}</b> <small class="muted">(redondeado a $100)</small></div>` : ''}
    <button type="button" class="btn btn-p" style="width:100%;margin-top:10px" data-act="rev-gen">💼 Generar mi lista en PDF</button></div>
    <button type="button" class="btn btn-s" style="margin-top:8px;width:100%" data-act="rev-x">Cerrar</button></div></div>`;
}
function revGuardar() { if (S.rev) store.set('rev:' + S.slug, S.rev); }
function revLeer() { const v = id => { const e = $('#' + id); return e ? e.value : null; }; if (!S.rev) return; const pc = v('rev-pct'); if (pc !== null) S.rev.pct = Math.max(0, Math.min(500, Math.round(+pc || 0))); const n = v('rev-nom'); if (n !== null) S.rev.nombre = n.trim().slice(0, 60); const w = v('rev-wsp'); if (w !== null) S.rev.wsp = w.trim().slice(0, 30); }
function revRepintar(foco) { revLeer(); revGuardar(); pintarRev(); const e = foco && $('#' + foco); if (e) { e.focus(); try { const n = e.value.length; e.setSelectionRange && e.type !== 'number' && e.setSelectionRange(n, n); } catch { /* */ } } }
on('st-pdf', () => { if (!revOk()) return pdfOficial(); S.rev = revCfg(); pintarRev(); const b = $('#rev-root [data-act="rev-oficial"]'); if (b) b.focus(); });
on('rev-oficial', () => { S.rev = null; pintarRev(); pdfOficial(); });
on('rev-base', d => { revLeer(); S.rev.base = +d.n; revRepintar(); });
on('rev-p', d => { revLeer(); S.rev.pct = +d.n; revGuardar(); pintarRev(); });
on('rev-pct', () => revRepintar('rev-pct'));
on('rev-nom', () => { revLeer(); revGuardar(); });
on('rev-wsp', () => { revLeer(); revGuardar(); });
on('rev-gen', () => {
  revLeer(); revGuardar(); const c = S.rev;
  const grupos = gruposPdf((p, tr) => redondeo(baseDe(p, tr, c.base), c.pct), false);
  S.rev = null; pintarRev();
  imprimir(htmlCatalogo({ nombre: c.nombre || 'Lista de precios', logo: '', color: '#334155', eslogan: c.wsp ? 'Pedidos por WhatsApp: ' + c.wsp : '', titulo: 'Lista de precios', grupos, conStock: false, conSku: false, nota: NOTA_PDF }));
});
on('rev-x', () => { S.rev = null; pintarRev(); });
on('rev-bg', (d, b, e) => { if (e.target === b) { S.rev = null; pintarRev(); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.rev) { S.rev = null; pintarRev(); } });
// el ejemplo se actualiza mientras escribe el %, sin repintar (así no pierde el foco)
document.addEventListener('input', e => {
  if (!S.rev || !e.target || e.target.id !== 'rev-pct') return;
  const pct = Math.max(0, Math.min(500, Math.round(+e.target.value || 0))), ej = S.prods.find(p => !p.agotado && tramos(p)) || S.prods.find(p => !p.agotado), box = $('#rev-ej'); if (!ej || !box) return;
  const bs = box.querySelectorAll('b'); if (bs[1]) bs[1].textContent = fmt(redondeo(baseDe(ej, tramos(ej), S.rev.base), pct));
  document.querySelectorAll('#rev-root [data-act="rev-p"]').forEach(b => b.classList.toggle('on', +b.dataset.n === pct));
});
