// PROTOTYPE - throwaway. Round 5 variant 19: the Search tab as three lanes, filled at once by the one field.
// "Describe a mood": example phrases; typing offers "Search: <text>". "Find a title": titles by that name (the quick
// title search), each opens its page or sets "Like this" (kept under For you, Similar to). "Cast and crew": the people
// picked as removable faces, and people to add as you type. Side by side on desktop, stacked on phones. The picked
// posters and the add rows are shared with For you's Similar to.
import { ArrowTurnDownLeftIcon, FilmIcon, MagnifyingGlassIcon, PlusIcon, SparklesIcon, UserIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { TAP } from "~/ui/filter-bar/motion"
import { usePeopleNames } from "~/ui/filter-bar/useFilterData"
import { EXAMPLE_PROMPTS, type ProtoDiscover } from "../kit"
import {
	type FoundTitle,
	POSTER_SM,
	PRIVATE,
	PosterThumb,
	TitleRow,
	TitleRowsLoading,
	useQuickTitles,
	useDebounced,
	useSimilar,
} from "./R5-19-parts"

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"
const TITLE_EXAMPLES = ["Severance", "The Bear", "Dune"]

export function LaneHead({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<h3 className={`${SECTION_LABEL} mb-3 flex h-5 items-center gap-1.5 px-1 text-gray-400`}>
			<span className="text-gray-500 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
			{children}
		</h3>
	)
}

export function ExampleRow({ icon, text, onClick }: { icon: ReactNode; text: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex h-11 w-full min-w-0 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-gray-300 cursor-pointer outline-none hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span className="shrink-0 text-amber-400/70 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
			<span className="truncate">{text}</span>
		</button>
	)
}

function MoodLane({ d, text, typing, onRun }: { d: ProtoDiscover; text: string; typing: boolean; onRun: (t: string) => void }) {
	const examples = EXAMPLE_PROMPTS.slice(0, typing || d.q ? 4 : 6)
	return (
		<div>
			<LaneHead icon={<SparklesIcon />}>Describe a mood</LaneHead>
			{typing ? (
				<button
					type="button"
					onClick={() => onRun(text)}
					className="mb-3 flex h-16 w-full min-w-0 items-center gap-3 rounded-2xl bg-amber-400/[0.12] px-4 text-left ring-1 ring-inset ring-amber-400/30 cursor-pointer outline-none hover:bg-amber-400/[0.18] focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<span className="shrink-0 text-sm font-semibold text-amber-200/80">Search:</span>
					<span className={`brand-header min-w-0 flex-1 truncate text-[21px] text-white ${PRIVATE}`}>{text}</span>
					<kbd className="hidden shrink-0 items-center gap-1 rounded-md bg-black/30 px-2 py-1 font-sans text-xs font-semibold text-amber-200/80 sm:flex">
						<ArrowTurnDownLeftIcon className="h-3.5 w-3.5" aria-hidden />
						Enter
					</kbd>
				</button>
			) : d.q ? (
				<div className="mb-3 rounded-2xl bg-amber-500/[0.07] p-4 ring-1 ring-inset ring-amber-400/25">
					<div className="flex items-center gap-3">
						<span className={`brand-header min-w-0 flex-1 truncate text-[21px] text-white ${PRIVATE}`}>{d.q}</span>
						<button
							type="button"
							onClick={() => d.setQ(null)}
							className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-amber-400 cursor-pointer outline-none hover:bg-amber-400/10 focus-visible:ring-2 focus-visible:ring-amber-400"
						>
							<XMarkIcon className="h-4 w-4" aria-hidden />
							Clear
						</button>
					</div>
					{d.reading.length > 0 && (
						<div className="mt-2.5 flex flex-wrap items-center gap-2">
							<span className="text-[12px] text-gray-400">Read as</span>
							<ReadAsChips reading={d.reading} />
						</div>
					)}
				</div>
			) : null}
			<div className="flex flex-col">
				{examples.map((p) => (
					<ExampleRow key={p} icon={<MagnifyingGlassIcon />} text={p} onClick={() => onRun(p)} />
				))}
			</div>
		</div>
	)
}

function TitleLane({
	text,
	titles,
	similar,
	onFill,
	onSeen,
}: {
	text: string
	titles: ReturnType<typeof useQuickTitles>
	similar: ReturnType<typeof useSimilar>
	onFill: (t: string) => void
	onSeen: (t: FoundTitle) => void
}) {
	const asking = text.trim().length >= 2
	return (
		<div>
			<LaneHead icon={<FilmIcon />}>Find a title</LaneHead>
			{!asking ? (
				<div className="flex flex-col">
					{TITLE_EXAMPLES.map((t) => (
						<ExampleRow key={t} icon={<FilmIcon />} text={t} onClick={() => onFill(t)} />
					))}
				</div>
			) : titles.found.length > 0 ? (
				<div className={titles.loading ? "opacity-70 transition-opacity" : ""}>
					{titles.found.slice(0, 5).map((t) => (
						<TitleRow
							key={t.key}
							t={t}
							liked={similar.has(t.key)}
							onLike={() => {
								onSeen(t)
								similar.toggle(t.key)
							}}
						/>
					))}
				</div>
			) : titles.loading ? (
				<TitleRowsLoading n={5} />
			) : (
				<p className="px-2 py-3 text-[13px] text-gray-500">No title called “{text.trim()}”</p>
			)}
		</div>
	)
}

export function PickedPoster({ t, onRemove }: { t: { title: string; poster: string | null } | undefined; onRemove: () => void }) {
	return (
		<motion.button
			type="button"
			layout="position"
			whileTap={TAP}
			onClick={onRemove}
			aria-label={t ? `Remove ${t.title}` : "Remove"}
			title={t?.title}
			className="group relative w-[60px] shrink-0 rounded-lg cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span className="block aspect-[2/3] overflow-hidden rounded-lg bg-white/[0.06] ring-2 ring-emerald-400/80 ring-offset-2 ring-offset-[#0b1120]">
				{t?.poster ? (
					<img src={`${POSTER_SM}${t.poster}`} alt="" className="h-full w-full object-cover" />
				) : (
					<span className="grid h-full place-items-center p-1 text-center text-[9px] leading-tight text-gray-400">{t?.title ?? "…"}</span>
				)}
			</span>
			<span className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full bg-gray-950 text-gray-300 ring-1 ring-white/20 group-hover:text-white">
				<XMarkIcon className="h-3 w-3" />
			</span>
			<span className="mt-1.5 block truncate text-left text-[11px] text-gray-400">{t?.title ?? "…"}</span>
		</motion.button>
	)
}

export function AddRow({ t, onAdd }: { t: FoundTitle; onAdd: () => void }) {
	return (
		<button
			type="button"
			onClick={onAdd}
			className="group flex h-[52px] w-full min-w-0 items-center gap-3 rounded-xl px-2 text-left cursor-pointer outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<PosterThumb poster={t.poster} title={t.title} className="h-[42px] w-7" />
			<span className="min-w-0 flex-1 truncate text-[14px] text-gray-300 group-hover:text-white">
				Like <span className="font-semibold text-gray-100">{t.title}</span>
				{t.year && <span className="text-gray-500"> · {t.year}</span>}
			</span>
			<PlusIcon className="h-4 w-4 shrink-0 text-gray-500 group-hover:text-white" aria-hidden />
		</button>
	)
}

const PEOPLE_EXAMPLES = ["Greta Gerwig", "Denis Villeneuve", "Florence Pugh"]
const FACE = "https://image.tmdb.org/t/p/w185"

function Face({ name, profile, className = "h-10 w-10" }: { name: string; profile: string | null; className?: string }) {
	return (
		<span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.07] text-[13px] font-semibold text-gray-400 ring-1 ring-white/10 ${className}`}>
			{profile ? <img src={`${FACE}${profile}`} alt="" loading="lazy" className="h-full w-full object-cover" /> : name.slice(0, 1)}
		</span>
	)
}

function CastLane({ d, text, onFill }: { d: ProtoDiscover; text: string; onFill: (t: string) => void }) {
	const chosen = d.filters.state.people ?? []
	const people = usePeopleNames(chosen, useDebounced(text))
	const asking = text.trim().length >= 2
	const toggle = (id: number) => {
		const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]
		d.filters.set({ people: next.length ? next : undefined })
	}
	const adds = people.matches.slice(0, chosen.length ? 3 : 5)
	return (
		<div>
			<LaneHead icon={<UserIcon />}>Cast and crew</LaneHead>
			{chosen.length > 0 && (
				<div className="mb-4 flex flex-wrap gap-2 px-1">
					{chosen.map((id) => {
						const p = people.byId.get(id)
						return (
							<motion.button
								key={id}
								type="button"
								layout="position"
								whileTap={TAP}
								onClick={() => toggle(id)}
								aria-label={`Remove ${p?.name ?? "person"}`}
								className="flex h-10 items-center gap-2 rounded-full bg-white/[0.08] pr-2.5 pl-1 text-[13px] font-semibold text-white ring-1 ring-inset ring-cyan-400/50 cursor-pointer outline-none hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<Face name={p?.name ?? "?"} profile={p?.profile ?? null} className="h-8 w-8" />
								<span className="max-w-32 truncate">{p?.name ?? "…"}</span>
								<XMarkIcon className="h-3.5 w-3.5 text-gray-400" aria-hidden />
							</motion.button>
						)
					})}
				</div>
			)}
			{asking ? (
				adds.length > 0 ? (
					<div>
						{adds.map((p) => (
							<button
								key={p.id}
								type="button"
								onClick={() => toggle(p.id)}
								className="group flex h-[52px] w-full min-w-0 items-center gap-3 rounded-xl px-2 text-left cursor-pointer outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<Face name={p.name} profile={p.profile} />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-[14px] font-semibold text-gray-100">{p.name}</span>
									<span className="block truncate text-[12px] text-gray-500">{p.department}</span>
								</span>
								<PlusIcon className="h-4 w-4 shrink-0 text-gray-500 group-hover:text-white" aria-hidden />
							</button>
						))}
					</div>
				) : (
					<p className="px-2 py-3 text-[13px] text-gray-500">No one called “{text.trim()}”</p>
				)
			) : (
				!chosen.length && (
					<div className="flex flex-col">
						{PEOPLE_EXAMPLES.map((n) => (
							<ExampleRow key={n} icon={<UserIcon />} text={n} onClick={() => onFill(n)} />
						))}
					</div>
				)
			)}
		</div>
	)
}

export function SearchLanes({
	d,
	text,
	typing,
	onRun,
	onFill,
	input,
	phone,
}: {
	d: ProtoDiscover
	text: string
	typing: boolean
	onRun: (t: string) => void
	onFill: (t: string) => void
	input?: ReactNode
	phone: boolean
}) {
	const similar = useSimilar(d)
	const titles = useQuickTitles(text)
	const onSeen = (_: FoundTitle) => {}
	const lane = phone ? "" : "min-h-0 overflow-y-auto overscroll-contain px-5 py-5"
	return (
		<div className={phone ? "flex flex-col gap-8" : "grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]"}>
			<div className={`${lane} ${phone ? "" : "border-r border-white/[0.06] pl-6"}`}>
				{input && (
					<div className="mb-5 flex h-14 items-center gap-2.5 rounded-[14px] bg-white/[0.07] px-4 shadow-[inset_0_0_0_1.5px_rgba(251,191,36,0.6)]">
						<MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
						{input}
					</div>
				)}
				<MoodLane d={d} text={text} typing={typing} onRun={onRun} />
			</div>
			<div className={`${lane} ${phone ? "" : "border-r border-white/[0.06]"}`}>
				<TitleLane text={text} titles={titles} similar={similar} onFill={onFill} onSeen={onSeen} />
			</div>
			<div className={`${lane} ${phone ? "" : "pr-6"}`}>
				<CastLane d={d} text={text} onFill={onFill} />
			</div>
		</div>
	)
}
