// PROTOTYPE - throwaway. Six ways Discover and Search could use taste (#179), all inside the chosen filter bar.
// "existing" variants keep the app's poster card, score tab and streaming badges and vary what sits around them;
// "bolder" ones reach further, still poster-forward.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import { type ReactNode, useState } from "react"
import { GRID } from "~/ui/prototype-rec-filter-bar/kit"
import { goodwatchVibeIndex } from "~/utils/ratings"
import { Recover, Shell } from "./bar"
import { BecauseLine, CoinCard, MatchBar, MovedChip, PosterLink, StrengthControl, WhyLine, whyText } from "./cards"
import { type Disc, type Ranked, posterUrl, titleHref, useDiscover } from "./rank"
import type { DiscTitle, Payload } from "./types"

const LIMIT = 36

// The existing grid, with room under each card for what a variant wants to say.
function ResultGrid({ d, items, className = GRID, coin = true, below }: { d: Disc; items: Ranked[]; className?: string; coin?: boolean; below?: (r: Ranked) => ReactNode }) {
	return (
		<div className={className}>
			<AnimatePresence initial={false} mode="popLayout">
				{items.map((r) => (
					<motion.div key={r.t.ref} layout initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25, type: "tween" }}>
						<CoinCard t={r.t} mine={d.data.mine} coin={coin} />
						{below && <div className="px-1.5 sm:px-2">{below(r)}</div>}
					</motion.div>
				))}
			</AnimatePresence>
			{d.bar.recoveries.length > 0 && <Recover d={d} className={d.bar.results.length ? "aspect-[2/3] scale-95" : "col-span-full py-12"} />}
		</div>
	)
}

// ---------------------------------------------------------------- 1. badge (existing)

function Badge({ data }: { data: Payload }) {
	const d = useDiscover(data, { discover: "popular", search: "relevance" })
	return (
		<Shell d={d}>
			<ResultGrid d={d} items={d.ranked.slice(0, LIMIT)} />
		</Shell>
	)
}

// ---------------------------------------------------------------- 2. blend (existing)

function Blend({ data }: { data: Payload }) {
	const d = useDiscover(data, { discover: "popular", search: "relevance", strength: 0.6 })
	const plain = d.sort === "top" || d.sort === "newest" || d.sort === "taste"
	return (
		<Shell d={d} extra={!plain && <StrengthControl d={d} />} taste={<StrengthControl d={d} wide />}>
			{!plain && (
				<div className="mb-4 lg:hidden">
					<StrengthControl d={d} wide />
				</div>
			)}
			<ResultGrid
				d={d}
				items={d.ranked.slice(0, LIMIT)}
				coin={false}
				below={(r) => (
					<div className="flex items-center gap-2 pb-2">
						<MatchBar t={r.t} className="flex-1" />
						<span className="w-11 text-right">
							<MovedChip moved={r.moved} />
						</span>
					</div>
				)}
			/>
		</Shell>
	)
}

// ---------------------------------------------------------------- 3. because (existing)

function Because({ data }: { data: Payload }) {
	const d = useDiscover(data, { discover: "taste", search: "relevance" })
	return (
		<Shell d={d}>
			<ResultGrid
				d={d}
				items={d.ranked.slice(0, LIMIT)}
				className="grid grid-cols-2 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 gap-y-2 sm:gap-x-4 lg:gap-x-5"
				below={(r) => (
					<div className="flex min-h-[68px] flex-col gap-1.5 pb-4 pt-0.5">
						{r.t.rated != null ? <span className="text-xs text-gray-400">You rated it {r.t.rated}</span> : (r.t.match ?? 0) >= 70 ? <BecauseLine t={r.t} /> : r.t.match != null ? <span className="text-xs text-gray-500">Far from what you usually rate highly</span> : null}
						<WhyLine t={r.t} />
					</div>
				)}
			/>
		</Shell>
	)
}

// ---------------------------------------------------------------- 4. split (existing)

function Section({ title, note, count, children, tone = "amber" }: { title: string; note: string; count: number; children: ReactNode; tone?: "amber" | "gray" }) {
	return (
		<section className="mb-10">
			<header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<span className={`h-4 w-1 self-center rounded-full ${tone === "amber" ? "bg-amber-500" : "bg-gray-600"}`} />
				<h2 className={`brand-header text-2xl ${tone === "amber" ? "text-white" : "text-gray-300"}`}>{title}</h2>
				<span className="text-sm tabular-nums text-gray-500">{count}</span>
				<span className="w-full pl-4 text-sm text-gray-500 sm:w-auto sm:pl-0">{note}</span>
			</header>
			{children}
		</section>
	)
}

function Split({ data }: { data: Payload }) {
	const d = useDiscover(data, { discover: "popular", search: "relevance" })
	const [allNot, setAllNot] = useState(false)
	const search = d.surface === "search"
	const q = `“${d.query.q}”`
	// Search keeps relevance: only the 24 closest matches can be promoted into "for you".
	const yours = d.ranked.filter((r) => (r.t.match ?? 0) >= (search ? 75 : 80) && (!search || r.t.rel < 24)).slice(0, 12)
	const yourSet = new Set(yours.map((r) => r.t.ref))
	const notYours = d.ranked.filter((r) => r.t.match != null && r.t.match < 60 && !yourSet.has(r.t.ref))
	const notSet = new Set(notYours.map((r) => r.t.ref))
	const rest = d.ranked.filter((r) => !yourSet.has(r.t.ref) && !notSet.has(r.t.ref))
	const notShown = allNot ? notYours : notYours.slice(0, 8)
	return (
		<Shell d={d}>
			{yours.length > 0 && (
				<Section title={search ? `${q}, for you` : "For you"} count={yours.length} note={search ? "The closest matches that are most like what you rate highly" : "Popular now and most like what you rate highly"}>
					<ResultGrid d={{ ...d, bar: { ...d.bar, recoveries: [] } }} items={yours} below={(r) => <WhyLine t={r.t} className="pb-3" />} />
				</Section>
			)}
			<Section title={search ? `More ${q}` : "Also popular"} count={rest.length} note={search ? "In order of how well they match the search" : "In order of popularity"} tone="gray">
				<ResultGrid d={d} items={rest.slice(0, 24)} />
			</Section>
			{notYours.length > 0 && (
				<Section title="Popular, but not your thing" count={notYours.length} note="Far from what you usually rate highly" tone="gray">
					<div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
						{notShown.map((r) => (
							<Link key={r.t.ref} to={titleHref(r.t)} prefetch="intent" className="group block opacity-60 grayscale-[.6] transition hover:opacity-100 hover:grayscale-0">
								<img src={posterUrl(r.t.poster_path, "w185")} alt={r.t.title} loading="lazy" className="aspect-[2/3] w-full rounded-lg object-cover ring-1 ring-white/10" />
								<span className="mt-1.5 block truncate text-xs font-bold text-gray-300">{r.t.title}</span>
								<span className="block truncate text-[11px] text-gray-500">{r.t.against ? `Heavy on ${r.t.against}` : `${r.t.match}% match`}</span>
							</Link>
						))}
					</div>
					{notYours.length > 8 && (
						<button type="button" onClick={() => setAllNot((a) => !a)} className="mt-4 flex items-center gap-1 text-sm font-bold text-gray-400 hover:text-white cursor-pointer">
							{allNot ? "Show fewer" : `Show all ${notYours.length}`}
							<ChevronDownIcon className={`h-4 w-4 transition-transform ${allNot ? "rotate-180" : ""}`} />
						</button>
					)}
				</Section>
			)}
		</Shell>
	)
}

// ---------------------------------------------------------------- 5. marquee (bolder)

function Marquee({ data }: { data: Payload }) {
	const d = useDiscover(data, { discover: "taste", search: "relevance" })
	const search = d.surface === "search"
	// Search: the hero is the best taste match among the eight closest results, never a weaker match.
	const pool = search ? d.ranked.filter((r) => r.t.rel < 8) : d.ranked
	const pick = (search ? [...pool].sort((a, b) => (b.t.pct ?? -1) - (a.t.pct ?? -1))[0] : pool[0])?.t
	const rest = d.ranked.filter((r) => r.t.ref !== pick?.ref)
	const rail = rest.slice(0, 12)
	const grid = rest.slice(12, 12 + 24)
	const hero = pick && (
		<div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] overflow-hidden" aria-hidden>
			<AnimatePresence mode="popLayout">
				<motion.img key={pick.ref} src={`https://image.tmdb.org/t/p/w1280${pick.backdrop_path}`} alt="" initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} exit={{ opacity: 0 }} transition={{ duration: 0.8 }} className="absolute inset-0 h-full w-full object-cover object-top" />
			</AnimatePresence>
			<div className="absolute inset-0 bg-linear-to-b from-gray-950/30 via-gray-950/80 to-gray-950" />
			<div className="absolute inset-0 bg-linear-to-r from-gray-950/85 to-transparent" />
		</div>
	)
	return (
		<Shell d={d} hero={hero}>
			{pick ? (
				<Link to={titleHref(pick)} prefetch="intent" className="group grid grid-cols-[112px_1fr] items-center gap-4 sm:items-end sm:grid-cols-[180px_1fr] sm:gap-7">
					<img src={posterUrl(pick.poster_path, "w500")} alt={pick.title} className="aspect-[2/3] w-full rounded-xl object-cover ring-1 ring-white/15 shadow-[0_30px_60px_-20px_rgba(0,0,0,.9)]" />
					<div className="min-w-0 pb-1">
						<p className="text-sm text-amber-300/90">{search ? `Your best bet for “${d.query.q}”` : "Your best match right now"}</p>
						<h2 className="mt-1 brand-header text-3xl leading-tight text-white sm:text-5xl group-hover:text-amber-100">{pick.title}</h2>
						<p className="mt-1 text-sm text-gray-400">
							{pick.release_year}
							{pick.goodwatch_overall_score_normalized_percent != null && (
								<>
									{", "}
									<span className={`font-bold text-vibe-${goodwatchVibeIndex(pick.goodwatch_overall_score_normalized_percent)}`}>{Math.round(pick.goodwatch_overall_score_normalized_percent)}</span> GoodWatch score
								</>
							)}
							{pick.offers.length > 0 && `, on ${pick.offers[0].name}`}
						</p>
						<div className="mt-4 flex items-end gap-4">
							<span className="flex items-baseline gap-1.5 text-amber-400">
								<span className="brand-header text-6xl leading-none sm:text-7xl tabular-nums">{pick.match ?? "–"}</span>
								<span className="text-sm font-bold">match</span>
							</span>
							<span className="hidden min-w-0 max-w-md pb-1.5 text-base leading-snug text-gray-200 sm:block">{sentenceFor(pick)}</span>
						</div>
						<p className="mt-3 text-sm leading-snug text-gray-300 sm:hidden">{sentenceFor(pick)}</p>
					</div>
				</Link>
			) : (
				<Recover d={d} className="py-12" />
			)}
			{rail.length > 0 && (
				<section className="mt-12">
					<h2 className="brand-header text-2xl text-white">{search ? "Next closest, ordered for you" : "Next for you"}</h2>
					<div className="-mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
						{rail.map((r) => (
							<PosterLink key={r.t.ref} t={r.t} size="w342" className="w-40 shrink-0 snap-start sm:w-52">
								<span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-linear-to-t from-black/95 via-black/60 to-transparent px-3 pb-2.5 pt-16">
									<span className="min-w-0 pr-2 text-sm font-bold leading-tight text-white">{r.t.title}</span>
									<span className="brand-header text-3xl leading-none text-amber-400 tabular-nums">{r.t.match ?? ""}</span>
								</span>
							</PosterLink>
						))}
					</div>
				</section>
			)}
			{grid.length > 0 && (
				<section className="mt-10">
					<h2 className="brand-header text-2xl text-gray-300">{search ? "More results" : "More to discover"}</h2>
					<ResultGrid d={d} items={grid} className={`mt-4 ${GRID}`} />
				</section>
			)}
		</Shell>
	)
}

const sentenceFor = (t: DiscTitle) => {
	const why = whyText(t)
	const parts = [why ? `${why.charAt(0).toUpperCase()}${why.slice(1)}` : null, t.like ? `close to ${t.like.title}, which you rated ${t.like.score}` : null].filter(Boolean)
	return parts.length ? `${parts.join(", ")}.` : "Close to what you rate highly."
}

// ---------------------------------------------------------------- 6. strip (bolder)

function Strip({ data }: { data: Payload }) {
	const d = useDiscover(data, { discover: "taste", search: "relevance" })
	const top = d.data.top
	return (
		<Shell d={d}>
			<div className="mb-5 rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:p-5">
				<p className="flex items-center gap-2 text-sm text-gray-400">
					<FingerPrintIcon className="h-4 w-4 text-amber-500" />
					Your strongest pulls, measured on every title below
				</p>
				<div className="mt-3 flex flex-wrap gap-2">
					{top.map((a) => (
						<span key={a.key} className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-sm text-amber-100 ring-1 ring-amber-500/25">
							<span aria-hidden>{a.emoji}</span>
							{a.label}
						</span>
					))}
				</div>
			</div>
			<div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
				<AnimatePresence initial={false} mode="popLayout">
					{d.ranked.slice(0, 30).map((r) => (
						<motion.div key={r.t.ref} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="min-w-0">
							<StripRow t={r.t} d={d} />
						</motion.div>
					))}
				</AnimatePresence>
			</div>
			{d.bar.recoveries.length > 0 && <Recover d={d} className="mt-6" />}
		</Shell>
	)
}

function StripRow({ t, d }: { t: DiscTitle; d: Disc }) {
	const top = d.data.top
	const score = t.goodwatch_overall_score_normalized_percent
	return (
		<Link to={titleHref(t)} prefetch="intent" className="group flex gap-4 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:ring-amber-500/30">
			<img src={posterUrl(t.poster_path, "w185")} alt="" loading="lazy" className="aspect-[2/3] w-[84px] shrink-0 rounded-lg object-cover sm:w-[104px]" />
			<div className="flex min-w-0 flex-1 flex-col">
				<div className="flex items-start gap-3">
					<div className="min-w-0 flex-1">
						<h3 className="truncate text-base font-bold text-white sm:text-lg">{t.title}</h3>
						<p className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
							{t.release_year}
							{score != null && <span className={`rounded px-1.5 py-px text-[11px] font-bold text-white bg-vibe-${goodwatchVibeIndex(score)}`}>{Math.round(score)}</span>}
							{t.offers.slice(0, 3).map((o) => (
								<img key={o.id} src={`https://www.themoviedb.org/t/p/original${o.logo}`} alt={o.name} className={`h-4 w-4 rounded ${d.data.mine.includes(o.id) ? "" : "opacity-40 grayscale"}`} />
							))}
						</p>
					</div>
					<span className="flex shrink-0 flex-col items-end leading-none">
						<span className="brand-header text-3xl text-amber-400 tabular-nums sm:text-4xl">{t.match ?? "–"}</span>
						<span className="mt-0.5 text-[10px] text-gray-500">match</span>
					</span>
				</div>
				{t.hits.length > 0 ? (
					<div className="mt-auto grid grid-cols-5 gap-1.5 pt-3">
						{top.map((a, i) => {
							const v = t.hits[i] ?? 0
							return (
								<div key={a.key} title={`${a.label}: ${v} of 10`} className="min-w-0">
									<div className="flex h-10 items-end overflow-hidden rounded-[4px] bg-white/[0.06]">
										<motion.div initial={false} animate={{ height: `${v * 10}%` }} transition={SPRING_SOFT} className={`w-full ${v >= 7 ? "bg-amber-400" : v >= 4 ? "bg-amber-700" : "bg-white/15"}`} />
									</div>
									<span className="mt-1 block truncate text-[10px] text-gray-500">
										<span aria-hidden>{a.emoji}</span> {a.label}
									</span>
								</div>
							)
						})}
					</div>
				) : (
					<p className="mt-auto pt-3 text-xs text-gray-500">No title analysis yet, so no match.</p>
				)}
				{t.against && <p className="mt-1.5 truncate text-[11px] text-gray-500">Heavy on {t.against}, which you usually tune out</p>}
			</div>
		</Link>
	)
}

const SPRING_SOFT = { type: "spring", stiffness: 260, damping: 30 } as const

// ---------------------------------------------------------------- registry

export type Variant = { name: string; style: "existing" | "bolder"; pitch: string; View: (p: { data: Payload }) => JSX.Element }

export const VARIANTS: Record<string, Variant> = {
	badge: {
		name: "Match coin on every card",
		style: "existing",
		pitch: "The order stays what it is today. Every card gets an amber taste coin under its score tab; For you is one more sort.",
		View: Badge,
	},
	blend: {
		name: "Taste blended into the order",
		style: "existing",
		pitch: "The default order leans on your taste, with a visible strength from Off to Full. Cards show the match bar and how far taste moved them.",
		View: Blend,
	},
	because: {
		name: "Because you liked",
		style: "existing",
		pitch: "Sorted for you, and every card says why: the closest title you rated highly, and the fingerprint traits that pull.",
		View: Because,
	},
	split: {
		name: "For you, then not your thing",
		style: "existing",
		pitch: "The same list in three groups: for you, the rest in today's order, and popular titles far from your taste, pushed aside.",
		View: Split,
	},
	marquee: {
		name: "Best match as the hero",
		style: "bolder",
		pitch: "Your best match lights the page, then a rail of the next ones with big match numbers, then everything else.",
		View: Marquee,
	},
	strip: {
		name: "Your fingerprint on every title",
		style: "bolder",
		pitch: "Rows instead of a grid: each title measured on your five strongest taste traits, so the match explains itself.",
		View: Strip,
	},
}

