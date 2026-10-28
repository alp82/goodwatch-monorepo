// PROTOTYPE (Discover lab, section "people"): what the people variants share. The same people search as the sheet's
// Cast and crew card (FilterPickers PeoplePicker: /api/cast, faces and the better-known first), driven by the bar's text,
// and the picked people (d.filters.state.people) with names and faces.
import { CheckIcon, UserIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import type { CastMember } from "~/server/cast.server"
import { TAP } from "~/ui/filter-bar/motion"
import type { ProtoDiscover } from "../../../kit"

export const PROFILE = "https://image.tmdb.org/t/p/w185"
export const NAME_EXAMPLES = ["Zendaya", "Christopher Nolan", "Greta Gerwig", "Pedro Pascal", "Denis Villeneuve", "Florence Pugh"]

export interface Person {
	id: number
	name: string
	profile: string | null
	department: string
	popularity: number
}

const ROLE: Record<string, string> = {
	Acting: "Actor",
	Directing: "Director",
	Writing: "Writer",
	Production: "Producer",
	Sound: "Music",
	Camera: "Camera",
	Editing: "Editor",
	Art: "Art",
	"Costume & Make-Up": "Costume",
	"Visual Effects": "Effects",
	Crew: "Crew",
}
export const roleOf = (department: string) => ROLE[department] ?? department

const toPerson = (m: CastMember): Person => ({
	id: m.tmdb_id,
	name: m.name,
	profile: m.profile_path || null,
	department: m.known_for_department ?? "",
	popularity: m.popularity ?? 0,
})

function useDebounced<T>(value: T, ms = 200): T {
	const [v, setV] = useState(value)
	useEffect(() => {
		const id = setTimeout(() => setV(value), ms)
		return () => clearTimeout(id)
	}, [value, ms])
	return v
}

/** People whose name matches the bar's text (two letters or more), and the picked people. */
export function usePeople(d: ProtoDiscover, text: string) {
	const chosen = d.filters.state.people ?? []
	const term = useDebounced(text.trim())
	const q = useQuery<{ castMembers: CastMember[] }>({
		queryKey: ["filter-people-search", term],
		queryFn: async () => (await fetch(`/api/cast?${new URLSearchParams({ text: term, withCast: "", withoutCast: "" })}`)).json(),
		enabled: term.length >= 2,
		placeholderData: (p) => p,
	})
	const names = useQuery<{ castMembers: CastMember[] }>({
		queryKey: ["filter-people-chosen", chosen.join(",")],
		queryFn: async () => (await fetch(`/api/cast?${new URLSearchParams({ text: "", withCast: chosen.join(","), withoutCast: "" })}`)).json(),
		enabled: chosen.length > 0,
		placeholderData: (p) => p,
	})
	const [seen, setSeen] = useState(() => new Map<number, Person>())
	const found: Person[] = (term.length >= 2 ? (q.data?.castMembers ?? []) : [])
		.map(toPerson)
		.sort((a, b) => Number(!!b.profile) - Number(!!a.profile) || b.popularity - a.popularity)
	const known = (id: number): Person | undefined =>
		seen.get(id) ??
		(() => {
			const m = names.data?.castMembers.find((p) => p.tmdb_id === id)
			return m ? toPerson(m) : undefined
		})()
	const has = (id: number) => chosen.includes(id)
	const toggle = (p: Person) => {
		setSeen((m) => new Map(m).set(p.id, p))
		const next = has(p.id) ? chosen.filter((x) => x !== p.id) : [...chosen, p.id]
		d.filters.set({ people: next.length ? next : undefined })
	}
	const remove = (id: number) => {
		const next = chosen.filter((x) => x !== id)
		d.filters.set({ people: next.length ? next : undefined })
	}
	const asking = text.trim().length >= 2
	return {
		chosen,
		found,
		known,
		has,
		toggle,
		remove,
		asking,
		term,
		loading: asking && (q.isFetching || term !== text.trim()),
	}
}
export type People = ReturnType<typeof usePeople>

export function Face({ src, size, className = "" }: { src: string | null; size: number; className?: string }) {
	return (
		<span className={`block shrink-0 overflow-hidden rounded-full bg-white/[0.07] ${className}`} style={{ width: size, height: size }}>
			{src ? (
				<img src={`${PROFILE}${src}`} alt="" loading="lazy" className="h-full w-full object-cover" />
			) : (
				<span className="grid h-full w-full place-items-center text-gray-600">
					<UserIcon style={{ width: size * 0.5, height: size * 0.5 }} />
				</span>
			)}
		</span>
	)
}

/** A found person: face, name, role; tap to add or take off. */
export function PersonTile({ p, on, onToggle, size = 48 }: { p: Person; on: boolean; onToggle: () => void; size?: number }) {
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={on}
			onClick={onToggle}
			className={`group flex min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on ? "bg-purple-400/[0.14] ring-1 ring-inset ring-purple-300/50" : "hover:bg-white/[0.06]"
			}`}
		>
			<span className="relative shrink-0">
				<Face src={p.profile} size={size} />
				{on && (
					<span className="absolute -right-0.5 -bottom-0.5 grid h-5 w-5 place-items-center rounded-full bg-purple-300 text-gray-950 ring-2 ring-[#0b1120]">
						<CheckIcon className="h-3 w-3" />
					</span>
				)}
			</span>
			<span className="min-w-0">
				<span className="block truncate text-[14px] font-semibold text-gray-100">{p.name}</span>
				<span className="block truncate text-[12px] text-gray-500">{roleOf(p.department)}</span>
			</span>
		</motion.button>
	)
}

/** A picked person as a removable face chip. */
export function PickedFace({ p, id, onRemove, big = false }: { p: Person | undefined; id: number; onRemove: () => void; big?: boolean }) {
	if (big)
		return (
			<motion.button
				type="button"
				layout="position"
				whileTap={TAP}
				onClick={onRemove}
				aria-label={`Remove ${p?.name ?? id}`}
				className="group relative flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-xl cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<span className="relative">
					<Face src={p?.profile ?? null} size={64} className="ring-2 ring-purple-300/80 ring-offset-2 ring-offset-[#0b1120]" />
					<span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-gray-950 text-gray-300 ring-1 ring-white/20 group-hover:text-white">
						<XMarkIcon className="h-3 w-3" />
					</span>
				</span>
				<span className="w-full truncate text-center text-[12px] text-gray-300">{p?.name ?? "…"}</span>
			</motion.button>
		)
	return (
		<motion.span
			layout="position"
			className="inline-flex h-9 shrink-0 items-center rounded-full bg-purple-400/[0.14] pl-1 text-[13px] font-semibold whitespace-nowrap text-white ring-1 ring-inset ring-purple-300/50"
		>
			<Face src={p?.profile ?? null} size={28} />
			<span className="pl-2">{p?.name ?? "…"}</span>
			<button
				type="button"
				onClick={onRemove}
				aria-label={`Remove ${p?.name ?? id}`}
				className="grid h-full w-8 place-items-center rounded-r-full text-purple-200/70 cursor-pointer outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</motion.span>
	)
}

export function PeopleLoading({ n, size = 48 }: { n: number; size?: number }) {
	return (
		<>
			{Array.from({ length: n }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
				<div key={i} className="flex items-center gap-3 px-2 py-2" aria-hidden>
					<span className="shrink-0 animate-pulse rounded-full bg-white/[0.06] motion-reduce:animate-none" style={{ width: size, height: size }} />
					<span className="h-3 w-24 animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none" />
				</div>
			))}
		</>
	)
}

export function NameExamples({ onPick, scroll = false }: { onPick: (name: string) => void; scroll?: boolean }) {
	return (
		<div className={`flex gap-2 ${scroll ? "-mx-4 overflow-x-auto px-4 pb-1" : "flex-wrap"}`}>
			{NAME_EXAMPLES.map((n) => (
				<button
					key={n}
					type="button"
					onClick={() => onPick(n)}
					className="flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/[0.06] pr-3.5 pl-2.5 text-[14px] whitespace-nowrap text-gray-200 cursor-pointer outline-none hover:bg-white/[0.11] hover:text-white focus-visible:ring-2 focus-visible:ring-amber-400"
				>
					<UserIcon className="h-4 w-4 text-purple-300/70" aria-hidden />
					{n}
				</button>
			))}
		</div>
	)
}
