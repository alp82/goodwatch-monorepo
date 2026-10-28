// The pieces every step of an import is drawn with: the stepper, headings, answers that lock in, the poster rows, the
// progress bar, folds, and the red problem card. Animations move transform and opacity only, so they stay at 60 fps.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import {
	ArrowLeftIcon,
	ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import {
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import type { ImportStep } from "./import-flow-model"
import { formatCount } from "./import-flow-model"

export const headingClass =
	"text-2xl font-bold tracking-tight text-white outline-none md:text-3xl"

export const backClass =
	"-ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1 self-start rounded-lg pr-2 text-sm font-semibold text-gray-300 hover:text-white disabled:cursor-default disabled:opacity-60"

/* ------------------------------------------------------------------------------------------------------------------ */
/* Headings                                                                                                           */

/**
 * A step's heading. With `focus` it takes keyboard and screen reader focus when it appears, so a member who just acted
 * lands on the new step and not on a control that is gone. Never on arrival.
 */
export function StepHeading({
	focus,
	id,
	className = headingClass,
	children,
}: { focus: boolean; id?: string; className?: string; children: ReactNode }) {
	const ref = useRef<HTMLHeadingElement>(null)
	// Focus is taken once, when the heading appears.
	useEffect(() => {
		if (focus) ref.current?.focus()
	}, [])
	return (
		<h2 ref={ref} id={id} tabIndex={-1} className={className}>
			{children}
		</h2>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Stepper: Bring → Choose → Import → Done                                                                            */

const STEPS = ["Bring", "Choose", "Import", "Done"] as const

/** Where the flow is, for the stepper on top of the page. */
export interface ImportStepState {
	step: ImportStep
	/** One short note under each step: the source, the count, the percent. */
	notes: [string, string, string, string]
	/** Done gets its tick only when nothing waits on the member. */
	allDone: boolean
	/** Going back to Bring from Choose. */
	back?: () => void
}

/** Set by the Imports page: a flow tells it where it is. Without it (the Taste start), no stepper shows. */
export const ImportStepReport = createContext<
	((state: ImportStepState | null) => void) | null
>(null)

/** A layout effect in the browser; on the server, where nothing is laid out, a plain effect that never runs. */
const useClientLayoutEffect =
	typeof document === "undefined" ? useEffect : useLayoutEffect

/** Tells the page's stepper where this flow is, while it is on screen. */
export function useReportStep(state: ImportStepState) {
	const report = useContext(ImportStepReport)
	const back = useRef(state.back)
	back.current = state.back
	const key = `${state.step}|${state.notes.join("|")}|${state.allDone}|${!!state.back}`
	// The key holds everything the stepper shows.
	useClientLayoutEffect(() => {
		report?.({
			...state,
			back: state.back ? () => back.current?.() : undefined,
		})
	}, [key, report])
	useClientLayoutEffect(() => () => report?.(null), [report])
}

export function ImportStepper({ state }: { state: ImportStepState }) {
	const { step, allDone, notes, back } = state
	return (
		<nav aria-label="Import steps" className="mx-auto w-full max-w-4xl">
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
						const canOpen = n === 1 && step === 2 && !!back
						return (
							<li
								key={label}
								className="flex flex-col items-center text-center"
								data-step={label}
								data-step-done={finished || undefined}
							>
								<button
									type="button"
									onClick={() => canOpen && back?.()}
									disabled={!canOpen}
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

/* ------------------------------------------------------------------------------------------------------------------ */
/* State names                                                                                                        */

/** Set apart only inside a question. Elsewhere a state name reads as plain text. */
const Highlight = createContext(false)
export const QuestionCopy = Highlight.Provider

/** A GoodWatch list or state name (Want to See, Seen, Not interested, Want to rewatch), set apart inside a question. */
export function ListName({ children }: { children: ReactNode }) {
	return useContext(Highlight) ? (
		<span className="font-semibold text-amber-200">{children}</span>
	) : (
		<>{children}</>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Posters                                                                                                            */

/** A title's poster for the flow's rows; the TMDB path, or null for an empty frame. */
export interface FlowPoster {
	key: string
	title: string
	posterPath: string | null
}

export function Poster({
	poster,
	className = "w-16",
}: { poster: FlowPoster; className?: string }) {
	return poster.posterPath ? (
		<img
			src={tmdbImageUrl(poster.posterPath, "w154")}
			alt=""
			loading="lazy"
			className={`aspect-[2/3] shrink-0 rounded-md bg-gray-800 object-cover ring-2 ring-gray-950 ${className}`}
		/>
	) : (
		<span
			aria-hidden
			className={`aspect-[2/3] shrink-0 rounded-md bg-gray-800 ring-2 ring-gray-950 ${className}`}
		/>
	)
}

/** A few posters, overlapping, with "+N" for the rest. */
export function PosterStack({
	posters,
	max = 8,
	more = 0,
	size = "w-12 sm:w-14",
}: { posters: FlowPoster[]; max?: number; more?: number; size?: string }) {
	const shown = posters.slice(0, max)
	const rest = more + posters.length - shown.length
	if (!shown.length) return null
	return (
		<ul className="flex items-center pl-3" aria-hidden>
			{shown.map((poster) => (
				<li key={poster.key} className="-ml-3">
					<Poster poster={poster} className={size} />
				</li>
			))}
			{rest > 0 && (
				<li
					className={`-ml-3 flex aspect-[2/3] items-center justify-center rounded-md bg-gray-800 text-sm font-bold text-gray-300 ring-2 ring-gray-950 ${size}`}
				>
					+{formatCount(rest)}
				</li>
			)}
		</ul>
	)
}

/** Titles with their names, for a question's examples. */
export function PosterRow({
	posters,
	note,
}: { posters: FlowPoster[]; note?: (poster: FlowPoster) => ReactNode }) {
	return (
		<ul className="flex flex-wrap gap-3">
			{posters.map((poster) => (
				<li key={poster.key} className="flex w-20 flex-col gap-1 sm:w-24">
					<Poster poster={poster} className="w-full" />
					<span className="line-clamp-2 text-xs text-gray-300">
						{poster.title}
					</span>
					{note && (
						<span className="text-xs tabular-nums text-gray-400">
							{note(poster)}
						</span>
					)}
				</li>
			))}
		</ul>
	)
}

const POSTER_W = { phone: 36, wide: 44 }
const OVERLAP = 8

/**
 * One row of slightly overlapping posters that light up one by one as progress grows, and dim again from the right
 * when it falls (Undo). The row fills its width when there are enough titles. Opacity and scale only; the row's height
 * is fixed, so nothing below it moves.
 */
export function PosterLights({
	posters,
	progress,
	tone = "amber",
}: { posters: FlowPoster[]; progress: number; tone?: "amber" | "red" }) {
	const row = useRef<HTMLUListElement>(null)
	const [fit, setFit] = useState(8)
	useEffect(() => {
		const el = row.current
		if (!el) return
		const measure = () => {
			const w = el.clientWidth
			if (!w) return
			const pw = w >= 400 ? POSTER_W.wide : POSTER_W.phone
			setFit(Math.max(1, Math.floor((w - pw) / (pw - OVERLAP)) + 1))
		}
		measure()
		if (typeof ResizeObserver === "undefined") return
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const shown = posters.slice(0, fit)
	return (
		<ul
			ref={row}
			className="flex h-[60px] items-center overflow-hidden pl-2 min-[400px]:h-[72px]"
			aria-hidden
			data-poster-lights
		>
			{shown.map((poster, i) => {
				const on = progress >= (i + 1) / shown.length - 0.0001
				return (
					<li
						key={poster.key}
						data-lit={on || undefined}
						className="-ml-2 shrink-0 transition-[opacity,scale] duration-500 ease-out"
						style={{ opacity: on ? 1 : 0.2, scale: on ? "1" : "0.94" }}
					>
						<Poster
							poster={poster}
							className={`w-9 min-[400px]:w-11 ${tone === "red" && !on ? "grayscale" : ""}`}
						/>
					</li>
				)
			})}
		</ul>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Small pieces                                                                                                       */

/** "312 of 1,240 matched", with the changing number in reserved space so nothing moves. */
export function MatchCount({ done, total }: { done: number; total: number }) {
	return (
		<span className="tabular-nums">
			<span
				className="inline-block text-right"
				style={{ minWidth: `${formatCount(total).length}ch` }}
			>
				{formatCount(done)}
			</span>{" "}
			of {formatCount(total)} matched
		</span>
	)
}

export function Bar({
	value,
	label,
	slim = false,
	tone = "amber",
}: { value: number; label: string; slim?: boolean; tone?: "amber" | "red" }) {
	return (
		<div
			role="progressbar"
			tabIndex={-1}
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

/** The next frame, or a frame's time later where frames aren't drawn. */
const nextFrame = (run: () => void) =>
	typeof requestAnimationFrame === "function"
		? requestAnimationFrame(run)
		: (setTimeout(run, 16) as unknown as number)
const cancelFrame = (id: number) =>
	typeof cancelAnimationFrame === "function"
		? cancelAnimationFrame(id)
		: clearTimeout(id)

/** Fades and slides its content in on mount; transform and opacity only. */
export function Slide({ dir, children }: { dir: 1 | -1; children: ReactNode }) {
	const [on, setOn] = useState(false)
	useEffect(() => {
		let b = 0
		const a = nextFrame(() => {
			b = nextFrame(() => setOn(true))
		})
		return () => {
			cancelFrame(a)
			cancelFrame(b)
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

export function Disclosure({
	label,
	open,
	onToggle,
	children,
	bordered = true,
	keepMounted = false,
}: {
	label: ReactNode
	open: boolean
	onToggle: (open: boolean) => void
	children: ReactNode
	bordered?: boolean
	/** Keep the content in the page while closed, hidden, so the server's HTML holds it too. */
	keepMounted?: boolean
}) {
	return (
		<div className={bordered ? "border-t border-white/10 pt-4" : ""}>
			<button
				type="button"
				aria-expanded={open}
				onClick={() => onToggle(!open)}
				className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 py-1 text-left font-semibold text-gray-200 hover:text-white"
			>
				{label}
				<ChevronDownIcon
					className={`size-5 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
					aria-hidden
				/>
			</button>
			{keepMounted ? (
				<div className="mt-3" hidden={!open}>
					{children}
				</div>
			) : (
				open && <div className="mt-3">{children}</div>
			)}
		</div>
	)
}

/**
 * The red card's title for a file GoodWatch can't use, from the message the browser check or the server gave:
 * too big, locked, empty, damaged, or unknown.
 */
export function fileProblemTitle(message: string, status?: number) {
	if (status === 413 || /larger than|too (big|large)/i.test(message))
		return "This file is too big"
	if (/password/i.test(message)) return "This file is locked"
	if (/\bempty\b|no rows|only (has )?(a )?header/i.test(message))
		return "This file is empty"
	if (/damaged|couldn't open|can't read|corrupt/i.test(message))
		return "This file is damaged"
	return "GoodWatch can't use this file"
}

/** The wide drop zone: drop a file or choose one. */
export const dropZoneClass = (over: boolean) =>
	`flex w-full flex-col items-center gap-4 rounded-3xl border-2 border-dashed px-4 py-10 text-center sm:px-6 md:py-12 ${over ? "border-amber-300 bg-amber-400/10" : "border-white/20 bg-gray-950/50 hover:border-white/35"}`

/** A file GoodWatch can't use, or a run that stopped: the red card. */
export function ProblemCard({
	title,
	focus,
	fileName,
	children,
}: {
	title: string
	focus: boolean
	fileName?: string
	children: ReactNode
}) {
	return (
		<section
			aria-live="assertive"
			data-problem
			className="rounded-2xl border-l-8 border-red-700 bg-red-950/70 p-5 text-red-50"
		>
			<div className="flex items-start gap-3">
				<ExclamationTriangleIcon
					className="mt-1 size-6 shrink-0 text-red-300"
					aria-hidden
				/>
				<div className="min-w-0 flex-1">
					<StepHeading
						focus={focus}
						className="text-xl font-bold text-white outline-none"
					>
						{title}
					</StepHeading>
					{fileName && (
						<p className="mt-1 break-all text-sm text-red-200/80">{fileName}</p>
					)}
					<div className="mt-3 flex flex-col gap-3">{children}</div>
				</div>
			</div>
		</section>
	)
}

/* ------------------------------------------------------------------------------------------------------------------ */
/* Answers: nothing is picked until the member picks                                                                  */

/** How long a picked answer stays on screen before the next screen slides in. */
export const ANSWER_LOCK_MS = 700

/** The answer that just locked in, and moving on after it. Back or leaving cancels the pending move. */
export function useLockIn() {
	const [locking, setLocking] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => () => clearTimeout(timer.current), [])
	return {
		locking,
		lock: (key: string, then: () => void) => {
			clearTimeout(timer.current)
			setLocking(key)
			timer.current = setTimeout(() => {
				setLocking(null)
				then()
			}, ANSWER_LOCK_MS)
		},
		cancel: () => {
			clearTimeout(timer.current)
			setLocking(null)
		},
	}
}

export function Answer({
	selected,
	recommended = false,
	onClick,
	title,
	note,
	disabled,
	describedBy,
}: {
	selected: boolean
	recommended?: boolean
	onClick: () => void
	title: ReactNode
	note?: ReactNode
	disabled?: boolean
	describedBy?: string
}) {
	return (
		<button
			type="button"
			aria-pressed={selected}
			onClick={onClick}
			disabled={disabled}
			aria-describedby={describedBy}
			data-answer
			data-suggested={recommended || undefined}
			className={`flex min-h-16 w-full cursor-pointer items-center gap-4 rounded-2xl border-2 px-4 py-3 text-left transition-[transform,opacity] duration-200 ease-out active:scale-[0.98] disabled:cursor-default sm:px-5 ${selected ? "border-amber-400 bg-amber-400/15 group-data-locked/answers:scale-[1.03] group-data-locked/answers:bg-amber-400/25" : "border-slate-700 bg-slate-900/60 hover:border-slate-500 group-data-locked/answers:opacity-40 disabled:opacity-60"}`}
		>
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

/** One question on its own screen: the counter, Back, the fact and the yes/no question, then the answers. */
export function QuestionScreen({
	number,
	of,
	focus,
	onBack,
	title,
	body,
	locked,
	answers,
	after,
}: {
	number: number
	of: number
	focus: boolean
	onBack?: () => void
	title: ReactNode
	body?: ReactNode
	/** The answer just locked in: the pick lights up, the rest fade, buttons wait. */
	locked: boolean
	answers: ReactNode
	after?: ReactNode
}) {
	return (
		<section className="flex flex-col gap-6" data-question>
			<div className="flex min-h-11 items-center justify-between gap-3 text-sm">
				{onBack ? (
					<button type="button" onClick={onBack} className={backClass}>
						<BackArrow />
						Back
					</button>
				) : (
					<span />
				)}
				<span className="tabular-nums text-gray-400" data-question-counter>
					Question {number} of {of}
				</span>
			</div>
			<QuestionCopy value>
				<StepHeading focus={focus}>{title}</StepHeading>
				{body}
				<fieldset
					disabled={locked}
					data-locked={locked || undefined}
					className="group/answers flex flex-col gap-3"
				>
					<legend className="sr-only">Your answer</legend>
					{answers}
				</fieldset>
			</QuestionCopy>
			{after}
		</section>
	)
}

export function BackArrow() {
	return <ArrowLeftIcon className="size-5" aria-hidden />
}
