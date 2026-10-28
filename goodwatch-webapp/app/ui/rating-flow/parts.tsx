// The rating flow's pieces: the title asked about, the two marks and the Want to See question they turn into, the top
// row (the next step's dots, the last answers), the taste bar and a guest's sign-up line under it, the locked panel,
// picks, Your ratings, and a guest's Save your taste. Motion is transform and opacity only (main.css, score-ack-* and
// want-*).
import {
	ArrowLeftIcon,
	BookmarkIcon,
	ChevronRightIcon,
	EyeSlashIcon,
	FingerPrintIcon,
	NoSymbolIcon,
	UserPlusIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import {
	type ComponentPropsWithoutRef,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react"
import type { Score } from "~/server/scores.server"
import { GoogleMark } from "~/ui/brand/GoogleMark"
import { MovieTvCard } from "~/ui/MovieTvCard"
import type { ScoringMedia } from "~/ui/scoring/types"
import type { TasteInteraction } from "~/ui/taste/types"
import type { FlowPick } from "./use-picks"
import { useAuthHref } from "~/utils/auth-href"
import { useContinueWithGoogle } from "~/utils/auth-client"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { getVibeColorValue } from "~/utils/ratings"
import type { SizeRule } from "~/utils/tmdb-image"
import {
	FLOW_PATH,
	type Milestone,
	type NextStep,
	TASTE_VIEW_PATH,
	type Tally,
	answerWords,
	nextStepWords,
	takesWantPress,
	tasteBarWords,
} from "./flow"
import type { AnsweredTitle } from "./use-rating-core"
import { RatingDots } from "./RatingDots"
import { WORDS } from "./words"

export const ghostButton =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-gray-700 px-5 font-semibold text-gray-200 hover:border-gray-500 md:min-h-10"
export const quietButton =
	"inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-3 text-sm font-semibold text-gray-400 hover:text-gray-200 md:min-h-10"

export const image = (path: string | undefined | null, size: string) =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined

const kindWord = (t: { media_type: string }) =>
	t.media_type === "show" ? "Show" : "Movie"

/** The title asked about, always with its year, so "The Office" (2005) never reads as the 2001 one. */
export function TitleLine({ t }: { t: ScoringMedia }) {
	return (
		<div className="min-w-0">
			<h2 className="text-2xl font-extrabold leading-tight text-white md:text-3xl">
				<span lang={mediaFieldLanguage(t)}>{t.title}</span>
				{t.release_year && (
					<span className="font-semibold text-gray-400">
						{" "}
						({t.release_year})
					</span>
				)}
			</h2>
			<div className="mt-1 text-sm text-gray-400">
				{[kindWord(t), t.genres?.slice(0, 3).join(", ")]
					.filter(Boolean)
					.join(" · ")}
			</div>
		</div>
	)
}

/**
 * The two marks: one about asking, one about recommending. Each its own icon, color and hint. After "Haven't seen it"
 * (`asking`) they turn into the Want to See question in exactly their box, so nothing else moves: the left half asks
 * "Want to see it?" and goes back to the marks when pressed (nothing saved), the right half answers No (Haven't seen
 * it) or Yes, add (Haven't seen it with Want to See). No timer. Presses in its first moment and a double click's
 * second click don't count (flow.ts, `takesWantPress`); the keys are the page's (RatingFlow.tsx).
 */
export function Marks({
	onUnseen,
	onNotInterested,
	disabled,
	asking = false,
	onWant,
	onNo,
	onBack,
}: {
	onUnseen: () => void
	onNotInterested: () => void
	disabled?: boolean
	/** The Want to See question is up. */
	asking?: boolean
	onWant?: () => void
	onNo?: () => void
	onBack?: () => void
}) {
	const box = useRef<HTMLDivElement>(null)
	const shownAt = useRef(0)
	useEffect(() => {
		shownAt.current = asking ? performance.now() : 0
		// The focus follows the press that changed the box: to No (the safe answer) when the question comes, back to
		// Haven't seen it when it goes. Only when it was in the box, so a key press elsewhere keeps its place.
		const el = box.current
		if (!el || !el.contains(document.activeElement)) return
		el.querySelector<HTMLElement>(
			asking ? "[data-want-no]" : "[data-mark-unseen]",
		)?.focus()
	}, [asking])
	const guard = (fn?: () => void) => (e: ReactMouseEvent) => {
		if (takesWantPress(shownAt.current, performance.now(), e.detail)) fn?.()
	}
	const off = asking ? { inert: "" } : {}
	return (
		<div
			ref={box}
			data-asking={asking || undefined}
			className="want relative grid grid-cols-2 gap-2 sm:w-fit sm:gap-3"
		>
			<div className="want-mark want-mark-l grid" {...off}>
				<MarkButton
					onClick={onUnseen}
					disabled={disabled}
					icon={
						<EyeSlashIcon
							className="size-5 shrink-0 text-gray-300"
							aria-hidden
						/>
					}
					label={WORDS.unseen}
					hint={WORDS.unseenHint}
					shortcut="H"
					data-mark-unseen
				/>
			</div>
			<div className="want-mark want-mark-r grid" {...off}>
				<MarkButton
					onClick={onNotInterested}
					disabled={disabled}
					icon={
						<NoSymbolIcon
							className="size-5 shrink-0 text-pink-300"
							aria-hidden
						/>
					}
					label={WORDS.notInterested}
					hint={WORDS.notInterestedHint}
					shortcut="N"
				/>
			</div>
			{onWant && (
				// biome-ignore lint/a11y/useSemanticElements: one joined control in the marks' box; a fieldset adds nothing here
				<div
					role="group"
					aria-label={WORDS.wantAsk}
					className={`want-shell absolute inset-0 flex select-none overflow-hidden rounded-xl border-2 border-gray-700 bg-gray-900 ${asking ? "" : "pointer-events-none"}`}
					{...(asking ? {} : { inert: "" })}
				>
					<button
						type="button"
						onClick={guard(onBack)}
						disabled={disabled}
						aria-label={`${WORDS.wantAsk} ${WORDS.wantBack}`}
						aria-keyshortcuts="Escape Backspace"
						className="want-btn flex min-w-0 basis-1/2 cursor-pointer items-center gap-2 px-3 text-left hover:bg-white/5 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-amber-300 active:bg-white/10"
					>
						<span className="want-c flex min-w-0 flex-1 items-center gap-2">
							<ArrowLeftIcon
								className="size-5 shrink-0 text-gray-400"
								aria-hidden
							/>
							<span className="text-sm font-bold text-gray-100">
								{WORDS.wantAsk}
							</span>
							<KeyHint k="Esc" />
						</span>
					</button>
					<span aria-hidden className="want-div w-0.5 shrink-0 bg-gray-700" />
					<div className="flex min-w-0 basis-1/2">
						<WantAnswer
							kind="no"
							data-want-no
							onClick={guard(onNo)}
							disabled={disabled}
							aria-keyshortcuts="N"
							className="flex-1 gap-1.5 px-2 text-sm"
						>
							<EyeSlashIcon className="size-4 shrink-0" aria-hidden />
							{WORDS.wantNo}
							<KeyHint k="N" />
						</WantAnswer>
						<span aria-hidden className="want-div w-0.5 shrink-0 bg-gray-700" />
						<WantAnswer
							kind="yes"
							onClick={guard(onWant)}
							disabled={disabled}
							aria-keyshortcuts="Y W"
							className="flex-[1.7] gap-1.5 px-2 text-sm"
						>
							<BookmarkIcon className="size-4 shrink-0" aria-hidden />
							{WORDS.wantYes}
							<KeyHint k="Y" />
						</WantAnswer>
					</div>
				</div>
			)}
		</div>
	)
}

// The Want to See answers: quiet at rest (No a faint slate with slate words and the eye-slash, Yes, add a faint amber with amber words), the clear color on
// hover, keyboard focus and press. A touch keeps the clear color a moment after the finger lifts, so the tap shows
// (data-flash). The clear color is its own layer that fades in (opacity), the words change color: nothing moves.
const WANT_ANSWER = {
	no: {
		btn: "text-slate-300 hover:text-gray-950 focus-visible:text-gray-950 active:text-gray-950 data-flash:text-gray-950 focus-visible:outline-gray-950",
		rest: "bg-slate-400/15",
		hot: "bg-slate-400 group-hover:bg-slate-300 group-active:bg-slate-500",
	},
	yes: {
		btn: "text-amber-300 hover:text-gray-950 focus-visible:text-gray-950 active:text-gray-950 data-flash:text-gray-950 focus-visible:outline-gray-950",
		rest: "bg-amber-500/15",
		hot: "bg-amber-500 group-hover:bg-amber-400 group-active:bg-amber-600",
	},
} as const
const FLASH_MS = 320

/**
 * One answer of the Want to See question (the flow's Marks and Quick list's rows share it). `kind` sets the colors; the
 * size and spacing come from `className`. Inside `.want` its fill sweeps in with the question (main.css, want-fill).
 */
export function WantAnswer({
	kind,
	className = "",
	children,
	onPointerUp,
	...rest
}: { kind: "no" | "yes"; children: ReactNode } & ComponentPropsWithoutRef<"button">) {
	const c = WANT_ANSWER[kind]
	return (
		<button
			type="button"
			{...rest}
			onPointerUp={(e) => {
				onPointerUp?.(e)
				if (e.pointerType === "mouse") return
				const el = e.currentTarget
				el.setAttribute("data-flash", "")
				window.setTimeout(() => el.removeAttribute("data-flash"), FLASH_MS)
			}}
			className={`want-btn group relative isolate flex min-w-0 cursor-pointer items-center justify-center font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-4 ${c.btn} ${className}`}
		>
			<span aria-hidden className={`want-fill absolute inset-0 -z-20 ${c.rest}`} />
			<span
				aria-hidden
				className={`absolute inset-0 -z-10 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 group-active:duration-0 group-data-flash:opacity-100 ${c.hot}`}
			/>
			<span className="want-c inline-flex min-w-0 items-center gap-[inherit]">{children}</span>
		</button>
	)
}

/** A key's name beside its button, on screens with a keyboard. */
function KeyHint({ k }: { k: string }) {
	return (
		<kbd
			aria-hidden
			className="hidden rounded border border-current/30 px-1 font-sans text-[10px] font-normal leading-4 opacity-70 md:inline"
		>
			{k}
		</kbd>
	)
}

function MarkButton({
	onClick,
	disabled,
	icon,
	label,
	hint,
	shortcut,
	...data
}: {
	onClick: () => void
	disabled?: boolean
	icon: ReactNode
	label: string
	hint: string
	shortcut: string
	"data-mark-unseen"?: boolean
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-keyshortcuts={shortcut}
			className="flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border-2 border-gray-700 px-3 py-2 text-left hover:border-gray-500 disabled:cursor-wait disabled:opacity-60 md:min-h-10"
			{...data}
		>
			<span className="mt-px">{icon}</span>
			<span className="min-w-0">
				<span className="block text-sm font-bold text-gray-100">{label}</span>
				<span className="block text-xs leading-snug text-gray-400">{hint}</span>
			</span>
		</button>
	)
}

/** How long the full dots of a milestone stay before they reset. */
const FULL_MS = 1100

/**
 * The top strip: dots toward the next milestone (liked titles to the taste, then ratings to new picks) and the same
 * in words. When a milestone lands on the latest rating the dots show full for a moment, then rise in again from the
 * reset count. Opacity and transform only.
 */
export function NextStepDots({
	step,
	landed,
}: { step: NextStep; landed: Milestone | null }) {
	const [full, setFull] = useState<number | null>(null)
	// Bumped each time the full dots give way to the reset ones, so only that change rises in.
	const [wave, setWave] = useState(0)
	const at = landed?.rated ?? null
	useEffect(() => {
		if (at == null) return
		setFull(at)
		const id = setTimeout(() => {
			setFull(null)
			setWave((w) => w + 1)
		}, FULL_MS)
		return () => clearTimeout(id)
	}, [at])
	const showFull = landed != null && full === landed.rated
	const fullOf = landed?.of ?? 0
	const said = nextStepWords(step)
	const dots = showFull ? fullOf : step.of
	return (
		<div
			key={showFull ? `full-${wave}` : `step-${wave}`}
			className={`${showFull || wave > 0 ? "score-ack-enter" : ""} flex min-h-6 min-w-0 items-center gap-x-3`}
		>
			{dots > 0 && (
				<span aria-hidden className="flex shrink-0">
					<RatingDots at={showFull ? fullOf : step.done} of={dots} />
				</span>
			)}
			<span
				className={`min-w-0 truncate text-xs font-semibold text-gray-200 min-[420px]:text-sm ${showFull ? "opacity-0" : ""}`}
			>
				{said}
			</span>
		</div>
	)
}

/**
 * The taste bar under the score control: the person's totals, and as a whole one button to the taste view. At a
 * milestone it turns amber (the amber of the site's primary buttons) with one rise-in, and stays so for a few ratings
 * or until it is opened.
 */
export function TasteBar({
	tally,
	lit,
	onOpen,
}: { tally: Tally; lit: Milestone | null; onOpen: () => void }) {
	const on = lit != null
	const { head, line } = tasteBarWords(tally, lit)
	return (
		<>
			<button
				type="button"
				onClick={onOpen}
				className="group relative isolate block w-full cursor-pointer overflow-hidden rounded-2xl bg-white/[0.03] text-left ring-1 ring-white/10 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
			>
				<span
					aria-hidden
					className={`absolute inset-0 -z-10 rounded-2xl bg-linear-to-r from-amber-400/25 via-amber-400/10 to-amber-400/[0.04] ring-1 ring-amber-400/50 ring-inset transition-opacity duration-500 ${on ? "opacity-100" : "opacity-0"}`}
				/>
				<span
					key={lit ? `lit-${lit.rated}` : "calm"}
					className={`flex min-h-16 items-center gap-3 px-3 py-2.5 sm:px-4 ${lit ? "score-ack-enter" : ""}`}
				>
					<span
						className={`${on ? "bg-linear-to-b from-amber-400 to-amber-600 text-gray-950" : "bg-white/[0.06] text-gray-400"} flex size-10 shrink-0 items-center justify-center rounded-full`}
					>
						<FingerPrintIcon className="size-5" aria-hidden />
					</span>
					<span className="min-w-0 flex-1">
						<span
							className={`block text-sm font-extrabold sm:text-base ${on ? "text-amber-100" : "text-gray-100"}`}
						>
							{head}
						</span>
						<span
							className={`mt-0.5 block truncate text-xs ${on ? "text-amber-200/80" : "text-gray-400"}`}
						>
							{line}
						</span>
					</span>
					<span
						className={`inline-flex shrink-0 items-center gap-1 text-sm ${on ? "font-black text-amber-200" : "font-semibold text-gray-300 group-hover:text-white"}`}
					>
						<span className="hidden sm:inline">{WORDS.seeTaste}</span>
						<ChevronRightIcon
							className="size-5 transition-transform group-hover:translate-x-0.5"
							aria-hidden
						/>
					</span>
				</span>
			</button>
			{/* Announces a milestone once; outside the button, so its name isn't read twice. */}
			<span className="sr-only" aria-live="polite">
				{on ? head : ""}
			</span>
		</>
	)
}

/**
 * The top row: the next step's dots and words on the left, the last answers on the right as small posters with the
 * answer's badge (two under 420 px), one row that never wraps. A poster opens its title again to change or clear the
 * answer.
 */
export function TopRow({
	left,
	recent,
	openKey,
	onOpen,
}: {
	left: ReactNode
	recent: AnsweredTitle[]
	/** The title opened again, outlined. */
	openKey: string | null
	onOpen: (key: string) => void
}) {
	return (
		<div className="flex min-h-12 items-center justify-between gap-3">
			<div className="min-w-0">{left}</div>
			{recent.length > 0 && (
				<ul
					aria-label={WORDS.lastAnswered}
					className="flex shrink-0 items-center gap-2"
				>
					{recent.map((r, n) => (
						<li key={r.key} className={n === 2 ? "max-[419px]:hidden" : ""}>
							<button
								type="button"
								onClick={() => onOpen(r.key)}
								aria-label={`${r.title.title}: ${answerWords(r.answer)}. ${WORDS.changeIt}`}
								aria-pressed={openKey === r.key}
								className={`relative block h-11 w-[1.875rem] cursor-pointer rounded-[5px] ring-2 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none ${openKey === r.key ? "ring-amber-400" : "ring-gray-800"}`}
							>
								{r.title.poster_path ? (
									<img
										src={image(r.title.poster_path, "w92")}
										alt=""
										className="h-full w-full rounded-[inherit] object-cover"
									/>
								) : (
									<span className="block h-full w-full rounded-[inherit] bg-gray-800" />
								)}
								<AnswerBadge answer={r.answer} />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

/** The answer on a top row poster: the score, or the mark's icon. */
function AnswerBadge({ answer }: { answer: TasteInteraction }) {
	const base =
		"absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-[5px] text-[10px] font-black leading-none ring-2 ring-gray-950"
	if (answer.type === "score")
		return (
			<span className={`${base} bg-amber-400 tabular-nums text-gray-950`}>
				{answer.score}
			</span>
		)
	const [Icon, tint] =
		answer.type === "skip"
			? [EyeSlashIcon, "text-gray-200"]
			: answer.type === "plan"
				? [BookmarkIcon, "text-amber-300"]
				: [NoSymbolIcon, "text-pink-300"]
	return (
		<span className={`${base} bg-gray-700`}>
			<Icon className={`size-2.5 ${tint}`} aria-hidden />
		</span>
	)
}

/** A title opened again from the top row: its answer, and the ways out. */
export function ReopenedNote({
	answer,
	clearing,
	onClear,
	onClose,
}: {
	answer: TasteInteraction | null
	clearing: boolean
	onClear: () => void
	onClose: () => void
}) {
	const link =
		"inline-flex min-h-11 cursor-pointer items-center font-semibold underline-offset-2 hover:underline disabled:cursor-wait disabled:opacity-60 md:min-h-8"
	return (
		<div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
			<span className="text-gray-300">
				{answer ? (
					<>
						{WORDS.yourAnswer}{" "}
						<strong className="text-white">{answerWords(answer)}</strong>
					</>
				) : (
					WORDS.noAnswer
				)}
			</span>
			{answer && (
				<button
					type="button"
					onClick={onClear}
					disabled={clearing}
					className={`${link} text-gray-400 hover:text-white`}
				>
					{WORDS.clearIt}
				</button>
			)}
			<button
				type="button"
				onClick={onClose}
				className={`${link} text-amber-300`}
			>
				{WORDS.backToNew}
			</button>
		</div>
	)
}

/** A guest's quiet sign-up line under the taste bar, from a few ratings on: keep them, back to the taste view. */
export function SignUpLine({ rated }: { rated: number }) {
	const authHref = useAuthHref()
	return (
		<p className="mt-2 px-1 text-xs text-gray-400">
			{WORDS.signUpLine(rated)}{" "}
			<Link
				rel="nofollow"
				to={authHref("sign-up", TASTE_VIEW_PATH)}
				data-cta="sign-up"
				className="font-semibold text-amber-300 underline-offset-2 hover:underline"
			>
				{WORDS.signUpLineLink}
			</Link>
		</p>
	)
}

/**
 * A guest at the limit (~/domain/taste-rules): in place of the score control, calm, with sign-up. The marks, the taste
 * view and the picks stay. Sign-up returns to the flow, and the guest's ratings move to the account.
 */
export function LockedPanel({ rated }: { rated: number }) {
	const authHref = useAuthHref()
	const google = useContinueWithGoogle()
	return (
		<div className="score-ack-enter rounded-2xl bg-white/[0.03] px-4 py-4 ring-1 ring-white/10 sm:px-5">
			<p className="text-base font-extrabold text-white">
				{WORDS.lockedHead(rated)}
			</p>
			<p className="mt-1 text-sm leading-snug text-gray-300">
				{WORDS.lockedLine}
			</p>
			<div className="mt-4 flex flex-wrap items-center gap-2">
				<Link
					rel="nofollow"
					to={authHref("sign-up", FLOW_PATH)}
					data-cta="sign-up"
					className="inline-flex min-h-11 items-center gap-2 rounded-full bg-linear-to-b from-amber-400 to-amber-600 px-5 text-sm font-black text-gray-950 hover:brightness-110"
				>
					<UserPlusIcon className="size-4" aria-hidden />
					{WORDS.signUpFree}
				</Link>
				<button
					type="button"
					onClick={() => google(FLOW_PATH)}
					className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-gray-100 px-4 text-sm font-bold text-gray-900 ring-2 ring-inset ring-gray-400 hover:bg-white"
				>
					<GoogleMark size={16} /> {WORDS.continueWithGoogle}
				</button>
			</div>
			<Link
				rel="nofollow"
				to={authHref("sign-in", FLOW_PATH)}
				className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-gray-400 hover:text-gray-200 md:min-h-9"
			>
				{WORDS.haveAccount}
			</Link>
		</div>
	)
}

const PICK_SIZES: SizeRule[] = [
	["(min-width: 768px)", "160px"],
	[null, "30vw"],
]

/** Recommendations: the site's poster card, with the match under it. Never a title the person answered. */
export function PicksGrid({ picks }: { picks: FlowPick[] }) {
	return (
		<div className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-6">
			{picks.map((p) => (
				<div
					key={`${p.media_type}-${p.tmdb_id}`}
					className="flex min-w-0 flex-col gap-1"
				>
					<MovieTvCard
						details={p}
						mediaType={p.media_type}
						posterSizes={PICK_SIZES}
					/>
					{p.match_percentage > 0 && (
						<p className="text-center text-xs font-bold text-amber-200">
							{Math.round(p.match_percentage)}% match
						</p>
					)}
				</div>
			))}
		</div>
	)
}

export function PicksLoading() {
	return (
		<div
			className="grid grid-cols-3 gap-2 sm:gap-3 md:grid-cols-6"
			aria-busy="true"
		>
			{[0, 1, 2, 3, 4, 5].map((i) => (
				<div
					key={i}
					className={`aspect-[2/3] animate-pulse rounded-lg bg-gray-800/60 ${i > 2 ? "hidden md:block" : ""}`}
				/>
			))}
		</div>
	)
}

/** The score as a colored square, the way a score reads in a list (not a poster pill). */
export function ScoreSquare({ score }: { score: Score }) {
	return (
		<span
			className="flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-black tabular-nums text-white"
			style={{
				background: `color-mix(in srgb, ${getVibeColorValue(score)} 55%, #181b20)`,
			}}
		>
			<span className="sr-only">Your score </span>
			{score}
		</span>
	)
}

/** A section heading inside the taste view. */
export function Label({
	children,
	line,
}: { children: ReactNode; line?: ReactNode }) {
	return (
		<div>
			<h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
				{children}
			</h2>
			{line && <p className="mt-0.5 text-sm text-gray-500">{line}</p>}
		</div>
	)
}

/** A guest's ask to keep the taste: sign-up, and back to this taste view after it. */
export function SaveTaste() {
	const authHref = useAuthHref()
	return (
		<Link
			rel="nofollow"
			to={authHref("sign-up", TASTE_VIEW_PATH)}
			data-cta="sign-up"
			className="inline-flex min-h-12 items-center gap-2.5 rounded-full bg-linear-to-b from-amber-400 to-amber-600 py-1.5 pr-6 pl-4 text-gray-950 hover:brightness-110"
		>
			<UserPlusIcon className="size-5 shrink-0" aria-hidden />
			<span className="flex flex-col text-left leading-tight">
				<span className="text-[10px] font-bold uppercase tracking-wider text-gray-950/70">
					{WORDS.signUpFree}
				</span>
				<span className="text-[15px] font-black">{WORDS.saveTaste}</span>
			</span>
		</Link>
	)
}
