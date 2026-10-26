// Real episode tracking components at phone and desktop widths. See README.md for isolated local setup.
// HARNESS=http://127.0.0.1:3084 SHOTS=./shots node drive.mjs [phone,desktop]
import { mkdirSync } from "node:fs"
import { SHOTS, checker, launch, open, settle, stored } from "./lib.mjs"

mkdirSync(SHOTS, { recursive: true })
const browser = await launch()
const { check, results } = checker()
const sizes = (process.argv[2] ?? "phone,desktop").split(",")
const T = "today=2026-10-08&latency=60"
const text = (page, selector) => page.locator(selector).innerText()
const count = (page, selector) => page.locator(selector).count()
const status = (page, name) => page.getByRole("button", { name: `Status: ${name}. Change it`, exact: true })
const want = (page) => page.locator("[data-hero]").getByRole("button", { name: /^(Want to See|Rewatch)$/i })
const score = (page) => page.locator("[data-hero] [data-own-score]")
const toast = (page) => text(page, "[data-tracking-toast]")
const toastAction = async (page, name) => {
	await page.locator("[data-tracking-toast]").getByRole("button", { name, exact: true }).click()
	await settle(page)
}
const toList = async (page) => {
	// The harness mounts the lazy section below the hero. Use its public anchor, not its wrapper's CSS.
	await page.locator("#episode-ratings").scrollIntoViewIfNeeded()
	await page.locator("[data-episode-list]").waitFor()
	await settle(page, 300)
}
const season = async (page, number) => {
	await page.locator(`[data-season-press="${number}"]`).click()
	await settle(page, 300)
}
const menuPick = async (page, id) => {
	await page.locator("[data-status-pill]").click()
	await page.locator(`[data-status-action="${id}"]`).click()
	await settle(page)
}
const menuIds = async (page) => {
	await page.locator("[data-status-pill]").click()
	const ids = await page.locator("[data-status-action]").evaluateAll((els) => els.map((el) => el.dataset.statusAction))
	await page.keyboard.press("Escape")
	return ids
}
const seen = async (page) => {
	await page.getByRole("button", { name: "Not started. Set the status", exact: true }).click()
	await page.locator('[data-how-far-answer="seen"]').click()
	await settle(page)
}
const rate = async (page) => {
	await score(page).click()
	await page.locator("[data-score-dialog]").getByRole("button", { name: /^Good/ }).click()
	await settle(page)
}
const exactly = async (page) => {
	const s = await stored(page)
	return JSON.stringify([s.state, [...s.log].sort((a, b) => a.watch_id.localeCompare(b.watch_id))])
}
const posts = (page) => page.evaluate(() => window.__gwHarness.requests.filter((r) => r.path === "/api/tracking/show" && r.method === "POST"))
const noOverlap = async (page) => (await posts(page)).every((p, i, all) => i === 0 || (all[i - 1].endedAt !== null && p.startedAt >= all[i - 1].endedAt))
const noOverflow = (page) => page.evaluate(() => document.scrollingElement.scrollWidth <= window.innerWidth + 1)
const progress = (page) => page.locator("[data-tracking-box]").getAttribute("title").then(async (title) => title ?? await page.locator("[data-progress]").getAttribute("title"))
const available = (page, selector) => page.locator(`${selector}:not([disabled])`).count()
const gridCount = (page, suffix) => count(page, `[data-morph-cell]${suffix}`)
let completed = 0

try {
	for (const size of sizes) {
		const C = (name, ok, detail = "") => check(`[${size}] ${name}`, ok, detail)
		const run = async (name, show, scenario, body, extra = "") => {
			if (process.env.SCENARIO && !name.includes(process.env.SCENARIO)) return
			console.log(`[${size}] ${name}`)
			let context
			try {
				const opened = await open(browser, size, `show=${show}&scenario=${scenario}&${T}&${extra}`)
				context = opened.context
				await opened.page.locator("[data-hero] [data-own-score]").waitFor()
				await body(opened.page)
				C(`${name}: no page errors`, opened.errors.length === 0, opened.errors.join(" | "))
				C(`${name}: no unexpected API writes`, opened.external.length === 0, opened.external.join(" | "))
				C(`${name}: requests serialized`, await noOverlap(opened.page))
				C(`${name}: no horizontal overflow`, await noOverflow(opened.page))
				completed++
			} catch (error) {
				C(`${name}: completed`, false, error.stack)
			} finally {
				await context?.close()
			}
		}

		await run("watching hero", "supernatural", "watching", async (page) => {
			C("hero: split status and score", await status(page, "Watching").count() === 1 && await score(page).count() === 1)
			C("hero: score offers the current partway wording", /Rate it so far/.test(await score(page).innerText()))
			C("hero: progress and next", /26 of 327/.test(await progress(page)) && /S2 E5 · Simon Said/.test(await page.locator("[data-next-episode]").getAttribute("title")))
			C("hero: started show has no Wishlist action", await want(page).count() === 0)
			const before = await exactly(page)
			const sent = (await posts(page)).length
			const link = page.getByRole("link", { name: "Next episode: S2 E5, Simon Said. Go to it in the episode list", exact: true })
			await link.focus()
			await page.keyboard.press("Enter")
			await page.locator("[data-episode][data-selected]").waitFor()
			await settle(page, 900)
			C("hero: Enter opens Next without recording a watch", await exactly(page) === before && (await posts(page)).length === sent && /Simon Said/.test(await text(page, "[data-episode][data-selected]")))
			C("hero: Next is visible and unticked", await page.locator("[data-episode][data-selected]").evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight }) && await page.locator("[data-episode][data-selected] [data-tick]").getAttribute("aria-checked") === "false")
			await rate(page)
			C("hero: rating preserves watches and does not ask How far", (await stored(page)).log.length === 27 && await count(page, "[data-how-far]") === 0 && await score(page).getAttribute("data-own-score") !== "none")
			const ids = await menuIds(page)
			C("Watching menu: mark all, hold, not started, drop", ids.join(",") === "markAll,hold,notStarted,drop", ids.join(","))
			await menuPick(page, "hold")
			C("hold: status saved, Next kept", (await stored(page)).state.state === "on_hold" && await status(page, "On hold").count() === 1 && await count(page, "[data-next-episode]") === 1)
			await menuPick(page, "resume")
			await menuPick(page, "drop")
			C("drop: saved and Next gone", (await stored(page)).state.state === "dropped" && await count(page, "[data-next-episode]") === 0 && /dropped and hidden/.test(await toast(page)))
			await toastAction(page, "Undo")
			C("drop Undo: Watching restored", (await stored(page)).state.state === "watching")
			await menuPick(page, "markAll")
			const s = await stored(page)
			C("mark all: preserves previous watches, adds 301 undated", s.state.state === "seen" && s.state.seen_press_from === "watching" && s.log.filter((r) => r.origin === "seen" && r.watched_at === null).length === 301)
		})

		await run("Seen and rewatch", "chernobyl", "wanted", async (page) => {
			C("fresh: Not started and wanted", await page.getByRole("button", { name: "Not started. Set the status", exact: true }).count() === 1 && await want(page).getAttribute("aria-pressed") === "true")
			await seen(page)
			let s = await stored(page)
			C("Seen: five undated watches, Wishlist cleared", s.state.state === "seen" && s.state.seen_press_from === "not_started" && s.log.length === 5 && s.log.every((r) => r.origin === "seen" && r.watched_at === null) && s.wantToSee === false)
			C("Seen: status half and score invitation", await status(page, "Seen").count() === 1 && /How was it\?/.test(await score(page).innerText()) && /Rewatch/.test(await want(page).innerText()))
			await toastAction(page, "Set a date")
			await page.getByRole("dialog").locator('input[type="date"]').fill("2026-10-01")
			await page.getByRole("dialog").getByRole("button", { name: "Set date", exact: true }).click()
			await settle(page)
			s = await stored(page)
			C("Seen date: all five watches dated", s.log.every((r) => r.watched_at_precision === "day" && new Date(r.watched_at).toISOString().startsWith("2026-10-01")))
			await want(page).click()
			await settle(page)
			C("Want to rewatch: keeps Seen and every watch", (await stored(page)).wantToSee && (await stored(page)).log.length === 5 && (await stored(page)).state.state === "seen")
			await menuPick(page, "watchAgain")
			C("Watch again: asks first, Cancel focused", await count(page, '[data-confirm="watchAgain"]') === 1 && await page.locator("[data-confirm-cancel]").evaluate((el) => el === document.activeElement))
			await page.locator('[data-confirm="watchAgain"] [data-confirm-yes]').click()
			await settle(page)
			s = await stored(page)
			C("Watch again: pass two, history kept, Wishlist cleared", s.state.state === "watching" && s.state.pass === 2 && s.log.length === 5 && !s.wantToSee)
			await toList(page)
			C("Watch again: new pass has empty ticks", await count(page, "[data-episode][data-watched]") === 0)
			await page.getByRole("checkbox", { name: /^Watched: S1 E1,/ }).click()
			await settle(page)
			await page.locator("[data-episode] [data-row]").first().click()
			C("Watch again: both passes in episode history", await count(page, '[data-logged-watch="1"]') === 1 && await count(page, '[data-logged-watch="2"]') === 1)
		})

		for (const answer of ["seen", "watching", "just_rating"]) {
			await run(`How far ${answer}`, "chernobyl", "fresh", async (page) => {
				C(`${answer}: no question before score`, await count(page, "[data-how-far]") === 0)
				await rate(page)
				await page.locator("[data-how-far]").waitFor()
				C(`${answer}: score saved before question`, (await stored(page)).state.seen_question === "open" && /How far are you\?/.test(await text(page, "[data-how-far]")))
				await page.locator(`[data-how-far-answer="${answer}"]`).click()
				if (answer === "watching") {
					C("Watching: nothing marked until an episode confirmed", (await stored(page)).log.length === 0 && await page.locator("[data-pick-confirm]").isDisabled())
					await page.locator("[data-episode-picker]").getByRole("button", { name: "S1 E3", exact: true }).click()
					await page.locator("[data-pick-confirm]").click()
				}
				await settle(page, 900)
				const s = await stored(page)
				C(`${answer}: question settled and dialog closed`, s.state.seen_question === "answered" && await count(page, "[data-score-dialog]") === 0)
				if (answer === "seen") C("How far Seen: five watches", s.state.state === "seen" && s.log.length === 5)
				if (answer === "watching") C("How far Watching: through E3 in one undated group", s.state.state === "watching" && s.log.length === 3 && s.log.every((r) => r.origin === "upto" && r.watched_at === null) && new Set(s.log.map((r) => r.group_id)).size === 1)
				if (answer === "just_rating") C("Only the score: Not started, no watches", s.state.state === "not_started" && s.log.length === 0)
			})
		}

		await run("ratings grid", "supernatural", "fresh", async (page) => {
			await toList(page)
			C("grid: one navigator, 15 seasons and specials", await page.locator("[data-episode-list]").getAttribute("data-episode-list") === "grid" && await count(page, "[data-season-row]") === 16)
			C("grid: numbered scores, no watches or Next", await gridCount(page, "") === 327 && await gridCount(page, "[data-watched]") === 0 && await gridCount(page, "[data-next]") === 0 && /^\d\.\d$/.test(await page.locator("[data-morph-cell]").first().innerText()))
			const toggle = page.getByRole("radiogroup", { name: "Show the episodes as", exact: true })
			C("grid: accessible switch defaults to Grid", await toggle.getByRole("radio", { name: "Grid", exact: true }).getAttribute("aria-checked") === "true")
			await toggle.getByRole("radio", { name: "Consistency", exact: true }).click()
			await settle(page, 700)
			C("Consistency: morph retains all episodes", await page.locator("[data-morph]").getAttribute("data-morph") === "chart" && await gridCount(page, "") === 327 && await noOverflow(page))
			await toggle.getByRole("radio", { name: "Grid", exact: true }).click()
			await settle(page, 700)
			C("Grid: morph returns", await page.locator("[data-morph]").getAttribute("data-morph") === "grid")
			await season(page, 1)
			C("season: opens inline with other seasons kept", await count(page, '[data-season-panel="1"]') === 1 && await count(page, "[data-season-row]") === 16)
			await page.locator("[data-season-score]").click()
			C("season: site scores open", await page.locator('[data-float-id="season-1"][aria-hidden="true"]').count() === 1)
			await page.keyboard.press("Escape")
			await page.getByRole("checkbox", { name: "Watched: S1 E1, Pilot", exact: true }).click()
			await settle(page)
			C("first tick: Watching, watched bar and Next ring", (await stored(page)).state.state === "watching" && await gridCount(page, "[data-watched]") === 1 && await gridCount(page, "[data-next]") === 1)
			await page.getByRole("checkbox", { name: "Watched: S1 E1, Pilot", exact: true }).click()
			await settle(page)
			C("last untick: Not started again", (await stored(page)).state === null && (await stored(page)).log.length === 0)
			await toastAction(page, "Undo")
			C("untick Undo: restores Watching", (await stored(page)).state.state === "watching" && (await stored(page)).log.length === 1)
			// A tile navigates to its episode instead of recording a watch.
			const before = await exactly(page)
			const tile = page.locator('[data-season-row="9"] [data-morph-cell]').first()
			const label = await tile.getAttribute("aria-label")
			await tile.click()
			await settle(page, 900)
			C("tile: opens season and selects its episode without writes", await count(page, '[data-season-panel="9"]') === 1 && await count(page, "[data-episode][data-selected]") === 1 && await exactly(page) === before, label)
			await page.screenshot({ path: `${SHOTS}/grid-${size}.jpg`, type: "jpeg", quality: 60 })
		})

		await run("episode rows", "supernatural", "watching", async (page) => {
			await toList(page)
			C("grid: current watches and Next", await gridCount(page, "[data-watched]") === 26 && await gridCount(page, "[data-next]") === 1)
			await page.locator("[data-jump-next]").click()
			await settle(page, 900)
			C("Next: Simon Said selected", /Simon Said/.test(await text(page, "[data-episode][data-selected]")))
			C("rows: folded page window, no inner scrollbar", await count(page, '[data-season-panel="2"] [data-episode]') === 8 && await count(page, '[data-fold="earlier"]') === 1 && await count(page, '[data-fold="later"]') === 1 && await page.locator("[data-episode-list]").evaluate((el) => ![...el.querySelectorAll("*")].some((e) => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight + 1)))
			await page.locator('[data-fold="later"]').click()
			C("fold: expands more episode rows", await count(page, '[data-season-panel="2"] [data-episode]') > 8)
			const row = page.locator("[data-episode]", { has: page.getByRole("button", { name: /Crossroad Blues/ }) })
			await row.locator("[data-row]").click()
			C("unwatched episode: still covered", await row.locator("[data-detail] img").count() === 0 && await row.locator("[data-cover='image']").count() === 1)
			await row.locator("[data-cover='image']").click()
			await row.locator("[data-cover='text']").click()
			C("episode: still and description uncovered", await row.locator("[data-detail] img").count() === 1 && await row.locator("[data-overview]").count() === 1)
			await row.locator("[data-watch-day]").fill("2026-10-02")
			await settle(page)
			let watch = (await stored(page)).log.find((r) => r.season_number === 2 && r.episode_number === 8)
			C("episode date: stored day", watch?.watched_at_precision === "day" && new Date(watch.watched_at).toISOString().startsWith("2026-10-02"))
			await row.locator("[data-watch-unknown]").click()
			await settle(page)
			watch = (await stored(page)).log.find((r) => r.season_number === 2 && r.episode_number === 8)
			C("Don't know: clears date", watch?.watched_at === null && watch.watched_at_precision === "unknown")
			await row.locator("[data-remove-watch]").click()
			await settle(page)
			await row.locator("[data-row]").click()
			await row.locator("[data-up-to-here]").click()
			await settle(page)
			const group = (await stored(page)).log.filter((r) => r.origin === "upto")
			C("up to here: gap filled in one undated group", group.length === 4 && new Set(group.map((r) => r.group_id)).size === 1 && group.every((r) => r.watched_at === null))
			const beforeSpecial = await progress(page)
			await season(page, 0)
			await page.locator('[data-season-panel="0"] [data-tick][aria-checked="false"]:not([disabled])').first().click()
			await settle(page)
			C("special: watch saved without changing regular progress", await progress(page) !== null && (await progress(page)).split(" · ")[0] === beforeSpecial.split(" · ")[0] && (await stored(page)).log.filter((r) => r.season_number === 0).length === 2)
		}, "overviews=1")

		await run("season actions and failures", "supernatural", "watching", async (page) => {
			await toList(page)
			await season(page, 5)
			const before = await exactly(page)
			await page.locator("[data-mark-season]").click()
			await settle(page)
			const watches = (await stored(page)).log.filter((r) => r.season_number === 5)
			C("mark season: 22 undated watches in one group", watches.length === 22 && new Set(watches.map((r) => r.group_id)).size === 1 && watches.every((r) => r.watched_at === null))
			await toastAction(page, "Undo")
			C("mark season Undo: exact restoration", await exactly(page) === before)
			C("empty season: Unmark unavailable", await available(page, "[data-unmark-season]") === 0)
			await season(page, 2)
			const marked = await exactly(page)
			const sent = (await posts(page)).length
			await page.locator("[data-unmark-season]").click()
			await settle(page)
			C("unmark season: four watches removed in one request", (await stored(page)).log.filter((r) => r.season_number === 2).length === 0 && (await stored(page)).log.length === 23 && (await posts(page)).length === sent + 1 && await available(page, "[data-unmark-season]") === 0)
			await toastAction(page, "Undo")
			C("unmark Undo: exact state and watches restored", await exactly(page) === marked)
			await season(page, 3)
			const ticks = page.locator('[data-season-panel="3"] [data-tick]')
			const from = (await stored(page)).log.length
			for (let i = 0; i < 3; i++) await ticks.nth(i).click()
			await settle(page, 900)
			C("quick ticks: saved serially", (await stored(page)).log.length === from + 3 && await noOverlap(page))
			await page.evaluate(() => { window.__gwHarness.failNext = 500; window.__gwHarness.options.latency = 700 })
			await ticks.nth(3).evaluate((el) => el.click())
			await ticks.nth(4).evaluate((el) => el.click())
			C("failed batch: optimistically ticked", await count(page, '[data-season-panel="3"] [data-episode][data-watched]') === 5)
			await settle(page, 1600)
			C("failed batch: both rolled back, error shown", (await stored(page)).log.length === from + 3 && await count(page, '[data-season-panel="3"] [data-episode][data-watched]') === 3 && await count(page, '[data-tracking-toast="error"]') === 1)
			await ticks.nth(3).click()
			await settle(page, 1000)
			C("failed batch: later tick succeeds", (await stored(page)).log.length === from + 4)
		})

		await run("Seen undo and take back", "chernobyl", "wanted", async (page) => {
			await seen(page)
			await toastAction(page, "Undo")
			await settle(page, 300)
			let s = await stored(page)
			C("Seen Undo: original Wishlist timestamp and no watches", s.state === null && s.log.length === 0 && s.wantToSee && s.wishlistAt.startsWith("2026-09-08"))
			await seen(page)
			const before = await exactly(page)
			await menuPick(page, "takeBack")
			C("take back: asks without changing data; Cancel focused", await exactly(page) === before && await page.locator("[data-confirm-cancel]").evaluate((el) => el === document.activeElement))
			await page.getByRole("button", { name: "Cancel", exact: true }).click()
			C("take back Cancel: no changes", await exactly(page) === before)
			await menuPick(page, "takeBack")
			await page.keyboard.press("Escape")
			C("take back Escape: no changes, focus returned", await count(page, "[data-confirm]") === 0 && await exactly(page) === before && await page.locator("[data-status-pill]").evaluate((el) => el === document.activeElement))
			await menuPick(page, "takeBack")
			await page.locator('[data-confirm="takeBack"] [data-confirm-yes]').click()
			await settle(page)
			s = await stored(page)
			C("take back: watches and state removed", s.state === null && s.log.length === 0)
			await toastAction(page, "Undo")
			C("take back Undo: exact restoration", await exactly(page) === before)
		})

		await run("old Seen press date and Undo", "sherlock", "seen_old", async (page) => {
			await menuPick(page, "setDate")
			C("old press: date dialog names twelve watches", /these 12 episodes/.test(await page.getByRole("dialog").innerText()))
			await page.getByRole("dialog").locator('input[type="date"]').fill("2024-10-01")
			await page.getByRole("dialog").getByRole("button", { name: "Set date", exact: true }).click()
			await settle(page)
			const dated = await stored(page)
			C("old press: all twelve dated, original group retained", dated.log.length === 12 && dated.log.every((r) => r.group_id === dated.state.seen_press_group && r.watched_at_precision === "day" && new Date(r.watched_at).toISOString().startsWith("2024-10-01")))
			const before = await exactly(page)
			await menuPick(page, "takeBack")
			C("old press: confirmation names original press date and count", /12 episodes marked on 19 Oct 2024/.test(await text(page, '[data-confirm="takeBack"]')))
			await page.locator('[data-confirm="takeBack"] [data-confirm-yes]').click()
			await settle(page)
			C("old press: removed", (await stored(page)).state === null && (await stored(page)).log.length === 0)
			await toastAction(page, "Undo")
			C("old press Undo: exact dates, group and state restored", await exactly(page) === before)
		})

		await run("unmark Seen with other seasons", "slow-horses", "seen_old", async (page) => {
			await toList(page)
			await season(page, 1)
			const before = await exactly(page)
			await page.locator("[data-unmark-season]").click()
			await settle(page)
			const s = await stored(page)
			C("unmark Seen: Watching, press ended, other seasons retained", s.state.state === "watching" && s.state.seen_press_group === null && s.log.length === 18 && s.log.every((r) => r.season_number !== 1))
			await toastAction(page, "Undo")
			C("unmark Seen Undo: exact restoration including press", await exactly(page) === before)
		})

		for (const [scenario, expected] of [["seen_old", null], ["on_hold", "on_hold"], ["dropped", "dropped"], ["watching", null]]) {
			await run(`unmark ${scenario}`, "chernobyl", scenario, async (page) => {
				await toList(page)
				const before = await exactly(page)
				await page.locator("[data-unmark-season]").click()
				await settle(page)
				const s = await stored(page)
				C(`unmark ${scenario}: correct resulting status`, (s.state?.state ?? null) === expected)
				C(`unmark ${scenario}: no watches`, s.log.length === 0)
				await toastAction(page, "Undo")
				C(`unmark ${scenario}: exact Undo`, await exactly(page) === before)
			})
		}

		for (const [pick, expected] of [["hold", "on_hold"], ["drop", "dropped"], ["markNew", "seen"]]) {
			await run(`new episodes ${pick}`, "slow-horses", "seen_old", async (page) => {
				C("new episodes: status and first new episode", await status(page, "10 new episodes").count() === 1 && /S5 E1/.test(await text(page, "[data-next-episode]")))
				await menuPick(page, pick)
				const s = await stored(page)
				C(`${pick}: state and history`, s.state.state === expected && s.log.length === (pick === "markNew" ? 34 : 24) && (pick === "markNew" ? s.state.seen_press_from === "seen" : s.state.seen_press_group === null))
				if (pick !== "markNew") {
					await menuPick(page, "resume")
					C(`${pick}: Resume Watching with history`, (await stored(page)).state.state === "watching" && (await stored(page)).log.length === 24)
				}
			})
		}

		await run("airing", "slow-horses", "watching", async (page) => {
			await toList(page)
			const last = await page.locator("[data-season-press]").evaluateAll((els) => Math.max(...els.map((el) => Number(el.dataset.seasonPress))))
			await season(page, last)
			if (await count(page, '[data-fold="later"]')) await page.locator('[data-fold="later"]').click()
			C("unaired: disabled checkboxes", await count(page, `[data-season-panel="${last}"] [data-tick][disabled]`) > 0)
		})
		await run("limited series", "chernobyl", "fresh", async (page) => {
			await toList(page)
			C("limited: five rows, no grid switch", await count(page, "[data-episode]") === 5 && await count(page, "[data-view-toggle]") === 0)
			for (const tick of await page.getByRole("checkbox").all()) await tick.click()
			await settle(page, 1200)
			const s = await stored(page)
			C("watch through: Seen without a Seen press", s.state.state === "seen" && s.state.seen_press_group === null && s.log.length === 5 && !(await menuIds(page)).includes("takeBack"))
		})
		await run("numbering mismatch", "supernatural", "fresh", async (page) => {
			await toList(page)
			await season(page, 1)
			C("mismatch: explained, missing rating instead of neighbour's", await page.locator('[data-chip="missing"][title="No rating shown: IMDb numbers this season differently"]').count() > 0)
		}, "imdb=differs")
		await run("no episode list", "supernatural", "fresh", async (page) => {
			C("no list: whole-show Seen half available", await count(page, "[data-tracking-hero]") === 0 && await page.locator("[data-seen-half]").count() === 1)
			await page.locator("[data-seen-half]").click()
			await settle(page, 900)
			C("no list: Seen saved", (await stored(page)).state?.state === "seen")
		}, "list=none")
		await run("visitor", "supernatural", "watching", async (page) => {
			await page.locator("#episode-ratings").scrollIntoViewIfNeeded()
			await settle(page, 1200)
			C("visitor: public ratings grid, no tracking or requests", await count(page, "#episode-grid-title") === 1 && await count(page, "[data-episode-list]") === 0 && await count(page, "[data-tracking-hero]") === 0 && (await posts(page)).length === 0)
		}, "guest=1")
	}
} finally {
	await browser.close()
}
if (results.length === 0) throw new Error("No scenarios selected")
const failed = results.filter((r) => !r.ok)
for (const size of sizes) console.log(`${size}: ${results.filter((r) => r.name.startsWith(`[${size}]`)).length} checks`)
console.log(`${completed} scenarios completed; ${results.length - failed.length} of ${results.length} checks passed`)
process.exitCode = failed.length ? 1 : 0
