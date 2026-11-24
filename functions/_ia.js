// v2.36.2 · La IA de Eskalapp, en un solo lugar (la usan la ayuda del panel y las fichas de productos).
// Motor: Gemini si está el secreto GEMINI_API_KEY en Cloudflare (Pages → Settings → Variables and Secrets);
// si no, o si Gemini falla, Workers AI (la conexión "AI" que ya usa la traducción).
// Ninguna llamada queda sin techo: Gemini 12 s, Workers AI 8 s. Si fallan las dos, el error dice qué pasó en cada una.
// v2.36.2 · Google retiró gemini-2.5-flash para cuentas nuevas y Cloudflare retiró llama-3.1-8b (5028).
// Se prueba en orden y, si un modelo ya no existe (404/410/5028), se pasa al siguiente.
// GEMINI_MODEL / CF_MODEL en Cloudflare, si los cargás, van primero.
const MODELOS_GEMINI = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const MODELOS_CF = ['@cf/google/gemma-4-26b-a4b-it', '@cf/meta/llama-3.3-70b-instruct-fp8-fast'];
const T_GEMINI = 12000, T_CF = 8000;

export const corta = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
export const limpio = s => String(s || '').replace(/AIza[0-9A-Za-z_-]+/g, '[CLAVE]').replace(/\s+/g, ' ').slice(0, 220);
const clave = env => String(env.GEMINI_API_KEY || '').trim();
const lista = (v, def) => [...new Set([String(v || '').trim(), ...def].filter(Boolean))];
export const modeloGemini = env => lista(env.GEMINI_MODEL, MODELOS_GEMINI)[0];
const noExiste = m => /\b(404|410|5028)\b|not found|no longer available|deprecated|is not supported for generateContent/i.test(m);
export const hayGemini = env => !!clave(env);
export const hayWorkersAI = env => !!(env.AI && typeof env.AI.run === 'function');
export const hayIA = env => hayGemini(env) || hayWorkersAI(env);
const conLimite = (promesa, ms, quien) => Promise.race([promesa, new Promise((_, rej) => setTimeout(() => rej(new Error(`${quien} no respondió en ${ms / 1000} s`)), ms))]);

// p = { sistema, usuario } · o = { temperatura, tokens }
async function unGemini(env, modelo, p, o, simple) {
  const viejo = /^gemini-(1|2)\./.test(modelo);
  const cfg = { maxOutputTokens: viejo ? (o.tokens || 500) : Math.max(2048, (o.tokens || 500) * 4) };
  if (viejo) { cfg.temperature = o.temperatura ?? 0.2; if (/2\.5-flash/.test(modelo)) cfg.thinkingConfig = { thinkingBudget: 0 }; }
  else if (!simple && !/lite/.test(modelo)) cfg.thinkingConfig = { thinkingLevel: 'low' };   // Gemini 3: sin temperatura; pensar poco = responde rápido
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': clave(env) },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: p.sistema }] }, contents: [{ role: 'user', parts: [{ text: p.usuario }] }], generationConfig: cfg }),
      signal: AbortSignal.timeout(T_GEMINI),
    });
  } catch (e) { throw new Error(e && e.name === 'TimeoutError' ? `${modelo} no respondió en ${T_GEMINI / 1000} s` : `No se pudo conectar con Gemini (${limpio(e && e.message)})`); }
  const raw = await r.text();
  let d; try { d = JSON.parse(raw); } catch (e) { throw new Error(`Gemini ${r.status}: ${limpio(raw)}`); }
  if (!r.ok) throw Object.assign(new Error(`Gemini ${r.status} (${modelo}): ${limpio((d.error && d.error.message) || raw)}`), { status: r.status });
  const c = (d.candidates || [])[0] || {};
  const txt = ((c.content || {}).parts || []).filter(x => !x.thought).map(x => x.text || '').join('').trim();
  if (!txt) throw new Error(`Gemini no devolvió texto (${c.finishReason || (d.promptFeedback && d.promptFeedback.blockReason) || 'sin motivo'})`);
  return txt;
}
export async function conGemini(env, p, o = {}) {
  let ult;
  for (const m of lista(env.GEMINI_MODEL, MODELOS_GEMINI)) {
    try { return await unGemini(env, m, p, o); }
    catch (e) {
      ult = e;
      if (e.status === 400 && /thinking|temperature|generation_?config|Unknown name/i.test(e.message)) { try { return await unGemini(env, m, p, o, true); } catch (e2) { ult = e2; } }
      if (!noExiste(ult.message)) throw ult;   // clave mala, cuota, etc.: no tiene sentido probar otro modelo
    }
  }
  throw ult;
}
export async function conWorkersAI(env, p, o = {}) {
  let ult;
  for (const m of lista(env.CF_MODEL, MODELOS_CF)) {
    try {
      const r = await conLimite(env.AI.run(m, { messages: [{ role: 'system', content: p.sistema }, { role: 'user', content: p.usuario }], max_tokens: o.tokens || 500, max_completion_tokens: o.tokens || 500, temperature: o.temperatura ?? 0.2 }), T_CF, 'Workers AI');
      const ch = r && r.choices && r.choices[0];
      const txt = String((r && (r.response || (r.result && r.result.response))) || (ch && ((ch.message && ch.message.content) || ch.text)) || '').trim();
      if (!txt) throw new Error(`Workers AI (${m}) no devolvió texto`);
      return txt;
    } catch (e) { ult = e; if (!noExiste(String(e && e.message))) throw e; }
  }
  throw ult;
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
