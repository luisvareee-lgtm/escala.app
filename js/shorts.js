// v2.37 · Shorts 9:16 (1080 x 1920) de 5, 10 o 15 segundos para Estados, Reels y TikTok.
// Se animan y se graban en el navegador (canvas + MediaRecorder): no se sube nada y no tiene costo por video.
// Estilos: /detail-closeup, /retail-commercial, /tabletop-ad y /unboxing (ver estudio_ia.js).
// cuadro(ctx, V, t) dibuja el segundo t: es puro (mismo t → mismo dibujo), así la vista previa y la grabación coinciden.
// V = { its:[{nombre, precio, pre, antes, pct}], ims:[Image|null], ia:Image|null, logo, marca:{nombre,url,wsp}, color, estilo, seg, badge }
export const W = 1080, H = 1920;
const FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const fuente = (px, peso = 800) => `${peso} ${Math.round(px)}px ${FUENTE}`;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const tramo = (u, a, b) => cl((u - a) / (b - a));                 // 0→1 entre a y b
const suave = x => x * x * (3 - 2 * x);
const salida = x => 1 - Math.pow(1 - x, 3);
const rebote = x => { const c = 1.70158, d = c + 1; return 1 + d * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mezcla = (h, k) => '#' + rgb(h).map(x => Math.max(0, Math.min(255, Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k))).toString(16).padStart(2, '0')).join('');
const lum = h => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const HEX = /^#[0-9a-fA-F]{6}$/;

function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
let TEXTOS = [];
function txt(ctx, s, x, y, o = {}) {
  s = String(s == null ? '' : s); if (!s) return 0;
  let px = o.px || 48; ctx.font = fuente(px, o.peso); ctx.textAlign = o.al || 'left'; ctx.textBaseline = 'alphabetic';
  if (o.max) while (ctx.measureText(s).width > o.max && px > 18) { px -= 2; ctx.font = fuente(px, o.peso); }
  ctx.save(); ctx.globalAlpha *= o.a ?? 1; if (o.sombra) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 4; }
  ctx.fillStyle = o.color || '#fff'; ctx.fillText(s, x, y); ctx.restore(); TEXTOS.push(s); return ctx.measureText(s).width;
}
function renglones(ctx, s, px, peso, max, n) {
  ctx.font = fuente(px, peso); const pal = String(s || '').split(/\s+/).filter(Boolean), L = []; let a = '';
  for (const p of pal) { const t = a ? a + ' ' + p : p; if (ctx.measureText(t).width <= max || !a) a = t; else { L.push(a); a = p; } }
  if (a) L.push(a); if (L.length > n) { L.length = n; L[n - 1] = L[n - 1].replace(/[\s,.;:-]+$/, '') + '…'; } return L;
}
function nombre(ctx, s, x, y, o) { renglones(ctx, s, o.px, o.peso || 800, o.max, o.n || 2).forEach((l, i) => txt(ctx, l, x, y + i * o.px * 1.15, { ...o, max: o.max })); }
function cubrir(ctx, im, x, y, w, h, zoom = 1, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / im.naturalWidth, h / im.naturalHeight) * zoom, dw = im.naturalWidth * s, dh = im.naturalHeight * s;
  ctx.drawImage(im, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
}
// el producto "suelto": con fondo blanco se funde (multiply); si no, en tarjeta redondeada con sombra
const blancos = new WeakMap();
function fondoBlanco(im) {
  if (blancos.has(im)) return blancos.get(im); let r = false;
  try { const c = document.createElement('canvas'); c.width = c.height = 16; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 16, 16); const d = x.getImageData(0, 0, 16, 16).data; let ok = 0, n = 0;
    for (let i = 0; i < 16; i++) for (const [px, py] of [[i, 0], [i, 15], [0, i], [15, i]]) { const k = (py * 16 + px) * 4; n++; if (Math.min(d[k], d[k + 1], d[k + 2]) > 232) ok++; } r = ok / n > 0.85; } catch (e) { r = false; }
  blancos.set(im, r); return r;
}
function producto(ctx, im, it, cx, cy, w, h, o = {}) {
  if (!im) { ctx.save(); ctx.font = fuente(Math.min(w, h) * 0.5, 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.emoji || '📦', cx, cy); ctx.restore(); return; }
  const s = Math.min(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s, x = cx - dw / 2, y = cy - dh / 2;
  ctx.save();
  if (fondoBlanco(im) && o.fondoClaro) { ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(im, x, y, dw, dh); }
  else { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26; rr(ctx, x, y, dw, dh, Math.min(dw, dh) * 0.06); ctx.fillStyle = '#fff'; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.clip(); ctx.drawImage(im, x, y, dw, dh); }
  ctx.restore();
}
function precioTxt(it) { return (it.pre ? it.pre + ' ' : '') + it.precio; }
function sello(ctx, s, x, y, px, k, bg, fg, rot = -0.08) {
  if (k <= 0) return; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
  ctx.font = fuente(px, 900); const w = ctx.measureText(s).width + px * 0.8, h = px * 1.35;
  ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 24; rr(ctx, -w / 2, -h / 2, w, h, h * 0.22); ctx.fillStyle = bg; ctx.fill(); ctx.shadowColor = 'transparent';
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, 0, px * 0.04); ctx.restore(); TEXTOS.push(s);
}
function etiqueta(ctx, s, x, y, a, bg, fg) {
  if (!s || a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.font = fuente(40, 800); const w = ctx.measureText(s).width + 64;
  rr(ctx, x, y, w, 84, 42); ctx.fillStyle = bg; ctx.fill(); ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(s, x + 32, y + 44); ctx.restore(); TEXTOS.push(s);
}

/* ---------- los estilos ---------- */
const ESTILOS = {
  // acercamiento lento recorriendo la foto, el nombre y después el precio
  'detail-closeup'(ctx, V, it, im, u, ac) {
    const base = (V.ia && V.its.length === 1) ? V.ia : im;
    ctx.fillStyle = '#0b0b0d'; ctx.fillRect(0, 0, W, H);
    if (base) { ctx.save(); cubrir(ctx, base, 0, 0, W, H, 1.08 + 0.42 * suave(u), 0.32 + 0.36 * suave(u), 0.38 + 0.2 * suave(u)); ctx.restore(); }
    else producto(ctx, null, it, W / 2, H / 2, W, H);
    const g = ctx.createLinearGradient(0, H * 0.55, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.82)'); ctx.fillStyle = g; ctx.fillRect(0, H * 0.55, W, H * 0.45);
    const a1 = tramo(u, 0.12, 0.3), a2 = tramo(u, 0.45, 0.6);
    txt(ctx, 'Mirá los detalles ✨', 90, 200 - 30 * (1 - salida(a1)), { px: 46, peso: 700, a: a1 * (1 - tramo(u, 0.8, 0.95)), sombra: true });
    nombre(ctx, it.nombre, 90, H - 470 + 40 * (1 - salida(a1)), { px: 64, max: W - 180, a: a1, sombra: true });
    txt(ctx, precioTxt(it), 90, H - 250, { px: 120, peso: 900, color: '#fff', a: a2, max: W - 180, sombra: true });
    if (a2 > 0) ctx.fillStyle = ac, ctx.fillRect(90, H - 220, 220 * salida(a2), 10);
  },
  // ritmo de comercial: el producto entra con rebote, el precio sella y cierra con "Pedilo ya"
  'retail-commercial'(ctx, V, it, im, u, ac) {
    const onAc = lum(ac) > 0.6 ? '#111' : '#fff';
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, ac); g.addColorStop(1, mezcla(ac, -0.45)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (V.ia && V.its.length === 1) { ctx.save(); ctx.globalAlpha = 0.28; cubrir(ctx, V.ia, 0, 0, W, H, 1.1); ctx.restore(); }
    ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = '#fff'; const d = (u * 600) % 160;    // franjas en movimiento
    for (let x = -H; x < W + H; x += 160) { ctx.beginPath(); ctx.moveTo(x + d, 0); ctx.lineTo(x + d + 60, 0); ctx.lineTo(x + d + 60 - H * 0.6, H); ctx.lineTo(x + d - H * 0.6, H); ctx.fill(); }
    ctx.restore();
    const e = rebote(tramo(u, 0, 0.28)), bob = Math.sin(u * Math.PI * 4) * 10;
    producto(ctx, im, it, W / 2 + (1 - e) * W, 820 + bob, W - 200, 900);
    etiqueta(ctx, V.badge, 90, 120, tramo(u, 0.08, 0.2) * (0.75 + 0.25 * Math.sin(u * 40)), '#fff', '#111');
    nombre(ctx, it.nombre, W / 2, 1400, { px: 58, max: W - 160, al: 'center', color: onAc, a: tramo(u, 0.25, 0.4) });
    sello(ctx, precioTxt(it), W / 2, 1600, 110, rebote(tramo(u, 0.38, 0.55)), '#ffe600', '#111');
    if (it.pct > 0) sello(ctx, '-' + it.pct + '%', W - 200, 330, 72, rebote(tramo(u, 0.3, 0.45)), '#e11d48', '#fff', 0.12);
    const cta = salida(tramo(u, 0.62, 0.78)); if (cta > 0) { ctx.save(); ctx.translate(0, (1 - cta) * 260); rr(ctx, 90, H - 230, W - 180, 120, 60); ctx.fillStyle = '#25D366'; ctx.fill(); ctx.restore(); txt(ctx, 'Pedilo ya por WhatsApp 📲', W / 2, H - 152 + (1 - cta) * 260, { px: 48, peso: 900, al: 'center', color: '#fff', max: W - 240 }); }
  },
  // el producto sobre la mesa, la cámara se acerca y pasa un brillo
  'tabletop-ad'(ctx, V, it, im, u, ac) {
    const pared = mezcla(ac, 0.82), mesa = 1300;
    ctx.fillStyle = pared; ctx.fillRect(0, 0, W, H);
    const k = 1 + 0.14 * suave(u); ctx.save(); ctx.translate(W / 2, mesa); ctx.scale(k, k); ctx.translate(-W / 2, -mesa);
    const g = ctx.createLinearGradient(0, mesa, 0, H); g.addColorStop(0, '#a0734d'); g.addColorStop(1, '#6b4a2f'); ctx.fillStyle = g; ctx.fillRect(-200, mesa, W + 400, H - mesa + 400);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(-200, mesa, W + 400, 8);
    ctx.save(); ctx.scale(1, 0.16); const sg = ctx.createRadialGradient(W / 2, (mesa + 10) / 0.16, 10, W / 2, (mesa + 10) / 0.16, 380); sg.addColorStop(0, 'rgba(0,0,0,.4)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(0, (mesa - 300) / 0.16, W, 600 / 0.16); ctx.restore();
    producto(ctx, im, it, W / 2, mesa - 380, W - 260, 760, { fondoClaro: true });
    const b = tramo(u, 0.3, 0.62); if (b > 0 && b < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const x = -300 + b * (W + 600); const lg = ctx.createLinearGradient(x - 160, 0, x + 160, 0); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.28)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = lg; ctx.fillRect(x - 160, 0, 320, mesa); ctx.restore(); }
    ctx.restore();
    const fg = lum(pared) > 0.6 ? '#111' : '#fff', a1 = salida(tramo(u, 0.15, 0.32)), a2 = salida(tramo(u, 0.42, 0.58));
    etiqueta(ctx, V.badge, 90, 120, a1, ac, lum(ac) > 0.6 ? '#111' : '#fff');
    nombre(ctx, it.nombre, 90, 300 + 40 * (1 - a1), { px: 64, max: W - 180, color: fg, a: a1 });
    txt(ctx, precioTxt(it), 90, 1600 + 60 * (1 - a2), { px: 120, peso: 900, color: '#fff', a: a2, max: W - 180, sombra: true });
    if (it.antes) txt(ctx, 'Antes ' + it.antes, 90, 1680 + 60 * (1 - a2), { px: 44, peso: 700, color: 'rgba(255,255,255,.8)', a: a2 });
  },
  // la caja se abre y aparece el producto con brillos
  unboxing(ctx, V, it, im, u, ac) {
    const fondo = mezcla(ac, 0.88); ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    const bx = W / 2, by = 1350, bw = 620, bh = 420, temb = u < 0.28 ? Math.sin(u * 120) * 6 * (u / 0.28) : 0, abre = suave(tramo(u, 0.28, 0.45)), sube = salida(tramo(u, 0.38, 0.7));
    // el producto sale de la caja (detrás del frente de la caja)
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, by - bh / 2 + 4); ctx.clip();
    producto(ctx, im, it, bx, by - bh / 2 + 380 - 760 * sube, 640, 640, { fondoClaro: true }); ctx.restore();
    ctx.save(); ctx.translate(temb, 0);
    ctx.fillStyle = '#b8895c'; ctx.fillRect(bx - bw / 2, by - bh / 2, bw, bh);                 // caja
    ctx.fillStyle = '#a77a4f'; ctx.fillRect(bx - bw / 2, by - bh / 2, bw, 40);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(bx - 50, by - bh / 2, 100, bh);      // cinta
    const ty = by - bh / 2, fh = 170 * (1 - abre);                                               // solapas que se abren
    ctx.fillStyle = '#c99b6d';
    ctx.beginPath(); ctx.moveTo(bx - bw / 2, ty); ctx.lineTo(bx, ty); ctx.lineTo(bx - 40 * abre, ty - fh - 160 * abre); ctx.lineTo(bx - bw / 2 - 140 * abre, ty - fh * 0.2 - 120 * abre); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx + bw / 2, ty); ctx.lineTo(bx, ty); ctx.lineTo(bx + 40 * abre, ty - fh - 160 * abre); ctx.lineTo(bx + bw / 2 + 140 * abre, ty - fh * 0.2 - 120 * abre); ctx.closePath(); ctx.fill();
    ctx.restore();
    const br = tramo(u, 0.42, 0.85); if (br > 0 && br < 1) for (let i = 0; i < 14; i++) {                                // brillos
      const ang = i * 2.39, r = 200 + 380 * br, x = bx + Math.cos(ang) * r, y = 760 + Math.sin(ang) * r * 0.8, s = 18 * (1 - br) + 6;
      ctx.save(); ctx.translate(x, y); ctx.rotate(br * 3); ctx.fillStyle = i % 2 ? '#fff' : ac; ctx.globalAlpha = 1 - br; ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
    }
    const a = salida(tramo(u, 0.68, 0.82)), fg = lum(fondo) > 0.6 ? '#111' : '#fff';
    txt(ctx, '¡Llegó! 📦', W / 2, 190, { px: 64, peso: 900, al: 'center', color: fg, a: tramo(u, 0.05, 0.2) * (1 - tramo(u, 0.6, 0.7)) });
    nombre(ctx, it.nombre, W / 2, 210 + 30 * (1 - a), { px: 60, max: W - 160, al: 'center', color: fg, a });
    sello(ctx, precioTxt(it), W / 2, 1700, 96, rebote(tramo(u, 0.74, 0.9)), ac, lum(ac) > 0.6 ? '#111' : '#fff', 0);
  },
};

// tarjeta final: la marca, el enlace y el WhatsApp de la tienda
function cierre(ctx, V, u, ac) {
  const onAc = lum(ac) > 0.6 ? '#111' : '#fff', a = salida(tramo(u, 0, 0.35));
  ctx.fillStyle = mezcla(ac, -0.55); ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(W / 2, H / 2 - 120, 360 + 60 * u, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  let y = 700;
  if (V.logo) { const L = 260; ctx.save(); ctx.globalAlpha = a; rr(ctx, W / 2 - L / 2, y - L / 2 - 120, L, L, 56); ctx.fillStyle = '#fff'; ctx.fill(); ctx.clip(); const s = Math.min(L / V.logo.naturalWidth, L / V.logo.naturalHeight); ctx.drawImage(V.logo, W / 2 - V.logo.naturalWidth * s / 2, y - 120 - V.logo.naturalHeight * s / 2, V.logo.naturalWidth * s, V.logo.naturalHeight * s); ctx.restore(); y += 200; }
  const m = V.marca || {};
  txt(ctx, m.nombre || 'Mi tienda', W / 2, y + 40, { px: 84, peso: 900, al: 'center', color: '#fff', max: W - 160, a });
  if (m.url) txt(ctx, '🛒 ' + m.url, W / 2, y + 150, { px: 44, peso: 700, al: 'center', color: 'rgba(255,255,255,.86)', max: W - 160, a });
  const b = salida(tramo(u, 0.25, 0.6)); if (b > 0) { ctx.save(); ctx.globalAlpha = b; rr(ctx, 120, y + 260, W - 240, 130, 65); ctx.fillStyle = '#25D366'; ctx.fill(); ctx.restore();
    txt(ctx, m.wsp ? '📲 ' + m.wsp : 'Pedí por WhatsApp 📲', W / 2, y + 345, { px: 50, peso: 900, al: 'center', color: '#fff', max: W - 300, a: b }); }
  txt(ctx, 'Pedí por WhatsApp desde el enlace', W / 2, H - 200, { px: 36, peso: 600, al: 'center', color: 'rgba(255,255,255,.7)', a: b });
}

// cuánto dura cada parte: la tarjeta final ocupa 1,5 s (5 s) a 2,5 s (15 s); el resto se reparte entre los productos
export function tiempos(seg, n) { const fin = seg <= 5 ? 1.5 : seg <= 10 ? 2 : 2.5; return { fin, cada: (seg - fin) / Math.max(1, n) }; }
export function cuadro(ctx, V, t) {
  t = cl(Number(t) || 0, 0, V.seg - 0.001);   // el reloj de requestAnimationFrame puede venir unos ms antes del arranque
  TEXTOS = []; const ac = HEX.test(V.color || '') ? V.color : '#7c3aed', n = Math.min(V.its.length, 4), T = tiempos(V.seg, n), dib = ESTILOS[V.estilo] || ESTILOS['retail-commercial'];
  ctx.save(); ctx.clearRect(0, 0, W, H);
  if (t >= V.seg - T.fin) cierre(ctx, V, (t - (V.seg - T.fin)) / T.fin, ac);
  else { const i = Math.min(n - 1, Math.floor(t / T.cada)), u = (t - i * T.cada) / T.cada; dib(ctx, V, V.its[i], V.ims[i], cl(u), ac);
    if (u < 0.06 && i > 0) { ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - u / 0.06)})`; ctx.fillRect(0, 0, W, H); } }       // flash entre productos
  if (t < 0.25) { ctx.fillStyle = `rgba(0,0,0,${1 - t / 0.25})`; ctx.fillRect(0, 0, W, H); }                                     // entra desde negro
  ctx.restore(); return TEXTOS.slice();
}

/* ---------- vista previa y grabación ---------- */
let anim = 0;
export function previa(canvas, V) {
  parar(); const ctx = canvas.getContext('2d'), t0 = performance.now();
  const paso = now => { const t = (Math.max(0, now - t0) / 1000) % V.seg; const tx = cuadro(ctx, V, t); canvas.dataset.t = t.toFixed(2); canvas.setAttribute('aria-label', 'Vista previa del video: ' + tx.join(' · ')); anim = requestAnimationFrame(paso); };
  anim = requestAnimationFrame(paso);
}
export function parar() { if (anim) cancelAnimationFrame(anim); anim = 0; }
export const formatoVideo = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  return ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || null;
};
// Graba el video en tiempo real (tarda lo mismo que dura). alAvanzar(0..1). Devuelve { blob, tipo, ext }.
export async function grabar(canvas, V, alAvanzar) {
  const tipo = formatoVideo(); if (!tipo || !canvas.captureStream) throw new Error('Este navegador no puede crear videos. Probá con Chrome actualizado (en el celular o la compu).');
  parar(); const ctx = canvas.getContext('2d'), stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 8000000 }), partes = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) partes.push(e.data); };
  const fin = new Promise(r => { rec.onstop = r; });
  cuadro(ctx, V, 0); rec.start(500);
  const t0 = performance.now();
  await new Promise(res => {
    const paso = () => { const t = (performance.now() - t0) / 1000; cuadro(ctx, V, Math.min(t, V.seg - 0.001)); if (alAvanzar) alAvanzar(cl(t / V.seg)); if (t >= V.seg) return res(); anim = requestAnimationFrame(paso); };
    anim = requestAnimationFrame(paso);
  });
  rec.stop(); await fin; stream.getTracks().forEach(x => x.stop()); anim = 0;
  const base = tipo.split(';')[0], blob = new Blob(partes, { type: base });
  if (!blob.size) throw new Error('El video salió vacío. Probá de nuevo sin cambiar de pestaña mientras se graba.');
  return { blob, tipo: base, ext: base.includes('mp4') ? 'mp4' : 'webm' };
}
