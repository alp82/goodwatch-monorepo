// PROTOTYPE - throwaway. People in search results, round 3, switchable with ?people=<variant> on
// /search (the search controller strips ?variant=, so this uses its own param).
// Round 1 (commit 4dcfa02e) picked the banner, round 2 (eb9a7ad5, 649097d3) picked the peek
// slivers. Round 3: peek layouts (side slivers, or a horizontal accordion that opens in place)
// crossed with banner looks (backdrop, portrait, posters, compact).
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
	peek: "Peek · backdrop banner",
	"peek-portrait": "Peek · portrait banner",
	accordion: "Accordion · backdrop banner",
	"accordion-portrait": "Accordion · portrait banner",
	"accordion-posters": "Accordion · poster banner",
	"accordion-compact": "Accordion · compact banner",
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

// --- Round 3: peek layouts and banner looks ---------------------------------------------------

type Look = "backdrop" | "portrait" | "posters" | "compact"
type Layout = "peek" | "accordion"
const VARIANT_SHAPE: Record<PeopleVariant, { layout: Layout; look: Look }> = {
	peek: { layout: "peek", look: "backdrop" },
	"peek-portrait": { layout: "peek", look: "portrait" },
	accordion: { layout: "accordion", look: "backdrop" },
	"accordion-portrait": { layout: "accordion", look: "portrait" },
	"accordion-posters": { layout: "accordion", look: "posters" },
	"accordion-compact": { layout: "accordion", look: "compact" },
}
// Banner height per look, shared by both layouts so the slivers match it.
const LOOK_HEIGHT: Record<Look, string> = {
	backdrop: "h-60",
	portrait: "h-60",
	posters: "h-64",
	compact: "h-32",
}
// On phones the banner stacks, so it needs more height.
const PHONE_HEIGHT: Record<Look, string> = {
	backdrop: "max-sm:h-[29rem]",
	portrait: "max-sm:h-[30rem]",
	posters: "max-sm:h-[27rem]",
	compact: "max-sm:h-32",
}

// Keyframes: content arrives from the side of the picked sliver, the backdrop fades in, and an
// accordion panel reveals its content once it has started to open.
function Motion() {
	return (
		<style>{`
@keyframes gwPersonIn { from { opacity: 0; transform: translateX(var(--gw-from, 0px)); } to { opacity: 1; transform: none; } }
@keyframes gwBackdropIn { from { opacity: 0; } to { opacity: 0.3; } }
@keyframes gwReveal { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
`}</style>
	)
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
				className={`block truncate font-black text-gray-100 transition-colors duration-200 group-hover/name:text-white ${size === "large" ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}
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

function PortraitLink({
	p,
	className,
	fill = false,
}: { p: ScoredPerson; className: string; fill?: boolean }) {
	return (
		<Link
			to={personPath(p.id, p.name)}
			prefetch="intent"
			tabIndex={-1}
			aria-hidden="true"
			className={`block shrink-0 cursor-pointer transition-transform duration-200 ease-out ${fill ? "h-full w-full" : "hover:-translate-y-0.5"} ${motionSafe}`}
		>
			<Portrait p={p} className={className} />
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

/** The banner's content in one of the looks. Fills its parent, which sets height and frame. */
function BannerBody({
	p,
	links,
	look,
}: { p: ScoredPerson; links: ScopeLinks; look: Look }) {
	const backdrop = backdropOf(p)
	const note = (
		<div className="text-sm">
			<ScopeNote p={p} links={links} />
		</div>
	)
	const shade = (
		<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/70 to-transparent" />
	)
	if (look === "portrait")
		// The sliver's portrait widens into the banner; the name sits on the dark side.
		return (
			<div className="relative isolate flex h-full max-sm:flex-col">
				<div className="relative h-full w-56 shrink-0 max-sm:h-48 max-sm:w-full">
					<PortraitLink p={p} fill className="h-full w-full object-[50%_20%]" />
					<div className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-transparent to-gray-950 max-sm:bg-linear-to-b" />
				</div>
				<div className="flex min-w-0 flex-1 flex-wrap items-end justify-between gap-4 bg-gray-950 p-4 sm:p-6">
					<div className="min-w-0 space-y-2">
						<NameBlock p={p} />
						{note}
					</div>
					<Posters p={p} size="w-20 sm:w-24" />
				</div>
			</div>
		)
	if (look === "posters")
		// Posters are the picture; the person is a caption on the left.
		return (
			<div className="flex h-full items-stretch gap-4 bg-gray-900 p-4 max-sm:flex-col-reverse sm:p-5">
				<div className="flex w-56 shrink-0 flex-col justify-end gap-3 max-sm:w-auto">
					<PortraitLink p={p} className="h-20 w-14 rounded-md shadow-xl" />
					<NameBlock p={p} size="small" />
					{note}
				</div>
				<ul className="flex min-w-0 flex-1 justify-end gap-3 max-sm:h-40 max-sm:flex-none max-sm:justify-start">
					{p.knownFor.slice(0, 3).map((t) => (
						<li key={t.id} className="h-full">
							<Link
								to={`/${t.type}/${t.id}`}
								prefetch="intent"
								title={t.title}
								className={`group/poster block h-full cursor-pointer transition duration-200 ease-out hover:-translate-y-1 ${motionSafe}`}
							>
								<img
									src={img(t.poster) ?? ""}
									alt={t.title}
									className="aspect-[2/3] h-full rounded-md border-2 border-gray-800 object-cover shadow-xl transition-colors group-hover/poster:border-gray-500"
								/>
							</Link>
						</li>
					))}
				</ul>
			</div>
		)
	if (look === "compact")
		// One short row: the cast list's round portrait, the name, small posters.
		return (
			<div className="relative isolate flex h-full items-center gap-4 px-4 sm:px-5">
				{backdrop && (
					<img
						key={backdrop}
						src={img(backdrop, "w1280") ?? ""}
						alt=""
						className={`absolute inset-0 -z-10 h-full w-full object-cover opacity-30 animate-[gwBackdropIn_400ms_ease-out_both] ${motionSafe}`}
					/>
				)}
				<div className="absolute inset-0 -z-10 bg-linear-to-r from-gray-950 via-gray-950/80 to-gray-950/40" />
				<PortraitLink
					p={p}
					className="h-20 w-20 rounded-full border-2 border-stone-400 shadow-lg"
				/>
				<div className="min-w-0 flex-1 space-y-1">
					<NameBlock p={p} size="small" />
					{note}
				</div>
				<Posters p={p} size="hidden w-14 sm:block" />
			</div>
		)
	// backdrop: the person page header.
	return (
		<div className="relative isolate flex h-full flex-wrap items-end gap-6 p-4 sm:p-6">
			{backdrop && (
				<img
					key={backdrop}
					src={img(backdrop, "w1280") ?? ""}
					alt=""
					className={`absolute inset-0 -z-10 h-full w-full object-cover opacity-30 animate-[gwBackdropIn_400ms_ease-out_both] ${motionSafe}`}
				/>
			)}
			{shade}
			<PortraitLink p={p} className="h-36 w-24 rounded-lg shadow-2xl" />
			<div className="min-w-0 flex-1 basis-56 space-y-2">
				<NameBlock p={p} />
				{note}
			</div>
			<Posters p={p} size="w-20 sm:w-24" />
		</div>
	)
}

// A collapsed person: portrait strip with the name running up. Open means full color.
// On phones a sliver is a short row (accordion) or a small tile (peek) with a flat name.
function SliverFace({
	p,
	open,
	phone,
}: { p: ScoredPerson; open: boolean; phone: "row" | "tile" }) {
	const flat =
		phone === "row"
			? "max-sm:inset-x-auto max-sm:bottom-auto max-sm:top-1/2 max-sm:left-16 max-sm:-translate-y-1/2 max-sm:group-hover:-translate-y-1/2 max-sm:text-sm"
			: "max-sm:bottom-1 max-sm:w-full max-sm:truncate max-sm:px-1 max-sm:text-center max-sm:text-[10px] max-sm:group-hover:translate-y-0"
	return (
		<>
			<Portrait
				p={p}
				className={`absolute inset-0 h-full w-full transition duration-300 ease-out ${phone === "row" ? "max-sm:w-12 max-sm:object-[50%_25%]" : ""} ${motionSafe} ${open ? "opacity-100" : "opacity-40 grayscale group-hover:scale-105 group-hover:opacity-90 group-hover:grayscale-0"}`}
			/>
			<span
				className={`absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-300 ${open ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`}
			/>
			<span
				className={`absolute inset-x-0 bottom-2 mx-auto rotate-180 text-xs font-semibold transition duration-200 ease-out [writing-mode:vertical-rl] max-sm:rotate-0 max-sm:[writing-mode:horizontal-tb] ${flat} ${motionSafe} ${open ? "text-white" : "text-gray-300 group-hover:-translate-y-1 group-hover:text-white"}`}
			>
				{p.name}
			</span>
		</>
	)
}
const sliverButton = (open: boolean) =>
	`group relative block h-full w-full cursor-pointer overflow-hidden rounded-xl border transition duration-200 ease-out focus-visible:outline focus-visible:outline-cyan-300 active:scale-[0.97] ${motionSafe} ${open ? "border-gray-500" : "border-gray-800 hover:-translate-y-0.5 hover:border-gray-300/70 hover:shadow-xl"}`

type Pick = {
	s: PeopleState
	current: ScoredPerson
	select: (id: number) => void
	from: number
	look: Look
	links: ScopeLinks
}

// peek: the banner on the left, every person as a fixed sliver on the right. The open person's
// sliver stays in place in full color.
function Peek({ s, current, select, from, look, links }: Pick) {
	const many = s.shown.length > 1
	return (
		<div className={`flex max-sm:h-auto max-sm:flex-col ${LOOK_HEIGHT[look]}`}>
			<div
				className={`relative min-w-0 flex-1 overflow-hidden rounded-xl border border-gray-800 ${PHONE_HEIGHT[look]}`}
			>
				<div
					key={current.id}
					style={{ "--gw-from": `${from * 16}px` } as React.CSSProperties}
					className={`h-full animate-[gwPersonIn_260ms_cubic-bezier(0.2,0.8,0.2,1)_both] ${motionSafe}`}
				>
					<BannerBody p={current} links={links} look={look} />
				</div>
			</div>
			{many && (
				<ul
					aria-label="People"
					className="ml-2 flex shrink-0 gap-1.5 max-sm:mt-2 max-sm:ml-0 max-sm:h-20"
				>
					{s.shown.slice(0, 6).map((p) => (
						<li key={p.id} className="h-full w-14 max-sm:w-auto max-sm:flex-1">
							<button
								type="button"
								aria-pressed={p.id === current.id}
								aria-label={`Show ${p.name}`}
								onClick={() => select(p.id)}
								className={sliverButton(p.id === current.id)}
							>
								<SliverFace p={p} open={p.id === current.id} phone="tile" />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}

// accordion: every person keeps a fixed place in one row; the open one widens where it stands
// and its sliver turns into the banner.
function Accordion({ s, current, select, look, links }: Pick) {
	const people = s.shown.slice(0, 6)
	return (
		<ul
			aria-label="People"
			// The open panel's final width: the row minus the closed slivers and the gaps.
			style={
				{
					"--gw-open": `calc(100cqw - ${people.length - 1} * (var(--gw-sliver) + 0.375rem) - 2px)`,
				} as React.CSSProperties
			}
			className={`@container flex gap-1.5 [--gw-sliver:3.5rem] max-sm:h-auto max-sm:flex-col ${LOOK_HEIGHT[look]}`}
		>
			{people.map((p) => {
				const open = p.id === current.id
				return (
					<li
						key={p.id}
						style={{ flexGrow: open ? 1 : 0 }}
						className={`relative min-w-0 shrink-0 basis-(--gw-sliver) overflow-hidden rounded-xl border transition-[flex-grow,border-color,height] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] max-sm:basis-auto ${open ? PHONE_HEIGHT[look] : "max-sm:h-12"} ${motionSafe} ${open ? "border-gray-800" : "border-transparent"}`}
					>
						{/* The banner is laid out at its full width from the start, so it is uncovered
						    while the panel opens instead of reflowing. */}
						{open && (
							<div
								className={`absolute inset-y-0 left-0 w-(--gw-open) max-sm:w-full animate-[gwReveal_300ms_ease-out_120ms_both] ${motionSafe}`}
							>
								<BannerBody p={p} links={links} look={look} />
							</div>
						)}
						<button
							type="button"
							aria-pressed={open}
							aria-label={`Show ${p.name}`}
							onClick={() => select(p.id)}
							tabIndex={open ? -1 : 0}
							className={`${sliverButton(false)} absolute inset-0 transition-opacity duration-200 ${open ? "pointer-events-none opacity-0" : "opacity-100"}`}
						>
							<SliverFace p={p} open={false} phone="row" />
						</button>
					</li>
				)
			})}
		</ul>
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
	const index = (id: number) => s.shown.findIndex((p) => p.id === id)
	const select = (id: number) => {
		if (id === current.id) return
		setFrom(Math.sign(index(id) - index(current.id)))
		setSelected(id)
	}
	const { layout, look } = VARIANT_SHAPE[s.variant]
	const pick: Pick = { s, current, select, from, look, links }
	return (
		<section aria-label="People" className="mb-4">
			<Motion />
			{layout === "accordion" ? <Accordion {...pick} /> : <Peek {...pick} />}
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
