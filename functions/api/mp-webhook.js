// Mercado Pago avisa acá cuando hay un pago. NO confiamos en lo que llega: consultamos el pago a Mercado Pago con el token del comercio
// (un pago ajeno o inventado no existe en su cuenta) y solo marcamos "cobrado" si está aprobado y cubre el total del pedido.
import { json, rpc, esUuid } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const tenant = url.searchParams.get('t');
  if (!esUuid(tenant)) return json({ ok: true });
  let b = {}; try { b = await request.json(); } catch (e) { }
  const tipo = String((b && b.type) || url.searchParams.get('type') || url.searchParams.get('topic') || '');
  const id = String((b && b.data && b.data.id) || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
  if (!/payment/.test(tipo) || !/^\d{1,20}$/.test(id)) return json({ ok: true });
  const token = await rpc(env, 'svc_mp_token', { p_tenant: tenant }).catch(() => null);
  if (!token) return json({ ok: true });
  let r;
  try { r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, { headers: { authorization: `Bearer ${token}` } }); }
  catch (e) { return json({ error: 'reintentar' }, 502); }
  if (r.status === 404) return json({ ok: true });
  if (!r.ok) return json({ error: 'reintentar' }, 502);   // Mercado Pago reintenta solo
  const p = await r.json().catch(() => null);
  if (!p || p.status !== 'approved' || p.currency_id !== 'ARS' || !esUuid(p.external_reference)) return json({ ok: true, estado: p && p.status });
  const res = await rpc(env, 'svc_mp_confirmar', { p_tenant: tenant, p_order: p.external_reference, p_monto: Number(p.transaction_amount), p_pago_ref: id });
  return json({ ok: true, resultado: res });
}
