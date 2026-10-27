// "Your ratings" in the taste view: every score the person holds (earlier ones too), newest first, as compact rows
// with a small poster, the title, its year and the score. Never poster cards, so they never read as recommendations.
// Titles met in this flow are known; older ones are read from /api/wishlist-titles (public title data, at most 100
// a request). The list grows a page at a time, and each page reads its own titles with one request, so one failed
// page never breaks the others and "Show more" never fires more than one request.
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { ScoringMedia } from "~/ui/scoring/types"
import { titlePath } from "~/utils/helpers"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { RATINGS_SHOWN, type RatedEntry } from "./flow"
import { ScoreSquare, image, quietButton } from "./parts"
import { WORDS } from "./words"

type RowTitle = Pick<
	ScoringMedia,
	"tmdb_id" | "media_type" | "title" | "poster_path" | "release_year"
>

// One page is one request: the endpoint takes at most 100 keys.
const PAGE = RATINGS_SHOWN

async function fetchTitles(keys: string[], language: string): Promise<RowTitle[]> {
	const response = await fetch(
		mediaLanguageUrl(
			`/api/wishlist-titles?keys=${encodeURIComponent(keys.join(","))}`,
			language,
		),
	)
	if (!response.ok) throw new Error("Title details didn't load")
	return ((await response.json()) as { titles: RowTitle[] }).titles
}

const keyOf = (t: { media_type: string; tmdb_id: number }) =>
	`${t.media_type}-${t.tmdb_id}`

export function YourRatings({
	ratings,
	met,
}: { ratings: RatedEntry[]; met: ReadonlyMap<string, ScoringMedia> }) {
	const [pages, setPages] = useState(1)
	if (!ratings.length)
		return <p className="text-sm text-gray-500">{WORDS.noRatings}</p>
	const shown = Math.min(ratings.length, pages * PAGE)
	const pageList: RatedEntry[][] = []
	for (let i = 0; i < shown; i += PAGE) pageList.push(ratings.slice(i, i + PAGE))
	return (
		<div>
			<ul className="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
				{pageList.map((entries, index) => (
					<RatingsPage key={index} entries={entries} met={met} />
				))}
			</ul>
			<div className="flex flex-wrap">
				{shown < ratings.length && (
					<button
						type="button"
						className={`${quietButton} -ml-3`}
						onClick={() => setPages(pages + 1)}
					>
						{WORDS.showMore} ({ratings.length - shown})
					</button>
				)}
				{pages > 1 && (
					<button
						type="button"
						className={`${quietButton} ${shown < ratings.length ? "" : "-ml-3"}`}
						onClick={() => setPages(1)}
					>
						{WORDS.showFewer}
					</button>
				)}
			</div>
		</div>
	)
}

function RatingsPage({
	entries,
	met,
}: { entries: RatedEntry[]; met: ReadonlyMap<string, ScoringMedia> }) {
	const { locale } = useLocale()
	const missing = entries.map((r) => r.key).filter((key) => !met.has(key))
	const { data, isError, isFetching, isSuccess, refetch } = useQuery({
		queryKey: ["rating-flow-titles", locale.language, [...missing].sort()],
		queryFn: () => fetchTitles(missing, locale.language),
		enabled: missing.length > 0,
		placeholderData: (previous) => previous,
		retry: 1,
	})
	const titles = new Map<string, RowTitle>(met)
	for (const t of data ?? []) titles.set(keyOf(t), t)
	// Answered for exactly these keys: a key the catalog did not return is gone, not loading.
	const answered = isSuccess && !isFetching
	return (
		<>
			{entries.map((r) => {
				const title = titles.get(r.key)
				return (
					<li key={r.key} className="border-b border-white/5">
						<Row
							entry={r}
							title={title}
							state={title ? "ready" : answered ? "unavailable" : isError ? "failed" : "loading"}
						/>
					</li>
				)
			})}
			{isError && !isFetching && (
				<li className="col-span-full flex flex-wrap items-center gap-x-3 py-2 text-sm text-amber-200">
					<span role="alert">{WORDS.ratingsFailed}</span>
					<button
						type="button"
						className={`${quietButton} -ml-3 text-amber-200 hover:text-white`}
						onClick={() => void refetch()}
					>
						{WORDS.tryAgain}
					</button>
				</li>
			)}
		</>
	)
}

function Row({
	entry,
	title,
	state,
}: {
	entry: RatedEntry
	title?: RowTitle
	state: "ready" | "loading" | "failed" | "unavailable"
}) {
	const body = (
		<>
			{title?.poster_path ? (
				<img
					src={image(title.poster_path, "w92")}
					alt=""
					loading="lazy"
					decoding="async"
					className="h-12 w-8 shrink-0 rounded-sm object-cover"
				/>
			) : (
				<span className="h-12 w-8 shrink-0 rounded-sm bg-gray-800" />
			)}
			<span className="min-w-0 flex-1 truncate text-sm text-gray-200">
				{title ? (
					<>
						{title.title}
						{title.release_year && (
							<span className="text-gray-500"> ({title.release_year})</span>
						)}
					</>
				) : state === "loading" ? (
					<span className="inline-block h-3 w-32 animate-pulse rounded bg-gray-800" />
				) : state === "unavailable" ? (
					<span className="text-gray-500">{WORDS.titleUnavailable}</span>
				) : (
					<span className="inline-block h-3 w-32 rounded bg-gray-800" />
				)}
			</span>
			<ScoreSquare score={entry.score} />
		</>
	)
	const row = "flex min-h-14 items-center gap-3 py-1.5"
	return title ? (
		<Link
			to={titlePath(title.media_type, title.tmdb_id, title.title)}
			className={`${row} rounded-md hover:bg-white/[0.04]`}
		>
			{body}
		</Link>
	) : (
		<div className={row}>{body}</div>
	)
}
