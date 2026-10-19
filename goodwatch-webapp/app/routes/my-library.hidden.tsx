// My library, Hidden titles: every title the member marked Not interested, newest first, as posters with Unhide under
// each. It moved here from Settings (/settings/hidden redirects). A guest is asked to sign up.
import { EyeIcon } from "@heroicons/react/20/solid"
import { type LoaderFunctionArgs, type MetaFunction, json } from "@remix-run/node"
import { Link, useLoaderData } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "react-toastify"
import { useNotInterestedMutation } from "~/hooks/useUserDataMutations"
import { Empty, GuestPage, MY_LIBRARY, PageHead, Poster, WRAP } from "~/ui/my-pages/bits"
import { type HiddenTitle, type HiddenTitles, useHiddenTitles } from "~/ui/settings/hidden-titles"
import { Spinner } from "~/ui/wait/Spinner"
import { getUserIdFromRequest } from "~/utils/auth"
import { useHydrated } from "~/utils/hydrated"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Hidden titles | My library | GoodWatch" },
	{
		name: "description",
		content: "The titles you marked Not interested on GoodWatch. Unhide one to see it in your recommendations again.",
	},
	{ name: "robots", content: "noindex, follow" },
]

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await getUserIdFromRequest({ request })
	return json({ signedIn: Boolean(userId) }, { headers: { "Cache-Control": "private, no-store" } })
}

const LINE = "Titles you marked Not interested. They stay out of your recommendations. You can still find them in search."

export default function MyLibraryHidden() {
	const { signedIn } = useLoaderData<typeof loader>()
	if (!signedIn)
		return (
			<GuestPage
				name="Hidden titles"
				line={LINE}
				words={{
					title: "Sign up to keep titles you don't want out of the way",
					detail: "Mark a title Not interested and it stays out of your recommendations on every device.",
				}}
			/>
		)
	return <HiddenTitlesPage />
}

/** "October 12, 2026", after hydration only: the date follows the member's time zone. */
function useHiddenOn() {
	const hydrated = useHydrated()
	return (iso: string) => {
		if (!hydrated) return null
		const date = new Date(iso)
		return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-US", { dateStyle: "long" })
	}
}

function HiddenTitlesPage() {
	const client = useQueryClient()
	const hidden = useHiddenTitles()
	const { queryKey } = hidden
	const { mutate: updateNotInterested, isPending, variables } = useNotInterestedMutation()
	const hiddenOn = useHiddenOn()

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
		<div className="overflow-x-clip pb-24" data-hidden-titles>
			<PageHead name="Hidden titles" line={LINE} back={{ label: "My library", to: MY_LIBRARY }} />
			<div className={`${WRAP} flex flex-col gap-6`}>
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
					<Empty title="No hidden titles">Mark a title Not interested and it shows up here.</Empty>
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
									<li key={title.key} className="flex flex-col">
										<Link to={title.href} prefetch="intent" className="group mb-2 block">
											<Poster
												path={title.poster_path}
												size="w185"
												className="aspect-[2/3] w-full rounded-lg opacity-60 ring-1 ring-white/10 grayscale-[40%] transition-opacity group-hover:opacity-90"
											/>
											<span className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 font-semibold text-gray-100 group-hover:underline">
												{title.title}
											</span>
										</Link>
										<span className="mb-2 line-clamp-2 min-h-8 text-xs leading-4 text-gray-500">
											{[title.release_year, title.media_type === "show" ? "Series" : "Film"].filter(Boolean).join(" · ")}
											{on && ` · hidden ${on}`}
										</span>
										<button
											type="button"
											disabled={busy}
											onClick={() => unhide(title)}
											className="mt-auto inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-gray-600 text-sm font-semibold text-gray-200 hover:border-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
										>
											<EyeIcon className="size-4" aria-hidden /> Unhide
										</button>
									</li>
								)
							})}
						</ul>
					</>
				)}
			</div>
		</div>
	)
}
