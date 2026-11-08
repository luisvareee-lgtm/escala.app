// Dashboard interactivo: KPIs, ventas por día, top productos, categorías, clientes, equilibrio, stock y carritos.
import { esc, fmt, on, $, waLink } from './util.js';
import { P, can, aviso, precioArs } from './state.js';
import { linea, barras, dona } from './charts.js';

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
  return { cur, prev, dias, ventas: sum(cur), ventasPrev: sum(prev), cobrado: sum(cur.filter(o => o.estado === 'cobrado')), pend: sum(cur.filter(o => o.estado === 'pendiente')),
    topP: [...topP.entries()].map(([label, x]) => ({ label, v: x.v, u: x.u })).sort((a, b) => b.v - a.v).slice(0, 7),
    cats: [...cats.entries()].map(([label, v]) => ({ label, v })).sort((a, b) => b.v - a.v).slice(0, 6),
    topC: [...cli.values()].sort((a, b) => b.v - a.v).slice(0, 5), recompra, nCli: todosCli.size,
    mod: [...mod.entries()].map(([label, v]) => ({ label: label === 'mayorista' ? 'Mayorista' : 'Minorista', v })),
    margen: conCosto ? conCosto - costo : null, margenPct: conCosto ? Math.round((conCosto - costo) / conCosto * 100) : null };
}
const delta = (a, b) => b > 0 ? (a >= b ? '▲ ' : '▼ ') + Math.abs(Math.round((a - b) / b * 100)) + '% vs. período anterior' : 'sin período anterior';

export function vistaResumen(urlTienda) {
  const t = P.t, M = calcular(), pro = can('dashboard');
  const pendTot = P.pedidos.filter(o => o.estado === 'pendiente').length;
  const kp = `<div class="kpis"><div class="kpi"><small>Ventas (${D.rango} d)</small><b>${fmt(M.ventas)}</b><i>${delta(M.ventas, M.ventasPrev)}</i></div>
    <div class="kpi"><small>Pedidos</small><b>${M.cur.length}</b><i>${delta(M.cur.length, M.prev.length)}</i></div>
    <div class="kpi"><small>Ticket promedio</small><b>${fmt(M.cur.length ? M.ventas / M.cur.length : 0)}</b><i>${pendTot} pendientes de cobro</i></div>
    <div class="kpi"><small>Cobrado / por cobrar</small><b>${fmt(M.cobrado)}</b><i>${fmt(M.pend)} pendiente</i></div>
    ${pro ? `<div class="kpi" title="Ganancia sobre lo vendido, usando el costo actual de cada producto"><small>Ganancia estimada${D.cat ? ' · ' + esc(D.cat) : ''}</small><b>${M.margen == null ? '—' : fmt(M.margen)}</b><i>${M.margenPct == null ? 'sin datos' : M.margenPct + '% de lo vendido'}</i></div>
    <div class="kpi"><small>Recompra</small><b>${M.recompra}%</b><i>${M.nCli} clientes</i></div>` : ''}</div>`;
  const enlace = `<div class="card"><b>Tu enlace para clientes</b><div class="hint" style="word-break:break-all;margin:6px 0">${esc(urlTienda)}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p btn-sm" data-act="p-copiar" data-v="${esc(urlTienda)}">Copiar enlace</button><a class="btn btn-s btn-sm" href="${esc(urlTienda)}" target="_blank" rel="noopener">Ver mi tienda</a><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${esc(waLink('', 'Mirá mi catálogo: ' + urlTienda).replace('phone=&', ''))}">Compartir por WhatsApp</a></div></div>`;
  const ctl = `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;margin-bottom:12px"><div class="seg" role="group" aria-label="Período">${[7, 30, 90].map(n => `<button class="${D.rango === n ? 'on' : ''}" data-act="d-rango" data-n="${n}">${n} días</button>`).join('')}</div>
    <div class="seg" role="group" aria-label="Métrica">${[['ventas', 'Ventas $'], ['pedidos', 'Pedidos'], ['unidades', 'Unidades']].map(([k, n]) => `<button class="${D.metrica === k ? 'on' : ''}" data-act="d-met" data-k="${k}">${n}</button>`).join('')}</div></div>`;
  if (!pro) return enlace + kp + `<div class="locked"><b>📈 Dashboard completo</b><p style="margin:6px 0">Gráficos de ventas, top productos, categorías, clientes, margen y punto de equilibrio.</p><span class="tag warn">🔒 Plan Mayorista Pro</span></div>` + ultimos();
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
  return enlace + ctl + kp + `<div class="cc"><h3>Evolución</h3>${sinDatos ? '<p class="muted">Todavía no hay pedidos en este período. Compartí tu enlace para empezar.</p>' : linea(pts, { fmt: f, label: 'Evolución de ' + D.metrica })}</div>
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
