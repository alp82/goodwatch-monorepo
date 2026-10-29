// PROTOTYPE (Discover lab, mood k): two views in one panel, the same recipe line over both. Mixes: e's big cards with
// AND counts (a ready mix sets its picks and moves you on to Choose). Choose: i's AND columns. The switch sits on the
// recipe row, so you can go back and forth.
import { AnimatePresence, motion } from "framer-motion"
import { useState } from "react"
import { Segmented } from "~/ui/filter-bar/SheetControls"
import type { SectionProps } from "../../types"
import { AndColumns, MixCards, RecipeRow, useAnd, useCards } from "./andview"
import { useWorldArt } from "./parts"

type View = "mixes" | "choose"

export function MoodK({ d, phone, find, viewer }: SectionProps) {
	const a = useAnd(d)
	const art = useWorldArt()
	const [view, setView] = useState<View>(a.picks.length || a.m.used ? "choose" : "mixes")
	const cards = useCards(d, a, viewer, phone ? 6 : 8, () => setView("choose"))
	const shown: View = find?.results ? "choose" : view
	const toggle = (
		<div className={phone ? "" : "w-[168px] shrink-0"}>
			<Segmented<View>
				label="Mixes or choose"
				options={[
					{ id: "mixes", label: "Mixes" },
					{ id: "choose", label: "Choose" },
				]}
				value={shown}
				onChange={setView}
				small={!phone}
			/>
		</div>
	)
	const body = (
		<AnimatePresence mode="wait" initial={false}>
			<motion.div
				key={shown}
				initial={{ opacity: 0, x: shown === "choose" ? 16 : -16 }}
				animate={{ opacity: 1, x: 0 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.16 }}
				className={phone ? "" : "flex min-h-0 flex-1 flex-col"}
			>
				{shown === "mixes" ? (
					<MixCards d={d} cards={cards} art={art} cols={phone ? "grid-cols-2" : "grid-cols-4"} tile={phone ? "h-[5.5rem]" : "h-[10.75rem]"} />
				) : (
					<AndColumns a={a} find={find} phone={phone} />
				)}
			</motion.div>
		</AnimatePresence>
	)
	if (phone)
		return (
			<div className="flex flex-col gap-4">
				<RecipeRow d={d} a={a} find={find} phone right={toggle} />
				{body}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col gap-3 px-6 py-3">
			<RecipeRow d={d} a={a} find={find} phone={false} right={toggle} />
			{body}
		</div>
	)
}
