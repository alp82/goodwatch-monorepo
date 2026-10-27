// PROTOTYPE (start page lab, round 4): the tray's two layers for stage h and i, crossfading in a fixed box: results
// whose posters are the "loved it" toggles, then the picks. Each variant gives the frame, the header and the size.
import { InformationCircleIcon } from "@heroicons/react/20/solid"
import type { ReactNode } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { tmdbImage } from "../../lab/kit"
import { ReadingLine, SeeAll } from "../hero/shared"
import { joinNames, KeepNudge } from "../recs/shared"
import { inertProps, LovedCount, NEED, type StageFlow } from "./ab-shared"
import { SkeletonRow, ToggleCard } from "./hi-shared"
import { vocabOf } from "./hi-vocab"

const LAYER = "absolute inset-0 transition-[opacity,transform] duration-300 ease-out"

/** Results and picks, swapped in place. `col` sizes a card column, `pad` is the layer's side padding. */
export function TrayLayers({
	f,
	col,
	pad,
	bleed,
	status = "h-8 sm:h-9",
}: { f: StageFlow; col: string; pad: string; /** The negative margin that undoes `pad` for the poster rows. */ bleed: string; status?: string }) {
	const showPicks = f.done && f.picks.length > 0
	return (
		<>
			<div className={`${LAYER} ${pad}`} style={{ opacity: showPicks ? 0 : 1, transform: showPicks ? "translateY(-12px)" : "none" }} {...inertProps(showPicks)}>
				<Results f={f} col={col} pad={`${pad} ${bleed}`} status={status} />
			</div>
			<div className={`${LAYER} ${pad}`} style={{ opacity: showPicks ? 1 : 0, transform: showPicks ? "none" : "translateY(12px)" }} {...inertProps(!showPicks)}>
				{showPicks ? <Picks f={f} col={col} pad={`${pad} ${bleed}`} status={status} /> : null}
			</div>
		</>
	)
}

function Results({ f, col, pad, status }: { f: StageFlow; col: string; pad: string; status: string }) {
	const full = f.loved.length >= NEED
	const sourceKey = f.source.kind === "popular" ? "popular" : `${f.source.kind}:${"q" in f.source ? f.source.q : f.source.key}`
	const reading = !f.loading && f.answer && (f.source.kind === "typed" || (f.source.kind === "prompt" && !vocabOf(f.source)))
	return (
		<>
			<div className={`flex min-w-0 items-center gap-3 text-xs text-gray-300 sm:text-sm ${status}`}>
				<div className="min-w-0 flex-1">
					{f.loading ? (
						f.reading ? (
							<ReadingLine answer={{ q: f.draft, answeredAs: f.draft, kind: "prompt", reading: f.reading, titles: [] }} className="!text-xs sm:!text-sm" />
						) : (
							<span className="inline-flex items-center gap-2 text-gray-400">
								<span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden />
								Reading your search…
							</span>
						)
					) : reading && f.answer ? (
						<ReadingLine answer={f.answer} className="!text-xs sm:!text-sm" />
					) : (
						<span className="block truncate">
							{f.loved.length ? (
								<>
									Loved <b className="text-white">{joinNames(f.loved)}</b>
								</>
							) : (
								<>
									<b className="font-semibold text-white">Tap the posters you loved.</b>
									<span className="hidden text-gray-400 sm:inline">
										{" "}
										Tap again to undo; <InformationCircleIcon className="inline h-4 w-4 -translate-y-px align-middle text-gray-300" aria-label="the info button" /> opens a title.
									</span>
								</>
							)}
						</span>
					)}
				</div>
				<span className="shrink-0 text-gray-300">
					<LovedCount loved={f.loved} />
				</span>
				{f.seeAllQ && !f.loading ? <SeeAll q={f.seeAllQ} className="-mr-2 hidden h-7 !text-xs sm:inline-flex sm:!text-sm" /> : null}
			</div>
			<Row pad={pad} key={f.loading ? "loading" : sourceKey} className={f.loading ? "" : "ab-in"}>
				{f.loading ? (
					<SkeletonRow col={col} />
				) : (
					f.results.slice(0, 18).map((card, i) => (
						<ToggleCard key={card.key} card={card} className={col} on={f.isLoved(card)} full={full} onToggle={() => f.toggleLoved(card)} priority={i < 4} />
					))
				)}
				{f.seeAllQ && !f.loading ? (
					<div className={`${col} flex aspect-[2/3] shrink-0 items-center justify-center rounded-lg ring-1 ring-white/10 ring-inset`}>
						<SeeAll q={f.seeAllQ} />
					</div>
				) : null}
			</Row>
		</>
	)
}

/** A poster row that scrolls sideways; top room for the lifted, ringed card and its badge. */
function Row({ children, pad, className = "" }: { children: ReactNode; pad: string; className?: string }) {
	return <div className={`flex gap-2.5 overflow-x-auto pt-3 pb-2 [scrollbar-width:none] sm:gap-3.5 ${pad} ${className}`}>{children}</div>
}

function Picks({ f, col, pad, status }: { f: StageFlow; col: string; pad: string; status: string }) {
	return (
		<>
			<div className={`flex min-w-0 items-center gap-2.5 ${status}`}>
				<div className="flex shrink-0 -space-x-2" aria-hidden>
					{f.loved.map((c) => (
						<img key={c.key} src={tmdbImage(c.poster_path, "w185")} alt="" className="aspect-[2/3] w-5 rounded border border-gray-950 object-cover ring-1 ring-amber-400/70 sm:w-6" />
					))}
				</div>
				<p className="min-w-0 flex-1 truncate text-xs text-gray-300 sm:text-sm">
					Because you loved <b className="text-white">{joinNames(f.loved)}</b>
				</p>
				<button type="button" onClick={f.backToResults} className="h-8 shrink-0 cursor-pointer rounded-lg px-2 text-xs font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300 sm:text-sm">
					<span aria-hidden>← </span>Results
				</button>
			</div>
			<Row pad={pad} className="ab-in">
				{f.picks.map((card) => (
					<div key={card.key} className={`${col} shrink-0`}>
						<TitlePosterCard card={card} actions={false} />
					</div>
				))}
			</Row>
			<div className="flex h-[30px] items-center justify-between gap-3">
				<div className="min-w-0 truncate [&_p]:truncate [&_p]:!text-xs sm:[&_p]:!text-sm">
					<KeepNudge>
						<span className="sm:hidden">Keep these picks.</span>
						<span className="hidden sm:inline">Keep these and get new picks every day.</span>
					</KeepNudge>
				</div>
				<button type="button" onClick={f.startOver} className="shrink-0 cursor-pointer text-xs font-semibold text-gray-400 hover:text-white sm:text-sm">
					Start over
				</button>
			</div>
		</>
	)
}
