// DATOS COMERCIALES DE ESCALA — valores de fábrica.
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
  NOMBRE: 'Escala.app',
  // Tu dominio (sin https ni www), ej: 'tumarca.com.ar'. Con esto cada tienda queda en  nombre-de-la-tienda.tumarca.com.ar
  // Vacío = las tiendas siguen en  tu-sitio/t/nombre-de-la-tienda. Primero hacé los pasos de SUBDOMINIOS.md.
  DOMINIO: '',
  // Enlace a una tienda de ejemplo para mostrar en la portada (ej: 'https://demo.tumarca.com.ar/'). Vacío = no se muestra.
  DEMO_URL: '',
  // WhatsApp de soporte con código de país, solo números (ej: 5491123456789). Vacío = no se muestra el botón.
  SOPORTE_WSP: '',
  // Email de contacto que aparece en términos y privacidad. Vacío = se muestra "por WhatsApp de soporte".
  EMAIL_CONTACTO: '',
  // Titular del servicio para los textos legales (nombre o razón social y CUIT). Completalo antes de cobrar.
  TITULAR: '[Nombre o razón social del titular]',
  CUIT: '[CUIT]',
  JURISDICCION: 'Ciudad Autónoma de Buenos Aires',
  FECHA_LEGALES: '8 de noviembre de 2026'
};

// Precios de lanzamiento en pesos por mes (los ves en la portada y en el panel). Cambiá los números y listo.
// link o mp_plan_id (opcionales, se cargan en config.js): enlace de suscripción de Mercado Pago de ese plan, o el id del
// plan de suscripción (preapproval_plan_id). Si no hay ninguno, “Quiero este plan” abre tu WhatsApp de soporte con el pedido armado.
const PLANES_BASE = [
  { id: 'base', link: '', nombre: 'Catálogo Base', precio: 9900, para: 'Para empezar a vender por WhatsApp',
    incluye: ['Productos y pedidos ilimitados', 'Precios por volumen x1 · x3 · x6 · x12', 'Importador inteligente (fotos, chats, Excel, PDF, CSV)', 'Pedidos por etapas, remito y mensajes de WhatsApp', 'Envíos, “Cómo comprar” y diseño de tu tienda', 'Flyers para Estados de WhatsApp e Instagram (tuyos y de tus revendedores)', 'Cobranzas: quién te debe y recordatorios', 'Resultado del negocio: ganancia neta y gastos', 'Catálogo en PDF'] },
  { id: 'pro', link: '', nombre: 'Mayorista Pro', precio: 29900, destacado: true, para: 'Para mayoristas y revendedores que crecen',
    incluye: ['Todo lo de Base', 'Minorista + mayorista con código de acceso', 'Dashboard interactivo completo', 'Reposición inteligente: días de stock y qué comprar', 'Ventas y ganancia en dólares', 'Stock automático y “¡Últimas unidades!”', 'Comparador de proveedores y precios de mercado', 'Revendedores con enlace y comisión', 'Carritos abandonados para recontactar'] },
  { id: 'api', link: '', nombre: 'Suite Full API', precio: 49900, para: 'Para automatizar y cobrar online',
    incluye: ['Todo lo de Pro', 'Mercado Pago en el carrito (la plata va directo a tu cuenta)', 'Aviso de pedido nuevo por email', 'Webhooks firmados para n8n, Make o tu CRM'] }
];

// Referencia para el simulador de costos: plan de una plataforma de tiendas líder que incluye listas de precios mayoristas.
// Fuente: su página pública de planes y precios (pago mensual) y su tabla de costos por transacción. Revisalo cada tanto.
const REFERENCIA_BASE = { plan: 79999, pctVenta: 1, fecha: 'noviembre de 2026' };

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
