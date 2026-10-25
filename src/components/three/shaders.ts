/**
 * GLSL for the shared scene (INV-00/01/04/13/14). Everything that moves per instance is
 * computed on the GPU: the CPU only updates a handful of uniforms per frame.
 * Colours are raw sRGB-ish values (the canvas runs `flat linear`, no tone mapping).
 */

const ROT = /* glsl */ `
  mat3 rotXYZ(vec3 a) {
    float sx = sin(a.x), cx = cos(a.x), sy = sin(a.y), cy = cos(a.y), sz = sin(a.z), cz = cos(a.z);
    return mat3(
      cy * cz, cy * sz, -sy,
      sx * sy * cz - cx * sz, sx * sy * sz + cx * cz, sx * cy,
      cx * sy * cz + sx * sz, cx * sy * sz - sx * cz, cx * cy
    );
  }
`;

/* ---------- neon ring (INV-01) ---------- */

export const ringVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec2 vSide;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vSide = mv.xy - (modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xy;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const ringFragment = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSaturation;
  uniform float uGlow;
  uniform vec3 uGold;
  uniform vec3 uPink;
  uniform vec3 uViolet;
  uniform vec3 uCool;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec2 vSide;
  void main() {
    // DES-16: warm (gold) arc on the upper left, violet on the right, as in the reference — taken
    // in screen space so the spinning ring keeps it; the warm arc only sways a little.
    float a = atan(vSide.y, vSide.x) - 2.45 + sin(uTime * 0.25) * 0.35;
    float t = 0.5 + 0.5 * cos(a);
    vec3 col = t > 0.5 ? mix(uPink, uGold, (t - 0.5) * 2.0) : mix(uViolet, uPink, t * 2.0);
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float fres = pow(1.0 - facing, 2.0);
    float gray = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(gray) * uCool, col, uSaturation);
    if (uGlow > 0.5) {
      float a2 = pow(facing, 3.0) * 0.3 * uIntensity;
      gl_FragColor = vec4(col * 1.3 * a2, a2 * 0.6);
    } else {
      // emissive > 1 feeds the bloom pass on tier A
      vec3 c = col * (0.9 + fres * 1.8) * uIntensity + vec3(1.0) * pow(facing, 12.0) * 0.45 * uIntensity;
      gl_FragColor = vec4(c, 1.0);
    }
  }
`;

/* ---------- ambient crystals: one instanced draw, motion in the vertex shader ---------- */

export const crystalVertex = /* glsl */ `
  attribute vec3 aOffset;  // xy: normalised field position, z: depth (local units)
  attribute vec4 aSeed;    // x: phase, y/z: speeds, w: depth factor 0..1 (parallax, size)
  attribute float aScale;
  attribute vec3 aColor;
  uniform float uClock;
  uniform vec2 uField;
  uniform vec2 uParallax;
  uniform float uSpread;
  uniform float uFall;
  uniform float uWarp;
  uniform vec2 uPointer;
  uniform float uTanHalf;
  uniform float uAspect;
  uniform float uRepel;
  varying vec3 vColor;
  varying vec3 vView;
  varying float vFlash;
  varying float vDepth;
  ${ROT}
  void main() {
    float ph = aSeed.x;
    vec3 c = vec3(aOffset.xy * uField * (1.0 + uSpread * (0.4 + aSeed.w)), aOffset.z);
    c.x += sin(uClock * aSeed.y + ph) * 0.14;
    c.y += cos(uClock * aSeed.z + ph * 1.3) * 0.18;
    c.xy += uParallax * (0.3 + aSeed.w);
    c.y -= uFall * (1.2 + fract(ph * 7.31) * 2.4);

    vec3 ang = vec3(uClock * aSeed.y * 0.9 + ph, uClock * aSeed.z * 0.7 + ph * 2.0, uClock * 0.3 + ph * 0.5);
    vec3 lp = rotXYZ(ang) * (position * vec3(1.0, 1.9, 1.0) * aScale);

    vec4 cv = modelViewMatrix * vec4(c, 1.0);
    vec4 mv = modelViewMatrix * vec4(c + lp, 1.0);
    vec3 rel = mv.xyz - cv.xyz;

    // pointer repel, in view space at the crystal's own depth
    vec2 pv = uPointer * vec2(uTanHalf * uAspect, uTanHalf) * -cv.z;
    vec2 d = cv.xy - pv;
    float dl = length(d);
    float k = (1.0 - smoothstep(0.0, 0.7 + aSeed.w * 0.5, dl)) * uRepel;
    cv.xy += d / max(dl, 1e-3) * k * 0.5;
    vFlash = k;

    // INV-03 warp: rush outwards/forwards and stretch radially like stars at light speed
    float w = uWarp * (0.5 + aSeed.w);
    vec2 r = normalize(cv.xy + vec2(1e-4));
    cv.xy *= 1.0 + w * 1.6;
    cv.z += w * 1.5;
    rel.xy += r * dot(rel.xy, r) * w * 9.0;

    mv = vec4(cv.xyz + rel, 1.0);
    vView = mv.xyz;
    vColor = aColor;
    vDepth = aSeed.w;
    gl_Position = projectionMatrix * mv;
  }
`;

const FACET_SHADE = /* glsl */ `
  vec3 facetShade(vec3 base, vec3 viewPos) {
    vec3 n = normalize(cross(dFdx(viewPos), dFdy(viewPos)));
    vec3 v = normalize(-viewPos);
    vec3 L1 = normalize(vec3(-0.6, 0.7, 0.5));
    float l1 = max(dot(n, L1), 0.0);
    float l2 = max(dot(n, normalize(vec3(0.7, -0.2, 0.6))), 0.0);
    float l3 = max(dot(n, normalize(vec3(0.0, -0.8, 0.3))), 0.0);
    vec3 col = base * (0.3 + l1 * 0.85)
      + vec3(0.95, 0.6, 0.35) * l1 * 0.22
      + vec3(0.5, 0.3, 0.9) * l2 * 0.45
      + vec3(0.15, 0.27, 0.95) * l3 * 0.4;
    float fres = pow(1.0 - abs(dot(n, v)), 2.0);
    col += base * fres * 0.9;
    col += vec3(1.0) * pow(max(dot(reflect(-L1, n), v), 0.0), 24.0) * 0.55;
    return col;
  }
`;

export const crystalFragment = /* glsl */ `
  uniform float uSaturation;
  uniform float uIntensity;
  uniform vec3 uCool;
  varying vec3 vColor;
  varying vec3 vView;
  varying float vFlash;
  varying float vDepth;
  ${FACET_SHADE}
  void main() {
    vec3 col = facetShade(vColor, vView);
    col += vec3(1.0, 0.92, 1.0) * vFlash * 0.7;
    float g = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(g) * uCool, col, uSaturation);
    col *= uIntensity * mix(0.5, 1.0, vDepth);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ---------- INV-13: crystals assemble a ticket outline, then burst as confetti ---------- */

export const fxVertex = /* glsl */ `
  attribute float aEdge;   // position along the ticket perimeter 0..1
  attribute vec4 aSeed;
  attribute vec3 aColor;
  uniform float uT;        // seconds since the sequence started
  uniform vec4 uRect;      // ticket rect in world units on z = 0: x0, y0, x1, y1
  uniform vec2 uOrigin;    // flash origin (confirm button) in world units
  uniform float uScale;
  varying vec3 vColor;
  varying vec3 vView;
  varying float vGlow;
  ${ROT}
  vec2 perimeter(float e, vec4 r) {
    float w = r.z - r.x;
    float h = r.w - r.y;
    float d = e * 2.0 * (w + h);
    if (d < w) return vec2(r.x + d, r.w);
    d -= w;
    if (d < h) return vec2(r.z, r.w - d);
    d -= h;
    if (d < w) return vec2(r.z - d, r.y);
    d -= w;
    return vec2(r.x, r.y + d);
  }
  void main() {
    float delay = aSeed.x * 0.28;
    float a = clamp((uT - 0.06 - delay) / 0.55, 0.0, 1.0);
    float ea = 1.0 - pow(2.0, -10.0 * a);
    vec2 target = perimeter(aEdge, uRect);
    vec2 start = uOrigin + (aSeed.yz - 0.5) * 0.5;
    vec2 dir = target - start;
    vec2 p = mix(start, target, ea) + vec2(-dir.y, dir.x) * sin(ea * 3.14159) * (aSeed.w - 0.5) * 0.45;
    float z = sin(ea * 3.14159) * 0.9 * (aSeed.w - 0.3);
    float s = uScale * (0.55 + aSeed.z * 0.9) * smoothstep(0.0, 0.12, uT - delay);
    vec3 ang = vec3(aSeed.x * 6.28 + uT * 2.2, aSeed.y * 6.28 + uT * 1.6, aEdge * 6.28);

    float bt = uT - 1.05 - aSeed.y * 0.1;
    float glow = ea;
    if (bt > 0.0) {
      vec2 center = (uRect.xy + uRect.zw) * 0.5;
      vec2 outward = normalize(target - center + vec2(1e-3));
      vec2 v = outward * (1.4 + aSeed.w * 2.6) + vec2((aSeed.y - 0.5) * 1.4, 1.6 + aSeed.z * 1.8);
      p = target + v * bt + vec2(0.0, -2.6) * bt * bt;
      z += (aSeed.x - 0.5) * 2.4 * bt;
      ang += vec3(bt * (3.0 + aSeed.w * 6.0));
      s *= 1.0 - smoothstep(1.1, 2.0, bt);
      glow *= 1.0 - smoothstep(0.0, 0.5, bt);
    }
    vGlow = glow;
    vec3 lp = rotXYZ(ang) * (position * vec3(1.0, 1.8, 1.0) * s);
    vec4 mv = modelViewMatrix * vec4(vec3(p, z) + lp, 1.0);
    vView = mv.xyz;
    vColor = aColor;
    gl_Position = projectionMatrix * mv;
  }
`;

export const fxFragment = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vView;
  varying float vGlow;
  ${FACET_SHADE}
  void main() {
    vec3 col = facetShade(vColor, vView) * 1.15;
    col += vec3(0.75, 0.7, 1.0) * vGlow * 0.55;
    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ---------- INV-04: metaball ticket blobs, SDF raymarch into a DOM-tracked viewport ---------- */

export const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const blobFragment = /* glsl */ `
  uniform vec4 uBalls[5];   // xyz centre, w radius — DOM box spans −1..1
  uniform float uTime;
  uniform float uAlpha;
  uniform float uGhost;
  uniform float uKind;      // 0 full ticket, 1 child ticket
  uniform float uPx;        // blob units per device pixel (edge anti-aliasing)
  uniform float uExtent;    // half-size of the viewport in blob units
  uniform vec2 uLean;
  uniform float uTremble;
  uniform float uEnergy;
  varying vec2 vUv;

  float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
  }
  // DES-06 / SLOP-11: two different objects, not two coloured balls.
  // Full ticket — a neon festival wristband (a tilted torus); several wristbands link up.
  // Child ticket — a "double bubble": a sphere with a smaller one budding off it.
  float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
  }
  vec2 rot2(vec2 v, float a) {
    float c = cos(a), s = sin(a);
    return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
  }
  float map(vec3 p) {
    float d = 10.0;
    float k = mix(0.14, 0.4, uKind);
    for (int i = 0; i < 5; i++) {
      vec4 b = uBalls[i];
      if (b.w > 0.002) {
        float fi = float(i);
        vec3 c = b.xyz;
        c.xy += uLean * (0.12 + 0.08 * fi);
        c.x += sin(uTime * (1.1 + uEnergy) + fi * 1.7) * 0.035 + uTremble * sin(uTime * 38.0 + fi * 2.1) * 0.045;
        c.y += cos(uTime * (0.9 + uEnergy) + fi * 2.3) * 0.045;
        vec3 lp = p - c;
        float di;
        if (uKind < 0.5) {
          lp.xy = rot2(lp.xy, 0.5 + fi * 1.25 + sin(uTime * 0.45 + fi) * 0.25 + uLean.x * 0.6);
          lp.yz = rot2(lp.yz, 1.05 + sin(uTime * 0.6 + fi * 1.9) * 0.18 - uLean.y * 0.5);
          di = sdTorus(lp, vec2(b.w * 0.78, b.w * 0.26));
        } else {
          vec3 bud = vec3(0.62, 0.52, 0.18) * b.w;
          bud.xy = rot2(bud.xy, fi * 2.2 + sin(uTime * 0.7 + fi) * 0.2);
          di = smin(length(lp) - b.w * 0.86, length(lp - bud) - b.w * 0.46, 0.18);
        }
        d = smin(d, di, k);
      }
    }
    return d;
  }
  vec3 calcNormal(vec3 p) {
    const vec2 e = vec2(0.0025, -0.0025);
    return normalize(e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
  }
  void main() {
    vec2 q = (vUv * 2.0 - 1.0) * uExtent;
    vec3 ro = vec3(q, 3.0);
    vec3 rd = vec3(0.0, 0.0, -1.0);
    float t = 0.0;
    float md = 1e3;
    float tm = 0.0;
    bool hit = false;
    for (int i = 0; i < 64; i++) {
      float d = map(ro + rd * t);
      if (d < md) { md = d; tm = t; }
      if (d < 0.0015) { hit = true; break; }
      t += d;
      if (t > 6.0) break;
    }
    float cov = hit ? 1.0 : 1.0 - smoothstep(0.0, uPx * 1.6, md);
    if (cov <= 0.001) discard;
    // edge pixels that just miss are shaded at the closest approach, not behind the blob
    vec3 p = ro + rd * (hit ? t : tm);
    vec3 n = calcNormal(p);
    vec3 v = -rd;
    float fres = pow(1.0 - max(dot(n, v), 0.0), 2.2);

    vec3 full = mix(vec3(0.42, 0.36, 1.0), vec3(0.56, 0.27, 0.88), smoothstep(-0.5, 0.7, n.x - n.y * 0.6));
    full = mix(full, vec3(0.92, 0.42, 0.8), smoothstep(0.25, 0.95, fres));
    vec3 child = mix(vec3(0.42, 0.9, 0.84), vec3(0.12, 0.56, 0.6), smoothstep(-0.6, 0.5, -n.y));
    child = mix(child, vec3(0.04, 0.26, 0.34), smoothstep(0.4, 1.0, fres) * 0.7);
    vec3 base = mix(full, child, uKind);
    vec3 iri = 0.5 + 0.5 * cos(6.28318 * (fres * 0.9 + n.y * 0.25 + n.x * 0.15 + uTime * 0.05 + vec3(0.0, 0.33, 0.67)));
    base = mix(base, iri, (0.14 + 0.3 * fres) * (1.0 - uKind * 0.6));

    vec3 L = normalize(vec3(-0.5, 0.7, 0.6));
    vec3 col = base * (0.38 + 0.72 * max(dot(n, L), 0.0));
    col += vec3(1.0) * pow(max(dot(reflect(-L, n), v), 0.0), 48.0) * 0.95;
    col += vec3(0.55, 0.95, 1.0) * pow(fres, 3.0) * 0.55;
    float g = dot(col, vec3(0.3, 0.59, 0.11));
    col = mix(col, vec3(g) * vec3(0.75, 0.78, 0.95), uGhost * 0.65);
    float a = cov * uAlpha * mix(1.0, 0.36, uGhost);
    gl_FragColor = vec4(col * a, a);
  }
`;

/* ---------- post: bloom (tier A) + composite with the DOM occluder ---------- */

export const brightFragment = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uTexel;
  uniform float uThreshold;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
    c += texture2D(tMap, vUv + uTexel * vec2(1.0, -1.0)).rgb;
    c += texture2D(tMap, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
    c += texture2D(tMap, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    c *= 0.25;
    float l = max(c.r, max(c.g, c.b));
    gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + 0.4, l), 1.0);
  }
`;

export const blurFragment = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv).rgb * 0.2270270270;
    c += texture2D(tMap, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tMap, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tMap, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
    c += texture2D(tMap, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }
`;

export const compositeFragment = /* glsl */ `
  uniform sampler2D tMain;
  uniform sampler2D tBloomA;
  uniform sampler2D tBloomB;
  uniform float uBloom;
  uniform float uAlpha;
  uniform vec4 uOcc;       // occluder rect, device px (GL origin): x0, y0, x1, y1
  uniform float uOccR;
  uniform float uOccOn;
  varying vec2 vUv;
  float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec4 c = texture2D(tMain, vUv);
    if (uBloom > 0.0) {
      c.rgb += (texture2D(tBloomA, vUv).rgb * 0.9 + texture2D(tBloomB, vUv).rgb * 0.8) * uBloom;
    }
    float m = uAlpha;
    if (uOccOn > 0.5) {
      vec2 cen = (uOcc.xy + uOcc.zw) * 0.5;
      vec2 hs = (uOcc.zw - uOcc.xy) * 0.5;
      m *= smoothstep(-0.75, 0.75, sdRoundRect(gl_FragCoord.xy - cen, hs, uOccR));
    }
    // premultiplied output: glow (rgb > alpha) composites additively over the page
    gl_FragColor = c * m;
  }
`;
