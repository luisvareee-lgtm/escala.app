// Presupuestos (v2.30): armás uno con tu cliente y tus productos (precio por volumen según la cantidad, o el que
// pongas a mano), lo mandás por WhatsApp con un enlace que vence (y en PDF), tu cliente lo acepta y lo pasás a pedido.
// El número y el total los pone la base. El enlace no muestra costos.
import { api } from './api.js';
import { $, esc, fmt, on, toast, confirmar, normWsp, waLink, copiar } from './util.js';
import { P, can, bloqueo } from './state.js';
import { htmlPresupuesto, imprimir } from './catalogo.js';

const Q = { ed: null, busca: '', filtro: 'activos', conv: null, cargado: false };
export const resetPresu = () => Object.assign(Q, { ed: null, busca: '', filtro: 'activos', conv: null, cargado: false });
const hoyStr = () => new Date().toLocaleDateString('sv');
const masDias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv'); };
const fechaAr = d => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-AR') : '';
export async function cargarPresupuestos(forzar) {
  if (Q.cargado && !forzar) return;
  try { P.presus = await api.misPresupuestos(); } catch (e) { P.presus = null; }
  Q.cargado = true;
}
export const presusCargados = () => Q.cargado;
const vencido = r => r.vence && r.vence < hoyStr() && ['borrador', 'enviado'].includes(r.estado);
const ESTADO = r => vencido(r) ? ['venc', '⌛ Vencido'] : { borrador: ['bor', '✏️ Borrador'], enviado: ['env', '📤 Enviado'], aceptado: ['ok', '✅ Aceptado'], convertido: ['conv', '🧾 Pasado a pedido'], anulado: ['anu', 'Anulado'] }[r.estado] || ['bor', r.estado];
export const urlPresu = r => location.origin + '/t/' + encodeURIComponent(P.t.slug) + '?presupuesto=' + r.token;
const modalidades = () => P.t.modalidad === 'hibrido' ? ['mayorista', 'minorista'] : [P.t.modalidad === 'mayorista' ? 'mayorista' : 'minorista'];

// Precio de un producto según la lista y la cantidad (el mismo cálculo del panel; en mayorista: x1 · x3 · x6 · x12)
const tramo = n => n >= 12 ? 12 : n >= 6 ? 6 : n >= 3 ? 3 : 1;
function precioAuto(l, ed) {
  const p = P.prods.find(x => x.id === l.producto_id); if (!p || !P.preciosProd) return l.precio_unitario;
  const pr = P.preciosProd(p);
  if (ed.modalidad_precio !== 'mayorista') return pr.min;
  const tot = ed.items.filter(x => x.producto_id === l.producto_id).reduce((s, x) => s + (+x.cantidad || 0), 0);
  return p.precio_unico ? pr[1] : pr[tramo(tot)];
}
const repreciar = ed => ed.items.forEach(l => { if (l.producto_id && !l.manual) l.precio_unitario = precioAuto(l, ed); });
const etqHtml = (l, i, ed) => esc(etiquetaTramo(l, ed)) + (l.manual && l.producto_id ? ` · <button class="linkb" data-act="pr-auto" data-i="${i}">volver al precio de lista</button>` : '');
const totalEd = ed => ed.items.reduce((s, l) => s + (+l.cantidad || 0) * (+l.precio_unitario || 0), 0) + (+ed.envio_costo || 0);
const etiquetaTramo = (l, ed) => { if (!l.producto_id) return 'renglón libre'; if (l.manual) return 'precio a mano'; if (ed.modalidad_precio !== 'mayorista') return 'al público'; const p = P.prods.find(x => x.id === l.producto_id); if (p && p.precio_unico) return 'precio único'; const tot = ed.items.filter(x => x.producto_id === l.producto_id).reduce((s, x) => s + (+x.cantidad || 0), 0); return 'precio x' + tramo(tot) + (tramo(tot) === 12 ? '+' : ''); };

export function vistaPresupuestos() {
  if (!can('presupuestos')) return bloqueo('📝 Presupuestos por WhatsApp', 'Armá presupuestos con tus precios, mandalos por WhatsApp y convertilos en pedido con un toque.', 'presupuestos');
  if (P.presus === null) return '<div class="cc"><h3>📝 Presupuestos</h3><p>Falta actualizar la base: corré la <b>migración 23</b> (23-migracion_v2.30.sql) en Supabase → SQL Editor y recargá.</p></div>';
  if (Q.ed) return editorHtml();
  const L = (P.presus || []).filter(r => Q.filtro === 'todos' || (Q.filtro === 'activos' ? !['convertido', 'anulado'].includes(r.estado) : Q.filtro === 'aceptados' ? r.estado === 'aceptado' : r.estado === 'convertido'));
  const nAc = (P.presus || []).filter(r => r.estado === 'aceptado').length;
  return `<div class="pr-top"><button class="btn btn-p btn-sm" data-act="pr-nuevo">＋ Nuevo presupuesto</button>
    <div class="seg" role="group" aria-label="Filtro">${[['activos', 'Abiertos'], ['aceptados', `Aceptados${nAc ? ' (' + nAc + ')' : ''}`], ['convertidos', 'Pasados a pedido'], ['todos', 'Todos']].map(([k, n]) => `<button class="${Q.filtro === k ? 'on' : ''}" data-act="pr-filtro" data-k="${k}">${n}</button>`).join('')}</div></div>
  ${nAc ? `<div class="cc pr-aviso">✅ <b>${nAc === 1 ? 'Un cliente aceptó' : nAc + ' clientes aceptaron'} un presupuesto.</b> Pasalo a pedido con “🧾 Pasar a pedido”.</div>` : ''}
  ${L.map(cardHtml).join('') || `<div class="cc empty-cc"><p><b>Armá un presupuesto en un minuto.</b></p><p class="muted">Elegís el cliente y los productos (el precio por volumen se pone solo), lo mandás por WhatsApp con un enlace que vence y, cuando te dice que sí, lo pasás a pedido con un toque.</p></div>`}
  ${Q.conv ? convHtml() : ''}`;
}
function cardHtml(r) {
  const [cls, txt] = ESTADO(r), o = r.order_id && (P.pedidos || []).find(x => x.id === r.order_id), n = (r.items || []).reduce((s, x) => s + (+x.cantidad || 0), 0);
  const abierto = !['convertido', 'anulado'].includes(r.estado);
  return `<div class="cc pr-card" data-id="${r.id}"><div class="pr-c1"><div><b>N° ${r.numero} · ${esc(r.cliente_nombre)}</b><small class="muted">${fechaAr(r.created_at)} · ${(r.items || []).length} ${(r.items || []).length === 1 ? 'producto' : 'productos'} · ${n} u.${r.vence ? ` · vence el ${fechaAr(r.vence)}` : ''}</small></div><div class="pr-tot"><b>${fmt(r.total_ars)}</b><span class="pr-est ${cls}">${txt}</span></div></div>
    <div class="pr-acc">${abierto ? `<button class="btn btn-wa btn-sm" data-act="pr-wsp" data-id="${r.id}">💬 Mandar</button><button class="btn btn-p btn-sm" data-act="pr-conv" data-id="${r.id}">🧾 Pasar a pedido</button><button class="btn btn-s btn-sm" data-act="pr-editar" data-id="${r.id}">✏️ Editar</button>` : ''}
      ${o ? `<button class="btn btn-s btn-sm" data-act="pr-ver-ped" data-id="${o.id}">Ver pedido #${o.numero}</button>` : ''}
      <button class="btn btn-s btn-sm" data-act="pr-pdf" data-id="${r.id}">📄 PDF</button>${r.estado !== 'anulado' ? `<button class="btn btn-s btn-sm" data-act="pr-link" data-id="${r.id}">🔗 Copiar enlace</button>` : ''}
      <button class="btn btn-s btn-sm" data-act="pr-dup" data-id="${r.id}">⧉ Duplicar</button>${abierto ? `<button class="btn btn-s btn-sm" data-act="pr-anular" data-id="${r.id}">Anular</button>` : r.estado === 'anulado' ? `<button class="btn btn-s btn-sm" data-act="pr-borrar" data-id="${r.id}">🗑 Borrar</button>` : ''}</div></div>`;
}
function convHtml() {
  const r = (P.presus || []).find(x => x.id === Q.conv); if (!r) return '';
  return `<div class="modal-bg" data-act="pr-conv-x"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="pr-conv-t"><div class="view-title" id="pr-conv-t">🧾 Pasar a pedido</div>
    <p>Presupuesto N° ${r.numero} · <b>${esc(r.cliente_nombre)}</b> · ${fmt(r.total_ars)}</p>
    <p class="hint">Se crea un pedido nuevo con estos productos y precios, en la etapa “Nuevo”. El stock se descuenta cuando lo marcás cobrado, como siempre.</p>
    <div class="fg"><label class="flabel" for="pr-medio">¿Cómo va a pagar?</label><select class="fi" id="pr-medio"><option value="transferencia">🏦 Transferencia</option><option value="efectivo">💵 Efectivo</option><option value="link">💳 Mercado Pago</option></select></div>
    <button class="btn btn-p" style="width:100%" data-act="pr-conv-ok" data-id="${r.id}">Crear el pedido</button><button class="btn btn-s" style="width:100%;margin-top:8px" data-act="pr-conv-x" data-x="1">Cancelar</button></div></div>`;
}

function editorHtml() {
  const ed = Q.ed, mods = modalidades(), tot = totalEd(ed), q = Q.busca.trim().toLowerCase();
  const res = q ? P.prods.filter(p => p.activo !== false && (p.nombre + ' ' + (p.sku || '') + ' ' + (p.categoria || '')).toLowerCase().includes(q)).slice(0, 8) : [];
  const precioLista = p => { const pr = P.preciosProd ? P.preciosProd(p) : {}; return ed.modalidad_precio === 'mayorista' && !p.precio_unico ? `${fmt(pr[1])} · x12 ${fmt(pr[12])}` : fmt(ed.modalidad_precio === 'mayorista' ? pr[1] : pr.min); };
  const fila = (l, i) => { const p = l.producto_id && P.prods.find(x => x.id === l.producto_id), vars = p && p.variantes || [];
    return `<div class="pr-l"><div class="pr-ln">${l.producto_id ? `<b>${esc(l.nombre)}</b>` : `<input class="fi" id="pr-n-${i}" maxlength="120" value="${esc(l.nombre)}" placeholder="Qué es (ej: Envío especial, Exhibidor)" data-change="pr-l" data-i="${i}" data-f="nombre" aria-label="Nombre del renglón">`}
      ${vars.length ? `<select class="fi pr-var" id="pr-v-${i}" data-change="pr-l" data-i="${i}" data-f="variante" aria-label="Variante de ${esc(l.nombre)}"><option value="">Sin elegir</option>${vars.map(v => `<option ${l.variante === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>` : ''}
      <small class="muted" id="pr-e-${i}">${etqHtml(l, i, ed)}</small></div>
      <label class="pr-f"><small>Cant.</small><input class="fi" id="pr-q-${i}" type="number" inputmode="numeric" min="1" max="99999" value="${l.cantidad}" data-change="pr-l" data-i="${i}" data-f="cantidad" aria-label="Cantidad de ${esc(l.nombre || 'renglón')}"></label>
      <label class="pr-f"><small>Precio c/u</small><input class="fi" id="pr-p-${i}" type="number" inputmode="decimal" min="0" step="any" value="${l.precio_unitario}" data-change="pr-l" data-i="${i}" data-f="precio_unitario" aria-label="Precio de ${esc(l.nombre || 'renglón')}"></label>
      <b class="pr-st" id="pr-s-${i}">${fmt((+l.cantidad || 0) * (+l.precio_unitario || 0))}</b><button type="button" class="btn btn-s btn-sm" data-act="pr-quitar" data-i="${i}" aria-label="Sacar ${esc(l.nombre || 'renglón')}">✕</button></div>`; };
  return `<div class="cc pr-ed"><div class="pr-edh"><h3>${ed.id ? `✏️ Presupuesto N° ${ed.numero}` : '📝 Nuevo presupuesto'}</h3><button class="btn btn-s btn-sm" data-act="pr-cancelar">← Volver</button></div>
    <div id="pr-err"></div>
    <div class="row2"><div class="fg"><label class="flabel" for="pr-cli">Cliente</label><input class="fi" id="pr-cli" maxlength="80" value="${esc(ed.cliente_nombre)}" placeholder="Nombre o negocio" data-change="pr-campo" data-f="cliente_nombre"></div>
    <div class="fg"><label class="flabel" for="pr-wsp">WhatsApp (opcional)</label><input class="fi" id="pr-wsp" inputmode="tel" maxlength="30" value="${esc(ed.cliente_whatsapp)}" placeholder="11 2345 6789" data-change="pr-campo" data-f="cliente_whatsapp"></div></div>
    ${mods.length > 1 ? `<div class="fg"><span class="flabel">Precios</span><div class="seg" role="group" aria-label="Lista de precios">${mods.map(m => `<button type="button" class="${ed.modalidad_precio === m ? 'on' : ''}" data-act="pr-mod" data-m="${m}" aria-pressed="${ed.modalidad_precio === m}">${m === 'mayorista' ? 'Por mayor (x1 · x3 · x6 · x12)' : 'Al público'}</button>`).join('')}</div></div>` : ''}
    <div class="fg pr-busca"><label class="flabel" for="pr-q">Agregar productos</label><input class="fi" id="pr-q" type="search" autocomplete="off" value="${esc(Q.busca)}" placeholder="Buscá por nombre, código o categoría" data-input="pr-busca">
      ${q ? `<div class="pr-res" role="listbox">${res.map(p => `<button type="button" class="pr-r" data-act="pr-add" data-id="${p.id}"><span>${esc(p.nombre)}${p.sku ? ` <small class="muted">#${esc(p.sku)}</small>` : ''}</span><small>${precioLista(p)}</small></button>`).join('') || '<p class="muted" style="padding:8px">No hay productos con ese nombre.</p>'}</div>` : ''}
      <button type="button" class="linkb" data-act="pr-libre" style="margin-top:6px">＋ Agregar un renglón libre (algo que no está en tus productos)</button></div>
    <div class="pr-ls">${ed.items.map(fila).join('') || '<p class="muted">Todavía no agregaste productos.</p>'}</div>
    <div class="row2"><div class="fg"><label class="flabel" for="pr-envn">Envío (opcional)</label><input class="fi" id="pr-envn" maxlength="60" value="${esc(ed.envio_nombre)}" placeholder="Ej: Moto a CABA" data-change="pr-campo" data-f="envio_nombre"></div>
    <div class="fg"><label class="flabel" for="pr-envc">Costo del envío $</label><input class="fi" id="pr-envc" type="number" min="0" step="any" inputmode="decimal" value="${ed.envio_costo || ''}" placeholder="0" data-change="pr-campo" data-f="envio_costo"></div></div>
    <div class="row2"><div class="fg"><label class="flabel" for="pr-vence">Válido hasta</label><input class="fi" id="pr-vence" type="date" min="${hoyStr()}" value="${ed.vence || ''}" data-change="pr-campo" data-f="vence"><div class="pr-chips">${[3, 7, 15, 30].map(n => `<button type="button" class="chipf${ed.vence === masDias(n) ? ' on' : ''}" data-act="pr-vence" data-n="${n}">${n} días</button>`).join('')}</div></div>
    <div class="fg"><label class="flabel" for="pr-nota">Nota (la ve tu cliente)</label><textarea class="fi" id="pr-nota" rows="2" maxlength="500" placeholder="Ej: Precios con transferencia. Entrega en 48 h." data-change="pr-campo" data-f="nota">${esc(ed.nota)}</textarea></div></div>
    <div class="pr-total"><span>Total</span><b id="pr-total">${fmt(tot)}</b></div>
    <div class="pr-acc"><button class="btn btn-wa" data-act="pr-guardar" data-y="wsp">💬 Guardar y mandar por WhatsApp</button><button class="btn btn-p" data-act="pr-guardar">Guardar</button><button class="btn btn-s" data-act="pr-cancelar">Cancelar</button></div></div>`;
}

const nuevoEd = () => ({ id: null, numero: null, cliente_nombre: '', cliente_whatsapp: '', modalidad_precio: modalidades()[0], items: [], envio_nombre: '', envio_costo: 0, nota: '', vence: masDias(7) });
const deFila = (r, copia) => ({ id: copia ? null : r.id, numero: copia ? null : r.numero, cliente_nombre: r.cliente_nombre, cliente_whatsapp: r.cliente_whatsapp || '', modalidad_precio: r.modalidad_precio, envio_nombre: r.envio_nombre || '', envio_costo: Number(r.envio_costo) || 0, nota: r.nota || '', vence: copia ? masDias(7) : r.vence || '',
  items: (r.items || []).map(x => ({ producto_id: x.producto_id || null, nombre: x.nombre, variante: x.variante || '', cantidad: +x.cantidad, precio_unitario: Number(x.precio_unitario), manual: !!x.producto_id && !copia })) });
const repintar = () => P.repintar();
on('pr-nuevo', () => { Q.ed = nuevoEd(); Q.busca = ''; repintar(); window.scrollTo(0, 0); const e = $('#pr-cli'); if (e) e.focus(); });
on('pr-filtro', d => { Q.filtro = d.k; repintar(); });
on('pr-cancelar', () => { Q.ed = null; Q.busca = ''; repintar(); });
on('pr-editar', d => { const r = P.presus.find(x => x.id === d.id); if (!r) return; Q.ed = deFila(r); Q.busca = ''; repintar(); window.scrollTo(0, 0); });
on('pr-dup', d => { const r = P.presus.find(x => x.id === d.id); if (!r) return; Q.ed = deFila(r, true); repreciar(Q.ed); Q.busca = ''; repintar(); window.scrollTo(0, 0); toast('Copia lista: revisá y guardá'); });
on('pr-busca', (d, el) => { Q.busca = el.value; repintar(); });
on('pr-add', d => {
  const p = P.prods.find(x => x.id === d.id), ed = Q.ed; if (!p || !ed) return;
  const vars = p.variantes || [], ex = ed.items.find(l => l.producto_id === p.id && !vars.length);
  if (ex) ex.cantidad = (+ex.cantidad || 0) + 1; else ed.items.push({ producto_id: p.id, nombre: p.nombre, variante: '', cantidad: 1, precio_unitario: 0, manual: false });
  repreciar(ed); Q.busca = ''; repintar();
  const e = $(`#pr-q-${ed.items.findIndex(l => l.producto_id === p.id && (!vars.length || l === ed.items[ed.items.length - 1]))}`); if (e) { e.focus(); e.select(); }
});
on('pr-libre', () => { Q.ed.items.push({ producto_id: null, nombre: '', variante: '', cantidad: 1, precio_unitario: 0, manual: true }); repintar(); const e = $(`#pr-n-${Q.ed.items.length - 1}`); if (e) e.focus(); });
on('pr-quitar', d => { Q.ed.items.splice(+d.i, 1); repreciar(Q.ed); repintar(); });
on('pr-auto', d => { const l = Q.ed.items[+d.i]; if (!l) return; l.manual = false; repreciar(Q.ed); repintar(); });
on('pr-l', (d, el) => {
  const ed = Q.ed, l = ed && ed.items[+d.i]; if (!l) return;
  if (d.f === 'cantidad') l.cantidad = Math.max(1, Math.min(99999, Math.floor(+el.value || 1)));
  else if (d.f === 'precio_unitario') { const v = Math.max(0, Math.round((+el.value || 0) * 100) / 100); if (l.producto_id && v !== precioAuto(l, ed)) l.manual = true; l.precio_unitario = v; }
  else l[d.f] = el.value.trim();
  repreciar(ed);
  // se actualiza en el lugar (sin repintar) para no perder el foco al pasar con Tab de un campo al otro
  ed.items.forEach((x, i) => { const pe = $('#pr-p-' + i), se = $('#pr-s-' + i), ee = $('#pr-e-' + i), qe = $('#pr-q-' + i);
    if (pe && pe !== el) pe.value = x.precio_unitario; if (qe && qe !== el) qe.value = x.cantidad; if (se) se.textContent = fmt((+x.cantidad || 0) * (+x.precio_unitario || 0)); if (ee) ee.innerHTML = etqHtml(x, i, ed); });
  if (el.type === 'number') el.value = d.f === 'cantidad' ? l.cantidad : l.precio_unitario;
  const t = $('#pr-total'); if (t) t.textContent = fmt(totalEd(ed));
});
on('pr-campo', (d, el) => { const ed = Q.ed; if (!ed) return; ed[d.f] = d.f === 'envio_costo' ? Math.max(0, Math.round((+el.value || 0) * 100) / 100) : el.value; if (d.f === 'envio_costo' || d.f === 'vence') repintar(); else { const t = $('#pr-total'); if (t) t.textContent = fmt(totalEd(ed)); } });
on('pr-mod', d => { Q.ed.modalidad_precio = d.m; repreciar(Q.ed); repintar(); });
on('pr-vence', d => { Q.ed.vence = masDias(+d.n); repintar(); });

function mensaje(r) {
  const it = (r.items || []).map(x => `• ${x.cantidad} × ${x.nombre}${x.variante ? ' (' + x.variante + ')' : ''} · ${fmt(x.precio_unitario)} c/u = ${fmt(x.subtotal)}`).join('\n');
  return `¡Hola ${r.cliente_nombre}! Te paso el presupuesto N° ${r.numero} de ${P.t.nombre}:\n\n${it}${Number(r.envio_costo) > 0 ? `\n• Envío${r.envio_nombre ? ' (' + r.envio_nombre + ')' : ''}: ${fmt(r.envio_costo)}` : ''}\n\n*Total: ${fmt(r.total_ars)}*${r.vence ? `\nVálido hasta el ${fechaAr(r.vence)}.` : ''}${r.nota ? '\n' + r.nota : ''}\n\nMiralo y aceptalo acá: ${urlPresu(r)}`;
}
async function mandar(r) {
  window.open(waLink(normWsp(r.cliente_whatsapp || ''), mensaje(r)), '_blank', 'noopener');
  if (r.estado === 'borrador') { try { const x = await api.guardarPresupuesto(r.id, { estado: 'enviado', enviado_at: new Date().toISOString() }); Object.assign(r, x || { estado: 'enviado' }); } catch (e) { } }
}
on('pr-guardar', async (d, b) => {
  const ed = Q.ed; if (!ed) return;
  ['pr-cli', 'pr-wsp', 'pr-envn', 'pr-nota'].forEach(id => { const e = $('#' + id); if (e) ed[{ 'pr-cli': 'cliente_nombre', 'pr-wsp': 'cliente_whatsapp', 'pr-envn': 'envio_nombre', 'pr-nota': 'nota' }[id]] = e.value; });
  const err = m => { $('#pr-err').innerHTML = `<div class="err-box">${esc(m)}</div>`; $('#pr-err').scrollIntoView({ block: 'center' }); };
  if (!ed.cliente_nombre.trim()) return err('Poné el nombre del cliente.');
  if (!ed.items.length) return err('Agregá al menos un producto.');
  const sinNom = ed.items.findIndex(l => !String(l.nombre || '').trim()); if (sinNom >= 0) return err('Hay un renglón libre sin nombre.');
  const fila = { cliente_nombre: ed.cliente_nombre.trim(), cliente_whatsapp: ed.cliente_whatsapp.trim() || null, modalidad_precio: ed.modalidad_precio, envio_nombre: ed.envio_nombre.trim() || null, envio_costo: +ed.envio_costo || 0, nota: ed.nota.trim() || null, vence: ed.vence || null,
    items: ed.items.map(l => ({ producto_id: l.producto_id, nombre: l.nombre.trim(), variante: l.variante || '', cantidad: +l.cantidad, precio_unitario: +l.precio_unitario })) };
  if (!ed.id) fila.tenant_id = P.t.id;
  b.disabled = true;
  try {
    const r = await api.guardarPresupuesto(ed.id, fila);
    await cargarPresupuestos(true); Q.ed = null; Q.busca = ''; Q.filtro = 'activos';
    const rr = P.presus.find(x => x.id === (r && r.id)) || r;
    toast(`Presupuesto N° ${rr.numero} guardado`); repintar();
    if (d.y === 'wsp' && rr) { await mandar(rr); repintar(); }
  } catch (e) { b.disabled = false; err(e.message); }
});
on('pr-wsp', async d => { const r = P.presus.find(x => x.id === d.id); if (r) { await mandar(r); repintar(); } });
on('pr-link', d => { const r = P.presus.find(x => x.id === d.id); if (r) copiar(urlPresu(r)); });
on('pr-pdf', d => { const r = P.presus.find(x => x.id === d.id); if (!r) return; const t = P.t;
  imprimir(htmlPresupuesto({ numero: r.numero, cliente: r.cliente_nombre, fecha: r.created_at, vence: r.vence, items: r.items, envio_nombre: r.envio_nombre, envio_costo: r.envio_costo, total: r.total_ars, nota: r.nota, tienda: { nombre: t.nombre, logo_url: t.logo_url, color: t.color, whatsapp: t.whatsapp } })); });
on('pr-anular', async (d, b) => { if (!confirmar(b, '¿Anular? El enlace deja de andar')) return; try { const x = await api.guardarPresupuesto(d.id, { estado: 'anulado' }); const r = P.presus.find(y => y.id === d.id); Object.assign(r, x || { estado: 'anulado' }); toast('Presupuesto anulado'); repintar(); } catch (e) { toast(e.message); } });
on('pr-borrar', async (d, b) => { if (!confirmar(b, '¿Borrar para siempre?')) return; try { await api.borrarPresupuesto(d.id); P.presus = P.presus.filter(x => x.id !== d.id); repintar(); } catch (e) { toast(e.message); } });
on('pr-conv', d => { Q.conv = d.id; repintar(); const e = $('#pr-medio'); if (e) e.focus(); });
on('pr-conv-x', (d, b, e) => { if (d.x || e.target === b) { Q.conv = null; repintar(); } });
on('pr-conv-ok', async (d, b) => {
  b.disabled = true; const medio = ($('#pr-medio') || {}).value || 'transferencia';
  try {
    const r = await api.presupuestoAPedido(d.id, medio); Q.conv = null; Q.filtro = 'convertidos';
    await Promise.all([cargarPresupuestos(true), P.recargarPedidos()]);
    toast(`🧾 Pedido #${r.numero} creado`); repintar();
  } catch (e) { b.disabled = false; toast(e.message); }
});
on('pr-ver-ped', d => { const o = P.pedidos.find(x => x.id === d.id); if (!o) return; P.tab = 'pedidos'; P.modal = { tipo: 'ped', o, items: P.items.filter(i => i.order_id === o.id) }; repintar(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && Q.conv) { Q.conv = null; repintar(); } });
