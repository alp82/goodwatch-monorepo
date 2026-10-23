// The Taste tab's numbers: top genres as one ribbon, the people they keep coming back to, eras and favorite classics,
// where it comes from, essence tags and tropes, fun facts, and how they score against the crowd (not another score
// histogram: the Scores tab has that). Country and language names come from the loader, so server and browser agree.
import { Link } from "@remix-run/react"
import { useState } from "react"
import type { TastePerson as Person, TasteStats } from "~/domain/profile-taste"
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

const PALETTE = [
	"#3b82f6",
	"#f59e0b",
	"#f97316",
	"#14b8a6",
	"#ef4444",
	"#8b5cf6",
	"#a8a29e",
	"#eab308",
	"#ec4899",
	"#22c55e",
	"#06b6d4",
	"#f43f5e",
]
const slug = (s: string) =>
	s
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "")
const personHref = (p: { id: number; name: string }) =>
	`/person/${p.id}-${slug(p.name)}`
/** Rose to amber to green across a small range of averages, so close averages still read apart. */
const relColor = (v: number, min: number, max: number) => {
	const t = max > min ? (v - min) / (max - min) : 0.5
	return `hsl(${Math.round(350 + t * 130) % 360} 75% ${52 + t * 6}%)`
}

// ---------- Genres ----------

export function Genres() {
	const { stats, owner } = useStats()
	const [kind, setKind] = useState<"all" | Kind>("all")
	const [by, setBy] = useState<"titles" | "score">("titles")
	if (!stats?.genres.length) return null
	const rows = stats.genres
		.map((g) => ({ ...g, n: kind === "all" ? g.count : (g.kinds[kind] ?? 0) }))
		.filter((g) => g.n > 0)
		.sort((a, b) => (by === "titles" ? b.n - a.n : b.average - a.average))
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
								{ value: "anime", label: "Anime" },
							]}
						/>
						<Pills
							label="Order"
							value={by}
							onChange={setBy}
							options={[
								{ value: "titles", label: "By titles" },
								{ value: "score", label: "By score" },
							]}
						/>
					</div>
				}
			/>
			<div className={`${PANEL} p-4 sm:p-5`}>
				<div className="flex h-12 overflow-hidden rounded-lg" aria-hidden>
					{rows.map((g, i) => (
						<span
							key={g.name}
							className="flex min-w-0 items-center justify-center text-[11px] font-black text-gray-950 sm:text-xs"
							style={{
								width: `${(g.n / total) * 100}%`,
								background: PALETTE[i % PALETTE.length],
							}}
							title={`${g.name}: ${g.n}`}
						>
							<span className="truncate px-1">
								{g.n / total > 0.09 ? pct(g.n / total) : ""}
							</span>
						</span>
					))}
				</div>
				<ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 min-[420px]:grid-cols-2 lg:grid-cols-5">
					{rows.map((g, i) => (
						<li
							key={g.name}
							className="flex min-w-0 items-center gap-2 text-sm"
						>
							<span
								aria-hidden
								className="size-3 shrink-0 rounded-sm"
								style={{ background: PALETTE[i % PALETTE.length] }}
							/>
							<span className="min-w-0 flex-1 truncate font-semibold text-gray-200">
								{g.name}
							</span>
							<span className="text-xs text-gray-500 tabular-nums">{g.n}</span>
							<span
								className="rounded px-1 text-[11px] font-black text-gray-950 tabular-nums"
								style={{ background: vibe(g.average) }}
								title={`Average score ${g.average}`}
							>
								{g.average.toFixed(1)}
							</span>
						</li>
					))}
				</ul>
			</div>
		</section>
	)
}

// ---------- People ----------

export function People() {
	const { stats, owner } = useStats()
	const [by, setBy] = useState<"watched" | "rated">("watched")
	if (!stats) return null
	const people = stats.people
	const directors = by === "watched" ? people.directors : people.bestDirectors
	if (!directors.length && !people.actors.length) return null
	return (
		<section aria-labelledby="people" className="flex flex-col gap-5">
			<SectionHead
				id="people"
				lead={owner ? "Your most-watched" : "Their most-watched"}
				accent="directors"
				sub={`The names ${owner ? "you" : "they"} keep coming back to. Movies only: shows have a director per episode.`}
				right={
					<Pills
						label="Order"
						value={by}
						onChange={setBy}
						options={[
							{ value: "watched", label: "Most watched" },
							{ value: "rated", label: "Best rated" },
						]}
					/>
				}
			/>
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
								{p.count} films{p.hours ? ` · ${p.hours} h` : ""} · average{" "}
								{p.average}
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
	if (!stats?.eras.decades.length) return null
	const d = stats.eras.decades
	const most = Math.max(...d.map((x) => x.count))
	const lo = Math.min(...d.map((x) => x.average))
	const hi = Math.max(...d.map((x) => x.average))
	const year = new Date().getFullYear()
	return (
		<section aria-labelledby="eras" className="flex flex-col gap-5">
			<SectionHead
				id="eras"
				lead={owner ? "When your titles" : "When their titles"}
				accent="came out"
				sub={`${owner ? "Your" : "Their"} titles average ${stats.eras.averageYear}. Bar height is titles; color runs from the lowest average decade (red) to the highest (green).`}
			/>
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
				<div className={`${PANEL} flex flex-col p-4 sm:p-5`}>
					<div className="flex h-44 items-end gap-1.5">
						{d.map((x) => (
							<div
								key={x.decade}
								className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
							>
								<span className="text-[10px] font-bold text-gray-400 tabular-nums">
									{x.count}
								</span>
								<span
									className="block w-full rounded-t-md"
									style={{
										height: `${Math.max(3, (x.count / most) * 100)}%`,
										background: relColor(x.average, lo, hi),
									}}
									title={`${x.decade}s: ${x.count} titles, average ${x.average}`}
								/>
							</div>
						))}
					</div>
					<div className="mt-1.5 flex gap-1.5">
						{d.map((x) => (
							<span
								key={x.decade}
								className="min-w-0 flex-1 text-center text-[10px] font-bold text-gray-500 tabular-nums"
							>
								’{String(x.decade).slice(2)}
							</span>
						))}
					</div>
					<p className="mt-3 text-xs text-gray-500">
						Kindest decade: {(() => {
							const best = [...d]
								.filter((x) => x.count >= 10)
								.sort((a, b) => b.average - a.average)[0]
							return best ? (
								<b className="text-gray-300">
									the {best.decade}s ({best.average})
								</b>
							) : null
						})()}
					</p>
				</div>
				<div className={`${PANEL} p-4 sm:p-5`}>
					<p className="text-sm font-bold text-gray-200">
						{owner ? "Your" : "Their"} favorite{" "}
						<span className="text-amber-400">classics</span>
					</p>
					<p className="mb-3 text-xs text-gray-500">
						At least 25 years old ({year - 25} or earlier), scored 9 or 10
					</p>
					<ul className="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
						{stats.eras.classics.slice(0, 14).map((t, i) => (
							<li key={t.key} className={i >= 8 ? "max-sm:hidden" : ""}>
								<MiniPoster title={t} />
								<span className="mt-1 block truncate text-[11px] text-gray-500">
									{t.year}
								</span>
							</li>
						))}
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
								· {c.count} · avg {c.average}
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

// ---------- Tags ----------

export function Tags() {
	const { stats, owner } = useStats()
	const [which, setWhich] = useState<"essence" | "tropes">("essence")
	if (!stats || (!stats.tags.essence.length && !stats.tags.tropes.length))
		return null
	const items = which === "essence" ? stats.tags.essence : stats.tags.tropes
	const max = Math.max(...items.map((t) => t.count))
	const min = Math.min(...items.map((t) => t.count))
	return (
		<section aria-labelledby="tags" className="flex flex-col gap-5">
			<SectionHead
				id="tags"
				lead={owner ? "Your taste, in" : "Their taste, in"}
				accent="tags"
				sub="From the title analysis of everything scored 8 or more. Bigger is more often."
				right={
					<Pills
						label="Tags"
						value={which}
						onChange={setWhich}
						options={[
							{ value: "essence", label: "Essence" },
							{ value: "tropes", label: "Tropes" },
						]}
					/>
				}
			/>
			<div className={`${PANEL} p-5 sm:p-6`}>
				<ul className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
					{items.map((t, i) => {
						const x = (t.count - min) / Math.max(1, max - min)
						const hot = i < 5
						return (
							<li
								key={t.name}
								className={`leading-tight font-semibold ${hot ? "text-amber-400" : "text-gray-300"}`}
								style={{
									fontSize: `calc(0.85rem + ${x.toFixed(2)} * clamp(0.45rem, 2.4vw, 1.25rem))`,
								}}
							>
								{t.name}
								<span className="ml-1 align-baseline text-[11px] font-bold text-gray-500 tabular-nums">
									{t.count}
								</span>
							</li>
						)
					})}
				</ul>
			</div>
		</section>
	)
}

// ---------- Fun facts ----------

export function Facts() {
	const { stats, owner } = useStats()
	if (!stats) return null
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
	const pos = (v: number) => `${((v - 1) / 9) * 100}%`
	const kinds = (["movie", "show", "anime"] as Kind[]).filter(
		(k) => s.byKind[k] != null,
	)
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
								? "Right in line with the crowd"
								: `${signed(s.offset)} points against the crowd`}
						</span>
					</div>
					<div className="relative mt-8 mb-2 h-2 rounded-full bg-linear-to-r from-rose-500/60 via-amber-400/60 to-emerald-400/60">
						<Marker
							at={pos(s.crowdAverage)}
							label={`Crowd ${s.crowdAverage}`}
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
