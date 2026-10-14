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
	/** The dock's strip container on phones, where DockStrip renders a page's controls; null without a dock. */
	stripTarget: HTMLElement | null
	setStripTarget: (element: HTMLElement | null) => void
	/** How many DockStrips are mounted; the hub key shrinks while one is. */
	strips: number
	setStrips: (update: (count: number) => number) => void
}

// Outside the provider (a component rendered on its own, as in a test) nothing opens and nothing docks.
const NavigationContext = createContext<NavigationState>({
	hubOpen: false,
	setHubOpen: () => {},
	searchOpen: false,
	setSearchOpen: () => {},
	stripTarget: null,
	setStripTarget: () => {},
	strips: 0,
	setStrips: () => {},
})

export function NavigationProvider({ children }: { children: ReactNode }) {
	const [hubOpen, setHubOpen] = useState(false)
	const [searchOpen, setSearchOpen] = useState(false)
	const [stripTarget, setStripTarget] = useState<HTMLElement | null>(null)
	const [strips, setStrips] = useState(0)
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
			stripTarget,
			setStripTarget,
			strips,
			setStrips,
		}),
		[hubOpen, searchOpen, stripTarget, strips],
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
