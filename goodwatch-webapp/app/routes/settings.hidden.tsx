// Hidden titles settings: every title the member marked Not interested, newest first, each with Unhide.
// The settings layout only shows this to a signed-in member.
import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "react-toastify"
import { useNotInterestedMutation } from "~/hooks/useUserDataMutations"
import type { TitleCard } from "~/server/title-cards.server"
import { Spinner } from "~/ui/wait/Spinner"
import { useUser } from "~/utils/auth"
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

type HiddenTitle = TitleCard & { hiddenAt: string; href: string }
interface HiddenTitles {
	titles: HiddenTitle[]
}

const queryKeyHiddenTitles = (userId?: string) => ["not-interested", userId] as const

export default function SettingsHidden() {
	const { user } = useUser()
	const client = useQueryClient()
	const queryKey = queryKeyHiddenTitles(user?.id)
	const hidden = useQuery<HiddenTitles>({
		queryKey,
		queryFn: async () => {
			const response = await fetch("/api/not-interested")
			if (!response.ok) throw new Error(`Hidden titles answered ${response.status}`)
			return await response.json()
		},
		enabled: Boolean(user?.id),
	})
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
		<div className="px-2 md:px-4 lg:px-8">
			<div className="flex max-w-2xl flex-col gap-4 text-base text-gray-300">
				<div>
					<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
						Hidden titles
					</h2>
					<p className="mt-2 text-gray-400">
						Titles you marked Not interested. They stay out of your recommendations. You can still find them in
						search.
					</p>
				</div>
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
		</div>
	)
}
