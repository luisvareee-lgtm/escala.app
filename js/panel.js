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

const Q = { q: '', lim: 60, filtro: 'todos', pq: '', stop: null };
let salirFn = () => { };
export const setSalir = f => { salirFn = f; };
const urlTienda = () => location.origin + '/t/' + P.t.slug;
const TABS = [['resumen', '📊 Resumen'], ['productos', '📦 Productos'], ['pedidos', '🧾 Pedidos'], ['precios', '💹 Precios'], ['equipo', '🤝 Revendedores'], ['carritos', '🛒 Carritos'], ['tienda', '🎨 Tienda'], ['ajustes', '⚙️ Ajustes']];
const ESTADO = { pendiente: '🟡 Pendiente', cobrado: '🟢 Cobrado', cancelado: '⚪ Cancelado' };

export async function mostrarPanel(app) {
  app.innerHTML = '<div class="page center" style="padding-top:80px"><span class="spin"></span></div>';
  try { P.t = await api.miTienda(); } catch (e) { app.innerHTML = `<div class="page"><div class="err-box">${esc(e.message)}</div></div>`; return; }
  if (!P.t) return 'sin-tienda';
  Object.assign(P, { tab: 'resumen', modal: null }); Object.assign(Q, { q: '', lim: 60, filtro: 'todos', pq: '' }); resetAj(); resetImp();
  P.repintar = pintar;
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
  const cuerpo = { resumen: () => vistaResumen(urlTienda()), productos, pedidos, precios: vistaPrecios, equipo: vistaEquipo, carritos, tienda: vistaTienda, ajustes: vistaAjustes }[P.tab]();
  const y = window.scrollY, foco = document.activeElement && document.activeElement.id;
  $('#root').innerHTML = `<div id="app"><div id="hdr"><div style="display:flex;gap:8px;align-items:center;min-width:0">${t.logo_url ? `<img src="${esc(t.logo_url)}" alt="" style="height:26px;border-radius:6px">` : ''}<b style="font-size:.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.nombre)}</b></div><div style="display:flex;gap:6px;align-items:center"><span class="chip">${dias > 0 ? 'Prueba: ' + dias + ' d' : esc(PLAN_NOMBRE[t.plan])}</span><button class="btn btn-s btn-sm" data-act="p-salir">Salir</button></div></div>
    <div class="tabs-panel" role="tablist">${TABS.map(([k, n]) => `<button class="ptab ${P.tab === k ? 'on' : ''}" role="tab" data-act="p-tab" data-k="${k}">${n}${k === 'pedidos' && P.pedidos.some(o => o.estado === 'pendiente') ? ' •' : ''}</button>`).join('')}</div>
    <div class="page wide" style="padding-top:16px">${cuerpo}</div>${navMovil()}</div>${P.modal ? modal() : ''}`;
  if (foco) { const n = document.getElementById(foco); if (n && n.focus) { n.focus(); try { n.setSelectionRange(n.value.length, n.value.length); } catch (e) { } } }
}

const NAV = [['resumen', '📊', 'Inicio'], ['productos', '📦', 'Productos'], ['pedidos', '🧾', 'Pedidos'], ['tienda', '🎨', 'Tienda']];
const MAS = [['precios', '💹', 'Precios inteligentes', 'Proveedores, mercado y ajuste masivo'], ['equipo', '🤝', 'Revendedores', 'Enlaces con comisión'], ['carritos', '🛒', 'Carritos sin cerrar', 'Recontactá por WhatsApp'], ['ajustes', '⚙️', 'Ajustes', 'Precios, cobro, accesos, integraciones y plan']];
function navMovil() {
  const pend = P.pedidos.some(o => o.estado === 'pendiente'), enMas = MAS.some(m => m[0] === P.tab);
  return `<nav id="pnav" aria-label="Secciones">${NAV.map(([k, i, n]) => `<button class="${P.tab === k ? 'on' : ''}" data-act="p-tab" data-k="${k}"${P.tab === k ? ' aria-current="page"' : ''}><span class="i">${i}</span>${n}${k === 'pedidos' && pend ? '<span class="dot" aria-label="hay pendientes"></span>' : ''}</button>`).join('')}<button class="${enMas ? 'on' : ''}" data-act="p-menu"><span class="i">☰</span>Más</button></nav>`;
}
function menuMas() {
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="Más secciones"><div class="view-title">Más</div><div class="menu-list">${MAS.map(([k, i, n, d]) => `<button data-act="p-tab" data-k="${k}"><span class="i">${i}</span><span>${n}<small>${d}</small></span></button>`).join('')}
    <button data-act="p-ver-tienda"><span class="i">👀</span><span>Ver mi tienda<small>Como la ven tus clientes</small></span></button>
    <button data-act="p-salir"><span class="i">🚪</span><span>Salir<small>Cerrar sesión en este dispositivo</small></span></button></div>
    <button class="btn btn-s" style="margin-top:12px" data-act="p-cerrar">Cerrar</button></div></div>`;
}
on('p-menu', () => { P.modal = { tipo: 'mas' }; pintar(); });
on('p-ver-tienda', () => { window.open(urlTienda(), '_blank', 'noopener'); });

/* ---------- productos ---------- */
function productos() {
  const q = Q.pq.toLowerCase(), L = P.prods.filter(p => !q || p.nombre.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q));
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn btn-p btn-sm" data-act="p-nuevo">+ Producto</button><button class="btn btn-s btn-sm" data-act="p-importar">📥 Importar</button><button class="btn btn-s btn-sm" data-act="p-catalogo">📄 Catálogo PDF</button></div>
  <input class="fi" id="pq" placeholder="Buscar por nombre, categoría o código…" data-input="p-q" value="${esc(Q.pq)}" aria-label="Buscar producto" style="margin-bottom:12px"><div class="muted" style="margin-bottom:8px;font-size:.8rem">${P.prods.length} productos</div>
  <div class="card">${L.slice(0, Q.lim).map(filaProd).join('') || '<p class="muted">Nada para mostrar. Importá tu lista o agregá un producto.</p>'}${L.length > Q.lim ? `<button class="btn btn-s btn-sm" data-act="p-mas">Ver más (${L.length - Q.lim})</button>` : ''}</div>`;
}
const usd = n => 'USD ' + (Math.round(Number(n) * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 });
// Precios que ve el comprador (mismo cálculo que el servidor; el pedido siempre lo recalcula la base).
function preciosDe(costo, ovr) {
  const t = P.t, c = Number(costo) || 0, sh = ovr == null || ovr === '' ? 0 : Number(ovr) - Number(t.margen_1);
  const m1 = ovr == null || ovr === '' ? Number(t.margen_1) : Number(ovr);
  return { min: precioArs(c, t.cotizacion_usd, m1), 1: precioArs(c, t.cotizacion_usd, Math.max(0, Number(t.margen_1) + sh)), 3: precioArs(c, t.cotizacion_usd, Math.max(0, Number(t.margen_3) + sh)), 6: precioArs(c, t.cotizacion_usd, Math.max(0, Number(t.margen_6) + sh)), 12: precioArs(c, t.cotizacion_usd, Math.max(0, Number(t.margen_12) + sh)) };
}
const UNIDADES_P = [['unidad', 'Unidad'], ['par', 'Par'], ['docena', 'Docena'], ['pack', 'Pack'], ['bulto', 'Bulto'], ['caja', 'Caja'], ['display', 'Display'], ['kg', 'Kilo (kg)'], ['gramos', 'Gramos'], ['litro', 'Litro'], ['metro', 'Metro']];
function filaProd(p) {
  const pr = preciosDe(p.costo_usd, p.margen_override), may = P.t.modalidad !== 'minorista';
  const det = [p.categoria, p.unidad && p.unidad !== 'unidad' ? 'por ' + p.unidad + (p.contenido ? ' x' + p.contenido : '') : '', p.precio_unico ? 'precio único' : '', usd(p.costo_usd), p.margen_override != null ? 'margen propio ' + Math.round(p.margen_override * 100) + '%' : '', p.stock != null ? (p.stock > 0 ? 'stock ' + p.stock : 'sin stock') : '', p.activo ? '' : 'oculto'].filter(Boolean).join(' · ');
  return `<div class="prow${p.activo ? '' : ' off'}" data-act="p-editar" data-id="${p.id}" role="button" tabindex="0" aria-label="Editar ${esc(p.nombre)}">
    <span class="th">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="" loading="lazy">` : esc(p.emoji)}</span>
    <span style="min-width:0"><div class="nm">${esc(p.nombre)}</div><div class="ds">${esc(det)}</div></span>
    <span class="pr">${fmt(P.t.modalidad === 'mayorista' ? pr[1] : pr.min)}${may ? `<small>x12: ${fmt(pr[12])}</small>` : ''}</span></div>`;
}
function pedidos() {
  const q = Q.q.toLowerCase(), L = P.pedidos.filter(o => (Q.filtro === 'todos' || o.estado === Q.filtro) && (!q || o.cliente_nombre.toLowerCase().includes(q) || String(o.numero) === q));
  const rv = new Map(P.revs.map(r => [r.id, r.nombre]));
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><div class="seg">${['todos', 'pendiente', 'cobrado', 'cancelado'].map(k => `<button class="${Q.filtro === k ? 'on' : ''}" data-act="p-filtro" data-k="${k}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></div>
  <input class="fi" id="oq" placeholder="Buscar por cliente o N° de pedido…" data-input="p-oq" value="${esc(Q.q)}" aria-label="Buscar pedido" style="margin-bottom:10px">
  <div class="card">${L.slice(0, Q.olim || 100).map(o => `<div class="srow" style="cursor:pointer" data-act="p-pedido" data-id="${o.id}" role="button" tabindex="0"><span>#${o.numero} · ${esc(o.cliente_nombre)}${o.sub_revendedor_id ? ` <span class="tag">${esc(rv.get(o.sub_revendedor_id) || 'revendedor')}</span>` : ''}<br><small class="muted">${ESTADO[o.estado]} · ${new Date(o.created_at).toLocaleDateString('es-AR')} · ${esc(o.modalidad_precio)}</small></span><span class="v">${fmt(o.total_ars)}</span></div>`).join('') || '<p class="muted">Sin pedidos para mostrar.</p>'}${L.length > (Q.olim || 100) ? `<button class="btn btn-s btn-sm" data-act="p-omas">Ver más (${L.length - (Q.olim || 100)})</button>` : ''}</div>`;
}
function carritos() {
  if (!can('carritos')) return '<div class="locked"><b>🛒 Carritos abandonados</b><p style="margin:6px 0">Recontactá por WhatsApp a quienes dejaron productos sin comprar.</p><span class="tag warn">🔒 Plan Mayorista Pro</span></div>';
  return `<div class="card">${P.carritos.map(c => { const it = (c.items || []).map(i => `${esc(i.q)}× ${esc(i.n)}`).join(', '); const msg = `Hola ${c.nombre}, vimos que dejaste productos en tu carrito en ${P.t.nombre}. ¿Querés que te ayudemos a cerrar el pedido?`;
    return `<div class="srow" style="align-items:flex-start"><span>${esc(c.nombre)} · ${fmt(c.total_ars)}${c.recontactado ? ' <span class="tag ok">contactado</span>' : ''}<br><small class="muted">${it}</small></span><span style="display:flex;gap:6px"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" data-act="p-recont" data-id="${c.id}" href="${esc(waLink(normWsp(c.whatsapp), msg))}">WhatsApp</a><button class="btn btn-s btn-sm" data-act="p-delcar" data-id="${c.id}" aria-label="Descartar">✕</button></span></div>`; }).join('') || '<p class="muted">Sin carritos pendientes.</p>'}</div>`;
}

/* ---------- modales ---------- */
function modal() {
  const m = P.modal;
  if (m.tipo === 'mas') return menuMas();
  if (m.tipo === 'imp') return vistaImportar();
  if (m.tipo === 'cat') return vistaCatalogo();
  if (m.tipo === 'prod') {
    const p = m.p || {}, foto = m.foto !== undefined ? m.foto : p.imagen_url;
    return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal" role="dialog" aria-modal="true"><div class="view-title">${p.id ? 'Editar producto' : 'Nuevo producto'}</div><div id="mm"></div>
    <form data-submit="p-prod">
    <div class="fg"><label class="flabel">Nombre</label><input class="fi" name="nombre" value="${esc(p.nombre || '')}" maxlength="160" required></div>
    <div class="row2"><div class="fg"><label class="flabel">Categoría</label><input class="fi" name="categoria" value="${esc(p.categoria || 'General')}" maxlength="60" required></div><div class="fg"><label class="flabel">Código / SKU</label><input class="fi" name="sku" value="${esc(p.sku || '')}" maxlength="60"></div></div>
    <div class="row2"><div class="fg"><label class="flabel">Costo en USD</label><input class="fi" name="costo_usd" type="number" step="any" min="0" value="${p.costo_usd != null ? Number(p.costo_usd) : ''}" data-input="p-prev" required></div><div class="fg"><label class="flabel">Marca</label><input class="fi" name="marca" value="${esc(p.marca || '')}" maxlength="60"></div></div>
    <div class="row2"><div class="fg"><label class="flabel">Se vende por</label><select class="fi" name="unidad" data-change="p-uni">${UNIDADES_P.map(([k, n]) => `<option value="${k}" ${(p.unidad || 'unidad') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="fg" id="p-cont" ${['pack', 'bulto', 'caja', 'display'].includes(p.unidad) ? '' : 'hidden'}><label class="flabel">Unidades que trae</label><input class="fi" name="contenido" type="number" min="1" max="100000" value="${p.contenido || ''}" placeholder="Ej: 12"></div></div>
    ${P.t.modalidad !== 'minorista' ? `<div class="fg"><label class="flabel"><input type="checkbox" name="precio_unico" ${p.precio_unico ? 'checked' : ''}> Precio único (sin descuento por cantidad x3 · x6 · x12)</label></div>` : ''}
    <div class="fg"><label class="flabel">Variantes (separadas por coma)</label><input class="fi" name="variantes" value="${esc((p.variantes || []).join(', '))}"></div>
    <div class="fg"><span class="flabel">Foto</span><div id="foto-box">${fotoHtml(foto)}</div></div>
    <div class="row2"><div class="fg"><label class="flabel">Emoji (si no hay foto)</label><input class="fi" name="emoji" value="${esc(p.emoji || '📦')}" maxlength="4"></div><div class="fg"><label class="flabel">Stock (vacío = sin control)${aviso('stock')}</label><input class="fi" name="stock" type="number" min="0" value="${p.stock != null ? p.stock : ''}"></div></div>
    <div class="fg"><label class="flabel">Margen propio % para este producto (vacío = el general)</label><input class="fi" name="margen_propio" type="number" min="0" max="900" step="any" value="${p.margen_override != null ? Math.round(Number(p.margen_override) * 10000) / 100 : ''}" data-input="p-prev" placeholder="General: ${Math.round(Number(P.t.margen_1) * 100)}%"></div>
    <div class="flabel">Así lo ve tu cliente</div><div class="pprev" id="pprev">${prevHtml(p.costo_usd, p.margen_override)}</div>
    <div class="fg"><label class="flabel">Descripción</label><textarea class="fi" name="descripcion" rows="2" maxlength="2000">${esc(p.descripcion || '')}</textarea></div>
    <div class="fg"><label class="flabel"><input type="checkbox" name="activo" ${p.activo === false ? '' : 'checked'}> Visible en la tienda</label></div>
    <button class="btn btn-p" type="submit">Guardar</button>${p.id ? '<button type="button" class="btn btn-s" style="margin-top:8px;color:var(--red)" data-act="p-borrar" data-id="' + p.id + '">Eliminar producto</button>' : ''}<button type="button" class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cancelar</button></form></div></div>`;
  }
  if (m.tipo === 'ped') {
    const o = m.o, it = m.items || [], rv = P.revs.find(r => r.id === o.sub_revendedor_id);
    return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal" role="dialog" aria-modal="true"><div class="view-title">Pedido #${o.numero}</div><div id="mm"></div>
    <p><b>${esc(o.cliente_nombre)}</b> · ${esc(o.localidad || '—')}<br><span class="muted">${esc(o.modalidad_precio)} · ${esc(o.medio_pago)} · ${ESTADO[o.estado]}</span>${rv ? `<br><span class="tag">Vendió: ${esc(rv.nombre)} · comisión ${fmt(o.comision_ars)}</span>` : ''}</p>
    <div class="card" style="margin-top:8px">${it.map(i => `<div class="srow"><span>${i.cantidad} × ${esc(i.nombre_snapshot)}${i.variante ? ' (' + esc(i.variante) + ')' : ''}</span><span class="v">${fmt(i.subtotal)}</span></div>`).join('')}<div class="srow tot"><span>Total</span><span class="v">${fmt(o.total_ars)}</span></div></div>
    <a class="btn btn-wa" target="_blank" rel="noopener" href="${esc(waLink(normWsp(o.cliente_whatsapp), 'Hola ' + o.cliente_nombre + ', te escribimos por tu pedido #' + o.numero + '.'))}">Escribir al cliente</a>
    ${o.estado === 'pendiente' ? `<button class="btn btn-p" style="margin-top:8px" data-act="p-estado" data-id="${o.id}" data-e="cobrado">Marcar cobrado</button><button class="btn btn-s" style="margin-top:8px" data-act="p-estado" data-id="${o.id}" data-e="cancelado">Cancelar pedido</button>` : o.estado === 'cobrado' ? `<button class="btn btn-s" style="margin-top:8px" data-act="p-estado" data-id="${o.id}" data-e="cancelado">Cancelar (devuelve stock)</button>` : ''}
    <button class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cerrar</button></div></div>`;
  }
  return '';
}
function prevHtml(costo, ovr) {
  if (!(Number(costo) > 0)) return '<div style="grid-column:1/-1"><small>Cargá el costo para ver los precios</small></div>';
  const pr = preciosDe(costo, ovr);
  if (P.t.modalidad === 'minorista') return `<div style="grid-column:1/-1"><small>Precio de venta</small><b>${fmt(pr.min)}</b></div>`;
  return [1, 3, 6, 12].map(n => `<div><small>x${n}${n === 12 ? '+' : ''}</small><b>${fmt(pr[n])}</b></div>`).join('') + (P.t.modalidad === 'hibrido' ? `<div style="grid-column:1/-1"><small>Minorista (público)</small><b>${fmt(pr.min)}</b></div>` : '');
}
const fotoHtml = foto => `${foto ? `<img src="${esc(foto)}" alt="Foto actual" style="height:84px;border-radius:10px;display:block;margin-bottom:8px">` : ''}<label class="filebtn">📷 ${foto ? 'Cambiar foto' : 'Subir foto'}<input type="file" accept="image/*" data-change="p-foto"></label>${foto ? ' <button type="button" class="btn btn-s btn-sm" data-act="p-nofoto">Quitar</button>' : ''}<div class="hint" style="margin-top:4px">La achicamos automáticamente para que cargue rápido.</div>`;
const mm = (t, ok) => { const e = $('#mm'); if (e) e.innerHTML = `<div class="${ok ? 'ok-box' : 'err-box'}">${esc(t)}</div>`; };

/* ---------- acciones ---------- */
on('p-tab', d => { P.tab = d.k; P.modal = null; Q.q = ''; Q.pq = ''; pintar(); window.scrollTo(0, 0); });
on('p-salir', async () => { if (Q.stop) Q.stop(); Q.stop = null; await api.salir(); salirFn(); });
on('p-copiar', d => copiar(d.v));
on('p-q', (d, el) => { Q.pq = el.value; Q.lim = 60; pintar(); });
on('p-oq', (d, el) => { Q.q = el.value; pintar(); });
on('p-filtro', d => { Q.filtro = d.k; pintar(); });
on('p-mas', () => { Q.lim += 60; pintar(); });
on('p-omas', () => { Q.olim = (Q.olim || 100) + 100; pintar(); });
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
  try { await api.estadoPedido(d.id, d.e); await recargarPedidos(); P.modal = null; pintar(); toast('Pedido actualizado'); } catch (e) { mm(e.message); }
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
  datos.contenido = ['pack', 'bulto', 'caja', 'display'].includes(datos.unidad) && Number(fd.get('contenido')) >= 1 ? Math.floor(Number(fd.get('contenido'))) : null;
  datos.precio_unico = fd.get('precio_unico') === 'on';
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
