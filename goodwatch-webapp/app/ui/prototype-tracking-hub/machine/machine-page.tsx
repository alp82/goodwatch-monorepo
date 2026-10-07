// PROTOTYPE - throwaway (issue #368, map #365). The page at /prototype/tracking-machine: the statechart and the
// transition table of the tracking state machine, a small show to act on, what the member reads, and the decisions
// that are left. The page keeps the events, not the result: every render plays them again through
// app/domain/prototype-tracking-machine, so flipping a decision's switch shows the same presses under the other
// option. The page holds no rule of its own.
import { ArrowUturnLeftIcon, CheckIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import {
	type AnyEvent,
	type CatalogEvent,
	type Episode,
	type MemberEvent,
	RECOMMENDED,
	STATE_LABEL,
	type Settings,
	type Show,
	type World,
	countedEpisode,
	derive,
	episodeLabel,
	eventLabel,
	isSpecial,
	offer,
	play,
	seenButton,
	step,
	watchedIds,
} from "~/domain/prototype-tracking-machine/machine"
import { DECISIONS, type Decision, PRESETS, type Preset, SHOWS, findPreset, findShow } from "~/domain/prototype-tracking-machine/presets"
import { AnswerControl, isAnswered, useAnswers } from "../answers"
import { MACHINE_QUESTIONS } from "../questions"
import { type ChartMove, Statechart } from "./statechart"
import { TransitionTable } from "./transition-table"

const STORAGE_KEY = "PROTOTYPE-tracking-machine-wipe-me"
const SURFACE = "bg-[#141923]"
const CARD = `rounded-2xl border border-white/10 p-4 sm:p-5 ${SURFACE}`
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const BUTTON = `inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS}`
const CHIP = `inline-flex min-h-9 items-center justify-center rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold cursor-pointer ${FOCUS}`
const QUIET = "bg-white/10 text-gray-100 hover:bg-white/20"
const SOLID = "bg-white text-black hover:bg-neutral-200"
const H2 = "text-lg font-bold text-white"
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`

// ---- what the page keeps ---------------------------------------------------------------------------------

interface Stored {
	show: string
	scenario: string | null
	events: AnyEvent[]
	settings: Settings
}

function saved(): Partial<Stored> {
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Stored>
	} catch {
		return {}
	}
}

/** `?scenario=<preset>[&step=<n>|all]` opens a preset with its first n steps made. `?show=<key>` opens a show untouched. */
function load(params: URLSearchParams): Stored {
	const preset = findPreset(params.get("scenario"))
	if (preset) {
		const asked = params.get("step")
		const made = asked === "all" ? preset.steps.length : Math.max(0, Math.min(preset.steps.length, Number(asked) || 0))
		return { show: preset.show, scenario: preset.id, events: preset.steps.slice(0, made), settings: { ...RECOMMENDED, ...preset.settings } }
	}
	const before = saved()
	const settings = { ...RECOMMENDED, ...before.settings }
	const show = findShow(params.get("show"))
	if (show) return { show: show.key, scenario: null, events: [], settings: RECOMMENDED }
	const again = findShow(before.show)
	if (again && Array.isArray(before.events)) return { show: again.key, scenario: findPreset(before.scenario)?.id ?? null, events: before.events, settings }
	return { show: PRESETS[0].show, scenario: PRESETS[0].id, events: [], settings: RECOMMENDED }
}

const same = (a: AnyEvent, b: AnyEvent) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort())

// ---- small pieces -----------------------------------------------------------------------------------------

/** A button for one event. When the machine refuses the event the button is off and says why. */
function EventButton({ label, why, onPress, tone = QUIET, testId, pressed }: { label: ReactNode; why: string; onPress: () => void; tone?: string; testId: string; pressed?: boolean }) {
	return (
		<div className="min-w-0">
			<button type="button" disabled={!!why} aria-pressed={pressed} onClick={onPress} className={`${BUTTON} w-full ${pressed ? "bg-green-500 text-black hover:bg-green-400" : tone}`} data-testid={testId}>
				{label}
			</button>
			{why && (
				<p className="mt-1 text-xs leading-snug text-gray-400" data-testid={`${testId}-why`}>
					{why}
				</p>
			)}
		</div>
	)
}

function Fact({ name, children, testId }: { name: string; children: ReactNode; testId: string }) {
	return (
		<div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-white/[0.07] py-2 last:border-b-0">
			<dt className="w-40 shrink-0 text-sm text-gray-400">{name}</dt>
			<dd className="min-w-0 flex-1 basis-40 text-sm text-gray-100" data-testid={testId}>
				{children}
			</dd>
		</div>
	)
}

const yesNo = (value: boolean, why: string) => (
	<>
		<b className={value ? "text-amber-300" : "text-green-300"}>{value ? "Yes" : "No"}</b>
		<span className="text-gray-400">: {why}</span>
	</>
)

// ---- the episode list ---------------------------------------------------------------------------------------

function EpisodeList({ world, press }: { world: World; press: (event: MemberEvent) => void }) {
	const { show, member } = world
	const watched = watchedIds(show, member)
	const earlier = new Set<string>()
	for (const watch of member.watches) {
		const episode = watch.pass < member.pass ? countedEpisode(show, watch) : null
		if (episode) earlier.add(episode.id)
	}
	if (!show.episodes.length) return <p className="rounded-lg border border-dashed border-white/20 p-3 text-sm text-gray-400">TMDB lists no episodes for this show, so there is nothing to tick. Seen, the score, Want to See, Not interested and Drop still work.</p>
	const seasons = [...new Set(show.episodes.map((e) => e.season))].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : a - b))
	const chip = (episode: Episode) => {
		const on = watched.has(episode.id)
		return (
			<button
				key={`${episode.season}.${episode.number}`}
				type="button"
				disabled={!episode.aired}
				aria-pressed={on}
				title={episode.aired ? (on ? "Untick" : "Tick as watched") : "Has not aired yet"}
				onClick={() => press({ type: on ? "unwatch" : "watch", season: episode.season, number: episode.number })}
				data-testid={`episode-${episode.season}-${episode.number}`}
				data-aired={episode.aired}
				className={`inline-flex h-10 min-w-[3.25rem] items-center justify-center gap-1 rounded-lg px-2 text-sm font-semibold cursor-pointer disabled:cursor-not-allowed ${FOCUS} ${
					!episode.aired ? "border border-dashed border-white/20 text-gray-500" : on ? "bg-green-500 text-black hover:bg-green-400" : `${QUIET} ${earlier.has(episode.id) ? "ring-2 ring-inset ring-green-500/60" : ""}`
				}`}
			>
				{on && <CheckIcon className="h-3.5 w-3.5" />}
				{isSpecial(episode) ? `Sp ${episode.number}` : `E${episode.number}`}
			</button>
		)
	}
	return (
		<div className="space-y-2" data-testid="episodes">
			{seasons.map((season) => (
				<div key={season} className="flex items-start gap-2">
					<span className="w-16 shrink-0 pt-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{season === 0 ? "Specials" : `Season ${season}`}</span>
					<div className="flex flex-wrap gap-1.5">
						{show.episodes
							.filter((e) => e.season === season)
							.sort((a, b) => a.number - b.number)
							.map(chip)}
					</div>
				</div>
			))}
			<p className="text-xs text-gray-500">
				Tap an episode to tick or untick it. Dashed episodes are listed and have not aired, so they can't be ticked.
				{member.pass > 1 && " A green ring marks an episode watched in an earlier pass."}
			</p>
		</div>
	)
}

// ---- a decision ------------------------------------------------------------------------------------------------

function DecisionCard({ decision, settings, setSetting, show }: { decision: Decision; settings: Settings; setSetting: (value: string) => void; show: () => void }) {
	const answers = useAnswers()
	const question = MACHINE_QUESTIONS.find((q) => q.id === decision.id)
	if (!question) return null
	return (
		<li id={decision.id} data-decision={decision.id} className={`scroll-mt-20 rounded-xl border p-3 sm:p-4 ${isAnswered(answers, decision.id) ? "border-green-500/40 bg-green-500/[0.04]" : "border-white/10 bg-white/[0.03]"}`}>
			<div className="flex flex-wrap items-start gap-x-3 gap-y-2">
				<span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs font-bold uppercase text-gray-200">{decision.id}</span>
				<h3 className="min-w-0 flex-1 basis-64 text-base font-bold text-white">{decision.title}</h3>
				<button type="button" onClick={show} className={`${BUTTON} ${SOLID}`} data-testid={`show-${decision.id}`}>
					Show it above
				</button>
			</div>
			<p className="mt-2 max-w-3xl text-sm text-gray-300">{decision.text}</p>
			<div className="mt-3 grid gap-4 md:grid-cols-2">
				<div>
					<p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Run the page with</p>
					<div className="flex flex-col gap-1.5">
						{decision.options.map((option) => {
							const on = settings[decision.id] === option.value
							return (
								<button
									key={option.id}
									type="button"
									aria-pressed={on}
									onClick={() => setSetting(option.value)}
									data-testid={`switch-${decision.id}-${option.id}`}
									className={`flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm ${FOCUS} ${on ? "border-sky-400 bg-sky-400/15 text-white" : "border-white/10 text-gray-300 hover:bg-white/10"}`}
								>
									<span className={`h-3 w-3 shrink-0 rounded-full border ${on ? "border-sky-300 bg-sky-400" : "border-gray-500"}`} />
									<span className="min-w-0 flex-1">{option.label}</span>
								</button>
							)
						})}
					</div>
				</div>
				<AnswerControl question={question} heading="Your answer" />
			</div>
		</li>
	)
}

// ---- the page ----------------------------------------------------------------------------------------------------

const WORLD_EVENTS: { event: CatalogEvent; label: string }[] = [
	{ event: { type: "episodeAirs" }, label: "Next episode airs" },
	{ event: { type: "seasonAirs" }, label: "New season airs" },
	{ event: { type: "showEnds" }, label: "Show ends" },
	{ event: { type: "episodeReadded" }, label: "TMDB re-adds an episode" },
]

export function MachinePage() {
	const [params, setParams] = useSearchParams()
	const paramKey = `${params.get("scenario") ?? ""}|${params.get("step") ?? ""}|${params.get("show") ?? ""}`
	const [stored, setStored] = useState<Stored>(() => load(params))
	const loaded = useRef(paramKey)
	useEffect(() => {
		if (loaded.current === paramKey) return
		loaded.current = paramKey
		setStored(load(params))
	}, [paramKey])
	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
		} catch {}
	}, [stored])

	const show: Show = findShow(stored.show) ?? SHOWS[0]
	const preset: Preset | null = findPreset(stored.scenario)
	const settings = stored.settings
	const played = useMemo(() => play(show, stored.events, settings), [show, stored.events, settings])
	const world = played.world
	const view = derive(world, settings)
	const last = played.steps.length ? played.steps[played.steps.length - 1] : null
	const lastMove: ChartMove | null = last?.row ? { from: last.from, to: last.to, row: last.row } : null

	const press = (event: AnyEvent) => setStored((now) => ({ ...now, events: [...now.events, event] }))
	const undo = () => setStored((now) => ({ ...now, events: now.events.slice(0, -1) }))
	const reset = () => setStored((now) => ({ ...now, events: [] }))
	const open = (next: Record<string, string>) => setParams(next, { replace: true, preventScrollReset: true })
	const top = useRef<HTMLDivElement>(null)

	// What the member could do now, and which rows that would use.
	const possible = useMemo(() => {
		const moves: ChartMove[] = []
		const rows = new Set<string>()
		const tryOne = (event: MemberEvent | CatalogEvent, offered: boolean) => {
			if (!offered) return
			const done = step(world, event, settings)
			if (!done.row) return
			rows.add(done.row.id)
			if (done.from !== done.to) moves.push({ from: done.from, to: done.to, row: done.row })
		}
		const seen = seenButton(world, settings).event
		if (seen) tryOne(seen, true)
		for (const type of ["hold", "drop", "resume", "wantToSee", "notInterested", "watchAgain"] as const) tryOne({ type }, offer(world, { type }, settings).ok)
		tryOne({ type: "rate", score: 7 }, true)
		for (const episode of world.show.episodes) {
			tryOne({ type: "watch", season: episode.season, number: episode.number }, true)
			tryOne({ type: "unwatch", season: episode.season, number: episode.number }, true)
		}
		for (const item of WORLD_EVENTS) tryOne(item.event, true)
		return { moves, rows }
	}, [world, settings])

	const onPath = preset ? stored.events.length <= preset.steps.length && stored.events.every((event, index) => same(event, preset.steps[index])) : false
	const nextStep = preset && onPath ? preset.steps[stored.events.length] : undefined
	const seen = seenButton(world, settings)
	const offers = (type: "hold" | "drop" | "resume" | "wantToSee" | "notInterested" | "watchAgain") => offer(world, { type }, settings).why
	const changed = (Object.keys(RECOMMENDED) as (keyof Settings)[]).filter((key) => settings[key] !== RECOMMENDED[key])
	const passes = [...new Set(world.member.watches.map((watch) => watch.pass))].sort()

	return (
		<div className="mx-auto max-w-7xl overflow-x-clip px-3 pb-32 pt-5 text-white sm:px-5" ref={top}>
			<p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Prototype · nothing here is saved to an account</p>
			<h1 className="mt-1 text-2xl font-bold">Tracking as a state machine</h1>
			<p className="mt-1 max-w-3xl text-sm text-gray-300">
				One state per member and show: Not started, Watching, On hold, Dropped or Seen. It changes only when the member does something. An episode airing, a season starting or a show ending changes what the member reads, never the state. The table below is the whole rule
				set. Is it right?
			</p>
			<p className="mt-2 text-sm text-gray-400">
				<Link to="/prototype/tracking" className="underline underline-offset-2 hover:text-gray-200">
					All tracking decisions
				</Link>
				{" · "}
				<Link to="/prototype/tracking-rules" className="underline underline-offset-2 hover:text-gray-200">
					Earlier version (calendar rules, 27 questions)
				</Link>
				{" · "}
				<a href="#decisions" className="underline underline-offset-2 hover:text-gray-200">
					The {DECISIONS.length} decisions left
				</a>
			</p>

			{/* Presets */}
			<section className={`mt-4 ${CARD}`} data-testid="presets">
				<h2 className={H2}>Start from a case</h2>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{PRESETS.map((item) => (
						<button key={item.id} type="button" aria-pressed={preset?.id === item.id} onClick={() => open({ scenario: item.id })} data-testid={`preset-${item.id}`} className={`${CHIP} ${preset?.id === item.id ? "bg-amber-400 text-black" : QUIET}`}>
							{item.title}
						</button>
					))}
				</div>
				<p className="mt-3 text-sm text-gray-400">Or take a show and press what you like:</p>
				<div className="mt-1.5 flex flex-wrap gap-1.5">
					{SHOWS.map((item) => (
						<button key={item.key} type="button" aria-pressed={!preset && show.key === item.key} onClick={() => open({ show: item.key })} data-testid={`pick-${item.key}`} className={`${CHIP} ${!preset && show.key === item.key ? "bg-amber-400 text-black" : QUIET}`}>
							{item.title}
						</button>
					))}
				</div>
				{preset && (
					<div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.06] p-3" data-testid="preset-card">
						<p className="text-sm text-gray-100">
							<b className="text-white">{preset.title}.</b> {preset.about}
						</p>
						<ol className="mt-2 flex flex-wrap gap-x-1.5 gap-y-1 text-xs">
							{preset.steps.map((event, index) => {
								const done = onPath && index < stored.events.length
								const next = onPath && index === stored.events.length
								return (
									<li key={`${index}-${eventLabel(event)}`} className={`rounded px-1.5 py-1 ${done ? "bg-green-500/20 text-green-200" : next ? "bg-amber-400 font-bold text-black" : "bg-white/[0.06] text-gray-300"}`}>
										{index + 1}. {eventLabel(event)}
									</li>
								)
							})}
						</ol>
						<div className="mt-2.5 flex flex-wrap items-center gap-2">
							{nextStep ? (
								<>
									<button type="button" onClick={() => press(nextStep)} className={`${BUTTON} ${SOLID}`} data-testid="next-step">
										Do step {stored.events.length + 1}: {eventLabel(nextStep)}
									</button>
									<button type="button" onClick={() => setStored((now) => ({ ...now, events: preset.steps }))} className={`${BUTTON} ${QUIET}`} data-testid="play-all">
										Do all steps
									</button>
									<span className="text-xs text-gray-400">Or make the press yourself on the show.</span>
								</>
							) : (
								<span className="text-sm text-gray-300">{onPath ? "All steps are made. Carry on freely, or start it over." : "You left the steps of this case. Carry on freely, or start it over."}</span>
							)}
						</div>
					</div>
				)}
			</section>

			<div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,29rem)_minmax(0,1fr)]">
				{/* The show */}
				<section className={CARD} data-testid="show">
					<div className="flex flex-wrap items-baseline justify-between gap-x-3">
						<h2 className={H2}>{show.title}</h2>
						<span className="text-xs text-gray-400" data-testid="tmdb-status">
							TMDB: {show.running ? "running" : "ended"}
							{view.pass > 1 ? ` · pass ${view.pass}` : ""}
						</span>
					</div>
					<p className="text-sm text-gray-400">{show.about}</p>

					<div className="mt-3 flex flex-wrap items-center gap-2">
						<span className="rounded-full bg-green-500 px-3 py-1 text-sm font-bold text-black" data-testid="label">
							{view.label}
						</span>
						{world.member.wantToSee && <span className="rounded-full bg-sky-400/20 px-3 py-1 text-sm font-semibold text-sky-200">Want to See</span>}
						{world.member.notInterested && <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-gray-200">Not interested</span>}
						{world.member.score !== null && <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-gray-200">Score {world.member.score}</span>}
					</div>

					<div className={`mt-3 rounded-lg border p-2.5 text-sm ${last?.kind === "catalog" ? "border-sky-400/40 bg-sky-400/10 text-sky-100" : "border-white/10 bg-black/25 text-gray-200"}`} aria-live="polite" data-testid="happened">
						{last ? (
							<>
								<b className="text-white">{eventLabel(last.event)}.</b> {last.message}
								{last.row && <span className="text-gray-400"> (row {last.row.id})</span>}
							</>
						) : (
							"Nothing has happened yet. Press something."
						)}
					</div>

					{view.seenQuestion && (
						<div className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3" data-testid="seen-question">
							<p className="text-sm font-bold text-white">Have you seen all of it?</p>
							<div className="mt-2 flex flex-wrap gap-1.5">
								<button type="button" onClick={() => press({ type: "pressSeen" })} className={`${BUTTON} ${SOLID}`} data-testid="seen-question-yes">
									Yes, all of it
								</button>
								<button type="button" onClick={() => press({ type: "answerSeenQuestion", answer: "partway" })} className={`${BUTTON} ${QUIET}`} data-testid="seen-question-partway">
									I'm partway
								</button>
								<button type="button" onClick={() => press({ type: "answerSeenQuestion", answer: "just_rating" })} className={`${BUTTON} ${QUIET}`} data-testid="seen-question-just">
									Just rating
								</button>
							</div>
						</div>
					)}
					{view.ratePrompt && (
						<div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3" data-testid="rate-prompt">
							<p className="min-w-0 flex-1 basis-40 text-sm font-bold text-white">How do you like it so far? Give it a score below.</p>
							<button type="button" onClick={() => press({ type: "dismissRatePrompt" })} className={`${BUTTON} ${QUIET}`} data-testid="rate-prompt-dismiss">
								Not now
							</button>
						</div>
					)}

					<h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">What the member can do</h3>
					<div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-2.5">
						<div className="col-span-2">
							<EventButton label={seen.label} why={seen.event ? "" : seen.why} onPress={() => seen.event && press(seen.event)} tone={SOLID} testId="do-seen" pressed={world.member.state === "seen" && seen.event?.type !== "pressSeen"} />
						</div>
						<EventButton label="On hold" why={offers("hold")} onPress={() => press({ type: "hold" })} testId="do-hold" />
						<EventButton label="Resume" why={offers("resume")} onPress={() => press({ type: "resume" })} testId="do-resume" />
						<EventButton label="Drop" why={offers("drop")} onPress={() => press({ type: "drop" })} testId="do-drop" />
						<EventButton label="Not interested" why={offers("notInterested")} onPress={() => press({ type: "notInterested" })} testId="do-notInterested" pressed={world.member.notInterested} />
						<EventButton label="Want to See" why={offers("wantToSee")} onPress={() => press({ type: "wantToSee" })} testId="do-wantToSee" pressed={world.member.wantToSee} />
						<EventButton label="Watch again" why={offers("watchAgain")} onPress={() => press({ type: "watchAgain" })} testId="do-watchAgain" />
					</div>
					<div className="mt-3">
						<p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Rate</p>
						<div className="mt-1.5 flex flex-wrap gap-1">
							{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
								<button key={score} type="button" aria-pressed={world.member.score === score} onClick={() => press({ type: "rate", score })} data-testid={`rate-${score}`} className={`h-9 w-9 cursor-pointer rounded-lg text-sm font-semibold ${FOCUS} ${world.member.score === score ? "bg-green-500 text-black" : QUIET}`}>
									{score}
								</button>
							))}
							<button type="button" disabled={world.member.score === null} onClick={() => press({ type: "rate", score: null })} className={`${BUTTON} min-h-9 px-2 py-1 ${QUIET}`} data-testid="rate-clear">
								Clear
							</button>
						</div>
					</div>

					<h3 className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Episodes</h3>
					<EpisodeList world={world} press={press} />

					<h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-sky-300">What the world does (nobody presses these)</h3>
					<div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-2.5">
						{WORLD_EVENTS.map((item) => (
							<EventButton key={item.event.type} label={item.label} why={offer(world, item.event, settings).why} onPress={() => press(item.event)} tone="bg-sky-400/15 text-sky-100 hover:bg-sky-400/25" testId={`world-${item.event.type}`} />
						))}
					</div>

					<div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
						<button type="button" disabled={!stored.events.length} onClick={undo} className={`${BUTTON} ${SOLID}`} data-testid="undo">
							<ArrowUturnLeftIcon className="h-4 w-4" />
							Undo{last ? `: ${eventLabel(last.event)}` : ""}
						</button>
						<button type="button" disabled={!stored.events.length} onClick={reset} className={`${BUTTON} ${QUIET}`} data-testid="reset">
							Start over
						</button>
					</div>
				</section>

				{/* The statechart */}
				<section className={CARD}>
					<h2 className={H2}>The machine</h2>
					<p className="text-sm text-gray-400">
						<span className="font-semibold text-green-300">Green</span>: where you are. <span className="font-semibold text-white">White</span>: possible now. <span className="font-semibold text-amber-300">Moving amber</span>: the step just taken.
					</p>
					<div className="-mx-3 mt-2 sm:mx-0">
						<Statechart state={world.member.state} possible={possible.moves} last={lastMove} settings={settings} tick={stored.events.length} />
					</div>
					<p className="mt-2 text-xs text-gray-400">
						"tick" is ticking an episode as watched. "Seen" is the Seen button, "Seen again" one more press on it. Dotted arrows belong to an option that is switched off. "Watch again" is drawn and not built. Rating, Want to See and Not interested are not drawn: they never move the
						state (except Want to See on a dropped show with nothing watched).
					</p>
				</section>

				{/* What the member reads, and the log */}
				<div className="space-y-4 md:col-span-2 xl:col-span-1">
					<section className={CARD} data-testid="derived">
						<h2 className={H2}>What the member reads</h2>
						<p className="text-sm text-gray-400">Worked out from the state, the watches and the catalog each time. None of it is stored.</p>
						<dl className="mt-2">
							<Fact name="Label" testId="d-label">
								<b className="text-white">{view.label}</b>
							</Fact>
							<Fact name="Progress" testId="d-progress">
								{view.aired ? `${view.watched} of ${plural(view.aired, "aired episode")}` : "No episode list"}
								{view.pass > 1 ? ` in pass ${view.pass}` : ""}
							</Fact>
							<Fact name="Next episode" testId="d-next">
								{view.next ? episodeLabel(view.next) : "None"}
							</Fact>
							<Fact name="Hidden by Not seen yet" testId="d-notseenyet">
								{yesNo(view.hiddenByNotSeenYet, view.hiddenByNotSeenYetWhy)}
							</Fact>
							<Fact name="Hidden from recommendations" testId="d-recommendations">
								{yesNo(view.hiddenFromRecommendations, view.hiddenFromRecommendationsWhy)}
							</Fact>
							<Fact name="The page offers" testId="d-offers">
								{view.offers.length ? view.offers.map((o) => (o === "drop" ? "Drop" : "Not interested")).join(" and ") : world.member.state === "dropped" ? "Neither: Resume is offered" : "Neither Not interested nor Drop"}
							</Fact>
							<Fact name="Prompt to rate" testId="d-rateprompt">
								{view.ratePrompt ? "Showing" : world.member.score !== null ? "No: it has a score" : world.member.ratePromptDismissed ? "No: dismissed for this show" : "No: fewer than 3 episodes and no Seen press"}
							</Fact>
						</dl>
						<h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">What is stored</h3>
						<p className="mt-1 text-sm text-gray-200" data-testid="stored">
							State <b className="text-white">{STATE_LABEL[world.member.state]}</b>, pass {world.member.pass}
							{world.member.seenPress ? `, a Seen press that can be taken back (made from ${STATE_LABEL[world.member.seenPress.from]})` : ""}.
						</p>
						{passes.map((pass) => (
							<p key={pass} className="mt-1 text-xs leading-relaxed text-gray-400" data-testid={`watches-pass-${pass}`}>
								<b className="text-gray-200">Watches of pass {pass}:</b>{" "}
								{world.member.watches
									.filter((watch) => watch.pass === pass)
									.map((watch) => `${episodeLabel(watch)} (${watch.origin === "bulk" ? "Seen press, no date" : "by hand"}${countedEpisode(show, watch) ? "" : ", not counted"})`)
									.join(", ")}
							</p>
						))}
						{!world.member.watches.length && <p className="mt-1 text-xs text-gray-400">No watches.</p>}
					</section>

					<section className={CARD} data-testid="log">
						<h2 className={H2}>Log</h2>
						{played.steps.length ? (
							<ol className="mt-2 space-y-1.5">
								{played.steps.map((done, index) => (
									<li key={`${index}-${eventLabel(done.event)}`} className={`rounded-lg px-2.5 py-1.5 text-sm ${index === played.steps.length - 1 ? "bg-amber-400/15" : "bg-white/[0.04]"}`} data-testid={`log-${index + 1}`}>
										<span className="text-gray-400">{index + 1}.</span> <b className={done.kind === "catalog" ? "text-sky-200" : "text-white"}>{eventLabel(done.event)}</b>{" "}
										{done.refused ? (
											<span className="text-red-300">Refused under the current switches: {done.refused}</span>
										) : (
											<>
												<span className="text-gray-300">{done.from === done.to ? `stays ${STATE_LABEL[done.to]}` : `${STATE_LABEL[done.from]} → ${STATE_LABEL[done.to]}`}</span>{" "}
												<span className="whitespace-nowrap rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-gray-200">{done.row ? `row ${done.row.id}` : "no row: a prompt"}</span>
											</>
										)}
									</li>
								))}
							</ol>
						) : (
							<p className="mt-1 text-sm text-gray-400">Empty.</p>
						)}
					</section>
				</div>
			</div>

			{/* The table */}
			<section className={`mt-4 ${CARD}`}>
				<h2 className={H2}>The transition table</h2>
				<p className="mb-3 max-w-3xl text-sm text-gray-400">
					This is the specification. A press does its work on the watches first, then the first row from the top that matches is taken. If no row matches, the press is not possible. "Every aired episode" always means regular episodes of the current pass; specials never count.
				</p>
				<TransitionTable settings={settings} usedRow={last?.row?.id ?? null} possibleRows={possible.rows} />
			</section>

			{/* The decisions */}
			<section id="decisions" className={`mt-4 scroll-mt-20 ${CARD}`}>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<h2 className={H2}>The {DECISIONS.length} decisions left</h2>
					{changed.length > 0 && (
						<button type="button" onClick={() => setStored((now) => ({ ...now, settings: RECOMMENDED }))} className={`${BUTTON} ${QUIET}`} data-testid="switches-reset">
							Run everything as recommended ({changed.map((key) => key.toUpperCase()).join(", ")} differ)
						</button>
					)}
				</div>
				<p className="mt-1 max-w-3xl text-sm text-gray-400">
					Each has a switch that runs the page under an option (the same presses are played again), and your answer, which also shows on the{" "}
					<Link to="/prototype/tracking" className="underline underline-offset-2 hover:text-gray-200">
						decisions page
					</Link>
					. Opening a case or a show sets the switches back to the recommended options.
				</p>
				<ol className="mt-3 space-y-3">
					{DECISIONS.map((decision) => (
						<DecisionCard
							key={decision.id}
							decision={decision}
							settings={settings}
							setSetting={(value) => setStored((now) => ({ ...now, settings: { ...now.settings, [decision.id]: value } }))}
							show={() => {
								const keep = settings[decision.id]
								const found = findPreset(decision.preset)
								if (!found) return
								const made = decision.step === "all" ? found.steps.length : decision.step
								loaded.current = `${found.id}|${decision.step}|`
								setParams({ scenario: found.id, step: String(decision.step) }, { replace: true, preventScrollReset: true })
								setStored({ show: found.show, scenario: found.id, events: found.steps.slice(0, made), settings: { ...RECOMMENDED, ...found.settings, [decision.id]: found.settings?.[decision.id] ?? keep } })
								top.current?.scrollIntoView({ behavior: "smooth", block: "start" })
							}}
						/>
					))}
				</ol>
			</section>
		</div>
	)
}
