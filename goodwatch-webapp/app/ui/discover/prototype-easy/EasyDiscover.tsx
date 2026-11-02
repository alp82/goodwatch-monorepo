// PROTOTYPE (discover-easy): Easy and Advanced are one page. Baseline (owner, round 7): the Easy | Advanced tabs
// beside the title; For you over Sort right of the search in both modes; Advanced slides the bar in right under the
// search, above the row of Ready and the reading. Variants change how For you over Sort is drawn and where the reading
// sits. `as=member` shows the member state over the guest's data; variant 0 is today's page.
import { useSearchParams } from "@remix-run/react"
import type { ReactNode } from "react"
import { DiscoverPage, type DiscoverPageProps } from "../DiscoverPage"
import { EasyE } from "./EasyE"
import { EasyFInside } from "./EasyF"
import type { StackStyle } from "./ForYouStack"
import { ModeSwitch, useMode } from "./kit"
import { PrototypeSwitcher } from "./Switcher"
import type { Easy } from "./types"

type Part = (p: { e: Easy }) => ReactNode
type V = { key: string; name: string; stack?: StackStyle; Reading?: Part; Inside?: Part; today?: boolean }
const VARIANTS: V[] = [
	{ key: "A", name: "Card", stack: "card", Reading: EasyE },
	{ key: "B", name: "Attached", stack: "attached", Reading: EasyE },
	{ key: "C", name: "Labels", stack: "labels", Reading: EasyE },
	{ key: "D", name: "Pills", stack: "pills", Reading: EasyE },
	{ key: "E", name: "Card, reading in the field", stack: "card", Inside: EasyFInside },
	{ key: "0", name: "Today", today: true },
]

export function EasyDiscover(props: DiscoverPageProps) {
	const [params] = useSearchParams()
	const { mode, setMode } = useMode()
	const v = VARIANTS.find((x) => x.key === params.get("variant")) ?? VARIANTS[0]
	const member = params.get("as") === "member"
	const { Reading, Inside } = v
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
								stack: v.stack ?? "card",
								reading: Reading && ((e) => <Reading e={e} />),
								inside: Inside && ((e) => <Inside e={e} />),
							}
				}
			/>
			<PrototypeSwitcher variants={VARIANTS} />
		</>
	)
}
