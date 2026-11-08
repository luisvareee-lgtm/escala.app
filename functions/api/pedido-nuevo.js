// Lo llama la base de datos (pg_net) cada vez que entra un pedido de un comercio Full API.
// Autenticación: cabecera x-escala-secret (clave compartida FN_SECRET). Envía el webhook firmado y/o el aviso por email.
import { json, rpc, esUuid, igualesSeguro, enviarWebhook, enviarEmail, cargaPedido, escHtml } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  if (!igualesSeguro(request.headers.get('x-escala-secret'), env.FN_SECRET)) return json({ error: 'No autorizado' }, 401);
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'JSON inválido' }, 400); }
  if (!esUuid(b && b.order_id)) return json({ error: 'order_id inválido' }, 400);
  const d = await rpc(env, 'svc_pedido_para_webhook', { p_order_id: b.order_id }).catch(() => null);
  if (!d) return json({ ok: true, omitido: true });
  const out = {};
  const { evento, entrega, payload } = cargaPedido(d);
  if (d.tenant.webhook_url) {
    const r = await enviarWebhook(d.tenant.webhook_url, d.tenant.secret, evento, payload, entrega);
    out.webhook = r;
    await rpc(env, 'svc_evento', { p_tenant: d.tenant.id, p_tipo: r.ok ? 'webhook_ok' : 'webhook_error', p_detalle: { pedido: d.pedido.numero, status: r.status || null, error: r.error || null } }).catch(() => { });
  }
  if (d.tenant.notif_email && d.tenant.email) {
    const p = d.pedido;
    const filas = d.items.map(i => `<li>${escHtml(i.cantidad)} × ${escHtml(i.nombre)}${i.variante ? ' (' + escHtml(i.variante) + ')' : ''} — $${Math.round(i.subtotal).toLocaleString('es-AR')}</li>`).join('');
    out.email = await enviarEmail(env, {
      to: d.tenant.email, subject: `Pedido nuevo #${p.numero} — $${Math.round(p.total).toLocaleString('es-AR')}`,
      html: `<p><b>${escHtml(p.cliente_nombre)}</b> (${escHtml(p.cliente_whatsapp)}) hizo un pedido en ${escHtml(d.tenant.nombre)}.</p><ul>${filas}</ul><p>Total: <b>$${Math.round(p.total).toLocaleString('es-AR')}</b> · pago: ${escHtml(p.medio_pago)}</p><p>Entrá a tu panel para gestionarlo.</p>`,
    });
  }
  return json({ ok: true, ...out });
}
