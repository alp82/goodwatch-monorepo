// PROTOTYPE - throwaway. Discover's own grid. Under Top rated, V7's order has two tiers: the titles tagged with what the
// words were read as (the original search's matches) by rating, then the broader titles by rating. A thin divider marks
// where the first tier ends. Under Relevance the order is one blended ranking, so there is no boundary. A title the
// person named gets a small mark.
import type { ReactNode } from "react"
import type { TitleCard } from "~/server/title-cards.server"
import type { TitleKey } from "~/utils/title-key"
import { DiscoverGrid } from "../DiscoverGrid"
import type { Readout } from "./model"

export const tagged = (r: Readout) =>
	r.prefs.length ? `tagged ${r.prefs.map((p) => p.label).join(" and ")}` : "from the tighter reading"

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
	sort,
	cards,
	marks,
	flipping,
	children,
}: {
	on: boolean
	readout: Readout | null
	sort: string
	cards: TitleCard[]
	marks: Map<TitleKey, number> | null
	flipping: boolean
	children?: ReactNode
}) {
	if (!on || !r) return <DiscoverGrid cards={cards} marks={marks} flipping={flipping}>{children}</DiscoverGrid>
	const named = (card: TitleCard) => <Named on={r.recognized.includes(card.key)} />
	const tiers = r.branch === "positive" && !r.catalogue && r.prefs.length > 0
	if (!tiers || sort !== "top")
		return (
			<DiscoverGrid cards={cards} marks={marks} flipping={flipping} badge={named}>
				{children}
			</DiscoverGrid>
		)
	const at = cards.findIndex((c) => !r.original.has(c.key))
	const head = at === -1 ? cards : cards.slice(0, at)
	const tail = at === -1 ? [] : cards.slice(at)
	return (
		<>
			{head.length > 0 && (
				<DiscoverGrid cards={head} marks={marks} flipping={flipping} badge={named}>
					{tail.length === 0 && children}
				</DiscoverGrid>
			)}
			{tail.length > 0 && (
				<div className="mt-4 lg:mt-5">
					{head.length > 0 && (
						<div className="mb-4 flex items-center gap-3 text-[12px] text-gray-400" role="separator">
							<span className="h-px flex-1 bg-white/10" />
							<span>
								Above: {r.originalInList.toLocaleString("en")} {tagged(r)}. Below: more that fit your words. Both by rating.
							</span>
							<span className="h-px flex-1 bg-white/10" />
						</div>
					)}
					<DiscoverGrid cards={tail} marks={marks} flipping={flipping} badge={named}>
						{children}
					</DiscoverGrid>
				</div>
			)}
		</>
	)
}
