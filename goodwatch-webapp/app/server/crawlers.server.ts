import { isbot } from "isbot"

/**
 * Whether the request comes from a crawler: one that names itself in its User-Agent, or a client that isn't a browser.
 * Every current browser sends Sec-Fetch-Mode with every request to an https site, for page loads and for fetches
 * alike; scripts and scraping libraries don't. Safari before 16.4 (March 2023) doesn't send it either and counts as a
 * crawler here. Plain http, as on a development machine that isn't localhost, never carries the header, so the header
 * is only expected when the proxy says the request came over https.
 */
export const isCrawler = (request: Request) =>
	isbot(request.headers.get("user-agent")) ||
	(request.headers.get("x-forwarded-proto") === "https" &&
		!request.headers.has("sec-fetch-mode"))

// A crawler that runs a real browser and ignores nofollow can still walk the filtered views of a page. Only this many
// load at once; the rest are told to come back, which costs next to nothing. People rarely filter at the same moment.
const FILTERED_VIEWS_AT_ONCE = 4
let filteredViewsLoading = 0

// What happened to the requests for filtered views since the last report, and who asked for the ones that were served.
const MAX_COUNTED_CLIENTS = 200
let turnedAway = 0
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
 * was served most, which is how a crawler that got past `isCrawler` shows up in the logs. Resets the counts.
 */
export function reportFilteredViews(): string | null {
	if (!served && !turnedAway && !refused) return null
	let busiest = ""
	let most = 0
	for (const [client, count] of servedByClient) {
		if (count > most) {
			busiest = client
			most = count
		}
	}
	const report =
		`${served} served, ${turnedAway} crawlers turned away, ${refused} refused as busy` +
		(most ? `, ${most} of the served for "${busiest}"` : "")
	served = turnedAway = refused = 0
	servedByClient.clear()
	return report
}
