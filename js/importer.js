// Importador universal. Todo corre en el navegador del comerciante (sus listas no pasan por ningún servidor).
// Entradas: texto pegado, chat de WhatsApp (.txt/.zip), mensajes de grupo, CSV/TSV (Tiendanube, Empretienda, Shopify, WooCommerce, otros),
// planillas (.xlsx/.xls/.ods), PDF (con texto) e imágenes (OCR). Salida: productos en borrador para revisar antes de guardar.

/* ---------- números argentinos: 3.500 / 3500 / 3.500,50 / 7,5 / 1,234.50 ---------- */
export const num = t => {
  let s = String(t == null ? '' : t).trim().replace(/[^\d.,-]/g, '');
  if (!s) return NaN;
  const p = s.includes('.'), c = s.includes(',');
  if (p && c) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (c) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (p && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return parseFloat(s);
};
const sinAcentos = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const clave = s => sinAcentos(s).replace(/[^a-z0-9]+/g, ' ').trim();
const EMOJI = /[\p{Extended_Pictographic}\u200d\ufe0f\u20e3]/gu;

/* ---------- 1) TEXTO LIBRE (lista pegada, WhatsApp, mensajes de grupo) ---------- */
// Quita encabezados de WhatsApp: "[12/3/24, 10:15:02] Proveedor: " o "12/3/24 10:15 - Proveedor: "
export function limpiarChat(texto) {
  const rx = /^\s*\[?\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4},?\s+\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*(?:[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?([^:]{1,60}):\s?/i;
  const sis = /(cifrad|mensaje eliminado|eliminaste este mensaje|multimedia omitido|imagen omitida|image omitted|media omitted|sticker omitido|se unió|se uni[oó] usando|salió|cambió el asunto|creó el grupo|añadió|te añadió|<adjunto|\.(jpg|jpeg|png|webp|pdf|opus)\b.*\(archivo adjunto\))/i;
  return String(texto || '').split(/\r?\n/).map(l => {
    const m = l.match(rx); if (m) { l = l.slice(m[0].length); }
    else if (/^\s*\[?\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4},?\s+\d{1,2}[:.]\d{2}/.test(l)) return '';  // línea de sistema sin remitente
    return sis.test(l) ? '' : l;
  }).join('\n');
}
const pareceChat = t => (String(t).match(/^\s*\[?\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4},?\s+\d{1,2}[:.]\d{2}/gm) || []).length >= 1;

const MON = /(?:USD|U\$S|US\$|u\$d|dolares?|dólares?)/i, ARS = /(?:ARS|AR\$|pesos?)/i;
function extraerPrecio(txt, cot) {
  let m;
  if ((m = txt.match(new RegExp(MON.source + '\\s*([\\d.,]+)', 'i')))) return { usd: num(m[1]), tok: m[0] };
  if ((m = txt.match(new RegExp('([\\d.,]+)\\s*' + MON.source, 'i')))) return { usd: num(m[1]), tok: m[0] };
  if ((m = txt.match(new RegExp('(?:\\$|' + ARS.source + ')\\s*([\\d.,]+)', 'i')))) {
    const v = num(m[1]);
    // "$ 7,5" con dólar a $1000: ningún producto cuesta 7 pesos → casi seguro son dólares (se avisa en la vista previa)
    if (/^\s*\$/.test(m[0]) && v < cot / 20) return { usd: v, tok: m[0], inferido: true };
    return { usd: Math.round(v / cot * 100) / 100, tok: m[0], ars: v };
  }
  if ((m = txt.match(new RegExp('([\\d.,]+)\\s*' + ARS.source, 'i')))) return { usd: Math.round(num(m[1]) / cot * 100) / 100, tok: m[0], ars: num(m[1]) };
  return null;
}
export function parsearLista(texto, cotizacion, categoriaDefecto = 'General', sinSimbolo = 'usd') {
  const cot = Number(cotizacion) > 0 ? Number(cotizacion) : 1;
  let t = String(texto || '');
  if (pareceChat(t)) t = limpiarChat(t);
  t = t.replace(/💲/g, ' ');
  const bare = n => sinSimbolo === 'ars' ? Math.round(n / cot * 100) / 100 : n;
  const out = []; let cat = categoriaDefecto, huerfano = null;
  for (let raw of t.split(/\r?\n/)) {
    let l = raw.replace(EMOJI, ' ').replace(/[*_~`]+/g, '').replace(/\s+/g, ' ').trim();
    if (!l) { huerfano = null; continue; }
    if (/^(nombre|name|producto|art[ií]culo|descripci[oó]n)\b[,;\t ]/i.test(l) && /precio|price|costo|usd|ars|valor/i.test(l) && !/\d/.test(l)) continue;
    const agotado = /AGOTAD[OA]|SIN STOCK|NO HAY STOCK|SIN EXISTENCIA/i.test(l);
    l = l.replace(/AGOTAD[OA]|SIN STOCK|NO HAY STOCK|SIN EXISTENCIA/ig, '').replace(/^precio\s*[:\-]?\s*/i, '').trim();
    let nombre = l, c = cat, p = null;
    const partes = l.split(/[;\t]/).map(x => x.trim());
    if (partes.length >= 2) { nombre = partes[0]; p = extraerPrecio(partes[1], cot) || (/^\s*[\d.,]+\s*$/.test(partes[1]) ? { usd: bare(num(partes[1])) } : null); if (partes[2]) c = partes[2]; }
    else {
      p = extraerPrecio(l, cot);
      if (p) nombre = l.replace(p.tok, ' ');
      else {
        const m = l.match(/^(.*\D)[\s,:\-–]+([\d][\d.,]*)\s*$/);   // "Nombre - 7,5"  (número suelto = USD)
        if (m && !/^\d+$/.test(m[1]) && num(m[2]) > 0 && num(m[2]) < 10000000) { nombre = m[1]; p = { usd: bare(num(m[2])) }; }
      }
    }
    nombre = nombre.replace(/^[-–•*>\s\d.)]{0,4}(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/, '').replace(/[-–:;|,]+\s*$/, '').replace(/\s{2,}/g, ' ').trim();
    if (!p && nombre) {
      // línea sin precio: ¿encabezado de categoría (corto, en mayúsculas) o nombre cuyo precio viene en la línea siguiente?
      if (/^[A-ZÁÉÍÓÚÑ0-9 &/.-]{3,40}:?$/.test(nombre) && nombre === nombre.toUpperCase() && !agotado) { cat = nombre.replace(/:$/, '').trim().toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); huerfano = null; continue; }
      huerfano = { nombre, c, agotado }; continue;
    }
    if (!p && !nombre) continue;
    if (p && !nombre && huerfano) { nombre = huerfano.nombre; c = huerfano.c; }
    huerfano = null;
    if (nombre) out.push({ nombre: nombre.slice(0, 160), categoria: (c || 'General').slice(0, 60), costo_usd: p && p.usd > 0 ? p.usd : null, precio_ars: p && p.usd > 0 ? (p.ars || Math.round(p.usd * cot)) : null, agotado, inferido: !!(p && p.inferido) });
  }
  return out;
}

/* ---------- 2) TABLAS (CSV / planillas) ---------- */
export function parsearCSV(texto) {
  let s = String(texto || '').replace(/^\ufeff/, '');
  const prim = s.split(/\r?\n/).slice(0, 5).join('\n');
  const cuenta = ch => (prim.match(new RegExp(ch === '\t' ? '\\t' : '\\' + ch, 'g')) || []).length;
  const sep = [';', '\t', ','].map(c => [c, cuenta(c)]).sort((a, b) => b[1] - a[1])[0];
  const d = sep[1] > 0 ? sep[0] : ',';
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === d) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}

// Sinónimos de encabezados (Tiendanube, Empretienda, Shopify, WooCommerce, Excel de proveedores…)
const SIN = {
  handle: ['handle', 'identificador de url', 'url', 'slug', 'id de producto', 'id'],
  nombre: ['title', 'nombre', 'nombre del producto', 'producto', 'articulo', 'artículo', 'descripcion corta', 'detalle', 'item', 'denominacion', 'name'],
  precio: ['variant price', 'precio', 'precio de venta', 'precio venta', 'precio normal', 'precio publico', 'precio público', 'price', 'pvp', 'precio lista', 'precio unitario', 'lista', 'regular price'],
  costo: ['cost per item', 'costo', 'precio costo', 'precio de costo', 'costo usd', 'precio mayorista', 'mayorista', 'precio x mayor', 'cost', 'costo unitario', 'precio compra'],
  promo: ['precio promocional', 'precio rebajado', 'compare at price', 'variant compare at price', 'sale price'],
  categoria: ['type', 'product category', 'categoria', 'categoría', 'categorias', 'categorías', 'rubro', 'familia', 'linea', 'línea', 'category', 'categories'],
  marca: ['vendor', 'marca', 'brand', 'fabricante'],
  sku: ['variant sku', 'sku', 'codigo', 'código', 'cod', 'cod.', 'codigo de producto', 'código de producto', 'ref', 'referencia', 'codigo interno'],
  stock: ['variant inventory qty', 'stock', 'existencias', 'cantidad', 'inventario', 'qty', 'disponible', 'stock disponible'],
  imagen: ['image src', 'imagen', 'imagenes', 'imágenes', 'foto', 'image', 'images', 'url imagen', 'url de imagen', 'image url'],
  descripcion: ['body (html)', 'descripcion', 'descripción', 'description', 'short description'],
  visible: ['mostrar en tienda', 'visible', 'published', 'publicado', 'activo', 'estado'],
  opcion1: ['option1 value', 'valor de propiedad 1', 'variante', 'variantes', 'talle', 'color', 'opcion 1', 'attribute 1 value(s)', 'valor del atributo 1'],
};
const SINC = Object.fromEntries(Object.entries(SIN).map(([k, v]) => [k, v.map(clave)]));
export const CAMPOS = [['nombre', 'Nombre'], ['precio', 'Precio'], ['costo', 'Costo'], ['categoria', 'Categoría'], ['marca', 'Marca'], ['sku', 'Código / SKU'], ['stock', 'Stock'], ['imagen', 'Imagen (URL)'], ['descripcion', 'Descripción'], ['opcion1', 'Variante']];

export function plataforma(h) {
  const k = new Set(h.map(clave));
  if (k.has('handle') && (k.has('variant price') || k.has('title'))) return 'Shopify';
  if (k.has('identificador de url') || k.has('valor de propiedad 1')) return 'Tiendanube';
  if (k.has('precio rebajado') || k.has('precio normal') || k.has('existencias')) return 'WooCommerce';
  if (k.has('nombre') && (k.has('precio') || k.has('precio de venta'))) return 'Empretienda / planilla';
  return 'Planilla';
}
// Detecta la fila de encabezados (la primera con al menos 2 columnas reconocidas) y mapea columnas → campos.
export function detectarTabla(filas) {
  let hi = 0, mejor = -1;
  for (let i = 0; i < Math.min(filas.length, 12); i++) {
    const c = new Set(filas[i].map(clave)); let n = 0;
    for (const f in SINC) if (SINC[f].some(s => c.has(s))) n++;
    if (n > mejor) { mejor = n; hi = i; }
  }
  const head = (filas[hi] || []).map(x => String(x == null ? '' : x).trim());
  const map = {}, usado = new Set();
  const orden = ['handle', 'nombre', 'costo', 'precio', 'promo', 'categoria', 'marca', 'sku', 'stock', 'imagen', 'descripcion', 'visible', 'opcion1'];
  for (const f of orden) {
    for (const s of SINC[f]) { const i = head.findIndex((h2, ix) => !usado.has(ix) && clave(h2) === s); if (i >= 0) { map[f] = i; usado.add(i); break; } }
  }
  return { head, map, datos: filas.slice(hi + 1), plataforma: plataforma(head), reconocido: mejor >= 2 && map.nombre != null };
}
// opts: {moneda:'usd'|'ars', tipo:'costo'|'venta', cot, margen, categoriaDefecto}
export function tablaAProductos(t, map, opts = {}) {
  const cot = Number(opts.cot) > 0 ? Number(opts.cot) : 1, mg = Number(opts.margen) >= 0 ? Number(opts.margen) : 0;
  const get = (r, f) => (map[f] != null && map[f] !== '' && r[map[f]] != null) ? String(r[map[f]]).trim() : '';
  const out = [], porHandle = new Map(); let ultimo = null;
  for (const r of t.datos) {
    const h = get(r, 'handle'), nom = get(r, 'nombre');
    let it;
    if (nom) {
      it = { nombre: nom.slice(0, 160), categoria: (get(r, 'categoria').split(/[>,;]/).pop().trim() || opts.categoriaDefecto || 'General').slice(0, 60), marca: get(r, 'marca').slice(0, 60) || null, sku: get(r, 'sku').slice(0, 60) || null, descripcion: get(r, 'descripcion').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000) || null, imagen_url: null, variantes: [], stock: null, agotado: false, costo_usd: null, precio_ars: null, _p: [], _a: [] };
      const img = get(r, 'imagen').split(/[,\s|]+/).find(u => /^https:\/\//.test(u)); if (img) it.imagen_url = img;
      if (h) porHandle.set(h, it);
      out.push(it); ultimo = it;
    } else if (h && porHandle.has(h)) it = porHandle.get(h);   // fila extra de variante (Shopify / Tiendanube)
    else continue;
    const v = get(r, 'opcion1'); if (v && !/^(default title|titulo por defecto|-)$/i.test(v) && !it.variantes.includes(v) && it.variantes.length < 20) it.variantes.push(v.slice(0, 40));
    const st = get(r, 'stock'); if (st !== '' && !isNaN(num(st))) { it.stock = (it.stock || 0) + Math.max(0, Math.floor(num(st))); }
    const vis = get(r, 'visible'); if (vis && /^(no|false|0|oculto|inactivo|borrador|draft)$/i.test(vis)) it.activo = false;
    // precio: preferimos "costo" si existe; si no, "precio" (y si es de venta, se descuenta el margen)
    const rc = get(r, 'costo'), rp = get(r, 'precio');
    let base = rc !== '' ? num(rc) : num(rp), esVenta = rc === '' && opts.tipo === 'venta';
    if (!(base > 0)) continue;
    let usd = opts.moneda === 'ars' ? base / cot : base;
    if (esVenta) usd = usd / (1 + mg);
    it._p.push(Math.round(usd * 10000) / 10000); it._a.push(opts.moneda === 'ars' ? base : Math.round(base * cot));
  }
  for (const it of out) { it.costo_usd = it._p.length ? Math.min(...it._p) : null; it.precio_ars = it._a.length ? Math.min(...it._a) : null; delete it._p; delete it._a; if (it.stock === 0) it.agotado = true; }
  return out;
}

/* ---------- 3) ARCHIVOS ---------- */
const cargarScript = (src, glob) => new Promise((res, rej) => {
  if (window[glob]) return res(window[glob]);
  const s = document.createElement('script'); s.src = src; s.onload = () => window[glob] ? res(window[glob]) : rej(new Error('No se pudo cargar ' + glob)); s.onerror = () => rej(new Error('No se pudo descargar el lector de archivos. Revisá tu conexión.')); document.head.appendChild(s);
});
const LIB = {
  xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  pdf: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  pdfWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  ocr: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  zip: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
};
const leerTexto = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('No se pudo leer el archivo.')); r.readAsText(f); });
const leerBuf = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('No se pudo leer el archivo.')); r.readAsArrayBuffer(f); });

// Devuelve {tipo:'texto', texto} o {tipo:'tabla', filas, hojas?}
export async function leerArchivo(f, progreso = () => { }) {
  const n = (f.name || '').toLowerCase();
  if (f.size > 25 * 1024 * 1024) throw new Error('El archivo supera los 25 MB. Dividilo en partes.');
  if (/\.(csv|tsv)$/.test(n)) return { tipo: 'tabla', filas: parsearCSV(await leerTexto(f)) };
  if (/\.(txt|text|md)$/.test(n) || f.type === 'text/plain') {
    const t = await leerTexto(f);
    // un .txt con muchas columnas separadas por ; o tab suele ser una planilla exportada
    const l1 = t.split(/\r?\n/).slice(0, 3);
    if (!pareceChat(t) && l1.length > 1 && l1.every(x => (x.match(/[;\t]/g) || []).length >= 2) && detectarTabla(parsearCSV(t)).reconocido) return { tipo: 'tabla', filas: parsearCSV(t) };
    return { tipo: 'texto', texto: t };
  }
  if (/\.(xlsx|xlsm|xls|ods)$/.test(n)) {
    progreso('Leyendo planilla…'); const X = await cargarScript(LIB.xlsx, 'XLSX'); const wb = X.read(await leerBuf(f), { type: 'array' });
    const hojas = wb.SheetNames.map(nm => ({ nombre: nm, filas: X.utils.sheet_to_json(wb.Sheets[nm], { header: 1, raw: false, defval: '' }) })).filter(h => h.filas.length > 1);
    if (!hojas.length) throw new Error('La planilla está vacía.');
    return { tipo: 'tabla', filas: hojas[0].filas, hojas };
  }
  if (/\.pdf$/.test(n)) {
    progreso('Leyendo PDF…'); const P = await cargarScript(LIB.pdf, 'pdfjsLib'); P.GlobalWorkerOptions.workerSrc = LIB.pdfWorker;
    const doc = await P.getDocument({ data: await leerBuf(f) }).promise; let txt = '';
    for (let i = 1; i <= Math.min(doc.numPages, 300); i++) {
      progreso(`PDF: página ${i} de ${doc.numPages}`);
      const c = await (await doc.getPage(i)).getTextContent(); const lin = new Map();
      for (const it of c.items) { const y = Math.round(it.transform[5] / 3); (lin.get(y) || lin.set(y, []).get(y)).push([it.transform[4], it.str]); }
      [...lin.entries()].sort((a, b) => b[0] - a[0]).forEach(([, p]) => { txt += p.sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' ').trim() + '\n'; });
    }
    if (txt.replace(/\s/g, '').length < 30) throw new Error('Este PDF no tiene texto seleccionable (parece escaneado). Subí una foto/captura para leerlo con OCR.');
    return { tipo: 'texto', texto: txt };
  }
  if (/\.zip$/.test(n)) {   // exportación de WhatsApp "con archivos": buscamos el chat de texto
    progreso('Abriendo ZIP…'); const Z = await cargarScript(LIB.zip, 'JSZip'); const z = await Z.loadAsync(await leerBuf(f));
    const e = Object.values(z.files).find(x => !x.dir && /\.txt$/i.test(x.name)); if (!e) throw new Error('No encontramos un chat (.txt) dentro del ZIP.');
    return { tipo: 'texto', texto: await e.async('string') };
  }
  if (/^image\//.test(f.type) || /\.(png|jpe?g|webp|bmp)$/.test(n)) {
    progreso('Leyendo imagen (OCR)… puede tardar un minuto'); const T = await cargarScript(LIB.ocr, 'Tesseract');
    const r = await T.recognize(f, 'spa', { logger: m => { if (m.status === 'recognizing text') progreso('OCR: ' + Math.round(m.progress * 100) + '%'); } });
    return { tipo: 'texto', texto: r.data.text, ocr: true };
  }
  throw new Error('Formato no reconocido. Usá CSV, Excel, PDF, TXT/ZIP de WhatsApp o una imagen.');
}

/* ---------- 4) Unir con lo que ya existe (actualizar precios de la lista del proveedor) ---------- */
export function cruzar(nuevos, existentes) {
  const porSku = new Map(), porNombre = new Map();
  existentes.forEach(p => { if (p.sku) porSku.set(clave(p.sku), p); porNombre.set(clave(p.nombre), p); });
  const vistos = new Set(), nombres = new Set();
  return nuevos.filter(n => {
    const kn = clave(n.nombre), k = kn + '|' + clave(n.sku || '');
    if (vistos.has(k) || (!n.sku && nombres.has(kn))) return false;
    vistos.add(k); nombres.add(kn); return true;
  })
    .map(n => ({ ...n, existente: (n.sku && porSku.get(clave(n.sku))) || porNombre.get(clave(n.nombre)) || null }));
}
