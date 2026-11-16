// Promo por cantidad (v2.25): "Llevando 2: 15 % off", "$5.000 menos c/u", "2 x $96.000", "50 % off en la 2da", "3x2".
// El cálculo es el mismo que el de la base (promo_desc). Lo que cobra es el de la base: acá es para mostrar.
import { fmt } from './util.js';

export const TIPOS = [
  ['ult', '% off en la última de cada grupo (2da al 50 %, 3x2)'],
  ['pct', '% off en todas, llevando varias'],
  ['nx', 'Precio fijo por varias (2 x $96.000)'],
  ['monto', '$ menos en cada una, llevando varias'],
];
// atajos del panel: [nombre, promo] (el "2 x $" toma el precio de 2 con 10 % menos como punto de partida)
export const ATAJOS = [
  ['50 % off en la 2da', { tipo: 'ult', desde: 2, valor: 50 }],
  ['3x2', { tipo: 'ult', desde: 3, valor: 100 }],
  ['2x1', { tipo: 'ult', desde: 2, valor: 100 }],
  ['Llevando 2: 10 % off', { tipo: 'pct', desde: 2, valor: 10 }],
  ['2 x $…', { tipo: 'nx', desde: 2, valor: 0 }],
];
const ORD = { 2: '2da', 3: '3ra', 4: '4ta', 5: '5ta', 6: '6ta', 7: '7ma', 8: '8va', 9: '9na', 10: '10ma' };
const num = v => String(Math.round(Number(v) * 100) / 100).replace('.', ',');
export const ordinal = n => ORD[n] || `unidad ${n}`;

export function promoOk(x) {
  if (!x || typeof x !== 'object') return false;
  const n = Number(x.desde), v = Number(x.valor);
  if (!['pct', 'monto', 'nx', 'ult'].includes(x.tipo) || !Number.isInteger(n) || n < 2 || n > 99 || !isFinite(v)) return false;
  return x.tipo === 'pct' ? v >= 1 && v <= 90 : x.tipo === 'ult' ? v >= 1 && v <= 100 : v > 0 && v <= 1e8;
}
// Texto corto (etiqueta de la tarjeta, la lista de productos, el pedido)
export function promoTxt(x) {
  if (!promoOk(x)) return '';
  const n = +x.desde, v = +x.valor;
  if (x.tipo === 'pct') return `Llevando ${n}: ${num(v)} % off`;
  if (x.tipo === 'monto') return `Llevando ${n}: ${fmt(v)} menos c/u`;
  if (x.tipo === 'nx') return `${n} x ${fmt(v)}`;
  return v >= 100 ? `${n}x${n - 1}` : `${num(v)} % off en la ${ordinal(n)}`;
}
// Precio con v % off, redondeado hacia arriba a $10. En enteros (centésimos de %), para que dé igual que la base:
// 58.500 × 0,54 en coma flotante es 31.590,000000000004 y redondeaba a $31.600.
const conPct = (u, v) => Math.ceil(Math.round(u * Math.round((100 - v) * 100)) / 100000) * 10;
const pctDe = (u, v) => Math.floor(Math.round(u * Math.round(v * 100)) / 100000) * 10;   // v % de u, hacia abajo a $10
// Cuánto se descuenta llevando q a u pesos cada una (igual que promo_desc en la base)
export function promoDesc(x, u, q) {
  u = Number(u); q = Number(q);
  if (!promoOk(x) || !(u > 0) || !(q >= +x.desde)) return 0;
  const n = +x.desde, v = +x.valor, g = Math.floor(q / n);
  if (x.tipo === 'pct') return (u - conPct(u, v)) * q;
  if (x.tipo === 'monto') return Math.min(v, u) * q;
  if (x.tipo === 'nx') return g * Math.max(0, n * u - v);
  return g * Math.min(u, pctDe(u, v));
}
// Recuadro de la ficha: [número grande, qué hay que hacer, beneficio, detalle con el precio]
export function promoPartes(x, u) {
  if (!promoOk(x)) return null;
  const n = +x.desde, v = +x.valor, total = n * u - promoDesc(x, u, n);
  if (x.tipo === 'pct') return [n, `Llevá ${n} o más`, `${num(v)} % OFF`, `Cada una a ${fmt(conPct(u, v))}`];
  if (x.tipo === 'monto') return [n, `Llevá ${n} o más`, `${fmt(v)} menos c/u`, `Cada una a ${fmt(Math.max(0, u - v))}`];
  if (x.tipo === 'nx') return [n, `Llevá ${n}`, `por ${fmt(v)}`, v < n * u ? `Te queda ${fmt(v / n)} c/u en vez de ${fmt(u)}` : ''];
  if (v >= 100) return [n, `Llevá ${n} y pagá ${n - 1}`, `${n}x${n - 1}`, `${n} por ${fmt(total)}`];
  return [n, `La ${ordinal(n)} unidad`, `${num(v)} % OFF`, `Llevando ${n} pagás ${fmt(total)} en vez de ${fmt(n * u)}`];
}
// Para el carrito: cuántas faltan para la promo (o null si ya la tiene o no hay)
export function promoFalta(x, q) {
  if (!promoOk(x)) return null;
  const n = +x.desde;
  if (q >= n && x.tipo !== 'nx' && x.tipo !== 'ult') return null;
  const f = q < n ? n - q : (n - q % n) % n;
  return f || null;
}
// El pedido guardado: suma los descuentos por producto (un producto con varios talles es un solo renglón de promo)
export function promosDelPedido(items, nombre = i => i.nombre_snapshot || i.nombre) {
  const m = new Map();
  (items || []).forEach(i => {
    const d = Number(i.descuento) || 0; if (!(d > 0)) return;
    const k = i.product_id || i.producto_id || nombre(i), o = m.get(k) || { nombre: nombre(i), promo: i.promo, d: 0 };
    o.d += d; m.set(k, o);
  });
  return [...m.values()];
}

/* ---------- v2.26: descuento por monto del carrito, cupones y qué promo vale para cada producto ---------- */
// {"escalones": [{"desde": 100000, "pct": 10}, …]} (igual que monto_ok en la base)
export function montoOk(x) {
  const e = x && Array.isArray(x.escalones) ? x.escalones : null; if (!e || e.length < 1 || e.length > 3) return false;
  return e.every((s, i) => s && isFinite(+s.desde) && isFinite(+s.pct) && +s.desde >= 1 && +s.desde <= 1e8 && +s.pct >= 1 && +s.pct <= 50
    && e.slice(0, i).every(f => +f.desde < +s.desde && +f.pct <= +s.pct));
}
// el escalón alcanzado con ese total (o null) y el siguiente (para "te faltan $X")
export function montoEscalon(x, total) {
  if (!montoOk(x)) return { act: null, sig: null };
  const e = x.escalones.slice().sort((a, b) => a.desde - b.desde);
  return { act: e.filter(s => +s.desde <= total).pop() || null, sig: e.find(s => +s.desde > total) || null };
}
export const montoDesc = (x, total) => { const { act } = montoEscalon(x, Number(total) || 0); return act ? pctDe(Number(total), +act.pct) : 0; };
export const montoTxt = x => montoOk(x) ? x.escalones.map(s => `superando ${fmt(s.desde)}: ${num(s.pct)} % off`).join(' · ') : '';
// cupón: % sobre lo que no tiene otro descuento, $ (hasta ese total) o envío gratis
export const cuponDesc = (c, base) => !c || !(base > 0) ? 0 : c.tipo === 'pct' ? pctDe(base, +c.valor) : c.tipo === 'monto' ? Math.min(+c.valor, base) : 0;
export const cuponTxt = c => !c ? '' : c.tipo === 'pct' ? `${num(c.valor)} % off` : c.tipo === 'monto' ? `${fmt(c.valor)} off` : 'envío gratis';
// Promociones del panel: la que vale hoy para un producto (igual que promo_vigente en la base)
export const vigente = (r, ahora = Date.now()) => !!r && r.activa !== false && (!r.desde_at || new Date(r.desde_at).getTime() <= ahora) && (!r.hasta_at || ahora < new Date(r.hasta_at).getTime());
const nivel = r => r.alcance === 'productos' ? 1 : r.alcance === 'categoria' ? 2 : 3;
export function promoDeProducto(p, reglas, ahora) {
  if (!p || (Array.isArray(p.combo) && p.combo.length)) return null;
  const L = (reglas || []).filter(r => r.tipo === 'cantidad' && vigente(r, ahora) && (r.alcance === 'productos' ? (r.productos || []).includes(p.id) : r.alcance === 'categoria' ? r.categoria === p.categoria : true));
  L.sort((a, b) => nivel(a) - nivel(b) || String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return L[0] || null;
}
