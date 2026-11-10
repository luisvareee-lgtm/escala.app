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
    const hayCosto = rc !== '' && num(rc) > 0;                    // Tiendanube/Shopify exportan costo 0 cuando no lo cargaste
    let base = hayCosto ? num(rc) : num(rp), esVenta = !hayCosto && opts.tipo === 'venta';
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
const leerBuf = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('No se pudo leer el archivo.')); r.readAsArrayBuffer(f); });
// Texto con la codificación correcta: UTF-8 si es válido; si no, Windows-1252 (Excel / Tiendanube en Windows). Sin esto, "Café" llega como "CafÃ©".
export const decodificar = buf => { const b = new Uint8Array(buf); try { return new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^\ufeff/, ''); } catch (e) { return new TextDecoder('windows-1252').decode(b); } };
const leerTexto = async f => decodificar(await leerBuf(f));

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
    const texto = decodificar(await e.async('arraybuffer'));
    const fotos = {};
    for (const x of Object.values(z.files)) if (!x.dir && /\.(jpe?g|png|webp)$/i.test(x.name)) fotos[x.name.split('/').pop()] = x;
    if (Object.keys(fotos).length) {
      progreso('Uniendo cada foto con su texto…');
      const items = parsearChatConFotos(texto, Object.keys(fotos));
      for (const it of items) if (it.archivoFoto) { const b = await fotos[it.archivoFoto].async('blob'); it.foto = new Blob([b], { type: /png$/i.test(it.archivoFoto) ? 'image/png' : 'image/jpeg' }); }
      if (items.some(x => x.foto)) return { tipo: 'productos', items, texto };
    }
    return { tipo: 'texto', texto };
  }
  if (/^image\//.test(f.type) || /\.(png|jpe?g|webp|bmp)$/.test(n)) {
    const texto = await ocr(f, progreso);
    return { tipo: 'imagen', texto, foto: f, ocr: true };
  }
  throw new Error('Formato no reconocido. Usá CSV, Excel, PDF, TXT/ZIP de WhatsApp o una imagen.');
}

/* ---------- 4) Unir con lo que ya existe (actualizar precios de la lista del proveedor) ---------- */
// Coincidencia aproximada: mismo producto escrito distinto ("Perfume Asad 100ml EDP" ≈ "ASAD EDP 100 ML perfume").
// Exige los mismos números (tamaños, modelos) y casi las mismas palabras; se marca "aprox" para que el comerciante lo confirme.
const RELLENO = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'y', 'x', 'un', 'una', 'u', 'unid', 'unidad', 'unidades', 'original', 'nuevo', 'nueva', 'oferta', 'promo']);
export function firma(nombre) {
  const t = clave(nombre).replace(/(\d)\s*(ml|gr|g|kg|cm|mm|mts?|m|lts?|l|cc|oz|w|v|gb|mg)\b/g, '$1$2').split(' ').filter(w => w && !RELLENO.has(w));
  return { pal: new Set(t.filter(w => !/\d/.test(w)).map(w => w.length > 4 ? w.replace(/(es|s)$/, '') : w)), num: new Set(t.filter(w => /\d/.test(w))) };
}
export function parecido(a, b) {
  if (a.num.size !== b.num.size || [...a.num].some(n => !b.num.has(n))) return 0;
  if (a.pal.size < 2 || b.pal.size < 2) return 0;
  let c = 0; a.pal.forEach(w => { if (b.pal.has(w)) c++; });
  return c / (a.pal.size + b.pal.size - c);
}
export function cruzar(nuevos, existentes, rechazados = new Set()) {
  const porSku = new Map(), porNombre = new Map();
  existentes.forEach(p => { if (p.sku) porSku.set(clave(p.sku), p); porNombre.set(clave(p.nombre), p); });
  const firmas = existentes.map(p => ({ p, f: firma(p.nombre) })), indice = new Map();
  firmas.forEach(x => x.f.pal.forEach(w => (indice.get(w) || indice.set(w, []).get(w)).push(x)));
  const aprox = n => {
    const f = firma(n.nombre), cands = new Set(); f.pal.forEach(w => (indice.get(w) || []).forEach(x => cands.add(x)));
    let mejor = null, ms = 0; cands.forEach(x => { const sc = parecido(f, x.f); if (sc > ms) { ms = sc; mejor = x.p; } });
    return ms >= 0.7 ? { p: mejor, igual: ms > 0.999 } : null;
  };
  const vistos = new Set(), nombres = new Set();
  const out = nuevos.filter(n => {
    const kn = clave(n.nombre), k = kn + '|' + clave(n.sku || '');
    if (vistos.has(k) || (!n.sku && nombres.has(kn))) return false;
    vistos.add(k); nombres.add(kn); return true;
  })
    .map(n => {
      const exacto = (n.sku && porSku.get(clave(n.sku))) || porNombre.get(clave(n.nombre)) || null;
      if (exacto) return { ...n, existente: exacto };
      const a = !rechazados.has(n.uid) && (n.nombre || '').trim() ? aprox(n) : null;
      // aprox: mismas palabras en otro orden (se toma como el mismo) · duda: muy parecido (el comerciante decide)
      return a ? { ...n, existente: a.p, aprox: true, duda: !a.igual } : { ...n, existente: null };
    });
  // un producto existente lo actualiza una sola fila: gana la coincidencia exacta; el resto queda como nuevo
  const exactos = new Set(out.filter(x => x.existente && !x.aprox).map(x => x.existente.id)), usados = new Set();
  out.forEach(x => { if (!x.existente || !x.aprox) return; const id = x.existente.id; if (exactos.has(id) || usados.has(id)) { x.existente = null; x.aprox = false; x.duda = false; } else usados.add(id); });
  return out;
}


/* ---------- 5) OCR (lectura de texto en imágenes) ---------- */
let _ocrWorker = null;
export async function ocr(f, progreso = () => { }) {
  const T = await cargarScript(LIB.ocr, 'Tesseract');
  progreso('Leyendo el texto de la imagen… (la primera vez tarda un poco más)');
  if (!_ocrWorker) _ocrWorker = await T.createWorker('spa');          // un solo lector para todas las fotos: mucho más rápido
  const r = await _ocrWorker.recognize(f);
  return r.data.text || '';
}

/* ---------- 6) FOTO DE PROVEEDOR = UN PRODUCTO ---------- */
// Las fotos de canales y grupos de distribuidores traen el precio (y a veces el nombre) escritos encima.
// Ese precio es el COSTO del comerciante (lo que le cobra el proveedor), no un precio de venta.
const NO_NOMBRE = /^(precio|precios|stock|disponible|consult|whats|wsp|envio|envíos|mayorista|minorista|oferta|promo|nuevo|ingreso|unidad|unidades|x\s?\d+|cod|código|ref)\b/i;
export function deTextoDeFoto(texto, cotizacion, sinSimbolo = 'ars') {
  const cot = Number(cotizacion) > 0 ? Number(cotizacion) : 1;
  // en capturas de pantalla aparecen textos de la app (seguidores, hora, "Reenviado"…): se descartan para no confundirlos con el precio
  const UI = /seguidor|followers|vistas|views|reenviad|forwarded|reacci|miembros|members|escribiendo|en l[ií]nea|online|[uú]lt\.? vez|visto por|canal|channel|silenciad|@\w|^\s*\d{1,2}[:.]\d{2}\s*(?:[ap]\.?\s?m\.?)?\s*$|\b\d{1,2}:\d{2}\b|%|\bwhatsapp\b/i;
  const lineas = String(texto || '').split(/\r?\n/).map(l => l.replace(EMOJI, ' ').replace(/[|_~*`©®™•·]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(l => l.length >= 2 && !UI.test(l));
  // precio: primero con símbolo ($ / USD); si no, el número "de precio" más grande (≥ 3 cifras)
  let precio = null;
  for (const l of lineas) { const p = extraerPrecio(l, cot); if (p && p.usd > 0) { precio = p; break; } }
  if (!precio) {
    const nums = lineas.join(' ').match(/\b\d{1,3}(?:[.,]\d{3})+(?:,\d{1,2})?\b|\b\d{3,7}\b/g) || [];
    const vals = nums.map(num).filter(v => v >= 100 && v < 100000000 && !(v >= 1900 && v <= 2100));
    if (vals.length) { const v = Math.max(...vals); precio = sinSimbolo === 'usd' ? { usd: v } : { usd: Math.round(v / cot * 100) / 100, ars: v }; precio.inferido = true; }
  }
  // nombre: la línea con más letras que no sea un precio ni una palabra de relleno
  const cands = lineas.filter(l => !extraerPrecio(l, cot) && !NO_NOMBRE.test(l) && (l.match(/[a-záéíóúñ]/gi) || []).length >= 4 && !/^[\d\W]+$/.test(l))
    .map(l => l.replace(/[^\p{L}\p{N} .,'&/+()-]/gu, ' ').replace(/\s+/g, ' ').trim()).filter(l => l.length >= 3);
  cands.sort((a, b) => (b.match(/[a-záéíóúñ]/gi) || []).length - (a.match(/[a-záéíóúñ]/gi) || []).length);
  const nombre = (cands[0] || '').slice(0, 120);
  return { nombre, costo_usd: precio ? precio.usd : null, precio_ars: precio ? (precio.ars || Math.round(precio.usd * cot)) : null, inferido: !!(precio && precio.inferido) };
}
// Nombre a partir del archivo cuando la foto no tiene texto: "Perfume Asad 100ml.jpg" → "Perfume Asad 100ml"
export const nombreDeArchivo = n => {
  const b = String(n || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  return /^(img|image|imagen|photo|foto|whatsapp|wa|screenshot|captura|\d+|pxl|dsc)\b/i.test(b) || /\b(wa\d{3,}|\d{8})\b/i.test(b) ? '' : b.slice(0, 120);
};

/* ---------- 7) CHAT DE WHATSAPP CON FOTOS: cada foto + su texto = un producto ---------- */
const CAB = /^\s*\[?(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4}),?\s+(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*(?:[ap]\.?\s?m\.?)?\]?\s*(?:-\s*)?([^:]{1,60}):\s?(.*)$/i;
const ADJ = /(?:<\s*(?:adjunto|attached)\s*:\s*([^>]+?)\s*>|([\w-]+\.(?:jpe?g|png|webp))\s*\((?:archivo adjunto|file attached)\))/i;
export function parsearChatConFotos(texto, nombresFotos = []) {
  const set = new Set(nombresFotos);
  const msgs = [];
  for (const l0 of String(texto || '').split(/\r?\n/)) {
    const l = l0.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '');      // marcas invisibles que agrega WhatsApp en iPhone
    const m = l.match(CAB);
    if (m) msgs.push({ quien: m[6].trim(), t: (+m[4]) * 60 + (+m[5]), dia: m[1] + '/' + m[2], texto: m[7] });
    else if (msgs.length) msgs[msgs.length - 1].texto += '\n' + l;
  }
  const out = [];
  for (let i = 0; i < msgs.length; i++) {
    const g = msgs[i], a = g.texto.match(ADJ);
    if (!a) continue;
    const archivo = (a[1] || a[2] || '').trim();
    if (!/\.(jpe?g|png|webp)$/i.test(archivo)) continue;
    let leyenda = g.texto.replace(ADJ, ' ').replace(/\s+/g, ' ').trim();
    // si la foto vino sola, el texto suele llegar en el mensaje siguiente del mismo remitente (dentro de 3 minutos)
    const sig = msgs[i + 1];
    if (!leyenda && sig && sig.quien === g.quien && sig.dia === g.dia && Math.abs(sig.t - g.t) <= 3 && !ADJ.test(sig.texto)) { leyenda = sig.texto.trim(); sig.usado = true; }
    out.push({ archivoFoto: set.has(archivo) ? archivo : null, leyenda, fuente: 'whatsapp' });
  }
  return out;
}
