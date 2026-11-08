export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
export const slugify = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
export const soloDigitos = s => String(s || '').replace(/\D/g, '');
// Argentina: 10 dígitos locales -> 549 + número
// WhatsApp argentino → formato internacional 549 + área + número (sin 0 ni 15).
// "11 2345-6789", "011 15 2345-6789", "+54 9 11 2345 6789", "3764 15 123456" → 5491123456789 / 5493764123456
export function normWsp(w) {
  let d = soloDigitos(w);
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = d.slice(1);   // 00 = internacional, 0 = interurbano
  const intl = d.startsWith('54');
  if (!intl && d.length > 12) return d;              // número de otro país con su código
  if (intl) d = d.slice(2);
  if (d.startsWith('9') && d.length === 11) d = d.slice(1);
  if (d.length === 12) for (const a of [2, 3, 4]) if (d.substr(a, 2) === '15') { d = d.slice(0, a) + d.slice(a + 2); break; }
  if (d.length === 10) return '549' + d;
  return (intl ? '54' : '') + d;                      // no lo pudimos normalizar: queda como vino
}
export const waLink = (num, text) => 'https://api.whatsapp.com/send?phone=' + num + '&text=' + encodeURIComponent(text);

let tt;
export function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.className = 'show'; clearTimeout(tt); tt = setTimeout(() => { t.className = ''; }, 2600);
}
export function copiar(txt) {
  try { navigator.clipboard.writeText(txt).then(() => toast('Copiado ✓'), () => toast('Seleccioná el texto y copialo')); }
  catch (e) { toast('Seleccioná el texto y copialo'); }
}

/* Eventos por atributos (sin onclick inline): data-act, data-input, data-submit */
const acts = {};
export const on = (nombre, fn) => { acts[nombre] = fn; };
document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && acts[b.dataset.act]) acts[b.dataset.act](b.dataset, b, e); });
// Teclado: Enter / Espacio activan los elementos con role=button (filas, leyendas)
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role=button][data-act]')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('input', e => { const b = e.target.closest('[data-input]'); if (b && acts[b.dataset.input]) acts[b.dataset.input](b.dataset, b, e); });
document.addEventListener('change', e => { const b = e.target.closest('[data-change]'); if (b && acts[b.dataset.change]) acts[b.dataset.change](b.dataset, b, e); });
document.addEventListener('submit', e => { const f = e.target.closest('[data-submit]'); if (f) { e.preventDefault(); if (acts[f.dataset.submit]) acts[f.dataset.submit](f.dataset, f, e); } });

export const store = {  // localStorage seguro
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
};
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// Confirmación en dos toques para acciones que no se pueden deshacer (el visor no permite confirm()).
export function confirmar(btn, texto) {
  if (btn.dataset.seguro === '1') return true;
  btn.dataset.seguro = '1'; btn.classList.add('confirmando'); btn.dataset.orig = btn.textContent; btn.textContent = texto || '¿Seguro? Tocá de nuevo para confirmar';
  setTimeout(() => { if (btn.isConnected) { btn.dataset.seguro = ''; btn.classList.remove('confirmando'); btn.textContent = btn.dataset.orig; } }, 4000);
  return false;
}
