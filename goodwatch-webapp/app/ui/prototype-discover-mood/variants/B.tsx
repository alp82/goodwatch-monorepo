// PROTOTYPE - throwaway. Variant B, "Tag board": every mood, theme and style on one compact board with its live count,
// combined explorer style ("Funny, slow burn, about crime · 325 titles"). Once tags are picked the board folds into
// one line of picked tags with Edit tags, so the results get the screen. A smaller "Describe it" field sits on the
// board; its Read as chips join the picked tags. The real FilterBar stays below for the deep filters.
import { ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useEffect, useState } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { FilterBar, SLAB_CLEARANCE } from "~/ui/filter-bar"
import { GROUP_LABEL, ProtoGrid, type ProtoDiscover, short, type Tag, type TagGroup, TAGS, tagId } from "../kit"

export const NAME = "Tag board"

const GROUPS: TagGroup[] = ["moods", "themes", "styles"]
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** The combination in words: "Funny or Scary, slow burn, about crime". Within a group a title fits any pick. */
function combinationWords(picked: Tag[]) {
	const of = (g: TagGroup) => picked.filter((t) => t.group === g).map((t) => t.name)
	const parts: string[] = []
	const moods = of("moods")
	const styles = of("styles").map(lower)
	const themes = of("themes").map(lower)
	if (moods.length) parts.push(moods.join(" or "))
	if (styles.length) parts.push(styles.join(" or "))
	if (themes.length) parts.push(`about ${themes.join(" or ")}`)
	const line = parts.join(", ")
	return line.charAt(0).toUpperCase() + line.slice(1)
}

const titlesWord = (n: number | null) => (n == null ? "…" : `${short(n)} ${n === 1 ? "title" : "titles"}`)

function TagChip({ t, d, removable = false }: { t: Tag; d: ProtoDiscover; removable?: boolean }) {
	const on = d.isOn(t)
	const count = d.countFor(t)
	const empty = !on && count === 0
	return (
		<button
			type="button"
			aria-pressed={on}
			disabled={empty}
			title={t.description}
			onClick={() => d.toggle(t)}
			className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full pr-2.5 pl-2 text-sm font-semibold whitespace-nowrap ring-1 ring-inset transition-[opacity,background-color] ${FOCUS} ${
				on ? "text-white" : "bg-white/[0.04] text-gray-200 ring-white/10 hover:bg-white/[0.09]"
			} ${empty ? "cursor-default opacity-30" : ""}`}
			style={
				on
					? {
							background: `color-mix(in srgb, ${t.color} 30%, transparent)`,
							boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${t.color} 75%, transparent)`,
						}
					: undefined
			}
		>
			<span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
			{t.name}
			{removable ? (
				<XMarkIcon className="h-3.5 w-3.5 text-white/70" aria-label="Remove" />
			) : (
				count != null && (
					<span className={`text-xs tabular-nums ${on ? "text-white/80" : "text-gray-400"}`}>{short(count)}</span>
				)
			)}
		</button>
	)
}

function DescribeField({ d, className = "" }: { d: ProtoDiscover; className?: string }) {
	const [text, setText] = useState(d.q ?? "")
	useEffect(() => setText(d.q ?? ""), [d.q])
	return (
		<form
			role="search"
			onSubmit={(event) => {
				event.preventDefault()
				d.setQ(text)
			}}
			className={`flex h-10 items-center gap-2 rounded-lg bg-gray-900 px-3 ring-1 ring-inset ring-white/10 focus-within:ring-amber-400/70 ${className}`}
		>
			<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
			<input
				value={text}
				onChange={(event) => setText(event.target.value)}
				onBlur={() => text.trim() !== (d.q ?? "") && d.setQ(text)}
				placeholder="Describe it: cozy rainy day mystery"
				aria-label="Describe it"
				className="search-private ph-no-capture sentry-mask min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
			/>
			{d.searchBusy && <span className="shrink-0 text-xs text-gray-400">Reading…</span>}
			{d.q && (
				<button
					type="button"
					aria-label="Clear the description"
					onClick={() => d.setQ(null)}
					className={`grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full text-gray-400 hover:bg-white/10 hover:text-white ${FOCUS}`}
				>
					<XMarkIcon className="h-4 w-4" />
				</button>
			)}
		</form>
	)
}

/** One group of the board: a label and its tags. Phones scroll each group sideways in one row. */
function GroupRow({ group, d }: { group: TagGroup; d: ProtoDiscover }) {
	const tags = TAGS.filter((t) => t.group === group)
	const picks = d.picked.filter((t) => t.group === group).length
	return (
		<div className="flex items-start gap-3">
			<span className="hidden w-14 shrink-0 pt-1.5 text-xs font-semibold tracking-wide text-gray-400 uppercase sm:block">
				{GROUP_LABEL[group]}
				{picks > 0 && <span className="ml-1 text-amber-300">{picks}</span>}
			</span>
			<div className="-mx-4 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
				<span className="shrink-0 self-center text-xs font-semibold tracking-wide text-gray-400 uppercase sm:hidden">
					{GROUP_LABEL[group]}
				</span>
				{tags.map((t) => (
					<TagChip key={tagId(t)} t={t} d={d} />
				))}
			</div>
		</div>
	)
}

/** What's combined: the picked tags in words, the description, and the total. */
function CombinationLine({ d, children }: { d: ProtoDiscover; children?: ReactNode }) {
	const words = combinationWords(d.picked)
	return (
		<div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
			<span className="text-lg font-bold text-white sm:text-xl">
				{d.q && <span className="text-amber-200">“{d.q}”</span>}
				{d.q && words && <span className="text-gray-500"> + </span>}
				{words}
				{(d.q || words) && <span className="text-gray-500"> · </span>}
				<span className="tabular-nums text-[#fff4d6]">{titlesWord(d.total)}</span>
			</span>
			{children}
		</div>
	)
}

export function VariantB({ d }: { d: ProtoDiscover }) {
	const combined = d.picked.length > 0 || d.q !== null
	const [folded, setFolded] = useState(false)
	// Nothing picked, nothing described: the board is all there is to start from.
	useEffect(() => {
		if (!combined) setFolded(false)
	}, [combined])
	const reading = d.q && d.reading.length ? <ReadAsChips reading={d.reading} className="items-center" /> : null

	return (
		<div className={`mx-auto max-w-[1600px] px-4 pt-4 lg:px-8 ${SLAB_CLEARANCE}`}>
			{folded ? (
				<section aria-label="Your combination" className="flex flex-col gap-2 border-b border-white/10 pb-3">
					<CombinationLine d={d} />
					<div className="-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
						{d.picked.map((t) => (
							<TagChip key={tagId(t)} t={t} d={d} removable />
						))}
						{reading && <div className="shrink-0">{reading}</div>}
						<button
							type="button"
							onClick={() => setFolded(false)}
							className={`flex h-8 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-gray-800 px-3 text-sm font-semibold text-gray-100 hover:bg-gray-700 ${FOCUS}`}
						>
							Edit tags
							<ChevronDownIcon className="h-4 w-4" aria-hidden />
						</button>
					</div>
				</section>
			) : (
				<section aria-label="Tags" className="flex flex-col gap-2.5 border-b border-white/10 pb-3">
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
						{combined ? (
							<CombinationLine d={d}>
								<button
									type="button"
									onClick={() => {
										d.clearTags()
										d.setQ(null)
									}}
									className={`cursor-pointer text-sm font-semibold text-gray-400 hover:text-white ${FOCUS}`}
								>
									Clear
								</button>
							</CombinationLine>
						) : (
							<h1 className="text-lg font-bold text-white sm:text-xl">
								Combine tags <span className="text-gray-500">·</span>{" "}
								<span className="tabular-nums text-[#fff4d6]">{titlesWord(d.total)}</span>
							</h1>
						)}
						<DescribeField d={d} className="sm:w-80 lg:w-96" />
					</div>
					{reading}
					{GROUPS.map((g) => (
						<GroupRow key={g} group={g} d={d} />
					))}
					{combined && (
						<div className="flex justify-end">
							<button
								type="button"
								onClick={() => setFolded(true)}
								className={`h-9 cursor-pointer rounded-md bg-amber-400 px-4 text-sm font-bold text-gray-950 hover:bg-amber-300 ${FOCUS}`}
							>
								Show {titlesWord(d.total)}
							</button>
						</div>
					)}
				</section>
			)}
			<div className="mt-3">
				<FilterBar filters={d.filters} counts={d.counts} />
			</div>
			<div className="mt-4">
				<ProtoGrid d={d} />
			</div>
		</div>
	)
}
