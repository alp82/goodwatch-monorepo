// The start page is the living room with its TV (docs/implementation/tv-screen-revamp): the room, the TV and the
// Remote, and the section below the room with the start titles and the hubs (BelowRoom.tsx).
//
// The TV's screen lives in the search params (`?tv=discover&mood=funny`); changing only those never reruns the
// loader. Asking again for the address the page is on does: that is the page itself after the member changed
// what the loader read, such as an episode marked watched on the TV (ui/living-room/tv/use-tv-episode.ts). The
// pool the TV draws its picks from is the TV's own request, at the first interaction
// (ui/living-room/tv/use-tv-pool.ts).
import type { LinksFunction, MetaFunction } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useLocation, useSearchParams } from "@remix-run/react"
// PROTOTYPE (landing): `/?variant=current|channel|band|welcome|tour`. Throwaway, on branch prototype/landing-experience.
import landingCss from "~/ui/prototype-landing/landing.css?url"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { useScroll } from "~/ui/prototype-landing/v-scroll"
import { useTaps } from "~/ui/prototype-landing/v-taps"
import { useLens } from "~/ui/prototype-landing/v-lens"
import { useAlerts } from "~/ui/prototype-landing/v-alerts"
import { type Landing, type VariantProps, useBand, useChannel, useCurrent, useTour, useWelcome } from "~/ui/prototype-landing/variants"
import type { tvHomeLoader } from "~/server/living-room/tv-loader.server"
import livingRoomCss from "~/ui/living-room/living-room.css?url"
import { TvLivingRoom } from "~/ui/living-room/tv/TvLivingRoom"
import { isTvOnlyChange } from "~/ui/living-room/tv/tv-machine"
import { assetUrl } from "~/utils/asset-url"
import useLocale from "~/utils/locale"

import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { tvHomeLoader as homeLoader } from "~/server/living-room/tv-loader.server"
import { loadLandingCards } from "~/server/prototype-landing.server"

// PROTOTYPE (landing): the home loader plus the start titles as cards, for the landing variants.
export async function loader(args: LoaderFunctionArgs) {
	const res = (await homeLoader(args as never)) as Response
	if (!res.headers.get("content-type")?.includes("json")) return res
	const data = await res.json()
	const landing = await loadLandingCards(args.request, data.startTitles ?? []).catch((e) => {
		console.error("landing cards", e)
		return []
	})
	return json({ ...data, landing }, { headers: res.headers })
}
export { pageHeaders as headers } from "~/utils/headers"
import { buildMeta, ogImageUrl } from "~/utils/meta"

export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	formMethod,
	defaultShouldRevalidate,
}) =>
	!formMethod &&
	currentUrl.href !== nextUrl.href &&
	isTvOnlyChange(currentUrl, nextUrl)
		? false
		: defaultShouldRevalidate

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: assetUrl(livingRoomCss) },
	{ rel: "stylesheet", href: landingCss },
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

// Round 1 (channel, band, welcome, tour) was rejected: a feature tour. Round 2 shows the value instead.
const VARIANTS = {
	live: "Today's page",
	scroll: "E · Endless scroll, then one pick",
	taps: "F · Three taps to your taste",
	lens: "G · One title, every answer",
	alerts: "H · It watches out for you",
}
const USE: Record<string, (p: VariantProps) => Landing> = {
	live: () => ({}),
	current: useCurrent,
	channel: useChannel,
	band: useBand,
	welcome: useWelcome,
	tour: useTour,
	scroll: useScroll,
	taps: useTaps,
	lens: useLens,
	alerts: useAlerts,
}

function Host({ use, data }: { use: (p: VariantProps) => Landing; data: ReturnType<typeof useLoaderData<typeof tvHomeLoader>> }) {
	const { search } = useLocation()
	const tvOpen = new URLSearchParams(search).has("tv")
	const landing = use({ data: data as never, tvOpen })
	return (
		<>
			{landing.above}
			<TvLivingRoom data={data} screenOverlay={landing.screen} roomOverlay={landing.room} />
		</>
	)
}

export default function Index() {
	const data = useLoaderData<typeof tvHomeLoader>()
	const { locale } = useLocale()
	const [params] = useSearchParams()
	const variant = params.get("variant") ?? "live"
	// The TV keeps previously visited titles in local state as well as the query cache.
	return (
		<>
			<Host key={`${locale.language}-${variant}`} use={USE[variant] ?? USE.live} data={data} />
			<PrototypeSwitcher variants={VARIANTS} position="bottom-24 left-1/2 -translate-x-1/2 lg:bottom-6" />
		</>
	)
}
