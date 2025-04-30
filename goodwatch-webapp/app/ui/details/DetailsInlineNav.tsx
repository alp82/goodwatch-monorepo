import React, { useState, useRef, useEffect } from "react"
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
	const [dropdownOpen, setDropdownOpen] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)

	// Close dropdown on outside click
	useEffect(() => {
		if (!dropdownOpen) return
		function handleClick(e: MouseEvent) {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setDropdownOpen(false)
			}
		}
		document.addEventListener("mousedown", handleClick)
		return () => document.removeEventListener("mousedown", handleClick)
	}, [dropdownOpen])

	const sectionList = Object.values(sections)
	const activeSection =
		sectionList.find((s) => activeSections.includes(s.id)) || sectionList[0]
	const lastSection = sectionList[sectionList.length - 1]
	const lastSectionIsActive = activeSections.includes(lastSection.id)
	const firstActiveSectionIndex = sectionList.findIndex(
		(s) => s.id === activeSection.id,
	)
	const progress = lastSectionIsActive
		? 1
		: firstActiveSectionIndex / (sectionList.length - 1)

	// SVG props for the progress circle
	const CIRCLE_RADIUS = 7
	const CIRCLE_CIRCUM = 2 * Math.PI * CIRCLE_RADIUS
	const dashOffset = (1 - progress) * CIRCLE_CIRCUM

	// Show all active section labels, comma separated
	const activeLabels = sectionList
		.filter((s) => activeSections.includes(s.id))
		.map((s) => s.label)
		.join(", ")

	return (
		<nav className="2xl:hidden bg-white/5 border-t border-white/10">
			<div className="relative m-auto px-4 pt-1 pb-3 w-full max-w-7xl">
				{/* Mobile: dropdown + progress bar */}
				<div className="md:hidden w-full flex items-center gap-3 relative">
					{/* Progress circle */}
					<svg
						width="18"
						height="18"
						viewBox="0 0 18 18"
						className="shrink-0 block align-middle"
						role="graphics-symbol"
						aria-label="Scroll progress"
						style={{ verticalAlign: "middle" }}
					>
						<circle
							cx="9"
							cy="9"
							r={CIRCLE_RADIUS}
							stroke="#4b5563" /* Tailwind gray-600 */
							strokeWidth="2"
							fill="none"
						/>
						<circle
							cx="9"
							cy="9"
							r={CIRCLE_RADIUS}
							stroke="#a3a3a3" /* Tailwind gray-400 */
							strokeWidth="2"
							fill="none"
							strokeDasharray={CIRCLE_CIRCUM}
							strokeDashoffset={dashOffset}
							strokeLinecap="round"
							transform="rotate(-90 9 9)"
							style={{
								transition: "stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1)",
							}}
						/>
					</svg>

					{/* Dropdown trigger */}
					<div ref={dropdownRef} className="relative w-full">
						<button
							type="button"
							onClick={() => setDropdownOpen((o) => !o)}
							className="w-full flex items-center justify-between bg-white/10 text-white/90 text-xs rounded-md px-2 py-1 border border-white/20 min-h-0 h-7"
							aria-haspopup="listbox"
							aria-expanded={dropdownOpen}
						>
							<span className="truncate w-full text-left">{activeLabels}</span>
							<svg
								className={`ml-1 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
								width="13"
								height="13"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								viewBox="0 0 24 24"
								role="graphics-symbol"
								aria-label="Toggle navigation selection"
							>
								<path d="M6 9l6 6 6-6" />
							</svg>
						</button>
						{/* Dropdown menu */}
						{dropdownOpen && (
							<ul className="absolute left-0 right-0 mt-1 z-10 bg-neutral-900 border border-white/20 rounded shadow-lg">
								{sectionList.map((section) => (
									<li key={section.id}>
										<button
											type="button"
											onClick={() => {
												navigateToSection(section)
												setDropdownOpen(false)
											}}
											className={`w-full text-left px-3 py-2 hover:bg-white/10 text-xs ${activeSections.includes(section.id) ? "text-amber-300" : ""}`}
										>
											{section.label}
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>

				{/* Desktop: inline nav */}
				<div className="hidden md:flex mt-2 md:text-xs lg:text-sm xl:text-md flex-row w-full">
					{sectionList.map((section, idx, arr) => (
						<div
							key={section.id}
							className={`mx-1 flex-1 min-w-0 border-b-[3px] ${
								activeSections.includes(section.id)
									? "border-amber-500 text-amber-300"
									: "border-white/30 text-white/70"
							} hover:border-amber-500/70 hover:text-amber-300/70 transition-colors duration-300`}
						>
							<button
								type="button"
								onClick={() => navigateToSection(section)}
								className="w-full text-center px-2 py-1"
							>
								{section.label}
							</button>
						</div>
					))}
				</div>
			</div>
		</nav>
	)
}
