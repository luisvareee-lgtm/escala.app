// Pestañas "Tienda" (estilos), "Ajustes" (precios, cobro, integraciones), accesos y plan.
import { datosHtml } from './planes.js';
import { api } from './api.js';
import { esc, fmt, on, toast, $ } from './util.js';
import { P, can, aviso, planEf, PLAN_NOMBRE } from './state.js';
import { redimensionar } from './img.js';

const COLORES = ['#1d4ba8', '#0f766e', '#7c3aed', '#be185d', '#c2410c', '#15803d', '#0f172a', '#b45309'];
const S = { integ: undefined, color: null, tema: null, eslogan: null, nombre: null, usd: null, logo: undefined, msg: '', err: '' };
export const resetAj = () => Object.assign(S, { integ: undefined, color: null, tema: null, eslogan: null, nombre: null, usd: null, logo: undefined, msg: '', err: '' });
const v = k => S[k] !== null && S[k] !== undefined ? S[k] : (k === 'usd' ? P.t.mostrar_usd : k === 'logo' ? P.t.logo_url : P.t[k]);
const msgs = () => (S.err ? `<div class="err-box">${esc(S.err)}</div>` : '') + (S.msg ? `<div class="ok-box">${esc(S.msg)}</div>` : '');

export function vistaTienda() {
  const c = v('color'), tema = v('tema'), logo = S.logo !== undefined ? S.logo : P.t.logo_url;
  const claro = tema === 'oscuro' ? ['#111827', '#f3f4f6', '#1f2937'] : ['#f5f7fb', '#111827', '#ffffff'];
  return `${msgs()}<div class="grid2"><div class="cc"><h3>🎨 Estilo de tu tienda</h3>
  <div class="fg"><label class="flabel">Nombre visible</label><input class="fi" maxlength="60" value="${esc(v('nombre'))}" data-input="aj-s" data-k="nombre"></div>
  <div class="fg"><label class="flabel">Frase corta (opcional)</label><input class="fi" maxlength="90" value="${esc(v('eslogan') || '')}" data-input="aj-s" data-k="eslogan" placeholder="Ej: Perfumería mayorista en Posadas"></div>
  <div class="fg"><label class="flabel">Color principal</label><div class="swatch">${COLORES.map(x => `<button type="button" style="background:${x}" class="${c.toLowerCase() === x ? 'on' : ''}" data-act="aj-color" data-c="${x}" aria-label="Color ${x}"></button>`).join('')}<input type="color" value="${esc(c)}" data-input="aj-colorp" aria-label="Elegir otro color" style="width:34px;height:34px;border:none;background:none;padding:0"></div></div>
  <div class="fg"><label class="flabel">Tema</label><div class="seg">${[['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']].map(([k, n]) => `<button type="button" class="${tema === k ? 'on' : ''}" data-act="aj-tema" data-k="${k}">${n}</button>`).join('')}</div></div>
  <div class="fg"><label class="flabel">Logo</label>${logo ? `<img src="${esc(logo)}" alt="Logo actual" style="height:48px;border-radius:8px;display:block;margin-bottom:6px">` : ''}<input type="file" accept="image/*" data-change="aj-logo" aria-label="Subir logo">${logo ? '<button class="btn btn-s btn-sm" style="margin-top:6px" data-act="aj-nologo">Quitar logo</button>' : ''}</div>
  <div class="fg"><label class="flabel"><input type="checkbox" data-change="aj-usd" ${v('usd') ? 'checked' : ''} ${can('usd') ? '' : 'disabled'}> Mostrar también el precio en dólares${aviso('usd')}</label></div>
  <button class="btn btn-p" data-act="aj-guardar-estilo">Guardar estilo</button></div>
  <div class="cc"><h3>Vista previa</h3><div id="prev-tienda" style="border-radius:14px;overflow:hidden;border:1px solid var(--bd);background:${claro[0]};color:${claro[1]}"><div style="background:${esc(c)};color:#fff;padding:14px;display:flex;gap:10px;align-items:center">${logo ? `<img src="${esc(logo)}" alt="" style="height:36px;border-radius:6px;background:#fff">` : ''}<div><b>${esc(v('nombre'))}</b><div style="font-size:.78rem;opacity:.9">${esc(v('eslogan') || '')}</div></div></div>
  <div style="padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px">${[['Perfume árabe 100ml', 17600], ['Crema hidratante', 9800]].map(([n, p]) => `<div style="background:${claro[2]};border:1px solid rgba(128,128,128,.25);border-radius:10px;padding:8px"><div style="height:46px;border-radius:8px;background:${esc(c)};opacity:.85;margin-bottom:6px"></div><div style="font-size:.78rem">${n}</div><b>${fmt(p)}</b><div style="margin-top:6px;background:${esc(c)};color:#fff;border-radius:8px;text-align:center;font-size:.75rem;padding:5px">+ Agregar</div></div>`).join('')}</div></div></div></div>`;
}
on('aj-s', (d, el) => { S[d.k] = el.value; const p = $('#prev-tienda b'); if (d.k === 'nombre' && p) p.textContent = el.value; });
on('aj-color', d => { S.color = d.c; P.repintar(); });
on('aj-colorp', (d, el) => { S.color = el.value; clearTimeout(on.tc); on.tc = setTimeout(() => P.repintar(), 250); });
on('aj-tema', d => { S.tema = d.k; P.repintar(); });
on('aj-usd', (d, el) => { S.usd = el.checked; });
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
  if (!can('webhook')) return `<div class="cc"><h3>🔌 Integraciones ${aviso('webhook')}</h3><p class="hint">Mercado Pago en el carrito, webhooks para n8n / WhatsApp API y aviso de pedidos nuevos por email están en el plan Full API. Durante la prueba gratis las tenés desbloqueadas.</p></div>`;
  if (S.integ === undefined) { S.integ = null; const fin = () => { const el = $('#integ-box'); if (el) el.outerHTML = integraciones(); }; api.estadoIntegraciones().then(x => { S.integ = x; fin(); }).catch(e => { S.integ = { error: e.message }; fin(); }); }
  const g = S.integ;
  if (!g) return '<div class="cc" id="integ-box"><h3>🔌 Integraciones</h3><p class="hint"><span class="spin"></span> Cargando…</p></div>';
  if (g.error) return `<div class="cc"><h3>🔌 Integraciones</h3><div class="err-box">${esc(g.error)}</div></div>`;
  return `<div class="cc" id="integ"><h3>🔌 Integraciones</h3>
  <div class="fg"><label class="flabel">💳 Mercado Pago — ${g.mp_configurado ? '<b style="color:var(--green)">conectado</b>' : 'sin conectar'}</label>
  <p class="hint">Tus clientes pagan online y la plata entra directo a TU cuenta de Mercado Pago. Escala no cobra comisión por venta. Cuando el pago se aprueba, el pedido pasa solo a “cobrado” y se descuenta el stock.
  Dónde sacar el Access Token: developers.mercadopago.com → Tus integraciones → tu aplicación → Credenciales de producción (los nombres pueden variar). Se guarda protegido en el servidor (ni desde el panel se puede leer) y nunca se vuelve a mostrar.</p>
  <form data-submit="ig-mp" style="display:flex;gap:6px;flex-wrap:wrap"><input class="fi" name="token" type="password" autocomplete="off" placeholder="APP_USR-… o TEST-…" style="flex:1;min-width:200px" aria-label="Access Token de Mercado Pago"><button class="btn btn-p btn-sm" type="submit">${g.mp_configurado ? 'Reemplazar' : 'Conectar'}</button>${g.mp_configurado ? '<button class="btn btn-s btn-sm" type="button" data-act="ig-mp-quitar">Desconectar</button>' : ''}</form></div>
  <div class="fg"><label class="flabel">🔔 Webhook de pedidos nuevos</label>
  <p class="hint">Cada pedido nuevo se envía a tu URL (n8n, Make, Evolution API, tu CRM…) en formato JSON, firmado. Guardá la URL en “Datos y precios”. Para verificar que viene de Escala: HMAC-SHA256 de <code>timestamp + "." + cuerpo</code> con esta clave, comparado con la cabecera <code>X-Escala-Signature</code>.</p>
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

export function vistaAjustes() {
  const t = P.t, pc = n => Math.round(Number(t['margen_' + n]) * 100), ef = planEf(t);
  const dias = t.trial_ends_at ? Math.ceil((new Date(t.trial_ends_at) - Date.now()) / 864e5) : 0;
  const lock = f => can(f) ? '' : ' disabled';
  const plan = `<div class="cc"><h3>📦 Tu plan: ${esc(PLAN_NOMBRE[t.plan])}</h3>${dias > 0 ? `<p class="ok-box">Prueba gratis: te quedan ${dias} días con todo desbloqueado (Full API).</p>` : ''}
  <p class="hint">Productos ilimitados y 0% de comisión por venta en todos los planes.</p><div class="tblw"><table class="tbl"><tr><th>Herramienta</th><th>Base</th><th>Pro</th><th>Full API</th></tr>${[['Catálogo ilimitado, escalas x1/x3/x6/x12, importador, carrito, pedidos, catálogo PDF, actualización masiva', 1, 1, 1], ['Dashboard, bimonetario USD/ARS, Meta Pixel, stock crítico y automático, carritos abandonados', 0, 1, 1], ['Modo híbrido, sub-revendedores, comparador de proveedores, referencia de mercado', 0, 1, 1], ['Mercado Pago en el carrito, webhooks firmados y aviso de pedidos nuevos', 0, 0, 1]].map(r => `<tr><td>${r[0]}</td>${r.slice(1).map(x => `<td>${x ? '✅' : '—'}</td>`).join('')}</tr>`).join('')}</table></div><button class="btn btn-p btn-sm" style="margin-top:10px;width:auto" data-act="p-planes">Ver precios y cambiar de plan</button></div>${datosHtml()}`;
  return `<div id="aj-m">${msgs()}</div><div class="grid2"><form data-submit="p-guardar" class="cc" id="aj">
  <h3>⚙️ Datos y precios</h3>
  <div class="fg"><label class="flabel">WhatsApp (con 549…)</label><input class="fi" name="whatsapp" value="${esc(t.whatsapp)}" inputmode="numeric" required></div>
  <div class="fg"><label class="flabel">Modalidad</label><select class="fi" name="modalidad">${['minorista', 'mayorista', 'hibrido'].map(m => `<option value="${m}" ${t.modalidad === m ? 'selected' : ''}>${{ minorista: 'Minorista', mayorista: 'Mayorista', hibrido: 'Híbrido (minorista + acceso mayorista)' }[m]}</option>`).join('')}</select>${aviso('hibrido')}</div>
  <div class="fg"><label class="flabel">Cotización del dólar ($)</label><input class="fi" name="cotizacion_usd" type="number" step="0.01" min="1" value="${Number(t.cotizacion_usd)}" required></div>
  <div class="fg"><label class="flabel">Márgenes % (x1 / x3 / x6 / x12, de mayor a menor)</label><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${[1, 3, 6, 12].map(n => `<input class="fi" name="m${n}" type="number" min="0" max="900" step="1" value="${pc(n)}" aria-label="Margen x${n}" required>`).join('')}</div></div>
  <div class="fg"><label class="flabel">Margen mínimo que nunca querés perder (%)</label><input class="fi" name="margen_piso" type="number" min="0" max="900" value="${Math.round(Number(t.margen_piso) * 100)}"></div>
  <div class="fg"><label class="flabel">Compra mínima mayorista ($)</label><input class="fi" name="compra_minima" type="number" min="0" value="${Number(t.compra_minima)}"></div>
  <div class="fg"><label class="flabel">Gastos fijos mensuales ($) — para el punto de equilibrio</label><input class="fi" name="gastos_fijos" type="number" min="0" value="${Number(t.gastos_fijos)}"></div>
  <div class="fg"><label class="flabel">Alias / CBU para transferencias</label><input class="fi" name="alias_cobro" value="${esc(t.alias_cobro || '')}" maxlength="80"></div>
  <div class="fg"><label class="flabel">Meta Pixel ID${aviso('pixel')}</label><input class="fi" name="pixel_id" value="${esc(t.pixel_id || '')}" inputmode="numeric"${lock('pixel')}></div>
  <div class="fg"><label class="flabel">Webhook (https://…)${aviso('webhook')}</label><input class="fi" name="webhook_url" value="${esc(t.webhook_url || '')}" type="url"${lock('webhook')}></div>
  <button class="btn btn-p" type="submit" id="aj-go">Guardar cambios</button></form>
  <div><form data-submit="p-codigo" class="cc"><h3>🔑 Accesos mayoristas</h3><p class="hint" style="margin:4px 0 8px">Para el modo híbrido: tus revendedores ingresan este código para ver la lista mayorista. Sin código, el acceso es libre. El código se guarda protegido (no se puede leer ni desde el panel).</p><div id="cod-m"></div><input class="fi" name="codigo" placeholder="Nuevo código (mín. 6 letras/números)" autocomplete="off" style="margin-bottom:8px"><button class="btn btn-s" type="submit">${t.codigo_hash ? 'Cambiar código' : 'Activar código'}</button>${t.codigo_hash ? '<button type="button" class="btn btn-s" style="margin-top:8px" data-act="p-codigo-off">Quitar código</button>' : ''}</form>${integraciones()}${plan}</div></div>`;
}
