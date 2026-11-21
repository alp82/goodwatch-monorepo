// PROTOTYPE - throwaway (prototype/explore-r5). Concept "lab": the one thing the owner opens in round 5. Its structure
// is settled (the rooms row carries navigation); everything else is a slot with variants, picked separately in the lab
// panel. See contract.ts for what a slot is and README.md for how to add one.
import type { CSSProperties } from "react"
import { KINDS, kindLabel, withKind } from "../../kit/address"
import type { ConceptModule, ConceptPageProps } from "../../kit/contract"
import { type BlendEntryProps, BlendEntrySlot, PlaceCardSlot } from "../../kit/ui"
import { GridOut, type GridOutStyle } from "../../kit/ui/ListControls"
import type { CardProps } from "../../kit/types"
import { type BlendLight, ROOMS, RoomsBar } from "../rooms/bar"
import { exploreTabs } from "../../shell/Shell"
import type { LabData, PageViewProps } from "./contract"
import { LabProvider, Part } from "./lab"
import { LabPanel, labQuickLinks } from "./Panel"
import { labOf, slotsFor, variantOf } from "./registry"
import type { KindProps } from "./slots/kind/slot"

/** The picked card variant, for every PlaceCard the round 4 components draw. */
const CardPart = (props: CardProps) => <Part slot="card" {...props} />
/** The picked way to start a blend, for every place head the round 4 components draw. */
const EntryPart = (props: BlendEntryProps) => <Part slot="blend-entry" {...props} />

function Page(props: ConceptPageProps<LabData>) {
	const { data, address, to } = props
	const lab = labOf(data.picks)
	const variant = variantOf(data.slot, data.variant)
	const View = variant?.View as React.ComponentType<PageViewProps> | undefined
	const kindProps: KindProps = {
		address,
		to,
		kinds: KINDS.map((k) => ({
			kind: k,
			label: kindLabel(k),
			href: to(withKind(address, k)),
			on: address.kind === k,
		})),
	}
	// Round 8: Best is a tab of its own in the Explore row, so its pages show no rooms row (its head carries Movies |
	// Shows instead).
	const rooms = address.view !== "best"
	return (
		<LabProvider picks={data.picks} parts={data.parts}>
			{/* The rooms row adds 44px under the tab row from `lg`: a sticky bar inside the page sits under it. */}
			<div
				style={
					{ "--best-head-top": rooms ? "calc(4rem + 93px)" : "calc(4rem + 49px)" } as CSSProperties
				}
				data-lab-page={`${data.slot}:${data.variant}`}
			>
				{rooms && (
					<RoomsBar
						address={address}
						to={to}
						kindControl={<Part slot="kind" {...kindProps} />}
						rooms={LAB_ROOMS}
						blend={lab.pick("blend-room") as BlendLight}
					/>
				)}
				{/* The round 4 card is the kit's own; any other pick takes over every place card on the page. */}
				<PlaceCardSlot.Provider value={lab.pick("card") === "r4" ? null : CardPart}>
					{/* How a blend starts from a place's head (slot "blend-entry"), for the round 4 heads too. */}
					<BlendEntrySlot.Provider value={EntryPart}>
						{/* Where a room grid's way out to Discover shows (slot "grid-out"). */}
						<GridOut.Provider value={lab.pick("grid-out") as GridOutStyle}>
							{View ? (
								<View {...props} data={data.data} lab={lab} />
							) : (
								<p className="mx-auto max-w-7xl p-8 text-gray-400">
									No variant for the slot "{data.slot}" yet.
								</p>
							)}
						</GridOut.Provider>
					</BlendEntrySlot.Provider>
				</PlaceCardSlot.Provider>
			</div>
			{/* Once per page: what holds a blend's ingredients while you browse (slot "tray"; "none" draws nothing). */}
			<Part slot="tray" address={address} to={to} />
		</LabProvider>
	)
}

/** The lab's rooms: every room but Best, which has its own Explore tab. */
const LAB_ROOMS = ROOMS.filter((r) => r.key !== "best")

export const concept: ConceptModule<LabData> = {
	id: "lab",
	name: "Lab",
	tagline:
		"One base (the rooms row, the dials), every other part a slot with variants you pick separately.",
	order: 0,
	Page,
	Panel: LabPanel,
	// Round 7: Best leaves the rooms row for a tab of its own in the Explore row, between Hot and Awards (as on the
	// live site). The rooms row keeps the Movies | Shows control, so there's no pinned row.
	chrome: (props) => ({
		pinned: null,
		tabs: exploreTabs(props.concept, props.address, { bestTab: true }),
	}),
	quickLinks: labQuickLinks,
	notes: (props) => {
		const { data } = props
		const variant = variantOf(data.slot, data.variant)
		type Notes = ReturnType<NonNullable<ConceptModule["notes"]>>
		const page =
			(variant?.notes as ((p: PageViewProps) => Notes) | undefined)?.({
				...props,
				data: data.data,
				lab: labOf(data.picks),
			}) ?? []
		// A part slot's picked variant may explain itself too (listed first: a part's notes are few); it gets no props.
		const parts = slotsFor(props.address)
			.filter((s) => s.group === "part")
			.flatMap((s) => {
				try {
					return (variantOf(s.id, data.picks[s.id])?.notes as (() => Notes) | undefined)?.() ?? []
				} catch {
					return []
				}
			})
		return [...parts, ...page]
	},
}
