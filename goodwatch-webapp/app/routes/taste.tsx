import { Outlet, useLocation } from "@remix-run/react"
import { useFeature } from "~/hooks/useFeature"
import { TasteTabs, isTasteTabPath } from "~/ui/taste/tabs/TasteTabs"

export default function TasteLayout() {
	const tastePage = useFeature("tastePage")
	const { pathname } = useLocation()
	return (
		<>
			{tastePage && isTasteTabPath(pathname) && <TasteTabs />}
			<Outlet />
		</>
	)
}
