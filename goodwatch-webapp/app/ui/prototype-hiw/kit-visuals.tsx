// PROTOTYPE - throwaway. /how-it-works variant C's pictures: one still composition per feature, built from the intro's
// kit parts (brand cards, the score ring, service logos, posters, feeling words, search reading chips, islands, import
// marks) and the intro's real data (/api/intro). No film: each picture mounts when it scrolls into view, its parts
// rise in one after another, then it holds. Transform and opacity only.
import "./hiw.css"
import type { CSSProperties, ReactNode } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import { SourceMark } from "~/ui/imports/SourceMark"
import type { IntroCard, IslandsData } from "~/ui/living-room/intro/data"
import { Stage } from "~/ui/living-room/intro/player"
import { BrandCard } from "~/ui/living-room/intro/parts/brand-cards"
import { Poster, knownService, picks } from "~/ui/living-room/intro/parts/feed-kit"
import { famous, feelData, img, sayable } from "~/ui/living-room/intro/parts/feeling-kit"
import { Island } from "~/ui/living-room/intro/parts/island-kit"
import { BlobDefs, Logo, mapData } from "~/ui/living-room/intro/parts/map-kit"
import { Ring, scoreTitle, score, verdictOf, vibeColor } from "~/ui/living-room/intro/parts/score-kit"
import { ReadChip } from "~/ui/living-room/intro/parts/search-kit"
import type { IntroData } from "~/ui/living-room/intro/scene"
import { avatarFeel } from "~/ui/living-room/intro/parts/feelings-zoom"
import { filterData } from "~/ui/living-room/intro/scenes/filters"
import { useInView, useIntroData } from "./scene-screen"

/** A part that rises in as its picture shows: `i` staggers it. */
const R = ({ i = 0, className = "", style, children }: { i?: number; className?: string; style?: CSSProperties; children: ReactNode }) => (
	<div className={`hiwc-rise ${className}`} style={{ "--i": i, ...style } as CSSProperties}>
		{children}
	</div>
)

/** The picture's box: a size container like the intro's stage, transparent, mounted on scroll into view. */
export function KitPicture({ id, className = "" }: { id: string; className?: string }) {
	const data = useIntroData()
	const { ref, seen } = useInView<HTMLDivElement>(0.35)
	const P = PICTURES[id]
	return (
		<div ref={ref} className={`hiwc-host relative w-full ${className}`}>
			{data && P && seen > 0 && (
				<Stage k={1}>
					<div className="hiwc">
						<P data={data} />
					</div>
				</Stage>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------

function ScorePicture({ data }: { data: IntroData }) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	const pct = score(card)
	return (
		<div className="hiwc-row hiwc-score">
			<div className="hiwc-fan">
				{sources.map((s, i) => (
					<div
						key={s.id}
						className="hiwc-fan-card"
						style={{ "--r": `${(i - 2) * 7}deg`, "--x": `${(i - 2) * 8.5}cqw`, "--y": `${Math.abs(i - 2) * 1.6}cqw` } as CSSProperties}
					>
						<R i={i * 0.7}>
							<BrandCard s={s} />
						</R>
					</div>
				))}
			</div>
			<R i={6} className="hiwc-eq">=</R>
			<div className="hiwc-ring-col">
				<R i={6} className="hiwc-small">{card.title}</R>
				<R i={7} className="hiwc-ring">
					<Ring percent={pct} fillAt={900} numberAt={1700} />
				</R>
				<R i={9} className="hiwc-verdict" style={{ color: vibeColor(pct) }}>
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
		<div className="hiwc-row hiwc-streaming">
			<div className="hiwc-count">
				<R i={0} className="hiwc-big">{a.serviceCount}</R>
				<R i={1} className="hiwc-label">streaming services</R>
				<R i={2} className="hiwc-label hiwc-dim">in {a.countryCount} countries</R>
			</div>
			<div className="hiwc-logos">
				{logos.map((s, i) => (
					<R key={s.id} i={2 + (i % 7) * 0.6 + Math.floor(i / 7) * 0.8} className={i < a.popular.length ? "" : "hiwc-faint"}>
						<Logo s={s} w={6.2} />
					</R>
				))}
			</div>
		</div>
	)
}

function ForYouPicture({ data }: { data: IntroData }) {
	const p = (data.extra.pick ?? null) as { loved: number[]; pick: number | null; match: number | null } | null
	const byKey = (k: number | null) => data.pool.find((c) => Number(c.key) === k) ?? null
	const loved = (p?.loved ?? []).map(byKey).filter(Boolean) as IntroCard[]
	const pick = byKey(p?.pick ?? null)
	if (!pick) return null
	return (
		<div className="hiwc-row hiwc-foryou">
			<div className="hiwc-col">
				<R i={0} className="hiwc-small">Because you loved</R>
				<div className="hiwc-posters">
					{loved.map((c, i) => (
						<R key={c.key} i={1 + i}>
							<Poster path={c.poster_path} className="hiwc-p-sm" />
						</R>
					))}
				</div>
			</div>
			<R i={3} className="hiwc-eq"><span className="hiwc-arrow">→</span></R>
			<div className="hiwc-col hiwc-pick">
				<R i={4}>
					<Poster path={pick.poster_path} size="w500" className="hiwc-p-lg hiwc-chosen" />
				</R>
			</div>
			{p?.match != null && (
				<div className="hiwc-col hiwc-match">
					<R i={6} className="hiwc-big">{p.match}%</R>
					<R i={7} className="hiwc-label">your taste</R>
				</div>
			)}
		</div>
	)
}

function FeelPicture({ data }: { data: IntroData }) {
	const f = avatarFeel(data)
	if (!f) return null
	return (
		<div className="hiwc-bleed">
			<img src={img(f.hero.backdrop_path, "w1280")} alt="" className="hiwc-backdrop" />
			<div className="hiwc-shade" />
			<div className="hiwc-row hiwc-on-top">
				<R i={0}>
					<Poster path={f.card.poster_path} size="w500" className="hiwc-p-lg" />
				</R>
				<div className="hiwc-words">
					<R i={1} className="hiwc-small">How {f.hero.title} feels</R>
					{f.words.map((w, i) => (
						<R key={w.key} i={2 + i} className="hiwc-word">
							<span className="hiwc-emoji" aria-hidden="true">
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
		<div className="hiwc-stack">
			<R i={0} className="hiwc-field">
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
					<path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
				</svg>
				<span>{s.q}</span>
			</R>
			<div className="hiwc-chips">
				{chips.map((c, i) => (
					<R key={c.text} i={1 + i * 0.6}>
						<ReadChip chip={c} ms={0} />
					</R>
				))}
			</div>
			<div className="hiwc-posters">
				{top.map((t, i) => (
					<R key={t.key} i={4 + i * 0.5} className="hiwc-scored">
						<Poster path={t.poster} className="hiwc-p-md" />
						{t.score != null && (
							<span className="hiwc-badge" style={{ background: vibeColor(t.score) }}>
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
		<div className="hiwc-row hiwc-filters">
			<div className="hiwc-switches">
				{switches.map((s, i) => (
					<R key={s.id} i={i} className="hiwc-switch" style={{ "--c": SWITCH_TONES[i] } as CSSProperties}>
						<span>{s.kind === "score" ? `GoodWatch score ${s.score ?? 80}+` : s.label}</span>
						<i />
					</R>
				))}
			</div>
			<div className="hiwc-col">
				<R i={5} className="hiwc-big">{last.total.toLocaleString("en-US")}</R>
				<R i={6} className="hiwc-label">for tonight</R>
				<div className="hiwc-posters">
					{last.titles
						.filter((t) => t.poster)
						.slice(0, 3)
						.map((t, i) => (
							<R key={t.key} i={7 + i * 0.5}>
								<Poster path={t.poster} className="hiwc-p-sm" />
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
	const isles = two.of.map((o) => x.islands.find((i) => i.id === o.id && i.grouping === o.grouping)).filter(Boolean) as IslandsData["islands"]
	if (isles.length < 2) return null
	const [a, b] = isles
	return (
		<div className="hiwc-row hiwc-sea">
			<BlobDefs />
			<R i={0}>
				<Island seed={a.id} name={a.name} sub={`${a.count.toLocaleString("en-US")} titles`} colors={[a.color]} picture={img(a.picture, "w342")} w={20} />
			</R>
			<R i={1} className="hiwc-eq">+</R>
			<R i={2}>
				<Island seed={b.id} name={b.name} sub={`${b.count.toLocaleString("en-US")} titles`} colors={[b.color]} picture={img(b.picture, "w342")} w={20} />
			</R>
			<R i={3} className="hiwc-eq hiwc-eq2">=</R>
			<R i={4} className="hiwc-combined">
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
	const { movie, service, shows } = picks(data)
	const items = [
		movie && { card: movie, color: "#fbbf24", label: "Want to See", line: "On your Wishlist" },
		movie && service && { card: movie, color: "#22c55e", label: `Now on ${service.name}`, line: "From your Wishlist" },
		shows[0] && { card: shows[0], color: "#ef4444", label: "Continue", line: "Next episode, out now" },
	].filter(Boolean) as { card: IntroCard; color: string; label: string; line: string }[]
	return (
		<div className="hiwc-stack">
			<div className="hiwc-feed">
				{items.map((m, i) => (
					<R key={m.label} i={i * 1.2} className="hiwc-moment" style={{ "--c": m.color } as CSSProperties}>
						<Poster path={m.card.poster_path} size="w185" className="hiwc-p-xs" />
						<div>
							<b>{m.label}</b>
							<span>
								{m.card.title} · {m.line}
							</span>
						</div>
					</R>
				))}
			</div>
			<R i={4} className="hiwc-note">
				Example of what members get
			</R>
		</div>
	)
}

function RatingsPicture({ data }: { data: IntroData }) {
	const sources = ["imdb", "letterboxd", "trakt", "plex", "tmdb", "myanimelist"].flatMap((id) => IMPORT_SOURCE_LIST.find((s) => s.id === id) ?? [])
	const posters = data.pool.filter((c) => c.poster_path).slice(2, 8)
	return (
		<div className="hiwc-row hiwc-ratings">
			<div className="hiwc-marks">
				{sources.map((s, i) => (
					<R key={s.id} i={i * 0.5} className="hiwc-mark">
						<SourceMark source={s} />
					</R>
				))}
			</div>
			<R i={3} className="hiwc-eq"><span className="hiwc-arrow">→</span></R>
			<R i={4} className="hiwc-g">
				<GoodWatchG height={64} />
			</R>
			<R i={5} className="hiwc-eq"><span className="hiwc-arrow">→</span></R>
			<div className="hiwc-col">
				<R i={5.5} className="hiwc-small">Picked for you</R>
				<div className="hiwc-grid3">
					{posters.map((c, i) => (
						<R key={c.key} i={6 + i * 0.35}>
							<Poster path={c.poster_path} className="hiwc-p-xs" />
						</R>
					))}
				</div>
			</div>
		</div>
	)
}

const PICTURES: Record<string, (p: { data: IntroData }) => ReactNode> = {
	"one-score": ScorePicture,
	streaming: StreamingPicture,
	"picked-for-you": ForYouPicture,
	"how-it-feels": FeelPicture,
	search: SearchPicture,
	filters: FiltersPicture,
	explorer: ExplorerPicture,
	tracking: TrackingPicture,
	ratings: RatingsPicture,
}

export const hasPicture = (scene: string) => scene in PICTURES
export { knownService }
