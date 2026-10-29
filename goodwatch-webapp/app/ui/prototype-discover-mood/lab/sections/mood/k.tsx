// PROTOTYPE (Discover lab, mood k): two views in one panel, the same recipe line over both. Mixes: e's big cards with
// AND counts (a ready mix sets its picks and moves you on to Choose). Choose: i's AND columns. Round 13: each column's
// "all of" / "any of" toggle (and.ts). Round 14: no removal tiles, the cards fill the grid. Round 21: the two views
// are Mood's sub-tabs in the shell's header row (props.moodView), so the recipe row holds only the picks.
import { motion } from "framer-motion"
import type { SectionProps } from "../../types"
import { AndColumns, MixCards, RecipeRow, useAnd, useCards } from "./andview"
import { useWorldArt } from "./parts"

export function MoodK({ d, phone, viewer, moodView = "mixes", onMoodView }: SectionProps) {
	const a = useAnd(d)
	const art = useWorldArt()
	const { cards, drops } = useCards(d, a, viewer, phone ? 6 : 8, phone ? 2 : 4, () => onMoodView?.("choose"), false)
	const body = (
		<motion.div
			initial={{ opacity: 0, x: moodView === "choose" ? 16 : -16 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.16 }}
			className={phone ? "" : "flex min-h-0 flex-1 flex-col"}
		>
			{moodView === "mixes" ? (
				<MixCards
					d={d}
					cards={cards}
					drops={drops}
					art={art}
					cols={phone ? 2 : 4}
					rows={phone ? "grid-rows-[5.5rem_5.5rem_5.5rem]" : "grid-rows-[10.75rem_10.75rem]"}
				/>
			) : (
				<AndColumns a={a} phone={phone} />
			)}
		</motion.div>
	)
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<RecipeRow d={d} a={a} phone />
				{body}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col gap-3 px-6 py-3">
			<RecipeRow d={d} a={a} phone={false} />
			{body}
		</div>
	)
}
