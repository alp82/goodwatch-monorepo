// PROTOTYPE - throwaway. Through the decades (bolder): clusters by era and mood. Time runs left to right, each
// mood is a lane, and each decade × mood block is a cluster. You start in the years your best matches come from;
// pan through time and the next decade streams in. Far out, each block shows only its best few; close in, all.
// A ruler along the top jumps between decades.
import { useMemo, useRef, useState } from "react"
import { type Cam, Stage, type StageHandle, drawYou, haloText } from "../Stage"
import { FilterChips, PeekDock, WhoNote, ZoomControls } from "../kit2"
import { Store } from "../store"
import type { Ex } from "../useExplorer2"
import { useTiles } from "../useTiles"
import { S0 } from "../wire"

const RULER = 46

export default function Eras({ ex }: { ex: Ex }) {
	const stage = useRef<StageHandle>(null)
	const store = useMemo(() => new Store(), [])
	const lanes = ex.data.meta?.lanes ?? []
	const decades = ex.data.meta?.decades ?? []
	const you = ex.data.you
	const tiles = useTiles(stage, store, ex, "eras")
	const [sel, setSel] = useState<number | null>(null)
	const [decade, setDecade] = useState("")
	const decadeRef = useRef("")

	const decadeAt = (x: number) =>
		decades.find((d) => x >= d.x && x < d.x1) ??
		(x < (decades[0]?.x ?? 0) ? decades[0] : decades[decades.length - 1])
	const onView = () => {
		tiles.onView()
		const c = stage.current?.camera()
		if (!c) return
		const d = decadeAt(c.x)?.label ?? ""
		if (d !== decadeRef.current) {
			decadeRef.current = d
			setDecade(d)
		}
	}

	const hooks = useMemo(
		() => ({
			under: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const sx = (x: number) => (x - c.x) * c.scale + c.w / 2
				const sy = (y: number) => (y - c.y) * c.scale + c.h / 2
				// Lanes: a faint wash in the mood's color.
				for (let k = 0; k < lanes.length; k++) {
					const l = lanes[k]
					const y0 = sy(l.y0)
					const y1 = sy(l.y1)
					if (y1 < 0 || y0 > c.h) continue
					ctx.globalAlpha = 0.06
					ctx.fillStyle = l.color
					ctx.fillRect(0, y0, c.w, y1 - y0)
					ctx.globalAlpha = 0.35
					ctx.fillRect(0, y0, c.w, 1)
				}
				ctx.globalAlpha = 1
				// Decades: huge outlined numerals behind the posters, and a hairline where each begins.
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				for (const d of decades) {
					const x0 = sx(d.x)
					const x1 = sx(d.x1)
					if (x1 < 0 || x0 > c.w) continue
					ctx.fillStyle = "rgba(255,255,255,.08)"
					ctx.fillRect(x0, 0, 1, c.h)
					const size = Math.max(40, Math.min(420, (x1 - x0) * 0.62))
					ctx.font = `900 ${size}px 'Big Shoulders Display', system-ui, sans-serif`
					ctx.lineWidth = 1.5
					ctx.strokeStyle = "rgba(253,230,138,.10)"
					ctx.strokeText(d.label.slice(0, 4), (x0 + x1) / 2, c.h / 2)
				}
			},
			over: (ctx: CanvasRenderingContext2D, c: Cam) => {
				drawYou(
					ctx,
					(you.x - c.x) * c.scale + c.w / 2,
					(you.y - c.y) * c.scale + c.h / 2,
					"You",
				)
				// Lane names pinned to the left edge.
				ctx.textAlign = "left"
				ctx.textBaseline = "middle"
				ctx.font = "800 20px 'Big Shoulders Display', system-ui, sans-serif"
				for (const l of lanes) {
					const y0 = (l.y0 - c.y) * c.scale + c.h / 2
					const y1 = (l.y1 - c.y) * c.scale + c.h / 2
					const y = Math.max(y0 + 16, Math.min(y1 - 16, c.h / 2))
					if (y1 - y0 < 26 || y < 200 || y > c.h - 12) continue
					haloText(ctx, l.name, 16, y, l.color, "rgba(0,0,0,.9)", 5)
				}
			},
			top: (ctx: CanvasRenderingContext2D, c: Cam) => {
				// The ruler: every decade, the one you're in lit.
				const y = 0
				ctx.fillStyle = "rgba(7,6,10,.94)"
				ctx.fillRect(0, y, c.w, RULER)
				ctx.fillStyle = "rgba(253,230,138,.25)"
				ctx.fillRect(0, y + RULER - 1, c.w, 1)
				const total =
					(decades[decades.length - 1]?.x1 ?? 1) - (decades[0]?.x ?? 0)
				const k = (c.w - 32) / total
				const x0 = decades[0]?.x ?? 0
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				for (const d of decades) {
					const a = 16 + (d.x - x0) * k
					const b = 16 + (d.x1 - x0) * k
					const here = c.x >= d.x && c.x < d.x1
					ctx.fillStyle = here ? "#fbbf24" : "rgba(255,255,255,.12)"
					ctx.fillRect(a + 1, y + 8, b - a - 2, 3)
					ctx.font = here
						? "800 17px 'Big Shoulders Display', system-ui, sans-serif"
						: "700 14px 'Big Shoulders Display', system-ui, sans-serif"
					ctx.fillStyle = here ? "#fde68a" : "#a8a29e"
					if (b - a > 26)
						ctx.fillText(
							b - a > 44 ? d.label : d.label.slice(2),
							(a + b) / 2,
							y + 28,
						)
				}
				// Where the screen is on the ruler.
				const va = 16 + (c.x - c.w / 2 / c.scale - x0) * k
				const vb = 16 + (c.x + c.w / 2 / c.scale - x0) * k
				ctx.strokeStyle = "rgba(251,191,36,.8)"
				ctx.lineWidth = 1.5
				ctx.strokeRect(
					Math.max(2, va),
					y + 4,
					Math.max(6, Math.min(c.w - 4, vb) - Math.max(2, va)),
					11,
				)
			},
		}),
		[lanes, decades, you],
	)

	const onTap = (
		i: number | null,
		_wx: number,
		_wy: number,
		sx: number,
		sy: number,
	) => {
		const c = stage.current?.camera()
		if (c && sy < RULER) {
			const total =
				(decades[decades.length - 1]?.x1 ?? 1) - (decades[0]?.x ?? 0)
			const wx = (decades[0]?.x ?? 0) + ((sx - 16) / (c.w - 32)) * total
			const d = decadeAt(wx)
			if (d)
				stage.current?.flyTo(
					(d.x + d.x1) / 2,
					c.y,
					Math.max(c.scale, c.w / ((d.x1 - d.x) * 1.15)),
					900,
				)
			return
		}
		setSel(i)
	}

	return (
		<div className="rx2-stage bg-stone-950 text-white">
			<Stage
				ref={stage}
				className="absolute inset-0"
				store={store}
				hooks={hooks}
				levels
				bg="ink"
				selected={sel}
				queue={ex.queue}
				initial={{ x: you.x, y: you.y, scale: S0 * 2 ** 2.2 }}
				minScale={S0 * 0.35}
				maxScale={30}
				bounds={{ x0: -1500, y0: -900, x1: 1500, y1: 900 }}
				onTap={onTap}
				onView={onView}
				ariaLabel="Films and shows by decade and mood"
			/>
			<div className="pointer-events-none absolute inset-x-0 top-[46px] z-10 bg-gradient-to-b from-black/90 via-black/60 to-transparent px-4 pb-8 pt-3 md:px-8">
				<div className="flex items-end gap-4">
					<h1 className="rx2-display text-5xl font-black leading-none text-amber-100 md:text-7xl">
						{decade || "Eras"}
					</h1>
					<p className="mb-1 max-w-sm text-sm text-gray-300">
						Decades left to right, moods top to bottom. Pan through time and the
						next decade streams in.
					</p>
				</div>
				<div className="pointer-events-auto mt-3">
					<FilterChips ex={ex} />
					<WhoNote ex={ex} className="mt-2" />
				</div>
			</div>
			<PeekDock
				ex={ex}
				it={sel == null ? null : store.items[sel]}
				onClose={() => setSel(null)}
			/>
			<ZoomControls
				className={`absolute bottom-40 right-4 z-10 md:bottom-6 ${sel != null ? "hidden md:flex" : ""}`}
				onIn={() => stage.current?.zoomBy(2)}
				onOut={() => stage.current?.zoomBy(0.5)}
				onYou={() => stage.current?.flyTo(you.x, you.y, S0 * 2 ** 2.2, 900)}
			/>
		</div>
	)
}
