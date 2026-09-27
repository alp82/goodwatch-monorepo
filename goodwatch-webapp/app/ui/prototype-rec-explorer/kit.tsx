// PROTOTYPE - throwaway. Shared pieces for /prototype/rec-explorer variants, built from existing components:
// the score ring, the streaming logos, the vibe-colored match, and the Want to See / Seen action buttons.
import { BookmarkIcon, EyeIcon, MinusIcon, PlusIcon, QueueListIcon, ViewfinderCircleIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import type { ReactNode } from "react"
import { phrase } from "~/ui/prototype-rec-taste/engine"
import { MatchText, Ring, ServiceLogos, href } from "~/ui/prototype-rec-taste/kit"
import type { PoolItem } from "~/ui/prototype-rec-taste/model"
import { getVibeColorValue } from "~/utils/ratings"
import type { Score } from "~/server/scores.server"
import { GENERATED_CSS } from "./generated-css"
import { backdrop, img } from "./model"
import type { Explorer } from "./useExplorer"

const ACTIONS = {
	want: { Icon: BookmarkIcon, short: "Want", on: "Want to See", off: "Want to See", active: "bg-amber-500 text-black", tint: "text-amber-300" },
	next: { Icon: QueueListIcon, short: "Next", on: "In Watch next", off: "Watch next", active: "bg-sky-400 text-black", tint: "text-sky-300" },
	seen: { Icon: EyeIcon, short: "Seen", on: "Seen", off: "Seen it", active: "bg-green-500 text-black", tint: "text-green-300" },
} as const

/** The details page action button, as ListActions draws it. */
export function ActionButton({ kind, active, onClick, compact = false }: { kind: keyof typeof ACTIONS; active: boolean; onClick: () => void; compact?: boolean }) {
	const a = ACTIONS[kind]
	return (
		<button
			type="button"
			aria-pressed={active}
			aria-label={a.off}
			onClick={onClick}
			className={`inline-flex ${compact ? "h-9 gap-1 px-1.5 text-xs" : "h-11 gap-1.5 px-2 text-sm"} w-full min-w-0 items-center justify-center rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
				active ? a.active : "bg-white/10 text-gray-100 hover:bg-white/20"
			}`}
		>
			<a.Icon className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0 ${active ? "" : a.tint}`} />
			{/* Short labels on narrow screens, as the details page does. */}
			<span className="truncate sm:hidden">{active && kind !== "want" ? a.on : a.short}</span>
			<span className="hidden truncate sm:inline">{active ? a.on : a.off}</span>
		</button>
	)
}

export function Actions({ ex, i, compact = false }: { ex: Explorer; i: number; compact?: boolean }) {
	const key = ex.items[i].key
	const sig = ex.signals[key]
	return (
		<div className="grid grid-cols-3 gap-1.5">
			<ActionButton compact={compact} kind="want" active={sig?.kind === "want"} onClick={() => ex.actions.want(key)} />
			<ActionButton compact={compact} kind="next" active={ex.queue.includes(key)} onClick={() => ex.actions.next(key)} />
			<ActionButton compact={compact} kind="seen" active={sig?.kind === "seen" || sig?.kind === "score"} onClick={() => ex.actions.seen(key)} />
		</div>
	)
}

/** What the person already said about a title, or its match. */
export function Standing({ ex, i }: { ex: Explorer; i: number }) {
	const sig = ex.signals[ex.items[i].key]
	if (sig?.kind === "score")
		return (
			<span className="text-sm font-bold" style={{ color: getVibeColorValue(sig.score as Score) }}>
				You rated it {sig.score}
			</span>
		)
	return <MatchText match={ex.match[i]} className="text-sm" />
}

/** The peek card: poster, score ring, match with a reason, services, and the three actions. */
export function Peek({ ex, i, onClose, extra, wide = false }: { ex: Explorer; i: number; onClose: () => void; extra?: ReactNode; wide?: boolean }) {
	const it = ex.items[i]
	return (
		<div className={`relative overflow-hidden rounded-2xl border border-white/10 rx-card shadow-2xl backdrop-blur ${wide ? "w-full" : "rx-peek"}`}>
			{it.backdrop && <img src={backdrop(it, "w780")} alt="" className="absolute inset-x-0 top-0 h-28 w-full object-cover opacity-30 rx-fade-top" />}
			<button type="button" aria-label="Close" onClick={onClose} className="absolute right-2 top-2 z-10 rounded-full bg-black/60 p-1.5 text-gray-300 hover:text-white">
				<XMarkIcon className="h-4 w-4" />
			</button>
			<div className="relative flex gap-3 p-3">
				<Link to={href(it)} className="shrink-0">
					<img src={img(it, "w185")} alt={`Poster for ${it.title}`} className="h-36 w-24 rounded-md border-2 border-gray-800 object-cover" />
				</Link>
				<div className="min-w-0 flex-1 pt-1">
					<Link to={href(it)} className="block pr-6 text-lg font-bold leading-tight text-white hover:underline">
						{it.title}
					</Link>
					<p className="text-xs text-gray-400">
						{it.year} {it.type === "show" ? "series" : "film"}
						{it.genres.length ? `, ${it.genres.slice(0, 2).join(", ").toLowerCase()}` : ""}
					</p>
					<div className="mt-2 flex items-center gap-2">
						<Ring item={it} size={40} />
						<Standing ex={ex} i={i} />
					</div>
					<p className="mt-1.5 line-clamp-2 text-xs text-gray-300">{ex.why(i)}</p>
				</div>
			</div>
			<div className="relative flex flex-col gap-2 px-3 pb-3">
				<ServiceLogos item={it} services={ex.services} size="w-6 h-6" />
				<Actions ex={ex} i={i} compact />
				{extra}
			</div>
		</div>
	)
}

/** The shared filter bar's two chips, plus how filtered titles are shown. */
export function Filters({ ex, showMode = true, className = "" }: { ex: Explorer; showMode?: boolean; className?: string }) {
	const mine = ex.services.filter((s) => s.mine)
	const chip = (on: boolean) => `inline-flex h-9 items-center gap-2 rounded-full border-2 px-3 text-sm font-semibold transition ${on ? "rx-chip-on" : "rx-chip-off"}`
	return (
		<div className={`-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 py-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&>*]:shrink-0 ${className}`}>
			<button type="button" aria-pressed={ex.onlyMine} onClick={() => ex.setOnlyMine(!ex.onlyMine)} className={chip(ex.onlyMine)}>
				<span className="flex -space-x-1.5">
					{mine.slice(0, 3).map((s) => (
						<img key={s.id} src={s.logo} alt="" className={`h-5 w-5 rounded-md ring-2 ring-black ${ex.onlyMine ? "" : "opacity-60 grayscale"}`} />
					))}
				</span>
				{ex.onlyMine ? "On my services" : "Everywhere"}
			</button>
			<button type="button" aria-pressed={ex.notSeen} onClick={() => ex.setNotSeen(!ex.notSeen)} className={chip(ex.notSeen)}>
				<EyeIcon className="h-4 w-4" />
				{ex.notSeen ? "Not seen yet" : "Seen too"}
			</button>
			{showMode && (
				<div className="inline-flex h-9 items-center rounded-full border-2 border-white/15 bg-black/50 p-0.5 text-xs font-semibold" role="group" aria-label="Filtered titles">
					{(["dim", "hide"] as const).map((m) => (
						<button
							key={m}
							type="button"
							aria-pressed={ex.filterMode === m}
							onClick={() => ex.setFilterMode(m)}
							className={`h-full rounded-full px-3 ${ex.filterMode === m ? "bg-white text-black" : "text-gray-300 hover:text-white"}`}
						>
							{m === "dim" ? "Dim others" : "Hide others"}
						</button>
					))}
				</div>
			)}
		</div>
	)
}

export function ZoomControls({ onIn, onOut, onYou, youLabel = "Back to you", className = "" }: { onIn: () => void; onOut: () => void; onYou?: () => void; youLabel?: string; className?: string }) {
	const btn = "flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70 text-white backdrop-blur hover:bg-white/15"
	return (
		<div className={`flex flex-col items-end gap-2 ${className}`}>
			{onYou && (
				<button type="button" onClick={onYou} className="flex h-10 items-center gap-2 rounded-full border rx-you-btn bg-black/70 px-3 text-sm font-semibold backdrop-blur">
					<ViewfinderCircleIcon className="h-5 w-5" />
					{youLabel}
				</button>
			)}
			<div className="flex gap-2">
				<button type="button" aria-label="Zoom out" onClick={onOut} className={btn}>
					<MinusIcon className="h-5 w-5" />
				</button>
				<button type="button" aria-label="Zoom in" onClick={onIn} className={btn}>
					<PlusIcon className="h-5 w-5" />
				</button>
			</div>
		</div>
	)
}

export function Toast({ ex }: { ex: Explorer }) {
	if (!ex.toast) return null
	return (
		<div role="status" className="pointer-events-none fixed left-1/2 top-20 rx-toast -translate-x-1/2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black shadow-2xl">
			{ex.toast}
		</div>
	)
}

/** Who the page is personalised for: the signed-in member, or the demo member. */
export function WhoNote({ ex, className = "" }: { ex: Explorer; className?: string }) {
	const [params] = useSearchParams()
	const w = ex.who
	const rated = Object.values(ex.signals).filter((s) => s.kind === "score").length
	const other = new URLSearchParams(params)
	other.set("as", w.mode === "me" ? "demo" : "me")
	return (
		<p className={`text-xs text-gray-400 ${className}`}>
			{w.mode === "me" ? `Your ${rated} ratings and Wishlist` : `Demo member with ${rated} ratings`}
			{w.demoServices ? ", demo services" : ", your services"} in {w.country}.
			{w.signedIn && (
				<Link to={`?${other}`} reloadDocument className="rx-ml underline underline-offset-2 hover:text-white">
					{w.mode === "me" ? "Switch to the demo member" : "Use my profile"}
				</Link>
			)}
		</p>
	)
}

export const reasonsText = (ex: Explorer, i: number) =>
	ex
		.reasons(i)
		.slice(0, 2)
		.map(phrase)
		.join(" and ")

export type PeekState = { i: number; at: { x: number; y: number } } | null

export const isSmall = () => typeof window !== "undefined" && window.innerWidth < 768

export type { PoolItem }

// The dev server's stylesheet link is served from a cache that may not include classes from new files yet,
// so the few layout rules this prototype needs beyond existing classes live here.
const CSS = `
.rx-stage{position:relative;height:calc(100vh - 8rem);overflow:hidden}
@media (min-width:1024px){.rx-stage{height:calc(100vh - 4rem)}}
.rx-atlas-bg{background:radial-gradient(ellipse at center,#1c1917 0%,#0c0a09 60%,#000 100%)}
.rx-peek{width:24rem;max-width:100%}
.rx-fade-top{-webkit-mask-image:linear-gradient(to bottom,#000,transparent);mask-image:linear-gradient(to bottom,#000,transparent)}
.rx-card{background:rgba(12,10,9,.95)}
.rx-chip-on{border-color:rgba(217,119,6,.7);background:rgba(120,53,15,.45);color:#fef3c7}
.rx-chip-off{border-color:rgba(255,255,255,.15);background:rgba(0,0,0,.5);color:#d1d5db}
.rx-chip-off:hover{border-color:rgba(255,255,255,.3)}
.rx-you-btn{border-color:rgba(245,158,11,.6);color:#fde68a}
.rx-you-btn:hover{background:rgba(120,53,15,.45)}
.rx-toast{z-index:95}
.rx-compass{width:100%;max-width:36rem}
@media (min-width:1024px){.rx-compass{width:min(36rem,calc((100vh - 15rem) / 1.5))}}
.rx-ml{margin-left:.375rem}
@media (min-width:768px){.rx-md-bottom-6{bottom:1.5rem}}
`
export function ExplorerStyles() {
	return <style dangerouslySetInnerHTML={{ __html: CSS + GENERATED_CSS }} />
}
