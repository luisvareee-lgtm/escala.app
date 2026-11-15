// Seguimiento de clientes (v2.23): quién te compra seguido, quién dejó de comprar y hace cuánto,
// con un toque para escribirle por WhatsApp. Se arma con tus pedidos; no hace falta cargar nada.
import { api } from './api.js';
import { esc, fmt, on, toast, normWsp, waLink, store, soloDigitos } from './util.js';
import { P, can } from './state.js';
import { aCsv, bajar } from './planes.js';
import { urlTiendaDe } from './marca.js';

const DIA = 864e5;
const UMBRALES = [7, 15, 30, 60, 90];
const S = { umbral: 30, orden: 'valor', q: '', lim: 40, contactos: null, cargando: false };
export const resetSeg = () => Object.assign(S, { umbral: 30, orden: 'valor', q: '', lim: 40, contactos: null, cargando: false });

const clave = o => normWsp(o.cliente_whatsapp) || soloDigitos(o.cliente_whatsapp);
// Un cliente = un WhatsApp. Los pedidos cancelados no cuentan.
export function calcClientes(pedidos) {
  const m = new Map();
  for (const o of pedidos || []) {
    if (o.estado === 'cancelado' || o.etapa === 'cancelado') continue;
    const k = clave(o); if (!k) continue;
    const t = +new Date(o.created_at);
    const c = m.get(k) || { wsp: k, nombre: o.cliente_nombre, pedidos: 0, total: 0, primero: t, ultimo: t, ultimoId: o.id, dias_: [] };
    c.pedidos++; c.total += Number(o.total_ars) || 0; c.dias_.push(Math.floor(t / DIA));
    if (t >= c.ultimo) { c.ultimo = t; c.ultimoId = o.id; if (o.cliente_nombre) c.nombre = o.cliente_nombre; }
    if (t < c.primero) c.primero = t;
    m.set(k, c);
  }
  const ahora = Date.now();
  return [...m.values()].map(c => {
    const d = [...new Set(c.dias_)].sort((a, b) => a - b); delete c.dias_;
    c.dias = Math.max(0, Math.floor((ahora - c.ultimo) / DIA));
    c.ticket = c.total / c.pedidos;
    c.cada = d.length >= 2 ? Math.max(1, Math.round((d[d.length - 1] - d[0]) / (d.length - 1))) : null;   // cada cuántos días suele comprar
    c.atrasado = c.cada != null && c.dias > Math.max(7, Math.round(c.cada * 1.5));
    return c;
  });
}
export const paraRecuperar = (C, umbral = 30) => C.filter(c => c.dias >= umbral);

async function cargarContactos() {
  if (S.cargando) return; S.cargando = true;
  try { const l = await api.segContactos(); S.contactos = Object.fromEntries((l || []).map(x => [x.wsp, x])); }
  catch (e) { S.contactos = {}; }
  S.cargando = false; if (P.tab === 'asistente' && P.repintar) P.repintar();
}

const MSG_BASE = '¡Hola {nombre}! ¿Cómo estás? Te escribo de {tienda}. Hace un tiempito que no hacés un pedido y quería contarte que tenemos novedades 🙌 Te dejo el catálogo actualizado: {link} ¿Te armo algo?';
const msgKey = () => 'seg-msg:' + (P.t && P.t.id);
const plantilla = () => store.get(msgKey(), '') || MSG_BASE;
export function mensajeCliente(c, tpl = plantilla()) {
  const nombre = String(c.nombre || '').trim().split(/\s+/)[0] || '';
  return tpl.replace(/\{nombre\}/g, nombre).replace(/\{tienda\}/g, P.t.nombre).replace(/\{link\}/g, urlTiendaDe(P.t.slug)).replace(/\{dias\}/g, String(c.dias))
    .replace(/¡Hola !/g, '¡Hola!').replace(/Hola ,/g, 'Hola,');
}
const hace = d => d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
const desde = iso => hace(Math.max(0, Math.floor((Date.now() - new Date(iso)) / DIA)));

export function vistaSeguimiento() {
  if (!can('seguimiento')) return `<div class="locked"><b>👥 Seguimiento de clientes</b><p style="margin:6px 0">Mirá quién dejó de comprarte, hace cuánto y cada cuánto suele pedir. Le escribís por WhatsApp con un toque y queda anotado.</p><span class="tag warn">🔒 Plan Mayorista Pro</span><br><button class="btn btn-p btn-sm lock-cta" data-act="p-planes" data-p="pro">Ver planes y activar</button></div>`;
  if (S.contactos === null) cargarContactos();
  const C = calcClientes(P.pedidos);
  if (!C.length) return `<div class="cc"><h3>👥 Seguimiento de clientes</h3><p class="muted">Cuando entren pedidos, acá vas a ver quién te compra seguido y quién dejó de comprar.</p></div>`;
  const ct = S.contactos || {};
  const rec = C.filter(c => c.pedidos >= 2).length, activos = C.filter(c => c.dias < 30).length, atr = C.filter(c => c.atrasado);
  const base = S.umbral === 'atr' ? atr : paraRecuperar(C, S.umbral);
  const enJuego = base.reduce((a, c) => a + c.ticket, 0);
  const q = S.q.trim().toLowerCase();
  const L = base.filter(c => !q || String(c.nombre).toLowerCase().includes(q) || c.wsp.includes(q.replace(/\D/g, '') || '§'))
    .sort(S.orden === 'dias' ? (a, b) => b.dias - a.dias || b.total - a.total : (a, b) => b.total - a.total || b.dias - a.dias);
  const sem = c => { const u = S.umbral === 'atr' ? 30 : S.umbral; return c.dias < u ? 'v' : c.dias < u * 2 ? 'a' : 'r'; };
  const fila = c => {
    const k = ct[c.wsp];
    return `<div class="cob-row seg-row"><div class="cob-inf"><b>${esc(c.nombre)}</b> <span class="sem sem-${sem(c)}" title="Último pedido"><i aria-hidden="true"></i>${hace(c.dias)}</span>${c.atrasado ? ' <span class="tag warn">⚠️ Atrasado</span>' : ''}
      <div class="muted" style="font-size:.78rem">${c.pedidos} ${c.pedidos === 1 ? 'pedido' : 'pedidos'} · ${fmt(c.total)} en total · ${fmt(c.ticket)} por pedido${c.cada ? ` · suele comprar cada ${c.cada} ${c.cada === 1 ? 'día' : 'días'}` : ''}
      · <button class="linkb" data-act="p-pedido" data-id="${c.ultimoId}">Ver último pedido</button>${k ? ` · <span class="seg-ok">✓ le escribiste ${desde(k.contactado_at)}</span>` : ''}</div></div>
      <div class="cob-acc"><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" data-act="sg-wsp" data-w="${esc(c.wsp)}" href="${esc(waLink(c.wsp, mensajeCliente(c)))}">💬 ${k ? 'Escribir otra vez' : 'Escribirle'}</a></div></div>`;
  };
  const tpl = plantilla();
  return `<div class="kpis seg-kpis"><div class="kpi"><small>Clientes</small><b>${C.length}</b><i>${rec} ${rec === 1 ? 'volvió' : 'volvieron'} a comprar</i></div>
    <div class="kpi"><small>Activos</small><b>${activos}</b><i>compraron en los últimos 30 días</i></div>
    <div class="kpi seg-k-rec"><small>Para recuperar</small><b>${base.length}</b><i>${S.umbral === 'atr' ? 'compran menos seguido que antes' : `sin comprar hace ${S.umbral} días o más`}</i></div>
    <div class="kpi"><small>En juego</small><b>${fmt(enJuego)}</b><i>si cada uno hace un pedido como los suyos</i></div></div>
  <div class="cc"><h3>👥 Seguimiento de clientes</h3>
    <p class="hint" style="margin-bottom:8px">Armado con tus pedidos (un cliente = un WhatsApp). El botón abre WhatsApp con el mensaje listo y anota que le escribiste.</p>
    <div class="ped-filtros seg-filtros" role="group" aria-label="Sin comprar hace"><span class="seg-lbl">Sin comprar hace más de</span>${UMBRALES.map(u => `<button class="chipf ${S.umbral === u ? 'on' : ''}" data-act="sg-umbral" data-u="${u}" aria-pressed="${S.umbral === u}">${u} días <b>${paraRecuperar(C, u).length}</b></button>`).join('')}${atr.length ? `<button class="chipf ${S.umbral === 'atr' ? 'on' : ''}" data-act="sg-umbral" data-u="atr" aria-pressed="${S.umbral === 'atr'}">⚠️ Atrasados <b>${atr.length}</b></button>` : ''}</div>
    <div class="seg-barra"><input class="fi" id="sg-q" placeholder="Buscar cliente o WhatsApp…" data-input="sg-q" value="${esc(S.q)}" aria-label="Buscar cliente">
      <div class="seg" role="group" aria-label="Ordenar"><button class="${S.orden === 'valor' ? 'on' : ''}" data-act="sg-orden" data-o="valor" aria-pressed="${S.orden === 'valor'}">💰 Más compraron</button><button class="${S.orden === 'dias' ? 'on' : ''}" data-act="sg-orden" data-o="dias" aria-pressed="${S.orden === 'dias'}">⏳ Más días sin comprar</button></div></div>
    ${L.slice(0, S.lim).map(fila).join('') || `<p class="ok-box" style="margin-top:8px">${q ? 'Ningún cliente coincide con la búsqueda.' : S.umbral === 'atr' ? 'Nadie está atrasado. 🎉' : `Todos tus clientes compraron en los últimos ${S.umbral} días. 🎉`}</p>`}
    ${L.length > S.lim ? `<button class="btn btn-s btn-sm" data-act="sg-mas">Ver más (${L.length - S.lim})</button>` : ''}
    <details class="seg-msg"><summary>✏️ Cambiar el mensaje de WhatsApp</summary>
      <textarea class="fi" id="sg-msg" rows="4" maxlength="600" data-change="sg-msg" aria-label="Mensaje">${esc(tpl)}</textarea>
      <p class="hint">Se reemplazan solos: <b>{nombre}</b> (el primer nombre), <b>{tienda}</b>, <b>{link}</b> (tu catálogo) y <b>{dias}</b> (días sin comprar). ${tpl !== MSG_BASE ? '<button class="linkb" data-act="sg-msg-base">Volver al mensaje original</button>' : ''}</p></details>
    <div style="margin-top:10px"><button class="btn btn-s btn-sm" data-act="sg-csv">⬇️ Descargar clientes (${C.length})</button></div></div>`;
}

on('sg-umbral', d => { S.umbral = d.u === 'atr' ? 'atr' : Number(d.u); S.lim = 40; P.repintar(); });
on('sg-orden', d => { S.orden = d.o === 'dias' ? 'dias' : 'valor'; P.repintar(); });
on('sg-q', (d, el) => { S.q = el.value; S.lim = 40; P.repintar(); });
on('sg-mas', () => { S.lim += 40; P.repintar(); });
on('sg-msg', (d, el) => { const v = el.value.trim().slice(0, 600); store.set(msgKey(), v && v !== MSG_BASE ? v : ''); toast('Mensaje guardado'); P.repintar(); });
on('sg-msg-base', () => { store.set(msgKey(), ''); P.repintar(); });
on('sg-wsp', async d => {
  const w = d.w, ahora = new Date().toISOString();
  S.contactos = S.contactos || {};
  S.contactos[w] = { wsp: w, contactado_at: ahora, veces: ((S.contactos[w] || {}).veces || 0) + 1 };
  try { await api.segContactado(w); } catch (e) { }
  setTimeout(P.repintar, 300);
});
on('sg-csv', () => {
  const ct = S.contactos || {}, f = new Date().toISOString().slice(0, 10), fe = t => new Date(t).toLocaleDateString('es-AR');
  const C = calcClientes(P.pedidos).sort((a, b) => b.total - a.total);
  bajar(`${P.t.slug}-clientes-${f}.csv`, aCsv(['Cliente', 'WhatsApp', 'Pedidos', 'Total comprado', 'Por pedido', 'Primer pedido', 'Último pedido', 'Días sin comprar', 'Suele comprar cada (días)', 'Atrasado', 'Le escribiste'],
    C.map(c => [c.nombre, c.wsp, c.pedidos, Math.round(c.total), Math.round(c.ticket), fe(c.primero), fe(c.ultimo), c.dias, c.cada == null ? '' : c.cada, c.atrasado ? 'sí' : '', ct[c.wsp] ? fe(ct[c.wsp].contactado_at) : ''])));
  toast('Descargando…');
});
