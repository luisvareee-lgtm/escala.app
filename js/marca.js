// DATOS COMERCIALES DE LA PLATAFORMA (Eskalapp) — valores de fábrica.
// ⚠️ NO edites este archivo: se reemplaza en cada actualización.
// Tus datos (WhatsApp de soporte, titular, CUIT, dominio, precios, links de pago) van en  js/config.js,
// dentro de  window.CONFIG_MARCA = { ... }.  Ese archivo nunca se reemplaza, así que no se pierden. Ejemplo:
//
//   window.CONFIG_MARCA = {
//     SOPORTE_WSP: '5491123456789',
//     TITULAR: 'Tu nombre o razón social', CUIT: '20-12345678-9',
//     DOMINIO: 'tumarca.com.ar',
//     PLANES: { base: { link: 'https://...' }, pro: { mp_plan_id: '2c93...' }, api: { precio: 49900 } }
//   };
import * as cfg from './config.js';   // se carga antes para que window.CONFIG_MARCA ya exista

const MARCA_BASE = {
  NOMBRE: 'Eskalapp',
  // Tu dominio (sin https ni www), ej: 'tumarca.com.ar'. Con esto cada tienda queda en  nombre-de-la-tienda.tumarca.com.ar
  // Vacío = las tiendas siguen en  tu-sitio/t/nombre-de-la-tienda. Primero hacé los pasos de SUBDOMINIOS.md.
  DOMINIO: '',
  // Enlace a una tienda de ejemplo para mostrar en la portada (ej: 'https://demo.tumarca.com.ar/'). Vacío = no se muestra.
  DEMO_URL: '',
  // WhatsApp de soporte con código de país, solo números (ej: 5491123456789). Vacío = no se muestra el botón.
  SOPORTE_WSP: '',
  // Testimonios reales para la portada (hasta 3). Sin ninguno, la sección no aparece. Ej:
  //   TESTIMONIOS: [{ nombre: 'Lucía', rubro: 'Mayorista de cosmética · Once', texto: 'Dejé de mandar el PDF…', url: 'https://…/t/mi-tienda' }]
  TESTIMONIOS: [],
  // Email de contacto que aparece en términos y privacidad. Vacío = se muestra "por WhatsApp de soporte".
  EMAIL_CONTACTO: '',
  // Titular del servicio para los textos legales (nombre o razón social y CUIT). Completalo antes de cobrar.
  TITULAR: '[Nombre o razón social del titular]',
  CUIT: '[CUIT]',
  JURISDICCION: 'Ciudad Autónoma de Buenos Aires',
  // Cobro de los planes por transferencia (v2.23). Si cargás el alias o el CBU/CVU, en “Elegí tu plan” aparece
  // “Pagar por transferencia” con tus datos y el botón para mandarte el comprobante por WhatsApp.
  PAGO_ALIAS: '',
  PAGO_CBU: '',
  PAGO_BANCO: '',
  PAGO_TITULAR: '',   // vacío = usa TITULAR
  // Pago anual: cuántos meses se cobran por 12 (10 = dos meses gratis). 0 = no ofrecer pago anual.
  ANUAL_MESES: 10,
  FECHA_LEGALES: '8 de noviembre de 2026'
};

// Precios de lanzamiento en pesos por mes (los ves en la portada y en el panel). Cambiá los números y listo.
// link o mp_plan_id (opcionales, se cargan en config.js): enlace de suscripción de Mercado Pago de ese plan, o el id del
// plan de suscripción (preapproval_plan_id). Si no hay ninguno, “Quiero este plan” abre tu WhatsApp de soporte con el pedido armado.
// v2.33: tres planes. Los ids (base, pro, api) no cambian: base es el plan Gratis.
// Un ítem que termina en " · Próximamente" se muestra con esa etiqueta.
const PLANES_BASE = [
  { id: 'base', link: '', nombre: 'Gratis', precio: 0, badge: 'Para siempre', para: 'Para empezar a vender por WhatsApp, sin pagar',
    incluye: ['Hasta 100 productos publicados', '1 precio por producto (sin escalas x3 · x6 · x12)', 'Carga rápida desde Excel o CSV', 'Pedidos por WhatsApp, 0% comisión', 'Señas y saldo en cada pedido', 'Ayuda con IA adentro del panel', '3 flyers de prueba por mes', 'Estadísticas básicas en vivo (visitas y productos más vistos)', 'Firma discreta “Creado gratis con Eskalapp” en el pie de la tienda'] },
  { id: 'pro', link: '', nombre: 'Mayorista Pro', precio: 29900, destacado: true, badge: 'Recomendado', para: 'Para escalar tus ventas sin tope de productos',
    incluye: ['Productos y pedidos ilimitados', 'Precios por volumen x1 · x3 · x6 · x12 (con los nombres que quieras)', 'Importador inteligente (fotos, chats de WhatsApp, PDF, Excel y CSV)', 'Minorista + mayorista con código de acceso (modo híbrido)', 'Tienda en dólares o USDT: tus precios en US$ con tu cotización y cobro por transferencia en dólares o USDT', 'Presupuestos por WhatsApp, caja diaria (efectivo y transferencia) y pedidos por etapas', 'Dashboard completo: ganancia real, cobranzas, reposición inteligente, ventas en dólares y stock automático', 'Estadísticas completas (origen de visitas y embudo) + Meta Pixel y Google Analytics 4', 'Flyers ilimitados, catálogo PDF para revendedores y sin marca Eskalapp'] },
  { id: 'api', link: '', nombre: 'Mayorista IA', precio: 49900, para: 'Para importadores, equipos y automatización total',
    incluye: ['Todo lo de Mayorista Pro', 'Tu equipo: hasta 5 usuarios con roles (Ventas, Depósito y Administración); cada uno ve solo lo suyo', 'Auditor Comercial 24/7: detecta productos muy vistos que no venden, márgenes bajos, stock parado y lo que se agota, con resumen al celular los lunes', 'Fichas comerciales con IA en 1 clic: la descripción de cada producto, en criollo y sin inventar datos', 'Flyers con fondo IA y Shorts 9:16 para Estados y Grupos · Próximamente', 'Dominio propio (tutienda.com.ar) · Próximamente', 'Mercado Pago en el carrito (la plata va directo a tu cuenta), aviso por email y webhooks firmados (n8n, Make o CRM)'] }
];
// Ítem de plan en HTML (escapado), con la etiqueta "Próximamente" si corresponde.
export const itemPlan = (txt, esc) => { const m = /^(.*) · Próximamente$/.exec(txt); return m ? `${esc(m[1])} <span class="tag prox">Próximamente</span>` : esc(txt); };

// Referencia para el simulador de costos: plan de una plataforma de tiendas líder que incluye listas de precios mayoristas.
// Fuente: su página pública de planes y precios (pago mensual) y su tabla de costos por transacción. Revisalo cada tanto.
// catalogo (v2.32): planes publicados de una app de catálogo con pedidos por WhatsApp (su plan inicial y el siguiente).
const REFERENCIA_BASE = { plan: 79999, pctVenta: 1, fecha: 'noviembre de 2026',
  catalogo: { precio: 20000, productos: 35, precio2: 35000, productos2: 150 } };

// ---- Fusión con tus datos (config.js). Lo tuyo siempre gana; lo que no definas queda con el valor de fábrica. ----
const esObj = v => v && typeof v === 'object' && !Array.isArray(v);
export function fusionar(base, extra) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!esObj(extra)) return out;
  for (const k of Object.keys(extra)) {
    const v = extra[k]; if (v === undefined || v === null || v === '') continue;   // vacío = usar el valor de fábrica
    out[k] = esObj(v) && esObj(out[k]) ? fusionar(out[k], v) : v;
  }
  return out;
}
function propios() {
  let o = {};
  try { for (const x of [cfg.CONFIG_MARCA, cfg.CONFIG && cfg.CONFIG.MARCA_DATOS, typeof window !== 'undefined' && window.CONFIG_MARCA, typeof window !== 'undefined' && window.MARCA_OVERRIDE]) if (esObj(x)) o = fusionar(o, x); } catch (e) { }
  return o;
}
const PROPIO = propios();
const { PLANES: _pl, REFERENCIA: _ref, ...datosMarca } = PROPIO;
export const MARCA = fusionar(MARCA_BASE, datosMarca);
// PLANES en config.js: por id  { pro: { precio, link, mp_plan_id, nombre, para } }  o lista  [{ id: 'pro', ... }]
const porId = x => Array.isArray(x) ? Object.fromEntries(x.filter(p => p && p.id).map(p => [p.id, p])) : esObj(x) ? x : {};
const linkMp = id => /^[a-zA-Z0-9]{8,64}$/.test(String(id || '')) ? 'https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=' + id : '';
export const PLANES = PLANES_BASE.map(p => {
  const m = fusionar(p, porId(_pl)[p.id]);
  m.id = p.id; m.precio = Number(m.precio) > 0 ? Number(m.precio) : p.precio;
  m.link = /^https:\/\//.test(String(m.link || '')) ? m.link : linkMp(m.mp_plan_id);   // link directo, o se arma con el id del plan de suscripción
  // base es el plan Gratis: siempre $0, sin cobro ni suscripción, aunque config.js tenga un precio o un enlace viejo de "Base".
  if (p.id === 'base') { m.precio = 0; m.link = ''; m.mp_plan_id = ''; m.nombre = p.nombre; m.para = p.para; m.incluye = p.incluye; m.badge = p.badge; }
  if (p.id === 'api' && /automatizaci/i.test(String(m.nombre))) m.nombre = p.nombre;   // nombre viejo en config.js
  m.auto = !!m.link;
  return m;
});
export const REFERENCIA = fusionar(REFERENCIA_BASE, _ref);

// Subdominios que nunca son tiendas.
export const RESERVADOS = ['admin', 'api', 'app', 'www', 'demo', 'login', 'registro', 'soporte', 'panel', 'escala', 'static', 'assets', 'mail', 'ayuda', 'blog'];
// Enlace público de una tienda (con subdominio si está configurado). extra: '?r=token', etc.
export const urlTiendaDe = (slug, extra = '') => MARCA.DOMINIO ? `https://${slug}.${MARCA.DOMINIO}/${extra}` : `${location.origin}/t/${slug}${extra}`;
// Si la página se abrió desde  slug.tu-dominio, devuelve el slug.
export function slugDeHost(host = location.hostname) {
  const d = String(MARCA.DOMINIO || '').toLowerCase().replace(/^www\./, ''); if (!d) return null;
  host = String(host || '').toLowerCase(); if (!host.endsWith('.' + d)) return null;
  const sub = host.slice(0, -d.length - 1);
  return /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(sub) && !RESERVADOS.includes(sub) ? sub : null;
}
