// PROTOTYPE (discover-easy): Easy and Advanced are one page. Round 9 baseline (owner picked round 8 E): Ready to watch
// attached to the search bar, Sort over the results at the reading line's end; For you joins in Advanced and the bar
// slides in under the search. Round 10: the type switch always leads the reading line; moods and example searches split between the empty line and
// the search field. `as=member` shows the member state over the guest's data; variant 0 is today's page.
import { useSearchParams } from "@remix-run/react"
import { DiscoverPage, type DiscoverPageProps } from "../DiscoverPage"
import { START_PRESETS } from "~/ui/start/search/presets"
import { EasyE } from "./EasyE"
import { type EmptyAfterType, MoodMenuRow } from "./Empty"
import { ModeSwitch, useMode } from "./kit"
import { PrototypeSwitcher } from "./Switcher"
import type { Easy } from "./types"

type V = {
	key: string
	name: string
	after?: EmptyAfterType
	examples?: "menu" | "placeholder"
	moodsInMenu?: boolean
	today?: boolean
}
const VARIANTS: V[] = [
	{ key: "F", name: "Moods, examples on focus", after: "moods", examples: "menu" },
	{ key: "G", name: "Moods, cycling examples", after: "moods", examples: "placeholder" },
	{ key: "H", name: "Examples, moods on focus", after: "examples", examples: "menu", moodsInMenu: true },
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
								reading: (e) => <EasyE e={e} empty="type" after={v.after} />,
								examples: v.examples && {
									how: v.examples,
									list: START_PRESETS,
									extra: v.moodsInMenu ? <MoodMenuRow /> : undefined,
								},
							}
				}
			/>
			<PrototypeSwitcher variants={VARIANTS} />
		</>
	)
}
