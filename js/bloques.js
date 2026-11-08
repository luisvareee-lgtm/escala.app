// Bloques de diseño de la tienda (los usa la tienda pública y la vista previa del panel: se ven igual).
import { esc } from './util.js';

const okUrl = u => typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u);
export const secOn = (d, k) => !d || !d.secciones || d.secciones[k] !== false;

export const anuncioHtml = d => d && d.anuncio ? `<div class="st-anuncio" role="note">${esc(d.anuncio)}</div>` : '';

export function heroHtml(d) {
  const b = d && d.banner; if (!b || !(b.titulo || b.texto || okUrl(b.imagen))) return '';
  return `<section class="st-hero${okUrl(b.imagen) ? ' con-img' : ''}">${okUrl(b.imagen) ? `<img src="${esc(b.imagen)}" alt="" loading="eager">` : ''}<div class="st-hero-tx">${b.titulo ? `<h2>${esc(b.titulo)}</h2>` : ''}${b.texto ? `<p>${esc(b.texto)}</p>` : ''}${b.boton ? `<button class="btn btn-p btn-sm" data-act="st-hero">${esc(b.boton)}</button>` : ''}</div></section>`;
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
