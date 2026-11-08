// ✏️ DATOS COMERCIALES DE ESCALA (editá este archivo cuando quieras cambiar precios, soporte o datos legales).
// No tiene claves secretas. Las claves de Supabase siguen en config.js (ese no se toca).

export const MARCA = {
  NOMBRE: 'Escala.app',
  // WhatsApp de soporte con código de país, solo números (ej: 5491123456789). Vacío = no se muestra el botón.
  SOPORTE_WSP: '5491153162392',
  // Email de contacto que aparece en términos y privacidad. Vacío = se muestra "por WhatsApp de soporte".
  EMAIL_CONTACTO: 'contacto@elite-urbano.com',
  // Titular del servicio para los textos legales (nombre o razón social y CUIT). Completalo antes de cobrar.
  TITULAR: '[Nombre o razón social del titular]',
  CUIT: '[CUIT]',
  JURISDICCION: 'Ciudad Autónoma de Buenos Aires',
  FECHA_LEGALES: '8 de noviembre de 2026'
};

// Precios de lanzamiento en pesos por mes (los ves en la portada). Cambiá los números y listo.
export const PLANES = [
  { id: 'base', nombre: 'Catálogo Base', precio: 14900, para: 'Para empezar a vender por WhatsApp',
    incluye: ['Productos y pedidos ilimitados', 'Precios por volumen x1 · x3 · x6 · x12', 'Importador inteligente (fotos, chats, Excel, PDF, CSV)', 'Pedidos por etapas, remito y mensajes de WhatsApp', 'Envíos, “Cómo comprar” y diseño de tu tienda', 'Cobranzas: quién te debe y recordatorios', 'Resultado del negocio: ganancia neta y gastos', 'Catálogo en PDF'] },
  { id: 'pro', nombre: 'Mayorista Pro', precio: 29900, destacado: true, para: 'Para mayoristas y revendedores que crecen',
    incluye: ['Todo lo de Base', 'Minorista + mayorista con código de acceso', 'Dashboard interactivo completo', 'Reposición inteligente: días de stock y qué comprar', 'Ventas y ganancia en dólares', 'Stock automático y “¡Últimas unidades!”', 'Comparador de proveedores y precios de mercado', 'Revendedores con enlace y comisión', 'Carritos abandonados para recontactar'] },
  { id: 'api', nombre: 'Suite Full API', precio: 49900, para: 'Para automatizar y cobrar online',
    incluye: ['Todo lo de Pro', 'Mercado Pago en el carrito (la plata va directo a tu cuenta)', 'Aviso de pedido nuevo por email', 'Webhooks firmados para n8n, Make o tu CRM'] }
];

// Referencia para el simulador de costos: plan de una plataforma de tiendas líder que incluye listas de precios mayoristas.
// Fuente: su página pública de planes y precios (pago mensual) y su tabla de costos por transacción. Revisalo cada tanto.
export const REFERENCIA = { plan: 79999, pctVenta: 1, fecha: 'noviembre de 2026' };
