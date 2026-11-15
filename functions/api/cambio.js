// Cotizaciones de referencia para el importador:
//  · tasas: unidades por 1 dólar (BRL, PYG, CNY, EUR…) para pasar a dólares precios en reales, guaraníes, yuanes…
//    Fuente: ExchangeRate-API (open.er-api.com, gratuita, se actualiza una vez por día).
//  · ars: dólar oficial, blue y cripto (USDT) en pesos argentinos, valor de venta. Fuente: DolarApi (dolarapi.com).
//    Son solo sugerencias: cada comercio usa su propia cotización (Ajustes) o la que le cobra su proveedor.
import { json } from '../_lib.js';

const MONEDAS = ['BRL', 'PYG', 'CNY', 'EUR', 'UYU', 'CLP', 'BOB', 'PEN', 'COP', 'MXN', 'GBP', 'JPY', 'KRW'];
let memoria = null;

async function leerJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(8000), cf: { cacheTtl: 1800, cacheEverything: true } });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export async function onRequestGet() {
  if (memoria && memoria.hasta > Date.now()) return json(memoria.datos);
  const [mundo, arg] = await Promise.allSettled([leerJson('https://open.er-api.com/v6/latest/USD'), leerJson('https://dolarapi.com/v1/dolares')]);
  const datos = { ok: false, base: 'USD', tasas: {}, ars: {}, fecha: '', fuente: [] };
  if (mundo.status === 'fulfilled' && mundo.value && mundo.value.result === 'success' && mundo.value.rates) {
    MONEDAS.forEach(m => { const v = Number(mundo.value.rates[m]); if (v > 0) datos.tasas[m] = v; });
    datos.fecha = mundo.value.time_last_update_utc || ''; datos.fuente.push('ExchangeRate-API'); datos.ok = true;
  }
  if (arg.status === 'fulfilled' && Array.isArray(arg.value)) {
    for (const d of arg.value) {
      const k = String(d.casa || '').toLowerCase(), v = Number(d.venta);
      if (['oficial', 'blue', 'cripto', 'mayorista', 'tarjeta', 'bolsa'].includes(k) && v > 0) datos.ars[k] = { venta: v, fecha: d.fechaActualizacion || '' };
    }
    if (Object.keys(datos.ars).length) { datos.fuente.push('DolarApi'); datos.ok = true; }
  }
  if (!datos.ok) {
    if (memoria) return json(memoria.datos);
    return json({ ...datos, error: 'No pudimos traer las cotizaciones de referencia. Cargá el valor a mano.' }, 503);
  }
  memoria = { datos, hasta: Date.now() + 30 * 60 * 1000 };
  return json(datos);
}
