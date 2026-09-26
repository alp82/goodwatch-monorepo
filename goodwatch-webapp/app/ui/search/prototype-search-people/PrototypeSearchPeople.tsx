// PROTOTYPE - throwaway. People in search results, round 2, switchable with ?people=<variant> on
// /search (the search controller strips ?variant=, so this uses its own param).
// Round 1 (commit 4dcfa02e) picked the banner. Round 2 question: when several people match, how
// does the banner let you switch between them?
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
	peek: "Banner + side slivers",
	names: "Banner + name tabs",
	avatars: "Banner + avatar row",
	arrows: "Banner + arrows",
	rail: "Banner + people list",
	off: "No people (production today)",
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
	const raw = params.get("people") ?? "peek"
	const variant = (raw in PEOPLE_VARIANTS ? raw : "peek") as PeopleVariant
	const query = useQuery<{ people: PrototypePerson[] }>({
		queryKey: ["prototype-search-people", q],
		enabled: enabled && q.trim().length >= 2 && variant !== "off",
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
		shown: variant === "off" ? [] : people.filter((p) => p.level !== "low").slice(0, 8),
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
		"text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
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

// The round 1 banner: person page header look, three known-for posters.
function Banner({
	p,
	links,
	aside,
	below,
	from = 0,
}: {
	p: ScoredPerson
	links: ScopeLinks
	aside?: ReactNode
	below?: ReactNode
	// Where the new person comes from when switching: -1 left, 1 right, 0 no slide.
	from?: number
}) {
	const backdrop = p.knownFor.find((t) => t.backdrop)?.backdrop ?? null
	const href = personPath(p.id, p.name)
	return (
		<header className="relative isolate h-full overflow-hidden rounded-xl border border-gray-800">
			<BannerMotion />
			{backdrop && (
				<img
					key={backdrop}
					src={img(backdrop, "w1280") ?? ""}
					alt=""
					className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30 animate-[gwBackdropIn_400ms_ease-out_both] motion-reduce:animate-none"
				/>
			)}
			<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/70 to-transparent" />
			<div className="flex h-full">
				<div
					key={p.id}
					style={{ "--gw-from": `${from * 16}px` } as React.CSSProperties}
					className="flex min-w-0 flex-1 flex-wrap items-end gap-6 p-4 sm:p-6 animate-[gwPersonIn_260ms_cubic-bezier(0.2,0.8,0.2,1)_both] motion-reduce:animate-none"
				>
					{/* Portrait, role, and name are one link to the person page. */}
					<Link
						to={href}
						prefetch="intent"
						className="group/person flex min-w-0 flex-1 basis-72 cursor-pointer items-end gap-6 rounded-lg focus-visible:outline focus-visible:outline-cyan-300"
					>
						<span className="relative shrink-0">
							<Portrait
								p={p}
								className="h-36 w-24 rounded-lg shadow-2xl ring-2 ring-transparent transition duration-200 ease-out group-hover/person:-translate-y-0.5 group-hover/person:ring-amber-400/60 motion-reduce:transition-none"
							/>
						</span>
						<span className="min-w-0">
							<span className="block text-sm uppercase tracking-[0.2em] text-amber-400">
								{p.department}
							</span>
							<span className="block text-3xl font-black decoration-amber-400/60 decoration-2 underline-offset-4 transition-colors duration-200 group-hover/person:text-amber-50 group-hover/person:underline sm:text-4xl">
								{p.name}
							</span>
							<span className="mt-2 inline-flex items-center gap-1 text-sm text-cyan-300 transition-colors group-hover/person:text-cyan-200">
								See all titles
								<span
									aria-hidden="true"
									className="transition-transform duration-200 group-hover/person:translate-x-1 motion-reduce:transition-none"
								>
									→
								</span>
							</span>
						</span>
					</Link>
					<div className="basis-full sm:order-last">
						<ScopeNote p={p} links={links} />
					</div>
					<ul className="flex gap-2">
						{p.knownFor.slice(0, 3).map((t) => (
							<li key={t.id} className="w-20 sm:w-24">
								<Link
									to={`/${t.type}/${t.id}`}
									prefetch="intent"
									title={t.title}
									className="block cursor-pointer rounded-md transition duration-200 ease-out hover:-translate-y-1 focus-visible:outline focus-visible:outline-cyan-300 motion-reduce:transition-none"
								>
									<img
										src={img(t.poster) ?? ""}
										alt={t.title}
										className="aspect-[2/3] w-full rounded-md border-2 border-gray-800 object-cover shadow-lg transition-colors duration-200 hover:border-amber-700/50"
									/>
								</Link>
							</li>
						))}
					</ul>
				</div>
				{aside}
			</div>
			{below}
		</header>
	)
}

// --- Round 2 variants: the banner with a way to switch between people ------------------------

type Pick = { s: PeopleState; current: ScoredPerson; select: (id: number) => void }

// names: text tabs above the banner, in the style of the result pages' toggles.
function NameTabs({ s, current, select }: Pick) {
	return (
		<div role="tablist" aria-label="People" className="mb-2 flex flex-wrap gap-1">
			{s.shown.map((p) => (
				<button
					key={p.id}
					type="button"
					role="tab"
					aria-selected={p.id === current.id}
					onClick={() => select(p.id)}
					className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm transition-colors ${p.id === current.id ? "border-cyan-300/70 bg-gray-800 text-white" : "border-gray-600 bg-gray-900 text-gray-300 hover:text-white"}`}
				>
					{p.name}
				</button>
			))}
		</div>
	)
}

// avatars: the cast list's round portraits along the bottom of the banner.
function AvatarRow({ s, current, select }: Pick) {
	return (
		<div className="flex gap-3 overflow-x-auto border-t border-gray-800/80 bg-gray-950/60 px-4 py-3 sm:px-6">
			{s.shown.map((p) => (
				<button
					key={p.id}
					type="button"
					aria-pressed={p.id === current.id}
					onClick={() => select(p.id)}
					className="group flex w-16 shrink-0 cursor-pointer flex-col items-center"
				>
					<div
						className={`mb-1 h-12 w-12 overflow-hidden rounded-full border-2 shadow-lg transition-all ${p.id === current.id ? "border-amber-400" : "border-stone-500 opacity-70 group-hover:border-slate-200 group-hover:opacity-100"}`}
					>
						<Portrait p={p} className="h-full w-full" />
					</div>
					<span
						className={`w-16 truncate text-center text-[11px] ${p.id === current.id ? "text-white" : "text-gray-400"}`}
					>
						{p.name}
					</span>
				</button>
			))}
		</div>
	)
}

// arrows: step through people like a carousel; the count says there are more.
function ArrowBar({ s, current, select }: Pick) {
	const i = s.shown.findIndex((p) => p.id === current.id)
	const step = (d: number) =>
		select(s.shown[(i + d + s.shown.length) % s.shown.length].id)
	const button =
		"cursor-pointer rounded-md border border-gray-600 bg-gray-900/80 px-3 py-1.5 text-sm text-gray-200 hover:text-white"
	return (
		<div className="flex items-center justify-between gap-3 border-t border-gray-800/80 bg-gray-950/60 px-4 py-2 text-sm sm:px-6">
			<button type="button" className={button} onClick={() => step(-1)}>
				← {s.shown[(i - 1 + s.shown.length) % s.shown.length].name}
			</button>
			<span className="text-gray-400">
				{i + 1} of {s.shown.length} people
			</span>
			<button type="button" className={button} onClick={() => step(1)}>
				{s.shown[(i + 1) % s.shown.length].name} →
			</button>
		</div>
	)
}

// rail: the other people as compact collaborator rows inside the banner's right edge.
function PeopleRail({ s, current, select }: Pick) {
	return (
		<ul className="hidden w-64 shrink-0 space-y-1 overflow-y-auto border-l border-gray-800/80 bg-gray-950/60 p-2 md:block md:max-h-64">
			{s.shown.map((p) => (
				<li key={p.id}>
					<button
						type="button"
						aria-pressed={p.id === current.id}
						onClick={() => select(p.id)}
						className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border p-1.5 text-left ${p.id === current.id ? "border-amber-400/60 bg-gray-900" : "border-transparent hover:border-gray-700"}`}
					>
						<Portrait p={p} className="h-10 w-7 shrink-0 rounded" />
						<span className="min-w-0">
							<span className="block truncate text-sm font-semibold">{p.name}</span>
							<span className="block text-[11px] text-amber-400">{role(p)}</span>
						</span>
					</button>
				</li>
			))}
		</ul>
	)
}

// peek: every person keeps a fixed sliver next to the banner, the open one included, so nothing
// moves when you switch. Hover wakes a sliver up; the open one stays lit.
function Slivers({ s, current, select }: Pick) {
	return (
		<ul aria-label="People" className="ml-2 flex shrink-0 gap-1.5">
			{s.shown.slice(0, 6).map((p) => {
				const open = p.id === current.id
				return (
					<li key={p.id}>
						<button
							type="button"
							aria-pressed={open}
							aria-label={`Show ${p.name}`}
							onClick={() => select(p.id)}
							className={`group relative block h-full w-10 cursor-pointer overflow-hidden rounded-xl border transition duration-200 ease-out focus-visible:outline focus-visible:outline-cyan-300 active:scale-[0.97] motion-reduce:transition-none sm:w-14 ${open ? "border-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]" : "border-gray-800 hover:-translate-y-0.5 hover:border-gray-300/70 hover:shadow-xl"}`}
						>
							<Portrait
								p={p}
								className={`absolute inset-0 h-full w-full transition duration-300 ease-out motion-reduce:transition-none ${open ? "opacity-100" : "opacity-40 grayscale group-hover:scale-105 group-hover:opacity-90 group-hover:grayscale-0"}`}
							/>
							<span
								className={`absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-300 ${open ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
							/>
							<span
								className={`absolute top-0 inset-x-0 h-1 bg-amber-400 transition-transform duration-300 ease-out origin-top ${open ? "scale-y-100" : "scale-y-0"}`}
							/>
							<span
								className={`absolute inset-x-0 bottom-2 mx-auto rotate-180 text-xs font-semibold transition duration-200 ease-out [writing-mode:vertical-rl] motion-reduce:transition-none ${open ? "text-amber-300" : "text-gray-300 group-hover:-translate-y-1 group-hover:text-white"}`}
							>
								{p.name}
							</span>
						</button>
					</li>
				)
			})}
		</ul>
	)
}

// Keyframes for the banner's switch: the new person's content slides in from the side of the
// sliver you picked, and the backdrop fades in.
function BannerMotion() {
	return (
		<style>{`
@keyframes gwPersonIn { from { opacity: 0; transform: translateX(var(--gw-from, 0px)); } to { opacity: 1; transform: none; } }
@keyframes gwBackdropIn { from { opacity: 0; } to { opacity: 0.3; } }
`}</style>
	)
}

function PeopleBanner({ s, links }: { s: PeopleState; links: ScopeLinks }) {
	const [selected, setSelected] = useState<number | null>(null)
	const [from, setFrom] = useState(0)
	const key = s.shown.map((p) => p.id).join(",")
	// A new search starts on its best match again.
	useEffect(() => {
		setSelected(null)
		setFrom(0)
	}, [key])
	// Load every person's images up front, so switching never shows empty poster frames.
	useEffect(() => {
		for (const p of s.shown) {
			const backdrop = p.knownFor.find((t) => t.backdrop)?.backdrop ?? null
			for (const src of [
				img(p.profile),
				img(backdrop, "w1280"),
				...p.knownFor.slice(0, 3).map((t) => img(t.poster)),
			])
				if (src) new Image().src = src
		}
	}, [key])
	if (!s.shown.length) return null
	const current = s.shown.find((p) => p.id === selected) ?? s.shown[0]
	const index = (id: number) => s.shown.findIndex((p) => p.id === id)
	const select = (id: number) => {
		if (id === current.id) return
		setFrom(Math.sign(index(id) - index(current.id)))
		setSelected(id)
	}
	const pick: Pick = { s, current, select }
	const many = s.shown.length > 1
	const v = s.variant
	const banner = (
		<Banner
			p={current}
			links={links}
			from={from}
			aside={many && v === "rail" ? <PeopleRail {...pick} /> : undefined}
			below={
				many && v === "avatars" ? (
					<AvatarRow {...pick} />
				) : many && v === "arrows" ? (
					<ArrowBar {...pick} />
				) : undefined
			}
		/>
	)
	return (
		<section aria-label="People" className="mb-4">
			{many && v === "names" && <NameTabs {...pick} />}
			{many && v === "peek" ? (
				<div className="flex items-stretch">
					<div className="min-w-0 flex-1">{banner}</div>
					<Slivers {...pick} />
				</div>
			) : (
				banner
			)}
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
