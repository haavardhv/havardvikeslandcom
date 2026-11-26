/*
 * havardvikesland.com: a single raymarched scene.
 *
 * Everything is drawn by one fragment shader: signed distance fields for the
 * shapes, analytic soft shadows and ambient occlusion, height fog, and glows
 * built from inverse-distance falloffs (1/(1+x^2), k/(x+e)) and the closed-form
 * integral of a point light scattered through haze.
 */

const canvas = document.getElementById('scene');
const soundBtn = document.getElementById('sound');
const coarse = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
if (!gl) {
  document.documentElement.classList.add('no-webgl');
  throw new Error('WebGL2 not available');
}

/* ------------------------------------------------------------------ *
 *  Shaders
 * ------------------------------------------------------------------ */

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Shared colour grade (gamma space): gentle S-curve for punch, cool shadows,
// warm highlights, and extra saturation only where colour already exists.
const GRADE = `
vec3 grade(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.38);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += vec3(-0.004, 0.003, 0.011) * (1.0 - smoothstep(0.0, 0.3, l));
  c *= mix(vec3(1.0), vec3(1.035, 1.0, 0.955), smoothstep(0.35, 0.9, l));
  float sat = length(c - l);
  return max(mix(vec3(l), c, 1.0 + 0.45 * smoothstep(0.015, 0.1, sat)), 0.0);
}`;

// Temporal anti-aliasing: reproject last frame's history with the camera
// (depth is in alpha), clip it to this frame's 3x3 neighbourhood in YCoCg,
// then blend a little of the new jittered frame in.
const TAA_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uCur;
uniform sampler2D uHist;
uniform vec2 uRes, uJitter;
uniform vec3 uCam, uWW, uUU, uVV;
uniform vec3 uPCam, uPWW, uPUU, uPVV;
uniform float uFocal, uPFocal, uReset;
out vec4 o;
vec3 toY(vec3 c) { return vec3(0.25 * c.r + 0.5 * c.g + 0.25 * c.b, 0.5 * c.r - 0.5 * c.b, -0.25 * c.r + 0.5 * c.g - 0.25 * c.b); }
vec3 fromY(vec3 c) { return vec3(c.x + c.y - c.z, c.x + c.z, c.x - c.y - c.z); }
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  ivec2 hi = ivec2(uRes) - 1;
  vec4 cur = texelFetch(uCur, ip, 0);
  vec3 m1 = vec3(0.0), m2 = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec3 c = toY(texelFetch(uCur, clamp(ip + ivec2(x, y), ivec2(0), hi), 0).rgb);
    m1 += c; m2 += c * c;
  }
  m1 /= 9.0; m2 /= 9.0;
  vec3 sigma = sqrt(max(m2 - m1 * m1, 0.0));

  vec2 uv = (2.0 * (gl_FragCoord.xy + uJitter) - uRes) / uRes.y;
  vec3 rd = normalize(uv.x * uUU + uv.y * uVV + uFocal * uWW);
  vec3 v = uCam + rd * cur.a - uPCam;
  float z = dot(v, uPWW);
  vec2 puv = vec2(dot(v, uPUU), dot(v, uPVV)) / z * uPFocal;
  vec2 tc = (puv * uRes.y + uRes) * 0.5 / uRes;
  bool ok = uReset < 0.5 && z > 0.0 && tc.x > 0.0 && tc.y > 0.0 && tc.x < 1.0 && tc.y < 1.0;

  vec3 hist = fromY(clamp(toY(texture(uHist, tc).rgb), m1 - 1.2 * sigma, m1 + 1.2 * sigma));
  o = vec4(ok ? mix(hist, cur.rgb, 0.1) : cur.rgb, 1.0);
}`;

// Upscale to the display with a halo-free sharpen, then grade, vignette, grain.
const OUT_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImg;
uniform vec2 uSrc, uDst;
uniform float uTime, uFade;
out vec4 o;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
${GRADE}
void main() {
  vec2 tc = gl_FragCoord.xy / uDst;
  vec2 px = 1.0 / uSrc;
  vec3 c = texture(uImg, tc).rgb;
  vec3 n = texture(uImg, tc + vec2(0.0, px.y)).rgb, s = texture(uImg, tc - vec2(0.0, px.y)).rgb;
  vec3 e = texture(uImg, tc + vec2(px.x, 0.0)).rgb, w = texture(uImg, tc - vec2(px.x, 0.0)).rgb;
  vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
  c = clamp(c + (4.0 * c - n - s - e - w) * 0.18, mn, mx);
  c = grade(c);
  c *= 0.32 + 0.68 * pow(16.0 * tc.x * tc.y * (1.0 - tc.x) * (1.0 - tc.y), 0.24);
  c += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5) * 0.022;
  o = vec4(c * uFade, 1.0);
}`;

// Wave equation on a height grid (height in r, velocity in g). Drops are
// segments in uv space: a moving stick pushes the surface along its path.
const SIM_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform int uDropCount;
uniform vec4 uDropSeg[8];    // a.xy, b.xy (uv)
uniform vec2 uDropParam[8];  // radius (uv), strength
uniform vec4 uRing[4];       // shockwave fronts: centre.xy, radius (uv), strength
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec2 info = texture(uPrev, uv).rg;
  float avg = (texture(uPrev, uv + vec2(uTexel.x, 0.0)).r + texture(uPrev, uv - vec2(uTexel.x, 0.0)).r +
               texture(uPrev, uv + vec2(0.0, uTexel.y)).r + texture(uPrev, uv - vec2(0.0, uTexel.y)).r) * 0.25;
  info.g += (avg - info.r) * 0.075;   // coupling: wave speed goes as its square root
  info.g *= 0.9985;
  info.r += info.g;
  info.r *= 0.9996;
  vec2 e = min(uv, 1.0 - uv);
  info *= mix(0.86, 1.0, smoothstep(0.0, 0.07, min(e.x, e.y)));   // absorbing shore, no echoes
  for (int i = 0; i < 8; i++) {
    if (i >= uDropCount) break;
    vec2 a = uDropSeg[i].xy, b = uDropSeg[i].zw;
    vec2 pa = uv - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0);
    float d = max(0.0, 1.0 - length(pa - ba * h) / uDropParam[i].x);
    info.r += (0.5 - 0.5 * cos(d * 3.14159265)) * uDropParam[i].y;
  }
  for (int i = 0; i < 4; i++) {
    if (uRing[i].w == 0.0) continue;
    float d = abs(length(uv - uRing[i].xy) - uRing[i].z) / 0.004;
    info.r += max(0.0, 1.0 - d) * uRing[i].w;
  }
  o = vec4(info, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uRes;
uniform vec2  uJitter;   // sub-pixel offset for temporal anti-aliasing
uniform float uPost;     // 1: output colour + depth for the TAA pass
uniform vec3  uOrbCol;   // the light's colour, breathing slowly
uniform vec4  uShock[4]; // shockwave fronts: centre x, z, radius, strength
uniform float uTime;
uniform vec3  uCam;
uniform vec3  uTarget;
uniform float uFocal;
uniform vec3  uOrb;
uniform float uOrbI;
uniform vec4  uEle;      // x, gait phase, head yaw, head pitch
uniform float uEleZ;
uniform float uTrunk;    // 0 hanging .. 1 raised
uniform vec3  uRocket;   // x, lift, z
uniform float uFire;
uniform vec3  uSun;      // eclipse direction
uniform float uFade;
uniform float uFlare;    // brief brightening on any click
uniform float uStartle;  // elephant flinch
uniform int   uFrame;

#define NSTONE 12
uniform vec4  uStone[NSTONE];   // centre xyz, bounding radius
uniform vec3  uStoneB[NSTONE];  // half extents
uniform mat3  uStoneR[NSTONE];  // world -> local rotation
uniform sampler2D uWater;       // wave simulation: r = height
uniform vec4  uWaterRect;       // min x, min z, size, texel (uv)
uniform float uWaterOn;
uniform vec4  uMetA;           // meteor start direction, progress (<0: none)
uniform vec3  uMetB;           // meteor end direction

// A loop start the compiler cannot prove is 0, so it won't unroll or duplicate
// the scene function at every call site (keeps compile times sane, esp. ANGLE/D3D).
#define ZERO min(uFrame, 0)

#define ORB_COL uOrbCol
const vec3 COR_COL = vec3(0.86, 0.9, 1.0);
const float LEG = 4.2;

/* ---------- noise ---------- */
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = ZERO; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return s;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

/* ---------- distance functions ---------- */
float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float sdBox(vec3 p, vec3 b) { vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.0) / k1; }
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a; float l2 = dot(ba, ba); float rr = r1 - r2; float a2 = l2 - rr * rr; float il2 = 1.0 / l2;
  vec3 pa = p - a; float y = dot(pa, ba); float z = y - l2;
  vec3 xv = pa * l2 - ba * y; float x2 = dot(xv, xv);
  float y2 = y * y * l2; float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

float sdElephant(vec3 p) {
  float bb = sdBox(p - vec3(-0.7, 3.1, 0.0), vec3(2.9, 3.3, 1.4));
  if (bb > 0.4) return bb;

  vec3 bc = vec3(0.0, LEG + 0.55, 0.0);
  bc.y += sin(uEle.y * 2.0) * 0.035 - uStartle * 0.14;
  float d = sdEllipsoid(p - bc, vec3(1.45, 0.9, 0.8));
  d = smin(d, sdEllipsoid(p - bc - vec3(0.35, 0.35, 0.0), vec3(0.9, 0.55, 0.6)), 0.4);

  // head, turning on its neck toward the light
  vec3 q = p - (bc + vec3(-1.15, 0.28, 0.0));
  q.xz = rot(uEle.z) * q.xz;
  q.xy = rot(uEle.w) * q.xy;
  d = smin(d, sdEllipsoid(q - vec3(-0.38, 0.05, 0.0), vec3(0.6, 0.64, 0.55)), 0.3);

  vec3 eq = q - vec3(-0.1, 0.0, 0.0);
  eq.z = abs(eq.z) - 0.48;
  eq.xy = rot(-0.15) * eq.xy;
  eq.xz = rot(uStartle * 0.7) * eq.xz;   // ears flare
  d = smin(d, sdEllipsoid(eq, vec3(0.44, 0.6, 0.09)), 0.1);

  vec3 tq = q; tq.z = abs(tq.z);
  d = min(d, sdCapsule(tq, vec3(-0.7, -0.32, 0.2), vec3(-1.05, -0.6, 0.24), 0.03));

  float sw = sin(uTime * 0.7) * 0.1;
  vec3 t0 = vec3(-0.86, -0.18, 0.0);
  vec3 t1 = t0 + mix(vec3(-0.22, -0.85, sw * 0.4), vec3(-0.55, 0.1, 0.0), uTrunk);
  vec3 t2 = t1 + mix(vec3(0.02, -0.85, sw), vec3(-0.25, 0.6, 0.0), uTrunk);
  vec3 t3 = t2 + mix(vec3(0.16, -0.65, sw * 1.5), vec3(0.15, 0.5, 0.0), uTrunk);
  float tr = sdRoundCone(q, t0, t1, 0.19, 0.14);
  tr = smin(tr, sdRoundCone(q, t1, t2, 0.14, 0.1), 0.05);
  tr = smin(tr, sdRoundCone(q, t2, t3, 0.1, 0.065), 0.04);
  d = smin(d, tr, 0.15);

  // impossibly long legs, walking
  for (int i = ZERO; i < 4; i++) {
    float fx = i < 2 ? -0.82 : 0.88;
    float fz = (i == 0 || i == 3) ? 0.38 : -0.38;
    float ph = uEle.y + ((i == 0 || i == 3) ? 0.0 : 3.14159);
    vec3 hip = vec3(fx, LEG + 0.2, fz);
    vec3 foot = vec3(fx + sin(ph) * 0.32, 0.06 + max(0.0, -cos(ph)) * 0.18, fz);
    vec3 knee = mix(hip, foot, 0.5) + vec3(-0.06, 0.0, 0.0);
    d = min(d, sdRoundCone(p, hip, knee, 0.075, 0.05));
    d = min(d, sdRoundCone(p, knee, foot, 0.05, 0.04));
    d = min(d, sdEllipsoid(p - foot + vec3(0.0, 0.02, 0.0), vec3(0.11, 0.05, 0.11)));
  }
  vec3 tb = bc + vec3(1.42, 0.05, 0.0);
  d = min(d, sdCapsule(p, tb, tb + vec3(0.15 + sin(uTime * 1.3) * 0.05, -0.75, 0.0), 0.022));
  return d;
}

float sdRocket(vec3 p) {
  float bb = length(p - vec3(0.0, 2.6, 0.0)) - 3.4;
  if (bb > 0.4) return bb;
  float d = sdRoundCone(p, vec3(0.0, 0.55, 0.0), vec3(0.0, 3.9, 0.0), 0.4, 0.33);
  d = smin(d, sdEllipsoid(p - vec3(0.0, 4.0, 0.0), vec3(0.33, 1.15, 0.33)), 0.25);
  d = min(d, sdRoundCone(p, vec3(0.0, 0.08, 0.0), vec3(0.0, 0.55, 0.0), 0.26, 0.32));
  float an = 6.2831853 / 3.0;
  float a = atan(p.z, p.x);
  float ca = round(a / an) * an;
  vec2 pr = rot(ca) * p.xz;
  vec3 fp = vec3(pr.x, p.y, pr.y) - vec3(0.55, 0.7, 0.0);
  fp.xy = rot(0.35) * fp.xy;
  d = min(d, sdBox(fp, vec3(0.3, 0.55, 0.018)) - 0.008);
  return d;
}

// The floating slabs; positions and rotations come from the CPU physics.
vec2 sdStones(vec3 p) {
  vec2 res = vec2(1e9, 3.0);
  for (int i = ZERO; i < NSTONE; i++) {
    vec3 q = p - uStone[i].xyz;
    float bs = length(q) - uStone[i].w;
    if (bs > 0.25) { res.x = min(res.x, bs); continue; }   // cheap bound while far away
    q = uStoneR[i] * q;
    float d = sdBox(q, uStoneB[i] - 0.03) - 0.03;
    if (d < res.x) res = vec2(d, (i % 4 == 0) ? 4.0 : 3.0);
  }
  return res;
}

vec2 mapObj(vec3 p) {
  vec2 res = vec2(sdElephant(p - vec3(uEle.x, 0.0, uEleZ)), 1.0);
  float r = sdRocket(p - vec3(uRocket.x, uRocket.y, uRocket.z));
  if (r < res.x) res = vec2(r, 2.0);
  vec2 st = sdStones(p);
  if (st.x < res.x) res = st;
  return res;
}

vec3 calcNormal(vec3 p) {
  vec3 n = vec3(0.0);
  for (int i = ZERO; i < 4; i++) {
    vec3 e = 0.5773 * (2.0 * vec3(float(((i + 3) >> 1) & 1), float((i >> 1) & 1), float(i & 1)) - 1.0);
    n += e * mapObj(p + 0.0015 * e).x;
  }
  return normalize(n);
}

vec2 march(vec3 ro, vec3 rd, float tmax, int steps) {
  float t = 0.05;
  for (int i = ZERO; i < 160; i++) {
    if (i >= steps) break;
    vec2 h = mapObj(ro + rd * t);
    if (abs(h.x) < 0.0006 * t) return vec2(t, h.y);
    t += h.x * 0.8;
    if (t > tmax) break;
  }
  return vec2(1e9, -1.0);
}

// Primary march that also records the closest near miss, so silhouettes can be
// blended by how much of the pixel cone they cover (single-sample anti-aliasing).
vec2 marchAA(vec3 ro, vec3 rd, float tmax, float pxr, out vec3 edge) {
  float t = 0.05;
  edge = vec3(0.0, 0.0, -1.0);   // coverage, t, material
  for (int i = ZERO; i < 160; i++) {
    vec2 h = mapObj(ro + rd * t);
    if (abs(h.x) < 0.0006 * t) return vec2(t, h.y);
    float c = 1.0 - clamp(h.x / (pxr * t), 0.0, 1.0);
    if (c > edge.x) edge = vec3(c, t, h.y);
    t += h.x * 0.8;
    if (t > tmax) break;
  }
  return vec2(1e9, -1.0);
}

float softShadow(vec3 ro, vec3 rd, float maxt, float k) {
  float res = 1.0, t = 0.03, ph = 1e10;
  for (int i = ZERO; i < 48; i++) {
    float h = mapObj(ro + rd * t).x;
    float y = h * h / (2.0 * ph);
    float d = sqrt(max(h * h - y * y, 0.0));
    res = min(res, k * d / max(0.0, t - y));
    ph = h;
    t += clamp(h, 0.03, 0.6);
    if (res < 0.002 || t > maxt) break;
  }
  res = clamp(res, 0.0, 1.0);
  return res * res * (3.0 - 2.0 * res);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0, sca = 1.0;
  for (int i = ZERO; i < 5; i++) {
    float h = 0.03 + 0.16 * float(i);
    occ += (h - mapObj(p + n * h).x) * sca;
    sca *= 0.85;
  }
  return clamp(1.0 - 1.2 * occ, 0.0, 1.0);
}

/* ---------- sky, haze, glows ---------- */
// Angle from the eclipse centre, and the unit direction around it (n).
float sunAngle(vec3 rd, out vec2 n) {
  float ca = dot(rd, uSun);
  vec3 up = normalize(cross(cross(uSun, vec3(0.0, 1.0, 0.0)), uSun));
  vec3 rt = cross(uSun, up);
  vec3 sd = rd - uSun * ca;
  n = normalize(vec2(dot(sd, rt), dot(sd, up)) + 1e-6);
  return acos(clamp(ca, -1.0, 1.0));
}

// The corona's slow breathing, shared by everything it lights.
float breathe() { return 1.0 + 0.06 * sin(uTime * 0.37) + 0.04 * sin(uTime * 0.91); }

// Corona streamers as radial lobes: for each direction d, pow(max(dot(n, d), 0), p)
// gives a soft wedge, and 1/(1 + x/reach) fades it out from the limb. The
// directions drift at their own speeds and the reaches pulse, so it moves.
float streamers(vec2 n, float xs) {
  n = rot(xs * 3.5) * n;   // streamers bend a little as they leave the limb
  float s = 0.0;
  for (int i = ZERO; i < 9; i++) {
    float fi = float(i);
    float ang = fi * 2.39996 + uTime * (0.018 + 0.014 * sin(fi * 1.7));   // golden-angle spread, own drift
    vec2 d = vec2(cos(ang), sin(ang));
    float sharp = 10.0 + 34.0 * fract(sin(fi * 12.9898) * 43758.5453);
    float reach = 0.03 + 0.04 * (0.5 + 0.5 * sin(uTime * (0.17 + 0.05 * fi) + fi * 4.1));
    s += pow(max(dot(n, d), 0.0), sharp) / (1.0 + xs / reach);
  }
  return s;
}

vec3 hazeColor(vec3 rd) {
  float a = acos(clamp(dot(rd, uSun), -1.0, 1.0));
  float c = max(dot(rd, uSun), 0.0);
  vec3 col = vec3(0.0065, 0.0065, 0.009);
  col += COR_COL * 0.06 * breathe() * (1.0 + uFlare) / (1.0 + (a / 0.2) * (a / 0.2));   // forward scatter toward the eclipse
  col += vec3(0.05, 0.035, 0.04) * pow(c, 6.0) * 0.4;
  return col;
}

vec3 sky(vec3 rd) {
  float y = max(rd.y, 0.0);
  vec3 col = mix(hazeColor(rd), vec3(0.0012, 0.0014, 0.0026), pow(y, 0.5));
  vec2 n;
  float a = sunAngle(rd, n);
  float br = breathe();

  // stars, each a tiny 1/(1+x^2) point
  vec3 q = rd * 260.0;
  vec3 id = floor(q);
  float h = hash13(id);
  if (h > 0.996) {
    vec3 f = fract(q) - 0.5;
    float tw = 0.6 + 0.4 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
    col += vec3(0.8, 0.85, 1.0) * tw * 0.35 / (1.0 + dot(f, f) * 260.0) * smoothstep(0.05, 0.4, y);
  }

  // a meteor now and then: a line light with a fading tail
  if (uMetA.w >= 0.0) {
    float p = uMetA.w;
    vec3 head = normalize(mix(uMetA.xyz, uMetB, min(p, 1.0)));
    vec3 tail = normalize(mix(uMetA.xyz, uMetB, max(p - 0.35, 0.0)));
    vec3 sg = head - tail;
    float hh = clamp(dot(rd - tail, sg) / max(dot(sg, sg), 1e-9), 0.0, 1.0);
    float d = length(rd - (tail + sg * hh));
    float fade = smoothstep(0.0, 0.08, p) * (1.0 - smoothstep(0.75, 1.3, p)) * hh * hh;
    vec3 mc = mix(vec3(0.35, 1.0, 0.8), vec3(0.95, 0.97, 1.0), hh * hh * hh);
    col += mc * fade * (0.6 / (1.0 + d * d * 4e6) + 0.02 / (1.0 + d * d * 2e4));
  }

  // the eclipse: k/(x+e) glow shaped by moving radial streamers
  const float R = 0.083;
  float x = a - R;
  float xs = max(x, 0.0);
  float corona = 0.0025 / (xs + 0.0028);                      // k/(x+e)
  float st = 0.3 + 1.4 * streamers(n, xs);
  corona *= mix(1.0, st, smoothstep(0.0, 0.03, xs)) * br * (1.0 + uFlare * 1.4);
  corona += 0.0006 / (xs * xs * 40.0 + 0.0006) * 0.6;         // thin bright limb, 1/(1+x^2)
  float chrom = 0.35 / (1.0 + (xs / 0.0022) * (xs / 0.0022)) * br;   // the pink chromosphere, a hairline
  vec3 ccol = mix(vec3(1.0, 0.96, 0.92), COR_COL * vec3(0.8, 0.85, 1.0), smoothstep(0.0, 0.12, xs));
  float prom = pow(vnoise(n * 6.0 + 3.0 + vec2(uTime * 0.02, 0.0)), 6.0) * (2.0 + sin(uTime * 1.3 + n.x * 3.0)) / (1.0 + xs * xs * 60000.0);
  vec3 eclipse = ccol * corona * 0.55 + vec3(1.0, 0.35, 0.4) * prom + vec3(1.0, 0.3, 0.45) * chrom;
  float px = 2.0 / (uRes.y * uFocal);
  float disk = smoothstep(-px, px, x);
  float hz = smoothstep(-0.02, 0.18, rd.y);                    // sinks into the haze near the horizon
  col = col * disk + eclipse * disk * mix(0.35, 1.0, hz);

  // thin drifting clouds low in the sky: dark, with silver edges near the eclipse
  if (rd.y > 0.0) {
    vec2 cp = rd.xz / (rd.y + 0.06) * vec2(0.35, 1.1) + vec2(uTime * 0.012, 0.0);
    float dens = fbm(cp * 1.6 + vec2(0.0, uTime * 0.004));
    dens = smoothstep(0.52, 0.8, dens) * smoothstep(0.02, 0.08, rd.y) * (1.0 - smoothstep(0.22, 0.45, rd.y));
    // lit by the corona ring, not the dark disk: clouds over the disk stay dark
    float xr = max(x, 0.0) / 0.05;
    float lit = 0.22 / (1.0 + xr * xr) * smoothstep(-0.025, 0.006, x) + 0.025 / (1.0 + a / 0.3);
    vec3 cc = vec3(0.004, 0.0042, 0.006) + COR_COL * lit * (0.3 + 0.7 * (1.0 - dens)) * br;
    col = mix(col, cc, dens * 0.85);
  }
  return col;
}

// Closest distance between a ray and a point, plus the ray parameter there.
vec2 rayPoint(vec3 ro, vec3 rd, vec3 p) {
  vec3 op = p - ro;
  float b = dot(op, rd);
  return vec2(sqrt(max(dot(op, op) - b * b, 1e-7)), b);
}

vec3 orbLight(vec3 ro, vec3 rd, float tmax) {
  vec2 hp = rayPoint(ro, rd, uOrb);
  float h = hp.x, b = hp.y;
  float vis = (b > 0.0 && b < tmax) ? 1.0 : 0.0;
  float core = 1.0 / (1.0 + h * h * 2600.0);
  float halo = 1.0 / (1.0 + h * h * 30.0);
  // haze in-scattering: integral of 1/(h^2 + (s-b)^2) ds over [0, tm]
  float tm = min(tmax, 80.0);
  float scat = (atan((tm - b) / h) + atan(b / h)) / h;
  return ORB_COL * uOrbI * (vis * (core * 6.0 + halo * 0.06) + scat * 0.006);
}

vec3 rocketLights(vec3 ro, vec3 rd, float tmax) {
  vec3 col = vec3(0.0);
  vec3 base = vec3(uRocket.x, uRocket.y, uRocket.z);
  // beacon on the nose, slow blink
  vec2 bp = rayPoint(ro, rd, base + vec3(0.0, 5.18, 0.0));
  float blink = pow(max(sin(uTime * 1.4), 0.0), 18.0);
  if (bp.y < tmax + 0.2) col += vec3(1.0, 0.18, 0.12) * blink * (0.6 / (1.0 + bp.x * bp.x * 9000.0) + 0.012 / (1.0 + bp.x * bp.x * 40.0));
  // exhaust: a line light under the nozzle
  if (uFire > 0.001) {
    vec3 A = base + vec3(0.0, 0.05, 0.0);
    vec3 B = base - vec3(0.0, 1.6 + 0.6 * uFire, 0.0);
    vec3 ba = B - A, w0 = ro - A;
    float bb = dot(rd, ba), c = dot(ba, ba), d = dot(rd, w0), e = dot(ba, w0);
    float s = clamp((e - bb * d) / max(c - bb * bb, 1e-5), 0.0, 1.0);
    vec3 P = A + ba * s;
    vec2 ep = rayPoint(ro, rd, P);
    float fl = 0.8 + 0.2 * vnoise(vec2(uTime * 25.0, s * 6.0));
    float w = mix(1.0, 0.25, s);
    vec3 fc = mix(mix(vec3(1.0, 0.92, 0.8), vec3(1.0, 0.5, 0.14), smoothstep(0.0, 0.45, s)), vec3(0.85, 0.16, 0.05), smoothstep(0.45, 1.0, s));
    float occl = ep.y < tmax + 0.3 ? 1.0 : 0.0;
    col += fc * uFire * fl * occl * w * (0.9 / (1.0 + ep.x * ep.x * 1800.0) + 0.04 / (1.0 + ep.x * ep.x * 25.0));
  }
  return col;
}

vec3 applyFog(vec3 col, vec3 ro, vec3 rd, float t) {
  const float a = 0.04, b = 0.55;
  float k = rd.y * b;
  float f = a * exp(-ro.y * b) * (abs(k) < 1e-4 ? t : (1.0 - exp(-t * k)) / k);
  return mix(col, hazeColor(rd), 1.0 - exp(-f));
}

/* ---------- shading ---------- */
vec3 shadeObj(vec3 p, vec3 rd, float id, bool cheap) {
  vec3 n = calcNormal(p);
  vec3 alb = id < 1.5 ? vec3(0.4, 0.38, 0.36) : id < 2.5 ? vec3(0.07, 0.07, 0.075) : id < 3.5 ? vec3(0.035, 0.034, 0.036) : vec3(0.32, 0.3, 0.28);
  vec3 L = uOrb - p;
  float dl = length(L);
  L /= dl;
  float att = uOrbI / (1.0 + 0.22 * dl * dl);
  float wrap = id < 1.5 ? 0.25 : 0.0;
  float dif = clamp((dot(n, L) + wrap) / (1.0 + wrap), 0.0, 1.0);
  float sh = cheap ? 1.0 : softShadow(p + n * 0.04, L, dl, 10.0);
  float ao = cheap ? 1.0 : calcAO(p, n);
  if (id < 1.5) alb *= 0.8 + 0.35 * fbm(p.xy * 5.0 + p.z * 3.0);   // weathered skin
  vec3 col = alb * ORB_COL * dif * att * sh;
  if (id > 1.5) {
    vec3 hv = normalize(L - rd);
    col += ORB_COL * att * sh * pow(max(dot(n, hv), 0.0), 48.0) * 0.5;
  }
  col += alb * (vec3(0.03, 0.031, 0.04) * (0.55 + 0.45 * n.y)) * ao;
  float rim = pow(clamp(1.0 + dot(n, rd), 0.0, 1.0), 3.0) * ao;
  col += COR_COL * rim * (0.1 * smoothstep(0.6, 1.0, dot(rd, uSun)) + 0.015);
  return col;
}

vec3 traceReflection(vec3 ro, vec3 rd) {
  vec2 h = march(ro, rd, 60.0, 56);
  vec3 col;
  float t = h.x;
  if (h.y > 0.0) col = shadeObj(ro + rd * t, rd, h.y, true);
  else { col = sky(rd); t = 1e4; }
  col = applyFog(col, ro, rd, min(t, 400.0));
  col += orbLight(ro, rd, t) * 0.9;
  col += rocketLights(ro, rd, t);
  return col;
}

vec3 shadeGround(vec3 p, vec3 ro, vec3 rd) {
  float wet = smoothstep(0.2, 0.5, fbm(p.xz * 0.11 + 3.0));
  vec2 e = vec2(0.04, 0.0);
  vec2 g = vec2(fbm(p.xz * 1.4 + e.xy) - fbm(p.xz * 1.4 - e.xy), fbm(p.xz * 1.4 + e.yx) - fbm(p.xz * 1.4 - e.yx)) / (2.0 * e.x);
  float amp = mix(0.07, 0.012, wet) / (1.0 + 0.08 * length(p - ro));   // fade detail with distance: no sparkle
  vec3 n = normalize(vec3(-g.x * amp, 1.0, -g.y * amp));

  // waves from the simulation
  float slope = 0.0;
  if (uWaterOn > 0.5) {
    vec2 wuv = (p.xz - uWaterRect.xy) / uWaterRect.z;
    if (wuv.x > 0.0 && wuv.y > 0.0 && wuv.x < 1.0 && wuv.y < 1.0) {
      float tx = uWaterRect.w;
      vec2 gw = vec2(texture(uWater, wuv + vec2(tx, 0.0)).r - texture(uWater, wuv - vec2(tx, 0.0)).r,
                     texture(uWater, wuv + vec2(0.0, tx)).r - texture(uWater, wuv - vec2(0.0, tx)).r) * 6.0;
      // fade with distance, 1/(1 + k d^4): full up close, gone where grazing angles would streak
      float wd = length(p - ro);
      gw /= 1.0 + 2e-5 * wd * wd * wd * wd;
      slope = length(gw);
      n = normalize(n + vec3(-gw.x, 0.0, -gw.y));
    }
  }

  vec3 R = reflect(rd, n);
  R.y = abs(R.y);
  float fre = 0.02 + 0.98 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
  vec3 refl = traceReflection(p + vec3(0.0, 0.01, 0.0), R);

  vec3 L = uOrb - p;
  float dl = length(L);
  L /= dl;
  float att = uOrbI / (1.0 + 0.22 * dl * dl);
  float sh = softShadow(p + vec3(0.0, 0.01, 0.0), L, dl, 9.0);
  float ao = calcAO(p, vec3(0.0, 1.0, 0.0));
  vec3 alb = mix(vec3(0.05, 0.048, 0.05), vec3(0.02, 0.02, 0.022), wet);
  vec3 diff = alb * ORB_COL * max(dot(n, L), 0.0) * att * sh + alb * vec3(0.03, 0.03, 0.038) * ao;
  vec3 col = mix(diff, refl * ao, clamp(fre * mix(0.35, 1.0, wet) + wet * 0.12, 0.0, 1.0));
  // shockwave fronts: a travelling ring of light, 1/(1+x^2) across its width
  for (int i = ZERO; i < 4; i++) {
    if (uShock[i].w <= 0.0) continue;
    float dd = length(p.xz - uShock[i].xy) - uShock[i].z;
    col += ORB_COL * uShock[i].w * 0.16 / (1.0 + dd * dd * 14.0);
  }
  // wave slopes catch the light and the glow of the sky (1/(1+x^2) falloff with distance)
  float near = 1.0 / (1.0 + 0.004 * dot(p - ro, p - ro));
  col += ORB_COL * att * slope * 0.5 * sh + vec3(0.55, 0.57, 0.66) * min(slope, 1.5) * 0.045 * near;
  return col;
}

${GRADE}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main() {
  vec2 uv = (2.0 * (gl_FragCoord.xy + uJitter) - uRes) / uRes.y;
  vec3 ww = normalize(uTarget - uCam);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + uFocal * ww);
  vec3 ro = uCam;

  float tG = rd.y < 0.0 ? -ro.y / rd.y : 1e9;
  float pxr = 1.6 / (uRes.y * uFocal);
  vec3 edge;
  vec2 hit = marchAA(ro, rd, min(tG, 90.0), pxr, edge);
  bool onObj = hit.y > 0.0 && hit.x < tG;
  float t = onObj ? hit.x : (tG < 1e8 ? tG : 1e4);
  vec3 col = vec3(0.0);
  float cover = 1.0;
  if (!onObj) {
    col = tG < 1e8 ? shadeGround(ro + rd * t, ro, rd) : sky(rd);
    col = applyFog(col, ro, rd, min(t, 400.0));
    cover = edge.y < t - 0.02 ? edge.x : 0.0;
  }
  if (cover > 0.0) {
    // either a direct hit, or a silhouette edge blended by pixel coverage
    float ts = onObj ? t : edge.y;
    vec3 oc = applyFog(shadeObj(ro + rd * ts, rd, onObj ? hit.y : edge.z, false), ro, rd, ts);
    col = mix(col, oc, cover);
  }
  col += orbLight(ro, rd, t);
  col += rocketLights(ro, rd, t);

  col = aces(col * 1.6);
  col = pow(col, vec3(1.0 / 2.2));
  if (uPost > 0.5) { fragColor = vec4(col, t); return; }   // graded after TAA

  // fallback without post-processing
  col = grade(col);
  vec2 q = gl_FragCoord.xy / uRes;
  col *= 0.35 + 0.65 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.22);
  col += (hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 113.0) - 0.5) * 0.028;
  fragColor = vec4(col * uFade, 1.0);
}`;

// Compile without blocking the page where the browser allows it, so the text
// shows immediately and the scene fades in once the shader is ready.
const parallel = gl.getExtension('KHR_parallel_shader_compile');
const prog = gl.createProgram();
const vs = gl.createShader(gl.VERTEX_SHADER);
const fs = gl.createShader(gl.FRAGMENT_SHADER);
gl.shaderSource(vs, VERT);
gl.shaderSource(fs, FRAG);
gl.compileShader(vs);
gl.compileShader(fs);
gl.attachShader(prog, vs);
gl.attachShader(prog, fs);
gl.linkProgram(prog);

const U = {};
function finishProgram() {
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog));
    document.documentElement.classList.add('no-webgl');
    return false;
  }
  gl.useProgram(prog);
  gl.bindVertexArray(gl.createVertexArray());
  for (const name of ['uRes', 'uTime', 'uCam', 'uTarget', 'uFocal', 'uOrb', 'uOrbI', 'uEle', 'uEleZ', 'uTrunk', 'uRocket', 'uFire', 'uSun', 'uFade', 'uFlare', 'uStartle', 'uFrame', 'uStone', 'uStoneB', 'uStoneR', 'uWater', 'uWaterRect', 'uWaterOn', 'uMetA', 'uMetB', 'uJitter', 'uPost', 'uOrbCol', 'uShock']) {
    U[name] = gl.getUniformLocation(prog, name);
  }
  return true;
}

/* ------------------------------------------------------------------ *
 *  Water: a wave simulation on the GPU, ping-ponging two float textures
 * ------------------------------------------------------------------ */

const SIM = 320;
const WATER = { minX: -24, minZ: -34, size: 48 };   // world rect the grid covers
let water = null;
const drops = [];

function initWater() {
  if (!gl.getExtension('EXT_color_buffer_float')) return null;
  const p = gl.createProgram();
  const v = gl.createShader(gl.VERTEX_SHADER);
  const f = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(v, VERT);
  gl.shaderSource(f, SIM_FRAG);
  gl.compileShader(v);
  gl.compileShader(f);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getShaderInfoLog(f)); return null; }
  const target = () => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, SIM, SIM, 0, gl.RG, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb };
  };
  const a = target();
  const b = target();
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (!ok) return null;
  const u = {};
  for (const n of ['uPrev', 'uTexel', 'uDropCount', 'uDropSeg', 'uDropParam', 'uRing']) u[n] = gl.getUniformLocation(p, n);
  return { prog: p, u, src: a, dst: b, acc: 0, seg: new Float32Array(32), param: new Float32Array(16) };
}

// Shockwaves: a click sends a front outward; things react when it arrives.
const SHOCK_SPEED = 6;
const shocks = [];
function shockRings() {
  const a = new Float32Array(16);
  shocks.slice(0, 4).forEach((sh, i) => {
    const r = sh.age * SHOCK_SPEED;
    a.set([(sh.o[0] - WATER.minX) / WATER.size, (sh.o[2] - WATER.minZ) / WATER.size, r / WATER.size, -0.012 * sh.str * Math.exp(-sh.age * 0.5)], i * 4);
  });
  return a;
}
function shockUniforms() {
  const a = new Float32Array(16);
  shocks.slice(0, 4).forEach((sh, i) => {
    const r = sh.age * SHOCK_SPEED;
    a.set([sh.o[0], sh.o[2], r, sh.str * Math.exp(-sh.age * 0.45) / (1 + r * 0.08) * Math.min(1, sh.age * 8)], i * 4);
  });
  return a;
}

// Push the water along a world-space segment (a stick dragged through it).
function addDrop(ax, az, bx, bz, radius, strength) {
  if (!water || drops.length >= 8) return;
  const S = WATER.size;
  drops.push([(ax - WATER.minX) / S, (az - WATER.minZ) / S, (bx - WATER.minX) / S, (bz - WATER.minZ) / S, radius / S, strength]);
}

function stepWater(dt) {
  if (!water) return;
  water.acc = Math.min(water.acc + dt, 0.1);
  let steps = 0;
  while (water.acc >= 1 / 60 && steps < 3) { water.acc -= 1 / 60; steps++; }
  if (drops.length && !steps) steps = 1;
  if (!steps) return;
  gl.useProgram(water.prog);
  gl.viewport(0, 0, SIM, SIM);
  gl.uniform2f(water.u.uTexel, 1 / SIM, 1 / SIM);
  gl.uniform4fv(water.u.uRing, shockRings());
  gl.uniform1i(water.u.uPrev, 0);
  gl.activeTexture(gl.TEXTURE0);
  for (let k = 0; k < steps; k++) {
    const n = k === 0 ? drops.length : 0;
    for (let i = 0; i < n; i++) {
      water.seg.set(drops[i].slice(0, 4), i * 4);
      water.param.set(drops[i].slice(4, 6), i * 2);
    }
    gl.uniform1i(water.u.uDropCount, n);
    if (n) {
      gl.uniform4fv(water.u.uDropSeg, water.seg);
      gl.uniform2fv(water.u.uDropParam, water.param);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, water.dst.fb);
    gl.bindTexture(gl.TEXTURE_2D, water.src.tex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [water.src, water.dst] = [water.dst, water.src];
  }
  drops.length = 0;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.useProgram(prog);
}

/* ------------------------------------------------------------------ *
 *  Post: render the scene jittered into a float buffer, resolve with TAA,
 *  then upscale to the display. Falls back to direct rendering.
 * ------------------------------------------------------------------ */

let post = null;

function program(fragSrc, names) {
  const p = gl.createProgram();
  const v = gl.createShader(gl.VERTEX_SHADER);
  const f = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(v, VERT);
  gl.shaderSource(f, fragSrc);
  gl.compileShader(v);
  gl.compileShader(f);
  gl.attachShader(p, v);
  gl.attachShader(p, f);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error(gl.getShaderInfoLog(f)); return null; }
  const u = {};
  for (const n of names) u[n] = gl.getUniformLocation(p, n);
  return { p, u };
}

function floatTarget(w, h, filter) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return ok ? { tex, fb } : null;
}

function initPost() {
  if (!gl.getExtension('EXT_color_buffer_float')) return null;
  const taa = program(TAA_FRAG, ['uCur', 'uHist', 'uRes', 'uJitter', 'uCam', 'uWW', 'uUU', 'uVV', 'uPCam', 'uPWW', 'uPUU', 'uPVV', 'uFocal', 'uPFocal', 'uReset']);
  const out = program(OUT_FRAG, ['uImg', 'uSrc', 'uDst', 'uTime', 'uFade']);
  if (!taa || !out) return null;
  return { taa, out, w: 0, h: 0, scene: null, hist: [null, null], cur: 0, reset: true, prev: null };
}

function sizePost(w, h) {
  if (!post || (post.w === w && post.h === h)) return;
  for (const t of [post.scene, ...post.hist]) if (t) { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); }
  post.scene = floatTarget(w, h, gl.NEAREST);
  post.hist = [floatTarget(w, h, gl.LINEAR), floatTarget(w, h, gl.LINEAR)];
  post.w = w;
  post.h = h;
  post.reset = true;
  if (!post.scene || !post.hist[0] || !post.hist[1]) post = null;
}

// Halton (2, 3): well-spread sub-pixel offsets over 8 frames.
function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }

/* ------------------------------------------------------------------ *
 *  Small vector helpers (CPU side mirrors the shader camera)
 * ------------------------------------------------------------------ */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const damp = (speed, dt) => 1 - Math.exp(-speed * dt);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function basis(cam, target) {
  const ww = norm(sub(target, cam));
  const uu = norm(cross(ww, [0, 1, 0]));
  const vv = cross(uu, ww);
  return { ww, uu, vv };
}

/* ------------------------------------------------------------------ *
 *  Sound: a quiet room with a reverb tail, off until asked for
 * ------------------------------------------------------------------ */

const audio = {
  ctx: null, out: null, verb: null, bus: null, on: false,
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(ctx.destination);
    // generated impulse response: decaying noise
    const len = ctx.sampleRate * 4;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.verb = ctx.createConvolver();
    this.verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    this.verb.connect(wet).connect(this.out);
    this.bus = ctx.createGain();
    this.bus.connect(this.out);
    this.bus.connect(this.verb);

    // ambient bed: low detuned tones and slow wind
    const drone = ctx.createGain();
    drone.gain.value = 0.05;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoG.gain.value = 120;
    lfo.connect(lfoG).connect(lp.frequency);
    lfo.start();
    for (const [f, type] of [[55, 'sine'], [82.6, 'triangle'], [55.3, 'sine'], [110.2, 'sine']]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = f > 100 ? 0.25 : 0.6;
      o.connect(g).connect(lp);
      o.start();
    }
    const nbuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const wind = ctx.createBufferSource();
    wind.buffer = nbuf;
    wind.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 500;
    bp.Q.value = 0.7;
    const wg = ctx.createGain();
    wg.gain.value = 0.25;
    const lfo2 = ctx.createOscillator();
    const lfo2G = ctx.createGain();
    lfo2.frequency.value = 0.07;
    lfo2G.gain.value = 0.2;
    lfo2.connect(lfo2G).connect(wg.gain);
    lfo2.start();
    wind.connect(bp).connect(wg).connect(lp);
    wind.start();
    // water being stirred: band-passed noise, loudness follows drag speed
    const sw = ctx.createBufferSource();
    sw.buffer = nbuf;
    sw.loop = true;
    const sbp = ctx.createBiquadFilter();
    sbp.type = 'bandpass';
    sbp.frequency.value = 1100;
    sbp.Q.value = 0.9;
    this.swishG = ctx.createGain();
    this.swishG.gain.value = 0;
    sw.connect(sbp).connect(this.swishG).connect(this.bus);
    sw.start();
    lp.connect(drone).connect(this.bus);
  },
  set(on) {
    this.on = on;
    if (on) this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(now);
    this.out.gain.setTargetAtTime(on ? 0.9 : 0, now, on ? 0.8 : 0.2);
  },
  env(t, peak, a, h, r) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + h);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + h + r);
    g.connect(this.bus);
    return g;
  },
  swish(speed) {
    if (!this.ctx || !this.swishG) return;
    this.swishG.gain.setTargetAtTime(this.on ? Math.min(0.3, speed * 0.05) : 0, this.ctx.currentTime, 0.06);
  },
  pulse() {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(96, t);
    o.frequency.exponentialRampToValueAtTime(41, t + 1.4);
    o.connect(this.env(t, 0.5, 0.02, 0.1, 1.6));
    o.start(t);
    o.stop(t + 2);
    for (const f of [1318.5, 1975.5]) {
      const s = this.ctx.createOscillator();
      s.frequency.value = f;
      s.connect(this.env(t + 0.03, 0.025, 0.01, 0.05, 2.2));
      s.start(t);
      s.stop(t + 2.5);
    }
  },
  horn() {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(600, t);
    f.frequency.exponentialRampToValueAtTime(200, t + 3.5);
    f.connect(this.env(t, 0.22, 0.6, 1.0, 2.4));
    for (const fr of [55, 82.4, 110.7]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(fr * 1.04, t);
      o.frequency.exponentialRampToValueAtTime(fr * 0.92, t + 4);
      o.connect(f);
      o.start(t);
      o.stop(t + 4.2);
    }
  },
  launch() {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const n = this.ctx.createBufferSource();
    const len = this.ctx.sampleRate * 7;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(90, t);
    f.frequency.exponentialRampToValueAtTime(380, t + 3);
    f.frequency.exponentialRampToValueAtTime(120, t + 7);
    n.connect(f).connect(this.env(t, 0.6, 1.2, 2.5, 3));
    n.start(t);
    n.stop(t + 7);
  },
};

function syncSound() {
  soundBtn.setAttribute('aria-pressed', String(audio.on));
  soundBtn.querySelector('span').textContent = audio.on ? 'on' : 'off';
}
soundBtn.addEventListener('click', () => { audio.set(!audio.on); syncSound(); });
syncSound();

/* ------------------------------------------------------------------ *
 *  Scene state
 * ------------------------------------------------------------------ */

const state = {
  cam: [0, 1.7, 6],
  target: [0, 2.7, -10],
  camBase: [0, 1.7, 6],
  focal: 1.9,
  orb: [0, 1.8, -8],
  orbI: 0,
  orbCol: [1, 0.8, 0.6],
  ele: { x: 1, phase: 0, yaw: 0, pitch: 0, trunk: 0, trunkT: 99, z: -12, startle: 0, snap: 0 },
  rocket: { x: 14, z: -34, lift: 0, fire: 0, mode: 'idle', t: 0, cough: 0, shake: 0 },
  flare: 0,
  meteor: { a: [0, 1, 0], b: [0, 1, 0], p: -1, next: 5 },
  sun: norm([-0.1, 0.165, -1]),
  halfW: 16,
};

// ?scale=1 pins the render resolution (handy for screenshots).
const params = new URLSearchParams(location.search);
const pinnedScale = parseFloat(params.get('scale'));
// ?substeps=N runs the simulation N times per frame (for testing on slow machines).
const substeps = Math.min(20, Math.max(1, parseInt(params.get('substeps'), 10) || 1));
let renderScale = pinnedScale > 0 ? pinnedScale : 0.7;
const maxScale = 1;
const minScale = 0.45;
// Never shade more than this many pixels per frame, whatever the screen size.
const pixelBudget = coarse ? 900000 : 1500000;

// Floating slabs: simple rigid bodies drawn by the shader.
const NSTONE = 12;
const stones = (() => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const list = [];
  for (let i = 0; i < NSTONE; i++) {
    const s = 0.12 + rnd() * 0.34;
    const b = [s * (0.55 + rnd() * 0.5), s * (0.8 + rnd() * 0.6), s * (0.08 + rnd() * 0.16)];
    const home = [-9.5 + rnd() * 19, 1.0 + rnd() * 4.2, -14 + rnd() * 9];
    const ax = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
    const ang = rnd() * Math.PI;
    list.push({
      b, r: Math.hypot(...b), home, p: home.slice(), v: [0, 0, 0],
      q: [ax[0] * Math.sin(ang / 2), ax[1] * Math.sin(ang / 2), ax[2] * Math.sin(ang / 2), Math.cos(ang / 2)],
      w: [(rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3], seed: rnd() * 10,
    });
  }
  return list;
})();
const stoneBuf = { c: new Float32Array(NSTONE * 4), b: new Float32Array(NSTONE * 3), r: new Float32Array(NSTONE * 9) };

function layout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const budget = Math.min(1, Math.sqrt(pixelBudget / (w * dpr * h * dpr)));
  state.rw = Math.max(1, Math.round(w * dpr * renderScale * budget));
  state.rh = Math.max(1, Math.round(h * dpr * renderScale * budget));
  if (post) {
    // the scene renders at rw x rh; the final pass fills the display
    const db = Math.min(1, Math.sqrt(3.2e6 / (w * dpr * h * dpr)));
    canvas.width = Math.round(w * dpr * db);
    canvas.height = Math.round(h * dpr * db);
    sizePost(state.rw, state.rh);
  } else {
    canvas.width = state.rw;
    canvas.height = state.rh;
  }
  gl.viewport(0, 0, canvas.width, canvas.height);

  const tall = aspect < 1;
  state.focal = tall ? 1.3 : 1.9;
  state.camBase = tall ? [0, 1.9, 7.5] : [0, 1.7, 6];
  state.target = tall ? [0, 3.1, -10] : [0, 2.7, -10];
  state.sun = norm(tall ? [0.02, 0.2, -1] : [-0.1, 0.165, -1]);
  state.rocket.x = tall ? 6 : 14;
  state.ele.z = -12;
  const dist = state.camBase[2] - state.ele.z;
  state.halfW = (dist * aspect) / state.focal;
}
layout();
window.addEventListener('resize', () => { pendingScale = renderScale; });

/* ------------------------------------------------------------------ *
 *  Pointer & interaction
 * ------------------------------------------------------------------ */

const pointer = { x: 0, y: 0, active: false, last: -99 };

function toUv(clientX, clientY) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return [(2 * clientX - w) / h, (h - 2 * clientY) / h];
}

function project(p) {
  const { ww, uu, vv } = basis(state.cam, state.target);
  const v = sub(p, state.cam);
  const z = dot(v, ww);
  return [(dot(v, uu) / z) * state.focal, (dot(v, vv) / z) * state.focal];
}

function rayAt(uv) {
  const { ww, uu, vv } = basis(state.cam, state.target);
  return norm([
    uv[0] * uu[0] + uv[1] * vv[0] + state.focal * ww[0],
    uv[0] * uu[1] + uv[1] * vv[1] + state.focal * ww[1],
    uv[0] * uu[2] + uv[1] * vv[2] + state.focal * ww[2],
  ]);
}

// Generous screen-space hit boxes, projected from the objects' world bounds.
function screenBox(points) {
  const ps = points.map(project);
  return [Math.min(...ps.map((p) => p[0])), Math.max(...ps.map((p) => p[0])), Math.min(...ps.map((p) => p[1])), Math.max(...ps.map((p) => p[1]))];
}
function inBox(b, uv, pad) {
  return uv[0] > b[0] - pad && uv[0] < b[1] + pad && uv[1] > b[2] - pad && uv[1] < b[3] + pad;
}
function targetAt(uv) {
  const R = state.rocket;
  if (R.lift < 30) {
    const rb = screenBox([[R.x - 0.9, R.lift - 0.4, R.z], [R.x + 0.9, R.lift + 5.4, R.z]]);
    if (inBox(rb, uv, 0.05)) return 'rocket';
  }
  const E = state.ele;
  const eb = screenBox([[E.x - 2.7, 0, E.z], [E.x + 1.7, 6.2, E.z]]);
  if (inBox(eb, uv, 0.03)) return 'elephant';
  return null;
}

let hovered = null;
function setHover(target) {
  if (target !== hovered) {
    hovered = target;
    // No labels: things just stir when you come near.
    if (target === 'elephant') state.ele.startle = Math.max(state.ele.startle, 0.35);
    else if (target === 'rocket' && state.rocket.mode === 'idle') state.rocket.cough = 1;
  }
}

// Where the pointer ray meets the water (null when pointing at the sky).
function groundAt(uv) {
  const rd = rayAt(uv);
  if (rd[1] > -0.004) return null;
  const t = -state.cam[1] / rd[1];
  return [state.cam[0] + rd[0] * t, state.cam[2] + rd[2] * t];
}
const drag = { down: false, last: null, speed: 0 };

window.addEventListener('pointerup', () => { drag.down = false; drag.last = null; });
window.addEventListener('pointercancel', () => { drag.down = false; drag.last = null; });

window.addEventListener('pointermove', (e) => {
  [pointer.x, pointer.y] = toUv(e.clientX, e.clientY);
  pointer.active = true;
  pointer.last = performance.now() / 1000;
  setHover(e.pointerType === 'mouse' ? targetAt([pointer.x, pointer.y]) : null);
}, { passive: true });
document.documentElement.addEventListener('mouseleave', () => { pointer.active = false; setHover(null); });

canvas.addEventListener('pointerdown', (e) => {
  [pointer.x, pointer.y] = toUv(e.clientX, e.clientY);
  pointer.active = true;
  pointer.last = performance.now() / 1000;
  const target = targetAt([pointer.x, pointer.y]);
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }

  // Every click: a drop in the water, a flare of the light and the corona,
  // and the slabs near the light are flung outward.
  const g = groundAt([pointer.x, pointer.y]);
  const at = g || [state.orb[0], state.orb[2]];
  addDrop(at[0], at[1], at[0], at[1], 0.45, -0.5);
  drag.down = true;
  drag.last = g;
  state.orbI = Math.max(state.orbI, 2.6);
  state.flare = 1;
  audio.pulse();
  // the shockwave starts where you clicked: on the water, or under the light
  shocks.push({ o: g ? [g[0], 0, g[1]] : [state.orb[0], state.orb[1], state.orb[2]], age: 0, str: 1, hit: new Set() });
  if (shocks.length > 4) shocks.shift();

  if (target === 'elephant') {
    const E = state.ele;
    E.trunkT = 0;
    E.startle = 1;
    E.snap = 1.5;
    audio.horn();
  } else if (target === 'rocket') {
    const R = state.rocket;
    if (R.mode === 'idle') {
      R.mode = 'launch';
      R.t = 0;
      audio.launch();
    } else {
      R.shake = 1;
    }
  }
});

/* ------------------------------------------------------------------ *
 *  Loop
 * ------------------------------------------------------------------ */

let start = performance.now();
let last = start;
let frameTimes = [];
let frameNo = 0;
const motion = reduceMotion ? 0.35 : 1;

function update(dt, t, now) {
  // camera drift
  const px = pointer.active ? pointer.x : 0;
  const py = pointer.active ? pointer.y : 0;
  state.cam[0] += (state.camBase[0] + px * 0.35 - state.cam[0]) * damp(1.5, dt);
  state.cam[1] += (state.camBase[1] + py * 0.15 - state.cam[1]) * damp(1.5, dt);
  state.cam[2] = state.camBase[2];

  // the light
  const idle = !pointer.active || now - pointer.last > 9;
  let want;
  if (!idle) {
    const rd = rayAt([pointer.x, pointer.y]);
    const tz = (-8 - state.cam[2]) / rd[2];
    want = [state.cam[0] + rd[0] * tz, state.cam[1] + rd[1] * tz, -8];
    want[1] = clamp(want[1], 0.35, 7);
  } else {
    want = [Math.sin(t * 0.17) * 5, 1.6 + Math.sin(t * 0.29) * 0.8, -8 + Math.sin(t * 0.11) * 2];
  }
  const k = damp(idle ? 0.8 : 5, dt);
  for (let i = 0; i < 3; i++) state.orb[i] += (want[i] - state.orb[i]) * k;
  const flick = 1 + Math.sin(t * 7.1) * 0.015 + Math.sin(t * 13.7) * 0.01;
  state.orbI += (1.0 * flick - state.orbI) * damp(1.8, dt);
  // the light breathes between amber and a paler rose-gold; a click runs it hot
  const hue = 0.5 + 0.5 * Math.sin(t * 0.55);
  const hot = clamp(state.flare, 0, 1);
  state.orbCol = [1.0, 0.76 + 0.08 * hue + 0.1 * hot, 0.5 + 0.16 * hue + 0.2 * hot];

  // the elephant walks left; feet stay planted (stride 0.64 per half cycle)
  const E = state.ele;
  const speed = 0.2;
  E.x -= speed * dt;
  const prevPhase = E.phase;
  E.phase += (speed * Math.PI / 0.64) * dt;
  // footfalls ripple the water
  for (let i = 0; i < 4; i++) {
    const off = i === 0 || i === 3 ? 0 : Math.PI;
    if (Math.cos(prevPhase + off) < 0 && Math.cos(E.phase + off) >= 0) {
      const fx = E.x + (i < 2 ? -0.82 : 0.88) + Math.sin(E.phase + off) * 0.32;
      const fz = E.z + (i === 0 || i === 3 ? 0.38 : -0.38);
      addDrop(fx, fz, fx, fz, 0.22, -0.12);
    }
  }
  if (E.x < -state.halfW - 4) E.x = state.halfW + 4;
  const head = [E.x - 1.55, 5.0, E.z];
  const v = sub(state.orb, head);
  const yaw = clamp(Math.atan2(v[2], -v[0]), -0.85, 0.85);
  const pitch = clamp(Math.atan2(v[1], Math.hypot(v[0], v[2])), -0.45, 0.35);
  E.snap = Math.max(0, E.snap - dt);
  const headSpeed = E.snap > 0 ? 7 : 1.2;
  E.yaw += (yaw - E.yaw) * damp(headSpeed, dt);
  E.pitch += (pitch - E.pitch) * damp(headSpeed, dt);
  E.trunkT += dt;
  const tw = E.trunkT < 3.2 ? Math.min(1, E.trunkT / 0.22) * Math.min(1, (3.2 - E.trunkT) / 1.0) : 0;
  E.trunk += (tw - E.trunk) * damp(14, dt);
  E.startle *= Math.exp(-dt * 3.5);

  // the rocket: idle, rise, gone, return
  const R = state.rocket;
  R.t += dt;
  R.cough *= Math.exp(-dt * 4);
  R.shake *= Math.exp(-dt * 5);
  if (R.mode === 'launch') {
    R.fire = Math.min(1, R.t / 0.12);
    R.shake = Math.max(R.shake, R.t < 0.5 ? 1 : 0);
    R.lift = Math.max(0, R.t - 0.35) ** 2 * 1.1;
    if (R.lift > 60) { R.mode = 'gone'; R.t = 0; }
  } else if (R.mode === 'gone') {
    R.fire = 0;
    if (R.t > 6) { R.mode = 'land'; R.t = 0; }
  } else if (R.mode === 'land') {
    const p = Math.min(1, R.t / 9);
    R.lift = 40 * (1 - p) ** 3;
    R.fire = p < 1 ? 0.55 + 0.45 * (1 - p) : 0;
    if (p >= 1) { R.mode = 'idle'; R.lift = 0; R.fire = 0; }
  }

  state.flare *= Math.exp(-dt * 2.2);

  // a meteor every so often
  const M = state.meteor;
  if (M.p < 0) {
    M.next -= dt;
    if (M.next <= 0) {
      const dir = (az, el) => [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)];
      const az = (Math.random() - 0.5) * 1.3;
      const el = 0.3 + Math.random() * 0.35;
      M.a = dir(az, el);
      M.b = dir(az + (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.2), el - 0.1 - Math.random() * 0.12);
      M.p = 0;
      M.next = 8 + Math.random() * 16;
    }
  } else {
    M.p += dt / 0.9;
    if (M.p > 1.3) M.p = -1;
  }

  // dragging: the pointer is a stick drawn through the water
  if (drag.down) {
    const g = groundAt([pointer.x, pointer.y]);
    if (g && drag.last) {
      const len = Math.hypot(g[0] - drag.last[0], g[1] - drag.last[1]);
      if (len > 0.002) addDrop(drag.last[0], drag.last[1], g[0], g[1], 0.22, -0.09 * clamp(len / 0.12, 0.25, 1.5));
      drag.speed = len / Math.max(dt, 1e-3);
    } else drag.speed = 0;
    drag.last = g;
  } else drag.speed *= Math.exp(-dt * 8);
  audio.swish(drag.speed);

  updateShocks(dt);
  updateStones(dt, t);
}

function updateShocks(dt) {
  for (const sh of shocks) {
    sh.age += dt;
    const r = sh.age * SHOCK_SPEED;
    const fall = Math.exp(-sh.age * 0.35);
    const reached = (key, p) => {
      if (sh.hit.has(key)) return -1;
      const d = Math.hypot(p[0] - sh.o[0], p[1] - sh.o[1], p[2] - sh.o[2]);
      if (d > r) return -1;
      sh.hit.add(key);
      return d;
    };
    stones.forEach((st, i) => {
      const d = reached(i, st.p);
      if (d < 0) return;
      const dir = sub(st.p, sh.o);
      const l = Math.hypot(...dir) || 1e-3;
      const k = 7 * fall / (1 + d * 0.25);
      for (let j = 0; j < 3; j++) {
        st.v[j] += (dir[j] / l) * k;
        st.w[j] += (Math.random() - 0.5) * 5 * k / 7;
      }
      st.v[1] += k * 0.3;
    });
    const E = state.ele;
    const de = reached('ele', [E.x - 0.6, 3, E.z]);
    if (de >= 0) {
      E.startle = Math.max(E.startle, clamp(1.2 * fall / (1 + de * 0.08), 0.25, 1));
      E.snap = Math.max(E.snap, 0.8);
    }
    const R = state.rocket;
    if (reached('rocket', [R.x, R.lift + 2, R.z]) >= 0) R.shake = Math.max(R.shake, 0.8 * fall);
  }
  while (shocks.length && shocks[0].age * SHOCK_SPEED > 45) shocks.shift();
}

function updateStones(dt, t) {
  const orb = state.orb;
  const R = 5;
  for (const st of stones) {
    const f = [0, 0, 0];
    const d = sub(orb, st.p);
    const dist = Math.hypot(...d) || 1e-3;
    if (dist < R) {
      // clump around the light: spring toward a shell, plus a slow swirl
      const w = 1 - dist / R;
      const wk = w * w * (3 - 2 * w);
      const shell = 0.55 + st.r * 1.5;
      const pull = (dist - shell) * 9 * wk;
      const swirl = cross(d, [0, 0, 1]);
      const sl = Math.hypot(...swirl) || 1;
      for (let i = 0; i < 3; i++) f[i] += (d[i] / dist) * pull + (swirl[i] / sl) * 2.6 * wk;
    }
    const bob = Math.sin(t * 0.35 + st.seed) * 0.2;
    const home = [st.home[0], st.home[1] + bob, st.home[2]];
    for (let i = 0; i < 3; i++) f[i] += (home[i] - st.p[i]) * 0.35;
    for (const o of stones) {
      if (o === st) continue;
      const dd = sub(st.p, o.p);
      const dl = Math.hypot(...dd) || 1e-3;
      const minD = (st.r + o.r) * 0.95;
      if (dl < minD) for (let i = 0; i < 3; i++) f[i] += (dd[i] / dl) * (minD - dl) * 40;
    }
    const damping = Math.exp(-1.5 * dt);
    for (let i = 0; i < 3; i++) st.v[i] = (st.v[i] + f[i] * dt) * damping;
  }
  for (const st of stones) {
    for (let i = 0; i < 3; i++) st.p[i] += st.v[i] * dt;
    // touch the water: splash, bounce
    const floor = st.r * 0.55;
    if (st.p[1] < floor) {
      if (st.v[1] < -0.4) addDrop(st.p[0], st.p[2], st.p[0], st.p[2], 0.25 + st.r, clamp(st.v[1] * 0.06, -0.35, 0));
      st.p[1] = floor;
      st.v[1] = Math.abs(st.v[1]) * 0.3;
      st.v[0] *= 0.7;
      st.v[2] *= 0.7;
    }
    // tumble: spin picks up from motion, then settles
    const tq = cross([0, 1, 0], st.v);
    const ad = Math.exp(-0.9 * dt);
    for (let i = 0; i < 3; i++) st.w[i] = (st.w[i] + tq[i] * 0.5 * dt) * ad + (i === 1 ? 0.02 * dt : 0);
    const [qx, qy, qz, qw] = st.q;
    const [wx, wy, wz] = st.w;
    const nq = [
      qx + 0.5 * dt * (wx * qw + wy * qz - wz * qy),
      qy + 0.5 * dt * (wy * qw + wz * qx - wx * qz),
      qz + 0.5 * dt * (wz * qw + wx * qy - wy * qx),
      qw - 0.5 * dt * (wx * qx + wy * qy + wz * qz),
    ];
    const ql = Math.hypot(...nq);
    st.q = nq.map((c) => c / ql);
  }
}

function uploadStones() {
  stones.forEach((st, i) => {
    stoneBuf.c.set([st.p[0], st.p[1], st.p[2], st.r + 0.05], i * 4);
    stoneBuf.b.set(st.b, i * 3);
    const [x, y, z, w] = st.q;
    // rotation matrix R (local -> world), written row-major so GLSL reads R^T (world -> local)
    stoneBuf.r.set([
      1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
    ], i * 9);
  });
  gl.uniform4fv(U.uStone, stoneBuf.c);
  gl.uniform3fv(U.uStoneB, stoneBuf.b);
  gl.uniformMatrix3fv(U.uStoneR, false, stoneBuf.r);
}

let pendingScale = 0;
let lastScaleChange = 0;

function frame(nowMs) {
  // Apply a resolution change before drawing: resizing clears the canvas, and
  // doing it after the draw would present a black frame.
  if (pendingScale) {
    renderScale = pendingScale;
    pendingScale = 0;
    layout();
  }
  const now = nowMs / 1000;
  const realDt = (nowMs - last) / 1000;
  const rawDt = Math.min(0.05, realDt);
  last = nowMs;
  const dt = rawDt * motion;
  const t = ((nowMs - start) / 1000) * motion;
  for (let i = 0; i < substeps; i++) {
    update(dt, t + i * dt, now);
    stepWater(dt);
  }

  if (post) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, post.scene.fb);
    gl.viewport(0, 0, state.rw, state.rh);
  }
  const jx = post ? halton((frameNo % 8) + 1, 2) - 0.5 : 0;
  const jy = post ? halton((frameNo % 8) + 1, 3) - 0.5 : 0;
  gl.uniform2f(U.uJitter, jx, jy);
  gl.uniform1f(U.uPost, post ? 1 : 0);
  gl.uniform3fv(U.uOrbCol, state.orbCol);
  gl.uniform4fv(U.uShock, shockUniforms());
  gl.uniform2f(U.uRes, state.rw, state.rh);
  gl.uniform1f(U.uTime, t);
  gl.uniform3fv(U.uCam, state.cam);
  gl.uniform3fv(U.uTarget, state.target);
  gl.uniform1f(U.uFocal, state.focal);
  gl.uniform3fv(U.uOrb, state.orb);
  gl.uniform1f(U.uOrbI, state.orbI);
  gl.uniform4f(U.uEle, state.ele.x, state.ele.phase, state.ele.yaw, state.ele.pitch);
  gl.uniform1f(U.uEleZ, state.ele.z);
  gl.uniform1f(U.uTrunk, state.ele.trunk);
  const R = state.rocket;
  const jitter = (Math.random() - 0.5) * 0.06 * R.shake;
  gl.uniform3f(U.uRocket, R.x + jitter, R.lift + Math.abs(jitter) * 0.5, R.z);
  gl.uniform1f(U.uFire, Math.max(R.fire, R.cough * 0.35));
  gl.uniform1f(U.uFlare, state.flare);
  gl.uniform1f(U.uStartle, state.ele.startle);
  gl.uniform1i(U.uFrame, frameNo++);
  uploadStones();
  gl.uniform4f(U.uMetA, ...state.meteor.a, state.meteor.p);
  gl.uniform3fv(U.uMetB, state.meteor.b);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, water ? water.src.tex : null);
  gl.uniform1i(U.uWater, 0);
  gl.uniform1f(U.uWaterOn, water ? 1 : 0);
  gl.uniform4f(U.uWaterRect, WATER.minX, WATER.minZ, WATER.size, 1 / SIM);
  gl.uniform3fv(U.uSun, state.sun);
  const fade = Math.min(1, ((nowMs - start) / 1000) / 3) ** 2;
  gl.uniform1f(U.uFade, fade);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (post) resolve(t, fade, jx, jy);

  // Dynamic resolution: adapt within a few frames, proportionally to how far
  // off a ~45 fps target we are.
  if (frameNo > 3) frameTimes.push(realDt);
  if (!(pinnedScale > 0) && frameTimes.length >= 12) {
    const sorted = frameTimes.slice().sort((a, b) => a - b);
    const typical = sorted[Math.floor(sorted.length / 2)];
    frameTimes = [];
    const next = clamp(renderScale * clamp(Math.sqrt((1 / 45) / typical), 0.6, 1.1), minScale, maxScale);
    // Settle quickly at first, then only change for clear reasons, and not often.
    const settled = nowMs - start > 6000;
    const minStep = settled ? 0.12 : 0.04;
    const cooldown = settled ? 4000 : 400;
    if (Math.abs(next - renderScale) > minStep && nowMs - lastScaleChange > cooldown) {
      pendingScale = next;
      lastScaleChange = nowMs;
    }
  }

  requestAnimationFrame(frame);
}

function resolve(t, fade, jx, jy) {
  const { ww, uu, vv } = basis(state.cam, state.target);
  const cur = { cam: state.cam.slice(), ww, uu, vv, focal: state.focal };
  const prev = post.prev || cur;
  const src = post.hist[post.cur];
  const dst = post.hist[1 - post.cur];

  const A = post.taa;
  gl.useProgram(A.p);
  gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
  gl.viewport(0, 0, state.rw, state.rh);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, post.scene.tex);
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, src.tex);
  gl.uniform1i(A.u.uCur, 1);
  gl.uniform1i(A.u.uHist, 2);
  gl.uniform2f(A.u.uRes, state.rw, state.rh);
  gl.uniform2f(A.u.uJitter, jx, jy);
  gl.uniform3fv(A.u.uCam, cur.cam);
  gl.uniform3fv(A.u.uWW, cur.ww);
  gl.uniform3fv(A.u.uUU, cur.uu);
  gl.uniform3fv(A.u.uVV, cur.vv);
  gl.uniform1f(A.u.uFocal, cur.focal);
  gl.uniform3fv(A.u.uPCam, prev.cam);
  gl.uniform3fv(A.u.uPWW, prev.ww);
  gl.uniform3fv(A.u.uPUU, prev.uu);
  gl.uniform3fv(A.u.uPVV, prev.vv);
  gl.uniform1f(A.u.uPFocal, prev.focal);
  gl.uniform1f(A.u.uReset, post.reset ? 1 : 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  post.cur = 1 - post.cur;
  post.reset = false;
  post.prev = cur;

  const O = post.out;
  gl.useProgram(O.p);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, dst.tex);
  gl.uniform1i(O.u.uImg, 3);
  gl.uniform2f(O.u.uSrc, state.rw, state.rh);
  gl.uniform2f(O.u.uDst, canvas.width, canvas.height);
  gl.uniform1f(O.u.uTime, t);
  gl.uniform1f(O.u.uFade, fade);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.useProgram(prog);
}

function begin() {
  if (!finishProgram()) return;
  water = initWater();
  post = initPost();
  layout();
  gl.useProgram(prog);
  start = last = performance.now();
  document.documentElement.classList.add('ready');
  requestAnimationFrame(frame);
}
if (parallel) {
  (function wait() {
    if (gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) begin();
    else requestAnimationFrame(wait);
  })();
} else {
  // Let the text paint first; linking blocks the thread here.
  requestAnimationFrame(() => setTimeout(begin, 30));
}
