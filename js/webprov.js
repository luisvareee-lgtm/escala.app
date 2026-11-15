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
  const malas = /(whats ?app|wsp|tel[eé]fono|celular|\b(?:llam|escrib)[ae]|consult[aáe]|\$\s?\d|\bars\b|precio|preço|price|mayorista|atacado|wholesale|minimo de compra|m[ií]nimo de compra|env[ií]os? a todo|frete|shipping|retiro en|retirada|https?:\/\/|www\.|@[a-z0-9_.]+|instagram|facebook|transferencia|mercado ?pago|cuotas|parcelas|pix\b|compre (?:no|na|em)|no paraguai)/i;
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
const absoluta = (u, base) => { if (!String(u || '').trim()) return ''; try { const x = new URL(entidades(String(u || '').trim()), base); if (x.protocol === 'http:') x.protocol = 'https:'; return x.protocol === 'https:' ? x.toString() : ''; } catch (e) { return ''; } };

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
export function productoDePagina(html, url, monedaDef = '') {
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
    if (!og.nombre || !(og.precio > 0 || /product/i.test(meta(html, 'og:type')))) return productoHeuristico(html, url, monedaDef);
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
  // si la página muestra el precio en dólares (U$) además del estructurado en reales o guaraníes, usamos el de dólares
  if (r.moneda !== 'USD') { const u = precioJuntoAlTitulo(html, monedaDef); if (u && u.moneda === 'USD') { r.precio = u.precio; r.moneda = 'USD'; } }
  if (!r.moneda && r.precio) { const u = precioJuntoAlTitulo(html, monedaDef); r.moneda = u ? u.moneda : monedaDef; }
  return r.nombre ? r : null;
}
// Enlaces a productos en una página de listado
const PATRON_PRODUCTO = /\/(producto|productos|produto|produtos|product|products|p|item|items|articulo|articulos|artigo|prod|dp|tienda\/producto)\/[^/?#]{3,}|\/\d+-[\w%-]{3,}\.html$|-p-?\d+(\.html)?$|[?&]id_product=\d+/i;
export function enlacesDeProductos(html, base) {
  const host = new URL(base).host, vistos = new Set(), out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    const u = absoluta(m[1], base); if (!u) continue;
    const x = new URL(u); if (x.host !== host) continue;
    if (!PATRON_PRODUCTO.test(x.pathname + x.search) || /\/(categoria|categorias|category|collections?|tag|page|pagina|search|buscar|busca|cart|carrito|carrinho|checkout|account|cuenta)(\/|$)/i.test(x.pathname.replace(PATRON_PRODUCTO, ''))) continue;
    if (/^\/produc?t[oa]s?\/?$/i.test(x.pathname)) continue;
    if (!/id_product=/.test(x.search)) x.search = ''; x.hash = ''; const k = x.toString().replace(/\/$/, '');
    if (!vistos.has(k)) { vistos.add(k); out.push(x.toString()); }
  }
  // listados con datos (ItemList de JSON-LD)
  jsonLd(html).filter(o => tipoDe(o).includes('ItemList')).forEach(l => [].concat(l.itemListElement || []).forEach(e => {
    const u = absoluta(e.url || (e.item && (e.item.url || e.item['@id'])) || '', base); if (!u) return; const k = u.replace(/[?#].*$/, '').replace(/\/$/, '');
    if (!vistos.has(k) && new URL(u).host === host) { vistos.add(k); out.push(u); }
  }));
  return out;
}
// Página siguiente de un listado: rel="next", ?page=N / ?p=N / ?pagina=N, o /page/N
const CLAVES_PAG = ['page', 'p', 'pagina', 'pg', 'paged', 'pag'];
export function siguientePagina(html, base) {
  const m = String(html).match(/<(?:link|a)\b[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i) || String(html).match(/<(?:link|a)\b[^>]*href=["']([^"']+)["'][^>]*rel=["']next["']/i);
  if (m) return absoluta(m[1], base);
  let b; try { b = new URL(base); } catch (e) { return ''; }
  const clave = CLAVES_PAG.find(k => b.searchParams.has(k)), n = clave ? Number(b.searchParams.get(clave)) || 1 : 1;
  const enRuta = b.pathname.match(/\/(?:page|pagina)\/(\d+)\/?$/), nr = enRuta ? Number(enRuta[1]) : 1;
  const raiz = b.pathname.replace(/\/(?:page|pagina)\/\d+\/?$/, '').replace(/\/$/, '');
  let otra = '';
  for (const a of String(html).matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    const u = absoluta(a[1], base); if (!u) continue; const x = new URL(u); if (x.host !== b.host) continue;
    const rp = x.pathname.match(/\/(?:page|pagina)\/(\d+)\/?$/);
    if (rp && Number(rp[1]) === nr + 1 && x.pathname.replace(/\/(?:page|pagina)\/\d+\/?$/, '').replace(/\/$/, '') === raiz) return u;
    const k = CLAVES_PAG.find(c => x.searchParams.has(c));
    if (k && Number(x.searchParams.get(k)) === n + 1) { if (x.pathname === b.pathname) return u; if (!otra) otra = u; }
  }
  return otra;
}

/* ---------- precios y monedas ---------- */
// Cada precio con su moneda: U$ / US$ / USD → USD · R$ → BRL · Gs / ₲ → PYG · € · ¥ · AR$ · "$" solo (depende del país)
const SIMBOLOS = [[/^(?:U\$S|U\$D|US\$|U\$|USD|u\$s)$/i, 'USD'], [/^R\$$/i, 'BRL'], [/^(?:Gs\.?|₲|G\$|PYG)$/i, 'PYG'], [/^(?:€|EUR)$/i, 'EUR'], [/^(?:¥|CNY|RMB|元)$/i, 'CNY'], [/^(?:ARS|AR\$)$/i, 'ARS'], [/^\$$/, '$']];
const RE_PRECIO = /(U\$S|U\$D|US\$|U\$|USD|u\$s|R\$|Gs\.?|₲|G\$|PYG|AR\$|ARS|EUR|€|CNY|RMB|¥|\$)\s?(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?![\d.,]*\d)/g;
export function preciosEnTexto(t) {
  const out = [];
  for (const m of String(t || '').matchAll(RE_PRECIO)) {
    const mon = (SIMBOLOS.find(([re]) => re.test(m[1])) || [])[1], valor = precioNum(m[2]);
    if (mon && valor > 0) out.push({ moneda: mon, valor, i: m.index });
  }
  return out;
}
// El precio de un producto: si hay en dólares lo preferimos ("U$ 1,00 = R$ 5,72" es la cotización, no un precio)
export function elegirPrecio(lista, monedaDef) {
  const L = lista.map(x => ({ ...x, moneda: x.moneda === '$' ? (monedaDef || 'ARS') : x.moneda })).filter(x => !(x.valor === 1 && x.moneda === 'USD'));
  const p = L.find(x => x.moneda === 'USD') || L[0];
  return p ? { precio: p.valor, moneda: p.moneda } : null;
}
// Cotizaciones que muestra la propia web: "U$ 1,00 = R$ 5,72" · "1 USD = 7.350 Gs"
export function tasasDelSitio(texto) {
  const t = String(texto || ''), out = {};
  const br = t.match(/(?:U\$S?|US\$|USD)\s?1(?:[.,]00)?\s*(?:=|:|→|-|\|)?\s*R\$\s?(\d+[.,]\d+)/i); if (br) out.BRL = precioNum(br[1]);
  const py = t.match(/(?:U\$S?|US\$|USD)\s?1(?:[.,]00)?\s*(?:=|:|→|-|\|)?\s*(?:Gs\.?|₲)\s?([\d.,]+)/i); if (py) out.PYG = precioNum(py[1]);
  return out;
}
// "$" a secas: en Paraguay suele ser dólar; en Argentina, pesos; en webs en inglés, dólar
export function monedaPorDefecto(url, lang) {
  const h = (() => { try { return new URL(url).hostname; } catch (e) { return ''; } })();
  if (/\.py$/.test(h) || /-py\b|py\./.test(h)) return 'USD';
  if (/\.br$/.test(h)) return 'BRL';
  if (/\.ar$/.test(h) || /^es-ar/i.test(lang)) return 'ARS';
  if (/^en/i.test(lang)) return 'USD';
  return 'ARS';
}

/* ---------- lectura de páginas con el navegador (DOM) ---------- */
const parsear = html => (typeof DOMParser !== 'undefined' ? new DOMParser().parseFromString(String(html || ''), 'text/html') : null);
const txt = el => (el && el.textContent ? el.textContent.replace(/\s+/g, ' ').trim() : '');
// texto con espacios entre elementos ("U$ 80,00</span><span>1 en stock" no debe leerse 80,001)
const textoDe = el => { const out = []; const rec = n => { for (const c of n.childNodes || []) { if (c.nodeType === 3) out.push(c.nodeValue); else if (c.nodeType === 1 && !/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i.test(c.tagName)) rec(c); } }; if (el) rec(el); return out.join(' ').replace(/\s+/g, ' ').trim(); };
const NO_PRODUCTO = /\/(cart|carts|carrito|carrinho|checkout|login|logout|register|registro|account|cuenta|minha-conta|mi-cuenta|my-account|wishlist|favoritos|contact|contacto|contato|blog|faq|ayuda|politica|politicas|terms|privacy|brand|brands|marca|marcas|search|busca|buscar|addtocart|compare|orcamento|presupuesto)(\/|$|\?)/i;
const FUERA = 'nav, header, footer, [role=navigation], .menu, .navbar, .breadcrumb, .breadcrumbs';
const sinRastreo = u => { try { const x = new URL(u); x.hash = ''; ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid', 'gclid', 'srsltid'].forEach(k => x.searchParams.delete(k)); return x.toString(); } catch (e) { return u; } };
const IMG_VACIA = /^data:|placeholder|loading|blank|spacer|pixel|lazy\.(gif|png|svg)|no[-_]?image|sem[-_]?imagem/i;
function fotoDeElemento(el, base) {
  const img = el && el.querySelector('img'); if (!img) return '';
  const cands = ['data-src', 'data-original', 'data-original-src', 'data-lazy', 'data-lazy-src', 'data-zoom-image', 'data-large_image', 'src'].map(a => img.getAttribute(a)).filter(Boolean);
  const ss = img.getAttribute('srcset') || img.getAttribute('data-srcset'); if (ss) cands.splice(cands.length - 1, 0, ss.split(',').map(x => x.trim().split(/\s+/)[0]).pop());
  const u = cands.find(c => !IMG_VACIA.test(c)); return u ? absoluta(u, base) : '';
}
const NOMBRE_MALO = /^(ver( m[aá]s| produto| producto| detalles?)?|comprar|agregar|adicionar|add to cart|carrinho|carrito|quick view|vista r[aá]pida|\+ ?imagem|nuevo|novo|new|oferta|sale)$/i;
function nombreDeTarjeta(card, anchors) {
  const L = [];
  card.querySelectorAll('h1, h2, h3, h4, h5, [class*=name], [class*=Name], [class*=title], [class*=Title], [class*=nome], [class*=titulo], [class*=nombre]').forEach(e => L.push(txt(e)));
  anchors.forEach(a => { L.push(a.getAttribute('title') || ''); L.push((a.getAttribute('aria-label') || '').replace(/^(ver|see|view)\s+/i, '')); });
  card.querySelectorAll('img[alt]').forEach(i => L.push(i.getAttribute('alt')));
  anchors.forEach(a => L.push(txt(a)));
  for (let n of L) {
    n = entidades(String(n || '')).replace(RE_PRECIO, ' ').replace(/\s+/g, ' ').trim();
    if (n.length >= 3 && n.length <= 200 && !NOMBRE_MALO.test(n) && /[A-Za-zÀ-ÿ一-鿿]/.test(n)) return n;
  }
  return '';
}
// Productos de una página de listado (categoría, búsqueda, portada) leyendo cada "tarjeta": foto + nombre + precio.
// No depende de la plataforma: sirve para PrestaShop, Magento, webs hechas a medida, etc.
export function tarjetasDeListado(html, base, monedaDef) {
  const doc = parsear(html); if (!doc) return [];
  const host = new URL(base).host, grupos = new Map();
  for (const a of doc.querySelectorAll('a[href]')) {
    const h = a.getAttribute('href') || ''; if (!h || h[0] === '#' || /^(javascript|mailto|tel|whatsapp|sms):/i.test(h)) continue;
    const u = absoluta(h, base); if (!u) continue; const x = new URL(u);
    if (x.host !== host || x.pathname === '/' || NO_PRODUCTO.test(x.pathname + x.search) || (a.closest && a.closest(FUERA))) continue;
    const k = sinRastreo(u); (grupos.get(k) || grupos.set(k, []).get(k)).push(a);
  }
  const pareceProducto = new Set([...grupos].filter(([k, as]) => PATRON_PRODUCTO.test(new URL(k).pathname + new URL(k).search) || as.some(a => a.querySelector('img') || (a.parentElement && a.parentElement.querySelector('img')))).map(([k]) => k));
  const distintos = el => { const s = new Set(); el.querySelectorAll('a[href]').forEach(a => { const u = absoluta(a.getAttribute('href') || '', base); if (u) { const k = sinRastreo(u); if (pareceProducto.has(k)) s.add(k); } }); return s.size; };
  const out = [], usadas = new Set();
  for (const k of pareceProducto) {
    const anchors = grupos.get(k); let card = anchors[0];
    while (card.parentElement && !/^(BODY|HTML|MAIN)$/i.test(card.parentElement.tagName) && distintos(card.parentElement) <= 1) card = card.parentElement;
    if (usadas.has(card)) continue; usadas.add(card);
    const texto = textoDe(card);
    let pr = elegirPrecio(preciosEnTexto(texto), monedaDef);
    if (!pr) { const attr = [...card.querySelectorAll('[data-price], [data-av-price], [data-product-price]')].map(e => e.getAttribute('data-price') || e.getAttribute('data-av-price') || e.getAttribute('data-product-price')).join(' '); pr = elegirPrecio(preciosEnTexto(attr), monedaDef); }
    if (!pr) continue;
    const nombre = nombreDeTarjeta(card, anchors); if (!nombre) continue;
    const marca = txt(card.querySelector('[class*=brand], [class*=Brand], [class*=marca], [class*=Marca], [class*=manufacturer]')).slice(0, 60);
    const ref = (txt(card.querySelector('[class*=ref], [class*=sku], [class*=Sku], [class*=codigo]')).match(/[A-Za-z]*-?\d[\w-]*/) || [''])[0];
    out.push({ nombre, precio: pr.precio, moneda: pr.moneda, imagen: fotoDeElemento(card, base), sku: ref.slice(0, 40), marca: marca === nombre ? '' : marca, categoria: '', descripcion: '', agotado: /agotad|sin stock|esgotad|indispon[ií]vel|out of stock|sold out|sem estoque|fuera de stock/i.test(texto), url: k, variantes: [] });
  }
  return out;
}
// Precio que está junto al título (h1) de una ficha
export function precioJuntoAlTitulo(html, monedaDef) {
  const doc = parsear(html); if (!doc) return null;
  let el = doc.querySelector('h1');
  for (let i = 0; el && i < 6; i++) {
    const p = elegirPrecio(preciosEnTexto(textoDe(el)), monedaDef); if (p) return p;
    el = el.parentElement;
  }
  return null;
}
// Ficha sin datos estructurados: título (h1) + precio cercano + foto principal
function productoHeuristico(html, url, monedaDef) {
  const doc = parsear(html); if (!doc) return null;
  const h1 = doc.querySelector('h1'); const nombre = txt(h1); if (!nombre || nombre.length < 3) return null;
  const pr = precioJuntoAlTitulo(html, monedaDef); if (!pr) return null;
  let cont = h1; for (let i = 0; cont && i < 5 && !cont.querySelector('img'); i++) cont = cont.parentElement;
  const imagen = absoluta(meta(html, 'og:image'), url) || fotoDeElemento(cont || doc, url);
  const ref = (txt(doc.querySelector('[class*=reference], [class*=ref], [class*=sku]')).match(/\d[\w-]*/) || [''])[0];
  return { nombre, precio: pr.precio, moneda: pr.moneda, imagen, descripcion: meta(html, 'og:description') || meta(html, 'description') || txt(doc.querySelector('[class*=description], [class*=descricao], [class*=descripcion], #description')).slice(0, 1500), sku: ref.slice(0, 40), marca: txt(doc.querySelector('[class*=brand], [class*=marca]')).slice(0, 60), categoria: '', agotado: false, variantes: [], url };
}

/* ---------- categorías y buscador de la web ---------- */
const RE_CAT = /\/(categoria|categorias|category|categories|categoria-premium|collections?|c|departamento|departamentos|rubro|rubros|linea|lineas|product-category|categoria-produto|categoria-producto|seccion|secciones|catalogo|catalog|departments?)\/|[?&](id_category|category_id|categoria|cat)=\d|controller=category/i;
export function categoriasDelSitio(html, base) {
  const doc = parsear(html); if (!doc) return [];
  const host = new URL(base).host, vistos = new Set(), out = [], menu = [];
  for (const a of doc.querySelectorAll('a[href]')) {
    const u = absoluta(a.getAttribute('href') || '', base); if (!u) continue; const x = new URL(u); if (x.host !== host || x.pathname === '/') continue;
    const k = sinRastreo(u).replace(/\/$/, ''), nombre = txt(a).replace(RE_PRECIO, '').trim();
    if (vistos.has(k) || !nombre || nombre.length > 60 || nombre.length < 2 || NO_PRODUCTO.test(x.pathname + x.search) || PATRON_PRODUCTO.test(x.pathname)) continue;
    if (RE_CAT.test(x.pathname + x.search)) { vistos.add(k); out.push({ nombre, url: u }); }
    else if (a.closest && a.closest('nav, [role=navigation], .menu, .navbar') && x.pathname.split('/').filter(Boolean).length <= 2 && !/(sobre|about|quienes|nosotros|equipe|equipo|team|sorteio|sorteo|local|onde|donde|envio|frete|pago|pagamento)/i.test(x.pathname)) menu.push({ nombre, url: u, k });
  }
  if (out.length < 3) menu.forEach(m => { if (!vistos.has(m.k)) { vistos.add(m.k); out.push({ nombre: m.nombre, url: m.url }); } });
  // subcategorías: la URL empieza con la de otra categoría
  const rutas = out.map(c => new URL(c.url).pathname.replace(/\/$/, ''));
  out.forEach((c, i) => { c.nivel = rutas.filter((r, j) => j !== i && r.length > 1 && rutas[i].startsWith(r + '/')).length; });
  return out.slice(0, 250);
}
export function buscadorDelSitio(html, base) {
  const doc = parsear(html); if (!doc) return null;
  const host = new URL(base).host;
  for (const f of doc.querySelectorAll('form')) {
    if (/post/i.test(f.getAttribute('method') || 'get')) continue;
    const inp = f.querySelector('input[type=search], input[name=s], input[name=q], input[name=search], input[name=search_query], input[name=busca], input[name=query], input[name=term], input[name=keyword], input[name=k]');
    if (!inp || !inp.getAttribute('name')) continue;
    const action = absoluta(f.getAttribute('action') || base, base); if (!action || new URL(action).host !== host) continue;
    const ocultos = [...f.querySelectorAll('input[type=hidden]')].map(i => [i.getAttribute('name'), i.getAttribute('value') || '']).filter(([n]) => n && !/token|csrf|nonce|_wp/i.test(n));
    return { action, param: inp.getAttribute('name'), ocultos };
  }
  return null;
}
export function urlBusqueda(b, termino) { const x = new URL(b.action); b.ocultos.forEach(([k, v]) => x.searchParams.set(k, v)); x.searchParams.set(b.param, String(termino || '').trim()); return x.toString(); }

/* ---------- idioma ---------- */
export const langDe = html => ((String(html).match(/<html[^>]*\blang=["']?([\w-]+)/i) || [])[1] || '').toLowerCase();
export function alternativaEs(html, base) {
  for (const m of String(html).matchAll(/<link\b[^>]*>/gi)) {
    const t = m[0]; if (!/rel=["']?alternate/i.test(t)) continue;
    const hl = (t.match(/hreflang=["']?([\w-]+)/i) || [])[1] || ''; if (!/^es\b/i.test(hl)) continue;
    const h = (t.match(/href=["']([^"']+)["']/i) || [])[1]; const u = h && absoluta(h, base); if (u) return u;
  }
  return '';
}
const PAL = {
  es: new Set('con sin y el la los las del una negro blanca blanco cabello mujer hombre juego unidad unidades para crema rojo azul verde'.split(' ')),
  pt: new Set('com sem e do da dos das um uma não preto preta branco cabelo feminino masculino unidade unidades cor vermelho azul verde creme para'.split(' ')),
  en: new Set('the with and of for black white hair women men woman man pack red blue green cream body face'.split(' ')),
};
export function idiomaDe(textos, lang = '') {
  const t = textos.join(' \n ').toLowerCase().slice(0, 30000); if (!t.trim()) return /^(pt|en|zh)/.test(lang) ? lang.slice(0, 2) : 'es';
  if ((t.match(/[一-鿿]/g) || []).length > t.replace(/\s/g, '').length * 0.08) return 'zh';
  const sc = { es: 0, pt: 0, en: 0 };
  for (const w of t.match(/[a-záéíóúâêôãõçñü]+/g) || []) for (const l in sc) if (PAL[l].has(w) && !(PAL.es.has(w) && PAL.pt.has(w))) sc[l]++;
  sc.pt += ((t.match(/ção|ções|ões|ã|õ|ç/g) || []).length) * 2; sc.es += ((t.match(/ñ|¿|¡|ción\b|ciones\b/g) || []).length) * 2;
  const pl = (lang || '').slice(0, 2); if (sc[pl] != null) sc[pl] += 5 + (sc.es + sc.pt + sc.en) * 0.3;
  const mejor = Object.entries(sc).sort((a, b) => b[1] - a[1])[0];
  return mejor[1] >= 3 ? mejor[0] : (sc[pl] != null ? pl : 'es');
}
export const NOMBRE_IDIOMA = { es: 'español', pt: 'portugués', en: 'inglés', zh: 'chino' };


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

// Cualquier web. Un listado (categoría, búsqueda, "Productos"): leemos las tarjetas de cada página (foto + nombre + precio)
// y seguimos "página siguiente". Si el listado no trae precios, abrimos cada ficha (JSON-LD, Open Graph o título + precio).
async function listado(ctx, url, etiqueta, acum) {
  const { leerTexto, avance, monedaDef } = ctx;
  const porUrl = new Map(acum.map(p => [p.url, p])), fichas = [];
  let u = url, html = url === ctx.url ? ctx.html : null;
  for (let pag = 0; pag < 60 && !ctx.cancelado() && porUrl.size < MAX_PRODUCTOS; pag++) {
    if (html == null) { const r = await leerTexto(u); if (!r) break; html = r.cuerpo; u = r.url || u; Object.assign(ctx.tasas, tasasDelSitio(textoPlano(html).slice(0, 20000))); }
    const n0 = porUrl.size + fichas.length;
    const ts = tarjetasDeListado(html, u, monedaDef);
    ts.forEach(p => { if (!porUrl.has(p.url) && porUrl.size < MAX_PRODUCTOS) { if (!p.categoria && etiqueta) p.categoria = etiqueta; porUrl.set(p.url, p); acum.push(p); } });
    if (!ts.length) enlacesDeProductos(html, u).forEach(e => { if (!porUrl.has(e) && !fichas.some(f => f.url === e) && fichas.length < MAX_FICHAS) fichas.push({ url: e, etiqueta }); });
    avance(`Buscando productos${etiqueta ? ' en ' + etiqueta : ''}: ${porUrl.size + fichas.length} encontrados…`);
    ctx.parcial(acum);
    const sig = siguientePagina(html, u);
    if (!sig || sig === u || porUrl.size + fichas.length === n0) break;
    u = sig; html = null; await esperar(PAUSA);
  }
  return fichas;
}
async function leerFichas(ctx, fichas, acum) {
  const previos = ctx.opts.previos || new Map();
  await detalles(ctx, fichas, async f => {
    const prev = previos.get(f.url);
    if (prev) { acum.push(prev); return; }
    const r = await ctx.leerTexto(f.url); const p = r && productoDePagina(r.cuerpo, r.url || f.url, ctx.monedaDef);
    if (p) { p.url = f.url; if (!p.categoria && f.etiqueta) p.categoria = f.etiqueta; acum.push(p); if (acum.length % 10 === 0) ctx.parcial(acum); }
  }, 'Leyendo las fichas');
}
async function generico(ctx) {
  const { url, html } = ctx, acum = [];
  if (ctx.opts.urls && ctx.opts.urls.length) {                  // categorías o búsquedas elegidas
    let fichas = [];
    for (const c of ctx.opts.urls) { if (ctx.cancelado() || acum.length >= MAX_PRODUCTOS) break; fichas = fichas.concat(await listado(ctx, c.url, c.nombre || '', acum)); }
    await leerFichas(ctx, fichas.slice(0, MAX_FICHAS), acum);
    return acum;
  }
  const enPagina = productoDePagina(html, url, ctx.monedaDef);
  if (enPagina && PATRON_PRODUCTO.test(new URL(url).pathname + new URL(url).search)) return [enPagina];   // es la ficha de un solo producto
  const raiz = /^\/(productos?|produtos?|tienda|loja|shop|store|catalogo|inicio|home|index\.php)?\/?$/i.test(new URL(url).pathname) && !new URL(url).search;
  if (raiz && !ctx.opts.todo) {                                  // portada: que el comercio elija qué categorías leer
    const categorias = categoriasDelSitio(html, url);
    if (categorias.length >= 3) return { elegir: true, categorias, buscador: buscadorDelSitio(html, url) };
  }
  let fichas = await listado(ctx, url, '', acum);
  if (raiz && acum.length + fichas.length < 40) {                 // portada sin listado completo: el mapa del sitio
    (await desdeSitemap(ctx)).forEach(e => { if (fichas.length < MAX_FICHAS && !fichas.some(f => f.url === e) && !acum.some(p => p.url === e)) fichas.push({ url: e, etiqueta: '' }); });
  }
  await leerFichas(ctx, fichas.slice(0, MAX_FICHAS), acum);
  if (!acum.length && enPagina) acum.push(enPagina);
  return acum;
}
async function desdeSitemap(ctx) {
  const { origen, leerTexto, avance } = ctx; avance('Buscando el mapa del sitio…');
  let mapas = [];
  const rb = await leerTexto(origen + '/robots.txt'); if (rb) mapas = [...rb.cuerpo.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]).filter(m => { try { return new URL(m).host === new URL(origen).host; } catch (e) { return false; } });
  if (!mapas.length) mapas = [origen + '/sitemap.xml'];
  const urls = [], vistos = new Set();
  for (let i = 0; i < mapas.length && i < 8 && urls.length < MAX_FICHAS; i++) {
    if (vistos.has(mapas[i])) continue; vistos.add(mapas[i]);
    const r = await leerTexto(mapas[i]); if (!r) continue;
    const locs = [...r.cuerpo.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => entidades(m[1]));
    if (/<sitemapindex/i.test(r.cuerpo)) { locs.sort((a, b) => (/product|produto|producto|[^s]items?[-_.]/i.test(b) ? 1 : 0) - (/product|produto|producto|[^s]items?[-_.]/i.test(a) ? 1 : 0)).forEach(l => mapas.push(l)); continue; }
    locs.forEach(l => { try { const x = new URL(l); if (PATRON_PRODUCTO.test(x.pathname + x.search) && urls.length < MAX_FICHAS) urls.push(l); } catch (e) { } });
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
// leer(url, extra) → {ok, status, url, ct, cuerpo, error}
// opts: {descripciones, cancelado(), urls:[{url, nombre}] (categorías o búsquedas elegidas), todo (leer toda la web),
//        previos: Map(url → producto) para retomar una lectura cortada, parcial(productos) para ir guardando}
// Devuelve {elegir, categorias, buscador} (portada: hay que elegir qué leer) o {productos, …}
export async function traerDeLaWeb(url, opts, leer, avance = () => { }) {
  url = String(url || '').trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let x; try { x = new URL(url); } catch (e) { throw new Error('Ese enlace no es válido. Copiá la dirección completa de la web del proveedor.'); }
  x.protocol = 'https:'; url = x.toString();
  let corte = '';
  const cancelado = () => !!corte || !!(opts.cancelado && opts.cancelado());
  // si el servidor corta (límite por hora, sesión vencida), paramos y nos quedamos con lo leído
  const leerTexto = async (u, extra) => { if (cancelado()) return null; try { const r = await leer(u, extra ? { headers: extra } : {}); return r && r.ok ? r : null; } catch (e) { corte = e.message || 'Se cortó la lectura.'; return null; } };
  const leerJson = async (u, extra) => { const r = await leerTexto(u, extra || { accept: 'application/json' }); if (!r) return null; try { return JSON.parse(r.cuerpo); } catch (e) { return null; } };
  avance('Abriendo la web del proveedor…');
  let r0 = await leer(url, { inicio: true });
  if (!r0 || !r0.ok) { const e = new Error((r0 && r0.error) || 'No pudimos abrir esa página.'); e.bloqueado = !!(r0 && r0.bloqueado); throw e; }
  let base = r0.url || url, enEspanol = false;
  // ¿la web tiene versión en español? (hreflang="es…") → la usamos y no hace falta traducir
  if (!/^es/.test(langDe(r0.cuerpo)) && opts.preferirEs !== false && !(opts.urls && opts.urls.length)) {
    const alt = alternativaEs(r0.cuerpo, base);
    if (alt && alt.replace(/\/$/, '') !== base.replace(/\/$/, '')) { const r1 = await leerTexto(alt); if (r1) { r0 = r1; base = r1.url || alt; enEspanol = true; } }
  }
  const lang = langDe(r0.cuerpo), det = detectar(r0.cuerpo, base);
  const ctx = { url: base, origen: new URL(base).origin, html: r0.cuerpo, det, opts, leerTexto, leerJson, avance, cancelado, fallas: 0, monedaDef: opts.moneda || monedaPorDefecto(base, lang), tasas: tasasDelSitio(textoPlano(r0.cuerpo).slice(0, 20000)), parcial: opts.parcial || (() => { }) };
  avance(`Reconocida como ${det.plataforma}. Leyendo productos…`);
  let prods = null;
  if (det.plataforma === 'Tienda Negocio') prods = await tiendaNegocio(ctx);
  else if (det.plataforma === 'Shopify') prods = await shopify(ctx);
  else if (det.plataforma === 'WooCommerce') prods = await woo(ctx);
  if (!prods || !prods.length) prods = await generico(ctx);
  const comun = { plataforma: det.plataforma, host: new URL(base).host, url: base, lang, enEspanol, monedaDef: ctx.monedaDef, tasasSitio: ctx.tasas, titulo: tituloDe(r0.cuerpo) };
  if (prods && prods.elegir) return { ...comun, elegir: true, categorias: prods.categorias, buscador: prods.buscador };
  prods = prods.filter(p => p && p.nombre);
  prods.forEach(p => { if (!p.moneda) p.moneda = ctx.monedaDef; });
  if (opts.descripciones && !['Tienda Negocio', 'Shopify', 'WooCommerce'].includes(det.plataforma)) {   // las tarjetas no traen descripción
    const faltan = prods.filter(p => !p.descripcion && p.url);
    await detalles(ctx, faltan, async p => { const r = await leerTexto(p.url); const f = r && productoDePagina(r.cuerpo, r.url || p.url, ctx.monedaDef); if (f) { p.descripcion = f.descripcion || ''; if (!p.imagen) p.imagen = f.imagen; if (!p.marca) p.marca = f.marca; if (!p.categoria) p.categoria = f.categoria; } });
  }
  const idioma = enEspanol ? 'es' : idiomaDe(prods.slice(0, 200).map(p => p.nombre + ' ' + (p.categoria || '')), lang);
  return { ...comun, productos: prods, idioma, fallas: ctx.fallas, aviso: corte, incompleta: cancelado(), cortado: prods.length >= MAX_PRODUCTOS || (!['Tienda Negocio', 'Shopify', 'WooCommerce'].includes(det.plataforma) && prods.length >= MAX_FICHAS) };
}

export const tituloDe = html => entidades(((String(html || '').match(/<title[^>]*>([^<]*)/i) || [])[1] || '').replace(/\s+/g, ' ').trim()).slice(0, 90);

/* ---------- copiar y pegar la página (para webs que no dejan leerse desde el servidor) ---------- */
// Lo que el comercio copia de su navegador (Ctrl+A, Ctrl+C) llega como HTML con las fotos y los enlaces de cada producto.
const BASURA = /^(ver( m[aá]s| produto| producto| detalles?)?|comprar|agregar( al carrito)?|adicionar|add to cart|carrinho|carrito|orçamento|presupuesto|informações|información|quick view|vista r[aá]pida|in stock|en stock|em estoque|agotado|esgotado|sold out|nuevo|novo|new|oferta|sale|\d+|ref\.? ?\w+|c[oó]d\.? ?\w+)$/i;
function hostMasComun(html) {
  const n = new Map();
  for (const m of String(html || '').matchAll(/(?:href|src)=["'](https?:\/\/[^"'/]+)/gi)) { const h = m[1].toLowerCase(); n.set(h, (n.get(h) || 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1]).map(x => x[0]).find(h => !/(google|facebook|whatsapp|wa\.me|instagram|cloudflare|gstatic|jsdelivr|youtube|tiktok)/i.test(h)) || '';
}
// Texto sin enlaces (algunas webs no copian el HTML): nombre en un renglón y precio en el mismo o en el siguiente.
export function productosDeTexto(texto, monedaDef) {
  const out = [], vistos = new Set(); let nombre = '';
  for (const l0 of String(texto || '').split(/\r?\n/)) {
    const l = l0.replace(/\s+/g, ' ').trim(); if (!l) continue;
    if (/cota[çc][aã]o|cotizaci[oó]n|tipo de cambio|d[oó]lar hoy/i.test(l) || Object.keys(tasasDelSitio(l)).length) { nombre = ''; continue; }   // la cotización no es un producto
    const pr = elegirPrecio(preciosEnTexto(l), monedaDef);
    const resto = l.replace(RE_PRECIO, ' ').replace(/\s+/g, ' ').trim();
    if (pr) {
      const n = resto.length >= 4 && /[A-Za-zÀ-ÿ]/.test(resto) && !BASURA.test(resto) ? resto : nombre;
      if (n && !vistos.has(n.toLowerCase())) { vistos.add(n.toLowerCase()); out.push({ nombre: n.slice(0, 200), precio: pr.precio, moneda: pr.moneda, imagen: '', sku: '', marca: '', categoria: '', descripcion: '', agotado: false, url: '', variantes: [] }); }
      nombre = '';
    } else if (l.length >= 4 && l.length <= 200 && /[A-Za-zÀ-ÿ一-鿿]/.test(l) && !BASURA.test(l)) nombre = l;
  }
  return out;
}
// → {host, base, productos, tasas, idioma, como: 'tarjetas' | 'texto'}
export function productosDePegado(html, texto, urlSugerida) {
  let base = '';
  try { if (urlSugerida) { let u = String(urlSugerida).trim(); if (!/^https?:\/\//i.test(u)) u = 'https://' + u; base = new URL(u).toString(); } } catch (e) { base = ''; }
  const hm = hostMasComun(html);
  if (hm) base = hm + '/';                     // los enlaces copiados ya vienen completos: mandan ellos
  if (!base) base = 'https://pegado.local/';
  const host = new URL(base).host, lang = langDe(html);
  const plano = texto || textoPlano(html);
  const monedaDef = monedaPorDefecto(base, lang);
  let productos = html ? tarjetasDeListado(html, base, monedaDef) : [], como = 'tarjetas';
  if (!productos.length) { productos = productosDeTexto(plano, monedaDef); como = 'texto'; }
  productos.forEach(p => { if (!p.moneda) p.moneda = monedaDef; });
  const idioma = idiomaDe(productos.slice(0, 200).map(p => p.nombre + ' ' + (p.categoria || '')), lang);
  return { host: host === 'pegado.local' ? 'página pegada' : host, base, productos, tasas: tasasDelSitio(plano.slice(0, 20000)), idioma, como, monedaDef };
}

// Precios a la moneda de la tabla. tasas = unidades por dólar ({BRL: 5.7, PYG: 7300, …}); cot = pesos por dólar.
export function enMoneda(p, destino, tasas, cot) {
  const v = Number(p.precio) || 0; if (!(v > 0)) return 0;
  const m = (p.moneda || '').toUpperCase() || destino;
  if (m === destino) return v;
  const usd = m === 'USD' ? v : m === 'ARS' ? (cot > 0 ? v / cot : 0) : (tasas && tasas[m] > 0 ? v / tasas[m] : 0);
  if (!(usd > 0)) return 0;
  return destino === 'USD' ? Math.round(usd * 100) / 100 : Math.round(usd * (cot || 1));
}

// Productos → filas para el importador (la primera fila son los encabezados que reconoce)
export const ENCABEZADOS = ['Handle', 'Nombre', 'Costo', 'Categoría', 'Marca', 'Código', 'Stock', 'Imagen', 'Descripción', 'Variante'];
export function aFilas(productos, o = {}) {
  const filas = [ENCABEZADOS.slice()];
  productos.forEach((p, i) => {
    // nombre traducido (si lo hay) ya viene ordenado; el código del proveedor queda como SKU
    const l = p.nombreEs ? { nombre: p.nombreEs, codigo: p.codigo || '' } : o.limpiar !== false ? limpiarNombre(p.nombre, p.marca) : { nombre: entidades(p.nombre).replace(/\s+/g, ' ').trim(), codigo: '' };
    const desc = o.descripciones ? limpiarDescripcion(p.descripcionEs || p.descripcion) : '';
    const handle = 'w' + i, precio = o.precio ? o.precio(p) : p.precio;
    filas.push([handle, l.nombre.slice(0, 160), precio > 0 ? String(precio) : '', p.categoriaEs || p.categoria || '', p.marca || '', (p.sku || l.codigo || '').slice(0, 60), o.agotados && p.agotado ? '0' : '', p.imagen || '', desc, '']);
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

/* ---------- traducción (portugués, inglés, chino… → español) ---------- */
const capital = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// traducir(textos[], de) → textos[] traducidos (lo hace el servidor). De a 40 por vez; si algo falla, queda el original.
export async function traducirLista(textos, de, traducir, avance = () => { }, etiqueta = 'Traduciendo') {
  const unicos = [...new Set(textos.filter(t => t && String(t).trim()))], mapa = new Map();
  for (let i = 0; i < unicos.length; i += 40) {
    const lote = unicos.slice(i, i + 40);
    avance(`${etiqueta}: ${Math.min(i + 40, unicos.length)} de ${unicos.length}…`);
    const r = await traducir(lote, de);
    lote.forEach((t, k) => { const v = r && r[k] && String(r[k]).trim(); if (v) mapa.set(t, v); });
  }
  return mapa;
}
export async function traducirProductos(prods, de, traducir, o = {}, avance = () => { }) {
  const base = prods.map(p => {
    const l = limpiarNombre(p.nombre, p.marca); let resto = l.nombre, marca = '';
    if (p.marca && resto.toLowerCase().startsWith(p.marca.toLowerCase() + ' ')) { marca = resto.slice(0, p.marca.length); resto = resto.slice(p.marca.length + 1); }
    return { p, l, marca, resto: capital(resto) };
  });
  const nom = await traducirLista(base.map(b => b.resto), de, traducir, avance, 'Traduciendo los nombres');
  const cats = await traducirLista(prods.map(p => p.categoria), de, traducir, avance, 'Traduciendo las categorías');
  const descs = o.descripciones ? await traducirLista(prods.map(p => limpiarDescripcion(p.descripcion, 500)), de, traducir, avance, 'Traduciendo las descripciones') : new Map();
  base.forEach(({ p, l, marca, resto }) => {
    const t = nom.get(resto);
    if (t) { p.nombreEs = capital(((marca ? marca + ' ' : '') + t).replace(/\s+/g, ' ').trim()).slice(0, 160); p.codigo = l.codigo; }
    if (p.categoria && cats.get(p.categoria)) p.categoriaEs = capital(cats.get(p.categoria)).slice(0, 60);
    const d = descs.get(limpiarDescripcion(p.descripcion, 500)); if (d) p.descripcionEs = d;
  });
  return prods.filter(p => p.nombreEs).length;
}
