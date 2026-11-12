// SVG artwork for the laptop OS. The same strings are used in the HTML desktop and
// drawn into the canvas texture on the 3D screen, so both always match.

export const WALLPAPER = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1280 800" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0a1230"/>
    <stop offset="0.42" stop-color="#2b2360"/>
    <stop offset="0.72" stop-color="#8a3d6e"/>
    <stop offset="1" stop-color="#f08a5d"/>
  </linearGradient>
  <linearGradient id="d1" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff9e6b"/><stop offset="1" stop-color="#c2476f"/>
  </linearGradient>
  <linearGradient id="d2" x1="0" y1="0" x2="1" y2="0.6">
    <stop offset="0" stop-color="#6d3ea8"/><stop offset="1" stop-color="#2d2b7a"/>
  </linearGradient>
  <linearGradient id="d3" x1="1" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3b2f8f"/><stop offset="1" stop-color="#141a4a"/>
  </linearGradient>
  <linearGradient id="d4" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#1b2259"/><stop offset="1" stop-color="#090c26"/>
  </linearGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="60"/></filter>
  <filter id="edge"><feGaussianBlur stdDeviation="1.2"/></filter>
</defs>
<rect width="1280" height="800" fill="url(#sky)"/>
<g filter="url(#soft)" opacity="0.85">
  <circle cx="980" cy="430" r="230" fill="#ffb27a"/>
  <circle cx="300" cy="260" r="200" fill="#5b4bd6" opacity="0.6"/>
  <circle cx="700" cy="140" r="160" fill="#2f6bd8" opacity="0.45"/>
</g>
<g filter="url(#edge)">
  <path d="M0 470 C 210 400 380 540 640 470 S 1060 360 1280 430 V800 H0Z" fill="url(#d1)" opacity="0.95"/>
  <path d="M0 540 C 260 470 470 620 760 545 S 1120 470 1280 520 V800 H0Z" fill="url(#d2)"/>
  <path d="M0 620 C 300 560 520 690 840 620 S 1160 580 1280 610 V800 H0Z" fill="url(#d3)"/>
  <path d="M0 700 C 280 660 560 760 900 700 S 1180 680 1280 700 V800 H0Z" fill="url(#d4)"/>
</g>
<g fill="#fff">
  <circle cx="120" cy="80" r="1.2" opacity="0.7"/><circle cx="260" cy="150" r="0.9" opacity="0.5"/>
  <circle cx="420" cy="60" r="1.1" opacity="0.6"/><circle cx="610" cy="110" r="0.8" opacity="0.5"/>
  <circle cx="820" cy="50" r="1.3" opacity="0.7"/><circle cx="1010" cy="130" r="0.9" opacity="0.5"/>
  <circle cx="1180" cy="70" r="1.1" opacity="0.6"/><circle cx="1100" cy="220" r="0.8" opacity="0.4"/>
  <circle cx="190" cy="240" r="0.8" opacity="0.4"/><circle cx="520" cy="200" r="1" opacity="0.5"/>
</g>
</svg>`;

const squircle = (fill: string, inner: string, id: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs>${fill}
  <linearGradient id="${id}-hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.5" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <filter id="${id}-sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.35"/></filter>
</defs>
<g filter="url(#${id}-sh)">
  <rect x="6" y="6" width="88" height="88" rx="21" fill="url(#${id}-bg)"/>
  <rect x="6" y="6" width="88" height="88" rx="21" fill="url(#${id}-hl)"/>
  ${inner}
</g></svg>`;

const grad = (id: string, a: string, b: string) =>
  `<linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

export const ICONS = {
  projects: squircle(
    grad('pj', '#5ac8fa', '#1a7cf0'),
    `<path d="M24 34 a4 4 0 0 1 4-4 h14 l5 5 h25 a4 4 0 0 1 4 4 v29 a4 4 0 0 1-4 4 H28 a4 4 0 0 1-4-4z" fill="#eaf6ff"/>
     <path d="M24 42 h52 v25 a4 4 0 0 1-4 4 H28 a4 4 0 0 1-4-4z" fill="#fff"/>
     <rect x="34" y="50" width="32" height="3" rx="1.5" fill="#1a7cf0" opacity="0.5"/>
     <rect x="34" y="57" width="22" height="3" rx="1.5" fill="#1a7cf0" opacity="0.35"/>`,
    'pj',
  ),
  terminal: squircle(
    grad('tm', '#3a3d42', '#16181b'),
    `<rect x="14" y="16" width="72" height="68" rx="8" fill="#0d0f11" stroke="#555" stroke-width="1"/>
     <path d="M26 38 l12 9 -12 9" fill="none" stroke="#e6e6e6" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
     <rect x="44" y="54" width="18" height="4.5" rx="2" fill="#e6e6e6"/>`,
    'tm',
  ),
  notes: squircle(
    grad('nt', '#fffef7', '#f1ede0'),
    `<rect x="6" y="6" width="88" height="22" rx="21" fill="#f6c443"/><rect x="6" y="17" width="88" height="11" fill="#f6c443"/>
     <g stroke="#d9d3c2" stroke-width="2"><line x1="16" y1="44" x2="84" y2="44"/><line x1="16" y1="56" x2="84" y2="56"/><line x1="16" y1="68" x2="84" y2="68"/><line x1="16" y1="80" x2="70" y2="80"/></g>`,
    'nt',
  ),
  contacts: squircle(
    grad('ct', '#c79a6a', '#8c6239'),
    `<rect x="20" y="16" width="62" height="70" rx="6" fill="#f7efe3"/>
     <rect x="14" y="26" width="8" height="8" rx="2" fill="#5d3f22"/><rect x="14" y="44" width="8" height="8" rx="2" fill="#5d3f22"/><rect x="14" y="62" width="8" height="8" rx="2" fill="#5d3f22"/>
     <circle cx="51" cy="42" r="11" fill="#8c6239"/><path d="M31 74 c2-12 10-17 20-17 s18 5 20 17z" fill="#8c6239"/>`,
    'ct',
  ),
  browser: squircle(
    grad('br', '#ffffff', '#e4e8ee'),
    `<circle cx="50" cy="50" r="33" fill="url(#br-dial)"/>
     <defs><radialGradient id="br-dial"><stop offset="0" stop-color="#4fb3ff"/><stop offset="1" stop-color="#1268d8"/></radialGradient></defs>
     <g stroke="#fff" stroke-width="1" opacity="0.7">${Array.from({ length: 24 }, (_, i) => {
       const a = (i / 24) * Math.PI * 2;
       return `<line x1="${50 + Math.cos(a) * 28}" y1="${50 + Math.sin(a) * 28}" x2="${50 + Math.cos(a) * 32}" y2="${50 + Math.sin(a) * 32}"/>`;
     }).join('')}</g>
     <path d="M50 50 L70 30 L54 54z" fill="#ff3b30"/><path d="M50 50 L30 70 L46 46z" fill="#fff"/>`,
    'br',
  ),
  github: squircle(
    grad('gh', '#2b3137', '#0d1117'),
    `<path fill="#fff" d="M50 22c-15.5 0-28 12.5-28 28 0 12.4 8 22.9 19.1 26.6 1.4.3 1.9-.6 1.9-1.3v-4.9c-7.8 1.7-9.4-3.3-9.4-3.3-1.3-3.2-3.1-4.1-3.1-4.1-2.5-1.7.2-1.7.2-1.7 2.8.2 4.3 2.9 4.3 2.9 2.5 4.3 6.6 3.1 8.2 2.3.3-1.8 1-3.1 1.8-3.8-6.2-.7-12.8-3.1-12.8-13.9 0-3.1 1.1-5.6 2.9-7.5-.3-.7-1.2-3.6.3-7.4 0 0 2.4-.8 7.7 2.9a26.5 26.5 0 0 1 14 0c5.3-3.6 7.7-2.9 7.7-2.9 1.5 3.9.6 6.7.3 7.4 1.8 2 2.9 4.5 2.9 7.5 0 10.8-6.6 13.1-12.8 13.8 1 .9 1.9 2.6 1.9 5.2v7.7c0 .7.5 1.6 1.9 1.3C70 72.9 78 62.4 78 50c0-15.5-12.5-28-28-28z"/>`,
    'gh',
  ),
  trash: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs><linearGradient id="tr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d8dde3" stop-opacity="0.8"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="1" stop-color="#c3c9d1" stop-opacity="0.8"/></linearGradient></defs>
    <path d="M24 22 h52 l-5 66 a5 5 0 0 1-5 4 H34 a5 5 0 0 1-5-4z" fill="url(#tr)" stroke="#9aa3ad" stroke-width="1"/>
    <ellipse cx="50" cy="22" rx="27" ry="5" fill="#eef1f4" stroke="#9aa3ad" stroke-width="1"/>
    <g stroke="#a9b1ba" stroke-width="1.4">${Array.from({ length: 7 }, (_, i) => `<line x1="${33 + i * 5.7}" y1="30" x2="${35 + i * 5}" y2="86"/>`).join('')}</g>
  </svg>`,
};

/** Big Sur style folder; `tint` changes the hue for tagged folders. */
export function folderIcon(tint = '#3d9df3') {
  const id = 'f' + tint.slice(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 52">
  <defs>
    <linearGradient id="${id}a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tint}" stop-opacity="0.75"/><stop offset="1" stop-color="${tint}"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0.05"/></linearGradient>
  </defs>
  <path d="M3 8 a4 4 0 0 1 4-4 h15 l5 5 h30 a4 4 0 0 1 4 4 v31 a4 4 0 0 1-4 4 H7 a4 4 0 0 1-4-4z" fill="${tint}" opacity="0.85"/>
  <path d="M3 15 a3 3 0 0 1 3-3 h52 a3 3 0 0 1 3 3 v29 a4 4 0 0 1-4 4 H7 a4 4 0 0 1-4-4z" fill="url(#${id}a)"/>
  <path d="M3 15 a3 3 0 0 1 3-3 h52 a3 3 0 0 1 3 3 v6 H3z" fill="url(#${id}b)"/>
  <path d="M3.5 13.2 h57" stroke="#fff" stroke-opacity="0.6" stroke-width="0.8"/>
</svg>`;
}

/** Document icon with a folded corner and a coloured stripe. */
export function docIcon(label = 'TXT', color = '#8e8e93') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 64">
  <path d="M6 2 h28 l14 14 v42 a4 4 0 0 1-4 4 H6 a4 4 0 0 1-4-4 V6 a4 4 0 0 1 4-4z" fill="#fdfdfd" stroke="#c7c7cc" stroke-width="1"/>
  <path d="M34 2 v10 a4 4 0 0 0 4 4 h10" fill="#e9e9ee" stroke="#c7c7cc" stroke-width="1"/>
  <g stroke="#d1d1d6" stroke-width="2"><line x1="10" y1="26" x2="42" y2="26"/><line x1="10" y1="32" x2="42" y2="32"/><line x1="10" y1="38" x2="34" y2="38"/></g>
  <rect x="8" y="46" width="36" height="11" rx="2.5" fill="${color}"/>
  <text x="26" y="54.5" font-family="Inter, Segoe UI, sans-serif" font-size="7.5" font-weight="700" fill="#fff" text-anchor="middle">${label}</text>
</svg>`;
}

/** Small monochrome glyphs for the menu bar. */
export const GLYPHS = {
  logo: `<svg viewBox="0 0 20 20" width="15" height="15"><path fill="currentColor" d="M10 1.5 18 6v8l-8 4.5L2 14V6z" opacity="0.95"/><path fill="#000" fill-opacity="0.35" d="M10 10 18 6v8l-8 4.5z"/></svg>`,
  wifi: `<svg viewBox="0 0 20 16" width="17" height="14"><g fill="currentColor"><path d="M10 13.5 12.3 11a3.3 3.3 0 0 0-4.6 0z"/><path d="M10 7.2c2 0 3.8.8 5.1 2l1.5-1.6A9.3 9.3 0 0 0 10 4.9 9.3 9.3 0 0 0 3.4 7.6L4.9 9.2A7.2 7.2 0 0 1 10 7.2z" opacity="0.95"/><path d="M10 2.8c3.2 0 6.1 1.3 8.2 3.3L19.7 4.5A13.4 13.4 0 0 0 10 .6 13.4 13.4 0 0 0 .3 4.5l1.5 1.6A11.3 11.3 0 0 1 10 2.8z" opacity="0.95"/></g></svg>`,
  battery: `<svg viewBox="0 0 28 14" width="25" height="12"><rect x="0.5" y="0.5" width="23" height="13" rx="3.5" fill="none" stroke="currentColor" stroke-opacity="0.55"/><rect x="2.5" y="2.5" width="16" height="9" rx="2" fill="currentColor"/><path d="M25 4.5 a2 2 0 0 1 0 5z" fill="currentColor" fill-opacity="0.55"/></svg>`,
  search: `<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.3 10.3 14.5 14.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  control: `<svg viewBox="0 0 18 16" width="16" height="14"><g fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="1.5" width="16" height="5.5" rx="2.75"/><rect x="1" y="9" width="16" height="5.5" rx="2.75"/></g><circle cx="4" cy="4.25" r="1.8" fill="currentColor"/><circle cx="14" cy="11.75" r="1.8" fill="currentColor"/></svg>`,
  chevL: `<svg viewBox="0 0 10 16" width="9" height="14"><path d="M8 2 2 8l6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  chevR: `<svg viewBox="0 0 10 16" width="9" height="14"><path d="M2 2l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  grid: `<svg viewBox="0 0 16 16" width="15" height="15"><g fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></g></svg>`,
  list: `<svg viewBox="0 0 16 16" width="15" height="15"><g fill="currentColor"><rect x="1" y="2" width="14" height="2" rx="1"/><rect x="1" y="7" width="14" height="2" rx="1"/><rect x="1" y="12" width="14" height="2" rx="1"/></g></svg>`,
  ext: `<svg viewBox="0 0 16 16" width="12" height="12"><path d="M6 3H3v10h10v-3M9 2h5v5M14 2 7 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Loads an SVG string as an <img>, for drawing into a canvas. */
export function svgImage(svg: string, w: number, h: number) {
  const img = new Image(w, h);
  // as a standalone image an SVG needs its namespace
  img.src = svgUrl(svg.includes('xmlns=') ? svg : svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '));
  return img.decode().then(() => img);
}
