// PROTOTYPE - throwaway. People in search results, round 4, switchable with ?people=<variant> on
// /search (the search controller strips ?variant=, so this uses its own param).
// Round 1 (commit 4dcfa02e) picked the banner, round 2 (eb9a7ad5, 649097d3) the peek slivers,
// round 3 (7e57360e) the accordion with the backdrop banner. Round 4: the portrait keeps its
// size and place while the panel opens; three ways to anchor it.
// Gate: how well the query matches a person's name. A full name inside a longer phrase ("funny
// brad pitt movies") counts as a full match, and the server narrows the titles to that person.
// Legacy person rows from the old ranking are removed from the grid, as the production ranker does.
import { Link, useSearchParams } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useEffect, useState } from "react"
import type { PrototypePerson } from "~/routes/api.prototype-search-people"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { personPath } from "~/utils/helpers"

export const PEOPLE_VARIANTS = {
	strip: "Accordion · photo strip, full photo when open",
}
export type PeopleVariant = keyof typeof PEOPLE_VARIANTS

export type Level = "high" | "medium" | "low"
export type ScoredPerson = PrototypePerson & {
	confidence: number
	level: Level
	why: string
}
export interface PersonScope {
	people: { id: number; name: string }[]
	rest: string
}

const words = (s: string): string[] =>
	s
		.toLocaleLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.match(/[\p{L}\p{N}]+/gu) ?? []

// How sure we are that the query asks for this person.
function score(p: PrototypePerson, q: string) {
	if (p.embedded) return { confidence: 1, why: "full name inside the phrase" }
	if (p.offered)
		return { confidence: 0.8, why: "one word of the phrase names this famous person" }
	const wanted = words(q)
	const name = words(p.name)
	if (!wanted.length || !name.length) return { confidence: 0, why: "no words" }
	const last = wanted[wanted.length - 1]
	const covered = wanted.every(
		(w) =>
			name.includes(w) ||
			(w === last && w.length >= 3 && name.some((n) => n.startsWith(w))),
	)
	const fame = Math.min(p.popularity / 40, 0.3)
	let confidence = 0
	let why = "name does not contain the query"
	if (wanted.join(" ") === name.join(" ")) {
		confidence = 1
		why = "exact name"
	} else if (covered && wanted.length >= 2) {
		confidence = 0.85
		why = "all query words in name"
	} else if (covered && name.includes(wanted[0])) {
		confidence = 0.45 + fame
		why = `one-word name match, fame +${fame.toFixed(2)}`
	} else if (covered) {
		confidence = 0.25 + fame
		why = "prefix of a name"
	}
	return { confidence, why }
}

export function usePrototypePeople(q: string, enabled: boolean) {
	const [params] = useSearchParams()
	const raw = params.get("people") ?? "strip"
	const variant = (raw in PEOPLE_VARIANTS ? raw : "strip") as PeopleVariant
	const query = useQuery<{ people: PrototypePerson[] }>({
		queryKey: ["prototype-search-people", q],
		enabled: enabled && q.trim().length >= 2,
		queryFn: async ({ signal }) =>
			(
				await fetch(
					`/api/prototype-search-people?q=${encodeURIComponent(q)}`,
					{ signal },
				)
			).json(),
		staleTime: Number.POSITIVE_INFINITY,
	})
	const people: ScoredPerson[] = (query.data?.people ?? [])
		.map((p) => {
			const s = score(p, q)
			const level: Level =
				s.confidence >= 0.8 ? "high" : s.confidence >= 0.55 ? "medium" : "low"
			return { ...p, ...s, level }
		})
		.sort((a, b) => b.confidence - a.confidence || b.popularity - a.popularity)
	// The person the search is narrowed to leads the banner.
	const picked = Number(params.get("person"))
	people.sort((a, b) => Number(b.id === picked) - Number(a.id === picked))
	return {
		variant,
		people,
		shown: people.filter((p) => p.level !== "low").slice(0, 8),
	}
}
export type PeopleState = ReturnType<typeof usePrototypePeople>

// --- Shared bits, copied from the existing person UI ----------------------------------------

const img = (path: string | null, size = "w300_and_h450_bestv2") =>
	path ? `https://www.themoviedb.org/t/p/${size}${path}` : null
const role = (p: PrototypePerson) =>
	p.department === "Acting" ? "Actor" : p.department || "Person"

// Portrait from the person page.
function Portrait({
	p,
	className,
}: { p: PrototypePerson; className: string }) {
	const src = img(p.profile)
	return src ? (
		<img src={src} alt="" className={`object-cover ${className}`} />
	) : (
		<div
			className={`flex items-center justify-center bg-gray-800 text-2xl font-bold text-gray-500 ${className}`}
		>
			{p.name.slice(0, 1)}
		</div>
	)
}

interface ScopeLinks {
	scope?: PersonScope
	anyPerson: boolean
	allHref: string
	scopedHref: string
	pickHref: (id: number) => string
}

// What the banner says about the title grid when the person was named inside the phrase.
function ScopeNote({ p, links }: { p: ScoredPerson; links: ScopeLinks }) {
	if (!p.embedded && !p.offered) return null
	const inScope = links.scope?.people.some((x) => x.id === p.id)
	const link =
		"cursor-pointer text-cyan-300 transition-colors hover:text-cyan-100"
	if (inScope && links.scope)
		return (
			<p className="text-sm text-gray-300">
				Showing titles with{" "}
				{links.scope.people.map((x) => x.name).join(" and ")} that match “
				{links.scope.rest}”.{" "}
				<Link to={links.allHref} preventScrollReset className={link}>
					Search all titles instead
				</Link>
			</p>
		)
	if (p.offered)
		return (
			<p className="text-sm text-gray-300">
				<Link to={links.pickHref(p.id)} preventScrollReset className={link}>
					Only titles with {p.name}
				</Link>
			</p>
		)
	if (links.anyPerson)
		return (
			<p className="text-sm text-gray-300">
				Showing all titles.{" "}
				<Link to={links.scopedHref} preventScrollReset className={link}>
					Only titles with {p.name}
				</Link>
			</p>
		)
	return null
}

const motionSafe = "motion-reduce:animate-none motion-reduce:transition-none"

function backdropOf(p: PrototypePerson) {
	return p.knownFor.find((t) => t.backdrop)?.backdrop ?? null
}

// Role, name, and the link to all titles: one link to the person page.
function NameBlock({ p, size = "large" }: { p: ScoredPerson; size?: "large" | "small" }) {
	return (
		<Link
			to={personPath(p.id, p.name)}
			prefetch="intent"
			className="group/name block min-w-0 cursor-pointer rounded focus-visible:outline focus-visible:outline-cyan-300"
		>
			<span className="block text-sm uppercase tracking-[0.2em] text-amber-400">
				{p.department}
			</span>
			<span
				className={`line-clamp-2 block font-black break-words text-gray-100 transition-colors duration-200 group-hover/name:text-white ${size === "large" ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}
			>
				{p.name}
			</span>
			<span className="mt-1 inline-flex items-center gap-1 text-sm text-cyan-300 transition-colors group-hover/name:text-cyan-200">
				See all titles
				<span
					aria-hidden="true"
					className={`transition-transform duration-200 group-hover/name:translate-x-1 ${motionSafe}`}
				>
					→
				</span>
			</span>
		</Link>
	)
}

function Posters({ p, size }: { p: ScoredPerson; size: string }) {
	return (
		<ul className="flex shrink-0 gap-2">
			{p.knownFor.slice(0, 3).map((t) => (
				<li key={t.id} className={size}>
					<Link
						to={`/${t.type}/${t.id}`}
						prefetch="intent"
						title={t.title}
						className={`block cursor-pointer rounded-md transition duration-200 ease-out hover:-translate-y-1 focus-visible:outline focus-visible:outline-cyan-300 ${motionSafe}`}
					>
						<img
							src={img(t.poster) ?? ""}
							alt={t.title}
							className="aspect-[2/3] w-full rounded-md border-2 border-gray-800 object-cover shadow-lg transition-colors duration-200 hover:border-gray-500"
						/>
					</Link>
				</li>
			))}
		</ul>
	)
}

// --- Round 4: the accordion with a backdrop banner, three ways to anchor the portrait -----------
// The portrait never moves or resizes: a closed person shows it at its final size and place, and
// opening only slides a drawer out to its right. Only the drawer's width animates, quickly.

type Anchor = "strip" | "card" | "avatar"
const ANCHOR: Record<PeopleVariant, Anchor> = {
	strip: "strip",
}
// Closed width of a person, per anchor.
const TILE: Record<Anchor, string> = {
	strip: "3.5rem",
	card: "6rem",
	avatar: "4.5rem",
}
const OPEN_MS = 220

function Motion() {
	return (
		<style>{`
@keyframes gwBackdropIn { from { opacity: 0; } to { opacity: 0.3; } }
@keyframes gwDrawerIn { from { opacity: 0; } to { opacity: 1; } }
`}</style>
	)
}

// The banner without its portrait: backdrop, name, scope note, and posters.
function Drawer({ p, links }: { p: ScoredPerson; links: ScopeLinks }) {
	return (
		<div
			className={`flex h-full items-end gap-6 p-4 animate-[gwDrawerIn_160ms_ease-out_both] sm:p-6 ${motionSafe}`}
		>
			<div className="min-w-0 flex-1 space-y-2">
				<NameBlock p={p} />
				<div className="text-sm">
					<ScopeNote p={p} links={links} />
				</div>
			</div>
			<Posters p={p} size="w-16 lg:w-20 xl:w-24" />
		</div>
	)
}

// The open panel's backdrop spans the whole panel, portrait included.
function PanelBackdrop({ p }: { p: ScoredPerson }) {
	const backdrop = backdropOf(p)
	return (
		<>
			{backdrop && (
				<img
					src={img(backdrop, "w1280") ?? ""}
					alt=""
					className={`absolute inset-y-0 left-0 -z-10 h-full w-(--gw-open) max-w-none object-cover opacity-30 animate-[gwBackdropIn_300ms_ease-out_both] ${motionSafe}`}
				/>
			)}
			<div className="absolute inset-y-0 left-0 -z-10 w-(--gw-open) bg-linear-to-t from-gray-950 via-gray-950/70 to-transparent" />
		</>
	)
}

/** What a person shows at their own place, closed or open. Never changes size or position. */
function AnchorFace({
	p,
	anchor,
	open,
}: { p: ScoredPerson; anchor: Anchor; open: boolean }) {
	const photo = `transition-[filter,opacity] duration-150 ${motionSafe} ${open ? "" : "opacity-50 grayscale group-hover:opacity-100 group-hover:grayscale-0"}`
	const name = (extra: string) => (
		<span
			className={`pointer-events-none absolute font-semibold text-gray-200 transition-colors group-hover:text-white ${extra} ${open ? "invisible" : ""}`}
		>
			{p.name}
		</span>
	)
	if (anchor === "strip")
		// The photo strip itself: full height, fixed width.
		return (
			<>
				<Portrait p={p} className={`absolute inset-0 h-full w-full ${photo}`} />
				<span
					className={`pointer-events-none absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent ${open ? "invisible" : ""}`}
				/>
				{name(
					"inset-x-0 bottom-2 mx-auto rotate-180 text-xs [writing-mode:vertical-rl]",
				)}
			</>
		)
	if (anchor === "card")
		// The banner's portrait card, at the spot it has in the open banner.
		return (
			<>
				{name("inset-x-2 top-3 line-clamp-3 text-left text-xs leading-snug")}
				<Portrait
					p={p}
					className={`absolute bottom-4 left-2 h-30 w-20 rounded-lg shadow-2xl sm:bottom-6 ${photo}`}
				/>
			</>
		)
	// The cast list's round portrait, at the bottom, with the name running up above it.
	return (
		<>
			{name(
				"inset-x-0 bottom-24 mx-auto rotate-180 text-xs [writing-mode:vertical-rl]",
			)}
			<span className="absolute bottom-4 left-1/2 block h-14 w-14 -translate-x-1/2 overflow-hidden rounded-full border-2 border-stone-400 shadow-lg sm:bottom-6">
				<Portrait p={p} className={`h-full w-full ${photo}`} />
			</span>
		</>
	)
}

function Accordion4({
	s,
	current,
	select,
	anchor,
	links,
}: {
	s: PeopleState
	current: ScoredPerson
	select: (id: number) => void
	anchor: Anchor
	links: ScopeLinks
}) {
	const people = s.shown.slice(0, 6)
	return (
		<ul
			aria-label="People"
			style={
				{
					"--gw-tile": TILE[anchor],
					// The open person's portrait: the strip at full 2:3 width for the row's 15rem
					// height; the other anchors keep their closed width.
					"--gw-photo": anchor === "strip" ? "10rem" : TILE[anchor],
					// The open panel's final width: the row minus the closed people and the gaps.
					"--gw-open": `calc(100cqw - ${people.length - 1} * (var(--gw-tile) + 0.375rem))`,
				} as React.CSSProperties
			}
			className="@container flex h-60 gap-1.5"
		>
			{people.map((p) => {
				const open = p.id === current.id
				return (
					<li
						key={p.id}
						style={{
							flexGrow: open ? 1 : 0,
							transitionDuration: `${OPEN_MS}ms`,
						}}
						className={`group relative isolate min-w-0 shrink-0 basis-(--gw-tile) overflow-hidden rounded-xl border bg-gray-900 transition-[flex-grow,border-color] ease-out ${motionSafe} ${open ? "border-gray-800" : "border-gray-800/60 hover:border-gray-500"}`}
					>
						{open && <PanelBackdrop p={p} />}
						{open ? (
							// Open: the portrait links to the person page, the drawer sits to its right.
							<>
								<Link
									to={personPath(p.id, p.name)}
									prefetch="intent"
									aria-label={`${p.name}: all titles`}
									className="absolute inset-y-0 left-0 w-(--gw-photo) cursor-pointer focus-visible:outline focus-visible:outline-cyan-300"
								>
									<AnchorFace p={p} anchor={anchor} open />
								</Link>
								<div className="absolute inset-y-0 left-(--gw-photo) w-[calc(var(--gw-open)-var(--gw-photo))]">
									<Drawer p={p} links={links} />
								</div>
							</>
						) : (
							<button
								type="button"
								aria-label={`Show ${p.name}`}
								onClick={() => select(p.id)}
								className="absolute inset-y-0 left-0 w-(--gw-tile) cursor-pointer focus-visible:outline focus-visible:outline-cyan-300"
							>
								<AnchorFace p={p} anchor={anchor} open={false} />
							</button>
						)}
					</li>
				)
			})}
		</ul>
	)
}

function PeopleBanner({ s, links }: { s: PeopleState; links: ScopeLinks }) {
	const [selected, setSelected] = useState<number | null>(null)
	const key = s.shown.map((p) => p.id).join(",")
	// A new search starts on its best match again.
	useEffect(() => setSelected(null), [key])
	// Load every person's images up front, so opening never shows empty poster frames.
	useEffect(() => {
		for (const p of s.shown) {
			for (const src of [
				img(p.profile),
				img(backdropOf(p), "w1280"),
				...p.knownFor.slice(0, 3).map((t) => img(t.poster)),
			])
				if (src) new Image().src = src
		}
	}, [key])
	if (!s.shown.length) return null
	const current = s.shown.find((p) => p.id === selected) ?? s.shown[0]
	return (
		<section aria-label="People" className="mb-4">
			<Motion />
			<Accordion4
				s={s}
				current={current}
				select={setSelected}
				anchor={ANCHOR[s.variant]}
				links={links}
			/>
		</section>
	)
}

/** Renders the people banner above the title grid. */
export function PeopleAround({
	s,
	grid,
	links,
}: {
	s: PeopleState
	grid: ReactNode
	links: ScopeLinks
}) {
	return (
		<>
			<PrototypeState s={s} links={links} />
			<PeopleBanner s={s} links={links} />
			{grid}
			<PrototypeSwitcher variants={PEOPLE_VARIANTS} param="people" />
		</>
	)
}

// Surfaces the gate so the owner can see why people show up or not.
function PrototypeState({ s, links }: { s: PeopleState; links: ScopeLinks }) {
	const [open, setOpen] = useState(false)
	return (
		<div className="mb-2 rounded border border-dashed border-fuchsia-500/60 px-2 py-1 text-xs text-fuchsia-300">
			<button type="button" className="cursor-pointer" onClick={() => setOpen((o) => !o)}>
				Prototype: {s.people.length} people found, {s.shown.length} pass the gate
				{links.scope
					? ` · titles narrowed to ${links.scope.people.map((p) => p.name).join(" + ")}, ranked by “${links.scope.rest}”`
					: ""}{" "}
				{open ? "▾" : "▸"}
			</button>
			{open && (
				<ul className="mt-1 space-y-0.5 font-mono">
					{s.people.map((p) => (
						<li key={p.id}>
							{p.level.padEnd(6)} {p.confidence.toFixed(2)} {p.name} ({p.department},
							pop {p.popularity.toFixed(1)}) - {p.why}
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
