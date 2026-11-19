import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { flameTexture } from './cozy';
import { loopSubdivideSkinned } from './subdivide';

/*
 * A forearm + hand in a knit sleeve, used to strike a match for the candle and to
 * press the lamp's switch.
 *
 * The hand is an anatomical skinned mesh (WebXR "generic-hand", MIT,
 * github.com/immersive-web/webxr-input-profiles). Its 25 joints are stored flat, the
 * way WebXR reports them, so the finger curls are solved here with a little forward
 * kinematics.
 *
 * Hand frame: the wrist is at the origin, fingers point along +x, the palm faces -y,
 * the thumb sits on the -z side (a right hand; mirror with scale.z = -1 for a left one).
 */

export interface HandPose {
  index: number;
  middle: number;
  ring: number;
  pinky: number;
  /** bend of the thumb's two outer joints */
  thumbCurl: number;
  /** thumb base (CMC joint), radians about its own axes: x flexes it into the palm,
   *  y swings it across the palm (opposition), z twists the pad to face the fingers */
  thumbX: number;
  thumbY: number;
  thumbZ: number;
  /** rotation about the forearm axis; ~1.2 turns the thumb up */
  roll: number;
}

export const POSES: Record<'relaxed' | 'point' | 'hold', HandPose> = {
  relaxed: { index: 0.2, middle: 0.27, ring: 0.33, pinky: 0.4, thumbCurl: 0.2, thumbX: -0.07, thumbY: -0.17, thumbZ: 0, roll: 0.25 },
  point: { index: 0.03, middle: 0.95, ring: 1.0, pinky: 1.0, thumbCurl: 0.6, thumbX: -0.21, thumbY: -0.47, thumbZ: 0, roll: 0.35 },
  // precision pinch: thumb and index pads meet 3.5 mm apart (a match's width), solved offline
  // against this skeleton; the middle finger rests behind the match, ring and pinky tuck in
  hold: { index: 0.65, middle: 0.75, ring: 0.95, pinky: 1.05, thumbCurl: 0.432, thumbX: -0.392, thumbY: 0.084, thumbZ: -0.322, roll: 1.15 },
};

/* ------------------------------------------------------------------ materials */

/*
 * Skin, procedurally, in 3D. The model has no skin textures and an unknown UV layout, so
 * all detail is computed from the bind-pose position (it stays glued to the skin as the
 * fingers bend) plus a few per-vertex anatomy attributes baked at load time:
 *
 *   aDetail.x  distance along the finger from the nearest knuckle (m)
 *   aDetail.y  how much that knuckle's crease applies on the back of the finger
 *   aDetail.z  the same on the palm side
 *   aDetail.w  redness (fingertips, knuckles, palm)
 *   aThin      how thin the flesh is (fingers glow red when back-lit)
 */
const SKIN_GLSL = /* glsl */ `
varying vec3 vBind;
varying vec3 vBindN;
varying vec4 vDetail;
varying float vThin;

float skHash( vec3 p ) {
	p = fract( p * 0.3183099 + 0.1 );
	p *= 17.0;
	return fract( p.x * p.y * p.z * ( p.x + p.y + p.z ) );
}
float skNoise( vec3 x ) {
	vec3 i = floor( x ), f = fract( x );
	f = f * f * ( 3.0 - 2.0 * f );
	return mix( mix( mix( skHash( i ), skHash( i + vec3( 1, 0, 0 ) ), f.x ), mix( skHash( i + vec3( 0, 1, 0 ) ), skHash( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
		mix( mix( skHash( i + vec3( 0, 0, 1 ) ), skHash( i + vec3( 1, 0, 1 ) ), f.x ), mix( skHash( i + vec3( 0, 1, 1 ) ), skHash( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}

// x: height (m), y: crease darkness, z: vein, w: fine-detail visibility
vec4 skinDetail() {
	vec3 p = vBind;
	// pixel footprint, to fade detail that would only alias at a distance
	float px = length( fwidth( vBind ) );
	float fine = 1.0 - smoothstep( 0.00025, 0.0009, px );
	float mid = 1.0 - smoothstep( 0.0006, 0.002, px );

	float h = 0.0;
	// pores, and the fine cellular relief of skin (ridged noise, no regular lines)
	h += ( skNoise( p * 2200.0 ) - 0.5 ) * 0.00003 * fine;
	float cells = abs( skNoise( p * 1100.0 ) * 2.0 - 1.0 ) * 0.6 + abs( skNoise( p * 1900.0 + 3.0 ) * 2.0 - 1.0 ) * 0.4;
	h -= pow( 1.0 - cells, 4.0 ) * 0.000022 * fine;

	// knuckle wrinkles on the back of the fingers: a few wavy, broken folds
	float t = vDetail.x;
	float wob = skNoise( p * 160.0 ) * 4.0 + skNoise( p * 520.0 ) * 1.2;
	float folds = 0.5 + 0.5 * sin( t * 3300.0 + wob );
	float broken = smoothstep( 0.25, 0.65, skNoise( p * 420.0 + 11.0 ) );
	float knuckle = vDetail.y * smoothstep( 0.007, 0.0, abs( t ) );
	h -= knuckle * pow( folds, 4.0 ) * broken * 0.00011 * mid;

	// palm-side flexion creases: two clean grooves either side of the joint
	float groove = exp( -pow( ( abs( t ) - 0.0016 ) / 0.00045, 2.0 ) );
	h -= vDetail.z * groove * 0.00028 * mid;

	// veins on the back of the hand, between the wrist and the knuckles
	float back = smoothstep( 0.2, 0.7, vBindN.x );
	float region = smoothstep( 0.065, 0.035, p.y ) * smoothstep( -0.035, -0.005, p.y );
	float vn = skNoise( vec3( p.x * 50.0, p.y * 18.0, p.z * 85.0 ) ) * 0.7 + skNoise( vec3( p.x * 90.0, p.y * 30.0, p.z * 150.0 ) ) * 0.3;
	// soft, broad and only slightly raised: a vein under the skin, not a line on it
	float vd = abs( vn - 0.5 ) / 0.13;
	float vein = exp( -vd * vd * 2.5 ) * back * region * smoothstep( 0.35, 0.6, skNoise( p * 40.0 + 5.0 ) );
	h += vein * 0.00009;

	float crease = knuckle * pow( folds, 4.0 ) * broken * 0.6 + vDetail.z * groove;
	return vec4( h, crease, vein, fine );
}
`;

/** Skin: physical material with procedural texture, wrap-around subsurface and back-lit glow. */
function skinMaterial() {
  const flat = new THREE.DataTexture(new Uint8Array([128, 128, 128, 255]), 1, 1);
  flat.needsUpdate = true;
  const m = new THREE.MeshPhysicalMaterial({
    color: '#c99c84',
    roughness: 0.6,
    bumpMap: flat, // only switches the bump path on; the height comes from skinDetail()
    bumpScale: 1,
    sheen: 0.22,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#ffb59a'),
    specularIntensity: 0.4,
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute vec4 aDetail;\nattribute float aThin;\nvarying vec3 vBind;\nvarying vec3 vBindN;\nvarying vec4 vDetail;\nvarying float vThin;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n\tvBind = position;\n\tvBindN = normal;\n\tvDetail = aDetail;\n\tvThin = aThin;',
      );

    const lights = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
      'reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );',
      `float skinNL = dot( geometryNormal, directLight.direction );
	float skinWrap = saturate( ( skinNL + 0.45 ) / 1.45 );
	vec3 skinScatter = vec3( 1.0, 0.42, 0.3 ) * max( skinWrap - saturate( skinNL ), 0.0 ) * 0.6;
	reflectedLight.directDiffuse += ( irradiance + skinScatter * directLight.color ) * diffuseBRDF * ( 1.0 - F );
	// light passing through thin flesh (fingers against a flame glow red)
	float skinBack = pow( saturate( dot( geometryViewDir, - directLight.direction ) ), 3.0 ) * vThin;
	reflectedLight.directDiffuse += directLight.color * vec3( 1.0, 0.25, 0.12 ) * skinBack * 0.45 * material.diffuseColor;`,
    );
    const bump = `
#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		float h = skinDetail().x * bumpScale;
		// slope = height change per metre of surface, which is what perturbNormalArb expects
		vec3 dpx = dFdx( vViewPosition ), dpy = dFdy( vViewPosition );
		return vec2( dFdx( h ) / max( length( dpx ), 1e-7 ), dFdy( h ) / max( length( dpy ), 1e-7 ) );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`;
    shader.fragmentShader = (SKIN_GLSL + shader.fragmentShader)
      .replace('#include <lights_physical_pars_fragment>', lights)
      .replace('#include <bumpmap_pars_fragment>', bump)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
	{
		vec4 sd = skinDetail();
		// blotchy warmth, a little sallow here and there, pinker where blood is close
		float mott = skNoise( vBind * 85.0 ) * 0.6 + skNoise( vBind * 240.0 ) * 0.4;
		vec3 tint = mix( vec3( 0.97, 1.0, 1.02 ), vec3( 1.05, 0.93, 0.88 ), mott );
		tint *= mix( vec3( 1.0 ), vec3( 1.13, 0.84, 0.82 ), vDetail.w );
		// faint freckles on the back of the hand
		float freckle = smoothstep( 0.86, 0.93, skNoise( vBind * 650.0 ) ) * smoothstep( 0.2, 0.6, vBindN.x ) * sd.w;
		tint *= 1.0 - freckle * vec3( 0.06, 0.1, 0.13 );
		// creases hold shadow and colour; veins show blue-green through the skin
		tint *= 1.0 - sd.y * vec3( 0.16, 0.22, 0.24 );
		tint *= mix( vec3( 1.0 ), vec3( 0.88, 0.9, 0.98 ), sd.z * 0.6 );
		diffuseColor.rgb *= tint;
	}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `float roughnessFactor = roughness;
	{
		vec4 sd = skinDetail();
		// oilier on the knuckles and pads, drier in the creases
		roughnessFactor *= 0.85 + 0.3 * skNoise( vBind * 420.0 );
		roughnessFactor = mix( roughnessFactor, 0.8, saturate( sd.y ) );
		roughnessFactor = mix( roughnessFactor, roughnessFactor * 0.85, vDetail.w );
	}`,
      );
  };
  m.customProgramCacheKey = () => 'skin-procedural';
  return m;
}

const skin = skinMaterial();
const nailMat = new THREE.MeshPhysicalMaterial({ color: '#e9c4b6', roughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.35 });

function knitTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  // ribs along the sleeve, each made of little interlocking stitches
  for (let x = 0; x < 128; x += 8) {
    for (let y = 0; y < 128; y += 8) {
      const g = ctx.createLinearGradient(x, 0, x + 8, 0);
      g.addColorStop(0, '#3a3a3a');
      g.addColorStop(0.5, '#e8e8e8');
      g.addColorStop(1, '#3a3a3a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 4, 3.6, 4.6, (x / 8) % 2 ? 0.35 : -0.35, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 6);
  return t;
}

/* ------------------------------------------------------------------ skeleton */

type FingerName = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
const SEGMENTS = ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'];
const JOINTS: Record<FingerName, string[]> = {
  thumb: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'],
  index: SEGMENTS.map((s) => 'index-finger-' + s),
  middle: SEGMENTS.map((s) => 'middle-finger-' + s),
  ring: SEGMENTS.map((s) => 'ring-finger-' + s),
  pinky: SEGMENTS.map((s) => 'pinky-finger-' + s),
};
/** How much each joint flexes per unit of curl: metacarpal, MCP, PIP, DIP, tip. Ring and pinky cup the palm a little. */
const FLEX: Record<FingerName, number[]> = {
  thumb: [0.35, 0.75, 0.95, 0],
  index: [0, 1.3, 1.6, 1.05, 0],
  middle: [0, 1.35, 1.65, 1.1, 0],
  ring: [0.06, 1.35, 1.65, 1.1, 0],
  pinky: [0.12, 1.35, 1.6, 1.05, 0],
};

interface Chain {
  bones: THREE.Bone[];
  bindPos: THREE.Vector3[];
  bindQuat: THREE.Quaternion[];
  flex: number[];
}

const _R = new THREE.Quaternion(), _L = new THREE.Quaternion(), _inv = new THREE.Quaternion(), _d = new THREE.Vector3(), _e = new THREE.Euler();

/**
 * Forward kinematics along one finger. Joints are expressed in armature space (flat);
 * a WebXR joint points along its -Z with +Y on the back of the hand, so flexing towards
 * the palm is a negative rotation about the joint's own X. `base` overrides the first
 * joint's rotation (the thumb's CMC joint, which moves in all three axes).
 */
function solve(c: Chain, curl: number, base?: [number, number, number]) {
  _R.identity();
  for (let i = 0; i < c.bones.length; i++) {
    const b = c.bones[i];
    if (i === 0) b.position.copy(c.bindPos[0]);
    else b.position.copy(c.bones[i - 1].position).add(_d.subVectors(c.bindPos[i], c.bindPos[i - 1]).applyQuaternion(_R));
    _L.setFromEuler(i === 0 && base ? _e.set(base[0], base[1], base[2]) : _e.set(-curl * c.flex[i], 0, 0));
    b.quaternion.copy(_R).multiply(c.bindQuat[i]).multiply(_L);
    // everything further out inherits this joint's bend
    _R.copy(b.quaternion).multiply(_inv.copy(c.bindQuat[i]).invert());
  }
}

/**
 * Per-vertex anatomy for the skin shader, measured against the bind-pose skeleton:
 * knuckle creases (back and palm side), redness, and how thin the flesh is.
 */
function bakeSkinAttributes(g: THREE.BufferGeometry, chains: Record<FingerName, Chain>) {
  const P = g.attributes.position as THREE.BufferAttribute;
  const Nrm = g.attributes.normal as THREE.BufferAttribute;
  const detail = new Float32Array(P.count * 4);
  const thin = new Float32Array(P.count);

  const knuckles: { p: THREE.Vector3; axis: THREE.Vector3; up: THREE.Vector3; fold: number }[] = [];
  const segments: [THREE.Vector3, THREE.Vector3][] = [];
  const tips: THREE.Vector3[] = [];
  for (const f of Object.keys(chains) as FingerName[]) {
    const c = chains[f];
    const flexing = f === 'thumb' ? [1, 2] : [1, 2, 3];
    for (const i of flexing) {
      knuckles.push({
        p: c.bindPos[i],
        axis: new THREE.Vector3(0, 0, -1).applyQuaternion(c.bindQuat[i]),
        up: new THREE.Vector3(0, 1, 0).applyQuaternion(c.bindQuat[i]),
        fold: f === 'thumb' ? (i === 1 ? 0.5 : 0.8) : [0, 0.3, 1, 0.6][i], // PIP folds most, MCP least
      });
    }
    for (let i = 0; i < c.bindPos.length - 1; i++) segments.push([c.bindPos[i], c.bindPos[i + 1]]);
    tips.push(c.bindPos[c.bindPos.length - 1]);
  }

  const v = new THREE.Vector3(), d = new THREE.Vector3(), radial = new THREE.Vector3(), seg = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    // nearest knuckle that this vertex wraps around
    let best = Infinity, t = 0, back = 0, palm = 0, fold = 0;
    for (const k of knuckles) {
      d.subVectors(v, k.p);
      const along = d.dot(k.axis);
      radial.copy(d).addScaledVector(k.axis, -along);
      const r = radial.length();
      if (r > 0.018 || Math.abs(along) > 0.012) continue;
      const dist = d.length();
      if (dist < best) {
        best = dist;
        t = along;
        const side = radial.dot(k.up) / (r || 1);
        back = THREE.MathUtils.smoothstep(side, 0.1, 0.6);
        palm = THREE.MathUtils.smoothstep(-side, 0.2, 0.7);
        fold = k.fold;
      }
    }
    const fall = best < Infinity ? Math.exp(-((t / 0.0065) ** 2)) : 0;
    detail[i * 4] = t;
    detail[i * 4 + 1] = back * fall * fold;
    detail[i * 4 + 2] = palm * fall;

    let red = 0;
    for (const tip of tips) red = Math.max(red, Math.exp(-((v.distanceTo(tip) / 0.012) ** 2)));
    red = Math.max(red, back * fall * (0.25 + 0.3 * fold));
    if (Nrm.getX(i) < -0.3) red = Math.max(red, 0.25); // palm
    detail[i * 4 + 3] = Math.min(1, red);

    // distance to the nearest bone: fingers are thin, the palm is not
    let r = Infinity;
    for (const [a, b] of segments) {
      seg.subVectors(b, a);
      const u = THREE.MathUtils.clamp(d.subVectors(v, a).dot(seg) / seg.lengthSq(), 0, 1);
      r = Math.min(r, d.subVectors(v, a).addScaledVector(seg, -u).length());
    }
    thin[i] = 1 - THREE.MathUtils.smoothstep(r, 0.007, 0.013);
  }
  g.setAttribute('aDetail', new THREE.BufferAttribute(detail, 4));
  g.setAttribute('aThin', new THREE.BufferAttribute(thin, 1));
}

/* ------------------------------------------------------------------ the arm */

export function createHand() {
  const root = new THREE.Group();
  root.name = 'hand';

  // forearm + sleeve live outside the roll so the arm always rises towards the shoulder
  const arm = new THREE.Group();
  root.add(arm);
  const forearmGeo = new THREE.CylinderGeometry(0.0215, 0.03, 0.42, 32, 6);
  forearmGeo.rotateZ(-Math.PI / 2);
  forearmGeo.translate(-0.012 - 0.21, 0, 0);
  forearmGeo.scale(1, 0.78, 1);
  const forearm = new THREE.Mesh(forearmGeo, skin);
  arm.add(forearm);

  const wool = new THREE.MeshPhysicalMaterial({
    color: '#9c8a74',
    roughness: 0.95,
    sheen: 1,
    sheenRoughness: 0.8,
    sheenColor: new THREE.Color('#d9c6ab'),
    bumpMap: knitTexture(),
    bumpScale: 2.2,
  });
  const sleeveGeo = new THREE.CylinderGeometry(0.035, 0.055, 0.44, 40, 8);
  // make the knit sag and fold a little
  const pos = sleeveGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), a = Math.atan2(pos.getZ(i), pos.getX(i));
    const f = 1 + Math.sin(y * 38 + a * 2) * 0.035 + Math.sin(a * 3 + y * 11) * 0.025;
    pos.setX(i, pos.getX(i) * f);
    pos.setZ(i, pos.getZ(i) * f);
  }
  sleeveGeo.computeVertexNormals();
  sleeveGeo.rotateZ(-Math.PI / 2);
  sleeveGeo.translate(-0.014 - 0.22, 0, 0);
  // the end caps are the dark inside of the sleeve
  const inside = new THREE.MeshStandardMaterial({ color: '#1c1814', roughness: 1 });
  arm.add(new THREE.Mesh(sleeveGeo, [wool, inside, inside]));
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.005, 12, 48), wool);
  cuff.rotation.y = Math.PI / 2;
  cuff.position.x = -0.015;
  arm.add(cuff);

  // the hand itself
  const rollG = new THREE.Group();
  root.add(rollG);
  const hand = new THREE.Group();
  rollG.add(hand);

  const chains = {} as Record<FingerName, Chain>;
  const holderQ = new THREE.Quaternion();
  /** finger pad, in a tip joint's frame: towards the palm (-Y) and a little back from the tip (+Z) */
  const PAD = new THREE.Vector3(0, -0.006, 0.004);

  // finger pads: contact points for pinching a match or pressing a button
  const pads = { index: new THREE.Object3D(), thumb: new THREE.Object3D() };
  let loaded = false;

  const ready = new GLTFLoader().loadAsync(import.meta.env.BASE_URL + 'models/hand-right.glb').then((gltf) => {
    const model = gltf.scene;
    const bones: Record<string, THREE.Bone> = {};
    let skinned!: THREE.SkinnedMesh;
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        skinned = m;
        m.material = skin;
        m.castShadow = true;
        m.frustumCulled = false;
      }
    });
    // model space: fingers along -Y, back of the hand along +X, thumb towards -Z.
    // A quarter turn about z maps that onto the hand frame; then put the wrist at the origin.
    const holder = new THREE.Group();
    holder.rotation.z = Math.PI / 2;
    const wrist = bones.wrist.position.clone().applyEuler(holder.rotation);
    holder.position.copy(wrist).negate();
    holder.add(model);
    hand.add(holder);
    holderQ.copy(holder.quaternion);

    for (const f of Object.keys(JOINTS) as FingerName[]) {
      const bs = JOINTS[f].map((n) => bones[n]);
      chains[f] = { bones: bs, bindPos: bs.map((b) => b.position.clone()), bindQuat: bs.map((b) => b.quaternion.clone()), flex: FLEX[f] };
    }
    // a smoother surface (the source mesh is low-poly), then the anatomy the skin shader reads
    const geo = loopSubdivideSkinned(skinned.geometry, skinned.skeleton.bones.length);
    bakeSkinAttributes(geo, chains);
    skinned.geometry.dispose();
    skinned.geometry = geo;
    pads.index.position.copy(PAD);
    bones['index-finger-tip'].add(pads.index);
    pads.thumb.position.copy(PAD);
    bones['thumb-tip'].add(pads.thumb);

    // nails, riding on the distal joints
    for (const f of Object.keys(JOINTS) as FingerName[]) {
      const distal = bones[f === 'thumb' ? 'thumb-phalanx-distal' : `${f}-finger-phalanx-distal`];
      const tip = bones[f === 'thumb' ? 'thumb-tip' : `${f}-finger-tip`];
      const len = distal.position.distanceTo(tip.position);
      const w = f === 'thumb' ? 0.0048 : f === 'pinky' ? 0.0035 : 0.0042;
      const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10), nailMat);
      nail.scale.set(w, 0.0009, len * 0.42);
      nail.position.set(0, f === 'thumb' ? 0.0052 : 0.0044, -len * 0.6);
      nail.rotation.x = -0.08;
      distal.add(nail);
    }
    loaded = true;
    apply();
  });

  // a kitchen match, held between the thumb and the index finger
  const match = new THREE.Group();
  hand.add(match);
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.0024, 0.0024), new THREE.MeshStandardMaterial({ color: '#d8b98a', roughness: 0.8 }));
  stick.position.x = 0.016;
  stick.castShadow = true;
  match.add(stick);
  const headMat = new THREE.MeshStandardMaterial({ color: '#6b1d14', roughness: 0.7 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), headMat);
  head.scale.set(0.0042, 0.0032, 0.0032);
  head.position.x = 0.042;
  match.add(head);
  const headTip = new THREE.Object3D();
  headTip.position.x = 0.044;
  match.add(headTip);
  const flame = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: flameTexture(), color: new THREE.Color(5, 3.4, 2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  flame.center.set(0.5, 0.08);
  match.add(flame);
  flame.position.x = 0.043;
  const light = new THREE.PointLight('#ffae66', 0, 1.1, 2);
  light.position.set(0.044, 0.01, 0);
  match.add(light);

  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  root.traverse((o) => (o.raycast = () => {}));

  const pose: HandPose = { ...POSES.relaxed };
  const state = { lit: 0, showMatch: 0, charred: false };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), dir = new THREE.Vector3(), squeeze = new THREE.Vector3();
  const X = new THREE.Vector3(1, 0, 0);

  function apply() {
    rollG.rotation.x = pose.roll;
    if (loaded) {
      for (const f of ['index', 'middle', 'ring', 'pinky'] as const) solve(chains[f], pose[f]);
      solve(chains.thumb, pose.thumbCurl, [pose.thumbX, pose.thumbY, pose.thumbZ]);
    }
    match.visible = state.showMatch > 0;
    if (match.visible && loaded) {
      // pinch: the match is gripped near its back end, between the index pad and the thumb pad...
      hand.updateMatrixWorld(true);
      const a = hand.worldToLocal(pads.index.getWorldPosition(tmpA));
      const b = hand.worldToLocal(pads.thumb.getWorldPosition(tmpB));
      match.position.copy(a).lerp(b, 0.5);
      // ...and points out past the fingertips: forward from the hand, square to the squeeze between
      // the pads (so it really lies between them), head tipped down so the flame climbs the wood
      squeeze.subVectors(a, b).normalize();
      dir.set(1, -0.45, 0).addScaledVector(squeeze, -dir.set(1, -0.45, 0).dot(squeeze)).normalize();
      match.quaternion.setFromUnitVectors(X, dir);
    }
  }

  const PARK = new THREE.Vector3(0, -6, 6);
  root.position.copy(PARK);

  return {
    root,
    pose,
    match: state,
    ready,
    fx: [flame],
    /** Point the hand along horizontal `dir`, tilted down by `pitch`, with the forearm rising at `elevation`. */
    aim(dir: THREE.Vector3, pitch: number, elevation: number, left: boolean) {
      root.rotation.set(0, Math.atan2(-dir.z, dir.x), -pitch, 'YZX');
      root.scale.set(1, 1, left ? -1 : 1);
      arm.rotation.z = pitch - elevation;
    },
    setPose(p: HandPose) {
      Object.assign(pose, p);
      apply();
    },
    /** Root position that puts the chosen contact point on `target`, measured in `withPose`. */
    rootFor(target: THREE.Vector3, contact: 'match' | 'index', withPose: HandPose) {
      const saved = { ...pose }, savedPos = root.position.clone(), savedMatch = state.showMatch;
      Object.assign(pose, withPose);
      if (contact === 'match') state.showMatch = 1;
      root.position.set(0, 0, 0);
      apply();
      root.updateMatrixWorld(true);
      const c = (contact === 'match' ? headTip : pads.index).getWorldPosition(new THREE.Vector3());
      Object.assign(pose, saved);
      state.showMatch = savedMatch;
      root.position.copy(savedPos);
      apply();
      return target.clone().sub(c);
    },
    matchHeadWorld: () => headTip.getWorldPosition(new THREE.Vector3()),
    park() {
      root.position.copy(PARK);
      state.lit = 0;
      state.showMatch = 0;
      state.charred = false;
    },
    update(time: number) {
      apply();
      const f = 0.85 + Math.sin(time * 11.3) * 0.06 + Math.sin(time * 27.1) * 0.04 + Math.sin(time * 4.1) * 0.05;
      const l = state.lit;
      light.intensity = 0.045 * l * f;
      flame.scale.set(0.0085 * Math.min(l, 1.3) * (0.92 + (f - 0.85)), 0.021 * l * f + 0.0001, 1);
      headMat.color.set(state.charred ? '#1e1612' : '#6b1d14');
    },
  };
}
