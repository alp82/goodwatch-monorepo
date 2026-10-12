// Drives the flow prototype with keys and with clicks on the Remote, and checks the state line after each step.
//   PLAYWRIGHT=/scratch/node_modules/playwright-core/index.mjs BASE=http://localhost:3147 node walk.mjs
// Needs the dev server (see README.md). The repo has no browser driver: install playwright-core outside it.
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright-core")
const base = `${process.env.BASE ?? "http://localhost:3147"}/prototype/tv-screen-flow`
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/usr/bin/chromium" })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
const page = await ctx.newPage()
page.on("pageerror", (e) => { if (!/Suspense/.test(e.message)) console.log("PAGEERROR", e.message) })
const state = async () => (await page.locator("span.font-mono").first().innerText()).trim()
let fails = 0
// Waits up to eight seconds for the state: on a loaded machine a run or a variant change takes longer than its clock.
const expect = async (label, want) => {
	const fits = (got) => (typeof want === "string" ? got === want : want.test(got))
	let got = await state()
	for (let i = 0; i < 80 && !fits(got); i++) {
		await page.waitForTimeout(100)
		got = await state()
	}
	const ok = fits(got)
	if (!ok) fails++
	console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${got}${ok ? "" : `   (wanted ${want})`}`)
}
const open = async (q) => { await page.goto(`${base}?${q}`, { waitUntil: "load", timeout: 120000 }); await page.waitForSelector("[data-tv-item][aria-current]", { timeout: 60000 }); await page.waitForTimeout(700) }
const keys = async (...ks) => { for (const k of ks) { await page.keyboard.press(k); await page.waitForTimeout(220) } }

await open("variant=rows")
await expect("rows home starts on the hero", "home · focus hero")
await keys("ArrowDown"); await expect("down from the hero lands on the row's first tile", "home · focus t-paddington-2")
await keys("ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight"); await expect("right stops at the expand tile", "home · focus expand-discover")
await keys("ArrowDown"); await expect("down to the next row's expand tile", "home · focus expand-explorer")
await keys("ArrowUp", "ArrowUp", "ArrowUp"); await expect("up to the tabs lands on the current tab", "home · focus tab-home")
await keys("ArrowRight"); await expect("focusing a tab switches to it", "discover · focus tab-discover")
await keys("ArrowDown"); await expect("down into the moods", /^discover · focus mood-/)
await keys("ArrowRight", "Enter"); await expect("OK on a mood keeps the focus on it", /^discover-\w+ · focus mood-/)
await keys("ArrowDown", "Enter"); await expect("OK on a title opens its screen", /^discover-\w+ › title-[\w-]+ · focus watch$/)
await keys("ArrowRight", "Enter"); await page.waitForTimeout(300); await expect("Want to See stays on the title", /title-[\w-]+ · focus want$/)
await keys("ArrowRight", "Enter"); await expect("Seen it asks how it was", /› rate-[\w-]+ · focus level-Loved it$/)
await keys("Enter"); await expect("a rating returns to the title, focus on Seen it", /title-[\w-]+ · focus seen$/)
await keys("Escape"); await expect("Back returns to the list with the focus where it was", /^discover-\w+ · focus t-/)
await keys("m"); await expect("M opens the menu", /› menu · focus menu-home$/)
await keys("Escape", "h"); await expect("H goes home", /^home · focus/)
// The remote in the room.
await page.getByRole("button", { name: "Down", exact: true }).click(); await page.waitForTimeout(250)
const before = await state()
await page.getByRole("button", { name: "Next", exact: true }).click(); await page.waitForTimeout(250)
await expect("the remote's arrows move the focus", new RegExp(`^(?!${before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$)home · focus t-`))
await page.getByRole("button", { name: "OK", exact: true }).click(); await page.waitForTimeout(300); await expect("the remote's OK opens the title", /^home › title-/)
await page.getByRole("button", { name: "Back", exact: true }).first().click(); await page.waitForTimeout(300); await expect("the remote's Back returns", /^home · focus t-/)
await page.getByRole("button", { name: "Search", exact: true }).first().click(); await page.waitForTimeout(300); await expect("the remote's Search opens search", /^home › search · focus idea-cozy$/)
await page.keyboard.type("heist", { delay: 40 }); await keys("Enter"); await expect("typing and OK searches", /› search › search-heist · focus t-/)
await page.getByRole("button", { name: "Home", exact: true }).first().click(); await page.waitForTimeout(300); await expect("the remote's Home goes home", /^home · focus/)
await page.getByRole("button", { name: "Only Netflix" }).click(); await page.waitForTimeout(300)
console.log("     toast after the Netflix key:", await page.locator(".rounded-full.bg-white.text-black.shadow-2xl").first().innerText().catch(() => "none"))
// Leaving: rows, one press.
await open("variant=rows&at=discover-cozy&f=expand")
await keys("Enter"); await page.waitForTimeout(1700); await expect("rows: one OK lands on the page", /focus expand · on \/discover\?mood=cozy$/)
await keys("Escape"); await page.waitForTimeout(900); await expect("Back comes back into the same TV screen", "discover-cozy · focus expand")
// Apps: the corner key.
await open("variant=apps&at=home.explorer.island-heists")
await keys("ArrowUp"); await expect("apps: up reaches the corner key", "home › explorer › island-heists · focus expand")
await keys("Enter"); await page.waitForTimeout(1500); await expect("apps: OK lands on the page", /on \/explorer\?island=heists$/)
await page.getByRole("button", { name: "← Back to the TV" }).click(); await page.waitForTimeout(900); await expect("the page's own Back returns", "home › explorer › island-heists · focus expand")
// Guided: slow, Back cancels, a second OK skips the wait.
await open("variant=guided")
await keys("Enter", "ArrowRight", "Enter", "Enter"); await expect("guided: three answers reach a pick", /^home › mood › kind-cozy › pick-cozy-movie-0 · focus more$/)
await keys("ArrowRight", "ArrowRight"); await expect("the expand control is the last one", /focus expand$/)
await keys("Enter"); await page.waitForTimeout(900); await expect("guided: after 0.9 s still on the TV, brackets creeping", /expanding to \/discover\?mood=cozy&type=movie$/)
await keys("Escape"); await page.waitForTimeout(700); await expect("Back cancels the slow run", /pick-cozy-movie-0 · focus expand$/)
await keys("Enter"); await page.waitForTimeout(300); await keys("Enter"); await page.waitForTimeout(1300); await expect("a second OK skips the wait", /· on \/discover/)
await keys("Enter"); await page.waitForTimeout(900); await expect("OK on the page comes back", /pick-cozy-movie-0 · focus expand$/)
// The quiz gives a guest a taste.
await open("variant=guided&at=home.quiz")
await keys("Enter", "Enter", "Enter", "Enter", "Enter"); await page.waitForTimeout(300); await expect("five ratings end on the taste screen", /^home › taste · focus picks$/)
// Member and the switcher.
await open("variant=apps&as=member")
await keys("ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "Enter"); await expect("member: the fifth app is My shows", "home › shows · focus ep-severance")
await keys("]"); await page.waitForTimeout(500); await expect("] switches the variant and starts at home", /^home · focus/)
// The variant buttons in the control bar, and the keys 1, 2, 3.
const check = (label, got, want) => { const ok = got === want; if (!ok) fails++; console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${got}${ok ? "" : `   (wanted ${want})`}`) }
const current = async () => (await page.locator("button[data-variant][aria-pressed=true]").allInnerTexts()).join("|").replace(/\s+/g, " ")
await open("variant=rows&at=discover-cozy")
check("the control bar has one button per variant", (await page.locator("button[data-variant]").allInnerTexts()).map((t) => t.replace(/\s+/g, " ")).join(", "), "1 rows, 2 apps, 3 guided")
check("the current variant is marked", await current(), "1 rows")
// A variant change is a router navigation, which the dev build may commit late: wait for the mark, not a fixed time.
const marked = (key) => page.waitForSelector(`button[data-variant=${key}][aria-pressed=true]`, { timeout: 8000 }).then(() => page.waitForTimeout(400), () => {})
await page.locator("button[data-variant=apps]").click(); await marked("apps")
check("a click on a variant's button chooses it", `${await current()} · ${await state()}`, "2 apps · home · focus app-tonight")
await keys("3"); await marked("guided"); check("the key 3 chooses guided", `${await current()} · ${await state()}`, "3 guided · home · focus go-tonight")
await keys("1"); await marked("rows"); check("the key 1 chooses rows", `${await current()} · ${await state()}`, "1 rows · home · focus hero")
await keys("s", "2"); await page.waitForTimeout(500); check("on the search screen a digit is typed, not a variant", `${await current()} · ${await state()}`, "1 rows · home › search · focus idea-cozy")
await page.setViewportSize({ width: 390, height: 844 }); await open("variant=rows")
await page.locator("button[data-variant=guided]").click(); await marked("guided")
check("at phone width the buttons are there and choose", await current(), "3 guided")
console.log(fails ? `${fails} FAILED` : "all ok")
await browser.close()
process.exitCode = fails ? 1 : 0
