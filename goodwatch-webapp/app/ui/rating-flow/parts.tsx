// The rating flow's pieces: the title asked about, the two marks, the top strip's dots, the taste bar, picks, Your
// ratings, and a guest's Save your taste. Motion is transform and opacity only (main.css, score-ack-*).
import {
	ChevronRightIcon,
	EyeSlashIcon,
	FingerPrintIcon,
	NoSymbolIcon,
	UserPlusIcon,
} from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import { MILESTONE_EVERY, MIN_LIKED } from "~/domain/taste-rules"
import type { Score } from "~/server/scores.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import type { ScoringMedia } from "~/ui/scoring/types"
import type { QuizPick } from "~/ui/taste-quiz/use-quiz-picks"
import { useAuthHref } from "~/utils/auth-href"
import { mediaFieldLanguage } from "~/utils/media-presentation"
import { getVibeColorValue } from "~/utils/ratings"
import type { SizeRule } from "~/utils/tmdb-image"
import {
	type Milestone,
	type NextStep,
	TASTE_VIEW_PATH,
	type Tally,
	nextStepWords,
	tasteBarWords,
} from "./flow"
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

/** The two marks: one about asking, one about recommending. Each its own icon, color and hint. */
export function Marks({
	onUnseen,
	onNotInterested,
	disabled,
}: {
	onUnseen: () => void
	onNotInterested: () => void
	disabled?: boolean
}) {
	return (
		<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
			<MarkButton
				onClick={onUnseen}
				disabled={disabled}
				icon={
					<EyeSlashIcon className="size-5 shrink-0 text-gray-300" aria-hidden />
				}
				label={WORDS.unseen}
				hint={WORDS.unseenHint}
				shortcut="H"
			/>
			<MarkButton
				onClick={onNotInterested}
				disabled={disabled}
				icon={
					<NoSymbolIcon className="size-5 shrink-0 text-pink-300" aria-hidden />
				}
				label={WORDS.notInterested}
				hint={WORDS.notInterestedHint}
				shortcut="N"
			/>
		</div>
	)
}

function MarkButton({
	onClick,
	disabled,
	icon,
	label,
	hint,
	shortcut,
}: {
	onClick: () => void
	disabled?: boolean
	icon: ReactNode
	label: string
	hint: string
	shortcut: string
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-keyshortcuts={shortcut}
			className="flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border-2 border-gray-700 px-3 py-2 text-left hover:border-gray-500 disabled:cursor-wait disabled:opacity-60 md:min-h-10"
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
	const fullOf = landed?.kind === "ready" ? MIN_LIKED : MILESTONE_EVERY
	const said = nextStepWords(step)
	return (
		<div
			key={showFull ? `full-${wave}` : `step-${wave}`}
			className={`${showFull || wave > 0 ? "score-ack-enter" : ""} flex min-h-6 items-center gap-x-3`}
		>
			<span aria-hidden className="flex">
				<RatingDots
					at={showFull ? fullOf : step.done}
					of={showFull ? fullOf : step.of}
				/>
			</span>
			<span
				className={`text-sm font-semibold text-gray-200 ${showFull ? "opacity-0" : ""}`}
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

const PICK_SIZES: SizeRule[] = [
	["(min-width: 768px)", "160px"],
	[null, "30vw"],
]

/** Recommendations: the site's poster card, with the match under it. Never a title the person answered. */
export function PicksGrid({ picks }: { picks: QuizPick[] }) {
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
