// PROTOTYPE - throwaway (issue #368, map #365). The playground of /prototype/tracking-rules: a small show page
// driven by the rules module, a clock, one card per decision, and the list of rule switches. The page keeps the
// presses, not the result: every render plays them again under the current rules, so flipping a switch shows what
// the same presses give under the other reading.
import { ArrowUturnLeftIcon, BookmarkIcon, CheckIcon, ClockIcon, EyeIcon, NoSymbolIcon, PauseIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import {
	CASES,
	type Case,
	type Played,
	RECOMMENDED,
	type RuleSwitch,
	type Setup,
	actionLabel,
	caseParam,
	entryIsOn,
	findSetup,
	outcomeLine,
	play,
	stateLabel,
	withEntry,
} from "~/domain/prototype-tracking-rules/cases"
import { type Action, type Episode, type Rules, SETTLED, type Watch, addDays, episodeLabel, episodeOfWatch, hasAired, seasonStillAiring, todayOf } from "~/domain/prototype-tracking-rules/rules"
import type { Score } from "~/server/scores.server"
import { ScoreButton } from "~/ui/title-actions/ActionButton"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import { AnswerControl, countAnswered, isAnswered, useAnswers } from "./answers"
import { HUB } from "./questions"

const STORAGE_KEY = "PROTOTYPE-tracking-rules-wipe-me"
const SURFACE = "bg-[#141923]"
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const CHIP = `inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`
const CHIP_OFF = "bg-white/10 text-gray-100 hover:bg-white/20"
const TOOL = `inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-black cursor-pointer hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`
const RULE_QUESTIONS = HUB[0].questions

// ---- state: the case, the presses, the rules ---------------------------------------------------------------

interface Stored {
	/** `<case id>` or `<case id>.<set-up key>`. */
	param: string
	actions: Action[]
	rules: Rules
}

function load(asked: string | null): Stored {
	let saved: Partial<Stored> = {}
	try {
		saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
	} catch {}
	const rules = { ...SETTLED, ...saved.rules }
	const wanted = findSetup(asked) ?? findSetup(saved.param ?? null) ?? findSetup(CASES[0].id)
	if (!wanted) throw new Error("No case")
	const param = caseParam(wanted.found, wanted.setup)
	return { param, rules, actions: saved.param === param && Array.isArray(saved.actions) ? saved.actions : [] }
}

/** Whether a press is the one a step asks for. Any score counts as "gives a score". */
const pressKey = (action: Action) => (action.do === "rate" ? "rate" : JSON.stringify(Object.entries(action).sort(([a], [b]) => a.localeCompare(b))))

const DAY_MS = 86_400_000
const fmtDay = (day: string, year = true) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: undefined, day: "numeric", month: "short", year: year ? "numeric" : undefined, timeZone: "UTC" })
const fmtClock = (instant: number) => new Date(instant).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

// ---- the show page ---------------------------------------------------------------------------------------------

function Bar({ value, max }: { value: number; max: number }) {
	return (
		<span className="block h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
			<span className="block h-full rounded-full bg-green-500 transition-[width]" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
		</span>
	)
}

function StatePill({ played }: { played: Played }) {
	const v = played.view
	const fresh = v.progress.aired - v.progress.watched
	const text = stateLabel(v).replace("Seen · new episodes", `Seen · ${plural(fresh, "new episode")}`)
	const look = v.status === "dropped" ? "bg-pink-500/20 text-pink-300 ring-pink-400/40" : v.status === "on_hold" ? "bg-violet-500/20 text-violet-300 ring-violet-400/40" : v.status === "watching" ? "bg-sky-500/20 text-sky-300 ring-sky-400/40" : v.seen ? "bg-green-500/20 text-green-300 ring-green-400/40" : "bg-white/10 text-gray-300 ring-white/20"
	return (
		<span data-testid="state" className={`inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${look}`}>
			{text}
		</span>
	)
}

function watchText(watch: Watch, today: string) {
	const day = watch.date.precision === "moment" ? watch.date.at.slice(0, 10) : watch.date.precision === "day" ? watch.date.day : null
	const when = day === null ? "no date" : day === today ? "today" : fmtDay(day)
	const how = watch.origin.by === "hand" ? "" : watch.origin.by === "import" ? "import" : watch.origin.action === "show" ? "Seen press" : watch.origin.action === "season" ? "season mark" : "up to here"
	return `${how ? `${how} · ` : ""}${when}`
}

function Stage({ setup, played, rules, press }: { setup: Setup; played: Played; rules: Rules; press: (action: Action) => void }) {
	const { world, view: v } = played
	const { member, show } = world
	const [scoring, setScoring] = useState(false)
	const today = todayOf(world.clock, rules)
	const live = show.episodes.filter((e) => !e.removed)
	const watchOf = new Map<number, Watch>()
	const orphans: Watch[] = []
	for (const watch of member.watches) {
		const episode = episodeOfWatch(show, watch, rules)
		if (episode) {
			if (!watchOf.has(episode.tmdbId)) watchOf.set(episode.tmdbId, watch)
		} else if (watch.of.kind === "episode") orphans.push(watch)
	}
	const seasons = [...new Set(live.map((e) => e.season))].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
	const aired = live.filter((e) => e.season > 0 && hasAired(e, today)).sort((a, b) => a.season - b.season || a.number - b.number)
	const lastAired = aired[aired.length - 1]
	const upcoming = live.filter((e) => e.season > 0 && e.airDate !== null && e.airDate > today).sort((a, b) => (a.airDate as string).localeCompare(b.airDate as string))[0]
	const fresh = v.progress.aired - v.progress.watched
	const pressedSeen = member.watches.some((w) => w.origin.by === "bulk" && w.origin.action === "show")
	const seenLit = v.seen || pressedSeen
	const score = (member.rating?.score ?? null) as Score | null
	const showsHide = v.offered.notInterested || v.notInterested
	const big = `inline-flex h-11 w-full min-w-0 items-center justify-center gap-1.5 rounded-lg px-1 text-[11px] leading-tight font-semibold cursor-pointer transition-colors min-[420px]:text-xs disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`
	return (
		<section className={`overflow-hidden rounded-2xl border border-white/10 ${SURFACE}`} data-testid="stage" aria-label="The show page">
			<div className="flex gap-3 p-3 sm:p-4">
				<div className="flex h-28 w-[4.75rem] shrink-0 items-end rounded-lg bg-gradient-to-br from-indigo-500 via-slate-700 to-slate-900 p-1.5 text-[11px] font-black uppercase leading-tight tracking-tight text-white/90 shadow-lg" aria-hidden>
					{setup.show}
				</div>
				<div className="min-w-0 flex-1">
					<h2 className="truncate text-xl font-bold text-white">{setup.show}</h2>
					<p className="text-xs text-gray-400">TV show · {show.tmdbStatus}</p>
					<p className="mt-1 line-clamp-2 text-xs text-gray-500">{show.name}.</p>
					<div className="mt-2 flex flex-wrap items-center gap-2">
						<StatePill played={played} />
						{(v.offered.onHold || v.status === "on_hold") && (
							<button type="button" disabled={v.status === "on_hold"} onClick={() => press({ do: "setOnHold" })} className={`${CHIP} h-6 ${v.status === "on_hold" ? "bg-violet-500 text-white" : CHIP_OFF}`}>
								<PauseIcon className="h-3 w-3" />
								On hold
							</button>
						)}
					</div>
				</div>
			</div>

			<div className="grid grid-cols-[2.75rem_1fr_1fr_1fr] gap-1.5 px-3 sm:px-4">
				<ScoreButton score={score} onClick={() => setScoring(!scoring)} className="!h-11" aria-expanded={scoring} />
				<button type="button" aria-pressed={v.wantToSee} onClick={() => press({ do: v.wantToSee ? "removeWantToSee" : "addWantToSee" })} className={`${big} ${v.wantToSee ? "bg-amber-500 text-black" : "bg-white/10 text-gray-100 hover:bg-white/20"}`} data-testid="want">
					<BookmarkIcon className={`h-4 w-4 shrink-0 ${v.wantToSee ? "" : "text-amber-300"}`} />
					<span>Want to See</span>
				</button>
				<button
					type="button"
					aria-pressed={seenLit}
					disabled={!seenLit && !v.offered.seen}
					title={!seenLit && !v.offered.seen ? "Seen is not offered here" : undefined}
					onClick={() => press({ do: seenLit ? "removeSeen" : "pressSeen" })}
					className={`${big} ${v.seen ? "bg-green-500 text-black" : pressedSeen ? "bg-sky-500 text-black" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}
					data-testid="seen"
				>
					<EyeIcon className={`h-4 w-4 shrink-0 ${seenLit ? "" : "text-green-300"}`} />
					<span>{v.seen ? "Seen" : pressedSeen ? "Caught up" : "Seen"}</span>
				</button>
				{showsHide ? (
					<button type="button" aria-pressed={v.notInterested} disabled={v.notInterested} onClick={() => press({ do: "setNotInterested" })} className={`${big} ${v.notInterested ? "bg-pink-500 text-black !opacity-100" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}>
						<NoSymbolIcon className={`h-4 w-4 shrink-0 ${v.notInterested ? "" : "text-pink-300"}`} />
						<span>Not interested</span>
					</button>
				) : (
					<button type="button" aria-pressed={v.status === "dropped"} disabled={v.status === "dropped" || !v.offered.dropped} onClick={() => press({ do: "setDropped" })} className={`${big} ${v.status === "dropped" ? "bg-pink-500 text-black !opacity-100" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}>
						<NoSymbolIcon className={`h-4 w-4 shrink-0 ${v.status === "dropped" ? "" : "text-pink-300"}`} />
						<span>Dropped</span>
					</button>
				)}
			</div>
			{scoring && (
				<div className="mx-3 mt-2 rounded-xl bg-black/30 p-2 sm:mx-4">
					<ScoreControl
						size="compact"
						value={score}
						onRate={(value) => {
							press({ do: "rate", score: value })
							setScoring(false)
						}}
						onClear={score ? () => press({ do: "removeRating" }) : undefined}
					/>
				</div>
			)}
			{v.promptToRate && (
				<div className="mx-3 mt-2 flex items-center justify-between gap-3 rounded-xl border border-yellow-400/40 bg-yellow-400/10 px-3 py-2 sm:mx-4" data-testid="rate-prompt">
					<p className="text-sm font-semibold text-white">You've watched all of {setup.show}. How was it?</p>
					<span className="flex shrink-0 gap-3 text-xs">
						<button type="button" onClick={() => setScoring(true)} className="cursor-pointer font-bold text-yellow-300 underline underline-offset-2">
							Score it
						</button>
						<button type="button" onClick={() => press({ do: "dismissRatePrompt" })} className="cursor-pointer text-gray-300 underline underline-offset-2">
							Not now
						</button>
					</span>
				</div>
			)}

			<div className="px-3 pt-3 sm:px-4" data-testid="progress">
				{v.progress.hasEpisodeList ? (
					<>
						<p className="flex flex-wrap items-baseline gap-x-2 text-sm">
							<span className="font-semibold text-white">
								{v.progress.watched} of {v.progress.aired} episodes
							</span>
							{v.progress.listed > v.progress.aired && <span className="text-xs text-gray-400">{v.progress.listed - v.progress.aired} not aired yet</span>}
							{v.progress.specialsWatched > 0 && <span className="text-xs text-gray-400">{plural(v.progress.specialsWatched, "special")} watched, not counted</span>}
						</p>
						<div className="mt-1.5">
							<Bar value={v.progress.watched} max={v.progress.aired} />
						</div>
						<div className="mt-2 flex min-h-9 items-center gap-3 text-sm" data-testid="next">
							{v.nextEpisode ? (
								<>
									<p className="min-w-0 flex-1">
										<span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">{v.hasNewEpisodes ? `Seen · ${plural(fresh, "new episode")}` : v.progress.watched > 0 ? "Next episode" : "Start with"}</span>
										<span className="font-semibold text-white">{episodeLabel(v.nextEpisode)}</span>
										<span className="text-gray-400"> · aired {fmtDay(v.nextEpisode.airDate as string)}</span>
									</p>
									<button type="button" onClick={() => press({ do: "markEpisode", season: (v.nextEpisode as Episode).season, number: (v.nextEpisode as Episode).number })} className={`${CHIP} h-9 shrink-0 bg-green-500 px-3 text-black hover:bg-green-400`}>
										<CheckIcon className="h-4 w-4" />
										Watched
									</button>
								</>
							) : v.caughtUp ? (
								<p className="text-gray-300">
									<span className="font-semibold text-white">Caught up.</span> {upcoming ? `${episodeLabel(upcoming)} airs ${fmtDay(upcoming.airDate as string)}.` : "The season is still airing; nothing is listed ahead."}
								</p>
							) : v.progress.aired === 0 ? (
								<p className="text-gray-400">No episode has aired yet.</p>
							) : (
								<p className="font-semibold text-white">You've watched every episode.</p>
							)}
						</div>
					</>
				) : (
					<p className="text-sm text-gray-400">TMDB lists no episodes for this show. It can only be marked Seen as a whole.</p>
				)}
			</div>

			<div className="mt-2 border-t border-white/10">
				{seasons.map((season) => {
					const episodes = live.filter((e) => e.season === season).sort((a, b) => a.number - b.number)
					const airedHere = episodes.filter((e) => hasAired(e, today))
					const watchedHere = airedHere.filter((e) => watchOf.has(e.tmdbId)).length
					const done = airedHere.length > 0 && watchedHere === airedHere.length
					return (
						<div key={season} data-season={season}>
							<div className="flex items-center gap-2 bg-white/[0.04] px-3 py-1.5 sm:px-4">
								<h3 className="flex-1 text-sm font-bold text-white">{season === 0 ? "Specials" : `Season ${season}`}</h3>
								<span className={`text-xs tabular-nums ${done && season > 0 ? "font-semibold text-green-300" : "text-gray-400"}`}>
									{season === 0 ? `${episodes.filter((e) => watchOf.has(e.tmdbId)).length} watched · not counted` : `${watchedHere}/${airedHere.length}`}
									{season > 0 && episodes.length > airedHere.length ? ` · ${episodes.length - airedHere.length} to air` : ""}
								</span>
								{season > 0 && !v.offered.seen && !v.seen && rules.seenPressWhileAiring === "not-offered" && lastAired?.season === season && (
									<button type="button" onClick={() => press({ do: "markUpTo", season: lastAired.season, number: lastAired.number })} className={`${CHIP} h-7 bg-white/10 text-green-300 hover:bg-white/20`}>
										Mark all aired
									</button>
								)}
								{airedHere.length > 0 && !done && (
									<button type="button" onClick={() => press({ do: "markSeason", season })} className={`${CHIP} h-7 bg-white/10 text-green-300 hover:bg-white/20`}>
										{season === 0 ? "Mark all" : "Mark season"}
									</button>
								)}
							</div>
							<ul>
								{episodes.map((episode) => {
									const watch = watchOf.get(episode.tmdbId)
									const isAired = hasAired(episode, today)
									const isNext = v.nextEpisode?.tmdbId === episode.tmdbId
									return (
										<li key={episode.tmdbId} data-ep={episodeLabel(episode)} className={`flex items-center gap-2 border-t border-white/[0.06] px-2 py-0.5 sm:px-3 ${isNext ? "bg-green-500/[0.08]" : ""} ${isAired ? "" : "opacity-50"}`}>
											<button
												type="button"
												aria-pressed={!!watch}
												aria-label={`${watch ? "Watched" : "Mark as watched"}: ${episodeLabel(episode)}`}
												onClick={() => press({ do: watch ? "unmarkEpisode" : "markEpisode", season: episode.season, number: episode.number })}
												className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full ${FOCUS}`}
											>
												<span
													className={`flex h-6 w-6 items-center justify-center rounded-full ${
														watch ? (season === 0 ? "border-2 border-green-400/70 text-green-300" : "bg-green-500 text-black") : isAired ? "border-2 border-white/30 text-transparent hover:border-green-400 hover:text-green-400/60" : "border-2 border-dashed border-white/30 text-gray-500"
													}`}
												>
													{isAired || watch ? <CheckIcon className="h-3.5 w-3.5" /> : <ClockIcon className="h-3 w-3" />}
												</span>
											</button>
											<span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-white">{season === 0 ? `Sp ${episode.number}` : `E${episode.number}`}</span>
											<span className="min-w-0 flex-1 truncate text-xs text-gray-400">
												{episode.airDate ? (isAired ? fmtDay(episode.airDate) : `airs ${fmtDay(episode.airDate)}`) : "no air date"}
												{episode.type !== "standard" && <span className="ml-1.5 rounded bg-white/10 px-1 text-[10px] uppercase text-gray-300">{episode.type === "finale" ? "finale" : "mid-season"}</span>}
												{watch && <span className="ml-1.5 text-green-300/90">{watchText(watch, today)}</span>}
											</span>
											{isNext && <span className="shrink-0 rounded bg-green-500 px-1.5 text-[10px] font-bold uppercase text-black">Next</span>}
											{season > 0 && isAired && !watch && (
												<button type="button" onClick={() => press({ do: "markUpTo", season: episode.season, number: episode.number })} className="shrink-0 cursor-pointer rounded px-1 text-[11px] text-gray-400 underline decoration-white/20 underline-offset-2 hover:text-white" aria-label={`Watched up to ${episodeLabel(episode)}`}>
													up to here
												</button>
											)}
										</li>
									)
								})}
							</ul>
						</div>
					)
				})}
				{orphans.length > 0 && (
					<p className="border-t border-white/10 bg-amber-400/10 px-3 py-2 text-xs text-amber-200 sm:px-4" data-testid="orphans">
						Kept but not counted: {plural(orphans.length, "watch")} of {orphans.map((w) => (w.of.kind === "episode" ? episodeLabel(w.of) : "")).join(", ")}, whose episode id TMDB no longer lists. (A member would not see this line.)
					</p>
				)}
			</div>
		</section>
	)
}

// ---- the clock -------------------------------------------------------------------------------------------------

function Clock({ played, rules, press, undo, restart, canUndo }: { played: Played; rules: Rules; press: (action: Action) => void; undo: () => void; restart: () => void; canUndo: boolean }) {
	const { world, view: v } = played
	const now = Date.parse(world.clock.now)
	const today = todayOf(world.clock, rules)
	const offset = world.clock.utcOffsetMinutes
	const forward = (days: number) => press({ do: "timePasses", to: new Date(now + days * DAY_MS).toISOString().replace(".000Z", "Z") })
	const daysTo = (day: string) => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS)
	const nextAir = world.show.episodes
		.filter((e) => !e.removed && e.airDate !== null && e.airDate > today)
		.map((e) => e.airDate as string)
		.sort()[0]
	// The first day on which no season is airing, under the rules as they are switched now.
	let seasonEnd = 0
	if (v.seasonStillAiring !== null) for (let days = 1; days <= 800 && !seasonEnd; days++) if (seasonStillAiring(world.show, addDays(today, days), rules) === null) seasonEnd = days
	return (
		<section className="rounded-2xl bg-white p-3 text-black" aria-label="Time" data-testid="clock">
			<p className="text-[11px] font-bold uppercase tracking-wide text-fuchsia-700">Prototype clock, not part of the design</p>
			<p className="mt-0.5 text-sm font-bold" data-testid="today">
				Today is {fmtClock(now + offset * 60_000)}
				{offset !== 0 && <span className="font-normal text-neutral-600"> for the member (UTC{offset > 0 ? "+" : "−"}{Math.abs(offset) / 60}); {fmtClock(now)} UTC</span>}
			</p>
			<p className="text-xs text-neutral-600">{v.seasonStillAiring === null ? "No season is still airing." : `Season ${v.seasonStillAiring} is still airing.`}</p>
			<div className="mt-2 grid grid-cols-2 gap-1.5">
				<button type="button" onClick={() => forward(1)} className={`${TOOL} !bg-neutral-900 !text-white hover:!bg-neutral-700`}>
					+1 day
				</button>
				<button type="button" onClick={() => forward(7)} className={`${TOOL} !bg-neutral-900 !text-white hover:!bg-neutral-700`}>
					+1 week
				</button>
				<button type="button" disabled={!nextAir} onClick={() => nextAir && forward(daysTo(nextAir))} className={`${TOOL} !bg-neutral-900 !text-white hover:!bg-neutral-700`} title={nextAir ? `To ${fmtDay(nextAir)}` : "No dated episode ahead"}>
					Next air date{nextAir ? ` (${fmtDay(nextAir, false)})` : ""}
				</button>
				<button type="button" disabled={!seasonEnd} onClick={() => forward(seasonEnd)} className={`${TOOL} !bg-neutral-900 !text-white hover:!bg-neutral-700`} title={seasonEnd ? `To ${fmtDay(addDays(today, seasonEnd))}` : v.seasonStillAiring === null ? "No season is airing" : "Under these rules the season never ends"}>
					{v.seasonStillAiring !== null && !seasonEnd ? "Season never ends" : `Past the season end${seasonEnd ? ` (+${seasonEnd}d)` : ""}`}
				</button>
				<button type="button" disabled={!canUndo} onClick={undo} className={`${TOOL} border border-neutral-300`}>
					<ArrowUturnLeftIcon className="h-3.5 w-3.5" />
					Undo last
				</button>
				<button type="button" onClick={restart} className={`${TOOL} border border-neutral-300`}>
					Start case over
				</button>
			</div>
			<p className="mt-2 text-[11px] leading-snug text-neutral-600">Every jump is also a moment at which the show is looked at. One long jump is "nobody looked in between".</p>
		</section>
	)
}

function History({ played, done }: { played: Played; done: number }) {
	const watches = played.world.member.watches
	const by = (test: (w: Watch) => boolean) => watches.filter(test).length
	return (
		<details className="rounded-2xl bg-white p-3 text-xs text-black" data-testid="history">
			<summary className="cursor-pointer font-bold">State and every press so far ({played.steps.length - done})</summary>
			<p className="mt-2">
				<b>Stored:</b> status {played.world.member.status?.value ?? "none"} · Seen mark {played.world.member.seen ? `${played.world.member.seen.by}, since ${played.world.member.seen.since.slice(0, 10)}` : "none"} · score {played.world.member.rating?.score ?? "none"} · Want to See {played.view.wantToSee ? "yes" : "no"} · Not interested {played.view.notInterested ? "yes" : "no"}
			</p>
			<p>
				<b>Watches:</b> {watches.length} ({by((w) => w.origin.by === "hand")} by hand, {by((w) => w.origin.by === "bulk" && w.origin.action === "show")} by Seen, {by((w) => w.origin.by === "bulk" && w.origin.action === "season")} by Mark season, {by((w) => w.origin.by === "bulk" && w.origin.action === "up-to")} by up to here, {by((w) => w.origin.by === "import")} imported)
			</p>
			<p>
				<b>Hidden by Not seen yet:</b> {played.view.hiddenByNotSeenYet ? "yes" : "no"} · <b>hidden from recommendations:</b> {played.view.hiddenFromRecommendations ? "yes" : "no"}
			</p>
			<ol className="mt-2 list-decimal space-y-1 pl-5">
				{played.steps.map((step, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: an append-only log
					<li key={index} className={index < done ? "text-neutral-500" : ""}>
						{index < done && "(set-up) "}
						{actionLabel(step.action)}. {step.note} <b>{outcomeLine(step.view)}</b>
					</li>
				))}
			</ol>
		</details>
	)
}

// ---- the rule switches ---------------------------------------------------------------------------------------

const RULE_CHOICES: { [K in keyof Rules]: { says: string; values: Rules[K][] } } = {
	seenPressWhileAiring: { says: "Seen pressed while a season airs", values: ["caught-up", "seen", "not-offered"] },
	upcomingSeason: { says: "A season nothing has aired of", values: ["airing", "not-airing", "airing-from-a-week-before"] },
	laterEpisodes: { says: "Later episodes on a Seen show", values: ["stay-seen", "reopen"] },
	airingGapDays: { says: "Days without a new episode that end a season", values: [45, 120] },
	midSeasonGapDays: { says: "The same after a mid-season episode", values: [45, 120, 365] },
	undatedEpisode: { says: "An episode without a date", values: ["keeps-airing", "ignored"] },
	endedStatus: { says: "Ended or Canceled", values: ["closes-season", "ignored-while-episodes-ahead"] },
	seenEvaluation: { says: "When Seen is decided", values: ["when-looked-at", "from-history"] },
	goneEpisode: { says: "A watch whose episode id is gone", values: ["never-counts", "same-number", "same-number-and-date"] },
	nextEpisode: { says: "Next episode", values: ["earliest-unwatched", "after-furthest"] },
	removeSeenRemoves: { says: "Removing Seen removes", values: ["all-bulk", "show-bulk"] },
	airedBy: { says: "\"Today\" for aired", values: ["member-date", "utc-date"] },
	unmarkOnSeen: { says: "Unticking an episode of a Seen show", values: ["removes-seen", "keeps-seen"] },
	specialStartsShow: { says: "A special starts the show", values: [false, true] },
	markUnaired: { says: "A tick on an unaired episode", values: ["allowed", "refused"] },
	backfillWhenListAppears: { says: "Bulk watches when a list appears", values: [true, false] },
}
const RULE_KEYS = Object.keys(RULE_CHOICES) as (keyof Rules)[]

function RulesPanel({ rules, setRules }: { rules: Rules; setRules: (rules: Rules) => void }) {
	const changed = RULE_KEYS.filter((key) => rules[key] !== SETTLED[key]).length
	return (
		<section className="rounded-2xl bg-white p-3 text-black" aria-label="Rule switches" data-testid="rules">
			<p className="text-[11px] font-bold uppercase tracking-wide text-fuchsia-700">Rule switches</p>
			<p className="text-xs text-neutral-600">{changed === 0 ? "Every rule runs as settled." : `${plural(changed, "rule")} differ${changed === 1 ? "s" : ""} from settled.`}</p>
			<div className="mt-2 grid grid-cols-2 gap-1.5">
				<button type="button" onClick={() => setRules(SETTLED)} className={`${TOOL} border border-neutral-300`}>
					Reset to settled
				</button>
				<button type="button" onClick={() => setRules(RECOMMENDED)} className={`${TOOL} !bg-amber-400`}>
					All recommended
				</button>
			</div>
			<ul className="mt-2 grid gap-x-4 sm:grid-cols-2 xl:grid-cols-1">
				{RULE_KEYS.map((key) => {
					const choice = RULE_CHOICES[key]
					const values = choice.values as (string | number | boolean)[]
					const index = values.indexOf(rules[key])
					return (
						<li key={key} className="border-t border-neutral-200 py-1.5">
							<label className="block">
								<span className="block text-xs font-semibold leading-tight">{choice.says}</span>
								<select
									value={index}
									data-rule={key}
									onChange={(event) => setRules({ ...rules, [key]: values[Number(event.target.value)] })}
									className={`mt-0.5 h-7 w-full rounded border px-1 font-mono text-[11px] ${rules[key] === SETTLED[key] ? "border-neutral-300 bg-white" : "border-fuchsia-500 bg-fuchsia-50 font-bold"}`}
								>
									{values.map((value, i) => (
										<option key={String(value)} value={i}>
											{String(value)}
											{value === SETTLED[key] ? " (settled)" : ""}
											{value === RECOMMENDED[key] ? " ★" : ""}
										</option>
									))}
								</select>
							</label>
						</li>
					)
				})}
			</ul>
			<p className="mt-1 text-[11px] text-neutral-500">★ recommended in the report.</p>
		</section>
	)
}

// ---- a decision card -------------------------------------------------------------------------------------------

function SwitchBlock({ ruleSwitch, setup, actions, rules, setRules }: { ruleSwitch: RuleSwitch; setup: Setup; actions: Action[]; rules: Rules; setRules: (rules: Rules) => void }) {
	const all = [...setup.done, ...actions]
	const outcomes = ruleSwitch.entries.map((entry) => outcomeLine(play(setup.start, all, withEntry(rules, ruleSwitch, entry)).view))
	const same = new Set(outcomes).size === 1
	return (
		<div data-switch={ruleSwitch.label}>
			<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Rule: {ruleSwitch.label}</p>
			<div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
				{ruleSwitch.entries.map((entry, index) => {
					const on = entryIsOn(rules, ruleSwitch, entry)
					return (
						<button
							key={entry.label}
							type="button"
							aria-pressed={on}
							onClick={() => setRules(withEntry(rules, ruleSwitch, entry))}
							className={`cursor-pointer rounded-lg px-3 py-2 text-left transition-colors ${FOCUS} ${on ? "bg-sky-500 text-black" : "bg-white/[0.07] text-gray-100 hover:bg-white/15"}`}
						>
							<span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">
								{entry.label}
								{Object.keys(entry.rules).length === 0 && <span className={`rounded px-1 text-[10px] uppercase ${on ? "bg-black/20" : "bg-white/15 text-gray-300"}`}>settled</span>}
								{entry.recommended && <span className={`rounded px-1 text-[10px] uppercase ${on ? "bg-black/20" : "bg-amber-400/20 text-amber-300"}`}>recommended</span>}
							</span>
							<span className={`mt-0.5 block text-xs ${on ? "text-black/80" : "text-gray-400"}`}>→ {outcomes[index]}</span>
						</button>
					)
				})}
			</div>
			{same && <p className="mt-1 text-xs text-gray-500">The same outcome under every reading so far. Keep pressing: the difference shows a step later.</p>}
		</div>
	)
}

function CaseCard({
	found,
	index,
	active,
	stage,
	state,
	played,
	open,
	press,
	setRules,
}: {
	found: Case
	index: number
	active: Setup | null
	stage: ReactNode
	state: Stored
	played: Played
	open: (found: Case, setup: Setup) => void
	press: (action: Action) => void
	setRules: (rules: Rules) => void
}) {
	const answers = useAnswers()
	const ref = useRef<HTMLElement>(null)
	const questions = found.questions.map((question) => RULE_QUESTIONS.find((q) => q.id === question.id)).filter((q) => !!q)
	const answered = questions.filter((q) => isAnswered(answers, q.id)).length
	const letter = found.group === "wording" ? "ABCDEFGH"[index] : String(found.questions[0].number)
	useEffect(() => {
		if (active && ref.current && ref.current.getBoundingClientRect().top < 0) ref.current.scrollIntoView({ block: "start" })
	}, [active])

	// How far the presses have come along the steps of the set-up.
	let pointer = 0
	if (active) {
		// A step that only lets time pass is done once the clock is past it, however the clock got there.
		const skipPassed = (now: string) => {
			for (let step = active.steps[pointer]?.action; step?.do === "timePasses" && step.to <= now; step = active.steps[pointer]?.action) pointer++
		}
		state.actions.forEach((action, i) => {
			if (pointer < active.steps.length && pressKey(action) === pressKey(active.steps[pointer].action)) pointer++
			skipPassed(played.steps[active.done.length + i]?.now ?? "")
		})
	}
	const last = played.steps[played.steps.length - 1]
	const pressed = state.actions.length > 0
	return (
		<article ref={ref} data-case={found.id} data-active={!!active} className={`scroll-mt-20 rounded-2xl border p-3 sm:p-4 ${active ? `border-sky-400/60 ${SURFACE}` : "border-white/10 bg-white/[0.03]"}`}>
			<div className="flex items-start gap-3">
				<span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${found.group === "wording" ? "bg-amber-400 text-black" : "bg-white/10 text-gray-200"}`}>{letter}</span>
				<div className="min-w-0 flex-1">
					<h3 className="text-base font-bold leading-snug text-white">{found.title}</h3>
					<p className="mt-0.5 text-sm text-gray-400">{found.problem}</p>
				</div>
				<span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${answered === questions.length ? "bg-green-500 text-black" : "bg-white/10 text-gray-300"}`}>{answered === questions.length ? "Answered" : questions.length > 1 ? `${answered} of ${questions.length}` : "Open"}</span>
			</div>
			<div className="mt-3 flex flex-wrap gap-2">
				{found.setups.map((setup) => (
					<button key={setup.key} type="button" onClick={() => open(found, setup)} data-setup={caseParam(found, setup)} className={`${CHIP} h-9 px-3 text-sm ${active === setup ? "bg-sky-500 text-black" : "bg-white text-black hover:bg-neutral-200"}`}>
						{active === setup ? `${setup.button} again` : setup.button}
					</button>
				))}
			</div>

			{active && (
				<div className="mt-3 space-y-4">
					<div className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-3 py-2">
						<p className="text-sm font-semibold text-sky-100" data-testid="say">
							{active.say}
						</p>
						<ol className="mt-2 space-y-1">
							{active.steps.map((step, i) => {
								const isTime = step.action.do === "timePasses"
								const past = isTime && step.action.do === "timePasses" && step.action.to <= played.world.clock.now
								return (
									// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list
									<li key={i} className={`flex items-center gap-2 text-sm ${i < pointer ? "text-gray-500 line-through" : i === pointer ? "text-white" : "text-gray-400"}`}>
										<span className="w-4 shrink-0 text-right text-xs tabular-nums">{i + 1}</span>
										<span className="min-w-0 flex-1">{step.label}</span>
										{i === pointer && (
											<button type="button" disabled={past} onClick={() => press(step.action)} data-testid="do-step" className={`${CHIP} h-7 shrink-0 bg-sky-400 text-black hover:bg-sky-300`}>
												Do it
											</button>
										)}
									</li>
								)
							})}
						</ol>
						<p className="mt-1.5 text-xs text-sky-200/70">Presses of the member can be made on the show page itself. What TMDB or the calendar does has only the button here.</p>
					</div>

					<div className="lg:hidden">{stage}</div>

					<p className="rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-gray-200" aria-live="polite" data-testid="happened">
						<span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-400">What just happened</span>
						{pressed && last ? (
							<>
								{last.refused ? `${actionLabel(last.action)}, and nothing changed. ${last.note.replace("Refused: ", "Because ")}` : `${actionLabel(last.action)}. ${last.note}`} <b className="text-white">Now: {outcomeLine(played.view)}.</b>
							</>
						) : (
							<>
								Nothing yet. The show starts as: <b className="text-white">{outcomeLine(played.view)}.</b>
							</>
						)}
					</p>

					{found.switches.length > 0 ? (
						<div className="space-y-3">
							{found.switches.map((ruleSwitch) => (
								<SwitchBlock key={ruleSwitch.label} ruleSwitch={ruleSwitch} setup={active} actions={state.actions} rules={state.rules} setRules={setRules} />
							))}
							<p className="text-xs text-gray-500">Flipping the rule plays your presses again under the other reading. The show page and the line under each option show what they give.</p>
						</div>
					) : (
						<p className="text-xs text-gray-500">The rules module has no switch for this one: the page runs the recommended rule, and the options are for you to answer.</p>
					)}
				</div>
			)}

			{active && (
				<div className="mt-4 space-y-4">
					{questions.map((question) => (
						<AnswerControl key={question.id} question={question} heading={`Your answer · ${question.id}${questions.length > 1 ? ` · ${question.short}` : ""}`} />
					))}
				</div>
			)}
		</article>
	)
}

// ---- the page --------------------------------------------------------------------------------------------------

export function Playground() {
	const [params, setParams] = useSearchParams()
	const [state, setState] = useState<Stored>(() => load(params.get("case")))
	const answers = useAnswers()
	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
		} catch {}
	}, [state])
	// A link from the hub to another case while the page is open.
	const asked = params.get("case")
	useEffect(() => {
		const wanted = findSetup(asked)
		if (wanted && caseParam(wanted.found, wanted.setup) !== state.param) setState((s) => ({ ...s, param: caseParam(wanted.found, wanted.setup), actions: [] }))
	}, [asked])

	const current = findSetup(state.param)
	if (!current) throw new Error("No case")
	const { found: activeCase, setup } = current
	const played = useMemo(() => play(setup.start, [...setup.done, ...state.actions], state.rules), [setup, state.actions, state.rules])
	const press = (action: Action) => setState((s) => ({ ...s, actions: [...s.actions, action] }))
	const setRules = (rules: Rules) => setState((s) => ({ ...s, rules }))
	const open = (found: Case, chosen: Setup) => {
		const param = caseParam(found, chosen)
		setState((s) => ({ ...s, param, actions: [] }))
		const next = new URLSearchParams(params)
		next.set("case", param)
		setParams(next, { replace: true, preventScrollReset: true })
	}
	const stage = (
		<div className="space-y-3">
			<Stage key={state.param} setup={setup} played={played} rules={state.rules} press={press} />
			<Clock played={played} rules={state.rules} press={press} canUndo={state.actions.length > 0} undo={() => setState((s) => ({ ...s, actions: s.actions.slice(0, -1) }))} restart={() => setState((s) => ({ ...s, actions: [] }))} />
			<History played={played} done={setup.done.length} />
		</div>
	)
	const group = (name: Case["group"]) => CASES.filter((c) => c.group === name)
	const card = (found: Case, index: number) => <CaseCard key={found.id} found={found} index={index} active={found === activeCase ? setup : null} stage={stage} state={state} played={played} open={open} press={press} setRules={setRules} />
	return (
		<div className="mx-auto max-w-[1500px] overflow-x-clip px-3 pb-32 pt-5 text-white sm:px-5" data-case-param={state.param}>
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="min-w-0">
					<h1 className="text-2xl font-bold">Tracking rules playground</h1>
					<p className="mt-1 max-w-3xl text-sm text-gray-400">Pick a decision, set its case up, and press the show page as a member would. Then flip the rule: the same presses are played again under the other reading. Answer on the card; the answers are shared with the hub.</p>
				</div>
				<div className="flex items-center gap-3 text-sm">
					<span className="font-semibold" data-testid="answered">
						{countAnswered(answers, RULE_QUESTIONS)} of {RULE_QUESTIONS.length} answered
					</span>
					<Link to="/prototype/tracking" className={`${CHIP} h-9 bg-white px-3 text-sm text-black hover:bg-neutral-200`}>
						<BookmarkIcon className="h-3.5 w-3.5" />
						All questions (hub)
					</Link>
				</div>
			</div>

			<div className="mt-5 grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)_260px]">
				<aside className="hidden lg:block">
					<div className="sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto pr-1">{stage}</div>
				</aside>
				<main className="min-w-0 space-y-3">
					<h2 className="text-sm font-bold uppercase tracking-wide text-amber-300">Eight decisions that change settled wording</h2>
					{group("wording").map(card)}
					<h2 className="pt-4 text-sm font-bold uppercase tracking-wide text-gray-300">The rest of the 27</h2>
					<p className="text-sm text-gray-500">Each number is the surprise's number in the report (docs/prototypes/tracking-rules/README.md).</p>
					{group("rest").map(card)}
				</main>
				<aside className="lg:col-span-2 xl:col-span-1">
					<div className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-5.5rem)] xl:overflow-y-auto">
						<RulesPanel rules={state.rules} setRules={setRules} />
					</div>
				</aside>
			</div>
		</div>
	)
}
