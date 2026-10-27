// PROTOTYPE (start page lab, round 5): stage j and k's results module: a heading that says what's shown, one
// contextual line, three poster slots that fill as the guest taps (in place of h's 1-2-3 steps), and a fixed body
// that crossfades between the empty state (lit ghost frames and starters), the results (posters are the "loved it"
// toggles) and the picks. Each variant gives the frame and the sizes.
import { ArrowPathIcon, FireIcon, InformationCircleIcon, StarIcon } from "@heroicons/react/20/solid"
import { type MutableRefObject, type ReactNode, useRef } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { tmdbImage } from "../../lab/kit"
import type { LabCard } from "../../lab/types"
import { ReadingLine, SeeAll } from "../hero/shared"
import { joinNames, KeepNudge } from "../recs/shared"
import { inertProps, NEED } from "./ab-shared"
import { SkeletonRow, ToggleCard } from "./hi-shared"
import { DChip } from "./jk-chips"
import { type JkFlow, showsReading } from "./jk-shared"

/** The three slots: dashed frames that take the loved posters' thumbnails. A filled slot is a button that undoes it. */
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
		<div className="flex shrink-0 items-center gap-2.5">
			<span className="sr-only" aria-live="polite">
				{f.loved.length} of {NEED} loved
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

/** The one line under the heading: what to do next, the reading of a typed search, or why these picks. */
function JkLine({ f }: { f: JkFlow }) {
	const n = f.loved.length
	const more = NEED - n
	if (f.view === "picks")
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
	if (f.view === "empty")
		return n ? (
			<>
				Loved <b className="font-semibold text-white">{joinNames(f.loved)}</b> · {more} more
			</>
		) : (
			<>Made from three titles you loved</>
		)
	if (!n && showsReading(f) && f.answer) return <ReadingLine answer={f.answer} className="!text-xs sm:!text-sm" />
	if (!n)
		return (
			<>
				<b className="font-semibold text-white">Tap three you loved</b>
				<span className="hidden text-gray-400 sm:inline">
					{" "}
					for picks; <InformationCircleIcon className="inline h-4 w-4 -translate-y-px align-middle text-gray-300" aria-label="the info button" /> opens a title.
				</span>
			</>
		)
	return (
		<>
			Loved <b className="font-semibold text-white">{joinNames(f.loved)}</b> · {more} more
		</>
	)
}

/** The module's header: the heading and line on the left, the slots (and See all, or back to results) on the right. */
export function JkHead({ f, slots, className = "", big = false }: { f: JkFlow; slots: ReactNode; className?: string; big?: boolean }) {
	const { text, dot } = f.heading
	return (
		<div className={`flex items-center gap-3 sm:gap-5 ${className}`}>
			<div className="min-w-0 flex-1">
				<h2
					key={text}
					className={`ab-in flex min-w-0 items-center gap-2 font-extrabold tracking-tight text-white ${big ? "text-xl leading-7 sm:text-2xl lg:text-[28px] lg:leading-9" : "text-lg leading-6 sm:text-[22px] sm:leading-8 lg:text-2xl"}`}
				>
					{dot ? <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: dot }} /> : null}
					<span className="truncate">{text}</span>
				</h2>
				<div className="mt-0.5 min-w-0 truncate text-[13px] leading-5 text-gray-300 sm:mt-1 sm:text-sm [&_p]:truncate">
					<JkLine f={f} />
				</div>
			</div>
			{f.view === "picks" ? (
				<button
					type="button"
					onClick={f.backToResults}
					className="h-9 shrink-0 cursor-pointer items-center rounded-lg px-3 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300 max-sm:hidden sm:inline-flex"
				>
					<span aria-hidden>←&nbsp;</span>Results
				</button>
			) : f.view === "results" && f.seeAllQ ? (
				<SeeAll q={f.seeAllQ} className="max-sm:hidden" />
			) : null}
			{slots}
		</div>
	)
}

/**
 * The fixed body under the header: empty state, results and picks crossfade in place. `col` sizes a poster column
 * (and the ghost frames); `pad` is the side padding, which the poster rows scroll into. `onToggle` lets a variant
 * stage the tap (k's flight); it gets the tapped card's element.
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
	const sourceKey = `${f.source.kind}:${"q" in f.source ? f.source.q : "key" in f.source ? f.source.key : f.starter}`
	return (
		<div ref={root} className="absolute inset-0">
			<div className="jk-layer" {...layer(f.view === "empty", "up")}>
				<JkEmpty f={f} col={col} />
			</div>
			<div className="jk-layer" {...layer(f.view === "results" || f.view === "loading", "down")}>
				{f.view === "results" || f.view === "loading" ? (
					<Row pad={pad} key={f.loading ? "loading" : sourceKey} className={f.loading ? "" : "ab-in"}>
						{f.loading ? (
							<SkeletonRow col={col} />
						) : (
							f.results.slice(0, 18).map((card, i) => (
								<div key={card.key} data-jk-key={card.key} className={`${col} shrink-0`}>
									<ToggleCard card={card} className="w-full" on={f.isLoved(card)} full={full} onToggle={() => toggle(card)} priority={i < 5} />
								</div>
							))
						)}
						{f.seeAllQ && !f.loading ? (
							<div className={`${col} flex aspect-[2/3] shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10 ring-inset`}>
								<SeeAll q={f.seeAllQ} />
							</div>
						) : null}
					</Row>
				) : null}
			</div>
			<div className="jk-layer flex flex-col" {...layer(f.view === "picks", "down")}>
				{f.view === "picks" ? (
					<>
						<Row pad={pad} className="ab-in">
							{f.picks.map((card) => (
								<div key={card.key} className={`${col} shrink-0`}>
									<TitlePosterCard card={card} actions={false} />
								</div>
							))}
						</Row>
						<div className={`flex h-[30px] shrink-0 items-center justify-between gap-3 ${pad}`}>
							<div className="min-w-0 truncate [&_p]:truncate [&_p]:!text-xs sm:[&_p]:!text-sm">
								<KeepNudge>
									<span className="sm:hidden">Keep these picks.</span>
									<span className="hidden sm:inline">Keep these and get new picks every day.</span>
								</KeepNudge>
							</div>
							<div className="flex shrink-0 items-center gap-1">
								<button type="button" onClick={f.backToResults} className="h-8 cursor-pointer rounded-lg px-2 text-xs font-semibold text-amber-400 hover:bg-amber-400/10 sm:hidden">
									← Results
								</button>
								<button type="button" onClick={f.startOver} className="h-8 cursor-pointer rounded-lg px-2 text-xs font-semibold text-gray-400 hover:text-white sm:text-sm">
									Start over
								</button>
							</div>
						</div>
					</>
				) : null}
			</div>
		</div>
	)
}

/** A poster row that scrolls sideways; top room for the lifted, ringed card and its badge. */
function Row({ children, pad, className = "" }: { children: ReactNode; pad: string; className?: string }) {
	return <div className={`flex min-h-0 gap-3 overflow-x-auto pt-3.5 pb-2.5 [scrollbar-width:none] sm:gap-3.5 ${pad} ${className}`}>{children}</div>
}

const GHOSTS = 13

/**
 * Before any choice: a row of softly lit, empty poster frames (ghost cards: a score dot and two title bars), the
 * line, and three one-tap starters. It fills exactly the box the results take.
 */
function JkEmpty({ f, col }: { f: JkFlow; col: string }) {
	const mid = (GHOSTS - 1) / 2
	return (
		<div className="absolute inset-0 overflow-hidden">
			<div aria-hidden className="absolute inset-x-0 top-3.5 flex justify-center gap-3 sm:gap-3.5">
				{Array.from({ length: GHOSTS }, (_, i) => {
					const d = Math.abs(i - mid)
					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: decoration
							key={i}
							className={`${col} relative aspect-[2/3] shrink-0 rounded-lg border-2 border-white/[0.07] bg-gradient-to-b from-white/[0.07] via-white/[0.025] to-white/[0.01]`}
							style={{ opacity: Math.max(0.12, 1 - d * 0.17) }}
						>
							<span className="absolute top-[7%] right-[8%] h-[13%] max-h-7 w-auto aspect-square rounded-full border-2 border-white/[0.08]" />
							<span className="absolute bottom-[13%] left-[10%] h-[3.5%] w-[62%] rounded-full bg-white/[0.07]" />
							<span className="absolute bottom-[6%] left-[10%] h-[3.5%] w-[38%] rounded-full bg-white/[0.05]" />
						</div>
					)
				})}
			</div>
			{/* A lamp over the frames: amber light from above, breathing slowly (opacity only). */}
			<div
				aria-hidden
				className="jk-breathe pointer-events-none absolute inset-0"
				style={{ background: "radial-gradient(ellipse 42% 75% at 50% 0%, rgb(251 191 36 / .16), rgb(251 191 36 / .05) 55%, transparent 80%)" }}
			/>
			<div className="absolute inset-0 flex items-center justify-center px-3">
				<div className="flex max-w-[560px] flex-col items-center gap-3 rounded-2xl bg-gray-950/85 px-4 py-4 text-center shadow-[0_20px_50px_rgb(0_0_0/.6)] ring-1 ring-white/10 sm:gap-3.5 sm:px-6 sm:py-5">
					<p className="text-[15px] font-semibold leading-5 text-white sm:text-base">
						{f.loved.length ? `Pick a mood or search for ${NEED - f.loved.length} more you loved.` : "Pick a mood or search, then tap three you loved."}
					</p>
					<div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
						<DChip
							on={false}
							className="!bg-transparent !shadow-none"
							onClick={() => f.setStarter("popular")}
							swatch={<FireIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />}
							label={<><span className="sm:hidden">Popular</span><span className="max-sm:hidden">Popular now</span></>}
						/>
						<DChip
							on={false}
							className="!bg-transparent !shadow-none"
							onClick={() => f.setStarter("top")}
							swatch={<StarIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />}
							label={<><span className="sm:hidden">Top rated</span><span className="max-sm:hidden">Recent and top rated</span></>}
						/>
						<DChip
							on={false}
							className="!bg-transparent !shadow-none"
							onClick={f.surprise}
							swatch={<ArrowPathIcon className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />}
							label="Surprise me"
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
