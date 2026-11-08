// Resultado del negocio: lo que entró, lo que costó lo vendido, gastos, compras y ganancia neta.
// Más: valor del stock, productos más rentables, sin rotación, por agotarse y ventas por zona.
import { api } from './api.js';
import { $, esc, fmt, on, toast, confirmar } from './util.js';
import { P, precioArs } from './state.js';
import { barras } from './charts.js';

const R = { per: 'mes', cargado: false, lim: 20, cat: '' };
export const CATS_GASTO = ['Mercadería', 'Envíos y fletes', 'Publicidad', 'Alquiler', 'Servicios', 'Sueldos', 'Comisiones', 'Impuestos', 'Packaging', 'Otros'];
export async function cargarGastos(forzar) {
  if (R.cargado && !forzar) return;
  try { P.gastos = await api.misGastos(); R.cargado = true; } catch (e) { P.gastos = P.gastos || []; toast(e.message); }
}
export const resetRes = () => Object.assign(R, { per: 'mes', cargado: false, lim: 20, cat: '' });

const PER = [['mes', 'Este mes'], ['pasado', 'Mes pasado'], ['30', 'Últimos 30 días'], ['anio', 'Este año'], ['todo', 'Todo']];
function rango() {
  const h = new Date(), y = h.getFullYear(), m = h.getMonth();
  if (R.per === 'mes') return [new Date(y, m, 1), new Date(y, m + 1, 1), 1];
  if (R.per === 'pasado') return [new Date(y, m - 1, 1), new Date(y, m, 1), 1];
  if (R.per === '30') { const a = new Date(h); a.setDate(a.getDate() - 29); a.setHours(0, 0, 0, 0); return [a, new Date(h.getTime() + 864e5), 1]; }
  if (R.per === 'anio') return [new Date(y, 0, 1), new Date(y + 1, 0, 1), m + 1];
  return [new Date(2000, 0, 1), new Date(h.getTime() + 864e5), null];
}
const enRango = (d, [a, b]) => { const x = new Date(d); return x >= a && x < b; };
const fechaG = g => new Date(g.fecha + 'T12:00:00');

export function calcularResultado() {
  const rg = rango(), t = P.t, cot = Number(t.cotizacion_usd);
  const prodPor = new Map(P.prods.map(p => [p.id, p]));
  const ped = P.pedidos.filter(o => o.estado !== 'cancelado' && enRango(o.created_at, rg));
  const ids = new Set(ped.map(o => o.id));
  const items = P.items.filter(i => ids.has(i.order_id));
  let costo = 0, sinCosto = 0;
  const porProd = new Map();
  for (const i of items) {
    const p = prodPor.get(i.product_id);
    const cu = i.costo_unitario != null ? Number(i.costo_unitario) : p ? Number(p.costo_usd) * cot : null;
    if (cu == null) sinCosto++;
    const c = (cu || 0) * i.cantidad; costo += c;
    const k = i.product_id || i.nombre_snapshot, x = porProd.get(k) || { label: i.nombre_snapshot, v: 0, u: 0, venta: 0 };
    x.venta += Number(i.subtotal); x.v += Number(i.subtotal) - c; x.u += i.cantidad; porProd.set(k, x);
  }
  const envios = ped.reduce((s, o) => s + Number(o.envio_costo || 0), 0);
  const ventas = ped.reduce((s, o) => s + Number(o.total_ars), 0) - envios;      // solo productos
  const cobrado = ped.filter(o => o.estado === 'cobrado').reduce((s, o) => s + Number(o.total_ars), 0);
  const porCobrar = ped.filter(o => o.estado === 'pendiente').reduce((s, o) => s + Number(o.total_ars), 0);
  const comisiones = ped.reduce((s, o) => s + Number(o.comision_ars || 0), 0);
  const G = (P.gastos || []).filter(g => enRango(fechaG(g), rg));
  const gastos = G.filter(g => g.tipo === 'gasto').reduce((s, g) => s + Number(g.monto), 0);
  const compras = G.filter(g => g.tipo === 'compra').reduce((s, g) => s + Number(g.monto), 0);
  const fijos = rg[2] ? Number(t.gastos_fijos || 0) * rg[2] : 0;
  const bruta = ventas - costo, neta = bruta - comisiones - gastos - fijos;
  const porCat = new Map(); G.filter(g => g.tipo === 'gasto').forEach(g => porCat.set(g.categoria, (porCat.get(g.categoria) || 0) + Number(g.monto)));
  // zonas: localidad o método de envío
  const zonas = new Map(); ped.forEach(o => { const z = (o.localidad || o.envio_nombre || 'Sin dato').trim() || 'Sin dato'; const x = zonas.get(z) || { v: 0, n: 0 }; x.v += Number(o.total_ars); x.n++; zonas.set(z, x); });
  return { ped, ventas, envios, cobrado, porCobrar, costo, sinCosto, comisiones, gastos, compras, fijos, bruta, neta, G,
    margen: ventas > 0 ? Math.round(neta / ventas * 100) : null,
    top: [...porProd.values()].sort((a, b) => b.v - a.v).slice(0, 8),
    cats: [...porCat.entries()].map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v),
    zonas: [...zonas.entries()].map(([label, x]) => ({ label, v: x.v, tip: label + ' · ' + x.n + ' pedidos · ' + fmt(x.v) })).sort((a, b) => b.v - a.v).slice(0, 8) };
}

function stock() {
  const t = P.t, cot = Number(t.cotizacion_usd), con = P.prods.filter(p => p.activo && p.stock != null && p.stock > 0);
  let c = 0, min = 0, may = 0, u = 0;
  for (const p of con) {
    const ovr = p.margen_override, m1 = ovr == null ? Number(t.margen_1) : Number(ovr), sh = ovr == null ? 0 : Number(ovr) - Number(t.margen_1);
    c += Number(p.costo_usd) * cot * p.stock; u += p.stock;
    min += precioArs(p.costo_usd, cot, m1) * p.stock;
    may += precioArs(p.costo_usd, cot, Math.max(0, (p.precio_unico ? Number(t.margen_1) : Number(t.margen_12)) + sh)) * p.stock;
  }
  const hace60 = Date.now() - 60 * 864e5, vendidos = new Set();
  const recientes = new Set(P.pedidos.filter(o => o.estado !== 'cancelado' && new Date(o.created_at) >= hace60).map(o => o.id));
  P.items.forEach(i => { if (recientes.has(i.order_id) && i.product_id) vendidos.add(i.product_id); });
  const viejo = p => new Date(p.created_at) < hace60;
  const sinRot = P.prods.filter(p => p.activo && !vendidos.has(p.id) && viejo(p) && (p.stock == null || p.stock > 0));
  const umbral = Math.max(3, Number(t.aviso_stock || 0));
  const agot = P.prods.filter(p => p.activo && p.stock != null && p.stock <= umbral).sort((a, b) => a.stock - b.stock);
  return { n: con.length, u, c, min, may, sinRot, agot, umbral, inmov: sinRot.filter(p => p.stock).reduce((s, p) => s + Number(p.costo_usd) * cot * p.stock, 0) };
}

const fmtS = n => n < 0 ? '−' + fmt(-n) : fmt(n);
const fila = (t, v, cls = '', tip = '') => `<div class="srow ${cls}"${tip ? ` title="${esc(tip)}"` : ''}><span>${t}</span><span class="v">${v}</span></div>`;
export function vistaResultado() {
  const M = calcularResultado(), S = stock(), hoy = new Date().toISOString().slice(0, 10);
  const GL = M.G.filter(g => !R.cat || g.categoria === R.cat);
  return `<div class="seg" role="group" aria-label="Período" style="margin-bottom:12px;flex-wrap:wrap">${PER.map(([k, n]) => `<button class="${R.per === k ? 'on' : ''}" data-act="r-per" data-k="${k}">${n}</button>`).join('')}</div>
  <div class="kpis"><div class="kpi"><small>Vendiste (productos)</small><b>${fmt(M.ventas)}</b><i>${M.ped.length} ${M.ped.length === 1 ? 'pedido' : 'pedidos'}${M.envios ? ' · + ' + fmt(M.envios) + ' de envíos' : ''}</i></div>
    <div class="kpi"><small>Ganancia neta</small><b class="${M.neta < 0 ? 'neg' : 'pos'}">${fmtS(M.neta)}</b><i>${M.margen == null ? 'sin ventas' : M.margen + '% de lo vendido'}</i></div>
    <div class="kpi"><small>Cobrado</small><b>${fmt(M.cobrado)}</b><i>${fmt(M.porCobrar)} por cobrar</i></div>
    <div class="kpi"><small>Salidas (gastos, fijos y compras)</small><b>${fmt(M.gastos + M.compras + M.fijos)}</b><i>${M.G.length} ${M.G.length === 1 ? 'movimiento' : 'movimientos'}</i></div></div>
  <div class="grid2"><div class="cc"><h3>📒 Estado de resultado</h3>
    ${fila('Ventas de productos', fmt(M.ventas))}
    ${fila('− Costo de lo vendido', fmt(M.costo), '', 'Costo de cada producto al momento de la venta')}
    ${fila('<b>= Ganancia bruta</b>', '<b>' + fmtS(M.bruta) + '</b>')}
    ${M.comisiones ? fila('− Comisiones a revendedores', fmt(M.comisiones)) : ''}
    ${fila('− Gastos cargados', fmt(M.gastos))}
    ${M.fijos ? fila('− Gastos fijos (de Ajustes)', fmt(M.fijos), '', 'El gasto fijo mensual que cargaste en Ajustes, por cada mes del período') : ''}
    ${fila('<b>= Ganancia neta</b>', `<b class="${M.neta < 0 ? 'neg' : 'pos'}">${fmtS(M.neta)}</b>`, 'tot')}
    <p class="hint" style="margin-top:6px">Los envíos cobrados (${fmt(M.envios)}) no cuentan como ganancia: se los pagás al transporte. Las compras de mercadería (${fmt(M.compras)}) tampoco se restan acá, porque el costo de lo vendido ya incluye la mercadería${M.sinCosto ? `. ${M.sinCosto} líneas sin costo conocido (producto borrado)` : ''}.</p></div>
  <div class="cc"><h3>💵 Caja del período</h3>
    ${fila('Entró (pedidos cobrados)', fmt(M.cobrado))}
    ${fila('Salió en compras', fmt(M.compras))}
    ${fila('Salió en gastos' + (M.fijos ? ' y fijos' : ''), fmt(M.gastos + M.fijos))}
    ${M.comisiones ? fila('Comisiones', fmt(M.comisiones)) : ''}
    ${fila('<b>Diferencia</b>', `<b class="${M.cobrado - M.compras - M.gastos - M.fijos - M.comisiones < 0 ? 'neg' : 'pos'}">${fmtS(M.cobrado - M.compras - M.gastos - M.fijos - M.comisiones)}</b>`, 'tot')}
    <p class="hint" style="margin-top:6px">Es la plata que entró menos la que salió. Si compraste mercadería para stock, la caja baja aunque el negocio gane.</p></div></div>
  <div class="cc"><h3>➕ Cargar gasto o compra</h3><div id="gm"></div>
    <form data-submit="r-gasto" class="gasto-f">
      <div class="seg" role="group" aria-label="Tipo"><label><input type="radio" name="tipo" value="gasto" checked> Gasto</label><label><input type="radio" name="tipo" value="compra"> Compra de mercadería</label></div>
      <div class="row2"><div class="fg"><label class="flabel" for="g-con">Concepto</label><input class="fi" id="g-con" name="concepto" maxlength="120" required placeholder="Ej: Publicidad en Instagram"></div>
      <div class="fg"><label class="flabel" for="g-mon">Monto $</label><input class="fi" id="g-mon" name="monto" type="number" min="1" step="any" required inputmode="decimal"></div></div>
      <div class="row2"><div class="fg"><label class="flabel" for="g-cat">Categoría</label><select class="fi" id="g-cat" name="categoria">${CATS_GASTO.map(c => `<option>${c}</option>`).join('')}</select></div>
      <div class="fg"><label class="flabel" for="g-fec">Fecha</label><input class="fi" id="g-fec" name="fecha" type="date" value="${hoy}" max="${hoy}" required></div></div>
      <div class="fg"><label class="flabel" for="g-prov">Proveedor (opcional)</label><input class="fi" id="g-prov" name="proveedor" maxlength="80"></div>
      <button class="btn btn-p btn-sm" type="submit">Guardar</button></form></div>
  <div class="grid2"><div class="cc"><h3>Gastos por categoría</h3>${barras(M.cats.map(c => ({ ...c, tip: c.label + ' · ' + fmt(c.v) })), fmt)}</div>
  <div class="cc"><h3>Movimientos ${R.cat ? '· ' + esc(R.cat) + ' <button class="tag" data-act="r-cat" data-c="">✕</button>' : ''}</h3>
    ${GL.slice(0, R.lim).map(g => `<div class="srow"><span>${g.tipo === 'compra' ? '📦' : '🧾'} ${esc(g.concepto)}<br><small class="muted">${fechaG(g).toLocaleDateString('es-AR')} · <button class="linkb" data-act="r-cat" data-c="${esc(g.categoria)}">${esc(g.categoria)}</button>${g.proveedor ? ' · ' + esc(g.proveedor) : ''}</small></span><span style="display:flex;gap:6px;align-items:center"><span class="v">${fmt(g.monto)}</span><button class="btn btn-s btn-sm" data-act="r-del" data-id="${g.id}" aria-label="Borrar ${esc(g.concepto)}">✕</button></span></div>`).join('') || '<p class="muted">Sin gastos ni compras en este período.</p>'}
    ${GL.length > R.lim ? `<button class="btn btn-s btn-sm" data-act="r-mas">Ver más (${GL.length - R.lim})</button>` : ''}</div></div>
  <div class="grid2"><div class="cc"><h3>🏆 Más rentables</h3>${barras(M.top.map(x => ({ label: x.label, v: Math.max(0, x.v), tip: x.label + ' · ' + x.u + ' u. · ganancia ' + fmt(x.v) + ' de ' + fmt(x.venta) })), fmt)}</div>
  <div class="cc"><h3>📍 Ventas por zona</h3>${barras(M.zonas, fmt)}</div></div>
  <div class="cc"><h3>🏷️ Valor del stock</h3>${S.n ? `<div class="kpis kpis3"><div class="kpi"><small>Al costo</small><b>${fmt(S.c)}</b><i>${S.u} unidades · ${S.n} productos</i></div><div class="kpi"><small>A precio minorista</small><b>${fmt(S.min)}</b><i>si vendés todo al público</i></div>${P.t.modalidad !== 'minorista' ? `<div class="kpi"><small>A precio mayorista x12</small><b>${fmt(S.may)}</b><i>vendiendo por cantidad</i></div>` : ''}</div>` : '<p class="muted">Cargá el stock en tus productos para ver cuánto vale tu mercadería.</p>'}</div>
  <div class="grid2"><div class="cc"><h3>⚠️ Por agotarse (${S.umbral} o menos)</h3>${S.agot.slice(0, 8).map(p => `<div class="srow" data-act="p-editar" data-id="${p.id}" role="button" tabindex="0" style="cursor:pointer"><span>${esc(p.nombre)}</span><span class="v ${p.stock <= 0 ? 'neg' : ''}">${p.stock <= 0 ? 'agotado' : p.stock}</span></div>`).join('') || '<p class="muted">Sin alertas (o sin control de stock).</p>'}</div>
  <div class="cc"><h3>💤 Sin ventas en 60 días</h3>${S.sinRot.length ? `<p class="hint" style="margin-bottom:6px">${S.sinRot.length} productos${S.inmov ? ' · ' + fmt(S.inmov) + ' inmovilizados al costo' : ''}. Probá una oferta o un combo.</p>` + S.sinRot.slice(0, 8).map(p => `<div class="srow" data-act="p-editar" data-id="${p.id}" role="button" tabindex="0" style="cursor:pointer"><span>${esc(p.nombre)}</span><span class="v">${p.stock != null ? p.stock + ' u.' : ''}</span></div>`).join('') : '<p class="muted">Todo lo que tiene más de 60 días se vendió al menos una vez.</p>'}</div></div>`;
}

on('r-per', d => { R.per = d.k; R.lim = 20; P.repintar(); });
on('r-cat', d => { R.cat = R.cat === d.c || !d.c ? '' : d.c; P.repintar(); });
on('r-mas', () => { R.lim += 40; P.repintar(); });
on('r-gasto', async (d, f) => {
  const fd = new FormData(f), b = f.querySelector('button[type=submit]');
  const g = { tenant_id: P.t.id, tipo: fd.get('tipo') === 'compra' ? 'compra' : 'gasto', concepto: String(fd.get('concepto') || '').trim(), monto: Math.round(Number(fd.get('monto')) * 100) / 100,
    categoria: fd.get('tipo') === 'compra' ? 'Mercadería' : String(fd.get('categoria') || 'Otros'), fecha: fd.get('fecha'), proveedor: String(fd.get('proveedor') || '').trim() || null };
  if (!g.concepto || !(g.monto > 0)) { $('#gm').innerHTML = '<div class="err-box">Completá el concepto y un monto mayor a cero.</div>'; return; }
  b.disabled = true;
  try { await api.guardarGasto(null, g); await cargarGastos(true); toast('Guardado'); P.repintar(); }
  catch (e) { b.disabled = false; $('#gm').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; }
});
on('r-del', async (d, b) => {
  if (!confirmar(b, '¿Borrar?')) return;
  try { await api.borrarGasto(d.id); P.gastos = P.gastos.filter(g => g.id !== d.id); P.repintar(); } catch (e) { toast(e.message); }
});
