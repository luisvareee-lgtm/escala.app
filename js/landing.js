// Portada: por qué elegir Escala, simuladores (precios por volumen y costo mensual), planes, preguntas y legales.
import { esc, fmt, on, $ } from './util.js';
import { MARCA, PLANES, REFERENCIA } from './marca.js';
import { demoHtml } from './demo.js';

const SIM = { costo: 10, dolar: 1200, m1: 50, m12: 20, ventas: 3000000 };
const precio = (c, d, m) => Math.ceil(c * d * (1 + m / 100) / 10) * 10;   // mismo cálculo que la base de datos

const PORQUE = [
  ['💲', 'Tus costos reales, no un precio a ojo', 'Cargás el costo (en dólares o pesos) y tus márgenes: la app calcula el precio de cada escalón. Cambia el dólar y se actualiza todo el catálogo. Nunca vendés por debajo de tu margen mínimo.'],
  ['📦', 'Precios por volumen en todos los planes', 'x1 · x3 · x6 · x12 con el descuento a la vista y el aviso “sumá 2 más y ahorrás”. Por unidad, caja, bulto, kg o metro, o precio único.'],
  ['♾️', 'Sin límites y 0% por venta', 'Productos, pedidos y visitas ilimitados. No te cobramos un porcentaje de lo que vendés: pagás un abono fijo y listo.'],
  ['🔄', 'Lista viva: precios al día en un minuto', 'Subís la lista nueva del proveedor y la app te muestra qué subió, qué bajó y qué hay de nuevo. Un toque actualiza todo con tu ganancia y te deja listo el aviso para tus clientes.'],
  ['💰', 'Tu cliente ve cuánto gana', 'En tu lista mayorista cada producto muestra a cuánto revenderlo y la ganancia por unidad. Tu catálogo deja de ser una lista de precios: es una oportunidad de negocio.'],
  ['📥', 'Lee tus datos como vengan', 'Fotos del proveedor con el precio escrito, capturas de canales, el chat de WhatsApp exportado, Excel, PDF o el CSV de tu tienda actual. Revisás y publicás con tu margen.'],
  ['🧠', 'Un asistente que cuida tu plata', 'Quién te debe y hace cuánto (con el recordatorio armado), qué se te acaba antes de que llegue la compra, y cuánto ganaste de verdad, en pesos y en dólares.'],
  ['🧾', 'Pedidos y tienda con tu marca', 'Pedidos por etapas con remito y mensajes de WhatsApp listos, envíos con costo, banners, “Cómo comprar” y preguntas frecuentes. Todo con tu logo y tus colores.']
];
const FAQ = [
  ['¿Necesito saber de computación?', 'No. Creás la cuenta, ponés el nombre de tu negocio y tu WhatsApp, y una guía te acompaña paso a paso. Si te trabás, tocás “Ayuda” y escribís tu problema.'],
  ['¿Me cobran comisión por cada venta?', 'No. Pagás solo el abono mensual. Si cobrás con Mercado Pago, la plata entra directo a tu cuenta y solo aplica la comisión de Mercado Pago.'],
  ['¿Cuántos productos y pedidos puedo tener?', 'Todos los que quieras, en todos los planes.'],
  ['¿Puedo vender por menor y por mayor con el mismo enlace?', 'Sí. El público ve el precio final y tus revendedores entran con un código a la lista por cantidad (plan Mayorista Pro).'],
  ['¿Cómo cargo mi lista de precios?', 'Subís lo que te manda el proveedor: fotos, capturas, el chat de WhatsApp, un Excel, un PDF o el CSV de tu tienda actual. La app lee nombre y costo, vos revisás y elegís cómo publicarlo.'],
  ['¿Cómo me llegan los pedidos?', 'Tu cliente arma el carrito y te manda el ticket por WhatsApp con el detalle, el total, el envío y tu alias. En el panel lo seguís por etapas.'],
  ['¿Qué pasa cuando terminan los 7 días gratis?', 'Elegís el plan que te sirva para seguir: tus productos, pedidos y configuración quedan como estaban. No pedimos tarjeta para la prueba.'],
  ['¿Mis datos y los de mis clientes están protegidos?', 'Cada tienda ve solo lo suyo, los precios y el stock los calcula el servidor (nadie puede cambiarlos desde el navegador) y las claves de pago se guardan protegidas. Leé la política de privacidad.']
];

// Comparación general (sin nombrar a nadie): datos de los planes publicados por plataformas líderes, a la fecha de REFERENCIA.
const VS = [
  ['Comisión por cada venta', '0%, siempre', 'Hasta 2% si no cobrás con su medio de pago', '0%'],
  ['Precios por cantidad (x1 · x3 · x6 · x12)', 'Automáticos, en todos los planes', 'Un solo descuento por cantidad, o variantes cargadas a mano producto por producto', 'A mano, en cada mensaje'],
  ['Lista mayorista separada del público', `Con código de acceso, desde ${fmt(PLANES.find(p => p.id === 'pro').precio)}/mes`, `Recién en planes de ${fmt(REFERENCIA.plan)}/mes o más`, 'Mandando un PDF'],
  ['Precio calculado desde tu costo y el dólar', 'Sí: cambia el dólar y se recalcula todo', 'Cargás el precio final de cada producto', 'Rehacés la lista entera'],
  ['Cargar la lista del proveedor', 'Fotos, capturas, chat de WhatsApp, Excel, PDF o CSV', 'Una planilla con su formato', 'No aplica'],
  ['Saber quién te debe y qué reponer', 'Incluido', 'Según el plan o con apps aparte', 'De memoria'],
  ['Valor del abono', 'Fijo; si cambia, avisamos 30 días antes', 'Se ajusta cada trimestre', 'Gratis, pero te cuesta horas']
];
const GAR = [
  ['Sin permanencia', 'Pagás mes a mes. Te vas cuando quieras, sin letra chica.'],
  ['Tus datos son tuyos', 'Descargás tus productos y pedidos en un clic, cuando quieras.'],
  ['Tu plata, directo a vos', 'No tocamos tus cobros ni te cobramos por vender.'],
  ['Te acompañamos', 'Guía paso a paso y ayuda dentro del panel desde el primer día.']
];
function simPrecios() {
  const { costo, dolar, m1, m12 } = SIM, m3 = m12 + (m1 - m12) * 0.6, m6 = m12 + (m1 - m12) * 0.3;
  const p = { 1: precio(costo, dolar, m1), 3: precio(costo, dolar, m3), 6: precio(costo, dolar, m6), 12: precio(costo, dolar, m12) }, c = costo * dolar;
  return `<div class="lp-tiers">${[1, 3, 6, 12].map(n => `<div><small>x${n}${n === 12 ? '+' : ''}</small><b>${fmt(p[n])}</b><i>ganás ${fmt(p[n] - c)} c/u</i></div>`).join('')}</div>
    <p class="hint">Costo puesto en mano: ${fmt(c)} por unidad. Si mañana el dólar sube, cambiás un solo número y se recalcula todo tu catálogo.</p>`;
}
function simCosto() {
  const v = SIM.ventas, ref = REFERENCIA.plan + v * REFERENCIA.pctVenta / 100, pro = PLANES.find(p => p.id === 'pro').precio, ah = ref - pro;
  return `<div class="lp-cmp"><div><small>Plataforma tradicional con listas mayoristas</small><b>${fmt(ref)}</b><i>${fmt(REFERENCIA.plan)} de abono + ${REFERENCIA.pctVenta}% de tus ventas</i></div>
    <div class="on"><small>Escala · Mayorista Pro</small><b>${fmt(pro)}</b><i>abono fijo · 0% por venta</i></div></div>
    <p class="lp-ahorro">${ah > 0 ? `Te ahorrás <b>${fmt(ah)} por mes</b> (${fmt(ah * 12)} por año).` : 'Mismo costo, con más herramientas.'}</p>
    <p class="hint">Referencia: precio público (pago mensual) del plan de una plataforma líder que incluye listas mayoristas, y su costo por transacción al cobrar con otros medios de pago, a ${esc(REFERENCIA.fecha)}. No incluye las comisiones del medio de pago, que se pagan en cualquier plataforma.</p>`;
}

export function inicio(app) {
  const N = esc(MARCA.NOMBRE);
  app.innerHTML = `<div class="lp">
  <section class="lp-hero"><div class="tag">Para revendedores y mayoristas</div>
    <h1>Subí la foto de la lista de tu proveedor. En un minuto tenés tu tienda con tus precios.</h1>
    <p>${N} lee la lista, calcula tus precios por cantidad con tu ganancia y te arma el catálogo para recibir pedidos por WhatsApp. Cuando el proveedor cambia los precios, actualizás todo de una vez. 0% de comisión por venta.</p>
    ${demoHtml()}
    <div class="lp-cta"><a class="btn btn-s" href="#/registro">Crear mi tienda gratis</a>${MARCA.DEMO_URL ? `<a class="btn btn-s" href="${esc(MARCA.DEMO_URL)}" target="_blank" rel="noopener">Ver una tienda de ejemplo</a>` : ''}<a class="btn btn-s" href="#/login">Ya tengo cuenta</a></div>
    <ul class="lp-pills"><li>🔄 Lista nueva → precios al día</li><li>📦 x1 · x3 · x6 · x12</li><li>💰 Tu cliente ve cuánto gana</li><li>♾️ Sin límites</li><li>💬 Pedidos a tu WhatsApp</li></ul></section>

  <section class="lp-sec"><h2>¿Por qué elegir ${N}?</h2><div class="lp-grid">${PORQUE.map(([i, t, d]) => `<div class="lp-card"><span class="i" aria-hidden="true">${i}</span><b>${t}</b><p>${d}</p></div>`).join('')}</div></section>

  <section class="lp-sec"><h2>Compará antes de elegir</h2><p class="lp-sub">Lo que cambia entre vender con ${N}, con una plataforma de tiendas tradicional o solo por WhatsApp.</p>
    <div class="lp-vsw"><table class="lp-vs"><thead><tr><th></th><th class="on">${N}</th><th>Plataforma tradicional</th><th>Solo WhatsApp y planilla</th></tr></thead><tbody>${VS.map(r => `<tr><td>${r[0]}</td><td class="on">${r[1]}</td><td>${r[2]}</td><td class="no">${r[3]}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint" style="margin-top:8px">Comparación general con los planes y condiciones publicados por plataformas líderes a ${esc(REFERENCIA.fecha)}. Cada una tiene sus particularidades.</p></section>

  <section class="lp-sec lp-sim"><h2>Simulá tus precios por volumen</h2><p class="lp-sub">Probá con un producto tuyo: así se ve tu lista sin hacer una sola cuenta.</p>
    <div class="lp-form"><label>Costo en dólares<input class="fi" type="number" min="0.1" step="0.1" value="${SIM.costo}" data-input="lp-sim" data-k="costo"></label>
      <label>Dólar $<input class="fi" type="number" min="1" step="1" value="${SIM.dolar}" data-input="lp-sim" data-k="dolar"></label>
      <label>Ganancia x1 %<input class="fi" type="number" min="0" max="500" value="${SIM.m1}" data-input="lp-sim" data-k="m1"></label>
      <label>Ganancia x12 %<input class="fi" type="number" min="0" max="500" value="${SIM.m12}" data-input="lp-sim" data-k="m12"></label></div>
    <div id="lp-sim1">${simPrecios()}</div></section>

  <section class="lp-sec lp-sim"><h2>¿Cuánto te cuesta vender online?</h2><p class="lp-sub">Las plataformas tradicionales cobran el abono más un porcentaje de cada venta. Nosotros, solo el abono.</p>
    <label class="lp-range">Vendés por mes: <b id="lp-v">${fmt(SIM.ventas)}</b><input type="range" min="500000" max="30000000" step="500000" value="${SIM.ventas}" data-input="lp-ventas" aria-label="Ventas por mes"></label>
    <div id="lp-sim2">${simCosto()}</div></section>

  <section class="lp-sec" id="planes"><h2>Planes</h2><p class="lp-sub">Precios de lanzamiento por mes, en pesos. Probá 7 días con todo desbloqueado.</p>
    <div class="lp-planes">${PLANES.map(p => `<div class="lp-plan${p.destacado ? ' on' : ''}">${p.destacado ? '<span class="tag">Más elegido</span>' : ''}<h3>${esc(p.nombre)}</h3><p class="hint">${esc(p.para)}</p><div class="lp-precio">${fmt(p.precio)}<small>/mes</small></div>
      <ul>${p.incluye.map(x => `<li>${esc(x)}</li>`).join('')}</ul><a class="btn ${p.destacado ? 'btn-p' : 'btn-s'}" href="#/registro">Empezar gratis</a></div>`).join('')}</div>
    <ul class="lp-gar">${GAR.map(([t, d]) => `<li><b>${t}</b>${d}</li>`).join('')}</ul></section>

  <section class="lp-sec"><h2>Así arrancás</h2><ol class="home-steps"><li>Creás tu cuenta con email y contraseña.</li><li>Ponés el nombre de tu negocio y tu WhatsApp: te armamos la tienda con productos de ejemplo.</li><li>Una guía te lleva paso a paso: tu logo, tu alias, tu lista de precios y tus envíos.</li><li>Compartís tu enlace y los pedidos te llegan al WhatsApp.</li></ol>
    <a class="btn btn-p lp-mid" href="#/registro">Empezar ahora</a></section>

  <section class="lp-sec"><h2>Preguntas frecuentes</h2><div class="st-faq-l">${FAQ.map(([p, r]) => `<details><summary>${p}</summary><p>${r}</p></details>`).join('')}</div></section>

  <footer class="lp-foot"><b>${N}</b><nav><a href="#/terminos">Términos y condiciones</a><a href="#/privacidad">Privacidad</a>${MARCA.SOPORTE_WSP ? `<a href="https://api.whatsapp.com/send?phone=${esc(MARCA.SOPORTE_WSP)}&text=${encodeURIComponent('Hola, tengo una consulta sobre ' + MARCA.NOMBRE)}" target="_blank" rel="noopener">Soporte por WhatsApp</a>` : ''}</nav></footer></div>`;
}
on('lp-sim', (d, el) => { const v = Number(el.value); if (!(v >= 0)) return; SIM[d.k] = v; const b = $('#lp-sim1'); if (b) b.innerHTML = simPrecios(); });
on('lp-ventas', (d, el) => { SIM.ventas = Number(el.value); const b = $('#lp-sim2'), t = $('#lp-v'); if (t) t.textContent = fmt(SIM.ventas); if (b) b.innerHTML = simCosto(); });
