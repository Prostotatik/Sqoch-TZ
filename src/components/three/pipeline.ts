/**
 * NeonPipeline — the whole shared scene as one imperative object (INV-00), driven by r3f's loop.
 *
 * Frame:
 *  1. background scene (ring + ambient crystals) → MSAA render target;
 *  2. tier A: bright pass + two-scale separable blur (custom bloom, no extra library);
 *  3. composite to the canvas — premultiplied, so glow adds over the DOM photo — with the
 *     current DOM panel/modal cut out as a rounded rect (the canvas sits *above* the flow, so
 *     the ticket blobs can be drawn in front of the glass, but the ring must stay behind it);
 *  4. success effect crystals (INV-13), never occluded;
 *  5. ticket blobs (INV-04): SDF metaballs into scissored viewports that track DOM boxes,
 *     clipped to the scroll area of the flow — the drei <View> idea, with clipping.
 */
import {
  CustomBlending,
  DoubleSide,
  Group,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  NoBlending,
  OctahedronGeometry,
  OneFactor,
  OneMinusSrcAlphaFactor,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  TorusGeometry,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderTarget,
  type Blending,
  type IUniform,
  type WebGLRenderer,
} from 'three';
import { blobSlots, occluder, sceneInput, type BlobSlot, type SceneMode } from './sceneState';
import type { LayoutMode } from '@/hooks/useMediaQuery';
import {
  blobFragment,
  blurFragment,
  brightFragment,
  compositeFragment,
  crystalFragment,
  crystalVertex,
  fxFragment,
  fxVertex,
  quadVertex,
  ringFragment,
  ringVertex,
} from './shaders';

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return new Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const GOLD = hex('#f19a59');
const PINK = hex('#e06aca');
const VIOLET = hex('#7f4bda');
const COOL = new Vector3(0.62, 0.72, 1.05);
const WARM = new Vector3(1, 1, 1);
/** Crystal palette from the reference: violet, blue, orange, coral, pink (weights by repetition). */
const CRYSTAL_COLORS = ['#7f4bda', '#9d67de', '#2646ef', '#7f4bda', '#f8673b', '#e06aca', '#2d5dee', '#f86a55', '#5a13e4'].map(hex);
const FX_COLORS = ['#f8673b', '#f86a55', '#e92e48', '#7f4bda', '#2646ef', '#9d67de', '#e06aca'].map(hex);

/** Ball layouts per count, [x, y, radius] in DOM-box units (box = −1..1). */
const LAYOUTS: [number, number, number][][] = [
  [[0, 0, 0.6]],
  [
    [-0.28, -0.14, 0.5],
    [0.36, 0.26, 0.4],
  ],
  [
    [-0.34, -0.2, 0.44],
    [0.38, -0.22, 0.4],
    [0.04, 0.38, 0.42],
  ],
  [
    [-0.38, -0.18, 0.4],
    [0.38, -0.3, 0.36],
    [-0.04, 0.38, 0.4],
    [0.5, 0.3, 0.28],
  ],
];
const JELLY = { k: 300, c: 11 };

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Ball {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  vr: number;
  tx: number;
  ty: number;
  tr: number;
  dying: boolean;
}

interface BlobState {
  balls: Ball[];
  version: number;
  ghost: number;
  tremble: number;
  energy: number;
  lean: Vector2;
  alpha: number;
  flow: HTMLElement | null;
  header: HTMLElement | null;
  footer: HTMLElement | null;
  body: HTMLElement | null;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ModeTarget {
  x: number;
  y: number;
  scale: number;
  intensity: number;
  saturation: number;
  spin: number;
  fall: number;
  spread: number;
  speed: number;
  alpha: number;
}

/** Where the ring and crystals live for each mode/layout (world units at z = 0). */
/** Ring scale (world units per ring unit) whose outer glow fits inside the ≤560 CSS px modal of 05/06. */
function modalFit(w: number) {
  const cssW = typeof window !== 'undefined' ? window.innerWidth : 1440;
  return (0.78 * Math.min(560, cssW - 32) * (w / cssW)) / 3.6;
}

function targetFor(mode: SceneMode, layout: LayoutMode, w: number, h: number): ModeTarget {
  const phone = layout === 'phone';
  const ringFit = phone ? (0.92 * w) / 3.4 : Math.min((0.62 * h) / 3.4, (0.5 * w) / 3.4);
  const base = { fall: 0, spread: 0, speed: 1, alpha: 1 };
  switch (mode) {
    case 'hero':
      return phone
        ? { ...base, x: 0.04 * w, y: 0.16 * h, scale: ringFit, intensity: 1, saturation: 1, spin: 1 }
        : { ...base, x: 0.2 * w, y: 0.06 * h, scale: ringFit * 1.15, intensity: 1, saturation: 1, spin: 1 };
    case 'flow':
      if (layout === 'panel') return { ...base, x: -0.17 * w, y: 0.02 * h, scale: ringFit * 0.95, intensity: 0.6, saturation: 0.95, spin: 0.5, speed: 0.6 };
      return { ...base, x: 0, y: 0.3 * h, scale: ringFit * 0.8, intensity: 0.4, saturation: 0.9, spin: 0.5, speed: 0.5, alpha: phone ? 0 : 0.5 };
    // SLOP-25: over a centred modal the ring must not stick out as two cut arcs — it stays whole
    // behind the modal (the occluder hides it) and the crystals/confetti carry the moment
    case 'success':
      return { ...base, x: 0, y: phone ? 0.04 * h : 0, scale: phone ? ringFit * 1.25 : Math.min(ringFit * 1.25, modalFit(w)), intensity: 0.95, saturation: 1, spin: 2.2, spread: 0.25, speed: 1.4 };
    case 'soldout':
      return { ...base, x: 0, y: phone ? 0.02 * h : 0, scale: phone ? ringFit * 1.1 : Math.min(ringFit * 1.1, modalFit(w)), intensity: 0.4, saturation: 0.14, spin: 0.12, fall: 1, speed: 0.22 };
  }
}

const ease = (cur: number, target: number, k: number) => cur + (target - cur) * k;

function quadMaterial(fragmentShader: string, uniforms: Record<string, IUniform>, blending: Blending = NoBlending) {
  return new ShaderMaterial({ vertexShader: quadVertex, fragmentShader, uniforms, depthTest: false, depthWrite: false, blending });
}

export interface PipelineOptions {
  tier: 'A' | 'B';
  reduced: boolean;
}

export class NeonPipeline {
  readonly tier: 'A' | 'B';
  readonly reduced: boolean;

  private main = new Scene();
  private fxScene = new Scene();
  private quadScene = new Scene();
  private quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh;
  private rig = new Group();
  private ring = new Group();
  private ringCore: ShaderMaterial;
  private ringGlow: ShaderMaterial;
  private crystalMat: ShaderMaterial;
  private fxMat: ShaderMaterial;
  private fxMesh: Mesh;
  private blobMat: ShaderMaterial;
  private matBright: ShaderMaterial;
  private matBlur: ShaderMaterial;
  private matComposite: ShaderMaterial;
  private disposables: { dispose(): void }[] = [];

  private rtMain: WebGLRenderTarget;
  private rtA1: WebGLRenderTarget | null = null;
  private rtA2: WebGLRenderTarget | null = null;
  private rtB1: WebGLRenderTarget | null = null;
  private rtB2: WebGLRenderTarget | null = null;

  private blobs = new WeakMap<BlobSlot, BlobState>();
  private radiusCache = new WeakMap<HTMLElement, number>();
  private sp = new Vector2();
  private clock = 7.3;
  private time = 0;
  private s = { x: 0, y: 0, scale: 1, intensity: 1, saturation: 1, spin: 1, fall: 0, spread: 0, speed: 1, alpha: 1, flicker: 1, warp: 0 };
  private first = true;
  private tmpRect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  constructor({ tier, reduced }: PipelineOptions) {
    this.tier = tier;
    this.reduced = reduced;
    const a = tier === 'A';

    /* ring */
    const ringUniforms = () => ({
      uTime: { value: 0 },
      uIntensity: { value: 1 },
      uSaturation: { value: 1 },
      uGlow: { value: 0 },
      uGold: { value: GOLD },
      uPink: { value: PINK },
      uViolet: { value: VIOLET },
      uCool: { value: COOL },
    });
    this.ringCore = new ShaderMaterial({ vertexShader: ringVertex, fragmentShader: ringFragment, uniforms: ringUniforms() });
    this.ringGlow = new ShaderMaterial({
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      uniforms: { ...ringUniforms(), uGlow: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    });
    const coreGeo = new TorusGeometry(1.6, 0.045, a ? 24 : 16, a ? 240 : 160);
    const glowGeo = new TorusGeometry(1.6, 0.2, 16, a ? 160 : 96);
    this.ring.add(new Mesh(coreGeo, this.ringCore), new Mesh(glowGeo, this.ringGlow));
    this.rig.add(this.ring);

    /* ambient crystals — one instanced draw */
    const count = a ? 120 : 64;
    const r = rng(7);
    const geo = new InstancedBufferGeometry();
    const octa = new OctahedronGeometry(1, 0);
    geo.index = octa.index;
    geo.setAttribute('position', octa.getAttribute('position'));
    const offset = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    const scale = new Float32Array(count);
    const color = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const ang = r() * Math.PI * 2;
      const rad = 0.18 + Math.pow(r(), 0.8) * 0.95;
      offset.set([Math.cos(ang) * rad, Math.sin(ang) * rad * 0.95, -2.6 + r() * 3.6], i * 3);
      const depth = (offset[i * 3 + 2] + 2.6) / 3.6;
      seed.set([r() * Math.PI * 2, 0.15 + r() * 0.45, 0.12 + r() * 0.4, depth], i * 4);
      scale[i] = 0.016 + Math.pow(r(), 3) * (a ? 0.13 : 0.16);
      const c = CRYSTAL_COLORS[Math.floor(r() * CRYSTAL_COLORS.length)];
      color.set([c.x, c.y, c.z], i * 3);
    }
    geo.setAttribute('aOffset', new InstancedBufferAttribute(offset, 3));
    geo.setAttribute('aSeed', new InstancedBufferAttribute(seed, 4));
    geo.setAttribute('aScale', new InstancedBufferAttribute(scale, 1));
    geo.setAttribute('aColor', new InstancedBufferAttribute(color, 3));
    geo.instanceCount = count;
    this.crystalMat = new ShaderMaterial({
      vertexShader: crystalVertex,
      fragmentShader: crystalFragment,
      uniforms: {
        uClock: { value: 0 },
        uField: { value: new Vector2(4, 3) },
        uParallax: { value: new Vector2() },
        uSpread: { value: 0 },
        uFall: { value: 0 },
        uWarp: { value: 0 },
        uPointer: { value: new Vector2() },
        uTanHalf: { value: Math.tan((45 * Math.PI) / 360) },
        uAspect: { value: 1 },
        uRepel: { value: 0 },
        uSaturation: { value: 1 },
        uIntensity: { value: 1 },
        uCool: { value: COOL },
      },
      side: DoubleSide,
    });
    const crystals = new Mesh(geo, this.crystalMat);
    crystals.frustumCulled = false;
    this.rig.add(crystals);
    this.main.add(this.rig);
    this.disposables.push(coreGeo, glowGeo, octa, geo, this.ringCore, this.ringGlow, this.crystalMat);

    /* success fx crystals (INV-13) */
    const fxCount = a ? 64 : 40;
    const fxGeo = new InstancedBufferGeometry();
    fxGeo.index = octa.index;
    fxGeo.setAttribute('position', octa.getAttribute('position'));
    const edge = new Float32Array(fxCount);
    const fxSeed = new Float32Array(fxCount * 4);
    const fxColor = new Float32Array(fxCount * 3);
    for (let i = 0; i < fxCount; i += 1) {
      edge[i] = (i + r() * 0.6) / fxCount;
      fxSeed.set([r(), r(), r(), r()], i * 4);
      const c = FX_COLORS[i % FX_COLORS.length];
      fxColor.set([c.x, c.y, c.z], i * 3);
    }
    fxGeo.setAttribute('aEdge', new InstancedBufferAttribute(edge, 1));
    fxGeo.setAttribute('aSeed', new InstancedBufferAttribute(fxSeed, 4));
    fxGeo.setAttribute('aColor', new InstancedBufferAttribute(fxColor, 3));
    fxGeo.instanceCount = fxCount;
    this.fxMat = new ShaderMaterial({
      vertexShader: fxVertex,
      fragmentShader: fxFragment,
      uniforms: {
        uT: { value: 10 },
        uRect: { value: new Vector4(-1, -0.5, 1, 0.5) },
        uOrigin: { value: new Vector2() },
        uScale: { value: 0.06 },
      },
      side: DoubleSide,
    });
    this.fxMesh = new Mesh(fxGeo, this.fxMat);
    this.fxMesh.frustumCulled = false;
    this.fxScene.add(this.fxMesh);
    this.disposables.push(fxGeo, this.fxMat);

    /* fullscreen quad shared by post passes and blobs */
    const quadGeo = new PlaneGeometry(2, 2);
    this.quad = new Mesh(quadGeo);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.blobMat = quadMaterial(
      blobFragment,
      {
        uBalls: { value: Array.from({ length: 5 }, () => new Vector4()) },
        uTime: { value: 0 },
        uAlpha: { value: 1 },
        uGhost: { value: 0 },
        uKind: { value: 0 },
        uPx: { value: 0.02 },
        uExtent: { value: 1.4 },
        uLean: { value: new Vector2() },
        uTremble: { value: 0 },
        uEnergy: { value: 0 },
      },
      CustomBlending,
    );
    this.blobMat.blendSrc = OneFactor;
    this.blobMat.blendDst = OneMinusSrcAlphaFactor;
    this.matBright = quadMaterial(brightFragment, { tMap: { value: null }, uTexel: { value: new Vector2() }, uThreshold: { value: 0.9 } });
    this.matBlur = quadMaterial(blurFragment, { tMap: { value: null }, uDir: { value: new Vector2() } });
    this.matComposite = quadMaterial(compositeFragment, {
      tMain: { value: null },
      tBloomA: { value: null },
      tBloomB: { value: null },
      uBloom: { value: 0 },
      uAlpha: { value: 1 },
      uOcc: { value: new Vector4() },
      uOccR: { value: 0 },
      uOccOn: { value: 0 },
    });
    this.disposables.push(quadGeo, this.blobMat, this.matBright, this.matBlur, this.matComposite);

    const rtOpts = { type: a ? HalfFloatType : UnsignedByteType, samples: a ? 4 : 0, depthBuffer: true, minFilter: LinearFilter, magFilter: LinearFilter };
    this.rtMain = new WebGLRenderTarget(1, 1, rtOpts);
    this.disposables.push(this.rtMain);
    if (a) {
      const low = { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter };
      this.rtA1 = new WebGLRenderTarget(1, 1, low);
      this.rtA2 = new WebGLRenderTarget(1, 1, low);
      this.rtB1 = new WebGLRenderTarget(1, 1, low);
      this.rtB2 = new WebGLRenderTarget(1, 1, low);
      this.disposables.push(this.rtA1, this.rtA2, this.rtB1, this.rtB2);
    }
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }

  /**
   * Compile every program up front (INN-01): otherwise the success crystals, blobs and bloom
   * passes compile on first use and stall the frame exactly when the flow / success opens.
   * Uses KHR_parallel_shader_compile through compileAsync where available.
   */
  async prewarm(gl: WebGLRenderer, camera: PerspectiveCamera) {
    const jobs: [Scene, PerspectiveCamera | OrthographicCamera][] = [
      [this.main, camera],
      [this.fxScene, camera],
    ];
    const quadMats = [this.blobMat, this.matComposite, ...(this.tier === 'A' ? [this.matBright, this.matBlur] : [])];
    const prev = this.quad.material;
    for (const mat of quadMats) {
      const s = new Scene();
      const q = new Mesh(this.quad.geometry, mat);
      q.frustumCulled = false;
      s.add(q);
      jobs.push([s, this.quadCam]);
    }
    this.quad.material = prev;
    for (const [scene, cam] of jobs) {
      try {
        if (typeof gl.compileAsync === 'function') await gl.compileAsync(scene, cam);
        else gl.compile(scene, cam);
      } catch {
        /* a failed warm-up only means the program compiles on first use */
      }
    }
  }

  frame(gl: WebGLRenderer, camera: PerspectiveCamera, size: { width: number; height: number }, delta: number) {
    const now = performance.now();
    const dt = Math.min(delta, 1 / 20);
    const reduced = this.reduced;
    const W = size.width;
    const H = size.height;
    const dpr = gl.getPixelRatio();
    const worldH = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const worldW = worldH * camera.aspect;
    if (!reduced) this.time += dt;

    /* ---- background scene state ---- */
    const mode = sceneInput.mode;
    const target = targetFor(mode, sceneInput.layout, worldW, worldH);
    const s = this.s;
    const k = reduced || this.first ? 1 : 1 - Math.pow(0.0015, dt);
    const kSlow = reduced || this.first ? 1 : 1 - Math.pow(0.08, dt);
    const sp = this.sp;
    const pk = reduced ? 0 : Math.min(1, dt * 4);
    sp.x += (sceneInput.pointer.x - sp.x) * pk;
    sp.y += (sceneInput.pointer.y - sp.y) * pk;

    // INV-03: portal warp envelope (0 → 1 → 0 in 900 ms)
    const wt = sceneInput.warpAt ? (now - sceneInput.warpAt) / 900 : 2;
    const warp = reduced || wt >= 1 || wt < 0 ? 0 : Math.pow(Math.sin(Math.PI * wt), 1.5);
    // INV-14: two short flicker dips of the neon (≤ 2 flashes, < 3 Hz)
    const st = sceneInput.soldAt && mode === 'soldout' ? (now - sceneInput.soldAt) / 1000 : -1;
    const flicker = reduced || st < 0 ? 1 : (st > 0.3 && st < 0.4) || (st > 0.51 && st < 0.62) ? 0.22 : 1;
    // INV-24 (light): the ring breathes at 124 BPM
    const beat = reduced ? 0 : Math.pow(1 - ((this.time * 124) / 60 - Math.floor((this.time * 124) / 60)), 4);
    sceneInput.pulse *= Math.exp(-dt * 3.5);

    for (const key of ['x', 'y', 'scale', 'intensity', 'saturation', 'spin', 'speed', 'spread'] as const) {
      s[key] = ease(s[key], target[key], k);
    }
    s.fall = ease(s.fall, target.fall, kSlow);
    // phones: the flow covers the screen — drop the background at once (no warp streaks over the cards)
    s.alpha = target.alpha === 0 && sceneInput.layout === 'phone' ? 0 : ease(s.alpha, target.alpha, k);
    s.warp = warp;
    this.clock = reduced ? 7.3 : this.clock + dt * s.speed * (1 + warp * 3);

    const scrollLift = mode === 'hero' ? sceneInput.scroll * worldH * 0.45 : 0;
    this.rig.position.set(s.x + sp.x * 0.15, s.y + scrollLift + sp.y * 0.1, 0);
    const ringScale = s.scale * (1 + warp * 1.8 + beat * 0.012);
    this.rig.scale.setScalar(s.scale);
    this.ring.scale.setScalar(ringScale / s.scale);
    this.rig.rotation.y = sp.x * 0.1;
    this.rig.rotation.x = -sp.y * 0.08;
    if (!reduced) this.ring.rotation.z += dt * 0.21 * s.spin * (1 + warp * 4);
    this.ring.rotation.x = 1.18 - (mode === 'hero' ? sceneInput.scroll * 0.5 : 0) + (reduced ? 0 : Math.sin(this.time * 0.3) * 0.04);
    this.ring.rotation.y = -0.32;

    const intensity = (s.intensity + sceneInput.pulse * 0.35 + beat * 0.06 + warp * 0.8) * flicker;
    for (const m of [this.ringCore, this.ringGlow]) {
      m.uniforms.uTime.value = this.time;
      m.uniforms.uIntensity.value = intensity;
      m.uniforms.uSaturation.value = s.saturation;
    }
    const cu = this.crystalMat.uniforms;
    cu.uClock.value = this.clock;
    (cu.uField.value as Vector2).set((worldW * 0.66) / s.scale, (worldH * 0.62) / s.scale);
    (cu.uParallax.value as Vector2).set(sp.x * 0.35, sp.y * 0.25);
    cu.uSpread.value = s.spread + (mode === 'hero' ? sceneInput.scroll * 0.9 : 0);
    cu.uFall.value = s.fall;
    cu.uWarp.value = warp;
    (cu.uPointer.value as Vector2).set(sp.x, sp.y);
    cu.uAspect.value = camera.aspect;
    cu.uRepel.value = reduced || Number.isNaN(sceneInput.pointerPx.x) ? 0 : 1;
    cu.uSaturation.value = s.saturation;
    cu.uIntensity.value = Math.min(1, 0.55 + s.intensity * 0.5) * (flicker < 1 ? 0.6 : 1);
    (cu.uCool.value as Vector3).copy(s.saturation < 0.6 ? COOL : WARM);

    /* ---- occluder (panel / modal in front of the background) ---- */
    const occ = occluder.el && occluder.el.isConnected ? occluder.el.getBoundingClientRect() : null;
    const comp = this.matComposite.uniforms;
    let mainVisible = s.alpha > 0.01;
    if (occ && occ.width > 0) {
      if (occ.left <= 0 && occ.top <= 0 && occ.right >= W && occ.bottom >= H) mainVisible = false;
      let radius = this.radiusCache.get(occluder.el!);
      if (radius === undefined) {
        radius = parseFloat(getComputedStyle(occluder.el!).borderTopLeftRadius) || 0;
        this.radiusCache.set(occluder.el!, radius);
      }
      (comp.uOcc.value as Vector4).set(occ.left * dpr, (H - occ.bottom) * dpr, occ.right * dpr, (H - occ.top) * dpr);
      comp.uOccR.value = radius * dpr;
      comp.uOccOn.value = 1;
    } else {
      comp.uOccOn.value = 0;
    }
    comp.uAlpha.value = s.alpha;

    gl.autoClear = false;
    gl.setScissorTest(false);
    gl.setRenderTarget(null);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);

    if (mainVisible) {
      const pw = Math.max(1, Math.floor(W * dpr));
      const ph = Math.max(1, Math.floor(H * dpr));
      if (this.rtMain.width !== pw || this.rtMain.height !== ph) {
        this.rtMain.setSize(pw, ph);
        const qw = Math.max(1, Math.floor(pw / 4));
        const qh = Math.max(1, Math.floor(ph / 4));
        this.rtA1?.setSize(qw, qh);
        this.rtA2?.setSize(qw, qh);
        this.rtB1?.setSize(Math.max(1, qw >> 1), Math.max(1, qh >> 1));
        this.rtB2?.setSize(Math.max(1, qw >> 1), Math.max(1, qh >> 1));
      }
      gl.setRenderTarget(this.rtMain);
      gl.clear(true, true, false);
      gl.render(this.main, camera);

      if (this.rtA1 && this.rtA2 && this.rtB1 && this.rtB2) {
        this.pass(gl, this.matBright, this.rtA1, { tMap: this.rtMain.texture }, (u) => (u.uTexel.value as Vector2).set(1 / pw, 1 / ph));
        this.blur(gl, this.rtA1, this.rtA2, 1.6);
        this.pass(gl, this.matBlur, this.rtB1, { tMap: this.rtA1.texture }, (u) => (u.uDir.value as Vector2).set(0, 0));
        this.blur(gl, this.rtB1, this.rtB2, 2.2);
        comp.tBloomA.value = this.rtA1.texture;
        comp.tBloomB.value = this.rtB1.texture;
        comp.uBloom.value = 0.7;
      } else {
        comp.uBloom.value = 0;
      }
      comp.tMain.value = this.rtMain.texture;
      this.pass(gl, this.matComposite, null, {});
    }

    /* ---- INV-13 success crystals ---- */
    const ft = sceneInput.fxAt ? (now - sceneInput.fxAt) / 1000 : 99;
    const fxEl = sceneInput.fxTarget;
    if (!reduced && ft < 3.4 && fxEl && fxEl.isConnected) {
      const r = fxEl.getBoundingClientRect();
      const toX = (px: number) => (px / W - 0.5) * worldW;
      const toY = (py: number) => -(py / H - 0.5) * worldH;
      const fu = this.fxMat.uniforms;
      fu.uT.value = ft;
      (fu.uRect.value as Vector4).set(toX(r.left), toY(r.bottom), toX(r.right), toY(r.top));
      const o = sceneInput.origin;
      const useOrigin = !Number.isNaN(o.x) && now - o.at < 4000;
      (fu.uOrigin.value as Vector2).set(toX(useOrigin ? o.x : r.left + r.width / 2), toY(useOrigin ? o.y : r.top - 40));
      fu.uScale.value = worldH * (sceneInput.layout === 'phone' ? 0.012 : 0.0095);
      gl.setRenderTarget(null);
      gl.clearDepth();
      gl.render(this.fxScene, camera);
    }

    /* ---- INV-04 ticket blobs ---- */
    this.renderBlobs(gl, W, H, dpr, dt, now);

    gl.setScissorTest(false);
    gl.setViewport(0, 0, W, H);
    this.first = false;
  }

  private pass(
    gl: WebGLRenderer,
    mat: ShaderMaterial,
    target: WebGLRenderTarget | null,
    textures: Record<string, unknown>,
    set?: (u: Record<string, IUniform>) => void,
  ) {
    for (const [key, val] of Object.entries(textures)) mat.uniforms[key].value = val;
    set?.(mat.uniforms);
    this.quad.material = mat;
    gl.setRenderTarget(target);
    gl.render(this.quadScene, this.quadCam);
  }

  private blur(gl: WebGLRenderer, a: WebGLRenderTarget, b: WebGLRenderTarget, spread: number) {
    this.pass(gl, this.matBlur, b, { tMap: a.texture }, (u) => (u.uDir.value as Vector2).set(spread / a.width, 0));
    this.pass(gl, this.matBlur, a, { tMap: b.texture }, (u) => (u.uDir.value as Vector2).set(0, spread / a.height));
  }

  /* ---------- blobs ---------- */

  private stateFor(slot: BlobSlot): BlobState {
    let st = this.blobs.get(slot);
    if (!st) {
      const flow = slot.el.closest<HTMLElement>('.flow');
      st = {
        balls: [],
        version: -1,
        ghost: slot.count === 0 ? 1 : 0,
        tremble: 0,
        energy: 0,
        lean: new Vector2(),
        alpha: 0,
        flow,
        header: flow?.querySelector<HTMLElement>('.flow__header') ?? null,
        footer: flow?.querySelector<HTMLElement>('.flow__footer') ?? null,
        body: flow?.querySelector<HTMLElement>('.flow__body') ?? null,
      };
      this.blobs.set(slot, st);
    }
    return st;
  }

  private syncBalls(slot: BlobSlot, st: BlobState, initial: boolean) {
    const n = Math.max(1, Math.min(4, slot.count));
    const layout = LAYOUTS[n - 1];
    const live = st.balls.filter((b) => !b.dying);
    let cx = 0;
    let cy = 0;
    live.forEach((b) => {
      cx += b.x / Math.max(1, live.length);
      cy += b.y / Math.max(1, live.length);
    });
    const snap = initial || this.reduced;
    // grow: a new ball pops out of the cluster centre
    while (live.length < n) {
      const ball: Ball = { x: cx, y: cy, r: 0, vx: 0, vy: 0, vr: 0, tx: 0, ty: 0, tr: 0, dying: false };
      live.push(ball);
      st.balls.push(ball);
    }
    // shrink: the last ball is absorbed back into the cluster
    while (live.length > n) {
      const ball = live.pop()!;
      ball.dying = true;
      ball.tx = cx;
      ball.ty = cy;
      ball.tr = 0;
    }
    live.forEach((b, i) => {
      [b.tx, b.ty, b.tr] = layout[i];
      if (snap) {
        b.x = b.tx;
        b.y = b.ty;
        b.r = b.tr;
      }
    });
    if (snap) st.balls = st.balls.filter((b) => !b.dying);
    st.version = slot.version;
  }

  private stepBalls(st: BlobState, dt: number) {
    if (this.reduced) return;
    const steps = 2;
    const h = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      for (const b of st.balls) {
        b.vx += (JELLY.k * (b.tx - b.x) - JELLY.c * b.vx) * h;
        b.vy += (JELLY.k * (b.ty - b.y) - JELLY.c * b.vy) * h;
        b.vr += (JELLY.k * (b.tr - b.r) - JELLY.c * b.vr) * h;
        b.x += b.vx * h;
        b.y += b.vy * h;
        b.r = Math.max(0, b.r + b.vr * h);
      }
    }
    st.balls = st.balls.filter((b) => !(b.dying && b.r < 0.01 && Math.abs(b.vr) < 0.5));
  }

  private clipFor(st: BlobState, W: number, H: number): Rect {
    let x0 = 0;
    let y0 = 0;
    let x1 = W;
    let y1 = H;
    if (st.body) {
      const b = st.body.getBoundingClientRect();
      x0 = Math.max(x0, b.left);
      y0 = Math.max(y0, b.top);
      x1 = Math.min(x1, b.right);
      y1 = Math.min(y1, b.bottom);
    }
    if (st.header) y0 = Math.max(y0, st.header.getBoundingClientRect().bottom);
    if (st.footer) y1 = Math.min(y1, st.footer.getBoundingClientRect().top);
    const r = this.tmpRect;
    r.x = x0;
    r.y = y0;
    r.w = x1 - x0;
    r.h = y1 - y0;
    return r;
  }

  private renderBlobs(gl: WebGLRenderer, W: number, H: number, dpr: number, dt: number, now: number) {
    if (blobSlots.size === 0) return;
    const u = this.blobMat.uniforms;
    this.quad.material = this.blobMat;
    gl.setRenderTarget(null);
    gl.setScissorTest(true);
    for (const slot of blobSlots) {
      if (!slot.el.isConnected) continue;
      const st = this.stateFor(slot);
      if (st.version !== slot.version) this.syncBalls(slot, st, st.version === -1);
      this.stepBalls(st, dt);

      const box = slot.el.getBoundingClientRect();
      if (box.width < 2) continue;
      const ext = 1.45;
      const half = (box.width / 2) * ext;
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const clip = this.clipFor(st, W, H);
      const vx0 = Math.max(cx - half, clip.x);
      const vy0 = Math.max(cy - half, clip.y);
      const vx1 = Math.min(cx + half, clip.x + clip.w);
      const vy1 = Math.min(cy + half, clip.y + clip.h);
      if (vx1 <= vx0 || vy1 <= vy0) continue;

      // fade with the DOM (step transitions, panel exit, busy states)
      let alpha = 1;
      for (let n: HTMLElement | null = slot.el; n && n !== document.body; n = n.parentElement) {
        const o = parseFloat(getComputedStyle(n).opacity);
        if (o < 1) alpha *= o;
        if (n === st.flow) break;
      }

      // lean towards a nearby pointer; hovering speeds the wobble up
      const px = sceneInput.pointerPx;
      let lx = 0;
      let ly = 0;
      let energy = 0;
      if (!this.reduced && !Number.isNaN(px.x)) {
        const dx = (px.x - cx) / box.width;
        const dy = (px.y - cy) / box.height;
        const d = Math.hypot(dx, dy);
        if (d < 2.6) {
          const f = (1 - d / 2.6) * 0.5;
          lx = Math.max(-0.5, Math.min(0.5, dx * f));
          ly = Math.max(-0.5, Math.min(0.5, -dy * f));
          energy = (1 - d / 2.6) * 1.5;
        }
      }
      const k = this.reduced ? 1 : 1 - Math.pow(0.002, dt);
      st.lean.x = ease(st.lean.x, lx, k);
      st.lean.y = ease(st.lean.y, ly, k);
      st.energy = ease(st.energy, energy, k);
      st.ghost = ease(st.ghost, slot.count === 0 ? 1 : 0, this.reduced ? 1 : 1 - Math.pow(0.01, dt));
      st.tremble = ease(st.tremble, slot.alert && !this.reduced ? 1 : 0, 1 - Math.pow(0.01, dt));

      const balls = u.uBalls.value as Vector4[];
      for (let i = 0; i < 5; i += 1) {
        const b = st.balls[i];
        if (b) balls[i].set(b.x, b.y, 0, b.r);
        else balls[i].set(0, 0, 0, 0);
      }
      u.uTime.value = this.reduced ? 3 : now / 1000;
      u.uAlpha.value = alpha;
      u.uGhost.value = st.ghost;
      u.uKind.value = slot.type === 'child' ? 1 : 0;
      u.uExtent.value = ext;
      u.uPx.value = (2 * ext) / (2 * half * dpr);
      (u.uLean.value as Vector2).copy(st.lean);
      u.uTremble.value = st.tremble;
      u.uEnergy.value = st.energy;
      this.blobMat.uniformsNeedUpdate = true;

      gl.setViewport(cx - half, H - (cy + half), half * 2, half * 2);
      gl.setScissor(vx0, H - vy1, vx1 - vx0, vy1 - vy0);
      gl.render(this.quadScene, this.quadCam);
    }
  }
}

