// "⏳ Cierre de pedidos": fecha y hora hasta la que se toman pedidos (opcional), con cuenta regresiva en la tienda.
// Al vencer, el comercio elige: pausar los pedidos, o seguir tomándolos para la próxima tanda. La regla la aplica el servidor.
import { api } from './api.js';
import { esc, on, toast } from './util.js';
import { P } from './state.js';
import { tiraCierreHtml, faltaCorto, programar } from './cuenta.js';

const d2 = n => String(n).padStart(2, '0');
// fecha local para <input type="datetime-local">
const aLocal = iso => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${d2(d.getMonth() + 1)}-${d2(d.getDate())}T${d2(d.getHours())}:${d2(d.getMinutes())}`; };
const lindo = iso => new Date(iso).toLocaleString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export function cierreCard() {
  const t = P.t, modo = t.modo_stock || 'stock', on_ = !!t.cierre_at, cerro = on_ && new Date(t.cierre_at) <= new Date();
  const intro = modo === 'stock' ? 'Sirve para preventas o si juntás pedidos antes de comprar: tus clientes ven una cuenta regresiva en la tienda.'
    : 'Ideal si le comprás al proveedor por tandas: tus clientes ven cuánto falta para que cierres el pedido y se apuran a entrar.';
  const estado = !on_ ? '<span class="tag">Apagado</span>' : cerro ? '<span class="tag bad">La ronda cerró</span>' : `<span class="tag ok">Cierra en <span data-cd-corto="${new Date(t.cierre_at).getTime()}">${faltaCorto(new Date(t.cierre_at) - Date.now())}</span></span>`;
  if (on_ && !cerro) programar();   // el "Cierra en …" también corre
  const cuerpo = `<p class="hint" style="margin-bottom:8px">${intro}</p>
    ${on_ ? `<p class="ci-estado" id="ci-estado">${cerro ? `La ronda cerró el <b>${esc(lindo(t.cierre_at))}</b>. ${t.cierre_modo === 'pausar' ? 'La tienda <b>no toma pedidos</b> hasta que abras otra ronda o quites el cierre.' : 'La tienda sigue tomando pedidos y los marca como <b>próxima tanda</b>.'}` : `Tomás pedidos hasta el <b>${esc(lindo(t.cierre_at))}</b>.`}</p>
    <div class="ci-prev" style="--ac:${/^#[0-9a-fA-F]{6}$/.test(t.color || '') ? t.color : '#1d4ba8'}"><span class="flabel">Así lo ven tus clientes</span>${tiraCierreHtml({ at: new Date(t.cierre_at).getTime(), estado: !cerro ? 'abierto' : t.cierre_modo === 'pausar' ? 'pausa' : 'tanda', texto: t.cierre_texto })}</div>` : ''}
    <form data-submit="ci-guardar" id="ci-form">
      <div class="fg"><label class="flabel" for="ci-at">Tomar pedidos hasta</label><input class="fi" id="ci-at" name="cierre_at" type="datetime-local" value="${aLocal(cerro ? '' : t.cierre_at)}" required></div>
      <div class="fg"><span class="flabel">Cuando se cumpla la hora</span>
        <label class="chk"><input type="radio" name="cierre_modo" value="avisar" ${t.cierre_modo !== 'pausar' ? 'checked' : ''}> <span><b>Seguir tomando pedidos</b> y avisar que entran en la próxima tanda</span></label>
        <label class="chk"><input type="radio" name="cierre_modo" value="pausar" ${t.cierre_modo === 'pausar' ? 'checked' : ''}> <span><b>Pausar los pedidos</b> hasta que abra otra ronda</span></label></div>
      <div class="fg"><label class="flabel" for="ci-tx">Mensaje al cerrar <small class="muted">(opcional)</small></label><input class="fi" id="ci-tx" name="cierre_texto" maxlength="140" value="${esc(t.cierre_texto || '')}" placeholder="Ej: Abrimos de nuevo el lunes a las 10."></div>
      <div id="ci-m"></div>
      <div class="lv-acc"><button class="btn btn-p btn-sm" type="submit" id="ci-go">${on_ && !cerro ? 'Guardar cambios' : cerro ? 'Abrir nueva ronda' : 'Activar cuenta regresiva'}</button>${cerro ? '<button class="btn btn-s btn-sm" type="button" data-act="ci-mas7">Misma hora, en 7 días</button>' : ''}${on_ ? '<button class="btn btn-s btn-sm" type="button" data-act="ci-quitar">Quitar el cierre</button>' : ''}</div>
    </form>`;
  // con stock es una herramienta ocasional: va plegada para no distraer
  return modo === 'stock' && !on_ ? `<details class="cc" id="ci-card"><summary><b>⏳ Cierre de pedidos con cuenta regresiva</b> ${estado}</summary><div style="margin-top:10px">${cuerpo}</div></details>`
    : `<div class="cc" id="ci-card"><h3>⏳ Cierre de pedidos con cuenta regresiva ${estado}</h3>${cuerpo}</div>`;
}
const err = t => { const m = document.getElementById('ci-m'); if (m) m.innerHTML = `<div class="err-box">${esc(t)}</div>`; };
async function guardar(c, msg) { try { P.t = await api.guardarTienda(P.t.id, c) || P.t; toast(msg); P.repintar(); } catch (e) { err(e.message); } }
on('ci-guardar', async (d, f) => {
  const fd = new FormData(f), at = new Date(String(fd.get('cierre_at') || ''));
  if (isNaN(at)) return err('Elegí el día y la hora de cierre.');
  if (at <= new Date()) return err('Elegí un día y una hora que todavía no hayan pasado.');
  await guardar({ cierre_at: at.toISOString(), cierre_modo: fd.get('cierre_modo') === 'pausar' ? 'pausar' : 'avisar', cierre_texto: String(fd.get('cierre_texto') || '').trim().slice(0, 140) || null }, 'Cuenta regresiva activada');
});
on('ci-mas7', async () => { let at = new Date(P.t.cierre_at); while (at <= new Date()) at = new Date(at.getTime() + 7 * 864e5); await guardar({ cierre_at: at.toISOString() }, 'Nueva ronda abierta'); });
on('ci-quitar', async () => { await guardar({ cierre_at: null }, 'Cierre quitado'); });

// cuando la vista previa llega a cero, el panel pasa solo a "La ronda cerró"
document.addEventListener('cuenta-fin', e => { if (e.target.closest('#ci-card')) P.repintar(); });
