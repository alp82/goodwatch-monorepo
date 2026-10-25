// The Stats tab's numbers: top genres as one ribbon, the people they keep coming back to, eras and favorite classics,
// where it comes from, fun facts, and how they score against the crowd (not another score
// histogram: the Scores tab has that). Country and language names come from the loader, so server and browser agree.
import { Link } from "@remix-run/react"
import { useState } from "react"
import { genreColor, movieGenre } from "~/domain/genre-colors"
import {
	DECADE_TITLES,
	type TastePerson as Person,
	type TasteStats,
} from "~/domain/profile-taste"
import { PosterImg, count, posterUrl, vibe } from "../parts"
import { type Kind, flag, money, pct, signed, useTaste } from "./model"
import { MiniPoster, PANEL, Pills, SectionHead } from "./parts"

/** The stats with names for the codes, as the loader sends them. */
export type NamedTasteStats = Omit<TasteStats, "world"> & {
	world: Omit<TasteStats["world"], "countries" | "languages"> & {
		countries: (TasteStats["world"]["countries"][number] & { name: string })[]
		languages: (TasteStats["world"]["languages"][number] & { name: string })[]
	}
}

function useStats() {
	const { stats, owner, compare } = useTaste()
	return { stats: stats as NamedTasteStats | null, owner, compare }
}

const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
const personHref = (p: { id: number; name: string }) =>
	`/person/${p.id}-${slug(p.name)}`

// ---------- Genres ----------

export function Genres() {
	const { stats, owner } = useStats()
	const [kind, setKind] = useState<"all" | "movie" | "show">("all")
	const [byChoice, setBy] = useState<"titles" | "score">("titles")
	if (!stats?.genres.length) return null
	// Averages are there only when the owner's scores are visible.
	const scored = stats.genres.some((g) => g.average != null)
	const by = scored ? byChoice : "titles"
	const rows = mergeTvGenres(stats.genres)
		.map((g) => ({ ...g, n: kind === "all" ? g.count : (g.kinds[kind] ?? 0) }))
		.filter((g) => g.n > 0)
		.sort((a, b) =>
			by === "titles" ? b.n - a.n : (b.average ?? 0) - (a.average ?? 0),
		)
		.slice(0, 10)
	const total = rows.reduce((s, g) => s + g.n, 0)
	const top = [...rows].sort((a, b) => b.n - a.n)
	return (
		<section aria-labelledby="genres" className="flex flex-col gap-5">
			<SectionHead
				id="genres"
				lead={owner ? "Your top" : "Their top"}
				accent="genres"
				sub={`Most ${top[0]?.name ?? ""}, least ${top.at(-1)?.name ?? ""} of the top ten. A title counts for each of its genres.`}
				right={
					<div className="flex flex-wrap gap-2">
						<Pills
							label="Kind"
							value={kind}
							onChange={setKind}
							options={[
								{ value: "all", label: "All" },
								{ value: "movie", label: "Movies" },
								{ value: "show", label: "Shows" },
							]}
						/>
						{scored && (
							<Pills
								label="Order"
								value={by}
								onChange={setBy}
								options={[
									{ value: "titles", label: "By titles" },
									{ value: "score", label: "By score" },
								]}
							/>
						)}
					</div>
				}
			/>
			<div className={`${PANEL} p-4 sm:p-5`}>
				<GenreRibbon rows={rows} total={total} />
			</div>
		</section>
	)
}

type GenreRow = NamedTasteStats["genres"][number]

type RibbonRow = GenreRow & { n: number }

/** The genre ribbon and its legend. Hover, focus, or tap a segment or a legend row for the genre's numbers; the
 * tooltip floats over the ribbon, so nothing moves. */
function GenreRibbon({ rows, total }: { rows: RibbonRow[]; total: number }) {
	const [tip, setTip] = useState<string | null>(null)
	const [pinned, setPinned] = useState<string | null>(null)
	const shown = tip ?? pinned
	let at = 0
	const centers = new Map<string, number>()
	for (const g of rows) {
		const w = (g.n / total) * 100
		centers.set(g.name, at + w / 2)
		at += w
	}
	const row = rows.find((g) => g.name === shown)
	const center = shown ? (centers.get(shown) ?? 50) : 50
	const hover = (name: string) => ({
		onMouseEnter: () => setTip(name),
		onMouseLeave: () => setTip(null),
		onFocus: () => setTip(name),
		onBlur: () => setTip(null),
		onClick: () => setPinned((p) => (p === name ? null : name)),
	})
	return (
		<>
			<div className="relative">
				<div className="flex h-12 overflow-hidden rounded-lg">
					{rows.map((g) => (
						<button
							key={g.name}
							type="button"
							{...hover(g.name)}
							aria-label={`${g.name}: ${g.n} titles, ${pct(g.n / total)}${g.average == null ? "" : `, average ${g.average.toFixed(1)}`}`}
							className={`flex min-w-0 cursor-pointer items-center justify-center text-[11px] font-black text-gray-950 transition-opacity focus-visible:outline-none sm:text-xs ${shown && shown !== g.name ? "opacity-50" : ""}`}
							style={{
								width: `${(g.n / total) * 100}%`,
								background: genreColor(g.name),
							}}
						>
							<span className="truncate px-1" aria-hidden>
								{g.n / total > 0.09 ? pct(g.n / total) : ""}
							</span>
						</button>
					))}
				</div>
				{row && (
					<div
						role="tooltip"
						className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-sm shadow-xl ring-1 ring-white/15"
						style={{ left: `clamp(4.5rem, ${center}%, calc(100% - 4.5rem))` }}
					>
						<span className="flex items-center gap-2 font-bold text-white">
							<span
								aria-hidden
								className="size-2.5 rounded-sm"
								style={{ background: genreColor(row.name) }}
							/>
							{row.name}
						</span>
						<span className="mt-0.5 flex items-center gap-2 text-xs text-gray-300 tabular-nums">
							{row.n} titles · {pct(row.n / total)}
							{row.average != null && (
								<span
									className="rounded px-1 text-[11px] font-black text-gray-950"
									style={{ background: vibe(row.average) }}
								>
									{row.average.toFixed(1)}
								</span>
							)}
						</span>
					</div>
				)}
			</div>
			<ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 min-[420px]:grid-cols-2 lg:grid-cols-5">
				{rows.map((g) => (
					<li key={g.name}>
						<button
							type="button"
							{...hover(g.name)}
							className={`flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-left text-sm hover:bg-white/5 ${shown === g.name ? "bg-white/[0.07]" : ""}`}
						>
							<span
								aria-hidden
								className="size-3 shrink-0 rounded-sm"
								style={{ background: genreColor(g.name) }}
							/>
							<span className="min-w-0 flex-1 truncate font-semibold text-gray-200">
								{g.name}
							</span>
							<span className="text-xs text-gray-500 tabular-nums">{g.n}</span>
							{g.average != null && (
								<span
									className="rounded px-1 text-[11px] font-black text-gray-950 tabular-nums"
									style={{ background: vibe(g.average) }}
								>
									{g.average.toFixed(1)}
								</span>
							)}
						</button>
					</li>
				))}
			</ul>
		</>
	)
}

/** TMDB's TV genre pairs counted as their movie genre (Sci-Fi & Fantasy as Science Fiction), so a genre shows once. */
function mergeTvGenres(genres: GenreRow[]): GenreRow[] {
	const byName = new Map<string, GenreRow>()
	for (const g of genres) {
		const name = movieGenre(g.name)
		const known = byName.get(name)
		if (!known) {
			byName.set(name, { ...g, name, kinds: { ...g.kinds } })
			continue
		}
		const count = known.count + g.count
		const average =
			known.average != null && g.average != null
				? Math.round(
						((known.average * known.count + g.average * g.count) / count) * 10,
					) / 10
				: (known.average ?? g.average)
		const kinds = { ...known.kinds }
		for (const [k, v] of Object.entries(g.kinds))
			kinds[k as Kind] = (kinds[k as Kind] ?? 0) + (v ?? 0)
		byName.set(name, { ...known, count, average, kinds })
	}
	return [...byName.values()]
}

// ---------- People ----------

export function People() {
	const { stats, owner } = useStats()
	const [byChoice, setBy] = useState<"watched" | "rated">("rated")
	if (!stats) return null
	const people = stats.people
	const lists = { rated: people.bestDirectors, watched: people.directors }
	// Best rated needs the owner's scores and directors with three rated films; without it, Most watched is the list.
	const rankable = people.bestDirectors.length > 0
	const by = rankable ? byChoice : "watched"
	const shown = rankable
		? (["rated", "watched"] as const)
		: (["watched"] as const)
	if (!lists[by].length && !people.actors.length) return null
	return (
		<section aria-labelledby="people" className="flex flex-col gap-5">
			<SectionHead
				id="people"
				lead={owner ? "Your favorite" : "Their favorite"}
				accent="directors"
				sub={`The names ${owner ? "you" : "they"} keep coming back to. Movies only: shows have a director per episode.`}
				right={
					rankable && (
						<Pills
							label="Order"
							value={by}
							onChange={setBy}
							options={[
								{ value: "rated", label: "Best rated" },
								{ value: "watched", label: "Most watched" },
							]}
						/>
					)
				}
			/>
			{/* Both rankings share one grid cell; the hidden one keeps the taller height, so switching never moves the page. */}
			<div className="grid">
				{shown.map((key) => (
					<div
						key={key}
						className={`[grid-area:1/1] ${key === by ? "" : "invisible"}`}
						aria-hidden={key !== by}
					>
						<Directors directors={lists[key]} people={people} />
					</div>
				))}
			</div>
			<div className={`${PANEL} p-4 sm:p-5`}>
				<p className="mb-3 text-sm font-bold text-gray-200">On screen most</p>
				<ul className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
					{people.actors.map((p) => (
						<li key={p.id} className="w-20 shrink-0 text-center">
							<Link to={personHref(p)} className="group block">
								{p.profile ? (
									<img
										src={posterUrl(p.profile, "w185") ?? ""}
										alt=""
										loading="lazy"
										className="mx-auto size-16 rounded-full object-cover ring-2 ring-white/10 transition-transform group-hover:-translate-y-0.5"
									/>
								) : (
									<span className="mx-auto block size-16 rounded-full bg-white/10" />
								)}
								<span className="mt-1.5 block truncate text-xs font-semibold text-gray-200 group-hover:text-white">
									{p.name}
								</span>
								<span className="block text-[11px] text-gray-500">
									{p.count} titles
								</span>
							</Link>
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}

function Directors({
	directors,
	people,
}: { directors: Person[]; people: NamedTasteStats["people"] }) {
	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
			<ol className="grid gap-4 sm:grid-cols-2">
				{directors.slice(0, 4).map((p, i) => (
					<li key={p.id} className={`${PANEL} min-w-0 p-4`}>
						<p className="flex items-baseline gap-2">
							<span className="rounded bg-amber-400/15 px-1.5 text-[11px] font-black text-amber-300 tabular-nums">
								№ {String(i + 1).padStart(2, "0")}
							</span>
							<Link
								to={personHref(p)}
								className="truncate font-bold text-white hover:text-amber-300"
							>
								{p.name}
							</Link>
						</p>
						<p className="mt-0.5 mb-3 text-xs text-gray-500">
							{p.count} films{p.hours ? ` · ${p.hours} h` : ""}
							{p.average != null && ` · average ${p.average}`}
						</p>
						<ul className="grid grid-cols-5 gap-2">
							{p.titles.slice(0, 5).map((t) => (
								<li key={t.key}>
									<MiniPoster title={t} />
								</li>
							))}
						</ul>
					</li>
				))}
			</ol>
			<div className={`${PANEL} p-4`}>
				<p className="mb-2 text-xs font-bold tracking-[0.16em] text-gray-500 uppercase">
					Ranks 5–{Math.min(directors.length, 8)}
				</p>
				<ol className="flex flex-col divide-y divide-white/5">
					{directors.slice(4, 8).map((p, i) => (
						<li key={p.id} className="flex items-center gap-3 py-2">
							<span className="w-6 text-sm font-black text-gray-600 tabular-nums">
								{String(i + 5).padStart(2, "0")}
							</span>
							<span className="block w-7 shrink-0">
								{p.titles[0] && (
									<PosterImg title={p.titles[0]} className="rounded-sm" />
								)}
							</span>
							<Link
								to={personHref(p)}
								className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-200 hover:text-white"
							>
								{p.name}
							</Link>
							<span className="text-xs text-gray-500">{p.count} films</span>
						</li>
					))}
				</ol>
				<Compact title="Composers" people={people.composers} unit="films" />
				<Compact title="Writers" people={people.writers} unit="films" />
			</div>
		</div>
	)
}

function Compact({
	title,
	people,
	unit,
}: { title: string; people: Person[]; unit: string }) {
	return (
		<div className="mt-4">
			<p className="mb-1 text-xs font-bold tracking-[0.16em] text-gray-500 uppercase">
				{title}
			</p>
			<ul className="flex flex-col gap-0.5 text-sm">
				{people.slice(0, 3).map((p) => (
					<li key={p.id} className="flex gap-2">
						<Link
							to={personHref(p)}
							className="min-w-0 flex-1 truncate text-gray-300 hover:text-white"
						>
							{p.name}
						</Link>
						<span className="text-xs text-gray-500">
							{p.count} {unit}
						</span>
					</li>
				))}
			</ul>
		</div>
	)
}

// ---------- Eras ----------

export function Eras() {
	const { stats, owner } = useStats()
	const d = stats?.eras.decades ?? []
	// The decade with the most titles opens first.
	const busiest = [...d].sort((a, b) => b.count - a.count)[0]
	const [picked, setPicked] = useState<number | null>(null)
	if (!stats || !d.length) return null
	const decade = picked ?? busiest.decade
	const most = Math.max(...d.map((x) => x.count))
	const current = d.find((x) => x.decade === decade)
	const titles = current?.titles ?? []
	// Without the owner's scores the panel goes by the GoodWatch score, so it doesn't claim to be their best.
	const scored = current?.average != null
	return (
		<section aria-labelledby="eras" className="flex flex-col gap-5">
			<SectionHead
				id="eras"
				lead={owner ? "When your titles" : "When their titles"}
				accent="came out"
			/>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
				<div className={`${PANEL} flex flex-col p-4 sm:p-5`}>
					<div
						className="flex h-52 items-stretch gap-1.5"
						role="group"
						aria-label="Decades"
					>
						{d.map((x) => {
							const on = x.decade === decade
							return (
								<button
									key={x.decade}
									type="button"
									onClick={() => setPicked(x.decade)}
									aria-pressed={on}
									aria-label={`${x.decade}s: ${x.count} titles${x.average == null ? "" : `, average ${x.average}`}`}
									className="group flex min-w-0 flex-1 cursor-pointer flex-col items-center justify-end gap-1 rounded-md focus-visible:outline-2 focus-visible:outline-amber-400"
								>
									<span
										className={`text-[10px] font-bold tabular-nums ${on ? "text-amber-300" : "text-gray-400"}`}
									>
										{x.count}
									</span>
									<span
										className={`block w-full rounded-t-md transition-colors ${on ? "bg-amber-400" : "bg-gray-500/60 group-hover:bg-gray-400/70"}`}
										style={{
											height: `${Math.max(3, (x.count / most) * 70)}%`,
										}}
									/>
									<span
										className={`text-[10px] font-bold tabular-nums ${on ? "text-white" : "text-gray-500"}`}
									>
										’{String(x.decade).slice(2)}
									</span>
									<span className="h-[18px]">
										{x.average != null && (
											<span
												className="rounded px-1 text-[11px] font-black text-gray-950 tabular-nums"
												style={{ background: vibe(x.average) }}
											>
												{x.average.toFixed(1)}
											</span>
										)}
									</span>
								</button>
							)
						})}
					</div>
				</div>
				<div className={`${PANEL} p-4 sm:p-5`} aria-live="polite">
					<p className="mb-3 text-sm font-bold text-gray-200">
						{scored ? `${owner ? "Your" : "Their"} best from the` : "From the"}{" "}
						<span className="text-amber-400">{decade}s</span>
					</p>
					<ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
						{Array.from({ length: DECADE_TITLES }, (_, i) => {
							const t = titles[i]
							return (
								<li
									key={t?.key ?? `empty-${i}`}
									className={i >= 8 ? "max-sm:hidden" : ""}
								>
									{t ? (
										<>
											<MiniPoster title={t} />
											<span className="mt-1 block truncate text-[11px] text-gray-500">
												{t.year}
											</span>
										</>
									) : (
										<>
											<span className="block aspect-[2/3] rounded-md bg-white/[0.03]" />
											<span className="mt-1 block text-[11px]">&nbsp;</span>
										</>
									)}
								</li>
							)
						})}
					</ul>
				</div>
			</div>
		</section>
	)
}

// ---------- World ----------

export function World() {
	const { stats, owner } = useStats()
	if (!stats?.world.countries.length) return null
	const w = stats.world
	const [first, ...rest] = w.countries
	return (
		<section aria-labelledby="world" className="flex flex-col gap-5">
			<SectionHead
				id="world"
				lead={
					owner ? "Your watching, around the" : "Their watching, around the"
				}
				accent="world"
				sub={`Production countries: ${w.totalCountries} in all. A co-production counts for each country.`}
			/>
			<div className={`${PANEL} p-4 sm:p-5`}>
				<div className="flex h-28 gap-1.5">
					{first && (
						<div
							className="flex min-w-0 flex-col justify-between rounded-lg bg-amber-400 p-3 text-gray-950"
							style={{ flex: `${first.share} 1 0` }}
						>
							<span className="truncate text-sm font-bold">
								<span aria-hidden>{flag(first.code)} </span>
								{first.name}
							</span>
							<span className="text-3xl font-black tabular-nums">
								{pct(first.share)}
							</span>
						</div>
					)}
					{rest.slice(0, 5).map((c) => (
						<div
							key={c.code}
							className="flex min-w-9 flex-col items-center justify-end rounded-lg bg-amber-400/15 p-1.5 text-amber-200 ring-1 ring-amber-400/20"
							style={{ flex: `${Math.max(c.share, 0.04)} 1 0` }}
							title={`${c.name}: ${c.count}`}
						>
							<span aria-hidden className="text-lg">
								{flag(c.code)}
							</span>
							<span className="text-[11px] font-bold tabular-nums">
								{pct(c.share)}
							</span>
						</div>
					))}
				</div>
				<ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
					{w.countries.map((c) => (
						<li key={c.code} className="text-gray-300">
							<span aria-hidden>{flag(c.code)} </span>
							{c.name} <b className="text-white tabular-nums">{pct(c.share)}</b>
							<span className="text-xs text-gray-500">
								{" "}
								· {c.count}
								{c.average != null && ` · avg ${c.average}`}
							</span>
						</li>
					))}
				</ul>
				<p className="mt-4 mb-2 text-xs font-bold tracking-[0.16em] text-gray-500 uppercase">
					Original languages · {w.totalLanguages}
				</p>
				<ul className="flex flex-wrap gap-1.5">
					{w.languages.map((l) => (
						<li
							key={l.code}
							className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-gray-300 ring-1 ring-white/10"
						>
							{l.name} <b className="text-white tabular-nums">{l.count}</b>
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}

// ---------- Fun facts ----------

export function Facts() {
	const { stats, owner } = useStats()
	if (!stats?.facts) return null
	const f = stats.facts
	const hm = (minutes: number) =>
		minutes >= 60
			? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
			: `${minutes} min`
	const facts = [
		f.longest?.minutes && {
			t: f.longest,
			label: "Longest movie",
			value: hm(f.longest.minutes),
		},
		f.shortest?.minutes && {
			t: f.shortest,
			label: "Shortest movie",
			value: hm(f.shortest.minutes),
		},
		f.oldest && {
			t: f.oldest,
			label: "Oldest title",
			value: String(f.oldest.year ?? ""),
		},
		f.newest && {
			t: f.newest,
			label: "Newest title",
			value: String(f.newest.year ?? ""),
		},
		f.mostEpisodes && {
			t: f.mostEpisodes,
			label: "Most episodes",
			value: count(f.mostEpisodes.episodes),
		},
	].filter((x) => !!x)
	if (!f.budget && !facts.length) return null
	return (
		<section aria-labelledby="facts" className="flex flex-col gap-5">
			<SectionHead id="facts" lead="Fun" accent="facts" />
			<div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
				{f.budget > 0 && (
					<div className={`${PANEL} flex flex-col justify-center p-5`}>
						<p className="text-xs font-bold tracking-[0.16em] text-gray-500 uppercase">
							Movie budgets
						</p>
						<p className="mt-1 text-4xl font-black text-white tabular-nums">
							{money(f.budget)}
						</p>
						<p className="text-sm text-gray-400">
							spent by studios on the movies {owner ? "you've" : "they've"}{" "}
							seen.
							{f.revenue > 0 && ` They earned ${money(f.revenue)}.`}
						</p>
						{f.averageRuntime != null && (
							<p className="mt-4 text-sm text-gray-400">
								Average movie:{" "}
								<b className="text-white">{f.averageRuntime} min</b>
							</p>
						)}
					</div>
				)}
				<ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
					{facts.map((x) => (
						<li
							key={x.label}
							className={`${PANEL} flex min-w-0 flex-col gap-2 p-3`}
						>
							<span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
								{x.label}
							</span>
							<span className="text-xl font-black text-white tabular-nums">
								{x.value}
							</span>
							<Link
								to={x.t.href}
								className="mt-auto flex min-w-0 items-center gap-2"
							>
								<span className="block w-8 shrink-0">
									<PosterImg title={x.t} className="rounded-sm" />
								</span>
								<span className="truncate text-xs font-semibold text-gray-300">
									{x.t.title}
								</span>
							</Link>
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}

// ---------- Rating style ----------

export function RatingStyle() {
	const { stats, owner, compare } = useStats()
	const { taste } = useTaste()
	if (!stats) return null
	const shared = compare?.shared ?? []
	const gapToThem = shared.length
		? shared.reduce((sum, r) => sum + r.yours - r.theirs, 0) / shared.length
		: 0
	const s = stats.style
	if (!s) return null
	const pos = (v: number) => `${((v - 1) / 9) * 100}%`
	const kinds = (["movie", "show"] as Kind[]).filter((k) => s.byKind[k] != null)
	const KIND: Record<Kind, string> = {
		movie: "Movies",
		show: "Shows",
		anime: "Anime",
	}
	return (
		<section aria-labelledby="style" className="flex flex-col gap-5">
			<SectionHead
				id="style"
				eyebrow="Rating style"
				lead="How generous are"
				accent={owner ? "you" : "they"}
				tail="?"
				sub={`${owner ? "Your" : "Their"} scores against the GoodWatch score on the same titles. The full spread is on the Scores page.`}
			/>
			<div className="grid gap-3 md:grid-cols-3">
				<div className={`${PANEL} p-5 md:col-span-2`}>
					<div className="flex flex-wrap items-baseline gap-x-3">
						<span className="text-3xl font-black text-white">{s.label}</span>
						<span className="text-sm text-gray-400">
							{Math.abs(s.offset) < 0.1
								? "Right in line with everyone"
								: `${signed(s.offset)} points against everyone`}
						</span>
					</div>
					<div className="relative mt-8 mb-2 h-2 rounded-full bg-white/[0.08]">
						<Marker
							at={pos(s.crowdAverage)}
							label={`Everyone ${s.crowdAverage}`}
							below
						/>
						<Marker
							at={pos(s.average)}
							label={`${owner ? "You" : "They"} ${s.average}`}
						/>
					</div>
					<div className="mt-7 flex justify-between text-[10px] font-bold text-gray-600">
						<span>1</span>
						<span>10</span>
					</div>
					{compare && compare.yourUsual != null && (
						<p className="mt-4 flex items-center gap-2 rounded-lg bg-sky-400/[0.07] px-3 py-2 text-sm text-sky-100 ring-1 ring-sky-400/25">
							<span
								aria-hidden
								className="size-2.5 shrink-0 rounded-full bg-sky-400"
							/>
							<span>
								Your usual is <b>{compare.yourUsual}</b>. On the {shared.length}{" "}
								titles you both rated, you score{" "}
								<b>
									{Math.abs(gapToThem) < 0.1
										? "the same"
										: `${signed(gapToThem)} points`}
								</b>{" "}
								against them.
							</span>
						</p>
					)}
					<dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
						<Mini label="Scored 8 or more" value={pct(s.share8)} />
						{s.kindest && (
							<Mini
								label="Kindest genre"
								value={s.kindest.genre}
								sub={String(s.kindest.average)}
							/>
						)}
						{s.harshest && (
							<Mini
								label="Harshest genre"
								value={s.harshest.genre}
								sub={String(s.harshest.average)}
							/>
						)}
						{taste.crowd.status === "ready" && (
							<Mini
								label="Agreement"
								value={`r ${taste.crowd.agreement.toFixed(2)}`}
								sub={`${count(taste.crowd.counted)} titles`}
							/>
						)}
					</dl>
				</div>
				<div className={`${PANEL} p-5`}>
					<p className="mb-3 text-sm font-bold text-gray-200">By kind</p>
					<ul className="flex flex-col gap-3">
						{kinds.map((k) => {
							const v = s.byKind[k] as number
							return (
								<li
									key={k}
									className="grid grid-cols-[4rem_1fr_2rem] items-center gap-2 text-sm"
								>
									<span className="text-gray-300">{KIND[k]}</span>
									<span className="h-2 rounded-full bg-white/[0.06]">
										<span
											className="block h-full rounded-full"
											style={{ width: pos(v), background: vibe(v) }}
										/>
									</span>
									<span className="text-right font-bold text-white tabular-nums">
										{v}
									</span>
								</li>
							)
						})}
					</ul>
				</div>
			</div>
		</section>
	)
}

function Marker({
	at,
	label,
	below = false,
}: { at: string; label: string; below?: boolean }) {
	return (
		<span
			className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
			style={{ left: at }}
		>
			<span
				className={`block size-4 rounded-full ring-2 ring-gray-950 ${below ? "bg-gray-300" : "bg-amber-400"}`}
			/>
			<span
				className={`absolute left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap ${below ? "top-5 text-gray-400" : "-top-6 text-amber-300"}`}
			>
				{label}
			</span>
		</span>
	)
}

function Mini({
	label,
	value,
	sub,
}: { label: string; value: string; sub?: string }) {
	return (
		<div className="min-w-0">
			<dt className="text-[11px] text-gray-500">{label}</dt>
			<dd className="truncate font-bold text-white">
				{value}{" "}
				{sub && (
					<span className="text-xs font-normal text-gray-500">{sub}</span>
				)}
			</dd>
		</div>
	)
}
