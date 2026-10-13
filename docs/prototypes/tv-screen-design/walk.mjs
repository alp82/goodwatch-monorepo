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
/** The Remote's turn and lean once it has stopped easing: a loaded machine draws fewer frames, so this waits for it. */
const atRest = async () => {
	let now = ""
	for (let i = 0; i < 40; i++) { await page.waitForTimeout(150); now = (await aim()).map((n) => Math.round(n)).join(" "); if (now === "0 12") break }
	return now
}
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
/** Back from the real page: waits until the picture is the TV's again. */
const backToTv = async () => { await keys("Escape"); for (let i = 0; i < 60 && / · (on|back from|expanding to) /.test(await state()); i++) await page.waitForTimeout(100) }
const marked = (key) => page.waitForSelector(`button[data-design=${key}][aria-pressed=true]`, { timeout: 8000 }).then(() => page.waitForTimeout(400), () => {})
const SCREENS = [["home"], ["tonight"], ["discover"], ["discover-cozy"], ["discover-theme.crime"], ["service-netflix"], ["explorer"], ["island-heists"], ["taste"], ["quiz"], ["title-knives-out"], ["rate-knives-out"], ["search"], ["search-heist"], ["discover", "menu"], ["about"], ["shows"], ["side-dark-crime"]]
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
	const low = x.top > tv.top + tv.height / 2
	const snug = !low || (tv.right - x.right < tv.width * 0.08 && tv.bottom - x.bottom < tv.height * 0.12 && x.right <= tv.right && x.bottom <= tv.bottom)
	return `${low ? "bottom" : "top"} ${x.left > tv.left + tv.width / 2 ? "right" : "left"}${snug ? "" : ", not in the corner"}`
}, EXPAND)

// QUICK=1 skips to the three screens added last and two phones: for working on them. The proof is the full run.
const QUICK = Boolean(process.env.QUICK)
if (!QUICK) {
for (const design of ["cinema", "marquee", "glow"]) {
	const t = (label) => `${design}: ${label}`
	await open(`design=${design}`)
	await expect(t("home starts on the first app"), "home · focus app-tonight")
	await keys("ArrowRight"); await expect(t("right moves to the next app"), "home · focus app-discover")
	await keys("Enter"); await expect(t("OK opens Discover on the TV"), "home › discover · focus mood-funny")
	// Cinema has the app's real moods: its second one is Feel-good, where the others have the sample mood Cozy.
	const cozy = design === "cinema" ? "feelgood" : "cozy"
	await keys("ArrowRight", "Enter"); await expect(t("a mood shows its titles"), `home › discover › discover-${cozy} · focus t-the-good-place`)
	await keys("ArrowRight"); await expect(t("right moves to the next title"), `home › discover › discover-${cozy} · focus t-only-murders`)
	await keys("Enter"); await expect(t("OK on a title opens its screen"), `home › discover › discover-${cozy} › title-only-murders · focus watch`)
	await keys("ArrowRight", "Enter"); await page.waitForTimeout(300); await expect(t("Want to See stays on the title"), /title-only-murders · focus want$/)
	await keys("ArrowRight", "Enter"); await expect(t("Seen it asks how it was"), design === "cinema" ? /› rate-only-murders · focus level-good$/ : /› rate-only-murders · focus level-Loved it$/)
	await keys("Enter"); await expect(t("a rating returns to the title, focus on Seen it"), /title-only-murders · focus seen$/)
	await keys("ArrowUp"); await expect(t("up reaches the top bar"), /title-only-murders · focus bar-\w+$/)
	check(t("the top bar is Back, Search, Menu and nothing else"), await inBar(), "bar-back bar-search bar-menu")
	check(t("the expand key is at the picture's bottom right"), await corner(), "bottom right")
	await keys("ArrowDown"); await expect(t("down returns to the title's actions"), /title-only-murders · focus (watch|want|seen)$/)
	// Right along the actions ends on the key where it stands in their row (Cinema, Marquee); where the actions
	// stand higher (Glow), Down from them does.
	await keys("ArrowRight", "ArrowRight", "ArrowRight"); if (!/focus expand$/.test(await state())) await keys("ArrowDown")
	await expect(t("right along the actions, or down from them, ends on the expand key"), /title-only-murders · focus expand$/)
	await keys("Enter"); await expect(t("OK grows the picture into the title page"), /focus expand · on \/show\/107113-only-murders$/)
	await keys("Escape"); await expect(t("Back comes back into the same screen and focus"), /title-only-murders · focus expand$/)
	await keys("Escape"); await expect(t("Back returns to the list with the focus where it was"), `home › discover › discover-${cozy} · focus t-only-murders`)
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
	await keys("h", "ArrowRight", "Enter"); check(t("an app has Back, Search, Menu and the expand key"), await bar(), "bar-back bar-search bar-menu expand")
	// The expand key is out of the bar, in the picture's bottom right corner.
	check(t("the bar has Back, Search, Menu only"), await inBar(), "bar-back bar-search bar-menu")
	check(t("Expand is at the picture's bottom right"), await corner(), "bottom right")
	await page.evaluate((id) => window.__tvDesign.focus(id), design === "cinema" ? "mood-mind" : "mood-any"); await page.waitForTimeout(260)
	await keys("ArrowDown"); await expect(t("Down from the last mood reaches it"), "home › discover · focus expand")
	await keys("Enter"); await expect(t("and OK grows the picture into the page from there"), /focus expand · on \/discover/)
	await keys("Escape"); await expect(t("Back comes back to it"), "home › discover · focus expand")
	// The two other places stay behind B for comparison: in the bar, last and first.
	await keys("b"); await page.waitForSelector("[data-remote-place][data-bar=last]", { timeout: 8000 }); check(t("B puts Expand in the bar, last"), `${await inBar()} · ${await corner()}`, "bar-back bar-search bar-menu expand · top right")
	await keys("b"); await page.waitForSelector("[data-remote-place][data-bar=first]", { timeout: 8000 }); check(t("B again puts it first"), await inBar(), "expand bar-back bar-search bar-menu")
	// Measured with the focus elsewhere: while the key has it, the picture stands back in its frame, and the key with it.
	await keys("b"); await page.waitForSelector("[data-remote-place][data-bar=bottom]", { timeout: 8000 }); await page.evaluate(() => window.__tvDesign.focus("mood-funny")); await page.waitForTimeout(400)
	check(t("and B again returns it to the bottom right"), await corner(), "bottom right")
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
	await page.mouse.move(okX, okY, { steps: 6 })
	check(t("over the Remote itself the Remote settles at rest"), await atRest(), "0 12")
	await page.mouse.move(1900, 3, { steps: 5 }); await page.waitForTimeout(500)
	await page.evaluate(() => document.documentElement.dispatchEvent(new MouseEvent("mouseleave"))); await page.waitForTimeout(1100)
	check(t("the Remote is at rest after the cursor left the window"), await atRest(), "0 12")
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
// The expand key in the picture's bottom right corner, where it is now: it covers nothing either, and on no screen
// is anything in the top bar but Back, Search and Menu.
await page.setViewportSize({ width: 1920, height: 1080 })
for (const design of ["cinema", "marquee", "glow"]) {
	await page.mouse.move(0, 0)
	await open(`design=${design}&as=member`)
	check(`${design}, Expand at the bottom right: it covers no type and no focus target on any of ${SCREENS.length} screens`, await underOnAll(EXPAND), "nothing")
	const bars = []
	for (const screen of SCREENS) { await show(screen); const ids = await page.evaluate(() => { const tv = document.querySelector("[data-tv-screen]").getBoundingClientRect(); return [...document.querySelectorAll(".tvd-screen [data-tv-item]")].filter((el) => { const r = el.getBoundingClientRect(); return r.bottom < tv.top + tv.height * 0.17 }).map((el) => el.dataset.tvItem.replace("bar-", "")).join(" ") }); if (/[^a-z ]|expand/.test(ids) || ids.split(" ").some((id) => !["back", "search", "menu"].includes(id))) bars.push(`${screen[1] ?? screen[0]}: ${ids}`) }
	check(`${design}: the top bar holds Back, Search and Menu only, on every screen`, bars.join(" | ") || "only those", "only those")
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
	check("beside: the Remote is at rest after the cursor left the window", await atRest(), "0 12")
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
	// Cinema's streaming keys open what there is to watch on the service; the others narrow the lists and say so.
	const opens = !/design=(marquee|glow)/.test(query)
	await page.locator("[data-remote]").getByRole("button", { name: "Only Netflix" }).click()
	if (opens) await expect(`${label}: the Netflix key takes a click`, /› service-netflix · focus /)
	else check(`${label}: the Netflix key takes a click`, await toast("Only Netflix"), "shown")
	await page.locator("[data-remote]").getByRole("button", { name: "Only Prime Video" }).click()
	if (opens) await expect(`${label}: the Prime Video key takes a click`, /› service-prime · focus /)
	else check(`${label}: the Prime Video key takes a click`, await toast("Only Prime Video"), "shown")
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
check("at phone width the pointer waits, hidden, for a finger", await pointer("shown"), "false")
}
/** The boxes of some focus targets of the picture, in reading order. */
const boxes = (selector) => page.evaluate((sel) => [...document.querySelectorAll(`[data-tv-screen] ${sel}`)].map((el) => { const r = el.getBoundingClientRect(); return { id: el.dataset.tvItem, x: Math.round(r.left), y: Math.round(r.top), w: r.width, h: r.height } }), selector)
const tapItem = async (id) => { const b = await page.locator(`[data-tv-screen] [data-tv-item="${id}"]`).boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2) }
const tiles = () => page.evaluate(() => [...document.querySelectorAll("[data-tv-screen] .c-tile")].map((el) => el.dataset.tvItem).join(" "))
const THEMES = "theme-crime theme-mystery theme-family theme-growing theme-future theme-fantasy"
const STYLES = "style-animated style-spectacle style-slow style-fast style-talky style-nonlinear"
/** The rating strip as it stands: the levels and the scores from low on the left to high on the right, and the smallest target. */
const strip = async () => {
	const levels = await boxes("[data-tv-item^=level-]")
	const scores = await boxes("[data-tv-item^=score-]")
	const all = [...levels, ...scores, ...(await boxes("[data-tv-item=q-skip]"))]
	const ordered = (list) => list.every((b, i) => i === 0 || b.y > list[i - 1].y + 4 || (Math.abs(b.y - list[i - 1].y) <= 4 && b.x > list[i - 1].x))
	return { levels: levels.map((b) => b.id.slice(6)).join(" "), scores: scores.map((b) => b.id.slice(6)).join(" "), ordered: ordered(levels) && ordered(scores), under: scores.every((b) => b.y > levels[0].y + levels[0].h - 1), smallest: Math.floor(Math.min(...all.map((b) => Math.min(b.w, b.h)))) }
}
// The three screens added last, in Cinema, with the keys and the pointer.
await page.setViewportSize({ width: 1920, height: 1080 })
{
	// 1. Mini Discover's first screen: three tabs of six options (the default), or six moods (the key T).
	await open("design=cinema&at=home.discover")
	check("tabs: mini Discover has three tabs and six options, Moods open", `${(await boxes("[data-tv-item^=tab-]")).map((b) => b.id).join(" ")} · ${await tiles()}`, "tab-moods tab-themes tab-styles · mood-funny mood-feelgood mood-romance mood-action mood-scary mood-mind")
	check("tabs: the top bar is not crowded: it holds Back, Search, Menu, and the tabs stand under it", `${await inBar()} · ${await page.evaluate(() => document.querySelector("[data-tv-item=tab-moods]").getBoundingClientRect().top >= document.querySelector("[data-tv-item=bar-menu]").getBoundingClientRect().bottom)}`, "bar-back bar-search bar-menu · true")
	check("tabs: a tab is TV-sized", String((await boxes("[data-tv-item^=tab-]")).every((b) => b.h >= 60)), "true")
	await keys("ArrowUp"); await expect("tabs: Up from the options lands on the open tab", "home › discover · focus tab-moods")
	await keys("ArrowRight"); await expect("tabs: Right along the tabs moves to the next", "home › discover · focus tab-themes")
	check("tabs: and opens it at once", await tiles(), THEMES)
	await keys("ArrowUp"); await expect("tabs: Up again reaches the top bar", /^home › discover · focus bar-/)
	await keys("ArrowDown"); await expect("tabs: Down from the bar lands on the open tab", "home › discover · focus tab-themes")
	await keys("ArrowDown"); await expect("tabs: Down enters its options", /^home › discover · focus theme-/)
	await page.evaluate(() => window.__tvDesign.focus("theme-crime")); await page.waitForTimeout(260)
	await keys("Enter"); await expect("tabs: one choice leads to its titles", "home › discover › discover-theme.crime · focus t-oceans-eleven")
	await page.evaluate(() => window.__tvDesign.focus("expand")); await keys("Enter")
	await expect("tabs: Expand from a theme leads to Discover with that theme (an address that does not exist yet)", /focus expand · on \/discover\?themes=crime$/)
	await backToTv(); await keys("Escape"); await expect("tabs: Back returns to the choice", "home › discover · focus theme-crime")
	check("tabs: with the tab that was open", await tiles(), THEMES)
	// The pointer: over a tab it takes the focus and opens nothing; a click opens the tab.
	const [sx, sy] = await middle("[data-tv-item=tab-styles]")
	await page.mouse.move(sx, sy, { steps: 6 }); await expect("tabs: the pointer over a tab gives it the focus", "home › discover · focus tab-styles")
	check("tabs: and does not open it", await tiles(), THEMES)
	await page.mouse.click(sx, sy); await page.waitForTimeout(400)
	check("tabs: a click opens it", await tiles(), STYLES)
	await page.locator("[data-tv-item=style-animated]").click(); await expect("tabs: a click on a style leads to its titles", "home › discover › discover-style.animated · focus t-spirited-away")
	// The pointer leaves the picture first: resting over a poster it would take the focus back.
	await page.mouse.move(0, 0); await page.waitForTimeout(300)
	await page.evaluate(() => window.__tvDesign.focus("expand")); await page.waitForTimeout(260); await keys("Enter"); await expect("tabs: and Expand to Discover with that style", /on \/discover\?styles=animated$/)
	await backToTv(); await keys("Escape")
	await page.mouse.move(0, 0)
	// The other first screen, for comparison: six moods and Any mood.
	await keys("t"); await page.waitForSelector("button[data-choice=six]", { timeout: 8000 })
	check("six: T shows six moods, and no tabs", `${await tiles()} · ${(await boxes("[data-tv-item^=tab-]")).length}`, "mood-funny mood-feelgood mood-romance mood-action mood-scary mood-crime · 0")
	await page.evaluate(() => window.__tvDesign.focus("mood-crime")); await page.waitForTimeout(260)
	await keys("Enter"); await expect("six: a mood leads to its titles", "home › discover › discover-crime · focus t-knives-out")
	await page.evaluate(() => window.__tvDesign.focus("expand")); await keys("Enter"); await expect("six: and Expand to Discover with that mood", /on \/discover\?moods=crime$/)
	await backToTv(); await keys("Escape")
	await page.evaluate(() => window.__tvDesign.focus("mood-any")); await page.waitForTimeout(260)
	await keys("Enter"); await expect("six: Any mood has its own key", /^home › discover › discover-any · focus t-/)
	await keys("Escape"); await expect("six: (back on the six moods)", "home › discover · focus mood-any")
	check("six: Any mood covers nothing", `${(await under(".tvd-screen [data-tv-item=mood-any]")).join(", ") || "nothing"}`, "nothing")
	await keys("t"); await page.waitForSelector("button[data-choice=tabs]", { timeout: 8000 })

	// 2. The rating strip.
	await open("design=cinema&at=home.quiz")
	await expect("strip: the focus starts on Good", "home › quiz · focus level-good")
	let r = await strip()
	check("strip: the quiz has the four levels and the ten scores, low on the left, the scores under the levels", `${r.levels} · ${r.scores} · ${r.ordered} ${r.under}`, "dislike okay good excellent · 1 2 3 4 5 6 7 8 9 10 · true true")
	// Measured with the focus off the strip: the focused key stands a little larger.
	await page.evaluate(() => window.__tvDesign.focus("q-skip")); await page.waitForTimeout(400)
	check("strip: each level is as wide as its scores", String(await page.evaluate(() => { const box = (id) => document.querySelector(`[data-tv-item="${id}"]`).getBoundingClientRect(); return [["dislike", 1, 4], ["okay", 5, 6], ["good", 7, 8], ["excellent", 9, 10]].every(([name, lo, hi]) => Math.abs(box(`level-${name}`).left - box(`score-${lo}`).left) < 2 && Math.abs(box(`level-${name}`).right - box(`score-${hi}`).right) < 2) })), "true")
	await page.evaluate(() => window.__tvDesign.focus("level-good")); await page.waitForTimeout(260)
	await keys("ArrowLeft", "ArrowLeft"); await expect("strip: Left moves along the levels to the low end", "home › quiz · focus level-dislike")
	await keys("ArrowRight", "ArrowRight", "ArrowRight"); await expect("strip: Right to the high end", "home › quiz · focus level-excellent")
	await keys("ArrowDown"); await expect("strip: Down goes to the scores under the level", "home › quiz · focus score-9")
	await keys("ArrowRight"); await expect("strip: Right along the scores", "home › quiz · focus score-10")
	await keys("ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowLeft", "ArrowLeft")
	await expect("strip: Left along all ten", "home › quiz · focus score-1")
	check("strip: the focused score is named as the app names it", String(await page.getByText("1 · Unwatchable").count() > 0), "true")
	await keys("ArrowUp"); await expect("strip: Up returns to the level over it", "home › quiz · focus level-dislike")
	await keys("ArrowDown", "ArrowDown"); await expect("strip: Haven't seen it is under the strip", "home › quiz · focus q-skip")
	await keys("ArrowUp", "ArrowUp", "Enter"); check("strip: OK on a level gives the level's score", await toast("Rated · 1 of 5"), "shown")
	// The pointer.
	const [px, py] = await middle("[data-tv-item=score-4]")
	await page.mouse.move(px, py, { steps: 6 }); await expect("strip: the pointer over a score gives it the focus", "home › quiz · focus score-4")
	await page.mouse.click(px, py); check("strip: a click gives that score", await toast("Rated · 2 of 5"), "shown")
	await page.mouse.move(0, 0)
	// Rating a title from its screen: the exact score stays on the title.
	await open("design=cinema&at=home.title-knives-out.rate-knives-out")
	r = await strip()
	check("strip: rating a title has the same strip, and no skip", `${r.levels} · ${r.scores} · ${(await boxes("[data-tv-item=q-skip]")).length}`, "dislike okay good excellent · 1 2 3 4 5 6 7 8 9 10 · 0")
	await keys("ArrowDown", "ArrowRight", "Enter"); await expect("strip: a score returns to the title", /^home › title-knives-out · focus (watch|seen)$/)
	check("strip: which keeps the exact score", await page.locator("[data-tv-item=seen]").innerText(), "8 · Great")
	// In the smallest window the strip is the same, and still large enough.
	await page.setViewportSize({ width: 1280, height: 720 }); await open("design=cinema&at=home.quiz")
	r = await strip()
	check("strip: at 1280x720 the strip is the same and every target 44 px or more", `${r.ordered} ${r.smallest >= 44}`, "true true")
	await page.setViewportSize({ width: 1920, height: 1080 })

	// 3. The streaming keys: a screen per service, and a tile on home for each.
	await open("design=cinema")
	const service = (name) => page.locator("[data-remote]").getByRole("button", { name: `Only ${name}` })
	await service("Netflix").click(); await expect("service: the Remote's Netflix key opens On Netflix", /^home › service-netflix · focus t-/)
	check("service: the key shows it is on", await service("Netflix").getAttribute("aria-pressed"), "true")
	check("service: the screen has the service's titles, as many as the samples have", String((await boxes(".c-tile")).length), "13")
	await keys("Enter"); await expect("service: a title leads to its screen", /^home › service-netflix › title-[\w-]+ · focus watch$/)
	await keys("Escape"); await expect("service: Back returns", /^home › service-netflix · focus t-/)
	await page.evaluate(() => window.__tvDesign.focus("expand")); await keys("Enter"); await expect("service: Expand leads to Discover with that service alone", /on \/discover\?services=8$/)
	await backToTv(); await expect("service: and Back returns to it", "home › service-netflix · focus expand")
	await service("Prime Video").click(); await expect("service: the other key opens On Prime Video in its place", /^home › service-prime · focus t-/)
	await page.evaluate(() => window.__tvDesign.focus("expand")); await keys("Enter"); await expect("service: its Expand leads to Discover with Prime Video alone", /on \/discover\?services=9$/)
	await backToTv(); await expect("service: (back on Prime Video)", "home › service-prime · focus expand")
	await service("Prime Video").click(); await expect("service: the key again leaves the screen", /^home · focus /)
	// On the TV itself: a tile each on home, after the apps.
	check("service: home has a tile for each, after the apps", (await boxes("[data-tv-item^=app-]")).map((b) => b.id.slice(4)).join(" "), "tonight discover explorer taste service-netflix service-prime")
	await page.evaluate(() => window.__tvDesign.focus("app-taste")); await page.waitForTimeout(260)
	await keys("ArrowRight", "Enter"); await expect("service: Right from the last app reaches Netflix, and OK opens it", /^home › service-netflix · focus t-/)
	await keys("Escape", "ArrowRight", "Enter"); await expect("service: and the next tile is Prime Video", /^home › service-prime · focus t-/)
	// The pointer.
	await keys("h")
	const tile = page.locator("[data-tv-item=app-service-netflix]")
	await tile.scrollIntoViewIfNeeded(); await tile.click(); await expect("service: a click on the tile opens it", /^home › service-netflix · focus t-/)
	// The other directions keep what they had: the keys narrow the lists and say so.
	await open("design=marquee")
	await service("Netflix").click(); check("service: in Marquee the key still narrows the lists", await toast("Only Netflix"), "shown")
}

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
	const q = `design=${design}&as=member&form=${form}`
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
		await key("Only Netflix").tap(); await until(t("the Netflix key opens On Netflix"), /^home › service-netflix · focus t-/)
		await key("Only Prime Video").tap(); await until(t("the Prime Video key opens On Prime Video in its place"), /^home › service-prime · focus t-/)
		await key("Only Prime Video").tap(); await until(t("the key again leaves it"), /^home · focus /)
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
		// What shows of a target counts: a row that a paging list cuts off above the edge does not run off it.
		const ids = await page.evaluate(() => {
			const screen = document.querySelector("[data-tv-screen]")
			const tv = screen.getBoundingClientRect()
			const shownBottom = (el) => { let bottom = el.getBoundingClientRect().bottom; for (let p = el.parentElement; p && p !== screen; p = p.parentElement) if (getComputedStyle(p).overflow !== "visible") bottom = Math.min(bottom, p.getBoundingClientRect().bottom); return bottom }
			return [...screen.querySelectorAll("[data-tv-item]")].filter((el) => el.getBoundingClientRect().top < tv.bottom && shownBottom(el) > tv.bottom + 1).map((el) => el.dataset.tvItem)
		})
		if (ids.length) cut.push(`${screen[1] ?? screen[0]}: ${ids.join(", ")}`)
	}
	check(t("no focus target runs off the picture's bottom edge"), cut.join(" | ") || "none", "none")
	await show(["discover"])
	await page.locator(EXPAND).tap(); await page.getByText("The real page (a stand-in)").waitFor({ timeout: 8000 }).catch(() => {})
	check(t("a tap on Expand grows the picture into the page"), String(await page.getByText("goodwatch.app/discover").count() > 0), "true")
	await page.getByRole("button", { name: "← Back to the TV" }).tap(); await until(t("and Back returns to the TV"), "discover · focus expand")
	const cdp = await mobile.newCDPSession(page)
	if (design === "cinema") await touching(t, cdp, form)
	if (design === "cinema") await added(t)
	// A finger drags up on the TV and on the Remote, then the page is told to scroll: nothing may have moved.
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
/**
 * A finger on the picture points. A tap: the ring where it landed, the Remote aimed, the item opened, both back at
 * rest. A press held still: the ring stays under the finger and the pressed item opens on release. A drag: the
 * ring above the finger and following it, the items it passes focused, the one it is over opened on release,
 * and nothing on a release over none. No scroll, no selection, no menu.
 */
const touching = async (t, cdp, form) => {
	const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] })
	const mid = async (id) => { const b = await page.locator(`[data-tv-screen] [data-tv-item="${id}"]`).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2] }
	const look = () => page.evaluate(() => {
		const p = document.querySelector("[data-tv-pointer]")
		const s = document.querySelector("[data-remote-place]").getBoundingClientRect()
		const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(p.style.transform)
		const rig = document.querySelector("[data-remote-rig]").style.transform
		return { shown: p.dataset.shown, hold: p.dataset.hold ?? "false", x: m ? Number(m[1]) + s.left : -1, y: m ? Number(m[2]) + s.top : -1, rig, turn: Number(/rotateZ\(([-\d.]+)deg\)/.exec(rig)?.[1] ?? 0), lean: Number(/rotateX\(([-\d.]+)deg\)/.exec(rig)?.[1] ?? 0), body: document.querySelector("[data-remote] .remote-body").getBoundingClientRect().top, tv: document.querySelector("[data-tv-body]").getBoundingClientRect().bottom, selected: String(getSelection()), scrolled: window.scrollY + document.documentElement.scrollTop }
	})
	/** Waits until the pointer and the Remote are as wanted, for six seconds at most. */
	const settle = async (fits) => { let v = await look(); for (let i = 0; i < 60 && !fits(v); i++) { await page.waitForTimeout(100); v = await look() } return v }
	await show(["home"])
	// A tap.
	let [x, y] = await mid("app-discover")
	// A tap is short: the finger is up again before a long press begins. The ring and the Remote stay out a moment longer.
	// (Down and up are sent in one go: sent one by one, a loaded machine can stretch them into a long press.)
	await page.touchscreen.tap(x, y)
	let v = await settle((v) => v.shown === "true" && v.rig !== "none" && v.rig !== "")
	check(t("a tap shows the ring where the finger landed"), `${v.shown} ${Math.abs(v.x - x) < 14 && Math.abs(v.y - y) < 14}`, "true true")
	check(t("and the Remote aims at it"), String(v.rig !== "none" && v.rig !== ""), "true")
	await until(t("the tapped app opens"), "home › discover · focus mood-funny")
	v = await settle((v) => v.shown === "false" && v.rig === "none")
	check(t("then the ring is gone and the Remote back at rest"), `${v.shown} ${v.rig}`, "false none")
	if (!(await phoneState()).startsWith("home › discover")) await page.evaluate(() => window.__tvDesign.push("discover"))
	const [x2, y2] = await mid("mood-scary")
	// A press held still for a second, on a tile with another one above it: the ring stays under the finger, and
	// letting go opens the tile that was pressed.
	await touch("touchStart", x2, y2); await page.waitForTimeout(1000)
	v = await look()
	check(t("a press held still for a second keeps the ring under the finger"), `${v.shown} ${v.hold} ${Math.abs(v.x - x2) < 14 && Math.abs(v.y - y2) < 14}`, "true false true")
	check(t("and the pressed tile has the focus"), await phoneState(), "home › discover · focus mood-scary")
	await touch("touchEnd"); await until(t("letting go opens the tile that was pressed, not the one above it"), /^home › discover › discover-scary · focus /)
	await settle((v) => v.shown === "false" && v.rig === "none")
	await key("Back").tap(); await until(t("(back to the moods)"), /^home › discover · focus /)
	// A drag, from under one mood to another. Once the finger has moved more than 10 px the ring steps out above it.
	;[x, y] = await mid("mood-funny")
	await touch("touchStart", x, y + 46); await page.waitForTimeout(150)
	await touch("touchMove", x + 6, y + 46); await touch("touchMove", x + 14, y + 46)
	v = await settle((v) => v.hold === "true" && Math.abs(v.y - y) < 8)
	check(t("once the finger drags, the ring steps out above it"), `${v.shown} ${v.hold} ${Math.abs(v.x - x - 14) < 14 && Math.abs(v.y - y) < 14}`, "true true true")
	await until(t("the item under the ring has the focus"), "home › discover · focus mood-funny")
	const turned = v.turn
	for (let i = 1; i <= 8; i++) { await touch("touchMove", x + 14 + ((x2 - x - 14) * i) / 8, y + 46 + ((y2 - y) * i) / 8); await page.waitForTimeout(40) }
	await until(t("dragged, the focus goes where the ring goes"), "home › discover · focus mood-scary")
	v = await settle((v) => Math.abs(v.x - x2) < 16 && Math.abs(v.y - y2) < 16 && Math.abs(v.turn - turned) > 0.4)
	check(t("the ring follows the finger"), String(Math.abs(v.x - x2) < 16 && Math.abs(v.y - y2) < 16), "true")
	check(t("and the Remote follows it"), String(Math.abs(v.turn - turned) > 0.4), "true")
	check(t(form === "table" ? "lying, the Remote turns on the table and does not lean" : "held, the Remote leans back toward the picture"), String(form === "table" ? v.lean === 0 : v.lean > 3), "true")
	check(t("turned, the Remote stays under the TV"), String(v.body >= v.tv - 1), "true")
	check(t("the drag scrolls nothing and selects nothing"), `${v.scrolled} "${v.selected}"`, '0 ""')
	check(t("a held finger opens no menu"), String(await page.evaluate(() => { const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true }); document.querySelector("[data-tv-screen] [data-tv-item]").dispatchEvent(e); return e.defaultPrevented })), "true")
	await touch("touchEnd"); await until(t("letting go opens the mood under the ring"), /^home › discover › discover-scary · focus /)
	v = await settle((v) => v.shown === "false" && v.rig === "none")
	check(t("and both return to rest"), `${v.shown} ${v.rig}`, "false none")
	// A drag let go over nothing.
	const tv = await page.locator("[data-tv-screen]").boundingBox()
	await touch("touchStart", tv.x + tv.width * 0.5, tv.y + tv.height * 0.3 + 46); await page.waitForTimeout(700)
	await touch("touchMove", tv.x + tv.width * 0.3, tv.y + 30 + 46); await page.waitForTimeout(400)
	v = await look()
	await touch("touchEnd"); await page.waitForTimeout(500)
	check(t("let go over nothing, nothing opens"), `${v.shown} ${await phoneState()}`.replace(/focus .*$/, "focus"), "true home › discover › discover-scary · focus")
	// The Remote's own keys are not pointed at. (First the Remote is let come to rest from the drag before.)
	await settle((v) => v.shown === "false" && v.rig === "none")
	await key("Back").tap(); await until(t("a key of the Remote works as before"), /^home › discover · focus /)
	v = await look()
	check(t("and does not aim the Remote or show the ring"), `${v.shown} ${v.rig}`, "false none")
}
/** The three screens added last, with a finger and the phone Remote's keys: the tabs, the rating strip, a service. */
const added = async (t) => {
	// Mini Discover's tabs: a tap opens a tab, a tap on an option leads to its titles.
	await show(["discover"])
	check(t("mini Discover has three tabs, Moods open, six options"), `${(await boxes("[data-tv-item^=tab-]")).map((b) => b.id).join(" ")} · ${(await tiles()).split(" ").length}`, "tab-moods tab-themes tab-styles · 6")
	await tapItem("tab-styles"); await page.waitForTimeout(500)
	check(t("a tap on a tab opens it"), await tiles(), STYLES)
	await tapItem("tab-themes"); await page.waitForTimeout(500)
	check(t("and on another, that one"), await tiles(), THEMES)
	await page.evaluate(() => window.__tvDesign.focus("theme-crime")); await page.waitForTimeout(260)
	await key("Up").tap(); await until(t("Up from the options lands on the open tab"), "discover · focus tab-themes")
	await key("Next").tap(); await until(t("Next along the tabs opens the next one"), "discover · focus tab-styles")
	check(t("its options are there"), await tiles(), STYLES)
	await tapItem("style-slow"); await until(t("a tap on an option leads to its titles"), /^discover › discover-style\.slow · focus t-/)
	await key("Back").tap(); await until(t("Back returns to the tab that was open"), /^discover · focus /)
	check(t("which still shows its options"), await tiles(), STYLES)
	await page.waitForTimeout(700)
	// The rating strip: every target 44 px or more, low on the left; a tap and the Remote's keys give a score.
	await show(["quiz"])
	let r = await strip()
	check(t("the quiz has the four levels and the ten scores, low to high"), `${r.levels} · ${r.scores} · ${r.ordered}`, "dislike okay good excellent · 1 2 3 4 5 6 7 8 9 10 · true")
	check(t("the scores stand under the levels"), String(r.under), "true")
	check(t("every target of the strip is 44 px or more"), String(r.smallest >= 44), "true")
	const title = () => page.evaluate(() => document.querySelector("[data-tv-screen]").innerText.split("\n").filter(Boolean).slice(0, 4).join("|"))
	await tapItem("score-8"); check(t("a tap on an exact score rates the title"), await toast("Rated · 1 of 5"), "shown")
	await until(t("the focus stays where it was for the next title"), "quiz · focus score-8")
	await page.evaluate(() => window.__tvDesign.focus("level-good")); await page.waitForTimeout(260)
	await key("Next").tap(); await until(t("Next moves along the levels"), "quiz · focus level-excellent")
	await key("Down").tap(); await until(t("Down goes to the scores under the level"), "quiz · focus score-9")
	await key("Previous").tap(); await until(t("Previous moves along the scores"), "quiz · focus score-8")
	await key("OK").tap(); check(t("OK gives that score"), await toast("Rated · 2 of 5"), "shown")
	const before = await title()
	await tapItem("q-skip"); await page.waitForTimeout(600)
	check(t("Haven't seen it is its own key and goes on without a score"), String((await title()) !== before), "true")
	await page.waitForTimeout(2000)
	// A streaming service's screen: from the Remote's key, with the way out to the real page.
	await show(["home"])
	await key("Only Netflix").tap(); await until(t("the Netflix key opens On Netflix"), /^home › service-netflix · focus t-/)
	await page.locator(EXPAND).tap(); await page.getByText("The real page (a stand-in)").waitFor({ timeout: 8000 }).catch(() => {})
	check(t("Expand there leads to Discover with that service alone"), String(await page.getByText("goodwatch.app/discover?services=8").count() > 0), "true")
	await page.getByRole("button", { name: "← Back to the TV" }).tap(); await until(t("and Back returns to it"), "home › service-netflix · focus expand")
	await show(["home"])
}
const PHONES = [[390, 844], [360, 740], [375, 667], [430, 932], [390, 700]]
for (const [width, height] of QUICK ? [[390, 844]] : PHONES) await phone(width, height, "hand")
for (const [width, height] of QUICK ? [[375, 667]] : PHONES) await phone(width, height, "table")
// The other two directions, on the shortest phone and the largest.
if (!QUICK) for (const design of ["marquee", "glow"]) for (const [width, height] of [[375, 667], [430, 932]]) await phone(width, height, "hand", design)
// By itself the Remote is held in the hand, and lies on the table in the two windows too short for that; K forces
// the other form, and K again gives the choice back.
for (const [width, height, wanted] of [[390, 844, "hand"], [360, 740, "hand"], [375, 667, "table"], [430, 932, "hand"], [390, 700, "table"]]) {
	const mobile = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true })
	const desktop = page
	page = await mobile.newPage()
	await open("design=cinema")
	const form = () => page.locator("[data-remote]").getAttribute("data-phone-remote")
	check(`phone ${width}x${height}: by itself the Remote is ${wanted === "hand" ? "in the hand" : "on the table"}`, await form(), wanted)
	const other = wanted === "hand" ? "table" : "hand"
	await keys("k"); await page.waitForSelector(`[data-phone-remote=${other}]`, { timeout: 8000 }).catch(() => {})
	check(`phone ${width}x${height}: K forces the other form`, `${await form()} ${new URL(page.url()).searchParams.get("form")}`, `${other} ${other}`)
	await keys("k"); await page.waitForSelector(`[data-phone-remote=${wanted}]`, { timeout: 8000 }).catch(() => {})
	check(`phone ${width}x${height}: K again returns to the phone's own choice`, `${await form()} ${new URL(page.url()).searchParams.get("form")}`, `${wanted} null`)
	await mobile.close()
	page = desktop
}
// With reduced motion a tap still points and opens, and the Remote stays still.
{
	const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" })
	const desktop = page
	page = await mobile.newPage()
	await open("design=cinema")
	const b = await page.locator("[data-tv-screen] [data-tv-item=app-discover]").boundingBox()
	await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(150)
	check("reduced motion: a tap shows the ring and the Remote stays still", await page.evaluate(() => `${document.querySelector("[data-tv-pointer]").dataset.shown} ${document.querySelector("[data-remote-rig]").style.transform || "none"}`), "true none")
	await until("reduced motion: and the tapped app opens", "home › discover · focus mood-funny")
	await mobile.close()
	page = desktop
}
// The prototype's own controls are folded behind one key on the phone.
await page.setViewportSize({ width: 390, height: 844 }); await open("design=cinema")
check("at phone width the controls are folded away", String(await page.locator("button[data-design=glow]").isVisible()), "false")
await page.locator("[data-controls]").click(); await page.locator("button[data-design=glow]").click(); await marked("glow")
check("and one key unfolds them: the buttons choose", await current(), "3 Glow")
await page.locator("button[data-form]").click(); await page.waitForSelector("[data-phone-remote=table]", { timeout: 8000 }).catch(() => {})
check("and the Remote's other form", await page.locator("[data-remote]").getAttribute("data-phone-remote"), "table")
// The room with a touch screen: a finger on the picture points there too, with the Remote in the hand.
{
	const touchScreen = await browser.newContext({ viewport: { width: 1920, height: 1080 }, hasTouch: true })
	const desktop = page
	page = await touchScreen.newPage()
	await open("design=cinema")
	const b = await page.locator("[data-tv-screen] [data-tv-item=app-tonight]").boundingBox()
	await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)
	let turn = 0
	for (let i = 0; i < 20 && turn > -3; i++) { await page.waitForTimeout(40); turn = Math.min(turn, (await aim())[0]) }
	check("in the room, a finger on the picture shows the ring and turns the Remote toward it", `${await pointer("shown")} ${turn < -3}`, "true true")
	await expect("and the tapped app opens", /^home › tonight · focus /)
	await touchScreen.close()
	page = desktop
}
console.log(fails ? `${fails} FAILED, ${passed} ok` : `all ${passed} ok`)
await browser.close()
process.exitCode = fails ? 1 : 0
