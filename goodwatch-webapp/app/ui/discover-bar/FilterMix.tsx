// Discover's count at the top right of the page (fixed width, so it doesn't jump) with its colored line, and a popout
// that shows what each filter hides, adding up to 100%. Each row can be switched off and on again (the filter's choices
// wait here, so trying combinations needs no trip back into the panel) or removed. Switched-off filters live only in
// this component: a reload forgets them.
//
// "Hides" is an estimate: the server counts only titles that one filter alone hides (recoveries); titles that several
// filters keep out are shared among those filters by their sole-hide counts, so the rows add up to the hidden total.
// In search mode the search applies some filters itself (year, type, anime, a genre, people, services): for a topic
// search it counts what they keep out of the topic; otherwise their rows say "set in search" (`inSearch`), not
// "no effect", and take no share of the hidden total.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useEffect, useId, useRef, useState } from "react"
import type { FilterState } from "~/domain/filter-state"
import { Knob, MENU, METER_TRANSITION, TAP } from "~/ui/filter-bar/motion"
import type { FilterBarCounts } from "~/ui/filter-bar/types"
import { HideNumber } from "./HideNumber"
import { allocateHidden } from "./hidden-allocation"
import { hideText } from "./hide-count"
import { CountText, filterColor } from "./PanelFooter"
import type { BarChip } from "./chips"

interface Row {
	group: string
	label: string
	color: string
	hides: number
	chips: BarChip[]
	off: boolean
	/** The search applies it and couldn't count what it hides. */
	inSearch?: boolean
}

/** A filter the search read from the words, as the meter shows it: its hide count, and whether that's an estimate. */
export interface ReadRow {
	group: string
	label: string
	color: string
	hides: number
	approx?: boolean
	/**
	 * Applied by the results themselves (`nativeGroup` is its filter group), so part of their hidden total: its count
	 * is its share of that total (hidden-allocation.ts), never added on top.
	 */
	inHidden?: boolean
	nativeGroup?: string
}

/** One of the person's own filter rows, handed to `readSection` so it orders them with the read parts in one list. */
export interface OwnRow {
	key: string
	/** What it hides, when that is a count; rows with a count sort first, highest first. */
	n?: number
	node: ReactNode
}

const removeAll = (chips: BarChip[], s: FilterState) =>
	chips.reduce((acc, chip) => (chip.remove ? chip.remove(acc) : acc), s)

/** The fields `after` changed, with their values in `before`. */
function diff(before: FilterState, after: FilterState): Partial<FilterState> {
	const out: Record<string, unknown> = {}
	const keys = new Set([...Object.keys(before), ...Object.keys(after)])
	for (const key of keys) {
		const a = (before as unknown as Record<string, unknown>)[key]
		const b = (after as unknown as Record<string, unknown>)[key]
		if (JSON.stringify(a) !== JSON.stringify(b)) out[key] = a
	}
	return out as Partial<FilterState>
}

function Stack({
	shown,
	rows,
	className,
}: {
	shown: number
	rows: Row[]
	className: string
}) {
	const live = rows.filter((r) => !r.off && r.hides > 0)
	const all = shown + live.reduce((sum, r) => sum + r.hides, 0)
	const width = (n: number) => `${all ? Math.max(2, (n / all) * 100) : 0}%`
	return (
		<span
			aria-hidden
			className={`flex overflow-hidden rounded-full bg-white/5 ${className}`}
		>
			<motion.span
				layout
				transition={METER_TRANSITION}
				className="h-full bg-amber-500"
				style={{ width: width(shown) }}
			/>
			{live.map((r) => (
				<motion.span
					key={r.group}
					layout
					transition={METER_TRANSITION}
					className={`ml-px h-full ${r.color}`}
					style={{ width: width(r.hides) }}
				/>
			))}
		</span>
	)
}

export function FilterMix({
	counts,
	searching,
	chips,
	state,
	update,
	phone,
	readSection,
	keepChip,
	readRows = [],
	onClearAll,
	menuLeft = false,
}: {
	/** PROTOTYPE: the menu opens from the left edge (count on the left). */
	menuLeft?: boolean
	/**
	 * While searching: the filters the search read from the words, with what each keeps out on its own (read-parts.tsx).
	 * Their titles pass every other filter, so they share no title with each other or with the rows above: the meter,
	 * the hidden count and the "of" total add them as they are.
	 */
	readRows?: ReadRow[]
	/**
	 * While searching: every part the search read, with its switch, after the filter rows (then no "Shown" row). It
	 * gets the read rows' counts as the meter shows them, by row group.
	 */
	readSection?: (
		counts: ReadonlyMap<string, number>,
		own: OwnRow[],
	) => ReactNode
	/** Removes the search and every filter: the Filters header's Clear. */
	onClearAll?: () => void
	/** Which chips get rows of their own: the person's own filters (the read parts are in `readSection`). */
	keepChip?: (chip: BarChip) => boolean
	counts: FilterBarCounts | null
	searching: boolean
	state: FilterState
	chips: BarChip[]
	update: (change: (state: FilterState) => FilterState) => void
	phone: boolean
}) {
	const [open, setOpen] = useState(false)
	const id = useId()
	const ref = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (!open) return
		const down = (e: Event) =>
			!ref.current?.contains(e.target as Node) && setOpen(false)
		const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
		document.addEventListener("pointerdown", down)
		document.addEventListener("keydown", key)
		return () => {
			document.removeEventListener("pointerdown", down)
			document.removeEventListener("keydown", key)
		}
	}, [open])

	// Switched-off filters: their choices, label and place, until switched on or removed.
	const [parked, setParked] = useState<
		{ group: string; label: string; restore: Partial<FilterState> }[]
	>([])

	// Rows keep the place they first took, also while switched off.
	const seen = useRef<string[]>([])
	const total = counts?.total ?? 0
	const hidden = counts?.hidden ?? 0
	const sole = new Map(
		(counts?.recoveries ?? []).map((r) => [r.filter as string, r.titles]),
	)
	const groups: { group: string; chips: BarChip[] }[] = []
	for (const chip of chips) {
		if (chip.kind === "query" || !chip.group) continue
		if (keepChip && !keepChip(chip)) continue
		const at = groups.find((g) => g.group === chip.group)
		if (at) at.chips.push(chip)
		else groups.push({ group: chip.group, chips: [chip] })
	}
	const inSearch = new Set<string>(counts?.inSearch ?? [])
	// One share-out of the results' hidden titles among every filter group that hides them: the person's own rows
	// and the read filters the results apply (each group once, split among its members).
	const members = new Map<string, string[]>()
	const join = (group: string, member: string) =>
		members.set(group, [...(members.get(group) ?? []), member])
	for (const g of groups) join(g.group, `own:${g.group}`)
	for (const r of readRows)
		if (r.inHidden && r.nativeGroup) join(r.nativeGroup, r.group)
	const allocated = allocateHidden(
		hidden,
		[...members].map(([group, keys]) => ({
			group,
			sole: sole.get(group) ?? 0,
			inSearch: inSearch.has(group),
			members: keys,
		})),
	)
	// The read rows as the meter and Matches show them: shares of the hidden titles, or the search's own counts
	// (estimates and its scope, which the results can't see and the total adds once). Highest first, stable.
	const readShown = readRows
		.map((r, index) => ({
			row: r.inHidden ? { ...r, hides: allocated.get(r.group) ?? 0 } : r,
			index,
		}))
		.sort((a, b) => b.row.hides - a.row.hides || a.index - b.index)
		.map(({ row }) => row)
	const readCounts = new Map(readShown.map((r) => [r.group, r.hides]))
	const readHidden = readShown.reduce(
		(sum, r) => sum + (r.inHidden ? 0 : Math.max(0, r.hides)),
		0,
	)
	const allHidden = hidden + readHidden
	// A total that includes an estimated read count is itself about: "~".
	const about = readShown.some((r) => r.approx && r.hides > 0) ? "~" : ""
	const live: Row[] = groups.map((g) => ({
		group: g.group,
		label: g.chips.map((c) => c.label).join(" · "),
		color: filterColor(g.group),
		hides: allocated.get(`own:${g.group}`) ?? 0,
		chips: g.chips,
		off: false,
		inSearch: inSearch.has(g.group),
	}))
	const unsorted: Row[] = [
		...live,
		...parked
			.filter((p) => !live.some((r) => r.group === p.group))
			.map((p) => ({
				group: p.group,
				label: p.label,
				color: filterColor(p.group),
				hides: 0,
				chips: [],
				off: true,
			})),
	]
	for (const row of unsorted)
		if (!seen.current.includes(row.group)) seen.current.push(row.group)
	const rows = [...unsorted].sort(
		(a, b) => seen.current.indexOf(a.group) - seen.current.indexOf(b.group),
	)
	// One meter for the compact bar and the popout: the native rows, then the read hard filters.
	const meterRows: Row[] = [
		...rows,
		...readShown.map((r) => ({ ...r, chips: [], off: false })),
	]

	const switchOff = (row: Row) => {
		const restore = diff(state, removeAll(row.chips, state))
		setParked((list) => [
			...list.filter((p) => p.group !== row.group),
			{ group: row.group, label: row.label, restore },
		])
		update((s) => removeAll(row.chips, s))
	}
	const switchOn = (row: Row) => {
		const p = parked.find((x) => x.group === row.group)
		if (p) update((s) => ({ ...s, ...p.restore }))
		setParked((list) => list.filter((x) => x.group !== row.group))
	}
	const remove = (row: Row) => {
		if (!row.off) update((s) => removeAll(row.chips, s))
		setParked((list) => list.filter((x) => x.group !== row.group))
		seen.current = seen.current.filter((g) => g !== row.group)
	}

	const ownRow = (row: Row) => (
		<li key={row.group} className="flex h-9 items-center gap-1">
			<motion.button
				type="button"
				role="switch"
				aria-checked={!row.off}
				aria-label={row.label}
				whileTap={{ scale: 0.985 }}
				onClick={() => (row.off ? switchOn(row) : switchOff(row))}
				className="-ml-2 flex h-full min-w-0 flex-1 items-center gap-2.5 rounded-lg pr-1 pl-2 text-left cursor-pointer outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<span
					className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.color} ${row.off ? "opacity-40" : ""}`}
					aria-hidden
				/>
				<span
					className={`min-w-0 flex-1 truncate ${row.off ? "text-gray-500 line-through decoration-gray-600" : "text-gray-200"}`}
				>
					{row.label}
				</span>
				<span className="shrink-0 text-xs tabular-nums text-gray-500">
					{row.off ? (
						"off"
					) : row.inSearch ? (
						"set in search"
					) : row.hides < 1 ? (
						"no effect"
					) : (
						<>
							hides <HideNumber n={row.hides} approx />
						</>
					)}
				</span>
				<span className="shrink-0 origin-center scale-75" aria-hidden>
					<Knob on={!row.off} />
				</span>
			</motion.button>
			<button
				type="button"
				aria-label={`Remove ${row.label}`}
				onClick={() => remove(row)}
				className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-gray-500 cursor-pointer outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<XMarkIcon className="h-4 w-4" />
			</button>
		</li>
	)
	const own: OwnRow[] = rows.map((row) => ({
		key: `own:${row.group}`,
		n: !row.off && !row.inSearch && row.hides >= 1 ? row.hides : undefined,
		node: ownRow(row),
	}))
	const clearEverything = () => {
		setParked([])
		seen.current = []
		onClearAll?.()
	}
	const listed = rows.length > 0 || Boolean(readSection)

	return (
		<div ref={ref} className="relative shrink-0">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={id}
				onClick={() => setOpen((o) => !o)}
				className={`flex min-h-12 flex-col items-end justify-center gap-1 rounded-lg text-right cursor-pointer outline-none hover:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-amber-400 ${phone ? "w-[150px]" : "w-[240px]"}`}
			>
				<span className="flex w-full items-baseline justify-between gap-x-2">
					<CountText counts={counts} searching={searching} />
					{!phone && (
						<span className="text-[11px] whitespace-nowrap text-gray-500">
							{allHidden > 0
								? `${hideText(allHidden, about === "~")} hidden`
								: ""}
						</span>
					)}
				</span>
				<Stack shown={total} rows={meterRows} className="h-2 w-full" />
			</button>
			<AnimatePresence>
				{open && counts && (
					<motion.section
						id={id}
						aria-label="What your filters hide"
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -4 }}
						transition={{ duration: 0.14 }}
						className={`absolute top-full ${menuLeft ? "left-0" : "right-0"} z-50 mt-2 p-3.5 text-[13px] ${phone ? "w-[min(340px,calc(100vw-32px))]" : "w-[360px]"} ${MENU}`}
					>
						<p className="text-sm font-bold text-white">
							{total.toLocaleString("en")} of {about}
							{(total + allHidden).toLocaleString("en")}{" "}
							{searching ? "matches" : "titles"}
							{phone && allHidden > 0 && (
								<span className="font-normal text-gray-500">
									{" "}
									· {hideText(allHidden, about === "~")} hidden
								</span>
							)}
						</p>

						<Stack
							shown={total}
							rows={meterRows}
							className="mt-2.5 h-2.5 w-full"
						/>
						{!readSection && (
							<ul className="mt-3 flex flex-col">
								<li className="flex h-8 items-center gap-2.5">
									<span
										className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500"
										aria-hidden
									/>
									<span className="flex-1 font-bold text-white">Shown</span>
									<span className="tabular-nums text-gray-300">
										{total.toLocaleString("en")}
									</span>
									<span className="w-[86px]" aria-hidden />
								</li>
							</ul>
						)}
						{listed && (
							<div className="mt-3 flex items-center justify-between">
								<span className="text-[11px] font-semibold tracking-[0.06em] text-gray-500 uppercase">
									Filters
								</span>
								{onClearAll && (
									<button
										type="button"
										onClick={clearEverything}
										title="Remove the search and every filter"
										className="-mr-2 shrink-0 cursor-pointer rounded-md px-2 py-1 text-[12px] font-semibold text-gray-400 hover:bg-white/[0.06] hover:text-white"
									>
										Clear
									</button>
								)}
							</div>
						)}
						{readSection ? (
							readSection(readCounts, own)
						) : (
							<ul className="mt-1 flex flex-col">
								{rows.map(ownRow)}
								{rows.length === 0 && (
									<li className="text-xs text-gray-500">No filters.</li>
								)}
							</ul>
						)}
					</motion.section>
				)}
			</AnimatePresence>
		</div>
	)
}
