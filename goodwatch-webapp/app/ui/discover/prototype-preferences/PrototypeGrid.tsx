// PROTOTYPE - throwaway. Discover's own grid, split where V7's Top rated order changes tier: the tagged titles (the
// original search's matches) by rating, then the broader titles by rating. Each variant marks the boundary its own
// way: A a thin divider, B two shelves, C one grid cell. Under Relevance the order is one blended ranking, so there is
// no boundary; B marks tagged cards instead. A title the person named gets a mark in every variant.
import type { ReactNode } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import type { TitleKey } from "~/utils/title-key"
import { DiscoverGrid } from "../DiscoverGrid"
import type { Readout } from "./model"
import type { PrototypeVariant } from "./usePreferencePrototype"
import { VariantADivider, tagged } from "./VariantA"
import { VariantBMark, VariantBShelf } from "./VariantB"
import { VariantCCell } from "./VariantC"

export function prototypeTierLine(r: Readout | null, key: number): string | null {
	if (!r) return null
	if (r.recognized.includes(key)) return "The title you named."
	if (r.branch !== "positive" || r.catalogue || !r.prefs.length) return null
	return r.original.has(key)
		? `One of the ${r.originalInList.toLocaleString("en")} titles ${tagged(r)}.`
		: `Not tagged ${r.prefs.map((p) => p.label).join(" and ")} in our data; it's here for how it fits your words.`
}

function Named({ on }: { on: boolean }) {
	if (!on) return null
	return (
		<span className="pointer-events-none absolute top-1.5 left-1.5 z-20 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-gray-950">
			You named this
		</span>
	)
}

export function PrototypeGrid({
	on,
	readout: r,
	variant,
	sort,
	strict,
	cards,
	marks,
	flipping,
	children,
}: {
	on: boolean
	readout: Readout | null
	variant: PrototypeVariant
	sort: string
	strict: boolean
	cards: TitleCard[]
	marks: Map<TitleKey, number> | null
	flipping: boolean
	children?: ReactNode
}) {
	if (!on || !r) return <DiscoverGrid cards={cards} marks={marks} flipping={flipping}>{children}</DiscoverGrid>
	const tiers = r.branch === "positive" && !r.catalogue && r.prefs.length > 0 && !strict
	const named = (card: TitleCard) => <Named on={r.recognized.includes(card.key)} />
	if (!tiers || sort !== "top") {
		const badge =
			variant === "B" && tiers
				? (card: TitleCard) => (
						<>
							{named(card)}
							<VariantBMark tagged={r.original.has(card.key)} />
						</>
					)
				: named
		return (
			<DiscoverGrid cards={cards} marks={marks} flipping={flipping} badge={badge}>
				{children}
			</DiscoverGrid>
		)
	}
	const at = cards.findIndex((c) => !r.original.has(c.key))
	const head = at === -1 ? cards : cards.slice(0, at)
	const tail = at === -1 ? [] : cards.slice(at)
	const rest = r.total - r.originalInList
	return (
		<>
			{variant === "B" && head.length > 0 && (
				<VariantBShelf title={`Tagged ${r.prefs.map((p) => p.label).join(" and ")}`} detail={`${r.originalInList.toLocaleString("en")} · by rating`} />
			)}
			{head.length > 0 && (
				<DiscoverGrid cards={head} marks={marks} flipping={flipping} badge={named}>
					{variant === "C" && tail.length > 0 && <VariantCCell r={r} />}
					{tail.length === 0 && children}
				</DiscoverGrid>
			)}
			{tail.length > 0 && (
				<div className="mt-4 lg:mt-5">
					{variant === "A" && head.length > 0 && (
						<div className="mb-4">
							<VariantADivider r={r} count={rest} />
						</div>
					)}
					{variant === "B" && <VariantBShelf title="Also fits your words" detail={`${rest.toLocaleString("en")} · by rating`} />}
					<DiscoverGrid cards={tail} marks={marks} flipping={flipping} badge={named}>
						{children}
					</DiscoverGrid>
				</div>
			)}
		</>
	)
}
