// The start page is the living room (the desktop scene, or the phone scene on phones). The TV's screen and keys live
// in the search params (`?tv=picks&mood=cozy`); changing only those never reruns the loader.
import type {
	HeadersFunction,
	LinksFunction,
	MetaFunction,
} from "@remix-run/node"
import {
	type ShouldRevalidateFunction,
	useLoaderData,
	useLocation,
} from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import {
	useScoreMutation,
	useSkippedMutation,
	useWatchedMutation,
	useWishlistMutation,
} from "~/hooks/useUserDataMutations"
import type { Score } from "~/server/scores.server"
import { LivingRoom } from "~/ui/living-room/LivingRoom"
import { APP } from "~/ui/living-room/Remote"
import { type LivingRoomData, titleOf } from "~/ui/living-room/living-room-data"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { type TvEffect, isTvOnlyChange } from "~/ui/living-room/tv-flow"
import { useLeaveThroughTv } from "~/ui/living-room/tv-transition"
import { titleHref } from "~/ui/watch-next/WatchNextHero"
import { snapshotGuestProgress } from "~/utils/guest-progress"

export { livingRoomLoader as loader } from "~/server/living-room.server"
import type { livingRoomLoader } from "~/server/living-room.server"
import { pageHeaders } from "~/utils/headers"
import { buildMeta } from "~/utils/meta"

// Keep auth refreshes private, but use this route's exact guest policy instead of the root's public default.
export const headers: HeadersFunction = (args) => {
	const result = new Headers(pageHeaders(args))
	if (!/private|no-store/i.test(result.get("Cache-Control") ?? "")) {
		const policy = args.loaderHeaders.get("Cache-Control")
		if (policy) result.set("Cache-Control", policy)
	}
	return result
}

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	!formMethod && isTvOnlyChange(currentUrl, nextUrl)
		? false
		: defaultShouldRevalidate

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: livingRoomCss },
	{ rel: "preconnect", href: "https://image.tmdb.org" },
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&family=VT323&display=swap",
	},
]

export const meta: MetaFunction = () =>
	buildMeta({
		pageMeta: {
			title: "GoodWatch - Find the best movies and shows to watch",
			description:
				"Discover the best movies and shows to watch right now. Pick a mood and get worthwhile picks on Netflix, Prime Video, Disney+, HBO and more.",
			url: "https://goodwatch.app",
			image: "https://goodwatch.app/images/heroes/hero-movies.png",
			alt: "The GoodWatch living room",
		},
		items: [],
	})

export default function Index() {
	const initial = useLoaderData<typeof livingRoomLoader>()
	const leave = useLeaveThroughTv()
	const { pathname, search } = useLocation()
	const screen = new URLSearchParams(search).get("tv") ?? "home"
	const pool = useQuery<LivingRoomData>({
		queryKey: ["living-room-pool", initial],
		enabled: [
			"services",
			"this-or-that",
			"moods",
			"source",
			"picks",
			"title",
		].includes(screen),
		queryFn: async () => {
			const response = await fetch("/api/living-room/picks?view=pool", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(
					initial.member ? {} : { guest: snapshotGuestProgress() },
				),
			})
			if (!response.ok) throw new Error("Unable to load living room picks")
			return response.json()
		},
	})
	const data: LivingRoomData = pool.data ?? initial

	const here = encodeURIComponent(pathname + search)
	const signUpHref = `/sign-up?redirectTo=${here}`
	const signInHref = `/sign-in?redirectTo=${here}`
	const wishlist = useWishlistMutation()
	const watched = useWatchedMutation()
	const skipped = useSkippedMutation()
	const score = useScoreMutation()
	const onRate = useCallback(
		(titleKey: string, value: Score) => {
			const t = titleOf(data, titleKey)
			if (t)
				score.mutate({
					mediaType: t.media_type,
					tmdbId: t.tmdb_id,
					score: value,
				})
		},
		[data, score],
	)

	// Leaving grows the TV into the window (#232); browser Back shrinks the page into the same TV screen.
	const onEffect = useCallback(
		(effect: TvEffect) => {
			const titleKey = "title" in effect ? effect.title : null
			const title = titleKey ? titleOf(data, titleKey) : null
			const target = title
				? { mediaType: title.media_type, tmdbId: title.tmdb_id }
				: null
			switch (effect.type) {
				case "leave": {
					const to = effect.to
					if (to.kind === "page") leave(to.href)
					else if (to.kind === "app")
						leave(
							to.app === "watch-now" && !data.member
								? signUpHref
								: APP[to.app].href,
						)
					else {
						const t = titleOf(data, to.title)
						if (t) leave(titleHref(t))
					}
					return
				}
				case "watch":
					if (title) leave(titleHref(title))
					return
				case "want-to-see":
					if (target && !title?.wantToSee)
						wishlist.mutate({ ...target, action: "add" })
					return
				case "seen":
					if (target && data.member)
						watched.mutate({ ...target, action: "add" })
					return
				case "not-for-me":
					if (target) skipped.mutate({ ...target, action: "add" })
					return
			}
		},
		[data, leave, signUpHref, wishlist, watched, skipped],
	)

	return (
		<LivingRoom
			data={data}
			onEffect={onEffect}
			signInHref={signInHref}
			onRate={onRate}
		/>
	)
}
