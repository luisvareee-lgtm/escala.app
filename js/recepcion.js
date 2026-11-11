// "📦 Llegó tu pedido": el comercio marca qué mercadería entró y el sistema dice qué pedidos quedaron completos,
// los pasa a "Listo para entregar" y deja el aviso de WhatsApp de cada cliente a un toque.
import { api } from './api.js';
import { esc, fmt, on, toast, normWsp, waLink } from './util.js';
import { P } from './state.js';
import { mensajePedido } from './pedidos.js';

const R = { sel: new Set(), res: null, avisados: new Set(), busy: false };
const etapaDe = o => o.etapa || 'nuevo';
const clave = (pid, vr) => pid + '|' + (vr || '');
// pedidos que esperan mercadería: En espera, o los que ya marcaste como comprados al proveedor
export const pedidosEsperando = () => P.pedidos.filter(o => o.estado !== 'cancelado' && ['nuevo', 'confirmado', 'en_espera'].includes(etapaDe(o)) && (etapaDe(o) === 'en_espera' || o.comprado_at));
// en "las dos", lo que no es por encargo ya está en el depósito: no hay nada que recibir
const seRecibe = p => (P.t.modo_stock || 'stock') !== 'mixto' || !!(p && p.a_pedido);

export function porRecibir() {
  const ids = new Map(pedidosEsperando().map(o => [o.id, o])), pp = new Map(P.prods.map(p => [p.id, p])), m = new Map();
  P.items.forEach(i => {
    if (!ids.has(i.order_id) || i.recibido_at || !i.product_id) return;
    const p = pp.get(i.product_id); if (!seRecibe(p)) return;
    const k = clave(i.product_id, i.variante), x = m.get(k) || { k, pid: i.product_id, vr: i.variante || '', nombre: p ? p.nombre : i.nombre_snapshot, cant: 0, pedidos: new Set() };
    x.cant += i.cantidad; x.pedidos.add(i.order_id); m.set(k, x);
  });
  return [...m.values()].sort((a, b) => a.nombre.localeCompare(b.nombre) || a.vr.localeCompare(b.vr));
}
const faltanDe = o => { const pp = new Map(P.prods.map(p => [p.id, p])); return P.items.filter(i => i.order_id === o.id && !i.recibido_at && seRecibe(pp.get(i.product_id))).length; };

export function recepcionCard() {
  const n = pedidosEsperando().length, L = porRecibir();
  return `<div class="cc" id="rec-card"><h3>📦 ¿Llegó la mercadería?</h3>${n ? `<p class="hint" style="margin-bottom:8px">Tenés <b>${n} ${n === 1 ? 'pedido esperando' : 'pedidos esperando'}</b> (${L.reduce((a, x) => a + x.cant, 0)} unidades de ${L.length} ${L.length === 1 ? 'producto' : 'productos'}). Marcá lo que entró y te armamos los avisos para cada cliente.</p><button class="btn btn-p btn-sm" style="width:auto" data-act="rc-abrir">📦 Llegó mercadería</button>`
    : '<p class="hint">Cuando marques pedidos como comprados (acá arriba) o los pases a “En espera”, vas a poder registrar la llegada y avisarle a cada cliente con un toque.</p>'}</div>`;
}

function fila(o, completo) {
  const av = R.avisados.has(o.id), k = completo ? 'listo' : 'parcial', f = completo ? 0 : faltanDe(o);
  return `<div class="rec-ped${av ? ' avisado' : ''}"><div class="rec-inf"><b>#${o.numero} · ${esc(o.cliente_nombre)}</b><small>${fmt(o.total_ars)} · ${o.estado === 'cobrado' ? 'cobrado' : 'por cobrar'}${completo ? '' : ` · ${f === 1 ? 'falta 1 producto' : 'faltan ' + f + ' productos'}`}</small></div>
    <a class="btn ${completo ? 'btn-wa' : 'btn-s'} btn-sm" target="_blank" rel="noopener" data-act="rc-avisado" data-id="${o.id}" href="${esc(waLink(normWsp(o.cliente_whatsapp), mensajePedido(o, k)))}">${av ? '✓ Avisado' : completo ? '📲 Avisar por WhatsApp que llegó su pedido' : 'Avisar que llegó una parte'}</a></div>`;
}
export function recepcionModal() {
  const L = porRecibir(), res = R.res;
  let cuerpo;
  if (res) {
    const de = ids => ids.map(id => P.pedidos.find(o => o.id === id)).filter(Boolean);
    const listos = de(res.listos), parc = de(res.parciales);
    cuerpo = `<div class="ok-box" id="rec-ok">Registrado: ${res.marcados} ${res.marcados === 1 ? 'línea' : 'líneas'} de pedido. ${listos.length ? `<b>${listos.length} ${listos.length === 1 ? 'pedido quedó completo' : 'pedidos quedaron completos'}</b> y ${listos.length === 1 ? 'pasó' : 'pasaron'} a “Listo para entregar”.` : 'Todavía ningún pedido quedó completo.'}</div>
      ${listos.length ? `<h3 class="rec-h">✅ Completos: avisales</h3><div id="rec-listos">${listos.map(o => fila(o, true)).join('')}</div>` : ''}
      ${parc.length ? `<h3 class="rec-h">⏳ Les falta algo</h3><div id="rec-parc">${parc.map(o => fila(o, false)).join('')}</div>` : ''}
      ${L.length ? '<button class="btn btn-s" style="margin-top:10px" data-act="rc-otra">Registrar más mercadería</button>' : ''}`;
  } else if (!L.length) {
    cuerpo = '<p class="ok-box">No hay mercadería pendiente de llegar. Acá aparece lo de los pedidos “En espera” o ya comprados al proveedor.</p>';
  } else {
    const todo = L.every(x => R.sel.has(x.k));
    cuerpo = `<p class="hint" style="margin-bottom:8px">Marcá lo que acaba de entrar. Los pedidos que queden completos pasan solos a “Listo para entregar”.</p>
      <label class="chk rec-todo"><input type="checkbox" data-change="rc-todo" ${todo ? 'checked' : ''}> <b>Llegó todo</b></label>
      <div class="rec-lista">${L.map(x => `<label class="chk rec-it"><input type="checkbox" data-change="rc-sel" data-k="${esc(x.k)}" ${R.sel.has(x.k) ? 'checked' : ''}><span><b>${x.cant} ×</b> ${esc(x.nombre)}${x.vr ? ` <span class="tag">${esc(x.vr)}</span>` : ''}<br><small class="muted">${x.pedidos.size} ${x.pedidos.size === 1 ? 'pedido' : 'pedidos'}</small></span></label>`).join('')}</div>
      <div id="rec-m"></div><button class="btn btn-p" id="rec-go" data-act="rc-confirmar" ${R.sel.size ? '' : 'disabled'}>Confirmar que llegó${R.sel.size ? ` (${R.sel.size})` : ''}</button>`;
  }
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal rec" role="dialog" aria-modal="true" aria-label="Llegó mercadería"><div class="view-title">📦 Llegó mercadería</div>${cuerpo}<button class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cerrar</button></div></div>`;
}
on('rc-abrir', () => { R.sel = new Set(); R.res = null; R.avisados = new Set(); P.modal = { tipo: 'rec' }; P.repintar(); });
on('rc-otra', () => { R.sel = new Set(); R.res = null; P.repintar(); });
on('rc-sel', (d, el) => { el.checked ? R.sel.add(d.k) : R.sel.delete(d.k); P.repintar(); });
on('rc-todo', (d, el) => { R.sel = new Set(el.checked ? porRecibir().map(x => x.k) : []); P.repintar(); });
on('rc-avisado', d => { R.avisados.add(d.id); setTimeout(() => P.repintar(), 50); });
on('rc-confirmar', async (d, b) => {
  if (R.busy || !R.sel.size) return; R.busy = true; b.disabled = true; b.textContent = 'Registrando…';
  try {
    const lineas = porRecibir().filter(x => R.sel.has(x.k)).map(x => ({ producto_id: x.pid, variante: x.vr }));
    const res = await api.recibirMercaderia(lineas);
    await P.recargarPedidos(); R.res = { marcados: res.marcados || 0, listos: res.listos || [], parciales: res.parciales || [] }; R.sel = new Set();
    toast(R.res.listos.length ? `${R.res.listos.length} ${R.res.listos.length === 1 ? 'pedido listo' : 'pedidos listos'} para entregar` : 'Mercadería registrada'); P.repintar();
  } catch (e) { const m = document.getElementById('rec-m'); if (m) m.innerHTML = `<div class="err-box">${esc(e.message)}</div>`; b.disabled = false; b.textContent = 'Confirmar que llegó'; }
  finally { R.busy = false; }
});
