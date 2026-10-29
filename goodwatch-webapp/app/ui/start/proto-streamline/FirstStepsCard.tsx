// PROTOTYPE (start-streamline, round 6): designs for a new member's open card (nothing on any list yet), in place
// of FirstSteps. The same three ways in, with rating as the main one:
//
// - l Path: rating as the big step beside a fan of titles to rate; importing and Discover as two rows beside it.
// - r Wall: the start titles as a wall of posters behind one call to rate, with the two other ways as a line under it.
// - s Tiles: three tiles, each with its own picture (posters to rate, the import marks, the moods).
import { ArrowRightIcon, MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import type { CSSProperties } from "react"
import { MOODS } from "~/domain/moods"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import { assetUrl } from "~/utils/asset-url"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { MEMBER_HREF } from "../member/doors"
import { PERSONAL_AT } from "../member/member-data"
import type { ShelfTitle } from "../room/ShelfCovers"
import type { Flow } from "./ProtoSwitcher"

const RATE = {
	title: "Rate a few titles you've seen",
	line: `Picks get personal at ${PERSONAL_AT} ratings.`,
	cta: "Start rating",
	href: MEMBER_HREF.taste,
}
const BRING = {
	title: "Bring your ratings",
	line: "From IMDb, Letterboxd, Trakt, Plex and more.",
	cta: "Import",
	href: MEMBER_HREF.imports,
}
const FIND = {
	title: "Find something now",
	line: "Search by mood above, or browse Discover.",
	cta: "Open Discover",
	href: MEMBER_HREF.discover,
}

const LOGOS = IMPORT_SOURCE_LIST.filter((s) => s.logo).slice(0, 5)

export function FirstStepsCard({
	flow,
	ratings,
	posters,
}: {
	flow: Flow
	ratings: number
	posters: readonly ShelfTitle[]
}) {
	const shown = posters.filter((p) => p.poster_path)
	if (flow === "r") return <Wall ratings={ratings} posters={shown} />
	if (flow === "s") return <Tiles ratings={ratings} posters={shown} />
	return <Path ratings={ratings} posters={shown} />
}

function Path({ ratings, posters }: { ratings: number; posters: readonly ShelfTitle[] }) {
	return (
		<div className="pfs pfs-path">
			<Link to={RATE.href} prefetch="intent" className="pfs-hero">
				<span className="pfs-hero-words">
					<span className="pfs-kicker">Start here</span>
					<span className="pfs-big">{RATE.title}</span>
					<span className="pfs-line">{RATE.line}</span>
					<Bar have={ratings} />
					<span className="pfs-go">
						{RATE.cta}
						<ArrowRightIcon className="h-4 w-4" aria-hidden />
					</span>
				</span>
				<Fan posters={posters.slice(0, 5)} />
			</Link>
			<div className="pfs-side">
				<Link to={BRING.href} prefetch="intent" className="pfs-row">
					<Logos />
					<span className="pfs-row-words">
						<span className="pfs-row-title">{BRING.title}</span>
						<span className="pfs-row-line">{BRING.line}</span>
					</span>
					<ArrowRightIcon className="pfs-chev" aria-hidden />
				</Link>
				<Link to={FIND.href} prefetch="intent" className="pfs-row">
					<Moods />
					<span className="pfs-row-words">
						<span className="pfs-row-title">{FIND.title}</span>
						<span className="pfs-row-line">{FIND.line}</span>
					</span>
					<ArrowRightIcon className="pfs-chev" aria-hidden />
				</Link>
			</div>
		</div>
	)
}

function Wall({ ratings, posters }: { ratings: number; posters: readonly ShelfTitle[] }) {
	return (
		<div className="pfs pfs-wall">
			<div aria-hidden className="pfs-wall-grid">
				{posters.slice(0, 24).map((p, i) => (
					<img
						key={`${p.media_type}-${p.tmdb_id}`}
						src={tmdbImageUrl(p.poster_path as string, "w185")}
						alt=""
						decoding="async"
						style={{ "--i": i } as CSSProperties}
					/>
				))}
			</div>
			<div className="pfs-wall-words">
				<span className="pfs-kicker">Start here</span>
				<h2 className="pfs-big">{RATE.title}</h2>
				<p className="pfs-line">{RATE.line}</p>
				<Bar have={ratings} />
				<Link to={RATE.href} prefetch="intent" className="pfs-go pfs-go-big">
					{RATE.cta}
					<ArrowRightIcon className="h-5 w-5" aria-hidden />
				</Link>
				<div className="pfs-or">
					<Link to={BRING.href} prefetch="intent" className="pfs-or-link">
						<Logos />
						Import your ratings
					</Link>
					<Link to={FIND.href} prefetch="intent" className="pfs-or-link">
						<MagnifyingGlassIcon className="h-4 w-4 text-amber-300" aria-hidden />
						Browse Discover
					</Link>
				</div>
			</div>
		</div>
	)
}

function Tiles({ ratings, posters }: { ratings: number; posters: readonly ShelfTitle[] }) {
	return (
		<ol className="pfs pfs-tiles">
			<li>
				<Link to={RATE.href} prefetch="intent" className="pfs-tile" data-main="">
					<span className="pfs-pic">
						<Rated posters={posters.slice(0, 3)} />
					</span>
					<span className="pfs-tile-title">{RATE.title}</span>
					<span className="pfs-row-line">{RATE.line}</span>
					<Bar have={ratings} />
					<span className="pfs-go">
						{RATE.cta}
						<ArrowRightIcon className="h-4 w-4" aria-hidden />
					</span>
				</Link>
			</li>
			<li>
				<Link to={BRING.href} prefetch="intent" className="pfs-tile">
					<span className="pfs-pic">
						<Logos big />
					</span>
					<span className="pfs-tile-title">{BRING.title}</span>
					<span className="pfs-row-line">{BRING.line}</span>
					<span className="pfs-ghost">
						{BRING.cta}
						<ArrowRightIcon className="h-4 w-4" aria-hidden />
					</span>
				</Link>
			</li>
			<li>
				<Link to={FIND.href} prefetch="intent" className="pfs-tile">
					<span className="pfs-pic">
						<Moods big />
					</span>
					<span className="pfs-tile-title">{FIND.title}</span>
					<span className="pfs-row-line">{FIND.line}</span>
					<span className="pfs-ghost">
						{FIND.cta}
						<ArrowRightIcon className="h-4 w-4" aria-hidden />
					</span>
				</Link>
			</li>
		</ol>
	)
}

function Bar({ have }: { have: number }) {
	const n = Math.min(have, PERSONAL_AT)
	return (
		<span className="pfs-bar">
			<span aria-hidden className="pfs-bar-track">
				<span style={{ transform: `scaleX(${n / PERSONAL_AT})` }} />
			</span>
			<span className="pfs-bar-text">
				{n} of {PERSONAL_AT}
			</span>
		</span>
	)
}

function Fan({ posters }: { posters: readonly ShelfTitle[] }) {
	const mid = (posters.length - 1) / 2
	return (
		<span aria-hidden className="pfs-fan">
			{posters.map((p, i) => (
				<img
					key={`${p.media_type}-${p.tmdb_id}`}
					src={tmdbImageUrl(p.poster_path as string, "w185")}
					alt=""
					decoding="async"
					style={{ "--d": i - mid, zIndex: 10 - Math.abs(Math.round(i - mid)) } as CSSProperties}
				/>
			))}
		</span>
	)
}

/** Three posters with the score a tap gives them. */
function Rated({ posters }: { posters: readonly ShelfTitle[] }) {
	const scores = [8, 6, 9]
	return (
		<span aria-hidden className="pfs-rated">
			{posters.map((p, i) => (
				<span key={`${p.media_type}-${p.tmdb_id}`} className="pfs-rated-c" style={{ "--d": i - 1 } as CSSProperties}>
					<img src={tmdbImageUrl(p.poster_path as string, "w185")} alt="" decoding="async" />
					<b>{scores[i]}</b>
				</span>
			))}
		</span>
	)
}

function Logos({ big = false }: { big?: boolean }) {
	return (
		<span aria-hidden className="pfs-logos" data-big={big ? "" : undefined}>
			{LOGOS.map((s) => (
				<span key={s.id} className="pfs-logo" data-id={s.id}>
					<img src={assetUrl(s.logo as string)} alt="" />
				</span>
			))}
		</span>
	)
}

function Moods({ big = false }: { big?: boolean }) {
	return (
		<span aria-hidden className="pfs-moods" data-big={big ? "" : undefined}>
			{MOODS.slice(0, big ? 6 : 4).map((m) => (
				<span key={m.key} className="pfs-mood" style={{ "--h": m.hue } as CSSProperties}>
					{big ? m.name : null}
				</span>
			))}
		</span>
	)
}
