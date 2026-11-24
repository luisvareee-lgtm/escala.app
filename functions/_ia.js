// v2.36.1 · La IA de Eskalapp, en un solo lugar (la usan la ayuda del panel y las fichas de productos).
// Motor: Gemini si está el secreto GEMINI_API_KEY en Cloudflare (Pages → Settings → Variables and Secrets);
// si no, o si Gemini falla, Workers AI (la conexión "AI" que ya usa la traducción).
// Ninguna llamada queda sin techo: Gemini 12 s, Workers AI 8 s. Si fallan las dos, el error dice qué pasó en cada una.
const MODELO_GEMINI = 'gemini-2.5-flash';
const MODELO_CF = '@cf/meta/llama-3.1-8b-instruct';
const T_GEMINI = 12000, T_CF = 8000;

export const corta = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
export const limpio = s => String(s || '').replace(/AIza[0-9A-Za-z_-]+/g, '[CLAVE]').replace(/\s+/g, ' ').slice(0, 220);
const clave = env => String(env.GEMINI_API_KEY || '').trim();
export const modeloGemini = env => String(env.GEMINI_MODEL || MODELO_GEMINI).trim();
export const hayGemini = env => !!clave(env);
export const hayWorkersAI = env => !!(env.AI && typeof env.AI.run === 'function');
export const hayIA = env => hayGemini(env) || hayWorkersAI(env);
const conLimite = (promesa, ms, quien) => Promise.race([promesa, new Promise((_, rej) => setTimeout(() => rej(new Error(`${quien} no respondió en ${ms / 1000} s`)), ms))]);

// p = { sistema, usuario } · o = { temperatura, tokens }
export async function conGemini(env, p, o = {}) {
  const modelo = modeloGemini(env);
  const cfg = { temperature: o.temperatura ?? 0.2, maxOutputTokens: o.tokens || 500 };
  // los modelos 2.5 "piensan" antes de escribir y ese pensamiento gasta el tope de palabras: acá no hace falta
  if (/2\.5-(flash|flash-lite)/.test(modelo)) cfg.thinkingConfig = { thinkingBudget: 0 };
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': clave(env) },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: p.sistema }] }, contents: [{ role: 'user', parts: [{ text: p.usuario }] }], generationConfig: cfg }),
      signal: AbortSignal.timeout(T_GEMINI),
    });
  } catch (e) { throw new Error(e && e.name === 'TimeoutError' ? `Gemini no respondió en ${T_GEMINI / 1000} s` : `No se pudo conectar con Gemini (${limpio(e && e.message)})`); }
  const raw = await r.text();
  let d; try { d = JSON.parse(raw); } catch (e) { throw new Error(`Gemini ${r.status}: ${limpio(raw)}`); }
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${limpio((d.error && d.error.message) || raw)}`);
  const c = (d.candidates || [])[0] || {};
  const txt = ((c.content || {}).parts || []).map(x => x.text || '').join('').trim();
  if (!txt) throw new Error(`Gemini no devolvió texto (${c.finishReason || (d.promptFeedback && d.promptFeedback.blockReason) || 'sin motivo'})`);
  return txt;
}
export async function conWorkersAI(env, p, o = {}) {
  const r = await conLimite(env.AI.run(MODELO_CF, { messages: [{ role: 'system', content: p.sistema }, { role: 'user', content: p.usuario }], max_tokens: o.tokens || 500, temperature: o.temperatura ?? 0.2 }), T_CF, 'Workers AI');
  const txt = String((r && (r.response || r.result && r.result.response)) || '').trim();
  if (!txt) throw new Error('Workers AI no devolvió texto');
  return txt;
}
// Pide el texto al motor que haya (Gemini primero) y, si Gemini falla, prueba con Workers AI. Devuelve { txt, motor }.
// Si no sale, el error trae .diag = { gemini, cf, modelo, err1, err2 } (sin claves) para saber qué arreglar.
export async function generar(env, p, o = {}) {
  const gemini = hayGemini(env), cf = hayWorkersAI(env), diag = { gemini, cf, modelo: modeloGemini(env), err1: '', err2: '' };
  if (!gemini && !cf) throw Object.assign(new Error('La IA todavía no está activada.'), { sinIA: true, diag });
  try { return gemini ? { txt: await conGemini(env, p, o), motor: 'gemini' } : { txt: await conWorkersAI(env, p, o), motor: 'workers-ai' }; }
  catch (e) {
    diag.err1 = limpio((e && e.message) || e);
    if (gemini && cf) {
      try { return { txt: await conWorkersAI(env, p, o), motor: 'workers-ai' }; }
      catch (e2) { diag.err2 = limpio((e2 && e2.message) || e2); }
    }
    console.error('IA sin respuesta:', JSON.stringify(diag));
    throw Object.assign(new Error('La IA no respondió ahora. Probá de nuevo en un rato.'), { diag });
  }
}
// Para mostrar en el panel qué falló, en una línea.
export const detalle = d => !d ? '' : [d.err1 && (d.gemini ? 'Gemini: ' : 'Workers AI: ') + d.err1, d.err2 && 'Workers AI: ' + d.err2,
  !d.cf && d.gemini && d.err1 ? 'Workers AI: sin conexión "AI" en Cloudflare' : ''].filter(Boolean).join(' · ');
