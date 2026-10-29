// What the Discover panel shows: which main tab is open (null: closed), the sub-tab each tab is on, the direction the
// content slides when the tab changes, and Find's text. Pure transitions, no React; useDiscoverBar holds the state.
import type { FilterName, FilterState } from "~/domain/filter-state"
import {
	MAIN_TABS,
	type MainTab,
	type SubTabId,
	type TabContext,
	countsFlags,
	defaultSubTab,
	subTabOfGroup,
	subTabsOf,
	tabOfSubTab,
} from "./tabs"

export interface PanelState {
	/** The open main tab; null while the panel is closed. */
	open: MainTab | null
	/** The sub-tab each main tab shows when it opens again. */
	sub: Record<MainTab, SubTabId>
	/** 1 when the new tab is to the right of the last one, -1 to the left. */
	dir: 1 | -1
	/** Find's text. It stays while switching main tabs; closing the panel clears it. */
	find: string
}

/** Closed, every tab on its default sub-tab. */
export const initialPanel = (state: FilterState): PanelState => ({
	open: null,
	sub: {
		search: defaultSubTab("search", state),
		mood: defaultSubTab("mood", state),
		watch: defaultSubTab("watch", state),
		you: defaultSubTab("you", state),
	},
	dir: 1,
	find: "",
})

const order = (tab: MainTab) => MAIN_TABS.indexOf(tab)

/**
 * Opens a main tab, at `sub` when it belongs to that tab. Mood, entered from another tab or from closed, opens on
 * Everything once anything is picked, else on Combos. Other tabs open on the sub-tab they were on last.
 */
export function openTab(
	panel: PanelState,
	tab: MainTab,
	state: FilterState,
	sub?: SubTabId,
): PanelState {
	const dir: 1 | -1 =
		panel.open && order(tab) < order(panel.open)
			? -1
			: panel.open
				? 1
				: panel.dir
	const at =
		sub && tabOfSubTab(sub) === tab
			? sub
			: tab === "mood" && panel.open !== "mood"
				? defaultSubTab("mood", state)
				: panel.sub[tab]
	return { ...panel, open: tab, dir, sub: { ...panel.sub, [tab]: at } }
}

/** Opens the sub-tab that owns a filter group (where its chip leads); a group in no tab opens nothing. */
export function openAtGroup(
	panel: PanelState,
	group: FilterName,
	state: FilterState,
): PanelState {
	const sub = subTabOfGroup(group)
	return sub ? openTab(panel, tabOfSubTab(sub), state, sub) : panel
}

/** Closes the panel; Find's text goes with it. */
export const closePanel = (panel: PanelState): PanelState =>
	panel.open === null && panel.find === ""
		? panel
		: { ...panel, open: null, find: "" }

/** A tap on a sub-tab: ends Find and opens it. */
export function pickSubTab(panel: PanelState, id: SubTabId): PanelState {
	const tab = tabOfSubTab(id)
	return {
		...panel,
		open: tab,
		find: "",
		sub: { ...panel.sub, [tab]: id },
	}
}

export const setFind = (panel: PanelState, find: string): PanelState =>
	panel.find === find ? panel : { ...panel, find }

/**
 * The sub-tab a tab shows: the one it is on, or its first shown sub-tab when that one hides (Age and content
 * without a ladder, Budget with shows only).
 */
export function shownSubTab(
	panel: PanelState,
	tab: MainTab,
	state: FilterState,
	context: TabContext,
): SubTabId {
	const subs = subTabsOf(tab, state, context)
	const at = panel.sub[tab]
	return subs.some((sub) => sub.id === at) ? at : (subs[0]?.id ?? at)
}

/** The sub-tab on screen; null while the panel is closed. */
export const openSubTab = (
	panel: PanelState,
	state: FilterState,
	context: TabContext,
): SubTabId | null =>
	panel.open ? shownSubTab(panel, panel.open, state, context) : null

/**
 * The `counts=` flags for the sub-tab on screen. It needs no ladder or viewer: the one sub-tab that hides without a
 * ladder (Age and content) asks for no counts, and neither does the sub-tab it falls back to, so the request can be
 * built before the first response.
 */
export const panelCounts = (panel: PanelState, state: FilterState): string[] =>
	countsFlags(
		openSubTab(panel, state, { member: true, ladder: null, query: null }),
	)
