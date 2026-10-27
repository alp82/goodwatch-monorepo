// "Your ratings" in the taste view: every score the person holds (earlier ones too), newest first, as compact rows
// with a small poster, the title, its year and the score. Never poster cards, so they never read as recommendations.
// Titles met in this flow are known; older ones are read from /api/wishlist-titles (public title data, 100 a request).
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import type { ScoringMedia } from "~/ui/scoring/types"
import { titlePath } from "~/utils/helpers"
import { RATINGS_SHOWN, type RatedEntry } from "./flow"
import { ScoreSquare, image, quietButton } from "./parts"
import { WORDS } from "./words"

type RowTitle = Pick<
	ScoringMedia,
	"tmdb_id" | "media_type" | "title" | "poster_path" | "release_year"
>

const PER_REQUEST = 100

async function fetchTitles(keys: string[]): Promise<RowTitle[]> {
	const parts: string[][] = []
	for (let i = 0; i < keys.length; i += PER_REQUEST)
		parts.push(keys.slice(i, i + PER_REQUEST))
	const answers = await Promise.all(
		parts.map(async (part) => {
			const response = await fetch(
				`/api/wishlist-titles?keys=${encodeURIComponent(part.join(","))}`,
			)
			if (!response.ok) throw new Error("Title details didn't load")
			return ((await response.json()) as { titles: RowTitle[] }).titles
		}),
	)
	return answers.flat()
}

const keyOf = (t: { media_type: string; tmdb_id: number }) =>
	`${t.media_type}-${t.tmdb_id}`

export function YourRatings({
	ratings,
	met,
}: { ratings: RatedEntry[]; met: ReadonlyMap<string, ScoringMedia> }) {
	const [all, setAll] = useState(false)
	const shown = all ? ratings : ratings.slice(0, RATINGS_SHOWN)
	const missing = shown.map((r) => r.key).filter((key) => !met.has(key))
	const { data: fetched } = useQuery({
		queryKey: ["rating-flow-titles", [...missing].sort()],
		queryFn: () => fetchTitles(missing),
		enabled: missing.length > 0,
		staleTime: Number.POSITIVE_INFINITY,
		placeholderData: (previous) => previous,
	})
	const titles = new Map<string, RowTitle>(met)
	for (const t of fetched ?? []) titles.set(keyOf(t), t)

	if (!ratings.length)
		return <p className="text-sm text-gray-500">{WORDS.noRatings}</p>
	return (
		<div>
			<ul className="grid gap-x-6 md:grid-cols-2 xl:grid-cols-3">
				{shown.map((r) => (
					<li key={r.key} className="border-b border-white/5">
						<Row entry={r} title={titles.get(r.key)} />
					</li>
				))}
			</ul>
			{ratings.length > RATINGS_SHOWN && (
				<button
					type="button"
					className={`${quietButton} -ml-3`}
					aria-expanded={all}
					onClick={() => setAll(!all)}
				>
					{all ? "Show fewer" : `Show all ${ratings.length}`}
				</button>
			)}
		</div>
	)
}

function Row({ entry, title }: { entry: RatedEntry; title?: RowTitle }) {
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
				) : (
					<span className="inline-block h-3 w-32 animate-pulse rounded bg-gray-800" />
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
