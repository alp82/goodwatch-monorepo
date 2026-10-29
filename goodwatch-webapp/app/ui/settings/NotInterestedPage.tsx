// Settings › Not interested: every title the member marked Not interested, newest first, as poster cards under their
// Not interested cover; the cover's Undo unhides the title, which then fades out of the list. /my-library/hidden and
// /settings/hidden redirect to its page (/settings/not-interested).
import { Link } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "react-toastify"
import { useNotInterestedMutation } from "~/hooks/useUserDataMutations"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { POSTER_ROW_SIZES } from "~/ui/Poster"
import { Empty } from "~/ui/my-pages/bits"
import { Spinner } from "~/ui/wait/Spinner"
import { useHydrated } from "~/utils/hydrated"
import type { TitleKey } from "~/utils/title-key"
import { SettingsPage } from "./SettingsPage"
import { type HiddenTitle, type HiddenTitles, useHiddenTitles } from "./hidden-titles"

const FADE_MS = 300

const LINE = "Titles you marked Not interested. They stay out of your recommendations. You can still find them in search."

/** "October 12, 2026", after hydration only: the date follows the member's time zone. */
function useHiddenOn() {
	const hydrated = useHydrated()
	return (iso: string) => {
		if (!hydrated) return null
		const date = new Date(iso)
		return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-US", { dateStyle: "long" })
	}
}

export function NotInterestedPage() {
	const client = useQueryClient()
	const hidden = useHiddenTitles()
	const { queryKey } = hidden
	const { mutate: updateNotInterested, isPending, variables } = useNotInterestedMutation()
	const hiddenOn = useHiddenOn()
	// Unhidden titles fade out before they leave the list.
	const [leaving, setLeaving] = useState<ReadonlySet<TitleKey>>(new Set())

	const unhide = (title: HiddenTitle) =>
		updateNotInterested(
			{ mediaType: title.media_type, tmdbId: title.tmdb_id, action: "remove" },
			{
				onSuccess: () => {
					setLeaving((keys) => new Set(keys).add(title.key))
					window.setTimeout(() => {
						client.setQueryData<HiddenTitles>(queryKey, (old) =>
							old ? { titles: old.titles.filter((other) => other.key !== title.key) } : old,
						)
						setLeaving((keys) => {
							const left = new Set(keys)
							left.delete(title.key)
							return left
						})
					}, FADE_MS)
				},
				onError: () => toast.error(`Couldn't unhide ${title.title}. Please try again.`),
			},
		)

	const titles = hidden.data?.titles ?? []
	return (
		<SettingsPage title="Not interested" intro={LINE}>
			<div className="flex flex-col gap-6" data-hidden-titles>
				{hidden.isLoading ? (
					<Spinner size="medium" />
				) : hidden.isError ? (
					<p className="rounded-xl border border-gray-700 px-4 py-6 text-sm text-gray-400" role="alert">
						Your hidden titles couldn't load.{" "}
						<button type="button" className="cursor-pointer underline" onClick={() => hidden.refetch()}>
							Try again
						</button>
					</p>
				) : titles.length === 0 ? (
					<Empty title="Nothing here yet">Mark a title Not interested and it shows up here.</Empty>
				) : (
					<>
						<p className="text-sm text-gray-400">
							{titles.length === 1 ? "1 title hidden" : `${titles.length.toLocaleString("en-US")} titles hidden`}
						</p>
						<ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
							{titles.map((title) => {
								const busy = isPending && variables?.tmdbId === title.tmdb_id && variables.mediaType === title.media_type
								const on = hiddenOn(title.hiddenAt)
								return (
									<li
										key={title.key}
										className={`flex min-w-0 flex-col gap-2 transition-opacity duration-300 motion-reduce:transition-none ${leaving.has(title.key) ? "opacity-0" : ""}`}
									>
										<MovieTvCard
											details={title}
											mediaType={title.media_type}
											posterSizes={POSTER_ROW_SIZES}
											hidden={{ onUndo: () => unhide(title), pending: busy || leaving.has(title.key) }}
										/>
										<div className="flex flex-col gap-0.5">
											<Link
												to={title.href}
												prefetch="intent"
												className="line-clamp-2 text-sm leading-5 font-semibold text-gray-100 hover:underline"
											>
												{title.title}
											</Link>
											<span className="line-clamp-2 text-xs leading-4 text-gray-500">
												{[title.release_year, title.media_type === "show" ? "Series" : "Film"].filter(Boolean).join(" · ")}
												{on && ` · hidden ${on}`}
											</span>
										</div>
									</li>
								)
							})}
						</ul>
					</>
				)}
			</div>
		</SettingsPage>
	)
}
