// PROTOTYPE (Discover lab, people c-e): split by role, kept simple. Roles from TMDB's known_for_department, a few
// well-known people per role for an empty bar (fetched by id from /api/cast, the same endpoint as the search), and a
// calm name row: small face, name, one tap to add. The people filter means "any of these" (filter-state), so picked
// people read as "or".
import { CheckIcon, PlusIcon } from "@heroicons/react/20/solid"
import { useQuery } from "@tanstack/react-query"
import { motion } from "framer-motion"
import type { CastMember } from "~/server/cast.server"
import { TAP } from "~/ui/filter-bar/motion"
import { Face, type People, type Person, PickedFace } from "./shared"

export type Role = "actors" | "directors" | "writers" | "crew"

export const roleFor = (department: string): Role =>
	department === "Acting" ? "actors" : department === "Directing" ? "directors" : department === "Writing" ? "writers" : "crew"

/** Well-known people per role (TMDB ids, checked against /api/cast 2026-10-28). Greta Gerwig and Phoebe Waller-Bridge
 * are listed by TMDB as actors, so the role here is ours. */
const FEATURED_IDS: Record<Role, number[]> = {
	actors: [505710, 1253360, 1373737, 1190668, 234352, 54693, 31, 5064],
	directors: [525, 45400, 137427, 488, 21684, 608, 1769, 5655],
	writers: [202, 66633, 25539, 1023483, 13520, 52444, 3027, 55934],
	crew: [947, 928158, 151],
}
const ALL_FEATURED = Object.values(FEATURED_IDS).flat()

const toPerson = (m: CastMember): Person => ({
	id: m.tmdb_id,
	name: m.name,
	profile: m.profile_path || null,
	department: m.known_for_department ?? "",
	popularity: m.popularity ?? 0,
})

/** The featured people, by role, in the listed order. */
export function useFeatured(): Record<Role, Person[]> & { loading: boolean } {
	const q = useQuery<{ castMembers: CastMember[] }>({
		queryKey: ["lab-people-featured"],
		queryFn: async () =>
			(await fetch(`/api/cast?${new URLSearchParams({ text: "", withCast: ALL_FEATURED.join(","), withoutCast: "" })}`)).json(),
		staleTime: Number.POSITIVE_INFINITY,
	})
	const byId = new Map((q.data?.castMembers ?? []).map((m) => [m.tmdb_id, toPerson(m)]))
	const pick = (r: Role) => FEATURED_IDS[r].map((id) => byId.get(id)).filter((p): p is Person => !!p)
	return { actors: pick("actors"), directors: pick("directors"), writers: pick("writers"), crew: pick("crew"), loading: q.isLoading }
}

/** Found people sorted into roles. */
export function byRole(found: Person[]): Record<Role, Person[]> {
	const out: Record<Role, Person[]> = { actors: [], directors: [], writers: [], crew: [] }
	for (const p of found) out[roleFor(p.department)].push(p)
	return out
}

/** One calm line: small face, name, and an add mark that turns into a check. */
export function NameRow({ p, people, note }: { p: Person; people: People; note?: string }) {
	const on = people.has(p.id)
	return (
		<motion.button
			type="button"
			whileTap={TAP}
			aria-pressed={on}
			onClick={() => people.toggle(p)}
			className={`group flex h-11 min-w-0 items-center gap-2.5 rounded-lg pr-2 pl-1.5 text-left cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
				on ? "bg-purple-400/[0.13]" : "hover:bg-white/[0.05]"
			}`}
		>
			<Face src={p.profile} size={32} className={on ? "ring-2 ring-purple-300/80" : ""} />
			<span className={`min-w-0 flex-1 truncate text-[14px] ${on ? "font-semibold text-white" : "text-gray-200"}`}>{p.name}</span>
			{note && <span className="shrink-0 text-[12px] text-gray-500">{note}</span>}
			<span
				className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors ${
					on ? "bg-purple-300 text-gray-950" : "text-gray-600 group-hover:bg-white/[0.08] group-hover:text-gray-200"
				}`}
				aria-hidden
			>
				{on ? <CheckIcon className="h-3.5 w-3.5" /> : <PlusIcon className="h-3.5 w-3.5" />}
			</span>
		</motion.button>
	)
}

export function RowsLoading({ n }: { n: number }) {
	return (
		<>
			{Array.from({ length: n }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders
				<div key={i} className="flex h-11 items-center gap-2.5 pl-1.5" aria-hidden>
					<span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-white/[0.06] motion-reduce:animate-none" />
					<span className="h-3 w-28 animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none" />
				</div>
			))}
		</>
	)
}

/** The picked people as removable face chips joined by "or" (the filter keeps titles with any of them). */
export function PickedOr({ people, lead, wrap = false }: { people: People; lead?: string; wrap?: boolean }) {
	// Nothing picked: nothing here (no empty slot).
	if (people.chosen.length === 0) return null
	return (
		<div className={`flex min-w-0 items-center gap-2 ${wrap ? "flex-wrap" : "overflow-hidden"}`}>
			{lead && <span className="shrink-0 text-[13px] text-gray-500">{lead}</span>}
			{people.chosen.map((id, i) => (
				<span key={id} className="flex shrink-0 items-center gap-2">
					{i > 0 && <span className="text-[13px] font-semibold text-purple-200/70">or</span>}
					<PickedFace id={id} p={people.known(id)} onRemove={() => people.remove(id)} />
				</span>
			))}
		</div>
	)
}
