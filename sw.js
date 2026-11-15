// Service worker de la plataforma: solo muestra los avisos de pedidos nuevos en el celular o la compu del comercio.
// No guarda nada en caché ni intercepta páginas (la tienda y el panel cargan siempre como siempre).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Solo se abren direcciones del panel (nunca otro sitio).
const delPanel = u => typeof u === 'string' && /^\/app(#\/[\w/?=&-]*)?$/.test(u);

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'Aviso', body: e.data ? e.data.text() : '' }; }
  const titulo = String(d.title || '🛒 Pedido nuevo').slice(0, 120);
  e.waitUntil(self.registration.showNotification(titulo, {
    body: String(d.body || 'Entrá a tu panel para verlo.').slice(0, 240),
    icon: '/icon-192.png', badge: '/icon-192.png',
    tag: String(d.tag || 'pedido'), renotify: true,
    data: { url: delPanel(d.url) ? d.url : '/app#/panel?tab=pedidos' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = (e.notification.data && e.notification.data.url) || '/app#/panel';
  const url = new URL(delPanel(d) ? d : '/app#/panel', self.location.origin);
  e.waitUntil((async () => {
    const ws = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const panel = ws.find(w => new URL(w.url).pathname.startsWith('/app'));
    // si el panel ya está abierto: se trae al frente y se le pide que abra el pedido (sin recargar la página)
    if (panel) { try { await panel.focus(); } catch (x) { } panel.postMessage({ irA: url.pathname + url.hash }); return; }
    await self.clients.openWindow(url.href);
  })());
});
