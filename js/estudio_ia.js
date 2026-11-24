// v2.37 · Lo "inteligente" del estudio de flyers y videos: la estética según el rubro (industrial para herramientas,
// urbana para zapatillas, beauty para cosmética…), los estilos de video (/detail-closeup, /retail-commercial,
// /tabletop-ad, /unboxing) y los prompts que se arman solos con el producto, el estilo y la estética.
// No importa nada del panel: lo usan el estudio (flyer.js), el motor de video (shorts.js) y las pruebas.

// Estéticas: escena para la IA + color de acento para lo que se dibuja en el navegador.
export const LOOKS = {
  industrial: { n: 'Industrial', ico: '🔩', color: '#f59e0b', esc: 'en un ambiente industrial: taller con hormigón alisado y acero, luz dura lateral, tonos grafito con detalles amarillo de seguridad' },
  urbano: { n: 'Urbano', ico: '🛹', color: '#a855f7', esc: 'en un ambiente urbano tipo streetwear: pared con textura y grafiti suave desenfocado, asfalto, luz de atardecer con un toque de neón' },
  moda: { n: 'Moda', ico: '👗', color: '#c08457', esc: 'en una estética editorial de moda: estudio con fondo neutro cálido, luz suave de ventana, aire de revista' },
  beauty: { n: 'Beauty', ico: '🌸', color: '#ec4899', esc: 'en una estética beauty limpia: mármol claro, gotas de agua, pétalos, luz difusa y tonos pastel' },
  lujo: { n: 'Lujo', ico: '💎', color: '#d4af37', esc: 'en una estética de lujo: fondo oscuro profundo, reflejos dorados, seda y vidrio' },
  tech: { n: 'Tech', ico: '🔌', color: '#3b82f6', esc: 'en una estética tecnológica: superficie negra mate, luces LED azuladas, reflejos limpios, minimalismo futurista' },
  hogar: { n: 'Hogar cálido', ico: '🏡', color: '#65a30d', esc: 'en un hogar cálido: cocina o living luminoso, madera clara, plantas, luz natural de mañana' },
  gourmet: { n: 'Gourmet', ico: '🍽️', color: '#ea580c', esc: 'en una estética gourmet: mesa de madera rústica, ingredientes frescos alrededor, luz cálida y apetitosa' },
  kids: { n: 'Infantil', ico: '🧸', color: '#38bdf8', esc: 'en una estética infantil alegre: colores suaves, formas redondeadas, luz pareja y amable' },
  natural: { n: 'Natural', ico: '🌿', color: '#22c55e', esc: 'en un ambiente natural: pasto, plantas y luz de día suave' },
  creativo: { n: 'Creativo', ico: '✏️', color: '#6366f1', esc: 'en un escritorio creativo y ordenado: papeles de colores, luz de día, estética prolija' },
  estudio: { n: 'Estudio', ico: '⚪', color: '#475569', esc: 'en un estudio fotográfico limpio: fondo infinito de un color suave que combine con el producto, luz de softbox' },
};
const POR_RUBRO = { ferreteria: 'industrial', construccion: 'industrial', autopartes: 'industrial', indumentaria: 'moda', bijouterie: 'moda', cosmetica: 'beauty',
  perfumeria: 'lujo', electro: 'tech', hogar: 'hogar', alimentos: 'gourmet', gastronomia: 'gourmet', kiosco: 'gourmet', jugueteria: 'kids', mascotas: 'natural', libreria: 'creativo' };
const sinTilde = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// La estética que mejor le queda: primero lo que dice el producto (zapatillas → urbano), después el rubro de la tienda.
export function lookAuto(rubro, its) {
  const s = sinTilde((its || []).map(i => (i.categoria || '') + ' ' + (i.nombre || '')).join(' '));
  if (/zapatill|sneaker|skate|gorra|hoodie|streetwear|jogger|urbano/.test(s)) return 'urbano';
  if (/taladro|amolad|herramient|llave|destornill|soldad|compresor/.test(s)) return 'industrial';
  if (/perfum|fragan|eau de/.test(s)) return 'lujo';
  if (/auricular|celular|cargador|parlante|smart|gamer|notebook|tablet/.test(s)) return 'tech';
  return POR_RUBRO[rubro] || 'estudio';
}

// Estilos de video (Shorts 9:16). Cada uno es una animación que se dibuja en el navegador y, además, un prompt para
// quien quiera hacerlo con una IA de video (Veo, Sora, Kling…).
export const VIDEOS = {
  'detail-closeup': { n: 'Detalle en primer plano', ico: '🔍', desc: 'Acercamientos lentos que muestran la terminación y la calidad.',
    prompt: (p, l) => `Video vertical 9:16 de ${p}: tomas macro en primer plano, la cámara se acerca lentamente y recorre los detalles, texturas y terminaciones del producto, ${l}. Movimiento suave, foco selectivo, luz que resalta la calidad.` },
  'retail-commercial': { n: 'Comercial de tienda', ico: '🛍️', desc: 'Ritmo rápido, el precio aparece con fuerza y cierra con "Pedilo ya".',
    prompt: (p, l) => `Comercial vertical 9:16 de ${p} con ritmo de publicidad de retail: cortes rápidos, el producto entra con movimiento dinámico, giro de cámara y un cierre con el producto al frente, ${l}. Energía alta, colores vivos.` },
  'tabletop-ad': { n: 'Anuncio sobre la mesa', ico: '🪵', desc: 'El producto sobre una mesa, la cámara se acerca y pasa un brillo.',
    prompt: (p, l) => `Anuncio vertical 9:16 estilo tabletop de ${p}: el producto apoyado sobre una mesa, la cámara hace un travelling lento hacia adelante con leve paralaje, un destello de luz recorre el producto, ${l}. Estética de publicidad de estudio.` },
  unboxing: { n: 'Unboxing', ico: '📦', desc: 'Se abre la caja y aparece el producto, con brillos.',
    prompt: (p, l) => `Video vertical 9:16 de unboxing de ${p}: unas manos abren una caja prolija, el producto aparece y se muestra a cámara, ${l}. Sensación de estreno, luz natural, ritmo ágil.` },
};
export const COD_VIDEO = Object.keys(VIDEOS);
export const videoDeCodigo = s => { const k = sinTilde(s).trim().replace(/^\//, '').replace(/\s+/g, '-'); return VIDEOS[k] ? k : null; };
export const DURACIONES = [5, 10, 15];

const nombres = its => its.length > 1 ? `los productos de las fotos adjuntas (${its.map(x => '«' + x.nombre + '»').join(', ')})` : `el producto de la foto adjunta («${(its[0] || {}).nombre || 'producto'}»)`;
const REGLAS_IMG = 'Mantené el producto exactamente igual a la foto (forma, colores, etiqueta y textos del envase). No agregues textos, letras, precios, logos ni marcas de agua. Dejá el tercio de arriba y el cuarto de abajo más despejados, porque ahí va el texto del flyer. Hiperrealista, colores fieles.';
// Prompt de imagen: el del estilo publicitario (si tiene) + la estética + las reglas.
export function promptImagen(pro, look, its) {
  const L = LOOKS[look] || LOOKS.estudio, n = its.length > 1 ? ` (${its.map(x => '«' + x.nombre + '»').join(', ')}; armá una composición con todos)` : ` («${(its[0] || {}).nombre || 'producto'}»)`;
  const base = pro && pro.prompt ? pro.prompt(n, ', ' + L.esc) : `Creá una foto publicitaria vertical (9:16) de ${nombres(its)}, ${L.esc}. El producto es el protagonista, grande y bien iluminado.`;
  return base + ' ' + REGLAS_IMG;
}
export function promptVideo(cod, look, its, seg) {
  const v = VIDEOS[cod] || VIDEOS['retail-commercial'], L = LOOKS[look] || LOOKS.estudio;
  return v.prompt(nombres(its), L.esc) + ` Duración: ${seg} segundos. Mantené el producto igual a la foto (forma, colores y etiqueta), sin textos ni logos inventados. Sin personas reconocibles.`;
}
