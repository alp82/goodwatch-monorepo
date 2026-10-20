import { Link, useFetcher } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect } from "react"
import type { NewEpisodes } from "~/domain/new-episodes-signal"
import { useNewEpisodesData } from "~/ui/navigation/useNewEpisodes"
import { titleToDashed } from "~/utils/helpers"

type Announcement = NonNullable<NewEpisodes["announcements"]>[number]

export function EpisodeAnnouncements({ initial }: { initial: Announcement[] }) {
	const fresh = useNewEpisodesData()
	const announcements = fresh?.announcements ?? initial
	if (!announcements.length) return null
	return (
		<ul className="my-3 space-y-2" aria-label="New episodes">
			{announcements.map((show) => (
				<AnnouncementRow key={show.token} show={show} />
			))}
		</ul>
	)
}

function AnnouncementRow({ show }: { show: Announcement }) {
	const fetcher = useFetcher<{ ok?: boolean; error?: string }>()
	const client = useQueryClient()
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data?.ok)
			void client.invalidateQueries({ queryKey: ["new-episodes"] })
	}, [fetcher.state, fetcher.data, client])
	if (fetcher.data?.ok) return null
	return (
		<li
			data-arrival
			className="flex items-center gap-3 rounded-lg bg-amber-400/10 px-3 py-2 text-sm text-amber-200"
		>
			<Link
				to={`/show/${show.id}-${titleToDashed(show.title)}`}
				className="min-w-0 flex-1 hover:underline"
			>
				<b>{show.title}</b> · {show.episodes} new{" "}
				{show.episodes === 1 ? "episode" : "episodes"}
			</Link>
			<fetcher.Form method="post" action="/api/new-episodes">
				<input type="hidden" name="intent" value="dismiss" />
				<input type="hidden" name="token" value={show.token} />
				<button
					type="submit"
					disabled={fetcher.state !== "idle"}
					aria-label={`Dismiss new episodes for ${show.title}`}
					className="min-h-10 cursor-pointer rounded px-2 font-semibold hover:bg-white/10 focus-visible:outline focus-visible:outline-2 disabled:opacity-50"
				>
					Dismiss
				</button>
			</fetcher.Form>
			{fetcher.data?.error && (
				<span role="alert">Could not dismiss. Try again.</span>
			)}
		</li>
	)
}
