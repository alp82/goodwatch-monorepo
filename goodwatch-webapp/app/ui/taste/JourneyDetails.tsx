// Development-only bridge into the real details page, using the preview's isolated guest store.
import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react"
import { Link, useSearchParams } from "@remix-run/react"
import {
	BookmarkIcon,
	CheckIcon,
	ForwardIcon,
	StarIcon,
} from "@heroicons/react/24/outline"
import type { MovieResult, ShowResult } from "~/server/types/details-types"
import type { Score } from "~/server/scores.server"
import type { ScoringMedia } from "~/ui/scoring/types"
import { getScoreBgClass } from "~/utils/ratings"
import { useTasteScoring } from "./hooks/useTasteScoring"
import {
	journeyTasteHref,
	journeyTitleHref,
	readJourney,
	rememberJourney,
	type JourneySession,
} from "./journey-session"

type JourneyDetailsState = ReturnType<typeof useTasteScoring> & {
	media: ScoringMedia
	origin: JourneySession
	limitReached: boolean
	rate: (score: Score) => void
}
const Context = createContext<JourneyDetailsState | null>(null)
export const useJourneyDetails = () => useContext(Context)

export function JourneyDetailsBoundary({
	media,
	children,
}: { media: MovieResult | ShowResult; children: ReactNode }) {
	const [params] = useSearchParams()
	if (
		process.env.NODE_ENV === "production" ||
		params.get("prototype") !== "journey"
	)
		return <>{children}</>
	return (
		<JourneyDetailsProvider media={media}>{children}</JourneyDetailsProvider>
	)
}
function JourneyDetailsProvider({
	media: result,
	children,
}: { media: MovieResult | ShowResult; children: ReactNode }) {
	const scoring = useTasteScoring({ isAuthenticated: false, prototype: true })
	const [origin, setOrigin] = useState<JourneySession>({})
	const [limitReached, setLimitReached] = useState(false)
	useEffect(() => setOrigin(readJourney()), [])
	useEffect(
		() => setLimitReached(false),
		[result.details.tmdb_id, result.mediaType],
	)
	const media: ScoringMedia = {
		tmdb_id: result.details.tmdb_id,
		media_type: result.mediaType,
		title: result.details.title,
		poster_path: result.details.poster_path || "",
		release_year: String(result.details.release_year || ""),
		backdrop_path: result.details.backdrop_path || undefined,
		genres: result.details.genres,
	}
	function rate(score: Score) {
		const existing = scoring.interactions.find(
			(i) => i.tmdb_id === media.tmdb_id && i.media_type === media.media_type,
		)
		if (scoring.ratingsCount >= 20 && existing?.type !== "score") {
			setLimitReached(true)
			return
		}
		setLimitReached(false)
		scoring.addScore(media, score)
	}
	return (
		<Context.Provider value={{ ...scoring, media, origin, rate, limitReached }}>
			{children}
		</Context.Provider>
	)
}

export function JourneyContinuation() {
	const journey = useJourneyDetails()
	if (!journey) return null
	const { origin, media, interactions } = journey
	const originLabel =
		origin.view === "rate"
			? "your rating card"
			: origin.view === "wishlist"
				? "your Wishlist"
				: "your Taste picks"
	const picks = origin.picks || []
	const index = picks.findIndex(
		(item) =>
			item.tmdb_id === media.tmdb_id && item.media_type === media.media_type,
	)
	const next = [
		...picks.slice(index + 1),
		...picks.slice(0, Math.max(0, index)),
	].find(
		(item) =>
			!(
				item.tmdb_id === media.tmdb_id && item.media_type === media.media_type
			) &&
			!interactions.some(
				(i) => i.tmdb_id === item.tmdb_id && i.media_type === item.media_type,
			),
	)
	const wishlistCount = interactions.filter((i) => i.type === "plan").length
	return (
		<nav
			aria-label="Continue your Taste journey"
			className="border-b border-cyan-400/20 bg-gray-900"
		>
			<div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm">
				<Link
					to={journeyTasteHref(origin.view)}
					preventScrollReset
					className="font-semibold text-cyan-300 hover:text-cyan-200"
				>
					← Back to {originLabel}
				</Link>
				<div className="flex items-center gap-4">
					<Link
						to={journeyTasteHref("wishlist")}
						onClick={() => rememberJourney({ view: "wishlist", scrollY: 0 })}
						className="text-gray-300 hover:text-white"
					>
						Wishlist{wishlistCount ? ` · ${wishlistCount}` : ""}
					</Link>
					{next && (
						<Link
							to={journeyTitleHref(next)}
							aria-label={`Next pick → ${next.title}`}
							className="text-cyan-300 hover:text-cyan-200"
						>
							Next pick →
						</Link>
					)}
				</div>
			</div>
		</nav>
	)
}

export function JourneyDetailActions() {
	const journey = useJourneyDetails()
	const [showScore, setShowScore] = useState(false)
	if (!journey) return null
	const interaction = journey.interactions.find(
		(i) =>
			i.tmdb_id === journey.media.tmdb_id &&
			i.media_type === journey.media.media_type,
	)
	const button =
		"flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-white hover:opacity-80"
	return (
		<div className="w-full">
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					aria-pressed={interaction?.type === "plan"}
					onClick={() => journey.addPlanToWatch(journey.media)}
					className={`${button} ${interaction?.type === "plan" ? "bg-amber-800" : "bg-zinc-700"}`}
				>
					{interaction?.type === "plan" ? (
						<CheckIcon className="h-4 w-4" />
					) : (
						<BookmarkIcon className="h-4 w-4" />
					)}
					{interaction?.type === "plan" ? "In your Wishlist" : "Want to See"}
				</button>
				<button
					type="button"
					aria-expanded={showScore}
					onClick={() => setShowScore((value) => !value)}
					className={`${button} ${interaction?.type === "score" ? "bg-green-800" : "bg-zinc-700"}`}
				>
					<StarIcon className="h-4 w-4" />
					{interaction?.type === "score"
						? `Your rating: ${interaction.score}/10`
						: "Rate this title"}
				</button>
				<button
					type="button"
					aria-pressed={interaction?.type === "skip"}
					onClick={() => journey.addSkip(journey.media)}
					className={`${button} bg-zinc-700`}
				>
					<ForwardIcon className="h-4 w-4" />
					{interaction?.type === "skip" ? "Skipped" : "Skip"}
				</button>
			</div>
			{showScore && (
				<div className="mt-4">
					<JourneyDetailScore />
				</div>
			)}
			{interaction && (
				<p role="status" className="mt-3 text-center text-sm text-gray-300">
					{interaction.type === "plan"
						? "In your Wishlist"
						: interaction.type === "score"
							? `Rated ${interaction.score}/10`
							: "Skipped"}{" "}
					· Updated in your Taste journey
				</p>
			)}
		</div>
	)
}
export function JourneyDetailScore({
	onCancel,
}: { media?: MovieResult | ShowResult; onCancel?: () => void }) {
	const journey = useJourneyDetails()
	if (!journey) return null
	const current = journey.interactions.find(
		(i) =>
			i.tmdb_id === journey.media.tmdb_id &&
			i.media_type === journey.media.media_type &&
			i.type === "score",
	)?.score
	return (
		<div>
			<p className="mb-2 text-sm text-gray-300">How much did you enjoy it?</p>
			<div className="flex overflow-hidden rounded-lg">
				{Array.from({ length: 10 }, (_, index) => (index + 1) as Score).map(
					(score) => (
						<button
							type="button"
							key={score}
							aria-label={`Rate ${score} out of 10`}
							aria-pressed={current === score}
							onClick={() => journey.rate(score)}
							className={`min-w-0 flex-1 py-3 text-sm font-bold text-white ${getScoreBgClass(score, score)} ${current === score ? "ring-2 ring-inset ring-white" : "opacity-80 hover:opacity-100"}`}
						>
							{score}
						</button>
					),
				)}
			</div>
			{journey.limitReached && (
				<p role="status" className="mt-3 text-sm text-amber-200">
					You’ve rated 20 titles. An account is needed to rate another. You can
					still use Wishlist, Skip, and edit existing ratings.
				</p>
			)}
			{onCancel && (
				<button
					type="button"
					className="mt-4 text-sm text-gray-300"
					onClick={onCancel}
				>
					Done
				</button>
			)}
		</div>
	)
}
