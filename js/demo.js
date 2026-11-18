// Demo instantánea de la portada: el visitante sube la lista de su proveedor (foto, PDF, Excel o texto) y ve
// su catálogo con precios por cantidad ANTES de registrarse. Todo corre en su navegador: la lista no se sube a ningún lado.
// Al crear la cuenta, el panel le ofrece cargar esos mismos productos.
import { esc, fmt, on, $, store, toast } from './util.js';
import { abrirFlyer } from './flyer.js';
import { leerArchivo, parsearLista, detectarTabla, tablaAProductos, deTextoDeFoto, infoOcr, deArchivoNombre } from './importer.js';
import { ilus } from './ilus.js';
import { redimensionar } from './img.js';

const K = 'demo:prods';
const DM = { items: null, busy: false, msg: '', err: '', aviso: '', m1: 50, m12: 20, dolar: 1200, fuente: '', modo: 'mayor', edit: -1, cart: {}, pedido: false };   // modo: mayor | menor | dos
const MODOS = [['mayor', 'Por mayor', 'precios por cantidad'], ['menor', 'Por menor', 'un precio por unidad'], ['dos', 'Las dos', 'minorista y mayorista']];
const FORMATOS = 'image/*,.pdf,.xlsx,.xls,.ods,.csv,.txt,.zip';
const EJEMPLO = `Perfume Asad 100ml EDP $38.500
Perfume Yara 100ml $31.200
Club de Nuit Intense 105ml $42.900
Khamrah 100ml EDP $45.000
Body splash vainilla 250ml $6.800
Crema corporal karité 400ml $9.500
Set de brochas x12 $14.300
Labial mate larga duración $4.200`;
const precio = (costo, m) => Math.ceil(costo * (1 + m / 100) / 10) * 10;
const tiers = c => { const m1 = DM.m1, m12 = DM.modo === 'menor' ? DM.m1 : DM.m12; return { 1: precio(c, m1), 3: precio(c, m12 + (m1 - m12) * 0.6), 6: precio(c, m12 + (m1 - m12) * 0.3), 12: precio(c, m12) }; };
const limpio = L => L.filter(x => (x.nombre || '').trim().length >= 3 && x.costo_usd > 0).map(x => ({ nombre: x.nombre.trim().slice(0, 120), costo: x.precio_ars > 0 ? Math.round(x.precio_ars) : Math.round(x.costo_usd * DM.dolar), categoria: x.categoria && x.categoria !== 'General' ? x.categoria : '' })).slice(0, 300);

function deTexto(texto) { return limpio(parsearLista(texto, DM.dolar, 'General', 'ars')); }
// foto chica (máx. 640 px) como texto, para mostrarla y guardarla en este navegador hasta crear la cuenta
async function miniatura(f) {
  try { const b = await redimensionar(f, 640, .72); return await new Promise((ok, mal) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = mal; r.readAsDataURL(b); }); }
  catch (e) { return null; }
}
// lo leído de una foto se usa solo si parece de verdad: un nombre con palabras y un precio razonable
const creible = x => x && x.costo >= 100 && (String(x.nombre || '').match(/\p{L}{3,}/gu) || []).length >= 1;
async function deArchivo(f, pre = '') {
  const r = await leerArchivo(f, m => { DM.msg = pre + m; const e = $('#dm-prog'); if (e) e.textContent = pre + m; });
  if (r.tipo === 'tabla') { const det = detectarTabla(r.filas); if (det.map.nombre == null || (det.map.precio == null && det.map.costo == null)) throw new Error('No encontramos las columnas de nombre y precio en esa planilla.'); return limpio(tablaAProductos(det, det.map, { moneda: 'ars', tipo: 'costo', cot: DM.dolar, margen: 0 })); }
  if (r.tipo === 'imagen') {
    // foto de una lista (varios renglones con precio), foto de UN producto con el precio escrito,
    // o foto de producto sin texto (zapatillas, ropa…): esa se guarda con su foto y se completa a mano
    const L = deTexto(r.texto).filter(creible); if (L.length > 1) return L;
    const d = L[0] || limpio([deTextoDeFoto(r.texto, DM.dolar, 'ars')]).filter(creible)[0], foto = await miniatura(f);
    if (d) return [{ ...d, foto }];
    // el nombre del archivo: "ZAPATILLA NIKE - PRECIO 70000.jpg" → nombre y costo
    const an = deArchivoNombre(f.name, DM.dolar, 'ars'), dn = an ? limpio([an]).filter(creible)[0] : null;
    if (dn && foto) return [{ ...dn, foto }];
    if (infoOcr().palabras >= 8) return [];   // mucho texto legible pero sin precios: era una lista borrosa, no una foto de producto
    return foto ? [{ nombre: (an && an.nombre) || '', costo: 0, categoria: '', foto, falta: true }] : [];
  }
  if (r.tipo === 'productos') return limpio(r.items.map(i => parsearLista(i.leyenda || '', DM.dolar, 'General', 'ars')[0]).filter(Boolean));
  return deTexto(r.texto || '');
}
const guardar = () => {
  if (!DM.items || !DM.items.length) return;
  const items = DM.items.filter(x => (x.nombre.trim().length >= 2 && x.costo > 0) || x.foto), d = { items, m1: DM.m1, modo: DM.modo, at: Date.now() };
  try { localStorage.setItem(K, JSON.stringify(d)); } catch (e) { store.set(K, { ...d, items: items.filter(x => x.costo > 0).map(x => ({ ...x, foto: null })) }); }   // sin lugar para las fotos: se guarda sin ellas
};
// varios archivos de cualquier formato a la vez: se leen uno por uno y se juntan (sin repetir nombres)
async function deArchivos(F) {
  const todo = [], vistos = new Set(), fallo = [];
  for (let i = 0; i < F.length; i++) {
    const pre = F.length > 1 ? `Archivo ${i + 1} de ${F.length}: ` : '';
    try { DM.msg = pre + 'leyendo…'; const e = $('#dm-prog'); if (e) e.textContent = DM.msg; const L = await deArchivo(F[i], pre); if (!L.length) fallo.push(F[i].name); L.forEach(x => { const k = x.nombre.toLowerCase(); if (x.falta || !vistos.has(k)) { vistos.add(k); todo.push(x); } }); }
    catch (e) { fallo.push(F[i].name); }
  }
  const sinDatos = todo.filter(x => x.falta).length;
  DM.aviso = todo.length && fallo.length ? `No pudimos leer ${fallo.length === 1 ? 'este archivo' : 'estos archivos'}: ${fallo.join(', ')}. Probá con una foto más nítida, pegá el texto o cargalo a mano acá abajo.`
    : sinDatos ? `${sinDatos === 1 ? 'Una foto no tiene' : sinDatos + ' fotos no tienen'} el precio escrito: poné el nombre y tu costo en cada una, o completalo después en tu panel.` : '';
  return todo;
}

// pasos de la demo: 1 subís · 2 la leemos · 3 tu tienda
const paso = () => DM.busy ? 2 : DM.items ? 3 : 1;
const pasosHtml = () => { const p = paso(); return [['Subís tu lista', 'fotos, PDF, Excel o texto'], ['La leemos', DM.modo === 'menor' ? 'costos y tu precio' : 'costos y escalas'], ['Tu tienda lista', 'con tu ganancia']].map(([t, d], i) => `<li class="${i + 1 < p ? 'hecho' : i + 1 === p ? 'actual' : ''}"${i + 1 === p ? ' aria-current="step"' : ''}><span>${i + 1 < p ? '✓' : i + 1}</span><b>${t}</b><small>${d}</small></li>`).join(''); };
const crudo = L => L.filter(x => x.nombre).slice(0, 6).map(x => `${x.nombre.toUpperCase().slice(0, 24)} .. $${Math.round(x.costo).toLocaleString('es-AR')}`);
// antes / después: la lista como la manda el proveedor vs. cómo queda la tienda
function antesDespues(L, tarjetas, vivo) {
  return `<div class="dm-ba${vivo && DM.anim ? ' vivo' : ''}"><div class="dm-antes"><span class="dm-lbl">Antes · la lista del proveedor</span><pre aria-label="Lista cruda">${esc(crudo(L).join('\n'))}</pre></div>
    <div class="dm-flecha" aria-hidden="true">→</div>
    <div class="dm-despues"><span class="dm-lbl on">Después · tu tienda</span><div class="dm-grid"${vivo ? ' id="dm-grid"' : ''}>${tarjetas}</div></div></div>`;
}
const MUESTRA = [{ nombre: 'Perfume Asad 100ml EDP', costo: 38500 }, { nombre: 'Body splash vainilla 250ml', costo: 6800 }];

export function demoHtml() {
  return `<div class="lp-demo" id="lp-demo"><ol class="dm-pasos" id="dm-pasos" aria-label="Cómo funciona">${pasosHtml()}</ol><div class="lp-demo-acc">
      <label class="btn btn-p lp-demo-btn">📷 Subí fotos o archivos de tu lista<input type="file" hidden multiple accept="${FORMATOS}" data-change="dm-file"></label>
      <button class="btn btn-s" data-act="dm-ej">Probar con una lista de ejemplo</button></div>
    <p class="dm-formatos" id="dm-formatos"><b>Sirve cualquiera de estos, y podés elegir varios juntos:</b> fotos y capturas (JPG, PNG) · PDF · Excel (.xlsx, .xls) · CSV · texto (.txt) · chat de WhatsApp exportado (.zip).</p>
    <div class="dm-modo" id="dm-modo" role="group" aria-label="¿Cómo vendés?"><span>¿Cómo vendés?</span>${modoHtml()}</div>
    <details class="lp-demo-txt"><summary>…o pegá el texto de tu lista</summary><textarea class="fi" id="dm-txt" rows="4" placeholder="Un producto por renglón: Perfume X 100ml $12.500"></textarea><button class="btn btn-s btn-sm" data-act="dm-usar">Ver mi catálogo</button></details>
    <p class="hint">Sin registrarte. Tu lista se lee en tu celular o compu: no se sube a ningún lado.</p>
    <div id="dm-out">${salida()}</div></div>`;
}
const modoHtml = () => MODOS.map(([k, t, d]) => `<button type="button" class="pill ${DM.modo === k ? 'on' : ''}" data-act="dm-modo" data-v="${k}" aria-pressed="${DM.modo === k}" title="${d}">${t}</button>`).join('');
const aMano = (txt = '＋ Agregar un producto a mano') => `<button class="btn btn-s btn-sm dm-mano" data-act="dm-nuevo">${txt}</button>`;
function salida() {
  if (DM.busy) return `<div class="dm-scan" id="dm-scan" role="status"><div class="dm-doc" aria-hidden="true">${[82, 64, 90, 56, 74, 68].map(w => `<i style="width:${w}%"></i>`).join('')}<span class="dm-laser"></span></div>
    <div class="dm-scan-tx"><b>${DM.modo === 'menor' ? 'Analizando costos y calculando tu precio por unidad…' : 'Analizando costos y calculando escalas x1, x3, x6, x12…'}</b><div class="hint" id="dm-prog">${esc(DM.msg || 'Leyendo tu lista…')}</div></div></div>`;
  if (DM.err) return `<div class="err-box" style="margin-top:10px">${esc(DM.err)}</div><div class="dm-salidas" id="dm-salidas"><b>No pasa nada, tenés otras formas:</b><div class="lv-acc"><button class="btn btn-s btn-sm" data-act="dm-pegar">📋 Pegar el texto de la lista</button>${aMano('✍️ Cargar un producto a mano')}</div><p class="hint">Las fotos se leen mejor de frente, con buena luz y el precio nítido. Un Excel o un PDF con texto se leen casi siempre.</p></div>`;
  const L = DM.items; if (!L) return `<div class="dm-idle" aria-hidden="true">${antesDespues(MUESTRA, MUESTRA.map((x, k) => tarjeta(x, -1 - k)).join(''), false)}</div>`;
  const pend = L.filter(x => x.falta).length, listos = L.length - pend;
  const cab = pend && !listos ? `📷 Subiste ${pend === 1 ? '1 foto' : pend + ' fotos'}. Poné el nombre y tu costo en cada una y así quedaría tu tienda`
    : `✅ ${DM.fuente === 'lo que cargaste' ? 'Cargaste' : 'Leímos'} ${listos} ${listos === 1 ? 'producto' : 'productos'}${pend ? ` y ${pend === 1 ? '1 foto' : pend + ' fotos'} para completar` : ''}${DM.fuente && DM.fuente !== 'lo que cargaste' ? ' de ' + esc(DM.fuente) : ''}. Así quedaría tu tienda`;
  return `<div class="dm-res"><div class="dm-h"><b>${cab}${DM.modo === 'menor' ? ' minorista' : DM.modo === 'dos' ? ' (por menor y por mayor)' : ''}:</b>
      <div class="dm-m"><label>${DM.modo === 'menor' ? 'Tu ganancia' : 'Tu ganancia x1'} <input class="fi" type="number" min="0" max="500" value="${DM.m1}" data-input="dm-m" data-k="m1" aria-label="Ganancia por unidad en porcentaje">%</label>${DM.modo === 'menor' ? '' : `<label>x12 <input class="fi" type="number" min="0" max="500" value="${DM.m12}" data-input="dm-m" data-k="m12" aria-label="Ganancia llevando 12 en porcentaje">%</label>`}</div></div>
    ${DM.aviso ? `<div class="warn-box" id="dm-aviso">${esc(DM.aviso)}</div>` : ''}
    ${antesDespues(L, grilla(), true)}
    <div class="dm-cartb" id="dm-cartb">${barraPedido()}</div>
    <div class="dm-pie">${aMano()}<span class="hint">¿Leyó mal un nombre o un precio? Tocá ✏️ en el producto y corregilo.${L.length > verN() ? ` Hay ${L.length - verN()} productos más: los ves y corregís todos al guardar tu tienda.` : ''}</span></div>
    <a class="btn btn-p dm-cta" href="#/registro" data-act="dm-guardar">Guardar mi tienda gratis con ${L.length === 1 ? 'este producto' : 'estos ' + L.length + ' productos'} →</a>
    <p class="hint">Después podés corregir nombres y costos, sumar fotos y recibir pedidos por WhatsApp. <span class="dias-prueba">14</span> días gratis, sin tarjeta.</p></div>`;
}
// Tarjeta como la ve el cliente en la tienda: foto (acá, un dibujo de ejemplo), nombre, precio y "+ Agregar".
// v2.28.1: tu costo y tu ganancia no van en la tarjeta (la ve tu cliente): están en "Ver pedido".
const fotoEdit = (x, i) => `<label class="dm-foto-in">${x.foto ? `<img src="${esc(x.foto)}" alt="">` : '<span aria-hidden="true">📷</span>'}<b>${x.foto ? 'Cambiar foto' : 'Agregar foto'}</b><input type="file" accept="image/*" hidden data-change="dm-e-foto" data-i="${i}"></label>`;
function tarjeta(x, i) {
  const t = tiers(x.costo), cls = i >= 0 ? 'dm-card' : 'dm-card0', n = i >= 0 ? i : -1 - i;
  if (i >= 0 && DM.edit === i) return `<div class="dm-card dm-ed" style="--i:0">${fotoEdit(x, i)}<label>Nombre<input class="fi" id="dm-e-n" maxlength="120" value="${esc(x.nombre)}" placeholder="Ej: Zapatilla urbana gris"></label><label>Tu costo ($)<input class="fi" id="dm-e-c" inputmode="numeric" value="${x.costo || ''}" placeholder="Ej: 12500"></label><div class="lv-acc"><button class="btn btn-p btn-sm" data-act="dm-e-ok" data-i="${i}">Listo</button><button class="btn btn-s btn-sm" data-act="dm-e-quitar" data-i="${i}">Quitar</button></div></div>`;
  const img = x.foto ? `<img src="${esc(x.foto)}" alt="${esc(x.nombre || 'Foto del producto')}" loading="lazy">` : ilus(x.nombre, n);
  if (x.falta) return `<div class="dm-card dmc dm-falta" style="--i:${Math.max(0, i)}"><div class="dmc-img">${img}<span class="dmc-off dmc-pend">Completá</span></div>
    <div class="dmc-b"><label class="dm-f-l">Nombre<input class="fi" id="dm-fn-${i}" maxlength="120" value="${esc(x.nombre)}" placeholder="Ej: Zapatilla urbana gris"></label>
      <label class="dm-f-l">Tu costo ($)<input class="fi" id="dm-fc-${i}" inputmode="numeric" value="${x.costo || ''}" placeholder="Ej: 45000"></label>
      <div class="lv-acc"><button class="btn btn-p btn-sm" data-act="dm-f-ok" data-i="${i}">Listo</button><button class="btn btn-s btn-sm" data-act="dm-e-quitar" data-i="${i}" aria-label="Quitar esta foto">Quitar</button></div></div></div>`;
  const may = DM.modo === 'mayor', dos = DM.modo === 'dos', off = (may || dos) && t[1] > t[12] ? Math.round((1 - t[12] / t[1]) * 100) : 0;
  const precio = may ? `<div class="dmc-p"><strong>${fmt(t[12])}</strong><small>c/u llevando 12+</small></div>`
    : dos ? `<div class="dmc-p"><strong>${fmt(t[1])}</strong><small>precio al público</small></div><div class="dmc-1">Por mayor, con código: desde ${fmt(t[12])}</div>`
    : `<div class="dmc-p"><strong>${fmt(t[1])}</strong></div>`;
  const q = i >= 0 ? DM.cart[i] || 0 : 0;
  const acc = i < 0 ? '<span class="dmc-add" aria-hidden="true">+ Agregar</span>'
    : q ? `<div class="dmc-step" role="group" aria-label="Cantidad de ${esc(x.nombre)}"><button type="button" data-act="dm-q" data-i="${i}" data-d="-1" aria-label="Quitar uno">−</button><span>${q}</span><button type="button" data-act="dm-q" data-i="${i}" data-d="1" aria-label="Sumar uno">+</button></div>`
    : `<button type="button" class="dmc-add" data-act="dm-q" data-i="${i}" data-d="1">+ Agregar</button>`;
  return `<div class="${cls} dmc" style="--i:${Math.max(0, i)}"><div class="dmc-img">${img}${off ? `<span class="dmc-off">−${off}% x12</span>` : ''}${i >= 0 ? `<button class="dm-edit" data-act="dm-editar" data-i="${i}" aria-label="Corregir ${esc(x.nombre)}">✏️</button><button class="dm-fly" data-act="dm-flyer" data-i="${i}" aria-label="Ver ${esc(x.nombre)} en un flyer" title="Ver en flyer">📸</button>` : ''}</div>
    <div class="dmc-b"><b class="dmc-n">${esc(x.nombre)}</b>${precio}${acc}</div></div>`;
}
const verN = () => (DM.items || []).some(x => x.foto) ? 12 : 6;
const grilla = () => DM.items.slice(0, verN()).map(tarjeta).join('');
/* ---- el pedido de prueba: lo que paga el cliente y, solo para vos, tu costo y tu ganancia ---- */
const unidadEn = (x, q) => { const t = tiers(x.costo); if (DM.modo !== 'mayor') return { u: t[1], k: 1, t }; const k = q >= 12 ? 12 : q >= 6 ? 6 : q >= 3 ? 3 : 1; return { u: t[k], k, t }; };
const lineas = () => Object.entries(DM.cart).map(([i, q]) => ({ i: +i, q, x: (DM.items || [])[+i] })).filter(l => l.x && !l.x.falta && l.q > 0);
function cuentas() {
  const L = lineas().map(l => { const { u, k, t } = unidadEn(l.x, l.q); return { ...l, u, k, t, sub: u * l.q, costo: l.x.costo * l.q }; });
  const total = L.reduce((a, l) => a + l.sub, 0), costo = L.reduce((a, l) => a + l.costo, 0), n = L.reduce((a, l) => a + l.q, 0);
  return { L, total, costo, gan: total - costo, n };
}
const pct = (g, c) => c > 0 ? Math.round(g / c * 100) : 0;
function barraPedido() {
  const C = cuentas(); if (!C.n) return '';
  return `<button type="button" class="dm-cartbar" data-act="dm-pedido"><span>🛒 <b>${C.n} u.</b> · ${fmt(C.total)}</span><b>Ver pedido y tu ganancia →</b></button>`;
}
function pedidoHtml() {
  const C = cuentas(); if (!C.n) return '';
  const fila = l => { const sig = DM.modo === 'mayor' ? [3, 6, 12].find(k => k > l.q) : 0, falta = sig ? sig - l.q : 0;
    return `<li class="dmp-l"><div class="dmp-top"><b>${esc(l.x.nombre)}</b><div class="dmc-step" role="group" aria-label="Cantidad"><button type="button" data-act="dm-q" data-i="${l.i}" data-d="-1" aria-label="Quitar uno">−</button><span>${l.q}</span><button type="button" data-act="dm-q" data-i="${l.i}" data-d="1" aria-label="Sumar uno">+</button></div></div>
      <div class="dmp-pr">${l.q} × ${fmt(l.u)}${DM.modo === 'mayor' ? ` <small>precio x${l.k}${l.k === 12 ? '+' : ''}</small>` : ''}<b>${fmt(l.sub)}</b></div>
      ${falta ? `<div class="dmp-sig">Sumando ${falta} más pasa a ${fmt(l.t[sig])} c/u</div>` : ''}
      <div class="dmp-gan">Tu costo ${fmt(l.costo)} · ganás <b>${fmt(l.sub - l.costo)}</b> <em>+${pct(l.sub - l.costo, l.costo)} %</em></div></li>`; };
  return `<div class="dmp-bg" data-act="dm-pedido-x"><div class="dmp" role="dialog" aria-modal="true" aria-labelledby="dmp-t" data-stop="1">
    <div class="dmp-h"><b id="dmp-t">🛒 Tu pedido de prueba</b><button type="button" class="dmp-x" data-act="dm-pedido-x" aria-label="Cerrar">✕</button></div>
    <ul class="dmp-ls">${C.L.map(fila).join('')}</ul>
    <div class="dmp-tot"><span>Lo que paga tu cliente</span><b>${fmt(C.total)}</b></div>
    <div class="dmp-vos"><p>🔒 <b>Solo lo ves vos.</b> Tu cliente ve el precio, nunca tu costo ni tu ganancia.</p>
      <div><span>Tu costo</span><b>${fmt(C.costo)}</b></div><div class="g"><span>Tu ganancia</span><b>${fmt(C.gan)}</b></div><div><span>Rinde sobre tu costo</span><b>+${pct(C.gan, C.costo)} %</b></div></div>
    <a class="btn btn-p" href="#/registro" data-act="dm-guardar">Guardar mi tienda gratis →</a><p class="hint">En tu tienda, este pedido te llega armado por WhatsApp.</p></div></div>`;
}
function pintarPedido() {
  const b = $('#dm-cartb'); if (b) b.innerHTML = barraPedido();
  let m = $('#dm-pedido');
  if (!DM.pedido || !cuentas().n) { DM.pedido = false; if (m) m.remove(); return; }
  if (!m) { m = document.createElement('div'); m.id = 'dm-pedido'; document.body.appendChild(m); }
  m.innerHTML = pedidoHtml();
}
on('dm-q', d => {
  const i = +d.i, x = DM.items && DM.items[i]; if (!x) return;
  const q = Math.max(0, Math.min(99, (DM.cart[i] || 0) + Number(d.d))); if (q) DM.cart[i] = q; else delete DM.cart[i];
  const g = $('#dm-grid'); if (g) g.innerHTML = grilla(); pintarPedido();
});
on('dm-pedido', () => { DM.pedido = true; pintarPedido(); const x = document.querySelector('#dm-pedido .dmp-x'); if (x) x.focus(); });
on('dm-pedido-x', (d, el, ev) => { if (ev && ev.target && ev.target.closest && ev.target.closest('[data-stop]') && !ev.target.closest('.dmp-x')) return; DM.pedido = false; pintarPedido(); const b = document.querySelector('.dm-cartbar'); if (b) b.focus(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && DM.pedido) { DM.pedido = false; pintarPedido(); } });
const pintar = () => { const o = $('#dm-out'); if (o) o.innerHTML = salida(); const p = $('#dm-pasos'); if (p) p.innerHTML = pasosHtml(); const m = $('#dm-modo'); if (m) m.innerHTML = '<span>¿Cómo vendés?</span>' + modoHtml(); };
on('dm-modo', d => { if (!MODOS.some(m => m[0] === d.v)) return; DM.modo = d.v; guardar(); pintar(); pintarPedido(); });
// corregir a mano lo que se leyó mal, o cargar un producto desde cero (en el panel se edita todo, con fotos)
on('dm-editar', d => { DM.edit = +d.i; pintar(); const n = $('#dm-e-n'); if (n) n.focus(); });
function cerrarEdicion(i, quitar) {
  const x = DM.items && DM.items[i]; if (!x) return;
  if (!quitar) { const n = ($('#dm-e-n') || {}).value || '', c = Math.round(Number(String(($('#dm-e-c') || {}).value || '').replace(/[^\d]/g, ''))); if (n.trim().length >= 2 && c > 0) { x.nombre = n.trim().slice(0, 120); x.costo = c; x.falta = false; } else if (x.foto) { x.nombre = n.trim().slice(0, 120); x.costo = c > 0 ? c : 0; x.falta = true; } else quitar = !(x.nombre && x.costo > 0); }
  if (quitar) { DM.items.splice(i, 1); DM.cart = {}; pintarPedido(); }
  DM.edit = -1; if (!DM.items.length) DM.items = null; guardar(); pintar();
}
on('dm-e-ok', d => cerrarEdicion(+d.i, false));
// foto sin precio: completar nombre y costo ahí mismo
on('dm-f-ok', d => {
  const i = +d.i, x = DM.items && DM.items[i]; if (!x) return;
  const ne = $('#dm-fn-' + i), ce = $('#dm-fc-' + i), n = ((ne || {}).value || '').trim(), c = Math.round(Number(String((ce || {}).value || '').replace(/[^\d]/g, '')));
  if (n.length < 2) { toast('Escribí el nombre del producto'); if (ne) ne.focus(); return; }
  if (!(c > 0)) { toast('Poné tu costo (lo que te sale a vos)'); if (ce) ce.focus(); return; }
  Object.assign(x, { nombre: n.slice(0, 120), costo: c, falta: false });
  if (!DM.items.some(y => y.falta)) DM.aviso = '';
  guardar(); pintar();
});
// sumar o cambiar la foto de un producto (a mano)
on('dm-e-foto', async (d, el) => {
  const i = +d.i, x = DM.items && DM.items[i], f = el.files && el.files[0]; el.value = ''; if (!x || !f) return;
  const n = $('#dm-e-n'), c = $('#dm-e-c'); if (n) x.nombre = n.value; if (c) x.costo = Math.round(Number(String(c.value).replace(/[^\d]/g, ''))) || 0;
  const foto = await miniatura(f); if (!foto) return toast('No se pudo usar esa imagen. Probá con una JPG o PNG.');
  x.foto = foto; guardar(); pintar(); const m = $('#dm-e-n'); if (m) m.focus();
});
on('dm-e-quitar', d => cerrarEdicion(+d.i, true));
on('dm-nuevo', () => { DM.err = ''; DM.cart = {}; pintarPedido(); if (!DM.items) { DM.items = []; DM.fuente = 'lo que cargaste'; DM.aviso = ''; } DM.items.unshift({ nombre: '', costo: 0, categoria: '' }); DM.edit = 0; pintar(); const n = $('#dm-e-n'); if (n) n.focus(); });
on('dm-pegar', () => { const d = document.querySelector('.lp-demo-txt'); if (d) { d.open = true; const t = $('#dm-txt'); if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.focus(); } } });
on('dm-flyer', d => { const x = DM.items && DM.items[+d.i]; if (x) abrirFlyer({ modo: 'demo', items: [{ nombre: x.nombre, emoji: '🛍️', precio: tiers(x.costo)[1], img: x.foto || null }], badge: '✨ Nuevo Ingreso' }); });
const calmo = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
async function correr(fn, fuente) {
  DM.busy = true; DM.err = ''; DM.aviso = ''; DM.edit = -1; DM.items = null; DM.msg = ''; DM.cart = {}; DM.pedido = false; pintarPedido(); pintar();
  try {
    const t0 = Date.now(), L = await fn();
    if (L.length && !calmo() && Date.now() - t0 < 1300) await new Promise(r => setTimeout(r, 1300 - (Date.now() - t0)));   // que se llegue a ver la lectura
    if (!L.length) throw new Error('No pudimos leer productos con precio en lo que subiste.');
    DM.items = L; DM.fuente = fuente; guardar();
  } catch (e) { DM.err = e.message || 'No se pudo leer el archivo.'; }
  DM.busy = false; DM.anim = true; pintar(); DM.anim = false;   // las tarjetas entran animadas solo al terminar de leer
  const o = $('#dm-out'); if (o && DM.items) o.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
on('dm-file', (d, el) => { const F = [...el.files].slice(0, 12); el.value = ''; if (F.length) correr(() => deArchivos(F), F.length === 1 ? 'tu archivo' : `tus ${F.length} archivos`); });
on('dm-ej', () => correr(async () => deTexto(EJEMPLO), 'la lista de ejemplo'));
on('dm-usar', () => { const t = ($('#dm-txt') || {}).value || ''; if (t.trim().length < 5) { DM.err = 'Pegá al menos un producto con su precio.'; DM.items = null; return pintar(); } correr(async () => deTexto(t), 'tu texto'); });
on('dm-m', (d, el) => { const v = Number(el.value); if (!(v >= 0)) return; DM[d.k] = v; if (DM.edit >= 0) return; const g = $('#dm-grid'); if (g) g.innerHTML = grilla(); pintarPedido(); guardar(); });
on('dm-guardar', () => { guardar(); DM.pedido = false; pintarPedido(); });

/* ---- después del registro: ofrecer cargar los productos de la prueba ---- */
export const demoPendiente = () => { const d = store.get(K, null); return d && Array.isArray(d.items) && d.items.length && Date.now() - (d.at || 0) < 7 * 864e5 ? d : null; };
export const descartarDemo = () => store.set(K, null);
export function demoPendienteHtml() {
  const d = demoPendiente(); if (!d) return '';
  const pend = d.items.filter(x => !(x.costo > 0) || !(x.nombre || '').trim()).length, fotos = d.items.filter(x => x.foto).length;
  return `<div class="plan-aviso dm-pend"><span>🎁 Tenés <b>${d.items.length} ${d.items.length === 1 ? 'producto' : 'productos'}</b> de lo que probaste en la portada${fotos ? ` (${fotos} con foto)` : ''}.${pend ? ` ${pend === 1 ? 'Uno queda oculto' : pend + ' quedan ocultos'} hasta que les pongas nombre y costo.` : ''}</span><span class="plan-aviso-acc"><button class="btn btn-p btn-sm" data-act="dm-cargar">Cargarlos a mi tienda</button><button class="linkb" data-act="dm-descartar">Descartar</button></span></div>`;
}
// filas listas para insertar (el panel hace el insert y recarga). Las fotos se suben a tu tienda;
// las que quedaron sin nombre o sin costo se cargan ocultas, para completarlas en Productos.
export async function filasDemo(t, subir) {
  const d = demoPendiente(); if (!d) return [];
  const cot = Number(t.cotizacion_usd) > 0 ? Number(t.cotizacion_usd) : 1, vistos = new Set(); let k = 0;
  const L = d.items.filter(x => { if (!x.nombre && x.foto) return true; const n = x.nombre.toLowerCase(); if (vistos.has(n)) return false; vistos.add(n); return true; });
  const out = [];
  for (const x of L) {
    const ok = x.nombre && x.nombre.trim().length >= 2 && x.costo > 0;
    let img = null;
    if (x.foto && subir) { try { const b = await (await fetch(x.foto)).blob(); img = await subir(b, 'demo-' + Date.now().toString(36) + '-' + (k++)); } catch (e) { } }
    out.push({ tenant_id: t.id, nombre: (ok ? x.nombre : (x.nombre || '').trim() || 'Producto a completar ' + (out.length + 1)).slice(0, 160), categoria: (x.categoria || 'General').slice(0, 60),
      costo_usd: ok ? Math.round(x.costo / cot * 10000) / 10000 : 0, variantes: [], emoji: '📦', imagen_url: img, activo: !!ok });
  }
  return out;
}
