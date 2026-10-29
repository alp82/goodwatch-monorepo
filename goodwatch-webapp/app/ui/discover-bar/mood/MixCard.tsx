// A Combos card: My movies' picture tile (TasteShelf's ChoiceArt, split into the two tags' colors) with its name, a
// tick when on, "Like <title>" and the count. A "+ X" card adds a share bar of what it keeps.
import { CheckIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { ChoiceArt } from "~/ui/watch-next/TasteShelf"

function Tick({ on }: { on: boolean }) {
	return (
		<span
			className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-white text-black" : "bg-black/30 ring-1 ring-white/50"}`}
			aria-hidden
		>
			{on && <CheckIcon className="h-3.5 w-3.5" />}
		</span>
	)
}

export function MixCard({
	name,
	hues,
	path,
	on,
	line,
	foot,
	share,
	small,
	onClick,
}: {
	name: string
	hues: string[]
	path: string | null
	on: boolean
	line: string | null
	/** The count line; empty for none. */
	foot: string
	/** "+ X": the share of the list it keeps, 0 to 1. */
	share: number | null
	/** Phones: the shorter card. */
	small: boolean
	onClick: () => void
}) {
	return (
		<motion.button
			type="button"
			// biome-ignore lint/a11y/useSemanticElements: a picture tile that toggles; the button carries the checkbox role
			role="checkbox"
			aria-checked={on}
			aria-label={[name, line, foot].filter(Boolean).join(". ")}
			onClick={onClick}
			whileTap={{ scale: 0.97 }}
			className={`group relative isolate flex h-full w-full min-w-0 cursor-pointer flex-col justify-between overflow-hidden rounded-xl text-left text-white transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${small ? "p-2" : "p-2.5"} ${on ? "ring-2 ring-white" : "ring-1 ring-white/10"}`}
			style={{ boxShadow: on ? `0 8px 28px -8px ${hues[0]}` : undefined }}
		>
			<ChoiceArt
				hues={hues}
				path={path}
				split={hues.length > 1}
				className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
			/>
			<span className="flex items-start justify-between gap-2">
				<span
					className={`min-w-0 break-words font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)] ${small ? "line-clamp-2 text-[13px]" : "line-clamp-2 text-[15px]"}`}
				>
					{name}
				</span>
				<Tick on={on} />
			</span>
			{(line || foot) && (
				<span
					className={`block min-w-0 [text-shadow:0_1px_4px_rgba(0,0,0,.8)] ${share !== null ? "pb-1.5" : ""}`}
				>
					{line && (
						<span className="line-clamp-1 text-xs leading-snug text-white/90">
							{line}
						</span>
					)}
					{foot && (
						<span className="mt-0.5 block truncate text-[11px] font-semibold text-white/75 tabular-nums">
							{foot}
						</span>
					)}
				</span>
			)}
			{share !== null && (
				<span
					className="pointer-events-none absolute inset-x-2.5 bottom-1.5 h-[3px] overflow-hidden rounded-full bg-white/15"
					aria-hidden
				>
					<span
						className="block h-full w-full origin-left rounded-full bg-white/80 transition-transform duration-300 motion-reduce:transition-none"
						style={{ transform: `scaleX(${Math.min(1, share)})` }}
					/>
				</span>
			)}
		</motion.button>
	)
}

/** A card's place while the mixes are on their way: the same size, no content. */
export function MixCardSlot() {
	return (
		<span
			className="block h-full w-full rounded-xl bg-white/[0.04] ring-1 ring-white/[0.06]"
			aria-hidden
		/>
	)
}
