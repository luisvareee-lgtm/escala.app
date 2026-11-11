// Planes dentro del panel (elegir / pedir un plan), aviso de fin de prueba y descarga de los datos propios.
import { esc, fmt, on, store, waLink, toast } from './util.js';
import { P, PLAN_NOMBRE, planEf } from './state.js';
import { MARCA, PLANES, urlTiendaDe } from './marca.js';

const diasPrueba = t => t.trial_ends_at ? Math.ceil((new Date(t.trial_ends_at) - Date.now()) / 864e5) : 0;
const porWsp = p => {
  if (!MARCA.SOPORTE_WSP) return '';
  const t = P.t;
  return waLink(MARCA.SOPORTE_WSP, `Hola, quiero activar el plan ${p.nombre} (${fmt(p.precio)}/mes) en ${MARCA.NOMBRE}.\nTienda: ${t.nombre}\nEnlace: ${urlTiendaDe(t.slug)}`);
};
const SUSC = { activa: ['ok', '✓ Suscripción activa: se renueva sola cada mes.'], pausada: ['warn', '⏸ Tu suscripción está en pausa. Reactivala desde Mercado Pago o escribinos.'], cancelada: ['warn', 'Tu suscripción fue cancelada. Para seguir con tu plan, suscribite de nuevo o escribinos.'] };

export function planesHtml(m) {
  const t = P.t, d = diasPrueba(t), act = t.plan, su = SUSC[t.suscripcion_estado], hayAuto = PLANES.some(p => p.auto);
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal modal-ancho planes" role="dialog" aria-modal="true" aria-label="Planes"><div class="view-title">Elegí tu plan</div>
    <p class="hint" style="margin-bottom:10px">${d > 0 ? `Estás en la prueba gratis: te quedan <b>${d} ${d === 1 ? 'día' : 'días'}</b> con todo desbloqueado. ` : ''}Productos y pedidos ilimitados y 0% de comisión por venta en todos los planes. Sin permanencia: cambiás o te vas cuando quieras.</p>
    ${su ? `<p class="plan-susc ${su[0]}" id="plan-susc">${su[1]}</p>` : ''}
    <div class="lp-planes">${PLANES.map(p => { const wsp = porWsp(p), es = d <= 0 && act === p.id; return `<div class="lp-plan${p.destacado || m.plan === p.id ? ' on' : ''}${p.destacado ? ' glow' : ''}">${es ? '<span class="tag ok">Tu plan actual</span>' : p.destacado ? '<span class="tag">Más elegido</span>' : ''}<h3>${esc(p.nombre)}</h3><p class="hint">${esc(p.para)}</p><div class="lp-precio">${fmt(p.precio)}<small>/mes</small></div>
      <ul>${p.incluye.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${es && t.suscripcion_estado === 'activa' ? '' : p.auto
        ? `<a class="btn ${p.destacado ? 'btn-p' : 'btn-s'}" target="_blank" rel="noopener" data-plan="${p.id}" href="${esc(p.link)}">💳 Suscribirme</a>${wsp ? `<a class="plan-alt" target="_blank" rel="noopener" href="${esc(wsp)}">o pedilo por WhatsApp</a>` : ''}`
        : es ? '' : wsp ? `<a class="btn ${p.destacado ? 'btn-p' : 'btn-s'}" target="_blank" rel="noopener" data-plan="${p.id}" href="${esc(wsp)}">Quiero este plan</a>` : '<p class="hint">Escribinos para activarlo.</p>'}</div>`; }).join('')}</div>
    <p class="hint" style="margin-top:10px">${hayAuto ? 'Al suscribirte pagás con Mercado Pago y el plan se activa solo en unos minutos. <b>Usá el mismo email con el que entrás a tu panel</b>, así lo reconocemos; si usás otro, avisanos y lo activamos a mano. ' : 'Al pedirlo te confirmamos el medio de pago y lo activamos en el día. '}Tus productos, pedidos y configuración quedan como están.</p>
    <button class="btn btn-s" style="margin-top:10px" data-act="p-cerrar">Cerrar</button></div></div>`;
}
on('p-planes', d => { P.modal = { tipo: 'planes', plan: d.p || '' }; P.repintar(); });

// Aviso arriba del panel: últimos días de prueba, o prueba terminada en plan Base.
export function avisoPlan() {
  const t = P.t, d = diasPrueba(t), k = 'plan-aviso:' + t.id;
  if (d > 0 && d <= 3) return `<div class="plan-aviso warn"><span>⏳ Te ${d === 1 ? 'queda 1 día' : 'quedan ' + d + ' días'} de prueba con todo desbloqueado.</span><button class="btn btn-p btn-sm" data-act="p-planes">Elegir plan</button></div>`;
  if (d <= 0 && planEf(t) === 'base' && t.trial_ends_at && store.get(k, '') !== String(t.trial_ends_at)) {
    return `<div class="plan-aviso"><span>Tu prueba terminó: seguís en <b>${esc(PLAN_NOMBRE.base)}</b>. El dashboard, la reposición, la lista mayorista con código y el resto de las herramientas Pro están en pausa.</span><span class="plan-aviso-acc"><button class="btn btn-p btn-sm" data-act="p-planes" data-p="pro">Ver planes</button><button class="linkb" data-act="pl-cerrar">Ahora no</button></span></div>`;
  }
  return '';
}
on('pl-cerrar', () => { store.set('plan-aviso:' + P.t.id, String(P.t.trial_ends_at)); P.repintar(); });

// ---- Tus datos: descargar productos y pedidos en CSV (se abre con Excel) ----
const celda = v => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const aCsv = (cab, filas) => '﻿' + [cab, ...filas].map(r => r.map(celda).join(';')).join('\r\n');
function bajar(nombre, texto) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([texto], { type: 'text/csv;charset=utf-8' })); a.download = nombre;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
const num = n => n == null ? '' : String(Number(n)).replace('.', ',');
export function csvProductos() {
  return aCsv(['SKU', 'Nombre', 'Categoría', 'Marca', 'Costo USD', 'Stock', 'Se vende por', 'Contenido', 'Precio único', 'Visible', 'Variantes', 'Imagen', 'Descripción'],
    P.prods.map(p => [p.sku, p.nombre, p.categoria, p.marca, num(p.costo_usd), p.stock, p.unidad, p.contenido, p.precio_unico ? 'sí' : 'no', p.activo ? 'sí' : 'no', (p.variantes || []).join(' | '), p.imagen_url, p.descripcion]));
}
export function csvPedidos() {
  const it = new Map(); P.items.forEach(i => { const l = it.get(i.order_id) || []; l.push(`${i.cantidad} x ${i.nombre_snapshot}${i.variante ? ' (' + i.variante + ')' : ''}`); it.set(i.order_id, l); });
  return aCsv(['N°', 'Fecha', 'Cliente', 'WhatsApp', 'DNI/CUIT', 'Localidad', 'Provincia', 'CP', 'Dirección', 'Envío', 'Costo envío', 'Total', 'Etapa', 'Cobro', 'Pago', 'Seguimiento', 'Nota', 'Detalle'],
    P.pedidos.map(o => [o.numero, new Date(o.created_at).toLocaleString('es-AR'), o.cliente_nombre, o.cliente_whatsapp, o.cliente_dni, o.localidad, o.provincia, o.codigo_postal, o.direccion, o.envio_nombre, num(o.envio_costo), num(o.total_ars), o.etapa, o.estado, o.medio_pago, o.seguimiento, o.nota, (it.get(o.id) || []).join(' + ')]));
}
export const datosHtml = () => `<div class="cc"><h3>💾 Tus datos son tuyos</h3><p class="hint" style="margin-bottom:8px">Descargá una copia cuando quieras. Se abre con Excel o Google Sheets.</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-s btn-sm" data-act="pl-csv" data-k="productos">⬇️ Productos (${P.prods.length})</button><button class="btn btn-s btn-sm" data-act="pl-csv" data-k="pedidos">⬇️ Pedidos (${P.pedidos.length})</button></div></div>`;
on('pl-csv', d => { const f = new Date().toISOString().slice(0, 10); bajar(`${P.t.slug}-${d.k}-${f}.csv`, d.k === 'productos' ? csvProductos() : csvPedidos()); toast('Descargando…'); });
