// "Talked about now" (#557, variant E of #541): the titles read about most against their own usual, and what is
// said about them. A board of eight, each with its 14-day curve, "×N its usual" and a one-line preview of what is
// said; one of them is featured, large, with its curve and up to three pieces as they are on their platforms.
// Pressing a row features that title. From 1024 px the featured title stands beside the board, as tall as it (the
// two stretch to the taller one); below that it opens in the board, under its row.
//
// Loaded on its own (StartRowSlot.tsx), with its own stylesheet: nothing of it is in the start page's first
// view. The same for every visitor; the data is the row's request (/api/talked-about-now).
import {
	canonicalMediaTitle,
	mediaFieldLanguage,
} from "~/utils/media-presentation"
import MediaText from "~/ui/media-text/MediaText"
import { Link } from "@remix-run/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import {
	type TalkedReason,
	type TalkedRow,
	type TalkedTitle,
	compact,
	liftLabel,
	previewOf,
	reasonLabel,
} from "~/domain/talked-about-now"
import { startTitleHref } from "~/ui/living-room/BelowRoom"
import { NativeItems, Platform, SourceMark } from "./Items"
import { Spark, dateLabel } from "./Spark"
import type { TalkedQuery } from "./StartRowSlot"
import "./start-row.css"
import "./prototype-home.css"
import { useSearchParams } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { HOME_VARIANTS, HomeVariant } from "./PrototypeHomeVariants"

export const tmdb = (path: string, size: string) =>
	`https://image.tmdb.org/t/p/${size}${path}`

export const hrefOf = (title: TalkedTitle) =>
	startTitleHref({
		media_type: title.mediaType,
		tmdb_id: title.tmdbId,
		title: canonicalMediaTitle(title),
	})

const WIDE = "(min-width: 1024px)"

function useWide() {
	const [wide, setWide] = useState(
		() => typeof window !== "undefined" && window.matchMedia(WIDE).matches,
	)
	useEffect(() => {
		const query = window.matchMedia(WIDE)
		const update = () => setWide(query.matches)
		query.addEventListener("change", update)
		return () => query.removeEventListener("change", update)
	}, [])
	return wide
}

/** The box's width, once measured: the featured curve fills its card at every window size. */
function useWidth(fallback: number) {
	const ref = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(fallback)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(() =>
			setWidth(Math.max(Math.round(el.clientWidth), 80)),
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])
	return [ref, width] as const
}

const REASON_ICON: Record<TalkedReason["kind"], string> = {
	trailer: "M5 3.5v9l7-4.5z",
	new_season: "M3 6h10M3 9.5h10M3 13h10M5 3h6",
	new_release: "M2.5 5.5h11v2a1.5 1.5 0 000 3v2h-11v-2a1.5 1.5 0 000-3z",
	netflix_top10: "M4 13V3l8 10V3",
}

export function ReasonIcon({ kind }: { kind: TalkedReason["kind"] }) {
	return (
		<svg viewBox="0 0 16 16" className="tn-icon" aria-hidden="true">
			<path
				d={REASON_ICON[kind]}
				fill={kind === "trailer" ? "currentColor" : "none"}
				stroke={kind === "trailer" ? "none" : "currentColor"}
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	)
}

/** Up, down or new since the day before. Color is never alone: an arrow or the word says it too. */
export function Move({ move }: { move: TalkedTitle["move"] }) {
	if (move === null) return null
	if (move === "new") return <span className="tn-new">NEW</span>
	if (move === 0)
		return (
			<span className="tn-move" title="Same place as the day before">
				=
			</span>
		)
	const up = move > 0
	return (
		<span
			className={`tn-move${up ? " tn-up" : ""}`}
			title={`${up ? "Up" : "Down"} ${Math.abs(move)} since the day before`}
		>
			{up ? "▲" : "▼"}
			{Math.abs(move)}
		</span>
	)
}

/** The board row's second line: the reason and its day, or how many read about it. */
export function why(title: TalkedTitle) {
	if (title.reason)
		return `${reasonLabel(title.reason, title.mediaType)} · ${dateLabel(title.reason.day)}`
	return `${compact(title.views)} Wikipedia reads in a day`
}

export function Preview({ title }: { title: TalkedTitle }) {
	const pick = previewOf(title.items)
	if (!pick) return null
	return (
		<span className="tn-preview">
			<span className="tn-marks" aria-hidden="true">
				{title.items.map((item) => (
					<SourceMark key={item.id} source={item.source} />
				))}
			</span>
			<span className="tn-preview-text">
				{pick.source === "rss" ? (
					<>
						<b>{pick.publisher}</b> {pick.text}
					</>
				) : pick.source === "youtube" ? (
					<>
						<b>{pick.author}</b> {pick.text}
					</>
				) : (
					<>
						<i>“{pick.text}”</i> <small>{pick.author}</small>
					</>
				)}
			</span>
		</span>
	)
}

export function Featured({ title, day }: { title: TalkedTitle; day: string }) {
	const [box, width] = useWidth(300)
	const video = title.items.some((item) => item.source === "youtube")
	const head = (
		<>
			<p className="tn-rank">
				#{title.rank} talked about <Move move={title.move} />
			</p>
			<Link to={hrefOf(title)} discover="none" className="tn-name">
				<MediaText
					value={{
						text: title.title,
						lang: mediaFieldLanguage(title, "title"),
					}}
				/>
			</Link>
			<p className="tn-kind">
				{title.mediaType === "movie" ? "Movie" : "TV show"}
				{title.year ? ` · ${title.year}` : ""}
			</p>
		</>
	)
	return (
		<article className="tn-lead">
			{/* With a video the trailer's picture is the title's backdrop already: the head stands on a faint one. */}
			<div className={video ? "tn-lead-head tn-faint" : "tn-lead-head"}>
				{title.backdrop && (
					<img src={tmdb(title.backdrop, "w780")} alt="" loading="lazy" />
				)}
				<div>{head}</div>
			</div>
			<div className="tn-lead-body">
				<p className="tn-why">
					{title.reason && (
						<span className={`tn-chip tn-chip-${title.reason.kind}`}>
							<ReasonIcon kind={title.reason.kind} />
							{reasonLabel(title.reason, title.mediaType)}
						</span>
					)}
					<span>
						{compact(title.views)} Wikipedia reads on {dateLabel(day)}, against{" "}
						{compact(title.usual)} on a usual day
					</span>
				</p>
				<div className="tn-buzz">
					<div>
						<p className="tn-label">Reading, {title.curve.length} days</p>
						<p className="tn-lift">
							{liftLabel(title.lift)}
							<small>its usual</small>
						</p>
						{title.reason && (
							<p className="tn-when">
								<ReasonIcon kind={title.reason.kind} />
								{reasonLabel(title.reason, title.mediaType)},{" "}
								{dateLabel(title.reason.day)}
							</p>
						)}
					</div>
					<div ref={box} className="tn-buzz-curve">
						<Spark title={title} day={day} width={width} height={64} hover />
					</div>
				</div>
				{title.items.length > 0 && (
					<div className="tn-said">
						<p className="tn-label tn-rule">What is said about it</p>
						<NativeItems items={title.items} still={title.backdrop} />
					</div>
				)}
			</div>
		</article>
	)
}

function Board({ row }: { row: TalkedRow }) {
	const [lead, setLead] = useState(0)
	const wide = useWide()
	const featured = row.titles[lead] ?? row.titles[0]
	const sources = [
		...new Set(row.titles.flatMap((t) => t.items.map((i) => i.source))),
	]
	return (
		<section aria-labelledby="tn-title" className="tn">
			<header className="tn-top">
				<div>
					<p className="lrb-eye">Talked about now</p>
					<h2 id="tn-title">Hot on socials</h2>
				</div>
				{sources.length > 0 && (
					<p className="tn-sources">
						{sources.map((source) => (
							<Platform key={source} source={source} />
						))}
					</p>
				)}
			</header>
			<div className="tn-grid">
				{wide && (
					<Featured key={featured.tmdbId} title={featured} day={row.day} />
				)}
				<ol className="tn-board">
					{row.titles.map((title, i) => (
						<li key={`${title.mediaType}-${title.tmdbId}`}>
							<button
								type="button"
								onClick={() => setLead(i)}
								aria-pressed={lead === i}
								className="tn-row"
							>
								<b className="tn-n">{title.rank}</b>
								{title.poster ? (
									<img
										src={tmdb(title.poster, "w92")}
										alt=""
										width={34}
										height={51}
										loading="lazy"
									/>
								) : (
									<span className="tn-noposter" />
								)}
								<span className="tn-row-text">
									<b className="tn-row-title">
										<span>
											<MediaText
												value={{
													text: title.title,
													lang: mediaFieldLanguage(title, "title"),
												}}
											/>
										</span>
										<Move move={title.move} />
									</b>
									<span className="tn-row-why">
										{title.reason && <ReasonIcon kind={title.reason.kind} />}
										<span>{why(title)}</span>
									</span>
									<Preview title={title} />
								</span>
								<span className="tn-row-spark">
									<Spark title={title} day={row.day} width={96} height={34} />
								</span>
								<span className="tn-row-lift">
									<span className="tn-row-spark-small">
										<Spark
											title={title}
											day={row.day}
											width={56}
											height={22}
											mark={false}
										/>
									</span>
									<b>{liftLabel(title.lift)}</b>
								</span>
							</button>
							{!wide && lead === i && (
								<div className="tn-inline">
									<Featured title={title} day={row.day} />
								</div>
							)}
						</li>
					))}
				</ol>
			</div>
		</section>
	)
}

export default function StartRow({ query }: { query: TalkedQuery }) {
	const { data, isPending } = useQuery(query)
	const [params] = useSearchParams()
	// While it loads, the row holds about its place, so the titles below don't jump when it comes.
	if (isPending) return <div className="tn-wait" aria-hidden />
	if (!data?.titles.length) return null
	// PROTOTYPE - throwaway: ?variant=A|B|C, or 0 for the row as it is on main.
	const variant = params.get("variant") ?? "A"
	return (
		<>
			{variant === "0" ? <Board row={data} /> : <HomeVariant row={data} variant={variant} />}
			<PrototypeSwitcher variants={{ ...HOME_VARIANTS, 0: "Current row (main)" }} />
		</>
	)
}
