// Panel del comerciante (shell + productos + pedidos + carritos). Los demás módulos viven en archivos propios.
import { api } from './api.js';
import { $, esc, fmt, on, toast, copiar, normWsp, waLink, store, confirmar } from './util.js';
import { P, can, aviso, planEf, PLAN_NOMBRE, precioArs } from './state.js';
import { vistaResumen } from './dash.js';
import { vistaImportar, resetImp } from './imp_ui.js';
import { vistaCatalogo } from './catalogo.js';
import { vistaPrecios } from './precios.js';
import { vistaEquipo } from './equipo.js';
import { vistaTienda, vistaAjustes, resetAj } from './ajustes.js';
import { redimensionar } from './img.js';
import { vistaPedidos, modalPedido, resetPed } from './pedidos.js';
import { vistaResultado, cargarGastos, resetRes } from './resultado.js';
import { vistaEnviosDiseno, resetDis } from './diseno.js';
import { vistaInteligente, avisosInteligentes, resetInt } from './inteligencia.js';
import { guiaHtml, ayudaHtml } from './guia.js';
import { urlTiendaDe } from './marca.js';
import { planesHtml, avisoPlan } from './planes.js';
import { demoPendienteHtml, filasDemo, descartarDemo } from './demo.js';
import { abrirFlyer } from './flyer.js';
import { recepcionModal } from './recepcion.js';
import { cierreCard } from './cierre.js';
import { activarApp, instalarHtml } from './instalar.js';
import { vistaProductos, setAyudas, modalMasivo, modalBorrar, resetProd, limpiarSel } from './productos.js';
import { vistaAdmin, resetAdmin, esAdmin, chipPlan, sugerirHtml } from './fundadores.js';

const Q = { q: '', lim: 60, filtro: 'todos', pq: '', stop: null, fly: null };
let salirFn = () => { };
export const setSalir = f => { salirFn = f; };
const urlTienda = () => urlTiendaDe(P.t.slug);
const TABS_BASE = [['resumen', '📊 Resumen'], ['productos', '📦 Productos'], ['pedidos', '🧾 Pedidos'], ['asistente', '🧠 Asistente'], ['precios', '💹 Precios'], ['resultado', '💰 Resultado'], ['equipo', '🤝 Revendedores'], ['carritos', '🛒 Carritos'], ['tienda', '🎨 Tienda'], ['ajustes', '⚙️ Ajustes']];
const TABS_ADMIN = [['admin', '🛡️ Admin']];
const tabs = () => P.esAdmin ? TABS_BASE.concat(TABS_ADMIN) : TABS_BASE;
const nuevos = () => P.pedidos.some(o => (o.etapa || 'nuevo') === 'nuevo' && o.estado !== 'cancelado');

export async function mostrarPanel(app) {
  app.innerHTML = '<div class="page center" style="padding-top:80px"><span class="spin"></span></div>';
  try { P.t = await api.miTienda(); } catch (e) { app.innerHTML = `<div class="page"><div class="err-box">${esc(e.message)}</div></div>`; return; }
  if (!P.t) return 'sin-tienda';
  activarApp();
  P.esAdmin = await esAdmin(); resetAdmin();
  Object.assign(P, { tab: 'resumen', modal: null }); Object.assign(Q, { q: '', lim: 60, filtro: 'todos', pq: '' }); resetProd(); resetAj(); resetImp(); resetPed(); resetRes(); resetDis(); resetInt(); P.gastos = [];
  P.repintar = pintar; P.recargarPedidos = recargarPedidos; P.flyerDe = flyerDe; Q.fly = null;
  setAyudas({ precioDe: p => { const pr = preciosDe(p.costo_usd, p.margen_override); return precioFinal(p, P.t.modalidad === 'mayorista' ? pr[1] : pr.min); }, flyerDe, fila: filaProd, abrirCombo });
  await cargar();
  if (Q.stop) Q.stop();
  Q.stop = api.escucharPedidos(P.t.id, async () => { toast('🔔 Pedido nuevo'); await recargarPedidos(); if (P.modal || document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { Q.pendiente = true; return; } pintar(); });
  pintar();
}
async function cargar() {
  const r = await Promise.allSettled([api.misProductos(), api.pedidosTodos(), api.itemsTodos(), api.misCarritos(), api.misRevendedores(), api.misProveedores()]);
  [P.prods, P.pedidos, P.items, P.carritos, P.revs, P.provs] = r.map(x => x.value || []);
  const f = r.find(x => x.status === 'rejected'); if (f) toast(f.reason.message);
}
async function recargarPedidos() { try { [P.pedidos, P.items] = await Promise.all([api.pedidosTodos(), api.itemsTodos()]); P.t = await api.miTienda() || P.t; P.prods = await api.misProductos(); } catch (e) { } }

function pintar() {
  const t = P.t, dias = t.trial_ends_at ? Math.ceil((new Date(t.trial_ends_at) - Date.now()) / 864e5) : 0;
  const cuerpo = { resumen: () => demoPendienteHtml() + guiaHtml(urlTienda()) + avisosInteligentes() + vistaResumen(urlTienda()), asistente: vistaInteligente, productos, pedidos: vistaPedidos, resultado: vistaResultado, precios: vistaPrecios, equipo: vistaEquipo, carritos, tienda: () => vistaTienda() + cierreCard() + vistaEnviosDiseno(), ajustes: () => vistaAjustes() + instalarHtml(), admin: () => P.esAdmin ? vistaAdmin() : vistaResumen(urlTienda()) }[P.tab]();
  const y = window.scrollY, foco = document.activeElement && document.activeElement.id;
  $('#root').innerHTML = `<div id="app"><div id="hdr"><div style="display:flex;gap:8px;align-items:center;min-width:0">${t.logo_url ? `<img src="${esc(t.logo_url)}" alt="" style="height:26px;border-radius:6px">` : ''}<b style="font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.nombre)}</b></div><div style="display:flex;gap:6px;align-items:center"><button class="chip chip-btn" data-act="p-planes" title="Ver planes">${esc(chipPlan(t))}</button><button class="btn btn-s btn-sm" data-act="p-salir">Salir</button></div></div>
    <div class="tabs-panel" role="tablist">${tabs().map(([k, n]) => `<button class="ptab ${P.tab === k ? 'on' : ''}" role="tab" data-act="p-tab" data-k="${k}">${n}${k === 'pedidos' && nuevos() ? ' •' : ''}</button>`).join('')}</div>
    <div class="page wide" style="padding-top:16px">${avisoPlan()}${cuerpo}</div>${navMovil()}<button id="ayuda-fab" data-act="p-ayuda" aria-label="Ayuda">💬 <span>Ayuda</span></button></div>${P.modal ? modal() : ''}`;
  if (foco) { const n = document.getElementById(foco); if (n && n.focus) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (e) { } } }
}

const NAV = [['resumen', '📊', 'Inicio'], ['productos', '📦', 'Productos'], ['pedidos', '🧾', 'Pedidos'], ['tienda', '🎨', 'Tienda']];
const MAS = [['asistente', '🧠', 'Asistente', 'Cobranzas, reposición y ventas en dólares'], ['resultado', '💰', 'Resultado y gastos', 'Ganancia neta, gastos, compras y stock'], ['precios', '💹', 'Precios inteligentes', 'Proveedores, mercado y ajuste masivo'], ['equipo', '🤝', 'Revendedores', 'Enlaces con comisión'], ['carritos', '🛒', 'Carritos sin cerrar', 'Recontactá por WhatsApp'], ['ajustes', '⚙️', 'Ajustes', 'Precios, cobro, accesos, integraciones y plan']];
function navMovil() {
  const pend = nuevos(), enMas = MAS.some(m => m[0] === P.tab) || P.tab === 'admin';
  return `<nav id="pnav" aria-label="Secciones">${NAV.map(([k, i, n]) => `<button class="${P.tab === k ? 'on' : ''}" data-act="p-tab" data-k="${k}"${P.tab === k ? ' aria-current="page"' : ''}><span class="i">${i}</span>${n}${k === 'pedidos' && pend ? '<span class="dot" aria-label="hay pedidos nuevos"></span>' : ''}</button>`).join('')}<button class="${enMas ? 'on' : ''}" data-act="p-menu"><span class="i">☰</span>Más</button></nav>`;
}
function menuMas() {
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="Más secciones"><div class="view-title">Más</div><div class="menu-list">${MAS.map(([k, i, n, d]) => `<button data-act="p-tab" data-k="${k}"><span class="i">${i}</span><span>${n}<small>${d}</small></span></button>`).join('')}
    ${P.esAdmin ? '<button data-act="p-tab" data-k="admin"><span class="i">🛡️</span><span>Admin<small>Tiendas, pruebas, fundadores y sugerencias</small></span></button>' : ''}
    <button data-act="p-ayuda"><span class="i">💬</span><span>Ayuda<small>Buscá una solución o escribinos</small></span></button>
    <button data-act="p-sugerir"><span class="i">💡</span><span>Sugerir una mejora<small>Contanos qué te falta</small></span></button>
    <button data-act="p-ver-tienda"><span class="i">👀</span><span>Ver mi tienda<small>Como la ven tus clientes</small></span></button>
    <button data-act="p-salir"><span class="i">🚪</span><span>Salir<small>Cerrar sesión en este dispositivo</small></span></button></div>
    <button class="btn btn-s" style="margin-top:12px" data-act="p-cerrar">Cerrar</button></div></div>`;
}
on('p-menu', () => { P.modal = { tipo: 'mas' }; pintar(); });
on('dm-descartar', () => { descartarDemo(); pintar(); });
on('dm-cargar', async (d, b) => {
  b.disabled = true;
  try { const f = filasDemo(P.t); if (f.length) await api.insertarProductos(f); descartarDemo(); P.prods = await api.misProductos(); toast(f.length + ' productos cargados'); P.tab = 'productos'; pintar(); }
  catch (e) { b.disabled = false; toast(e.message); }
});
on('p-ver-tienda', () => { window.open(urlTienda(), '_blank', 'noopener'); });

/* ---------- productos ---------- */
function productos() {
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn btn-p btn-sm" data-act="p-nuevo">+ Producto</button><button class="btn btn-s btn-sm" data-act="p-importar">📥 Cargar o actualizar lista</button><button class="btn btn-s btn-sm" data-act="p-catalogo">📄 Catálogo PDF</button><button class="btn btn-s btn-sm${Q.fly ? ' on' : ''}" data-act="pf-modo" id="pf-modo">📸 Crear flyer</button></div>
  ${Q.fly ? `<div class="pf-bar" id="pf-bar"><span>${Q.fly.length ? `<b>${Q.fly.length}</b> ${Q.fly.length === 1 ? 'producto elegido' : 'productos elegidos'} (hasta 4)` : 'Tocá de 1 a 4 productos para tu flyer'}</span><button class="btn btn-p btn-sm" data-act="pf-crear" ${Q.fly.length ? '' : 'disabled'}>📸 Armar flyer</button><button class="btn btn-s btn-sm" data-act="pf-modo">Cancelar</button></div>` : ''}
  ${vistaProductos(!!Q.fly)}`;
}
const usd = n => 'USD ' + (Math.round(Number(n) * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 });
// Precios que ve el comprador (mismo cálculo que el servidor; el pedido siempre lo recalcula la base).
function preciosDe(costo, ovr) {
  const t = P.t, c = Number(costo) || 0, sh = ovr == null || ovr === '' ? 0 : Number(ovr) - Number(t.margen_1);
  const m1 = ovr == null || ovr === '' ? Number(t.margen_1) : Number(ovr);
  return { min: precioArs(c, t.cotizacion_usd, m1), 1: precioArs(c, t.cotizacion_usd, Math.max(0, Number(t.margen_1) + sh)), 3: precioArs(c, t.cotizacion_usd, Math.max(0, Number(t.margen_3) + sh)), 6: precioArs(c, t.cotizacion_usd, Math.max(0, Number(t.margen_6) + sh)), 12: precioArs(c, t.cotizacion_usd, Math.max(0, Number(t.margen_12) + sh)) };
}
// mismo cálculo que la base: primero el descuento del combo y después la oferta vigente (redondeado a $10)
const conDesc = (x, pct) => !(Number(pct) > 0) || x == null ? x : Math.ceil(x * (1 - Math.min(90, Number(pct)) / 100) / 10) * 10;
const ofertaVig = p => Number(p.oferta_pct) > 0 && (!p.oferta_desde || new Date(p.oferta_desde) <= new Date()) && (!p.oferta_hasta || new Date(p.oferta_hasta) > new Date()) ? Number(p.oferta_pct) : 0;
const precioFinal = (p, x) => conDesc(conDesc(x, p.combo_desc), ofertaVig(p));
const hayV216 = () => (P.prods || []).some(p => 'oferta_pct' in p);
const diaLocal = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('sv'); };
const finDia = v => v ? new Date(v + 'T23:59:59').toISOString() : null, inicioDia = v => v ? new Date(v + 'T00:00:00').toISOString() : null;
const UNIDADES_P = [['unidad', 'Unidad'], ['par', 'Par'], ['docena', 'Docena'], ['pack', 'Pack'], ['bulto', 'Bulto'], ['caja', 'Caja'], ['display', 'Display'], ['kg', 'Kilo (kg)'], ['gramos', 'Gramos'], ['litro', 'Litro'], ['metro', 'Metro']];
function filaProd(p, extra) {
  const pr0 = preciosDe(p.costo_usd, p.margen_override), may = P.t.modalidad !== 'minorista', pr = {};
  Object.keys(pr0).forEach(k => { pr[k] = precioFinal(p, pr0[k]); });
  const of = Number(p.oferta_pct) > 0 ? (ofertaVig(p) ? `🏷️ -${Math.round(p.oferta_pct)}% hasta ${new Date(p.oferta_hasta).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })}` : p.oferta_desde && new Date(p.oferta_desde) > new Date() ? `🏷️ -${Math.round(p.oferta_pct)}% desde ${new Date(p.oferta_desde).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' })}` : '') : '';
  const det = [Array.isArray(p.combo) && p.combo.length ? `🧩 combo de ${p.combo.reduce((a, c) => a + (+c.cant || 0), 0)} u.` : '', of, p.categoria, p.unidad && p.unidad !== 'unidad' ? 'por ' + p.unidad + (p.contenido ? ' x' + p.contenido : '') : '', p.precio_unico ? 'precio único' : '', P.t.modo_stock === 'mixto' && p.a_pedido ? 'por encargo' : '', usd(p.costo_usd), p.margen_override != null ? 'margen propio ' + Math.round(p.margen_override * 100) + '%' : '', p.stock != null ? (p.stock > 0 ? 'stock ' + p.stock : 'sin stock') : '', p.activo ? '' : 'oculto'].filter(Boolean).join(' · ');
  const sel = Q.fly && Q.fly.includes(p.id);
  return `<div class="prow${p.activo ? '' : ' off'}${sel ? ' sel' : ''}" data-act="${Q.fly ? 'pf-sel' : 'p-editar'}" data-id="${p.id}" role="button" tabindex="0" aria-label="${Q.fly ? 'Elegir' : 'Editar'} ${esc(p.nombre)}"${Q.fly ? ` aria-pressed="${!!sel}"` : ''}>
    ${Q.fly ? `<span class="pf-chk" aria-hidden="true">${sel ? '✓' : ''}</span>` : ''}<span class="th">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="" loading="lazy">` : esc(p.emoji)}</span>
    <span style="min-width:0"><div class="nm">${esc(p.nombre)}</div><div class="ds">${esc(det)}</div>${extra || ''}</span>
    <span class="pr">${fmt(P.t.modalidad === 'mayorista' ? pr[1] : pr.min)}${may ? `<small>x12: ${fmt(pr[12])}</small>` : ''}</span></div>`;
}
/* ---------- flyers del comercio (con su marca) ---------- */
// Los precios que se estampan dependen de cómo vende la tienda: mayorista/híbrida → escalas; minorista → un solo precio.
function itemFlyer(p) {
  const b = preciosDe(p.costo_usd, p.margen_override), m = P.t.modalidad, may = m !== 'minorista', pr = {}; Object.keys(b).forEach(k => { pr[k] = precioFinal(p, b[k]); });
  const base = m === 'mayorista' ? b[1] : b.min, precio = m === 'mayorista' ? pr[1] : pr.min;
  return { nombre: p.nombre, categoria: p.categoria, img: p.imagen_url || '', emoji: p.emoji, precio, antes: precio < base ? base : 0, pct: Math.round(ofertaVig(p) || 0),
    escalas: may && !p.precio_unico ? { 1: pr[1], 3: pr[3], 6: pr[6], 12: pr[12] } : null, min: m === 'hibrido' ? pr.min : 0 };
}
const encargoP = p => P.t.modo_stock === 'encargo' || (P.t.modo_stock === 'mixto' && !!p.a_pedido);
function flyerDe(ids, badge) {
  const L = ids.map(id => P.prods.find(p => p.id === id)).filter(Boolean).slice(0, 4); if (!L.length) { toast('Elegí al menos un producto'); return; }
  const t = P.t;
  abrirFlyer({ modo: 'comercio', items: L.map(itemFlyer), badge: badge || (L.every(p => ofertaVig(p)) ? '⚡ Oferta' : L.every(encargoP) ? '📦 Por Encargo' : '🔥 En Stock'),
    marca: { nombre: t.nombre, logo: t.logo_url || '', color: t.color, url: urlTienda().replace(/^https?:\/\//, '').replace(/\/$/, ''), wsp: '+' + t.whatsapp } });
}
on('pf-modo', () => { Q.fly = Q.fly ? null : []; pintar(); });
on('pf-sel', d => { if (!Q.fly) return; const i = Q.fly.indexOf(d.id); if (i >= 0) Q.fly.splice(i, 1); else if (Q.fly.length >= 4) { toast('Un flyer lleva hasta 4 productos'); return; } else Q.fly.push(d.id); pintar(); });
on('pf-crear', () => { if (Q.fly && Q.fly.length) flyerDe(Q.fly); });

function carritos() {
  if (!can('carritos')) return '<div class="locked"><b>🛒 Carritos abandonados</b><p style="margin:6px 0">Recontactá por WhatsApp a quienes dejaron productos sin comprar.</p><span class="tag warn">🔒 Plan Mayorista Pro</span><br><button class="btn btn-p btn-sm lock-cta" data-act="p-planes" data-p="pro">Ver planes y activar</button></div>';
  return `<div class="card">${P.carritos.map(c => { const it = (c.items || []).map(i => `${esc(i.q)}× ${esc(i.n)}`).join(', '); const msg = `Hola ${c.nombre}, vimos que dejaste productos en tu carrito en ${P.t.nombre}. ¿Querés que te ayudemos a cerrar el pedido?`;
    return `<div class="srow" style="align-items:flex-start"><span>${esc(c.nombre)} · ${fmt(c.total_ars)}${c.recontactado ? ' <span class="tag ok">contactado</span>' : ''}<br><small class="muted">${it}</small></span><span style="display:flex;gap:6px"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" data-act="p-recont" data-id="${c.id}" href="${esc(waLink(normWsp(c.whatsapp), msg))}">WhatsApp</a><button class="btn btn-s btn-sm" data-act="p-delcar" data-id="${c.id}" aria-label="Descartar">✕</button></span></div>`; }).join('') || '<p class="muted">Sin carritos pendientes.</p>'}</div>`;
}

/* ---------- modales ---------- */
function modal() {
  const m = P.modal;
  if (m.tipo === 'mas') return menuMas();
  if (m.tipo === 'ayuda') return ayudaHtml();
  if (m.tipo === 'sugerir') return sugerirHtml();
  if (m.tipo === 'planes') return planesHtml(m);
  if (m.tipo === 'imp') return vistaImportar();
  if (m.tipo === 'cat') return vistaCatalogo();
  if (m.tipo === 'prod') {
    const p = m.p || {}, foto = m.foto !== undefined ? m.foto : p.imagen_url;
    if (!m.combo) m.combo = Array.isArray(p.combo) ? p.combo.map(c => ({ id: c.id, cant: +c.cant || 1 })) : [];
    return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal" role="dialog" aria-modal="true"><div class="view-title">${p.id ? 'Editar producto' : 'Nuevo producto'}</div><div id="mm"></div>
    <form data-submit="p-prod">
    <div class="fg"><label class="flabel">Nombre</label><input class="fi" name="nombre" value="${esc(p.nombre || '')}" maxlength="160" required></div>
    <div class="row2"><div class="fg"><label class="flabel">Categoría</label><input class="fi" name="categoria" value="${esc(p.categoria || 'General')}" maxlength="60" required></div><div class="fg"><label class="flabel">Código / SKU</label><input class="fi" name="sku" value="${esc(p.sku || '')}" maxlength="60"></div></div>
    <div class="row2"><div class="fg"><label class="flabel">Costo en USD</label><input class="fi" name="costo_usd" type="number" step="any" min="0" value="${p.costo_usd != null ? Number(p.costo_usd) : ''}" data-input="p-prev" required${(m.combo || []).length ? ' readonly title="En un combo, el costo es la suma de lo que trae"' : ''}></div><div class="fg"><label class="flabel">Marca</label><input class="fi" name="marca" value="${esc(p.marca || '')}" maxlength="60"></div></div>
    <div class="row2"><div class="fg"><label class="flabel">Se vende por</label><select class="fi" name="unidad" data-change="p-uni">${UNIDADES_P.map(([k, n]) => `<option value="${k}" ${(p.unidad || 'unidad') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="fg" id="p-cont" ${['pack', 'bulto', 'caja', 'display'].includes(p.unidad) ? '' : 'hidden'}><label class="flabel">Unidades que trae</label><input class="fi" name="contenido" type="number" min="1" max="100000" value="${p.contenido || ''}" placeholder="Ej: 12"></div></div>
    ${P.t.modalidad !== 'minorista' ? `<div class="fg"><label class="flabel"><input type="checkbox" name="precio_unico" ${p.precio_unico ? 'checked' : ''}> Precio único (sin descuento por cantidad x3 · x6 · x12)</label></div>` : ''}
    <div class="fg"><label class="flabel">Variantes (separadas por coma)</label><input class="fi" name="variantes" value="${esc((p.variantes || []).join(', '))}"></div>
    <div class="fg"><span class="flabel">Foto</span><div id="foto-box">${fotoHtml(foto)}</div></div>
    <div class="row2"><div class="fg"><label class="flabel">Emoji (si no hay foto)</label><input class="fi" name="emoji" value="${esc(p.emoji || '📦')}" maxlength="4"></div><div class="fg"><label class="flabel">Stock (vacío = sin control)${aviso('stock')}</label><input class="fi" name="stock" type="number" min="0" value="${p.stock != null ? p.stock : ''}"${(m.combo || []).length ? ' disabled title="El stock de un combo sale de lo que trae"' : ''}></div></div>
    <div class="fg"><label class="flabel">Margen propio % para este producto (vacío = el general)</label><input class="fi" name="margen_propio" type="number" min="0" max="900" step="any" value="${p.margen_override != null ? Math.round(Number(p.margen_override) * 10000) / 100 : ''}" data-input="p-prev" placeholder="General: ${Math.round(Number(P.t.margen_1) * 100)}%"></div>
    ${(P.t.modo_stock || 'stock') !== 'stock' ? `<div class="fg">${P.t.modo_stock === 'mixto' ? `<label class="flabel"><input type="checkbox" name="a_pedido" ${p.a_pedido ? 'checked' : ''}> Por encargo (no lo tengo en stock: lo compro cuando me lo piden)</label>` : '<div class="hint">Tu tienda trabaja por encargo: este producto se vende aunque no tengas stock.</div>'}
      <label class="flabel" for="p-dem" style="margin-top:6px">Demora propia en días (vacío = ${Number(P.t.demora_encargo || 7)})</label><input class="fi" id="p-dem" name="demora_dias" type="number" min="1" max="120" value="${p.demora_dias || ''}"></div>` : ''}
    ${P.t.modalidad !== 'minorista' ? `<div class="fg"><label class="flabel" for="p-pvp">Precio sugerido de venta al público $ (opcional)</label><input class="fi" id="p-pvp" name="pvp_sugerido" type="number" min="0" step="any" value="${p.pvp_sugerido != null ? Number(p.pvp_sugerido) : ''}" placeholder="Vacío = lo calcula la app"><div class="hint">Es a cuánto puede venderlo tu cliente revendedor. Se usa en “Tu ganancia” (Tienda → Reglas).</div></div>` : ''}
    <div class="flabel">Así lo ve tu cliente</div><div class="pprev" id="pprev">${prevHtml(p.costo_usd, p.margen_override)}</div>
    <div class="fg"><label class="flabel">Descripción</label><textarea class="fi" name="descripcion" rows="2" maxlength="2000">${esc(p.descripcion || '')}</textarea></div>
    ${hayV216() ? `<details class="pm-sec"${Number(p.oferta_pct) > 0 ? ' open' : ''}><summary>🏷️ Oferta con fechas</summary>
      <div class="row2"><div class="fg"><label class="flabel" for="p-ofp">Descuento %</label><input class="fi" id="p-ofp" name="oferta_pct" type="number" min="1" max="90" step="any" value="${Number(p.oferta_pct) > 0 ? Number(p.oferta_pct) : ''}" placeholder="Ej: 15" data-input="p-cb-prev"></div>
      <div class="fg"><label class="flabel" for="p-ofh">Hasta el (incluido)</label><input class="fi" id="p-ofh" name="oferta_hasta" type="date" value="${diaLocal(p.oferta_hasta)}"></div></div>
      <div class="fg"><label class="flabel" for="p-ofd">Desde el (vacío = ya)</label><input class="fi" id="p-ofd" name="oferta_desde" type="date" value="${diaLocal(p.oferta_desde)}"></div>
      <div class="hint">Mientras dure, la tienda muestra el precio tachado y la etiqueta -%. Al terminar vuelve sola al precio normal. Vacío = sin oferta.</div></details>
    <details class="pm-sec" id="pm-cb"${(m.combo || []).length ? ' open' : ''}><summary>🧩 Combo: este producto trae otros</summary><div id="p-cb">${comboHtml()}</div></details>` : ''}
    <div class="fg"><label class="flabel"><input type="checkbox" name="activo" ${p.activo === false ? '' : 'checked'}> Visible en la tienda</label></div>
    <button class="btn btn-p" type="submit">Guardar</button>${p.id ? '<button type="button" class="btn btn-s" style="margin-top:8px;color:var(--red)" data-act="p-borrar" data-id="' + p.id + '">Eliminar producto</button>' : ''}<button type="button" class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cancelar</button></form></div></div>`;
  }
  if (m.tipo === 'masivo') return modalMasivo(m);
  if (m.tipo === 'borrar-masivo') return modalBorrar();
  if (m.tipo === 'ped') return modalPedido(m);
  if (m.tipo === 'rec') return recepcionModal();
  return '';
}
function prevHtml(costo, ovr) {
  if (!(Number(costo) > 0)) return '<div style="grid-column:1/-1"><small>Cargá el costo para ver los precios</small></div>';
  const pr = preciosDe(costo, ovr);
  if (P.t.modalidad === 'minorista') return `<div style="grid-column:1/-1"><small>Precio de venta</small><b>${fmt(pr.min)}</b></div>`;
  return [1, 3, 6, 12].map(n => `<div><small>x${n}${n === 12 ? '+' : ''}</small><b>${fmt(pr[n])}</b></div>`).join('') + (P.t.modalidad === 'hibrido' ? `<div style="grid-column:1/-1"><small>Minorista (público)</small><b>${fmt(pr.min)}</b></div>` : '');
}
const fotoHtml = foto => `${foto ? `<img src="${esc(foto)}" alt="Foto actual" style="height:84px;border-radius:10px;display:block;margin-bottom:8px">` : ''}<label class="filebtn">📷 ${foto ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/*" data-change="p-foto"></label>${foto ? ' <button type="button" class="btn btn-s btn-sm" data-act="p-nofoto">Quitar</button>' : ''}<div class="hint" style="margin-top:4px">La achicamos automáticamente para que cargue rápido.</div>`;
// ---- combo: qué trae, cuántos de cada uno, descuento y cómo queda el precio ----
const cbProd = id => (P.prods || []).find(p => p.id === id);
const precioX1 = p => { const pr = preciosDe(p.costo_usd, p.margen_override); return precioFinal(p, P.t.modalidad === 'mayorista' ? pr[1] : pr.min); };
function comboPrev() {
  const L = (P.modal && P.modal.combo || []).map(c => ({ p: cbProd(c.id), c })).filter(x => x.p); if (!L.length) return '';
  const f = document.querySelector('form[data-submit=p-prod]'), desc = f && f.combo_desc ? Number(f.combo_desc.value) || 0 : Number((P.modal.p || {}).combo_desc) || 0;
  const sep = L.reduce((a, x) => a + precioX1(x.p) * x.c.cant, 0), costo = L.reduce((a, x) => a + Number(x.p.costo_usd) * x.c.cant, 0);
  const pr = preciosDe(costo, null), base = P.t.modalidad === 'mayorista' ? pr[1] : pr.min, combo = conDesc(base, desc);
  return `<div class="cb-prev"><span>Por separado: <s>${fmt(sep)}</s></span><span>Combo: <b>${fmt(combo)}</b>${sep > combo ? ` <small>(ahorran ${fmt(sep - combo)})</small>` : ''}</span></div>`;
}
function comboHtml() {
  const m = P.modal || {}, L = m.combo || [], q = (m.cbq || '').toLowerCase().trim(), yo = (m.p || {}).id;
  const res = q ? (P.prods || []).filter(p => p.id !== yo && !(Array.isArray(p.combo) && p.combo.length) && !L.some(c => c.id === p.id) && [p.nombre, p.sku, p.categoria].join(' ').toLowerCase().includes(q)).slice(0, 6) : [];
  return `<p class="hint" style="margin-bottom:6px">Armalo con productos que ya tenés. El costo y el stock salen de lo que trae: al vender un combo se descuenta el stock de cada producto.</p>
    ${L.map((c, i) => { const p = cbProd(c.id); return `<div class="cb-it"><span class="cb-n">${esc(p ? p.nombre : 'Producto borrado')}</span><input class="fi cb-q" type="number" min="1" max="99" value="${c.cant}" data-input="p-cb-cant" data-i="${i}" aria-label="Cantidad de ${esc(p ? p.nombre : '')}"><button type="button" class="btn btn-s btn-sm" data-act="p-cb-del" data-i="${i}" aria-label="Quitar">✕</button></div>`; }).join('')}
    ${L.length < 10 ? `<input class="fi" id="p-cbq" data-input="p-cb-q" placeholder="Buscar producto para sumar al combo…" value="${esc(m.cbq || '')}" autocomplete="off" aria-label="Buscar producto para el combo">
      <div class="dz-vt-res" id="p-cb-res">${res.map(p => `<button type="button" data-act="p-cb-add" data-id="${p.id}">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="">` : `<span>${esc(p.emoji || '📦')}</span>`}<span>${esc(p.nombre)}</span></button>`).join('')}</div>` : ''}
    ${L.length ? `<div class="fg" style="margin-top:8px"><label class="flabel" for="p-cbd">Descuento del combo % (frente a comprarlos por separado)</label><input class="fi" id="p-cbd" name="combo_desc" type="number" min="0" max="90" step="any" value="${Number((m.p || {}).combo_desc) || ''}" placeholder="Ej: 10" data-input="p-cb-prev"></div><div id="p-cb-pv">${comboPrev()}</div>` : ''}`;
}
function pintarCombo() {
  const b = $('#p-cb'); if (!b) return; b.innerHTML = comboHtml();
  const f = document.querySelector('form[data-submit=p-prod]'), L = (P.modal.combo || []).map(c => ({ p: cbProd(c.id), c })).filter(x => x.p);
  if (f && f.costo_usd) { f.costo_usd.readOnly = L.length > 0; if (L.length) { f.costo_usd.value = Math.round(L.reduce((a, x) => a + Number(x.p.costo_usd) * x.c.cant, 0) * 10000) / 10000; } }
  if (f && f.stock) { f.stock.disabled = L.length > 0; if (L.length) f.stock.value = ''; }
}
on('p-cb-q', (d, el) => { P.modal.cbq = el.value; const pos = el.selectionStart; pintarCombo(); const i = $('#p-cbq'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (e) { } } });
on('p-cb-add', d => { const L = P.modal.combo = P.modal.combo || []; if (L.length < 10 && !L.some(c => c.id === d.id)) L.push({ id: d.id, cant: 1 }); P.modal.cbq = ''; pintarCombo(); const i = $('#p-cbq'); if (i) i.focus(); });
on('p-cb-del', d => { (P.modal.combo || []).splice(+d.i, 1); pintarCombo(); });
on('p-cb-cant', (d, el) => { const c = (P.modal.combo || [])[+d.i]; if (c) { c.cant = Math.max(1, Math.min(99, Math.floor(Number(el.value) || 1))); const v = $('#p-cb-pv'); if (v) v.innerHTML = comboPrev(); const f = document.querySelector('form[data-submit=p-prod]'); if (f && f.costo_usd && f.costo_usd.readOnly) pintarCombo(); } });
on('p-cb-prev', () => { const v = $('#p-cb-pv'); if (v) v.innerHTML = comboPrev(); });
// desde la lista: "Armar combo" con los productos seleccionados
function abrirCombo(ids) {
  const L = ids.map(cbProd).filter(p => p && !(Array.isArray(p.combo) && p.combo.length)).slice(0, 10);
  if (L.length < 2) { toast('Elegí al menos 2 productos (que no sean combos) para armar un combo'); return; }
  const nombre = ('Combo ' + L.map(p => p.nombre.split(' ').slice(0, 3).join(' ')).join(' + ')).slice(0, 160);
  P.modal = { tipo: 'prod', p: { nombre, categoria: L[0].categoria, emoji: '🧩', activo: true, combo_desc: 10, imagen_url: L.find(p => p.imagen_url) ? L.find(p => p.imagen_url).imagen_url : null }, combo: L.map(p => ({ id: p.id, cant: 1 })) };
  pintar(); pintarCombo(); const d = $('#pm-cb'); if (d) { d.open = true; d.scrollIntoView({ block: 'nearest' }); }
}
const mm = (t, ok) => { const e = $('#mm'); if (e) e.innerHTML = `<div class="${ok ? 'ok-box' : 'err-box'}">${esc(t)}</div>`; };

/* ---------- acciones ---------- */
on('p-tab', async d => { if (d.k !== P.tab) limpiarSel(); P.tab = d.k; P.modal = null; Q.q = ''; Q.pq = ''; if (d.k === 'resultado') await cargarGastos(); pintar(); window.scrollTo(0, 0); });
on('p-salir', async () => { if (Q.stop) Q.stop(); Q.stop = null; await api.salir(); salirFn(); });
on('p-copiar', d => copiar(d.v));
on('p-cerrar', () => { P.modal = null; Q.pendiente = false; pintar(); });
on('p-cerrar-bg', (d, b, e) => { if (e.target === b) { P.modal = null; pintar(); } });
on('p-nuevo', () => { P.modal = { tipo: 'prod', p: null }; pintar(); });
on('p-editar', d => { P.modal = { tipo: 'prod', p: P.prods.find(p => p.id === d.id) }; pintar(); });
on('p-importar', () => { resetImp(); P.modal = { tipo: 'imp' }; pintar(); });
on('p-catalogo', () => { P.modal = { tipo: 'cat' }; pintar(); });
on('p-pedido', async d => {
  const o = P.pedidos.find(x => x.id === d.id); if (!o) return;
  try { const items = P.items.filter(i => i.order_id === o.id); P.modal = { tipo: 'ped', o, items: items.length ? items : await api.itemsPedido(o.id) }; pintar(); } catch (e) { toast(e.message); }
});
on('p-estado', async (d, b) => {
  if (d.e === 'cancelado' && !confirmar(b, '¿Cancelar el pedido? Tocá de nuevo')) return;
  try {
    await api.estadoPedido(d.id, d.e); await recargarPedidos();
    const o = P.pedidos.find(x => x.id === d.id);
    if (o && P.modal && P.modal.tipo === 'ped') P.modal = Object.assign({}, P.modal, { o, avisar: null }); else P.modal = null;
    pintar(); toast(d.e === 'cobrado' ? 'Cobro registrado' : 'Pedido actualizado');
  } catch (e) { mm(e.message); }
});
on('p-foto', async (d, el) => {
  try { const f = el.files[0]; if (!f) return; const box = $('#foto-box'); if (box) box.insertAdjacentHTML('afterbegin', '<p class="hint" id="foto-sub"><span class="spin"></span> Subiendo…</p>'); const b = await redimensionar(f, 900); P.modal.foto = await api.subirFoto(P.t.id, b, (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()))); const bx = $('#foto-box'); if (bx) bx.innerHTML = fotoHtml(P.modal.foto); } catch (e) { const s2 = $('#foto-sub'); if (s2) s2.remove(); mm(e.message); }
});
on('p-nofoto', () => { P.modal.foto = null; const bx = $('#foto-box'); if (bx) bx.innerHTML = fotoHtml(null); });
on('p-prev', () => { const f = document.querySelector('form[data-submit=p-prod]'), bx = $('#pprev'); if (!f || !bx) return; const mp = f.margen_propio.value; bx.innerHTML = prevHtml(f.costo_usd.value, mp === '' ? null : Number(mp) / 100); });
on('p-uni', (d, el) => { const c = $('#p-cont'); if (c) c.hidden = !['pack', 'bulto', 'caja', 'display'].includes(el.value); });
on('p-prod', async (d, f) => {
  const fd = new FormData(f), st = fd.get('stock'), mp = fd.get('margen_propio');
  const v = String(fd.get('variantes') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 20);
  const p0 = P.modal.p || {}, foto = P.modal.foto !== undefined ? P.modal.foto : (p0.imagen_url || null);
  const datos = { nombre: fd.get('nombre').trim(), categoria: fd.get('categoria').trim() || 'General', sku: fd.get('sku').trim() || null, marca: fd.get('marca').trim() || null, descripcion: fd.get('descripcion').trim() || null, costo_usd: Number(fd.get('costo_usd')), variantes: v, imagen_url: foto || null, emoji: (fd.get('emoji') || '📦').trim() || '📦', stock: st === '' ? null : Math.max(0, Math.floor(Number(st))), margen_override: mp === '' ? null : (p0.margen_override != null && Math.abs(Number(mp) - Math.round(Number(p0.margen_override) * 10000) / 100) < 0.005 ? Number(p0.margen_override) : Number(mp) / 100), activo: fd.get('activo') === 'on' };
  datos.unidad = fd.get('unidad') || 'unidad';
  if ((P.t.modo_stock || 'stock') === 'mixto') datos.a_pedido = fd.get('a_pedido') === 'on';
  if (fd.has('demora_dias')) datos.demora_dias = Number(fd.get('demora_dias')) >= 1 ? Math.min(120, Math.floor(Number(fd.get('demora_dias')))) : null;
  if (fd.has('pvp_sugerido')) datos.pvp_sugerido = Number(fd.get('pvp_sugerido')) > 0 ? Math.round(Number(fd.get('pvp_sugerido')) * 100) / 100 : null;
  datos.contenido = ['pack', 'bulto', 'caja', 'display'].includes(datos.unidad) && Number(fd.get('contenido')) >= 1 ? Math.floor(Number(fd.get('contenido'))) : null;
  datos.precio_unico = fd.get('precio_unico') === 'on';
  if (hayV216()) {
    const op = Number(fd.get('oferta_pct')), oh = fd.get('oferta_hasta'), od = fd.get('oferta_desde');
    if (op > 0) {
      if (op > 90) return mm('El descuento de la oferta va de 1 a 90 %.');
      if (!oh || new Date(oh + 'T23:59:59') <= new Date()) return mm('Poné hasta qué día dura la oferta (hoy o más adelante).');
      if (od && od > oh) return mm('La oferta tiene que empezar antes de terminar.');
      Object.assign(datos, { oferta_pct: Math.round(op * 100) / 100, oferta_hasta: finDia(oh), oferta_desde: inicioDia(od) });
    } else Object.assign(datos, { oferta_pct: null, oferta_hasta: null, oferta_desde: null });
    const cb = (P.modal.combo || []).filter(c => c.id && c.id !== p0.id);
    if (cb.length) {
      if (cb.reduce((a, c) => a + c.cant, 0) < 2) return mm('Un combo tiene que traer al menos 2 unidades.');
      datos.combo = cb.map(c => ({ id: c.id, cant: Math.max(1, Math.min(99, Math.floor(c.cant))) })); datos.combo_desc = Math.max(0, Math.min(90, Number(fd.get('combo_desc')) || 0));
      datos.precio_unico = true; datos.stock = null;
    } else { datos.combo = null; datos.combo_desc = 0; }
  }
  try {
    const id = p0.id; if (!id) datos.tenant_id = P.t.id;
    await api.guardarProducto(id, datos); P.prods = await api.misProductos(); P.modal = null; pintar(); toast('Producto guardado');
  } catch (e) { mm(e.message); }
});
on('p-borrar', async (d, b) => { if (!confirmar(b, '¿Eliminar? Tocá de nuevo para confirmar')) return; try { await api.borrarProducto(d.id); P.prods = await api.misProductos(); P.modal = null; pintar(); toast('Eliminado'); } catch (e) { mm(e.message); } });
on('p-guardar', async (d, f) => {
  const fd = new FormData(f), b = $('#aj-go'); b.disabled = true;
  const m = n => Number(fd.get('m' + n)) / 100;
  const c = { whatsapp: String(fd.get('whatsapp')).replace(/\D/g, ''), modalidad: fd.get('modalidad'), cotizacion_usd: Number(fd.get('cotizacion_usd')), compra_minima: Number(fd.get('compra_minima') || 0), gastos_fijos: Number(fd.get('gastos_fijos') || 0), margen_piso: Number(fd.get('margen_piso') || 0) / 100, alias_cobro: fd.get('alias_cobro').trim() || null, margen_1: m(1), margen_3: m(3), margen_6: m(6), margen_12: m(12) };
  if (fd.has('escala_grupo')) c.escala_grupo = ['categoria', 'carrito'].includes(fd.get('escala_grupo')) ? fd.get('escala_grupo') : 'producto';
  c.modo_stock = fd.get('modo_stock') || 'stock'; c.demora_encargo = Math.max(1, Math.min(120, Math.floor(Number(fd.get('demora_encargo')) || 7)));
  if (can('pixel')) c.pixel_id = (fd.get('pixel_id') || '').trim() || null;
  if (can('webhook')) c.webhook_url = (fd.get('webhook_url') || '').trim() || null;
  try { P.t = await api.guardarTienda(P.t.id, c) || P.t; toast('Cambios guardados'); pintar(); }
  catch (e) { $('#aj-m').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; b.disabled = false; window.scrollTo(0, 0); }
});
on('p-codigo', async (d, f) => {
  const c = new FormData(f).get('codigo').trim();
  try { await api.setCodigo(c); P.t = await api.miTienda(); toast('Código guardado'); pintar(); } catch (e) { $('#cod-m').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; }
});
on('p-codigo-off', async () => { try { await api.setCodigo(null); P.t = await api.miTienda(); toast('Código quitado'); pintar(); } catch (e) { toast(e.message); } });
on('p-recont', async d => { try { await api.marcarCarrito(d.id); const c = P.carritos.find(x => x.id === d.id); if (c) c.recontactado = true; setTimeout(pintar, 300); } catch (e) { } });
on('p-delcar', async (d, b) => { if (!confirmar(b, '¿Borrar?')) return; try { await api.borrarCarrito(d.id); P.carritos = await api.misCarritos(); pintar(); } catch (e) { toast(e.message); } });
