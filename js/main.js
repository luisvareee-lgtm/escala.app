import { CONFIG, configurado } from './config.js';
import { $, esc } from './util.js';
import { api } from './api.js';
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
  let ses = null; try { ses = await api.session(); } catch (e) { }
  if (h === 'terminos') { window.scrollTo(0, 0); return terminos(app()); }
  if (h === 'privacidad') { window.scrollTo(0, 0); return privacidad(app()); }
  if (h === 'nueva-clave') return A.pantallaNuevaClave(app());
  if (h === 'registro') return ses ? irPanel() : A.pantallaRegistro(app());
  if (h === 'login') return ses ? irPanel() : A.pantallaLogin(app());
  if (h === 'olvide') return A.pantallaOlvide(app());
  if (h === 'panel' || h === 'nueva') { if (!ses) { location.hash = '#/login'; return; } return irPanel(); }
  return ses ? irPanel() : inicio(app());
}
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
