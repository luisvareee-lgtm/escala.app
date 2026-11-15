// Bloques de diseño de la tienda (los usa la tienda pública y la vista previa del panel: se ven igual).
import { esc, fmt } from './util.js';

const okUrl = u => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u);
export const secOn = (d, k) => !d || !d.secciones || d.secciones[k] !== false;

// ---- barra de anuncios: fija o "que corre" (marquesina) ----
export const anuncios = d => !d ? [] : (Array.isArray(d.anuncios) ? d.anuncios : d.anuncio ? [d.anuncio] : []).map(s => String(s || '').trim()).filter(Boolean);
export function anuncioHtml(d) {
  const L = anuncios(d); if (!L.length) return '';
  if (d.anuncio_mov) {
    const tira = L.map(esc).join('<i aria-hidden="true">•</i>') + '<i aria-hidden="true">•</i>';
    return `<div class="st-anuncio mov" role="note" aria-label="${esc(L.join('. '))}"><div class="st-marq" aria-hidden="true"><span>${tira}</span><span>${tira}</span></div></div>`;
  }
  return `<div class="st-anuncio" role="note">${L.map(esc).join('<i aria-hidden="true">•</i>')}</div>`;
}

// ---- banners de portada (1 a 4; con más de uno pasan solos) ----
export const banners = d => !d ? [] : (Array.isArray(d.banners) ? d.banners : d.banner ? [d.banner] : []).filter(b => b && (b.titulo || b.texto || okUrl(b.imagen)));
const slide = b => `<div class="st-hero${okUrl(b.imagen) ? ' con-img' : ''}">${okUrl(b.imagen) ? `<img src="${esc(b.imagen)}" alt="" loading="lazy">` : ''}<div class="st-hero-tx">${b.titulo ? `<h2>${esc(b.titulo)}</h2>` : ''}${b.texto ? `<p>${esc(b.texto)}</p>` : ''}${b.boton ? `<button class="btn btn-p btn-sm" data-act="st-hero" data-ir="${esc(b.ir || '')}">${esc(b.boton)}</button>` : ''}</div></div>`;
export function heroHtml(d) {
  const L = banners(d); if (!L.length) return '';
  if (L.length === 1) return `<section class="st-heros">${slide(L[0])}</section>`;
  return `<section class="st-heros multi" aria-roledescription="carrusel" aria-label="Novedades"><div class="st-track">${L.map(slide).join('')}</div><div class="st-dots">${L.map((b, i) => `<button class="${i ? '' : 'on'}" data-act="st-slide" data-i="${i}" aria-label="Ver ${i + 1} de ${L.length}"></button>`).join('')}</div></section>`;
}
// avanza el carrusel solo (se frena si la persona lo toca o prefiere menos movimiento)
let timer = null;
export function iniciarCarrusel(root) {
  clearInterval(timer);
  const sec = root && root.querySelector('.st-heros.multi'); if (!sec) return;
  const tr = sec.querySelector('.st-track'), dots = [...sec.querySelectorAll('.st-dots button')];
  const actual = () => Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth));
  const marcar = () => dots.forEach((b, i) => b.classList.toggle('on', i === actual()));
  tr.addEventListener('scroll', () => { clearTimeout(tr._t); tr._t = setTimeout(marcar, 80); }, { passive: true });
  dots.forEach((b, i) => b.addEventListener('click', () => { tr.scrollTo({ left: i * tr.clientWidth, behavior: 'smooth' }); }));
  let reduce = false; try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }
  if (reduce) return;
  let parado = false; ['pointerdown', 'touchstart', 'focusin'].forEach(ev => sec.addEventListener(ev, () => { parado = true; }, { passive: true }));
  timer = setInterval(() => { if (parado || !tr.isConnected) { if (!tr.isConnected) clearInterval(timer); return; } const n = (actual() + 1) % dots.length; tr.scrollTo({ left: n * tr.clientWidth, behavior: 'smooth' }); }, 5000);
}

// ---- carrusel de productos ("vitrina") y efectos de movimiento ----
// efectos: prendidos salvo que el comercio los apague (y nunca si la persona pidió menos movimiento en su equipo)
export const efectosOn = d => !d || d.efectos !== false;
export const menosMovimiento = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const MODOS_VT = ['auto', 'elegidos', 'categoria', 'nuevos', 'vendidos', 'ofertas'];
const TITULO_VT = { auto: '⭐ Destacados', elegidos: '⭐ Destacados', categoria: '⭐ Destacados', nuevos: '🆕 Nuevos ingresos', vendidos: '🔥 Los más vendidos', ofertas: '🏷️ Ofertas de la semana' };
const unaVitrina = v => ({ titulo: String(v.titulo || '').trim() || TITULO_VT[MODOS_VT.includes(v.modo) ? v.modo : 'auto'], modo: MODOS_VT.includes(v.modo) ? v.modo : 'auto',
  ids: Array.isArray(v.ids) ? v.ids.filter(x => typeof x === 'string') : [], categoria: String(v.categoria || ''), pos: v.pos === 'abajo' ? 'abajo' : 'arriba' });
// hasta 4 carruseles (formato nuevo "vitrinas"; el viejo "vitrina" sigue andando)
export function vitrinasCfg(d) {
  const L = !d ? [] : Array.isArray(d.vitrinas) ? d.vitrinas : d.vitrina ? [d.vitrina] : [];
  return L.filter(v => v && v.activo).slice(0, 4).map(unaVitrina);
}
export const vitrinaCfg = d => vitrinasCfg(d)[0] || null;
// qué productos van (hasta 12): elegidos en ese orden, una categoría, una lista que manda el servidor (nuevos / más vendidos),
// los que están en oferta, o una selección con foto que cambia en cada visita
export function vitrinaProds(cfg, prods, azar = Math.random, idsServidor = null) {
  const ok = p => p && !p.agotado && p.activo !== false;
  const m = new Map(prods.map(p => [p.id, p]));
  if (cfg.modo === 'elegidos') return cfg.ids.map(id => m.get(id)).filter(ok).slice(0, 12);
  if ((cfg.modo === 'nuevos' || cfg.modo === 'vendidos') && Array.isArray(idsServidor) && idsServidor.length) return idsServidor.map(id => m.get(id)).filter(ok).slice(0, 12);
  let L = prods.filter(p => ok(p) && (cfg.modo !== 'categoria' || p.categoria === cfg.categoria) && (cfg.modo !== 'ofertas' || Number(p.oferta_pct) > 0));
  const conFoto = L.filter(p => p.imagen_url);
  if (cfg.modo === 'categoria' || cfg.modo === 'ofertas') L = conFoto.concat(L.filter(p => !p.imagen_url));
  else { L = conFoto.length >= 4 ? conFoto.slice() : L.slice(); for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(azar() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; } }
  return L.slice(0, 12);
}

// ---- "Comprá por categoría" con fotos ----
export function catFotoCfg(d) { const c = d && d.catfoto; if (!c || !c.activo) return null; return { titulo: String(c.titulo || '').trim() || 'Comprá por categoría', fotos: c.fotos && typeof c.fotos === 'object' ? c.fotos : {} }; }
// la foto de cada categoría: la del producto elegido o, si no, la del primer producto con foto (los activos y con stock primero)
export function fotoCategoria(cat, prods, fotos) {
  const L = prods.filter(p => p.categoria === cat && p.imagen_url && p.activo !== false);
  const elegido = fotos && fotos[cat] ? L.find(p => p.id === fotos[cat]) : null;
  return (elegido || L.find(p => !p.agotado) || L[0] || {}).imagen_url || '';
}
export function catTilesHtml(cfg, cats, prods, actual, conTodas = true) {
  const n = c => prods.filter(p => p.categoria === c).length;
  const tile = (c, img, cant, todas) => `<button type="button" class="ct-tile${c === actual ? ' on' : ''}" data-act="st-cat" data-c="${esc(c)}"${c === actual ? ' aria-pressed="true"' : ' aria-pressed="false"'}>
    <span class="ct-img${img ? ' con-img' : ''}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span aria-hidden="true">${todas ? '🛍️' : '🏷️'}</span>`}</span><span class="ct-n">${esc(todas ? 'Todo' : c)}</span><span class="ct-c">${cant} ${cant === 1 ? 'producto' : 'productos'}</span></button>`;
  return `<div class="ct-h"><h3>${esc(cfg.titulo)}</h3></div><div class="ct-track">${conTodas ? tile('Todas', '', prods.length, true) : ''}${cats.map(c => tile(c, fotoCategoria(c, prods, cfg.fotos), n(c), false)).join('')}</div>`;
}

// ---- banners de rubro: agrupan categorías en la portada del catálogo ("Seleccioná la categoría") ----
// tema de color de cada banner (pensados con la psicología del color); "marca" usa el color de la tienda
export const TEMAS_RB = [['bronce', '🥇 Bronce imperial y dorado ámbar', 'lujo y exclusividad: perfumes, relojes, joyas'], ['magenta', '🔮 Humo magenta y azul hielo', 'moda, noche y tecnología'], ['rosa', '🌸 Rosa seducción y orquídea', 'belleza, cosmética y regalos'], ['esmeralda', '🌿 Esmeralda y verde menta', 'natural, salud y ahorro'], ['marca', '🎨 El color de mi tienda', 'el mismo color de tus botones']];
const temaRb = t => (TEMAS_RB.some(x => x[0] === t) ? t : 'bronce');
const txt = (v, n) => String(v || '').trim().slice(0, n);
// rubros que se muestran (solo con categorías que tienen productos, si se pasan los productos)
export function rubrosCfg(d, prods) {
  const r = d && d.rubros; if (!r || !r.activo || !Array.isArray(r.lista)) return null;
  const hay = prods ? new Set(prods.filter(p => p.activo !== false).map(p => p.categoria)) : null;
  const lista = r.lista.filter(x => x && x.id && txt(x.titulo, 50) && Array.isArray(x.cats))
    .map(x => ({ id: String(x.id), titulo: txt(x.titulo, 50), kicker: txt(x.kicker, 60), texto: txt(x.texto, 160), badge: txt(x.badge, 30), tema: temaRb(x.tema), imagen: okUrl(x.imagen) ? x.imagen : '',
      cats: [...new Set(x.cats.filter(c => typeof c === 'string' && (!hay || hay.has(c))))], suma: !!x.suma }))
    .filter(x => x.cats.length);
  return lista.length ? { titulo: txt(r.titulo, 40) || 'Seleccioná la categoría', lista } : null;
}
// precio por cantidad "por categoría": las categorías de un rubro que "suman juntas" cuentan como una sola
// (mismo criterio que el servidor: public.escala_cat)
export function claveCat(d, cat) {
  const r = d && d.rubros; cat = cat || '';
  if (r && r.activo && Array.isArray(r.lista)) { const x = r.lista.find(x => x && x.suma === true && x.id && Array.isArray(x.cats) && x.cats.includes(cat)); if (x) return 'r:' + x.id; }
  return 'c:' + cat;
}
export const rubroDe = (d, id) => { const r = d && d.rubros; return r && Array.isArray(r.lista) ? r.lista.find(x => x && x.id === id) || null : null; };
// hasta 3 fotos de productos del rubro (una de cada categoría por turno), para cuando el banner no tiene imagen propia
export function fotosRubro(r, prods, n = 3) {
  const por = r.cats.map(c => prods.filter(p => p.categoria === c && p.imagen_url && p.activo !== false && !p.agotado)), L = [];
  for (let i = 0; L.length < n && i < 12; i++) por.forEach(a => { if (L.length < n && a[i]) L.push(a[i].imagen_url); });
  return L;
}
export function rubrosHtml(cfg, prods, total) {
  const cuenta = r => prods.filter(p => r.cats.includes(p.categoria)).length;
  const ban = r => {
    const fotos = r.imagen ? [r.imagen] : fotosRubro(r, prods), n = cuenta(r);
    const pills = r.cats.slice(0, 3).map(c => `<span>${esc(c)}</span>`).join('') + (r.cats.length > 3 ? `<span>+${r.cats.length - 3}</span>` : '');
    return `<article class="rb-ban rb-${r.tema}" role="button" tabindex="0" data-act="st-rubro" data-r="${esc(r.id)}" aria-label="${esc(r.titulo)}: ver ${n} ${n === 1 ? 'producto' : 'productos'}">
      <div class="rb-left">${r.kicker ? `<span class="rb-kick">${esc(r.kicker)}</span>` : ''}<h4>${esc(r.titulo)}</h4>${r.texto ? `<p>${esc(r.texto)}</p>` : ''}<div class="rb-pills">${pills}</div><span class="rb-mas">Ver más →</span></div>
      <div class="rb-right${fotos.length > 1 ? ' rb-mos' + fotos.length : ''}">${fotos.length ? fotos.map(f => `<img src="${esc(f)}" alt="" loading="lazy">`).join('') : '<span class="rb-vacio" aria-hidden="true">🛍️</span>'}</div>
      ${r.badge ? `<span class="rb-badge">${esc(r.badge)}</span>` : ''}</article>`;
  };
  return `<section class="rb-portada" id="rb-portada"><div class="rb-h"><small>Catálogo</small><h3>${esc(cfg.titulo)}</h3></div><div class="rb-list">${cfg.lista.map(ban).join('')}</div>${total ? `<button type="button" class="rb-todo" data-act="st-rubro" data-r="*">🛍️ Ver todo el catálogo · ${total} ${total === 1 ? 'producto' : 'productos'} →</button>` : ''}</section>`;
}
// adentro de un rubro: volver y una píldora por subcategoría (con cuántos productos tiene)
export function rubroCabHtml(r, prods, actual) {
  const n = c => prods.filter(p => p.categoria === c).length;
  const tot = r ? prods.filter(p => r.cats.includes(p.categoria)).length : prods.length;
  return `<div class="rb-in${r ? ' rb-' + r.tema : ''}"><button type="button" class="rb-volver" data-act="st-rubro" data-r="">← Volver a categorías</button>
    <div class="rb-in-t"><h3>${esc(r ? r.titulo : 'Todo el catálogo')}</h3><small>${tot} ${tot === 1 ? 'producto' : 'productos'}</small></div>
    ${r && r.cats.length > 1 ? `<div class="rb-subs" role="group" aria-label="Subcategorías de ${esc(r.titulo)}"><button type="button" class="pill ${actual === 'Todas' ? 'on' : ''}" data-act="st-cat" data-c="Todas">✨ Todo el rubro · ${tot}</button>${r.cats.map(c => `<button type="button" class="pill ${actual === c ? 'on' : ''}" data-act="st-cat" data-c="${esc(c)}">${esc(c)} · ${n(c)}</button>`).join('')}</div>` : ''}</div>`;
}

// ---- estilo de la tienda (Diseño → Estilo): lo que no está guardado queda como viene ----
export const lookDe = d => { const l = (d && d.look) || {}; return { modo: l.modo !== false, barra: l.barra !== false, compacto: l.compacto === true, limpia: l.limpia === true }; };

export function beneficiosHtml(d) {
  const L = (d && d.beneficios || []).filter(x => x && x.texto);
  if (!L.length || !secOn(d, 'beneficios')) return '';
  return `<ul class="st-benef">${L.map(x => `<li><span aria-hidden="true">${esc(x.icono || '✓')}</span>${esc(x.texto)}</li>`).join('')}</ul>`;
}

export function testimoniosHtml(d) {
  const L = (d && d.testimonios || []).filter(x => x && x.texto);
  if (!L.length || !secOn(d, 'testimonios')) return '';
  return `<section class="st-testi"><h3>Lo que dicen nuestros clientes</h3><div class="st-testi-l">${L.map(x => `<figure><blockquote>“${esc(x.texto)}”</blockquote><figcaption>${esc(x.nombre || 'Cliente')}${x.lugar ? ' · ' + esc(x.lugar) : ''}</figcaption></figure>`).join('')}</div></section>`;
}

export function popupHtml(d) {
  const p = d && d.popup; if (!p || !p.activo || !(p.titulo || p.texto || p.cupon)) return '';
  return `<div class="modal-bg" data-act="st-pop-bg"><div class="modal st-pop" role="dialog" aria-modal="true" aria-label="${esc(p.titulo || 'Bienvenida')}">
    ${p.titulo ? `<div class="view-title">${esc(p.titulo)}</div>` : ''}${p.texto ? `<p>${esc(p.texto)}</p>` : ''}
    ${p.cupon ? `<div class="st-cupon"><span>Código</span><b>${esc(p.cupon)}</b><button class="btn btn-s btn-sm" data-act="st-pop-copiar" data-v="${esc(p.cupon)}">Copiar</button></div><p class="hint">Mencionalo al enviar tu pedido por WhatsApp.</p>` : ''}
    <button class="btn btn-p" style="margin-top:10px" data-act="st-pop-cerrar">Ver productos</button></div></div>`;
}
// huella del popup: si el comercio lo cambia, se vuelve a mostrar una vez
export const firmaPopup = d => { const p = d && d.popup; if (!p) return ''; const s = [p.titulo, p.texto, p.cupon].join('|'); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return String(h); };

// medios de pago prendidos, en palabras: "por transferencia, en efectivo o con Mercado Pago"
const PAGOS_TODOS = ['transferencia', 'efectivo', 'link'];
const pagosDe = t => { const a = Array.isArray(t.pagos_activos) && t.pagos_activos.length ? t.pagos_activos : PAGOS_TODOS; return PAGOS_TODOS.filter(k => a.includes(k)); };
const unir = (L, y) => L.length < 2 ? (L[0] || '') : L.slice(0, -1).join(', ') + ' ' + y + ' ' + L[L.length - 1];
const pagosFrase = t => unir(pagosDe(t).map(k => ({ transferencia: 'por transferencia', efectivo: 'en efectivo', link: t.mp_activo ? 'con Mercado Pago' : 'con link de pago' })[k]), 'o');
const pagosLista = t => unir(pagosDe(t).map(k => ({ transferencia: 'Transferencia', efectivo: 'Efectivo', link: t.mp_activo ? 'Mercado Pago' : 'Link de pago' })[k]), 'y');

// ---- "Cómo comprar": si el comercio no escribió sus pasos, se arman solos con su configuración real ----
export function pasosAuto(t) {
  const may = t.modalidad !== 'minorista', env = (t.envios || []).filter(e => e && e.activo !== false && e.nombre), min = Number(t.compra_minima) || 0;
  const P = [];
  P.push({ titulo: 'Elegí tus productos', texto: may
    ? `Tocá “+ Agregar”. Podés combinar distintos productos. El precio baja según cuántas unidades llevás${t.escala_grupo === 'categoria' ? ', sumando los productos de la misma categoría' : t.escala_grupo === 'carrito' ? ', sumando todo lo que hay en el carrito' : ' de cada producto'}: x1, x3, x6 y x12 o más${t.escala_grupo === 'categoria' || t.escala_grupo === 'carrito' ? '' : ' (las variantes del mismo producto suman juntas)'}.${t.modalidad === 'hibrido' ? ' Si sos revendedor, tocá “Acceso Mayorista”' + (t.requiere_codigo ? ' e ingresá tu código' : '') + ' para ver la lista por cantidad.' : ''}`
    : 'Tocá “+ Agregar” en lo que te guste. Podés comprar desde 1 unidad.' });
  P.push({ titulo: 'Revisá tu carrito', texto: `Ves el total y, si corresponde, cuánto ahorrás por cantidad.${may && min ? ` La compra mínima mayorista es de ${fmt(min)}.` : ''}` });
  P.push({ titulo: 'Elegí cómo recibirlo', texto: env.length ? `Opciones: ${env.map(e => e.nombre).join(', ')}.${Number(t.envio_gratis_desde) > 0 ? ` Envío gratis desde ${fmt(t.envio_gratis_desde)}.` : ''}` : 'Coordinamos la entrega o el retiro por WhatsApp.' });
  P.push({ titulo: 'Confirmá y mandá el pedido por WhatsApp', texto: `Te llega el ticket con el detalle y el total. Podés pagar ${pagosFrase(t)}.${t.modo_stock === 'encargo' ? ` Trabajamos por encargo: llega en ${+t.demora_encargo || 7} días desde que confirmamos el pedido.` : t.modo_stock === 'mixto' ? ' Los productos “por encargo” llegan en los días que indica cada uno.' : ' Te confirmamos stock y el envío.'}` });
  return P;
}
export const pasosDe = (d, t) => (d && Array.isArray(d.comprar) && d.comprar.length ? d.comprar : pasosAuto(t));
export function comprarCardHtml(d) {
  if (!secOn(d, 'comprar')) return '';
  return `<div class="st-howto"><span class="st-howto-i" aria-hidden="true">💡</span><div><b>¿Primera vez en la tienda?</b><p>Mirá cómo comprar, cómo funcionan los precios y cómo te llega el pedido.</p></div><button class="btn btn-p btn-sm" data-act="st-comprar">📖 Cómo comprar</button></div>`;
}
export function comprarModalHtml(d, t) {
  const pasos = pasosDe(d, t), F = (d && d.faq || []).filter(x => x && x.p && x.r);
  return `<div class="modal-bg" data-act="st-comprar-bg"><div class="modal st-comprar" role="dialog" aria-modal="true" aria-label="Cómo comprar"><div class="view-title">📖 Cómo comprar</div>
    <ol class="st-pasos">${pasos.map(p => `<li><b>${esc(p.titulo)}</b>${p.texto ? `<p>${esc(p.texto)}</p>` : ''}</li>`).join('')}</ol>
    ${F.length ? `<h3 style="margin:14px 0 6px;font-size:1rem">Preguntas frecuentes</h3>${faqLista(F)}` : ''}
    <button class="btn btn-p" style="margin-top:12px" data-act="st-comprar-cerrar">Entendido, ver productos</button></div></div>`;
}
const faqLista = F => `<div class="st-faq-l">${F.map(x => `<details><summary>${esc(x.p)}</summary><p>${esc(x.r)}</p></details>`).join('')}</div>`;
export function faqHtml(d) {
  const F = (d && d.faq || []).filter(x => x && x.p && x.r);
  if (!F.length || !secOn(d, 'faq')) return '';
  return `<section class="st-faq"><h3>Preguntas frecuentes</h3>${faqLista(F)}</section>`;
}
// preguntas sugeridas con las respuestas armadas según la configuración de la tienda (el comercio las edita)
export function faqSugeridas(t) {
  const may = t.modalidad !== 'minorista', env = (t.envios || []).filter(e => e && e.activo !== false && e.nombre), min = Number(t.compra_minima) || 0;
  const L = [];
  if (may) L.push({ p: '¿Cómo funcionan los precios por cantidad?', r: `Cada producto tiene precio x1, x3, x6 y x12 o más. ${t.escala_grupo === 'categoria' ? 'Las unidades se suman entre productos de la misma categoría' : t.escala_grupo === 'carrito' ? 'Las unidades se suman entre todos los productos del carrito' : 'Se calcula por producto sumando sus variantes'}, y el carrito te muestra cuánto te falta para el siguiente escalón.` });
  if (may) L.push({ p: '¿Hay compra mínima?', r: min ? `Sí, la compra mínima mayorista es de ${fmt(min)}.` : 'No, podés comprar desde 1 unidad.' });
  L.push({ p: '¿Puedo combinar productos?', r: 'Sí, armá tu pedido con los productos que quieras.' });
  L.push({ p: '¿Hacen envíos?', r: env.length ? `Sí: ${env.map(e => e.nombre + (Number(e.costo) ? ' (' + fmt(e.costo) + ')' : '')).join(', ')}.${Number(t.envio_gratis_desde) > 0 ? ` Gratis desde ${fmt(t.envio_gratis_desde)}.` : ''}` : 'Sí, coordinamos el envío o el retiro por WhatsApp.' });
  L.push({ p: '¿Qué medios de pago aceptan?', r: `${pagosLista(t)}.` });
  L.push({ p: '¿Cuánto tarda en llegar?', r: 'Despachamos dentro de las 48 h hábiles de confirmado el pago. (Editá este tiempo según tu negocio.)' });
  L.push({ p: '¿Hacen factura?', r: 'Consultanos por WhatsApp al hacer el pedido. (Editá esta respuesta según tu condición fiscal.)' });
  return L;
}
