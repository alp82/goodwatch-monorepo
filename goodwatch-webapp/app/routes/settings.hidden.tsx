// Settings, Hidden titles: every title the member marked Not interested, newest first, each with Unhide.
// The settings layout only shows this to a signed-in member.
import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "react-toastify"
import { useNotInterestedMutation } from "~/hooks/useUserDataMutations"
import { type HiddenTitle, type HiddenTitles, useHiddenTitles } from "~/ui/settings/hidden-titles"
import { SettingsSheet } from "~/ui/settings/SettingsSheet"
import { Spinner } from "~/ui/wait/Spinner"
import { tmdbImageUrl } from "~/utils/tmdb-image"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Hidden titles | GoodWatch" },
	{
		name: "description",
		content: "The titles you marked Not interested on GoodWatch. Unhide one to see it in your recommendations again.",
	},
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsHidden() {
	const client = useQueryClient()
	const hidden = useHiddenTitles()
	const { queryKey } = hidden
	const { mutate: updateNotInterested, isPending, variables } = useNotInterestedMutation()

	const unhide = (title: HiddenTitle) =>
		updateNotInterested(
			{ mediaType: title.media_type, tmdbId: title.tmdb_id, action: "remove" },
			{
				onSuccess: () =>
					client.setQueryData<HiddenTitles>(queryKey, (old) =>
						old ? { titles: old.titles.filter((other) => other.key !== title.key) } : old,
					),
				onError: () => toast.error(`Couldn't unhide ${title.title}. Please try again.`),
			},
		)

	const titles = hidden.data?.titles ?? []
	return (
		<SettingsSheet
			title="Hidden titles"
			subtitle="Titles you marked Not interested. They stay out of your recommendations. You can still find them in search."
		>
			<div className="flex flex-col gap-4 text-base text-gray-300">
				{hidden.isLoading ? (
					<Spinner size="medium" />
				) : hidden.isError ? (
					<p className="rounded-md border border-gray-700 px-4 py-6 text-sm text-gray-400" role="alert">
						Your hidden titles couldn't load.{" "}
						<button type="button" className="cursor-pointer underline" onClick={() => hidden.refetch()}>
							Try again
						</button>
					</p>
				) : titles.length === 0 ? (
					<p className="rounded-md border border-gray-700 px-4 py-6 text-sm text-gray-400">
						No hidden titles. Mark a title Not interested and it shows up here.
					</p>
				) : (
					<ul className="divide-y divide-gray-700 rounded-md border border-gray-700">
						{titles.map((title) => {
							const busy =
								isPending && variables?.tmdbId === title.tmdb_id && variables.mediaType === title.media_type
							return (
								<li key={title.key} className="flex items-center gap-3 px-3 py-2">
									{title.poster_path ? (
										<img
											src={tmdbImageUrl(title.poster_path, "w92")}
											alt=""
											loading="lazy"
											className="h-14 w-[2.35rem] shrink-0 rounded object-cover"
										/>
									) : (
										<span className="h-14 w-[2.35rem] shrink-0 rounded bg-white/5" />
									)}
									<span className="min-w-0 grow">
										<Link to={title.href} className="block truncate text-base font-medium text-gray-100 hover:underline">
											{title.title}
										</Link>
										<span className="block text-xs text-gray-400">
											{[title.release_year, title.media_type === "show" ? "Series" : "Film"]
												.filter(Boolean)
												.join(" · ")}
										</span>
									</span>
									<button
										type="button"
										disabled={busy}
										onClick={() => unhide(title)}
										className="shrink-0 cursor-pointer rounded-md border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
									>
										Unhide
									</button>
								</li>
							)
						})}
					</ul>
				)}
			</div>
		</SettingsSheet>
	)
}
