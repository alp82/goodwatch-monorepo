// PROTOTYPE - throwaway. Variant A, "Ask first": the mood search is the hero. Browsing, example prompts and one row
// of mood tags are the two ways in. Searching, the reading and "Narrow it" tags (the best counts for the results)
// refine it. Deep filters sit behind one quiet Filters button (the real Filters sheet); active ones stay as chips.
import {
	AdjustmentsHorizontalIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import { useEffect, useMemo, useRef, useState } from "react"
import { SEARCH_MAX_CHARS } from "~/domain/discover-search"
import { stateAsApplied } from "~/domain/filter-state"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FiltersSheet, activeChips, useMyServices } from "~/ui/filter-bar"
import type { FilterGroupsData } from "~/ui/filter-bar/FilterGroups"
import { usePeopleNames, useTitleNames } from "~/ui/filter-bar/useFilterData"
import {
	EXAMPLE_PROMPTS,
	ProtoGrid,
	type ProtoDiscover,
	TAGS,
	type Tag,
	short,
	tagId,
} from "../kit"

export const NAME = "Ask first"

const COMMIT_MS = 800
const PRIVATE = "search-private ph-no-capture sentry-mask"
const MOOD_TAGS = TAGS.filter((t) => t.group === "moods")
const SUGGESTIONS = 8
const CHIP =
	"inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 text-sm font-semibold outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"
const LABEL = "shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500"

// ---------------------------------------------------------------------------------------------------------------

function AskField({ d }: { d: ProtoDiscover }) {
	const [draft, setDraft] = useState(d.q ?? "")
	const timer = useRef<ReturnType<typeof setTimeout>>()
	const input = useRef<HTMLInputElement>(null)
	const last = useRef(d.q ?? "")
	// Follow the URL when the query changes elsewhere (an example prompt, back and forward).
	useEffect(() => {
		const shown = d.q ?? ""
		if (last.current === shown) return
		last.current = shown
		setDraft(shown)
	}, [d.q])
	useEffect(() => () => clearTimeout(timer.current), [])

	const run = (text: string) => {
		const trimmed = text.trim()
		if (trimmed === (d.q ?? "")) return
		last.current = trimmed
		d.setQ(trimmed || null)
	}
	const clear = () => {
		clearTimeout(timer.current)
		last.current = ""
		setDraft("")
		d.setQ(null)
		input.current?.focus()
	}
	const searching = d.q !== null

	return (
		<div className="group/ask">
			<div className={`flex h-16 w-full min-w-0 items-center gap-3 lg:h-20 ${PRIVATE}`}>
				<MagnifyingGlassIcon
					className={`h-6 w-6 shrink-0 ${searching ? "text-amber-400" : "text-gray-400"}`}
					aria-hidden
				/>
				<input
					ref={input}
					type="search"
					aria-label="Search by mood"
					value={draft}
					autoComplete="off"
					enterKeyHint="search"
					maxLength={SEARCH_MAX_CHARS}
					data-ph-no-capture
					placeholder="What are you in the mood for?"
					onChange={(e) => {
						const text = e.target.value
						setDraft(text)
						clearTimeout(timer.current)
						timer.current = setTimeout(() => run(text), COMMIT_MS)
					}}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault()
							clearTimeout(timer.current)
							run(draft)
							input.current?.blur()
						}
						if (e.key === "Escape") {
							e.preventDefault()
							clearTimeout(timer.current)
							setDraft(d.q ?? "")
							input.current?.blur()
						}
					}}
					className="brand-header h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[26px] leading-tight text-white outline-none placeholder:text-gray-500 focus:ring-0 sm:text-[32px] lg:text-[42px] [&::-webkit-search-cancel-button]:hidden"
				/>
				{(searching || draft) && (
					<button
						type="button"
						onMouseDown={(e) => e.preventDefault()}
						onClick={clear}
						aria-label="Clear the search"
						className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 outline-none transition-colors cursor-pointer hover:bg-amber-400/10 hover:text-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						<XMarkIcon className="h-4 w-4" aria-hidden />
						<span className="hidden sm:inline">Clear</span>
					</button>
				)}
			</div>
			<div className="h-px bg-linear-to-r from-white/25 via-white/10 to-transparent transition-colors group-focus-within/ask:from-amber-400/80 group-focus-within/ask:via-amber-400/20" />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function TagChip({
	tag,
	on,
	count,
	onClick,
}: {
	tag: Tag
	on: boolean
	count?: number | null
	onClick: () => void
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={on}
			title={tag.description}
			aria-label={on ? `Remove ${tag.name}` : tag.name}
			className={`${CHIP} ${on ? "text-white ring-1 ring-inset" : "bg-white/[0.06] text-gray-200 hover:bg-white/10 hover:text-white"}`}
			style={on ? { background: `${tag.color}2e`, boxShadow: `inset 0 0 0 1px ${tag.color}99` } : undefined}
		>
			<span className="h-2 w-2 rounded-full" style={{ background: tag.color }} />
			{tag.name}
			{on ? (
				<XMarkIcon className="h-3.5 w-3.5 text-gray-300" aria-hidden />
			) : count != null ? (
				<span className="text-xs font-normal tabular-nums text-gray-500">{short(count)}</span>
			) : null}
		</button>
	)
}

/** One line: scrolls sideways on phones, wraps on desktop. */
function Row({ children, label }: { children: React.ReactNode; label?: string }) {
	return (
		<div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
			{label && <span className={`${LABEL} mr-1`}>{label}</span>}
			{children}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function useDeepFilters(d: ProtoDiscover) {
	const { filters, counts } = d
	const { state } = filters
	const services = useMyServices({ country: state.streamingCountry, include: state.services })
	const titles = useTitleNames([...(state.similarTo ?? []), ...(state.loved ?? []), ...(state.disliked ?? [])], "")
	const people = usePeopleNames(state.people ?? [], "")
	const ladder = counts?.ladder ?? null
	const applied = useMemo(() => stateAsApplied(state, ladder), [state, ladder])
	const all = useMemo(
		() =>
			activeChips(applied, {
				service: (id) => services.countryProviders.find((p) => p.id === id)?.name,
				serviceLogo: (id) => services.countryProviders.find((p) => p.id === id)?.logo_path,
				title: (key) => titles.byKey.get(key)?.title,
				poster: (key) => titles.byKey.get(key)?.poster,
				person: (id) => people.byId.get(id)?.name,
			}),
		[applied, services.countryProviders, titles.byKey, people.byId],
	)
	// Tags show in the refinement row, so the deep filters are everything else.
	const chips = all.filter((c) => !/^(mood|theme|style)-/.test(c.key))
	const data: FilterGroupsData = {
		state,
		counts,
		onChange: (next) => filters.update(() => next),
		myServices: services.ids,
		countryProviders: services.countryProviders,
		streamingCountry: services.country,
		taste: "signUp",
		ladder,
	}
	const clear = () => filters.update((s) => chips.reduce((acc, c) => c.remove(acc), s))
	return { all, chips, data, clear }
}

function DeepFilters({ d }: { d: ProtoDiscover }) {
	const [open, setOpen] = useState(false)
	const { all, chips, data, clear } = useDeepFilters(d)
	return (
		<>
			<Row>
				<button
					type="button"
					onClick={() => setOpen(true)}
					aria-haspopup="dialog"
					aria-expanded={open}
					className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-gray-400 outline-none transition-colors cursor-pointer hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden />
					Filters
					{chips.length > 0 && (
						<span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-xs tabular-nums text-gray-950">
							{chips.length}
						</span>
					)}
				</button>
				{chips.map((chip) => (
					<button
						key={chip.key}
						type="button"
						onClick={() => d.filters.update((s) => chip.remove(s))}
						aria-label={`Remove ${chip.label}`}
						className="group inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.06] pl-3 pr-2 text-sm text-gray-100 cursor-pointer outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						{chip.label}
						<XMarkIcon className="h-3.5 w-3.5 text-gray-500 group-hover:text-white" aria-hidden />
					</button>
				))}
				{chips.length > 1 && (
					<button type="button" onClick={clear} className="shrink-0 px-1 text-sm text-gray-500 cursor-pointer hover:text-white">
						Clear filters
					</button>
				)}
				<span className="ml-auto shrink-0 pl-2 text-sm tabular-nums text-gray-500">
					{d.total == null ? "" : `${short(d.total)} ${d.total === 1 ? "title" : "titles"}`}
				</span>
			</Row>
			<FiltersSheet open={open} onClose={() => setOpen(false)} data={data} chips={all} onClear={d.filters.clearSecondary} />
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function Browsing({ d }: { d: ProtoDiscover }) {
	const anyPicked = d.picked.length > 0
	// Tags picked from other groups (kept from an earlier search) lead the row so they can come off.
	const others = d.picked.filter((t) => t.group !== "moods")
	return (
		<div className="space-y-4">
			<Row>
				{EXAMPLE_PROMPTS.slice(0, 5).map((prompt) => (
					<button
						key={prompt}
						type="button"
						onClick={() => d.setQ(prompt)}
						className="h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-sm text-gray-400 ring-1 ring-inset ring-white/10 outline-none transition-colors cursor-pointer hover:text-white hover:ring-white/25 focus-visible:ring-2 focus-visible:ring-amber-400"
					>
						{prompt}
					</button>
				))}
			</Row>
			<Row>
				{others.map((t) => (
					<TagChip key={tagId(t)} tag={t} on onClick={() => d.toggle(t)} />
				))}
				{MOOD_TAGS.map((t) => {
					const on = d.isOn(t)
					const count = anyPicked && !on ? d.countFor(t) : null
					if (count === 0) return null
					return <TagChip key={tagId(t)} tag={t} on={on} count={count} onClick={() => d.toggle(t)} />
				})}
			</Row>
		</div>
	)
}

function Searching({ d }: { d: ProtoDiscover }) {
	const total = d.total
	const suggestions = useMemo(() => {
		if (total == null) return []
		return TAGS.filter((t) => !d.isOn(t))
			.map((t) => ({ t, n: d.countFor(t) }))
			.filter((x): x is { t: Tag; n: number } => x.n != null && x.n > 0 && x.n < total)
			.sort((a, b) => b.n - a.n)
			.slice(0, SUGGESTIONS)
		// d changes every render; the counts come with total.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [total, d.counts, d.picked.map(tagId).join()])

	return (
		<div className="space-y-3">
			<div className="flex min-h-6 items-center gap-2">
				<span className={LABEL}>Read as</span>
				{d.reading.length ? (
					<ReadAsChips reading={d.reading} />
				) : (
					<span className="text-xs text-gray-500">{d.searchError ? "Couldn’t read that" : d.searchBusy ? "Reading…" : ""}</span>
				)}
			</div>
			<Row label="Narrow it">
				{d.picked.map((t) => (
					<TagChip key={tagId(t)} tag={t} on onClick={() => d.toggle(t)} />
				))}
				{suggestions.map(({ t, n }) => (
					<TagChip key={tagId(t)} tag={t} on={false} count={n} onClick={() => d.toggle(t)} />
				))}
			</Row>
		</div>
	)
}

export function VariantA({ d }: { d: ProtoDiscover }) {
	return (
		<div className="mx-auto max-w-[1600px] px-4 pt-4 pb-16 lg:px-8">
			<AskField d={d} />
			<div className="mt-4">{d.q === null ? <Browsing d={d} /> : <Searching d={d} />}</div>
			<div className="mt-3 border-t border-white/5 pt-2">
				<DeepFilters d={d} />
			</div>
			<div className="mt-3">
				<ProtoGrid d={d} />
			</div>
		</div>
	)
}
