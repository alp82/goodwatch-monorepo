import { NavLink } from "@remix-run/react"

export const TASTE_TABS = [
	{ path: "/taste", name: "Sides of you" },
	{ path: "/taste/everyone", name: "You vs everyone" },
	{ path: "/taste/fingerprint", name: "Fingerprint" },
] as const

export const isTasteTabPath = (pathname: string) => {
	const path = pathname.replace(/\/+$/, "")
	return TASTE_TABS.some((tab) => tab.path === path)
}

/** The Taste page's tabs: links, so each tab has its own address and the back button moves between them. */
export function TasteTabs() {
	return (
		<nav
			aria-label="Your taste"
			className="border-b border-white/10 bg-gray-950"
		>
			<div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 [scrollbar-width:none] md:gap-8 md:px-8 [&::-webkit-scrollbar]:hidden">
				{TASTE_TABS.map((tab) => (
					<NavLink
						key={tab.path}
						to={tab.path}
						end
						prefetch="intent"
						preventScrollReset
						className={({ isActive }) =>
							`-mb-px flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition md:py-4 md:text-base ${isActive ? "border-amber-400 text-white" : "border-transparent text-gray-400 hover:text-gray-200"}`
						}
					>
						{tab.name}
					</NavLink>
				))}
			</div>
		</nav>
	)
}
