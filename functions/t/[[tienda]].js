// Tienda pública: /t/<tienda> muestra la misma página que la portada, SIN cambiar la dirección,
// para que la app sepa qué tienda abrir. (Reemplaza la regla de _redirects: Cloudflare convertía
// /app.html en /app y se perdía el nombre de la tienda, por eso se abría el panel.)
const SEGURIDAD = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy": "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net https://connect.facebook.net 'wasm-unsafe-eval'; worker-src 'self' blob: https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://www.facebook.com https://connect.facebook.net; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};

export async function onRequestGet({ request, env }) {
  const r = await env.ASSETS.fetch(new URL('/', request.url));
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries(SEGURIDAD)) h.set(k, v);
  h.set('content-type', 'text/html; charset=utf-8');
  h.set('cache-control', 'no-cache');
  h.delete('location');
  return new Response(r.body, { status: 200, headers: h });
}
