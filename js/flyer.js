// Estudio de flyers 9:16 (1080 x 1920) para Estados de WhatsApp e historias de Instagram.
// Todo se dibuja en el navegador con <canvas>: no sube nada a ningún servidor.
// Tres usos:  'reventa'  (tienda pública, marca blanca: NUNCA dibuja datos del comercio),
//             'comercio' (panel: con logo, nombre, enlace y WhatsApp de la tienda)  y  'demo' (portada).
import { esc, fmt, on, toast, store, debounce, copiar } from './util.js';
import { ESTILOS_PRO, CODIGOS, estiloDeCodigo, promptDe } from './flyer_pro.js';

export const ESTILOS = { oscuro: 'Oscuro elegante', claro: 'Claro minimalista', vibrante: 'Vibrante oferta' };
export const BADGES = ['🔥 En Stock', '✨ Nuevo Ingreso', '📦 Por Encargo', '⚡ Oferta'];
const W = 1080, H = 1920, FUENTE = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const HEX = /^#[0-9a-fA-F]{6}$/;

const F = { abierto: false, modo: 'reventa', items: [], marca: null, estilo: 'oscuro', badge: BADGES[0], precios: 'unico', pie: { nombre: '', wsp: '' }, fallos: 0, textos: [], puedeEscalas: false };
const cache = new Map();   // url -> Promise<HTMLImageElement|null>

/* ---------- imágenes: se piden con permiso CORS; si el sitio de la foto no lo da, se usa un ícono (el canvas nunca queda bloqueado) ---------- */
function cargar(url) {
  if (!url || !/^(https:|blob:|data:image\/|\/)/.test(url)) return Promise.resolve(null);
  if (cache.has(url)) return cache.get(url);
  const p = new Promise(res => {
    const im = new Image(); let listo = false; const fin = v => { if (!listo) { listo = true; res(v); } };
    im.crossOrigin = 'anonymous'; im.onload = () => fin(im.naturalWidth > 1 ? im : null); im.onerror = () => fin(null);
    setTimeout(() => fin(null), 8000); im.src = url;
  });
  cache.set(url, p); return p;
}

/* ---------- colores ---------- */
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = h => { const [r, g, b] = rgb(h); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const mezcla = (h, k) => '#' + rgb(h).map(x => Math.max(0, Math.min(255, Math.round(k < 0 ? x * (1 + k) : x + (255 - x) * k))).toString(16).padStart(2, '0')).join('');
function tema(estilo, color) {
  const c = HEX.test(color || '') ? color : null;
  if (estilo === 'claro') { const ac = c && lum(c) < 0.75 ? c : '#1d3a8a'; return { bg: ['#faf8f3', '#efece4'], fg: '#14161c', sub: '#5b6272', ac, onAc: lum(ac) > 0.6 ? '#14161c' : '#ffffff', precio: '#14161c', tile: '#ffffff', tileB: '#e3dfd4', tileFg: '#14161c' }; }
  if (estilo === 'vibrante') { const ac = c || '#ff2d55', b = c ? mezcla(c, -0.45) : '#ff8a00'; return { bg: [ac, b], fg: '#ffffff', sub: 'rgba(255,255,255,.86)', ac: '#ffe600', onAc: '#14161c', precio: '#14161c', precioBg: '#ffe600', tile: 'rgba(255,255,255,.16)', tileB: 'rgba(255,255,255,.35)', tileFg: '#ffffff' }; }
  const ac = c && lum(c) > 0.35 ? c : '#f5c451';
  return { bg: ['#0c1018', '#1b2233'], fg: '#ffffff', sub: 'rgba(255,255,255,.72)', ac, onAc: lum(ac) > 0.6 ? '#14161c' : '#ffffff', precio: '#ffd166', tile: 'rgba(255,255,255,.07)', tileB: 'rgba(255,255,255,.18)', tileFg: '#ffffff' };
}

/* ---------- utilidades de dibujo ---------- */
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
}
const fuente = (px, peso = 800, fam = FUENTE) => `${peso} ${px}px ${fam || FUENTE}`;
// TODO el texto del flyer pasa por acá: así se puede comprobar qué dice (y qué NO dice) la imagen.
function txt(ctx, s, x, y, o = {}) {
  s = String(s == null ? '' : s); if (!s) return 0;
  ctx.font = fuente(o.px || 40, o.peso, o.fam); ctx.fillStyle = o.color || '#fff'; ctx.textAlign = o.al || 'left'; ctx.textBaseline = o.base || 'alphabetic';
  if (o.max) { let px = o.px || 40; while (ctx.measureText(s).width > o.max && px > (o.min || 18)) { px -= 2; ctx.font = fuente(px, o.peso, o.fam); } }
  ctx.fillText(s, x, y); if (!o.mudo) F.textos.push(s); return ctx.measureText(s).width;
}
function renglones(ctx, s, px, peso, max, n, fam) {
  ctx.font = fuente(px, peso, fam); const pal = String(s || '').split(/\s+/).filter(Boolean), L = []; let a = '';
  for (const p of pal) { const t = a ? a + ' ' + p : p; if (ctx.measureText(t).width <= max || !a) a = t; else { L.push(a); a = p; } }
  if (a) L.push(a);
  if (L.length > n) { let u = L[n - 1]; while (u.length > 3 && ctx.measureText(u + '…').width > max) u = u.slice(0, -1); L.length = n; L[n - 1] = u.replace(/[\s,.;:-]+$/, '') + '…'; }
  return L;
}
function parrafo(ctx, s, x, y, o) { const L = renglones(ctx, s, o.px, o.peso, o.max, o.n || 2, o.fam); L.forEach((l, i) => txt(ctx, l, x, y + i * o.px * 1.16, { ...o, max: o.max, mudo: true })); F.textos.push(String(s)); return L.length * o.px * 1.16; }

// Foto normalizada: cuadradas llenan el marco; verticales/apaisadas van enteras sobre un fondo difuminado de la misma foto.
function foto(ctx, im, it, x, y, w, h, r, T) {
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  if (im) {
    const ri = im.naturalWidth / im.naturalHeight, rc = w / h, cubre = (a = 1) => { const s = Math.max(w / im.naturalWidth, h / im.naturalHeight) * a, dw = im.naturalWidth * s, dh = im.naturalHeight * s; ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); };
    if (Math.abs(ri - rc) / rc < 0.22) cubre();
    else {
      ctx.fillStyle = T.tile; ctx.fillRect(x, y, w, h);
      if ('filter' in ctx) { ctx.filter = 'blur(38px) brightness(.82)'; cubre(1.25); ctx.filter = 'none'; }
      const s = Math.min(w / im.naturalWidth, h / im.naturalHeight), dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 40; ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.shadowBlur = 0;
    }
  } else {
    const g = ctx.createLinearGradient(x, y, x + w, y + h); g.addColorStop(0, T.tile); g.addColorStop(1, T.tileB); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.font = fuente(Math.round(Math.min(w, h) * 0.42), 400); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = T.fg; ctx.fillText(it.emoji || '📦', x + w / 2, y + h / 2 + 8);
  }
  ctx.restore();
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.lineWidth = 3; ctx.strokeStyle = T.tileB; ctx.stroke(); ctx.restore();
}

const num = v => Math.max(0, Math.round(Number(v) || 0));
const conEscalas = it => F.precios === 'escalas' && it.escalas && it.escalas[12] < it.escalas[1];
function precioDe(it) {   // texto principal y aclaración
  if (F.precios === 'desde' && it.escalas && it.escalas[12] < it.escalas[1]) return { p: fmt(it.escalas[12]), pre: 'Desde', nota: 'llevando 12 u. o más' };
  if (F.precios === 'minorista' && it.min > 0) return { p: fmt(it.min), pre: '', nota: '' };
  return { p: fmt(num(it.precio)), pre: '', nota: '' };
}
function etiquetaPrecio(ctx, T, s, cx, y, px, pre) {
  ctx.font = fuente(px, 900); const w = ctx.measureText(s).width;
  if (T.precioBg) { ctx.save(); ctx.fillStyle = T.precioBg; rr(ctx, cx - w / 2 - px * 0.32, y - px * 0.92, w + px * 0.64, px * 1.22, px * 0.24); ctx.fill(); ctx.restore(); }
  if (pre) txt(ctx, pre, cx - w / 2 - (T.precioBg ? px * 0.32 : 0), y - px * (T.precioBg ? 1.08 : 0.98), { px: Math.round(px * 0.3), peso: 700, color: T.sub });
  txt(ctx, s, cx, y, { px, peso: 900, color: T.precio, al: 'center' });
}
// ofertas: el "-15%" sobre la foto y el precio de antes tachado
function sticker(ctx, pct, x, y, r) {
  if (!(pct > 0)) return;
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#e11d48'; ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 18; ctx.fill(); ctx.restore();
  txt(ctx, '-' + pct + '%', x, y + r * 0.2, { px: Math.round(r * 0.6), peso: 900, color: '#fff', al: 'center', max: r * 1.7 });
  txt(ctx, 'OFERTA', x, y + r * 0.58, { px: Math.round(r * 0.24), peso: 800, color: 'rgba(255,255,255,.92)', al: 'center', mudo: true });
}
function tachar(ctx, T, s, cx, y, px) {
  const w = txt(ctx, s, cx, y, { px, peso: 700, color: T.sub, al: 'center' });
  ctx.save(); ctx.fillStyle = T.sub; ctx.fillRect(cx - w / 2 - 4, y - px * 0.34, w + 8, Math.max(3, Math.round(px * 0.08))); ctx.restore();
}
const antesDe = it => (F.precios === 'unico' || F.precios === 'minorista') && Number(it.antes) > num(it.precio) ? fmt(it.antes) : '';
function tablaEscalas(ctx, T, e, x, y, w, h) {
  const g = Math.round(w * 0.022), cw = (w - g * 3) / 4;
  [1, 3, 6, 12].forEach((n, i) => {
    const cx = x + i * (cw + g), mejor = n === 12;
    ctx.save(); rr(ctx, cx, y, cw, h, h * 0.16); ctx.fillStyle = mejor ? T.ac : T.tile; ctx.fill(); if (!mejor) { ctx.lineWidth = 2; ctx.strokeStyle = T.tileB; ctx.stroke(); } ctx.restore();
    txt(ctx, 'x' + n + (n === 12 ? '+' : ''), cx + cw / 2, y + h * 0.36, { px: Math.round(h * 0.25), peso: 700, color: mejor ? T.onAc : T.sub, al: 'center' });
    txt(ctx, fmt(e[n]), cx + cw / 2, y + h * 0.78, { px: Math.round(h * 0.31), peso: 900, color: mejor ? T.onAc : T.tileFg, al: 'center', max: cw - 14 });
  });
}


// Pie del flyer: comercio = su marca; reventa = solo el contacto que escribe el revendedor (nunca datos del comercio); demo = aviso.
// o.M = margen, o.fam = tipografía, o.compacto = pie bajo (formato 4:5 o franjas de cine)
function dibujarPie(ctx, T, logo, py, o = {}) {
  const M = o.M || 90, k = o.compacto ? 0.72 : 1, fam = o.fam, f = (px, peso, color, extra) => ({ px: Math.round(px * k), peso, color, fam, ...extra });
  ctx.fillStyle = T.tileB; ctx.fillRect(M, py - 6, W - M * 2, 3);
  if (F.modo === 'comercio' && F.marca) {
    const m = F.marca; let x = M;
    const L = Math.round(120 * k), ly = py + Math.round(34 * k);
    if (logo) { ctx.save(); rr(ctx, x, ly, L, L, 28 * k); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(x, ly, L, L); const s = Math.min(L / logo.naturalWidth, L / logo.naturalHeight); ctx.drawImage(logo, x + (L - logo.naturalWidth * s) / 2, ly + (L - logo.naturalHeight * s) / 2, logo.naturalWidth * s, logo.naturalHeight * s); ctx.restore(); x += L + 30 * k; }
    txt(ctx, m.nombre, x, py + 84 * k, f(54, 800, T.fg, { max: W - M - x }));
    const l2 = [m.url ? '🛒 ' + m.url : '', m.wsp ? '📲 ' + m.wsp : ''].filter(Boolean).join('   ');
    txt(ctx, l2, x, py + 142 * k, f(36, 600, T.sub, { max: W - M - x }));
  } else if (F.modo === 'demo') {
    txt(ctx, 'Tu marca, tu enlace y tu WhatsApp van acá', W / 2, py + 100 * k, f(40, 700, T.sub, { al: 'center', max: W - M * 2 }));
  } else {
    const n = F.pie.nombre.trim(), w = F.pie.wsp.trim();
    if (n) txt(ctx, n, W / 2, py + (w ? 84 : 110) * k, f(58, 800, T.fg, { al: 'center', max: W - M * 2 }));
    if (w) txt(ctx, '📲 ' + w, W / 2, py + (n ? 150 : 110) * k, f(44, 700, n ? T.sub : T.fg, { al: 'center', max: W - M * 2 }));
    if (!n && !w) txt(ctx, 'Consultame por mensaje 💬', W / 2, py + 110 * k, f(44, 700, T.sub, { al: 'center' }));
  }
}

// lo que los estilos publicitarios (flyer_pro.js) usan del estudio
const K = { txt, rr, parrafo, renglones, foto, sticker, tachar, precioDe, antesDe, fuente, mezcla, lum, num, fmt, F, pie: dibujarPie };

/* ---------- el flyer ---------- */
export async function dibujar(canvas) {
  const ctx = canvas.getContext('2d'), its = F.items.slice(0, 4), T = tema(F.estilo, F.modo === 'comercio' && F.marca ? F.marca.color : null);
  const ims = await Promise.all(its.map(it => cargar(it.img)));
  const logo = F.modo === 'comercio' && F.marca ? await cargar(F.marca.logo) : null;
  F.textos = []; F.fallos = its.filter((it, i) => it.img && !ims[i]).length;
  // estilos publicitarios (/productworld, /luxury, /metaads…): cada uno arma su propia composición
  const pro = ESTILOS_PRO[F.estilo], alto = (pro && pro.alto) || H;
  if (canvas.height !== alto) canvas.height = alto;
  canvas.style.aspectRatio = W + ' / ' + alto;
  if (pro) {
    const color = F.modo === 'comercio' && F.marca && HEX.test(F.marca.color || '') ? F.marca.color : null;
    const quien = F.modo === 'comercio' && F.marca ? F.marca.nombre : F.modo === 'demo' ? 'Tu marca' : (F.pie.nombre.trim() || 'Mis recomendados');
    ctx.save(); pro.dibujar(ctx, K, { W, H: alto, its, ims, logo, color, quien }); ctx.restore();
    return terminar(canvas);
  }
  const g = ctx.createLinearGradient(0, 0, W * 0.35, H); g.addColorStop(0, T.bg[0]); g.addColorStop(1, T.bg[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // brillo suave arriba
  const gl = ctx.createRadialGradient(W * 0.85, 120, 20, W * 0.85, 120, 760); gl.addColorStop(0, F.estilo === 'claro' ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.13)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.fillRect(0, 0, W, 900);

  const M = 90; let y = 170;
  if (F.badge) {
    ctx.font = fuente(44, 800); const bw = ctx.measureText(F.badge).width + 72;
    ctx.save(); rr(ctx, M, y, bw, 92, 46); ctx.fillStyle = T.ac; ctx.fill(); ctx.restore();
    txt(ctx, F.badge, M + 36, y + 62, { px: 44, peso: 800, color: T.onAc });
  }
  y = 310;
  const pieAlto = 250, fin = H - pieAlto - 40;

  if (its.length === 1) {
    const it = its[0], lado = W - M * 2, esc_ = conEscalas(it);
    const fh = esc_ ? 800 : 880;
    foto(ctx, ims[0], it, M, y, lado, fh, 54, T); sticker(ctx, it.pct, M + lado - 110, y + 110, 92); y += fh + 84;
    y += parrafo(ctx, it.nombre, M, y, { px: 70, peso: 800, color: T.fg, max: lado, n: 2 });
    if (esc_) { txt(ctx, 'Precio por cantidad', M, y + 28, { px: 36, peso: 600, color: T.sub }); tablaEscalas(ctx, T, it.escalas, M, y + 56, lado, 190); }
    else { const pr = precioDe(it), an = antesDe(it), yp = Math.min(y + (an ? 250 : 190), fin - 40); if (an) tachar(ctx, T, 'Antes ' + an, W / 2, yp - 186, 56); etiquetaPrecio(ctx, T, pr.p, W / 2, yp, 168, pr.pre); if (pr.nota) txt(ctx, pr.nota, W / 2, Math.min(yp + 72, fin), { px: 40, peso: 600, color: T.sub, al: 'center' }); }
  } else {
    const cols = 2, filas = Math.ceil(its.length / 2), gap = 40, cw = (W - M * 2 - gap) / cols, alto = (fin - y - gap * (filas - 1)) / filas, conAntes = its.some(antesDe);   // con "Antes $…" la foto se achica un poco para que entre
    its.forEach((it, i) => {
      const f = Math.floor(i / 2), sola = i === its.length - 1 && its.length % 2 === 1;
      const x = sola ? (W - cw) / 2 : M + (i % 2) * (cw + gap), cy = y + f * (alto + gap), esc_ = conEscalas(it);
      const texto = esc_ ? 250 : conAntes ? 280 : 220, fh = Math.min(alto - texto, filas === 1 ? 640 : cw), top = cy + (filas === 1 ? (alto - fh - texto) / 2 : 0);
      foto(ctx, ims[i], it, x, top, cw, fh, 40, T); sticker(ctx, it.pct, x + cw - 66, top + 66, 54);
      let ty = top + fh + 54;
      parrafo(ctx, it.nombre, x + cw / 2, ty, { px: 38, peso: 700, color: T.fg, max: cw - 8, n: 2, al: 'center' }); ty += 38 * 1.16 * 2;   // siempre dos renglones: los precios quedan alineados
      if (esc_) {
        const e = it.escalas, fila = (a, b, yy) => { txt(ctx, `x${a} ${fmt(e[a])}`, x + cw * 0.25, yy, { px: 32, peso: 800, color: T.tileFg, al: 'center', max: cw / 2 - 10 }); txt(ctx, `x${b}${b === 12 ? '+' : ''} ${fmt(e[b])}`, x + cw * 0.75, yy, { px: 32, peso: 800, color: b === 12 ? (T.precioBg ? T.ac : T.precio) : T.tileFg, al: 'center', max: cw / 2 - 10 }); };
        fila(1, 3, ty + 26); fila(6, 12, ty + 72);
      } else { const pr = precioDe(it), an = antesDe(it); etiquetaPrecio(ctx, T, (pr.pre ? pr.pre + ' ' : '') + pr.p, x + cw / 2, ty + 62, pr.pre ? 58 : 72, ''); if (an) tachar(ctx, T, 'Antes ' + an, x + cw / 2, ty + 112, 30); }
    });
  }

  // ---- pie ----
  dibujarPie(ctx, T, logo, H - pieAlto);
  terminar(canvas);
}
function terminar(canvas) {
  canvas.setAttribute('aria-label', 'Flyer: ' + F.textos.join(' · ')); canvas.dataset.listo = String(Date.now()); canvas.dataset.fallos = String(F.fallos);
  const nota = document.getElementById('fl-nota');
  if (nota) nota.textContent = F.fallos ? `${F.fallos === 1 ? 'Una foto no se pudo usar' : F.fallos + ' fotos no se pudieron usar'} en la imagen (el sitio donde está guardada no lo permite). Va con un ícono en su lugar.` : '';
}
const redibujar = debounce(() => { const c = document.getElementById('fl-canvas'); if (c) dibujar(c); }, 140);

/* ---------- ventana ---------- */
function raiz() { let r = document.getElementById('flyer-root'); if (!r) { r = document.createElement('div'); r.id = 'flyer-root'; document.body.appendChild(r); } return r; }
function pintar() {
  const r = raiz(); if (!F.abierto) { r.innerHTML = ''; return; }
  const rev = F.modo === 'reventa', com = F.modo === 'comercio', varios = F.items.length > 1;
  const chips = (act, lista, sel) => lista.map(([v, t]) => `<button type="button" class="pill ${sel === v ? 'on' : ''}" data-act="${act}" data-v="${esc(v)}" aria-pressed="${sel === v}">${esc(t)}</button>`).join('');
  r.innerHTML = `<div class="modal-bg" data-act="fl-bg"><div class="modal modal-ancho fl" role="dialog" aria-modal="true" aria-label="Crear flyer">
    <div class="view-title">📸 ${varios ? `Flyer con ${F.items.length} productos` : 'Flyer del producto'}</div>
    <p class="hint">${rev ? 'Imagen vertical lista para tus Estados de WhatsApp o historias. <b>Sale sin datos de la tienda</b>: solo tu precio y tu contacto.' : com ? 'Imagen vertical con tu marca, tu enlace y tu WhatsApp, lista para Estados e historias.' : 'Así se ve un flyer armado con lo que leímos de tu lista.'}</p>
    <div class="fl-grid"><div class="fl-prev"><canvas id="fl-canvas" width="${W}" height="${H}" role="img" aria-label="Flyer"></canvas><p class="hint" id="fl-nota" role="status"></p></div>
    <div class="fl-ctrl">
      <div class="fg"><span class="flabel">Estilo</span><div class="fl-chips">${chips('fl-estilo', Object.entries(ESTILOS), F.estilo)}</div></div>
      <div class="fg"><span class="flabel">Estilos publicitarios <small class="muted">· tocá uno o escribí su código</small></span><div class="fl-chips">${chips('fl-estilo', CODIGOS.map(k => [k, ESTILOS_PRO[k].ico + ' /' + k]), F.estilo)}</div>
        <input class="fi fl-cod" id="fl-cod" placeholder="Escribí un código: /luxury, /ugc, /metaads…" data-input="fl-cod" aria-label="Código de estilo" autocomplete="off" autocapitalize="none" value="${esc(F.cod || '')}">
        ${ESTILOS_PRO[F.estilo] ? `<p class="hint fl-desc"><b>${esc(ESTILOS_PRO[F.estilo].nombre)}:</b> ${esc(ESTILOS_PRO[F.estilo].desc)}${ESTILOS_PRO[F.estilo].alto ? ' Sale en formato 4:5, el de las publicaciones y anuncios del feed.' : ''}${F.precios === 'escalas' ? ' Muestra el precio por unidad (la tabla x1 · x3 · x6 · x12 va en los estilos clásicos).' : ''}</p>
        <details class="fl-ia"><summary>🤖 Prompt para IA <small class="muted">(opcional)</small></summary><p class="hint">Copialo y pegalo en ChatGPT o Gemini junto con la foto del producto: te arma una foto realista en este estilo. Después podés usarla como foto del producto.</p><textarea class="fi" id="fl-prompt" rows="6" readonly aria-label="Prompt para IA">${esc(promptDe(F.estilo, F.items))}</textarea><button type="button" class="btn btn-s btn-sm" data-act="fl-prompt">📋 Copiar prompt</button></details>` : ''}</div>
      <div class="fg"><span class="flabel">Etiqueta</span><div class="fl-chips">${chips('fl-badge', [...BADGES.map(b => [b, b]), ['', 'Sin etiqueta']], F.badge)}</div></div>
      ${com && F.puedeEscalas ? `<div class="fg"><span class="flabel">Qué precio mostrar</span><div class="fl-chips">${chips('fl-precios', [['escalas', 'Tabla x1 · x3 · x6 · x12'], ['desde', 'Desde $… llevando 12'], ...(F.items.some(i => i.min > 0) ? [['minorista', 'Precio minorista']] : [['unico', 'Solo precio x1']])], F.precios)}</div></div>` : ''}
      ${rev || F.modo === 'demo' ? `<div class="fg"><span class="flabel">${rev ? 'Tu precio de venta al público' : 'Precio que muestra'}</span>${F.items.map((it, i) => `<label class="fl-precio"><span>${esc(it.nombre)}</span><span class="fl-pin"><i>$</i><input class="fi" inputmode="numeric" data-input="fl-precio" data-i="${i}" value="${num(it.precio)}" aria-label="Precio de ${esc(it.nombre)}"></span></label>`).join('')}${rev ? '<p class="hint">Es el precio que ven tus clientes. Lo que te cuesta a vos no aparece.</p>' : ''}</div>` : ''}
      ${rev ? `<div class="fg"><span class="flabel">Tu contacto al pie <small class="muted">(opcional)</small></span><input class="fi" data-input="fl-pie" data-k="nombre" maxlength="40" placeholder="Tu nombre o el de tu emprendimiento" value="${esc(F.pie.nombre)}" aria-label="Tu nombre o marca"><input class="fi" style="margin-top:6px" data-input="fl-pie" data-k="wsp" maxlength="24" inputmode="tel" placeholder="Tu WhatsApp" value="${esc(F.pie.wsp)}" aria-label="Tu WhatsApp"></div>` : ''}
      <div class="stack"><button class="btn btn-wa" data-act="fl-compartir">📲 Compartir en WhatsApp / Instagram</button><button class="btn btn-s" data-act="fl-bajar">⬇️ Descargar imagen PNG</button><button class="btn btn-s" data-act="fl-cerrar">Cerrar</button></div>
    </div></div></div></div>`;
  dibujar(document.getElementById('fl-canvas'));
}

// cfg: { modo, items:[{nombre, img, emoji, precio, escalas:{1,3,6,12}|null, min}], marca:{nombre, logo, color, url, wsp}, badge }
export function abrirFlyer(cfg) {
  const items = (cfg.items || []).filter(Boolean).slice(0, 4); if (!items.length) { toast('Elegí al menos un producto'); return; }
  F.abierto = true; F.modo = cfg.modo || 'reventa'; F.items = items.map(i => ({ ...i }));
  F.marca = F.modo === 'comercio' ? cfg.marca || null : null;   // en marca blanca los datos del comercio ni siquiera entran al estudio
  F.puedeEscalas = F.modo === 'comercio' && items.some(i => i.escalas && i.escalas[12] < i.escalas[1]);
  F.precios = F.puedeEscalas ? 'escalas' : 'unico';
  F.badge = cfg.badge !== undefined && (cfg.badge === '' || BADGES.includes(cfg.badge)) ? cfg.badge : BADGES[0];
  F.estilo = store.get('fly:estilo', F.modo === 'comercio' ? 'claro' : 'oscuro'); if (!ESTILOS[F.estilo] && !ESTILOS_PRO[F.estilo]) F.estilo = 'oscuro'; F.cod = '';
  const g = store.get('fly:pie', null); F.pie = { nombre: g && typeof g.nombre === 'string' ? g.nombre.slice(0, 40) : '', wsp: g && typeof g.wsp === 'string' ? g.wsp.slice(0, 24) : '' };
  pintar();
}
export const flyerAbierto = () => F.abierto;
const cerrar = () => { F.abierto = false; pintar(); };
on('fl-cerrar', cerrar);
on('fl-bg', (d, b, e) => { if (e.target === b) cerrar(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && F.abierto) cerrar(); });
on('fl-estilo', d => { F.estilo = d.v; F.cod = ''; store.set('fly:estilo', d.v); pintar(); });
on('fl-cod', (d, el) => {
  F.cod = el.value; const k = estiloDeCodigo(el.value); if (!k || k === F.estilo) return;
  F.estilo = k; store.set('fly:estilo', k); pintar();
  const i = document.getElementById('fl-cod'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
});
on('fl-prompt', () => { const t = document.getElementById('fl-prompt'); if (!t) return; copiar(t.value); try { t.select(); } catch (e) { } });
on('fl-badge', d => { F.badge = d.v; pintar(); });
on('fl-precios', d => { F.precios = d.v; pintar(); });
on('fl-precio', (d, el) => { const it = F.items[+d.i]; if (it) { it.precio = num(String(el.value).replace(/\D/g, '')); redibujar(); } });
on('fl-pie', (d, el) => { F.pie[d.k] = el.value; store.set('fly:pie', F.pie); redibujar(); });

const aBlob = () => new Promise((res, rej) => { const c = document.getElementById('fl-canvas'); try { c.toBlob(b => b ? res(b) : rej(new Error('sin imagen')), 'image/png'); } catch (e) { rej(e); } });
const nombreArchivo = () => 'flyer-' + (F.items[0].nombre || 'producto').normalize('NFD').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase().slice(0, 30) + '.png';
function bajar(blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombreArchivo(); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
on('fl-bajar', async () => { try { await dibujar(document.getElementById('fl-canvas')); bajar(await aBlob()); toast('Imagen descargada ✓'); } catch (e) { toast('No se pudo generar la imagen. Probá con otro navegador.'); } });
on('fl-compartir', async () => {
  let blob; try { await dibujar(document.getElementById('fl-canvas')); blob = await aBlob(); } catch (e) { toast('No se pudo generar la imagen. Probá con otro navegador.'); return; }
  const f = new File([blob], nombreArchivo(), { type: 'image/png' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f] }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  bajar(blob); toast('Tu navegador no comparte imágenes directo: la descargamos. Subila a tu Estado o historia.');
});
