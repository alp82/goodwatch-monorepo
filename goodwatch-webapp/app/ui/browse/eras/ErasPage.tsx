// The eras index: time is a ribbon you drag. Every year
// from the first decade to now is a frame on it; the stage over it follows the frame under the needle: the year in
// numerals that roll, the decade's story and obsessions, and that year's standouts.
import { Link } from "@remix-run/react"
import {
	AnimatePresence,
	animate,
	motion,
	useMotionValue,
	useMotionValueEvent,
} from "framer-motion"
import {
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { SectionHeading } from "~/ui/heading"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { top, ing, kindLabel, kindNoun, place } from "~/domain/browse/address"
import { EASE, FOCUS, WRAP, poster } from "~/ui/browse/index"
import type { BrowseViewProps } from "~/ui/browse/view"
import { ObsessionLink, Odometer, OnwardLink, joined } from "~/ui/browse/eras/bits"
import type { ScrubData } from "~/server/browse/eras.server"

// One frame of the ribbon: a year. The sizes are the same on every screen, so the server draws the ribbon where the
// browser will.
const FRAME = 64
const GAP = 10
/** Extra room before a decade's first year: the decades read as groups. */
const BREAK = 30
const EDGE = 0.35
/** The lens: frames within LENS px of the needle grow toward it; farther ones fade out to FADE px. */
const LENS = 240
const FADE = 760

/** A frame's look at `d` px from the needle: it grows and lifts near it, and fades with distance. */
function lensOf(d: number) {
	const t = Math.max(0, 1 - d / LENS)
	const near = t ** 1.6
	const far = Math.max(0, 1 - d / FADE)
	return {
		transform: `translateY(${(-5 * near).toFixed(2)}px) scale(${(1 + 0.2 * near).toFixed(4)})`,
		opacity: (0.38 + 0.62 * far).toFixed(3),
	}
}

function useRibbon(frames: ScrubData["frames"], start: number) {
	const centers = useMemo(() => {
		let x = 0
		return frames.map((f, i) => {
			if (i > 0) x += FRAME + GAP + (f.d !== frames[i - 1].d ? BREAK : 0)
			return x + FRAME / 2
		})
	}, [frames])
	// The track's left edge sits at the ribbon's middle; moving it left by a frame's center puts that frame under
	// the needle.
	const x = useMotionValue(-(centers[start] ?? 0))
	const nearest = useCallback(
		(pos: number) => {
			let lo = 0
			let hi = centers.length - 1
			while (lo < hi) {
				const mid = (lo + hi) >> 1
				if (centers[mid] < pos) lo = mid + 1
				else hi = mid
			}
			return lo > 0 && pos - centers[lo - 1] < centers[lo] - pos ? lo - 1 : lo
		},
		[centers],
	)
	return { centers, x, nearest }
}

export function ErasPage({ data, address, to }: BrowseViewProps<ScrubData>) {
	const kind = address.kind
	const noun = kindNoun(kind)
	const { frames, decades, words } = data
	const { centers, x, nearest } = useRibbon(frames, data.start)
	// `live` is the frame under the needle right now (numerals, the lit frame, the decade). `shown` follows once the
	// ribbon rests a moment: the standouts don't flicker through thirty years of posters during one fling.
	const [live, setLive] = useState(data.start)
	const [shown, setShown] = useState(data.start)
	const [grabbing, setGrabbing] = useState(false)
	const liveRef = useRef(data.start)
	const rest = useRef<ReturnType<typeof setTimeout>>()
	useMotionValueEvent(x, "change", (v) => {
		const i = nearest(-v)
		if (i === liveRef.current) return
		liveRef.current = i
		setLive(i)
		clearTimeout(rest.current)
		rest.current = setTimeout(() => setShown(i), 140)
	})
	useEffect(() => () => clearTimeout(rest.current), [])

	// The lens runs off the ribbon's position directly (no React render per frame): transform and opacity only.
	const framesRef = useRef<(HTMLSpanElement | null)[]>([])
	useEffect(() => {
		const apply = (v: number) => {
			const els = framesRef.current
			for (let i = 0; i < els.length; i++) {
				const el = els[i]
				if (!el) continue
				const d = Math.abs(centers[i] + v)
				if (d > FADE + 200 && el.dataset.far === "1") continue
				const l = lensOf(d)
				el.style.transform = l.transform
				el.style.opacity = l.opacity
				el.dataset.far = d > FADE + 200 ? "1" : "0"
			}
		}
		apply(x.get())
		return x.on("change", apply)
	}, [centers, x])

	const run = useRef<ReturnType<typeof animate>>()
	const go = useCallback(
		(i: number, speed = 0) => {
			const at = Math.max(0, Math.min(frames.length - 1, i))
			run.current?.stop()
			const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
			run.current = still
				? animate(x, -centers[at], { duration: 0 })
				: animate(x, -centers[at], {
						type: "spring",
						stiffness: 180,
						damping: 28,
						mass: 0.9,
						velocity: speed,
						restDelta: 0.5,
					})
			// The address keeps the year, so a link opens the ribbon where it was left.
			const url = new URL(window.location.href)
			url.searchParams.set("year", String(frames[at].year))
			window.history.replaceState(window.history.state, "", url)
		},
		[centers, frames, x],
	)

	// Dragging: the ribbon follows the pointer; let go and it keeps some of its speed, then settles on a year.
	const drag = useRef<{
		px: number
		x0: number
		moved: boolean
		trail: [number, number][]
	} | null>(null)
	const min = -(centers[centers.length - 1] ?? 0)
	const down = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (e.button !== 0) return
		run.current?.stop()
		drag.current = { px: e.clientX, x0: x.get(), moved: false, trail: [] }
	}
	const move = (e: ReactPointerEvent<HTMLDivElement>) => {
		const d = drag.current
		if (!d) return
		const dx = e.clientX - d.px
		if (!d.moved && Math.abs(dx) < 5) return
		if (!d.moved) {
			d.moved = true
			e.currentTarget.setPointerCapture(e.pointerId)
			setGrabbing(true)
		}
		let next = d.x0 + dx
		// Past either end it gives a little and pulls back.
		if (next > 0) next *= EDGE
		if (next < min) next = min + (next - min) * EDGE
		x.set(next)
		d.trail.push([e.clientX, e.timeStamp])
		if (d.trail.length > 6) d.trail.shift()
	}
	const up = (e: ReactPointerEvent<HTMLDivElement>) => {
		const d = drag.current
		drag.current = null
		if (!d) return
		if (!d.moved) {
			// A press without a drag is a click on a frame: travel there.
			const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-frame]")
			if (hit) go(Number(hit.dataset.frame))
			return
		}
		setGrabbing(false)
		const [a, b] = [d.trail[0], d.trail[d.trail.length - 1]]
		const speed = a && b && b[1] > a[1] ? ((b[0] - a[0]) / (b[1] - a[1])) * 1000 : 0
		go(nearest(-(x.get() + speed * 0.3)), speed)
	}

	// A sideways wheel or trackpad swipe scrubs too; an up-and-down wheel stays the page's.
	const ribbon = useRef<HTMLDivElement>(null)
	const wheelRest = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => {
		const el = ribbon.current
		if (!el) return
		const onWheel = (e: WheelEvent) => {
			if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
			e.preventDefault()
			run.current?.stop()
			x.set(Math.max(min, Math.min(0, x.get() - e.deltaX)))
			clearTimeout(wheelRest.current)
			wheelRest.current = setTimeout(() => go(nearest(-x.get())), 120)
		}
		el.addEventListener("wheel", onWheel, { passive: false })
		return () => {
			el.removeEventListener("wheel", onWheel)
			clearTimeout(wheelRest.current)
		}
	}, [go, min, nearest, x])

	const firstOf = (d: number) => frames.findIndex((f) => f.d === d)
	const keys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
		const at = liveRef.current
		const d = frames[at].d
		const next: Record<string, number> = {
			ArrowLeft: at - 1,
			ArrowRight: at + 1,
			// A decade back or on: the same year of it where there is one.
			PageDown: frames.findIndex((f) => f.year === frames[at].year - 10),
			PageUp: frames.findIndex((f) => f.year === frames[at].year + 10),
			Home: 0,
			End: frames.length - 1,
		}
		if (!(e.key in next)) return
		e.preventDefault()
		let i = next[e.key]
		if (i < 0) i = e.key === "PageDown" ? firstOf(Math.max(0, d - 1)) : frames.length - 1
		go(i)
	}

	const frame = frames[live]
	const stage = frames[shown]
	const decade = decades[frame.d]
	const decadeAt = place(kind, [ing("decade", decade.place.slug)])

	return (
		// On a phone the order is: the year, the ribbon (the thing you touch, within reach), the standouts, the decade.
		// From `lg` the stage sits over the ribbon: the year and the decade on the left, the standouts on the right.
		<div className="flex flex-col">
			<div
				className={`max-lg:contents lg:mx-auto lg:grid lg:w-full lg:max-w-7xl lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end lg:gap-x-12 lg:px-8 lg:pt-8`}
			>
				<div className="min-w-0 max-lg:contents">
					<div className="max-lg:order-1 max-lg:px-4 max-lg:pt-6 sm:max-lg:px-6">
						<h1 className="text-xs font-bold tracking-[0.18em] text-amber-400 uppercase">
							{kindLabel(kind)} by decade
						</h1>
						<p className="mt-1 font-display font-extrabold tracking-tight text-white">
							<span className="sr-only" aria-live="polite">
								{frame.year}
							</span>
							<Odometer
								value={String(frame.year)}
								className="text-[5rem] sm:text-[8.5rem]"
								ms={grabbing ? 260 : 520}
							/>
						</p>
						<div className="relative mt-2 min-h-[4.25rem] sm:mt-3 lg:min-h-[4rem]">
							<AnimatePresence mode="popLayout" initial={false}>
								<motion.p
									key={decade.place.slug}
									initial={{ opacity: 0, y: 8 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -8 }}
									transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
									className="text-xl leading-snug font-semibold text-balance text-white sm:text-2xl"
								>
									<span className="text-gray-400">The {decade.place.label}. </span>
									{decade.short}
								</motion.p>
							</AnimatePresence>
						</div>
					</div>
					<div className="max-lg:order-4 max-lg:mt-7 max-lg:px-4 sm:max-lg:px-6 lg:mt-3">
						<div className="relative lg:min-h-[3.75rem]">
							<AnimatePresence mode="popLayout" initial={false}>
								{decade.obsessions.length > 0 && (
									<motion.p
										key={decade.place.slug}
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										transition={{ duration: 0.28 }}
										className="max-w-xl text-[17px] leading-relaxed text-gray-300"
									>
										The {decade.place.label} couldn't stop making {noun} about{" "}
										{joined(
											decade.obsessions.map((key) => (
												<ObsessionLink
													key={key}
													noun={words[key].noun}
													color={words[key].color}
													to={to(
														place(kind, [
															ing("decade", decade.place.slug),
															ing("trait", words[key].slug),
														]),
													)}
												/>
											)),
										)}
										.
									</motion.p>
								)}
							</AnimatePresence>
						</div>
						<div className="mt-5 flex flex-wrap gap-2.5">
							<OnwardLink to={to(decadeAt)}>Open the {decade.place.label}</OnwardLink>
							<OnwardLink to={to(top(kind, [], frame.year))} quiet>
								Best {noun} of {frame.year}
							</OnwardLink>
						</div>
					</div>
				</div>

				<div className="min-w-0 max-lg:order-3 max-lg:mt-6 max-lg:px-4 sm:max-lg:px-6">
					<SectionHeading>The standouts of {stage.year}</SectionHeading>
					<div className="relative mt-3">
						<AnimatePresence mode="popLayout" initial={false}>
							<motion.ul
								key={stage.year}
								initial="out"
								animate="in"
								exit="gone"
								variants={{ in: { transition: { staggerChildren: 0.04 } } }}
								className="grid grid-cols-4 gap-2 sm:gap-3"
							>
								{stage.titles.map((t) => (
									<motion.li
										key={t.card.key}
										className="min-w-0"
										variants={{
											out: { opacity: 0, y: 10 },
											in: { opacity: 1, y: 0, transition: { duration: 0.32, ease: EASE } },
											gone: { opacity: 0, transition: { duration: 0.16, ease: EASE } },
										}}
									>
										<TitlePosterCard card={t.card} posterPriority="high" />
									</motion.li>
								))}
							</motion.ul>
						</AnimatePresence>
					</div>
				</div>
			</div>

			{/* The ribbon: full width, every year a frame. The needle stands still in the middle; time moves under it. */}
			<div className="relative mt-5 max-lg:order-2 lg:mt-10">
				<div
					ref={ribbon}
					role="slider"
					tabIndex={0}
					data-keys=""
					data-ribbon=""
					aria-label={`Year. Drag the ribbon or use the arrow keys; Page Up and Page Down move a decade.`}
					aria-valuemin={frames[0].year}
					aria-valuemax={frames[frames.length - 1].year}
					aria-valuenow={frame.year}
					aria-valuetext={`${frame.year}, the ${decade.place.label}`}
					onPointerDown={down}
					onPointerMove={move}
					onPointerUp={up}
					onPointerCancel={up}
					onKeyDown={keys}
					onDragStart={(e) => e.preventDefault()}
					className={`relative h-[11.25rem] touch-pan-y overflow-hidden border-y border-white/[0.07] bg-black/20 select-none ${FOCUS} focus-visible:ring-inset ${grabbing ? "cursor-grabbing" : "cursor-grab"}`}
					style={{
						maskImage:
							"linear-gradient(to right, transparent 0, #000 3.5rem, #000 calc(100% - 3.5rem), transparent 100%)",
					}}
				>
					<span
						aria-hidden
						className="pointer-events-none absolute inset-y-0 left-1/2 w-72 -translate-x-1/2 bg-[radial-gradient(closest-side,rgba(251,191,36,0.10),transparent)]"
					/>
					<motion.div
						className="absolute top-0 left-1/2 h-full will-change-transform"
						style={{ x }}
					>
						{frames.map((f, i) => {
							const on = i === live
							const first = i === 0 || f.d !== frames[i - 1].d
							const lead = f.titles[0]
							return (
								<div
									key={f.year}
									data-frame={i}
									className="absolute top-0 h-full"
									style={{ left: centers[i] - FRAME / 2, width: FRAME }}
								>
									{first && (
										<span
											className={`absolute top-3 left-0 font-display text-sm leading-none font-bold whitespace-nowrap transition-colors duration-[320ms] ${f.d === frame.d ? "text-amber-300" : "text-gray-500"}`}
										>
											{decades[f.d].place.label}
											<span
												aria-hidden
												className={`absolute top-1/2 left-full ml-2 h-px transition-colors duration-[320ms] ${f.d === frame.d ? "bg-amber-300/50" : "bg-white/10"}`}
												style={{
													width: (frames.filter((o) => o.d === f.d).length - 1) * (FRAME + GAP) - 8,
												}}
											/>
										</span>
									)}
									<span
										ref={(el) => {
											framesRef.current[i] = el
										}}
										className={`absolute top-10 left-0 block origin-bottom overflow-hidden rounded-md bg-white/5 will-change-transform transition-shadow duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${on ? "shadow-[0_0_0_2px_#fbbf24,0_12px_28px_rgba(0,0,0,0.55)]" : "ring-1 ring-white/10"}`}
										style={{
											width: FRAME,
											height: FRAME * 1.5,
											...lensOf(Math.abs(centers[i] - centers[data.start])),
										}}
									>
										{lead?.card.poster_path && (
											<img
												src={poster(lead.card.poster_path, "w154")}
												alt=""
												loading={Math.abs(i - data.start) < 14 ? "eager" : "lazy"}
												decoding="async"
												draggable={false}
												className="h-full w-full object-cover"
											/>
										)}
									</span>
									<span
										className={`absolute right-0 bottom-3 left-0 text-center text-xs leading-none tabular-nums transition-colors duration-[160ms] ${on ? "font-bold text-amber-300" : f.d === frame.d ? "text-gray-300" : "text-gray-600"}`}
									>
										{f.year}
									</span>
								</div>
							)
						})}
					</motion.div>
				</div>
				{/* The needle. */}
				<span
					aria-hidden
					className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-amber-400"
				/>
				<span
					aria-hidden
					className="pointer-events-none absolute top-0 left-1/2 h-9 w-px -translate-x-1/2 bg-gradient-to-b from-amber-400/80 to-amber-400/0"
				/>
				<div
					className={`${WRAP} mt-3 flex items-center justify-between gap-4 text-sm text-gray-500`}
				>
					<button
						type="button"
						onClick={() => go(liveRef.current - 1)}
						disabled={live === 0}
						className={`rounded-full px-3 py-1.5 font-semibold whitespace-nowrap text-gray-300 ring-1 ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30 ${FOCUS}`}
					>
						<span aria-hidden>‹</span> Earlier
					</button>
					<span className="max-sm:hidden">
						Drag the ribbon, or use ← and →. Every frame is a year.
					</span>
					<span className="text-center sm:hidden">Drag the ribbon</span>
					<button
						type="button"
						onClick={() => go(liveRef.current + 1)}
						disabled={live === frames.length - 1}
						className={`rounded-full px-3 py-1.5 font-semibold whitespace-nowrap text-gray-300 ring-1 ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30 ${FOCUS}`}
					>
						Later <span aria-hidden>›</span>
					</button>
				</div>
			</div>

			{/* Every decade as a plain link: the way in without dragging, and the page's links for a crawler. */}
			<nav aria-label="Every decade" className={`${WRAP} mt-12 max-lg:order-5`}>
				<ul className="grid gap-x-10 border-t border-white/[0.07] sm:grid-cols-2">
					{[...decades].reverse().map((d) => (
						<li key={d.place.slug} className="border-b border-white/[0.07]">
							<Link
								to={to(place(kind, [ing("decade", d.place.slug)]))}
								prefetch="intent"
								className={`group flex items-baseline gap-4 py-3 ${FOCUS} rounded-sm`}
							>
								<span
									className={`w-16 shrink-0 font-display text-lg font-bold tabular-nums transition-colors duration-[320ms] group-hover:text-amber-200 ${d.place.slug === decade.place.slug ? "text-amber-300" : "text-white"}`}
								>
									{d.place.label}
								</span>
								<span className="min-w-0 flex-1 text-[15px] leading-snug text-gray-400">
									{d.short}
								</span>
								<span
									aria-hidden
									className="text-white/30 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-amber-300"
								>
									›
								</span>
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</div>
	)
}
