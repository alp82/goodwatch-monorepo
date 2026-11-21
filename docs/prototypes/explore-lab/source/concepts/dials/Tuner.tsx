// PROTOTYPE - throwaway (prototype/explore-r4, concept "dials"). The tuner: a page's dials, and the grid of titles
// that follows them. While a knob is dragged the grid re-ranks the page's pool in the browser and the posters glide to
// their new places; on release the address takes the stop, so every tuned page is a link.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { useLocation, useNavigate } from "@remix-run/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { CAPTION } from "~/ui/eyebrow"
import { gridPosterPriority } from "~/utils/tmdb-image"
import type { ShowTitle } from "../../kit/types"
import { PANEL, SPRING, ShowMark, isMixed } from "../../kit/ui"
import { Dial, type DialChange } from "./Dial"
import {
	type DialSpec,
	type Settings,
	isTuned,
	nearestStop,
	settingsWithFine,
	writeSettings,
} from "./tune"

/** The dials' state: the address's stops, and on top of them whatever a knob is doing right now. */
export function useTuner(dials: DialSpec[]) {
	const navigate = useNavigate()
	const { search } = useLocation()
	const server = useMemo(() => settingsWithFine(dials, search), [dials, search])
	const serverKey = JSON.stringify(server)
	const [settings, setSettings] = useState<Settings>(server)
	const latest = useRef(settings)
	latest.current = settings
	// biome-ignore lint/correctness/useExhaustiveDependencies: the address changed; follow it
	useEffect(() => setSettings(server), [serverKey])

	const commit = (next: Settings) => {
		const u = new URL(window.location.href)
		writeSettings(u.searchParams, dials, next)
		u.searchParams.delete("page")
		u.searchParams.delete("sort")
		navigate(`${u.pathname}${u.search}`, { replace: true, preventScrollReset: true })
	}
	const change = (spec: DialSpec, c: DialChange) => {
		const next = { ...latest.current, [spec.id]: c.at }
		setSettings(next)
		if (c.final) commit(next)
	}
	const reset = () => {
		const next = Object.fromEntries(dials.map((d) => [d.id, null]))
		setSettings(next)
		commit(next)
	}
	return { settings, change, reset, tuned: isTuned(settings) }
}

export type Tuner = ReturnType<typeof useTuner>

function Reset({ tuner, className = "" }: { tuner: Tuner; className?: string }) {
	return (
		<button
			type="button"
			onClick={tuner.reset}
			tabIndex={tuner.tuned ? 0 : -1}
			className={`rounded-full px-2.5 py-1 text-xs font-bold text-gray-300 outline-none transition-[opacity,background-color] duration-200 hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400 ${tuner.tuned ? "opacity-100" : "pointer-events-none opacity-0"} ${className}`}
		>
			Reset
		</button>
	)
}

const restLine = (d: DialSpec) =>
	d.home !== null && d.homeLabel
		? `The diamond marks ${d.homeLabel.charAt(0).toLowerCase()}${d.homeLabel.slice(1)}.`
		: undefined

/**
 * On a phone several dials sit side by side and you swipe between them, so the titles stay close under the knob. The
 * next dial shows as a faded sliver (never a cut-off word), and dots say how many there are and which one is in view.
 */
const SWIPE =
	"max-lg:-mx-4 max-lg:flex max-lg:snap-x max-lg:snap-mandatory max-lg:gap-5 max-lg:overflow-x-auto max-lg:scroll-px-4 max-lg:px-4 max-lg:[scrollbar-width:none] max-lg:*:w-[84%] max-lg:*:shrink-0 max-lg:*:snap-start sm:max-lg:*:w-[46%]"

function SwipeRow({
	swipe,
	count,
	className,
	children,
}: {
	swipe: boolean
	count: number
	className: string
	children: React.ReactNode
}) {
	const ref = useRef<HTMLDivElement>(null)
	const [at, setAt] = useState(0)
	const [edge, setEdge] = useState<"start" | "middle" | "end">("start")
	useEffect(() => {
		const el = ref.current
		if (!el || !swipe) return
		const read = () => {
			const max = el.scrollWidth - el.clientWidth
			if (max <= 4) return setEdge("end")
			const first = el.firstElementChild as HTMLElement | null
			const step = (first?.offsetWidth ?? el.clientWidth) + 20
			setAt(Math.min(count - 1, Math.round(el.scrollLeft / step)))
			setEdge(el.scrollLeft <= 4 ? "start" : el.scrollLeft >= max - 4 ? "end" : "middle")
		}
		read()
		el.addEventListener("scroll", read, { passive: true })
		window.addEventListener("resize", read)
		return () => {
			el.removeEventListener("scroll", read)
			window.removeEventListener("resize", read)
		}
	}, [swipe, count])
	if (!swipe) return <div className={className}>{children}</div>
	const fade =
		edge === "start"
			? "max-lg:[mask-image:linear-gradient(to_right,black_82%,transparent_99%)]"
			: edge === "end"
				? "max-lg:[mask-image:linear-gradient(to_left,black_82%,transparent_99%)]"
				: "max-lg:[mask-image:linear-gradient(to_right,transparent_1%,black_14%,black_86%,transparent_99%)]"
	return (
		<>
			<div ref={ref} className={`${className} ${SWIPE} ${fade}`}>
				{children}
			</div>
			<div aria-hidden className="flex justify-center gap-1.5 pt-1 pb-2 lg:hidden">
				{Array.from({ length: count }, (_, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed dots
						key={i}
						className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === at ? "w-4 bg-white" : "w-1.5 bg-white/25"}`}
					/>
				))}
			</div>
		</>
	)
}

/** The dials as a panel beside the grid (a column from `lg`; on a phone a row you swipe through, above the grid). */
export function TunerPanel({
	dials,
	tuner,
	title = "Tune it",
}: {
	dials: DialSpec[]
	tuner: Tuner
	title?: string
}) {
	if (!dials.length) return null
	return (
		<section aria-label="Dials" className={`${PANEL} px-4 pt-3.5 pb-2 sm:px-5`}>
			<div className="flex items-center">
				<h2 className={CAPTION}>{title}</h2>
				<p className="ml-2 truncate text-xs text-gray-500">
					<span className="lg:hidden">Drag a knob. Swipe for more dials.</span>
					<span className="max-lg:hidden">Drag a knob or tap a stop.</span>
				</p>
				<Reset tuner={tuner} className="-mr-1.5 ml-auto" />
			</div>
			<SwipeRow
				swipe={dials.length > 1}
				count={dials.length}
				className="lg:divide-y lg:divide-white/[0.08]"
			>
				{dials.map((d) => (
					<div key={d.id} className="pt-2.5 pb-1 lg:py-4 lg:first:pt-3">
						<Dial
							spec={d}
							at={tuner.settings[d.id] ?? null}
							onChange={(c) => tuner.change(d, c)}
							rest={restLine(d)}
						/>
					</div>
				))}
			</SwipeRow>
		</section>
	)
}

/** The dials side by side in one row: for a hub, a family or a ranking. Three or more swipe on a phone. */
export function TunerRow({ dials, tuner }: { dials: DialSpec[]; tuner: Tuner }) {
	if (!dials.length) return null
	const cols = dials.length >= 3 ? "lg:grid-cols-3" : dials.length === 2 ? "lg:grid-cols-2" : ""
	return (
		<section
			aria-label="Dials"
			className={`${PANEL} relative px-4 py-1 sm:px-6 ${dials.length === 1 ? "lg:max-w-2xl" : ""}`}
		>
			<SwipeRow
				swipe={dials.length >= 3}
				count={dials.length}
				className={`lg:grid lg:gap-x-10 ${cols} ${dials.length >= 3 ? "" : "max-lg:divide-y max-lg:divide-white/[0.08]"}`}
			>
				{dials.map((d) => (
					<div key={d.id} className="py-4 lg:py-5">
						<Dial spec={d} at={tuner.settings[d.id] ?? null} onChange={(c) => tuner.change(d, c)} />
					</div>
				))}
			</SwipeRow>
			<Reset
				tuner={tuner}
				className="absolute -bottom-3 right-4 bg-gray-800 ring-1 ring-white/15 hover:!bg-gray-700"
			/>
		</section>
	)
}

/**
 * The settings the grid follows: the knob's, a few times a second. A knob moves every frame; titles that re-sorted
 * every frame would be a blur, so they take a step, land, and take the next.
 */
export function useSteps<T>(value: T, ms = 150): T {
	const [stepped, setStepped] = useState(value)
	const last = useRef(0)
	const key = JSON.stringify(value)
	// biome-ignore lint/correctness/useExhaustiveDependencies: compared by content
	useEffect(() => {
		const wait = Math.max(0, ms - (performance.now() - last.current))
		const t = setTimeout(() => {
			last.current = performance.now()
			setStepped(value)
		}, wait)
		return () => clearTimeout(t)
	}, [key, ms])
	return stepped
}

/**
 * Real poster cards that follow the dials: a title that stays glides to its new cell, one that joins fades in, one
 * that leaves fades out.
 */
export function TunedGrid({ titles, className }: { titles: ShowTitle[]; className: string }) {
	const reduce = useReducedMotion()
	const mixed = isMixed(titles)
	return (
		<div className={className}>
			<AnimatePresence initial={false} mode="popLayout">
				{titles.map((t, i) => (
					<motion.div
						key={t.card.key}
						layout={reduce ? false : "position"}
						initial={reduce ? false : { opacity: 0, scale: 0.96 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, transition: { duration: 0.1 } }}
						transition={{ ...SPRING, opacity: { duration: 0.22 } }}
						className="relative"
					>
						<ShowMark title={t} mixed={mixed} />
						<TitlePosterCard
							card={t.card}
							posterPriority={i < 12 ? gridPosterPriority(i) : "lazy"}
							skipOffscreen={i > 17}
						/>
					</motion.div>
				))}
			</AnimatePresence>
		</div>
	)
}

/** What the dials are set to, as one quiet line: "A touch · More intense". */
export function tunedLine(dials: DialSpec[], settings: Settings): string {
	return dials
		.filter((d) => settings[d.id] != null)
		.map((d) => nearestStop(d, settings[d.id] as number).name)
		.join(" · ")
}
