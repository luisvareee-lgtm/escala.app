// Pestañas "Tienda" (estilos), "Ajustes" (precios, cobro, integraciones), accesos y plan.
import { datosHtml } from './planes.js';
import { api } from './api.js';
import { esc, fmt, on, toast, $, copiar } from './util.js';
import { P, can, aviso, planEf, PLAN_NOMBRE, LIMITE_GRATIS } from './state.js';
import { redimensionar } from './img.js';
import { asisSwitch } from './asistente.js';
import { pruebaFrase } from './fundadores.js';
import { vistaSimple, avanzadas } from './vista.js';
import { MARCA, urlTiendaDe } from './marca.js';
import { previaSync } from './vista_previa.js';
import { RUBROS, inferirRubro } from './rubro.js';

const S = { integ: undefined, color: null, tema: null, eslogan: null, nombre: null, usd: null, logo: undefined, msg: '', err: '' };
export const resetAj = () => Object.assign(S, { integ: undefined, color: null, tema: null, eslogan: null, nombre: null, usd: null, logo: undefined, msg: '', err: '' });
const v = k => S[k] !== null && S[k] !== undefined ? S[k] : (k === 'usd' ? P.t.mostrar_usd : k === 'logo' ? P.t.logo_url : P.t[k]);
const msgs = () => (S.err ? `<div class="err-box">${esc(S.err)}</div>` : '') + (S.msg ? `<div class="ok-box">${esc(S.msg)}</div>` : '');

// v2.26: los datos de la tarjeta 🎨 Estilo de la pestaña Tienda (el color y el fondo los dan las paletas de diseno.js)
export function estiloCampos() {
  const logo = S.logo !== undefined ? S.logo : P.t.logo_url;
  return `${msgs()}<div class="fg"><label class="flabel" for="aj-nom">Nombre visible</label><input class="fi" id="aj-nom" maxlength="60" value="${esc(v('nombre'))}" data-input="aj-s" data-k="nombre"></div>
  <div class="fg"><label class="flabel" for="aj-esl">Frase corta (opcional)</label><input class="fi" id="aj-esl" maxlength="90" value="${esc(v('eslogan') || '')}" data-input="aj-s" data-k="eslogan" placeholder="Ej: Perfumería mayorista en Posadas"></div>
  <div class="fg"><span class="flabel">Logo</span>${logo ? `<img src="${esc(logo)}" alt="Logo actual" style="height:48px;border-radius:8px;display:block;margin-bottom:6px">` : ''}<label class="filebtn">🖼️ ${logo ? 'Cambiar logo' : 'Subir logo'}<input type="file" accept="image/*" data-change="aj-logo" aria-label="Subir logo"></label>${logo ? ' <button class="btn btn-s btn-sm" data-act="aj-nologo">Quitar logo</button>' : ''}</div>
  ${can('usd') ? `<div class="fg"><label class="flabel"><input type="checkbox" data-change="aj-usd" ${v('usd') ? 'checked' : ''}> Mostrar también el precio en dólares</label></div>` : ''}`;
}
export const estiloSucio = () => ['nombre', 'eslogan', 'usd'].some(k => S[k] !== null && S[k] !== undefined) || S.logo !== undefined;
export const borradorEstilo = () => ({ nombre: String(v('nombre') || '').trim() || P.t.nombre, eslogan: String(v('eslogan') || '').trim() || null, logo_url: S.logo !== undefined ? S.logo : P.t.logo_url, mostrar_usd: !!v('usd') && can('usd') });
export const estiloAviso = (m, e) => { S.msg = m || ''; S.err = e || ''; };
export const resetEstilo = () => Object.assign(S, { color: null, tema: null, eslogan: null, nombre: null, usd: null, logo: undefined });
on('aj-s', (d, el) => { S[d.k] = el.value; previaSync(); });
on('aj-color', d => { S.color = d.c; P.repintar(); });
on('aj-colorp', (d, el) => { S.color = el.value; clearTimeout(on.tc); on.tc = setTimeout(() => P.repintar(), 250); });
on('aj-tema', d => { S.tema = d.k; P.repintar(); });
on('aj-usd', (d, el) => { S.usd = el.checked; previaSync(); });
on('aj-nologo', () => { S.logo = null; P.repintar(); });
on('aj-logo', async (d, el) => {
  try { const f = el.files[0]; if (!f) return; const b = await redimensionar(f, 400); S.logo = await api.subirFoto(P.t.id, b, 'logo-' + Date.now()); S.err = ''; } catch (e) { S.err = e.message; }
  P.repintar();
});
on('aj-guardar-estilo', async () => {
  const c = { nombre: (v('nombre') || '').trim(), eslogan: (v('eslogan') || '').trim() || null, color: v('color'), tema: v('tema'), mostrar_usd: !!v('usd') && can('usd'), logo_url: S.logo !== undefined ? S.logo : P.t.logo_url };
  try { P.t = await api.guardarTienda(P.t.id, c) || P.t; resetAj(); S.msg = '¡Estilo guardado! Ya lo ven tus clientes.'; } catch (e) { S.err = e.message; }
  P.repintar(); window.scrollTo(0, 0);
});


function integraciones() {
  if (!can('webhook')) return `<details class="cc aj-integ" id="integ-box"><summary><b>🔌 Integraciones</b> <small class="muted">Mercado Pago en el carrito, webhooks y aviso por email</small></summary><p class="hint" style="margin-top:8px">Mercado Pago en el carrito, webhooks para n8n / WhatsApp API y aviso de pedidos nuevos por email están en el plan ${esc(PLAN_NOMBRE.api)}. Durante la prueba gratis las tenés desbloqueadas.</p></details>`;
  if (S.integ === undefined) { S.integ = null; const fin = () => { const el = $('#integ-box'); if (el) el.outerHTML = integraciones(); }; api.estadoIntegraciones().then(x => { S.integ = x; fin(); }).catch(e => { S.integ = { error: e.message }; fin(); }); }
  const g = S.integ;
  if (!g) return '<div class="cc" id="integ-box"><h3>🔌 Integraciones</h3><p class="hint"><span class="spin"></span> Cargando…</p></div>';
  if (g.error) return `<div class="cc"><h3>🔌 Integraciones</h3><div class="err-box">${esc(g.error)}</div></div>`;
  return `<div class="cc" id="integ"><h3>🔌 Integraciones</h3>
  <div class="fg"><label class="flabel">💳 Mercado Pago — ${g.mp_configurado ? '<b style="color:var(--green)">conectado</b>' : 'sin conectar'}</label>
  <p class="hint">Tus clientes pagan online y la plata entra directo a TU cuenta de Mercado Pago. ${esc(MARCA.NOMBRE)} no cobra comisión por venta. Cuando el pago se aprueba, el pedido pasa solo a “cobrado” y se descuenta el stock.
  Dónde sacar el Access Token: developers.mercadopago.com → Tus integraciones → tu aplicación → Credenciales de producción (los nombres pueden variar). Se guarda protegido en el servidor (ni desde el panel se puede leer) y nunca se vuelve a mostrar.</p>
  <form data-submit="ig-mp" style="display:flex;gap:6px;flex-wrap:wrap"><input class="fi" name="token" type="password" autocomplete="off" placeholder="APP_USR-… o TEST-…" style="flex:1;min-width:200px" aria-label="Access Token de Mercado Pago"><button class="btn btn-p btn-sm" type="submit">${g.mp_configurado ? 'Reemplazar' : 'Conectar'}</button>${g.mp_configurado ? '<button class="btn btn-s btn-sm" type="button" data-act="ig-mp-quitar">Desconectar</button>' : ''}</form></div>
  <div class="fg"><label class="flabel">🔔 Webhook de pedidos nuevos</label>
  <p class="hint">Cada pedido nuevo se envía a tu URL (n8n, Make, Evolution API, tu CRM…) en formato JSON, firmado. Guardá la URL en “Datos y precios”. Para verificar que viene de ${esc(MARCA.NOMBRE)}: HMAC-SHA256 de <code>timestamp + "." + cuerpo</code> con esta clave, comparado con la cabecera <code>X-Escala-Signature</code>.</p>
  <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center"><code id="ig-sec" style="word-break:break-all;font-size:.72rem;flex:1;min-width:200px">${esc(g.webhook_secret)}</code><button class="btn btn-s btn-sm" type="button" data-act="ig-copiar" data-v="${esc(g.webhook_secret)}">Copiar</button><button class="btn btn-s btn-sm" type="button" data-act="ig-secreto-nuevo">Regenerar</button></div>
  <button class="btn btn-s btn-sm" type="button" style="margin-top:8px" data-act="ig-probar" ${g.webhook_url ? '' : 'disabled'}>${g.webhook_url ? 'Enviar evento de prueba' : 'Guardá primero la URL del webhook'}</button></div>
  <form data-submit="ig-notif" class="fg"><label class="flabel">✉️ Aviso de pedido nuevo por email</label>
  <input class="fi" name="email" type="email" value="${esc(g.email || '')}" placeholder="tu@email.com" maxlength="120" aria-label="Email para avisos">
  <label style="display:flex;gap:6px;align-items:center;margin:8px 0"><input type="checkbox" name="notif" ${g.notif_email ? 'checked' : ''}> Avisarme cada pedido nuevo</label>
  <button class="btn btn-s btn-sm" type="submit">Guardar aviso</button></form></div>`;
}
const recargarInteg = async (r) => { S.integ = r; P.repintar(); };
on('ig-mp', async (d, f) => {
  const tk = new FormData(f).get('token').trim(); if (!tk) { S.err = 'Pegá tu Access Token.'; return P.repintar(); }
  try { await recargarInteg(await api.guardarIntegraciones(tk)); S.err = ''; S.msg = 'Mercado Pago conectado. Probalo con un pedido de prueba.'; } catch (e) { S.err = e.message; }
  P.repintar(); window.scrollTo(0, 0);
});
on('ig-mp-quitar', async () => { try { await recargarInteg(await api.guardarIntegraciones(null, true)); S.msg = 'Mercado Pago desconectado.'; S.err = ''; } catch (e) { S.err = e.message; } P.repintar(); });
on('ig-secreto-nuevo', async () => { try { await recargarInteg(await api.guardarIntegraciones(null, false, true)); S.msg = 'Generamos una clave nueva: actualizala en tu receptor de webhooks.'; S.err = ''; } catch (e) { S.err = e.message; } P.repintar(); });
on('ig-copiar', d => import('./util.js').then(u => u.copiar(d.v)));
on('ig-probar', async () => { try { const r = await api.probarWebhook(); S.err = r.ok ? '' : 'Tu servidor respondió ' + (r.status || r.error || 'con error') + '.'; S.msg = r.ok ? 'Evento de prueba entregado (respuesta ' + r.status + ').' : ''; } catch (e) { S.err = e.message; S.msg = ''; } P.repintar(); window.scrollTo(0, 0); });
on('ig-notif', async (d, f) => {
  const fd = new FormData(f), email = (fd.get('email') || '').trim(), notif = fd.get('notif') === 'on';
  if (notif && !email) { S.err = 'Poné un email para recibir los avisos.'; return P.repintar(); }
  try { P.t = await api.guardarTienda(P.t.id, { email_contacto: email || null, notif_email: notif }) || P.t; S.integ = undefined; S.msg = 'Aviso guardado.'; S.err = ''; } catch (e) { S.err = e.message; }
  P.repintar();
});

// v2.33 · Los avisos de Mayorista Pro aparecen solo cuando se intenta activar algo que el plan no incluye (escalas, híbrido)
const upg = que => `<div class="plan-aviso aj-upg" role="status"><span>⭐ ${que} es parte de <b>${esc(PLAN_NOMBRE.pro)}</b>. Lo activás cuando quieras y tus precios de hoy no cambian.</span><button type="button" class="btn btn-p btn-sm" data-act="p-planes" data-p="pro">Ver Mayorista Pro</button></div>`;
on('aj-escalas', () => { const el = $('#aj-upg-esc'); if (el) el.innerHTML = upg('Vender con precios por cantidad (x3 · x6 · x12: tus clientes ven cuánto les falta para pagar menos y llevan más)'); });
on('aj-modo', (d, el) => {
  const box = $('#aj-upg-mod');
  if (el.value === 'hibrido' && !can('hibrido')) { el.value = d.prev && d.prev !== 'hibrido' ? d.prev : 'minorista'; if (box) box.innerHTML = upg('El modo híbrido (minorista + lista mayorista con código)'); return; }
  el.dataset.prev = el.value; if (box && can('hibrido')) box.innerHTML = '';
});

// Nombres de los niveles de precio (v2.33): se ven en la barra del pedido de la tienda ("desbloqueá el precio Mayorista").
export const NIV_DEF = ['Inicial', 'Mayorista', 'Especial', '🏆 Super'];
const NIV_PRESETS = { may: NIV_DEF, min: ['Unidad', 'Pack x3', 'Pack x6', 'Pack x12'] };
export const nivelesDe = t => { const n = t && t.diseno && t.diseno.niveles; return Array.isArray(n) && n.length === 4 && n.every(x => typeof x === 'string' && x.trim()) ? n : NIV_DEF; };
const nivelesHtml = t => { const n = nivelesDe(t);
  return `<div class="fg" id="aj-niv"><label class="flabel">Cómo se llama cada precio por cantidad</label><div class="niv-in">${['x1', 'x3', 'x6', 'x12+'].map((k, i) => `<label><small>${k}</small><input class="fi" name="niv${i}" maxlength="20" required value="${esc(n[i])}" aria-label="Nombre del precio ${k}"></label>`).join('')}</div>
    <p class="hint">Se ven en la barra del pedido de tu tienda: “desbloqueá el precio ${esc(n[1])}”. Rápido: <button type="button" class="linkb" data-act="aj-niv" data-k="may">Inicial · Mayorista · Especial · Super</button> o <button type="button" class="linkb" data-act="aj-niv" data-k="min">Unidad · Pack x3 · Pack x6 · Pack x12</button></p></div>`; };
on('aj-niv', d => { const n = NIV_PRESETS[d.k]; if (!n) return; n.forEach((v, i) => { const e = document.querySelector(`#aj-niv [name=niv${i}]`); if (e) e.value = v; }); });

// Campos del formulario de precios: en vista simple, los avanzados quedan plegados (v2.23).
function camposPrecio(t, lock) {
  const eg = t.modalidad === 'minorista' ? '' : 'escala_grupo' in t ? `<div class="fg"><label class="flabel" for="aj-eg">Cómo se suman las unidades para x3 · x6 · x12</label><select class="fi" id="aj-eg" name="escala_grupo">${[['producto', 'Por producto (cada producto por separado)'], ['categoria', 'Por categoría (se suman los productos de la misma categoría)'], ['carrito', 'Todo el carrito (se suma cualquier producto)']].map(([k, n]) => `<option value="${k}" ${(t.escala_grupo || 'producto') === k ? 'selected' : ''}>${n}</option>`).join('')}</select><div class="hint">Ej. por categoría: 2 sérums + 4 cremas de “Cuidado facial” = 6 unidades, y los 6 pasan al precio x6. Los productos con precio único no suman.</div></div>` : '';
  const piso = `<div class="fg"><label class="flabel">Margen mínimo que nunca querés perder (%)</label><input class="fi" name="margen_piso" type="number" min="0" max="900" value="${Math.round(Number(t.margen_piso) * 100)}"></div>`, min = `<div class="fg"><label class="flabel">Compra mínima mayorista ($)</label><input class="fi" name="compra_minima" type="number" min="0" value="${Number(t.compra_minima)}"></div>`, gastos = `<div class="fg"><label class="flabel">Gastos fijos mensuales ($) — para el punto de equilibrio</label><input class="fi" name="gastos_fijos" type="number" min="0" value="${Number(t.gastos_fijos)}"></div>`, alias = `<div class="fg"><label class="flabel">Alias / CBU para transferencias</label><input class="fi" name="alias_cobro" value="${esc(t.alias_cobro || '')}" maxlength="80"></div>`, pixel = `<div class="fg"><label class="flabel">Meta Pixel ID${aviso('pixel')}</label><input class="fi" name="pixel_id" value="${esc(t.pixel_id || '')}" inputmode="numeric"${lock('pixel')}></div>`, hook = `<div class="fg"><label class="flabel">Webhook (https://…)${aviso('webhook')}</label><input class="fi" name="webhook_url" value="${esc(t.webhook_url || '')}" type="url"${lock('webhook')}></div>`;
  const escOk = can('escalas'), niv = t.modalidad === 'minorista' || !escOk ? '' : nivelesHtml(t), eg2 = escOk ? eg : '';
  // v2.33: Google Analytics 4 al lado del Meta Pixel (si la base ya tiene la columna)
  const ga4 = 'ga4_id' in t ? `<div class="fg"><label class="flabel" for="aj-ga4">Google Analytics 4 (ID G-…)${aviso('pixel')}</label><input class="fi" id="aj-ga4" name="ga4_id" value="${esc(t.ga4_id || '')}" placeholder="G-AB12CD34EF" autocomplete="off" spellcheck="false" maxlength="18"${lock('pixel')}></div>` : '';
  const tec = pixel + ga4 + hook;
  if (!vistaSimple()) return eg2 + niv + piso + min + gastos + alias + (can('pixel') ? tec : avanzadas(tec, '⚙️ Integraciones: Meta Pixel, Google Analytics y webhooks', true));
  const may = t.modalidad !== 'minorista';
  return (may ? min + niv : '') + alias + avanzadas(eg2 + piso + (may ? '' : min) + gastos + tec);
}

export function vistaAjustes() {
  const t = P.t, pc = n => Math.round(Number(t['margen_' + n]) * 100), ef = planEf(t);
  const dias = t.trial_ends_at ? Math.ceil((new Date(t.trial_ends_at) - Date.now()) / 864e5) : 0;
  const lock = f => can(f) ? '' : ' disabled';
  const plan = `<div class="cc"><h3>📦 Tu plan: ${esc(PLAN_NOMBRE[dias > 0 ? t.plan : ef] || PLAN_NOMBRE[t.plan])}</h3>${dias > 0 ? `<p class="ok-box">${pruebaFrase(t)}</p>` : ''}
  <p class="hint">0% de comisión por venta en todos los planes. ${esc(PLAN_NOMBRE.base)} publica hasta ${LIMITE_GRATIS} productos, gratis para siempre; los planes pagos, todos los que quieras.</p><div class="tblw"><table class="tbl"><tr><th>Herramienta</th>${['base', 'pro', 'api'].map(k => `<th>${esc(PLAN_NOMBRE[k])}</th>`).join('')}</tr>${[['Productos publicados', `hasta ${LIMITE_GRATIS}`, 'ilimitados', 'ilimitados'], ['Pedidos por WhatsApp, 0% comisión, carga desde Excel o CSV', 1, 1, 1], ['Flyers', '3 por mes', 'ilimitados', 'ilimitados'], ['Estadísticas', 'visitas y lo más visto', 'origen, embudo, Meta Pixel y GA4', 'origen, embudo, Meta Pixel y GA4'], ['Escalas x1/x3/x6/x12, importador de fotos, chats y PDF, catálogo PDF para revendedores', 0, 1, 1], ['Presupuestos, caja diaria, cobranzas, resultado del negocio y avisos en el celular', 0, 1, 1], ['Dashboard, ventas en dólares, stock automático, reposición, modo híbrido con código, sin marca Eskalapp', 0, 1, 1], ['Mercado Pago en el carrito, webhooks firmados y aviso de pedidos por email', 0, 0, 1]].map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(x => `<td>${typeof x === 'string' ? esc(x) : x ? '✅' : '—'}</td>`).join('')}</tr>`).join('')}</table></div><button class="btn btn-p btn-sm" style="margin-top:10px;width:auto" data-act="p-planes">Ver precios y cambiar de plan</button></div>${datosHtml()}`;
  return `<div id="aj-m">${msgs()}</div><div class="grid2"><form data-submit="p-guardar" class="cc" id="aj" data-asistente="ajustes">
  <h3>⚙️ Datos y precios</h3>${asisSwitch()}
  <div class="fg"><label class="flabel">WhatsApp (con 549…)</label><input class="fi" name="whatsapp" value="${esc(t.whatsapp)}" inputmode="numeric" required></div>
  ${rubroCampo(t)}
  <div class="fg"><label class="flabel" for="aj-ms">¿Cómo trabajás con la mercadería?</label><select class="fi" id="aj-ms" name="modo_stock">${[['stock', 'Tengo stock'], ['encargo', 'Por encargo (compro después de recibir el pedido)'], ['mixto', 'Las dos (algunos productos por encargo)']].map(([k, n]) => `<option value="${k}" ${(t.modo_stock || 'stock') === k ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
  <div class="fg"><label class="flabel" for="aj-dem">Demora de los productos por encargo (días)</label><input class="fi" id="aj-dem" name="demora_encargo" type="number" min="1" max="120" value="${Number(t.demora_encargo || 7)}"><div class="hint">Tu cliente lo ve antes de comprar: “por encargo · llega en N días”.</div></div>
  <div class="fg"><label class="flabel">Modalidad</label><select class="fi" name="modalidad" data-change="aj-modo" data-prev="${esc(t.modalidad)}">${['minorista', 'mayorista', 'hibrido'].map(m => `<option value="${m}" ${t.modalidad === m ? 'selected' : ''}>${{ minorista: 'Minorista', mayorista: 'Mayorista', hibrido: 'Híbrido (minorista + acceso mayorista)' }[m]}</option>`).join('')}</select><div id="aj-upg-mod">${t.modalidad === 'hibrido' && !can('hibrido') ? upg('El modo híbrido (minorista + lista mayorista con código)') : ''}</div></div>
  <div class="fg"><label class="flabel">Cotización del dólar ($)</label><input class="fi" name="cotizacion_usd" type="number" step="0.01" min="1" value="${Number(t.cotizacion_usd)}" required></div>
  ${can('escalas') ? `<div class="fg"><label class="flabel">Márgenes % (x1 / x3 / x6 / x12, de mayor a menor)</label><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${[1, 3, 6, 12].map(n => `<input class="fi" name="m${n}" type="number" min="0" max="900" step="1" value="${pc(n)}" aria-label="Margen x${n}" required>`).join('')}</div></div>`
    : `<div class="fg"><label class="flabel" for="aj-m1">Margen % sobre el costo</label><input class="fi" id="aj-m1" name="m1" type="number" min="0" max="900" step="1" value="${pc(1)}" required>${[3, 6, 12].map(n => `<input type="hidden" name="m${n}" value="${pc(n)}">`).join('')}
      <button type="button" class="linkb" data-act="aj-escalas" style="margin-top:6px">＋ Precios por cantidad (x3 · x6 · x12)</button><div id="aj-upg-esc"></div></div>`}
  ${camposPrecio(t, lock)}
  <button class="btn btn-p" type="submit" id="aj-go">Guardar cambios</button></form>
  <div><form data-submit="p-codigo" class="cc" data-asistente="ajustes"${vistaSimple() && t.modalidad !== 'hibrido' && !t.codigo_hash ? ' hidden' : ''}><h3>🔑 Accesos mayoristas</h3><p class="hint" style="margin:4px 0 8px">Para el modo híbrido: tus revendedores ingresan este código para ver la lista mayorista. Sin código, el acceso es libre. El código se guarda protegido (no se puede leer ni desde el panel).</p><div id="cod-m"></div><input class="fi" name="codigo" placeholder="Nuevo código (mín. 6 letras/números)" autocomplete="off" style="margin-bottom:8px"><button class="btn btn-s" type="submit">${t.codigo_hash ? 'Cambiar código' : 'Activar código'}</button>${t.codigo_hash ? '<button type="button" class="btn btn-s" style="margin-top:8px" data-act="p-codigo-off">Quitar código</button>' : ''}</form>${vistaSimple() ? avanzadas(integraciones(), '🔌 Integraciones (Mercado Pago, webhooks, email)') : integraciones()}${demoCard(t)}${plan}</div></div>`;
}

// v2.31: prestar la tienda como demo de Eskalapp (permiso de la dueña). La portada la elige el admin.
const urlDemo = t => urlTiendaDe(t.slug, '?demo');
function demoCard(t) {
  if (t.demo_activa === undefined) return '';   // la base todavía no tiene la migración 24
  return `<div class="cc aj-demo"><h3>🎬 Prestar mi tienda como demo</h3>
    <p class="hint" style="margin:4px 0 10px">Eskalapp la puede mostrar como ejemplo real a otros comercios, con un enlace especial. En la demo se ve tu tienda tal cual (también la lista mayorista, sin código) y se puede armar un pedido de prueba, pero <b>esos pedidos no te llegan ni se guardan</b>. Lo apagás cuando quieras.</p>
    <label class="aj-sw"><input type="checkbox" data-change="aj-demo" ${t.demo_activa ? 'checked' : ''}> <span>${t.demo_activa ? 'Sí, presto mi tienda como demo' : 'No, mi tienda no es demo'}</span></label>
    ${t.demo_activa ? `<div class="aj-demo-l"><span class="sel">${esc(urlDemo(t))}</span><button type="button" class="btn btn-s btn-sm" data-act="aj-demo-copiar">Copiar</button><a class="btn btn-s btn-sm" href="${esc(urlDemo(t))}" target="_blank" rel="noopener">Ver la demo</a></div>${t.demo_portada ? '<p class="ok-box" style="margin-top:8px">⭐ Aparece en la portada de Eskalapp como tienda real funcionando. ¡Gracias!</p>' : ''}` : ''}</div>`;
}
on('aj-demo', async (d, el) => {
  const v = !!el.checked; el.disabled = true;
  try { P.t = await api.guardarTienda(P.t.id, { demo_activa: v }) || P.t; toast(v ? '🎬 Tu tienda ya se puede ver como demo' : 'Listo: tu tienda ya no es demo'); }
  catch (e) { toast(/demo_activa/.test(e.message) ? 'Falta actualizar la base: corré la migración 24 en Supabase.' : e.message); }
  P.repintar();
});
on('aj-demo-copiar', () => copiar(urlDemo(P.t)));

// v2.27: ¿Qué vendés? Decide las herramientas (talles en ropa, tonos en cosmética, sabores en almacén) y las promos sugeridas.
function rubroCampo(t) {
  const r = RUBROS[t.rubro] ? t.rubro : 'otro', inf = r === 'otro' ? inferirRubro(P.prods) : null;
  return `<div class="fg"><label class="flabel" for="aj-rub">¿Qué vendés?</label><select class="fi" id="aj-rub" name="rubro">${Object.entries(RUBROS).map(([k, n]) => `<option value="${k}" ${r === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <div class="hint">Adapta tus herramientas: talles en ropa, tonos en cosmética, sabores en almacén, y las promos que te sugerimos.</div>
    ${inf ? `<div class="aj-sug">💡 Por tus productos parece <b>${esc(RUBROS[inf])}</b>. <button type="button" class="btn btn-s btn-sm" data-act="aj-rubro" data-k="${inf}">Usar ${esc(RUBROS[inf])}</button></div>` : ''}</div>`;
}
on('aj-rubro', async d => {
  if (!RUBROS[d.k]) return;
  try { P.t = await api.guardarTienda(P.t.id, { rubro: d.k }) || P.t; toast(`Listo: tu tienda es de ${RUBROS[d.k]}`); P.repintar(); } catch (e) { toast(e.message); }
});
