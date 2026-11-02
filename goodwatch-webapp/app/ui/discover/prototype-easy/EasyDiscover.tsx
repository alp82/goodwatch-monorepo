// PROTOTYPE (discover-easy): Discover opens in Easy mode (variants A-C); Advanced (mode=advanced) is today's page.
// Variant 0 is today's page with no easy mode at all. Both modes share the URL filters.
import { useSearchParams } from "@remix-run/react"
import { DiscoverPage, type DiscoverPageProps } from "../DiscoverPage"
import { ModeSwitch, useMode } from "./kit"
import { PrototypeSwitcher } from "./Switcher"
import { VariantA, name as nameA } from "./VariantA"
import { VariantB, name as nameB } from "./VariantB"
import { VariantC, name as nameC } from "./VariantC"

const VARIANTS = [
	{ key: "A", name: nameA, C: VariantA },
	{ key: "B", name: nameB, C: VariantB },
	{ key: "C", name: nameC, C: VariantC },
	{ key: "0", name: "Today", C: null },
]

export function EasyDiscover(props: DiscoverPageProps) {
	const [params] = useSearchParams()
	const { mode } = useMode()
	const v = VARIANTS.find((x) => x.key === params.get("variant")) ?? VARIANTS[0]
	const Easy = v.C
	return (
		<>
			{Easy && mode === "advanced" && (
				<div className="mx-auto flex max-w-7xl justify-end px-4 pt-4">
					<ModeSwitch />
				</div>
			)}
			<DiscoverPage {...props} easy={Easy && mode === "easy" ? (ctx) => <Easy ctx={ctx} /> : undefined} />
			<PrototypeSwitcher variants={VARIANTS} />
		</>
	)
}
