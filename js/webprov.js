// "Traer productos desde la web del proveedor" (v2.18).
// Lee el catálogo PÚBLICO del proveedor a través de /api/leer-web (respeta robots.txt, sin iniciar sesión, despacio)
// y lo convierte en una tabla para el importador: nombre ordenado (sin el código del proveedor), costo, categoría,
// marca, código, foto y, si se pide, la descripción.
// Reconoce: Tienda Negocio, Shopify, WooCommerce y cualquier tienda con datos de producto estándar (JSON-LD / Open Graph:
// Tiendanube, Empretienda, VTEX, Wix, PrestaShop, Magento y la mayoría de las webs).
// Todo lo que hace la red pasa por la función `leer(url, extra)` que se recibe de afuera (así se prueba sin internet).

export const MAX_PRODUCTOS = 1000;          // catálogos con API (Tienda Negocio, Shopify, WooCommerce)
export const MAX_FICHAS = 400;              // webs que hay que recorrer ficha por ficha
const MAX_PAGINAS = 1000, PAUSA = 350;
const esperar = ms => new Promise(r => setTimeout(r, ms));

/* ---------- utilidades de texto ---------- */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', deg: '°', ordm: 'º', ordf: 'ª', reg: '®', trade: '™', copy: '©', hellip: '…', ndash: '–', mdash: '—', laquo: '«', raquo: '»', iexcl: '¡', iquest: '¿' };
const cp = n => n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
export const entidades = s => String(s == null ? '' : s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? cp(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e] != null ? ENT[e] : m));
export function textoPlano(html) {
  return entidades(String(html || '')
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\s*(br|\/p|\/div|\/li|\/h\d|\/tr)\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();
}
// Descripción para TU tienda: sin teléfonos, enlaces, precios, "consultá por WhatsApp" ni condiciones del proveedor.
export function limpiarDescripcion(html, max = 800) {
  const malas = /(whats ?app|wsp|tel[eé]fono|celular|\b(?:llam|escrib)[ae]|consult[aá]|\$\s?\d|\bars\b|precio|mayorista|minimo de compra|m[ií]nimo de compra|env[ií]os? a todo|retiro en|https?:\/\/|www\.|@[a-z0-9_.]+|instagram|facebook|transferencia|mercado ?pago|cuotas)/i;
  const lineas = textoPlano(html).replace(/([.!?])\s+(?=[A-ZÁÉÍÓÚÑ•])/g, '$1\n').split('\n').map(l => l.trim()).filter(l => l && !malas.test(l));
  let out = ''; for (const l of lineas) { if ((out + ' ' + l).length > max) break; out += (out ? ' ' : '') + l; }
  return out.trim();
}
// "1.500,00" · "1500.00" · "$ 12.345" · 1500 → número (pesos con centavos como decimales)
export function precioNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v == null ? '' : v).replace(/[^\d.,]/g, ''); if (!s) return 0;
  const ip = s.lastIndexOf('.'), ic = s.lastIndexOf(',');
  if (ip >= 0 && ic >= 0) s = ic > ip ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (ic >= 0) s = /,\d{1,2}$/.test(s) ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (ip >= 0 && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');          // 12.345 = doce mil
  const n = Number(s); return isFinite(n) ? n : 0;
}
const absoluta = (u, base) => { try { const x = new URL(entidades(String(u || '').trim()), base); if (x.protocol === 'http:') x.protocol = 'https:'; return x.protocol === 'https:' ? x.toString() : ''; } catch (e) { return ''; } };

/* ---------- nombres ordenados ---------- */
const SIGLAS = new Set('SPF FPS UV UVA UVB USB BT LED LCD HD FHD XL XXL XXXL XS PH BB CC ADN DNA PVC ABS EVA RGB HDMI WIFI TV PC DC AC AAA AA II III IV VIP DIY 3D 4K 5G 4G MP3 MP4 SD DVD CD GPS'.split(' '));
const MENORES = new Set('de del la las el los y e con para en a al o u por sin x'.split(' '));
const ACENTOS = {
  acido: 'ácido', acidos: 'ácidos', hialuronico: 'hialurónico', salicilico: 'salicílico', glicolico: 'glicólico', lactico: 'láctico', liquido: 'líquido', liquida: 'líquida',
  locion: 'loción', tonico: 'tónico', emulsion: 'emulsión', balsamo: 'bálsamo', lapiz: 'lápiz', mascara: 'máscara', mascaras: 'máscaras', jabon: 'jabón', jabones: 'jabones',
  dia: 'día', mas: 'más', pestanas: 'pestañas', unas: 'uñas', bano: 'baño', cosmeticos: 'cosméticos', cosmetico: 'cosmético', electrico: 'eléctrico', electrica: 'eléctrica',
  serum: 'sérum', colageno: 'colágeno', algodon: 'algodón', cafe: 'café', limon: 'limón', bateria: 'batería', baterias: 'baterías', telefono: 'teléfono',
  organico: 'orgánico', organica: 'orgánica', termico: 'térmico', termica: 'térmica', plastico: 'plástico', plastica: 'plástica', magico: 'mágico', magica: 'mágica',
  acrilico: 'acrílico', nino: 'niño', nina: 'niña', ninos: 'niños', ninas: 'niñas', diseno: 'diseño', pequeno: 'pequeño', pequena: 'pequeña', tamano: 'tamaño',
  corazon: 'corazón', proteccion: 'protección', hidratacion: 'hidratación', nutricion: 'nutrición', accion: 'acción', coleccion: 'colección', edicion: 'edición',
  funcion: 'función', facil: 'fácil', util: 'útil', utiles: 'útiles', comoda: 'cómoda', comodo: 'cómodo', cepilo: 'cepillo', espatula: 'espátula', humedo: 'húmedo',
  capsula: 'cápsula', capsulas: 'cápsulas', vitaminico: 'vitamínico', pantalon: 'pantalón', cinturon: 'cinturón', camion: 'camión', avion: 'avión', raton: 'ratón',
  boton: 'botón', botones: 'botones', cajon: 'cajón', almohadon: 'almohadón', colchon: 'colchón', sillon: 'sillón', reloj: 'reloj', metalico: 'metálico', metalica: 'metálica',
  clasico: 'clásico', clasica: 'clásica', basico: 'básico', basica: 'básica', unico: 'único', unica: 'única', portatil: 'portátil', recargable: 'recargable', inalambrico: 'inalámbrico',
  inalambrica: 'inalámbrica', microfono: 'micrófono', auricular: 'auricular', vegano: 'vegano', aloe: 'aloe', te: 'té', carbon: 'carbón', lamina: 'lámina', laminas: 'láminas',
  pantalla: 'pantalla', maquina: 'máquina', camara: 'cámara', musica: 'música', grafico: 'gráfico', petalo: 'pétalo', petalos: 'pétalos', azucar: 'azúcar', arandano: 'arándano',
};
const quitarTildes = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const UNIDAD = /^(\d+(?:[.,]\d+)?)(ml|cc|l|lt|lts|g|gr|grs|kg|mg|cm|mm|m|mts|oz|w|v|mah|gb|tb|pcs|pzs|u|un|uds|unid)$/i;
const unidadBonita = u => ({ gr: 'g', grs: 'g', lt: 'l', lts: 'l', mts: 'm', pcs: 'u.', pzs: 'u.', u: 'u.', un: 'u.', uds: 'u.', unid: 'u.', mah: 'mAh', gb: 'GB', tb: 'TB', w: 'W', v: 'V' })[u.toLowerCase()] || u.toLowerCase();
const NO_PREFIJO = new Set('SET KIT PACK CAJA BOLSA LOTE MIX COMBO DUO TRIO PAR TV USB LED'.split(' '));
const esCodigo = (tok, sig) => {
  if (UNIDAD.test(tok) || /^x\d+$/i.test(tok)) return false;
  if (/^\d{4,}$/.test(tok)) return true;                                     // 40664
  if (tok.length >= 3 && /^[A-Za-z]{1,5}[-./]?\d[\w./-]*$/.test(tok) && tok === tok.toUpperCase()) return true;   // AC-23-15 · C-3669 · SD01454 · R2019
  if (/^\d+[-./]\d+[\w./-]*$/.test(tok)) return true;                         // 23-15 · 1001/2
  if (/^[A-Z]{2,4}$/.test(tok) && !NO_PREFIJO.has(tok) && sig && /^\d{4,}$/.test(sig)) return 'par';  // TYL 1844
  return false;
};
// Devuelve {nombre, codigo}: el código del proveedor sale del nombre (queda guardado como código / SKU).
export function limpiarNombre(titulo, marca = '') {
  let t = entidades(String(titulo || '')).replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
  t = t.replace(/\bC\/\s*/gi, 'con ').replace(/\bP\/\s*/gi, 'para ').replace(/\bS\/\s*/gi, 'sin ');
  let codigo = '';
  // "Cód. 1234 - …", "Art: AB12 …", "SKU 99 …", "#1234 …"
  const pre = t.match(/^(?:c[oó]d(?:igo)?|art(?:[ií]culo)?|ref(?:erencia)?|sku|#)\s*[.:#-]?\s*([\w./-]*\d[\w./-]*)\s*[-–:|]?\s*/i);
  if (pre) { codigo = pre[1]; t = t.slice(pre[0].length); }
  // códigos al final: "(COD 1234)" · "[AB-12]" · "- 40664"
  const suf = t.match(/\s*[([]\s*(?:c[oó]d(?:igo)?|art|ref|sku)?\s*[.:#]?\s*([\w./-]*\d[\w./-]*)\s*[)\]]\s*$/i) || t.match(/\s+[-–|]\s*([A-Z]{0,4}-?\d{4,})\s*$/);
  if (suf && !codigo && !UNIDAD.test(suf[1]) && !/^x\d+$/i.test(suf[1])) { codigo = suf[1]; t = t.slice(0, suf.index); }
  let toks = t.split(' ').filter(Boolean);
  if (!codigo) {
    const cod = [];
    while (toks.length > 1 && cod.length < 2) {
      const e = esCodigo(toks[0], toks[1]);
      if (e === 'par') { cod.push(toks[0] + toks[1]); toks = toks.slice(2); break; }
      if (!e) break;
      if (cod.length && !/[A-Za-z]/.test(toks[0])) break;
      cod.push(toks.shift());
    }
    if (!cod.length && toks.length > 2 && /^[A-Z]{1,3}-?\d{3,}$/.test(toks[toks.length - 1])) cod.push(toks.pop());   // "… ATERCIOPELADO C511"
    codigo = cod.join('-');
  }
  while (toks.length && /^[-–:|·.]+$/.test(toks[0])) toks.shift();
  toks = toks.filter(w => !/^x1$/i.test(w) && !/^(x1)+$/i.test(w));
  if (codigo && toks.length && toks[toks.length - 1].toUpperCase() === codigo.toUpperCase()) toks.pop();
  const letras = toks.join('').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, ''), mayus = letras.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length;
  const gritado = letras.length >= 4 && mayus / letras.length > 0.7;
  const parte = (base, i) => {
    const u = UNIDAD.exec(base); if (u) return u[1] + ' ' + unidadBonita(u[2]);
    if (/^x\d+$/i.test(base)) return base.toLowerCase();
    if (!gritado) return base;
    const k = quitarTildes(base).toUpperCase();
    if (SIGLAS.has(k) || /\d/.test(base) || /^[A-Z]\.?$/.test(base) && i > 0 && !MENORES.has(base.toLowerCase())) return base.toUpperCase();
    let p = base.toLowerCase(); const fix = ACENTOS[quitarTildes(p)]; if (fix) p = fix;
    return p;
  };
  const out = toks.map((w, i) => {
    const m = w.match(/^([("'¡¿]*)(.*?)([)"',.;:!?]*)$/), a = m[1], base = m[2], z = m[3];
    if (!base) return w;
    const conGuion = /^[\p{L}\d]+(-[\p{L}\d]+)+$/u.test(base) && !/\d-\d/.test(base);
    return a + (conGuion ? base.split('-').map((x, j) => parte(x, i + j)).join('-') : parte(base, i)) + z;
  });
  let nombre = out.join(' ').replace(/\s+([,.;:])/g, '$1').replace(/\(\s*\)|\[\s*\]/g, '').replace(/\s+/g, ' ').trim();
  if (marca && marca.length >= 2) {
    const prolija = marca === marca.toUpperCase() && marca.length > 3 ? marca.toLowerCase().replace(/(^|[\s-])\p{L}/gu, c => c.toUpperCase()) : marca;
    nombre = nombre.replace(new RegExp('(^|[^\\p{L}])' + marca.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^\\p{L}])', 'giu'), (m0, a) => a + prolija);
  }
  if (nombre) nombre = nombre[0].toUpperCase() + nombre.slice(1);
  return { nombre: nombre || t.trim(), codigo: codigo.slice(0, 40) };
}

/* ---------- lectura de datos estructurados ---------- */
export function jsonLd(html) {
  const out = [];
  const add = o => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(add); if (o['@graph']) add(o['@graph']); out.push(o); };
  for (const m of String(html).matchAll(/<script[^>]+type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { add(JSON.parse(m[1].trim().replace(/^<!--|-->$/g, ''))); } catch (e) { try { add(JSON.parse(entidades(m[1]).replace(/[\u0000-\u001f]+/g, ' '))); } catch (e2) { } }
  }
  return out;
}
const tipoDe = o => [].concat(o && o['@type'] || []).map(String);
export function meta(html, nombre) {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${nombre.replace(/[:.]/g, '\\$&')}["'][^>]*>`, 'i');
  const m = String(html).match(re); if (!m) return '';
  const c = m[0].match(/content=["']([^"']*)["']/i); return c ? entidades(c[1]).trim() : '';
}
const primero = v => Array.isArray(v) ? v[0] : v;
const imagenDe = v => { v = primero(v); if (!v) return ''; if (typeof v === 'string') return v; return v.url || v.contentUrl || v['@id'] || ''; };
const nombreDe = v => { v = primero(v); return !v ? '' : typeof v === 'string' ? v : v.name || ''; };
// Un producto desde una página (JSON-LD → Open Graph → microdatos)
export function productoDePagina(html, url) {
  const ld = jsonLd(html), p = ld.find(o => tipoDe(o).some(t => /^(Product|IndividualProduct|ProductModel|ProductGroup)$/i.test(t)));
  let r = null;
  if (p) {
    const ofs = [].concat(p.offers || []).flatMap(o => o && o['@type'] === 'AggregateOffer' ? [o, ...[].concat(o.offers || [])] : [o]).filter(Boolean);
    const vars = [].concat(p.hasVariant || []);
    const precios = [...ofs.map(o => precioNum(o.price != null ? o.price : o.lowPrice)), ...vars.flatMap(v => [].concat(v.offers || []).map(o => precioNum(o.price)))].filter(n => n > 0);
    const of0 = ofs[0] || {};
    const disp = [...ofs, ...vars.flatMap(v => [].concat(v.offers || []))].map(o => String(o.availability || ''));
    r = {
      nombre: entidades(p.name || ''), precio: precios.length ? Math.min(...precios) : 0, moneda: String(of0.priceCurrency || (ofs.find(o => o.priceCurrency) || {}).priceCurrency || '').toUpperCase(),
      imagen: absoluta(imagenDe(p.image), url), descripcion: p.description || '', sku: String(p.sku || p.mpn || '').slice(0, 60), marca: entidades(nombreDe(p.brand)).slice(0, 60),
      categoria: entidades(String(primero(p.category) || '')).split(/>|\/|,/).pop().trim().slice(0, 60),
      agotado: disp.length > 0 && disp.every(a => /OutOfStock|SoldOut|Discontinued/i.test(a)),
      variantes: vars.map(v => entidades(v.name || '')).filter(Boolean).slice(0, 20), url,
    };
  }
  const og = { nombre: meta(html, 'og:title'), imagen: meta(html, 'og:image') || meta(html, 'og:image:secure_url'), precio: precioNum(meta(html, 'product:price:amount') || meta(html, 'og:price:amount') || meta(html, 'price')), moneda: (meta(html, 'product:price:currency') || meta(html, 'og:price:currency') || meta(html, 'priceCurrency')).toUpperCase(), descripcion: meta(html, 'og:description') || meta(html, 'description') };
  if (!r) {
    if (!og.nombre || !(og.precio > 0 || /product/i.test(meta(html, 'og:type')))) return null;
    r = { nombre: og.nombre.replace(/\s*\|\s*[^|]{2,60}$/, ''), precio: og.precio, moneda: og.moneda, imagen: absoluta(og.imagen, url), descripcion: og.descripcion, sku: '', marca: meta(html, 'product:brand'), categoria: '', agotado: /out ?of ?stock|oos/i.test(meta(html, 'product:availability')), variantes: [], url };
  }
  if (!r.precio && og.precio) r.precio = og.precio;
  if (!r.imagen && og.imagen) r.imagen = absoluta(og.imagen, url);
  if (!r.descripcion && og.descripcion) r.descripcion = og.descripcion;
  if (!r.precio) { const m = String(html).match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i); if (m) r.precio = precioNum(m[1]); }
  if (!r.categoria) {           // migas de pan: Inicio > Maquillaje > Labiales > Producto → Labiales
    const bc = ld.find(o => tipoDe(o).includes('BreadcrumbList'));
    const ns = bc ? [].concat(bc.itemListElement || []).map(e => entidades(e.name || (e.item && e.item.name) || '')).filter(n => n && !/^(inicio|home|productos?|tienda|shop)$/i.test(n.trim())) : [];
    if (ns.length >= 2) r.categoria = ns[ns.length - 2].slice(0, 60);
  }
  return r.nombre ? r : null;
}
// Enlaces a productos en una página de listado
const PATRON_PRODUCTO = /\/(producto|productos|product|products|p|item|articulo|articulos|tienda\/producto)\/[^/?#]{3,}/i;
export function enlacesDeProductos(html, base) {
  const host = new URL(base).host, vistos = new Set(), out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    const u = absoluta(m[1], base); if (!u) continue;
    const x = new URL(u); if (x.host !== host) continue;
    if (!PATRON_PRODUCTO.test(x.pathname) || /\/(categoria|categorias|category|collections?|tag|page|pagina|search|buscar|cart|carrito|checkout|account|cuenta)(\/|$)/i.test(x.pathname.replace(PATRON_PRODUCTO, ''))) continue;
    if (/^\/productos?\/?$/i.test(x.pathname)) continue;
    x.search = ''; x.hash = ''; const k = x.toString().replace(/\/$/, '');
    if (!vistos.has(k)) { vistos.add(k); out.push(x.toString()); }
  }
  // listados con datos (ItemList de JSON-LD)
  jsonLd(html).filter(o => tipoDe(o).includes('ItemList')).forEach(l => [].concat(l.itemListElement || []).forEach(e => {
    const u = absoluta(e.url || (e.item && (e.item.url || e.item['@id'])) || '', base); if (!u) return; const k = u.replace(/[?#].*$/, '').replace(/\/$/, '');
    if (!vistos.has(k) && new URL(u).host === host) { vistos.add(k); out.push(u); }
  }));
  return out;
}
const siguientePagina = (html, base) => { const m = String(html).match(/<(?:link|a)\b[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i) || String(html).match(/<(?:link|a)\b[^>]*href=["']([^"']+)["'][^>]*rel=["']next["']/i); return m ? absoluta(m[1], base) : ''; };

/* ---------- lectores por plataforma ---------- */
function estadoAngular(html) {
  const m = String(html).match(/<script id="[^"]*-state" type="application\/json">([\s\S]*?)<\/script>/); if (!m) return null;
  try { return JSON.parse(m[1].replace(/&q;/g, '"').replace(/&s;/g, "'").replace(/&l;/g, '<').replace(/&g;/g, '>').replace(/&a;/g, '&')); } catch (e) { return null; }
}
export function detectar(html, url) {
  const h = String(html), st = estadoAngular(h);
  if (/tiendanegocio\.com/i.test(h) && st && st.websiteInfo && st.websiteInfo.id) return { plataforma: 'Tienda Negocio', commerceId: String(st.websiteInfo.id), estado: st };
  if (/cdn\.shopify\.com|Shopify\.theme|shopify-section/i.test(h)) return { plataforma: 'Shopify', moneda: ((h.match(/Shopify\.currency\s*=\s*\{"active":"([A-Z]{3})"/) || [])[1]) || '' };
  if (/woocommerce|wc-block|wp-content\/plugins\/woocommerce/i.test(h)) return { plataforma: 'WooCommerce' };
  if (/tiendanube|nuvemshop|d2r9epyceweg5n\.cloudfront\.net|mitiendanube\.com/i.test(h)) return { plataforma: 'Tiendanube' };
  if (/empretienda/i.test(h)) return { plataforma: 'Empretienda' };
  if (/vtex/i.test(h)) return { plataforma: 'VTEX' };
  return { plataforma: 'Página web' };
}

async function tiendaNegocio(ctx) {
  const { origen, det, leerJson, opts, avance, url } = ctx, cid = det.commerceId, out = [], porId = new Map();
  const hdr = { commerceid: cid, accept: 'application/json' };
  const cats = []; const rec = L => (L || []).forEach(x => { if (x && x.slug) cats.push({ titulo: x.title, slug: x.slug }); rec(x && x.children); });
  rec((det.estado.menuInfo || []).flatMap(m => m.children || []));
  const solo = (new URL(url).pathname.match(/^\/productos\/([\w-]+)\/?$/) || [])[1];
  const lista = async (ruta, cat) => {
    for (let off = 0; off < MAX_PRODUCTOS * 2; off += 100) {
      const j = await leerJson(`${origen}/api/v1/gift/${ruta}${ruta.includes('?') ? '&' : '?'}offset=${off}&limit=100&propertiesFilter=%7B%7D`, hdr);
      const g = (j && j.data && j.data.gifts) || [];
      for (const x of g) {
        let p = porId.get(x.id);
        if (!p) {
          if (porId.size >= MAX_PRODUCTOS) continue;
          const precio = Number(x.promo) > 0 && Number(x.promo) < Number(x.price) ? Number(x.promo) : Number(x.price);
          const img = x.thumbnail ? (/^https?:/.test(x.thumbnail) ? x.thumbnail : 'https://cdn.v2.tiendanegocio.com/' + String(x.thumbnail).replace(/^\//, '')) : '';
          p = { id: x.id, nombre: x.title || '', precio, moneda: 'ARS', imagen: img ? img.replace(/\?.*$/, '') + '?class=md' : '', sku: x.sku || '', marca: '', categoria: '', descripcion: '', agotado: x.stockAvailable === false || (x.stock != null && Number(x.stock) <= 0 && !x.isVariant), url: `${origen}/producto/${x.hash}`, hash: x.hash, variantes: [] };
          porId.set(x.id, p); out.push(p);
        }
        if (cat && !p.categoria) p.categoria = cat;
      }
      avance(`Leyendo el catálogo: ${out.length} productos…`);
      if (g.length < 100) return;
    }
  };
  if (solo) { const c = cats.find(x => x.slug === solo); await lista('category/' + solo, c ? c.titulo : ''); }
  else {
    await lista('keywords/');
    for (const c of cats) { if (out.every(p => p.categoria)) break; avance(`Ordenando por categoría: ${c.titulo}…`); await lista('category/' + c.slug, c.titulo); }
  }
  if (opts.descripciones) await detalles(ctx, out, async p => {
    const r = await ctx.leerTexto(p.url); const st = r && estadoAngular(r.cuerpo); const g = st && st['gift-gift'];
    if (g) { p.descripcion = g.description || g.descriptionBase || ''; if (!p.categoria && g.category_title) p.categoria = g.category_title; }
  });
  return out;
}

async function shopify(ctx) {
  const { origen, url, leerJson, det, avance } = ctx, out = [];
  const col = (new URL(url).pathname.match(/^\/collections\/([\w-]+)/) || [])[1];
  const base = col ? `${origen}/collections/${col}/products.json` : `${origen}/products.json`;
  for (let pag = 1; pag <= 10 && out.length < MAX_PRODUCTOS; pag++) {
    const j = await leerJson(`${base}?limit=250&page=${pag}`); const L = (j && j.products) || [];
    for (const x of L) {
      if (out.length >= MAX_PRODUCTOS) break;
      const vs = x.variants || [], precios = vs.map(v => precioNum(v.price)).filter(n => n > 0);
      out.push({ id: x.id, nombre: x.title || '', precio: precios.length ? Math.min(...precios) : 0, moneda: det.moneda || '', imagen: absoluta(((x.images || [])[0] || {}).src || '', origen), sku: (vs[0] && vs[0].sku) || '', marca: x.vendor || '', categoria: x.product_type || '', descripcion: x.body_html || '', agotado: vs.length > 0 && vs.every(v => v.available === false), url: `${origen}/products/${x.handle}`, variantes: vs.length > 1 ? vs.map(v => v.title).filter(t => t && !/default title/i.test(t)).slice(0, 20) : [] });
    }
    avance(`Leyendo el catálogo: ${out.length} productos…`);
    if (L.length < 250) break;
  }
  return out;
}

async function woo(ctx) {
  const { origen, leerJson, avance } = ctx, out = [];
  for (let pag = 1; pag <= 8 && out.length < MAX_PRODUCTOS; pag++) {
    const j = await leerJson(`${origen}/wp-json/wc/store/v1/products?per_page=100&page=${pag}`);
    if (!Array.isArray(j)) { if (pag === 1) return null; break; }
    for (const x of j) {
      if (out.length >= MAX_PRODUCTOS) break;
      const pr = x.prices || {}, d = Number(pr.currency_minor_unit) || 0, val = s => precioNum(s) / Math.pow(10, d);
      const precio = val(pr.sale_price) > 0 && val(pr.sale_price) < val(pr.regular_price) ? val(pr.sale_price) : val(pr.price);
      out.push({ id: x.id, nombre: entidades(x.name || ''), precio, moneda: pr.currency_code || '', imagen: ((x.images || [])[0] || {}).src || '', sku: x.sku || '', marca: ((x.brands || [])[0] || {}).name || '', categoria: entidades(((x.categories || [])[0] || {}).name || ''), descripcion: x.short_description || x.description || '', agotado: x.is_in_stock === false, url: x.permalink || '', variantes: [] });
    }
    avance(`Leyendo el catálogo: ${out.length} productos…`);
    if (j.length < 100) break;
  }
  return out;
}

// Cualquier web: productos de la página (JSON-LD), enlaces a productos (con "página siguiente") o el sitemap; después cada ficha.
async function generico(ctx) {
  const { url, origen, html, leerTexto, avance } = ctx;
  const enPagina = productoDePagina(html, url);
  let enlaces = enlacesDeProductos(html, url), pag = html, u = url;
  if (enPagina && (!enlaces.length || PATRON_PRODUCTO.test(new URL(url).pathname))) return [enPagina];   // es la ficha de un solo producto
  let hubo = false;
  for (let i = 0; i < 25 && enlaces.length < MAX_FICHAS; i++) {
    const sig = siguientePagina(pag, u); if (!sig || sig === u) break;
    hubo = true;
    const r = await leerTexto(sig); if (!r) break;
    u = sig; pag = r.cuerpo; const n0 = enlaces.length;
    enlacesDeProductos(pag, u).forEach(e => { if (!enlaces.includes(e)) enlaces.push(e); });
    avance(`Buscando productos: ${enlaces.length} encontrados…`);
    if (enlaces.length === n0) break;
  }
  // portada o listado general sin paginación visible: completamos con el mapa del sitio (sitemap)
  if (!enlaces.length || (!hubo && /^\/(productos?|tienda|shop|catalogo|store)?\/?$/i.test(new URL(url).pathname))) (await desdeSitemap(ctx)).forEach(e => { if (enlaces.length < MAX_FICHAS && !enlaces.some(x => x.replace(/\/$/, '') === e.replace(/\/$/, ''))) enlaces.push(e); });
  enlaces = enlaces.slice(0, MAX_FICHAS);
  if (!enlaces.length) return enPagina ? [enPagina] : [];
  const out = [];
  await detalles(ctx, enlaces, async e => { const r = await leerTexto(e); const p = r && productoDePagina(r.cuerpo, r.url || e); if (p) out.push(p); }, 'Leyendo las fichas');
  return out;
}
async function desdeSitemap(ctx) {
  const { origen, leerTexto, avance } = ctx; avance('Buscando el mapa del sitio…');
  let mapas = [];
  const rb = await leerTexto(origen + '/robots.txt'); if (rb) mapas = [...rb.cuerpo.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]);
  if (!mapas.length) mapas = [origen + '/sitemap.xml'];
  const urls = [], vistos = new Set();
  for (let i = 0; i < mapas.length && i < 8 && urls.length < MAX_FICHAS; i++) {
    if (vistos.has(mapas[i])) continue; vistos.add(mapas[i]);
    const r = await leerTexto(mapas[i]); if (!r) continue;
    const locs = [...r.cuerpo.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => entidades(m[1]));
    if (/<sitemapindex/i.test(r.cuerpo)) { locs.sort((a, b) => (/product/i.test(b) ? 1 : 0) - (/product/i.test(a) ? 1 : 0)).forEach(l => mapas.push(l)); continue; }
    locs.forEach(l => { try { if (PATRON_PRODUCTO.test(new URL(l).pathname) && urls.length < MAX_FICHAS) urls.push(l); } catch (e) { } });
  }
  return urls;
}
// Recorre de a 3, despacio, sin pasarse del máximo de páginas
async function detalles(ctx, lista, fn, texto = 'Leyendo las descripciones') {
  const cola = lista.slice(0, MAX_PAGINAS); let hechas = 0;
  const trabajar = async () => { while (cola.length && !ctx.cancelado()) { const x = cola.shift(); try { await fn(x); } catch (e) { ctx.fallas++; } hechas++; ctx.avance(`${texto}: ${hechas} de ${Math.min(lista.length, MAX_PAGINAS)}…`); await esperar(PAUSA); } };
  await Promise.all([trabajar(), trabajar(), trabajar()]);
}

/* ---------- punto de entrada ---------- */
// leer(url, extra) → {ok, status, url, ct, cuerpo, error}. opts: {descripciones, cancelado()}
export async function traerDeLaWeb(url, opts, leer, avance = () => { }) {
  url = String(url || '').trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let x; try { x = new URL(url); } catch (e) { throw new Error('Ese enlace no es válido. Copiá la dirección completa de la web del proveedor.'); }
  x.protocol = 'https:'; url = x.toString();
  const origen = x.origin; let corte = '';
  const cancelado = () => !!corte || !!(opts.cancelado && opts.cancelado());
  // si el servidor corta (límite por hora, sesión vencida), paramos y nos quedamos con lo leído
  const leerTexto = async (u, extra) => { if (cancelado()) return null; try { const r = await leer(u, extra ? { headers: extra } : {}); return r && r.ok ? r : null; } catch (e) { corte = e.message || 'Se cortó la lectura.'; return null; } };
  const leerJson = async (u, extra) => { const r = await leerTexto(u, extra || { accept: 'application/json' }); if (!r) return null; try { return JSON.parse(r.cuerpo); } catch (e) { return null; } };
  avance('Abriendo la web del proveedor…');
  const r0 = await leer(url, { inicio: true });
  if (!r0 || !r0.ok) throw new Error((r0 && r0.error) || 'No pudimos abrir esa página.');
  const det = detectar(r0.cuerpo, r0.url || url);
  const ctx = { url: r0.url || url, origen: new URL(r0.url || url).origin, html: r0.cuerpo, det, opts, leerTexto, leerJson, avance, cancelado, fallas: 0 };
  avance(`Reconocida como ${det.plataforma}. Leyendo productos…`);
  let prods = null;
  if (det.plataforma === 'Tienda Negocio') prods = await tiendaNegocio(ctx);
  else if (det.plataforma === 'Shopify') prods = await shopify(ctx);
  else if (det.plataforma === 'WooCommerce') prods = await woo(ctx);
  if (!prods || !prods.length) prods = await generico(ctx);
  return { plataforma: det.plataforma, host: x.host, productos: prods.filter(p => p && p.nombre), fallas: ctx.fallas, aviso: corte, cortado: prods.length >= MAX_PRODUCTOS || (!['Tienda Negocio', 'Shopify', 'WooCommerce'].includes(det.plataforma) && prods.length >= MAX_FICHAS) };
}

// Productos → filas para el importador (la primera fila son los encabezados que reconoce)
export const ENCABEZADOS = ['Handle', 'Nombre', 'Costo', 'Categoría', 'Marca', 'Código', 'Stock', 'Imagen', 'Descripción', 'Variante'];
export function aFilas(productos, o = {}) {
  const filas = [ENCABEZADOS.slice()];
  productos.forEach((p, i) => {
    const l = o.limpiar !== false ? limpiarNombre(p.nombre, p.marca) : { nombre: entidades(p.nombre).replace(/\s+/g, ' ').trim(), codigo: '' };
    const desc = o.descripciones ? limpiarDescripcion(p.descripcion) : '';
    const handle = 'w' + i;
    filas.push([handle, l.nombre.slice(0, 160), p.precio > 0 ? String(p.precio) : '', p.categoria || '', p.marca || '', (p.sku || l.codigo || '').slice(0, 60), o.agotados && p.agotado ? '0' : '', p.imagen || '', desc, '']);
    (p.variantes || []).slice(0, 20).forEach(v => filas.push([handle, '', '', '', '', '', '', '', '', v]));
  });
  return filas;
}

// Ficha de editar producto: foto y descripción desde el enlace de UNA página (de la marca o del proveedor) o de una foto.
export async function fichaDesdeEnlace(url, leer) {
  url = String(url || '').trim(); if (!url) throw new Error('Pegá el enlace de la página del producto o de la foto.');
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  const r = await leer(url, {});
  if (r && r.esImagen) return { imagen: r.url || url, descripcion: '', marca: '', nombre: '' };
  if (!r || !r.ok) throw new Error((r && r.error) || 'No pudimos abrir ese enlace.');
  const base = r.url || url, p = productoDePagina(r.cuerpo, base);
  const imagen = (p && p.imagen) || absoluta(meta(r.cuerpo, 'og:image') || meta(r.cuerpo, 'og:image:secure_url') || meta(r.cuerpo, 'twitter:image'), base);
  const descripcion = limpiarDescripcion((p && p.descripcion) || meta(r.cuerpo, 'og:description') || meta(r.cuerpo, 'description'), 1500);
  if (!imagen && !descripcion) throw new Error('No encontramos foto ni descripción en esa página. Probá con el enlace directo de la foto (mantené apretada la foto → Copiar dirección de la imagen).');
  return { imagen, descripcion, marca: (p && p.marca) || '', nombre: (p && p.nombre) || '' };
}
// Indicación para crear (o mejorar) la foto con una IA de imágenes, sin inventar el producto.
export function promptFoto(nombre, marca) {
  const n = limpiarNombre(nombre || '', marca || '').nombre || 'el producto';
  return `Foto de producto profesional de «${n}»${marca ? ` de la marca ${marca}` : ''} para una tienda online. Fondo blanco liso, luz de estudio suave y pareja, sombra natural apenas debajo, producto centrado y completo, nítido, formato cuadrado 1:1. Sin texto, sin precios, sin marcas de agua, sin manos ni personas.\nSi te adjunto una foto real del producto, mantené exactamente su forma, colores, etiqueta, tamaño y proporciones: solo mejorá el fondo, la luz y el encuadre. No inventes detalles que el producto no tiene.`;
}
