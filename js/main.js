import { CONFIG, configurado } from './config.js';
import { $, esc } from './util.js';
import { api } from './api.js';
import { mostrarTienda } from './store.js';
import { mostrarPanel, setSalir } from './panel.js';
import * as A from './auth.js';

const app = () => $('#root');
const slugUrl = () => { const m = location.pathname.match(/\/t\/([a-z0-9-]+)/); return m ? m[1] : new URLSearchParams(location.search).get('t'); };

function inicio() {
  const F = [['📦', 'Precios por volumen solos', 'Cargás tu costo en dólares y la app arma x1, x3, x6 y x12 con tus márgenes. Cambia el dólar: se actualiza todo.'],
    ['📥', 'Importá la lista como venga', 'Pegá el mensaje del proveedor, el chat de WhatsApp, un Excel, un PDF o el CSV de Tiendanube / Shopify.'],
    ['💬', 'Pedidos directo a tu WhatsApp', 'Tu cliente arma el carrito y te llega el ticket con total, medio de pago y tu alias.'],
    ['💼', 'Minorista, mayorista o los dos', 'Mismo enlace: el público ve precio final y tus revendedores entran con un código a la lista mayorista.'],
    ['📊', 'Panel con números claros', 'Ventas, ganancia, mejores clientes, stock crítico y carritos sin cerrar para recontactar.'],
    ['💹', 'Precios inteligentes', 'Compará proveedores y la competencia; vos decidís qué sugerencia aplicar.']];
  app().innerHTML = `<div class="page"><div class="hero"><div class="tag" style="margin-bottom:12px">Sin límite de productos · 0% de comisión por venta</div>
    <h1>Tu catálogo mayorista y minorista, listo para vender por WhatsApp</h1>
    <p>${esc(CONFIG.MARCA)} arma tu tienda online con precios por volumen y te manda cada pedido al celular. 7 días gratis con todo desbloqueado, sin tarjeta.</p>
    <a class="btn btn-p" style="max-width:340px;margin:0 auto 10px" href="#/registro">Crear mi tienda gratis</a><a class="btn btn-s" style="max-width:340px;margin:0 auto" href="#/login">Ya tengo cuenta</a></div>
    <div class="home-feat">${F.map(([i, t, d]) => `<div><span class="i">${i}</span><b>${t}</b><p>${d}</p></div>`).join('')}</div>
    <h2 style="font-size:1.15rem;margin-bottom:10px">Así arrancás</h2>
    <ol class="home-steps"><li>Creás tu cuenta con email y contraseña.</li><li>Ponés el nombre de tu negocio y tu WhatsApp: te cargamos 4 productos de ejemplo de tu rubro.</li><li>Importás tu lista, compartís tu enlace y empiezan a llegar pedidos.</li></ol>
    <a class="btn btn-p" style="max-width:340px;margin:0 auto 30px" href="#/registro">Empezar ahora</a></div>`;
}
async function ruta() {
  if (!configurado()) { app().innerHTML = '<div class="page"><div class="err-box">Falta configurar Supabase: editá js/config.js (ver README).</div></div>'; return; }
  const slug = slugUrl();
  if (slug) return mostrarTienda(slug, app());
  const h = location.hash.replace(/^#\/?/, '').split('?')[0];
  let ses = null; try { ses = await api.session(); } catch (e) { }
  if (h === 'nueva-clave') return A.pantallaNuevaClave(app());
  if (h === 'registro') return ses ? irPanel() : A.pantallaRegistro(app());
  if (h === 'login') return ses ? irPanel() : A.pantallaLogin(app());
  if (h === 'olvide') return A.pantallaOlvide(app());
  if (h === 'panel' || h === 'nueva') { if (!ses) { location.hash = '#/login'; return; } return irPanel(); }
  return ses ? irPanel() : inicio();
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
