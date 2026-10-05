// PROTOTYPE - throwaway. Controls around the round-4 map: the grouping picker, the history (last two steps and a
// dropdown, like a browser's back button), the zoom ladder with its scale, the minimap, and the page styles.
import {
	ArrowUturnLeftIcon,
	ChevronDownIcon,
	MinusIcon,
	PlusIcon,
} from "@heroicons/react/24/solid"
import { type RefObject, useEffect, useRef, useState } from "react"
import { FilterChips, WhoNote } from "~/ui/prototype-rec-explorer-2/kit2"
import type { Ex } from "~/ui/prototype-rec-explorer-2/useExplorer2"
import { type World, alpha, shapeOf } from "./geo"
import type { MapHandle } from "./MapCanvas"
import { GENERATED_CSS_4 } from "./generated-css"
import type { Ex4, Step } from "./useExplorer4"
import { GROUPINGS, type GroupId } from "./wire4"

export const TMDB = "https://image.tmdb.org/t/p"
// Round 2's filter chips and who-note read the same fields this page's state has.
export const as2 = (ex: Ex4) => ex as unknown as Ex

/** Lay the map out by: a clear segmented control. */
export function GroupBar({ ex, hide = [] }: { ex: Ex4; hide?: GroupId[] }) {
	return (
		<div role="radiogroup" aria-label="Lay the map out by" className="rx4-groups rx4-noscroll">
			{GROUPINGS.filter((g) => !hide.includes(g.id)).map((g) => (
				<button
					key={g.id}
					type="button"
					role="radio"
					aria-checked={ex.group === g.id}
					onClick={() => ex.setGroup(g.id)}
					className={`rx4-group ${ex.group === g.id ? "rx4-group-on" : ""}`}
				>
					{g.name}
				</button>
			))}
		</div>
	)
}

/** The top of the page: name, grouping, filters, who it's for. */
export function Top({ ex, hide, history }: { ex: Ex4; hide?: GroupId[]; history: React.ReactNode }) {
	return (
		<header className="rx4-top">
			<div className="rx4-top-row">
				<h1 className="rx4-display rx4-h1">Explore</h1>
				<GroupBar ex={ex} hide={hide} />
			</div>
			<div className="rx4-top-row rx4-top-row2">
				{history}
				<FilterChips ex={as2(ex)} className="rx4-filters" />
			</div>
			<WhoNote
				ex={as2(ex)}
				className="rx4-who"
				extra="Scroll or pinch to zoom, drag to move, tap a region to fly in, tap or zoom into a poster to open it."
			/>
		</header>
	)
}

const stepThumb = (s: Step) =>
	s.title?.p ? (
		<img src={`${TMDB}/w92${s.title.p}`} alt="" className="rx4-crumb-img" />
	) : null

/** The last two steps, a back button, and the whole history in a dropdown. */
export function History({ steps, onPick }: { steps: Step[]; onPick: (s: Step) => void }) {
	const [open, setOpen] = useState(false)
	const box = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const off = (e: PointerEvent) => {
			if (!box.current?.contains(e.target as Node)) setOpen(false)
		}
		const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		window.addEventListener("pointerdown", off)
		window.addEventListener("keydown", esc)
		return () => {
			window.removeEventListener("pointerdown", off)
			window.removeEventListener("keydown", esc)
		}
	}, [open])
	const cur = steps[steps.length - 1]
	const prev = steps[steps.length - 2]
	return (
		<div ref={box} className="rx4-history">
			<nav aria-label="Where you've been" className="rx4-crumbs">
				<button
					type="button"
					disabled={!prev}
					onClick={() => prev && onPick(prev)}
					aria-label={prev ? `Back to ${prev.label}` : "Back"}
					className="rx4-back"
				>
					<ArrowUturnLeftIcon className="rx4-i" />
				</button>
				{prev && (
					<>
						<button type="button" onClick={() => onPick(prev)} className="rx4-crumb" title={prev.label}>
							{stepThumb(prev)}
							<span className="rx4-crumb-t">{prev.label}</span>
						</button>
						<span className="rx4-sep" aria-hidden>
							›
						</span>
					</>
				)}
				<span className="rx4-crumb rx4-crumb-on" aria-current="step" title={cur?.label}>
					{cur && stepThumb(cur)}
					<span className="rx4-crumb-t">{cur?.label}</span>
				</span>
				<button
					type="button"
					aria-expanded={open}
					aria-label="All steps"
					onClick={() => setOpen((o) => !o)}
					className="rx4-hist-btn"
				>
					<span className="rx4-hist-n">{steps.length}</span>
					<ChevronDownIcon className="rx4-i-s" />
				</button>
			</nav>
			{open && (
				<ol className="rx4-hist-menu" aria-label="History, newest first">
					{[...steps].reverse().map((s, n) => (
						<li key={s.id}>
							<button
								type="button"
								onClick={() => {
									setOpen(false)
									if (n) onPick(s)
								}}
								className={`rx4-hist-item ${n === 0 ? "rx4-hist-cur" : ""}`}
							>
								{s.title?.p ? (
									<img src={`${TMDB}/w92${s.title.p}`} alt="" className="rx4-hist-img" />
								) : (
									<span className="rx4-hist-kind">{s.kind === "region" ? "Region" : "Map"}</span>
								)}
								<span className="rx4-hist-t">{s.label}</span>
								{n === 0 && <span className="rx4-hist-here">You're here</span>}
							</button>
						</li>
					))}
				</ol>
			)}
		</div>
	)
}

/** Zoom buttons with a scale: where you are between the whole map, one region, and one title. */
export function Ladder({
	map,
	closeUp,
	onStop,
}: {
	map: RefObject<MapHandle | null>
	closeUp: boolean
	onStop: (stop: "all" | "region" | "title") => void
}) {
	const [pos, setPos] = useState({ k: 0, where: "" })
	useEffect(() => {
		const m = map.current
		if (!m) return
		let raf = 0
		const update = () => {
			if (raf) return
			raf = requestAnimationFrame(() => {
				raf = 0
				const v = m.view()
				// 0 = the whole map, 0.5 = one region, 1 = deepest map zoom (the close-up sits past it).
				const l = Math.log(v.cam.s / v.fit)
				const a = Math.log(v.region / v.fit)
				const b = Math.log(v.max / v.fit)
				const k = l <= a ? (0.5 * l) / Math.max(a, 1e-3) : 0.5 + (0.5 * (l - a)) / Math.max(b - a, 1e-3)
				const where = v.focus?.region.name ?? ""
				setPos((p) => {
					const nk = Math.round(Math.max(0, Math.min(1, k)) * 50) / 50
					return p.k === nk && p.where === where ? p : { k: nk, where }
				})
			})
		}
		update()
		const off = m.subscribe(update)
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [map.current])
	const k = closeUp ? 1.18 : pos.k
	const stops: { id: "all" | "region" | "title"; name: string; at: number }[] = [
		{ id: "title", name: "Title", at: 1.18 },
		{ id: "region", name: pos.where && pos.k >= 0.25 ? pos.where : "Region", at: 0.5 },
		{ id: "all", name: "All", at: 0 },
	]
	return (
		<div className="rx4-ladder" aria-label="Zoom">
			<button
				type="button"
				aria-label="Zoom in"
				className="rx4-zbtn"
				onClick={() => (pos.k >= 0.98 ? onStop("title") : map.current?.zoomBy(1.5))}
			>
				<PlusIcon className="rx4-i" />
			</button>
			<div className="rx4-scale">
				<div className="rx4-rail" />
				<div className="rx4-mark" style={{ "--k": k / 1.18 } as React.CSSProperties} />
				{stops.map((s) => (
					<button
						key={s.id}
						type="button"
						onClick={() => onStop(s.id)}
						className={`rx4-stop ${Math.abs(k - s.at) < 0.2 ? "rx4-stop-on" : ""}`}
						style={{ "--k": s.at / 1.18 } as React.CSSProperties}
						title={`Zoom to ${s.name}`}
					>
						<span className="rx4-stop-dot" />
						<span className="rx4-stop-t">{s.name}</span>
					</button>
				))}
			</div>
			<button
				type="button"
				aria-label="Zoom out"
				className="rx4-zbtn"
				onClick={() => (closeUp ? onStop("region") : map.current?.zoomBy(1 / 1.5))}
			>
				<MinusIcon className="rx4-i" />
			</button>
		</div>
	)
}

/** The whole map small, with the part on screen outlined. Tap to go there. */
export function Minimap({
	map,
	world,
	current,
	onGo,
}: {
	map: RefObject<MapHandle | null>
	world: World
	current: string | null
	onGo: (x: number, y: number) => void
}) {
	const cv = useRef<HTMLCanvasElement>(null)
	const [size, setSize] = useState({ w: 180, h: 110 })
	useEffect(() => {
		const small = window.innerWidth < 640
		const maxW = small ? 112 : 196
		const maxH = small ? 84 : 128
		const s = Math.min(maxW / world.w, maxH / world.h)
		setSize({ w: Math.round(world.w * s), h: Math.round(world.h * s) })
	}, [world])
	useEffect(() => {
		const c = cv.current
		const m = map.current
		if (!c || !m) return
		const dpr = Math.min(2, window.devicePixelRatio || 1)
		c.width = size.w * dpr
		c.height = size.h * dpr
		const g = c.getContext("2d") as CanvasRenderingContext2D
		const s = size.w / world.w
		let raf = 0
		const draw = () => {
			raf = 0
			g.setTransform(dpr, 0, 0, dpr, 0, 0)
			g.clearRect(0, 0, size.w, size.h)
			g.setTransform(dpr * s, 0, 0, dpr * s, 0, 0)
			for (const cell of world.cells) {
				const p = shapeOf(cell)
				g.fillStyle = cell.id === current ? cell.region.color : cell.fill
				g.fill(p)
				if (cell.id === current) {
					g.lineWidth = 3 / s
					g.strokeStyle = "#fbbf24"
					g.stroke(p)
				}
			}
			const v = m.view()
			g.setTransform(dpr, 0, 0, dpr, 0, 0)
			const x = (v.cam.x - v.cam.w / 2 / v.cam.s) * s
			const y = (v.cam.y - v.cam.h / 2 / v.cam.s) * s
			const w = (v.cam.w / v.cam.s) * s
			const h = (v.cam.h / v.cam.s) * s
			if (w < size.w * 0.97 || h < size.h * 0.97) {
				g.strokeStyle = "#fff"
				g.lineWidth = 1.5
				g.fillStyle = "rgba(255,255,255,.08)"
				g.fillRect(x, y, w, h)
				g.strokeRect(x, y, w, h)
			}
		}
		const kick = () => {
			if (!raf) raf = requestAnimationFrame(draw)
		}
		kick()
		const off = m.subscribe(kick)
		return () => {
			off()
			cancelAnimationFrame(raf)
		}
	}, [world, size, current, map.current])
	return (
		<button
			type="button"
			className="rx4-mini"
			aria-label="Minimap: tap to go there"
			onClick={(e) => {
				const r = e.currentTarget.getBoundingClientRect()
				onGo(((e.clientX - r.left) / r.width) * world.w, ((e.clientY - r.top) / r.height) * world.h)
			}}
		>
			<canvas ref={cv} style={{ width: size.w, height: size.h, display: "block" }} />
		</button>
	)
}

export function Toast4({ ex }: { ex: Ex4 }) {
	if (!ex.toast) return null
	return (
		<div role="status" className="rx4-toast">
			{ex.toast}
		</div>
	)
}

export const swatch = (c: string) => ({ background: c, boxShadow: `0 0 0 2px ${alpha(c, 0.35)}` })

// The dev server's stylesheet can lag behind new files, so this page's layout lives here.
const CSS4 = `
.rx4-stage{position:relative;height:calc(100vh - 8rem);overflow:hidden;background:radial-gradient(ellipse at 50% 40%,#1c1917 0%,#0c0a09 58%,#000 100%);color:#fff;outline:none}
@media (min-width:1024px){.rx4-stage{height:calc(100vh - 4rem)}}
.rx4-canvas{position:absolute;inset:0;width:100%;height:100%}
.rx4-display{font-family:'Big Shoulders Display','Gabarito',system-ui,sans-serif;letter-spacing:.01em}
.rx4-noscroll{scrollbar-width:none}.rx4-noscroll::-webkit-scrollbar{display:none}
.rx4-i{width:1.25rem;height:1.25rem}.rx4-i-s{width:1rem;height:1rem}
.rx4-top{position:absolute;left:0;right:0;top:0;z-index:20;padding:.75rem 1rem 2.25rem;background:linear-gradient(to bottom,rgba(0,0,0,.9),rgba(0,0,0,.55) 65%,transparent);pointer-events:none}
.rx4-top>*{pointer-events:auto}
@media (min-width:768px){.rx4-top{padding:1rem 2rem 2.5rem}}
.rx4-top-row{display:flex;align-items:center;gap:.75rem;min-width:0}
.rx4-top-row2{margin-top:.6rem;flex-wrap:wrap;gap:.5rem .75rem}
.rx4-h1{font-size:2.6rem;font-weight:900;line-height:1;color:#fbbf24;flex:none}
@media (max-width:767px){.rx4-h1{display:none}}
.rx4-groups{display:flex;gap:.25rem;overflow-x:auto;padding:.25rem;border-radius:999px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.14);min-width:0;max-width:100%}
.rx4-group{flex:none;height:2.5rem;padding:0 1rem;border-radius:999px;font-weight:800;font-size:.95rem;color:#e7e5e4;white-space:nowrap;transition:background .15s,color .15s}
.rx4-group:hover{background:rgba(255,255,255,.1)}
.rx4-group-on,.rx4-group-on:hover{background:#fbbf24;color:#0c0a09}
.rx4-group:focus-visible,.rx4-zbtn:focus-visible,.rx4-stop:focus-visible,.rx4-back:focus-visible,.rx4-crumb:focus-visible,.rx4-hist-btn:focus-visible,.rx4-mini:focus-visible,.rx4-btn:focus-visible,.rx4-door:focus-visible,.rx4-thumb:focus-visible{outline:2px solid #fff;outline-offset:2px}
.rx4-who{margin-top:.35rem}
@media (max-width:767px){.rx4-who{display:none}}
.rx4-history{position:relative}
.rx4-crumbs{display:flex;align-items:center;gap:.25rem;height:2.75rem;padding:0 .25rem;border-radius:999px;background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.14);max-width:100%;backdrop-filter:blur(6px)}
.rx4-back{display:flex;align-items:center;justify-content:center;width:2.25rem;height:2.25rem;border-radius:999px;color:#fde68a;flex:none}
.rx4-back:hover{background:rgba(255,255,255,.12)}.rx4-back:disabled{color:#57534e}
.rx4-crumb{display:flex;align-items:center;gap:.4rem;height:2.25rem;padding:0 .7rem 0 .5rem;border-radius:999px;font-size:.85rem;font-weight:700;color:#d6d3d1;min-width:0;max-width:12rem}
button.rx4-crumb:hover{background:rgba(255,255,255,.1);color:#fff}
.rx4-crumb-on{color:#0c0a09;background:#fbbf24}
.rx4-crumb-t{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rx4-crumb-img{width:1.35rem;height:2rem;border-radius:3px;object-fit:cover;flex:none}
.rx4-sep{color:#78716c;font-weight:700}
@media (max-width:767px){.rx4-crumbs{max-width:calc(100vw - 2rem)}.rx4-crumbs>.rx4-crumb:not(.rx4-crumb-on),.rx4-crumbs>.rx4-sep{display:none}.rx4-crumb{max-width:13rem}}
.rx4-hist-btn{display:flex;align-items:center;gap:.2rem;height:2.25rem;padding:0 .6rem;border-radius:999px;color:#e7e5e4;flex:none}
.rx4-hist-btn:hover{background:rgba(255,255,255,.12)}
.rx4-hist-n{font-size:.75rem;font-weight:800;min-width:1.25rem;height:1.25rem;border-radius:999px;background:rgba(255,255,255,.14);display:inline-flex;align-items:center;justify-content:center;padding:0 .3rem}
.rx4-hist-menu{position:absolute;left:0;top:3.2rem;z-index:40;width:19rem;max-width:calc(100vw - 2rem);max-height:22rem;overflow-y:auto;padding:.35rem;border-radius:1rem;background:rgba(12,10,9,.97);border:1px solid rgba(255,255,255,.14);box-shadow:0 20px 50px rgba(0,0,0,.6)}
.rx4-hist-item{display:flex;align-items:center;gap:.6rem;width:100%;padding:.4rem .5rem;border-radius:.6rem;text-align:left;font-size:.875rem;font-weight:600;color:#e7e5e4}
.rx4-hist-item:hover{background:rgba(255,255,255,.08)}
.rx4-hist-cur{background:rgba(251,191,36,.12);color:#fde68a}
.rx4-hist-img{width:1.6rem;height:2.4rem;border-radius:3px;object-fit:cover;flex:none}
.rx4-hist-kind{width:3.2rem;flex:none;font-size:.7rem;color:#a8a29e;text-align:center}
.rx4-hist-t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rx4-hist-here{font-size:.7rem;color:#fbbf24;flex:none}
.rx4-nav{position:absolute;z-index:35;left:1rem;bottom:5.25rem}
/* Desktop: the minimap sits top right, clear of the map; in the close-up it moves to the corner the layout keeps free. */
@media (min-width:1024px){.rx4-nav{left:auto;bottom:auto;right:1.5rem;top:1rem}.rx4-nav-cu{top:auto;right:auto;left:1.5rem;bottom:1.25rem}}
.rx4-filters{flex:none}
@media (max-width:767px){.rx4-top-row2{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.rx4-top-row2::-webkit-scrollbar{display:none}}
.rx4-mini{display:block;padding:.3rem;border-radius:.7rem;background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(6px)}
.rx4-ladder{position:absolute;z-index:35;right:.75rem;bottom:5.25rem;display:flex;flex-direction:column;align-items:center;gap:.4rem;padding:.35rem;border-radius:999px;background:rgba(0,0,0,.72);border:1px solid rgba(255,255,255,.14);backdrop-filter:blur(6px)}
@media (min-width:1024px){.rx4-ladder{right:1.5rem;bottom:auto;top:50%;transform:translateY(-50%)}}
.rx4-zbtn{display:flex;align-items:center;justify-content:center;width:2.6rem;height:2.6rem;border-radius:999px;color:#fff;background:rgba(255,255,255,.08)}
.rx4-zbtn:hover{background:rgba(255,255,255,.2)}
.rx4-scale{position:relative;width:2.6rem;height:7.5rem}
.rx4-rail{position:absolute;left:50%;top:.4rem;bottom:.4rem;width:2px;margin-left:-1px;background:rgba(255,255,255,.2)}
.rx4-mark{position:absolute;left:50%;bottom:calc(var(--k) * 100%);width:1.1rem;height:1.1rem;margin:0 0 -.55rem -.55rem;border-radius:999px;background:#fbbf24;box-shadow:0 0 0 4px rgba(251,191,36,.25);transition:bottom .12s linear,left .12s linear}
.rx4-stop{position:absolute;left:0;right:0;bottom:calc(var(--k) * 100%);height:1.4rem;margin-bottom:-.7rem;display:flex;align-items:center;justify-content:center}
@media (max-width:1023px){
 .rx4-ladder{flex-direction:row-reverse}
 .rx4-scale{width:5.5rem;height:2.6rem}
 .rx4-rail{left:.5rem;right:.5rem;top:50%;bottom:auto;width:auto;height:2px;margin:-1px 0 0 0}
 .rx4-mark{left:calc(.5rem + var(--k) * (100% - 1rem));bottom:50%}
 .rx4-stop{top:0;bottom:0;left:calc(.5rem + var(--k) * (100% - 1rem));right:auto;width:1.4rem;height:auto;margin:0 0 0 -.7rem}
}
.rx4-stop-dot{width:.45rem;height:.45rem;border-radius:999px;background:rgba(255,255,255,.6)}
.rx4-stop-t{position:absolute;right:3.1rem;white-space:nowrap;font-size:.8rem;font-weight:800;color:#d6d3d1;padding:.15rem .5rem;border-radius:999px;background:rgba(0,0,0,.8);max-width:10rem;overflow:hidden;text-overflow:ellipsis;opacity:0;transition:opacity .15s;pointer-events:none}
.rx4-stop:hover .rx4-stop-t,.rx4-stop-on .rx4-stop-t,.rx4-ladder:hover .rx4-stop-t{opacity:1}
.rx4-stop-on .rx4-stop-t{color:#0c0a09;background:#fbbf24}
@media (max-width:1023px){.rx4-stop-t{display:none}}
.rx4-toast{position:fixed;left:50%;top:5rem;z-index:95;transform:translateX(-50%);border-radius:999px;background:#fff;color:#000;padding:.5rem 1rem;font-size:.875rem;font-weight:700;box-shadow:0 20px 40px rgba(0,0,0,.5);pointer-events:none}
.rx4-loading{position:absolute;left:50%;top:50%;z-index:15;transform:translate(-50%,-50%);padding:.6rem 1.1rem;border-radius:999px;background:rgba(0,0,0,.8);font-weight:700;font-size:.9rem;pointer-events:none}
.rx4-hint{position:absolute;z-index:21;left:50%;transform:translateX(-50%);bottom:1.25rem;font-size:.8rem;color:#a8a29e;pointer-events:none;white-space:nowrap}
@media (max-width:1023px){.rx4-hint{display:none}}
/* ---- close-up ---- */
.rx4-close{position:absolute;inset:0;z-index:30;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;background:#0c0a09;animation:rx4fade .35s ease both}
@keyframes rx4fade{from{opacity:0}to{opacity:1}}
.rx4-bd{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center 20%;opacity:.5;pointer-events:none}
.rx4-veil-x{position:absolute;inset:0;background:linear-gradient(to right,#0c0a09 0%,rgba(12,10,9,.88) 38%,rgba(12,10,9,.25) 100%);pointer-events:none}
.rx4-veil-y{position:absolute;inset:auto 0 0 0;height:55%;background:linear-gradient(to bottom,transparent,rgba(12,10,9,.9) 60%,#0c0a09);pointer-events:none}
@media (max-width:767px){.rx4-bd{height:48%;opacity:.55}.rx4-veil-x{background:linear-gradient(to bottom,rgba(12,10,9,.1),rgba(12,10,9,.6) 30%,#0c0a09 48%)}}
.rx4-in{animation:rx4in .45s cubic-bezier(.2,.7,.2,1) both}
.rx4-in-2{animation-delay:.06s}.rx4-in-3{animation-delay:.12s}
@keyframes rx4in{from{opacity:0;transform:translate(var(--dx,0),var(--dy,12px))}to{opacity:1;transform:none}}
.rx4-title{font-size:clamp(2.6rem,6.2vw,5.6rem);font-weight:900;line-height:.92;color:#fff;text-wrap:balance}
.rx4-chip{display:inline-flex;align-items:center;gap:.5rem;height:2.5rem;padding:0 .35rem 0 .9rem;border-radius:999px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.16);font-weight:800;font-size:.95rem}
.rx4-dot{width:.8rem;height:.8rem;border-radius:999px;flex:none}
.rx4-of{font-weight:600;color:#a8a29e;font-size:.85rem;margin-left:.1rem;white-space:nowrap}
.rx4-arrow{display:flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:999px;color:#fff;background:rgba(255,255,255,.1)}
.rx4-arrow:hover{background:rgba(255,255,255,.25)}.rx4-arrow:disabled{opacity:.3}
.rx4-btn{display:inline-flex;align-items:center;gap:.5rem;height:3rem;padding:0 1.2rem;border-radius:999px;font-weight:800;font-size:1rem}
.rx4-btn-gold{background:#fbbf24;color:#0c0a09}.rx4-btn-gold:hover{background:#fcd34d}
.rx4-btn-line{border:2px solid rgba(255,255,255,.25);color:#f5f5f4}.rx4-btn-line:hover{border-color:rgba(255,255,255,.55)}
.rx4-door{display:flex;align-items:center;gap:.7rem;min-width:0;padding:.5rem .8rem .5rem .5rem;border-radius:1rem;background:rgba(0,0,0,.62);border:1px solid rgba(255,255,255,.14);text-align:left;transition:border-color .15s,background .15s;backdrop-filter:blur(6px)}
.rx4-door:hover{border-color:rgba(251,191,36,.7);background:rgba(120,53,15,.35)}
.rx4-door-img{width:2.6rem;height:3.9rem;border-radius:4px;object-fit:cover;flex:none;background:#292524}
.rx4-door-dir{font-size:1.4rem;font-weight:900;color:#fbbf24;flex:none;width:1.4rem;text-align:center}
.rx4-door-to{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-family:'Big Shoulders Display','Gabarito',system-ui,sans-serif;font-weight:900;font-size:1.3rem;line-height:1.05}
.rx4-door-t{display:block;font-size:.78rem;color:#d6d3d1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rx4-thumb{position:relative;flex:none;border-radius:6px;overflow:hidden;background:#292524;aspect-ratio:2/3;transition:transform .15s}
.rx4-thumb:hover{transform:translateY(-3px)}
.rx4-thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.rx4-thumb-on{box-shadow:0 0 0 3px #fbbf24}
.rx4-poster{border-radius:10px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.7),0 0 0 1px rgba(255,255,255,.08);background:#1c1917;aspect-ratio:2/3;transform-origin:0 0}
.rx4-poster img{width:100%;height:100%;object-fit:cover;display:block}
.rx4-reel{display:flex;gap:.6rem;overflow-x:auto;padding:.5rem .25rem 1rem;scroll-snap-type:x proximity}
.rx4-reel>*{scroll-snap-align:center}
.rx4-orbit-line{stroke:rgba(251,191,36,.35);stroke-width:1.5}
@media (prefers-reduced-motion:reduce){.rx4-in,.rx4-close{animation:none}.rx4-mark{transition:none}}
`
export function Styles4() {
	return <style dangerouslySetInnerHTML={{ __html: CSS4 + GENERATED_CSS_4 }} />
}
