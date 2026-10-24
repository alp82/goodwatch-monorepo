// PROTOTYPE - throwaway. Variant D, "Import now, sort later": the safe part goes in at once with Undo on top; anything that needs a person waits in a one-at-a-time "Left for you" stack.
import {
	ArrowUpTrayIcon,
	CheckCircleIcon,
	ExclamationTriangleIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { type RefObject, useEffect, useRef, useState } from "react"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceId,
	importSourceName,
} from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import {
	card,
	dangerButton,
	primaryButton,
	secondaryButton,
	textLink,
} from "~/ui/imports/shared"
import {
	HISTORY,
	type Kinds,
	type Scenario,
	type Sim,
	type Title,
	fmt,
	newTitles,
	plural,
} from "./model"

/* ------------------------------------------------------------------------------------------------------------------ */
/* Held-back items                                                                                                    */

type Group = "want" | "ni" | "score" | "rewatch" | "place" | "lost" | "unsure"
interface Answer {
	/** Same role across a group, so "do the same" can repeat it. */
	role: string
	label: string
	done: string
	poster?: string
}
interface Item {
	id: string
	group: Group
	title?: Title
	eyebrow: string
	question: string
	detail?: string
	list?: string[]
	answers: Answer[]
}

const GROUP_NOUN: Record<Group, [string, string]> = {
	want: ["title on Want to See", "titles on Want to See"],
	ni: ["title on Not interested", "titles on Not interested"],
	score: ["score", "scores"],
	rewatch: ["Seen title", "Seen titles"],
	place: ["title", "titles"],
	lost: ["title", "titles"],
	unsure: ["title", "titles"],
}

const shortName = (id: ImportSourceId) =>
	id === "wishlist" ? "Watcharr" : id === "csv" ? "CSV" : importSourceName(id)
const sourceEntry = (id: ImportSourceId) =>
	IMPORT_SOURCE_LIST.find((s) => s.id === id) ?? IMPORT_SOURCE_LIST[0]
const day = (iso: string) =>
	new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	})
const named = (t: Title) => `${t.name} (${t.year})`

function heldItems(s: Scenario): Item[] {
	const src = shortName(s.source)
	const items: Item[] = []
	for (const t of s.sideEffects.offWantToSee)
		items.push({
			id: `want:${t.id}`,
			group: "want",
			title: t,
			eyebrow: "On your Want to See",
			question: `${src} says you watched ${t.name}`,
			detail: "Marking it Seen takes it off Want to See.",
			answers: [
				{ role: "a", label: "Mark Seen", done: "Marked Seen" },
				{
					role: "b",
					label: "Keep on Want to See",
					done: "Kept on Want to See",
				},
			],
		})
	for (const t of s.sideEffects.offNotInterested)
		items.push({
			id: `ni:${t.id}`,
			group: "ni",
			title: t,
			eyebrow: "On Not interested",
			question: `${src} says you watched ${t.name}`,
			detail: "Marking it Seen takes it off Not interested.",
			answers: [
				{ role: "a", label: "Mark Seen", done: "Marked Seen" },
				{
					role: "b",
					label: "Keep as Not interested",
					done: "Kept as Not interested",
				},
			],
		})
	for (const c of s.conflicts)
		items.push({
			id: `score:${c.title.id}`,
			group: "score",
			title: c.title,
			eyebrow: "Scores differ",
			question: `Which score for ${c.title.name}?`,
			detail: `You gave it ${c.yours} on GoodWatch on ${day(c.yoursAt)}. ${src} has ${c.theirs}.`,
			answers: [
				{ role: "a", label: `Keep your ${c.yours}`, done: "Kept your score" },
				{
					role: "b",
					label: `Use ${src}'s ${c.theirs}`,
					done: `Used ${src}'s score`,
				},
			],
		})
	for (const t of s.alreadySeenWants)
		items.push({
			id: `rewatch:${t.id}`,
			group: "rewatch",
			title: t,
			eyebrow: "Already Seen",
			question: `Watch ${t.name} again?`,
			detail: `It's on your ${src} wishlist, and you've already Seen it.`,
			answers: [
				{
					role: "a",
					label: "Add to Want to rewatch",
					done: "Added to Want to rewatch",
				},
				{ role: "b", label: "Leave it off", done: "Left off" },
			],
		})
	for (const u of s.unmatched.filter((u) => u.suggestions.length))
		items.push({
			id: `place:${u.raw}`,
			group: "place",
			title: u.suggestions[0],
			eyebrow: "Which title is it?",
			question:
				u.suggestions.length === 1
					? `Is "${u.raw}" ${named(u.suggestions[0])}?`
					: `Which title is "${u.raw}"?`,
			detail: `That's how your ${src} file names it. GoodWatch has a guess.`,
			answers:
				u.suggestions.length === 1
					? [
							{
								role: "a",
								label: "Yes, that's it",
								done: `Matched to ${u.suggestions[0].name}`,
							},
							{ role: "b", label: "No, leave it out", done: "Left out" },
						]
					: [
							...u.suggestions.map((t) => ({
								role: `s:${t.id}`,
								label: named(t),
								done: `Matched to ${t.name}`,
								poster: t.poster,
							})),
							{ role: "b", label: "Neither, leave it out", done: "Left out" },
						],
		})
	const lost = s.unmatched.filter((u) => !u.suggestions.length)
	if (lost.length)
		items.push({
			id: "lost",
			group: "lost",
			eyebrow: "Not found",
			question: `GoodWatch couldn't find ${lost.length === 1 ? "this one" : `these ${fmt(lost.length)}`}`,
			detail:
				"Often these are extras, shorts, or events GoodWatch doesn't list.",
			list: lost.map((u) => u.raw),
			answers: [
				{
					role: "a",
					label: lost.length === 1 ? "Leave it out" : "Leave them out",
					done: "Left out",
				},
			],
		})
	for (const t of s.matching?.uncertain ?? [])
		items.push({
			id: `unsure:${t.id}`,
			group: "unsure",
			title: t,
			eyebrow: "Not quite sure",
			question: `Is this ${named(t)}?`,
			detail: `${src} only says "${t.name}". GoodWatch isn't sure it's this one.`,
			answers: [
				{ role: "a", label: "Yes, that's it", done: "Matched" },
				{ role: "b", label: "No, leave it out", done: "Left out" },
			],
		})
	return items
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Page                                                                                                               */

const KIND_LABEL: [keyof Kinds, string, string][] = [
	["watches", "Seen title", "Seen titles"],
	["ratings", "score", "scores"],
	["episodes", "episode", "episodes"],
	["want", "Want to See", "Want to See"],
	["favorites", "favorite", "favorites"],
	["reviews", "review", "reviews"],
	["lists", "list", "lists"],
	["statuses", "show status", "show statuses"],
]

export function VariantD({ sim }: { sim: Sim }) {
	const { scenario: s, phase } = sim
	const src = shortName(s.source)
	const [items] = useState(() => heldItems(s))
	const [answered, setAnswered] = useState<Record<string, string>>({})
	const [skipped, setSkipped] = useState<Record<string, number>>({})
	const [released, setReleased] = useState(0)
	const [queueOpen, setQueueOpen] = useState(true)
	const [discarded, setDiscarded] = useState(false)
	const [undatedOut, setUndatedOut] = useState(false)
	const heading = useRef<HTMLHeadingElement>(null)

	const uncertain = s.matching?.uncertain.length ?? 0
	const progress =
		phase.at === "running" || phase.at === "failed"
			? phase.progress
			: phase.at === "done"
				? 1
				: 0
	// TV Time: uncertain titles join the stack as matching gets to them (the model only matches during preview).
	useEffect(() => {
		if (!uncertain) return
		const n = Array.from(
			{ length: uncertain },
			(_, i) => (i + 1) / (uncertain + 1),
		).filter((at) => progress >= at).length
		setReleased((r) => Math.max(r, n))
	}, [progress, uncertain])

	const visible = items.filter(
		(it) =>
			it.group !== "unsure" ||
			items.filter((x) => x.group === "unsure").indexOf(it) < released,
	)
	const pending = visible
		.map((it, i) => ({ it, i }))
		.filter(({ it }) => !(it.id in answered))
		.sort(
			(a, b) =>
				(skipped[a.it.id] ?? -1) - (skipped[b.it.id] ?? -1) || a.i - b.i,
		)
		.map(({ it }) => it)
	const sortedCount = Object.keys(answered).length

	const nothingNew = newTitles(s) === 0 && items.length === 0
	// Dropping the file was the "yes": the safe part goes straight in, with Undo right there.
	useEffect(() => {
		if (phase.at === "preview" && !nothingNew) sim.confirm()
	}, [phase.at, nothingNew, sim])
	// Focus follows the big moments, not every progress tick.
	useEffect(() => {
		if (
			[
				"problem",
				"connecting",
				"checking",
				"done",
				"undone",
				"failed",
			].includes(phase.at) ||
			(phase.at === "preview" && nothingNew)
		)
			heading.current?.focus()
		if (phase.at === "undoing") setDiscarded(true)
	}, [phase.at, nothingNew])

	const showQueue =
		!discarded &&
		pending.length > 0 &&
		["running", "failed", "done", "start"].includes(phase.at)
	const queue = showQueue && (
		<LeftForYou
			key="queue"
			pending={pending}
			total={visible.length}
			open={queueOpen}
			setOpen={setQueueOpen}
			stillComing={uncertain > released && phase.at !== "done"}
			onAnswer={(ids, label) =>
				setAnswered((a) => ({
					...a,
					...Object.fromEntries(ids.map((id) => [id, label])),
				}))
			}
			onSkip={(id) =>
				setSkipped((sk) => ({
					...sk,
					[id]: Object.keys(sk).length + Date.now(),
				}))
			}
			src={src}
		/>
	)

	return (
		<div className="flex flex-col gap-6 text-white">
			{phase.at === "start" && (
				<>
					{queue}
					<StartView sim={sim} />
				</>
			)}
			{phase.at === "reading" && (
				<Busy
					title={`Reading ${s.fileName}`}
					line="On your device first. Nothing changes yet."
				/>
			)}
			{phase.at === "connecting" && (
				<Busy
					headingRef={heading}
					title={`Waiting for ${src}`}
					line={`Approve GoodWatch on ${src}, then you'll come right back here.`}
					onCancel={sim.reset}
				/>
			)}
			{phase.at === "checking" && (
				<Busy
					headingRef={heading}
					title={
						s.entry === "connect"
							? `Looking through your ${src} account`
							: `Looking through ${s.fileName}`
					}
					progress={phase.progress}
				/>
			)}
			{phase.at === "problem" && (
				<Problem
					s={s}
					problem={phase.problem}
					headingRef={heading}
					onAgain={sim.reset}
				/>
			)}
			{phase.at === "preview" && nothingNew && (
				<NothingNew s={s} headingRef={heading} onAgain={sim.reset} />
			)}
			{(phase.at === "running" ||
				phase.at === "failed" ||
				(phase.at === "preview" && !nothingNew)) && (
				<>
					<RunningHeader
						sim={sim}
						progress={progress}
						headingRef={heading}
						held={visible.length}
					/>
					{queue}
				</>
			)}
			{phase.at === "done" && s.entry === "history" && (
				<PastImport
					s={s}
					headingRef={heading}
					onUndo={sim.undo}
					onBack={sim.reset}
				/>
			)}
			{phase.at === "done" && s.entry !== "history" && (
				<>
					<DoneHeader
						s={s}
						headingRef={heading}
						onUndo={sim.undo}
						onBack={sim.reset}
						held={items.length}
						sorted={sortedCount}
						left={pending.length}
						undatedOut={undatedOut}
						setUndatedOut={setUndatedOut}
					/>
					{queue}
					{!pending.length && items.length > 0 && (
						<p className={`${card} flex items-center gap-2 text-gray-200`}>
							<CheckCircleIcon
								className="size-5 shrink-0 text-emerald-400"
								aria-hidden
							/>
							All sorted. Nothing left for you from this import.
						</p>
					)}
				</>
			)}
			{phase.at === "undoing" && (
				<Busy
					headingRef={heading}
					title={`Undoing your ${src} import`}
					progress={phase.progress}
				/>
			)}
			{phase.at === "undone" && (
				<Undone
					s={s}
					headingRef={heading}
					onBack={sim.reset}
					hadQueue={items.length > 0 && s.entry !== "history"}
				/>
			)}
		</div>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Start                                                                                                              */

function StartView({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const [over, setOver] = useState(false)
	const connectable = IMPORT_SOURCE_LIST.filter((x) => x.connect)
	return (
		<>
			<button
				type="button"
				onClick={sim.takeFile}
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
				className={`flex w-full cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed px-4 py-10 text-center md:py-14 ${over ? "border-amber-300 bg-amber-400/10" : "border-white/20 bg-gray-950/50 hover:border-white/35"}`}
			>
				<ArrowUpTrayIcon
					className={`size-12 transition-transform duration-300 ${over ? "-translate-y-1 text-amber-300" : "text-gray-400"}`}
					aria-hidden
				/>
				<span className="text-xl font-bold md:text-2xl">
					Drop your export here
				</span>
				<span className="max-w-md text-sm text-gray-400">
					Or tap to choose it. It goes in right away, and you can undo it in one
					tap.
				</span>
				<span className={`${primaryButton} pointer-events-none mt-1`}>
					Choose file
				</span>
			</button>
			<div className="flex flex-col items-center gap-3">
				<p className="text-sm text-gray-400">
					No file? Connect an account instead.
				</p>
				<div className="flex flex-wrap justify-center gap-2">
					{connectable.map((x) => (
						<button
							key={x.id}
							type="button"
							onClick={sim.connect}
							className={
								x.id === s.source && s.entry === "connect"
									? primaryButton
									: secondaryButton
							}
						>
							<span className="scale-75">
								<SourceMark source={x} />
							</span>
							Connect {x.name}
						</button>
					))}
				</div>
			</div>
			<section aria-labelledby="d-history" className="flex flex-col gap-2">
				<h2 id="d-history" className="text-sm font-bold text-gray-400">
					Earlier imports
				</h2>
				<ul className="flex flex-col divide-y divide-slate-800 rounded-lg border border-slate-800">
					{HISTORY.map((h, i) => {
						const inner = (
							<>
								<SourceMark source={sourceEntry(h.source)} />
								<span className="min-w-0 flex-1">
									<span className="block font-semibold text-gray-100">
										{importSourceName(h.source)}
									</span>
									<span className="block text-sm text-gray-400">
										{day(h.at)} · {h.line}
									</span>
								</span>
							</>
						)
						return (
							<li key={h.id}>
								{s.entry === "history" && i === 0 ? (
									<button
										type="button"
										onClick={sim.openPast}
										className="flex w-full cursor-pointer items-center gap-3 p-3 text-left hover:bg-slate-800/60"
									>
										{inner}
										<span className="text-sm font-semibold text-indigo-300">
											Open
										</span>
									</button>
								) : (
									<div className="flex items-center gap-3 p-3">{inner}</div>
								)}
							</li>
						)
					})}
				</ul>
			</section>
		</>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Small phases                                                                                                       */

type HeadingRef = RefObject<HTMLHeadingElement>

function Bar({
	value,
	tone = "bg-indigo-500",
}: { value: number; tone?: string }) {
	return (
		<div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
			<div
				className={`h-full w-full origin-left rounded-full ${tone} transition-transform duration-150`}
				style={{ transform: `scaleX(${value})` }}
			/>
		</div>
	)
}

function Busy({
	title,
	line,
	progress,
	headingRef,
	onCancel,
}: {
	title: string
	line?: string
	progress?: number
	headingRef?: HeadingRef
	onCancel?: () => void
}) {
	return (
		<section className={`${card} flex flex-col gap-3`}>
			<h2
				ref={headingRef}
				tabIndex={-1}
				className="break-all text-lg font-bold outline-none"
			>
				{title}
			</h2>
			{progress != null && <Bar value={progress} />}
			<p aria-live="polite" className="text-sm text-gray-400">
				{line ?? (progress != null ? `${Math.round(progress * 100)}%` : "")}
			</p>
			{onCancel && (
				<button
					type="button"
					className={`${textLink} self-start text-sm`}
					onClick={onCancel}
				>
					Cancel
				</button>
			)}
		</section>
	)
}

const PROBLEMS: Record<
	string,
	(s: Scenario) => { title: string; body: string; next: string }
> = {
	streaming: () => ({
		title: "Netflix's history can't come in",
		body: "Netflix, Prime Video, Disney+ and the like only give a list of names and days, not enough to tell which title you watched.",
		next: "If you also track on Trakt, TMDB, or Plex, bring that instead. Those come in complete.",
	}),
	unknown: (s) => ({
		title: `${s.fileName} isn't an export GoodWatch knows`,
		body: "GoodWatch reads exports from Letterboxd, IMDb, Trakt, TV Time, Kodi, MovieLens, Watcharr, and CSV files.",
		next: "Use the file exactly as the site gave it to you, without unzipping or renaming it.",
	}),
	password: (s) => ({
		title: `${s.fileName} is locked with a password`,
		body: `${shortName(s.source)} sent the password in a separate email.`,
		next: "Open the ZIP on your device with that password, then drop the files inside it here.",
	}),
	too_big: (s) => ({
		title: `${s.fileName} is 34 MB, and the limit is 20 MB`,
		body: `${shortName(s.source)}'s full export holds more than GoodWatch needs.`,
		next: "Open the ZIP and drop just the watched, ratings, and watchlist files.",
	}),
	empty: (s) => ({
		title: `${s.fileName} has no titles in it`,
		body: "It only has the header line. The site may still be putting your export together.",
		next: "Download it again in a few minutes and drop the new file here.",
	}),
}

function Problem({
	s,
	problem,
	headingRef,
	onAgain,
}: {
	s: Scenario
	problem: string
	headingRef: HeadingRef
	onAgain: () => void
}) {
	const p = PROBLEMS[problem](s)
	return (
		<section className={`${card} flex flex-col gap-3 border-amber-700/60`}>
			<div className="flex items-start gap-3">
				<ExclamationTriangleIcon
					className="mt-0.5 size-6 shrink-0 text-amber-400"
					aria-hidden
				/>
				<h2
					ref={headingRef}
					tabIndex={-1}
					className="break-words text-lg font-bold outline-none"
				>
					{p.title}
				</h2>
			</div>
			<p className="text-gray-300">{p.body}</p>
			<p className="text-gray-100">{p.next}</p>
			<div className="flex flex-wrap gap-2">
				<button type="button" className={primaryButton} onClick={onAgain}>
					Try another file
				</button>
				{problem === "streaming" && (
					<button type="button" className={secondaryButton} onClick={onAgain}>
						Connect TMDB or Plex
					</button>
				)}
			</div>
		</section>
	)
}

function NothingNew({
	s,
	headingRef,
	onAgain,
}: { s: Scenario; headingRef: HeadingRef; onAgain: () => void }) {
	return (
		<section className={`${card} flex flex-col gap-3`}>
			<div className="flex items-center gap-3">
				<CheckCircleIcon
					className="size-6 shrink-0 text-emerald-400"
					aria-hidden
				/>
				<h2
					ref={headingRef}
					tabIndex={-1}
					className="text-lg font-bold outline-none"
				>
					Nothing new in this file
				</h2>
			</div>
			<p className="text-gray-300">
				All {plural(s.unchanged, "title")} in{" "}
				<span className="break-all">{s.fileName}</span> are already on GoodWatch
				{s.previous ? ` from your ${day(s.previous.at)} import` : ""}. Nothing
				to do.
			</p>
			<button
				type="button"
				className={`${secondaryButton} self-start`}
				onClick={onAgain}
			>
				Choose another file
			</button>
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Running and done                                                                                                   */

const inCount = (s: Scenario) =>
	Math.max(
		0,
		newTitles(s) -
			s.alreadySeenWants.length -
			s.sideEffects.offWantToSee.length -
			s.sideEffects.offNotInterested.length -
			(s.matching?.uncertain.length ?? 0),
	)

function RunningHeader({
	sim,
	progress,
	headingRef,
	held,
}: { sim: Sim; progress: number; headingRef: HeadingRef; held: number }) {
	const { scenario: s, phase } = sim
	const src = shortName(s.source)
	const failed = phase.at === "failed"
	const total = inCount(s)
	const done = Math.round(total * progress)
	const posters = s.sample.slice(0, 14)
	const shown = Math.ceil(progress * posters.length)
	const matched = s.matching
		? Math.round(
				s.matching.done + (s.matching.total - s.matching.done) * progress,
			)
		: 0
	return (
		<section className={`${card} flex flex-col gap-3`}>
			<div className="flex items-center gap-3">
				<SourceMark source={sourceEntry(s.source)} />
				<div className="min-w-0 flex-1">
					<h2
						ref={headingRef}
						tabIndex={-1}
						className="text-lg font-bold outline-none"
					>
						{failed ? "The import stopped partway" : `Importing from ${src}`}
					</h2>
					<p className="truncate text-sm text-gray-400">{s.fileName}</p>
				</div>
				{!failed && (
					<button
						type="button"
						className={`${textLink} shrink-0 text-sm`}
						onClick={sim.undo}
					>
						Undo
					</button>
				)}
			</div>
			<Bar value={progress} tone={failed ? "bg-amber-500" : "bg-indigo-500"} />
			<p aria-live="polite" className="text-sm text-gray-300">
				{failed
					? `${fmt(done)} of ${fmt(total)} titles went in, and they stay. Continue picks up from there.`
					: `${fmt(done)} of ${fmt(total)} titles in${s.unchanged ? `. ${fmt(s.unchanged)} were already here.` : "."}`}
			</p>
			{s.matching && !failed && (
				<p className="text-sm text-gray-400">
					Still matching {fmt(matched)} of {fmt(s.matching.total)} lines from TV
					Time. Matched titles go straight in; any GoodWatch isn't sure about
					land below.
				</p>
			)}
			{s.runSeconds >= 10 && !failed && (
				<p className="text-sm text-gray-400">
					This is a big one and takes a few minutes. You can leave this page; it
					keeps going.
				</p>
			)}
			{held > 0 && !failed && (
				<p className="text-sm text-gray-400">
					Anything that needs you is held back, not changed.
				</p>
			)}
			{failed ? (
				<div className="flex flex-wrap gap-2">
					<button type="button" className={primaryButton} onClick={sim.resume}>
						Continue
					</button>
					<button type="button" className={secondaryButton} onClick={sim.undo}>
						Undo what went in
					</button>
				</div>
			) : (
				<ul className="flex h-16 gap-1.5 overflow-hidden" aria-hidden>
					{posters.map((t, i) => (
						<li
							key={t.id}
							className={`w-11 shrink-0 transition-[opacity,transform] duration-500 ${i < shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
						>
							<img
								src={t.poster}
								alt=""
								className="aspect-[2/3] w-full rounded object-cover"
							/>
						</li>
					))}
				</ul>
			)}
		</section>
	)
}

function KindChips({ s }: { s: Scenario }) {
	return (
		<ul className="flex flex-wrap gap-1.5" aria-label="What came in">
			{KIND_LABEL.filter(([k]) => s.kinds[k] > 0).map(([k, one, many]) => (
				<li
					key={k}
					className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-gray-200"
				>
					{fmt(s.kinds[k])} {s.kinds[k] === 1 ? one : many}
				</li>
			))}
		</ul>
	)
}

function DoneHeader(props: {
	s: Scenario
	headingRef: HeadingRef
	onUndo: () => void
	onBack: () => void
	held: number
	sorted: number
	left: number
	undatedOut: boolean
	setUndatedOut: (v: boolean) => void
}) {
	const {
		s,
		headingRef,
		onUndo,
		onBack,
		sorted,
		left,
		undatedOut,
		setUndatedOut,
	} = props
	const src = shortName(s.source)
	const n = inCount(s)
	return (
		<section className={`${card} flex flex-col gap-3`}>
			<div className="flex items-start gap-3">
				<CheckCircleIcon
					className="mt-0.5 size-6 shrink-0 text-emerald-400"
					aria-hidden
				/>
				<div className="min-w-0 flex-1">
					<h2
						ref={headingRef}
						tabIndex={-1}
						className="text-lg font-bold outline-none"
					>
						{s.previous
							? `${plural(n, "new title")} in from ${src}`
							: `${plural(n, "title")} in from ${src}`}
					</h2>
					<p className="truncate text-sm text-gray-400">{s.fileName}</p>
				</div>
				<button
					type="button"
					className={`${secondaryButton} min-h-9 shrink-0 px-3 py-1 text-sm`}
					onClick={onUndo}
				>
					Undo
				</button>
			</div>
			<KindChips s={s} />
			<ul className="flex flex-col gap-1 text-sm text-gray-300">
				{s.unchanged > 0 && (
					<li>
						{plural(s.unchanged, "title was", "titles were")} already on
						GoodWatch, so they stayed as they are.
					</li>
				)}
				{s.undatedWatches > 0 && (
					<li>
						{undatedOut
							? `${plural(s.undatedWatches, "watch", "watches")} without a date are left out. `
							: `${plural(s.undatedWatches, "watch", "watches")} had no date, so they're in as Seen without one. `}
						<button
							type="button"
							className={textLink}
							onClick={() => setUndatedOut(!undatedOut)}
						>
							{undatedOut ? "Put them back" : "Leave those out"}
						</button>
					</li>
				)}
				{s.unsupported > 0 && (
					<li>
						{plural(s.unsupported, "item")} in the file aren't movies or shows,
						so they stayed out.
					</li>
				)}
				{sorted > 0 && (
					<li>
						You sorted {fmt(sorted)} of the ones held back
						{left ? "" : ". All done"}.
					</li>
				)}
			</ul>
			<button
				type="button"
				className={`${textLink} self-start text-sm`}
				onClick={onBack}
			>
				Back to Imports
			</button>
		</section>
	)
}

function PastImport({
	s,
	headingRef,
	onUndo,
	onBack,
}: {
	s: Scenario
	headingRef: HeadingRef
	onUndo: () => void
	onBack: () => void
}) {
	const leaves = s.undoLeaves ?? []
	return (
		<section className={`${card} flex flex-col gap-3`}>
			<div className="flex items-center gap-3">
				<SourceMark source={sourceEntry(s.source)} />
				<div className="min-w-0 flex-1">
					<h2
						ref={headingRef}
						tabIndex={-1}
						className="text-lg font-bold outline-none"
					>
						{shortName(s.source)} import, {s.previous ? day(s.previous.at) : ""}
					</h2>
					<p className="truncate text-sm text-gray-400">{s.fileName}</p>
				</div>
			</div>
			<p className="text-gray-300">
				It added {plural(s.previous?.added ?? 0, "title")}:
			</p>
			<KindChips s={s} />
			{leaves.length > 0 && (
				<div className="flex flex-col gap-2">
					<p className="text-gray-300">
						Undo takes all of that out, except{" "}
						{leaves.length === 1 ? "this title" : `these ${fmt(leaves.length)}`}
						. You changed them since, so they stay as they are.
					</p>
					<ul className="flex gap-2">
						{leaves.map((t) => (
							<li key={t.id} className="w-16">
								<img
									src={t.poster}
									alt={named(t)}
									className="aspect-[2/3] w-full rounded object-cover"
								/>
							</li>
						))}
					</ul>
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				<button type="button" className={dangerButton} onClick={onUndo}>
					Undo this import
				</button>
				<button type="button" className={secondaryButton} onClick={onBack}>
					Back to Imports
				</button>
			</div>
		</section>
	)
}

function Undone({
	s,
	headingRef,
	onBack,
	hadQueue,
}: {
	s: Scenario
	headingRef: HeadingRef
	onBack: () => void
	hadQueue: boolean
}) {
	const leaves = s.undoLeaves ?? []
	return (
		<section className={`${card} flex flex-col gap-3`}>
			<h2
				ref={headingRef}
				tabIndex={-1}
				className="text-lg font-bold outline-none"
			>
				Import undone
			</h2>
			<p className="text-gray-300">
				Everything it added is gone.
				{leaves.length > 0 &&
					` ${leaves.map((t) => t.name).join(" and ")} stay as you changed them.`}
				{hadQueue &&
					" The titles left for you are gone too; nothing from them was ever changed."}
			</p>
			<button
				type="button"
				className={`${secondaryButton} self-start`}
				onClick={onBack}
			>
				Back to Imports
			</button>
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Left for you: the one-at-a-time stack                                                                              */

function LeftForYou(props: {
	pending: Item[]
	total: number
	open: boolean
	setOpen: (v: boolean) => void
	stillComing: boolean
	onAnswer: (ids: string[], label: string) => void
	onSkip: (id: string) => void
	src: string
}) {
	const { pending, total, open, setOpen, stillComing, onAnswer, onSkip, src } =
		props
	const [leaving, setLeaving] = useState<{
		id: string
		dir: "left" | "right" | "up"
	} | null>(null)
	const [offer, setOffer] = useState<{
		group: Group
		role: string
		said: string
		name: string
	} | null>(null)
	const cardHeading = useRef<HTMLHeadingElement>(null)
	const titleRef = useRef<HTMLHeadingElement>(null)
	const moveFocus = useRef(false)
	const current = pending[0]

	useEffect(() => {
		if (moveFocus.current) {
			moveFocus.current = false
			cardHeading.current?.focus()
		}
	})

	const n = pending.length
	if (!open)
		return (
			<section className="flex items-center gap-3 rounded-lg border border-amber-700/60 bg-amber-950/40 p-3">
				<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-sm font-black text-gray-950">
					{n}
				</span>
				<p className="min-w-0 flex-1 text-sm text-amber-100">
					{n} left for you from {src}. Nothing changes until you say.
				</p>
				<button
					type="button"
					className={`${primaryButton} min-h-9 shrink-0 px-3 py-1 text-sm`}
					onClick={() => {
						setOpen(true)
						moveFocus.current = true
					}}
				>
					Sort now
				</button>
			</section>
		)

	const sameLeft = offer ? pending.filter((it) => it.group === offer.group) : []
	const answer = (it: Item, a: Answer, dir: "left" | "right") => {
		if (leaving) return
		setLeaving({ id: it.id, dir })
		window.setTimeout(() => {
			onAnswer([it.id], a.done)
			const rest = pending.filter(
				(x) =>
					x.group === it.group &&
					x.id !== it.id &&
					x.answers.some((y) => y.role === a.role),
			)
			setOffer(
				rest.length && it.group !== "place"
					? {
							group: it.group,
							role: a.role,
							said: a.done,
							name: it.title?.name ?? "",
						}
					: null,
			)
			setLeaving(null)
			moveFocus.current = true
		}, 220)
	}
	const doSame = () => {
		if (!offer) return
		const ids = sameLeft.map((it) => it.id)
		const a = sameLeft[0]?.answers.find((x) => x.role === offer.role)
		if (a) onAnswer(ids, a.done)
		setOffer(null)
		moveFocus.current = true
	}
	const skip = (it: Item) => {
		if (leaving) return
		setLeaving({ id: it.id, dir: "up" })
		window.setTimeout(() => {
			onSkip(it.id)
			setLeaving(null)
			setOffer(null)
			moveFocus.current = true
		}, 220)
	}
	const out = leaving?.id === current?.id ? leaving?.dir : null
	const outClass =
		out === "left"
			? "-translate-x-8 opacity-0"
			: out === "right"
				? "translate-x-8 opacity-0"
				: out === "up"
					? "-translate-y-4 opacity-0"
					: ""

	return (
		<section aria-labelledby="d-queue" className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<h2
					id="d-queue"
					ref={titleRef}
					tabIndex={-1}
					className="flex-1 text-lg font-bold outline-none"
				>
					Left for you
				</h2>
				<span aria-live="polite" className="text-sm text-gray-400">
					{n} of {total} left{stillComing ? ", more may come" : ""}
				</span>
				<button
					type="button"
					className={`${textLink} text-sm`}
					onClick={() => setOpen(false)}
				>
					Later
				</button>
			</div>
			<p className="-mt-2 text-sm text-gray-400">
				These weren't changed. Answer one at a time, or come back anytime.
			</p>
			{offer && sameLeft.length > 0 && (
				<div className="flex flex-wrap items-center gap-2 rounded-lg bg-indigo-950/60 p-3 text-sm ring-1 ring-indigo-700/60">
					<p className="min-w-0 flex-1 text-indigo-100">
						{offer.said}
						{offer.name ? ` for ${offer.name}` : ""}. Do the same for the other{" "}
						{plural(sameLeft.length, ...GROUP_NOUN[offer.group])}?
					</p>
					<button
						type="button"
						className={`${primaryButton} min-h-9 px-3 py-1 text-sm`}
						onClick={doSame}
					>
						Do the same
					</button>
					<button
						type="button"
						aria-label="No thanks"
						className="cursor-pointer rounded p-1 text-indigo-200 hover:text-white"
						onClick={() => setOffer(null)}
					>
						<XMarkIcon className="size-5" aria-hidden />
					</button>
				</div>
			)}
			{current && (
				<div className="relative isolate pb-4">
					{n > 2 && (
						<div
							aria-hidden
							className="absolute inset-x-6 top-4 bottom-0 -z-20 rounded-2xl bg-gray-900/40 ring-1 ring-white/5"
						/>
					)}
					{n > 1 && (
						<div
							aria-hidden
							className="absolute inset-x-3 top-2 bottom-2 -z-10 rounded-2xl bg-gray-900/70 ring-1 ring-white/5"
						/>
					)}
					<QueueCard
						key={current.id}
						item={current}
						extra={outClass}
						headingRef={cardHeading}
						onAnswer={(a, i) => answer(current, a, i === 0 ? "right" : "left")}
						onSkip={() => skip(current)}
						canSkip={n > 1}
					/>
				</div>
			)}
		</section>
	)
}

function QueueCard({
	item,
	extra,
	headingRef,
	onAnswer,
	onSkip,
	canSkip,
}: {
	item: Item
	extra: string
	headingRef: HeadingRef
	onAnswer: (a: Answer, i: number) => void
	onSkip: () => void
	canSkip: boolean
}) {
	const [entered, setEntered] = useState(false)
	useEffect(() => {
		const id = requestAnimationFrame(() => setEntered(true))
		return () => cancelAnimationFrame(id)
	}, [])
	const enter = entered ? "" : "translate-y-3 opacity-0"
	return (
		<article
			aria-labelledby={`d-card-${item.id}`}
			className={`grid grid-cols-[5.5rem_1fr] gap-4 rounded-2xl bg-gray-900 p-4 shadow-xl ring-1 ring-white/10 transition-[transform,opacity] duration-200 ease-out sm:grid-cols-[9rem_1fr] md:p-6 ${extra || enter}`}
		>
			{item.title ? (
				<img
					src={item.title.poster}
					alt={named(item.title)}
					className="aspect-[2/3] w-full self-start rounded-lg object-cover shadow-xl"
				/>
			) : (
				<div
					aria-hidden
					className="flex aspect-[2/3] w-full items-center justify-center self-start rounded-lg bg-slate-800 text-3xl font-black text-gray-500"
				>
					?
				</div>
			)}
			<div className="min-w-0">
				<div className="text-xs font-bold tracking-wider text-amber-400/90 uppercase">
					{item.eyebrow}
				</div>
				<h3
					id={`d-card-${item.id}`}
					ref={headingRef}
					tabIndex={-1}
					className="mt-1 text-xl font-extrabold break-words outline-none md:text-2xl"
				>
					{item.question}
				</h3>
				{item.detail && (
					<p className="mt-1 text-sm text-gray-300">{item.detail}</p>
				)}
				{item.list && (
					<ul className="mt-2 flex flex-col gap-0.5 text-sm text-gray-400">
						{item.list.slice(0, 5).map((r) => (
							<li key={r} className="truncate">
								{r}
							</li>
						))}
						{item.list.length > 5 && (
							<li>and {fmt(item.list.length - 5)} more</li>
						)}
					</ul>
				)}
			</div>
			<div className="col-span-2 flex flex-col gap-2 sm:col-span-1 sm:col-start-2">
				{item.answers.map((a, i) => (
					<button
						key={a.role}
						type="button"
						className={`${secondaryButton} w-full justify-start text-left`}
						onClick={() => onAnswer(a, i)}
					>
						{a.poster && (
							<img
								src={a.poster}
								alt=""
								className="h-9 w-6 shrink-0 rounded-sm object-cover"
							/>
						)}
						{a.label}
					</button>
				))}
				{canSkip && (
					<button
						type="button"
						className={`${textLink} mt-1 self-start text-sm`}
						onClick={onSkip}
					>
						Skip for now
					</button>
				)}
			</div>
		</article>
	)
}
