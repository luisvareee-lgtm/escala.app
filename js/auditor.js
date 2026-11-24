// v2.36 · Auditor comercial (plan Mayorista IA): revisa la tienda por vos con las visitas y las ventas de los últimos
// 30 días (60 para el stock parado). Lo calcula la base de datos (auditor_comercial), que también decide quién lo ve:
// el dueño y Administración. Si está programado, los lunes a las 9 llega el resumen al celular.
import { api } from './api.js';
import { $, esc, fmt, on, toast } from './util.js';
import { P, can, bloqueo } from './state.js';

const A = { datos: null, cargando: false, err: '' };
export const resetAuditor = () => Object.assign(A, { datos: null, cargando: false, err: '' });
// después de guardar o borrar un producto, la próxima vez que se abra el Auditor se revisa de nuevo
export const auditorViejo = () => { if (!A.cargando) A.datos = null; A.err = ''; };
const LISTAS = ['se_agotan', 'ganancia_baja', 'vistos_sin_venta', 'carrito_sin_compra', 'stock_parado', 'sin_costo', 'sin_foto'];
const n = k => Number(A.datos && A.datos[k] && A.datos[k].n) || 0;
export const totalAuditor = d => LISTAS.reduce((t, k) => t + (Number(d && d[k] && d[k].n) || 0), 0);
const hace = f => { const d = Math.floor((Date.now() - new Date(f)) / 864e5); return d <= 0 ? 'hoy' : d === 1 ? 'hace 1 día' : 'hace ' + d + ' días'; };
const pl = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`;

async function cargar(enLugar) {
  if (A.cargando) return; A.cargando = true; A.err = '';
  try { A.datos = await api.auditor(); } catch (e) { A.err = e.message || 'No se pudo revisar la tienda.'; }
  A.cargando = false;
  if (enLugar) { const box = $('#aud-aviso'), h = avisoHtml(); if (box) { box.className = h ? 'ia-avisos' : ''; box.innerHTML = h; } return; }
  P.repintar();
}

// Qué mirar, de lo que más plata te hace perder a lo que menos. Cada una: título, qué hacer y el detalle de cada producto.
const SEC = {
  se_agotan: ['⏳ Se agotan pronto', 'Al ritmo de venta de este mes se terminan antes de 10 días. Pedilos ya para no perder ventas.',
    i => i.disp <= 0 && !(i.por_dia > 0) ? 'Agotado, y lo siguen mirando' : `Quedan ${i.disp} · vendés ${String(i.por_dia).replace('.', ',')} por día · ${i.dias <= 0 ? 'se termina hoy' : 'alcanza para ' + pl(i.dias, 'día', 'días')}`],
  ganancia_baja: ['📉 Ganancia baja', 'Ganás menos del 15 % (o perdés) en tu precio más bajo. Revisá el costo, el margen propio o la oferta.',
    i => `${i.pct < 0 ? 'Vendés a pérdida: ' + i.pct + ' %' : 'Ganás ' + i.pct + ' %'} ${A.datos.modalidad === 'minorista' ? 'en el precio al público' : 'en tu precio más bajo (x12)'}${i.con_oferta ? ', por la oferta que tiene' : ''}`],
  vistos_sin_venta: ['👀 Muy vistos, sin ventas', 'Llaman la atención pero no se compran. Probá con mejor foto y descripción (✨ ficha con IA), un precio más competitivo o una oferta corta.',
    i => `${pl(i.vistas, 'visita', 'visitas')} en 30 días y ninguna venta${i.foto ? '' : ' · no tiene foto'}`],
  carrito_sin_compra: ['🛒 Van al carrito y no se compran', 'Los eligen y después se arrepienten: revisá el costo del envío, el mínimo de compra y si el precio por cantidad conviene.',
    i => `${pl(i.agregados, 'vez', 'veces')} al carrito en 30 días, ninguna compra`],
  stock_parado: ['🧊 Stock parado', 'Más de 60 días sin venderse. Armá un combo o una oferta para liberar esa plata.',
    i => `${i.stock} en stock · ${fmt(i.plata)} al costo · ${i.ultima ? 'última venta ' + hace(i.ultima) : 'nunca se vendió'}`],
  sin_costo: ['❔ Sin costo cargado', 'Sin el costo no se puede calcular bien el precio ni tu ganancia.', () => 'Cargá el costo en USD'],
  sin_foto: ['📷 Los visitan y no tienen foto', 'Los miran sin ver cómo son. Con foto se venden más.', i => `${pl(i.vistas, 'visita', 'visitas')} en 30 días`],
};
function accion(k, i) {
  if (P.miembro) return '';   // Administración no edita productos
  if (k === 'se_agotan' && can('stock') && (P.t.modo_stock || 'stock') !== 'encargo') return `<button class="btn btn-s btn-sm" data-act="ia-vista" data-k="reposicion">Reponer</button>`;
  return `<button class="btn btn-s btn-sm" data-act="p-editar" data-id="${esc(i.id)}">Editar</button>`;
}
function seccion(k) {
  const L = A.datos[k], [tit, que, det] = SEC[k];
  if (!L || !L.n) return '';
  const extra = L.n > L.items.length ? `<p class="hint" style="margin-top:6px">Y ${pl(L.n - L.items.length, 'producto más', 'productos más')}.</p>` : '';
  return `<div class="cc aud-sec" data-aud="${k}"><h3>${tit} <span class="tag ${k === 'se_agotan' || k === 'ganancia_baja' ? 'bad' : 'warn'}">${L.n}</span></h3>
    <p class="hint" style="margin-bottom:6px">${esc(que)}${k === 'stock_parado' ? ` <b>${fmt(L.plata)}</b> parados al costo.` : ''}</p>
    ${L.items.map(i => `<div class="srow aud-row"><span>${esc(i.nombre)}<br><small class="muted">${esc(det(i))}</small></span><span>${accion(k, i)}</span></div>`).join('')}${extra}</div>`;
}

export function vistaAuditor() {
  if (!can('auditor')) return bloqueo('🕵️ Auditor comercial', 'Revisa tu tienda por vos: productos muy vistos que no se venden, los que se agotan, stock parado, ganancia baja y productos sin foto o sin costo. Y te manda un resumen al celular los lunes.', 'auditor');
  if (!A.datos && !A.cargando && !A.err) setTimeout(cargar, 0);
  if (A.err) return `<div class="cc"><h3>🕵️ Auditor comercial</h3><div class="err-box">${esc(A.err)}</div><button class="btn btn-s btn-sm" style="margin-top:8px" data-act="aud-act">Probar de nuevo</button></div>`;
  if (!A.datos) return `<div class="cc"><h3>🕵️ Auditor comercial</h3><p class="muted"><span class="spin"></span> Revisando tus productos, visitas y ventas…</p></div>`;
  const d = A.datos, tot = totalAuditor(d);
  const semanal = P.miembro || !d.programado ? '' : `<div class="aud-sem"><label class="chk"><input type="checkbox" data-change="aud-semanal" ${d.semanal ? 'checked' : ''}> 🔔 Mandarme este resumen al celular los lunes a las 9</label>${d.semanal && !d.con_avisos ? '<p class="hint">Para que te llegue, activá los avisos en tu celular: Ajustes → “🔔 Activar avisos en este dispositivo”.</p>' : ''}</div>`;
  return `<div class="cc aud-top"><div class="aud-cab"><h3>🕵️ Auditor comercial</h3><button class="btn btn-s btn-sm" data-act="aud-act" title="Volver a revisar">↻ Actualizar</button></div>
    <p class="hint">Revisamos tus ${pl(d.productos, 'producto activo', 'productos activos')} con las visitas y las ventas de los últimos 30 días (60 para el stock parado).${d.medido ? '' : ' Todavía no hay visitas a productos registradas: las alertas de visitas aparecen cuando entre gente a tu tienda.'}</p>${semanal}</div>
  <div class="kpis"><div class="kpi ${tot ? 'cob-warn' : ''}"><small>Para mirar</small><b>${tot}</b><i>${tot ? 'cosas que te hacen perder ventas o plata' : 'todo en orden'}</i></div>
    <div class="kpi ${n('se_agotan') ? 'cob-bad' : ''}"><small>Se agotan pronto</small><b>${n('se_agotan')}</b><i>en menos de 10 días</i></div>
    <div class="kpi"><small>Plata parada en stock</small><b>${fmt((d.stock_parado && d.stock_parado.plata) || 0)}</b><i>${pl(n('stock_parado'), 'producto', 'productos')} sin venta en 60 días</i></div>
    <div class="kpi"><small>Visitas a productos</small><b>${Number(d.vistas || 0).toLocaleString('es-AR')}</b><i>${pl(n('vistos_sin_venta') + n('carrito_sin_compra'), 'producto mirado', 'productos mirados')} que no se vende${n('vistos_sin_venta') + n('carrito_sin_compra') === 1 ? '' : 'n'}</i></div></div>
  ${tot ? LISTAS.map(seccion).join('') : '<div class="ok-box">Todo en orden: no encontramos nada para corregir con las visitas y las ventas de los últimos 30 días. 🎉</div>'}`;
}

// Aviso para el Resumen del dueño: se revisa en segundo plano y aparece solo si hay algo para mirar.
function avisoHtml() {
  const t = totalAuditor(A.datos);
  if (!A.datos || !t) return '';
  const top = n('se_agotan') ? pl(n('se_agotan'), 'producto se agota', 'productos se agotan') + ' pronto' : n('vistos_sin_venta') ? pl(n('vistos_sin_venta'), 'muy visto', 'muy vistos') + ' sin ventas' : n('stock_parado') ? fmt(A.datos.stock_parado.plata) + ' parados en stock' : '';
  return `<button class="ia-aviso warn" data-act="ia-ir" data-k="auditor"><span class="ia-tx">🕵️ El Auditor encontró <b>${pl(t, 'cosa', 'cosas')} para mirar</b>${top ? ' · ' + esc(top) : ''}</span><span class="ia-go">Ver →</span></button>`;
}
export function avisoAuditor() {
  if (P.miembro || !can('auditor')) return '';
  if (!A.datos && !A.cargando && !A.err) setTimeout(() => cargar(true), 0);
  const h = avisoHtml();
  return `<div id="aud-aviso"${h ? ' class="ia-avisos"' : ''}>${h}</div>`;
}

on('aud-act', () => { resetAuditor(); P.repintar(); });
on('aud-semanal', async (d, el) => {
  const v = el.checked;
  try { await api.auditorSemanal(P.t.id, v); A.datos.semanal = v; P.t.auditor_semanal = v; toast(v ? '🔔 Listo: los lunes te llega el resumen' : 'Listo: no te mandamos el resumen'); P.repintar(); }
  catch (e) { el.checked = !v; toast(e.message); }
});
