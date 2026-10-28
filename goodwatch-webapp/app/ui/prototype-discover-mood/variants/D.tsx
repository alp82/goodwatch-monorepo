// PROTOTYPE - throwaway. Variant D, "Mood rail": the tags always sit beside the results. Desktop: a sticky left rail
// (mood search, mood tiles, About and Style chips, the deep filters with their active chips), the main area a summary
// line and the grid. Phones: the search, a sticky strip of mood tiles, and a bottom sheet with the whole rail.
import { MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { AdjustmentsHorizontalIcon } from "@heroicons/react/24/outline"
import { motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { stateAsApplied } from "~/domain/filter-state"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FiltersSheet, SnapSheet, activeChips, useMyServices } from "~/ui/filter-bar"
import type { FilterGroupsData } from "~/ui/filter-bar/FilterGroups"
import { DISPLAY } from "~/ui/my-pages/bits"
import { GROUP_LABEL, ProtoGrid, type ProtoDiscover, TAGS, type Tag, short, tagId } from "../kit"

export const NAME = "Mood rail"

const MOODS = TAGS.filter((t) => t.group === "moods")
const ABOUT = TAGS.filter((t) => t.group === "themes")
const STYLE = TAGS.filter((t) => t.group === "styles")
const TAP = { scale: 0.96 }

// ---------------------------------------------------------------------------------------------------------------
// The deep filters: the real Filters sheet's data, and the active filters that aren't moods, themes or styles.

function useDeep(d: ProtoDiscover) {
	const { state } = d.filters
	const services = useMyServices({ country: state.streamingCountry, include: state.services })
	const ladder = d.counts?.ladder ?? null
	const applied = useMemo(() => stateAsApplied(state, ladder), [state, ladder])
	const all = useMemo(
		() =>
			activeChips(applied, {
				service: (id) => services.countryProviders.find((p) => p.id === id)?.name,
				serviceLogo: (id) => services.countryProviders.find((p) => p.id === id)?.logo_path,
			}),
		[applied, services.countryProviders],
	)
	const chips = all.filter((c) => c.group !== "moods" && c.group !== "themes" && c.group !== "styles")
	const data: FilterGroupsData = {
		state,
		counts: d.counts,
		onChange: (next) => d.filters.update(() => next),
		myServices: services.ids,
		countryProviders: services.countryProviders,
		streamingCountry: services.country,
		taste: "ready",
		ladder,
	}
	return { all, chips, data }
}
type Deep = ReturnType<typeof useDeep>

// ---------------------------------------------------------------------------------------------------------------

function MoodSearch({ d }: { d: ProtoDiscover }) {
	const [text, setText] = useState(d.q ?? "")
	useEffect(() => setText(d.q ?? ""), [d.q])
	return (
		<form
			role="search"
			onSubmit={(e) => {
				e.preventDefault()
				d.setQ(text)
			}}
			className="relative"
		>
			<MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-gray-400" />
			<input
				type="search"
				value={text}
				onChange={(e) => setText(e.target.value)}
				placeholder="Describe a mood"
				aria-label="Describe a mood"
				enterKeyHint="search"
				className="h-11 w-full rounded-xl bg-gray-900 pr-10 pl-10 text-[15px] text-white ring-1 ring-white/10 outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-amber-400 [&::-webkit-search-cancel-button]:hidden"
			/>
			{(text || d.q) && (
				<button
					type="button"
					aria-label="Clear search"
					onClick={() => {
						setText("")
						d.setQ(null)
					}}
					className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white"
				>
					<XMarkIcon className="size-4" />
				</button>
			)}
		</form>
	)
}

/** A mood as a For you style tile: hue wash, name, short description, count; amber ring when picked. */
function MoodTile({ t, d, className = "" }: { t: Tag; d: ProtoDiscover; className?: string }) {
	const on = d.isOn(t)
	const n = d.countFor(t)
	const empty = !on && n === 0
	return (
		<motion.button
			type="button"
			aria-pressed={on}
			whileTap={TAP}
			onClick={() => d.toggle(t)}
			className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl bg-white/[0.035] p-2.5 text-left ring-1 ring-white/10 select-none hover:ring-white/30 ${empty ? "opacity-40" : ""} ${className}`}
		>
			<span
				aria-hidden="true"
				className="pointer-events-none absolute inset-0"
				style={{ background: `linear-gradient(140deg, ${t.color}33, transparent 58%)` }}
			/>
			<span
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 rounded-2xl bg-amber-400/[0.08] ring-2 ring-amber-400 ring-inset transition-opacity duration-300"
				style={{ opacity: on ? 1 : 0 }}
			/>
			<span className="relative flex items-baseline gap-2">
				<span className={`${DISPLAY} min-w-0 flex-1 truncate text-[0.98rem] leading-tight text-white`}>{t.name}</span>
				<span className="shrink-0 text-[11px] font-semibold text-gray-400 tabular-nums">{short(n)}</span>
			</span>
			{t.description && (
				<span className="relative mt-1 line-clamp-2 text-[11.5px] leading-snug text-gray-400">{t.description}</span>
			)}
		</motion.button>
	)
}

/** About and Style options as small chips with their color dot and count. */
function TagChip({ t, d }: { t: Tag; d: ProtoDiscover }) {
	const on = d.isOn(t)
	const n = d.countFor(t)
	const empty = !on && n === 0
	return (
		<motion.button
			type="button"
			aria-pressed={on}
			whileTap={TAP}
			onClick={() => d.toggle(t)}
			className={`flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap ring-1 transition-colors ${
				on ? "bg-amber-400/15 text-white ring-amber-400" : "bg-white/[0.04] text-gray-300 ring-white/10 hover:ring-white/30"
			} ${empty ? "opacity-40" : ""}`}
		>
			<span className="size-2 shrink-0 rounded-full" style={{ background: t.color }} />
			{t.name}
			<span className="text-[11px] font-medium text-gray-500 tabular-nums">{short(n)}</span>
		</motion.button>
	)
}

function GroupHead({ label, d, tags }: { label: string; d: ProtoDiscover; tags: Tag[] }) {
	const on = tags.filter((t) => d.isOn(t))
	return (
		<div className="mb-2 flex items-center justify-between">
			<h3 className="text-xs font-bold tracking-wide text-gray-400 uppercase">{label}</h3>
			{on.length > 0 && (
				<button
					type="button"
					onClick={() => {
						for (const t of on) d.toggle(t)
					}}
					className="text-xs font-semibold text-gray-500 hover:text-white"
				>
					Clear
				</button>
			)}
		</div>
	)
}

/** The deep filters: a button to the real Filters sheet and the active ones, each removable. */
function MoreFilters({ d, deep, onOpen }: { d: ProtoDiscover; deep: Deep; onOpen: () => void }) {
	return (
		<section>
			<div className="mb-2 flex items-center justify-between">
				<h3 className="text-xs font-bold tracking-wide text-gray-400 uppercase">More filters</h3>
				{deep.chips.length > 0 && (
					<button
						type="button"
						onClick={() => d.filters.update((s) => deep.chips.reduce((acc, c) => c.remove(acc), s))}
						className="text-xs font-semibold text-gray-500 hover:text-white"
					>
						Clear
					</button>
				)}
			</div>
			{deep.chips.length > 0 && (
				<div className="mb-2.5 flex flex-wrap gap-1.5">
					{deep.chips.map((c) => (
						<DeepChip key={c.key} chip={c} d={d} />
					))}
				</div>
			)}
			<motion.button
				type="button"
				whileTap={TAP}
				onClick={onOpen}
				className="flex h-10 w-full items-center gap-2 rounded-xl bg-gray-900 px-3 text-sm font-bold text-gray-200 ring-1 ring-white/10 hover:ring-white/30"
			>
				<AdjustmentsHorizontalIcon className="size-5 text-gray-400" />
				Services, genres, years, scores
				{deep.chips.length > 0 && (
					<span className="ml-auto rounded-full bg-amber-400 px-1.5 text-xs font-bold text-gray-950">{deep.chips.length}</span>
				)}
			</motion.button>
		</section>
	)
}

function DeepChip({ chip, d }: { chip: Deep["chips"][number]; d: ProtoDiscover }) {
	return (
		<button
			type="button"
			onClick={() => d.filters.update(chip.remove)}
			aria-label={`Remove ${chip.label}`}
			className="flex h-7 items-center gap-1 rounded-full bg-gray-800 pr-1.5 pl-2.5 text-xs font-semibold text-gray-200 hover:bg-gray-700"
		>
			{chip.label}
			<XMarkIcon className="size-3.5 text-gray-400" />
		</button>
	)
}

/** Everything the rail holds; the desktop rail and the phone sheet both show it. */
function RailBody({
	d,
	deep,
	onMoreFilters,
	withSearch,
}: {
	d: ProtoDiscover
	deep: Deep
	onMoreFilters: () => void
	withSearch: boolean
}) {
	return (
		<div className="flex flex-col gap-6">
			{withSearch && <MoodSearch d={d} />}
			<section>
				<GroupHead label={GROUP_LABEL.moods} d={d} tags={MOODS} />
				<div className="grid grid-cols-2 gap-2">
					{MOODS.map((t) => (
						<MoodTile key={tagId(t)} t={t} d={d} className="h-[5.6rem]" />
					))}
				</div>
			</section>
			<section>
				<GroupHead label={GROUP_LABEL.themes} d={d} tags={ABOUT} />
				<div className="flex flex-wrap gap-1.5">
					{ABOUT.map((t) => (
						<TagChip key={tagId(t)} t={t} d={d} />
					))}
				</div>
			</section>
			<section>
				<GroupHead label={GROUP_LABEL.styles} d={d} tags={STYLE} />
				<div className="flex flex-wrap gap-1.5">
					{STYLE.map((t) => (
						<TagChip key={tagId(t)} t={t} d={d} />
					))}
				</div>
			</section>
			<MoreFilters d={d} deep={deep} onOpen={onMoreFilters} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The main area's one line: the picked combination (each pick removable), the Read as chips while searching, the total.

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function Summary({ d, deep }: { d: ProtoDiscover; deep: Deep }) {
	const latest = useRef(d)
	latest.current = d
	const byGroup = (g: Tag["group"]) => d.picked.filter((t) => t.group === g)
	const parts = (["moods", "themes", "styles"] as const).map((g) => byGroup(g)).filter((list) => list.length)
	const anything = d.picked.length > 0 || d.q !== null || deep.chips.length > 0
	return (
		<div className="flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1.5">
			{d.q !== null && (
				<span className="flex min-w-0 flex-wrap items-center gap-1.5">
					<span className="max-w-[16rem] truncate text-sm font-semibold text-white">"{d.q}"</span>
					{d.searchBusy && !d.reading.length ? (
						<span className="text-xs text-gray-500">Reading…</span>
					) : (
						d.reading.length > 0 && <ReadAsChips reading={d.reading} />
					)}
				</span>
			)}
			{parts.map((list, i) => (
				<span key={list[0].group} className="flex flex-wrap items-center gap-1">
					{(i > 0 || d.q !== null) && <span className="text-gray-600">·</span>}
					{list[0].group === "themes" && <span className="text-sm text-gray-500">about</span>}
					{list.map((t, k) => (
						<span key={tagId(t)} className="flex items-center gap-1">
							{k > 0 && <span className="text-sm text-gray-500">or</span>}
							<button
								type="button"
								onClick={() => d.toggle(t)}
								aria-label={`Remove ${t.name}`}
								className="flex h-7 items-center gap-1 rounded-full bg-white/[0.06] pr-1.5 pl-2.5 text-[13px] font-bold text-white ring-1 ring-white/10 hover:ring-white/30"
							>
								<span className="size-2 rounded-full" style={{ background: t.color }} />
								{t.group === "themes" ? lower(t.name) : t.name}
								<XMarkIcon className="size-3.5 text-gray-400" />
							</button>
						</span>
					))}
				</span>
			))}
			{deep.chips.length > 0 && (
				<span className="flex flex-wrap items-center gap-1 lg:hidden">
					<span className="text-gray-600">·</span>
					{deep.chips.map((c) => (
						<DeepChip key={c.key} chip={c} d={d} />
					))}
				</span>
			)}
			{!d.picked.length && d.q === null && <span className="text-sm font-semibold text-gray-300">All titles</span>}
			<span className="text-sm text-gray-500 tabular-nums">
				{d.total == null ? "" : `${d.total.toLocaleString("en")} ${d.total === 1 ? "title" : "titles"}`}
			</span>
			{anything && (
				<button
					type="button"
					onClick={() => {
						// One URL write at a time: the filters first, then the query from the next render's params.
						const hadQuery = d.q !== null
						d.filters.clearSecondary()
						if (hadQuery) setTimeout(() => latest.current.setQ(null), 0)
					}}
					className="ml-auto text-sm font-semibold text-gray-400 hover:text-white"
				>
					Clear all
				</button>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

export function VariantD({ d }: { d: ProtoDiscover }) {
	const deep = useDeep(d)
	const [sheetOpen, setSheetOpen] = useState(false)
	const [phoneSheet, setPhoneSheet] = useState(-1)
	const tagCount = d.picked.length + deep.chips.length
	// The moods picked first on the phone strip, so a pick stays in view.
	const stripMoods = [...MOODS.filter((t) => d.isOn(t)), ...MOODS.filter((t) => !d.isOn(t))]

	return (
		<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-24 lg:px-8 lg:pt-6">
			<div className="lg:flex lg:items-start lg:gap-8">
				{/* Desktop rail */}
				<aside className="sticky top-16 hidden max-h-[calc(100vh-4rem)] w-[300px] shrink-0 overflow-y-auto overscroll-contain pt-1 pr-2 pb-10 lg:block [scrollbar-width:thin]">
					<RailBody d={d} deep={deep} onMoreFilters={() => setSheetOpen(true)} withSearch />
				</aside>

				<main className="min-w-0 flex-1">
					{/* Phone: search and the Tags and filters button */}
					<div className="flex gap-2 lg:hidden">
						<div className="min-w-0 flex-1">
							<MoodSearch d={d} />
						</div>
						<motion.button
							type="button"
							whileTap={TAP}
							onClick={() => setPhoneSheet(0)}
							aria-label="Tags and filters"
							className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gray-900 text-gray-200 ring-1 ring-white/10"
						>
							<AdjustmentsHorizontalIcon className="size-5" />
							{tagCount > 0 && (
								<span className="absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] font-bold text-gray-950">
									{tagCount}
								</span>
							)}
						</motion.button>
					</div>
					{/* Phone: the sticky strip of mood tiles */}
					<div className="sticky top-14 z-30 -mx-4 mt-3 bg-gray-950/95 py-2 lg:hidden">
						<div className="flex snap-x gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
							{stripMoods.map((t) => (
								<MoodTile key={tagId(t)} t={t} d={d} className="h-[4.6rem] w-[9.5rem] shrink-0 snap-start" />
							))}
							<button
								type="button"
								onClick={() => setPhoneSheet(0)}
								className="flex h-[4.6rem] w-[7rem] shrink-0 items-center justify-center rounded-2xl text-sm font-bold text-gray-300 ring-1 ring-white/10"
							>
								Tags and filters
							</button>
						</div>
					</div>

					<div className="mt-2 lg:mt-0">
						<Summary d={d} deep={deep} />
					</div>
					{d.searchError && <p className="mt-2 text-sm text-red-400">The search failed. Try again.</p>}
					<div className="mt-4">
						<ProtoGrid d={d} />
					</div>
				</main>
			</div>

			<div className="lg:hidden">
				<SnapSheet
					index={phoneSheet}
					onIndex={setPhoneSheet}
					label="Tags and filters"
					header={
						<div className="flex items-center justify-between px-4 pb-2">
							<span className={`${DISPLAY} text-lg text-white`}>Tags and filters</span>
							<button
								type="button"
								onClick={() => setPhoneSheet(-1)}
								className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-gray-950"
							>
								{d.total == null ? "Done" : `Show ${short(d.total)}`}
							</button>
						</div>
					}
				>
					<div className="px-4 pb-10">
						<RailBody
							d={d}
							deep={deep}
							withSearch={false}
							onMoreFilters={() => {
								setPhoneSheet(-1)
								setSheetOpen(true)
							}}
						/>
					</div>
				</SnapSheet>
			</div>

			<FiltersSheet
				open={sheetOpen}
				onClose={() => setSheetOpen(false)}
				data={deep.data}
				chips={deep.all}
				onClear={d.filters.clearSecondary}
			/>
		</div>
	)
}
