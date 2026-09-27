import type { GroupId } from "~/ui/prototype-rec-explorer-4/wire4"
// PROTOTYPE - throwaway. What each island looks like zoomed out (#180, round 5): its identity, drawn on the map's
// canvas. Genres and moods get an icon (a heroicon or an emoji, per variant), streaming services their real logo
// (TMDB's logo from the streaming_service table), countries a flag drawn in code (flag emoji don't render on
// Windows), decades their era's typography, taste distance a direction icon. Every emblem is drawn once into an
// offscreen canvas and then only scaled, so the map stays at 60 fps however detailed the emblem is.
import type { Service } from "~/ui/prototype-rec-taste/model"
import { GLYPHS } from "./glyphs"

export type Era = {
	text: string
	font: string
	weight: number
	italic?: boolean
	color: string
	glow?: string
	track?: number
}
export type Ident =
	| { kind: "icon"; glyph: string; emoji: string }
	| { kind: "logo"; src: string; name: string }
	| { kind: "flag"; flag: string }
	| { kind: "era"; era: Era }

const GENRE: Record<string, [string, string]> = {
	animation: ["PaintBrush", "🎨"],
	docs: ["VideoCamera", "🎥"],
	horror: ["Moon", "🩸"],
	scifi: ["RocketLaunch", "🚀"],
	fantasy: ["Sparkles", "🐉"],
	war: ["ShieldExclamation", "⚔️"],
	crime: ["FingerPrint", "🚨"],
	thriller: ["Eye", "🔍"],
	romance: ["Heart", "🌹"],
	family: ["Home", "🏡"],
	action: ["Bolt", "💥"],
	comedy: ["FaceSmile", "😂"],
	drama: ["FaceFrown", "🎭"],
}
const MOOD: Record<string, [string, string]> = {
	warm: ["Sun", "☀️"],
	funny: ["FaceSmile", "😂"],
	romantic: ["Heart", "🌹"],
	wonder: ["Sparkles", "✨"],
	moving: ["Cloud", "🌧️"],
	mind: ["CubeTransparent", "🌀"],
	tense: ["Clock", "⏱️"],
	dark: ["Moon", "🌑"],
	scary: ["Fire", "👻"],
}
const TASTE: Record<string, [string, string]> = {
	near: ["Star", "🎯"],
	close: ["MapPin", "🧭"],
	edges: ["Map", "🗺️"],
	far: ["GlobeAlt", "🌌"],
}
const ERAS: Record<string, Era> = {
	old: {
		text: "Pre ’70",
		font: "Limelight",
		weight: 400,
		color: "#f3dfb0",
		track: 0.02,
	},
	"1970": {
		text: "70s",
		font: "Shrikhand",
		weight: 400,
		italic: true,
		color: "#ffb347",
	},
	"1980": {
		text: "80s",
		font: "Monoton",
		weight: 400,
		color: "#ff5fb7",
		glow: "#ff2fa0",
	},
	"1990": {
		text: "90s",
		font: "Permanent Marker",
		weight: 400,
		color: "#e8e3d3",
	},
	"2000": {
		text: "2000s",
		font: "Orbitron",
		weight: 900,
		color: "#b9d6ff",
		glow: "#4f86d9",
	},
	"2010": {
		text: "2010s",
		font: "Josefin Sans",
		weight: 300,
		color: "#bff5ea",
		track: 0.04,
	},
	"2020": {
		text: "2020s",
		font: "Space Grotesk",
		weight: 700,
		color: "#d6ff8a",
	},
}
/** Google Fonts for the decades' typography; the route links them. */
export const ERA_FONTS =
	"https://fonts.googleapis.com/css2?family=Limelight&family=Shrikhand&family=Monoton&family=Permanent+Marker&family=Orbitron:wght@900&family=Josefin+Sans:wght@300&family=Space+Grotesk:wght@700&display=swap"
export const loadEraFonts = () =>
	Promise.all(
		Object.values(ERAS).map((e) =>
			document.fonts
				?.load(`${e.italic ? "italic " : ""}${e.weight} 40px '${e.font}'`)
				.catch(() => []),
		),
	)

const FLAG: Record<string, string> = {
	us: "us",
	gb: "gb",
	fr: "fr",
	es: "es",
	it: "it",
	de: "de",
	nordic: "nordic",
	ja: "ja",
	ko: "ko",
	zh: "zh",
	in: "in",
}

export function identOf(
	group: GroupId,
	id: string,
	services: Service[],
): Ident {
	if (group === "genre" && GENRE[id])
		return { kind: "icon", glyph: GENRE[id][0], emoji: GENRE[id][1] }
	if (group === "mood" && MOOD[id])
		return { kind: "icon", glyph: MOOD[id][0], emoji: MOOD[id][1] }
	if (group === "taste" && TASTE[id])
		return { kind: "icon", glyph: TASTE[id][0], emoji: TASTE[id][1] }
	if (group === "decade" && ERAS[id]) return { kind: "era", era: ERAS[id] }
	if (group === "country") {
		if (FLAG[id]) return { kind: "flag", flag: FLAG[id] }
		return id === "en"
			? { kind: "icon", glyph: "Language", emoji: "🌐" }
			: { kind: "icon", glyph: "GlobeEuropeAfrica", emoji: "🌍" }
	}
	if (group === "service") {
		const s = services.find((x) => String(x.id) === id)
		const path = s?.logo.split("/original")[1]
		if (s && path)
			return {
				kind: "logo",
				src: `https://image.tmdb.org/t/p/w154${path}`,
				name: s.name,
			}
		return { kind: "icon", glyph: "Ticket", emoji: "🎟️" }
	}
	return { kind: "icon", glyph: "Film", emoji: "🎬" }
}

// ---------------------------------------------------------------- primitives

type C2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
const glyphPaths = new Map<string, { p: Path2D; evenodd: boolean }[]>()
export function drawGlyph(
	g: C2,
	name: string,
	cx: number,
	cy: number,
	size: number,
	fill: string,
) {
	let ps = glyphPaths.get(name)
	if (!ps) {
		ps = (GLYPHS[name] ?? GLYPHS.Film).map((x) => ({
			p: new Path2D(x.d),
			evenodd: x.evenodd,
		}))
		glyphPaths.set(name, ps)
	}
	g.save()
	g.translate(cx - size / 2, cy - size / 2)
	g.scale(size / 24, size / 24)
	g.fillStyle = fill
	for (const x of ps) g.fill(x.p, x.evenodd ? "evenodd" : "nonzero")
	g.restore()
}

export const EMOJI_FONT =
	"'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Twemoji',sans-serif"
export function drawEmoji(
	g: C2,
	ch: string,
	cx: number,
	cy: number,
	size: number,
) {
	g.font = `${size}px ${EMOJI_FONT}`
	g.textAlign = "center"
	g.textBaseline = "middle"
	g.fillStyle = "#fff"
	g.fillText(ch, cx, cy + size * 0.06)
}

function star(g: C2, cx: number, cy: number, r: number, rot = -Math.PI / 2) {
	g.beginPath()
	for (let k = 0; k < 10; k++) {
		const a = rot + (k * Math.PI) / 5
		const rr = k % 2 ? r * 0.4 : r
		g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
	}
	g.closePath()
	g.fill()
}
const stripes = (
	g: C2,
	x: number,
	y: number,
	w: number,
	h: number,
	cols: string[],
	vertical: boolean,
	weights?: number[],
) => {
	const ws = weights ?? cols.map(() => 1)
	const tot = ws.reduce((a, b) => a + b, 0)
	let o = 0
	cols.forEach((c, k) => {
		g.fillStyle = c
		const part = ws[k] / tot
		if (vertical) g.fillRect(x + o * w, y, w * part + 0.5, h)
		else g.fillRect(x, y + o * h, w, h * part + 0.5)
		o += part
	})
}
function cross(
	g: C2,
	x: number,
	y: number,
	w: number,
	h: number,
	bg: string,
	out: string,
	inner?: string,
) {
	g.fillStyle = bg
	g.fillRect(x, y, w, h)
	const cx = x + w * 0.36
	g.fillStyle = out
	g.fillRect(cx - h * 0.12, y, h * 0.24, h)
	g.fillRect(x, y + h * 0.38, w, h * 0.24)
	if (inner) {
		g.fillStyle = inner
		g.fillRect(cx - h * 0.06, y, h * 0.12, h)
		g.fillRect(x, y + h * 0.44, w, h * 0.12)
	}
}

/** A flag inside the rect (3:2 is best). */
export function drawFlag(
	g: C2,
	id: string,
	x: number,
	y: number,
	w: number,
	h: number,
) {
	g.save()
	g.beginPath()
	g.rect(x, y, w, h)
	g.clip()
	if (id === "fr")
		stripes(g, x, y, w, h, ["#1f3f95", "#f4f4f4", "#e1343f"], true)
	else if (id === "it")
		stripes(g, x, y, w, h, ["#1d9a54", "#f4f4f4", "#d7303b"], true)
	else if (id === "de")
		stripes(g, x, y, w, h, ["#161616", "#d6202a", "#f5c518"], false)
	else if (id === "es")
		stripes(g, x, y, w, h, ["#c8102e", "#f6c700", "#c8102e"], false, [1, 2, 1])
	else if (id === "in") {
		stripes(g, x, y, w, h, ["#f39a2b", "#f4f4f4", "#1a8a3a"], false)
		g.strokeStyle = "#1f2f8a"
		g.lineWidth = h * 0.035
		g.beginPath()
		g.arc(x + w / 2, y + h / 2, h * 0.13, 0, Math.PI * 2)
		g.stroke()
		for (let k = 0; k < 12; k++) {
			const a = (k * Math.PI) / 6
			g.beginPath()
			g.moveTo(x + w / 2, y + h / 2)
			g.lineTo(
				x + w / 2 + Math.cos(a) * h * 0.13,
				y + h / 2 + Math.sin(a) * h * 0.13,
			)
			g.lineWidth = h * 0.012
			g.stroke()
		}
	} else if (id === "ja") {
		g.fillStyle = "#f4f4f4"
		g.fillRect(x, y, w, h)
		g.fillStyle = "#c8102e"
		g.beginPath()
		g.arc(x + w / 2, y + h / 2, h * 0.3, 0, Math.PI * 2)
		g.fill()
	} else if (id === "ko") {
		g.fillStyle = "#f4f4f4"
		g.fillRect(x, y, w, h)
		const cx = x + w / 2
		const cy = y + h / 2
		const r = h * 0.25
		g.save()
		g.translate(cx, cy)
		g.rotate(Math.atan2(2, 3))
		g.fillStyle = "#cd2e3a"
		g.beginPath()
		g.arc(0, 0, r, Math.PI, 0)
		g.fill()
		g.fillStyle = "#0047a0"
		g.beginPath()
		g.arc(0, 0, r, 0, Math.PI)
		g.fill()
		g.fillStyle = "#cd2e3a"
		g.beginPath()
		g.arc(-r / 2, 0, r / 2, 0, Math.PI * 2)
		g.fill()
		g.fillStyle = "#0047a0"
		g.beginPath()
		g.arc(r / 2, 0, r / 2, 0, Math.PI * 2)
		g.fill()
		g.restore()
		// The four trigrams, as plain bars.
		g.fillStyle = "#161616"
		for (const [sx, sy] of [
			[-1, -1],
			[1, 1],
			[1, -1],
			[-1, 1],
		]) {
			g.save()
			g.translate(cx + sx * w * 0.3, cy + sy * h * 0.3)
			g.rotate(Math.atan2(sy * 2, sx * 3) + Math.PI / 2)
			for (let k = -1; k <= 1; k++)
				g.fillRect(-h * 0.09, k * h * 0.045 - h * 0.015, h * 0.18, h * 0.03)
			g.restore()
		}
	} else if (id === "zh") {
		g.fillStyle = "#de2910"
		g.fillRect(x, y, w, h)
		g.fillStyle = "#ffde00"
		star(g, x + w * 0.17, y + h * 0.27, h * 0.15)
		for (const [a, b] of [
			[0.33, 0.1],
			[0.4, 0.2],
			[0.4, 0.35],
			[0.33, 0.45],
		])
			star(g, x + w * a, y + h * b, h * 0.05)
	} else if (id === "us") {
		for (let k = 0; k < 13; k++) {
			g.fillStyle = k % 2 ? "#f4f4f4" : "#b22234"
			g.fillRect(x, y + (k * h) / 13, w, h / 13 + 0.5)
		}
		g.fillStyle = "#3c3b6e"
		g.fillRect(x, y, w * 0.4, (h * 7) / 13)
		g.fillStyle = "#f4f4f4"
		for (let r = 0; r < 5; r++)
			for (let c = 0; c < 6; c++) {
				g.beginPath()
				g.arc(
					x + w * 0.4 * ((c + 0.5 + (r % 2) * 0.25) / 6.3),
					y + ((h * 7) / 13) * ((r + 0.6) / 5.2),
					h * 0.018,
					0,
					Math.PI * 2,
				)
				g.fill()
			}
	} else if (id === "gb") {
		g.fillStyle = "#012169"
		g.fillRect(x, y, w, h)
		g.lineCap = "butt"
		g.strokeStyle = "#f4f4f4"
		g.lineWidth = h * 0.2
		g.beginPath()
		g.moveTo(x, y)
		g.lineTo(x + w, y + h)
		g.moveTo(x + w, y)
		g.lineTo(x, y + h)
		g.stroke()
		g.strokeStyle = "#c8102e"
		g.lineWidth = h * 0.07
		g.stroke()
		g.fillStyle = "#f4f4f4"
		g.fillRect(x + w / 2 - h * 0.17, y, h * 0.34, h)
		g.fillRect(x, y + h / 2 - h * 0.17, w, h * 0.34)
		g.fillStyle = "#c8102e"
		g.fillRect(x + w / 2 - h * 0.1, y, h * 0.2, h)
		g.fillRect(x, y + h / 2 - h * 0.1, w, h * 0.2)
	} else if (id === "nordic") {
		// Denmark, Sweden, Norway, Finland.
		const hw = w / 2
		const hh = h / 2
		cross(g, x, y, hw, hh, "#c8102e", "#f4f4f4")
		cross(g, x + hw, y, hw, hh, "#006aa7", "#fecc00")
		cross(g, x, y + hh, hw, hh, "#ba0c2f", "#f4f4f4", "#00205b")
		cross(g, x + hw, y + hh, hw, hh, "#f4f4f4", "#002f6c")
		g.fillStyle = "rgba(0,0,0,.35)"
		g.fillRect(x + hw - 0.75, y, 1.5, h)
		g.fillRect(x, y + hh - 0.75, w, 1.5)
	}
	g.restore()
}

export function drawEra(
	g: C2,
	e: Era,
	cx: number,
	cy: number,
	size: number,
	maxW: number,
) {
	let fs = size
	const font = () =>
		`${e.italic ? "italic " : ""}${e.weight} ${fs}px '${e.font}', 'Big Shoulders Display', system-ui, sans-serif`
	g.font = font()
	const tw = g.measureText(e.text).width * (1 + (e.track ?? 0))
	if (tw > maxW) {
		fs = (fs * maxW) / tw
		g.font = font()
	}
	g.textAlign = "center"
	g.textBaseline = "middle"
	if (e.glow) {
		g.shadowColor = e.glow
		g.shadowBlur = fs * 0.35
	}
	g.fillStyle = e.color
	g.fillText(e.text, cx, cy)
	g.shadowBlur = 0
}

// ---------------------------------------------------------------- logos

type LogoImg = { im: HTMLImageElement; ok: boolean }
const LOGOS = new Map<string, LogoImg>()
let logoWake: (() => void) | null = null
export const onLogo = (fn: (() => void) | null) => {
	logoWake = fn
}
function logo(src: string) {
	let e = LOGOS.get(src)
	if (!e) {
		const im = new Image()
		e = { im, ok: false }
		const ent = e
		im.src = src
		im.decode()
			.then(() => {
				ent.ok = true
				logoWake?.()
			})
			.catch(() => {})
		LOGOS.set(src, e)
	}
	return e
}
export const logoReady = (src: string) => logo(src).ok
export function drawLogo(
	g: C2,
	src: string,
	x: number,
	y: number,
	s: number,
	radius: number,
) {
	const e = logo(src)
	g.save()
	g.beginPath()
	g.roundRect(x, y, s, s, radius)
	g.clip()
	g.fillStyle = "#1c1917"
	g.fillRect(x, y, s, s)
	if (e.ok) g.drawImage(e.im, x, y, s, s)
	g.restore()
}

// ---------------------------------------------------------------- emblem cache

/**
 * An emblem drawn once at a fixed resolution (w x h). The cache is keyed by the caller (variant, grouping, region)
 * and redrawn once `ready` turns true (fonts or logos arrived).
 */
type Emb = HTMLCanvasElement | OffscreenCanvas
const EMBLEMS = new Map<string, { c: Emb; ready: boolean }>()
export function emblem(
	key: string,
	w: number,
	h: number,
	ready: boolean,
	render: (g: C2, w: number, h: number) => void,
) {
	const hit = EMBLEMS.get(key)
	if (hit && (hit.ready || !ready)) return hit.c
	const c: Emb =
		typeof OffscreenCanvas !== "undefined"
			? new OffscreenCanvas(w, h)
			: Object.assign(document.createElement("canvas"), { width: w, height: h })
	const g = c.getContext("2d") as C2
	render(g, w, h)
	EMBLEMS.set(key, { c, ready })
	if (EMBLEMS.size > 400) EMBLEMS.delete(EMBLEMS.keys().next().value as string)
	return c
}
export const clearEmblems = () => EMBLEMS.clear()
