// Find's results, in place of the open sub-tab while Find has text: columns in tab order (Search, Mood, Watch, You;
// empty tabs left out, phones stack them), each with its tab's name and quiet sub-tab labels. Choices show as the
// sheet's option chips with a count or a tick; titles and people as the Search tab's rows. A pick toggles in place and
// the text stays, so several picks in a row work.
//
// Titles and people show 4 at first; More grows the group in place (12, then 12 more a tap). "In Titles" and "In Cast
// and crew" end Find and open that sub-tab with the text in its field. The field keeps focus: arrow keys move the
// highlight, Enter picks it, or the best-scoring result when nothing is highlighted.
import {
	ArrowRightIcon,
	CheckIcon,
	LockClosedIcon,
} from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import {
	type ReactNode,
	type RefObject,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import { compactCount } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import { PROVIDER_LOGO } from "~/ui/filter-bar/useFilterData"
import { countryFlagUrl } from "~/utils/country-flag"
import { PRIVATE } from "../DiscoverBar"
import type { SubTabView } from "../DiscoverControls"
import { seedFindPerson } from "../search/PeopleTab"
import { useSteer } from "../search/TitlesTab"
import { useFindGrid } from "../search/combobox"
import { MoreLine, PersonRow, TitleRow } from "../search/rows"
import { MAIN_TAB_LABELS, type SubTabId, subTabById } from "../tabs"
import type { FindControls, FindKeys } from "./FindField"
import {
	FIRST_ROWS,
	type FindArt,
	type FindColumn,
	type FindHit,
	type RowKind,
	enterPick,
	flatHits,
	groupHits,
	growRows,
	moveActive,
} from "./find-model"
import { useFind } from "./useFind"

const FULL: Record<RowKind, { more: string; open: string; sub: SubTabId }> = {
	title: { more: "More titles", open: "In Titles", sub: "titles" },
	person: { more: "More people", open: "In Cast and crew", sub: "people" },
}

/** For DiscoverControls' `renderFind`. */
export function renderFind(
	text: string,
	view: SubTabView,
	controls: FindControls,
): ReactNode {
	return <FindResults text={text} view={view} controls={controls} />
}

export function FindResults({
	text,
	view,
	controls,
}: {
	text: string
	view: SubTabView
	controls: FindControls
}) {
	const { phone } = view
	const found = useFind(text, view)
	const steer = useSteer(view.filters)
	const [rows, setRows] = useState(FIRST_ROWS)
	const typed = text.trim()
	// New text starts at 4 again.
	useEffect(() => setRows(FIRST_ROWS), [typed])
	const columns = groupHits(found.hits, rows, found.totals)
	const flat = flatHits(columns)
	const nav = useFindNav(flat, typed, controls.keys)
	const listId = useId()
	const rowId = (i: number) => `${listId}-${i}`
	useFindGrid(listId, nav.active >= 0 ? rowId(nav.active) : undefined)
	const box = useRef<HTMLDivElement>(null)
	useEffect(() => {
		if (nav.active >= 0)
			box.current
				?.querySelector<HTMLElement>(`[data-row="${nav.active}"]`)
				?.scrollIntoView({ block: "nearest" })
	}, [nav.active])

	const openFull = (kind: RowKind) => {
		if (kind === "title") view.setText(typed)
		else seedFindPerson(typed)
		controls.openSub(FULL[kind].sub)
	}
	// Three columns or more leave a title row too narrow for the wide Like this.
	const compact = phone || columns.length >= 3
	const context: ItemsContext = {
		flat,
		nav,
		rowId,
		steer,
		compact,
		onMore: (kind) => setRows((r) => growRows(r, kind)),
		onOpenFull: openFull,
	}

	return (
		<div
			ref={box}
			id={listId}
			// biome-ignore lint/a11y/useSemanticElements: results the Find field drives, not a select
			role="grid"
			aria-label="Found in every tab"
			className={phone ? "" : "px-6 py-4"}
		>
			{flat.length === 0 ? (
				<p className="flex h-24 items-center justify-center text-[15px] text-gray-400">
					{found.loading ? (
						"Looking…"
					) : (
						<>
							Nothing called
							<span className={`ml-1 font-semibold text-white ${PRIVATE}`}>
								“{typed}”
							</span>
						</>
					)}
				</p>
			) : phone ? (
				<div className="flex flex-col gap-6">
					{columns.map((column) => (
						<TabColumn key={column.tab} column={column} context={context} />
					))}
				</div>
			) : (
				<div
					className="grid items-start gap-8"
					style={{
						gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
					}}
				>
					{columns.map((column, i) => (
						<div
							key={column.tab}
							className={`min-w-0 ${i ? "border-l border-white/[0.06] pl-8" : ""}`}
						>
							<TabColumn column={column} context={context} />
						</div>
					))}
				</div>
			)}
		</div>
	)
}

/** Arrow keys over `flat` while the field keeps focus; Enter picks. Starts over when the text changes. */
function useFindNav(
	flat: FindHit[],
	reset: string,
	keys: RefObject<FindKeys | null>,
) {
	const [active, setActive] = useState(-1)
	useEffect(() => setActive(-1), [reset])
	const live = useRef({ flat, active })
	live.current = { flat, active }
	useEffect(() => {
		const handle = keys as { current: FindKeys | null }
		const registration: FindKeys = {
			move: (delta) =>
				setActive((at) => moveActive(at, delta, live.current.flat.length)),
			enter: () => enterPick(live.current.flat, live.current.active)?.pick(),
		}
		handle.current = registration
		return () => {
			if (handle.current === registration) handle.current = null
		}
	}, [keys])
	useEffect(() => {
		if (active >= flat.length) setActive(flat.length - 1)
	}, [active, flat.length])
	return { active, setActive }
}

interface ItemsContext {
	flat: FindHit[]
	nav: { active: number; setActive: (i: number) => void }
	rowId: (i: number) => string
	steer: ReturnType<typeof useSteer>
	compact: boolean
	onMore: (kind: RowKind) => void
	onOpenFull: (kind: RowKind) => void
}

function TabColumn({
	column,
	context,
}: {
	column: FindColumn
	context: ItemsContext
}) {
	return (
		<section className="min-w-0">
			<h3 className="mb-3 flex items-center gap-2.5 text-[15px] font-bold text-white">
				<span className="h-3.5 w-1 rounded-full bg-amber-400" aria-hidden />
				{MAIN_TAB_LABELS[column.tab]}
			</h3>
			<div className="flex flex-col gap-3.5">
				{column.subs.map((sub) => (
					<div key={sub.subTab} className="min-w-0">
						<p className="mb-1.5 text-[12px] text-gray-500">
							{subTabById(sub.subTab).label}
						</p>
						<SubItems sub={sub} context={context} />
					</div>
				))}
			</div>
		</section>
	)
}

function SubItems({
	sub,
	context,
}: {
	sub: FindColumn["subs"][number]
	context: ItemsContext
}) {
	const { flat, nav, rowId, steer, compact } = context
	const at = (hit: FindHit) => flat.indexOf(hit)
	return (
		<div className="flex flex-col gap-2">
			{sub.rows.length > 0 && (
				<div className="-mx-3 flex flex-col gap-1">
					{sub.rows.map((hit) => {
						const i = at(hit)
						if (hit.title)
							return (
								<TitleRow
									key={hit.key}
									t={hit.title}
									i={i}
									nav={{ ...nav, rowId }}
									steer={steer}
									phone={compact}
								/>
							)
						return (
							hit.person && (
								<PersonRow
									key={hit.key}
									id={rowId(i)}
									i={i}
									p={{ ...hit.person, note: hit.note }}
									on={hit.on}
									onToggle={hit.pick}
									active={nav.active === i}
									onHover={() => nav.setActive(i)}
								/>
							)
						)
					})}
				</div>
			)}
			{sub.more && (
				<div className="-mx-3">
					<MoreLine
						label={FULL[sub.more.kind].more}
						count={sub.more.count}
						onMore={() => sub.more && context.onMore(sub.more.kind)}
						right={
							<button
								type="button"
								onClick={() => sub.more && context.onOpenFull(sub.more.kind)}
								className="flex h-8 min-w-0 items-center gap-1 rounded-full px-2.5 text-[13px] text-gray-400 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<span className="truncate">{FULL[sub.more.kind].open}</span>
								<ArrowRightIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
							</button>
						}
					/>
				</div>
			)}
			{sub.chips.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{sub.chips.map((hit) => {
						const i = at(hit)
						return (
							<FindChip
								key={hit.key}
								hit={hit}
								id={rowId(i)}
								i={i}
								active={nav.active === i}
								onHover={() => nav.setActive(i)}
							/>
						)
					})}
				</div>
			)}
		</div>
	)
}

/** A choice as the sheet's option chip: its count, or a tick when on; a guest's You chip is faint with a lock. */
function FindChip({
	hit,
	id,
	i,
	active,
	onHover,
}: {
	hit: FindHit
	id: string
	i: number
	active: boolean
	onHover: () => void
}) {
	const dead = !hit.on && hit.count === 0
	return (
		// biome-ignore lint/a11y/useFocusableInteractive: the Find field keeps focus and drives the results
		<div
			id={id}
			// biome-ignore lint/a11y/useSemanticElements: a result the Find field drives, not a table row
			role="row"
			aria-selected={active}
			className="flex max-w-full"
		>
			{/* biome-ignore lint/a11y/useFocusableInteractive: the button inside takes clicks */}
			{/* biome-ignore lint/a11y/useSemanticElements: a result the Find field drives, not a table cell */}
			<div role="gridcell" className="flex max-w-full">
				<motion.button
					type="button"
					data-row={i}
					data-find-value={hit.value ? "" : undefined}
					aria-pressed={hit.on}
					aria-disabled={hit.locked || undefined}
					tabIndex={-1}
					whileTap={hit.locked ? undefined : TAP}
					onMouseEnter={onHover}
					onClick={() => !hit.locked && hit.pick()}
					className={`flex h-8 max-w-full items-center gap-1.5 rounded-full px-3 text-[13px] whitespace-nowrap outline-none ${
						hit.locked
							? "cursor-default bg-white/[0.03] text-gray-500"
							: hit.on
								? "cursor-pointer bg-white font-semibold text-gray-950"
								: dead
									? "cursor-pointer bg-white/[0.02] text-gray-600"
									: "cursor-pointer bg-white/[0.06] text-gray-200 hover:bg-white/[0.11] hover:text-white"
					} ${active ? "ring-2 ring-amber-400" : ""}`}
				>
					{hit.locked ? (
						<LockClosedIcon
							className="h-3.5 w-3.5 shrink-0 text-amber-500/70"
							aria-label="With an account"
						/>
					) : (
						hit.art && <Art art={hit.art} />
					)}
					<span className="truncate">{hit.label}</span>
					{hit.on ? (
						<CheckIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
					) : (
						!hit.locked &&
						hit.count != null && (
							<span className="shrink-0 text-[11px] tabular-nums text-gray-500">
								{compactCount(hit.count)}
							</span>
						)
					)}
				</motion.button>
			</div>
		</div>
	)
}

function Art({ art }: { art: FindArt }) {
	switch (art.kind) {
		case "hues":
			return art.hues.length ? (
				<span className="flex shrink-0 -space-x-1" aria-hidden>
					{art.hues.map((hue, i) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of dots
							key={i}
							className="h-2.5 w-2.5 rounded-full ring-1 ring-gray-950"
							style={{ background: hue }}
						/>
					))}
				</span>
			) : null
		case "logo":
			return (
				<img
					src={`${PROVIDER_LOGO}${art.path}`}
					alt=""
					loading="lazy"
					className="-ml-1.5 h-5 w-5 shrink-0 rounded-[5px]"
				/>
			)
		case "flag":
			return (
				<img
					src={countryFlagUrl(art.code)}
					alt=""
					loading="lazy"
					className="-ml-1 h-3.5 w-5 shrink-0 rounded-[3px] object-cover"
				/>
			)
		default:
			return null
	}
}
