// PROTOTYPE (start page lab, round 5): what stage j and k share: h's shell (shadow pool, lifted field, night above the
// room) with Discover chips, the flow with an empty state before any choice (plus one-tap starters), and the room's
// slots kept empty wherever the search block, the chips or the results module sit (Room's hideSlot).
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { type LabCard, type Rect, useLab } from "../../lab/types"
import { type StageFlow, useStageFlow } from "./ab-shared"
import { EfgField, NIGHT } from "./efg-shared"
import { trayTitle } from "./hi-shared"
import { vocabOf } from "./hi-vocab"
import { JkMoodRow, JkMorePopover, JkPresets } from "./jk-chips"

const POOL = [
	"radial-gradient(ellipse 34% 30% at 50% 42%, rgb(2 4 10 / .55), rgb(2 4 10 / 0) 100%)",
	"radial-gradient(ellipse 50% 46% at 50% 45%, rgb(2 4 10 / .82) 0%, rgb(2 4 10 / .66) 40%, rgb(2 4 10 / .34) 68%, rgb(2 4 10 / .1) 88%, rgb(2 4 10 / 0) 100%)",
].join(", ")

const FIELD_SHADOW =
	"0 1px 0 rgb(255 255 255 / .06) inset, 0 2px 4px rgb(0 0 0 / .45), 0 10px 22px rgb(0 0 0 / .45), 0 28px 56px rgb(0 0 0 / .55), 0 60px 120px rgb(0 0 0 / .55)"

// h's toggle-card and field rules (hi-shared keeps its copy private), then j and k's own sizes.
const CSS = `@keyframes ab-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.ab-in{animation:ab-in .35s cubic-bezier(.2,.8,.2,1) both}
.efg-glow{opacity:0;transition:opacity .25s ease-out}
.efg-field:focus-within .efg-glow{opacity:1}
.hi-lift{position:relative;transition:transform .25s cubic-bezier(.2,.8,.2,1),opacity .2s ease-out}
@media (hover:hover){.hi-tog:not(.hi-off):hover .hi-lift{transform:translateY(-3px)}}
.hi-tog:not(.hi-off):active .hi-lift{transform:scale(.96)}
.hi-on .hi-lift,.hi-on:hover .hi-lift{transform:translateY(-6px)}
.hi-off .hi-lift{opacity:.4}
.hi-ring{position:absolute;inset:-4px;border-radius:12px;border:3px solid #fbbf24;box-shadow:0 0 18px rgb(251 191 36/.5);opacity:0;transform:scale(1.06);transition:opacity .18s ease-out,transform .25s cubic-bezier(.2,1.4,.4,1);pointer-events:none;z-index:32}
.hi-on .hi-ring{opacity:1;transform:none}
.hi-badge{position:absolute;right:-7px;top:-7px;z-index:33;display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:#fbbf24;color:#111827;box-shadow:0 3px 10px rgb(0 0 0/.5);opacity:0;transform:scale(.4);transition:opacity .15s ease-out,transform .3s cubic-bezier(.2,1.5,.4,1);pointer-events:none}
.hi-on .hi-badge{opacity:1;transform:none}
.hi-tap{position:absolute;inset:0;z-index:30;border-radius:8px;cursor:pointer;outline:none}
.hi-tap:focus-visible{box-shadow:0 0 0 2px #fbbf24}
.hi-info{transition:opacity .15s ease-out}
@media (hover:hover){.hi-info{opacity:0}.hi-tog:hover .hi-info,.hi-info:focus-visible{opacity:1}}
.jk-layer{position:absolute;inset:0;transition:opacity .3s ease-out,transform .3s ease-out}
@keyframes jk-drop{from{opacity:0;transform:translateY(-40%) scale(1.3)}}
.jk-drop{animation:jk-drop .4s cubic-bezier(.2,1.3,.4,1) both}
@keyframes jk-breathe{0%,100%{opacity:.75}50%{opacity:1}}
.jk-breathe{animation:jk-breathe 4.5s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.jk-breathe,.jk-drop,.ab-in{animation:none}}
.jk-top{padding-top:12px}
@media (min-width:640px){.jk-top{padding-top:44px}}
@media (min-width:1024px){.jk-top{padding-top:clamp(20px,3vh,48px)}}
@media (min-width:1024px) and (max-height:820px){.jk-top{padding-top:20px}.jk-h1{font-size:40px!important}.jk-field-gap{margin-top:18px!important}.jk-gap{margin-top:12px!important}}`

export type JkView = "empty" | "loading" | "results" | "picks"
/** A one-tap start in the empty state that isn't a mood or a search: the popular or top rated titles. */
export type Starter = "popular" | "top" | null

/** The stage flow plus the empty state: nothing is shown until the guest picks a mood, a prompt, a starter or searches. */
export function useJkFlow(key: string) {
	const f = useStageFlow(key)
	const store = `start-lab-stage-${key}-starter`
	const [starter, setStarter] = useState<Starter>(null)
	const [restored, setRestored] = useState(false)
	useEffect(() => {
		try {
			const s = sessionStorage.getItem(store)
			if (s === "popular" || s === "top") setStarter(s)
		} catch {}
		setRestored(true)
	}, [store])
	useEffect(() => {
		if (!restored) return
		try {
			if (starter) sessionStorage.setItem(store, starter)
			else sessionStorage.removeItem(store)
		} catch {}
	}, [restored, store, starter])
	// A mood or a search replaces the starter, so clearing it later goes back to the empty state.
	useEffect(() => {
		if (f.source.kind !== "popular") setStarter(null)
	}, [f.source.kind])

	const showPicks = f.done && f.picks.length > 0
	const view: JkView = showPicks ? "picks" : f.loading ? "loading" : f.source.kind === "popular" && !starter ? "empty" : "results"
	const results: LabCard[] = f.source.kind === "popular" && starter === "top" && f.data.guest.topRated.length ? f.data.guest.topRated : f.results
	const heading = ((): { text: string; dot?: string } => {
		if (view === "empty") return { text: "Your picks" }
		if (view === "results" && f.source.kind === "popular") return { text: starter === "top" ? "Recent and top rated" : "Popular right now" }
		return trayTitle(f)
	})()
	const surprise = useCallback(() => {
		const moods = f.data.guest.moods
		const now = f.source.kind === "mood" ? f.source.key : null
		const pool = moods.filter((m) => m.key !== now)
		const m = pool[Math.floor(Math.random() * pool.length)]
		if (m) f.mood(m.key)
	}, [f])
	return { ...f, results, starter, setStarter, view, heading, surprise }
}

export type JkFlow = ReturnType<typeof useJkFlow>

/** Registers an element whose on-screen box the room's slots must stay out of. */
export type Reg = (id: string) => (el: HTMLElement | null) => void

const overlaps = (a: Rect, b: Rect, pad: number) =>
	a.left < b.left + b.width + pad && b.left - pad < a.left + a.width && a.top < b.top + b.height + pad && b.top - pad < a.top + a.height

/** The boxes of the registered elements, in the room box's px, kept fresh on resize. */
function useObstacles() {
	const roomBox = useRef<HTMLDivElement>(null)
	const els = useRef(new Map<string, HTMLElement>())
	const refs = useRef(new Map<string, (el: HTMLElement | null) => void>())
	const [rects, setRects] = useState<Rect[]>([])
	const measure = useCallback(() => {
		const box = roomBox.current?.getBoundingClientRect()
		if (!box) return
		const next: Rect[] = []
		for (const el of els.current.values()) {
			const r = el.getBoundingClientRect()
			if (!r.width || !r.height) continue
			// Clipped to the viewport's width: a scrolling row is only in the way where it shows.
			const left = Math.max(r.left, 0)
			const right = Math.min(r.right, window.innerWidth)
			next.push({ left: Math.round(left - box.left), top: Math.round(r.top - box.top), width: Math.round(right - left), height: Math.round(r.height) })
		}
		setRects((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
	}, [])
	const reg: Reg = useCallback(
		(id) => {
			let cb = refs.current.get(id)
			if (!cb) {
				cb = (el) => {
					if (el) els.current.set(id, el)
					else els.current.delete(id)
				}
				refs.current.set(id, cb)
			}
			return cb
		},
		[],
	)
	useEffect(() => {
		measure()
		const ro = new ResizeObserver(() => measure())
		if (roomBox.current) ro.observe(roomBox.current)
		for (const el of els.current.values()) ro.observe(el)
		const t = setTimeout(measure, 400)
		window.addEventListener("resize", measure)
		return () => {
			ro.disconnect()
			clearTimeout(t)
			window.removeEventListener("resize", measure)
		}
	}, [measure])
	const hideSlot = useCallback((r: Rect) => rects.some((o) => overlaps(r, o, 8)), [rects])
	return { roomBox, reg, hideSlot }
}

/**
 * The stage: the room under the night, the search block on top, and the results module given by the variant.
 * `card` keeps the module in the page's column above the lab bar's space; `band` lets it run the full width to the
 * bottom edge (the module keeps the lab bar's space itself). `over` draws over the room, under the content.
 */
export function JkStage({
	k,
	placement,
	over,
	module,
}: {
	k: string
	placement: "card" | "band"
	over?: (f: JkFlow) => ReactNode
	module: (f: JkFlow, reg: Reg) => ReactNode
}) {
	const { Room } = useLab()
	const f = useJkFlow(k)
	const { roomBox, reg, hideSlot } = useObstacles()
	const [more, setMore] = useState(false)
	const close = useCallback(() => setMore(false), [])
	return (
		<section
			aria-label="Find something to watch"
			className="relative isolate overflow-hidden [container-type:inline-size] [--room-top:110px] sm:[--room-top:140px] lg:[--room-top:200px]"
			style={{ background: NIGHT }}
		>
			<style>{CSS}</style>
			<div ref={roomBox} className="absolute inset-x-0 bottom-0" style={{ top: "var(--room-top)" }}>
				<Room noTv focal={[0.5, 0.9]} hideSlot={hideSlot} style={{ position: "absolute", inset: 0 }} />
			</div>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0"
				style={{
					background: `linear-gradient(to bottom, ${NIGHT} 0, ${NIGHT} var(--room-top), rgb(5 10 22 / 0) calc(var(--room-top) + 18vh)), linear-gradient(to bottom, rgb(3 7 18 / 0) 60%, rgb(3 7 18 / .4) 80%, rgb(3 7 18 / .9) 100%)`,
				}}
			/>
			{over?.(f)}
			<div className="pointer-events-none relative z-10 flex min-h-[calc(100svh-4rem)] w-full flex-col">
				<div className="mx-auto w-full max-w-[1360px] px-4 sm:px-6">
					<JkTop f={f} reg={reg} onMore={() => setMore((o) => !o)} moreOpen={more} moreSlot={<JkMorePopover f={f} open={more} onClose={close} />} />
				</div>
				<div className="min-h-4 flex-1" />
				{placement === "card" ? (
					<div className="mx-auto w-full max-w-[1360px] px-4 pb-16 sm:px-6 sm:pb-[72px]">{module(f, reg)}</div>
				) : (
					module(f, reg)
				)}
			</div>
		</section>
	)
}

/** H1, the lifted field, the example searches and the mood row, each registered so no room poster sits behind it. */
function JkTop({ f, reg, onMore, moreOpen, moreSlot }: { f: StageFlow; reg: Reg; onMore: () => void; moreOpen: boolean; moreSlot: ReactNode }) {
	return (
		<div className="jk-top relative isolate z-20">
			<div
				aria-hidden
				className="pointer-events-none absolute left-1/2 -top-24 -z-10 h-[calc(100%+260px)] w-[230%] -translate-x-1/2 sm:w-[min(1700px,170%)]"
				style={{ background: POOL }}
			/>
			<h1
				ref={reg("h1")}
				className="jk-h1 pointer-events-auto mx-auto w-fit text-center text-[26px] font-extrabold leading-8 tracking-tight text-white [text-shadow:0_2px_4px_rgb(0_0_0/.6),0_8px_40px_rgb(0_0_0/.85)] sm:text-5xl sm:leading-[1.1] lg:text-[52px]"
			>
				Find something to watch by mood or anything
			</h1>
			<div ref={reg("field")} className="jk-field-gap mx-auto mt-4 max-w-[880px] sm:mt-8">
				<EfgField
					f={f}
					body="h-[62px] rounded-2xl bg-gray-900 ring-1 ring-white/12 sm:h-[84px] sm:rounded-[22px] lg:h-[88px]"
					decor={<span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-[22px]" style={{ boxShadow: FIELD_SHADOW }} />}
					glow="rounded-2xl ring-2 ring-amber-400/80 shadow-[0_0_0_6px_rgb(251_191_36/.12),0_0_70px_10px_rgb(251_191_36/.28)] sm:rounded-[22px]"
				/>
			</div>
			<div ref={reg("presets")} className="jk-gap mx-auto mt-3 w-fit max-w-full sm:mt-5">
				<JkPresets f={f} />
			</div>
			<div className="jk-gap relative mt-2.5 sm:mt-4">
				<div ref={reg("moods")} className="mx-auto w-fit max-w-full">
					<JkMoodRow f={f} onMore={onMore} moreOpen={moreOpen} />
				</div>
				{moreSlot}
			</div>
		</div>
	)
}

/**
 * When the guest asks for something and the module sits below the fold, bring it into view. Never on first paint or
 * a restore: only on a change after the guest acted.
 */
export function useJkBringIntoView(f: JkFlow) {
	const box = useRef<HTMLDivElement>(null)
	const sig = `${f.view}:${f.starter}:${f.source.kind}:${"q" in f.source ? f.source.q : "key" in f.source ? f.source.key : ""}`
	const prev = useRef<string | null>(null)
	const acted = useRef(false)
	useEffect(() => {
		const on = () => {
			acted.current = true
		}
		window.addEventListener("pointerdown", on, true)
		window.addEventListener("keydown", on, true)
		return () => {
			window.removeEventListener("pointerdown", on, true)
			window.removeEventListener("keydown", on, true)
		}
	}, [])
	useEffect(() => {
		const was = prev.current
		prev.current = sig
		if (was === null || was === sig || !acted.current) return
		const el = box.current
		if (!el) return
		const r = el.getBoundingClientRect()
		const room = window.innerHeight - 64 // the lab bar
		if (r.bottom > room + 2) window.scrollBy({ top: Math.min(r.top - 80, r.bottom - room), behavior: "smooth" })
	}, [sig])
	return box
}

/** Whether the module shows a reading line ("Read as …") for what's on show. */
export const showsReading = (f: JkFlow) =>
	f.view === "results" && !!f.answer && (f.source.kind === "typed" || (f.source.kind === "prompt" && !vocabOf(f.source)))
