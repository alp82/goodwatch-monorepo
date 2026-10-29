import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import test from "node:test"

/** Runs the controls in happy-dom at one width and returns what each check saw. */
const runs = new Map<string, Record<string, unknown>>()
const run = (width: "desktop" | "phone") => {
	const seen = runs.get(width)
	if (seen) return seen
	const result = JSON.parse(
		execFileSync(
			"node_modules/.bin/vite-node",
			[
				"--config",
				"app/ui/discover-bar/discover-controls-test-vite.config.ts",
				"app/ui/discover-bar/discover-controls-keyboard.test-support.tsx",
			],
			{
				encoding: "utf8",
				env: { ...process.env, DISCOVER_WIDTH: width },
				stdio: ["ignore", "pipe", "ignore"],
			},
		)
			.split("__DISCOVER_KEYS__")
			.at(-1) ?? "",
	) as Record<string, unknown>
	runs.set(width, result)
	return result
}

type Tab = {
	id: string
	tabIndex: number
	selected: boolean
	panelRole: string | null
	panelLabelledBy: string | null
}
/** A tab list has one tab stop, the selected tab, and every tab controls a tab panel labeled by the selected one. */
const assertTabList = (tabs: Tab[], selected: string) => {
	assert.deepEqual(
		tabs.filter((tab) => tab.tabIndex === 0).map((tab) => tab.id),
		[selected],
	)
	assert.deepEqual(
		tabs.filter((tab) => tab.selected).map((tab) => tab.id),
		[selected],
	)
	for (const tab of tabs) assert.equal(tab.panelRole, "tabpanel")
	assert.equal(tabs.find((tab) => tab.id === selected)?.panelLabelledBy, "this")
}

test("desktop: closing the panel returns focus to the bar, except after a press outside", () => {
	const r = run("desktop")
	assert.equal(r.moodOpen, true)
	assert.equal(r.escapeClosed, true)
	assert.match(String(r.afterEscape), /^button tab:mood/)
	assert.match(String(r.searchFocus), /^input combobox Search/)
	assert.equal(r.searchClosed, true)
	assert.match(String(r.afterSearchEscape), /^button tab:search/)
	assert.equal(r.showFound, true)
	assert.equal(r.showClosed, true)
	assert.match(String(r.afterShow), /^button tab:watch/)
	assert.equal(r.outsideClosed, true)
	assert.equal(r.afterOutside, "button Outside")
})

test("desktop: the sub-tabs are a tab list that arrows, Home and End move through", () => {
	const r = run("desktop")
	const before = r.subTabsBefore as Tab[]
	assertTabList(before, before[0].id)
	assertTabList(r.subTabsAfterRight as Tab[], before[1].id)
	assert.match(String(r.afterRight), new RegExp(`sub:${before[1].id}\\b`))
	assert.match(String(r.afterEnd), new RegExp(`sub:${before.at(-1)?.id}\\b`))
	assert.match(String(r.afterHome), new RegExp(`sub:${before[0].id}\\b`))
	// Left from the first wraps to the last.
	assert.match(String(r.afterLeft), new RegExp(`sub:${before.at(-1)?.id}\\b`))
	assert.match(String(r.afterTabsEscape), /^button tab:watch/)
})

test("phones: the sheet's tabs rove, Find gives focus back to the magnifier, and the sheet to its opener", () => {
	const r = run("phone")
	assert.equal(r.sheetOpen, true)
	assert.match(String(r.sheetFocus), /^button tab tab:mood/)
	assertTabList(r.mainTabs as Tab[], "mood")
	assert.match(String(r.afterRight), /tab:watch/)
	assert.match(String(r.afterHome), /tab:search/)
	assert.match(String(r.findFocus), /^input combobox Find in every tab/)
	assert.equal(r.afterCancel, "button Find in every tab")
	assert.match(String(r.findFocusAgain), /^input combobox Find in every tab/)
	assert.equal(r.afterFindEscape, "button Find in every tab")
	assert.equal(r.sheetStillOpen, true)
	assert.equal(r.sheetClosed, true)
	assert.match(
		String(r.afterSheetEscape),
		new RegExp(`^button tab:${r.openerWas}`),
	)
})

for (const width of ["desktop", "phone"] as const) {
	test(`${width}: search arrows update the combobox descendant and steering buttons stay tabbable`, () => {
		const r = run(width).combobox as {
			role: string
			expanded: string
			popup: string
			gridRole: string
			before: { id: string | null }
			first: {
				id: string
				role: string
				selected: string
				inGrid: boolean
				focused: boolean
			}
			second: { id: string }
			back: { id: string }
			togglesReachable: boolean
		}
		assert.equal(r.role, "combobox")
		assert.equal(r.expanded, "true")
		assert.equal(r.popup, "grid")
		assert.equal(r.gridRole, "grid")
		assert.equal(r.before.id, null)
		assert.ok(r.first.id)
		assert.equal(r.first.role, "row")
		assert.equal(r.first.selected, "true")
		assert.equal(r.first.inGrid, true)
		assert.equal(r.first.focused, true)
		assert.notEqual(r.second.id, r.first.id)
		assert.equal(r.back.id, r.first.id)
		assert.equal(r.togglesReachable, true)
	})
}

test("quick titles retain the plus count when people were removed from a mixed page", () => {
	assert.deepEqual(run("desktop").quickTitles, {
		found: 18,
		full: true,
		count: "4 of 18+",
	})
})

for (const width of ["desktop", "phone"] as const) {
	test(`${width}: Find keyboard and ARIA survive switching main tabs with text present`, () => {
		assert.deepEqual(run(width).findAcrossTabs, {
			text: "Netflix",
			expanded: "true",
			grid: "grid",
			activeInGrid: true,
			picked: true,
		})
	})
}

for (const width of ["desktop", "phone"] as const) {
	test(`${width}: Find excludes stale rows and cancels obsolete title and person requests`, () => {
		assert.deepEqual(run(width).findFreshness, {
			previousRowsShown: { title: true, person: true },
			rowsDuringDebounce: { title: false, person: false },
			rowsDuringLoad: { title: false, person: false },
			debounceEnterUnchanged: true,
			loadingEnterUnchanged: true,
			freshRowsShown: { title: true, person: true },
			obsoleteRequests: 4,
			allAborted: true,
		})
	})
}
