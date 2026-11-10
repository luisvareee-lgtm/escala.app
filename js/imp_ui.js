// Pantalla del importador (v2.5): varios archivos a la vez (CSV, Excel, PDF, chat de WhatsApp con fotos, fotos de proveedores),
// texto pegado, revisión producto por producto y cómo publicar (margen, unidad de venta, precio único o con escala, visible).
import { api } from './api.js';
import { $, esc, fmt, on, toast, copiar, waLink } from './util.js';
import { P, can, precioArs } from './state.js';
import { urlTiendaDe } from './marca.js';
import { parsearLista, detectarTabla, tablaAProductos, leerArchivo, cruzar, CAMPOS, clave, deTextoDeFoto, nombreDeArchivo, ocr } from './importer.js';
import { redimensionar } from './img.js';

const UNIDADES = [['unidad', 'Unidad'], ['par', 'Par'], ['docena', 'Docena'], ['pack', 'Pack'], ['bulto', 'Bulto'], ['caja', 'Caja'], ['display', 'Display'], ['kg', 'Kilo (kg)'], ['gramos', 'Gramos'], ['litro', 'Litro'], ['metro', 'Metro']];
export const CON_CONTENIDO = ['pack', 'bulto', 'caja', 'display'];
const nuevoEstado = () => ({
  tablas: [],                 // [{archivo, filas, hojas, hoja, det, map, opts:{moneda,tipo,margen}}]
  fotos: [],                  // [{uid, archivo, foto(Blob), url, texto, leyenda, fuente}]
  texto: '', fotoModo: 'producto',
  opts: { moneda: 'ars', tipo: 'costo', margen: null },          // para texto pegado, fotos y WhatsApp
  pub: null,                  // {margen, unidad, contenido, unico, visible, categoria}
  ed: {}, items: null, mostrar: 60, uso: {}, sinFotos: false, recorte: null, ocultarFaltan: false,
  destino: 'mis', nombre: '', msg: '', err: '', busy: false,
});
const I = nuevoEstado();
// Aviso para los clientes después de actualizar la lista (sobrevive al reinicio del importador)
const AV = { texto: '', resumen: '' };
export const resetImp = () => { I.fotos.forEach(f => f.url && URL.revokeObjectURL(f.url)); Object.assign(I, nuevoEstado()); };

const cot = () => Number(P.t.cotizacion_usd) > 0 ? Number(P.t.cotizacion_usd) : 1;
const pubDef = () => ({ margen: Math.round(Number(P.t.margen_1) * 100), unidad: 'unidad', contenido: '', unico: false, visible: true, categoria: '' });

/* ---------- arma la lista de productos a partir de todas las fuentes ---------- */
function procesar() {
  I.err = ''; if (!I.pub) I.pub = pubDef();
  if (I.opts.margen == null) I.opts.margen = Math.round(Number(P.t.margen_1) * 100);
  const c = cot(), out = [];
  I.tablas.forEach((tb, ti) => {
    tb.det = detectarTabla(tb.filas);
    if (!tb.map) { tb.map = { ...tb.det.map }; if (['Tiendanube', 'Shopify', 'WooCommerce'].includes(tb.det.plataforma)) Object.assign(tb.opts, { moneda: 'ars', tipo: 'venta' }); }
    if (tb.opts.margen == null) tb.opts.margen = Math.round(Number(P.t.margen_1) * 100);
    if (tb.map.nombre == null || (tb.map.precio == null && tb.map.costo == null)) return;
    tablaAProductos(tb.det, tb.map, { ...tb.opts, cot: c, margen: Number(tb.opts.margen) / 100 })
      .filter(x => x.nombre).forEach((x, i) => out.push({ ...x, uid: 't' + ti + '-' + i, fuente: tb.archivo }));
  });
  const ajuste = it => {      // texto / fotos: "el precio leído es mi costo / precio de venta / no usar"
    if (I.opts.tipo === 'ninguno') { it.costo_usd = null; it.precio_ars = null; }
    else if (I.opts.tipo === 'venta' && it.costo_usd > 0) { const k = 1 + Number(I.opts.margen) / 100; it.costo_usd = Math.round(it.costo_usd / k * 10000) / 10000; it.precio_ars = Math.round(it.precio_ars / k); }
    return it;
  };
  if (I.texto.trim()) parsearLista(I.texto, c, 'General', I.destino === 'comp' ? 'ars' : I.opts.moneda).forEach((x, i) => out.push(ajuste({ ...x, uid: 'x' + i, fuente: 'texto pegado' })));
  I.fotos.forEach(f => {
    if (I.fotoModo === 'lista' && !f.leyenda) {   // la foto es una LISTA con varios productos
      parsearLista(f.texto, c, 'General', I.opts.moneda).forEach((x, i) => out.push(ajuste({ ...x, uid: f.uid + '-' + i, fuente: f.archivo })));
      return;
    }
    // cada foto = un producto: primero el texto que la acompaña (WhatsApp), después lo escrito en la foto, después el nombre del archivo
    let d = null;
    if (f.leyenda) { const l = parsearLista(f.leyenda, c, 'General', I.opts.moneda).find(x => x.costo_usd > 0); if (l) d = { nombre: l.nombre, costo_usd: l.costo_usd, precio_ars: l.precio_ars, inferido: l.inferido }; else d = { ...deTextoDeFoto(f.leyenda, c, I.opts.moneda) }; }
    const dOcr = f.texto ? deTextoDeFoto(f.texto, c, I.opts.moneda) : null;
    if (!d) d = dOcr || { nombre: '', costo_usd: null, precio_ars: null };
    if (!(d.costo_usd > 0) && dOcr && dOcr.costo_usd > 0) Object.assign(d, { costo_usd: dOcr.costo_usd, precio_ars: dOcr.precio_ars, inferido: dOcr.inferido });
    if (!d.nombre) d.nombre = (dOcr && dOcr.nombre) || nombreDeArchivo(f.archivo) || '';
    out.push(ajuste({ ...d, uid: f.uid, foto: f.foto, fotoUrl: f.url, captura: !!f.captura, categoria: 'General', variantes: [], fuente: f.fuente || 'foto', revisar: true }));
  });
  // ediciones hechas a mano en la revisión
  out.forEach(it => {
    const e = I.ed[it.uid]; if (!e) return;
    if (e.nombre != null) it.nombre = e.nombre;
    if (e.costoArs != null) { it.precio_ars = e.costoArs; it.costo_usd = e.costoArs > 0 ? Math.round(e.costoArs / c * 10000) / 10000 : null; it.inferido = false; }
  });
  const rech = new Set(Object.entries(I.ed).filter(([, e]) => e.mismo === false).map(([u]) => u));
  let items = cruzar(out.filter(x => (x.nombre || '').trim() || x.foto), P.prods, rech);
  items.forEach(x => { if (x.duda && I.ed[x.uid] && I.ed[x.uid].mismo === true) x.duda = false; });
  const ult = new Map(); items.forEach((x, i) => { if (x.existente) ult.set(x.existente.id, i); });
  items = items.filter((x, i) => !x.existente || ult.get(x.existente.id) === i);
  items.forEach(x => {
    const e = I.ed[x.uid]; x.incluir = x.duda ? false : e && e.incluir != null ? e.incluir : x.costo_usd > 0 && !!(x.nombre || '').trim();
    // foto para la tienda: 'usar' | 'no'. Las capturas vienen en 'no' (tienen el precio del proveedor); se pueden recortar.
    if (x.foto) x.usoFoto = (e && e.usoFoto) || (I.sinFotos ? 'no' : x.captura ? 'no' : 'usar');
  });
  I.items = items.length ? items : null;
}
const listos = () => (I.items || []).filter(x => x.incluir && x.costo_usd > 0 && (x.nombre || '').trim());
const pv = costoUsd => Math.ceil(Number(costoUsd) * cot() * (1 + Number(I.pub.margen) / 100) / 10) * 10;
const etiquetaUnidad = (u, n) => { const b = (UNIDADES.find(x => x[0] === u) || ['', 'Unidad'])[1]; return CON_CONTENIDO.includes(u) && n ? `${b} x${n}` : b; };

/* ---------- LISTA VIVA: qué cambió respecto del catálogo ---------- */
const margenDe = p => p.margen_override != null ? Number(p.margen_override) : Number(P.t.margen_1);
const ventaDe = (p, costo) => precioArs(costo, cot(), margenDe(p));
const cambio = x => { const e = x.existente; if (!e || !(Number(e.costo_usd) > 0) || !(x.costo_usd > 0)) return 0; const d = (x.costo_usd - Number(e.costo_usd)) / Number(e.costo_usd); return Math.abs(d) < 0.005 ? 0 : d; };
export function diffLista() {
  const ok = listos(), upd = ok.filter(x => x.existente), suben = upd.filter(x => cambio(x) > 0), bajan = upd.filter(x => cambio(x) < 0);
  const tocados = new Set((I.items || []).filter(x => x.existente).map(x => x.existente.id)), activos = P.prods.filter(p => p.activo);
  // "no vinieron": solo tiene sentido si la lista cubre buena parte del catálogo
  const faltan = tocados.size >= 5 && tocados.size >= activos.length * 0.3 ? activos.filter(p => !tocados.has(p.id)) : [];
  const prom = L => L.length ? Math.round(L.reduce((a, x) => a + Math.abs(cambio(x)), 0) / L.length * 100) : 0;
  return { upd, suben, bajan, iguales: upd.length - suben.length - bajan.length, nuevos: ok.filter(x => !x.existente), faltan, dudas: (I.items || []).filter(x => x.duda), promSube: prom(suben), promBaja: prom(bajan) };
}
function vistaListaViva() {
  if (I.destino !== 'mis' || !I.items) return '';
  const D = diffLista(); if (!D.upd.length && !D.dudas.length) return '';
  return `<div class="lv" id="lv"><b>🔄 Lista viva · qué cambió respecto de tu catálogo</b>
    <div class="lv-n"><span class="lv-up">⬆️ <b>${D.suben.length}</b> subieron${D.suben.length ? ' (prom. +' + D.promSube + '%)' : ''}</span><span class="lv-dn">⬇️ <b>${D.bajan.length}</b> bajaron${D.bajan.length ? ' (prom. −' + D.promBaja + '%)' : ''}</span><span>＝ <b>${D.iguales}</b> sin cambio</span><span>🆕 <b>${D.nuevos.length}</b> nuevos</span>${D.faltan.length ? `<span>❓ <b>${D.faltan.length}</b> no vinieron</span>` : ''}</div>
    ${D.dudas.length ? `<p class="lv-duda">🤔 Hay ${D.dudas.length} ${D.dudas.length === 1 ? 'producto parecido' : 'productos parecidos'} a uno que ya tenés: decidí abajo si es el mismo.</p>` : ''}
    ${D.faltan.length ? `<details class="lv-f"><summary>Ver los ${D.faltan.length} que no vinieron en esta lista</summary><p class="hint">${esc(D.faltan.slice(0, 40).map(p => p.nombre).join(' · '))}${D.faltan.length > 40 ? ' y ' + (D.faltan.length - 40) + ' más' : ''}</p></details>
      <label class="chk"><input type="checkbox" data-change="i-faltan" ${I.ocultarFaltan ? 'checked' : ''}> Ocultarlos de mi tienda (el proveedor ya no los tiene)</label>` : ''}
    <p class="hint">Al cargar, tus precios de venta se recalculan con tu ganancia y te dejamos listo el aviso para tus clientes.</p></div>`;
}
function armarAviso(D, margenNuevos) {
  const t = P.t, L = [], top = (arr, f) => arr.slice(0, 12).map(f).concat(arr.length > 12 ? [`…y ${arr.length - 12} más`] : []);
  const pvN = x => precioArs(x.costo_usd, cot(), margenNuevos);
  L.push(`📢 *Lista actualizada · ${t.nombre}* (${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })})`);
  const sube = D.suben.filter(x => ventaDe(x.existente, x.costo_usd) !== ventaDe(x.existente, x.existente.costo_usd)), baja = D.bajan.filter(x => ventaDe(x.existente, x.costo_usd) !== ventaDe(x.existente, x.existente.costo_usd));
  const lin = x => `• ${x.existente.nombre}: ${fmt(ventaDe(x.existente, x.existente.costo_usd))} → ${fmt(ventaDe(x.existente, x.costo_usd))}`;
  if (baja.length) L.push('', `⬇️ *Bajaron (${baja.length})*`, ...top(baja, lin));
  if (sube.length) L.push('', `⬆️ *Actualizaron precio (${sube.length})*`, ...top(sube, lin));
  if (D.nuevos.length) L.push('', `🆕 *Novedades (${D.nuevos.length})*`, ...top(D.nuevos, x => `• ${x.nombre.trim()}: ${fmt(pvN(x))}`));
  if (D.ocultos && D.ocultos.length) L.push('', `❌ *Sin stock por ahora (${D.ocultos.length})*: ${D.ocultos.slice(0, 10).map(p => p.nombre).join(', ')}${D.ocultos.length > 10 ? '…' : ''}`);
  if (L.length === 1) return '';
  L.push('', 'Mirá todos los precios y hacé tu pedido acá:', urlTiendaDe(t.slug));
  return L.join('\n');
}
const vistaAviso = () => AV.texto ? `<div class="lv lv-ok" id="lv-aviso"><b>📢 Avisales a tus clientes</b><p class="hint">${esc(AV.resumen)} Editá el mensaje si querés y compartilo en tus grupos, estados o lista de difusión.</p>
    <textarea class="fi" id="lv-txt" rows="9" data-input="lv-txt">${esc(AV.texto)}</textarea>
    <div class="lv-acc"><a class="btn btn-wa btn-sm" id="lv-wa" target="_blank" rel="noopener" href="${esc(waLink('', AV.texto))}">Compartir por WhatsApp</a><button class="btn btn-s btn-sm" data-act="lv-copiar">📋 Copiar</button><button class="btn-link" data-act="lv-cerrar">Listo, ocultar</button></div></div>` : '';
on('lv-txt', (d, el) => { AV.texto = el.value; const a = $('#lv-wa'); if (a) a.href = waLink('', AV.texto); });
on('lv-copiar', () => copiar(AV.texto));
on('lv-cerrar', () => { AV.texto = ''; AV.resumen = ''; P.repintar(); });
on('i-faltan', (d, el) => { I.ocultarFaltan = el.checked; });
on('i-mismo', d => { (I.ed[d.u] = I.ed[d.u] || {}).mismo = d.v === '1'; if (d.v === '1') I.ed[d.u].incluir = true; procesar(); P.repintar(); });

/* ---------- vista ---------- */
function vistaTablas() {
  return I.tablas.map((tb, ti) => !tb.det ? '' : `<details class="card" style="margin-top:10px" ${tb.det.reconocido && tb.map.nombre != null ? '' : 'open'}><summary><b>${esc(tb.archivo)}</b> · reconocido como ${esc(tb.det.plataforma)}</summary>
    ${tb.hojas && tb.hojas.length > 1 ? `<div class="fg" style="margin-top:8px"><label class="flabel">Hoja</label><select class="fi" data-change="i-hoja" data-t="${ti}">${tb.hojas.map((h, i) => `<option value="${i}" ${tb.hoja === i ? 'selected' : ''}>${esc(h.nombre)} (${h.filas.length} filas)</option>`).join('')}</select></div>` : ''}
    <p class="hint" style="margin:6px 0">Revisá que cada dato esté en la columna correcta:</p>
    <div class="row2">${CAMPOS.map(([k, n]) => `<div class="fg"><label class="flabel">${n}</label><select class="fi" data-change="i-map" data-t="${ti}" data-k="${k}"><option value="">— no importar —</option>${tb.det.head.map((h, i) => `<option value="${i}" ${tb.map[k] === i ? 'selected' : ''}>${esc(h || 'Columna ' + (i + 1))}</option>`).join('')}</select></div>`).join('')}</div>
    <div class="row2"><div class="fg"><label class="flabel">Los precios están en</label><select class="fi" data-change="i-topt" data-t="${ti}" data-k="moneda"><option value="ars" ${tb.opts.moneda === 'ars' ? 'selected' : ''}>Pesos (ARS)</option><option value="usd" ${tb.opts.moneda === 'usd' ? 'selected' : ''}>Dólares (USD)</option></select></div>
    <div class="fg"><label class="flabel">Ese precio es</label><select class="fi" data-change="i-topt" data-t="${ti}" data-k="tipo"><option value="costo" ${tb.opts.tipo === 'costo' ? 'selected' : ''}>Mi costo (lo que pago)</option><option value="venta" ${tb.opts.tipo === 'venta' ? 'selected' : ''}>Mi precio de venta</option></select></div></div>
    ${tb.opts.tipo === 'venta' ? `<div class="fg"><label class="flabel">¿Qué ganancia tenía ese precio? (%) — la usamos para calcular tu costo</label><input class="fi" type="number" min="0" max="900" value="${esc(tb.opts.margen)}" data-input="i-topt" data-t="${ti}" data-k="margen"></div>` : ''}</details>`).join('');
}
function vistaOpcionesLectura() {
  if (!I.texto.trim() && !I.fotos.length) return '';
  const hayFotoSola = I.fotos.some(f => !f.leyenda);
  return `<div class="card" style="margin-top:10px"><b>Precios leídos de fotos, WhatsApp o texto</b>
    ${hayFotoSola ? `<div class="fg" style="margin-top:8px"><label class="flabel">Las fotos son…</label><select class="fi" data-change="i-fmodo"><option value="producto" ${I.fotoModo === 'producto' ? 'selected' : ''}>Una foto por producto (catálogo / canal del proveedor)</option><option value="lista" ${I.fotoModo === 'lista' ? 'selected' : ''}>Una lista de precios con muchos productos (captura de Excel o de una lista)</option></select></div>` : ''}
    <div class="row2"><div class="fg"><label class="flabel">El precio que aparece es</label><select class="fi" data-change="i-opt" data-k="tipo"><option value="costo" ${I.opts.tipo === 'costo' ? 'selected' : ''}>Lo que me cobra el proveedor (mi costo)</option><option value="venta" ${I.opts.tipo === 'venta' ? 'selected' : ''}>Un precio de venta</option><option value="ninguno" ${I.opts.tipo === 'ninguno' ? 'selected' : ''}>No usarlo: cargo el costo yo</option></select></div>
    <div class="fg"><label class="flabel">Números sin $ ni USD son</label><select class="fi" data-change="i-opt" data-k="moneda"><option value="ars" ${I.opts.moneda === 'ars' ? 'selected' : ''}>Pesos</option><option value="usd" ${I.opts.moneda === 'usd' ? 'selected' : ''}>Dólares</option></select></div></div>
    ${I.opts.tipo === 'venta' ? `<div class="fg"><label class="flabel">¿Qué ganancia tenía ese precio? (%)</label><input class="fi" type="number" min="0" max="900" value="${esc(I.opts.margen)}" data-input="i-opt" data-k="margen"></div>` : ''}
    <p class="hint">Lo leído de una foto puede tener errores: los marcamos con 🔎 para que los revises.</p>
    ${I.fotos.some(f => f.foto) ? `<p class="hint">📸 <b>Fotos con el precio del proveedor:</b> sirven para leer tu costo, pero no para publicarlas (tu cliente vería ese precio). Las <b>capturas de pantalla</b> ya vienen en "Sin foto". En cada producto podés elegir <b>Usar foto</b>, <b>Sin foto</b> o <b>✂️ Recortar</b> solo el producto.</p>
    <label class="chk"><input type="checkbox" data-change="i-sinfotos" ${I.sinFotos ? 'checked' : ''}> No usar ninguna de estas imágenes como foto (solo leer nombre y costo)</label>` : ''}</div>`;
}
function vistaPublicar(nNuevos) {
  if (I.destino !== 'mis' || !nNuevos) return '';
  const u = I.pub;
  return `<div class="card" style="margin-top:10px"><b>Cómo publicar los ${nNuevos} productos nuevos</b>
    <div class="row2" style="margin-top:8px"><div class="fg"><label class="flabel">Tu ganancia sobre el costo (%)</label><input class="fi" type="number" min="0" max="900" value="${esc(u.margen)}" data-input="i-pub" data-k="margen"></div>
    <div class="fg"><label class="flabel">Categoría (si no viene en el archivo)</label><input class="fi" maxlength="60" value="${esc(u.categoria)}" placeholder="Ej: Perfumes" data-input="i-pub" data-k="categoria"></div></div>
    <div class="row2"><div class="fg"><label class="flabel">Se venden por</label><select class="fi" data-change="i-pub" data-k="unidad">${UNIDADES.map(([k, n]) => `<option value="${k}" ${u.unidad === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    ${CON_CONTENIDO.includes(u.unidad) ? `<div class="fg"><label class="flabel">¿Cuántas unidades trae cada ${esc(etiquetaUnidad(u.unidad).toLowerCase())}?</label><input class="fi" type="number" min="1" max="100000" value="${esc(u.contenido)}" placeholder="Ej: 12" data-input="i-pub" data-k="contenido"></div>` : '<div></div>'}</div>
    ${P.t.modalidad !== 'minorista' ? `<div class="fg"><label class="flabel">Precio mayorista</label><select class="fi" data-change="i-pub" data-k="unico"><option value="0" ${!u.unico ? 'selected' : ''}>Con descuento por cantidad (x1 · x3 · x6 · x12)</option><option value="1" ${u.unico ? 'selected' : ''}>Precio único (mismo precio sin importar la cantidad)</option></select></div>` : ''}
    <label class="chk"><input type="checkbox" data-change="i-pub" data-k="visible" ${u.visible ? 'checked' : ''}> Publicarlos ya en la tienda (si no, quedan ocultos para revisarlos)</label>
    <p class="hint">Los productos que ya existen solo actualizan su costo (y el stock o la foto si faltaban): no cambian cómo se publican.</p></div>`;
}
function fila(x) {
  const e = x.existente, estado = !(x.costo_usd > 0) ? '<span class="tag bad">falta el costo</span>' : I.destino !== 'mis' ? (e ? `<span class="tag ok">→ ${esc(e.nombre)}</span>` : '<span class="tag">no está en tu catálogo</span>') : x.duda ? `<span class="lv-q">¿Es “${esc(e.nombre)}”?<br><button class="btn btn-s btn-sm" data-act="i-mismo" data-u="${esc(x.uid)}" data-v="1">Sí, es el mismo</button> <button class="btn btn-s btn-sm" data-act="i-mismo" data-u="${esc(x.uid)}" data-v="0">No, es nuevo</button></span>`
    : e ? (() => { const c = cambio(x); return c ? `<span class="tag ${c > 0 ? 'warn' : 'ok'}">${c > 0 ? '⬆️ +' : '⬇️ −'}${Math.abs(Math.round(c * 100))}%</span><br><small class="muted">${fmt(ventaDe(e, e.costo_usd))} → <b>${fmt(ventaDe(e, x.costo_usd))}</b></small>` : '<span class="tag">sin cambio</span>'; })() + (x.aprox ? `<br><small class="muted">≈ ${esc(e.nombre)} <button class="btn-link" data-act="i-mismo" data-u="${esc(x.uid)}" data-v="0">no es</button></small>` : '')
    : '<span class="tag ok">nuevo</span>';
  const costoArs = x.costo_usd > 0 ? Math.round(x.costo_usd * cot()) : '';
  return `<tr class="${x.incluir ? '' : 'off'}"><td><input type="checkbox" aria-label="Incluir" data-change="i-inc" data-u="${esc(x.uid)}" ${x.incluir ? 'checked' : ''}></td>
    <td>${x.fotoUrl ? `<img class="imp-th${x.usoFoto === 'no' ? ' imp-th-no' : ''}" src="${esc(x.fotoUrl)}" alt=""><select class="imp-uso" aria-label="Foto para la tienda" data-change="i-uso" data-u="${esc(x.uid)}"><option value="usar" ${x.usoFoto === 'usar' ? 'selected' : ''}>Usar foto</option><option value="no" ${x.usoFoto === 'no' ? 'selected' : ''}>Sin foto</option><option value="recortar">✂️ Recortar…</option></select>${x.captura ? '<small class="muted">captura</small>' : ''}` : x.imagen_url ? `<img class="imp-th" src="${esc(x.imagen_url)}" alt="" loading="lazy">` : ''}</td>
    <td><input class="fi fi-s" maxlength="160" value="${esc(x.nombre || '')}" placeholder="Escribí el nombre" data-input="i-ed" data-u="${esc(x.uid)}" data-k="nombre">${x.revisar ? ' <span title="Leído de una foto: revisalo">🔎</span>' : ''}${x.variantes && x.variantes.length ? '<br><small class="muted">' + esc(x.variantes.join(', ')) + '</small>' : ''}<br><small class="muted">${esc(x.fuente || '')}${x.activo === false ? ' · estaba oculto' : ''}</small></td>
    <td><input class="fi fi-s" type="number" min="0" step="any" value="${costoArs}" placeholder="$" data-input="i-ed" data-u="${esc(x.uid)}" data-k="costo" style="max-width:110px">${x.inferido ? '<br><small class="muted">número sin $: revisalo</small>' : ''}</td>
    ${I.destino === 'mis' ? `<td class="r">${x.costo_usd > 0 ? fmt(x.existente && !x.duda ? ventaDe(x.existente, x.costo_usd) : pv(x.costo_usd)) : '—'}</td>` : ''}<td>${estado}</td></tr>`;
}
function vistaRecorte() {
  const f = I.fotos.find(x => x.uid === I.recorte.uid); if (!f) return '';
  return `<div class="modal-bg"><div class="modal modal-ancho" role="dialog" aria-modal="true"><div class="view-title">✂️ Recortar la foto</div>
    <p class="hint">Arrastrá con el dedo o el mouse sobre la imagen para marcar <b>solo el producto</b> (dejá afuera el precio del proveedor y lo de WhatsApp).</p>
    <div id="rec-box" class="rec-box"><img id="rec-img" src="${esc(f.url)}" alt="" draggable="false"><div id="rec-sel" class="rec-sel"></div></div>
    <button class="btn btn-p" style="margin-top:10px" data-act="i-rec-ok" disabled>Usar este recorte</button><button class="btn btn-s" style="margin-top:8px" data-act="i-rec-no">Cancelar</button></div></div>`;
}
export function vistaImportar() {
  if (I.recorte) return vistaRecorte();
  const it = I.items, ok = listos(), nuevos = ok.filter(x => !x.existente), upd = ok.filter(x => x.existente);
  const sinCosto = (it || []).filter(x => !(x.costo_usd > 0)).length;
  const tabla = it ? `<div class="card" style="margin-top:10px"><div class="imp-bar"><b>${it.length} productos encontrados</b> · <span class="tag ok">${ok.length} elegidos</span>${I.destino === 'mis' ? ` <span class="tag">${nuevos.length} nuevos · ${upd.length} actualizan</span>` : ''}${sinCosto ? ` <span class="tag bad">${sinCosto} sin costo</span>` : ''}
      <span style="flex:1"></span><button class="btn btn-s btn-sm" data-act="i-todos" data-v="1">Elegir todos</button><button class="btn btn-s btn-sm" data-act="i-todos" data-v="0">Ninguno</button></div>
    <p class="hint">Tildá los que querés cargar. Podés corregir el nombre y el costo (en pesos) acá mismo.</p>
    <div class="prev tblw"><table class="tbl imp-tbl"><tr><th></th><th></th><th>Producto</th><th>Costo $</th>${I.destino === 'mis' ? '<th class="r">Venta</th>' : ''}<th></th></tr>${it.slice(0, I.mostrar).map(fila).join('')}</table></div>
    ${it.length > I.mostrar ? `<button class="btn btn-s" data-act="i-mas">Ver ${Math.min(200, it.length - I.mostrar)} más (de ${it.length - I.mostrar} que faltan)</button>` : ''}</div>` : '';
  const destino = `<div class="fg" style="margin-top:10px"><label class="flabel">¿Qué es esta lista?</label><select class="fi" data-change="i-dest"><option value="mis" ${I.destino === 'mis' ? 'selected' : ''}>Productos para vender (agregar / actualizar mi catálogo)</option><option value="prov" ${I.destino === 'prov' ? 'selected' : ''}>Lista de un proveedor (solo comparar costos)${can('proveedores') ? '' : ' 🔒 Pro'}</option><option value="comp" ${I.destino === 'comp' ? 'selected' : ''}>Precios de un competidor (referencia)${can('mercado') ? '' : ' 🔒 Pro'}</option></select></div>
    ${I.destino !== 'mis' ? `<div class="fg"><label class="flabel">${I.destino === 'prov' ? 'Nombre del proveedor' : 'Nombre del competidor'}</label><input class="fi" maxlength="60" value="${esc(I.nombre)}" data-input="i-nombre" placeholder="${I.destino === 'prov' ? 'Ej: Distribuidora Sur' : 'Ej: Tienda de la esquina'}"></div><p class="hint">Solo se cargan los que ya existen en tu catálogo (se cruzan por código o nombre).</p>` : ''}`;
  const hay = ok.length > 0 && (I.destino === 'mis' || (I.nombre.trim().length >= 2 && upd.length > 0 && can(I.destino === 'prov' ? 'proveedores' : 'mercado')));
  const fuentes = [...I.tablas.map(t => t.archivo), ...new Set(I.fotos.map(f => f.grupo || f.archivo))];
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal modal-ancho" role="dialog" aria-modal="true"><div class="view-title">📥 Cargar o actualizar productos</div><div id="mm">${I.err ? `<div class="err-box">${esc(I.err)}</div>` : ''}${I.msg && !I.busy ? `<div class="ok-box">${esc(I.msg)}</div>` : ''}</div>${I.busy ? '' : vistaAviso()}
    <label class="drop" id="drop" for="i-file">📎 <b>Subí la lista de tu proveedor</b> (uno o varios archivos) o arrastrala acá<br><small>Si ya tenés productos cargados, comparamos y te mostramos qué subió, qué bajó y qué hay de nuevo · Fotos de productos (del canal o grupo del proveedor) · chat de WhatsApp exportado (.zip, con las fotos) · CSV de Tiendanube / Shopify / Empretienda · Excel · PDF · captura de una lista</small>${fuentes.length ? `<br><small><b>Cargados:</b> ${esc(fuentes.slice(0, 6).join(' · '))}${fuentes.length > 6 ? ' y ' + (fuentes.length - 6) + ' más' : ''}</small> <button class="btn-link" data-act="i-limpiar">empezar de nuevo</button>` : ''}</label>
    <input id="i-file" type="file" hidden multiple data-change="i-file" accept=".csv,.tsv,.txt,.zip,.xlsx,.xlsm,.xls,.ods,.pdf,image/*">
    <details class="hint" style="margin:8px 0"><summary>¿Cómo traigo los productos de un canal o grupo de WhatsApp?</summary>
      <p><b>Grupo o chat:</b> en el celular abrí el grupo → ⋮ → Más → <b>Exportar chat</b> → <b>Incluir archivos</b> → guardalo y subí ese .zip acá. Cada foto se une con su texto (nombre y precio).</p>
      <p><b>Canal:</b> WhatsApp no permite exportarlos ni leerlos desde afuera (tampoco con un enlace). Guardá las fotos del canal (mantené apretada la foto → Guardar) y subilas todas juntas: cada foto será un producto y leemos el precio escrito en la imagen.</p></details>
    <textarea class="fi" id="imp-t" rows="3" data-input="i-texto" placeholder="…o pegá el texto de la lista (uno por renglón): Perfume X 100ml $12.500">${esc(I.texto)}</textarea>
    ${I.busy ? `<div class="center" style="margin:10px 0"><span class="spin"></span><div class="hint" id="imp-prog">${esc(I.msg)}</div></div>` : ''}
    ${vistaTablas()}${vistaOpcionesLectura()}${(I.items || I.texto || I.tablas.length || I.fotos.length) ? destino : ''}${vistaListaViva()}${vistaPublicar(nuevos.length)}${tabla}
    <button class="btn btn-p" style="margin-top:10px" data-act="i-ok" ${hay && !I.busy ? '' : 'disabled'}>${I.destino === 'mis' ? `Cargar ${ok.length} productos` : 'Cargar ' + upd.length + ' precios'}</button>
    <button class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cerrar</button></div></div>`;
}

/* ---------- eventos ---------- */
const refrescar = () => P.repintar();
const progreso = m => { I.msg = m; const n = $('#imp-prog'); if (n) n.textContent = m; };
on('i-texto', (d, el) => { I.texto = el.value; clearTimeout(on.t); on.t = setTimeout(() => { procesar(); const pos = el.selectionStart; refrescar(); const n = $('#imp-t'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 500); });

// Captura de pantalla del celular (canal / grupo): por nombre o por forma (alta y angosta). Esa imagen trae el precio
// del proveedor y la interfaz de WhatsApp: sirve para LEER el costo, no para publicarla tal cual.
async function esCaptura(f) {
  if (/screenshot|captura|screen ?shot|pantallazo/i.test(f.name)) return true;
  try { const b = await createImageBitmap(f); const r = b.height / b.width; b.close && b.close(); return r >= 1.7; } catch (e) { return false; }
}
async function cargar(lista) {
  AV.texto = ''; AV.resumen = '';
  const files = [...(lista || [])]; if (!files.length) return;
  I.busy = true; I.err = ''; refrescar();
  const errores = []; let n = 0;
  const imagenes = files.filter(f => /^image\//.test(f.type) || /\.(png|jpe?g|webp|bmp)$/i.test(f.name));
  for (const f of files) {
    n++;
    const esImg = imagenes.includes(f);
    progreso(esImg ? `Leyendo foto ${imagenes.indexOf(f) + 1} de ${imagenes.length}…` : `Leyendo ${f.name} (${n} de ${files.length})…`);
    try {
      if (esImg) {
        let texto = '';
        try { texto = await ocr(f, () => { }); } catch (e) { errores.push(f.name + ': no se pudo leer el texto (' + e.message + '). La cargamos igual con su foto.'); }
        const cap = await esCaptura(f);
        I.fotos.push({ uid: 'f' + I.fotos.length + '-' + Date.now(), archivo: f.name, foto: f, url: URL.createObjectURL(f), texto, fuente: (cap ? 'captura ' : 'foto ') + f.name, captura: cap });
        if (cap) I.uso['f' + (I.fotos.length - 1)] = null;
        continue;
      }
      const r = await leerArchivo(f, progreso);
      if (r.tipo === 'tabla') I.tablas.push({ archivo: f.name, filas: r.filas, hojas: r.hojas || null, hoja: 0, map: null, opts: { moneda: 'ars', tipo: 'costo', margen: null } });
      else if (r.tipo === 'productos') r.items.forEach((x, i) => I.fotos.push({ uid: 'w' + I.fotos.length + '-' + i, archivo: x.archivoFoto || f.name, grupo: f.name, foto: x.foto || null, url: x.foto ? URL.createObjectURL(x.foto) : null, texto: '', leyenda: x.leyenda, fuente: 'WhatsApp ' + f.name }));
      else I.texto = (I.texto ? I.texto + '\n' : '') + r.texto.slice(0, 400000);
    } catch (e) { errores.push(f.name + ': ' + e.message); }
  }
  // fotos de WhatsApp sin texto: leemos el precio escrito en la imagen
  const sinTexto = I.fotos.filter(x => x.foto && !x.leyenda && !x.texto && x.uid.startsWith('w'));
  for (let i = 0; i < sinTexto.length; i++) { progreso(`Leyendo el precio de las fotos sin texto: ${i + 1} de ${sinTexto.length}…`); try { sinTexto[i].texto = await ocr(sinTexto[i].foto, () => { }); } catch (e) { } }
  I.busy = false; I.msg = ''; procesar();
  if (errores.length) I.err = errores.slice(0, 4).join(' · ');
  else if (!I.items) I.err = 'No encontramos productos. Si es una planilla, elegí las columnas abajo.';
  refrescar();
}
on('i-file', (d, el) => { cargar(el.files); el.value = ''; });
document.addEventListener('dragover', e => { const z = e.target.closest && e.target.closest('#drop'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('#drop'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => { const z = e.target.closest && e.target.closest('#drop'); if (z) { e.preventDefault(); cargar(e.dataTransfer.files); } });
on('i-limpiar', () => { const d = I.destino; resetImp(); I.destino = d; refrescar(); });
on('i-hoja', (d, el) => { const tb = I.tablas[+d.t]; tb.hoja = +el.value; tb.filas = tb.hojas[tb.hoja].filas; tb.map = null; procesar(); refrescar(); });
on('i-map', (d, el) => { const tb = I.tablas[+d.t]; if (el.value === '') delete tb.map[d.k]; else tb.map[d.k] = +el.value; procesar(); refrescar(); });
on('i-topt', (d, el) => { I.tablas[+d.t].opts[d.k] = el.value; procesar(); if (d.k !== 'margen') refrescar(); else { clearTimeout(on.t2); on.t2 = setTimeout(refrescar, 600); } });
on('i-opt', (d, el) => { I.opts[d.k] = el.value; procesar(); if (d.k !== 'margen') refrescar(); else { clearTimeout(on.t2); on.t2 = setTimeout(refrescar, 600); } });
on('i-fmodo', (d, el) => { I.fotoModo = el.value; procesar(); refrescar(); });
on('i-dest', (d, el) => { I.destino = el.value; procesar(); refrescar(); });
on('i-nombre', (d, el) => { I.nombre = el.value; const b = $('[data-act=i-ok]'); if (b) b.disabled = !(el.value.trim().length >= 2 && listos().some(x => x.existente)); });
on('i-pub', (d, el) => {
  const v = el.type === 'checkbox' ? el.checked : el.value;
  I.pub[d.k] = d.k === 'unico' ? v === '1' : v;
  if (el.tagName === 'SELECT' || el.type === 'checkbox') refrescar();
  else if (d.k === 'margen') { clearTimeout(on.t3); on.t3 = setTimeout(refrescar, 600); }
});
on('i-inc', (d, el) => { (I.ed[d.u] = I.ed[d.u] || {}).incluir = el.checked; procesar(); refrescar(); });
on('i-ed', (d, el) => {
  const e = (I.ed[d.u] = I.ed[d.u] || {});
  if (d.k === 'nombre') e.nombre = el.value; else e.costoArs = el.value === '' ? 0 : Number(el.value);
  if ((e.nombre || '').trim() && e.costoArs > 0 && e.incluir == null) e.incluir = true;
  clearTimeout(on.t4); on.t4 = setTimeout(() => { procesar(); const id = el.dataset.u, k = el.dataset.k, pos = el.selectionStart; refrescar(); const n = document.querySelector(`[data-input=i-ed][data-u="${CSS.escape(id)}"][data-k="${k}"]`); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { } } }, 700);
});
on('i-sinfotos', (d, el) => { I.sinFotos = el.checked; Object.values(I.ed).forEach(e => { delete e.usoFoto; }); procesar(); refrescar(); });
on('i-uso', (d, el) => {
  if (el.value === 'recortar') { I.recorte = { uid: d.u }; refrescar(); return; }
  (I.ed[d.u] = I.ed[d.u] || {}).usoFoto = el.value; procesar(); refrescar();
});
on('i-rec-ok', async () => {
  const R = I.recorte, f = I.fotos.find(x => x.uid === R.uid), img = $('#rec-img');
  if (!f || !img || !R.sel || R.sel.w < 10 || R.sel.h < 10) { I.recorte = null; refrescar(); return; }
  const k = img.naturalWidth / img.clientWidth, c = document.createElement('canvas');
  c.width = Math.round(R.sel.w * k); c.height = Math.round(R.sel.h * k);
  c.getContext('2d').drawImage(img, R.sel.x * k, R.sel.y * k, c.width, c.height, 0, 0, c.width, c.height);
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.92));
  if (blob) { URL.revokeObjectURL(f.url); f.foto = new File([blob], 'recorte-' + f.archivo.replace(/\.[a-z]+$/i, '') + '.jpg', { type: 'image/jpeg' }); f.url = URL.createObjectURL(blob); (I.ed[f.uid] = I.ed[f.uid] || {}).usoFoto = 'usar'; }
  I.recorte = null; procesar(); refrescar();
});
on('i-rec-no', () => { I.recorte = null; refrescar(); });
// arrastrar para marcar el recorte (mouse o dedo)
document.addEventListener('pointerdown', e => {
  const box = e.target.closest && e.target.closest('#rec-box'); if (!box || !I.recorte) return;
  e.preventDefault(); const r0 = box.getBoundingClientRect(), x0 = e.clientX - r0.left, y0 = e.clientY - r0.top;
  const marco = $('#rec-sel');
  const mover = ev => {
    const x1 = Math.max(0, Math.min(r0.width, ev.clientX - r0.left)), y1 = Math.max(0, Math.min(r0.height, ev.clientY - r0.top));
    I.recorte.sel = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
    Object.assign(marco.style, { left: I.recorte.sel.x + 'px', top: I.recorte.sel.y + 'px', width: I.recorte.sel.w + 'px', height: I.recorte.sel.h + 'px', display: 'block' });
    const b = $('[data-act=i-rec-ok]'); if (b) b.disabled = !(I.recorte.sel.w >= 10 && I.recorte.sel.h >= 10);
  };
  const fin = () => { document.removeEventListener('pointermove', mover); document.removeEventListener('pointerup', fin); };
  document.addEventListener('pointermove', mover); document.addEventListener('pointerup', fin);
});
on('i-todos', d => { (I.items || []).forEach(x => { (I.ed[x.uid] = I.ed[x.uid] || {}).incluir = d.v === '1'; }); procesar(); refrescar(); });
on('i-mas', () => { I.mostrar += 200; refrescar(); });

async function subirFotos(items) {      // fotos de productos nuevos (achicadas a 900 px WebP), de a 3
  let hechas = 0;
  items = items.filter(x => x.foto && x.usoFoto === 'usar');
  const cola = items.slice();
  const trabajar = async () => {
    while (cola.length) {
      const x = cola.shift();
      try { const blob = await redimensionar(x.foto instanceof File ? x.foto : new File([x.foto], 'foto.jpg', { type: x.foto.type || 'image/jpeg' })); x.imagen_url = await api.subirFoto(P.t.id, blob, 'imp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)); }
      catch (e) { x.errorFoto = e.message; }
      hechas++; progreso(`Subiendo fotos: ${hechas} de ${items.length}…`);
    }
  };
  await Promise.all([trabajar(), trabajar(), trabajar()]);
}
on('i-ok', async () => {
  const ok = listos(), t = P.t; I.busy = true; I.err = ''; progreso('Guardando…'); refrescar();
  try {
    if (I.destino === 'mis') {
      const nuevos = ok.filter(x => !x.existente), upd = ok.filter(x => x.existente), u = I.pub;
      const DF = diffLista(), ocultar = I.ocultarFaltan ? DF.faltan : [];
      await subirFotos(nuevos);
      const m = Number(u.margen) / 100, mOvr = Math.abs(m - Number(t.margen_1)) > 0.0001 ? m : null;
      const cont = CON_CONTENIDO.includes(u.unidad) && Number(u.contenido) >= 1 ? Math.floor(Number(u.contenido)) : null;
      const filas = nuevos.map(x => ({ tenant_id: t.id, nombre: x.nombre.trim().slice(0, 160), categoria: ((x.categoria && x.categoria !== 'General' ? x.categoria : u.categoria.trim()) || 'General').slice(0, 60), marca: x.marca || null, sku: x.sku || null, descripcion: x.descripcion || null, costo_usd: x.costo_usd, variantes: x.variantes || [], imagen_url: x.imagen_url || null, stock: x.stock != null ? x.stock : (x.agotado ? 0 : null), activo: u.visible && x.activo !== false, emoji: '📦', margen_override: mOvr, unidad: u.unidad, contenido: cont, precio_unico: !!u.unico }));
      const vistos = new Set(); filas.forEach(f => { if (!f.sku) return; const k = clave(f.sku); if (vistos.has(k) || P.prods.some(p => p.sku && clave(p.sku) === k)) f.sku = null; else vistos.add(k); });
      progreso('Guardando productos…');
      if (filas.length) await api.insertarProductos(filas);
      for (let i = 0; i < upd.length; i += 6) await Promise.all(upd.slice(i, i + 6).map(x => { const c = { costo_usd: x.costo_usd }; if (x.stock != null) c.stock = x.stock; else if (x.agotado) c.stock = 0; if (x.imagen_url && !x.existente.imagen_url) c.imagen_url = x.imagen_url; return api.guardarProducto(x.existente.id, c); }));
      for (let i = 0; i < ocultar.length; i += 6) await Promise.all(ocultar.slice(i, i + 6).map(p => api.guardarProducto(p.id, { activo: false })));
      DF.ocultos = ocultar;
      AV.texto = armarAviso(DF, m); AV.resumen = AV.texto ? `${DF.suben.length} subieron, ${DF.bajan.length} bajaron, ${DF.nuevos.length} nuevos${ocultar.length ? ', ' + ocultar.length + ' ocultos' : ''}.` : '';
      const sinFoto = nuevos.filter(x => x.errorFoto).length;
      I.msg = `Listo: ${filas.length} productos nuevos${u.visible ? '' : ' (ocultos, para revisar)'} y ${upd.length} actualizados${ocultar.length ? ' · ' + ocultar.length + ' ocultos' : ''}.${sinFoto ? ' ' + sinFoto + ' fotos no se pudieron subir: agregalas desde cada producto.' : ''}`;
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
    const m = I.msg, dest = I.destino, abierto = P.modal && P.modal.tipo === 'imp'; resetImp(); I.msg = m; I.destino = dest; if (abierto) P.modal = { tipo: 'imp' };   // si lo cerró mientras guardaba, no lo reabrimos
    toast(m);
  } catch (e) { I.err = e.message; }
  I.busy = false; refrescar();
});
