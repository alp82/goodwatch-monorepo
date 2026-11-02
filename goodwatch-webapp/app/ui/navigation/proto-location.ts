// PROTOTYPE (discover-easy): the nav reads the harness route /dev/discover-page as /discover, so it shows Explore ·
// Discover like the live page.
import { useLocation } from "@remix-run/react"

export function useNavLocation() {
	const location = useLocation()
	const pathname = location.pathname.replace(/^\/dev\/discover-page/, "/discover")
	return { ...location, pathname }
}
