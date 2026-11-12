// Cuenta regresiva del cierre de pedidos: la tira que se ve arriba de la tienda (y su vista previa en el panel).
// Un solo reloj para toda la página, alineado al segundo: actualiza cada [data-cd-at] y cada [data-cd-corto],
// se apaga solo cuando no queda ninguno y, al llegar a cero, avisa con el evento "cuenta-fin".
import { esc } from './util.js';

const d2 = n => String(n).padStart(2, '0');
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export function partes(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return { d: Math.floor(s / 86400), h: Math.floor(s % 86400 / 3600), m: Math.floor(s % 3600 / 60), s: s % 60, total: s }; }
// "1 día y 5 h" · "5 h y 12 min" · "12 min y 30 s"
export function faltaCorto(ms) {
  const p = partes(ms);
  return p.d ? `${p.d} ${p.d === 1 ? 'día' : 'días'} y ${p.h} h` : p.h ? `${p.h} h y ${p.m} min` : `${p.m} min y ${p.s} s`;
}
// "hoy a las 18:00 h" · "mañana a las 18:00 h" · "el viernes 14/11 a las 18:00 h" (hora del que mira)
export function cuandoTxt(at) {
  const d = new Date(at), hoy = new Date(), man = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
  const igual = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const dia = igual(d, hoy) ? 'hoy' : igual(d, man) ? 'mañana' : `el ${DIAS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
  return `${dia} a las ${d2(d.getHours())}:${d2(d.getMinutes())} h`;
}

const UNI = [['d', 'día', 'días'], ['h', 'hora', 'horas'], ['m', 'min', 'min'], ['s', 'seg', 'seg']];
function relojHtml(at) {
  const p = partes(at - Date.now());
  return `<div class="cd" id="cierre-t" data-cd-at="${at}" aria-hidden="true">${UNI.map(([k, uno, varios]) =>
    `<span class="cd-u cd-${k}${k === 'd' && !p.d ? ' cd-off' : ''}"><span class="cd-n">${d2(p[k])}</span><span class="cd-l">${p[k] === 1 ? uno : varios}</span></span>`).join('')}</div>`;
}
// estado: 'abierto' (con reloj) | 'pausa' (no toma pedidos) | 'tanda' (sigue tomando para la próxima)
export function tiraCierreHtml({ at, estado, texto }) {
  if (estado === 'abierto') {
    const urge = at - Date.now() < 3600e3, cuando = esc(cuandoTxt(at));
    programar();
    return `<div class="st-cierre${urge ? ' urge' : ''}" id="st-cierre" role="timer" aria-live="off" aria-label="Esta ronda de pedidos cierra ${cuando}">
      <div class="cd-tx"><span class="cd-ico" aria-hidden="true">⏳</span><span class="cd-t"><span class="cd-t1">Esta ronda de pedidos cierra <b>${cuando}</b></span><span class="cd-t2">¡Últimos minutos! La ronda cierra <b>${cuando}</b></span></span></div>${relojHtml(at)}</div>`;
  }
  const t = String(texto || '').trim();
  return estado === 'pausa'
    ? `<div class="st-cierre cerrado" id="st-cierre" role="status"><div class="cd-tx"><span class="cd-ico" aria-hidden="true">🔒</span><span class="cd-t"><b>Los pedidos de esta ronda ya cerraron.</b> <span class="cd-sub">${t ? esc(t) : 'Volvé a entrar en unos días.'}</span></span></div></div>`
    : `<div class="st-cierre tanda" id="st-cierre" role="status"><div class="cd-tx"><span class="cd-ico" aria-hidden="true">📦</span><span class="cd-t"><b>La ronda cerró: lo que pidas ahora entra en la próxima tanda.</b>${t ? ` <span class="cd-sub">${esc(t)}</span>` : ''}</span></div></div>`;
}

/* ---------- el reloj ---------- */
let corriendo = false, vacios = 0;
function poner(u, n, uno, varios) {
  const num = u.querySelector('.cd-n'), txt = d2(n);
  if (num.textContent !== txt) { num.textContent = txt; num.classList.remove('tic'); void num.offsetWidth; num.classList.add('tic'); }
  const l = u.querySelector('.cd-l'), lt = n === 1 ? uno : varios; if (l.textContent !== lt) l.textContent = lt;
}
function tick() {
  const relojes = document.querySelectorAll('[data-cd-at]'), cortos = document.querySelectorAll('[data-cd-corto]');
  if (!relojes.length && !cortos.length) return ++vacios < 3;     // sigue un par de vueltas por si la pantalla se está armando
  vacios = 0; const ahora = Date.now();
  relojes.forEach(el => {
    const at = +el.dataset.cdAt, p = partes(at - ahora);
    UNI.forEach(([k, uno, varios]) => { const u = el.querySelector('.cd-' + k); if (u) poner(u, p[k], uno, varios); });
    const dd = el.querySelector('.cd-d'); if (dd) dd.classList.toggle('cd-off', !p.d);
    const tira = el.closest('.st-cierre'); if (tira) tira.classList.toggle('urge', p.total < 3600);
    if (p.total <= 0 && !el.dataset.fin) { el.dataset.fin = '1'; el.dispatchEvent(new CustomEvent('cuenta-fin', { bubbles: true })); }
  });
  cortos.forEach(el => { const t = faltaCorto(+el.dataset.cdCorto - ahora); if (el.textContent !== t) el.textContent = t; });
  return true;
}
// la próxima vuelta cae justo después de que cambia el segundo que falta (no el del reloj de la compu)
function espera() { const el = document.querySelector('[data-cd-at],[data-cd-corto]'), at = el ? +(el.dataset.cdAt || el.dataset.cdCorto) : 0, r = at - Date.now(); return r > 0 ? r % 1000 + 20 : 1000; }
function vuelta() { if (!tick()) { corriendo = false; return; } setTimeout(vuelta, espera()); }
export function programar() { vacios = 0; if (!corriendo) { corriendo = true; setTimeout(vuelta, 0); } }
