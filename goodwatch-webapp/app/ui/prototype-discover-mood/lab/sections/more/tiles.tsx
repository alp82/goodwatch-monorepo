// PROTOTYPE (Discover lab, round 17): the tile and chip the more section's d, e and f variants share. a's Tile with a
// top row for a picture (glyph or posters) and the count, and an optional layer behind (e's washes). The label keeps
// one weight in both states and the count stays put, so picking never moves anything.
import { motion } from "framer-motion"
import type { CSSProperties, ReactNode } from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"

export type TileState = { active: boolean; dead: boolean }

/** The default picture color: gray at rest, amber when picked, faint when dead. */
export const artTone = ({ active, dead }: TileState) => (active ? "text-amber-600" : dead ? "text-gray-700" : "text-gray-400 group-hover:text-gray-300")

export function RichTile({
	label,
	sub,
	count,
	active,
	onClick,
	art,
	artH = "h-4",
	layer,
	tinted = false,
	style,
	subStyle,
	countStyle,
}: {
	label: string
	sub?: string
	count: number | null
	active: boolean
	onClick: () => void
	/** The top row's left: a glyph or posters (a function gets the tile's state). Without it the count sits by the label, as in a. */
	art?: ReactNode | ((s: TileState) => ReactNode)
	/** The top row's height (the art reserves it before it loads). */
	artH?: string
	/** Painted behind the content (e's washes); the tile's own fill then stays faint. */
	layer?: ReactNode
	/** No white fill when picked: the layer carries it. */
	tinted?: boolean
	style?: CSSProperties
	subStyle?: CSSProperties
	countStyle?: CSSProperties
}) {
	const dead = !active && count === 0
	const s = { active, dead }
	const fill = tinted
		? `${dead ? "bg-white/[0.015]" : "bg-white/[0.03] hover:bg-white/[0.06]"} ${active ? "text-gray-950" : dead ? "text-gray-600" : "text-gray-100"}`
		: active
			? "bg-white text-gray-950"
			: dead
				? "bg-white/[0.02] text-gray-600"
				: "bg-white/[0.06] text-gray-100 hover:bg-white/[0.11]"
	const num = count != null && (
		<span className={`ml-auto shrink-0 self-start text-[11px] tabular-nums ${active ? "text-gray-600" : "text-gray-500"}`} style={active ? undefined : countStyle}>
			{compactCount(count)}
		</span>
	)
	return (
		<motion.button
			type="button"
			aria-pressed={active}
			whileTap={TAP}
			onClick={onClick}
			style={style}
			className={`group relative isolate flex min-w-0 flex-col items-start gap-1.5 overflow-hidden rounded-xl px-3 py-2.5 text-left outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400 ${fill}`}
		>
			{layer}
			{art != null && (
				<span className={`flex w-full items-center gap-2 ${artH}`}>
					<span className={`flex min-w-0 items-center ${artTone(s)}`}>{typeof art === "function" ? art(s) : art}</span>
					{num}
				</span>
			)}
			<span className="flex w-full flex-col gap-0.5">
				{art != null ? (
					<span className="text-[14px] leading-tight font-semibold">{label}</span>
				) : (
					<span className="flex w-full items-baseline gap-2">
						<span className="text-[14px] leading-tight font-semibold">{label}</span>
						{num}
					</span>
				)}
				{sub && (
					<span className={`text-[12px] ${active ? "text-gray-600" : "text-gray-500"}`} style={active ? undefined : subStyle}>
						{sub}
					</span>
				)}
			</span>
		</motion.button>
	)
}

/** a's CountChip with a mark before the label (Status). */
export function MarkChip({ label, mark, count, active, onClick }: { label: string; mark: ReactNode; count: number | null; active: boolean; onClick: () => void }) {
	const dead = !active && count === 0
	return (
		<motion.button
			type="button"
			aria-pressed={active}
			whileTap={TAP}
			onClick={onClick}
			className={`group flex h-8 items-center gap-1.5 rounded-full pr-3 pl-2.5 text-[13px] font-medium whitespace-nowrap cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				active ? "bg-white text-gray-950" : dead ? "bg-white/[0.02] text-gray-600" : "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
			}`}
		>
			<span className={artTone({ active, dead })}>{mark}</span>
			{label}
			{count != null && <span className={`text-[11px] tabular-nums ${active ? "text-gray-600" : "text-gray-500"}`}>{compactCount(count)}</span>}
		</motion.button>
	)
}
