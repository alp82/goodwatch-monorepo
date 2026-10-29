// A pick as a poster chip (picture, name, count, and ×) and a choice's picture and colors: the pieces of the taste
// shelf that show with the picker closed, apart from TasteShelf.tsx so a page can show its picks before the shelf's
// code loads (the start page loads its panel on first use).
import { XMarkIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import { WORD_BY_ID, groupNumber } from "~/domain/taste-picker"
import type { WatchNext } from "~/server/watch-next.server"
import type { MoodControl } from "./MoodPicker"
import { pickName } from "./pick-name"
import { backdropUrl } from "./style"

type Picker = WatchNext["picker"]

/** A taste group with no words that set it apart has no colors of its own. */
const NO_HUE = "#6b7280"

export const choiceOf = (picker: Picker, id: string) =>
	picker.choices.find((c) => c.id === id)
export const groupOf = (picker: Picker, id: string) =>
	picker.groups.find((g) => g.id === id)

/** A choice's colors: a word's own, or a taste group's one or two. */
export function choiceHues(picker: Picker, id: string): string[] {
	if (groupNumber(id) === null) return [WORD_BY_ID[id]?.hue ?? NO_HUE]
	const hues = groupOf(picker, id)?.hues ?? []
	return hues.length ? hues : [NO_HUE]
}

/**
 * A choice's picture: one of its titles' backdrops washed in its color, as the mood tiles have always been. A taste
 * group's wash is split on a diagonal into its two colors (or its one color and a lighter half).
 */
export function ChoiceArt({
	hues,
	path,
	split = false,
	className = "",
}: {
	hues: string[]
	path: string | null
	split?: boolean
	className?: string
}) {
	const [a, b = a] = hues
	return (
		<span
			className={`absolute inset-0 -z-10 overflow-hidden ${className}`}
			aria-hidden
		>
			<span className="absolute inset-0" style={{ background: a }} />
			{path && (
				<img
					src={backdropUrl(path, "w300")}
					alt=""
					loading="lazy"
					className="absolute inset-0 h-full w-full object-cover opacity-85"
				/>
			)}
			<span
				className="absolute inset-0"
				style={{
					background: split
						? `linear-gradient(115deg, ${a}f0 0%, ${a}cc 48%, ${b}${a === b ? "70" : "cc"} 48%, ${b}50 100%)`
						: `linear-gradient(90deg, ${a}f0 0%, ${a}a6 40%, ${a}1f 100%)`,
				}}
			/>
			{/* Scrims behind the name and the count, so white text holds on yellow and on bright pictures. */}
			<span className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-black/35 to-transparent" />
			<span className="absolute inset-0 bg-linear-to-t from-black/70 via-black/15 to-transparent" />
		</span>
	)
}

/** A pick in the strip: picture, name, count, and a button that removes it. The name opens the dropdown. */
export function PickChip({
	control,
	id,
	pinned,
	scrim = false,
	count = true,
}: {
	control: MoodControl
	id: string
	pinned: boolean
	/**
	 * A darker reading layer, for a chip over a bright picture (the start page's room): black under the name (60 % at
	 * the left, 25 % at the right), a firmer text shadow, and darker count and × backings.
	 */
	scrim?: boolean
	/** Whether the chip shows the pick's count. */
	count?: boolean
}) {
	const { picker } = control
	const name = pickName(picker, id)
	const hues = choiceHues(picker, id)
	return (
		<motion.span
			layout
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			className={`relative isolate inline-flex max-w-[22rem] shrink-0 items-center overflow-hidden rounded-xl text-sm font-bold text-white ring-1 ring-white/25 ${scrim ? "[text-shadow:0_1px_2px_rgb(0_0_0/.9),0_0_10px_rgb(0_0_0/.55)]" : "[text-shadow:0_1px_4px_rgba(0,0,0,.6)]"} ${pinned ? "h-8" : "h-9"}`}
			style={{ boxShadow: `0 4px 18px -6px ${hues[0]}` }}
		>
			<ChoiceArt
				hues={hues}
				path={choiceOf(picker, id)?.picture ?? null}
				split={groupNumber(id) !== null}
			/>
			{scrim && (
				<span
					aria-hidden
					className="absolute inset-0 -z-10 bg-linear-to-r from-black/60 via-black/45 to-black/25"
				/>
			)}
			<button
				type="button"
				data-moodbutton
				aria-haspopup="dialog"
				aria-expanded={control.open}
				onClick={() => control.setOpen(!control.open)}
				className="inline-flex h-full min-w-0 cursor-pointer items-center gap-2 pl-2.5 pr-1"
			>
				<span className="truncate">{name}</span>
				{count && (
					<span
						className={`shrink-0 rounded-md px-1 text-xs tabular-nums ${scrim ? "bg-black/45" : "bg-black/30"}`}
					>
						{choiceOf(picker, id)?.count ?? 0}
					</span>
				)}
			</button>
			<button
				type="button"
				aria-label={`Remove ${name}`}
				onClick={() => control.toggle(id)}
				className={`mr-1.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full ${scrim ? "bg-black/40 hover:bg-black/60" : "bg-black/25 hover:bg-black/50"}`}
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</motion.span>
	)
}
