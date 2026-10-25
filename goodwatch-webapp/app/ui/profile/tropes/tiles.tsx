// The filter bar's pictures, in My movies' look: a choice as a picture tile (TasteShelf's ChoiceArt washed in the
// choice's color, name, tick, count line), a pick as a removable chip, and a small fan of genre colors.
import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid"
import { motion } from "framer-motion"
import { ChoiceArt } from "~/ui/watch-next/TasteShelf"
import type { Choice } from "./useTropeFacets"

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

/** One choice as a picture tile; `radio` for single-choice facets. `className` sets the size. */
export function FacetTile({
	c,
	radio = false,
	line,
	foot = `${c.count} ${c.count === 1 ? "title" : "titles"}`,
	className = "h-[6.5rem]",
}: {
	c: Choice
	radio?: boolean
	/** Under the name, above the count. */
	line?: string
	/** The last line; the count by default. */
	foot?: string
	className?: string
}) {
	const none = !c.on && c.count === 0
	return (
		<motion.button
			type="button"
			role={radio ? "radio" : "checkbox"}
			aria-checked={c.on}
			aria-label={`${c.label}. ${line ? `${line}. ` : ""}${foot}`}
			onClick={c.toggle}
			whileTap={{ scale: 0.97 }}
			className={`group relative isolate flex shrink-0 cursor-pointer flex-col justify-between overflow-hidden rounded-xl p-2.5 text-left text-white transition-[opacity,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${c.on ? "ring-2 ring-white" : "ring-1 ring-white/10"} ${none ? "opacity-40" : ""} ${className}`}
			style={{ boxShadow: c.on ? `0 8px 28px -8px ${c.hue}` : undefined }}
		>
			<ChoiceArt
				hues={[c.hue]}
				path={c.picture}
				className="transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
			/>
			<span className="flex items-start justify-between gap-2">
				<span className="line-clamp-2 text-[15px] font-bold leading-tight [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
					{c.label}
				</span>
				<Tick on={c.on} />
			</span>
			<span className="block min-w-0 [text-shadow:0_1px_4px_rgba(0,0,0,.8)]">
				{line && (
					<span className="line-clamp-2 text-xs leading-snug text-white/90">
						{line}
					</span>
				)}
				{foot && (
					<span className="mt-0.5 block truncate text-[11px] font-semibold text-white/75 tabular-nums">
						{foot}
					</span>
				)}
			</span>
		</motion.button>
	)
}

/** A pick as a chip: picture, name, count, and × to remove it. 44 px below the desktop breakpoint, 36 from lg on. */
export function FacetChip({ c }: { c: Choice }) {
	return (
		<motion.span
			layout="position"
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			className="relative isolate inline-flex h-11 max-w-[16rem] shrink-0 items-center overflow-hidden rounded-xl text-sm font-bold text-white ring-1 ring-white/25 [text-shadow:0_1px_4px_rgba(0,0,0,.6)] lg:h-9"
			style={{ boxShadow: `0 4px 18px -6px ${c.hue}` }}
		>
			<ChoiceArt hues={[c.hue]} path={c.picture} />
			<span className="truncate pl-2.5 pr-1">{c.label}</span>
			<span className="shrink-0 rounded-md bg-black/30 px-1 text-xs tabular-nums">
				{c.count}
			</span>
			<button
				type="button"
				aria-label={`Remove ${c.label}`}
				onClick={c.toggle}
				className="ml-0.5 flex h-full w-11 shrink-0 cursor-pointer items-center justify-center hover:bg-black/30 lg:w-8"
			>
				<XMarkIcon className="h-4 w-4" />
			</button>
		</motion.span>
	)
}

/** A small fan of colors: the genre picks, or the most common genres with none picked. */
export function Fan({ hues, dim = false }: { hues: string[]; dim?: boolean }) {
	return (
		<span className="flex -space-x-2" aria-hidden>
			{hues.slice(0, 4).map((hue, i) => (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: two genres can share a color
					key={i}
					className="h-6 w-6 rounded-full ring-2 ring-gray-900"
					style={{ background: hue, opacity: dim ? 0.6 : 1 }}
				/>
			))}
		</span>
	)
}
