// Drives the design prototype with keys and with clicks on the Remote, in each of the three directions, and checks
// the state line after each step: the apps flow must behave the same however it is dressed.
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3147 node walk.mjs
// Needs the dev server (see README.md). The repo has no browser driver: install playwright-core outside it.
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
const base = `${process.env.BASE ?? "http://localhost:3147"}/prototype/tv-screen-design`
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium" })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
let page = await ctx.newPage()
page.on("pageerror", (e) => { if (!/Suspense/.test(e.message)) console.log("PAGEERROR", e.message) })
const state = async () => (await page.locator("span.font-mono").first().innerText()).trim()
let fails = 0
let passed = 0
const say = (ok, label, got, want) => { ok ? passed++ : fails++; console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${got}${ok ? "" : `   (wanted ${want})`}`) }
// Waits up to eight seconds for the state: on a loaded machine a run or a change of direction takes longer than its clock.
const expect = async (label, want) => {
	const fits = (got) => (typeof want === "string" ? got === want : want.test(got))
	let got = await state()
	for (let i = 0; i < 80 && !fits(got); i++) { await page.waitForTimeout(100); got = await state() }
	say(fits(got), label, got, want)
}
const check = (label, got, want) => say(got === want, label, got, want)
// A machine short of memory fails a load now and then: the page is loaded again, twice at most.
const open = async (q, tries = 3) => {
	try {
		await page.goto(`${base}?${q}`, { waitUntil: "load", timeout: 120000 })
		await page.waitForSelector("[data-tv-item][aria-current]", { timeout: 40000 })
	} catch (error) {
		if (tries <= 1) throw error
		console.log("     loading again:", String(error.message).split("\n")[0])
		await page.waitForTimeout(4000)
		return open(q, tries - 1)
	}
	await page.waitForTimeout(700)
}
const keys = async (...ks) => { for (const k of ks) { await page.keyboard.press(k); await page.waitForTimeout(260) } }
const current = async () => (await page.locator("button[data-design][aria-pressed=true]").allInnerTexts()).join("|").replace(/\s+/g, " ")
/** The top bar's actions on the screen (not the menu over it), in the order they are drawn. */
const bar = () => page.evaluate(() => [...document.querySelectorAll(".tvd-screen [data-tv-item]")].map((el) => el.dataset.tvItem).filter((id) => id.startsWith("bar-") || id === "expand").join(" "))
const pointer = (name) => page.evaluate((n) => document.querySelector("[data-tv-pointer]")?.dataset[n], name)
const middle = async (selector) => { const b = await page.locator(selector).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2] }
/** The Remote's turn about the wrist and its lean, in degrees, from the transform the pointing loop wrote. */
const aim = () => page.evaluate(() => { const t = document.querySelector("[data-remote]").style.transform; return [Number(/rotateZ\(([-\d.]+)deg\)/.exec(t)?.[1] ?? 0), Number(/rotateX\(([-\d.]+)deg\)/.exec(t)?.[1] ?? 0)] })
/** Moves the cursor into each corner of the window and returns the Remote's turn and lean there. */
const corners = async () => {
	const { width, height } = page.viewportSize()
	const out = []
	for (const [x, y] of [[3, 3], [width - 20, 3], [3, height - 4], [width - 20, height - 4]]) {
		await page.mouse.move(x, y, { steps: 5 }); await page.waitForTimeout(900)
		out.push(await aim())
	}
	return out
}
const toast = (text) => page.waitForFunction((t) => document.querySelector(".tvd-toast")?.textContent === t, text, { timeout: 8000 }).then(() => "shown", () => "missing")
const marked = (key) => page.waitForSelector(`button[data-design=${key}][aria-pressed=true]`, { timeout: 8000 }).then(() => page.waitForTimeout(400), () => {})
const SCREENS = [["home"], ["tonight"], ["discover"], ["discover-cozy"], ["explorer"], ["island-heists"], ["taste"], ["quiz"], ["title-knives-out"], ["rate-knives-out"], ["search"], ["search-heist"], ["discover", "menu"], ["about"], ["shows"], ["side-dark-crime"]]
const show = async ([root, push]) => { await page.evaluate(([r, p]) => { window.__tvDesign.root(r); if (p) setTimeout(() => window.__tvDesign.push(p), 60) }, [root, push ?? null]); await page.waitForTimeout(650) }
/**
 * What of the TV's type and focus targets lies under the element `selector` names (the Remote's body, the expand
 * key): ids and the first words. Only what is on the picture counts: a row that pages in is cut by its list.
 */
const under = (selector) => page.evaluate((sel) => {
	const over = document.querySelector(sel)
	if (!over) return []
	const box = over.getBoundingClientRect()
	const tv = document.querySelector("[data-tv-screen]")
	const shown = (from, r) => {
		const b = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
		for (let el = from; el && el !== tv.parentElement; el = el.parentElement) {
			if (getComputedStyle(el).overflow === "visible") continue
			const q = el.getBoundingClientRect()
			b.left = Math.max(b.left, q.left); b.top = Math.max(b.top, q.top); b.right = Math.min(b.right, q.right); b.bottom = Math.min(b.bottom, q.bottom)
		}
		return b
	}
	const hit = (from, rect) => { const r = shown(from, rect); return r.right - r.left > 0 && r.bottom - r.top > 0 && r.left < box.right - 1 && r.right > box.left + 1 && r.bottom > box.top + 1 && r.top < box.bottom - 1 }
	// The expand key belongs to its screen: the menu that opens over that screen covers it like the rest of it.
	const within = over.closest(".tvd-screen") ?? tv
	const out = [...within.querySelectorAll("[data-tv-item]")].filter((el) => !over.contains(el) && !el.contains(over) && hit(el.parentElement, el.getBoundingClientRect())).map((el) => el.dataset.tvItem)
	const walker = document.createTreeWalker(within, NodeFilter.SHOW_TEXT)
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		if (!node.textContent.trim() || over.contains(node)) continue
		const range = document.createRange(); range.selectNodeContents(node)
		if ([...range.getClientRects()].some((r) => hit(node.parentElement, r))) out.push(`"${node.textContent.trim().slice(0, 24)}"`)
	}
	return out
}, selector)
/** On every screen: what lies under `selector`. "nothing" is the answer wanted. */
const underOnAll = async (selector) => {
	const found = []
	for (const screen of SCREENS) { await show(screen); const hits = await under(selector); if (hits.length) found.push(`${screen[1] ?? screen[0]}: ${hits.join(", ")}`) }
	return found.join(" | ") || "nothing"
}
const EXPAND = ".tvd-screen [data-tv-item=expand]"
/** The focus targets in the top bar's line: those that begin above the middle of the Menu action. */
const inBar = () => page.evaluate(() => { const menu = document.querySelector(".tvd-screen [data-tv-item=bar-menu]").getBoundingClientRect(); return [...document.querySelectorAll(".tvd-screen [data-tv-item]")].filter((el) => el.getBoundingClientRect().top < menu.top + menu.height / 2).map((el) => el.dataset.tvItem).join(" ") })
/** Where the expand key is in the picture. */
const corner = () => page.evaluate((sel) => {
	const x = document.querySelector(sel)?.getBoundingClientRect()
	const tv = document.querySelector("[data-tv-screen]").getBoundingClientRect()
	if (!x) return "missing"
	const snug = tv.right - x.right < tv.width * 0.08 && tv.bottom - x.bottom < tv.height * 0.12 && x.right <= tv.right && x.bottom <= tv.bottom
	return `${x.top > tv.top + tv.height / 2 ? "bottom" : "top"} ${x.left > tv.left + tv.width / 2 ? "right" : "left"}${snug ? "" : ", not in the corner"}`
}, EXPAND)

for (const design of ["cinema", "marquee", "glow"]) {
	const t = (label) => `${design}: ${label}`
	await open(`design=${design}`)
	await expect(t("home starts on the first app"), "home · focus app-tonight")
	await keys("ArrowRight"); await expect(t("right moves to the next app"), "home · focus app-discover")
	await keys("Enter"); await expect(t("OK opens Discover on the TV"), "home › discover · focus mood-funny")
	await keys("ArrowRight", "Enter"); await expect(t("a mood shows its titles"), "home › discover › discover-cozy · focus t-the-good-place")
	await keys("ArrowRight"); await expect(t("right moves to the next title"), "home › discover › discover-cozy · focus t-only-murders")
	await keys("Enter"); await expect(t("OK on a title opens its screen"), "home › discover › discover-cozy › title-only-murders · focus watch")
	await keys("ArrowRight", "Enter"); await page.waitForTimeout(300); await expect(t("Want to See stays on the title"), /title-only-murders · focus want$/)
	await keys("ArrowRight", "Enter"); await expect(t("Seen it asks how it was"), /› rate-only-murders · focus level-Loved it$/)
	await keys("Enter"); await expect(t("a rating returns to the title, focus on Seen it"), /title-only-murders · focus seen$/)
	await keys("ArrowUp"); await expect(t("up reaches the top bar"), /title-only-murders · focus (bar-\w+|expand)$/)
	await keys("ArrowRight", "ArrowRight", "ArrowRight"); await expect(t("right along the bar ends on the expand key"), /title-only-murders · focus expand$/)
	await keys("Enter"); await expect(t("OK grows the picture into the title page"), /focus expand · on \/show\/107113-only-murders$/)
	await keys("Escape"); await expect(t("Back comes back into the same screen and focus"), /title-only-murders · focus expand$/)
	await keys("Escape"); await expect(t("Back returns to the list with the focus where it was"), "home › discover › discover-cozy · focus t-only-murders")
	await keys("m"); await expect(t("M opens the menu"), /› menu · focus menu-home$/)
	await keys("Escape", "h"); await expect(t("H goes home"), "home · focus app-tonight")
	// The top bar: which actions a screen has, reaching them with the direction keys, and what each does.
	check(t("home has Search and Menu, no Back, no Expand"), await bar(), "bar-search bar-menu")
	await keys("ArrowUp"); await expect(t("up from the apps reaches the bar"), "home · focus bar-search")
	await keys("Enter"); await expect(t("the bar's Search opens search"), "home › search · focus idea-cozy")
	check(t("the search screen has Back and Menu, no Search"), await bar(), "bar-back bar-menu")
	await keys("ArrowUp"); await expect(t("up from the answers reaches the bar"), "home › search · focus bar-back")
	await keys("Enter"); await expect(t("the bar's Back goes back"), "home · focus bar-search")
	await keys("ArrowRight", "Enter"); await expect(t("the bar's Menu opens the menu"), "home › menu · focus menu-home")
	check(t("the screen under the open menu has no Menu action"), await bar(), "bar-search")
	await keys("Escape", "ArrowDown")
	await expect(t("down from the bar returns to the apps"), /^home · focus app-/)
	await keys("h", "ArrowRight", "Enter"); check(t("an app has Back, Search, Menu, then Expand"), await bar(), "bar-back bar-search bar-menu expand")
	await keys("b"); await page.waitForSelector("[data-remote-place][data-bar=first]", { timeout: 8000 }); check(t("the alternative puts Expand first"), await bar(), "expand bar-back bar-search bar-menu")
	// The third place: out of the bar, in the picture's bottom right corner.
	await keys("b"); await page.waitForSelector("[data-remote-place][data-bar=bottom]", { timeout: 8000 })
	check(t("the third place has Expand at the picture's bottom right"), await corner(), "bottom right")
	check(t("and the bar keeps Back, Search, Menu"), await inBar(), "bar-back bar-search bar-menu")
	await page.evaluate(() => window.__tvDesign.focus("mood-any")); await page.waitForTimeout(260)
	await keys("ArrowDown"); await expect(t("Down from the last mood reaches it there"), "home › discover · focus expand")
	await keys("Enter"); await expect(t("and OK grows the picture into the page from there"), /focus expand · on \/discover/)
	await keys("Escape"); await expect(t("Back comes back to it"), "home › discover · focus expand")
	await keys("b"); await page.waitForSelector("[data-remote-place][data-bar=last]", { timeout: 8000 })
	await keys("h")
	// The map.
	await keys("ArrowRight", "ArrowRight", "Enter"); await expect(t("Explorer opens on the first island"), "home › explorer · focus island-heists")
	await keys("ArrowRight"); await expect(t("right sails to the next island"), "home › explorer · focus island-whodunits")
	await keys("ArrowDown"); await expect(t("down sails to the row below"), /^home › explorer · focus island-(workplace|time-loops)$/)
	await keys("Enter"); await expect(t("OK steps onto the island"), /^home › explorer › island-(workplace|time-loops) · focus t-/)
	await keys("h")
	// The Remote in the room.
	await page.locator("[data-remote]").getByRole("button", { name: "Next", exact: true }).click(); await expect(t("the remote's arrow moves the focus"), "home · focus app-discover")
	await page.locator("[data-remote]").getByRole("button", { name: "OK", exact: true }).click(); await expect(t("the remote's OK opens the app"), "home › discover · focus mood-funny")
	await page.locator("[data-remote]").getByRole("button", { name: "Back", exact: true }).first().click(); await expect(t("the remote's Back returns"), "home · focus app-discover")
	await page.locator("[data-remote]").getByRole("button", { name: "Search", exact: true }).first().click(); await expect(t("the remote's Search opens search"), "home › search · focus idea-cozy")
	await page.keyboard.type("heist", { delay: 40 }); await keys("Enter"); await expect(t("typing and OK searches"), "home › search › search-heist · focus t-oceans-eleven")
	check(t("search results have Back and Menu, and Expand"), await bar(), "bar-back bar-menu expand")
	// Pointing: the TV's own pointer, and the Remote aiming at the cursor.
	await keys("h")
	const [okX, okY] = await middle("[data-remote] .remote-ok") // the Remote is at rest: the cursor is on its keys
	const [dx, dy] = await middle("[data-tv-item=app-discover]")
	const [cx, cy] = await middle("[data-tv-screen]")
	await page.mouse.move(cx, cy, { steps: 4 }); await page.waitForTimeout(350)
	check(t("the pointer appears over the TV"), await pointer("shown"), "true")
	check(t("the system cursor is hidden over the TV"), await page.evaluate(() => getComputedStyle(document.querySelector("[data-tv-screen]")).cursor), "none")
	await page.mouse.move(dx, dy, { steps: 6 }); await expect(t("the item under the pointer takes the focus"), "home · focus app-discover")
	check(t("the pointer reacts to the item"), await pointer("over"), "true")
	await page.mouse.click(dx, dy); await expect(t("a click is OK"), /^home › discover · focus mood-/)
	await keys("ArrowRight"); check(t("the pointer hides when a key is used"), await pointer("shown"), "false")
	await page.mouse.move(cx + 40, cy + 10, { steps: 3 }); await page.waitForTimeout(200); check(t("the pointer comes back on movement"), await pointer("shown"), "true")
	await page.waitForTimeout(3600); check(t("the pointer fades after a few seconds without movement"), await pointer("shown"), "false")
	// Under the TV the Remote swings all the way toward the cursor: 42 degrees reaches the corners.
	const [tl, tr, bl, br] = await corners()
	check(t("the Remote swings far toward each corner"), [tl[0] < -30, tr[0] > 30, bl[0] < -30, br[0] > 30].join(" "), "true true true true")
	check(t("the Remote leans back further for the top corners than for the bottom ones"), [tl[1] > bl[1] + 1, tr[1] > br[1] + 1].join(" "), "true true")
	check(t("the streaming row stays in the window while the Remote is turned"), String((await page.evaluate(() => Math.max(...[...document.querySelectorAll("[data-remote] .remote-service")].map((el) => el.getBoundingClientRect().bottom)))) <= 1080), "true")
	await page.mouse.move(okX, okY, { steps: 6 }); await page.waitForTimeout(1100)
	check(t("over the Remote itself the Remote settles at rest"), (await aim()).map((n) => Math.round(n)).join(" "), "0 12")
	await page.mouse.move(1900, 3, { steps: 5 }); await page.waitForTimeout(500)
	await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave"))); await page.waitForTimeout(1100)
	check(t("the Remote is at rest after the cursor left the window"), (await aim()).map((n) => Math.round(n)).join(" "), "0 12")
	// The quiz gives a guest a taste.
	await open(`design=${design}&at=home.taste.quiz`)
	await keys("Enter", "Enter", "Enter", "Enter", "Enter"); await expect(t("five ratings end on the three sides"), "home › taste · focus side-dark-crime")
	// A member.
	await open(`design=${design}&as=member`)
	await keys("ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "Enter"); await expect(t("member: the fifth app is My shows"), "home › shows · focus ep-severance")
}

// The direction buttons and the keys 1, 2, 3: the screen stays, only its dress changes.
await open("design=cinema&at=home.discover.discover-cozy")
check("the control bar has one button per direction", (await page.locator("button[data-design]").allInnerTexts()).map((x) => x.replace(/\s+/g, " ")).join(", "), "1 Cinema, 2 Marquee, 3 Glow")
check("the current direction is marked", await current(), "1 Cinema")
await page.locator("button[data-design=marquee]").click(); await marked("marquee")
check("a click on a direction's button chooses it and keeps the screen", `${await current()} · ${await state()}`, "2 Marquee · home › discover › discover-cozy · focus t-the-good-place")
await keys("3"); await marked("glow"); check("the key 3 chooses Glow and keeps the screen", `${await current()} · ${await state()}`, "3 Glow · home › discover › discover-cozy · focus t-the-good-place")
await keys("1"); await marked("cinema"); check("the key 1 chooses Cinema", await current(), "1 Cinema")
// Under the TV the Remote's top reaches a little over the picture's bottom margin. On no screen may it cover type or
// a focus target there, in any direction, at the two window sizes where it is under the TV by itself.
for (const [width, height] of [[1920, 1080], [1920, 940]]) {
	await page.setViewportSize({ width, height })
	for (const design of ["cinema", "marquee", "glow"]) {
		await page.mouse.move(0, 0)
		await open(`design=${design}&as=member`)
		check(`${design} at ${width}x${height}: the Remote covers no type and no focus target on any of ${SCREENS.length} screens`, await underOnAll("[data-remote] .remote-body"), "nothing")
	}
}
// The expand key in the bottom right corner (the desktop's third place): it covers nothing either.
await page.setViewportSize({ width: 1920, height: 1080 })
for (const design of ["cinema", "marquee", "glow"]) {
	await page.mouse.move(0, 0)
	await open(`design=${design}&as=member&bar=bottom`)
	check(`${design}, Expand at the bottom right: it covers no type and no focus target on any of ${SCREENS.length} screens`, await underOnAll(EXPAND), "nothing")
}
await page.setViewportSize({ width: 1920, height: 1080 })

// Beside the TV (the layout of small windows, forced here on a large one) the Remote only nods toward the cursor,
// so it never swings over the picture.
await open("design=cinema&remote=beside")
{
	const [tl, tr, bl, br] = await corners()
	check("beside: the Remote nods left for the left corners and right for the right ones", [tl[0] < -8, tr[0] > 1, bl[0] < -8, br[0] > 8].join(" "), "true true true true")
	check("beside: the Remote never turns further than its nod", String(Math.max(...[tl, tr, bl, br].map((c) => Math.abs(c[0]))) <= 13.01), "true")
	await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave"))); await page.waitForTimeout(1100)
	check("beside: the Remote is at rest after the cursor left the window", (await aim()).map((n) => Math.round(n)).join(" "), "0 12")
	await keys("r"); await page.waitForSelector("[data-remote-place=below]", { timeout: 8000 }); check("the key R returns to the window's own choice", new URL(page.url()).searchParams.get("remote") ?? "none", "none")
	await keys("r"); await page.waitForSelector("[data-remote-place=beside]", { timeout: 8000 }); check("the key R forces the other place", new URL(page.url()).searchParams.get("remote") ?? "none", "beside")
}

// Every window size: which place the Remote takes, that its streaming row is in the window at rest and both of its
// keys take a click, and how small the TV's type gets. Type of 20 canvas pixels is the smallest any direction has.
const remoteFits = async (label, width, height, query, place, readable = true) => {
	await page.setViewportSize({ width, height })
	await page.mouse.move(0, 0)
	await open(query)
	const m = await page.evaluate(() => {
		const box = (s) => document.querySelector(s).getBoundingClientRect()
		const canvas = document.querySelector("[data-tv-canvas]")
		return { place: document.querySelector("[data-remote-place]").dataset.remotePlace, row: Math.max(box("[data-remote] button[aria-label='Only Netflix']").bottom, box("[data-remote] button[aria-label='Only Prime Video']").bottom), body: box("[data-remote] .remote-body").bottom, right: box("[data-remote] .remote-body").right, tv: box("[data-tv-screen]"), k: canvas.getBoundingClientRect().width / canvas.offsetWidth }
	})
	const type = Math.round(20 * m.k * 10) / 10
	check(`${label}: the Remote is ${place === "below" ? "under" : "beside"} the TV`, m.place, place)
	check(`${label}: the streaming row ends inside the window`, String(m.row <= height), "true")
	if (place === "beside") check(`${label}: the whole Remote is inside the window`, String(m.body <= height + 1 && m.right <= width), "true")
	await page.locator("[data-remote]").getByRole("button", { name: "Only Netflix" }).click(); check(`${label}: the Netflix key takes a click`, await toast("Only Netflix"), "shown")
	await page.locator("[data-remote]").getByRole("button", { name: "Only Prime Video" }).click(); check(`${label}: the Prime Video key takes a click`, await toast("Only Prime Video"), "shown")
	check(`${label}: the smallest type is ${readable ? "18 px or more" : "under 18 px, as the README says"}`, String(type >= 18), String(readable))
	console.log(`     ${label}: TV ${Math.round(m.tv.width)} x ${Math.round(m.tv.height)}, type of 20 canvas px prints at ${type} px`)
}
await remoteFits("1920x1080", 1920, 1080, "design=cinema", "below")
await remoteFits("1920x940", 1920, 940, "design=cinema", "below")
await remoteFits("2560x1300", 2560, 1300, "design=cinema", "below")
await remoteFits("1536x730", 1536, 730, "design=cinema", "beside")
await remoteFits("1440x800", 1440, 800, "design=cinema", "beside")
await remoteFits("1366x650", 1366, 650, "design=cinema", "beside", false)
await remoteFits("1280x720", 1280, 720, "design=cinema", "beside", false)
await remoteFits("marquee at 1920x940", 1920, 940, "design=marquee", "below")
await remoteFits("glow at 1920x940", 1920, 940, "design=glow", "below")
await remoteFits("glow at 1536x730", 1536, 730, "design=glow", "beside")
await page.setViewportSize({ width: 1920, height: 1080 }); await open("design=cinema&at=home.discover.discover-cozy")

// The pointer shapes.
check("the pointer is the ring", await pointer("shape"), "ring")
await keys("c"); await page.waitForSelector("[data-tv-pointer][data-shape=cross]", { state: "attached", timeout: 8000 }); check("the key C still shows the next shape", await pointer("shape"), "cross")
await keys("c"); await page.waitForSelector("[data-tv-pointer][data-shape=dot]", { state: "attached", timeout: 8000 }); check("and the one after it", await pointer("shape"), "dot")
await page.setViewportSize({ width: 390, height: 844 }); await open("design=cinema")
check("at phone width there is no pointer", String(await page.locator("[data-tv-pointer]").count()), "0")
// The phone: the room, the TV and the phone's own Remote on one screen. Nothing scrolls; the TV has its body and
// wall beside it; every key of the Remote is in the window, at least 44 px in both directions, not under the site's
// dock, and does what it says; the expand key is at the picture's bottom right, covers nothing and grows the picture.
const phoneState = () => page.evaluate(() => window.__tvDesign.state())
const until = async (label, want) => {
	const fits = (got) => (typeof want === "string" ? got === want : want.test(got))
	let got = await phoneState()
	for (let i = 0; i < 60 && !fits(got); i++) { await page.waitForTimeout(100); got = await phoneState() }
	say(fits(got), label, got, want)
}
const key = (name) => page.locator("[data-remote]").getByRole("button", { name, exact: true })
const phone = async (width, height, form, design = "cinema") => {
	const t = (label) => `phone ${width}x${height}, ${form === "table" ? "on the table" : "in the hand"}${design === "cinema" ? "" : `, ${design}`}: ${label}`
	// A phone of its own: touch, no scrollbar. A page that crashes while loading on a loaded machine is loaded again.
	const desktop = page
	const mobile = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true })
	page = await mobile.newPage()
	const q = `design=${design}&as=member${form === "table" ? "&form=table" : ""}`
	await open(q)
	const m = await page.evaluate(() => {
		const scene = document.querySelector("[data-remote-place]")
		const all = [...document.querySelectorAll("[data-remote] button")].map((b) => { const r = b.getBoundingClientRect(); return { name: b.getAttribute("aria-label") ?? b.textContent.trim(), w: r.width, h: r.height, inside: r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight, seen: b.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) } })
		const tv = document.querySelector("[data-tv-screen]").getBoundingClientRect()
		const body = document.querySelector("[data-tv-body]").getBoundingClientRect()
		const remote = document.querySelector("[data-remote] .remote-body").getBoundingClientRect()
		const canvas = document.querySelector("[data-tv-canvas]")
		return {
			place: scene.dataset.remotePlace, bar: scene.dataset.bar, form: document.querySelector("[data-remote]").dataset.phoneRemote,
			names: all.map((k) => k.name).sort().join(", "), small: all.filter((k) => k.w < 44 || k.h < 44).map((k) => k.name).join(", "), outside: all.filter((k) => !k.inside).map((k) => k.name).join(", "), covered: all.filter((k) => !k.seen).map((k) => k.name).join(", "),
			smallest: Math.round(Math.min(...all.map((k) => Math.min(k.w, k.h)))), tv: `${Math.round(tv.width)} x ${Math.round(tv.height)}`, k: tv.width / canvas.offsetWidth,
			// The TV's body shows on every side of the picture, the wall beside the body, and the Remote starts under it.
			framed: body.left < tv.left && body.top < tv.top && body.right > tv.right && body.bottom > tv.bottom && body.left > 4 && body.right < window.innerWidth - 4, wide: tv.width > tv.height, under: remote.top >= body.bottom, remote: `${Math.round(remote.width)} wide`,
		}
	})
	check(t("the layout is the phone's, with the Remote in this form"), `${m.place} ${m.form}`, `phone ${form}`)
	check(t("the TV has a body around the picture and wall beside it, and is wider than tall"), `${m.framed} ${m.wide}`, "true true")
	check(t("the Remote starts under the TV"), String(m.under), "true")
	check(t("the Remote has its keys"), m.names, "Back, Down, Home, Menu, Next, OK, Only Netflix, Only Prime Video, Previous, Search, Up")
	check(t("every key is 44 px or more"), m.small || "all", "all")
	check(t("every key is inside the window"), m.outside || "all", "all")
	check(t("no key is under the site's dock or anything else"), m.covered || "none", "none")
	if (design === "cinema") {
		await key("Next").tap(); await until(t("Next moves the focus"), "home · focus app-discover")
		await key("Previous").tap(); await until(t("Previous moves it back"), "home · focus app-tonight")
		await key("Up").tap(); await until(t("Up reaches the top bar"), "home · focus bar-search")
		await key("Down").tap(); await until(t("Down returns to the apps"), /^home · focus app-/)
		await key("OK").tap(); await until(t("OK opens the app"), /^home › \w+ · focus /)
		await key("Back").tap(); await until(t("Back returns"), /^home · focus app-/)
		await key("Search").tap(); await until(t("Search opens search"), "home › search · focus idea-cozy")
		await key("Home").tap(); await until(t("Home goes home"), /^home · focus /)
		await key("Menu").tap(); await until(t("Menu opens the menu"), "home › menu · focus menu-home")
		await key("Back").tap(); await until(t("Back closes the menu"), /^home · focus /)
		await key("Only Netflix").tap(); check(t("the Netflix key works"), await toast("Only Netflix"), "shown")
		await key("Only Prime Video").tap(); check(t("the Prime Video key works"), await toast("Only Prime Video"), "shown")
		await key("Only Prime Video").tap(); await page.waitForTimeout(300)
	}
	// The expand key: out of the bar, at the picture's bottom right, over nothing, and it grows the picture.
	check(t("the expand key's place is the bottom"), m.bar, "bottom")
	check(t("Expand covers no type and no focus target on any screen"), await underOnAll(EXPAND), "nothing")
	await show(["discover"])
	check(t("Expand is at the picture's bottom right"), await corner(), "bottom right")
	check(t("the top bar keeps Back, Search, Menu"), await inBar(), "bar-back bar-search bar-menu")
	// No focus target is cut off at the bottom of the picture, on any screen (a list that pages may cut its own rows).
	const cut = []
	for (const screen of SCREENS) {
		await show(screen)
		const ids = await page.evaluate(() => { const tv = document.querySelector("[data-tv-screen]").getBoundingClientRect(); return [...document.querySelectorAll("[data-tv-screen] [data-tv-item]")].filter((el) => { const r = el.getBoundingClientRect(); return r.top < tv.bottom && r.bottom > tv.bottom + 1 }).map((el) => el.dataset.tvItem) })
		if (ids.length) cut.push(`${screen[1] ?? screen[0]}: ${ids.join(", ")}`)
	}
	check(t("no focus target runs off the picture's bottom edge"), cut.join(" | ") || "none", "none")
	await show(["discover"])
	await page.locator(EXPAND).tap(); await page.getByText("The real page (a stand-in)").waitFor({ timeout: 8000 }).catch(() => {})
	check(t("a tap on Expand grows the picture into the page"), String(await page.getByText("goodwatch.app/discover").count() > 0), "true")
	await page.getByRole("button", { name: "← Back to the TV" }).tap(); await until(t("and Back returns to the TV"), "discover · focus expand")
	// A finger drags up on the TV and on the Remote, then the page is told to scroll: nothing may have moved.
	const cdp = await mobile.newCDPSession(page)
	for (const y of [height * 0.3, height - 150]) await cdp.send("Input.synthesizeScrollGesture", { x: width / 2, y, yDistance: -300, gestureSourceType: "touch", speed: 1600 }).catch(() => {})
	await page.evaluate(() => { window.scrollTo(0, 400); document.querySelector("[data-remote-place]").scrollTop = 400 }); await page.waitForTimeout(300)
	const s = await page.evaluate(() => {
		const scene = document.querySelector("[data-remote-place]")
		// The scene clips what runs under its edge (the Remote's grip and the hand), and cannot be scrolled to it.
		return { scrolled: window.scrollY + document.documentElement.scrollTop + document.body.scrollTop + scene.scrollTop, taller: document.documentElement.scrollHeight - window.innerHeight }
	})
	check(t("nothing scrolls: not by a drag on the TV or on the Remote, and the page is no taller than the window"), `${s.scrolled} ${s.taller <= 0}`, "0 true")
	console.log(`     ${t("")}TV ${m.tv}, Remote ${m.remote}, smallest key ${m.smallest} px, type of 20 canvas px prints at ${(20 * m.k).toFixed(1)} px`)
	await mobile.close()
	page = desktop
}
const PHONES = [[390, 844], [360, 740], [375, 667], [430, 932], [390, 700]]
for (const [width, height] of PHONES) await phone(width, height, "hand")
for (const [width, height] of PHONES) await phone(width, height, "table")
// The other two directions, on the shortest phone and the largest.
for (const design of ["marquee", "glow"]) for (const [width, height] of [[375, 667], [430, 932]]) await phone(width, height, "hand", design)
// The prototype's own controls are folded behind one key on the phone.
await page.setViewportSize({ width: 390, height: 844 }); await open("design=cinema")
check("at phone width the controls are folded away", String(await page.locator("button[data-design=glow]").isVisible()), "false")
await page.locator("[data-controls]").click(); await page.locator("button[data-design=glow]").click(); await marked("glow")
check("and one key unfolds them: the buttons choose", await current(), "3 Glow")
await page.locator("button[data-form]").click(); await page.waitForSelector("[data-phone-remote=table]", { timeout: 8000 }).catch(() => {})
check("and the Remote's other form", await page.locator("[data-remote]").getAttribute("data-phone-remote"), "table")
console.log(fails ? `${fails} FAILED, ${passed} ok` : `all ${passed} ok`)
await browser.close()
process.exitCode = fails ? 1 : 0
