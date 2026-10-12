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
	await keys("ArrowUp"); await expect(t("up reaches the expand key"), /title-only-murders · focus expand$/)
	await keys("Enter"); await expect(t("OK grows the picture into the title page"), /focus expand · on \/show\/only-murders$/)
	await keys("Escape"); await expect(t("Back comes back into the same screen and focus"), /title-only-murders · focus expand$/)
	await keys("Escape"); await expect(t("Back returns to the list with the focus where it was"), "home › discover › discover-cozy · focus t-only-murders")
	await keys("m"); await expect(t("M opens the menu"), /› menu · focus menu-home$/)
	await keys("Escape", "h"); await expect(t("H goes home"), "home · focus app-tonight")
	// The map.
	await keys("ArrowRight", "ArrowRight", "Enter"); await expect(t("Explorer opens on the first island"), "home › explorer · focus island-heists")
	await keys("ArrowRight"); await expect(t("right sails to the next island"), "home › explorer · focus island-whodunits")
	await keys("ArrowDown"); await expect(t("down sails to the row below"), /^home › explorer · focus island-(workplace|time-loops)$/)
	await keys("Enter"); await expect(t("OK steps onto the island"), /^home › explorer › island-(workplace|time-loops) · focus t-/)
	await keys("h")
	// The Remote in the room.
	await page.getByRole("button", { name: "Next", exact: true }).click(); await expect(t("the remote's arrow moves the focus"), "home · focus app-discover")
	await page.getByRole("button", { name: "OK", exact: true }).click(); await expect(t("the remote's OK opens the app"), "home › discover · focus mood-funny")
	await page.getByRole("button", { name: "Back", exact: true }).first().click(); await expect(t("the remote's Back returns"), "home · focus app-discover")
	await page.getByRole("button", { name: "Search", exact: true }).first().click(); await expect(t("the remote's Search opens search"), "home › search · focus idea-cozy")
	await page.keyboard.type("heist", { delay: 40 }); await keys("Enter"); await expect(t("typing and OK searches"), "home › search › search-heist · focus t-oceans-eleven")
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
await page.setViewportSize({ width: 390, height: 844 }); await open("design=cinema")
await page.locator("button[data-design=glow]").click(); await marked("glow")
check("at phone width the buttons are there and choose", await current(), "3 Glow")
console.log(fails ? `${fails} FAILED, ${passed} ok` : `all ${passed} ok`)
await browser.close()
process.exitCode = fails ? 1 : 0
