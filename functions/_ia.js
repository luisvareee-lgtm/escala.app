// v2.36 · La IA de Eskalapp, en un solo lugar (la usan la ayuda del panel y las fichas de productos).
// Motor: Gemini si está el secreto GEMINI_API_KEY en Cloudflare (Pages → Settings → Variables and Secrets);
// si no, o si Gemini falla, Workers AI (la conexión "AI" que ya usa la traducción).
const MODELO_GEMINI = 'gemini-2.5-flash';
const MODELO_CF = '@cf/meta/llama-3.1-8b-instruct';

export const corta = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
export const hayGemini = env => !!env.GEMINI_API_KEY;
export const hayWorkersAI = env => !!(env.AI && typeof env.AI.run === 'function');
export const hayIA = env => hayGemini(env) || hayWorkersAI(env);

// p = { sistema, usuario } · o = { temperatura, tokens }
export async function conGemini(env, p, o = {}) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || MODELO_GEMINI}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: p.sistema }] }, contents: [{ role: 'user', parts: [{ text: p.usuario }] }],
      generationConfig: { temperature: o.temperatura ?? 0.2, maxOutputTokens: o.tokens || 500 } }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d.error && d.error.message) || `Gemini ${r.status}`);
  return ((((d.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || '').join('').trim();
}
export async function conWorkersAI(env, p, o = {}) {
  const r = await env.AI.run(MODELO_CF, { messages: [{ role: 'system', content: p.sistema }, { role: 'user', content: p.usuario }], max_tokens: o.tokens || 500, temperature: o.temperatura ?? 0.2 });
  return String((r && (r.response || r.result && r.result.response)) || '').trim();
}
// Pide el texto al motor que haya (Gemini primero) y, si Gemini falla, prueba con Workers AI. Devuelve { txt, motor }.
export async function generar(env, p, o = {}) {
  const gemini = hayGemini(env), cf = hayWorkersAI(env);
  if (!gemini && !cf) throw Object.assign(new Error('La IA todavía no está activada.'), { sinIA: true });
  try { return gemini ? { txt: await conGemini(env, p, o), motor: 'gemini' } : { txt: await conWorkersAI(env, p, o), motor: 'workers-ai' }; }
  catch (e) {
    if (gemini && cf) { try { return { txt: await conWorkersAI(env, p, o), motor: 'workers-ai' }; } catch (e2) { } }
    throw new Error('La IA no respondió ahora. Probá de nuevo en un rato.');
  }
}
