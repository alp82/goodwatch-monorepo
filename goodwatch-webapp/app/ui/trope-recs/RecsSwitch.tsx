// "Curated for you | By your tropes": the small switch at the top of Watch › Recommendations. Two links to two
// addresses, in the profile's segmented look. Shown only to members with a trope profile (the pages decide).
import { WATCH_PATHS } from "~/domain/member-paths"
import { Segmented } from "~/ui/selection/Segmented"

const SIDES = [
	{ key: "curated", label: "Curated for you", href: WATCH_PATHS.forYou },
	{ key: "tropes", label: "By your tropes", href: WATCH_PATHS.forYouTropes },
] as const

export function RecsSwitch({ here }: { here: "curated" | "tropes" }) {
	return (
		<Segmented
			label="Recommendations"
			size="sm"
			value={here}
			options={[...SIDES]}
			className="shrink-0"
		/>
	)
}
