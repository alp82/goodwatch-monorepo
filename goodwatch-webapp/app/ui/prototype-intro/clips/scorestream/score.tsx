// PROTOTYPE - throwaway. "One score" clips. Real numbers only: the GoodWatch score of the start titles, and the
// IMDb, Rotten Tomatoes and Metacritic numbers behind it (server/prototype-intro/scorestream.server.ts).
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import metacriticLogo from "~/img/metacritic-logo-icon-64.webp"
import rottenLogo from "~/img/rotten-logo-icon-64.webp"
import type { LandingCard } from "~/server/prototype-landing.server"
import type { SourceScores } from "~/server/prototype-intro/scorestream.server"
import type { ClipProps } from "../../clip"
import { Frame, Ring, Words, at, backdrop, bestKnown, extraOf, poster, score, vibeColor, verdictOf } from "./common"

const sourcesOf = (props: ClipProps) => {
	const extra = extraOf(props.data)
	return (card: LandingCard) => extra?.sources.find((s) => s.key === card.key) ?? null
}
const full = (s: SourceScores | null) => Boolean(s && s.imdb != null && s.metacritic != null && s.tomatometer != null)

/** (a) The three sources show their real numbers, gather in the middle, and the GoodWatch ring takes their place. */
export function ScoreMerge(props: ClipProps) {
	const of = sourcesOf(props)
	const cards = props.data.landing
	const card = bestKnown(cards, (c) => full(of(c)) && score(c) > 0) ?? cards[0]
	const s = of(card)
	const items = [
		{ img: imdbLogo, n: s?.imdb != null ? `${s.imdb}` : "–", unit: "/10", label: "Audiences" },
		{ img: rottenLogo, n: s?.tomatometer != null ? `${s.tomatometer}` : "–", unit: "%", label: "Critics" },
		{ img: metacriticLogo, n: s?.metacritic != null ? `${s.metacritic}` : "–", unit: "", label: "Critics" },
	]
	return (
		<Frame>
			<div className="lpc-ss-top">
				<div className="lpc-ss-kick lpc-ss-fade" style={at(100)}>
					{card.title}
				</div>
				<div className="lpc-ss-h" style={{ position: "relative" }}>
					<div className="lpc-ss-out" style={at(3300, 500)}>
						<Words text="Three opinions." from={250} />
					</div>
					<div style={{ position: "absolute", left: 0, top: 0 }}>
						<Words text="One score." from={3800} accent="score." />
					</div>
				</div>
			</div>
			<div className="lpc-ss-merge-sources">
				{items.map((it, i) => (
					<div key={it.label + i} className={`lpc-ss-gather-${i}`} style={at(3300 + i * 60)}>
						<div className="lpc-ss-src lpc-ss-deal" style={at(900 + i * 180)}>
							<img src={it.img} alt="" />
							<div className="lpc-ss-src-n">
								{it.n}
								<small>{it.unit}</small>
							</div>
							<div className="lpc-ss-src-l">{it.label}</div>
						</div>
					</div>
				))}
			</div>
			<div className="lpc-ss-merge-result">
				<div className="lpc-ss-pop" style={at(3900, 900)}>
					<Ring percent={score(card)} />
				</div>
				<div className="lpc-ss-rise" style={at(4250)}>
					<div className="lpc-ss-verdict" style={{ color: vibeColor(score(card)) }}>
						{verdictOf(score(card))}
					</div>
					<div className="lpc-ss-sub">One GoodWatch score.</div>
				</div>
			</div>
		</Frame>
	)
}

/** (b) A wall of posters gets its scores; the great ones light up, the rest step back. */
export function ScoreWall(props: ClipProps) {
	const cards = props.data.landing.filter((c) => score(c) > 0 && c.poster_path).slice(0, 12)
	const sorted = [...cards].map((c) => score(c)).sort((a, b) => b - a)
	const bar = sorted[Math.min(3, sorted.length - 1)] ?? 80
	return (
		<Frame>
			<div className="lpc-ss-top">
				<div className="lpc-ss-h">
					<Words text="See what's worth it." from={150} accent="worth" />
				</div>
				<div className="lpc-ss-sub lpc-ss-rise" style={at(4300)}>
					Every title, scored by critics and audiences together.
				</div>
			</div>
			<div className="lpc-ss-wall">
				{cards.map((c, i) => {
					const top = score(c) >= bar
					return (
						<div key={c.key} className="lpc-ss-tile">
							<div className={top ? "lpc-ss-lift" : "lpc-ss-dim"} style={{ ...at(3000 + (i % 6) * 60), position: "absolute", inset: 0 }}>
								<div className="lpc-ss-tile-in lpc-ss-deal" style={at(500 + i * 110)}>
									<img src={poster(c.poster_path)} alt="" />
									<div className="lpc-ss-badge lpc-ss-pop" style={at(1900 + i * 70, 500)}>
										<Ring percent={score(c)} />
									</div>
								</div>
								{top && <div className="lpc-ss-glow lpc-ss-fade" style={at(3100, 600)} />}
							</div>
						</div>
					)
				})}
			</div>
		</Frame>
	)
}

/** (c) Critics and audiences disagree, with their real numbers; the GoodWatch score sits between them. */
export function ScoreSplit(props: ClipProps) {
	const of = sourcesOf(props)
	const cards = props.data.landing.filter((c) => score(c) > 0)
	const critics = (s: SourceScores | null) => {
		const v = [s?.metacritic, s?.tomatometer].filter((x): x is number => x != null)
		return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
	}
	const audience = (s: SourceScores | null) => {
		const v = [s?.imdb != null ? s.imdb * 10 : null, s?.rtAudience, s?.metacriticUser != null ? s.metacriticUser * 10 : null].filter(
			(x): x is number => x != null,
		)
		return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null
	}
	const gap = (c: LandingCard) => {
		if (!full(of(c))) return -1
		const a = critics(of(c))
		const b = audience(of(c))
		return a == null || b == null ? -1 : Math.abs(a - b)
	}
	const card = [...cards].sort((a, b) => gap(b) - gap(a))[0] ?? props.data.landing[0]
	const s = of(card)
	const c = critics(s)
	const a = audience(s)
	return (
		<Frame>
			<div className="lpc-ss-top">
				<div className="lpc-ss-kick lpc-ss-fade" style={at(100)}>
					{card.title}
				</div>
				<div className="lpc-ss-h" style={{ fontSize: "7cqw" }}>
					<Words text="Critics and fans disagree." from={250} accent="disagree." />
				</div>
			</div>
			<div className="lpc-ss-split">
				<div className="lpc-ss-side lpc-ss-deal" style={at(1300)}>
					<div className="lpc-ss-kick">Critics</div>
					<div className="lpc-ss-side-big">{c ?? "–"}</div>
					<div className="lpc-ss-side-row">
						<img src={metacriticLogo} alt="" /> {s?.metacritic ?? "–"}
						<img src={rottenLogo} alt="" /> {s?.tomatometer != null ? `${s.tomatometer}%` : "–"}
					</div>
				</div>
				<div className="lpc-ss-split-mid">
					<div className="lpc-ss-pop" style={at(3200, 900)}>
						<Ring percent={score(card)} />
					</div>
					<div className="lpc-ss-kick lpc-ss-amber lpc-ss-rise" style={at(3600)}>
						GoodWatch
					</div>
				</div>
				<div className="lpc-ss-side lpc-ss-side-r lpc-ss-deal-r" style={at(1700)}>
					<div className="lpc-ss-kick">Audiences</div>
					<div className="lpc-ss-side-big">{a ?? "–"}</div>
					<div className="lpc-ss-side-row">
						<img src={imdbLogo} alt="" /> {s?.imdb ?? "–"}
						<img src={rottenLogo} alt="" /> {s?.rtAudience != null ? `${s.rtAudience}%` : "–"}
					</div>
				</div>
			</div>
			<div className="lpc-ss-caption lpc-ss-rise" style={at(4000)}>
				GoodWatch weighs them all, so you don't have to.
			</div>
		</Frame>
	)
}

/** (d) One title's backdrop; its ring fills slowly, the verdict lands, then how many ratings it comes from. */
export function ScoreVerdict(props: ClipProps) {
	const card = bestKnown(props.data.landing, (c) => score(c) >= 75 && Boolean(c.backdrop_path))
	const votes = card.goodwatch_overall_score_voting_count
	return (
		<Frame>
			<div className="lpc-ss-bg lpc-ss-drift" style={at(0, 7000)}>
				<img src={backdrop(card.backdrop_path)} alt="" />
			</div>
			<div className="lpc-ss-shade" />
			<div className="lpc-ss-verdict-row">
				<div className="lpc-ss-pop" style={at(400, 800)}>
					<Ring percent={score(card)} fillAt={700} />
				</div>
				<div>
					<div className="lpc-ss-kick lpc-ss-fade" style={at(300)}>
						{card.title}
					</div>
					<div className="lpc-ss-verdict-big lpc-ss-rise" style={{ ...at(2100, 900), color: vibeColor(score(card)) }}>
						{verdictOf(score(card))}.
					</div>
					{votes ? (
						<div className="lpc-ss-sub lpc-ss-rise" style={at(3300)}>
							From {votes.toLocaleString("en-US")} ratings by critics and audiences.
						</div>
					) : null}
				</div>
			</div>
		</Frame>
	)
}
