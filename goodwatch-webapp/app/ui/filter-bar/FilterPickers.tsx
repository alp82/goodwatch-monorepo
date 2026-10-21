// The pickers for titles (Similar to, Loved, Disliked) and people (Cast and crew) in the Filters sheet: what's chosen,
// then a search that shows results while its field has focus. A pick closes the results until the field is tapped
// again; eight results show, then "More results".
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { FilterState } from "~/domain/filter-state"
import useLocale from "~/utils/locale"
import { mediaLanguageUrl } from "~/utils/media-presentation"
import { type TitleKey, titleKey } from "~/utils/title-key"
import { Chip, More, SearchField } from "./SheetControls"
import { TAP } from "./motion"
import { useTitleNames } from "./useFilterData"

const toggleIn = <T,>(list: T[] | undefined, value: T) => {
	const next = (list ?? []).includes(value)
		? (list ?? []).filter((v) => v !== value)
		: [...(list ?? []), value]
	return next.length ? next : undefined
}

/** Typing waits a moment before it asks. */
function useDebounced<T>(value: T, ms = 220): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return v
}

interface Found {
	key: TitleKey
	title: string
	year: string
	poster: string | null
}

/** The site's quick title search (the header's typeahead): about a quarter second, where /api/similar-media takes 1.6 s. */
function useQuickTitles(text: string) {
	const term = useDebounced(text.trim())
	const { locale } = useLocale()
	const q = useQuery<{
		searchResults: {
			id: number
			media_type: "movie" | "show"
			title?: string
			name?: string
			release_date?: string
			first_air_date?: string
			poster_path?: string | null
		}[]
	}>({
		queryKey: ["filter-title-search", term, locale.language],
		queryFn: async () =>
			(
				await fetch(
					mediaLanguageUrl(
						`/api/search?query=${encodeURIComponent(term)}`,
						locale.language,
					),
				)
			).json(),
		enabled: term.length >= 2,
	})
	const found: Found[] = (
		term.length >= 2 ? (q.data?.searchResults ?? []) : []
	).map((r) => ({
		key: titleKey(r.media_type, r.id),
		title: r.title ?? r.name ?? "",
		year: (r.release_date ?? r.first_air_date ?? "").slice(0, 4),
		poster: r.poster_path ?? null,
	}))
	return {
		found,
		loading: text.trim().length >= 2 && (q.isFetching || term !== text.trim()),
	}
}

const POSTER = "https://image.tmdb.org/t/p/w154"

/** A poster you can pick or take off; the ring says loved (green), disliked (red), or chosen. */
function Poster({
	t,
	active,
	tone,
	onClick,
}: {
	t: Found | undefined
	active: boolean
	tone: "pos" | "neg"
	onClick: () => void
}) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={active}
			aria-label={t ? `${t.title} (${t.year})` : "Loading title"}
			title={t ? `${t.title} (${t.year})` : undefined}
			onClick={onClick}
			className="group relative w-[4.25rem] shrink-0 rounded-lg cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span
				className={`block aspect-[2/3] overflow-hidden rounded-lg bg-white/[0.06] ${active ? `ring-2 ring-offset-2 ring-offset-gray-950 ${tone === "pos" ? "ring-emerald-400" : "ring-rose-400"}` : "opacity-80 group-hover:opacity-100"}`}
			>
				{t ? (
					t.poster ? (
						<img
							src={`${POSTER}${t.poster}`}
							alt=""
							className="h-full w-full object-cover"
						/>
					) : (
						<span className="grid h-full place-items-center p-1 text-[10px] leading-tight text-gray-400">
							{t.title}
						</span>
					)
				) : (
					<span className="block h-full w-full animate-pulse bg-white/[0.08] motion-reduce:animate-none" />
				)}
			</span>
			<span className="mt-1 block truncate text-left text-[11px] text-gray-400">
				{t ? t.title : "…"}
			</span>
			{active && (
				<span
					className={`absolute top-1 right-1 grid h-4 w-4 place-items-center rounded-full text-white ${tone === "pos" ? "bg-emerald-500" : "bg-rose-500"}`}
				>
					<XMarkIcon className="h-3 w-3" />
				</span>
			)}
		</motion.button>
	)
}

/**
 * Similar to, Loved, Disliked: the chosen posters, and a search that shows results while the field has focus; picking
 * one closes the results until the field is tapped again. Eight results, then "More results".
 */
export function TitlePicker({
	group,
	state,
	onChange,
}: {
	group: "similarTo" | "loved" | "disliked"
	state: FilterState
	onChange: (state: FilterState) => void
}) {
	const [text, setText] = useState("")
	const [showResults, setShowResults] = useState(false)
	const [more, setMore] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	const chosen = state[group] ?? []
	const names = useTitleNames(chosen, "")
	const { found, loading } = useQuickTitles(text)
	// What a pick already told us, so its poster shows at once.
	const [seen, setSeen] = useState(() => new Map<TitleKey, Found>())
	const known = (key: TitleKey): Found | undefined => {
		const n = names.byKey.get(key)
		return (
			seen.get(key) ??
			(n ? { key, title: n.title, year: n.year, poster: n.poster } : undefined)
		)
	}
	const other =
		group === "loved" ? "disliked" : group === "disliked" ? "loved" : null
	const toggle = (t: Found) => {
		setSeen((m) => new Map(m).set(t.key, t))
		onChange({
			...state,
			[group]: toggleIn(chosen, t.key),
			...(other ? { [other]: state[other]?.filter((k) => k !== t.key) } : {}),
		})
		setShowResults(false)
		input.current?.blur()
	}
	const tone = group === "disliked" ? "neg" : "pos"
	const list = more ? found : found.slice(0, 8)
	return (
		<div className="space-y-3">
			{chosen.length > 0 && (
				<div className="flex flex-wrap gap-2.5">
					{chosen.map((k) => {
						const t = known(k)
						return (
							<Poster
								key={k}
								t={t}
								active
								tone={tone}
								onClick={() => t && toggle(t)}
							/>
						)
					})}
				</div>
			)}
			<SearchField
				inputRef={input}
				value={text}
				onChange={(v) => {
					setText(v)
					setMore(false)
					setShowResults(true)
				}}
				onFocus={() => setShowResults(true)}
				loading={loading}
				placeholder={
					group === "similarTo"
						? "Add a movie or show"
						: group === "loved"
							? "Add a title you loved"
							: "Add a title you disliked"
				}
			/>
			{showResults && text.trim().length >= 2 && (
				<div>
					{found.length === 0 && !loading && (
						<p className="text-[13px] text-gray-500">
							No title called “{text}”.
						</p>
					)}
					{found.length === 0 && loading && (
						<div className="flex gap-2.5">
							{[0, 1, 2, 3, 4].map((i) => (
								<Poster
									key={i}
									t={undefined}
									active={false}
									tone={tone}
									onClick={() => {}}
								/>
							))}
						</div>
					)}
					<div className="flex flex-wrap gap-2.5">
						{list.map((t) => (
							<Poster
								key={t.key}
								t={t}
								active={chosen.includes(t.key)}
								tone={tone}
								onClick={() => toggle(t)}
							/>
						))}
					</div>
					{found.length > 8 && (
						<More
							hidden={found.length - 8}
							open={more}
							onClick={() => setMore(!more)}
							label={`More results (${found.length - 8})`}
						/>
					)}
				</div>
			)}
		</div>
	)
}

const PROFILE = "https://image.tmdb.org/t/p/w92"

export function PeoplePicker({
	state,
	onChange,
}: {
	state: FilterState
	onChange: (state: FilterState) => void
}) {
	const [text, setText] = useState("")
	const [showResults, setShowResults] = useState(false)
	const [more, setMore] = useState(false)
	const input = useRef<HTMLInputElement>(null)
	const chosen = state.people ?? []
	const term = useDebounced(text.trim())
	const q = useQuery<{
		castMembers: {
			tmdb_id: number
			name: string
			profile_path: string | null
			popularity: number | null
		}[]
	}>({
		queryKey: ["filter-people-search", term],
		queryFn: async () =>
			(
				await fetch(
					`/api/cast?${new URLSearchParams({ text: term, withCast: "", withoutCast: "" })}`,
				)
			).json(),
		enabled: term.length >= 2,
	})
	const names = useQuery<{
		castMembers: {
			tmdb_id: number
			name: string
			profile_path: string | null
		}[]
	}>({
		queryKey: ["filter-people-chosen", chosen.join(",")],
		queryFn: async () =>
			(
				await fetch(
					`/api/cast?${new URLSearchParams({ text: "", withCast: chosen.join(","), withoutCast: "" })}`,
				)
			).json(),
		enabled: chosen.length > 0,
		placeholderData: (p) => p,
	})
	const [seen, setSeen] = useState(
		() => new Map<number, { name: string; profile: string | null }>(),
	)
	const nameOf = (id: number) =>
		seen.get(id) ??
		(() => {
			const p = names.data?.castMembers.find((m) => m.tmdb_id === id)
			return p ? { name: p.name, profile: p.profile_path } : undefined
		})()
	// The cast search ranks loosely: faces and the better-known first.
	const found = (term.length >= 2 ? (q.data?.castMembers ?? []) : [])
		.slice()
		.sort(
			(a, b) =>
				Number(!!b.profile_path) - Number(!!a.profile_path) ||
				(b.popularity ?? 0) - (a.popularity ?? 0),
		)
	const loading =
		text.trim().length >= 2 && (q.isFetching || term !== text.trim())
	const pick = (id: number, name: string, profile: string | null) => {
		setSeen((m) => new Map(m).set(id, { name, profile }))
		onChange({ ...state, people: toggleIn(chosen, id) })
		setShowResults(false)
		input.current?.blur()
	}
	const list = more ? found.slice(0, 40) : found.slice(0, 8)
	return (
		<div className="space-y-3">
			{chosen.length > 0 && (
				<div className="flex flex-wrap gap-1.5">
					{chosen.map((id) => {
						const p = nameOf(id)
						return (
							<Chip
								key={id}
								img={p?.profile ? `${PROFILE}${p.profile}` : null}
								o={{
									id: String(id),
									label: p?.name ?? "…",
									active: true,
									count: null,
									toggle: () => pick(id, p?.name ?? "", p?.profile ?? null),
								}}
							/>
						)
					})}
				</div>
			)}
			<SearchField
				inputRef={input}
				value={text}
				onChange={(v) => {
					setText(v)
					setMore(false)
					setShowResults(true)
				}}
				onFocus={() => setShowResults(true)}
				loading={loading}
				placeholder="Add an actor or director"
			/>
			{showResults && text.trim().length >= 2 && (
				<div className="flex flex-wrap gap-1.5">
					{found.length === 0 && !loading && (
						<p className="text-[13px] text-gray-500">No one called “{text}”.</p>
					)}
					{list.map((p) => (
						<Chip
							key={p.tmdb_id}
							img={p.profile_path ? `${PROFILE}${p.profile_path}` : null}
							o={{
								id: String(p.tmdb_id),
								label: p.name,
								active: chosen.includes(p.tmdb_id),
								count: null,
								toggle: () => pick(p.tmdb_id, p.name, p.profile_path),
							}}
						/>
					))}
					{found.length > 8 && (
						<More
							hidden={found.length - 8}
							open={more}
							onClick={() => setMore(!more)}
							label={`More people (${Math.min(found.length, 40) - 8})`}
						/>
					)}
				</div>
			)}
		</div>
	)
}
