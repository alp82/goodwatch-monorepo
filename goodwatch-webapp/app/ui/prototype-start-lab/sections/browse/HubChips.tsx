// PROTOTYPE (start page lab): the start page's hubs (MAIN_HUBS, CATEGORY_HUBS) as one row of the site's round-icon chips (living-room.css `.lrb-by`), scrolling sideways on phones.
import "~/ui/living-room/living-room.css"
import { Link } from "@remix-run/react"
import { CATEGORY_HUBS, MAIN_HUBS } from "~/ui/living-room/BelowRoom"

// The main hubs' chip icons are the hub cards' own (`.lrb-hub-<page> a::before`); the category links keep their `.lrb-by-<kind>` icons.
const CHIPS = [
	...MAIN_HUBS.filter((hub) => hub.href !== "/how-it-works").map((hub) => ({
		href: hub.href,
		label: hub.label,
		className: `lrb-hub-${hub.href.slice(1)}`,
	})),
	...CATEGORY_HUBS.flatMap((group) =>
		group.links.map((link) => ({
			href: link.href,
			label: link.label.replace("streaming service", "service"),
			className: `lrb-by-${link.href.split("/").at(-1)}`,
		})),
	),
]

/** Needs a `.lrb` ancestor (its font, link and focus styles). */
export function HubChips({ wrapOnDesktop = true }: { wrapOnDesktop?: boolean }) {
	return (
		<div className="lrb-by" style={{ display: "block", marginTop: 0 }}>
			<ul
				className={`-mx-4 !flex-nowrap overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-8 sm:px-8 ${wrapOnDesktop ? "lg:mx-0 lg:!flex-wrap lg:overflow-visible lg:px-0" : ""}`}
				style={{ marginTop: 0 }}
			>
				{CHIPS.map((chip) => (
					<li key={chip.href} className={`shrink-0 ${chip.className}`}>
						<Link to={chip.href} discover="none" className="whitespace-nowrap">
							{chip.label}
						</Link>
					</li>
				))}
			</ul>
		</div>
	)
}

/** A `.lrb` wrapper without its page-section extras (background, stacking). */
export const lrbStyle = { background: "none", zIndex: "auto" } as const
