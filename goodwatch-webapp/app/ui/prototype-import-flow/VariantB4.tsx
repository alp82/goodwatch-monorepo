// PROTOTYPE - throwaway. Variant B4, "Start from where your movies are": Bring starts with where the member tracks today, then shows that place's export steps or Connect, with B's Check, Import, and Done after.
import {
	CheckIcon,
	ChevronDownIcon,
	ChevronRightIcon,
} from "@heroicons/react/20/solid"
import {
	ArrowLeftIcon,
	ArrowTopRightOnSquareIcon,
	ArrowUpTrayIcon,
	ArrowUturnLeftIcon,
	CalendarDaysIcon,
	ClockIcon,
	ExclamationTriangleIcon,
	LockClosedIcon,
	SparklesIcon,
	TvIcon,
} from "@heroicons/react/24/outline"
import { IMPORT_SOURCE_UPLOAD } from "~/domain/imports"
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

export function VariantB4({ sim }: { sim: Sim }) {
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
	/** Bring: the place the member picked. Kept here so Back from Check returns to its screen. */
	const [picked, setPicked] = useState<Pick | null>(null)
	const startOver = () => {
		setPicked(null)
		sim.reset()
	}

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
				{step === 1 && (
					<Bring
						sim={sim}
						heading={heading}
						picked={picked}
						setPicked={setPicked}
					/>
				)}
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
				{step === 4 && (
					<Done
						sim={sim}
						local={local}
						heading={heading}
						onStartOver={startOver}
					/>
				)}
			</div>
		</div>
	)
}

type HeadingRef = React.RefObject<HTMLHeadingElement>

/* ------------------------------------------------------------------------------------------------------------------ */
/* Bring: where are your movies now? → how to get them here                                                           */

/** A source tile, or the streaming services tile. */
type Pick = ImportSourceId | "streaming"

const FIRST: ImportSourceId[] = [
	"imdb",
	"letterboxd",
	"trakt",
	"tmdb",
	"plex",
	"tvtime",
]
const MORE: ImportSourceId[] = [
	"myanimelist",
	"kodi",
	"movielens",
	"wishlist",
	"csv",
]
/** Exports that take a while: the member can leave and come back. */
const SLOW: ImportSourceId[] = ["imdb", "trakt"]

const TILE_NAME: Partial<Record<ImportSourceId, string>> = {
	myanimelist: "MyAnimeList or Kitsu",
	wishlist: "Watcharr or wishlist file",
	csv: "Spreadsheet (CSV)",
}

const sourceOf = (id: ImportSourceId) =>
	IMPORT_SOURCE_LIST.find((x) => x.id === id) ?? IMPORT_SOURCE_LIST[0]
const tileName = (id: ImportSourceId) => TILE_NAME[id] ?? importSourceName(id)

const REMEMBER_KEY = "proto-b4-import-source"
const remember = (id: ImportSourceId | null) => {
	try {
		if (id) window.localStorage.setItem(REMEMBER_KEY, id)
		else window.localStorage.removeItem(REMEMBER_KEY)
	} catch {}
}
const remembered = (): ImportSourceId | null => {
	try {
		const v = window.localStorage.getItem(REMEMBER_KEY) as ImportSourceId | null
		return v && SLOW.includes(v) ? v : null
	} catch {
		return null
	}
}

interface Step {
	text: ReactNode
	link?: { href: string; label: string }
}
interface HowTo {
	/** The file the member ends up with, as they'll see it. */
	file: string
	steps: Step[]
	/** A line before the steps, when it matters. */
	before?: string
}

const upload = (id: ImportSourceId) =>
	id === "imdb" || id === "tmdb" || id === "plex"
		? null
		: IMPORT_SOURCE_UPLOAD[id]

const exportLink = (id: ImportSourceId, label: string) => {
	const href = upload(id)?.exportUrl
	return href ? { href, label } : undefined
}

const HOW_TO: Partial<Record<ImportSourceId, HowTo>> = {
	imdb: {
		file: "a CSV file, like ratings.csv",
		steps: [
			{
				text: "Open your ratings on IMDb and choose Export.",
				link: {
					href: "https://www.imdb.com/list/ratings",
					label: "Open your IMDb ratings",
				},
			},
			{
				text: "IMDb takes a few minutes to make the file. When it shows as ready, download it.",
				link: {
					href: "https://www.imdb.com/exports",
					label: "Open your IMDb exports",
				},
			},
		],
	},
	letterboxd: {
		file: "a ZIP, like letterboxd-yourname.zip",
		steps: [
			{
				text: "On Letterboxd, open Settings, then Data, and choose Export Data. The ZIP downloads right away.",
				link: exportLink("letterboxd", "Open Letterboxd export"),
			},
		],
	},
	trakt: {
		file: "a ZIP, like trakt-export.zip",
		steps: [
			{
				text: "On Trakt, open Settings, then Data, and choose Export now. It works on free accounts too.",
				link: exportLink("trakt", "Open Trakt export"),
			},
			{ text: "Trakt takes about a minute, then the ZIP downloads." },
		],
	},
	tvtime: {
		file: "gdpr-data.zip",
		before:
			"TV Time closed on July 15, 2026. Use the export you saved before then.",
		steps: [
			{ text: "Find gdpr-data.zip on your device." },
			{
				text: "If it asks for a password, open it with the password TV Time emailed you, then use the files inside.",
			},
		],
	},
	myanimelist: {
		file: "an XML file, like animelist.xml.gz",
		steps: [
			{
				text: "On MyAnimeList, pick Anime List on the export page and choose Export My List. On Kitsu, open Settings, then Export.",
				link: exportLink("myanimelist", "Open MyAnimeList export"),
			},
		],
	},
	kodi: {
		file: "videodb.xml",
		steps: [
			{
				text: "In Kodi, set the settings level to Advanced. Then open Settings, Media, Library, Export library, and choose Single file.",
			},
			{
				text: "Find videodb.xml in the new kodi_videodb folder. You don't need the artwork.",
			},
		],
	},
	movielens: {
		file: "ratings.csv",
		steps: [
			{
				text: "On MovieLens, open Settings, then Import or export, and download your ratings.",
				link: exportLink("movielens", "Open MovieLens export"),
			},
		],
	},
	wishlist: {
		file: "watcharr-export.json",
		steps: [
			{
				text: "In Watcharr, open Settings and choose Export. A wishlist file made for GoodWatch works too.",
			},
		],
	},
	csv: {
		file: "a .csv spreadsheet",
		steps: [
			{
				text: "Put one title per line with Title and Year, or a TMDB or IMDb ID. Add Rating or WatchedDate if you have them.",
			},
			{ text: "Save it as CSV." },
		],
	},
}

function Bring({
	sim,
	heading,
	picked,
	setPicked,
}: {
	sim: Sim
	heading: HeadingRef
	picked: Pick | null
	setPicked: (p: Pick | null) => void
}) {
	const s = sim.scenario
	const { phase } = sim
	const [dir, setDir] = useState<1 | -1>(1)
	const [dragging, setDragging] = useState(false)
	const busy =
		phase.at === "reading" ||
		phase.at === "checking" ||
		phase.at === "connecting"
	const problem = phase.at === "problem" ? phase.problem : null

	const pick = (p: Pick | null) => {
		setDir(p ? 1 : -1)
		setPicked(p)
		if (p && p !== "streaming" && SLOW.includes(p)) remember(p)
		if (!p) remember(null)
		if (phase.at === "problem") sim.reset()
	}

	// A file dropped from the first screen that can't be used opens the screen it belongs to.
	useEffect(() => {
		if (!problem || picked) return
		if (problem === "streaming") setPicked("streaming")
		else if (problem !== "unknown") setPicked(s.source)
	}, [problem, picked, s.source, setPicked])

	// Focus moves to the new screen's heading when the member picks or goes back.
	const firstPick = useRef(true)
	useEffect(() => {
		if (firstPick.current) {
			firstPick.current = false
			return
		}
		heading.current?.focus()
	}, [picked, heading])

	// Drop anywhere: the whole page takes a file while nothing is running.
	const takes = !busy && picked !== "streaming"
	const takeFile = useRef(sim.takeFile)
	takeFile.current = sim.takeFile
	useEffect(() => {
		if (!takes) return
		let depth = 0
		const enter = (e: DragEvent) => {
			if (!e.dataTransfer?.types.includes("Files")) return
			depth++
			setDragging(true)
		}
		const leave = () => {
			depth = Math.max(0, depth - 1)
			if (depth === 0) setDragging(false)
		}
		const over = (e: DragEvent) => e.preventDefault()
		const drop = (e: DragEvent) => {
			e.preventDefault()
			depth = 0
			setDragging(false)
			takeFile.current()
		}
		window.addEventListener("dragenter", enter)
		window.addEventListener("dragleave", leave)
		window.addEventListener("dragover", over)
		window.addEventListener("drop", drop)
		return () => {
			window.removeEventListener("dragenter", enter)
			window.removeEventListener("dragleave", leave)
			window.removeEventListener("dragover", over)
			window.removeEventListener("drop", drop)
		}
	}, [takes])

	if (busy) {
		const id = picked && picked !== "streaming" ? picked : s.source
		return (
			<section className="flex flex-col items-center gap-5 rounded-3xl bg-gray-900/70 px-5 py-10 text-center ring-1 ring-white/10">
				<SourceMark source={sourceOf(id)} />
				<h2 ref={heading} tabIndex={-1} className={headingClass}>
					{phase.at === "connecting"
						? `Waiting for ${importSourceName(id)}`
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
							Say yes to GoodWatch in the {importSourceName(id)} tab. You come
							right back here.
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
	}

	return (
		<>
			<DropOverlay on={dragging} />
			<Slide key={picked ?? "where"} dir={dir}>
				{picked === null ? (
					<Where sim={sim} heading={heading} problem={problem} onPick={pick} />
				) : picked === "streaming" ? (
					<Streaming
						heading={heading}
						problem={problem}
						onPick={pick}
						onBack={() => pick(null)}
					/>
				) : sourceOf(picked).connect ? (
					<Connect
						id={picked}
						sim={sim}
						heading={heading}
						onBack={() => pick(null)}
					/>
				) : (
					<GetFile
						id={picked}
						sim={sim}
						heading={heading}
						problem={problem}
						onBack={() => pick(null)}
					/>
				)}
			</Slide>
		</>
	)
}

function DropOverlay({ on }: { on: boolean }) {
	return (
		<div
			aria-hidden
			className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-gray-950/85 p-6 transition-opacity duration-200"
			style={{ opacity: on ? 1 : 0 }}
		>
			<div
				className="flex w-full max-w-lg flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-amber-300 px-6 py-14 text-center transition-transform duration-200"
				style={{ transform: on ? "none" : "scale(0.96)" }}
			>
				<ArrowUpTrayIcon className="size-12 text-amber-300" />
				<p className="text-2xl font-bold text-white">Drop to bring it in</p>
				<p className="text-sm text-gray-300">
					Nothing changes until you say so.
				</p>
			</div>
		</div>
	)
}

/** Fades in on mount; opacity only. */
function FadeIn({ children }: { children: ReactNode }) {
	const [on, setOn] = useState(false)
	useEffect(() => {
		const a = requestAnimationFrame(() => setOn(true))
		return () => cancelAnimationFrame(a)
	}, [])
	return (
		<div
			className="transition-opacity duration-300"
			style={{ opacity: on ? 1 : 0 }}
		>
			{children}
		</div>
	)
}

function FileButton({
	sim,
	className,
	label = "Choose file",
	describedBy,
}: {
	sim: Sim
	className: string
	label?: string
	describedBy?: string
}) {
	const input = useRef<HTMLInputElement>(null)
	return (
		<>
			<button
				type="button"
				className={className}
				aria-describedby={describedBy}
				onClick={() => input.current?.click()}
			>
				{label}
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
		</>
	)
}

const tileClass =
	"relative flex min-h-24 w-full cursor-pointer flex-col items-start justify-between gap-3 rounded-2xl border-2 border-slate-700 bg-slate-900/60 p-4 text-left transition-transform duration-150 hover:border-slate-500 active:scale-[0.98]"

function SourceTile({
	id,
	thisCase,
	onPick,
}: {
	id: ImportSourceId
	thisCase: boolean
	onPick: (p: Pick) => void
}) {
	const x = sourceOf(id)
	return (
		<button type="button" className={tileClass} onClick={() => onPick(id)}>
			<SourceMark source={x} />
			<span className="flex flex-col">
				<span className="font-bold leading-tight text-white">
					{tileName(id)}
				</span>
				<span className="text-xs text-gray-400">
					{x.connect ? "Connect your account" : `File · ${x.wait}`}
				</span>
			</span>
			{thisCase && (
				<span
					title="This case"
					className="absolute top-3 right-3 size-2 rounded-full bg-amber-300"
				/>
			)}
		</button>
	)
}

/* Screen 1 -------------------------------------------------------------------------------------------------------- */

function Where({
	sim,
	heading,
	problem,
	onPick,
}: {
	sim: Sim
	heading: HeadingRef
	problem: FileProblem | null
	onPick: (p: Pick) => void
}) {
	const s = sim.scenario
	const [more, setMore] = useState(MORE.includes(s.source) && !!problem)
	const [back, setBack] = useState<ImportSourceId | null>(null)
	useEffect(() => setBack(remembered()), [])

	return (
		<div className="flex flex-col gap-6">
			{problem === "unknown" && (
				<ProblemCard
					problem={problem}
					scenario={s}
					source={null}
					heading={heading}
				/>
			)}
			{back && (
				<button
					type="button"
					onClick={() => onPick(back)}
					className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-amber-400/10 p-3 text-left ring-1 ring-amber-400/40 hover:bg-amber-400/15"
				>
					<SourceMark source={sourceOf(back)} />
					<span className="min-w-0 flex-1">
						<span className="block font-semibold text-white">
							Back for your {importSourceName(back)} file?
						</span>
						<span className="block text-sm text-gray-300">
							Pick up where you left off.
						</span>
					</span>
					<ChevronRightIcon className="size-5 text-amber-200" aria-hidden />
				</button>
			)}
			<div className="flex flex-col gap-2">
				<h2
					ref={problem === "unknown" ? undefined : heading}
					tabIndex={-1}
					className={headingClass}
				>
					Where are your movies and shows now?
				</h2>
				<p className="text-gray-400">
					Pick one. GoodWatch shows you how to bring them over.
				</p>
			</div>

			<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{FIRST.map((id) => (
					<li key={id}>
						<SourceTile id={id} thisCase={s.source === id} onPick={onPick} />
					</li>
				))}
				<li className="col-span-2 sm:col-span-3">
					<button
						type="button"
						className={`${tileClass} min-h-0 flex-row items-center`}
						onClick={() => onPick("streaming")}
					>
						<span
							aria-hidden
							className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-700"
						>
							<TvIcon className="size-6 text-gray-200" />
						</span>
						<span className="flex min-w-0 flex-1 flex-col">
							<span className="font-bold leading-tight text-white">
								Netflix, Prime Video, or another streaming service
							</span>
							<span className="text-xs text-gray-400">
								What's possible, and what works instead
							</span>
						</span>
						{s.fileProblem === "streaming" && (
							<span
								title="This case"
								className="size-2 shrink-0 rounded-full bg-amber-300"
							/>
						)}
					</button>
				</li>
			</ul>

			{more ? (
				<FadeIn>
					<div className="flex flex-col gap-3">
						<h3 className="text-sm font-semibold text-gray-400">More places</h3>
						<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
							{MORE.map((id) => (
								<li key={id}>
									<SourceTile
										id={id}
										thisCase={s.source === id && !s.fileProblem}
										onPick={onPick}
									/>
								</li>
							))}
						</ul>
					</div>
				</FadeIn>
			) : (
				<button
					type="button"
					aria-expanded={false}
					onClick={() => setMore(true)}
					className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-slate-700 px-4 py-3 text-left hover:border-slate-500"
				>
					<span className="flex pl-2" aria-hidden>
						{MORE.slice(0, 4).map((id) => (
							<span key={id} className="-ml-2 scale-75">
								<SourceMark source={sourceOf(id)} />
							</span>
						))}
					</span>
					<span className="min-w-0 flex-1">
						<span className="block font-semibold text-white">More</span>
						<span className="block text-xs text-gray-400">
							MyAnimeList, Kitsu, Kodi, MovieLens, Watcharr, spreadsheets
						</span>
					</span>
					<ChevronDownIcon className="size-5 text-gray-400" aria-hidden />
				</button>
			)}

			<div className="flex flex-col items-start gap-3 rounded-2xl border-2 border-dashed border-white/15 p-4 sm:flex-row sm:items-center">
				<ArrowUpTrayIcon
					className="hidden size-8 shrink-0 text-gray-400 sm:block"
					aria-hidden
				/>
				<p id="b4-drop-anywhere" className="flex-1 text-sm text-gray-300">
					<span className="font-semibold text-white">
						Already have the file?
					</span>{" "}
					Drop it anywhere on this page. GoodWatch works out where it's from.
				</p>
				<FileButton
					sim={sim}
					className={secondaryButton}
					describedBy="b4-drop-anywhere"
				/>
			</div>

			<History sim={sim} />
		</div>
	)
}

/* Screen 2: a file source ----------------------------------------------------------------------------------------- */

function BackLink({ onClick, label }: { onClick: () => void; label: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="-ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1 self-start rounded-lg pr-2 text-sm font-semibold text-gray-300 hover:text-white"
		>
			<ArrowLeftIcon className="size-5" aria-hidden />
			{label}
		</button>
	)
}

function SourceHeader({
	id,
	heading,
	title,
	focusHere,
}: {
	id: ImportSourceId
	heading: HeadingRef
	title: string
	focusHere: boolean
}) {
	const x = sourceOf(id)
	return (
		<div className="flex items-center gap-4">
			<span className="origin-left scale-125">
				<SourceMark source={x} />
			</span>
			<div className="min-w-0">
				<h2
					ref={focusHere ? heading : undefined}
					tabIndex={-1}
					className={headingClass}
				>
					{title}
				</h2>
				<p className="text-sm text-gray-400">
					Brings {x.gets.map((g, i) => (i ? g.toLowerCase() : g)).join(", ")}
				</p>
			</div>
		</div>
	)
}

function StepItem({ n, children }: { n: number; children: ReactNode }) {
	return (
		<li className="flex gap-4">
			<span
				aria-hidden
				className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-black text-amber-300 ring-1 ring-slate-600"
			>
				{n}
			</span>
			<div className="flex min-w-0 flex-1 flex-col items-start gap-3 pt-1">
				{children}
			</div>
		</li>
	)
}

function GetFile({
	id,
	sim,
	heading,
	problem,
	onBack,
}: {
	id: ImportSourceId
	sim: Sim
	heading: HeadingRef
	problem: FileProblem | null
	onBack: () => void
}) {
	const how = HOW_TO[id]
	const src = tileName(id)
	const slow = SLOW.includes(id)
	if (!how) return null
	const last = how.steps.length + 1
	return (
		<section className="flex flex-col gap-6">
			<BackLink onClick={onBack} label="All places" />
			<SourceHeader
				id={id}
				heading={heading}
				title={`Bring your ${src} file`}
				focusHere={!problem}
			/>
			{how.before && <p className="text-gray-300">{how.before}</p>}
			{slow && (
				<div className="flex items-start gap-3 rounded-2xl bg-gray-900/70 p-4 ring-1 ring-white/10">
					<ClockIcon
						className="mt-0.5 size-6 shrink-0 text-amber-300"
						aria-hidden
					/>
					<p className="text-sm text-gray-300">
						{importSourceName(id)} takes {sourceOf(id).wait.toLowerCase()} to
						make your file. You can leave while it does. This page remembers{" "}
						{importSourceName(id)}, so come back here when the file is ready.
					</p>
				</div>
			)}
			<ol className="flex flex-col gap-6">
				{how.steps.map((step, i) => (
					<StepItem key={i} n={i + 1}>
						<p className="text-gray-200">{step.text}</p>
						{step.link && (
							<a
								href={step.link.href}
								target="_blank"
								rel="noopener noreferrer"
								className={secondaryButton}
							>
								{step.link.label}
								<ArrowTopRightOnSquareIcon className="size-5" aria-hidden />
								<span className="sr-only">(opens in a new tab)</span>
							</a>
						)}
					</StepItem>
				))}
				<StepItem n={last}>
					<p className="text-gray-200">
						Bring {how.file} here, just as it downloaded.
					</p>
					{problem && (
						<ProblemCard
							problem={problem}
							scenario={sim.scenario}
							source={id}
							heading={heading}
						/>
					)}
					<DropTarget sim={sim} id={id} problem={!!problem} />
				</StepItem>
			</ol>
		</section>
	)
}

function DropTarget({
	sim,
	id,
	problem,
}: {
	sim: Sim
	id: ImportSourceId
	problem: boolean
}) {
	return (
		<div className="flex w-full flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-white/20 bg-gray-950/50 px-4 py-8 text-center sm:py-10">
			<ArrowUpTrayIcon className="size-10 text-gray-400" aria-hidden />
			<p id={`b4-drop-${id}`} className="font-semibold text-white">
				{problem
					? "Drop the right file here"
					: `Drop your ${importSourceName(id)} file here`}
			</p>
			<FileButton
				sim={sim}
				className={primaryButton}
				describedBy={`b4-drop-${id}`}
			/>
			<p className="text-xs text-gray-500">
				Nothing changes until you say so. This case:{" "}
				<span className="break-all">{sim.scenario.fileName}</span>
			</p>
		</div>
	)
}

/* Screen 2: an account source ------------------------------------------------------------------------------------- */

const CONNECT_READS: Partial<Record<ImportSourceId, string>> = {
	tmdb: "Your TMDB ratings, watchlist, and favorites.",
	plex: "Each play on your own Plex server, and your Plex watchlist.",
}

function Connect({
	id,
	sim,
	heading,
	onBack,
}: {
	id: ImportSourceId
	sim: Sim
	heading: HeadingRef
	onBack: () => void
}) {
	const x = sourceOf(id)
	return (
		<section className="flex flex-col gap-6">
			<BackLink onClick={onBack} label="All places" />
			<SourceHeader
				id={id}
				heading={heading}
				title={`Connect ${x.name}`}
				focusHere
			/>
			<div className="rounded-2xl bg-gray-900/70 p-5 ring-1 ring-white/10">
				<h3 className="font-semibold text-white">What GoodWatch reads</h3>
				<p className="mt-1 text-gray-300">{CONNECT_READS[id]}</p>
				<ul className="mt-3 flex flex-wrap gap-2">
					{x.gets.map((g) => (
						<li
							key={g}
							className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1 text-sm text-gray-200"
						>
							<CheckIcon className="size-4 text-amber-300" aria-hidden />
							{g}
						</li>
					))}
				</ul>
				<p className="mt-4 text-sm text-gray-400">
					GoodWatch only reads. It never changes anything on {x.name}.
				</p>
			</div>
			<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
				<button
					type="button"
					className={`${primaryButton} sm:min-w-56`}
					onClick={sim.connect}
				>
					Connect {x.name}
				</button>
				<p className="text-sm text-gray-400">
					Say yes on {x.name}, then check everything here before it comes in.
				</p>
			</div>
		</section>
	)
}

/* Screen 2: streaming services ------------------------------------------------------------------------------------ */

function Streaming({
	heading,
	problem,
	onPick,
	onBack,
}: {
	heading: HeadingRef
	problem: FileProblem | null
	onPick: (p: Pick) => void
	onBack: () => void
}) {
	return (
		<section className="flex flex-col gap-6">
			<BackLink onClick={onBack} label="All places" />
			{problem === "streaming" && (
				<p
					aria-live="assertive"
					className="rounded-2xl border-l-8 border-red-700 bg-red-950/70 p-4 text-red-50"
				>
					That's a Netflix viewing history. It can't come in yet, and here's
					why.
				</p>
			)}
			<div className="flex flex-col gap-2">
				<h2 ref={heading} tabIndex={-1} className={headingClass}>
					Streaming services keep your history to themselves
				</h2>
				<p className="text-gray-300">
					Netflix, Prime Video, Disney+, and the rest don't let other apps read
					what you watched. Netflix does let you download a viewing history, but
					it only lists what played, without scores, and its names don't always
					point to one title. So GoodWatch can't read it yet.
				</p>
			</div>

			<div className="flex flex-col gap-3">
				<h3 className="text-lg font-bold text-white">
					Track them somewhere else too?
				</h3>
				<p className="text-sm text-gray-400">
					Bring them from there. It's the quickest way.
				</p>
				<ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
					{(["imdb", "letterboxd", "trakt", "tmdb"] as ImportSourceId[]).map(
						(id) => (
							<li key={id}>
								<SourceTile id={id} thisCase={false} onPick={onPick} />
							</li>
						),
					)}
				</ul>
			</div>

			<div className="flex flex-col items-start gap-3 rounded-2xl bg-gray-900/70 p-5 ring-1 ring-white/10">
				<SparklesIcon className="size-7 text-amber-300" aria-hidden />
				<h3 className="text-lg font-bold text-white">Starting fresh?</h3>
				<p className="text-gray-300">
					Score a few titles you remember. It takes a couple of minutes, and
					GoodWatch learns your taste from there.
				</p>
				<a href="/taste" className={primaryButton}>
					Score a few titles
				</a>
			</div>
		</section>
	)
}

/* Past imports ---------------------------------------------------------------------------------------------------- */

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
	const lastAt = HISTORY[0]?.at
	return (
		<div className="border-t border-white/10 pt-4">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className="flex w-full cursor-pointer items-center justify-between gap-3 py-1 text-left text-sm text-gray-400 hover:text-white"
			>
				<span>
					<span className="font-semibold text-gray-200">Past imports</span> ·{" "}
					{HISTORY.length}
					{lastAt && `, last on ${day(lastAt)}`}
				</span>
				<ChevronDownIcon
					className={`size-5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
					aria-hidden
				/>
			</button>
			{open && (
				<FadeIn>
					<ul className="mt-3 flex flex-col gap-2">
						{HISTORY.map((h) => {
							const src = sourceOf(h.source)
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
										<span className="block text-sm text-gray-400">
											{h.line}
										</span>
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
				</FadeIn>
			)}
		</div>
	)
}

/* File problems, in the context of the chosen place --------------------------------------------------------------- */

function problemText(
	problem: FileProblem,
	s: Scenario,
	source: ImportSourceId | null,
): { title: string; why: string; next: string } {
	const src = source ? importSourceName(source) : null
	const expected = source ? HOW_TO[source]?.file : undefined
	switch (problem) {
		case "streaming":
			return {
				title: src
					? `This is a Netflix file, not a ${src} export`
					: "This is a Netflix file",
				why: "Netflix's viewing history only lists what played, without scores, so GoodWatch can't read it yet.",
				next: src
					? `Follow step 1 to get your ${src} file, then drop it here.`
					: "Pick where else you track your movies.",
			}
		case "unknown":
			return src
				? {
						title: `This isn't a ${src} export`,
						why: `${s.fileName} isn't something ${src} makes.${expected ? ` Your ${src} file is ${expected}.` : ""}`,
						next: "Follow step 1 to get it, then drop it here.",
					}
				: {
						title: "GoodWatch doesn't know this file",
						why: `${s.fileName} isn't an export from a site or app GoodWatch reads.`,
						next: "Pick where it's from below, and GoodWatch shows you how to get the right file.",
					}
		case "password":
			return {
				title: "This ZIP is locked",
				why: "TV Time locks its export with a password and emails the password separately.",
				next: "Open the ZIP on your computer with that password, then drop the files inside here.",
			}
		case "too_big":
			return {
				title: "This file is too big",
				why: "It's 34 MB. GoodWatch takes files up to 20 MB.",
				next: "Unzip it and drop only the files you need, like your watched and ratings files.",
			}
		case "empty":
			return {
				title: "This file is empty",
				why: "It has column names but no scores.",
				next: `Score a few titles on ${src ?? "the site"}, export again, then drop the new file here.`,
			}
	}
}

function ProblemCard({
	problem,
	scenario,
	source,
	heading,
}: {
	problem: FileProblem
	scenario: Scenario
	source: ImportSourceId | null
	heading: HeadingRef
}) {
	const p = problemText(problem, scenario, source)
	return (
		<section
			aria-live="assertive"
			className="w-full rounded-2xl border-l-8 border-red-700 bg-red-950/70 p-5 text-red-50"
		>
			<div className="flex items-start gap-3">
				{problem === "password" ? (
					<LockClosedIcon
						className="mt-1 size-6 shrink-0 text-red-300"
						aria-hidden
					/>
				) : (
					<ExclamationTriangleIcon
						className="mt-1 size-6 shrink-0 text-red-300"
						aria-hidden
					/>
				)}
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
					<p className="mt-2 font-semibold">{p.next}</p>
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
	onStartOver,
}: {
	sim: Sim
	local: Local
	heading: HeadingRef
	onStartOver: () => void
}) {
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
					<button
						type="button"
						className={secondaryButton}
						onClick={onStartOver}
					>
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
					<button
						type="button"
						className={secondaryButton}
						onClick={onStartOver}
					>
						{past ? "Back to imports" : "Import something else"}
					</button>
				</div>
			</div>
		</section>
	)
}
