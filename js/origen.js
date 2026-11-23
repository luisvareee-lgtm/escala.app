// v2.33 · De dónde llegó una visita a la tienda (para las estadísticas del panel). No guarda nada de la persona.
// Orden: el parámetro utm_source (o ?o=) que pone quien comparte el enlace; después la página de la que viene,
// la app que abrió el enlace (Android la informa como android-app://…) o el navegador propio de Instagram, Facebook o TikTok.
export const ORIGENES = ['instagram', 'whatsapp', 'facebook', 'google', 'tiktok', 'otro', 'directo'];
export const ORIGEN_NOMBRE = { instagram: 'Instagram', whatsapp: 'WhatsApp', facebook: 'Facebook', google: 'Google', tiktok: 'TikTok', otro: 'Otros sitios', directo: 'Directo (enlace pegado o guardado)' };

const porUtm = u => /^(ig|insta)/.test(u) ? 'instagram' : /^(wa|wsp|whats|zap)/.test(u) ? 'whatsapp' : /^(fb|face|meta|messenger)/.test(u) ? 'facebook'
  : /google|^(gads|adwords|youtube|yt)/.test(u) ? 'google' : /^(tiktok|tt)/.test(u) ? 'tiktok' : 'otro';

export function origenDe(url, referrer, ua, hostPropio) {
  let qs; try { qs = new URL(url).searchParams; } catch (e) { qs = new URLSearchParams(); }
  const utm = String(qs.get('utm_source') || qs.get('o') || '').trim().toLowerCase();
  if (utm) return porUtm(utm);
  const r = String(referrer || '').toLowerCase(), a = String(ua || '');
  const app = r.startsWith('android-app://');   // Android: la app que abrió el enlace (com.whatsapp, com.instagram.android…)
  let h = ''; if (!app) try { h = r ? new URL(r).hostname.replace(/^www\./, '') : ''; } catch (e) { h = ''; }
  if (h && hostPropio && h === String(hostPropio).toLowerCase().replace(/^www\./, '')) h = '';   // vino de la misma tienda: no dice nada
  if (/(^|\.)instagram\.com$/.test(h) || r.includes('com.instagram') || /Instagram/.test(a)) return 'instagram';
  if (/(^|\.)whatsapp\.(com|net)$|^wa\.me$/.test(h) || r.includes('com.whatsapp') || /WhatsApp/.test(a)) return 'whatsapp';
  if (/(^|\.)(facebook\.com|messenger\.com)$|^fb\.(com|me)$/.test(h) || r.includes('com.facebook') || /FBAN|FBAV|FB_IAB/.test(a) || qs.has('fbclid')) return 'facebook';
  if (/(^|\.)google\.[a-z.]+$/.test(h) || r.includes('com.google.android.googlequicksearchbox') || qs.has('gclid') || qs.has('gbraid') || qs.has('wbraid')) return 'google';
  if (/(^|\.)tiktok\.com$/.test(h) || /musically|tiktok/.test(r) || /BytedanceWebview|musical_ly|TikTok/i.test(a) || qs.has('ttclid')) return 'tiktok';
  return h || app ? 'otro' : 'directo';
}
