// Clave pública para activar los avisos de pedidos en un celular (la privada nunca sale del servidor).
// La primera vez también deja configurado el aviso automático de pedidos nuevos (dirección y clave interna).
import { json, rpc, usuarioDeToken, mismoOrigen, sitio } from '../_lib.js';
import { clavesVapid } from '../_push.js';

export async function onRequestGet({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Falta configurar el servidor (variables de Supabase en Cloudflare).' }, 503);
  if (request.headers.get('origin') && !mismoOrigen(request, env)) return json({ error: 'No autorizado' }, 403);
  const uid = await usuarioDeToken(env, request);
  if (!uid) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
  try {
    await rpc(env, 'svc_fn_config', { p_url: sitio(request, env) }).catch(() => null);
    const v = await clavesVapid(env);
    return json({ ok: true, pub: v.pub });
  } catch (e) {
    return json({ error: /svc_vapid|function|schema cache/i.test(e.message) ? 'Falta actualizar la base: corré la migración v2.23 en Supabase.' : e.message }, 500);
  }
}
