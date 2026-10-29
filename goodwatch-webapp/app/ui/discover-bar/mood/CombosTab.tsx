// Mood, Combos: a grid of mix cards that always fills (desktop 4 by 2, phones 2 by 3). Nothing picked: the ready mixes,
// each with its count and top title. A ready mix sets its picks and moves on to Everything. With picks, "+ X" cards
// (what each unpicked mood, theme or style keeps of the list) lead, then the ready mixes.
import { motion } from "framer-motion"
import type { SubTabView } from "../DiscoverControls"
import { MixCard, MixCardSlot } from "./MixCard"
import {
	type ComboCard,
	applyMix,
	comboCards,
	hasMoodPicks,
} from "./mood-model"
import { useMixes, useMoodTab, useTagArt } from "./useMoodData"

const LAYOUT = {
	desktop: { slots: 8, cols: 4, rows: "grid-rows-[10.75rem_10.75rem]" },
	phone: { slots: 6, cols: 2, rows: "grid-rows-[5.5rem_5.5rem_5.5rem]" },
}

const footOf = (card: ComboCard) =>
	card.n === null
		? ""
		: `${card.n.toLocaleString("en")} ${card.share !== null ? "left" : card.n === 1 ? "title" : "titles"}`

export function CombosTab({ view }: { view: SubTabView }) {
	const layout = view.phone ? LAYOUT.phone : LAYOUT.desktop
	const tab = useMoodTab(view)
	const mixes = useMixes(view)
	const { state } = view.filters
	const picked = hasMoodPicks(state)
	const art = useTagArt(view.member, picked)
	const cards = mixes
		? comboCards({
				mixes,
				rows: Object.values(tab.rows).flat(),
				state,
				total: tab.inputs.total,
				searching: Boolean(view.query?.trim()),
				slots: layout.slots,
			})
		: null
	const tap = (card: ComboCard) => {
		if (card.option) return tab.toggle(card.option)
		if (!card.mix) return
		const mix = card.mix
		const on = card.on
		view.filters.update((current) => applyMix(current, mix, tab.prefs))
		if (!on) view.open("mood", "everything")
	}
	return (
		<div className={view.phone ? "" : "h-full px-5 py-3"}>
			<div
				className={`grid gap-2 ${layout.rows}`}
				style={{
					gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
				}}
			>
				{cards
					? cards.map((card, i) => (
							<motion.div
								key={card.id}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.18, delay: i * 0.02 }}
								className="flex min-w-0"
							>
								<MixCard
									name={card.name}
									hues={card.hues}
									path={card.path ?? art(card.island)}
									on={card.on}
									line={card.line}
									foot={footOf(card)}
									share={card.share}
									small={view.phone}
									onClick={() => tap(card)}
								/>
							</motion.div>
						))
					: Array.from({ length: layout.slots }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
							<MixCardSlot key={i} />
						))}
			</div>
		</div>
	)
}
