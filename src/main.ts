import './style.css';
import * as THREE from 'three';
import gsap from 'gsap';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { projects } from './data';
import {
  type Action,
  type DocPlane,
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
import { createBooks, createCandle, createLamp, createSmoke } from './cozy';
import { createHand, POSES } from './hand';
import { createDust, createLightShaft, createPipeline, createSteam } from './fx';
import { createRoom } from './room';
import { UI } from './ui';

const BASE = import.meta.env.BASE_URL;
// With "reduce motion" on (e.g. Windows animation effects off) only the ambient motion — handheld drift and mouse parallax — is dropped.
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  onPanelClosed: () => closeDocument(),
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

// cool light from the homelab screens and LEDs at the back right: separates silhouettes from the dark
const moon = new THREE.DirectionalLight('#8eaeff', 0);
moon.position.set(1.6, 1.3, -1.4);
scene.add(moon);

const LIGHT = { lamp: 1.15, moon: 0.32, env: 0.07, screen: 1.6, spill: 0.18 };

/* ------------------------------------------------------------------ objects */

scene.add(createDesk({ diff, nor, rough }));
// the desk stands against a wall; its back half is a small homelab
const room = createRoom(hdr);
scene.add(room.group);

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
// light leaking out of the back of the shade: a warm halo on the wall behind the lamp
const spill = new THREE.PointLight('#ffb36b', 0, 1.6, 2);
spill.position.set(0, 0.12, -0.22);
lamp.headGroup.add(spill);
shaft.mesh.raycast = dust.points.raycast = () => {}; // the beam must not count as "the lamp" for clicks
lamp.root.userData.action = { type: 'lamp' } satisfies Action;

const candle = createCandle();
candle.root.userData.action = { type: 'candle' } satisfies Action;
const smoke = createSmoke();
const hand = createHand();
scene.add(smoke.group, hand.root);
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

const pipeline = createPipeline(renderer, scene, camera, [shaft.mesh, dust.points, steam.group, ...room.fx, smoke.group, ...candle.fx, ...hand.fx], !isTouch);

/* ------------------------------------------------------------------ camera framing */

const UP = new THREE.Vector3(0, 1, 0);
const HOME_TARGET = new THREE.Vector3();
const HOME_DIR = new THREE.Vector3();

/** Landscape: low and photographic. Portrait phones: look down more so the column of objects fits. */
function updateHome() {
  const portrait = isPortrait();
  HOME_DIR.set(0, portrait ? 0.93 : 0.44, portrait ? 0.36 : 0.9).normalize();
  HOME_TARGET.set(0, portrait ? 0.03 : 0.08, portrait ? 0.17 : -0.07);
}

function fovs() {
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  return { vfov, hfov: 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect) };
}

function homeDistance() {
  const { vfov, hfov } = fovs();
  const [needW, needH] = isPortrait() ? [0.68, 1.24] : [1.26, 0.62];
  return Math.max(needW / 2 / Math.tan(hfov / 2), needH / 2 / Math.tan(vfov / 2));
}

interface Pose {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
}

const homePose = (): Pose => ({
  pos: HOME_TARGET.clone().addScaledVector(HOME_DIR, homeDistance()),
  target: HOME_TARGET.clone(),
  up: UP.clone(),
});

/** Distance at which a w×h rectangle fills the view (times margin). */
function fitDistance(w: number, h: number, margin: number) {
  const { vfov, hfov } = fovs();
  return Math.max(h / 2 / Math.tan(vfov / 2), w / 2 / Math.tan(hfov / 2)) * margin;
}

/** Camera pose that makes the laptop display fill the viewport. */
function laptopPose(): Pose {
  const center = laptop.display.getWorldPosition(new THREE.Vector3());
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(laptop.display.getWorldQuaternion(new THREE.Quaternion()));
  const d = fitDistance(DISPLAY.w, DISPLAY.h, innerWidth < 700 ? 1.0 : 1.12);
  return { pos: center.clone().addScaledVector(normal, d), target: center, up: UP.clone() };
}

/** Camera straight above a document, rolled so the page reads upright and fills the view. */
function docPose(plane: DocPlane, margin: number): Pose {
  plane.mesh.updateWorldMatrix(true, false);
  const center = plane.mesh.getWorldPosition(new THREE.Vector3());
  const pageUp = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.mesh.getWorldQuaternion(new THREE.Quaternion()));
  pageUp.y = 0;
  pageUp.normalize();
  const d = fitDistance(plane.w, plane.h, margin);
  return { pos: center.clone().addScaledVector(UP, d), target: center, up: pageUp };
}
const docMargin = (aligned: boolean) => (aligned ? (innerWidth < 700 ? 1.04 : 1.12) : 3.2);

/** Screen-space rectangle (CSS px) of a w×h rectangle lying in a mesh's local XY ('xy') or XZ ('xz') plane. */
function projectRect(mesh: THREE.Object3D, w: number, h: number, plane: 'xy' | 'xz') {
  camera.updateMatrixWorld();
  mesh.updateWorldMatrix(true, false);
  const pts = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const v = plane === 'xy' ? new THREE.Vector3((sx * w) / 2, (sy * h) / 2, 0) : new THREE.Vector3((sx * w) / 2, 0, (sy * h) / 2);
    mesh.localToWorld(v).project(camera);
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
  });
  const xs = pts.map((c) => c.x), ys = pts.map((c) => c.y);
  const l = Math.min(...xs), t = Math.min(...ys);
  return new DOMRect(l, t, Math.max(...xs) - l, Math.max(...ys) - t);
}
const displayRect = () => projectRect(laptop.display, DISPLAY.w, DISPLAY.h, 'xy');

updateHome();
applyLayout();

/* ------------------------------------------------------------------ camera rig
   Tweens only ever move `rig` (the base pose). Living motion — parallax, handheld
   breathing, a glance toward the hovered object — is layered on top every frame,
   scaled by `rig.idle`, which flights fade out and back in. Nothing snaps. */

const rig = { pos: new THREE.Vector3(), target: new THREE.Vector3(), up: UP.clone(), idle: 0 };
function setRig(p: Pose) {
  rig.pos.copy(p.pos);
  rig.target.copy(p.target);
  rig.up.copy(p.up);
}
setRig(homePose());

let flight: gsap.core.Tween | null = null;
const smooth = (x: number) => {
  const t = THREE.MathUtils.clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Glide the camera to a pose along a gentle arc. The gaze leads the body a little, like a camera operator. */
function flyTo(to: Pose, duration: number, opts: { idle: number; arc?: number; ease?: string; onComplete?: () => void }) {
  flight?.kill();
  const from = { pos: rig.pos.clone(), target: rig.target.clone(), up: rig.up.clone(), idle: rig.idle };
  const ctrl = from.pos.clone().lerp(to.pos, 0.5).addScaledVector(UP, opts.arc ?? 0);
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  const p = { t: 0 };
  flight = gsap.to(p, {
    t: 1,
    duration, // camera moves are navigation, so they stay even with reduced motion
    ease: opts.ease ?? 'power2.inOut',
    onUpdate: () => {
      const t = p.t;
      // quadratic Bézier: from → ctrl → to
      a.lerpVectors(from.pos, ctrl, t);
      b.lerpVectors(ctrl, to.pos, t);
      rig.pos.lerpVectors(a, b, t);
      rig.target.lerpVectors(from.target, to.target, Math.min(1, t + 0.1 * Math.sin(Math.PI * t)));
      rig.up.copy(from.up).lerp(to.up, smooth(t)).normalize();
      rig.idle =
        opts.idle > from.idle
          ? from.idle + (opts.idle - from.idle) * smooth((t - 0.5) / 0.5)
          : from.idle * (1 - smooth(t / 0.35));
    },
    onComplete: opts.onComplete,
  });
  return flight;
}

/* ------------------------------------------------------------------ lamp & screen levels */

const level = { lamp: 0, screen: 0, ambient: 0, candle: 0 };
const bulbHot = new THREE.Color('#ffd7a0').multiplyScalar(14);
function applyLevels() {
  const l = level.lamp;
  lamp.spot.intensity = LIGHT.lamp * l;
  lamp.glow.intensity = 0.25 * l;
  spill.intensity = LIGHT.spill * l;
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
  room.setLevel(level.ambient);
}
applyLevels();

/* ------------------------------------------------------------------ pointer & hover */

const pointer = new THREE.Vector2(9, 9);
const parallax = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let hovered: THREE.Object3D | null = null;

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
  const root = hit ? actionRoot(hit.object) : null;
  return root?.userData.busy ? null : root;
}

function labelFor(root: THREE.Object3D) {
  const a = root.userData.action as Action;
  if (a.type === 'laptop') return 'Open the laptop';
  if (a.type === 'about') return 'About me · contact';
  if (a.type === 'candle') return 'Blow out the candle';
  if (a.type === 'lamp') return 'Switch off the lamp';
  return root.userData.cover ? `Open the ${a.project.title} file` : `Read · ${a.project.title}`;
}

function liftTo(root: THREE.Object3D, up: boolean) {
  gsap.to(root.position, { y: root.userData.baseY + (up ? 0.01 : 0), duration: 0.8, ease: 'sine.inOut', overwrite: 'auto' });
  gsap.to(root.rotation, { z: up ? 0.02 : 0, duration: 0.9, ease: 'sine.inOut', overwrite: 'auto' });
}

/** Papers, folder, mug and card lift a little on hover; the laptop and the lights stay put. */
const liftable = (o: THREE.Object3D | null): o is THREE.Object3D => !!o && o !== laptop.root && o !== lamp.root && o !== candle.root;

function setHovered(root: THREE.Object3D | null, x = 0, y = 0) {
  if (root !== hovered) {
    if (liftable(hovered)) liftTo(hovered, false);
    hovered = root;
    if (liftable(root)) liftTo(root, true);
  }
  canvas.style.cursor = root ? 'pointer' : 'default';
  ui.setTooltip(root && !isTouch ? labelFor(root) : null, x, y);
}

canvas.addEventListener('pointermove', (e) => {
  parallax.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
  if (state === 'desk') setHovered(pick(e.clientX, e.clientY), e.clientX, e.clientY);
});
canvas.addEventListener('pointerleave', () => {
  parallax.set(0, 0);
  if (state === 'desk') setHovered(null);
});

let downAt = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => (downAt = { x: e.clientX, y: e.clientY }));
canvas.addEventListener('pointerup', (e) => {
  if (state !== 'desk' || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
  const root = pick(e.clientX, e.clientY);
  if (!root) return;
  setHovered(null);
  const type = (root.userData.action as Action).type;
  if (type === 'laptop') enterLaptop();
  else if (type === 'candle') snuffCandle();
  else if (type === 'lamp') switchOffLamp();
  else openDocument(root);
});

/* ------------------------------------------------------------------ laptop */

function enterLaptop() {
  state = 'zooming';
  ui.setHint(false);
  const pose = laptopPose();
  flyTo(pose, 2.3, {
    idle: 0,
    arc: 0.04,
    onComplete: () => {
      state = 'laptop';
      setRig(pose);
      updateCamera(0);
      renderFrame(performance.now() / 1000);
      ui.showOS(innerWidth < 700 ? null : displayRect());
    },
  });
}

function exitLaptop() {
  if (state !== 'laptop') return;
  ui.hideOS();
  state = 'zooming';
  flyTo(homePose(), 2.1, { idle: 1, arc: 0.05, onComplete: backAtDesk });
}

function backAtDesk() {
  state = 'desk';
  ui.setHint(true);
}

/* ------------------------------------------------------------------ documents: fly onto the page, then read it in place */

let openDoc: { root: THREE.Object3D; plane: DocPlane; aligned: boolean } | null = null;

function openDocument(root: THREE.Object3D) {
  const a = root.userData.action as Action;
  // the mug and the card both lead to the business card
  const target = a.type === 'about' ? items.card : root;
  const plane = target.userData.docPlane as DocPlane;
  const aligned = a.type === 'project';
  state = 'doc';
  ui.setHint(false);
  // settle the hover lift; the pose is computed for the resting position
  gsap.killTweensOf(root.position);
  gsap.killTweensOf(root.rotation);
  gsap.to(root.position, { y: root.userData.baseY, duration: 0.6, ease: 'sine.inOut' });
  gsap.to(root.rotation, { z: 0, duration: 0.6, ease: 'sine.inOut' });
  const liveY = root.position.y, liveZ = root.rotation.z;
  root.position.y = root.userData.baseY;
  root.rotation.z = 0;
  const pose = docPose(plane, docMargin(aligned));
  root.position.y = liveY;
  root.rotation.z = liveZ;
  openDoc = { root, plane, aligned };

  const cover = target.userData.cover as THREE.Object3D | undefined;
  const tl = gsap.timeline();
  tl.add(
    flyTo(pose, 2.0, {
      idle: 0,
      arc: 0.06,
      onComplete: () => {
        setRig(pose);
        updateCamera(0);
        renderFrame(performance.now() / 1000);
        const rect = aligned ? projectRect(plane.mesh, plane.w, plane.h, 'xz') : null;
        if (a.type === 'project') ui.openProject(a.project, rect);
        else ui.openAbout(null);
      },
    }),
    0,
  );
  // a folder swings open while the camera settles over it
  if (cover) tl.to(cover.rotation, { z: Math.PI * 0.985, duration: 1.3, ease: 'power2.inOut' }, 0.75);
}

function closeDocument() {
  if (!openDoc) return;
  const cover = (openDoc.root.userData.cover ?? null) as THREE.Object3D | null;
  openDoc = null;
  state = 'zooming';
  if (cover) gsap.to(cover.rotation, { z: 0, duration: 1.1, ease: 'power2.inOut', delay: 0.1 });
  gsap.delayedCall(cover ? 0.35 : 0.1, () => flyTo(homePose(), 2.0, { idle: 1, arc: 0.06, onComplete: backAtDesk }));
}

/* ------------------------------------------------------------------ put a light out, and a hand puts it back
   The camera stays where it is: the hand comes in from off-frame, does its job and leaves. */

const xyz = (v: THREE.Vector3) => ({ x: v.x, y: v.y, z: v.z });
const Y = (d: number) => new THREE.Vector3(0, d, 0);

function snuffCandle() {
  if (candle.root.userData.busy) return;
  candle.root.userData.busy = true;
  const wick = candle.root.localToWorld(candle.wickTop.clone());
  // the arm comes from the right, a little in front of the books
  const side = new THREE.Vector3(1, 0, 0.45).normalize();
  hand.setPose(POSES.hold);
  hand.aim(side.clone().negate(), 0.35, 0.3, false);
  const contact = hand.rootFor(wick.clone().add(Y(0.008)).addScaledVector(side, 0.003), 'match', POSES.hold);
  const near = contact.clone().addScaledVector(side, 0.1).add(Y(0.07));
  const start = contact.clone().addScaledVector(side, 1.0).add(Y(0.2));
  const done = () => {
    hand.park();
    candle.root.userData.busy = false;
  };

  const tl = gsap.timeline({ onUpdate: applyLevels, onComplete: done });
  // the flame gutters and dies, a curl of smoke rises from the wick
  tl.to(level, { candle: 0.5, duration: 0.07 }, 0);
  tl.to(level, { candle: 0.75, duration: 0.06 });
  tl.to(level, { candle: 0, duration: 0.22, ease: 'power2.in' });
  tl.call(() => smoke.puff(wick, 1.8), [], 0.3);
  // a match is struck just out of frame: its glow arrives before the hand does
  tl.call(
    () => {
      hand.root.position.copy(start);
      hand.match.showMatch = 1;
      hand.match.charred = true;
    },
    [],
    1.5,
  );
  tl.to(hand.match, { lit: 2, duration: 0.1, ease: 'power2.out' }, 1.55);
  tl.to(hand.match, { lit: 1, duration: 0.6, ease: 'sine.out' }, 1.65);
  tl.to(hand.root.position, { ...xyz(near), duration: 1.8, ease: 'power3.out' }, 1.75);
  tl.to(hand.root.position, { ...xyz(contact), duration: 0.9, ease: 'sine.inOut' }, 3.45);
  // the wick catches
  tl.to(level, { candle: 0.3, duration: 0.25 }, 4.2);
  tl.to(level, { candle: 0.15, duration: 0.15 });
  tl.to(level, { candle: 1, duration: 1.0, ease: 'sine.out' });
  tl.to(hand.root.position, { ...xyz(near), duration: 0.8, ease: 'sine.inOut' }, 4.9);
  // shake the match out
  tl.to(hand.pose, { roll: POSES.hold.roll + 0.3, duration: 0.08, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 5.55);
  tl.to(hand.match, { lit: 0, duration: 0.2, ease: 'power2.in' }, 5.65);
  tl.call(() => smoke.puff(hand.matchHeadWorld(), 0.7, 0.6), [], 5.85);
  tl.to(hand.root.position, { ...xyz(start), duration: 1.6, ease: 'power2.in' }, 6.1);
}

function switchOffLamp() {
  if (lamp.root.userData.busy) return;
  lamp.root.userData.busy = true;
  const btnY = lamp.button.position.y;
  const press = (at: number, tl: gsap.core.Timeline) => {
    tl.to(lamp.button.position, { y: btnY - 0.002, duration: 0.06, ease: 'power2.in' }, at);
    tl.to(lamp.button.position, { y: btnY, duration: 0.12, ease: 'power2.out' }, at + 0.14);
  };
  const button = lamp.button.getWorldPosition(new THREE.Vector3()).add(Y(0.0035));
  // the arm comes from the left, slightly from the front: a left hand
  const side = new THREE.Vector3(-1, 0, 0.35).normalize();
  hand.setPose(POSES.relaxed);
  hand.aim(side.clone().negate(), 0.75, 0.35, true);
  const contact = hand.rootFor(button, 'index', POSES.point);
  const hover = contact.clone().add(Y(0.045)).addScaledVector(side, 0.025);
  const start = contact.clone().addScaledVector(side, 1.0).add(Y(0.25));
  const done = () => {
    hand.park();
    lamp.root.userData.busy = false;
  };

  const tl = gsap.timeline({ onUpdate: applyLevels, onComplete: done });
  // click: the filament dies with a little stutter
  press(0, tl);
  tl.to(level, { lamp: 0.35, duration: 0.04 }, 0.05);
  tl.to(level, { lamp: 0.6, duration: 0.05 });
  tl.to(level, { lamp: 0, duration: 0.16, ease: 'power2.in' });
  // someone reaches out of the dark for the switch
  tl.call(() => void hand.root.position.copy(start), [], 1.2);
  tl.to(hand.root.position, { ...xyz(hover), duration: 1.8, ease: 'power3.out' }, 1.25);
  tl.to(hand.pose, { ...POSES.point, duration: 1.1, ease: 'sine.inOut' }, 1.6);
  tl.to(hand.root.position, { ...xyz(contact), duration: 0.2, ease: 'power2.in' }, 3.15);
  press(3.3, tl);
  // the lamp flickers back on, as it did at the start
  tl.to(level, { lamp: 0.55, duration: 0.05 }, 3.38);
  tl.to(level, { lamp: 0.08, duration: 0.07 }, 3.44);
  tl.to(level, { lamp: 0.85, duration: 0.05 }, 3.54);
  tl.to(level, { lamp: 0.35, duration: 0.09 }, 3.61);
  tl.to(level, { lamp: 1, duration: 0.6, ease: 'sine.out' }, 3.73);
  tl.to(hand.root.position, { ...xyz(hover), duration: 0.45, ease: 'sine.out' }, 3.5);
  tl.to(hand.pose, { ...POSES.relaxed, duration: 1.0, ease: 'sine.inOut' }, 3.9);
  tl.to(hand.root.position, { ...xyz(start), duration: 1.6, ease: 'power2.in' }, 4.0);
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
  if (state === 'desk') setRig(homePose());
  if (state === 'laptop') {
    setRig(laptopPose());
    updateCamera(0);
    renderFrame(performance.now() / 1000);
    ui.showOS(innerWidth < 700 ? null : displayRect());
  }
  if (state === 'doc' && openDoc && ui.panelOpen) {
    setRig(docPose(openDoc.plane, docMargin(openDoc.aligned)));
    updateCamera(0);
    if (openDoc.aligned) ui.placeSheet(projectRect(openDoc.plane.mesh, openDoc.plane.w, openDoc.plane.h, 'xz'));
  }
});

/* ------------------------------------------------------------------ frame */

const parallaxSmooth = new THREE.Vector2();
const attention = new THREE.Vector3();
const attentionGoal = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const camUp = new THREE.Vector3();
const tmp = new THREE.Vector3();
let focusDepth = homeDistance();

/** Frame-rate independent exponential smoothing factor. */
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

function updateCamera(dt: number) {
  const time = performance.now() / 1000;
  const w = reducedMotion ? 0 : rig.idle;

  parallaxSmooth.lerp(parallax, damp(2.2, dt));
  attentionGoal.set(0, 0, 0);
  if (state === 'desk' && hovered && hovered !== laptop.root) attentionGoal.copy(hovered.position).sub(HOME_TARGET).multiplyScalar(0.08);
  attention.lerp(attentionGoal, damp(1.6, dt));

  fwd.copy(rig.target).sub(rig.pos).normalize();
  right.crossVectors(fwd, rig.up).normalize();
  camUp.crossVectors(right, fwd).normalize();

  camera.position
    .copy(rig.pos)
    .addScaledVector(right, (parallaxSmooth.x * 0.045 + Math.sin(time * 0.31) * 0.004) * w)
    .addScaledVector(camUp, (-parallaxSmooth.y * 0.028 + Math.sin(time * 0.23 + 1) * 0.003) * w);
  camera.up.copy(rig.up);
  lookAt.copy(rig.target).addScaledVector(attention, w);
  camera.lookAt(lookAt);
  camera.updateMatrixWorld();

  // rack focus on whatever the rig is looking at
  const depth = tmp.copy(rig.target).sub(camera.position).dot(fwd);
  focusDepth = dt === 0 ? depth : focusDepth + (depth - focusDepth) * damp(4, dt);
  pipeline.setFocus(focusDepth);
}

function renderFrame(time: number) {
  dust.mat.uniforms.uTime.value = time;
  steam.update(time);
  candle.update(time);
  hand.update(time);
  room.update(time, !reducedMotion);
  pipeline.render(time);
}

let frames = 0, slowFrames = 0, last = performance.now(), degraded = false;
const trace: number[][] | null = location.search.includes('debug') ? [] : null;

// Driven by GSAP's ticker so tweens update before the frame that draws them.
gsap.ticker.add(() => {
  const now = performance.now();
  const dtMs = now - last;
  last = now;
  if (state === 'laptop') return; // the HTML OS covers the screen and nothing moves
  updateCamera(Math.min(dtMs, 50) / 1000);
  smoke.update(Math.min(dtMs, 50) / 1000);
  renderFrame(now / 1000);
  if (trace) trace.push([Math.round(now), +camera.position.x.toFixed(4), +camera.position.y.toFixed(4), +camera.position.z.toFixed(4)]);

  // adaptive quality: if the first seconds at the desk are slow, drop the heaviest passes
  if (state === 'desk' && !degraded && frames < 120) {
    frames++;
    if (dtMs > 34) slowFrames++;
    if (frames === 120 && slowFrames > 60) {
      degraded = true;
      pipeline.degrade();
    }
  }
});

if (location.search.includes('debug')) {
  Object.assign(window, { __dbg: { camera, rig, trace, getState: () => state, displayRect, laptopPose, snuffCandle, switchOffLamp, hand } });
}

/* ------------------------------------------------------------------ cinematic intro */

ui.setProgress(1);
renderer.compile(scene, camera);
pipeline.render(0);
ui.hideLoader();
state = 'intro';

setRig({
  pos: HOME_TARGET.clone().addScaledVector(new THREE.Vector3(-0.28, 0.42, 0.86).normalize(), homeDistance() * 1.45),
  target: HOME_TARGET.clone().add(new THREE.Vector3(0, 0.05, 0)),
  up: UP.clone(),
});
rig.idle = 0;
updateCamera(0);
laptop.lid.rotation.x = 1.5;

const k = reducedMotion ? 0.6 : 1; // shorter intro, but still a real camera move
const intro = gsap.timeline({ onUpdate: applyLevels, onComplete: backAtDesk });
intro.to(pipeline.grade.uniforms.uFade, { value: 1, duration: 2.4 * k, ease: 'sine.inOut' }, 0);
intro.to(level, { ambient: 1, duration: 3 * k, ease: 'sine.inOut' }, 0);
intro.to(level, { candle: 1, duration: 1.6 * k, ease: 'sine.out' }, 0.3 * k);
intro.add(flyTo(homePose(), 5.4 * k, { idle: 1, ease: 'sine.inOut' }), 0.1 * k);
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
