// PROTOTYPE - throwaway (prototype/explore-r7). Tropes index, variant "Trope cards": the named indexes stay (the
// owner likes them), but each trope is a card with feeling instead of a line in a list: its color as light, a fan of
// its best-known titles, the name, our one-liner, and a short real write-up as a teaser. One rail per index, the
// spotlight up front, "Surprise me" swaps it in place.
import { kindNoun } from "../../../../kit/address"
import { FOCUS, WRAP } from "../../../../kit/ui"
import { QUICK_T } from "../../../../kit/ui/motion"
import { RowArrows, useStepRow } from "~/ui/row-arrows"
import type { PageViewProps, SlotVariant } from "../../contract"
import type { GroupBlock, TropesIndexData } from "./model"
import { TropeCard } from "./parts"
import { Feature, IndexHead, Surprise, tropeHref, useSpotlight } from "./shared"

type Props = PageViewProps<TropesIndexData>

function Rail({
	g,
	to,
	kind,
	noun,
}: {
	g: GroupBlock
	to: Props["to"]
	kind: Props["address"]["kind"]
	noun: string
}) {
	const row = useStepRow<HTMLUListElement>([g.tropes.length])
	return (
		<section id={`index-${g.id}`} aria-labelledby={`index-${g.id}-name`} className="scroll-mt-32">
			<header className="flex items-end justify-between gap-4">
				<div className="flex items-start gap-3">
					<span
						aria-hidden
						className="mt-2 h-3 w-3 shrink-0 rounded-[3px]"
						style={{ background: g.color }}
					/>
					<div>
						<h2 id={`index-${g.id}-name`} className="font-display text-2xl font-bold text-white">
							{g.name}
						</h2>
						<p className="mt-0.5 text-[15px] text-gray-400">{g.line}</p>
					</div>
				</div>
				<RowArrows row={row} label={`tropes in ${g.name}`} />
			</header>
			<ul
				ref={row.ref}
				onScroll={row.measure}
				className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 sm:gap-4"
			>
				{g.tropes.map((t) => (
					<li key={t.id} className="w-[15.5rem] shrink-0 snap-start sm:w-[16.5rem]">
						<TropeCard t={t} href={tropeHref(to, kind, t.slug)} noun={noun} />
					</li>
				))}
			</ul>
		</section>
	)
}

function View({ data, address, to }: Props) {
	const kind = address.kind
	const noun = kindNoun(kind)
	const spot = useSpotlight(data)
	return (
		<div className={`${WRAP} pt-6 pb-24 sm:pt-10`}>
			<IndexHead
				data={data}
				noun={noun}
				action={spot.can ? <Surprise onPick={spot.next} /> : undefined}
			/>
			{spot.t && (
				<div className="mt-8">
					<Feature t={spot.t} to={to} kind={kind} />
				</div>
			)}
			<nav
				aria-label="Indexes"
				className="-mx-4 mt-10 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0"
			>
				<ul className="flex gap-1.5 sm:flex-wrap">
					{data.groups.map((g) => (
						<li key={g.id}>
							<a
								href={`#index-${g.id}`}
								className={`flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-gray-200 ring-1 ring-white/10 ${QUICK_T} hover:bg-white/10 hover:text-white ${FOCUS}`}
							>
								<span
									aria-hidden
									className="h-2 w-2 rounded-[2px]"
									style={{ background: g.color }}
								/>
								{g.name}
							</a>
						</li>
					))}
				</ul>
			</nav>
			<div className="mt-8 space-y-14">
				{data.groups.map((g) => (
					<Rail key={g.id} g={g} to={to} kind={kind} noun={noun} />
				))}
			</div>
		</div>
	)
}

export const variant: SlotVariant<TropesIndexData> = {
	id: "cards",
	name: "Trope cards",
	what: "The named indexes as rails of trope cards: each card is the trope's color, a fan of its best-known titles, our one-liner, and a real write-up as a teaser. A trope in the spotlight up front; Surprise me swaps it in place.",
	order: 1,
	View,
	notes: () => [
		{
			term: "Trope",
			means:
				"A named storytelling device, as TV Tropes catalogs them. The titles that carry one come from the per-title trope rows production already reads; the one-liners are ours.",
		},
		{
			term: "Teaser",
			means: "The first short write-up among the trope's best-known titles that hides no spoilers.",
			isNew: true,
		},
	],
}
