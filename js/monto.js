// v2.34 · Montos de un pedido: seña, saldo y moneda (pesos o dólares). Lo usan Pedidos, Caja, Cobranzas y Resumen.
// La base guarda todo en pesos (total_ars, sena_ars); un pedido en dólares además guarda total_usd y la cotización.
import { fmtArs, fmtUsd } from './util.js';

export const esUsd = o => !!o && o.moneda === 'USD' && Number(o.cotizacion_cobro) > 0;
export const sena = o => Number(o && o.sena_ars) || 0;
// lo que falta cobrar de un pedido (los cancelados y cobrados no deben nada)
export const saldo = o => o && o.estado === 'pendiente' ? Math.max(0, Number(o.total_ars) - sena(o)) : 0;
// lo que ya entró de un pedido: todo si está cobrado; la seña si está por cobrar
export const cobradoDe = o => !o || o.estado === 'cancelado' ? 0 : o.estado === 'cobrado' ? Number(o.total_ars) : sena(o);
// un monto (en pesos) dicho en la moneda del pedido: lo que lee el cliente
export const enMoneda = (o, ars) => esUsd(o) ? fmtUsd(Number(ars) / Number(o.cotizacion_cobro)) : fmtArs(ars);
export const totalTxt = o => esUsd(o) ? fmtUsd(o.total_usd) : fmtArs(o.total_ars);
// para el comercio: los dólares y cuánto es en pesos
export const totalPanel = o => esUsd(o) ? `${fmtUsd(o.total_usd)} <small class="muted">≈ ${fmtArs(o.total_ars)}</small>` : fmtArs(o.total_ars);
export const MEDIO_USD = { usd_transferencia: '🏦 Transferencia en dólares', usdt: '🪙 USDT', usd_efectivo: '💵 Dólares en efectivo' };
export const MEDIO_COBRO = { efectivo: '💵 Efectivo', transferencia: '🏦 Transferencia', usd: '🇺🇸 Dólares', usdt: '🪙 USDT' };
// los datos para que el cliente pague (alias en pesos, o la cuenta en dólares / la billetera USDT)
export function datosPago(o, t) {
  if (!t) return '';
  if (esUsd(o)) {
    if (o.medio_usd === 'usdt' && t.usdt_wallet) return ` USDT (red ${t.usdt_red}): ${t.usdt_wallet}.`;
    if (o.medio_usd === 'usd_transferencia' && t.usd_cuenta) return ` Cuenta en dólares: ${t.usd_cuenta}.`;
    return '';
  }
  return o.medio_pago === 'transferencia' && t.alias_cobro ? ` Podés transferir a: ${t.alias_cobro}.` : '';
}
// "El total es X" o, con seña, "ya nos dejaste Y de seña: te faltan Z"
export function cuantoFalta(o) {
  const s = sena(o);
  return s > 0 ? `El total es ${totalTxt(o)}; ya nos dejaste ${enMoneda(o, s)} de seña, así que te faltan ${enMoneda(o, saldo(o))}.` : `El total es ${totalTxt(o)}.`;
}
