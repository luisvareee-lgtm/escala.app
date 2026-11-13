// Programa Fundadores, "Sugerir una mejora" y la administración de la plataforma.
// La administración solo aparece para quien figure como admin en la base (la base vuelve a comprobarlo en cada acción).
import { esc, on, toast, waLink, confirmar } from './util.js';
import { P, PLAN_NOMBRE } from './state.js';
import { api } from './api.js';
import { urlTiendaDe } from './marca.js';

/* ---------- la prueba: cuántos días quedan y cómo decirlo ---------- */
export const SIN_VENC = 3650;   // más de 10 años = "sin vencimiento" (la base guarda una fecha lejana)
export const diasDe = t => t && t.trial_ends_at ? Math.ceil((new Date(t.trial_ends_at) - Date.now()) / 864e5) : 0;
const fechaLarga = s => new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
// texto del botón de plan arriba del panel
export function chipPlan(t) {
  const d = diasDe(t);
  if (d > SIN_VENC) return t.fundador ? '⭐ Fundador' : 'Prueba sin vencimiento';
  if (d > 0) return (t.fundador ? '⭐ Fundador: ' : 'Prueba: ') + d + ' d';
  return PLAN_NOMBRE[t.plan] || t.plan;
}
// la frase de la prueba en Planes y en Ajustes
export function pruebaFrase(t) {
  const d = diasDe(t); if (d <= 0) return '';
  const cuanto = d > SIN_VENC ? 'tenés todo desbloqueado, sin fecha de vencimiento' : `te ${d === 1 ? 'queda' : 'quedan'} <b>${d} ${d === 1 ? 'día' : 'días'}</b> con todo desbloqueado (hasta el ${esc(fechaLarga(t.trial_ends_at))})`;
  return t.fundador
    ? `⭐ <b>Sos fundador de la plataforma</b>: ${cuanto}. Gracias por ayudarnos a mejorarla: contanos qué te falta con “Sugerir una mejora”. `
    : `Estás en la prueba gratis: ${cuanto}. `;
}

/* ---------- cupos de fundadores (portada y registro) ---------- */
export const cuposHtml = () => '<p class="fund-cupos" id="fund-cupos" hidden></p>';
export async function cargarCupos() {
  const el = document.getElementById('fund-cupos'); if (!el) return;
  try {
    const c = await api.cupos(); if (!c || !(c.quedan > 0)) return;
    const meses = Math.round(c.dias / 30);
    el.innerHTML = `⭐ <b>Programa Fundadores:</b> quedan <b>${c.quedan} de ${c.total}</b> lugares con <b>${meses >= 2 ? meses + ' meses' : c.dias + ' días'} gratis</b> y todo desbloqueado.`;
    el.hidden = false;
  } catch (e) { }   // base sin la v2.17: no se muestra nada
}

/* ---------- "Sugerir una mejora" (cualquier comercio) ---------- */
const SG = { txt: '', enviando: false, ok: false, err: '' };
export function sugerirHtml() {
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="Sugerir una mejora"><div class="view-title">💡 Sugerir una mejora</div>
    ${SG.ok ? `<p class="ok-box">¡Gracias! Leemos todas las sugerencias y nos ayudan a decidir qué hacer primero.</p><button class="btn btn-p" data-act="p-cerrar">Listo</button>`
    : `<p class="hint">¿Qué le falta a tu tienda o qué te costó usar? Contalo como se lo dirías a un amigo: lo lee la persona que arma la plataforma.</p>
    ${SG.err ? `<div class="err-box">${esc(SG.err)}</div>` : ''}
    <form data-submit="sg-enviar"><div class="fg"><label class="flabel" for="sg-t">Tu idea o problema</label><textarea class="fi" id="sg-t" name="texto" rows="5" maxlength="2000" required minlength="3" placeholder="Ej: me gustaría poder hacer cupones de descuento 2x1" data-input="sg-t">${esc(SG.txt)}</textarea></div>
    <div class="stack"><button class="btn btn-p" type="submit" ${SG.enviando ? 'disabled' : ''}>${SG.enviando ? 'Enviando…' : 'Enviar sugerencia'}</button><button type="button" class="btn btn-s" data-act="p-cerrar">Cancelar</button></div></form>`}
  </div></div>`;
}
on('p-sugerir', () => { Object.assign(SG, { txt: '', enviando: false, ok: false, err: '' }); P.modal = { tipo: 'sugerir' }; P.repintar(); setTimeout(() => { const t = document.getElementById('sg-t'); if (t) t.focus(); }, 50); });
on('sg-t', (d, el) => { SG.txt = el.value; });
on('sg-enviar', async (d, f) => {
  SG.txt = new FormData(f).get('texto') || ''; SG.enviando = true; SG.err = ''; P.repintar();
  try { await api.enviarSugerencia(SG.txt); SG.ok = true; }
  catch (e) { SG.err = /enviar_sugerencia|schema cache|does not exist/i.test(e.message) ? 'Esta opción se activa cuando se actualice la plataforma. Mientras tanto, escribinos desde Ayuda.' : e.message; }
  SG.enviando = false; P.repintar();
});

/* ---------- administración de la plataforma ---------- */
const AD = { tiendas: null, sugs: null, cfg: null, err: '', f: 'todas', q: '', cargando: false };
export const resetAdmin = () => Object.assign(AD, { tiendas: null, sugs: null, cfg: null, err: '', f: 'todas', q: '', cargando: false });
export async function esAdmin() { try { return !!(await api.esAdmin()); } catch (e) { return false; } }
async function cargarAdmin() {
  AD.cargando = true; AD.err = '';
  try { [AD.tiendas, AD.sugs, AD.cfg] = await Promise.all([api.adminTiendas(), api.adminSugerencias(), api.cupos()]); }
  catch (e) { AD.err = e.message; }
  AD.cargando = false; P.repintar();
}
const hace = s => {
  if (!s) return 'nunca';
  const d = Math.floor((Date.now() - new Date(s)) / 864e5);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
};
const fechaCorta = s => s ? new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
function estadoDe(x) {
  const d = diasDe(x);
  if (x.suscripcion_estado === 'activa') return ['ok', 'Pagando ' + (PLAN_NOMBRE[x.plan] || x.plan)];
  if (d > SIN_VENC) return ['ok', 'Prueba sin vencimiento'];
  if (d > 0) return ['', `Prueba: ${d} ${d === 1 ? 'día' : 'días'}`];
  return ['warn', `${PLAN_NOMBRE[x.plan] || x.plan} · prueba vencida`];
}
const inactiva = x => !(x.pedidos_30d > 0) && (!x.ultimo_ingreso || Date.now() - new Date(x.ultimo_ingreso) > 14 * 864e5);
const FILTROS = [
  ['todas', 'Todas', () => true],
  ['fundadores', '⭐ Fundadores', x => x.fundador],
  ['prueba', 'En prueba', x => diasDe(x) > 0 && x.suscripcion_estado !== 'activa'],
  ['vencida', 'Prueba vencida', x => diasDe(x) <= 0 && x.suscripcion_estado !== 'activa'],
  ['pagando', 'Pagando', x => x.suscripcion_estado === 'activa'],
  ['sinprod', 'Sin cargar productos', x => (x.productos || 0) <= 4],
  ['inactivas', 'Inactivas', inactiva]
];

export function vistaAdmin() {
  if (!AD.tiendas && !AD.cargando && !AD.err) { cargarAdmin(); }
  if (!AD.tiendas) return `<div class="cc"><h3>🛡️ Administración</h3>${AD.err ? `<div class="err-box">${esc(AD.err)}</div><button class="btn btn-s" data-act="ad-recargar">Reintentar</button>` : '<p class="hint"><span class="spin"></span> Cargando tiendas…</p>'}</div>`;
  const L = AD.tiendas, c = AD.cfg || {}, fund = L.filter(x => x.fundador).length;
  const act7 = L.filter(x => x.ultimo_ingreso && Date.now() - new Date(x.ultimo_ingreso) < 7 * 864e5).length;
  const conPed = L.filter(x => x.pedidos > 0).length, pagan = L.filter(x => x.suscripcion_estado === 'activa').length;
  const fn = (FILTROS.find(f => f[0] === AD.f) || FILTROS[0])[2], q = AD.q.trim().toLowerCase();
  const V = L.filter(fn).filter(x => !q || [x.nombre, x.slug, x.email, x.whatsapp].some(s => String(s || '').toLowerCase().includes(q)));
  const nuevas = (AD.sugs || []).filter(s => s.estado === 'nueva').length;
  return `<div class="cc adm"><div class="adm-top"><h3>🛡️ Administración de la plataforma</h3><button class="btn btn-s btn-sm" data-act="ad-recargar">↻ Actualizar</button></div>
    <p class="hint">Solo vos ves esta sección. Cada acción la vuelve a comprobar la base de datos.</p>
    ${AD.err ? `<div class="err-box">${esc(AD.err)}</div>` : ''}
    <div class="adm-kpis">
      <div><b>${L.length}</b><span>tiendas</span></div>
      <div><b>${fund}</b><span>fundadores${c.total != null ? ` de ${c.total} · quedan ${c.quedan}` : ''}</span></div>
      <div><b>${act7}</b><span>entraron en 7 días</span></div>
      <div><b>${conPed}</b><span>con pedidos</span></div>
      <div><b>${pagan}</b><span>pagando</span></div>
    </div>
    <form data-submit="ad-config" class="adm-cfg"><b>Programa Fundadores</b>
      <label>Lugares<input class="fi" name="cupos" type="number" min="0" max="1000" value="${c.total ?? 20}" required></label>
      <label>Días gratis del fundador<input class="fi" name="dias" type="number" min="1" max="3650" value="${c.dias ?? 180}" required></label>
      <label>Días de la prueba común<input class="fi" name="prueba" type="number" min="1" max="365" value="${c.prueba_dias ?? 7}" required></label>
      <button class="btn btn-p btn-sm" type="submit">Guardar</button></form>
    <p class="hint">Las tiendas nuevas son fundadoras solas mientras queden lugares. Para sumar una tienda que ya existe, tocá “⭐ Hacer fundador” en su ficha.</p>
  </div>
  <div class="cc adm"><div class="adm-filtros">${FILTROS.map(([k, n, f]) => `<button type="button" class="pill ${AD.f === k ? 'on' : ''}" data-act="ad-f" data-k="${k}" aria-pressed="${AD.f === k}">${n} <small>${L.filter(f).length}</small></button>`).join('')}</div>
    <input class="fi" placeholder="Buscar por nombre, enlace, email o WhatsApp" value="${esc(AD.q)}" data-input="ad-q" aria-label="Buscar tiendas" id="ad-q">
    <div class="adm-lista">${V.map(filaTienda).join('') || '<p class="hint">No hay tiendas con ese filtro.</p>'}</div></div>
  <div class="cc adm" id="adm-sugs"><h3>💡 Sugerencias ${nuevas ? `<span class="tag ok">${nuevas} nuevas</span>` : ''}</h3>
    ${(AD.sugs || []).map(filaSug).join('') || '<p class="hint">Todavía no llegó ninguna. Los comercios las mandan desde Ayuda o desde el menú “Más”.</p>'}</div>`;
}
function filaTienda(x) {
  const [tono, est] = estadoDe(x), d = diasDe(x), s = esc(x.slug);
  const wsp = x.whatsapp ? waLink(x.whatsapp, `Hola ${x.nombre}, te escribo de la plataforma de tu tienda.`) : '';
  return `<div class="adm-t" data-slug="${s}">
    <div class="adm-h"><b>${esc(x.nombre)}</b>${x.fundador ? '<span class="tag ok">⭐ Fundador</span>' : ''}<span class="tag ${tono}">${esc(est)}</span>${x.estado !== 'activo' ? '<span class="tag warn">Suspendida</span>' : ''}${x.sugerencias ? `<span class="tag">💡 ${x.sugerencias}</span>` : ''}</div>
    <div class="adm-m"><a href="${esc(urlTiendaDe(x.slug))}" target="_blank" rel="noopener">/${s}</a> · <span class="sel">${esc(x.email || 'sin email')}</span>${wsp ? ` · <a href="${esc(wsp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''} · alta ${esc(fechaCorta(x.created_at))} · ${esc(x.rubro || '')} · ${esc(x.modalidad || '')}</div>
    <div class="adm-u">📦 ${x.productos} productos · 🧾 ${x.pedidos} pedidos (${x.pedidos_30d} en 30 días) · 🕒 entró ${esc(hace(x.ultimo_ingreso))}${x.ultimo_pedido ? ` · último pedido ${esc(hace(x.ultimo_pedido))}` : ''}</div>
    <div class="adm-acc">
      <button class="btn btn-s btn-sm" data-act="ad-prueba" data-s="${s}" data-a="sumar" data-n="30">+30 días</button>
      <button class="btn btn-s btn-sm" data-act="ad-prueba" data-s="${s}" data-a="desde_hoy" data-n="180">6 meses desde hoy</button>
      ${d > SIN_VENC ? '' : `<button class="btn btn-s btn-sm" data-act="ad-prueba" data-s="${s}" data-a="sin_vencimiento">Sin vencimiento</button>`}
      ${d > 0 ? `<button class="btn btn-s btn-sm" data-act="ad-prueba" data-s="${s}" data-a="terminar">Terminar prueba</button>` : ''}
      <button class="btn btn-s btn-sm" data-act="ad-fund" data-s="${s}" data-v="${x.fundador ? '0' : '1'}">${x.fundador ? 'Quitar fundador' : '⭐ Hacer fundador'}</button>
    </div></div>`;
}
const ESTADOS_SG = [['nueva', 'Nueva'], ['vista', 'Vista'], ['hecha', 'Hecha']];
function filaSug(s) {
  const wsp = s.whatsapp ? waLink(s.whatsapp, `Hola ${s.nombre}, gracias por tu sugerencia: "${String(s.texto).slice(0, 80)}".`) : '';
  return `<div class="adm-s ${s.estado}"><div class="adm-h"><b>${esc(s.nombre)}</b>${s.fundador ? '<span class="tag ok">⭐</span>' : ''}<small class="muted">${esc(fechaCorta(s.created_at))}</small>
    <select class="fi fi-sm" data-change="ad-sg" data-id="${esc(s.id)}" aria-label="Estado de la sugerencia">${ESTADOS_SG.map(([k, n]) => `<option value="${k}" ${s.estado === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    <p>${esc(s.texto)}</p>${wsp ? `<a class="linkb" href="${esc(wsp)}" target="_blank" rel="noopener">Responder por WhatsApp</a>` : ''}</div>`;
}
on('ad-recargar', () => { AD.tiendas = null; AD.err = ''; cargarAdmin(); P.repintar(); });
on('ad-f', d => { AD.f = d.k; P.repintar(); });
on('ad-q', (d, el) => { AD.q = el.value; P.repintar(); const i = document.getElementById('ad-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } });
const recargarTiendas = async () => { try { [AD.tiendas, AD.cfg] = await Promise.all([api.adminTiendas(), api.cupos()]); } catch (e) { AD.err = e.message; } P.repintar(); };
on('ad-prueba', async (d, b) => {
  if (d.a === 'terminar' && !confirmar(b, '¿Terminar la prueba? Tocá de nuevo')) return;
  b.disabled = true;
  try { await api.adminPrueba(d.s, d.a, d.n ? +d.n : null); toast({ sumar: '+30 días sumados ✓', desde_hoy: 'Prueba de 6 meses desde hoy ✓', sin_vencimiento: 'Prueba sin vencimiento ✓', terminar: 'Prueba terminada' }[d.a] || 'Listo ✓'); }
  catch (e) { toast(e.message); }
  await recargarTiendas();
});
on('ad-fund', async (d, b) => {
  if (d.v === '0' && !confirmar(b, '¿Quitar fundador? Tocá de nuevo')) return;
  b.disabled = true;
  try { await api.adminFundador(d.s, d.v === '1'); toast(d.v === '1' ? '⭐ Ahora es fundador' : 'Ya no es fundador'); } catch (e) { toast(e.message); }
  await recargarTiendas();
});
on('ad-config', async (d, f) => {
  const fd = new FormData(f);
  try { AD.cfg = await api.adminConfig(+fd.get('cupos'), +fd.get('dias'), +fd.get('prueba')); toast('Guardado ✓'); } catch (e) { toast(e.message); }
  P.repintar();
});
on('ad-sg', async (d, el) => {
  try { await api.adminSugEstado(d.id, el.value); const s = (AD.sugs || []).find(x => x.id === d.id); if (s) s.estado = el.value; P.repintar(); } catch (e) { toast(e.message); }
});
