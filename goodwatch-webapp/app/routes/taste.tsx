import { Outlet, useLocation, useMatches } from "@remix-run/react"
import { TasteTabs, isTasteTabPath } from "~/ui/taste/tabs/TasteTabs"

export default function TasteLayout() {
	const { pathname } = useLocation()
	// No tabs while a member starts their taste: there's nothing to tab through yet.
	const starting = useMatches().some((m) => {
		const view = (m.data as { view?: { status?: string; tab?: string } } | null)
			?.view
		return view?.tab === "sides" && view.status === "empty"
	})
	return (
		<>
			{isTasteTabPath(pathname) && !starting && <TasteTabs />}
			<Outlet />
		</>
	)
}
