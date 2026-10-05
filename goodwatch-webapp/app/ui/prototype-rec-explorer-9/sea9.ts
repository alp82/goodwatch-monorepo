// PROTOTYPE - throwaway. The round-9 islands' ground (#180): round 7's sea (sea7.ts) with one addition, a saturation
// per island, so islands out of focus can fade to grey while the ones in focus stay vivid (the focus layout). The
// saturation rides in the fourth component of each island's atlas rect (its width and height are always equal). The
// Canvas 2D path also redraws when islands move (they do now), and greys a tile with a "saturation" blend. The surf
// off the shores is summed over every island instead of taken from the nearest, which left seams in the water once
// islands differ a lot in size.
// Round 7's notes follow. The islands' ground, in three renderers, best first:
//   WebGL2     round 6's sea, as is: night sea, deep fog, islands floating over their shadows, a backdrop-collage
//              surface tinted by their posters, luminous shorelines with surf, bloom, haze, vignette, grain;
//   WebGL1     the same shader written for GLSL ES 1.00 (browsers without WebGL2); uniforms are copied into locals
//              inside the loop (ES 1.00 only promises constant-index access) and the island count shrinks to what
//              the device's uniform budget holds;
//   Canvas 2D  no shaders, last resort: the same island shapes and shorelines, the backdrop collage clipped into
//              each island, a rim light, soft shadows, drifting fog from a prerendered noise tile, a vignette.
// The page picks the best one available; ?gl=0|1|2 forces one in development so they can be compared.
import {
	COLS,
	SLOT,
	rgbCss,
	slotRect,
} from "~/ui/prototype-rec-explorer-6/surface6"
import type { GlLevel } from "~/ui/prototype-rec-explorer-7/wire7"

export const MAX_ISL = 24

export type SeaIsland9 = {
	x: number
	y: number
	r: number
	seed: number
	/** Tint, 0..1 rgb. */
	c: [number, number, number]
	/** Emphasis 0..1 (more glow); an island picked for combining goes up to about 1.7, a dimmed one down to -1. */
	e: number
	/** Atlas slot, or -1 for tint only. */
	slot: number
	/** Saturation of the land: 1 as painted, 0 grey, a little over 1 more vivid. */
	sat: number
}

export type SeaFrame = {
	w: number
	h: number
	dpr: number
	cam: { x: number; y: number; s: number }
	fit: number
	time: number
	deep: number
	islands: SeaIsland9[]
	/** A pool of light around one island (world units, k 0..1): the night closes in beyond r * 1.2. */
	spot: { x: number; y: number; r: number; k: number } | null
}

export type Ground = {
	kind: GlLevel
	tile: (src: HTMLCanvasElement, slot: number) => void
	draw: (o: SeaFrame) => void
	/** Whether the ground moves on its own (then every frame is drawn). */
	animated: boolean
	destroy: () => void
}

// ---------------------------------------------------------------- shaders

const BODY = (max: number) => `
uniform vec2 uRes;
uniform vec3 uCam;
uniform float uFit;
uniform float uDpr;
uniform float uTime;
uniform float uDeep;
uniform int uN;
uniform vec4 uIsl[${max}];
uniform vec4 uCol[${max}];
uniform vec4 uUv[${max}];
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
float shape(vec2 q, vec4 I){
  float a = atan(q.y, q.x); float s = I.w;
  float rr = I.z * (1. + .055 * sin(3. * a + s) + .035 * sin(5. * a + s * 2.3) + .03 * sin(2. * a + s * .7));
  return length(q) - rr;
}
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

  float dMin = 60000.;
  vec4 bI = vec4(0.);
  vec4 bC = vec4(0.);
  vec4 bU = vec4(0., 0., -1., -1.);
  bool found = false;
  vec3 glow = vec3(0.);
  vec3 near = vec3(.3, .4, .6);
  float wsum = 0.;
  vec3 surfs = vec3(0.);
  for (int i = 0; i < ${max}; i++) {
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
    // Surf off every shore, summed (islands of very different sizes would leave seams if only the nearest had it).
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

const VS2 = `#version 300 es
in vec2 a;
void main(){ gl_Position = vec4(a, 0., 1.); }`
const VS1 = `attribute vec2 a;
void main(){ gl_Position = vec4(a, 0., 1.); }`
const FS2 = (max: number) => `#version 300 es
precision highp float;
#define TEX texture
#define OUT o
out vec4 o;
${BODY(max)}`
const FS1 = (max: number) => `precision highp float;
#define TEX texture2D
#define OUT gl_FragColor
${BODY(max)}`
// Phones without highp in fragment shaders get mediump (the noise is a little coarser).
const FS1m = (max: number) =>
	FS1(max).replace("precision highp float;", "precision mediump float;")

// ---------------------------------------------------------------- WebGL (1 or 2)

function makeGL(
	canvas: HTMLCanvasElement,
	atlas: HTMLCanvasElement,
	level: 1 | 2,
): Ground | null {
	const opts = {
		antialias: false,
		alpha: false,
		premultipliedAlpha: false,
		powerPreference: "high-performance" as const,
	}
	const gl = (
		level === 2
			? canvas.getContext("webgl2", opts)
			: canvas.getContext("webgl", opts)
	) as WebGLRenderingContext | null
	if (!gl) return null
	let max = MAX_ISL
	let fsrc: string
	if (level === 1) {
		// Three vec4 per island plus a dozen for the rest must fit the fragment uniform budget.
		const budget = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) as number
		max = Math.max(4, Math.min(MAX_ISL, Math.floor((budget - 13) / 3)))
		const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
		fsrc = hp && hp.precision > 0 ? FS1(max) : FS1m(max)
	} else fsrc = FS2(max)
	const sh = (type: number, src: string) => {
		const s = gl.createShader(type) as WebGLShader
		gl.shaderSource(s, src)
		gl.compileShader(s)
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
			throw new Error(gl.getShaderInfoLog(s) ?? "shader")
		return s
	}
	const prog = gl.createProgram() as WebGLProgram
	try {
		gl.attachShader(prog, sh(gl.VERTEX_SHADER, level === 2 ? VS2 : VS1))
		gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsrc))
		gl.linkProgram(prog)
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
			throw new Error(gl.getProgramInfoLog(prog) ?? "link")
	} catch (e) {
		console.warn(
			`sea9: WebGL${level} shader failed, trying the next renderer.`,
			e,
		)
		return null
	}
	gl.useProgram(prog)
	const buf = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, buf)
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 3, -1, -1, 3]),
		gl.STATIC_DRAW,
	)
	const loc = gl.getAttribLocation(prog, "a")
	gl.enableVertexAttribArray(loc)
	gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
	const U = (n: string) => gl.getUniformLocation(prog, n)
	const u = {
		res: U("uRes"),
		cam: U("uCam"),
		fit: U("uFit"),
		dpr: U("uDpr"),
		time: U("uTime"),
		deep: U("uDeep"),
		n: U("uN"),
		isl: U("uIsl"),
		col: U("uCol"),
		uv: U("uUv"),
		spot: U("uSpot"),
		atlas: U("uAtlas"),
	}
	const tex = gl.createTexture()
	gl.activeTexture(gl.TEXTURE0)
	gl.bindTexture(gl.TEXTURE_2D, tex)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
	// The atlas is a power of two, so mipmaps work in WebGL1 too.
	gl.generateMipmap(gl.TEXTURE_2D)
	gl.texParameteri(
		gl.TEXTURE_2D,
		gl.TEXTURE_MIN_FILTER,
		gl.LINEAR_MIPMAP_LINEAR,
	)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	gl.uniform1i(u.atlas, 0)
	const I = new Float32Array(max * 4)
	const C = new Float32Array(max * 4)
	const V = new Float32Array(max * 4)
	let lost = false
	canvas.addEventListener("webglcontextlost", (e) => {
		e.preventDefault()
		lost = true
	})
	const ATL = SLOT * COLS
	const inset = 8 / ATL
	return {
		kind: level,
		animated: true,
		tile(src, slot) {
			if (lost) return
			const r = slotRect(slot)
			gl.bindTexture(gl.TEXTURE_2D, tex)
			gl.texSubImage2D(
				gl.TEXTURE_2D,
				0,
				r.x,
				r.y,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				src,
			)
			gl.generateMipmap(gl.TEXTURE_2D)
		},
		draw(o) {
			if (lost) return
			const W = Math.round(o.w * o.dpr)
			const H = Math.round(o.h * o.dpr)
			if (canvas.width !== W || canvas.height !== H) {
				canvas.width = W
				canvas.height = H
			}
			gl.viewport(0, 0, W, H)
			const n = Math.min(max, o.islands.length)
			for (let i = 0; i < n; i++) {
				const s = o.islands[i]
				I.set([s.x, s.y, s.r, s.seed], i * 4)
				C.set([s.c[0], s.c[1], s.c[2], s.e], i * 4)
				if (s.slot >= 0) {
					const r = slotRect(s.slot)
					V.set(
						[
							r.x / ATL + inset,
							r.y / ATL + inset,
							SLOT / ATL - 2 * inset,
							s.sat,
						],
						i * 4,
					)
				} else V.set([0, 0, -1, s.sat], i * 4)
			}
			gl.uniform2f(u.res, W, H)
			gl.uniform3f(u.cam, o.cam.x, o.cam.y, o.cam.s * o.dpr)
			gl.uniform1f(u.fit, o.fit * o.dpr)
			gl.uniform1f(u.dpr, o.dpr)
			gl.uniform1f(u.time, o.time)
			gl.uniform1f(u.deep, o.deep)
			gl.uniform1i(u.n, n)
			gl.uniform4fv(u.isl, I)
			gl.uniform4fv(u.col, C)
			gl.uniform4fv(u.uv, V)
			const sp = o.spot
			gl.uniform4f(u.spot, sp?.x ?? 0, sp?.y ?? 0, sp?.r ?? 1, sp ? sp.k : 0)
			gl.drawArrays(gl.TRIANGLES, 0, 3)
		},
		destroy() {
			lost = true
			gl.deleteTexture(tex)
			gl.deleteBuffer(buf)
			gl.deleteProgram(prog)
		},
	}
}

// ---------------------------------------------------------------- Canvas 2D

/** A tileable fog texture (value noise, a few octaves), made once. */
let FOG: HTMLCanvasElement | null = null
function fogTile() {
	if (FOG) return FOG
	const N = 256
	const c = document.createElement("canvas")
	c.width = N
	c.height = N
	const g = c.getContext("2d") as CanvasRenderingContext2D
	const img = g.createImageData(N, N)
	const rnd = (x: number, y: number, p: number) => {
		const h =
			Math.sin(
				(((x % p) + p) % p) * 127.1 + (((y % p) + p) % p) * 311.7 + p * 17.3,
			) * 43758.5453
		return h - Math.floor(h)
	}
	const val = (x: number, y: number, p: number) => {
		const x0 = Math.floor(x)
		const y0 = Math.floor(y)
		const fx = x - x0
		const fy = y - y0
		const sx = fx * fx * (3 - 2 * fx)
		const sy = fy * fy * (3 - 2 * fy)
		const a = rnd(x0, y0, p)
		const b = rnd(x0 + 1, y0, p)
		const cc = rnd(x0, y0 + 1, p)
		const d = rnd(x0 + 1, y0 + 1, p)
		return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy
	}
	for (let y = 0; y < N; y++)
		for (let x = 0; x < N; x++) {
			let v = 0
			let amp = 0.55
			let p = 4
			for (let o = 0; o < 4; o++) {
				v += amp * val((x / N) * p, (y / N) * p, p)
				amp *= 0.5
				p *= 2
			}
			const f = Math.max(0, Math.min(1, (v - 0.35) / 0.6))
			const k = (y * N + x) * 4
			img.data[k] = 118
			img.data[k + 1] = 138
			img.data[k + 2] = 190
			img.data[k + 3] = Math.round(f * f * 120)
		}
	g.putImageData(img, 0, 0)
	FOG = c
	return c
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
let NIGHT: HTMLCanvasElement | null = null
/** Clear in the middle third, night at the edge (the 2D path's pool of light). */
function night() {
	if (NIGHT) return NIGHT
	const c = document.createElement("canvas")
	c.width = 256
	c.height = 256
	const n = c.getContext("2d") as CanvasRenderingContext2D
	const gr = n.createRadialGradient(128, 128, 0, 128, 128, 128)
	gr.addColorStop(0, "rgba(0,0,0,0)")
	gr.addColorStop(1.2 / 3.6, "rgba(0,0,0,0)")
	gr.addColorStop(1, "rgba(0,0,0,1)")
	n.fillStyle = gr
	n.fillRect(0, 0, 256, 256)
	NIGHT = c
	return c
}
const shapeR = (r: number, s: number, a: number) =>
	r *
	(1 +
		0.055 * Math.sin(3 * a + s) +
		0.035 * Math.sin(5 * a + s * 2.3) +
		0.03 * Math.sin(2 * a + s * 0.7))

function make2D(glc: HTMLCanvasElement): Ground {
	// A canvas of its own next to the WebGL one: a canvas that ever gave out a WebGL context can't draw in 2D.
	const cv = document.createElement("canvas")
	cv.className = glc.className
	cv.setAttribute("aria-hidden", "true")
	glc.style.display = "none"
	glc.after(cv)
	const g = cv.getContext("2d") as CanvasRenderingContext2D
	const tiles = new Map<number, HTMLCanvasElement>()
	const fog = g.createPattern(fogTile(), "repeat") as CanvasPattern
	let vign: { w: number; h: number; c: HTMLCanvasElement } | null = null
	let lastSig = ""
	const vignette = (w: number, h: number) => {
		if (vign && vign.w === w && vign.h === h) return vign.c
		const c = document.createElement("canvas")
		c.width = Math.max(1, Math.round(w / 2))
		c.height = Math.max(1, Math.round(h / 2))
		const v = c.getContext("2d") as CanvasRenderingContext2D
		const gr = v.createRadialGradient(
			c.width / 2,
			c.height / 2,
			Math.min(c.width, c.height) * 0.25,
			c.width / 2,
			c.height / 2,
			Math.hypot(c.width, c.height) * 0.62,
		)
		gr.addColorStop(0, "rgba(0,0,0,0)")
		gr.addColorStop(1, "rgba(0,0,0,.55)")
		v.fillStyle = gr
		v.fillRect(0, 0, c.width, c.height)
		vign = { w, h, c }
		return c
	}
	return {
		kind: 0,
		animated: false,
		tile(src, slot) {
			tiles.set(slot, src)
			lastSig = ""
		},
		draw(o) {
			const { w: W, h: H, cam } = o
			const dpr = Math.min(1.5, o.dpr)
			// Nothing moves on its own here: draw only when something changed.
			const sp = o.spot
			let sig = `${W}|${H}|${cam.x.toFixed(2)}|${cam.y.toFixed(2)}|${cam.s.toFixed(5)}|${o.deep.toFixed(3)}|${sp ? `${sp.x.toFixed(1)},${sp.y.toFixed(1)},${sp.r.toFixed(1)},${sp.k.toFixed(2)}` : ""}`
			for (const i of o.islands)
				sig += `|${i.x.toFixed(1)},${i.y.toFixed(1)},${i.r.toFixed(1)},${i.e.toFixed(2)},${i.c[0].toFixed(2)}${i.c[1].toFixed(2)}${i.c[2].toFixed(2)},${i.slot},${i.sat.toFixed(2)}`
			if (sig === lastSig) return
			lastSig = sig
			const PW = Math.round(W * dpr)
			const PH = Math.round(H * dpr)
			if (cv.width !== PW || cv.height !== PH) {
				cv.width = PW
				cv.height = PH
			}
			g.setTransform(dpr, 0, 0, dpr, 0, 0)
			g.globalCompositeOperation = "source-over"
			g.globalAlpha = 1
			const sea = g.createLinearGradient(0, 0, 0, H)
			sea.addColorStop(0, "#060a16")
			sea.addColorStop(1, "#03050c")
			g.fillStyle = sea
			g.fillRect(0, 0, W, H)
			// Fog, at a depth: it pans slower than the islands and zooms more gently.
			const sl = Math.sqrt(cam.s * o.fit)
			const unit = (sl * 952) / 256
			fog.setTransform(
				new DOMMatrix([
					unit,
					0,
					0,
					unit,
					W / 2 - cam.x * cam.s * 0.72,
					H / 2 - cam.y * cam.s * 0.72,
				]),
			)
			g.globalAlpha = 0.85
			g.fillStyle = fog
			g.fillRect(0, 0, W, H)
			g.globalAlpha = 1
			const vis = o.islands
				.map((i) => ({
					i,
					sx: W / 2 + (i.x - cam.x) * cam.s,
					sy: H / 2 + (i.y - cam.y) * cam.s,
					sr: i.r * cam.s,
				}))
				.filter(
					(v) =>
						v.sr > 0.5 &&
						v.sx + v.sr * 2 > 0 &&
						v.sx - v.sr * 2 < W &&
						v.sy + v.sr * 2 > 0 &&
						v.sy - v.sr * 2 < H,
				)
			const path = (v: (typeof vis)[number], k = 1, dx = 0, dy = 0) => {
				const p = new Path2D()
				const N = 72
				for (let n = 0; n <= N; n++) {
					const a = (n / N) * Math.PI * 2
					const rr = shapeR(v.sr * k, v.i.seed, a)
					const x = v.sx + dx + Math.cos(a) * rr
					const y = v.sy + dy + Math.sin(a) * rr
					if (n) p.lineTo(x, y)
					else p.moveTo(x, y)
				}
				p.closePath()
				return p
			}
			// Light: each island's glow on the water, added.
			g.globalCompositeOperation = "lighter"
			for (const v of vis) {
				const e = clamp01(v.i.e)
				const gr = g.createRadialGradient(
					v.sx,
					v.sy,
					v.sr * 0.7,
					v.sx,
					v.sy,
					v.sr * (1.7 + 0.3 * e),
				)
				gr.addColorStop(0, rgbCss(v.i.c, 0.2 + 0.18 * e))
				gr.addColorStop(1, rgbCss(v.i.c, 0))
				g.fillStyle = gr
				g.fillRect(v.sx - v.sr * 2.1, v.sy - v.sr * 2.1, v.sr * 4.2, v.sr * 4.2)
			}
			g.globalCompositeOperation = "source-over"
			// Shadows: the island floats a little above the water.
			for (const v of vis) {
				for (const [k, a] of [
					[1.07, 0.12],
					[1.035, 0.16],
					[1, 0.22],
				] as const) {
					g.fillStyle = `rgba(0,0,0,${a})`
					g.fill(path(v, k, 0, v.sr * 0.07))
				}
			}
			for (const v of vis) {
				const shape = path(v)
				const e = Math.max(-1, Math.min(1, v.i.e))
				const pick = Math.max(0, v.i.e - 1)
				// Surf: two faint rings off the shore.
				g.lineWidth = 1.2
				g.strokeStyle = rgbCss(v.i.c, 0.13 * (1 - 0.6 * o.deep))
				g.stroke(path(v, 1.05))
				g.strokeStyle = rgbCss(v.i.c, 0.06 * (1 - 0.6 * o.deep))
				g.stroke(path(v, 1.11))
				// The land: the backdrop collage clipped to the island, graded like the WebGL version.
				g.save()
				g.clip(shape)
				const t = v.i.slot >= 0 ? tiles.get(v.i.slot) : undefined
				const view = {
					x: ((cam.x - v.i.x) / v.i.r) * 0.035,
					y: ((cam.y - v.i.y) / v.i.r) * 0.035,
				}
				if (t) {
					g.fillStyle = rgbCss(
						v.i.c.map((x) => x * 0.3) as [number, number, number],
					)
					g.fillRect(
						v.sx - v.sr * 1.2,
						v.sy - v.sr * 1.2,
						v.sr * 2.4,
						v.sr * 2.4,
					)
					const s = v.sr * 1.24
					const px = Math.max(-0.06, Math.min(0.06, view.x)) * s
					const py = Math.max(-0.06, Math.min(0.06, view.y)) * s
					g.drawImage(
						t,
						8,
						8,
						SLOT - 16,
						SLOT - 16,
						v.sx - s - px,
						v.sy - s - py,
						s * 2,
						s * 2,
					)
					// Out of focus: toward grey (a "saturation" blend of grey takes the color out in proportion).
					if (v.i.sat < 0.98) {
						g.globalCompositeOperation = "saturation"
						g.fillStyle = `rgba(128,128,128,${clamp01(1 - v.i.sat)})`
						g.fillRect(
							v.sx - v.sr * 1.2,
							v.sy - v.sr * 1.2,
							v.sr * 2.4,
							v.sr * 2.4,
						)
						g.globalCompositeOperation = "source-over"
					}
					g.fillStyle = `rgba(4,6,14,${0.18 + 0.42 * o.deep + Math.max(0, 0.12 - 0.3 * e)})`
					g.fillRect(
						v.sx - v.sr * 1.2,
						v.sy - v.sr * 1.2,
						v.sr * 2.4,
						v.sr * 2.4,
					)
				} else {
					const gr = g.createRadialGradient(v.sx, v.sy, 0, v.sx, v.sy, v.sr)
					gr.addColorStop(
						0,
						rgbCss(v.i.c.map((x) => x * 0.42) as [number, number, number]),
					)
					gr.addColorStop(
						1,
						rgbCss(v.i.c.map((x) => x * 0.22) as [number, number, number]),
					)
					g.fillStyle = gr
					g.fillRect(
						v.sx - v.sr * 1.2,
						v.sy - v.sr * 1.2,
						v.sr * 2.4,
						v.sr * 2.4,
					)
				}
				// Rim light from the upper left, a shade on the far side.
				const lx = -0.55
				const ly = -0.83
				const rim = g.createLinearGradient(
					v.sx + lx * v.sr,
					v.sy + ly * v.sr,
					v.sx - lx * v.sr,
					v.sy - ly * v.sr,
				)
				rim.addColorStop(0, rgbCss(v.i.c, 0.42))
				rim.addColorStop(0.3, rgbCss(v.i.c, 0.04))
				rim.addColorStop(0.7, "rgba(0,0,0,0)")
				rim.addColorStop(1, "rgba(0,0,0,.38)")
				g.fillStyle = rim
				g.fillRect(v.sx - v.sr * 1.2, v.sy - v.sr * 1.2, v.sr * 2.4, v.sr * 2.4)
				// Deep in, the middle sinks a little so the posters sit in a basin.
				if (o.deep > 0.01) {
					const b = g.createRadialGradient(
						v.sx,
						v.sy,
						0,
						v.sx,
						v.sy,
						v.sr * 0.85,
					)
					b.addColorStop(0, `rgba(0,0,0,${0.26 * o.deep})`)
					b.addColorStop(1, "rgba(0,0,0,0)")
					g.fillStyle = b
					g.fillRect(v.sx - v.sr, v.sy - v.sr, v.sr * 2, v.sr * 2)
				}
				g.restore()
				// The shoreline: a soft halo and a thin bright line.
				g.lineJoin = "round"
				g.lineWidth = 12
				g.strokeStyle = rgbCss(
					v.i.c,
					Math.max(0.03, 0.08 + 0.06 * e + 0.1 * pick),
				)
				g.stroke(shape)
				g.lineWidth = 5
				g.strokeStyle = rgbCss(
					v.i.c,
					Math.max(0.06, 0.2 + 0.12 * e + 0.2 * pick),
				)
				g.stroke(shape)
				g.lineWidth = 1.6
				g.strokeStyle = rgbCss(
					v.i.c.map((x) => x + (1 - x) * 0.55) as [number, number, number],
					Math.max(0.3, 0.85 + 0.15 * e),
				)
				g.stroke(shape)
			}
			if (sp && sp.k > 0.01) {
				// The pool of light: a prerendered ring of night, and plain night beyond it.
				const R = Math.round(sp.r * cam.s * 3.6)
				const x0 = Math.round(W / 2 + (sp.x - cam.x) * cam.s) - R
				const y0 = Math.round(H / 2 + (sp.y - cam.y) * cam.s) - R
				g.globalAlpha = sp.k
				g.drawImage(night(), x0, y0, 2 * R, 2 * R)
				g.fillStyle = "rgb(0,0,0)"
				g.fillRect(0, 0, W, Math.max(0, y0))
				g.fillRect(0, y0 + 2 * R, W, Math.max(0, H - y0 - 2 * R))
				g.fillRect(0, y0, Math.max(0, x0), 2 * R)
				g.fillRect(x0 + 2 * R, y0, Math.max(0, W - x0 - 2 * R), 2 * R)
				g.globalAlpha = 1
			}
			g.drawImage(vignette(W, H), 0, 0, W, H)
		},
		destroy() {
			cv.remove()
			glc.style.display = ""
		},
	}
}

// ---------------------------------------------------------------- pick one

/** The best renderer available, or the one asked for (?gl=0|1|2 in development). */
export function makeGround(
	glc: HTMLCanvasElement,
	atlas: HTMLCanvasElement,
	want: GlLevel | null,
): Ground {
	if (want === 0) return make2D(glc)
	if (want === 1) return makeGL(glc, atlas, 1) ?? make2D(glc)
	if (want === 2) return makeGL(glc, atlas, 2) ?? make2D(glc)
	return makeGL(glc, atlas, 2) ?? makeGL(glc, atlas, 1) ?? make2D(glc)
}
