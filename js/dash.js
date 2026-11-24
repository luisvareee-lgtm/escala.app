// Dashboard interactivo: KPIs, ventas por día, top productos, categorías, clientes, equilibrio, stock y carritos.
import { esc, fmt, on, $, waLink } from './util.js';
import { P, can, aviso, precioArs } from './state.js';
import { api } from './api.js';
import { ORIGEN_NOMBRE } from './origen.js';
import { linea, barras, dona } from './charts.js';
import { saldo, cobradoDe } from './monto.js';

const D = { rango: 30, metrica: 'ventas', cat: null };
const dia = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const corto = k => k.slice(8) + '/' + k.slice(5, 7);

function calcular() {
  const hoy = new Date(); hoy.setHours(23, 59, 59, 999);
  const ini = new Date(hoy); ini.setDate(ini.getDate() - D.rango + 1); ini.setHours(0, 0, 0, 0);
  const iniPrev = new Date(ini); iniPrev.setDate(iniPrev.getDate() - D.rango);
  const val = P.pedidos.filter(o => o.estado !== 'cancelado');
  const cur = val.filter(o => new Date(o.created_at) >= ini && new Date(o.created_at) <= hoy);
  const prev = val.filter(o => new Date(o.created_at) >= iniPrev && new Date(o.created_at) < ini);
  const ids = new Set(cur.map(o => o.id)), porId = new Map(P.pedidos.map(o => [o.id, o]));
  const items = P.items.filter(i => ids.has(i.order_id));
  const prodPor = new Map(P.prods.map(p => [p.id, p]));
  const cot = Number(P.t.cotizacion_usd);
  const sum = a => a.reduce((s, o) => s + Number(o.total_ars), 0);
  const dias = new Map(); for (let d = new Date(ini); d <= hoy; d.setDate(d.getDate() + 1)) dias.set(dia(d), { ventas: 0, pedidos: 0, unidades: 0 });
  cur.forEach(o => { const b = dias.get(dia(o.created_at)); if (b) { b.ventas += Number(o.total_ars); b.pedidos++; } });
  items.forEach(i => { const o = porId.get(i.order_id); const b = o && dias.get(dia(o.created_at)); if (b) b.unidades += i.cantidad; });
  const topP = new Map(), cats = new Map(), cli = new Map(); let costo = 0, conCosto = 0;
  items.forEach(i => {
    const p = prodPor.get(i.product_id), cat = p ? p.categoria : 'Otros';
    if (D.cat && cat !== D.cat) return;
    const t = topP.get(i.nombre_snapshot) || { v: 0, u: 0 }; t.v += Number(i.subtotal); t.u += i.cantidad; topP.set(i.nombre_snapshot, t);
    if (p) { costo += Number(p.costo_usd) * cot * i.cantidad; conCosto += Number(i.subtotal); }
  });
  items.forEach(i => { const p = prodPor.get(i.product_id), cat = p ? p.categoria : 'Otros'; cats.set(cat, (cats.get(cat) || 0) + Number(i.subtotal)); });
  cur.forEach(o => { const c = cli.get(o.cliente_whatsapp) || { n: o.cliente_nombre, v: 0, p: 0 }; c.v += Number(o.total_ars); c.p++; cli.set(o.cliente_whatsapp, c); });
  const todosCli = new Map(); val.forEach(o => todosCli.set(o.cliente_whatsapp, (todosCli.get(o.cliente_whatsapp) || 0) + 1));
  const recompra = todosCli.size ? Math.round([...todosCli.values()].filter(n => n > 1).length / todosCli.size * 100) : 0;
  const mod = new Map(); cur.forEach(o => mod.set(o.modalidad_precio, (mod.get(o.modalidad_precio) || 0) + Number(o.total_ars)));
  return { cur, prev, dias, ventas: sum(cur), ventasPrev: sum(prev), cobrado: cur.reduce((s, o) => s + cobradoDe(o), 0), pend: cur.reduce((s, o) => s + saldo(o), 0),
    topP: [...topP.entries()].map(([label, x]) => ({ label, v: x.v, u: x.u })).sort((a, b) => b.v - a.v).slice(0, 7),
    cats: [...cats.entries()].map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v).slice(0, 6),
    topC: [...cli.values()].sort((a, b) => b.v - a.v).slice(0, 5), recompra, nCli: todosCli.size,
    mod: [...mod.entries()].map(([label, v]) => ({ label: label === 'mayorista' ? 'Mayorista' : 'Minorista', v })),
    margen: conCosto ? conCosto - costo : null, margenPct: conCosto ? Math.round((conCosto - costo) / conCosto * 100) : null };
}
/* ---------- v2.33 · Estadísticas de visitas (anónimas). En Gratis: el pulso de la semana y un anticipo de lo que trae Pro.
   Desde Pro (y en la prueba): de dónde llegan y el embudo hasta el pedido. El corte por plan lo hace la base. ---------- */
const ST = { tid: null, dias: null, d: null, at: 0, cargando: false };
// Se piden al abrir el Resumen y se renuevan si tienen más de un minuto (mientras tanto se muestra lo último que llegó)
export const refrescarStats = () => { ST.at = 0; };
function stats(dias) {
  if (ST.tid !== P.t.id) Object.assign(ST, { tid: P.t.id, dias: null, d: null, at: 0, cargando: false });
  const mismo = ST.dias === dias;
  if (!ST.cargando && (!mismo || Date.now() - ST.at > 60000)) {
    ST.cargando = true;
    api.statsTienda(dias).then(d => { ST.d = d || null; }).catch(() => { ST.d = null; })
      .finally(() => { ST.dias = dias; ST.at = Date.now(); ST.cargando = false; if (P.tab === 'resumen' && !P.modal) P.repintar(); });
  }
  return mismo ? ST.d : null;
}
const nn = x => (Number(x) || 0).toLocaleString('es-AR');
const plural = (n, a, b) => Number(n) === 1 ? a : b;
const desdeTxt = s => s.medido_desde ? `Medimos desde el ${s.medido_desde.slice(8, 10)}/${s.medido_desde.slice(5, 7)}. ` : '';
function pulsoHtml(s) {
  const top = s.top || [];
  return `<div class="cc est-pulso" id="est-pulso"><h3>📈 Tu tienda esta semana</h3>
    <p class="est-frase">${s.visitas ? `Entraron <b>${nn(s.visitas)}</b> ${plural(s.visitas, 'persona', 'personas')} a tu tienda y miraron <b>${nn(s.vistas_producto)}</b> ${plural(s.vistas_producto, 'producto', 'productos')}.` : 'Todavía no hay visitas esta semana. Compartí tu enlace en tus estados, grupos e Instagram.'}</p>
    <div class="est-mini"><span><b>${nn(s.visitas)}</b> visitas</span><span><b>${nn(s.vistas_producto)}</b> productos mirados</span><span><b>${nn(s.pedidos)}</b> ${plural(s.pedidos, 'pedido', 'pedidos')}</span></div>
    ${top.length ? `<h4 class="est-h4">👀 Lo más visto</h4><ol class="est-top">${top.map(x => `<li><span>${esc(x.nombre)}</span><b>${nn(x.vistas)}</b></li>`).join('')}</ol>` : ''}
    <p class="hint">${desdeTxt(s)}No cuentan tus propias visitas.</p></div>`;
}
// Anticipo (uno de los 3 momentos en que el plan Gratis ve Mayorista Pro): con sus datos reales, sin esconder la pestaña.
const anticipoHtml = s => { const c = Number(s.carritos_sin_cerrar) || 0;
  return `<div class="cc locked est-lock" id="est-lock"><b>🔒 Descubrí cuántas vinieron de Instagram, WhatsApp o Google${c ? ` y recuperá ${c} ${plural(c, 'carrito abandonado', 'carritos abandonados')}` : ' y recuperá los carritos abandonados'}</b>
    <p style="margin:6px 0">Disponible en Mayorista Pro: el origen de cada visita, el embudo hasta el pedido, Meta Pixel y Google Analytics 4.</p>
    <button class="btn btn-p btn-sm lock-cta" data-act="p-planes" data-p="pro">Ver Mayorista Pro</button></div>`; };
const PASOS = [['visitas', '👥 Entraron'], ['vieron', '👀 Miraron productos'], ['carrito', '🛒 Agregaron al carrito'], ['pedido', '✅ Mandaron el pedido']];
function statsProHtml(s, urlTienda) {
  const e = s.embudo || {}, base = Number(e.visitas) || 0;
  const emb = PASOS.map(([k, t]) => { const v = Number(e[k]) || 0, pct = base ? Math.round(v / base * 100) : 0;
    return `<div class="hbar emb-paso" data-tip="${t.slice(2).trim()} · ${nn(v)}${base ? ' · ' + pct + '% de las visitas' : ''}"><span class="n">${t}</span><span class="tr"><i style="width:${Math.max(2, pct)}%"></i></span><span class="v">${nn(v)}${base && k !== 'visitas' ? ` <small>${pct}%</small>` : ''}</span></div>`; }).join('');
  const org = (s.origen || []).map(o => ({ label: ORIGEN_NOMBRE[o.origen] || o.origen, v: Number(o.visitas) || 0, tip: `${ORIGEN_NOMBRE[o.origen] || o.origen} · ${nn(o.visitas)} visitas · ${nn(o.pedidos)} ${plural(o.pedidos, 'pedido', 'pedidos')}` }));
  const con = (o, n) => `<button class="linkb" data-act="p-copiar" data-v="${esc(urlTienda + (urlTienda.includes('?') ? '&' : '?') + 'o=' + o)}">${n}</button>`;
  return `<div class="grid2 est-pro"><div class="cc" id="est-origen"><h3>📍 De dónde llegan (${s.dias} d)</h3>
      <p class="est-frase"><b>${nn(s.visitas)}</b> visitas · <b>${nn(s.vistas_producto)}</b> productos mirados</p>
      ${org.length ? barras(org, nn) : '<p class="muted">Todavía no hay visitas en este período. Compartí tu enlace para empezar.</p>'}
      <p class="hint">Para saberlo exacto, copiá tu enlace para ${con('ig', 'Instagram')} · ${con('wa', 'WhatsApp')} · ${con('fb', 'Facebook')}. ${desdeTxt(s)}No cuentan tus propias visitas.</p></div>
    <div class="cc" id="est-embudo"><h3>🔻 De la visita al pedido</h3>${base ? emb : '<p class="muted">Cuando entren visitas vas a ver cuántas miran productos, cuántas llegan al carrito y cuántas te mandan el pedido.</p>'}
      ${(s.top || []).length ? `<h4 class="est-h4">👀 Lo más visto</h4><ol class="est-top">${s.top.map(x => `<li><span>${esc(x.nombre)}</span><b>${nn(x.vistas)}</b></li>`).join('')}</ol>` : ''}</div></div>`;
}
const delta = (a, b) => b > 0 ? (a >= b ? '▲ ' : '▼ ') + Math.abs(Math.round((a - b) / b * 100)) + '% vs. período anterior' : 'sin período anterior';

// ---------- v2.34 · Tu negocio, en criollo: lo importante en frases, sin hacer cuentas ----------
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const sumT = a => a.reduce((s, o) => s + Number(o.total_ars), 0);
// "un 18% más" · con subas grandes, "3,5 veces más" (un 250% más se entiende peor)
const pctTxt = (a, b) => { const p = Math.round((a - b) / b * 100); return p === 0 ? 'lo mismo' : p >= 100 ? `<b>${(Math.round(a / b * 10) / 10).toLocaleString('es-AR')} veces más</b>` : `un <b>${Math.abs(p)}% ${p > 0 ? 'más' : 'menos'}</b>`; };
function gananciaDe(ped) {
  const ids = new Set(ped.map(o => o.id)); let venta = 0, costo = 0;
  (P.items || []).forEach(i => { if (ids.has(i.order_id) && i.costo_unitario != null) { venta += Number(i.subtotal); costo += Number(i.costo_unitario) * i.cantidad; } });
  return venta > 0 ? venta - costo : null;
}
export function criollo(pro, ahora = new Date()) {
  const val = (P.pedidos || []).filter(o => o.estado !== 'cancelado' && (o.etapa || '') !== 'cancelado');
  if (!val.length) return [];
  const y = ahora.getFullYear(), m = ahora.getMonth(), d = ahora.getDate();
  const iniMes = new Date(y, m, 1), iniAnt = new Date(y, m - 1, 1), finAnt = new Date(y, m - 1, Math.min(d, new Date(y, m, 0).getDate()), 23, 59, 59, 999);
  const mes = val.filter(o => new Date(o.created_at) >= iniMes), ant = val.filter(o => { const x = new Date(o.created_at); return x >= iniAnt && x <= finAnt; });
  const vMes = sumT(mes), vAnt = sumT(ant), F = [];
  if (vMes > 0) F.push(['💰', `Este mes llevás vendido <b>${fmt(vMes)}</b>${vAnt > 0 ? `, ${pctTxt(vMes, vAnt)} que en los mismos días del mes pasado` : ''}.`]);
  else F.push(['💤', `Este mes todavía no entraron pedidos.${vAnt > 0 ? ` El mes pasado, a esta altura, llevabas ${fmt(vAnt)}.` : ''} Compartí tu enlace para arrancar.`]);
  // el mejor día de la semana: últimas 8 semanas, con 5 pedidos o más
  const L8 = val.filter(o => ahora - new Date(o.created_at) <= 56 * 864e5);
  if (L8.length >= 5) {
    const por = [0, 0, 0, 0, 0, 0, 0]; L8.forEach(o => { por[new Date(o.created_at).getDay()] += Number(o.total_ars); });
    const tot = por.reduce((a, b) => a + b, 0), best = por.indexOf(Math.max(...por));
    if (tot > 0) F.push(['📅', `Tu mejor día es el <b>${DIAS[best]}</b>: ahí entra el ${Math.round(por[best] / tot * 100)}% de lo que vendés.`]);
  }
  // por mayor y por menor (este mes; si todavía no vendió, los últimos 30 días)
  if ((P.t && P.t.modalidad) !== 'minorista') {
    const base = mes.length ? mes : val.filter(o => ahora - new Date(o.created_at) <= 30 * 864e5), tot = sumT(base), may = sumT(base.filter(o => o.modalidad_precio === 'mayorista'));
    if (tot > 0 && may > 0) F.push(['📦', may >= tot ? `Todo lo que vendiste ${mes.length ? 'este mes' : 'en los últimos 30 días'} fue por mayor.` : `El <b>${Math.round(may / tot * 100)}%</b> de lo que vendés ${mes.length ? 'este mes ' : ''}es por mayor y el ${100 - Math.round(may / tot * 100)}%, por menor.`]);
  }
  // la ganancia (con el costo de cada producto el día que se vendió)
  if (pro) {
    const g = gananciaDe(mes), gA = gananciaDe(ant);
    if (g != null) F.push(['📈', `De lo que vendiste este mes te quedan unos <b>${fmt(g)}</b> de ganancia, antes de gastos${gA > 0 ? ` (${pctTxt(g, gA).replace(/<\/?b>/g, '')} que en los mismos días del mes pasado)` : ''}.`]);
  }
  const pend = (P.pedidos || []).filter(o => o.estado === 'pendiente' && (o.etapa || '') !== 'cancelado'), falta = pend.reduce((s, o) => s + saldo(o), 0);
  if (falta > 0) F.push(['⏳', `Te falta cobrar <b>${fmt(falta)}</b> de ${pend.length} ${pend.length === 1 ? 'pedido' : 'pedidos'}${pend.some(o => Number(o.sena_ars) > 0) ? ', ya descontadas las señas' : ''}.`]);
  return F;
}
function criolloHtml(pro) {
  const F = criollo(pro);
  return F.length ? `<div class="cc criollo" id="criollo"><h3>🗣️ Tu negocio, en criollo</h3><ul class="criollo-l">${F.map(([i, t]) => `<li><span class="criollo-i" aria-hidden="true">${i}</span><span>${t}</span></li>`).join('')}</ul></div>` : '';
}

export function vistaResumen(urlTienda) {
  const t = P.t, M = calcular(), pro = can('dashboard');
  const pendTot = P.pedidos.filter(o => o.estado === 'pendiente').length;
  const kp = `<div class="kpis"><div class="kpi"><small>Ventas (${D.rango} d)</small><b>${fmt(M.ventas)}</b><i>${delta(M.ventas, M.ventasPrev)}</i></div>
    <div class="kpi"><small>Pedidos</small><b>${M.cur.length}</b><i>${delta(M.cur.length, M.prev.length)}</i></div>
    <div class="kpi"><small>Ticket promedio</small><b>${fmt(M.cur.length ? M.ventas / M.cur.length : 0)}</b><i>${pendTot} pendientes de cobro</i></div>
    <div class="kpi"><small>Cobrado / por cobrar</small><b>${fmt(M.cobrado)}</b><i>${fmt(M.pend)} pendiente</i></div>
    ${pro ? `<div class="kpi" title="Ganancia sobre lo vendido, usando el costo actual de cada producto"><small>Ganancia estimada${D.cat ? ' · ' + esc(D.cat) : ''}</small><b>${M.margen == null ? '—' : fmt(M.margen)}</b><i>${M.margenPct == null ? 'sin datos' : M.margenPct + '% de lo vendido'}</i></div>
    <div class="kpi"><small>Recompra</small><b>${M.recompra}%</b><i>${M.nCli} clientes</i></div>` : ''}</div>`;
  const enlace = `<div class="card"><b>Tu enlace para clientes</b><div class="hint" style="word-break:break-all;margin:6px 0">${esc(urlTienda)}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p btn-sm" data-act="p-copiar" data-v="${esc(urlTienda)}">Copiar enlace</button><a class="btn btn-s btn-sm" href="${esc(urlTienda)}" target="_blank" rel="noopener">Ver mi tienda</a><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${esc(waLink('', 'Mirá mi catálogo: ' + urlTienda + (urlTienda.includes('?') ? '&' : '?') + 'o=wa').replace('phone=&', ''))}">Compartir por WhatsApp</a></div></div>`;
  const ctl = `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;margin-bottom:12px"><div class="seg" role="group" aria-label="Período">${[7, 30, 90].map(n => `<button class="${D.rango === n ? 'on' : ''}" data-act="d-rango" data-n="${n}">${n} días</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Métrica">${[['ventas', 'Ventas $'], ['pedidos', 'Pedidos'], ['unidades', 'Unidades']].map(([k, n]) => `<button class="${D.metrica === k ? 'on' : ''}" data-act="d-met" data-k="${k}">${n}</button>`).join('')}</div></div>`;
  if (!pro) { const s = stats(7); return enlace + kp + criolloHtml(false) + (s ? `<div class="grid2 est-g">${pulsoHtml(s)}${anticipoHtml(s)}</div>` : '') + ultimos(); }
  const st = stats(D.rango);
  const f = D.metrica === 'ventas' ? fmt : n => String(Math.round(n));
  const pts = [...M.dias.entries()].map(([k, b]) => ({ x: corto(k), v: b[D.metrica], tip: corto(k) + ' · ' + (D.metrica === 'ventas' ? fmt(b.ventas) : D.metrica === 'pedidos' ? b.pedidos + ' pedidos' : b.unidades + ' unidades') }));
  const sinDatos = !M.cur.length;
  // punto de equilibrio mensual
  let eq = '';
  if (Number(t.gastos_fijos) > 0) {
    const mp = M.margenPct != null ? M.margenPct / 100 : null, mes = M.ventas / D.rango * 30;
    eq = mp > 0 ? (() => { const need = Number(t.gastos_fijos) / mp, pct = Math.min(100, Math.round(mes / need * 100)); return `<div class="cc"><h3>⚖️ Punto de equilibrio</h3><p class="muted" style="font-size:.82rem">Con gastos fijos de ${fmt(t.gastos_fijos)}/mes y un margen de ${M.margenPct}%, necesitás vender <b>${fmt(need)}</b> por mes. Ritmo actual: <b>${fmt(mes)}</b>.</p><div class="bar" style="margin-top:8px"><i style="width:${pct}%"></i></div><div class="hint">${pct}% del equilibrio</div></div>`; })() : `<div class="cc"><h3>⚖️ Punto de equilibrio</h3><p class="muted">Todavía no hay ventas con costo cargado para calcularlo.</p></div>`;
  } else eq = `<div class="cc"><h3>⚖️ Punto de equilibrio</h3><p class="muted" style="font-size:.82rem">Cargá tus gastos fijos mensuales en <b>Ajustes</b> y te decimos cuánto necesitás vender.</p></div>`;
  const crit = P.prods.filter(p => p.activo && p.stock != null && p.stock <= 3).sort((a, b) => a.stock - b.stock).slice(0, 6);
  const cartV = P.carritos.reduce((s, c) => s + Number(c.total_ars), 0);
  return enlace + ctl + kp + criolloHtml(true) + (st ? statsProHtml(st, urlTienda) : '') + `<div class="cc"><h3>Evolución</h3>${sinDatos ? '<p class="muted">Todavía no hay pedidos en este período. Compartí tu enlace para empezar.</p>' : linea(pts, { fmt: f, label: 'Evolución de ' + D.metrica })}</div>
  <div class="grid2"><div class="cc"><h3>Top productos${D.cat ? ' · ' + esc(D.cat) + ' <button class="tag" data-act="d-cat" data-c="">✕</button>' : ''}</h3>${barras(M.topP.map(x => ({ label: x.label, v: x.v, tip: x.label + ' · ' + x.u + ' u. · ' + fmt(x.v) })), fmt)}</div>
  <div class="cc"><h3>Ventas por categoría</h3>${dona(M.cats, fmt, D.cat)}<p class="hint" style="margin-top:6px">Tocá una categoría para filtrar el ranking.</p></div>
  <div class="cc"><h3>Minorista vs. mayorista</h3>${dona(M.mod, fmt, null, false)}</div>
  <div class="cc"><h3>Mejores clientes</h3>${barras(M.topC.map(c => ({ label: c.n, v: c.v, tip: c.n + ' · ' + c.p + ' pedidos' })), fmt)}</div></div>
  ${eq}
  <div class="grid2"><div class="cc"><h3>⚠️ Stock crítico</h3>${crit.length ? crit.map(p => `<div class="srow"><span>${esc(p.nombre)}</span><span class="v">${p.stock}</span></div>`).join('') : '<p class="muted">Sin alertas (o sin control de stock activado).</p>'}</div>
  <div class="cc"><h3>🛒 Carritos sin cerrar</h3><p>${P.carritos.length} carritos · ${fmt(cartV)} potenciales</p><button class="btn btn-s btn-sm" data-act="p-tab" data-k="carritos" style="margin-top:8px">Recuperar ventas</button></div></div>` + ultimos();
}
function ultimos() {
  const E = { pendiente: '🟡', cobrado: '🟢', cancelado: '⚪' };
  return `<div class="cc"><h3>Últimos pedidos</h3>${P.pedidos.slice(0, 5).map(o => `<div class="srow" style="cursor:pointer" data-act="p-pedido" data-id="${o.id}"><span>#${o.numero} · ${esc(o.cliente_nombre)}<br><small class="muted">${E[o.estado]} ${o.estado} · ${new Date(o.created_at).toLocaleDateString('es-AR')}</small></span><span class="v">${fmt(o.total_ars)}</span></div>`).join('') || '<p class="muted">Sin pedidos todavía.</p>'}</div>`;
}
on('d-rango', d => { D.rango = +d.n; P.repintar(); });
on('d-met', d => { D.metrica = d.k; P.repintar(); });
on('d-cat', d => { D.cat = D.cat === d.c || !d.c ? null : d.c; P.repintar(); });

// tooltip
let tip;
const mostrar = e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (!el) return ocultar(); tip = tip || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'tip', role: 'tooltip' }));
  tip.textContent = el.dataset.tip; tip.style.display = 'block'; const r = el.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(innerWidth - 230, r.left + r.width / 2 - 60)) + 'px'; tip.style.top = Math.max(8, r.top - 38) + 'px'; };
const ocultar = () => { if (tip) tip.style.display = 'none'; };
document.addEventListener('mouseover', mostrar); document.addEventListener('focusin', mostrar); document.addEventListener('mouseout', ocultar); document.addEventListener('focusout', ocultar);
document.addEventListener('touchstart', e => { if (e.target.closest && e.target.closest('[data-tip]')) mostrar(e); else ocultar(); }, { passive: true });
