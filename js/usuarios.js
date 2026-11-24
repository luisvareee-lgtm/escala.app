// v2.35 · Tu equipo (plan Mayorista IA, hasta 5 personas): el dueño invita por email a Ventas, Depósito o Administración.
// La persona entra con ese email (o con Google) y la base la une sola al equipo. Lo que cada rol no puede ver
// (costos, ganancia, caja) lo frena la base de datos; acá solo se arma la pantalla.
// También: la lista de productos para Ventas y Depósito (precios de venta y stock, sin costos).
import { api } from './api.js';
import { esc, fmt, on, toast, confirmar, copiar } from './util.js';
import { P, can, bloqueo } from './state.js';
import { MARCA } from './marca.js';

export const ROLES = {
  ventas: ['🛍️', 'Ventas', 'Pedidos, señas y cobros, presupuestos y seguimiento de clientes. Ve los precios de venta, no los costos ni la ganancia.'],
  deposito: ['📦', 'Depósito', 'Prepara y despacha los pedidos, carga el seguimiento y ajusta el stock. No ve costos ni registra cobros.'],
  admin: ['🧾', 'Administración', 'Pedidos y cobros, caja, cobranzas y resultado (con costos y ganancia). No cambia la tienda, los productos ni el plan.'],
};
export const rolNombre = r => (ROLES[r] || ['', r])[1];
// las secciones del panel que ve cada rol
export const TABS_ROL = { ventas: ['pedidos', 'presupuestos', 'productos', 'asistente'], deposito: ['pedidos', 'productos'], admin: ['resumen', 'pedidos', 'caja', 'resultado', 'asistente'] };
export const deRol = k => !P.miembro || (TABS_ROL[P.miembro.rol] || []).includes(k);
// lo que cada rol puede hacer dentro de un pedido (la base igual lo controla)
export const puedeCobrar = () => !P.miembro || P.miembro.rol !== 'deposito';

/* ---------------- el dueño: Ajustes → 👥 Tu equipo ---------------- */
const U = { lista: null, cargando: false, err: '', msg: '' };
export const resetUsuarios = () => Object.assign(U, { lista: null, cargando: false, err: '', msg: '' });
async function cargar() {
  if (U.cargando) return; U.cargando = true;
  try { U.lista = await api.misMiembros() || []; } catch (e) { U.err = e.message; U.lista = []; }
  U.cargando = false; P.repintar();
}
const enlace = () => (MARCA.DOMINIO ? 'https://' + MARCA.DOMINIO : location.origin) + '/#/registro';
export const msgInvitacion = m => `¡Hola${m.nombre ? ' ' + m.nombre : ''}! Te sumé al equipo de ${P.t.nombre} en ${MARCA.NOMBRE || 'Eskalapp'} (rol: ${rolNombre(m.rol)}). Entrá acá: ${enlace()} y creá tu cuenta con este email: ${m.email}. Si es un Gmail, podés tocar “Continuar con Google”.`;
const ESTADO = { invitado: ['warn', '⏳ Invitado: todavía no entró'], activo: ['ok', '✅ Activo'], pausado: ['bad', '⏸️ Pausado'] };

export function usuariosHtml() {
  if (!can('usuarios')) return `<div class="cc" id="usuarios">${bloqueo('👥 Usuarios del equipo', 'Sumá hasta 5 personas con su propio usuario: Ventas, Depósito o Administración. Cada una ve solo lo que le toca.', 'usuarios')}</div>`;
  if (U.lista == null && !U.cargando) setTimeout(cargar, 0);
  const L = U.lista || [];
  return `<div class="cc" id="usuarios"><h3>👥 Tu equipo</h3>
    <p class="hint">Hasta 5 personas, cada una con su usuario. Los costos, la ganancia y la caja los ven solo vos y Administración: lo frena la base de datos, no solo la pantalla.</p>
    ${U.err ? `<div class="err-box">${esc(U.err)}</div>` : ''}${U.msg ? `<div class="ok-box">${esc(U.msg)}</div>` : ''}
    ${U.lista == null ? '<p class="hint"><span class="spin"></span> Cargando…</p>' : (L.map(fila).join('') || '<p class="muted" style="margin:8px 0">Todavía no sumaste a nadie.</p>')}
    ${U.lista != null && L.length < 5 ? `<form data-submit="us-invitar" class="us-form"><div class="row2">
      <div class="fg"><label class="flabel" for="us-email">Email</label><input class="fi" id="us-email" name="email" type="email" maxlength="160" autocomplete="off" required placeholder="nombre@gmail.com"></div>
      <div class="fg"><label class="flabel" for="us-nom">Nombre (opcional)</label><input class="fi" id="us-nom" name="nombre" maxlength="60" placeholder="Ej: Vero"></div></div>
      <div class="fg"><label class="flabel" for="us-rol">Rol</label><select class="fi" id="us-rol" name="rol">${Object.entries(ROLES).map(([k, [i, n]]) => `<option value="${k}">${i} ${n}</option>`).join('')}</select></div>
      <button class="btn btn-p btn-sm" type="submit">Sumar al equipo</button></form>` : U.lista != null ? '<p class="hint">Llegaste a 5 personas (el máximo).</p>' : ''}
    <details class="us-roles"><summary>Qué ve y qué hace cada rol</summary>${Object.values(ROLES).map(([i, n, d]) => `<p><b>${i} ${n}:</b> ${d}</p>`).join('')}</details></div>`;
}
function fila(m) {
  const [c, e] = ESTADO[m.estado] || ['', m.estado];
  return `<div class="us-fila" data-id="${m.id}"><div class="us-quien"><b>${esc(m.nombre || m.email)}</b>${m.nombre ? `<small class="muted">${esc(m.email)}</small>` : ''}<span class="tag ${c}">${e}</span></div>
    <div class="us-acc"><select class="fi" data-change="us-rol" data-id="${m.id}" aria-label="Rol de ${esc(m.nombre || m.email)}">${Object.entries(ROLES).map(([k, [i, n]]) => `<option value="${k}" ${m.rol === k ? 'selected' : ''}>${i} ${n}</option>`).join('')}</select>
    ${m.estado === 'invitado' ? `<button class="btn btn-s btn-sm" data-act="us-copiar" data-id="${m.id}">📋 Copiar invitación</button>` : `<button class="btn btn-s btn-sm" data-act="us-pausa" data-id="${m.id}">${m.estado === 'pausado' ? '▶️ Reactivar' : '⏸️ Pausar'}</button>`}
    <button class="btn btn-s btn-sm" style="color:var(--red)" data-act="us-quitar" data-id="${m.id}">Quitar</button></div></div>`;
}
const buscar = id => (U.lista || []).find(x => x.id === id);
on('us-invitar', async (d, f) => {
  const fd = new FormData(f), email = String(fd.get('email') || '').trim().toLowerCase(), nombre = String(fd.get('nombre') || '').trim(), rol = String(fd.get('rol') || 'ventas');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { U.err = 'Revisá el email.'; U.msg = ''; return P.repintar(); }
  try {
    const m = await api.invitarMiembro(P.t.id, email, nombre, rol);
    U.lista = (U.lista || []).concat(m ? [m] : []); U.err = '';
    U.msg = `Listo: ${nombre || email} quedó invitado como ${rolNombre(rol)}. Copiá la invitación y mandásela por WhatsApp.`;
    if (m) copiar(msgInvitacion(m));
  } catch (e) { U.err = e.message; U.msg = ''; }
  P.repintar();
});
on('us-copiar', d => { const m = buscar(d.id); if (m) { copiar(msgInvitacion(m)); toast('Invitación copiada'); } });
on('us-rol', async (d, el) => {
  try { const r = await api.editarMiembro(d.id, { rol: el.value }); const m = buscar(d.id); if (m) Object.assign(m, r || { rol: el.value }); U.err = ''; toast('Rol cambiado a ' + rolNombre(el.value)); }
  catch (e) { U.err = e.message; } P.repintar();
});
on('us-pausa', async d => {
  const m = buscar(d.id); if (!m) return; const v = m.estado === 'pausado' ? 'activo' : 'pausado';
  try { const r = await api.editarMiembro(d.id, { estado: v }); Object.assign(m, r || { estado: v }); U.err = ''; toast(v === 'pausado' ? 'Pausado: no puede entrar' : 'Reactivado'); }
  catch (e) { U.err = e.message; } P.repintar();
});
on('us-quitar', async (d, b) => {
  const m = buscar(d.id); if (!m || !confirmar(b, `¿Quitar a ${m.nombre || m.email}? Tocá de nuevo`)) return;
  try { await api.quitarMiembro(d.id); U.lista = U.lista.filter(x => x.id !== d.id); U.err = ''; U.msg = ''; toast('Quitado del equipo'); }
  catch (e) { U.err = e.message; } P.repintar();
});

/* ---------------- Ventas y Depósito: los productos (precios de venta y stock, sin costos) ---------------- */
const C = { q: '' };
const normal = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function catalogoEquipo() {
  const dep = P.miembro && P.miembro.rol === 'deposito', q = normal(C.q).trim(), may = P.t.modalidad !== 'minorista';
  const L = (P.prods || []).filter(p => !q || normal(p.nombre + ' ' + (p.categoria || '') + ' ' + (p.sku || '') + ' ' + (p.marca || '')).includes(q));
  return `<div class="cc eqc"><h3>📦 Productos</h3><p class="hint">${dep ? 'Precios de venta y stock. Para corregir el stock, poné el número y tocá ✓.' : 'Precios de venta y stock. Los costos los ve solo el dueño.'}</p>
    <input class="fi" id="eqc-q" placeholder="Buscar por nombre, categoría o código…" data-input="eqc-q" value="${esc(C.q)}" aria-label="Buscar producto" style="margin-bottom:10px">
    <div class="card">${L.slice(0, 300).map(p => `<div class="srow eqc-row"><span class="eqc-n">${p.imagen_url ? `<img src="${esc(p.imagen_url)}" alt="" loading="lazy">` : `<i aria-hidden="true">${esc(p.emoji || '📦')}</i>`}<span><b>${esc(p.nombre)}</b><small class="muted">${esc(p.categoria || '')}${p.sku ? ' · ' + esc(p.sku) : ''}${p.activo === false ? ' · no se ve en la tienda' : ''}</small></span></span>
      <span class="v">${p.precio_1 != null ? fmt(p.precio_1) : '—'}${may && p.precio_12 != null && +p.precio_12 !== +p.precio_1 ? `<small class="muted">x12 ${fmt(p.precio_12)}</small>` : ''}</span>
      ${dep ? `<form class="eqc-st" data-submit="eqc-stock" data-id="${p.id}"><input class="fi" name="stock" type="number" min="0" max="1000000" inputmode="numeric" value="${p.stock == null ? '' : p.stock}" placeholder="—" aria-label="Stock de ${esc(p.nombre)}"><button class="btn btn-s btn-sm" type="submit" aria-label="Guardar stock de ${esc(p.nombre)}">✓</button></form>`
        : `<span class="tag ${p.stock === 0 ? 'bad' : ''}">${p.stock == null ? 'sin control' : p.stock === 0 ? 'agotado' : 'stock ' + p.stock}</span>`}</div>`).join('') || '<p class="muted">No hay productos para mostrar.</p>'}</div>
    ${L.length > 300 ? `<p class="hint">Se muestran 300 de ${L.length}: usá el buscador.</p>` : ''}</div>`;
}
on('eqc-q', (d, el) => { C.q = el.value; P.repintar(); });
on('eqc-stock', async (d, f) => {
  const v = parseInt(String(new FormData(f).get('stock') || ''), 10);
  if (!(v >= 0)) return toast('Poné un número de stock (0 o más).');
  try { const n = await api.equipoStock(d.id, v); const p = (P.prods || []).find(x => x.id === d.id); if (p) p.stock = n; toast('Stock guardado: ' + n); P.repintar(); }
  catch (e) { toast(e.message); }
});

// La persona del equipo que no puede entrar (pausada o la tienda sin Mayorista IA)
export const sinAccesoHtml = m => `<div class="page"><div class="card" style="margin-top:40px;text-align:center"><h2>👥 ${esc(m.tienda || 'Tu equipo')}</h2>
  <p style="margin:10px 0">${m.pausado ? 'Tu usuario está pausado por el dueño de la tienda. Cuando te lo reactive, vas a poder entrar.' : 'Esta tienda no tiene activos los usuarios del equipo en este momento. Avisale al dueño.'}</p>
  <button class="btn btn-s" data-act="p-salir">Salir</button></div></div>`;
