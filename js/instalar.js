// Panel como app en el celular: el "manifest" se agrega SOLO en el panel (la tienda pública de tus clientes no se toca).
import { on, toast } from './util.js';

let aviso = null;   // evento del navegador que permite ofrecer "Instalar"
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); aviso = e; const b = document.getElementById('inst-btn'); if (b) b.hidden = false; });
window.addEventListener('appinstalled', () => { aviso = null; toast('¡Listo! El panel quedó instalado'); });

export function activarApp() {
  if (document.querySelector('link[rel=manifest]')) return;
  const l = document.createElement('link'); l.rel = 'manifest'; l.href = '/manifest.webmanifest'; document.head.appendChild(l);
  const a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = '/icon-192.png'; document.head.appendChild(a);
}
const instalada = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
export function instalarHtml() {
  if (instalada()) return '';
  return `<div class="cc" id="inst-card"><h3>📲 Tené el panel como una app</h3><p class="hint" style="margin-bottom:8px">Queda con su ícono en la pantalla de inicio de tu celular y se abre a pantalla completa, sin la barra del navegador.</p>
    <button class="btn btn-p btn-sm" style="width:auto" id="inst-btn" data-act="inst-go" ${aviso ? '' : 'hidden'}>Instalar ahora</button>
    <details class="hint"><summary>¿Cómo se hace a mano?</summary><p style="margin-top:6px"><b>Android (Chrome):</b> menú ⋮ → “Agregar a pantalla principal” o “Instalar app”.<br><b>iPhone (Safari):</b> botón Compartir → “Agregar a inicio”.</p></details></div>`;
}
on('inst-go', async () => { if (!aviso) { toast('Usá el menú del navegador → “Agregar a pantalla principal”'); return; } try { aviso.prompt(); await aviso.userChoice; } catch (e) { } aviso = null; });
