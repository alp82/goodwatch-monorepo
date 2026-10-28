// PROTOTYPE (start page lab, round 6): stage j and k's results module. Two steps with two names and two looks:
// "Tap three you loved" (a row of poster toggles, three header slots labeled Loved, a dice for a random mood, lit
// empty frames before any choice) and "For you" (one recommendation large on its backdrop with ScoreRing and why,
// the others as a small "Also for you" row, like the TV quiz's result). Same box for every state.
import { Link } from "@remix-run/react"
import { HeartIcon as HeartOutline } from "@heroicons/react/24/outline"
import { InformationCircleIcon } from "@heroicons/react/20/solid"
import { type MutableRefObject, type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { tmdbImage, titleHref } from "../../lab/kit"
import type { LabCard } from "../../lab/types"
import { ReadingLine, SeeAll } from "../hero/shared"
import { joinNames } from "../recs/shared"
import { inertProps, NEED } from "./ab-shared"
import { SkeletonRow, ToggleCard } from "./hi-shared"
import { type JkFlow, showsReading } from "./jk-shared"

/** The three slots under a small "Loved" label: dashed frames that take the loved posters. A filled slot undoes it. */
export function JkSlots({
	f,
	w,
	slotRefs,
	landing,
	drop = false,
}: {
	f: JkFlow
	/** A slot's width class. */
	w: string
	/** Filled with the slot elements, for a variant that flies posters into them. */
	slotRefs?: MutableRefObject<(HTMLElement | null)[]>
	/** Keys still in flight: their slot waits empty until the poster lands. */
	landing?: Set<number>
	/** Drop the thumbnail in (the TV quiz's slot animation). */
	drop?: boolean
}) {
	return (
		<div className="flex shrink-0 flex-col items-center gap-1">
			<span className="sr-only" aria-live="polite">
				{f.loved.length} of {NEED} loved
			</span>
			<span aria-hidden className="text-[10px] font-bold uppercase leading-3 tracking-[0.14em] text-gray-400 sm:text-[11px]">
				Loved <span className="tabular-nums text-gray-500">{f.loved.length}/{NEED}</span>
			</span>
			<div className="flex gap-1.5 sm:gap-2" aria-hidden={!f.loved.length}>
				{Array.from({ length: NEED }, (_, i) => {
					const c = f.loved[i]
					const shown = c && !landing?.has(c.key)
					return (
						<span
							key={`slot-${i}`}
							ref={(el) => {
								if (slotRefs) slotRefs.current[i] = el
							}}
							className={`relative block aspect-[2/3] shrink-0 rounded-[5px] ${w} ${shown ? "" : "border-2 border-dashed border-white/25 bg-white/[0.03]"}`}
						>
							{c ? (
								<button
									key={c.key}
									type="button"
									onClick={() => f.toggleLoved(c)}
									aria-label={`Remove ${c.title}`}
									className={`absolute inset-0 cursor-pointer overflow-hidden rounded-[5px] border-2 border-amber-400 shadow-[0_4px_14px_rgb(251_191_36/.3)] outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-white ${shown ? "opacity-100" : "opacity-0"} ${shown && drop ? "jk-drop" : ""}`}
								>
									<img src={tmdbImage(c.poster_path, "w185")} alt="" className="absolute inset-0 h-full w-full object-cover" />
								</button>
							) : null}
						</span>
					)
				})}
			</div>
		</div>
	)
}

/** A die showing five, for "Surprise me". */
function DieIcon({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 20 20" className={className} aria-hidden fill="none">
			<rect x="2.5" y="2.5" width="15" height="15" rx="3.5" stroke="currentColor" strokeWidth="1.7" />
			{[
				[6.6, 6.6],
				[13.4, 6.6],
				[10, 10],
				[6.6, 13.4],
				[13.4, 13.4],
			].map(([cx, cy]) => (
				<circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.35" fill="currentColor" />
			))}
		</svg>
	)
}

/** Surprise me: a random mood. Icon-led and compact, beside the module's title; the die rolls on a tap. */
function Dice({ f }: { f: JkFlow }) {
	const [roll, setRoll] = useState(0)
	return (
		<button
			type="button"
			data-jk-dice=""
			onClick={() => {
				setRoll((r) => r + 1)
				f.surprise()
			}}
			aria-label="Surprise me: a random mood"
			title="Surprise me"
			className="group inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-white/[0.07] pr-1.5 pl-1.5 text-[13px] font-semibold tracking-normal text-gray-200 ring-1 ring-white/12 outline-none transition-colors hover:bg-amber-400/15 hover:text-white hover:ring-amber-400/40 focus-visible:ring-2 focus-visible:ring-amber-400 sm:pr-3 sm:pl-2 sm:text-sm"
		>
			<span key={roll} className={`grid place-items-center ${roll ? "jk-roll" : ""}`}>
				<DieIcon className="h-[18px] w-[18px] text-amber-400" />
			</span>
			<span className="max-sm:hidden">Surprise me</span>
		</button>
	)
}

const Info = () => (
	<InformationCircleIcon className="inline h-4 w-4 -translate-y-px align-middle text-gray-300" aria-label="the info button" />
)

/** The one line under the title: what to do, what's on show (or how a typed search was read), or why these. */
function JkLine({ f }: { f: JkFlow }) {
	const n = f.loved.length
	const more = NEED - n
	if (f.view === "foryou")
		return (
			<>
				Because you loved <b className="font-semibold text-white">{joinNames(f.loved)}</b>
			</>
		)
	if (f.view === "loading")
		return f.reading ? (
			<ReadingLine answer={{ q: f.draft, answeredAs: f.draft, kind: "prompt", reading: f.reading, titles: [] }} className="!text-xs sm:!text-sm" />
		) : (
			<span className="inline-flex items-center gap-2 text-gray-400">
				<span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden />
				Reading your search…
			</span>
		)
	if (n)
		return (
			<>
				Loved <b className="font-semibold text-white">{joinNames(f.loved)}</b> · {more} more
				{f.view === "empty" ? <span className="max-sm:hidden">. Pick a mood or search.</span> : null}
			</>
		)
	if (f.view === "empty") return <>Pick a mood or search to start.</>
	if (showsReading(f) && f.answer) return <ReadingLine answer={f.answer} className="!text-xs sm:!text-sm" />
	return (
		<span className="inline-flex min-w-0 items-center gap-1.5">
			{f.shown?.dot ? <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: f.shown.dot }} /> : null}
			<b className="truncate font-semibold text-white">{f.shown?.text}</b>
			<span className="shrink-0 text-gray-400 max-sm:hidden">
				· <Info /> opens a title
			</span>
		</span>
	)
}

/** The module's header: the title (with the dice) and line on the left, See all or Back, then the Loved slots. */
export function JkHead({ f, slots, className = "", big = false }: { f: JkFlow; slots: ReactNode; className?: string; big?: boolean }) {
	const forYou = f.view === "foryou"
	return (
		<div className={`flex items-center gap-2.5 sm:gap-5 ${className}`}>
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
					<h2
						key={f.heading}
						className={`ab-in min-w-0 truncate font-extrabold tracking-tight text-white ${big ? "text-[17px] leading-7 min-[400px]:text-xl sm:text-2xl lg:text-[28px] lg:leading-9" : "text-lg leading-6 sm:text-[22px] sm:leading-8 lg:text-2xl"}`}
					>
						{f.heading}
					</h2>
					{forYou ? null : <Dice f={f} />}
				</div>
				<div className="mt-0.5 flex min-w-0 truncate text-[13px] leading-5 text-gray-300 sm:mt-1 sm:text-sm [&_p]:truncate">
					<span className="min-w-0 truncate">
						<JkLine f={f} />
					</span>
				</div>
			</div>
			{forYou ? (
				<button
					type="button"
					onClick={f.backToResults}
					aria-label="Back to tap three"
					className="inline-flex h-9 shrink-0 cursor-pointer items-center rounded-lg px-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300 sm:px-3"
				>
					<span aria-hidden>←&nbsp;</span>Back
				</button>
			) : f.view === "results" && f.seeAllQ ? (
				<SeeAll q={f.seeAllQ} className="max-sm:hidden" />
			) : null}
			{slots}
		</div>
	)
}

/**
 * The fixed body under the header: the empty frames, the poster toggles and For you crossfade in place. `col` sizes a
 * poster column (and the frames); `pad` is the side padding, which the poster rows scroll into. `onToggle` lets a
 * variant stage the tap (k's flight); it gets the tapped card's element.
 */
export function JkBody({
	f,
	col,
	pad,
	onToggle,
}: {
	f: JkFlow
	col: string
	pad: string
	onToggle?: (card: LabCard, el: HTMLElement | null) => void
}) {
	const root = useRef<HTMLDivElement>(null)
	const toggle = (card: LabCard) => {
		const el = root.current?.querySelector<HTMLElement>(`[data-jk-key="${card.key}"] .hi-lift`) ?? null
		if (onToggle) onToggle(card, el)
		else f.toggleLoved(card)
	}
	const layer = (on: boolean, from: "up" | "down") => ({
		style: { opacity: on ? 1 : 0, transform: on ? "none" : from === "up" ? "translateY(-12px)" : "translateY(12px)" },
		...inertProps(!on),
	})
	const full = f.loved.length >= NEED
	const some = f.loved.length > 0
	const sourceKey = `${f.source.kind}:${"q" in f.source ? f.source.q : "key" in f.source ? f.source.key : ""}`
	return (
		<div ref={root} className="absolute inset-0">
			<div className="jk-layer" {...layer(f.view === "empty", "up")}>
				<JkEmpty col={col} paused={f.view !== "empty"} />
			</div>
			<div className="jk-layer" {...layer(f.view === "results" || f.view === "loading", "down")}>
				{f.view === "results" || f.view === "loading" ? (
					<Row pad={pad} key={f.loading ? "loading" : sourceKey} className={f.loading ? "" : "ab-in"}>
						{f.loading ? (
							<SkeletonRow col={col} />
						) : (
							f.results.slice(0, 18).map((card, i) => {
								const on = f.isLoved(card)
								return (
									<div key={card.key} data-jk-key={card.key} className={`${col} shrink-0`}>
										<ToggleCard
											card={card}
											className={`w-full ${some && !full && !on ? "jk-dim" : ""}`}
											on={on}
											full={full}
											onToggle={() => toggle(card)}
											priority={i < 5}
										/>
									</div>
								)
							})
						)}
						{f.seeAllQ && !f.loading ? (
							<div className={`${col} flex aspect-[2/3] shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10 ring-inset`}>
								<SeeAll q={f.seeAllQ} />
							</div>
						) : null}
					</Row>
				) : null}
			</div>
			<div className="jk-layer" {...layer(f.view === "foryou", "down")}>
				{f.view === "foryou" ? <JkForYou f={f} pad={pad} /> : null}
			</div>
		</div>
	)
}

/** A poster row that scrolls sideways; top room for the lifted, ringed card and its badge. */
function Row({ children, pad, className = "" }: { children: ReactNode; pad: string; className?: string }) {
	return <div className={`flex min-h-0 gap-3 overflow-x-auto pt-3.5 pb-2.5 [scrollbar-width:none] sm:gap-3.5 ${pad} ${className}`}>{children}</div>
}

const FRAMES = 13

/**
 * Before any choice: a row of softly lit, empty poster frames under a slow lamp, a sheen passing over them one after
 * another; the middle three are dashed and carry a quiet heart, like the slots they will fill. Nothing else: the line
 * above says what to do. It fills exactly the box the posters take.
 */
function JkEmpty({ col, paused }: { col: string; paused: boolean }) {
	const mid = (FRAMES - 1) / 2
	return (
		<div aria-hidden className={`absolute inset-0 overflow-hidden ${paused ? "jk-paused" : ""}`}>
			<div className="absolute inset-x-0 top-3.5 flex justify-center gap-3 sm:gap-3.5">
				{Array.from({ length: FRAMES }, (_, i) => {
					const d = Math.abs(i - mid)
					const heart = d <= 1
					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: decoration
							key={i}
							className={`${col} relative aspect-[2/3] shrink-0 overflow-hidden rounded-lg border-2 ${
								heart
									? "border-dashed border-amber-200/25 bg-gradient-to-b from-amber-100/[0.09] via-white/[0.03] to-white/[0.015]"
									: "border-white/[0.07] bg-gradient-to-b from-white/[0.07] via-white/[0.025] to-white/[0.01]"
							}`}
							style={{ opacity: Math.max(0.14, 1 - d * 0.16) }}
						>
							<span className="jk-sheen" style={{ animationDelay: `${(i * 0.11).toFixed(2)}s` }} />
							{heart ? <HeartOutline className="absolute top-1/2 left-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-amber-200/35 sm:h-8 sm:w-8" /> : null}
						</div>
					)
				})}
			</div>
			{/* A lamp over the frames: amber light from above, breathing slowly (opacity only). */}
			<div
				className="jk-breathe pointer-events-none absolute inset-0"
				style={{ background: "radial-gradient(ellipse 42% 80% at 50% 0%, rgb(251 191 36 / .16), rgb(251 191 36 / .05) 55%, transparent 80%)" }}
			/>
			<div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b from-transparent to-gray-950/70" />
		</div>
	)
}

/** Which loved titles a recommendation came from (the fixtures' neighbor lists). */
function sourcesOf(f: JkFlow, card: LabCard) {
	return f.loved.filter((l) => (f.data.guest.similar[String(l.key)] ?? []).some((c) => c.key === card.key))
}

const kind = (c: LabCard) => (c.media_type === "show" ? "Show" : "Movie")

/**
 * For you: the first recommendation with a backdrop, large on it (title, ScoreRing, why, Keep my taste and Details),
 * and the others as a small "Also for you" row; tapping one features it (the two swap places). Phones: the row sits
 * over the backdrop's foot. Wider: the row is a column beside it.
 */
function JkForYou({ f, pad }: { f: JkFlow; pad: string }) {
	const picks = f.picks
	const sig = picks.map((c) => c.key).join(",")
	// biome-ignore lint/correctness/useExhaustiveDependencies: keyed by the titles
	const initial = useMemo(() => {
		const i = Math.max(0, picks.findIndex((c) => c.backdrop_path))
		const order = [...picks]
		const [top] = order.splice(i, 1)
		return top ? [top, ...order] : order
	}, [sig])
	const [order, setOrder] = useState(initial)
	useEffect(() => setOrder(initial), [initial])
	const top = order[0]
	const rest = order.slice(1, 13)
	if (!top) return null
	const from = sourcesOf(f, top)
	const feature = (i: number) =>
		setOrder((o) => {
			const next = [...o]
			const a = next[0]
			const b = next[i + 1]
			if (!a || !b) return o
			next[0] = b
			next[i + 1] = a
			return next
		})
	return (
		<div className={`absolute inset-0 flex gap-4 pt-2.5 pb-3 sm:pt-3 sm:pb-4 lg:gap-6 ${pad}`}>
			{/* The featured recommendation on its backdrop. */}
			<div className="relative min-w-0 flex-1 overflow-hidden rounded-xl bg-gray-900 ring-1 ring-white/10 sm:flex-[1.3] sm:rounded-2xl">
				{top.backdrop_path ? (
					<img
						key={top.key}
						src={tmdbImage(top.backdrop_path, "w1280")}
						alt=""
						draggable={false}
						className="jk-fade absolute inset-0 h-full w-full object-cover"
					/>
				) : null}
				<div
					aria-hidden
					className="absolute inset-0 max-sm:hidden"
					style={{ background: "linear-gradient(to right, rgb(3 7 18 / .92) 0%, rgb(3 7 18 / .7) 38%, rgb(3 7 18 / .1) 75%), linear-gradient(to top, rgb(3 7 18 / .85), transparent 60%)" }}
				/>
				<div
					aria-hidden
					className="absolute inset-0 sm:hidden"
					style={{ background: "linear-gradient(to bottom, rgb(3 7 18 / .88) 0%, rgb(3 7 18 / .45) 40%, rgb(3 7 18 / .55) 58%, rgb(3 7 18 / .94) 100%)" }}
				/>
				<div key={top.key} className="ab-in absolute inset-x-0 top-0 px-3 pt-2.5 sm:top-auto sm:bottom-0 sm:max-w-[min(100%,460px)] sm:px-5 sm:pb-4 lg:px-6 lg:pb-5">
					<div className="flex items-start gap-2">
						<h3 className="jk-fy-t min-w-0 flex-1 truncate font-extrabold tracking-tight text-white sm:line-clamp-2 sm:whitespace-normal [text-shadow:0_2px_12px_rgb(0_0_0/.7)]">
							{top.title}
						</h3>
						<Link
							to={titleHref(top)}
							prefetch="none"
							aria-label={`Open ${top.title}`}
							className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-950/80 text-gray-100 ring-1 ring-white/25 outline-none hover:text-amber-400 focus-visible:ring-2 focus-visible:ring-amber-400 sm:hidden"
						>
							<InformationCircleIcon className="h-5 w-5" aria-hidden />
						</Link>
					</div>
					<div className="mt-1 flex items-center gap-2.5 sm:mt-2 sm:gap-3">
						<span className="sm:hidden">
							<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: top.goodwatch_overall_score_normalized_percent } }} size={32} label={false} />
						</span>
						<span className="max-sm:hidden">
							<ScoreRing media={{ details: { goodwatch_overall_score_normalized_percent: top.goodwatch_overall_score_normalized_percent } }} size={42} />
						</span>
						<span className="text-xs text-gray-300 sm:text-sm">
							{top.release_year ? `${top.release_year} · ` : ""}
							{kind(top)}
						</span>
						<Link
							to="/sign-up"
							className="ml-auto inline-flex h-7 shrink-0 items-center rounded-full bg-amber-400 px-3 text-xs font-bold text-gray-950 hover:bg-amber-300 sm:hidden"
						>
							Keep my taste
						</Link>
					</div>
					<p className="mt-1 truncate text-xs text-gray-300 sm:mt-2 sm:text-sm">
						{from.length ? (
							<>
								Like <b className="font-semibold text-white">{joinNames(from)}</b>
							</>
						) : (
							"From the three you loved"
						)}
					</p>
					<div className="mt-3 flex items-center gap-2 max-sm:hidden">
						<Link
							to="/sign-up"
							className="inline-flex h-9 items-center rounded-full bg-amber-400 px-4 text-sm font-bold text-gray-950 shadow-[0_6px_20px_rgb(251_191_36/.25)] hover:bg-amber-300"
						>
							Keep my taste
						</Link>
						<Link
							to={titleHref(top)}
							prefetch="none"
							className="inline-flex h-9 items-center gap-1.5 rounded-full bg-gray-950/70 px-3.5 text-sm font-semibold text-gray-100 ring-1 ring-white/20 hover:text-amber-400"
						>
							<InformationCircleIcon className="h-4 w-4" aria-hidden />
							Details
						</Link>
					</div>
				</div>
				{/* Phones: the other recommendations over the backdrop's foot. */}
				<div className="absolute inset-x-0 bottom-0 px-3 pb-2 sm:hidden">
					<AlsoRow f={f} cards={rest} onFeature={feature} />
				</div>
			</div>
			{/* Wider: the other recommendations in a column beside it. */}
			<div className="flex min-w-0 flex-1 flex-col justify-center max-sm:hidden">
				<AlsoRow f={f} cards={rest} onFeature={feature} titles />
			</div>
		</div>
	)
}

/** "Also for you": small posters (the TV quiz's row); a tap features one. Start over sits at the label's end. */
function AlsoRow({ f, cards, onFeature, titles = false }: { f: JkFlow; cards: LabCard[]; onFeature: (i: number) => void; titles?: boolean }) {
	return (
		<div className="min-w-0">
			<div className="mb-1 flex items-center justify-between gap-3 sm:mb-2.5">
				<h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-300 sm:text-xs">Also for you</h3>
				<button type="button" onClick={f.startOver} className="-my-1 h-7 cursor-pointer rounded-md px-1.5 text-xs font-semibold text-gray-400 hover:text-white sm:text-sm">
					Start over
				</button>
			</div>
			<ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-0.5 pb-1 [scrollbar-width:none] sm:gap-3">
				{cards.map((c, i) => (
					<li key={c.key} className="jk-also shrink-0">
						<button
							type="button"
							onClick={() => onFeature(i)}
							aria-label={`Show ${c.title}`}
							title={c.title}
							className="hi-tog block w-full cursor-pointer rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<span className="hi-lift block">
								<img
									src={tmdbImage(c.poster_path, "w185")}
									alt=""
									loading="lazy"
									draggable={false}
									className="block aspect-[2/3] w-full rounded-md object-cover shadow-[0_6px_16px_rgb(0_0_0/.5)] ring-1 ring-white/10"
								/>
							</span>
							{titles ? <span className="mt-1.5 block truncate text-xs text-gray-300">{c.title}</span> : null}
						</button>
					</li>
				))}
			</ul>
		</div>
	)
}
