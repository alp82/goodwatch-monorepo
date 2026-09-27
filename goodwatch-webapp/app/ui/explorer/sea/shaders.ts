// The sea as one full-screen fragment shader: night water, two layers of fog at a depth, islands floating over their
// shadows with a backdrop-collage surface, luminous shorelines with surf, haze, a spotlight, vignette, and grain.
// The body is shared by GLSL ES 3.00 (WebGL2) and 1.00 (WebGL1); TEX and OUT paper over the differences.

/** Uniform vectors the shader uses besides the three per-island arrays (WebGL1 sizes its arrays from the rest). */
export const RESERVED_UNIFORM_VECTORS = 13

const body = (islands: number) => `
uniform vec2 uRes;
uniform vec3 uCam;
uniform float uFit;
uniform float uDpr;
uniform float uTime;
uniform float uDeep;
uniform int uN;
uniform vec4 uIsl[${islands}];
uniform vec4 uCol[${islands}];
uniform vec4 uUv[${islands}];
uniform vec4 uSpot;
uniform sampler2D uAtlas;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 grad(vec2 i){
  i = mod(i, 289.);
  vec2 p = vec2(dot(i, vec2(127.1, 311.7)), dot(i, vec2(269.5, 183.3)));
  return -1. + 2. * fract(sin(p) * 43758.5453);
}
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float a = dot(grad(i), f);
  float b = dot(grad(i + vec2(1., 0.)), f - vec2(1., 0.));
  float c = dot(grad(i + vec2(0., 1.)), f - vec2(0., 1.));
  float d = dot(grad(i + vec2(1., 1.)), f - vec2(1., 1.));
  return .5 + .75 * mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.; float a = .5;
  mat2 R = mat2(.8, -.6, .6, .8);
  for (int k = 0; k < 5; k++) { v += a * noise(p); p = R * p * 2.03 + vec2(17.1, 9.2); a *= .5; }
  return v;
}
// Signed distance to an island's wobbly outline (I: center, radius, seed).
float shape(vec2 q, vec4 I){
  float a = atan(q.y, q.x); float s = I.w;
  float rr = I.z * (1. + .055 * sin(3. * a + s) + .035 * sin(5. * a + s * 2.3) + .03 * sin(2. * a + s * .7));
  return length(q) - rr;
}
// A layer at a depth: it pans by k of the camera and zooms by the square root of the scale.
vec2 layer(vec2 frag, float k){
  float sl = sqrt(uCam.z * uFit);
  return (frag - uRes * .5) / sl + uCam.xy * (uCam.z / sl) * k;
}

void main(){
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = uCam.xy + (frag - uRes * .5) / uCam.z;
  vec2 sv = frag / uRes;
  float t = uTime;

  vec3 col = mix(vec3(.022, .03, .058), vec3(.012, .016, .034), sv.y);
  vec2 L = layer(frag, .72);
  float fog = fbm(L * .0042 + vec2(t * .006, -t * .004));
  float fog2 = fbm(L * .011 - vec2(t * .01, t * .006));

  float dMin = 16000.; // within mediump range
  vec4 bI = vec4(0.);
  vec4 bC = vec4(0.);
  vec4 bU = vec4(0., 0., -1., 1.);
  bool found = false;
  vec3 glow = vec3(0.);
  vec3 near = vec3(.3, .4, .6);
  float wsum = 0.;
  vec3 surfs = vec3(0.);
  for (int i = 0; i < ${islands}; i++) {
    if (i >= uN) break;
    vec4 I = uIsl[i];
    vec4 C = uCol[i];
    if (I.z < .5) continue;
    float d = shape(p - I.xy, I);
    float ce = clamp(C.a, 0., 1.7);
    float g = exp(-max(d, 0.) / (I.z * (.32 + .22 * min(ce, 1.))));
    glow += C.rgb * g * (.55 + .8 * ce);
    float w = exp(-max(d, 0.) / (I.z * .9));
    near += C.rgb * w; wsum += w;
    // Surf off every shore, summed: taking only the nearest island's leaves seams between islands of different sizes.
    if (d > 0.) surfs += C.rgb * pow(.5 + .5 * sin(d / (I.z * .045) * 6.2832 - t * 1.1), 6.) * exp(-d / (I.z * .16));
    if (d < dMin) { dMin = d; bI = I; bC = C; bU = uUv[i]; found = true; }
  }
  near /= (1. + wsum);
  col += near * (fog * fog * .55 + fog2 * .08);
  col += glow * .16;

  if (found) {
    vec4 I = bI;
    vec3 tint = bC.rgb;
    float em = clamp(bC.a, -1., 1.);
    float r = I.z;
    vec2 q = p - I.xy;
    float dpx = dMin * uCam.z;
    float px = uDpr;
    vec2 view = (uCam.xy - I.xy) / r;
    vec2 off = vec2(0., r * .07) - view * r * .03;
    float ds = shape(q - off, I);
    float sh = smoothstep(r * .22, -r * .06, ds);
    col *= 1. - .62 * sh * step(0., dMin);
    if (dMin > 0.) col += surfs * .16 * (1. - .6 * uDeep);
    float inside = 1. - smoothstep(-px * .8, px * .8, dpx);
    if (inside > 0.) {
      vec2 lp = q / (r * 1.18) + view * .035;
      vec2 uv = bU.xy + (lp * .5 + .5) * bU.zz;
      vec3 tex = bU.z > 0. ? TEX(uAtlas, uv).rgb : tint * .5;
      tex = max(mix(vec3(dot(tex, vec3(.299, .587, .114))), tex, bU.w), 0.);
      vec3 land = tex * (.82 - .42 * uDeep) + tint * .1;
      vec2 hq = q / r * 1.5 + I.w * 3.;
      float h0 = fbm(hq);
      float h1 = fbm(hq + vec2(.07, .055));
      land *= 1. + clamp((h0 - h1) * 1.6, -.12, .12) * (1. - .9 * uDeep);
      vec2 n = q / max(length(q), 1e-3);
      float lit = dot(n, normalize(vec2(-.55, -.83)));
      float rim = smoothstep(-r * .16, 0., dMin);
      land += tint * rim * max(lit, 0.) * .5;
      land *= 1. - rim * max(-lit, 0.) * .45;
      land *= mix(1., .72, (1. - smoothstep(-r * .7, -r * .1, dMin)) * uDeep);
      land *= .88 + .3 * em;
      col = mix(col, land, inside);
    }
    float core = exp(-abs(dpx) / (1.1 * px));
    float halo = exp(-abs(dpx) / (9. * px + r * uCam.z * .012));
    vec3 shore = mix(tint, vec3(1.), .55);
    float pick = max(bC.a - 1., 0.);
    col += shore * core * (.75 + .5 * em + pick) + tint * halo * max(.32 + .35 * em + pick * .8, .05);
  }

  vec2 Hh = layer(frag, 1.28);
  float haze = fbm(Hh * .0028 + vec2(-t * .009, t * .005));
  haze = smoothstep(.45, .85, haze);
  col = mix(col, vec3(.55, .62, .78) * .5 + near * .35, haze * .2 * (1. - uDeep));

  if (uSpot.w > 0.) col *= 1. - uSpot.w * smoothstep(uSpot.z * 1.2, uSpot.z * 3.6, length(p - uSpot.xy));
  vec2 c = sv - .5;
  col *= 1. - .55 * dot(c, c) * 1.6;
  col += (hash(frag + fract(t) * 91.7) - .5) * .018;
  col = col / (1. + col * .18);
  OUT = vec4(pow(max(col, 0.), vec3(.94)), 1.);
}`

export const VERTEX_SHADER_300 = `#version 300 es
in vec2 a;
void main(){ gl_Position = vec4(a, 0., 1.); }`

export const VERTEX_SHADER_100 = `attribute vec2 a;
void main(){ gl_Position = vec4(a, 0., 1.); }`

export const fragmentShader300 = (islands: number) => `#version 300 es
precision highp float;
#define TEX texture
#define OUT o
out vec4 o;
${body(islands)}`

/** GLSL ES 1.00; devices without highp in fragment shaders get mediump (the noise is a little coarser). */
export const fragmentShader100 = (
	islands: number,
	highp: boolean,
) => `precision ${highp ? "highp" : "mediump"} float;
#define TEX texture2D
#define OUT gl_FragColor
${body(islands)}`
