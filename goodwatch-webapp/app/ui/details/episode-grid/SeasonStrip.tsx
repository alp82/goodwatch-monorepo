// A season's row in the season overview, drawn on one canvas so a 160-episode season costs what a 10-episode one
// does: its episodes as squares in their IMDb vibe colour (Grid), or as dots on the 4–10 score axis with the season's
// spread as a band and its average as a tick (Spread). Switching views moves each square to its dot and back, a little
// later along the season, so the row ripples rather than jumps; a second switch reverses from wherever the row is.
// Watched episodes have a white foot (Grid) or a filled dot (Spread, unwatched ones hollow), Next a white ring, the
// selected episode a blue one. Canvas drawing is not layout: the morph never moves the page.
import { useEffect, useMemo, useRef } from "react"
import type { PageEpisode } from "~/domain/tracking/show-page"
import type { Season } from "~/ui/tracking/store"
import type { GridModel } from "./grid-model"
import { formatScore, imdbVibe, vibeTileColor } from "./scale"
import { GAP, READABLE, ROW, axisX, spreadOf, stripLines } from "./strip-layout"

const DURATION = 450
const STAGGER = 140
const ease = (t: number) => 1 - (1 - t) ** 3
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

let palette: Map<number, string> | null = null
/** The vibe colours as the page resolves them: they are CSS colour mixes of variables, which a canvas can't read. */
function resolvedPalette(): Map<number, string> {
	if (palette) return palette
	const probe = document.createElement("span")
	document.body.appendChild(probe)
	palette = new Map()
	for (let v = 0; v <= 100; v += 10) {
		probe.style.background = vibeTileColor(v)
		palette.set(v, getComputedStyle(probe).backgroundColor)
	}
	probe.remove()
	return palette
}

const colourOf = (e: PageEpisode, aired: boolean) =>
	e.rating !== null && aired
		? (resolvedPalette().get(imdbVibe(e.rating)) ?? "#555")
		: "rgba(255,255,255,0.10)"

export default function SeasonStrip({
	season,
	model,
	plot,
	cell,
	chart,
	showAvg,
	selected,
	onHover,
}: {
	season: Season
	model: GridModel
	plot: number
	cell: number
	chart: boolean
	/** The whole show's average, a dashed line in Spread. */
	showAvg: number | null
	selected: number | null
	onHover: (e: PageEpisode | null, x: number, y: number) => void
}) {
	const ref = useRef<HTMLCanvasElement>(null)
	const progress = useRef(chart ? 1 : 0)
	const { perLine } = stripLines(cell, plot)
	const lines = Math.max(1, Math.ceil(season.episodes.length / perLine))
	const top = (ROW - (lines * (cell + GAP) - GAP)) / 2
	const draw = useMemo(() => {
		const at = (i: number) => ({
			x: (i % perLine) * (cell + GAP),
			y: top + Math.floor(i / perLine) * (cell + GAP),
		})
		const rated = season.episodes.filter((e) => e.rating !== null)
		const spread = spreadOf(rated.map((e) => e.rating ?? 0))
		const x = (v: number) => axisX(v, plot)
		const r = Math.max(1.6, Math.min(4.5, 90 / Math.max(1, rated.length)))
		const radius = cell >= 10 ? Math.min(4, cell / 6) : cell >= 6 ? 1 : 0
		const order = new Map(rated.map((e, i) => [e.id, i]))
		const n = season.episodes.length
		return (p: number) => {
			const c = ref.current
			const g = c?.getContext("2d")
			if (!c || !g) return
			const dpr = window.devicePixelRatio || 1
			if (c.width !== Math.round(plot * dpr)) c.width = Math.round(plot * dpr)
			if (c.height !== Math.round(ROW * dpr)) c.height = Math.round(ROW * dpr)
			g.setTransform(dpr, 0, 0, dpr, 0, 0)
			g.clearRect(0, 0, plot, ROW)
			const bg = ease(p)
			if (bg > 0) {
				g.globalAlpha = bg
				g.fillStyle = "rgba(255,255,255,0.05)"
				for (const t of [5, 6, 7, 8, 9]) g.fillRect(x(t), 2, 1, ROW - 4)
				if (showAvg !== null) {
					g.strokeStyle = "rgba(255,255,255,0.22)"
					g.setLineDash([3, 3])
					g.beginPath()
					g.moveTo(x(showAvg) + 0.5, 0)
					g.lineTo(x(showAvg) + 0.5, ROW)
					g.stroke()
					g.setLineDash([])
				}
				if (spread) {
					g.fillStyle = "rgba(255,255,255,0.07)"
					g.beginPath()
					g.roundRect(
						x(spread.avg - spread.sd),
						3,
						Math.max(4, x(spread.avg + spread.sd) - x(spread.avg - spread.sd)),
						ROW - 6,
						5,
					)
					g.fill()
				}
				g.globalAlpha = 1
			}
			g.font = "600 9.5px ui-sans-serif, system-ui, sans-serif"
			g.textAlign = "center"
			g.textBaseline = "middle"
			season.episodes.forEach((e, i) => {
				const delay = n > 1 ? (i / (n - 1)) * STAGGER : 0
				const q = ease(
					Math.max(
						0,
						Math.min(1, (p * (DURATION + STAGGER) - delay) / DURATION),
					),
				)
				const tile = at(i)
				const k = order.get(e.id)
				const colour = colourOf(e, model.aired(e))
				const watched = model.tracked && model.view.watched.has(e.id)
				const ringed = e.id === selected || e.id === model.nextId
				// An unrated episode has no dot: it fades where it stands.
				const dotR = ringed ? r + 1.5 : r
				const jitter =
					rated.length > 30 && k !== undefined ? ((k * 37) % 9) - 4 : 0
				const cx =
					k === undefined
						? tile.x + cell / 2
						: lerp(tile.x + cell / 2, x(e.rating ?? 0), q)
				const cy =
					k === undefined
						? tile.y + cell / 2
						: lerp(tile.y + cell / 2, ROW / 2 + jitter * (ROW / 30), q)
				const size = k === undefined ? cell : lerp(cell, dotR * 2, q)
				const rad =
					k === undefined ? radius : lerp(Math.min(radius, cell / 3), dotR, q)
				const alpha = k === undefined ? 1 - q : 1
				if (alpha <= 0) return
				g.globalAlpha =
					alpha * (k !== undefined && rated.length > 60 ? lerp(1, 0.8, q) : 1)
				g.beginPath()
				g.roundRect(cx - size / 2, cy - size / 2, size, size, rad)
				if (model.tracked && !watched && k !== undefined) {
					g.globalAlpha = 1 - q
					g.fillStyle = colour
					g.fill()
					g.globalAlpha = q
					g.strokeStyle = colour
					g.lineWidth = 1.2
					g.stroke()
				} else {
					g.fillStyle = colour
					g.fill()
				}
				g.globalAlpha = 1
				if (watched && q < 1) {
					const fh = Math.max(1.5, cell / 9)
					g.globalAlpha = 1 - q
					g.fillStyle = "rgba(255,255,255,0.95)"
					g.fillRect(
						tile.x + (cell > 6 ? 2 : 0),
						tile.y + cell - fh - (cell > 12 ? 1.5 : 0),
						Math.max(1, cell - (cell > 6 ? 4 : 0)),
						fh,
					)
					g.globalAlpha = 1
				}
				if (cell >= READABLE && e.rating !== null && q < 0.5) {
					g.globalAlpha = 1 - q * 2
					g.fillStyle = "#fff"
					g.fillText(
						formatScore(e.rating),
						tile.x + cell / 2,
						tile.y + cell / 2 + 0.5,
					)
					g.globalAlpha = 1
				}
				const ring =
					e.id === selected
						? "#38bdf8"
						: e.id === model.nextId && q < 1
							? "#ffffff"
							: null
				if (ring) {
					g.globalAlpha = e.id === selected ? 1 : 1 - q
					g.strokeStyle = ring
					g.lineWidth = cell >= 8 ? 2 : 1.5
					g.beginPath()
					g.roundRect(
						cx - size / 2 - 1,
						cy - size / 2 - 1,
						size + 2,
						size + 2,
						rad + 1,
					)
					g.stroke()
					g.globalAlpha = 1
				}
			})
			if (spread && bg > 0) {
				g.globalAlpha = bg
				g.fillStyle = "rgba(255,255,255,0.75)"
				g.fillRect(x(spread.avg) - 1, 2, 2, ROW - 4)
				g.globalAlpha = 1
			}
		}
	}, [season, model, plot, cell, perLine, top, showAvg, selected])
	// Anything but the view changing redraws in place.
	useEffect(() => draw(progress.current), [draw])
	// Only the view switch starts the morph; the drawing it runs is the current one.
	useEffect(() => {
		const target = chart ? 1 : 0
		if (progress.current === target) return
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			progress.current = target
			draw(target)
			return
		}
		const from = progress.current
		const span = Math.abs(target - from) * (DURATION + STAGGER)
		const start = performance.now()
		let frame = 0
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / span)
			progress.current = lerp(from, target, t)
			draw(progress.current)
			if (t < 1) frame = requestAnimationFrame(tick)
		}
		frame = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(frame)
	}, [chart])
	return (
		<canvas
			ref={ref}
			aria-hidden
			style={{ width: plot, height: ROW }}
			className="block shrink-0"
			onPointerMove={(ev) => {
				if (ev.pointerType === "touch" || chart) return onHover(null, 0, 0)
				const b = ev.currentTarget.getBoundingClientRect()
				const col = Math.floor((ev.clientX - b.left) / (cell + GAP))
				const y = ev.clientY - b.top - top
				const line = Math.floor(y / (cell + GAP))
				const e =
					col < perLine && y >= 0
						? season.episodes[line * perLine + col]
						: undefined
				onHover(
					e ?? null,
					b.left + col * (cell + GAP) + cell / 2,
					b.top + top + line * (cell + GAP),
				)
			}}
			onPointerLeave={() => onHover(null, 0, 0)}
		/>
	)
}
