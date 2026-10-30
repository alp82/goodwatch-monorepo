// "Curated for you | By your tropes": the small switch at the top of Watch › Recommendations. Two links to two
// addresses, in the profile's segmented look. Shown only to members with a trope profile (the pages decide).
import { Link } from "@remix-run/react"
import { WATCH_PATHS } from "~/domain/member-paths"

const SIDES = [
	["curated", "Curated for you", WATCH_PATHS.forYou],
	["tropes", "By your tropes", WATCH_PATHS.forYouTropes],
] as const

export function RecsSwitch({ here }: { here: "curated" | "tropes" }) {
	return (
		<nav
			aria-label="Recommendations"
			className="flex shrink-0 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10"
		>
			{SIDES.map(([key, label, href]) => {
				const on = key === here
				return (
					<Link
						key={key}
						to={href}
						prefetch="intent"
						aria-current={on ? "page" : undefined}
						className={`inline-flex min-h-8 items-center rounded-full px-3 text-sm font-bold whitespace-nowrap transition-colors ${on ? "bg-white text-gray-950" : "text-gray-300 hover:text-white"}`}
					>
						{label}
					</Link>
				)
			})}
		</nav>
	)
}
