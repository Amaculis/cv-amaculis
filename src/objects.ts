import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Project } from './data';
import {
  createBusinessCardTexture,
  createContactShadowTexture,
  createFolderLabelTexture,
  createPaperTexture,
  createScreenTexture,
  createStickyNoteTexture,
} from './canvasTextures';

/** Every clickable object carries `userData.action` on its root group. */
export type Action = { type: 'laptop' } | { type: 'project'; project: Project } | { type: 'about' };

/** A flat document the camera can fly onto: the mesh's local X is the page width, local -Z points to the top of the page. */
export interface DocPlane {
  mesh: THREE.Object3D;
  w: number;
  h: number;
}

const shadowTex = createContactShadowTexture();

/** Soft blob that grounds an object on the desk (cheap contact shadow). */
export function contactShadow(w: number, d: number, opacity = 0.6) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.0004;
  m.renderOrder = -1;
  m.raycast = () => {}; // never steals clicks
  return m;
}

export function enableShadows(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const mesh = o as THREE.Mesh;
      const mat = mesh.material as THREE.Material;
      if (mat.transparent) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
}

/* ------------------------------------------------------------------ desk */

export function createDesk(tex: { diff: THREE.Texture; nor: THREE.Texture; rough: THREE.Texture }) {
  const W = 3.2, D = 1.8, T = 0.04;
  for (const t of [tex.diff, tex.nor, tex.rough]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(W / 1.3, D / 1.3);
    t.anisotropy = 16;
  }
  tex.diff.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshPhysicalMaterial({
    map: tex.diff,
    normalMap: tex.nor,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: tex.rough,
    roughness: 0.85,
    clearcoat: 0.22,
    clearcoatRoughness: 0.42,
    color: new THREE.Color('#ad9784'),
  });
  const desk = new THREE.Mesh(new RoundedBoxGeometry(W, T, D, 4, 0.008), mat);
  desk.position.y = -T / 2;
  desk.receiveShadow = true;
  return desk;
}

/* ------------------------------------------------------------------ laptop */

export const LAPTOP = { W: 0.304, D: 0.212, baseH: 0.011, lidT: 0.0055, openAngle: -0.32 };
export const DISPLAY = { w: 0.284, h: 0.1775, yOffset: 0.0055 };

export function createLaptop(renderer: THREE.WebGLRenderer) {
  const { W, D, baseH, lidT } = LAPTOP;
  const root = new THREE.Group();
  root.name = 'laptop';

  const aluminium = new THREE.MeshPhysicalMaterial({
    color: '#b4b7bd',
    metalness: 1,
    roughness: 0.36,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
  });
  const blackPlastic = new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: 0.55, metalness: 0.1 });
  const keyMat = new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.62, metalness: 0.05 });

  // base
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, baseH, D, 5, 0.0045), aluminium);
  base.position.y = baseH / 2;
  root.add(base);

  // keyboard well
  const well = new THREE.Mesh(new THREE.PlaneGeometry(0.272, 0.112), blackPlastic);
  well.rotation.x = -Math.PI / 2;
  well.position.set(0, baseH + 0.0002, -D / 2 + 0.02 + 0.056);
  root.add(well);

  // keys (instanced)
  const keyGeo = new RoundedBoxGeometry(1, 1, 1, 1, 0.12);
  const rows = [
    { n: 14, h: 0.0085 }, // function row
    { n: 14, h: 0.0155 },
    { n: 14, h: 0.0155 },
    { n: 13, h: 0.0155 },
    { n: 12, h: 0.0155 },
    { n: 9, h: 0.0155, space: true },
  ];
  const pitch = 0.0191;
  const count = rows.reduce((a, r) => a + r.n, 0);
  const keys = new THREE.InstancedMesh(keyGeo, keyMat, count);
  const m4 = new THREE.Matrix4();
  let idx = 0;
  let z = -D / 2 + 0.026;
  for (const r of rows) {
    const rowW = 0.264;
    if (r.space) {
      // modifier keys + wide space bar
      const widths = [0.0165, 0.0165, 0.0165, 0.022, 0.092, 0.022, 0.0165, 0.0165, 0.0165];
      let x = -rowW / 2;
      const gap = (rowW - widths.reduce((a, b) => a + b, 0)) / (widths.length - 1);
      for (const w of widths) {
        m4.compose(new THREE.Vector3(x + w / 2, baseH + 0.0009, z + r.h / 2), new THREE.Quaternion(), new THREE.Vector3(w, 0.0016, r.h));
        keys.setMatrixAt(idx++, m4);
        x += w + gap;
      }
    } else {
      const kw = (rowW - (r.n - 1) * 0.0026) / r.n;
      for (let i = 0; i < r.n; i++) {
        const x = -rowW / 2 + kw / 2 + i * (kw + 0.0026);
        m4.compose(new THREE.Vector3(x, baseH + 0.0009, z + r.h / 2), new THREE.Quaternion(), new THREE.Vector3(kw, 0.0016, r.h));
        keys.setMatrixAt(idx++, m4);
      }
    }
    z += r.h + (pitch - 0.0155);
  }
  keys.count = idx;
  keys.castShadow = true;
  root.add(keys);

  // trackpad
  const pad = new THREE.Mesh(
    new RoundedBoxGeometry(0.122, 0.0004, 0.072, 2, 0.0002),
    new THREE.MeshPhysicalMaterial({ color: '#a9acb2', metalness: 0.6, roughness: 0.22, clearcoat: 0.6 }),
  );
  pad.position.set(0, baseH + 0.0001, D / 2 - 0.046);
  root.add(pad);

  // lid with hinge pivot
  const lid = new THREE.Group();
  lid.position.set(0, baseH, -D / 2 + 0.004);
  lid.rotation.x = LAPTOP.openAngle;
  root.add(lid);

  const lidShell = new THREE.Mesh(new RoundedBoxGeometry(W, D, lidT, 5, 0.0025), aluminium);
  lidShell.position.set(0, D / 2, -lidT / 2);
  lid.add(lidShell);

  const bezel = new THREE.Mesh(
    new RoundedBoxGeometry(W - 0.003, D - 0.003, 0.0006, 3, 0.0002),
    new THREE.MeshPhysicalMaterial({ color: '#050506', roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 }),
  );
  bezel.position.set(0, D / 2, 0.0003);
  lid.add(bezel);

  const screenTex = createScreenTexture(renderer);
  const screenMat = new THREE.MeshPhysicalMaterial({
    color: '#000000',
    emissive: '#ffffff',
    emissiveMap: screenTex,
    emissiveIntensity: 0,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
  });
  const display = new THREE.Mesh(new THREE.PlaneGeometry(DISPLAY.w, DISPLAY.h), screenMat);
  display.position.set(0, D / 2 + DISPLAY.yOffset, 0.00065);
  display.name = 'display';
  lid.add(display);

  // camera notch dot
  const cam = new THREE.Mesh(new THREE.CircleGeometry(0.0012, 16), new THREE.MeshBasicMaterial({ color: '#1b2a3a' }));
  cam.position.set(0, D - 0.0045, 0.0007);
  lid.add(cam);

  enableShadows(root);
  // the display surface is self lit; do not darken it with shadows
  display.receiveShadow = false;

  root.add(contactShadow(W * 1.35, D * 1.5, 0.75));

  root.userData.action = { type: 'laptop' } satisfies Action;
  return { root, lid, display, screenMat };
}

/* ------------------------------------------------------------------ paper */

function curledPaperGeometry(w: number, h: number, curl: number, seed = 1) {
  const g = new THREE.PlaneGeometry(w, h, 24, 32);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / (w / 2);
    const zz = pos.getZ(i) / (h / 2);
    const lift = curl * (Math.pow(Math.abs(x), 3) * 0.8 + Math.max(0, zz) ** 4 * 0.6) + 0.0004 * Math.sin(seed + x * 3 + zz * 2);
    pos.setY(i, Math.max(0, lift));
  }
  g.computeVertexNormals();
  return g;
}

const paperBlankMat = new THREE.MeshStandardMaterial({ color: '#f1efe8', roughness: 0.92, side: THREE.DoubleSide });

export function createPaperStack(p: Project, renderer: THREE.WebGLRenderer, sheets = 3) {
  const W = 0.21, H = 0.297;
  const root = new THREE.Group();
  let top: THREE.Mesh | null = null;
  for (let i = sheets - 1; i >= 0; i--) {
    const isTop = i === 0;
    const mat = isTop
      ? new THREE.MeshStandardMaterial({ map: createPaperTexture(p, renderer), roughness: 0.9, side: THREE.DoubleSide })
      : paperBlankMat;
    // lower sheets lie flatter so their curled edges never poke through the printed top sheet
    const sheet = new THREE.Mesh(curledPaperGeometry(W, H, isTop ? 0.003 : 0.0008, i * 7 + 1), mat);
    sheet.position.set((Math.random() - 0.5) * 0.008 * i, (sheets - 1 - i) * 0.0006 + 0.0003, (Math.random() - 0.5) * 0.01 * i);
    sheet.rotation.y = (Math.random() - 0.5) * 0.05 * i;
    root.add(sheet);
    if (isTop) top = sheet;
  }
  enableShadows(root);
  root.add(contactShadow(W * 1.2, H * 1.15, 0.35));
  root.userData.action = { type: 'project', project: p } satisfies Action;
  root.userData.docPlane = { mesh: top!, w: W, h: H } satisfies DocPlane;
  return root;
}

/* ------------------------------------------------------------------ folder */

export function createFolder(p: Project, renderer: THREE.WebGLRenderer) {
  const W = 0.235, H = 0.315, T = 0.0007;
  const root = new THREE.Group();
  const kraft = new THREE.MeshStandardMaterial({ color: '#d4b27a', roughness: 0.82, side: THREE.DoubleSide });

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, T, H), kraft);
  back.position.y = T / 2;
  root.add(back);

  // documents inside: a blank sheet and the printed project one-pager on top
  const under = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.0003, 0.297), new THREE.MeshStandardMaterial({ color: '#e9eef2', roughness: 0.9 }));
  under.position.set(-0.004, T + 0.0003, 0.004);
  under.rotation.y = -0.025;
  root.add(under);
  const doc = new THREE.Mesh(
    curledPaperGeometry(0.21, 0.297, 0.0008, 5),
    new THREE.MeshStandardMaterial({ map: createPaperTexture(p, renderer), roughness: 0.9, side: THREE.DoubleSide }),
  );
  doc.position.set(0.006, T + 0.0007, 0.002);
  doc.rotation.y = 0.012;
  root.add(doc);

  // front cover on a hinge along the left edge, so it can swing open
  const cover = new THREE.Group();
  cover.position.set(-W / 2, T + 0.0019, 0);
  root.add(cover);

  const s = new THREE.Shape();
  const hh = H / 2;
  s.moveTo(0, -hh);
  s.lineTo(W, -hh);
  s.lineTo(W, hh - 0.012);
  s.lineTo(0.11 + 0.005, hh - 0.012);
  s.lineTo(0.1 + 0.005, hh + 0.008);
  s.lineTo(0.02, hh + 0.008);
  s.lineTo(0.01, hh - 0.012);
  s.lineTo(0, hh - 0.012);
  s.closePath();
  const front = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false }), kraft);
  front.rotation.x = -Math.PI / 2;
  cover.add(front);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.17, 0.066),
    new THREE.MeshStandardMaterial({ map: createFolderLabelTexture(p, renderer), roughness: 0.75 }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(W / 2, T + 0.0003, -0.02);
  cover.add(label);

  // red elastic band
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(0.004, 0.0008, H + 0.002),
    new THREE.MeshStandardMaterial({ color: '#9b2a1f', roughness: 0.5 }),
  );
  band.position.set(W - 0.03, T + 0.0005, 0);
  cover.add(band);

  enableShadows(root);
  root.add(contactShadow(W * 1.25, H * 1.15, 0.45));
  root.userData.action = { type: 'project', project: p } satisfies Action;
  root.userData.docPlane = { mesh: doc, w: 0.21, h: 0.297 } satisfies DocPlane;
  root.userData.cover = cover;
  return root;
}

/* ------------------------------------------------------------------ mug */

export function createMug() {
  const root = new THREE.Group();
  const R = 0.041, H = 0.094;
  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(R - 0.004, 0),
    new THREE.Vector2(R, 0.004),
    new THREE.Vector2(R, H - 0.002),
    new THREE.Vector2(R - 0.0015, H),
    new THREE.Vector2(R - 0.004, H - 0.001),
    new THREE.Vector2(R - 0.004, 0.01),
    new THREE.Vector2(0, 0.009),
  ];
  const ceramic = new THREE.MeshPhysicalMaterial({ color: '#2f3a44', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), ceramic);
  root.add(body);

  const coffee = new THREE.Mesh(
    new THREE.CircleGeometry(R - 0.004, 48),
    new THREE.MeshPhysicalMaterial({ color: '#1c0e06', roughness: 0.04, clearcoat: 1 }),
  );
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = H - 0.016;
  root.add(coffee);

  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0065, 20, 40, Math.PI), ceramic);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(R - 0.002, H * 0.52, 0);
  root.add(handle);

  enableShadows(root);
  root.add(contactShadow(0.13, 0.13, 0.7));
  root.userData.action = { type: 'about' } satisfies Action;
  return root;
}

/* ------------------------------------------------------------------ pen */

export function createPen() {
  const root = new THREE.Group();
  const L = 0.14, r = 0.0045;
  const black = new THREE.MeshPhysicalMaterial({ color: '#111', roughness: 0.25, clearcoat: 1 });
  const metal = new THREE.MeshStandardMaterial({ color: '#d9c48c', metalness: 1, roughness: 0.25 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 32), black);
  body.rotation.z = Math.PI / 2;
  root.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(r, 0.016, 32), metal);
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = L / 2 + 0.008;
  root.add(tip);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.004, 32), metal);
  ring.rotation.z = Math.PI / 2;
  ring.position.x = -0.02;
  root.add(ring);
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.0012, 0.0024), metal);
  clip.position.set(-0.045, r + 0.0008, 0);
  root.add(clip);
  root.position.y = r;
  enableShadows(root);
  const g = new THREE.Group();
  g.add(root);
  g.add(contactShadow(0.17, 0.025, 0.6));
  return g;
}

/* ------------------------------------------------------------------ business card & sticky note */

export function createBusinessCard(renderer: THREE.WebGLRenderer) {
  const root = new THREE.Group();
  const card = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.0006, 0.0486), [
    new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ map: createBusinessCardTexture(renderer), roughness: 0.55 }),
    new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.6 }),
    new THREE.MeshStandardMaterial({ color: '#1d1f22', roughness: 0.6 }),
  ]);
  card.position.y = 0.0003;
  root.add(card);
  root.userData.docPlane = { mesh: card, w: 0.085, h: 0.0486 } satisfies DocPlane;
  enableShadows(root);
  root.add(contactShadow(0.1, 0.065, 0.4));
  root.userData.action = { type: 'about' } satisfies Action;
  return root;
}

export function createStickyNote(renderer: THREE.WebGLRenderer, lines: string[]) {
  const S = 0.076;
  const root = new THREE.Group();
  const note = new THREE.Mesh(
    curledPaperGeometry(S, S, 0.002, 3),
    new THREE.MeshStandardMaterial({ map: createStickyNoteTexture(renderer, lines), roughness: 0.85, side: THREE.DoubleSide }),
  );
  note.position.y = 0.0004;
  root.add(note);
  enableShadows(root);
  root.add(contactShadow(S * 1.2, S * 1.2, 0.3));
  return root;
}
