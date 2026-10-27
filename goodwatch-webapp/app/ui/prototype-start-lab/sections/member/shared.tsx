// PROTOTYPE (start page lab): parts the member start variants share: the member's lists read tolerantly from the
// fixture, the tonight pick, poster rows and grids, the Hot board, and an anchor that finds the room's TV.
import { PlayIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { type ReactNode, useLayoutEffect, useRef, useState } from "react"
import type { TalkedRow } from "~/domain/talked-about-now"
import "~/ui/living-room/living-room.css"
import StartRow from "~/ui/talked-about-now/start-row/StartRow"
import "~/ui/talked-about-now/start-row/start-row.css"
import { TitlePosterCard } from "~/ui/title-card/TitlePosterCard"
import { DISPLAY, WRAP } from "~/ui/watch-next/style"
import { titleHref, tmdbImage } from "../../lab/kit"
import { coverFit, quadBounds, quadToBox } from "../../scene/homography"
import { pickMeta } from "../../scene/SceneStage"
import { type LabCard, type LabData, useLab, type Rect } from "../../lab/types"

export { DISPLAY, WRAP }

export const HREF = {
	shows: "/my-shows",
	movies: "/my-movies",
	watchNext: "/watch-next",
	forYou: "/for-you",
	hot: "/hot-on-socials",
	discover: "/discover",
}

// ---------------------------------------------------------------------------------------------------------
// The member's data, read tolerantly (the fixture's shapes vary with how it was captured)
// ---------------------------------------------------------------------------------------------------------

export type ShowCard = LabCard & { next?: unknown }

const obj = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" ? (v as Record<string, unknown>) : null)
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null)
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null)

/** "S2 E1" for a next episode in any of the shapes the fixture may hold. */
export function episodeCode(next: unknown): string | null {
	const n = obj(next)
	if (!n) return null
	const code = str(n.code)
	if (code) return code
	const s = num(n.season ?? n.season_number ?? n.seasonNumber)
	const e = num(n.number ?? n.episode ?? n.episode_number ?? n.episodeNumber)
	return s != null && e != null ? `S${s} E${e}` : null
}

export function episodeName(next: unknown): string | null {
	const n = obj(next)
	const name = n ? str(n.name ?? n.title) : null
	return name && !/^episode \d+$/i.test(name) ? name : null
}

/** "S2 E1 · Last Chance for a Slow Dance", or null. */
export function episodeLine(next: unknown): string | null {
	const code = episodeCode(next)
	const name = episodeName(next)
	return code ? (name ? `${code} · ${name}` : code) : name
}

const sectionKey = (name: string) => name.toLowerCase().replace(/[^a-z]/g, "")

export type Tonight = {
	card: LabCard
	/** "Next episode" or "From your Wishlist". */
	why: string
	episode: string | null
	service: { name: string; logo: string | null } | null
}

function tonightOf(data: LabData, cont: ShowCard[]): Tonight | null {
	const m = data.member
	if (!m) return null
	const raw = obj(m.tonightRaw)
	const pick = obj(raw?.pick) ?? raw
	const card = m.tonight[0] ?? cont[0] ?? m.wishlistMovies[0] ?? m.forYou[0]
	if (!card) return null
	const reason = str(pick?.reason ?? raw?.reason)
	const fromShows = cont.find((s) => s.key === card.key)
	const episode = episodeLine(pick?.episode ?? raw?.episode) ?? (fromShows ? episodeLine(fromShows.next) : null)
	const offers = obj(obj(obj(pick?.title)?.availability))?.offers
	const offer = Array.isArray(offers) ? obj(offers[0]) : null
	const svc = card.services?.[0]
	const service = offer
		? { name: String(offer.name ?? ""), logo: str(offer.logo_url) }
		: svc
			? { name: svc.name, logo: svc.logo_path ? `https://image.tmdb.org/t/p/w92${svc.logo_path}` : null }
			: null
	const why =
		reason === "nextEpisode" || episode
			? "Next episode"
			: card.media_type === "movie"
				? "From your movies"
				: "From your Wishlist"
	return { card, why, episode, service: service?.name ? service : null }
}

/** Talked-about titles as poster cards, for shelves and grids. */
export function talkedCards(row: TalkedRow | null): LabCard[] {
	if (!row) return []
	return row.titles
		.filter((t) => t.poster)
		.map(
			(t) =>
				({
					key: (t.mediaType === "movie" ? 1e12 : 2e12) + t.tmdbId,
					tmdb_id: t.tmdbId,
					media_type: t.mediaType,
					title: t.title,
					poster_path: t.poster,
					backdrop_path: t.backdrop,
					release_year: t.year,
					runtime: null,
					tagline: null,
					goodwatch_overall_score_normalized_percent: null,
					goodwatch_overall_score_voting_count: null,
					match: null,
					reasons: [],
					services: null,
					seen: false,
					wantToSee: false,
					notInterested: false,
					rating: null,
				}) as unknown as LabCard,
		)
}

export type Member = {
	name: string
	tonight: Tonight | null
	/** Shows with a next episode to watch: Continue, then Pick up. */
	continueShows: ShowCard[]
	waiting: ShowCard[]
	movies: LabCard[]
	forYou: LabCard[]
	forYouShows: LabCard[]
	hot: LabCard[]
	popular: LabCard[]
	talked: TalkedRow | null
}

export function useMember(): Member {
	const { data } = useLab()
	const m = data.member
	const shows = m?.shows ?? []
	const of = (...keys: string[]) =>
		shows.filter((s) => keys.some((k) => sectionKey(s.name).startsWith(k))).flatMap((s) => s.titles)
	let continueShows = of("continue", "watching", "inprogress")
	const pickUp = of("pickup", "pick")
	const waiting = of("waiting", "upcoming")
	if (!continueShows.length && !pickUp.length && shows[0]) continueShows = shows[0].titles
	const seen = new Set<number>()
	const uniq = <T extends LabCard>(list: T[]) => list.filter((c) => (seen.has(c.key) ? false : (seen.add(c.key), true)))
	const cont = uniq([...continueShows, ...pickUp])
	return {
		name: m?.name ?? "Sam",
		tonight: tonightOf(data, cont),
		continueShows: cont,
		waiting: waiting.filter((c) => !cont.some((x) => x.key === c.key)),
		movies: m?.wishlistMovies ?? [],
		forYou: m?.forYou ?? [],
		forYouShows: m?.forYouShows ?? [],
		hot: talkedCards(data.talked),
		popular: data.guest.popular,
		talked: data.talked,
	}
}

/** Up next across both kinds: tonight's pick, the shows to continue, then the movies, interleaved. */
export function upNext(m: Member, limit = 12): LabCard[] {
	const out: LabCard[] = []
	const keys = new Set<number>()
	const add = (c: LabCard | undefined) => {
		if (c && !keys.has(c.key)) {
			keys.add(c.key)
			out.push(c)
		}
	}
	add(m.tonight?.card)
	for (let i = 0; out.length < limit && (i < m.continueShows.length || i < m.movies.length); i++) {
		add(m.continueShows[i])
		add(m.movies[i])
	}
	return out.slice(0, limit)
}

/** A fixed greeting: the time of day would differ between the server render and the browser. */
export const greeting = (name: string) => `Welcome back, ${name}`

// ---------------------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------------------

/** A section heading with its page's link: the name, a count line, and "See all". */
export function SectionHead({ title, note, href, link = "See all" }: { title: string; note?: string; href?: string; link?: string }) {
	return (
		<div className="mb-3 flex items-end justify-between gap-4">
			<div className="min-w-0">
				<h2 className={`${DISPLAY} text-2xl leading-tight text-white sm:text-3xl`}>{title}</h2>
				{note ? <p className="mt-0.5 truncate text-sm text-gray-400">{note}</p> : null}
			</div>
			{href ? (
				<Link to={href} prefetch="intent" className="shrink-0 rounded-md px-2 py-1 text-sm font-semibold text-amber-400 hover:bg-amber-400/10 hover:text-amber-300">
					{link} →
				</Link>
			) : null}
		</div>
	)
}

/** The site's poster card, with the next episode under it when the title is a show with one. */
export function Poster({ card, episode = true }: { card: LabCard | ShowCard; episode?: boolean }) {
	const line = episode ? episodeLine((card as ShowCard).next) : null
	return (
		<div className="min-w-0">
			<TitlePosterCard card={card} actions={false} />
			{line ? (
				<p className="mt-1.5 truncate text-xs font-semibold text-amber-300" title={line}>
					{line}
				</p>
			) : null}
		</div>
	)
}

/** A sideways row of poster cards that fits a desktop's width and scrolls on a phone. */
export function PosterRow({ cards, size = "md" }: { cards: LabCard[]; size?: "sm" | "md" }) {
	const w = size === "sm" ? "w-[6.5rem] sm:w-[8.5rem]" : "w-[8.5rem] sm:w-[10.5rem]"
	if (!cards.length) return <p className="text-sm text-gray-500">Nothing here yet.</p>
	return (
		<ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
			{cards.map((card) => (
				<li key={card.key} className={`shrink-0 snap-start ${w}`}>
					<Poster card={card} />
				</li>
			))}
		</ul>
	)
}

/** A tidy grid of poster cards: three across on a phone, six on a desktop. */
export function PosterGrid({ cards, limit = 12 }: { cards: LabCard[]; limit?: number }) {
	if (!cards.length) return <p className="text-sm text-gray-500">Nothing here yet.</p>
	return (
		<ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 lg:grid-cols-6">
			{cards.slice(0, limit).map((card) => (
				<li key={card.key} className="min-w-0">
					<Poster card={card} />
				</li>
			))}
		</ul>
	)
}

/** The Watch next hero's main button: the service's logo and "Watch on …", to the title page. */
export function WatchButton({ tonight, small = false }: { tonight: Tonight; small?: boolean }) {
	const s = tonight.service
	return (
		<Link
			to={titleHref(tonight.card)}
			className={`inline-flex items-center gap-2.5 rounded-lg bg-white font-bold text-black shadow-lg shadow-black/40 hover:bg-gray-200 ${small ? "h-10 pl-1.5 pr-4 text-sm" : "h-12 pl-2 pr-5 text-base"}`}
		>
			{s?.logo ? <img src={s.logo} alt="" className={`${small ? "h-7 w-7" : "h-8 w-8"} rounded-md`} /> : null}
			<PlayIcon className={`h-5 w-5 ${s?.logo ? "" : "ml-2"}`} aria-hidden />
			{s ? `Watch on ${s.name}` : "Where to watch"}
		</Link>
	)
}

/** The facts line under a pick's title: year, match, score. */
export function facts(card: LabCard) {
	return [
		card.release_year,
		card.match ? `${card.match}% taste match` : null,
		card.goodwatch_overall_score_normalized_percent
			? `GoodWatch score ${Math.round(card.goodwatch_overall_score_normalized_percent)}`
			: null,
	]
		.filter(Boolean)
		.join(" · ")
}

/** Hot on socials: the start page's own board, in the `.lrb` wrapper its styles need (no scroll lock). */
export function HotBoard({ row }: { row: TalkedRow | null }) {
	if (!row?.titles.length) return null
	return (
		<div className="lrb" style={{ background: "none", zIndex: "auto", color: "#a3a3a3" }}>
			<div className={WRAP}>
				<StartRow row={row} />
			</div>
		</div>
	)
}

/** A poster image only, for compact strips. */
export const posterSrc = (card: LabCard, size: "w185" | "w342" = "w185") => tmdbImage(card.poster_path, size)

/**
 * Put something next to the room's TV: a child of <Room/> that measures the room box and works out the TV's
 * rect the way the stage does (same focal, zoom and phone switch). `children(rect, box)` places it.
 */
export function TvAnchor({
	focal,
	zoom = 1,
	portraitBelow = 0.8,
	children,
}: {
	focal?: [number, number]
	zoom?: number
	portraitBelow?: number
	children: (tv: Rect, box: { w: number; h: number }) => ReactNode
}) {
	const { scene } = useLab()
	const ref = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState<{ w: number; h: number } | null>(null)
	useLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	let tv: Rect | null = null
	if (box) {
		const meta = pickMeta(scene, box.w / Math.max(1, box.h), portraitBelow)
		const fx = focal?.[0] ?? meta.tv.box[0] + meta.tv.box[2] / 2
		const fy = focal?.[1] ?? meta.tv.box[1] + meta.tv.box[3] / 2
		const cover = coverFit(box.w, box.h, meta.width, meta.height, fx, fy, zoom)
		tv = quadBounds(quadToBox(cover, meta.tv.quad))
	}
	return (
		<div ref={ref} className="pointer-events-none absolute inset-0">
			{tv && box ? children(tv, box) : null}
		</div>
	)
}

/** Two lists taken in turns (movies and shows), each title once. */
export function interleave(a: LabCard[], b: LabCard[]): LabCard[] {
	const out: LabCard[] = []
	const keys = new Set<number>()
	const add = (c: LabCard | undefined) => {
		if (c && !keys.has(c.key)) {
			keys.add(c.key)
			out.push(c)
		}
	}
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		add(a[i])
		add(b[i])
	}
	return out
}
