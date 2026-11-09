// Precios inteligentes: ajuste masivo, comparador de proveedores y referencia de mercado (manual o a demanda).
import { api } from './api.js';
import { esc, fmt, on, toast, confirmar } from './util.js';
import { P, can, aviso } from './state.js';

const R = { an: null, sel: new Set(), psel: new Set(), conf: null, busy: false, msg: '', err: '' };
const u2 = n => (Math.round(Number(n) * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 });
const dias = f => Math.floor((Date.now() - new Date(f)) / 864e5);
const ESTADO = { barato: ['warn', 'Por debajo del mercado'], caro: ['bad', 'Por encima del mercado'], competitivo: ['ok', 'Competitivo'], sin_margen: ['bad', 'Caro, pero bajar rompe tu margen mínimo'], sin_referencia: ['', 'Sin referencias'] };
const volver = async () => { try { P.prods = await api.misProductos(); P.provs = await api.misProveedores(); } catch (e) { } R.busy = false; P.repintar(); };

export function vistaPrecios() {
  const cats = [...new Set(P.prods.map(p => p.categoria))];
  const masivo = `<div class="cc"><h3>⚡ Actualización masiva de precios</h3><p class="hint" style="margin-bottom:8px">Subí o bajá el costo de todo el catálogo (o de una categoría) en 1 clic. Útil cuando tu proveedor aumenta.</p>
    <div class="row2"><div class="fg"><label class="flabel">Porcentaje (+ sube, − baja)</label><input class="fi" id="pm-pct" type="number" step="0.1" min="-90" max="500" placeholder="Ej: 8"></div><div class="fg"><label class="flabel">Categoría</label><select class="fi" id="pm-cat"><option value="">Todo el catálogo</option>${cats.map(c => `<option>${esc(c)}</option>`).join('')}</select></div></div>
    ${R.conf ? `<div class="err-box">¿Aplicar ${R.conf.pct > 0 ? '+' : ''}${R.conf.pct}% al costo de ${R.conf.cat ? 'la categoría ' + esc(R.conf.cat) : 'TODOS los productos'}?</div><button class="btn btn-p" data-act="pm-ok">Sí, aplicar</button><button class="btn btn-s" style="margin-top:8px" data-act="pm-no">Cancelar</button>` : `<button class="btn btn-s" data-act="pm-pre">Aplicar ajuste</button>`}</div>`;
  const msgs = (R.err ? `<div class="err-box">${esc(R.err)}</div>` : '') + (R.msg ? `<div class="ok-box">${esc(R.msg)}</div>` : '');
  return msgs + masivo + vistaProv() + vistaMercado();
}
function vistaProv() {
  if (!can('proveedores')) return `<div class="locked"><b>🏭 Comparador de proveedores</b><p style="margin:6px 0">Cargá las listas de 2 o 3 proveedores y elegí el costo más bajo, producto por producto.</p><span class="tag warn">🔒 Plan Mayorista Pro</span><br><button class="btn btn-p btn-sm lock-cta" data-act="p-planes" data-p="pro">Ver planes y activar</button></div>`;
  const por = new Map(); P.provs.forEach(s => { const l = por.get(s.product_id) || []; l.push(s); por.set(s.product_id, l); });
  const filas = P.prods.filter(p => por.has(p.id));
  return `<div class="cc"><h3>🏭 Comparador de proveedores</h3><p class="hint" style="margin-bottom:8px">Subí cada lista desde <b>Productos → Importar → Lista de un proveedor</b>. Acá ves quién tiene el mejor costo y lo aplicás cuando quieras.</p>
  ${filas.length ? `<div class="tblw"><table class="tbl"><tr><th></th><th>Producto</th><th>Tu costo</th><th>Ofertas (USD)</th></tr>${filas.map(p => { const ofs = por.get(p.id).sort((a, b) => a.costo_usd - b.costo_usd); const best = ofs.find(o => o.disponible); const mejor = best && Number(best.costo_usd) < Number(p.costo_usd);
    return `<tr><td><input type="checkbox" data-change="pv-sel" data-id="${p.id}" ${R.psel.has(p.id) ? 'checked' : ''} aria-label="Elegir ${esc(p.nombre)}"></td><td>${esc(p.nombre)}</td><td>${u2(p.costo_usd)}</td><td>${ofs.map(o => `<span class="tag ${o === best ? (mejor ? 'ok' : '') : ''}" style="${o.disponible ? '' : 'text-decoration:line-through'}">${esc(o.proveedor)}: ${u2(o.costo_usd)}${dias(o.updated_at) > 30 ? ` <small>(hace ${dias(o.updated_at)} d)</small>` : ''}</span>`).join(' ')}</td></tr>`; }).join('')}</table></div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-p btn-sm" data-act="pv-ap" ${R.psel.size ? '' : 'disabled'}>Usar el más barato en los elegidos (${R.psel.size})</button><button class="btn btn-s btn-sm" data-act="pv-todos">Elegir todos</button></div>` : '<p class="muted">Todavía no cargaste listas de proveedores.</p>'}</div>`;
}
function vistaMercado() {
  if (!can('mercado')) return `<div class="locked"><b>💹 Referencia de mercado</b><p style="margin:6px 0">Compará tus precios con los de tu competencia y recibí una sugerencia para cada producto.</p><span class="tag warn">🔒 Plan Mayorista Pro</span><br><button class="btn btn-p btn-sm lock-cta" data-act="p-planes" data-p="pro">Ver planes y activar</button></div>`;
  const A = R.an;
  const tabla = A ? `<div class="tblw"><table class="tbl"><tr><th></th><th>Producto</th><th>Mi precio</th><th>Mercado (mín · med · máx)</th><th>Sugerido</th></tr>${A.filter(a => a.estado !== 'sin_referencia').map(a => { const [c, n] = ESTADO[a.estado]; const ap = a.estado === 'caro' || a.estado === 'barato';
    return `<tr><td>${ap ? `<input type="checkbox" data-change="mk-sel" data-id="${a.product_id}" ${R.sel.has(a.product_id) ? 'checked' : ''} aria-label="Elegir ${esc(a.nombre)}">` : ''}</td><td>${esc(a.nombre)}<br><span class="tag ${c}">${n}</span></td><td>${fmt(a.precio_actual)}</td><td>${fmt(a.ref_min)} · ${fmt(a.ref_med)} · ${fmt(a.ref_max)}<br><small class="muted">${a.n_refs} ref.</small></td><td>${ap ? '<b>' + fmt(a.precio_sugerido) + '</b><br><small class="muted">margen ' + Math.round(a.margen_sugerido * 100) + '%</small>' : '—'}</td></tr>`; }).join('')}</table></div>
    <p class="hint" style="margin-top:6px">${A.filter(a => a.estado === 'sin_referencia').length} productos sin referencias no se muestran. El precio sugerido apunta al 98% de la mediana y nunca baja de tu margen mínimo (${Math.round(Number(P.t.margen_piso) * 100)}%).</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn btn-p btn-sm" data-act="mk-ap" ${R.sel.size ? '' : 'disabled'}>Aplicar sugerido a los elegidos (${R.sel.size})</button><button class="btn btn-s btn-sm" data-act="mk-todos">Elegir todos los aplicables</button></div>` : '';
  return `<div class="cc"><h3>💹 Referencia de mercado</h3><p class="hint" style="margin-bottom:8px">Cargá los precios de tu competencia desde <b>Productos → Importar → Precios de un competidor</b> (lista, captura o planilla). Vos decidís: ves la referencia y aplicás a mano, o a demanda para varios productos. No consultamos tiendas de terceros por vos.</p>
  <button class="btn btn-s btn-sm" data-act="mk-analizar">${R.busy ? 'Analizando…' : 'Analizar mis precios'}</button>${tabla}</div>`;
}
on('pm-pre', () => { const pct = parseFloat(document.getElementById('pm-pct').value); if (!isFinite(pct) || pct === 0 || pct < -90 || pct > 500) { R.err = 'Poné un porcentaje entre -90 y 500 (distinto de 0).'; R.msg = ''; return P.repintar(); } R.err = ''; R.conf = { pct, cat: document.getElementById('pm-cat').value }; P.repintar(); });
on('pm-no', () => { R.conf = null; P.repintar(); });
on('pm-ok', async () => { const c = R.conf; R.conf = null; R.an = null; try { const n = await api.ajustarCostos(c.pct, c.cat || null); R.msg = `Listo: se actualizó el costo de ${n} productos.`; R.err = ''; } catch (e) { R.err = e.message; R.msg = ''; } await volver(); });
on('pv-sel', (d, el) => { el.checked ? R.psel.add(d.id) : R.psel.delete(d.id); P.repintar(); });
on('pv-todos', () => { P.provs.forEach(s => R.psel.add(s.product_id)); P.repintar(); });
on('pv-ap', async (d, b) => { if (!confirmar(b, `${R.psel.size} productos bajan de costo — tocá de nuevo para aplicar`)) return; R.an = null; try { const n = await api.aplicarProvMin([...R.psel]); R.msg = `Listo: ${n} productos pasaron al costo del proveedor más barato.`; R.err = ''; R.psel.clear(); } catch (e) { R.err = e.message; R.msg = ''; } await volver(); });
on('mk-analizar', async () => { R.busy = true; R.err = ''; P.repintar(); try { R.an = await api.analisis(); R.sel.clear(); } catch (e) { R.err = e.message; } R.busy = false; P.repintar(); });
on('mk-sel', (d, el) => { el.checked ? R.sel.add(d.id) : R.sel.delete(d.id); P.repintar(); });
on('mk-todos', () => { (R.an || []).filter(a => a.estado === 'caro' || a.estado === 'barato').forEach(a => R.sel.add(a.product_id)); P.repintar(); });
on('mk-ap', async (d, b) => {
  const el = (R.an || []).filter(a => R.sel.has(a.product_id)), suben = el.filter(a => +a.precio_sugerido > +a.precio_actual).length, bajan = el.filter(a => +a.precio_sugerido < +a.precio_actual).length;
  if (!confirmar(b, `${suben} suben · ${bajan} bajan — tocá de nuevo para aplicar`)) return;
  try { const n = await api.aplicarMargen([...R.sel]); R.msg = `Listo: se ajustó el precio de ${n} productos.`; R.err = ''; R.an = await api.analisis(); R.sel.clear(); } catch (e) { R.err = e.message; R.msg = ''; } await volver(); });
