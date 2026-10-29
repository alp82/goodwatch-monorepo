// Everything's columns: the filter sheet's group heading (accent bar, name, pick count) with the "all of" / "any of"
// switch, over 26 px rows (color dot, share bar, count, a cross when picked). Rows glide to their new place when the
// order changes; bars move by scaleX only.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { useId } from "react"
import type { TagGroup } from "~/domain/filter-state"
import { radioKeys } from "~/ui/filter-bar/controls"
import { FILTER_ACCENTS, compactCount } from "~/ui/filter-bar/labels"
import type { Mode, MoodRow } from "./mood-model"

const SPRING = { type: "spring", stiffness: 500, damping: 40 } as const

const CAP_NOUNS: Record<TagGroup, string> = {
	moods: "moods",
	themes: "themes",
	styles: "styles",
	genres: "genres",
}

export function ColumnHead({
	group,
	label,
	picked,
	cap,
	refusedAt,
	mode,
	onMode,
}: {
	group: TagGroup
	label: string
	picked: number
	cap: number
	/** When a pick past the cap was last refused (0: never), to nudge the count. */
	refusedAt: number
	mode: Mode
	onMode: (mode: Mode) => void
}) {
	const full = picked >= cap
	return (
		<header className="flex h-8 shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-1">
			<span
				className={`h-3.5 w-1 shrink-0 rounded-full ${FILTER_ACCENTS[group].bar}`}
				aria-hidden
			/>
			<h3 className="text-[15px] font-bold text-white">{label}</h3>
			{picked > 0 && (
				<motion.span
					key={refusedAt}
					initial={refusedAt ? { x: -4 } : false}
					animate={{ x: 0 }}
					transition={{ type: "spring", stiffness: 900, damping: 12 }}
					className={`rounded-full px-2 text-xs font-bold tabular-nums ${full ? "bg-amber-400/15 text-amber-300" : "bg-white/10 text-white"}`}
				>
					{full ? `${picked} of ${cap}` : picked}
					<span className="sr-only">
						{full ? ` ${CAP_NOUNS[group]} picked, the most` : " picked"}
					</span>
				</motion.span>
			)}
			<span className="ml-auto shrink-0">
				<ModeSwitch label={label} mode={mode} onChange={onMode} />
			</span>
		</header>
	)
}

/** How a column's picks join: all of (each pick) or any of. */
function ModeSwitch({
	label,
	mode,
	onChange,
}: {
	label: string
	mode: Mode
	onChange: (mode: Mode) => void
}) {
	const id = useId()
	return (
		<span
			role="radiogroup"
			aria-label={`${label}: how picks combine`}
			onKeyDown={(event) =>
				radioKeys(event, (index) => onChange(index === 0 ? "all" : "any"))
			}
			className="flex h-6 items-center rounded-full bg-white/[0.05] p-0.5"
		>
			{(
				[
					["all", "all of"],
					["any", "any of"],
				] as const
			).map(([value, text]) => {
				const on = mode === value
				return (
					<button
						key={value}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a two-way switch; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						tabIndex={on ? 0 : -1}
						onClick={() => onChange(value)}
						className={`relative h-5 cursor-pointer rounded-full px-2 text-[11px] font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "text-white" : "text-gray-500 hover:text-gray-200"}`}
					>
						{on && (
							<motion.span
								layoutId={`mood-mode-${id}`}
								transition={SPRING}
								className="absolute inset-0 rounded-full bg-white/[0.16]"
							/>
						)}
						<span className="relative">{text}</span>
					</button>
				)
			})}
		</span>
	)
}

/** A bar of how much a row leaves, scaled against the column's measure. */
function ShareBar({
	n,
	of,
	hue,
	on,
}: { n: number | null; of: number; hue: string; on: boolean }) {
	if (n === null || of <= 0) return null
	return (
		<span
			className="absolute inset-y-0 left-0 w-full origin-left rounded-md transition-transform duration-300 ease-out motion-reduce:transition-none"
			style={{
				transform: `scaleX(${Math.min(1, n / of)})`,
				background: `${hue}${on ? "45" : "24"}`,
			}}
			aria-hidden
		/>
	)
}

export function ColumnRows({
	rows,
	of,
	phone,
	onToggle,
}: {
	rows: readonly MoodRow[]
	of: number
	phone: boolean
	onToggle: (row: MoodRow) => void
}) {
	return (
		<ul
			className={
				phone
					? "grid grid-cols-2 gap-x-2 gap-y-0.5"
					: "flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain pr-0.5 [scrollbar-width:thin]"
			}
		>
			{rows.map((row) => (
				<motion.li
					key={row.id}
					layout="position"
					transition={SPRING}
					className="shrink-0"
				>
					<motion.button
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a row that toggles; the button carries the checkbox role
						role="checkbox"
						aria-checked={row.on}
						aria-disabled={row.dead || undefined}
						aria-label={`${row.name}${row.n !== null ? `, ${row.n.toLocaleString("en")} titles${row.on ? " after removing" : ""}` : ""}`}
						onClick={() => onToggle(row)}
						whileTap={row.dead ? undefined : { scale: 0.98 }}
						className={`relative flex h-[26px] w-full shrink-0 items-center gap-2 overflow-hidden rounded-md px-2 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
							row.on
								? "cursor-pointer bg-white/[0.12] font-semibold text-white ring-1 ring-white/40"
								: row.dead
									? "cursor-default text-gray-600"
									: "cursor-pointer text-gray-200 hover:bg-white/[0.06]"
						}`}
					>
						{!row.dead && (
							<ShareBar n={row.n} of={of} hue={row.hue} on={row.on} />
						)}
						<span
							className="relative h-2 w-2 shrink-0 rounded-full"
							style={{ background: row.hue, opacity: row.dead ? 0.4 : 1 }}
						/>
						<span className="relative min-w-0 flex-1 truncate">{row.name}</span>
						<span className="relative flex shrink-0 items-center gap-1 text-[11px] text-gray-400 tabular-nums">
							{row.n !== null ? compactCount(row.n) : null}
							{row.on && (
								<XMarkIcon className="h-3.5 w-3.5 text-white/80" aria-hidden />
							)}
						</span>
					</motion.button>
				</motion.li>
			))}
		</ul>
	)
}
