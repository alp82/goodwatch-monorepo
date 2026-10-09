// Drives /prototype/watch-log-real (the real components over a stand-in server) in headless Chromium.
//   node drive.mjs <desktop|phone> <port-on> <port-off> <screenshot dir>
import { chromium } from "playwright-core"

const [mode = "desktop", portOn = "3105", portOff = "3106", shots = "."] = process.argv.slice(2)
const phone = mode === "phone"
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", args: ["--no-sandbox"] })
const context = await browser.newContext(
	phone
		? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, timezoneId: "Europe/Berlin", locale: "en-GB" }
		: { viewport: { width: 1280, height: 900 }, timezoneId: "Europe/Berlin", locale: "en-GB" },
)
const page = await context.newPage()
const requested = []
page.on("request", (r) => requested.push(r.url()))
page.on("pageerror", (e) => console.log("  pageerror:", e.message.slice(0, 400)))
const dialogs = []
page.on("dialog", (d) => {
	dialogs.push(d.message())
	void d.dismiss()
})

let passed = 0
const failed = []
const check = (name, ok, detail = "") => {
	if (ok) passed++
	else failed.push(`${name}${detail ? ` :: ${detail}` : ""}`)
	console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok || !detail ? "" : ` :: ${detail}`}`)
}
const shot = (name) => page.screenshot({ path: `${shots}/${name}-${mode}.jpg`, type: "jpeg", quality: 50 })

const open = async (port, query = "") => {
	await page.goto(`http://localhost:${port}/prototype/watch-log-real${query}`, { waitUntil: "domcontentloaded", timeout: 120000 })
	await page.waitForSelector("[data-harness]", { timeout: 120000 })
	await page.waitForFunction(() => window.harnessServer?.requests.length > 0 || location.search.includes("guest"), null, { timeout: 30000 })
	await page.waitForTimeout(2500)
}
const state = () => page.evaluate(() => JSON.parse(JSON.stringify(window.harnessServer.state())))
const requests = () => page.evaluate(() => window.harnessServer.requests.map((r) => `${r.status} ${r.method} ${r.url} ${r.body ? JSON.stringify(r.body) : ""}`))
const reset = async () => {
	await page.keyboard.press("Escape")
	await page.locator("[data-toast]").first().waitFor({ state: "detached", timeout: 9000 }).catch(() => {})
	await page.locator("[data-reset]").click()
	await page.waitForTimeout(700)
}
const hero = (id) => page.locator(`[data-hero="${id}"]`)
const seen = (id) => hero(id).getByRole("button", { name: /Seen/ })
// "Want to See", or "Want to rewatch" once the movie is Seen.
const want = (id) => hero(id).getByRole("button", { name: /^Want to/ })
const toast = () => page.locator("[data-toast]").last()
const panel = () => page.locator(phone ? "[data-watch-log-sheet]" : "[data-watch-log-popover]")
const rows = () => panel().locator("[data-watch]")
const rowTexts = async () => (await rows().allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim())
const settle = (ms = 500) => page.waitForTimeout(ms)
const closePanel = async () => {
	await panel().getByRole("button", { name: "Close the watch log" }).click()
	await settle(450)
}
const logIds = async (id) => ((await state()).logs[id] ?? []).map((w) => w.id)

const DUNE = 693134
const PARASITE = 496243
const INTER = 157336
const PULP = 680
const MATRIX = 603
const SHOW = 1396
const NEXT = 872585

// ------------------------------------------------------------------------------------------------------------
// Flag on
// ------------------------------------------------------------------------------------------------------------
await open(portOn)
check("the flag is on for this server", (await page.getAttribute("[data-flag]", "data-flag")) === "on")
check("first view: the log's code is not requested", !requested.some((u) => /WatchLogSurface|WatchLog\.tsx|DateChoice|WatchedLine|useWatchLog/.test(u)))
check("first view: only the member data was read", (await requests()).join("|") === "200 GET /api/user-data ", (await requests()).join("|"))
check("a movie with three watches shows the count on Seen", /3×/.test(await seen(INTER).innerText()), await seen(INTER).innerText())
check("a movie with one watch shows no count", (await seen(PARASITE).innerText()).trim() === "Seen", await seen(PARASITE).innerText())
check("a rated movie without a watch reads Seen, without a count", (await seen(PULP).innerText()).trim() === "Seen")
check("a movie that is not Seen reads Mark as Seen", (await seen(DUNE).innerText()).trim() === "Mark as Seen")

// --- One tap ---
await seen(DUNE).scrollIntoViewIfNeeded()
if (!phone) await seen(DUNE).hover()
await seen(DUNE).click()
await toast().waitFor({ timeout: 15000 })
check("one tap: the log's code loaded on first use", requested.some((u) => /WatchLogSurface/.test(u)))
check("one tap: the page hears of the mark, as it does of every other", (await page.locator("[data-marks]").innerText()) === "1", await page.locator("[data-marks]").innerText())
check("one tap: Seen is on", (await seen(DUNE).getAttribute("aria-pressed")) === "true")
check("one tap: the toast names the title and offers Change date and Undo", /Dune: Part Two is Seen, watched just now/.test(await toast().innerText()) && (await toast().getByRole("button").allInnerTexts()).join("|") === "Change date|Undo", await toast().innerText())
let s = await state()
check("one tap: one watch for now is stored", s.logs[DUNE]?.length === 1 && s.logs[DUNE][0].precision === "moment" && s.logs[DUNE][0].origin === "single")
check("one tap: the movie left the Wishlist", !(`movie-${DUNE}` in s.wishlist) && (await want(DUNE).getAttribute("aria-pressed")) === "false")
const box = await toast().boundingBox()
check("one tap: the toast fits the screen", box && box.x >= 0 && box.x + box.width <= (phone ? 390 : 1280), JSON.stringify(box))
await shot("watch-log-1-one-tap")
const firstId = s.logs[DUNE][0].id
const wishedAt = (await state()).wishlist
// --- Undo ---
await toast().getByRole("button", { name: "Undo" }).click()
await settle(800)
s = await state()
check("Undo of the first tap: the watch is gone and Seen is off", !s.logs[DUNE] && (await seen(DUNE).innerText()).trim() === "Mark as Seen")
check("Undo of the first tap: back on the Wishlist with its place", s.wishlist[`movie-${DUNE}`]?.createdAt === s.wishlist[`movie-${NEXT}`]?.createdAt && (await want(DUNE).getAttribute("aria-pressed")) === "true", JSON.stringify(s.wishlist))
check("Undo sent a delete naming the watch and what to put back", (await requests()).some((r) => r.includes(`"type":"delete","watchId":"${firstId}","back":{"wantToSeeAddedAt"`)))

// --- Change date from the toast ---
await seen(DUNE).click()
await toast().waitFor()
await toast().getByRole("button", { name: "Change date" }).click()
await panel().waitFor()
await settle()
check("Change date: the log opens with the new watch in the editor", (await panel().locator("[data-date-choice]").count()) === 1 && (await rows().count()) === 1)
check("Change date: the editor offers a day or don't know when, never a time", (await panel().locator("[data-date-choice] [data-option]").allInnerTexts()).join("|") === "Today|Yesterday|Another day|Don't know when")
await shot("watch-log-2-change-date")
await panel().locator('[data-option="yesterday"]').click()
await settle(700)
s = await state()
check("Change date: the watch is yesterday, a day without a time", s.logs[DUNE][0].precision === "day" && (await rowTexts())[0] === "Yesterday", JSON.stringify(await rowTexts()))
await closePanel()
check("the log closes", (await panel().count()) === 0 || !(await panel().isVisible()))

// --- The log of a movie with three watches ---
const before = (await requests()).length
await seen(INTER).scrollIntoViewIfNeeded()
await seen(INTER).click()
await panel().waitFor()
await rows().first().waitFor()
await settle()
s = await state()
check("Seen on a Seen movie opens the log and removes nothing", s.logs[INTER].length === 3)
check("the log is read through its own endpoint, once", (await requests()).slice(before).join("|").trim() === `200 GET /api/watch-log?tmdb_id=${INTER}`, (await requests()).slice(before).join("|"))
let texts = await rowTexts()
check("the log: dated newest first, undated below", texts.length === 3 && /^\d{1,2} \w+ \d{4} ?21:40$/.test(texts[0]) && texts[1] === "12 Mar 2019 Imported from Letterboxd" && texts[2] === "Date unknown Imported from IMDb", JSON.stringify(texts))
const styles = await rows().evaluateAll((els) =>
	els.map((el) => {
		const day = el.querySelector("p span")
		const time = el.querySelector("p span + span")
		const cs = (n) => (n ? getComputedStyle(n) : null)
		return { weight: cs(day)?.fontWeight, italic: cs(day)?.fontStyle, time: time ? cs(time).color : null, dashed: getComputedStyle(el).borderTopStyle }
	}),
)
check("the log: the day is bold, the time grey, Date unknown italic below a dashed line", Number(styles[0].weight) >= 600 && styles[0].time !== null && styles[2].italic === "italic" && styles[2].dashed === "dashed" && styles[1].time === null, JSON.stringify(styles))
if (!phone) {
	const p = await panel().boundingBox()
	const b = await seen(INTER).boundingBox()
	check("desktop: the log is a popover beside its button, below it or above when there is no room", p && b && Math.abs(p.x - b.x) < 3 && (p.y >= b.y + b.height || p.y + p.height <= b.y), JSON.stringify({ p, b }))
} else {
	const p = await panel().boundingBox()
	check("phone: the log is a sheet across the bottom of the screen", p && p.width > 330 && p.y > 200, JSON.stringify(p))
}
await shot("watch-log-3-log")
if (!phone) {
	await seen(INTER).click()
	await settle(300)
	check("pressing Seen again closes the log and removes no watch", (await panel().count()) === 0 && (await state()).logs[INTER].length === 3)
	await seen(INTER).click()
	await panel().waitFor()
	await settle()
}

// --- Watched it again ---
const add = async (option, day) => {
	await panel().locator("[data-add]").click()
	await panel().locator(`[data-option="${option}"]`).click()
	if (option === "day") {
		await panel().locator('input[type="date"]').fill(day)
		await panel().getByRole("button", { name: "Save" }).click()
	}
	await settle(700)
}
await panel().locator("[data-add]").click()
check("Watched it again offers now, yesterday, another day and don't know when", (await panel().locator("[data-date-choice] [data-option]").allInnerTexts()).join("|") === "Just now|Yesterday|Another day|Don't know when")
await panel().locator('[data-option="now"]').click()
await settle(700)
check("Watched it again, now: a fourth watch with a time, on top", (await state()).logs[INTER].length === 4 && /^Today ?\d\d:\d\d$/.test((await rowTexts())[0]), JSON.stringify(await rowTexts()))
check("the count on Seen follows", /4×/.test(await seen(INTER).innerText()))
await add("yesterday")
check("Watched it again, yesterday", (await rowTexts())[1] === "Yesterday", JSON.stringify(await rowTexts()))
await panel().locator("[data-add]").click()
await panel().locator('[data-option="day"]').click()
check("Another day is the browser's own date field, which stops at today", (await panel().locator('input[type="date"]').getAttribute("max"))?.length === 10)
await shot("watch-log-4-another-day")
await panel().locator('input[type="date"]').fill("2024-05-01")
await panel().getByRole("button", { name: "Save" }).click()
await settle(700)
check("Watched it again, another day: 1 May 2024 in its place", (await rowTexts()).includes("1 May 2024") && (await state()).logs[INTER].some((w) => w.at === Date.UTC(2024, 4, 1) && w.precision === "day"), JSON.stringify(await rowTexts()))
await add("unknown")
texts = await rowTexts()
check("Watched it again, don't know when: undated, below the dated ones", (await state()).logs[INTER].length === 7 && texts[5] === "Date unknown" && texts[4] === "12 Mar 2019 Imported from Letterboxd", JSON.stringify(texts))
check("seven watches on Seen", /7×/.test(await seen(INTER).innerText()))

// --- Edit ---
await rows().nth(1).locator("[data-edit]").click()
await rows().nth(1).locator('[data-option="unknown"]').click()
await settle(700)
texts = await rowTexts()
check("editing a date to don't know when moves the watch below the dated ones", texts.filter((t) => t.startsWith("Date unknown")).length === 3 && !texts.includes("Yesterday"), JSON.stringify(texts))
await rows().nth(0).locator("[data-edit]").click()
check("editing a watch with a time offers no time", (await rows().nth(0).locator("[data-option]").allInnerTexts()).join("|") === "Today|Yesterday|Another day|Don't know when")
await rows().nth(0).locator('[data-option="day"]').click()
await rows().nth(0).locator('input[type="date"]').fill("2025-12-24")
await rows().nth(0).getByRole("button", { name: "Save" }).click()
await settle(700)
texts = await rowTexts()
check("editing a date to a day: the day, and no time any more", texts.includes("24 Dec 2025") && !texts.some((t) => /^Today/.test(t)), JSON.stringify(texts))
const imported = rows().filter({ hasText: "Imported from Letterboxd" })
await imported.locator("[data-edit]").click()
check("an edited import keeps its second line, and its editor shows the day it has", (await imported.innerText()).includes("12 Mar 2019") && (await imported.locator('[data-option="day"]').getAttribute("class")).includes("bg-green-500"))
await imported.locator("[data-edit]").click()

// --- Delete and Undo ---
const idsBefore = await logIds(INTER)
const victim = (await state()).logs[INTER].find((w) => w.at === Date.UTC(2019, 2, 12))
await imported.locator("[data-delete]").click()
await toast().waitFor()
check("deleting a watch asks nothing and removes it at once", (await rows().count()) === 6 && !(await logIds(INTER)).includes(victim.id) && dialogs.length === 0)
check("the toast says which watch and offers Undo", /Removed the watch on 12 Mar 2019/.test(await toast().innerText()) && (await toast().getByRole("button").allInnerTexts()).join("|") === "Undo", await toast().innerText())
await shot("watch-log-5-delete-undo")
await toast().getByRole("button", { name: "Undo" }).click()
await settle(800)
const restored = (await state()).logs[INTER].find((w) => w.id === victim.id)
check("Undo re-inserts the same row with the same id", JSON.stringify(Object.entries(restored ?? {}).sort()) === JSON.stringify(Object.entries(victim).sort()) && (await logIds(INTER)).length === idsBefore.length, JSON.stringify({ restored, victim }))
check("the log is still open after Undo, with the import's second line back", (await rowTexts()).includes("12 Mar 2019 Imported from Letterboxd"), JSON.stringify(await rowTexts()))

// --- An error ---
await page.locator("[data-fail-next]").evaluate((el) => el.click())
await rows().nth(0).locator("[data-delete]").click()
await page.locator(".Toastify__toast").first().waitFor({ timeout: 8000 })
check("a failed write puts the log back and says so", (await rows().count()) === 7 && /Couldn't save that/.test(await page.locator(".Toastify__toast").first().innerText()) && /7×/.test(await seen(INTER).innerText()))


// --- Remove all ---
const allIds = JSON.stringify((await logIds(INTER)).sort())
check("Remove all is a link at the foot that names the count", (await panel().locator("[data-remove-all]").innerText()).trim() === "Remove all 7 watches")
await panel().locator("[data-remove-all]").click()
check("Remove all asks once, in place, and has removed nothing yet", (await panel().locator("[data-confirm]").count()) === 1 && (await state()).logs[INTER].length === 7 && dialogs.length === 0)
await shot("watch-log-6-remove-all")
await panel().getByRole("button", { name: "Keep them" }).click()
check("Keep them leaves every watch", (await state()).logs[INTER].length === 7 && (await panel().locator("[data-confirm]").count()) === 0)
await panel().locator("[data-remove-all]").click()
await panel().getByRole("button", { name: "Remove 7 watches" }).click()
await toast().waitFor()
await settle(600)
check("Remove all: no watch left and the movie is no longer Seen", !(await state()).logs[INTER] && (await seen(INTER).innerText()).trim() === "Mark as Seen" && /Removed 7 watches of Interstellar/.test(await toast().innerText()))
await toast().getByRole("button", { name: "Undo" }).click()
await settle(900)
check("Undo of Remove all brings every watch back under its id", JSON.stringify((await logIds(INTER)).sort()) === allIds && (await state()).logs[INTER].length === 7 && /7×/.test(await seen(INTER).innerText()))
await closePanel()

// --- A rated movie whose only watch is the score's ---
await seen(PULP).scrollIntoViewIfNeeded()
await seen(PULP).click()
await panel().waitFor()
await panel().locator("[data-watch]").first().waitFor()
check("scored only: the log says Scored, no watch logged, with nothing to edit or delete", /Scored, no watch logged/.test(await panel().innerText()) && (await panel().locator("[data-edit], [data-delete], [data-remove-all]").count()) === 0)
await panel().locator("[data-add]").click()
check("scored only: I watched it offers now, another day and don't know when", (await panel().locator("[data-add]").count()) === 0 && (await panel().locator("[data-option]").allInnerTexts()).join("|") === "Just now|Another day|Don't know when")
await shot("watch-log-7-scored")
await panel().locator('[data-option="unknown"]').click()
await settle(800)
s = await state()
check("scored only: I watched it turns it into the member's own watch", s.logs[PULP].length === 1 && s.logs[PULP][0].origin === "single" && (await rowTexts())[0] === "Date unknown", JSON.stringify(s.logs[PULP]))
await closePanel()
// The score is the hero's rectangle; Clear score is in its picker.
await hero(PULP).locator("[data-own-score]").click()
await page.locator("[data-score-dialog]").getByText("Clear score").click()
await page.locator("[data-score-dialog-close]").click()
await settle(900)
check("clearing the score at the score control leaves the member's watch: still Seen", (await state()).logs[PULP]?.length === 1 && (await seen(PULP).getAttribute("aria-pressed")) === "true")

// --- A first watch takes a movie off Not interested, and Undo puts it back ---
await seen(MATRIX).scrollIntoViewIfNeeded()
await seen(MATRIX).click()
await toast().waitFor()
await settle(300)
check("one tap on a Not interested movie clears Not interested", !(`movie-${MATRIX}` in (await state()).notInterested))
await toast().getByRole("button", { name: "Undo" }).click()
await settle(800)
check("and Undo puts Not interested back", `movie-${MATRIX}` in (await state()).notInterested && !(await state()).logs[MATRIX])

// --- A show keeps today's toggle ---
const showBefore = (await requests()).length
await seen(SHOW).scrollIntoViewIfNeeded()
await seen(SHOW).click()
await settle(900)
check("a show: Seen is the toggle, sent to the old endpoint", (await requests()).some((r) => r.includes("/api/update-watch-history") && r.includes('"media_type":"show","action":"add"')) && (await seen(SHOW).getAttribute("aria-pressed")) === "true")
await seen(SHOW).click()
await settle(900)
check("a show: pressing again takes it back, and no log opens", (await requests()).some((r) => r.includes('"media_type":"show","action":"remove"')) && (await seen(SHOW).getAttribute("aria-pressed")) === "false" && !(await panel().isVisible().catch(() => false)))
check("a show's button has no count and no arrow", (await seen(SHOW).locator("svg").count()) === 1)

// --- Before the server answers, and the keyboard ---
await reset()
await page.locator("[data-slow]").evaluate((el) => el.click())
await seen(DUNE).scrollIntoViewIfNeeded()
await seen(DUNE).click()
await settle(250)
check("before the answer: Seen is on at once and the Wishlist mark is off", (await seen(DUNE).getAttribute("aria-pressed")) === "true" && (await want(DUNE).getAttribute("aria-pressed")) === "false" && !(await state()).logs[DUNE])
await toast().waitFor({ timeout: 8000 })
check("the toast comes with the answer", (await state()).logs[DUNE]?.length === 1)
await seen(INTER).scrollIntoViewIfNeeded()
await seen(INTER).focus()
await page.keyboard.press("Enter")
await panel().waitFor()
await rows().first().waitFor({ timeout: 8000 })
if (!phone) check("keyboard: Enter on Seen opens the log and moves the focus into it", await panel().evaluate((el) => el === document.activeElement || el.contains(document.activeElement)))
await rows().nth(2).locator("[data-delete]").click()
await settle(250)
check("before the answer: a deleted watch is gone at once and the count follows", (await rows().count()) === 2 && /2×/.test(await seen(INTER).innerText()) && (await state()).logs[INTER].length === 3, JSON.stringify([await rows().count(), await seen(INTER).innerText(), (await state()).logs[INTER].length]))
await toast().filter({ hasText: "Removed the watch" }).waitFor({ timeout: 8000 })
check("and the server has it deleted when the toast shows", (await state()).logs[INTER].length === 2)
await page.locator("[data-slow]").evaluate((el) => el.click())
if (!phone) {
	await page.keyboard.press("Escape")
	await settle(300)
	check("keyboard: Escape closes the log and returns the focus to Seen", (await panel().count()) === 0 && (await seen(INTER).evaluate((el) => el === document.activeElement)))
} else await closePanel()

// --- Poster cards ---
await reset()
const card =(id) => page.locator(`div.group:has([data-card="${id}"])`)
if (!phone) {
	await card(INTER).scrollIntoViewIfNeeded()
	await card(INTER).hover()
	const eye = (id) => card(id).getByRole("button", { name: /Seen/ })
	await eye(INTER).waitFor({ timeout: 15000 })
	check("card: the eye shows the count from two watches on", (await eye(INTER).innerText()).trim() === "3×", await eye(INTER).innerText())
	await card(DUNE).hover()
	await eye(DUNE).click()
	await toast().waitFor()
	check("card: one tap records a watch for now, with Change date in the toast", (await state()).logs[DUNE]?.length === 1 && (await toast().getByRole("button").allInnerTexts()).join("|") === "Change date|Undo")
	await shot("watch-log-8-card-one-tap")
	await toast().getByRole("button", { name: "Change date" }).click()
	await panel().waitFor()
	await panel().locator('[data-option="unknown"]').click()
	await settle(700)
	check("card: Change date opens the log popover and sets the date", (await state()).logs[DUNE][0].precision === "unknown" && (await rowTexts())[0] === "Date unknown")
	await closePanel()
	await card(INTER).hover()
	await eye(INTER).click()
	await panel().waitFor()
	await rows().first().waitFor()
	await settle()
	check("card: the eye of a Seen movie opens the log in a popover and removes nothing", (await rows().count()) === 3 && (await state()).logs[INTER].length === 3)
	const p = await panel().boundingBox()
	check("card: the popover is on screen", p && p.x >= 0 && p.x + p.width <= 1280, JSON.stringify(p))
	await shot("watch-log-9-card-log")
	await page.keyboard.press("Escape")
	await settle(300)
	check("Escape closes the popover", (await panel().count()) === 0)
} else {
	await card(INTER).scrollIntoViewIfNeeded()
	await page.getByRole("button", { name: "Actions for Interstellar" }).tap()
	const sheet = page.locator("div.fixed.inset-0:not(.invisible)").filter({ hasText: "Not interested" })
	await sheet.getByRole("button", { name: /Seen/ }).waitFor({ timeout: 15000 })
	await settle(500)
	check("card sheet: Seen shows the count", /3×/.test(await sheet.getByRole("button", { name: /Seen/ }).innerText()))
	await shot("watch-log-8-card-sheet")
	await sheet.getByRole("button", { name: /Seen/ }).tap()
	await panel().waitFor()
	await rows().first().waitFor()
	await settle(700)
	check("card sheet: Seen on a Seen movie opens the log sheet in its place", (await rows().count()) === 3 && (await page.getByRole("button", { name: "Not interested" }).filter({ visible: true }).count()) <= 6)
	await shot("watch-log-9-card-log")
	await closePanel()
	await card(DUNE).scrollIntoViewIfNeeded()
	await page.getByRole("button", { name: "Actions for Dune: Part Two" }).tap()
	const dune = page.locator("div.fixed.inset-0:not(.invisible)").filter({ hasText: "Not interested" })
	await dune.getByRole("button", { name: /Seen/ }).waitFor()
	await settle(500)
	await dune.getByRole("button", { name: /Seen/ }).tap()
	await toast().waitFor()
	check("card sheet: one tap records a watch for now, with Change date in the toast", (await state()).logs[DUNE]?.length === 1 && (await toast().getByRole("button").allInnerTexts()).join("|") === "Change date|Undo")
	await shot("watch-log-8-card-one-tap")
	await page.mouse.click(195, 160)
	await settle(500)
}

// --- Watch next: I watched it ---
await reset()
await page.locator("[data-finish]").scrollIntoViewIfNeeded()
await page.locator("[data-finish]").click()
const line = page.locator("[data-watched-line]")
await line.waitFor({ timeout: 15000 })
check("Watch next: the dialog shows the date as one line with Change", /^Watched today, \d\d:\d\d\. Change$/.test((await line.innerText()).trim()), await line.innerText())
await shot("watch-log-10-watch-next")
await line.getByRole("button", { name: "Change" }).click()
check("Watch next: Change opens the date choice in place", (await line.locator("[data-option]").allInnerTexts()).join("|") === "Yesterday|Another day|Don't know when")
await line.locator('[data-option="yesterday"]').click()
await settle(800)
s = await state()
check("Watch next: the watch is yesterday", s.logs[NEXT]?.[0].precision === "day" && /^Watched yesterday\. Change$/.test((await line.innerText()).trim()), await line.innerText())
await shot("watch-log-11-watch-next-changed")
await page.getByRole("button", { name: "Rate later" }).click()
await settle(500)

// --- A guest ---
await open(portOn, "?guest=1")
await seen(DUNE).click()
await settle(1500)
check("a guest gets the sign-in prompt and nothing is sent", (await page.getByText(/sign in|sign up|create/i).count()) > 0 && !(await requests()).some((r) => r.includes("watch-log") || r.includes("watch-history")), (await requests()).join("|"))
await shot("watch-log-12-guest")

// ------------------------------------------------------------------------------------------------------------
// Flag off: as on main
// ------------------------------------------------------------------------------------------------------------
requested.length = 0
await open(portOff)
check("flag off: the flag is off for this server", (await page.getAttribute("[data-flag]", "data-flag")) === "off")
check("flag off: no count and no arrow on Seen", (await seen(INTER).innerText()).trim() === "Seen" && (await seen(INTER).locator("svg").count()) === 1 && (await seen(INTER).getAttribute("aria-haspopup")) === null)
if (!phone) await seen(DUNE).hover()
await seen(DUNE).click()
await settle(1200)
check("flag off: one tap marks Seen through the old endpoint, without a toast", (await requests()).some((r) => r.includes("/api/update-watch-history") && r.includes('"action":"add"')) && (await page.locator("[data-toast]").count()) === 0 && (await seen(DUNE).getAttribute("aria-pressed")) === "true")
await seen(DUNE).click()
await settle(1200)
check("flag off: pressing again removes it", (await requests()).some((r) => r.includes('"action":"remove"')) && !(await state()).logs[DUNE] && (await seen(DUNE).getAttribute("aria-pressed")) === "false")
await seen(PARASITE).click()
await settle(1200)
check("flag off: pressing Seen on a Seen movie takes it back and opens no log", !(await state()).logs[PARASITE] && (await page.locator("[data-watch-log-popover], [data-watch-log-sheet]").count()) === 0)
check("flag off: the log's code is never requested", !requested.some((u) => /WatchLogSurface|ui\/watch-log\/WatchLog\.tsx|DateChoice|WatchedLine|useWatchLog/.test(u)), requested.filter((u) => /watch-log/.test(u)).join(" "))
await shot("watch-log-13-flag-off")

console.log(`\n${mode}: ${passed} passed, ${failed.length} failed`)
for (const f of failed) console.log(`  FAILED ${f}`)
await browser.close()
process.exit(failed.length ? 1 : 0)
