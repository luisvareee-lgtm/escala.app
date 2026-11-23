// Panel (v2.26): la vista previa es TU tienda real (con tus productos, precios y promos), al costado en la compu o en
// pantalla completa en el celular ("👁 Ver cómo queda"). Muestra lo que estás editando antes de guardar, se puede
// recorrer (Inicio · Categoría · Producto · Carrito · Pagar) y va sola a la parte que estás tocando.
// Vive fuera de #root para no recargarse cada vez que el panel se repinta.
import { on } from './util.js';
import { P } from './state.js';

const V = { host: null, lista: false, cola: {}, disp: 'cel', abierta: false, ultimo: '', foco: '', t: null };
export const docked = () => window.innerWidth >= 1280;
let fuente = () => null;   // la pone la pestaña Tienda: { tienda: {...borrador}, sucio: bool }
export const usarBorrador = fn => { fuente = fn; };
const IR = [['inicio', '🏠 Inicio'], ['categoria', '🏷️ Categoría'], ['producto', '👟 Producto'], ['carrito', '🛒 Carrito'], ['checkout', '💳 Pagar']];

function crear() {
  if (V.host) return V.host;
  const h = document.createElement('aside'); h.id = 'vp'; h.className = 'vp'; h.hidden = true; h.setAttribute('aria-label', 'Vista previa de tu tienda');
  h.innerHTML = `<div class="vp-bar"><b>👁 Cómo lo ve tu cliente</b><span class="vp-sin" id="vp-sin" hidden>con cambios sin guardar</span><button type="button" class="vp-x" data-act="vp-cerrar" aria-label="Cerrar la vista previa">✕</button></div>
    <div class="vp-nav" role="group" aria-label="Ir a una pantalla de tu tienda">${IR.map(([k, n]) => `<button type="button" data-act="vp-ir" data-v="${k}">${n}</button>`).join('')}</div>
    <div class="vp-herr"><div class="seg" role="group" aria-label="Dispositivo"><button type="button" data-act="vp-disp" data-v="cel" class="on" aria-pressed="true">📱 Celular</button><button type="button" data-act="vp-disp" data-v="pc" aria-pressed="false">💻 Compu</button></div><button type="button" class="btn btn-s btn-sm" data-act="vp-recargar" title="Volver a cargar">↻ Recargar</button></div>
    <div class="vp-marco cel" id="vp-marco"><iframe id="vp-if" title="Vista previa de tu tienda"></iframe></div>`;
  document.body.appendChild(h);
  window.addEventListener('message', e => {
    if (e.origin !== location.origin || !V.host || e.source !== frame().contentWindow) return;
    if (e.data && e.data.t === 'eskalapp-previa-lista') { V.lista = true; V.ultimo = ''; previaSync(true); vaciar(); }
  });
  window.addEventListener('resize', () => { clearTimeout(V.rz); V.rz = setTimeout(() => { if (!V.host.hidden || V.mostrar) mostrarPrevia(V.mostrar); escala(); }, 150); });
  V.host = h; return h;
}
const frame = () => V.host && V.host.querySelector('#vp-if');
function cargar() {
  const f = frame(); if (!f || !P.t) return;
  const src = `/t/${encodeURIComponent(P.t.slug)}?vista=previa`;
  if (f.getAttribute('src') !== src) { V.lista = false; f.setAttribute('src', src); }
}
function enviar(m) {
  if (!V.lista) { Object.assign(V.cola, m); return; }
  try { frame().contentWindow.postMessage(Object.assign({ t: 'eskalapp-previa' }, m), location.origin); } catch (e) { }
}
function vaciar() { const c = V.cola; V.cola = {}; if (Object.keys(c).length) enviar(c); }
// el modo compu: la tienda a 1200 px de ancho, achicada para que entre
function escala() {
  const f = frame(), m = V.host && V.host.querySelector('#vp-marco'); if (!f || !m) return;
  m.className = 'vp-marco ' + V.disp;
  if (V.disp === 'pc') { const k = Math.min(1, m.clientWidth / 1200); f.style.width = '1200px'; f.style.height = Math.round(m.clientHeight / k) + 'px'; f.style.transform = `scale(${k})`; }
  else { f.style.width = ''; f.style.height = ''; f.style.transform = ''; }
}
// se muestra solo en la pestaña Tienda: al costado si la pantalla es ancha; si no, con el botón "Ver cómo queda"
export function mostrarPrevia(si) {
  V.mostrar = !!si; crear();
  const dock = si && docked(), full = si && !dock && V.abierta;
  V.host.hidden = !(dock || full);
  V.host.classList.toggle('full', !!full);
  document.body.classList.toggle('vp-dock', !!dock);
  document.body.classList.toggle('vp-full', !!full);
  if (dock || full) { cargar(); escala(); }
}
// manda el borrador (lo que se está editando) solo si cambió
export function previaSync(forzar) {
  if (!V.host) return;
  clearTimeout(V.t);
  V.t = setTimeout(() => {
    const b = fuente(); if (!b) return;
    const j = JSON.stringify(b.tienda);
    const sin = V.host.querySelector('#vp-sin'); if (sin) sin.hidden = !b.sucio;
    if (!forzar && j === V.ultimo) return;
    V.ultimo = j; V.foco = ''; enviar({ tienda: b.tienda });   // cambió la tienda: el próximo toque vuelve a ir a su parte
  }, forzar ? 0 : 200);
}
export const previaIr = v => enviar({ ir: v });
export function previaFoco(k) { if (!k || k === V.foco) return; V.foco = k; enviar({ foco: k }); setTimeout(() => { if (V.foco === k) V.foco = ''; }, 700); }
export const previaRecargar = ir => enviar(ir ? { recargar: true, ir } : { recargar: true });   // con ir: va a esa pantalla después de recargar
export const previaAbierta = () => V.abierta;
on('vp-ir', d => previaIr(d.v));
on('vp-disp', d => { V.disp = d.v; V.host.querySelectorAll('[data-act=vp-disp]').forEach(b => { b.classList.toggle('on', b.dataset.v === d.v); b.setAttribute('aria-pressed', b.dataset.v === d.v); }); escala(); });
on('vp-recargar', () => { const f = frame(); if (f) { V.lista = false; V.ultimo = ''; f.src = f.getAttribute('src'); } });
on('vp-abrir', () => { V.abierta = true; mostrarPrevia(true); previaSync(true); });
on('vp-cerrar', () => { V.abierta = false; mostrarPrevia(V.mostrar); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && V.abierta && V.host && !V.host.hidden) { V.abierta = false; mostrarPrevia(V.mostrar); } });
