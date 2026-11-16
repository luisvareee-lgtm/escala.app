// Portada: por qué elegir la plataforma, la barra del pedido en vivo, simuladores (precios por volumen y costo mensual), planes, preguntas y legales.
import { esc, fmt, on, $ } from './util.js';
import { MARCA, PLANES, REFERENCIA } from './marca.js';
import { demoHtml } from './demo.js';
import { cuposHtml, cargarCupos } from './fundadores.js';
import { ilus } from './ilus.js';

const SIM = { costo: 10, dolar: 1200, m1: 50, m12: 20, ventas: 3000000 };
const LP = { anual: false };
// íconos del título (trazo, toman el color del texto)
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICO = {
  lista: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
  margen: svg('<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'),
  tienda: svg('<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>'),
};
const ANUAL = (() => { const n = Number(MARCA.ANUAL_MESES); return n > 0 && n < 12 ? n : 0; })();

/* ---------- La barra del pedido, en vivo (la misma que ven los clientes en la tienda mayorista) ---------- */
const GB = { q: 0, nivel: 0 };
const NIV = [[1, 'Inicial'], [3, 'Mayorista'], [6, 'Especial'], [12, '🏆 Super']];
const GBP = { 1: 14900, 3: 12900, 6: 11500, 12: 9900 };
const nivelDe = q => (q >= 12 ? 3 : q >= 6 ? 2 : q >= 3 ? 1 : 0);
const pUnit = q => GBP[NIV[nivelDe(Math.max(1, q))][0]];
const posNivel = q => (q >= 12 ? 100 : q >= 6 ? 66.67 + (q - 6) / 6 * 33.33 : q >= 3 ? 33.33 + (q - 3) / 3 * 33.34 : Math.max(0, (q - 1) / 2 * 33.33));
function gbBarra(subio) {
  const q = GB.q, n = nivelDe(q), sig = NIV[n + 1], falta = sig ? sig[0] - q : 0, ahorro = (GBP[1] - pUnit(q)) * q;
  const msg = !q ? 'Tocá <b>+ Agregar</b> y mirá cómo se desbloquean los precios'
    : sig ? `Sumá <b>${falta} u.</b> más y desbloqueá el precio ${sig[1]} · <b>${fmt(GBP[sig[0]])} c/u</b>`
    : `🏆 ¡Desbloqueaste el precio Super! · ahorrás <b>${fmt(ahorro)}</b>`;
  return `<div class="gb-top"><div class="gb-msg" role="status" id="lp-gb-msg">${msg}</div></div>
    <div class="gb-track" aria-hidden="true"><div class="gb-rail"><i style="width:${q ? posNivel(q).toFixed(1) : 0}%"></i></div>${NIV.map(([m, nm], i) => `<span class="gb-cp${q >= m ? ' ok' : ''}${subio && i === n ? ' pop' : ''}" style="left:${[0, 33.33, 66.67, 100][i]}%"><b></b><small>${m}u${m === 12 ? '+' : ''} · ${nm}</small></span>`).join('')}</div>
    <div class="gb-foot"><span class="gb-tot"><b>${q} u.</b> · ${fmt(pUnit(q) * q)}</span>${ahorro > 0 ? `<span class="gb-mc ok">ahorrás ${fmt(ahorro)}</span>` : ''}<span class="gb-go">Ver pedido →</span></div>${subio ? '<span class="gb-pill" role="status">¡Nivel desbloqueado!</span>' : ''}`;
}
function gbHtml() {
  const q = GB.q, n = q ? nivelDe(q) : -1, off = Math.round((1 - GBP[12] / GBP[1]) * 100);
  const acc = !q ? `<button type="button" class="btn btn-p lp-gb-add" data-act="lp-gb" data-d="1">+ Agregar al pedido</button>`
    : `<div class="lp-gb-step" role="group" aria-label="Cantidad"><button type="button" data-act="lp-gb" data-d="-1" aria-label="Quitar uno">−</button><span id="lp-gb-q" aria-live="polite">${q} u.</span><button type="button" data-act="lp-gb" data-d="1" aria-label="Sumar uno" ${q >= 24 ? 'disabled' : ''}>+</button></div>${q >= 12 ? '<button type="button" class="linkb" data-act="lp-gb" data-d="0">Empezar de nuevo</button>' : '<span class="lp-gb-tip">Tocá <b>+</b> para sumar</span>'}`;
  return `<div class="lp-gb-box"><div class="lp-gb-prod"><div class="lp-gb-img">${ilus('Sérum facial vitamina C', 0)}<span class="dmc-off">−${off}% x12</span></div><div class="lp-gb-info"><b>Sérum facial vitamina C · 30 ml</b>
      <div class="lp-gb-pu"><strong>${fmt(pUnit(q))}</strong><small>${q ? 'c/u con ' + q + ' u.' : 'por unidad'}</small></div>
      <div class="lp-gb-tiers" aria-label="Precio por cantidad">${NIV.map(([m], i) => `<span class="${i === n ? 'on' : ''}"><small>x${m}${m === 12 ? '+' : ''}</small>${fmt(GBP[m])}</span>`).join('')}</div>
      <div class="lp-gb-acc">${acc}</div></div></div>
    <div class="dz-gami lp-gami lvl${Math.max(0, n)}" id="lp-gami">${gbBarra(false)}</div></div>`;
}
on('lp-gb', d => {
  const antes = GB.q ? nivelDe(GB.q) : -1;
  GB.q = d.d === '0' ? 0 : Math.max(0, Math.min(24, GB.q + Number(d.d)));
  const n = GB.q ? nivelDe(GB.q) : -1, subio = n > antes && n >= 1, box = $('#lp-gb');
  if (!box) return;
  box.innerHTML = gbHtml();
  const cb = $('#lp-gami'); if (!cb) return;
  if (subio) {
    cb.innerHTML = gbBarra(true);
    try { if (navigator.vibrate) navigator.vibrate(n >= 3 ? [65, 35, 130] : [45, 25, 70]); } catch (e) { }
    cb.classList.remove('gb-shake'); void cb.offsetWidth; cb.classList.add('gb-shake');
    setTimeout(() => { const x = cb.querySelector('.gb-pill'); if (x) x.remove(); }, 2400);
  }
});
const planesLanding = () => `<div class="lp-planes">${PLANES.map(p => { const pr = LP.anual && ANUAL ? p.precio * ANUAL : p.precio; return `<div class="lp-plan${p.destacado ? ' on glow' : ''}">${p.destacado ? '<span class="tag">Más elegido</span>' : ''}<h3>${esc(p.nombre)}</h3><p class="hint">${esc(p.para)}</p><div class="lp-precio">${fmt(pr)}<small>${LP.anual && ANUAL ? '/año' : '/mes'}</small></div>${LP.anual && ANUAL ? `<p class="pl-ahorro">Equivale a ${fmt(pr / 12)}/mes · ahorrás ${fmt(p.precio * 12 - pr)}</p>` : ''}
      <ul>${p.incluye.map(x => `<li>${esc(x)}</li>`).join('')}</ul><a class="btn ${p.destacado ? 'btn-p' : 'btn-s'}" href="#/registro">Empezar gratis</a></div>`; }).join('')}</div>`;
on('lp-periodo', d => { LP.anual = d.v === 'anual'; const b = $('#lp-planes-in'), s = $('#lp-periodo'); if (b) b.innerHTML = planesLanding(); if (s) s.querySelectorAll('button').forEach(x => { const on = (x.dataset.v === 'anual') === LP.anual; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); });
const precio = (c, d, m) => Math.ceil(c * d * (1 + m / 100) / 10) * 10;   // mismo cálculo que la base de datos

const PORQUE = [
  ['💲', 'Tus costos reales, no un precio a ojo', 'Cargás el costo (en dólares o pesos) y tus márgenes: la app calcula el precio de cada escalón. Cambia el dólar y se actualiza todo el catálogo. Nunca vendés por debajo de tu margen mínimo.'],
  ['📶', 'Escalones de precio, no un solo precio mayorista', 'x1 · x3 · x6 · x12 en todos los planes, por producto, por categoría o por todo el carrito. Tu cliente ve cuánto le falta para el próximo precio y la barra del pedido le festeja cada nivel.'],
  ['♾️', 'Sin límites y 0% por venta', 'Productos, pedidos y visitas ilimitados. No te cobramos un porcentaje de lo que vendés: pagás un abono fijo, mensual o anual.'],
  ['🔄', 'Lista viva: precios al día en un minuto', 'Subís la lista nueva del proveedor y la app te muestra qué subió, qué bajó y qué hay de nuevo. Un toque actualiza todo con tu ganancia y te deja listo el aviso para tus clientes.'],
  ['💰', 'Por menor y por mayor con el mismo enlace', 'El público ve el precio final. Tus revendedores entran con un código a la lista por cantidad y ven a cuánto revender cada producto y cuánto ganan.'],
  ['📥', 'Lee tus datos como vengan', 'Fotos del proveedor con el precio escrito, capturas de canales, el chat de WhatsApp exportado, Excel, PDF o el CSV de tu tienda actual. Revisás y publicás con tu margen.'],
  ['📸', 'Flyers y catálogo PDF en un toque', 'Elegís de 1 a 4 productos y sale la imagen vertical lista para tus Estados, con tu marca. Tus revendedores arman la suya en marca blanca, con su precio. Y tu lista completa, en PDF.'],
  ['🔔', 'Cada pedido, al instante en tu celular', 'Te llega un aviso como un mensaje, con el total y el cliente, aunque tengas el panel cerrado. El pedido entra ordenado: etapas, remito y mensajes de WhatsApp listos.'],
  ['🧠', 'Un asistente que cuida tu plata y tus clientes', 'Quién te debe y hace cuánto, quién dejó de comprarte (con el WhatsApp listo para escribirle), qué se te acaba antes de que llegue la compra y cuánto ganaste de verdad.']
];
const FAQ = [
  ['¿Necesito saber de computación?', 'No. Creás la cuenta, ponés el nombre de tu negocio y tu WhatsApp, y una guía te acompaña paso a paso. Si te trabás, tocás “Ayuda” y escribís tu problema.'],
  ['¿Me cobran comisión por cada venta?', 'No. Pagás solo el abono mensual. Si cobrás con Mercado Pago, la plata entra directo a tu cuenta y solo aplica la comisión de Mercado Pago.'],
  ['¿Cuántos productos y pedidos puedo tener?', 'Todos los que quieras, en todos los planes.'],
  ['¿Puedo vender por menor y por mayor con el mismo enlace?', 'Sí. El público ve el precio final y tus revendedores entran con un código a la lista por cantidad (plan Mayorista Pro).'],
  ['¿Sirve para ropa y calzado?', 'Sí. Cargás los talles con un toque (XS a XXL, 35 al 45, niños o jean) y el stock de cada uno: tu cliente elige el talle con un botón, los que se agotan aparecen tachados y nadie puede pedir más de lo que tenés. Puede llevar varios talles del mismo modelo y todos suman para el precio por cantidad. Y le mostrás tu guía de talles.'],
  ['¿Cómo cargo mi lista de precios?', 'Subís lo que te manda el proveedor: fotos, capturas, el chat de WhatsApp, un Excel, un PDF o el CSV de tu tienda actual. La app lee nombre y costo, vos revisás y elegís cómo publicarlo.'],
  ['¿Cómo me llegan los pedidos?', 'Tu cliente arma el carrito y te manda el ticket por WhatsApp con el detalle, el total, el envío y tu alias. Además te llega un aviso al celular apenas entra, y en el panel lo seguís por etapas.'],
  ['¿Qué pasa cuando terminan los 7 días gratis?', 'Elegís el plan que te sirva para seguir: tus productos, pedidos y configuración quedan como estaban. No pedimos tarjeta para la prueba.'],
  ['¿Cómo pago el abono?', 'Mes a mes o por año (el anual tiene meses de regalo). Podés pagar por transferencia o, si está disponible, con suscripción de Mercado Pago. Unos días antes del vencimiento te avisamos en el panel.'],
  ['¿Mis datos y los de mis clientes están protegidos?', 'Cada tienda ve solo lo suyo, los precios y el stock los calcula el servidor (nadie puede cambiarlos desde el navegador) y las claves de pago se guardan protegidas. Leé la política de privacidad.']
];

// Comparación general (sin nombrar a nadie): datos de los planes publicados por plataformas líderes, a la fecha de REFERENCIA.
const VS = [
  ['Comisión por cada venta', '0%, siempre', 'Hasta 2% si no cobrás con su medio de pago', '0%'],
  ['Precios por cantidad (x1 · x3 · x6 · x12)', 'Automáticos, en todos los planes', 'Un solo descuento por cantidad, o variantes cargadas a mano producto por producto', 'A mano, en cada mensaje'],
  ['Lista mayorista separada del público', `Con código de acceso, desde ${fmt(PLANES.find(p => p.id === 'pro').precio)}/mes`, `Recién en planes de ${fmt(REFERENCIA.plan)}/mes o más`, 'Mandando un PDF'],
  ['Precio calculado desde tu costo y el dólar', 'Sí: cambia el dólar y se recalcula todo', 'Cargás el precio final de cada producto', 'Rehacés la lista entera'],
  ['Cargar la lista del proveedor', 'Fotos, capturas, chat de WhatsApp, Excel, PDF o CSV', 'Una planilla con su formato', 'No aplica'],
  ['Flyers para Estados e historias', 'En un toque: con tu marca, o en marca blanca para que tus revendedores publiquen con su precio', 'Los armás aparte, en una app de diseño', 'Con capturas de pantalla'],
  ['Saber quién te debe y qué reponer', 'Incluido', 'Según el plan o con apps aparte', 'De memoria'],
  ['Recuperar clientes que dejaron de comprar', 'Lista con los días sin comprar y el WhatsApp listo para escribirles', 'Con campañas de email o apps aparte', 'De memoria'],
  ['Valor del abono', 'Fijo; si cambia, avisamos 30 días antes', 'Se ajusta cada trimestre', 'Gratis, pero te cuesta horas']
];
const GAR = [
  ['Sin permanencia', 'Pagás mes a mes o por año. Te vas cuando quieras, sin letra chica.'],
  ['Tus datos son tuyos', 'Descargás tus productos y pedidos en un clic, cuando quieras.'],
  ['Tu plata, directo a vos', 'No tocamos tus cobros ni te cobramos por vender.'],
  ['Te acompañamos', 'Guía paso a paso y ayuda dentro del panel desde el primer día.']
];
function simPrecios() {
  const { costo, dolar, m1, m12 } = SIM, m3 = m12 + (m1 - m12) * 0.6, m6 = m12 + (m1 - m12) * 0.3;
  const p = { 1: precio(costo, dolar, m1), 3: precio(costo, dolar, m3), 6: precio(costo, dolar, m6), 12: precio(costo, dolar, m12) }, c = costo * dolar;
  const pct = v => Math.max(2, Math.min(100, Math.round(v / (p[1] || 1) * 100)));
  return `<div class="lp-tiers">${[1, 3, 6, 12].map(n => `<div><small>x${n}${n === 12 ? '+' : ''}</small><b>${fmt(p[n])}</b><i>ganás ${fmt(p[n] - c)} c/u</i></div>`).join('')}</div>
    <div class="lp-bars" role="img" aria-label="Cuánto de cada precio es costo y cuánto es tu ganancia">${[1, 3, 6, 12].map(n => `<div class="lp-bar"><span>x${n}${n === 12 ? '+' : ''}</span><div class="lp-bar-t"><i class="c" style="width:${pct(Math.min(c, p[n]))}%"></i><i class="g" style="width:${Math.max(0, pct(p[n]) - pct(Math.min(c, p[n])))}%"></i></div><em>${p[n] > c ? '+' + Math.round((p[n] - c) / c * 100) + '%' : '0%'}</em></div>`).join('')}<p class="lp-bar-leg"><i class="c"></i> tu costo <i class="g"></i> tu ganancia</p></div>
    <p class="hint">Costo puesto en mano: ${fmt(c)} por unidad. Si mañana el dólar sube, cambiás un solo número y se recalcula todo tu catálogo.</p>`;
}
function simCosto() {
  const v = SIM.ventas, ref = REFERENCIA.plan + v * REFERENCIA.pctVenta / 100, pro = PLANES.find(p => p.id === 'pro').precio, ah = ref - pro;
  const mx = Math.max(ref, pro, 1), w = v => Math.max(3, Math.round(v / mx * 100));
  return `<div class="lp-bars lp-bars2" role="img" aria-label="Costo mensual comparado"><div class="lp-bar"><span>Tradicional</span><div class="lp-bar-t"><i class="r" style="width:${w(ref)}%"></i></div><em>${fmt(ref)}</em></div><div class="lp-bar"><span>${esc(MARCA.NOMBRE)}</span><div class="lp-bar-t"><i class="g" style="width:${w(pro)}%"></i></div><em>${fmt(pro)}</em></div></div>
    <div class="lp-cmp"><div><small>Plataforma tradicional con listas mayoristas</small><b>${fmt(ref)}</b><i>${fmt(REFERENCIA.plan)} de abono + ${REFERENCIA.pctVenta}% de tus ventas</i></div>
    <div class="on"><small>${esc(MARCA.NOMBRE)} · Mayorista Pro</small><b>${fmt(pro)}</b><i>abono fijo · 0% por venta</i></div></div>
    <p class="lp-ahorro">${ah > 0 ? `Te ahorrás <b>${fmt(ah)} por mes</b> (${fmt(ah * 12)} por año).` : 'Mismo costo, con más herramientas.'}</p>
    <p class="hint">Referencia: precio público (pago mensual) del plan de una plataforma líder que incluye listas mayoristas, y su costo por transacción al cobrar con otros medios de pago, a ${esc(REFERENCIA.fecha)}. No incluye las comisiones del medio de pago, que se pagan en cualquier plataforma.</p>`;
}

export function inicio(app) {
  const N = esc(MARCA.NOMBRE); GB.q = 0;
  app.innerHTML = `<div class="lp">
  <section class="lp-hero"><div class="tag">Para comercios, revendedores y mayoristas</div>
    <h1 class="lp-flujo"><span class="fl-n"><i>${ICO.lista}</i>Subí la lista de tu proveedor</span><span class="fl-a" aria-hidden="true"><b></b></span><span class="fl-n"><i>${ICO.margen}</i>Calculá tu margen</span><span class="fl-a" aria-hidden="true"><b></b></span><span class="fl-n fl-fin"><i>${ICO.tienda}</i>¡Listo, tenés tu tienda con tus precios!</span></h1>
    <p>${N} lee la lista, calcula tus precios con tu ganancia por unidad, por cantidad o las dos y te arma el catálogo para recibir pedidos por WhatsApp. Cuando el proveedor cambia los precios, actualizás todo de una vez. 0% de comisión por venta.</p>
    ${demoHtml()}
    <div class="lp-cta"><a class="btn btn-s" href="#/registro">Crear mi tienda gratis</a>${MARCA.DEMO_URL ? `<a class="btn btn-s" href="${esc(MARCA.DEMO_URL)}" target="_blank" rel="noopener">Ver una tienda de ejemplo</a>` : ''}<a class="btn btn-s" href="#/login">Ya tengo cuenta</a></div>
    ${cuposHtml()}
    <ul class="lp-pills"><li>🔄 Lista nueva → precios al día</li><li>📶 x1 · x3 · x6 · x12</li><li>0% por venta</li><li>♾️ Sin límites</li><li>💬 Pedidos a tu WhatsApp</li><li>🔔 Aviso al celular</li><li>📸 Flyers para tus Estados</li></ul></section>

  <section class="lp-sec lp-gb-sec"><h2>Así compra tu cliente: cada escalón se festeja</h2><p class="lp-sub">Tocá “+ Agregar” y mirá cómo baja el precio por unidad. En tu tienda mayorista pasa lo mismo con cada producto: la barra le muestra cuánto le falta para el próximo precio, y al llegar el celular vibra.</p>
    <div id="lp-gb">${gbHtml()}</div></section>

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

  <section class="lp-sec" id="planes"><h2>Planes</h2><p class="lp-sub">Precios de lanzamiento en pesos. Probá 7 días con todo desbloqueado.</p>
    ${ANUAL ? `<div class="seg pl-periodo" id="lp-periodo" role="group" aria-label="Forma de pago"><button class="${LP.anual ? '' : 'on'}" data-act="lp-periodo" data-v="mes" aria-pressed="${!LP.anual}">Mensual</button><button class="${LP.anual ? 'on' : ''}" data-act="lp-periodo" data-v="anual" aria-pressed="${LP.anual}">Anual · ${12 - ANUAL === 1 ? '1 mes gratis' : (12 - ANUAL) + ' meses gratis'}</button></div>` : ''}
    <div id="lp-planes-in">${planesLanding()}</div>
    <ul class="lp-gar">${GAR.map(([t, d]) => `<li><b>${t}</b>${d}</li>`).join('')}</ul></section>

  <section class="lp-sec"><h2>Así arrancás</h2><ol class="home-steps"><li>Creás tu cuenta con email y contraseña.</li><li>Ponés el nombre de tu negocio y tu WhatsApp: te armamos la tienda con productos de ejemplo.</li><li>Una guía te lleva paso a paso: tu logo, tu alias, tu lista de precios y tus envíos.</li><li>Compartís tu enlace y los pedidos te llegan al WhatsApp.</li></ol>
    <a class="btn btn-p lp-mid" href="#/registro">Empezar ahora</a></section>

  <section class="lp-sec"><h2>Preguntas frecuentes</h2><div class="st-faq-l">${FAQ.map(([p, r]) => `<details><summary>${p}</summary><p>${r}</p></details>`).join('')}</div></section>

  <footer class="lp-foot"><b>${N}</b><nav><a href="#/terminos">Términos y condiciones</a><a href="#/privacidad">Privacidad</a>${MARCA.SOPORTE_WSP ? `<a href="https://api.whatsapp.com/send?phone=${esc(MARCA.SOPORTE_WSP)}&text=${encodeURIComponent('Hola, tengo una consulta sobre ' + MARCA.NOMBRE)}" target="_blank" rel="noopener">Soporte por WhatsApp</a>` : ''}</nav></footer></div>`;
  cargarCupos();
}
on('lp-sim', (d, el) => { const v = Number(el.value); if (!(v >= 0)) return; SIM[d.k] = v; const b = $('#lp-sim1'); if (b) b.innerHTML = simPrecios(); });
on('lp-ventas', (d, el) => { SIM.ventas = Number(el.value); const b = $('#lp-sim2'), t = $('#lp-v'); if (t) t.textContent = fmt(SIM.ventas); if (b) b.innerHTML = simCosto(); });
