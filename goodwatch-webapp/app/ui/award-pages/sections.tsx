// The sections of the /awards hub and of a body's page (/awards/<body>).
import { ArrowRightCircleIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import type {
	AwardBody,
	CategoryLink,
	CeremonySummary,
} from "~/domain/award-pages"
import type { AwardTitle } from "~/server/award-pages.server"
import { AwardCard, SmallPoster } from "~/ui/award-pages/parts"

const MORE_LINK =
	"flex shrink-0 items-center gap-1.5 text-sm font-semibold text-indigo-500 hover:text-indigo-400"

export function RecentCeremonies({
	recent,
}: { recent: CeremonySummary<AwardTitle>[] }) {
	if (!recent.length) return null
	return (
		<section className="mx-auto mt-8 max-w-7xl px-4">
			<h2 className="text-2xl font-bold">Latest ceremonies</h2>
			<div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
				{recent.map((c, i) => {
					const href = `/awards/${c.body.slug}/${c.year}`
					return (
						<section key={c.body.slug} className="flex flex-col gap-3">
							<div className="flex items-baseline justify-between gap-3">
								<Link
									to={href}
									prefetch="intent"
									className="text-lg font-semibold text-gray-100 hover:text-amber-400"
								>
									{c.body.name} {c.year}
								</Link>
								<Link to={href} prefetch="intent" className={MORE_LINK}>
									Winners
									<ArrowRightCircleIcon className="w-5" aria-hidden="true" />
								</Link>
							</div>
							<div className="grid grid-cols-4 gap-2">
								{c.winners.map((t) => (
									<AwardCard
										key={`${t.media_type}${t.tmdb_id}`}
										title={t}
										size="small"
										priority={i < 3}
									/>
								))}
							</div>
						</section>
					)
				})}
			</div>
		</section>
	)
}

export function BodyList({
	bodies,
}: { bodies: { body: AwardBody; years: number[] }[] }) {
	return (
		<section className="mx-auto mt-12 max-w-7xl px-4">
			<h2 className="text-2xl font-bold">Awards</h2>
			<ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
				{bodies.map(({ body, years }) => (
					<li key={body.slug} className="border-b border-white/5">
						<Link
							to={`/awards/${body.slug}`}
							prefetch="intent"
							className="group flex items-center justify-between gap-3 py-3"
						>
							<span className="min-w-0">
								<span className="block font-semibold text-white group-hover:text-amber-300">
									{body.name}
								</span>
								<span className="block truncate text-sm text-gray-500">
									{body.official !== body.name ? `${body.official} · ` : ""}
									{body.kind}
								</span>
							</span>
							<span className="shrink-0 text-sm tabular-nums text-gray-400">
								{years.slice(0, 3).join(", ")}
								{years.length > 3 ? ", …" : ""}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

/** The body's published years by decade. */
export function YearsByDecade({
	slug,
	years,
}: { slug: string; years: number[] }) {
	const decades = new Map<number, number[]>()
	for (const year of years) {
		const decade = Math.floor(year / 10) * 10
		decades.set(decade, [...(decades.get(decade) ?? []), year])
	}
	return (
		<section className="mx-auto mt-10 max-w-7xl px-4">
			<h2 className="text-2xl font-bold">Ceremonies by year</h2>
			<div className="mt-4 flex flex-col gap-3">
				{[...decades.entries()].map(([decade, list]) => (
					<div
						key={decade}
						className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4"
					>
						<span className="w-16 shrink-0 text-sm font-bold text-gray-500">
							{decade}s
						</span>
						<div className="flex flex-wrap gap-2">
							{list.map((year) => (
								<Link
									key={year}
									to={`/awards/${slug}/${year}`}
									prefetch="intent"
									className="rounded-md bg-white/[0.06] px-3 py-1.5 text-sm tabular-nums text-gray-300 ring-1 ring-white/10 hover:bg-white/10"
								>
									{year}
								</Link>
							))}
						</div>
					</div>
				))}
			</div>
		</section>
	)
}

export function LatestResults({
	slug,
	name,
	latest,
}: {
	slug: string
	name: string
	latest: {
		year: number
		results: { category: string; slug: string; winner: AwardTitle }[]
	}
}) {
	if (!latest.results.length) return null
	return (
		<section className="mx-auto mt-8 max-w-7xl px-4">
			<div className="flex items-baseline justify-between gap-4">
				<h2 className="text-2xl font-bold">
					{name} {latest.year} winners
				</h2>
				<Link
					to={`/awards/${slug}/${latest.year}`}
					prefetch="intent"
					className={MORE_LINK}
				>
					All categories
					<ArrowRightCircleIcon className="w-5" aria-hidden="true" />
				</Link>
			</div>
			<div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-8">
				{latest.results.map((r, i) => (
					<div key={r.slug} className="flex min-w-0 flex-col gap-1.5">
						<Link
							to={`/awards/${slug}/category/${r.slug}`}
							prefetch="intent"
							className="line-clamp-2 min-h-[2.5rem] text-xs font-semibold leading-5 text-amber-400 hover:text-amber-300"
						>
							{r.category}
						</Link>
						<AwardCard title={r.winner} size="small" priority={i < 4} />
					</div>
				))}
			</div>
		</section>
	)
}

export function CategoryList({
	slug,
	categories,
}: { slug: string; categories: CategoryLink<AwardTitle>[] }) {
	if (!categories.length) return null
	return (
		<section className="mx-auto mt-12 max-w-7xl px-4">
			<h2 className="text-2xl font-bold">Winners by category</h2>
			<ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
				{categories.map((c) => (
					<li key={c.slug} className="border-b border-white/5">
						<Link
							to={`/awards/${slug}/category/${c.slug}`}
							prefetch="intent"
							className="group flex items-center gap-3 py-2"
						>
							{c.latest ? (
								<SmallPoster title={c.latest.title} className="h-12 w-8" />
							) : (
								<span className="h-12 w-8 shrink-0" />
							)}
							<span className="min-w-0">
								<span className="block truncate font-semibold text-white group-hover:text-amber-300">
									{c.name}
								</span>
								{c.latest && (
									<span className="block truncate text-xs text-gray-500">
										{c.latest.year}: {c.latest.title.title}
									</span>
								)}
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}
