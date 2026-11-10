// "Pedido al proveedor": a partir de los pedidos de los clientes, qué hay que comprar y a quién.
// Se adapta a cómo trabaja el comercio: con stock (solo lo que falta), por encargo (todo lo pedido) o las dos.
import { api } from './api.js';
import { esc, fmt, on, toast, copiar, waLink, confirmar } from './util.js';
import { P } from './state.js';

const C = { soloConf: false, abierto: null };
const ETAPAS_ABIERTAS = ['nuevo', 'confirmado', 'en_espera'];
const modo = () => P.t.modo_stock || 'stock';
const encargo = p => modo() === 'encargo' || (modo() === 'mixto' && !!p.a_pedido);

export function calcCompra() {
  const cot = Number(P.t.cotizacion_usd) || 1;
  const ped = P.pedidos.filter(o => o.estado !== 'cancelado' && ETAPAS_ABIERTAS.includes(o.etapa || 'nuevo') && !o.comprado_at && (!C.soloConf || (o.etapa || 'nuevo') !== 'nuevo'));
  const ids = new Set(ped.map(o => o.id)), prodPor = new Map(P.prods.map(p => [p.id, p]));
  const pedidoPor = new Map();      // product_id → { p, total, vars: Map(variante → cant), pedidos:Set }
  P.items.forEach(i => {
    if (!ids.has(i.order_id) || !i.product_id) return;
    const p = prodPor.get(i.product_id); if (!p) return;
    const x = pedidoPor.get(p.id) || { p, total: 0, vars: new Map(), pedidos: new Set() };
    x.total += i.cantidad; x.pedidos.add(i.order_id);
    if (i.variante) x.vars.set(i.variante, (x.vars.get(i.variante) || 0) + i.cantidad);
    pedidoPor.set(p.id, x);
  });
  // proveedor más barato del comparador; si no hay, "sin proveedor"
  const provPor = new Map(); (P.provs || []).filter(s => s.disponible !== false).forEach(s => { const a = provPor.get(s.product_id); if (!a || Number(s.costo_usd) < Number(a.costo_usd)) provPor.set(s.product_id, s); });
  const filas = [], cubiertos = [];
  pedidoPor.forEach(x => {
    const enc = encargo(x.p), stock = x.p.stock;
    // con stock: se compra solo lo que no alcanza a cubrir el depósito (stock sin cargar = no sabemos: se avisa aparte)
    const comprar = enc ? x.total : stock == null ? null : Math.max(0, x.total - Math.max(0, stock));
    const pv = provPor.get(x.p.id), cu = pv ? Number(pv.costo_usd) : Number(x.p.costo_usd);
    const f = { ...x, enc, stock, comprar, prov: pv ? pv.proveedor : null, cu, costo: (comprar || 0) * cu * cot };
    if (comprar === 0) cubiertos.push(f); else filas.push(f);
  });
  const grupos = new Map();
  filas.filter(f => f.comprar > 0).forEach(f => { const k = f.prov || 'Sin proveedor cargado'; const g = grupos.get(k) || { prov: k, filas: [], total: 0, unidades: 0 }; g.filas.push(f); g.total += f.costo; g.unidades += f.comprar; grupos.set(k, g); });
  grupos.forEach(g => g.filas.sort((a, b) => a.p.nombre.localeCompare(b.p.nombre)));
  return { ped, grupos: [...grupos.values()].sort((a, b) => b.total - a.total), sinStock: filas.filter(f => f.comprar === null), cubiertos };
}

function textoProveedor(g) {
  const lin = g.filas.map(f => `• ${f.comprar} × ${f.p.nombre}${f.p.sku ? ' (' + f.p.sku + ')' : ''}${f.vars.size ? ' — ' + [...f.vars.entries()].map(([v, n]) => `${n} ${v}`).join(', ') : ''}`);
  return `Hola! Te paso el pedido de ${P.t.nombre}:\n${lin.join('\n')}\nTotal: ${g.unidades} unidades.\n¿Me confirmás stock, precio y cuándo lo tenés? Gracias.`;
}

export function vistaCompras() {
  const R = calcCompra(), m = modo();
  const intro = { stock: 'Trabajás con stock: acá aparece solo lo que tus pedidos abiertos necesitan y tu depósito no alcanza a cubrir.', encargo: 'Trabajás por encargo: acá se junta todo lo que te pidieron tus clientes, listo para comprárselo al proveedor.', mixto: 'Trabajás con las dos: los productos por encargo entran completos; los que tenés en stock, solo si no te alcanza.' }[m];
  const totalU = R.grupos.reduce((a, g) => a + g.unidades, 0), totalC = R.grupos.reduce((a, g) => a + g.total, 0);
  return `<div class="cc"><h3>🛒 Pedido al proveedor</h3><p class="hint" style="margin-bottom:8px">${intro} <button class="linkb" data-act="p-tab" data-k="ajustes">Cambiar cómo trabajo</button></p>
    <label class="chk"><input type="checkbox" data-change="cp-conf" ${C.soloConf ? 'checked' : ''}> Solo pedidos confirmados (sin los nuevos que todavía no revisaste)</label></div>
  ${!R.ped.length ? '<div class="cc"><p class="ok-box">No hay pedidos abiertos para comprar. Los pedidos despachados, entregados, cancelados o ya comprados no entran.</p></div>' : `
  <div class="kpis"><div class="kpi"><small>Pedidos abiertos</small><b>${R.ped.length}</b><i>${R.ped.map(o => '#' + o.numero).slice(0, 8).join(' ')}${R.ped.length > 8 ? '…' : ''}</i></div>
    <div class="kpi"><small>Para comprar</small><b>${totalU} u.</b><i>${R.grupos.length} ${R.grupos.length === 1 ? 'proveedor' : 'proveedores'}</i></div>
    <div class="kpi"><small>Costo estimado</small><b>${fmt(totalC)}</b><i>con el costo del comparador o el tuyo</i></div></div>
  ${R.grupos.length ? `<div class="cc"><h3>Qué comprar, por proveedor</h3>${R.grupos.map((g, i) => `<details class="rep-g" ${i === 0 || C.abierto === i ? 'open' : ''}><summary><b>${esc(g.prov)}</b> · ${g.unidades} u. · <b>${fmt(g.total)}</b></summary>
      ${g.filas.map(f => `<div class="srow"><span><b>${f.comprar} ×</b> ${esc(f.p.nombre)}${f.vars.size ? `<br><small class="muted">${esc([...f.vars.entries()].map(([v, n]) => `${n} ${v}`).join(' · '))}</small>` : ''}<br><small class="muted">${f.enc ? 'por encargo' : `pedidos ${f.total} · stock ${f.stock}`} · ${f.pedidos.size} ${f.pedidos.size === 1 ? 'pedido' : 'pedidos'}</small></span><span class="v">${fmt(f.costo)}</span></div>`).join('')}
      <div class="lv-acc"><button class="btn btn-s btn-sm" data-act="cp-copiar" data-i="${i}">📋 Copiar pedido</button><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="${esc(waLink('', textoProveedor(g)))}">Mandar por WhatsApp</a></div></details>`).join('')}
    <p class="hint" style="margin-top:8px">El proveedor sale del comparador de proveedores; si no hay, se usa tu costo actual.</p></div>` : ''}
  ${R.sinStock.length ? `<div class="cc"><h3>⚠️ Sin stock cargado</h3><p class="hint" style="margin-bottom:6px">Estos productos tienen pedidos, pero no sabemos cuánto tenés. Cargá el stock o marcalos “por encargo”.</p>${R.sinStock.map(f => `<div class="srow" data-act="p-editar" data-id="${f.p.id}" role="button" tabindex="0" style="cursor:pointer"><span>${esc(f.p.nombre)}</span><span class="v">${f.total} pedidos</span></div>`).join('')}</div>` : ''}
  ${R.cubiertos.length ? `<details class="cc"><summary><b>✅ ${R.cubiertos.length} ${R.cubiertos.length === 1 ? 'producto cubierto' : 'productos cubiertos'} con tu stock</b></summary>${R.cubiertos.map(f => `<div class="srow"><span>${esc(f.p.nombre)}</span><span class="v">${f.total} de ${f.stock}</span></div>`).join('')}</details>` : ''}
  <div class="cc"><h3>¿Ya hiciste la compra?</h3><p class="hint" style="margin-bottom:8px">Marcá estos ${R.ped.length} pedidos como comprados: dejan de aparecer acá y siguen en Pedidos con su etapa.</p>
    <button class="btn btn-p btn-sm" style="width:auto" data-act="cp-marcar">Marcar ${R.ped.length} ${R.ped.length === 1 ? 'pedido' : 'pedidos'} como comprados</button></div>`}`;
}

on('cp-conf', (d, el) => { C.soloConf = el.checked; P.repintar(); });
on('cp-copiar', d => { const g = calcCompra().grupos[+d.i]; if (g) { copiar(textoProveedor(g)); C.abierto = +d.i; } });
on('cp-marcar', async (d, b) => {
  const R = calcCompra(); if (!R.ped.length) return;
  if (!confirmar(b, '¿Marcar como comprados? Tocá de nuevo')) return;
  b.disabled = true; const ahora = new Date().toISOString();
  try {
    for (let i = 0; i < R.ped.length; i += 6) await Promise.all(R.ped.slice(i, i + 6).map(o => api.actualizarPedido(o.id, { comprado_at: ahora })));
    const ids = new Set(R.ped.map(o => o.id)); P.pedidos.forEach(o => { if (ids.has(o.id)) o.comprado_at = ahora; });
    toast('Listo: ' + R.ped.length + ' pedidos marcados'); P.repintar();
  } catch (e) { b.disabled = false; toast(e.message); }
});
