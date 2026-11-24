// v2.36 · Resumen del Auditor comercial al celular, los lunes a las 9 (plan Mayorista IA).
// Lo llama la base de datos (pg_cron + pg_net), una vez por tienda, con la cabecera x-escala-secret
// (la clave interna de la base, o FN_SECRET de Cloudflare si la cargaste ahí). Si no hay nada para mirar, no avisa.
import { json, rpc, esUuid, igualesSeguro, sitio } from '../_lib.js';
import { avisarTodos } from '../_push.js';

async function autorizado(request, env) {
  const h = request.headers.get('x-escala-secret');
  if (!h) return false;
  if (env.FN_SECRET && igualesSeguro(h, env.FN_SECRET)) return true;
  const s = await rpc(env, 'svc_fn_secret', {}).catch(() => null);
  return typeof s === 'string' && igualesSeguro(h, s);
}

const pesos = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const nn = (a, k) => Number(a && a[k] && a[k].n) || 0;
// Las líneas del resumen, de lo que más plata te hace perder a lo que menos.
export function resumenAuditor(a) {
  const L = [], perdida = ((a.ganancia_baja && a.ganancia_baja.items) || []).filter(i => i.pct < 0).length;
  const s = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  if (nn(a, 'se_agotan')) L.push(s(nn(a, 'se_agotan'), 'producto se agota', 'productos se agotan') + ' en menos de 10 días');
  if (perdida) L.push(s(perdida, 'producto se vende', 'productos se venden') + ' a pérdida');
  if (nn(a, 'vistos_sin_venta')) L.push(s(nn(a, 'vistos_sin_venta'), 'muy visto', 'muy vistos') + ' sin ventas');
  if (nn(a, 'carrito_sin_compra')) L.push(s(nn(a, 'carrito_sin_compra'), 'va', 'van') + ' al carrito y no se compra' + (nn(a, 'carrito_sin_compra') === 1 ? '' : 'n'));
  if (nn(a, 'stock_parado')) L.push(pesos(a.stock_parado.plata) + ' parados en stock');
  if (nn(a, 'ganancia_baja') > perdida) L.push(s(nn(a, 'ganancia_baja') - perdida, 'con ganancia baja', 'con ganancia baja'));
  if (nn(a, 'sin_costo')) L.push(s(nn(a, 'sin_costo'), 'sin costo cargado', 'sin costo cargado'));
  if (nn(a, 'sin_foto')) L.push(s(nn(a, 'sin_foto'), 'visitado sin foto', 'visitados sin foto'));
  const total = ['se_agotan', 'vistos_sin_venta', 'carrito_sin_compra', 'stock_parado', 'ganancia_baja', 'sin_costo', 'sin_foto'].reduce((t, k) => t + nn(a, k), 0);
  return { total, lineas: L };
}

export async function onRequestPost({ request, env }) {
  if (!(await autorizado(request, env))) return json({ error: 'No autorizado' }, 401);
  let b; try { b = await request.json(); } catch (e) { return json({ error: 'JSON inválido' }, 400); }
  if (!esUuid(b && b.tenant_id)) return json({ error: 'tenant_id inválido' }, 400);
  const d = await rpc(env, 'svc_auditor_aviso', { p_tenant: b.tenant_id }).catch(() => null);
  if (!d || !d.auditor) return json({ ok: true, omitido: true });
  const r = resumenAuditor(d.auditor);
  if (!r.total || !d.subs || !d.subs.length) return json({ ok: true, sinNovedades: !r.total });
  const push = await avisarTodos(env, d.subs, {
    title: `🕵️ Auditor · ${r.total} ${r.total === 1 ? 'cosa' : 'cosas'} para mirar esta semana`,
    body: r.lineas.slice(0, 3).join(' · '),
    url: '/app#/panel?tab=asistente&ia=auditor', tag: 'auditor',
  }, sitio(request, env)).catch(e => ({ error: e.message }));
  return json({ ok: true, total: r.total, push });
}
