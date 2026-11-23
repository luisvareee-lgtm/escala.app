// Ilustraciones de producto para la portada (v2.23): dibujos livianos en SVG que reemplazan la foto
// en los ejemplos (no hay fotos de terceros ni archivos para descargar). Se elige el dibujo por el nombre.
const PAL = [
  ['#FDE7EF', '#F9C9DA', '#E64980', '#FFF5F8'],   // rosa
  ['#E7F0FF', '#C9DAFF', '#3B5BDB', '#F3F7FF'],   // azul
  ['#FFF1DB', '#FFD9A8', '#E8590C', '#FFF8EE'],   // naranja
  ['#E6FCF5', '#B2F2DB', '#0CA678', '#F3FFFA'],   // verde
  ['#F3F0FF', '#D9CCFF', '#7048E8', '#FAF8FF'],   // violeta
  ['#FFF9DB', '#FFEC99', '#E67700', '#FFFDF0'],   // dorado
];
const tipo = n => {
  n = String(n || '').toLowerCase();
  if (/s[eé]rum|gotero|vitamina c|[aá]cido|hialur/.test(n)) return 'serum';
  if (/perfum|edp|edt|eau de|fragan|colonia|club de nuit|khamrah|yara|asad|ombre|212|polo/.test(n)) return 'perfume';
  if (/brocha|pincel|esponja/.test(n)) return 'brochas';
  if (/labial|gloss|lip|delineador|m[aá]scara de pesta/.test(n)) return 'labial';
  if (/zapatilla|botin|bot[ií]n|calzado|sneaker|ojota|sandalia|zapato/.test(n)) return 'zapatilla';
  if (/remera|camis|buzo|campera|jean|pantal|vestido|top|short|ropa|musculosa|calza/.test(n)) return 'remera';
  if (/splash|body|crema|loci[oó]n|shampoo|acondicion|gel|jab[oó]n|aceite|t[oó]nico|protector/.test(n)) return 'botella';
  if (/mate|termo|taza|vaso|botella t[eé]rmica/.test(n)) return 'termo';
  return 'bolsa';
};
const DIB = {
  perfume: (c, l) => `<rect x="50" y="22" width="20" height="12" rx="3" fill="${c}"/><rect x="54" y="33" width="12" height="8" fill="${c}" opacity=".7"/>
    <rect x="32" y="40" width="56" height="58" rx="12" fill="${l}" stroke="${c}" stroke-width="3"/><rect x="39" y="50" width="42" height="40" rx="7" fill="${c}" opacity=".22"/>
    <rect x="44" y="62" width="32" height="14" rx="3" fill="#fff" opacity=".9"/><rect x="40" y="47" width="6" height="40" rx="3" fill="#fff" opacity=".7"/>`,
  serum: (c, l) => `<ellipse cx="60" cy="24" rx="9" ry="7" fill="${c}"/><rect x="53" y="28" width="14" height="14" rx="2" fill="${c}" opacity=".75"/>
    <rect x="38" y="42" width="44" height="58" rx="10" fill="${l}" stroke="${c}" stroke-width="3"/><rect x="38" y="66" width="44" height="34" rx="0" fill="${c}" opacity=".28"/>
    <rect x="45" y="56" width="30" height="12" rx="3" fill="#fff" opacity=".9"/><rect x="43" y="48" width="5" height="44" rx="2.5" fill="#fff" opacity=".7"/>`,
  botella: (c, l) => `<rect x="55" y="14" width="10" height="8" rx="2" fill="${c}"/><path d="M50 22h28v6H50z" fill="${c}"/><rect x="56" y="28" width="8" height="8" fill="${c}" opacity=".7"/>
    <rect x="40" y="36" width="40" height="66" rx="14" fill="${l}" stroke="${c}" stroke-width="3"/><rect x="46" y="54" width="28" height="26" rx="4" fill="${c}" opacity=".25"/>
    <rect x="49" y="60" width="22" height="7" rx="2" fill="#fff" opacity=".9"/><rect x="45" y="42" width="5" height="52" rx="2.5" fill="#fff" opacity=".7"/>`,
  brochas: (c, l) => [[-20, 0.85], [0, 1], [20, 0.85]].map(([r, o]) => `<g transform="rotate(${r} 60 104)" opacity="${o}"><rect x="56" y="62" width="8" height="42" rx="4" fill="${c}"/><rect x="54" y="52" width="12" height="12" rx="2" fill="#ADB5BD"/><path d="M54 53c-4-10-2-26 6-32 8 6 10 22 6 32z" fill="#343A40"/><path d="M57 50c-2-8-1-18 3-22" stroke="#fff" stroke-width="2" opacity=".35" fill="none"/></g>`).join(''),
  labial: (c, l) => `<rect x="44" y="64" width="32" height="38" rx="5" fill="${c}"/><rect x="48" y="50" width="24" height="16" rx="3" fill="${l}" stroke="${c}" stroke-width="3"/>
    <path d="M51 50V32l18-10v28z" fill="${c}" opacity=".8"/><rect x="50" y="70" width="5" height="26" rx="2.5" fill="#fff" opacity=".5"/>`,
  zapatilla: (c, l) => `<path d="M18 86c0-14 6-30 14-34l14 6 8-10c10 10 22 18 40 22 8 2 10 8 10 16z" fill="${l}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M16 86h90v8a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4z" fill="${c}"/><path d="M52 58l10 8M58 52l10 8M64 48l9 8" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
    <path d="M30 74c10-2 20 0 30 4" stroke="${c}" stroke-width="3" opacity=".4" fill="none" stroke-linecap="round"/>`,
  remera: (c, l) => `<path d="M42 22l-24 12 8 18 10-4v52h48V48l10 4 8-18-24-12c-2 8-8 12-18 12s-16-4-18-12z" fill="${l}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M44 23c2 7 8 10 16 10s14-3 16-10" stroke="${c}" stroke-width="3" fill="none"/><rect x="52" y="56" width="16" height="16" rx="3" fill="${c}" opacity=".35"/>`,
  termo: (c, l) => `<rect x="46" y="16" width="28" height="12" rx="4" fill="${c}"/><rect x="42" y="28" width="36" height="74" rx="10" fill="${l}" stroke="${c}" stroke-width="3"/>
    <rect x="42" y="52" width="36" height="22" fill="${c}" opacity=".3"/><rect x="47" y="34" width="5" height="62" rx="2.5" fill="#fff" opacity=".7"/>`,
  bolsa: (c, l) => `<path d="M46 40v-6a14 14 0 0 1 28 0v6" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M30 40h60l-4 60a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4z" fill="${l}" stroke="${c}" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="48" cy="52" r="3" fill="${c}"/><circle cx="72" cy="52" r="3" fill="${c}"/><path d="M50 74h20" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity=".5"/>`,
};
let uid = 0;
// SVG cuadrado con fondo de color suave; decorativo (aria-hidden), el nombre ya está en la tarjeta
export function ilus(nombre, i = 0) {
  const t = tipo(nombre), [b1, b2, c, l] = PAL[Math.abs(i) % PAL.length], id = 'ig' + (++uid);
  return `<svg class="ilus" viewBox="0 0 120 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient></defs>
    <rect width="120" height="120" fill="url(#${id})"/><ellipse cx="60" cy="106" rx="34" ry="5" fill="${c}" opacity=".12"/>${DIB[t](c, l)}</svg>`;
}
export const tipoIlus = tipo;
