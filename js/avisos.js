// Aviso de pedido nuevo al celular (o la compu) del comercio, aunque tenga el panel cerrado (v2.23).
// Usa los avisos estándar del navegador: Chrome/Android, Firefox, Edge, Safari en Mac y, en iPhone,
// el panel agregado a la pantalla de inicio. El aviso viaja cifrado: solo este dispositivo lo puede leer.
import { api } from './api.js';
import { on, toast, store } from './util.js';
import { P } from './state.js';

// El aviso tocado con el panel ya abierto: el service worker pide ir al pedido.
try {
  if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
    const u = e.data && e.data.irA;
    if (typeof u === 'string' && /^\/app#\/panel(\?[\w=&-]*)?$/.test(u)) location.hash = u.slice(4);
  });
} catch (e) { }

const S = { estado: null, cuantos: 0, ocupado: false, cargando: false };
export const resetAvisos = () => { S.estado = null; S.cuantos = 0; S.ocupado = false; S.cargando = false; };

const soporta = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const esIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
const deB64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '='.repeat((4 - s.length % 4) % 4); return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function dispositivo() {
  const u = navigator.userAgent;
  const so = /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) || esIOS() ? 'iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'Otro';
  const nav = /Edg\//.test(u) ? 'Edge' : /Firefox\//.test(u) ? 'Firefox' : /SamsungBrowser/.test(u) ? 'Samsung' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
  return (so + (nav ? ' · ' + nav : '')).slice(0, 80);
}
async function registro() {
  try { const r = await navigator.serviceWorker.getRegistration('/'); if (r) return r; } catch (e) { }
  return navigator.serviceWorker.register('/sw.js', { scope: '/' });
}
async function subActual() {
  try { const r = await navigator.serviceWorker.getRegistration('/'); return r ? await r.pushManager.getSubscription() : null; } catch (e) { return null; }
}
const datosSub = sub => { const j = sub.toJSON ? sub.toJSON() : sub; return { endpoint: j.endpoint, p256dh: j.keys && j.keys.p256dh, auth: j.keys && j.keys.auth }; };
const repintar = () => { if (P.repintar && (P.tab === 'pedidos' || P.tab === 'ajustes') && !P.modal) P.repintar(); };

// Estado de este dispositivo. Si ya tenía el aviso, lo vuelve a anotar en silencio (por si el navegador lo renovó).
async function revisar() {
  if (S.cargando) return; S.cargando = true;
  let e;
  if (!soporta()) e = esIOS() && !instalada() ? 'ios' : 'no';
  else if (Notification.permission === 'denied') e = 'bloq';
  else {
    const sub = Notification.permission === 'granted' ? await subActual() : null;
    e = sub ? 'on' : 'off';
    if (sub) { const d = datosSub(sub); try { S.cuantos = await api.pushSuscribir(d.endpoint, d.p256dh, d.auth, dispositivo()); } catch (x) { } }
  }
  if (e !== 'on') { try { S.cuantos = await api.pushCuantos(); } catch (x) { S.cuantos = 0; } }
  S.estado = e; S.cargando = false; repintar();
}

const AHORA_NO = 'esc_avisos_ahora_no';
const oculto = () => { const t = Number(store.get(AHORA_NO) || 0); return t && Date.now() - t < 30 * 864e5; };
const otros = n => n > 0 ? `<p class="hint">${n === 1 ? 'Hay 1 dispositivo' : `Hay ${n} dispositivos`} con aviso en tu cuenta.</p>` : '';

// donde = 'pedidos' (arriba de la lista, se puede ocultar) o 'ajustes' (siempre)
export function avisosHtml(donde) {
  if (S.estado === null) { revisar(); return ''; }
  const e = S.estado, enPed = donde === 'pedidos';
  if (e === 'on') return enPed
    ? `<div class="av-linea" id="av-card"><span>🔔 Te avisamos al celular de cada pedido.</span><button class="btn btn-s btn-sm" data-act="av-probar">Probar</button></div>`
    : `<div class="cc" id="av-card"><h3>🔔 Avisos de pedidos: activados en este dispositivo</h3><p class="hint" style="margin-bottom:8px">Cuando entra un pedido te llega un aviso con el total y el cliente, aunque tengas el panel cerrado. Lo tocás y se abre ese pedido.</p>${otros(S.cuantos)}
      <div class="av-bts"><button class="btn btn-p btn-sm" data-act="av-probar">Mandar un aviso de prueba</button><button class="btn btn-s btn-sm" data-act="av-off">Desactivar en este dispositivo</button></div></div>`;
  if (enPed && (oculto() || e === 'no')) return '';
  const cab = `<div class="cc av-card" id="av-card"><h3>🔔 Enterate al instante de cada pedido</h3><p class="hint" style="margin-bottom:8px">Te llega un aviso al celular, como un mensaje, con el total y el nombre del cliente. Aunque tengas el panel cerrado.</p>`;
  const pie = enPed ? `<button class="av-x" data-act="av-ahora-no" aria-label="Ocultar por ahora">Ahora no</button>` : '';
  if (e === 'off') return cab + `${otros(S.cuantos)}<div class="av-bts"><button class="btn btn-p btn-sm" data-act="av-on">🔔 Activar avisos en este dispositivo</button></div>${pie}</div>`;
  if (e === 'bloq') return cab + `<p class="av-alerta">Los avisos están <b>bloqueados</b> en este navegador.</p><p class="hint"><b>Android (Chrome):</b> tocá el candado 🔒 al lado de la dirección → Permisos → Notificaciones → Permitir. Después recargá la página.<br><b>Compu:</b> clic en el candado 🔒 → Notificaciones → Permitir.</p>${pie}</div>`;
  if (e === 'ios') return cab + `<p class="hint"><b>En iPhone o iPad</b> los avisos funcionan con el panel como app:<br>1. En Safari tocá <b>Compartir</b> (el cuadrado con la flecha) → <b>Agregar a inicio</b>.<br>2. Abrí el panel desde ese ícono nuevo.<br>3. Volvé a esta sección y tocá <b>Activar</b>.</p><p class="hint">Hace falta iOS 16.4 o más nuevo.</p>${pie}</div>`;
  return cab + `<p class="hint">Este navegador no permite avisos. Probá con Chrome en Android o en la compu, o con Safari en Mac.</p></div>`;
}

on('av-on', async (d, b) => {
  if (S.ocupado) return; S.ocupado = true; if (b) b.disabled = true;
  try {
    // el permiso se pide primero, dentro del toque (iPhone lo exige así)
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      S.estado = perm === 'denied' ? 'bloq' : 'off';
      throw new Error(perm === 'denied' ? 'Bloqueaste los avisos. Abajo te decimos cómo habilitarlos.' : 'Para recibir avisos tocá “Permitir” cuando el navegador lo pregunte.');
    }
    const reg = await registro();
    try { await navigator.serviceWorker.ready; } catch (e) { }
    const pub = await api.pushClave();
    let sub = await reg.pushManager.getSubscription();
    if (sub && sub.options && sub.options.applicationServerKey && b64u(sub.options.applicationServerKey) !== pub) { try { await sub.unsubscribe(); } catch (e) { } sub = null; }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: deB64u(pub) });
    const x = datosSub(sub);
    S.cuantos = await api.pushSuscribir(x.endpoint, x.p256dh, x.auth, dispositivo());
    S.estado = 'on'; store.set(AHORA_NO, '');
    toast('🔔 ¡Listo! Te vamos a avisar de cada pedido nuevo');
    try { await api.pushPrueba(); } catch (e) { }
  } catch (e) {
    toast(/function|schema cache|push_suscribir/i.test(e.message) ? 'Falta actualizar la base: corré la migración v2.23 en Supabase.' : e.message);
  } finally { S.ocupado = false; repintar(); }
});
on('av-off', async (d, b) => {
  if (S.ocupado) return; S.ocupado = true; if (b) b.disabled = true;
  try {
    const sub = await subActual();
    if (sub) { const x = datosSub(sub); try { await sub.unsubscribe(); } catch (e) { } S.cuantos = await api.pushQuitar(x.endpoint); }
    S.estado = 'off'; toast('Listo: este dispositivo ya no recibe avisos');
  } catch (e) { toast(e.message); } finally { S.ocupado = false; repintar(); }
});
on('av-probar', async (d, b) => {
  if (b) b.disabled = true;
  try { const r = await api.pushPrueba(); toast(r.ok ? '📨 Aviso enviado: en unos segundos te llega' : 'No se pudo enviar el aviso de prueba.'); }
  catch (e) { toast(e.message); } finally { if (b) b.disabled = false; }
});
on('av-ahora-no', () => { store.set(AHORA_NO, String(Date.now())); repintar(); });
