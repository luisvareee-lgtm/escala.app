// Portada (v2.28: encabezado fijo, titular con el dolor y el resultado, perfiles, barra que se muestra sola, capturas reales,
// testimonios desde config.js y un solo botón en toda la página): por qué elegir la plataforma, la barra del pedido en vivo, simuladores (precios por volumen y costo mensual), planes, preguntas y legales.
// v2.32: isotipo "Escalones", título para todos (por menor o por mayor), video animado arriba de todo (con subtítulos),
// ejemplos con productos reales de Lua Beauty (con permiso de la dueña) y "Todo tu negocio en un lugar" con capturas del panel.
// v2.32.1: video nuevo (núcleo que absorbe la lista, barra de escalas en primer plano, pedido por WhatsApp).
// v2.32.2: el video vuelve a tener música y efectos (botón "Activar sonido"), perfiles simples (Recién empiezo, Tengo una tienda,
// Vendo por mayor) y sin el mensaje de "cambia el proveedor o el dólar".
// v2.33: plan Gratis para siempre (hasta 100 productos) en toda la portada; el dólar y la lista del proveedor quedan donde
// importan ("Vendo por mayor" y la comparación) y el simulador arranca en pesos (con ARS / USD).
import { esc, fmt, on, $ } from './util.js';
import { MARCA, PLANES, REFERENCIA, urlTiendaDe, itemPlan } from './marca.js';
import { api } from './api.js';
import { RUBROS } from './rubro.js';
import { demoHtml } from './demo.js';
import { cuposHtml, cargarCupos } from './fundadores.js';

const SIM = { moneda: 'ARS', costoArs: 12000, costo: 10, dolar: 1200, m1: 50, m12: 20, ventas: 3000000 };
const LP = { anual: false, perfil: '', neg: 'resumen' };
const CTA = 'Crear mi tienda gratis', MICRO = 'Gratis hasta 100 productos · sin tarjeta · sin permanencia';   // los días los actualiza cargarCupos() con la configuración
// íconos del título (trazo, toman el color del texto)
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICO = {
  lista: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>'),
  margen: svg('<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'),
  tienda: svg('<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>'),
  dolar: svg('<path d="M12 2v20"/><path d="M17 6.5c-1-1.5-2.8-2.3-5-2.3-2.8 0-5 1.5-5 3.8 0 5.200 10 2.500 10 7.800 0 2.300-2.200 3.900-5 3.900-2.400 0-4.300-.900-5.300-2.600"/>'),
  escalones: svg('<path d="M4 20V14h4v6"/><path d="M10 20V9h4v11"/><path d="M16 20V4h4v16"/><path d="M2 20h20"/>'),
  sync: svg('<path d="M20 11a8 8 0 0 0-14.500-4.500L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0 0 14.500 4.500L21 15"/><path d="M21 20v-5h-5"/>'),
  cero: svg('<circle cx="12" cy="12" r="9"/><path d="M5.600 18.400 18.400 5.600"/>'),
  infinito: svg('<path d="M7 8a4 4 0 1 0 0 8c2.500 0 3.500-2 5-4s2.500-4 5-4a4 4 0 1 1 0 8c-2.500 0-3.500-2-5-4S9.500 8 7 8z"/>'),
  candado: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0"/>'),
  chat: svg('<path d="M21 12a8 8 0 0 1-11.800 7L4 20l1.100-4.600A8 8 0 1 1 21 12z"/>'),
  ok: svg('<path d="M5 12.500 10 17.500 19 7"/>'),
};
const ANUAL = (() => { const n = Number(MARCA.ANUAL_MESES); return n > 0 && n < 12 ? n : 0; })();

/* ---------- La barra del pedido, en vivo (la misma que ven los clientes en la tienda mayorista) ---------- */
const GB = { q: 0, nivel: 0 };
const NIV = [[1, 'Inicial'], [3, 'Mayorista'], [6, 'Especial'], [12, '🏆 Super']];
const GBP = { 1: 7130, 3: 6200, 6: 5430, 12: 4650 };   // precios reales de Lua Beauty (set de brochas)
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
  return `<div class="lp-gb-box"><div class="lp-gb-prod"><div class="lp-gb-img"><img src="/img/lua/brochas.jpg" alt="Set de brochas con bolsa, 12 unidades" width="260" height="260" loading="lazy"><span class="dmc-off">−${off}% x12</span></div><div class="lp-gb-info"><b>Set de brochas con bolsa · 12 u.</b>
      <div class="lp-gb-pu"><strong>${fmt(pUnit(q))}</strong><small>${q ? 'c/u con ' + q + ' u.' : 'por unidad'}</small></div>
      <div class="lp-gb-tiers" aria-label="Precio por cantidad">${NIV.map(([m], i) => `<span class="${i === n ? 'on' : ''}"><small>x${m}${m === 12 ? '+' : ''}</small>${fmt(GBP[m])}</span>`).join('')}</div>
      <div class="lp-gb-acc">${acc}</div></div></div>
    <div class="dz-gami lp-gami lvl${Math.max(0, n)}" id="lp-gami">${gbBarra(false)}</div></div>`;
}
function gbPaso(d, usuario) {
  const antes = GB.q ? nivelDe(GB.q) : -1;
  GB.q = d === '0' ? 0 : Math.max(0, Math.min(24, GB.q + Number(d)));
  const n = GB.q ? nivelDe(GB.q) : -1, subio = n > antes && n >= 1, box = $('#lp-gb');
  if (!box) return false;
  box.innerHTML = gbHtml();
  const cb = $('#lp-gami'); if (!cb) return false;
  if (subio) {
    cb.innerHTML = gbBarra(true);
    if (usuario) { try { if (navigator.vibrate) navigator.vibrate(n >= 3 ? [65, 35, 130] : [45, 25, 70]); } catch (e) { } }
    cb.classList.remove('gb-shake'); void cb.offsetWidth; cb.classList.add('gb-shake');
    setTimeout(() => { const x = cb.querySelector('.gb-pill'); if (x) x.remove(); }, 2400);
  }
  return true;
}
// La barra se muestra sola una vez (1 → 12 unidades) cuando entra en pantalla y vuelve a 0 para que la pruebe el visitante.
// No corre si el sistema pide menos movimiento, y cualquier toque la corta.
const AUTO = { t: null, io: null, hecho: false };
function autoParar() { clearTimeout(AUTO.t); AUTO.t = null; if (AUTO.io) { AUTO.io.disconnect(); AUTO.io = null; } const b = $('#lp-gb'); if (b) b.classList.remove('auto'); }
function autoBarra() {
  autoParar(); AUTO.hecho = false;
  const box = $('#lp-gb');
  let quieto = false; try { quieto = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }
  if (!box || quieto || typeof IntersectionObserver === 'undefined') return;
  const paso = () => {
    if (!$('#lp-gb')) return autoParar();
    if (GB.q >= 12) { AUTO.t = setTimeout(() => { if ($('#lp-gb')) { gbPaso('0', false); const m = $('#lp-gb-msg'); if (m) m.innerHTML = 'Ahora probalo vos: tocá <b>+ Agregar</b>'; } autoParar(); }, 2600); return; }
    gbPaso('1', false); const b = $('#lp-gb'); if (b) b.classList.add('auto');
    AUTO.t = setTimeout(paso, [3, 6, 12].includes(GB.q) ? 1300 : 420);
  };
  AUTO.io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && !AUTO.hecho) { AUTO.hecho = true; AUTO.io.disconnect(); AUTO.io = null; AUTO.t = setTimeout(paso, 900); } }, { threshold: 0.6 });
  AUTO.io.observe(box);
}
on('lp-gb', d => { const corria = !!AUTO.t; AUTO.hecho = true; autoParar(); if (corria && d.d !== '0') GB.q = 0; gbPaso(d.d, true); });
const lista = L => { const li = x => `<li>${itemPlan(x, esc)}</li>`; return L.length <= 8 ? `<ul>${L.map(li).join('')}</ul>` : `<ul>${L.slice(0, 6).map(li).join('')}</ul><details class="lp-plan-mas"><summary>Ver ${L.length - 6} más</summary><ul>${L.slice(6).map(li).join('')}</ul></details>`; };
// v2.33: tres planes (ids base / pro / api). Cada uno con su botón y su aclaración.
const BOTON = {
  base: ['Empezar gratis', 'Sin tarjeta · Gratis para siempre'],
  pro: ['Probar Pro <span class="dias-prueba">14</span> días gratis', 'Sin tarjeta · Después elegís seguir o quedar en Gratis'],
  api: ['Probar Mayorista IA <span class="dias-prueba">14</span> días', 'Sin tarjeta · Cancelás cuando quieras']
};
const planCard = p => {
  const gratis = !(p.precio > 0), an = !gratis && LP.anual && ANUAL, pr = an ? p.precio * ANUAL : p.precio, [btn, nota] = BOTON[p.id] || [CTA, ''];
  const tag = p.badge ? `<span class="tag${gratis ? ' ok' : ''}">${esc(p.badge)}</span>` : '';
  return `<div class="lp-plan${p.destacado ? ' on glow' : ''}${gratis ? ' lp-plan-gratis' : ''}" data-plan="${p.id}">${tag}<h3>${esc(p.nombre)}</h3><p class="hint">${esc(p.para)}</p>
      <div class="lp-precio">${gratis ? '$0' : fmt(pr)}<small>${an ? '/año' : '/mes'}</small></div>${gratis ? '<p class="pl-ahorro">Gratis para siempre</p>' : an ? `<p class="pl-ahorro">Equivale a ${fmt(pr / 12)}/mes · ahorrás ${fmt(p.precio * 12 - pr)}</p>` : ''}
      ${lista(p.incluye)}<a class="btn ${p.destacado ? 'btn-p' : 'btn-s'}" href="#/registro">${btn}</a><small class="lp-plan-nota">${nota}</small></div>`;
};
const planesLanding = () => `<div class="lp-planes lp-planes3">${PLANES.map(planCard).join('')}</div>`;
// Setup Llave en Mano: lo cargamos nosotros (pago único). Sin WhatsApp de soporte, se muestra sin botón.
const SETUP = 60000;
const setupHtml = () => {
  const w = MARCA.SOPORTE_WSP ? `https://api.whatsapp.com/send?phone=${encodeURIComponent(MARCA.SOPORTE_WSP)}&text=${encodeURIComponent(`Hola, quiero el Setup Llave en Mano (${fmt(SETUP)}, pago único) de ${MARCA.NOMBRE}. Te paso mi lista de productos.`)}` : '';
  return `<div class="lp-setup" id="lp-setup"><div><b>¿No tenés tiempo de armar tu catálogo? Setup Llave en Mano — ${fmt(SETUP)} (pago único)</b><p>Nos pasás tu lista como la tengas, cargamos tus productos, ordenamos tus escalas y te dejamos la tienda lista para vender en 48 hs.</p></div>${w ? `<a class="btn btn-s" target="_blank" rel="noopener" href="${esc(w)}">Quiero que me la armen</a>` : ''}</div>`;
};
on('lp-periodo', d => { LP.anual = d.v === 'anual'; const b = $('#lp-planes-in'), s = $('#lp-periodo'); if (b) b.innerHTML = planesLanding(); if (s) s.querySelectorAll('button').forEach(x => { const on = (x.dataset.v === 'anual') === LP.anual; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); });
const precio = (c, d, m) => Math.ceil(c * d * (1 + m / 100) / 10) * 10;   // mismo cálculo que la base de datos

const PORQUE = [
  ['dolar', 'Tu costo y tu ganancia mandan', 'Cargás el costo y tus márgenes: la app calcula cada precio por cantidad y nunca vendés por debajo de tu margen mínimo.'],
  ['escalones', 'Precios x1 · x3 · x6 · x12 automáticos', 'Por producto, por categoría o por todo el carrito, desde Mayorista Pro (y en la prueba gratis). Tu cliente ve cuánto le falta para el próximo precio y la barra del pedido lo empuja a llevar más.'],
  ['sync', 'Lista viva, en vez de un PDF', 'Subís la lista nueva del proveedor y la app te muestra qué subió, qué bajó y qué hay de nuevo. Un toque actualiza todo con tu ganancia y te deja listo el aviso para tus clientes.'],
  ['cero', '0% de comisión por venta', 'Gratis hasta 100 productos, con pedidos y visitas ilimitados. No te cobramos un porcentaje de lo que vendés: si querés más, pagás un abono fijo, mensual o anual.']
];
const MAS = [
  ['Por menor y por mayor con el mismo enlace', 'El público ve el precio final. Tus revendedores entran con un código a la lista por cantidad y ven a cuánto revender cada producto y cuánto ganan.'],
  ['Lee tus datos como vengan', 'Fotos del proveedor con el precio escrito, capturas de canales, el chat de WhatsApp exportado, Excel, PDF o el CSV de tu tienda actual. Revisás y publicás con tu margen.'],
  ['Flyers y catálogo PDF en un toque', 'Elegís de 1 a 4 productos y sale la imagen vertical lista para tus Estados, con tu marca. Tus revendedores arman la suya en marca blanca, con su precio. Y tu lista completa, en PDF.'],
  ['Cada pedido, al instante en tu celular', 'Te llega un aviso como un mensaje, con el total y el cliente, aunque tengas el panel cerrado. El pedido entra ordenado: etapas, remito y mensajes de WhatsApp listos.'],
  ['Un asistente que cuida tu plata y tus clientes', 'Quién te debe y hace cuánto, quién dejó de comprarte (con el WhatsApp listo para escribirle), qué se te acaba antes de que llegue la compra y cuánto ganaste de verdad.'],
  ['Promociones y cupones', '3x2, 2da unidad al 50 %, “2 x $”, descuento por monto con barra de progreso y cupones para tu público. Las herramientas se adaptan a lo que vendés: talles en ropa, tonos en cosmética.']
];
// ¿Cuál es tu caso? Cambia la bajada y los tres puntos del encabezado. Sin elegir, se ve la bajada general (sirve para todos).
const GENERAL = [null, 'Subís la lista de tu proveedor (foto, PDF o Excel), ponés tu ganancia y tus clientes te mandan el pedido armado por WhatsApp.',
  ['Precios por menor y por mayor con el mismo enlace', 'Barra de progreso, x1 · x3 · x6 · x12, tus clientes ahorran, llevan más y sube tu ticket promedio!' , 'Empezas Gratis · Sin comisión por venta']];
const PERFILES = {
  nuevo: ['Recién empiezo', 'Subís la foto de la lista de tu proveedor, ponés tu ganancia y hoy mismo tenés tu tienda para compartir.',
    ['Lee fotos, capturas, PDF, Excel o el chat de WhatsApp', 'Los pedidos te llegan armados a tu WhatsApp', 'Empezás gratis (hasta 100 productos) y probás todo 14 días, sin comisión por venta']],
  tienda: ['Tengo una tienda', 'Tus clientes ven tu catálogo con fotos y precios al día, eligen talle o color, arman el carrito y te mandan el pedido por WhatsApp.',
    ['Talles, colores y stock de cada uno', 'Promos, cupones y envío gratis desde el monto que elijas', 'Caja del día: efectivo y transferencia por separado']],
  mayorista: ['Vendo por mayor', 'Dejá de mandar el PDF. Tus clientes entran a tu tienda, ven el precio según cuánto llevan y te mandan el pedido armado por WhatsApp.',
    ['Precios x1 · x3 · x6 · x12 automáticos, con tu compra mínima', 'Costo en dólares o en pesos: si cambia el dólar, cambiás un número y se recalcula toda tu lista', 'Subís la lista nueva del proveedor y te marca qué subió, qué bajó y qué es nuevo', 'Lista para tus revendedores con código de acceso']],
};   // v2.32.2: en la portada, solo estos tres (lo demás está adentro del panel)
const perfilHtml = () => { const [, sub, pts] = PERFILES[LP.perfil] || GENERAL; return `<p class="lp-bajada">${sub}</p><ul class="lp-pts">${pts.map(x => `<li><i>${ICO.ok}</i>${x}</li>`).join('')}</ul>`; };
on('lp-perfil', d => { if (!PERFILES[d.k]) return; LP.perfil = d.k; const b = $('#lp-perfil-in'); if (b) b.innerHTML = perfilHtml(); document.querySelectorAll('[data-act=lp-perfil]').forEach(x => { const on_ = x.dataset.k === d.k; x.classList.toggle('on', on_); x.setAttribute('aria-pressed', on_); }); });
on('lp-ir', d => { const e = document.getElementById(d.k); if (e) e.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
const FAQ = [
  ['¿Necesito saber de computación?', 'No. Creás la cuenta, ponés el nombre de tu negocio y tu WhatsApp, y una guía te acompaña paso a paso. Si te trabás, tocás “Ayuda” y escribís tu problema.'],
  ['¿Me cobran comisión por cada venta?', 'No. Pagás solo el abono mensual. Si cobrás con Mercado Pago, la plata entra directo a tu cuenta y solo aplica la comisión de Mercado Pago.'],
  ['¿Cuántos productos y pedidos puedo tener?', 'En el plan Gratis publicás hasta 100 productos, para siempre; en los planes pagos, todos los que quieras. Los pedidos no tienen límite en ningún plan.'],
  ['¿Puedo vender por menor y por mayor con el mismo enlace?', 'Sí. El público ve el precio final y tus revendedores entran con un código a la lista por cantidad (plan Mayorista Pro).'],
  ['¿Sirve para ropa y calzado?', 'Sí. Cargás los talles con un toque (XS a XXL, 35 al 45, niños o jean) y el stock de cada uno: tu cliente elige el talle con un botón, los que se agotan aparecen tachados y nadie puede pedir más de lo que tenés. Puede llevar varios talles del mismo modelo y todos suman para el precio por cantidad. Y le mostrás tu guía de talles.'],
  ['¿Cómo cargo mi lista de precios?', 'Subís lo que te manda el proveedor: fotos, capturas, el chat de WhatsApp, un Excel, un PDF o el CSV de tu tienda actual. La app lee nombre y costo, vos revisás y elegís cómo publicarlo.'],
  ['¿Cómo me llegan los pedidos?', 'Tu cliente arma el carrito y te manda el ticket por WhatsApp con el detalle, el total, el envío y tu alias. Además te llega un aviso al celular apenas entra, y en el panel lo seguís por etapas.'],
  ['¿Qué pasa cuando terminan los días de prueba gratis?', 'Seguís gratis en el plan Gratis: tu tienda sigue andando, publica hasta 100 productos con un precio cada uno (los que cargaste de más quedan guardados) y los pedidos te siguen llegando. Si querés escalas de precio, publicar más o usar las herramientas Pro, elegís un plan pago. No pedimos tarjeta para la prueba.'],
  ['¿Cómo pago el abono?', 'Mes a mes o por año (el anual tiene meses de regalo). Podés pagar por transferencia o, si está disponible, con suscripción de Mercado Pago. Unos días antes del vencimiento te avisamos en el panel.'],
  ['¿Mis datos y los de mis clientes están protegidos?', 'Cada tienda ve solo lo suyo, los precios y el stock los calcula el servidor (nadie puede cambiarlos desde el navegador) y las claves de pago se guardan protegidas. Leé la política de privacidad.']
];

// Comparación general (sin nombrar a nadie): datos de los planes publicados por plataformas líderes, a la fecha de REFERENCIA.
const VS = [
  ['Comisión por cada venta', '0%, siempre', 'Hasta 2% si no cobrás con su medio de pago', '0%'],
  ['Precios por cantidad (x1 · x3 · x6 · x12)', 'Automáticos, desde Mayorista Pro', 'Un solo descuento por cantidad, o variantes cargadas a mano producto por producto', 'A mano, en cada mensaje'],
  ['Lista mayorista separada del público', `Con código de acceso, desde ${fmt(PLANES.find(p => p.id === 'pro').precio)}/mes`, `Recién en planes de ${fmt(REFERENCIA.plan)}/mes o más`, 'Mandando un PDF'],
  ['Precio calculado desde tu costo y el dólar', 'Sí: cambia el dólar y se recalcula todo', 'Cargás el precio final de cada producto', 'Rehacés la lista entera'],
  ['Cargar la lista del proveedor', 'Excel o CSV en todos los planes; fotos, capturas, chats de WhatsApp y PDF desde Mayorista Pro', 'Una planilla con su formato', 'No aplica'],
  ['Flyers para Estados e historias', 'En un toque: con tu marca, o en marca blanca para que tus revendedores publiquen con su precio', 'Los armás aparte, en una app de diseño', 'Con capturas de pantalla'],
  ['Estadísticas en vivo + Google Analytics y Meta Pixel', 'Visitas y lo más visto en todos los planes; de dónde llegan, el embudo hasta el pedido, Meta Pixel y Google Analytics 4 desde Mayorista Pro', 'Según el plan', 'No hay'],
  ['Saber quién te debe y qué reponer', 'Incluido desde Mayorista Pro', 'Según el plan o con apps aparte', 'De memoria'],
  ['Recuperar clientes que dejaron de comprar', 'Lista con los días sin comprar y el WhatsApp listo para escribirles (Mayorista Pro)', 'Con campañas de email o apps aparte', 'De memoria'],
  ['Valor del abono', 'Fijo; si cambia, avisamos 30 días antes', 'Se ajusta cada trimestre', 'Gratis, pero te cuesta horas']
];
const GAR = [
  ['Sin permanencia', 'Pagás mes a mes o por año. Te vas cuando quieras, sin letra chica.'],
  ['Tus datos son tuyos', 'Descargás tus productos y pedidos en un clic, cuando quieras.'],
  ['Tu plata, directo a vos', 'No tocamos tus cobros ni te cobramos por vender.'],
  ['Te acompañamos', 'Guía paso a paso y ayuda dentro del panel desde el primer día.']
];
// v2.33: el simulador arranca en pesos (lo más común en tiendas locales); con ARS / USD se pasa a costo en dólares.
const simForm = () => `<div class="seg lp-mon" role="group" aria-label="Moneda de tu costo">${[['ARS', 'Pesos'], ['USD', 'Dólares']].map(([k, n]) => `<button type="button" class="${SIM.moneda === k ? 'on' : ''}" data-act="lp-mon" data-v="${k}" aria-pressed="${SIM.moneda === k}">${k} · ${n}</button>`).join('')}</div>
    <div class="lp-form">${SIM.moneda === 'USD' ? `<label>Costo en dólares<input class="fi" type="number" min="0.1" step="0.1" value="${SIM.costo}" data-input="lp-sim" data-k="costo"></label>
      <label>Dólar $<input class="fi" type="number" min="1" step="1" value="${SIM.dolar}" data-input="lp-sim" data-k="dolar"></label>` : `<label>Costo en pesos $<input class="fi" type="number" min="1" step="10" value="${SIM.costoArs}" data-input="lp-sim" data-k="costoArs"></label>`}
      <label>Ganancia x1 %<input class="fi" type="number" min="0" max="500" value="${SIM.m1}" data-input="lp-sim" data-k="m1"></label>
      <label>Ganancia x12 %<input class="fi" type="number" min="0" max="500" value="${SIM.m12}" data-input="lp-sim" data-k="m12"></label></div>`;
function simPrecios() {
  const { m1, m12 } = SIM, m3 = m12 + (m1 - m12) * 0.6, m6 = m12 + (m1 - m12) * 0.3;
  const c = SIM.moneda === 'USD' ? SIM.costo * SIM.dolar : SIM.costoArs;
  const p = { 1: precio(c, 1, m1), 3: precio(c, 1, m3), 6: precio(c, 1, m6), 12: precio(c, 1, m12) };
  const pct = v => Math.max(2, Math.min(100, Math.round(v / (p[1] || 1) * 100)));
  return `<div class="lp-tiers">${[1, 3, 6, 12].map(n => `<div><small>x${n}${n === 12 ? '+' : ''}</small><b>${fmt(p[n])}</b><i>ganás ${fmt(p[n] - c)} c/u</i></div>`).join('')}</div>
    <div class="lp-bars" role="img" aria-label="Cuánto de cada precio es costo y cuánto es tu ganancia">${[1, 3, 6, 12].map(n => `<div class="lp-bar"><span>x${n}${n === 12 ? '+' : ''}</span><div class="lp-bar-t"><i class="c" style="width:${pct(Math.min(c, p[n]))}%"></i><i class="g" style="width:${Math.max(0, pct(p[n]) - pct(Math.min(c, p[n])))}%"></i></div><em>${p[n] > c ? '+' + Math.round((p[n] - c) / c * 100) + '%' : '0%'}</em></div>`).join('')}<p class="lp-bar-leg"><i class="c"></i> tu costo <i class="g"></i> tu ganancia</p></div>
    <p class="hint">Costo puesto en mano: ${fmt(c)} por unidad.</p>`;
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

/* ---------- v2.32.2: el video de arriba (en loop, arranca sin sonido; "Activar sonido" lo empieza de nuevo con música) ---------- */
const VID = { io: null, usuario: false };
const videoHtml = () => `<figure class="lp-vid" id="lp-vid-box">
    <video id="lp-vid" muted loop playsinline preload="metadata" poster="/img/lp/embudo.jpg" width="864" height="1080" aria-describedby="lp-vid-tx"><source src="/img/lp/embudo.mp4" type="video/mp4"><source src="/img/lp/embudo.webm" type="video/webm"></video>
    <figcaption id="lp-vid-tx"><span class="lp-vid-acc"><button type="button" class="lp-vid-b" data-act="lp-son" aria-pressed="false"><span aria-hidden="true">🔇</span> Activar sonido</button><button type="button" class="lp-vid-b lp-vid-pp" data-act="lp-pp" aria-label="Pausar el video"><span aria-hidden="true">❚❚</span></button></span><span class="sr">En el video: las planillas y los PDF de tu proveedor (también fotos o el chat de WhatsApp) entran a Eskalapp y en minutos tenés tu tienda con precios x1, x3, x6 y x12; cuanto más cargan el carrito, más baja el precio, y el pedido te llega sumado por WhatsApp. </span><span class="lp-vid-real"><img src="/img/lua/lua-logo.png" alt="" width="22" height="22" loading="lazy">Ejemplo con la tienda real de Lua Beauty</span></figcaption></figure>`;
function vidBotones(v) {
  const s = document.querySelector('[data-act=lp-son]'), p = document.querySelector('[data-act=lp-pp]'); if (!v) return;
  if (s) { s.setAttribute('aria-pressed', String(!v.muted)); s.innerHTML = v.muted ? '<span aria-hidden="true">🔇</span> Activar sonido' : '<span aria-hidden="true">🔊</span> Sonido activado'; }
  if (p) { p.setAttribute('aria-label', v.paused ? 'Reproducir el video' : 'Pausar el video'); p.innerHTML = `<span aria-hidden="true">${v.paused ? '▶' : '❚❚'}</span>`; }
}
function iniciarVideo() {
  if (VID.io) { VID.io.disconnect(); VID.io = null; }
  VID.usuario = false;
  const v = $('#lp-vid'); if (!v) return;
  v.addEventListener('play', () => vidBotones(v)); v.addEventListener('pause', () => vidBotones(v)); v.addEventListener('volumechange', () => vidBotones(v));
  let quieto = false; try { quieto = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }
  if (quieto) { vidBotones(v); return; }   // con "menos movimiento" queda la imagen fija y el botón ▶
  const dale = () => { const p = v.play(); if (p && p.catch) p.catch(() => vidBotones(v)); };
  // se reproduce solo mientras se ve (ahorra batería y datos); si la persona lo pausó, respeta su decisión
  if (typeof IntersectionObserver !== 'undefined') {
    VID.io = new IntersectionObserver(es => { const e = es[es.length - 1]; if (VID.usuario) return; if (e.isIntersecting) dale(); else if (!v.paused) v.pause(); }, { threshold: 0.35 });
    VID.io.observe(v);
  } else dale();
}
on('lp-son', () => { const v = $('#lp-vid'); if (!v) return; v.muted = !v.muted; if (!v.muted) { v.currentTime = 0; VID.usuario = false; const p = v.play(); if (p && p.catch) p.catch(() => { }); } vidBotones(v); });
on('lp-pp', () => { const v = $('#lp-vid'); if (!v) return; if (v.paused) { VID.usuario = false; const p = v.play(); if (p && p.catch) p.catch(() => { }); } else { VID.usuario = true; v.pause(); } vidBotones(v); });

/* ---------- v2.32: todo el negocio, con capturas reales del panel ---------- */
const NEG = [
  ['resumen', 'Resumen', 'Lo importante del día apenas entrás: pedidos nuevos, lo que cobraste y lo que falta cobrar.'],
  ['pedidos', 'Pedidos', 'Cada pedido entra ordenado por etapas (nuevo, confirmado, listo, despachado), con el WhatsApp del cliente a un toque.'],
  ['caja', 'Caja', 'Lo que entró y lo que salió hoy, en efectivo y por transferencia por separado, sin anotar nada aparte.'],
  ['presupuestos', 'Presupuestos', 'Armás un presupuesto, lo mandás por WhatsApp y, si lo acepta, pasa a pedido con un toque.'],
  ['cobranzas', 'Quién te debe', 'Quién te debe, cuánto y hace cuántos días, con el mensaje listo para recordarle.'],
  ['reposicion', 'Qué reponer', 'Lo que se te está por acabar según lo que vendés, antes de quedarte sin stock.'],
  ['resultado', 'Resultado', 'Cuánto vendiste y cuánto ganaste de verdad, descontando costos y gastos.'],
];
const negImg = k => { const n = NEG.find(x => x[0] === k) || NEG[0]; return `<img src="/img/lp/${n[0]}.webp" alt="Panel de ${esc(MARCA.NOMBRE)}: ${esc(n[1])}" width="1400" height="900" loading="lazy">`; };
const negocioHtml = () => `<div class="lp-neg"><div class="lp-neg-tabs" role="tablist" aria-label="Partes del panel">${NEG.map(([k, t]) => `<button type="button" role="tab" id="lp-neg-${k}" aria-selected="${LP.neg === k}" aria-controls="lp-neg-p" class="${LP.neg === k ? 'on' : ''}" data-act="lp-neg" data-k="${k}">${t}</button>`).join('')}</div>
    <div class="lp-neg-in"><figure class="lp-cap-pc" id="lp-neg-p" role="tabpanel" aria-labelledby="lp-neg-${LP.neg}"><div class="lp-cap-bar" aria-hidden="true"><i></i><i></i><i></i></div>${negImg(LP.neg)}<figcaption id="lp-neg-tx">${esc((NEG.find(x => x[0] === LP.neg) || NEG[0])[2])}</figcaption></figure>
    <figure class="lp-cap-cel"><img src="/img/lp/tienda.webp" alt="La tienda de Lua Beauty en el celular de un cliente" loading="lazy" width="780" height="1688"><figcaption>La tienda en el celular de tu cliente (Lua Beauty).</figcaption></figure></div></div>`;
on('lp-neg', d => { if (!NEG.some(x => x[0] === d.k)) return; LP.neg = d.k; const f = $('#lp-neg-p'), tx = $('#lp-neg-tx');
  if (f) { const im = f.querySelector('img'); if (im) im.outerHTML = negImg(d.k); f.setAttribute('aria-labelledby', 'lp-neg-' + d.k); }
  if (tx) tx.textContent = (NEG.find(x => x[0] === d.k) || NEG[0])[2];
  document.querySelectorAll('[data-act=lp-neg]').forEach(b => { const on_ = b.dataset.k === d.k; b.classList.toggle('on', on_); b.setAttribute('aria-selected', on_); }); });

/* ---------- v2.32: el dato de las apps de catálogo (planes publicados, sin nombrar a nadie) ---------- */
function catalogoHtml() {
  const c = REFERENCIA.catalogo; if (!c || !c.precio) return '';
  const pro = PLANES.find(p => p.id === 'pro');
  return `<div class="lp-cat"><b>¿Y las apps de catálogo con pedidos por WhatsApp?</b><p>Cobran desde <b>${fmt(c.precio)} por mes con ${c.productos} productos</b>${c.precio2 ? ` (${c.productos2} productos: ${fmt(c.precio2)})` : ''}. Acá, <b>gratis hasta 100 productos</b>, y desde <b>${fmt(pro.precio)}</b> sin límite.</p><small>Planes publicados a ${esc(REFERENCIA.fecha)}.</small></div>`;
}

const wspSoporte = () => MARCA.SOPORTE_WSP ? `https://api.whatsapp.com/send?phone=${esc(MARCA.SOPORTE_WSP)}&text=${encodeURIComponent('Hola, tengo una consulta sobre ' + MARCA.NOMBRE)}` : '';
const titularReal = () => MARCA.TITULAR && !/^\[/.test(MARCA.TITULAR) ? MARCA.TITULAR : '';
// Testimonios reales: se cargan en js/config.js → CONFIG_MARCA.TESTIMONIOS = [{ nombre, rubro, texto, url }]. Sin datos, la sección no aparece.
const testimonios = () => (Array.isArray(MARCA.TESTIMONIOS) ? MARCA.TESTIMONIOS : []).filter(t => t && t.nombre && t.texto).slice(0, 3);
const urlOk = u => /^https:\/\//.test(String(u || ''));
let FIJO = null;
export function inicio(app) {
  const N = esc(MARCA.NOMBRE); GB.q = 0;
  const T = testimonios(), wsp = wspSoporte(), tit = titularReal();
  const cta = (cl = 'btn-p') => `<a class="btn ${cl}" href="#/registro">${CTA}</a>`;
  app.innerHTML = `<div class="lp-top" id="lp-top"><div class="lp-top-in"><a class="lp-logo" href="#/" aria-label="${N}"><img src="/logo.svg" alt="" width="30" height="30">${N}</a>
    <nav class="lp-nav" aria-label="Secciones"><button type="button" data-act="lp-ir" data-k="probar">Cómo funciona</button><button type="button" data-act="lp-ir" data-k="comparar">Comparar</button><button type="button" data-act="lp-ir" data-k="planes">Planes</button><button type="button" data-act="lp-ir" data-k="faq">Preguntas</button></nav>
    <span class="lp-top-acc"><a class="lp-in" href="#/login">Ingresar</a><a class="btn btn-p btn-sm" href="#/registro">${CTA}</a></span></div></div>
  <div class="lp">
  <section class="lp-hero"><div class="lp-hero-tx"><div class="tag">Para mayoristas, tiendas y emprendedores</div>
    <h1>De tu lista a una tienda online en minutos. <span>Compartís tu link y recibí el pedido en tu WhatsApp</span></h1></div>
    <div class="lp-hero-demo">${videoHtml()}</div>
    <div class="lp-hero-mas"><div class="lp-perfil" role="group" aria-label="¿Cuál es tu caso?">${Object.entries(PERFILES).map(([k, v]) => `<button type="button" data-act="lp-perfil" data-k="${k}" class="${LP.perfil === k ? 'on' : ''}" aria-pressed="${LP.perfil === k}">${v[0]}</button>`).join('')}</div>
    <div id="lp-perfil-in">${perfilHtml()}</div>
    <div class="lp-cta" id="lp-cta">${cta()}<button type="button" class="btn btn-s" data-act="lp-ir" data-k="probar">Probar con mi lista</button></div>
    <p class="lp-micro">${MICRO}</p>
    ${cuposHtml()}</div></section>

  <ul class="lp-conf"><li><i>${ICO.cero}</i><b>0% de comisión</b>por cada venta</li><li><i>${ICO.infinito}</i><b>Gratis</b>hasta 100 productos, sin límite de pedidos</li><li><i>${ICO.candado}</i><b>Sin permanencia</b>te vas cuando quieras</li><li><i>${ICO.chat}</i><b>Soporte humano real</b>te ayudamos a armar tu tienda</li></ul>

  <section class="lp-sec lp-gbsec"><div class="lp-gbsec-tx"><h2>Así compra tu cliente: cada escalón baja el precio</h2><p class="lp-sub">Precios por cantidad x1 · x3 · x6 · x12, automáticos. Tocá <b>+</b> y mirá cómo baja: son los precios reales de un producto de <b>Lua Beauty</b>.</p>
    <p class="lp-real"><img src="/img/lua/lua-logo.png" alt="" width="28" height="28" loading="lazy">Tienda real de Lua Beauty · cosmética y skincare</p></div><div id="lp-gb">${gbHtml()}</div></section>

  <section class="lp-sec" id="probar"><h2>Probalo con tu lista, sin registrarte</h2><p class="lp-sub">${N} lee la lista de tu proveedor, calcula tus precios con tu ganancia y te arma la tienda para recibir pedidos por WhatsApp.</p>
    <ol class="lp-pasos"><li><i>${ICO.lista}</i><b>Subí la lista de tu proveedor</b></li><li><i>${ICO.margen}</i><b>Poné tu margen</b></li><li><i>${ICO.tienda}</i><b>Listo: tu tienda con tus precios</b></li></ol>
    ${demoHtml()}</section>

  <section class="lp-sec"><h2>¿Por qué elegir ${N}?</h2><div class="lp-grid lp-grid4">${PORQUE.map(([i, t, d]) => `<div class="lp-card"><span class="i" aria-hidden="true">${ICO[i]}</span><b>${t}</b><p>${d}</p></div>`).join('')}</div>
    <details class="lp-mas"><summary>Ver todo lo que incluye</summary><ul>${MAS.map(([t, d]) => `<li><b>${t}</b>${d}</li>`).join('')}</ul></details>
    <details class="lp-mas lp-sim" id="lp-simular"><summary>Simulá tus precios con un producto tuyo</summary>
    <div id="lp-sim-f">${simForm()}</div>
    <div id="lp-sim1">${simPrecios()}</div></details></section>

  <section class="lp-sec lp-ver" id="negocio"><h2>Todo tu negocio en un lugar</h2><p class="lp-sub">No es solo un catálogo: pedidos, caja, presupuestos, quién te debe y qué reponer, en el mismo panel. Capturas reales del panel con datos de ejemplo.</p>
    ${negocioHtml()}
    ${urlOk(MARCA.DEMO_URL) ? `<a class="btn btn-s lp-mid" id="lp-demo-url" href="${esc(MARCA.DEMO_URL)}" target="_blank" rel="noopener">Mirá una tienda funcionando</a>` : ''}</section>

  <section class="lp-sec lp-demos" id="demos" hidden><h2>Tiendas reales funcionando</h2><p class="lp-sub">Comercios que ya venden con ${N} nos prestan su tienda. Entrá, mirá los precios por cantidad y armá un pedido de prueba: no se manda ni se guarda.</p><div class="lp-dms" id="lp-dms"></div></section>

  <section class="lp-sec" id="comparar"><h2>Compará antes de elegir</h2><p class="lp-sub">Las plataformas tradicionales cobran el abono más un porcentaje de cada venta. Nosotros, solo el abono.</p>
    <div class="lp-sim lp-costo"><label class="lp-range">Vendés por mes: <b id="lp-v">${fmt(SIM.ventas)}</b><input type="range" min="500000" max="30000000" step="500000" value="${SIM.ventas}" data-input="lp-ventas" aria-label="Ventas por mes"></label>
    <div id="lp-sim2">${simCosto()}</div>${catalogoHtml()}</div>
    <div class="lp-vsw"><table class="lp-vs"><thead><tr><th></th><th class="on">${N}</th><th>Plataforma tradicional</th><th>Solo WhatsApp y planilla</th></tr></thead><tbody>${VS.map(r => `<tr><td>${r[0]}</td><td class="on">${r[1]}</td><td>${r[2]}</td><td class="no">${r[3]}</td></tr>`).join('')}</tbody></table></div>
    <p class="hint" style="margin-top:8px">Comparación general con los planes y condiciones publicados por plataformas líderes a ${esc(REFERENCIA.fecha)}. Cada una tiene sus particularidades.</p></section>

  ${T.length ? `<section class="lp-sec" id="opiniones"><h2>Lo que dicen los que ya venden con ${N}</h2><div class="lp-testi">${T.map(t => `<figure><blockquote>“${esc(t.texto)}”</blockquote><figcaption><b>${esc(t.nombre)}</b>${t.rubro ? `<span>${esc(t.rubro)}</span>` : ''}${urlOk(t.url) ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">Ver su tienda →</a>` : ''}</figcaption></figure>`).join('')}</div></section>` : ''}

  <section class="lp-sec" id="planes"><h2>Planes</h2><p class="lp-sub">Empezás gratis y publicás hasta 100 productos, para siempre. Los planes pagos tienen precios de lanzamiento en pesos y los probás <span class="dias-prueba">14</span> días con todo desbloqueado, sin tarjeta.</p>
    ${ANUAL ? `<div class="seg pl-periodo" id="lp-periodo" role="group" aria-label="Forma de pago"><button class="${LP.anual ? '' : 'on'}" data-act="lp-periodo" data-v="mes" aria-pressed="${!LP.anual}">Mensual</button><button class="${LP.anual ? 'on' : ''}" data-act="lp-periodo" data-v="anual" aria-pressed="${LP.anual}">Anual · ${12 - ANUAL === 1 ? '1 mes gratis' : (12 - ANUAL) + ' meses gratis'}</button></div>` : ''}
    <div id="lp-planes-in">${planesLanding()}</div>
    ${setupHtml()}
    <ul class="lp-gar">${GAR.map(([t, d]) => `<li><b>${t}</b>${d}</li>`).join('')}</ul></section>

  <section class="lp-sec"><h2>Así arrancás</h2><ol class="home-steps"><li>Creás tu cuenta con email y contraseña.</li><li>Ponés el nombre de tu negocio y tu WhatsApp: te armamos la tienda con productos de ejemplo.</li><li>Una guía te lleva paso a paso: tu logo, tu alias, tu lista de precios y tus envíos.</li><li>Compartís tu enlace y los pedidos te llegan al WhatsApp.</li></ol></section>

  <section class="lp-sec" id="faq"><h2>Preguntas frecuentes</h2><div class="st-faq-l">${FAQ.map(([p, r]) => `<details><summary>${p}</summary><p>${r}</p></details>`).join('')}</div>
    ${wsp ? `<p class="lp-duda">¿Te quedó una duda? <a href="${wsp}" target="_blank" rel="noopener">Escribinos por WhatsApp</a> y te respondemos.</p>` : ''}</section>

  <section class="lp-final"><h2>Armá tu tienda hoy</h2><p>En unos minutos tenés tu lista online con tus precios, por menor o por mayor, y los pedidos llegando a tu WhatsApp.</p>${cta('btn-inv')}<small>${MICRO}</small></section>

  <footer class="lp-foot"><div><b class="lp-logo"><img src="/logo.svg" alt="" width="24" height="24">${N}</b><p>Tu tienda mayorista y minorista con precios por cantidad y pedidos por WhatsApp.</p>${tit ? `<p class="lp-tit">${esc(tit)}${MARCA.CUIT && !/^\[/.test(MARCA.CUIT) ? ' · CUIT ' + esc(MARCA.CUIT) : ''}</p>` : ''}</div>
    <nav aria-label="Enlaces"><a href="#/registro">${CTA}</a><a href="#/login">Ingresar</a>${wsp ? `<a href="${wsp}" target="_blank" rel="noopener">Soporte por WhatsApp</a>` : ''}${MARCA.EMAIL_CONTACTO ? `<a href="mailto:${esc(MARCA.EMAIL_CONTACTO)}">${esc(MARCA.EMAIL_CONTACTO)}</a>` : ''}<a href="#/terminos">Términos y condiciones</a><a href="#/privacidad">Privacidad</a></nav></footer></div>
  <div class="lp-fijo" id="lp-fijo" hidden><span><b>${N}</b>Gratis hasta 100 productos · sin tarjeta</span><a class="btn btn-p btn-sm" href="#/registro">${CTA}</a></div>`;
  cargarCupos(); autoBarra(); cargarDemos(); iniciarVideo();
  // en el celular, el botón queda fijo abajo cuando el del encabezado ya quedó arriba.
  // v2.32: se mira en cada scroll (con el video arriba, el botón arranca fuera de pantalla y un salto largo no lo "cruza")
  if (FIJO) { window.removeEventListener('scroll', FIJO); FIJO = null; }
  const c = $('#lp-cta'), f = $('#lp-fijo');
  if (c && f) {
    let pend = false;
    const fijo = FIJO = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; if (!c.isConnected) { window.removeEventListener('scroll', fijo); if (FIJO === fijo) FIJO = null; return; } f.hidden = c.getBoundingClientRect().bottom > 0; }); };
    window.addEventListener('scroll', fijo, { passive: true }); fijo();
  }
}
// v2.31: tiendas reales que prestaron la suya como demo (con permiso de la dueña; las elige el admin). Sin ninguna, la sección no aparece.
const MODAL = { mayorista: 'Por mayor', minorista: 'Al público', hibrido: 'Por mayor y al público' };
async function cargarDemos() {
  const L = await api.demosPublicas(), sec = $('#demos'), box = $('#lp-dms'); if (!sec || !box || !Array.isArray(L) || !L.length) return;
  box.innerHTML = L.map(d => { const f = (d.fotos || []).slice(0, 4), rub = RUBROS[d.rubro] && d.rubro !== 'otro' ? RUBROS[d.rubro] : '';
    return `<a class="lp-dm" href="${esc(urlTiendaDe(d.slug, '?demo'))}" target="_blank" rel="noopener" style="--dc:${esc(/^#[0-9a-f]{3,8}$/i.test(d.color || '') ? d.color : '#1d4ba8')}">
      <div class="lp-dm-f n${f.length}" aria-hidden="true">${f.map(u => `<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('') || '<span></span>'}</div>
      <div class="lp-dm-t"><b>${d.logo_url ? `<img src="${esc(d.logo_url)}" alt="" class="lp-dm-logo" loading="lazy" referrerpolicy="no-referrer">` : ''}${esc(d.nombre)}</b>
      <small>${[rub, MODAL[d.modalidad] || '', d.productos ? d.productos + ' productos' : ''].filter(Boolean).map(esc).join(' · ')}</small>
      <span class="lp-dm-b">Ver la demo →</span></div></a>`; }).join('');
  sec.hidden = false;
  const u = $('#lp-demo-url'); if (u) u.hidden = true;   // con demos reales, el botón viejo sobra
}
on('lp-mon', d => { if (!['ARS', 'USD'].includes(d.v) || SIM.moneda === d.v) return; SIM.moneda = d.v; const f = $('#lp-sim-f'), b = $('#lp-sim1'); if (f) f.innerHTML = simForm(); if (b) b.innerHTML = simPrecios(); });
on('lp-sim', (d, el) => { const v = Number(el.value); if (!(v >= 0)) return; SIM[d.k] = v; const b = $('#lp-sim1'); if (b) b.innerHTML = simPrecios(); });
on('lp-ventas', (d, el) => { SIM.ventas = Number(el.value); const b = $('#lp-sim2'), t = $('#lp-v'); if (t) t.textContent = fmt(SIM.ventas); if (b) b.innerHTML = simCosto(); });
