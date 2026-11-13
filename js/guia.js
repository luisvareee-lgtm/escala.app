// Guía de primeros pasos (se tilda sola) y Ayuda: buscador de soluciones + soporte por WhatsApp con el contexto armado.
import { esc, on, store, $, waLink } from './util.js';
import { P, PLAN_NOMBRE, planEf } from './state.js';
import { MARCA, urlTiendaDe } from './marca.js';
import { resetImp } from './imp_ui.js';

const k = () => 'guia:' + (P.t && P.t.id);
const marcas = () => store.get(k(), {}) || {};
const marcar = (x, v = true) => { const m = marcas(); m[x] = v; store.set(k(), m); };
// los productos de ejemplo se crean junto con la tienda (mismo minuto)
const ejemplo = p => P.t && p.created_at && Math.abs(new Date(p.created_at) - new Date(P.t.created_at)) < 5000;

export function pasosGuia() {
  const t = P.t, m = marcas(), reales = P.prods.filter(p => !ejemplo(p));
  return [
    { id: 'estilo', i: '🎨', t: 'Poné tu logo y tu color', d: 'Que tus clientes reconozcan tu marca.', ok: !!t.logo_url || (t.color && t.color.toLowerCase() !== '#1d4ba8') || !!t.eslogan, ir: 'tienda' },
    { id: 'cobro', i: '🏦', t: 'Cargá tu alias para cobrar', d: 'Sale en el ticket que te mandan por WhatsApp.', ok: !!t.alias_cobro, ir: 'ajustes' },
    { id: 'productos', i: '📥', t: 'Cargá tus productos', d: 'Importá la lista del proveedor (fotos, chat, Excel, PDF o CSV) o cargalos a mano.', ok: reales.length >= 3, ir: 'productos', extra: 'importar' },
    { id: 'ejemplos', i: '🧹', t: 'Borrá los productos de ejemplo', d: 'Los productos que vinieron con la tienda son solo para que veas cómo queda.', ok: !P.prods.some(ejemplo), ir: 'productos', omitible: true },
    { id: 'envios', i: '🚚', t: 'Contá cómo entregás', d: 'Retiro, moto, correo o “a coordinar”, con su costo.', ok: Array.isArray(t.envios) && t.envios.length > 0, ir: 'tienda', omitible: true },
    { id: 'prueba', i: '🛒', t: 'Hacé un pedido de prueba', d: 'Comprá en tu propia tienda para ver lo que ve tu cliente. Después lo cancelás.', ok: P.pedidos.length > 0, tienda: true },
    { id: 'compartir', i: '📣', t: 'Compartí tu enlace', d: 'En tus estados, grupos y redes. ¡A vender!', ok: !!m.compartir, compartir: true }
  ].map(p => Object.assign(p, { ok: p.ok || (p.omitible && !!m['omit_' + p.id]) }));
}

export function guiaHtml(urlTienda) {
  if (marcas().oculta) return '';
  const L = pasosGuia(), hechos = L.filter(p => p.ok).length, pct = Math.round(hechos / L.length * 100);
  if (hechos === L.length) return `<div class="guia fin"><b>🎉 ¡Tu tienda está lista!</b> Completaste todos los pasos. <button class="linkb" data-act="g-ocultar">Ocultar</button></div>`;
  const sig = L.find(p => !p.ok);
  return `<section class="guia" aria-label="Primeros pasos"><div class="guia-h"><b>🚀 Primeros pasos · ${hechos} de ${L.length}</b><button class="linkb" data-act="g-ocultar">Ocultar guía</button></div>
    <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
    <ol class="guia-l">${L.map(p => `<li class="${p.ok ? 'ok' : p === sig ? 'sig' : ''}"><span class="guia-i" aria-hidden="true">${p.ok ? '✓' : p.i}</span><span class="guia-tx"><b>${p.t}</b>${p.ok ? '' : `<small>${p.d}</small>`}</span>
      ${p.ok ? '' : `<span class="guia-acc">${p.compartir ? `<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" data-act="g-compartir" href="${esc(waLink('', '¡Mirá mi tienda online! Hacé tu pedido acá: ' + urlTienda))}">Compartir</a>` : p.tienda ? `<a class="btn btn-p btn-sm" href="${esc(urlTienda)}" target="_blank" rel="noopener">Abrir mi tienda</a>` : `<button class="btn ${p === sig ? 'btn-p' : 'btn-s'} btn-sm" data-act="g-ir" data-k="${p.ir}" data-x="${p.extra || ''}">Hacerlo</button>`}${p.omitible ? `<button class="linkb" data-act="g-omitir" data-id="${p.id}">No aplica</button>` : ''}</span>`}</li>`).join('')}</ol></section>`;
}
on('g-ocultar', () => { marcar('oculta'); P.repintar(); });
on('g-omitir', d => { marcar('omit_' + d.id); P.repintar(); });
on('g-compartir', () => { marcar('compartir'); setTimeout(P.repintar, 400); });
on('g-ir', d => { P.tab = d.k; if (d.x === 'importar') resetImp(); P.modal = d.x === 'importar' ? { tipo: 'imp' } : null; P.repintar(); window.scrollTo(0, 0); });
export const mostrarGuia = () => { marcar('oculta', false); };

/* ---------------- AYUDA ---------------- */
// Base de soluciones: problemas reales que ya resolvimos. "ir" lleva a la pantalla donde se arregla.
const ARTS = [
  { t: 'Cómo hago un flyer para mis Estados de WhatsApp', k: 'flyer imagen estado historia instagram publicar foto promocion diseño', r: 'Productos → 📸 Crear flyer: tocás de 1 a 4 productos y “Armar flyer”. Sale una imagen vertical con tu logo, tu enlace y tu WhatsApp; elegís el estilo, la etiqueta y qué precio mostrar. Tus revendedores también pueden: en tu lista mayorista cada producto tiene “Crear Flyer para Vender”, que sale SIN tus datos, con el precio y el contacto de ellos.', ir: 'productos' },
  { t: 'Llegó la mercadería: cómo aviso a mis clientes', k: 'llego mercaderia pedido proveedor encargo en espera avisar listo entregar recibir', r: 'Pedidos → 📦 Llegó mercadería (o Asistente → Pedido al proveedor). Tildás lo que entró: los pedidos que quedan completos pasan solos a “Listo para entregar” y te aparece un botón por cliente para avisarle por WhatsApp. Aparecen los pedidos que marcaste como comprados o que pusiste “En espera”.', ir: 'pedidos' },
  { t: 'Quiero tomar pedidos hasta un día y hora (tandas o preventa)', k: 'cierre pedidos cuenta regresiva ronda tanda preventa viernes hora limite pausar', r: 'Tienda → ⏳ Cierre de pedidos: elegís día y hora. Tu tienda muestra la cuenta regresiva arriba. Cuando se cumple, elegís vos: pausar los pedidos, o seguir tomándolos avisando que entran en la próxima tanda.', ir: 'tienda' },
  { t: 'Instalar el panel en mi celular como una app', k: 'app instalar celular pantalla inicio icono aplicacion', r: 'Ajustes → “Tené el panel como una app”. En Android (Chrome): menú ⋮ → Agregar a pantalla principal. En iPhone (Safari): Compartir → Agregar a inicio.', ir: 'ajustes' },
  { t: '“Ver mi tienda” me abre el panel', k: 'ver tienda abre panel enlace link compartir no funciona', r: 'Si estás en tu propio celular o compu con la sesión iniciada y el enlace de la tienda te lleva al panel, falta un ajuste del sitio (la función de la tienda pública). Tus clientes NO ven tu panel: sin tu contraseña nadie entra. Escribinos a soporte y lo dejamos andando.' },
  { t: 'Cómo cargo la lista de mi proveedor', k: 'importar cargar lista proveedor excel pdf csv fotos productos masivo', r: 'Productos → 📥 Importar. Podés subir varios archivos juntos: fotos con el precio escrito, capturas, el chat de WhatsApp exportado (.zip), Excel, PDF o el CSV de tu tienda actual. Revisás nombre y costo en la tabla y elegís tu ganancia antes de publicar.', ir: 'productos', imp: true },
  { t: 'Cómo exportar el chat de WhatsApp del proveedor', k: 'whatsapp chat exportar grupo canal zip fotos', r: 'En el grupo: ⋮ → Más → Exportar chat → Incluir archivos. Te queda un .zip: subilo en Importar. De un canal no se puede exportar: guardá las fotos o capturas y subilas todas juntas.' },
  { t: 'El precio de la foto es de mi proveedor, no el mío', k: 'captura foto precio proveedor costo margen reventa', r: 'Está bien: ese precio se toma como TU COSTO y la app le suma tu ganancia. Las capturas no se usan como foto del producto (tienen el precio del proveedor); podés recortar solo el producto con ✂️ o dejarlo sin foto.' },
  { t: 'Un precio me quedó mal o lee mal la foto', k: 'precio mal leyo ocr foto equivocado corregir costo', r: 'En la tabla de Importar podés corregir nombre y costo antes de cargar. Si ya está cargado, abrí el producto en Productos y cambiá el costo. Las fotos con letra chica o fondos recargados se leen peor.' },
  { t: 'Cómo cambio la cotización del dólar o mis márgenes', k: 'dolar cotizacion margen ganancia escalas porcentaje subir precios', r: 'Ajustes → Datos y precios: cotización del dólar y márgenes x1, x3, x6 y x12 (de mayor a menor). Al guardar se recalcula todo el catálogo.', ir: 'ajustes' },
  { t: 'Subir todos los precios un %', k: 'aumento masivo subir precios porcentaje inflacion actualizar', r: 'Precios → Actualización masiva: subís o bajás los costos un % de todo el catálogo o de una categoría.', ir: 'precios' },
  { t: 'Vender por caja, kg, metro o precio único', k: 'caja bulto kg metro docena unidad precio unico sin escala', r: 'Al editar el producto: “Se vende por” (caja, bulto, kg, metro…) y “Unidades que trae”. Si no querés descuento por cantidad, tildá “Precio único”.', ir: 'productos' },
  { t: 'Cómo pongo un carrusel de productos o le doy movimiento a la tienda', k: 'carrusel destacados vitrina productos slider movimiento animaciones efectos estetica diseño profesional', r: 'Tienda → Diseño de la tienda → 🎠 Carrusel de productos: prendelo, ponele un título y elegí qué muestra (automático, los que elijas o una categoría). En ✨ Efectos de movimiento prendés o apagás las animaciones (los productos aparecen al bajar, el carrito salta al agregar, el carrusel pasa solo). Tocá Guardar diseño.', ir: 'tienda' },
  { t: 'Cómo edito o borro muchos productos a la vez', k: 'masivo masiva seleccionar varios todos editar borrar eliminar ocultar categoria precio stock talles variantes nombre pagina', r: 'En Productos tildá los que querés (o “Seleccionar esta página” y después “Seleccionar los N”). Abajo aparece una barra: ✏️ Editar (precio, stock, nombre, talles, categoría, marca, visible…), Mostrar, Ocultar, Categoría, Oferta, Flyer, Armar combo o Eliminar. Se aplica a todos juntos.', ir: 'productos' },
  { t: 'Cómo sé qué productos se venden o se miran más', k: 'mas vendidos populares visitas sin ventas sin visitas ordenar estadisticas nuevos', r: 'En Productos elegí “Ordenar: Más vendidos / Más populares / Nuevos ingresos” o “Mostrar: Sin ventas / Sin visitas” y el período. Vendidos = unidades en pedidos no cancelados. Visita = alguien abrió la ficha del producto; Al carrito = alguien lo agregó (cada persona cuenta una vez por día y vos no contás).', ir: 'productos' },
  { t: 'Cómo pongo productos en oferta', k: 'oferta ofertas semanal descuento porcentaje promo promocion tachado flyer', r: 'En Productos tildá los productos y tocá 🏷️ Oferta: poné el % y hasta qué día. La tienda muestra el precio tachado y la etiqueta -%, y vuelve sola al precio normal cuando termina. Con 📸 Flyer armás la imagen de la oferta. En Diseño podés sumar el carrusel “Ofertas de la semana”.', ir: 'productos' },
  { t: 'Cómo armo un combo', k: 'combo combos kit pack promo armar juntos', r: 'En Productos tildá de 2 a 10 productos y tocá 🧩 Armar combo (o en la ficha de un producto, “Combo”). Elegí cuántos de cada uno y el descuento. El costo y el stock salen de lo que trae: al cobrar el pedido se descuenta el stock de cada producto.', ir: 'productos' },
  { t: 'Cómo agrego carruseles o categorías con fotos', k: 'carrusel carruseles vitrina destacados categorias fotos diseño movimiento efectos', r: 'Tienda → Diseño de la tienda: “+ Carrusel” (hasta 4: automático, los que elijo, una categoría, nuevos ingresos, más vendidos o en oferta; arriba o abajo del catálogo) y “Comprá por categoría, con fotos”.', ir: 'tienda' },
  { t: 'Estilos publicitarios del flyer (/luxury, /ugc, /metaads…)', k: 'flyer estilos codigo codigos luxury ugc ugccreator metaads meta ads 3d cinematic macro lifestyle realist realista productworld prompt ia chatgpt gemini anuncio publicidad', r: 'En el estudio de flyers, debajo de los estilos clásicos, están los estilos publicitarios: /productworld, /ugccreator, /ugc, /lifestyle, /macro, /luxury, /3d, /cinematic, /realist y /metaads (este último sale en formato 4:5 para anuncios). Tocá uno o escribí su código. Cada estilo trae un “Prompt para IA”: copialo y pegalo en ChatGPT o Gemini junto con la foto del producto para generar una foto realista en ese estilo.', ir: 'productos' },
  { t: 'Cómo mando una sugerencia o pido una función', k: 'sugerencia sugerir mejora idea pedir funcion falta reclamo opinion feedback', r: 'En Ayuda (botón 💬) o en el menú Más, tocá “💡 Sugerir una mejora”, contá tu idea y enviala. La lee directamente quien arma la plataforma.' },
  { t: 'Soy fundador: ¿qué incluye?', k: 'fundador fundadores programa gratis meses prueba larga sin pagar', r: 'Las primeras tiendas de la plataforma son fundadoras: tienen todo desbloqueado durante la prueba larga, sin pagar. Los días que te quedan se ven en el botón de arriba (⭐ Fundador) y en Ajustes. A cambio, contanos qué te falta con “Sugerir una mejora”.', ir: 'ajustes' },
  { t: 'Cómo elijo qué medios de pago acepto', k: 'medios pago transferencia efectivo link mercado pago cobrar apagar prender sacar quitar', r: 'Tienda → Envíos y entregas → 💳 Medios de pago: tildá los que aceptás (transferencia, efectivo, link de pago / Mercado Pago) y tocá Guardar. Tus clientes solo ven esos al confirmar; tiene que quedar al menos uno. El alias / CBU se carga en Ajustes.', ir: 'tienda' },
  { t: 'Cómo prendo o apago la ayuda de cada campo', k: 'ayuda asistente explicacion campo recuadro que pongo apagar prender ocultar', r: 'Arriba de Ajustes → Datos y precios, de Tienda → Envíos y del alta de la tienda está la opción “💡 Ayuda en cada campo”. Tildada, al tocar un campo aparece un recuadro que explica qué poner, con un ejemplo. La apagás destildándola o con “No mostrar más”; queda recordado en ese dispositivo.', ir: 'ajustes' },
  { t: 'Cómo funcionan las escalas x1 x3 x6 x12', k: 'escala x3 x6 x12 volumen cantidad descuento mayorista combinar', r: 'El precio baja según cuántas unidades lleva el cliente de cada producto (las variantes suman juntas). En Ajustes → Datos y precios podés elegir que se sumen los productos de la misma categoría o todo el carrito. El carrito le avisa cuánto le falta para el siguiente escalón.' },
  { t: 'Que los revendedores vean la lista mayorista', k: 'mayorista codigo revendedor hibrido acceso lista', r: 'Ajustes → Modalidad “Híbrido” y en “Accesos mayoristas” ponés un código. El público ve el precio final; tus revendedores tocan “Acceso Mayorista” e ingresan el código (plan Mayorista Pro).', ir: 'ajustes' },
  { t: 'Configurar envíos y costos', k: 'envio envios costo correo moto retiro via cargo andreani cp codigo postal', r: 'Tienda → Envíos y entregas: cargás retiro, moto, correo o “a coordinar” con costo y detalle. Si el costo depende del destino, dejalo en 0 y al cliente le sale “a coordinar”. Ahí también elegís si pedís DNI, provincia y código postal.', ir: 'tienda' },
  { t: 'Pedirle DNI, código postal o provincia al cliente', k: 'dni cuit provincia codigo postal cp datos cliente checkout carrito', r: 'Tienda → “Datos que le pedís al cliente”: cada dato puede ser no pedir, opcional u obligatorio.', ir: 'tienda' },
  { t: 'Banner, barra de anuncios, “Cómo comprar” y preguntas', k: 'banner portada anuncio barra corre marquesina diseño como comprar preguntas frecuentes faq', r: 'Tienda → Diseño de la tienda: anuncios (con “que corra”), banners con imagen, beneficios, “Cómo comprar” (automático o tuyo), preguntas frecuentes sugeridas y ventana de bienvenida. Mirá la vista previa y guardá.', ir: 'tienda' },
  { t: 'Cómo manejo un pedido (etapas, cobro, remito)', k: 'pedido etapas confirmado despachado entregado cobrado remito seguimiento cancelar', r: 'Pedidos → tocá el pedido: lo pasás de etapa, marcás cobrado, cargás el seguimiento, imprimís el remito y le avisás al cliente con el mensaje de WhatsApp listo. Cancelar devuelve el stock.', ir: 'pedidos' },
  { t: 'Quién me debe plata', k: 'deuda cobrar cobranza debe pendiente recordatorio pago', r: 'Asistente → Cobranzas: lo que te deben por antigüedad y un botón para recordarle a cada cliente por WhatsApp con el detalle y tu alias.', ir: 'asistente' },
  { t: 'Qué tengo que reponer', k: 'reponer stock comprar proveedor agotado dias stock', r: 'Asistente → Reposición: días de stock que te quedan, cuánto comprar y el pedido armado por proveedor. Necesita el stock cargado en tus productos.', ir: 'asistente' },
  { t: 'Cuánto gané de verdad', k: 'ganancia neta resultado gastos compras caja rentable', r: 'Resultado: ventas, costo de lo vendido, gastos y ganancia neta del período. Cargá ahí tus gastos y compras de mercadería.', ir: 'resultado' },
  { t: 'Cobrar con Mercado Pago', k: 'mercado pago tarjeta cobrar online link token', r: 'Ajustes → Integraciones → Mercado Pago: pegás tu Access Token. La plata va directo a tu cuenta y el pedido pasa solo a “cobrado” (plan Full API).', ir: 'ajustes' },
  { t: 'No me llega el email de confirmación', k: 'email mail confirmacion no llega spam contraseña olvide', r: 'Revisá spam y promociones. Si no aparece en unos minutos, escribinos a soporte.' },
  { t: 'Agregar mi propio dominio', k: 'dominio propio www marca url', r: 'Por ahora tu tienda está en el enlace de Escala. Consultanos por soporte si querés usar tu dominio.' }
];
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ');
const STOP = new Set('a al como con cual de del el en es la las lo los me mi mis no para por que se sin su sus te tu un una y o hay hago puedo quiero'.split(' '));
export function buscarAyuda(q) {
  const toks = norm(q).split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)); if (!toks.length) return [];
  return ARTS.map(a => { const hay = norm(a.t + ' ' + a.k + ' ' + a.k), tit = norm(a.t); let s = 0; toks.forEach(w => { const r = w.slice(0, Math.max(4, w.length - 2)); if (hay.includes(r)) s += 1; if (tit.includes(r)) s += 1; }); return { a, s }; })
    .filter(x => x.s >= Math.min(2, toks.length)).sort((x, y) => y.s - x.s).slice(0, 4).map(x => x.a);
}
const A = { q: '', abierto: null };
function soporteLink(q) {
  if (!MARCA.SOPORTE_WSP) return '';
  const t = P.t, txt = `Hola, necesito ayuda con ${MARCA.NOMBRE}.\nTienda: ${t.nombre} (${urlTiendaDe(t.slug)})\nPlan: ${PLAN_NOMBRE[planEf(t)] || t.plan}\nPantalla: ${P.tab}\nProblema: ${q || '(contame acá)'}\nDispositivo: ${navigator.userAgent.slice(0, 120)}`;
  return waLink(MARCA.SOPORTE_WSP, txt);
}
export function ayudaHtml() {
  const R = A.q.trim().length > 2 ? buscarAyuda(A.q) : null, base = R || ARTS.filter(a => a.ir === P.tab).concat(ARTS.slice(0, 3)).filter((a, i, l) => l.indexOf(a) === i).slice(0, 4);
  const sl = soporteLink(A.q);
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal ayuda" role="dialog" aria-modal="true" aria-label="Ayuda"><div class="view-title">💬 ¿En qué te ayudo?</div>
    <input class="fi" id="ay-q" placeholder="Escribí tu problema. Ej: no me lee el excel" value="${esc(A.q)}" data-input="ay-q" autocomplete="off" aria-label="Escribí tu problema">
    <div id="ay-res">${resultados(R, base, sl)}</div>
    <button class="btn btn-s" style="margin-top:10px" data-act="p-sugerir">💡 Sugerir una mejora</button>
    <button class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cerrar</button>
    ${marcas().oculta ? '<button class="linkb" style="margin-top:8px" data-act="g-mostrar">Volver a mostrar la guía de primeros pasos</button>' : ''}</div></div>`;
}
function resultados(R, base, sl) {
  const sin = R && !R.length;
  return `${sin ? '<p class="hint" style="margin:10px 0">No encontré una respuesta para eso.</p>' : `<p class="hint" style="margin:10px 0 6px">${R ? 'Esto puede ayudarte:' : 'Lo más consultado:'}</p>`}
    ${(sin ? [] : base).map((a, i) => `<details class="ay-art" ${R && i === 0 ? 'open' : ''}><summary>${esc(a.t)}</summary><p>${esc(a.r)}</p>${a.ir ? `<button class="btn btn-s btn-sm" data-act="ay-ir" data-k="${a.ir}" data-x="${a.imp ? 'importar' : ''}">Ir ahí →</button>` : ''}</details>`).join('')}
    <div class="ay-sop">${sl ? `<b>¿No se resolvió?</b><p class="hint">Mandanos tu problema por WhatsApp: ya va con los datos de tu tienda para que te respondamos más rápido.</p><a class="btn btn-wa" target="_blank" rel="noopener" href="${esc(sl)}">Escribir a soporte</a>` : `<p class="hint">¿No se resolvió? ${MARCA.EMAIL_CONTACTO ? 'Escribinos a ' + esc(MARCA.EMAIL_CONTACTO) + '.' : 'Pronto vas a poder escribirnos desde acá.'}</p>`}</div>`;
}
on('ay-q', (d, el) => { A.q = el.value; const r = $('#ay-res'); if (!r) return; const R = A.q.trim().length > 2 ? buscarAyuda(A.q) : null; r.innerHTML = resultados(R, R || ARTS.slice(0, 4), soporteLink(A.q)); });
on('ay-ir', d => { P.tab = d.k; if (d.x === 'importar') resetImp(); P.modal = d.x === 'importar' ? { tipo: 'imp' } : null; P.repintar(); window.scrollTo(0, 0); });
on('p-ayuda', () => { A.q = ''; P.modal = { tipo: 'ayuda' }; P.repintar(); setTimeout(() => { const i = $('#ay-q'); if (i) i.focus(); }, 50); });
on('g-mostrar', () => { mostrarGuia(); P.modal = null; P.repintar(); });
