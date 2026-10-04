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
import gabaritoLatin from "~/fonts/gabarito-latin.woff2"
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
import { buildMeta, ogImageUrl } from "~/utils/meta"

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
	// The TV's text is visible without scrolling and uses this font. The TV has a fixed size, so the swap from
	// the fallback font moves nothing.
	{
		rel: "preload",
		as: "font",
		type: "font/woff2",
		href: gabaritoLatin,
		crossOrigin: "anonymous",
	},
	{ rel: "preconnect", href: "https://image.tmdb.org" },
]

const HOME_URL = "https://goodwatch.app/"
const HOME_TITLE = "GoodWatch - Find movies and TV shows to watch"
const HOME_DESCRIPTION =
	"Find your next movie or TV show by mood and taste. Compare IMDb, Rotten Tomatoes and Metacritic scores, explore titles, and check where they stream."

// TV state and campaign parameters are views of the same page, not separate search results.
// This metadata is shared by guests and members, on every device.
export const meta: MetaFunction = () => [
	...buildMeta({
		pageMeta: {
			title: HOME_TITLE,
			description: HOME_DESCRIPTION,
			url: HOME_URL,
			image: ogImageUrl(HOME_URL),
			alt: "GoodWatch - find your next movie or TV show",
		},
	}).filter((tag) => !("script:ld+json" in tag)),
	// The living room is in English worldwide; there are no translated URL variants.
	{ tagName: "link", rel: "alternate", hrefLang: "en", href: HOME_URL },
	{ tagName: "link", rel: "alternate", hrefLang: "x-default", href: HOME_URL },
	{
		"script:ld+json": {
			"@context": "https://schema.org",
			"@graph": [
				{
					"@type": "Organization",
					"@id": `${HOME_URL}#organization`,
					name: "GoodWatch",
					url: HOME_URL,
					logo: `${HOME_URL}android-chrome-512x512.png`,
				},
				{
					"@type": "WebSite",
					"@id": `${HOME_URL}#website`,
					name: "GoodWatch",
					url: HOME_URL,
					description: HOME_DESCRIPTION,
					inLanguage: "en",
					publisher: { "@id": `${HOME_URL}#organization` },
				},
				{
					"@type": "WebPage",
					"@id": `${HOME_URL}#webpage`,
					name: HOME_TITLE,
					url: HOME_URL,
					description: HOME_DESCRIPTION,
					inLanguage: "en",
					isPartOf: { "@id": `${HOME_URL}#website` },
					about: { "@id": `${HOME_URL}#organization` },
				},
			],
		},
	},
]

export default function Index() {
	const initial = useLoaderData<typeof livingRoomLoader>()
	const leave = useLeaveThroughTv()
	const { search } = useLocation()
	const tvParams = new URLSearchParams(search)
	const screen = tvParams.get("tv") ?? "home"
	// The home's tiles draw their posters from the pool too (fetched after first paint, so the cached guest HTML
	// stays the same for everyone).
	const pool = useQuery<LivingRoomData>({
		queryKey: ["living-room-pool", initial],
		enabled: [
			"home",
			"services",
			"this-or-that",
			"moods",
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
					else if (to.kind === "app") leave(APP[to.app].href)
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
		[data, leave, wishlist, watched, skipped],
	)

	return <LivingRoom data={data} onEffect={onEffect} onRate={onRate} />
}
