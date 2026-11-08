// Pantalla del importador: texto, archivos (CSV, Excel, PDF, WhatsApp, imágenes), mapeo de columnas, destino y vista previa.
import { api } from './api.js';
import { $, esc, fmt, on, toast } from './util.js';
import { P, can, aviso } from './state.js';
import { parsearLista, parsearCSV, detectarTabla, tablaAProductos, leerArchivo, cruzar, CAMPOS, clave } from './importer.js';

const I = { texto: '', filas: null, hojas: null, hoja: 0, det: null, map: {}, opts: { moneda: 'usd', tipo: 'costo', margen: null }, items: null, destino: 'mis', nombre: '', msg: '', err: '', busy: false, archivo: '' };
export const resetImp = () => Object.assign(I, { texto: '', filas: null, hojas: null, hoja: 0, det: null, map: {}, opts: { moneda: 'usd', tipo: 'costo', margen: null }, items: null, destino: 'mis', nombre: '', msg: '', err: '', busy: false, archivo: '' });

function procesar() {
  I.err = ''; I.items = null;
  const cot = Number(P.t.cotizacion_usd);
  // si el precio es de venta, por defecto se descuenta TU margen (así migrar de otra tienda no cambia tus precios)
  if (I.opts.margen == null) I.opts.margen = Math.round(Number(P.t.margen_1) * 100);
  if (I.filas) {
    I.det = detectarTabla(I.filas);
    if (!Object.keys(I.map).length) { I.map = { ...I.det.map }; if (I.det.plataforma === 'Tiendanube' || I.det.plataforma === 'Shopify' || I.det.plataforma === 'WooCommerce') { I.opts.moneda = 'ars'; I.opts.tipo = 'venta'; } }
    if (I.map.nombre != null && (I.map.precio != null || I.map.costo != null)) I.items = tablaAProductos(I.det, I.map, { ...I.opts, cot, margen: Number(I.opts.margen) / 100 }).filter(x => x.nombre);
  } else if (I.texto.trim()) I.items = parsearLista(I.texto, cot, 'General', I.destino === 'comp' ? 'ars' : 'usd');   // la competencia publica en pesos
  if (I.items) I.items = cruzar(I.items, P.prods);
  // un mismo producto de tu catálogo no puede recibir dos precios de la misma lista: queda el último
  if (I.items) { const vistos = new Map(); I.items.forEach((x, i) => { if (x.existente) vistos.set(x.existente.id, i); }); I.items = I.items.filter((x, i) => !x.existente || vistos.get(x.existente.id) === i); }
}
const u2 = n => (Math.round(Number(n) * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const conPrecio = () => (I.items || []).filter(x => x.costo_usd > 0);

export function vistaImportar() {
  const it = I.items, ok = conPrecio(), nuevos = ok.filter(x => !x.existente), upd = ok.filter(x => x.existente), sin = (it || []).length - ok.length;
  const mapUI = I.filas && I.det ? `<div class="card" style="margin-top:10px"><b>Archivo reconocido como: ${esc(I.det.plataforma)}</b>${I.hojas && I.hojas.length > 1 ? `<div class="fg" style="margin-top:8px"><label class="flabel">Hoja</label><select class="fi" data-change="i-hoja">${I.hojas.map((h, i) => `<option value="${i}" ${I.hoja === i ? 'selected' : ''}>${esc(h.nombre)} (${h.filas.length} filas)</option>`).join('')}</select></div>` : ''}
    <p class="hint" style="margin:6px 0">Revisá que cada dato esté en la columna correcta:</p>
    <div class="row2">${CAMPOS.map(([k, n]) => `<div class="fg"><label class="flabel">${n}</label><select class="fi" data-change="i-map" data-k="${k}"><option value="">— no importar —</option>${I.det.head.map((h, i) => `<option value="${i}" ${I.map[k] === i ? 'selected' : ''}>${esc(h || 'Columna ' + (i + 1))}</option>`).join('')}</select></div>`).join('')}</div>
    <div class="row2"><div class="fg"><label class="flabel">Los precios están en</label><select class="fi" data-change="i-opt" data-k="moneda"><option value="usd" ${I.opts.moneda === 'usd' ? 'selected' : ''}>Dólares (USD)</option><option value="ars" ${I.opts.moneda === 'ars' ? 'selected' : ''}>Pesos (ARS)</option></select></div>
    <div class="fg"><label class="flabel">Ese precio es</label><select class="fi" data-change="i-opt" data-k="tipo"><option value="costo" ${I.opts.tipo === 'costo' ? 'selected' : ''}>Mi costo (lo que pago)</option><option value="venta" ${I.opts.tipo === 'venta' ? 'selected' : ''}>Precio de venta al público</option></select></div></div>
    ${I.opts.tipo === 'venta' ? `<div class="fg"><label class="flabel">Margen que tenía ese precio (%) — para calcular tu costo</label><input class="fi" type="number" min="0" max="900" value="${esc(I.opts.margen)}" data-input="i-opt" data-k="margen"></div>` : ''}</div>` : '';
  const destino = `<div class="fg" style="margin-top:10px"><label class="flabel">¿Qué es esta lista?</label><select class="fi" data-change="i-dest"><option value="mis" ${I.destino === 'mis' ? 'selected' : ''}>Mis productos (agregar / actualizar)</option><option value="prov" ${I.destino === 'prov' ? 'selected' : ''}>Lista de un proveedor (para comparar costos)${can('proveedores') ? '' : ' 🔒 Pro'}</option><option value="comp" ${I.destino === 'comp' ? 'selected' : ''}>Precios de un competidor (referencia de mercado)${can('mercado') ? '' : ' 🔒 Pro'}</option></select></div>
    ${I.destino !== 'mis' ? `<div class="fg"><label class="flabel">${I.destino === 'prov' ? 'Nombre del proveedor' : 'Nombre del competidor'}</label><input class="fi" maxlength="60" value="${esc(I.nombre)}" data-input="i-nombre" placeholder="${I.destino === 'prov' ? 'Ej: Distribuidora Sur' : 'Ej: Tienda de la esquina'}"></div>
    <p class="hint">Solo se cargan los productos que ya existen en tu catálogo (se cruzan por código o nombre).</p>` : ''}`;
  const vista = it ? `<div class="card" style="margin-top:10px"><b>${ok.length} productos con precio</b> · ${I.destino === 'mis' ? `<span class="tag ok">${nuevos.length} nuevos</span> <span class="tag warn">${upd.length} ya existen</span>` : `<span class="tag ok">${upd.length} coinciden con tu catálogo</span>${nuevos.length ? ` <span class="tag">${nuevos.length} no están en tu catálogo (se omiten)</span>` : ''}`}${sin ? ` <span class="tag bad">${sin} sin precio (se omiten)</span>` : ''}
    <div class="prev tblw"><table class="tbl"><tr><th>Producto</th><th>${I.destino === 'comp' ? 'Precio $' : 'Costo USD'}</th><th></th></tr>${ok.slice(0, 40).map(x => `<tr><td>${esc(x.nombre)}${x.variantes && x.variantes.length ? '<br><small class="muted">' + esc(x.variantes.join(', ')) + '</small>' : ''}</td><td>${I.destino === 'comp' ? fmt(x.precio_ars || x.costo_usd * Number(P.t.cotizacion_usd)) : u2(x.costo_usd)}</td><td>${I.destino !== 'mis' ? (x.existente ? `<span class="tag ok">→ ${esc(x.existente.nombre)}</span>` : '<span class="tag">se omite</span>') : x.existente ? `<span class="tag warn">actualiza${x.existente.costo_usd != null && Number(x.existente.costo_usd) !== x.costo_usd ? ' ' + u2(x.existente.costo_usd) + '→' + u2(x.costo_usd) : ''}</span>` : '<span class="tag ok">nuevo</span>'}</td></tr>`).join('')}</table></div>${ok.length > 40 ? `<p class="muted">…y ${ok.length - 40} más</p>` : ''}</div>` : '';
  const hay = ok.length > 0 && (I.destino === 'mis' || (I.nombre.trim().length >= 2 && upd.length > 0 && can(I.destino === 'prov' ? 'proveedores' : 'mercado')));
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal" role="dialog" aria-modal="true"><div class="view-title">📥 Importar lista</div><div id="mm">${I.err ? `<div class="err-box">${esc(I.err)}</div>` : ''}${I.msg ? `<div class="ok-box">${esc(I.msg)}</div>` : ''}</div>
    <label class="drop" id="drop" for="i-file">📎 <b>Subí un archivo</b> o arrastralo acá<br><small>CSV de Tiendanube / Empretienda / Shopify / WooCommerce, Excel, PDF, chat de WhatsApp (.txt/.zip), o una foto de la lista</small><br><small>${esc(I.archivo)}</small></label>
    <input id="i-file" type="file" hidden data-change="i-file" accept=".csv,.tsv,.txt,.zip,.xlsx,.xlsm,.xls,.ods,.pdf,image/*">
    <p class="hint center" style="margin:8px 0">…o pegá el texto (lista del proveedor, mensajes de WhatsApp o de un grupo):</p>
    <textarea class="fi" id="imp-t" rows="5" data-input="i-texto" placeholder="Perfume X 100ml - USD 7,5&#10;Taza $3.500&#10;[12/10, 10:15] Proveedor: Cable USB-C 1m 2,1 usd">${esc(I.texto)}</textarea>
    <p class="hint" style="margin-top:6px">${I.destino === 'comp' ? 'Precios de la competencia: los números sin símbolo se toman en <b>pesos</b>.' : 'Con <b>$</b> tomamos pesos (los pasamos a dólares con tu cotización); con <b>USD</b> o sin símbolo, dólares.'} Las fotos se cargan por producto (o vienen solas desde un CSV de Shopify/Tiendanube con link de imagen).</p>
    ${I.busy ? `<div class="center" style="margin:10px 0"><span class="spin"></span><div class="hint">${esc(I.msg)}</div></div>` : ''}${mapUI}${(I.items || I.texto || I.filas) ? destino : ''}${vista}
    <button class="btn btn-p" style="margin-top:10px" data-act="i-ok" ${hay && !I.busy ? '' : 'disabled'}>${I.destino === 'mis' ? 'Importar ' + ok.length + ' productos' : 'Cargar ' + upd.length + ' precios'}</button>
    <button class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cancelar</button></div></div>`;
}
const refrescar = () => P.repintar();
on('i-texto', (d, el) => { I.texto = el.value; I.filas = null; I.hojas = null; I.map = {}; clearTimeout(on.t); on.t = setTimeout(() => { procesar(); const pos = el.selectionStart; refrescar(); const n = $('#imp-t'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 500); });
async function cargar(f) {
  if (!f) return; I.busy = true; I.err = ''; I.msg = 'Leyendo ' + f.name + '…'; I.archivo = f.name; refrescar();
  try {
    const r = await leerArchivo(f, m => { I.msg = m; const h = $('.modal .hint.center'); });
    I.map = {}; I.hojas = null;
    if (r.tipo === 'tabla') { I.filas = r.filas; I.hojas = r.hojas || null; I.hoja = 0; I.texto = ''; }
    else { I.filas = null; I.texto = r.texto.slice(0, 400000); if (r.ocr) I.msg = 'Texto leído con OCR: revisá los precios antes de importar.'; }
    I.busy = false; if (r.tipo === 'tabla') I.msg = ''; procesar();
    if (!I.items || !I.items.length) I.err = 'No encontramos productos con precio. Si es una planilla, elegí las columnas abajo.';
  } catch (e) { I.busy = false; I.msg = ''; I.err = e.message; }
  refrescar();
}
on('i-file', (d, el) => cargar(el.files && el.files[0]));
document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('#drop'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('#drop'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => { const z = e.target.closest && e.target.closest('#drop'); if (z) { e.preventDefault(); cargar(e.dataTransfer.files[0]); } });
on('i-hoja', (d, el) => { I.hoja = +el.value; I.filas = I.hojas[I.hoja].filas; I.map = {}; procesar(); refrescar(); });
on('i-map', (d, el) => { if (el.value === '') delete I.map[d.k]; else I.map[d.k] = +el.value; procesar(); refrescar(); });
on('i-opt', (d, el) => { I.opts[d.k] = el.value; procesar(); if (d.k !== 'margen') refrescar(); else { clearTimeout(on.t2); on.t2 = setTimeout(refrescar, 600); } });
on('i-dest', (d, el) => { I.destino = el.value; if (I.destino === 'comp' && I.filas) I.opts.moneda = 'ars'; procesar(); refrescar(); });
on('i-nombre', (d, el) => { I.nombre = el.value; const b = $('[data-act=i-ok]'); if (b) b.disabled = !(el.value.trim().length >= 2 && conPrecio().some(x => x.existente)); });

on('i-ok', async () => {
  const ok = conPrecio(), t = P.t; I.busy = true; I.err = ''; I.msg = 'Guardando…'; refrescar();
  try {
    if (I.destino === 'mis') {
      const nuevos = ok.filter(x => !x.existente), upd = ok.filter(x => x.existente);
      const filas = nuevos.map(x => ({ tenant_id: t.id, nombre: x.nombre.slice(0, 160), categoria: (x.categoria || 'General').slice(0, 60), marca: x.marca || null, sku: x.sku || null, descripcion: x.descripcion || null, costo_usd: x.costo_usd, variantes: x.variantes || [], imagen_url: x.imagen_url || null, stock: x.stock != null ? x.stock : (x.agotado ? 0 : null), activo: x.activo !== false, emoji: '📦' }));
      // sin SKU repetido dentro de la tanda (la base lo rechazaría)
      const vistos = new Set(); const filas2 = filas.filter(f => { if (!f.sku) return true; const k = clave(f.sku); if (vistos.has(k) || P.prods.some(p => p.sku && clave(p.sku) === k)) { f.sku = null; } else vistos.add(k); return true; });
      if (filas2.length) await api.insertarProductos(filas2);
      for (let i = 0; i < upd.length; i += 6) await Promise.all(upd.slice(i, i + 6).map(x => { const c = { costo_usd: x.costo_usd }; if (x.stock != null) c.stock = x.stock; else if (x.agotado) c.stock = 0; if (x.imagen_url && !x.existente.imagen_url) c.imagen_url = x.imagen_url; return api.guardarProducto(x.existente.id, c); }));
      I.msg = `Listo: ${filas2.length} productos nuevos y ${upd.length} actualizados.`;
    } else {
      const items = ok.filter(x => x.existente);
      for (let i = 0; i < items.length; i += 1000) {
        const lote = items.slice(i, i + 1000);
        if (I.destino === 'prov') await api.cargarOferta(I.nombre.trim(), lote.map(x => ({ product_id: x.existente.id, costo_usd: x.costo_usd, disponible: !x.agotado })));
        else await api.cargarRefs(I.nombre.trim(), lote.filter(x => x.precio_ars > 0).map(x => ({ product_id: x.existente.id, precio_ars: x.precio_ars })));
      }
      I.msg = `Listo: ${items.length} precios cargados (${I.nombre.trim()}).`;
    }
    P.prods = await api.misProductos(); try { P.provs = await api.misProveedores(); } catch (e) { }
    const m = I.msg; const dest = I.destino; resetImp(); I.msg = m; I.destino = dest === 'mis' ? 'mis' : dest;
    P.modal = { tipo: 'imp' }; I.items = null;
  } catch (e) { I.busy = false; I.msg = ''; I.err = e.message; }
  I.busy = false; refrescar();
});
