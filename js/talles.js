// Ropa y calzado (v2.24): talles con un toque, stock por talle en la ficha del producto y guía de talles de la tienda.
import { api } from './api.js';
import { esc, on, toast, $ } from './util.js';
import { P } from './state.js';

export const PRESETS = [
  ['ropa', 'XS a XXL', ['XS', 'S', 'M', 'L', 'XL', 'XXL']],
  ['calzado', 'Calzado 35 al 45', ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']],
  ['ninos', 'Niños 26 al 34', ['26', '27', '28', '29', '30', '31', '32', '33', '34']],
  ['jean', 'Jean 36 al 50', ['36', '38', '40', '42', '44', '46', '48', '50']],
  ['bebe', 'Bebé 0 a 24 m', ['0-3 m', '3-6 m', '6-9 m', '9-12 m', '12-18 m', '18-24 m']],
  ['unico', 'Talle único', ['Único']],
];
export const parseVars = s => [...new Set(String(s || '').split(',').map(x => x.trim()).filter(Boolean))].slice(0, 40);
export const hayTalles = () => (P.prods || []).some(p => 'stock_talles' in p);
const controla = () => (P.t.modo_stock || 'stock') !== 'encargo';
const palabra = v => v.every(x => /^\d+([.,]5)?$/.test(x)) ? 'número' : 'talle';

// Estado del formulario del producto (se guarda en P.modal para no perder lo escrito al cambiar los talles)
export function initTalles(m, p) {
  if (m.vars === undefined) m.vars = Array.isArray(p.variantes) ? p.variantes.slice() : [];
  if (m.tl === undefined) m.tl = p.stock_talles && typeof p.stock_talles === 'object' ? { ...p.stock_talles } : {};
  if (m.porTalle === undefined) m.porTalle = !!p.stock_talles;
}
const suma = m => m.vars.reduce((a, v) => a + (Math.max(0, Math.floor(Number(m.tl[v]) || 0))), 0);
export function tallesHtml(m) {
  const v = m.vars || [];
  if (!v.length || !controla() || (m.combo || []).length) return '';
  const w = palabra(v);
  return `<label class="flabel tl-sw"><input type="checkbox" name="por_talle" data-change="p-portalle" ${m.porTalle ? 'checked' : ''}> Stock por ${w}${v.length === 1 ? '' : ` (${v.length} ${w === 'número' ? 'números' : 'talles'})`}</label>
    ${m.porTalle ? `<div class="tl-grid">${v.map((x, i) => `<label class="tl-c${Number(m.tl[x]) > 0 ? '' : ' cero'}"><span>${esc(x)}</span><input class="fi" type="number" min="0" max="1000000" step="1" inputmode="numeric" name="tl_${i}" value="${m.tl[x] != null && m.tl[x] !== '' ? Number(m.tl[x]) : ''}" placeholder="0" data-input="p-tl" data-i="${i}" aria-label="Stock del ${w} ${esc(x)}"></label>`).join('')}</div>
      <p class="hint" style="margin-top:6px">Stock total: <b id="tl-tot">${suma(m)}</b>. Se descuenta talle por talle cuando cobrás el pedido. Los que quedan en 0 se ven tachados en tu tienda.</p>`
    : '<p class="hint">Tildalo si querés cargar cuántos tenés de cada uno: la tienda tacha los que se agotan y nadie puede pedir más de lo que hay.</p>'}`;
}
// Datos para guardar: stock_talles (o null) y el stock total.
export function tallesDatos(m, fd, datos) {
  const v = datos.variantes || [];
  if (fd.get('por_talle') === 'on' && v.length && controla()) {
    const o = {}; v.forEach((x, i) => { o[x] = Math.max(0, Math.min(1000000, Math.floor(Number(fd.get('tl_' + i)) || 0))); });
    datos.stock_talles = o; datos.stock = Object.values(o).reduce((a, n) => a + n, 0);
  } else if (hayTalles() || (m.p && m.p.stock_talles)) datos.stock_talles = null;
}
// guarda lo escrito en los casilleros (con los talles que se ven ahora) antes de cambiar algo y redibujar
function repintar(cambio) {
  const m = P.modal; if (!m || m.tipo !== 'prod') return;
  document.querySelectorAll('#p-tl [data-input=p-tl]').forEach(el => { const x = (m.vars || [])[+el.dataset.i]; if (x !== undefined) m.tl[x] = el.value; });
  if (cambio) cambio(m);
  const b = $('#p-tl'); if (b) b.innerHTML = tallesHtml(m);
  const st = document.querySelector('form[data-submit=p-prod] [name=stock]');
  if (st && !(m.combo || []).length) {
    const on_ = m.porTalle && m.vars.length && controla();
    st.disabled = !!on_; st.title = on_ ? 'Se calcula solo: es la suma de los talles' : '';
    if (on_) st.value = suma(m);
  }
}
on('p-vars', (d, el) => repintar(m => { m.vars = parseVars(el.value); }));
on('p-talles', d => {
  const m = P.modal, pr = PRESETS.find(x => x[0] === d.v), i = document.querySelector('form[data-submit=p-prod] [name=variantes]');
  if (!m || !pr || !i) return;
  i.value = pr[2].join(', ');
  repintar(m => { m.vars = pr[2].slice(); if (pr[0] !== 'unico' && controla()) m.porTalle = true; }); const f = document.querySelector('#p-tl [data-input=p-tl]'); if (f) f.focus();
});
on('p-portalle', (d, el) => repintar(m => { m.porTalle = el.checked; }));
on('p-tl', (d, el) => {
  const m = P.modal; if (!m) return; const x = m.vars[+d.i]; if (x === undefined) return;
  m.tl[x] = el.value; el.closest('.tl-c').classList.toggle('cero', !(Number(el.value) > 0));
  const t = $('#tl-tot'); if (t) t.textContent = suma(m);
  const st = document.querySelector('form[data-submit=p-prod] [name=stock]'); if (st && st.disabled) st.value = suma(m);
});
export const presetsHtml = () => `<div class="tl-pre"><span>Rápido:</span>${PRESETS.map(([k, n]) => `<button type="button" class="pill" data-act="p-talles" data-v="${k}">${n}</button>`).join('')}</div>`;
export const resumenTalles = p => p.stock_talles && typeof p.stock_talles === 'object'
  ? 'talles ' + Object.entries(p.stock_talles).slice(0, 12).map(([k, n]) => `${k}:${n}`).join(' ') + (Object.keys(p.stock_talles).length > 12 ? '…' : '') : '';

/* ---------- Guía de talles de la tienda (Ajustes) ---------- */
const EJEMPLO = `CALZADO (largo del pie en cm)
35: 22,5 · 36: 23 · 37: 23,5 · 38: 24,5 · 39: 25 · 40: 25,5 · 41: 26,5 · 42: 27 · 43: 27,5 · 44: 28,5

ROPA (contorno en cm)
S: pecho 88-92 · cintura 72-76
M: pecho 96-100 · cintura 80-84
L: pecho 104-108 · cintura 88-92
XL: pecho 112-116 · cintura 96-100

¿Dudas con tu talle? Escribinos por WhatsApp antes de pedir.`;
export function guiaCardHtml() {
  const t = P.t, usa = t.rubro === 'indumentaria' || (P.prods || []).some(p => Array.isArray(p.variantes) && p.variantes.length);
  if (!usa && !t.guia_talles) return '';
  return `<form class="cc" data-submit="p-guia" id="guia-card"><h3>📏 Guía de talles</h3>
    <p class="hint" style="margin-bottom:8px">Tus clientes la ven en la ficha de cada producto con talles. Escribí las medidas como quieras (una por renglón).</p>
    <textarea class="fi" name="guia_talles" rows="6" maxlength="2000" placeholder="Ej: 38: 24,5 cm · 39: 25 cm · 40: 25,5 cm…">${esc(t.guia_talles || '')}</textarea>
    <div class="av-bts" style="margin-top:8px"><button class="btn btn-p btn-sm" type="submit">Guardar guía</button>${t.guia_talles ? '' : '<button class="btn btn-s btn-sm" type="button" data-act="p-guia-ej">Usar un ejemplo</button>'}</div></form>`;
}
on('p-guia-ej', () => { const a = document.querySelector('#guia-card textarea'); if (a) { a.value = EJEMPLO; a.focus(); } });
on('p-guia', async (d, f) => {
  const v = String(new FormData(f).get('guia_talles') || '').trim().slice(0, 2000) || null;
  try { const t = await api.guardarTienda(P.t.id, { guia_talles: v }); if (t) P.t = t; else P.t.guia_talles = v; toast(v ? '📏 Guía de talles guardada' : 'Guía de talles borrada'); P.repintar(); }
  catch (e) { toast(/guia_talles/.test(e.message) ? 'Falta correr la migración v2.24 en Supabase.' : e.message); }
});
