// The /how-it-works pictures: one still composition per feature, built from the start page intro's parts (brand
// cards, the score ring, service logos, posters, feeling words, search reading chips, islands, import marks) and the
// intro's data (/api/intro). Loaded on demand (FeaturePicture.tsx), so neither this code nor the intro's styles are
// on the page's first load. Each picture mounts as it scrolls into view; its parts rise in one after another, then
// it holds. Transform and opacity only.
import "~/ui/living-room/intro/intro.css"
import "./how-it-works.css"
import type { CSSProperties, ReactNode } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import type { IntroCard, IslandsData } from "~/ui/living-room/intro/data"
import { BrandCard } from "~/ui/living-room/intro/parts/brand-cards"
import { Poster, picks } from "~/ui/living-room/intro/parts/feed-kit"
import { famous, feelData, img } from "~/ui/living-room/intro/parts/feeling-kit"
import { avatarFeel } from "~/ui/living-room/intro/parts/feelings-zoom"
import { Island } from "~/ui/living-room/intro/parts/island-kit"
import { BlobDefs, Logo, mapData } from "~/ui/living-room/intro/parts/map-kit"
import {
	Ring,
	score,
	scoreTitle,
	verdictOf,
	vibeColor,
} from "~/ui/living-room/intro/parts/score-kit"
import { ReadChip } from "~/ui/living-room/intro/parts/search-kit"
import { Stage } from "~/ui/living-room/intro/player"
import type { IntroData } from "~/ui/living-room/intro/scene"
import { filterData } from "~/ui/living-room/intro/scenes/filters"
import type { PictureId } from "./features"

/** A part that rises in as its picture shows: `i` staggers it. */
const R = ({
	i = 0,
	className = "",
	style,
	children,
}: {
	i?: number
	className?: string
	style?: CSSProperties
	children: ReactNode
}) => (
	<div
		className={`hiw-pic-rise ${className}`}
		style={{ "--i": i, ...style } as CSSProperties}
	>
		{children}
	</div>
)

// ---------------------------------------------------------------------------------------------------------------

function ScorePicture({ data }: { data: IntroData }) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	const pct = score(card)
	return (
		<div className="hiw-pic-row hiw-pic-score">
			<div className="hiw-pic-fan">
				{sources.map((s, i) => (
					<div
						key={s.id}
						className="hiw-pic-fan-card"
						style={
							{
								"--r": `${(i - 2) * 7}deg`,
								"--x": `${(i - 2) * 8.5}cqw`,
								"--y": `${Math.abs(i - 2) * 1.6}cqw`,
							} as CSSProperties
						}
					>
						<R i={i * 0.7}>
							<BrandCard s={s} />
						</R>
					</div>
				))}
			</div>
			<R i={6} className="hiw-pic-eq">
				=
			</R>
			<div className="hiw-pic-ring-col">
				<R i={6} className="hiw-pic-small">
					{card.title}
				</R>
				<R i={7} className="hiw-pic-ring">
					<Ring percent={pct} fillAt={900} numberAt={1700} />
				</R>
				<R i={9} className="hiw-pic-verdict" style={{ color: vibeColor(pct) }}>
					{verdictOf(pct)}.
				</R>
			</div>
		</div>
	)
}

function StreamingPicture({ data }: { data: IntroData }) {
	const a = mapData(data)
	if (!a) return null
	const logos = [...a.popular, ...a.wall].slice(0, 28)
	return (
		<div className="hiw-pic-row hiw-pic-streaming">
			<div className="hiw-pic-count">
				<R i={0} className="hiw-pic-big">
					{a.serviceCount}
				</R>
				<R i={1} className="hiw-pic-label">
					streaming services
				</R>
				<R i={2} className="hiw-pic-label hiw-pic-dim">
					in {a.countryCount} countries
				</R>
			</div>
			<div className="hiw-pic-logos">
				{logos.map((s, i) => (
					<R
						key={s.id}
						i={2 + (i % 7) * 0.6 + Math.floor(i / 7) * 0.8}
						className={i < a.popular.length ? "" : "hiw-pic-faint"}
					>
						<Logo s={s} w={6.2} />
					</R>
				))}
			</div>
		</div>
	)
}

function ForYouPicture({ data }: { data: IntroData }) {
	const p = (data.extra.pick ?? null) as {
		loved: number[]
		pick: number | null
		match: number | null
	} | null
	const byKey = (k: number | null) =>
		data.pool.find((c) => Number(c.key) === k) ?? null
	const loved = (p?.loved ?? []).map(byKey).filter(Boolean) as IntroCard[]
	const pick = byKey(p?.pick ?? null)
	if (!pick) return null
	return (
		<div className="hiw-pic-row hiw-pic-foryou">
			<div className="hiw-pic-col">
				<R i={0} className="hiw-pic-small">
					Because you loved
				</R>
				<div className="hiw-pic-posters">
					{loved.map((c, i) => (
						<R key={c.key} i={1 + i}>
							<Poster path={c.poster_path} className="hiw-pic-p-sm" />
						</R>
					))}
				</div>
			</div>
			<R i={3} className="hiw-pic-eq">
				<span className="hiw-pic-arrow">→</span>
			</R>
			<div className="hiw-pic-col hiw-pic-pick">
				<R i={4}>
					<Poster
						path={pick.poster_path}
						size="w500"
						className="hiw-pic-p-lg hiw-pic-chosen"
					/>
				</R>
			</div>
			{p?.match != null && (
				<div className="hiw-pic-col hiw-pic-match">
					<R i={6} className="hiw-pic-big">
						{p.match}%
					</R>
					<R i={7} className="hiw-pic-label">
						your taste
					</R>
				</div>
			)}
		</div>
	)
}

function FeelPicture({ data }: { data: IntroData }) {
	const f = avatarFeel(data)
	if (!f) return null
	return (
		<div className="hiw-pic-bleed">
			<img
				src={img(f.hero.backdrop_path, "w1280")}
				alt=""
				className="hiw-pic-backdrop"
			/>
			<div className="hiw-pic-shade" />
			<div className="hiw-pic-row hiw-pic-on-top">
				<R i={0}>
					<Poster
						path={f.card.poster_path}
						size="w500"
						className="hiw-pic-p-lg"
					/>
				</R>
				<div className="hiw-pic-words">
					<R i={1} className="hiw-pic-small">
						How {f.hero.title} feels
					</R>
					{f.words.map((w, i) => (
						<R key={w.key} i={2 + i} className="hiw-pic-word">
							<span className="hiw-pic-emoji" aria-hidden="true">
								{w.emoji}
							</span>{" "}
							{w.word}.
						</R>
					))}
				</div>
			</div>
		</div>
	)
}

function SearchPicture({ data }: { data: IntroData }) {
	const s = feelData(data)?.searches.space
	if (!s) return null
	const chips = s.reading.filter((c) => c.kind !== "phrase").slice(0, 5)
	const top = famous(s.titles, 5, { minScore: 60 })
	return (
		<div className="hiw-pic-stack">
			<R i={0} className="hiw-pic-field">
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle
						cx="11"
						cy="11"
						r="6.5"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.2"
					/>
					<path
						d="M16 16l4.5 4.5"
						stroke="currentColor"
						strokeWidth="2.2"
						strokeLinecap="round"
					/>
				</svg>
				<span>{s.q}</span>
			</R>
			<div className="hiw-pic-chips">
				{chips.map((c, i) => (
					<R key={c.text} i={1 + i * 0.6}>
						<ReadChip chip={c} ms={0} />
					</R>
				))}
			</div>
			<div className="hiw-pic-posters">
				{top.map((t, i) => (
					<R key={t.key} i={4 + i * 0.5} className="hiw-pic-scored">
						<Poster path={t.poster} className="hiw-pic-p-md" />
						{t.score != null && (
							<span
								className="hiw-pic-badge"
								style={{ background: vibeColor(t.score) }}
							>
								{t.score}
							</span>
						)}
					</R>
				))}
			</div>
		</div>
	)
}

const SWITCH_TONES = ["#22c55e", "#3b82f6", "#fb923c", "#f59e0b", "#22c55e"]

function FiltersPicture({ data }: { data: IntroData }) {
	const d = filterData(data)
	if (!d) return null
	const steps = d.steps.slice(1)
	const switches = [
		...steps.filter((s) => s.kind !== "score"),
		...steps.filter((s) => s.kind === "score").slice(-1),
	]
	const last = steps[steps.length - 1]
	return (
		<div className="hiw-pic-row hiw-pic-filters">
			<div className="hiw-pic-switches">
				{switches.map((s, i) => (
					<R
						key={s.id}
						i={i}
						className="hiw-pic-switch"
						style={{ "--c": SWITCH_TONES[i] } as CSSProperties}
					>
						<span>
							{s.kind === "score"
								? `GoodWatch score ${s.score ?? 80}+`
								: s.label}
						</span>
						<i />
					</R>
				))}
			</div>
			<div className="hiw-pic-col">
				<R i={5} className="hiw-pic-big">
					{last.total.toLocaleString("en-US")}
				</R>
				<R i={6} className="hiw-pic-label">
					for tonight
				</R>
				<div className="hiw-pic-posters">
					{last.titles
						.filter((t) => t.poster)
						.slice(0, 3)
						.map((t, i) => (
							<R key={t.key} i={7 + i * 0.5}>
								<Poster path={t.poster} className="hiw-pic-p-sm" />
							</R>
						))}
				</div>
			</div>
		</div>
	)
}

function ExplorerPicture({ data }: { data: IntroData }) {
	const x = (data.extra.islands ?? null) as IslandsData | null
	const two = x?.two
	if (!x || !two) return null
	const isles = two.of
		.map((o) =>
			x.islands.find((i) => i.id === o.id && i.grouping === o.grouping),
		)
		.filter(Boolean) as IslandsData["islands"]
	if (isles.length < 2) return null
	const [a, b] = isles
	return (
		<div className="hiw-pic-row hiw-pic-sea">
			<BlobDefs />
			<R i={0}>
				<Island
					seed={a.id}
					name={a.name}
					sub={`${a.count.toLocaleString("en-US")} titles`}
					colors={[a.color]}
					picture={img(a.picture, "w342")}
					w={20}
				/>
			</R>
			<R i={1} className="hiw-pic-eq">
				+
			</R>
			<R i={2}>
				<Island
					seed={b.id}
					name={b.name}
					sub={`${b.count.toLocaleString("en-US")} titles`}
					colors={[b.color]}
					picture={img(b.picture, "w342")}
					w={20}
				/>
			</R>
			<R i={3} className="hiw-pic-eq hiw-pic-eq2">
				=
			</R>
			<R i={4} className="hiw-pic-combined">
				<Island
					seed={`${a.id}+${b.id}`}
					name={`${a.name} + ${b.name}`}
					sub={`${two.counts[two.counts.length - 1].toLocaleString("en-US")} titles`}
					colors={[a.color, b.color]}
					picture={img(two.titles[0]?.backdrop ?? null, "w780")}
					w={27}
					ring={600}
				/>
			</R>
		</div>
	)
}

function TrackingPicture({ data }: { data: IntroData }) {
	const { movie: streaming, service, shows, pool } = picks(data)
	// Where no famous movie is on a well-known service, the Wishlist moment still shows, without "Now on".
	const movie = streaming ?? pool.find((c) => c.media_type === "movie")
	const items = [
		movie && {
			card: movie,
			color: "#fbbf24",
			label: "Want to See",
			line: "On your Wishlist",
		},
		movie &&
			service && {
				card: movie,
				color: "#22c55e",
				label: `Now on ${service.name}`,
				line: "From your Wishlist",
			},
		shows[0] && {
			card: shows[0],
			color: "#ef4444",
			label: "Continue",
			line: "Next episode, out now",
		},
	].filter(Boolean) as {
		card: IntroCard
		color: string
		label: string
		line: string
	}[]
	return (
		<div className="hiw-pic-stack">
			<div className="hiw-pic-feed">
				{items.map((m, i) => (
					<R
						key={m.label}
						i={i * 1.2}
						className="hiw-pic-moment"
						style={{ "--c": m.color } as CSSProperties}
					>
						<Poster
							path={m.card.poster_path}
							size="w185"
							className="hiw-pic-p-xs"
						/>
						<div>
							<b>{m.label}</b>
							<span>
								{m.card.title} · {m.line}
							</span>
						</div>
					</R>
				))}
			</div>
			<R i={4} className="hiw-pic-note">
				Example of what members get
			</R>
		</div>
	)
}

function RatingsPicture({ data }: { data: IntroData }) {
	const sources = [
		"imdb",
		"letterboxd",
		"trakt",
		"plex",
		"tmdb",
		"myanimelist",
	].flatMap((id) => IMPORT_SOURCE_LIST.find((s) => s.id === id) ?? [])
	const posters = data.pool.filter((c) => c.poster_path).slice(2, 8)
	return (
		<div className="hiw-pic-row hiw-pic-ratings">
			<div className="hiw-pic-marks">
				{sources.map((s, i) => (
					<R key={s.id} i={i * 0.5} className="hiw-pic-mark">
						<SourceMark source={s} />
					</R>
				))}
			</div>
			<R i={3} className="hiw-pic-eq">
				<span className="hiw-pic-arrow">→</span>
			</R>
			<R i={4} className="hiw-pic-g">
				<GoodWatchG height={64} />
			</R>
			<R i={5} className="hiw-pic-eq">
				<span className="hiw-pic-arrow">→</span>
			</R>
			<div className="hiw-pic-col">
				<R i={5.5} className="hiw-pic-small">
					Picked for you
				</R>
				<div className="hiw-pic-grid3">
					{posters.map((c, i) => (
						<R key={c.key} i={6 + i * 0.35}>
							<Poster path={c.poster_path} className="hiw-pic-p-xs" />
						</R>
					))}
				</div>
			</div>
		</div>
	)
}

const PICTURES: Record<PictureId, (p: { data: IntroData }) => ReactNode> = {
	score: ScorePicture,
	streaming: StreamingPicture,
	"for-you": ForYouPicture,
	feelings: FeelPicture,
	search: SearchPicture,
	filters: FiltersPicture,
	explorer: ExplorerPicture,
	tracking: TrackingPicture,
	ratings: RatingsPicture,
}

/** One feature's picture on a stage like the intro's: a size container, so its parts are sized in cqw. */
export default function Picture({
	id,
	data,
}: { id: PictureId; data: IntroData }) {
	const P = PICTURES[id]
	return (
		<Stage k={1}>
			<div className="hiw-pic">
				<P data={data} />
			</div>
		</Stage>
	)
}
