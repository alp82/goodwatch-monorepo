// PROTOTYPE - throwaway (prototype/explore-r4). The frame every concept renders in: the real Explore rows under the
// site header, the concept's page, and the one floating switcher with its notes panel (both prototype-only).
import {
	CalendarDaysIcon,
	CheckBadgeIcon,
	FireIcon,
	GlobeAltIcon as GlobeOutline,
	MagnifyingGlassIcon,
	MapIcon,
	TrophyIcon,
	UserGroupIcon,
} from "@heroicons/react/24/outline"
import { GlobeAltIcon } from "@heroicons/react/24/solid"
import { AreaTabs } from "~/ui/navigation/AreaTabs"
import type { AreaTab } from "~/ui/navigation/areas"
import { SubNav } from "~/ui/navigation/SubNav"
import { type Address, type Kind, best, href, hub, withKind } from "../kit/address"
import type { Chrome, ConceptModule, ConceptPageProps } from "../kit/contract"
import type { ExploreData } from "./load.server"
import { Switcher } from "./Switcher"

const real = (key: string, label: string, to: string, icon: AreaTab["icon"]): AreaTab => ({
	key,
	label,
	href: to,
	icon,
	here: false,
})

/**
 * The Explore row most concepts want: Browse first and lit, then the real tabs. `bestTab` gives Best a tab of its own
 * (lit on Best pages) for the concepts that keep it outside the tree, between Hot and Awards as on the live site.
 */
export function exploreTabs(
	concept: string,
	address: Address,
	opts: { bestTab?: boolean } = {},
): AreaTab[] {
	const onBest = address.view === "best"
	const tabs: AreaTab[] = [
		{
			key: "browse",
			label: "Browse",
			icon: GlobeOutline,
			href: href(concept, hub(address.kind)),
			here: !(opts.bestTab && onBest),
		},
	]
	tabs.push(real("new", "New", "/new", CalendarDaysIcon), real("hot", "Hot", "/hot", FireIcon))
	if (opts.bestTab)
		tabs.push({
			key: "best",
			label: "Best",
			icon: CheckBadgeIcon,
			href: href(concept, best(address.kind)),
			here: onBest,
		})
	tabs.push(
		real("awards", "Awards", "/awards", TrophyIcon),
		real("people", "People", "/people", UserGroupIcon),
		real("map", "Map", "/map", MapIcon),
		real("discover", "Discover", "/discover", MagnifyingGlassIcon),
	)
	return tabs
}

/** The pinned Movies | Shows row: the same page for the other kind. */
export function kindRow(concept: string, address: Address) {
	return {
		label: "Type",
		items: (["movie", "show"] as Kind[]).map((k) => ({
			key: k,
			label: k === "movie" ? "Movies" : "Shows",
			href: href(concept, withKind(address, k)),
			// Movies and shows together (`/all`, round 5) has no item of its own here: neither is lit.
			here: address.kind === k,
		})),
	}
}

export function Shell({ d, concept }: { d: ExploreData; concept: ConceptModule }) {
	const props: ConceptPageProps = {
		concept: d.concept,
		address: d.address,
		data: d.data,
		viewer: d.viewer,
		to: (a, extra) => href(d.concept, a, extra),
	}
	const chrome: Chrome = concept.chrome?.(props) ?? {}
	const tabs = chrome.tabs ?? exploreTabs(d.concept, d.address)
	const pinned = chrome.pinned === undefined ? kindRow(d.concept, d.address) : chrome.pinned
	return (
		<div
			className="pb-28 lg:pb-24"
			// Where a sticky bar inside the page (BestTable's header) sits from `lg` up: under the header and these rows.
			style={{ ["--best-head-top" as string]: pinned ? "calc(4rem + 93px)" : "calc(4rem + 49px)" }}
		>
			<AreaTabs label="Explore" icon={GlobeAltIcon} tabs={tabs} />
			{pinned && <SubNav label={pinned.label} items={pinned.items} />}
			<concept.Page {...props} />
			{concept.Panel ? (
				<concept.Panel d={d} concept={concept} notes={concept.notes?.(props) ?? []} />
			) : (
				<Switcher d={d} concept={concept} notes={concept.notes?.(props) ?? []} />
			)}
		</div>
	)
}
