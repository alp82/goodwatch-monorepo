// PROTOTYPE - throwaway. The round-6 islands' ground (#180), hand-written WebGL2, no libraries. One full-screen pass
// draws, back to front: the night sea with a slow deep fog (parallax, it moves slower than the islands), each island
// floating over its own soft shadow, its surface (a blurred collage of its titles' backdrops, a mosaic of its posters,
// or glowing contour lines, per variant) tinted by its posters' colors, a luminous shoreline with a faint surf
// rippling outward, an analytic bloom around every island, a high haze that drifts in front (faster than the islands)
// and thins out as you zoom in, then a vignette and film grain. Posters and words are drawn on a 2D canvas above.
// Everything is computed per pixel from ~16 islands' centers and radii, so panning and zooming cost nothing extra.

export const MAX_ISL = 24
export type SurfaceStyle = "backdrop" | "mosaic" | "contour"
const STYLE: Record<SurfaceStyle, number> = { backdrop: 0, mosaic: 1, contour: 2 }

const VS = `#version 300 es
in vec2 a;
void main(){ gl_Position = vec4(a, 0., 1.); }`

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec3 uCam;
uniform float uFit;
uniform float uDpr;
uniform float uTime;
uniform float uDeep;
uniform int uStyle;
uniform int uN;
uniform vec4 uIsl[${MAX_ISL}];
uniform vec4 uCol[${MAX_ISL}];
uniform vec4 uUv[${MAX_ISL}];
uniform sampler2D uAtlas;
out vec4 o;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
vec2 grad(vec2 i){
  i = mod(i, 289.);
  vec2 p = vec2(dot(i, vec2(127.1, 311.7)), dot(i, vec2(269.5, 183.3)));
  return -1. + 2. * fract(sin(p) * 43758.5453);
}
// Gradient noise with a quintic fade: no grid seams, unlike value noise.
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
// A layer at another depth: it pans at k times the islands' speed and zooms more gently.
vec2 layer(vec2 frag, float k){
  float sl = sqrt(uCam.z * uFit);
  return (frag - uRes * .5) / sl + uCam.xy * (uCam.z / sl) * k;
}

void main(){
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = uCam.xy + (frag - uRes * .5) / uCam.z;
  vec2 sv = frag / uRes;
  float t = uTime;

  // ---- the night sea
  vec3 col = mix(vec3(.022, .03, .058), vec3(.012, .016, .034), sv.y);
  vec2 L = layer(frag, .72);
  float fog = fbm(L * .0042 + vec2(t * .006, -t * .004));
  float fog2 = fbm(L * .011 - vec2(t * .01, t * .006));

  // ---- islands: nearest one, glow from all
  float dMin = 1e9; int iMin = -1;
  vec3 glow = vec3(0.);
  vec3 near = vec3(.3, .4, .6);
  float wsum = 0.;
  for (int i = 0; i < ${MAX_ISL}; i++) {
    if (i >= uN) break;
    vec4 I = uIsl[i];
    float d = shape(p - I.xy, I);
    float g = exp(-max(d, 0.) / (I.z * (.32 + .22 * uCol[i].a)));
    glow += uCol[i].rgb * g * (.55 + .8 * uCol[i].a);
    float w = exp(-max(d, 0.) / (I.z * .9));
    near += uCol[i].rgb * w; wsum += w;
    if (d < dMin) { dMin = d; iMin = i; }
  }
  near /= (1. + wsum);

  // fog between the islands takes their light
  col += near * (fog * fog * .55 + fog2 * .08);
  col += glow * .16;

  if (iMin >= 0) {
    vec4 I = uIsl[iMin];
    vec3 tint = uCol[iMin].rgb;
    float em = uCol[iMin].a;
    float r = I.z;
    vec2 q = p - I.xy;
    float dpx = dMin * uCam.z;
    float px = uDpr;

    // the island floats: a soft shadow below it, shifted by where you look from
    vec2 view = (uCam.xy - I.xy) / r;
    vec2 off = vec2(0., r * .07) - view * r * .03;
    float ds = shape(q - off, I);
    float sh = smoothstep(r * .22, -r * .06, ds);
    col *= 1. - .62 * sh * step(0., dMin);

    // the surf: faint rings running outward from the shore
    if (dMin > 0.) {
      float wz = dMin / (r * .045);
      float surf = pow(.5 + .5 * sin(wz * 6.2832 - t * 1.1), 6.) * exp(-dMin / (r * .16));
      col += tint * surf * .16 * (1. - .6 * uDeep);
    }

    // the land
    float inside = 1. - smoothstep(-px * .8, px * .8, dpx);
    if (inside > 0.) {
      vec3 land;
      vec4 R = uUv[iMin];
      vec2 lp = q / (r * 1.18) + view * .035;
      vec2 uv = R.xy + (lp * .5 + .5) * R.zw;
      vec3 tex = R.z > 0. ? texture(uAtlas, uv).rgb : tint * .5;
      if (uStyle == 2) {
        float dd = dMin + (fbm(q / r * 2.4 + I.w) - .5) * r * .32;
        float v = dd / (r * .07);
        float fw = fwidth(v);
        float line = 1. - smoothstep(0., fw * 1.4, abs(fract(v + .5) - .5));
        float major = 1. - smoothstep(0., fw * 1.6, abs(fract(v / 4. + .5) - .5) * 4.);
        float h = clamp(-dMin / r, 0., 1.);
        land = tint * (.1 + .22 * h) + tex * .08;
        land += tint * (line * .32 + major * .5) * (1. - .75 * uDeep);
      } else if (uStyle == 1) {
        land = tex * (.62 - .3 * uDeep) + tint * .12;
      } else {
        land = tex * (.82 - .42 * uDeep) + tint * .1;
      }
      // relief: a soft hillshade so the surface reads as land, fading as you dive in
      if (uStyle != 2) {
        vec2 hq = q / r * 1.5 + I.w * 3.;
        float h0 = fbm(hq);
        float h1 = fbm(hq + vec2(.07, .055));
        land *= 1. + clamp((h0 - h1) * 1.6, -.12, .12) * (1. - .9 * uDeep);
      }
      // light from the upper left on the rim, a shade on the far side
      vec2 n = q / max(length(q), 1e-3);
      float lit = dot(n, normalize(vec2(-.55, -.83)));
      float rim = smoothstep(-r * .16, 0., dMin);
      land += tint * rim * max(lit, 0.) * .5;
      land *= 1. - rim * max(-lit, 0.) * .45;
      // the middle sinks a little so the posters sit in a basin
      land *= mix(1., .72, (1. - smoothstep(-r * .7, -r * .1, dMin)) * uDeep);
      land *= .88 + .3 * em;
      col = mix(col, land, inside);
    }

    // the shoreline: a thin bright line, a softer halo on both sides
    float core = exp(-abs(dpx) / (1.1 * px));
    float halo = exp(-abs(dpx) / (9. * px + r * uCam.z * .012));
    vec3 shore = mix(tint, vec3(1.), .55);
    col += shore * core * (.75 + .5 * em) + tint * halo * (.32 + .35 * em);
  }

  // ---- the high haze, in front, drifting faster than the islands; it clears as you dive in
  vec2 Hh = layer(frag, 1.28);
  float haze = fbm(Hh * .0028 + vec2(-t * .009, t * .005));
  haze = smoothstep(.45, .85, haze);
  col = mix(col, vec3(.55, .62, .78) * .5 + near * .35, haze * .2 * (1. - uDeep));

  // ---- vignette, grain
  vec2 c = sv - .5;
  col *= 1. - .55 * dot(c, c) * 1.6;
  col += (hash(frag + fract(t) * 91.7) - .5) * .018;
  col = col / (1. + col * .18);
  o = vec4(pow(max(col, 0.), vec3(.94)), 1.);
}`

export type SeaIsland = {
	x: number
	y: number
	r: number
	seed: number
	/** Tint, 0..1 rgb. */
	c: [number, number, number]
	/** Emphasis 0..1: the island in the middle glows a little more. */
	e: number
	/** Atlas rect in 0..1, or null for tint only. */
	uv: [number, number, number, number] | null
}

export type Sea = ReturnType<typeof makeSea>

export function makeSea(canvas: HTMLCanvasElement, atlas: HTMLCanvasElement) {
	const gl = canvas.getContext("webgl2", {
		antialias: false,
		alpha: false,
		premultipliedAlpha: false,
		powerPreference: "high-performance",
	})
	if (!gl) return null
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
		gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS))
		gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS))
		gl.linkProgram(prog)
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link")
	} catch (e) {
		console.warn("sea6: WebGL unavailable, drawing flat islands.", e)
		return null
	}
	gl.useProgram(prog)
	const buf = gl.createBuffer()
	gl.bindBuffer(gl.ARRAY_BUFFER, buf)
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
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
		style: U("uStyle"),
		n: U("uN"),
		isl: U("uIsl"),
		col: U("uCol"),
		uv: U("uUv"),
		atlas: U("uAtlas"),
	}
	const tex = gl.createTexture()
	gl.activeTexture(gl.TEXTURE0)
	gl.bindTexture(gl.TEXTURE_2D, tex)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
	gl.generateMipmap(gl.TEXTURE_2D)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
	gl.uniform1i(u.atlas, 0)

	const I = new Float32Array(MAX_ISL * 4)
	const C = new Float32Array(MAX_ISL * 4)
	const V = new Float32Array(MAX_ISL * 4)
	let lost = false
	canvas.addEventListener("webglcontextlost", (e) => {
		e.preventDefault()
		lost = true
	})

	return {
		/** Upload one island's surface tile into its atlas slot. */
		tile(src: HTMLCanvasElement, x: number, y: number) {
			if (lost) return
			gl.bindTexture(gl.TEXTURE_2D, tex)
			gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, gl.RGBA, gl.UNSIGNED_BYTE, src)
			gl.generateMipmap(gl.TEXTURE_2D)
		},
		draw(o: {
			w: number
			h: number
			dpr: number
			cam: { x: number; y: number; s: number }
			fit: number
			time: number
			deep: number
			style: SurfaceStyle
			islands: SeaIsland[]
		}) {
			if (lost) return
			const W = Math.round(o.w * o.dpr)
			const H = Math.round(o.h * o.dpr)
			if (canvas.width !== W || canvas.height !== H) {
				canvas.width = W
				canvas.height = H
			}
			gl.viewport(0, 0, W, H)
			const n = Math.min(MAX_ISL, o.islands.length)
			for (let i = 0; i < n; i++) {
				const s = o.islands[i]
				I.set([s.x, s.y, s.r, s.seed], i * 4)
				C.set([s.c[0], s.c[1], s.c[2], s.e], i * 4)
				V.set(s.uv ?? [0, 0, -1, -1], i * 4)
			}
			gl.uniform2f(u.res, W, H)
			gl.uniform3f(u.cam, o.cam.x, o.cam.y, o.cam.s * o.dpr)
			gl.uniform1f(u.fit, o.fit * o.dpr)
			gl.uniform1f(u.dpr, o.dpr)
			gl.uniform1f(u.time, o.time)
			gl.uniform1f(u.deep, o.deep)
			gl.uniform1i(u.style, STYLE[o.style])
			gl.uniform1i(u.n, n)
			gl.uniform4fv(u.isl, I)
			gl.uniform4fv(u.col, C)
			gl.uniform4fv(u.uv, V)
			gl.drawArrays(gl.TRIANGLES, 0, 3)
		},
		destroy() {
			lost = true
			// The canvas may be reused by the next mount (React re-runs effects in development), so the context stays.
			gl.deleteTexture(tex)
			gl.deleteBuffer(buf)
			gl.deleteProgram(prog)
		},
	}
}
