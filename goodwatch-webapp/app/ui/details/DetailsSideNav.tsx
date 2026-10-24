import React, { useRef } from "react"
import { HEADER_HEIGHT } from "~/ui/details/header-height"
import {
	type ActiveSections,
	type Section,
	useActiveSections,
} from "~/utils/scroll"
import { useReplayedTap } from "~/utils/useReplayedTap"

export type DetailsSideNavProps = {
	activeSections: ActiveSections
	navigateToSection: (section: Section) => void
	/** The sections to list, in page order. */
	sections: Section[]
}

export default function DetailsSideNav({
	activeSections: active,
	navigateToSection,
	sections,
}: DetailsSideNavProps) {
	const activeSections = useActiveSections(active)
	const navRef = useRef<HTMLElement>(null)
	// A tap from before the app was there goes to its section once the nav is ready (utils/replay-tap.ts).
	useReplayedTap("nav", (el) => Boolean(navRef.current?.contains(el)))
	return (
		// No `top`: the box starts where it would sit in the flow, right under the title header and whatever comes
		// before it (the breadcrumbs show on some pages only), so the nav never starts under the header.
		<div className="hidden 2xl:block absolute left-0 right-0 m-auto mt-3 max-w-[104rem] h-full">
			<aside
				className="sticky mr-4 w-32 z-20"
				style={{ top: `calc(${HEADER_HEIGHT} + 76px)` }}
			>
				<nav
					ref={navRef}
					aria-label="Details sections"
					className="flex flex-col p-2 bg-black/20 text-lg space-y-1"
				>
					{sections.map((section) => (
						<button
							key={section.id}
							type="button"
							data-replay-tap={`nav:${section.id}`}
							className={`border-l-8 pl-4 ${
								activeSections.includes(section.id)
									? "border-amber-500 text-amber-300"
									: "border-white/30 text-white/70"
							} hover:border-amber-500/70 hover:text-amber-300/70 transition-colors duration-200
							text-left cursor-pointer`}
							onClick={() => navigateToSection(section)}
						>
							{section.label}
						</button>
					))}
				</nav>
			</aside>
		</div>
	)
}
