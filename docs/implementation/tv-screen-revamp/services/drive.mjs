// Slice 6b's proof: drives the Remotes' streaming keys, home's service tiles and "On <service>" on the new TV, as a
// guest on real data and as a member on the tracking harness, and takes the screenshots.
//
// docs/implementation/tv-screen-revamp/services/README.md says how to start the two dev servers.
//
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs GUEST=http://localhost:3371 \
//   MEMBER=http://localhost:3372 node drive.mjs [checks|shots]
//
// PARTS=countries,walk,same,members,sizes,html runs some of the checks.
//
// On a machine with room for one dev server at a time: SIDE=guest with the reading server alone, then SIDE=member
// with the harness's alone. The guest's half keeps the real answers the member's half hands its page, its count
// of checks and its numbers in a file (STOCK); the member's half writes checks.json for both. `SIDE=guest node
// drive.mjs shots` and then `SIDE=member node drive.mjs shots` take the screenshots; the member's half makes the
// sheets.
//
// The repo has no browser driver: install playwright-core outside it. GUEST is a dev server of goodwatch-webapp
// that reads real data; MEMBER is one without any service, for the harness.
//
// Nothing here signs in or writes to a server: a guest's country, services and ratings are put into the browser's
// own storage, and requests that would leave the machine are stopped in the browser.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const ORIGIN = process.env.GUEST ?? "http://localhost:3371"
const GUEST = `${ORIGIN}/home-preview`
const HARNESS = `${process.env.MEMBER ?? "http://localhost:3372"}/prototype/my-library-real/tv`
const prototype = process.env.PROTOTYPE ?? "/home/alper/projects/goodwatch-monorepo-38caebf4/docs/prototypes/tv-screen-design"
const only = process.argv[2]
const SIDE = process.env.SIDE ?? "both"
const guestSide = SIDE !== "member"
const memberSide = SIDE !== "guest"
const STOCK = process.env.STOCK ?? join(tmpdir(), "tv-drive-services-stock.json")
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")

const DESKTOP = [1920, 1080]
const PHONE = [390, 844]
const BAR = ["bar:back", "bar:search", "bar:menu"]
const APPS = ["app:tonight", "app:discover", "app:explorer", "app:taste"]
const TITLE = ["watch", "want-to-see", "seen", ...BAR]
const PROGRESS_KEY = "onboarding_ratings"
/** The service screen's code, its data hook and its words, as a dev server names them. */
const SERVICE_CODE = ["/tv/screens/Service", "/tv/use-tv-service", "/tv/tv-service.ts"]
/** The Remote's own marks, by TMDB provider id, with the service's colour. Any other service shows its logo. */
const DRAWN = { 8: "rgb(229, 9, 20)", 9: "rgb(26, 152, 255)" }
const QUIET = "rgba(255, 255, 255, 0.3)"
/** The app's short name of a service, as the title page says it (utils/streaming-links.ts). */
const brandOf = (name) =>
	(/^Amazon (Prime )?Video( with Ads)?$/.test(name) ? "Prime" : name === "Apple TV Plus" ? "Apple TV" : name)
		.replace(/\s+(Amazon|Apple TV|Roku Premium)\s+Channel$/i, "")
		.replace(/\s+(Roku Premium Channel|Channel)$/i, "")
		.replace(/\s+(Standard|Basic)\s+with\s+Ads$/i, "")
		.replace(/\s+(Essential|Premium|Basic|Standard)$/i, "")
		.replace(/\s+Plus$/i, "+")

let passed = 0
const failed = []
const numbers = {}
let where = ""
const check = (ok, what) => {
	if (ok) passed += 1
	else {
		failed.push(`${where}: ${what}`)
		console.log("  FAILED", where, "-", what)
	}
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const is = (got, want, what) => check(same(got, want), `${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium", args: ["--use-angle=gl", "--ignore-gpu-blocklist"] })

/** Opens a page. A busy machine times a load out now and then: try again, twice. */
async function open(url, [width, height], { touch = width < 768, tries = 3, reducedMotion, before, room = true, storage, userAgent, locale = "en-US" } = {}) {
	const ctx = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: touch ? 2 : 1,
		reducedMotion,
		userAgent,
		// The page's country is the region of the browser's language (Accept-Language), as for any guest.
		locale,
		...(touch ? { isMobile: true, hasTouch: true } : {}),
	})
	// What a guest's browser holds before the page loads: their country and services, their progress.
	if (storage)
		await ctx.addInitScript((entries) => {
			if (sessionStorage.getItem("drive:seeded")) return
			sessionStorage.setItem("drive:seeded", "1")
			for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
		}, storage)
	const page = await ctx.newPage()
	const logs = []
	const requests = []
	const answers = []
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`)
	})
	page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`))
	page.on("request", (r) => requests.push({ url: r.url(), method: r.method(), body: r.postData() }))
	page.on("response", async (r) => {
		const path = new URL(r.url()).pathname
		if (path !== "/api/living-room/picks" && path !== "/api/discover/results") return
		answers.push({ path, search: new URL(r.url()).search, status: r.status(), method: r.request().method(), json: await r.json().catch(() => null) })
	})
	// Nothing may leave the machine but the pictures: a request to another host is stopped.
	const left = []
	await page.route(
		(u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"),
		(route) => {
			left.push(route.request().url())
			return route.fulfill({ status: 204, body: "" })
		},
	)
	// The browser's telemetry goes through the dev server to Sentry (/api/e): a drive's page views are no news.
	await page.route("**/api/e", (route) => route.fulfill({ status: 200, body: "" }))
	await before?.(page)
	try {
		await page.goto(url, { waitUntil: "load", timeout: 180000 })
		await page.waitForSelector(room ? "#room:not([data-room=unmeasured]) [data-tv-item]" : "h1", { timeout: 180000 })
	} catch (error) {
		await ctx.close().catch(() => {})
		if (tries <= 1) throw error
		console.log("loading again:", String(error.message).split("\n")[0])
		await sleep(4000)
		return open(url, [width, height], { touch, tries: tries - 1, reducedMotion, before, room, storage, userAgent, locale })
	}
	// The dev tools' round key is no part of the page.
	// (A page that is reloading itself at this moment has no head to put the rule into.)
	await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" }).catch(() => {})
	await page.waitForTimeout(600)
	return { ctx, page, logs, requests, answers, left }
}

/** What the TV and the Remote show. */
const read = (page) =>
	page.evaluate(() => {
		const room = document.getElementById("room")
		if (!room) return { search: location.search, path: location.pathname, room: false, items: [], focus: [], labels: {}, keys: [], layers: 0, text: "" }
		const layers = [...room.querySelectorAll("[data-tv-layer]")]
		const top = layers.at(-1)
		const items = top ? [...top.querySelectorAll("[data-tv-item]")] : []
		const id = (el) => el.getAttribute("data-tv-item")
		const place = top?.querySelector("[data-tv-expand-place]")
		const tv = top?.getBoundingClientRect()
		const markOf = (el) => {
			const mark = el?.querySelector("[data-service-mark]")
			return mark ? { kind: mark.dataset.serviceMark, src: mark.getAttribute("src"), loaded: mark.tagName === "IMG" ? mark.naturalWidth > 0 : null, ink: mark.tagName === "IMG" ? null : getComputedStyle(mark).backgroundColor } : null
		}
		const head = top?.querySelector("[data-tv-service-mark]")
		const edge = top?.querySelector("[data-tv-edge]")
		const at = items.find((el) => el.getAttribute("aria-current"))
		const box = at?.getBoundingClientRect()
		return {
			// As written, without the browser's escapes: the harness's `services=337,15` is `337%2C15` in the address.
			search: decodeURIComponent(location.search),
			path: location.pathname,
			room: true,
			layers: layers.length,
			items: items.map(id),
			focus: items.filter((el) => el.getAttribute("aria-current")).map(id),
			// What an item says: its label for a screen reader, else its words.
			labels: Object.fromEntries(items.map((el) => [id(el), el.getAttribute("aria-label") ?? el.textContent])),
			// A tile's picture, what it is painted with in place of it, and its service's mark.
			tiles: Object.fromEntries(
				items
					.filter((el) => el.classList.contains("tvc-tile"))
					.map((el) => {
						const img = el.querySelector("img:not([data-service-mark])")
						return [id(el), { img: img?.getAttribute("src") ?? null, loaded: Boolean(img?.naturalWidth), paint: el.querySelector("span.block")?.style.background ?? null, mark: markOf(el), words: el.textContent }]
					}),
			),
			// The focused item is inside the picture: its row has paged it into view.
			focusInView: box && tv ? box.left >= tv.left - 1 && box.right <= tv.right + 1 && box.top >= tv.top - 1 && box.bottom <= tv.bottom + 1 : null,
			// The top bar's name and what stands under it.
			name: top?.querySelector(".justify-between .truncate.font-bold")?.textContent ?? null,
			crumb: top?.querySelector(".justify-between .truncate.leading-tight")?.textContent ?? null,
			// The service's mark at the head of its screen, and the line of its colour along the top.
			head: head ? { id: Number(head.dataset.tvServiceMark), ...markOf(head) } : null,
			edge: edge ? getComputedStyle(edge).backgroundColor : null,
			// The list's focused title, or home's focused tile: its name and the line under it.
			heading: top?.querySelector(".tvc-fade .tracking-tight")?.textContent ?? null,
			facts: top?.querySelector(".tvc-fade .tracking-tight + div")?.textContent ?? null,
			text: top?.innerText ?? "",
			spoken: room.querySelector("[aria-live]")?.textContent ?? null,
			history: history.length,
			expandPlace: place ? place.childElementCount : null,
			// The picture behind the screen: the last one, once a cross-fade has brought it in.
			picture: [...(top?.querySelectorAll(":scope > .absolute.inset-0.overflow-hidden img") ?? [])].at(-1)?.getAttribute("src") ?? null,
			// The Remote's streaming keys, of whichever Remote the window has.
			keys: [...room.querySelectorAll('[aria-label="Remote control"] [data-service-key]')].map((el) => {
				const b = el.getBoundingClientRect()
				return { id: Number(el.dataset.serviceKey), label: el.getAttribute("aria-label"), pressed: el.getAttribute("aria-pressed") === "true", mark: markOf(el), words: el.textContent, width: b.width, height: b.height, form: el.closest("[data-phone-remote]")?.dataset.phoneRemote ?? "desktop" }
			}),
		}
	})

/** Waits until the TV's state says `want`, then returns the state. */
async function until(page, want, what, timeout = 20000) {
	const end = Date.now() + timeout
	let now
	for (;;) {
		now = await read(page).catch(() => null)
		if (now && want(now)) return now
		if (Date.now() > end) {
			check(false, `${what}: still ${JSON.stringify(now && { path: now.path, search: now.search, focus: now.focus, items: now.items, heading: now.heading, keys: now.keys?.map((k) => [k.id, k.pressed]) })}`)
			return now ?? { items: [], focus: [], labels: {}, tiles: {}, keys: [], text: "" }
		}
		await page.waitForTimeout(60)
	}
}
const focusIs = (item) => (s) => s.focus.length === 1 && s.focus[0] === item
/** The screen of an address is on show with all of `items`, and the focus on `item`. */
const screenIs = (search, item, items) => (s) => s.room && s.search === search && s.layers === 1 && focusIs(item)(s) && (!items || same(s.items, items))

/** A key of the keyboard, and the state once the focus is on `item`. */
async function key(page, name, item, what = `${name} moves the focus to ${item}`) {
	await page.keyboard.press(name)
	return until(page, focusIs(item), what)
}

/** A key of either Remote, by its name: the label of a key with an icon, or the word on the OK key. */
const remoteKey = (page, label) =>
	label === "OK"
		? page.locator('#room [aria-label="Remote control"] button', { hasText: /^OK$/ })
		: page.locator(`#room [aria-label="Remote control"] button[aria-label="${label}"]`)
async function remote(page, label, touch) {
	const button = remoteKey(page, label)
	if (touch) await button.tap()
	else await button.click()
}
const itemOf = (page, item) => page.locator(`#room [data-tv-layer] [data-tv-item="${item}"]`).last()
/** An item on the TV, pressed with the pointer or a finger. */
async function point(page, item, touch) {
	if (touch) await itemOf(page, item).tap()
	else await itemOf(page, item).click()
}

const tvKey = (card) => `${card.media_type}-${card.tmdb_id}`
/** A title's key from its page's address: `/show/108978-reacher`. */
const keyOfHref = (href) => /^\/(movie|show)\/(\d+)/.exec(href)?.slice(1).join("-")
/** The requests that would have left the machine, without the site's own telemetry. */
const beyondTelemetry = (left) => [...new Set(left.map((u) => new URL(u).hostname))].filter((host) => !/posthog|sentry|googletagmanager|google-analytics|cloudflareinsights/.test(host))
// What a dev server's console says on any page.
const noise = (logs) => logs.filter((l) => !l.includes("Future Flag") && !l.includes("net::ERR_FAILED") && !l.includes("503") && !l.includes("Failed to load resource") && !l.includes("Swiper Loop Warning"))

/** The first titles on the Discover page, by key, and what it shows as chosen. */
const discoverPage = (page) =>
	page.evaluate(() => {
		const links = [...(document.querySelector("main") ?? document.body).querySelectorAll('a[href^="/movie/"], a[href^="/show/"]')].map((a) => a.getAttribute("href"))
		return {
			path: location.pathname,
			search: location.search,
			titles: [...new Set(links)],
			// A chosen filter is a chip that can be removed.
			chips: [...new Set([...document.querySelectorAll("button[aria-label^='Remove ']")].map((button) => button.getAttribute("aria-label").slice(7)))],
		}
	})

/**
 * The Discover page once it shows `want` as its first four titles. The page draws its loader's titles first, which
 * are a visitor's nobody knows anything about, and asks again with the person's progress and services once it has
 * read them: wait for that answer, as long as a busy dev server may take.
 */
async function settled(page, want, timeout = 45000) {
	const end = Date.now() + timeout
	let now
	for (;;) {
		now = await discoverPage(page).catch(() => null)
		if (now && same(now.titles.slice(0, 4).map(keyOfHref), want)) return now
		if (Date.now() > end) return now ?? { titles: [], chips: [], path: "", search: "" }
		await page.waitForTimeout(250)
	}
}

/** The boxes of the topmost layer on the window, as they are drawn at rest (a focused key grows a little). */
const layout = (page) =>
	page.evaluate(() => {
		const room = document.getElementById("room")
		const layer = [...room.querySelectorAll("[data-tv-layer]")].at(-1)
		const tv = layer.getBoundingClientRect()
		const k = tv.width / layer.offsetWidth
		const rest = (el) => {
			const b = el.getBoundingClientRect()
			const [w, h] = [el.offsetWidth * k, el.offsetHeight * k]
			const [x, y] = [b.left + b.width / 2 - w / 2, b.top + b.height / 2 - h / 2]
			return { left: x, top: y, right: x + w, bottom: y + h, width: w, height: h }
		}
		const place = layer.querySelector("[data-tv-expand-place]")
		const heading = layer.querySelector(".tvc-fade .tracking-tight")
		return {
			k,
			tv: { left: tv.left, top: tv.top, right: tv.right, bottom: tv.bottom },
			items: [...layer.querySelectorAll("[data-tv-item]")].map((el) => ({
				id: el.getAttribute("data-tv-item"),
				...rest(el),
				// What a key says is cut short where it does not fit: a line that is cut off, or words wider than their key.
				cut: [...el.querySelectorAll(".truncate")].some((text) => text.scrollWidth > text.clientWidth + 1) || [...el.querySelectorAll("span.block")].some((text) => text.scrollWidth > text.clientWidth + 1),
			})),
			// A box that cuts off what does not fit (the Frame's content on the phone) holds more than it shows.
			clipped: [...layer.querySelectorAll(".overflow-hidden")].filter((el) => !el.hasAttribute("data-tv-row") && el.scrollHeight > el.clientHeight + 1).length,
			heading: heading ? rest(heading) : null,
			place: place ? rest(place) : null,
			// The smallest type on the screen, in canvas pixels.
			type: Math.min(...[...layer.querySelectorAll("*")].filter((el) => [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())).map((el) => Number.parseFloat(getComputedStyle(el).fontSize))),
		}
	})

const meet = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
const within = (a, b) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5

/**
 * A screen holds what it shows: touch targets, nothing over anything, nothing cut off, the corner free. A row
 * that pages holds more than it shows: its items count while they are in view (`row`).
 */
function fits(l, what, { touch = false, corner = true, row = false } = {}) {
	const shown = row ? l.items.filter((item) => !row.test(item.id) || within(item, l.tv)) : l.items
	const small = shown.filter((item) => Math.min(item.width, item.height) < 44 - 0.05)
	if (touch) check(small.length === 0, `${what}: every key is 44 px or more on the phone's screen: ${small.map((item) => `${item.id} ${item.width.toFixed(1)} x ${item.height.toFixed(1)}`).join(", ") || "all"}`)
	const out = shown.filter((item) => !within(item, l.tv))
	check(out.length === 0, `${what}: every key is inside the picture: ${out.map((item) => item.id).join(", ") || "all"}`)
	const over = shown.flatMap((a, n) => shown.slice(n + 1).filter((b) => meet(a, b)).map((b) => `${a.id} and ${b.id}`))
	check(over.length === 0, `${what}: no key lies over another: ${over.join(", ") || "none"}`)
	check(l.clipped === 0, `${what}: nothing is cut off by its box`)
	const cut = shown.filter((item) => item.cut)
	check(cut.length === 0, `${what}: every key says its words in full: ${cut.map((item) => item.id).join(", ") || "all"}`)
	if (l.heading) check(within(l.heading, l.tv) && !shown.some((item) => meet(item, l.heading)), `${what}: the focused one's name is inside the picture and under no key`)
	check(l.type >= 20, `${what}: no type under 20 canvas px: ${l.type}`)
	if (corner) {
		if (l.place) {
			// The Expand key's cell: 158 canvas px wide on the phone, 220 on the desktop, as tall as a key.
			const size = touch ? [158, 54] : [220, 64]
			const cell = { right: l.place.right, bottom: l.place.bottom, left: l.place.right - size[0] * l.k, top: l.place.bottom - Math.max(size[1] * l.k, touch ? 44 : 0) }
			const inCorner = l.items.filter((item) => meet(item, cell))
			check(inCorner.length === 0, `${what}: the Expand key's corner is free: ${inCorner.map((item) => item.id).join(", ") || "free"}`)
		} else check(false, `${what}: the Expand key's corner is there`)
	}
	return { key: Math.min(...shown.map((item) => Math.min(item.width, item.height))) }
}

const guestOf = (rest = {}) => ({ interactions: [], country: "US", services: null, ...rest })
const json = (body) => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
/** Discover's own results for a filter bar query and a guest, as the Discover page asks for them. */
const results = async (query, guest = guestOf()) => (await fetch(`${ORIGIN}/api/discover/results?${query}&page=1`, json({ guest }))).json()
const titlesOf = (s) => s.items.filter((item) => item.startsWith("title:")).map((item) => item.slice(6))
const listed = (count = 12) => (s) => titlesOf(s).length === count
const pressed = (s) => s.keys.filter((key) => key.pressed).map((key) => key.id)
const serviceTv = (id) => `tv=service&service=${id}`

// What the guest's half keeps for the member's half: real answers, the count of checks and the numbers.
const stock = existsSync(STOCK) ? JSON.parse(readFileSync(STOCK, "utf8")) : { results: {}, passed: 0, failed: [], numbers: {} }
/** The reading server's results for a visitor nobody knows anything about, by the query the harness's page asks with. */
async function realResults(search) {
	if (!guestSide) return stock.results[search] ?? { status: 503, body: JSON.stringify({ error: `Not kept: ${search}` }) }
	const response = await fetch(`${ORIGIN}/api/discover/results${search}`)
	return { status: response.status, body: await response.text() }
}
/** The harness has no title snapshot, so its Discover answers 503: its page is handed the reading server's answer. */
const handIn = (p) =>
	p.route("**/api/discover/results*", async (route) => {
		const { search } = new URL(route.request().url())
		const response = await realResults(search)
		return route.fulfill({ status: response.status, contentType: "application/json", body: response.body })
	})

/** The loader's answer alone, for the browser's language: what the page knows of the person's services. */
async function loaderOf(language, agent) {
	const start = performance.now()
	const response = await fetch(`${GUEST}?_data=routes%2Fhome-preview`, { headers: { "Accept-Language": language, ...(agent && { "User-Agent": agent }) } })
	const data = await response.json()
	return { data, ms: performance.now() - start }
}

// ---------------------------------------------------------------------------------------------------------
// The two services by country, what a guest's HTML holds of them, and what they cost the guest's loader.

const AGENTS = {
	browser: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
	googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
	iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
}
const htmlOf = async (query, language, agent = "browser") => (await fetch(`${GUEST}${query}`, { headers: { "User-Agent": AGENTS[agent], "Accept-Language": language } })).text()
const idsIn = (text) => [...text.matchAll(/data-tv-item="([^"]+)"/g)].map((m) => m[1])
/** A guest's HTML without what the services put into it: their two tiles, in both editions, and the loader's data. */
const withoutServices = (text) =>
	text
		.replace(/<button type="button" data-tv-item="service:\d+".*?<\/button>/g, "")
		.replace(/(\\?"services\\?":)\[(\{[^\]]*\})?\]/g, "$1[]")
/** Without the country the page names in the root's `locale`, which is the only part of it that differs by country. */
const withoutCountry = (text) => text.replace(/(\\?"country\\?":\\?")[A-Z]{2}(\\?")/g, "$1--$2")
/** The default keys, as the loader gives them: the Remote has a drawn mark for both. */
const DEFAULT_KEYS = [
	[8, "Netflix", null],
	[9, "Prime", null],
]

async function countries() {
	where = "the two services in every country"
	console.log(where)
	// A guest's two services are Netflix and Prime Video, in every country: nothing is read for them.
	for (const language of ["en-US", "en-DE", "en-GB", "en-FR", "pt-BR", "en-JP", "en-IN", "en-ZZ", "en"]) {
		const { data } = await loaderOf(language)
		is(data.services.map((service) => [service.id, service.name, service.logo_path]), DEFAULT_KEYS, `${language}: a guest's two services are Netflix and Prime Video`)
		is(data.member, false, `${language}: a guest`)
	}

	// The HTML: the same for every guest, whatever asks for it and wherever they are.
	where = "a guest's HTML in every country"
	console.log(where)
	const pages = {}
	for (const country of ["US", "FR", "BR"]) {
		const texts = await Promise.all(Object.keys(AGENTS).map((agent) => htmlOf("", `en-${country}`, agent)))
		check(texts.every((text) => text === texts[0]), `${country}: the same HTML for a browser, Googlebot and an iPhone`)
		pages[country] = texts[0]
		is(idsIn(texts[0]).filter((id) => id.startsWith("service:")), ["service:8", "service:9", "service:8", "service:9"], `${country}: the two services' tiles are in the HTML, once per edition`)
		is((texts[0].match(/<h1/g) ?? []).length, 2, `${country}: one H1 per edition`)
		numbers[`a guest's HTML of /home-preview in ${country}, bytes`] = texts[0].length
	}
	numbers["of which the two services (tiles in both editions and the loader's data), bytes"] = pages.US.length - withoutServices(pages.US).length
	for (const country of ["FR", "BR"]) {
		const [a, b] = [withoutCountry(pages.US), withoutCountry(pages[country])]
		let at = 0
		while (at < a.length && a[at] === b[at]) at++
		check(a === b, `US and ${country}: the same HTML but for the country the root's locale names${a === b ? "" : `: ${JSON.stringify(a.slice(at - 60, at + 120))} against ${JSON.stringify(b.slice(at - 60, at + 120))}`}`)
	}

	// What the services cost a guest's loader: nothing is read for them, so a country this server process has
	// never been asked for answers as fast as one it has. The loader's answer alone, without the page's render.
	where = "what the services cost the loader"
	console.log(where)
	const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)]
	await loaderOf("en-US")
	const warm = []
	for (let n = 0; n < 15; n++) warm.push((await loaderOf("en-US")).ms)
	const fresh = []
	for (const country of ["NL", "SE", "IT", "ES", "MX", "AU", "CA", "PL"]) {
		const first = (await loaderOf(`en-${country}`)).ms
		const again = (await loaderOf(`en-${country}`)).ms
		fresh.push({ country, first: Math.round(first), again: Math.round(again) })
	}
	numbers["the loader's answer as a guest, ms (median of 15)"] = Math.round(median(warm) * 10) / 10
	numbers["the loader's answer for a country never asked for in this process, and right after, ms"] = fresh
	check(median(fresh.map((one) => one.first)) <= median(fresh.map((one) => one.again)) + 50, "a country's first answer is as fast as its second: nothing is read for the services")
}

// ---------------------------------------------------------------------------------------------------------
// The walk: the Remote's two keys, home's two tiles, "On <service>", a title and back. The same for a guest and a
// member, on the desktop and on the phone.

async function walk(who, url, size, { locale = "en-US" } = {}) {
	const member = who.startsWith("member")
	const phone = size[0] < 768
	const base = new URL(url).search.slice(1)
	const at = (tv) => (base || tv ? `?${[base, tv].filter(Boolean).join("&")}` : "")
	const press = phone ? "a tap" : "a click"
	where = `${who} ${size.join("x")}`
	console.log(where)
	const { ctx, page, logs, requests, answers, left } = await open(url, size, { storage: member ? undefined : { country: locale.slice(3) }, before: member ? handIn : undefined, locale })
	const asked = (part) => requests.filter((r) => r.url.includes(part))
	const code = () => SERVICE_CODE.flatMap(asked)
	const lists = () => asked("/api/discover/results")
	/** The requests for one service's titles. */
	const listsOf = (id) => lists().filter((r) => new URL(r.url).searchParams.get("services") === String(id))
	const key = (id) => page.locator(`#room [aria-label="Remote control"] [data-service-key="${id}"]`)
	const pressKey = (id) => (phone ? key(id).tap() : key(id).click())

	// ---- Arrival: the keys and the tiles are the person's two services; nothing of a service is asked for.
	let s = await read(page)
	const apps = member ? [...APPS, "app:shows"] : APPS
	const [a, b] = s.keys
	is(s.keys.length, 2, "the Remote has two streaming keys")
	is(s.items, [...apps, `service:${a?.id}`, `service:${b?.id}`, "bar:search", "bar:menu"], "home: the apps, then a tile per service of the Remote's keys, in their order")
	is(s.focus, ["app:tonight"], "the focus starts on Tonight's tile")
	is(pressed(s), [], "no key is pressed on home")
	check(s.keys.every((one) => /^On \S/.test(one.label)), `each key says what it opens: ${s.keys.map((one) => one.label).join(", ")}`)
	for (const one of s.keys) {
		const tile = s.tiles[`service:${one.id}`]
		is(s.labels[`service:${one.id}`], one.label, `${one.label}: the tile says what the key says`)
		is(tile?.mark?.kind, one.mark?.kind, `${one.label}: the tile and the key show the same mark`)
		if (DRAWN[one.id]) {
			is(one.mark?.kind, "drawn", `${one.label}: the Remote's own drawn mark`)
			check(one.words === "" && !tile.words.trim(), `${one.label}: the drawn mark says the name; it is not written beside it`)
		} else {
			is(one.mark?.kind, "logo", `${one.label}: the catalog's logo`)
			check(one.mark.src.startsWith("https://image.tmdb.org/t/p/w92/") && one.mark.src === tile.mark.src, `${one.label}: the logo's file is the catalog's, the same on the key and the tile`)
			is(tile.words.trim(), one.label.slice(3), `${one.label}: the tile names the service beside its logo`)
		}
	}
	numbers[`${where}: the keys`] = s.keys.map((one) => `${one.label}, ${one.mark?.kind}, ${one.width.toFixed(0)} x ${one.height.toFixed(0)} px`)
	if (phone) check(s.keys.every((one) => one.width >= 44 - 0.05 && one.height >= 44 - 0.05), "both keys are 44 px or more in both directions")
	is(code().length, 0, "the service screen's code, its data hook and its words are not in the first view")
	is(lists().length, 0, "no titles are asked for on arrival")
	const depth = s.history

	// ---- The first interaction asks for the code a streaming key needs, so it is there by the first press.
	s = await key2(page, "ArrowRight", "app:discover")
	await until(page, () => asked(SERVICE_CODE[0]).length > 0, "the service screen's code is asked for at the first interaction")
	is(lists().length, 0, "and still no titles")

	// ---- Home's tiles: Right along the row reaches the first service's tile, then the second's, where it stays.
	for (const item of apps.slice(2)) s = await key2(page, "ArrowRight", item)
	s = await key2(page, "ArrowRight", `service:${a.id}`)
	is(s.heading, a.label.slice(3), "home shows the service large, by its name")
	is(s.facts, `What to watch on ${a.label.slice(3)}.`, "and says what its tile opens")
	await until(page, (x) => focusIs(`service:${a.id}`)(x) && x.focusInView, "the row pages the tile into view")
	s = await key2(page, "ArrowRight", `service:${b.id}`)
	is(s.facts, `What to watch on ${b.label.slice(3)}.`, "the second service's line")
	await until(page, (x) => focusIs(`service:${b.id}`)(x) && x.focusInView, "the row pages the second service's tile into view")
	await page.keyboard.press("ArrowRight")
	await page.waitForTimeout(250)
	s = await until(page, focusIs(`service:${b.id}`), "Right on the last tile stays")
	is(s.history, depth, "no move added a history entry")
	if (!member) {
		// The pool is there after the first interaction: a tile shows a title that streams on its service.
		s = await until(page, (x) => Object.entries(x.tiles).some(([id, tile]) => id.startsWith("service:") && tile.loaded), "a service's tile gets a picture from the pool", 90000)
		const tile = s.tiles[`service:${b.id}`]
		if (tile.img) {
			const pooled = answers.find((answer) => answer.path === "/api/living-room/picks")?.json?.suggestions ?? []
			const there = pooled.filter((card) => card.services?.some((service) => service.id === b.id)).map((card) => card.backdrop_path)
			check(there.some((path) => tile.img.endsWith(path)), `${b.label}'s tile shows a title of the pool that streams there`)
			s = await until(page, (x) => x.picture?.endsWith(tile.img.split("/").pop()), "with the focus on it, its picture is behind the screen")
			check(s.picture.includes(phone ? "/w780/" : "/w1280/"), `the picture is the ${phone ? "w780" : "w1280"} file`)
		} else check(/color-mix|linear-gradient/.test(tile.paint ?? ""), `${b.label}'s tile is painted, with no title of the pool on it`)
		check(!s.tiles[`service:${a.id}`].img || s.tiles[`service:${a.id}`].img !== tile.img || !tile.img, "the two tiles show two pictures")
	} else check(Object.entries(s.tiles).filter(([id]) => id.startsWith("service:")).every(([, tile]) => /color-mix|linear-gradient/.test(tile.paint ?? "") || tile.img), "without the pool a service's tile is its own colour, or the dark of the room")

	// ---- OK on a tile opens "On <service>": one history entry, the service's key pressed, its titles asked for once.
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at(serviceTv(b.id)) && titlesOf(x).length > 0, `OK on the tile opens ${b.label}`, 90000)
	is(s.history, depth + 1, "one history entry")
	is(pressed(s), [b.id], "the service's key on the Remote shows that it is on, and the other does not")
	const asks = lists()
	is(asks.length, 1, "the titles are asked for once")
	is(new URL(asks[0].url).search, `?services=${b.id}&page=1`, "as the Discover page asks for that one service")
	if (member) is([asks[0].method, asks[0].body], ["GET", null], "a member asks with GET")
	else {
		is(asks[0].method, "POST", "a guest asks with POST")
		is(Object.keys(JSON.parse(asks[0].body).guest).sort(), ["country", "interactions", "services"], "and sends their browser's progress, country and services")
	}
	/** Discover's answer for a service, as the page got it. It is read a moment after the page has it. */
	const answerOf = async (id) => {
		const got = () => answers.filter((one) => one.path === "/api/discover/results" && one.search === `?services=${id}&page=1`).at(-1)?.json
		for (let n = 0; n < 200 && !got(); n++) await sleep(50)
		return got() ?? { cards: [], total: 0 }
	}
	let answer = await answerOf(b.id)
	is(titlesOf(s), (answer?.cards ?? []).slice(0, 12).map(tvKey), "the titles are the first twelve cards of the answer, in its order")
	is(s.items, [...titlesOf(s).map((title) => `title:${title}`), ...BAR], "the screen's items: the titles, then the bar")
	is(s.focus, [`title:${titlesOf(s)[0]}`], "the focus starts on the first title")
	const drawn = Boolean(DRAWN[b.id])
	if (phone) is([s.name, s.crumb], [drawn ? "To watch" : b.label, null], "the phone's bar: the mark and a few words")
	else is([s.name, s.crumb], [b.label, `${answer.total.toLocaleString("en-US")} titles`], "the bar says On <service> and how many titles Discover has")
	is(s.head?.kind, b.mark.kind, "the service's mark leads the top bar, the mark its key has")
	is(s.edge, DRAWN[b.id] ?? QUIET, "a line of the service's colour runs along the top edge")
	is(s.heading, s.labels[s.focus[0]], "the screen names the focused title")
	check(/ score/.test(s.facts ?? "") && !/ · On /.test(s.facts ?? ""), `with its facts, and not where it streams: ${s.facts}`)
	is(s.expandPlace, 0, "the Expand key's corner is there and empty")
	numbers[`${where}: ${b.label}`] = { titles: titlesOf(s).length, total: answer.total, first: s.heading, facts: s.facts }

	// ---- The row pages: Right through all twelve, each in view when it has the focus.
	const all = titlesOf(s)
	let inView = true
	for (const title of all.slice(1)) {
		s = await key2(page, "ArrowRight", `title:${title}`)
		await page.waitForTimeout(phone ? 420 : 380)
		inView &&= (await read(page)).focusInView
	}
	check(inView, "every title is inside the picture when it has the focus")
	s = await read(page)
	is(s.heading, s.labels[`title:${all.at(-1)}`], "the name follows the focus to the last title")
	is(s.history, depth + 1, "no move added a history entry")
	is(lists().length, 1, "and nothing was asked for again")
	await page.keyboard.press("ArrowUp")
	s = await until(page, (x) => x.focus[0]?.startsWith("bar:"), "Up from a title reaches the bar")
	await page.keyboard.press("ArrowDown")
	s = await until(page, (x) => x.focus[0]?.startsWith("title:") && x.focusInView, "Down from the bar returns to a title in view")

	// ---- Back leaves, with the focus on the tile it came from.
	const leftOn = s.focus[0]
	await page.keyboard.press("Escape")
	s = await until(page, screenIs(at(""), `service:${b.id}`), "Back returns to home with the focus on the service's tile")
	is(pressed(s), [], "no key is pressed on home")

	// ---- The Remote's key opens its service's screen; the other key takes its place; the same key again leaves.
	await pressKey(a.id)
	s = await until(page, (x) => x.search === at(serviceTv(a.id)) && titlesOf(x).length > 0, `${press} on the Remote's first key opens ${a.label}`, 90000)
	is(s.history, depth + 1, "one history entry")
	is(pressed(s), [a.id], "the key shows that it is on")
	is(listsOf(a.id).length, 1, "its titles are asked for once")
	answer = await answerOf(a.id)
	is(titlesOf(s), (answer?.cards ?? []).slice(0, 12).map(tvKey), "they are the first twelve of Discover's answer for that service")
	is(s.head?.id, a.id, "under the first service's mark")
	const first = titlesOf(s)
	await pressKey(b.id)
	s = await until(page, (x) => x.search === at(serviceTv(b.id)) && same(pressed(x), [b.id]) && titlesOf(x).length > 0 && !same(titlesOf(x), first), `the other key shows ${b.label} in its place`, 90000)
	is(s.history, depth + 1, "in place: no history entry more")
	is(pressed(s), [b.id], "the other key is on now, and the first is not")
	is(titlesOf(s), all, "with that service's titles")
	is(listsOf(b.id).length, 1, "which are still known: nothing is asked for again")
	is(s.focus, [`title:${all[0]}`], `the focus starts over on the first title (it was left on ${leftOn.slice(6)})`)
	await pressKey(b.id)
	s = await until(page, (x) => x.search === at("") && x.items.includes("app:tonight"), "the same key again leaves the screen")
	is(pressed(s), [], "and is no longer on")
	is(s.history, depth + 1, "by going back: the history is as long as before")
	is(s.focus, [`service:${b.id}`], "home has its focus back")

	// ---- A key works from any screen, and with the menu open.
	await page.keyboard.press("m")
	s = await until(page, (x) => x.layers === 2, "the menu is open")
	await pressKey(a.id)
	s = await until(page, (x) => x.search === at(serviceTv(a.id)) && x.layers === 1 && titlesOf(x).length > 0, "a key opens its screen over the open menu, which closes", 60000)
	is(pressed(s), [a.id], "its key is on")

	// ---- A title opens its title screen, named at once from what the list knew; Back returns to the list.
	const third = first[2]
	s = await key2(page, "ArrowRight", `title:${first[1]}`)
	s = await key2(page, "ArrowRight", `title:${third}`)
	const name = s.heading
	await page.keyboard.press("Enter")
	s = await until(page, (x) => x.search === at(`tv=title&title=${third}`) && !titlesOf(x).length && x.text.includes(name), "OK on a title opens its title screen, named at once", 30000)
	is(pressed(s), [], "no streaming key is on over a title")
	await until(page, (x) => same(x.items, TITLE), "the title screen's keys", 60000)
	await page.keyboard.press("Escape")
	s = await until(page, (x) => x.search === at(serviceTv(a.id)) && focusIs(`title:${third}`)(x), "Back returns to the list with the focus on that title", 30000)
	is(titlesOf(s), first, "the same titles")
	is(listsOf(a.id).length, 1, "from memory: not asked for again")
	is(pressed(s), [a.id], "and the key is on again")

	// ---- A reload gives the screen back, with its focus and its key.
	await page.reload({ waitUntil: "load", timeout: 180000 })
	await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
	s = await until(page, (x) => x.search === at(serviceTv(a.id)) && focusIs(`title:${third}`)(x), "a reload shows the list again with its focus", 90000)
	is(pressed(s), [a.id], "and its key on")
	is(s.spoken, a.label, "the screen is read out by the service's name")
	// The same key on a screen that was reloaded still leaves by going back.
	await pressKey(a.id)
	s = await until(page, (x) => x.search === at("") && x.items.includes("app:tonight"), "the same key leaves the reloaded screen")

	// ---- The pointer and a finger on a tile.
	if (phone) await itemOf(page, `service:${a.id}`).tap()
	else {
		await itemOf(page, `service:${a.id}`).hover()
		s = await until(page, focusIs(`service:${a.id}`), "the pointer over a service's tile gives it the focus")
		is(s.search, at(""), "and opens nothing")
		await itemOf(page, `service:${a.id}`).click()
	}
	s = await until(page, (x) => x.search === at(serviceTv(a.id)) && titlesOf(x).length > 0, `${press} on the tile opens ${a.label}`, 60000)
	is(pressed(s), [a.id], "its key is on")
	await remote(page, "Home", phone)
	s = await until(page, (x) => x.search === at("") && x.items.includes("app:tonight"), "the Remote's Home key shows home")
	is(pressed(s), [], "no key is on")

	is(noise(logs), [], "nothing in the console")
	is(beyondTelemetry(left), [], "no request left the machine but the site's own telemetry, which was stopped")
	await ctx.close()
}

/** A key of the keyboard, and the state once the focus is on `item`. */
async function key2(page, name, item, what = `${name} moves the focus to ${item}`) {
	await page.keyboard.press(name)
	return until(page, focusIs(item), what)
}

// ---------------------------------------------------------------------------------------------------------
// Links: a service's screen by its address, the key on a deep link, a service that is none of the person's two.

async function links() {
	where = "links to a service"
	console.log(where)
	const { data } = await loaderOf("en-US")
	const [a] = data.services
	let { ctx, page } = await open(`${GUEST}?${serviceTv(a.id)}`, DESKTOP, { storage: { country: "US" } })
	let s = await until(page, (x) => titlesOf(x).length > 0, "a link to a service shows its titles", 90000)
	is(pressed(s), [a.id], "with its key on")
	const depth = s.history
	await page.locator(`#room [data-service-key="${a.id}"]`).click()
	s = await until(page, (x) => x.search === "" && x.items.includes("app:tonight"), "the key on a deep link shows home in its place")
	is(s.history, depth, "in place: Back does not return to the service")
	is(pressed(s), [], "and no key is on")
	await ctx.close()
	// A service a link names that is none of the person's two: its titles name it, and no key is on.
	const other = [15, 337, 1899, 531].find((id) => !data.services.some((service) => service.id === id))
	const answer = await results(`services=${other}`)
	const named = answer.cards?.flatMap((card) => card.services ?? []).find((service) => service.id === other)
	;({ ctx, page } = await open(`${GUEST}?${serviceTv(other)}`, DESKTOP, { storage: { country: "US" } }))
	s = await until(page, (x) => titlesOf(x).length > 0, "a link to another service shows its titles", 90000)
	is(titlesOf(s), answer.cards.slice(0, 12).map(tvKey), "the first twelve of Discover's answer for it")
	is(s.name, `On ${brandOf(named.name)}`, "the screen names the service as its titles do")
	is(s.head?.kind, "logo", "with the catalog's logo")
	is(s.edge, QUIET, "and a quiet line")
	is(pressed(s), [], "no key is on: neither stands for it")
	numbers["a link to a service that is none of the person's two"] = `${s.name}, ${answer.total} titles`
	// Either key takes its place.
	await page.locator(`#room [data-service-key="${a.id}"]`).click()
	// (The address changes a moment before the screen does: wait for the key, which changes with the screen.)
	s = await until(page, (x) => x.search === `?${serviceTv(a.id)}` && same(pressed(x), [a.id]) && titlesOf(x).length > 0, "a key takes the linked service's place", 60000)
	is(pressed(s), [a.id], "and is on")
	await ctx.close()
	// What is no service's id is home.
	;({ ctx, page } = await open(`${GUEST}?tv=service&service=Netflix`, DESKTOP, { storage: { country: "US" } }))
	s = await read(page)
	is(s.items.slice(0, 4), APPS, "a link without a service's id shows home")
	await ctx.close()
}

// ---------------------------------------------------------------------------------------------------------
// The TV's titles are the first of Discover's own address for the same person, and the Expand key's effect opens
// that address with the service shown as chosen.

async function sameAsDiscover() {
	const { data } = await loaderOf("en-US")
	const [a, b] = data.services
	const rated = [
		{ media_type: "show", tmdb_id: 1396, type: "score", score: 9, timestamp: 1 },
		{ media_type: "show", tmdb_id: 549, type: "score", score: 8, timestamp: 2 },
		{ media_type: "movie", tmdb_id: 603, type: "score", score: 9, timestamp: 3 },
	]
	// Three people: nobody; a guest with another service saved, where On my services would narrow Discover; a guest
	// with a service saved and ratings, where Not seen yet narrows too.
	const samples = [
		[a, { who: "a guest nobody knows", storage: { country: "US" }, guest: guestOf() }],
		[b, { who: "a guest with another service saved", storage: { country: "US", withStreamingProviders: "15" }, guest: guestOf({ services: "15" }) }],
		[a, { who: "a guest with a service saved and three ratings", storage: { country: "US", withStreamingProviders: String(a.id), [PROGRESS_KEY]: JSON.stringify(rated) }, guest: guestOf({ services: String(a.id), interactions: rated }) }],
	]
	for (const [service, person] of samples) {
		where = `On ${service.name} for ${person.who}`
		console.log(where)
		const { ctx, page } = await open(`${GUEST}?${serviceTv(service.id)}`, DESKTOP, { storage: person.storage })
		let s = await until(page, (x) => titlesOf(x).length > 0, "the TV's titles", 90000)
		const tv = titlesOf(s)
		numbers[`${where}: on the TV`] = tv.slice(0, 4).map((item) => s.labels[`title:${item}`])
		const answer = await results(`services=${service.id}`, person.guest)
		is(tv, (answer.cards ?? []).slice(0, 12).map(tvKey), "they are the first twelve of /api/discover/results for the same person")
		is(answer.state?.services, [service.id], "the request is for that one service")
		is(answer.state?.onMyServices, false, "with On my services off")
		numbers[`${where}: Discover has`] = answer.total

		// The Discover page at the address the Expand key opens, in the same browser.
		const other = await ctx.newPage()
		await other.route((u) => !["localhost", "127.0.0.1", "image.tmdb.org"].includes(u.hostname) && u.protocol.startsWith("http"), (route) => route.fulfill({ status: 204, body: "" }))
		await other.route("**/api/e", (route) => route.fulfill({ status: 200, body: "" }))
		await other.goto(`${ORIGIN}/discover?services=${service.id}`, { waitUntil: "load", timeout: 180000 })
		await other.waitForSelector('a[href^="/movie/"], a[href^="/show/"]', { timeout: 120000 })
		let d = await settled(other, tv.slice(0, 4))
		is(d.titles.slice(0, 12).map(keyOfHref), tv, "they are the first twelve titles on the Discover page for that service, in the same order")
		numbers[`${where}: what the Discover page shows as chosen`] = d.chips
		// The page's chip for chosen services names one that is the person's own, and counts any other.
		check(d.chips.some((chip) => /^1 service$/.test(chip) || chip.includes(service.name)), `the Discover page shows the one service as chosen: ${d.chips.join(", ")}`)
		await other.close()

		// The Expand key's effect on the TV: that page. The key itself is slice 11's and is not drawn; the script
		// reaches it with `focus=expand`.
		await page.goto(`${GUEST}?${serviceTv(service.id)}&focus=expand`, { waitUntil: "load", timeout: 180000 })
		await until(page, (x) => titlesOf(x).length > 0, "the list again", 90000)
		await page.keyboard.press("Enter")
		await page.waitForURL((u) => u.pathname === "/discover", { timeout: 120000 })
		await page.waitForSelector('a[href^="/movie/"], a[href^="/show/"]', { timeout: 120000 })
		d = await settled(page, tv.slice(0, 4))
		is([d.path, d.search], ["/discover", `?services=${service.id}`], "the Expand key's effect opens Discover with that one service")
		is(d.titles.slice(0, 12).map(keyOfHref), tv, "and the page it opens starts with the TV's twelve titles")
		await page.goBack()
		s = await until(page, (x) => x.room && x.search === `?${serviceTv(service.id)}&focus=expand` && titlesOf(x).length > 0, "Back returns to the service on the TV", 90000)
		is(titlesOf(s), tv, "with the same titles")
		is(pressed(s), [service.id], "and its key on")
		await ctx.close()
	}
}

// ---------------------------------------------------------------------------------------------------------
// A guest in other countries, in a browser: the keys and the tiles are that country's first two.

async function abroad() {
	for (const country of ["FR", "BR"]) {
		where = `a guest in ${country}`
		console.log(where)
		const { ctx, page, logs } = await open(GUEST, DESKTOP, { storage: { country }, locale: `en-${country}` })
		const s = await read(page)
		is(s.keys.map((key) => [key.id, key.label, key.mark?.kind]), [[8, "On Netflix", "drawn"], [9, "On Prime", "drawn"]], "the Remote's keys are Netflix and Prime Video, as everywhere")
		is(s.items.slice(4, 6), ["service:8", "service:9"], "and so are home's tiles")
		is(noise(logs), [], "nothing in the console")
		await ctx.close()
	}
}

// ---------------------------------------------------------------------------------------------------------
// A member with two, one and no saved services, and with services the Remote has no mark for (the harness).

async function members() {
	const setups = [
		["two saved services, Netflix and Prime Video", "", [[8, "On Netflix", "drawn"], [9, "On Prime", "drawn"]]],
		["two saved services the Remote has no mark for", "&services=337,15", [[337, "On Disney+", "logo"], [15, "On Hulu", "logo"]]],
		["the order they saved them in", "&services=9,337,8", [[9, "On Prime", "drawn"], [337, "On Disney+", "logo"]]],
		["one saved service", "&services=15", [[15, "On Hulu", "logo"], [8, "On Netflix", "drawn"]]],
		["one saved service that is a default key", "&services=8", [[8, "On Netflix", "drawn"], [9, "On Prime", "drawn"]]],
		["Prime Video saved alone", "&services=9", [[9, "On Prime", "drawn"], [8, "On Netflix", "drawn"]]],
		["no saved service", "&services=none", [[8, "On Netflix", "drawn"], [9, "On Prime", "drawn"]]],
	]
	for (const [what, query, want] of setups) {
		where = `a member with ${what}`
		console.log(where)
		const { ctx, page, logs, requests } = await open(`${HARNESS}?member=six${query}`, DESKTOP, { before: handIn })
		let s = await read(page)
		is(s.keys.map((key) => [key.id, key.label, key.mark?.kind]), want, "the Remote's two keys")
		is(s.items.slice(4, 7), ["app:shows", ...want.map(([id]) => `service:${id}`)], "home's two tiles after My shows")
		for (const [id, label, kind] of want) is([s.labels[`service:${id}`], s.tiles[`service:${id}`]?.mark?.kind], [label, kind], `${label}: its tile`)
		const [[first], [second]] = want
		await page.locator(`#room [data-service-key="${second}"]`).click()
		s = await until(page, (x) => new URLSearchParams(x.search).get("service") === String(second) && titlesOf(x).length > 0, "the second key opens its service", 60000)
		is(pressed(s), [second], "and is on")
		const asks = requests.filter((r) => r.url.includes("/api/discover/results"))
		is([asks.length, asks[0]?.method, new URL(asks[0].url).search], [1, "GET", `?services=${second}&page=1`], "a member asks for that one service with GET, once")
		is(s.head?.kind ?? "none", want[1][2], "the screen leads with the key's mark")
		is(s.edge, DRAWN[second] ?? QUIET, "and has the service's line")
		await page.locator(`#room [data-service-key="${first}"]`).click()
		s = await until(page, (x) => new URLSearchParams(x.search).get("service") === String(first) && same(pressed(x), [first]) && titlesOf(x).length > 0, "the first key takes its place", 60000)
		is(pressed(s), [first], "and is on")
		await page.locator(`#room [data-service-key="${first}"]`).click()
		s = await until(page, (x) => !new URLSearchParams(x.search).has("tv") && x.items.includes("app:shows"), "the same key leaves")
		is(pressed(s), [], "no key is on")
		is(noise(logs), [], "nothing in the console")
		await ctx.close()
	}
}

// ---------------------------------------------------------------------------------------------------------
// Sizes: every key of home and of a service's screen, and the Remote's streaming keys, on every phone of the
// room's table, in landscape and on the desktop.

/** The phones of the room's table: the Remote in the hand on the tall ones, on the table on the short, and landscape. */
const PHONES = [
	[360, 740],
	[375, 667],
	[390, 700],
	[390, 844],
	[430, 932],
	[844, 390],
]
const LONG = "The Lord of the Rings: The Fellowship of the Ring"

async function sizes() {
	// A key with a catalog's logo is a member's: the member's walk measures it on the phone.
	for (const [country, sizesOf] of [["US", [...PHONES, DESKTOP]]])
		for (const size of sizesOf) {
			const touch = size !== DESKTOP
			where = `sizes ${size.join("x")} ${country}`
			console.log(where)
			const { data } = await loaderOf(`en-${country}`)
			const [a, b] = data.services
			const { ctx, page } = await open(GUEST, size, {
				touch,
				storage: { country },
				locale: `en-${country}`,
				// The first title's name is a long one, so the list is checked with a name of two lines.
				before: (p) =>
					p.route("**/api/discover/results*", async (route) => {
						const response = await route.fetch()
						const body = await response.json()
						if (body.cards?.[0]) body.cards[0].title = LONG
						return route.fulfill({ response, json: body })
					}),
			})
			// The Remote's two streaming keys, in the form the window has.
			let s = await read(page)
			const form = s.keys[0]?.form
			const key = Math.min(...s.keys.flatMap((one) => [one.width, one.height]))
			if (touch) check(key >= 44 - 0.05, `the Remote's streaming keys (${form}) are 44 px or more in both directions: ${s.keys.map((one) => `${one.width.toFixed(1)} x ${one.height.toFixed(1)}`).join(", ")}`)
			const remoteBox = await page.evaluate(() => {
				const box = (el) => el.getBoundingClientRect().toJSON()
				const remote = document.querySelector('#room [aria-label="Remote control"]')
				const keys = [...remote.querySelectorAll("button")].map((el) => ({ label: el.getAttribute("aria-label") ?? el.textContent, service: el.hasAttribute("data-service-key"), ...box(el) }))
				// A mark is inside its key.
				const marks = [...remote.querySelectorAll("[data-service-key]")].map((el) => {
					const mark = el.querySelector("[data-service-mark]")
					const [k, m] = [box(el), mark ? box(mark) : null]
					return !m || (m.left >= k.left && m.right <= k.right && m.top >= k.top && m.bottom <= k.bottom)
				})
				return { keys, marks, w: innerWidth, h: innerHeight }
			})
			const services = remoteBox.keys.filter((one) => one.service)
			const others = remoteBox.keys.filter((one) => !one.service)
			check(services.every((one) => !others.some((other) => meet(one, other))) && !meet(services[0], services[1]), "the streaming keys lie over no other key of the Remote")
			check(services.every((one) => one.left >= 0 && one.right <= remoteBox.w && one.top >= 0 && one.bottom <= remoteBox.h), "and are inside the window")
			check(remoteBox.marks.every(Boolean), "each key's mark is inside its key")

			const smallest = {}
			// Home, with the focus on each service's tile.
			for (const service of [a, b]) {
				await page.goto(`${GUEST}?focus=service%3A${service.id}`, { waitUntil: "load", timeout: 180000 })
				await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
				await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
				s = await until(page, (x) => focusIs(`service:${service.id}`)(x) && x.focusInView, `home with the focus on ${service.name}'s tile, paged into view`, 60000)
				await page.waitForTimeout(500)
				const l = await layout(page)
				smallest[`home ${service.name}`] = fits(l, `home, ${service.name}`, { touch, corner: false, row: /^(app|service):/ }).key
				const tile = l.items.find((item) => item.id === `service:${service.id}`)
				numbers[`${where}: ${service.name}'s tile`] = `${tile.width.toFixed(0)} x ${tile.height.toFixed(0)}`
			}
			// A service's screen, with the focus on its first title (a long name) and on its last.
			for (const service of [a, b]) {
				await page.goto(`${GUEST}?${serviceTv(service.id)}`, { waitUntil: "load", timeout: 180000 })
				await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
				await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
				s = await until(page, (x) => titlesOf(x).length > 0, `${service.name}'s titles`, 90000)
				if (!titlesOf(s).length) continue
				is(s.heading, LONG, "the first title's long name")
				await page.waitForTimeout(500)
				let l = await layout(page)
				smallest[`${service.name}`] = fits(l, `On ${service.name}`, { touch, row: /^title:/ }).key
				const poster = l.items.find((item) => item.id.startsWith("title:"))
				numbers[`${where}: a poster on ${service.name}`] = `${poster.width.toFixed(0)} x ${poster.height.toFixed(0)}`
				check(l.items.filter((item) => item.id.startsWith("title:") && within(item, l.tv)).length >= (touch ? 3 : 5), `On ${service.name}: the row shows ${touch ? "three" : "five"} posters or more at a time`)
				// The mark's plate stands in the bar's row, inside the picture and under no key.
				const head = await page.evaluate(() => document.querySelector("#room [data-tv-layer] [data-tv-service-mark]")?.getBoundingClientRect().toJSON() ?? null)
				if (head) check(within(head, l.tv) && !l.items.some((item) => meet(item, head)), `On ${service.name}: the service's mark is inside the picture and under no key`)
				const last = titlesOf(s).at(-1)
				for (let n = 0; n < titlesOf(s).length - 1; n++) await page.keyboard.press("ArrowRight")
				await until(page, (x) => focusIs(`title:${last}`)(x) && x.focusInView, "the focus on the last title, in view", 30000)
				await page.waitForTimeout(600)
				l = await layout(page)
				fits(l, `On ${service.name}, the last title`, { touch, row: /^title:/ })
			}
			numbers[`${where}: the smallest key`] = { remote: `${form} ${key.toFixed(1)}`, ...Object.fromEntries(Object.entries(smallest).map(([name, px]) => [name, Number(px.toFixed(1))])) }
			await ctx.close()
		}
}

// ---------------------------------------------------------------------------------------------------------
// The server's HTML of a link to a service: the bar alone, and nothing of its titles.

async function html() {
	where = "the server's HTML"
	console.log(where)
	const { data } = await loaderOf("en-US")
	for (const query of [`?${serviceTv(data.services[0].id)}`, `?${serviceTv(337)}`]) {
		const texts = await Promise.all(Object.keys(AGENTS).map((agent) => htmlOf(query, "en-US", agent)))
		check(texts.every((text) => text === texts[0]), `${query}: the same HTML for a browser, Googlebot and an iPhone`)
		// Both editions are in the HTML: the bar alone, twice.
		is(idsIn(texts[0]), [...BAR, ...BAR], `${query}: the server draws the bar alone, once per edition`)
		check(!/Titles are on their way|data-tv-service-mark|data-tv-edge/.test(texts[0]), `${query}: and nothing of the service's screen`)
		numbers[`a guest's HTML of ${query}, bytes`] = texts[0].length
	}
}

// ---------------------------------------------------------------------------------------------------------
// Screenshots, and the sheets beside the prototype's.

const dir = join(here, "shots")
async function shots() {
	mkdirSync(dir, { recursive: true })
	const settle = async (page) => {
		await page.evaluate(() => Promise.all([...document.querySelectorAll("#room img")].map((img) => img.decode().catch(() => {}))))
		await page.waitForTimeout(1100)
	}
	const shot = async (page, name) => {
		await settle(page)
		await page.screenshot({ path: join(dir, `${name}.jpg`), quality: 82 })
	}
	const pictured = (page) => until(page, (x) => titlesOf(x).length > 0 && Object.values(x.tiles).filter((tile) => tile.img).slice(0, 4).every((tile) => tile.loaded) && Boolean(x.picture), "a list with its pictures", 90000)
	const go = async (page, url) => {
		await page.goto(url, { waitUntil: "load", timeout: 180000 })
		await page.waitForSelector("#room:not([data-room=unmeasured]) [data-tv-item]", { timeout: 180000 })
		await page.addStyleTag({ content: ".tsqd-parent-container { display: none !important; }" })
	}
	const sized = [
		[DESKTOP, "desktop"],
		[PHONE, "phone"],
	]
	if (guestSide)
		for (const [size, device] of sized) {
			where = `shots guest ${device}`
			console.log(where)
			const phone = device === "phone"
			const { data } = await loaderOf("en-US")
			const [a, b] = data.services
			let { ctx, page } = await open(GUEST, size, { storage: { country: "US" } })
			const key = (id) => page.locator(`#room [data-service-key="${id}"]`)
			// Home on the first service's tile, once the pool has given it a picture.
			for (let n = 0; n < 4; n++) await page.keyboard.press("ArrowRight")
			await until(page, (x) => focusIs(`service:${a.id}`)(x) && (x.tiles[`service:${a.id}`]?.loaded || x.tiles[`service:${b.id}`]?.loaded), "home on the first service's tile, with the pool's pictures", 90000)
			await shot(page, `home-first-guest-${device}`)
			await page.keyboard.press("ArrowRight")
			await until(page, focusIs(`service:${b.id}`), "home on the second service's tile")
			await shot(page, `home-second-guest-${device}`)
			// The first key: On <service>, the key lit.
			await (phone ? key(a.id).tap() : key(a.id).click())
			await pictured(page)
			await shot(page, `on-first-guest-${device}`)
			for (let n = 0; n < 2; n++) await page.keyboard.press("ArrowRight")
			await page.waitForTimeout(500)
			await shot(page, `on-first-third-guest-${device}`)
			for (let n = 0; n < 6; n++) await page.keyboard.press("ArrowRight")
			await page.waitForTimeout(700)
			await shot(page, `on-first-ninth-guest-${device}`)
			// The other key takes its place.
			await (phone ? key(b.id).tap() : key(b.id).click())
			await until(page, (x) => x.search === `?${serviceTv(b.id)}`, "the second service")
			await pictured(page)
			await shot(page, `on-second-guest-${device}`)
			await ctx.close()
			// Before the pool: the tiles in their services' colours. The server's first paint, without a sign of the person.
			;({ ctx, page } = await open(`${GUEST}?focus=service%3A${a.id}`, size, { storage: { country: "US" }, before: (p) => p.route("**/api/living-room/picks*", (route) => route.fulfill({ status: 503, body: "{}" })) }))
			await until(page, focusIs(`service:${a.id}`), "home before the pool")
			await shot(page, `home-colours-guest-${device}`)
			await ctx.close()
			// Without titles, and while they are on their way.
			;({ ctx, page } = await open(`${GUEST}?${serviceTv(a.id)}`, size, { storage: { country: "US" }, before: (p) => p.route("**/api/discover/results*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ cards: [], total: 0 }) })) }))
			await until(page, (x) => /Nothing to watch/.test(x.text), "a service without titles", 60000)
			await shot(page, `on-first-none-guest-${device}`)
			await ctx.close()
		}
	if (memberSide)
		for (const [size, device] of sized) {
			where = `shots member ${device}`
			console.log(where)
			const phone = device === "phone"
			for (const [name, query, tile, keyId] of [
				["member", "", 8, 9],
				["member-logos", "&services=337,15", 337, 15],
				["member-one", "&services=15", 15, 15],
			]) {
				const { ctx, page } = await open(`${HARNESS}?member=six${query}&focus=service%3A${tile}`, size, { before: handIn })
				await until(page, (x) => focusIs(`service:${tile}`)(x) && x.keys.every((one) => one.mark?.loaded !== false), "a member's home on a service's tile", 60000)
				await shot(page, `home-${name}-${device}`)
				if (name !== "member-one") {
					await (phone ? page.locator(`#room [data-service-key="${keyId}"]`).tap() : page.locator(`#room [data-service-key="${keyId}"]`).click())
					await pictured(page)
					await shot(page, `on-${name}-${device}`)
				}
				await ctx.close()
			}
		}
}

/** The sheets: ours beside the prototype's shot of the same screen. */
async function sheets() {
	const uri = (file) => `data:image/jpeg;base64,${readFileSync(file).toString("base64")}`
	const ours = (name) => uri(join(dir, `${name}.jpg`))
	const theirs = (name) => uri(join(prototype, "screens/cinema", `${name}.jpg`))
	const cell = (src, caption, width) => `<figure><img src="${src}" width="${width}"><figcaption>${caption}</figcaption></figure>`
	const sheet = async (name, width, body) => {
		const ctx = await browser.newContext({ viewport: { width, height: 600 }, deviceScaleFactor: 1 })
		const page = await ctx.newPage()
		await page.setContent(`<style>body{margin:0;padding:16px;background:#14161b;color:#fff;font:15px system-ui}h2{font-size:18px;margin:18px 0 8px}div{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}figure{margin:0}img{display:block}figcaption{padding:4px 0 0;color:#cbd5e1;max-width:940px}</style>${body}`)
		await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode())))
		await page.screenshot({ path: join(here, `${name}.jpg`), quality: 80, fullPage: true })
		await ctx.close()
	}
	const pair = (title, their, our, note, width) => `<h2>${title}</h2><div>${cell(theirs(their), "prototype (sample data)", width)}${cell(ours(our), note, width)}</div>`
	const row = (title, names, width) => `<h2>${title}</h2><div>${names.map(([name, note, own]) => cell(ours(name), note, own ?? width)).join("")}</div>`
	await sheet(
		"desktop-beside-prototype",
		1960,
		[
			pair("1920 x 1080, On Netflix as a guest: the Remote's Netflix key opened it and shows that it is on", "23-on-netflix-desktop", "on-first-guest-desktop", "slice 6b: the first of /discover?services=8 for a guest in the United States. The Expand key is slice 11's; its corner is kept free", 956),
			pair("On Prime Video: the other key took the first one's place", "24-on-prime-video-desktop", "on-second-guest-desktop", "slice 6b: real data", 956),
			pair("Home with the focus on the Netflix tile, after the apps", "25-home-services-desktop", "home-first-guest-desktop", "slice 6b: the tile and the picture are a title of the pool that streams there", 956),
			row(
				"The row pages: the focus on the third and on the ninth title. Home on the second service's tile. Before the pool: the services' colours",
				[
					["on-first-third-guest-desktop", "the name and the picture follow the focus"],
					["on-first-ninth-guest-desktop", "the ninth of twelve"],
					["home-second-guest-desktop", "the second service's tile"],
					["home-colours-guest-desktop", "no pictures yet"],
				],
				476,
			),
			row("A service without titles", [["on-first-none-guest-desktop", "nothing to watch"]], 636),
			row(
				"A member (the harness): their own two saved services; two the Remote has no mark for, with the catalog's logos; one saved service, filled up with Netflix",
				[
					["home-member-desktop", "Netflix and Prime Video saved"],
					["on-member-desktop", "a member's On Prime"],
					["home-member-logos-desktop", "Disney+ and Hulu saved"],
					["on-member-logos-desktop", "a member's On Hulu"],
					["home-member-one-desktop", "Hulu saved alone: Hulu, then Netflix"],
				],
				380,
			),
		].join(""),
	)
	await sheet(
		"phone-beside-prototype",
		1720,
		`<h2>390 x 844: the prototype (left of each pair) and slice 6b (right). On Netflix, On Prime Video, home on the Netflix tile</h2><div>${[
			["23-on-netflix-phone", "on-first-guest-phone"],
			["24-on-prime-video-phone", "on-second-guest-phone"],
			["25-home-services-phone", "home-first-guest-phone"],
		]
			.map(([their, our]) => cell(theirs(their), "prototype", 270) + cell(ours(our), "slice 6b", 270))
			.join("")}</div>${row(
			"The row pages: the third and the ninth title; home on the second service's tile; before the pool; a service without titles",
			[
				["on-first-third-guest-phone", "the third title"],
				["on-first-ninth-guest-phone", "the ninth of twelve"],
				["home-second-guest-phone", "the second tile"],
				["home-colours-guest-phone", "no pictures yet"],
				["on-first-none-guest-phone", "nothing to watch"],
			],
			270,
		)}${row(
			"A member with Netflix and Prime Video, with Disney+ and Hulu (the catalog's logos), with Hulu alone",
			[
				["home-member-phone", "a member's home"],
				["home-member-logos-phone", "Disney+ and Hulu saved"],
				["on-member-logos-phone", "a member's On Hulu"],
				["home-member-one-phone", "Hulu, then Netflix"],
			],
			270,
		)}`,
	)
}

// A dev server's first page load after a start reloads itself once Vite has optimized its dependencies, which
// would cut a walk short: load each page once before the real run, through a service, a title and the Discover
// page.
async function warm(url) {
	where = "warming the dev server"
	const { ctx, page } = await open(url, DESKTOP, { before: url.startsWith(HARNESS) ? handIn : undefined })
	await page.keyboard.press("ArrowRight")
	await page.waitForTimeout(3000)
	await page.locator("#room [data-service-key]").first().click().catch(() => {})
	await page.waitForTimeout(9000)
	await page.keyboard.press("Enter")
	await page.waitForTimeout(6000)
	await ctx.close()
}
if (guestSide) {
	// Discover answers 503 until the reading server has loaded its title snapshot, about two minutes after a start.
	for (let n = 0; n < 60; n++) {
		const ready = await fetch(`${ORIGIN}/api/discover/results?services=8&page=1`).then((r) => r.status === 200, () => false)
		if (ready) break
		await sleep(5000)
	}
	// And a title's services are unknown until it has read the country's availability (a read that timed out is
	// tried again after five minutes): until then a service's tile has no picture to show.
	for (let n = 0; n < 90; n++) {
		const pool = await fetch(`${ORIGIN}/api/living-room/picks?view=pool`, json({ guest: guestOf() })).then((r) => r.json(), () => null)
		if (pool?.suggestions?.some((card) => card.services?.length)) break
		await sleep(5000)
	}
	await warm(GUEST)
	await warm(GUEST)
	const { ctx } = await open(`${ORIGIN}/discover?services=8`, DESKTOP, { room: false })
	await ctx.close()
	// What the member's half hands its page: the reading server's answers for a visitor nobody knows.
	for (const id of [8, 9, 337, 15]) stock.results[`?services=${id}&page=1`] = await realResults(`?services=${id}&page=1`)
} else {
	await warm(`${HARNESS}?member=six`)
	await warm(`${HARNESS}?member=six`)
}
passed = 0
failed.length = 0

if (only !== "shots") {
	// PARTS=countries,walk,links,same,abroad,members,sizes,html runs some of the checks; checks.json is written by
	// a whole run only.
	const parts = process.env.PARTS?.split(",")
	const part = (name) => !parts || parts.includes(name)
	if (guestSide) {
		if (part("countries")) await countries()
		if (part("walk")) for (const size of [DESKTOP, PHONE]) await walk("guest", GUEST, size)
		if (part("links")) await links()
		if (part("same")) await sameAsDiscover()
		if (part("abroad")) await abroad()
		if (part("sizes")) await sizes()
		if (part("html")) await html()
	}
	if (memberSide) {
		if (part("walk")) for (const size of [DESKTOP, PHONE]) await walk("member", `${HARNESS}?member=six`, size)
		if (part("walk")) await walk("member with Disney+ and Hulu", `${HARNESS}?member=six&services=337,15`, PHONE)
		if (part("members")) await members()
	}
	if (!parts && SIDE === "guest") {
		writeFileSync(STOCK, JSON.stringify({ ...stock, passed, failed, numbers }))
		console.log(`kept for the member's half: ${passed} checks passed, ${failed.length} failed`)
	} else if (!parts) {
		// The member's half, or both at once: the guest's half's checks and numbers count with these.
		const all = { passed: passed + (guestSide ? 0 : stock.passed), failed: [...(guestSide ? [] : stock.failed), ...failed], numbers: { ...(guestSide ? {} : stock.numbers), ...numbers } }
		writeFileSync(join(here, "checks.json"), `${JSON.stringify(all, null, "\t")}\n`)
		console.log(`checks.json: ${all.passed} checks passed, ${all.failed.length} failed`)
	} else console.log(JSON.stringify(numbers, null, 1))
} else if (guestSide) writeFileSync(STOCK, JSON.stringify(stock))
if (only !== "checks") {
	await shots()
	if (memberSide) await sheets()
}
await browser.close()
console.log(`${passed} checks passed, ${failed.length} failed`)
for (const line of failed) console.log(" -", line)
