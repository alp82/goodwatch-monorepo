// PROTOTYPE (discover-easy): Discover opens in Easy mode; Advanced (mode=advanced) is today's bar. Both share the
// title row, the search field and the readout of how the search was read, and the same URL filters.
// Variants A-C change only the easy content under the search; 0 is today's page unchanged.
import { useSearchParams } from "@remix-run/react"
import { DiscoverPage, type DiscoverPageProps } from "../DiscoverPage"
import { ModeSwitch, useMode } from "./kit"
import { PrototypeSwitcher } from "./Switcher"
import { EasyA, name as nameA } from "./EasyA"
import { EasyB, name as nameB } from "./EasyB"
import { EasyC, name as nameC } from "./EasyC"

const VARIANTS = [
	{ key: "A", name: nameA, C: EasyA },
	{ key: "B", name: nameB, C: EasyB },
	{ key: "C", name: nameC, C: EasyC },
	{ key: "0", name: "Today", C: null },
]

export function EasyDiscover(props: DiscoverPageProps) {
	const [params] = useSearchParams()
	const { mode, setMode } = useMode()
	const v = VARIANTS.find((x) => x.key === params.get("variant")) ?? VARIANTS[0]
	const Easy = v.C
	return (
		<>
			<DiscoverPage
				{...props}
				proto={
					Easy
						? { mode, setMode, modeSwitch: <ModeSwitch />, easy: (e) => <Easy e={e} /> }
						: undefined
				}
			/>
			<PrototypeSwitcher variants={VARIANTS} />
		</>
	)
}
