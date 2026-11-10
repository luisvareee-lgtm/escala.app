// Asistente del negocio: cobranzas (quién te debe y hace cuánto), reposición inteligente
// (días de stock y qué comprar a cada proveedor) y ventas en dólares (crecimiento real).
import { api } from './api.js';
import { esc, fmt, on, toast, copiar, normWsp, waLink, store } from './util.js';
import { P, can, aviso } from './state.js';
import { linea } from './charts.js';
import { vistaCompras, calcCompra } from './compras.js';

const I = { vista: 'cobranzas', abierto: null };
const CFG = () => Object.assign({ periodo: 60, demora: 7, cubrir: 30 }, store.get('rep:' + (P.t && P.t.id), {}) || {});
export const resetInt = () => Object.assign(I, { vista: 'cobranzas', abierto: null });
const DIA = 864e5;
const dias = d => Math.floor((Date.now() - new Date(d)) / DIA);
const usd = n => 'US$ ' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const pct = n => n == null || !isFinite(n) ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(Math.round(n)) + '%';

export function vistaInteligente() {
  // por encargo no tiene depósito: no se muestra Reposición
  const tabs = [['cobranzas', '💸 Cobranzas'], ['compras', '🛒 Pedido al proveedor'], ...((P.t.modo_stock || 'stock') === 'encargo' ? [] : [['reposicion', '📦 Reposición']]), ['dolares', '💵 En dólares']];
  if (!tabs.some(t => t[0] === I.vista)) I.vista = 'cobranzas';
  const cuerpo = I.vista === 'cobranzas' ? cobranzas() : I.vista === 'compras' ? vistaCompras() : I.vista === 'reposicion' ? reposicion() : dolares();
  return `<div class="seg" role="tablist" aria-label="Herramientas" style="margin-bottom:12px">${tabs.map(([k, n]) => `<button role="tab" aria-selected="${I.vista === k}" class="${I.vista === k ? 'on' : ''}" data-act="ia-vista" data-k="${k}">${n}</button>`).join('')}</div>${cuerpo}`;
}

/* ================= COBRANZAS ================= */
const TRAMOS = [[0, 7, '0 a 7 días', ''], [8, 15, '8 a 15 días', 'warn'], [16, 30, '16 a 30 días', 'warn'], [31, 1e9, 'Más de 30 días', 'bad']];
export function deudas() {
  const L = P.pedidos.filter(o => o.estado === 'pendiente' && (o.etapa || 'nuevo') !== 'cancelado');
  const cli = new Map();
  for (const o of L) {
    const k = o.cliente_whatsapp, c = cli.get(k) || { nombre: o.cliente_nombre, wsp: k, pedidos: [], total: 0, max: 0, rec: null };
    c.pedidos.push(o); c.total += Number(o.total_ars); c.max = Math.max(c.max, dias(o.created_at));
    if (o.recordatorio_at && (!c.rec || o.recordatorio_at > c.rec)) c.rec = o.recordatorio_at;
    cli.set(k, c);
  }
  const tramos = TRAMOS.map(([a, b, n, cl]) => { const os = L.filter(o => { const d = dias(o.created_at); return d >= a && d <= b; }); return { n, cl, cant: os.length, total: os.reduce((s, o) => s + Number(o.total_ars), 0) }; });
  return { L, total: L.reduce((s, o) => s + Number(o.total_ars), 0), tramos, clientes: [...cli.values()].sort((a, b) => b.max - a.max || b.total - a.total) };
}
function msgCobro(c) {
  const t = P.t, n = c.nombre.split(' ')[0];
  const det = c.pedidos.map(o => `• Pedido #${o.numero} del ${new Date(o.created_at).toLocaleDateString('es-AR')}: ${fmt(o.total_ars)}`).join('\n');
  return `Hola ${n}, ¿cómo estás? Te escribo de ${t.nombre} por ${c.pedidos.length > 1 ? 'tus pedidos pendientes de pago' : 'tu pedido pendiente de pago'}:\n${det}\n${c.pedidos.length > 1 ? 'Total: ' + fmt(c.total) + '\n' : ''}${t.alias_cobro ? 'Podés transferir a: ' + t.alias_cobro + '\n' : ''}Cuando lo envíes, mandame el comprobante por acá. ¡Gracias!`;
}
function cobranzas() {
  const D = deudas();
  if (!D.L.length) return `<div class="cc"><h3>💸 Cobranzas</h3><p class="ok-box">No tenés pedidos pendientes de cobro. 🎉</p></div>`;
  const hoy = new Date().toDateString();
  return `<div class="kpis cob-kpis"><div class="kpi"><small>Te deben</small><b>${fmt(D.total)}</b><i>${D.L.length} ${D.L.length === 1 ? 'pedido' : 'pedidos'} · ${D.clientes.length} ${D.clientes.length === 1 ? 'cliente' : 'clientes'}</i></div>
    ${D.tramos.map(t => `<div class="kpi cob-${t.cl || 'ok'}"><small>${t.n}</small><b>${fmt(t.total)}</b><i>${t.cant} ${t.cant === 1 ? 'pedido' : 'pedidos'}</i></div>`).join('')}</div>
  <div class="cc"><h3>Quién te debe</h3><p class="hint" style="margin-bottom:8px">Ordenado por el pedido más viejo. El botón abre WhatsApp con el mensaje armado (pedidos, total y tu alias) y anota la fecha del recordatorio.</p>
  ${D.clientes.map(c => { const rh = c.rec && new Date(c.rec).toDateString() === hoy; const cls = c.max > 30 ? 'bad' : c.max > 7 ? 'warn' : '';
    return `<div class="cob-row"><div class="cob-inf"><b>${esc(c.nombre)}</b> <span class="tag ${cls}">${c.max === 0 ? 'hoy' : 'hace ' + c.max + (c.max === 1 ? ' día' : ' días')}</span>
      <div class="muted" style="font-size:.78rem">${c.pedidos.map(o => `<button class="linkb" data-act="p-pedido" data-id="${o.id}">#${o.numero}</button> ${fmt(o.total_ars)}`).join(' · ')}${c.rec ? ` · último recordatorio: ${rh ? 'hoy' : new Date(c.rec).toLocaleDateString('es-AR')}` : ''}</div></div>
      <div class="cob-acc"><b>${fmt(c.total)}</b><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" data-act="ia-recordar" data-w="${esc(c.wsp)}" href="${esc(waLink(normWsp(c.wsp), msgCobro(c)))}">${rh ? 'Recordar otra vez' : 'Recordar pago'}</a></div></div>`; }).join('')}</div>`;
}
on('ia-recordar', async d => {
  const ids = P.pedidos.filter(o => o.cliente_whatsapp === d.w && o.estado === 'pendiente' && (o.etapa || 'nuevo') !== 'cancelado').map(o => o.id);
  const ahora = new Date().toISOString();
  try { await Promise.all(ids.map(id => api.actualizarPedido(id, { recordatorio_at: ahora }))); P.pedidos.forEach(o => { if (ids.includes(o.id)) o.recordatorio_at = ahora; }); setTimeout(P.repintar, 300); } catch (e) { toast(e.message); }
});

/* ================= REPOSICIÓN ================= */
export function calcReposicion(cfg) {
  const t = P.t, cot = Number(t.cotizacion_usd), desde = Date.now() - cfg.periodo * DIA;
  const validos = new Map(P.pedidos.filter(o => o.estado !== 'cancelado' && (o.etapa || 'nuevo') !== 'cancelado').map(o => [o.id, o]));
  const vend = new Map(), reserv = new Map();
  for (const i of P.items) {
    const o = validos.get(i.order_id); if (!o || !i.product_id) continue;
    if (new Date(o.created_at) >= desde) vend.set(i.product_id, (vend.get(i.product_id) || 0) + i.cantidad);
    if (o.estado === 'pendiente') reserv.set(i.product_id, (reserv.get(i.product_id) || 0) + i.cantidad);   // todavía no descontado del stock
  }
  const provPor = new Map(); (P.provs || []).filter(s => s.disponible !== false).forEach(s => { const a = provPor.get(s.product_id); if (!a || Number(s.costo_usd) < Number(a.costo_usd)) provPor.set(s.product_id, s); });
  const conStock = P.prods.filter(p => p.activo && p.stock != null), sinControl = P.prods.filter(p => p.activo && p.stock == null).length;
  const filas = conStock.map(p => {
    const u = vend.get(p.id) || 0, diario = u / cfg.periodo, disp = Math.max(0, p.stock - (reserv.get(p.id) || 0));
    const quedan = diario > 0 ? disp / diario : null;
    const sug = diario > 0 ? Math.max(0, Math.ceil(diario * (cfg.demora + cfg.cubrir) - disp)) : 0;
    const pv = provPor.get(p.id), cu = pv ? Number(pv.costo_usd) : Number(p.costo_usd);
    const est = disp <= 0 && diario > 0 ? 'agotado' : quedan != null && quedan <= cfg.demora ? 'ya' : quedan != null && quedan <= cfg.demora + 7 ? 'pronto' : diario === 0 ? (disp > 0 ? 'parado' : 'sin') : 'ok';
    return { p, u, diario, disp, quedan, sug, prov: pv ? pv.proveedor : null, cu, costo: sug * cu * cot, est };
  });
  const ORD = { agotado: 0, ya: 1, pronto: 2, ok: 3, parado: 4, sin: 5 };
  filas.sort((a, b) => ORD[a.est] - ORD[b.est] || (a.quedan ?? 1e9) - (b.quedan ?? 1e9));
  const grupos = new Map(); filas.filter(f => f.sug > 0 && ['agotado', 'ya', 'pronto'].includes(f.est)).forEach(f => { const k = f.prov || 'Sin proveedor cargado'; const g = grupos.get(k) || { prov: k, filas: [], total: 0 }; g.filas.push(f); g.total += f.costo; grupos.set(k, g); });
  return { filas, grupos: [...grupos.values()].sort((a, b) => b.total - a.total), sinControl, parado: filas.filter(f => f.est === 'parado') };
}
const EST = { agotado: ['bad', 'Agotado'], ya: ['bad', 'Pedir ya'], pronto: ['warn', 'Pedir pronto'], ok: ['ok', 'Bien'], parado: ['', 'Sin ventas'], sin: ['', 'Sin stock ni ventas'] };
function textoPedido(g) {
  return `Hola! Te paso el pedido de ${P.t.nombre}:\n` + g.filas.map(f => `• ${f.sug} × ${f.p.nombre}${f.p.sku ? ' (' + f.p.sku + ')' : ''}`).join('\n') + '\n¿Me confirmás stock y precio? Gracias.';
}
function reposicion() {
  if (!can('stock')) return `<div class="locked"><b>📦 Reposición inteligente</b><p style="margin:6px 0">Te dice cuántos días de stock te quedan de cada producto y qué comprarle a cada proveedor.</p><span class="tag warn">🔒 Plan Mayorista Pro</span><br><button class="btn btn-p btn-sm lock-cta" data-act="p-planes" data-p="pro">Ver planes y activar</button></div>`;
  const c = CFG(), R = calcReposicion(c), urg = R.filas.filter(f => ['agotado', 'ya', 'pronto'].includes(f.est));
  const sel = (k, v, ops) => `<select class="fi" data-change="ia-cfg" data-k="${k}" aria-label="${k}">${ops.map(o => `<option value="${o}" ${+v === o ? 'selected' : ''}>${o} días</option>`).join('')}</select>`;
  return `<div class="cc"><h3>⚙️ Cómo calculamos</h3><div class="rep-cfg"><label>Mirar las ventas de los últimos ${sel('periodo', c.periodo, [30, 60, 90])}</label><label>Tu proveedor tarda ${sel('demora', c.demora, [1, 2, 3, 5, 7, 10, 15, 21, 30])}</label><label>Comprar para cubrir ${sel('cubrir', c.cubrir, [7, 15, 30, 45, 60, 90])}</label></div>
    <p class="hint">Días que te quedan = stock disponible (sin lo reservado en pedidos por cobrar) ÷ lo que vendés por día. Sugerido = lo que vas a vender mientras llega y en los días a cubrir, menos lo que tenés.${R.sinControl ? ` ${R.sinControl} productos no tienen stock cargado y no entran en el cálculo.` : ''}</p></div>
  <div class="kpis"><div class="kpi cob-bad"><small>Pedir ya o agotados</small><b>${R.filas.filter(f => f.est === 'ya' || f.est === 'agotado').length}</b><i>se acaban antes de que llegue la compra</i></div><div class="kpi cob-warn"><small>Pedir pronto</small><b>${R.filas.filter(f => f.est === 'pronto').length}</b><i>alcanzan para menos de ${c.demora + 7} días</i></div>
    <div class="kpi"><small>Compra sugerida</small><b>${fmt(R.grupos.reduce((s, g) => s + g.total, 0))}</b><i>${R.grupos.length} ${R.grupos.length === 1 ? 'proveedor' : 'proveedores'}</i></div><div class="kpi"><small>Sin ventas en ${c.periodo} días</small><b>${R.parado.length}</b><i>${fmt(R.parado.reduce((s, f) => s + f.disp * Number(f.p.costo_usd) * Number(P.t.cotizacion_usd), 0))} parados al costo</i></div></div>
  ${R.grupos.length ? `<div class="cc"><h3>🛒 Qué comprar, por proveedor</h3>${R.grupos.map((g, i) => `<details class="rep-g" ${i === 0 ? 'open' : ''}><summary><b>${esc(g.prov)}</b> · ${g.filas.length} ${g.filas.length === 1 ? 'producto' : 'productos'} · <b>${fmt(g.total)}</b></summary>
      ${g.filas.map(f => `<div class="srow"><span>${f.sug} × ${esc(f.p.nombre)}<br><small class="muted">quedan ${f.disp} · vendés ${f.diario.toFixed(1).replace('.', ',')}/día · US$ ${f.cu.toFixed(2).replace('.', ',')} c/u</small></span><span class="v">${fmt(f.costo)}</span></div>`).join('')}
      <button class="btn btn-s btn-sm" style="margin-top:8px" data-act="ia-copiar-ped" data-i="${i}">📋 Copiar pedido para mandarle</button></details>`).join('')}
      <p class="hint" style="margin-top:8px">El proveedor sale del comparador de proveedores (Precios); si no hay, se usa tu costo actual.</p></div>` : ''}
  <div class="cc"><h3>Días de stock por producto</h3>${R.filas.length ? `<div class="tblw"><table class="tbl rep-t"><thead><tr><th>Producto</th><th class="r">Disponible</th><th class="r">Vende/día</th><th class="r">Le quedan</th><th class="r">Sugerido</th><th>Estado</th></tr></thead><tbody>
    ${(I.abierto ? R.filas : R.filas.slice(0, 40)).map(f => `<tr><td><button class="linkb" data-act="p-editar" data-id="${f.p.id}">${esc(f.p.nombre)}</button></td><td class="r">${f.disp}</td><td class="r">${f.diario ? f.diario.toFixed(1).replace('.', ',') : '—'}</td><td class="r">${f.quedan == null ? '—' : f.quedan >= 365 ? '+1 año' : Math.floor(f.quedan) + ' d'}</td><td class="r">${f.sug || '—'}</td><td><span class="tag ${EST[f.est][0]}">${EST[f.est][1]}</span></td></tr>`).join('')}</tbody></table></div>
    ${R.filas.length > 40 && !I.abierto ? `<button class="btn btn-s btn-sm" data-act="ia-todos">Ver los ${R.filas.length}</button>` : ''}` : '<p class="muted">Cargá el stock en tus productos para usar esta herramienta.</p>'}
    ${urg.length ? '' : R.filas.length ? '<p class="ok-box" style="margin-top:8px">Nada urgente para reponer con esta configuración.</p>' : ''}</div>`;
}
on('ia-cfg', (d, el) => { const c = CFG(); c[d.k] = Number(el.value); store.set('rep:' + P.t.id, c); P.repintar(); });
on('ia-todos', () => { I.abierto = true; P.repintar(); });
on('ia-copiar-ped', d => { const g = calcReposicion(CFG()).grupos[+d.i]; if (g) copiar(textoPedido(g)); });

/* ================= EN DÓLARES ================= */
export function calcDolares(meses = 12) {
  const cotHoy = Number(P.t.cotizacion_usd), h = new Date(), M = [];
  for (let i = meses - 1; i >= 0; i--) { const a = new Date(h.getFullYear(), h.getMonth() - i, 1); M.push({ a, b: new Date(a.getFullYear(), a.getMonth() + 1, 1), ars: 0, usd: 0, gan: 0, ganArs: 0, n: 0 }); }
  const itemsPor = new Map(); P.items.forEach(i => { const l = itemsPor.get(i.order_id) || []; l.push(i); itemsPor.set(i.order_id, l); });
  const prodPor = new Map(P.prods.map(p => [p.id, p]));
  for (const o of P.pedidos) {
    if (o.estado === 'cancelado') continue;
    const d = new Date(o.created_at), m = M.find(x => d >= x.a && d < x.b); if (!m) continue;
    const cot = Number(o.cotizacion_usd) || cotHoy, venta = Number(o.total_ars) - Number(o.envio_costo || 0);
    let costo = 0; (itemsPor.get(o.id) || []).forEach(i => { const p = prodPor.get(i.product_id); const cu = i.costo_unitario != null ? Number(i.costo_unitario) : p ? Number(p.costo_usd) * cot : 0; costo += cu * i.cantidad; });
    m.ars += venta; m.usd += venta / cot; m.ganArs += venta - costo; m.gan += (venta - costo) / cot; m.n++;
  }
  M.forEach((m, i) => { const p = M[i - 1]; m.varArs = p && p.ars ? (m.ars / p.ars - 1) * 100 : null; m.varUsd = p && p.usd ? (m.usd / p.usd - 1) * 100 : null; m.cot = m.usd ? m.ars / m.usd : null; m.nombre = m.a.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }); });
  return M;
}
function dolares() {
  if (!can('usd')) return `<div class="locked"><b>💵 Ventas en dólares</b><p style="margin:6px 0">Con inflación, vender más pesos no siempre es crecer. Medí tus ventas y tu ganancia en dólares, con la cotización de cada pedido.</p><span class="tag warn">🔒 Plan Mayorista Pro</span><br><button class="btn btn-p btn-sm lock-cta" data-act="p-planes" data-p="pro">Ver planes y activar</button></div>`;
  const M = calcDolares(12), act = M[M.length - 1], ant = M[M.length - 2], ant2 = M[M.length - 3];
  const hayDatos = M.some(m => m.n);
  if (!hayDatos) return `<div class="cc"><h3>💵 Ventas en dólares</h3><p class="muted">Todavía no hay pedidos para comparar.</p></div>`;
  const vArs = ant2 && ant2.ars ? (ant.ars / ant2.ars - 1) * 100 : null, vUsd = ant2 && ant2.usd ? (ant.usd / ant2.usd - 1) * 100 : null;
  const lectura = vArs == null || vUsd == null ? '' : vArs > 0 && vUsd < 0 ? `En pesos vendiste ${pct(vArs)}, pero en dólares ${pct(vUsd)}: ese aumento es inflación o dólar, no más ventas.` : vUsd > 0 ? `Creciste de verdad: ${pct(vUsd)} en dólares (en pesos ${pct(vArs)}).` : `Bajaste en dólares (${pct(vUsd)}) y en pesos (${pct(vArs)}).`;
  const desdeMes = Date.now() - new Date(act.a).getTime(), diasMes = Math.max(1, Math.round(desdeMes / DIA)), totalDias = Math.round((act.b - act.a) / DIA);
  return `<div class="kpis"><div class="kpi"><small>Este mes (${diasMes} de ${totalDias} días)</small><b>${usd(act.usd)}</b><i>${fmt(act.ars)} · proyectado ${usd(act.usd / diasMes * totalDias)}</i></div>
    <div class="kpi"><small>Ganancia del mes en dólares</small><b class="${act.gan < 0 ? 'neg' : ''}">${usd(act.gan)}</b><i>${act.ars ? Math.round(act.ganArs / act.ars * 100) + '% de margen' : 'sin ventas'}</i></div>
    <div class="kpi"><small>Mes pasado vs. anterior · pesos</small><b>${pct(vArs)}</b><i>${fmt(ant.ars)}</i></div>
    <div class="kpi"><small>Mes pasado vs. anterior · dólares</small><b class="${vUsd != null && vUsd < 0 ? 'neg' : vUsd > 0 ? 'pos' : ''}">${pct(vUsd)}</b><i>${usd(ant.usd)}</i></div></div>
  ${lectura ? `<div class="${vUsd < 0 ? 'err-box' : 'ok-box'}" style="margin-bottom:12px">${esc(lectura)}</div>` : ''}
  <div class="cc"><h3>Ventas en dólares, últimos 12 meses</h3>${linea(M.map(m => ({ x: m.nombre, v: Math.round(m.usd), tip: m.nombre + ' · ' + usd(m.usd) + ' · ' + fmt(m.ars) })), { fmt: n => 'US$' + n.toLocaleString('es-AR'), label: 'Ventas en dólares por mes' })}</div>
  <div class="cc"><h3>Mes por mes</h3><div class="tblw"><table class="tbl"><thead><tr><th>Mes</th><th class="r">Pedidos</th><th class="r">En pesos</th><th class="r">Var. $</th><th class="r">En dólares</th><th class="r">Var. US$</th><th class="r">Ganancia US$</th><th class="r">Dólar prom.</th></tr></thead><tbody>
    ${M.slice().reverse().filter(m => m.n).map(m => `<tr><td>${m.nombre}</td><td class="r">${m.n}</td><td class="r">${fmt(m.ars)}</td><td class="r">${pct(m.varArs)}</td><td class="r"><b>${usd(m.usd)}</b></td><td class="r ${m.varUsd < 0 ? 'neg' : m.varUsd > 0 ? 'pos' : ''}">${pct(m.varUsd)}</td><td class="r">${usd(m.gan)}</td><td class="r">${m.cot ? fmt(m.cot) : '—'}</td></tr>`).join('')}</tbody></table></div>
  <p class="hint" style="margin-top:6px">Cada pedido se pasa a dólares con la cotización que tenías cargada el día de la venta. Los envíos no cuentan como venta. Pedidos anteriores a esta versión usan la cotización actual.</p></div>`;
}
on('ia-vista', d => { I.vista = d.k; P.repintar(); });

// Avisos para el Resumen: lo urgente de cobranzas y reposición, con acceso directo.
export function avisosInteligentes() {
  const D = deudas(), viejo = D.tramos[3].total + D.tramos[2].total, out = [];
  if (D.total > 0) out.push(`<button class="ia-aviso ${viejo ? 'bad' : ''}" data-act="ia-ir" data-k="cobranzas"><span class="ia-tx">💸 Te deben <b>${fmt(D.total)}</b>${viejo ? ` · ${fmt(viejo)} hace más de 15 días` : ''}</span><span class="ia-go">Cobrar →</span></button>`);
  if ((P.t.modo_stock || 'stock') !== 'stock') { const C = calcCompra(), u = C.grupos.reduce((a, g) => a + g.unidades, 0); if (u) out.push(`<button class="ia-aviso warn" data-act="ia-ir" data-k="compras"><span class="ia-tx">🛒 Tenés <b>${u} ${u === 1 ? 'unidad' : 'unidades'}</b> para encargar de ${C.ped.length} ${C.ped.length === 1 ? 'pedido' : 'pedidos'}</span><span class="ia-go">Armar pedido →</span></button>`); }
  if (can('stock') && (P.t.modo_stock || 'stock') !== 'encargo') { const R = calcReposicion(CFG()), n = R.filas.filter(f => f.est === 'ya' || f.est === 'agotado').length; if (n) out.push(`<button class="ia-aviso warn" data-act="ia-ir" data-k="reposicion"><span class="ia-tx">📦 <b>${n}</b> ${n === 1 ? 'producto se acaba' : 'productos se acaban'} antes de que llegue la compra</span><span class="ia-go">Reponer →</span></button>`); }
  return out.length ? `<div class="ia-avisos">${out.join('')}</div>` : '';
}
on('ia-ir', d => { I.vista = d.k; P.tab = 'asistente'; P.modal = null; P.repintar(); window.scrollTo(0, 0); });
