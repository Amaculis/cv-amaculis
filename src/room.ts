import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/*
 * The room behind the desk: a home office where the desk is pushed against a plastered
 * wall and the back of the desk is a small homelab. From the left: a 10" rack (patch
 * panel, switch, two mini PCs, a Raspberry Pi tray, a UPS), the Wi-Fi router and the
 * fibre box, a small monitor with a monitoring dashboard, a NAS and a Pi cluster. Their
 * status LEDs blink (out of focus they turn into little bokeh dots) and the monitor puts
 * a cool glow on the wall that answers the warm lamp.
 *
 * The home camera sees only a band of about 26 cm of wall above the desk, so all of it
 * stands low, on the desk itself; the shelf above is for the lower camera angles.
 */

export const WALL_Z = -0.95;

let seed = 11;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/* ------------------------------------------------------------------ plaster */

function plasterNormalMap() {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  // height: soft trowel swirls plus fine grit
  const hgt = new Float32Array(s * s);
  const blobs = Array.from({ length: 260 }, () => [rnd() * s, rnd() * s, 8 + rnd() * 40, (rnd() - 0.5) * 2]);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let h = (rnd() - 0.5) * 0.35;
      for (const [bx, by, br, bs] of blobs) {
        let dx = Math.abs(x - bx), dy = Math.abs(y - by);
        dx = Math.min(dx, s - dx);
        dy = Math.min(dy, s - dy);
        const d2 = (dx * dx + dy * dy) / (br * br);
        if (d2 < 1) h += bs * (1 - d2) * (1 - d2);
      }
      hgt[y * s + x] = h;
    }
  }
  const img = ctx.createImageData(s, s);
  const at = (x: number, y: number) => hgt[((y + s) % s) * s + ((x + s) % s)];
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const nx = (at(x - 1, y) - at(x + 1, y)) * 0.9;
      const ny = (at(x, y - 1) - at(x, y + 1)) * 0.9;
      const l = Math.hypot(nx, ny, 1);
      const i = (y * s + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 2.5);
  return t;
}

/* ------------------------------------------------------------------ device fronts */

type Ctx = CanvasRenderingContext2D;
const PX = 2600; // canvas pixels per metre on device faces

function canvasTex(w: number, h: number, draw: (g: Ctx, W: number, H: number) => void) {
  const c = document.createElement('canvas');
  c.width = Math.max(8, Math.round(w * PX));
  c.height = Math.max(8, Math.round(h * PX));
  const g = c.getContext('2d')!;
  draw(g, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function rrect(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Brushed / textured finish: a base colour with fine grain, so faces never look like flat CG. */
function finish(g: Ctx, W: number, H: number, base: string, grain = 10, brushed = false) {
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  const img = g.getImageData(0, 0, W, H);
  let line = 0;
  for (let y = 0; y < H; y++) {
    if (brushed) line = (rnd() - 0.5) * grain * 0.8;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const n = (rnd() - 0.5) * grain + line;
      img.data[i] += n;
      img.data[i + 1] += n;
      img.data[i + 2] += n;
    }
  }
  g.putImageData(img, 0, 0);
}

function vents(g: Ctx, x: number, y: number, w: number, h: number, cell: number, hole = 0.62, round = true) {
  g.fillStyle = 'rgba(0,0,0,0.85)';
  for (let yy = y; yy + cell <= y + h + 0.01; yy += cell) {
    const odd = Math.round((yy - y) / cell) % 2;
    for (let xx = x + (odd ? cell / 2 : 0); xx + cell <= x + w + 0.01; xx += cell) {
      g.beginPath();
      if (round) g.arc(xx + cell / 2, yy + cell / 2, (cell * hole) / 2, 0, Math.PI * 2);
      else g.rect(xx + cell * 0.2, yy + cell * 0.15, cell * 0.6, cell * 0.7);
      g.fill();
    }
  }
}

/** An RJ45 jack seen from the front. */
function rj45(g: Ctx, x: number, y: number, w: number, h: number, flip = false) {
  g.fillStyle = '#9a9ea4';
  g.fillRect(x, y, w, h);
  g.fillStyle = '#060607';
  g.fillRect(x + w * 0.1, y + h * 0.12, w * 0.8, h * 0.76);
  g.fillStyle = '#060607';
  const ty = flip ? y + h * 0.82 : y;
  g.fillRect(x + w * 0.34, ty, w * 0.32, h * 0.18);
  g.fillStyle = '#b38f3a';
  for (let i = 0; i < 8; i++) g.fillRect(x + w * (0.18 + i * 0.085), flip ? y + h * 0.18 : y + h * 0.7, w * 0.04, h * 0.1);
}

function usb(g: Ctx, x: number, y: number, w: number, h: number, blue = false) {
  g.fillStyle = '#a5a9ae';
  g.fillRect(x, y, w, h);
  g.fillStyle = blue ? '#1a4fb8' : '#0a0a0b';
  g.fillRect(x + w * 0.1, y + h * 0.2, w * 0.8, h * 0.45);
}

function screw(g: Ctx, x: number, y: number, r: number) {
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  gr.addColorStop(0, '#d0d3d8');
  gr.addColorStop(1, '#55585d');
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = r * 0.3;
  g.beginPath();
  g.moveTo(x - r * 0.6, y);
  g.lineTo(x + r * 0.6, y);
  g.moveTo(x, y - r * 0.6);
  g.lineTo(x, y + r * 0.6);
  g.stroke();
}

function text(g: Ctx, s: string, x: number, y: number, size: number, color = 'rgba(220,224,230,0.75)', align: CanvasTextAlign = 'left', weight = 600) {
  g.font = `${weight} ${size}px "Helvetica Neue", Arial, sans-serif`;
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(s, x, y);
}

/** Rack ears with their two screws each side. */
function ears(g: Ctx, W: number, H: number, ear: number) {
  for (const x of [0, W - ear]) {
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x === 0 ? ear - 2 : x, 0, 2, H);
    screw(g, x + ear / 2, H * 0.5, Math.min(ear, H) * 0.17);
  }
}

/* ------------------------------------------------------------------ LEDs */

/** How an LED behaves: steady, network-style activity, a slow heartbeat, or disk chatter. */
type LedMode = 'on' | 'act' | 'beat' | 'disk';
interface Led { pos: THREE.Vector3; color: THREE.Color; mode: LedMode; phase: number; rate: number; size: number }

const LED_COLORS = {
  green: '#38ff6a',
  amber: '#ffae1f',
  blue: '#2f8bff',
  red: '#ff2a1a',
  white: '#e8f1ff',
  cyan: '#30e6ff',
};

function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/* ------------------------------------------------------------------ dashboard */

/** A Grafana-style monitoring dashboard drawn on a canvas; it scrolls every couple of seconds. */
function createDashboard() {
  const W = 1024, H = 576;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const N = 60;
  const walk = (base: number, amp: number) => {
    const a: number[] = [];
    let v = base;
    for (let i = 0; i < N; i++) a.push((v = Math.min(0.97, Math.max(0.03, v + (rnd() - 0.5) * amp + (base - v) * 0.08))));
    return a;
  };
  const cpu = [walk(0.32, 0.12), walk(0.55, 0.15), walk(0.18, 0.08)];
  const net = [walk(0.4, 0.25), walk(0.2, 0.18)];
  let tick = 0;

  const panel = (x: number, y: number, w: number, h: number, title: string) => {
    g.fillStyle = '#181b1f';
    rrect(g, x, y, w, h, 6);
    g.fill();
    g.strokeStyle = '#262a31';
    g.lineWidth = 1.5;
    g.stroke();
    text(g, title, x + 14, y + 20, 17, '#ccccdc', 'left', 600);
  };
  const graph = (x: number, y: number, w: number, h: number, series: number[][], colors: string[]) => {
    g.strokeStyle = '#2a2e35';
    g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(x, y + (h * i) / 4);
      g.lineTo(x + w, y + (h * i) / 4);
      g.stroke();
    }
    series.forEach((s, k) => {
      g.beginPath();
      s.forEach((v, i) => {
        const px = x + (w * i) / (N - 1), py = y + h * (1 - v);
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      });
      g.strokeStyle = colors[k];
      g.lineWidth = 2.5;
      g.stroke();
      g.lineTo(x + w, y + h);
      g.lineTo(x, y + h);
      g.closePath();
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, colors[k] + '55');
      gr.addColorStop(1, colors[k] + '00');
      g.fillStyle = gr;
      g.fill();
    });
  };

  function draw() {
    g.fillStyle = '#111217';
    g.fillRect(0, 0, W, H);
    // top bar
    g.fillStyle = '#181b1f';
    g.fillRect(0, 0, W, 44);
    g.fillStyle = '#f46800';
    g.beginPath();
    g.arc(26, 22, 10, 0, Math.PI * 2);
    g.fill();
    text(g, 'Home / homelab · overview', 48, 22, 19, '#d8d9e0', 'left', 500);
    text(g, 'Last 1 hour   ⟳ 10s', W - 18, 22, 16, '#8e8e9e', 'right', 500);

    // row 1: CPU graph, memory gauge, uptime
    panel(12, 56, 560, 236, 'CPU usage');
    graph(28, 92, 528, 182, cpu, ['#73bf69', '#fade2a', '#5794f2']);
    panel(584, 56, 210, 236, 'Memory');
    const mem = 0.58 + Math.sin(tick * 0.3) * 0.02;
    g.lineWidth = 18;
    g.strokeStyle = '#2a2e35';
    g.beginPath();
    g.arc(689, 196, 64, Math.PI * 0.8, Math.PI * 2.2);
    g.stroke();
    g.strokeStyle = mem > 0.8 ? '#f2495c' : '#73bf69';
    g.beginPath();
    g.arc(689, 196, 64, Math.PI * 0.8, Math.PI * (0.8 + 1.4 * mem));
    g.stroke();
    text(g, `${Math.round(mem * 100)}%`, 689, 196, 38, '#73bf69', 'center', 600);
    text(g, '37.1 / 64 GiB', 689, 268, 15, '#8e8e9e', 'center', 500);
    panel(806, 56, 206, 110, 'Uptime');
    text(g, '42.3 days', 909, 118, 34, '#73bf69', 'center', 600);
    panel(806, 178, 206, 114, 'Containers');
    text(g, '27', 880, 238, 46, '#5794f2', 'center', 600);
    text(g, 'running', 950, 240, 16, '#8e8e9e', 'center', 500);

    // row 2: network, temperatures, services
    panel(12, 304, 400, 260, 'Network · eth0');
    graph(28, 340, 368, 200, net, ['#5794f2', '#b877d9']);
    panel(424, 304, 290, 260, 'Temperature');
    const temps: [string, number][] = [['node-01', 0.46], ['node-02', 0.58], ['nas-01', 0.38], ['pi-k3s', 0.52]];
    temps.forEach(([n, t], i) => {
      const y = 352 + i * 50;
      const v = t + Math.sin(tick * 0.7 + i) * 0.03;
      text(g, n, 440, y, 15, '#ccccdc', 'left', 500);
      g.fillStyle = '#22252b';
      g.fillRect(520, y - 10, 140, 20);
      g.fillStyle = v > 0.55 ? '#fade2a' : '#73bf69';
      g.fillRect(520, y - 10, 140 * v, 20);
      text(g, `${Math.round(30 + v * 50)}°C`, 700, y, 15, '#ccccdc', 'right', 600);
    });
    panel(726, 304, 286, 260, 'Services');
    ['k3s cluster', 'jellyfin', 'pi-hole', 'home-assistant', 'vaultwarden', 'grafana'].forEach((s, i) => {
      const y = 350 + i * 34;
      g.fillStyle = s === 'jellyfin' && tick % 4 === 2 ? '#fade2a' : '#73bf69';
      g.beginPath();
      g.arc(748, y, 6, 0, Math.PI * 2);
      g.fill();
      text(g, s, 764, y, 16, '#ccccdc', 'left', 500);
      text(g, 'UP', 996, y, 14, '#73bf69', 'right', 700);
    });
    tex.needsUpdate = true;
  }

  function step() {
    tick++;
    for (const s of cpu) {
      s.shift();
      const last = s[s.length - 1];
      s.push(Math.min(0.97, Math.max(0.03, last + (rnd() - 0.5) * 0.14)));
    }
    for (const s of net) {
      s.shift();
      s.push(Math.min(0.97, Math.max(0.03, s[s.length - 1] + (rnd() - 0.5) * 0.3)));
    }
    draw();
  }
  draw();
  return { tex, step };
}

/* ------------------------------------------------------------------ assembly */

export function createRoom(_envMap: THREE.Texture) {
  const group = new THREE.Group();
  const leds: Led[] = [];
  const led = (x: number, y: number, z: number, color: keyof typeof LED_COLORS, mode: LedMode = 'on', size = 0.0026) =>
    leds.push({ pos: new THREE.Vector3(x, y, z), color: new THREE.Color(LED_COLORS[color]), mode, phase: rnd() * 1000, rate: 0.6 + rnd() * 1.4, size });

  /* --- the wall */
  const plaster = new THREE.MeshStandardMaterial({
    color: '#7d756c',
    roughness: 0.93,
    normalMap: plasterNormalMap(),
    normalScale: new THREE.Vector2(0.7, 0.7),
  });
  const wallGeo = new THREE.PlaneGeometry(10, 4.2);
  const uv = wallGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 5, uv.getY(i) * 2.1);
  const wall = new THREE.Mesh(wallGeo, plaster);
  wall.position.set(0, 0.9, WALL_Z);
  wall.receiveShadow = true;
  group.add(wall);

  /* --- shared materials */
  const mats = new Map<string, THREE.Material>();
  const std = (color: string, roughness = 0.5, metalness = 0) => {
    const k = `${color}/${roughness}/${metalness}`;
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness, metalness }));
    return mats.get(k)!;
  };
  const blackMetal = std('#17181b', 0.42, 0.65);
  const darkPlastic = std('#1b1c1f', 0.55);

  /** A box with its own textured front face (+z); the rest uses `body`. */
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, body: THREE.Material, front?: THREE.Texture, frontRough = 0.45, frontMetal = 0.3) => {
    const faces = [body, body, body, body, body, body];
    if (front) faces[4] = new THREE.MeshStandardMaterial({ map: front, roughness: frontRough, metalness: frontMetal });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), faces);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const cylinder = (r: number, h: number, mat: THREE.Material, seg = 12) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
    m.castShadow = true;
    group.add(m);
    return m;
  };

  /** A cable: a tube along a smooth curve, with a moulded plug boot at each end. */
  const cableMats = new Map<string, THREE.Material>();
  const cable = (pts: [number, number, number][], color: string, r = 0.0021, boots = true) => {
    if (!cableMats.has(color)) cableMats.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));
    const mat = cableMats.get(color)!;
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, pts.length * 10), r, 6, false), mat);
    m.castShadow = true;
    group.add(m);
    if (boots) {
      for (const t of [0, 1]) {
        const p = curve.getPointAt(t), dir = curve.getTangentAt(t);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(r * 3.4, r * 3, 0.012), mat);
        boot.position.copy(p).addScaledVector(dir, t ? -0.006 : 0.006);
        boot.lookAt(boot.position.clone().add(dir));
        group.add(boot);
      }
    }
    return m;
  };

  /* ================================================================ 10" rack */
  const U = 0.04445;
  const RACK = { x: -0.79, z: -0.79, w: 0.254, d: 0.26, units: 9 };
  const rackFront = RACK.z + RACK.d / 2;
  const base = 0.022;
  const inner = 0.222;
  const rackH = base + RACK.units * U + 0.016;
  {
    const postW = 0.016;
    // four posts, the front pair punched with square cage-nut holes
    const railTex = canvasTex(postW, RACK.units * U, (g, W, H) => {
      finish(g, W, H, '#202125', 8);
      const pitch = H / (RACK.units * 3);
      g.fillStyle = '#050505';
      for (let i = 0; i < RACK.units * 3; i++) g.fillRect(W * 0.32, i * pitch + pitch * 0.3, W * 0.36, pitch * 0.4);
    });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const m = box(postW, rackH, postW, RACK.x + sx * (inner / 2 + postW / 2), rackH / 2, RACK.z + sz * (RACK.d / 2 - postW / 2), blackMetal, sz > 0 ? railTex : undefined, 0.5, 0.5);
        m.userData.rail = true;
      }
    }
    // top and bottom frames, rubber feet
    box(RACK.w + 0.012, 0.012, RACK.d, RACK.x, base - 0.006, RACK.z, blackMetal);
    box(RACK.w + 0.012, 0.016, RACK.d, RACK.x, rackH - 0.008, RACK.z, blackMetal);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cylinder(0.008, 0.016, darkPlastic).position.set(RACK.x + sx * 0.11, 0.008, RACK.z + sz * 0.11);
    // side panel on the room side only, so the gear stays visible from the front and right
    box(0.004, rackH - 0.03, RACK.d - 0.03, RACK.x - RACK.w / 2 - 0.004, rackH / 2, RACK.z, std('#141518', 0.5, 0.4));
  }
  const unitY = (u: number, n = 1) => base + (u + n / 2) * U; // centre of units [u, u+n)
  const ear = 0.016 * PX;
  const rackDev = (u: number, n: number, depth: number, draw: (g: Ctx, W: number, H: number) => void, body = darkPlastic) => {
    const h = n * U - 0.001;
    const t = canvasTex(RACK.w, h, (g, W, H) => {
      draw(g, W, H);
      ears(g, W, H, ear);
    });
    box(inner - 0.002, h - 0.002, depth, RACK.x, unitY(u, n), rackFront - depth / 2 - 0.004, body);
    // the faceplate itself, full 10" wide, flush on the rails
    box(RACK.w, h, 0.003, RACK.x, unitY(u, n), rackFront + 0.0015, blackMetal, t, 0.5, 0.45);
    return { y: unitY(u, n), h };
  };
  const fz = rackFront + 0.0035; // just in front of a faceplate
  const px2x = (px: number) => RACK.x - RACK.w / 2 + px / PX;
  const px2y = (y: number, h: number, py: number) => y + h / 2 - py / PX;

  // U0-1: UPS
  {
    const { y, h } = rackDev(0, 2, 0.2, (g, W, H) => {
      finish(g, W, H, '#1c1d20', 9, true);
      vents(g, W * 0.52, H * 0.18, W * 0.38, H * 0.64, H * 0.09);
      rrect(g, W * 0.12, H * 0.28, W * 0.2, H * 0.34, 6);
      g.fillStyle = '#071216';
      g.fill();
      text(g, 'UPS  1000VA', W * 0.12, H * 0.8, H * 0.09, 'rgba(210,214,220,0.6)');
      g.strokeStyle = '#5a5d62';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(W * 0.4, H * 0.45, H * 0.09, 0, Math.PI * 2);
      g.stroke();
    });
    // LCD glow and power ring
    const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.025), new THREE.MeshBasicMaterial({ color: new THREE.Color('#57d7ff').multiplyScalar(0.55), toneMapped: true }));
    lcd.position.set(px2x(RACK.w * PX * 0.22), px2y(y, h, h * PX * 0.45), fz - 0.0005);
    lcd.userData.glow = 0.55;
    group.add(lcd);
    led(px2x(RACK.w * PX * 0.4), px2y(y, h, h * PX * 0.45), fz, 'green', 'on', 0.004);
  }
  // U2: Raspberry Pi tray, four Pis
  {
    const { y, h } = rackDev(2, 1, 0.12, (g, W, H) => {
      finish(g, W, H, '#202125', 8, true);
      for (let i = 0; i < 4; i++) {
        const x = ear + 20 + i * ((W - 2 * ear - 40) / 4);
        rrect(g, x, H * 0.2, (W - 2 * ear - 40) / 4 - 24, H * 0.6, 4);
        g.fillStyle = '#0b2412';
        g.fill();
        rj45(g, x + 12, H * 0.3, 44, H * 0.4);
        usb(g, x + 66, H * 0.3, 30, H * 0.18, true);
        usb(g, x + 66, H * 0.52, 30, H * 0.18);
        text(g, `pi-0${i + 1}`, x + 104, H * 0.5, H * 0.16, 'rgba(220,224,230,0.6)');
      }
    });
    for (let i = 0; i < 4; i++) {
      const x = ear + 20 + i * ((RACK.w * PX - 2 * ear - 40) / 4) + 170;
      led(px2x(x), px2y(y, h, h * PX * 0.38), fz, 'red', 'on');
      led(px2x(x), px2y(y, h, h * PX * 0.62), fz, 'green', 'disk');
    }
  }
  // U3-4: two mini PCs on a shelf
  for (const [u, name] of [[3, 'node-01'], [4, 'node-02']] as const) {
    const { y, h } = rackDev(u, 1, 0.18, (g, W, H) => {
      finish(g, W, H, '#2a2c30', 14, true);
      vents(g, W * 0.46, H * 0.22, W * 0.42, H * 0.56, H * 0.14, 0.55, false);
      usb(g, ear + 30, H * 0.3, 34, H * 0.2, true);
      usb(g, ear + 30, H * 0.55, 34, H * 0.2, true);
      g.fillStyle = '#0d0d0f';
      g.beginPath();
      g.arc(ear + 92, H * 0.5, H * 0.08, 0, Math.PI * 2);
      g.fill();
      text(g, name, ear + 116, H * 0.5, H * 0.2, 'rgba(225,228,232,0.75)');
    });
    led(px2x(ear + 92 + 16), px2y(y, h, h * PX * 0.5), fz, 'blue', 'on', 0.0022);
    led(px2x(ear + 92 + 16), px2y(y, h, h * PX * 0.5) - 0.006, fz, 'amber', 'disk', 0.0018);
  }
  // U5: brush panel
  rackDev(5, 1, 0.02, (g, W, H) => {
    finish(g, W, H, '#18191b', 8);
    g.fillStyle = '#050505';
    g.fillRect(ear + 20, H * 0.42, W - 2 * ear - 40, H * 0.16);
    g.strokeStyle = 'rgba(70,70,74,0.5)';
    g.lineWidth = 1;
    for (let x = ear + 22; x < W - ear - 22; x += 3) {
      g.beginPath();
      g.moveTo(x, H * 0.42);
      g.lineTo(x + (rnd() - 0.5) * 3, H * 0.5);
      g.moveTo(x, H * 0.58);
      g.lineTo(x + (rnd() - 0.5) * 3, H * 0.5);
      g.stroke();
    }
  });
  // U6: 8-port switch with SFP, U7: 12-port patch panel
  const swPorts: number[] = [];
  const ppPorts: number[] = [];
  {
    const pw = 46, ph = U * PX * 0.42;
    const { y, h } = rackDev(6, 1, 0.12, (g, W, H) => {
      finish(g, W, H, '#1e1f23', 9, true);
      text(g, 'SW-08  2.5G', ear + 18, H * 0.5, H * 0.17, 'rgba(225,228,232,0.65)');
      for (let i = 0; i < 8; i++) {
        const x = ear + 160 + i * (pw + 10) + (i >= 4 ? 14 : 0);
        rj45(g, x, (H - ph) / 2, pw, ph, i % 2 === 1);
        swPorts.push(x + pw / 2);
      }
      g.fillStyle = '#0a0a0b';
      g.fillRect(W - ear - 72, H * 0.32, 52, H * 0.36);
    });
    swPorts.forEach((x, i) => {
      led(px2x(x - 15), px2y(y, h, h * PX * 0.16), fz, 'green', i < 6 ? 'on' : 'beat', 0.0018);
      led(px2x(x + 15), px2y(y, h, h * PX * 0.16), fz, 'amber', i < 6 ? 'act' : 'beat', 0.0018);
    });
    led(px2x(RACK.w * PX - ear - 46), px2y(y, h, h * PX * 0.18), fz, 'cyan', 'act', 0.0018);
    const sw = { y, h };

    const pp = rackDev(7, 1, 0.04, (g, W, H) => {
      finish(g, W, H, '#1b1c1f', 8);
      const kc = ['#1f5fd6', '#1f5fd6', '#e8c21c', '#e8c21c', '#ececec', '#ececec', '#d23a2b', '#1f5fd6', '#27a046', '#ececec', '#111', '#111'];
      for (let i = 0; i < 12; i++) {
        const x = ear + 30 + i * 46;
        g.fillStyle = kc[i];
        g.fillRect(x - 4, H * 0.22, pw * 0.72 + 8, H * 0.56);
        rj45(g, x, H * 0.3, pw * 0.72, H * 0.4);
        text(g, String(i + 1), x + pw * 0.36, H * 0.12, H * 0.1, 'rgba(225,228,232,0.6)', 'center');
        ppPorts.push(x + pw * 0.36);
      }
    });
    // short patch cables from the patch panel down to the switch, looping out in front
    const colors = ['#2d6be0', '#2d6be0', '#f0c419', '#f0c419', '#e9e9e9', '#e9e9e9'];
    for (let i = 0; i < 6; i++) {
      const x0 = px2x(ppPorts[i]), x1 = px2x(swPorts[i]);
      const y0 = pp.y, y1 = sw.y;
      const out = 0.03 + i * 0.004;
      cable([
        [x0, y0, fz + 0.006],
        [x0 + (x1 - x0) * 0.2, y0 - 0.006, fz + out],
        [x0 + (x1 - x0) * 0.8, y1 + 0.004, fz + out * 0.9],
        [x1, y1, fz + 0.006],
      ], colors[i], 0.0019);
    }
    // uplinks from the switch out of the side of the rack towards the router and the NAS
    for (let i = 6; i < 8; i++) {
      const x0 = px2x(swPorts[i]);
      cable([
        [x0, sw.y, fz + 0.006],
        [x0 + 0.02, sw.y - 0.02, fz + 0.03],
        [RACK.x + RACK.w / 2 + 0.03, 0.03, rackFront - 0.02],
        [RACK.x + RACK.w / 2 + 0.12, 0.003, RACK.z - 0.06],
        [RACK.x + RACK.w / 2 + 0.3, 0.003, -0.9],
      ], i === 6 ? '#2d6be0' : '#e9e9e9', 0.0021, false);
    }
  }
  // U8: a fan-and-power panel on top
  {
    const { y, h } = rackDev(8, 1, 0.05, (g, W, H) => {
      finish(g, W, H, '#1c1d20', 9, true);
      for (const cx of [W * 0.32, W * 0.62]) {
        g.fillStyle = '#0a0a0a';
        g.beginPath();
        g.arc(cx, H / 2, H * 0.4, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#3a3c40';
        g.lineWidth = 2;
        for (let r = H * 0.12; r < H * 0.4; r += H * 0.09) {
          g.beginPath();
          g.arc(cx, H / 2, r, 0, Math.PI * 2);
          g.stroke();
        }
      }
      rrect(g, W * 0.8, H * 0.3, W * 0.06, H * 0.4, 3);
      g.fillStyle = '#7a1010';
      g.fill();
    });
    led(px2x(RACK.w * PX * 0.83), px2y(y, h, h * PX * 0.5), fz + 0.0005, 'red', 'on', 0.003);
  }

  /* ================================================================ router + fibre box */
  {
    const x = -0.4, z = -0.82, w = 0.23, d = 0.15, h = 0.034;
    const top = canvasTex(w, d, (g, W, H) => {
      finish(g, W, H, '#1a1b1e', 10);
      vents(g, W * 0.12, H * 0.15, W * 0.76, H * 0.55, H * 0.07, 0.5, false);
    });
    const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.008), std('#1c1d20', 0.6));
    body.position.set(x, 0.008 + h / 2, z);
    body.castShadow = body.receiveShadow = true;
    group.add(body);
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.016, d - 0.016), new THREE.MeshStandardMaterial({ map: top, roughness: 0.6 }));
    lid.rotation.x = -Math.PI / 2;
    lid.position.set(x, 0.008 + h + 0.0002, z);
    group.add(lid);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cylinder(0.006, 0.008, darkPlastic).position.set(x + sx * 0.09, 0.004, z + sz * 0.05);
    // status LEDs across the front edge
    const modes: LedMode[] = ['on', 'on', 'act', 'act', 'act', 'beat'];
    modes.forEach((m, i) => led(x - 0.05 + i * 0.02, 0.008 + h * 0.62, z + d / 2 + 0.0008, 'white', m, 0.0022));
    // four antennas, hinged at the back and splayed a little
    const antMat = std('#16171a', 0.5);
    [-0.085, -0.03, 0.03, 0.085].forEach((ax, i) => {
      const a = new THREE.Group();
      a.position.set(x + ax, 0.008 + h * 0.6, z - d / 2 - 0.004);
      a.rotation.z = (i - 1.5) * -0.09;
      a.rotation.x = -0.12;
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.014, 12), antMat);
      hinge.rotation.z = Math.PI / 2;
      const rod = new THREE.Mesh(new RoundedBoxGeometry(0.014, 0.17, 0.007, 2, 0.003), antMat);
      rod.position.y = 0.088;
      rod.castShadow = true;
      a.add(hinge, rod);
      group.add(a);
    });
    // a small white fibre ONT standing on its edge beside it, with its own LEDs
    const ont = new THREE.Mesh(new RoundedBoxGeometry(0.032, 0.14, 0.11, 3, 0.006), std('#e4e2dd', 0.45));
    ont.position.set(-0.235, 0.07, -0.85);
    ont.rotation.y = -0.25;
    ont.castShadow = ont.receiveShadow = true;
    group.add(ont);
    const ontFront = new THREE.Vector3(0.016 + 0.0008, 0, 0).applyEuler(ont.rotation);
    ['green', 'green', 'green', 'amber'].forEach((c, i) => {
      const p = new THREE.Vector3(0, 0.035 - i * 0.016, 0.035).applyEuler(ont.rotation).add(ont.position).add(ontFront);
      led(p.x, p.y, p.z, c as keyof typeof LED_COLORS, i === 2 ? 'act' : 'on', 0.0022);
    });
    // yellow fibre patch lead, and ethernet from the router back to the rack
    cable([[-0.22, 0.02, -0.9], [-0.215, 0.05, -0.88], [-0.225, 0.08, -0.86]], '#f2cf2a', 0.0015, false);
    cable([[x - 0.06, 0.02, z - d / 2 - 0.01], [x - 0.1, 0.006, -0.9], [-0.62, 0.003, -0.92]], '#2d6be0', 0.0021, false);
    // power bricks lying behind
    box(0.06, 0.03, 0.04, -0.3, 0.015, -0.915, darkPlastic);
  }

  /* ================================================================ monitor with a dashboard */
  const dash = createDashboard();
  const screenMat = new THREE.MeshBasicMaterial({ map: dash.tex, toneMapped: true });
  {
    const x = 0.19, z = -0.8;
    const sw = 0.36, sh = 0.205;
    const mon = new THREE.Group();
    mon.position.set(x, 0, z);
    mon.rotation.y = -0.08;
    group.add(mon);
    const stand = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.008, 0.12, 2, 0.003), std('#2b2d31', 0.35, 0.7));
    stand.position.set(0, 0.004, 0.01);
    stand.castShadow = stand.receiveShadow = true;
    const neck = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.1, 0.014, 2, 0.004), std('#2b2d31', 0.35, 0.7));
    neck.position.set(0, 0.055, -0.02);
    neck.castShadow = true;
    const head = new THREE.Group();
    head.position.set(0, 0.06 + sh / 2 + 0.012, -0.006);
    head.rotation.x = -0.07;
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(sw + 0.012, sh + 0.02, 0.012, 2, 0.003), std('#101113', 0.45, 0.2));
    bezel.castShadow = true;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), screenMat);
    screen.position.set(0, 0.003, 0.0062);
    head.add(bezel, screen);
    mon.add(stand, neck, head);
    // power + display cable down the back
    cable([[x, 0.07, z - 0.03], [x + 0.01, 0.02, -0.88], [x + 0.03, 0.003, -0.93]], '#141414', 0.0026, false);
    led(x + sw / 2 - 0.01, 0.06 + 0.012 - 0.004, z + 0.0075, 'white', 'on', 0.0014);
  }
  // the screen's cool light on the desk and wall, and bias lighting behind it
  const monLight = new THREE.PointLight('#7fa6ff', 0, 1.1, 2);
  monLight.position.set(0.19, 0.18, -0.7);
  group.add(monLight);
  const washTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const washMat = new THREE.MeshBasicMaterial({
    map: washTex,
    color: new THREE.Color('#5a7cff'),
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), washMat);
  wash.position.set(0.2, 0.2, WALL_Z + 0.002);
  wash.scale.x = 1.3;
  group.add(wash);

  /* ================================================================ NAS */
  {
    const x = 0.56, z = -0.79, w = 0.17, h = 0.2, d = 0.22;
    const front = canvasTex(w, h, (g, W, H) => {
      finish(g, W, H, '#121315', 7);
      // left strip: power button and LEDs, then four drive trays
      text(g, 'nas-01', W * 0.1, H * 0.06, H * 0.04, 'rgba(220,224,230,0.55)', 'center');
      g.fillStyle = '#060607';
      g.beginPath();
      g.arc(W * 0.1, H * 0.86, W * 0.035, 0, Math.PI * 2);
      g.fill();
      const tx = W * 0.2, tw = (W * 0.76) / 4;
      for (let i = 0; i < 4; i++) {
        const xx = tx + i * tw;
        rrect(g, xx + 3, H * 0.1, tw - 6, H * 0.82, 6);
        g.fillStyle = '#1d1e21';
        g.fill();
        vents(g, xx + 10, H * 0.16, tw - 20, H * 0.6, (tw - 20) / 4.2, 0.6);
        rrect(g, xx + tw * 0.25, H * 0.8, tw * 0.5, H * 0.05, 4);
        g.fillStyle = '#2b2c30';
        g.fill();
      }
    });
    const nas = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.006), std('#141517', 0.5, 0.2));
    nas.position.set(x, h / 2 + 0.006, z);
    nas.castShadow = nas.receiveShadow = true;
    group.add(nas);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.004, h - 0.004), new THREE.MeshStandardMaterial({ map: front, roughness: 0.55, metalness: 0.15 }));
    plate.position.set(x, h / 2 + 0.006, z + d / 2 + 0.0004);
    group.add(plate);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cylinder(0.008, 0.006, darkPlastic).position.set(x + sx * 0.065, 0.003, z + sz * 0.08);
    const fzN = z + d / 2 + 0.001;
    const lx = x - w / 2 + w * 0.1;
    led(lx, 0.006 + h * 0.14, fzN, 'blue', 'on', 0.003);
    led(lx, 0.006 + h * 0.74, fzN, 'green', 'on', 0.0022);
    led(lx, 0.006 + h * 0.68, fzN, 'green', 'act', 0.0022);
    led(lx, 0.006 + h * 0.62, fzN, 'green', 'act', 0.0022);
    for (let i = 0; i < 4; i++) {
      const bx = x - w / 2 + w * 0.2 + (i + 0.5) * ((w * 0.76) / 4);
      led(bx - 0.006, 0.006 + h * 0.085, fzN, 'green', 'on', 0.0019);
      led(bx + 0.006, 0.006 + h * 0.085, fzN, 'blue', 'disk', 0.0019);
    }
    cable([[x - 0.03, 0.03, z - d / 2], [x - 0.05, 0.004, -0.91], [x - 0.35, 0.003, -0.925]], '#e9e9e9', 0.0021, false);
    cable([[x + 0.03, 0.04, z - d / 2], [x + 0.05, 0.004, -0.92], [x + 0.06, -0.1, -0.935]], '#141414', 0.003, false);
  }

  /* ================================================================ Pi cluster */
  {
    const x = 0.8, z = -0.8, pw = 0.1, pd = 0.078, layers = 4, gap = 0.034;
    const acrylic = new THREE.MeshStandardMaterial({ color: '#b9d6ff', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.14, depthWrite: false });
    const brass = std('#b8924a', 0.35, 0.9);
    const pcb = std('#1d6b3a', 0.55);
    const chip = std('#131314', 0.4);
    const silver = std('#b9bcc1', 0.35, 0.85);
    for (let i = 0; i <= layers; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.003, pd), acrylic);
      plate.position.set(x, 0.008 + i * gap, z);
      group.add(plate);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const p = cylinder(0.0022, layers * gap, brass, 8);
      p.position.set(x + sx * (pw / 2 - 0.006), 0.008 + (layers * gap) / 2, z + sz * (pd / 2 - 0.006));
    }
    const colors = ['#2d6be0', '#f0c419', '#e9e9e9', '#d23a2b'];
    for (let i = 0; i < layers; i++) {
      const y = 0.008 + i * gap + 0.006;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.0016, 0.056), pcb);
      b.position.set(x, y, z);
      b.castShadow = true;
      group.add(b);
      const soc = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.0018, 0.015), chip);
      soc.position.set(x - 0.012, y + 0.0016, z - 0.004);
      // heatsink with fins on the SoC
      const sink = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.008, 0.016), std('#2a2b2f', 0.4, 0.8));
      sink.position.set(x - 0.012, y + 0.006, z - 0.004);
      const ram = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.0015, 0.012), chip);
      ram.position.set(x + 0.006, y + 0.0015, z - 0.004);
      // ethernet and USB blocks facing the room
      const eth = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.013, 0.021), silver);
      eth.position.set(x + 0.032, y + 0.0074, z + 0.019);
      const usbA = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.015, 0.017), silver);
      usbA.position.set(x + 0.012, y + 0.0083, z + 0.021);
      const usbB = usbA.clone();
      usbB.position.x = x - 0.006;
      for (const m of [soc, sink, ram, eth, usbA, usbB]) {
        m.castShadow = true;
        group.add(m);
      }
      led(x - 0.036, y + 0.0016, z + 0.026, 'red', 'on', 0.0016);
      led(x - 0.031, y + 0.0016, z + 0.026, 'green', 'disk', 0.0016);
      // patch lead from each Pi's ethernet to a little switch on the right
      cable([[x + 0.032, y + 0.007, z + 0.034], [x + 0.06, y + 0.002, z + 0.04], [x + 0.08, 0.02 + i * 0.002, z + 0.02], [x + 0.1, 0.012, z - 0.01]], colors[i], 0.0016);
    }
    // 5-port desktop switch it all plugs into
    const swF = canvasTex(0.1, 0.026, (g, W, H) => {
      finish(g, W, H, '#c9cbce', 10, true);
      for (let i = 0; i < 5; i++) rj45(g, 14 + i * 46, H * 0.3, 40, H * 0.5);
    });
    box(0.1, 0.026, 0.07, x + 0.09, 0.013, z - 0.03, std('#b9bbbf', 0.35, 0.8), swF, 0.4, 0.6).rotation.y = -Math.PI / 2 + 0.3;
    for (let i = 0; i < 5; i++) led(x + 0.125, 0.022, z - 0.07 + i * 0.016, 'green', i < 4 ? 'act' : 'on', 0.0016);
    // a little fan on top
    const fan = cylinder(0.02, 0.008, std('#1a1a1c', 0.5), 20);
    fan.position.set(x, 0.008 + layers * gap + 0.006, z);
  }

  /* ================================================================ shelf above */
  {
    const wood = new THREE.MeshStandardMaterial({ color: '#5b3d27', roughness: 0.62 });
    const y = 0.47, d = 0.17;
    box(1.45, 0.022, d, 0.15, y, WALL_Z + d / 2, wood);
    for (const bx of [-0.45, 0.75]) box(0.02, 0.07, 0.12, bx, y - 0.046, WALL_Z + 0.06, std('#1a1a1c', 0.5, 0.6));
    // spare drives, a cable spool, a little plant
    const hdd = std('#8f9398', 0.4, 0.8);
    for (let i = 0; i < 3; i++) box(0.102, 0.026, 0.147, -0.25, y + 0.024 + i * 0.027, WALL_Z + 0.08, hdd).rotation.y = (rnd() - 0.5) * 0.15;
    const spool = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 10, 32), std('#2d6be0', 0.6));
    spool.position.set(0.05, y + 0.06, WALL_Z + 0.07);
    spool.rotation.y = 0.3;
    group.add(spool);
    const pot = cylinder(0.04, 0.07, std('#c9b9a6', 0.8), 20);
    pot.position.set(0.55, y + 0.046, WALL_Z + 0.08);
    const leafMat = std('#2f5a2c', 0.7);
    for (let i = 0; i < 9; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), leafMat);
      const a = (i / 9) * Math.PI * 2;
      leaf.scale.set(0.35, 1.3, 0.6);
      leaf.position.set(0.55 + Math.cos(a) * 0.02, y + 0.12 + rnd() * 0.03, WALL_Z + 0.08 + Math.sin(a) * 0.02);
      leaf.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.5);
      leaf.castShadow = true;
      group.add(leaf);
    }
    // a raspberry pi sitting on the shelf, in a case, with its LED
    box(0.095, 0.03, 0.066, 0.3, y + 0.026, WALL_Z + 0.08, std('#c8332e', 0.45));
    led(0.33, y + 0.026, WALL_Z + 0.08 + 0.034, 'green', 'disk', 0.0018);
  }

  /* --- all the LEDs, as one instanced mesh */
  const ledGeo = new THREE.BoxGeometry(1, 1, 0.4);
  const ledMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: true });
  const ledMesh = new THREE.InstancedMesh(ledGeo, ledMat, leds.length);
  const mtx = new THREE.Matrix4();
  leds.forEach((l, i) => {
    mtx.makeScale(l.size, l.size, l.size).setPosition(l.pos);
    ledMesh.setMatrixAt(i, mtx);
    ledMesh.setColorAt(i, l.color);
  });
  group.add(ledMesh);

  group.traverse((o) => ((o as THREE.Mesh).raycast = () => {}));

  let level = 1;
  let nextDash = 0;
  let lastTime = 0;
  const tmp = new THREE.Color();
  const glows: THREE.Mesh[] = [];
  group.traverse((o) => o.userData.glow && glows.push(o as THREE.Mesh));

  /** LED brightness 0..1 for a given behaviour at time t. */
  function ledLevel(l: Led, t: number) {
    switch (l.mode) {
      case 'on':
        return 1;
      case 'beat': {
        const p = (t * 0.5 + l.phase) % 1;
        return p < 0.08 ? 1 : 0.06;
      }
      case 'act': {
        // bursts of traffic: fast flicker inside random windows
        const win = Math.floor(t * 1.3 * l.rate + l.phase);
        if (hash(win) < 0.45) return 0.08;
        return hash(Math.floor(t * 22 + l.phase)) > 0.35 ? 1 : 0.1;
      }
      case 'disk': {
        const win = Math.floor(t * 0.8 * l.rate + l.phase);
        if (hash(win + 7.3) < 0.6) return 0.05;
        return hash(Math.floor(t * 15 + l.phase * 3)) > 0.5 ? 1 : 0.05;
      }
    }
  }

  function paint(t: number) {
    leds.forEach((l, i) => {
      tmp.copy(l.color).multiplyScalar(ledLevel(l, t) * 3.2 * level + 0.02);
      ledMesh.setColorAt(i, tmp);
    });
    ledMesh.instanceColor!.needsUpdate = true;
  }
  paint(0);

  return {
    group,
    /** Transparent bits to keep out of the depth passes. */
    fx: [wash] as THREE.Object3D[],
    /** 0 = everything off (before the intro), 1 = normal. */
    setLevel(k: number) {
      level = k;
      screenMat.color.setScalar(0.62 * k);
      washMat.opacity = 0.13 * k;
      monLight.intensity = 0.16 * k;
      for (const g of glows) (g.material as THREE.MeshBasicMaterial).color.set('#57d7ff').multiplyScalar(g.userData.glow * k);
      paint(lastTime);
    },
    update(time: number, animate: boolean) {
      if (!animate) return;
      lastTime = time;
      paint(time);
      if (time > nextDash) {
        nextDash = time + 2.5;
        dash.step();
      }
    },
  };
}
