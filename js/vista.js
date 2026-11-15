// Vista simple del panel (v2.23): muestra solo lo esencial según cómo vendés (minorista, mayorista o híbrido).
// Las herramientas avanzadas no se borran ni se apagan: quedan a un toque con "Ver todas las herramientas".
// Se recuerda en cada dispositivo (podés tener el celular en simple y la compu en completa).
import { store, on, toast } from './util.js';
import { P } from './state.js';

const k = () => 'vista:' + (P.t && P.t.id);
const elegida = () => store.get(k(), '');
export const vistaSimple = () => elegida() === 'simple';

// Secciones que la vista simple esconde. Nunca esconde algo que el comercio ya usa (revendedores cargados).
export function ocultasSimple(t = P.t) {
  const o = ['precios', 'resultado', 'carritos'];
  if (!(P.revs && P.revs.length)) o.push('equipo');
  if (t && t.modalidad === 'minorista') o.push('asistente');   // cobranzas y seguimiento: pensados para venta por mayor
  return o;
}
// ¿Se muestra esta sección? (la que está abierta siempre se muestra, por ejemplo si llegaste desde un aviso)
export const seMuestra = key => !vistaSimple() || !ocultasSimple().includes(key) || key === P.tab;

const QUE = { minorista: 'Inicio, productos, pedidos, tu tienda y ajustes', mayorista: 'Inicio, productos, pedidos, cobranzas y seguimiento de clientes, tu tienda y ajustes', hibrido: 'Inicio, productos, pedidos, cobranzas y seguimiento de clientes, tu tienda y ajustes' };
export function vistaCard() {
  const s = vistaSimple();
  return `<div class="cc vista-card" id="vista-card"><h3>👁️ Vista del panel</h3>
    <div class="seg" role="group" aria-label="Vista del panel"><button class="${s ? 'on' : ''}" data-act="vista-set" data-v="simple" aria-pressed="${s}">Simple</button><button class="${s ? '' : 'on'}" data-act="vista-set" data-v="completa" aria-pressed="${!s}">Completa</button></div>
    <p class="hint" style="margin-top:8px">${s ? `Ves solo lo esencial: ${QUE[P.t.modalidad] || QUE.minorista}. Las opciones avanzadas de esta pantalla están en “⚙️ Mostrar opciones avanzadas”.` : 'Ves todas las herramientas: precios inteligentes, resultado, revendedores, carritos e integraciones.'} Se recuerda en este dispositivo.</p></div>`;
}

// Sugerencia en el Inicio para quien recién empieza (una sola vez).
const tipK = () => 'vista-tip:' + (P.t && P.t.id);
export function tipVistaHtml() {
  const t = P.t; if (!t || elegida() || store.get(tipK(), false)) return '';
  if (!t.created_at || Date.now() - new Date(t.created_at) > 14 * 864e5) return '';
  return `<div class="vista-tip" id="vista-tip"><span>👁️ ¿Muchas opciones? Probá la <b>vista simple</b>: solo lo esencial para ${t.modalidad === 'minorista' ? 'vender' : 'vender por mayor'}. Lo demás queda a un toque.</span><span class="vista-tip-acc"><button class="btn btn-p btn-sm" data-act="vista-set" data-v="simple">Probar</button><button class="linkb" data-act="vista-tip-x">No, gracias</button></span></div>`;
}

// Opciones avanzadas dentro de un formulario: en vista simple quedan plegadas (igual se guardan).
export const avanzadas = (html, titulo = '⚙️ Mostrar opciones avanzadas e integraciones') => html && vistaSimple() ? `<details class="aj-avz"><summary>${titulo}</summary><div class="aj-avz-in">${html}</div></details>` : html;

on('vista-set', d => {
  store.set(k(), d.v === 'simple' ? 'simple' : 'completa'); store.set(tipK(), true);
  if (P.modal && P.modal.tipo === 'mas') P.modal = null;
  toast(d.v === 'simple' ? '👁️ Vista simple: solo lo esencial' : '👁️ Vista completa: todas las herramientas');
  P.repintar();
});
on('vista-tip-x', () => { store.set(tipK(), true); P.repintar(); });
