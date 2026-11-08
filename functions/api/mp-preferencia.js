// Crea el link de pago de Mercado Pago de un pedido. El monto SALE DE LA BASE (no del navegador) y el dinero va a la cuenta del comercio.
import { json, rpc, mismoOrigen, sitio, esUuid } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  if (!mismoOrigen(request, env)) return json({ error: 'Origen no permitido' }, 403);
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'Solicitud inválida' }, 400); }
  const slug = String((b && b.slug) || ''), pedido = String((b && b.pedido) || '');
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(slug) || !esUuid(pedido)) return json({ error: 'Datos inválidos' }, 400);
  let d;
  try { d = await rpc(env, 'svc_mp_datos', { p_slug: slug, p_order: pedido, p_ip: request.headers.get('cf-connecting-ip') || 'sin-ip' }); }
  catch (e) { return json({ error: e.message }, 429); }
  if (!d) return json({ error: 'Este pedido no admite pago online.' }, 404);
  const base = sitio(request, env);
  const pref = {
    items: [{ id: 'pedido-' + d.numero, title: `Pedido #${d.numero} · ${d.tienda}`.slice(0, 120), quantity: 1, unit_price: Number(d.total), currency_id: 'ARS' }],
    external_reference: d.order_id,
    notification_url: `${base}/api/mp-webhook?t=${d.tenant_id}`,
    back_urls: { success: `${base}/t/${slug}?pago=ok&n=${d.numero}`, pending: `${base}/t/${slug}?pago=pendiente&n=${d.numero}`, failure: `${base}/t/${slug}?pago=error&n=${d.numero}` },
    auto_return: 'approved',
  };
  let r;
  try { r = await fetch('https://api.mercadopago.com/checkout/preferences', { method: 'POST', headers: { authorization: `Bearer ${d.token}`, 'content-type': 'application/json' }, body: JSON.stringify(pref) }); }
  catch (e) { return json({ error: 'No pudimos conectar con Mercado Pago.' }, 502); }
  const m = await r.json().catch(() => ({}));
  if (!r.ok || !m.init_point) {
    await rpc(env, 'svc_evento', { p_tenant: d.tenant_id, p_tipo: 'mp_error_preferencia', p_detalle: { pedido: d.numero, status: r.status } }).catch(() => { });
    return json({ error: 'Mercado Pago rechazó la solicitud. Avisale al comercio o pagá por otro medio.' }, 502);
  }
  return json({ init_point: String(d.token).startsWith('TEST-') ? (m.sandbox_init_point || m.init_point) : m.init_point });
}
