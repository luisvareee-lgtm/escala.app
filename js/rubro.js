// Herramientas según lo que vendés (v2.27). El rubro de la tienda (o, si quedó en "Otro", el que se deduce de sus
// productos) decide las palabras y los atajos de las variantes: talles en ropa, tonos en cosmética, sabores en almacén.
// Lo usan el panel y la tienda, así que no importa nada del panel.
// v2.33: la clave 'cosmetica' no cambia (tiendas existentes); solo el nombre que se muestra.
export const RUBROS = { cosmetica: 'Belleza y cuidado personal', indumentaria: 'Ropa y calzado', bijouterie: 'Accesorios y bijouterie', hogar: 'Hogar', electro: 'Electro', kiosco: 'Kiosco', alimentos: 'Almacén', mascotas: 'Mascotas / Pet shop', jugueteria: 'Juguetería y bebés', libreria: 'Librería y papelería', ferreteria: 'Ferretería y herramientas', construccion: 'Construcción y pisos', autopartes: 'Repuestos', gastronomia: 'Gastronomía', otro: 'Otro' };

// w: la palabra (singular / plural / artículo) · campo y ej: el campo de la ficha · talles: atajos XS…XXL y guía de talles
const VAR = {
  indumentaria: { w: ['talle', 'talles', 'el'], campo: 'Talles o colores', ej: 'Ej: S, M, L, XL · 38, 39, 40 · Negro, Blanco', talles: true },
  cosmetica: { w: ['tono', 'tonos', 'el'], campo: 'Tonos, colores o fragancias', ej: 'Ej: 01 Natural, 02 Beige, 03 Miel' },
  alimentos: { w: ['sabor', 'sabores', 'el'], campo: 'Sabores o presentaciones', ej: 'Ej: Chocolate, Vainilla, Frutilla · 500 g, 1 kg' },
  kiosco: { w: ['sabor', 'sabores', 'el'], campo: 'Sabores o variedades', ej: 'Ej: Chocolate, Dulce de leche, Frutilla' },
  gastronomia: { w: ['opción', 'opciones', 'la'], campo: 'Opciones o tamaños', ej: 'Ej: Simple, Doble · Chica, Grande' },
  hogar: { w: ['variante', 'variantes', 'la'], campo: 'Colores, modelos o medidas', ej: 'Ej: Blanco, Gris · 1,5 L, 2 L' },
  electro: { w: ['variante', 'variantes', 'la'], campo: 'Colores o modelos', ej: 'Ej: Negro, Blanco · 64 GB, 128 GB' },
  autopartes: { w: ['variante', 'variantes', 'la'], campo: 'Modelos o medidas', ej: 'Ej: Delantero, Trasero · 13", 14"' },
  ferreteria: { w: ['medida', 'medidas', 'la'], campo: 'Medidas o modelos', ej: 'Ej: 6 mm, 8 mm, 10 mm · 1/2", 3/4" · 220 V, inalámbrico' },
  construccion: { w: ['medida', 'medidas', 'la'], campo: 'Medidas, colores o terminaciones', ej: 'Ej: 60x60, 45x45 · Gris, Beige · Mate, Brillante' },
  libreria: { w: ['variante', 'variantes', 'la'], campo: 'Colores, rayados o tamaños', ej: 'Ej: Azul, Negro, Rojo · Rayado, Cuadriculado · A4, Oficio' },
  mascotas: { w: ['variante', 'variantes', 'la'], campo: 'Tamaños, sabores o pesos', ej: 'Ej: Cachorro, Adulto · Carne, Pollo · 3 kg, 15 kg' },
  jugueteria: { w: ['variante', 'variantes', 'la'], campo: 'Modelos, colores o edades', ej: 'Ej: Rosa, Celeste · 0-6 meses, 6-12 meses · RN, P, M, G' },
  bijouterie: { w: ['modelo', 'modelos', 'el'], campo: 'Colores, baños o largos', ej: 'Ej: Dorado, Plateado · Acero, Baño de oro · 45 cm, 50 cm' },
  otro: { w: ['variante', 'variantes', 'la'], campo: 'Variantes (talles, colores, modelos…)', ej: 'Ej: S, M, L · Rojo, Azul · 500 ml, 1 L', talles: true },
};
const sinTilde = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// S, M, XL, 2XL, Único, T.U., 0-3 m · o números de talle (16 a 52, con medio número)
const LETRA = /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-6]xl|unico|u|t\.?\s?u\.?|\d{1,2}\s?-\s?\d{1,2}\s?m(eses)?)$/;
const esNum = x => /^\d{2}([.,]5)?$/.test(x) && +x.replace(',', '.') >= 16 && +x.replace(',', '.') <= 52;
export const pareceTalle = vals => { const v = (vals || []).map(x => sinTilde(String(x).trim())).filter(Boolean); return v.length > 0 && v.every(x => LETRA.test(x) || esNum(x)); };

// Qué vende la tienda, según sus productos (categoría + nombre). Devuelve el rubro o null si no está claro.
const CLAVES = {
  cosmetica: 'maquillaje labial gloss rubor sombra corrector iluminador delineador pestan rimel ceja brocha mascarilla serum tonico skincare facial rostro perfume fragancia colonia esmalte unas shampoo acondicionador cosmet belleza bronceador protector solar acne crema makeup polvo compacto contorno primer fijador',
  indumentaria: 'remera buzo campera pantalon jean short bermuda calza vestido pollera camisa chomba musculosa sweater sueter medias ropa calzado zapatilla zapato bota ojota sandalia pijama conjunto lenceria corpino bombacha boxer jogging canguro',
  alimentos: 'almacen yerba aceite fideo arroz harina azucar galletita conserva cafe leche queso fiambre mermelada legumbre condimento especia cereal',
  kiosco: 'golosina alfajor chicle caramelo chocolate gaseosa bebida cigarrillo encendedor snack chupetin turron',
  hogar: 'bazar cocina sarten olla vaso taza plato cubierto sabana toalla almohada cortina organizador limpieza deco decoracion termo jarra mantel acolchado',
  electro: 'auricular cargador cable parlante celular funda smartwatch mouse teclado notebook tablet usb bluetooth lampara camara consola joystick electro gamer',
  autopartes: 'repuesto filtro bujia freno amortiguador correa embrague lubricante neumatico autoparte faro paragolpe escape',
  gastronomia: 'hamburguesa pizza empanada sandwich milanesa vianda postre torta picada lomito',
  ferreteria: 'ferreteria herramienta taladro destornillador atornillador martillo pinza tornillo tuerca bulon arandela clavo mecha amoladora sierra serrucho lija silicona candado bisagra cerradura llave',
  construccion: 'ceramica porcelanato piso revestimiento cemento ladrillo hierro durlock yeso membrana latex enduido sanitario griferia canilla azulejo pastina adhesivo cielorraso',
  libreria: 'libreria papeleria cuaderno lapiz lapicera birome boligrafo resaltador marcador regla carpeta resma cartulina mochila cartuchera abrochadora plasticola tempera crayon agenda',
  mascotas: 'mascota perro gato cachorro balanceado pretal sanitaria rascador comedero bebedero cucha antipulgas pipeta',
  jugueteria: 'juguete jugueteria muneca peluche rompecabezas puzzle lego pelota sonajero mordillo bebe chupete mamadera panal cochecito andador babero',
  bijouterie: 'bijou bijouterie aros collar pulsera anillo dije reloj lentes anteojos cartera billetera cinturon gorra hebilla broche vincha accesorio',
};
const RX = Object.fromEntries(Object.entries(CLAVES).map(([k, v]) => [k, new RegExp('\\b(' + v.split(' ').join('|') + ')', 'i')]));
export function inferirRubro(prods) {
  const L = (prods || []).filter(p => p && !(Array.isArray(p.combo) && p.combo.length)).slice(0, 400);
  if (L.length < 3) return null;
  const n = {};
  L.forEach(p => { const s = sinTilde((p.categoria || '') + ' ' + (p.nombre || '')); for (const k in RX) if (RX[k].test(s)) n[k] = (n[k] || 0) + 1; });
  const o = Object.entries(n).sort((a, b) => b[1] - a[1]);
  if (!o.length || o[0][1] < 3 || o[0][1] < L.length * 0.4 || (o[1] && o[1][1] * 1.5 > o[0][1])) return null;
  return o[0][0];
}
// el rubro con el que trabajan las herramientas: el elegido, o si quedó en "Otro", el que se deduce de los productos
export function rubroDe(t, prods) {
  const r = t && VAR[t.rubro] ? t.rubro : 'otro';
  return r !== 'otro' ? r : inferirRubro(prods) || 'otro';
}
export const varMeta = r => VAR[r] || VAR.otro;
// la palabra para las variantes de un producto: si lo escrito son talles (S, M, 38…) es "talle" (o "número"); si no, la del rubro
export function palabra(r, vals) {
  const m = varMeta(r), v = (vals || []).filter(x => String(x).trim()), propia = { w: m.w[0], ws: m.w[1], el: m.w[2] };
  const fija = ['cosmetica', 'alimentos', 'kiosco', 'gastronomia', 'ferreteria', 'construccion', 'mascotas', 'bijouterie'].includes(r);   // en estos rubros un número es un tono, un sabor o una medida
  if (!v.length) return propia;
  if (pareceTalle(v)) {
    if (!v.every(x => esNum(String(x).trim()))) return { w: 'talle', ws: 'talles', el: 'el' };   // S, M, L o Único: siempre talles
    return fija ? propia : { w: 'número', ws: 'números', el: 'el' };
  }
  return fija ? propia : { w: 'variante', ws: 'variantes', el: 'la' };   // colores, modelos… (también en una tienda de ropa)
}
// frases armadas: "el talle" / "la variante", "de cualquier talle", "los tonos" / "las opciones"
export const conArt = p => `${p.el} ${p.w}`;
export const losArt = p => `${p.el === 'la' ? 'las' : 'los'} ${p.ws}`;
export const ese = p => `${p.el === 'la' ? 'Esa' : 'Ese'} ${p.w}`;
export const del_ = p => p.el === 'la' ? `de la ${p.w}` : `del ${p.w}`;
// ¿la tienda trabaja con talles? (ropa, o productos con talles escritos): atajos XS…XXL y guía de talles
export const usaTalles = (r, prods) => r === 'indumentaria' || (prods || []).some(p => pareceTalle(p.variantes));
