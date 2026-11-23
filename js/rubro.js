// Herramientas según lo que vendés (v2.27). El rubro de la tienda (o, si quedó en "Otro", el que se deduce de sus
// productos) decide las palabras y los atajos de las variantes: talles en ropa, tonos en cosmética, sabores en almacén.
// Lo usan el panel y la tienda, así que no importa nada del panel.
// v2.33: la clave 'cosmetica' no cambia (tiendas existentes); solo el nombre que se muestra.
export const RUBROS = { cosmetica: 'Belleza y cuidado personal', perfumeria: 'Perfumería', indumentaria: 'Ropa y calzado', bijouterie: 'Accesorios y bijouterie', hogar: 'Hogar', electro: 'Electro', kiosco: 'Kiosco', alimentos: 'Almacén', mascotas: 'Mascotas / Pet shop', jugueteria: 'Juguetería y bebés', libreria: 'Librería y papelería', ferreteria: 'Ferretería y herramientas', construccion: 'Construcción y pisos', autopartes: 'Repuestos', gastronomia: 'Gastronomía', otro: 'Otro' };

// w: la palabra (singular / plural / artículo) · campo y ej: el campo de la ficha · talles: atajos XS…XXL y guía de talles
// a (v2.33.2): atajos de la ficha para ese rubro [texto del botón, valores] (se suman a lo que ya está escrito)
const VAR = {
  perfumeria: { w: ['tamaño', 'tamaños', 'el'], campo: 'Tamaños o versiones', ej: 'Ej: 50 ml, 100 ml · EDP, EDT · Tester', a: [['30 · 50 · 100 ml', ['30 ml', '50 ml', '100 ml']], ['EDP · EDT · Parfum', ['EDP', 'EDT', 'Parfum']], ['Decant 5 · 10 ml', ['Decant 5 ml', 'Decant 10 ml']], ['Sellado · Tester', ['Sellado', 'Tester']]] },
  indumentaria: { w: ['talle', 'talles', 'el'], campo: 'Talles o colores', ej: 'Ej: S, M, L, XL · 38, 39, 40 · Negro, Blanco', talles: true },
  cosmetica: { w: ['tono', 'tonos', 'el'], campo: 'Tonos, colores o fragancias', ej: 'Ej: 01 Natural, 02 Beige, 03 Miel' , a: [['Tonos 01 al 05', ['01', '02', '03', '04', '05']], ['Claro · Medio · Oscuro', ['Claro', 'Medio', 'Oscuro']], ['Piel seca · mixta · grasa', ['Piel seca', 'Piel mixta', 'Piel grasa']]] },
  alimentos: { w: ['sabor', 'sabores', 'el'], campo: 'Sabores o presentaciones', ej: 'Ej: Chocolate, Vainilla, Frutilla · 500 g, 1 kg' , a: [['250 g · 500 g · 1 kg', ['250 g', '500 g', '1 kg']], ['Chico · Mediano · Grande', ['Chico', 'Mediano', 'Grande']]] },
  kiosco: { w: ['sabor', 'sabores', 'el'], campo: 'Sabores o variedades', ej: 'Ej: Chocolate, Dulce de leche, Frutilla' , a: [['Chocolate · Dulce de leche · Frutilla', ['Chocolate', 'Dulce de leche', 'Frutilla']], ['Común · Sin azúcar', ['Común', 'Sin azúcar']]] },
  gastronomia: { w: ['opción', 'opciones', 'la'], campo: 'Opciones o tamaños', ej: 'Ej: Simple, Doble · Chica, Grande' , a: [['Chica · Mediana · Grande', ['Chica', 'Mediana', 'Grande']], ['Simple · Doble · Triple', ['Simple', 'Doble', 'Triple']]] },
  hogar: { w: ['variante', 'variantes', 'la'], campo: 'Colores, modelos o medidas', ej: 'Ej: Blanco, Gris · 1,5 L, 2 L' , a: [['Blanco · Negro · Gris', ['Blanco', 'Negro', 'Gris']], ['Chico · Mediano · Grande', ['Chico', 'Mediano', 'Grande']]] },
  electro: { w: ['variante', 'variantes', 'la'], campo: 'Colores o modelos', ej: 'Ej: Negro, Blanco · 64 GB, 128 GB' , a: [['Negro · Blanco', ['Negro', 'Blanco']], ['64 · 128 · 256 GB', ['64 GB', '128 GB', '256 GB']]] },
  autopartes: { w: ['variante', 'variantes', 'la'], campo: 'Modelos o medidas', ej: 'Ej: Delantero, Trasero · 13", 14"' , a: [['Delantero · Trasero', ['Delantero', 'Trasero']], ['Izquierdo · Derecho', ['Izquierdo', 'Derecho']]] },
  ferreteria: { w: ['medida', 'medidas', 'la'], campo: 'Medidas o modelos', ej: 'Ej: 6 mm, 8 mm, 10 mm · 1/2", 3/4" · 220 V, inalámbrico' , a: [['6 · 8 · 10 mm', ['6 mm', '8 mm', '10 mm']], ['1/2" · 3/4" · 1"', ['1/2"', '3/4"', '1"']], ['Con cable · Inalámbrico', ['Con cable', 'Inalámbrico']]] },
  construccion: { w: ['medida', 'medidas', 'la'], campo: 'Medidas, colores o terminaciones', ej: 'Ej: 60x60, 45x45 · Gris, Beige · Mate, Brillante' , a: [['30x30 · 45x45 · 60x60', ['30x30', '45x45', '60x60']], ['Mate · Brillante', ['Mate', 'Brillante']], ['Blanco · Gris · Beige', ['Blanco', 'Gris', 'Beige']]] },
  libreria: { w: ['variante', 'variantes', 'la'], campo: 'Colores, rayados o tamaños', ej: 'Ej: Azul, Negro, Rojo · Rayado, Cuadriculado · A4, Oficio' , a: [['Rayado · Cuadriculado · Liso', ['Rayado', 'Cuadriculado', 'Liso']], ['A4 · A5 · Oficio', ['A4', 'A5', 'Oficio']], ['Azul · Negro · Rojo', ['Azul', 'Negro', 'Rojo']]] },
  mascotas: { w: ['variante', 'variantes', 'la'], campo: 'Tamaños, sabores o pesos', ej: 'Ej: Cachorro, Adulto · Carne, Pollo · 3 kg, 15 kg' , a: [['Cachorro · Adulto · Senior', ['Cachorro', 'Adulto', 'Senior']], ['1 · 3 · 15 kg', ['1 kg', '3 kg', '15 kg']], ['Chico · Mediano · Grande', ['Chico', 'Mediano', 'Grande']]] },
  jugueteria: { w: ['variante', 'variantes', 'la'], campo: 'Modelos, colores o edades', ej: 'Ej: Rosa, Celeste · 0-6 meses, 6-12 meses · RN, P, M, G' , a: [['RN · P · M · G · XG', ['RN', 'P', 'M', 'G', 'XG']], ['0-6 · 6-12 · 12-24 meses', ['0-6 meses', '6-12 meses', '12-24 meses']], ['Rosa · Celeste', ['Rosa', 'Celeste']]] },
  bijouterie: { w: ['modelo', 'modelos', 'el'], campo: 'Colores, baños o largos', ej: 'Ej: Dorado, Plateado · Acero, Baño de oro · 45 cm, 50 cm' , a: [['Dorado · Plateado · Rosé', ['Dorado', 'Plateado', 'Rosé']], ['40 · 45 · 50 cm', ['40 cm', '45 cm', '50 cm']]] },
  otro: { w: ['variante', 'variantes', 'la'], campo: 'Variantes (colores, modelos, tamaños…)', ej: 'Ej: Rojo, Azul · Chico, Grande · 500 ml, 1 L', a: [['Chico · Mediano · Grande', ['Chico', 'Mediano', 'Grande']], ['Blanco · Negro', ['Blanco', 'Negro']]] },
};
const sinTilde = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// S, M, XL, 2XL, Único, T.U., 0-3 m · o números de talle (16 a 52, con medio número)
const LETRA = /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-6]xl|unico|u|t\.?\s?u\.?|\d{1,2}\s?-\s?\d{1,2}\s?m(eses)?)$/;
const esNum = x => /^\d{2}([.,]5)?$/.test(x) && +x.replace(',', '.') >= 16 && +x.replace(',', '.') <= 52;
export const pareceTalle = vals => { const v = (vals || []).map(x => sinTilde(String(x).trim())).filter(Boolean); return v.length > 0 && v.every(x => LETRA.test(x) || esNum(x)); };

// Qué vende la tienda, según sus productos (categoría + nombre). Devuelve el rubro o null si no está claro.
const CLAVES = {
  perfumeria: 'perfume perfum parfum fragancia fragance fragrance colonia edp edt eau toilette extrait splash decant tester oud musk almizcle lattafa armaf afnan rasasi alhambra haramain ajmal zaafaran zimaya maison arabian asdaaf nabeel khamrah yara dior chanel versace herrera rabanne lancome givenchy armani gaultier banderas',
  cosmetica: 'maquillaje labial gloss rubor sombra corrector iluminador delineador pestan rimel ceja brocha mascarilla serum tonico skincare facial rostro esmalte unas shampoo acondicionador cosmet belleza bronceador protector solar acne crema makeup polvo compacto contorno primer fijador',
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
// v2.33.2: qué se adapta al elegir el rubro (en el alta y en Ajustes), para que se entienda en el momento
export function queAdapta(r) {
  const m = varMeta(r), ej = String(m.ej || '').replace(/^Ej:\s*/, '');
  if (r === 'indumentaria') return 'Tus productos van a tener talles (con atajos XS a XXL, calzado, niños y jean), stock por talle y guía de talles.';
  if (r === 'otro') return 'Te mostramos variantes generales (colores, modelos, tamaños). Cuando cargues tus productos, te sugerimos el rubro que mejor te queda.';
  return `Tus productos van a tener ${m.campo.toLowerCase()} (${ej}), con atajos para cargarlos en un toque.`;
}
// la palabra para las variantes de un producto: si lo escrito son talles (S, M, 38…) es "talle" (o "número"); si no, la del rubro
export function palabra(r, vals) {
  const m = varMeta(r), v = (vals || []).filter(x => String(x).trim()), propia = { w: m.w[0], ws: m.w[1], el: m.w[2] };
  const fija = ['perfumeria', 'cosmetica', 'alimentos', 'kiosco', 'gastronomia', 'ferreteria', 'construccion', 'mascotas', 'bijouterie'].includes(r);   // en estos rubros un número es un tono, un sabor o una medida
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
