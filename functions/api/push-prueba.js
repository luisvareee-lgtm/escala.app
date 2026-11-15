// Aviso de prueba a los celulares del comercio que lo pide (para ver que llega).
import { json, rpc, usuarioDeToken, mismoOrigen, sitio } from '../_lib.js';
import { avisarTodos } from '../_push.js';

export async function onRequestPost({ request, env }) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Falta configurar el servidor (variables de Supabase en Cloudflare).' }, 503);
  if (!mismoOrigen(request, env)) return json({ error: 'No autorizado' }, 403);
  const uid = await usuarioDeToken(env, request);
  if (!uid) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
  let d; try { d = await rpc(env, 'svc_push_de_usuario', { p_user: uid }); } catch (e) { return json({ error: 'Falta actualizar la base: corré la migración v2.23 en Supabase.' }, 500); }
  if (!d || !d.subs || !d.subs.length) return json({ ok: false, error: 'Este usuario no tiene avisos activados en ningún dispositivo.' }, 400);
  const r = await avisarTodos(env, d.subs, { title: '🔔 Así te llegan los pedidos', body: `Aviso de prueba de ${String(d.nombre || 'tu tienda').slice(0, 60)}. Cuando entre un pedido vas a ver el total y el cliente.`, url: '/app#/panel?tab=pedidos', tag: 'prueba' }, sitio(request, env));
  return json({ ok: r.some(x => x.ok), enviados: r.filter(x => x.ok).length, total: r.length });
}
