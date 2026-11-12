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
const slide = b => `<div class="st-hero${okUrl(b.imagen) ? ' con-img' : ''}">${okUrl(b.imagen) ? `<img src="${esc(b.imagen)}" alt="" loading="lazy">` : ''}<div class="st-hero-tx">${b.titulo ? `<h2>${esc(b.titulo)}</h2>` : ''}${b.texto ? `<p>${esc(b.texto)}</p>` : ''}${b.boton ? `<button class="btn btn-p btn-sm" data-act="st-hero">${esc(b.boton)}</button>` : ''}</div></div>`;
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
