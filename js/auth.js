// Registro, ingreso, recuperación y alta de la primera tienda.
import { api } from './api.js';
import { MARCA } from './marca.js';
import { CONFIG } from './config.js';
import { $, esc, on, toast, slugify, soloDigitos, normWsp, store } from './util.js';
import { asisSwitch } from './asistente.js';
import { cuposHtml, cargarCupos } from './fundadores.js';
// si probó la demo de la portada, el alta arranca con la forma de vender que eligió ahí
const modoDemo = () => { const d = store.get('demo:prods', null), m = d && d.modo; return m === 'menor' ? 'minorista' : m === 'mayor' ? 'mayorista' : 'hibrido'; };

import { RUBROS, queAdapta } from './rubro.js';
// v2.33: con dominio propio configurado, el enlace se ve como subdominio (bazar-luna.eskalapp.com), no como /t/…
const dominioTienda = () => String(MARCA.DOMINIO || '').trim().toLowerCase().replace(/^www\./, '');   // la misma lista que usan las herramientas según el rubro
export { RUBROS };
let irPanel = () => { };
export const setIrPanel = f => { irPanel = f; };
const caja = (t, h) => `<div class="page"><div class="hero" style="padding-top:20px"><h1 style="font-size:1.6rem">${t}</h1></div><div class="card">${h}</div><p class="center hint"><a href="/">← Inicio</a></p></div>`;
const err = m => `<div class="err-box" role="alert">${esc(m)}</div>`;
const msg = (id, m, ok) => { const e = $(id); if (e) e.innerHTML = m ? (ok ? `<div class="ok-box">${esc(m)}</div>` : err(m)) : ''; };

// v2.34 · "Continuar con Google": se muestra solo si Google está activado en Supabase (si no, no aparece nada)
let PROV = null;
const googleHtml = aviso => `<div id="g-box" hidden><button type="button" class="btn btn-g" data-act="a-google" id="g-go"><span class="g-ico" aria-hidden="true">G</span> Continuar con Google</button>
  ${aviso ? '<p class="hint center" style="margin-top:6px">Si es tu primera vez, se crea tu cuenta y aceptás los <a href="#/terminos">Términos</a> y la <a href="#/privacidad">Privacidad</a>.</p>' : ''}<div class="o-sep" role="separator"><span>o con tu email</span></div></div>`;
async function mostrarGoogle() {
  try { PROV = PROV || await api.proveedores(); } catch (e) { PROV = {}; }
  const b = $('#g-box'); if (b && PROV && PROV.google) b.hidden = false;
}
on('a-google', async () => {
  const b = $('#g-go'); lock(b, 'Abriendo Google…'); msg('#m', '');
  try { await api.entrarGoogle(); } catch (e) { msg('#m', e.message); unlock(b); }
});

export function pantallaLogin(app) {
  app.innerHTML = caja('Ingresar a mi panel', `<div id="m"></div>${googleHtml(true)}<form data-submit="a-login">
    <div class="fg"><label class="flabel" for="e">Email</label><input class="fi" id="e" name="email" type="email" autocomplete="email" required></div>
    <div class="fg"><label class="flabel" for="p">Contraseña</label><input class="fi" id="p" name="password" type="password" autocomplete="current-password" required></div>
    <button class="btn btn-p" type="submit" id="go">Entrar</button></form>
    <p class="hint center" style="margin-top:12px"><a href="#/olvide">Olvidé mi contraseña</a> · <a href="#/registro">Crear cuenta</a></p>`);
  mostrarGoogle();
}
export function pantallaRegistro(app) {
  app.innerHTML = caja('Crear mi cuenta', `<div id="m"></div>${googleHtml(false)}<form data-submit="a-registro">
    <div class="fg"><label class="flabel" for="e">Email</label><input class="fi" id="e" name="email" type="email" autocomplete="email" required></div>
    <div class="fg"><label class="flabel" for="p">Contraseña (mínimo 8 caracteres)</label><input class="fi" id="p" name="password" type="password" minlength="8" autocomplete="new-password" required></div>
    <button class="btn btn-p" type="submit" id="go">Crear cuenta gratis</button></form>
    <p class="hint center" style="margin-top:10px">Al crear tu cuenta aceptás los <a href="#/terminos">Términos y condiciones</a> y la <a href="#/privacidad">Política de privacidad</a>.</p>
    <p class="hint center" style="margin-top:8px">Gratis hasta 100 productos, para siempre, y <span class="dias-prueba">14</span> días con todo desbloqueado. Sin tarjeta. · <a href="#/login">Ya tengo cuenta</a></p>${cuposHtml()}`);
  cargarCupos(); mostrarGoogle();
}
export function pantallaOlvide(app, aviso) {
  app.innerHTML = caja('Recuperar contraseña', `<div id="m">${aviso ? err(aviso) : ''}</div><form data-submit="a-olvide"><div class="fg"><label class="flabel" for="e">Tu email</label><input class="fi" id="e" name="email" type="email" required></div><button class="btn btn-p" type="submit" id="go">Enviarme el enlace</button></form>`);
}
export function pantallaNuevaClave(app) {
  app.innerHTML = caja('Elegí una contraseña nueva', `<div id="m"></div><form data-submit="a-clave"><div class="fg"><label class="flabel" for="p">Nueva contraseña</label><input class="fi" id="p" name="password" type="password" minlength="8" required></div><button class="btn btn-p" type="submit" id="go">Guardar</button></form>`);
}
export function pantallaNuevaTienda(app) {
  app.innerHTML = caja('Armemos tu tienda', `<div id="m"></div><form data-submit="a-tienda" data-asistente="alta">${asisSwitch()}
    <div class="fg"><label class="flabel" for="n">Nombre del negocio</label><input class="fi" id="n" name="nombre" maxlength="60" data-input="a-slug" required></div>
    <div class="fg"><label class="flabel" for="s">Tu enlace</label><input class="fi" id="s" name="slug" maxlength="30" minlength="3" required><div class="hint" id="sl">${dominioTienda() ? `<span id="slv">tu-negocio</span>.${esc(dominioTienda())}` : '/t/<span id="slv">tu-negocio</span>'}</div></div>
    <div class="fg"><label class="flabel" for="w">WhatsApp donde recibís pedidos</label><input class="fi" id="w" name="whatsapp" type="tel" inputmode="tel" placeholder="11 2345-6789" required></div>
    <div class="fg"><label class="flabel" for="r">Rubro (cargamos 4 productos de ejemplo)</label><select class="fi" id="r" name="rubro" data-change="a-rubro">${Object.entries(RUBROS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select><div class="hint rub-que" id="r-que">${esc(queAdapta(Object.keys(RUBROS)[0]))}</div></div>
    <div class="fg"><label class="flabel" for="mo">¿Cómo vendés?</label><select class="fi" id="mo" name="modalidad">${[['hibrido', 'Híbrido (minorista + mayorista)'], ['mayorista', 'Solo mayorista'], ['minorista', 'Solo minorista']].map(([v, t]) => `<option value="${v}" ${v === modoDemo() ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <fieldset class="fg modo-st"><legend class="flabel">¿Cómo trabajás con la mercadería?</legend>
      <label><input type="radio" name="modo_stock" value="stock" checked><span><b>Tengo stock</b><small>Vendo lo que tengo en el depósito.</small></span></label>
      <label><input type="radio" name="modo_stock" value="encargo"><span><b>Por encargo</b><small>Junto los pedidos y después le compro al proveedor.</small></span></label>
      <label><input type="radio" name="modo_stock" value="mixto"><span><b>Las dos</b><small>Algunos productos los tengo y otros los encargo.</small></span></label>
      <div class="hint">Lo podés cambiar cuando quieras en Ajustes.</div></fieldset>
    <button class="btn btn-p" type="submit" id="go">Crear mi tienda</button></form>`);
}

const lock = (b, t) => { if (b) { b.disabled = true; b.dataset.t = b.textContent; b.textContent = t; } };
const unlock = b => { if (b) { b.disabled = false; b.textContent = b.dataset.t || b.textContent; } };
async function envio(f, textoBoton, fn) {
  const b = $('#go'); lock(b, textoBoton); msg('#m', '');
  try { await fn(new FormData(f)); } catch (e) { msg('#m', e.message); } finally { unlock(b); }
}
on('a-login', (d, f) => envio(f, 'Entrando…', async fd => { await api.entrar(fd.get('email').trim(), fd.get('password')); irPanel(); }));
on('a-registro', (d, f) => envio(f, 'Creando…', async fd => {
  const r = await api.registrar(fd.get('email').trim(), fd.get('password'));
  if (r && r.session) irPanel(); else msg('#m', 'Cuenta creada. Revisá tu email para confirmarla y después ingresá.', true);
}));
on('a-olvide', (d, f) => envio(f, 'Enviando…', async fd => { await api.olvide(fd.get('email').trim()); msg('#m', 'Si el email tiene una cuenta, te mandamos un enlace (revisá también spam y promociones). Abrilo en la próxima hora: sirve una sola vez.', true); }));
on('a-clave', (d, f) => envio(f, 'Guardando…', async fd => { await api.nuevaClave(fd.get('password')); toast('Contraseña actualizada'); history.replaceState(null, '', location.pathname + '#/panel'); irPanel(); }));
on('a-slug', (d, el) => { const s = $('#s'); if (s && !s.dataset.tocado) { s.value = slugify(el.value); } $('#slv').textContent = (s && s.value) || 'tu-negocio'; });
document.addEventListener('input', e => { if (e.target.id === 's') { e.target.dataset.tocado = 1; const v = $('#slv'); if (v) v.textContent = e.target.value || 'tu-negocio'; } });
on('a-tienda', (d, f) => envio(f, 'Creando…', async fd => {
  const w = normWsp(fd.get('whatsapp'));
  if (w.length < 10) throw new Error('Revisá el WhatsApp: poné código de área y número (ej. 11 2345-6789).');
  await api.crearTienda({ slug: fd.get('slug').trim(), nombre: fd.get('nombre').trim(), rubro: fd.get('rubro'), whatsapp: w, modalidad: fd.get('modalidad'), plan: 'base' });
  const modo = fd.get('modo_stock');
  if (modo && modo !== 'stock') { try { const t = await api.miTienda(); if (t) await api.guardarTienda(t.id, { modo_stock: modo }); } catch (e) { } }   // si falla, queda "con stock" y se cambia en Ajustes
  irPanel();
}));
// v2.33.2: al elegir el rubro se explica qué se adapta (variantes y atajos)
on('a-rubro', (d, el) => { const q = $('#r-que'); if (q) q.textContent = queAdapta(el.value); });
