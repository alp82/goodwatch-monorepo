// The Taste page for a member with no taste yet: one title at a time, rated right on the page, best-known titles first.
// Once enough liked titles are saved, the page reloads its view and the taste takes this one's place.
import { useRevalidator } from "@remix-run/react"
import { useEffect, useMemo, useRef, useState } from "react"
import { fetchSmartTitles } from "~/routes/api.smart-titles"
import { useUserData } from "~/routes/api.user-data"
import type { Score } from "~/server/scores.server"
import type { ScoringMedia } from "~/ui/scoring/types"
import { RatingDots } from "~/ui/taste-quiz/TasteQuizPage"
import { ScoreControl } from "~/ui/title-actions/ScoreControl"
import useLocale from "~/utils/locale"
import { useTasteScoring } from "./hooks/useTasteScoring"

/** Liked titles (7 and up) before the page asks for the taste. The server may want a few more to find groups. */
const GOAL = 5
const LIKED = 7

const keyOf = (t: { media_type: string; tmdb_id: number }) =>
	`${t.media_type}-${t.tmdb_id}`
const image = (path: string | undefined, size: string) =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined

const ghost =
	"inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-gray-700 px-5 font-semibold text-gray-200 hover:border-gray-500 md:min-h-10"

export function TasteStart() {
	const { locale } = useLocale()
	const revalidator = useRevalidator()
	const { data: userData } = useUserData()
	const { addScore, addSkip, isSubmitting } = useTasteScoring({
		isAuthenticated: true,
	})
	const [titles, setTitles] = useState<ScoringMedia[]>([])
	const [loading, setLoading] = useState(true)
	const [done, setDone] = useState<string[]>([])
	const [rated, setRated] = useState<{ title: ScoringMedia; score: Score }[]>(
		[],
	)

	const queue = titles.filter((t) => !done.includes(keyOf(t)))
	const x = queue[0]

	// The best-known titles the member hasn't rated or skipped; more when the queue runs low.
	const fetching = useRef(false)
	useEffect(() => {
		if (fetching.current || (titles.length > 0 && queue.length > 3)) return
		fetching.current = true
		fetchSmartTitles({
			count: 40,
			language: locale.language,
			excludeIds: done.map((k) => {
				const [media_type, id] = k.split("-")
				return { media_type, tmdb_id: Number(id) }
			}),
		})
			.then((more) =>
				setTitles((now) => {
					const known = new Set(now.map(keyOf))
					return [...now, ...more.filter((t) => !known.has(keyOf(t)))]
				}),
			)
			.catch(() => {})
			.finally(() => {
				fetching.current = false
				setLoading(false)
			})
	}, [titles.length, queue.length, done, locale.language])

	const liked = useMemo(() => {
		const keys = new Set(
			Object.entries(userData?.scores ?? {})
				.filter(([, v]) => (v?.score ?? 0) >= LIKED)
				.map(([k]) => k),
		)
		for (const r of rated) {
			if (r.score >= LIKED) keys.add(keyOf(r.title))
			else keys.delete(keyOf(r.title))
		}
		return keys.size
	}, [userData?.scores, rated])

	// With enough liked titles saved, ask for the taste again: the page swaps to it once the server finds groups.
	useEffect(() => {
		if (liked >= GOAL && !isSubmitting) revalidator.revalidate()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [liked, isSubmitting])

	const rate = (title: ScoringMedia, score: Score) => {
		addScore(title, score)
		setRated((r) => [...r, { title, score }])
		setDone((d) => [...d, keyOf(title)])
	}
	const skip = (title: ScoringMedia) => {
		addSkip(title)
		setDone((d) => [...d, keyOf(title)])
	}

	const left = Math.max(GOAL - liked, 0)
	return (
		<div className="pb-32 text-white">
			<div className="mx-auto max-w-7xl px-4 pt-8 md:px-8 md:pt-12">
				<div className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-400/90">
					Your taste
				</div>
				<h1 className="text-2xl font-extrabold md:text-4xl">
					{liked === 0
						? "What have you loved watching?"
						: left > 0
							? `${left} more you liked.`
							: "Almost there. A few more you liked."}
				</h1>
				<p className="mt-2 max-w-2xl text-gray-300">
					Rate {GOAL} titles you liked. GoodWatch groups what they share and
					finds more like them.
				</p>
				<div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
					<RatingDots at={liked} of={GOAL} />
					{Math.min(liked, GOAL)} of {GOAL} liked
				</div>
			</div>

			<div className="mx-auto max-w-7xl px-4 pt-6 md:px-8">
				{x ? (
					<div className="relative flex flex-col gap-5 overflow-hidden rounded-2xl bg-gray-900 p-4 ring-1 ring-white/10 sm:flex-row md:p-6">
						{x.backdrop_path && (
							<img
								src={image(x.backdrop_path, "w1280")}
								alt=""
								className="absolute inset-0 h-full w-full object-cover opacity-20"
							/>
						)}
						<img
							src={image(x.poster_path, "w342")}
							alt=""
							className="relative w-32 shrink-0 self-start rounded-lg shadow-xl md:w-44"
						/>
						<div className="relative min-w-0 flex-1">
							<div className="text-xs font-bold uppercase tracking-wider text-amber-400/90">
								Seen it? How was it?
							</div>
							<h2 className="mt-1 text-2xl font-extrabold md:text-3xl">
								{x.title}
							</h2>
							<div className="mb-4 text-sm text-gray-300">
								{[x.release_year, x.genres?.slice(0, 3).join(", ")]
									.filter(Boolean)
									.join(" · ")}
							</div>
							<button
								type="button"
								className={`${ghost} mb-4`}
								onClick={() => skip(x)}
							>
								Haven't seen it
							</button>
							<ScoreControl
								key={keyOf(x)}
								onRate={(v) => rate(x, v)}
								fit="screen"
							/>
						</div>
					</div>
				) : (
					<p
						className={`py-10 text-gray-400 ${loading ? "animate-pulse" : ""}`}
					>
						{loading
							? "Finding titles for you…"
							: "That's every title for now."}
					</p>
				)}
				{rated.length > 0 && (
					<ul
						className="mt-3 flex gap-2 overflow-x-auto"
						aria-label="Rated so far"
					>
						{rated.map((r) => (
							<li key={keyOf(r.title)} className="relative w-12 shrink-0">
								<img
									src={image(r.title.poster_path, "w92")}
									alt={`${r.title.title}, ${r.score}`}
									className="rounded"
								/>
								<span
									aria-hidden
									className="absolute inset-x-0 bottom-0 bg-gray-950/80 text-center text-[11px] font-black text-amber-300"
								>
									{r.score}
								</span>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	)
}
