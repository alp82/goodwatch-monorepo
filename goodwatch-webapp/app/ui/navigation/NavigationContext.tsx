// State the site navigation shares between the header, the phone dock and the pages: whether the account menu (a
// panel under the avatar on desktop, a bottom sheet on phones) or the search dialog is open, and how many pages ask
// the dock to step back. Also who is looking, as the navigation's addresses need it (usePathViewer).
import { useLocation } from "@remix-run/react"
import {
	type ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react"
import { GUEST, type PathViewer, member } from "~/domain/member-paths"
import type { AreaKey, AreaTab } from "./areas"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { useUser } from "~/utils/auth"

interface NavigationState {
	accountOpen: boolean
	setAccountOpen: (open: boolean) => void
	searchOpen: boolean
	setSearchOpen: (open: boolean) => void
	/** How many pages ask the phone dock to step back (see useQuietDock); the dock's keys hide while one does. */
	quietDock: number
	setQuietDock: (update: (count: number) => number) => void
	/** Phones: the sheet of an area's pages, opened by the top bar's title (this page's area) or a dock key. */
	tabsOpen: boolean
	setTabsOpen: (open: boolean) => void
	/** The area whose pages the sheet shows; null: the page's own area. Closing the sheet clears it. */
	sheetArea: AreaKey | null
	/** Opens the sheet on `area`'s pages (null: the page's own area). */
	openSheet: (area: AreaKey | null) => void
	/** The tab row the page drew (AreaTabs), hidden on phones: the sheet lists these, with the page's counts. */
	phoneRow: PhoneRow | null
	setPhoneRow: (row: PhoneRow | null) => void
}

/** An area's tab row as AreaTabs drew it, for the phone's sheet. */
export interface PhoneRow {
	label: string
	tabs: AreaTab[]
}

// Outside the provider (a component rendered on its own, as in a test) nothing opens and nothing docks.
const NavigationContext = createContext<NavigationState>({
	accountOpen: false,
	setAccountOpen: () => {},
	searchOpen: false,
	setSearchOpen: () => {},
	quietDock: 0,
	setQuietDock: () => {},
	tabsOpen: false,
	setTabsOpen: () => {},
	sheetArea: null,
	openSheet: () => {},
	phoneRow: null,
	setPhoneRow: () => {},
})

export function NavigationProvider({ children }: { children: ReactNode }) {
	const [accountOpen, setAccountOpen] = useState(false)
	const [searchOpen, setSearchOpen] = useState(false)
	const [quietDock, setQuietDock] = useState(0)
	const [tabsOpen, setTabsOpenState] = useState(false)
	const [sheetArea, setSheetArea] = useState<AreaKey | null>(null)
	const setTabsOpen = useCallback((open: boolean) => {
		setTabsOpenState(open)
		if (!open) setSheetArea(null)
	}, [])
	const openSheet = useCallback((area: AreaKey | null) => {
		setSheetArea(area)
		setTabsOpenState(true)
	}, [])
	const [phoneRow, setPhoneRow] = useState<PhoneRow | null>(null)
	const { pathname, search } = useLocation()

	// Following a link closes whatever the navigation had open.
	useEffect(() => {
		setAccountOpen(false)
		setSearchOpen(false)
		setTabsOpen(false)
	}, [pathname, search])

	const value = useMemo(
		() => ({
			accountOpen,
			setAccountOpen,
			searchOpen,
			setSearchOpen,
			quietDock,
			setQuietDock,
			tabsOpen,
			setTabsOpen,
			sheetArea,
			openSheet,
			phoneRow,
			setPhoneRow,
		}),
		[
			accountOpen,
			searchOpen,
			quietDock,
			tabsOpen,
			setTabsOpen,
			sheetArea,
			openSheet,
			phoneRow,
		],
	)
	return (
		<NavigationContext.Provider value={value}>
			{children}
		</NavigationContext.Provider>
	)
}

/** The navigation's shared state. */
export function useNavigation(): NavigationState {
	return useContext(NavigationContext)
}

/**
 * Who is looking, for the navigation's addresses: a guest, or a member with their handle (null until they pick one).
 * The root loader prefetches the member's account summary, so the server's first paint already knows the handle.
 */
export function usePathViewer(): PathViewer {
	const { user } = useUser()
	const { handle } = useAccountSummary()
	return useMemo(() => (user ? member(handle) : GUEST), [user, handle])
}
