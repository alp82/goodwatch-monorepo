import { redirect } from "@remix-run/node"
import { isbot } from "isbot"
import { BROWSER_COOKIE } from "~/utils/browser-cookie"

/** Whether the request comes from a crawler that names itself in its User-Agent. */
export const isCrawler = (request: Request) =>
	isbot(request.headers.get("user-agent"))

/**
 * Whether the request carries the cookie that every page sets with a script. A crawler that pretends to be a browser
 * (a browser User-Agent and browser headers, from a scraping library) doesn't have it.
 */
export const hasBrowserCookie = (request: Request) =>
	new RegExp(`(?:^|;\\s*)${BROWSER_COOKIE}=1(?:;|$)`).test(
		request.headers.get("cookie") ?? "",
	)

/**
 * The answer to a request for a filtered view without the browser cookie: a redirect to the browser check, which sets
 * the cookie and comes back. A navigation inside the app is told to load the check as a document.
 */
export function toBrowserCheck(url: URL): Response {
	sentToCheck++
	return redirect(
		`/browser-check?to=${encodeURIComponent(url.pathname + url.search)}`,
		{
			status: 302,
			headers: {
				"Cache-Control": "no-store",
				"X-Remix-Reload-Document": "true",
			},
		},
	)
}

// A crawler that runs a real browser and ignores nofollow can still walk the filtered views of a page. Only this many
// load at once; the rest are told to come back, which costs next to nothing. People rarely filter at the same moment.
const FILTERED_VIEWS_AT_ONCE = 4
let filteredViewsLoading = 0

// What happened to the requests for filtered views since the last report, and who asked for the ones that were served.
const MAX_COUNTED_CLIENTS = 200
let turnedAway = 0
let sentToCheck = 0
let refused = 0
let served = 0
const servedByClient = new Map<string, number>()

/** Counts a filtered view that a crawler asked for and that was answered with a redirect. */
export function countCrawlerTurnedAway(): void {
	turnedAway++
}

/** Runs `load` for a filtered view of a page, or answers 503 when too many are already loading. */
export async function limitFilteredViews<T>(
	request: Request,
	load: () => Promise<T>,
): Promise<T> {
	if (filteredViewsLoading >= FILTERED_VIEWS_AT_ONCE) {
		refused++
		throw new Response("Busy, try again shortly", {
			status: 503,
			headers: { "Retry-After": "30" },
		})
	}
	served++
	const client = (request.headers.get("user-agent") ?? "no user agent").slice(
		0,
		150,
	)
	if (servedByClient.has(client) || servedByClient.size < MAX_COUNTED_CLIENTS)
		servedByClient.set(client, (servedByClient.get(client) ?? 0) + 1)
	filteredViewsLoading++
	try {
		return await load()
	} finally {
		filteredViewsLoading--
	}
}

/**
 * One sentence on the filtered views since the last call, or null when there were none. It names the User-Agent that
 * was served most, which is how a crawler that got past the checks shows up in the logs. Resets the counts.
 */
export function reportFilteredViews(): string | null {
	if (!served && !turnedAway && !sentToCheck && !refused) return null
	let busiest = ""
	let most = 0
	for (const [client, count] of servedByClient) {
		if (count > most) {
			busiest = client
			most = count
		}
	}
	const report = `${served} served, ${sentToCheck} sent to the browser check, ${turnedAway} named crawlers turned away, ${refused} refused as busy${most ? `, ${most} of the served for "${busiest}"` : ""}`
	served = turnedAway = sentToCheck = refused = 0
	servedByClient.clear()
	return report
}
