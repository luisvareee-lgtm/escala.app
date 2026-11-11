// Mercado Pago avisa acá cuando alguien se suscribe a un plan de Escala (o lo pausa / cancela).
// NO confiamos en lo que llega: con el token de TU cuenta (MP_PLATAFORMA_TOKEN, secreto) le preguntamos a Mercado Pago
// el estado real de esa suscripción. Una suscripción inventada no existe en tu cuenta y se ignora.
// Variables (Cloudflare > Settings > Variables and Secrets):
//   MP_PLATAFORMA_TOKEN  (SECRETA) Access Token de producción de la cuenta que cobra los planes.
//   MP_PLAN_BASE, MP_PLAN_PRO, MP_PLAN_API  (opcionales) id del plan de suscripción de cada plan (preapproval_plan_id).
//   Si no están, el plan se deduce por el monto: PRECIO_BASE / PRECIO_PRO / PRECIO_API (por defecto 9900 / 29900 / 49900).
import { json, rpc, esUuid } from '../_lib.js';

export function planDe(env, pre) {
  const pid = String(pre.preapproval_plan_id || '');
  for (const [k, plan] of [['MP_PLAN_API', 'api'], ['MP_PLAN_PRO', 'pro'], ['MP_PLAN_BASE', 'base']]) if (pid && env[k] && String(env[k]) === pid) return plan;
  const ar = pre.auto_recurring || {}, monto = Number(ar.transaction_amount);
  if (!(monto > 0) || (ar.currency_id && ar.currency_id !== 'ARS')) return null;
  const pr = { api: Number(env.PRECIO_API) || 49900, pro: Number(env.PRECIO_PRO) || 29900, base: Number(env.PRECIO_BASE) || 9900 };
  return monto >= pr.api ? 'api' : monto >= pr.pro ? 'pro' : monto >= pr.base ? 'base' : null;   // paga menos que el Base: no activa nada
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  let b = {}; try { b = await request.json(); } catch (e) { }
  const tipo = String((b && b.type) || url.searchParams.get('type') || url.searchParams.get('topic') || '');
  const id = String((b && b.data && b.data.id) || url.searchParams.get('data.id') || url.searchParams.get('id') || '');
  if (!/preapproval/.test(tipo) || /plan/.test(tipo) || !/^[a-zA-Z0-9]{6,80}$/.test(id)) return json({ ok: true });
  if (!env.MP_PLATAFORMA_TOKEN) return json({ ok: true, estado: 'sin_configurar' });
  let r;
  try { r = await fetch(`https://api.mercadopago.com/preapproval/${id}`, { headers: { authorization: `Bearer ${env.MP_PLATAFORMA_TOKEN}` } }); }
  catch (e) { return json({ error: 'reintentar' }, 502); }
  if (r.status === 404) return json({ ok: true });
  if (!r.ok) return json({ error: 'reintentar' }, 502);   // Mercado Pago reintenta solo
  const p = await r.json().catch(() => null);
  if (!p || !p.status) return json({ ok: true });
  const ref = String(p.external_reference || '');
  let res;
  try {
    res = await rpc(env, 'svc_suscripcion', {
      p_ref: String(p.id || id), p_estado: String(p.status), p_plan: planDe(env, p),
      p_tenant: esUuid(ref) ? ref : null, p_email: p.payer_email ? String(p.payer_email).slice(0, 160) : null,
      p_monto: Number(p.auto_recurring && p.auto_recurring.transaction_amount) || null });
  } catch (e) { return json({ error: 'reintentar' }, 502); }
  return json({ ok: true, resultado: res });
}
