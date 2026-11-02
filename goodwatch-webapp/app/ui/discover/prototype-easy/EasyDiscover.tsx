// PROTOTYPE (discover-easy): Easy and Advanced are one page. Round 8: Easy is the search, Ready to watch and Sort;
// For you joins in Advanced, and the bar slides in under the search. Variants attach Ready and Sort to the search bar
// in different ways (phones always use the lip). `as=member` shows the member state over the guest's data; variant 0 is today's page.
import { useSearchParams } from "@remix-run/react"
import { DiscoverPage, type DiscoverPageProps } from "../DiscoverPage"
import { EasyE } from "./EasyE"
import type { Attach } from "./attached"
import { ModeSwitch, useMode } from "./kit"
import { PrototypeSwitcher } from "./Switcher"
import type { Easy } from "./types"

type V = { key: string; name: string; attach?: Attach; today?: boolean }
const VARIANTS: V[] = [
	{ key: "A", name: "Bar end", attach: "end" },
	{ key: "B", name: "Segments", attach: "segments" },
	{ key: "C", name: "Lip", attach: "lip" },
	{ key: "D", name: "Ready first", attach: "prefix" },
	{ key: "E", name: "Sort over results", attach: "rowsort" },
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
								attach: v.attach ?? "end",
								reading: (e) => <EasyE e={e} />,
							}
				}
			/>
			<PrototypeSwitcher variants={VARIANTS} />
		</>
	)
}
