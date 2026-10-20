import React, { useEffect, useRef } from 'react';

// Height of one scanline in CSS pixels (rounded to whole device pixels).
const LINE_CSS_PX = 3.8;
// How long the tube takes to warm up when the page opens.
const WARM_UP_MS = 1500;
// Where the black hole hangs, as a share of the screen height from the top.
const CENTER_Y = 0.33;

/*
  A black hole over a still lake at night, shown on a well-adjusted CRT.

  The sky is ray traced. Near the hole each ray bends around a Schwarzschild
  black hole (radius 1), using the classic photon-orbit acceleration
  a = -1.5 h² r / |r|⁵, so the far side of the accretion disk lenses up over the
  top, the way it does in Interstellar. Rays that cross the disk plane pick up
  light from a hot, differentially rotating disk (inner parts spin faster,
  the side turning toward us is brighter). Rays that fall in stay black;
  rays that escape see a violet Milky Way and soft stars, bent the same way.

  Below the sky: low hills on the far shore, a warm glow along the horizon,
  still water that mirrors all of it with very slow swells, a few rocks, and a
  lone wind-bent tree on an islet. Every motion is a steady rotation, a
  twinkle or a sway, so nothing ever jumps.

  Two passes. The scene renders into a texture with one row per scanline. The
  CRT pass then draws it as a good tube would, not as hard blocks: a Gaussian
  beam per scanline, wider where it's bright; smooth, analog blending along the
  line; a fine aperture grille; and a soft glow around bright areas. Picture
  makers tuned CRTs for the best possible image, and this follows them.
*/

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uCenterY;
uniform float uAspect;   // the screen's real width / height (scene pixels aren't square)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

// Ridged noise: sharp peaks and soft valleys, like a skyline.
float ridge(float x) {
  float v = 0.0, a = 0.55, f = 1.0;
  for (int i = 0; i < 4; i++) {
    v += a * (1.0 - abs(noise(vec2(x * f, 0.5 + float(i) * 3.0)) * 2.0 - 1.0));
    f *= 2.1;
    a *= 0.48;
  }
  return v;
}

const vec3 LIGHT = vec3(1.0, 0.88, 0.76);   // light thrown by the disk
const float HORIZON = 0.33;                   // waterline, in screen heights from the bottom
const float NEBULA_GLOW = 0.075;              // how brightly the gas glows
const float NEBULA_DUST = 0.012;              // how much it dims the stars behind it
const float MARCH_RADIUS = 3.0;               // full ray marching inside this (hole space): the whole screen
const float GALAXY_OFFSET = 0.32;            // how far the Milky Way passes from the hole

float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}

// The nebula: real gas in the space around the hole, sampled along the same bent
// rays as the disk, so the hole lenses it too. Close in, Keplerian shear winds it
// into spiral arms that feed the disk, it settles toward the disk plane as it
// falls, the space just outside the disk is swept empty, and it glows hotter the
// closer it gets. Far out it is cool: teal, magenta and violet. Returns emitted
// colour (rgb) and how much it dims what lies behind it (a).
vec4 nebula(vec3 pos) {
  float rxz = length(pos.xz);
  float r = length(pos);
  if (rxz < 3.2 || r > 29.0) return vec4(0.0);
  // Orbiting (inner gas faster) and wound into gentle spiral arms.
  float spin = uTime * 3.4 / pow(rxz, 1.5) + 5.0 / sqrt(rxz);
  float a = atan(pos.z, pos.x) + spin;
  float squash = mix(1.0, 2.6, smoothstep(15.0, 4.5, rxz));
  // The pattern drifts outward in sample space, so the gas itself flows in toward the hole.
  float rIn = rxz + uTime * 0.4;
  vec3 s = vec3(cos(a) * rIn, pos.y * squash, sin(a) * rIn);
  // ...and churns slowly as it goes.
  vec3 boil = vec3(uTime * 0.05, uTime * 0.035, -uTime * 0.04);
  float n = 0.55 * noise3(s * 0.2 + boil) + 0.3 * noise3(s * 0.43 + 5.0 - boil * 1.7) + 0.15 * noise3(s * 0.9 + 9.0 + boil * 2.5);
  float fil = 1.0 - abs(2.0 * (0.6 * noise3(s * 0.5 + 11.0 + boil) + 0.4 * noise3(s * 1.1 + 17.0 - boil * 2.0)) - 1.0);
  float dens = smoothstep(0.4, 0.78, n) * (0.35 + 1.0 * fil * fil);
  float lift = pos.y * squash / 6.5;
  dens *= exp(-lift * lift);                                             // a thick layer about the disk plane
  dens *= smoothstep(3.2, 6.5, rxz) * (1.0 - smoothstep(19.0, 29.0, r)); // swept gap, soft outer edge
  dens *= mix(0.2, 1.0, smoothstep(-10.0, 2.0, pos.z));                  // thin in front of the hole
  float hue = noise3(s * 0.09 + 29.0 + boil * 0.5);
  vec3 cool = mix(vec3(0.08, 0.55, 0.62), vec3(0.85, 0.14, 0.55), smoothstep(0.3, 0.6, hue));
  cool = mix(cool, vec3(0.32, 0.24, 0.9), smoothstep(0.62, 0.82, hue));
  float heat = smoothstep(15.0, 4.5, rxz);
  vec3 c = mix(cool, mix(vec3(1.0, 0.5, 0.18), vec3(1.0, 0.9, 0.75), heat * heat), heat);
  return vec4(c * dens, dens);
}

// The night sky in a given direction: a violet Milky Way band with dark dust
// lanes, and a dense field of stars that thickens inside the band.
vec3 nightSky(vec3 d) {
  // The galaxy's plane rises diagonally from the horizon, passing just beside
  // the hole, so the band bends around it without closing into a ring.
  vec3 n = normalize(vec3(0.93, 0.37, 0.03));
  float lat = dot(d, n) + GALAXY_OFFSET;
  vec2 sp = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
  float band = exp(-lat * lat / 0.03);
  float core = exp(-lat * lat / 0.006) * smoothstep(0.2, -0.6, d.y + 0.25 * d.x);
  float dust = smoothstep(0.42, 0.68, fbm(sp * vec2(7.0, 12.0) + 3.0));
  vec3 milky = vec3(0.30, 0.17, 0.48) * band * (0.55 + 0.6 * fbm(sp * vec2(4.0, 8.0))) * 0.55;
  milky += vec3(0.75, 0.55, 0.62) * core * 0.35;
  milky *= 1.0 - 0.75 * dust * band;
  vec3 col = vec3(0.004, 0.004, 0.014) + milky;

  // Stars at two scales; more of them inside the band. Each is a soft round dot
  // somewhere in its cell (never a hard square), twinkling on its own beat.
  for (int k = 0; k < 2; k++) {
    float scale = k == 0 ? 110.0 : 260.0;
    vec2 cell = floor(sp * scale);
    float h = hash(cell + float(k) * 17.0);
    float threshold = k == 0 ? mix(0.985, 0.955, band) : mix(0.965, 0.90, band);
    vec2 at = vec2(hash(cell + 1.7), hash(cell + 5.3)) * 0.6 + 0.2;
    vec2 f = fract(sp * scale) - at;
    float dotShape = exp(-dot(f, f) * (k == 0 ? 55.0 : 80.0));
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.2 + h * 2.0) + h * 40.0);
    vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.85, 0.75), hash(cell + 9.1));
    col += tint * step(threshold, h) * dotShape * (0.45 + 0.9 * hash(cell + 3.1)) * twinkle * (k == 0 ? 1.2 : 0.6);
  }
  return col;
}

// The black hole and everything seen around it, ray traced. uv is centred on
// the hole; far from it, rays are almost straight, so they skip the march.
vec3 sky(vec2 uv, float budget) {
  vec3 ro = vec3(0.0, 1.15, -14.0);
  vec3 fw = normalize(-ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 pos = ro;
  vec3 vel = normalize(fw + 0.72 * (uv.x * rt + uv.y * up));

  vec3 col = vec3(0.0);
  float alpha = 0.0;

  float r = length(uv);
  if (r < MARCH_RADIUS) {
    vec3 h = cross(pos, vel);
    float h2 = dot(h, h);
    for (int i = 0; i < 160; i++) {
      if (float(i) >= budget) break;
      vec3 prev = pos;
      float r2 = dot(pos, pos);
      float dt = clamp(0.085 * sqrt(r2), 0.035, 1.5);
      vel += -1.5 * h2 * pos / pow(r2, 2.5) * dt;
      pos += vel * dt;

      if (dot(pos, pos) < 1.0) { alpha = 1.0; break; } // through the horizon

      // Gas along the way (every other step, weighted to match).
      if (mod(float(i), 2.0) < 0.5) {
        vec4 g = nebula(pos);
        col += (1.0 - alpha) * g.rgb * dt * 2.0 * NEBULA_GLOW;
        alpha += (1.0 - alpha) * clamp(g.a * dt * 2.0 * NEBULA_DUST, 0.0, 1.0);
      }

      if (prev.y * pos.y < 0.0) { // crossed the disk plane
        vec3 p = mix(prev, pos, prev.y / (prev.y - pos.y));
        float pr = length(p.xz);
        if (pr > 2.6 && pr < 9.5) {
          // Keplerian spin: the inner edge orbits in ~10 s, the outer edge in ~50 s.
          float a = atan(p.z, p.x) + uTime * 3.3 / pow(pr, 1.5);
          vec2 q = vec2(cos(a) * 1.8 + pr * 2.6, sin(a) * 1.8);
          float n = fbm(q);
          float rings = 0.55 + 0.45 * sin(pr * 7.0 + n * 5.0);
          // Hot clumps riding the disk, so the spin is easy to see.
          float clump = smoothstep(0.52, 0.78, fbm(vec2(cos(a), sin(a)) * 3.2 + vec2(pr * 1.1, 7.0)));
          float edge = smoothstep(2.6, 3.3, pr) * (1.0 - smoothstep(6.5, 9.5, pr));
          float heat = pow(clamp(1.0 - (pr - 2.6) / 6.9, 0.0, 1.0), 1.6);
          vec3 tang = normalize(vec3(-p.z, 0.0, p.x));
          float beam = clamp(1.0 + 0.75 * dot(tang, -normalize(vel)), 0.25, 2.0);
          float I = edge * (rings * (0.3 + 0.6 * n) + 1.6 * clump) * (0.3 + 1.5 * heat) * beam;
          vec3 tint = mix(vec3(1.0, 0.5, 0.2), vec3(1.0, 0.93, 0.82), clamp(heat * 1.3, 0.0, 1.0));
          float da = clamp(I * 0.85, 0.0, 1.0);
          col += (1.0 - alpha) * tint * I * 1.4;
          alpha += (1.0 - alpha) * da;
          if (alpha > 0.97) break;
        }
      }
      if (r2 > 900.0 && dot(pos, vel) > 0.0) break; // escaped
    }
  } else {
    // Far from the hole the bend is gentle: the weak-field deflection 2Rs/b,
    // tipping the ray toward the hole, in one step instead of a march.
    vec3 toward = normalize(fw * dot(vel, fw) - vel);
    float b = 14.0 * length(cross(vel, fw));
    vel = normalize(vel + toward * (2.0 / b));
  }
  // Whatever got past the hole sees the galaxy, bent around it.
  if (alpha < 1.0) col += (1.0 - alpha) * nightSky(normalize(vel));
  col += (1.0 - alpha) * LIGHT * 0.12 * exp(-length(uv) * 2.2);
  return col;
}

float segment(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a, ba = b - a;
  float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t) - r;
}

// A lone, wind-bent tree on a stump of an island, with a fallen limb in the water.
// q is in tree space: the base at the origin, about one unit tall.
float tree(vec2 q, float t) {
  q.x -= q.y * q.y * 0.04 * sin(t * 0.7);              // a slow lean in the breeze
  float d = segment(q, vec2(0.0, 0.0), vec2(-0.10, 0.32), 0.035);
  d = min(d, segment(q, vec2(-0.10, 0.32), vec2(-0.30, 0.52), 0.02));
  d = min(d, segment(q, vec2(-0.10, 0.32), vec2(0.04, 0.60), 0.018));
  d = min(d, segment(q, vec2(-0.19, 0.42), vec2(-0.42, 0.44), 0.012));
  d = min(d, segment(q, vec2(-0.03, 0.47), vec2(0.17, 0.55), 0.011));
  // Fallen limbs reaching out over the water.
  d = min(d, segment(q, vec2(0.02, 0.01), vec2(0.66, 0.06), 0.04));
  d = min(d, segment(q, vec2(0.36, 0.04), vec2(0.50, 0.24), 0.025));
  d = min(d, segment(q, vec2(0.54, 0.06), vec2(0.76, 0.21), 0.022));
  // Sparse, ragged foliage clumps at the branch tips.
  // A soft pseudo-distance: negative inside, so the edge can be smoothed like the rest.
  vec2 c1 = q - vec2(-0.30, 0.58), c2 = q - vec2(0.03, 0.66), c3 = q - vec2(-0.15, 0.52), c4 = q - vec2(-0.43, 0.48);
  float blob = min(min(length(c1) - 0.15, length(c2) - 0.13), min(length(c3) - 0.13, length(c4) - 0.08));
  float leaves = max(blob, ((0.47 - blob * 2.0) - fbm(q * 14.0 + 2.0)) * 0.06);
  // The islet it grows from.
  vec2 rk = (q - vec2(0.02, -0.02)) / vec2(0.16, 0.05);
  float islet = (length(rk) - 1.0) * 0.05;
  return min(min(d, leaves), islet);
}

// Scene-wide values, set once per pixel in main().
float PIXEL;          // one scene pixel, in screen heights
vec2 gHole;
float gHoleScale;
vec2 gTreeBase;
float gTreeSize;
float gAspect;
const vec3 SILHOUETTE = vec3(0.004, 0.003, 0.008);

// How much of a shape with signed distance d (screen heights) covers this pixel.
float cover(float d) { return 1.0 - smoothstep(-PIXEL * 0.75, PIXEL * 0.75, d); }

// Everything above the waterline at point p (screen heights, x centred).
vec3 above(vec2 p, vec2 holeCentre, float holeScale, float budget) {
  float ax = abs(p.x);
  // Low, dark hills along the far shore, rising a little toward the edges.
  float hill = HORIZON + 0.012 + 0.09 * pow(ax, 1.6) + 0.025 * ridge(p.x * 5.0 + 11.0);
  float below = max(hill - p.y, 0.0);
  vec3 land = vec3(0.006, 0.006, 0.012) + vec3(0.45, 0.32, 0.5) * exp(-below * 160.0) * 0.35;
  land += vec3(1.0, 0.55, 0.3) * 0.25 * exp(-max(p.y - HORIZON, 0.0) * 90.0);
  // The skyline is anti-aliased over about a pixel and a half.
  float onLand = smoothstep(-PIXEL * 0.75, PIXEL * 0.75, hill - p.y);
  if (onLand >= 1.0) return land;
  vec3 col = sky((p - holeCentre) / holeScale, budget);
  // Warm light pollution glowing along the horizon, fading up through pink into the night.
  float hz = p.y - HORIZON;
  col += vec3(1.0, 0.55, 0.28) * 0.7 * exp(-hz * 28.0);
  col += vec3(0.55, 0.28, 0.55) * 0.35 * exp(-hz * 7.0);
  return mix(col, land, onLand);
}

// Above the waterline: shore, sky and the tree against it.
vec3 skyside(vec2 p, float t) {
  vec3 col = above(p, gHole, gHoleScale, 160.0);
  return mix(col, SILHOUETTE, cover(tree((p - gTreeBase) / gTreeSize, t) * gTreeSize));
}

// Below it: a dark mirror, broken up by slow, random ripples.
vec3 waterside(vec2 p, float t) {
  float depth = (HORIZON - p.y) / HORIZON;
  vec2 m = vec2(p.x, 2.0 * HORIZON - p.y);
  // Drifting noise, stretched sideways like wind on still water, in patches.
  vec2 rq = vec2(p.x * 7.0, p.y * 85.0);
  float n1 = noise(rq + vec2(t * 0.05, -t * 0.2)) - 0.5;
  float n2 = noise(rq * vec2(2.3, 1.9) + vec2(-t * 0.08, t * 0.28) + 13.0) - 0.5;
  float patchiness = 0.5 + noise(vec2(p.x * 3.0 + t * 0.02, p.y * 30.0 - t * 0.07) + 41.0);
  m.x += depth * patchiness * (0.012 * n1 + 0.007 * n2);
  m.y += depth * patchiness * 0.004 * n2;
  // Reflections are dark and rippled, so they get half the march.
  vec3 col = above(m, gHole, gHoleScale, 80.0) * mix(0.75, 0.35, depth);
  col = mix(col, SILHOUETTE * 0.75, cover(tree((m - gTreeBase) / gTreeSize, t) * gTreeSize));
  // The near rocks, and the islet itself, sit in the water rather than in its reflection.
  float w = min(gAspect, 1.6);
  vec2 r1 = (p - vec2(-0.55 * w, HORIZON - 0.04)) / vec2(0.035, 0.02);
  vec2 r2 = (p - vec2(-0.47 * w, HORIZON - 0.025)) / vec2(0.05, 0.008);
  float rocks = min((length(r1) - 1.0) * 0.02, (length(r2) - 1.0) * 0.008);
  col = mix(col, SILHOUETTE * 0.75, cover(rocks));
  if (p.y > HORIZON - 0.03) col = mix(col, SILHOUETTE, cover(tree((p - gTreeBase) / gTreeSize, t) * gTreeSize));
  // A darker band right at the bottom, like the near water in the photo.
  return col * (1.0 - 0.5 * smoothstep(0.5, 1.0, depth));
}

void main() {
  // Scene space: x centred on the screen, y from the bottom, both in screen heights.
  vec2 q = gl_FragCoord.xy / uRes;
  gAspect = uAspect;
  vec2 p = vec2((q.x - 0.5) * gAspect, q.y);
  float t = uTime;
  PIXEL = 1.0 / uRes.y;

  gHole = vec2(0.0, 1.0 - uCenterY);
  gHoleScale = 0.38 * min(gAspect, 1.6);
  // The tree stands out to the right, in the water, clear of the hole (and, on
  // wide screens, out in the margin beside the terminal).
  gTreeBase = vec2(0.40 * min(gAspect, 1.6), HORIZON - 0.012);
  gTreeSize = 0.22;

  // The waterline is soft too: blend the two sides across it.
  float dry = smoothstep(-PIXEL * 0.75, PIXEL * 0.75, p.y - HORIZON);
  vec3 col;
  if (dry >= 1.0) col = skyside(p, t);
  else if (dry <= 0.0) col = waterside(p, t);
  else col = mix(waterside(p, t), skyside(p, t), dry);

  // Deep blacks, hot highlights.
  col = 1.0 - exp(-col * 1.6);
  col = col * col * (3.0 - 2.0 * col);
  gl_FragColor = vec4(col, 1.0);
}
`;

// The CRT pass: draws the scene the way a well-adjusted tube would. The beam
// sweeps each scanline as a soft Gaussian (in linear light, so it adds up the way
// light does), wider where the picture is bright; the signal is analog along the
// line, so neighbouring samples blend smoothly; a fine aperture grille sits at
// single device pixels; and bright areas glow (halation) into their surroundings.
const CRT_FRAGMENT = `
precision highp float;
uniform sampler2D uScene;
uniform vec2 uSceneRes;   // scene texture size: one row per scanline
uniform vec2 uOutRes;     // output size in device pixels
uniform float uLinePx;    // device pixels per scanline (a whole number)
uniform float uTime;      // seconds
uniform float uPower;     // 0 -> 1 while the tube warms up

const float CURVE = 0.055;     // how much the glass bulges
const float CORNER = 0.035;    // rounding of the tube's corners

vec3 toLinear(vec3 c) { return c * c; }
vec3 toDisplay(vec3 c) { return sqrt(max(c, 0.0)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 scanline(float x, float row, float fringe) {
  float v = (clamp(row, 0.0, uSceneRes.y - 1.0) + 0.5) / uSceneRes.y;
  // Convergence error: red and blue land a little apart, more so toward the edges.
  float dx = fringe / uSceneRes.x;
  return toLinear(vec3(
    texture2D(uScene, vec2(x - dx, v)).r,
    texture2D(uScene, vec2(x, v)).g,
    texture2D(uScene, vec2(x + dx, v)).b));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / uOutRes;

  // The glass bulges: sample the picture through a gentle barrel curve.
  vec2 cc = uv - 0.5;
  vec2 w = uv + cc * dot(cc, cc) * CURVE * 4.0;

  // Warm-up: the picture starts as a dot, stretches into a bright line, then
  // opens out to fill the tube.
  float across = smoothstep(0.0, 0.3, uPower);
  float down = mix(0.006, 1.0, smoothstep(0.25, 0.8, uPower));
  w = 0.5 + (w - 0.5) / vec2(max(across, 0.001), down);

  // A faint, wandering wobble in the horizontal sweep.
  w.x += 0.0007 * sin(w.y * 38.0 + uTime * 2.1) * (0.5 + 0.5 * sin(uTime * 0.37));

  // Outside the tube's rounded face there is only black.
  vec2 aspect = vec2(uOutRes.x / uOutRes.y, 1.0);
  vec2 q = abs(w - 0.5) * aspect - (0.5 * aspect - CORNER);
  float face = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - CORNER;
  float inside = 1.0 - smoothstep(-0.004, 0.0, face);
  if (inside <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

  float x = w.x;
  float line = w.y * uOutRes.y / uLinePx;   // position in scanlines
  float row0 = floor(line - 0.5);
  float fringe = 0.22 + 1.8 * dot(cc, cc);

  // The two nearest scanlines, each a Gaussian beam whose width grows with brightness.
  vec3 col = vec3(0.0);
  for (int k = 0; k < 2; k++) {
    float row = row0 + float(k);
    vec3 s = scanline(x, row, fringe);
    float d = line - (row + 0.5);
    float bw = mix(0.30, 0.50, clamp(max(max(s.r, s.g), s.b), 0.0, 1.0));
    col += s * exp(-0.5 * d * d / (bw * bw)) / (bw * 2.5066);
  }

  // Halation: light scattering in the glass, from two soft rings of wide samples.
  vec2 px = 1.0 / uSceneRes;
  vec3 glow = vec3(0.0);
  for (int i = 0; i < 8; i++) {
    float a = float(i) * 0.7854;
    vec2 o = vec2(cos(a), sin(a));
    glow += toLinear(texture2D(uScene, w + o * px * 3.0).rgb);
    glow += toLinear(texture2D(uScene, w + o * px * 8.0).rgb) * 0.6;
  }
  col += glow / 12.8 * 0.22;

  // The refresh bar: a faint brighter band rolling slowly down the tube.
  float bar = fract(w.y * 0.6 - uTime * 0.11);
  col *= 1.0 + 0.06 * smoothstep(0.0, 0.06, bar) * smoothstep(0.16, 0.06, bar);

  // An uneven supply: the whole picture breathes very slightly.
  col *= 1.0 + 0.018 * (hash(vec2(floor(uTime * 9.0), 3.0)) - 0.5);

  // Aperture grille: R, G and B phosphor stripes one device pixel wide, kept gentle,
  // with the light they hold back given back so the picture keeps its brightness.
  float stripe = mod(floor(frag.x), 3.0);
  vec3 mask = vec3(0.72);
  if (stripe < 0.5) mask.r = 1.0; else if (stripe < 1.5) mask.g = 1.0; else mask.b = 1.0;
  col *= mask / 0.813;

  // Fine static, dimmer edges, and the glare of a room light on the glass.
  col += (hash(frag + floor(uTime * 24.0) * 17.31) - 0.5) * 0.012;
  col *= 1.0 - 0.45 * pow(clamp(length(cc * vec2(1.0, 1.15)) * 1.3, 0.0, 1.0), 2.6);
  col += vec3(0.9, 0.95, 1.0) * 0.022 * smoothstep(0.55, 0.0, length((uv - vec2(0.24, 0.82)) * vec2(1.0, 1.6)));

  // Warming up, the picture is a hot, overdriven line before it settles.
  col *= mix(3.5, 1.0, smoothstep(0.3, 0.9, uPower)) * smoothstep(0.0, 0.08, uPower);

  gl_FragColor = vec4(toDisplay(col * inside), 1.0);
}
`;

function createRenderer(canvas) {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    alpha: false,
    // Lets the dev tools read pixels back for checks; costs a copy, so dev only.
    preserveDrawingBuffer: import.meta.env.DEV,
  });
  if (!gl) return null;

  function program(fragment) {
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('TerminalCards backdrop shader:', gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, VERTEX);
    const fs = compile(gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) return null;
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null;
  }

  const scene = program(FRAGMENT);
  const crt = program(CRT_FRAGMENT);
  if (!scene || !crt) return null;

  // One triangle that covers the screen, shared by both passes.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const bindQuad = (p) => {
    const loc = gl.getAttribLocation(p, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  };

  // The scene renders into this texture. WebGL1 allows odd sizes only with
  // clamped edges, linear filtering and no mipmaps, which is all we need.
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer();

  const u = (p, name) => gl.getUniformLocation(p, name);
  const sceneU = {
    res: u(scene, 'uRes'),
    time: u(scene, 'uTime'),
    centerY: u(scene, 'uCenterY'),
    aspect: u(scene, 'uAspect'),
  };
  const crtU = {
    scene: u(crt, 'uScene'),
    sceneRes: u(crt, 'uSceneRes'),
    outRes: u(crt, 'uOutRes'),
    linePx: u(crt, 'uLinePx'),
    time: u(crt, 'uTime'),
    power: u(crt, 'uPower'),
  };

  let sceneW = 1;
  let sceneH = 1;
  let linePx = 3;

  return {
    resize(width, height, lineDevicePx) {
      linePx = lineDevicePx;
      sceneH = Math.ceil(height / linePx);
      // The beam is analog along the line, so give it more samples across than down.
      sceneW = Math.ceil((width / linePx) * 1.25);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sceneW, sceneH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    render(time, power) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, sceneW, sceneH);
      gl.useProgram(scene);
      bindQuad(scene);
      gl.uniform2f(sceneU.res, sceneW, sceneH);
      gl.uniform1f(sceneU.time, time);
      gl.uniform1f(sceneU.centerY, CENTER_Y);
      gl.uniform1f(sceneU.aspect, canvas.width / canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(crt);
      bindQuad(crt);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(crtU.scene, 0);
      gl.uniform2f(crtU.sceneRes, sceneW, sceneH);
      gl.uniform2f(crtU.outRes, canvas.width, canvas.height);
      gl.uniform1f(crtU.linePx, linePx);
      gl.uniform1f(crtU.time, time);
      gl.uniform1f(crtU.power, power);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(scene);
      gl.deleteProgram(crt);
      // No loseContext() here: the context belongs to the page's canvas and must
      // survive a remount (React runs effects twice in development).
    },
  };
}

export default function CrtBackdrop() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();
    let renderer = null;
    let coarseness = 1; // grows if the GPU can't keep up and drops the context
    let frameHandle = 0;
    let lastDraw = -Infinity;
    let stopped = false;

    function draw(now) {
      if (!renderer) return;
      // The tube warms up over the first second and a half after the page opens.
      const power = reduceMotion ? 1 : Math.min(1, (now - start) / WARM_UP_MS);
      renderer.render((now - start) / 1000, power);
      canvas.dataset.frames = String(Number(canvas.dataset.frames || 0) + 1);
    }

    function resize() {
      if (!renderer) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.ceil(window.innerWidth * dpr);
      canvas.height = Math.ceil(window.innerHeight * dpr);
      // Every scanline spans a whole number of device pixels, so none of them shimmer.
      const linePx = Math.max(2, Math.round(LINE_CSS_PX * coarseness * dpr));
      renderer.resize(canvas.width, canvas.height, linePx);
      canvas.dataset.linePx = String(linePx);
      draw(performance.now());
    }

    // About 30 frames a second is plenty for a slow scene and keeps the GPU cool.
    function tick(now) {
      if (stopped) return;
      if (now - lastDraw > 33) {
        lastDraw = now;
        draw(now);
      }
      frameHandle = requestAnimationFrame(tick);
    }

    // A slow GPU may drop the context. Come back with coarser scanlines.
    function onLost(e) {
      e.preventDefault();
      renderer = null;
    }
    function onRestored() {
      coarseness *= 1.5;
      renderer = createRenderer(canvas);
      resize();
    }

    renderer = createRenderer(canvas); // no WebGL at all: the backdrop stays plain black
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    window.addEventListener('resize', resize);
    resize();
    if (!reduceMotion) frameHandle = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      cancelAnimationFrame(frameHandle);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      window.removeEventListener('resize', resize);
      renderer?.dispose();
    };
  }, []);

  return (
    <div className="tc-crt-backdrop" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
