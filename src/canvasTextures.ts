import * as THREE from 'three';
import { profile, projects, type Project } from './data';

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

export const SCREEN_W = 1600;
export const SCREEN_H = 1000;

export function drawWallpaper(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#0f2027');
  g.addColorStop(0.5, '#203a43');
  g.addColorStop(1, '#2c5364');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // soft glows
  const glow = (x: number, y: number, r: number, c: string) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  };
  glow(w * 0.8, h * 0.2, w * 0.5, 'rgba(255,170,90,0.35)');
  glow(w * 0.15, h * 0.9, w * 0.5, 'rgba(80,160,255,0.25)');
}

/** Static image of the laptop "desktop" shown on the 3D screen before zooming in. */
export function createScreenTexture(renderer: THREE.WebGLRenderer) {
  const [c, ctx] = makeCanvas(SCREEN_W, SCREEN_H);
  drawWallpaper(ctx, SCREEN_W, SCREEN_H);

  // menu bar
  ctx.fillStyle = 'rgba(20,20,24,0.55)';
  ctx.fillRect(0, 0, SCREEN_W, 44);
  ctx.fillStyle = '#fff';
  ctx.font = `600 22px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(`●  ${profile.handle}`, 24, 22);
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText('Terminal    About', 200, 22);
  ctx.textAlign = 'right';
  ctx.fillText('Portfolio OS', SCREEN_W - 24, 22);
  ctx.textAlign = 'left';

  // welcome window
  const wx = 470, wy = 210, ww = 820, wh = 460;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = 'rgba(250,250,252,0.96)';
  roundRect(ctx, wx, wy, ww, wh, 22);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(wx + 34 + i * 30, wy + 32, 9, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = '#111';
  ctx.font = `700 64px ${FONT}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`Hi, I'm ${profile.name}.`, wx + 60, wy + 150);
  ctx.fillStyle = '#555';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(profile.role, wx + 60, wy + 200);
  ctx.fillStyle = '#333';
  ctx.font = `400 26px ${FONT}`;
  wrapText(ctx, profile.summary, wx + 60, wy + 270, ww - 120, 38, 3);
  ctx.fillStyle = '#0a84ff';
  roundRect(ctx, wx + 60, wy + 370, 300, 56, 28);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText('Click to open  →', wx + 100, wy + 406);

  // desktop icons
  ctx.textAlign = 'center';
  projects.forEach((p, i) => {
    const x = 90;
    const y = 110 + i * 140;
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(ctx, x - 44, y, 88, 88, 20);
    ctx.fill();
    ctx.font = `48px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(p.icon, x, y + 62);
    ctx.font = `500 18px ${FONT}`;
    ctx.fillText(p.title.length > 16 ? p.title.slice(0, 15) + '…' : p.title, x, y + 112);
  });
  ctx.textAlign = 'left';

  return toTexture(c, renderer);
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
