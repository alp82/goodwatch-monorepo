// PROTOTYPE - throwaway (branch prototype/onboarding-imports), round 2. Owner: "D but with horizontal
// stepper/progress at the top. needs to look much nicer - wording from A, design from C. more variations".
// /taste?variant=D|E|F|G|H. Same in-memory rules as round 1: real file recognition, simulated import.
import { CheckIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useMemo, useState } from "react"
import { type ImportSourceId } from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import { primaryButton, textLink } from "~/ui/imports/shared"
import type { ScoringMedia } from "~/ui/scoring/types"
import { RatingDots } from "~/ui/taste-quiz/TasteQuizPage"
import {
	DropBox,
	type FakeImport,
	GOAL,
	GetYourData,
	ImportStatus,
	PageDrop,
	REST,
	RateCard,
	SourceTile,
	TOP,
	WaitChip,
	ghost,
	image,
	keyOf,
	source,
	useCombined,
} from "./OnboardingImports"

// ---------------------------------------------------------------------------------------------------------------
// One flow for every round 2 variant: the step, the picked source, and when to move on.

type Step = 1 | 2 | 3
const STEP_LABELS = ["Bring your history", "Rate a few", "Your taste"] as const
const SLOW: ImportSourceId[] = ["imdb", "trakt"]

function useFlow(shelf: ScoringMedia[]) {
	const c = useCombined(shelf)
	const [step, setStep] = useState<Step>(1)
	const [pick, setPick] = useState<ImportSourceId | null>(null)
	const [waiting, setWaiting] = useState<ImportSourceId | null>(null)
	const ready = c.liked >= GOAL
	// 5 liked from either path finishes the start; a finished import moves on by itself after a beat.
	useEffect(() => {
		if (ready) {
			const t = setTimeout(() => setStep(3), c.imp.phase.kind === "done" ? 1400 : 300)
			return () => clearTimeout(t)
		}
	}, [ready, c.imp.phase.kind])
	// A file dropped while rating goes back to step 1, where its status shows.
	const take = (f?: File) => {
		setStep(1)
		setWaiting(null)
		c.imp.take(f)
	}
	return {
		...c,
		step,
		setStep,
		pick,
		setPick: (id: ImportSourceId | null) => {
			setPick(id)
			c.imp.reset()
		},
		waiting,
		/** Rate while a slow export is prepared: step 2 keeps a note about the file on its way. */
		rateWhileWaiting: () => {
			setWaiting(pick)
			setStep(2)
		},
		take,
		ready,
		done: (n: Step) =>
			n === 1 ? c.imp.phase.kind === "done" : n === 2 ? ready : false,
		/** What each step says under its label. */
		note: (n: Step) =>
			n === 1
				? c.imp.phase.kind === "done"
					? `${source(c.imp.phase.source).name} · ${c.imported.toLocaleString()} liked`
					: "Optional · fastest"
				: n === 2
					? `${Math.min(c.liked, GOAL)} of ${GOAL} liked`
					: ready
						? "Ready"
						: "",
	}
}
type Flow = ReturnType<typeof useFlow>

// ---------------------------------------------------------------------------------------------------------------
// Shared look from C: the poster wall, and A's words for each step.

function PosterWall({ shelf, from = 0, count = 24, cols = "grid-cols-6 md:grid-cols-12", opacity = "opacity-15", className = "", fade = true, children }: { shelf: ScoringMedia[]; from?: number; count?: number; cols?: string; opacity?: string; className?: string; fade?: boolean; children: ReactNode }) {
	const wall = useMemo(() => shelf.slice(from, from + count), [shelf, from, count])
	// The wall fades out into the page's own background, so it never ends on a hard edge.
	const mask = fade ? { maskImage: "linear-gradient(to bottom, black 45%, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black 45%, transparent)" } : undefined
	return (
		<div className={`relative overflow-hidden ${className}`}>
			<div className="absolute inset-0" style={mask} aria-hidden>
				<div className={`grid ${cols} content-start gap-1 ${opacity}`}>
					{wall.map((t) => (
						<img key={keyOf(t)} src={image(t.poster_path, "w185")} alt="" className="aspect-[2/3] w-full object-cover" />
					))}
				</div>
				<div className="absolute inset-0 bg-gradient-to-b from-gray-950/40 via-gray-950/80 to-gray-950/90" />
			</div>
			<div className="relative h-full">{children}</div>
		</div>
	)
}

const H1 = "text-3xl font-extrabold tracking-tight text-white md:text-5xl"
const lead = "mt-3 text-gray-300 md:text-lg"

/** The words at the top of each step: A's question first, then the picked source's. */
function stepWords(f: Flow): { title: string; text: string } {
	if (f.step === 1) {
		if (f.imp.phase.kind === "done")
			return { title: "That's your history in.", text: "Everything you imported is in your library now. You can undo it in Settings." }
		if (f.pick)
			return {
				title: `Bring your ${source(f.pick).name} library`,
				text: source(f.pick).connect
					? "Connect once. GoodWatch shows what it found before anything changes."
					: "Get the file, then drop it here. GoodWatch reads it on your device first.",
			}
		return {
			title: "Where do you keep track of what you watch?",
			text: "Bring it along and GoodWatch knows your taste right away. Nothing changes until you check it.",
		}
	}
	if (f.step === 2) {
		const left = Math.max(GOAL - f.liked, 0)
		return {
			title: f.liked === 0 ? "What have you loved watching?" : left > 0 ? `${left} more you liked.` : "That's enough to start.",
			text: `Rate ${GOAL} titles you liked. GoodWatch groups what they share and finds more like them.`,
		}
	}
	return {
		title: "Your taste is ready.",
		text: f.imported > 0
			? `Built from ${f.liked.toLocaleString()} titles you liked. GoodWatch grouped what they share.`
			: "GoodWatch grouped what your titles share. Rate more any time and it gets sharper.",
	}
}

/** The liked titles, fanned out: what the taste is built from. */
function PosterFan({ f, shelf }: { f: Flow; shelf: ScoringMedia[] }) {
	const rated = f.r.rated.filter((x) => x.score >= 7).map((x) => x.title)
	const titles = [...rated, ...(f.imported > 0 ? shelf.slice(20, 34) : [])].slice(0, 7)
	const mid = (titles.length - 1) / 2
	return (
		<div className="flex justify-center py-6" aria-hidden>
			{titles.map((t, i) => (
				<img
					key={keyOf(t)}
					src={image(t.poster_path, "w342")}
					alt=""
					style={{ transform: `rotate(${(i - mid) * 5}deg) translateY(${Math.abs(i - mid) * 8}px)`, zIndex: 10 - Math.abs(Math.round(i - mid)) }}
					className="-mx-4 w-24 rounded-lg shadow-2xl ring-1 ring-white/10 md:-mx-5 md:w-36"
				/>
			))}
		</div>
	)
}

function ReadyActions({ f }: { f: Flow }) {
	return (
		<div className="flex flex-wrap items-center justify-center gap-3">
			<a href="/taste" className={primaryButton}>
				See your taste
			</a>
			<button type="button" className={ghost} onClick={() => f.setStep(2)}>
				Rate a few more
			</button>
		</div>
	)
}

/** Step 1's body: the tiles, then the picked source's steps and drop box, then the import's status. */
function HistoryBody({ f, shelf, tiles = "grid-cols-2 sm:grid-cols-3", center = true, bigDrop = true }: { f: Flow; shelf: ScoringMedia[]; tiles?: string; center?: boolean; bigDrop?: boolean }) {
	const [more, setMore] = useState(false)
	const p = f.imp.phase
	if (p.kind !== "idle")
		return (
			<div className="flex flex-col gap-4 text-left">
				<ImportStatus imp={f.imp} shelf={shelf} />
				{p.kind === "done" && !f.ready && (
					<div className={`flex flex-wrap gap-3 ${center ? "justify-center" : ""}`}>
						<button type="button" className={primaryButton} onClick={() => f.setStep(2)}>
							Rate a few to fill it in
						</button>
					</div>
				)}
			</div>
		)
	if (!f.pick)
		return (
			<div className="flex flex-col gap-4">
				<div className={`grid gap-2 text-left ${tiles}`}>
					{TOP.map((id) => (
						<SourceTile key={id} s={source(id)} onClick={() => f.setPick(id)} />
					))}
					<button
						type="button"
						onClick={() => setMore(!more)}
						aria-expanded={more}
						className="min-h-16 cursor-pointer rounded-lg border border-slate-700 bg-slate-900/60 px-3 text-left font-semibold text-gray-200 hover:bg-slate-800/70"
					>
						Somewhere else
						<span className="line-clamp-1 block text-xs font-normal text-gray-400">{REST.map((s) => s.name).join(", ")}</span>
					</button>
				</div>
				{more && (
					<div className={`flex flex-wrap gap-2 ${center ? "justify-center" : ""}`}>
						{REST.map((s) => (
							<SourceTile key={s.id} small s={s} onClick={() => f.setPick(s.id)} />
						))}
					</div>
				)}
				<div className={`flex flex-col gap-2 ${center ? "items-center" : "items-start"}`}>
					<button type="button" className={ghost} onClick={() => f.setStep(2)}>
						Nowhere yet. I'll rate a few here
					</button>
					<p className="text-sm text-gray-500">Already have the file? Drop it anywhere on this page.</p>
				</div>
			</div>
		)
	const s = source(f.pick)
	return (
		<div className="flex flex-col gap-4 text-left text-gray-300">
			<div className="flex flex-wrap items-center gap-3">
				<SourceMark source={s} />
				<span className="font-semibold text-gray-100">{s.name}</span>
				<WaitChip s={s} />
				<button type="button" className={`${textLink} ml-auto text-sm`} onClick={() => f.setPick(null)}>
					Pick another source
				</button>
			</div>
			<div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
				<GetYourData id={f.pick} imp={f.imp} short />
			</div>
			{!s.connect && (
				<DropBox imp={f.imp} big={bigDrop} sampleOf={f.pick}>
					<p className="text-lg font-semibold text-gray-100">Drop your {s.name} file here</p>
				</DropBox>
			)}
			{SLOW.includes(f.pick) && (
				<p className="text-center text-sm text-gray-400">
					{s.name} needs {s.wait.toLowerCase()} to make the file.{" "}
					<button type="button" className={textLink} onClick={f.rateWhileWaiting}>
						Rate a few while you wait
					</button>
				</p>
			)}
		</div>
	)
}

/** Step 2's note while a slow export is on its way. */
function WaitingNote({ f }: { f: Flow }) {
	if (!f.waiting || f.imp.phase.kind !== "idle") return null
	return (
		<div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm text-gray-300">
			<SourceMark source={source(f.waiting)} />
			<span className="min-w-0 flex-1">Your {source(f.waiting).name} file is on its way. When it's ready, drop it anywhere on this page.</span>
		</div>
	)
}

function RateBody({ f }: { f: Flow }) {
	return (
		<div className="flex flex-col gap-4 text-left">
			<WaitingNote f={f} />
			<RateCard r={f.r} />
			<div className="flex flex-wrap gap-4 text-sm">
				<button type="button" className={textLink} onClick={() => f.setStep(1)}>
					I do track somewhere
				</button>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// E: Stage. Numbered stepper with a connecting line, centered over C's poster wall; the whole flow sits on it.

function StepperDots({ f }: { f: Flow }) {
	return (
		<nav aria-label="Getting started" className="mx-auto w-full max-w-2xl">
			<ol className="flex items-start">
				{([1, 2, 3] as const).map((n, i) => {
					const done = f.done(n)
					const on = f.step === n
					return (
						<li key={n} className="relative flex flex-1 flex-col items-center">
							{i > 0 && (
								<span aria-hidden className={`absolute right-1/2 top-4 h-0.5 w-full ${f.step >= n || done ? "bg-amber-400" : "bg-slate-700"}`} />
							)}
							<button
								type="button"
								onClick={() => f.setStep(n)}
								aria-current={on ? "step" : undefined}
								className={`relative z-10 flex size-9 cursor-pointer items-center justify-center rounded-full text-sm font-black ${done ? "bg-amber-400 text-gray-950" : on ? "bg-gray-950 text-amber-300 ring-2 ring-amber-400" : "bg-slate-800 text-gray-400"}`}
							>
								{done ? <CheckIcon className="size-5" aria-hidden /> : n}
							</button>
							<span className={`mt-2 text-center text-sm font-semibold ${on ? "text-white" : "text-gray-400"}`}>{STEP_LABELS[n - 1]}</span>
							<span className="hidden text-center text-xs text-gray-500 sm:block">{f.note(n)}</span>
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

function VariantE({ shelf }: { shelf: ScoringMedia[] }) {
	const f = useFlow(shelf)
	const w = stepWords(f)
	return (
		<div className="pb-32 text-white">
			<PageDrop onFile={f.take} />
			<PosterWall shelf={shelf} count={36}>
				<div className="mx-auto max-w-3xl px-4 pb-16 pt-8 text-center md:pt-12">
					<StepperDots f={f} />
					<h1 className={`${H1} mt-10`}>{w.title}</h1>
					<p className={`${lead} mx-auto max-w-xl`}>{w.text}</p>
					<div className="mt-8">
						{f.step === 1 && <HistoryBody f={f} shelf={shelf} />}
						{f.step === 2 && <RateBody f={f} />}
						{f.step === 3 && (
							<>
								<PosterFan f={f} shelf={shelf} />
								<ReadyActions f={f} />
							</>
						)}
					</div>
				</div>
			</PosterWall>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// F: Progress bar. A slim three-part bar across the top that fills with liked titles; left-aligned words, the
// sources as big logo cards in one row, and the picked source's steps laid out side by side.

function StepperBar({ f }: { f: Flow }) {
	const fill = (n: Step) => (f.done(n) || f.step > n ? 100 : f.step === n ? (n === 2 ? (Math.min(f.liked, GOAL) / GOAL) * 100 : 35) : 0)
	return (
		<nav aria-label="Getting started" className="sticky top-0 z-30 border-b border-slate-800 bg-gray-950/95">
			<div className="mx-auto max-w-7xl px-4 py-3 md:px-8">
				<div className="mb-2 flex items-baseline justify-between text-sm">
					<span className="font-semibold text-gray-200">
						Step {f.step} of 3 · <span className="text-white">{STEP_LABELS[f.step - 1]}</span>
					</span>
					<span className="text-gray-400">{f.note(f.step)}</span>
				</div>
				<ol className="grid grid-cols-3 gap-1.5">
					{([1, 2, 3] as const).map((n) => (
						<li key={n}>
							<button type="button" onClick={() => f.setStep(n)} aria-current={f.step === n ? "step" : undefined} className="block w-full cursor-pointer py-1" aria-label={STEP_LABELS[n - 1]}>
								<span className="block h-1.5 overflow-hidden rounded-full bg-slate-800">
									<span className="block h-full rounded-full bg-amber-400 transition-[width] duration-500" style={{ width: `${fill(n)}%` }} />
								</span>
							</button>
						</li>
					))}
				</ol>
			</div>
		</nav>
	)
}

function BigSourceCards({ f }: { f: Flow }) {
	return (
		<div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
			{[...TOP, ...REST.map((s) => s.id)].map((id) => {
				const s = source(id)
				return (
					<button
						key={id}
						type="button"
						onClick={() => f.setPick(id)}
						className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-center hover:border-amber-400/60 hover:bg-slate-800"
					>
						<span className="scale-125 py-2">
							<SourceMark source={s} />
						</span>
						<span className="font-semibold text-gray-100">{s.name}</span>
						<span className="text-xs text-gray-400">{s.wait}</span>
					</button>
				)
			})}
		</div>
	)
}

function VariantF({ shelf }: { shelf: ScoringMedia[] }) {
	const f = useFlow(shelf)
	const w = stepWords(f)
	const s = f.pick ? source(f.pick) : null
	return (
		<div className="pb-32 text-white">
			<PageDrop onFile={f.take} />
			<StepperBar f={f} />
			<PosterWall shelf={shelf} from={12} count={12} cols="grid-cols-6 md:grid-cols-12" opacity="opacity-20">
				<div className="mx-auto max-w-7xl px-4 pb-8 pt-10 md:px-8 md:pt-14">
					<h1 className={H1}>{w.title}</h1>
					<p className={`${lead} max-w-2xl`}>{w.text}</p>
				</div>
			</PosterWall>
			<div className="mx-auto max-w-7xl px-4 md:px-8">
				{f.step === 1 && f.imp.phase.kind === "idle" && !s && (
					<div className="flex flex-col gap-6">
						<BigSourceCards f={f} />
						<div className="flex flex-wrap items-center gap-4">
							<button type="button" className={ghost} onClick={() => f.setStep(2)}>
								Nowhere yet. I'll rate a few here
							</button>
							<span className="text-sm text-gray-500">Already have the file? Drop it anywhere on this page.</span>
						</div>
					</div>
				)}
				{f.step === 1 && f.imp.phase.kind === "idle" && s && (
					<div className="flex flex-col gap-6 text-gray-300">
						<div className="flex flex-wrap items-center gap-3">
							<SourceMark source={s} />
							<span className="text-lg font-bold text-white">{s.name}</span>
							<WaitChip s={s} />
							<button type="button" className={`${textLink} text-sm`} onClick={() => f.setPick(null)}>
								Pick another source
							</button>
						</div>
						<ol className="grid gap-3 md:grid-cols-3">
							<li className="rounded-xl border border-slate-700 bg-slate-900/80 p-5">
								<div className="text-4xl font-black text-amber-400">1</div>
								<div className="mt-2 font-bold text-white">{s.connect ? `Connect ${s.name}` : `Ask ${s.name} for your file`}</div>
								<div className="mt-3">
									<GetYourData id={s.id} imp={f.imp} short />
								</div>
							</li>
							<li className="rounded-xl border border-slate-700 bg-slate-900/80 p-5">
								<div className="text-4xl font-black text-amber-400">2</div>
								<div className="mt-2 font-bold text-white">{SLOW.includes(s.id) ? `${s.name} takes ${s.wait.toLowerCase()}` : "It's ready right away"}</div>
								<p className="mt-3">
									{SLOW.includes(s.id) ? "No need to wait here. Rate a few titles meanwhile." : "Download it and keep it as it is. Don't unpack or rename it."}
								</p>
								{SLOW.includes(s.id) && (
									<button type="button" className={`${ghost} mt-3`} onClick={f.rateWhileWaiting}>
										Rate while you wait
									</button>
								)}
							</li>
							<li className="rounded-xl border border-slate-700 bg-slate-900/80 p-5">
								<div className="text-4xl font-black text-amber-400">3</div>
								<div className="mt-2 font-bold text-white">Drop it here</div>
								{!s.connect ? (
									<div className="mt-3">
										<DropBox imp={f.imp} sampleOf={s.id}>
											<p className="text-sm">Or anywhere on this page.</p>
										</DropBox>
									</div>
								) : (
									<p className="mt-3">Nothing to drop. Connecting brings everything in.</p>
								)}
							</li>
						</ol>
					</div>
				)}
				{f.step === 1 && f.imp.phase.kind !== "idle" && (
					<div className="max-w-3xl">
						<HistoryBody f={f} shelf={shelf} center={false} />
					</div>
				)}
				{f.step === 2 && (
					<div className="flex flex-col gap-4">
						<div className="flex items-center gap-3 text-sm text-gray-400">
							<RatingDots at={f.liked} of={GOAL} />
							{Math.min(f.liked, GOAL)} of {GOAL} liked
						</div>
						<RateBody f={f} />
					</div>
				)}
				{f.step === 3 && (
					<div className="flex flex-col items-start gap-4">
						<PosterFan f={f} shelf={shelf} />
						<ReadyActions f={f} />
					</div>
				)}
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// G: Split. Text tabs with an underline as the stepper; words and choices on the left, a tall poster column on
// the right that holds the drop box (step 1), the rating card (step 2), or the fan (step 3).

function StepperTabs({ f }: { f: Flow }) {
	return (
		<nav aria-label="Getting started" className="border-b border-slate-800">
			<ol className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 md:px-8">
				{([1, 2, 3] as const).map((n) => {
					const on = f.step === n
					return (
						<li key={n} className="shrink-0">
							<button
								type="button"
								onClick={() => f.setStep(n)}
								aria-current={on ? "step" : undefined}
								className={`flex cursor-pointer items-center gap-2 border-b-2 py-3 text-sm font-semibold ${on ? "border-amber-400 text-white" : "border-transparent text-gray-400 hover:text-gray-200"}`}
							>
								<span className={`flex size-6 items-center justify-center rounded-full text-xs font-black ${f.done(n) ? "bg-amber-400 text-gray-950" : on ? "bg-amber-400/20 text-amber-300" : "bg-slate-800"}`}>
									{f.done(n) ? <CheckIcon className="size-4" aria-hidden /> : n}
								</span>
								{STEP_LABELS[n - 1]}
								<span className="hidden font-normal text-gray-500 md:inline">{f.note(n)}</span>
							</button>
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

function VariantG({ shelf }: { shelf: ScoringMedia[] }) {
	const f = useFlow(shelf)
	const w = stepWords(f)
	const p = f.imp.phase
	const s = f.pick ? source(f.pick) : null
	return (
		<div className="pb-32 text-white">
			<PageDrop onFile={f.take} />
			<StepperTabs f={f} />
			<div className="mx-auto grid max-w-7xl gap-8 px-4 pt-8 md:px-8 md:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
				<div className="flex flex-col gap-6">
					<div>
						<h1 className={H1}>{w.title}</h1>
						<p className={lead}>{w.text}</p>
					</div>
					{f.step === 1 && p.kind === "idle" && !s && <HistoryBody f={f} shelf={shelf} tiles="grid-cols-1 sm:grid-cols-2" center={false} />}
					{f.step === 1 && p.kind === "idle" && s && (
						<div className="flex flex-col gap-4 text-gray-300">
							<div className="flex flex-wrap items-center gap-3">
								<SourceMark source={s} />
								<span className="font-semibold text-gray-100">{s.name}</span>
								<WaitChip s={s} />
								<button type="button" className={`${textLink} text-sm`} onClick={() => f.setPick(null)}>
									Pick another source
								</button>
							</div>
							<GetYourData id={s.id} imp={f.imp} />
							{SLOW.includes(s.id) && (
								<button type="button" className={`${ghost} self-start`} onClick={f.rateWhileWaiting}>
									Rate a few while you wait
								</button>
							)}
						</div>
					)}
					{f.step === 1 && p.kind !== "idle" && <HistoryBody f={f} shelf={shelf} center={false} />}
					{f.step === 2 && (
						<>
							<div className="flex items-center gap-3 text-sm text-gray-400">
								<RatingDots at={f.liked} of={GOAL} />
								{Math.min(f.liked, GOAL)} of {GOAL} liked
							</div>
							<WaitingNote f={f} />
							<button type="button" className={`${textLink} self-start text-sm`} onClick={() => f.setStep(1)}>
								I do track somewhere
							</button>
						</>
					)}
					{f.step === 3 && (
						<div className="self-start">
							<ReadyActions f={f} />
						</div>
					)}
				</div>
				<div className="flex overflow-hidden rounded-2xl bg-gray-950 ring-1 ring-white/10">
					<PosterWall shelf={shelf} count={36} cols="grid-cols-4 md:grid-cols-6" opacity="opacity-30" className="flex-1" fade={false}>
						<div className="flex h-full min-h-[28rem] flex-col justify-center p-4 md:p-8">
							{f.step === 1 && (!s || !s.connect) && p.kind === "idle" && (
								<DropBox imp={f.imp} big sampleOf={f.pick}>
									<p className="text-lg font-semibold text-gray-100">Drop your {s ? s.name : "export"} file here</p>
									<p className="text-sm text-gray-400">GoodWatch reads it on your device first.</p>
								</DropBox>
							)}
							{f.step === 1 && s?.connect && p.kind === "idle" && (
								<div className="text-center">
									<span className="inline-block scale-150">
										<SourceMark source={s} />
									</span>
									<p className="mt-6 text-gray-300">One click and your {s.name} ratings are here.</p>
								</div>
							)}
							{f.step === 1 && p.kind !== "idle" && <PosterFan f={{ ...f, imported: p.kind === "done" ? 1 : 0 }} shelf={shelf} />}
							{f.step === 2 && <RateCard r={f.r} boxFit />}
							{f.step === 3 && <PosterFan f={f} shelf={shelf} />}
						</div>
					</PosterWall>
				</div>
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// H: One card. Pill stepper; one big card over a full-height poster wall that changes inside per step. The whole
// card takes a dropped file.

function StepperPills({ f }: { f: Flow }) {
	return (
		<nav aria-label="Getting started">
			<ol className="flex flex-wrap items-center justify-center gap-2">
				{([1, 2, 3] as const).map((n, i) => {
					const on = f.step === n
					return (
						<li key={n} className="flex items-center gap-2">
							{i > 0 && <span aria-hidden className="h-px w-6 bg-slate-600" />}
							<button
								type="button"
								onClick={() => f.setStep(n)}
								aria-current={on ? "step" : undefined}
								className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold ${on ? "bg-amber-400 text-gray-950" : f.done(n) ? "bg-slate-800 text-amber-300" : "bg-slate-900/80 text-gray-400 ring-1 ring-slate-700"}`}
							>
								{f.done(n) ? <CheckIcon className="size-4" aria-hidden /> : <span className="font-black">{n}</span>}
								<span className={on ? "" : "hidden sm:inline"}>{STEP_LABELS[n - 1]}</span>
							</button>
						</li>
					)
				})}
			</ol>
		</nav>
	)
}

function VariantH({ shelf }: { shelf: ScoringMedia[] }) {
	const f = useFlow(shelf)
	const w = stepWords(f)
	const [over, setOver] = useState(false)
	return (
		<div className="pb-32 text-white">
			<PageDrop onFile={f.take} />
			<PosterWall shelf={shelf} count={60} cols="grid-cols-6 md:grid-cols-12" opacity="opacity-25">
				<div className="mx-auto flex min-h-[85vh] max-w-3xl flex-col gap-6 px-4 pb-16 pt-8 md:pt-12">
					<StepperPills f={f} />
					<div
						onDragOver={(e) => {
							e.preventDefault()
							setOver(true)
						}}
						onDragLeave={() => setOver(false)}
						onDrop={(e) => {
							e.preventDefault()
							e.stopPropagation()
							setOver(false)
							f.take(e.dataTransfer.files[0])
						}}
						className={`rounded-3xl bg-gray-950/90 p-5 text-center shadow-2xl ring-1 md:p-10 ${over ? "ring-4 ring-indigo-400" : "ring-white/10"}`}
					>
						<h1 className="text-2xl font-extrabold tracking-tight md:text-4xl">{w.title}</h1>
						<p className="mx-auto mt-2 max-w-xl text-gray-300">{w.text}</p>
						<div className="mt-6">
							{f.step === 1 && <HistoryBody f={f} shelf={shelf} bigDrop={false} />}
							{f.step === 2 && <RateBody f={f} />}
							{f.step === 3 && (
								<>
									<PosterFan f={f} shelf={shelf} />
									<ReadyActions f={f} />
								</>
							)}
						</div>
					</div>
					{f.step === 2 && (
						<div className="flex items-center justify-center gap-3 text-sm text-gray-300">
							<RatingDots at={f.liked} of={GOAL} />
							{Math.min(f.liked, GOAL)} of {GOAL} liked
						</div>
					)}
				</div>
			</PosterWall>
		</div>
	)
}

export const VARIANTS_2 = {
	D: "Round 1: checklist (side)",
	E: "Stage: dots stepper on posters",
	F: "Progress bar + big source cards",
	G: "Split: tabs + poster column",
	H: "One card on a poster wall",
} as const

export function Round2({ variant, shelf }: { variant: keyof typeof VARIANTS_2; shelf: ScoringMedia[] }) {
	if (variant === "E") return <VariantE shelf={shelf} />
	if (variant === "F") return <VariantF shelf={shelf} />
	if (variant === "G") return <VariantG shelf={shelf} />
	return <VariantH shelf={shelf} />
}
