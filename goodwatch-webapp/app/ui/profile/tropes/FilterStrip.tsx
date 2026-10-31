// The Tropes tab's filters, drawn the way My movies draws its controls.
// - From lg: one strip with Movies or shows, the genre picks as chips and a genre button whose dropdown holds the
//   picture tiles, how many tropes, then era and score as selects and the shared SortControl.
// - Below lg (B3): a quiet line naming the filters in use and the count, opening one sheet (PhoneFilters) with every
//   group as tiles, Clear all and a "Show N tropes" button.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, MotionConfig, motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
	FilterGroup,
	FilterSheet,
	FilterSummaryRow,
} from "~/ui/filter-bar/PhoneFilters"
import { SortControl } from "~/ui/filter-bar/controls"
import { MENU } from "~/ui/filter-bar/motion"
import { plural } from "~/ui/my-pages/bits"
import { type MinScore, NO_FACETS, SORTS, type SortKey } from "./model"
import { EASE, useIso } from "./motion"
import { FacetChip, FacetTile, Fan } from "./tiles"
import type { TropeFacets } from "./useTropeFacets"

const PILL =
	"inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm font-semibold ring-1 transition-colors"

function TypePills({ m }: { m: TropeFacets }) {
	return (
		<div
			role="radiogroup"
			aria-label="Movies or shows"
			className="flex shrink-0 rounded-full bg-white/[0.06] p-0.5 ring-1 ring-white/10"
		>
			{m.kindChoices.map((c) => (
				<button
					key={c.id}
					type="button"
					// biome-ignore lint/a11y/useSemanticElements: a segmented control
					role="radio"
					aria-checked={c.on}
					onClick={c.toggle}
					className={`relative h-8 cursor-pointer rounded-full px-3 text-sm font-semibold transition-colors ${c.on ? "text-gray-950" : "text-gray-300 hover:text-white"}`}
				>
					{c.on && (
						<motion.span
							layoutId="trope-kind"
							transition={{ duration: 0.22, ease: EASE }}
							className="absolute inset-0 rounded-full bg-white"
						/>
					)}
					<span className="relative">{c.label}</span>
				</button>
			))}
		</div>
	)
}

/** My movies' "How long?" select, for era or score. */
function FacetSelect({
	label,
	value,
	on,
	options,
	onChange,
}: {
	label: string
	value: string
	on: boolean
	options: { value: string; label: string }[]
	onChange: (value: string) => void
}) {
	return (
		<label
			className={`relative flex h-9 shrink-0 items-center rounded-xl pl-3 text-sm font-bold ring-1 transition-colors focus-within:ring-2 focus-within:ring-amber-400 ${on ? "bg-amber-400/15 text-amber-200 ring-amber-400/50" : "bg-white/[0.06] text-gray-200 ring-white/10 hover:ring-white/20"}`}
		>
			<span className="sr-only">{label}</span>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="h-full cursor-pointer appearance-none bg-transparent pr-8 font-bold outline-none"
			>
				{options.map((o) => (
					<option
						key={o.value}
						value={o.value}
						className="bg-gray-900 text-gray-100"
					>
						{o.label}
					</option>
				))}
			</select>
			<ChevronDownIcon
				className="pointer-events-none absolute right-2 h-4 w-4 opacity-70"
				aria-hidden
			/>
		</label>
	)
}

const eraValue = (m: TropeFacets) =>
	m.f.eras.length === 1 ? String(m.f.eras[0]) : ""
const eraOptions = (m: TropeFacets) => [
	{ value: "", label: "Any era" },
	...m.eraChoices.map((c) => ({ value: c.id.slice(1), label: c.label })),
]
const sortOptions = SORTS.map((s) => ({
	key: s.key,
	label: s.label,
	hint: s.hint,
}))

/** The genre dropdown under the strip, as wide as it (MoodPanel's placement), closing on outside, Escape, or Done. */
function GenrePanel({
	m,
	open,
	setOpen,
	anchor,
	button,
}: {
	m: TropeFacets
	open: boolean
	setOpen: (open: boolean) => void
	anchor: React.RefObject<HTMLElement | null>
	button: React.RefObject<HTMLButtonElement | null>
}) {
	const panel = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState<{
		top: number
		left: number
		width: number
		max: number
	} | null>(null)
	useIso(() => {
		if (!open) return
		const place = () => {
			const r = anchor.current?.getBoundingClientRect()
			if (!r) return
			if (r.bottom < 60) return setOpen(false)
			setBox({
				top: r.bottom + 8,
				left: r.left,
				width: r.width,
				max: window.innerHeight - r.bottom - 20,
			})
		}
		place()
		window.addEventListener("scroll", place, { passive: true })
		window.addEventListener("resize", place)
		return () => {
			window.removeEventListener("scroll", place)
			window.removeEventListener("resize", place)
		}
	}, [open, anchor, setOpen])
	useEffect(() => {
		if (!open) return
		const down = (e: PointerEvent) => {
			const t = e.target as Node
			if (!panel.current?.contains(t) && !button.current?.contains(t))
				setOpen(false)
		}
		const key = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			setOpen(false)
			button.current?.focus()
		}
		window.addEventListener("pointerdown", down)
		window.addEventListener("keydown", key)
		return () => {
			window.removeEventListener("pointerdown", down)
			window.removeEventListener("keydown", key)
		}
	}, [open, setOpen, button])
	if (typeof document === "undefined") return null
	const k = m.f.genres.length
	return createPortal(
		<AnimatePresence>
			{open && box && (
				<motion.div
					ref={panel}
					// biome-ignore lint/a11y/useSemanticElements: a non-modal popover under the strip, as My movies' picker
					role="dialog"
					aria-label="Genres"
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: -8 }}
					transition={{ duration: 0.2, ease: EASE }}
					className={`fixed z-[70] flex flex-col overflow-hidden ${MENU}`}
					style={{
						top: box.top,
						left: box.left,
						width: box.width,
						maxHeight: box.max,
					}}
				>
					<div className="flex min-h-11 shrink-0 items-center gap-3 border-b border-white/8 px-3 py-1">
						<p className="min-w-0 flex-1 text-sm font-semibold text-white">
							Genres
						</p>
						<span className="text-sm text-gray-400 tabular-nums">
							{k} picked
						</span>
						{k > 0 && (
							<button
								type="button"
								onClick={() => m.set({ genres: [] })}
								className="cursor-pointer rounded-full px-2.5 py-1 text-sm font-semibold text-gray-200 hover:bg-white/10"
							>
								Clear
							</button>
						)}
						<button
							type="button"
							onClick={() => {
								setOpen(false)
								button.current?.focus()
							}}
							className="cursor-pointer rounded-full bg-white px-3 py-1 text-sm font-bold text-black hover:bg-gray-200"
						>
							Done
						</button>
					</div>
					<div className="grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-y-auto overscroll-contain p-3 xl:grid-cols-6">
						{m.genreChoices.map((c) => (
							<FacetTile key={c.id} c={c} />
						))}
					</div>
				</motion.div>
			)}
		</AnimatePresence>,
		document.body,
	)
}

function DesktopStrip({ m }: { m: TropeFacets }) {
	const anchor = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	const [open, setOpen] = useState(false)
	const genres = m.genreChoices.filter((c) => c.on)
	const minValue = m.f.min === "any" ? "" : m.f.min
	return (
		<div
			ref={anchor}
			className="hidden min-h-14 items-center gap-2 rounded-2xl bg-black/45 p-2 ring-1 ring-white/10 lg:flex"
		>
			<div className="flex min-w-0 flex-1 items-center gap-1.5">
				<TypePills m={m} />
				{genres.length > 0 && (
					// biome-ignore lint/a11y/useSemanticElements: a fieldset can't scroll sideways as a flex row
					<div
						role="group"
						aria-label="Genres"
						className="-my-1 flex min-w-0 items-center gap-1.5 overflow-x-auto py-1 pl-1 [scrollbar-width:none]"
					>
						{genres.map((c) => (
							<FacetChip key={c.id} c={c} />
						))}
					</div>
				)}
				<button
					ref={button}
					type="button"
					aria-haspopup="dialog"
					aria-expanded={open}
					onClick={() => setOpen(!open)}
					className={`${PILL} ${genres.length ? "px-2.5" : "pl-1.5"} text-white ring-white/15 hover:bg-white/20 ${open ? "bg-white/15" : "bg-white/10"}`}
				>
					{genres.length ? (
						"Add genre"
					) : (
						<>
							<Fan hues={m.genreChoices.slice(0, 4).map((c) => c.hue)} dim />
							Any genre
						</>
					)}
					<ChevronDownIcon
						className={`h-4 w-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`}
						aria-hidden
					/>
				</button>
				<Count m={m} className="shrink-0 pl-1" />
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<FacetSelect
					label="Era"
					value={eraValue(m)}
					on={m.f.eras.length > 0}
					options={eraOptions(m)}
					onChange={(v) => m.set({ eras: v ? [Number(v)] : [] })}
				/>
				<FacetSelect
					label={m.owner ? "Your score" : "Their score"}
					value={minValue}
					on={m.f.min !== "any"}
					options={m.minChoices.map((c) => ({
						value: c.id === "any" ? "" : c.id,
						label: c.label,
					}))}
					onChange={(v) => m.set({ min: (v || "any") as MinScore })}
				/>
				<SortControl<SortKey>
					size="sm"
					align="right"
					options={sortOptions}
					value={m.f.sort}
					onChange={(sort) => m.set({ sort })}
				/>
			</div>
			<GenrePanel
				m={m}
				open={open}
				setOpen={setOpen}
				anchor={anchor}
				button={button}
			/>
		</div>
	)
}

function Count({ m, className = "" }: { m: TropeFacets; className?: string }) {
	return (
		<span
			className={`whitespace-nowrap text-sm text-gray-400 tabular-nums ${className}`}
		>
			<motion.span
				key={m.total}
				initial={{ opacity: 0.4 }}
				animate={{ opacity: 1 }}
				className="font-semibold text-white"
			>
				{m.total}
			</motion.span>{" "}
			tropes in {plural(m.carrying, "title")}
		</span>
	)
}

const RADIO_TILE = (on: boolean) =>
	`flex min-h-12 cursor-pointer flex-col items-start justify-center rounded-xl px-3 py-2 text-left text-sm font-bold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${on ? "bg-white text-black" : "bg-white/[0.05] text-white ring-1 ring-white/10"}`

function PhoneSlab({ m }: { m: TropeFacets }) {
	const [open, setOpen] = useState(false)
	const sort = SORTS.find((s) => s.key === m.f.sort)
	const active = m.picked.map((c) => c.label)
	if (m.f.sort !== NO_FACETS.sort && sort) active.push(sort.label)
	const n = m.total
	return (
		<>
			<FilterSummaryRow
				active={active}
				count={plural(n, "trope")}
				open={open}
				onOpen={() => setOpen(true)}
				disabled={!m.ready}
			/>
			<FilterSheet
				open={open}
				setOpen={setOpen}
				canClear={m.picked.length > 0}
				onClear={m.reset}
				show={n ? `Show ${plural(n, "trope")}` : "Done"}
			>
				<FilterGroup title="Movies or shows">
					<div
						role="radiogroup"
						aria-label="Movies or shows"
						className="grid grid-cols-3 gap-2 px-4 pb-4"
					>
						{m.kindChoices.map((c) => (
							<button
								key={c.id}
								type="button"
								// biome-ignore lint/a11y/useSemanticElements: a tile grid, as My movies' drawers
								role="radio"
								aria-checked={c.on}
								onClick={c.toggle}
								className={RADIO_TILE(c.on)}
							>
								{c.label}
								<span
									className={`text-[11px] font-semibold tabular-nums ${c.on ? "text-black/60" : "text-gray-400"}`}
								>
									{c.count === 1 ? "1 title" : `${c.count} titles`}
								</span>
							</button>
						))}
					</div>
				</FilterGroup>
				<FilterGroup title="Genres">
					<div className="grid grid-cols-2 gap-2 px-4 pt-1 pb-4">
						{m.genreChoices.map((c) => (
							<FacetTile key={c.id} c={c} className="min-h-[4.75rem]" />
						))}
					</div>
				</FilterGroup>
				<section className="border-t border-white/[0.06] pt-3">
					<div className="flex flex-col gap-4 px-4 pt-1 pb-4">
						<div>
							<h3 className="mb-2 text-sm font-bold text-white">Era</h3>
							<div className="grid grid-cols-2 gap-2">
								{m.eraChoices.map((c) => (
									<FacetTile key={c.id} c={c} className="min-h-[4.75rem]" />
								))}
							</div>
						</div>
						<div>
							<h3 className="mb-2 text-sm font-bold text-white">
								{m.owner ? "Your score" : "Their score"}
							</h3>
							<div
								role="radiogroup"
								aria-label="Score"
								className="grid grid-cols-2 gap-2"
							>
								{m.minChoices.map((c) => (
									<button
										key={c.id}
										type="button"
										// biome-ignore lint/a11y/useSemanticElements: a tile grid
										role="radio"
										aria-checked={c.on}
										onClick={c.toggle}
										className={RADIO_TILE(c.on)}
									>
										{c.label}
										<span
											className={`text-[11px] font-semibold tabular-nums ${c.on ? "text-black/60" : "text-gray-400"}`}
										>
											{c.count === 1 ? "1 title" : `${c.count} titles`}
										</span>
									</button>
								))}
							</div>
						</div>
					</div>
				</section>
				<FilterGroup title="Sort">
					<div
						role="radiogroup"
						aria-label="Sort"
						className="grid grid-cols-2 gap-2 px-4 pb-4"
					>
						{SORTS.map((s) => {
							const on = s.key === m.f.sort
							return (
								<button
									key={s.key}
									type="button"
									// biome-ignore lint/a11y/useSemanticElements: a tile grid, as My movies' sort drawer
									role="radio"
									aria-checked={on}
									onClick={() => m.set({ sort: s.key })}
									className={RADIO_TILE(on)}
								>
									{s.label}
									<span
										className={`mt-0.5 line-clamp-2 text-[11px] font-normal leading-snug ${on ? "text-black/70" : "text-gray-400"}`}
									>
										{s.hint}
									</span>
								</button>
							)
						})}
					</div>
				</FilterGroup>
			</FilterSheet>
		</>
	)
}

export function FilterStrip({ m, wide }: { m: TropeFacets; wide: boolean }) {
	return (
		<MotionConfig reducedMotion="user">
			<DesktopStrip m={m} />
			{!wide && <PhoneSlab m={m} />}
		</MotionConfig>
	)
}
