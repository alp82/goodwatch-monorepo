// State the site navigation shares between the header, the mobile dock, and the pages: whether the hub (sheet on
// phones, Browse panel on desktop) or the search dialog is open, and where a page's filter strip docks.
import { useLocation } from "@remix-run/react"
import {
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react"

interface NavigationState {
	hubOpen: boolean
	setHubOpen: (open: boolean) => void
	searchOpen: boolean
	setSearchOpen: (open: boolean) => void
	/** How many pages ask the phone dock to step back (see useQuietDock); the dock's keys hide while one does. */
	quietDock: number
	setQuietDock: (update: (count: number) => number) => void
}

// Outside the provider (a component rendered on its own, as in a test) nothing opens and nothing docks.
const NavigationContext = createContext<NavigationState>({
	hubOpen: false,
	setHubOpen: () => {},
	searchOpen: false,
	setSearchOpen: () => {},
	quietDock: 0,
	setQuietDock: () => {},
})

export function NavigationProvider({ children }: { children: ReactNode }) {
	const [hubOpen, setHubOpen] = useState(false)
	const [searchOpen, setSearchOpen] = useState(false)
	const [quietDock, setQuietDock] = useState(0)
	const { pathname, search } = useLocation()

	// Following a link closes whatever the navigation had open.
	useEffect(() => {
		setHubOpen(false)
		setSearchOpen(false)
	}, [pathname, search])

	const value = useMemo(
		() => ({
			hubOpen,
			setHubOpen,
			searchOpen,
			setSearchOpen,
			quietDock,
			setQuietDock,
		}),
		[hubOpen, searchOpen, quietDock],
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
