import { useState, type ReactNode } from "react"
import { Link } from "@remix-run/react"
import type { ScoringMedia } from "~/ui/scoring/types"
import WatchControls from "./WatchControls"
import { useWatchSelection, useWatchability } from "./useWatchability"

export default function WatchableList<T extends ScoringMedia>({
	titles,
	children,
	onWatchChange,
}: {
	titles: T[]
	children: (titles: T[]) => ReactNode
	onWatchChange?: (watch: boolean) => void
}) {
	const [watch, setWatch] = useState(false)
	const selection = useWatchSelection()
	const check = useWatchability(titles, selection, watch)
	const matches = titles.filter(
		(title) =>
			check.results.get(`${title.media_type}-${title.tmdb_id}`)?.state ===
			"watchable",
	)
	const unknown = titles.filter(
		(title) =>
			check.results.get(`${title.media_type}-${title.tmdb_id}`)?.state ===
			"unknown",
	)
	const noMatch = titles.filter(
		(title) =>
			check.results.get(`${title.media_type}-${title.tmdb_id}`)?.state ===
			"no_match",
	)
	return (
		<>
			<div className="my-3 space-y-3">
				<button
					type="button"
					className="px-3 py-2 rounded border border-sky-500 text-sky-200"
					aria-pressed={watch}
					onClick={() => {
						setWatch(!watch)
						onWatchChange?.(!watch)
					}}
				>
					{watch ? "Show all titles" : "What can I watch?"}
				</button>
				{watch && (
					<>
						<WatchControls selection={selection} />
						{check.isFetching && <p role="status">Checking current offers…</p>}
						{check.isError && (
							<p role="alert">
								Could not check current offers.{" "}
								<button
									className="underline"
									type="button"
									onClick={() => check.refetch()}
								>
									Try again
								</button>
							</p>
						)}
						<p role="status">
							{matches.length} confirmed matches among the loaded titles.{" "}
							{unknown.length} availability unknown; {noMatch.length} no
							matching offer found.
						</p>
						{matches.length < 5 && !!titles.length && (
							<div className="border-t border-gray-700 pt-3">
								<h3 className="font-semibold">
									Keep exploring without an availability requirement
								</h3>
								<p className="text-sm text-gray-300">
									Preview only. These titles do not all satisfy your current
									viewing options. Your selection stays in place.
								</p>
								<div className="flex flex-wrap gap-3 my-2">
									{titles.slice(0, 4).map((title) => (
										<Link
											className="underline text-sky-200"
											key={`${title.media_type}-${title.tmdb_id}`}
											to={`/${title.media_type}/${title.tmdb_id}`}
										>
											{title.title}
										</Link>
									))}
								</div>
								<Link
									className="underline text-sky-200"
									to="/taste/quiz?watch=1"
								>
									Find available alternatives
								</Link>
							</div>
						)}
					</>
				)}
			</div>
			{children(watch ? matches : titles)}
		</>
	)
}
