// Gráficos SVG sin librerías (tema claro/oscuro por variables CSS). Cada punto lleva data-tip para el tooltip.
import { esc } from './util.js';
const nice = m => { if (m <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(m))); const f = m / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
export function linea(pts, o = {}) {   // pts: [{x:'12/10', v:123, tip:'...'}]
  const W = 520, H = o.h || 170, L = 8, R = 8, T = 10, B = 22, n = pts.length;
  const max = nice(Math.max(...pts.map(p => p.v), 1)), X = i => L + (n < 2 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)), Y = v => T + (H - T - B) * (1 - v / max);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  const area = n ? path + ` L${X(n - 1).toFixed(1)} ${H - B} L${X(0).toFixed(1)} ${H - B} Z` : '';
  const grid = [0, .5, 1].map(f => `<line x1="${L}" x2="${W - R}" y1="${Y(max * f)}" y2="${Y(max * f)}" stroke="var(--bd)" stroke-dasharray="3 3"/><text x="${L}" y="${Y(max * f) - 2}">${esc((o.fmt || String)(Math.round(max * f)))}</text>`).join('');
  const paso = Math.max(1, Math.ceil(n / 6));
  const lab = pts.map((p, i) => i % paso === 0 ? `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${esc(p.x)}</text>` : '').join('');
  const dots = pts.map((p, i) => `<circle class="pt" tabindex="0" cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${n > 45 ? 2 : 3.5}" fill="var(--ac)" data-tip="${esc(p.tip)}"/>`).join('');
  return `<svg class="chart ln" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Gráfico de línea')}">${grid}<path d="${area}" fill="var(--ac)" opacity=".12"/><path d="${path}" fill="none" stroke="var(--ac)" stroke-width="2.2" stroke-linejoin="round"/>${dots}${lab}</svg>`;
}
export function barras(items, fmt) {  // items: [{label, v, tip}]
  const max = Math.max(...items.map(i => i.v), 1);
  return items.length ? items.map(i => `<div class="hbar" data-tip="${esc(i.tip || i.label)}"><span class="n" title="${esc(i.label)}">${esc(i.label)}</span><span class="tr"><i style="width:${Math.max(2, Math.round(i.v / max * 100))}%"></i></span><b>${esc(fmt(i.v))}</b></div>`).join('') : '<p class="muted">Sin datos en este período.</p>';
}
export function dona(items, fmt, sel, clic = true) {  // items: [{label, v}]
  const tot = items.reduce((a, i) => a + i.v, 0); if (!tot) return '<p class="muted">Sin datos en este período.</p>';
  const R = 52, r = 32, cx = 70, cy = 70; let a0 = -Math.PI / 2;
  const seg = items.map((it, i) => {
    const a1 = a0 + it.v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, f = a => [cx + R * Math.cos(a), cy + R * Math.sin(a)], g = a => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const full = it.v === tot, p1 = f(a0), p2 = f(full ? a0 + 3.14 : a1), p3 = g(full ? a0 + 3.14 : a1), p4 = g(a0);
    const d = full ? `M${cx - R} ${cy}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0M${cx - r} ${cy}a${r} ${r} 0 1 1 ${2 * r} 0a${r} ${r} 0 1 1 ${-2 * r} 0` : `M${p1} A${R} ${R} 0 ${big} 1 ${p2} L${p3} A${r} ${r} 0 ${big} 0 ${p4} Z`;
    a0 = a1;
    return `<path class="seg-d" tabindex="0" d="${d}" fill="var(--c${i % 6 + 1})" fill-rule="evenodd" opacity="${sel && sel !== it.label ? .35 : 1}"${clic ? ` data-act="d-cat" data-c="${esc(it.label)}"` : ''} data-tip="${esc(it.label + ': ' + fmt(it.v) + ' (' + Math.round(it.v / tot * 100) + '%)')}"/>`;
  }).join('');
  const tx = fmt(tot), fs = tx.length > 10 ? 8.5 : tx.length > 8 ? 10 : 11;   // el total entra siempre en el centro
  return `<div class="dona-wrap"><svg class="chart" viewBox="0 0 140 140" role="img" aria-label="Gráfico de torta: total ${esc(tx)}">${seg}<text x="70" y="68" text-anchor="middle" style="font-size:7px;fill:var(--t3)">Total</text><text x="70" y="80" text-anchor="middle" style="font-size:${fs}px;font-weight:800;fill:var(--t1)">${esc(tx)}</text></svg>
  <div class="leg v">${items.map((it, i) => `<span${clic ? ` data-act="d-cat" data-c="${esc(it.label)}" role="button" tabindex="0"` : ''} style="opacity:${sel && sel !== it.label ? .45 : 1}"><i style="background:var(--c${i % 6 + 1})"></i>${esc(it.label)}<strong class="lv"><b>${esc(fmt(it.v))}</b><em>${Math.round(it.v / tot * 100)}%</em></strong></span>`).join('')}</div></div>`;
}
