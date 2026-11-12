import * as THREE from 'three';
import { profile, projects, TAGS, type Project } from './data';
import { GLYPHS, ICONS, WALLPAPER, docIcon, folderIcon, svgImage } from './os/assets';

const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif';
const SERIF = '"Source Serif 4", Georgia, "Times New Roman", serif';
const MONO = '"JetBrains Mono", Consolas, monospace';

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!] as const;
}

function toTexture(c: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 99) {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      if (lines === maxLines - 1) {
        ctx.fillText(line + '…', x, y);
        return y + lh;
      }
      ctx.fillText(line, x, y);
      line = words[i];
      y += lh;
      lines++;
    } else line = test;
  }
  ctx.fillText(line, x, y);
  return y + lh;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Subtle paper grain so printouts don't look like flat vector art. */
function paperGrain(ctx: CanvasRenderingContext2D, w: number, h: number, base: string, amount = 10) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------------------------------------------------------------- laptop screen */

// The canvas mirrors the HTML desktop (1280×800 logical) at 1.25× resolution.
const SW = 1280, SH = 800, SS = 1.25;

/**
 * The laptop desktop as seen from the desk: same wallpaper, menu bar, desktop icons and dock
 * as the interactive OS, so zooming in and swapping to HTML is seamless.
 * Artwork is SVG, so it is drawn once the images decode; the texture updates itself.
 */
export function createScreenTexture(renderer: THREE.WebGLRenderer) {
  const [c, ctx] = makeCanvas(SW * SS, SH * SS);
  ctx.scale(SS, SS);
  ctx.fillStyle = '#1a1440';
  ctx.fillRect(0, 0, SW, SH);
  const tex = toTexture(c, renderer);

  const featured = projects.filter((p) => p.onDesk);
  const deskItems = [
    { svg: folderIcon(), label: 'Projects' },
    ...featured.map((p) => ({ svg: folderIcon(TAGS[p.tags[0]] ?? '#3d9df3'), label: p.title })),
    { svg: docIcon('TXT', '#8e8e93'), label: 'About me.txt' },
    { svg: docIcon('VCF', '#a2845e'), label: 'Contact.vcf' },
  ];
  const dockSvgs = [ICONS.projects, ICONS.notes, ICONS.contacts, ICONS.terminal, ICONS.github, ICONS.trash];

  Promise.all([
    svgImage(WALLPAPER, SW * SS, SH * SS),
    ...deskItems.map((d) => svgImage(d.svg, 128, 104)),
    ...dockSvgs.map((d) => svgImage(d, 128, 128)),
    svgImage(GLYPHS.wifi.replace('currentColor', '#fff').replaceAll('currentColor', '#fff'), 34, 28),
    svgImage(GLYPHS.battery.replaceAll('currentColor', '#fff'), 50, 24),
  ])
    .then(([wall, ...rest]) => {
      const deskImgs = rest.slice(0, deskItems.length);
      const dockImgs = rest.slice(deskItems.length, deskItems.length + dockSvgs.length);
      const [wifi, batt] = rest.slice(deskItems.length + dockSvgs.length);

      ctx.drawImage(wall, 0, 0, SW, SH);

      // menu bar
      ctx.fillStyle = 'rgba(30,24,60,0.42)';
      ctx.fillRect(0, 0, SW, 26);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText('◆', 16, 13);
      ctx.fillText('Projects', 38, 13);
      ctx.font = `400 13px ${FONT}`;
      let x = 112;
      for (const m of ['File', 'Edit', 'View', 'Go', 'Window', 'Help']) {
        ctx.fillText(m, x, 13);
        x += ctx.measureText(m).width + 20;
      }
      const d = new Date();
      const clock = `${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')}  ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      ctx.textAlign = 'right';
      ctx.fillText(clock, SW - 92, 13);
      ctx.textAlign = 'left';
      ctx.drawImage(batt, SW - 330, 7, 25, 12);
      ctx.fillText('87%', SW - 300, 13);
      ctx.drawImage(wifi, SW - 262, 6, 17, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      roundRect(ctx, SW - 84, 4, 74, 18, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `600 13px ${FONT}`;
      ctx.fillText('⏏  Desk', SW - 74, 13);

      // desktop icons, right column
      ctx.textAlign = 'center';
      ctx.font = `500 12px ${FONT}`;
      deskImgs.forEach((im, i) => {
        const cx = SW - 14 - 46, y = 40 + i * 92;
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 3;
        ctx.drawImage(im, cx - 32, y + 4, 64, 52);
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = '#fff';
        ctx.fillText(deskItems[i].label, cx, y + 72);
      });
      ctx.shadowColor = 'transparent';
      ctx.textAlign = 'left';

      // dock
      const n = dockImgs.length, size = 52, gap = 4, pad = 7, sep = 11;
      const dw = n * size + (n - 1) * gap + pad * 2 + sep;
      const dx = (SW - dw) / 2, dy = SH - 6 - 66;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      roundRect(ctx, dx, dy, dw, 66, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
      let ix = dx + pad;
      dockImgs.forEach((im, i) => {
        if (i === n - 1) {
          ctx.fillStyle = 'rgba(255,255,255,0.35)';
          ctx.fillRect(ix + 3, dy + 9, 1, 48);
          ix += sep;
        }
        ctx.drawImage(im, ix, dy + 7, size, size);
        ix += size + gap;
      });

      tex.needsUpdate = true;
    })
    .catch(() => {
      /* keep the plain background if an image fails to decode */
    });

  return tex;
}

/* ---------------------------------------------------------------- printouts */

export const PAPER_W = 1240;
export const PAPER_H = 1754; // A4 ratio

/** A printed project one-pager. */
export function createPaperTexture(p: Project, renderer: THREE.WebGLRenderer) {
  const [c, ctx] = makeCanvas(PAPER_W, PAPER_H);
  paperGrain(ctx, PAPER_W, PAPER_H, '#f7f5ef', 8);
  const m = 110;
  // header band
  ctx.fillStyle = p.accent;
  ctx.fillRect(m, m, 16, 150);
  ctx.fillStyle = '#1a1a1a';
  ctx.font = `700 92px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(p.title, m + 50, m + 90);
  ctx.fillStyle = '#666';
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(`${p.kind}  ·  ${p.year}`, m + 50, m + 145);

  ctx.fillStyle = '#222';
  ctx.font = `italic 44px ${SERIF}`;
  let y = wrapText(ctx, p.tagline, m, m + 280, PAPER_W - 2 * m, 60, 3);

  // stats
  if (p.stats) {
    y += 40;
    const colW = (PAPER_W - 2 * m) / p.stats.length;
    p.stats.forEach((s, i) => {
      ctx.fillStyle = p.accent;
      ctx.font = `800 96px ${FONT}`;
      ctx.fillText(s.value, m + i * colW, y + 80);
      ctx.fillStyle = '#555';
      ctx.font = `500 30px ${FONT}`;
      ctx.fillText(s.label, m + i * colW, y + 130);
    });
    y += 200;
  }

  ctx.strokeStyle = '#d8d4c8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(m, y);
  ctx.lineTo(PAPER_W - m, y);
  ctx.stroke();
  y += 80;

  ctx.fillStyle = '#333';
  ctx.font = `400 34px ${SERIF}`;
  y = wrapText(ctx, p.description[0], m, y, PAPER_W - 2 * m, 50, 6) + 30;

  ctx.font = `400 32px ${FONT}`;
  for (const h of p.highlights.slice(0, 4)) {
    if (y > PAPER_H - 330) break;
    ctx.fillStyle = p.accent;
    ctx.fillText('■', m, y);
    ctx.fillStyle = '#333';
    y = wrapText(ctx, h, m + 50, y, PAPER_W - 2 * m - 50, 46, 2) + 16;
  }

  // stack chips at the bottom
  let x = m;
  const cy = PAPER_H - 200;
  ctx.font = `500 28px ${MONO}`;
  for (const s of p.stack) {
    const w = ctx.measureText(s).width + 40;
    if (x + w > PAPER_W - m) break;
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    roundRect(ctx, x, cy, w, 52, 26);
    ctx.stroke();
    ctx.fillStyle = '#444';
    ctx.fillText(s, x + 20, cy + 36);
    x += w + 16;
  }
  ctx.fillStyle = '#999';
  ctx.font = `400 26px ${MONO}`;
  ctx.fillText(p.repo.replace('https://', ''), m, PAPER_H - 90);

  return toTexture(c, renderer);
}

/** Label glued to the manila folder tab/front. */
export function createFolderLabelTexture(p: Project, renderer: THREE.WebGLRenderer) {
  const [c, ctx] = makeCanvas(1024, 400);
  paperGrain(ctx, 1024, 400, '#fbfaf4', 6);
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 10;
  ctx.strokeRect(20, 20, 984, 360);
  ctx.fillStyle = '#c0392b';
  ctx.font = `800 54px ${MONO}`;
  ctx.save();
  ctx.translate(820, 110);
  ctx.rotate(-0.12);
  ctx.strokeStyle = 'rgba(192,57,43,0.8)';
  ctx.lineWidth = 6;
  ctx.strokeRect(-150, -48, 300, 80);
  ctx.fillStyle = 'rgba(192,57,43,0.85)';
  ctx.fillText('CASE FILE', -132, 10);
  ctx.restore();
  ctx.fillStyle = '#1b1b1b';
  ctx.font = `700 120px ${FONT}`;
  ctx.fillText(p.title, 70, 250);
  ctx.fillStyle = '#555';
  ctx.font = `500 40px ${FONT}`;
  ctx.fillText(p.kind, 74, 320);
  return toTexture(c, renderer);
}

export function createBusinessCardTexture(renderer: THREE.WebGLRenderer) {
  const [c, ctx] = makeCanvas(1050, 600);
  paperGrain(ctx, 1050, 600, '#1d1f22', 6);
  ctx.fillStyle = '#f2c14e';
  ctx.fillRect(70, 80, 70, 8);
  ctx.fillStyle = '#f4f4f4';
  ctx.font = `700 88px ${FONT}`;
  ctx.fillText(profile.name, 70, 200);
  ctx.fillStyle = '#b8b8b8';
  ctx.font = `400 38px ${FONT}`;
  ctx.fillText(profile.role, 70, 262);
  ctx.font = `400 32px ${MONO}`;
  ctx.fillStyle = '#e6e6e6';
  ctx.fillText('github.com/' + profile.handle, 70, 450);
  ctx.fillStyle = '#8a8a8a';
  ctx.fillText(profile.location, 70, 505);
  return toTexture(c, renderer);
}

export function createStickyNoteTexture(renderer: THREE.WebGLRenderer, lines: string[]) {
  const [c, ctx] = makeCanvas(512, 512);
  paperGrain(ctx, 512, 512, '#ffe873', 10);
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, 'rgba(0,0,0,0.06)');
  g.addColorStop(0.15, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  ctx.fillStyle = '#2b3a67';
  ctx.font = `600 96px "Caveat", "Segoe Print", "Comic Sans MS", cursive`;
  lines.forEach((l, i) => ctx.fillText(l, 40, 170 + i * 110));
  return toTexture(c, renderer);
}

/** Soft radial blob used as a cheap contact shadow / ambient occlusion under objects. */
export function createContactShadowTexture() {
  const [c, ctx] = makeCanvas(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
