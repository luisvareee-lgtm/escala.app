// Traduce al español nombres, categorías y descripciones de productos traídos de webs en portugués, inglés, chino…
// Usa Workers AI de Cloudflare (modelo de traducción m2m100), que se activa en Pages → Settings → Bindings → Workers AI
// con el nombre AI. Tiene una cuota diaria gratuita; si se termina, la app sigue funcionando sin traducir.
import { json, rpc, usuarioDeToken, mismoOrigen } from '../_lib.js';

const IDIOMAS = new Set(['pt', 'en', 'zh', 'fr', 'it', 'de', 'ko', 'ja']);
const MODELO = '@cf/meta/m2m100-1.2b';
const NOMBRES = { pt: 'portuguese', en: 'english', zh: 'chinese', fr: 'french', it: 'italian', de: 'german', ko: 'korean', ja: 'japanese' };
let conNombres = false;          // si el modelo no acepta códigos ("pt"), probamos con nombres ("portuguese")
async function traducirUno(env, text, de) {
  const pedir = n => env.AI.run(MODELO, n ? { text, source_lang: NOMBRES[de], target_lang: 'spanish' } : { text, source_lang: de, target_lang: 'es' });
  if (conNombres) return pedir(true);
  try { return await pedir(false); }
  catch (e) { if (/lang|language|invalid|unsupported/i.test(String(e && e.message))) { conNombres = true; return pedir(true); } throw e; }
}

async function enParalelo(lista, n, fn) {
  const out = new Array(lista.length); let i = 0;
  const trabajar = async () => { while (i < lista.length) { const k = i++; out[k] = await fn(lista[k], k); } };
  await Promise.all(Array.from({ length: Math.min(n, lista.length) }, trabajar));
  return out;
}

export async function onRequestPost({ request, env }) {
  if (!mismoOrigen(request, env)) return json({ error: 'Origen no permitido' }, 403);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Falta configurar el servidor: cargá SUPABASE_URL, SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY en Cloudflare.' }, 503);
  if (!env.AI || typeof env.AI.run !== 'function') return json({ sinIA: true, error: 'La traducción automática no está activada todavía (en Cloudflare falta la conexión "Workers AI" con el nombre AI).' }, 503);
  const uid = await usuarioDeToken(env, request).catch(() => null);
  if (!uid) return json({ error: 'Iniciá sesión de nuevo.' }, 401);
  const b = await request.json().catch(() => ({}));
  const de = String(b.de || '').slice(0, 2).toLowerCase();
  if (!IDIOMAS.has(de)) return json({ error: 'Idioma no soportado.' }, 400);
  const textos = Array.isArray(b.textos) ? b.textos.slice(0, 40).map(t => String(t == null ? '' : t).slice(0, 700)) : [];
  if (!textos.length) return json({ ok: true, textos: [] });
  try { await rpc(env, 'svc_permitir_web', { p_owner: uid, p_tipo: 'traducir', p_host: 'traduccion', p_registrar: false }); }
  catch (e) { return json({ error: e.message || 'No se pudo verificar tu cuenta.' }, 429); }
  let agotado = false;
  const out = await enParalelo(textos, 6, async t => {
    if (!t.trim() || agotado) return '';
    try {
      const r = await traducirUno(env, t, de);
      return String((r && (r.translated_text || r.response)) || '').trim();
    } catch (e) {
      if (/quota|limit|neuron|429|exceeded/i.test(String(e && e.message))) agotado = true;
      return '';
    }
  });
  if (agotado && !out.some(Boolean)) return json({ error: 'Se terminó la traducción gratis de hoy. Mañana se renueva; mientras tanto podés cargar los nombres como vienen.', agotado: true }, 429);
  return json({ ok: true, textos: out, parcial: agotado });
}
