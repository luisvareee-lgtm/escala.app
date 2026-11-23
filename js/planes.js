// Planes dentro del panel (elegir / pedir un plan), aviso de fin de prueba y descarga de los datos propios.
import { esc, fmt, on, store, waLink, toast } from './util.js';
import { P, PLAN_NOMBRE, planEf, planVencido, TOLERANCIA_DIAS, LIMITE_GRATIS, limiteProductos } from './state.js';
import { MARCA, PLANES, urlTiendaDe, itemPlan } from './marca.js';
import { pruebaFrase } from './fundadores.js';

const diasPrueba = t => t.trial_ends_at ? Math.ceil((new Date(t.trial_ends_at) - Date.now()) / 864e5) : 0;
const DIA = 864e5;
const fechaL = s => new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
// Pago anual: se pagan ANUAL_MESES meses por 12 (por defecto 10 = dos meses gratis).
const ANUAL = (() => { const n = Number(MARCA.ANUAL_MESES); return n > 0 && n < 12 ? n : 0; })();
export const precioPeriodo = (p, anual) => anual && ANUAL ? p.precio * ANUAL : p.precio;
const hayTransf = () => !!(MARCA.PAGO_ALIAS || MARCA.PAGO_CBU);
const titular = () => MARCA.PAGO_TITULAR || (/^\[/.test(MARCA.TITULAR) ? '' : MARCA.TITULAR);
const porWsp = (p, anual) => {
  if (!MARCA.SOPORTE_WSP) return '';
  const t = P.t;
  return waLink(MARCA.SOPORTE_WSP, `Hola, quiero activar el plan ${p.nombre} (${anual && ANUAL ? fmt(precioPeriodo(p, true)) + ' por año' : fmt(p.precio) + '/mes'}) en ${MARCA.NOMBRE}.\nTienda: ${t.nombre}\nEnlace: ${urlTiendaDe(t.slug)}`);
};
const comprobante = (p, anual) => MARCA.SOPORTE_WSP ? waLink(MARCA.SOPORTE_WSP, `Hola, ya transferí ${fmt(precioPeriodo(p, anual))} por el plan ${p.nombre} (${anual && ANUAL ? 'anual' : 'mensual'}).\nTienda: ${P.t.nombre}\nEnlace: ${urlTiendaDe(P.t.slug)}\nTe mando el comprobante 👇`) : '';
const SUSC = { activa: ['ok', '✓ Suscripción activa: se renueva sola cada mes.'], pausada: ['warn', '⏸ Tu suscripción está en pausa. Reactivala desde Mercado Pago o escribinos.'], cancelada: ['warn', 'Tu suscripción fue cancelada. Para seguir con tu plan, suscribite de nuevo o escribinos.'] };

// Estado del plan pagado por transferencia (null si no aplica: prueba, Base, suscripción o sin vencimiento).
export function vencimiento(t) {
  if (!t || diasPrueba(t) > 0 || t.plan === 'base' || !t.plan_hasta || t.suscripcion_estado === 'activa') return null;
  const hasta = new Date(t.plan_hasta), dias = Math.ceil((hasta - Date.now()) / DIA), limite = new Date(hasta.getTime() + TOLERANCIA_DIAS * DIA);
  return { hasta, dias, limite, vencido: planVencido(t), tolerancia: dias <= 0 && !planVencido(t) };
}

function transfHtml(p, anual) {
  const monto = precioPeriodo(p, anual), w = comprobante(p, anual), tit = titular();
  const dato = (n, v) => v ? `<div class="pl-dato"><span>${n}</span><b>${esc(v)}</b><button type="button" class="linkb" data-act="p-copiar" data-v="${esc(v)}">Copiar</button></div>` : '';
  return `<div class="pl-transf" id="pl-transf"><h3>🏦 Pagar ${esc(p.nombre)} por transferencia</h3>
    <p class="hint">Transferí <b>${fmt(monto)}</b>${anual && ANUAL ? ' (12 meses)' : ' (1 mes)'} desde tu banco o billetera virtual a:</p>
    ${dato('Monto', String(Math.round(monto)))}${dato('Alias', MARCA.PAGO_ALIAS)}${dato('CBU / CVU', MARCA.PAGO_CBU)}${tit ? `<div class="pl-dato"><span>Titular</span><b>${esc(tit)}</b></div>` : ''}${MARCA.CUIT && !/^\[/.test(MARCA.CUIT) ? `<div class="pl-dato"><span>CUIT</span><b>${esc(MARCA.CUIT)}</b></div>` : ''}${MARCA.PAGO_BANCO ? `<div class="pl-dato"><span>Banco</span><b>${esc(MARCA.PAGO_BANCO)}</b></div>` : ''}
    ${w ? `<a class="btn btn-wa" target="_blank" rel="noopener" href="${esc(w)}">📲 Ya transferí · enviar comprobante</a>` : MARCA.EMAIL_CONTACTO ? `<p class="hint">Mandá el comprobante a <b>${esc(MARCA.EMAIL_CONTACTO)}</b>.</p>` : ''}
    <p class="hint">Lo activamos apenas vemos el pago (en el día hábil). Tus productos, pedidos y configuración no cambian.</p></div>`;
}

export function planesHtml(m) {
  const t = P.t, d = diasPrueba(t), act = t.plan, su = SUSC[t.suscripcion_estado], anual = !!(ANUAL && m.periodo === 'anual'), tr = hayTransf(), v = vencimiento(t);
  const hayAuto = !anual && PLANES.some(p => p.auto);
  const estadoPlan = v ? `<p class="plan-susc ${v.dias > 5 ? 'ok' : 'warn'}" id="plan-hasta">${v.vencido ? `Tu plan ${esc(PLAN_NOMBRE[act] || act)} venció el ${esc(fechaL(v.hasta))}: estás en el plan ${esc(PLAN_NOMBRE.base)} (hasta ${LIMITE_GRATIS} productos publicados) hasta que lo renueves.` : v.tolerancia ? `Tu plan ${esc(PLAN_NOMBRE[act] || act)} venció el ${esc(fechaL(v.hasta))}. Renovalo antes del ${esc(fechaL(v.limite))} para no perder nada.` : `✓ Tu plan ${esc(PLAN_NOMBRE[act] || act)} está pago hasta el ${esc(fechaL(v.hasta))}.`}</p>` : '';
  const sel = PLANES.find(p => p.id === m.transf && p.precio > 0);
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal modal-ancho planes" role="dialog" aria-modal="true" aria-label="Planes"><div class="view-title">Elegí tu plan</div>
    <p class="hint" style="margin-bottom:10px">${pruebaFrase(t)}${planEf(t) === 'base' ? `Hoy estás en el plan <b>${esc(PLAN_NOMBRE.base)}</b>: publicás hasta ${LIMITE_GRATIS} productos, gratis para siempre. ` : ''}Pedidos ilimitados y 0% de comisión por venta en todos los planes; en los planes pagos publicás todos los productos que quieras. Sin permanencia: cambiás o te vas cuando quieras.</p>
    ${su ? `<p class="plan-susc ${su[0]}" id="plan-susc">${su[1]}</p>` : ''}${estadoPlan}
    ${ANUAL ? `<div class="seg pl-periodo" role="group" aria-label="Forma de pago"><button class="${anual ? '' : 'on'}" data-act="pl-periodo" data-v="mes" aria-pressed="${!anual}">Mensual</button><button class="${anual ? 'on' : ''}" data-act="pl-periodo" data-v="anual" aria-pressed="${anual}">Anual · ${12 - ANUAL === 1 ? '1 mes gratis' : (12 - ANUAL) + ' meses gratis'}</button></div>` : ''}
    <div class="lp-planes">${PLANES.map(p => {
      const gratis = !(p.precio > 0), es = d <= 0 && (act === p.id || (gratis && planEf(t) === 'base')) && !(v && v.vencido && !gratis), precio = precioPeriodo(p, anual);
      const tagP = es ? '<span class="tag ok">Tu plan actual</span>' : p.badge ? `<span class="tag">${esc(p.badge)}</span>` : p.destacado ? '<span class="tag">Más elegido</span>' : '';
      // Gratis ($0): ni transferencia, ni suscripción, ni vencimiento.
      if (gratis) return `<div class="lp-plan lp-plan-gratis${m.plan === p.id ? ' on' : ''}">${tagP}<h3>${esc(p.nombre)}</h3><p class="hint">${esc(p.para)}</p>
      <div class="lp-precio">$0<small>/mes</small></div><p class="pl-ahorro">Gratis para siempre</p>
      <ul>${p.incluye.map(x => `<li>${itemPlan(x, esc)}</li>`).join('')}</ul>${es ? '' : '<p class="hint">Si no renovás un plan pago, tu tienda sigue acá, gratis.</p>'}</div>`;
      const wsp = porWsp(p, anual);
      const renovar = es && v;   // plan pagado por transferencia: se puede renovar
      const principal = es && t.suscripcion_estado === 'activa' ? ''
        : !anual && p.auto && !renovar ? `<a class="btn ${p.destacado ? 'btn-p' : 'btn-s'}" target="_blank" rel="noopener" data-plan="${p.id}" href="${esc(p.link)}">💳 Suscribirme</a>${wsp ? `<a class="plan-alt" target="_blank" rel="noopener" href="${esc(wsp)}">o pedilo por WhatsApp</a>` : ''}`
        : es || tr ? '' : wsp ? `<a class="btn ${p.destacado ? 'btn-p' : 'btn-s'}" target="_blank" rel="noopener" data-plan="${p.id}" href="${esc(wsp)}">Quiero este plan</a>` : '<p class="hint">Escribinos para activarlo.</p>';
      const btnTr = tr && !(es && t.suscripcion_estado === 'activa') ? `<button type="button" class="btn ${(!p.auto || anual || renovar) && p.destacado ? 'btn-p' : 'btn-s'} ${m.transf === p.id ? 'on' : ''}" data-act="pl-transf" data-plan="${p.id}" aria-expanded="${m.transf === p.id}">🏦 ${renovar ? 'Renovar por transferencia' : 'Pagar por transferencia'}</button>` : '';
      return `<div class="lp-plan${p.destacado || m.plan === p.id ? ' on' : ''}${p.destacado ? ' glow' : ''}">${tagP}<h3>${esc(p.nombre)}</h3><p class="hint">${esc(p.para)}</p>
      <div class="lp-precio">${fmt(precio)}<small>${anual ? '/año' : '/mes'}</small></div>${anual ? `<p class="pl-ahorro">Equivale a ${fmt(precio / 12)}/mes · ahorrás ${fmt(p.precio * 12 - precio)}</p>` : ''}
      <ul>${p.incluye.map(x => `<li>${itemPlan(x, esc)}</li>`).join('')}</ul>${principal}${btnTr}</div>`; }).join('')}</div>
    ${sel && tr ? transfHtml(sel, anual) : ''}
    <p class="hint" style="margin-top:10px">${hayAuto ? 'Al suscribirte pagás con Mercado Pago y el plan se activa solo en unos minutos. <b>Usá el mismo email con el que entrás a tu panel</b>, así lo reconocemos; si usás otro, avisanos y lo activamos a mano. ' : tr ? 'Pagás por transferencia y lo activamos en el día. ' : 'Al pedirlo te confirmamos el medio de pago y lo activamos en el día. '}${anual ? 'El pago anual cubre 12 meses desde que lo activamos. ' : ''}Tus productos, pedidos y configuración quedan como están.</p>
    <button class="btn btn-s" style="margin-top:10px" data-act="p-cerrar">Cerrar</button></div></div>`;
}
on('p-planes', d => { P.modal = { tipo: 'planes', plan: d.p || '', periodo: 'mes', transf: d.r && hayTransf() ? d.p : '' }; P.repintar(); if (d.r) setTimeout(() => { const x = document.getElementById('pl-transf'); if (x) x.scrollIntoView({ block: 'nearest' }); }, 60); });
on('pl-periodo', d => { if (P.modal && P.modal.tipo === 'planes') { P.modal.periodo = d.v === 'anual' ? 'anual' : 'mes'; P.repintar(); } });
on('pl-transf', d => {
  if (!P.modal || P.modal.tipo !== 'planes') return;
  P.modal.transf = P.modal.transf === d.plan ? '' : d.plan; P.repintar();
  setTimeout(() => { const x = document.getElementById('pl-transf'); if (x) x.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 60);
});

// Aviso arriba del panel: tienda pausada, plan por vencer o vencido, últimos días de prueba, prueba terminada (plan Gratis)
// o, en Gratis, más productos publicados de los que entran (v2.33).
export function avisoPlan() {
  const t = P.t, d = diasPrueba(t), k = 'plan-aviso:' + t.id, v = vencimiento(t), nom = esc(PLAN_NOMBRE[t.plan] || t.plan);
  if (t.estado === 'suspendido') {
    const w = MARCA.SOPORTE_WSP ? waLink(MARCA.SOPORTE_WSP, `Hola, mi tienda ${t.nombre} (${urlTiendaDe(t.slug)}) está pausada. ¿Cómo la reactivo?`) : '';
    return `<div class="plan-aviso bad" id="aviso-pausada"><span>⏸ Tu tienda está <b>pausada</b>: tus clientes no la pueden ver ni hacer pedidos. Seguís pudiendo entrar a tu panel.</span>${w ? `<a class="btn btn-p btn-sm" target="_blank" rel="noopener" href="${esc(w)}">Escribinos</a>` : ''}</div>`;
  }
  const renovar = `<button class="btn btn-p btn-sm" data-act="p-planes" data-p="${esc(t.plan)}" data-r="1">Renovar</button>`;
  if (v && !v.vencido && v.dias <= 5) {
    return v.tolerancia
      ? `<div class="plan-aviso bad" id="aviso-vence"><span>⚠️ Tu plan <b>${nom}</b> venció el ${esc(fechaL(v.hasta))}. Renovalo antes del ${esc(fechaL(v.limite))} para no perder las herramientas.</span>${renovar}</div>`
      : `<div class="plan-aviso warn" id="aviso-vence"><span>⏳ Tu plan <b>${nom}</b> vence ${v.dias === 1 ? 'mañana' : `en ${v.dias} días`} (${esc(fechaL(v.hasta))}).</span>${renovar}</div>`;
  }
  if (v && v.vencido && store.get(k, '') !== 'v:' + t.plan_hasta) {
    return `<div class="plan-aviso" id="aviso-vence"><span>Tu plan <b>${nom}</b> venció: pasaste al plan <b>${esc(PLAN_NOMBRE.base)}</b> (hasta ${LIMITE_GRATIS} productos publicados). Tus productos y pedidos están intactos; todo vuelve al renovarlo.</span><span class="plan-aviso-acc">${renovar}<button class="linkb" data-act="pl-cerrar" data-v="v:${esc(t.plan_hasta)}">Ahora no</button></span></div>`;
  }
  if (d > 0 && d <= 3) return `<div class="plan-aviso warn"><span>⏳ Te ${d === 1 ? 'queda 1 día' : 'quedan ' + d + ' días'} de prueba con todo desbloqueado.</span><button class="btn btn-p btn-sm" data-act="p-planes">Elegir plan</button></div>`;
  const lim = limiteProductos(t), pub = (P.prods || []).filter(p => p.activo).length;
  if (d <= 0 && planEf(t) === 'base' && t.plan === 'base' && t.trial_ends_at && store.get(k, '') !== String(t.trial_ends_at)) {
    return `<div class="plan-aviso" id="aviso-gratis"><span>Tu prueba terminó: seguís gratis en el plan <b>${esc(PLAN_NOMBRE.base)}</b>, que publica hasta ${LIMITE_GRATIS} productos${pub > LIMITE_GRATIS ? ` (hoy tu tienda muestra ${LIMITE_GRATIS} de tus ${pub})` : ''}. Las escalas de precio, el importador de fotos y PDF, presupuestos, caja, cobranzas, el dashboard y el resto de las herramientas de ${esc(PLAN_NOMBRE.pro)} quedan en pausa (tus datos siguen guardados).</span><span class="plan-aviso-acc"><button class="btn btn-p btn-sm" data-act="p-planes" data-p="pro">Ver planes</button><button class="linkb" data-act="pl-cerrar">Ahora no</button></span></div>`;
  }
  if (lim != null && pub > lim) {
    return `<div class="plan-aviso warn" id="aviso-cupo"><span>📦 Plan ${esc(PLAN_NOMBRE.base)}: tu tienda muestra <b>${lim} de tus ${pub}</b> productos publicados (los primeros que cargaste). Pausá los que no quieras mostrar o pasate a ${esc(PLAN_NOMBRE.pro)} para mostrar todos.</span><button class="btn btn-p btn-sm" data-act="p-planes" data-p="pro">Ver planes</button></div>`;
  }
  return '';
}
on('pl-cerrar', d => { store.set('plan-aviso:' + P.t.id, d.v || String(P.t.trial_ends_at)); P.repintar(); });

// ---- Tus datos: descargar productos y pedidos en CSV (se abre con Excel) ----
const celda = v => { const s = v == null ? '' : String(v); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const aCsv = (cab, filas) => '﻿' + [cab, ...filas].map(r => r.map(celda).join(';')).join('\r\n');
export function bajar(nombre, texto) {
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
