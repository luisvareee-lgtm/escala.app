// Pestaña Tienda (continuación): envíos y reglas de compra, y diseño de la tienda (anuncio, banner,
// beneficios, testimonios y popup) con vista previa celular / computadora.
import { api } from './api.js';
import { $, esc, fmt, on, toast } from './util.js';
import { P, can, aviso } from './state.js';
import { redimensionar } from './img.js';
import { anuncioHtml, heroHtml, beneficiosHtml, testimoniosHtml, popupHtml } from './bloques.js';

const TIPOS = [['retiro', '🏪 Retiro en el local'], ['envio', '🚚 Envío a domicilio'], ['moto', '🛵 Moto / cadete'], ['correo', '📮 Correo / transporte'], ['acordar', '💬 A coordinar']];
const E = { lista: null, gratis: null, aviso: null, msg: '', err: '' };
const D = { d: null, disp: 'cel', msg: '', err: '', subiendo: false };
export const resetDis = () => { Object.assign(E, { lista: null, gratis: null, aviso: null, msg: '', err: '' }); Object.assign(D, { d: null, disp: 'cel', msg: '', err: '', subiendo: false }); };
const clon = x => JSON.parse(JSON.stringify(x));
const lista = () => (E.lista = E.lista || clon(Array.isArray(P.t.envios) ? P.t.envios : []));
const dis = () => (D.d = D.d || Object.assign({ anuncio: '', banner: {}, beneficios: [], testimonios: [], popup: { activo: false }, secciones: {} }, clon(P.t.diseno || {})));
const box = (m, e) => (e ? `<div class="err-box">${esc(e)}</div>` : '') + (m ? `<div class="ok-box">${esc(m)}</div>` : '');
const idNuevo = n => (n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 14) || 'envio') + '-' + Math.random().toString(36).slice(2, 5);

export function vistaEnviosDiseno() { return vistaEnvios() + vistaDiseno(); }

function vistaEnvios() {
  const L = lista(), t = P.t;
  return `<div class="grid2"><div class="cc" id="envios"><h3>🚚 Envíos y entregas</h3>${box(E.msg, E.err)}
  <p class="hint" style="margin-bottom:8px">Tu cliente elige uno al confirmar el pedido. El costo lo suma el sistema (no lo puede cambiar el comprador). Si no cargás ninguno, se coordina por WhatsApp como hasta ahora.</p>
  ${L.map((x, i) => `<div class="env-row${x.activo === false ? ' off' : ''}">
    <div class="row2"><div class="fg"><label class="flabel" for="en-n${i}">Nombre</label><input class="fi" id="en-n${i}" maxlength="60" value="${esc(x.nombre)}" data-input="en-set" data-i="${i}" data-k="nombre" placeholder="Ej: Moto CABA 24 h"></div>
    <div class="fg"><label class="flabel" for="en-t${i}">Tipo</label><select class="fi" id="en-t${i}" data-change="en-set" data-i="${i}" data-k="tipo">${TIPOS.map(([k, n]) => `<option value="${k}" ${x.tipo === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
    <div class="row2"><div class="fg"><label class="flabel" for="en-c${i}">Costo $ ${x.tipo === 'acordar' ? '(0 = a coordinar)' : ''}</label><input class="fi" id="en-c${i}" type="number" min="0" step="1" value="${Number(x.costo) || 0}" data-input="en-set" data-i="${i}" data-k="costo" ${x.tipo === 'retiro' ? 'disabled' : ''}></div>
    <div class="fg"><label class="flabel" for="en-d${i}">Detalle (zona, demora)</label><input class="fi" id="en-d${i}" maxlength="120" value="${esc(x.detalle || '')}" data-input="en-set" data-i="${i}" data-k="detalle" placeholder="Ej: Zona norte · llega en 24 h"></div></div>
    <div style="display:flex;gap:10px;align-items:center;justify-content:space-between"><label class="flabel" style="margin:0"><input type="checkbox" data-change="en-act" data-i="${i}" ${x.activo === false ? '' : 'checked'}> Disponible</label><button class="btn btn-s btn-sm" data-act="en-del" data-i="${i}" aria-label="Quitar ${esc(x.nombre)}">Quitar</button></div></div>`).join('') || '<p class="muted" style="margin-bottom:8px">Sin métodos de envío cargados.</p>'}
  ${L.length < 12 ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px"><button class="btn btn-s btn-sm" data-act="en-add" data-t="retiro">+ Retiro</button><button class="btn btn-s btn-sm" data-act="en-add" data-t="moto">+ Moto</button><button class="btn btn-s btn-sm" data-act="en-add" data-t="correo">+ Correo</button><button class="btn btn-s btn-sm" data-act="en-add" data-t="envio">+ Otro envío</button></div>` : ''}
  <h3 style="margin-top:6px">📏 Reglas de compra</h3>
  <div class="fg"><label class="flabel" for="en-gr">Envío gratis desde $ (0 = nunca)</label><input class="fi" id="en-gr" type="number" min="0" value="${E.gratis != null ? E.gratis : Number(t.envio_gratis_desde || 0)}" data-input="en-gr"></div>
  <div class="fg"><label class="flabel" for="en-av">Mostrar “¡Últimas N!” cuando quedan (0 = no mostrar)${aviso('stock')}</label><input class="fi" id="en-av" type="number" min="0" max="1000" value="${E.aviso != null ? E.aviso : Number(t.aviso_stock || 0)}" data-input="en-av" ${can('stock') ? '' : 'disabled'}></div>
  <p class="hint">Compra mínima mayorista: <b>${Number(t.compra_minima) ? fmt(t.compra_minima) : 'sin mínimo'}</b> (se cambia en Ajustes). La tienda la muestra arriba y en el carrito con lo que falta.</p>
  <button class="btn btn-p" data-act="en-guardar" style="margin-top:8px">Guardar envíos y reglas</button></div>
  <div class="cc"><h3>Cómo lo ve tu cliente</h3><div class="env-prev">${L.filter(x => x.activo !== false && x.nombre).map(x => `<div class="opt"><span class="opt-ico">${(TIPOS.find(y => y[0] === x.tipo) || ['', '🚚'])[1].split(' ')[0]}</span><span class="opt-tx"><div class="opt-nm">${esc(x.nombre)}</div><div class="opt-ds">${x.tipo === 'retiro' ? 'Sin cargo' : Number(x.costo) ? fmt(x.costo) : x.tipo === 'acordar' ? 'Costo a coordinar' : 'Gratis'}${x.detalle ? ' · ' + esc(x.detalle) : ''}</div></span><span class="radio"></span></div>`).join('') || '<p class="muted">Cargá un método para verlo acá.</p>'}</div></div></div>`;
}

function vistaDiseno() {
  const d = dis(), b = d.banner || {}, p = d.popup || {}, sec = d.secciones || {};
  const ben = d.beneficios || [], tes = d.testimonios || [];
  const prev = `<div class="dz-prev ${D.disp}"><div class="dz-frame" style="--ac:${esc(P.t.color)};--on-ac:#fff">${anuncioHtml(d)}<div class="dz-hdr">${P.t.logo_url ? `<img src="${esc(P.t.logo_url)}" alt="">` : ''}<b>${esc(P.t.nombre)}</b><span>🛒</span></div>${heroHtml(d)}<div class="dz-ban"><b>${esc(P.t.nombre)}</b><small>${esc(P.t.eslogan || '')}</small></div>${beneficiosHtml(d)}
    <div class="dz-grid">${[1, 2, 3, 4].map(i => `<div><i></i><span>Producto ${i}</span><b>$ ${(9800 + i * 1700).toLocaleString('es-AR')}</b></div>`).join('')}</div>${testimoniosHtml(d)}</div>
    ${p.activo ? `<div class="dz-pop">${popupHtml(d).replace(/data-act="[^"]*"/g, '')}</div>` : ''}</div>`;
  return `<div class="grid2 dz"><div class="cc"><h3>🖌️ Diseño de la tienda</h3>${box(D.msg, D.err)}
  <div class="fg"><label class="flabel" for="dz-an">Barra de anuncio (arriba de todo)</label><input class="fi" id="dz-an" maxlength="140" value="${esc(d.anuncio || '')}" data-input="dz-set" data-k="anuncio" placeholder="Ej: Envíos a todo el país · 3 cuotas sin interés"></div>
  <fieldset class="dz-fs"><legend>Banner principal</legend>
    <div class="fg"><label class="flabel" for="dz-bt">Título</label><input class="fi" id="dz-bt" maxlength="60" value="${esc(b.titulo || '')}" data-input="dz-set" data-k="banner.titulo" placeholder="Ej: Nueva temporada primavera-verano"></div>
    <div class="fg"><label class="flabel" for="dz-bx">Texto</label><input class="fi" id="dz-bx" maxlength="160" value="${esc(b.texto || '')}" data-input="dz-set" data-k="banner.texto" placeholder="Ej: Precios mayoristas desde 3 unidades"></div>
    <div class="row2"><div class="fg"><label class="flabel" for="dz-bb">Botón (opcional)</label><input class="fi" id="dz-bb" maxlength="30" value="${esc(b.boton || '')}" data-input="dz-set" data-k="banner.boton" placeholder="Ver productos"></div>
    <div class="fg"><span class="flabel">Imagen (ancha)</span><label class="filebtn">🖼️ ${b.imagen ? 'Cambiar' : 'Subir'}<input type="file" accept="image/*" data-change="dz-img"></label>${b.imagen ? ' <button class="btn btn-s btn-sm" data-act="dz-noimg">Quitar</button>' : ''}${D.subiendo ? ' <span class="spin"></span>' : ''}</div></div></fieldset>
  <fieldset class="dz-fs"><legend>Beneficios (hasta 4) <label class="dz-sw"><input type="checkbox" data-change="dz-sec" data-k="beneficios" ${sec.beneficios === false ? '' : 'checked'}> mostrar</label></legend>
    ${ben.map((x, i) => `<div class="dz-li"><input class="fi dz-ico" maxlength="4" value="${esc(x.icono || '')}" data-input="dz-li" data-l="beneficios" data-i="${i}" data-k="icono" aria-label="Ícono" placeholder="🚚"><input class="fi" maxlength="60" value="${esc(x.texto || '')}" data-input="dz-li" data-l="beneficios" data-i="${i}" data-k="texto" aria-label="Beneficio ${i + 1}" placeholder="Ej: Envíos en 24 h"><button class="btn btn-s btn-sm" data-act="dz-del" data-l="beneficios" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('')}
    ${ben.length < 4 ? '<button class="btn btn-s btn-sm" data-act="dz-add" data-l="beneficios">+ Beneficio</button>' : ''}</fieldset>
  <fieldset class="dz-fs"><legend>Testimonios (hasta 6) <label class="dz-sw"><input type="checkbox" data-change="dz-sec" data-k="testimonios" ${sec.testimonios === false ? '' : 'checked'}> mostrar</label></legend>
    <p class="hint">Usá solo opiniones reales de tus clientes, con su permiso.</p>
    ${tes.map((x, i) => `<div class="dz-tes"><div class="dz-li"><input class="fi" maxlength="40" value="${esc(x.nombre || '')}" data-input="dz-li" data-l="testimonios" data-i="${i}" data-k="nombre" aria-label="Nombre" placeholder="Nombre"><input class="fi" maxlength="40" value="${esc(x.lugar || '')}" data-input="dz-li" data-l="testimonios" data-i="${i}" data-k="lugar" aria-label="Lugar" placeholder="Ciudad (opcional)"><button class="btn btn-s btn-sm" data-act="dz-del" data-l="testimonios" data-i="${i}" aria-label="Quitar">✕</button></div><textarea class="fi" rows="2" maxlength="220" data-input="dz-li" data-l="testimonios" data-i="${i}" data-k="texto" aria-label="Opinión" placeholder="Lo que dijo">${esc(x.texto || '')}</textarea></div>`).join('')}
    ${tes.length < 6 ? '<button class="btn btn-s btn-sm" data-act="dz-add" data-l="testimonios">+ Testimonio</button>' : ''}</fieldset>
  <fieldset class="dz-fs"><legend>Ventana de bienvenida / oferta <label class="dz-sw"><input type="checkbox" data-change="dz-pop" ${p.activo ? 'checked' : ''}> activa</label></legend>
    <p class="hint">Aparece una sola vez a cada visitante (y otra vez si la cambiás).</p>
    <div class="fg"><label class="flabel" for="dz-pt">Título</label><input class="fi" id="dz-pt" maxlength="60" value="${esc(p.titulo || '')}" data-input="dz-set" data-k="popup.titulo" placeholder="¡Bienvenido!"></div>
    <div class="fg"><label class="flabel" for="dz-px">Texto</label><textarea class="fi" id="dz-px" rows="2" maxlength="220" data-input="dz-set" data-k="popup.texto" placeholder="Ej: 10% off en tu primera compra mayorista">${esc(p.texto || '')}</textarea></div>
    <div class="fg"><label class="flabel" for="dz-pc">Código de descuento (opcional)</label><input class="fi" id="dz-pc" maxlength="20" value="${esc(p.cupon || '')}" data-input="dz-set" data-k="popup.cupon" placeholder="HOLA10"><div class="hint">El descuento lo aplicás vos al confirmar por WhatsApp.</div></div></fieldset>
  <div class="fg"><label class="flabel"><input type="checkbox" data-change="dz-sec" data-k="categorias" ${sec.categorias === false ? '' : 'checked'}> Mostrar los botones de categorías</label></div>
  <button class="btn btn-p" data-act="dz-guardar">Guardar diseño</button></div>
  <div class="cc dz-pcol"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><h3 style="margin:0">Vista previa</h3><div class="seg" role="group" aria-label="Dispositivo"><button class="${D.disp === 'cel' ? 'on' : ''}" data-act="dz-disp" data-k="cel">📱 Celular</button><button class="${D.disp === 'pc' ? 'on' : ''}" data-act="dz-disp" data-k="pc">💻 Compu</button></div></div><div id="dz-prev">${prev}</div></div></div>`;
}

// ---- envíos ----
const repEnv = () => { const el = $('#envios'); if (!el) return P.repintar(); P.repintar(); };
on('en-add', d => { const L = lista(); if (L.length >= 12) return; const n = { retiro: 'Retiro en el local', moto: 'Moto / cadete', correo: 'Correo a todo el país', envio: 'Envío a domicilio' }[d.t]; L.push({ id: idNuevo(n), nombre: n, tipo: d.t, costo: 0, detalle: '' }); E.msg = ''; repEnv(); });
on('en-del', d => { lista().splice(+d.i, 1); repEnv(); });
on('en-act', (d, el) => { const x = lista()[+d.i]; if (x) { if (el.checked) delete x.activo; else x.activo = false; } repEnv(); });
on('en-set', (d, el) => { const x = lista()[+d.i]; if (!x) return; if (d.k === 'costo') x.costo = Math.max(0, Math.round(Number(el.value) || 0)); else x[d.k] = el.value; if (d.k === 'tipo') { if (x.tipo === 'retiro') x.costo = 0; P.repintar(); } });
on('en-gr', (d, el) => { E.gratis = Math.max(0, Number(el.value) || 0); });
on('en-av', (d, el) => { E.aviso = Math.max(0, Math.min(1000, Math.floor(Number(el.value) || 0))); });
on('en-guardar', async b => {
  const L = lista().map(x => { const y = { id: x.id, nombre: String(x.nombre || '').trim(), tipo: x.tipo, costo: x.tipo === 'retiro' ? 0 : Math.max(0, Math.round(Number(x.costo) || 0)) }; if (x.detalle && x.detalle.trim()) y.detalle = x.detalle.trim(); if (x.activo === false) y.activo = false; return y; });
  const mal = L.find(x => x.nombre.length < 2); if (mal) { E.err = 'Cada método de envío necesita un nombre.'; E.msg = ''; return P.repintar(); }
  const c = { envios: L, envio_gratis_desde: E.gratis != null ? E.gratis : Number(P.t.envio_gratis_desde || 0) };
  if (can('stock')) c.aviso_stock = E.aviso != null ? E.aviso : Number(P.t.aviso_stock || 0);
  try { P.t = await api.guardarTienda(P.t.id, c) || P.t; Object.assign(E, { lista: null, gratis: null, aviso: null, err: '', msg: 'Envíos y reglas guardados. Ya los ven tus clientes.' }); toast('Guardado'); }
  catch (e) { E.err = e.message; E.msg = ''; }
  P.repintar();
});

// ---- diseño ----
const repPrev = () => { const el = $('#dz-prev'); if (!el) return; const tmp = document.createElement('div'); tmp.innerHTML = vistaDiseno(); const n = tmp.querySelector('#dz-prev'); if (n) el.innerHTML = n.innerHTML; };
const ponerK = (k, v) => { const d = dis(), [a, b] = k.split('.'); if (b) { d[a] = d[a] || {}; d[a][b] = v; } else d[a] = v; };
on('dz-set', (d, el) => { ponerK(d.k, el.value); repPrev(); });
on('dz-li', (d, el) => { const x = (dis()[d.l] || [])[+d.i]; if (x) { x[d.k] = el.value; repPrev(); } });
on('dz-add', d => { const L = dis()[d.l] = dis()[d.l] || []; if (L.length < (d.l === 'beneficios' ? 4 : 6)) L.push(d.l === 'beneficios' ? { icono: '✓', texto: '' } : { nombre: '', texto: '' }); P.repintar(); });
on('dz-del', d => { (dis()[d.l] || []).splice(+d.i, 1); P.repintar(); });
on('dz-sec', (d, el) => { const s = dis().secciones = dis().secciones || {}; if (el.checked) delete s[d.k]; else s[d.k] = false; repPrev(); });
on('dz-pop', (d, el) => { const p = dis().popup = dis().popup || {}; p.activo = el.checked; repPrev(); });
on('dz-disp', d => { D.disp = d.k; P.repintar(); });
on('dz-noimg', () => { const b = dis().banner = dis().banner || {}; delete b.imagen; P.repintar(); });
on('dz-img', async (d, el) => {
  const f = el.files[0]; if (!f) return; D.subiendo = true; P.repintar();
  try { const bl = await redimensionar(f, 1400); const b = dis().banner = dis().banner || {}; b.imagen = await api.subirFoto(P.t.id, bl, 'banner-' + Date.now()); D.err = ''; } catch (e) { D.err = e.message; }
  D.subiendo = false; P.repintar();
});
// limpia vacíos para que la base no guarde basura y valide el tamaño
function limpio() {
  const d = dis(), o = {}, s = v => String(v || '').trim();
  if (s(d.anuncio)) o.anuncio = s(d.anuncio);
  const b = d.banner || {}, bo = {}; ['titulo', 'texto', 'boton', 'imagen'].forEach(k => { if (s(b[k])) bo[k] = s(b[k]); }); if (Object.keys(bo).length) o.banner = bo;
  const ben = (d.beneficios || []).filter(x => s(x.texto)).map(x => ({ icono: s(x.icono).slice(0, 4) || '✓', texto: s(x.texto) })); if (ben.length) o.beneficios = ben;
  const tes = (d.testimonios || []).filter(x => s(x.texto)).map(x => { const y = { nombre: s(x.nombre) || 'Cliente', texto: s(x.texto) }; if (s(x.lugar)) y.lugar = s(x.lugar); return y; }); if (tes.length) o.testimonios = tes;
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
