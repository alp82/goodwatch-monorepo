// PROTOTYPE - throwaway. Painting an island's identity on the round-5 map (#180), per identity style. Everything
// here draws in screen pixels: `under` paints below the posters (the island's ground), `over` paints the name and
// emblem above them. p1 is how far the island's first posters have faded in (0 at the overview, 1 once they show):
// the emblem is big while the island is a place on the map and shrinks into a header once its posters arrive.
import type { Config } from "./config"
import {
	type Era,
	type Ident,
	drawEmoji,
	drawEra,
	drawFlag,
	drawGlyph,
	drawLogo,
	emblem,
	logoReady,
} from "./identity"

export type Look = {
	id: string
	name: string
	count: number
	fit: number
	color: string
	fill: string
	ident: Ident
	/** A stable key for the emblem cache: grouping and region. */
	key: string
}

const FONT = "'Big Shoulders Display','Gabarito',system-ui,sans-serif"
const BODY = "'Noto Sans','Gabarito',system-ui,sans-serif"
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const ease = (t: number) =>
	t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
const hex = (c: string) =>
	[1, 3, 5].map((k) => Number.parseInt(c.slice(k, k + 2), 16))
export const mix = (a: string, b: string, t: number) => {
	const A = hex(a)
	const B = hex(b)
	return `rgb(${A.map((v, k) => Math.round(v + (B[k] - v) * t)).join(",")})`
}
export const rgba = (c: string, a: number) => `rgba(${hex(c).join(",")},${a})`

let fontsReady = false
export const setFontsReady = () => {
	fontsReady = true
}

// ---------------------------------------------------------------- cached emblems

type Emb = HTMLCanvasElement | OffscreenCanvas
function iconCanvas(
	ident: Extract<Ident, { kind: "icon" }>,
	icons: Config["icons"],
	color: string,
): Emb {
	const S = 192
	return emblem(`icon|${icons}|${ident.glyph}|${color}`, S, S, true, (g) => {
		if (icons === "emoji") drawEmoji(g, ident.emoji, S / 2, S / 2, S * 0.78)
		else
			drawGlyph(
				g,
				ident.glyph,
				S / 2,
				S / 2,
				S * 0.9,
				mix(color, "#ffffff", 0.35),
			)
	})
}
function flagCanvas(flag: string): Emb {
	return emblem(`flag|${flag}`, 360, 240, true, (g) =>
		drawFlag(g, flag, 0, 0, 360, 240),
	)
}
function logoCanvas(src: string): Emb {
	const S = 192
	return emblem(`logo|${src}`, S, S, logoReady(src), (g) =>
		drawLogo(g, src, 0, 0, S, S * 0.22),
	)
}
function eraCanvas(era: Era): Emb {
	return emblem(`era|${era.text}`, 640, 260, fontsReady, (g) =>
		drawEra(g, era, 320, 130, 190, 600),
	)
}

/** The emblem itself (no frame) fitted into a box of side `s` centered at (x, y). */
function drawIdent(
	g: CanvasRenderingContext2D,
	look: Look,
	cfg: Config,
	x: number,
	y: number,
	s: number,
	a = 1,
) {
	const id = look.ident
	g.globalAlpha = a
	if (id.kind === "icon")
		g.drawImage(
			iconCanvas(id, cfg.icons, look.color),
			x - s / 2,
			y - s / 2,
			s,
			s,
		)
	else if (id.kind === "logo")
		g.drawImage(logoCanvas(id.src), x - s / 2, y - s / 2, s, s)
	else if (id.kind === "flag") {
		const w = s
		const h = (s * 2) / 3
		g.save()
		g.beginPath()
		g.roundRect(x - w / 2, y - h / 2, w, h, s * 0.06)
		g.clip()
		g.drawImage(flagCanvas(id.flag), x - w / 2, y - h / 2, w, h)
		g.restore()
	} else {
		const w = s * 1.6
		g.drawImage(
			eraCanvas(id.era),
			x - w / 2,
			y - (w * 260) / 640 / 2,
			w,
			(w * 260) / 640,
		)
	}
	g.globalAlpha = 1
}

// ---------------------------------------------------------------- text

function fitText(
	g: CanvasRenderingContext2D,
	text: string,
	size: number,
	maxW: number,
	weight: number,
	family: string,
	min = 11,
) {
	let fs = size
	g.font = `${weight} ${fs}px ${family}`
	const tw = g.measureText(text).width
	if (tw > maxW) {
		fs = Math.max(min, (fs * maxW) / tw)
		g.font = `${weight} ${fs}px ${family}`
	}
	return fs
}
/** White text with a dark outline instead of a blurred shadow, which is cheap enough to draw every frame. */
function outlined(
	g: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	fs: number,
	fill = "#fff",
) {
	g.lineJoin = "round"
	g.lineWidth = Math.max(2, fs * 0.16)
	g.strokeStyle = "rgba(0,0,0,.72)"
	g.strokeText(text, x, y)
	g.fillStyle = fill
	g.fillText(text, x, y)
}
function nameBlock(
	g: CanvasRenderingContext2D,
	look: Look,
	x: number,
	y: number,
	size: number,
	maxW: number,
	sub: boolean,
	a: number,
) {
	if (size < 9 || a <= 0.01) return 0
	g.globalAlpha = a
	g.textAlign = "center"
	g.textBaseline = "top"
	const fs = fitText(g, look.name, size, maxW, 900, FONT)
	// A decade's era type already says its name.
	const named = look.ident.kind !== "era"
	if (named) outlined(g, look.name, x, y, fs)
	let h = named ? fs * 1.02 : 0
	if (sub && fs >= 15) {
		const ss = fitText(
			g,
			`${look.count.toLocaleString("en")} titles, ${look.fit}% your taste`,
			clamp(fs * 0.36 + 3, 10, 15),
			maxW,
			600,
			BODY,
			9,
		)
		if (ss >= 10) {
			outlined(
				g,
				`${look.count.toLocaleString("en")} titles, ${look.fit}% your taste`,
				x,
				y + h + 2,
				ss,
				"rgba(255,255,255,.82)",
			)
			h += ss * 1.5
		}
	}
	g.globalAlpha = 1
	return h
}

// ---------------------------------------------------------------- styles

export type Paint = {
	g: CanvasRenderingContext2D
	cfg: Config
	look: Look
	/** Island center and radius on screen. */
	x: number
	y: number
	R: number
	/** First posters faded in, 0..1. */
	p1: number
	/** The island's outline on screen. */
	path: Path2D
	/** Island is under the close-up's backdrop. */
	cine: number
}

/** Below the posters: the ground. */
export function under(p: Paint) {
	const { g, cfg, look, x, y, R, path } = p
	if (cfg.identity !== "ground" || R < 8) return
	const id = look.ident
	const quiet = 1 - 0.8 * ease(p.p1)
	const a = (1 - p.cine) * quiet
	if (a <= 0.01) return
	g.save()
	g.clip(path)
	if (id.kind === "flag") {
		// The flag is the land, sunk a little into the dark so the name reads on it.
		g.globalAlpha = a * 0.9
		const w = R * 2.3
		const h = Math.max((w * 2) / 3, R * 2.2)
		g.drawImage(flagCanvas(id.flag), x - (h * 1.5) / 2, y - h / 2, h * 1.5, h)
		g.globalAlpha = a * 0.35
		g.fillStyle = "#0c0a09"
		g.fill(path)
	} else if (id.kind === "logo") {
		g.globalAlpha = a
		g.fillStyle = rgba(look.color, 0.35)
		g.fill(path)
		drawIdent(g, look, cfg, x, y - R * 0.08, R * 1.05, a)
	} else if (id.kind === "icon") {
		drawIdent(
			g,
			look,
			cfg,
			x + R * 0.18,
			y - R * 0.05,
			R * 1.7,
			a * (cfg.icons === "emoji" ? 0.85 : 0.5),
		)
	} else {
		drawIdent(g, look, cfg, x, y - R * 0.1, R * 1.25, a)
	}
	g.restore()
	g.globalAlpha = 1
}

/** Above the posters: emblem and name, big at the overview, a header once posters show. */
export function over(p: Paint, width: number) {
	const { g, cfg, look, x, y, R } = p
	if (R < 6) return
	// The emblem gives way before the posters are readable, so the two never fight.
	const e = ease(clamp(p.p1 * 1.7, 0, 1))
	const cineA = 1 - p.cine
	if (cineA <= 0.01) return
	const maxW = Math.max(R * 1.8, 90)
	// The header: small emblem and name at the island's top edge.
	const topY = y - R * 0.86
	const headFs = clamp(R * 0.07, 16, 34)
	const drawHeader = (a: number) => {
		if (a <= 0.01) return
		g.globalAlpha = a
		const es = headFs * 1.5
		g.font = `900 ${headFs}px ${FONT}`
		const tw = Math.min(
			g.measureText(look.name).width,
			Math.max(160, width * 0.5),
		)
		const total = es + 10 + tw
		const hx = clamp(x - total / 2, 8, Math.max(8, width - total - 8))
		const hy = topY
		if (cfg.identity === "pin")
			pinBadge(g, look, cfg, hx + es / 2, hy + es * 0.55, es * 1.05, a)
		else if (look.ident.kind === "era")
			drawIdent(g, look, cfg, hx + es / 2, hy + es / 2, es * 0.9, a)
		else if (cfg.identity === "crest")
			medallion(g, look, cfg, hx + es / 2, hy + es / 2, es, a)
		else drawIdent(g, look, cfg, hx + es / 2, hy + es / 2, es * 0.9, a)
		g.globalAlpha = a
		g.textAlign = "left"
		g.textBaseline = "middle"
		outlined(g, look.name, hx + es + 10, hy + es / 2 + 1, headFs)
		g.globalAlpha = 1
	}
	const bigA = (1 - e) * cineA
	const headA = e * cineA
	if (cfg.identity === "crest") {
		const E = clamp(R * 0.72, 26, 220)
		const ey = y - R * 0.16
		if (bigA > 0.01) {
			if (look.ident.kind === "era")
				drawIdent(g, look, cfg, x, ey, E * 1.05, bigA)
			else medallion(g, look, cfg, x, ey, E, bigA)
			nameBlock(
				g,
				look,
				x,
				ey + E * 0.56 + 4,
				clamp(R * 0.2, 12, 46),
				maxW,
				R > 70,
				bigA,
			)
		}
		drawHeader(headA)
	} else if (cfg.identity === "ground") {
		if (bigA > 0.01) {
			const fs = clamp(R * 0.3, 13, 64)
			const ny = look.ident.kind === "era" ? y + R * 0.3 : y + R * 0.22
			nameBlock(g, look, x, ny, fs, maxW, R > 64, bigA)
		}
		drawHeader(headA)
	} else if (cfg.identity === "pin") {
		const B = clamp(R * 0.5, 26, 118)
		if (bigA > 0.01) {
			pinBadge(g, look, cfg, x, y - R * 0.12 - B * 0.62, B, bigA)
			nameBlock(
				g,
				look,
				x,
				y + R * 0.02,
				clamp(R * 0.2, 12, 44),
				maxW,
				R > 70,
				bigA,
			)
		}
		drawHeader(headA)
	} else {
		shore(p, bigA)
		drawHeader(headA)
	}
}

function medallion(
	g: CanvasRenderingContext2D,
	look: Look,
	cfg: Config,
	x: number,
	y: number,
	E: number,
	a: number,
) {
	g.globalAlpha = a
	g.beginPath()
	g.arc(x, y, E / 2, 0, Math.PI * 2)
	g.fillStyle = mix(look.color, "#0c0a09", 0.62)
	g.fill()
	g.lineWidth = Math.max(1.5, E * 0.035)
	g.strokeStyle = rgba(look.color, 0.95)
	g.stroke()
	const id = look.ident
	if (id.kind === "flag") {
		g.save()
		g.beginPath()
		g.arc(x, y, E / 2 - g.lineWidth, 0, Math.PI * 2)
		g.clip()
		g.drawImage(flagCanvas(id.flag), x - E * 0.75, y - E / 2, E * 1.5, E)
		g.restore()
	} else if (id.kind === "logo") drawIdent(g, look, cfg, x, y, E * 0.64, a)
	else drawIdent(g, look, cfg, x, y, E * 0.58, a)
	g.globalAlpha = 1
}

/** A map-app place pin: a rounded badge with the emblem and a point underneath, floating over the island. */
function pinBadge(
	g: CanvasRenderingContext2D,
	look: Look,
	cfg: Config,
	x: number,
	y: number,
	B: number,
	a: number,
) {
	g.globalAlpha = a
	const r = B * 0.26
	const top = y - B / 2
	// Shadow on the ground under the point.
	g.fillStyle = "rgba(0,0,0,.35)"
	g.beginPath()
	g.ellipse(x, y + B * 0.72, B * 0.22, B * 0.06, 0, 0, Math.PI * 2)
	g.fill()
	g.beginPath()
	g.roundRect(x - B / 2, top, B, B, r)
	g.moveTo(x - B * 0.14, top + B - 1)
	g.lineTo(x, top + B * 1.2)
	g.lineTo(x + B * 0.14, top + B - 1)
	g.fillStyle = "#fafaf9"
	g.fill()
	g.lineWidth = Math.max(2, B * 0.05)
	g.strokeStyle = look.color
	g.stroke()
	const id = look.ident
	const inner = B - B * 0.2
	if (id.kind === "flag") {
		g.save()
		g.beginPath()
		g.roundRect(x - inner / 2, y - inner / 2, inner, inner, r * 0.7)
		g.clip()
		g.drawImage(
			flagCanvas(id.flag),
			x - inner * 0.75,
			y - inner / 2,
			inner * 1.5,
			inner,
		)
		g.restore()
	} else if (id.kind === "era") {
		g.fillStyle = "#0c0a09"
		g.beginPath()
		g.roundRect(x - inner / 2, y - inner / 2, inner, inner, r * 0.7)
		g.fill()
		drawIdent(g, look, cfg, x, y, inner * 0.62, a)
	} else if (id.kind === "logo") drawIdent(g, look, cfg, x, y, inner, a)
	else {
		g.fillStyle = mix(look.color, "#0c0a09", 0.35)
		g.beginPath()
		g.roundRect(x - inner / 2, y - inner / 2, inner, inner, r * 0.7)
		g.fill()
		drawIdent(g, look, cfg, x, y, inner * 0.8, a)
	}
	g.globalAlpha = 1
}

/** The name set along the top of the shoreline, with the emblem inside the island under it. */
function shore(p: Paint, a: number) {
	const { g, cfg, look, x, y, R } = p
	if (a <= 0.01) return
	const E = clamp(R * 0.62, 24, 200)
	drawIdent(
		g,
		look,
		cfg,
		x,
		y + R * 0.08,
		look.ident.kind === "era" ? E * 1.15 : E,
		a * 0.95,
	)
	// Too small for letters on the shore: a plain name under the island instead.
	if (R < 34) {
		nameBlock(
			g,
			look,
			x,
			y + R * 0.95,
			clamp(R * 0.34, 10, 14),
			Math.max(R * 2.4, 80),
			false,
			a,
		)
		return
	}
	// Letters on an arc just inside the shore, centered on the top.
	const text = look.name.toUpperCase()
	const rr = R * 0.8
	let fs = clamp(R * 0.17, 11, 40)
	g.font = `800 ${fs}px ${FONT}`
	const track = fs * 0.12
	let arc = [...text].reduce((s, ch) => s + g.measureText(ch).width + track, 0)
	const maxArc = rr * Math.PI * 0.95
	if (arc > maxArc) {
		fs = Math.max(10, (fs * maxArc) / arc)
		g.font = `800 ${fs}px ${FONT}`
		arc = [...text].reduce(
			(s, ch) => s + g.measureText(ch).width + fs * 0.12,
			0,
		)
	}
	g.globalAlpha = a
	g.textAlign = "center"
	g.textBaseline = "middle"
	let ang = -Math.PI / 2 - arc / rr / 2
	for (const ch of text) {
		const w = g.measureText(ch).width + fs * 0.12
		const mid = ang + w / rr / 2
		g.save()
		g.translate(x + Math.cos(mid) * rr, y + Math.sin(mid) * rr)
		g.rotate(mid + Math.PI / 2)
		outlined(g, ch, 0, 0, fs, mix(look.color, "#ffffff", 0.55))
		g.restore()
		ang += w / rr
	}
	if (R > 80) {
		g.textAlign = "center"
		g.textBaseline = "top"
		const ss = fitText(
			g,
			`${look.count.toLocaleString("en")} titles, ${look.fit}% your taste`,
			clamp(R * 0.075, 10, 15),
			R * 1.4,
			600,
			BODY,
			9,
		)
		outlined(
			g,
			`${look.count.toLocaleString("en")} titles, ${look.fit}% your taste`,
			x,
			y + R * 0.08 + E * 0.62,
			ss,
			"rgba(255,255,255,.8)",
		)
	}
	g.globalAlpha = 1
}
