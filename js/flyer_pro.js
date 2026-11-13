// Estilos publicitarios del estudio de flyers: se eligen con un toque o escribiendo su código (/luxury, /ugc, /metaads…).
// Todo se dibuja en el navegador con <canvas>, sin costo y sin subir nada. Cada estilo trae además un "prompt" listo para
// pegar en una IA de imágenes (ChatGPT, Gemini…) junto con la foto del producto, para quien quiera una foto realista.
// Los textos pasan por K.txt (igual que el resto del estudio): así se comprueba qué dice la imagen y, en modo reventa,
// que nunca aparezcan datos del comercio.

const SERIF = 'Georgia, "Times New Roman", "Iowan Old Style", serif';
const MANO = '"Segoe Print", "Bradley Hand", "Marker Felt", "Comic Sans MS", "Chalkboard SE", cursive';

/* ---------- ayudas de dibujo ---------- */
function cubrir(ctx, im, x, y, w, h, zoom = 1, fx = 0.5, fy = 0.5) {
  const s = Math.max(w / im.naturalWidth, h / im.naturalHeight) * zoom, dw = im.naturalWidth * s, dh = im.naturalHeight * s;
  ctx.drawImage(im, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh);
}
function contener(ctx, im, x, y, w, h) {
  const s = Math.min(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s;
  ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); return { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh };
}
// ¿la foto tiene fondo blanco de estudio? (se miran los bordes en una copia chiquita; si el sitio no deja leerla, se asume que no)
const blancos = new WeakMap();
function fondoBlanco(im) {
  if (!im) return false; if (blancos.has(im)) return blancos.get(im);
  let r = false;
  try {
    const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 24, 24);
    const d = x.getImageData(0, 0, 24, 24).data; let n = 0, ok = 0;
    for (let i = 0; i < 24; i++) for (const [px, py] of [[i, 0], [i, 23], [0, i], [23, i]]) { const k = (py * 24 + px) * 4, a = d[k], b = d[k + 1], cc = d[k + 2]; n++; if (Math.min(a, b, cc) > 232 && Math.max(a, b, cc) - Math.min(a, b, cc) < 16) ok++; }
    r = ok / n > 0.85;
  } catch (e) { r = false; }
  blancos.set(im, r); return r;
}
// producto "suelto" sobre la escena: si la foto es de fondo blanco, 'multiply' hace desaparecer el blanco;
// si tiene fondo de color, va en una tarjeta redondeada (así no queda un cuadrado flotando)
function producto(ctx, K, im, it, x, y, w, h, o = {}) {
  if (!im) { ctx.save(); ctx.font = K.fuente(Math.round(Math.min(w, h) * 0.5), 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.emoji || '📦', x + w / 2, y + h / 2); ctx.restore(); return { x, y, w, h }; }
  if (o.multiply && !fondoBlanco(im)) {
    const s = Math.min(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s, cx = x + (w - dw) / 2, cy = y + (h - dh) / 2;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 26; K.rr(ctx, cx, cy, dw, dh, Math.min(dw, dh) * 0.07); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
    enMarco(ctx, K, im, it, cx, cy, dw, dh, Math.min(dw, dh) * 0.07, '#fff'); return { x: cx, y: cy, w: dw, h: dh };
  }
  ctx.save(); if (o.multiply) ctx.globalCompositeOperation = 'multiply';
  if (o.sombra) { ctx.shadowColor = o.sombra; ctx.shadowBlur = o.blur || 50; ctx.shadowOffsetY = o.dy || 24; }
  const r = contener(ctx, im, x, y, w, h); ctx.restore(); return r;
}
function enMarco(ctx, K, im, it, x, y, w, h, r, fondo) {
  ctx.save(); K.rr(ctx, x, y, w, h, r); ctx.clip(); ctx.fillStyle = fondo || '#f4f4f4'; ctx.fillRect(x, y, w, h);
  if (im) { const ri = im.naturalWidth / im.naturalHeight, rc = w / h; if (Math.abs(ri - rc) / rc < 0.25) cubrir(ctx, im, x, y, w, h); else contener(ctx, im, x, y, w, h); }
  else { ctx.font = K.fuente(Math.round(Math.min(w, h) * 0.42), 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(it.emoji || '📦', x + w / 2, y + h / 2); }
  ctx.restore();
}
function linea(ctx, K, s, x, y, o) {
  const L = K.renglones(ctx, s, o.px, o.peso, o.max, 1, o.fam); K.txt(ctx, L[0] || '', x, y, { ...o, max: undefined, mudo: true }); K.F.textos.push(String(s));
}
// 2 a 4 fotos a pantalla completa: 2 = mitades, 3 = dos arriba y una abajo, 4 = cuadrícula
function mosaico(ctx, K, S, x0, y0, w, h, g = 0) {
  const n = Math.min(S.its.length, 4), fil = n > 2 ? 2 : 1, hh = (h - g * (fil - 1)) / fil;
  S.its.slice(0, 4).forEach((it, i) => {
    const f = n > 2 ? Math.floor(i / 2) : 0, ancho = n === 3 && i === 2 ? w : (w - g) / 2, xx = n === 3 && i === 2 ? x0 : x0 + (i % 2) * ((w - g) / 2 + g), yy = y0 + f * (hh + g);
    ctx.save(); ctx.beginPath(); ctx.rect(xx, yy, ancho, hh); ctx.clip(); ctx.fillStyle = '#f3f3f3'; ctx.fillRect(xx, yy, ancho, hh);
    if (S.ims[i]) cubrir(ctx, S.ims[i], xx, yy, ancho, hh); else producto(ctx, K, null, it, xx, yy, ancho, hh); ctx.restore();
  });
}
function grad(ctx, x0, y0, x1, y1, stops) { const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach(([p, c]) => g.addColorStop(p, c)); return g; }
function radial(ctx, x, y, r0, r1, stops) { const g = ctx.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([p, c]) => g.addColorStop(p, c)); return g; }
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
function azar(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const semilla = s => String(s || '').split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// precio grande (con "Antes" tachado y "Desde"), centrado en cx o alineado a la izquierda
function precio(ctx, K, it, x, y, P, px, al = 'center') {
  const pr = K.precioDe(it), an = K.antesDe(it), s = (pr.pre ? pr.pre + ' ' : '') + pr.p;
  if (an) {
    const ay = y - px * 0.98, w = K.txt(ctx, 'Antes ' + an, x, ay, { px: Math.round(px * 0.32), peso: 600, color: P.sub, al, fam: P.fam });
    ctx.save(); ctx.fillStyle = P.sub; ctx.fillRect(al === 'center' ? x - w / 2 - 4 : x - 4, ay - px * 0.11, w + 8, Math.max(3, Math.round(px * 0.03))); ctx.restore();
  }
  K.txt(ctx, s, x, y, { px, peso: P.pesoPrecio || 900, color: P.precio, al, fam: P.fam, max: P.maxPrecio || 900 });
  if (pr.nota) K.txt(ctx, pr.nota, x, y + px * 0.42, { px: Math.round(px * 0.26), peso: 600, color: P.sub, al, fam: P.fam });
}
function etiqueta(ctx, K, x, y, P, o = {}) {
  const b = K.F.badge; if (!b) return 0;
  const px = o.px || 40; ctx.font = K.fuente(px, 800, P.fam); const w = ctx.measureText(b).width + px * 1.5, h = px * 2;
  const x0 = o.al === 'center' ? x - w / 2 : o.al === 'right' ? x - w : x;
  ctx.save(); K.rr(ctx, x0, y, w, h, h / 2); ctx.fillStyle = P.badgeBg; ctx.fill(); if (P.badgeBd) { ctx.lineWidth = 2; ctx.strokeStyle = P.badgeBd; ctx.stroke(); } ctx.restore();
  K.txt(ctx, b, x0 + w / 2, y + h * 0.66, { px, peso: 800, color: P.badgeFg, al: 'center', fam: P.fam }); return h;
}
// 2 a 4 productos: grilla con el estilo del flyer
function grilla(ctx, K, S, P, y0, y1, o = {}) {
  const its = S.its, n = its.length, cols = 2, filas = Math.ceil(n / 2), M = o.M || 90, gap = 36, cw = (S.W - M * 2 - gap) / cols;
  const alto = (y1 - y0 - gap * (filas - 1)) / filas, conAntes = its.some(K.antesDe), texto = conAntes ? 250 : 200, fh = Math.min(alto - texto, cw);
  its.forEach((it, i) => {
    const f = Math.floor(i / 2), sola = i === n - 1 && n % 2 === 1, x = sola ? (S.W - cw) / 2 : M + (i % 2) * (cw + gap), top = y0 + f * (alto + gap);
    if (o.suelto) { producto(ctx, K, S.ims[i], it, x, top, cw, fh, { multiply: true }); }
    else { enMarco(ctx, K, S.ims[i], it, x, top, cw, fh, P.radio ?? 32, P.tile); if (P.tileBd) { ctx.save(); K.rr(ctx, x, top, cw, fh, P.radio ?? 32); ctx.lineWidth = 3; ctx.strokeStyle = P.tileBd; ctx.stroke(); ctx.restore(); } }
    K.sticker(ctx, it.pct, x + cw - 62, top + 62, 50);
    let ty = top + fh + 52; K.parrafo(ctx, it.nombre, x + cw / 2, ty, { px: 36, peso: 700, color: P.fg, max: cw - 8, n: 2, al: 'center', fam: P.fam }); ty += 36 * 1.16 * 2 + (conAntes ? 70 : 44);
    precio(ctx, K, it, x + cw / 2, ty, P, 64);
  });
}

/* ---------- los estilos ---------- */
export const ESTILOS_PRO = {
  productworld: {
    nombre: 'Product World', ico: '🌍', desc: 'El producto en un podio, en su propio mundo de color.',
    dibujar(ctx, K, S) {
      const { W, H } = S, ac = S.color || '#7c5cff', claro = K.mezcla(ac, 0.86), medio = K.mezcla(ac, 0.62);
      ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, claro], [0.62, K.mezcla(ac, 0.74)], [1, medio]]); ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = radial(ctx, W / 2, 900, 40, 620, [[0, 'rgba(255,255,255,.95)'], [0.55, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]); ctx.fillRect(0, 300, W, 1200);
      const R = azar(semilla(S.its[0].nombre));   // esferas flotando
      for (let i = 0; i < 14; i++) { const r = 14 + R() * 40, x = 50 + R() * (W - 100), y = 430 + R() * 900; if (S.its.length > 1 ? (x > 150 && x < W - 150) : Math.abs(x - W / 2) < 380) continue;
        ctx.fillStyle = radial(ctx, x - r * 0.35, y - r * 0.35, 2, r, [[0, 'rgba(255,255,255,.95)'], [1, rgba(K.mezcla(ac, 0.3), 0.55)]]); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
      const P = { fg: '#1b1530', sub: 'rgba(27,21,48,.62)', precio: '#1b1530', badgeBg: '#ffffff', badgeFg: K.mezcla(ac, -0.35), tile: 'rgba(255,255,255,.55)' };
      etiqueta(ctx, K, W / 2, 120, P, { al: 'center' });
      if (S.its.length > 1) { K.parrafo(ctx, 'Elegí tu favorito', W / 2, 330, { px: 72, peso: 900, color: P.fg, max: W - 180, n: 1, al: 'center' }); grilla(ctx, K, S, P, 400, H - 300, { suelto: true }); }
      else {
        const it = S.its[0];
        // podio
        const py = 1170, pw = 760, ph = 120;
        ctx.fillStyle = grad(ctx, 0, py, 0, py + 160, [[0, K.mezcla(ac, 0.5)], [1, K.mezcla(ac, 0.2)]]); ctx.fillRect(W / 2 - pw / 2, py, pw, 160);
        ctx.beginPath(); ctx.ellipse(W / 2, py + 160, pw / 2, ph / 2, 0, 0, Math.PI); ctx.fill();
        ctx.fillStyle = grad(ctx, W / 2 - pw / 2, 0, W / 2 + pw / 2, 0, [[0, K.mezcla(ac, 0.7)], [0.5, '#ffffff'], [1, K.mezcla(ac, 0.6)]]);
        ctx.beginPath(); ctx.ellipse(W / 2, py, pw / 2, ph / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.beginPath(); ctx.ellipse(W / 2, py - 6, 300, 34, 0, 0, Math.PI * 2); ctx.fill();
        producto(ctx, K, S.ims[0], it, W / 2 - 330, 470, 660, 690, { multiply: true, sombra: 'rgba(0,0,0,.18)' });
        K.sticker(ctx, it.pct, W - 200, 520, 92);
        K.parrafo(ctx, it.nombre, W / 2, 300, { px: 66, peso: 900, color: P.fg, max: W - 160, n: 2, al: 'center' });
        precio(ctx, K, it, W / 2, 1560, P, 128);
      }
      K.pie(ctx, { fg: P.fg, sub: P.sub, tileB: 'rgba(27,21,48,.15)' }, S.logo, H - 250);
    },
    prompt: (n, x) => `Creá una imagen publicitaria vertical (9:16) del producto de la foto adjunta${n}. Estilo "product world": el producto sobre un podio cilíndrico pastel, dentro de un pequeño mundo de su color${x}, con esferas y formas suaves flotando alrededor, cielo degradé y luz de estudio difusa. Render 3D limpio y colorido, sombras suaves.`
  },
  ugccreator: {
    nombre: 'UGC Creator', ico: '🤳', desc: 'Como un video de una creadora recomendando el producto.',
    dibujar(ctx, K, S) {
      const { W, H } = S, ac = S.color || '#ff3d7f', it = S.its[0];
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
      if (S.its.length > 1) mosaico(ctx, K, S, 0, 0, W, H * 0.62, 6);
      else if (S.ims[0]) cubrir(ctx, S.ims[0], 0, 0, W, H, 1.06);
      else { ctx.fillStyle = grad(ctx, 0, 0, W, H, [[0, K.mezcla(ac, 0.3)], [1, K.mezcla(ac, -0.4)]]); ctx.fillRect(0, 0, W, H); producto(ctx, K, null, it, 0, 300, W, 1000); }
      ctx.fillStyle = grad(ctx, 0, 0, 0, 420, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]); ctx.fillRect(0, 0, W, 420);
      ctx.fillStyle = grad(ctx, 0, H - 900, 0, H, [[0, 'rgba(0,0,0,0)'], [0.45, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,.88)']]); ctx.fillRect(0, H - 900, W, 900);
      // barra de la creadora
      const quien = S.quien, ini = (quien.trim()[0] || '♥').toUpperCase();
      ctx.fillStyle = ac; ctx.beginPath(); ctx.arc(140, 150, 56, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
      K.txt(ctx, ini, 140, 172, { px: 60, peso: 900, color: '#fff', al: 'center', mudo: true });
      K.txt(ctx, quien, 224, 140, { px: 44, peso: 800, color: '#fff', max: W - 330 });
      K.txt(ctx, 'Mi recomendación ✓', 224, 192, { px: 32, peso: 600, color: 'rgba(255,255,255,.85)' });
      // íconos al costado (sin números: nada de "me gusta" inventados)
      [['♥', 980], ['💬', 1110], ['↗', 1240]].forEach(([g, y]) => { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(W - 96, y, 52, 0, Math.PI * 2); ctx.fill(); K.txt(ctx, g, W - 96, y + 20, { px: 54, peso: 700, color: '#fff', al: 'center', mudo: true }); });
      const P = { fg: '#fff', sub: 'rgba(255,255,255,.8)', precio: '#fff', badgeBg: ac, badgeFg: '#fff' };
      // globo de texto
      const gy = H - 760; ctx.save(); K.rr(ctx, 70, gy, W - 260, 150, 40); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
      K.txt(ctx, S.its.length > 1 ? 'Mis favoritos de la semana ✨' : 'Mi favorito de la semana ✨', 110, gy + 96, { px: 50, peso: 800, color: '#111', max: W - 340 });
      const ny = gy + 250;
      if (S.its.length > 1) { S.its.slice(0, 4).forEach((x, i) => { const pr = K.precioDe(x); linea(ctx, K, '• ' + x.nombre, 80, ny - 40 + i * 70, { px: 40, peso: 700, color: '#fff', max: W - 420 }); K.txt(ctx, (pr.pre ? pr.pre + ' ' : '') + pr.p, W - 90, ny - 40 + i * 70, { px: 46, peso: 900, color: '#fff', al: 'right' }); }); }
      else { K.parrafo(ctx, it.nombre, 80, ny, { px: 56, peso: 800, color: '#fff', max: W - 260, n: 2 }); etiqueta(ctx, K, 80, ny + 120, P, { px: 34 }); precio(ctx, K, it, W - 90, ny + 250, P, 110, 'right'); K.sticker(ctx, it.pct, W - 150, 480, 90); }
      K.pie(ctx, { fg: '#fff', sub: 'rgba(255,255,255,.78)', tileB: 'rgba(255,255,255,.25)' }, S.logo, H - 240);
    },
    prompt: (n, x) => `Creá una foto vertical (9:16) estilo UGC, como un fotograma de un video de TikTok o Reels: una creadora de contenido real, natural y sonriente, sostiene en la mano el producto de la foto adjunta${n} y lo muestra a la cámara del celular, en su casa${x}. Luz natural de ventana, encuadre casero y espontáneo, sin aspecto de publicidad de estudio.`
  },
  ugc: {
    nombre: 'UGC Reseña', ico: '📝', desc: 'Foto tipo polaroid con una nota escrita a mano.',
    dibujar(ctx, K, S) {
      const { W, H } = S, it = S.its[0], R = azar(semilla(it.nombre) + 3);
      ctx.fillStyle = grad(ctx, 0, 0, W, H, [[0, '#efe3cf'], [1, '#e2d2b7']]); ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 2400; i++) { ctx.fillStyle = `rgba(120,90,50,${0.04 + R() * 0.06})`; ctx.fillRect(R() * W, R() * H, 2, 2); }   // textura de papel
      const P = { fg: '#2b2118', sub: 'rgba(43,33,24,.65)', precio: '#c81e3a', badgeBg: '#2b2118', badgeFg: '#fff', fam: MANO, pesoPrecio: 700 };
      const polaroid = (im, x, y, w, ang, i) => {
        ctx.save(); ctx.translate(x + w / 2, y + w * 0.6); ctx.rotate(ang); ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 14;
        ctx.fillStyle = '#fff'; ctx.fillRect(-w / 2, -w * 0.6, w, w * 1.2); ctx.shadowColor = 'transparent';
        enMarco(ctx, K, im, S.its[i], -w / 2 + w * 0.06, -w * 0.6 + w * 0.06, w * 0.88, w * 0.88, 0, '#f3f3f3');
        ctx.fillStyle = 'rgba(255,240,170,.75)'; ctx.save(); ctx.rotate(-0.06); ctx.fillRect(-w * 0.16, -w * 0.66, w * 0.32, w * 0.1); ctx.restore();   // cinta
        ctx.restore();
      };
      etiqueta(ctx, K, 90, 110, P, { px: 36 });
      if (S.its.length > 1) {
        const n = S.its.length, w = n > 2 ? 430 : 470;
        S.its.slice(0, 4).forEach((x, i) => polaroid(S.ims[i], n === 3 && i === 2 ? (W - w) / 2 : (i % 2 ? W - 90 - w : 90), 260 + Math.floor(i / 2) * (w * 1.12 + 10), w, (i % 2 ? 0.05 : -0.05), i));
        const ny = n > 2 ? 1430 : 1050;
        ctx.save(); ctx.translate(W / 2, ny + 70); ctx.rotate(-0.02); ctx.fillStyle = '#fff7a8'; ctx.shadowColor = 'rgba(0,0,0,.2)'; ctx.shadowBlur = 18; ctx.fillRect(-440, -110, 880, n > 2 ? 250 : 420); ctx.restore();
        S.its.slice(0, 4).forEach((x, i) => { const pr = K.precioDe(x), yy = ny - 20 + i * (n > 2 ? 46 : 90); linea(ctx, K, x.nombre, 150, yy, { px: n > 2 ? 34 : 44, peso: 700, color: P.fg, max: 520, fam: MANO }); K.txt(ctx, (pr.pre ? pr.pre + ' ' : '') + pr.p, W - 150, yy, { px: n > 2 ? 38 : 50, peso: 700, color: P.precio, al: 'right', fam: MANO }); });
      } else {
        polaroid(S.ims[0], 150, 290, 780, -0.04, 0);
        K.sticker(ctx, it.pct, W - 170, 330, 86);
        ctx.save(); ctx.translate(W / 2 + 30, 1470); ctx.rotate(0.03); ctx.fillStyle = '#fff7a8'; ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8; ctx.fillRect(-400, -150, 800, 380); ctx.restore();
        K.txt(ctx, '¡Lo recomiendo! 💛', 200, 1400, { px: 56, peso: 700, color: P.fg, fam: MANO, max: 700 });
        K.parrafo(ctx, it.nombre, 200, 1480, { px: 44, peso: 700, color: P.fg, max: 700, n: 2, fam: MANO });
        precio(ctx, K, it, 200, 1660, P, 96, 'left');
        // flechita dibujada
        ctx.save(); ctx.strokeStyle = '#2b2118'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(880, 1330); ctx.quadraticCurveTo(960, 1240, 900, 1150); ctx.stroke(); ctx.beginPath(); ctx.moveTo(900, 1150); ctx.lineTo(880, 1190); ctx.moveTo(900, 1150); ctx.lineTo(935, 1175); ctx.stroke(); ctx.restore();
      }
      K.pie(ctx, { fg: P.fg, sub: P.sub, tileB: 'rgba(43,33,24,.18)' }, S.logo, H - 230);
    },
    prompt: (n, x) => `Creá una foto vertical (9:16) estilo contenido de clienta real (UGC): el producto de la foto adjunta${n} apoyado sobre una mesa de madera o el tocador de una casa, junto a objetos cotidianos${x}, tomada con el celular desde arriba, luz natural cálida. Natural y creíble, sin retoques de estudio.`
  },
  lifestyle: {
    nombre: 'Lifestyle', ico: '🌿', desc: 'La foto a pantalla completa con textos suaves y elegantes.',
    dibujar(ctx, K, S) {
      const { W, H } = S, ac = S.color || '#b07a52', it = S.its[0];
      ctx.fillStyle = K.mezcla(ac, 0.8); ctx.fillRect(0, 0, W, H);
      if (S.its.length > 1) mosaico(ctx, K, S, 0, 0, W, H * 0.66, 10);
      else if (S.ims[0]) cubrir(ctx, S.ims[0], 0, 0, W, H * 0.8);
      else producto(ctx, K, null, it, 0, 200, W, 1000);
      const base = K.mezcla(ac, -0.55);
      ctx.fillStyle = grad(ctx, 0, H * 0.45, 0, H, [[0, rgba(base, 0)], [0.35, rgba(base, 0.82)], [1, rgba(base, 0.97)]]); ctx.fillRect(0, H * 0.45, W, H * 0.55);
      const P = { fg: '#fff', sub: 'rgba(255,255,255,.78)', precio: '#fff', badgeBg: 'rgba(0,0,0,.38)', badgeFg: '#fff', badgeBd: 'rgba(255,255,255,.6)', pesoPrecio: 600, fam: SERIF };
      etiqueta(ctx, K, 90, 110, P, { px: 34 });
      K.txt(ctx, S.its.length > 1 ? 'PARA TU DÍA A DÍA' : 'TU RUTINA, TU MOMENTO', 90, H - 690, { px: 30, peso: 600, color: 'rgba(255,255,255,.8)', mudo: false });
      if (S.its.length > 1) {
        S.its.slice(0, 4).forEach((x, i) => { const pr = K.precioDe(x), y = H - 600 + i * 84; linea(ctx, K, x.nombre, 90, y, { px: 42, peso: 500, color: '#fff', max: W - 430, fam: SERIF }); K.txt(ctx, (pr.pre ? pr.pre + ' ' : '') + pr.p, W - 90, y, { px: 48, peso: 600, color: '#fff', al: 'right', fam: SERIF }); });
      } else {
        K.parrafo(ctx, it.nombre, 90, H - 600, { px: 76, peso: 500, color: '#fff', max: W - 180, n: 2, fam: SERIF });
        precio(ctx, K, it, 90, H - 360, P, 110, 'left');
        K.sticker(ctx, it.pct, W - 170, 230, 88);
      }
      K.pie(ctx, { fg: '#fff', sub: 'rgba(255,255,255,.75)', tileB: 'rgba(255,255,255,.25)' }, S.logo, H - 230);
    },
    prompt: (n, x) => `Creá una foto lifestyle vertical (9:16) del producto de la foto adjunta${n} en una escena de la vida real: un baño o tocador luminoso, con plantas, toallas de lino y luz natural de mañana${x}. Estética cálida y aspiracional, colores suaves, profundidad de campo baja, el producto nítido en primer plano.`
  },
  macro: {
    nombre: 'Macro', ico: '🔍', desc: 'Un acercamiento extremo que muestra el detalle y la calidad.',
    dibujar(ctx, K, S) {
      const { W, H } = S, it = S.its[0], ac = S.color || '#0ea5e9';
      ctx.fillStyle = '#0b0d12'; ctx.fillRect(0, 0, W, H);
      const zh = 1180;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, zh); ctx.clip();
      if (S.ims[0]) { if ('filter' in ctx) ctx.filter = 'contrast(1.12) saturate(1.15)'; cubrir(ctx, S.ims[0], 0, 0, W, zh, 1.75, 0.5, 0.42); ctx.filter = 'none'; }
      else producto(ctx, K, null, it, 0, 0, W, zh);
      ctx.fillStyle = radial(ctx, W / 2, zh / 2, 200, 900, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.65)']]); ctx.fillRect(0, 0, W, zh);
      ctx.restore();
      // lupa con el producto entero
      const cx = W - 250, cy = zh - 120, r = 190;
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 40; ctx.fill(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r - 12, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); if (S.ims[0]) contener(ctx, S.ims[0], cx - r + 30, cy - r + 30, (r - 30) * 2, (r - 30) * 2); ctx.restore();
      ctx.save(); ctx.strokeStyle = ac; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      // marcas de detalle
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(330, 420, 70, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(390, 380); ctx.lineTo(520, 300); ctx.lineTo(760, 300); ctx.stroke(); ctx.restore();
      const P = { fg: '#fff', sub: 'rgba(255,255,255,.7)', precio: '#fff', badgeBg: ac, badgeFg: '#fff' };
      ctx.save(); K.rr(ctx, 512, 238, 470, 66, 33); ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fill(); ctx.restore();
      K.txt(ctx, 'CALIDAD EN CADA DETALLE', 747, 283, { px: 28, peso: 800, color: '#fff', al: 'center', max: 430 });
      etiqueta(ctx, K, 90, 90, P, { px: 34 });
      if (S.its.length > 1) K.txt(ctx, `y ${S.its.length - 1} ${S.its.length === 2 ? 'producto' : 'productos'} más en la tienda`, 90, zh + 70, { px: 34, peso: 700, color: P.sub });
      K.parrafo(ctx, it.nombre, 90, zh + (S.its.length > 1 ? 150 : 120), { px: 58, peso: 800, color: '#fff', max: W - 180, n: 2 });
      precio(ctx, K, it, 90, H - 300, P, 112, 'left'); K.sticker(ctx, it.pct, 180, 420, 86);
      K.pie(ctx, { fg: '#fff', sub: 'rgba(255,255,255,.7)', tileB: 'rgba(255,255,255,.2)' }, S.logo, H - 220);
    },
    prompt: (n, x) => `Creá una foto macro vertical (9:16) del producto de la foto adjunta${n}: un acercamiento extremo a su textura y terminación (gotas, brillo, relieve del envase o del contenido)${x}, con desenfoque de fondo muy marcado, luz lateral que resalte los detalles y fondo oscuro. Hiperrealista, nítida, calidad de lente macro.`
  },
  luxury: {
    nombre: 'Luxury', ico: '💎', desc: 'Negro y dorado, letras clásicas: aspecto de marca premium.',
    dibujar(ctx, K, S) {
      const { W, H } = S, it = S.its[0], oro = '#d6b46a', oro2 = '#f3e2b3';
      ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, '#0b0b0c'], [1, '#17130d']]); ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.strokeStyle = oro; ctx.lineWidth = 3; ctx.strokeRect(40, 40, W - 80, H - 80); ctx.lineWidth = 1.5; ctx.strokeRect(58, 58, W - 116, H - 116); ctx.restore();
      const P = { fg: oro2, sub: 'rgba(243,226,179,.62)', precio: oro, badgeBg: 'rgba(0,0,0,0)', badgeFg: oro, badgeBd: oro, fam: SERIF, pesoPrecio: 400 };
      K.txt(ctx, (K.F.badge || 'COLECCIÓN EXCLUSIVA').toUpperCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim(), W / 2, 170, { px: 34, peso: 400, color: oro, al: 'center', fam: SERIF });
      ctx.fillStyle = oro; ctx.fillRect(W / 2 - 60, 200, 120, 2);
      if (S.its.length > 1) { grilla(ctx, K, S, { ...P, fg: oro2, tile: '#141210', tileBd: oro, radio: 8 }, 300, H - 300); }
      else {
        const aw = 700, ax = (W - aw) / 2, ay = 290, ah = 900;
        ctx.fillStyle = radial(ctx, W / 2, ay + ah / 2, 50, 620, [[0, 'rgba(214,180,106,.35)'], [1, 'rgba(214,180,106,0)']]); ctx.fillRect(0, 150, W, 1250);
        ctx.save(); ctx.beginPath(); ctx.moveTo(ax, ay + aw / 2); ctx.arc(W / 2, ay + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw, ay + ah); ctx.lineTo(ax, ay + ah); ctx.closePath(); ctx.clip();
        ctx.fillStyle = '#f6f1e7'; ctx.fillRect(ax, ay, aw, ah); if (S.ims[0]) cubrir(ctx, S.ims[0], ax, ay, aw, ah); else producto(ctx, K, null, it, ax, ay, aw, ah); ctx.restore();
        ctx.save(); ctx.strokeStyle = oro; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax, ay + aw / 2); ctx.arc(W / 2, ay + aw / 2, aw / 2, Math.PI, 0); ctx.lineTo(ax + aw, ay + ah); ctx.lineTo(ax, ay + ah); ctx.closePath(); ctx.stroke(); ctx.restore();
        K.parrafo(ctx, it.nombre.toUpperCase(), W / 2, 1300, { px: 52, peso: 400, color: oro2, max: W - 220, n: 2, al: 'center', fam: SERIF });
        precio(ctx, K, it, W / 2, 1560, P, 112);
        if (it.pct > 0) K.txt(ctx, `— ${it.pct}% OFF —`, W / 2, 1640, { px: 34, peso: 400, color: oro, al: 'center', fam: SERIF });
      }
      K.pie(ctx, { fg: oro2, sub: 'rgba(243,226,179,.6)', tileB: 'rgba(214,180,106,.4)' }, S.logo, H - 260, { fam: SERIF, M: 110 });
    },
    prompt: (n, x) => `Creá una imagen publicitaria de lujo vertical (9:16) del producto de la foto adjunta${n}: fondo negro profundo, detalles dorados, superficie de mármol o terciopelo${x}, iluminación de estudio dramática con un haz de luz suave sobre el producto y reflejos dorados. Estética de perfumería o joyería premium, minimalista y elegante.`
  },
  '3d': {
    nombre: '3D', ico: '🧊', desc: 'El producto flotando con reflejo y letras con volumen.',
    dibujar(ctx, K, S) {
      const { W, H } = S, it = S.its[0], ac = S.color || '#6d28d9', osc = K.mezcla(ac, -0.55);
      ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, K.mezcla(ac, 0.15)], [0.6, ac], [1, osc]]); ctx.fillRect(0, 0, W, H);
      // piso en perspectiva
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; const hz = 1180;
      for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 40, hz); ctx.lineTo(W / 2 + i * 260, H); ctx.stroke(); }
      for (let j = 0; j < 9; j++) { const y = hz + Math.pow(j / 8, 1.8) * (H - hz); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      ctx.restore();
      const P = { fg: '#fff', sub: 'rgba(255,255,255,.75)', precio: '#fff', badgeBg: '#ffffff', badgeFg: osc, tile: 'rgba(255,255,255,.12)', tileBd: 'rgba(255,255,255,.35)' };
      // título con volumen
      const titulo = (s, y, px) => { for (let k = 10; k > 0; k--) K.txt(ctx, s, W / 2 + k * 1.5, y + k * 1.5, { px, peso: 900, color: K.mezcla(ac, -0.7), al: 'center', max: W - 160, mudo: true }); K.txt(ctx, s, W / 2, y, { px, peso: 900, color: '#fff', al: 'center', max: W - 160 }); };
      etiqueta(ctx, K, W / 2, 100, P, { al: 'center', px: 36 });
      if (S.its.length > 1) { titulo('¡ELEGÍ EL TUYO!', 330, 92); grilla(ctx, K, S, P, 420, H - 300); }
      else {
        const L = K.renglones(ctx, it.nombre.toUpperCase(), 76, 900, W - 160, 2); L.forEach((l, i) => titulo(l, 300 + i * 86, 76)); K.F.textos.push(it.nombre);
        const bx = W / 2 - 340, by = 470, bw = 680, bh = 680;
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(W / 2, 1255, 300, 40, 0, 0, Math.PI * 2); ctx.fill();   // sombra en el piso
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 40; K.rr(ctx, bx, by, bw, bh, 48); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
        enMarco(ctx, K, S.ims[0], it, bx, by, bw, bh, 48, '#fff');
        // reflejo
        ctx.save(); ctx.globalAlpha = 0.22; ctx.translate(0, 2 * (by + bh) + 20); ctx.scale(1, -1); enMarco(ctx, K, S.ims[0], it, bx, by, bw, bh, 48, '#fff'); ctx.restore();
        ctx.fillStyle = grad(ctx, 0, by + bh + 10, 0, by + bh + 380, [[0, rgba(ac, 0.2)], [1, ac]]); ctx.fillRect(bx - 10, by + bh + 10, bw + 20, 380);
        K.sticker(ctx, it.pct, bx + bw - 30, by + 30, 90);
        // precio en bloque
        const pr = K.precioDe(it), ps = (pr.pre ? pr.pre + ' ' : '') + pr.p; ctx.font = K.fuente(110, 900); const pw = Math.min(ctx.measureText(ps).width + 120, W - 120), px0 = (W - pw) / 2, py0 = 1450;
        ctx.save(); K.rr(ctx, px0, py0 + 18, pw, 170, 40); ctx.fillStyle = K.mezcla(ac, -0.7); ctx.fill(); K.rr(ctx, px0, py0, pw, 170, 40); ctx.fillStyle = '#fff'; ctx.fill(); ctx.restore();
        K.txt(ctx, ps, W / 2, py0 + 124, { px: 110, peso: 900, color: osc, al: 'center', max: pw - 60 });
        const an = K.antesDe(it); if (an) K.tachar(ctx, { sub: 'rgba(255,255,255,.85)' }, 'Antes ' + an, W / 2, py0 - 30, 46);
      }
      K.pie(ctx, { fg: '#fff', sub: 'rgba(255,255,255,.75)', tileB: 'rgba(255,255,255,.25)' }, S.logo, H - 250);
    },
    prompt: (n, x) => `Creá un render 3D vertical (9:16) del producto de la foto adjunta${n} flotando en el aire, levemente girado, con su reflejo sobre un piso brillante y formas geométricas 3D alrededor${x}. Iluminación de estudio con luces de color, sombras suaves, estilo publicidad de producto moderna. Mantené el envase y la etiqueta idénticos.`
  },
  cinematic: {
    nombre: 'Cinematic', ico: '🎬', desc: 'Franjas negras, colores de película y título de estreno.',
    dibujar(ctx, K, S) {
      const { W, H } = S, it = S.its[0], R = azar(semilla(it.nombre) + 11), top = 250, bot = 520;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.beginPath(); ctx.rect(0, top, W, H - top - bot); ctx.clip();
      if (S.ims[0]) { if ('filter' in ctx) ctx.filter = 'contrast(1.18) saturate(1.1) brightness(.92)'; cubrir(ctx, S.ims[0], 0, top, W, H - top - bot, 1.12); ctx.filter = 'none'; } else producto(ctx, K, null, it, 0, top, W, H - top - bot);
      ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = grad(ctx, 0, top, W, H - bot, [[0, '#0f6b78'], [1, '#e08a3c']]); ctx.fillRect(0, top, W, H - top - bot);   // teal y naranja
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = radial(ctx, W / 2, (H - bot + top) / 2, 300, 900, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.6)']]); ctx.fillRect(0, top, W, H - top - bot);
      for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(255,255,255,${R() * 0.06})`; ctx.fillRect(R() * W, top + R() * (H - top - bot), 2, 2); }   // grano de película
      ctx.restore();
      const P = { fg: '#fff', sub: 'rgba(255,255,255,.65)', precio: '#f4d6a0', pesoPrecio: 300 };
      K.txt(ctx, (K.F.badge || 'ESTRENO').replace(/[^\p{L}\p{N}\s]/gu, '').trim().toUpperCase(), W / 2, 150, { px: 32, peso: 300, color: 'rgba(255,255,255,.75)', al: 'center' });
      const t = S.its.length > 1 ? 'LA COLECCIÓN' : it.nombre.toUpperCase();
      const L = K.renglones(ctx, t, 64, 300, W - 160, 2); L.forEach((l, i) => K.txt(ctx, l.split('').join(' '), W / 2, H - bot + 110 + i * 78, { px: 64, peso: 300, color: '#fff', al: 'center', max: W - 120, mudo: true })); K.F.textos.push(t);
      const yP = H - bot + 110 + L.length * 78 + 40;
      if (S.its.length > 1) { const min = Math.min(...S.its.map(x => K.num(x.precio) || Infinity)); K.txt(ctx, `${S.its.length} PRODUCTOS${isFinite(min) ? '  ·  DESDE ' + K.fmt(min) : ''}`, W / 2, yP, { px: 40, peso: 400, color: P.precio, al: 'center', max: W - 160 }); }
      else { const pr = K.precioDe(it); K.txt(ctx, 'YA DISPONIBLE  ·  ' + (pr.pre ? pr.pre + ' ' : '') + pr.p, W / 2, yP, { px: 44, peso: 400, color: P.precio, al: 'center', max: W - 160 }); const an = K.antesDe(it); if (an) K.txt(ctx, `antes ${an} · ${it.pct ? it.pct + '% off' : 'oferta'}`, W / 2, yP + 50, { px: 30, peso: 300, color: P.sub, al: 'center' }); }
      K.pie(ctx, { fg: '#fff', sub: 'rgba(255,255,255,.6)', tileB: 'rgba(255,255,255,.12)' }, S.logo, H - 200, { compacto: true });
    },
    prompt: (n, x) => `Creá un fotograma cinematográfico vertical (9:16) con el producto de la foto adjunta${n} como protagonista: escena de película con franjas negras arriba y abajo, gradación de color teal y naranja, grano de película, humo o luz volumétrica${x}. Encuadre dramático, profundidad de campo baja, aspecto de tráiler de cine.`
  },
  realist: {
    nombre: 'Realista', ico: '📷', desc: 'Estudio limpio, fondo neutro y sombra natural: foto de catálogo.',
    dibujar(ctx, K, S) {
      const { W, H } = S, it = S.its[0];
      ctx.fillStyle = radial(ctx, W / 2, 760, 100, 1200, [[0, '#fbfbfa'], [1, '#e7e6e2']]); ctx.fillRect(0, 0, W, H);
      const P = { fg: '#16181d', sub: '#6b6f78', precio: '#16181d', badgeBg: '#16181d', badgeFg: '#fff', tile: '#ffffff' };
      etiqueta(ctx, K, 90, 100, P, { px: 32 });
      if (S.its.length > 1) grilla(ctx, K, S, P, 290, H - 300, { suelto: true });
      else {
        ctx.fillStyle = radial(ctx, W / 2, 1235, 10, 330, [[0, 'rgba(0,0,0,.22)'], [1, 'rgba(0,0,0,0)']]); ctx.save(); ctx.scale(1, 0.18); ctx.beginPath(); ctx.arc(W / 2, 1235 / 0.18, 330, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        producto(ctx, K, S.ims[0], it, 150, 270, W - 300, 960, { multiply: true });
        K.sticker(ctx, it.pct, W - 170, 330, 84);
        K.parrafo(ctx, it.nombre, 90, 1380, { px: 58, peso: 700, color: P.fg, max: W - 180, n: 2 });
        precio(ctx, K, it, 90, 1600, P, 124, 'left');
      }
      K.pie(ctx, { fg: P.fg, sub: P.sub, tileB: 'rgba(0,0,0,.1)' }, S.logo, H - 230);
    },
    prompt: (n, x) => `Creá una foto de producto realista y vertical (9:16) del producto de la foto adjunta${n}, como para un catálogo profesional: fondo de estudio infinito gris claro, luz suave de softbox, sombra de contacto natural debajo${x}. Hiperrealista, nítida, colores fieles, sin elementos extra.`
  },
  metaads: {
    nombre: 'Meta Ads', ico: '📣', desc: 'Formato 4:5 para anuncios de Facebook e Instagram, con botón de compra.', alto: 1350,
    dibujar(ctx, K, S) {
      const { W, H } = S, it = S.its[0], ac = S.color || '#1d4ed8', onAc = K.lum(ac) > 0.6 ? '#111' : '#fff';
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = ac; ctx.fillRect(0, 0, W, 120);
      const P = { fg: '#111827', sub: '#6b7280', precio: '#111827', tile: '#f3f4f6' };
      K.txt(ctx, K.F.badge || 'Disponible ahora', W / 2, 78, { px: 40, peso: 800, color: onAc, al: 'center', max: W - 120 });
      if (S.its.length > 1) grilla(ctx, K, S, { ...P, radio: 24 }, 170, H - 250, { M: 70 });
      else {
        enMarco(ctx, K, S.ims[0], it, 70, 160, W - 140, 760, 28, '#f3f4f6');
        K.sticker(ctx, it.pct, W - 150, 250, 78);
        K.parrafo(ctx, it.nombre, 70, 990, { px: 46, peso: 800, color: P.fg, max: W - 140, n: 1 });
        precio(ctx, K, it, 70, 1112, P, 92, 'left');
      }
      // botón de compra
      const bw = 400, bh = 96, bx = W - 70 - bw, by = S.its.length > 1 ? H - 230 : 1040;
      ctx.save(); K.rr(ctx, bx, by, bw, bh, 20); ctx.fillStyle = ac; ctx.fill(); ctx.restore();
      K.txt(ctx, 'Comprar ahora →', bx + bw / 2, by + 62, { px: 40, peso: 800, color: onAc, al: 'center' });
      K.pie(ctx, { fg: P.fg, sub: P.sub, tileB: '#e5e7eb' }, S.logo, H - 120, { compacto: true });
    },
    prompt: (n, x) => `Creá una imagen para un anuncio de Facebook e Instagram en formato 4:5 (1080x1350) con el producto de la foto adjunta${n}: fondo limpio de un solo color que combine con el producto, el producto grande y centrado${x}, buena luz, alto contraste y espacio libre abajo para el precio. Casi sin texto en la imagen (Meta muestra más los anuncios con poco texto).`
  }
};
export const CODIGOS = Object.keys(ESTILOS_PRO);
// "/luxury", "luxury", "/LUXURY " → 'luxury'; acepta también "/realist" y "/realista"
export function estiloDeCodigo(s) {
  const k = String(s || '').trim().toLowerCase().replace(/^\//, '').replace(/^realista$/, 'realist').replace(/^ugc-?creator$/, 'ugccreator').replace(/^product-?world$/, 'productworld').replace(/^meta-?ads$/, 'metaads');
  return ESTILOS_PRO[k] ? k : null;
}
// prompt listo para pegar en una IA de imágenes, junto con la foto del producto
export function promptDe(estilo, its) {
  const e = ESTILOS_PRO[estilo]; if (!e) return '';
  const it = its[0] || {}, n = its.length > 1 ? ` (${its.map(x => '«' + x.nombre + '»').join(', ')}; armá una composición con todos)` : it.nombre ? ` («${it.nombre}»${it.categoria ? ', de la categoría ' + it.categoria : ''})` : '';
  return e.prompt(n, '') + ' Mantené el producto exactamente igual a la foto (forma, colores, etiqueta y textos del envase), sin agregar logos ni textos inventados.';
}
