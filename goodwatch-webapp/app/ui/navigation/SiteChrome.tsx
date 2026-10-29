// The site's chrome around a page: the header, the Explore tab row on the Explore pages, the footer, the phone dock,
// the account menu and the search dialog. The app (app.tsx) and the error page (root.tsx) both draw it, so the two
// can't drift apart.
import { GlobeAltIcon } from "@heroicons/react/24/solid"
import { useLocation } from "@remix-run/react"
import type { ReactNode } from "react"
import { countryPath } from "~/domain/new-on-services"
import Footer from "~/ui/footer/Footer"
import { useUser } from "~/utils/auth"
import useLocale from "~/utils/locale"
import { AreaTabs } from "./AreaTabs"
import { AccountMenuHost, SearchDialog } from "./LazyDialogs"
import { MobileDock } from "./MobileDock"
import { NavigationProvider } from "./NavigationContext"
import { SiteHeader } from "./SiteHeader"
import { areaOf, exploreTabs } from "./areas"

const under = (pathname: string, prefix: string) =>
	pathname === prefix || pathname.startsWith(`${prefix}/`)

/**
 * How the Explore row shows on this page: left out on Explorer (a full-screen map), not sticky where the page pins a
 * bar of its own under the header (Discover's filter bar, the phone bar on Hot), sticky elsewhere.
 */
export function exploreRowMode(pathname: string): "off" | "static" | "sticky" {
	if (areaOf(pathname) !== "explore" || under(pathname, "/explorer"))
		return "off"
	if (under(pathname, "/discover") || under(pathname, "/hot-on-socials"))
		return "static"
	return "sticky"
}

/** Explore's tabs under the header. Guests' New goes to their country's page, as members' goes to their services. */
function ExploreRow() {
	const { pathname } = useLocation()
	const { user } = useUser()
	const { locale } = useLocale()
	const mode = exploreRowMode(pathname)
	if (mode === "off") return null
	return (
		// `contents`: no box of its own, so the row sticks within <main> rather than within this wrapper.
		<div data-explore-tabs={mode} className="contents">
			<AreaTabs
				label="Explore"
				icon={GlobeAltIcon}
				tabs={exploreTabs(pathname, {
					newHref: user ? "/new" : countryPath(locale.country),
				})}
				sticky={mode === "sticky"}
			/>
		</div>
	)
}

export function SiteChrome({
	children,
	mainClassName = "relative grow mx-auto mt-16 pb-2 w-full text-neutral-300",
	afterHeader,
	afterFooter,
}: {
	/** The page, inside `<main>` under the Explore row. */
	children: ReactNode
	mainClassName?: string
	/** Between the header and `<main>` (the app's onboarding banner). */
	afterHeader?: ReactNode
	/** After the footer, before the dock (hosts that render nothing until used). */
	afterFooter?: ReactNode
}) {
	return (
		<NavigationProvider>
			<SiteHeader />
			{afterHeader}
			<main className={mainClassName}>
				<ExploreRow />
				{children}
			</main>
			<Footer />
			{afterFooter}
			<MobileDock />
			<AccountMenuHost />
			<SearchDialog />
		</NavigationProvider>
	)
}
