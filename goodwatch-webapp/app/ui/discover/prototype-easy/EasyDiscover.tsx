// PROTOTYPE (discover-easy): Easy and Advanced are one page. Round 9 baseline (owner picked round 8 E): Ready to watch
// attached to the search bar, Sort over the results at the reading line's end; For you joins in Advanced and the bar
// slides in under the search. Variants change what the reading line shows while nothing is searched or filtered. `as=member` shows the member state over the guest's data; variant 0 is today's page.
import { useSearchParams } from "@remix-run/react"
import { DiscoverPage, type DiscoverPageProps } from "../DiscoverPage"
import { EasyE } from "./EasyE"
import type { EmptyKind } from "./Empty"
import { ModeSwitch, useMode } from "./kit"
import { PrototypeSwitcher } from "./Switcher"
import type { Easy } from "./types"

type V = { key: string; name: string; empty?: EmptyKind; today?: boolean }
const VARIANTS: V[] = [
	{ key: "A", name: "Filters: none", empty: "summary" },
	{ key: "B", name: "Try examples", empty: "examples" },
	{ key: "C", name: "Quick adds", empty: "quick" },
	{ key: "D", name: "Moods", empty: "moods" },
	{ key: "E", name: "Type switch", empty: "type" },
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
								reading: (e) => <EasyE e={e} empty={v.empty} />,
							}
				}
			/>
			<PrototypeSwitcher variants={VARIANTS} />
		</>
	)
}
