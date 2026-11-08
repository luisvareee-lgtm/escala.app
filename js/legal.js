// Términos y condiciones y política de privacidad (borrador base: hacelo revisar por un abogado antes de cobrar).
import { esc } from './util.js';
import { MARCA } from './marca.js';

const contacto = () => MARCA.EMAIL_CONTACTO ? `el email ${esc(MARCA.EMAIL_CONTACTO)}` : (MARCA.SOPORTE_WSP ? `el WhatsApp de soporte (+${esc(MARCA.SOPORTE_WSP)})` : 'los canales de contacto publicados en el sitio');
const pag = (titulo, cuerpo) => `<div class="page legal"><p><a href="#/">← Inicio</a></p><h1>${titulo}</h1><p class="hint">Última actualización: ${esc(MARCA.FECHA_LEGALES)}</p>${cuerpo}<p style="margin-top:24px"><a href="#/">← Volver al inicio</a></p></div>`;

export function terminos(app) {
  const N = esc(MARCA.NOMBRE);
  app.innerHTML = pag('Términos y condiciones', `
  <h2>1. Quiénes somos</h2><p>${N} es un servicio de ${esc(MARCA.TITULAR)} (CUIT ${esc(MARCA.CUIT)}) que permite a comerciantes crear una tienda online, publicar productos y recibir pedidos. Al crear una cuenta aceptás estos términos.</p>
  <h2>2. Tu cuenta</h2><p>Sos responsable de los datos que cargás, de mantener segura tu contraseña y de lo que se haga con tu cuenta. Tenés que ser mayor de 18 años y tener capacidad para contratar.</p>
  <h2>3. Tu tienda y tus ventas</h2><p>Vos sos el vendedor: definís productos, precios, stock, envíos y medios de pago, y sos responsable frente a tus clientes por las ventas, la facturación, los impuestos, las garantías y el cumplimiento de la Ley de Defensa del Consumidor. ${N} no es parte de las operaciones entre vos y tus clientes ni cobra por ellas.</p>
  <h2>4. Contenido permitido</h2><p>No podés publicar productos ilegales, falsificados o que infrinjan derechos de terceros (marcas, imágenes o textos ajenos sin autorización), ni usar el servicio para engañar o dañar a otras personas. Podemos suspender una tienda que lo haga.</p>
  <h2>5. Planes, prueba y pagos</h2><p>Los planes y precios vigentes se publican en el sitio. La prueba gratuita dura 7 días. Los abonos se pagan por adelantado y no se reintegran por períodos parciales. Podemos ajustar los precios avisándote con al menos 30 días de anticipación.</p>
  <h2>6. Pagos online</h2><p>Si conectás Mercado Pago, los cobros van directo a tu cuenta y se rigen por los términos de Mercado Pago. ${N} no retiene ni administra tu dinero.</p>
  <h2>7. Disponibilidad</h2><p>Trabajamos para que el servicio funcione siempre, pero puede haber interrupciones por mantenimiento o fallas de proveedores. No respondemos por ganancias perdidas por esas interrupciones, salvo lo que disponga la ley.</p>
  <h2>8. Baja</h2><p>Podés dar de baja tu cuenta cuando quieras. Podés pedirnos una copia de tus productos y pedidos antes de la baja.</p>
  <h2>9. Cambios</h2><p>Si cambiamos estos términos, te avisamos en el panel. Si seguís usando el servicio, aceptás los nuevos términos.</p>
  <h2>10. Ley aplicable</h2><p>Se aplican las leyes de la República Argentina. Cualquier conflicto se resuelve ante los tribunales de ${esc(MARCA.JURISDICCION)}.</p>
  <h2>Contacto</h2><p>Escribinos a ${contacto()}.</p>`);
}

export function privacidad(app) {
  const N = esc(MARCA.NOMBRE);
  app.innerHTML = pag('Política de privacidad', `
  <p>En ${N} cuidamos los datos personales según la Ley 25.326 de Protección de los Datos Personales.</p>
  <h2>1. Responsable</h2><p>${esc(MARCA.TITULAR)} (CUIT ${esc(MARCA.CUIT)}). Contacto: ${contacto()}.</p>
  <h2>2. Qué datos tratamos</h2><p><b>De los comerciantes:</b> email, datos del negocio, WhatsApp, alias de cobro y la información de su tienda.<br><b>De los compradores de cada tienda:</b> nombre, WhatsApp y, si el comercio los pide, localidad, provincia, código postal, dirección de entrega, DNI/CUIT y aclaraciones del pedido.</p>
  <h2>3. Para qué los usamos</h2><p>Para prestar el servicio: mostrar la tienda, registrar pedidos, avisar al comercio y permitirle gestionar sus ventas. No vendemos ni cedemos datos a terceros para publicidad.</p>
  <h2>4. Quién es responsable de los datos de los compradores</h2><p>Cada comercio es responsable de los datos de sus clientes y de usarlos solo para gestionar sus pedidos. ${N} los guarda por cuenta del comercio y cada tienda solo puede ver los suyos.</p>
  <h2>5. Dónde se guardan</h2><p>En servicios de infraestructura en la nube con medidas de seguridad estándar (acceso restringido por tienda, conexiones cifradas y claves de pago guardadas protegidas). Los servidores pueden estar fuera de la Argentina.</p>
  <h2>6. Cookies y almacenamiento</h2><p>Usamos el almacenamiento del navegador para mantener tu sesión y el carrito. Si el comercio configura el Meta Pixel, su tienda puede enviar eventos de visita y compra a Meta.</p>
  <h2>7. Tus derechos</h2><p>Podés pedir acceso, corrección o eliminación de tus datos escribiendo a ${contacto()}. Si compraste en una tienda, también podés pedírselo directamente al comercio. La Agencia de Acceso a la Información Pública, órgano de control de la Ley 25.326, atiende las denuncias por incumplimiento de las normas de datos personales.</p>
  <h2>8. Conservación</h2><p>Guardamos los datos mientras la cuenta esté activa y el tiempo que exija la ley. Después de una baja, los eliminamos o anonimizamos.</p>`);
}
