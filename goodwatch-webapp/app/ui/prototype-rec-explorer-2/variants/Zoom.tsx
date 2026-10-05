// PROTOTYPE - throwaway. Nested map (existing components): clusters that split as you zoom. Far out you see nine
// continents of the catalog, named by the title analysis attributes that set them apart; zoom in and each splits
// into regions, then districts, then titles. Only the best title per screen cell is loaded at each level, streamed
// from the server as you move, so the screen never holds the whole catalog. The trail at the bottom says where you
// are (continent, region, district) and flies back out.
import { useEffect, useMemo, useRef, useState } from "react"
import { type Cam, Stage, type StageHandle, drawYou, haloText } from "../Stage"
import { Crumbs, Header, PeekDock, ZoomControls } from "../kit2"
import { Store } from "../store"
import type { Ex } from "../useExplorer2"
import { useTiles } from "../useTiles"
import { S0 } from "../wire"

type Node = NonNullable<NonNullable<Ex["data"]["meta"]>["nodes"]>[number]

// Which depth of cluster is "current" at a zoom level, and how strongly each depth shows.
const DEPTH_AT = [0.1, 1.45, 2.75]
const show = (depth: number, camLevel: number) =>
	Math.max(0, 1 - Math.abs(camLevel - DEPTH_AT[depth]) / 1.35)
const labelShow = (depth: number, camLevel: number) =>
	Math.max(0, Math.min(1, 1.6 - Math.abs(camLevel - DEPTH_AT[depth]) / 0.62))
// Label boxes drawn this frame, so names never overlap.
const boxes = new Float32Array(4 * 256)
const clear = (n: number, x0: number, y0: number, x1: number, y1: number) => {
	for (let k = 0; k < n; k++)
		if (
			x0 < boxes[k * 4 + 2] &&
			x1 > boxes[k * 4] &&
			y0 < boxes[k * 4 + 3] &&
			y1 > boxes[k * 4 + 1]
		)
			return false
	return true
}

export default function Zoom({ ex }: { ex: Ex }) {
	const stage = useRef<StageHandle>(null)
	const store = useMemo(() => new Store(), [])
	const nodes = (ex.data.meta?.nodes ?? []) as Node[]
	const bySize = useMemo(
		() => [...nodes].sort((a, b) => a.depth - b.depth || b.count - a.count),
		[nodes],
	)
	const you = ex.data.you
	const tiles = useTiles(stage, store, ex, "zoom")
	const [sel, setSel] = useState<number | null>(null)
	const [path, setPath] = useState<Node[]>([])
	const pathKey = useRef("")

	// Where the middle of the screen is: continent, region, district.
	const locate = (c: Cam) => {
		const out: Node[] = []
		let parent = -1
		for (let depth = 0; depth < 3; depth++) {
			let best: Node | null = null
			let bd = Number.POSITIVE_INFINITY
			for (const n of nodes) {
				if (n.depth !== depth || n.parent !== parent) continue
				const d = Math.hypot(n.x - c.x, n.y - c.y) / n.r
				if (d < bd) {
					bd = d
					best = n
				}
			}
			if (!best || bd > 1.15) break
			// Only name the depths the zoom makes meaningful.
			if (Math.log2(c.scale / S0) < DEPTH_AT[depth] - 0.9) break
			out.push(best)
			parent = best.id
		}
		return out
	}
	const lastLocate = useRef(0)
	const onView = () => {
		tiles.onView()
		const now = performance.now()
		if (now - lastLocate.current < 180) return
		lastLocate.current = now
		const c = stage.current?.camera()
		if (!c) return
		const p = locate(c)
		const k = p.map((n) => n.id).join(",")
		if (k !== pathKey.current) {
			pathKey.current = k
			setPath(p)
		}
	}

	const hooks = useMemo(
		() => ({
			under: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const camLevel = Math.log2(c.scale / S0)
				ctx.lineWidth = 1
				for (const n of nodes) {
					const a = show(n.depth, camLevel)
					if (a < 0.03) continue
					const r = n.r * c.scale
					const sx = (n.x - c.x) * c.scale + c.w / 2
					const sy = (n.y - c.y) * c.scale + c.h / 2
					if (sx + r < 0 || sy + r < 0 || sx - r > c.w || sy - r > c.h || r < 6)
						continue
					ctx.globalAlpha = a
					ctx.fillStyle =
						n.depth === 0 ? "rgba(214,179,106,.05)" : "rgba(255,255,255,.025)"
					ctx.strokeStyle =
						n.depth === 0 ? "rgba(214,179,106,.28)" : "rgba(255,255,255,.12)"
					ctx.beginPath()
					ctx.arc(sx, sy, r, 0, Math.PI * 2)
					ctx.fill()
					ctx.stroke()
				}
				ctx.globalAlpha = 1
			},
			over: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const camLevel = Math.log2(c.scale / S0)
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				let nb = 0
				for (const n of bySize) {
					const a = labelShow(n.depth, camLevel)
					if (a < 0.05) continue
					const r = n.r * c.scale
					if (r < 40) continue
					const sx = (n.x - c.x) * c.scale + c.w / 2
					const sy =
						(n.y - c.y) * c.scale + c.h / 2 - r + Math.min(26, r * 0.18)
					if (sx < -200 || sx > c.w + 200 || sy < -40 || sy > c.h + 40) continue
					const size = n.depth === 0 ? 26 : n.depth === 1 ? 19 : 15
					const hw = n.name.length * size * 0.29 + 6
					if (!clear(nb, sx - hw, sy - size * 0.7, sx + hw, sy + size * 1.5))
						continue
					if (nb < 256) {
						boxes.set(
							[sx - hw, sy - size * 0.7, sx + hw, sy + size * 1.5],
							nb * 4,
						)
						nb++
					}
					ctx.globalAlpha = a
					ctx.font = `700 ${size}px system-ui, sans-serif`
					haloText(ctx, n.name, sx, sy, n.depth === 0 ? "#fde68a" : "#fafaf9")
					ctx.font = "500 11px system-ui, sans-serif"
					ctx.globalAlpha = a * 0.75
					haloText(
						ctx,
						`${n.count.toLocaleString()} titles`,
						sx,
						sy + size * 0.9,
						"#d6d3d1",
						"rgba(0,0,0,.8)",
						3,
					)
				}
				ctx.globalAlpha = 1
				drawYou(
					ctx,
					(you.x - c.x) * c.scale + c.w / 2,
					(you.y - c.y) * c.scale + c.h / 2,
				)
			},
		}),
		[nodes, you],
	)

	const flyNode = (n: Node) => {
		const c = stage.current?.camera()
		if (!c) return
		stage.current?.flyTo(n.x, n.y, Math.min(c.w, c.h) / (n.r * 2.3), 800)
	}

	return (
		<div className="rx2-stage rx-atlas-bg text-white">
			<Stage
				ref={stage}
				className="absolute inset-0"
				store={store}
				hooks={hooks}
				levels
				selected={sel}
				queue={ex.queue}
				initial={{ x: you.x, y: you.y, scale: S0 * 2 ** 3 }}
				minScale={S0 * 0.35}
				maxScale={30}
				bounds={{ x0: -1700, y0: -1700, x1: 1700, y1: 1700 }}
				onTap={(i) => setSel(i)}
				onView={onView}
				ariaLabel="Map of films and shows, clustered by title analysis"
			/>
			<Header
				ex={ex}
				title="Explore"
				sub="Clusters of films and shows by their title analysis. Zoom in and each cluster splits into smaller ones, then titles."
			/>
			<PeekDock
				ex={ex}
				it={sel == null ? null : store.items[sel]}
				onClose={() => setSel(null)}
			/>
			<div
				className={`absolute inset-x-3 rx2-bottom z-10 flex justify-center md:inset-x-auto md:left-6 ${sel != null ? "hidden md:flex" : ""}`}
			>
				<Crumbs
					label="Where you are"
					items={[
						{ key: "all", name: "All titles" },
						...path.map((n, k) => ({
							key: String(n.id),
							name: n.name,
							current: k === path.length - 1,
						})),
					]}
					onPick={(k) => {
						if (k === 0) stage.current?.flyTo(0, 0, S0 * 0.55, 900)
						else flyNode(path[k - 1])
					}}
				/>
			</div>
			<ZoomControls
				className={`absolute bottom-40 right-4 z-10 md:bottom-6 ${sel != null ? "hidden md:flex" : ""}`}
				onIn={() => stage.current?.zoomBy(2)}
				onOut={() => stage.current?.zoomBy(0.5)}
				onYou={() => stage.current?.flyTo(you.x, you.y, S0 * 2 ** 3, 900)}
			/>
		</div>
	)
}
