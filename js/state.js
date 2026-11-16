// Estado compartido del panel y reglas de plan (espejo de las del servidor: la verdad siempre la decide la base de datos).
export const P = { t: null, tab: 'resumen', prods: [], pedidos: [], items: [], carritos: [], eventos: [], revs: [], provs: [], modal: null, repintar: () => { } };
export const RANK = { base: 0, pro: 1, api: 2 };
// Plan pagado por transferencia: vale hasta plan_hasta + 3 días de tolerancia (igual que plan_efectivo en la base).
export const TOLERANCIA_DIAS = 3;
export const planVencido = t => !!(t && t.plan !== 'base' && t.plan_hasta && t.suscripcion_estado !== 'activa' && new Date(t.plan_hasta).getTime() + TOLERANCIA_DIAS * 864e5 < Date.now());
export const planEf = t => (t.trial_ends_at && new Date(t.trial_ends_at) > new Date()) ? 'api' : planVencido(t) ? 'base' : t.plan;
const MIN = { escalas: 0, pdf: 0, importar: 0, hibrido: 1, pixel: 1, usd: 1, dashboard: 1, carritos: 1, seguimiento: 1, stock: 1, multinivel: 1, proveedores: 1, mercado: 1, webhook: 2 };
export const can = f => RANK[planEf(P.t)] >= (MIN[f] ?? 9);
export const PLAN_NOMBRE = { base: 'Catálogo Base', pro: 'Mayorista Pro', api: 'Suite Automatización' };
export const aviso = f => can(f) ? '' : ' <span class="tag warn">🔒 ' + (MIN[f] >= 2 ? 'Automatización' : 'Pro') + '</span>';
// mismo cálculo que la base de datos (solo para mostrar; el pedido siempre lo calcula el servidor)
// precio de venta en pesos enteros, redondeado hacia arriba a la decena. El round() saca los centavos que deja pasar
// un costo en pesos a dólares y de vuelta ($70.000 → 70.000,04): si no, quedaba $105.010 en vez de $105.000.
export const precioArs = (costo, cot, margen) => Math.ceil(Math.round(Number(costo) * Number(cot) * (1 + Number(margen))) / 10) * 10;
