// PROTOTYPE (discover-easy): Easy and Advanced are one page. Round 9 baseline (owner picked round 8 E): Ready to watch
// attached to the search bar, Sort over the results at the reading line's end; For you joins in Advanced and the bar
// slides in under the search. Round 11 (owner picked round 9 D): an empty reading line offers the moods. Round 12: a taller search bar with
// small example searches inside it (T1-T3). `as=member` shows the member state over the guest's data; variant 0 is today's page.
import { useSearchParams } from "@remix-run/react"
import { DiscoverPage, type DiscoverPageProps } from "../DiscoverPage"
import { EasyE } from "./EasyE"
import { ModeSwitch, useMode } from "./kit"
import { PrototypeSwitcher } from "./Switcher"
import type { Easy } from "./types"

type V = { key: string; name: string; examples?: "chips" | "links" | "composer"; today?: boolean }
/** Example searches for a young audience; each runs through the interpreter like typed text. */
const TRY = [
	"cozy anime for a rainy day",
	"like Severance but funny",
	"feel-good K-drama",
	"horror that's actually funny",
	"mind-bending sci-fi",
	"a short show to binge tonight",
]

const VARIANTS: V[] = [
	{ key: "T1", name: "Taller, chips under the text", examples: "chips" },
	{ key: "T2", name: "Taller, links under the text", examples: "links" },
	{ key: "T3", name: "Composer, examples in the toolbar", examples: "composer" },
	{ key: "D", name: "Round 11 (no examples)" },
	{ key: "0", name: "Today", today: true },
]

export function EasyDiscover(props: DiscoverPageProps) {
	const [params] = useSearchParams()
	const { mode, setMode } = useMode()
	const v = VARIANTS.find((x) => x.key === params.get("variant")) ?? VARIANTS[0]
	const member = params.get("as") === "member"
	return (
		<>
			<DiscoverPage
				{...props}
				member={member || props.member}
				savedForYou={member ? false : props.savedForYou}
				proto={
					v.today
						? undefined
						: {
								mode,
								setMode,
								modeSwitch: <ModeSwitch />,
								attach: "rowsort",
								reading: (e) => <EasyE e={e} empty="moods" />,
								examples: v.examples && { how: v.examples, list: TRY },
							}
				}
			/>
			<PrototypeSwitcher variants={VARIANTS} />
		</>
	)
}
