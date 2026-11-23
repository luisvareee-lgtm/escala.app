import { CONFIG, configurado } from './config.js';
import { $, esc } from './util.js';
import { api, ENLACE, leerEnlace } from './api.js';
import { mostrarTienda } from './store.js';
import { mostrarPanel, setSalir } from './panel.js';
import * as A from './auth.js';
import { inicio } from './landing.js';
import { slugDeHost } from './marca.js';
import { terminos, privacidad } from './legal.js';

const app = () => $('#root');
const slugUrl = () => { const m = location.pathname.match(/\/t\/([a-z0-9-]+)/); return m ? m[1] : (new URLSearchParams(location.search).get('t') || slugDeHost()); };

async function ruta() {
  if (!configurado()) { app().innerHTML = '<div class="page"><div class="err-box">Falta configurar Supabase: editá js/config.js (ver README).</div></div>'; return; }
  const slug = slugUrl();
  if (slug) return mostrarTienda(slug, app());
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  const nuevo = leerEnlace(); if (nuevo.error || nuevo.recupero) Object.assign(ENLACE, nuevo);   // también si cambió solo el fragmento
  let ses = null; try { ses = await api.session(); } catch (e) { }
  // vino del enlace del email (v2.28.1): si venció o ya se usó, se explica y se pide otro; si sirvió, a poner la clave nueva
  if (ENLACE.error) {
    const e = ENLACE.error; ENLACE.error = ''; limpiarUrl('#/olvide');
    return A.pantallaOlvide(app(), /expired|otp|invalid/i.test(e + ' ' + ENLACE.desc) ? 'Ese enlace venció o ya se usó (sirve una sola vez y por 1 hora). Pedí uno nuevo acá abajo y abrilo apenas te llegue.' : 'No pudimos abrir ese enlace. Pedí uno nuevo acá abajo.');
  }
  if (ENLACE.recupero) { ENLACE.recupero = false; limpiarUrl('#/nueva-clave'); return ses ? A.pantallaNuevaClave(app()) : A.pantallaOlvide(app(), 'Ese enlace ya no sirve. Pedí uno nuevo acá abajo y abrilo apenas te llegue.'); }
  if (h === 'terminos') { window.scrollTo(0, 0); return terminos(app()); }
  if (h === 'privacidad') { window.scrollTo(0, 0); return privacidad(app()); }
  if (h === 'nueva-clave') return ses ? A.pantallaNuevaClave(app()) : A.pantallaOlvide(app(), 'Para cambiar la contraseña, pedí el enlace por email.');
  if (h === 'registro') return ses ? irPanel() : A.pantallaRegistro(app());
  if (h === 'login') return ses ? irPanel() : A.pantallaLogin(app());
  if (h === 'olvide') return A.pantallaOlvide(app());
  if (h === 'panel' || h === 'nueva') { if (!ses) { location.hash = '#/login'; return; } return irPanel(); }
  return ses ? irPanel() : inicio(app());
}
// deja la dirección sin ?clave=nueva ni los datos del enlace
const limpiarUrl = hash => { try { history.replaceState(null, '', location.pathname + hash); } catch (e) { } };
async function irPanel() {
  const r = await mostrarPanel(app());
  if (r === 'sin-tienda') { if (location.hash !== '#/nueva') history.replaceState(null, '', '#/nueva'); A.pantallaNuevaTienda(app()); }
  else if (location.hash !== '#/panel') history.replaceState(null, '', '#/panel');
}
A.setIrPanel(irPanel);
setSalir(() => { location.hash = '#/login'; ruta(); });
window.addEventListener('hashchange', ruta);
window.addEventListener('DOMContentLoaded', () => {
  try { if (configurado()) api.onAuth(ev => { if (ev === 'PASSWORD_RECOVERY') location.hash = '#/nueva-clave'; }); } catch (e) { }
  ruta();
});
