// Caja (v2.30): lo que entró y salió de verdad, día por día o en el mes, en efectivo y en transferencia por separado.
// Entra solo: cada pedido cobrado (el día que se cobró y con qué). A mano: otros ingresos, gastos y compras.
// No toca la ganancia (eso es Resultado): acá es la plata que se movió.
import { api } from './api.js';
import { $, esc, fmt, on, toast, confirmar } from './util.js';
import { P, can, bloqueo } from './state.js';
import { cargarGastos, CATS_GASTO } from './resultado.js';

const hoyStr = () => new Date().toLocaleDateString('sv');
const C = { modo: 'dia', dia: hoyStr(), mes: hoyStr().slice(0, 7), form: null, lim: 40 };
export const resetCaja = () => Object.assign(C, { modo: 'dia', dia: hoyStr(), mes: hoyStr().slice(0, 7), form: null, lim: 40 });
export const CATS_INGRESO = ['Venta en el local', 'Cobro de una deuda', 'Aporte de dinero', 'Otros'];
const MEDIOS = { efectivo: ['💵', 'Efectivo'], transferencia: ['🏦', 'Transferencia y MP'], sin: ['❔', 'Sin indicar'] };

const diaDe = iso => new Date(iso).toLocaleDateString('sv');
const medioPedido = o => o.cobrado_medio || (o.medio_pago === 'efectivo' ? 'efectivo' : 'transferencia');
// Todos los movimientos de caja, con fecha local (AAAA-MM-DD), signo y medio
export function movimientosCaja() {
  const m = [];
  (P.pedidos || []).filter(o => o.estado === 'cobrado').forEach(o => {
    const at = o.pagado_at || o.created_at;
    m.push({ k: 'ped', id: o.id, fecha: diaDe(at), at, monto: Number(o.total_ars), medio: medioPedido(o), txt: `Pedido #${o.numero} · ${o.cliente_nombre}`, cat: 'Pedido cobrado' });
  });
  (P.gastos || []).forEach(g => m.push({ k: 'g', id: g.id, tipo: g.tipo, fecha: g.fecha, at: g.created_at, monto: (g.tipo === 'ingreso' ? 1 : -1) * Number(g.monto), medio: g.medio || 'sin', txt: g.concepto, cat: g.tipo === 'compra' ? 'Compra' + (g.proveedor ? ' · ' + g.proveedor : '') : g.categoria }));
  return m.sort((a, b) => (b.fecha + (b.at || '')).localeCompare(a.fecha + (a.at || '')));
}
function sumar(L) {
  const s = { ent: 0, sal: 0, med: {} };
  L.forEach(x => { const d = s.med[x.medio] || (s.med[x.medio] = { ent: 0, sal: 0 }); if (x.monto >= 0) { s.ent += x.monto; d.ent += x.monto; } else { s.sal -= x.monto; d.sal -= x.monto; } });
  return s;
}
const enRango = x => C.modo === 'dia' ? x.fecha === C.dia : x.fecha.slice(0, 7) === C.mes;
const fmtS = n => n < 0 ? '−' + fmt(-n) : fmt(n);
const etiquetaDia = d => { const h = hoyStr(), ay = new Date(Date.now() - 864e5).toLocaleDateString('sv'); const f = new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }); return d === h ? 'Hoy · ' + f : d === ay ? 'Ayer · ' + f : f.charAt(0).toUpperCase() + f.slice(1); };
const etiquetaMes = m => { const f = new Date(m + '-15T12:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); return f.charAt(0).toUpperCase() + f.slice(1); };
const split = med => ['efectivo', 'transferencia', 'sin'].filter(k => med[k] || k !== 'sin');

export function vistaCaja() {
  if (!can('caja')) return bloqueo('💵 Caja diaria', 'Cuánto entró y salió hoy, en efectivo y por transferencia, y el cierre del día.', 'caja');
  const todos = movimientosCaja(), L = todos.filter(enRango), S = sumar(L), neto = S.ent - S.sal;
  const sub = (k) => split(S.med).map(m => { const d = S.med[m] || { ent: 0, sal: 0 }; const v = k === 'ent' ? d.ent : k === 'sal' ? d.sal : d.ent - d.sal; return `<span>${MEDIOS[m][0]} ${k === 'net' ? fmtS(v) : fmt(v)}</span>`; }).join('');
  const pc = (P.pedidos || []).filter(o => o.estado === 'pendiente'), pcT = pc.reduce((s, o) => s + Number(o.total_ars), 0);
  const nav = C.modo === 'dia'
    ? `<button class="btn btn-s btn-sm" data-act="cj-mov" data-d="-1" aria-label="Día anterior">◀</button><input class="fi cj-fecha" id="cj-dia" type="date" value="${C.dia}" max="${hoyStr()}" data-change="cj-dia" aria-label="Día"><button class="btn btn-s btn-sm" data-act="cj-mov" data-d="1" aria-label="Día siguiente" ${C.dia >= hoyStr() ? 'disabled' : ''}>▶</button>${C.dia !== hoyStr() ? '<button class="btn btn-s btn-sm" data-act="cj-hoy">Hoy</button>' : ''}`
    : `<button class="btn btn-s btn-sm" data-act="cj-mov" data-d="-1" aria-label="Mes anterior">◀</button><input class="fi cj-fecha" id="cj-mes" type="month" value="${C.mes}" max="${hoyStr().slice(0, 7)}" data-change="cj-mes" aria-label="Mes"><button class="btn btn-s btn-sm" data-act="cj-mov" data-d="1" aria-label="Mes siguiente" ${C.mes >= hoyStr().slice(0, 7) ? 'disabled' : ''}>▶</button>${C.mes !== hoyStr().slice(0, 7) ? '<button class="btn btn-s btn-sm" data-act="cj-hoy">Este mes</button>' : ''}`;
  const tabla = `<table class="cj-tabla"><thead><tr><th></th><th>Entró</th><th>Salió</th><th>Quedó</th></tr></thead><tbody>${split(S.med).map(m => { const d = S.med[m] || { ent: 0, sal: 0 }, n = d.ent - d.sal; return `<tr><th scope="row">${MEDIOS[m][0]} ${MEDIOS[m][1]}</th><td>${fmt(d.ent)}</td><td>${fmt(d.sal)}</td><td class="${n < 0 ? 'neg' : 'pos'}"><b>${fmtS(n)}</b></td></tr>`; }).join('')}
    <tr class="tot"><th scope="row">Total</th><td>${fmt(S.ent)}</td><td>${fmt(S.sal)}</td><td class="${neto < 0 ? 'neg' : 'pos'}"><b>${fmtS(neto)}</b></td></tr></tbody></table>
    ${S.med.sin ? '<p class="hint" style="margin-top:6px">❔ “Sin indicar”: gastos cargados antes de la Caja. Elegí el medio en cada uno (abajo) y pasan a su columna.</p>' : ''}`;
  let dias = '';
  if (C.modo === 'mes') {
    const por = new Map(); L.forEach(x => { const s = por.get(x.fecha) || []; s.push(x); por.set(x.fecha, s); });
    dias = `<div class="cc"><h3>📅 Día por día</h3>${[...por.keys()].sort().reverse().map(d => { const s = sumar(por.get(d)), n = s.ent - s.sal; return `<button class="cj-dia" data-act="cj-ver-dia" data-d="${d}"><span>${esc(new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' }))}</span><span>+${fmt(s.ent)}</span><span>−${fmt(s.sal)}</span><b class="${n < 0 ? 'neg' : 'pos'}">${fmtS(n)}</b></button>`; }).join('') || '<p class="muted">Sin movimientos este mes.</p>'}</div>`;
  }
  const opt = (sel) => ['efectivo', 'transferencia'].map(m => `<option value="${m}" ${sel === m ? 'selected' : ''}>${MEDIOS[m][0]} ${m === 'efectivo' ? 'Efectivo' : 'Transferencia'}</option>`).join('');
  const movs = L.slice(0, C.lim).map(x => `<div class="srow cj-m"><span class="cj-i" aria-hidden="true">${x.k === 'ped' ? '🧾' : x.tipo === 'ingreso' ? '➕' : x.tipo === 'compra' ? '📦' : '💸'}</span><span class="cj-t">${x.k === 'ped' ? `<button class="linkb" data-act="cj-ped" data-id="${x.id}">${esc(x.txt)}</button>` : esc(x.txt)}<small class="muted">${C.modo === 'mes' ? esc(new Date(x.fecha + 'T12:00:00').toLocaleDateString('es-AR')) + ' · ' : ''}${esc(x.cat || '')}</small></span>
    <select class="fi cj-med" data-change="cj-medio" data-k="${x.k}" data-id="${x.id}" aria-label="Medio de ${esc(x.txt)}">${x.medio === 'sin' ? '<option value="" selected>❔ Sin indicar</option>' : ''}${opt(x.medio)}</select>
    <b class="cj-v ${x.monto < 0 ? 'neg' : 'pos'}">${x.monto < 0 ? '−' : '+'}${fmt(Math.abs(x.monto))}</b>${x.k === 'g' ? `<button class="btn btn-s btn-sm" data-act="cj-del" data-id="${x.id}" aria-label="Borrar ${esc(x.txt)}">✕</button>` : '<span class="cj-x"></span>'}</div>`).join('');
  return `<div class="cj-top"><div class="seg" role="group" aria-label="Período"><button class="${C.modo === 'dia' ? 'on' : ''}" data-act="cj-modo" data-m="dia" aria-pressed="${C.modo === 'dia'}">Día</button><button class="${C.modo === 'mes' ? 'on' : ''}" data-act="cj-modo" data-m="mes" aria-pressed="${C.modo === 'mes'}">Mes</button></div><div class="cj-nav">${nav}</div></div>
  <h2 class="cj-tit">${esc(C.modo === 'dia' ? etiquetaDia(C.dia) : etiquetaMes(C.mes))}</h2>
  <div class="kpis kpis3 cj-kpis"><div class="kpi"><small>Entró</small><b>${fmt(S.ent)}</b><i class="cj-sub">${sub('ent')}</i></div>
    <div class="kpi"><small>Salió</small><b>${fmt(S.sal)}</b><i class="cj-sub">${sub('sal')}</i></div>
    <div class="kpi"><small>Quedó</small><b class="${neto < 0 ? 'neg' : 'pos'}">${fmtS(neto)}</b><i class="cj-sub">${sub('net')}</i></div></div>
  <div class="cj-acc"><button class="btn btn-p btn-sm" data-act="cj-form" data-t="ingreso">➕ Ingreso</button><button class="btn btn-s btn-sm" data-act="cj-form" data-t="gasto">💸 Gasto</button><button class="btn btn-s btn-sm" data-act="cj-form" data-t="compra">📦 Compra de mercadería</button></div>
  ${C.form ? formHtml() : ''}
  <div class="grid2"><div class="cc"><h3>💵 Efectivo y 🏦 transferencia</h3>${tabla}</div>
  <div class="cc"><h3>Movimientos (${L.length})</h3>${movs || `<p class="muted">${C.modo === 'dia' ? 'Hoy no hubo movimientos' : 'Sin movimientos'}. Los pedidos que marcás “cobrado” entran solos.</p>`}
    ${L.length > C.lim ? `<button class="btn btn-s btn-sm" data-act="cj-mas">Ver más (${L.length - C.lim})</button>` : ''}</div></div>
  ${dias}
  ${pc.length ? `<div class="cc cj-pend"><span>⏳ Tenés <b>${pc.length} ${pc.length === 1 ? 'pedido' : 'pedidos'} por cobrar</b> (${fmt(pcT)}). Cuando los marcás “cobrado” entran solos a la caja.</span><button class="btn btn-s btn-sm" data-act="p-tab" data-k="pedidos">Ver pedidos</button></div>` : ''}
  <p class="hint">La caja muestra la plata que se movió. La ganancia (ventas menos el costo de lo vendido) está en <button class="linkb" data-act="p-tab" data-k="resultado">💰 Resultado</button>.</p>`;
}
function formHtml() {
  const t = C.form, fecha = C.modo === 'dia' ? C.dia : hoyStr(), cats = t === 'ingreso' ? CATS_INGRESO : CATS_GASTO;
  const tit = { ingreso: '➕ Cargar un ingreso', gasto: '💸 Cargar un gasto', compra: '📦 Cargar una compra de mercadería' }[t];
  const ej = { ingreso: 'Ej: Venta en el local', gasto: 'Ej: Flete a Once', compra: 'Ej: Reposición de labiales' }[t];
  return `<div class="cc cj-form"><h3>${tit}</h3><div id="cj-err"></div><form data-submit="cj-guardar" data-t="${t}">
    <div class="row2"><div class="fg"><label class="flabel" for="cj-con">Concepto</label><input class="fi" id="cj-con" name="concepto" maxlength="120" required placeholder="${ej}"></div>
    <div class="fg"><label class="flabel" for="cj-mon">Monto $</label><input class="fi" id="cj-mon" name="monto" type="number" min="1" step="any" required inputmode="decimal"></div></div>
    <div class="fg"><span class="flabel">¿Cómo ${t === 'ingreso' ? 'entró' : 'salió'}?</span><div class="seg" role="radiogroup"><label><input type="radio" name="medio" value="efectivo" checked> 💵 Efectivo</label><label><input type="radio" name="medio" value="transferencia"> 🏦 Transferencia</label></div></div>
    <div class="row2">${t === 'compra' ? `<div class="fg"><label class="flabel" for="cj-prov">Proveedor (opcional)</label><input class="fi" id="cj-prov" name="proveedor" maxlength="80"></div>` : `<div class="fg"><label class="flabel" for="cj-cat">Categoría</label><select class="fi" id="cj-cat" name="categoria">${cats.map(c => `<option>${esc(c)}</option>`).join('')}</select></div>`}
    <div class="fg"><label class="flabel" for="cj-fec">Fecha</label><input class="fi" id="cj-fec" name="fecha" type="date" value="${fecha}" max="${hoyStr()}" required></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p btn-sm" type="submit">Guardar</button><button class="btn btn-s btn-sm" type="button" data-act="cj-form" data-t="">Cancelar</button></div></form></div>`;
}

const mover = (d) => {
  if (C.modo === 'dia') { const x = new Date(C.dia + 'T12:00:00'); x.setDate(x.getDate() + d); const s = x.toLocaleDateString('sv'); C.dia = s > hoyStr() ? hoyStr() : s; }
  else { const [y, m] = C.mes.split('-').map(Number), x = new Date(y, m - 1 + d, 15); const s = x.toLocaleDateString('sv').slice(0, 7); C.mes = s > hoyStr().slice(0, 7) ? hoyStr().slice(0, 7) : s; }
};
on('cj-modo', d => { C.modo = d.m; if (d.m === 'mes') C.mes = C.dia.slice(0, 7); C.lim = 40; P.repintar(); });
on('cj-mov', d => { mover(Number(d.d)); C.lim = 40; P.repintar(); });
on('cj-hoy', () => { C.dia = hoyStr(); C.mes = hoyStr().slice(0, 7); P.repintar(); });
on('cj-dia', (d, el) => { if (el.value) { C.dia = el.value > hoyStr() ? hoyStr() : el.value; P.repintar(); } });
on('cj-mes', (d, el) => { if (el.value) { C.mes = el.value; P.repintar(); } });
on('cj-ver-dia', d => { C.modo = 'dia'; C.dia = d.d; P.repintar(); window.scrollTo(0, 0); });
on('cj-mas', () => { C.lim += 60; P.repintar(); });
on('cj-form', d => { C.form = d.t || null; P.repintar(); if (C.form) { const e = $('#cj-con'); if (e) e.focus(); } });
on('cj-ped', d => { const o = P.pedidos.find(x => x.id === d.id); if (!o) return; P.tab = 'pedidos'; P.modal = { tipo: 'ped', o, items: P.items.filter(i => i.order_id === o.id) }; P.repintar(); });
on('cj-guardar', async (d, f) => {
  const fd = new FormData(f), b = f.querySelector('button[type=submit]'), t = d.t;
  const g = { tenant_id: P.t.id, tipo: t, concepto: String(fd.get('concepto') || '').trim(), monto: Math.round(Number(fd.get('monto')) * 100) / 100,
    medio: fd.get('medio') === 'transferencia' ? 'transferencia' : 'efectivo', fecha: fd.get('fecha'),
    categoria: t === 'compra' ? 'Mercadería' : String(fd.get('categoria') || 'Otros'), proveedor: t === 'compra' ? String(fd.get('proveedor') || '').trim() || null : null };
  if (!g.concepto || !(g.monto > 0)) { $('#cj-err').innerHTML = '<div class="err-box">Completá el concepto y un monto mayor a cero.</div>'; return; }
  b.disabled = true;
  try { await api.guardarGasto(null, g); await cargarGastos(true); C.form = null; if (C.modo === 'dia') C.dia = g.fecha; else C.mes = g.fecha.slice(0, 7); toast(t === 'ingreso' ? 'Ingreso cargado' : 'Gasto cargado'); P.repintar(); }
  catch (e) { b.disabled = false; $('#cj-err').innerHTML = `<div class="err-box">${esc(/check constraint|no es válido/i.test(e.message) ? 'Falta actualizar la base: corré la migración 23 en Supabase.' : e.message)}</div>`; }
});
on('cj-medio', async (d, el) => {
  const v = el.value === 'efectivo' ? 'efectivo' : 'transferencia';
  try {
    if (d.k === 'ped') { const r = await api.actualizarPedido(d.id, { cobrado_medio: v }); const o = P.pedidos.find(x => x.id === d.id); if (o) Object.assign(o, r || { cobrado_medio: v }); }
    else { await api.guardarGasto(d.id, { medio: v }); const g = P.gastos.find(x => x.id === d.id); if (g) g.medio = v; }
    toast(v === 'efectivo' ? 'Pasó a efectivo' : 'Pasó a transferencia'); P.repintar();
  } catch (e) { toast(e.message); P.repintar(); }
});
on('cj-del', async (d, b) => {
  if (!confirmar(b, '¿Borrar?')) return;
  try { await api.borrarGasto(d.id); P.gastos = P.gastos.filter(g => g.id !== d.id); P.repintar(); } catch (e) { toast(e.message); }
});
