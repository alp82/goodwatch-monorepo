import React from "react"
import { sections } from "~/ui/details/common"
import type { Section } from "~/utils/scroll"

export type DetailsSideNavProps = {
	activeSections: string[]
	navigateToSection: (section: Section) => void
}

export default function DetailsSideNav({
	activeSections,
	navigateToSection,
}: DetailsSideNavProps) {
	return (
		<div className="absolute top-0 left-0 right-0 h-full z-20 hidden 2xl:flex justify-center">
			<div className="max-w-[104em] w-full flex justify-end">
				<div className="relative">
					<aside className="sticky top-32 mr-2">
						<nav className="flex flex-col p-2 bg-black/20 text-lg space-y-1">
							{Object.values(sections).map((section) => (
								<div
									key={section.id}
									className={`border-l-8 pl-4 ${
										activeSections.includes(section.id)
											? "border-amber-500 text-amber-300"
											: "border-white/30 text-white/70"
									} hover:border-amber-500/70 hover:text-amber-300/70 transition-colors duration-200`}
								>
									<button
										type="button"
										onClick={() => navigateToSection(section)}
									>
										{section.label}
									</button>
								</div>
							))}
						</nav>
					</aside>
				</div>
			</div>
		</div>
	)
}
