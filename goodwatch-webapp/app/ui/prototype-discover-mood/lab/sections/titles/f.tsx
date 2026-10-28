// PROTOTYPE (Discover lab, titles f): the grid is the preview. A pause in typing (0.7 s, three letters or more) runs
// the text as the search, so the results grid under the panel is the preview and there is no search card at all.
// Clearing the field clears the search. The panel only holds what the grid can't: titles to steer with (thumbs and
// Similar to) and people whose name matches, plus one live line on top with how the grid reads the text and its count.
import { ArrowDownIcon, FilmIcon, UserIcon } from "@heroicons/react/20/solid"
import { useEffect, useRef } from "react"
import { searchText } from "~/domain/discover-search"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { short } from "../../../kit"
import { type FoundTitle, liveTitleUrl, useQuickTitles } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { NameExamples, PeopleLoading, PersonTile, PickedFace, usePeople } from "../people/shared"
import { EmptySlots, Poster, SteerButtons, SteerTray, metaLine, useExampleTitles } from "./def-steer"
import { LaneHead, type TitleUses, useKnown, useTitleUses } from "./shared"

/** Runs the bar's text as the search after a pause; an empty field clears it. */
function useLiveSearch(text: string, q: string | null, run: (t: string) => void) {
	const runRef = useRef(run)
	runRef.current = run
	useEffect(() => {
		const t = searchText(text)
		if (t === q) return
		if (t !== null && t.length < 3) return
		const id = setTimeout(() => runRef.current(t ?? ""), 700)
		return () => clearTimeout(id)
	}, [text, q])
}

function LiveLine({ d, pending, phone = false }: { d: SectionProps["d"]; pending: boolean; phone?: boolean }) {
	const busy = pending || d.searchBusy || d.loading
	return (
		<div className={`flex min-w-0 gap-3 ${phone ? "flex-col items-start" : "h-8 items-center overflow-hidden"}`}>
			<span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold tabular-nums text-gray-200">
				<span className="relative grid h-5 w-5 place-items-center">
					{busy && <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/30 motion-reduce:animate-none" />}
					<ArrowDownIcon className={`relative h-4 w-4 ${busy ? "text-amber-300" : "text-gray-400"}`} aria-hidden />
				</span>
				<span className={busy ? "opacity-50 transition-opacity" : ""}>{d.total != null ? `${short(d.total)} titles` : "…"}</span>
			</span>
			{d.q && d.reading.length > 0 && (
				<span className={`flex min-w-0 gap-1.5 overflow-hidden ${pending ? "opacity-40" : ""}`}>
					<ReadAsChips reading={d.reading} />
				</span>
			)}
		</div>
	)
}

function TitleTile({ t, uses, onUse, w }: { t: FoundTitle; uses: TitleUses; onUse: () => void; w: number }) {
	return (
		<div className="flex shrink-0 flex-col gap-1.5" style={{ width: w + 24 }}>
			<a href={liveTitleUrl(t)} target="_blank" rel="noreferrer" className="block self-start rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
				<Poster t={t} w={w} use={uses.usesOf(t.key)[0]} />
			</a>
			<span className="min-w-0">
				<span className="block truncate text-[13px] font-semibold text-gray-100">{t.title}</span>
				<span className="block text-[11px] text-gray-500">{metaLine(t)}</span>
			</span>
			<SteerButtons t={t} uses={uses} onUse={onUse} compact />
		</div>
	)
}

export function TitlesF({ d, phone, text, setText, runSearch }: SectionProps) {
	const typed = text.trim()
	useLiveSearch(text, d.q, runSearch)
	const pending = (searchText(text) ?? null) !== d.q && (typed.length >= 3 || typed.length === 0)
	const titles = useQuickTitles(text)
	const examples = useExampleTitles(phone ? 4 : 6)
	const people = usePeople(d, text)
	const uses = useTitleUses(d)
	const known = useKnown(uses.picked.map((p) => p.key))
	const asking = typed.length >= 2
	const list = asking ? titles.found.slice(0, phone ? 4 : 6) : examples
	const w = phone ? 72 : 92

	const titleLane = (
		<div className="min-w-0">
			<LaneHead icon={<FilmIcon />}>Titles</LaneHead>
			{asking && titles.found.length === 0 ? (
				<p className="px-1 py-3 text-[13px] text-gray-500">{titles.loading ? "Looking…" : "No title by that name"}</p>
			) : (
				<div className={`flex gap-3 px-1 ${phone ? "flex-wrap" : "overflow-hidden"} ${titles.loading && asking ? "opacity-70 transition-opacity" : ""}`}>
					{list.map((t) => (
						<TitleTile key={t.key} t={t} uses={uses} onUse={() => known.remember(t)} w={w} />
					))}
				</div>
			)}
		</div>
	)

	const peopleLane = (
		<div className="min-w-0">
			<LaneHead icon={<UserIcon />}>People</LaneHead>
			{!people.asking || (!people.loading && people.found.length === 0) ? (
				<div className="px-1">
					<NameExamples onPick={setText} />
				</div>
			) : people.found.length > 0 ? (
				<div className={`grid grid-cols-2 gap-x-2 ${people.loading ? "opacity-70 transition-opacity" : ""}`}>
					{people.found.slice(0, 6).map((p) => (
						<PersonTile key={p.id} p={p} on={people.has(p.id)} onToggle={() => people.toggle(p)} size={40} />
					))}
				</div>
			) : (
				<div className="grid grid-cols-2">
					<PeopleLoading n={4} size={40} />
				</div>
			)}
		</div>
	)

	const extra =
		people.chosen.length > 0 ? (
			<>
				{people.chosen.map((id) => (
					<PickedFace key={id} id={id} p={people.known(id)} onRemove={() => people.remove(id)} />
				))}
			</>
		) : undefined
	const tray = <SteerTray uses={uses} known={known.known} extra={extra} empty={<EmptySlots />} wrap={phone} />

	if (phone)
		return (
			<div className="flex flex-col gap-6">
				<LiveLine d={d} pending={pending} phone />
				{titleLane}
				{peopleLane}
				{tray}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-12 shrink-0 items-center border-b border-white/[0.04] px-6">
				<LiveLine d={d} pending={pending} />
			</div>
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
				<div className="min-h-0 overflow-hidden border-r border-white/[0.06] px-6 py-4">{titleLane}</div>
				<div className="min-h-0 overflow-hidden px-5 py-4">{peopleLane}</div>
			</div>
			<div className="flex h-14 shrink-0 items-center border-t border-white/[0.06] px-6">{tray}</div>
		</div>
	)
}
