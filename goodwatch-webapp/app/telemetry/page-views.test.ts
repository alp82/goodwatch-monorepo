import assert from "node:assert/strict"
import { test } from "node:test"

const {
	PAGE_VIEW_OVERRIDES_KEY,
	applyPageViewOverrides,
	createPageViewQueue,
	createPageViewTracker,
	isNewPage,
	navigationPageviewProperties,
	pageViewTitle,
} = await import("./page-views.ts")
const { redactSearchTelemetry } = await import("../utils/search-telemetry.ts")

const ORIGIN = "https://goodwatch.app"

test("a pathname change is a new page", () => {
	assert.equal(isNewPage(`${ORIGIN}/discover`, `${ORIGIN}/movie/603`), true)
	assert.equal(isNewPage(`${ORIGIN}/movie/603`, `${ORIGIN}/movie/604`), true)
	assert.equal(isNewPage(`${ORIGIN}/`, `${ORIGIN}/discover?type=movie`), true)
})

test("a query or hash change on the same path is the same page", () => {
	const same: [string, string][] = [
		["/discover", "/discover?type=movie&withGenres=28"],
		["/discover?type=movie", "/discover?type=show"],
		[
			"/person/138-quentin-tarantino",
			"/person/138-quentin-tarantino?department=Directing",
		],
		["/movie/603-the-matrix", "/movie/603-the-matrix?tab=streaming&country=DE"],
		["/movie/603-the-matrix", "/movie/603-the-matrix#cast"],
		["/", "/?tv=picks&mood=cozy"],
		["/discover", "/discover?q=heist"],
		["/discover", "/discover"],
	]
	for (const [from, to] of same)
		assert.equal(
			isNewPage(ORIGIN + from, ORIGIN + to),
			false,
			`${from} -> ${to}`,
		)
})

test("an address that can't be read is never a new page", () => {
	assert.equal(isNewPage("not a url", `${ORIGIN}/discover`), false)
	assert.equal(isNewPage(`${ORIGIN}/discover`, ""), false)
})

test("the tracker reports each new page once, with the previous address as it was left", () => {
	const tracker = createPageViewTracker(`${ORIGIN}/discover?utm_source=x`)
	const go = (path: string, time: number, title = path) =>
		tracker.navigated({
			href: ORIGIN + path,
			title,
			time,
			navigationType: "pushState",
		})

	// The first report is the page the browser loaded.
	assert.equal(go("/discover?utm_source=x", 1), null)
	// A filter change is no page view, but the next page view names the filtered address as its referrer.
	assert.equal(go("/discover?type=movie", 2), null)
	assert.deepEqual(go("/movie/603-the-matrix", 3, "The Matrix"), {
		href: `${ORIGIN}/movie/603-the-matrix`,
		referrer: `${ORIGIN}/discover?type=movie`,
		title: "The Matrix",
		time: 3,
		navigationType: "pushState",
	})
	assert.equal(go("/movie/603-the-matrix?tab=streaming", 4), null)
	assert.equal(go("/movie/603-the-matrix#cast", 5), null)
	const back = tracker.navigated({
		href: `${ORIGIN}/discover?type=movie`,
		title: "Discover",
		time: 6,
		navigationType: "popstate",
	})
	assert.equal(back?.referrer, `${ORIGIN}/movie/603-the-matrix#cast`)
	assert.equal(back?.navigationType, "popstate")
})

test("the properties name the page and the previous page explicitly", () => {
	const properties = navigationPageviewProperties({
		href: `${ORIGIN}/movie/603-the-matrix?country=DE`,
		referrer: `${ORIGIN}/discover?type=movie`,
		title: "The Matrix",
		time: 3,
		navigationType: "pushState",
	})
	assert.deepEqual(properties, {
		$current_url: `${ORIGIN}/movie/603-the-matrix?country=DE`,
		$host: "goodwatch.app",
		$pathname: "/movie/603-the-matrix",
		$referrer: `${ORIGIN}/discover?type=movie`,
		$referring_domain: "goodwatch.app",
		navigation_type: "pushState",
		[PAGE_VIEW_OVERRIDES_KEY]: {
			title: "The Matrix",
			previousPathname: "/discover",
		},
	})
})

test("the before_send step puts the title and the previous pathname in place", () => {
	const event = {
		event: "$pageview",
		properties: {
			...navigationPageviewProperties({
				href: `${ORIGIN}/movie/603-the-matrix`,
				referrer: `${ORIGIN}/discover`,
				title: "The Matrix",
				time: 3,
				navigationType: "pushState",
			}),
			// What PostHog computed when it captured the event late, on a third page.
			title: "Quentin Tarantino",
			$prev_pageview_id: "landing",
			$prev_pageview_pathname: "/person/138-quentin-tarantino",
		},
	}
	const sent = applyPageViewOverrides(event)
	assert.equal(sent.properties.title, "The Matrix")
	assert.equal(sent.properties.$prev_pageview_pathname, "/discover")
	assert.equal(PAGE_VIEW_OVERRIDES_KEY in sent.properties, false)
	assert.equal(sent.event, "$pageview")
})

test("the landing page view keeps its own title and gets no previous page", () => {
	const sent = applyPageViewOverrides({
		event: "$pageview",
		properties: { ...pageViewTitle("GoodWatch"), title: "The Matrix" },
	})
	assert.deepEqual(sent.properties, { title: "GoodWatch" })
})

test("an event without overrides passes through as the same reference", () => {
	const event = { event: "$autocapture", properties: { $pathname: "/" } }
	assert.equal(applyPageViewOverrides(event), event)
	assert.equal(applyPageViewOverrides(null), null)
})

test("search text is redacted in the address and in the referrer", () => {
	const view = createPageViewTracker(`${ORIGIN}/discover`)
	view.navigated({
		href: `${ORIGIN}/discover?q=secret+heist&type=movie`,
		title: "Discover",
		time: 1,
		navigationType: "pushState",
	})
	const next = view.navigated({
		href: `${ORIGIN}/search?q=another+secret`,
		title: "Search",
		time: 2,
		navigationType: "pushState",
	})
	assert.ok(next)
	const sent = redactSearchTelemetry(
		applyPageViewOverrides({
			event: "$pageview",
			properties: navigationPageviewProperties(next),
		}),
	)
	assert.equal(sent.properties.$current_url, `${ORIGIN}/search?q=[redacted]`)
	assert.equal(
		sent.properties.$referrer,
		`${ORIGIN}/discover?q=[redacted]&type=movie`,
	)
	assert.equal(JSON.stringify(sent).includes("secret"), false)
})

test("the queue keeps the order and drops the oldest beyond its limit", () => {
	const queue = createPageViewQueue(2)
	const view = (time: number) => ({
		href: `${ORIGIN}/movie/${time}`,
		referrer: ORIGIN,
		title: "",
		time,
		navigationType: "pushState" as const,
	})
	queue.add(view(1))
	queue.add(view(2))
	queue.add(view(3))
	assert.deepEqual(
		queue.drain().map((v) => v.time),
		[2, 3],
	)
	assert.deepEqual(queue.drain(), [])
})
