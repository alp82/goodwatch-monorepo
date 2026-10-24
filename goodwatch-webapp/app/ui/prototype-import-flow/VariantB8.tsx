// PROTOTYPE - throwaway. Variant B8, B7 with the owner's round 3 feedback: a full-width poster row, answers that lock in before moving on, posters that dim on undo, a success screen for a file with nothing new, and a red stopped strip.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import {
	ArrowLeftIcon,
	ArrowUpTrayIcon,
	ArrowUturnLeftIcon,
	CalendarDaysIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import {
	type CSSProperties,
	type ReactNode,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react"
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

/** Parts of an import that wait for an answer. "uncertain" is local: TV Time titles matching wasn't sure about. */
type Topic =
	| "conflicts"
	| "unmatched"
	| "undated"
	| "rewatch"
	| "side-effects"
	| "uncertain"
type Screen =
	| { q: "uncertain" }
	| { q: "conflicts"; i: number }
	| { q: "unmatched"; i: number }
	| { q: "undated" }
	| { q: "rewatch" }
	| { q: "side-effects" }

/** Uncertain TV Time titles go last: they only become a question once matching reaches them. */
function screensFor(s: Scenario): Screen[] {
	const out: Screen[] = []
	for (const q of questionsFor(s)) {
		if (q === "matching") continue
		if (q === "conflicts") s.conflicts.forEach((_, i) => out.push({ q, i }))
		else if (q === "unmatched")
			s.unmatched.forEach((u, i) => u.suggestions.length && out.push({ q, i }))
		else out.push({ q })
	}
	if (s.matching?.uncertain.length) out.push({ q: "uncertain" })
	return out
}

/** Answers the model has no field for, kept here. Only read for screens the member answered. */
interface Local {
	uncertain: "leave" | "add"
	sideEffects: "apply" | "keep"
}
const LOCAL: Local = { uncertain: "leave", sideEffects: "apply" }

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

/** Row names on the Choose step. */
const KIND_NAME: Record<keyof Kinds, string> = {
	ratings: "Scores",
	watches: "Watches",
	episodes: "Episodes",
	want: "Want to See",
	favorites: "Favorites",
	reviews: "Reviews",
	lists: "Lists",
	statuses: "Show statuses",
}

/** A GoodWatch state or list name, set apart so it reads at a glance. */
function St({ children }: { children: ReactNode }) {
	return <span className="font-semibold text-amber-200">{children}</span>
}

const kindLine = (k: keyof Kinds, n: number): ReactNode =>
	k === "want" ? (
		<>
			{fmt(n)} on <St>Want to See</St>
		</>
	) : (
		plural(n, KIND_LABEL[k][0], KIND_LABEL[k][1])
	)

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

/** One or many: picks the verb form. */
const v = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** Titles that come in with the member's kind toggles. */
const incoming = (s: Scenario, c: Choices) =>
	Math.max(
		c.include.watches ? s.kinds.watches : 0,
		c.include.ratings ? s.kinds.ratings : 0,
	) +
	(c.include.want ? s.kinds.want : 0) +
	(c.include.favorites ? s.kinds.favorites : 0)

/** "Want to See and Not interested", for the lists a side effect touches. */
function listNames(s: Scenario) {
	const fx = s.sideEffects
	const want = fx.offWantToSee.length > 0
	const ni = fx.offNotInterested.length > 0
	return (
		<>
			{want && <St>Want to See</St>}
			{want && ni && " and "}
			{ni && <St>Not interested</St>}
		</>
	)
}

/** How many things a topic covers. For per-title topics, `open` is how many titles are still unanswered. */
function topicSize(g: Topic, s: Scenario, open: number) {
	switch (g) {
		case "conflicts":
		case "unmatched":
			return open
		case "undated":
			return s.undatedWatches
		case "rewatch":
			return s.alreadySeenWants.length
		case "side-effects":
			return (
				s.sideEffects.offWantToSee.length +
				s.sideEffects.offNotInterested.length
			)
		case "uncertain":
			return s.matching?.uncertain.length ?? 0
	}
}

/** Short name of a question, for screen readers on the Decide buttons. */
function topicLabel(g: Topic, s: Scenario, open: number) {
	const n = topicSize(g, s, open)
	switch (g) {
		case "conflicts":
			return `${plural(n, "score")} that ${v(n, "differs", "differ")} from yours`
		case "unmatched":
		case "uncertain":
			return `${plural(n, "title")} GoodWatch wasn't sure about`
		case "undated":
			return `${plural(n, "watch", "watches")} without a date`
		case "rewatch":
			return `${plural(n, "Seen title")} on your wishlist`
		case "side-effects":
			return `${plural(n, "watched title")} on your lists`
	}
}

/** What stays true while a topic has no answer. Nothing from it is applied. */
function leftLine(g: Topic, s: Scenario, open: number): ReactNode {
	const n = topicSize(g, s, open)
	switch (g) {
		case "conflicts":
			return `${plural(n, "score")} that ${v(n, "differs stays", "differ stay")} as you have ${v(n, "it", "them")}.`
		case "unmatched":
			return `${plural(n, "title")} GoodWatch wasn't sure about ${v(n, "stays", "stay")} out.`
		case "undated":
			return (
				<>
					{plural(n, "watch", "watches")} without a date{" "}
					{v(n, "isn't", "aren't")} on <St>Seen</St> yet.
				</>
			)
		case "rewatch":
			return (
				<>
					{plural(n, "title")} {v(n, "stays", "stay")} <St>Seen</St>, not on{" "}
					<St>Want to rewatch</St>.
				</>
			)
		case "side-effects":
			return (
				<>
					{plural(n, "watched title")} {v(n, "stays", "stay")} on {listNames(s)}
					. {v(n, "Its watch isn't", "Their watches aren't")} added yet.
				</>
			)
		case "uncertain":
			return `${plural(n, "movie")} GoodWatch wasn't sure about ${v(n, "stays", "stay")} out.`
	}
}

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

/**
 * B2's import animation in one row: posters light up one by one as progress grows, and dim again in reverse when
 * progress falls (undo). Slightly overlapping. The row fills the strip's width when the file has enough titles;
 * the lighting steps follow how many fit. Opacity and scale only; the row's height is fixed.
 */
const POSTER_W = { phone: 36, wide: 44 }
const OVERLAP = 8
function PosterLights({
	titles,
	progress,
	tone = "amber",
}: { titles: Title[]; progress: number; tone?: "amber" | "red" }) {
	const row = useRef<HTMLUListElement>(null)
	const [fit, setFit] = useState(8)
	useEffect(() => {
		const el = row.current
		if (!el) return
		const measure = () => {
			const w = el.clientWidth
			const pw = w >= 400 ? POSTER_W.wide : POSTER_W.phone
			setFit(Math.max(1, Math.floor((w - pw) / (pw - OVERLAP)) + 1))
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const shown = titles.slice(0, fit)
	if (!titles.length) return null
	return (
		<ul
			ref={row}
			className="flex h-[60px] items-center overflow-hidden pl-2 min-[400px]:h-[72px]"
			aria-hidden
		>
			{shown.map((t, i) => {
				const on = progress >= (i + 1) / shown.length - 0.0001
				return (
					<li
						key={t.id}
						className="-ml-2 shrink-0 transition-[opacity,scale] duration-500 ease-out"
						style={{ opacity: on ? 1 : 0.2, scale: on ? "1" : "0.94" }}
					>
						<Poster
							title={t}
							className={`w-9 min-[400px]:w-11 ${tone === "red" && !on ? "grayscale" : ""}`}
						/>
					</li>
				)
			})}
		</ul>
	)
}

/** "312 of 1,240 matched", with the changing number in reserved space so nothing moves. */
function MatchCount({ done, total }: { done: number; total: number }) {
	return (
		<span className="tabular-nums">
			<span
				className="inline-block text-right"
				style={{ minWidth: `${fmt(total).length}ch` }}
			>
				{fmt(done)}
			</span>{" "}
			of {fmt(total)} matched
		</span>
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

function Bar({
	value,
	label,
	slim = false,
	tone = "amber",
}: { value: number; label: string; slim?: boolean; tone?: "amber" | "red" }) {
	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={Math.round(value * 100)}
			className={`${slim ? "h-1.5" : "h-2"} overflow-hidden rounded-full bg-white/10`}
		>
			<div
				className={`h-full origin-left rounded-full transition-transform duration-200 ease-linear ${tone === "red" ? "bg-red-500" : "bg-linear-to-r from-amber-500 to-amber-300"}`}
				style={{ transform: `scaleX(${value})` }}
			/>
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

const backClass =
	"-ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1 self-start rounded-lg pr-2 text-sm font-semibold text-gray-300 hover:text-white"

/* ------------------------------------------------------------------------------------------------------------------ */
/* Stepper: Bring → Choose → Import → Done. The questions live inside Import.                                         */

const STEPS = ["Bring", "Choose", "Import", "Done"] as const
type Step = 1 | 2 | 3 | 4

function Stepper({
	step,
	allDone,
	notes,
	canOpen,
	onOpen,
}: {
	step: Step
	/** Done is only ticked when nothing waits for the member. */
	allDone: boolean
	notes: string[]
	canOpen: (n: number) => boolean
	onOpen: (n: number) => void
}) {
	return (
		<nav aria-label="Import steps" className="mx-auto w-full max-w-2xl">
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
						const finished = n < step || (n === 4 && step === 4 && allDone)
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
									className={`flex size-11 cursor-pointer items-center justify-center rounded-full text-base font-black ring-4 transition-transform duration-300 disabled:cursor-default md:size-12 ${on && !finished ? "scale-110" : ""} ${finished ? "bg-amber-400 text-gray-950 ring-gray-950" : on ? "bg-gray-950 text-amber-300 shadow-[0_0_0_8px_var(--color-gray-950)] ring-amber-400" : "bg-gray-900 text-gray-400 ring-gray-950"}`}
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
									{notes[idx] || " "}
								</span>
							</li>
						)
					})}
				</ol>
			</div>
		</nav>
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
						You'll say yes on {importSourceName(s.source)}, then choose what
						comes in before anything changes.
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
					<p id="b7-drop-hint" className="max-w-md text-sm text-gray-400">
						GoodWatch works out where it's from. Nothing changes until you say
						so.
					</p>
					<button
						type="button"
						className={primaryButton}
						aria-describedby="b7-drop-hint"
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

/** How long a picked answer stays on screen before the next question. */
const LOCK_MS = 700

/* ------------------------------------------------------------------------------------------------------------------ */
/* Answers: nothing is picked until the member picks                                                                  */

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
	title: ReactNode
	note?: string
	poster?: Title
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onClick}
			className={`flex min-h-16 w-full cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-[transform,opacity] duration-200 ease-out active:scale-[0.98] disabled:cursor-default sm:px-5 ${selected ? "border-amber-400 bg-amber-400/15 group-data-locked/answers:scale-[1.03] group-data-locked/answers:bg-amber-400/25" : "border-slate-700 bg-slate-900/60 hover:border-slate-500 group-data-locked/answers:opacity-40"}`}
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
				className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-transform duration-200 ease-out ${selected ? "scale-125 border-amber-400 bg-amber-400 text-gray-950" : "border-slate-600"}`}
			>
				{selected && <CheckIcon className="size-4" />}
			</span>
		</button>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The variant                                                                                                        */

export function VariantB8({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const { phase } = sim
	const m = s.matching
	const screens = useMemo(() => screensFor(s), [s])
	const topics = useMemo(
		() => [...new Set(screens.map((x) => x.q))] as Topic[],
		[screens],
	)
	const [started, setStarted] = useState(false)
	const [pos, setPos] = useState<number | null>(null)
	const [dir, setDir] = useState<1 | -1>(1)
	/** What the member picked on each screen. A screen without an entry is not decided yet. */
	const [picked, setPicked] = useState<Record<number, string>>({})
	const [deferred, setDeferred] = useState(false)
	const [local, setLocal] = useState<Local>(LOCAL)
	const [sameForAll, setSameForAll] = useState(false)
	const [matched, setMatched] = useState(0)
	/** The screen whose answer just locked in. It shows the pick for a beat before the next screen slides in. */
	const [locking, setLocking] = useState<number | null>(null)
	const lockTimer = useRef(0)
	useEffect(() => () => window.clearTimeout(lockTimer.current), [])

	// Back at the start (another file, Import something else, after Undo): forget this run.
	useEffect(() => {
		if (phase.at !== "start") return
		setStarted(false)
		setPos(null)
		setPicked({})
		setDeferred(false)
		setLocal(LOCAL)
		setSameForAll(false)
	}, [phase.at])

	// TV Time keeps matching while the import runs.
	useEffect(() => {
		if (!started || !m || matched >= m.total) return
		const id = window.setTimeout(
			() => setMatched((n) => Math.min(m.total, n + 62)),
			300,
		)
		return () => window.clearTimeout(id)
	}, [started, m, matched])

	const reached = !!m && matched >= m.done + (m.total - m.done) * 0.6
	const matchingDone = !m || matched >= m.total
	const available = (i: number) => screens[i].q !== "uncertain" || reached
	/** Every question screen the member can see now: the counter's "of". Grows when matching adds one. */
	const shown = screens.map((_, i) => i).filter(available)
	const openIdx = (p: Record<number, string>) =>
		shown.filter((i) => p[i] === undefined)
	const open = openIdx(picked)
	const openIn = (g: Topic) => open.filter((i) => screens[i].q === g).length
	const known = topics.filter((g) => g !== "uncertain" || reached)
	const leftTopics = known.filter((g) => openIn(g) > 0)

	const runOver = phase.at === "done"
	const ready =
		started &&
		runOver &&
		matchingDone &&
		pos === null &&
		(deferred || open.length === 0)
	const showDone =
		phase.at === "undoing" ||
		phase.at === "undone" ||
		(phase.at === "done" && (!started || ready))
	const working = started && !showDone
	const choosing = phase.at === "preview" && !started

	// Matching reached the uncertain titles: ask, unless the member said "later". Not their action, so no focus move.
	const auto = useRef(false)
	const uIdx = screens.findIndex((x) => x.q === "uncertain")
	useEffect(() => {
		if (
			started &&
			pos === null &&
			!deferred &&
			reached &&
			uIdx >= 0 &&
			picked[uIdx] === undefined &&
			phase.at !== "failed"
		) {
			auto.current = true
			setDir(1)
			setPos(uIdx)
		}
	}, [started, pos, deferred, reached, uIdx, picked, phase.at])

	// Focus moves to the new screen's heading, after the member's first action.
	const heading = useRef<HTMLHeadingElement>(null)
	const screenKey = showDone
		? `done:${phase.at}`
		: started
			? pos === null
				? `wait:${phase.at === "failed"}`
				: `q${pos}`
			: phase.at
	const first = useRef(true)
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		if (auto.current) {
			auto.current = false
			return
		}
		heading.current?.focus({ preventScroll: false })
	}, [screenKey])

	const go = (i: number | null, d: 1 | -1) => {
		window.clearTimeout(lockTimer.current)
		setLocking(null)
		setDir(d)
		setPos(i)
	}
	const start = () => {
		setStarted(true)
		setMatched(m ? sim.matched : 0)
		setPicked({})
		setDeferred(false)
		go(screens.length && screens[0].q !== "uncertain" ? 0 : null, 1)
		sim.confirm()
	}
	/** An answer applies its part now, then the next open question shows, or the run when none are left. */
	const answer = (from: number, key: string, skipGroup = false) => {
		const next = { ...picked, [from]: key }
		if (skipGroup)
			screens.forEach((x, i) => {
				if (i > from && x.q === screens[from].q) next[i] = key
			})
		setPicked(next)
		setLocking(from)
		const rest = openIdx(next)
		window.clearTimeout(lockTimer.current)
		lockTimer.current = window.setTimeout(() => {
			go(rest.find((i) => i > from) ?? rest[0] ?? null, 1)
		}, LOCK_MS)
	}
	const later = () => {
		setSameForAll(false)
		setDeferred(true)
		go(null, 1)
	}
	const decide = (g: Topic) => {
		setDeferred(false)
		go(open.find((i) => screens[i].q === g) ?? null, -1)
	}

	const count = incoming(s, sim.choices)
	const pct =
		phase.at === "running" || phase.at === "failed"
			? Math.round(phase.progress * 100)
			: 100
	const caughtUp = choosing && newTitles(s) === 0
	const step: Step = showDone || caughtUp ? 4 : started ? 3 : choosing ? 2 : 1
	const notes = caughtUp
		? [importSourceName(s.source), "", "", "Up to date"]
		: [
				step > 1 ? importSourceName(s.source) : "",
				step > 2 ? plural(count, "title") : "",
				step !== 3
					? ""
					: phase.at === "failed"
						? "Stopped"
						: runOver
							? open.length
								? `${fmt(open.length)} to answer`
								: "Finishing"
							: `${pct}%`,
				phase.at === "undone"
					? "Undone"
					: showDone && started && leftTopics.length
						? `${fmt(leftTopics.length)} to decide`
						: "",
			]

	const current = pos === null ? null : screens[pos]

	return (
		<div className="flex flex-col gap-8 md:gap-10">
			<Stepper
				step={step}
				allDone={!(started && leftTopics.length)}
				notes={notes}
				canOpen={(n) => n === 1 && choosing}
				onOpen={() => sim.reset()}
			/>
			<div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
				{working && (
					<Strip
						sim={sim}
						count={count}
						matched={matched}
						questionsLeft={open.length}
						showFailure={!!current}
					/>
				)}
				{step === 1 && <Bring sim={sim} heading={heading} />}
				{choosing && (
					<Slide key="choose" dir={1}>
						<Choose sim={sim} heading={heading} onImport={start} />
					</Slide>
				)}
				{working && current && pos !== null && (
					<Slide key={pos} dir={dir}>
						<Ask
							sim={sim}
							screen={current}
							index={pos}
							screens={screens}
							number={shown.indexOf(pos) + 1}
							of={shown.length}
							picked={picked[pos]}
							locked={locking === pos}
							local={local}
							setLocal={setLocal}
							sameForAll={sameForAll}
							setSameForAll={setSameForAll}
							heading={heading}
							onBack={
								shown.indexOf(pos) > 0
									? () => go(shown[shown.indexOf(pos) - 1], -1)
									: undefined
							}
							onNext={answer}
							onLater={later}
						/>
					</Slide>
				)}
				{working && !current && (
					<Slide key="wait" dir={1}>
						<Waiting
							sim={sim}
							heading={heading}
							waitingFor={deferred ? leftTopics.length : 0}
							answeredAny={Object.keys(picked).length > 0}
							mayAsk={!!m && !reached}
						/>
					</Slide>
				)}
				{showDone && (
					<Done
						sim={sim}
						started={started}
						local={local}
						screens={screens}
						picked={picked}
						leftTopics={leftTopics}
						openIn={openIn}
						heading={heading}
						onDecide={decide}
					/>
				)}
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The progress strip, above whatever shows while the import runs                                                     */

function Strip({
	sim,
	count,
	matched,
	questionsLeft,
	showFailure,
}: {
	sim: Sim
	count: number
	matched: number
	questionsLeft: number
	/** A question is on screen, so the strip carries the stop and Continue. Otherwise the page below does. */
	showFailure: boolean
}) {
	const s = sim.scenario
	const { phase } = sim
	const m = s.matching
	const failed = phase.at === "failed"
	const over = phase.at === "done"
	const p = phase.at === "running" || phase.at === "failed" ? phase.progress : 1
	const pct = Math.round(p * 100)
	const why = s.failReason ?? "Your import stopped."
	const left = questionsLeft
		? ` · ${plural(questionsLeft, "question")} left`
		: m && matched < m.total
			? " · still matching"
			: ""
	const said = failed
		? `${why} What came in so far is saved.`
		: over
			? `${plural(count, "title")} in.${questionsLeft ? ` ${plural(questionsLeft, "question")} left.` : ""}`
			: `Import ${Math.floor(pct / 25) * 25}% done.`
	return (
		<section
			aria-label="Import progress"
			className={`rounded-2xl px-4 py-3 transition-colors duration-300 ${failed ? "border-l-8 border-red-700 bg-red-950/70 ring-1 ring-red-700/60" : "bg-gray-900/70 ring-1 ring-white/10"}`}
		>
			<p className="sr-only" aria-live="polite">
				{said}
			</p>
			<PosterLights
				titles={s.sample}
				progress={p}
				tone={failed ? "red" : "amber"}
			/>
			<div
				className="mt-2 flex items-center justify-between gap-3 text-sm"
				aria-hidden
			>
				<span
					className={`flex min-w-0 items-center gap-2 font-semibold ${failed ? "text-red-100" : "text-white"}`}
				>
					{failed && (
						<ExclamationTriangleIcon
							className="size-5 shrink-0 text-red-300"
							aria-hidden
						/>
					)}
					{failed
						? `Stopped at ${pct}%`
						: over
							? `${plural(count, "title")} in${left}`
							: `Importing ${plural(count, "title")}`}
				</span>
				<span
					className={`tabular-nums ${failed ? "font-semibold text-red-200" : "text-amber-300"}`}
				>
					{pct}%
				</span>
			</div>
			<div className="mt-2">
				<Bar
					slim
					value={p}
					label="Import progress"
					tone={failed ? "red" : "amber"}
				/>
			</div>
			{m && (
				<p className="mt-2 text-xs text-gray-400">
					<MatchCount done={matched} total={m.total} />
				</p>
			)}
			{failed && showFailure && (
				<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
					<div className="min-w-0 text-sm">
						<p className="font-semibold text-white">{why}</p>
						<p className="text-red-100/80">What came in so far is saved.</p>
					</div>
					<button type="button" className={primaryButton} onClick={sim.resume}>
						Continue
					</button>
				</div>
			)}
			{!failed && !over && s.runSeconds >= 10 && (
				<p className="mt-2 text-xs text-gray-400">
					This takes a few minutes. You can leave this page; it keeps going.
				</p>
			)}
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Choose: every kind the file has, all checked, one Import button                                                    */

function Choose({
	sim,
	heading,
	onImport,
}: {
	sim: Sim
	heading: HeadingRef
	onImport: () => void
}) {
	const s = sim.scenario
	const c = sim.choices
	const src = importSourceName(s.source)

	if (newTitles(s) === 0)
		return (
			<section className="flex flex-col gap-6">
				<div className="flex flex-col items-center gap-5 rounded-3xl bg-amber-400/5 px-5 py-8 text-center ring-1 ring-amber-400/30 sm:px-8">
					<span className="flex size-16 items-center justify-center rounded-full bg-amber-400 text-gray-950 shadow-[0_0_0_10px_rgb(251_191_36/0.12)]">
						<CheckIcon className="size-9" aria-hidden />
					</span>
					<div className="flex flex-col gap-2">
						<h2 ref={heading} tabIndex={-1} className={headingClass}>
							You're all caught up
						</h2>
						<p className="text-lg text-gray-200">
							All {fmt(s.unchanged)} titles from this {src} file are already in
							GoodWatch.
						</p>
						{s.previous && (
							<p className="text-sm text-gray-400">
								You imported it on {day(s.previous.at)}. Nothing to do.
							</p>
						)}
					</div>
					<PosterStack titles={s.sample} max={10} />
				</div>
				<div className="flex flex-col gap-3">
					<p className="text-gray-400">
						Made changes on {src} since then? Export a fresh file and drop it
						in.
					</p>
					<div className="flex flex-wrap gap-3">
						<a href="/scores" className={primaryButton}>
							See your scores
						</a>
						<button
							type="button"
							className={secondaryButton}
							onClick={sim.reset}
						>
							Pick another file
						</button>
					</div>
				</div>
			</section>
		)

	const m = s.matching
	const count = incoming(s, c)
	const kinds = (Object.keys(s.kinds) as (keyof Kinds)[]).filter(
		(k) => s.kinds[k] > 0,
	)
	const anyIn = kinds.some((k) => c.include[k])

	return (
		<section className="flex flex-col gap-6">
			<button type="button" onClick={sim.reset} className={backClass}>
				<ArrowLeftIcon className="size-5" aria-hidden />
				Back
			</button>
			<h2 ref={heading} tabIndex={-1} className={headingClass}>
				What should come in?
			</h2>
			<fieldset>
				<legend className="sr-only">From {src}</legend>
				<ul className="divide-y divide-white/10 overflow-hidden rounded-2xl bg-gray-900/70 ring-1 ring-white/10">
					{kinds.map((k) => (
						<li key={k}>
							<label className="flex min-h-14 cursor-pointer items-center gap-4 px-4 py-3 hover:bg-white/5 sm:px-5">
								<input
									type="checkbox"
									checked={c.include[k]}
									onChange={() =>
										sim.setChoices({
											...c,
											include: { ...c.include, [k]: !c.include[k] },
										})
									}
									className="size-5 shrink-0 cursor-pointer accent-amber-400"
								/>
								<span
									className={`flex-1 font-semibold ${c.include[k] ? "text-white" : "text-gray-400"}`}
								>
									{KIND_NAME[k]}
								</span>
								<span
									className={`tabular-nums ${c.include[k] ? "text-gray-200" : "text-gray-500"}`}
								>
									{fmt(s.kinds[k])}
								</span>
							</label>
						</li>
					))}
				</ul>
			</fieldset>
			{m && (
				<p className="-mt-3 text-sm text-gray-400">
					<MatchCount done={sim.matched} total={m.total} />
				</p>
			)}
			<button
				type="button"
				className={`${primaryButton} w-full sm:w-auto sm:min-w-56 sm:self-start`}
				disabled={!anyIn}
				onClick={onImport}
			>
				{count > 0 ? `Import ${plural(count, "title")}` : "Import"}
			</button>
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Questions while it runs: one per screen, a plain fact then a yes/no question                                       */

function Ask({
	sim,
	screen,
	index,
	screens,
	number,
	of,
	picked,
	locked,
	local,
	setLocal,
	sameForAll,
	setSameForAll,
	heading,
	onBack,
	onNext,
	onLater,
}: {
	sim: Sim
	screen: Screen
	index: number
	screens: Screen[]
	number: number
	of: number
	/** The member's answer on this screen, if they gave one. Nothing is picked before that. */
	picked: string | undefined
	/** The answer just locked in: the pick lights up, the rest fade, buttons wait. */
	locked: boolean
	local: Local
	setLocal: (l: Local) => void
	sameForAll: boolean
	setSameForAll: (v: boolean) => void
	heading: HeadingRef
	onBack?: () => void
	onNext: (from: number, key: string, skipGroup?: boolean) => void
	onLater: () => void
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
		case "uncertain": {
			const u = s.matching?.uncertain ?? []
			const n = u.length
			const pick = (val: Local["uncertain"]) => {
				setLocal({ ...local, uncertain: val })
				onNext(index, val)
			}
			title = `GoodWatch isn't sure about ${plural(n, "movie")} in your ${src} file. ${v(n, "Is this the right one?", "Are these the right ones?")}`
			body = <PosterRow titles={u} />
			answers = (
				<>
					<Answer
						selected={picked === "add"}
						title={v(n, "Yes, add it", "Yes, add them")}
						onClick={() => pick("add")}
					/>
					<Answer
						selected={picked === "leave"}
						recommended
						title={v(n, "No, leave it out", "No, leave them out")}
						onClick={() => pick("leave")}
					/>
				</>
			)
			break
		}
		case "conflicts": {
			const k = s.conflicts[screen.i]
			const left = s.conflicts.length - subIndex
			const pick = (val: "keep" | "file") => {
				if (sameForAll) {
					const per = { ...c.conflictPerTitle }
					for (const x of s.conflicts.slice(screen.i)) delete per[x.title.id]
					set({ conflictDefault: val, conflictPerTitle: per })
					setSameForAll(false)
					onNext(index, val, true)
				} else {
					set({
						conflictPerTitle: { ...c.conflictPerTitle, [k.title.id]: val },
					})
					onNext(index, val)
				}
			}
			title = (
				<>
					You gave {k.title.name} a {k.yours} in GoodWatch. {src} has {k.theirs}
					. Keep your {k.yours}?
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
						<label className="inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-full border-2 border-slate-700 px-4 text-sm font-semibold text-gray-300 hover:border-slate-500 has-checked:border-amber-400 has-checked:bg-amber-400/10 has-checked:text-amber-100">
							<input
								type="checkbox"
								checked={sameForAll}
								onChange={() => setSameForAll(!sameForAll)}
								className="size-4 cursor-pointer accent-amber-400"
							/>
							Same answer for all {fmt(left)}
						</label>
					)}
					<Answer
						selected={picked === "keep"}
						recommended
						title={
							sameForAll
								? "Yes, keep my GoodWatch scores"
								: `Yes, keep my ${k.yours}`
						}
						onClick={() => pick("keep")}
					/>
					<Answer
						selected={picked === "file"}
						title={
							sameForAll
								? `No, use ${src}'s scores`
								: `No, use ${src}'s ${k.theirs}`
						}
						onClick={() => pick("file")}
					/>
				</>
			)
			break
		}
		case "unmatched": {
			const u = s.unmatched[screen.i]
			const one = u.suggestions.length === 1
			const choose = (val: string) => {
				set({ matches: { ...c.matches, [u.raw]: val } })
				onNext(index, val)
			}
			const what =
				u.what === "want" ? (
					<>
						on your <St>Want to See</St>
					</>
				) : u.what === "watch" ? (
					"a watch"
				) : (
					"a score"
				)
			title = one ? (
				<>
					Your file has “{u.raw}”. Is it {u.suggestions[0].name} (
					{u.suggestions[0].year})?
				</>
			) : (
				<>Your file has “{u.raw}”. Which title is it?</>
			)
			body = <p className="text-gray-400">It's {what} in your file.</p>
			answers = (
				<>
					{u.suggestions.map((t, n) => (
						<Answer
							key={t.id}
							selected={picked === t.id}
							recommended={n === 0}
							poster={t}
							title={one ? `Yes, it's ${t.name}` : t.name}
							note={`${t.year} · ${t.kind === "show" ? "Show" : "Movie"}`}
							onClick={() => choose(t.id)}
						/>
					))}
					<Answer
						selected={picked === "skip"}
						title={one ? "No, leave it out" : "Neither, leave it out"}
						onClick={() => choose("skip")}
					/>
				</>
			)
			break
		}
		case "undated": {
			const n = s.undatedWatches
			const pick = (val: Choices["undated"]) => {
				set({ undated: val })
				onNext(index, val)
			}
			title = (
				<>
					{plural(n, "watch", "watches")} in your file {v(n, "has", "have")} no
					date. Add {v(n, "it", "them")} to <St>Seen</St> anyway?
				</>
			)
			body = (
				<div className="flex items-center gap-3 text-gray-400">
					<CalendarDaysIcon className="size-8 shrink-0" aria-hidden />
					<p>Your watches with a date are already going in.</p>
				</div>
			)
			answers = (
				<>
					<Answer
						selected={picked === "import"}
						recommended
						title={`Yes, add ${v(n, "it", "them")} without a date`}
						onClick={() => pick("import")}
					/>
					<Answer
						selected={picked === "skip"}
						title={`No, leave ${v(n, "it", "them")} out`}
						onClick={() => pick("skip")}
					/>
				</>
			)
			break
		}
		case "rewatch": {
			const n = s.alreadySeenWants.length
			const pick = (val: Choices["rewatch"]) => {
				set({ rewatch: val })
				onNext(index, val)
			}
			title = (
				<>
					{plural(n, "title")} on your wishlist {v(n, "is", "are")} already{" "}
					<St>Seen</St>. Add {v(n, "it", "them")} to <St>Want to rewatch</St>?
				</>
			)
			body = <PosterRow titles={s.alreadySeenWants} />
			answers = (
				<>
					<Answer
						selected={picked === "leave"}
						recommended
						title={
							<>
								No, leave {v(n, "it", "them")} as <St>Seen</St>
							</>
						}
						onClick={() => pick("leave")}
					/>
					<Answer
						selected={picked === "rewatch"}
						title={
							<>
								Yes, add to <St>Want to rewatch</St>
							</>
						}
						onClick={() => pick("rewatch")}
					/>
				</>
			)
			break
		}
		case "side-effects": {
			const fx = s.sideEffects
			const n = fx.offWantToSee.length + fx.offNotInterested.length
			const pick = (val: Local["sideEffects"]) => {
				setLocal({ ...local, sideEffects: val })
				onNext(index, val)
			}
			title = (
				<>
					You watched {plural(n, "title")} that {v(n, "is", "are")} on your
					lists. Take {v(n, "it", "them")} off {listNames(s)}?
				</>
			)
			body = (
				<div className="flex flex-col gap-4">
					{fx.offWantToSee.length > 0 && (
						<div className="flex flex-col gap-2">
							<h3 className="text-sm text-gray-300">
								On <St>Want to See</St>
							</h3>
							<PosterRow titles={fx.offWantToSee} />
						</div>
					)}
					{fx.offNotInterested.length > 0 && (
						<div className="flex flex-col gap-2">
							<h3 className="text-sm text-gray-300">
								On <St>Not interested</St>
							</h3>
							<PosterRow titles={fx.offNotInterested} />
						</div>
					)}
				</div>
			)
			answers = (
				<>
					<Answer
						selected={picked === "apply"}
						recommended
						title={`Yes, take ${v(n, "it", "them")} off`}
						onClick={() => pick("apply")}
					/>
					<Answer
						selected={picked === "keep"}
						title={`No, keep ${v(n, "it", "them")} on my lists`}
						note={v(n, "Its watch stays out.", "Their watches stay out.")}
						onClick={() => pick("keep")}
					/>
				</>
			)
			break
		}
	}

	return (
		<section className="flex flex-col gap-6" aria-labelledby="b8-q-heading">
			<div className="flex min-h-11 items-center justify-between gap-3 text-sm">
				{onBack ? (
					<button type="button" onClick={onBack} className={backClass}>
						<ArrowLeftIcon className="size-5" aria-hidden />
						Back
					</button>
				) : (
					<span />
				)}
				<span className="tabular-nums text-gray-400">
					Question {number} of {of}
				</span>
			</div>
			<h2
				id="b8-q-heading"
				ref={heading}
				tabIndex={-1}
				className={headingClass}
			>
				{title}
			</h2>
			{body}
			<fieldset
				disabled={locked}
				data-locked={locked || undefined}
				className="group/answers flex flex-col gap-3"
			>
				{answers}
			</fieldset>
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-white/10 pt-4 text-sm">
				<button type="button" className={textLink} onClick={onLater}>
					Decide later
				</button>
				<span className="text-gray-400">
					Nothing here changes until you answer.
				</span>
			</div>
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Nothing to ask right now: the run itself                                                                           */

function Waiting({
	sim,
	heading,
	waitingFor,
	answeredAny,
	mayAsk,
}: {
	sim: Sim
	heading: HeadingRef
	/** Questions the member put off. */
	waitingFor: number
	answeredAny: boolean
	/** TV Time: matching may still find titles to ask about. */
	mayAsk: boolean
}) {
	const s = sim.scenario
	const { phase } = sim
	const src = importSourceName(s.source)

	if (phase.at === "failed")
		return (
			<section className="flex flex-col gap-4">
				<h2 ref={heading} tabIndex={-1} className={headingClass}>
					Your import stopped
				</h2>
				<p className="text-lg text-white">
					{s.failReason ?? "Something went wrong on GoodWatch's side."}
				</p>
				<p className="text-gray-300">
					What came in so far is saved. Continue picks up where it stopped.
				</p>
				<div className="flex flex-wrap gap-3">
					<button type="button" className={primaryButton} onClick={sim.resume}>
						Continue
					</button>
					<button type="button" className={secondaryButton} onClick={sim.undo}>
						Undo what came in
					</button>
				</div>
			</section>
		)

	return (
		<section className="flex flex-col gap-3">
			<h2 ref={heading} tabIndex={-1} className={headingClass}>
				{phase.at === "done"
					? "Finishing the matching"
					: waitingFor > 0
						? `${plural(waitingFor, "question")} ${v(waitingFor, "waits", "wait")} for the end`
						: answeredAny
							? "Thanks! Your titles are almost in"
							: `Your ${src} titles are moving in`}
			</h2>
			<p className="text-gray-400">
				{waitingFor > 0
					? `Nothing from ${v(waitingFor, "it", "them")} changes until you answer.`
					: mayAsk || phase.at === "done"
						? "If GoodWatch isn't sure about a title, it asks you here."
						: s.runSeconds >= 10
							? "Ready in a few minutes. You can leave this page; it keeps going."
							: "Ready in a moment."}
			</p>
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Done                                                                                                               */

/** What the member's answers changed, in plain lines. Unanswered screens add nothing. */
function appliedLines(
	s: Scenario,
	c: Choices,
	local: Local,
	screens: Screen[],
	picked: Record<number, string>,
) {
	const src = importSourceName(s.source)
	const out: { key: string; line: ReactNode }[] = []
	const did = (q: Topic) =>
		screens.some((x, i) => x.q === q && picked[i] !== undefined)
	let took = 0
	let kept = 0
	let used = 0
	let skipped = 0
	screens.forEach((x, i) => {
		if (picked[i] === undefined) return
		if (x.q === "conflicts") {
			if (picked[i] === "file") took++
			else kept++
		} else if (x.q === "unmatched") {
			if (picked[i] === "skip") skipped++
			else used++
		}
	})
	if (took)
		out.push({
			key: "took",
			line: `${plural(took, "score")} now ${v(took, "matches", "match")} ${src}`,
		})
	if (kept)
		out.push({
			key: "kept",
			line: `${plural(kept, "score")} kept as you had ${v(kept, "it", "them")}`,
		})
	if (used)
		out.push({
			key: "used",
			line: `${plural(used, "title")} added as the one you picked`,
		})
	if (skipped)
		out.push({ key: "skipped", line: `${plural(skipped, "title")} left out` })
	if (did("undated"))
		out.push({
			key: "undated",
			line:
				c.undated === "import" ? (
					<>
						{plural(s.undatedWatches, "watch", "watches")} added to{" "}
						<St>Seen</St> without a date
					</>
				) : (
					"Watches without a date left out"
				),
		})
	if (did("rewatch")) {
		const n = s.alreadySeenWants.length
		out.push({
			key: "rewatch",
			line:
				c.rewatch === "rewatch" ? (
					<>
						{plural(n, "title")} added to <St>Want to rewatch</St>
					</>
				) : (
					<>
						{plural(n, "wishlist title")} left as <St>Seen</St>
					</>
				),
		})
	}
	if (did("side-effects")) {
		const n =
			s.sideEffects.offWantToSee.length + s.sideEffects.offNotInterested.length
		out.push({
			key: "side-effects",
			line:
				local.sideEffects === "apply" ? (
					<>
						{plural(n, "watched title")} taken off {listNames(s)}
					</>
				) : (
					<>
						{plural(n, "title")} kept on {listNames(s)}
					</>
				),
		})
	}
	if (did("uncertain")) {
		const n = s.matching?.uncertain.length ?? 0
		out.push({
			key: "uncertain",
			line:
				local.uncertain === "add"
					? `${plural(n, "more movie")} added`
					: `${plural(n, "movie")} GoodWatch wasn't sure about left out`,
		})
	}
	return out
}

function Done({
	sim,
	started,
	local,
	screens,
	picked,
	leftTopics,
	openIn,
	heading,
	onDecide,
}: {
	sim: Sim
	started: boolean
	local: Local
	screens: Screen[]
	picked: Record<number, string>
	leftTopics: Topic[]
	openIn: (g: Topic) => number
	heading: HeadingRef
	onDecide: (g: Topic) => void
}) {
	const s = sim.scenario
	const { phase } = sim
	const src = importSourceName(s.source)
	const past = s.entry === "history" && !started
	const count = past ? (s.previous?.added ?? 0) : incoming(s, sim.choices)
	const leaves = s.undoLeaves ?? []
	const kindsIn = (Object.keys(s.kinds) as (keyof Kinds)[]).filter(
		(k) => s.kinds[k] > 0 && (past || sim.choices.include[k]),
	)
	const applied = past
		? []
		: appliedLines(s, sim.choices, local, screens, picked)
	const noSuggestion = s.unmatched.filter((u) => !u.suggestions.length)
	const outCount = past ? 0 : noSuggestion.length + s.unsupported
	const [outOpen, setOutOpen] = useState(false)

	if (phase.at === "undoing" || phase.at === "undone") {
		const left = phase.at === "undoing" ? 1 - phase.progress : 0
		return (
			<section className="flex flex-col gap-5">
				<div className="rounded-2xl bg-gray-900/70 px-4 py-3 ring-1 ring-white/10">
					<PosterLights titles={s.sample} progress={left} />
					<div
						className="mt-2 flex items-center justify-between gap-3 text-sm"
						aria-hidden
					>
						<span className="min-w-0 font-semibold text-white">
							{phase.at === "undoing"
								? `Taking out ${plural(count, "title")}`
								: `${plural(count, "title")} taken out`}
						</span>
						<span className="tabular-nums text-amber-300">
							{Math.round((1 - left) * 100)}%
						</span>
					</div>
					<div className="mt-2">
						<Bar slim value={left} label="Undo progress" />
					</div>
				</div>
				{phase.at === "undoing" ? (
					<h2 ref={heading} tabIndex={-1} className={headingClass}>
						Undoing this import
					</h2>
				) : (
					<>
						<h2 ref={heading} tabIndex={-1} className={headingClass}>
							Undone
						</h2>
						<p>
							GoodWatch is back to how it was before this {src} import.
							{leaves.length > 0 &&
								` ${names(leaves)} stay as they are, since you changed them after the import.`}
						</p>
						<div>
							<button
								type="button"
								className={secondaryButton}
								onClick={sim.reset}
							>
								Back to imports
							</button>
						</div>
					</>
				)}
			</section>
		)
	}

	const lines: { key: string; line: ReactNode }[] = [
		...kindsIn.map((k) => ({ key: k, line: kindLine(k, s.kinds[k]) })),
		...applied,
		...(!past && s.unchanged > 0
			? [
					{
						key: "unchanged",
						line: `${plural(s.unchanged, "title")} you already had stayed the same`,
					},
				]
			: []),
	]

	return (
		<section className="flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<h2 ref={heading} tabIndex={-1} className={headingClass}>
					{past
						? `${src} import from ${day(s.previous?.at ?? "")}`
						: leftTopics.length
							? `${plural(count, "title")} are in GoodWatch`
							: `Done. ${plural(count, "title")} are in GoodWatch`}
				</h2>
				{past && (
					<p className="break-all text-sm text-gray-400">{s.fileName}</p>
				)}
				<PosterStack titles={s.sample} max={10} />
			</div>

			{leftTopics.length > 0 && (
				<div className="rounded-2xl bg-amber-400/5 p-5 ring-1 ring-amber-400/30">
					<h3 className="text-lg font-bold text-white">
						{fmt(leftTopics.length)} left to decide
					</h3>
					<p className="mt-1 text-sm text-gray-400">
						Nothing from {v(leftTopics.length, "this", "these")} changed yet.
					</p>
					<ul className="mt-2 divide-y divide-white/10">
						{leftTopics.map((g) => (
							<li key={g} className="flex items-center gap-3 py-3">
								<span className="min-w-0 flex-1 text-gray-200">
									{leftLine(g, s, openIn(g))}
								</span>
								<button
									type="button"
									className={textLink}
									aria-label={`Decide: ${topicLabel(g, s, openIn(g))}`}
									onClick={() => onDecide(g)}
								>
									Decide
								</button>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="rounded-2xl bg-gray-900/70 p-5 ring-1 ring-white/10">
				<p className="font-semibold text-white">
					{past ? `It added ${plural(count, "title")}` : "What changed"}
				</p>
				<ul className="mt-2 flex flex-col gap-1 text-gray-300">
					{lines.map(({ key, line }) => (
						<li key={key} className="flex items-center gap-2">
							<CheckIcon
								className="size-4 shrink-0 text-amber-300"
								aria-hidden
							/>
							<span>{line}</span>
						</li>
					))}
				</ul>
				{outCount > 0 && (
					<div className="mt-3">
						<Disclosure
							label={`${fmt(outCount)} from your file couldn't come in`}
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
										{fmt(s.unsupported)}{" "}
										{v(
											s.unsupported,
											"isn't a movie or show",
											"aren't movies or shows",
										)}
										, like podcasts or games.
									</p>
								)}
							</div>
						</Disclosure>
					</div>
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
					Undo takes out what this import added
					{applied.length > 0 ? ", including your answers," : ""} and puts back
					what it changed.
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
