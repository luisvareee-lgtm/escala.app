// Pedidos por etapas: nuevo → confirmado → (en espera) → despachado → entregado, con cobro aparte,
// seguimiento, nota interna, remito para imprimir y mensajes de WhatsApp listos para cada etapa.
import { api } from './api.js';
import { $, esc, fmt, on, toast, normWsp, waLink, confirmar } from './util.js';
import { P } from './state.js';
import { imprimir } from './catalogo.js';

export const ETAPA = {
  nuevo: ['🆕', 'Nuevo', ''], confirmado: ['✅', 'Confirmado', 'ok'], en_espera: ['⏸️', 'En espera', 'warn'],
  despachado: ['🚚', 'Despachado', 'ok'], entregado: ['📦', 'Entregado', 'ok'], cancelado: ['⚪', 'Cancelado', 'bad']
};
const CAMINO = ['nuevo', 'confirmado', 'despachado', 'entregado'];
const FILTROS = [['todos', 'Todos'], ['nuevo', 'Nuevos'], ['por_cobrar', 'Por cobrar'], ['confirmado', 'Confirmados'], ['en_espera', 'En espera'], ['despachado', 'Despachados'], ['entregado', 'Entregados'], ['cancelado', 'Cancelados']];
const F = { filtro: 'todos', q: '', lim: 100 };
export const resetPed = () => Object.assign(F, { filtro: 'todos', q: '', lim: 100 });

const etapaDe = o => o.etapa || (o.estado === 'cancelado' ? 'cancelado' : 'nuevo');
const porCobrar = o => o.estado === 'pendiente' && etapaDe(o) !== 'cancelado';
const pasa = (o, k) => k === 'todos' || (k === 'por_cobrar' ? porCobrar(o) : etapaDe(o) === k);
export const badgeEtapa = o => { const [i, n, c] = ETAPA[etapaDe(o)]; return `<span class="tag ${c}">${i} ${n}</span>`; };
const badgeCobro = o => o.estado === 'cobrado' ? '<span class="tag ok">💵 Cobrado</span>' : o.estado === 'pendiente' ? '<span class="tag warn">Por cobrar</span>' : '';
const fecha = d => new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const hora = d => new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function vistaPedidos() {
  const q = F.q.trim().toLowerCase();
  const L = P.pedidos.filter(o => pasa(o, F.filtro) && (!q || o.cliente_nombre.toLowerCase().includes(q) || String(o.numero) === q.replace('#', '') || (o.seguimiento || '').toLowerCase().includes(q)));
  const n = k => P.pedidos.filter(o => pasa(o, k)).length;
  const rv = new Map(P.revs.map(r => [r.id, r.nombre]));
  return `<div class="ped-filtros" role="tablist" aria-label="Filtrar pedidos">${FILTROS.map(([k, t]) => { const c = n(k); return (k === 'todos' || c) ? `<button class="chipf ${F.filtro === k ? 'on' : ''}" data-act="pd-filtro" data-k="${k}">${t}${k !== 'todos' ? ` <b>${c}</b>` : ''}</button>` : ''; }).join('')}</div>
  <input class="fi" id="oq" placeholder="Buscar por cliente, N° de pedido o seguimiento…" data-input="pd-q" value="${esc(F.q)}" aria-label="Buscar pedido" style="margin-bottom:10px">
  <div class="card">${L.slice(0, F.lim).map(o => `<div class="srow" style="cursor:pointer" data-act="p-pedido" data-id="${o.id}" role="button" tabindex="0"><span>#${o.numero} · ${esc(o.cliente_nombre)}${o.sub_revendedor_id ? ` <span class="tag">${esc(rv.get(o.sub_revendedor_id) || 'revendedor')}</span>` : ''}<br><span class="ped-tags">${badgeEtapa(o)} ${badgeCobro(o)}${o.envio_nombre ? ` <small class="muted">· ${esc(o.envio_nombre)}</small>` : ''}</span><small class="muted"> · ${fecha(o.created_at)}${o.nota ? ' · 📝' : ''}</small></span><span class="v">${fmt(o.total_ars)}</span></div>`).join('') || '<p class="muted">Sin pedidos para mostrar.</p>'}${L.length > F.lim ? `<button class="btn btn-s btn-sm" data-act="pd-mas">Ver más (${L.length - F.lim})</button>` : ''}</div>`;
}

// ---- mensajes de WhatsApp por etapa ----
function mensaje(o, k) {
  const t = P.t, n = o.cliente_nombre.split(' ')[0], num = '#' + o.numero;
  const cobro = o.estado === 'pendiente' && o.medio_pago === 'transferencia' && t.alias_cobro ? ` Podés transferir a: ${t.alias_cobro}.` : '';
  return ({
    confirmado: `¡Hola ${n}! Confirmamos tu pedido ${num} por ${fmt(o.total_ars)}.${cobro} Te avisamos cuando salga.`,
    en_espera: `Hola ${n}, tu pedido ${num} quedó en espera${o.nota ? '' : ' unos días'}. Te avisamos apenas esté listo. ¡Gracias por la paciencia!`,
    despachado: `¡Hola ${n}! Tu pedido ${num} ya salió${o.envio_nombre ? ' por ' + o.envio_nombre : ''}.${o.seguimiento ? ' Seguimiento: ' + o.seguimiento + '.' : ''}`,
    entregado: `¡Hola ${n}! ¿Te llegó bien el pedido ${num}? Gracias por tu compra en ${t.nombre} 🙌`,
    cobro: `Hola ${n}, para cerrar tu pedido ${num} el total es ${fmt(o.total_ars)}.${t.alias_cobro ? ' Alias: ' + t.alias_cobro + '.' : ''} Avisanos cuando lo envíes.`,
    cancelado: `Hola ${n}, tu pedido ${num} quedó cancelado. Cualquier consulta, escribinos.`,
    nuevo: `Hola ${n}, te escribimos por tu pedido ${num}.`
  })[k];
}
const wa = (o, k, txt, cls = 'btn-wa') => `<a class="btn ${cls}" target="_blank" rel="noopener" href="${esc(waLink(normWsp(o.cliente_whatsapp), mensaje(o, k)))}">${txt}</a>`;

export function modalPedido(m) {
  const o = m.o, it = m.items || [], rv = P.revs.find(r => r.id === o.sub_revendedor_id), e = etapaDe(o), canc = e === 'cancelado';
  const sub = it.reduce((s, i) => s + Number(i.subtotal), 0), env = Number(o.envio_costo || 0);
  const idx = CAMINO.indexOf(e === 'en_espera' ? 'confirmado' : e);
  const pasos = CAMINO.map((k, i) => `<li class="${canc ? '' : i < idx ? 'hecho' : i === idx ? (e === 'en_espera' ? 'espera' : 'actual') : ''}"><span>${ETAPA[k][0]}</span>${i === idx && e === 'en_espera' ? 'En espera' : ETAPA[k][1]}</li>`).join('');
  const sig = canc || e === 'entregado' ? [] : e === 'nuevo' ? ['confirmado', 'en_espera'] : e === 'confirmado' ? ['despachado', 'en_espera'] : e === 'en_espera' ? ['confirmado', 'despachado'] : ['entregado'];
  const hist = (o.historial || []).map(h => `<li>${ETAPA[h.etapa] ? ETAPA[h.etapa][0] + ' ' + ETAPA[h.etapa][1] : esc(h.etapa)} <small class="muted">${hora(h.at)}</small></li>`).join('');
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal" role="dialog" aria-modal="true" aria-label="Pedido ${o.numero}"><div class="view-title">Pedido #${o.numero} ${badgeEtapa(o)} ${badgeCobro(o)}</div><div id="mm"></div>
  <ol class="ped-pasos${canc ? ' canc' : ''}">${pasos}</ol>
  <p><b>${esc(o.cliente_nombre)}</b> · <span class="muted">+${esc(o.cliente_whatsapp)}</span><br><span class="muted">${esc(o.modalidad_precio)} · pago: ${esc(o.medio_pago)} · ${hora(o.created_at)}</span>
  ${o.envio_nombre ? `<br>🚚 ${esc(o.envio_nombre)}${o.direccion ? ' · ' + esc(o.direccion) : ''}` : o.localidad ? `<br>📍 ${esc(o.localidad)}` : ''}
  ${rv ? `<br><span class="tag">Vendió: ${esc(rv.nombre)} · comisión ${fmt(o.comision_ars)}</span>` : ''}</p>
  <div class="card" style="margin-top:8px">${it.map(i => `<div class="srow"><span>${i.cantidad} × ${esc(i.nombre_snapshot)}${i.variante ? ' (' + esc(i.variante) + ')' : ''}</span><span class="v">${fmt(i.subtotal)}</span></div>`).join('')}
  ${env || o.envio_nombre ? `<div class="srow"><span class="muted">Productos</span><span class="v">${fmt(sub)}</span></div><div class="srow"><span class="muted">Envío${o.envio_nombre ? ' · ' + esc(o.envio_nombre) : ''}</span><span class="v">${env ? fmt(env) : 'Gratis'}</span></div>` : ''}
  <div class="srow tot"><span>Total</span><span class="v">${fmt(o.total_ars)}</span></div></div>
  ${sig.length ? `<div class="flabel" style="margin-top:6px">Pasar a</div><div class="ped-acc">${sig.map(k => `<button class="btn ${k === 'en_espera' ? 'btn-s' : 'btn-p'} btn-sm" data-act="pd-etapa" data-id="${o.id}" data-e="${k}">${ETAPA[k][0]} ${ETAPA[k][1]}</button>`).join('')}</div>` : ''}
  ${m.avisar ? `<div class="ok-box" style="margin:8px 0">Listo: ${ETAPA[m.avisar][1].toLowerCase()}. ${wa(o, m.avisar, '💬 Avisar al cliente por WhatsApp', 'btn-wa btn-sm')}</div>` : ''}
  ${o.estado === 'pendiente' ? `<button class="btn btn-p" style="margin-top:8px" data-act="p-estado" data-id="${o.id}" data-e="cobrado">💵 Marcar cobrado</button>` : ''}
  <form data-submit="pd-datos" data-id="${o.id}" style="margin-top:10px">
    <div class="fg"><label class="flabel" for="pd-seg">N° de seguimiento / guía</label><input class="fi" id="pd-seg" name="seguimiento" maxlength="120" value="${esc(o.seguimiento || '')}" placeholder="Ej: Andreani 3600012345" ${canc ? 'disabled' : ''}></div>
    <div class="fg"><label class="flabel" for="pd-nota">Nota interna (no la ve el cliente)</label><textarea class="fi" id="pd-nota" name="nota" rows="2" maxlength="500" placeholder="Ej: entrega después de las 18 h" ${canc ? 'disabled' : ''}>${esc(o.nota || '')}</textarea></div>
    ${canc ? '' : '<button class="btn btn-s btn-sm" type="submit">Guardar seguimiento y nota</button>'}
  </form>
  <details class="ped-wa"><summary>💬 Mensajes de WhatsApp listos</summary><div class="ped-acc">${wa(o, 'nuevo', 'Escribir', 'btn-s btn-sm')}${o.estado === 'pendiente' ? wa(o, 'cobro', 'Pedir el pago', 'btn-s btn-sm') : ''}${['confirmado', 'en_espera', 'despachado', 'entregado', 'cancelado'].filter(k => k === e || (!canc && k !== 'cancelado')).map(k => wa(o, k, ETAPA[k][0] + ' ' + ETAPA[k][1], 'btn-s btn-sm')).join('')}</div></details>
  ${hist ? `<details class="ped-wa"><summary>🕓 Historial</summary><ul class="ped-hist">${hist}</ul></details>` : ''}
  <button class="btn btn-s" style="margin-top:8px" data-act="pd-remito">🖨️ Imprimir remito</button>
  ${canc ? '' : `<button class="btn btn-s" style="margin-top:8px;color:var(--red)" data-act="pd-etapa" data-id="${o.id}" data-e="cancelado">Cancelar pedido${o.estado === 'cobrado' ? ' (devuelve stock)' : ''}</button>`}
  <button class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cerrar</button></div></div>`;
}

function remito(o, it) {
  const t = P.t, sub = it.reduce((s, i) => s + Number(i.subtotal), 0), env = Number(o.envio_costo || 0);
  return `<div class="catp remito" style="--pc:${esc(t.color)}"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h1>${esc(t.nombre)}</h1><div>WhatsApp +${esc(t.whatsapp)}</div></div>
  <div style="text-align:right"><b style="font-size:16px">REMITO · Pedido #${o.numero}</b><div>${hora(o.created_at)}</div><div>${ETAPA[etapaDe(o)][1]} · ${o.estado === 'cobrado' ? 'Cobrado' : o.estado === 'pendiente' ? 'Pendiente de cobro' : 'Cancelado'}</div></div></div>
  <h2>Cliente</h2><div><b>${esc(o.cliente_nombre)}</b> · +${esc(o.cliente_whatsapp)}${o.localidad ? ' · ' + esc(o.localidad) : ''}</div>
  ${o.envio_nombre ? `<div>Entrega: ${esc(o.envio_nombre)}${o.direccion ? ' · ' + esc(o.direccion) : ''}${o.seguimiento ? ' · Seguimiento: ' + esc(o.seguimiento) : ''}</div>` : ''}
  <h2>Detalle</h2><table><thead><tr><th>Cant.</th><th>Producto</th><th class="r">Unitario</th><th class="r">Subtotal</th></tr></thead><tbody>
  ${it.map(i => `<tr><td>${i.cantidad}</td><td>${esc(i.nombre_snapshot)}${i.variante ? ' (' + esc(i.variante) + ')' : ''}</td><td class="r">${fmt(i.precio_unitario)}</td><td class="r">${fmt(i.subtotal)}</td></tr>`).join('')}
  ${o.envio_nombre ? `<tr><td></td><td>Productos</td><td></td><td class="r">${fmt(sub)}</td></tr><tr><td></td><td>Envío · ${esc(o.envio_nombre)}</td><td></td><td class="r">${env ? fmt(env) : 'Gratis'}</td></tr>` : ''}
  <tr><td></td><td><b>TOTAL</b></td><td></td><td class="r"><b>${fmt(o.total_ars)}</b></td></tr></tbody></table>
  <p style="margin-top:8px">Pago: ${esc(o.medio_pago)}${t.alias_cobro && o.estado === 'pendiente' ? ' · Alias: ' + esc(t.alias_cobro) : ''}</p>
  <div style="display:flex;justify-content:space-between;margin-top:40px;gap:20px"><div style="border-top:1px solid #999;flex:1;padding-top:4px">Recibí conforme · Firma</div><div style="border-top:1px solid #999;flex:1;padding-top:4px">Aclaración y DNI</div></div></div>`;
}

const mm = (t, ok) => { const e = $('#mm'); if (e) e.innerHTML = `<div class="${ok ? 'ok-box' : 'err-box'}">${esc(t)}</div>`; };
async function refrescar(id, extra) {
  await P.recargarPedidos();
  const o = P.pedidos.find(x => x.id === id);
  if (o && P.modal && P.modal.tipo === 'ped') P.modal = Object.assign({}, P.modal, { o, items: P.items.filter(i => i.order_id === id).length ? P.items.filter(i => i.order_id === id) : P.modal.items }, extra || {});
  P.repintar();
}

on('pd-filtro', d => { F.filtro = d.k; F.lim = 100; P.repintar(); });
on('pd-q', (d, el) => { F.q = el.value; P.repintar(); });
on('pd-mas', () => { F.lim += 100; P.repintar(); });
on('pd-etapa', async (d, b) => {
  if (d.e === 'cancelado' && !confirmar(b, '¿Cancelar el pedido? Tocá de nuevo')) return;
  b.disabled = true;
  try { await api.actualizarPedido(d.id, { etapa: d.e }); await refrescar(d.id, { avisar: d.e }); toast(ETAPA[d.e][1]); }
  catch (e) { b.disabled = false; mm(e.message); }
});
on('pd-datos', async (d, f) => {
  const fd = new FormData(f);
  try { await api.actualizarPedido(d.id, { seguimiento: String(fd.get('seguimiento') || '').trim() || null, nota: String(fd.get('nota') || '').trim() || null }); await refrescar(d.id); toast('Guardado'); }
  catch (e) { mm(e.message); }
});
on('pd-remito', () => { const m = P.modal; if (m && m.tipo === 'ped') imprimir(remito(m.o, m.items || [])); });
