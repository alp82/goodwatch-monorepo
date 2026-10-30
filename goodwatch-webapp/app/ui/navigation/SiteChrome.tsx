// The site's chrome around a page: the header, the Explore tab row on the Explore pages, the Profile row on the Profile
// pages that have no profile layout of their own, the footer, the phone dock, the account menu and the search dialog.
// The app (app.tsx) and the error page (root.tsx) both draw it, so the two can't drift apart.
import { GlobeAltIcon } from "@heroicons/react/24/solid"
import { useLocation } from "@remix-run/react"
import type { ReactNode } from "react"
import { countryPath } from "~/domain/new-on-services"
import Footer from "~/ui/footer/Footer"
import { useUser } from "~/utils/auth"
import useLocale from "~/utils/locale"
import { AreaTabs, TasteTabs } from "./AreaTabs"
import { AccountMenuHost, SearchDialog } from "./LazyDialogs"
import { MobileDock } from "./MobileDock"
import { NavOptionsBar } from "./NavOptionsBar"
import { NavigationProvider, usePathViewer } from "./NavigationContext"
import { SiteHeader } from "./SiteHeader"
import { SubNav } from "./SubNav"
import { areaOf, bestSwitch, exploreTabs, tasteRow } from "./areas"
import { LAYER_VARS } from "./bar-layers"

const under = (pathname: string, prefix: string) =>
	pathname === prefix || pathname.startsWith(`${prefix}/`)

/**
 * How the Explore row shows on this page: not sticky where the page pins a bar of its own under the header (Discover's
 * filter bar, the phone bar on Hot) or fills the window under the row (Explorer's map), sticky elsewhere.
 */
export function exploreRowMode(pathname: string): "off" | "static" | "sticky" {
	if (areaOf(pathname) !== "explore") return "off"
	if (
		under(pathname, "/discover") ||
		under(pathname, "/hot-on-socials") ||
		under(pathname, "/explorer")
	)
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
	// Explore's third level: Best's Movies | Shows.
	const best = bestSwitch(pathname)
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
			{best && <SubNav label={best.label} items={best.choices} />}
		</div>
	)
}

/**
 * Profile pages outside the profile layout draw their own chrome where they have a header to show: /taste and the list
 * pages for a member without a handle (the handle strip), /lists/:id (its owner's profile header). This row covers the
 * rest: guests on /taste, /taste/quiz and /lists/new, and members without a handle on /taste/quiz.
 */
export function profileRowHere(pathname: string, member: boolean): boolean {
	const path =
		pathname.length > 1 && pathname.endsWith("/")
			? pathname.slice(0, -1)
			: pathname
	if (path === "/taste/quiz") return true
	return !member && (path === "/taste" || path === "/lists/new")
}

/** The Profile row without a profile (Taste · Rate more · Lists), on the pages profileRowHere names. */
function ProfileRow() {
	const { pathname, search } = useLocation()
	const viewer = usePathViewer()
	if (!profileRowHere(pathname, viewer.kind === "member")) return null
	// A member's handle can still be loading: the page itself sends members with a handle on.
	const row = tasteRow({
		pathname,
		search,
		viewer:
			viewer.kind === "member" ? { kind: "member", handle: null } : viewer,
	})
	return row && <TasteTabs row={row} />
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
			{/* The bars' surfaces as CSS variables for the rows among them (./bar-layers.ts). `contents`: no box of its
			    own, so the page's layout and sticky rows work as before. */}
			<div style={LAYER_VARS} className="contents">
				<SiteHeader />
				{afterHeader}
				<main className={mainClassName}>
					<ExploreRow />
					<ProfileRow />
					{children}
				</main>
				<Footer />
				{afterFooter}
				<MobileDock />
				<AccountMenuHost />
				<SearchDialog />
				{/* PROTOTYPE OPTIONS (round 8): development builds only. */}
				{import.meta.env.DEV && <NavOptionsBar />}
			</div>
		</NavigationProvider>
	)
}
