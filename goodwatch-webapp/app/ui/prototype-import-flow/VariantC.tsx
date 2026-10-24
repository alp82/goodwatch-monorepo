// PROTOTYPE - throwaway. Variant C, "See what comes in": a poster-led preview grouped by where titles land, with a "Worth a look" rail and one Import button.
import { ArrowUpTrayIcon, CheckIcon, StarIcon } from "@heroicons/react/20/solid"
import { ArrowPathIcon } from "@heroicons/react/24/outline"
import {
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceEntry,
	type ImportSourceId,
	importSourceName,
} from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import { primaryButton, secondaryButton, textLink } from "~/ui/imports/shared"
import {
	type FileProblem,
	HISTORY,
	type Kinds,
	type Scenario,
	type Sim,
	type Title,
	fmt,
	plural,
	questionsFor,
} from "./model"

/* ------------------------------------------------------------------------------------------------------------------ */
/* Small helpers                                                                                                      */

const hash = (s: string) => {
	let h = 7
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
	return h
}
/** A stable fake score from the file for a title, 5-10. */
const fileScore = (t: Title) => 5 + (hash(t.id) % 6)
/** When a poster lights up during the run, 0-0.95, scattered so the strips fill in all over. */
const lightAt = (t: Title, group: string) =>
	((hash(`${group}:${t.id}`) % 100) / 100) * 0.95

const day = (iso: string) =>
	new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	})
const sourceOf = (id: ImportSourceId) =>
	IMPORT_SOURCE_LIST.find((s) => s.id === id) as ImportSourceEntry

type GroupKey = "ratings" | "watches" | "want" | "favorites"
const GROUPS: {
	key: GroupKey
	name: string
	offset: number
	unit: [string, string]
}[] = [
	{ key: "ratings", name: "Scores", offset: 0, unit: ["score", "scores"] },
	{ key: "watches", name: "Seen", offset: 3, unit: ["title", "titles"] },
	{ key: "want", name: "Want to See", offset: 7, unit: ["title", "titles"] },
	{
		key: "favorites",
		name: "Favorites",
		offset: 11,
		unit: ["favorite", "favorites"],
	},
]
const EXTRAS: { key: keyof Kinds; unit: [string, string] }[] = [
	{ key: "reviews", unit: ["review", "reviews"] },
	{ key: "lists", unit: ["list", "lists"] },
	{ key: "statuses", unit: ["show status", "show statuses"] },
]

const postersFor = (s: Scenario, offset: number, count: number) => {
	const n = Math.min(s.sample.length, count)
	return Array.from(
		{ length: n },
		(_, i) => s.sample[(i + offset) % s.sample.length],
	)
}

/** Titles coming in with the member's current choices. */
const comingIn = (sim: Sim) => {
	const { kinds } = sim.scenario
	const inc = sim.choices.include
	const k = (key: keyof Kinds) => (inc[key] ? kinds[key] : 0)
	return Math.max(k("watches"), k("ratings")) + k("want") + k("favorites")
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Building blocks                                                                                                    */

function Poster({
	title,
	className = "w-20 sm:w-24",
	lit = true,
	children,
}: { title: Title; className?: string; lit?: boolean; children?: ReactNode }) {
	return (
		<div
			className={`relative aspect-[2/3] shrink-0 overflow-hidden rounded-md border-2 border-gray-800 bg-gray-900 ${className}`}
		>
			<img
				src={title.poster}
				alt={`${title.name} (${title.year})`}
				loading="lazy"
				className={`size-full object-cover transition-opacity duration-500 ${lit ? "opacity-100" : "opacity-25"}`}
			/>
			{children}
		</div>
	)
}

function ScoreMark({
	score,
	className = "",
}: { score: number; className?: string }) {
	return (
		<span
			className={`absolute bottom-1 left-1 inline-flex h-6 items-center gap-0.5 rounded-md bg-gray-950/85 px-1.5 text-xs font-black text-white ring-1 ring-white/40 ${className}`}
		>
			<StarIcon className="size-3 text-amber-400" aria-hidden />
			<span className="sr-only">Score </span>
			{score}
		</span>
	)
}

function Switch({
	on,
	onChange,
	label,
	disabled,
}: {
	on: boolean
	onChange: (on: boolean) => void
	label: string
	disabled?: boolean
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label={label}
			disabled={disabled}
			onClick={() => onChange(!on)}
			className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-indigo-600" : "bg-slate-700"}`}
		>
			<span
				aria-hidden
				className={`inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-[1.125rem]" : "translate-x-0.5"}`}
			/>
		</button>
	)
}

function Bar({
	progress,
	tone = "bg-indigo-500",
}: { progress: number; tone?: string }) {
	return (
		<div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
			<div
				className={`h-full w-full origin-left rounded-full transition-transform duration-200 ${tone}`}
				style={{ transform: `scaleX(${progress})` }}
			/>
		</div>
	)
}

function useFocusOnChange(key: string) {
	const ref = useRef<HTMLHeadingElement>(null)
	const first = useRef(true)
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		ref.current?.focus()
	}, [key])
	return ref
}

const heading =
	"text-xl font-bold tracking-tight text-white outline-none md:text-2xl"

/* ------------------------------------------------------------------------------------------------------------------ */
/* Variant                                                                                                            */

export function VariantC({ sim }: { sim: Sim }) {
	const at = sim.phase.at
	const headingRef = useFocusOnChange(at)
	const showStrips =
		at === "checking" ||
		at === "preview" ||
		at === "running" ||
		at === "failed" ||
		at === "done" ||
		at === "undoing"
	return (
		<div className="flex flex-col gap-10 pb-8">
			{showStrips ? (
				<WhatComesIn sim={sim} headingRef={headingRef} />
			) : (
				<Start sim={sim} headingRef={headingRef} />
			)}
			<History sim={sim} />
		</div>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Start: drop zone, connect, file problems, undone                                                                    */

function Start({
	sim,
	headingRef,
}: { sim: Sim; headingRef: RefObject<HTMLHeadingElement> }) {
	const s = sim.scenario
	const at = sim.phase.at
	const source = sourceOf(s.source)
	if (at === "undone")
		return (
			<section className="flex flex-col items-start gap-3">
				<h2 ref={headingRef} tabIndex={-1} className={heading}>
					Import undone
				</h2>
				<p className="text-gray-300">
					Everything this {source.name} import added is gone from GoodWatch.
				</p>
				{s.undoLeaves?.length ? (
					<div className="flex items-center gap-3">
						<div className="flex gap-1.5">
							{s.undoLeaves.map((t) => (
								<Poster key={t.id} title={t} className="w-12" />
							))}
						</div>
						<p className="text-sm text-gray-400">
							{plural(s.undoLeaves.length, "title")} you changed after the
							import stay as you left them.
						</p>
					</div>
				) : null}
				<button
					type="button"
					className={`${secondaryButton} mt-2`}
					onClick={sim.reset}
				>
					Import a file
				</button>
			</section>
		)
	return (
		<section className="flex flex-col gap-6">
			{s.entry === "connect" && (
				<div className="flex flex-col gap-4 rounded-2xl bg-gray-900/85 p-5 ring-1 ring-white/10 sm:flex-row sm:items-center">
					<SourceMark source={source} />
					<div className="min-w-0 flex-1" aria-live="polite">
						{at === "connecting" ? (
							<>
								<h2
									ref={headingRef}
									tabIndex={-1}
									className="font-bold text-white outline-none"
								>
									Waiting for {source.name}
								</h2>
								<p className="text-sm text-gray-400">
									Approve GoodWatch there. You come right back here.
								</p>
							</>
						) : (
							<>
								<h2 className="font-bold text-white">
									Connect your {source.name} account
								</h2>
								<p className="text-sm text-gray-400">
									{source.gets.join(", ")}. You see every title before anything
									changes.
								</p>
							</>
						)}
					</div>
					{at === "connecting" ? (
						<ArrowPathIcon
							className="size-6 animate-spin text-gray-400"
							aria-hidden
						/>
					) : (
						<button
							type="button"
							className={primaryButton}
							onClick={sim.connect}
						>
							Connect {source.name}
						</button>
					)}
				</div>
			)}
			{s.entry !== "connect" && <DropZone sim={sim} headingRef={headingRef} />}
		</section>
	)
}

function DropZone({
	sim,
	headingRef,
}: { sim: Sim; headingRef: RefObject<HTMLHeadingElement> }) {
	const [over, setOver] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	const at = sim.phase.at
	const reading = at === "reading"
	const problem = sim.phase.at === "problem" ? sim.phase.problem : null
	return (
		<div
			onDragOver={(e) => {
				e.preventDefault()
				setOver(true)
			}}
			onDragLeave={() => setOver(false)}
			onDrop={(e) => {
				e.preventDefault()
				setOver(false)
				sim.takeFile()
			}}
			className={`flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-4 py-10 text-center sm:px-6 md:py-12 ${over ? "border-amber-300 bg-amber-400/10" : "border-white/20 bg-gray-950/50 hover:border-white/35"}`}
		>
			{problem ? (
				<ProblemCard
					sim={sim}
					problem={problem}
					headingRef={headingRef}
					onAgain={() => input.current?.click()}
				/>
			) : (
				<>
					<ArrowUpTrayIcon
						className={`size-12 transition-transform duration-300 ${over ? "-translate-y-1 text-amber-300" : "text-gray-400"}`}
						aria-hidden
					/>
					<h2
						ref={headingRef}
						tabIndex={-1}
						className="text-xl font-bold text-white outline-none md:text-2xl"
					>
						{reading
							? `Reading ${sim.scenario.fileName}`
							: "Drop your export here"}
					</h2>
					<p aria-live="polite" className="max-w-md text-sm text-gray-400">
						{reading
							? "On your device first. Nothing changes yet."
							: "From Letterboxd, IMDb, Trakt, and more. You see the titles before anything changes."}
					</p>
					<button
						type="button"
						className={primaryButton}
						disabled={reading}
						onClick={() => input.current?.click()}
					>
						{reading ? (
							<ArrowPathIcon className="size-5 animate-spin" aria-hidden />
						) : null}
						{reading ? "Reading" : "Choose file"}
					</button>
					<ul
						className="mt-2 flex flex-wrap items-center justify-center gap-1.5"
						aria-label="Works with"
					>
						{IMPORT_SOURCE_LIST.map((src) => (
							<li key={src.id} title={src.name} className="scale-75">
								<SourceMark source={src} />
							</li>
						))}
					</ul>
				</>
			)}
			<input
				ref={input}
				type="file"
				aria-label="Choose an export file"
				className="sr-only"
				tabIndex={-1}
				onChange={(e) => {
					if (e.target.files?.[0]) sim.takeFile()
					e.target.value = ""
				}}
			/>
		</div>
	)
}

const PROBLEMS: Record<
	FileProblem,
	(s: Scenario) => { title: string; body: string; fix: string }
> = {
	streaming: () => ({
		title: "Netflix files don't say what you watched",
		body: "Streaming services like Netflix, Prime Video, and Disney+ only list episode names, without the show or movie behind them, so GoodWatch can't tell what you saw.",
		fix: "If you tracked what you watch somewhere, bring it from there instead:",
	}),
	unknown: (s) => ({
		title: "This isn't an export GoodWatch knows",
		body: `${s.fileName} doesn't look like it came from a movie or show site.`,
		fix: "Pick the file the site gave you, without opening or renaming it. These work:",
	}),
	password: (s) => ({
		title: "This ZIP is locked",
		body: `${s.fileName} needs the password from TV Time's email with your data.`,
		fix: "Open the ZIP with that password on your computer, then drop the unlocked file here.",
	}),
	too_big: (s) => ({
		title: "This file is 34 MB, the limit is 20 MB",
		body: `${s.fileName} has more in it than GoodWatch uses.`,
		fix: "Open the ZIP and drop just the files with your watches, ratings, and watchlist.",
	}),
	empty: (s) => ({
		title: "This file has no titles yet",
		body: `${s.fileName} only has its column names. ${importSourceName(s.source)} may still be getting your export ready.`,
		fix: "Download it again in a few minutes and drop the new file here.",
	}),
}

function ProblemCard({
	sim,
	problem,
	headingRef,
	onAgain,
}: {
	sim: Sim
	problem: FileProblem
	headingRef: RefObject<HTMLHeadingElement>
	onAgain: () => void
}) {
	const p = PROBLEMS[problem](sim.scenario)
	const alternatives =
		problem === "streaming"
			? (["trakt", "tmdb", "plex"] as ImportSourceId[]).map(sourceOf)
			: problem === "unknown"
				? IMPORT_SOURCE_LIST.filter((s) => s.id !== "csv")
				: []
	return (
		<div
			className="w-full max-w-xl rounded-2xl bg-gray-900/85 p-5 text-left ring-1 ring-white/10"
			role="alert"
		>
			<h2
				ref={headingRef}
				tabIndex={-1}
				className="text-lg font-bold text-white outline-none"
			>
				{p.title}
			</h2>
			<p className="mt-2 text-gray-300">{p.body}</p>
			<p className="mt-2 text-gray-300">{p.fix}</p>
			{alternatives.length > 0 && (
				<ul className="mt-3 flex flex-wrap gap-2">
					{alternatives.map((src) => (
						<li
							key={src.id}
							className="flex items-center gap-2 rounded-full bg-slate-800 py-1 pr-3 pl-1 text-sm font-semibold text-gray-200"
						>
							<span className="scale-75">
								<SourceMark source={src} />
							</span>
							{src.name}
							{src.connect ? (
								<span className="font-normal text-gray-400">· connect</span>
							) : null}
						</li>
					))}
				</ul>
			)}
			<div className="mt-4 flex flex-wrap gap-3">
				<button type="button" className={primaryButton} onClick={onAgain}>
					Choose another file
				</button>
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Checking, preview, running, failed, done, undoing                                                                  */

function WhatComesIn({
	sim,
	headingRef,
}: { sim: Sim; headingRef: RefObject<HTMLHeadingElement> }) {
	const s = sim.scenario
	const phase = sim.phase
	const at = phase.at
	const source = sourceOf(s.source)
	const nothingNew =
		at === "preview" && GROUPS.every((g) => s.kinds[g.key] === 0)
	const fromHistory = s.entry === "history"
	const progress =
		phase.at === "checking" ||
		phase.at === "running" ||
		phase.at === "failed" ||
		phase.at === "undoing"
			? phase.progress
			: 0
	// How lit a poster is: during the run it lights up past its moment; undo fades it out again.
	const isLit = (t: Title, g: string) => {
		if (at === "checking") return false
		if (at === "preview" || at === "done") return true
		if (at === "undoing") return lightAt(t, g) >= progress
		return lightAt(t, g) < progress
	}

	if (nothingNew)
		return (
			<section className="flex flex-col items-start gap-3 rounded-2xl bg-gray-900/85 p-5 ring-1 ring-white/10">
				<div className="flex items-center gap-3">
					<SourceMark source={source} />
					<span className="break-all text-sm text-gray-400">{s.fileName}</span>
				</div>
				<h2 ref={headingRef} tabIndex={-1} className={heading}>
					Nothing new in this file
				</h2>
				<p className="text-gray-300">
					All {fmt(s.unchanged)} titles are already in GoodWatch, just as they
					are here
					{s.previous
						? `. You imported this file on ${day(s.previous.at)}.`
						: "."}
				</p>
				<button type="button" className={secondaryButton} onClick={sim.reset}>
					Choose a different file
				</button>
			</section>
		)

	const title =
		at === "checking"
			? `Looking through your ${source.name} ${s.entry === "connect" ? "account" : "file"}`
			: at === "preview"
				? "Here's what comes in"
				: at === "running"
					? "Bringing it in"
					: at === "failed"
						? `Stopped at ${Math.round(progress * 100)}%`
						: at === "undoing"
							? "Undoing"
							: fromHistory && s.previous
								? `Your ${source.name} import from ${day(s.previous.at)}`
								: "Added to GoodWatch"
	const groups = GROUPS.filter((g) => s.kinds[g.key] > 0)
	const showRail =
		at === "checking" ||
		at === "preview" ||
		at === "running" ||
		at === "failed" ||
		((at === "done" || at === "undoing") && !!s.undoLeaves?.length)

	return (
		<section className="flex flex-col gap-6">
			<header className="flex flex-col gap-2">
				<div className="flex items-center gap-3">
					<SourceMark source={source} />
					<span className="min-w-0 break-all text-sm text-gray-400">
						{s.fileName}
					</span>
				</div>
				<h2 ref={headingRef} tabIndex={-1} className={heading}>
					{title}
				</h2>
				<Lead sim={sim} />
			</header>

			<div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
				{showRail && (
					<div className="lg:sticky lg:top-4 lg:order-2">
						<WorthALook sim={sim} />
					</div>
				)}
				<div
					className={`flex min-w-0 flex-col gap-7 ${showRail ? "" : "lg:col-span-2"}`}
				>
					{groups.map((g) => (
						<Strip key={g.key} sim={sim} group={g} isLit={isLit} />
					))}
					<Extras sim={sim} />
				</div>
			</div>

			<ActionBar sim={sim} progress={progress} />
		</section>
	)
}

/** One line under the heading: what's new, what stays, what's still matching. */
function Lead({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const at = sim.phase.at
	const source = importSourceName(s.source)
	if (at === "checking")
		return (
			<p className="text-gray-400">
				Matching every title to GoodWatch. This takes a few seconds.
			</p>
		)
	if (at === "running" && s.runSeconds >= 10)
		return (
			<p className="text-gray-300">
				A big one. It takes a few minutes, and it's fine to leave this page: it
				keeps going, and you'll find it under Past imports.
			</p>
		)
	if (at === "failed")
		return (
			<p className="text-gray-300">
				Everything up to here is saved in GoodWatch and stays. Continue picks up
				where it stopped.
			</p>
		)
	if (at === "done" && s.entry === "history")
		return (
			<p className="text-gray-300">
				This is what it added. Undo takes it all back out.
			</p>
		)
	if (at === "done")
		return (
			<p className="text-gray-300">
				Your scores, Seen, and lists are up to date. Changed your mind? Undo
				takes it all back out.
			</p>
		)
	if (at !== "preview") return null
	return (
		<div className="flex flex-col gap-2 text-gray-300">
			{s.previous ? (
				<p>
					New since your {source} import on {day(s.previous.at)}. The{" "}
					{fmt(s.unchanged)} titles already in GoodWatch stay as they are.
				</p>
			) : s.unchanged ? (
				<p>
					{fmt(s.unchanged)} titles are already in GoodWatch and stay as they
					are.
				</p>
			) : null}
			{s.matching && <MatchingBand sim={sim} />}
		</div>
	)
}

function MatchingBand({ sim }: { sim: Sim }) {
	const m = sim.scenario.matching
	if (!m) return null
	const done = sim.matched >= m.total
	return (
		<div
			className="flex flex-col gap-2 rounded-xl bg-slate-900 p-3 ring-1 ring-white/10"
			aria-live="polite"
		>
			<p className="text-sm">
				{done ? (
					<>All {fmt(m.total)} titles are matched.</>
				) : (
					<>
						Still matching your file: {fmt(sim.matched)} of {fmt(m.total)}. You
						can import what's matched now; the rest comes in on its own when
						it's ready.
					</>
				)}
			</p>
			<Bar
				progress={sim.matched / m.total}
				tone={done ? "bg-emerald-500" : "bg-indigo-500"}
			/>
		</div>
	)
}

function Strip({
	sim,
	group,
	isLit,
}: {
	sim: Sim
	group: (typeof GROUPS)[number]
	isLit: (t: Title, g: string) => boolean
}) {
	const s = sim.scenario
	const at = sim.phase.at
	const [all, setAll] = useState(false)
	const count = s.kinds[group.key]
	const posters = postersFor(s, group.offset, count)
	const shown = all ? posters : posters.slice(0, 10)
	const on = sim.choices.include[group.key]
	const editable = at === "preview"
	const more = count - shown.length
	const setOn = (v: boolean) => {
		const include = { ...sim.choices.include, [group.key]: v }
		if (group.key === "watches") include.episodes = v && s.kinds.episodes > 0
		sim.setChoices({ ...sim.choices, include })
	}
	const label =
		at === "done" || at === "undoing" ? `${group.name} added` : group.name
	const id = `strip-${group.key}`
	return (
		<section aria-labelledby={id}>
			<div className="mb-2 flex items-center gap-3">
				<h3 id={id} className="text-lg font-bold text-white">
					{label}{" "}
					<span className="font-normal text-gray-400">{fmt(count)}</span>
				</h3>
				{group.key === "watches" && s.kinds.episodes > 0 && (
					<span className="text-sm text-gray-400">
						and {plural(s.kinds.episodes, "episode")}
					</span>
				)}
				<span className="flex-1" />
				{posters.length > 10 && (
					<button
						type="button"
						className="text-sm font-semibold text-indigo-300 hover:text-indigo-200"
						aria-expanded={all}
						onClick={() => setAll(!all)}
					>
						{all ? "Show less" : "See all"}
					</button>
				)}
				{(editable || at === "checking") && (
					<label className="flex items-center gap-2 text-sm text-gray-300">
						<span className={on ? "" : "text-gray-500"}>
							{on ? "In" : "Left out"}
						</span>
						<Switch
							on={on}
							onChange={setOn}
							label={`Bring in ${group.name}`}
							disabled={!editable}
						/>
					</label>
				)}
			</div>
			<ul
				className={
					all
						? "flex flex-wrap gap-2"
						: "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
				}
			>
				{shown.map((t) => (
					<li key={t.id}>
						<Poster title={t} lit={on && isLit(t, group.key)}>
							{group.key === "ratings" && at !== "checking" && (
								<ScoreMark score={fileScore(t)} />
							)}
						</Poster>
					</li>
				))}
				{more > 0 && (
					<li className="flex aspect-[2/3] w-20 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-gray-700 text-center text-sm font-semibold text-gray-400 sm:w-24">
						+{fmt(more)}
						<br />
						more
					</li>
				)}
			</ul>
			{!on && editable && (
				<p className="mt-1 text-sm text-gray-500">
					Left out. Nothing in {group.name} changes.
				</p>
			)}
		</section>
	)
}

/** Reviews, lists, statuses, and what GoodWatch doesn't track: one quiet line under the strips. */
function Extras({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const extras = EXTRAS.filter((e) => s.kinds[e.key] > 0)
	if (!extras.length && !s.unsupported) return null
	const editable = sim.phase.at === "preview"
	return (
		<div className="flex flex-col gap-2 text-sm text-gray-400">
			{extras.length > 0 && (
				<div className="flex flex-wrap items-center gap-2">
					<span>Also in the file:</span>
					{extras.map((e) => {
						const on = sim.choices.include[e.key]
						return (
							<button
								key={e.key}
								type="button"
								aria-pressed={on}
								disabled={!editable}
								onClick={() =>
									sim.setChoices({
										...sim.choices,
										include: { ...sim.choices.include, [e.key]: !on },
									})
								}
								className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold disabled:cursor-default ${on ? "bg-slate-700 text-gray-100" : "bg-slate-900 text-gray-500 line-through"}`}
							>
								{on && <CheckIcon className="size-3.5" aria-hidden />}
								{plural(s.kinds[e.key], e.unit[0], e.unit[1])}
							</button>
						)
					})}
				</div>
			)}
			{s.unsupported > 0 && (
				<p>
					{plural(s.unsupported, "item")} GoodWatch doesn't track, like podcasts
					or games, stay out.
				</p>
			)}
		</div>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Worth a look                                                                                                       */

function WorthALook({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const at = sim.phase.at
	const locked = at !== "preview"
	const cards: ReactNode[] = []
	if (at === "done" || at === "undoing") {
		if (s.undoLeaves?.length)
			cards.push(<UndoLeavesCard key="leaves" titles={s.undoLeaves} />)
	} else if (at === "checking") {
		if (questionsFor(s).length)
			cards.push(
				<div
					key="sk"
					className="h-32 w-72 shrink-0 rounded-2xl bg-slate-900 lg:w-full"
					aria-hidden
				/>,
			)
	} else {
		if (s.conflicts.length)
			cards.push(<ScoresCard key="scores" sim={sim} locked={locked} />)
		const guessed = s.unmatched.filter((u) => u.suggestions.length)
		for (const u of guessed)
			cards.push(
				<IsItThisCard
					key={u.raw}
					sim={sim}
					raw={u.raw}
					suggestions={u.suggestions}
					what={u.what}
					locked={locked}
				/>,
			)
		const lost = s.unmatched.filter((u) => !u.suggestions.length)
		if (lost.length)
			cards.push(<NotFoundCard key="lost" names={lost.map((u) => u.raw)} />)
		if (s.matching?.uncertain.length)
			cards.push(
				<UncertainCard
					key="unsure"
					titles={s.matching.uncertain}
					locked={locked}
				/>,
			)
		if (s.sideEffects.offWantToSee.length)
			cards.push(
				<LeavingCard
					key="wts"
					title="Leaving Want to See"
					note="The file says you watched these, so they move to Seen."
					titles={s.sideEffects.offWantToSee}
				/>,
			)
		if (s.sideEffects.offNotInterested.length)
			cards.push(
				<LeavingCard
					key="ni"
					title="Leaving Not interested"
					note="The file says you watched these, so they move to Seen."
					titles={s.sideEffects.offNotInterested}
				/>,
			)
		if (s.undatedWatches)
			cards.push(<UndatedCard key="undated" sim={sim} locked={locked} />)
		if (s.alreadySeenWants.length)
			cards.push(<RewatchCard key="rewatch" sim={sim} locked={locked} />)
	}
	if (!cards.length) return null
	const isUndo = at === "done" || at === "undoing"
	return (
		<aside
			aria-labelledby="worth-a-look"
			className={`transition-opacity ${locked && !isUndo && at !== "checking" ? "opacity-60" : ""}`}
		>
			<h3 id="worth-a-look" className="text-lg font-bold text-white">
				{isUndo ? "If you undo" : "Worth a look"}
			</h3>
			{!isUndo && at !== "checking" && (
				<p className="mb-3 text-sm text-gray-400">
					Each one already has a safe answer. Change only what you want.
				</p>
			)}
			<ul className="-mx-4 mt-2 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
				{cards.map((c, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: cards carry their own keys; the li is a wrapper
					<li key={i} className="w-72 shrink-0 snap-start lg:w-full">
						{c}
					</li>
				))}
			</ul>
		</aside>
	)
}

const railCard =
	"flex h-full flex-col gap-3 rounded-2xl bg-gray-900/85 p-4 ring-1 ring-white/10"

function ScoresCard({ sim, locked }: { sim: Sim; locked: boolean }) {
	const s = sim.scenario
	const source = importSourceName(s.source)
	const c = sim.choices
	const pick = (id: string) => c.conflictPerTitle[id] ?? c.conflictDefault
	const setAll = (v: "keep" | "file") =>
		sim.setChoices({ ...c, conflictDefault: v, conflictPerTitle: {} })
	const flip = (id: string) =>
		sim.setChoices({
			...c,
			conflictPerTitle: {
				...c.conflictPerTitle,
				[id]: pick(id) === "keep" ? "file" : "keep",
			},
		})
	const mine = s.conflicts.filter((x) => pick(x.title.id) === "keep").length
	return (
		<div className={railCard}>
			<div>
				<h4 className="font-bold text-white">
					{plural(s.conflicts.length, "score")} differ
				</h4>
				<p className="text-sm text-gray-400">
					You changed these in GoodWatch, so yours stay. Tap a poster to use{" "}
					{source}'s.
				</p>
			</div>
			{s.conflicts.length > 1 && (
				<div
					className="flex gap-1 rounded-lg bg-slate-800 p-1 text-sm font-semibold"
					role="group"
					aria-label="For all of them"
				>
					{(["keep", "file"] as const).map((v) => {
						const active =
							v === "keep" ? mine === s.conflicts.length : mine === 0
						return (
							<button
								key={v}
								type="button"
								disabled={locked}
								aria-pressed={active}
								onClick={() => setAll(v)}
								className={`flex-1 rounded-md px-2 py-1.5 ${active ? "bg-slate-600 text-white" : "text-gray-400 hover:text-white"}`}
							>
								{v === "keep" ? "Keep all mine" : `All from ${source}`}
							</button>
						)
					})}
				</div>
			)}
			<ul className="grid grid-cols-3 gap-2">
				{s.conflicts.map((x) => {
					const keep = pick(x.title.id) === "keep"
					return (
						<li key={x.title.id}>
							<button
								type="button"
								disabled={locked}
								onClick={() => flip(x.title.id)}
								aria-label={`${x.title.name}: ${keep ? `keeping your ${x.yours}` : `using ${source}'s ${x.theirs}`}. Tap to use ${keep ? `${source}'s ${x.theirs}` : `your ${x.yours}`}.`}
								className="block w-full cursor-pointer text-left disabled:cursor-default"
							>
								<Poster title={x.title} className="w-full">
									<span className="absolute inset-x-0 bottom-0 flex bg-gray-950/90 text-center text-[0.7rem] leading-tight font-bold">
										<span
											className={`flex-1 px-0.5 py-1 transition-opacity ${keep ? "opacity-40" : "bg-indigo-700 text-white"}`}
										>
											<span className="block truncate font-normal">
												{source}
											</span>
											{x.theirs}
										</span>
										<span
											className={`flex-1 px-0.5 py-1 transition-opacity ${keep ? "bg-indigo-700 text-white" : "opacity-40"}`}
										>
											<span className="block font-normal">You</span>
											{x.yours}
										</span>
									</span>
								</Poster>
							</button>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

const WHAT = {
	rating: "a score",
	watch: "a watch",
	want: "Want to See",
} as const

function IsItThisCard({
	sim,
	raw,
	suggestions,
	what,
	locked,
}: {
	sim: Sim
	raw: string
	suggestions: Title[]
	what: keyof typeof WHAT
	locked: boolean
}) {
	const c = sim.choices
	const chosen = c.matches[raw]
	const set = (v: string) =>
		sim.setChoices({ ...c, matches: { ...c.matches, [raw]: v } })
	return (
		<div className={railCard}>
			<div>
				<h4 className="font-bold text-white">Is it this?</h4>
				<p className="text-sm text-gray-400">
					Your file says{" "}
					<span className="font-semibold text-gray-200">{raw}</span>, with{" "}
					{WHAT[what]}.
				</p>
			</div>
			<div className="flex gap-2">
				{suggestions.map((t) => {
					const yes = chosen === t.id
					return (
						<button
							key={t.id}
							type="button"
							disabled={locked}
							aria-pressed={yes}
							onClick={() => set(yes ? "" : t.id)}
							className={`flex w-24 cursor-pointer flex-col gap-1 rounded-lg p-1 text-left text-xs disabled:cursor-default ${yes ? "bg-indigo-700/50 ring-2 ring-indigo-400" : "hover:bg-slate-800"}`}
						>
							<Poster title={t} className="w-full" lit={chosen !== "skip"}>
								{yes && (
									<span className="absolute top-1 right-1 rounded-full bg-indigo-600 p-0.5">
										<CheckIcon className="size-4 text-white" aria-hidden />
									</span>
								)}
							</Poster>
							<span className="font-semibold text-gray-200">
								{suggestions.length > 1 ? "This one" : "Yes, this"}
								<span className="sr-only">: {t.name}</span>
							</span>
							<span className="text-gray-400">
								{t.name} ({t.year})
							</span>
						</button>
					)
				})}
			</div>
			<div className="flex items-center gap-3 text-sm">
				<button
					type="button"
					disabled={locked}
					aria-pressed={chosen === "skip"}
					onClick={() => set(chosen === "skip" ? "" : "skip")}
					className={chosen === "skip" ? "font-semibold text-white" : textLink}
				>
					{chosen === "skip"
						? "Leaving it out"
						: suggestions.length > 1
							? "Neither, leave it out"
							: "No, leave it out"}
				</button>
				{!chosen && (
					<span className="text-gray-500">Stays out unless you pick</span>
				)}
			</div>
		</div>
	)
}

function NotFoundCard({ names }: { names: string[] }) {
	return (
		<div className={railCard}>
			<div>
				<h4 className="font-bold text-white">
					{plural(names.length, "title")} not in GoodWatch
				</h4>
				<p className="text-sm text-gray-400">
					They stay out. Nothing else changes.
				</p>
			</div>
			<details className="text-sm text-gray-300">
				<summary className="cursor-pointer font-semibold text-indigo-300">
					Which ones
				</summary>
				<ul className="mt-2 flex flex-col gap-1">
					{names.map((n) => (
						<li key={n}>{n}</li>
					))}
				</ul>
			</details>
		</div>
	)
}

function UncertainCard({
	titles,
	locked,
}: { titles: Title[]; locked: boolean }) {
	// The model has no choice for these; the answer is kept here only.
	const [answers, setAnswers] = useState<Record<string, boolean>>({})
	return (
		<div className={railCard}>
			<div>
				<h4 className="font-bold text-white">
					Not sure about{" "}
					{titles.length === 1 ? "this one" : `these ${titles.length}`}
				</h4>
				<p className="text-sm text-gray-400">
					Tap the right ones. The others wait until you check them.
				</p>
			</div>
			<ul className="grid grid-cols-4 gap-2">
				{titles.map((t) => {
					const yes = !!answers[t.id]
					return (
						<li key={t.id}>
							<button
								type="button"
								disabled={locked}
								aria-pressed={yes}
								aria-label={`${t.name} (${t.year}): ${yes ? "right" : "not checked yet"}`}
								onClick={() => setAnswers({ ...answers, [t.id]: !yes })}
								className={`block w-full cursor-pointer rounded-md disabled:cursor-default ${yes ? "ring-2 ring-indigo-400" : ""}`}
							>
								<Poster title={t} className="w-full" lit={yes}>
									{yes && (
										<span className="absolute top-1 right-1 rounded-full bg-indigo-600 p-0.5">
											<CheckIcon className="size-3 text-white" aria-hidden />
										</span>
									)}
								</Poster>
							</button>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

function LeavingCard({
	title,
	note,
	titles,
}: { title: string; note: string; titles: Title[] }) {
	return (
		<div className={railCard}>
			<div>
				<h4 className="font-bold text-white">
					{title}{" "}
					<span className="font-normal text-gray-400">
						{fmt(titles.length)}
					</span>
				</h4>
				<p className="text-sm text-gray-400">{note}</p>
			</div>
			<ul className="flex flex-wrap gap-1.5">
				{titles.map((t) => (
					<li key={t.id}>
						<Poster title={t} className="w-12" />
					</li>
				))}
			</ul>
		</div>
	)
}

function UndatedCard({ sim, locked }: { sim: Sim; locked: boolean }) {
	const s = sim.scenario
	const on = sim.choices.undated === "import"
	return (
		<div className={railCard}>
			<div>
				<h4 className="font-bold text-white">
					{plural(s.undatedWatches, "watch", "watches")} without a date
				</h4>
				<p className="text-sm text-gray-400">
					{on
						? "They come in as Seen, just without a date."
						: "They stay out. The dated ones still come in."}
				</p>
			</div>
			<label className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-200">
				Bring them in
				<Switch
					on={on}
					disabled={locked}
					label="Bring in watches without a date"
					onChange={(v) =>
						sim.setChoices({ ...sim.choices, undated: v ? "import" : "skip" })
					}
				/>
			</label>
		</div>
	)
}

function RewatchCard({ sim, locked }: { sim: Sim; locked: boolean }) {
	const s = sim.scenario
	const on = sim.choices.rewatch === "rewatch"
	return (
		<div className={railCard}>
			<div>
				<h4 className="font-bold text-white">Already Seen</h4>
				<p className="text-sm text-gray-400">
					{on
						? "These go on Want to rewatch."
						: `${plural(s.alreadySeenWants.length, "title")} on this wishlist you've already seen. They stay off Want to See.`}
				</p>
			</div>
			<ul className="flex flex-wrap gap-1.5">
				{s.alreadySeenWants.map((t) => (
					<li key={t.id}>
						<Poster title={t} className="w-12" lit={on} />
					</li>
				))}
			</ul>
			<label className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-200">
				Add as Want to rewatch
				<Switch
					on={on}
					disabled={locked}
					label="Add already seen titles as Want to rewatch"
					onChange={(v) =>
						sim.setChoices({ ...sim.choices, rewatch: v ? "rewatch" : "leave" })
					}
				/>
			</label>
		</div>
	)
}

function UndoLeavesCard({ titles }: { titles: Title[] }) {
	return (
		<div className={railCard}>
			<p className="text-sm text-gray-300">
				Everything this import added comes back out.{" "}
				{plural(titles.length, "title")} you changed after it stay as you left
				them:
			</p>
			<ul className="flex flex-wrap gap-1.5">
				{titles.map((t) => (
					<li key={t.id} className="flex items-center gap-2">
						<Poster title={t} className="w-12" />
						<span className="text-sm text-gray-400">{t.name}</span>
					</li>
				))}
			</ul>
		</div>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Sticky bar: the one action and one line                                                                           */

function ActionBar({ sim, progress }: { sim: Sim; progress: number }) {
	const s = sim.scenario
	const at = sim.phase.at
	const [askUndo, setAskUndo] = useState(false)
	const total = comingIn(sim)
	const pct = Math.round(progress * 100)
	const matchingLeft = s.matching && sim.matched < s.matching.total

	let line: ReactNode = null
	let actions: ReactNode = null
	if (at === "checking") {
		line = "Checking every title"
		actions = (
			<div className="w-32">
				<Bar progress={progress} />
			</div>
		)
	} else if (at === "preview") {
		const parts = [
			s.conflicts.length
				? `${plural(s.conflicts.filter((x) => (sim.choices.conflictPerTitle[x.title.id] ?? sim.choices.conflictDefault) === "keep").length, "score")} of yours kept`
				: null,
			s.sideEffects.offWantToSee.length
				? `${fmt(s.sideEffects.offWantToSee.length)} leave Want to See`
				: null,
		].filter(Boolean)
		line = (
			<>
				<span className="font-semibold text-white">
					{plural(total, "title")} come in
				</span>
				{parts.length ? (
					<span className="text-gray-400"> · {parts.join(" · ")}</span>
				) : null}
			</>
		)
		actions = (
			<button
				type="button"
				className={primaryButton}
				disabled={total === 0}
				onClick={sim.confirm}
			>
				{matchingLeft ? "Import what's matched" : "Import"}
			</button>
		)
	} else if (at === "running" || at === "undoing") {
		line = (
			<span className="flex flex-col gap-1.5">
				<span>
					<span className="font-semibold text-white">
						{at === "running" ? "Importing" : "Undoing"}
					</span>{" "}
					<span className="text-gray-400">{pct}%</span>
				</span>
				<Bar
					progress={progress}
					tone={at === "undoing" ? "bg-slate-400" : "bg-indigo-500"}
				/>
			</span>
		)
	} else if (at === "failed") {
		line = (
			<span className="flex flex-col gap-1.5">
				<span>
					<span className="font-semibold text-white">Stopped at {pct}%</span>{" "}
					<span className="text-gray-400">· what came in is saved</span>
				</span>
				<Bar progress={progress} tone="bg-amber-500" />
			</span>
		)
		actions = (
			<button type="button" className={primaryButton} onClick={sim.resume}>
				Continue
			</button>
		)
	} else if (at === "done") {
		line = askUndo ? (
			<span className="text-gray-200">
				Take out everything this import added?
			</span>
		) : (
			<span className="font-semibold text-white">
				{s.entry === "history" && s.previous
					? `${fmt(s.previous.added)} titles added on ${day(s.previous.at)}`
					: `${plural(total, "title")} added`}
			</span>
		)
		actions = askUndo ? (
			<span className="flex gap-2">
				<button
					type="button"
					className={secondaryButton}
					onClick={() => setAskUndo(false)}
				>
					Keep
				</button>
				<button type="button" className={primaryButton} onClick={sim.undo}>
					Undo import
				</button>
			</span>
		) : (
			<span className="flex gap-2">
				<button
					type="button"
					className={secondaryButton}
					onClick={() => setAskUndo(true)}
				>
					Undo
				</button>
				{s.entry !== "history" && (
					<button type="button" className={primaryButton} onClick={sim.reset}>
						Done
					</button>
				)}
			</span>
		)
	}
	// Screen readers hear progress in steps of ten, not every tick.
	const spoken =
		at === "running" || at === "undoing" || at === "checking"
			? `${at === "undoing" ? "Undoing" : "Importing"} ${Math.floor(pct / 10) * 10}%`
			: ""
	return (
		<div className="sticky bottom-0 z-30 -mx-4 border-t border-white/10 bg-gray-950/95 px-4 py-3 sm:mx-0 sm:rounded-t-2xl sm:px-5">
			<div className="flex min-h-11 items-center gap-4">
				<div className="min-w-0 flex-1 text-sm">{line}</div>
				{actions}
			</div>
			<span className="sr-only" aria-live="polite">
				{spoken}
			</span>
		</div>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* History                                                                                                            */

function History({ sim }: { sim: Sim }) {
	const s = sim.scenario
	return (
		<section aria-labelledby="past-imports">
			<h2
				id="past-imports"
				className="mb-2 text-sm font-semibold tracking-wide text-gray-400 uppercase"
			>
				Past imports
			</h2>
			<ul className="divide-y divide-white/5 rounded-xl bg-gray-900/60 ring-1 ring-white/5">
				{HISTORY.map((h) => {
					const src = sourceOf(h.source)
					const openable =
						s.entry === "history" &&
						h.source === s.source &&
						h.id === "h1" &&
						sim.phase.at === "start"
					const body = (
						<>
							<span className="scale-75">
								<SourceMark source={src} />
							</span>
							<span className="min-w-0 flex-1">
								<span className="font-semibold text-gray-200">{src.name}</span>{" "}
								<span className="text-gray-500">· {day(h.at)}</span>
								<span className="block text-gray-400">{h.line}</span>
							</span>
						</>
					)
					return (
						<li key={h.id}>
							{openable ? (
								<button
									type="button"
									onClick={sim.openPast}
									className="flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-slate-800/60"
								>
									{body}
									<span className="pr-2 font-semibold text-indigo-300">
										Open
									</span>
								</button>
							) : (
								<div className="flex items-center gap-2 px-2 py-1.5 text-sm">
									{body}
								</div>
							)}
						</li>
					)
				})}
			</ul>
		</section>
	)
}
