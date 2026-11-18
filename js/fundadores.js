// Programa Fundadores, "Sugerir una mejora" y la administración de la plataforma.
// La administración solo aparece para quien figure como admin en la base (la base vuelve a comprobarlo en cada acción).
import { esc, on, toast, waLink, confirmar, fmt } from './util.js';
import { P, PLAN_NOMBRE, planVencido } from './state.js';
import { api } from './api.js';
import { urlTiendaDe, PLANES, MARCA } from './marca.js';

/* ---------- la prueba: cuántos días quedan y cómo decirlo ---------- */
export const SIN_VENC = 3650;   // más de 10 años = "sin vencimiento" (la base guarda una fecha lejana)
export const diasDe = t => t && t.trial_ends_at ? Math.ceil((new Date(t.trial_ends_at) - Date.now()) / 864e5) : 0;
const fechaLarga = s => new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
// texto del botón de plan arriba del panel
export function chipPlan(t) {
  const d = diasDe(t);
  if (d > SIN_VENC) return t.fundador ? '⭐ Fundador' : 'Prueba sin vencimiento';
  if (d > 0) return (t.fundador ? '⭐ Fundador: ' : 'Prueba: ') + d + ' d';
  if (planVencido(t)) return PLAN_NOMBRE.base;   // plan pagado por transferencia que venció
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
  const el = document.getElementById('fund-cupos'); if (!el && !document.querySelector('.dias-prueba')) return;
  try {
    const c = await api.cupos(); if (!c) return;
    // los días de la prueba común salen de la configuración (Administración → Programa Fundadores)
    if (+c.prueba_dias > 0) document.querySelectorAll('.dias-prueba').forEach(s => { s.textContent = +c.prueba_dias; });
    if (!el || !(c.quedan > 0)) return;
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
const AD = { tiendas: null, sugs: null, cfg: null, pagos: [], err: '', f: 'todas', q: '', cargando: false, planDe: '', pf: null };
export const resetAdmin = () => Object.assign(AD, { tiendas: null, sugs: null, cfg: null, pagos: [], err: '', f: 'todas', q: '', cargando: false, planDe: '', pf: null });
export async function esAdmin() { try { return !!(await api.esAdmin()); } catch (e) { return false; } }
async function cargarAdmin() {
  AD.cargando = true; AD.err = '';
  try { [AD.tiendas, AD.sugs, AD.cfg, AD.pagos] = await Promise.all([api.adminTiendas(), api.adminSugerencias(), api.cupos(), api.adminPagos().catch(() => [])]); }
  catch (e) { AD.err = e.message; }
  AD.cargando = false; P.repintar();
}
const hace = s => {
  if (!s) return 'nunca';
  const d = Math.floor((Date.now() - new Date(s)) / 864e5);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
};
const fechaCorta = s => s ? new Date(s).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';
/* ---------- cobros (v2.23) ---------- */
const DIA = 864e5;
const precioPlan = id => (PLANES.find(p => p.id === id) || {}).precio || 0;
const ANUAL = (() => { const n = Number(MARCA.ANUAL_MESES); return n > 0 && n < 12 ? n : 0; })();
const montoDe = (plan, meses) => plan === 'base' && precioPlan('base') === 0 ? 0 : meses === 12 && ANUAL ? precioPlan(plan) * ANUAL : precioPlan(plan) * meses;
const diasHasta = x => x.plan_hasta ? Math.ceil((new Date(x.plan_hasta) - Date.now()) / DIA) : null;
const porTransf = x => x.plan !== 'base' && !!x.plan_hasta && x.suscripcion_estado !== 'activa';
// paga = tiene un plan pago vigente (suscripción activa, o pago anotado y no vencido)
const paga = x => x.plan !== 'base' && (x.suscripcion_estado === 'activa' || (x.plan_hasta ? !planVencido(x) : !!x.ultimo_pago));
const venceEn = (x, n) => porTransf(x) && diasHasta(x) >= 0 && diasHasta(x) <= n;
const vencido = x => porTransf(x) && diasHasta(x) < 0;
// cuánto aporta por mes (si pagó varios meses juntos, el prorrateo de su último pago)
const mensual = x => { const u = x.ultimo_pago; return u && u.plan === x.plan && u.meses > 0 && Number(u.monto) > 0 ? Number(u.monto) / u.meses : precioPlan(x.plan); };
const mesDe = d => { const f = new Date(d); return f.getFullYear() * 12 + f.getMonth(); };
// hasta cuándo quedaría pago (mismo cálculo que admin_plan en la base)
function hastaPrevio(x, plan, meses) {
  if (plan === 'base' || !meses) return null;
  const ahora = Date.now(), te = x.trial_ends_at ? new Date(x.trial_ends_at).getTime() : 0;
  const desde = new Date(Math.max(ahora, x.plan === plan && x.plan_hasta ? new Date(x.plan_hasta).getTime() : ahora, te && te < ahora + 60 * DIA ? te : ahora));
  desde.setMonth(desde.getMonth() + meses); return desde;
}
function estadoDe(x) {
  const d = diasDe(x);
  if (x.suscripcion_estado === 'activa') return ['ok', 'Pagando ' + (PLAN_NOMBRE[x.plan] || x.plan)];
  if (porTransf(x)) {
    const n = diasHasta(x), nom = PLAN_NOMBRE[x.plan] || x.plan;
    if (planVencido(x)) return ['bad', `${nom} · venció el ${fechaCorta(x.plan_hasta)}`];
    if (n < 0) return ['warn', `${nom} · venció (tolerancia)`];
    if (n <= 5) return ['warn', `${nom} · vence ${n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`}`];
    if (d <= 0) return ['ok', `Pagando ${nom} · hasta ${fechaCorta(x.plan_hasta)}`];
  }
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
  ['pagando', 'Pagando', paga],
  ['vencen', 'Vencen en 5 días', x => venceEn(x, 5)],
  ['vencidos', 'Vencidos', vencido],
  ['pausadas', '⏸ Pausadas', x => x.estado !== 'activo'],
  ['sinprod', 'Sin cargar productos', x => (x.productos || 0) <= 4],
  ['inactivas', 'Inactivas', inactiva]
];

export function vistaAdmin() {
  if (!AD.tiendas && !AD.cargando && !AD.err) { cargarAdmin(); }
  if (!AD.tiendas) return `<div class="cc"><h3>🛡️ Administración</h3>${AD.err ? `<div class="err-box">${esc(AD.err)}</div><button class="btn btn-s" data-act="ad-recargar">Reintentar</button>` : '<p class="hint"><span class="spin"></span> Cargando tiendas…</p>'}</div>`;
  const L = AD.tiendas, c = AD.cfg || {}, fund = L.filter(x => x.fundador).length;
  const act7 = L.filter(x => x.ultimo_ingreso && Date.now() - new Date(x.ultimo_ingreso) < 7 * 864e5).length;
  const conPed = L.filter(x => x.pedidos > 0).length, pagan = L.filter(paga).length;
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
  ${cobrosHtml(L)}
  <div class="cc adm"><div class="adm-filtros">${FILTROS.map(([k, n, f]) => `<button type="button" class="pill ${AD.f === k ? 'on' : ''}" data-act="ad-f" data-k="${k}" aria-pressed="${AD.f === k}">${n} <small>${L.filter(f).length}</small></button>`).join('')}</div>
    <input class="fi" placeholder="Buscar por nombre, enlace, email o WhatsApp" value="${esc(AD.q)}" data-input="ad-q" aria-label="Buscar tiendas" id="ad-q">
    <div class="adm-lista">${V.map(filaTienda).join('') || '<p class="hint">No hay tiendas con ese filtro.</p>'}</div></div>
  <div class="cc adm" id="adm-sugs"><h3>💡 Sugerencias ${nuevas ? `<span class="tag ok">${nuevas} nuevas</span>` : ''}</h3>
    ${(AD.sugs || []).map(filaSug).join('') || '<p class="hint">Todavía no llegó ninguna. Los comercios las mandan desde Ayuda o desde el menú “Más”.</p>'}</div>`;
}
function cobrosHtml(L) {
  const P2 = L.filter(paga), pro = P2.filter(x => x.plan === 'pro').length, api = P2.filter(x => x.plan === 'api').length, base = P2.filter(x => x.plan === 'base').length;
  const mrr = P2.reduce((a, x) => a + mensual(x), 0), hoy = mesDe(Date.now());
  const pg = AD.pagos || [], este = pg.filter(p => mesDe(p.created_at) === hoy).reduce((a, p) => a + Number(p.monto), 0), ant = pg.filter(p => mesDe(p.created_at) === hoy - 1).reduce((a, p) => a + Number(p.monto), 0);
  const v5 = L.filter(x => venceEn(x, 5)).length, ven = L.filter(vencido).length, ult = pg.slice(0, 6);
  const mes = new Date().toLocaleDateString('es-AR', { month: 'long' });
  return `<div class="cc adm" id="adm-cobros"><h3>💰 Cobros</h3>
    <div class="adm-kpis">
      <div><b>${P2.length}</b><span>pagando${P2.length ? ` · Pro ${pro} · Automatización ${api}${base ? ` · Base ${base}` : ''}` : ''}</span></div>
      <div><b>${fmt(mrr)}</b><span>facturación mensual estimada</span></div>
      <div><b>${fmt(este)}</b><span>cobrado en ${esc(mes)}${ant ? ` · mes pasado ${fmt(ant)}` : ''}</span></div>
      <button type="button" class="adm-kpi-btn${v5 ? ' warn' : ''}" data-act="ad-f" data-k="vencen"><b>${v5}</b><span>vencen en 5 días</span></button>
      <button type="button" class="adm-kpi-btn${ven ? ' bad' : ''}" data-act="ad-f" data-k="vencidos"><b>${ven}</b><span>vencidos</span></button>
    </div>
    ${ult.length ? `<details class="adm-pagos"><summary>Últimos cobros anotados</summary>${ult.map(p => `<div class="adm-pago"><span>${esc(fechaCorta(p.created_at))}</span><b>${esc(p.nombre)}</b><span>${esc(PLAN_NOMBRE[p.plan] || p.plan)} · ${p.meses ? p.meses + (p.meses === 1 ? ' mes' : ' meses') : 'sin vencimiento'} · ${esc(p.medio)}</span><b>${fmt(p.monto)}</b></div>`).join('')}</details>` : '<p class="hint">Cuando anotes un pago con “💳 Activar plan” en la ficha de una tienda, se suma acá.</p>'}
  </div>`;
}
function recordarHtml(x) {
  if (!x.whatsapp || !(venceEn(x, 5) || vencido(x))) return '';
  const nom = PLAN_NOMBRE[x.plan] || x.plan, datos = [MARCA.PAGO_ALIAS && 'alias ' + MARCA.PAGO_ALIAS, MARCA.PAGO_CBU && 'CBU/CVU ' + MARCA.PAGO_CBU].filter(Boolean).join(' o ');
  const txt = `Hola ${x.nombre}, ¿cómo estás? Te escribo de ${MARCA.NOMBRE}: tu plan ${nom} ${vencido(x) ? 'venció' : 'vence'} el ${new Date(x.plan_hasta).toLocaleDateString('es-AR')}. Para renovarlo podés transferir ${fmt(precioPlan(x.plan))}${datos ? ' al ' + datos : ''} y mandarme el comprobante por acá. ¡Gracias!`;
  return `<a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${esc(waLink(x.whatsapp, txt))}">📲 Recordar vencimiento</a>`;
}
function planForm(x) {
  const f = AD.pf || {}, plan = f.plan || (x.plan !== 'base' ? x.plan : 'pro'), meses = f.meses != null ? f.meses : 1, h = hastaPrevio(x, plan, meses), s = esc(x.slug);
  const op = (v, t, cur) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${t}</option>`;
  return `<form class="adm-cfg adm-plan" data-submit="ad-plan" data-s="${s}"><b>💳 Activar o renovar el plan de ${esc(x.nombre)}</b>
    <label>Plan<select class="fi" name="plan" data-change="ad-pf" data-k="plan">${op('pro', 'Mayorista Pro', plan)}${op('api', 'Suite Automatización', plan)}${op('base', 'Catálogo Base', plan)}</select></label>
    <label>Período<select class="fi" name="meses" data-change="ad-pf" data-k="meses">${op(1, '1 mes', meses)}${op(3, '3 meses', meses)}${op(6, '6 meses', meses)}${op(12, ANUAL ? `12 meses (anual: paga ${ANUAL})` : '12 meses', meses)}${op(0, 'Sin vencimiento', meses)}</select></label>
    <label>Monto cobrado ($)<input class="fi" name="monto" type="number" min="0" step="1" value="${Math.round(montoDe(plan, meses))}" required></label>
    <label>Medio<select class="fi" name="medio">${op('transferencia', 'Transferencia', 'transferencia')}${op('efectivo', 'Efectivo', '')}${op('mercadopago', 'Mercado Pago', '')}${op('otro', 'Otro', '')}</select></label>
    <label>Nota (opcional)<input class="fi" name="nota" maxlength="200" placeholder="Ej: comprobante del 12/11"></label>
    <p class="hint" style="width:100%;margin:0">${plan === 'base' ? 'Pasa a Catálogo Base (sin vencimiento).' : h ? `Queda pago hasta el <b>${esc(h.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }))}</b>. Después tiene 3 días de tolerancia y, si no renueva, pasa sola a Base.` : 'Queda activo sin fecha de vencimiento.'}</p>
    <button class="btn btn-p btn-sm" type="submit">Anotar pago y activar</button><button class="btn btn-s btn-sm" type="button" data-act="ad-plan-x">Cancelar</button></form>`;
}
function filaTienda(x) {
  const [tono, est] = estadoDe(x), d = diasDe(x), s = esc(x.slug);
  const wsp = x.whatsapp ? waLink(x.whatsapp, `Hola ${x.nombre}, te escribo de la plataforma de tu tienda.`) : '';
  return `<div class="adm-t" data-slug="${s}">
    <div class="adm-h"><b>${esc(x.nombre)}</b>${x.fundador ? '<span class="tag ok">⭐ Fundador</span>' : ''}<span class="tag ${tono}">${esc(est)}</span>${x.estado !== 'activo' ? '<span class="tag warn">Suspendida</span>' : ''}${x.sugerencias ? `<span class="tag">💡 ${x.sugerencias}</span>` : ''}</div>
    <div class="adm-m"><a href="${esc(urlTiendaDe(x.slug))}" target="_blank" rel="noopener">/${s}</a> · <span class="sel">${esc(x.email || 'sin email')}</span>${wsp ? ` · <a href="${esc(wsp)}" target="_blank" rel="noopener">WhatsApp</a>` : ''} · alta ${esc(fechaCorta(x.created_at))} · ${esc(x.rubro || '')} · ${esc(x.modalidad || '')}</div>
    ${x.ultimo_pago ? `<div class="adm-m">💳 Último pago: ${fmt(x.ultimo_pago.monto)} (${esc(PLAN_NOMBRE[x.ultimo_pago.plan] || x.ultimo_pago.plan)}, ${x.ultimo_pago.meses ? x.ultimo_pago.meses + (x.ultimo_pago.meses === 1 ? ' mes' : ' meses') : 'sin vencimiento'}) el ${esc(fechaCorta(x.ultimo_pago.fecha))}${x.plan_hasta ? ` · pago hasta ${esc(fechaCorta(x.plan_hasta))}` : ''}</div>` : x.plan_hasta ? `<div class="adm-m">💳 Pago hasta ${esc(fechaCorta(x.plan_hasta))}</div>` : ''}
    <div class="adm-u">📦 ${x.productos} productos · 🧾 ${x.pedidos} pedidos (${x.pedidos_30d} en 30 días) · 🕒 entró ${esc(hace(x.ultimo_ingreso))}${x.ultimo_pedido ? ` · último pedido ${esc(hace(x.ultimo_pedido))}` : ''}</div>
    <div class="adm-acc">
      <button class="btn btn-s btn-sm" data-act="ad-prueba" data-s="${s}" data-a="sumar" data-n="30">+30 días</button>
      <button class="btn btn-s btn-sm" data-act="ad-prueba" data-s="${s}" data-a="desde_hoy" data-n="180">6 meses desde hoy</button>
      ${d > SIN_VENC ? '' : `<button class="btn btn-s btn-sm" data-act="ad-prueba" data-s="${s}" data-a="sin_vencimiento">Sin vencimiento</button>`}
      ${d > 0 ? `<button class="btn btn-s btn-sm" data-act="ad-prueba" data-s="${s}" data-a="terminar">Terminar prueba</button>` : ''}
      <button class="btn btn-s btn-sm" data-act="ad-fund" data-s="${s}" data-v="${x.fundador ? '0' : '1'}">${x.fundador ? 'Quitar fundador' : '⭐ Hacer fundador'}</button>
      <button class="btn btn-p btn-sm" data-act="ad-plan-abrir" data-s="${s}">💳 Activar plan</button>
      ${recordarHtml(x)}
      <button class="btn btn-s btn-sm" data-act="ad-estado" data-s="${s}" data-v="${x.estado === 'activo' ? '0' : '1'}">${x.estado === 'activo' ? '⏸ Pausar tienda' : '▶️ Reactivar tienda'}</button>
    </div>${AD.planDe === x.slug ? planForm(x) : ''}</div>`;
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
on('ad-plan-abrir', d => { AD.planDe = AD.planDe === d.s ? '' : d.s; AD.pf = null; P.repintar(); });
on('ad-plan-x', () => { AD.planDe = ''; AD.pf = null; P.repintar(); });
on('ad-pf', (d, el) => { AD.pf = Object.assign({}, AD.pf || {}, { [d.k]: d.k === 'meses' ? Number(el.value) : el.value }); if (d.k === 'plan' && !AD.pf.plan) AD.pf.plan = 'pro'; P.repintar(); });
on('ad-plan', async (d, f) => {
  const fd = new FormData(f), b = f.querySelector('[type=submit]'); if (b) b.disabled = true;
  try {
    const r = await api.adminPlan(d.s, fd.get('plan'), Number(fd.get('meses')), Number(fd.get('monto') || 0), fd.get('medio'), (fd.get('nota') || '').trim() || null);
    toast(r && r.plan_hasta ? `✓ ${PLAN_NOMBRE[r.plan]} activo hasta el ${new Date(r.plan_hasta).toLocaleDateString('es-AR')}` : `✓ ${PLAN_NOMBRE[r && r.plan] || 'Plan'} activo`);
    AD.planDe = ''; AD.pf = null;
    try { AD.pagos = await api.adminPagos(); } catch (e) { }
  } catch (e) { toast(/admin_plan|schema cache/i.test(e.message) ? 'Falta correr la migración v2.23 en Supabase.' : e.message); if (b) b.disabled = false; return; }
  await recargarTiendas();
});
on('ad-estado', async (d, b) => {
  if (d.v === '0' && !confirmar(b, '¿Pausar? Sus clientes no la van a ver. Tocá de nuevo')) return;
  b.disabled = true;
  try { await api.adminEstado(d.s, d.v === '1'); toast(d.v === '1' ? '▶️ Tienda reactivada' : '⏸ Tienda pausada'); } catch (e) { toast(/admin_estado|schema cache/i.test(e.message) ? 'Falta correr la migración v2.23 en Supabase.' : e.message); }
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
