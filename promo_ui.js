// Panel: la promo por cantidad en la ficha del producto, en "Editar" varios a la vez y en 🎁 Promociones.
// v2.26: las promos viven en Promociones (P.promos); la de un producto es la más puntual que le toca.
import { esc, fmt, on, $ } from './util.js';
import { P } from './state.js';
import { TIPOS, ATAJOS, promoOk, promoTxt, promoDesc, promoDeProducto } from './promo.js';
import { sumanTxt } from './talles.js';

// Se ve cuando la base ya tiene Promociones (v2.26) y la tienda le vende al público (en una mayorista no aplica).
export const hayPromo = () => !!P.t && P.t.modalidad !== 'mayorista' && Array.isArray(P.promos);
export const reglaDe = p => promoDeProducto(p, P.promos);
export const promoChip = p => { const r = Array.isArray(P.promos) && reglaDe(p); return r ? '🎁 ' + promoTxt(r.regla) : ''; };
// ¿la promo que vale es solo de este producto? (la que se edita desde su ficha)
export const propiaDe = p => { const r = reglaDe(p); return r && r.alcance === 'productos' && (r.productos || []).length === 1 ? r : null; };
// precio por unidad que ve el público: el del formulario del producto o, en Promociones, el del ejemplo
let precioForm = () => 0, precioRef = () => 0, avisar = () => { };
export const usarPrecio = fn => { precioForm = fn; };
export const usarPrecioRef = fn => { precioRef = fn; };
export const alCambiarPromo = fn => { avisar = fn; };
const precio = () => Number(precioForm()) || Number(precioRef()) || 0;

const LBL = {
  desde: t => t === 'nx' || t === 'ult' ? 'Cada cuántas unidades' : 'Desde cuántas unidades',
  valor: t => t === 'pct' ? 'Descuento % en cada una' : t === 'ult' ? '% off en la última (100 = gratis)' : t === 'nx' ? 'Precio total de ese grupo $' : 'Pesos menos en cada una $',
  ej: t => t === 'pct' ? 'Ej: 15' : t === 'ult' ? 'Ej: 50' : t === 'nx' ? 'Ej: 96000' : 'Ej: 5000',
};
export function camposPromo(x, quitar) {
  const t = x ? x.tipo : 'ult';
  return `${quitar ? `<div class="pr-modo"><label class="mz-r"><input type="radio" name="prm_modo" value="poner" checked data-change="pr-prev"> Poner esta promo</label><label class="mz-r"><input type="radio" name="prm_modo" value="quitar" data-change="pr-prev"> Quitar la promo</label></div>` : ''}
    <div class="pr-at" role="group" aria-label="Atajos">${ATAJOS.map(([n], i) => `<button type="button" class="pill" data-act="pr-atajo" data-i="${i}">${n}</button>`).join('')}</div>
    <div class="fg"><label class="flabel" for="pr-t">Tipo de promo</label><select class="fi" id="pr-t" name="promo_tipo" data-change="pr-prev">${TIPOS.map(([v, n]) => `<option value="${v}" ${t === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <div class="row2"><div class="fg"><label class="flabel" for="pr-d" id="pr-d-l">${LBL.desde(t)}</label><input class="fi" id="pr-d" name="promo_desde" type="number" min="2" max="99" step="1" inputmode="numeric" value="${x ? x.desde : ''}" placeholder="Ej: 2" data-input="pr-prev"></div>
    <div class="fg"><label class="flabel" for="pr-v" id="pr-v-l">${LBL.valor(t)}</label><input class="fi" id="pr-v" name="promo_valor" type="number" min="0" step="any" inputmode="decimal" value="${x ? x.valor : ''}" placeholder="${LBL.ej(t)}" data-input="pr-prev"></div></div>
    <div class="pr-prev" id="pr-prev" aria-live="polite">${prevPromo(x)}</div>`;
}
export function promoSecHtml(p) {
  const r = p && p.id ? reglaDe(p) : null, propia = p && p.id ? propiaDe(p) : null, x = propia ? propia.regla : null;
  const de = r && !propia ? `<div class="pr-de">🎁 <b>${esc(promoTxt(r.regla))}</b> · viene de la promo de ${esc(r.alcance === 'tienda' ? 'toda la tienda' : r.alcance === 'categoria' ? 'la categoría ' + r.categoria : 'varios productos')}. Se edita en Tienda → 🎁 Promociones. Si le ponés una propia acá abajo, le gana.</div>` : '';
  return `<details class="pm-sec" id="pm-pr"${r ? ' open' : ''}><summary>🎁 Promo por cantidad${r ? ` · ${esc(promoTxt(r.regla))}` : ''}</summary>
    ${de}${camposPromo(x, false)}
    <div class="hint">Se cuentan todas las unidades de este producto: ${sumanTxt()}. La tienda la muestra en la tarjeta y en la ficha, y el pedido la descuenta solo. Dejá los casilleros vacíos para no tener promo propia.</div></details>`;
}
// Lo que se escribió en el formulario: la promo, null (sin promo) o un error para mostrar.
export function promoDe(fd) {
  const t = String(fd.get('promo_tipo') || 'ult'), d = String(fd.get('promo_desde') || '').trim(), v = String(fd.get('promo_valor') || '').trim().replace(',', '.');
  if (!d && !v) return null;
  const n = Number(d), val = Number(v);
  if (!Number.isInteger(n) || n < 2 || n > 99) throw new Error('La promo va desde 2 unidades (hasta 99).');
  if (!isFinite(val) || val <= 0) throw new Error(t === 'nx' ? 'Poné el precio total del grupo en pesos.' : t === 'monto' ? 'Poné cuántos pesos menos en cada una.' : 'Poné el % de descuento de la promo.');
  if (t === 'pct' && val > 90) throw new Error('El descuento de la promo va de 1 a 90 %.');
  if (t === 'pct' && val < 1) throw new Error('El descuento de la promo va de 1 a 90 %.');
  if (t === 'ult' && (val < 1 || val > 100)) throw new Error('El % off en la última va de 1 a 100 (100 = gratis, como el 3x2).');
  const x = { tipo: t, desde: n, valor: t === 'pct' || t === 'ult' ? Math.round(val * 100) / 100 : Math.round(val) };
  if (!promoOk(x)) throw new Error('Revisá la promo.');
  return x;
}
function prevPromo(x) {
  if (!promoOk(x)) return '<span class="muted">Elegí un atajo o completá la promo.</span>';
  const u = precio(), n = +x.desde, txt = `<b>🎁 ${esc(promoTxt(x))}</b>`;
  if (!(u > 0)) return `Así se ve en tu tienda: ${txt}`;
  const d = promoDesc(x, u, n);
  if (x.tipo === 'nx' && !(d > 0)) return `${txt}<br><span class="pr-warn">Ojo: ${n} a precio normal salen ${fmt(n * u)}. Con ${fmt(x.valor)} no hay descuento.</span>`;
  return `${txt}<br>Con tu precio de ${fmt(u)}: llevando ${n} pagan <b>${fmt(n * u - d)}</b> en vez de ${fmt(n * u)} (ahorran ${fmt(d)}).`;
}
const leer = () => { const f = document.querySelector('#pr-t') && document.querySelector('#pr-t').form; return f ? { f, fd: new FormData(f) } : null; };
on('pr-prev', () => {
  const r = leer(); if (!r) return; const t = String(r.fd.get('promo_tipo') || 'ult');
  const dl = $('#pr-d-l'), vl = $('#pr-v-l'), vi = $('#pr-v'); if (dl) dl.textContent = LBL.desde(t); if (vl) vl.textContent = LBL.valor(t); if (vi) vi.placeholder = LBL.ej(t);
  const quitar = r.fd.get('prm_modo') === 'quitar'; let x = null; try { x = quitar ? null : promoDe(r.fd); } catch (e) { x = null; }
  const b = $('#pr-prev'); if (b) b.innerHTML = quitar ? '<span class="muted">Se quita la promo de los productos elegidos.</span>' : prevPromo(x);
  avisar(quitar ? null : x);
});
on('pr-atajo', d => {
  const a = ATAJOS[+d.i]; if (!a) return; const x = { ...a[1] };
  if (x.tipo === 'nx') { const u = precio(); x.valor = u > 0 ? Math.floor(x.desde * u * 0.9 / 100) * 100 : ''; }
  const t = $('#pr-t'), n = $('#pr-d'), v = $('#pr-v'); if (!t || !n || !v) return;
  t.value = x.tipo; n.value = x.desde; v.value = x.valor;
  const q = document.querySelector('input[name=prm_modo][value=poner]'); if (q) q.checked = true;
  t.dispatchEvent(new Event('change', { bubbles: true }));
  if (x.tipo === 'nx') { v.focus(); v.select(); }
});
