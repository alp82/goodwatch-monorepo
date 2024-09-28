import React from "react"
import { sections } from "~/ui/details/common"
import type { Section } from "~/utils/scroll"

export type DetailsInlineNavProps = {
	activeSections: string[]
	navigateToSection: (section: Section) => void
}

export default function DetailsInlineNav({
	activeSections,
	navigateToSection,
}: DetailsInlineNavProps) {
	return (
		<nav className="2xl:hidden sticky top-16 w-full flex flex-center justify-center bg-black z-40">
			<div className="m-auto max-w-7xl w-full mx-4 py-4 px-8 flex items-center gap-6 flex-wrap">
				{Object.values(sections).map((section) => (
					<div
						key={section.id}
						className={`border-b-4 ${
							activeSections.includes(section.id)
								? "border-amber-500 text-amber-300"
								: "border-white/30 text-white/70"
						} hover:border-amber-500/70 hover:text-amber-300/70 transition-colors duration-200`}
					>
						<button type="button" onClick={() => navigateToSection(section)}>
							{section.label}
						</button>
					</div>
				))}
			</div>
		</nav>
	)
}
