import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

/* ------------------------------------------------------------------ film grade */

/** Final pass, in display space: chromatic aberration, teal/orange split-tone, soft S-curve, vignette, grain, fade. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uVignette: { value: 0.62 },
    uGrain: { value: 0.045 },
    uCA: { value: 0.0014 },
    uFade: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uCA, uFade;
    uniform vec2 uRes;
    varying vec2 vUv;

    float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

    void main() {
      vec2 d = vUv - 0.5;
      float r = length(d * vec2(uRes.x / uRes.y, 1.0));
      vec2 off = d * uCA * (0.4 + r * 1.6);
      vec3 col = vec3(
        texture2D(tDiffuse, vUv + off).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - off).b);

      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      // split tone: cool shadows, warm highlights
      col = mix(col, col * vec3(0.86, 0.98, 1.12) + vec3(0.0, 0.006, 0.014), (1.0 - smoothstep(0.0, 0.45, l)) * 0.6);
      col = mix(col, col * vec3(1.08, 1.0, 0.88), smoothstep(0.35, 1.0, l) * 0.5);
      // gentle filmic S-curve
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.22);

      // vignette
      col *= 1.0 - uVignette * smoothstep(0.35, 1.05, r);

      // animated grain, stronger in shadows like film
      float g = hash(vUv * uRes + fract(uTime * 0.71) * 913.0) - 0.5;
      col += g * uGrain * (1.15 - l);

      gl_FragColor = vec4(col * uFade, 1.0);
    }`,
};

export interface Pipeline {
  render(time: number): void;
  setSize(w: number, h: number): void;
  setFocus(distance: number): void;
  grade: ShaderPass;
  bloom: UnrealBloomPass;
  /** Drop expensive passes if the device struggles. */
  degrade(): void;
}

/**
 * Builds the post stack. `fxObjects` (light shaft, dust, steam, window glass) are hidden while the
 * depth-based passes (AO, depth of field) render their depth/normal buffers, so the transparent
 * effects do not pollute depth.
 */
export function createPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  fxObjects: THREE.Object3D[],
  high: boolean,
): Pipeline {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: high ? 4 : 0 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(Math.min(devicePixelRatio, high ? 1.5 : 1.25));
  composer.addPass(new RenderPass(scene, camera));

  const hideFx = (pass: Pass) => {
    const orig = pass.render.bind(pass);
    pass.render = (...args: Parameters<Pass['render']>) => {
      const vis = fxObjects.map((o) => o.visible);
      fxObjects.forEach((o) => (o.visible = false));
      orig(...args);
      fxObjects.forEach((o, i) => (o.visible = vis[i]));
    };
  };

  let gtao: GTAOPass | null = null;
  let bokeh: BokehPass | null = null;
  if (high) {
    gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    gtao.updateGtaoMaterial({ radius: 0.04, distanceExponent: 1.6, thickness: 0.02, scale: 1.2, samples: 16 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    gtao.blendIntensity = 1;
    hideFx(gtao);
    composer.addPass(gtao);

    bokeh = new BokehPass(scene, camera, { focus: 1.4, aperture: 0.0032, maxblur: 0.0055 });
    hideFx(bokeh);
    composer.addPass(bokeh);
  }

  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.75, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  const setSize = (w: number, h: number) => {
    composer.setSize(w, h);
    const pr = composer.renderTarget1.width / w;
    grade.uniforms.uRes.value.set(w * pr, h * pr);
  };
  setSize(innerWidth, innerHeight);

  return {
    grade,
    bloom,
    setSize,
    setFocus(distance) {
      if (bokeh) (bokeh.uniforms as Record<string, THREE.IUniform>).focus.value = distance;
    },
    render(time) {
      grade.uniforms.uTime.value = time;
      composer.render();
    },
    degrade() {
      if (gtao) gtao.enabled = false;
      composer.setPixelRatio(1);
      setSize(innerWidth, innerHeight);
    },
  };
}

/* ------------------------------------------------------------------ atmosphere */

/** Soft additive cone that reads as light scattering in dusty air under the lamp. */
export function createLightShaft(length: number, radius: number) {
  const geo = new THREE.ConeGeometry(radius, length, 48, 1, true);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, length / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uIntensity: { value: 0 }, uLength: { value: length }, uColor: { value: new THREE.Color('#ffc98a') } },
    vertexShader: /* glsl */ `
      uniform float uLength;
      varying float vT;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vT = position.z / uLength;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      uniform vec3 uColor;
      varying float vT;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        float facing = pow(clamp(abs(dot(normalize(vN), normalize(vView))), 0.0, 1.0), 2.2);
        float along = smoothstep(0.0, 0.12, vT) * pow(clamp(1.0 - vT, 0.0, 1.0), 1.3);
        gl_FragColor = vec4(uColor * facing * along * uIntensity, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.raycast = () => {};
  mesh.renderOrder = 10;
  return { mesh, mat };
}

/** Dust motes drifting inside the lamp cone. Positions are in the cone's local space (+z = beam). */
export function createDust(length: number, radius: number, count = 260) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = 0.08 + Math.random() * 0.85;
    const a = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * radius * t * 0.95;
    pos.set([Math.cos(a) * rr, Math.sin(a) * rr, t * length], i * 3);
    seed[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uScale: { value: innerHeight * Math.min(devicePixelRatio, 1.5) } },
    vertexShader: /* glsl */ `
      uniform float uTime, uScale;
      attribute float aSeed;
      varying float vA;
      void main() {
        vec3 p = position;
        float s = aSeed * 6.2831;
        p += vec3(sin(uTime * 0.21 + s * 3.0), cos(uTime * 0.17 + s * 5.0), sin(uTime * 0.13 + s * 7.0)) * 0.018;
        p.z += sin(uTime * 0.05 + s) * 0.02;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.0016 + aSeed * 0.0022) * uScale / -mv.z;
        vA = (0.35 + 0.65 * sin(uTime * (0.6 + aSeed) + s * 11.0) * 0.5 + 0.5) * (1.0 - p.z / ${length.toFixed(3)});
      }`,
    fragmentShader: /* glsl */ `
      uniform float uIntensity;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * a * vA * uIntensity, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.raycast = () => {};
  points.renderOrder = 11;
  return { points, mat };
}

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 14; i++) {
    const x = 40 + Math.random() * 48, y = 40 + Math.random() * 48, r = 18 + Math.random() * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

/** Wisps of steam rising from the mug. Call update(time) each frame. */
export function createSteam(count = 7) {
  const group = new THREE.Group();
  const tex = puffTexture();
  const sprites = Array.from({ length: count }, (_, i) => {
    const m = new THREE.SpriteMaterial({ map: tex, color: '#e9dccb', transparent: true, opacity: 0, depthWrite: false });
    const s = new THREE.Sprite(m);
    s.raycast = () => {};
    s.userData.phase = i / count;
    group.add(s);
    return s;
  });
  return {
    group,
    update(time: number) {
      for (const s of sprites) {
        const t = (time * 0.12 + s.userData.phase) % 1;
        const m = s.material as THREE.SpriteMaterial;
        s.position.set(Math.sin(time * 0.7 + s.userData.phase * 9) * 0.012 * t, 0.085 + t * 0.15, Math.cos(time * 0.5 + s.userData.phase * 5) * 0.01 * t);
        const sc = 0.035 + t * 0.09;
        s.scale.set(sc, sc * 1.3, 1);
        m.opacity = Math.sin(Math.PI * t) * 0.07;
        m.rotation = s.userData.phase * 6 + time * 0.15;
      }
    },
  };
}
