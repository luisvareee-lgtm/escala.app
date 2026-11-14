// Ayuda en cada campo: al tocar un campo del alta de la tienda, de Ajustes o de Envíos aparece debajo un recuadro
// que explica para qué sirve, con un ejemplo. Cada comercio lo activa o desactiva (se recuerda en este dispositivo).
// Solo actúa dentro de contenedores marcados con data-asistente="alta" | "ajustes" | "envios".
import { esc, fmt, on, store } from './util.js';

const CLAVE = 'escala:asistente';
export const asisOn = () => store.get(CLAVE, true) !== false;
export const asisSwitch = () => `<label class="asis-sw"><input type="checkbox" data-change="asis-on" ${asisOn() ? 'checked' : ''}> 💡 Ayuda en cada campo: qué poner y para qué sirve</label>`;

const precio = (usd, cot, m) => Math.ceil(usd * cot * (1 + m) / 10) * 10;
const num = v => { const n = Number(String(v || '').replace(',', '.')); return isFinite(n) ? n : 0; };
const margen = n => c => {
  const cot = num(c.val('cotizacion_usd')) || 1000, m = num(c.el.value) / 100;
  return `Un producto que te cuesta USD 10, con el dólar a ${fmt(cot)}, te cuesta ${fmt(10 * cot)}. Con ${Math.round(m * 100)}% lo vendés a ${fmt(precio(10, cot, m))}${n === 1 ? ' la unidad' : ` c/u llevando ${n} o más`}.`;
};

// t = título · d = explicación · ej = ejemplo (texto o función que recibe el contexto del formulario)
const AYUDA = {
  // --- alta de la tienda ---
  'alta:nombre': { t: 'Nombre del negocio', d: 'Es lo que ven tus clientes arriba de la tienda y en el ticket que te llega por WhatsApp. Lo podés cambiar cuando quieras en Tienda → Estilo.', ej: 'Bazar Luna · Perfumería Central' },
  'alta:slug': { t: 'Tu enlace', d: 'Es la dirección de tu tienda, la que vas a compartir en Instagram, en tus Estados y por WhatsApp. Se arma sola con el nombre: minúsculas, sin espacios ni acentos. Cuanto más corto, mejor.', ej: '/t/bazar-luna' },
  'alta:whatsapp': { t: 'WhatsApp donde recibís pedidos', d: 'Cuando un cliente confirma la compra, se le abre WhatsApp con el pedido listo para mandártelo a este número. Poné el código de área sin el 0 y el número sin el 15.', ej: '11 2345-6789 (AMBA) · 351 555-1234 (Córdoba)' },
  'alta:rubro': { t: 'Rubro', d: 'Sirve para cargarte 4 productos de ejemplo y que veas enseguida cómo queda la tienda. Después los borrás o los reemplazás importando tu lista.' },
  modalidad: { t: '¿Cómo vendés?', d: '<b>Minorista:</b> un precio por unidad, para el público. <b>Mayorista:</b> precios por cantidad (x1 · x3 · x6 · x12) para revendedores. <b>Híbrido:</b> el público ve el precio minorista y tus revendedores entran con el botón “Acceso Mayorista” (con código, si querés).', ej: 'Si vendés por Instagram al público y también a revendedoras, elegí Híbrido.' },
  modo_stock: { t: 'Cómo trabajás con la mercadería', d: '<b>Tengo stock:</b> vendés lo que tenés. <b>Por encargo:</b> juntás los pedidos y después le comprás al proveedor; el cliente ve “llega en N días”. <b>Las dos:</b> marcás producto por producto cuáles son por encargo.' },
  // --- Ajustes · Datos y precios ---
  'ajustes:whatsapp': { t: 'WhatsApp de pedidos', d: 'El número al que te llegan los pedidos y los avisos. Va con el código de país y el 9 adelante, sin espacios ni guiones.', ej: '5491123456789' },
  demora_encargo: { t: 'Demora de los productos por encargo', d: 'Cuántos días tarda en llegar un producto por encargo desde que se confirma el pedido. El cliente lo ve antes de comprar: “por encargo · llega en N días”.', ej: '7 si tu proveedor entrega en una semana.' },
  cotizacion_usd: { t: 'Cotización del dólar', d: 'Los costos se guardan en dólares y con este número se pasan a pesos. Si el dólar se mueve, cambiás solo esto y todo el catálogo se actualiza de una.', ej: c => { const cot = num(c.el.value) || 1000; return `Un costo de USD 10 con el dólar a ${fmt(cot)} = ${fmt(10 * cot)} de costo en pesos.`; } },
  m1: { t: 'Margen x1 (precio por unidad)', d: 'Lo que le sumás al costo cuando llevan 1 o 2 unidades. En la modalidad Minorista es el único margen que se usa.', ej: margen(1) },
  m3: { t: 'Margen x3', d: 'Precio por cantidad desde 3 unidades. Tiene que ser igual o menor que el de x1.', ej: margen(3) },
  m6: { t: 'Margen x6', d: 'Precio por cantidad desde 6 unidades. Igual o menor que el de x3.', ej: margen(6) },
  m12: { t: 'Margen x12 o más', d: 'Tu mejor precio, desde 12 unidades. Igual o menor que el de x6.', ej: margen(12) },
  escala_grupo: { t: 'Cómo se suman las unidades para x3 · x6 · x12', d: '<b>Por producto:</b> cada producto cuenta por separado (3 del mismo = precio x3). <b>Por categoría:</b> se suman los productos de la misma categoría. <b>Todo el carrito:</b> se suma cualquier producto. Sumar facilita llegar al descuento y suele subir el ticket. El stock se sigue controlando producto por producto y los de precio único no suman.', ej: 'Por categoría: 2 sérums + 4 cremas de “Cuidado facial” = 6 unidades → los 6 pasan al precio x6.' },
  margen_piso: { t: 'Margen mínimo', d: 'Un piso de seguridad: cuando el sistema te sugiere bajar un precio para competir (referencias de mercado) o un producto tiene su margen propio, nunca baja de este porcentaje sobre el costo.', ej: 'Con 10%, un producto que te cuesta $10.000 nunca se sugiere por debajo de $11.000.' },
  compra_minima: { t: 'Compra mínima mayorista', d: 'El monto mínimo para comprar con precios mayoristas. Si el carrito no llega, el botón de continuar se bloquea y le dice cuánto le falta. No afecta a las compras minoristas. 0 = sin mínimo.', ej: '50000' },
  gastos_fijos: { t: 'Gastos fijos del mes', d: 'Lo que pagás todos los meses sí o sí: alquiler, internet, publicidad, sueldos. Se usa en “Resultado” para calcular cuánto tenés que vender para no perder. No lo ve nadie más.' },
  alias_cobro: { t: 'Alias / CBU', d: 'Aparece en el ticket cuando el cliente elige pagar por transferencia. Si lo dejás vacío, el ticket dice “pasámelo por acá” y se lo mandás vos por WhatsApp.', ej: 'bazar.luna.mp' },
  pixel_id: { t: 'Meta Pixel', d: 'El número de tu píxel de Meta (Facebook / Instagram) para medir las visitas y compras que vienen de tus anuncios. Si no hacés publicidad paga, dejalo vacío.', ej: 'Lo encontrás en el Administrador de eventos de Meta (15 o 16 números).' },
  webhook_url: { t: 'Webhook', d: 'Para conectar tu tienda con otras herramientas (n8n, Make, un CRM): cada pedido nuevo se envía a esta dirección. Si no sabés qué es, dejalo vacío; no hace falta para vender.' },
  codigo: { t: 'Código de revendedor', d: 'En la modalidad Híbrido, tus revendedores lo ingresan para ver la lista mayorista. Sin código, cualquiera entra con un clic. Compartilo solo con quienes te compran para revender.', ej: 'LUNA2026 (mínimo 6 letras o números)' },
  // --- Tienda · Envíos y entregas ---
  'en-n': { t: 'Nombre de la entrega', d: 'Cómo la ve tu cliente al confirmar el pedido. Que se entienda dónde y cómo recibe.', ej: 'Retiro en el local · Moto zona sur · Correo a sucursal' },
  'en-t': { t: 'Tipo de entrega', d: '<b>Retiro:</b> no pide dirección ni suma envío. <b>Envío, moto o correo:</b> pide la dirección y suma el costo. <b>A coordinar:</b> la dirección es opcional y el costo lo arreglan por WhatsApp.' },
  'en-c': { t: 'Costo del envío', d: 'Se suma solo al total del pedido; el comprador no lo puede cambiar. En correo o “a coordinar” podés dejar 0 y cotizarlo aparte.', ej: '1500' },
  'en-d': { t: 'Detalle', d: 'Lo que el cliente ve debajo del nombre: zonas, días, horarios o demora.', ej: 'Lunes a viernes de 10 a 18 · a todo el país en 3 a 6 días' },
  'dc-': { t: 'Datos que le pedís al cliente', d: 'Además de nombre y WhatsApp. <b>Obligatorio:</b> no puede confirmar sin completarlo. <b>Opcional:</b> puede dejarlo vacío. <b>No pedir:</b> no aparece.', ej: 'DNI y código postal obligatorios si despachás por correo.' },
  'en-pago': { t: 'Medios de pago', d: 'Los que tildes son los que tu cliente puede elegir al confirmar el pedido. Apagá los que no aceptás para que nadie elija uno que no te sirve. Tiene que quedar al menos uno.', ej: 'Si solo cobrás por transferencia, dejá tildada solo “Transferencia bancaria”.' },
  'en-gr': { t: 'Envío gratis desde', d: 'A partir de este total, el envío no se cobra (el retiro siempre es sin cargo). Sirve para que sumen productos. 0 = nunca.', ej: '60000' },
  'en-av': { t: '¡Últimas unidades!', d: 'Cuando el stock de un producto baja a este número, la tarjeta muestra “¡Últimas N!”. Genera urgencia sin mentir. 0 = no mostrar.', ej: '3' },
  'en-rev': { t: 'Mostrar “Tu ganancia”', d: 'En la lista mayorista, cada producto le muestra a tu revendedor a cuánto lo puede vender y cuánto gana. Ayuda a que se anime a llevar más.' },
  'en-revm': { t: 'Recargo sugerido para la reventa', d: 'El porcentaje que se suma a tu precio x1 para calcular el “Vendelo a $…”. Si un producto tiene su precio sugerido cargado, se usa ese.', ej: '60' },
  // --- Importar · Traer desde la web del proveedor (v2.18) ---
  'w-url': { t: 'Enlace de la web del proveedor', d: 'La dirección de la tienda online de tu proveedor, copiada del navegador. Puede ser la portada, la sección “Productos” o una categoría (así traés solo esa). Tiene que ser una página pública: si para ver precios hay que iniciar sesión, no se puede leer y conviene pedirle la lista en Excel o PDF.', ej: 'https://tuproveedor.com.ar/productos/maquillaje' },
  'w-fotos': { t: 'Qué hacemos con las fotos', d: '<b>Copiarlas a mi tienda:</b> se guardan en tu tienda, más livianas, y no se rompen si el proveedor las cambia (recomendado). <b>Usar el enlace del proveedor:</b> es más rápido, pero si él borra o cambia la foto, tu producto queda sin foto. <b>Sin fotos:</b> solo nombre, costo y categoría.' },
  'w-limpiar': { t: 'Nombres ordenados', d: 'Sacamos el código del proveedor del nombre (queda guardado como Código / SKU, así la próxima vez que leas su web se actualizan los costos solos), pasamos a minúscula lo que viene todo en MAYÚSCULAS, ponemos las tildes más comunes y escribimos bien las medidas.', ej: '“SD01454 SERUM ACIDO HIALURONICO 30ML” → “Sérum ácido hialurónico 30 ml” (código SD01454)' },
  'w-desc': { t: 'Descripciones', d: 'Traemos el texto de cada producto y le sacamos lo que es del proveedor: teléfonos, enlaces, precios, redes y condiciones de venta. Tarda más porque hay que abrir cada producto de a uno (unos minutos en catálogos grandes).' },
  'w-agot': { t: 'Agotados del proveedor', d: 'Si el proveedor marca un producto sin stock, en tu tienda queda agotado (stock 0) y nadie te lo pide. A los demás no les tocamos el stock.' },
  'w-acepto': { t: 'Permiso del proveedor', d: 'Las fotos y los textos de una web tienen dueño (Ley 11.723). Usalos solo si sos cliente o revendedor y el proveedor está de acuerdo: pedíselo por escrito, un WhatsApp alcanza. Queda registrado que lo aceptaste y qué sitio leíste.' },
  'p-wurl': { t: 'Foto y descripción desde un enlace', d: 'Pegá el enlace de la página del producto en la web oficial de la marca o en la de tu proveedor, o el enlace directo de una foto. Traemos la foto (achicada) y, si el campo está vacío, la descripción y la marca. Usá fotos ajenas solo con permiso.', ej: 'https://marca.com.ar/producto/serum-hialuronico-30ml' }
};

// qué ayuda corresponde al campo: por nombre, por id (sin el número de fila) o por su acción
function claveDe(el) {
  if (el.dataset && el.dataset.asis) return el.dataset.asis;
  if (el.name) return el.name;
  const id = (el.id || '').replace(/\d+$/, '');
  if (/^dc-/.test(id)) return 'dc-';
  return id || (el.dataset && (el.dataset.change || el.dataset.input)) || '';
}
function ayudaDe(el, zona) { const k = claveDe(el); return k ? AYUDA[zona + ':' + k] || AYUDA[k] || null : null; }
// dónde va el recuadro: debajo de la fila (para no romper las grillas de 2 columnas) o del campo
// (nunca adentro de un <label>: en las listas de casillas va debajo de la lista entera)
const anclaDe = el => el.closest('.row2, .dc-grid, .pg-list') || el.closest('.fg') || el.closest('label') || el;

let caja = null;
export function quitarAsistente() { if (caja) { caja.remove(); caja = null; } }
function mostrar(el, zona) {
  const a = ayudaDe(el, zona); if (!a) return quitarAsistente();
  const cont = el.closest('[data-asistente]');
  const c = { el, val: n => { const f = cont.querySelector(`[name="${n}"]`); return f ? f.value : ''; } };
  let ej = '';
  try { ej = String((typeof a.ej === 'function' ? a.ej(c) : a.ej) || ''); } catch (e) { ej = ''; }
  const html = `<div class="asis-h"><b>💡 ${esc(a.t)}</b><button type="button" class="asis-x" data-act="asis-off" aria-label="Apagar la ayuda en cada campo">No mostrar más</button></div><p>${a.d}</p>${ej ? `<p class="asis-ej"><span>Ejemplo:</span> ${esc(ej)}</p>` : ''}`;
  const ancla = anclaDe(el);
  if (!caja || !caja.isConnected) { caja = document.createElement('div'); caja.className = 'asis'; caja.setAttribute('role', 'note'); caja.setAttribute('aria-live', 'polite'); }
  if (caja.previousElementSibling !== ancla) ancla.after(caja);
  caja.innerHTML = html;
}
// El recuadro se mueve recién cuando termina el toque o el clic: si se moviera en el mismo momento, lo que está
// debajo saltaría y el clic caería en otro lado (por ejemplo, en "Guardar"). Además el campo tocado queda quieto en pantalla.
let pend = null, apretado = false;
function programar(fn, el) {
  const tarea = () => {
    if (pend !== tarea) return; pend = null;
    const y0 = el && el.isConnected ? el.getBoundingClientRect().top : null;
    fn();
    if (y0 !== null && el.isConnected) { const d = el.getBoundingClientRect().top - y0; if (Math.abs(d) > 1) window.scrollBy(0, d); }
  };
  pend = tarea;
  if (!apretado) setTimeout(tarea, 0);
}
const soltar = () => { apretado = false; if (pend) setTimeout(pend, 0); };
document.addEventListener('pointerdown', () => { apretado = true; }, true);
document.addEventListener('pointerup', soltar, true);
document.addEventListener('pointercancel', soltar, true);
document.addEventListener('keydown', () => { apretado = false; }, true);   // por si un clic quedó sin soltar
document.addEventListener('focusin', e => {
  const el = e.target;
  if (!el || !el.closest) return;
  if (el.closest('.asis') || el.matches('[data-change="asis-on"]')) return;   // el propio recuadro o el interruptor
  const cont = el.closest('[data-asistente]');
  if (!cont || !asisOn()) { if (caja) programar(quitarAsistente, null); return; }
  if (!el.matches('input, select, textarea')) return;    // botones: el recuadro queda donde está
  const zona = cont.dataset.asistente;
  programar(() => { if (el.isConnected && asisOn()) mostrar(el, zona); }, el);
});
const sincronizar = v => document.querySelectorAll('[data-change="asis-on"]').forEach(x => { x.checked = v; });
on('asis-on', (d, el) => { store.set(CLAVE, !!el.checked); sincronizar(!!el.checked); if (!el.checked) quitarAsistente(); });
on('asis-off', () => { store.set(CLAVE, false); sincronizar(false); quitarAsistente(); });
