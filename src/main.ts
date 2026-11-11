import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { projects } from './data';
import {
  type Action,
  DISPLAY,
  LAPTOP,
  createBusinessCard,
  createDesk,
  createFolder,
  createLaptop,
  createMug,
  createPaperStack,
  createPen,
  createStickyNote,
} from './objects';
import { createBooks, createCandle, createLamp } from './cozy';
import { createBokehBackdrop, createDust, createLightShaft, createPipeline, createSteam } from './fx';
import { UI } from './ui';

const BASE = import.meta.env.BASE_URL;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = matchMedia('(pointer: coarse)').matches;

type State = 'loading' | 'intro' | 'desk' | 'zooming' | 'laptop' | 'doc';
let state: State = 'loading';

/* ------------------------------------------------------------------ renderer */

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
RectAreaLightUniformsLib.init();

const scene = new THREE.Scene();
scene.background = new THREE.Color('#050404');
scene.fog = new THREE.Fog('#070605', 1.7, 3.8);
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.01, 20);

/* ------------------------------------------------------------------ UI */

const ui = new UI({
  onExitLaptop: () => exitLaptop(),
  onPanelClosed: () => putDocumentBack(),
});

/* ------------------------------------------------------------------ loading */

const manager = new THREE.LoadingManager();
manager.onProgress = (_url, loaded, total) => ui.setProgress((loaded / total) * 0.9);
const texLoader = new THREE.TextureLoader(manager);
const load = (p: string) => texLoader.loadAsync(BASE + p);

async function fontsReady() {
  const wanted = ['700 40px Inter', '500 20px Inter', '800 40px Inter', 'italic 40px "Source Serif 4"', '400 40px "Source Serif 4"', '400 20px "JetBrains Mono"', '600 40px Caveat'];
  await Promise.race([Promise.all(wanted.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 3000))]);
}

const [hdr, diff, nor, rough] = await Promise.all([
  new HDRLoader(manager).loadAsync(BASE + 'hdri/studio.hdr'),
  load('tex/oak_diff.jpg'),
  load('tex/oak_nor.jpg'),
  load('tex/oak_rough.jpg'),
  fontsReady(),
]);

/* ------------------------------------------------------------------ light: a dark room, one lamp, one candle, one screen */

hdr.mapping = THREE.EquirectangularReflectionMapping;
scene.environment = hdr; // only for subtle reflections on metal and lacquer
scene.environmentIntensity = 0;
scene.environmentRotation.y = 1.2;

// cool moonlight from a window at the back right: separates silhouettes from the dark
const moon = new THREE.DirectionalLight('#8eaeff', 0);
moon.position.set(1.6, 1.3, -1.4);
scene.add(moon);

const LIGHT = { lamp: 1.15, moon: 0.32, env: 0.07, screen: 1.6 };

/* ------------------------------------------------------------------ objects */

scene.add(createDesk({ diff, nor, rough }));
const backdrop = createBokehBackdrop();
scene.add(backdrop);

const laptop = createLaptop(renderer);
const screenLight = new THREE.RectAreaLight('#a8c6ff', 0, DISPLAY.w, DISPLAY.h);
screenLight.position.set(0, LAPTOP.D / 2 + DISPLAY.yOffset, 0.004);
screenLight.rotation.y = Math.PI; // RectAreaLight emits along its -z; the display faces +z
laptop.lid.add(screenLight);

const lamp = createLamp(0.62);
const shaftRadius = Math.tan(lamp.spot.angle * 0.5) * lamp.beamLength;
const shaft = createLightShaft(lamp.beamLength, shaftRadius);
const dust = createDust(lamp.beamLength, shaftRadius);
lamp.headGroup.add(shaft.mesh, dust.points);

const candle = createCandle();
const steam = createSteam();

const interactive: THREE.Object3D[] = [laptop.root];
const isPortrait = () => camera.aspect < 0.9;

const featured = projects.filter((p) => p.onDesk);
const folderProject = featured.find((p) => p.onDesk === 'folder');
const paperProjects = featured.filter((p) => p.onDesk === 'paper').slice(0, 2);

const items: Record<string, THREE.Object3D> = { laptop: laptop.root, lamp: lamp.root, candle: candle.root, books: createBooks() };
if (folderProject) items.folder = createFolder(folderProject, renderer);
paperProjects.forEach((p, i) => (items[`paper${i}`] = createPaperStack(p, renderer, i === 0 ? 3 : 2)));
items.mug = createMug();
items.mug.add(steam.group);
items.card = createBusinessCard(renderer);
items.pen = createPen();
items.note = createStickyNote(renderer, ['open the', 'laptop :)']);
for (const o of Object.values(items)) {
  scene.add(o);
  if (o.userData.action && o !== laptop.root) interactive.push(o);
}

/** [x, z, rotationY, y]. Landscape spreads things around the laptop; portrait stacks them below it. Missing = hidden. */
type Spot = [number, number, number, number?];
const LAYOUTS: Record<'landscape' | 'portrait', Record<string, Spot>> = {
  landscape: {
    laptop: [0, -0.06, 0],
    lamp: [-0.52, -0.56, -0.86],
    folder: [-0.44, 0.07, 0.2],
    paper0: [0.47, -0.03, -0.24],
    paper1: [0.25, 0.21, 0.3, 0.0035],
    mug: [-0.29, -0.25, -0.7],
    books: [0.56, -0.4, 0.24],
    candle: [0.31, -0.33, 0],
    card: [-0.15, 0.25, -0.22],
    pen: [0.04, 0.23, 0.42],
    note: [-0.22, 0.08, 0.18],
  },
  portrait: {
    laptop: [0, -0.14, 0],
    lamp: [-0.3, -0.6, -1.0],
    folder: [-0.13, 0.27, 0.1],
    paper0: [0.15, 0.25, -0.1, 0.0035],
    paper1: [0.03, 0.6, 0.07, 0.006],
    mug: [0.22, -0.4, -0.7],
    candle: [0.25, -0.17, 0],
    card: [-0.24, 0.04, 0.5],
    pen: [0.25, 0.06, 1.2],
    note: [-0.25, -0.3, 0.2],
  },
};

let currentLayout = '';
function applyLayout() {
  const name = isPortrait() ? 'portrait' : 'landscape';
  if (name === currentLayout) return;
  currentLayout = name;
  for (const [k, o] of Object.entries(items)) {
    const spot = LAYOUTS[name][k];
    o.visible = !!spot;
    if (!spot) continue;
    const [x, z, r, y = 0] = spot;
    gsap.killTweensOf(o.position);
    gsap.killTweensOf(o.rotation);
    o.position.set(x, y, z);
    o.rotation.set(0, r, 0);
    o.userData.baseY = y;
    delete o.userData.rest;
  }
}

/* ------------------------------------------------------------------ post-processing */

const pipeline = createPipeline(renderer, scene, camera, [shaft.mesh, dust.points, steam.group, backdrop, ...candle.fx], !isTouch);

/* ------------------------------------------------------------------ camera framing */

const HOME_TARGET = new THREE.Vector3();
const HOME_DIR = new THREE.Vector3();
const camTarget = new THREE.Vector3();

/** Landscape: low and photographic. Portrait phones: look down more so the column of objects fits. */
function updateHome() {
  const portrait = isPortrait();
  HOME_DIR.set(0, portrait ? 0.93 : 0.44, portrait ? 0.36 : 0.9).normalize();
  HOME_TARGET.set(0, portrait ? 0.03 : 0.08, portrait ? 0.17 : -0.07);
}

function homeDistance() {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const [needW, needH] = isPortrait() ? [0.68, 1.24] : [1.26, 0.62];
  return Math.max(needW / 2 / Math.tan(hfov / 2), needH / 2 / Math.tan(vfov / 2));
}
const homePosition = () => HOME_TARGET.clone().addScaledVector(HOME_DIR, homeDistance());

/** Camera pose that makes the laptop display fill the viewport. */
function laptopPose() {
  const center = new THREE.Vector3();
  laptop.display.getWorldPosition(center);
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(laptop.display.getWorldQuaternion(new THREE.Quaternion()));
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const margin = innerWidth < 700 ? 1.0 : 1.12;
  const d = Math.max(DISPLAY.h / 2 / Math.tan(vfov / 2), DISPLAY.w / 2 / Math.tan(hfov / 2)) * margin;
  return { position: center.clone().addScaledVector(normal, d), target: center };
}

/** Where the display is on screen, in CSS pixels. */
function displayRect() {
  const pts = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const v = new THREE.Vector3((sx * DISPLAY.w) / 2, (sy * DISPLAY.h) / 2, 0);
    laptop.display.localToWorld(v).project(camera);
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
  });
  const xs = pts.map((c) => c.x), ys = pts.map((c) => c.y);
  const l = Math.min(...xs), t = Math.min(...ys);
  return new DOMRect(l, t, Math.max(...xs) - l, Math.max(...ys) - t);
}

updateHome();
applyLayout();
camTarget.copy(HOME_TARGET);
camera.position.copy(homePosition());
camera.lookAt(camTarget);

/* ------------------------------------------------------------------ lamp & screen levels */

const level = { lamp: 0, screen: 0, ambient: 0, candle: 0 };
const bulbHot = new THREE.Color('#ffd7a0').multiplyScalar(14);
function applyLevels() {
  const l = level.lamp;
  lamp.spot.intensity = LIGHT.lamp * l;
  lamp.glow.intensity = 0.25 * l;
  lamp.bulbMat.color.copy(bulbHot).multiplyScalar(l);
  lamp.innerMat.emissiveIntensity = 0.8 * l;
  shaft.mat.uniforms.uIntensity.value = 0.13 * l;
  dust.mat.uniforms.uIntensity.value = 0.9 * l;
  laptop.screenMat.emissiveIntensity = 1.0 * level.screen;
  screenLight.intensity = LIGHT.screen * level.screen;
  // in the portrait layout the documents sit outside the lamp pool, so lift the ambient a little
  const fill = isPortrait() ? 2.4 : 1;
  moon.intensity = LIGHT.moon * level.ambient * fill;
  scene.environmentIntensity = LIGHT.env * level.ambient * fill;
  candle.setOn(level.candle);
}
applyLevels();

/* ------------------------------------------------------------------ pointer, hover, parallax */

const pointer = new THREE.Vector2(9, 9);
const parallax = new THREE.Vector2();
const parallaxSmooth = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let hovered: THREE.Object3D | null = null;
let lifted: THREE.Object3D | null = null;

function actionRoot(o: THREE.Object3D | null): THREE.Object3D | null {
  while (o) {
    if (o.userData.action) return o;
    o = o.parent;
  }
  return null;
}

function pick(clientX: number, clientY: number) {
  pointer.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(interactive, true)[0];
  return hit ? actionRoot(hit.object) : null;
}

function labelFor(a: Action) {
  if (a.type === 'laptop') return 'Open the laptop';
  if (a.type === 'about') return 'About me · contact';
  return `${a.project.title} — pick up`;
}

function setHovered(root: THREE.Object3D | null, x = 0, y = 0) {
  if (root !== hovered) {
    if (hovered && hovered !== laptop.root && hovered !== lifted) {
      gsap.to(hovered.position, { y: hovered.userData.baseY, duration: 0.7, ease: 'sine.inOut' });
      gsap.to(hovered.rotation, { z: 0, duration: 0.7, ease: 'sine.inOut' });
    }
    hovered = root;
    if (root && root !== laptop.root) {
      gsap.to(root.position, { y: root.userData.baseY + 0.012, duration: 0.7, ease: 'sine.out' });
      gsap.to(root.rotation, { z: 0.025, duration: 0.9, ease: 'sine.out' });
    }
  }
  canvas.style.cursor = root ? 'pointer' : 'default';
  ui.setTooltip(root && !isTouch ? labelFor(root.userData.action) : null, x, y);
}

canvas.addEventListener('pointermove', (e) => {
  parallax.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  if (state !== 'desk') return;
  setHovered(pick(e.clientX, e.clientY), e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => {
  parallax.set(0, 0);
  if (state === 'desk') setHovered(null);
});

let downAt = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (state !== 'desk') return;
  if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
  const root = pick(e.clientX, e.clientY);
  if (!root) return;
  const a = root.userData.action as Action;
  setHovered(null);
  if (a.type === 'laptop') enterLaptop();
  else pickUpDocument(root, a);
});

/* ------------------------------------------------------------------ transitions */

/** Camera move with a soft ease; the look-at point travels on its own slightly lagging curve. */
function flyCamera(toPos: THREE.Vector3, toTarget: THREE.Vector3, duration: number, onComplete?: () => void) {
  const fromPos = camera.position.clone();
  const fromTarget = camTarget.clone();
  const p = { t: 0, u: 0 };
  const d = reducedMotion ? 0.01 : duration;
  const tl = gsap.timeline({ onComplete });
  tl.to(p, { t: 1, duration: d, ease: 'power3.inOut' }, 0);
  tl.to(p, { u: 1, duration: d * 0.92, ease: 'power2.inOut' }, d * 0.04);
  tl.eventCallback('onUpdate', () => {
    camera.position.lerpVectors(fromPos, toPos, p.t);
    camTarget.lerpVectors(fromTarget, toTarget, p.u);
    camera.lookAt(camTarget);
  });
  return tl;
}

function enterLaptop() {
  state = 'zooming';
  ui.setHint(false);
  const pose = laptopPose();
  flyCamera(pose.position, pose.target, 2.1, () => {
    state = 'laptop';
    // settle on the exact final pose before measuring the display: the loop stops rendering in this state
    camera.position.copy(pose.position);
    camTarget.copy(pose.target);
    camera.lookAt(camTarget);
    camera.updateMatrixWorld();
    pipeline.render(performance.now() / 1000);
    ui.showOS(innerWidth < 700 ? null : displayRect());
  });
}

function exitLaptop() {
  if (state !== 'laptop') return;
  ui.hideOS();
  state = 'zooming';
  flyCamera(homePosition(), HOME_TARGET, 1.9, () => {
    state = 'desk';
    ui.setHint(true);
  });
}

function pickUpDocument(root: THREE.Object3D, a: Action) {
  state = 'doc';
  lifted = root;
  root.userData.rest = { pos: root.position.clone(), rot: root.rotation.clone() };
  root.userData.rest.pos.y = root.userData.baseY ?? 0;
  root.userData.rest.rot.z = 0;
  const toCam = camera.position.clone().sub(root.position).multiplyScalar(0.22);
  const tl = gsap.timeline();
  tl.to(root.position, { y: 0.07, duration: 0.45, ease: 'power2.out' }, 0);
  tl.to(root.position, { x: root.position.x + toCam.x, z: root.position.z + toCam.z, duration: 1.1, ease: 'power3.inOut' }, 0.05);
  tl.to(root.position, { y: 0.12, duration: 0.7, ease: 'sine.inOut' }, 0.45);
  tl.to(root.rotation, { x: 0.62, duration: 1.1, ease: 'sine.inOut' }, 0.05);
  tl.to(root.rotation, { z: -0.04, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: 1 }, 0.1);
  tl.call(() => (a.type === 'project' ? ui.openProject(a.project) : ui.openAbout()), [], 0.6);
}

function putDocumentBack() {
  if (!lifted) return;
  const root = lifted;
  const rest = root.userData.rest as { pos: THREE.Vector3; rot: THREE.Euler };
  const tl = gsap.timeline({
    onComplete: () => {
      lifted = null;
      state = 'desk';
    },
  });
  tl.to(root.position, { x: rest.pos.x, z: rest.pos.z, duration: 1.0, ease: 'power3.inOut' }, 0);
  tl.to(root.position, { y: rest.pos.y, duration: 1.0, ease: 'power2.in' }, 0);
  tl.to(root.rotation, { x: rest.rot.x, z: 0, duration: 0.95, ease: 'sine.inOut' }, 0);
}

/* ------------------------------------------------------------------ resize */

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  updateHome();
  if (state === 'desk') applyLayout();
  applyLevels();
  renderer.setSize(innerWidth, innerHeight);
  pipeline.setSize(innerWidth, innerHeight);
  dust.mat.uniforms.uScale.value = innerHeight * Math.min(devicePixelRatio, 1.5);
  if (state === 'laptop') {
    const pose = laptopPose();
    camera.position.copy(pose.position);
    camTarget.copy(pose.target);
    camera.lookAt(camTarget);
    pipeline.render(performance.now() / 1000);
    ui.showOS(innerWidth < 700 ? null : displayRect());
  }
});

/* ------------------------------------------------------------------ loop */

const tmp = new THREE.Vector3();
const ZERO2 = new THREE.Vector2();
const forward = new THREE.Vector3();
const attention = new THREE.Vector3();
let focusDepth = homeDistance();
let frames = 0, slowFrames = 0, last = performance.now(), degraded = false;

renderer.setAnimationLoop(() => {
  const now = performance.now();
  const time = now / 1000;
  const dt = now - last;
  last = now;
  if (state === 'laptop') return; // the HTML OS covers the screen and nothing moves

  if (state === 'desk' || state === 'doc') {
    // soft parallax + a slow handheld "breathing" drift
    parallaxSmooth.lerp(state === 'desk' && !reducedMotion ? parallax : ZERO2, 0.035);
    const right = new THREE.Vector3().crossVectors(HOME_DIR, camera.up).normalize().negate();
    const breathe = reducedMotion ? 0 : 1;
    camera.position
      .copy(homePosition())
      .addScaledVector(right, parallaxSmooth.x * 0.045 + Math.sin(time * 0.31) * 0.004 * breathe)
      .addScaledVector(camera.up, -parallaxSmooth.y * 0.028 + Math.sin(time * 0.23 + 1) * 0.003 * breathe);
    // the eye drifts a little toward what you're pointing at
    attention.copy(HOME_TARGET);
    if (hovered && hovered !== laptop.root) attention.lerp(hovered.position, 0.12);
    camTarget.lerp(attention, 0.03);
    camera.lookAt(camTarget);
  }

  // rack focus: on the lifted document, otherwise on what the camera looks at
  camera.getWorldDirection(forward);
  const focusPoint = lifted ? lifted.position : camTarget;
  focusDepth += (tmp.copy(focusPoint).sub(camera.position).dot(forward) - focusDepth) * 0.07;
  pipeline.setFocus(focusDepth);

  dust.mat.uniforms.uTime.value = time;
  steam.update(time);
  candle.update(time);
  pipeline.render(time);

  // adaptive quality: if the first seconds after the intro are slow, drop the heaviest passes
  if (state === 'desk' && !degraded && frames < 120) {
    frames++;
    if (dt > 34) slowFrames++;
    if (frames === 120 && slowFrames > 60) {
      degraded = true;
      pipeline.degrade();
    }
  }
});

if (location.search.includes('debug')) {
  Object.assign(window, { __dbg: { camera, camTarget, getState: () => state, displayRect, laptopPose } });
}

/* ------------------------------------------------------------------ cinematic intro */

ui.setProgress(1);
renderer.compile(scene, camera);
pipeline.render(0);
ui.hideLoader();
state = 'intro';

const end = homePosition();
const start = HOME_TARGET.clone()
  .addScaledVector(new THREE.Vector3(-0.28, 0.42, 0.86).normalize(), homeDistance() * 1.45);
camera.position.copy(start);
camTarget.copy(HOME_TARGET).add(new THREE.Vector3(0, 0.05, 0));
camera.lookAt(camTarget);
laptop.lid.rotation.x = 1.5;

const k = reducedMotion ? 0.01 : 1;
const intro = gsap.timeline({
  onUpdate: applyLevels,
  onComplete: () => {
    state = 'desk';
    ui.setHint(true);
  },
});
intro.to(pipeline.grade.uniforms.uFade, { value: 1, duration: 2.4 * k, ease: 'sine.inOut' }, 0);
intro.to(level, { ambient: 1, duration: 3 * k, ease: 'sine.inOut' }, 0);
intro.to(level, { candle: 1, duration: 1.6 * k, ease: 'sine.out' }, 0.3 * k);
intro.add(flyCamera(end, HOME_TARGET, 5.2 * k), 0.1 * k);
// lamp clicks on with a little tungsten flicker
intro.to(level, { lamp: 0.55, duration: 0.05 * k }, 1.1 * k);
intro.to(level, { lamp: 0.08, duration: 0.07 * k }, 1.16 * k);
intro.to(level, { lamp: 0.85, duration: 0.05 * k }, 1.26 * k);
intro.to(level, { lamp: 0.35, duration: 0.09 * k }, 1.33 * k);
intro.to(level, { lamp: 1, duration: 0.6 * k, ease: 'sine.out' }, 1.45 * k);
intro.to(laptop.lid.rotation, { x: LAPTOP.openAngle, duration: 2.2 * k, ease: 'power2.inOut' }, 2.3 * k);
intro.to(level, { screen: 1.25, duration: 0.25 * k, ease: 'power2.in' }, 4.2 * k);
intro.to(level, { screen: 1, duration: 0.9 * k, ease: 'sine.out' }, 4.45 * k);
intro.call(() => ui.showTitle(), [], 1.6 * k);
intro.call(() => ui.endIntro(), [], 4.9 * k);
