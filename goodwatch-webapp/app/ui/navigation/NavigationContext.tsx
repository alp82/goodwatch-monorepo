// State the site navigation shares between the header, the phone dock and the pages: whether the account menu (a
// panel under the avatar on desktop, a bottom sheet on phones) or the search dialog is open, and how many pages ask
// the dock to step back. Also who is looking, as the navigation's addresses need it (usePathViewer).
import { useLocation } from "@remix-run/react"
import {
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react"
import { GUEST, type PathViewer, member } from "~/domain/member-paths"
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
}

// Outside the provider (a component rendered on its own, as in a test) nothing opens and nothing docks.
const NavigationContext = createContext<NavigationState>({
	accountOpen: false,
	setAccountOpen: () => {},
	searchOpen: false,
	setSearchOpen: () => {},
	quietDock: 0,
	setQuietDock: () => {},
})

export function NavigationProvider({ children }: { children: ReactNode }) {
	const [accountOpen, setAccountOpen] = useState(false)
	const [searchOpen, setSearchOpen] = useState(false)
	const [quietDock, setQuietDock] = useState(0)
	const { pathname, search } = useLocation()

	// Following a link closes whatever the navigation had open.
	useEffect(() => {
		setAccountOpen(false)
		setSearchOpen(false)
	}, [pathname, search])

	const value = useMemo(
		() => ({
			accountOpen,
			setAccountOpen,
			searchOpen,
			setSearchOpen,
			quietDock,
			setQuietDock,
		}),
		[accountOpen, searchOpen, quietDock],
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
