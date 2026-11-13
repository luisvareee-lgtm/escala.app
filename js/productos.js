// Pestaña Productos: buscar, filtrar por categoría y estado, ordenar (nuevos, más vendidos, populares…), páginas,
// selección múltiple y edición / borrado masivo. Está en todos los planes.
// Cómo se mide:
//   Vendidos  = unidades en pedidos no cancelados (pendientes o cobrados) dentro del período, por la fecha del pedido.
//   Visitas   = personas que abrieron la ficha del producto en la tienda (cada navegador cuenta 1 vez por día).
//   Al carrito = personas que lo agregaron al carrito (también 1 vez por día). Las visitas del propio dueño no cuentan.
//   Popular   = visitas + al carrito del período.
import { api } from './api.js';
import { $, esc, fmt, on, toast } from './util.js';
import { P } from './state.js';

const PQ = { q: '', cat: '', ver: 'todos', orden: 'nuevos', dias: 30, pag: 0, por: 50, sel: new Set(), vistas: null, vistasDias: null, cargando: false, sinVistas: false, desde: null };
let H = { precioDe: () => 0, flyerDe: () => { }, fila: () => '', abrirCombo: () => { } };
export const setAyudas = h => { H = Object.assign(H, h); };
export const busq = () => PQ.q;
export function resetProd() { Object.assign(PQ, { q: '', cat: '', ver: 'todos', orden: 'nuevos', pag: 0, sel: new Set(), vistas: null, vistasDias: null, cargando: false, sinVistas: false, desde: null }); }
export const limpiarSel = () => PQ.sel.clear();

const VER = [['todos', 'Todos'], ['visibles', 'Visibles en la tienda'], ['ocultos', 'Ocultos'], ['sin_stock', 'Sin stock'], ['encargo', 'Por encargo'], ['sin_foto', 'Sin foto'], ['ofertas', 'En oferta'], ['combos', 'Combos'], ['sin_ventas', 'Sin ventas en el período'], ['sin_visitas', 'Sin visitas en el período']];
const ORDEN = [['nuevos', 'Nuevos ingresos'], ['vendidos', 'Más vendidos'], ['populares', 'Más populares (visitas + al carrito)'], ['visitas', 'Más visitados'], ['nombre', 'Nombre A–Z'], ['precio_menor', 'Precio: menor a mayor'], ['precio_mayor', 'Precio: mayor a menor'], ['stock', 'Menos stock primero']];
const DIAS = [[7, 'Últimos 7 días'], [30, 'Últimos 30 días'], [90, 'Últimos 90 días'], [365, 'Últimos 12 meses']];
const POR = [25, 50, 100];

/* ---------- números por producto ---------- */
let cacheV = { k: '', m: null };
function ventas() {
  const k = PQ.dias + ':' + (P.items || []).length + ':' + (P.pedidos || []).length + ':' + (P.pedidos || []).map(o => o.estado[0]).join('');
  if (cacheV.k === k) return cacheV.m;
  const desde = Date.now() - PQ.dias * 864e5, ped = new Map((P.pedidos || []).map(o => [o.id, o])), m = new Map();
  (P.items || []).forEach(i => {
    const o = ped.get(i.order_id); if (!o || o.estado === 'cancelado' || !i.product_id || new Date(o.created_at).getTime() < desde) return;
    const x = m.get(i.product_id) || { u: 0, n: 0 }; x.u += Number(i.cantidad) || 0; x.n += 1; m.set(i.product_id, x);
  });
  return (cacheV = { k, m }).m;
}
function cargarVistas() {
  if (PQ.cargando || PQ.sinVistas || PQ.vistasDias === PQ.dias) return;
  PQ.cargando = true;
  api.statsVistas(PQ.dias).then(L => {
    PQ.vistas = new Map(L.map(r => [r.producto, { v: Number(r.vistas) || 0, c: Number(r.agregados) || 0 }]));
    PQ.desde = (L.find(r => r.medido_desde) || {}).medido_desde || PQ.desde; PQ.vistasDias = PQ.dias;
  }).catch(() => { PQ.sinVistas = true; PQ.vistas = null; })
    .finally(() => { PQ.cargando = false; if (P.tab === 'productos' && !P.modal) P.repintar(); });
}
const numDe = id => { const v = ventas().get(id) || { u: 0 }, w = (PQ.vistas && PQ.vistas.get(id)) || { v: 0, c: 0 }; return { vend: v.u, vis: w.v, car: w.c, pop: w.v + w.c }; };

/* ---------- lista filtrada y ordenada ---------- */
const sinStock = p => p.stock != null && p.stock <= 0;
function filtrados() {
  const q = PQ.q.toLowerCase().trim(), t = P.t;
  let L = (P.prods || []).filter(p => (!PQ.cat || p.categoria === PQ.cat)
    && (!q || [p.nombre, p.categoria, p.sku, p.marca].join(' ').toLowerCase().includes(q)));
  const f = { visibles: p => p.activo, ocultos: p => !p.activo, sin_stock: sinStock, encargo: p => t.modo_stock === 'encargo' || (t.modo_stock === 'mixto' && p.a_pedido),
    sin_foto: p => !p.imagen_url, sin_ventas: p => !numDe(p.id).vend, sin_visitas: p => !numDe(p.id).vis,
    ofertas: p => Number(p.oferta_pct) > 0 && (!p.oferta_hasta || new Date(p.oferta_hasta) > new Date()), combos: p => Array.isArray(p.combo) && p.combo.length > 0 }[PQ.ver];
  if (f) L = L.filter(f);
  const by = {
    nuevos: (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')),
    vendidos: (a, b) => numDe(b.id).vend - numDe(a.id).vend,
    populares: (a, b) => numDe(b.id).pop - numDe(a.id).pop,
    visitas: (a, b) => numDe(b.id).vis - numDe(a.id).vis,
    nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
    precio_menor: (a, b) => H.precioDe(a) - H.precioDe(b),
    precio_mayor: (a, b) => H.precioDe(b) - H.precioDe(a),
    stock: (a, b) => (a.stock == null ? Infinity : a.stock) - (b.stock == null ? Infinity : b.stock)
  }[PQ.orden] || (() => 0);
  const nuevos = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));
  return L.slice().sort((a, b) => by(a, b) || nuevos(a, b));
}

/* ---------- vista ---------- */
const opt = (L, v) => L.map(([k, n]) => `<option value="${esc(String(k))}" ${String(k) === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('');
const usaNumeros = () => ['vendidos', 'populares', 'visitas'].includes(PQ.orden) || ['sin_ventas', 'sin_visitas'].includes(PQ.ver);
export function vistaProductos(fly) {
  cargarVistas();
  const L = filtrados(), paginas = Math.max(1, Math.ceil(L.length / PQ.por)); if (PQ.pag >= paginas) PQ.pag = paginas - 1;
  const pag = L.slice(PQ.pag * PQ.por, PQ.pag * PQ.por + PQ.por), cats = [...new Set((P.prods || []).map(p => p.categoria))].sort((a, b) => a.localeCompare(b, 'es'));
  const enPag = pag.length && pag.every(p => PQ.sel.has(p.id)), algunoPag = pag.some(p => PQ.sel.has(p.id));
  const filtrando = PQ.q || PQ.cat || PQ.ver !== 'todos';
  const medido = PQ.sinVistas ? ' · las visitas se empiezan a medir cuando actualizás la base (v2.16)' : PQ.desde ? ` · visitas medidas desde el ${new Date(PQ.desde + 'T12:00:00').toLocaleDateString('es-AR')}` : '';
  const head = `<div class="pq-bar">
    <input class="fi" id="pq" placeholder="Buscar por nombre, categoría, marca o código…" data-input="p-q" value="${esc(PQ.q)}" aria-label="Buscar producto">
    <div class="pq-fil">
      <label><span>Categoría</span><select class="fi" data-change="pq-f" data-k="cat" aria-label="Filtrar por categoría"><option value="">Todas</option>${opt(cats.map(c => [c, c]), PQ.cat)}</select></label>
      <label><span>Mostrar</span><select class="fi" data-change="pq-f" data-k="ver" aria-label="Qué productos mostrar">${opt(VER, PQ.ver)}</select></label>
      <label><span>Ordenar</span><select class="fi" data-change="pq-f" data-k="orden" aria-label="Ordenar">${opt(ORDEN, PQ.orden)}</select></label>
      <label><span>Período</span><select class="fi" data-change="pq-f" data-k="dias" aria-label="Período de ventas y visitas">${opt(DIAS, PQ.dias)}</select></label>
    </div></div>
    <div class="muted pq-cuenta">${P.prods.length} productos${filtrando ? ` · <b>${L.length}</b> con este filtro <button class="lnk" data-act="pq-limpiar">Quitar filtros</button>` : ''}<br><small>Ventas${PQ.vistas ? ', visitas y al carrito' : ''}: ${esc(DIAS.find(d => d[0] === PQ.dias)[1].toLowerCase())}${medido}${usaNumeros() && PQ.cargando ? ' · <span class="spin"></span>' : ''}</small></div>`;
  const selBar = fly ? '' : `<div class="pq-selh"><label class="pq-chk"><input type="checkbox" data-change="pq-pag" ${enPag ? 'checked' : ''} ${pag.length ? '' : 'disabled'} aria-label="Seleccionar esta página">${algunoPag && !enPag ? '<i class="pq-mix" aria-hidden="true"></i>' : ''}</label><span>Seleccionar esta página (${pag.length})</span>
    ${enPag && L.length > pag.length && PQ.sel.size < L.length ? `<button class="lnk" data-act="pq-todos">Seleccionar los ${L.length}${filtrando ? ' que coinciden' : ''}</button>` : ''}${PQ.sel.size ? `<button class="lnk" data-act="pq-ninguno">Quitar selección</button>` : ''}</div>`;
  const filas = pag.map(p => fly ? H.fila(p) : `<div class="pq-row${PQ.sel.has(p.id) ? ' sel' : ''}"><label class="pq-chk"><input type="checkbox" data-change="pq-sel" data-id="${p.id}" ${PQ.sel.has(p.id) ? 'checked' : ''} aria-label="Seleccionar ${esc(p.nombre)}"></label>${H.fila(p, numerosHtml(p))}</div>`).join('');
  const nav = paginas > 1 ? `<div class="pq-pags"><button class="btn btn-s btn-sm" data-act="pq-pag-ir" data-d="-1" ${PQ.pag ? '' : 'disabled'}>‹ Anterior</button><span>Página <b>${PQ.pag + 1}</b> de ${paginas}</span><button class="btn btn-s btn-sm" data-act="pq-pag-ir" data-d="1" ${PQ.pag < paginas - 1 ? '' : 'disabled'}>Siguiente ›</button>
    <label class="pq-por"><select class="fi" data-change="pq-f" data-k="por" aria-label="Productos por página">${opt(POR.map(n => [n, n + ' por página']), PQ.por)}</select></label></div>` : '';
  return `${head}${selBar}<div class="card pq-list">${filas || `<p class="muted">${P.prods.length ? 'Ningún producto coincide con el filtro.' : 'Nada para mostrar. Importá tu lista o agregá un producto.'}</p>`}</div>${nav}${fly ? '' : barraSel()}`;
}
function numerosHtml(p) {
  const n = numDe(p.id), w = PQ.vistas;
  return `<span class="pq-num" title="En el período elegido"><span title="Unidades vendidas">✅ ${n.vend} vend.</span>${w ? `<span title="Visitas a la ficha">👁 ${n.vis}</span><span title="Veces que lo agregaron al carrito">🛒 ${n.car}</span>` : ''}</span>`;
}
function barraSel() {
  const n = PQ.sel.size; if (!n) return '';
  return `<div class="pq-acc" role="region" aria-label="Acciones para los seleccionados"><b>${n} ${n === 1 ? 'seleccionado' : 'seleccionados'}</b><div class="pq-acc-b">
    <button class="btn btn-p btn-sm" data-act="pq-editar">✏️ Editar</button><button class="btn btn-s btn-sm" data-act="pq-vis" data-v="1">👁 Mostrar</button><button class="btn btn-s btn-sm" data-act="pq-vis" data-v="0">🙈 Ocultar</button>
    <button class="btn btn-s btn-sm" data-act="pq-editar" data-s="categoria">🗂 Categoría</button>${v216() ? '<button class="btn btn-s btn-sm" data-act="pq-editar" data-s="oferta">🏷️ Oferta</button>' : ''}<button class="btn btn-s btn-sm" data-act="pq-flyer">📸 Flyer</button>${v216() && n >= 2 && n <= 10 ? '<button class="btn btn-s btn-sm" data-act="pq-combo">🧩 Armar combo</button>' : ''}
    <button class="btn btn-s btn-sm pq-del" data-act="pq-borrar">🗑 Eliminar</button><button class="btn btn-s btn-sm" data-act="pq-ninguno" aria-label="Quitar selección">✕</button></div></div>`;
}

/* ---------- modal de edición masiva ---------- */
const v216 = () => (P.prods || []).some(p => 'oferta_pct' in p);
const proxDomingo = () => { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); return d.toLocaleDateString('sv'); };
const SECC = [['oferta', '🏷️ Oferta con fechas'], ['precio', '💲 Precio'], ['stock', '📦 Stock'], ['nombre', '✏️ Nombre'], ['variantes', '👕 Variantes / talles'], ['categoria', '🗂 Categoría'], ['marca', '🏷️ Marca'], ['activo', '👁 Visible en la tienda'], ['a_pedido', '🚚 Por encargo'], ['precio_unico', '🔢 Precio único']];
const radio = (n, L, v) => L.map(([k, t]) => `<label class="mz-r"><input type="radio" name="${n}" value="${k}" ${k === v ? 'checked' : ''} data-change="mz-prev"> ${t}</label>`).join('');
export function modalMasivo(m) {
  const n = PQ.sel.size, t = P.t, cats = [...new Set((P.prods || []).map(p => p.categoria))].sort(), marcas = [...new Set((P.prods || []).map(p => p.marca).filter(Boolean))].sort();
  const secs = SECC.filter(([k]) => (k !== 'a_pedido' || t.modo_stock === 'mixto') && (k !== 'precio_unico' || t.modalidad !== 'minorista') && (k !== 'oferta' || v216()));
  const cuerpo = {
    oferta: `${radio('of_modo', [['poner', 'Poner en oferta'], ['quitar', 'Quitar la oferta']], 'poner')}
      <div class="row2"><div class="fg"><label class="flabel" for="mz-ofp">Descuento %</label><input class="fi" id="mz-ofp" name="of_pct" type="number" min="1" max="90" step="any" placeholder="Ej: 15" data-input="mz-prev"></div>
      <div class="fg"><label class="flabel" for="mz-ofh">Hasta el (incluido)</label><input class="fi" id="mz-ofh" name="of_hasta" type="date" value="${proxDomingo()}"></div></div>
      <div class="fg"><label class="flabel" for="mz-ofd">Desde el (vacío = ya)</label><input class="fi" id="mz-ofd" name="of_desde" type="date"></div>
      <div class="hint">La tienda muestra el precio tachado, la etiqueta -% y el carrusel “Ofertas” si lo activaste. Al terminar vuelve sola al precio normal.</div><div class="mz-prev" id="mz-prev-of"></div>`,
    precio: `${radio('pr_modo', [['pct', 'Subir o bajar el costo un %'], ['usd', 'Poner el mismo costo en USD'], ['margen', 'Poner un margen propio %'], ['general', 'Volver al margen general']], 'pct')}
      <div class="row2"><div class="fg"><label class="flabel" for="mz-pct">% (negativo para bajar)</label><input class="fi" id="mz-pct" name="pr_pct" type="number" step="any" placeholder="Ej: 10 o -5" data-input="mz-prev"></div>
      <div class="fg"><label class="flabel" for="mz-val">Costo USD o margen %</label><input class="fi" id="mz-val" name="pr_val" type="number" step="any" min="0" placeholder="Ej: 12,50 o 45" data-input="mz-prev"></div></div>
      <div class="hint">En Escala el precio sale del costo en USD, la cotización y el margen: así siguen al dólar cuando lo cambiás.</div><div class="mz-prev" id="mz-prev"></div>`,
    stock: `${radio('st_modo', [['fijar', 'Poner este stock'], ['sumar', 'Sumar o restar'], ['sin_control', 'Sin control de stock']], 'fijar')}
      <div class="fg"><label class="flabel" for="mz-st">Cantidad</label><input class="fi" id="mz-st" name="st_val" type="number" step="1" placeholder="Ej: 10 (o -2 para restar)"></div>`,
    nombre: `${radio('nm_modo', [['prefijo', 'Agregar al principio'], ['sufijo', 'Agregar al final'], ['reemplazar', 'Reemplazar un texto']], 'sufijo')}
      <div class="row2"><div class="fg"><label class="flabel" for="mz-nt">Texto a agregar / buscar</label><input class="fi" id="mz-nt" name="nm_txt" maxlength="60" placeholder="Ej: x 12 u."></div>
      <div class="fg"><label class="flabel" for="mz-np">Reemplazar por (vacío = borrarlo)</label><input class="fi" id="mz-np" name="nm_poner" maxlength="60"></div></div>`,
    variantes: `${radio('vr_modo', [['agregar', 'Agregar'], ['quitar', 'Quitar'], ['fijar', 'Reemplazar todas'], ['ninguna', 'Sin variantes']], 'agregar')}
      <div class="fg"><label class="flabel" for="mz-vr">Variantes o talles, separados por coma</label><input class="fi" id="mz-vr" name="vr_vals" maxlength="600" placeholder="Ej: S, M, L, XL"></div>`,
    categoria: `<div class="fg"><label class="flabel" for="mz-cat">Pasar a la categoría</label><input class="fi" id="mz-cat" name="cat" maxlength="60" list="mz-cats" placeholder="Elegí una o escribí una nueva"><datalist id="mz-cats">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>`,
    marca: `<div class="fg"><label class="flabel" for="mz-marca">Marca (vacío = sin marca)</label><input class="fi" id="mz-marca" name="marca" maxlength="60" list="mz-marcas"><datalist id="mz-marcas">${marcas.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>`,
    activo: radio('vis', [['1', 'Sí, que se vean'], ['0', 'No, ocultarlos']], '1'),
    a_pedido: radio('enc', [['1', 'Sí, por encargo'], ['0', 'No, los tengo en stock']], '1'),
    precio_unico: radio('pu', [['1', 'Sí, precio único (sin x3 · x6 · x12)'], ['0', 'No, con precios por cantidad']], '1')
  };
  const abiertas = new Set(m.s ? [m.s] : []);
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal mz" role="dialog" aria-modal="true" aria-labelledby="mz-t"><div class="view-title" id="mz-t">Editar ${n} ${n === 1 ? 'producto' : 'productos'}</div><div id="mz-m"></div>
    <p class="hint" style="margin:-4px 0 10px">Tildá lo que querés cambiar. Lo demás queda como está.</p>
    <form data-submit="mz-aplicar">${secs.map(([k, tt]) => `<div class="mz-sec${abiertas.has(k) ? ' on' : ''}" id="mz-s-${k}"><label class="mz-h"><input type="checkbox" name="on_${k}" data-change="mz-on" data-s="${k}" ${abiertas.has(k) ? 'checked' : ''}> <b>${tt}</b></label><div class="mz-b" ${abiertas.has(k) ? '' : 'hidden'}>${cuerpo[k]}</div></div>`).join('')}
    <button class="btn btn-p" type="submit" id="mz-go">Aplicar a ${n} ${n === 1 ? 'producto' : 'productos'}</button><button type="button" class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cancelar</button></form></div></div>`;
}
export function modalBorrar() {
  const L = [...PQ.sel].map(id => (P.prods || []).find(p => p.id === id)).filter(Boolean), n = L.length;
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="mb-t"><div class="view-title" id="mb-t">¿Eliminar ${n} ${n === 1 ? 'producto' : 'productos'}?</div><div id="mz-m"></div>
    <ul class="mb-l">${L.slice(0, 6).map(p => `<li>${esc(p.nombre)}</li>`).join('')}${n > 6 ? `<li class="muted">y ${n - 6} más</li>` : ''}</ul>
    <p class="hint">No se puede deshacer. Los pedidos que ya recibiste los conservan con su nombre. Si solo querés que no se vean en la tienda, ocultalos.</p>
    <button class="btn btn-p mb-del" data-act="pq-borrar-ok">🗑 Eliminar ${n} ${n === 1 ? 'producto' : 'productos'}</button><button class="btn btn-s" style="margin-top:8px" data-act="pq-vis" data-v="0">🙈 Mejor ocultarlos</button><button class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cancelar</button></div></div>`;
}

/* ---------- acciones ---------- */
const amable = e => /editar_productos_masivo|borrar_productos|Could not find|does not exist|schema cache/i.test(e.message) ? 'Para editar o borrar en masa falta actualizar la base: corré la migración v2.16 en Supabase.' : e.message;
const ids = () => [...PQ.sel].filter(id => (P.prods || []).some(p => p.id === id));
async function recargar() { P.prods = await api.misProductos(); const ex = new Set(P.prods.map(p => p.id)); [...PQ.sel].forEach(id => { if (!ex.has(id)) PQ.sel.delete(id); }); }
on('p-q', (d, el) => { PQ.q = el.value; PQ.pag = 0; P.repintar(); });
on('pq-f', (d, el) => { const v = el.value; if (d.k === 'dias' || d.k === 'por') PQ[d.k] = Number(v); else PQ[d.k] = v; PQ.pag = 0; P.repintar(); });
on('pq-limpiar', () => { Object.assign(PQ, { q: '', cat: '', ver: 'todos', pag: 0 }); P.repintar(); });
on('pq-pag-ir', d => { PQ.pag = Math.max(0, PQ.pag + Number(d.d)); P.repintar(); const l = $('.pq-bar'); if (l) l.scrollIntoView({ block: 'start' }); });
on('pq-sel', (d, el) => { if (el.checked) PQ.sel.add(d.id); else PQ.sel.delete(d.id); P.repintar(); });
on('pq-pag', (d, el) => { const L = filtrados().slice(PQ.pag * PQ.por, PQ.pag * PQ.por + PQ.por); L.forEach(p => el.checked ? PQ.sel.add(p.id) : PQ.sel.delete(p.id)); P.repintar(); });
on('pq-todos', () => { filtrados().forEach(p => PQ.sel.add(p.id)); P.repintar(); });
on('pq-ninguno', () => { PQ.sel.clear(); P.repintar(); });
on('pq-editar', d => { if (!PQ.sel.size) return; P.modal = { tipo: 'masivo', s: d.s || '' }; P.repintar(); if (d.s) { const i = document.querySelector(`#mz-s-${d.s} .mz-b input:not([type=radio])`); if (i) i.focus(); } });
on('pq-flyer', () => { const L = ids(); if (!L.length) return; if (L.length > 4) { toast('Un flyer lleva hasta 4 productos: dejá seleccionados de 1 a 4'); return; } H.flyerDe(L); });
on('pq-combo', () => { const L = ids(); if (L.length < 2 || L.length > 10) { toast('Para un combo seleccioná de 2 a 10 productos'); return; } H.abrirCombo(L); });
on('pq-borrar', () => { if (PQ.sel.size) { P.modal = { tipo: 'borrar-masivo' }; P.repintar(); } });
on('pq-vis', async (d, b) => {
  const L = ids(); if (!L.length) return; b.disabled = true;
  try { const n = await api.editarMasivo(L, { activo: d.v === '1' }); await recargar(); P.modal = null; P.repintar(); toast(`${n} ${n === 1 ? 'producto' : 'productos'} ${d.v === '1' ? 'visibles' : 'ocultos'}`); }
  catch (e) { b.disabled = false; toast(amable(e)); }
});
on('pq-borrar-ok', async (d, b) => {
  const L = ids(); if (!L.length) return; b.disabled = true; b.innerHTML = '<span class="spin"></span> Eliminando…';
  try { const n = await api.borrarMasivo(L); PQ.sel.clear(); await recargar(); P.modal = null; P.repintar(); toast(`${n} ${n === 1 ? 'producto eliminado' : 'productos eliminados'}`); }
  catch (e) { const m = $('#mz-m'); if (m) m.innerHTML = `<div class="err-box">${esc(amable(e))}</div>`; b.disabled = false; b.textContent = 'Reintentar'; }
});
on('mz-on', (d, el) => { const s = $('#mz-s-' + d.s); if (!s) return; s.classList.toggle('on', el.checked); s.querySelector('.mz-b').hidden = !el.checked; if (el.checked) { const i = s.querySelector('.mz-b input:not([type=radio])'); if (i) i.focus(); } previa(); });
on('mz-prev', () => previa());
// "Así queda": el precio de los primeros seleccionados antes y después
function cambiosDe(f) {
  const fd = new FormData(f), c = {}, num = k => { const v = String(fd.get(k) || '').trim().replace(',', '.'); return v === '' ? NaN : Number(v); };
  const err = m => { throw new Error(m); };
  if (fd.get('on_oferta')) {
    if (fd.get('of_modo') === 'quitar') c.oferta = { modo: 'quitar' };
    else {
      const p = num('of_pct'), h = String(fd.get('of_hasta') || ''), d = String(fd.get('of_desde') || '');
      if (!isFinite(p) || p < 1 || p > 90) err('Poné el descuento de la oferta (de 1 a 90 %).');
      if (!h || new Date(h + 'T23:59:59') <= new Date()) err('Poné hasta qué día dura la oferta (hoy o más adelante).');
      if (d && d > h) err('La oferta tiene que empezar antes de terminar.');
      c.oferta = { modo: 'poner', pct: Math.round(p * 100) / 100, hasta: new Date(h + 'T23:59:59').toISOString(), desde: d ? new Date(d + 'T00:00:00').toISOString() : null };
    }
  }
  if (fd.get('on_precio')) {
    const m = fd.get('pr_modo');
    if (m === 'pct') { const v = num('pr_pct'); if (!isFinite(v) || v <= -100 || v > 1000) err('Poné el % a subir (o negativo para bajar), entre -99 y 1000.'); c.costo = { modo: 'pct', valor: v }; }
    else if (m === 'usd') { const v = num('pr_val'); if (!isFinite(v) || v < 0) err('Poné el costo en USD (0 o más).'); c.costo = { modo: 'fijar', valor: v }; }
    else if (m === 'margen') { const v = num('pr_val'); if (!isFinite(v) || v < 0 || v > 1000) err('Poné el margen en % (de 0 a 1000).'); c.margen = { modo: 'fijar', valor: v }; }
    else c.margen = { modo: 'quitar' };
  }
  if (fd.get('on_stock')) {
    const m = fd.get('st_modo'); if (m === 'sin_control') c.stock = { modo: m };
    else { const v = num('st_val'); if (!Number.isInteger(v) || (m === 'fijar' && v < 0)) err(m === 'fijar' ? 'Poné un stock entero de 0 en adelante.' : 'Poné cuánto sumar (o negativo para restar).'); c.stock = { modo: m, valor: v }; }
  }
  if (fd.get('on_nombre')) {
    const m = fd.get('nm_modo'), tx = String(fd.get('nm_txt') || ''), po = String(fd.get('nm_poner') || '');
    if (!tx.trim()) err(m === 'reemplazar' ? 'Escribí el texto que querés reemplazar.' : 'Escribí el texto a agregar.');
    c.nombre = m === 'reemplazar' ? { modo: m, buscar: tx, poner: po } : { modo: m, texto: m === 'prefijo' ? tx.trim() + ' ' : ' ' + tx.trim() };
  }
  if (fd.get('on_variantes')) {
    const m = fd.get('vr_modo'), vals = [...new Set(String(fd.get('vr_vals') || '').split(',').map(x => x.trim()).filter(Boolean))].slice(0, 20);
    if (m !== 'ninguna' && !vals.length) err('Escribí las variantes o talles, separados por coma.');
    c.variantes = { modo: m, valores: m === 'ninguna' ? [] : vals };
  }
  if (fd.get('on_categoria')) { const v = String(fd.get('cat') || '').trim(); if (!v) err('Escribí la categoría.'); c.categoria = v.slice(0, 60); }
  if (fd.get('on_marca')) c.marca = String(fd.get('marca') || '').trim().slice(0, 60);
  if (fd.get('on_activo')) c.activo = fd.get('vis') === '1';
  if (fd.get('on_a_pedido')) c.a_pedido = fd.get('enc') === '1';
  if (fd.get('on_precio_unico')) c.precio_unico = fd.get('pu') === '1';
  return c;
}
function previa() {
  const f = document.querySelector('form[data-submit=mz-aplicar]'); if (!f) return;
  let c; try { c = cambiosDe(f); } catch (e) { c = {}; }
  const L = ids().map(id => P.prods.find(p => p.id === id)).filter(Boolean).slice(0, 3);
  const nuevo = p => { const q = Object.assign({}, p); if (c.costo) q.costo_usd = c.costo.modo === 'fijar' ? c.costo.valor : Math.max(0, Number(p.costo_usd) * (1 + c.costo.valor / 100)); if (c.margen) q.margen_override = c.margen.modo === 'quitar' ? null : c.margen.valor / 100;
    if (c.oferta) { if (c.oferta.modo === 'quitar') q.oferta_pct = null; else Object.assign(q, { oferta_pct: c.oferta.pct, oferta_desde: null, oferta_hasta: c.oferta.hasta }); } return q; };
  const html = `<div class="flabel">Así queda (precio por unidad)</div>${L.map(p => `<div class="mz-ej"><span>${esc(p.nombre)}</span><span>${fmt(H.precioDe(p))} → <b>${fmt(H.precioDe(nuevo(p)))}</b></span></div>`).join('')}${PQ.sel.size > 3 ? `<div class="hint">y ${PQ.sel.size - 3} más</div>` : ''}`;
  const a = $('#mz-prev'), b = $('#mz-prev-of');
  if (a) a.innerHTML = c.costo || c.margen ? html : '';
  if (b) b.innerHTML = c.oferta && !c.costo && !c.margen ? html : '';
}
on('mz-aplicar', async (d, f) => {
  const m = $('#mz-m'), b = $('#mz-go'), L = ids();
  let c; try { c = cambiosDe(f); } catch (e) { if (m) m.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; return; }
  if (!Object.keys(c).length) { if (m) m.innerHTML = '<div class="err-box">Tildá al menos una cosa para cambiar.</div>'; return; }
  b.disabled = true; b.innerHTML = '<span class="spin"></span> Aplicando…';
  try { const n = await api.editarMasivo(L, c); await recargar(); P.modal = null; P.repintar(); toast(`✅ ${n} ${n === 1 ? 'producto actualizado' : 'productos actualizados'}`); }
  catch (e) { if (m) { m.innerHTML = `<div class="err-box">${esc(amable(e))}</div>`; m.scrollIntoView({ block: 'nearest' }); } b.disabled = false; b.textContent = 'Reintentar'; }
});
