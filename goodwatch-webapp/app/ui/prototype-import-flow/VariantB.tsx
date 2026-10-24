// PROTOTYPE - throwaway. Variant B, "One question at a time": a Bring → Check → Import → Done stepper that asks only what this import needs, one big question per screen.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import {
	ArrowLeftIcon,
	ArrowUpTrayIcon,
	ArrowUturnLeftIcon,
	CalendarDaysIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceId,
	importSourceName,
} from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import {
	dangerButton,
	primaryButton,
	secondaryButton,
	textLink,
} from "~/ui/imports/shared"
import {
	type Choices,
	type FileProblem,
	HISTORY,
	type Kinds,
	type Question,
	type Scenario,
	type Sim,
	type Title,
	fmt,
	newTitles,
	plural,
	questionsFor,
} from "./model"

/* ------------------------------------------------------------------------------------------------------------------ */
/* Screens                                                                                                            */

/** "uncertain" is local: the model has no choice for TV Time's uncertain titles, so this variant keeps it itself. */
type Group = Question | "uncertain"
type Screen =
	| { q: "matching" }
	| { q: "uncertain" }
	| { q: "conflicts"; i: number }
	| { q: "unmatched"; i: number }
	| { q: "undated" }
	| { q: "rewatch" }
	| { q: "side-effects" }

function screensFor(s: Scenario): Screen[] {
	const out: Screen[] = []
	for (const q of questionsFor(s)) {
		if (q === "matching") {
			out.push({ q })
			if (s.matching?.uncertain.length) out.push({ q: "uncertain" })
		} else if (q === "conflicts")
			s.conflicts.forEach((_, i) => out.push({ q, i }))
		else if (q === "unmatched")
			s.unmatched.forEach((u, i) => u.suggestions.length && out.push({ q, i }))
		else out.push({ q })
	}
	return out
}

interface Local {
	matching: "now" | "wait"
	uncertain: "leave" | "add"
}

type View = { at: "ask"; i: number } | { at: "summary" }

const KIND_LABEL: Record<keyof Kinds, [string, string]> = {
	ratings: ["score", "scores"],
	watches: ["watch", "watches"],
	episodes: ["episode", "episodes"],
	want: ["Want to See", "Want to See"],
	favorites: ["favorite", "favorites"],
	reviews: ["review", "reviews"],
	lists: ["list", "lists"],
	statuses: ["show status", "show statuses"],
}

const kindLine = (k: keyof Kinds, n: number) =>
	k === "want"
		? `${fmt(n)} on Want to See`
		: plural(n, KIND_LABEL[k][0], KIND_LABEL[k][1])

const day = (iso: string) =>
	new Date(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	})

const names = (titles: Title[]) => {
	const n = titles.map((t) => t.name)
	return n.length <= 2
		? n.join(" and ")
		: `${n.slice(0, -1).join(", ")}, and ${n.at(-1)}`
}

/** Titles that come in with the member's kind toggles. */
const incoming = (s: Scenario, c: Choices) =>
	Math.max(
		c.include.watches ? s.kinds.watches : 0,
		c.include.ratings ? s.kinds.ratings : 0,
	) +
	(c.include.want ? s.kinds.want : 0) +
	(c.include.favorites ? s.kinds.favorites : 0)

/* ------------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                       */

function Poster({
	title,
	className = "w-16",
}: { title: Title; className?: string }) {
	return (
		<img
			src={title.poster}
			alt=""
			loading="lazy"
			className={`aspect-[2/3] shrink-0 rounded-md bg-gray-800 object-cover ring-2 ring-gray-950 ${className}`}
		/>
	)
}

function PosterStack({
	titles,
	max = 8,
	size = "w-12 sm:w-14",
}: { titles: Title[]; max?: number; size?: string }) {
	const shown = titles.slice(0, max)
	const more = titles.length - shown.length
	return (
		<ul className="flex items-center pl-3" aria-hidden>
			{shown.map((t) => (
				<li key={t.id} className="-ml-3">
					<Poster title={t} className={size} />
				</li>
			))}
			{more > 0 && (
				<li className="-ml-3 flex aspect-[2/3] w-12 items-center justify-center rounded-md bg-gray-800 text-sm font-bold text-gray-300 ring-2 ring-gray-950 sm:w-14">
					+{fmt(more)}
				</li>
			)}
		</ul>
	)
}

/** Titles with their names, for the question screens. */
function PosterRow({ titles }: { titles: Title[] }) {
	return (
		<ul className="flex flex-wrap gap-3">
			{titles.map((t) => (
				<li key={t.id} className="flex w-20 flex-col gap-1 sm:w-24">
					<Poster title={t} className="w-full" />
					<span className="line-clamp-2 text-xs text-gray-300">{t.name}</span>
				</li>
			))}
		</ul>
	)
}

function Bar({ value, label }: { value: number; label: string }) {
	return (
		<div>
			<div
				role="progressbar"
				aria-label={label}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(value * 100)}
				className="h-2 overflow-hidden rounded-full bg-white/10"
			>
				<div
					className="h-full origin-left rounded-full bg-linear-to-r from-amber-500 to-amber-300 transition-transform duration-200 ease-linear"
					style={{ transform: `scaleX(${value})` }}
				/>
			</div>
		</div>
	)
}

/** Fades and slides its content in on mount; transform and opacity only. */
function Slide({ dir, children }: { dir: 1 | -1; children: ReactNode }) {
	const [on, setOn] = useState(false)
	useEffect(() => {
		let b = 0
		const a = requestAnimationFrame(() => {
			b = requestAnimationFrame(() => setOn(true))
		})
		return () => {
			cancelAnimationFrame(a)
			cancelAnimationFrame(b)
		}
	}, [])
	return (
		<div
			className="transition-[transform,opacity] duration-300 ease-out"
			style={{
				transform: on ? "none" : `translateX(${dir * 40}px)`,
				opacity: on ? 1 : 0,
			}}
		>
			{children}
		</div>
	)
}

const headingClass =
	"text-2xl font-bold tracking-tight text-white outline-none md:text-3xl"

/* ------------------------------------------------------------------------------------------------------------------ */
/* Stepper                                                                                                            */

const STEPS = ["Bring", "Check", "Import", "Done"] as const

function Stepper({
	step,
	notes,
	canOpen,
	onOpen,
	checkSkipped,
}: {
	step: 1 | 2 | 3 | 4
	notes: string[]
	canOpen: (n: number) => boolean
	onOpen: (n: number) => void
	checkSkipped: boolean
}) {
	return (
		<nav aria-label="Import steps" className="mx-auto w-full max-w-3xl">
			<div className="relative">
				<div
					aria-hidden
					className="absolute inset-x-[12.5%] top-[22px] h-1 overflow-hidden rounded-full bg-white/15"
				>
					<div
						className="h-full origin-left rounded-full bg-linear-to-r from-amber-500 to-amber-300 transition-transform duration-700 ease-out"
						style={{ transform: `scaleX(${(step - 1) / 3})` }}
					/>
				</div>
				<ol className="relative grid grid-cols-4">
					{STEPS.map((label, idx) => {
						const n = idx + 1
						const on = step === n
						const finished = n < step || (n === 4 && step === 4)
						const skipped = n === 2 && checkSkipped && step > 2
						return (
							<li
								key={label}
								className="flex flex-col items-center text-center"
							>
								<button
									type="button"
									onClick={() => onOpen(n)}
									disabled={!canOpen(n)}
									aria-current={on ? "step" : undefined}
									aria-label={`Step ${n}: ${label}${finished ? ", done" : ""}`}
									className={`flex size-11 cursor-pointer items-center justify-center rounded-full text-base font-black ring-4 transition-transform duration-300 disabled:cursor-default md:size-12 ${on && !finished ? "scale-110" : ""} ${finished ? (skipped ? "bg-gray-700 text-gray-200 ring-gray-950" : "bg-amber-400 text-gray-950 ring-gray-950") : on ? "bg-gray-950 text-amber-300 shadow-[0_0_0_8px_var(--color-gray-950)] ring-amber-400" : "bg-gray-900 text-gray-400 ring-gray-950"}`}
								>
									{finished ? <CheckIcon className="size-6" aria-hidden /> : n}
								</button>
								<span
									className={`mt-3 text-sm font-bold md:text-base ${on ? "text-white" : "text-gray-400"}`}
								>
									{label}
								</span>
								<span
									className={`min-h-4 text-xs md:text-sm ${on ? "text-amber-300/90" : "text-gray-500"}`}
								>
									{notes[idx] || " "}
								</span>
							</li>
						)
					})}
				</ol>
			</div>
		</nav>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The variant                                                                                                        */

export function VariantB({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const { phase } = sim
	const screens = useMemo(() => screensFor(s), [s])
	const groups = useMemo(
		() => [...new Set(screens.map((x) => x.q))] as Group[],
		[screens],
	)
	const [view, setView] = useState<View>({ at: "summary" })
	const [dir, setDir] = useState<1 | -1>(1)
	const [editing, setEditing] = useState(false)
	const [local, setLocal] = useState<Local>({
		matching: "now",
		uncertain: "leave",
	})
	const [sameForAll, setSameForAll] = useState(false)

	// Entering the preview starts at the first question, or at the summary when there is nothing to ask.
	const wasPreview = useRef(false)
	useEffect(() => {
		const isPreview = phase.at === "preview"
		if (isPreview && !wasPreview.current) {
			setDir(1)
			setEditing(false)
			setView(screens.length ? { at: "ask", i: 0 } : { at: "summary" })
		}
		wasPreview.current = isPreview
	}, [phase.at, screens.length])

	// Focus moves to the new screen's heading, after the member's first action.
	const heading = useRef<HTMLHeadingElement>(null)
	const screenKey = `${phase.at}:${view.at === "ask" ? view.i : "summary"}`
	const first = useRef(true)
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		heading.current?.focus({ preventScroll: false })
	}, [screenKey])

	const inPreview = phase.at === "preview"
	const step: 1 | 2 | 3 | 4 =
		phase.at === "done" || phase.at === "undoing" || phase.at === "undone"
			? 4
			: phase.at === "running" || phase.at === "failed"
				? 3
				: inPreview
					? view.at === "ask"
						? 2
						: 3
					: 1
	const sourceName = importSourceName(s.source)
	const groupOf = (i: number) => groups.indexOf(screens[i].q)
	const notes = [
		step > 1 ? sourceName : "",
		step === 2 && view.at === "ask"
			? `${groupOf(view.i) + 1} of ${groups.length}`
			: step > 2
				? groups.length
					? `${plural(groups.length, "answer")}`
					: "Nothing to ask"
				: "",
		phase.at === "running"
			? `${Math.round(phase.progress * 100)}%`
			: phase.at === "failed"
				? "Paused"
				: step === 3
					? "Ready"
					: "",
		phase.at === "undone" ? "Undone" : "",
	]

	const go = (next: View, d: 1 | -1) => {
		setDir(d)
		setView(next)
	}
	const toSummary = () => {
		setEditing(false)
		go({ at: "summary" }, 1)
	}
	/** After an answer: the next screen, or back to the summary when the edited question is done. */
	const advance = (from: number, skipGroup = false) => {
		let next = from + 1
		if (skipGroup)
			while (next < screens.length && screens[next].q === screens[from].q)
				next++
		if (next >= screens.length) return toSummary()
		if (editing && screens[next].q !== screens[from].q) return toSummary()
		go({ at: "ask", i: next }, 1)
	}
	const back = () => {
		if (view.at === "summary") {
			if (screens.length) go({ at: "ask", i: screens.length - 1 }, -1)
			else sim.reset()
		} else if (view.i === 0) sim.reset()
		else go({ at: "ask", i: view.i - 1 }, -1)
	}
	const edit = (g: Group) => {
		setEditing(true)
		setSameForAll(false)
		go({ at: "ask", i: screens.findIndex((x) => x.q === g) }, -1)
	}

	return (
		<div className="flex flex-col gap-8 md:gap-10">
			<Stepper
				step={step}
				notes={notes}
				checkSkipped={groups.length === 0}
				canOpen={(n) =>
					(n === 1 && inPreview) ||
					(n === 2 && inPreview && view.at === "summary" && groups.length > 0)
				}
				onOpen={(n) => (n === 1 ? sim.reset() : edit(groups[0]))}
			/>
			<div className="mx-auto w-full max-w-2xl">
				{step === 1 && <Bring sim={sim} heading={heading} />}
				{inPreview && view.at === "ask" && (
					<Slide key={view.i} dir={dir}>
						<Ask
							sim={sim}
							screen={screens[view.i]}
							index={view.i}
							screens={screens}
							groups={groups}
							local={local}
							setLocal={setLocal}
							sameForAll={sameForAll}
							setSameForAll={setSameForAll}
							heading={heading}
							onBack={back}
							onNext={advance}
						/>
					</Slide>
				)}
				{inPreview && view.at === "summary" && (
					<Slide key="summary" dir={dir}>
						<Summary
							sim={sim}
							groups={groups}
							local={local}
							heading={heading}
							onEdit={edit}
							onBack={back}
						/>
					</Slide>
				)}
				{(phase.at === "running" || phase.at === "failed") && (
					<Running sim={sim} heading={heading} />
				)}
				{step === 4 && <Done sim={sim} local={local} heading={heading} />}
			</div>
		</div>
	)
}

type HeadingRef = React.RefObject<HTMLHeadingElement>

/* ------------------------------------------------------------------------------------------------------------------ */
/* Bring                                                                                                              */

const CONNECTABLE = IMPORT_SOURCE_LIST.filter((x) => x.connect)

function Bring({ sim, heading }: { sim: Sim; heading: HeadingRef }) {
	const s = sim.scenario
	const { phase } = sim
	const input = useRef<HTMLInputElement>(null)
	const [over, setOver] = useState(false)
	const [whereOpen, setWhereOpen] = useState(false)
	const busy =
		phase.at === "reading" ||
		phase.at === "checking" ||
		phase.at === "connecting"

	if (busy)
		return (
			<section className="flex flex-col items-center gap-5 rounded-3xl bg-gray-900/70 px-5 py-10 text-center ring-1 ring-white/10">
				<SourceMark
					source={
						IMPORT_SOURCE_LIST.find((x) => x.id === s.source) ??
						IMPORT_SOURCE_LIST[0]
					}
				/>
				<h2 ref={heading} tabIndex={-1} className={headingClass}>
					{phase.at === "connecting"
						? `Waiting for ${importSourceName(s.source)}`
						: phase.at === "reading"
							? "Reading your file"
							: "Finding your titles"}
				</h2>
				<p className="break-all text-sm text-gray-400">{s.fileName}</p>
				<div className="w-full max-w-sm" aria-live="polite">
					{phase.at === "checking" ? (
						<>
							<Bar value={phase.progress} label="Finding your titles" />
							<p className="mt-2 text-sm text-gray-400">
								Looking up {fmt(s.rows)} entries in GoodWatch. Nothing changes
								yet.
							</p>
						</>
					) : phase.at === "connecting" ? (
						<p className="text-sm text-gray-400">
							Say yes to GoodWatch in the {importSourceName(s.source)} tab. You
							come right back here.
						</p>
					) : (
						<p className="animate-pulse text-sm text-gray-400">
							On your device first. Nothing is uploaded yet.
						</p>
					)}
				</div>
				<button type="button" className={textLink} onClick={sim.reset}>
					Cancel
				</button>
			</section>
		)

	const problem = phase.at === "problem" ? phase.problem : null
	return (
		<div className="flex flex-col gap-6">
			{problem && (
				<ProblemCard
					problem={problem}
					scenario={s}
					heading={heading}
					onWhere={() => setWhereOpen(true)}
				/>
			)}
			{s.entry === "connect" ? (
				<section className="flex flex-col items-center gap-4 rounded-3xl border-2 border-white/20 bg-gray-950/50 px-4 py-10 text-center">
					<SourceMark
						source={
							IMPORT_SOURCE_LIST.find((x) => x.id === s.source) ??
							IMPORT_SOURCE_LIST[0]
						}
					/>
					<h2
						ref={problem ? undefined : heading}
						tabIndex={-1}
						className={headingClass}
					>
						Bring your {importSourceName(s.source)} account
					</h2>
					<p className="max-w-md text-sm text-gray-400">
						You'll say yes on {importSourceName(s.source)}, then check
						everything here before anything changes.
					</p>
					<button type="button" className={primaryButton} onClick={sim.connect}>
						Connect {importSourceName(s.source)}
					</button>
				</section>
			) : (
				<section
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
					className={`flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-4 py-10 text-center sm:px-6 md:py-14 ${over ? "border-amber-300 bg-amber-400/10" : "border-white/20 bg-gray-950/50 hover:border-white/35"}`}
				>
					<ArrowUpTrayIcon
						className={`size-12 transition-transform duration-300 md:size-14 ${over ? "-translate-y-1 text-amber-300" : "text-gray-400"}`}
						aria-hidden
					/>
					<h2
						ref={problem ? undefined : heading}
						tabIndex={-1}
						className={headingClass}
					>
						{problem ? "Try another file" : "Drop your export here"}
					</h2>
					<p id="b-drop-hint" className="max-w-md text-sm text-gray-400">
						GoodWatch works out where it's from. Nothing changes until you say
						so.
					</p>
					<button
						type="button"
						className={primaryButton}
						aria-describedby="b-drop-hint"
						onClick={() => input.current?.click()}
					>
						Choose file
					</button>
					<input
						ref={input}
						type="file"
						aria-label="Choose an export file"
						className="sr-only"
						tabIndex={-1}
						onChange={(e) => {
							if (e.target.files?.length) sim.takeFile()
							e.target.value = ""
						}}
					/>
					<p className="text-xs text-gray-500">
						This case: <span className="break-all">{s.fileName}</span>
					</p>
				</section>
			)}

			<div className="flex flex-col items-center gap-3">
				<p className="text-sm text-gray-400">Or connect an account</p>
				<div className="flex flex-wrap justify-center gap-3">
					{CONNECTABLE.map((x) => (
						<button
							key={x.id}
							type="button"
							className={secondaryButton}
							onClick={sim.connect}
						>
							<span className="scale-75">
								<SourceMark source={x} />
							</span>
							{x.name}
						</button>
					))}
				</div>
			</div>

			<Disclosure
				label="Where do I get my file?"
				open={whereOpen}
				onToggle={setWhereOpen}
			>
				<ul className="grid gap-2 sm:grid-cols-2">
					{IMPORT_SOURCE_LIST.filter((x) => !x.connect).map((x) => (
						<li
							key={x.id}
							className="flex items-center gap-3 rounded-lg bg-slate-900/60 p-3"
						>
							<SourceMark source={x} />
							<div className="min-w-0">
								<div className="font-semibold text-white">{x.name}</div>
								<div className="text-xs text-gray-400">
									{x.gets.slice(0, 3).join(", ")} · {x.wait}
								</div>
							</div>
						</li>
					))}
				</ul>
			</Disclosure>

			<History sim={sim} />
		</div>
	)
}

function Disclosure({
	label,
	open,
	onToggle,
	children,
}: {
	label: string
	open: boolean
	onToggle: (open: boolean) => void
	children: ReactNode
}) {
	return (
		<div className="border-t border-white/10 pt-4">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => onToggle(!open)}
				className="flex w-full cursor-pointer items-center justify-between gap-3 py-1 text-left font-semibold text-gray-200 hover:text-white"
			>
				{label}
				<ChevronDownIcon
					className={`size-5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
					aria-hidden
				/>
			</button>
			{open && <div className="mt-3">{children}</div>}
		</div>
	)
}

function History({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const [open, setOpen] = useState(false)
	return (
		<Disclosure
			label={`Past imports (${HISTORY.length})`}
			open={open}
			onToggle={setOpen}
		>
			<ul className="flex flex-col gap-2">
				{HISTORY.map((h) => {
					const src =
						IMPORT_SOURCE_LIST.find((x) => x.id === h.source) ??
						IMPORT_SOURCE_LIST[0]
					const openable = s.entry === "history" && s.previous?.at === h.at
					const body = (
						<>
							<SourceMark source={src} />
							<span className="min-w-0 flex-1">
								<span className="block font-semibold text-white">
									{src.name}{" "}
									<span className="font-normal text-gray-400">
										· {day(h.at)}
									</span>
								</span>
								<span className="block text-sm text-gray-400">{h.line}</span>
							</span>
						</>
					)
					return (
						<li key={h.id}>
							{openable ? (
								<button
									type="button"
									onClick={sim.openPast}
									className="flex w-full cursor-pointer items-center gap-3 rounded-lg bg-slate-900/60 p-3 text-left ring-1 ring-slate-700 hover:bg-slate-800"
								>
									{body}
									<span className="text-sm font-semibold text-indigo-300">
										Open
									</span>
								</button>
							) : (
								<div className="flex items-center gap-3 rounded-lg p-3">
									{body}
								</div>
							)}
						</li>
					)
				})}
			</ul>
		</Disclosure>
	)
}

const PROBLEMS: Record<
	FileProblem,
	(s: Scenario) => { title: string; why: string; next: ReactNode }
> = {
	streaming: () => ({
		title: "Netflix doesn't give a file GoodWatch can use",
		why: "Netflix, Disney+, and other streaming services only list what played, without scores or a clear title match.",
		next: (
			<>
				<p>If you track somewhere else, bring it from there:</p>
				<ul className="mt-3 flex flex-wrap gap-2">
					{(["trakt", "tmdb", "plex"] as ImportSourceId[]).map((id) => {
						const x = IMPORT_SOURCE_LIST.find((y) => y.id === id)
						return x ? (
							<li
								key={id}
								className="flex items-center gap-2 rounded-full bg-slate-800 py-1 pr-3 pl-1 text-sm font-semibold text-gray-200"
							>
								<span className="scale-75">
									<SourceMark source={x} />
								</span>
								{x.name}
								<span className="font-normal text-gray-400">
									{x.connect ? "connect" : "file"}
								</span>
							</li>
						) : null
					})}
				</ul>
			</>
		),
	}),
	unknown: (s) => ({
		title: "GoodWatch doesn't know this file",
		why: `${s.fileName} isn't an export from a site or app GoodWatch reads.`,
		next: "Check where your file comes from in the list below, then drop that export here.",
	}),
	password: () => ({
		title: "This TV Time file is locked",
		why: "TV Time locks its export with a password and sends the password in a separate email.",
		next: "Open the ZIP on your computer with that password, then drop the files inside here.",
	}),
	too_big: () => ({
		title: "This file is too big",
		why: "It's 34 MB. GoodWatch takes files up to 20 MB.",
		next: "Unzip it and drop only the files you need, like your watched and ratings files.",
	}),
	empty: () => ({
		title: "This file is empty",
		why: "It only has column names, no scores.",
		next: "Export again from MovieLens after you've rated a few titles, or pick another file.",
	}),
}

function ProblemCard({
	problem,
	scenario,
	heading,
	onWhere,
}: {
	problem: FileProblem
	scenario: Scenario
	heading: HeadingRef
	onWhere: () => void
}) {
	const p = PROBLEMS[problem](scenario)
	return (
		<section
			aria-live="assertive"
			className="rounded-2xl border-l-8 border-red-700 bg-red-950/70 p-5 text-red-50"
		>
			<div className="flex items-start gap-3">
				<ExclamationTriangleIcon
					className="mt-1 size-6 shrink-0 text-red-300"
					aria-hidden
				/>
				<div className="min-w-0">
					<h2
						ref={heading}
						tabIndex={-1}
						className="text-xl font-bold text-white outline-none"
					>
						{p.title}
					</h2>
					<p className="mt-1 break-all text-sm text-red-200/80">
						{scenario.fileName}
					</p>
					<p className="mt-3">{p.why}</p>
					<div className="mt-3 text-red-50">{p.next}</div>
					{problem === "unknown" && (
						<button
							type="button"
							className={`${textLink} mt-3`}
							onClick={onWhere}
						>
							Where do I get my file?
						</button>
					)}
				</div>
			</div>
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Check: one question per screen                                                                                     */

function Answer({
	selected,
	recommended,
	onClick,
	title,
	note,
	poster,
}: {
	selected: boolean
	recommended?: boolean
	onClick: () => void
	title: string
	note?: string
	poster?: Title
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onClick}
			className={`flex min-h-16 w-full cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-transform duration-150 active:scale-[0.98] sm:px-5 ${selected ? "border-amber-400 bg-amber-400/10" : "border-slate-700 bg-slate-900/60 hover:border-slate-500"}`}
		>
			{poster && <Poster title={poster} className="w-12" />}
			<span className="min-w-0 flex-1">
				<span className="block text-lg font-bold text-white">{title}</span>
				{note && <span className="block text-sm text-gray-400">{note}</span>}
			</span>
			{recommended && (
				<span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-200">
					Suggested
				</span>
			)}
			<span
				aria-hidden
				className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-amber-400 bg-amber-400 text-gray-950" : "border-slate-600"}`}
			>
				{selected && <CheckIcon className="size-4" />}
			</span>
		</button>
	)
}

function Ask({
	sim,
	screen,
	index,
	screens,
	groups,
	local,
	setLocal,
	sameForAll,
	setSameForAll,
	heading,
	onBack,
	onNext,
}: {
	sim: Sim
	screen: Screen
	index: number
	screens: Screen[]
	groups: Group[]
	local: Local
	setLocal: (l: Local) => void
	sameForAll: boolean
	setSameForAll: (v: boolean) => void
	heading: HeadingRef
	onBack: () => void
	onNext: (from: number, skipGroup?: boolean) => void
}) {
	const s = sim.scenario
	const c = sim.choices
	const set = (next: Partial<Choices>) => sim.setChoices({ ...c, ...next })
	const src = importSourceName(s.source)
	const inGroup = screens.filter((x) => x.q === screen.q)
	const subIndex = inGroup.indexOf(screen)

	let title: ReactNode
	let body: ReactNode = null
	let answers: ReactNode

	switch (screen.q) {
		case "matching": {
			const m = s.matching
			if (!m) return null
			const done = sim.matched >= m.total
			title = done
				? "All your titles are matched"
				: "GoodWatch is still matching your titles"
			body = (
				<div aria-live="polite" className="flex flex-col gap-2">
					<Bar value={sim.matched / m.total} label="Matching titles" />
					<p className="text-sm text-gray-400">
						{fmt(sim.matched)} of {fmt(m.total)} matched.{" "}
						{done
							? "Everything is ready."
							: "This keeps going while you look around."}
					</p>
				</div>
			)
			answers = (
				<>
					<Answer
						selected={local.matching === "now"}
						recommended
						title={done ? "Import everything" : "Import what's ready now"}
						note={
							done
								? undefined
								: "The rest join on their own when they're matched."
						}
						onClick={() => {
							setLocal({ ...local, matching: "now" })
							onNext(index)
						}}
					/>
					<Answer
						selected={local.matching === "wait"}
						title="Wait until all are matched"
						note="Import starts when you tap it, after matching finishes."
						onClick={() => {
							setLocal({ ...local, matching: "wait" })
							onNext(index)
						}}
					/>
				</>
			)
			break
		}
		case "uncertain": {
			const u = s.matching?.uncertain ?? []
			title = `Are these the right ${plural(u.length, "movie")}?`
			body = (
				<>
					<p className="text-gray-400">
						Their names in your {src} file fit more than one title. These are
						GoodWatch's best guesses.
					</p>
					<PosterRow titles={u} />
				</>
			)
			answers = (
				<>
					<Answer
						selected={local.uncertain === "leave"}
						recommended
						title="Leave them out for now"
						note="You can add them from the finished import."
						onClick={() => {
							setLocal({ ...local, uncertain: "leave" })
							onNext(index)
						}}
					/>
					<Answer
						selected={local.uncertain === "add"}
						title="Yes, these are right"
						onClick={() => {
							setLocal({ ...local, uncertain: "add" })
							onNext(index)
						}}
					/>
				</>
			)
			break
		}
		case "conflicts": {
			const k = s.conflicts[screen.i]
			const current = c.conflictPerTitle[k.title.id] ?? c.conflictDefault
			const left = s.conflicts.length - subIndex
			const pick = (v: "keep" | "file") => {
				if (sameForAll) {
					const per = { ...c.conflictPerTitle }
					for (const x of s.conflicts.slice(screen.i)) delete per[x.title.id]
					set({ conflictDefault: v, conflictPerTitle: per })
					setSameForAll(false)
					onNext(index, true)
				} else {
					set({ conflictPerTitle: { ...c.conflictPerTitle, [k.title.id]: v } })
					onNext(index)
				}
			}
			title = (
				<>
					{k.title.name}: {src} says {k.theirs}, you gave it {k.yours} in
					GoodWatch. Which score should stay?
				</>
			)
			body = (
				<div className="flex items-end gap-4">
					<Poster title={k.title} className="w-24 sm:w-28" />
					<p className="text-sm text-gray-400">
						You changed it in GoodWatch on {day(k.yoursAt)}.
					</p>
				</div>
			)
			answers = (
				<>
					{left > 1 && (
						<button
							type="button"
							aria-pressed={sameForAll}
							onClick={() => setSameForAll(!sameForAll)}
							className={`inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-full border-2 px-4 text-sm font-semibold ${sameForAll ? "border-amber-400 bg-amber-400/10 text-amber-100" : "border-slate-700 text-gray-300 hover:border-slate-500"}`}
						>
							<span
								aria-hidden
								className={`flex size-4 items-center justify-center rounded border ${sameForAll ? "border-amber-400 bg-amber-400 text-gray-950" : "border-slate-500"}`}
							>
								{sameForAll && <CheckIcon className="size-3" />}
							</span>
							Same for all {fmt(left)}
						</button>
					)}
					<Answer
						selected={current === "keep"}
						recommended
						title={
							sameForAll ? "Keep my GoodWatch scores" : `Keep my ${k.yours}`
						}
						note="Your newer score stays."
						onClick={() => pick("keep")}
					/>
					<Answer
						selected={current === "file"}
						title={
							sameForAll ? `Use ${src}'s scores` : `Use ${src}'s ${k.theirs}`
						}
						onClick={() => pick("file")}
					/>
				</>
			)
			break
		}
		case "unmatched": {
			const u = s.unmatched[screen.i]
			const current = c.matches[u.raw] ?? u.suggestions[0].id
			const choose = (v: string) => {
				set({ matches: { ...c.matches, [u.raw]: v } })
				onNext(index)
			}
			title = (
				<>
					Your file says “{u.raw}”.{" "}
					{u.suggestions.length > 1 ? "Which one is it?" : "Is this it?"}
				</>
			)
			body = (
				<p className="text-gray-400">
					GoodWatch couldn't be sure, so it's asking. It's your{" "}
					{u.what === "want" ? "Want to See" : u.what}.
				</p>
			)
			answers = (
				<>
					{u.suggestions.map((t, n) => (
						<Answer
							key={t.id}
							selected={current === t.id}
							recommended={n === 0}
							poster={t}
							title={u.suggestions.length > 1 ? t.name : `Yes, ${t.name}`}
							note={`${t.year} · ${t.kind === "show" ? "Show" : "Movie"}`}
							onClick={() => choose(t.id)}
						/>
					))}
					<Answer
						selected={current === "skip"}
						title="Neither, leave it out"
						onClick={() => choose("skip")}
					/>
				</>
			)
			break
		}
		case "undated":
			title = `${plural(s.undatedWatches, "watch", "watches")} in your file have no date. Add them anyway?`
			body = (
				<div className="flex items-center gap-3 text-gray-400">
					<CalendarDaysIcon className="size-10 shrink-0" aria-hidden />
					<p>
						They count as Seen, just without a day. Your watches with dates come
						in as usual.
					</p>
				</div>
			)
			answers = (
				<>
					<Answer
						selected={c.undated === "import"}
						recommended
						title="Add them without a date"
						onClick={() => {
							set({ undated: "import" })
							onNext(index)
						}}
					/>
					<Answer
						selected={c.undated === "skip"}
						title="Leave them out"
						onClick={() => {
							set({ undated: "skip" })
							onNext(index)
						}}
					/>
				</>
			)
			break
		case "rewatch":
			title = `${plural(s.alreadySeenWants.length, "title")} on your wishlist ${s.alreadySeenWants.length === 1 ? "is" : "are"} already Seen. Add them to Want to rewatch?`
			body = <PosterRow titles={s.alreadySeenWants} />
			answers = (
				<>
					<Answer
						selected={c.rewatch === "leave"}
						recommended
						title="No, leave them as Seen"
						onClick={() => {
							set({ rewatch: "leave" })
							onNext(index)
						}}
					/>
					<Answer
						selected={c.rewatch === "rewatch"}
						title="Yes, add to Want to rewatch"
						onClick={() => {
							set({ rewatch: "rewatch" })
							onNext(index)
						}}
					/>
				</>
			)
			break
		case "side-effects": {
			const fx = s.sideEffects
			const n = fx.offWantToSee.length + fx.offNotInterested.length
			const watchesOn = c.include.watches || c.include.episodes
			title = `You watched ${n === 1 ? "this title" : `these ${fmt(n)} titles`}, so ${n === 1 ? "it leaves" : "they leave"} your lists. Is that right?`
			body = (
				<div className="flex flex-col gap-4">
					{fx.offWantToSee.length > 0 && (
						<div className="flex flex-col gap-2">
							<h3 className="text-sm font-semibold text-gray-300">
								Off Want to See
							</h3>
							<PosterRow titles={fx.offWantToSee} />
						</div>
					)}
					{fx.offNotInterested.length > 0 && (
						<div className="flex flex-col gap-2">
							<h3 className="text-sm font-semibold text-gray-300">
								Off Not interested
							</h3>
							<PosterRow titles={fx.offNotInterested} />
						</div>
					)}
				</div>
			)
			answers = (
				<>
					<Answer
						selected={watchesOn}
						recommended
						title="Yes, that's right"
						note="They move to Seen."
						onClick={() => {
							set({
								include: {
									...c.include,
									watches: s.kinds.watches > 0,
									episodes: s.kinds.episodes > 0,
								},
							})
							onNext(index)
						}}
					/>
					<Answer
						selected={!watchesOn}
						title="Leave my watches out"
						note="Your lists stay as they are. Nothing else from the watches comes in."
						onClick={() => {
							set({
								include: { ...c.include, watches: false, episodes: false },
							})
							onNext(index)
						}}
					/>
				</>
			)
			break
		}
	}

	return (
		<section className="flex flex-col gap-6" aria-labelledby="b-q-heading">
			<div className="flex items-center justify-between gap-3 text-sm">
				<button
					type="button"
					onClick={onBack}
					className="-ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg pr-2 font-semibold text-gray-300 hover:text-white"
				>
					<ArrowLeftIcon className="size-5" aria-hidden />
					Back
				</button>
				<span className="text-gray-400">
					Question {groups.indexOf(screen.q) + 1} of {groups.length}
					{inGroup.length > 1 && (
						<span className="text-gray-500">
							{" "}
							· {subIndex + 1}/{inGroup.length}
						</span>
					)}
				</span>
			</div>
			<h2 id="b-q-heading" ref={heading} tabIndex={-1} className={headingClass}>
				{title}
			</h2>
			{body}
			<div className="flex flex-col gap-3">{answers}</div>
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Here's what will happen                                                                                            */

function answerLine(g: Group, s: Scenario, c: Choices, local: Local) {
	const src = importSourceName(s.source)
	switch (g) {
		case "matching":
			return [
				"Still matching",
				local.matching === "now"
					? "Import what's ready now"
					: "Wait until all are matched",
			]
		case "uncertain":
			return [
				`${plural(s.matching?.uncertain.length ?? 0, "uncertain movie")}`,
				local.uncertain === "leave" ? "Leave out for now" : "Add them",
			]
		case "conflicts": {
			const fromFile = s.conflicts.filter(
				(k) => (c.conflictPerTitle[k.title.id] ?? c.conflictDefault) === "file",
			).length
			const keep = s.conflicts.length - fromFile
			return [
				`${plural(s.conflicts.length, "score")} that differ`,
				fromFile === 0
					? "Keep all of yours"
					: keep === 0
						? `Use ${src}'s for all`
						: `Use ${src}'s for ${fmt(fromFile)}, keep ${fmt(keep)} of yours`,
			]
		}
		case "unmatched": {
			const asked = s.unmatched.filter((u) => u.suggestions.length)
			const skipped = asked.filter((u) => c.matches[u.raw] === "skip").length
			return [
				`${plural(asked.length, "likely match", "likely matches")}`,
				skipped === 0
					? "Use all of them"
					: `Use ${fmt(asked.length - skipped)}, leave out ${fmt(skipped)}`,
			]
		}
		case "undated":
			return [
				`${plural(s.undatedWatches, "watch", "watches")} without a date`,
				c.undated === "import" ? "Add without a date" : "Leave out",
			]
		case "rewatch":
			return [
				`${plural(s.alreadySeenWants.length, "Seen title")} on your wishlist`,
				c.rewatch === "leave" ? "Leave as Seen" : "Add to Want to rewatch",
			]
		case "side-effects": {
			const n =
				s.sideEffects.offWantToSee.length +
				s.sideEffects.offNotInterested.length
			return [
				`${plural(n, "title")} leaving your lists`,
				c.include.watches || c.include.episodes
					? "That's right"
					: "Watches left out",
			]
		}
	}
}

function Summary({
	sim,
	groups,
	local,
	heading,
	onEdit,
	onBack,
}: {
	sim: Sim
	groups: Group[]
	local: Local
	heading: HeadingRef
	onEdit: (g: Group) => void
	onBack: () => void
}) {
	const s = sim.scenario
	const c = sim.choices
	const src = importSourceName(s.source)
	const [kindsOpen, setKindsOpen] = useState(false)
	const [outOpen, setOutOpen] = useState(false)
	const nothingNew = newTitles(s) === 0

	if (nothingNew)
		return (
			<section className="flex flex-col gap-5">
				<h2 ref={heading} tabIndex={-1} className={headingClass}>
					Nothing new in this file
				</h2>
				<p>
					All {fmt(s.unchanged)} titles in it are already in GoodWatch, exactly
					the same.
					{s.previous &&
						` You imported this ${src} file on ${day(s.previous.at)}.`}
				</p>
				<p className="text-gray-400">
					Made changes on {src} since then? Export a fresh file and drop it in.
				</p>
				<div>
					<button type="button" className={secondaryButton} onClick={sim.reset}>
						Pick another file
					</button>
				</div>
			</section>
		)

	const m = s.matching
	const waiting = !!m && local.matching === "wait" && sim.matched < m.total
	const share =
		m && local.matching === "now" ? Math.min(1, sim.matched / m.total) : 1
	const count = Math.round(incoming(s, c) * share)
	const kindsIn = (Object.keys(s.kinds) as (keyof Kinds)[]).filter(
		(k) => s.kinds[k] > 0 && c.include[k],
	)
	const noSuggestion = s.unmatched.filter((u) => !u.suggestions.length)
	const outCount = noSuggestion.length + s.unsupported

	return (
		<section className="flex flex-col gap-6">
			<button
				type="button"
				onClick={onBack}
				className="-ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1 self-start rounded-lg pr-2 text-sm font-semibold text-gray-300 hover:text-white"
			>
				<ArrowLeftIcon className="size-5" aria-hidden />
				Back
			</button>
			<div className="flex flex-col gap-3">
				<h2 ref={heading} tabIndex={-1} className={headingClass}>
					Here's what will happen
				</h2>
				<PosterStack titles={s.sample} />
			</div>

			<div className="rounded-2xl bg-gray-900/70 p-5 ring-1 ring-white/10">
				<p className="text-xl font-bold text-white">
					{plural(count, "title")} come in from {src}
				</p>
				<p className="mt-1 text-gray-300">
					{kindsIn.map((k) => kindLine(k, s.kinds[k])).join(", ")}
				</p>
				{s.unchanged > 0 && (
					<p className="mt-2 text-sm text-gray-400">
						{plural(s.unchanged, "title")} you already have stay the same.
						{s.previous && ` Last import: ${day(s.previous.at)}.`}
					</p>
				)}
				{m && local.matching === "now" && sim.matched < m.total && (
					<p className="mt-2 text-sm text-gray-400" aria-live="polite">
						{fmt(m.total - sim.matched)} still matching. They join on their own.
					</p>
				)}
				<div className="mt-3">
					<Disclosure
						label="Choose what comes in"
						open={kindsOpen}
						onToggle={setKindsOpen}
					>
						<ul className="flex flex-wrap gap-2">
							{(Object.keys(s.kinds) as (keyof Kinds)[])
								.filter((k) => s.kinds[k] > 0)
								.map((k) => (
									<li key={k}>
										<button
											type="button"
											aria-pressed={c.include[k]}
											onClick={() =>
												sim.setChoices({
													...c,
													include: { ...c.include, [k]: !c.include[k] },
												})
											}
											className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border-2 px-3 text-sm font-semibold ${c.include[k] ? "border-amber-400/70 bg-amber-400/10 text-white" : "border-slate-700 text-gray-400 line-through"}`}
										>
											{c.include[k] && (
												<CheckIcon
													className="size-4 text-amber-300"
													aria-hidden
												/>
											)}
											{kindLine(k, s.kinds[k])}
										</button>
									</li>
								))}
						</ul>
					</Disclosure>
				</div>
			</div>

			{groups.length > 0 && (
				<div className="flex flex-col gap-2">
					<h3 className="text-sm font-semibold text-gray-400">Your answers</h3>
					<ul className="divide-y divide-white/10 rounded-2xl bg-gray-900/70 ring-1 ring-white/10">
						{groups.map((g) => {
							const [what, answer] = answerLine(g, s, c, local)
							return (
								<li key={g} className="flex items-center gap-3 px-4 py-3">
									<span className="min-w-0 flex-1">
										<span className="block text-sm text-gray-400">{what}</span>
										<span className="block font-semibold text-white">
											{answer}
										</span>
									</span>
									<button
										type="button"
										className={textLink}
										aria-label={`Change: ${what}`}
										onClick={() => onEdit(g)}
									>
										Change
									</button>
								</li>
							)
						})}
					</ul>
				</div>
			)}

			{outCount > 0 && (
				<Disclosure
					label={`${plural(outCount, "entry", "entries")} stay out`}
					open={outOpen}
					onToggle={setOutOpen}
				>
					<div className="flex flex-col gap-2 text-sm text-gray-400">
						{noSuggestion.length > 0 && (
							<>
								<p>GoodWatch couldn't find these titles:</p>
								<ul className="list-disc pl-5 text-gray-300">
									{noSuggestion.map((u) => (
										<li key={u.raw}>{u.raw}</li>
									))}
								</ul>
							</>
						)}
						{s.unsupported > 0 && (
							<p>
								{plural(s.unsupported, "entry", "entries")} aren't movies or
								shows, like podcasts or games.
							</p>
						)}
					</div>
				</Disclosure>
			)}

			<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
				<button
					type="button"
					className={`${primaryButton} sm:min-w-56`}
					disabled={waiting || count === 0}
					onClick={sim.confirm}
				>
					{waiting
						? `Matching ${fmt(sim.matched)} of ${fmt(m?.total ?? 0)}…`
						: `Import ${plural(count, "title")}`}
				</button>
				<p className="text-sm text-gray-400">You can undo it later.</p>
			</div>
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Import and Done                                                                                                    */

function Running({ sim, heading }: { sim: Sim; heading: HeadingRef }) {
	const s = sim.scenario
	const { phase } = sim
	if (phase.at !== "running" && phase.at !== "failed") return null
	const count = incoming(s, sim.choices)
	const failed = phase.at === "failed"
	const lit = Math.floor(phase.progress * Math.min(12, s.sample.length))
	return (
		<section className="flex flex-col gap-5">
			<h2 ref={heading} tabIndex={-1} className={headingClass}>
				{failed
					? `The import stopped at ${Math.round(phase.progress * 100)}%`
					: `Importing ${plural(count, "title")}`}
			</h2>
			<ul className="flex flex-wrap gap-2" aria-hidden>
				{s.sample.slice(0, 12).map((t, i) => (
					<li
						key={t.id}
						className="transition-opacity duration-500"
						style={{ opacity: i < lit ? 1 : 0.2 }}
					>
						<Poster title={t} className="w-12 sm:w-14" />
					</li>
				))}
			</ul>
			<div aria-live="polite">
				<Bar value={phase.progress} label="Import progress" />
				<p className="mt-2 text-sm text-gray-400">
					{Math.round(phase.progress * 100)}% done
				</p>
			</div>
			{failed ? (
				<>
					<p>
						Everything up to there is saved and stays. Continue picks up where
						it stopped.
					</p>
					<div className="flex flex-wrap gap-3">
						<button
							type="button"
							className={primaryButton}
							onClick={sim.resume}
						>
							Continue
						</button>
						<button
							type="button"
							className={secondaryButton}
							onClick={sim.undo}
						>
							Undo what was saved
						</button>
					</div>
				</>
			) : s.runSeconds >= 10 ? (
				<p className="text-gray-400">
					This takes a few minutes. You can leave this page; GoodWatch keeps
					going, and you'll find it under Past imports.
				</p>
			) : (
				<p className="text-gray-400">This only takes a moment.</p>
			)}
		</section>
	)
}

function Done({
	sim,
	local,
	heading,
}: { sim: Sim; local: Local; heading: HeadingRef }) {
	const s = sim.scenario
	const { phase } = sim
	const src = importSourceName(s.source)
	const past = s.entry === "history"
	const count = past ? (s.previous?.added ?? 0) : incoming(s, sim.choices)
	const leaves = s.undoLeaves ?? []
	const kindsIn = (Object.keys(s.kinds) as (keyof Kinds)[]).filter(
		(k) => s.kinds[k] > 0 && (past || sim.choices.include[k]),
	)
	const restMatching =
		s.matching && local.matching === "now"
			? s.matching.total - s.matching.done
			: 0

	if (phase.at === "undoing")
		return (
			<section className="flex flex-col gap-5">
				<h2 ref={heading} tabIndex={-1} className={headingClass}>
					Undoing this import
				</h2>
				<div aria-live="polite">
					<Bar value={phase.progress} label="Undo progress" />
					<p className="mt-2 text-sm text-gray-400">
						{Math.round(phase.progress * 100)}% done
					</p>
				</div>
			</section>
		)

	if (phase.at === "undone")
		return (
			<section className="flex flex-col gap-5">
				<h2 ref={heading} tabIndex={-1} className={headingClass}>
					Undone
				</h2>
				<p>
					GoodWatch is back to how it was before this {src} import.
					{leaves.length > 0 &&
						` ${names(leaves)} stay as they are, since you changed them after the import.`}
				</p>
				<div>
					<button type="button" className={secondaryButton} onClick={sim.reset}>
						Back to imports
					</button>
				</div>
			</section>
		)

	return (
		<section className="flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<h2 ref={heading} tabIndex={-1} className={headingClass}>
					{past
						? `${src} import from ${day(s.previous?.at ?? "")}`
						: `Done. ${plural(count, "title")} are in GoodWatch`}
				</h2>
				{past && (
					<p className="break-all text-sm text-gray-400">{s.fileName}</p>
				)}
				<PosterStack titles={s.sample} max={10} />
			</div>
			<div className="rounded-2xl bg-gray-900/70 p-5 ring-1 ring-white/10">
				<p className="font-semibold text-white">
					{past ? `It added ${plural(count, "title")}` : "What changed"}
				</p>
				<ul className="mt-2 flex flex-col gap-1 text-gray-300">
					{kindsIn.map((k) => (
						<li key={k} className="flex items-center gap-2">
							<CheckIcon className="size-4 text-amber-300" aria-hidden />
							{kindLine(k, s.kinds[k])}
						</li>
					))}
					{!past &&
						s.conflicts.some(
							(k) =>
								(sim.choices.conflictPerTitle[k.title.id] ??
									sim.choices.conflictDefault) === "file",
						) && (
							<li className="flex items-center gap-2">
								<CheckIcon className="size-4 text-amber-300" aria-hidden />
								Some scores now match {src}
							</li>
						)}
				</ul>
				{restMatching > 0 && (
					<p className="mt-3 text-sm text-gray-400">
						{fmt(restMatching)} more join as soon as GoodWatch finishes matching
						them.
					</p>
				)}
				<div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
					<a href="/scores" className={textLink}>
						See your scores
					</a>
					<a href="/taste" className={textLink}>
						See your taste
					</a>
				</div>
			</div>

			<div className="flex flex-col gap-3 border-t border-white/10 pt-5">
				<h3 className="font-semibold text-white">Changed your mind?</h3>
				<p className="text-gray-400">
					Undo takes out what this import added and puts back what it changed.
				</p>
				{leaves.length > 0 && (
					<div className="flex items-center gap-3">
						<PosterStack titles={leaves} size="w-10" />
						<p className="text-sm text-gray-300">
							{names(leaves)} stay as they are. You changed them after this
							import.
						</p>
					</div>
				)}
				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						className={past ? dangerButton : secondaryButton}
						onClick={sim.undo}
					>
						<ArrowUturnLeftIcon className="size-5" aria-hidden />
						Undo this import
					</button>
					<button type="button" className={secondaryButton} onClick={sim.reset}>
						{past ? "Back to imports" : "Import something else"}
					</button>
				</div>
			</div>
		</section>
	)
}
