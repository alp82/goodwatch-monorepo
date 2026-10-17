import { Outlet, useLocation, useSearchParams } from "@remix-run/react"
import { TasteTabs, isTasteTabPath } from "~/ui/taste/tabs/TasteTabs"

export default function TasteLayout() {
	const { pathname } = useLocation()
	// PROTOTYPE: the fresh-member variants A and C hide the tabs until there's a taste to tab through.
	const variant = useSearchParams()[0].get("variant")
	const hideTabs = variant === "A" || variant === "C"
	return (
		<>
			{isTasteTabPath(pathname) && !hideTabs && <TasteTabs />}
			<Outlet />
		</>
	)
}
