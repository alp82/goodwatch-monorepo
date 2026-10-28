// PROTOTYPE - throwaway. Round 5 variant 18: the Search tab as four lanes, filled at once by the one field (copied from
// R4-8, plus Cast and crew). "Describe a mood": example phrases; typing offers "Search: <text>". "Find a title": titles
// by that name. "Similar to": picked titles as removable posters, titles to add as you type. "Cast and crew": picked
// people as removable faces, people by that name to add. Side by side on desktop, stacked on phones.
import { ArrowTurnDownLeftIcon, FilmIcon, MagnifyingGlassIcon, PlusIcon, SparklesIcon, Square2StackIcon, UserIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useState } from "react"
import { ReadAsChips } from "~/ui/discover/ReadAsChips"
import { TAP } from "~/ui/filter-bar/motion"
import { usePeopleNames, useTitleNames } from "~/ui/filter-bar/useFilterData"
import type { TitleKey } from "~/utils/title-key"
import { EXAMPLE_PROMPTS, type ProtoDiscover } from "../kit"
import {
	EXAMPLE_TITLES,
	type FoundTitle,
	POSTER_SM,
	PRIVATE,
	PosterThumb,
	TitleRow,
	TitleRowsLoading,
	useQuickTitles,
	useSimilar,
} from "./R5-18-parts"

const SECTION_LABEL = "text-[11px] font-bold uppercase tracking-[0.08em]"
const TITLE_EXAMPLES = ["Severance", "The Bear", "Dune"]

function LaneHead({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<h3 className={`${SECTION_LABEL} mb-3 flex h-5 items-center gap-1.5 px-1 text-gray-400`}>
			<span className="text-gray-500 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
			{children}
		</h3>
	)
}

function ExampleRow({ icon, text, onClick }: { icon: ReactNode; text: string; onClick: () => void }) {
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

function PickedPoster({ t, onRemove }: { t: { title: string; poster: string | null } | undefined; onRemove: () => void }) {
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

function AddRow({ t, onAdd }: { t: FoundTitle; onAdd: () => void }) {
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

function SimilarLane({
	text,
	titles,
	similar,
	seen,
	onSeen,
}: {
	text: string
	titles: ReturnType<typeof useQuickTitles>
	similar: ReturnType<typeof useSimilar>
	seen: Map<TitleKey, FoundTitle>
	onSeen: (t: FoundTitle) => void
}) {
	const names = useTitleNames(similar.list, "")
	const known = (k: TitleKey) => seen.get(k) ?? names.byKey.get(k)
	const asking = text.trim().length >= 2
	const adds = titles.found.filter((t) => !similar.has(t.key)).slice(0, similar.list.length ? 3 : 4)
	const examples = EXAMPLE_TITLES.filter((t) => !similar.has(t.key)).slice(0, 2)
	return (
		<div>
			<LaneHead icon={<Square2StackIcon />}>Similar to</LaneHead>
			{similar.list.length > 0 && (
				<div className="mb-4 flex flex-wrap gap-3 px-1 pt-1.5">
					{similar.list.map((k) => (
						<PickedPoster key={k} t={known(k)} onRemove={() => similar.toggle(k)} />
					))}
				</div>
			)}
			{asking ? (
				adds.length > 0 ? (
					<div className={titles.loading ? "opacity-70 transition-opacity" : ""}>
						{adds.map((t) => (
							<AddRow
								key={t.key}
								t={t}
								onAdd={() => {
									onSeen(t)
									similar.toggle(t.key)
								}}
							/>
						))}
					</div>
				) : titles.loading ? (
					<TitleRowsLoading n={3} />
				) : null
			) : (
				!similar.list.length && (
					<div className="flex flex-col">
						{examples.map((t) => (
							<ExampleRow key={t.key} icon={<PlusIcon />} text={`Like ${t.title}`} onClick={() => similar.toggle(t.key)} />
						))}
					</div>
				)
			)}
		</div>
	)
}


// ---------------------------------------------------------------------------------------------------------------
// Cast and crew: the cast search (as the sheet's people picker), filled by the same field.

const PROFILE = "https://image.tmdb.org/t/p/w92"
const PEOPLE_EXAMPLES = [
	{ id: 525, name: "Christopher Nolan" },
	{ id: 1245, name: "Scarlett Johansson" },
]

interface FoundPerson {
	id: number
	name: string
	profile: string | null
	department?: string
}

function useDebouncedText(value: string, ms = 220) {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return v
}

function useQuickPeople(text: string) {
	const term = useDebouncedText(text.trim())
	const q = useQuery<{
		castMembers: { tmdb_id: number; name: string; profile_path: string | null; popularity: number | null; known_for_department?: string }[]
	}>({
		queryKey: ["filter-people-search", term],
		queryFn: async () =>
			(await fetch(`/api/cast?${new URLSearchParams({ text: term, withCast: "", withoutCast: "" })}`)).json(),
		enabled: term.length >= 2,
		placeholderData: (p) => p,
	})
	const found: FoundPerson[] = (term.length >= 2 ? (q.data?.castMembers ?? []) : [])
		.slice()
		.sort((a, b) => Number(!!b.profile_path) - Number(!!a.profile_path) || (b.popularity ?? 0) - (a.popularity ?? 0))
		.map((p) => ({ id: p.tmdb_id, name: p.name, profile: p.profile_path, department: p.known_for_department }))
	return { found, loading: text.trim().length >= 2 && (q.isFetching || term !== text.trim()) }
}

function Face({ src, name, className = "h-9 w-9" }: { src: string | null; name: string; className?: string }) {
	return (
		<span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-white/10 ${className}`}>
			{src ? (
				<img src={`${PROFILE}${src}`} alt="" loading="lazy" className="h-full w-full object-cover" />
			) : (
				<span className="text-[11px] font-semibold text-gray-400">{name.slice(0, 1)}</span>
			)}
		</span>
	)
}

function CastLane({ d, text }: { d: ProtoDiscover; text: string }) {
	const chosen = d.filters.state.people ?? []
	const names = usePeopleNames(chosen, "")
	const people = useQuickPeople(text)
	const [seen, setSeen] = useState(() => new Map<number, FoundPerson>())
	const known = (id: number) => seen.get(id) ?? names.byId.get(id)
	const toggle = (p: FoundPerson) => {
		setSeen((m) => new Map(m).set(p.id, p))
		const next = chosen.includes(p.id) ? chosen.filter((x) => x !== p.id) : [...chosen, p.id]
		d.filters.set({ people: next.length ? next : undefined })
	}
	const asking = text.trim().length >= 2
	const adds = people.found.filter((p) => !chosen.includes(p.id)).slice(0, chosen.length ? 4 : 5)
	return (
		<div>
			<LaneHead icon={<UserIcon />}>Cast and crew</LaneHead>
			{chosen.length > 0 && (
				<div className="mb-3 flex flex-wrap gap-1.5 px-1">
					{chosen.map((id) => {
						const p = known(id)
						return (
							<button
								key={id}
								type="button"
								onClick={() => p && toggle({ id, name: p.name, profile: p.profile })}
								aria-label={`Remove ${p?.name ?? "person"}`}
								className="flex h-9 items-center gap-2 rounded-full bg-white pr-2 pl-1 text-[13px] font-semibold text-gray-950 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<Face src={p?.profile ?? null} name={p?.name ?? "?"} className="h-7 w-7" />
								<span className="max-w-32 truncate">{p?.name ?? "…"}</span>
								<XMarkIcon className="h-3.5 w-3.5 text-gray-500" aria-hidden />
							</button>
						)
					})}
				</div>
			)}
			{asking ? (
				adds.length > 0 ? (
					<div className={people.loading ? "opacity-70 transition-opacity" : ""}>
						{adds.map((p) => (
							<button
								key={p.id}
								type="button"
								onClick={() => toggle(p)}
								className="group flex h-[52px] w-full min-w-0 items-center gap-3 rounded-xl px-2 text-left cursor-pointer outline-none hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-amber-400"
							>
								<Face src={p.profile} name={p.name} />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-[14px] font-semibold text-gray-100">{p.name}</span>
									{p.department && <span className="block truncate text-[12px] text-gray-500">{p.department}</span>}
								</span>
								<PlusIcon className="h-4 w-4 shrink-0 text-gray-500 group-hover:text-white" aria-hidden />
							</button>
						))}
					</div>
				) : people.loading ? (
					<TitleRowsLoading n={3} />
				) : (
					<p className="px-2 py-3 text-[13px] text-gray-500">No one called “{text.trim()}”</p>
				)
			) : (
				!chosen.length && (
					<div className="flex flex-col">
						{PEOPLE_EXAMPLES.map((p) => (
							<ExampleRow key={p.id} icon={<PlusIcon />} text={p.name} onClick={() => toggle({ ...p, profile: null })} />
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
	const [seen, setSeen] = useState(() => new Map<TitleKey, FoundTitle>())
	const onSeen = (t: FoundTitle) => setSeen((m) => new Map(m).set(t.key, t))
	const lane = phone ? "" : "min-h-0 overflow-y-auto overscroll-contain px-5 py-5"
	return (
		<div className={phone ? "flex flex-col gap-8" : "grid h-full min-h-0 grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]"}>
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
			<div className={`${lane} ${phone ? "" : "border-r border-white/[0.06]"}`}>
				<SimilarLane text={text} titles={titles} similar={similar} seen={seen} onSeen={onSeen} />
			</div>
			<div className={`${lane} ${phone ? "" : "pr-6"}`}>
				<CastLane d={d} text={text} />
			</div>
		</div>
	)
}
