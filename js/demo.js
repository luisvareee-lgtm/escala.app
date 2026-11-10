// Demo instantánea de la portada: el visitante sube la lista de su proveedor (foto, PDF, Excel o texto) y ve
// su catálogo con precios por cantidad ANTES de registrarse. Todo corre en su navegador: la lista no se sube a ningún lado.
// Al crear la cuenta, el panel le ofrece cargar esos mismos productos.
import { esc, fmt, on, $, store } from './util.js';
import { leerArchivo, parsearLista, detectarTabla, tablaAProductos, deTextoDeFoto } from './importer.js';

const K = 'demo:prods';
const DM = { items: null, busy: false, msg: '', err: '', m1: 50, m12: 20, dolar: 1200, fuente: '' };
const EJEMPLO = `Perfume Asad 100ml EDP $38.500
Perfume Yara 100ml $31.200
Club de Nuit Intense 105ml $42.900
Khamrah 100ml EDP $45.000
Body splash vainilla 250ml $6.800
Crema corporal karité 400ml $9.500
Set de brochas x12 $14.300
Labial mate larga duración $4.200`;
const precio = (costo, m) => Math.ceil(costo * (1 + m / 100) / 10) * 10;
const tiers = c => { const { m1, m12 } = DM; return { 1: precio(c, m1), 3: precio(c, m12 + (m1 - m12) * 0.6), 6: precio(c, m12 + (m1 - m12) * 0.3), 12: precio(c, m12) }; };
const limpio = L => L.filter(x => (x.nombre || '').trim().length >= 3 && x.costo_usd > 0).map(x => ({ nombre: x.nombre.trim().slice(0, 120), costo: x.precio_ars > 0 ? Math.round(x.precio_ars) : Math.round(x.costo_usd * DM.dolar), categoria: x.categoria && x.categoria !== 'General' ? x.categoria : '' })).slice(0, 300);

function deTexto(texto) { return limpio(parsearLista(texto, DM.dolar, 'General', 'ars')); }
async function deArchivo(f) {
  const r = await leerArchivo(f, m => { DM.msg = m; const e = $('#dm-prog'); if (e) e.textContent = m; });
  if (r.tipo === 'tabla') { const det = detectarTabla(r.filas); if (det.map.nombre == null || (det.map.precio == null && det.map.costo == null)) throw new Error('No encontramos las columnas de nombre y precio en esa planilla.'); return limpio(tablaAProductos(det, det.map, { moneda: 'ars', tipo: 'costo', cot: DM.dolar, margen: 0 })); }
  if (r.tipo === 'imagen') { const L = deTexto(r.texto); if (L.length) return L; return limpio([deTextoDeFoto(r.texto, DM.dolar, 'ars')]); }   // lista con varios renglones, o una foto de un solo producto
  if (r.tipo === 'productos') return limpio(r.items.map(i => parsearLista(i.leyenda || '', DM.dolar, 'General', 'ars')[0]).filter(Boolean));
  return deTexto(r.texto || '');
}
const guardar = () => { if (DM.items && DM.items.length) store.set(K, { items: DM.items, m1: DM.m1, at: Date.now() }); };

export function demoHtml() {
  return `<div class="lp-demo" id="lp-demo"><div class="lp-demo-acc">
      <label class="btn btn-p lp-demo-btn">📷 Subí una foto o archivo de tu lista<input type="file" hidden accept="image/*,.pdf,.xlsx,.xls,.ods,.csv,.txt" data-change="dm-file"></label>
      <button class="btn btn-s" data-act="dm-ej">Probar con una lista de ejemplo</button></div>
    <details class="lp-demo-txt"><summary>…o pegá el texto de tu lista</summary><textarea class="fi" id="dm-txt" rows="4" placeholder="Un producto por renglón: Perfume X 100ml $12.500"></textarea><button class="btn btn-s btn-sm" data-act="dm-usar">Ver mi catálogo</button></details>
    <p class="hint">Sin registrarte. Tu lista se lee en tu celular o compu: no se sube a ningún lado.</p>
    <div id="dm-out">${salida()}</div></div>`;
}
function salida() {
  if (DM.busy) return `<div class="center" style="margin:14px 0"><span class="spin"></span><div class="hint" id="dm-prog">${esc(DM.msg || 'Leyendo tu lista…')}</div></div>`;
  if (DM.err) return `<div class="err-box" style="margin-top:10px">${esc(DM.err)}</div>`;
  const L = DM.items; if (!L) return '';
  return `<div class="dm-res"><div class="dm-h"><b>✅ Leímos ${L.length} ${L.length === 1 ? 'producto' : 'productos'}${DM.fuente ? ' de ' + esc(DM.fuente) : ''}. Así quedaría tu tienda:</b>
      <div class="dm-m"><label>Tu ganancia x1 <input class="fi" type="number" min="0" max="500" value="${DM.m1}" data-input="dm-m" data-k="m1" aria-label="Ganancia por unidad en porcentaje">%</label><label>x12 <input class="fi" type="number" min="0" max="500" value="${DM.m12}" data-input="dm-m" data-k="m12" aria-label="Ganancia llevando 12 en porcentaje">%</label></div></div>
    <div class="dm-grid" id="dm-grid">${grilla()}</div>
    ${L.length > 6 ? `<p class="hint">…y ${L.length - 6} productos más.</p>` : ''}
    <a class="btn btn-p dm-cta" href="#/registro" data-act="dm-guardar">Guardar mi tienda gratis con ${L.length === 1 ? 'este producto' : 'estos ' + L.length + ' productos'} →</a>
    <p class="hint">Después podés corregir nombres y costos, sumar fotos y recibir pedidos por WhatsApp. 7 días gratis, sin tarjeta.</p></div>`;
}
const grilla = () => DM.items.slice(0, 6).map(x => { const t = tiers(x.costo); return `<div class="dm-card"><b>${esc(x.nombre)}</b><small>Tu costo: ${fmt(x.costo)}</small><div class="dm-t">${[1, 3, 6, 12].map(n => `<span><i>x${n}${n === 12 ? '+' : ''}</i>${fmt(t[n])}</span>`).join('')}</div><em>Ganás ${fmt(t[1] - x.costo)} por unidad</em></div>`; }).join('');
const pintar = () => { const o = $('#dm-out'); if (o) o.innerHTML = salida(); };
async function correr(fn, fuente) {
  DM.busy = true; DM.err = ''; DM.items = null; DM.msg = ''; pintar();
  try {
    const L = await fn();
    if (!L.length) throw new Error('No pudimos leer productos con precio en esa lista. Probá con una foto más nítida, un Excel o pegando el texto.');
    DM.items = L; DM.fuente = fuente; guardar();
  } catch (e) { DM.err = e.message || 'No se pudo leer el archivo.'; }
  DM.busy = false; pintar();
  const o = $('#dm-out'); if (o && DM.items) o.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
on('dm-file', (d, el) => { const f = el.files[0]; el.value = ''; if (f) correr(() => deArchivo(f), 'tu archivo'); });
on('dm-ej', () => correr(async () => deTexto(EJEMPLO), 'la lista de ejemplo'));
on('dm-usar', () => { const t = ($('#dm-txt') || {}).value || ''; if (t.trim().length < 5) { DM.err = 'Pegá al menos un producto con su precio.'; DM.items = null; return pintar(); } correr(async () => deTexto(t), 'tu texto'); });
on('dm-m', (d, el) => { const v = Number(el.value); if (!(v >= 0)) return; DM[d.k] = v; const g = $('#dm-grid'); if (g) g.innerHTML = grilla(); guardar(); });
on('dm-guardar', () => guardar());

/* ---- después del registro: ofrecer cargar los productos de la prueba ---- */
export const demoPendiente = () => { const d = store.get(K, null); return d && Array.isArray(d.items) && d.items.length && Date.now() - (d.at || 0) < 7 * 864e5 ? d : null; };
export const descartarDemo = () => store.set(K, null);
export function demoPendienteHtml() {
  const d = demoPendiente(); if (!d) return '';
  return `<div class="plan-aviso dm-pend"><span>🎁 Tenés <b>${d.items.length} ${d.items.length === 1 ? 'producto' : 'productos'}</b> de la lista que probaste en la portada.</span><span class="plan-aviso-acc"><button class="btn btn-p btn-sm" data-act="dm-cargar">Cargarlos a mi tienda</button><button class="linkb" data-act="dm-descartar">Descartar</button></span></div>`;
}
// filas listas para insertar (el panel hace el insert y recarga)
export function filasDemo(t) {
  const d = demoPendiente(); if (!d) return [];
  const cot = Number(t.cotizacion_usd) > 0 ? Number(t.cotizacion_usd) : 1, vistos = new Set();
  return d.items.filter(x => { const k = x.nombre.toLowerCase(); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .map(x => ({ tenant_id: t.id, nombre: x.nombre.slice(0, 160), categoria: (x.categoria || 'General').slice(0, 60), costo_usd: Math.round(x.costo / cot * 10000) / 10000, variantes: [], emoji: '📦', activo: true }));
}
