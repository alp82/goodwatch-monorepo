import { type LoaderFunctionArgs, redirect } from "@remix-run/node";
import type { ShouldRevalidateFunction } from "@remix-run/react";
import { discoverSearchPath } from "~/domain/discover-search";
import { getFeatureMode, isEnabled } from "~/server/features.server";
import { OG_IMAGE } from "~/ui/og-image/format";
import { JourneyResultsPage } from "~/ui/search/SearchJourney";
import { getUserIdFromRequest } from "~/utils/auth";
import { ogImageUrl } from "~/utils/meta";
// Not indexed, but shared links still get a preview card.
export const meta = () => [
	{ title: "Search movies and shows · GoodWatch" },
	{ name: "robots", content: "noindex, follow" },
	{ property: "og:title", content: "Search movies and shows · GoodWatch" },
	{ property: "og:image", content: ogImageUrl("/search") },
	{ property: "og:image:type", content: OG_IMAGE.type },
	{ property: "og:image:width", content: String(OG_IMAGE.width) },
	{ property: "og:image:height", content: String(OG_IMAGE.height) },
	{ name: "twitter:card", content: "summary_large_image" },
	{ name: "twitter:image", content: ogImageUrl("/search") },
];
export const headers = () => ({
	"Cache-Control": "private, no-store",
	"Referrer-Policy": "no-referrer",
});

// With the new filter bar, Search is Discover's search mode: /search?q=… moves to /discover?q=…, keeping the filters
// the two pages share. Permanent once the flag is on for everyone; temporary while only preview members see it, so a
// browser doesn't remember a redirect the flag can take back.
export async function loader({ request }: LoaderFunctionArgs) {
	const mode = getFeatureMode("filterBar");
	if (mode === "off") return null;
	const userId = (await getUserIdFromRequest({ request })) ?? null;
	if (!isEnabled("filterBar", { userId })) return null;
	const params = new URL(request.url).searchParams;
	// The redirect depends on who asks (preview members), so no cache may keep it.
	return redirect(discoverSearchPath(params), {
		status: mode === "on" ? 301 : 302,
		headers: { "Cache-Control": "private, no-store" },
	});
}

// The search page changes only its query parameters as the person types: the loader has nothing to add then.
export const shouldRevalidate: ShouldRevalidateFunction = ({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
}) =>
	currentUrl.pathname === nextUrl.pathname ? false : defaultShouldRevalidate;

export default JourneyResultsPage;
