// PROTOTYPE - throwaway. The zoomed-in end of the round-4 map (#180): one title, cinematic, as round 3's leap drew it,
// with controls that say where they go. Every mode has: previous and next in this region, a door toward each
// neighboring region showing the exact title it lands on, Want to See and Seen it, and the way back to the map.
// Modes differ in what surrounds the title:
//   single        the next few titles of the region under it;
//   neighborhood  the six titles closest to it in the title analysis, orbiting it;
//   reel          the whole region as a filmstrip you scrub through;
//   rings         a cross of doors: closer to your taste above, further out below, the next sectors either side.
import {
	ArrowLeftIcon,
	ArrowTopRightOnSquareIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { Score } from "~/server/scores.server"
import { asPool } from "~/ui/prototype-rec-explorer-3/kit3"
import { ActionButton } from "~/ui/prototype-rec-explorer/kit"
import { HEAT } from "~/ui/prototype-rec-explorer-2/Stage"
import { Ring, ServiceLogos, href } from "~/ui/prototype-rec-taste/kit"
import { getVibeColorValue } from "~/utils/ratings"
import { TMDB, swatch } from "./chrome"
import { type Cell, type Dir, type Door, type Rect, type World, doorsOf } from "./geo"
import type { Ex4 } from "./useExplorer4"
import { BANDS, type PeekInfo4, type StepRes, type W } from "./wire4"

export type CloseMode = "single" | "neighborhood" | "reel" | "rings"
export type Go = (it: W, cell: Cell, how: "browse" | "door" | "near", dir: Dir | null) => void

const ARROW: Record<Dir, string> = { n: "↑", e: "→", s: "↓", w: "←" }
const SLIDE: Record<Dir, [string, string]> = {
	n: ["0px", "-28px"],
	s: ["0px", "28px"],
	e: ["44px", "0px"],
	w: ["-44px", "0px"],
}

// Region lists, kept per grouping, filters, and profile for the page's life.
const LISTS = new Map<string, Promise<{ items: W[]; count: number }>>()

type Landed = Door & { item: W | null }

export function CloseUp({
	ex,
	mode,
	it,
	cell,
	world,
	from,
	dir,
	trail,
	history,
	onGo,
	onClose,
}: {
	ex: Ex4
	mode: CloseMode
	it: W
	cell: Cell
	world: World
	from: Rect | null
	dir: Dir | null
	trail: string[]
	history: React.ReactNode
	onGo: Go
	onClose: () => void
}) {
	const [list, setList] = useState<{ items: W[]; count: number } | null>(null)
	const [doors, setDoors] = useState<Landed[] | null>(null)
	const [near, setNear] = useState<W[] | null>(null)
	const [info, setInfo] = useState<PeekInfo4 | null>(null)

	// The region's titles, for previous and next.
	useEffect(() => {
		let live = true
		const key = `${ex.group}|${ex.filterKey}|${ex.who.mode}|${cell.id}`
		let p = LISTS.get(key)
		if (!p) {
			p = ex.api<{ items: W[]; count: number }>("region", {
				id: cell.region.id,
				...(cell.band != null ? { band: cell.band } : {}),
			})
			p.catch(() => LISTS.delete(key))
			LISTS.set(key, p)
		}
		p.then((x) => live && setList(x)).catch(() => {})
		return () => {
			live = false
		}
	}, [cell.id, ex.group, ex.filterKey])

	// Where each door lands, and (neighborhood) the closest titles; both from this title.
	useEffect(() => {
		let live = true
		setDoors(null)
		setNear(null)
		setInfo(null)
		const ds = doorsOf(world, cell)
		ex.api<StepRes>("step", { k: it.k, to: ds.map((d) => d.cell.id).join(","), shown: trail.join(",") })
			.then((r) => {
				if (!live) return
				setDoors(ds.map((d, j) => ({ ...d, item: r.steps[j]?.item ?? null })))
			})
			.catch(() => live && setDoors([]))
		if (mode === "neighborhood")
			ex.api<{ items: W[] }>("near", {
				k: it.k,
				shown: trail.join(","),
				...(cell.band != null ? { band: cell.band } : {}),
			})
				.then((r) => live && setNear(r.items))
				.catch(() => live && setNear([]))
		ex.peekInfo(it.k).then((x) => live && setInfo(x))
		return () => {
			live = false
		}
	}, [it.k, cell.id, world])

	const items = useMemo(() => {
		if (!list) return [it]
		const xs = list.items.filter((x) => x.k === it.k || ex.pass(x))
		return xs.some((x) => x.k === it.k) ? xs : [it, ...xs]
	}, [list, it.k, ex.pass])
	const at = items.findIndex((x) => x.k === it.k)
	const prev = at > 0 ? items[at - 1] : null
	const next = at >= 0 && at < items.length - 1 ? items[at + 1] : null
	const door = (d: Dir) => doors?.find((x) => x.dir === d && x.item)

	// Keyboard: left and right browse the region, up and down (and shift with left or right) take a door.
	const keys = useRef({ prev, next, door, onClose })
	keys.current = { prev, next, door, onClose }
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement
			if (t.closest?.("input, textarea, [contenteditable]")) return
			const k = keys.current
			let d: Dir | null = null
			if (e.key === "Escape") {
				k.onClose()
				return
			}
			if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				e.stopPropagation()
				e.preventDefault()
				if (e.shiftKey) d = e.key === "ArrowLeft" ? "w" : "e"
				else {
					const x = e.key === "ArrowLeft" ? k.prev : k.next
					if (x) onGo(x, cell, "browse", e.key === "ArrowLeft" ? "w" : "e")
					return
				}
			}
			if (e.key === "ArrowUp") d = "n"
			if (e.key === "ArrowDown") d = "s"
			if (!d) return
			e.preventDefault()
			e.stopPropagation()
			const o = k.door(d)
			if (o?.item) onGo(o.item, o.cell, "door", d)
		}
		window.addEventListener("keydown", onKey, true)
		return () => window.removeEventListener("keydown", onKey, true)
	}, [cell.id])

	// Zooming out of the close-up (wheel down past its end, or a pinch) goes back to the map, as zooming in opened it.
	const root = useRef<HTMLElement>(null)
	useEffect(() => {
		const el = root.current
		if (!el) return
		let out = 0
		let pinch0 = 0
		const wheel = (e: WheelEvent) => {
			const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
			if (e.deltaY > 0 && atEnd) {
				e.preventDefault()
				out += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
				if (out > 260) keys.current.onClose()
			} else if (e.deltaY < 0) {
				out = 0
				if (el.scrollTop <= 0) e.preventDefault()
			}
		}
		const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
		const tstart = (e: TouchEvent) => {
			if (e.touches.length === 2) pinch0 = dist(e.touches)
		}
		const tmove = (e: TouchEvent) => {
			if (e.touches.length === 2 && pinch0 && dist(e.touches) / pinch0 < 0.7) {
				pinch0 = 0
				keys.current.onClose()
			}
		}
		el.addEventListener("wheel", wheel, { passive: false })
		el.addEventListener("touchstart", tstart, { passive: true })
		el.addEventListener("touchmove", tmove, { passive: true })
		return () => {
			el.removeEventListener("wheel", wheel)
			el.removeEventListener("touchstart", tstart)
			el.removeEventListener("touchmove", tmove)
		}
	}, [])

	// The poster flies in from where it sat on the map.
	const hero = useRef<HTMLDivElement>(null)
	const flew = useRef(false)
	useLayoutEffect(() => {
		const el = hero.current
		if (!el || !from || flew.current) return
		flew.current = true
		const stage = el.closest(".rx4-stage")?.getBoundingClientRect()
		const r = el.getBoundingClientRect()
		if (!stage || !r.width) return
		const tx = from.x + stage.left - r.left
		const ty = from.y + stage.top - r.top
		const s = from.w / r.width
		el.style.transition = "none"
		el.style.transform = `translate(${tx}px,${ty}px) scale(${s})`
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				el.style.transition = "transform .55s cubic-bezier(.2,.7,.2,1)"
				el.style.transform = "none"
			})
		})
	}, [])

	const pi = asPool(it)
	const slide = dir ? SLIDE[dir] : ["0px", "12px"]
	const inStyle = { "--dx": slide[0], "--dy": slide[1] } as React.CSSProperties
	const where = cell.band != null ? `${cell.region.name}, ${BANDS[cell.band].name.toLowerCase()}` : cell.region.name

	const chip = (
		<div className="rx4-chip">
			<span className="rx4-dot" style={swatch(cell.region.color)} />
			<span className="truncate">{where}</span>
			<span className="rx4-of">
				{at >= 0 ? at + 1 : 1} of {(list?.count ?? cell.count).toLocaleString("en")}
			</span>
			<button
				type="button"
				className="rx4-arrow"
				disabled={!prev}
				aria-label={prev ? `Previous in ${cell.region.name}: ${prev.t}` : "Previous"}
				onClick={() => prev && onGo(prev, cell, "browse", "w")}
			>
				<ChevronLeftIcon className="rx4-i-s" />
			</button>
			<button
				type="button"
				className="rx4-arrow"
				disabled={!next}
				aria-label={next ? `Next in ${cell.region.name}: ${next.t}` : "Next"}
				onClick={() => next && onGo(next, cell, "browse", "e")}
			>
				<ChevronRightIcon className="rx4-i-s" />
			</button>
		</div>
	)
	const backBtn = (
		<>
			<button type="button" onClick={onClose} className="rx4-btn rx4-btn-line" style={{ height: "2.75rem", padding: "0 1rem", fontSize: ".9rem" }}>
				<ArrowLeftIcon className="rx4-i-s" />
				Map
			</button>
			{history}
		</>
	)

	const text = (
		<div key={it.k} className="rx4-in" style={inStyle}>
			<h2 className="rx4-display rx4-title">{it.t}</h2>
			<p className="rx4-meta mt-3 text-base text-stone-300">
				{it.yr ? `${it.yr} ` : ""}
				{pi.type === "show" ? "series" : "film"}
				{it.g.length ? `, ${it.g.join(", ").toLowerCase()}` : ""}
				{info?.people.length ? `. ${info.role} ${info.people.join(" and ")}` : ""}
			</p>
			<div className="mt-4 flex items-center gap-3">
				<Ring item={pi} size={52} />
				{it.r ? (
					<span className="text-xl font-bold" style={{ color: getVibeColorValue(it.r as Score) }}>
						You rated it {it.r}
					</span>
				) : (
					<span className="rx4-display rx4-match" style={{ color: HEAT[it.m] ?? "#fbbf24" }}>
						{it.m}% <span className="rx4-match-l">your taste</span>
					</span>
				)}
			</div>
			<p className="rx4-why mt-3 min-h-12 max-w-xl text-lg text-stone-200">{info?.why ?? " "}</p>
			<div className="mt-3">
				<ServiceLogos item={pi} services={ex.services} size="w-8 h-8" />
			</div>
			<div className="mt-5 flex flex-wrap items-center gap-2">
				<div className="rx4-act rx4-act-w">
					<ActionButton kind="want" active={!!(it.f & 4)} onClick={() => ex.actions.want(it)} />
				</div>
				<div className="rx4-act">
					<ActionButton kind="seen" active={!!(it.f & 2)} onClick={() => ex.actions.seen(it)} />
				</div>
				<Link to={href(pi)} className="rx4-btn text-stone-300 hover:text-white" style={{ height: "2.75rem", fontSize: ".9rem" }}>
					Details
					<ArrowTopRightOnSquareIcon className="rx4-i-s" />
				</Link>
			</div>
		</div>
	)

	const poster = (w: string) => (
		<div ref={hero} className="rx4-poster" style={{ width: w }}>
			{it.p && <img key={it.k} src={`${TMDB}/w500${it.p}`} alt={`Poster for ${it.t}`} className="rx4-in" style={inStyle} />}
		</div>
	)

	const doorBtn = (d: Landed, compact = false) =>
		d.item && (
			<button
				key={d.dir}
				type="button"
				onClick={() => d.item && onGo(d.item, d.cell, "door", d.dir)}
				className="rx4-door w-full"
				aria-label={`Step ${d.label}: ${d.item.t}`}
				title={`${d.label}: ${d.item.t}`}
			>
				<span className="rx4-door-dir" aria-hidden>
					{ARROW[d.dir]}
				</span>
				{!compact && <img src={`${TMDB}/w154${d.item.p}`} alt="" className="rx4-door-img" />}
				<span className="min-w-0 flex-1">
					<span className="rx4-door-to" style={{ color: d.cell.region.color }}>
						{d.label}
					</span>
					<span className="rx4-door-t">
						{mode === "rings" && d.dir !== "e" && d.dir !== "w" ? `${d.cell.region.name}: ` : ""}
						{d.item.t}
					</span>
				</span>
			</button>
		)
	const doorList = (
		<div className="flex flex-col gap-2">
			<p className="text-sm font-bold text-stone-400">Step toward</p>
			{doors === null ? (
				<p className="text-sm text-stone-500">Finding the way…</p>
			) : (
				(["n", "e", "s", "w"] as Dir[]).map((d) => {
					const o = doors.find((x) => x.dir === d)
					return o ? doorBtn(o) : null
				})
			)}
		</div>
	)
	const thumb = (x: W, onClick: () => void, size: string, on = false) => (
		<button
			key={x.k}
			type="button"
			onClick={onClick}
			className={`rx4-thumb ${on ? "rx4-thumb-on" : ""}`}
			style={{ width: size }}
			title={`${x.t}, ${x.m}% your taste`}
			aria-label={`${x.t}, ${x.m}% your taste`}
		>
			{x.p && <img src={`${TMDB}/w154${x.p}`} alt="" loading="lazy" />}
		</button>
	)

	// ------------------------------------------------------------ modes

	let body: React.ReactNode
	if (mode === "reel") {
		body = <Reel items={items} at={at} cell={cell} onGo={onGo} thumb={thumb} chip={chip} backBtn={backBtn} text={text} doors={doors} doorBtn={doorBtn} />
	} else if (mode === "neighborhood") {
		body = (
			<div className="rx4-cu">
				<div className="rx4-cu-text">
					<div className="flex flex-wrap items-center gap-2">
						{backBtn}
						{chip}
					</div>
					<div className="mt-5">{text}</div>
				</div>
				<div className="rx4-cu-mid">
					<Orbit hero={poster("100%")} near={near} onPick={(x) => onGo(x, cell, "near", null)} />
				</div>
				<div className="rx4-cu-side">{doorList}</div>
			</div>
		)
	} else if (mode === "rings") {
		const n = door("n")
		const s = door("s")
		const e = door("e")
		const w = door("w")
		body = (
			<div className="rx4-cu rx4-cu-rings">
				<div className="rx4-cu-text">
					<div className="flex flex-wrap items-center gap-2">
						{backBtn}
						{chip}
					</div>
					<div className="mt-5">{text}</div>
				</div>
				<div className="rx4-cross">
					<div className="rx4-cross-n">{n ? doorBtn(n) : <Edge text={cell.band === 0 ? "You're at the center of your taste" : ""} />}</div>
					<div className="rx4-cross-w">{w && doorBtn(w)}</div>
					<div className="rx4-cross-c">{poster("100%")}</div>
					<div className="rx4-cross-e">{e && doorBtn(e)}</div>
					<div className="rx4-cross-s">{s ? doorBtn(s) : <Edge text={cell.band === 2 ? "The far edge of the map" : ""} />}</div>
				</div>
			</div>
		)
	} else {
		body = (
			<div className="rx4-cu">
				<div className="rx4-cu-text">
					<div className="flex flex-wrap items-center gap-2">
						{backBtn}
						{chip}
					</div>
					<div className="mt-5">{text}</div>
				</div>
				<div className="rx4-cu-mid rx4-cu-poster">{poster("100%")}</div>
				<div className="rx4-cu-side">{doorList}</div>
				<div className="rx4-cu-strip">
					<p className="mb-2 text-sm font-bold text-stone-400">Next in {cell.region.name}</p>
					<div className="flex gap-2 overflow-x-auto rx4-noscroll">
						{items.slice(at + 1, at + 9).map((x) => thumb(x, () => onGo(x, cell, "browse", "e"), "4.6rem"))}
					</div>
				</div>
			</div>
		)
	}

	return (
		<section ref={root} className="rx4-close" aria-label={`${it.t}, close-up`}>
			{it.b && <img key={it.b} src={`${TMDB}/w1280${it.b}`} alt="" className="rx4-bd rx4-in" style={{ ...inStyle, opacity: mode === "reel" ? 0.62 : undefined }} />}
			<div className="rx4-veil-x" />
			<div className="rx4-veil-y" />
			{body}
			<style dangerouslySetInnerHTML={{ __html: CU_CSS }} />
		</section>
	)
}

function Edge({ text }: { text: string }) {
	if (!text) return null
	return <p className="py-3 text-center text-sm text-stone-400">{text}</p>
}

/** The closest titles around the one you're on, like a small map of its neighborhood. */
function Orbit({ hero, near, onPick }: { hero: React.ReactNode; near: W[] | null; onPick: (w: W) => void }) {
	const xs = near ?? []
	return (
		<div className="rx4-orbit">
			<svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
				{xs.map((x, j) => {
					const a = -Math.PI / 2 + (j / Math.max(1, xs.length)) * Math.PI * 2
					return <line key={x.k} x1="50" y1="50" x2={50 + Math.cos(a) * 40} y2={50 + Math.sin(a) * 40} className="rx4-orbit-line" />
				})}
			</svg>
			<div className="rx4-orbit-hero">{hero}</div>
			{xs.map((x, j) => {
				const a = -Math.PI / 2 + (j / Math.max(1, xs.length)) * Math.PI * 2
				return (
					<button
						key={x.k}
						type="button"
						onClick={() => onPick(x)}
						className="rx4-orbit-sat rx4-in"
						style={{ left: `${50 + Math.cos(a) * 40}%`, top: `${50 + Math.sin(a) * 40}%`, animationDelay: `${0.05 * j}s` }}
						aria-label={`Close to it: ${x.t}, ${x.m}% your taste`}
					>
						<span className="rx4-thumb block" style={{ width: "100%" }}>
							{x.p && <img src={`${TMDB}/w154${x.p}`} alt="" />}
						</span>
						<span className="rx4-orbit-t">{x.t}</span>
					</button>
				)
			})}
			{near === null && <p className="rx4-orbit-wait">Finding its neighbors…</p>}
		</div>
	)
}

/** The whole region as a filmstrip; the current title is centered and larger. */
function Reel({
	items,
	at,
	cell,
	onGo,
	thumb,
	chip,
	backBtn,
	text,
	doors,
	doorBtn,
}: {
	items: W[]
	at: number
	cell: Cell
	onGo: Go
	thumb: (x: W, onClick: () => void, size: string, on?: boolean) => React.ReactNode
	chip: React.ReactNode
	backBtn: React.ReactNode
	text: React.ReactNode
	doors: Landed[] | null
	doorBtn: (d: Landed, compact?: boolean) => React.ReactNode
}) {
	const strip = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = strip.current?.querySelector(".rx4-thumb-on") as HTMLElement | null
		const box = strip.current
		if (!el || !box) return
		box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" })
	}, [at, items.length])
	const d = (x: Dir) => doors?.find((o) => o.dir === x)
	return (
		<div className="rx4-reelwrap">
			<div className="rx4-reel-top">
				<div className="flex flex-wrap items-center gap-2">
					{backBtn}
					{chip}
				</div>
				<div className="rx4-compass" aria-label="Neighboring regions">
					{(["n", "w", "e", "s"] as Dir[]).map((x) => {
						const o = d(x)
						return (
							<div key={x} className={`rx4-compass-${x}`}>
								{o ? doorBtn(o) : null}
							</div>
						)
					})}
					<div className="rx4-compass-c" style={{ background: cell.fill, borderColor: cell.region.color }}>
						{cell.region.name}
					</div>
				</div>
			</div>
			<div className="rx4-reel-text">{text}</div>
			<div className="rx4-reel-bar">
				<div ref={strip} className="rx4-reel rx4-noscroll">
					{items.map((x, j) => thumb(x, () => j !== at && onGo(x, cell, "browse", j < at ? "w" : "e"), j === at ? "7.2rem" : "5.6rem", j === at))}
				</div>
			</div>
		</div>
	)
}

const CU_CSS = `
.rx4-act{width:9rem}.rx4-act-w{width:11rem}
@media (max-width:767px){
 .rx4-close .rx4-title{font-size:2.5rem}
 .rx4-meta{font-size:.9rem;margin-top:.5rem}
 .rx4-why{font-size:1rem;min-height:0}
 .rx4-match{font-size:2rem}
 .rx4-act,.rx4-act-w{width:auto;flex:1}
 .rx4-close .rx4-btn-line{height:2.5rem!important}
}
.rx4-match{font-size:2.4rem;font-weight:900;line-height:1}
.rx4-match-l{font-size:1.1rem;font-weight:800;color:#d6d3d1;margin-left:.15rem}
.rx4-cu{position:relative;display:grid;grid-template-columns:minmax(0,1fr);gap:1.25rem;padding:1rem 1rem 12rem}
@media (max-width:767px){.rx4-cu-poster{display:none}}
.rx4-cu-strip{min-width:0}
@media (min-width:768px){
 .rx4-cu{grid-template-columns:minmax(0,1fr) minmax(12rem,19rem) 16rem;gap:2rem;padding:1.5rem 6rem 0 2rem;height:100%;align-content:start}
 .rx4-cu-poster{width:auto}
 .rx4-cu-strip{position:absolute;left:17rem;right:6rem;bottom:1.25rem}
 .rx4-cu-text{padding-bottom:15rem}
}
@media (min-width:768px){
 .rx4-cu:has(.rx4-orbit){grid-template-columns:minmax(0,1fr) minmax(20rem,32rem) 15rem}
 .rx4-cu-rings{grid-template-columns:minmax(0,1fr) minmax(26rem,40rem)}
}
.rx4-orbit{position:relative;width:100%;aspect-ratio:1/1;max-width:32rem;margin:0 auto}
.rx4-orbit-hero{position:absolute;left:50%;top:50%;width:29%;transform:translate(-50%,-50%);z-index:2}
.rx4-orbit-sat{position:absolute;width:15%;transform:translate(-50%,-50%);z-index:1;text-align:center}
.rx4-orbit-t{display:block;margin-top:.25rem;font-size:.7rem;font-weight:700;color:#e7e5e4;line-height:1.15;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 1px 3px #000}
.rx4-orbit-wait{position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:.85rem;color:#a8a29e}
.rx4-cross{align-content:center;display:grid;grid-template-columns:minmax(0,1fr) minmax(9rem,13rem) minmax(0,1fr);grid-template-areas:"n n n" "w c e" "s s s";gap:.75rem;align-items:center}
.rx4-cross-n{grid-area:n;justify-self:center;width:min(100%,21rem)}
.rx4-cross-s{grid-area:s;justify-self:center;width:min(100%,21rem)}
.rx4-cross-w{grid-area:w;min-width:0}.rx4-cross-e{grid-area:e;min-width:0}.rx4-cross-c{grid-area:c}
@media (max-width:767px){.rx4-cross{grid-template-columns:minmax(0,1fr) 7rem minmax(0,1fr);gap:.4rem}.rx4-cross .rx4-door{padding:.4rem .5rem}.rx4-cross .rx4-door-to{font-size:1.05rem}}
.rx4-reelwrap{position:relative;display:flex;flex-direction:column;min-height:100%;padding:1rem 1rem 12rem}
.rx4-reel-top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:1rem}
.rx4-reel-text{margin-top:1.25rem;max-width:44rem}
.rx4-reel-bar{margin-top:1.25rem}
@media (min-width:768px){
 .rx4-reelwrap{height:100%;min-height:0;padding:1.5rem 6rem 0 2rem}
 .rx4-reel-text{margin-top:auto;margin-bottom:14rem}
 .rx4-reel-bar{position:absolute;left:17rem;right:6rem;bottom:1rem;margin:0}
}
.rx4-compass{display:grid;grid-template-columns:repeat(3,minmax(0,13rem));grid-template-areas:". n ." "w c e" ". s .";gap:.4rem;align-items:center}
.rx4-compass-n{grid-area:n}.rx4-compass-s{grid-area:s}.rx4-compass-w{grid-area:w}.rx4-compass-e{grid-area:e}
.rx4-compass-c{grid-area:c;justify-self:center;align-self:stretch;display:flex;align-items:center;justify-content:center;width:100%;min-height:3rem;padding:.3rem;border-radius:.6rem;border:2px solid;font-family:'Big Shoulders Display','Gabarito',system-ui,sans-serif;font-weight:900;font-size:1.15rem;line-height:1;text-align:center}
@media (max-width:767px){.rx4-compass{width:100%;grid-template-columns:repeat(3,minmax(0,1fr))}.rx4-compass .rx4-door-to{font-size:1rem}.rx4-compass .rx4-door-img{display:none}.rx4-compass-c{font-size:.95rem}}
`
