// v2.37 · Foto publicitaria con IA para el flyer y los Shorts (plan Mayorista IA): Nano Banana arma la escena con la foto
// real del producto, en el estilo y la estética que eligió el comercio. El panel pone después el precio, el logo y el enlace.
// Hasta 15 por día por tienda (cada imagen tiene costo). No recibe datos de clientes: solo la foto del producto y el pedido.
import { json, rpc, usuarioDeToken, mismoOrigen } from '../_lib.js';
import { limpio, hayGemini, imagenGemini } from '../_ia.js';

const MAX_FOTO = 2_800_000;   // ~2 MB de imagen en base64 (el panel la manda achicada a 1024 px)
export const REGLAS = 'Reglas: la imagen es para publicidad de un comercio. Mantené el producto de la foto exactamente igual (forma, colores, etiqueta y textos del envase). No agregues textos, letras, precios, logos, marcas ni marcas de agua. Sin personas reconocibles ni contenido para adultos. Formato vertical 9:16.';

export async function onRequestPost({ request, env }) {
  try {
    if (!mismoOrigen(request, env)) return json({ error: 'Origen no permitido' }, 403);
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ ok: false, error: 'Falta configurar el servidor.' });
    if (!hayGemini(env)) return json({ sinIA: true, error: 'La foto con IA todavía no está activada.' }, 503);
    const uid = await usuarioDeToken(env, request).catch(() => null);
    if (!uid) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
    const b = await request.json().catch(() => ({}));
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.foto || ''));
    if (!m) return json({ error: 'Falta la foto del producto.' }, 400);
    if (m[2].length > MAX_FOTO) return json({ error: 'La foto es muy pesada. Probá con otra.' }, 413);
    const pedido = String(b.prompt || '').replace(/\s+/g, ' ').trim().slice(0, 2500);
    if (pedido.length < 20) return json({ error: 'Falta el estilo de la foto.' }, 400);
    try { await rpc(env, 'svc_flyer_ia', { p_uid: uid }); }
    catch (e) { const msg = e.message || 'No se pudo verificar tu cuenta.'; return json({ error: msg }, /plan/i.test(msg) ? 403 : /máximo/i.test(msg) ? 429 : 400); }
    let img;
    try { img = await imagenGemini(env, pedido + '\n\n' + REGLAS, { tipo: m[1], datos: m[2] }); }
    catch (e) { console.error('flyer-ia:', e && e.message); return json({ ok: false, error: 'La IA no pudo crear la foto ahora. Probá de nuevo en un rato.', detalle: limpio(e && e.message) }); }
    return json({ ok: true, imagen: `data:${img.tipo};base64,${img.datos}`, modelo: img.modelo });
  } catch (e) {
    console.error('flyer-ia fatal:', (e && e.stack) || e);
    return json({ ok: false, error: 'La foto con IA no está disponible ahora.', detalle: limpio(e && e.message) });
  }
}
