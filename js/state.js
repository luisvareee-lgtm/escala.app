// Estado compartido del panel y reglas de plan (espejo de las del servidor: la verdad siempre la decide la base de datos).
export const P = { t: null, tab: 'resumen', prods: [], pedidos: [], items: [], carritos: [], eventos: [], revs: [], provs: [], modal: null, repintar: () => { } };
export const RANK = { base: 0, pro: 1, api: 2 };
// Plan pagado por transferencia: vale hasta plan_hasta + 3 días de tolerancia (igual que plan_efectivo en la base).
// v2.33: sin plan pago vigente (prueba terminada, plan vencido o suscripción pausada/cancelada) la tienda queda en Gratis.
export const TOLERANCIA_DIAS = 3;
export const planVencido = t => !!(t && t.plan !== 'base' && t.plan_hasta && t.suscripcion_estado !== 'activa' && new Date(t.plan_hasta).getTime() + TOLERANCIA_DIAS * 864e5 < Date.now());
const suscCortada = t => t.plan !== 'base' && !t.plan_hasta && (t.suscripcion_estado === 'pausada' || t.suscripcion_estado === 'cancelada');
export const planEf = t => (t.trial_ends_at && new Date(t.trial_ends_at) > new Date()) ? 'api' : (planVencido(t) || suscCortada(t)) ? 'base' : (t.plan || 'base');
// Plan Gratis: publica hasta 100 productos (espejo de limite_productos en la base, que es la que decide).
export const LIMITE_GRATIS = 100;
export const limiteProductos = t => planEf(t) === 'base' ? LIMITE_GRATIS : null;
// ids de los productos que se ven en la tienda con el límite (los primeros publicados, como en la base)
// Antes de cargar varios de una: los que no entran en el plan Gratis se guardan pausados (la base hace lo mismo). Devuelve cuántos.
export function pausarFueraDeCupo(filas) {
  const lim = limiteProductos(P.t); if (lim == null) return 0;
  let libres = lim - (P.prods || []).filter(p => p.activo).length, n = 0;
  filas.forEach(f => { if (f.activo === false) return; if (libres > 0) { libres--; return; } f.activo = false; n++; });
  return n;
}
export function idsEnCupo(t, prods) {
  const lim = limiteProductos(t); if (lim == null) return null;
  return new Set(prods.filter(p => p.activo).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)) || String(a.id).localeCompare(String(b.id))).slice(0, lim).map(p => p.id));
}
// v2.33: Gratis (base) = catálogo de hasta 100 productos con 1 precio, carga Excel/CSV y pedidos por WhatsApp. Todo lo demás, desde Mayorista Pro.
const MIN = { importar: 0, escalas: 1, pdf: 1, ocr: 1, presupuestos: 1, caja: 1, cobranzas: 1, resultado: 1, push: 1, flyers: 1, sinmarca: 1, dominio: 2, hibrido: 1, pixel: 1, usd: 1, dashboard: 1, usuarios: 2, fichas: 2, auditor: 2, carritos: 1, seguimiento: 1, stock: 1, multinivel: 1, proveedores: 1, mercado: 1, webhook: 2 };
export const can = f => RANK[planEf(P.t)] >= (MIN[f] ?? 9);
export const PLAN_NOMBRE = { base: 'Gratis', pro: 'Mayorista Pro', api: 'Mayorista IA' };
// Herramienta bloqueada en el plan actual: tarjeta con el botón para ver planes (mismo formato en todo el panel).
export const bloqueo = (titulo, texto, f = 'pro') => `<div class="locked" data-bloqueo="${f}"><b>${titulo}</b><p style="margin:6px 0">${texto}</p><span class="tag warn">🔒 Plan ${MIN[f] >= 2 ? PLAN_NOMBRE.api : PLAN_NOMBRE.pro}</span><br><button class="btn btn-p btn-sm lock-cta" data-act="p-planes" data-p="${MIN[f] >= 2 ? 'api' : 'pro'}">Ver planes y activar</button></div>`;
// Flyers en Gratis: 3 por mes. Se cuentan en este navegador (es una prueba; no hay datos que proteger).
export const FLYERS_GRATIS = 3;
const flyKey = () => 'flyers:' + (P.t && P.t.id) + ':' + new Date().toISOString().slice(0, 7);
export const flyersUsados = () => { try { return Number(localStorage.getItem(flyKey())) || 0; } catch (e) { return 0; } };
export function usarFlyer() {
  if (can('flyers')) return true;
  const n = flyersUsados(); if (n >= FLYERS_GRATIS) return false;
  try { localStorage.setItem(flyKey(), String(n + 1)); } catch (e) { }
  return true;
}
export const aviso = f => can(f) ? '' : ' <span class="tag warn">🔒 ' + (MIN[f] >= 2 ? 'Mayorista IA' : 'Pro') + '</span>';
// mismo cálculo que la base de datos (solo para mostrar; el pedido siempre lo calcula el servidor)
// precio de venta en pesos enteros, redondeado hacia arriba a la decena. El round() saca los centavos que deja pasar
// un costo en pesos a dólares y de vuelta ($70.000 → 70.000,04): si no, quedaba $105.010 en vez de $105.000.
export const precioArs = (costo, cot, margen) => Math.ceil(Math.round(Number(costo) * Number(cot) * (1 + Number(margen))) / 10) * 10;
