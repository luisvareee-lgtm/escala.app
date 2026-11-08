// Pestaña Tienda (continuación): envíos, datos que se piden al cliente y reglas de compra; y diseño de la tienda
// (anuncios que corren, banners, beneficios, "Cómo comprar", preguntas frecuentes, testimonios y bienvenida)
// con vista previa celular / computadora.
import { api } from './api.js';
import { $, esc, fmt, on, toast } from './util.js';
import { P, can, aviso } from './state.js';
import { redimensionar } from './img.js';
import { anuncioHtml, heroHtml, beneficiosHtml, testimoniosHtml, popupHtml, comprarCardHtml, faqHtml, pasosAuto, faqSugeridas, banners as bannersDe, anuncios as anunciosDe } from './bloques.js';

const TIPOS = [['retiro', '🏪 Retiro en el local'], ['envio', '🚚 Envío a domicilio'], ['moto', '🛵 Moto / cadete'], ['correo', '📮 Correo / transporte'], ['acordar', '💬 A coordinar']];
const DATOS = [['dni', 'DNI / CUIT'], ['localidad', 'Localidad'], ['provincia', 'Provincia'], ['cp', 'Código postal'], ['nota', 'Aclaraciones del cliente']];
const E = { lista: null, gratis: null, aviso: null, datos: null, msg: '', err: '' };
const D = { d: null, disp: 'cel', msg: '', err: '', subiendo: null };
export const resetDis = () => { Object.assign(E, { lista: null, gratis: null, aviso: null, datos: null, msg: '', err: '' }); Object.assign(D, { d: null, disp: 'cel', msg: '', err: '', subiendo: null }); };
const clon = x => JSON.parse(JSON.stringify(x));
const lista = () => (E.lista = E.lista || clon(Array.isArray(P.t.envios) ? P.t.envios : []));
const datos = () => (E.datos = E.datos || Object.assign({}, P.t.datos_checkout || { localidad: 'opcional' }));
// borrador del diseño; convierte el formato viejo (un anuncio y un banner) al nuevo (listas)
const dis = () => {
  if (D.d) return D.d;
  const o = Object.assign({ beneficios: [], testimonios: [], popup: { activo: false }, secciones: {}, faq: [] }, clon(P.t.diseno || {}));
  o.anuncios = anunciosDe(o); o.banners = bannersDe(o).map(b => Object.assign({}, b)); delete o.anuncio; delete o.banner;
  o.propios = Array.isArray(o.comprar) && o.comprar.length > 0; if (!o.propios) o.comprar = [];
  return (D.d = o);
};
const box = (m, e) => (e ? `<div class="err-box">${esc(e)}</div>` : '') + (m ? `<div class="ok-box">${esc(m)}</div>` : '');
const idNuevo = n => (n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 14) || 'envio') + '-' + Math.random().toString(36).slice(2, 5);
const tiendaVista = () => Object.assign({}, P.t, { envios: lista() });

export function vistaEnviosDiseno() { return vistaEnvios() + vistaDiseno(); }

function vistaEnvios() {
  const L = lista(), t = P.t, dc = datos();
  return `<div class="grid2"><div class="cc" id="envios"><h3>🚚 Envíos y entregas</h3>${box(E.msg, E.err)}
  <p class="hint" style="margin-bottom:8px">Tu cliente elige uno al confirmar el pedido. El costo lo suma el sistema (no lo puede cambiar el comprador). Si no cargás ninguno, se coordina por WhatsApp.</p>
  ${L.map((x, i) => `<div class="env-row${x.activo === false ? ' off' : ''}">
    <div class="row2"><div class="fg"><label class="flabel" for="en-n${i}">Nombre</label><input class="fi" id="en-n${i}" maxlength="60" value="${esc(x.nombre)}" data-input="en-set" data-i="${i}" data-k="nombre" placeholder="Ej: Vía Cargo a sucursal"></div>
    <div class="fg"><label class="flabel" for="en-t${i}">Tipo</label><select class="fi" id="en-t${i}" data-change="en-set" data-i="${i}" data-k="tipo">${TIPOS.map(([k, n]) => `<option value="${k}" ${x.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="row2"><div class="fg"><label class="flabel" for="en-c${i}">Costo $ ${x.tipo === 'acordar' || x.tipo === 'correo' ? '(0 = se cotiza aparte)' : ''}</label><input class="fi" id="en-c${i}" type="number" min="0" step="1" value="${Number(x.costo) || 0}" data-input="en-set" data-i="${i}" data-k="costo" ${x.tipo === 'retiro' ? 'disabled' : ''}></div>
    <div class="fg"><label class="flabel" for="en-d${i}">Detalle (zona, demora)</label><input class="fi" id="en-d${i}" maxlength="120" value="${esc(x.detalle || '')}" data-input="en-set" data-i="${i}" data-k="detalle" placeholder="Ej: a todo el país · 3 a 6 días"></div></div>
    <div style="display:flex;gap:10px;align-items:center;justify-content:space-between"><label class="flabel" style="margin:0"><input type="checkbox" data-change="en-act" data-i="${i}" ${x.activo === false ? '' : 'checked'}> Disponible</label><button class="btn btn-s btn-sm" data-act="en-del" data-i="${i}" aria-label="Quitar ${esc(x.nombre)}">Quitar</button></div></div>`).join('') || '<p class="muted" style="margin-bottom:8px">Sin métodos de envío cargados.</p>'}
  ${L.length < 12 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px"><button class="btn btn-s btn-sm" data-act="en-add" data-t="retiro">+ Retiro</button><button class="btn btn-s btn-sm" data-act="en-add" data-t="moto">+ Moto</button><button class="btn btn-s btn-sm" data-act="en-add" data-t="correo">+ Correo / transporte</button><button class="btn btn-s btn-sm" data-act="en-add" data-t="acordar">+ A coordinar</button><button class="btn btn-s btn-sm" data-act="en-add" data-t="envio">+ Otro</button></div>` : ''}
  <h3 style="margin-top:6px">🧾 Datos que le pedís al cliente</h3>
  <p class="hint" style="margin-bottom:6px">Nombre y WhatsApp se piden siempre; la dirección, cuando elige un envío (no retiro).</p>
  <div class="dc-grid">${DATOS.map(([k, n]) => `<label class="flabel" for="dc-${k}">${n}</label><select class="fi" id="dc-${k}" data-change="dc-set" data-k="${k}">${[['no', 'No pedir'], ['opcional', 'Opcional'], ['obligatorio', 'Obligatorio']].map(([v, l]) => `<option value="${v}" ${(dc[k] || 'no') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`).join('')}</div>
  <h3 style="margin-top:12px">📏 Reglas de compra</h3>
  <div class="fg"><label class="flabel" for="en-gr">Envío gratis desde $ (0 = nunca)</label><input class="fi" id="en-gr" type="number" min="0" value="${E.gratis != null ? E.gratis : Number(t.envio_gratis_desde || 0)}" data-input="en-gr"></div>
  <div class="fg"><label class="flabel" for="en-av">Mostrar “¡Últimas N!” cuando quedan (0 = no mostrar)${aviso('stock')}</label><input class="fi" id="en-av" type="number" min="0" max="1000" value="${E.aviso != null ? E.aviso : Number(t.aviso_stock || 0)}" data-input="en-av" ${can('stock') ? '' : 'disabled'}></div>
  <p class="hint">Compra mínima mayorista: <b>${Number(t.compra_minima) ? fmt(t.compra_minima) : 'sin mínimo'}</b> (se cambia en Ajustes). La tienda la muestra arriba y en el carrito con lo que falta.</p>
  <button class="btn btn-p" data-act="en-guardar" style="margin-top:8px">Guardar envíos, datos y reglas</button></div>
  <div class="cc"><h3>Cómo lo ve tu cliente</h3><div class="env-prev">${L.filter(x => x.activo !== false && x.nombre).map(x => `<div class="opt"><span class="opt-ico">${(TIPOS.find(y => y[0] === x.tipo) || ['', '🚚'])[1].split(' ')[0]}</span><span class="opt-tx"><div class="opt-nm">${esc(x.nombre)}</div><div class="opt-ds">${x.tipo === 'retiro' ? 'Sin cargo' : Number(x.costo) ? fmt(x.costo) : x.tipo === 'acordar' || x.tipo === 'correo' ? 'Costo a coordinar' : 'Gratis'}${x.detalle ? ' · ' + esc(x.detalle) : ''}</div></span><span class="radio"></span></div>`).join('') || '<p class="muted">Cargá un método para verlo acá.</p>'}</div>
  <div class="hint" style="margin-top:8px">Además del nombre y el WhatsApp, le vamos a pedir: ${DATOS.filter(([k]) => (dc[k] || 'no') !== 'no').map(([k, n]) => n + (dc[k] === 'obligatorio' ? ' *' : '')).join(', ') || 'nada más'}.</div></div></div>`;
}

const lst = (arr, max, fila, add, l) => `${arr.map(fila).join('')}${arr.length < max ? `<button class="btn btn-s btn-sm" data-act="dz-add" data-l="${l}">${add}</button>` : ''}`;
function vistaDiseno() {
  const d = dis(), p = d.popup || {}, sec = d.secciones || {}, tv = tiendaVista();
  const vista = Object.assign({}, d, { comprar: d.propios ? d.comprar : undefined });
  const prev = `<div class="dz-prev ${D.disp}"><div class="dz-frame" style="--ac:${esc(P.t.color)};--on-ac:#fff">${anuncioHtml(vista)}<div class="dz-hdr">${P.t.logo_url ? `<img src="${esc(P.t.logo_url)}" alt="">` : ''}<b>${esc(P.t.nombre)}</b><span>🛒</span></div>${heroHtml(vista)}<div class="dz-ban"><b>${esc(P.t.nombre)}</b><small>${esc(P.t.eslogan || '')}</small></div>${beneficiosHtml(vista)}${comprarCardHtml(vista)}
    <div class="dz-grid">${[1, 2, 3, 4].map(i => `<div><i></i><span>Producto ${i}</span><b>$ ${(9800 + i * 1700).toLocaleString('es-AR')}</b></div>`).join('')}</div>${testimoniosHtml(vista)}${faqHtml(vista)}</div>
    ${p.activo ? `<div class="dz-pop">${popupHtml(vista).replace(/data-act="[^"]*"/g, '')}</div>` : ''}</div>`;
  const sw = (k, txt) => `<label class="dz-sw"><input type="checkbox" data-change="dz-sec" data-k="${k}" ${sec[k] === false ? '' : 'checked'}> ${txt || 'mostrar'}</label>`;
  return `<div class="grid2 dz"><div class="cc"><h3>🖌️ Diseño de la tienda</h3>${box(D.msg, D.err)}
  <fieldset class="dz-fs"><legend>Barra de anuncios (hasta 6) <label class="dz-sw"><input type="checkbox" data-change="dz-mov" ${d.anuncio_mov ? 'checked' : ''}> que corra</label></legend>
    ${lst(d.anuncios, 6, (x, i) => `<div class="dz-li"><input class="fi" maxlength="100" value="${esc(x)}" data-input="dz-an" data-i="${i}" aria-label="Anuncio ${i + 1}" placeholder="Ej: 📦 Pedidos semanales · despachos de 6 a 8 días"><button class="btn btn-s btn-sm" data-act="dz-del" data-l="anuncios" data-i="${i}" aria-label="Quitar">✕</button></div>`, '+ Anuncio', 'anuncios')}</fieldset>
  <fieldset class="dz-fs"><legend>Banners de portada (hasta 4, pasan solos)</legend>
    ${lst(d.banners, 4, (b, i) => `<div class="dz-ban-ed"><div class="dz-ban-th">${b.imagen ? `<img src="${esc(b.imagen)}" alt="">` : '<span>Sin imagen</span>'}</div><div class="dz-ban-f">
      <input class="fi" maxlength="60" value="${esc(b.titulo || '')}" data-input="dz-li" data-l="banners" data-i="${i}" data-k="titulo" aria-label="Título del banner ${i + 1}" placeholder="Título · Ej: Nueva temporada">
      <input class="fi" maxlength="160" value="${esc(b.texto || '')}" data-input="dz-li" data-l="banners" data-i="${i}" data-k="texto" aria-label="Texto del banner ${i + 1}" placeholder="Texto · Ej: Precios por volumen desde 3 unidades">
      <div class="dz-li"><input class="fi" maxlength="30" value="${esc(b.boton || '')}" data-input="dz-li" data-l="banners" data-i="${i}" data-k="boton" aria-label="Botón" placeholder="Botón (opcional)">
      <label class="filebtn">🖼️ ${b.imagen ? 'Cambiar' : 'Imagen'}<input type="file" accept="image/*" data-change="dz-img" data-i="${i}"></label>${b.imagen ? `<button class="btn btn-s btn-sm" data-act="dz-noimg" data-i="${i}">Sin imagen</button>` : ''}${D.subiendo === i ? '<span class="spin"></span>' : ''}<button class="btn btn-s btn-sm" data-act="dz-del" data-l="banners" data-i="${i}" aria-label="Quitar banner">✕</button></div></div></div>`, '+ Banner', 'banners')}
    <p class="hint">Imagen ancha (por ejemplo 1600 × 600). La achicamos sola para que cargue rápido.</p></fieldset>
  <fieldset class="dz-fs"><legend>Beneficios (hasta 4) ${sw('beneficios')}</legend>
    ${lst(d.beneficios, 4, (x, i) => `<div class="dz-li"><input class="fi dz-ico" maxlength="4" value="${esc(x.icono || '')}" data-input="dz-li" data-l="beneficios" data-i="${i}" data-k="icono" aria-label="Ícono" placeholder="🚚"><input class="fi" maxlength="60" value="${esc(x.texto || '')}" data-input="dz-li" data-l="beneficios" data-i="${i}" data-k="texto" aria-label="Beneficio ${i + 1}" placeholder="Ej: Envíos a todo el país"><button class="btn btn-s btn-sm" data-act="dz-del" data-l="beneficios" data-i="${i}" aria-label="Quitar">✕</button></div>`, '+ Beneficio', 'beneficios')}</fieldset>
  <fieldset class="dz-fs"><legend>📖 Cómo comprar ${sw('comprar')}</legend>
    <div class="seg" role="group" aria-label="Pasos" style="margin-bottom:8px"><button class="${d.propios ? '' : 'on'}" data-act="dz-propios" data-v="0">Automático</button><button class="${d.propios ? 'on' : ''}" data-act="dz-propios" data-v="1">Escribir los míos</button></div>
    ${d.propios ? lst(d.comprar, 6, (x, i) => `<div class="dz-tes"><div class="dz-li"><span class="dz-num">${i + 1}</span><input class="fi" maxlength="50" value="${esc(x.titulo || '')}" data-input="dz-li" data-l="comprar" data-i="${i}" data-k="titulo" aria-label="Paso ${i + 1}" placeholder="Título del paso"><button class="btn btn-s btn-sm" data-act="dz-del" data-l="comprar" data-i="${i}" aria-label="Quitar">✕</button></div><textarea class="fi" rows="2" maxlength="240" data-input="dz-li" data-l="comprar" data-i="${i}" data-k="texto" aria-label="Detalle del paso ${i + 1}">${esc(x.texto || '')}</textarea></div>`, '+ Paso', 'comprar')
      : `<p class="hint">Se arma solo con tu configuración real (escalas, compra mínima, envíos y medios de pago) y se actualiza cuando la cambiás:</p><ol class="dz-auto">${pasosAuto(tv).map(x => `<li><b>${esc(x.titulo)}</b> — ${esc(x.texto)}</li>`).join('')}</ol>`}</fieldset>
  <fieldset class="dz-fs"><legend>❓ Preguntas frecuentes (hasta 12) ${sw('faq')}</legend>
    ${d.faq.length ? '' : '<button class="btn btn-s btn-sm" data-act="dz-faq-sug" style="margin-bottom:8px">✨ Cargar preguntas sugeridas para mi tienda</button>'}
    ${lst(d.faq, 12, (x, i) => `<div class="dz-tes"><div class="dz-li"><input class="fi" maxlength="120" value="${esc(x.p || '')}" data-input="dz-li" data-l="faq" data-i="${i}" data-k="p" aria-label="Pregunta ${i + 1}" placeholder="Pregunta"><button class="btn btn-s btn-sm" data-act="dz-del" data-l="faq" data-i="${i}" aria-label="Quitar">✕</button></div><textarea class="fi" rows="2" maxlength="500" data-input="dz-li" data-l="faq" data-i="${i}" data-k="r" aria-label="Respuesta ${i + 1}" placeholder="Respuesta">${esc(x.r || '')}</textarea></div>`, '+ Pregunta', 'faq')}</fieldset>
  <fieldset class="dz-fs"><legend>Testimonios (hasta 6) ${sw('testimonios')}</legend>
    <p class="hint">Usá solo opiniones reales de tus clientes, con su permiso.</p>
    ${lst(d.testimonios, 6, (x, i) => `<div class="dz-tes"><div class="dz-li"><input class="fi" maxlength="40" value="${esc(x.nombre || '')}" data-input="dz-li" data-l="testimonios" data-i="${i}" data-k="nombre" aria-label="Nombre" placeholder="Nombre"><input class="fi" maxlength="40" value="${esc(x.lugar || '')}" data-input="dz-li" data-l="testimonios" data-i="${i}" data-k="lugar" aria-label="Lugar" placeholder="Ciudad (opcional)"><button class="btn btn-s btn-sm" data-act="dz-del" data-l="testimonios" data-i="${i}" aria-label="Quitar">✕</button></div><textarea class="fi" rows="2" maxlength="220" data-input="dz-li" data-l="testimonios" data-i="${i}" data-k="texto" aria-label="Opinión" placeholder="Lo que dijo">${esc(x.texto || '')}</textarea></div>`, '+ Testimonio', 'testimonios')}</fieldset>
  <fieldset class="dz-fs"><legend>Ventana de bienvenida / oferta <label class="dz-sw"><input type="checkbox" data-change="dz-pop" ${p.activo ? 'checked' : ''}> activa</label></legend>
    <p class="hint">Aparece una sola vez a cada visitante (y otra vez si la cambiás).</p>
    <div class="fg"><label class="flabel" for="dz-pt">Título</label><input class="fi" id="dz-pt" maxlength="60" value="${esc(p.titulo || '')}" data-input="dz-set" data-k="popup.titulo" placeholder="¡Bienvenido!"></div>
    <div class="fg"><label class="flabel" for="dz-px">Texto</label><textarea class="fi" id="dz-px" rows="2" maxlength="220" data-input="dz-set" data-k="popup.texto" placeholder="Ej: 10% off en tu primera compra mayorista">${esc(p.texto || '')}</textarea></div>
    <div class="fg"><label class="flabel" for="dz-pc">Código de descuento (opcional)</label><input class="fi" id="dz-pc" maxlength="20" value="${esc(p.cupon || '')}" data-input="dz-set" data-k="popup.cupon" placeholder="HOLA10"><div class="hint">El descuento lo aplicás vos al confirmar por WhatsApp.</div></div></fieldset>
  <div class="fg"><label class="flabel"><input type="checkbox" data-change="dz-sec" data-k="categorias" ${sec.categorias === false ? '' : 'checked'}> Mostrar los botones de categorías</label></div>
  <button class="btn btn-p" data-act="dz-guardar">Guardar diseño</button></div>
  <div class="cc dz-pcol"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap"><h3 style="margin:0">Vista previa</h3><div class="seg" role="group" aria-label="Dispositivo"><button class="${D.disp === 'cel' ? 'on' : ''}" data-act="dz-disp" data-k="cel">📱 Celular</button><button class="${D.disp === 'pc' ? 'on' : ''}" data-act="dz-disp" data-k="pc">💻 Compu</button></div></div><div id="dz-prev">${prev}</div></div></div>`;
}

// ---- envíos ----
on('en-add', d => { const L = lista(); if (L.length >= 12) return; const n = { retiro: 'Retiro en el local', moto: 'Moto / cadete', correo: 'Correo a todo el país', acordar: 'Coordinar entrega', envio: 'Envío a domicilio' }[d.t]; L.push({ id: idNuevo(n), nombre: n, tipo: d.t, costo: 0, detalle: '' }); E.msg = ''; P.repintar(); });
on('en-del', d => { lista().splice(+d.i, 1); P.repintar(); });
on('en-act', (d, el) => { const x = lista()[+d.i]; if (x) { if (el.checked) delete x.activo; else x.activo = false; } P.repintar(); });
on('en-set', (d, el) => { const x = lista()[+d.i]; if (!x) return; if (d.k === 'costo') x.costo = Math.max(0, Math.round(Number(el.value) || 0)); else x[d.k] = el.value; if (d.k === 'tipo') { if (x.tipo === 'retiro') x.costo = 0; P.repintar(); } });
on('en-gr', (d, el) => { E.gratis = Math.max(0, Number(el.value) || 0); });
on('en-av', (d, el) => { E.aviso = Math.max(0, Math.min(1000, Math.floor(Number(el.value) || 0))); });
on('dc-set', (d, el) => { datos()[d.k] = el.value; P.repintar(); });
on('en-guardar', async () => {
  const L = lista().map(x => { const y = { id: x.id, nombre: String(x.nombre || '').trim(), tipo: x.tipo, costo: x.tipo === 'retiro' ? 0 : Math.max(0, Math.round(Number(x.costo) || 0)) }; if (x.detalle && x.detalle.trim()) y.detalle = x.detalle.trim(); if (x.activo === false) y.activo = false; return y; });
  const mal = L.find(x => x.nombre.length < 2); if (mal) { E.err = 'Cada método de envío necesita un nombre.'; E.msg = ''; return P.repintar(); }
  const dc = {}; Object.entries(datos()).forEach(([k, v]) => { if (DATOS.some(x => x[0] === k) && v !== 'no') dc[k] = v; });
  const c = { envios: L, envio_gratis_desde: E.gratis != null ? E.gratis : Number(P.t.envio_gratis_desde || 0), datos_checkout: dc };
  if (can('stock')) c.aviso_stock = E.aviso != null ? E.aviso : Number(P.t.aviso_stock || 0);
  try { P.t = await api.guardarTienda(P.t.id, c) || P.t; Object.assign(E, { lista: null, gratis: null, aviso: null, datos: null, err: '', msg: 'Guardado. Ya lo ven tus clientes.' }); toast('Guardado'); }
  catch (e) { E.err = e.message; E.msg = ''; }
  P.repintar();
});

// ---- diseño ----
const repPrev = () => { const el = $('#dz-prev'); if (!el) return; const tmp = document.createElement('div'); tmp.innerHTML = vistaDiseno(); const n = tmp.querySelector('#dz-prev'); if (n) el.innerHTML = n.innerHTML; };
const ponerK = (k, v) => { const d = dis(), [a, b] = k.split('.'); if (b) { d[a] = d[a] || {}; d[a][b] = v; } else d[a] = v; };
const MAX = { anuncios: 6, banners: 4, beneficios: 4, testimonios: 6, comprar: 6, faq: 12 };
const NUEVO = { anuncios: () => '', banners: () => ({ titulo: '', texto: '' }), beneficios: () => ({ icono: '✓', texto: '' }), testimonios: () => ({ nombre: '', texto: '' }), comprar: () => ({ titulo: '', texto: '' }), faq: () => ({ p: '', r: '' }) };
on('dz-set', (d, el) => { ponerK(d.k, el.value); repPrev(); });
on('dz-an', (d, el) => { dis().anuncios[+d.i] = el.value; repPrev(); });
on('dz-mov', (d, el) => { dis().anuncio_mov = el.checked; repPrev(); });
on('dz-li', (d, el) => { const x = (dis()[d.l] || [])[+d.i]; if (x) { x[d.k] = el.value; repPrev(); } });
on('dz-add', d => { const L = dis()[d.l] = dis()[d.l] || []; if (L.length < MAX[d.l]) L.push(NUEVO[d.l]()); P.repintar(); });
on('dz-del', d => { (dis()[d.l] || []).splice(+d.i, 1); P.repintar(); });
on('dz-sec', (d, el) => { const s = dis().secciones = dis().secciones || {}; if (el.checked) delete s[d.k]; else s[d.k] = false; repPrev(); });
on('dz-pop', (d, el) => { const p = dis().popup = dis().popup || {}; p.activo = el.checked; repPrev(); });
on('dz-disp', d => { D.disp = d.k; P.repintar(); });
on('dz-propios', d => { const o = dis(); o.propios = d.v === '1'; if (o.propios && !o.comprar.length) o.comprar = pasosAuto(tiendaVista()).map(x => ({ ...x })); P.repintar(); });
on('dz-faq-sug', () => { dis().faq = faqSugeridas(tiendaVista()); P.repintar(); });
on('dz-noimg', d => { const b = dis().banners[+d.i]; if (b) delete b.imagen; P.repintar(); });
on('dz-img', async (d, el) => {
  const f = el.files[0], i = +d.i; if (!f) return; D.subiendo = i; P.repintar();
  try { const bl = await redimensionar(f, 1600); const b = dis().banners[i]; if (b) b.imagen = await api.subirFoto(P.t.id, bl, 'banner-' + Date.now()); D.err = ''; } catch (e) { D.err = e.message; }
  D.subiendo = null; P.repintar();
});
// limpia vacíos para que la base no guarde basura y valide el tamaño
function limpio() {
  const d = dis(), o = {}, s = v => String(v || '').trim();
  const an = d.anuncios.map(s).filter(Boolean); if (an.length) { o.anuncios = an; if (d.anuncio_mov) o.anuncio_mov = true; }
  const bn = d.banners.map(b => { const y = {}; ['titulo', 'texto', 'boton', 'imagen'].forEach(k => { if (s(b[k])) y[k] = s(b[k]); }); return y; }).filter(y => y.titulo || y.texto || y.imagen); if (bn.length) o.banners = bn;
  const ben = (d.beneficios || []).filter(x => s(x.texto)).map(x => ({ icono: s(x.icono).slice(0, 4) || '✓', texto: s(x.texto) })); if (ben.length) o.beneficios = ben;
  const tes = (d.testimonios || []).filter(x => s(x.texto)).map(x => { const y = { nombre: s(x.nombre) || 'Cliente', texto: s(x.texto) }; if (s(x.lugar)) y.lugar = s(x.lugar); return y; }); if (tes.length) o.testimonios = tes;
  if (d.propios) { const c = (d.comprar || []).filter(x => s(x.titulo)).map(x => ({ titulo: s(x.titulo), texto: s(x.texto) })); if (c.length) o.comprar = c; }
  const fq = (d.faq || []).filter(x => s(x.p) && s(x.r)).map(x => ({ p: s(x.p), r: s(x.r) })); if (fq.length) o.faq = fq;
  const p = d.popup || {}, po = { activo: !!p.activo }; ['titulo', 'texto', 'cupon'].forEach(k => { if (s(p[k])) po[k] = s(p[k]); }); if (po.activo || Object.keys(po).length > 1) o.popup = po;
  const sec = {}; Object.entries(d.secciones || {}).forEach(([k, v]) => { if (v === false) sec[k] = false; }); if (Object.keys(sec).length) o.secciones = sec;
  return o;
}
on('dz-guardar', async () => {
  const o = limpio();
  if (o.popup && o.popup.activo && !(o.popup.titulo || o.popup.texto || o.popup.cupon)) { D.err = 'La ventana de bienvenida necesita un título, un texto o un código.'; D.msg = ''; return P.repintar(); }
  try { P.t = await api.guardarTienda(P.t.id, { diseno: o }) || P.t; D.d = null; D.err = ''; D.msg = '¡Diseño guardado! Ya lo ven tus clientes.'; toast('Diseño guardado'); }
  catch (e) { D.err = e.message; D.msg = ''; }
  P.repintar();
});
