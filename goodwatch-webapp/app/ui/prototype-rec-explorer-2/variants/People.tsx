// PROTOTYPE - throwaway. Directors (existing components): clusters around people. Every director (or show
// creator) with a few titles here is a hub, placed by what their work is like, their titles orbiting them. You
// start at the director you rate highest; the five whose work feels closest wait at the edge of the fog. Open one
// and their titles stream in and their own neighbors appear, so the map grows along lines of influence.
import { useEffect, useMemo, useRef, useState } from "react"
import {
	type Cam,
	Stage,
	type StageHandle,
	fogFill,
	fogHole,
	haloText,
} from "../Stage"
import { Crumbs, Header, PeekDock, ZoomControls } from "../kit2"
import { Store } from "../store"
import type { Ex } from "../useExplorer2"
import type { Hub, W } from "../wire"

const PROFILE = "https://image.tmdb.org/t/p/w185"
const FACE = 11 // portrait radius in world units

type H = Hub & { open: boolean; t0: number }

// Round portraits, clipped once into their own small canvas.
const faces = new Map<number, HTMLCanvasElement | null>()
function face(h: Hub, redraw: () => void) {
	if (faces.has(h.id)) return faces.get(h.id) ?? null
	faces.set(h.id, null)
	if (!h.profile) return null
	const im = new Image()
	im.src = `${PROFILE}${h.profile}`
	im.decode()
		.then(() => {
			const c = document.createElement("canvas")
			c.width = c.height = 128
			const g = c.getContext("2d") as CanvasRenderingContext2D
			g.beginPath()
			g.arc(64, 64, 64, 0, Math.PI * 2)
			g.clip()
			const s = Math.max(128 / im.naturalWidth, 128 / im.naturalHeight)
			g.drawImage(
				im,
				64 - (im.naturalWidth * s) / 2,
				58 - (im.naturalHeight * s) / 2 + 6,
				im.naturalWidth * s,
				im.naturalHeight * s,
			)
			faces.set(h.id, c)
			redraw()
		})
		.catch(() => {})
	return null
}

export default function People({ ex }: { ex: Ex }) {
	const stage = useRef<StageHandle>(null)
	const store = useMemo(() => new Store(), [])
	const hubs = useRef(new Map<number, H>())
	const links = useRef<number[]>([])
	const [opened, setOpened] = useState<number[]>([])
	const [mine, setMine] = useState<Hub[]>([])
	const [sel, setSel] = useState<number | null>(null)
	const busy = useRef(new Set<number>())

	const openHub = async (id: number, fly: boolean) => {
		const known = hubs.current.get(id)
		if (known?.open || busy.current.has(id)) {
			if (known && fly) stage.current?.flyTo(known.x, known.y, 2.6, 900)
			return
		}
		busy.current.add(id)
		try {
			const r = await ex.api<{ hub: Hub | null; items: W[]; near: Hub[] }>(
				"director",
				{ id, near: 5 },
			)
			if (!r.hub) return
			hubs.current.set(id, { ...r.hub, open: true, t0: performance.now() })
			store.add(r.items, performance.now())
			store.filter(ex.pass)
			for (const n of r.near) {
				if (!hubs.current.has(n.id))
					hubs.current.set(n.id, { ...n, open: false, t0: performance.now() })
				links.current.push(id, n.id)
			}
			setOpened((o) => (o.includes(id) ? o : [...o, id]))
			if (fly) stage.current?.flyTo(r.hub.x, r.hub.y, 2.6, 1000)
			stage.current?.redraw()
		} finally {
			busy.current.delete(id)
		}
	}

	const started = useRef(false)
	useEffect(() => {
		if (started.current) return
		started.current = true
		ex.api<{ hubs: Hub[] }>("people-start", { n: 6 }).then((r) => {
			setMine(r.hubs)
			for (const h of r.hubs)
				if (!hubs.current.has(h.id))
					hubs.current.set(h.id, { ...h, open: false, t0: performance.now() })
			if (r.hubs[0]) {
				stage.current?.flyTo(r.hubs[0].x, r.hubs[0].y, 2.2, 10)
				void openHub(r.hubs[0].id, false)
			}
		})
	}, [])
	useEffect(() => {
		store.filter(ex.pass)
		stage.current?.redraw()
	}, [ex.filterKey, ex.rev])

	const hooks = useMemo(
		() => ({
			under: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const sx = (x: number) => (x - c.x) * c.scale + c.w / 2
				const sy = (y: number) => (y - c.y) * c.scale + c.h / 2
				const L = links.current
				ctx.strokeStyle = "rgba(251,191,36,.35)"
				ctx.lineWidth = 1.5
				ctx.setLineDash([3, 6])
				ctx.beginPath()
				for (let k = 0; k < L.length; k += 2) {
					const a = hubs.current.get(L[k])
					const b = hubs.current.get(L[k + 1])
					if (!a || !b) continue
					ctx.moveTo(sx(a.x), sy(a.y))
					ctx.lineTo(sx(b.x), sy(b.y))
				}
				ctx.stroke()
				ctx.setLineDash([])
				// Orbits of open hubs.
				ctx.strokeStyle = "rgba(255,255,255,.08)"
				ctx.lineWidth = 1
				for (const h of hubs.current.values()) {
					if (!h.open) continue
					ctx.beginPath()
					ctx.arc(sx(h.x), sy(h.y), h.r * c.scale, 0, Math.PI * 2)
					ctx.stroke()
				}
			},
			// Portraits sit above the fog, so the directors waiting to be opened show at its edge.
			top: (ctx: CanvasRenderingContext2D, c: Cam) => {
				const redraw = () => stage.current?.redraw()
				ctx.textAlign = "center"
				ctx.textBaseline = "top"
				for (const h of hubs.current.values()) {
					const x = (h.x - c.x) * c.scale + c.w / 2
					const y = (h.y - c.y) * c.scale + c.h / 2
					const r = Math.max(15, Math.min(46, FACE * c.scale))
					if (
						x < -r - 80 ||
						y < -r - 40 ||
						x > c.w + r + 80 ||
						y > c.h + r + 40
					)
						continue
					const img = face(h, redraw)
					ctx.globalAlpha = h.open ? 1 : 0.55
					ctx.fillStyle = "#1c1917"
					ctx.beginPath()
					ctx.arc(x, y, r, 0, Math.PI * 2)
					ctx.fill()
					if (img) ctx.drawImage(img, x - r, y - r, r * 2, r * 2)
					else {
						ctx.font = `700 ${Math.round(r * 0.7)}px system-ui, sans-serif`
						ctx.textBaseline = "middle"
						ctx.fillStyle = "#d6d3d1"
						ctx.fillText(
							h.name
								.split(" ")
								.map((p) => p[0])
								.slice(0, 2)
								.join(""),
							x,
							y,
						)
						ctx.textBaseline = "top"
					}
					ctx.globalAlpha = 1
					ctx.lineWidth = h.open ? 2.5 : 1.5
					ctx.strokeStyle = h.open ? "#fbbf24" : "rgba(253,230,138,.6)"
					if (!h.open) ctx.setLineDash([4, 4])
					ctx.beginPath()
					ctx.arc(x, y, r + 1.5, 0, Math.PI * 2)
					ctx.stroke()
					ctx.setLineDash([])
					ctx.font = "700 13px system-ui, sans-serif"
					haloText(ctx, h.name, x, y + r + 5, h.open ? "#fef3c7" : "#d6d3d1")
					ctx.font = "500 11px system-ui, sans-serif"
					haloText(
						ctx,
						h.open ? `${h.count} titles` : "Tap to open",
						x,
						y + r + 21,
						h.open ? "#a8a29e" : "#fcd34d",
						"rgba(0,0,0,.85)",
						3,
					)
				}
			},
			fog: (fctx: CanvasRenderingContext2D, c: Cam, now: number) => {
				fogFill(fctx, c)
				let again = false
				for (const h of hubs.current.values()) {
					const t = Math.min(1, (now - h.t0) / 900)
					if (t < 1) again = true
					fogHole(
						fctx,
						c,
						h.x,
						h.y,
						h.open ? (h.r + 55) * t : 34 * t,
						h.open ? 1 : 0.7,
					)
				}
				fctx.globalCompositeOperation = "source-over"
				return again
			},
		}),
		[store],
	)

	const onTap = (i: number | null, wx: number, wy: number) => {
		const c = stage.current?.camera()
		const reach = Math.max(FACE, 18 / (c?.scale ?? 1))
		for (const h of hubs.current.values()) {
			if (Math.hypot(h.x - wx, h.y - wy) < reach * 1.2) {
				setSel(null)
				void openHub(h.id, true)
				return
			}
		}
		setSel(i)
	}

	const openedHubs = opened
		.map((id) => hubs.current.get(id))
		.filter((h): h is H => !!h)
	return (
		<div className="rx2-stage rx-atlas-bg text-white">
			<Stage
				ref={stage}
				className="absolute inset-0"
				store={store}
				hooks={hooks}
				selected={sel}
				queue={ex.queue}
				initial={{ x: 0, y: 0, scale: 2.6 }}
				minScale={0.25}
				maxScale={30}
				onTap={onTap}
				ariaLabel="Directors placed by what their work is like, with their titles around them"
			/>
			<Header
				ex={ex}
				title="Explore"
				sub="Directors and show creators, placed by what their work is like. Open one and the five closest to them appear."
			>
				{mine.length > 0 && (
					<div className="mt-3 flex max-w-full items-center gap-1.5 overflow-x-auto rx2-scroll-x">
						<span className="shrink-0 text-xs text-gray-400">
							Your directors
						</span>
						{mine.map((h) => (
							<button
								key={h.id}
								type="button"
								onClick={() => void openHub(h.id, true)}
								className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-white/10 pl-0.5 pr-3 text-xs font-semibold text-gray-100 hover:bg-white/20"
							>
								{h.profile ? (
									<img
										src={`${PROFILE}${h.profile}`}
										alt=""
										className="h-7 w-7 rounded-full object-cover"
									/>
								) : (
									<span className="h-7 w-7 rounded-full bg-white/10" />
								)}
								{h.name}
							</button>
						))}
					</div>
				)}
			</Header>
			<PeekDock
				ex={ex}
				it={sel == null ? null : store.items[sel]}
				onClose={() => setSel(null)}
			/>
			<div
				className={`absolute inset-x-3 rx2-bottom z-10 flex justify-center md:inset-x-auto md:left-6 ${sel != null ? "hidden md:flex" : ""}`}
			>
				<Crumbs
					label="Directors you opened"
					items={openedHubs.map((h, k) => ({
						key: String(h.id),
						name: h.name,
						poster: h.profile ? `${PROFILE}${h.profile}` : undefined,
						current: k === openedHubs.length - 1,
					}))}
					onPick={(k) =>
						stage.current?.flyTo(openedHubs[k].x, openedHubs[k].y, 2.6, 900)
					}
				/>
			</div>
			<ZoomControls
				className={`absolute bottom-40 right-4 z-10 md:bottom-6 ${sel != null ? "hidden md:flex" : ""}`}
				onIn={() => stage.current?.zoomBy(2)}
				onOut={() => stage.current?.zoomBy(0.5)}
				onYou={
					openedHubs[0]
						? () =>
								stage.current?.flyTo(openedHubs[0].x, openedHubs[0].y, 2.6, 900)
						: undefined
				}
				youLabel="Back to the start"
			/>
		</div>
	)
}
