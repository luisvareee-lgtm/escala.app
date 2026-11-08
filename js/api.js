// Toda la comunicación con Supabase pasa por acá.
import { CONFIG } from './config.js';

export const sb = (window.__SB_TEST__) ? window.__SB_TEST__
  : window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

const amable = m => {
  m = String(m || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisá tu internet e intentá de nuevo.';
  if (/Invalid login credentials/i.test(m)) return 'Email o contraseña incorrectos.';
  if (/User already registered/i.test(m)) return 'Ese email ya tiene una cuenta. Iniciá sesión.';
  if (/Email not confirmed/i.test(m)) return 'Falta confirmar tu email. Revisá tu casilla (y spam).';
  if (/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 8 caracteres.';
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Esperá unos minutos.';
  if (/margenes_ordenados/.test(m)) return 'Los márgenes deben ir de mayor a menor: x1 ≥ x3 ≥ x6 ≥ x12.';
  if (/tenants_envios_chk/.test(m)) return 'Revisá los métodos de envío: cada uno necesita nombre (2 a 60 letras) y un costo válido.';
  if (/tenants_diseno_chk/.test(m)) return 'Revisá el diseño: algún texto es muy largo o la imagen no es un enlace https://.';
  if (/orders_nota_chk|orders_seg_chk/.test(m)) return 'La nota admite hasta 500 caracteres y el seguimiento hasta 120.';
  if (/violates check constraint/.test(m)) return 'Algún dato no es válido. Revisá los valores e intentá de nuevo.';
  return m;
};
const sinError = d => { if (d && d.error) throw new Error(d.error); return d; };
const ok = ({ data, error }) => { if (error) throw new Error(amable(error.message)); return data; };

// PostgREST devuelve como máximo 1000 filas por consulta: se pide por páginas para que "productos ilimitados" sea cierto.
async function todo(armar) {
  const PAG = 1000; let desde = 0; const out = [];
  for (;;) {
    const lote = ok(await armar().range(desde, desde + PAG - 1));
    out.push(...lote);
    if (lote.length < PAG) return out;
    desde += PAG;
  }
}

// Llama a una Pages Function del propio sitio (/api/...). Las que actúan por el comerciante llevan su sesión.
async function llamarFn(ruta, cuerpo, conSesion) {
  const h = { 'content-type': 'application/json' };
  if (conSesion) { const ses = (await sb.auth.getSession()).data.session; if (!ses || !ses.access_token) throw new Error('Iniciá sesión de nuevo.'); h.authorization = 'Bearer ' + ses.access_token; }
  let r; try { r = await fetch(ruta, { method: 'POST', headers: h, body: JSON.stringify(cuerpo) }); } catch (e) { throw new Error(amable('Failed to fetch')); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Error del servidor (' + r.status + ')');
  return d;
}

export const api = {
  // ---- público (comprador)
  tienda: async slug => ok(await sb.from('v_tiendas_publicas').select('*').eq('slug', slug).maybeSingle()),
  productos: slug => todo(() => sb.from('v_productos_publicos').select('*').eq('tienda', slug).order('categoria').order('nombre').order('id')),
  listaMayorista: async (slug, codigo) => {
    const filas = ok(await sb.rpc('catalogo_mayorista', { p_slug: slug, p_codigo: codigo || null })) || [];
    if (filas.length === 1 && !filas[0].producto_id) throw new Error('Código de revendedor incorrecto.');   // el servidor marca el error sin excepción
    return filas;
  },
  crearPedido: async (slug, cliente, items, modo, codigo, medio, ref) =>
    sinError(ok(await sb.rpc('crear_pedido', { p_slug: slug, p_cliente: cliente, p_items: items, p_modo: modo, p_codigo: codigo || null, p_medio: medio, p_ref: ref || null }))),
  guardarCarrito: async (slug, nombre, whatsapp, items, total) =>
    ok(await sb.rpc('guardar_carrito', { p_slug: slug, p_nombre: nombre, p_whatsapp: whatsapp, p_items: items, p_total: total })),

  // ---- cuenta
  onAuth: cb => sb.auth.onAuthStateChange((ev) => cb(ev)),
  session: async () => (await sb.auth.getSession()).data.session,
  registrar: async (email, password) => ok(await sb.auth.signUp({ email, password })),
  entrar: async (email, password) => ok(await sb.auth.signInWithPassword({ email, password })),
  salir: async () => { await sb.auth.signOut(); },
  olvide: async email => ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname + '#/login' })),
  nuevaClave: async password => ok(await sb.auth.updateUser({ password })),

  // ---- comerciante (RLS: solo ve lo suyo)
  miTienda: async () => ok(await sb.from('tenants').select('*').maybeSingle()),
  crearTienda: async d => ok(await sb.rpc('crear_tienda', { p_slug: d.slug, p_nombre: d.nombre, p_rubro: d.rubro, p_whatsapp: d.whatsapp, p_modalidad: d.modalidad, p_plan: d.plan })),
  guardarTienda: async (id, cambios) => ok(await sb.from('tenants').update(cambios).eq('id', id).select().maybeSingle()),
  setCodigo: async c => ok(await sb.rpc('set_codigo_revendedor', { p_codigo: c || null })),
  misProductos: () => todo(() => sb.from('products').select('*').order('created_at', { ascending: false }).order('id')),
  guardarProducto: async (id, d) => id
    ? ok(await sb.from('products').update(d).eq('id', id).select().maybeSingle())
    : ok(await sb.from('products').insert(d).select().maybeSingle()),
  insertarProductos: async filas => { for (let i = 0; i < filas.length; i += 500) ok(await sb.from('products').insert(filas.slice(i, i + 500))); },
  borrarProducto: async id => ok(await sb.from('products').delete().eq('id', id)),
  misPedidos: async () => ok(await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(300)),
  itemsPedido: async id => ok(await sb.from('order_items').select('*').eq('order_id', id)),
  estadoPedido: async (id, estado) => ok(await sb.from('orders').update({ estado }).eq('id', id).select().maybeSingle()),
  actualizarPedido: async (id, cambios) => ok(await sb.from('orders').update(cambios).eq('id', id).select().maybeSingle()),
  misGastos: () => todo(() => sb.from('gastos').select('*').order('fecha', { ascending: false }).order('id')),
  guardarGasto: async (id, d) => id ? ok(await sb.from('gastos').update(d).eq('id', id).select().maybeSingle()) : ok(await sb.from('gastos').insert(d).select().maybeSingle()),
  borrarGasto: async id => ok(await sb.from('gastos').delete().eq('id', id)),
  misCarritos: async () => ok(await sb.from('carritos_pendientes').select('*').order('updated_at', { ascending: false })),
  marcarCarrito: async id => ok(await sb.from('carritos_pendientes').update({ recontactado: true }).eq('id', id)),
  borrarCarrito: async id => ok(await sb.from('carritos_pendientes').delete().eq('id', id)),
  ajustarCostos: async (pct, cat) => ok(await sb.rpc('ajustar_costos', { p_pct: pct, p_categoria: cat || null })),
  pedidosTodos: () => todo(() => sb.from('orders').select('*').order('created_at', { ascending: false }).order('id')),
  itemsTodos: () => todo(() => sb.from('order_items').select('*').order('id', { ascending: false })),
  misRevendedores: async () => ok(await sb.from('sub_revendedores').select('*').order('created_at', { ascending: false }).order('id')),
  guardarRevendedor: async (id, d) => id ? ok(await sb.from('sub_revendedores').update(d).eq('id', id).select().maybeSingle()) : ok(await sb.from('sub_revendedores').insert(d).select().maybeSingle()),
  borrarRevendedor: async id => ok(await sb.from('sub_revendedores').delete().eq('id', id)),
  liquidar: async (id, v) => ok(await sb.from('orders').update({ comision_liquidada: v }).eq('id', id).select().maybeSingle()),
  misProveedores: () => todo(() => sb.from('product_suppliers').select('*').order('updated_at', { ascending: false }).order('id')),
  cargarOferta: async (prov, items) => ok(await sb.rpc('cargar_oferta_proveedor', { p_proveedor: prov, p_items: items })),
  aplicarProvMin: async ids => ok(await sb.rpc('aplicar_proveedor_minimo', { p_ids: ids })),
  cargarRefs: async (comp, items) => ok(await sb.rpc('cargar_refs_competencia', { p_competidor: comp, p_items: items })),
  analisis: async () => ok(await sb.rpc('analisis_precios')),
  aplicarMargen: async ids => ok(await sb.rpc('aplicar_margen_sugerido', { p_ids: ids })),
  async subirFoto(tenantId, blob, nombre) {
    const ruta = tenantId + '/' + nombre + '.webp';
    const r = await sb.storage.from('fotos').upload(ruta, blob, { contentType: blob.type || 'image/webp', upsert: true });
    if (r.error) throw new Error(amable(r.error.message));
    return sb.storage.from('fotos').getPublicUrl(ruta).data.publicUrl + '?v=' + Date.now();
  },
  eventos: async () => ok(await sb.from('tenant_events').select('*').order('created_at', { ascending: false }).limit(10)),

  // integraciones (plan Full API): Mercado Pago, webhook
  estadoIntegraciones: async () => ok(await sb.rpc('estado_integraciones')),
  guardarIntegraciones: async (token, quitar, nuevoSecreto) => ok(await sb.rpc('guardar_integraciones', { p_mp_token: token || null, p_quitar_mp: !!quitar, p_nuevo_secreto: !!nuevoSecreto })),
  probarWebhook: () => llamarFn('/api/webhook-test', {}, true),
  mpPreferencia: (slug, pedido) => llamarFn('/api/mp-preferencia', { slug, pedido }, false),

  // pedidos en vivo (si Realtime está activo en el proyecto; si falla, el panel igual funciona)
  escucharPedidos(tenantId, cb) {
    try {
      const ch = sb.channel('pedidos-' + tenantId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: 'tenant_id=eq.' + tenantId }, cb)
        .subscribe();
      return () => { try { sb.removeChannel(ch); } catch (e) { } };
    } catch (e) { return () => { }; }
  }
};
