// Registro, ingreso, recuperación y alta de la primera tienda.
import { api } from './api.js';
import { CONFIG } from './config.js';
import { $, esc, on, toast, slugify, soloDigitos, normWsp } from './util.js';

const RUBROS = { cosmetica: 'Cosmética', indumentaria: 'Indumentaria', hogar: 'Hogar', electro: 'Electro', kiosco: 'Kiosco', alimentos: 'Almacén', autopartes: 'Repuestos', gastronomia: 'Gastronomía', otro: 'Otro' };
export { RUBROS };
let irPanel = () => { };
export const setIrPanel = f => { irPanel = f; };
const caja = (t, h) => `<div class="page"><div class="hero" style="padding-top:20px"><h1 style="font-size:1.6rem">${t}</h1></div><div class="card">${h}</div><p class="center hint"><a href="/">← Inicio</a></p></div>`;
const err = m => `<div class="err-box" role="alert">${esc(m)}</div>`;
const msg = (id, m, ok) => { const e = $(id); if (e) e.innerHTML = m ? (ok ? `<div class="ok-box">${esc(m)}</div>` : err(m)) : ''; };

export function pantallaLogin(app) {
  app.innerHTML = caja('Ingresar a mi panel', `<div id="m"></div><form data-submit="a-login">
    <div class="fg"><label class="flabel" for="e">Email</label><input class="fi" id="e" name="email" type="email" autocomplete="email" required></div>
    <div class="fg"><label class="flabel" for="p">Contraseña</label><input class="fi" id="p" name="password" type="password" autocomplete="current-password" required></div>
    <button class="btn btn-p" type="submit" id="go">Entrar</button></form>
    <p class="hint center" style="margin-top:12px"><a href="#/olvide">Olvidé mi contraseña</a> · <a href="#/registro">Crear cuenta</a></p>`);
}
export function pantallaRegistro(app) {
  app.innerHTML = caja('Crear mi cuenta', `<div id="m"></div><form data-submit="a-registro">
    <div class="fg"><label class="flabel" for="e">Email</label><input class="fi" id="e" name="email" type="email" autocomplete="email" required></div>
    <div class="fg"><label class="flabel" for="p">Contraseña (mínimo 8 caracteres)</label><input class="fi" id="p" name="password" type="password" minlength="8" autocomplete="new-password" required></div>
    <button class="btn btn-p" type="submit" id="go">Crear cuenta gratis</button></form>
    <p class="hint center" style="margin-top:12px">7 días con todo desbloqueado. Sin tarjeta. · <a href="#/login">Ya tengo cuenta</a></p>`);
}
export function pantallaOlvide(app) {
  app.innerHTML = caja('Recuperar contraseña', `<div id="m"></div><form data-submit="a-olvide"><div class="fg"><label class="flabel" for="e">Tu email</label><input class="fi" id="e" name="email" type="email" required></div><button class="btn btn-p" type="submit" id="go">Enviarme el enlace</button></form>`);
}
export function pantallaNuevaClave(app) {
  app.innerHTML = caja('Elegí una contraseña nueva', `<div id="m"></div><form data-submit="a-clave"><div class="fg"><label class="flabel" for="p">Nueva contraseña</label><input class="fi" id="p" name="password" type="password" minlength="8" required></div><button class="btn btn-p" type="submit" id="go">Guardar</button></form>`);
}
export function pantallaNuevaTienda(app) {
  app.innerHTML = caja('Armemos tu tienda', `<div id="m"></div><form data-submit="a-tienda">
    <div class="fg"><label class="flabel" for="n">Nombre del negocio</label><input class="fi" id="n" name="nombre" maxlength="60" data-input="a-slug" required></div>
    <div class="fg"><label class="flabel" for="s">Tu enlace</label><input class="fi" id="s" name="slug" maxlength="30" minlength="3" required><div class="hint" id="sl">/t/<span id="slv">tu-negocio</span></div></div>
    <div class="fg"><label class="flabel" for="w">WhatsApp donde recibís pedidos</label><input class="fi" id="w" name="whatsapp" type="tel" inputmode="tel" placeholder="11 2345-6789" required></div>
    <div class="fg"><label class="flabel" for="r">Rubro (cargamos 4 productos de ejemplo)</label><select class="fi" id="r" name="rubro">${Object.entries(RUBROS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="fg"><label class="flabel" for="mo">¿Cómo vendés?</label><select class="fi" id="mo" name="modalidad"><option value="hibrido">Híbrido (minorista + mayorista)</option><option value="mayorista">Solo mayorista</option><option value="minorista">Solo minorista</option></select></div>
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
on('a-olvide', (d, f) => envio(f, 'Enviando…', async fd => { await api.olvide(fd.get('email').trim()); msg('#m', 'Si el email existe, te enviamos un enlace.', true); }));
on('a-clave', (d, f) => envio(f, 'Guardando…', async fd => { await api.nuevaClave(fd.get('password')); toast('Contraseña actualizada'); irPanel(); }));
on('a-slug', (d, el) => { const s = $('#s'); if (s && !s.dataset.tocado) { s.value = slugify(el.value); } $('#slv').textContent = (s && s.value) || 'tu-negocio'; });
document.addEventListener('input', e => { if (e.target.id === 's') { e.target.dataset.tocado = 1; const v = $('#slv'); if (v) v.textContent = e.target.value || 'tu-negocio'; } });
on('a-tienda', (d, f) => envio(f, 'Creando…', async fd => {
  const w = normWsp(fd.get('whatsapp'));
  if (w.length < 10) throw new Error('Revisá el WhatsApp: poné código de área y número (ej. 11 2345-6789).');
  await api.crearTienda({ slug: fd.get('slug').trim(), nombre: fd.get('nombre').trim(), rubro: fd.get('rubro'), whatsapp: w, modalidad: fd.get('modalidad'), plan: 'base' });
  irPanel();
}));
