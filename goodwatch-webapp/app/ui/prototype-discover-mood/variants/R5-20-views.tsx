// PROTOTYPE - throwaway. Round 5 variant 20, the panel's views: each tab's home (its most used controls on the left,
// its sub-categories as tiles with live values on the right), the drilled-in view of one sub-category, the path row
// ("Watched › Scores" with a back step and the Find a filter field), and Find a filter results.
import { ArrowTurnDownLeftIcon, ChevronLeftIcon, ChevronRightIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import { type ReactNode, useRef, useState } from "react"
import { FilterGroups } from "~/ui/filter-bar"
import type { CardKey } from "~/ui/filter-bar/filter-cards"
import { FilterSearchField } from "~/ui/filter-bar/FilterGroups"
import { ServiceStack } from "~/ui/filter-bar/controls"
import { FILTER_ACCENTS } from "~/ui/filter-bar/labels"
import { TAP } from "~/ui/filter-bar/motion"
import type { TitleKey } from "~/utils/title-key"
import { type ProtoDiscover, tagId } from "../kit"
import { MoodLane, SimilarLane, TitleLane } from "./R5-20-lanes"
import {
	ClearLink,
	CountryLine,
	type FoundTitle,
	GenreControl,
	MOOD_TAGS,
	NotSeenControl,
	OneCard,
	PRIVATE,
	type Pieces,
	ReleasedControl,
	SEG_LABEL,
	ScoreControl,
	type SegKey,
	ServiceLogos,
	StreamingModes,
	type Sub,
	type SubId,
	SubHead,
	TagChips,
	TagChipsBare,
	TypeControl,
	chipsOf,
	clearCard,
	subValues,
	subsFor,
	useKeepTop,
	useQuickTitles,
	useSimilar,
	useStreaming,
} from "./R5-20-parts"

/** What the Search views share: the bar's text, and titles seen in results (so picked posters keep their names). */
export interface SearchCtx {
	text: string
	typing: boolean
	onRun: (t: string) => void
	onFill: (t: string) => void
	titles: ReturnType<typeof useQuickTitles>
	similar: ReturnType<typeof useSimilar>
	seen: Map<TitleKey, FoundTitle>
	onSeen: (t: FoundTitle) => void
	/** Phones: the field sits inside the Search home. */
	input?: ReactNode
}

export function useSearchCtx(d: ProtoDiscover, text: string, typing: boolean, onRun: (t: string) => void, onFill: (t: string) => void) {
	const similar = useSimilar(d)
	const titles = useQuickTitles(text)
	const [seen, setSeen] = useState(() => new Map<TitleKey, FoundTitle>())
	const onSeen = (t: FoundTitle) => setSeen((m) => new Map(m).set(t.key, t))
	return { text, typing, onRun, onFill, titles, similar, seen, onSeen } satisfies SearchCtx
}

// ---------------------------------------------------------------------------------------------------------------
// Path row

export function PathRow({
	seg,
	sub,
	find,
	onFind,
	onHome,
	onBack,
	phone,
	findRef,
}: {
	seg: SegKey
	sub: Sub | null
	find: string
	onFind: (t: string) => void
	onHome: () => void
	onBack: () => void
	phone: boolean
	findRef?: React.RefObject<HTMLInputElement>
}) {
	const finding = find.trim() !== ""
	const deep = !!sub || finding
	const crumbs = (
		<nav aria-label="Path" className="flex min-w-0 items-center gap-1 text-[15px]">
			<button
				type="button"
				onClick={onHome}
				disabled={!deep}
				className={`shrink-0 rounded-md px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
					deep ? "text-gray-400 cursor-pointer hover:text-white" : "font-semibold text-white"
				}`}
			>
				{SEG_LABEL[seg]}
			</button>
			{sub && !finding && (
				<>
					<ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-600" aria-hidden />
					<span className="truncate px-1 font-semibold text-white" aria-current="page">
						{sub.label}
					</span>
				</>
			)}
			{finding && (
				<>
					<ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-600" aria-hidden />
					<span className={`truncate px-1 font-semibold text-white ${PRIVATE}`} aria-current="page">
						Filters matching “{find.trim()}”
					</span>
				</>
			)}
		</nav>
	)
	const back = (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onBack}
			aria-label="Back"
			className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-gray-200 ring-1 ring-white/10 cursor-pointer outline-none hover:bg-white/[0.12] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<ChevronLeftIcon className="h-5 w-5" />
		</motion.button>
	)
	const field = <FilterSearchField value={find} onChange={onFind} inputRef={findRef} className="h-10" />
	if (phone)
		return (
			<div className="flex flex-col gap-2 px-4 pb-2">
				{field}
				{deep && (
					<div className="flex h-10 items-center gap-2">
						{back}
						{crumbs}
					</div>
				)}
			</div>
		)
	return (
		<div className="flex h-[60px] shrink-0 items-center gap-2.5 border-b border-white/[0.07] px-5">
			<div className="flex w-9 shrink-0 justify-center">{deep && back}</div>
			{crumbs}
			<div className="ml-auto w-[min(360px,40%)] shrink-0">{field}</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Tiles

function Badge({ n }: { n: number }) {
	if (!n) return null
	return (
		<span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-gray-950 tabular-nums">
			{n}
		</span>
	)
}

function Preview({ d, pieces, sub }: { d: ProtoDiscover; pieces: Pieces; sub: Sub }) {
	const st = useStreaming(d, pieces)
	if (sub.id === "moods")
		return (
			<span className="flex flex-wrap gap-1" aria-hidden>
				{MOOD_TAGS.map((t) => (
					<span
						key={tagId(t)}
						className={`h-2.5 w-2.5 rounded-full ${d.isOn(t) ? "ring-2 ring-white" : "opacity-60"}`}
						style={{ background: t.color }}
					/>
				))}
			</span>
		)
	if (sub.id === "services" && st.providers.length) {
		const shown = st.mode === "any" ? st.providers.slice(0, 6) : st.providers.filter((p) => st.chosen.includes(p.id)).slice(0, 6)
		return shown.length ? <ServiceStack providers={shown} on={st.mode !== "any"} size={20} /> : null
	}
	return null
}

function Tile({
	d,
	pieces,
	sub,
	onOpen,
	extra,
	className = "",
	phone,
}: {
	d: ProtoDiscover
	pieces: Pieces
	sub: Sub
	onOpen: () => void
	extra?: string | null
	className?: string
	phone: boolean
}) {
	const values = subValues(d, pieces, sub)
	const accent = sub.cards[0] ? FILTER_ACCENTS[sub.cards[0]]?.dot : "bg-amber-400"
	const line = values.length ? values.join(", ") : (extra ?? sub.hint)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			onClick={onOpen}
			className={`group flex min-h-0 min-w-0 flex-col rounded-2xl bg-white/[0.035] text-left ring-1 ring-white/[0.07] cursor-pointer outline-none transition-colors hover:bg-white/[0.07] hover:ring-white/15 focus-visible:ring-2 focus-visible:ring-amber-400 ${
				phone ? "min-h-[92px] p-3" : "p-4"
			} ${className}`}
		>
			<span className="flex w-full items-center gap-2">
				<span className={`h-2 w-2 shrink-0 rounded-full ${accent} ${values.length ? "" : "opacity-50"}`} />
				<span className={`min-w-0 truncate font-bold text-white ${phone ? "text-[14px]" : "text-[15px]"}`}>{sub.label}</span>
				<Badge n={values.length} />
				<ChevronRightIcon className="ml-auto h-4 w-4 shrink-0 text-gray-600 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-300" />
			</span>
			<span
				className={`mt-1 line-clamp-2 text-[13px] leading-snug ${values.length ? `font-medium text-amber-200/90 ${sub.id === "describe" ? PRIVATE : ""}` : "text-gray-500"}`}
			>
				{line}
			</span>
			{!phone && (
				<span className="mt-auto pt-3">
					<Preview d={d} pieces={pieces} sub={sub} />
				</span>
			)}
		</motion.button>
	)
}

function TileGrid({
	d,
	pieces,
	seg,
	onOpen,
	phone,
	search,
}: {
	d: ProtoDiscover
	pieces: Pieces
	seg: SegKey
	onOpen: (id: SubId) => void
	phone: boolean
	search: SearchCtx
}) {
	const subs = subsFor(pieces, seg)
	const odd = subs.length % 2 === 1
	const extra = (id: SubId) =>
		id === "title" && search.text.trim().length >= 2 && search.titles.found.length
			? `${search.titles.found.length} titles called “${search.text.trim()}”`
			: null
	return (
		<div className={`grid grid-cols-2 gap-2.5 ${phone ? "" : "h-full auto-rows-fr"}`}>
			{subs.map((s, i) => (
				<Tile
					key={s.id}
					d={d}
					pieces={pieces}
					sub={s}
					phone={phone}
					extra={extra(s.id)}
					onOpen={() => onOpen(s.id)}
					className={odd && i === subs.length - 1 ? "col-span-2" : ""}
				/>
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// Home: the tab's most used controls, then its sub-categories as tiles.

function Lead({ d, pieces, seg, search }: { d: ProtoDiscover; pieces: Pieces; seg: SegKey; search: SearchCtx }) {
	switch (seg) {
		case "search":
			return (
				<div className="flex flex-col gap-5">
					<MoodLane d={d} text={search.text} typing={search.typing} onRun={search.onRun} max={4} />
					<TitleLane
						text={search.text}
						titles={search.titles}
						similar={search.similar}
						onFill={search.onFill}
						onSeen={search.onSeen}
						max={3}
					/>
				</div>
			)
		case "mood":
			return (
				<div className="flex flex-col gap-6">
					<TagChips d={d} group="moods" big />
					<TypeControl d={d} />
				</div>
			)
		case "streaming":
			return (
				<div className="flex flex-col gap-4">
					<SubHead right={<CountryLine d={d} pieces={pieces} />}>Streaming</SubHead>
					<StreamingModes d={d} pieces={pieces} />
					<ServiceLogos d={d} pieces={pieces} layout="chips" limit={10} />
				</div>
			)
		case "watched":
			return (
				<div className="flex flex-col gap-6">
					<div>
						<SubHead>Seen</SubHead>
						<NotSeenControl pieces={pieces} />
					</div>
					<ScoreControl d={d} />
					<ReleasedControl d={d} slider={false} />
				</div>
			)
	}
}

export function Home({
	d,
	pieces,
	seg,
	onOpen,
	phone,
	search,
}: {
	d: ProtoDiscover
	pieces: Pieces
	seg: SegKey
	onOpen: (id: SubId) => void
	phone: boolean
	search: SearchCtx
}) {
	if (phone)
		return (
			<div className="flex flex-col gap-6">
				{seg === "search" && search.input}
				<Lead d={d} pieces={pieces} seg={seg} search={search} />
				<TileGrid d={d} pieces={pieces} seg={seg} onOpen={onOpen} phone search={search} />
			</div>
		)
	return (
		<div className="grid h-full min-h-0 grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
			<div className="min-h-0 overflow-y-auto overscroll-contain border-r border-white/[0.06] px-6 py-5">
				<Lead d={d} pieces={pieces} seg={seg} search={search} />
			</div>
			<div className="min-h-0 p-4">
				<TileGrid d={d} pieces={pieces} seg={seg} onOpen={onOpen} phone={false} search={search} />
			</div>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// One sub-category, drilled in.

function Col({
	d,
	pieces,
	title,
	hint,
	k,
	children,
}: {
	d: ProtoDiscover
	pieces: Pieces
	title: string
	hint?: string
	k?: CardKey
	children: ReactNode
}) {
	const set = k ? chipsOf(pieces, k).length > 0 : false
	return (
		<section aria-label={title} className="min-w-0">
			<header className="mb-3 flex min-h-[38px] items-start gap-2">
				<span className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${k ? FILTER_ACCENTS[k].dot : "bg-amber-400"}`} />
				<div className="min-w-0 flex-1">
					<h4 className="text-[15px] font-bold leading-tight text-white">{title}</h4>
					{hint && <p className="truncate text-[12px] text-gray-500">{hint}</p>}
				</div>
				{set && k && <ClearLink onClick={() => clearCard(d, pieces, k)} />}
			</header>
			{children}
		</section>
	)
}

function Columns({ phone, children, cols }: { phone: boolean; children: ReactNode; cols: string }) {
	return (
		<div
			className={phone ? "flex flex-col gap-7" : "grid gap-x-8 [&>*+*]:-ml-4 [&>*+*]:border-l [&>*+*]:border-white/[0.06] [&>*+*]:pl-4"}
			style={phone ? undefined : { gridTemplateColumns: cols }}
		>
			{children}
		</div>
	)
}

/** Mood, drilled in: every mood as a card with what it means and what it leaves. */
function MoodCards({ d, phone }: { d: ProtoDiscover; phone: boolean }) {
	const picks = d.picked.filter((t) => t.group === "moods")
	return (
		<div>
			<SubHead
				note={picks.length ? `Any of these · ${picks.length} of 3` : "Up to 3"}
				right={
					picks.length > 0 && (
						<ClearLink
							onClick={() => {
								for (const t of picks) d.toggle(t)
							}}
						/>
					)
				}
			>
				Mood
			</SubHead>
			<div className={`grid gap-2 ${phone ? "grid-cols-1" : "grid-cols-3 xl:grid-cols-4"}`}>
				{MOOD_TAGS.map((t) => {
					const on = d.isOn(t)
					const n = d.countFor(t)
					return (
						<motion.button
							key={tagId(t)}
							type="button"
							whileTap={TAP}
							aria-pressed={on}
							onClick={() => d.toggle(t)}
							className={`flex min-w-0 flex-col rounded-xl px-3.5 py-2.5 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
								on ? "text-white" : "bg-white/[0.035] ring-1 ring-white/[0.06] hover:bg-white/[0.07]"
							}`}
							style={on ? { background: `${t.color}2e`, boxShadow: `inset 0 0 0 1.5px ${t.color}` } : undefined}
						>
							<span className="flex items-center gap-2">
								<span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: t.color }} />
								<span className="truncate text-[14px] font-semibold text-gray-100">{t.name}</span>
								{n != null && <span className="ml-auto shrink-0 text-[12px] text-gray-500 tabular-nums">{n.toLocaleString()}</span>}
							</span>
							{t.description && <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-gray-400">{t.description}</span>}
						</motion.button>
					)
				})}
			</div>
		</div>
	)
}

export function SubView({
	d,
	pieces,
	seg,
	sub,
	phone,
	search,
}: {
	d: ProtoDiscover
	pieces: Pieces
	seg: SegKey
	sub: SubId
	phone: boolean
	search: SearchCtx
}) {
	const wide = phone ? "" : "max-w-3xl"
	switch (sub) {
		case "describe":
			return (
				<div className={wide}>
					{phone && <div className="mb-5">{search.input}</div>}
					<MoodLane d={d} text={search.text} typing={search.typing} onRun={search.onRun} max={8} head={false} />
				</div>
			)
		case "title":
			return (
				<div className={wide}>
					{phone && <div className="mb-5">{search.input}</div>}
					<TitleLane
						text={search.text}
						titles={search.titles}
						similar={search.similar}
						onFill={search.onFill}
						onSeen={search.onSeen}
						max={8}
						head={false}
					/>
				</div>
			)
		case "similar":
			return (
				<div className={wide}>
					{phone && <div className="mb-5">{search.input}</div>}
					<SimilarLane
						text={search.text}
						titles={search.titles}
						similar={search.similar}
						seen={search.seen}
						onSeen={search.onSeen}
						max={6}
						head={false}
					/>
				</div>
			)
		case "people":
			return (
				<div className={wide}>
					<OneCard pieces={pieces} k="people" />
				</div>
			)
		case "moods":
			return <MoodCards d={d} phone={phone} />
		case "themes":
		case "styles":
			return (
				<div className={phone ? "" : "max-w-5xl"}>
					<TagChipsBare d={d} group={sub} />
				</div>
			)
		case "genre":
			return (
				<Columns phone={phone} cols="minmax(0,0.6fr) minmax(0,2fr)">
					<TypeControl d={d} />
					<GenreControl d={d} limit={60} />
				</Columns>
			)
		case "services":
			return (
				<div>
					<div className="flex flex-wrap items-center gap-x-5 gap-y-2">
						<div className="w-full max-w-md">
							<StreamingModes d={d} pieces={pieces} />
						</div>
						<CountryLine d={d} pieces={pieces} />
					</div>
					<div className="mt-5">
						<ServiceLogos d={d} pieces={pieces} layout="grid" limit={phone ? 12 : 24} />
					</div>
				</div>
			)
		case "runtime":
			return (
				<div className={wide}>
					<OneCard pieces={pieces} k="runtime" />
				</div>
			)
		case "age":
			return (
				<div className={wide}>
					<OneCard pieces={pieces} k="ageLimit" />
				</div>
			)
		case "origin":
			return (
				<div className={wide}>
					<OneCard pieces={pieces} k="productionCountries" />
				</div>
			)
		case "seen":
			return (
				<Columns phone={phone} cols="minmax(0,0.8fr) minmax(0,1fr) minmax(0,1fr)">
					<Col d={d} pieces={pieces} title="Not seen yet" hint="Hide what you've watched">
						<NotSeenControl pieces={pieces} />
					</Col>
					<Col d={d} pieces={pieces} title="Loved" hint="Steer toward these" k="loved">
						<OneCard key="loved" pieces={pieces} k="loved" />
					</Col>
					<Col d={d} pieces={pieces} title="Disliked" hint="Steer away from these" k="disliked">
						<OneCard key="disliked" pieces={pieces} k="disliked" />
					</Col>
				</Columns>
			)
		case "scores":
			return (
				<Columns phone={phone} cols="minmax(0,1fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,1fr)">
					<Col d={d} pieces={pieces} title="Score" hint="GoodWatch score" k="minScore">
						<ScoreControl d={d} />
					</Col>
					<Col d={d} pieces={pieces} title="Taste match" hint="How well it fits your taste" k="minMatch">
						<OneCard key="minMatch" pieces={pieces} k="minMatch" />
					</Col>
					<Col d={d} pieces={pieces} title="Scores by source" hint="IMDb, Rotten Tomatoes, Metacritic" k="sourceScores">
						<OneCard key="sourceScores" pieces={pieces} k="sourceScores" />
					</Col>
					<Col d={d} pieces={pieces} title="Critics vs audiences" hint="Where they disagree" k="scoreGap">
						<OneCard key="scoreGap" pieces={pieces} k="scoreGap" />
					</Col>
				</Columns>
			)
		case "released":
			return (
				<div className={phone ? "" : "max-w-2xl"}>
					<ReleasedControl d={d} />
				</div>
			)
	}
	return <p className="text-gray-500">{SEG_LABEL[seg]}</p>
}

// ---------------------------------------------------------------------------------------------------------------
// Find a filter: a search run, and matches from every filter in every tab.

export function FindView({
	pieces,
	text,
	phone,
	onRun,
}: { pieces: Pieces; text: string; phone: boolean; onRun: (t: string) => void }) {
	const css = phone
		? ""
		: `.find-all-20 > .flex-col { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 2rem; row-gap: 1.75rem; align-items: start }`
	return (
		<div>
			<button
				type="button"
				onClick={() => onRun(text.trim())}
				className="mb-5 flex h-12 w-full max-w-xl min-w-0 items-center gap-3 rounded-xl bg-amber-400/[0.1] px-4 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.16] focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
				<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search:</span>
				<span className={`brand-header min-w-0 flex-1 truncate text-[18px] text-white ${PRIVATE}`}>{text.trim()}</span>
				<ArrowTurnDownLeftIcon className="h-4 w-4 shrink-0 text-amber-200/60" aria-hidden />
			</button>
			{css && <style dangerouslySetInnerHTML={{ __html: css }} />}
			<FilterGroups data={pieces.groups} query={text} className="find-all-20" />
		</div>
	)
}

/** Keeps a drilled-in view's scroll at the top while its real filter cards mount (they scroll themselves into view). */
export function useTopOnChange(key: string) {
	const ref = useRef<HTMLDivElement>(null)
	useKeepTop(ref, key)
	return ref
}
