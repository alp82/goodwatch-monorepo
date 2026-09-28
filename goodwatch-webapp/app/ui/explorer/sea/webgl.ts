import {
	AdapterUnavailable,
	type SeaAdapter,
	type SeaFrame,
	WEBGL_PIXEL_RATIO_CAP,
	fitBackingStore,
} from "./adapter"
import {
	RESERVED_UNIFORM_VECTORS,
	VERTEX_SHADER_100,
	VERTEX_SHADER_300,
	fragmentShader100,
	fragmentShader300,
} from "./shaders"
import { ATLAS_TILE_LIMIT, ISLAND_LIMIT, TILE_SIZE } from "./types"

const ATLAS_COLUMNS = Math.sqrt(ATLAS_TILE_LIMIT)
const ATLAS_SIZE = TILE_SIZE * ATLAS_COLUMNS
/** The tile edge the shader skips, so mipmaps don't bleed between neighboring tiles. */
const TILE_INSET = 8 / ATLAS_SIZE

const slotOrigin = (slot: number) => ({
	x: (slot % ATLAS_COLUMNS) * TILE_SIZE,
	y: Math.floor(slot / ATLAS_COLUMNS) * TILE_SIZE,
})

type GL = WebGLRenderingContext | WebGL2RenderingContext

interface Program {
	program: WebGLProgram
	buffer: WebGLBuffer | null
	atlas: WebGLTexture | null
	uniforms: Record<
		| "res"
		| "cam"
		| "fit"
		| "dpr"
		| "time"
		| "deep"
		| "n"
		| "isl"
		| "col"
		| "uv"
		| "spot"
		| "atlas",
		WebGLUniformLocation | null
	>
}

export interface ContextEvents {
	onLost: () => void
	/** The context came back and the program and atlas were rebuilt; tiles must be uploaded again. */
	onRestored: () => void
	/** The context came back but the rebuild failed. */
	onRestoreFailed: () => void
}

/**
 * The sea in WebGL2 or WebGL1. Throws `AdapterUnavailable` when the context can't be created, the shader doesn't
 * compile or link, or the device can't hold the atlas.
 */
export function createWebglAdapter(
	canvas: HTMLCanvasElement,
	level: 1 | 2,
	events: ContextEvents,
): SeaAdapter {
	const options: WebGLContextAttributes = {
		antialias: false,
		alpha: false,
		premultipliedAlpha: false,
		powerPreference: "high-performance",
	}
	const gl = (
		level === 2
			? canvas.getContext("webgl2", options)
			: canvas.getContext("webgl", options)
	) as GL | null
	if (!gl || gl.isContextLost())
		throw new AdapterUnavailable(`No WebGL${level} context`)

	let islandCapacity = ISLAND_LIMIT
	let fragmentSource: string
	if (level === 1) {
		// Three vectors per island must fit the fragment uniform budget next to the shader's other uniforms.
		const budget = gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) as number
		islandCapacity = Math.min(
			ISLAND_LIMIT,
			Math.floor((budget - RESERVED_UNIFORM_VECTORS) / 3),
		)
		if (islandCapacity < 1)
			throw new AdapterUnavailable("WebGL1 uniform budget too small")
		const highp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
		fragmentSource = fragmentShader100(
			islandCapacity,
			!!highp && highp.precision > 0,
		)
	} else fragmentSource = fragmentShader300(islandCapacity)
	if ((gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) < ATLAS_SIZE)
		throw new AdapterUnavailable("Textures too small for the atlas")

	const build = (): Program => {
		const compile = (type: number, source: string) => {
			const shader = gl.createShader(type)
			if (!shader) throw new AdapterUnavailable("Could not create a shader")
			gl.shaderSource(shader, source)
			gl.compileShader(shader)
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
				throw new AdapterUnavailable(
					`WebGL${level} shader: ${gl.getShaderInfoLog(shader) ?? "compile failed"}`,
				)
			return shader
		}
		const program = gl.createProgram()
		if (!program) throw new AdapterUnavailable("Could not create a program")
		const vertex = compile(
			gl.VERTEX_SHADER,
			level === 2 ? VERTEX_SHADER_300 : VERTEX_SHADER_100,
		)
		const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
		gl.attachShader(program, vertex)
		gl.attachShader(program, fragment)
		gl.linkProgram(program)
		gl.deleteShader(vertex)
		gl.deleteShader(fragment)
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new AdapterUnavailable(
				`WebGL${level} program: ${gl.getProgramInfoLog(program) ?? "link failed"}`,
			)
		gl.useProgram(program)

		// One triangle covering the screen.
		const buffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 3, -1, -1, 3]),
			gl.STATIC_DRAW,
		)
		const position = gl.getAttribLocation(program, "a")
		gl.enableVertexAttribArray(position)
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

		// The atlas is a power of two, so mipmaps work in WebGL1 too.
		const atlas = gl.createTexture()
		gl.activeTexture(gl.TEXTURE0)
		gl.bindTexture(gl.TEXTURE_2D, atlas)
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA,
			ATLAS_SIZE,
			ATLAS_SIZE,
			0,
			gl.RGBA,
			gl.UNSIGNED_BYTE,
			null,
		)
		gl.texParameteri(
			gl.TEXTURE_2D,
			gl.TEXTURE_MIN_FILTER,
			gl.LINEAR_MIPMAP_LINEAR,
		)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
		gl.generateMipmap(gl.TEXTURE_2D)

		const at = (name: string) => gl.getUniformLocation(program, name)
		const uniforms = {
			res: at("uRes"),
			cam: at("uCam"),
			fit: at("uFit"),
			dpr: at("uDpr"),
			time: at("uTime"),
			deep: at("uDeep"),
			n: at("uN"),
			isl: at("uIsl"),
			col: at("uCol"),
			uv: at("uUv"),
			spot: at("uSpot"),
			atlas: at("uAtlas"),
		}
		gl.uniform1i(uniforms.atlas, 0)
		return { program, buffer, atlas, uniforms }
	}

	let state: Program | null = build()
	let lost = false

	const onLost = (event: Event) => {
		// Without preventDefault the browser never restores the context.
		event.preventDefault()
		lost = true
		state = null
		events.onLost()
	}
	const onRestored = () => {
		lost = false
		try {
			state = build()
		} catch {
			state = null
			events.onRestoreFailed()
			return
		}
		events.onRestored()
	}
	canvas.addEventListener("webglcontextlost", onLost)
	canvas.addEventListener("webglcontextrestored", onRestored)

	const islands = new Float32Array(islandCapacity * 4)
	const colors = new Float32Array(islandCapacity * 4)
	const uvs = new Float32Array(islandCapacity * 4)

	return {
		kind: level === 2 ? "webgl2" : "webgl1",
		animated: true,
		islandCapacity,
		uploadTile(slot, tile) {
			if (!state || lost) return
			const origin = slotOrigin(slot)
			gl.bindTexture(gl.TEXTURE_2D, state.atlas)
			gl.texSubImage2D(
				gl.TEXTURE_2D,
				0,
				origin.x,
				origin.y,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				tile,
			)
			gl.generateMipmap(gl.TEXTURE_2D)
		},
		render(frame: SeaFrame) {
			if (!state || lost) return
			const { camera, spotlight } = frame
			const ratio = fitBackingStore(canvas, camera, WEBGL_PIXEL_RATIO_CAP)
			gl.viewport(0, 0, canvas.width, canvas.height)
			const count = Math.min(islandCapacity, frame.islands.length)
			for (let i = 0; i < count; i++) {
				const island = frame.islands[i]
				const k = i * 4
				islands[k] = island.x
				islands[k + 1] = island.y
				islands[k + 2] = island.radius
				islands[k + 3] = island.seed
				colors[k] = island.color[0]
				colors[k + 1] = island.color[1]
				colors[k + 2] = island.color[2]
				colors[k + 3] = island.emphasis
				// The tile's rect is square, so its fourth component carries the saturation.
				const slot = frame.slots[i]
				if (slot >= 0) {
					const origin = slotOrigin(slot)
					uvs[k] = origin.x / ATLAS_SIZE + TILE_INSET
					uvs[k + 1] = origin.y / ATLAS_SIZE + TILE_INSET
					uvs[k + 2] = TILE_SIZE / ATLAS_SIZE - 2 * TILE_INSET
				} else {
					uvs[k] = 0
					uvs[k + 1] = 0
					uvs[k + 2] = -1
				}
				uvs[k + 3] = island.saturation
			}
			const u = state.uniforms
			gl.uniform2f(u.res, canvas.width, canvas.height)
			gl.uniform3f(u.cam, camera.x, camera.y, camera.scale * ratio)
			gl.uniform1f(u.fit, camera.overviewScale * ratio)
			gl.uniform1f(u.dpr, ratio)
			gl.uniform1f(u.time, frame.time)
			gl.uniform1f(u.deep, camera.depth)
			gl.uniform1i(u.n, count)
			gl.uniform4fv(u.isl, islands)
			gl.uniform4fv(u.col, colors)
			gl.uniform4fv(u.uv, uvs)
			gl.uniform4f(
				u.spot,
				spotlight?.x ?? 0,
				spotlight?.y ?? 0,
				spotlight?.radius ?? 1,
				spotlight?.strength ?? 0,
			)
			gl.drawArrays(gl.TRIANGLES, 0, 3)
		},
		dispose() {
			canvas.removeEventListener("webglcontextlost", onLost)
			canvas.removeEventListener("webglcontextrestored", onRestored)
			if (state && !lost) {
				gl.deleteTexture(state.atlas)
				gl.deleteBuffer(state.buffer)
				gl.deleteProgram(state.program)
			}
			state = null
		},
	}
}
