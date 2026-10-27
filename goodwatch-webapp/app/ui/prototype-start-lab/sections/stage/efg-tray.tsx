// PROTOTYPE (start page lab, round 3): stage a's fixed-height tray (popular → results → "Loved it" → picks), copied
// unchanged for e, f and g so the three only differ in how the search block is lifted off the scene.
import { useEffect, useRef } from "react"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { tmdbImage } from "../../lab/kit"
import { ReadingLine, SeeAll } from "../hero/shared"
import { joinNames, KeepNudge } from "../recs/shared"
import { inertProps, LovedButton, LovedCount, NEED, type StageFlow } from "./ab-shared"

// One card column: the poster card and its toggle. Phones 96 px, wider screens 132 px.
const COL = "w-[96px] shrink-0 sm:w-[132px]"

/** Fixed height; results and picks swap inside it. */
export function EfgTray({ f }: { f: StageFlow }) {
	const showPicks = f.done && f.picks.length > 0
	// When the guest asks for something (a mood, a search, the third tap) and the tray sits below the fold, bring it
	// into view. Never on first paint or a restore: only on a change after mount.
	const box = useRef<HTMLDivElement>(null)
	const sourceKey = `${f.source.kind}:${"q" in f.source ? f.source.q : "key" in f.source ? f.source.key : ""}:${showPicks}`
	// Compare with the last key, not a first-run flag: dev runs effects twice on mount.
	const last = useRef(sourceKey)
	useEffect(() => {
		if (last.current === sourceKey) return
		last.current = sourceKey
		const el = box.current
		if (!el) return
		const r = el.getBoundingClientRect()
		const room = window.innerHeight - 72 // the lab bar
		if (r.bottom > room) window.scrollBy({ top: Math.min(r.top - 80, r.bottom - room), behavior: "smooth" })
	}, [sourceKey])
	return (
		<div
			ref={box}
			className="pointer-events-auto relative h-[256px] shrink-0 overflow-hidden rounded-2xl bg-gray-950/88 shadow-[0_-10px_40px_rgb(0_0_0/0.45)] ring-1 ring-white/10 sm:h-[328px]">
			<div
				className="absolute inset-0 px-3 pt-2.5 transition-[opacity,transform] duration-300 ease-out sm:px-4 sm:pt-3.5"
				style={{ opacity: showPicks ? 0 : 1, transform: showPicks ? "translateY(-12px)" : "none" }}
				{...inertProps(showPicks)}
			>
				<Results f={f} />
			</div>
			<div
				className="absolute inset-0 px-3 pt-2.5 transition-[opacity,transform] duration-300 ease-out sm:px-4 sm:pt-3.5"
				style={{ opacity: showPicks ? 1 : 0, transform: showPicks ? "none" : "translateY(12px)" }}
				{...inertProps(!showPicks)}
			>
				{showPicks ? <Picks f={f} /> : null}
			</div>
		</div>
	)
}

function Results({ f }: { f: StageFlow }) {
	const full = f.loved.length >= NEED
	const sourceKey = f.source.kind === "popular" ? "popular" : `${f.source.kind}:${"q" in f.source ? f.source.q : f.source.key}`
	return (
		<>
			<div className="flex h-[44px] flex-col justify-center sm:h-[48px]">
				<div className="flex items-center gap-3">
					<h2 className="text-base font-extrabold tracking-tight text-white sm:text-lg">Tap three you loved</h2>
					<span className="text-sm text-gray-300">
						<LovedCount loved={f.loved} />
					</span>
				</div>
				<div className="flex h-5 min-w-0 items-center gap-2 text-xs text-gray-400 sm:text-sm">
					{f.loading ? (
						f.reading ? (
							<ReadingLine answer={{ q: f.draft, answeredAs: f.draft, kind: "prompt", reading: f.reading, titles: [] }} className="min-w-0 flex-1 !text-xs sm:!text-sm" />
						) : (
							<span className="inline-flex items-center gap-2">
								<span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden />
								Reading your search…
							</span>
						)
					) : f.answer && f.source.kind !== "popular" && f.source.kind !== "mood" ? (
						<ReadingLine answer={f.answer} className="min-w-0 flex-1 !text-xs sm:!text-sm" />
					) : (
						<span className="truncate">
							{f.source.kind === "popular" ? "Popular right now" : `Mood: ${f.label}`}
							{f.loved.length ? ` · ${joinNames(f.loved)}` : ""}
						</span>
					)}
					{f.seeAllQ && !f.loading ? <SeeAll q={f.seeAllQ} className="ml-auto -mr-2 h-7 !text-xs sm:!text-sm" /> : null}
				</div>
			</div>
			<div className="relative mt-2">
				{f.loading ? (
					<Row key="loading">
						{Array.from({ length: 10 }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: placeholders
							<div key={i} className={COL}>
								<div className="aspect-[2/3] animate-pulse rounded-lg bg-gray-800/80" style={{ animationDelay: `${i * 80}ms` }} />
								<div className="mt-1.5 h-7 rounded-md bg-gray-800/50 sm:h-8" />
							</div>
						))}
					</Row>
				) : (
					<Row key={sourceKey} className="ab-in">
						{f.results.slice(0, 18).map((card, i) => {
							const on = f.isLoved(card)
							return (
								<div key={card.key} className={COL}>
									<TitlePosterCard card={card} actions={false} posterPriority={i < 4 ? "high" : undefined} />
									<LovedButton on={on} disabled={full} onClick={() => f.toggleLoved(card)} compact />
								</div>
							)
						})}
					</Row>
				)}
			</div>
		</>
	)
}

function Row({ children, className = "" }: { children: React.ReactNode; className?: string }) {
	return <div className={`-mx-3 flex gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] sm:-mx-4 sm:gap-3 sm:px-4 ${className}`}>{children}</div>
}

function Picks({ f }: { f: StageFlow }) {
	return (
		<>
			<div className="flex h-[44px] items-center gap-3 sm:h-[48px]">
				<div className="flex shrink-0 -space-x-2" aria-hidden>
					{f.loved.map((c) => (
						<img key={c.key} src={tmdbImage(c.poster_path, "w185")} alt="" className="aspect-[2/3] w-6 rounded border border-gray-950 object-cover sm:w-7" />
					))}
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="text-base font-extrabold tracking-tight text-white sm:text-lg">Picked for you</h2>
					<p className="truncate text-xs text-gray-300 sm:text-sm">
						Because you loved <b className="text-white">{joinNames(f.loved)}</b>
					</p>
				</div>
				<button type="button" onClick={f.backToResults} className="h-8 shrink-0 cursor-pointer rounded-lg px-2 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300">
					<span aria-hidden>← </span>Results
				</button>
			</div>
			<div className="mt-2">
				<Row className="ab-in !pb-2">
					{f.picks.map((card) => (
						<div key={card.key} className={COL}>
							<TitlePosterCard card={card} actions={false} />
						</div>
					))}
				</Row>
				<div className="flex h-[34px] items-center justify-between gap-3 sm:h-[38px]">
					<div className="min-w-0 truncate text-xs sm:text-sm [&_p]:truncate [&_p]:!text-xs sm:[&_p]:!text-sm">
						<KeepNudge>Keep these and get new picks every day.</KeepNudge>
					</div>
					<button type="button" onClick={f.startOver} className="shrink-0 cursor-pointer text-xs font-semibold text-gray-400 hover:text-white sm:text-sm">
						Start over
					</button>
				</div>
			</div>
		</>
	)
}
