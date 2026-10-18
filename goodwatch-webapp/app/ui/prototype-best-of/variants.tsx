// Prototype only (branch prototype/best-of-lists): layout variants of the best-of lists and the people list, built
// from the site's existing pieces (MovieTvCard, the Your scores row look, ScoreRing, Portrait, the person page's
// collaborator cards, people search's known-for posters, the footer).
import { Link } from "@remix-run/react"
import type {
	CohortPerson,
	CohortTitle,
} from "~/server/prototype-best-of.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import ScoreRing from "~/ui/details/hero/ScoreRing"
import { genres as genrePages } from "~/ui/explore/category/genres"
import { Poster } from "~/ui/my-pages/bits"
import Breadcrumbs from "~/ui/nav/Breadcrumbs"
import { Portrait } from "~/ui/person/Portrait"

export type Kind = "movies" | "shows"

const noun = (kind: Kind) => (kind === "movies" ? "movies" : "TV shows")

export const listCopy = (kind: Kind, count: number, popular: number) => ({
	title: `The Best ${kind === "movies" ? "Movies" : "TV Shows"} of All Time, Ranked | GoodWatch`,
	heading: `The best ${noun(kind)} of all time`,
	intro: `${count} well-known ${noun(kind)}, ranked by GoodWatch score: the most-rated ${noun(kind)} on GoodWatch, plus ${popular} that are popular right now. Updated monthly.`,
})

export const peopleCopy = (people: CohortPerson[]) => {
	// The selection takes leads and directors; say only what the current 30 are.
	const directors = people.some((p) => p.department === "Directing")
	const actors = people.some((p) => p.department !== "Directing")
	const who =
		directors && actors
			? "actors and directors"
			: directors
				? "directors"
				: "actors"
	const did =
		directors && actors
			? "starred in or directed"
			: directors
				? "directed"
				: "starred in"
	const Who = who.charAt(0).toUpperCase() + who.slice(1)
	return {
		title: `Popular ${Who}: Their Best Movies and TV Shows | GoodWatch`,
		heading: `Popular ${who}`,
		intro: `${people.length} ${who} from the best-known movies and TV shows on GoodWatch. Each one ${did} at least three of them. Open a person to see every title they made, scored.`,
	}
}

function Head({
	crumbs,
	heading,
	intro,
	children,
}: {
	crumbs: { label: string; path: string }[]
	heading: string
	intro: string
	children?: React.ReactNode
}) {
	return (
		<>
			<Breadcrumbs items={crumbs} />
			<div className="max-w-7xl mx-auto px-4 pt-4 flex flex-col gap-2">
				<h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-medium text-gray-100">
					{heading}
				</h1>
				<p className="text-lg text-gray-400 max-w-4xl">{intro}</p>
				{children}
			</div>
		</>
	)
}

const crumbsOf = (kind: Kind) => [
	{ label: kind === "movies" ? "Movies" : "Shows", path: `/${kind}` },
	{
		label: kind === "movies" ? "Best movies" : "Best TV shows",
		path: `/${kind}/best`,
	},
]

const yearGenres = (t: CohortTitle) =>
	[t.release_year, t.genres.slice(0, 2).join(", ")].filter(Boolean).join(" · ")

// --- A: ranked rows, 250 a page --------------------------------------------------

function Pages({
	kind,
	page,
	pages,
	base,
	total,
}: { kind: Kind; page: number; pages: number; base: string; total: number }) {
	return (
		<nav
			aria-label={`Pages of the best ${noun(kind)}`}
			className="flex flex-wrap items-center gap-2 text-sm"
		>
			{Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
				<Link
					key={n}
					to={n === 1 ? base : `${base}&page=${n}`}
					aria-current={n === page ? "page" : undefined}
					className={`rounded-md px-3 py-1.5 tabular-nums ${n === page ? "bg-amber-400 font-bold text-black" : "bg-white/[0.06] text-gray-300 ring-1 ring-white/10 hover:bg-white/10"}`}
				>
					{`${(n - 1) * 250 + 1}–${Math.min(n * 250, total)}`}
				</Link>
			))}
		</nav>
	)
}

export function RankedRows({
	kind,
	titles,
	offset,
	page,
	pages,
	base,
	total,
	popular,
}: {
	kind: Kind
	titles: CohortTitle[]
	offset: number
	page: number
	pages: number
	base: string
	total: number
	popular: number
}) {
	const copy = listCopy(kind, total, popular)
	return (
		<>
			<Head crumbs={crumbsOf(kind)} heading={copy.heading} intro={copy.intro}>
				<div className="mt-3">
					<Pages
						kind={kind}
						page={page}
						pages={pages}
						base={base}
						total={total}
					/>
				</div>
			</Head>
			<ol className="max-w-7xl mx-auto mt-6 grid grid-cols-[minmax(0,1fr)] gap-x-8 px-4 lg:grid-cols-2">
				{titles.map((t, i) => (
					<li
						key={t.id}
						className="border-b border-white/5 hover:bg-white/[0.02]"
					>
						<Link
							to={t.href}
							prefetch="intent"
							className="group flex items-center gap-3 py-1.5 pl-1"
						>
							<span className="w-9 shrink-0 text-right text-sm font-bold tabular-nums text-gray-500 group-hover:text-amber-300">
								{offset + i + 1}
							</span>
							<Poster
								path={t.poster_path}
								className="h-12 w-8 shrink-0 rounded-sm sm:h-15 sm:w-10"
							/>
							<span className="min-w-0 flex-1">
								<span className="block truncate text-sm font-semibold text-white sm:text-base">
									{t.title}
								</span>
								<span className="block truncate text-xs text-gray-500">
									{yearGenres(t)}
								</span>
							</span>
							<ScoreRing media={{ details: t }} size={36} label={false} />
						</Link>
					</li>
				))}
			</ol>
			<div className="max-w-7xl mx-auto mt-6 px-4">
				<Pages
					kind={kind}
					page={page}
					pages={pages}
					base={base}
					total={total}
				/>
			</div>
		</>
	)
}

// --- B: poster grid by decade, one page -------------------------------------------

const decadeOf = (t: CohortTitle) =>
	t.release_year == null
		? "Unknown"
		: t.release_year < 1970
			? "Before 1970"
			: `${Math.floor(t.release_year / 10) * 10}s`

export function DecadeGrid({
	kind,
	titles,
	total,
	popular,
}: { kind: Kind; titles: CohortTitle[]; total: number; popular: number }) {
	const copy = listCopy(kind, total, popular)
	const groups = new Map<string, CohortTitle[]>()
	for (const t of titles) {
		const d = decadeOf(t)
		if (!groups.has(d)) groups.set(d, [])
		groups.get(d)?.push(t)
	}
	const decades = [...groups.keys()].sort((a, b) =>
		a === "Before 1970" ? 1 : b === "Before 1970" ? -1 : b.localeCompare(a),
	)
	let shown = 0
	return (
		<>
			<Head crumbs={crumbsOf(kind)} heading={copy.heading} intro={copy.intro}>
				<nav aria-label="Decades" className="mt-3 flex flex-wrap gap-2">
					{decades.map((d) => (
						<a
							key={d}
							href={`#${d}`}
							className="rounded-full bg-white/[0.06] px-3 py-1 text-sm text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
						>
							{d} <span className="text-gray-500">{groups.get(d)?.length}</span>
						</a>
					))}
				</nav>
			</Head>
			<div className="max-w-7xl mx-auto px-4 flex flex-col gap-10 mt-8">
				{decades.map((d) => (
					<section key={d} id={d} className="scroll-mt-20">
						<h2 className="text-2xl md:text-3xl font-extrabold text-gray-400">
							{d}{" "}
							<span className="text-base font-medium text-gray-500">
								{groups.get(d)?.length} {noun(kind)}
							</span>
						</h2>
						<div className="relative mt-4 grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
							{(groups.get(d) ?? []).map((t) => {
								shown++
								return (
									<MovieTvCard
										key={t.id}
										details={t as never}
										mediaType={t.type}
										skipOffscreen={shown > 12}
										posterPriority={shown <= 2 ? "high" : "lazy"}
									/>
								)
							})}
						</div>
					</section>
				))}
			</div>
		</>
	)
}

// --- C: top posters, then a text index by genre, one page --------------------------

const genrePath = (kind: Kind, genre: string) => {
	const entry = Object.entries(genrePages).find(
		([, page]) => page.label === genre && ["all", kind].includes(page.type),
	)
	return entry ? `/${kind}/genres/${entry[0]}` : null
}

export function TopAndIndex({
	kind,
	titles,
	total,
	popular,
	top = 12,
}: {
	kind: Kind
	titles: CohortTitle[]
	total: number
	popular: number
	top?: number
}) {
	const copy = listCopy(kind, total, popular)
	const head = titles.slice(0, top)
	const rest = titles.slice(top)
	const groups = new Map<string, CohortTitle[]>()
	for (const t of rest) {
		const g = t.genres[0] ?? "Other"
		if (!groups.has(g)) groups.set(g, [])
		groups.get(g)?.push(t)
	}
	const order = [...groups.keys()].sort(
		(a, b) => (groups.get(b)?.length ?? 0) - (groups.get(a)?.length ?? 0),
	)
	return (
		<>
			<Head crumbs={crumbsOf(kind)} heading={copy.heading} intro={copy.intro} />
			<div className="max-w-7xl mx-auto px-4 mt-6">
				<h2 className="text-xl font-bold text-gray-100">The top {top}</h2>
				<div className="relative mt-3 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
					{head.map((t, i) => (
						<MovieTvCard
							key={t.id}
							details={t as never}
							mediaType={t.type}
							posterPriority={i < 3 ? "high" : "lazy"}
						/>
					))}
				</div>
				<nav aria-label="Genres" className="mt-10 flex flex-wrap gap-2">
					{order.map((g) => (
						<a
							key={g}
							href={`#${g}`}
							className="rounded-full bg-white/[0.06] px-3 py-1 text-sm text-gray-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
						>
							{g} <span className="text-gray-500">{groups.get(g)?.length}</span>
						</a>
					))}
				</nav>
				<div className="mt-8 flex flex-col gap-10">
					{order.map((g) => {
						const more = genrePath(kind, g)
						return (
							<section key={g} id={g} className="scroll-mt-20">
								<div className="flex items-baseline justify-between gap-4 border-b border-white/10 pb-2">
									<h2 className="text-2xl md:text-3xl font-extrabold text-gray-400">
										{g}
									</h2>
									{more && (
										<Link
											to={more}
											prefetch="intent"
											className="text-sm font-semibold text-indigo-500 hover:text-indigo-400 whitespace-nowrap"
										>
											{`All ${g.toLowerCase()} ${noun(kind)} →`}
										</Link>
									)}
								</div>
								<ol className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
									{(groups.get(g) ?? []).map((t) => (
										<li key={t.id}>
											<Link
												to={t.href}
												prefetch="intent"
												className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-white/[0.04]"
											>
												<ScoreRing
													media={{ details: t }}
													size={26}
													label={false}
												/>
												<span className="min-w-0 truncate text-sm text-gray-200 group-hover:text-white">
													{t.title}
													<span className="text-gray-500">
														{" "}
														({t.release_year})
													</span>
												</span>
											</Link>
										</li>
									))}
								</ol>
							</section>
						)
					})}
				</div>
			</div>
		</>
	)
}

// --- People ------------------------------------------------------------------------

const PEOPLE_CRUMBS = [{ label: "People", path: "/people" }]
const role = (p: CohortPerson) =>
	p.department === "Directing"
		? "Director"
		: p.department === "Acting"
			? "Actor"
			: (p.department ?? "")

/** A: the person page's collaborator cards, with the known-for titles as links. */
export function PeopleCards({ people }: { people: CohortPerson[] }) {
	const copy = peopleCopy(people)
	return (
		<>
			<Head crumbs={PEOPLE_CRUMBS} heading={copy.heading} intro={copy.intro} />
			<ul className="max-w-7xl mx-auto mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3">
				{people.map((p, i) => (
					<li
						key={p.id}
						className="flex h-full gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 hover:border-amber-400/60"
					>
						<Link
							to={p.href}
							prefetch="intent"
							tabIndex={-1}
							aria-hidden
							className="shrink-0"
						>
							<Portrait
								path={p.profile_path}
								name={p.name}
								width={48}
								priority={i < 6 ? "eager" : "lazy"}
								className="h-16 w-12 rounded-md"
							/>
						</Link>
						<div className="min-w-0">
							<Link
								to={p.href}
								prefetch="intent"
								className="block truncate font-semibold hover:text-amber-300"
							>
								{p.name}
							</Link>
							<div className="text-xs text-amber-400">{role(p)}</div>
							<div className="mt-1 text-xs text-gray-400">
								{p.knownFor.slice(0, 4).map((t, j) => (
									<span key={t.id}>
										{j > 0 && ", "}
										<Link
											to={t.href}
											prefetch="intent"
											className="hover:text-white hover:underline"
										>
											{t.title}
										</Link>
									</span>
								))}
								{(p.knownForCount ?? 0) > 4 && (
									<span className="whitespace-nowrap text-gray-300">
										, +{(p.knownForCount ?? 0) - 4} more
									</span>
								)}
							</div>
						</div>
					</li>
				))}
			</ul>
		</>
	)
}

/** B: a portrait wall, the person page's header portrait at grid size. */
export function PeopleWall({ people }: { people: CohortPerson[] }) {
	const copy = peopleCopy(people)
	return (
		<>
			<Head crumbs={PEOPLE_CRUMBS} heading={copy.heading} intro={copy.intro} />
			<ul className="max-w-7xl mx-auto mt-6 grid grid-cols-3 gap-3 px-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-4">
				{people.map((p, i) => (
					<li key={p.id}>
						<Link
							to={p.href}
							prefetch="intent"
							className="group block rounded-lg border-4 border-gray-800 bg-gray-900 hover:border-amber-700/50 transition-transform duration-100 scale-95 hover:scale-100"
						>
							<Portrait
								path={p.profile_path}
								name={p.name}
								width={180}
								priority={i < 6 ? "eager" : "lazy"}
								className="aspect-[2/3] w-full rounded-md"
							/>
							<span className="block px-2 pt-1.5 text-sm font-bold text-white truncate">
								{p.name}
							</span>
							<span className="block px-2 pb-1.5 text-xs text-amber-400">
								{role(p)}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</>
	)
}

/** C: rows like people search's banner: portrait, name block, and three known-for posters. */
export function PeopleRows({ people }: { people: CohortPerson[] }) {
	const copy = peopleCopy(people)
	return (
		<>
			<Head crumbs={PEOPLE_CRUMBS} heading={copy.heading} intro={copy.intro} />
			<ul className="max-w-7xl mx-auto mt-6 grid grid-cols-[minmax(0,1fr)] gap-3 px-4 lg:grid-cols-2">
				{people.map((p, i) => (
					<li
						key={p.id}
						className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900 p-3 sm:items-end"
					>
						<Link
							to={p.href}
							prefetch="intent"
							tabIndex={-1}
							aria-hidden
							className="shrink-0"
						>
							<Portrait
								path={p.profile_path}
								name={p.name}
								width={80}
								priority={i < 4 ? "eager" : "lazy"}
								className="h-30 w-20 rounded-lg shadow-2xl"
							/>
						</Link>
						<div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
							<Link
								to={p.href}
								prefetch="intent"
								className="group/name block min-w-0 flex-1"
							>
								<span className="block text-xs uppercase tracking-[0.2em] text-amber-400">
									{p.department}
								</span>
								<span className="line-clamp-2 block text-xl font-black text-gray-100 group-hover/name:text-white sm:text-2xl">
									{p.name}
								</span>
								<span className="mt-1 inline-flex items-center gap-1 text-sm text-cyan-300 group-hover/name:text-cyan-200">
									See all titles <span aria-hidden="true">→</span>
								</span>
							</Link>
							<ul className="flex shrink-0 gap-2">
								{p.knownFor.slice(0, 3).map((t) => (
									<li key={t.id} className="w-14 sm:w-16">
										<Link
											to={t.href}
											prefetch="intent"
											title={t.title}
											className="block rounded-md transition duration-200 ease-out hover:-translate-y-1"
										>
											<Poster
												path={t.poster_path}
												size="w154"
												className="aspect-[2/3] w-full rounded-md border-2 border-gray-800 shadow-lg hover:border-gray-500"
											/>
											<span className="sr-only">{t.title}</span>
										</Link>
									</li>
								))}
							</ul>
						</div>
					</li>
				))}
			</ul>
		</>
	)
}
