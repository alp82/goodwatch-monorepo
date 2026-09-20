import { Link } from "@remix-run/react"
import { useEffect, useState } from "react"
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline"
import { useSmartTitles } from "~/routes/api.smart-titles"
import type { ScoringMedia } from "~/ui/scoring/types"
import {
	defaultExploreFilters,
	detailsHref,
	readExploration,
	rememberExploration,
	uniqueTitles,
	type ExploreFilters,
	type TasteExploration,
} from "~/ui/taste/exploration"

type CurrentTitle = Pick<ScoringMedia, "tmdb_id" | "media_type" | "title">
export default function ExploreBar({ current }: { current: CurrentTitle }) {
	const [origin, setOrigin] = useState<TasteExploration | null>(null)
	const [filters, setFilters] = useState<ExploreFilters>(defaultExploreFilters)
	const [expanded, setExpanded] = useState(false)
	useEffect(() => {
		const saved = readExploration()
		setOrigin(saved)
		setFilters(saved.filters || defaultExploreFilters)
	}, [])
	const suggestions = useSmartTitles({
		count: 100,
		enabled: origin !== null && !origin.titles?.length,
	})
	const pool = uniqueTitles(
		origin?.titles?.length
			? origin.titles
			: suggestions.data?.smartTitles || [],
	)
	useEffect(() => {
		if (
			!origin ||
			origin.titles?.length ||
			!suggestions.data?.smartTitles.length
		)
			return
		const titles = suggestions.data.smartTitles
		rememberExploration({ titles })
		setOrigin((previous) => ({ ...previous, titles }))
	}, [origin, suggestions.data])
	const genres = [
		...new Set(pool.flatMap((title) => title.genres || [])),
	].sort()
	const candidates = pool.filter(
		(title) =>
			(filters.type === "all" || title.media_type === filters.type) &&
			(!filters.genre || title.genres?.includes(filters.genre)),
	)
	if (filters.order !== "queue") {
		candidates.sort((a, b) => {
			const aYear = Number.parseInt(a.release_year || "", 10)
			const bYear = Number.parseInt(b.release_year || "", 10)
			if (!Number.isFinite(aYear)) return Number.isFinite(bYear) ? 1 : 0
			if (!Number.isFinite(bYear)) return -1
			return filters.order === "newest" ? bYear - aYear : aYear - bYear
		})
	}
	const index = candidates.findIndex(
		(title) =>
			title.tmdb_id === current.tmdb_id &&
			title.media_type === current.media_type,
	)
	const previous = index > 0 ? candidates[index - 1] : undefined
	const next = index >= 0 ? candidates[index + 1] : candidates[0]
	const filtered =
		filters.type !== "all" || filters.genre !== "" || filters.order !== "queue"
	function update(nextFilters: ExploreFilters) {
		setFilters(nextFilters)
		rememberExploration({ filters: nextFilters })
	}
	const status =
		origin === null || (suggestions.isFetching && !pool.length)
			? "Finding titles…"
			: suggestions.isError && !pool.length
				? "Couldn’t load titles"
				: candidates.length === 0
					? "No titles match these filters"
					: index >= 0
						? `${index + 1} of ${candidates.length}`
						: `${candidates.length} titles to explore`
	const select =
		"min-w-0 rounded-md border border-gray-600 bg-gray-800 px-2 py-1.5 text-sm text-gray-100 focus-visible:outline focus-visible:outline-cyan-300"
	if (!pool.length) return null
	return (
		<nav
			aria-label="Explore titles"
			className="border-b border-cyan-400/20 bg-gray-900"
		>
			<div className="mx-auto max-w-7xl px-4 py-3 text-sm">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
					<Link
						to="/taste/quiz?resume=1"
						preventScrollReset
						className="font-semibold text-cyan-300 hover:text-cyan-200"
					>
						← Taste quiz
					</Link>
					<div className="flex items-center gap-3 sm:gap-4">
						{previous ? (
							<Link
								to={detailsHref(previous)}
								aria-label={`← Previous: ${previous.title}`}
								className="text-cyan-300 hover:text-cyan-200"
							>
								← Previous
							</Link>
						) : (
							<span aria-disabled="true" className="text-gray-500">
								← Previous
							</span>
						)}
						<span role="status" className="text-xs text-gray-300">
							{status}
						</span>
						{next ? (
							<Link
								to={detailsHref(next)}
								aria-label={`${index < 0 ? "Start exploring" : "Next"} →: ${next.title}`}
								className="text-cyan-300 hover:text-cyan-200"
							>
								{index < 0 ? "Start exploring" : "Next"} →
							</Link>
						) : (
							<span aria-disabled="true" className="text-gray-500">
								Next →
							</span>
						)}
					</div>
					{pool.length > candidates.length && (
						<button
							type="button"
							className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
							onClick={() => update(defaultExploreFilters)}
						>
							{pool.length - candidates.length} more{" "}
							{pool.length - candidates.length === 1 ? "result" : "results"}{" "}
							without filters
						</button>
					)}
					<button
						type="button"
						aria-expanded={expanded}
						aria-controls="explore-title-options"
						onClick={() => setExpanded((value) => !value)}
						className="flex items-center gap-2 text-gray-300 hover:text-white"
					>
						<AdjustmentsHorizontalIcon className="h-4 w-4" />
						Refine{filtered ? " · on" : ""}
					</button>
				</div>
				{expanded && (
					<div
						id="explore-title-options"
						className="mt-3 border-t border-gray-700/60 pt-3"
					>
						<div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
							<label className="flex min-w-0 flex-col gap-1 text-xs text-gray-400">
								Titles
								<select
									className={select}
									value={filters.type}
									onChange={(event) =>
										update({
											...filters,
											type: event.target.value as ExploreFilters["type"],
										})
									}
								>
									<option value="all">Movies & shows</option>
									<option value="movie">Movies</option>
									<option value="show">Shows</option>
								</select>
							</label>
							<label className="flex min-w-0 flex-col gap-1 text-xs text-gray-400">
								Genre
								<select
									className={select}
									value={filters.genre}
									onChange={(event) =>
										update({ ...filters, genre: event.target.value })
									}
								>
									<option value="">Any genre</option>
									{genres.map((genre) => (
										<option key={genre} value={genre}>
											{genre}
										</option>
									))}
								</select>
							</label>
							<label className="flex min-w-0 flex-col gap-1 text-xs text-gray-400">
								Order
								<select
									className={select}
									value={filters.order}
									onChange={(event) =>
										update({
											...filters,
											order: event.target.value as ExploreFilters["order"],
										})
									}
								>
									<option value="queue">Original order</option>
									<option value="newest">Newest first</option>
									<option value="oldest">Oldest first</option>
								</select>
							</label>
							{filtered && (
								<button
									type="button"
									onClick={() => update(defaultExploreFilters)}
									className="px-2 py-2 text-sm text-cyan-300 hover:text-cyan-200"
								>
									Reset filters
								</button>
							)}
						</div>
						<p className="mt-3 text-xs text-gray-400">
							These controls narrow the {pool.length} titles in this
							exploration. Your current title stays open until you choose
							another.
						</p>
					</div>
				)}
				{suggestions.isError && !pool.length && (
					<button
						type="button"
						onClick={() => suggestions.refetch()}
						className="mt-2 text-cyan-300 underline"
					>
						Retry loading titles
					</button>
				)}
				{!next && index >= 0 && (
					<p className="mt-2 text-xs text-gray-400">
						End of this selection.
						{filtered
							? " Refine or reset filters to explore a different selection."
							: " Go back to the Taste quiz to continue."}
					</p>
				)}
			</div>
		</nav>
	)
}
