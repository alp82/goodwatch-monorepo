// The Filters sheet's controls: the chip, a trimmed chip list with "+N more", the segmented control, the "and up"
// bar, the two-thumb range slider, and the search field with its spinner and labeled Clear. They know nothing of the
// filter state; the cards in FilterCards.tsx wire them up.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type RefObject, useEffect, useState } from "react"
import { compactCount } from "./labels"
import { TAP } from "./motion"

/** One choice: what it shows and what tapping it does. */
export interface Option {
	id: string
	label: string
	active: boolean
	/** What tapping it would leave; null when unknown. */
	count: number | null
	toggle: () => void
	swatch?: React.ReactNode
	/** Shown dimmed and can't be tapped. */
	disabled?: boolean
}

/** The calm chip: 32 px, the count quiet, white when on. */
export function Chip({ o, img }: { o: Option; img?: string | null }) {
	const dead = o.disabled || (!o.active && o.count === 0)
	return (
		<motion.button
			type="button"
			aria-pressed={o.active}
			aria-disabled={o.disabled || undefined}
			whileTap={o.disabled ? undefined : TAP}
			onClick={() => !o.disabled && o.toggle()}
			className={`flex h-8 items-center gap-1.5 rounded-full text-[13px] whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${img !== undefined ? "pr-3 pl-1" : "px-3"} ${o.disabled ? "cursor-not-allowed" : "cursor-pointer"} ${
				o.active
					? "bg-white font-semibold text-gray-950"
					: dead
						? "bg-white/[0.02] text-gray-600"
						: "bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
			}`}
		>
			{img !== undefined &&
				(img ? (
					<img src={img} alt="" className="h-6 w-6 rounded-full object-cover" />
				) : (
					<span className="h-6 w-6 rounded-full bg-white/10" />
				))}
			{o.swatch}
			{o.label}
			{!o.active && o.count !== null && (
				<span className="text-[11px] tabular-nums text-gray-500">
					{compactCount(o.count)}
				</span>
			)}
		</motion.button>
	)
}

export function More({
	hidden,
	open,
	onClick,
	label,
}: { hidden: number; open: boolean; onClick: () => void; label?: string }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-expanded={open}
			className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium text-amber-300/90 cursor-pointer outline-none hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			{open ? "Show fewer" : (label ?? `+${hidden} more`)}
		</button>
	)
}

/** Active first, then most titles, then the dead ones. */
export const byCount = (options: Option[]) =>
	[...options].sort(
		(a, b) =>
			Number(b.active) - Number(a.active) ||
			Number(b.count !== 0) - Number(a.count !== 0) ||
			(b.count ?? 0) - (a.count ?? 0),
	)

/** Chips trimmed to `limit` (active ones always show) with "+N more". */
export function ChipList({
	options,
	limit = 99,
	sort = false,
}: { options: Option[]; limit?: number; sort?: boolean }) {
	const [open, setOpen] = useState(false)
	const list = sort
		? byCount(options)
		: [...options].sort((a, b) => Number(b.active) - Number(a.active))
	const keep = Math.max(limit, list.filter((o) => o.active).length)
	const hidden = list.length - keep
	const shown = open || hidden <= 1 ? list : list.slice(0, keep)
	return (
		<div className="flex flex-wrap gap-1.5">
			{shown.map((o) => (
				<Chip key={o.id} o={o} />
			))}
			{hidden > 1 && (
				<More hidden={hidden} open={open} onClick={() => setOpen(!open)} />
			)}
		</div>
	)
}

/** A segmented control: one track, the chosen segment white. */
export function Segmented<T extends string>({
	value,
	options,
	onChange,
	small = false,
	label,
}: {
	value: T
	options: { id: T; label: string; count?: number | null }[]
	onChange: (v: T) => void
	small?: boolean
	label: string
}) {
	return (
		<div
			role="radiogroup"
			aria-label={label}
			className={`grid flex-1 auto-cols-fr grid-flow-col rounded-xl bg-white/[0.05] p-0.5 ${small ? "h-8" : "h-10"}`}
		>
			{options.map((o) => {
				const on = o.id === value
				return (
					<button
						key={o.id}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a segmented control or "and up" scale; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						onClick={() => onChange(o.id)}
						className={`relative flex min-w-0 items-center justify-center gap-1.5 rounded-[10px] px-2 whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${small ? "text-xs" : "text-[13px]"} ${on ? "font-semibold text-gray-950" : "text-gray-300 hover:bg-white/[0.05] hover:text-white"}`}
					>
						{on && (
							<motion.span
								layoutId={`seg-${label}`}
								transition={{ type: "spring", stiffness: 500, damping: 40 }}
								className="absolute inset-0 rounded-[10px] bg-white"
							/>
						)}
						<span className="relative truncate">{o.label}</span>
						{!on && o.count != null && (
							<span className="relative text-[11px] tabular-nums text-gray-500">
								{compactCount(o.count)}
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}

/** "And up" as a bar: every segment from the chosen one to the right lit. */
export function ThresholdBar({
	steps,
	value,
	onChange,
	color,
	label,
	disabled,
	counts,
}: {
	steps: { v: number; label: string }[]
	value: number | null
	onChange: (v: number) => void
	color: (v: number) => string
	label: string
	disabled?: boolean
	counts?: (v: number) => number | null
}) {
	const at = Math.max(
		0,
		steps.findIndex((s) => s.v === value),
	)
	return (
		<div
			role="radiogroup"
			aria-label={label}
			className={`grid auto-cols-fr grid-flow-col gap-1 ${disabled ? "opacity-40" : ""}`}
		>
			{steps.map((s, i) => {
				const lit = value !== null && i >= at && value !== 0
				const on = value !== null && i === at
				const n = counts?.(s.v)
				return (
					<button
						key={s.v}
						type="button"
						// biome-ignore lint/a11y/useSemanticElements: a segmented control or "and up" scale; the buttons carry the radio role
						role="radio"
						aria-checked={on}
						disabled={disabled && s.v !== 0}
						onClick={() => onChange(s.v)}
						className="group flex flex-col items-stretch gap-1.5 rounded-md py-1 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-not-allowed"
					>
						<span
							className={`h-2 rounded-full transition-colors ${lit ? color(s.v) : on ? "bg-white" : "bg-white/[0.09] group-hover:bg-white/20"}`}
						/>
						<span
							className={`text-left text-[12px] leading-tight ${on ? "font-semibold text-white" : "text-gray-400 group-hover:text-gray-200"}`}
						>
							{s.label}
							{!on && n != null && (
								<span className="ml-1 text-[11px] text-gray-600">
									{compactCount(n)}
								</span>
							)}
						</span>
					</button>
				)
			})}
		</div>
	)
}

/** Two thumbs on one track; commits a moment after the last move, so counts don't run on every pixel. */
export function RangeSlider({
	min,
	max,
	step,
	value,
	onCommit,
	format,
	label,
}: {
	min: number
	max: number
	step: number
	value: [number, number]
	onCommit: (v: [number, number]) => void
	format: (v: number) => string
	label: string
}) {
	const [v, setV] = useState(value)
	const key = value.join(",")
	// Follows the state when it changes from elsewhere.
	useEffect(() => setV(value), [key])
	useEffect(() => {
		if (v.join(",") === key) return
		const id = setTimeout(() => onCommit(v), 350)
		return () => clearTimeout(id)
	})
	const pct = (x: number) => ((x - min) / (max - min)) * 100
	const thumb =
		"pointer-events-none absolute inset-x-0 top-0 h-6 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,.6)] [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
	const full = v[0] <= min && v[1] >= max
	return (
		<div>
			<div className="mb-1 flex justify-between text-[13px] tabular-nums">
				<span className={full ? "text-gray-500" : "font-semibold text-white"}>
					{format(v[0])}
				</span>
				<span className={full ? "text-gray-500" : "font-semibold text-white"}>
					{format(v[1])}
				</span>
			</div>
			<div className="relative h-6">
				<div className="absolute inset-x-0 top-[10px] h-1 rounded-full bg-white/10" />
				<div
					className={`absolute top-[10px] h-1 rounded-full ${full ? "bg-white/25" : "bg-amber-400"}`}
					style={{ left: `${pct(v[0])}%`, right: `${100 - pct(v[1])}%` }}
				/>
				<input
					type="range"
					aria-label={`${label} from`}
					min={min}
					max={max}
					step={step}
					value={v[0]}
					onChange={(e) =>
						setV([Math.min(Number(e.target.value), v[1] - step), v[1]])
					}
					className={thumb}
				/>
				<input
					type="range"
					aria-label={`${label} to`}
					min={min}
					max={max}
					step={step}
					value={v[1]}
					onChange={(e) =>
						setV([v[0], Math.max(Number(e.target.value), v[0] + step)])
					}
					className={thumb}
				/>
			</div>
		</div>
	)
}

export function Spinner() {
	return (
		<span
			aria-hidden
			className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-amber-400 motion-reduce:animate-none"
		/>
	)
}

/** A search field inside a group: icon, a spinner while it looks, and a labeled Clear at the right. */
export function SearchField({
	value,
	onChange,
	placeholder,
	loading,
	onFocus,
	inputRef,
	autoFocus,
}: {
	value: string
	onChange: (v: string) => void
	placeholder: string
	loading?: boolean
	onFocus?: () => void
	inputRef?: RefObject<HTMLInputElement>
	autoFocus?: boolean
}) {
	return (
		<label className="flex h-10 items-center gap-2 rounded-xl bg-white/[0.05] pr-1.5 pl-3 ring-1 ring-white/[0.06] focus-within:ring-amber-500/60">
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-500" />
			<input
				ref={inputRef}
				type="search"
				value={value}
				// biome-ignore lint/a11y/noAutofocus: opened by the person to type
				autoFocus={autoFocus}
				onFocus={onFocus}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder}
				aria-label={placeholder}
				className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-white outline-none placeholder:text-gray-500 focus:ring-0 [&::-webkit-search-cancel-button]:hidden"
			/>
			{loading && <Spinner />}
			{value && (
				<button
					type="button"
					onClick={() => onChange("")}
					className="flex h-7 items-center gap-1 rounded-lg px-2 text-[12px] text-gray-400 cursor-pointer hover:bg-white/[0.08] hover:text-white"
				>
					<XMarkIcon className="h-3.5 w-3.5" />
					Clear
				</button>
			)}
		</label>
	)
}
