// Pantalla del importador (v2.5): varios archivos a la vez (CSV, Excel, PDF, chat de WhatsApp con fotos, fotos de proveedores),
// texto pegado, revisión producto por producto y cómo publicar (margen, unidad de venta, precio único o con escala, visible).
import { api } from './api.js';
import { $, esc, fmt, on, toast } from './util.js';
import { P, can } from './state.js';
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
  ed: {}, items: null, mostrar: 60,
  destino: 'mis', nombre: '', msg: '', err: '', busy: false,
});
const I = nuevoEstado();
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
    out.push(ajuste({ ...d, uid: f.uid, foto: f.foto, fotoUrl: f.url, categoria: 'General', variantes: [], fuente: f.fuente || 'foto', revisar: true }));
  });
  // ediciones hechas a mano en la revisión
  out.forEach(it => {
    const e = I.ed[it.uid]; if (!e) return;
    if (e.nombre != null) it.nombre = e.nombre;
    if (e.costoArs != null) { it.precio_ars = e.costoArs; it.costo_usd = e.costoArs > 0 ? Math.round(e.costoArs / c * 10000) / 10000 : null; it.inferido = false; }
  });
  let items = cruzar(out.filter(x => (x.nombre || '').trim() || x.foto), P.prods);
  const ult = new Map(); items.forEach((x, i) => { if (x.existente) ult.set(x.existente.id, i); });
  items = items.filter((x, i) => !x.existente || ult.get(x.existente.id) === i);
  items.forEach(x => { const e = I.ed[x.uid]; x.incluir = e && e.incluir != null ? e.incluir : x.costo_usd > 0 && !!(x.nombre || '').trim(); });
  I.items = items.length ? items : null;
}
const listos = () => (I.items || []).filter(x => x.incluir && x.costo_usd > 0 && (x.nombre || '').trim());
const pv = costoUsd => Math.ceil(Number(costoUsd) * cot() * (1 + Number(I.pub.margen) / 100) / 10) * 10;
const etiquetaUnidad = (u, n) => { const b = (UNIDADES.find(x => x[0] === u) || ['', 'Unidad'])[1]; return CON_CONTENIDO.includes(u) && n ? `${b} x${n}` : b; };

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
    <p class="hint">Lo leído de una foto puede tener errores: los marcamos con 🔎 para que los revises.</p></div>`;
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
  const e = x.existente, estado = !(x.costo_usd > 0) ? '<span class="tag bad">falta el costo</span>' : I.destino !== 'mis' ? (e ? `<span class="tag ok">→ ${esc(e.nombre)}</span>` : '<span class="tag">no está en tu catálogo</span>') : e ? `<span class="tag warn">actualiza${e.costo_usd != null && Math.abs(Number(e.costo_usd) - x.costo_usd) > 0.001 ? ' costo' : ''}</span>` : '<span class="tag ok">nuevo</span>';
  const costoArs = x.costo_usd > 0 ? Math.round(x.costo_usd * cot()) : '';
  return `<tr class="${x.incluir ? '' : 'off'}"><td><input type="checkbox" aria-label="Incluir" data-change="i-inc" data-u="${esc(x.uid)}" ${x.incluir ? 'checked' : ''}></td>
    <td>${x.fotoUrl ? `<img class="imp-th" src="${esc(x.fotoUrl)}" alt="">` : x.imagen_url ? `<img class="imp-th" src="${esc(x.imagen_url)}" alt="" loading="lazy">` : ''}</td>
    <td><input class="fi fi-s" maxlength="160" value="${esc(x.nombre || '')}" placeholder="Escribí el nombre" data-input="i-ed" data-u="${esc(x.uid)}" data-k="nombre">${x.revisar ? ' <span title="Leído de una foto: revisalo">🔎</span>' : ''}${x.variantes && x.variantes.length ? '<br><small class="muted">' + esc(x.variantes.join(', ')) + '</small>' : ''}<br><small class="muted">${esc(x.fuente || '')}${x.activo === false ? ' · estaba oculto' : ''}</small></td>
    <td><input class="fi fi-s" type="number" min="0" step="any" value="${costoArs}" placeholder="$" data-input="i-ed" data-u="${esc(x.uid)}" data-k="costo" style="max-width:110px">${x.inferido ? '<br><small class="muted">número sin $: revisalo</small>' : ''}</td>
    ${I.destino === 'mis' ? `<td class="r">${x.costo_usd > 0 ? fmt(pv(x.costo_usd)) : '—'}</td>` : ''}<td>${estado}</td></tr>`;
}
export function vistaImportar() {
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
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal modal-ancho" role="dialog" aria-modal="true"><div class="view-title">📥 Cargar productos</div><div id="mm">${I.err ? `<div class="err-box">${esc(I.err)}</div>` : ''}${I.msg && !I.busy ? `<div class="ok-box">${esc(I.msg)}</div>` : ''}</div>
    <label class="drop" id="drop" for="i-file">📎 <b>Subí uno o varios archivos</b> o arrastralos acá<br><small>Fotos de productos (del canal o grupo del proveedor) · chat de WhatsApp exportado (.zip, con las fotos) · CSV de Tiendanube / Shopify / Empretienda · Excel · PDF · captura de una lista</small>${fuentes.length ? `<br><small><b>Cargados:</b> ${esc(fuentes.slice(0, 6).join(' · '))}${fuentes.length > 6 ? ' y ' + (fuentes.length - 6) + ' más' : ''}</small> <button class="btn-link" data-act="i-limpiar">empezar de nuevo</button>` : ''}</label>
    <input id="i-file" type="file" hidden multiple data-change="i-file" accept=".csv,.tsv,.txt,.zip,.xlsx,.xlsm,.xls,.ods,.pdf,image/*">
    <details class="hint" style="margin:8px 0"><summary>¿Cómo traigo los productos de un canal o grupo de WhatsApp?</summary>
      <p><b>Grupo o chat:</b> en el celular abrí el grupo → ⋮ → Más → <b>Exportar chat</b> → <b>Incluir archivos</b> → guardalo y subí ese .zip acá. Cada foto se une con su texto (nombre y precio).</p>
      <p><b>Canal:</b> WhatsApp no permite exportarlos ni leerlos desde afuera (tampoco con un enlace). Guardá las fotos del canal (mantené apretada la foto → Guardar) y subilas todas juntas: cada foto será un producto y leemos el precio escrito en la imagen.</p></details>
    <textarea class="fi" id="imp-t" rows="3" data-input="i-texto" placeholder="…o pegá el texto de la lista (uno por renglón): Perfume X 100ml $12.500">${esc(I.texto)}</textarea>
    ${I.busy ? `<div class="center" style="margin:10px 0"><span class="spin"></span><div class="hint" id="imp-prog">${esc(I.msg)}</div></div>` : ''}
    ${vistaTablas()}${vistaOpcionesLectura()}${(I.items || I.texto || I.tablas.length || I.fotos.length) ? destino : ''}${vistaPublicar(nuevos.length)}${tabla}
    <button class="btn btn-p" style="margin-top:10px" data-act="i-ok" ${hay && !I.busy ? '' : 'disabled'}>${I.destino === 'mis' ? `Cargar ${ok.length} productos` : 'Cargar ' + upd.length + ' precios'}</button>
    <button class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cerrar</button></div></div>`;
}

/* ---------- eventos ---------- */
const refrescar = () => P.repintar();
const progreso = m => { I.msg = m; const n = $('#imp-prog'); if (n) n.textContent = m; };
on('i-texto', (d, el) => { I.texto = el.value; clearTimeout(on.t); on.t = setTimeout(() => { procesar(); const pos = el.selectionStart; refrescar(); const n = $('#imp-t'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 500); });

async function cargar(lista) {
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
        I.fotos.push({ uid: 'f' + I.fotos.length + '-' + Date.now(), archivo: f.name, foto: f, url: URL.createObjectURL(f), texto, fuente: 'foto ' + f.name });
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
on('i-todos', d => { (I.items || []).forEach(x => { (I.ed[x.uid] = I.ed[x.uid] || {}).incluir = d.v === '1'; }); procesar(); refrescar(); });
on('i-mas', () => { I.mostrar += 200; refrescar(); });

async function subirFotos(items) {      // fotos de productos nuevos (achicadas a 900 px WebP), de a 3
  let hechas = 0;
  const cola = items.filter(x => x.foto);
  const trabajar = async () => {
    while (cola.length) {
      const x = cola.shift();
      try { const blob = await redimensionar(x.foto instanceof File ? x.foto : new File([x.foto], 'foto.jpg', { type: x.foto.type || 'image/jpeg' })); x.imagen_url = await api.subirFoto(P.t.id, blob, 'imp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)); }
      catch (e) { x.errorFoto = e.message; }
      hechas++; progreso(`Subiendo fotos: ${hechas} de ${items.filter(y => y.foto).length}…`);
    }
  };
  await Promise.all([trabajar(), trabajar(), trabajar()]);
}
on('i-ok', async () => {
  const ok = listos(), t = P.t; I.busy = true; I.err = ''; progreso('Guardando…'); refrescar();
  try {
    if (I.destino === 'mis') {
      const nuevos = ok.filter(x => !x.existente), upd = ok.filter(x => x.existente), u = I.pub;
      await subirFotos(nuevos);
      const m = Number(u.margen) / 100, mOvr = Math.abs(m - Number(t.margen_1)) > 0.0001 ? m : null;
      const cont = CON_CONTENIDO.includes(u.unidad) && Number(u.contenido) >= 1 ? Math.floor(Number(u.contenido)) : null;
      const filas = nuevos.map(x => ({ tenant_id: t.id, nombre: x.nombre.trim().slice(0, 160), categoria: ((x.categoria && x.categoria !== 'General' ? x.categoria : u.categoria.trim()) || 'General').slice(0, 60), marca: x.marca || null, sku: x.sku || null, descripcion: x.descripcion || null, costo_usd: x.costo_usd, variantes: x.variantes || [], imagen_url: x.imagen_url || null, stock: x.stock != null ? x.stock : (x.agotado ? 0 : null), activo: u.visible && x.activo !== false, emoji: '📦', margen_override: mOvr, unidad: u.unidad, contenido: cont, precio_unico: !!u.unico }));
      const vistos = new Set(); filas.forEach(f => { if (!f.sku) return; const k = clave(f.sku); if (vistos.has(k) || P.prods.some(p => p.sku && clave(p.sku) === k)) f.sku = null; else vistos.add(k); });
      progreso('Guardando productos…');
      if (filas.length) await api.insertarProductos(filas);
      for (let i = 0; i < upd.length; i += 6) await Promise.all(upd.slice(i, i + 6).map(x => { const c = { costo_usd: x.costo_usd }; if (x.stock != null) c.stock = x.stock; else if (x.agotado) c.stock = 0; if (x.imagen_url && !x.existente.imagen_url) c.imagen_url = x.imagen_url; return api.guardarProducto(x.existente.id, c); }));
      const sinFoto = nuevos.filter(x => x.errorFoto).length;
      I.msg = `Listo: ${filas.length} productos nuevos${u.visible ? '' : ' (ocultos, para revisar)'} y ${upd.length} actualizados.${sinFoto ? ' ' + sinFoto + ' fotos no se pudieron subir: agregalas desde cada producto.' : ''}`;
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
