// PROTOTYPE (Discover lab, titles d): the bar is the search. The panel never repeats the field or its text; it shows
// only what the text would do. Left: how the text reads (Read as chips from the cheap preview), the first posters it
// returns, and one action with the count. Right: titles whose name matches, to steer with the thumbs or Similar to.
// Every pick lands as a filter chip in the funnel tray at the bottom.
import { ArrowTurnDownLeftIcon, CheckIcon, FilmIcon, SparklesIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { TitleCard } from "~/server/title-cards.server"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { TAP } from "~/ui/filter-bar/motion"
import { EXAMPLE_PROMPTS, short } from "../../../kit"
import { type FoundTitle, POSTER_SM, PosterThumb, TitleRowsLoading, liveTitleUrl, useQuickTitles } from "../../shell-parts"
import type { SectionProps } from "../../types"
import { EmptySlots, SteerButtons, SteerTray, metaLine, useExampleTitles } from "./def-steer"
import { LaneHead, type TitleUses, useKnown, useSearchPreview, useTitleUses } from "./shared"

function ReadingSkeleton() {
	return (
		<span className="flex gap-1.5">
			{[72, 96, 64].map((w) => (
				<span key={w} className="h-7 animate-pulse rounded-full bg-white/[0.06] motion-reduce:animate-none" style={{ width: w }} />
			))}
		</span>
	)
}

function PosterStrip({ cards, n, w, busy }: { cards: Pick<TitleCard, "key" | "title" | "poster_path">[]; n: number; w: number; busy: boolean }) {
	const h = Math.round(w * 1.5)
	return (
		<div className="flex items-center gap-2.5 overflow-hidden" style={{ height: h }}>
			{cards.slice(0, n).map((c) => (
				<span key={c.key} className="block shrink-0 overflow-hidden rounded-lg bg-white/[0.06] ring-1 ring-white/10" style={{ width: w, height: h }} title={c.title}>
					{c.poster_path ? (
						<img src={`${POSTER_SM}${c.poster_path}`} alt={c.title} loading="lazy" className="h-full w-full object-cover" />
					) : (
						<span className="grid h-full place-items-center p-1 text-center text-[9px] text-gray-500">{c.title}</span>
					)}
				</span>
			))}
			{cards.length === 0 &&
				Array.from({ length: n }, (_, i) => (
					<span
						// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
						key={i}
						className={`shrink-0 rounded-lg bg-white/[0.04] ${busy ? "animate-pulse motion-reduce:animate-none" : ""}`}
						style={{ width: w, height: h }}
					/>
				))}
		</div>
	)
}

function TitleLine({ t, uses, onUse, phone }: { t: FoundTitle; uses: TitleUses; onUse: () => void; phone: boolean }) {
	return (
		<div className={`flex min-w-0 rounded-xl px-2 hover:bg-white/[0.04] ${phone ? "flex-col gap-2 py-2" : "h-[58px] items-center gap-3"}`}>
			<a href={liveTitleUrl(t)} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
				<PosterThumb poster={t.poster} title={t.title} className="h-[48px] w-8" />
				<span className="min-w-0">
					<span className="block truncate text-[14px] font-semibold text-gray-100">{t.title}</span>
					<span className="block text-[12px] text-gray-500">{metaLine(t)}</span>
				</span>
			</a>
			<div className={phone ? "pl-11" : ""}>
				<SteerButtons t={t} uses={uses} onUse={onUse} />
			</div>
		</div>
	)
}

export function TitlesD({ d, phone, text, setText, runSearch }: SectionProps) {
	const typed = text.trim()
	const running = d.q !== null && typed === d.q
	const typing = typed.length >= 3 && !running
	const preview = useSearchPreview(d, text)
	const titles = useQuickTitles(text)
	const examples = useExampleTitles(4)
	const uses = useTitleUses(d)
	const known = useKnown(uses.picked.map((p) => p.key))
	const asking = typed.length >= 2
	// No title by that name (a description): the examples stay, so there is always something to steer with.
	const matched = asking && titles.found.length > 0
	const list = matched ? titles.found.slice(0, 4) : examples
	const n = phone ? 4 : 9
	const w = phone ? 64 : 78

	const reading = running ? d.reading : preview.reading
	const cards = running ? d.cards : preview.ready ? preview.cards : []
	const total = running ? d.total : preview.ready ? preview.total : null
	const busy = running ? d.searchBusy || d.loading : preview.busy

	const reads = (
		<div className="min-w-0">
			<LaneHead icon={<SparklesIcon />}>{typing || running ? "Reads as" : "Ideas"}</LaneHead>
			{typing || running ? (
				<div className="flex flex-col gap-4">
					<div className="flex h-8 min-w-0 items-center gap-1.5 overflow-hidden px-1">
						{reading.length > 0 ? <ReadAsChips reading={reading} /> : busy ? <ReadingSkeleton /> : <span className="text-[13px] text-gray-500">Free text</span>}
					</div>
					<div className="px-1">
						<PosterStrip cards={cards} n={n} w={w} busy={busy} />
					</div>
					<div className="px-1">
						{running ? (
							<span className="inline-flex h-12 items-center gap-2 rounded-2xl bg-white/[0.05] px-4 text-[15px] font-semibold text-gray-300">
								<CheckIcon className="h-4 w-4 text-amber-400" aria-hidden />
								{total != null ? `${short(total)} titles below` : "Below"}
							</span>
						) : (
							<motion.button
								type="button"
								whileTap={TAP}
								onClick={() => runSearch(typed)}
								className="inline-flex h-12 items-center gap-3 rounded-2xl bg-amber-400 px-5 text-[15px] font-bold text-gray-950 cursor-pointer outline-none hover:bg-amber-300 focus-visible:ring-2 focus-visible:ring-white"
							>
								{total != null ? `Show ${short(total)} titles` : "Show titles"}
								<kbd className="hidden items-center rounded-md bg-black/15 px-1.5 py-0.5 font-sans text-xs sm:flex">
									<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
								</kbd>
							</motion.button>
						)}
					</div>
				</div>
			) : (
				<div className="flex flex-wrap gap-2 px-1">
					{EXAMPLE_PROMPTS.slice(0, phone ? 5 : 8).map((p) => (
						<button
							key={p}
							type="button"
							onClick={() => setText(p)}
							className="h-10 rounded-full bg-white/[0.05] px-4 text-[14px] text-gray-300 ring-1 ring-inset ring-white/[0.08] cursor-pointer outline-none hover:bg-white/[0.1] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							{p}
						</button>
					))}
				</div>
			)}
		</div>
	)

	const found = (
		<div className="min-w-0">
			<LaneHead icon={<FilmIcon />}>{matched ? "Titles" : "Steer with a title"}</LaneHead>
			{asking && !matched && titles.loading ? (
				<TitleRowsLoading n={4} />
			) : (
				<div className={titles.loading && asking ? "opacity-70 transition-opacity" : ""}>
					{list.map((t) => (
						<TitleLine key={t.key} t={t} uses={uses} onUse={() => known.remember(t)} phone={phone} />
					))}
				</div>
			)}
		</div>
	)

	const tray = <SteerTray uses={uses} known={known.known} empty={<EmptySlots />} wrap={phone} />

	if (phone)
		return (
			<div className="flex flex-col gap-7">
				{reads}
				{found}
				{tray}
			</div>
		)
	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
				<div className="min-h-0 overflow-hidden border-r border-white/[0.06] px-6 py-5">{reads}</div>
				<div className="min-h-0 overflow-hidden px-5 py-5">{found}</div>
			</div>
			<div className="flex h-14 shrink-0 items-center border-t border-white/[0.06] px-6">{tray}</div>
		</div>
	)
}
