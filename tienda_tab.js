// Pestaña Tienda (v2.26): una sección a la vez (Estilo · Portada · Secciones · Promociones · Envíos y pagos · Cierre),
// cada una con una frase de qué es y una ayuda corta, y la vista previa de la tienda real al costado (o con
// "👁 Ver cómo queda" en el celular). "📋 Todo junto" muestra todo como antes.
import { api } from './api.js';
import { esc, on, toast, store } from './util.js';
import { P } from './state.js';
import { estiloCampos, estiloSucio, borradorEstilo, estiloAviso, resetEstilo } from './ajustes.js';
import { vistaEnviosSec, vistaDisenoSec, disenoCambio, estiloDisenoSucio, lookLimpio, colorTema, resetColor, borradorEnvios, enviosSucio, borradorDiseno } from './diseno.js';
import { cierreCard } from './cierre.js';
import { vistaPromos } from './promos_hub.js';
import { mostrarPrevia, previaSync, previaIr, previaFoco, usarBorrador, docked } from './vista_previa.js';
import { vistaSimple } from './vista.js';
import { asisOn } from './asistente.js';

export const SECS = [
  ['estilo', '🎨', 'Estilo', 'Cómo se ve tu tienda: nombre, logo, colores y botones.', ['Elegí la paleta que va con lo que vendés (o “Otro color”).', 'Subí tu logo y escribí una frase corta.', 'Mirá cómo queda en la vista previa y tocá “Guardar estilo”.']],
  ['portada', '🏠', 'Portada', 'Lo primero que ven al entrar: anuncios, banners, rubros y carruseles.', ['Escribí un anuncio corto (envíos, horarios o una promo).', 'Subí 1 o 2 banners con una frase y a dónde lleva el botón.', 'Si tenés muchas categorías, agrupalas en rubros.']],
  ['secciones', '🧩', 'Secciones', 'Bloques que dan confianza: beneficios, cómo comprar, preguntas, opiniones y la ventana de bienvenida.', ['Poné 3 o 4 beneficios (envíos, cambios, pagos).', 'Cargá las preguntas sugeridas y ajustalas a tu negocio.', 'Si querés, una ventana de bienvenida con un cupón.']],
  ['promos', '🎁', 'Promociones', 'Descuentos que tu tienda aplica sola: 3x2, 2da al 50 %, precio fijo, cupones y descuento por monto.', ['Elegí una tarjeta (por ejemplo “2da unidad con descuento”).', 'Decí a qué productos se aplica y hasta cuándo.', 'Mirá el ejemplo “Cómo lo ve tu cliente” y creala: queda prendida.']],
  ['envios', '🚚', 'Envíos y pagos', 'Cómo recibe el pedido, cómo paga, qué datos le pedís y desde cuánto el envío es gratis.', ['Agregá cómo entregás (retiro, moto, correo).', 'Tildá los medios de pago que aceptás.', 'Si querés, “Envío gratis desde $”: el carrito le muestra cuánto le falta.']],
  ['cierre', '⏰', 'Cierre de pedidos', 'Si trabajás por tandas: hasta cuándo se puede pedir y qué pasa después.', ['Elegí el día y la hora de cierre.', 'Decidí si al cerrar se pausa o sigue para la próxima tanda.', 'Tus clientes ven la cuenta regresiva arriba de la tienda.']],
];
// a dónde va la vista previa al abrir cada sección
const IR = { estilo: ['inicio', 'estilo'], portada: ['inicio', 'banners'], secciones: ['inicio', 'faq'], promos: ['producto'], envios: ['checkout'], cierre: ['inicio', 'cierre'], todo: ['inicio'] };
const SIMPLE = ['estilo', 'portada', 'promos', 'envios'];
const TT = { sec: null, mas: false };
const secAct = () => { if (!TT.sec) { const g = store.get('tt:sec', 'estilo'); TT.sec = SECS.some(s => s[0] === g) || g === 'todo' ? g : 'estilo'; } return TT.sec; };
const sucio = { estilo: () => estiloSucio() || estiloDisenoSucio(), portada: () => disenoCambio('portada'), secciones: () => disenoCambio('secciones'), envios: enviosSucio };
const algoSucio = () => Object.values(sucio).some(f => { try { return f(); } catch (e) { return false; } });
export const resetTT = () => { TT.mas = false; };

export function vistaTiendaTab() {
  const s = secAct(), simple = vistaSimple() && !TT.mas;
  const ver = SECS.filter(([k]) => !simple || SIMPLE.includes(k) || k === s || (k === 'cierre' && P.t.cierre_at));
  const dot = k => { try { return sucio[k] && sucio[k]() ? '<span class="tt-dot" title="Cambios sin guardar" aria-label="(cambios sin guardar)"></span>' : ''; } catch (e) { return ''; } };
  const chips = ver.map(([k, i, n]) => `<button type="button" role="tab" class="tt-chip${s === k ? ' on' : ''}" data-act="tt-sec" data-k="${k}" aria-selected="${s === k}">${i} ${n}${dot(k)}</button>`).join('')
    + (simple ? '<button type="button" class="tt-chip" data-act="tt-mas">＋ Más</button>' : `<button type="button" role="tab" class="tt-chip tt-todo${s === 'todo' ? ' on' : ''}" data-act="tt-sec" data-k="todo" aria-selected="${s === 'todo'}">📋 Todo junto</button>`);
  const S_ = SECS.find(x => x[0] === s), visto = store.get('tt:visto:' + s, false);
  const intro = S_ ? `<div class="tt-intro"><p><b>${S_[1]} ${S_[2]}</b> · ${esc(S_[3])}</p><details class="tt-como"${asisOn() && !visto ? ' open' : ''}><summary>💡 Cómo se usa</summary><ol>${S_[4].map(x => `<li>${esc(x)}</li>`).join('')}</ol></details></div>`
    : '<div class="tt-intro"><p><b>📋 Todo junto</b> · todas las secciones, una abajo de la otra.</p></div>';
  if (S_ && !visto) store.set('tt:visto:' + s, true);
  const cuerpo = s === 'todo' ? SECS.map(([k]) => seccion(k)).join('') : seccion(s);
  return `<div class="tt" id="tt"><div class="tt-menu" role="tablist" aria-label="Secciones de tu tienda">${chips}</div>${intro}${cuerpo}${docked() ? '' : '<button type="button" class="vp-fab" data-act="vp-abrir">👁 Ver cómo queda</button>'}</div>`;
}
function seccion(k) {
  if (k === 'estilo') return `<div class="tt-uno"><div class="cc" data-prev="estilo"><h3>🎨 Estilo</h3>${estiloCampos()}${vistaDisenoSec('estilo')}<button class="btn btn-p" data-act="tt-estilo">Guardar estilo</button></div></div>`;
  if (k === 'portada' || k === 'secciones') return vistaDisenoSec(k);
  if (k === 'promos') return vistaPromos();
  if (k === 'envios') return vistaEnviosSec();
  if (k === 'cierre') return `<div class="tt-uno" data-prev="cierre">${cierreCard()}</div>`;
  return '';
}
// después de cada repintado del panel: la vista previa se muestra solo en esta pestaña y recibe lo que se está editando
export function trasPintarTienda() {
  mostrarPrevia(P.tab === 'tienda' && !P.modal);
  if (P.tab === 'tienda') previaSync();
}
export function irSeccion(k) { P.tab = 'tienda'; P.modal = null; TT.sec = k; store.set('tt:sec', k); P.repintar(); window.scrollTo(0, 0); const ir = IR[k]; if (ir) { previaIr(ir[0]); if (ir[1]) previaFoco(ir[1]); } }
usarBorrador(() => P.t && P.tab === 'tienda' ? { tienda: Object.assign({}, borradorEstilo(), borradorDiseno(), borradorEnvios()), sucio: algoSucio() } : null);

on('tt-sec', d => irSeccion(d.k));
on('tt-mas', () => { TT.mas = true; P.repintar(); });
on('tt-estilo', async (d, b) => {
  const c = Object.assign(borradorEstilo(), colorTema()), lk = lookLimpio(), dz = Object.assign({}, P.t.diseno || {});
  if (lk) dz.look = lk; else delete dz.look; c.diseno = dz;
  b.disabled = true;
  try { P.t = await api.guardarTienda(P.t.id, c) || P.t; resetEstilo(); resetColor(); estiloAviso('¡Estilo guardado! Ya lo ven tus clientes.'); toast('Estilo guardado'); }
  catch (e) { estiloAviso('', e.message); }
  P.repintar(); window.scrollTo(0, 0);
});
// la vista previa va sola a la parte que estás tocando, y se actualiza mientras escribís
document.addEventListener('focusin', e => { if (P.tab !== 'tienda' || !e.target.closest) return; const f = e.target.closest('#tt [data-prev]'); if (f) previaFoco(f.dataset.prev); });
['input', 'change'].forEach(ev => document.addEventListener(ev, e => { if (P.tab === 'tienda' && e.target.closest && e.target.closest('#tt')) previaSync(); }));
