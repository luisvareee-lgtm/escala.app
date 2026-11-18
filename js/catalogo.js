// Catálogo en PDF: se arma en el navegador y se guarda con "Imprimir → Guardar como PDF" (sirve en PC y celular).
import { esc, fmt, on, $ } from './util.js';
import { P, can, precioArs } from './state.js';

export function htmlCatalogo({ nombre, logo, color, eslogan, titulo, nota, grupos, conStock, conSku = true }) {
  return `<div class="catp" style="--pc:${esc(color || '#1d4ba8')}"><div style="display:flex;gap:12px;align-items:center">${logo ? `<img src="${esc(logo)}" alt="" style="height:44px;border-radius:6px">` : ''}<div><h1>${esc(nombre)}</h1><div style="color:#555;font-size:12px">${esc(eslogan || '')}</div></div><div style="margin-left:auto;text-align:right;font-size:12px"><b>${esc(titulo)}</b><br>${new Date().toLocaleDateString('es-AR')}</div></div>
  ${grupos.map(g => `<h2>${esc(g.cat)}</h2><table><tr>${conSku ? '<th style="width:70px">Código</th>' : ''}<th>Producto</th>${conStock ? '<th>Stock</th>' : ''}<th class="r" style="width:90px">Precio</th></tr>${g.filas.map(f => `<tr>${conSku ? `<td>${esc(f.sku || '')}</td>` : ''}<td>${esc(f.nombre)}${f.variantes && f.variantes.length ? ' <span style="color:#777">(' + esc(f.variantes.join(', ')) + ')</span>' : ''}</td>${conStock ? `<td>${esc(f.stock)}</td>` : ''}<td class="r"><b>${fmt(f.precio)}</b></td></tr>`).join('')}</table>`).join('')}
  <p style="margin-top:14px;font-size:10px;color:#666">${esc(nota || 'Precios sujetos a cambio sin previo aviso.')}</p></div>`;
}
// v2.30 · Presupuesto en PDF (lo usan el panel y el enlace que ve tu cliente). v: lo que devuelve ver_presupuesto.
const fechaAr = d => d ? new Date(String(d).length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-AR') : '';
export function htmlPresupuesto(v) {
  const t = v.tienda || {}, it = v.items || [];
  return `<div class="catp" style="--pc:${esc(t.color || '#1d4ba8')}"><div style="display:flex;gap:12px;align-items:center">${t.logo_url ? `<img src="${esc(t.logo_url)}" alt="" style="height:44px;border-radius:6px">` : ''}<div><h1>${esc(t.nombre || '')}</h1>${t.whatsapp ? `<div style="color:#555;font-size:12px">WhatsApp: ${esc(t.whatsapp)}</div>` : ''}</div><div style="margin-left:auto;text-align:right;font-size:12px"><b>Presupuesto N° ${esc(v.numero)}</b><br>${esc(fechaAr(v.fecha) || new Date().toLocaleDateString('es-AR'))}${v.vence ? `<br>Válido hasta el ${esc(fechaAr(v.vence))}` : ''}</div></div>
  <p style="margin:14px 0 4px;font-size:13px">Para: <b>${esc(v.cliente || '')}</b></p>
  <table><tr><th>Producto</th><th class="r" style="width:60px">Cant.</th><th class="r" style="width:90px">Precio</th><th class="r" style="width:100px">Subtotal</th></tr>${it.map(x => `<tr><td>${esc(x.nombre)}${x.variante ? ` <span style="color:#777">(${esc(x.variante)})</span>` : ''}</td><td class="r">${esc(x.cantidad)}</td><td class="r">${fmt(x.precio_unitario)}</td><td class="r">${fmt(x.subtotal)}</td></tr>`).join('')}
  ${Number(v.envio_costo) > 0 ? `<tr><td colspan="3">Envío${v.envio_nombre ? ' · ' + esc(v.envio_nombre) : ''}</td><td class="r">${fmt(v.envio_costo)}</td></tr>` : ''}
  <tr><td colspan="3" style="text-align:right"><b>Total</b></td><td class="r"><b>${fmt(v.total)}</b></td></tr></table>
  ${v.nota ? `<p style="margin-top:12px;font-size:12px;white-space:pre-line">${esc(v.nota)}</p>` : ''}
  <p style="margin-top:14px;font-size:10px;color:#666">Precios en pesos argentinos${v.vence ? `, válidos hasta el ${esc(fechaAr(v.vence))}` : ''}. Sujeto a disponibilidad de stock.</p></div>`;
}
export function imprimir(html) {
  let a = $('#print-area'); if (!a) { a = document.createElement('div'); a.id = 'print-area'; document.body.appendChild(a); }
  a.innerHTML = html; a.style.display = 'block';
  const fin = () => { a.style.display = 'none'; window.removeEventListener('afterprint', fin); };
  window.addEventListener('afterprint', fin);
  try { window.print(); } catch (e) { fin(); }
}
const C = { escala: 1, stock: false, agotados: false };
export function vistaCatalogo() {
  const may = P.t.modalidad !== 'minorista';
  return `<div class="modal-bg" data-act="p-cerrar-bg"><div class="modal" role="dialog" aria-modal="true"><div class="view-title">📄 Catálogo en PDF</div>
  <p class="hint" style="margin-bottom:10px">Se genera con tus precios actuales. Después elegí <b>Guardar como PDF</b> en la ventana de impresión y mandalo por WhatsApp.</p>
  <div class="fg"><label class="flabel">Lista de precios</label><select class="fi" data-change="c-esc"><option value="0" ${C.escala === 0 ? 'selected' : ''}>Precio al público (minorista)</option>${may ? [1, 3, 6, 12].map(n => `<option value="${n}" ${C.escala === n ? 'selected' : ''}>Mayorista · ${n === 12 ? '12 o más unidades' : n === 1 ? '1 unidad' : 'desde ' + n + ' unidades'}</option>`).join('') : ''}</select></div>
  <div class="fg"><label class="flabel"><input type="checkbox" data-change="c-stock" ${C.stock ? 'checked' : ''}> Mostrar stock</label></div>
  <div class="fg"><label class="flabel"><input type="checkbox" data-change="c-ago" ${C.agotados ? 'checked' : ''}> Incluir productos agotados</label></div>
  <button class="btn btn-p" data-act="c-gen">Generar PDF</button><button class="btn btn-s" style="margin-top:8px" data-act="p-cerrar">Cancelar</button></div></div>`;
}
on('c-esc', (d, el) => { C.escala = +el.value; });
on('c-stock', (d, el) => { C.stock = el.checked; });
on('c-ago', (d, el) => { C.agotados = el.checked; });
on('c-gen', () => {
  const t = P.t, cot = Number(t.cotizacion_usd), g = new Map();
  P.prods.filter(p => p.activo && (C.agotados || p.stock == null || p.stock > 0)).forEach(p => {
    const m = C.escala === 0 ? (p.margen_override != null ? Number(p.margen_override) : Number(t.margen_1)) : Number(t['margen_' + C.escala]);
    const l = g.get(p.categoria) || []; l.push({ sku: p.sku, nombre: p.nombre, variantes: p.variantes, stock: p.stock == null ? '—' : p.stock, precio: precioArs(p.costo_usd, cot, m) }); g.set(p.categoria, l);
  });
  const grupos = [...g.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cat, filas]) => ({ cat, filas: filas.sort((a, b) => a.nombre.localeCompare(b.nombre)) }));
  const titulo = C.escala === 0 ? 'Lista de precios' : 'Lista mayorista · ' + (C.escala === 12 ? '12+ u.' : 'desde ' + C.escala + ' u.');
  P.modal = null; P.repintar();
  imprimir(htmlCatalogo({ nombre: t.nombre, logo: t.logo_url, color: t.color, eslogan: t.eslogan, titulo, grupos, conStock: C.stock, nota: 'Precios en pesos argentinos, sujetos a cambio sin previo aviso.' }));
});
