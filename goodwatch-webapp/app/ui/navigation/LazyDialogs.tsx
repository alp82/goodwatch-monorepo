// The hub and the search dialog, without their code in the page's first load. Both use the dialog library, which is
// 40 KB compressed and which no page needs before a visitor opens something. Their code loads when the page is
// interactive, so the first tap doesn't wait for it, or with that tap when it comes earlier.
import { Suspense, lazy, useEffect } from "react"
import { useOpenedOnce } from "~/utils/first-use"
import { whenInteractive } from "~/utils/page-interactive"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { useNavigation } from "./NavigationContext"
import { useSearchShortcuts } from "./Search"

const loadHub = () => import("./Hub")
const loadSearchPanel = () => import("./SearchPanel")
const Hub = lazy(
	reloadOnStaleChunk(() =>
		loadHub().then((module) => ({ default: module.HubDialog })),
	),
)
const SearchPanel = lazy(
	reloadOnStaleChunk(() =>
		loadSearchPanel().then((module) => ({ default: module.SearchPanel })),
	),
)

/** Loads the search dialog's code ahead of its opening. */
export const preloadSearchPanel = () => {
	void loadSearchPanel().catch(() => {})
}

/** The hub sheet (phones) and Browse panel (desktop): one dialog, opened from the hub key or the Browse button. */
export function HubDialog() {
	const navigation = useNavigation()
	const opened = useOpenedOnce(Boolean(navigation?.hubOpen))
	useEffect(
		() =>
			whenInteractive(() => {
				void loadHub().catch(() => {})
				preloadSearchPanel()
			}),
		[],
	)
	if (!opened) return null
	return (
		<Suspense fallback={null}>
			<Hub />
		</Suspense>
	)
}

/** The search dialog, plus the keyboard shortcuts that open it. */
export function SearchDialog() {
	const navigation = useNavigation()
	useSearchShortcuts()
	const opened = useOpenedOnce(Boolean(navigation?.searchOpen))
	if (!opened) return null
	return (
		<Suspense fallback={null}>
			<SearchPanel />
		</Suspense>
	)
}
