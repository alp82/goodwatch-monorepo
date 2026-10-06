import React from "react"
import { sections } from "~/ui/details/sections"
import { HEADER_HEIGHT } from "~/ui/details/header-height"
import {
	type ActiveSections,
	type Section,
	useActiveSections,
} from "~/utils/scroll"

export type DetailsSideNavProps = {
	activeSections: ActiveSections
	navigateToSection: (section: Section) => void
}

export default function DetailsSideNav({
	activeSections: active,
	navigateToSection,
}: DetailsSideNavProps) {
	const activeSections = useActiveSections(active)
	return (
		<div
			className="hidden 2xl:block absolute left-0 right-0 m-auto max-w-[104rem] h-full"
			style={{ top: `calc(${HEADER_HEIGHT} + 12px)` }}
		>
			<aside
				className="sticky mr-4 w-32 z-20"
				style={{ top: `calc(${HEADER_HEIGHT} + 76px)` }}
			>
				<nav
					aria-label="Details sections"
					className="flex flex-col p-2 bg-black/20 text-lg space-y-1"
				>
					{Object.values(sections).map((section) => (
						<button
							key={section.id}
							type="button"
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
