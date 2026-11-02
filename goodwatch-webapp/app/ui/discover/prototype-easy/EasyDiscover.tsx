// PROTOTYPE (discover-easy): Discover opens in Easy mode; Advanced (mode=advanced) is today's bar. Both share the
// title row, the Easy | Advanced tabs, the search field and the URL filters. Variants D-H change only how Easy shows
// the reading of a search; 0 is today's page unchanged. `as=member` shows the member state over the guest's data.
import { useSearchParams } from "@remix-run/react"
import { DiscoverPage, type DiscoverPageProps } from "../DiscoverPage"
import type { Easy } from "./bits"
import { EasyD, name as nameD } from "./EasyD"
import { EasyE, name as nameE } from "./EasyE"
import { EasyF, EasyFInside, name as nameF } from "./EasyF"
import { EasyG, name as nameG } from "./EasyG"
import { EasyH, name as nameH } from "./EasyH"
import { ModeSwitch, useMode } from "./kit"
import { PrototypeSwitcher } from "./Switcher"

type V = { key: string; name: string; C: ((p: { e: Easy }) => JSX.Element) | null; Inside?: (p: { e: Easy }) => JSX.Element | null }
const VARIANTS: V[] = [
	{ key: "D", name: nameD, C: EasyD },
	{ key: "E", name: nameE, C: EasyE },
	{ key: "F", name: nameF, C: EasyF, Inside: EasyFInside },
	{ key: "G", name: nameG, C: EasyG },
	{ key: "H", name: nameH, C: EasyH },
	{ key: "0", name: "Today", C: null },
]

export function EasyDiscover(props: DiscoverPageProps) {
	const [params] = useSearchParams()
	const { mode, setMode } = useMode()
	const v = VARIANTS.find((x) => x.key === params.get("variant")) ?? VARIANTS[0]
	const member = params.get("as") === "member"
	const Easy = v.C
	const Inside = v.Inside
	return (
		<>
			<DiscoverPage
				{...props}
				member={member || props.member}
				savedForYou={member ? false : props.savedForYou}
				proto={
					Easy
						? {
								mode,
								setMode,
								modeSwitch: <ModeSwitch />,
								easy: (e) => <Easy e={e} />,
								inside: Inside && ((e) => <Inside e={e} />),
							}
						: undefined
				}
			/>
			<PrototypeSwitcher variants={VARIANTS} />
		</>
	)
}
