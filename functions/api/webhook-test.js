// El comerciante (con sesión iniciada) manda un evento de prueba firmado a su propio webhook.
import { json, rpc, usuarioDeToken, mismoOrigen, enviarWebhook } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  if (!mismoOrigen(request, env)) return json({ error: 'Origen no permitido' }, 403);
  const uid = await usuarioDeToken(env, request);
  if (!uid) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
  const t = await rpc(env, 'svc_tenant_por_owner', { p_owner: uid }).catch(() => null);
  if (!t) return json({ error: 'No tenés una tienda.' }, 404);
  if (!t.plan_ok) return json({ error: 'Los webhooks están disponibles en el plan Full API.' }, 403);
  if (!t.webhook_url) return json({ error: 'Primero guardá la URL del webhook.' }, 400);
  const r = await enviarWebhook(t.webhook_url, t.secret, 'prueba', {
    evento: 'prueba', mensaje: 'Si ves esto, tu webhook de Escala.app funciona.', tienda: { slug: t.slug, nombre: t.nombre },
    pedido_de_ejemplo: { numero: 0, total: 12345, moneda: 'ARS', items: [{ nombre: 'Producto de ejemplo', cantidad: 2, precio_unitario: 6000, subtotal: 12000 }] },
  }, crypto.randomUUID());
  await rpc(env, 'svc_evento', { p_tenant: t.id, p_tipo: r.ok ? 'webhook_prueba_ok' : 'webhook_prueba_error', p_detalle: { status: r.status || null, error: r.error || null } }).catch(() => { });
  return json({ ok: r.ok, status: r.status || null, error: r.error || null });
}
