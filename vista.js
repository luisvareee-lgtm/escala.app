// Vista simple del panel (v2.23 · v2.33): 5 secciones esenciales (Resumen, Productos, Pedidos, Tienda y Ajustes).
// Las herramientas avanzadas no se borran ni se apagan: quedan a un toque en "＋ Más herramientas".
// Se recuerda en cada dispositivo (podés tener el celular en simple y la compu en completa).
// v2.33: las tiendas nuevas arrancan en simple; las que ya existían siguen como estaban hasta que elijan.
// Regla permanente (anti-bloat): no se agregan pestañas de primer nivel. Lo nuevo va dentro de lo que ya existe
// (fichas y flyers con IA en Productos, estadísticas en Resumen, GA4 en Ajustes → opciones avanzadas, auditor en Asistente).
import { store, on, toast } from './util.js';
import { P } from './state.js';

const k = () => 'vista:' + (P.t && P.t.id);
const DISP = 'vista:dispositivo';   // la última vista elegida en este dispositivo (para las tiendas que todavía no eligieron)
const CORTE = Date.parse('2026-11-22T00:00:00-03:00');   // tiendas creadas desde la v2.33
const elegida = () => store.get(k(), '') || store.get(DISP, '');
const nueva = t => !!(t && t.created_at && Date.parse(t.created_at) >= CORTE);
export const vistaSimple = () => { const e = elegida(); return e ? e === 'simple' : nueva(P.t); };

// Secciones que la vista simple esconde. Nunca esconde algo que el comercio ya usa
// (presupuestos creados, movimientos de caja, revendedores, proveedores o clientes en seguimiento).
export function ocultasSimple() {
  const u = P.uso || {}, o = [];
  if (!u.presupuestos) o.push('presupuestos');
  if (!u.gastos) o.push('caja');
  if (!u.seguimiento) o.push('asistente');
  if (!(P.provs && P.provs.length)) o.push('precios');
  o.push('resultado');
  if (!(P.revs && P.revs.length)) o.push('equipo');
  o.push('carritos');
  return o;
}
// ¿Se muestra esta sección? (la que está abierta siempre se muestra, por ejemplo si llegaste desde un aviso)
export const seMuestra = key => !vistaSimple() || !ocultasSimple().includes(key) || key === P.tab;
// Lo que "＋ Más herramientas" ofrece abrir (lo escondido que no está abierto ahora)
export const escondidas = () => vistaSimple() ? ocultasSimple().filter(x => x !== P.tab) : [];

export function vistaCard() {
  const s = vistaSimple();
  return `<div class="cc vista-card" id="vista-card"><h3>👁️ Vista del panel</h3>
    <div class="seg" role="group" aria-label="Vista del panel"><button class="${s ? 'on' : ''}" data-act="vista-set" data-v="simple" aria-pressed="${s}">Simple</button><button class="${s ? '' : 'on'}" data-act="vista-set" data-v="completa" aria-pressed="${!s}">Completa</button></div>
    <p class="hint" style="margin-top:8px">${s ? 'Ves lo esencial: Resumen, Productos, Pedidos, Tienda y Ajustes. Caja, Presupuestos, Asistente, Resultado y Revendedores están en “＋ Más herramientas”, y las opciones avanzadas de cada pantalla en “⚙️ Mostrar opciones avanzadas”.' : 'Ves todas las herramientas: presupuestos, caja, asistente, precios inteligentes, resultado, revendedores, carritos e integraciones.'} Se recuerda en este dispositivo.</p></div>`;
}

// Aviso suave en el Resumen: estás en la vista esencial y lo demás está a un toque (se descarta una vez).
const tipK = () => 'vista-tip:' + (P.t && P.t.id);
export function tipVistaHtml() {
  if (!P.t || !vistaSimple() || store.get(tipK(), false)) return '';
  return `<div class="vista-tip" id="vista-tip"><span>👁️ Estás en la <b>vista esencial</b>: Resumen, Productos, Pedidos, Tienda y Ajustes. Caja, Presupuestos, Asistente, Resultado y Revendedores están a un toque en <b>＋ Más herramientas</b>.</span><span class="vista-tip-acc"><button class="btn btn-s btn-sm" data-act="vista-tip-x">Entendido</button></span></div>`;
}

// Opciones avanzadas dentro de un formulario: en vista simple quedan plegadas (igual se guardan).
// forzar: plegarlas también en la vista completa (por ejemplo, integraciones que el plan no incluye).
export const avanzadas = (html, titulo = '⚙️ Mostrar opciones avanzadas e integraciones', forzar = false) => html && (forzar || vistaSimple()) ? `<details class="aj-avz"><summary>${titulo}</summary><div class="aj-avz-in">${html}</div></details>` : html;

on('vista-set', d => {
  const v = d.v === 'simple' ? 'simple' : 'completa';
  store.set(k(), v); store.set(DISP, v); store.set(tipK(), true);
  if (P.modal && (P.modal.tipo === 'mas' || P.modal.tipo === 'herr')) P.modal = null;
  toast(v === 'simple' ? '👁️ Vista simple: solo lo esencial' : '👁️ Vista completa: todas las herramientas');
  P.repintar();
});
on('vista-tip-x', () => { store.set(tipK(), true); P.repintar(); });
