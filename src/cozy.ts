import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { contactShadow, enableShadows } from './objects';

/* ------------------------------------------------------------------ desk lamp */

/** Rod between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 20), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

/**
 * Architect-style lamp, built in a local frame where it reaches along +x.
 * Rotate the root around Y to aim it; the shade points at (reach, 0, 0).
 */
export function createLamp(reach = 0.5) {
  const root = new THREE.Group();
  const metal = new THREE.MeshPhysicalMaterial({ color: '#1d2126', metalness: 0.85, roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.3 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c9a66b', metalness: 1, roughness: 0.28 });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.022, 64), metal);
  base.position.y = 0.011;
  root.add(base);
  const baseCap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.02, 32), brass);
  baseCap.position.y = 0.03;
  root.add(baseCap);
  // push-button switch on the base, on the side facing the room
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0095, 0.007, 32), brass);
  button.position.set(0.006, 0.022 + 0.0035, 0.052);
  root.add(button);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.002, 32), metal);
  ring.position.set(0.006, 0.023, 0.052);
  root.add(ring);

  const pivot = new THREE.Vector3(0, 0.04, 0);
  const elbow = new THREE.Vector3(-0.03, 0.27, 0);
  const head = new THREE.Vector3(reach * 0.42, 0.34, 0);
  const aim = new THREE.Vector3(reach, 0, 0);

  // twin parallel arms like a real architect lamp
  for (const dz of [-0.008, 0.008]) {
    const o = new THREE.Vector3(0, 0, dz);
    root.add(rod(pivot.clone().add(o), elbow.clone().add(o), 0.0042, metal));
    root.add(rod(elbow.clone().add(o), head.clone().add(o), 0.0038, metal));
  }
  for (const p of [pivot, elbow]) {
    const j = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 24), brass);
    j.rotation.x = Math.PI / 2;
    j.position.copy(p);
    root.add(j);
  }
  // tension spring
  const springPts = Array.from({ length: 120 }, (_, i) => {
    const t = i / 119;
    const p = pivot.clone().lerp(elbow, 0.15 + t * 0.55);
    return p.add(new THREE.Vector3(0.013 + Math.cos(t * 70) * 0.0035, 0, Math.sin(t * 70) * 0.0035));
  });
  root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPts), 360, 0.0008, 6), brass));

  // head group: +z points at the desk (root has no transform yet, so local == world)
  const headGroup = new THREE.Group();
  headGroup.position.copy(head);
  root.add(headGroup);
  headGroup.lookAt(aim);

  const shadeGeo = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.016, 0.03),
      new THREE.Vector2(0.022, 0.012),
      new THREE.Vector2(0.03, -0.01),
      new THREE.Vector2(0.05, -0.05),
      new THREE.Vector2(0.072, -0.095),
      new THREE.Vector2(0.074, -0.1),
    ],
    64,
  );
  shadeGeo.rotateX(-Math.PI / 2); // opening now faces +z
  const shade = new THREE.Mesh(shadeGeo, metal);
  headGroup.add(shade);
  const innerMat = new THREE.MeshStandardMaterial({
    color: '#f3e6d0',
    emissive: '#ffcf8f',
    emissiveIntensity: 0,
    roughness: 0.6,
    side: THREE.BackSide,
  });
  const inner = new THREE.Mesh(shadeGeo.clone().scale(0.97, 0.97, 0.99), innerMat);
  headGroup.add(inner);

  const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0, 0, 0) });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 32, 16), bulbMat);
  bulb.position.z = 0.035;
  headGroup.add(bulb);

  const spot = new THREE.SpotLight('#ffc27a', 0, 0, 0.8, 0.9, 2);
  spot.position.set(0, 0, 0.05);
  spot.castShadow = true;
  spot.shadow.mapSize.set(2048, 2048);
  spot.shadow.camera.near = 0.05;
  spot.shadow.camera.far = 3;
  spot.shadow.bias = -0.0003;
  spot.shadow.normalBias = 0.003;
  spot.shadow.radius = 6;
  spot.shadow.blurSamples = 20;
  headGroup.add(spot);
  const target = new THREE.Object3D();
  target.position.set(0, 0, 1);
  headGroup.add(target);
  spot.target = target;

  // lights the inside of the shade
  const glow = new THREE.PointLight('#ffb766', 0, 0.25, 2);
  glow.position.z = 0.03;
  headGroup.add(glow);

  enableShadows(root);
  // the shade must not block its own light
  shade.castShadow = inner.castShadow = bulb.castShadow = false;
  root.add(contactShadow(0.22, 0.22, 0.8));

  return { root, headGroup, spot, glow, bulbMat, innerMat, button, beamLength: head.distanceTo(aim) * 1.08 };
}

/* ------------------------------------------------------------------ books */

export function createBooks() {
  const root = new THREE.Group();
  const pages = new THREE.MeshStandardMaterial({ color: '#e8dfcc', roughness: 0.95 });
  const books = [
    { w: 0.24, d: 0.17, h: 0.034, color: '#2f4a3a' },
    { w: 0.22, d: 0.155, h: 0.026, color: '#6b2a2a' },
    { w: 0.2, d: 0.14, h: 0.03, color: '#1f2d45' },
  ];
  let y = 0;
  books.forEach((b, i) => {
    const cloth = new THREE.MeshStandardMaterial({ color: b.color, roughness: 0.78 });
    // material order: +x, -x (spine), +y, -y, +z, -z
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(b.w, b.h, b.d, 2, 0.002), [pages, cloth, cloth, cloth, pages, pages]);
    mesh.position.set((i - 1) * 0.008, y + b.h / 2, (i % 2) * 0.006);
    mesh.rotation.y = (i - 1) * 0.07;
    y += b.h;
    root.add(mesh);
  });
  enableShadows(root);
  root.add(contactShadow(0.32, 0.24, 0.7));
  return root;
}

/* ------------------------------------------------------------------ candle */

export function flameTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 92, 2, 32, 80, 60);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.25, 'rgba(255,210,120,0.95)');
  g.addColorStop(0.6, 'rgba(255,120,30,0.35)');
  g.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(32, 4);
  ctx.bezierCurveTo(52, 50, 58, 90, 32, 124);
  ctx.bezierCurveTo(6, 90, 12, 50, 32, 4);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

export function createCandle() {
  const root = new THREE.Group();
  const jar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.034, 0.075, 48, 1, true),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }),
  );
  jar.position.y = 0.0375;
  root.add(jar);
  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.045, 48),
    new THREE.MeshPhysicalMaterial({ color: '#f1e4cf', roughness: 0.55, emissive: '#ff9a40', emissiveIntensity: 0.18 }),
  );
  wax.position.y = 0.0225;
  wax.castShadow = true;
  root.add(wax);
  const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.008, 6), new THREE.MeshBasicMaterial({ color: '#111' }));
  wick.position.y = 0.049;
  root.add(wick);

  const flame = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: flameTexture(), color: new THREE.Color(5, 3.6, 2.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  flame.center.set(0.5, 0.05);
  flame.position.y = 0.05;
  flame.raycast = () => {};
  root.add(flame);

  const light = new THREE.PointLight('#ff9b4a', 0, 1.6, 2);
  light.position.y = 0.08;
  root.add(light);

  root.add(contactShadow(0.11, 0.11, 0.6));
  let on = 0;
  return {
    root,
    fx: [flame],
    /** top of the wick, in root space */
    wickTop: new THREE.Vector3(0, 0.053, 0),
    setOn(v: number) {
      on = v;
    },
    update(time: number) {
      const f = 0.86 + Math.sin(time * 9.1) * 0.05 + Math.sin(time * 23.7) * 0.035 + Math.sin(time * 3.3) * 0.06;
      light.intensity = 0.09 * f * on;
      flame.scale.set(0.011 * (0.94 + (f - 0.86) * 0.7) * on, 0.026 * f * on + 0.0001, 1);
      flame.position.x = Math.sin(time * 2.1) * 0.0008;
    },
  };
}

/* ------------------------------------------------------------------ smoke wisps */

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** A thin curl of smoke, e.g. from a snuffed wick or a shaken-out match. World-space particles. */
export function createSmoke(count = 36) {
  const group = new THREE.Group();
  const map = smokeTexture();
  const parts = Array.from({ length: count }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: '#9a9088', transparent: true, opacity: 0, depthWrite: false }));
    s.raycast = () => {};
    s.scale.setScalar(0.0001);
    group.add(s);
    return { s, age: 0, life: 0, origin: new THREE.Vector3(), seed: 0, strength: 0 };
  });
  let next = 0;
  const sources: { pos: THREE.Vector3; until: number; acc: number; strength: number }[] = [];
  let clock = 0;

  function spawn(pos: THREE.Vector3, strength: number) {
    const p = parts[next++ % count];
    p.age = 0;
    p.life = 2.2 + Math.random() * 1.2;
    p.origin.copy(pos);
    p.seed = Math.random() * 100;
    p.strength = strength;
  }

  return {
    group,
    /** emit a rising wisp from `pos` for `seconds` */
    puff(pos: THREE.Vector3, seconds: number, strength = 1) {
      sources.push({ pos: pos.clone(), until: clock + seconds, acc: 0, strength });
    },
    update(dt: number) {
      clock += dt;
      for (let i = sources.length - 1; i >= 0; i--) {
        const src = sources[i];
        const left = src.until - clock;
        if (left <= 0) {
          sources.splice(i, 1);
          continue;
        }
        src.acc += dt * 16;
        while (src.acc >= 1) {
          src.acc -= 1;
          spawn(src.pos, src.strength * Math.min(1, left / 0.8));
        }
      }
      for (const p of parts) {
        if (p.age >= p.life) {
          p.s.material.opacity = 0;
          continue;
        }
        p.age += dt;
        const t = p.age / p.life;
        const rise = 0.16 * t + 0.02 * t * t;
        const sway = Math.sin(p.seed + p.age * 2.3) * 0.012 * t + Math.sin(p.seed * 1.7 + p.age * 5.1) * 0.004 * t;
        p.s.position.set(p.origin.x + sway, p.origin.y + rise, p.origin.z + Math.cos(p.seed + p.age * 1.9) * 0.008 * t);
        p.s.scale.setScalar(0.006 + 0.05 * t);
        p.s.material.opacity = 0.2 * p.strength * Math.min(1, t * 8) * (1 - t) * (1 - t);
        p.s.material.rotation = p.seed + t * 1.5;
      }
    },
  };
}
