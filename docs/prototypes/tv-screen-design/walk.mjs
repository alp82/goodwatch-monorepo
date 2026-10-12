// Drives the design prototype with keys and with clicks on the Remote, in each of the three directions, and checks
// the state line after each step: the apps flow must behave the same however it is dressed.
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3147 node walk.mjs
// Needs the dev server (see README.md). The repo has no browser driver: install playwright-core outside it.
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
const base = `${process.env.BASE ?? "http://localhost:3147"}/prototype/tv-screen-design`
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium" })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
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
const open = async (q) => { await page.goto(`${base}?${q}`, { waitUntil: "load", timeout: 120000 }); await page.waitForSelector("[data-tv-item][aria-current]", { timeout: 60000 }); await page.waitForTimeout(700) }
const keys = async (...ks) => { for (const k of ks) { await page.keyboard.press(k); await page.waitForTimeout(260) } }
const current = async () => (await page.locator("button[data-design][aria-pressed=true]").allInnerTexts()).join("|").replace(/\s+/g, " ")
/** The top bar's actions on the screen (not the menu over it), in the order they are drawn. */
const bar = () => page.evaluate(() => [...document.querySelectorAll(".tvd-screen [data-tv-item]")].map((el) => el.dataset.tvItem).filter((id) => id.startsWith("bar-") || id === "expand").join(" "))
const pointer = (name) => page.evaluate((n) => document.querySelector("[data-tv-pointer]")?.dataset[n], name)
const middle = async (selector) => { const b = await page.locator(selector).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2] }
/** The Remote's turn about the wrist and its lean, in degrees, from the transform the pointing loop wrote. */
const aim = () => page.evaluate(() => { const t = document.querySelector("[data-remote]").style.transform; return [Number(/rotateZ\(([-\d.]+)deg\)/.exec(t)?.[1] ?? 0), Number(/rotateX\(([-\d.]+)deg\)/.exec(t)?.[1] ?? 0)] })
const marked = (key) => page.waitForSelector(`button[data-design=${key}][aria-pressed=true]`, { timeout: 8000 }).then(() => page.waitForTimeout(400), () => {})

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
	await keys("b"); await page.waitForSelector("button[data-bar=first]", { timeout: 8000 }); check(t("the alternative puts Expand first"), await bar(), "expand bar-back bar-search bar-menu")
	await keys("b"); await page.waitForSelector("button[data-bar=last]", { timeout: 8000 })
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
	const corners = {}
	for (const [name, x, y] of [["top left", 3, 3], ["top right", 1900, 3], ["bottom left", 3, 1076], ["bottom right", 1900, 1076]]) {
		await page.mouse.move(x, y, { steps: 5 }); await page.waitForTimeout(900)
		corners[name] = await aim()
	}
	const [tl, tr, bl, br] = Object.values(corners)
	check(t("the Remote turns left for the left corners and right for the right ones"), [tl[0] < -30, tr[0] > 30, bl[0] < -30, br[0] > 30].join(" "), "true true true true")
	check(t("the Remote leans back further for the top corners than for the bottom ones"), [tl[1] > bl[1] + 1, tr[1] > br[1] + 1].join(" "), "true true")
	// The Remote's keys: the wheel is in the middle of the window, under the TV.
	await page.mouse.move(cx, 950, { steps: 6 }); await page.waitForTimeout(1100)
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
// The pointer shapes.
await keys("c"); await page.waitForSelector("button[data-pointer=cross]", { timeout: 8000 }); check("the key C chooses the next pointer shape", await pointer("shape"), "cross")
await page.locator("button[data-pointer]").click(); await page.waitForSelector("button[data-pointer=dot]", { timeout: 8000 }); check("the pointer button chooses the next one", await pointer("shape"), "dot")
await page.setViewportSize({ width: 390, height: 844 }); await open("design=cinema")
check("at phone width there is no pointer", String(await page.locator("[data-tv-pointer]").count()), "0")
await page.locator("button[data-design=glow]").click(); await marked("glow")
check("at phone width the buttons are there and choose", await current(), "3 Glow")
console.log(fails ? `${fails} FAILED, ${passed} ok` : `all ${passed} ok`)
await browser.close()
process.exitCode = fails ? 1 : 0
