// PROTOTYPE - throwaway. Variant A, "One card": the whole import lives in one card that changes in place; every decision has a default and only shows as a compact row when something needs a look.
import {
	ArrowUpTrayIcon,
	CheckCircleIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useRef, useState } from "react"
import {
	IMPORT_SOURCE_LIST,
	type ImportSourceEntry,
	type ImportSourceId,
	importSourceName,
} from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import {
	dangerButton,
	primaryButton,
	secondaryButton,
	stepHeading,
	textLink,
} from "~/ui/imports/shared"
import { assetUrl } from "~/utils/asset-url"
import {
	type Choices,
	HISTORY,
	type Kinds,
	type Question,
	type Scenario,
	type Sim,
	type Title,
	fmt,
	plural,
	questionsFor,
} from "./model"

/* ------------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                       */

const entryOf = (id: ImportSourceId) =>
	IMPORT_SOURCE_LIST.find((s) => s.id === id) as ImportSourceEntry

const day = (iso: string) =>
	new Date(iso).toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		timeZone: "UTC",
	})

const KIND_ORDER: (keyof Kinds)[] = [
	"ratings",
	"watches",
	"episodes",
	"want",
	"favorites",
	"reviews",
	"lists",
	"statuses",
]

/** How the summary sentence names a kind: "612 scores", "842 watched". */
const kindPhrase = (k: keyof Kinds, n: number) =>
	({
		ratings: plural(n, "score"),
		watches: `${fmt(n)} watched`,
		episodes: plural(n, "episode"),
		want: `${fmt(n)} Want to See`,
		favorites: plural(n, "favorite"),
		reviews: plural(n, "review"),
		lists: plural(n, "list"),
		statuses: plural(n, "show status", "show statuses"),
	})[k]

/** How the done state names a kind: "612 scores added". */
const kindDone = (k: keyof Kinds, n: number) =>
	({
		ratings: `${plural(n, "score")} added`,
		watches: `${fmt(n)} marked Seen`,
		episodes: `${plural(n, "episode")} marked Seen`,
		want: `${fmt(n)} added to Want to See`,
		favorites: `${plural(n, "favorite")} added`,
		reviews: `${plural(n, "review")} added`,
		lists: `${plural(n, "list")} added`,
		statuses: `${plural(n, "show status", "show statuses")} set`,
	})[k]

const kindName: Record<keyof Kinds, string> = {
	ratings: "Scores",
	watches: "Watched movies and shows",
	episodes: "Watched episodes",
	want: "Want to See",
	favorites: "Favorites",
	reviews: "Reviews",
	lists: "Lists",
	statuses: "Show statuses",
}

const included = (s: Scenario, c: Choices) =>
	KIND_ORDER.filter((k) => s.kinds[k] > 0 && c.include[k])

const titleCount = (s: Scenario, c: Choices) => {
	const n = (k: keyof Kinds) => (c.include[k] ? s.kinds[k] : 0)
	return Math.max(n("watches"), n("ratings"), n("want"), n("statuses"))
}

const nothingNew = (s: Scenario) => Object.values(s.kinds).every((n) => n === 0)

const listNames = (titles: Title[]) =>
	titles.length <= 2
		? titles.map((t) => t.name).join(" and ")
		: `${titles
				.slice(0, -1)
				.map((t) => t.name)
				.join(", ")}, and ${titles[titles.length - 1].name}`

/** Fades and lifts its content in when it mounts. Opacity and transform only. */
function Appear({
	children,
	className = "",
	id,
}: { children: ReactNode; className?: string; id?: string }) {
	const [shown, setShown] = useState(false)
	useEffect(() => {
		const raf = requestAnimationFrame(() => setShown(true))
		return () => cancelAnimationFrame(raf)
	}, [])
	return (
		<div
			id={id}
			className={`transition-[opacity,transform] duration-300 ease-out ${shown ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"} ${className}`}
		>
			{children}
		</div>
	)
}

function Bar({
	value,
	label,
	tone = "bg-indigo-500",
}: { value: number | null; label: string; tone?: string }) {
	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={value === null ? undefined : Math.round(value * 100)}
			className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
		>
			<div
				className={`h-full w-full origin-left rounded-full ${tone} transition-transform duration-150 ease-linear ${value === null ? "animate-pulse" : ""}`}
				style={{ transform: `scaleX(${value === null ? 0.35 : value})` }}
			/>
		</div>
	)
}

function Logo({
	source,
	size = "size-7",
}: { source: ImportSourceEntry; size?: string }) {
	return (
		<span
			aria-hidden
			className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-md ${source.id === "tmdb" ? "bg-[#0d253f] p-0.5" : ""}`}
		>
			{source.logo ? (
				<img
					src={assetUrl(source.logo)}
					alt=""
					className="size-full object-contain"
				/>
			) : (
				<span className="text-[10px] font-black text-white">{source.tile}</span>
			)}
		</span>
	)
}

function Posters({
	titles,
	named = false,
	size = "w-12",
}: { titles: Title[]; named?: boolean; size?: string }) {
	return (
		<ul className="flex flex-wrap gap-2">
			{titles.map((t) => (
				<li key={t.id} className={size}>
					<img
						src={t.poster}
						alt={named ? "" : `${t.name} (${t.year})`}
						loading="lazy"
						className="aspect-[2/3] w-full rounded-md bg-slate-800 object-cover"
					/>
					{named && (
						<span className="mt-1 line-clamp-2 block text-xs leading-tight text-gray-400">
							{t.name}
						</span>
					)}
				</li>
			))}
		</ul>
	)
}

/** A small set of choices that look like buttons but are real radios. */
function Pick<T extends string>({
	legend,
	value,
	options,
	onChange,
	small = false,
}: {
	legend: string
	value: T
	options: { value: T; label: string; hint?: string }[]
	onChange: (v: T) => void
	small?: boolean
}) {
	return (
		<fieldset>
			<legend className="sr-only">{legend}</legend>
			<div
				className={`flex ${small ? "gap-1.5" : "flex-col gap-2 sm:flex-row"}`}
			>
				{options.map((o) => {
					const on = o.value === value
					return (
						<label
							key={o.value}
							className={`flex flex-1 cursor-pointer flex-col rounded-lg border focus-within:ring-2 focus-within:ring-indigo-400 ${small ? "px-2.5 py-1.5 text-sm" : "px-3 py-2.5"} ${on ? "border-indigo-400 bg-indigo-500/15 text-white" : "border-slate-700 text-gray-300 hover:border-slate-500"}`}
						>
							<input
								type="radio"
								className="sr-only"
								checked={on}
								onChange={() => onChange(o.value)}
							/>
							<span className="font-semibold">{o.label}</span>
							{o.hint && (
								<span className="text-sm text-gray-400">{o.hint}</span>
							)}
						</label>
					)
				})}
			</div>
		</fieldset>
	)
}

/** One line that wants a look, opening in place to show the detail and how to change it. */
function Row({
	id,
	open,
	onToggle,
	title,
	value,
	action = "Change",
	extra,
	children,
}: {
	id: string
	open: boolean
	onToggle: () => void
	title: string
	value: string
	action?: string
	extra?: ReactNode
	children: ReactNode
}) {
	return (
		<li className="py-1">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={id}
				onClick={onToggle}
				className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-md py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
			>
				<span className="min-w-0 flex-1">
					<span className="block font-semibold text-gray-100">{title}</span>
					<span className="block text-sm text-gray-400">{value}</span>
				</span>
				<span className="shrink-0 text-sm font-semibold text-indigo-300">
					{open ? "Done" : action}
				</span>
				<ChevronDownIcon
					aria-hidden
					className={`size-5 shrink-0 text-gray-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{extra}
			{open && (
				<Appear id={id} className="pt-2 pb-4">
					{children}
				</Appear>
			)}
		</li>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* The card                                                                                                           */

export function VariantA({ sim }: { sim: Sim }) {
	const { scenario: s, phase } = sim
	const card = useRef<HTMLDivElement>(null)
	const first = useRef(true)
	// Focus moves to the new state's heading whenever the card changes state.
	// biome-ignore lint/correctness/useExhaustiveDependencies: phase.at is the trigger
	useEffect(() => {
		if (first.current) {
			first.current = false
			return
		}
		card.current
			?.querySelector<HTMLElement>("h2")
			?.focus({ preventScroll: true })
	}, [phase.at])

	return (
		<div className="mx-auto w-full max-w-2xl">
			<div
				ref={card}
				className="min-h-[22rem] rounded-2xl bg-gray-900/85 p-5 text-base text-gray-300 ring-1 ring-white/10 md:p-7"
			>
				<Appear key={phase.at}>
					{phase.at === "start" && <Start sim={sim} />}
					{phase.at === "reading" && <Reading s={s} />}
					{phase.at === "connecting" && <Connecting sim={sim} />}
					{phase.at === "checking" && (
						<Checking s={s} progress={phase.progress} />
					)}
					{phase.at === "problem" && (
						<Problem sim={sim} problem={phase.problem} />
					)}
					{phase.at === "preview" && <Preview sim={sim} />}
					{phase.at === "running" && (
						<Running sim={sim} progress={phase.progress} />
					)}
					{phase.at === "failed" && (
						<Failed sim={sim} progress={phase.progress} />
					)}
					{phase.at === "done" && <Done sim={sim} />}
					{phase.at === "undoing" && (
						<Undoing sim={sim} progress={phase.progress} />
					)}
					{phase.at === "undone" && <Undone sim={sim} />}
				</Appear>
			</div>
			<History sim={sim} />
		</div>
	)
}

/* Start ------------------------------------------------------------------------------------------------------------ */

function Start({ sim }: { sim: Sim }) {
	const input = useRef<HTMLInputElement>(null)
	const [over, setOver] = useState(false)
	const fileSources = IMPORT_SOURCE_LIST.filter((x) => !x.connect)
	const accounts = IMPORT_SOURCE_LIST.filter((x) => x.connect)
	return (
		<div>
			<h2 tabIndex={-1} className="sr-only">
				Import from another site
			</h2>
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
				className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${over ? "border-amber-300 bg-amber-400/10" : "border-white/15"}`}
			>
				<ArrowUpTrayIcon
					aria-hidden
					className={`size-10 transition-transform duration-300 ${over ? "-translate-y-1 text-amber-300" : "text-gray-500"}`}
				/>
				<p className="text-xl font-bold text-white">Drop your export here</p>
				<button
					type="button"
					className={primaryButton}
					onClick={() => input.current?.click()}
				>
					Choose a file
				</button>
				<input
					ref={input}
					type="file"
					className="sr-only"
					tabIndex={-1}
					aria-hidden
					onChange={() => sim.takeFile()}
				/>
				<div className="mt-3 flex flex-col items-center gap-2">
					<span className="text-sm text-gray-400">Works with files from</span>
					<ul className="flex flex-wrap justify-center gap-1.5">
						{fileSources.map((x) => (
							<li key={x.id} title={x.name}>
								<Logo source={x} />
								<span className="sr-only">{x.name}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
			<div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-gray-400">
				<span>No file? Connect your account:</span>
				{accounts.map((x) => (
					<button
						key={x.id}
						type="button"
						onClick={() => (s_isConnect(sim, x.id) ? sim.connect() : undefined)}
						className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 font-semibold text-gray-200 hover:bg-slate-700"
					>
						<Logo source={x} size="size-5" />
						{x.name}
					</button>
				))}
			</div>
		</div>
	)
}

// In the prototype only the scenario's own account connects; the others are inert.
const s_isConnect = (sim: Sim, id: ImportSourceId) =>
	sim.scenario.entry === "connect" && sim.scenario.source === id

/* Reading, connecting, checking ------------------------------------------------------------------------------------ */

function Waiting({
	title,
	line,
	value,
	label,
	children,
}: {
	title: string
	line: ReactNode
	value: number | null
	label: string
	children?: ReactNode
}) {
	return (
		<div className="flex min-h-[18rem] flex-col justify-center gap-4">
			<h2 tabIndex={-1} className={stepHeading}>
				{title}
			</h2>
			<p className="break-words text-gray-400">{line}</p>
			<Bar value={value} label={label} />
			{children}
		</div>
	)
}

function Reading({ s }: { s: Scenario }) {
	return (
		<Waiting
			title="Opening your file"
			line={<span className="break-all">{s.fileName}</span>}
			value={null}
			label="Opening the file"
		/>
	)
}

function Connecting({ sim }: { sim: Sim }) {
	const name = importSourceName(sim.scenario.source)
	return (
		<Waiting
			title={`Waiting for ${name}`}
			line={`Say yes to GoodWatch in the ${name} tab that just opened. We'll pick up here as soon as you're back.`}
			value={null}
			label={`Waiting for ${name}`}
		>
			<button
				type="button"
				className={`${textLink} self-start text-sm`}
				onClick={sim.reset}
			>
				Cancel
			</button>
		</Waiting>
	)
}

function Checking({ s, progress }: { s: Scenario; progress: number }) {
	return (
		<Waiting
			title={`Finding your titles from ${importSourceName(s.source)}`}
			line={`Looking up ${fmt(s.rows)} entries in GoodWatch.`}
			value={progress}
			label="Finding your titles"
		/>
	)
}

/* Problems --------------------------------------------------------------------------------------------------------- */

function Problem({ sim, problem }: { sim: Sim; problem: string }) {
	const s = sim.scenario
	const name = importSourceName(s.source)
	const file = (
		<span className="break-all font-semibold text-gray-100">{s.fileName}</span>
	)
	const copy: Record<
		string,
		{ title: string; body: ReactNode; fix: ReactNode }
	> = {
		streaming: {
			title: "Netflix doesn't share what you thought of things",
			body: (
				<>
					{file} only lists what played, by name and date, with no scores.
					Netflix, Prime Video, Disney+, and the other streaming services don't
					give a file GoodWatch can use.
				</>
			),
			fix: "If you also keep track somewhere else, bring that instead:",
		},
		unknown: {
			title: "GoodWatch doesn't know this file",
			body: <>{file} isn't an export from any site GoodWatch reads.</>,
			fix: "Upload the file the site gave you, as it came, without opening or renaming it.",
		},
		password: {
			title: "This ZIP is locked",
			body: (
				<>
					{name} locks {file} with a password. It's in the email {name} sent
					with the download link.
				</>
			),
			fix: "Open the ZIP on your computer with that password, then drop the files from inside it here.",
		},
		too_big: {
			title: "This file is too big",
			body: <>{file} is 34 MB. GoodWatch takes files up to 20 MB.</>,
			fix: `Unzip it and drop the files inside a few at a time. Each one comes in on its own, and nothing is added twice.`,
		},
		empty: {
			title: "This file is empty",
			body: <>{file} has no movies or shows in it yet.</>,
			fix: `${name} sometimes sends the file before it's ready. Download it again in a few minutes and drop the new one here.`,
		},
	}
	const c = copy[problem]
	return (
		<div className="flex min-h-[18rem] flex-col gap-4">
			<div className="flex items-start gap-3">
				<ExclamationTriangleIcon
					aria-hidden
					className="mt-0.5 size-6 shrink-0 text-amber-300"
				/>
				<h2 tabIndex={-1} className={stepHeading}>
					{c.title}
				</h2>
			</div>
			<p>{c.body}</p>
			<p className="text-gray-100">{c.fix}</p>
			{problem === "streaming" && (
				<ul className="flex flex-col gap-2 sm:flex-row">
					{(["trakt", "tmdb", "plex"] as const).map((id) => {
						const x = entryOf(id)
						return (
							<li key={id} className="flex-1">
								<button
									type="button"
									onClick={sim.reset}
									className={`${secondaryButton} w-full justify-start`}
								>
									<Logo source={x} size="size-6" />
									{x.connect ? `Connect ${x.name}` : `${x.name} file`}
								</button>
							</li>
						)
					})}
				</ul>
			)}
			<div className="mt-auto pt-2">
				<button type="button" className={secondaryButton} onClick={sim.reset}>
					Choose another file
				</button>
			</div>
		</div>
	)
}

/* Preview ---------------------------------------------------------------------------------------------------------- */

function Preview({ sim }: { sim: Sim }) {
	const { scenario: s, choices: c, setChoices } = sim
	const name = importSourceName(s.source)
	const [open, setOpen] = useState<Question | null>(null)
	const [choosing, setChoosing] = useState(false)
	const [uncertainIn, setUncertainIn] = useState<Record<string, boolean>>({})
	const toggle = (q: Question) => setOpen((o) => (o === q ? null : q))
	const set = (patch: Partial<Choices>) => setChoices({ ...c, ...patch })

	if (nothingNew(s))
		return (
			<div className="flex min-h-[18rem] flex-col gap-4">
				<div className="flex items-center gap-3">
					<SourceMark source={entryOf(s.source)} />
					<span className="min-w-0 break-all text-sm text-gray-400">
						{s.fileName}
					</span>
				</div>
				<h2 tabIndex={-1} className="text-xl font-bold text-white outline-none">
					Nothing new in this file
				</h2>
				<p>
					All {fmt(s.unchanged)} movies and shows in it are already in
					GoodWatch, just like this
					{s.previous
						? `, from your ${name} import on ${day(s.previous.at)}`
						: ""}
					. There's nothing to import.
				</p>
				<p className="text-gray-400">
					Want what you've added on {name} since then? Download a new export and
					drop it here.
				</p>
				<div className="mt-auto pt-2">
					<button type="button" className={secondaryButton} onClick={sim.reset}>
						Choose another file
					</button>
				</div>
			</div>
		)

	const qs = questionsFor(s)
	const kinds = included(s, c)
	const count = titleCount(s, c)
	const matching = s.matching
	const matchingDone = matching ? sim.matched >= matching.total : true

	// Differing scores.
	const pickOf = (t: Title) => c.conflictPerTitle[t.id] ?? c.conflictDefault
	const fromFile = s.conflicts.filter((x) => pickOf(x.title) === "file").length
	const conflictValue =
		fromFile === 0
			? "Keeping yours"
			: fromFile === s.conflicts.length
				? `Using ${name}'s`
				: `Keeping ${fmt(s.conflicts.length - fromFile)} of yours, ${fmt(fromFile)} from ${name}`

	// Titles not found.
	const accepted = s.unmatched.filter((u) => {
		const m = c.matches[u.raw]
		return m && m !== "skip"
	}).length
	const guessed = s.unmatched.filter((u) => u.suggestions.length).length
	const unmatchedValue =
		accepted === 0
			? guessed
				? `Leaving them out · ${fmt(guessed)} may be yours`
				: "Leaving them out"
			: `Adding ${fmt(accepted)} you picked, leaving ${fmt(s.unmatched.length - accepted)} out`

	const fx = s.sideEffects
	const fxCount = fx.offWantToSee.length + fx.offNotInterested.length

	return (
		<div>
			<div className="flex items-center gap-3">
				<SourceMark source={entryOf(s.source)} />
				<span className="min-w-0 break-all text-sm text-gray-400">
					{s.fileName}
				</span>
			</div>
			<h2
				tabIndex={-1}
				className="mt-4 text-xl font-bold text-white outline-none md:text-2xl"
			>
				{s.previous
					? `${plural(count, "new movie or show", "new movies and shows")} from ${name}`
					: `${plural(count, "movie or show", "movies and shows")} from ${name}`}
				{kinds.length > 0 && (
					<span className="font-normal text-gray-300">
						: {kinds.map((k) => kindPhrase(k, s.kinds[k])).join(", ")}
					</span>
				)}
			</h2>
			{s.previous && s.unchanged > 0 && (
				<p className="mt-2 text-gray-400">
					{fmt(s.unchanged)} more are already in GoodWatch from your import on{" "}
					{day(s.previous.at)}, so they stay as they are.
				</p>
			)}

			{qs.length > 0 && (
				<ul className="mt-5 divide-y divide-white/10 border-y border-white/10">
					{qs.map((q) => {
						if (q === "matching" && matching)
							return (
								<Row
									key={q}
									id="a-matching"
									open={open === q}
									onToggle={() => toggle(q)}
									title={
										matchingDone
											? `All ${fmt(matching.total)} entries matched`
											: `Still matching: ${fmt(sim.matched)} of ${fmt(matching.total)}`
									}
									value={
										matchingDone
											? `${plural(matching.uncertain.length, "movie")} we're not sure about`
											: "You can import now; the rest follow on their own"
									}
									action="Details"
									extra={
										<div className="pb-2" aria-live="polite">
											<Bar
												value={sim.matched / matching.total}
												label="Matching your titles"
											/>
										</div>
									}
								>
									<p className="text-sm">
										GoodWatch keeps matching after you press Import, even if you
										leave this page. Whatever it finds comes in by itself.
									</p>
									<p className="mt-3 text-sm text-gray-100">
										Not sure about these. Tap the ones that are right:
									</p>
									<ul className="mt-2 grid grid-cols-4 gap-2">
										{matching.uncertain.map((t) => {
											const on = !!uncertainIn[t.id]
											return (
												<li key={t.id}>
													<button
														type="button"
														aria-pressed={on}
														onClick={() =>
															setUncertainIn((m) => ({ ...m, [t.id]: !on }))
														}
														className="w-full cursor-pointer text-left"
													>
														<span className="relative block">
															<img
																src={t.poster}
																alt=""
																className={`aspect-[2/3] w-full rounded-md object-cover transition-opacity ${on ? "opacity-100 ring-2 ring-indigo-400" : "opacity-60"}`}
															/>
															{on && (
																<CheckCircleIcon
																	aria-hidden
																	className="absolute top-1 right-1 size-5 text-indigo-300"
																/>
															)}
														</span>
														<span className="mt-1 block text-xs leading-tight text-gray-300">
															{t.name} ({t.year})
														</span>
													</button>
												</li>
											)
										})}
									</ul>
									<p className="mt-2 text-xs text-gray-400">
										The ones you don't tap stay out. You can add them by hand
										later.
									</p>
								</Row>
							)
						if (q === "conflicts")
							return (
								<Row
									key={q}
									id="a-conflicts"
									open={open === q}
									onToggle={() => toggle(q)}
									title={`${plural(s.conflicts.length, "score")} differ from yours`}
									value={conflictValue}
								>
									<Pick
										legend="Which scores to keep"
										value={c.conflictDefault}
										onChange={(v) =>
											set({ conflictDefault: v, conflictPerTitle: {} })
										}
										options={[
											{
												value: "keep",
												label: "Keep mine",
												hint: "You changed these in GoodWatch",
											},
											{ value: "file", label: `Use ${name}'s` },
										]}
									/>
									<ul className="mt-4 flex flex-col gap-3">
										{s.conflicts.map((x) => (
											<li key={x.title.id} className="flex items-center gap-3">
												<img
													src={x.title.poster}
													alt=""
													className="aspect-[2/3] w-10 shrink-0 rounded-md object-cover"
												/>
												<span className="min-w-0 flex-1">
													<span className="block truncate font-semibold text-gray-100">
														{x.title.name}
													</span>
													<span className="block text-xs text-gray-400">
														You changed it {day(x.yoursAt)}
													</span>
												</span>
												<Pick
													small
													legend={`Score for ${x.title.name}`}
													value={pickOf(x.title)}
													onChange={(v) =>
														set({
															conflictPerTitle: {
																...c.conflictPerTitle,
																[x.title.id]: v,
															},
														})
													}
													options={[
														{ value: "keep", label: `Mine ${x.yours}` },
														{ value: "file", label: `${name} ${x.theirs}` },
													]}
												/>
											</li>
										))}
									</ul>
								</Row>
							)
						if (q === "unmatched")
							return (
								<Row
									key={q}
									id="a-unmatched"
									open={open === q}
									onToggle={() => toggle(q)}
									title={`${plural(s.unmatched.length, "title")} we couldn't find`}
									value={unmatchedValue}
									action={guessed ? "Check" : "Details"}
								>
									{guessed > 0 && (
										<>
											<p className="text-sm text-gray-100">
												Is it one of these?
											</p>
											<ul className="mt-2 flex flex-col gap-3">
												{s.unmatched
													.filter((u) => u.suggestions.length)
													.map((u) => (
														<li key={u.raw}>
															<span className="text-xs text-gray-400">
																In the file: {u.raw}
															</span>
															<div className="mt-1 flex flex-wrap gap-2">
																{u.suggestions.map((t) => {
																	const on = c.matches[u.raw] === t.id
																	return (
																		<button
																			key={t.id}
																			type="button"
																			aria-pressed={on}
																			onClick={() =>
																				set({
																					matches: {
																						...c.matches,
																						[u.raw]: on ? "skip" : t.id,
																					},
																				})
																			}
																			className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border py-1 pr-3 pl-1 text-left text-sm ${on ? "border-indigo-400 bg-indigo-500/15 text-white" : "border-slate-700 text-gray-300 hover:border-slate-500"}`}
																		>
																			<img
																				src={t.poster}
																				alt=""
																				className="aspect-[2/3] w-8 rounded object-cover"
																			/>
																			<span>
																				{t.name} ({t.year})
																			</span>
																			{on && (
																				<CheckCircleIcon
																					aria-hidden
																					className="size-5 text-indigo-300"
																				/>
																			)}
																		</button>
																	)
																})}
															</div>
														</li>
													))}
											</ul>
										</>
									)}
									<p className="mt-4 text-sm text-gray-400">
										No match in GoodWatch, so these stay out:{" "}
										{s.unmatched
											.filter((u) => !u.suggestions.length)
											.map((u) => u.raw)
											.join(", ")}
										.
										{s.unsupported > 0 &&
											` ${plural(s.unsupported, "more entry", "more entries")} ${s.unsupported === 1 ? "isn't a movie or show" : "aren't movies or shows"}, like games or podcasts.`}
									</p>
								</Row>
							)
						if (q === "undated")
							return (
								<Row
									key={q}
									id="a-undated"
									open={open === q}
									onToggle={() => toggle(q)}
									title={`${plural(s.undatedWatches, "watch", "watches")} without a date`}
									value={
										c.undated === "import"
											? "Adding them as Seen, no date"
											: "Leaving them out"
									}
								>
									<Pick
										legend="Watches without a date"
										value={c.undated}
										onChange={(v) => set({ undated: v })}
										options={[
											{
												value: "import",
												label: "Add as Seen",
												hint: "They count for your taste; your history won't say when",
											},
											{ value: "skip", label: "Leave them out" },
										]}
									/>
								</Row>
							)
						if (q === "rewatch")
							return (
								<Row
									key={q}
									id="a-rewatch"
									open={open === q}
									onToggle={() => toggle(q)}
									title={`${plural(s.alreadySeenWants.length, "Want to See title")} you've already Seen`}
									value={
										c.rewatch === "leave"
											? "Leaving them off Want to See"
											: "Adding as Want to rewatch"
									}
								>
									<Posters titles={s.alreadySeenWants} named size="w-14" />
									<div className="mt-3">
										<Pick
											legend="Titles you've already Seen"
											value={c.rewatch}
											onChange={(v) => set({ rewatch: v })}
											options={[
												{ value: "leave", label: "Leave them off" },
												{ value: "rewatch", label: "Add as Want to rewatch" },
											]}
										/>
									</div>
								</Row>
							)
						if (q === "side-effects")
							return (
								<Row
									key={q}
									id="a-fx"
									open={open === q}
									onToggle={() => toggle(q)}
									title={`${plural(fxCount, "title")} come${fxCount === 1 ? "s" : ""} off your lists`}
									value="Because you've now watched them"
									action="See which"
								>
									{fx.offWantToSee.length > 0 && (
										<>
											<p className="text-sm text-gray-100">
												Off Want to See ({fmt(fx.offWantToSee.length)})
											</p>
											<div className="mt-2">
												<Posters titles={fx.offWantToSee} named size="w-14" />
											</div>
										</>
									)}
									{fx.offNotInterested.length > 0 && (
										<>
											<p className="mt-4 text-sm text-gray-100">
												Off Not interested ({fmt(fx.offNotInterested.length)})
											</p>
											<div className="mt-2">
												<Posters
													titles={fx.offNotInterested}
													named
													size="w-14"
												/>
											</div>
										</>
									)}
									<p className="mt-3 text-xs text-gray-400">
										Want one back on a list? Add it again after the import.
									</p>
								</Row>
							)
						return null
					})}
				</ul>
			)}

			<div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
				<button
					type="button"
					className={`${primaryButton} w-full sm:w-auto sm:min-w-48`}
					disabled={kinds.length === 0}
					onClick={sim.confirm}
				>
					{matchingDone ? "Import" : "Import what's matched"}
				</button>
				<button
					type="button"
					aria-expanded={choosing}
					aria-controls="a-kinds"
					onClick={() => setChoosing((v) => !v)}
					className={`${textLink} self-center text-sm sm:ml-2`}
				>
					{choosing ? "Done choosing" : "Leave something out"}
				</button>
				<button
					type="button"
					onClick={sim.reset}
					className="cursor-pointer self-center text-sm text-gray-400 hover:text-gray-200 sm:ml-auto"
				>
					Cancel
				</button>
			</div>
			{choosing && (
				<Appear id="a-kinds" className="mt-4">
					<fieldset className="rounded-lg border border-white/10 p-3">
						<legend className="px-1 text-sm text-gray-400">Bring in</legend>
						<ul className="flex flex-col">
							{KIND_ORDER.filter((k) => s.kinds[k] > 0).map((k) => (
								<li key={k}>
									<label className="flex min-h-11 cursor-pointer items-center gap-3">
										<input
											type="checkbox"
											className="size-5 accent-indigo-500"
											checked={c.include[k]}
											onChange={(e) =>
												set({
													include: { ...c.include, [k]: e.target.checked },
												})
											}
										/>
										<span className="flex-1 text-gray-100">{kindName[k]}</span>
										<span className="text-sm text-gray-400">
											{fmt(s.kinds[k])}
										</span>
									</label>
								</li>
							))}
						</ul>
					</fieldset>
				</Appear>
			)}
		</div>
	)
}

/* Running and after ------------------------------------------------------------------------------------------------ */

function Running({ sim, progress }: { sim: Sim; progress: number }) {
	const s = sim.scenario
	const long = s.runSeconds >= 10
	const count = titleCount(s, sim.choices)
	return (
		<div className="flex min-h-[18rem] flex-col justify-center gap-4">
			<h2 tabIndex={-1} className={stepHeading}>
				Importing {plural(count, "movie or show", "movies and shows")} from{" "}
				{importSourceName(s.source)}
			</h2>
			<Bar value={progress} label="Import progress" />
			<p aria-live="polite" className="text-sm text-gray-400">
				{Math.round(progress * 100)}% done
			</p>
			<p className="text-gray-300">
				{long
					? "A big one, so this takes a few minutes. You can leave this page; it keeps going and you'll find it here when it's done."
					: "This takes a few seconds."}
			</p>
		</div>
	)
}

function Failed({ sim, progress }: { sim: Sim; progress: number }) {
	const s = sim.scenario
	const saved = Math.round(titleCount(s, sim.choices) * progress)
	return (
		<div className="flex min-h-[18rem] flex-col justify-center gap-4">
			<div className="flex items-start gap-3">
				<ExclamationTriangleIcon
					aria-hidden
					className="mt-0.5 size-6 shrink-0 text-amber-300"
				/>
				<h2 tabIndex={-1} className={stepHeading}>
					The import stopped at {Math.round(progress * 100)}%
				</h2>
			</div>
			<Bar value={progress} label="Import progress" tone="bg-amber-400" />
			<p>
				The {fmt(saved)} movies and shows that came in so far are saved.
				Continue picks up where it stopped, and nothing is added twice.
			</p>
			<div className="flex flex-wrap items-center gap-4">
				<button type="button" className={primaryButton} onClick={sim.resume}>
					Continue
				</button>
				<button
					type="button"
					className={`${textLink} text-sm`}
					onClick={sim.undo}
				>
					Undo what came in
				</button>
			</div>
		</div>
	)
}

function doneLines(s: Scenario, c: Choices) {
	const name = importSourceName(s.source)
	const lines = included(s, c).map((k) => kindDone(k, s.kinds[k]))
	if (s.conflicts.length) {
		const file = s.conflicts.filter(
			(x) => (c.conflictPerTitle[x.title.id] ?? c.conflictDefault) === "file",
		).length
		if (s.conflicts.length - file)
			lines.push(`${plural(s.conflicts.length - file, "score")} kept as yours`)
		if (file) lines.push(`${plural(file, "score")} changed to ${name}'s`)
	}
	if (s.undatedWatches)
		lines.push(
			c.undated === "import"
				? `${plural(s.undatedWatches, "watch", "watches")} added without a date`
				: `${plural(s.undatedWatches, "watch", "watches")} without a date left out`,
		)
	if (s.alreadySeenWants.length && c.rewatch === "rewatch")
		lines.push(`${fmt(s.alreadySeenWants.length)} added to Want to rewatch`)
	const fx = s.sideEffects
	if (fx.offWantToSee.length)
		lines.push(`${plural(fx.offWantToSee.length, "title")} off Want to See`)
	if (fx.offNotInterested.length)
		lines.push(
			`${plural(fx.offNotInterested.length, "title")} off Not interested`,
		)
	const left = s.unmatched.filter((u) => {
		const m = c.matches[u.raw]
		return !m || m === "skip"
	}).length
	if (left) lines.push(`${plural(left, "title")} not found, left out`)
	return lines
}

function Done({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const name = importSourceName(s.source)
	const past = s.entry === "history"
	const [confirming, setConfirming] = useState(past)
	const leaves = s.undoLeaves ?? []
	const lines = doneLines(s, sim.choices)
	return (
		<div className="flex min-h-[18rem] flex-col gap-4">
			<div className="flex items-start gap-3">
				{past ? (
					<SourceMark source={entryOf(s.source)} />
				) : (
					<CheckCircleIcon
						aria-hidden
						className="mt-0.5 size-7 shrink-0 text-green-400"
					/>
				)}
				<div className="min-w-0">
					<h2
						tabIndex={-1}
						className="text-xl font-bold text-white outline-none"
					>
						{past
							? `${name} import, ${day(s.previous?.at ?? "")}`
							: `Your ${name} history is in`}
					</h2>
					{past && (
						<p className="break-all text-sm text-gray-400">{s.fileName}</p>
					)}
				</div>
			</div>
			<ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
				{lines.map((l) => (
					<li key={l} className="flex items-center gap-2">
						<span
							aria-hidden
							className="size-1.5 shrink-0 rounded-full bg-indigo-400"
						/>
						{l}
					</li>
				))}
			</ul>
			{!past && s.sample.length > 0 && (
				<div className="-mx-1 flex gap-1.5 overflow-hidden px-1" aria-hidden>
					{s.sample.slice(0, 8).map((t) => (
						<img
							key={t.id}
							src={t.poster}
							alt=""
							className="aspect-[2/3] w-[calc((100%-0.375rem*7)/8)] shrink-0 rounded-md object-cover"
						/>
					))}
				</div>
			)}
			{!past && (
				<div className="flex flex-wrap items-center gap-4">
					<a href="/taste" className={primaryButton}>
						See your taste
					</a>
					{!confirming && (
						<button
							type="button"
							className={`${textLink} text-sm`}
							onClick={() => setConfirming(true)}
						>
							Undo this import
						</button>
					)}
				</div>
			)}
			{confirming && (
				<Appear className="rounded-lg border border-white/10 p-4">
					<p className="font-semibold text-gray-100">
						{past ? "Undo this import?" : "Undo takes it all back"}
					</p>
					<p className="mt-1 text-sm">
						GoodWatch removes what this import added and puts back what it
						changed.
					</p>
					{leaves.length > 0 && (
						<div className="mt-3">
							<p className="text-sm">
								You changed{" "}
								{leaves.length === 1 ? "this one" : `these ${leaves.length}`}{" "}
								since, so {leaves.length === 1 ? "it stays" : "they stay"} as
								you left {leaves.length === 1 ? "it" : "them"}:
							</p>
							<div className="mt-2">
								<Posters titles={leaves} named size="w-14" />
							</div>
						</div>
					)}
					<div className="mt-4 flex flex-wrap items-center gap-3">
						<button type="button" className={dangerButton} onClick={sim.undo}>
							Undo import
						</button>
						<button
							type="button"
							className={secondaryButton}
							onClick={() => (past ? sim.reset() : setConfirming(false))}
						>
							{past ? "Back" : "Keep it"}
						</button>
					</div>
				</Appear>
			)}
		</div>
	)
}

function Undoing({ sim, progress }: { sim: Sim; progress: number }) {
	return (
		<div className="flex min-h-[18rem] flex-col justify-center gap-4">
			<h2 tabIndex={-1} className={stepHeading}>
				Undoing your {importSourceName(sim.scenario.source)} import
			</h2>
			<Bar value={progress} label="Undo progress" />
			<p aria-live="polite" className="text-sm text-gray-400">
				{Math.round(progress * 100)}% done
			</p>
		</div>
	)
}

function Undone({ sim }: { sim: Sim }) {
	const leaves = sim.scenario.undoLeaves ?? []
	return (
		<div className="flex min-h-[18rem] flex-col justify-center gap-4">
			<div className="flex items-start gap-3">
				<CheckCircleIcon
					aria-hidden
					className="mt-0.5 size-7 shrink-0 text-green-400"
				/>
				<h2 tabIndex={-1} className="text-xl font-bold text-white outline-none">
					Import undone
				</h2>
			</div>
			<p>
				GoodWatch is back to how it was before
				{leaves.length
					? `, except ${listNames(leaves)}, which you changed since and stay as you left ${leaves.length === 1 ? "it" : "them"}.`
					: "."}
			</p>
			<div>
				<button type="button" className={secondaryButton} onClick={sim.reset}>
					Import a file
				</button>
			</div>
		</div>
	)
}

/* History ---------------------------------------------------------------------------------------------------------- */

function History({ sim }: { sim: Sim }) {
	const s = sim.scenario
	const at = sim.phase.at
	const past = s.entry === "history"
	const justNow = !past && (at === "done" || at === "undone" || at === "failed")
	const rows = [
		...(justNow
			? [
					{
						id: "now",
						source: s.source,
						at: "",
						line:
							at === "undone"
								? "Undone"
								: at === "failed"
									? "Stopped partway"
									: "In progress or done",
					},
				]
			: []),
		...HISTORY,
	]
	return (
		<section className="mt-8 px-1" aria-labelledby="a-history">
			<h3 id="a-history" className="text-sm font-semibold text-gray-400">
				Earlier imports
			</h3>
			<ul className="mt-1 divide-y divide-white/5">
				{rows.map((h) => {
					const x = entryOf(h.source)
					const mine = past && h.id === "h1"
					const line =
						h.id === "now" && at === "done"
							? "Just now"
							: mine && at === "undone"
								? "Undone"
								: h.line
					const body = (
						<>
							<Logo source={x} size="size-6" />
							<span className="min-w-0 flex-1">
								<span className="text-gray-200">{x.name}</span>
								<span className="text-gray-500">
									{" "}
									· {h.at ? day(h.at) : "Today"}
								</span>
							</span>
							<span className="shrink-0 text-gray-400">{line}</span>
						</>
					)
					return (
						<li key={h.id}>
							{mine && at === "start" ? (
								<button
									type="button"
									onClick={sim.openPast}
									className="flex min-h-11 w-full cursor-pointer items-center gap-3 py-2 text-left text-sm hover:bg-white/5"
								>
									{body}
									<ChevronRightIcon
										aria-hidden
										className="size-4 text-gray-500"
									/>
								</button>
							) : (
								<div className="flex min-h-11 items-center gap-3 py-2 text-sm">
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
