// The account menu and the search dialog, without their code in the page's first load: the header and the dock are on
// every landing surface, and no page needs either before someone opens it. Their code loads when the page is
// interactive (the account menu for members only), so the first tap doesn't wait for it, or with that tap when it
// comes earlier.
import { Suspense, lazy, useEffect } from "react"
import { useUser } from "~/utils/auth"
import { useOpenedOnce } from "~/utils/first-use"
import { whenInteractive } from "~/utils/page-interactive"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
import { useNavigation } from "./NavigationContext"
import { useSearchShortcuts } from "./Search"

const loadAccountMenu = () => import("~/ui/account/AccountMenu")
const loadSearchPanel = () => import("./SearchPanel")
const AccountMenu = lazy(
	reloadOnStaleChunk(() =>
		loadAccountMenu().then((module) => ({ default: module.AccountMenu })),
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

/** The account menu (desktop panel, phone sheet), opened from the avatar in the header or the dock. Members only. */
export function AccountMenuHost() {
	const navigation = useNavigation()
	const { user } = useUser()
	const member = Boolean(user)
	const opened = useOpenedOnce(navigation.accountOpen)
	useEffect(
		() =>
			whenInteractive(() => {
				if (member) void loadAccountMenu().catch(() => {})
				preloadSearchPanel()
			}),
		[member],
	)
	if (!member || !opened) return null
	return (
		<Suspense fallback={null}>
			<AccountMenu />
		</Suspense>
	)
}

/** The search dialog, plus the keyboard shortcuts that open it. */
export function SearchDialog() {
	const navigation = useNavigation()
	useSearchShortcuts()
	const opened = useOpenedOnce(navigation.searchOpen)
	if (!opened) return null
	return (
		<Suspense fallback={null}>
			<SearchPanel />
		</Suspense>
	)
}
