// PROTOTYPE - throwaway. Five ways to mix people into the search results, switchable with
// ?people=<variant> on /search (the search controller strips ?variant=, so this uses its own param).
// Question: how do people show up without invading the title results?
// Every variant uses the same gate: how well the query matches the person's name. Descriptive
// queries rarely match a name, so they get no people. Legacy person rows from the old ranking
// are removed from the grid, as the production ranker does.
import { Link, useSearchParams } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { type ReactNode, useState } from "react"
import type { PrototypePerson } from "~/routes/api.prototype-search-people"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { personPath } from "~/utils/helpers"

export const PEOPLE_VARIANTS = {
	strip: "People row above results",
	slot: "Person in a grid slot",
	hero: "Banner on name match",
	aside: "Side column",
	tabs: "Titles / People tabs",
	off: "No people (production today)",
}
export type PeopleVariant = keyof typeof PEOPLE_VARIANTS

export type Level = "high" | "medium" | "low"
export type ScoredPerson = PrototypePerson & {
	confidence: number
	level: Level
	why: string
}

const words = (s: string): string[] =>
	s
		.toLocaleLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.match(/[\p{L}\p{N}]+/gu) ?? []

// How sure we are that the query asks for this person.
function score(p: PrototypePerson, q: string) {
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
	const variant = (params.get("people") ?? "strip") as PeopleVariant
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
	const shown = people.filter((p) => p.level !== "low")
	return {
		variant: variant in PEOPLE_VARIANTS ? variant : "strip",
		people,
		shown,
		top: shown[0]?.level === "high" ? shown[0] : undefined,
	}
}
export type PeopleState = ReturnType<typeof usePrototypePeople>

// --- Shared bits, copied from the existing person UI ----------------------------------------

const img = (path: string | null, size = "w300_and_h450_bestv2") =>
	path ? `https://www.themoviedb.org/t/p/${size}${path}` : null
const role = (p: PrototypePerson) =>
	p.department === "Acting" ? "Actor" : p.department || "Person"
const knownFor = (p: PrototypePerson, n = 3) =>
	p.knownFor
		.slice(0, n)
		.map((t) => t.title)
		.join(", ")

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

// The round actor avatar from the title page cast list, smaller.
function Avatar({ p }: { p: ScoredPerson }) {
	return (
		<Link
			to={personPath(p.id, p.name)}
			prefetch="intent"
			className="group flex w-20 shrink-0 flex-col items-center"
		>
			<div className="mb-1 h-16 w-16 overflow-hidden rounded-full border-2 border-stone-400 shadow-lg transition-all group-hover:border-slate-200">
				<Portrait p={p} className="h-full w-full" />
			</div>
			<p className="w-20 truncate text-center text-xs font-semibold" title={p.name}>
				{p.name}
			</p>
			<p className="w-20 truncate text-center text-[11px] text-gray-400">
				{role(p)}
			</p>
		</Link>
	)
}

// The collaborator card from the person page.
function PersonRowCard({ p }: { p: ScoredPerson }) {
	return (
		<Link
			to={personPath(p.id, p.name)}
			prefetch="intent"
			className="flex h-full gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 hover:border-amber-400/60"
		>
			<Portrait p={p} className="h-16 w-12 shrink-0 rounded-md" />
			<div className="min-w-0">
				<div className="truncate font-semibold">{p.name}</div>
				<div className="text-xs text-amber-400">{role(p)}</div>
				<div className="mt-1 line-clamp-2 text-xs text-gray-400">
					{knownFor(p)}
				</div>
			</div>
		</Link>
	)
}

// The search result poster card, with a portrait instead of a poster.
export function PersonResultCard({ p }: { p: ScoredPerson }) {
	return (
		<Link
			to={personPath(p.id, p.name)}
			prefetch="intent"
			className="group relative block aspect-[2/3] overflow-hidden rounded-lg border-4 border-gray-800 bg-gray-900 hover:border-amber-700/50 focus-visible:outline focus-visible:outline-cyan-300"
		>
			<Portrait
				p={p}
				className="h-full w-full transition-transform duration-300 group-hover:scale-105"
			/>
			<div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-transparent" />
			<div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5">
				<p className="text-[11px] uppercase tracking-[0.2em] text-amber-400">
					{role(p)}
				</p>
				<h3 className="text-sm font-bold leading-tight text-white line-clamp-2">
					{p.name}
				</h3>
				<p className="truncate text-[11px] text-gray-300">
					Known for {knownFor(p, 2)}
				</p>
			</div>
		</Link>
	)
}

// --- Variants ------------------------------------------------------------------------------

// strip: one row of round avatars between the status line and the grid. Nothing when no
// person clears the gate; the grid never moves sideways.
function Strip({ s }: { s: PeopleState }) {
	if (!s.shown.length) return null
	return (
		<section aria-label="People" className="mb-2">
			<h2 className="mb-2 text-sm text-gray-400">People</h2>
			<div className="flex gap-2 overflow-x-auto pb-2">
				{s.shown.slice(0, 8).map((p) => (
					<Avatar key={p.id} p={p} />
				))}
			</div>
		</section>
	)
}

// hero: a person header only when the query is clearly a name. Weaker matches get one line.
function Hero({ s }: { s: PeopleState }) {
	const p = s.top
	const others = s.shown.filter((x) => x !== p).slice(0, 5)
	const backdrop = p?.knownFor.find((t) => t.backdrop)?.backdrop ?? null
	return (
		<>
			{p && (
				<header className="relative isolate mb-4 overflow-hidden rounded-xl border border-gray-800">
					{backdrop && (
						<img
							src={img(backdrop, "w1280") ?? ""}
							alt=""
							className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30"
						/>
					)}
					<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/70 to-transparent" />
					<div className="flex flex-wrap items-end gap-6 p-4 sm:p-6">
						<Portrait
							p={p}
							className="h-36 w-24 shrink-0 rounded-lg shadow-2xl"
						/>
						<div className="min-w-0 flex-1">
							<p className="text-sm uppercase tracking-[0.2em] text-amber-400">
								{p.department}
							</p>
							<h2 className="text-3xl font-black sm:text-4xl">{p.name}</h2>
							<Link
								to={personPath(p.id, p.name)}
								prefetch="intent"
								className="mt-2 inline-block text-sm text-cyan-300 underline underline-offset-2"
							>
								See all titles with {p.name}
							</Link>
						</div>
						<ul className="flex gap-2">
							{p.knownFor.slice(0, 3).map((t) => (
								<li key={t.id} className="w-20 sm:w-24">
									<Link to={`/${t.type}/${t.id}`} prefetch="intent">
										<img
											src={img(t.poster) ?? ""}
											alt={t.title}
											className="aspect-[2/3] w-full rounded-md border-2 border-gray-800 object-cover hover:border-amber-700/50"
										/>
									</Link>
								</li>
							))}
						</ul>
					</div>
				</header>
			)}
			{others.length > 0 && (
				<p className="mb-3 text-sm text-gray-400">
					{p ? "Other people: " : "People: "}
					{others.map((o, i) => (
						<span key={o.id}>
							{i > 0 && ", "}
							<Link
								to={personPath(o.id, o.name)}
								prefetch="intent"
								className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
							>
								{o.name}
							</Link>
						</span>
					))}
				</p>
			)}
		</>
	)
}

// aside: people in their own column on wide screens, a closed disclosure on phones.
function Aside({ s, grid }: { s: PeopleState; grid: ReactNode }) {
	if (!s.shown.length) return <>{grid}</>
	const list = (
		<ul className="grid gap-2">
			{s.shown.slice(0, 5).map((p) => (
				<li key={p.id}>
					<PersonRowCard p={p} />
				</li>
			))}
		</ul>
	)
	return (
		<>
			<details className="mb-2 lg:hidden">
				<summary className="cursor-pointer py-2 text-sm text-gray-300">
					People ({s.shown.length})
				</summary>
				{list}
			</details>
			<div className="lg:flex lg:gap-4">
				<div className="min-w-0 flex-1">{grid}</div>
				<aside aria-label="People" className="hidden w-72 shrink-0 py-2 lg:block">
					<h2 className="mb-2 text-sm text-gray-400">People</h2>
					{list}
				</aside>
			</div>
		</>
	)
}

// tabs: people never share the title list; a tab with a count says they exist.
function Tabs({ s, grid }: { s: PeopleState; grid: ReactNode }) {
	const [tab, setTab] = useState<"titles" | "people">("titles")
	if (!s.shown.length) return <>{grid}</>
	const button = (key: "titles" | "people", label: string) => (
		<button
			type="button"
			aria-pressed={tab === key}
			onClick={() => setTab(key)}
			className={`rounded-md border px-3 py-1.5 text-sm ${tab === key ? "border-cyan-300/70 bg-gray-800 text-white" : "border-gray-600 bg-gray-900 text-gray-300 hover:text-white"}`}
		>
			{label}
		</button>
	)
	return (
		<>
			<div className="flex gap-1 py-2">
				{button("titles", "Titles")}
				{button("people", `People (${s.shown.length})`)}
			</div>
			{tab === "titles" ? (
				grid
			) : (
				<ul className="grid grid-cols-2 gap-2 py-2 sm:grid-cols-4 lg:grid-cols-5">
					{s.shown.map((p) => (
						<li key={p.id} className="min-w-0">
							<PersonResultCard p={p} />
						</li>
					))}
				</ul>
			)}
		</>
	)
}

/**
 * slot: where the top person goes in the title grid on page 1, or -1. An exact name takes the
 * first slot unless a title matches exactly too; a likely name takes the last slot of the
 * first row; everything else stays out of the grid.
 */
export function slotIndex(s: PeopleState, exactTitle: boolean) {
	if (s.variant !== "slot" || !s.shown.length) return -1
	const p = s.shown[0]
	if (p.level === "high") return exactTitle ? 1 : 0
	if (p.level === "medium") return 4
	return -1
}

/** Renders around the title grid: above it, beside it, or instead of it. */
export function PeopleAround({
	s,
	grid,
}: {
	s: PeopleState
	grid: ReactNode
}) {
	return (
		<>
			<PrototypeState s={s} />
			{s.variant === "strip" && <Strip s={s} />}
			{s.variant === "hero" && <Hero s={s} />}
			{s.variant === "aside" ? (
				<Aside s={s} grid={grid} />
			) : s.variant === "tabs" ? (
				<Tabs s={s} grid={grid} />
			) : (
				grid
			)}
			<PrototypeSwitcher variants={PEOPLE_VARIANTS} param="people" />
		</>
	)
}

// Surfaces the gate so the owner can see why people show up or not.
function PrototypeState({ s }: { s: PeopleState }) {
	const [open, setOpen] = useState(false)
	return (
		<div className="mb-2 rounded border border-dashed border-fuchsia-500/60 px-2 py-1 text-xs text-fuchsia-300">
			<button type="button" onClick={() => setOpen((o) => !o)}>
				Prototype: {s.people.length} people found, {s.shown.length} pass the gate
				{s.top ? `, top: ${s.top.name}` : ""}
				{" "}
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
