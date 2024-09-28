import { useLocation, useNavigate } from "@remix-run/react"
import { useEffect, useState } from "react"

interface UseTabProps<T> {
	name: string
	initialTab: T
}

const useTab = <T extends string>({ name, initialTab }: UseTabProps<T>) => {
	const [initialized, setInitialized] = useState(false)
	const [activeTab, setActiveTab] = useState<T>(initialTab)

	const location = useLocation()
	const navigate = useNavigate()

	useEffect(() => {
		// Check URL query parameter on component mount to set the active tab
		const params = new URLSearchParams(location.search)
		const tab = params.get("tab") as T
		if (tab && tab !== activeTab) {
			setActiveTab(tab)
		}
	}, [location.search])

	const scrollTabIntoView = (tab: string) => {
		const tabElement = document.getElementById(`tabs-${name}`)
		if (tabElement) {
			tabElement.scrollIntoView({ behavior: "smooth" })
		}
	}

	useEffect(() => {
		// don't scroll on initial render
		if (!initialized) return

		// Scroll to the tab section
		scrollTabIntoView(activeTab)
	}, [activeTab])

	const handleSwitchToTab = (tab: T, replace = false) => {
		if (tab !== activeTab) {
			// Update the URL query parameter
			const url = new URL(window.location.href)
			url.searchParams.set("tab", tab)
			navigate(
				{
					pathname: location.pathname,
					search: url.searchParams.toString(),
				},
				{
					preventScrollReset: true,
					replace,
				},
			)

			// Set the active tab
			setActiveTab(tab)
		} else {
			scrollTabIntoView(tab)
		}

		setInitialized(true)
	}

	return { activeTab, handleSwitchToTab }
}
