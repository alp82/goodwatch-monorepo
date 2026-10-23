// Hot on socials: the whole buzz ranking and what is said about each title, one block per title with its best
// posts, and search and filters over all of it (HotPage.tsx). The start page's row (start-row/StartRow.tsx) links
// here, with `#movie-<id>` or `#show-<id>` to open one title. Gated like that row (TALKED_ABOUT_NOW_ROW); the same
// for every visitor, so a shared cache may keep it a few minutes.
import {
	type LinksFunction,
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
} from "@remix-run/node"
import { useLoaderData } from "@remix-run/react"
import type { TalkedRow } from "~/domain/talked-about-now"
import { cachedClientLoader } from "~/navigation/instant-navigation"
import { presentCatalogLoader } from "~/server/media-payload.server"
import { talkedAboutNowEnabled, talkedAboutNowMode } from "~/server/talked-about-now/flags.server"
import { HotPage } from "~/ui/talked-about-now/hot-page/HotPage"
import hotPageCss from "~/ui/talked-about-now/hot-page/hot-page.css?url"
import startRowCss from "~/ui/talked-about-now/start-row/start-row.css?url"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: startRowCss },
	{ rel: "stylesheet", href: hotPageCss },
]

const PUBLIC = "public, max-age=300, s-maxage=300, stale-while-revalidate=300"
const PRIVATE = "private, no-store"

async function canonicalLoader({ request }: LoaderFunctionArgs) {
	const mode = talkedAboutNowMode("row")
	const enabled =
		mode === "preview"
			? talkedAboutNowEnabled(
					"row",
					await (await import("~/utils/auth")).getUserIdFromRequest({ request }),
				)
			: mode === "on"
	if (!enabled) throw new Response("Not found", { status: 404, headers: { "Cache-Control": PRIVATE } })
	const { getHotOnSocials } = await import("~/server/talked-about-now/start-row.server")
	const row = await getHotOnSocials()
	return json(
		{ row },
		{ headers: { "Cache-Control": mode === "on" && row ? PUBLIC : PRIVATE } },
	)
}

export const loader = presentCatalogLoader(canonicalLoader)

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Hot on socials | GoodWatch",
		description:
			"The movies and shows people suddenly read about most, and what news, YouTube and social posts say about them.",
		url: "https://goodwatch.app/hot-on-socials",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Hot on socials on GoodWatch",
	}
	return buildMeta({ pageMeta, items: [] })
}

export default function HotOnSocials() {
	const { row } = useLoaderData<typeof loader>() as { row: TalkedRow | null }
	return <HotPage row={row} />
}

// Page changes read this route's data from the browser's cache when they can (docs/navigation-cache.md).
export const clientLoader = cachedClientLoader("routes/hot-on-socials")
