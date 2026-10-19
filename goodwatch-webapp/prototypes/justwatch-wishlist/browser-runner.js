// Appended inside the snippet's async function after capture-core.js. Browser only.
if (location.origin !== "https://www.justwatch.com") {
	alert("Open https://www.justwatch.com in this tab first, then paste again.")
	return
}
let user = null
try {
	user = JSON.parse(localStorage.getItem("jw/user") ?? "null")
} catch {}
if (!user?.jwLoginId || typeof user.accessToken !== "string") {
	alert("Sign in to JustWatch in this tab, reload the page, then paste again.")
	return
}
let expiry = null
try {
	expiry = JSON.parse(atob(user.accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp * 1000
} catch {}
if (expiry && expiry < Date.now() + 5 * 60_000) {
	alert("Your JustWatch sign-in is about to expire. Reload the page, then paste again.")
	return
}
const country = (location.pathname.match(/^\/([a-z]{2})(?:\/|$)/)?.[1] ?? "").toUpperCase()
if (!country) {
	alert("Open your Watchlist page (for example https://www.justwatch.com/de/watchlist), then paste again.")
	return
}
const language = (document.documentElement.lang || "en").slice(0, 2).toLowerCase()
const headers = { "content-type": "application/json", authorization: `Bearer ${user.accessToken}` }
if (typeof user.jwId === "string") headers["device-id"] = user.jwId
const request = async (body) => {
	const response = await fetch(GRAPHQL_URL, { method: "POST", headers, body: JSON.stringify(body), credentials: "omit" })
	let json = null
	try {
		json = await response.json()
	} catch {}
	return { status: response.status, body: json }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const log = (label) => ({ pages, unique, total }) => console.log(`[GoodWatch] ${label}: page ${pages}, ${unique} of ${total}`)
let query = LIST_QUERY
const run = async (listType, label) => {
	let capture = await captureList({ request, query, country, language, listType, sleep, onPage: log(label) })
	if (["no-list-data", "http-400"].includes(capture.terminal) && capture.pages.length === 0 && query === LIST_QUERY) {
		console.log("[GoodWatch] JustWatch rejected the full query; retrying with the smaller one.")
		query = FALLBACK_QUERY
		capture = await captureList({ request, query, country, language, listType, sleep, onPage: log(label) })
	}
	return capture
}

console.log("[GoodWatch] Reading your Watchlist twice and your Seen list once. Don't change your lists until the file downloads.")
const first = await run("WATCHLIST", "Watchlist run 1")
await sleep(1500)
const second = await run("WATCHLIST", "Watchlist run 2")
await sleep(1500)
const seen = await run("SEENLIST", "Seen list")
const exportedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z")
const reconciled = reconcileRuns(first, second)
const shared = toSharedWishlist(reconciled.capture, { exportedAt, seen })
const bundle = {
	kind: "goodwatch-708-justwatch-capture",
	version: 1,
	capturedAt: exportedAt,
	country,
	language,
	snippet: "prototype/justwatch-roundtrip",
	watchlistRuns: [evidenceOf(first), evidenceOf(second)],
	reconciled: { chosenRun: reconciled.chosen, completeness: shared.file.completeness, reasons: shared.completenessReasons },
	seenlist: evidenceOf(seen),
	sharedFile: shared.file,
	loss: shared.loss,
	excluded: shared.excluded,
}
const blob = new Blob([JSON.stringify(bundle, null, 1)], { type: "application/json" })
const link = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "justwatch-708-capture.json" })
document.body.append(link)
link.click()
link.remove()
console.log(
	`[GoodWatch] Saved justwatch-708-capture.json. Watchlist: ${first.nodes.length} titles (${first.completeness}), second run ${second.nodes.length} (${second.completeness}), file says ${shared.file.completeness}. Seen list ${seen.nodes.length}.`,
)
