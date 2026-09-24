import {
	ArrowDownIcon,
	ArrowUpIcon,
	ChevronDownIcon,
} from "@heroicons/react/20/solid"
// Cast and crew page: who the person is, what their work feels like compared with the
// catalog, who they work with, and all their titles, filtered and grouped on the server.
// Every link is a server-rendered <a href>, so search engines can follow them.
import {
	FilmIcon,
	StarIcon,
	TvIcon,
	VideoCameraIcon,
} from "@heroicons/react/24/solid"
import {
	type LoaderFunctionArgs,
	type MetaFunction,
	json,
	redirect,
} from "@remix-run/node"
import { Link, useLoaderData, useSearchParams } from "@remix-run/react"
import type React from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import type { DiscoverResult } from "~/server/discover.server"
import {
	type GridFilters,
	type PersonCredit,
	applyGridFilters,
	getPersonProfile,
	groupTitles,
	parseGridFilters,
} from "~/server/person.server"
import { MovieTvCard } from "~/ui/MovieTvCard"
import { FINGERPRINT_META } from "~/ui/fingerprint/fingerprintMeta"
import { personPath, pluralize, titleToDashed } from "~/utils/helpers"
import { buildMeta } from "~/utils/meta"
import { goodwatchScoreDisplay, goodwatchVibeIndex } from "~/utils/ratings"

export { pageHeaders as headers } from "~/utils/headers"
export { retryNetworkLoader as clientLoader } from "~/utils/retry-network-loader"

const PER_GROUP = 12

export async function loader({ params, request }: LoaderFunctionArgs) {
	const id = Number((params.personKey ?? "").split("-")[0])
	if (!Number.isSafeInteger(id) || id <= 0)
		throw new Response("Not found", { status: 404 })
	const profile = await getPersonProfile(id)
	if (!profile) throw new Response("Not found", { status: 404 })

	// One URL per person: /person/287 and misspelled slugs redirect to the canonical path.
	const url = new URL(request.url)
	const canonical = personPath(profile.tmdb_id, profile.name)
	if (url.pathname !== canonical) return redirect(canonical + url.search, 301)

	const filters = parseGridFilters(url.searchParams)
	const { items, facets } = applyGridFilters(profile.credits, filters)
	const slim = ({ fingerprint, essence_tags, genres, ...c }: PersonCredit) => c
	const groups = groupTitles(items, filters, PER_GROUP).map((g) => ({
		...g,
		items: g.items.map(slim),
	}))
	const knownFor = applyGridFilters(profile.credits, {
		...filters,
		type: "all",
		role: "",
		genre: "",
		decade: "",
		trait: "",
		minScore: 0,
	})
		.items.filter((c) => c.weight >= 0.6 && c.poster_path)
		.slice(0, 4)
	const { credits, ...rest } = profile
	return json({
		profile: rest,
		filters,
		facets,
		total: items.length,
		groups,
		knownFor: knownFor.map(slim),
	})
}

type Data = ReturnType<typeof useLoaderData<typeof loader>>
type Credit = Data["knownFor"][number]
type Stats = Data["profile"]["stats"]

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	if (!data) return [{ title: "Person not found | GoodWatch" }]
	const p = data.profile
	const top = data.knownFor
		.slice(0, 3)
		.map((c) => c.title)
		.join(", ")
	const role =
		p.known_for_department === "Acting"
			? "movies and TV shows"
			: `${p.known_for_department.toLowerCase()} credits`
	const url = `https://goodwatch.app${personPath(p.tmdb_id, p.name)}` // filtered views share the unfiltered canonical
	const image = p.profile_path
		? `https://image.tmdb.org/t/p/h632${p.profile_path}`
		: ""
	const counts = titleCounts(p.stats.movies, p.stats.shows)
	const tags = buildMeta({
		pageMeta: {
			title: `${p.name}: ${p.known_for_department === "Acting" ? "Movies and TV Shows" : "Filmography"} | GoodWatch`,
			description: `${p.name}'s ${role}${counts ? `: ${counts}` : ""}${top ? `, including ${top}` : ""}. See what their work feels like, who they work with, and their best-rated titles.`,
			url,
			image,
			alt: `Portrait of ${p.name}`,
		},
	}).filter((tag) => !("script:ld+json" in tag))
	return [
		...tags,
		{
			"script:ld+json": {
				"@context": "https://schema.org",
				"@type": "Person",
				name: p.name,
				url,
				image: image || undefined,
				jobTitle: p.known_for_department,
			},
		},
	]
}

export default function PersonPage() {
	const data = useLoaderData<typeof loader>()
	return (
		<main className="min-h-screen pb-24">
			<Hero data={data}>
				<Facts data={data} />
			</Hero>
			<div className="mx-auto max-w-7xl space-y-12 px-4 pt-4">
				{/* Fewer than three rated titles give no signature, so there is nothing to compare. */}
				{data.profile.signature.pillars.length > 0 && (
					<Section
						title="What stands out"
						note={`Compared with the average well-known movie, over ${data.profile.signature.basedOn} of their titles. Select a trait to filter titles.`}
					>
						<div className="grid items-start gap-8 lg:grid-cols-[320px_1fr]">
							<Radar data={data} />
							<TraitCards data={data} />
						</div>
					</Section>
				)}
				<GenresAndTags data={data} />
				<Section
					title="Works often with"
					note="People in at least two of their main titles."
				>
					<CollaboratorCards data={data} />
				</Section>
				<Titles data={data} />
			</div>
		</main>
	)
}

// --- Shared helpers ---

const traitLabel = (key: string) =>
	FINGERPRINT_META[key]?.label ?? key.replace(/_/g, " ")
const traitEmoji = (key: string) => FINGERPRINT_META[key]?.emoji ?? ""
const titleHref = (c: { media_type: string; tmdb_id: number; title: string }) =>
	`/${c.media_type}/${c.tmdb_id}-${titleToDashed(c.title)}`
const img = (path: string | null, size = "w300_and_h450_bestv2") =>
	path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined
const AMBER = "#fbbf24" // more than the catalog average
const SKY = "#38bdf8" // less than the catalog average
const MUTED = "#6b7280"

/** Movie and TV show counts in words, leaving out a zero part: "18 movies", "4 movies and 1 TV show". */
const titleCounts = (movies: number, shows: number) =>
	[
		movies > 0 && pluralize(movies, "movie"),
		shows > 0 && pluralize(shows, "TV show"),
	]
		.filter(Boolean)
		.join(" and ")

/** Builds a link to this page with some filters changed; `null` removes a filter. */
function useFilterHref() {
	const [params] = useSearchParams()
	return (
		patch: Partial<Record<keyof GridFilters, string | null>>,
		hash = "",
	) => {
		const next = new URLSearchParams(params)
		if (!("expand" in patch)) next.delete("expand")
		for (const [k, v] of Object.entries(patch)) {
			if (v == null || v === "") next.delete(k)
			else next.set(k, v)
		}
		const s = next.toString()
		return `${s ? `?${s}` : "?"}${hash}`
	}
}

function subtitle(c: Credit) {
	if (c.characters.length && c.roles.includes("Acting"))
		return `as ${c.characters.slice(0, 2).join(" / ")}`
	if (c.jobs.length) return c.jobs.slice(0, 2).join(", ")
	return c.characters[0] ?? ""
}

/** The shared poster card from discover and explore, plus the person's role in the title. */
function TitleCard({ c }: { c: Credit }) {
	// MovieTvCard reads the GoodWatch score from the discover field name. Scores from a
	// handful of votes are hidden, as everywhere else on this page.
	const details = {
		...c,
		goodwatch_overall_score_normalized_percent: c.votes >= 200 ? c.score : null,
	} as unknown as DiscoverResult
	const role = subtitle(c)
	return (
		<div>
			<MovieTvCard details={details} mediaType={c.media_type} />
			{(role || c.media_type === "show") && (
				<p className="truncate px-2 text-xs text-gray-400" title={role}>
					{c.media_type === "show" && "TV show"}
					{c.media_type === "show" && role && " · "}
					{role}
				</p>
			)}
		</div>
	)
}

function Portrait({
	path,
	name,
	className,
}: { path: string | null; name: string; className: string }) {
	return path ? (
		<img
			src={img(path)}
			alt={`Portrait of ${name}`}
			className={`object-cover ${className}`}
		/>
	) : (
		<div
			className={`flex items-center justify-center bg-gray-800 text-2xl font-bold text-gray-500 ${className}`}
		>
			{name.slice(0, 1)}
		</div>
	)
}

function Section({
	title,
	note,
	children,
	className = "",
}: {
	title: string
	note?: string
	children: React.ReactNode
	className?: string
}) {
	return (
		<section className={className}>
			<h2 className="text-xl font-bold">{title}</h2>
			{note && <p className="mt-0.5 text-sm text-gray-400">{note}</p>}
			<div className="mt-4">{children}</div>
		</section>
	)
}

function Hero({ data, children }: { data: Data; children?: React.ReactNode }) {
	const p = data.profile
	const hero = data.knownFor.find((c) => c.backdrop_path)
	return (
		<header className="relative isolate overflow-hidden">
			{hero && (
				<img
					src={img(hero.backdrop_path, "w1280")}
					alt=""
					className="absolute inset-0 -z-10 h-full w-full object-cover opacity-30"
				/>
			)}
			<div className="absolute inset-0 -z-10 bg-linear-to-t from-gray-950 via-gray-950/70 to-transparent" />
			<div className="mx-auto max-w-7xl px-4 pt-20 pb-8">
				<div className="flex items-end gap-6">
					<Portrait
						path={p.profile_path}
						name={p.name}
						className="h-36 w-24 shrink-0 rounded-lg shadow-2xl sm:h-44 sm:w-30"
					/>
					<div className="min-w-0">
						<p className="text-sm uppercase tracking-[0.2em] text-amber-400">
							{p.known_for_department}
						</p>
						<h1 className="text-4xl font-black sm:text-6xl">{p.name}</h1>
					</div>
				</div>
				{children}
			</div>
		</header>
	)
}

// --- Header facts: each fact gets a presentation that fits it ---

/** The GoodWatch score treatment from RatingBadges: logo on a vibe-colored disc, vibe-colored number. */
function GoodWatchScore({
	score,
	size = "md",
}: { score: number; size?: "sm" | "md" }) {
	const v = goodwatchVibeIndex(score)
	return (
		<span className="inline-flex items-center gap-2">
			<img
				className={`block rounded-full p-1.5 shadow-xl bg-vibe-${v} ${size === "sm" ? "h-7" : "h-9"}`}
				src={gwLogo}
				alt="GoodWatch score"
			/>
			<span>
				<span
					className={`font-semibold text-vibe-${v} ${size === "sm" ? "text-lg" : "text-2xl"}`}
				>
					{goodwatchScoreDisplay(score)}
				</span>
				<span className="text-sm text-gray-300">/100</span>
			</span>
		</span>
	)
}

/**
 * The career chart in one sentence, for readers and search engines that skip the chart:
 * "Active from 1950 to 2019, busiest in 1972 with 5 main titles."
 */
function careerSummary(stats: Stats): string | null {
	const { firstYear: first, lastYear: last, perYear } = stats
	if (!first || !last || !perYear.length) return null
	const titles = (n: number) => pluralize(n, "main title")
	if (first === last)
		return `Active in ${first} with ${titles(perYear[0].count)}.`

	const max = Math.max(...perYear.map((p) => p.count))
	const peaks = perYear.filter((p) => p.count === max).map((p) => p.year)
	const busiest =
		peaks.length === 1
			? `busiest in ${peaks[0]} with ${titles(max)}`
			: peaks.length === 2
				? `busiest in ${peaks[0]} and ${peaks[1]} with ${titles(max)} each`
				: `with up to ${titles(max)} a year`

	// The longest stretch without titles, when it lasts at least ten years.
	let gap: [number, number] | null = null
	for (let i = 1; i < perYear.length; i++) {
		const from = perYear[i - 1].year + 1
		const to = perYear[i].year - 1
		if (to - from + 1 >= 10 && (!gap || to - from > gap[1] - gap[0]))
			gap = [from, to]
	}
	const pause = gap ? `, with a break from ${gap[0]} to ${gap[1]}` : ""
	return `Active from ${first} to ${last}${pause}, ${busiest}.`
}

/**
 * Titles per year across the career, as a small column chart. It is decoration next to
 * careerSummary, so it is hidden from assistive tech and carries no text of its own.
 */
function CareerSparkline({ stats }: { stats: Stats }) {
	const first = stats.firstYear
	if (!first || !stats.lastYear) return null
	const counts = new Map(stats.perYear.map((p) => [p.year, p.count]))
	const years = Array.from(
		{ length: stats.lastYear - first + 1 },
		(_, i) => first + i,
	)
	const max = Math.max(...stats.perYear.map((p) => p.count))
	const w = 4
	const gap = 1
	const h = 28
	return (
		<svg
			viewBox={`0 0 ${years.length * (w + gap)} ${h}`}
			className="h-7 w-full max-w-48"
			preserveAspectRatio="none"
			aria-hidden="true"
			focusable="false"
		>
			{years.map((y, i) => {
				const n = counts.get(y) ?? 0
				const bh = n ? Math.max(3, (n / max) * h) : 1
				return (
					<rect
						key={y}
						x={i * (w + gap)}
						y={h - bh}
						width={w}
						height={bh}
						rx={1}
						fill={n ? AMBER : "#374151"}
					/>
				)
			})}
		</svg>
	)
}

function Fact({
	label,
	children,
	href,
}: { label: string; children: React.ReactNode; href?: string }) {
	const body = (
		<>
			<dt className="text-xs uppercase tracking-wide text-gray-400">{label}</dt>
			<dd className="mt-1.5">{children}</dd>
		</>
	)
	return href ? (
		<Link
			to={href}
			prefetch="intent"
			className="block rounded-lg px-4 py-3 hover:bg-white/5"
		>
			<dl>{body}</dl>
		</Link>
	) : (
		<dl className="px-4 py-3">{body}</dl>
	)
}

function Facts({ data }: { data: Data }) {
	const s = data.profile.stats
	const href = useFilterHref()
	const director = s.directed > s.leading
	// A zero count is left out, unless there are no titles at all.
	const kinds = [
		{ n: s.movies, one: "movie", many: "movies", Icon: FilmIcon },
		{ n: s.shows, one: "TV show", many: "TV shows", Icon: TvIcon },
	].filter((k, i) => k.n > 0 || (i === 0 && !s.shows))
	const career = careerSummary(s)
	return (
		<div className="mt-6 grid grid-cols-2 divide-white/10 rounded-xl border border-white/10 bg-gray-900/70 backdrop-blur sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
			<Fact label="Titles" href={href({ type: null }, "#titles")}>
				<div className="flex items-center gap-4 text-lg font-semibold">
					{kinds.map(({ n, one, many, Icon }) => (
						<span key={one} className="flex items-center gap-1.5">
							<Icon className="h-5 w-5 text-gray-400" aria-hidden />
							{n}
							<span className="sr-only">{n === 1 ? one : many}</span>
						</span>
					))}
				</div>
				<div className="text-xs text-gray-400" aria-hidden>
					{kinds
						.map(({ n, one, many }) => (n === 1 ? one : many))
						.join(" and ")}
				</div>
			</Fact>
			<Fact label="Career">
				<CareerSparkline stats={s} />
				<div
					className="mt-1 flex justify-between text-xs tabular-nums text-gray-400 max-w-48"
					aria-hidden="true"
				>
					<span>{s.firstYear}</span>
					<span>{s.lastYear}</span>
				</div>
				{career && (
					<p className="mt-1 max-w-48 text-xs text-gray-300">{career}</p>
				)}
			</Fact>
			<Fact
				label={director ? "Directed" : "Leading roles"}
				href={director ? href({ role: "Directing" }, "#titles") : undefined}
			>
				<div className="flex items-center gap-2">
					{director ? (
						<VideoCameraIcon className="h-6 w-6 text-amber-400" aria-hidden />
					) : (
						<StarIcon className="h-6 w-6 text-amber-400" aria-hidden />
					)}
					<span className="text-2xl font-black tabular-nums">
						{director ? s.directed : s.leading}
					</span>
				</div>
				<div className="text-xs text-gray-400">
					{director
						? `${s.directed === 1 ? "title" : "titles"} as director`
						: "top three billing"}
				</div>
			</Fact>
			<Fact label="Average score">
				{s.avgScore ? (
					<GoodWatchScore score={s.avgScore} />
				) : (
					<span className="text-gray-400">Not enough ratings</span>
				)}
			</Fact>
			{s.best && (
				<Fact label="Highest rated" href={titleHref(s.best)}>
					<div className="flex items-center gap-3">
						{s.best.poster_path && (
							<img
								src={img(s.best.poster_path, "w92")}
								alt={`Poster for ${s.best.title}`}
								className="h-12 w-8 rounded object-cover"
							/>
						)}
						<div className="min-w-0">
							<div className="truncate text-sm font-semibold">
								{s.best.title}
							</div>
							<GoodWatchScore score={s.best.score} size="sm" />
						</div>
					</div>
				</Fact>
			)}
		</div>
	)
}

// --- What stands out ---

function useTraitHref() {
	const href = useFilterHref()
	const [params] = useSearchParams()
	return (key: string) =>
		href({ trait: params.get("trait") === key ? null : key }, "#titles")
}

/** The six fingerprint areas: this person in amber, the catalog average as a gray outline. */
function Radar({ data }: { data: Data }) {
	const pillars = data.profile.signature.pillars
	if (!pillars.length) return null
	const size = 300
	const c = size / 2
	const r = 105
	const point = (i: number, v: number) => {
		const a = (Math.PI * 2 * i) / pillars.length - Math.PI / 2
		return [
			c + Math.cos(a) * r * (v / 10),
			c + Math.sin(a) * r * (v / 10),
		] as const
	}
	const poly = (f: (p: (typeof pillars)[number]) => number) =>
		pillars.map((p, i) => point(i, f(p)).join(",")).join(" ")
	return (
		<figure>
			<svg
				viewBox={`0 0 ${size} ${size}`}
				className="mx-auto w-full max-w-xs"
				role="img"
				aria-label={`Fingerprint areas for ${data.profile.name} compared with the catalog average`}
			>
				{[2.5, 5, 7.5, 10].map((v) => (
					<polygon
						key={v}
						points={pillars.map((_, i) => point(i, v).join(",")).join(" ")}
						fill="none"
						stroke="#374151"
						strokeWidth={1}
					/>
				))}
				{pillars.map((_, i) => {
					const [x, y] = point(i, 10)
					return (
						<line
							key={pillars[i].name}
							x1={c}
							y1={c}
							x2={x}
							y2={y}
							stroke="#374151"
							strokeWidth={1}
						/>
					)
				})}
				<polygon
					points={poly((p) => p.baseline)}
					fill="none"
					stroke={MUTED}
					strokeWidth={2}
					strokeDasharray="4 3"
				/>
				<polygon
					points={poly((p) => p.value)}
					fill={AMBER}
					fillOpacity={0.25}
					stroke={AMBER}
					strokeWidth={2}
				/>
				{pillars.map((p, i) => {
					const [x, y] = point(i, p.value)
					const [lx, ly] = point(i, 12.2)
					return (
						<g key={p.name}>
							<circle
								cx={x}
								cy={y}
								r={4}
								fill={AMBER}
								stroke="#030712"
								strokeWidth={2}
							>
								<title>{`${p.name}: ${p.value.toFixed(1)} versus catalog average ${p.baseline.toFixed(1)}`}</title>
							</circle>
							<text
								x={lx}
								y={ly}
								textAnchor="middle"
								dominantBaseline="middle"
								className="fill-gray-300 text-[11px]"
							>
								{p.name}
							</text>
						</g>
					)
				})}
			</svg>
			<figcaption className="mt-2 flex justify-center gap-4 text-xs text-gray-400">
				<span className="flex items-center gap-1.5">
					<span className="h-0.5 w-4" style={{ background: AMBER }} />{" "}
					{data.profile.name}
				</span>
				<span className="flex items-center gap-1.5">
					<span
						className="h-0 w-4 border-t-2 border-dashed"
						style={{ borderColor: MUTED }}
					/>{" "}
					Catalog average
				</span>
			</figcaption>
		</figure>
	)
}

function TraitCards({ data }: { data: Data }) {
	const traitHref = useTraitHref()
	const { above, below } = data.profile.signature
	return (
		<div className="space-y-5">
			<ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				{above.map((t) => (
					<li key={t.key}>
						<Link
							rel="nofollow"
							to={traitHref(t.key)}
							className={`block h-full rounded-lg border p-3 hover:border-amber-400 ${data.filters.trait === t.key ? "border-amber-400 bg-amber-400/10" : "border-gray-700 bg-gray-900"}`}
						>
							<div className="flex items-center gap-2">
								<span className="text-xl" aria-hidden>
									{traitEmoji(t.key)}
								</span>
								<span className="text-sm font-semibold leading-tight">
									{traitLabel(t.key)}
								</span>
							</div>
							<div className="mt-2 flex items-baseline gap-1.5">
								<span className="text-xl font-black tabular-nums">
									{t.value.toFixed(1)}
								</span>
								<span className="text-xs text-gray-400">
									average {t.baseline.toFixed(1)}
								</span>
							</div>
							<div className="relative mt-1.5 h-1.5 rounded-full bg-gray-700">
								<div
									className="absolute h-full rounded-full"
									style={{ width: `${t.value * 10}%`, background: AMBER }}
								/>
								<div
									className="absolute -top-0.5 h-2.5 w-0.5 bg-gray-200"
									style={{ left: `${t.baseline * 10}%` }}
								/>
							</div>
						</Link>
					</li>
				))}
			</ul>
			{below.length > 0 && (
				<div>
					<h3 className="mb-2 text-xs uppercase tracking-wide text-gray-400">
						Rarely in their work
					</h3>
					<ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
						{below.map((t) => (
							<li
								key={t.key}
								className="flex items-center gap-3 rounded-lg border border-dashed border-gray-700 px-3 py-2"
							>
								<span className="text-xl opacity-60 grayscale" aria-hidden>
									{traitEmoji(t.key)}
								</span>
								<div className="min-w-0 flex-1">
									<div className="truncate text-sm text-gray-300">
										{traitLabel(t.key)}
									</div>
									<div className="relative mt-1 h-1 rounded-full bg-gray-700">
										<div
											className="absolute h-full rounded-full"
											style={{ width: `${t.value * 10}%`, background: SKY }}
										/>
										<div
											className="absolute -top-0.5 h-2 w-0.5 bg-gray-200"
											style={{ left: `${t.baseline * 10}%` }}
										/>
									</div>
									<div className="mt-0.5 text-[11px] tabular-nums text-gray-500">
										{t.value.toFixed(1)}, average {t.baseline.toFixed(1)}
									</div>
								</div>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	)
}

function GenresAndTags({ data }: { data: Data }) {
	const href = useFilterHref()
	const p = data.profile
	return (
		<div className="grid gap-8 md:grid-cols-2">
			<Section title="Main genres" note="Select a genre to see those titles.">
				<ul className="flex flex-wrap gap-1.5">
					{p.genres.map((g) => (
						<li key={g.name}>
							<Link
								rel="nofollow"
								to={href(
									{ genre: data.filters.genre === g.name ? null : g.name },
									"#titles",
								)}
								className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${data.filters.genre === g.name ? "bg-amber-500 text-black" : "bg-gray-700 hover:bg-gray-600"}`}
							>
								{g.name} <span className="opacity-60">{g.count}</span>
							</Link>
						</li>
					))}
				</ul>
			</Section>
			<Section title="Recurring tags">
				<ul className="flex flex-wrap gap-1.5">
					{p.tags.map((t) => (
						<li
							key={t.name}
							className="rounded-full border border-gray-600 px-2.5 py-0.5 text-sm text-gray-200"
						>
							{t.name} <span className="text-gray-500">{t.count}</span>
						</li>
					))}
				</ul>
			</Section>
		</div>
	)
}

function CollaboratorCards({ data }: { data: Data }) {
	return (
		<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{data.profile.collaborators.slice(0, 12).map((c) => (
				<li key={c.tmdb_id}>
					<Link
						to={personPath(c.tmdb_id, c.name)}
						prefetch="intent"
						className="flex h-full gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3 hover:border-amber-400/60"
					>
						<Portrait
							path={c.profile_path}
							name={c.name}
							className="h-16 w-12 shrink-0 rounded-md"
						/>
						<div className="min-w-0">
							<div className="truncate font-semibold">{c.name}</div>
							<div className="text-xs text-amber-400">{c.as}</div>
							<div className="mt-1 text-xs text-gray-400">
								{c.titles.slice(0, 5).join(", ")}
								{c.titles.length > 5 && (
									<span className="whitespace-nowrap text-gray-300">
										, +{c.titles.length - 5} more
									</span>
								)}
							</div>
						</div>
					</Link>
				</li>
			))}
		</ul>
	)
}

// --- Titles: filter box, then the arrangement control, then grouped titles ---

function FilterBox({ data }: { data: Data }) {
	const href = useFilterHref()
	const f = data.filters
	const groups: {
		key: keyof GridFilters
		label: string
		options: { value: string; label: string; count?: number }[]
	}[] = [
		{
			key: "type",
			label: "Type",
			options: [
				{ value: "all", label: "All" },
				...data.facets.type.map((t) => ({
					value: t.name,
					label: t.name === "movie" ? "Movies" : "TV shows",
					count: t.count,
				})),
			],
		},
		{
			key: "role",
			label: "Role",
			options: [
				{ value: "", label: "Any" },
				...data.facets.role.map((r) => ({
					value: r.name,
					label: r.name,
					count: r.count,
				})),
			],
		},
		{
			key: "minScore",
			label: "Score",
			options: [
				{ value: "", label: "Any" },
				{ value: "60", label: "60+" },
				{ value: "70", label: "70+" },
				{ value: "80", label: "80+" },
			],
		},
		{
			key: "decade",
			label: "Decade",
			options: [
				{ value: "", label: "Any" },
				...data.facets.decade.map((d) => ({
					value: d.name,
					label: d.name === "upcoming" ? "Upcoming" : `${d.name}s`,
					count: d.count,
				})),
			],
		},
		{
			key: "genre",
			label: "Genre",
			options: [
				{ value: "", label: "Any" },
				...data.facets.genre.map((g) => ({
					value: g.name,
					label: g.name,
					count: g.count,
				})),
			],
		},
	]
	const current = (k: keyof GridFilters) =>
		String(f[k] || (k === "type" ? "all" : ""))
	return (
		<div className="rounded-lg border border-gray-700 text-sm">
			<div className="space-y-2 p-3">
				{groups.map((g) => (
					<div
						key={g.key}
						className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
					>
						<span className="w-16 shrink-0 text-xs uppercase tracking-wide text-gray-500">
							{g.label}
						</span>
						{g.options.map((o) => (
							<Link
								rel="nofollow"
								key={o.value}
								to={href({ [g.key]: o.value })}
								preventScrollReset
								className={
									current(g.key) === o.value
										? "font-bold text-amber-400"
										: "text-gray-300 hover:text-white"
								}
							>
								{o.label}
								{o.count != null && (
									<span className="ml-0.5 text-xs text-gray-500">
										{o.count}
									</span>
								)}
							</Link>
						))}
					</div>
				))}
				{f.trait && (
					<div className="flex items-baseline gap-3">
						<span className="w-16 shrink-0 text-xs uppercase tracking-wide text-gray-500">
							Trait
						</span>
						<Link
							rel="nofollow"
							to={href({ trait: null })}
							preventScrollReset
							className="font-bold text-amber-400"
						>
							{traitEmoji(f.trait)} Strong {traitLabel(f.trait)}{" "}
							<span className="font-normal text-gray-400">(remove)</span>
						</Link>
					</div>
				)}
			</div>
			<Arrange data={data} />
		</div>
	)
}

/** Grouping and direction, set apart from the filters as a segmented control. */
function Arrange({ data }: { data: Data }) {
	const href = useFilterHref()
	const { group, order } = data.filters
	const directions =
		group === "score"
			? { desc: "Highest first", asc: "Lowest first" }
			: { desc: "Newest first", asc: "Oldest first" }
	const segment = (active: boolean) =>
		`flex items-center gap-1 px-3 py-1.5 ${active ? "bg-gray-100 font-bold text-gray-900" : "text-gray-300 hover:bg-gray-700"}`
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 bg-gray-900/60 px-3 py-2.5">
			<span className="w-16 shrink-0 text-xs uppercase tracking-wide text-gray-500">
				Group by
			</span>
			<div className="flex overflow-hidden rounded-lg border border-gray-600 text-xs">
				<Link
					rel="nofollow"
					to={href({ group: null, order: null })}
					preventScrollReset
					className={segment(group === "decade")}
				>
					Decades
				</Link>
				<Link
					rel="nofollow"
					to={href({ group: "score", order: null })}
					preventScrollReset
					className={segment(group === "score")}
				>
					Scores
				</Link>
			</div>
			<div className="flex overflow-hidden rounded-lg border border-gray-600 text-xs">
				<Link
					rel="nofollow"
					to={href({ order: null })}
					preventScrollReset
					className={segment(order === "desc")}
				>
					<ArrowDownIcon className="h-3.5 w-3.5" aria-hidden />
					{directions.desc}
				</Link>
				<Link
					rel="nofollow"
					to={href({ order: "asc" })}
					preventScrollReset
					className={segment(order === "asc")}
				>
					<ArrowUpIcon className="h-3.5 w-3.5" aria-hidden />
					{directions.asc}
				</Link>
			</div>
		</div>
	)
}

// Words from scoreLabels in utils/ratings, merged where a band spans several of them.
const BAND_WORDS: Record<string, string> = {
	"90": "Excellent",
	"80": "Great",
	"70": "Good",
	"60": "Decent",
	"30": "Bad to mediocre",
	"0": "Unwatchable to terrible",
	unrated: "Not rated yet",
}

/** Score band heading: GoodWatch disc in the band's vibe color, score word, numeric range. */
function ScoreGroupHeading({
	bandKey,
	label,
}: { bandKey: string; label: string }) {
	const rated = bandKey !== "unrated"
	return (
		<div className="flex items-center gap-3">
			<img
				src={gwLogo}
				alt=""
				className={`h-10 rounded-full p-2 shadow-xl ${rated ? `bg-vibe-${Number(bandKey)}` : "bg-gray-700"}`}
			/>
			<div>
				<h3 className="text-2xl font-black leading-tight">
					{BAND_WORDS[bandKey] ?? label}
				</h3>
				{rated && (
					<p className="text-sm tabular-nums text-gray-300">Score {label}</p>
				)}
			</div>
		</div>
	)
}

function Titles({ data }: { data: Data }) {
	const href = useFilterHref()
	return (
		<section id="titles" className="scroll-mt-20 space-y-5">
			<div className="flex items-baseline gap-3">
				<h2 className="text-2xl font-bold">Movies and TV shows</h2>
				<span className="text-gray-400">{data.total}</span>
			</div>
			<FilterBox data={data} />
			{!data.total && (
				<p className="text-gray-400">No titles match these filters.</p>
			)}
			<div className="space-y-10">
				{data.groups.map((g) => (
					// Native <details>: collapses without JavaScript and keeps collapsed titles in the HTML.
					// Upcoming starts collapsed unless the person asked for it with a filter or "show all".
					<details
						key={g.key}
						id={`group-${g.key}`}
						className="group/section scroll-mt-20"
						open={
							g.key !== "upcoming" ||
							data.filters.decade === "upcoming" ||
							data.filters.expand === "upcoming"
						}
					>
						<summary
							className="mb-4 flex cursor-pointer list-none items-center gap-4 border-b-2 border-gray-700 pb-2 hover:border-gray-500 [&::-webkit-details-marker]:hidden"
							style={
								data.filters.group === "score" && g.key !== "unrated"
									? { borderColor: `var(--color-vibe-${Number(g.key)})` }
									: undefined
							}
						>
							<ChevronDownIcon
								className="h-6 w-6 shrink-0 text-gray-400 transition-transform -rotate-90 group-open/section:rotate-0"
								aria-hidden
							/>
							{data.filters.group === "score" ? (
								<ScoreGroupHeading bandKey={g.key} label={g.label} />
							) : (
								<h3 className="text-3xl font-black">{g.label}</h3>
							)}
							<span className="text-sm text-gray-400">
								{pluralize(g.total, "title")}
								{data.filters.group === "decade" &&
									g.key !== "upcoming" &&
									g.avgScore != null &&
									` · average score ${goodwatchScoreDisplay(g.avgScore)}`}
							</span>
						</summary>
						<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
							{g.items.map((c) => (
								<TitleCard key={c.key} c={c} />
							))}
						</div>
						{g.more && (
							<Link
								rel="nofollow"
								to={
									g.more.kind === "decade"
										? href({ decade: g.more.value })
										: href({ expand: g.more.value }, `#group-${g.key}`)
								}
								preventScrollReset={g.more.kind === "expand"}
								className="mt-3 inline-block text-sm font-semibold text-amber-400 hover:underline"
							>
								{g.key === "upcoming"
									? `All ${g.total} upcoming titles`
									: g.more.kind === "decade"
										? `All ${g.total} titles from the ${g.label}`
										: `Show all ${g.total} titles`}
							</Link>
						)}
					</details>
				))}
			</div>
		</section>
	)
}
