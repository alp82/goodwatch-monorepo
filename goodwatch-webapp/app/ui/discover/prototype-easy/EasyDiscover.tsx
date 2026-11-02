// PROTOTYPE (discover-easy): Easy and Advanced are one page. The title, the search and the reading of the search
// (E under the field, F inside it) stay put in both modes; Advanced slides the bar in under them, Ready grows its
// parts and For you + Sort fades in on Ready's row. `tabs=title|row` places the Easy | Advanced tabs; `as=member`
// shows the member state over the guest's data; variant 0 is today's page.
import { useSearchParams } from "@remix-run/react"
import type { ReactNode } from "react"
import { DiscoverPage, type DiscoverPageProps } from "../DiscoverPage"
import { EasyE, name as nameE } from "./EasyE"
import { EasyFInside, name as nameF } from "./EasyF"
import { ModeSwitch, useMode } from "./kit"
import { PrototypeSwitcher } from "./Switcher"
import type { Easy } from "./types"

type Part = (p: { e: Easy }) => ReactNode
type V = { key: string; name: string; Reading?: Part; Inside?: Part; today?: boolean }
const VARIANTS: V[] = [
	{ key: "E", name: nameE, Reading: EasyE },
	{ key: "F", name: nameF, Inside: EasyFInside },
	{ key: "0", name: "Today", today: true },
]

export function EasyDiscover(props: DiscoverPageProps) {
	const [params] = useSearchParams()
	const { mode, setMode } = useMode()
	const v = VARIANTS.find((x) => x.key === params.get("variant")) ?? VARIANTS[0]
	const member = params.get("as") === "member"
	const tabsAt = params.get("tabs") === "row" ? "row" : "title"
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
								tabsAt,
								reading: Reading && ((e) => <Reading e={e} />),
								inside: Inside && ((e) => <Inside e={e} />),
							}
				}
			/>
			<PrototypeSwitcher variants={VARIANTS} />
		</>
	)
}
