// Gestión multinivel: sub-revendedores con enlace propio y comisión. La venta se atribuye por enlace y la comisión la calcula el servidor.
import { urlTiendaDe } from './marca.js';
import { api } from './api.js';
import { esc, fmt, on, toast, normWsp, copiar, confirmar } from './util.js';
import { P, can } from './state.js';

const E = { err: '', msg: '' };
const enlace = r => urlTiendaDe(P.t.slug, '?r=' + r.token);
function stats(r) {
  const o = P.pedidos.filter(x => x.sub_revendedor_id === r.id && x.estado !== 'cancelado');
  const cob = o.filter(x => x.estado === 'cobrado');
  return { n: o.length, ventas: o.reduce((s, x) => s + Number(x.total_ars), 0), deuda: cob.filter(x => !x.comision_liquidada).reduce((s, x) => s + Number(x.comision_ars), 0), pagada: cob.filter(x => x.comision_liquidada).reduce((s, x) => s + Number(x.comision_ars), 0), pendCobro: o.filter(x => x.estado === 'pendiente').reduce((s, x) => s + Number(x.comision_ars), 0) };
}
export function vistaEquipo() {
  if (!can('multinivel')) return `<div class="locked"><b>🤝 Red de sub-revendedores</b><p style="margin:6px 0">Dale un enlace propio a cada revendedor, atribuí sus ventas y liquidá comisiones sin planillas.</p><span class="tag warn">🔒 Plan Mayorista Pro</span><br><button class="btn btn-p btn-sm lock-cta" data-act="p-planes" data-p="pro">Ver planes y activar</button></div>`;
  const msgs = (E.err ? `<div class="err-box">${esc(E.err)}</div>` : '') + (E.msg ? `<div class="ok-box">${esc(E.msg)}</div>` : '');
  return `${msgs}<div class="cc"><h3>Nuevo sub-revendedor</h3><form data-submit="eq-nuevo"><div class="row2"><div class="fg"><label class="flabel">Nombre</label><input class="fi" name="nombre" maxlength="80" required></div><div class="fg"><label class="flabel">WhatsApp</label><input class="fi" name="whatsapp" type="tel" required></div></div>
  <div class="fg"><label class="flabel">Comisión sobre sus ventas (%)</label><input class="fi" name="comision" type="number" min="0" max="50" step="0.5" value="10" required></div><button class="btn btn-p" type="submit">Agregar</button></form></div>
  ${P.revs.map(r => { const s = stats(r); return `<div class="cc"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(r.nombre)}</b><span class="tag ${r.activo ? 'ok' : ''}">${r.activo ? 'Activo' : 'Pausado'} · ${Math.round(Number(r.comision) * 100)}%</span></div>
    <div class="hint" style="word-break:break-all;margin:6px 0">${esc(enlace(r))}</div>
    <div class="kpis" style="margin-bottom:8px"><div class="kpi"><small>Pedidos</small><b>${s.n}</b></div><div class="kpi"><small>Ventas</small><b>${fmt(s.ventas)}</b></div><div class="kpi"><small>Comisión a pagar</small><b>${fmt(s.deuda)}</b><i>${fmt(s.pendCobro)} pendiente de cobro · ${fmt(s.pagada)} liquidada</i></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p btn-sm" data-act="p-copiar" data-v="${esc(enlace(r))}">Copiar enlace</button><a class="btn btn-wa btn-sm" target="_blank" rel="noopener" href="https://api.whatsapp.com/send?phone=${normWsp(r.whatsapp)}&text=${encodeURIComponent('Hola ' + r.nombre + ', este es tu enlace para vender ' + P.t.nombre + ': ' + enlace(r))}">Enviarle su enlace</a>
    <button class="btn btn-s btn-sm" data-act="eq-liq" data-id="${r.id}" ${s.deuda > 0 ? '' : 'disabled'}>Marcar comisiones pagadas</button><button class="btn btn-s btn-sm" data-act="eq-tog" data-id="${r.id}">${r.activo ? 'Pausar' : 'Activar'}</button><button class="btn btn-s btn-sm" data-act="eq-del" data-id="${r.id}">Eliminar</button></div></div>`; }).join('') || '<p class="muted">Todavía no tenés sub-revendedores.</p>'}
  <p class="hint">Cada revendedor comparte su enlace; los pedidos que entren por ahí quedan a su nombre. Si pausás o eliminás a alguien, su enlace deja de atribuir ventas.</p>`;
}
on('eq-nuevo', async (d, f) => { const fd = new FormData(f); E.err = ''; E.msg = '';
  try { const w = normWsp(fd.get('whatsapp')); await api.guardarRevendedor(null, { tenant_id: P.t.id, nombre: fd.get('nombre').trim(), whatsapp: w, comision: Number(fd.get('comision')) / 100 }); P.revs = await api.misRevendedores(); E.msg = 'Sub-revendedor agregado.'; } catch (e) { E.err = e.message; } P.repintar(); });
on('eq-tog', async d => { const r = P.revs.find(x => x.id === d.id); try { await api.guardarRevendedor(r.id, { activo: !r.activo }); P.revs = await api.misRevendedores(); } catch (e) { E.err = e.message; } P.repintar(); });
on('eq-del', async (d, b) => {
  const n = P.pedidos.filter(o => o.sub_revendedor_id === d.id).length;
  if (n) { E.err = `Tiene ${n} pedido(s) atribuidos: pausalo en vez de eliminarlo, así no perdés el historial ni las comisiones.`; E.msg = ''; return P.repintar(); }
  if (!confirmar(b, '¿Eliminar? Tocá de nuevo')) return;
  try { await api.borrarRevendedor(d.id); P.revs = await api.misRevendedores(); P.pedidos = await api.pedidosTodos(); } catch (e) { E.err = e.message; } P.repintar(); });
on('eq-liq', async d => { try { const o = P.pedidos.filter(x => x.sub_revendedor_id === d.id && x.estado === 'cobrado' && !x.comision_liquidada); for (const x of o) await api.liquidar(x.id, true); P.pedidos = await api.pedidosTodos(); E.msg = `Se marcaron ${o.length} pedidos como liquidados.`; } catch (e) { E.err = e.message; } P.repintar(); });
