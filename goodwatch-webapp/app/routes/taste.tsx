import { Outlet, useLocation } from "@remix-run/react"
import { TasteTabs, isTasteTabPath } from "~/ui/taste/tabs/TasteTabs"

export default function TasteLayout() {
	const { pathname } = useLocation()
	return (
		<>
			{isTasteTabPath(pathname) && <TasteTabs />}
			<Outlet />
		</>
	)
}
