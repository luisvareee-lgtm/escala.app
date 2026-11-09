// Tienda pública: /t/<tienda> muestra la app SIN cambiar la dirección (para que sepa qué tienda abrir)
// y con la vista previa de ESA tienda (nombre, frase y logo) cuando se comparte el enlace por WhatsApp.
import { pagina, datosTienda } from '../_pagina.js';

export async function onRequestGet({ request, env, params }) {
  const slug = String(Array.isArray(params.tienda) ? params.tienda[0] : params.tienda || '').toLowerCase();
  const t = await datosTienda(request, env, slug);
  return pagina(request, env, t ? {
    title: `${t.nombre} · Tienda online`,
    description: t.eslogan ? `${t.eslogan} · Mirá el catálogo y hacé tu pedido por WhatsApp.` : `Mirá el catálogo de ${t.nombre} y hacé tu pedido por WhatsApp.`,
    image: t.logo_url
  } : {});
}
