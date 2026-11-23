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
export const clave = s => sinAcentos(s).replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, ' ').trim();
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

const MON = /(?:USD|U\$S|US\$|U\$|u\$d|dolares?|dólares?)/i, ARS = /(?:ARS|AR\$|pesos?)/i;
// v2.31.1 · otras monedas (reales, yuanes, euros, guaraníes): se pasan a dólares con las tasas del día (/api/cambio).
const OTRAS = [['BRL', /(?:R\$|BRL|reais|reales)/i], ['CNY', /(?:RMB|CNY|¥|yuan(?:es)?)/i], ['EUR', /(?:€|EUR|euros?)/i], ['PYG', /(?:Gs\.?|PYG|guaran[ií]es)/i]];
const TASA_REF = { BRL: 5.5, CNY: 7.2, EUR: 0.92, PYG: 7800 };   // solo si no se pudieron traer las del día (se avisa como "a revisar")
let TASAS = {};
export const usarTasas = t => { TASAS = t && typeof t === 'object' ? t : {}; };
function extraerPrecio(txt, cot) {
  let m;
  for (const [cod, rx] of OTRAS) {   // "R$ 12,50", "¥ 85", "12,50 €": nunca se confunden con pesos ni dólares
    if ((m = txt.match(new RegExp(rx.source + '\\s*([\\d.,]+)', 'i'))) || (m = txt.match(new RegExp('([\\d.,]+)\\s*' + rx.source, 'i')))) {
      const v = num(m[1]), t = Number(TASAS[cod]) > 0 ? Number(TASAS[cod]) : TASA_REF[cod];
      if (v > 0) return { usd: Math.round(v / t * 10000) / 10000, tok: m[0], moneda: cod, inferido: !(Number(TASAS[cod]) > 0) };
    }
  }
  if ((m = txt.match(new RegExp(MON.source + '\\s*([\\d.,]+)', 'i')))) return { usd: num(m[1]), tok: m[0] };
  if ((m = txt.match(new RegExp('([\\d.,]+)\\s*' + MON.source, 'i')))) return { usd: num(m[1]), tok: m[0] };
  if ((m = txt.match(new RegExp('(?:\\$|' + ARS.source + ')\\s*([\\d.,]+)', 'i')))) {
    const v = num(m[1]);
    // "$ 7,5" con dólar a $1000: ningún producto cuesta 7 pesos → casi seguro son dólares (se avisa en la vista previa)
    if (/^\s*\$/.test(m[0]) && v < cot / 20) return { usd: v, tok: m[0], inferido: true };
    return { usd: Math.round(v / cot * 10000) / 10000, tok: m[0], ars: v };
  }
  if ((m = txt.match(new RegExp('([\\d.,]+)\\s*' + ARS.source, 'i')))) return { usd: Math.round(num(m[1]) / cot * 10000) / 10000, tok: m[0], ars: num(m[1]) };
  return null;
}
// v2.31.1 · listas exportadas de sistemas (PDF con marcos |, ═, ─) y moneda escrita una sola vez arriba
const MARCO = /[|│┃║═─━┼┤├┬┴┌┐└┘╔╗╚╝]+/g;
const META = /\b(emiss[aã]o|emisi[oó]n|fecha de emisi|hora:|p[aá]g(ina)?[.:]|loja:|grupo:|sgrupo|forn:|fornecedor:|vendedor:|cliente:|telefone|tel[eé]fono|cuit|cnpj|www\.|https?:)/i;
export function monedaDoc(t) {
  const cab = String(t || '').split(/\r?\n/).slice(0, 60).join(' ');
  if (/(pre[cç]os?|valores|prices?|lista)[^\n]{0,30}\b(em|en|in)\s*(us\$|u\$s|u\$|usd|d[oó]lar)|todos los precios[^\n]{0,30}(d[oó]lares|usd|u\$s)|precios en d[oó]lares|prices in usd|pre[cç]os em d[oó]lar/i.test(cab)) return 'usd';
  if (/(pre[cç]os?|valores|precios?)[^\n]{0,30}\b(em|en)\s*(r\$|reais|reales)/i.test(cab)) return 'brl';
  return null;
}
export function parsearLista(texto, cotizacion, categoriaDefecto = 'General', sinSimbolo = 'usd') {
  const cot = Number(cotizacion) > 0 ? Number(cotizacion) : 1;
  let t = String(texto || '');
  if (pareceChat(t)) t = limpiarChat(t);
  const md = monedaDoc(t); if (md === 'usd') sinSimbolo = 'usd';
  t = t.replace(MARCO, ' ').replace(/\(cid:\d+\)/g, ' ').replace(/^[\s=_\-]{6,}$/gm, '');
  t = t.replace(/💲/g, ' ');
  const bare = n => sinSimbolo === 'ars' ? Math.round(n / cot * 10000) / 10000 : n;   // 4 decimales (como la base): $25.000 sigue siendo $25.000
  const out = []; let cat = categoriaDefecto, huerfano = null;
  for (let raw of t.split(/\r?\n/)) {
    let l = raw.replace(EMOJI, ' ').replace(/[*_~`]+/g, '').replace(/\s+/g, ' ').trim();
    if (!l) { huerfano = null; continue; }
    if (META.test(l) || /^(c[oó]d\.?|codigo|sku)\s+(descri|produ|nombre|art)/i.test(l)) continue;   // encabezados del sistema y de columnas
    if (/^(nombre|name|producto|produto|art[ií]culo|descripci[oó]n|descri[cç][aã]o)\b[,;\t ]/i.test(l) && /precio|price|costo|usd|ars|valor/i.test(l) && !/\d/.test(l)) continue;
    const agotado = /AGOTAD[OA]|SIN STOCK|NO HAY STOCK|SIN EXISTENCIA/i.test(l);
    l = l.replace(/AGOTAD[OA]|SIN STOCK|NO HAY STOCK|SIN EXISTENCIA/ig, '').replace(/^precio\s*[:\-]?\s*/i, '').trim();
    let nombre = l, c = cat, p = null, sku = null, stock = null;
    // código al principio ("12862-9 ALLUVI LABS…", "A-1023 Labial…"): va al código, no al nombre
    const mc = l.match(/^(\d{4,}|\d{2,}[-./]\d+|[A-Z]{1,3}-?\d{3,})\s+(?=\S*[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,})/);
    if (mc && !/^\S+\s+(ml|g|gr|kg|cc|mg|mah|puffs?|w|v|cm|mm|u|un|unid)\b/i.test(l)) { sku = mc[1]; l = l.slice(mc[0].length); nombre = l; }
    const partes = l.split(/[;\t]/).map(x => x.trim());
    if (partes.length >= 2) { nombre = partes[0]; p = extraerPrecio(partes[1], cot) || (/^\s*[\d.,]+\s*$/.test(partes[1]) ? { usd: bare(num(partes[1])) } : null); if (partes[2]) c = partes[2]; }
    else {
      p = extraerPrecio(l, cot);
      if (p) {
        const i = l.indexOf(p.tok); nombre = l.slice(0, i) + ' ' + l.slice(i + p.tok.length);
        // tablas con varias columnas de precio ("$28.000  $25.500" = x1 y llevando 6+): vale la primera y el resto se saca del nombre
        const otros = nombre.match(/(?:US\$|U\$S|R\$|\$)\s*[\d.,]+/gi);
        if (otros) { otros.forEach(o => { nombre = nombre.replace(o, ' '); }); nombre = nombre.replace(/\s+[–\-]\s*$|\s+[–\-FM](?=\s*$)/g, ' '); }
        // "… 100ML  $36,000  0" → el número suelto después del precio es el stock
        if (/^\s+\d{1,5}\s*$/.test(l.slice(i + p.tok.length))) nombre = l.slice(0, i);   // no se toma como stock: muchas listas ponen 0 en todos
      } else {
        const m = l.match(/^(.*\D)[\s,:\-–]+([\d][\d.,]*)\s*$/);   // "Nombre - 7,5"  (número suelto = USD)
        if (m && !/^\d+$/.test(m[1]) && !/[A-Za-z]-\d+\s*$/.test(l) && num(m[2]) > 0 && num(m[2]) < 10000000) { nombre = m[1]; p = { usd: bare(num(m[2])) }; }   // "DL-5249" es un modelo, no un precio
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
    nombre = nombre.replace(/\s*\/\s*$/, '').replace(/\s{2,}/g, ' ').trim();   // listas de sistema cortan el nombre con "/"
    if (nombre) out.push({ ...(sku ? { sku: sku.slice(0, 60) } : {}), ...(stock != null ? { stock } : {}), nombre: nombre.slice(0, 160), categoria: (c || 'General').slice(0, 60), costo_usd: p && p.usd > 0 ? p.usd : null, precio_ars: p && p.usd > 0 ? (p.ars || Math.round(p.usd * cot)) : null, agotado, inferido: !!(p && p.inferido) });
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
  nombre: ['title', 'nombre', 'nombre del producto', 'producto', 'articulo', 'artículo', 'descripcion corta', 'detalle', 'item', 'denominacion', 'name', 'produto', 'nome', 'nome do produto', 'descricao do produto', 'product', 'product name', 'item name', 'item description', 'descricao', '品名', '名称', '产品名称', '商品名称', '产品'],
  precio: ['variant price', 'precio', 'precio de venta', 'precio venta', 'precio normal', 'precio publico', 'precio público', 'price', 'pvp', 'precio lista', 'precio unitario', 'lista', 'regular price', 'preco', 'preco u', 'preco usd', 'valor', 'valor unitario', 'unit price', 'unit price usd', 'price usd', 'fob price', 'precio u', 'precio usd', 'precio u s', '单价', '价格', '售价'],
  costo: ['cost per item', 'costo', 'precio costo', 'precio de costo', 'costo usd', 'precio mayorista', 'mayorista', 'precio x mayor', 'cost', 'costo unitario', 'precio compra', 'custo', 'preco de custo', 'atacado', 'preco atacado', 'cost price', 'wholesale price', '进价', '成本', '批发价'],
  promo: ['precio promocional', 'precio rebajado', 'compare at price', 'variant compare at price', 'sale price'],
  categoria: ['type', 'product category', 'categoria', 'categoría', 'categorias', 'categorías', 'rubro', 'familia', 'linea', 'línea', 'category', 'categories', 'grupo', 'subgrupo', '类别', '分类'],
  marca: ['vendor', 'marca', 'brand', 'fabricante', 'manufacturer', '品牌'],
  sku: ['variant sku', 'sku', 'codigo', 'código', 'cod', 'cod.', 'codigo de producto', 'código de producto', 'ref', 'referencia', 'codigo interno', 'item no', 'item number', 'model no', 'modelo', 'refer', '货号', '编号', '型号'],
  stock: ['variant inventory qty', 'stock', 'existencias', 'cantidad', 'inventario', 'qty', 'disponible', 'stock disponible', 'estoque', 'quantidade', 'qtd', '库存'],
  imagen: ['image src', 'imagen', 'imagenes', 'imágenes', 'foto', 'image', 'images', 'url imagen', 'url de imagen', 'image url', 'imagem', 'picture', '图片'],
  descripcion: ['body (html)', 'descripcion', 'descripción', 'description', 'short description', 'detalhes', '描述'],
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
/* v2.31.1 · Planillas "como las arma el proveedor": una hoja por marca, cada bloque con su propio encabezado
   ("ELFBAR 40K | PREÇO U$ | DISPONIBILIDAD"), dos tablas lado a lado ("NOMBRE FOTO PRECIO NOMBRE FOTO PRECIO")
   y la moneda escrita en el encabezado o en una nota ("TODOS LOS PRECIOS ESTÁN EN DÓLARES").
   Devuelve una sola tabla normal (Nombre · Costo · Categoría · Código · Stock) para que el resto del importador la use igual. */
const H_PRECIO = /^(precio|preco|price|valor|costo|custo|cost|pvp|fob|unit price|wholesale)\b|单价|价格|售价|进价|批发价/;
const H_NOMBRE = /^(nombre|nome|producto|produto|product|item name|item description|articulo|descripcion|descricao|description|detalle|denominacion|title|name)\b|品名|名称|产品|商品/;
const H_SKU = /^(cod|codigo|sku|ref|refer|referencia|item no|item number|model no|modelo)\b|货号|编号|型号/;
const H_DISP = /^(disponibilidad|disponibilidade|disponivel|status|estado|situacao|stock|estoque|existencia|inventario)\b|库存/;
const H_FOTO = /^(foto|imagen|imagem|image|picture|photo)\b|图片/;
const NO_HAY = /indispon|agotad|sin stock|sem estoque|esgotad|out of stock|no disponible|sold out|encargo/i;
const txt = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const monedaDe = s => /u\s?\$\s?s|us\s?\$|\bu\$|\busd\b|d[oó]lar/i.test(s) ? 'usd' : /r\$|\bbrl\b|reais|reales/i.test(s) ? 'brl' : /\bars\b|pesos?/i.test(s) ? 'ars' : null;
const hojaGenerica = n => /^(hoja|sheet|planilha|plan|tabela|tabla|lista)\s*\d*$/i.test(txt(n)) || !txt(n);
function esEncabezado(fila) {
  const cs = fila.map(txt).filter(Boolean); if (!cs.length || cs.length > 16) return false;
  const nums = cs.filter(c => /^[$u\s]*[\d.,]+$/i.test(c)).length;
  return cs.some(c => H_PRECIO.test(clave(c))) && nums <= cs.length * 0.3;
}
export function planillaPorBloques(hojas) {
  const filas = [['Nombre', 'Costo', 'Categoría', 'Código', 'Stock']], origen = [], monedas = new Map();
  for (const [hi, h] of (hojas || []).entries()) {
    const F = h.filas || []; if (!F.length) continue;
    // nota de moneda en las primeras filas de la hoja ("todos los precios están en dólares")
    const nota = F.slice(0, 8).map(f => f.map(txt).join(' ')).join(' ');
    const monHoja = /(precios|valores|prices|pre[cç]os)[^.]{0,40}(d[oó]lares|usd|u\$s|us\$)/i.test(nota) ? 'usd' : null;
    let grupos = null;
    for (let r = 0; r < F.length; r++) {
      const fila = F[r] || [];
      if (esEncabezado(fila)) {
        // un grupo por cada columna de precio: su nombre es la columna de texto más cercana a la izquierda
        const head = fila.map(txt), k = head.map(clave), g = [];
        k.forEach((c, j) => {
          if (!H_PRECIO.test(c) || (g.length && g[g.length - 1].p === j - 1)) return;   // dos columnas de precio seguidas (x1 y x6+): vale la primera
          let n = -1;
          for (let x = j - 1; x >= 0 && x >= (g.length ? g[g.length - 1].p + 1 : 0); x--) if (H_NOMBRE.test(k[x])) { n = x; break; }
          if (n < 0) for (let x = j - 1; x >= (g.length ? g[g.length - 1].p + 1 : 0); x--) if (head[x] && !H_PRECIO.test(k[x]) && !H_SKU.test(k[x]) && !H_DISP.test(k[x]) && !H_FOTO.test(k[x])) { n = x; break; }
          if (n < 0) n = g.length ? g[g.length - 1].p + 1 : 0;
          const ini = g.length ? g[g.length - 1].p + 1 : 0;
          let sku = -1, disp = -1;
          for (let x = ini; x < j; x++) if (x !== n && H_SKU.test(k[x])) sku = x;
          for (let x = j + 1; x < head.length && !H_PRECIO.test(k[x]) && !H_NOMBRE.test(k[x]); x++) if (H_DISP.test(k[x])) { disp = x; break; }
          // si la columna del nombre no dice "nombre" sino "ELFBAR 40K", eso es la categoría del bloque
          const cat = H_NOMBRE.test(k[n]) || !head[n] ? '' : head[n];
          g.push({ n, p: j, sku, disp, cat, mon: monedaDe(head[j]) || monHoja, ini });
        });
        g.forEach((x, i) => { x.hasta = i + 1 < g.length ? g[i + 1].ini - 1 : 1e9; });
        if (g.length) { grupos = g; continue; }
      }
      if (!grupos) continue;
      for (const gr of grupos) {
        const nom = txt(fila[gr.n]), pr = txt(fila[gr.p]);
        if (!nom || nom.length < 2 || !/[\p{L}]/u.test(nom) || /^[\d\s.,$]+$/.test(nom)) continue;
        const v = num(pr); if (!(v > 0) || /[a-z]{4,}/i.test(pr.replace(/usd|u\$s|us\$|r\$/ig, ''))) continue;
        const d = gr.disp >= 0 ? txt(fila[gr.disp]) : '';
        const cat = (gr.cat || (hojaGenerica(h.nombre) ? '' : txt(h.nombre)) || 'General').replace(/^(lista|cat[aá]logo)\s+/i, '');
        const mon = monedaDe(pr) || gr.mon; if (mon) monedas.set(mon, (monedas.get(mon) || 0) + 1);
        filas.push([nom.slice(0, 160), String(v), cat.slice(0, 60), gr.sku >= 0 ? txt(fila[gr.sku]).slice(0, 60) : '', d && NO_HAY.test(d) ? '0' : '']);
        origen.push({ hoja: hi, fila: r, desde: gr.ini, hasta: gr.hasta });
      }
    }
  }
  if (filas.length < 2) return null;
  const moneda = [...monedas].sort((a, b) => b[1] - a[1])[0];
  return { filas, origen, moneda: moneda ? moneda[0] : null };
}

// opts: {moneda:'usd'|'ars', tipo:'costo'|'venta', cot, margen, categoriaDefecto}
export function tablaAProductos(t, map, opts = {}) {
  const cot = Number(opts.cot) > 0 ? Number(opts.cot) : 1, mg = Number(opts.margen) >= 0 ? Number(opts.margen) : 0;
  const get = (r, f) => (map[f] != null && map[f] !== '' && r[map[f]] != null) ? String(r[map[f]]).trim() : '';
  const out = [], porHandle = new Map(); let ultimo = null;
  for (let fi = 0; fi < t.datos.length; fi++) {
    const r = t.datos[fi], h = get(r, 'handle'), nom = get(r, 'nombre');
    let it;
    if (nom) {
      it = { nombre: nom.slice(0, 160), categoria: (get(r, 'categoria').split(/[>,;]/).pop().trim() || opts.categoriaDefecto || 'General').slice(0, 60), marca: get(r, 'marca').slice(0, 60) || null, sku: get(r, 'sku').slice(0, 60) || null, descripcion: get(r, 'descripcion').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000) || null, imagen_url: null, variantes: [], stock: null, agotado: false, costo_usd: null, precio_ars: null, _p: [], _a: [] };
      const img = get(r, 'imagen').split(/[,\s|]+/).find(u => /^https:\/\//.test(u)); if (img) it.imagen_url = img;
      if (h) porHandle.set(h, it);
      it._fila = fi;
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
    const tasa = { brl: 'BRL', cny: 'CNY', eur: 'EUR', pyg: 'PYG' }[opts.moneda];   // v2.31.1: reales, yuanes…
    let usd = opts.moneda === 'ars' ? base / cot : tasa ? base / (Number(TASAS[tasa]) > 0 ? Number(TASAS[tasa]) : TASA_REF[tasa]) : base;
    if (esVenta) usd = usd / (1 + mg);
    it._p.push(Math.round(usd * 10000) / 10000); it._a.push(opts.moneda === 'ars' ? base : Math.round((tasa ? base / (Number(TASAS[tasa]) > 0 ? Number(TASAS[tasa]) : TASA_REF[tasa]) : base) * cot));
  }
  for (const it of out) { it.costo_usd = it._p.length ? Math.min(...it._p) : null; it.precio_ars = it._a.length ? Math.min(...it._a) : null; delete it._p; delete it._a; if (it.stock === 0) it.agotado = true; }
  return out;
}

/* ---------- 3) ARCHIVOS ---------- */
// Si la planilla no es una exportación estándar (Tiendanube, Shopify…) o tiene varias hojas, se lee por bloques
// y se arma una sola tabla con todas las hojas. Las hojas originales quedan para elegir a mano en el panel.
function conBloques(r) {
  const det = detectarTabla(r.filas), b = planillaPorBloques(r.hojas || [{ nombre: '', filas: r.filas }]);
  const estandar = det.reconocido && (det.map.precio != null || det.map.costo != null) && ['Tiendanube', 'Shopify', 'WooCommerce'].includes(det.plataforma);
  const nEst = det.reconocido && (det.map.precio != null || det.map.costo != null) ? det.datos.filter(f => String(f[det.map.nombre] || '').trim()).length : 0;
  if (!b || estandar || (b.filas.length - 1) <= nEst) {
    // tabla común: la moneda sale de lo que dicen las celdas de precio ("R$ 55,00", "US$ 7,50") o el encabezado ("Preço U$")
    const col = det.map.costo != null ? det.map.costo : det.map.precio;
    if (col != null && !r.moneda) {
      const cuenta = new Map(); det.datos.slice(0, 200).forEach(f => { const m = monedaDe(txt(f[col])); if (m) cuenta.set(m, (cuenta.get(m) || 0) + 1); });
      const top = [...cuenta].sort((a, b) => b[1] - a[1])[0], mh = monedaDe(det.head[col] || '');
      r.moneda = top && top[1] >= Math.min(5, det.datos.length / 2) ? top[0] : mh;
    }
    return r;
  }
  const nh = new Set(b.origen.map(x => x.hoja)).size;
  return { tipo: 'tabla', filas: b.filas, moneda: b.moneda, origen: b.origen, bloques: true,
    hojas: [{ nombre: nh > 1 ? `Todas las hojas (${b.filas.length - 1} productos)` : `Productos (${b.filas.length - 1})`, filas: b.filas }, ...(r.hojas || [])] };
}
// Fotos pegadas en el Excel (cada una anclada a la fila de su producto). Devuelve un arreglo alineado con las filas de datos.
const atr = (tag, a) => ((tag.match(new RegExp('\\s' + a + '="([^"]*)"')) || [])[1] || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const rels = x => [...String(x || '').matchAll(/<Relationship\b[^>]*>/g)].map(m => ({ id: atr(m[0], 'Id'), tipo: atr(m[0], 'Type'), dest: atr(m[0], 'Target') }));
const resolver = (base, dest) => { if (dest.startsWith('/')) return dest.slice(1); const p = base.split('/').slice(0, -1); for (const s of dest.split('/')) { if (s === '..') p.pop(); else if (s && s !== '.') p.push(s); } return p.join('/'); };
const relsDe = p => p.replace(/([^/]+)$/, '_rels/$1.rels');
export async function fotosDePlanilla(buf, hojas, origen, o = {}) {
  const Z = await cargarScript(LIB.zip, 'JSZip'), z = await Z.loadAsync(buf), leer = async p => { const x = z.file(p); return x ? x.async('string') : ''; };
  const wb = await leer('xl/workbook.xml'), wr = rels(await leer('xl/_rels/workbook.xml.rels'));
  const hojasXml = [...wb.matchAll(/<sheet\b[^>]*>/g)].map(m => ({ nombre: atr(m[0], 'name'), rid: atr(m[0], 'r:id') }));
  const porFila = new Map(); origen.forEach((x, i) => { const k = x.hoja + ':' + x.fila; (porFila.get(k) || porFila.set(k, []).get(k)).push(i); });
  const pedidos = [];   // [índice de producto, ruta de la imagen]
  for (const [hi, h] of hojas.entries()) {
    if (!origen.some(x => x.hoja === hi)) continue;
    const hx = hojasXml.find(x => x.nombre === h.nombre); if (!hx) continue;
    const rel = wr.find(r => r.id === hx.rid); if (!rel) continue;
    const sp = resolver('xl/workbook.xml', rel.dest), dr = rels(await leer(relsDe(sp))).find(r => /\/drawing$/.test(r.tipo)); if (!dr) continue;
    const dp = resolver(sp, dr.dest), dx = await leer(dp), drel = rels(await leer(relsDe(dp)));
    // con o sin prefijo ("xdr:oneCellAnchor" en Excel y Google Sheets, "oneCellAnchor" en otros programas)
    for (const m of dx.matchAll(/<((?:\w+:)?)(oneCellAnchor|twoCellAnchor|absoluteAnchor)\b[\s\S]*?<\/\1\2>/g)) {
      const a = m[0], de = (a.match(/<(?:\w+:)?from>([\s\S]*?)<\/(?:\w+:)?from>/) || [])[1] || '';
      const col = +((de.match(/<(?:\w+:)?col>(\d+)</) || [])[1]), fila = +((de.match(/<(?:\w+:)?row>(\d+)</) || [])[1]);
      const emb = (a.match(/<(?:\w+:)?blip\b[^>]*?(?:\w+:)?embed="([^"]+)"/) || [])[1]; if (!emb || isNaN(col) || isNaN(fila)) continue;
      const img = drel.find(r => r.id === emb); if (!img) continue;
      const f = fila - (h.r0 || 0), c = col - (h.c0 || 0);
      const cand = [...(porFila.get(hi + ':' + f) || []), ...(porFila.get(hi + ':' + (f + 1)) || [])].filter(i => origen[i].desde <= c && c <= origen[i].hasta);
      if (cand.length) pedidos.push([cand[0], resolver(dp, img.dest)]);
    }
  }
  const fotos = new Array(origen.length).fill(null), usados = new Set();
  const lista = pedidos.filter(([i]) => !usados.has(i) && usados.add(i)).sort((a, b) => a[0] - b[0]).slice(0, o.limite || 1e9);
  for (let k = 0; k < lista.length; k++) {
    const [i, ruta] = lista[k], x = z.file(ruta); if (!x) continue;
    if (o.progreso && (k % 10 === 0)) o.progreso(`Sacando las fotos del Excel: ${k + 1} de ${lista.length}…`);
    const ext = (ruta.match(/\.(\w+)$/) || [])[1] || 'png', tipo = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }[ext.toLowerCase()];
    if (!tipo) continue;
    try { const b = new Blob([await x.async('arraybuffer')], { type: tipo }); fotos[i] = o.achicar ? await o.achicar(b) : b; } catch (e) { }
  }
  return fotos;
}
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
// o: { fotos: cuántas fotos sacar de un Excel (0 = ninguna), achicar: blob → blob|dataURL }
export async function leerArchivo(f, progreso = () => { }, o = {}) {
  const n = (f.name || '').toLowerCase(), MB = f.size / 1048576;
  // v2.31.1: los catálogos con fotos pesan mucho (un Excel con 600 fotos ≈ 200 MB)
  const tope = /\.(xlsx|xlsm|ods)$/.test(n) ? 300 : /\.(pdf|zip)$/.test(n) ? 150 : 40;
  if (MB > tope) throw new Error(`El archivo pesa ${Math.round(MB)} MB y el máximo para este tipo es ${tope} MB. Dividilo en partes.`);
  if (/\.(csv|tsv)$/.test(n)) { const filas = parsearCSV(await leerTexto(f)); return conBloques({ tipo: 'tabla', filas, hojas: [{ nombre: '', filas }] }); }
  if (/\.(txt|text|md)$/.test(n) || f.type === 'text/plain') {
    const t = await leerTexto(f);
    // un .txt con muchas columnas separadas por ; o tab suele ser una planilla exportada
    const l1 = t.split(/\r?\n/).slice(0, 3);
    if (!pareceChat(t) && l1.length > 1 && l1.every(x => (x.match(/[;\t]/g) || []).length >= 2) && detectarTabla(parsearCSV(t)).reconocido) return { tipo: 'tabla', filas: parsearCSV(t) };
    return { tipo: 'texto', texto: t };
  }
  if (/\.(xlsx|xlsm|xls|ods)$/.test(n)) {
    progreso(MB > 20 ? `Leyendo planilla (${Math.round(MB)} MB, puede tardar un poco)…` : 'Leyendo planilla…'); const X = await cargarScript(LIB.xlsx, 'XLSX'); const buf = await leerBuf(f);
    const wb = X.read(buf, { type: 'array', cellStyles: false, cellHTML: false, sheetStubs: false });
    const hojas = wb.SheetNames.map(nm => { const ws = wb.Sheets[nm], rg = X.utils.decode_range(ws['!ref'] || 'A1');
      return { nombre: nm, r0: rg.s.r, c0: rg.s.c, filas: X.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true }) }; }).filter(h => h.filas.filter(r => r.some(c => String(c).trim())).length > 1);
    if (!hojas.length) throw new Error('La planilla está vacía.');
    const r = conBloques({ tipo: 'tabla', filas: hojas[0].filas, hojas });
    if (r.origen && o.fotos > 0 && /\.(xlsx|xlsm)$/.test(n)) { try { r.fotos = await fotosDePlanilla(buf, hojas, r.origen, { limite: o.fotos, achicar: o.achicar, progreso }); } catch (e) { r.fotos = null; } }
    return r;
  }
  if (/\.pdf$/.test(n)) {
    progreso('Leyendo PDF…'); const P = await cargarScript(LIB.pdf, 'pdfjsLib'); P.GlobalWorkerOptions.workerSrc = LIB.pdfWorker;
    const doc = await P.getDocument({ data: await leerBuf(f) }).promise; let txt = '';
    for (let i = 1; i <= Math.min(doc.numPages, 400); i++) {
      progreso(`PDF: página ${i} de ${doc.numPages}`);
      const c = await (await doc.getPage(i)).getTextContent(); const lin = new Map();
      for (const it of c.items) { const y = Math.round(it.transform[5] / 3); (lin.get(y) || lin.set(y, []).get(y)).push([it.transform[4], it.str]); }
      [...lin.entries()].sort((a, b) => b[0] - a[0]).forEach(([, p]) => { txt += p.sort((a, b) => a[0] - b[0]).map(x => x[1]).join(' ').trim() + '\n'; });
    }
    if (txt.replace(/\s/g, '').length < 30) {
      // PDF escaneado (cada página es una foto): se lee con OCR página por página
      const max = Math.min(doc.numPages, 15); let t2 = '';
      for (let i = 1; i <= max; i++) {
        progreso(`PDF escaneado: leyendo la página ${i} de ${max} (con OCR, tarda un poco)…`);
        const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 2 }), cv = document.createElement('canvas');
        cv.width = Math.min(vp.width, 2400); cv.height = Math.round(vp.height * cv.width / vp.width);
        await pg.render({ canvasContext: cv.getContext('2d'), viewport: pg.getViewport({ scale: 2 * cv.width / vp.width }) }).promise;
        const b = await new Promise(ok => cv.toBlob(ok, 'image/jpeg', .9)); if (b) t2 += (await ocr(b, () => { })) + '\n';
      }
      if (t2.replace(/\s/g, '').length < 30) throw new Error('No pudimos leer este PDF: no tiene texto y la imagen no se entiende. Probá con una captura más nítida.');
      return { tipo: 'texto', texto: t2, ocr: true, paginas: max, total: doc.numPages };
    }
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
  // cuántas palabras leyó con seguridad (si el lector no da la seguridad, cuenta todo el texto)
  const L = lineasOcr(r.data);
  _ultOcr = { palabras: L ? L.reduce((a, l) => a + l.words.filter(w => Number(w.confidence) >= 60 && /[\p{L}\p{N}]{2,}/u.test(String(w.text || ''))).length, 0)
                          : (String(r.data.text || '').match(/[\p{L}\p{N}]{2,}/gu) || []).length,
    lineas: L ? L.map(l => ({ t: confiables(l.words), h: l.bbox ? l.bbox.y1 - l.bbox.y0 : 0, y: l.bbox ? l.bbox.y0 : 0 })).filter(x => x.t) : null };
  return textoConfiable(r.data);
}
function lineasOcr(d) {
  if (!d) return null;
  const conPal = x => Array.isArray(x) && x.some(l => l && Array.isArray(l.words));
  if (conPal(d.lines)) return d.lines;
  if (Array.isArray(d.blocks)) {   // tesseract.js más nuevo: bloques → párrafos → renglones
    const ls = []; d.blocks.forEach(b => (b && b.paragraphs || []).forEach(p => (p && p.lines || []).forEach(l => ls.push(l))));
    if (conPal(ls)) return ls;
  }
  return null;
}
let _ultOcr = { palabras: 0 };
export const infoOcr = () => _ultOcr;   // cuánto texto había en la última foto (aunque no se haya podido leer)
// Se queda solo con las palabras que el lector leyó con seguridad. En una foto de producto sin texto (zapatillas,
// ropa…) el lector "ve" letras sueltas en las texturas ("Pa Y", "E", "%"): con esto no se confunden con un nombre o un precio.
export function textoConfiable(d) {
  if (!d) return '';
  const L = lineasOcr(d);
  if (!L) return d.text || '';
  return L.map(l => confiables(l.words)).filter(l => /[\p{L}\p{N}]/u.test(l)).join('\n');
}
function confiables(words) {
  return (words || []).filter(w => {
    const t = String(w.text || '').trim(), c = Number(w.confidence);
    if (/^[$€]+$/.test(t)) return c >= 35;           // el "$" suelto antes del precio
    if (!/[\p{L}\p{N}]/u.test(t)) return false;
    return /\d/.test(t) ? c >= 35 : c >= 55 && (t.match(/\p{L}/gu) || []).length >= (t.length > 2 ? 2 : 1);
  }).map(w => String(w.text).trim()).join(' ');
}
// v2.31.1 · flyers de venta (Instagram, Estados): textos publicitarios que no son ni el nombre ni el precio del producto
const PUBLI = /env[ií]os?|todo el pa[ií]s|\bcaba\b|\bamba\b|cuotas?|sin inter[eé]s|\boff\b|descuento|transferencia|abonando|\bantes\b|\bagora\b|\bahora\b|\bblack\b|oferta|\bpromo|llevando|llev[aá]telo|m[ií]nimo|instagram|\.com\b|garant[ií]a|retir[oa]|\bprecio\b|\bpago\b|efectivo|tarjeta|\batacado\b|hot ?sale|cyber|\bsale\b|en el d[ií]a|stock|consult/i;
const PRECIO_BUENO = /\b(ahora|agora|precio|abonando|transferencia|oferta|hoy|now|solo|s[oó]lo|final|contado|efectivo)\b/i, PRECIO_MALO = /\b(antes|era|de\s*\$|lista|tachad|cuotas?|regular|desde)\b|\(\s*\$/i;
export const esFlyer = texto => { const ls = String(texto || '').split(/\r?\n/); return ls.filter(l => PUBLI.test(l)).length >= 1 && ls.filter(l => /\$|us\$|u\$s|usd/i.test(l)).length <= 4; };

/* ---------- 6) FOTO DE PROVEEDOR = UN PRODUCTO ---------- */
// Las fotos de canales y grupos de distribuidores traen el precio (y a veces el nombre) escritos encima.
// Ese precio es el COSTO del comerciante (lo que le cobra el proveedor), no un precio de venta.
const NO_NOMBRE = /^(precio|precios|stock|disponible|consult|whats|wsp|envio|envíos|mayorista|minorista|oferta|promo|nuevo|ingreso|unidad|unidades|x\s?\d+|cod|código|ref)\b/i;
export function deTextoDeFoto(texto, cotizacion, sinSimbolo = 'ars', conTam = null) {
  const cot = Number(cotizacion) > 0 ? Number(cotizacion) : 1;
  // en capturas de pantalla aparecen textos de la app (seguidores, hora, "Reenviado"…): se descartan para no confundirlos con el precio
  const UI = /seguidor|followers|vistas|views|reenviad|forwarded|reacci|miembros|members|escribiendo|en l[ií]nea|online|[uú]lt\.? vez|visto por|canal|channel|silenciad|@\w|^\s*\d{1,2}[:.]\d{2}\s*(?:[ap]\.?\s?m\.?)?\s*$|\b\d{1,2}:\d{2}\b|%|\bwhatsapp\b/i;
  const lineas = String(texto || '').split(/\r?\n/).map(l => l.replace(EMOJI, ' ').replace(/[|_~*`©®™•·]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(l => l.length >= 2 && !UI.test(l));
  // precio: con símbolo ($ / USD / R$). En un flyer gana el que dice "ahora / transferencia / precio";
  // pierden "antes", el tachado entre paréntesis y el valor de cada cuota
  let precio = null, mejor = -1e9;
  lineas.forEach((l, i) => {
    const p = extraerPrecio(l, cot); if (!(p && p.usd > 0)) return;
    const cerca = [lineas[i - 1] || '', l, lineas[i + 1] || ''].join(' ');
    let sc = 0;
    if (PRECIO_MALO.test(l)) sc -= 5; else if (/cuotas?/i.test(lineas[i + 1] || '') && !PRECIO_BUENO.test(lineas[i + 1] || '')) sc -= 2;
    if (PRECIO_BUENO.test(l)) sc += 3; else if (PRECIO_BUENO.test(cerca) && !PRECIO_MALO.test(lineas[i - 1] || '')) sc += 2;
    if (/^\s*\(?.*\)\s*$/.test(l) && /\(/.test(l)) sc -= 2;
    if (sc > mejor) { mejor = sc; precio = p; }
  });
  if (!precio) {   // "25,99" sin símbolo y con la cotización en miles: casi seguro son dólares (se marca para revisar)
    for (const l of lineas) { if (PRECIO_MALO.test(l)) continue; const m = l.match(/(?:^|\s|\D)(\d{1,3}[.,]\d{2})(?:\D|$)/); const v = m ? num(m[1]) : 0; if (v > 0 && v < cot / 20) { precio = { usd: v, inferido: true }; break; } }
  }
  if (!precio) {
    const nums = lineas.join(' ').match(/\b\d{1,3}(?:[.,]\d{3})+(?:,\d{1,2})?\b|\b\d{3,7}\b/g) || [];
    const vals = nums.map(num).filter(v => v >= 100 && v < 100000000 && !(v >= 1900 && v <= 2100));
    if (vals.length) { const v = Math.max(...vals); precio = sinSimbolo === 'usd' ? { usd: v } : { usd: Math.round(v / cot * 10000) / 10000, ars: v }; precio.inferido = true; }
  }
  // nombre: la línea con más letras que no sea un precio ni una palabra de relleno ni publicidad.
  // Si el lector dio el tamaño de cada renglón, gana el texto más grande (el título del flyer) y se le suma el renglón de abajo si es igual de grande.
  const legible = l => nombreCreible(l) && /\p{L}{4,}/u.test(l);   // descarta manchas leídas como letras ("y f 4 é y", "7 N")
  const sirve = l => !extraerPrecio(l, cot) && !NO_NOMBRE.test(l) && !PUBLI.test(l) && (l.match(/\p{L}/gu) || []).length >= 4 && !/^[\d\W]+$/.test(l) && legible(l);
  const limpiaN = l => l.replace(/[^\p{L}\p{N} .,'&/+()-]/gu, ' ').replace(/\s+/g, ' ').trim();
  let nombre = '';
  const LT = Array.isArray(conTam) && conTam.length ? conTam.filter(x => !UI.test(x.t)) : null;
  if (LT) {
    const orden = LT.map((x, i) => ({ ...x, i })).filter(x => sirve(x.t) || (x.h && /^[\p{L}\p{N} .\-+]{2,20}$/u.test(x.t) && !PUBLI.test(x.t) && !extraerPrecio(x.t, cot)));
    const top = orden.filter(x => sirve(x.t)).sort((a, b) => b.h - a.h)[0];
    if (top) {
      const partes = [top];
      const vale = v => v && !PUBLI.test(v.t) && !extraerPrecio(v.t, cot) && limpiaN(v.t).length >= 2 && (nombreCreible(v.t) || /^[\p{N}\s]*(en|in|x)\s*\p{N}*\s*\p{L}{3,}/iu.test(limpiaN(v.t)));
      for (const d of [1, -1]) { const v = LT[top.i + d]; if (vale(v) && v.h >= top.h * 0.6) { if (d > 0) partes.push(v); else partes.unshift(v); } }
      // si el título es una sola palabra (la marca: "NUMBUZIN"), se suma el renglón de abajo aunque sea más chico ("NO.9 EYE CREAM")
      const sola = limpiaN(top.t).replace(/\s+\S$/, '').split(' ').length === 1;
      if (sola && partes.length === 1) { const v = LT[top.i + 1]; if (vale(v) && sirve(v.t)) partes.push(v); }
      const puntas = t => limpiaN(t).replace(/(\s+\S)+$/u, m => /\p{L}{2}/u.test(m) ? m : '').replace(/^([^\p{N}\s]\s+)+/u, '').trim();
      nombre = partes.map(x => puntas(x.t)).filter(Boolean).join(' ');
    }
  }
  if (!nombre) {
    const cands = lineas.filter(sirve).map(limpiaN).filter(l => l.length >= 3);
    cands.sort((a, b) => (b.match(/[a-záéíóúñ]/gi) || []).length - (a.match(/[a-záéíóúñ]/gi) || []).length);
    nombre = cands[0] || '';
  }
  nombre = nombre.replace(/(\s+\S)+$/u, m => /\p{L}{2}/u.test(m) ? m : '').replace(/^(\S\s+)+/u, '').trim();   // letras o números sueltos en las puntas ("Numbuzin 8")
  nombre = nombre.slice(0, 120);
  return { nombre, costo_usd: precio ? precio.usd : null, precio_ars: precio ? (precio.ars || Math.round(precio.usd * cot)) : null, inferido: !!(precio && precio.inferido) };
}
// Un nombre TODO EN MAYÚSCULAS (como viene en los flyers) pasado a "Planchita de Pelo Daling DL-5249":
// los códigos con números y las siglas cortas (ML, EDP) quedan como estaban; "de", "en", "y"… van en minúscula.
const CHICAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'e', 'o', 'con', 'para', 'por', 'sin', 'a', 'al', 'x']);
export function tituloLindo(n) {
  n = String(n || '');
  if (!n || n !== n.toUpperCase() || !/\p{L}{3}/u.test(n)) return n;
  return n.split(/(\s+)/).map((w, i) => {
    if (/^\s+$/.test(w) || /\d/.test(w)) return w;
    const lo = w.toLowerCase();
    if (i > 0 && CHICAS.has(lo)) return lo;
    if ((w.match(/\p{L}/gu) || []).length <= 3 && !/[aeiouáéíóú]/i.test(w)) return w;   // siglas: ML, EDP, SPF
    return lo.replace(/^(\P{L}*)(\p{L})/u, (x, a, c) => a + c.toUpperCase());
  }).join('');
}
// Nombre a partir del archivo cuando la foto no tiene texto: "Perfume Asad 100ml.jpg" → "Perfume Asad 100ml"
export const nombreDeArchivo = n => {
  const b = String(n || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  return /^(img|image|imagen|photo|foto|whatsapp|wa|screenshot|captura|\d+|pxl|dsc)\b/i.test(b) || /\b(wa\d{3,}|\d{8})\b/i.test(b) ? '' : b.slice(0, 120);
};

// Nombre y precio escritos en el NOMBRE DEL ARCHIVO ("ZAPATILLA NIKE - PRECIO 70000.jpg", "Buzo canguro $25.000.png").
// Los nombres automáticos (WhatsApp Image…, IMG_1234, Captura…) no se usan.
export function deArchivoNombre(n, cotizacion, sinSimbolo = 'ars') {
  const cot = Number(cotizacion) > 0 ? Number(cotizacion) : 1;
  const b = String(n || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!b || !nombreDeArchivo(b)) return null;
  const m = b.match(/(?:precio|valor|\$|us\$|u\$s|usd)\s*:?\s*\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s*(usd|us\$|u\$s)?\s*$/i)
         || b.match(/(?:^|[\s-])(\d{1,3}(?:[.,]\d{3})+|\d{3,})\s*$/);
  let precio = 0;
  if (m) { const t = m[1]; precio = /^\d{1,3}([.,]\d{3})+(,\d{1,2})?$/.test(t) ? Number(t.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.')) : Number(t.replace(',', '.')); }
  const usd = !!m && (/(us\$|u\$s|usd)/i.test(m[0]) || (sinSimbolo === 'usd' && !/\$/.test(m[0])));
  let nombre = (m ? b.slice(0, m.index) : b).replace(/\b(precio|valor)\b/ig, ' ').replace(/[\s\-–:|$]+$/, '').replace(/\s+/g, ' ').trim();
  if ((nombre.match(/\p{L}/gu) || []).length < 3) nombre = '';
  if (nombre && nombre === nombre.toUpperCase()) nombre = nombre.toLowerCase().replace(/(^|\s)(\p{L})/gu, (x, a, c) => a + c.toUpperCase());   // "ZAPATILLA NIKE" → "Zapatilla Nike"
  if (!nombre && !(precio > 0)) return null;
  // explicito: el nombre dice "precio …", "$ …" o "usd …" (alguien lo escribió a propósito: vale más que lo que se lea en la foto)
  const explicito = precio > 0 && /(precio|valor|\$|usd)/i.test(m[0]);
  return { nombre: nombre.slice(0, 120), costo_usd: precio > 0 ? (usd ? precio : Math.round(precio / cot * 10000) / 10000) : null, precio_ars: precio > 0 && !usd ? precio : (precio > 0 ? Math.round(precio * cot) : null), explicito };
}
// ¿Parece un nombre de producto? "au Eo" o "Pa Y frost de as la el" son manchas de la foto leídas como letras.
export const nombreCreible = n => { const w = String(n || '').match(/\p{L}+/gu) || [], l = w.filter(x => x.length >= 3); return l.length >= 1 && l.length * 3 >= w.length; };

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
