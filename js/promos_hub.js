// Panel (v2.26): 🎁 Promociones en un solo lugar (pestaña Tienda). Tarjetas para crear, un paso a paso de 3 pasos con
// el simulador "Cómo lo ve tu cliente", la lista con un interruptor por promo, cupones y descuento por monto.
import { api } from './api.js';
import { $, esc, fmt, on, toast, copiar, confirmar } from './util.js';
import { P } from './state.js';
import { urlTiendaDe } from './marca.js';
import { promoOk, promoTxt, promoDesc, promoPartes, promoFalta, montoOk, montoTxt, montoEscalon, montoDesc, cuponTxt, cuponDesc, vigente, promoDeProducto } from './promo.js';
import { camposPromo, promoDe, alCambiarPromo, usarPrecioRef } from './promo_ui.js';
import { previaRecargar } from './vista_previa.js';
import { rubroDe, RUBROS } from './rubro.js';

let precioDe = () => 0;   // precio al público de un producto (lo da el panel)
export const usarPrecioPromo = fn => { precioDe = fn; };
const TARJETAS = {
  ult3: ['🛍️', 'Llevá X, pagá Y', '3x2, 2x1: la última sale gratis.', { tipo: 'ult', desde: 3, valor: 100 }],
  ult2: ['½', '2da unidad con descuento', '50 % off en la 2da, 70 % off en la 2da…', { tipo: 'ult', desde: 2, valor: 50 }],
  nx: ['💲', 'Precio fijo por cantidad', '"2 x $96.000": cada 2, ese precio.', { tipo: 'nx', desde: 2, valor: 0 }],
  cupon: ['🎟️', 'Cupón de descuento', 'Un código: % off, $ off o envío gratis. Con mínimo, fechas y usos.'],
  monto: ['📈', 'Descuento por monto', '"Superando $100.000: 10 % off en todo". El carrito muestra la barra: "te faltan $X".'],
  pct: ['🔢', '% off llevando varias', '"Llevando 3: 15 % off en cada una".', { tipo: 'pct', desde: 3, valor: 15 }],
  montou: ['➖', '$ menos llevando varias', '"Llevando 2: $5.000 menos cada una".', { tipo: 'monto', desde: 2, valor: 5000 }],
  oferta: ['🏷️', 'Oferta con fechas', 'Un % off por producto hasta una fecha: se pone en Productos.'],
  envio: ['🚚', 'Envío gratis desde $', 'Se configura en 🚚 Envíos y pagos.'],
};
const hoyISO = () => new Date().toLocaleDateString('sv');
const finDia = v => v ? new Date(v + 'T23:59:59').toISOString() : null, inicioDia = v => v ? new Date(v + 'T00:00:00').toISOString() : null;
const dia = iso => iso ? new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' }) : '';
const diaLocal = iso => { if (!iso) return ''; const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('sv'); };
const prodsOk = () => (P.prods || []).filter(p => p.activo !== false && !(Array.isArray(p.combo) && p.combo.length));
const cats = () => [...new Set(prodsOk().map(p => p.categoria))].sort((a, b) => a.localeCompare(b, 'es'));
const usos = c => (P.pedidos || []).filter(o => o.cupon_id === c.id && o.estado !== 'cancelado').length;
const linkCupon = c => urlTiendaDe(P.t.slug, '?cupon=' + encodeURIComponent(c.codigo));
function vigTxt(r) {
  const ahora = Date.now();
  if (r.hasta_at && new Date(r.hasta_at).getTime() <= ahora) return '<span class="tag">vencida</span>';
  if (r.desde_at && new Date(r.desde_at).getTime() > ahora) return `<span class="tag warn">empieza el ${dia(r.desde_at)}</span>`;
  return r.hasta_at ? `hasta el ${dia(r.hasta_at)}` : 'sin fecha de fin';
}
function alcanceTxt(r) {
  if (r.alcance === 'tienda') return 'Toda la tienda';
  if (r.alcance === 'categoria') return 'Categoría ' + r.categoria;
  const L = (r.productos || []).map(id => (P.prods || []).find(p => p.id === id)).filter(Boolean);
  return L.length === 1 ? L[0].nombre : `${L.length} productos${L.length ? ': ' + L.slice(0, 2).map(p => p.nombre).join(', ') + (L.length > 2 ? '…' : '') : ''}`;
}
export const alcanceDe = alcanceTxt;
const tarjeta = k => { const [i, t, d] = TARJETAS[k]; return `<div class="ph-card"><span class="ph-ico" aria-hidden="true">${i}</span><span class="ph-tx"><b>${t}</b><small>${d}</small></span><button type="button" class="btn btn-s btn-sm" data-act="ph-nueva" data-k="${k}">${k === 'oferta' || k === 'envio' ? 'Ir' : k === 'monto' && montoActual() ? 'Editar' : 'Crear'}</button></div>`; };
const montoActual = () => (P.promos || []).find(r => r.tipo === 'monto');
const TODAS = ['ult3', 'ult2', 'nx', 'cupon', 'monto', 'pct', 'montou', 'oferta', 'envio'];
const SUGERIDAS = {
  cosmetica: ['ult2', 'ult3', 'monto', 'cupon'], indumentaria: ['ult3', 'ult2', 'nx', 'cupon'],
  alimentos: ['nx', 'pct', 'monto', 'cupon'], kiosco: ['nx', 'ult3', 'pct', 'cupon'], gastronomia: ['nx', 'ult3', 'cupon', 'monto'],
  hogar: ['monto', 'ult2', 'pct', 'cupon'], electro: ['monto', 'cupon', 'ult2', 'montou'], autopartes: ['monto', 'pct', 'cupon', 'nx'],
  ferreteria: ['monto', 'pct', 'cupon', 'nx'], construccion: ['monto', 'pct', 'cupon', 'envio'], libreria: ['nx', 'ult3', 'monto', 'cupon'],
  mascotas: ['nx', 'monto', 'pct', 'cupon'], jugueteria: ['ult2', 'ult3', 'monto', 'cupon'], bijouterie: ['ult3', 'ult2', 'nx', 'cupon'],
  otro: ['ult3', 'ult2', 'nx', 'cupon'],
};
// tienda mayorista: las promos por cantidad y la barra de descuento por monto son para vender al público (híbrida)
const candado = () => `<div class="ph-lock"><p><b>🔒 3x2, 2x1, 2da al 50 %, "2 x $" y la barra de descuento por monto</b> son para vender al público. Tu tienda es mayorista: tu descuento ya son los precios x1 · x3 · x6 · x12.</p>
  <p>Si también le vendés al público, pasala a <b>Híbrida</b>: el público ve tu precio minorista con todas estas promos y tus revendedores entran con su código a la lista mayorista (con tu mínimo de compra).</p>
  <button type="button" class="btn btn-s btn-sm" data-act="ph-a-ajustes">Cambiar la modalidad en Ajustes</button></div>`;
on('ph-a-ajustes', () => { P.tab = 'ajustes'; P.modal = null; P.repintar(); setTimeout(() => { const s = document.querySelector('#aj [name=modalidad]'); if (s) { s.scrollIntoView({ block: 'center' }); s.focus(); } }, 60); });

export function vistaPromos() {
  if (!Array.isArray(P.promos)) return `<div class="tt-uno"><div class="cc"><h3>🎁 Promociones</h3><div class="err-box">Para usar Promociones falta correr la migración v2.26 (21-migracion_v2.26.sql) en Supabase.</div></div></div>`;
  const may = P.t.modalidad === 'mayorista', r = rubroDe(P.t, P.prods);
  // v2.27: las más usadas en tu rubro van primero; el resto, en "Más opciones"
  const prim = may ? ['cupon', 'oferta', 'envio'] : (SUGERIDAS[r] || SUGERIDAS.otro), mas = may ? [] : TODAS.filter(k => !prim.includes(k));
  return `<div class="tt-uno"><div class="cc ph"><h3>🎁 Crear una promoción</h3>${!may && r !== 'otro' ? `<p class="ph-sug">✨ Las que más usan las tiendas de ${esc(RUBROS[r])}</p>` : ''}
    <div class="ph-cards">${prim.map(tarjeta).join('')}</div>
    ${mas.length ? `<details class="ph-mas"><summary>Más opciones</summary><div class="ph-cards">${mas.map(tarjeta).join('')}</div></details>` : ''}
    ${may ? candado() : '<p class="hint">Las promos por cantidad y las ofertas se suman. Un pedido usa un solo descuento general: el cupón o el descuento por monto, el que más le conviene al cliente.</p>'}</div>
    <div class="cc"><h3>Tus promociones</h3>${listaHtml()}</div></div>`;
}
function fila({ id, k, ico, txt, det, on_, extra }) {
  return `<div class="ph-row${on_ ? '' : ' off'}"><span class="ph-ico" aria-hidden="true">${ico}</span><span class="ph-rx"><b>${txt}</b><small>${det}</small></span>
    <label class="ph-sw" title="${on_ ? 'Prendida' : 'Apagada'}"><input type="checkbox" data-change="ph-on" data-k="${k}" data-id="${id}" ${on_ ? 'checked' : ''} aria-label="${on_ ? 'Apagar' : 'Prender'} ${esc(txt)}"><i></i></label>
    <span class="ph-acc">${extra || ''}<button type="button" class="btn btn-s btn-sm" data-act="ph-editar" data-k="${k}" data-id="${id}">Editar</button><button type="button" class="btn btn-s btn-sm" data-act="ph-borrar" data-k="${k}" data-id="${id}" aria-label="Borrar">✕</button></span></div>`;
}
function listaHtml() {
  const R = (P.promos || []).slice().sort((a, b) => (b.tipo === 'monto') - (a.tipo === 'monto')), C = P.cupones || [];
  const filas = R.map(r => fila({ id: r.id, k: 'promo', ico: r.tipo === 'monto' ? '📈' : '🎁', on_: r.activa !== false,
    txt: esc(r.tipo === 'monto' ? montoTxt(r.regla).replace(/^s/, 'S') : promoTxt(r.regla)), det: `${esc(r.tipo === 'monto' ? 'Todo el pedido' : alcanceTxt(r))} · ${vigTxt(r)}` }))
    .concat(C.map(c => fila({ id: c.id, k: 'cupon', ico: '🎟️', on_: c.activa !== false, txt: `${esc(c.codigo)} · ${esc(cuponTxt(c))}`,
      det: [+c.minimo ? 'desde ' + fmt(c.minimo) : '', `${usos(c)}${c.usos_max ? ' de ' + c.usos_max : ''} ${usos(c) === 1 ? 'uso' : 'usos'}`, c.por_cliente ? (c.por_cliente === 1 ? 'uno por cliente' : c.por_cliente + ' por cliente') : '', c.primera_compra ? 'primera compra' : '', vigTxt(c)].filter(Boolean).join(' · '),
      extra: `<button type="button" class="btn btn-s btn-sm" data-act="ph-link" data-id="${c.id}" title="Copiar el enlace de la tienda con el cupón">🔗</button>` })));
  return filas.length ? `<div class="ph-list">${filas.join('')}</div>` : '<p class="muted">Todavía no tenés promociones: elegí una arriba.</p>';
}

/* ---------- paso a paso: promo por cantidad ---------- */
// el producto del ejemplo: el primero al que se aplica la promo
const muestra = m => (m.alcance === 'categoria' ? prodsOk().filter(p => p.categoria === m.categoria) : m.alcance === 'productos' ? m.productos.map(id => (P.prods || []).find(p => p.id === id)).filter(Boolean) : prodsOk())[0];
usarPrecioRef(() => { const m = P.modal, p = m && m.tipo === 'ph-promo' ? muestra(m) : null; return p ? precioDe(p) : 0; });
function simHtml(m) {
  const x = m.regla && promoOk(m.regla) ? m.regla : null;
  const p = muestra(m); if (!p) return '<p class="muted">Elegí a qué productos se aplica para ver el ejemplo.</p>';
  const u = precioDe(p), q = m.sim || (x ? +x.desde : 2), d = x ? promoDesc(x, u, q) : 0, f = x ? promoFalta(x, q) : null, pt = x ? promoPartes(x, u) : null;
  return `<div class="ph-sim-q" role="group" aria-label="Unidades en el carrito">Lleva ${[1, 2, 3, 4, 6].map(n => `<button type="button" class="pill${n === q ? ' on' : ''}" data-act="ph-sim" data-n="${n}" aria-pressed="${n === q}">${n}</button>`).join('')} de <b>${esc(p.nombre)}</b> (${fmt(u)} c/u)</div>
    <div class="ph-sim-c"><span class="ph-sim-img">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="">` : esc(p.emoji || '🛍️')}</span><span><b>${esc(p.nombre)}</b><br><span class="retail-price">${fmt(u)}</span>${x ? `<br><span class="promo-chip">🎁 ${esc(promoTxt(x))}</span>` : ''}</span></div>
    ${pt ? `<div class="promo-box"><div class="pb-h">🎁 Comprá más, pagá menos</div><div class="pb-r"><span class="pb-n">${pt[0]}</span><span class="pb-t">${esc(pt[1])}${pt[3] ? `<small>${esc(pt[3])}</small>` : ''}</span><b class="pb-v">${esc(pt[2])}</b></div></div>` : ''}
    <div class="ph-sim-cart"><div class="srow"><span>${q} × ${esc(p.nombre)}</span><span class="v">${fmt(q * u)}</span></div>
      ${d > 0 ? `<div class="cpromo"><span>🎁 ${esc(promoTxt(x))}</span><b>−${fmt(d)}</b></div>` : x && f ? `<div class="cpromo off"><span>🎁 Sumá ${f} más: ${esc(promoTxt(x))}</span></div>` : ''}
      <div class="srow tot"><span>Total</span><span class="v">${fmt(q * u - d)}</span></div></div>`;
}
function promoModal(m) {
  const pr = m.alcance === 'productos' ? m.productos.map(id => (P.prods || []).find(p => p.id === id)).filter(Boolean) : [];
  const q = (m.q || '').toLowerCase().trim(), res = q ? prodsOk().filter(p => !m.productos.includes(p.id) && [p.nombre, p.sku, p.categoria, p.marca].join(' ').toLowerCase().includes(q)).slice(0, 8) : [];
  const seg = (k, L, v) => `<div class="seg seg-wrap" role="group">${L.map(([a, b]) => `<button type="button" class="${v === a ? 'on' : ''}" data-act="ph-set" data-k="${k}" data-v="${a}" aria-pressed="${v === a}">${b}</button>`).join('')}</div>`;
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal ph-m" role="dialog" aria-modal="true" aria-labelledby="ph-t"><div class="view-title" id="ph-t">${m.id ? 'Editar promo' : 'Nueva promo'}</div><div id="mm"></div>
    <form data-submit="ph-guardar" class="ph-form"><div class="ph-pasos">
      <section><h4>1 · La promo</h4>${camposPromo(m.regla, false)}</section>
      <section><h4>2 · ¿A qué productos?</h4>${seg('alcance', [['tienda', 'Toda la tienda'], ['categoria', 'Una categoría'], ['productos', 'Algunos productos']], m.alcance)}
        ${m.alcance === 'categoria' ? `<div class="fg" style="margin-top:8px"><label class="flabel" for="ph-cat">Categoría</label><select class="fi" id="ph-cat" data-change="ph-cat"><option value="">Elegí una…</option>${cats().map(c => `<option ${c === m.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>` : ''}
        ${m.alcance === 'productos' ? `<div class="dz-vt-sel" style="margin-top:8px">${pr.map(p => `<span class="dz-vt-chip"><span>${esc(p.nombre)}</span><button type="button" data-act="ph-quitar" data-id="${p.id}" aria-label="Quitar ${esc(p.nombre)}">✕</button></span>`).join('') || '<span class="muted" style="font-size:.8rem">Buscalos abajo.</span>'}</div>
          <input class="fi" id="ph-q" data-input="ph-q" placeholder="Buscar producto para sumar…" value="${esc(m.q || '')}" autocomplete="off" aria-label="Buscar producto"><div class="dz-vt-res" id="ph-res">${res.map(p => `<button type="button" data-act="ph-poner" data-id="${p.id}">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="">` : `<span>${esc(p.emoji || '🛍️')}</span>`}<span>${esc(p.nombre)}</span></button>`).join('')}</div>` : ''}
        <p class="hint">Si un producto tiene una promo propia, esa le gana a la de su categoría, y la de la categoría a la de toda la tienda. Los combos no llevan.</p></section>
      <section><h4>3 · ¿Hasta cuándo?</h4>${seg('vig', [['siempre', 'Siempre (hasta que la apagues)'], ['hasta', 'Hasta una fecha']], m.vig)}
        ${m.vig === 'hasta' ? `<div class="row2" style="margin-top:8px"><div class="fg"><label class="flabel" for="ph-h">Hasta el (incluido)</label><input class="fi" id="ph-h" type="date" min="${hoyISO()}" value="${esc(m.hasta || '')}" data-change="ph-fecha" data-k="hasta"></div><div class="fg"><label class="flabel" for="ph-d">Empieza el (vacío = ya)</label><input class="fi" id="ph-d" type="date" value="${esc(m.desde || '')}" data-change="ph-fecha" data-k="desde"></div></div>` : ''}</section>
    </div>
    <div class="ph-sim"><div class="flabel">👁 Cómo lo ve tu cliente</div><div id="ph-sim">${simHtml(m)}</div></div>
    <button class="btn btn-p" type="submit">${m.id ? 'Guardar cambios' : 'Crear promo'}</button><button type="button" class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cancelar</button></form></div></div>`;
}
const pintarSim = () => { const m = P.modal, b = $('#ph-sim'); if (m && m.tipo === 'ph-promo' && b) b.innerHTML = simHtml(m); };
alCambiarPromo(x => { const m = P.modal; if (m && m.tipo === 'ph-promo') { m.regla = x; m.sim = x ? +x.desde : m.sim; pintarSim(); } });
// lo escrito en el paso 1 se guarda antes de repintar el modal (al cambiar el paso 2 o 3)
const leerRegla = () => { const f = document.querySelector('form[data-submit=ph-guardar]'); if (!f) return; try { const x = promoDe(new FormData(f)); if (x) P.modal.regla = x; } catch (e) { } };
const repintar = () => { leerRegla(); P.repintar(); };

/* ---------- cupón ---------- */
function cuponModal(m) {
  const c = m.c, ej = 50000, base = cuponDesc(c, ej);
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal ph-m" role="dialog" aria-modal="true" aria-labelledby="ph-t"><div class="view-title" id="ph-t">${m.id ? 'Editar cupón' : 'Nuevo cupón'}</div><div id="mm"></div>
    <form data-submit="ph-cup-guardar" class="ph-form"><div class="ph-pasos">
    <section><h4>1 · El código</h4><div class="cup-r"><input class="fi" id="cu-c" name="codigo" maxlength="20" value="${esc(c.codigo || '')}" placeholder="Ej: HOLA10" autocomplete="off" autocapitalize="characters" data-input="cu-set" data-k="codigo" required><button type="button" class="btn btn-s btn-sm" data-act="cu-inventar">🎲 Inventar</button></div><p class="hint">Letras y números (de 3 a 20). Tu cliente lo escribe en “¿Tenés un cupón?” o entra con el enlace y se aplica solo.</p></section>
    <section><h4>2 · El descuento</h4><div class="seg" role="group">${[['pct', '% off'], ['monto', '$ off'], ['envio', 'Envío gratis']].map(([k, n]) => `<button type="button" class="${c.tipo === k ? 'on' : ''}" data-act="cu-tipo" data-v="${k}" aria-pressed="${c.tipo === k}">${n}</button>`).join('')}</div>
      ${c.tipo === 'envio' ? '<p class="hint" style="margin-top:6px">El envío queda en $0. Se puede sumar al descuento por monto.</p>' : `<div class="fg" style="margin-top:8px"><label class="flabel" for="cu-v">${c.tipo === 'pct' ? 'Descuento % (1 a 90)' : 'Pesos de descuento'}</label><input class="fi" id="cu-v" type="number" min="1" step="any" value="${c.valor || ''}" placeholder="${c.tipo === 'pct' ? 'Ej: 10' : 'Ej: 5000'}" data-input="cu-set" data-k="valor"></div><p class="hint">No se suma a productos que ya tienen descuento (promo, oferta o combo).</p>`}
      <div class="fg"><label class="flabel" for="cu-m">Compra mínima $ (vacío = sin mínimo)</label><input class="fi" id="cu-m" type="number" min="0" step="1" value="${+c.minimo || ''}" data-input="cu-set" data-k="minimo"></div></section>
    <section><h4>3 · Fechas y usos</h4><div class="seg" role="group">${[['siempre', 'Siempre'], ['hasta', 'Hasta una fecha']].map(([k, n]) => `<button type="button" class="${m.vig === k ? 'on' : ''}" data-act="ph-set" data-k="vig" data-v="${k}" aria-pressed="${m.vig === k}">${n}</button>`).join('')}</div>
      ${m.vig === 'hasta' ? `<div class="row2" style="margin-top:8px"><div class="fg"><label class="flabel" for="ph-h">Hasta el (incluido)</label><input class="fi" id="ph-h" type="date" min="${hoyISO()}" value="${esc(m.hasta || '')}" data-change="ph-fecha" data-k="hasta"></div><div class="fg"><label class="flabel" for="ph-d">Empieza el (vacío = ya)</label><input class="fi" id="ph-d" type="date" value="${esc(m.desde || '')}" data-change="ph-fecha" data-k="desde"></div></div>` : ''}
      <div class="fg" style="margin-top:8px"><label class="flabel" for="cu-u">Cuántas veces se puede usar en total (vacío = sin límite)</label><input class="fi" id="cu-u" type="number" min="1" step="1" value="${c.usos_max || ''}" data-input="cu-set" data-k="usos_max"></div>
      <label class="chk"><input type="checkbox" data-change="cu-chk" data-k="por_cliente" ${c.por_cliente ? 'checked' : ''}><span>Una vez por cliente (se cuenta por su WhatsApp)</span></label>
      <label class="chk"><input type="checkbox" data-change="cu-chk" data-k="primera_compra" ${c.primera_compra ? 'checked' : ''}><span>Solo para la primera compra</span></label></section>
    </div>
    <div class="ph-sim"><div class="flabel">👁 Cómo lo ve tu cliente al confirmar</div><div class="ph-sim-cart"><div class="cup-ok">🎟️ <b>${esc(c.codigo || 'CODIGO')}</b> · ${esc(cuponTxt(c))}${base ? ` · <b>-${fmt(base)}</b>` : ''}</div>
      <div class="srow"><span>Productos</span><span class="v">${fmt(ej)}</span></div>${base ? `<div class="srow"><span>🎟️ Cupón ${esc(c.codigo || '')}</span><span class="v save">-${fmt(base)}</span></div>` : ''}<div class="srow tot"><span>Total</span><span class="v">${fmt(ej - base)}${c.tipo === 'envio' ? ' + envío gratis' : ''}</span></div>
      ${+c.minimo > ej ? `<p class="hint">Con un pedido de ${fmt(ej)} no alcanza el mínimo de ${fmt(c.minimo)}.</p>` : ''}</div>${m.id && c.codigo ? `<button type="button" class="btn btn-s btn-sm" style="margin-top:6px" data-act="ph-link" data-id="${m.id}">🔗 Copiar el enlace de tu tienda con este cupón</button>` : ''}</div>
    <button class="btn btn-p" type="submit">${m.id ? 'Guardar cambios' : 'Crear cupón'}</button><button type="button" class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cancelar</button></form></div></div>`;
}

/* ---------- descuento por monto ---------- */
function montoModal(m) {
  const E = m.esc, ok = montoOk({ escalones: E.map(s => ({ desde: +s.desde, pct: +s.pct })) }), x = ok ? { escalones: E.map(s => ({ desde: +s.desde, pct: +s.pct })) } : null;
  const ej = x ? Math.round(+x.escalones[0].desde * 0.8 / 1000) * 1000 : 0, me = x ? montoEscalon(x, ej) : null;
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal ph-m" role="dialog" aria-modal="true" aria-labelledby="ph-t"><div class="view-title" id="ph-t">📈 Descuento por monto</div><div id="mm"></div>
    <form data-submit="ph-monto-guardar" class="ph-form"><div class="ph-pasos">
    <section><h4>1 · Escalones (hasta 3)</h4>${E.map((s, i) => `<div class="ph-esc"><span>Superando $</span><input class="fi" type="number" min="1" step="any" value="${s.desde || ''}" data-input="mo-set" data-i="${i}" data-k="desde" aria-label="Superando pesos, escalón ${i + 1}" placeholder="100000"><span>→</span><input class="fi" type="number" min="1" max="50" step="any" value="${s.pct || ''}" data-input="mo-set" data-i="${i}" data-k="pct" aria-label="Porcentaje de descuento, escalón ${i + 1}" placeholder="10"><span>% off</span>${E.length > 1 ? `<button type="button" class="btn btn-s btn-sm" data-act="mo-del" data-i="${i}" aria-label="Quitar escalón ${i + 1}">✕</button>` : ''}</div>`).join('')}
      ${E.length < 3 ? '<button type="button" class="btn btn-s btn-sm" data-act="mo-add">+ Escalón</button>' : ''}<p class="hint">Cada escalón más alto que el anterior (en pesos y en %). El descuento va de 1 a 50 % y se calcula sobre el total de productos, con las promos ya descontadas. Es para tu público (no aplica en la lista mayorista).</p></section>
    <section><h4>2 · ¿Hasta cuándo?</h4><div class="seg" role="group">${[['siempre', 'Siempre'], ['hasta', 'Hasta una fecha']].map(([k, n]) => `<button type="button" class="${m.vig === k ? 'on' : ''}" data-act="ph-set" data-k="vig" data-v="${k}" aria-pressed="${m.vig === k}">${n}</button>`).join('')}</div>
      ${m.vig === 'hasta' ? `<div class="row2" style="margin-top:8px"><div class="fg"><label class="flabel" for="ph-h">Hasta el (incluido)</label><input class="fi" id="ph-h" type="date" min="${hoyISO()}" value="${esc(m.hasta || '')}" data-change="ph-fecha" data-k="hasta"></div><div class="fg"><label class="flabel" for="ph-d">Empieza el (vacío = ya)</label><input class="fi" id="ph-d" type="date" value="${esc(m.desde || '')}" data-change="ph-fecha" data-k="desde"></div></div>` : ''}</section></div>
    <div class="ph-sim"><div class="flabel">👁 Cómo lo ve tu cliente en el carrito</div><div class="ph-sim-cart" id="mo-sim">${x ? `<div class="prog prog-monto"><div class="prog-t">🎁 Te faltan <span>${fmt(me.sig.desde - ej)}</span> para ${String(me.sig.pct).replace('.', ',')} % off en todo tu pedido</div><div class="bar"><i style="width:${Math.round(ej / me.sig.desde * 100)}%"></i></div></div>
      <div class="prog prog-monto ok"><div class="prog-t">🎁 ¡${String(x.escalones[0].pct).replace('.', ',')} % off en todo tu pedido!</div><div class="bar"><i style="width:100%"></i></div></div><p class="hint">Con un pedido de ${fmt(x.escalones[0].desde)}: −${fmt(montoDesc(x, +x.escalones[0].desde))}.</p>` : '<p class="muted">Completá un escalón para ver el ejemplo.</p>'}</div></div>
    <button class="btn btn-p" type="submit">Guardar</button><button type="button" class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cancelar</button></form></div></div>`;
}

export function promosModal(m) {
  if (m.tipo === 'ph-promo') return promoModal(m);
  if (m.tipo === 'ph-cupon') return cuponModal(m);
  if (m.tipo === 'ph-monto') return montoModal(m);
  return '';
}

/* ---------- acciones ---------- */
const recargar = async ir => { try { [P.promos, P.cupones] = await Promise.all([api.misPromos(), api.misCupones()]); } catch (e) { } previaRecargar(ir); };
const vigDe = r => ({ vig: r && r.hasta_at ? 'hasta' : 'siempre', hasta: diaLocal(r && r.hasta_at), desde: diaLocal(r && r.desde_at) });
const ALE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
on('ph-nueva', d => {
  if (d.k === 'oferta') { P.tab = 'productos'; P.modal = null; P.repintar(); toast('Editá un producto → 🏷️ Oferta con fechas (o elegí varios → ✏️ Editar)'); return; }
  if (d.k === 'envio') { P.irSeccion && P.irSeccion('envios'); return; }
  if (d.k === 'cupon') { P.modal = { tipo: 'ph-cupon', c: { codigo: '', tipo: 'pct', valor: 10, minimo: 0, usos_max: null, por_cliente: null, primera_compra: false }, vig: 'siempre' }; P.repintar(); return; }
  if (d.k === 'monto') { const r = montoActual(); P.modal = Object.assign({ tipo: 'ph-monto', id: r && r.id, esc: r ? r.regla.escalones.map(s => ({ ...s })) : [{ desde: 100000, pct: 10 }] }, vigDe(r)); P.repintar(); return; }
  const base = TARJETAS[d.k][3], x = { ...base }; if (x.tipo === 'nx') { const p = prodsOk()[0], u = p ? precioDe(p) : 0; x.valor = u ? Math.floor(x.desde * u * 0.9 / 100) * 100 : 1000; }
  P.modal = { tipo: 'ph-promo', regla: x, alcance: 'tienda', categoria: '', productos: [], vig: 'siempre', sim: x.desde }; P.repintar();
});
on('ph-editar', d => {
  if (d.k === 'cupon') { const c = (P.cupones || []).find(x => x.id === d.id); if (!c) return; P.modal = Object.assign({ tipo: 'ph-cupon', id: c.id, c: { ...c } }, vigDe(c)); P.repintar(); return; }
  const r = (P.promos || []).find(x => x.id === d.id); if (!r) return;
  if (r.tipo === 'monto') { P.modal = Object.assign({ tipo: 'ph-monto', id: r.id, esc: r.regla.escalones.map(s => ({ ...s })) }, vigDe(r)); P.repintar(); return; }
  P.modal = Object.assign({ tipo: 'ph-promo', id: r.id, regla: { ...r.regla }, alcance: r.alcance, categoria: r.categoria || '', productos: (r.productos || []).slice(), sim: +r.regla.desde }, vigDe(r)); P.repintar();
});
on('ph-set', d => { const m = P.modal; if (!m) return; m[d.k] = d.v; if (d.k === 'alcance') { m.sim = m.regla ? +m.regla.desde : 2; } repintar(); });
on('ph-cat', (d, el) => { P.modal.categoria = el.value; leerRegla(); pintarSim(); });
on('ph-fecha', (d, el) => { P.modal[d.k] = el.value; });
on('ph-q', (d, el) => { P.modal.q = el.value; const m = P.modal, q = el.value.toLowerCase().trim(), b = $('#ph-res'); if (!b) return;
  b.innerHTML = (q ? prodsOk().filter(p => !m.productos.includes(p.id) && [p.nombre, p.sku, p.categoria, p.marca].join(' ').toLowerCase().includes(q)).slice(0, 8) : []).map(p => `<button type="button" data-act="ph-poner" data-id="${p.id}">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="">` : `<span>${esc(p.emoji || '🛍️')}</span>`}<span>${esc(p.nombre)}</span></button>`).join(''); });
on('ph-poner', d => { const m = P.modal; if (!m.productos.includes(d.id)) m.productos.push(d.id); repintar(); const q = $('#ph-q'); if (q) q.focus(); });
on('ph-quitar', d => { const m = P.modal; m.productos = m.productos.filter(x => x !== d.id); repintar(); });
on('ph-sim', d => { P.modal.sim = +d.n; leerRegla(); pintarSim(); });
const fechas = m => {
  if (m.vig !== 'hasta') return { desde_at: null, hasta_at: null };
  if (!m.hasta || m.hasta < hoyISO()) throw new Error('Elegí hasta qué día dura (hoy o más adelante).');
  if (m.desde && m.desde > m.hasta) throw new Error('Tiene que empezar antes de terminar.');
  return { desde_at: inicioDia(m.desde), hasta_at: finDia(m.hasta) };
};
const mm = t => { const b = $('#mm'); if (b) { b.innerHTML = `<div class="err-box">${esc(t)}</div>`; b.scrollIntoView({ block: 'nearest' }); } };
on('ph-guardar', async (d, f) => {
  const m = P.modal; let regla;
  try {
    regla = promoDe(new FormData(f)); if (!regla) throw new Error('Completá la promo (o elegí un atajo).');
    if (m.alcance === 'categoria' && !m.categoria) throw new Error('Elegí la categoría.');
    if (m.alcance === 'productos' && !m.productos.length) throw new Error('Elegí al menos un producto.');
    const datos = Object.assign({ tipo: 'cantidad', regla, alcance: m.alcance, categoria: m.alcance === 'categoria' ? m.categoria : null, productos: m.alcance === 'productos' ? m.productos : [] }, fechas(m));
    if (!m.id) Object.assign(datos, { tenant_id: P.t.id, activa: true });
    await api.guardarPromo(m.id, datos); await recargar('producto'); P.modal = null; P.repintar(); toast(m.id ? '🎁 Promo guardada' : '🎁 Promo creada: ya la ven tus clientes');
  } catch (e) { mm(/promociones|relation|schema cache/i.test(e.message) && !/Elegí|Completá|Tiene/.test(e.message) ? 'Para crear promociones falta correr la migración v2.26 en Supabase.' : e.message); }
});
// cupón
const simCupon = () => { clearTimeout(on.cu); on.cu = setTimeout(() => { const b = document.querySelector('.ph-m .ph-sim'), n = document.createElement('div'); n.innerHTML = cuponModal(P.modal); const x = n.querySelector('.ph-sim'); if (b && x) b.innerHTML = x.innerHTML; }, 150); };
on('cu-set', (d, el) => { const c = P.modal.c; c[d.k] = d.k === 'codigo' ? el.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') : el.value === '' ? null : Number(el.value); if (d.k === 'codigo' && el.value !== c.codigo) el.value = c.codigo; simCupon(); });
on('cu-tipo', d => { const c = P.modal.c; c.tipo = d.v; c.valor = d.v === 'envio' ? 0 : d.v === 'pct' ? (c.valor > 0 && c.valor <= 90 ? c.valor : 10) : (c.valor >= 100 ? c.valor : 5000); P.repintar(); });
on('cu-chk', (d, el) => { const c = P.modal.c; c[d.k] = d.k === 'por_cliente' ? (el.checked ? 1 : null) : el.checked; simCupon(); });
on('cu-inventar', () => { let s = ''; for (let i = 0; i < 6; i++) s += ALE[Math.floor(Math.random() * ALE.length)]; P.modal.c.codigo = s; P.repintar(); });
on('ph-cup-guardar', async () => {
  const m = P.modal, c = m.c;
  try {
    if (!/^[A-Z0-9][A-Z0-9_-]{2,19}$/.test(c.codigo || '')) throw new Error('El código va de 3 a 20 letras o números (sin espacios).');
    if (c.tipo === 'pct' && !(c.valor >= 1 && c.valor <= 90)) throw new Error('El descuento va de 1 a 90 %.');
    if (c.tipo === 'monto' && !(c.valor > 0)) throw new Error('Poné cuántos pesos de descuento.');
    if (c.usos_max != null && !(Number.isInteger(+c.usos_max) && +c.usos_max >= 1)) throw new Error('Los usos son un número entero (o vacío = sin límite).');
    const datos = Object.assign({ codigo: c.codigo, tipo: c.tipo, valor: c.tipo === 'envio' ? 0 : Math.round(+c.valor * 100) / 100, minimo: Math.max(0, Math.round(+c.minimo || 0)), usos_max: c.usos_max ? Math.floor(+c.usos_max) : null, por_cliente: c.por_cliente ? 1 : null, primera_compra: !!c.primera_compra }, fechas(m));
    if (!m.id) Object.assign(datos, { tenant_id: P.t.id, activa: true });
    await api.guardarCupon(m.id, datos); await recargar(); P.modal = null; P.repintar(); toast(m.id ? '🎟️ Cupón guardado' : `🎟️ Cupón ${datos.codigo} creado`);
  } catch (e) { mm(/cupones_codigo_uk|duplicate/i.test(e.message) ? `Ya tenés un cupón ${c.codigo}: elegí otro código.` : /cupones|relation|schema cache/i.test(e.message) && !/código|descuento|pesos|usos|Elegí|empezar/.test(e.message) ? 'Para crear cupones falta correr la migración v2.26 en Supabase.' : e.message); }
});
// monto
on('mo-set', (d, el) => { const s = P.modal.esc[+d.i]; if (s) s[d.k] = el.value === '' ? '' : Number(el.value); clearTimeout(on.mo); on.mo = setTimeout(() => { const b = $('#mo-sim'), n = document.createElement('div'); n.innerHTML = montoModal(P.modal); const x = n.querySelector('#mo-sim'); if (b && x) b.innerHTML = x.innerHTML; }, 250); });
on('mo-add', () => { const E = P.modal.esc, u = E[E.length - 1] || { desde: 50000, pct: 5 }; E.push({ desde: (+u.desde || 50000) * 2, pct: Math.min(50, (+u.pct || 5) + 5) }); P.repintar(); });
on('mo-del', d => { P.modal.esc.splice(+d.i, 1); P.repintar(); });
on('ph-monto-guardar', async () => {
  const m = P.modal, regla = { escalones: m.esc.map(s => ({ desde: Math.round(+s.desde), pct: Math.round(+s.pct * 100) / 100 })) };
  try {
    if (!montoOk(regla)) throw new Error('Revisá los escalones: cada uno más alto que el anterior, en pesos y en % (de 1 a 50 %).');
    const datos = Object.assign({ tipo: 'monto', regla, alcance: 'tienda' }, fechas(m));
    if (!m.id) Object.assign(datos, { tenant_id: P.t.id, activa: true });
    await api.guardarPromo(m.id, datos); await recargar('carrito'); P.modal = null; P.repintar(); toast('📈 Descuento por monto guardado');
  } catch (e) { mm(e.message); }
});
// lista
on('ph-on', async (d, el) => {
  try { if (d.k === 'cupon') await api.guardarCupon(d.id, { activa: el.checked }); else await api.guardarPromo(d.id, { activa: el.checked }); await recargar(); P.repintar(); toast(el.checked ? 'Prendida' : 'Apagada: tus clientes ya no la ven'); }
  catch (e) { el.checked = !el.checked; toast(e.message); }
});
on('ph-borrar', async (d, b) => {
  if (!confirmar(b, '¿Borrar? Tocá de nuevo')) return;
  try { if (d.k === 'cupon') await api.borrarCupon(d.id); else await api.borrarPromo(d.id); await recargar(); P.repintar(); toast('Borrada'); } catch (e) { toast(e.message); }
});
on('ph-link', d => { const c = (P.cupones || []).find(x => x.id === d.id); if (c) { copiar(linkCupon(c)); toast('🔗 Enlace copiado: con ese enlace el cupón se aplica solo'); } });
export const promoVigenteDe = p => { const r = promoDeProducto(p, P.promos); return r ? r.regla : null; };
export const hayPromos = () => Array.isArray(P.promos);
export { vigente };
