// PROTOTYPE - throwaway. Chapter 2, "One score", round 6. Owner: "the five line up, but use bigger logos, score cards
// in the brand colors bgs, we can also try putting them aside the big ring instead of orbitting or some kind of
// transition". Five big brand-colored cards with The Dark Knight's real numbers line up, then reach the ring three
// ways. Every clip ends on round 5's hand-over frame (RingEnd), which chapter 3 starts from.
import type { CSSProperties, ReactNode } from "react"
import type { ClipProps } from "../../clip"
import { Layer, RingEnd, type Source, at, scoreTitle } from "../r5score/common"

// ---------------------------------------------------------------------------------------------------------------
// The brand cards.

/** Metacritic's own score colors. */
const metaColor = (n: string) => {
	const v = Number.parseFloat(n)
	if (Number.isNaN(v)) return "#3a3f4b"
	const pct = v <= 10 ? v * 10 : v
	return pct >= 61 ? "#00ce7a" : pct >= 40 ? "#ffbd3f" : "#ff6874"
}

type Brand = { bg: string; fg: string; disc?: boolean; label: string; who: string }
const brandOf = (s: Source): Brand => {
	switch (s.id) {
		case "imdb":
			return { bg: "#f5c518", fg: "#000", label: "IMDb", who: "Audience" }
		case "rt":
			return { bg: "#fa320a", fg: "#fff", disc: true, label: "Rotten Tomatoes", who: "Critics" }
		case "rta":
			return { bg: "#ff8a00", fg: "#1a0d00", disc: true, label: "Rotten Tomatoes", who: "Audience" }
		case "mc":
			return { bg: metaColor(s.n), fg: "#04120a", disc: true, label: "Metacritic", who: "Critics" }
		default:
			return { bg: "#14161c", fg: metaColor(s.n), disc: true, label: "Metacritic", who: "Users" }
	}
}

/** One source as a big card in its brand's color: logo, number, who it speaks for. Centred on its own box. */
export function BrandCard({ s }: { s: Source }) {
	const b = brandOf(s)
	return (
		<div className="lpc-r6score-card" style={{ background: b.bg, color: b.fg } as CSSProperties}>
			<div className={`lpc-r6score-logo ${b.disc ? "lpc-r6score-disc" : ""} ${s.wide ? "lpc-r6score-logo-wide" : ""}`}>
				<img src={s.logo} alt={b.label} />
			</div>
			<div className="lpc-r6score-n">
				{s.n}
				{s.n !== "–" && <small>{s.unit}</small>}
			</div>
			<div className="lpc-r6score-who">{b.who}</div>
		</div>
	)
}

// The opening row: five cards, centred, at ROW_Y.
const CARD_W = 16 // cqw, matches .lpc-r6score-card
const ROW_GAP = 2.2 // cqw
const ROW_Y = 46 // cqh
export const rowX = (i: number) => 50 + (i - 2) * (CARD_W + ROW_GAP)

/** A card in its row place; `wraps` animate it, outermost first. */
function Placed({ s, i, wraps, y = ROW_Y }: { s: Source; i: number; wraps: { className: string; style: CSSProperties }[]; y?: number }) {
	const origin = { transformOrigin: `${rowX(i)}cqw ${y}cqh` }
	const card = (
		<div className="lpc-r6score-place" style={{ left: `${rowX(i)}cqw`, top: `${y}cqh` }}>
			<BrandCard s={s} />
		</div>
	)
	return wraps.reduceRight<ReactNode>(
		(inner, w) => (
			<Layer className={w.className} style={{ ...origin, ...w.style }}>
				{inner}
			</Layer>
		),
		card,
	) as JSX.Element
}

/** A headline in RingEnd's head place, word by word, that can leave again. */
function Head({ text, inAt, outAt, amber }: { text: string; inAt: number; outAt?: number; amber?: string }) {
	const words = text.split(" ")
	const body = (
		<div className="lpc-r5score-head lpc-r5score-at-head">
			{words.map((w, i) => (
				<span
					key={`${w}${i}`}
					className={`lpc-r5score-rise ${w === amber ? "lpc-r5score-amber" : ""}`}
					style={{ ...at(inAt + i * 150), display: "inline-block", whiteSpace: "pre" }}
				>
					{w}
					{i < words.length - 1 ? " " : ""}
				</span>
			))}
		</div>
	)
	return outAt ? (
		<Layer className="lpc-r5score-fadeout" style={at(outAt, 450)}>
			{body}
		</Layer>
	) : (
		body
	)
}

/** RingEnd with its pieces timed: the kick at once, the head by word, the ring popping, the fill, the verdict. */
function Ending({
	data,
	headAt,
	ringAt,
	fillAt,
	fillMs = 1600,
	verdictAt,
}: ClipProps & { headAt: number; ringAt: number; fillAt: number; fillMs?: number; verdictAt: number }) {
	const { card } = scoreTitle(data)
	if (!card) return null
	return (
		<RingEnd
			card={card}
			fillAt={fillAt}
			wrap={(k, n) => {
				if (k === "head") return <Head key={k} text="One score." inAt={headAt} amber="score." />
				if (k === "kick")
					return (
						<Layer key={k} className="lpc-r5score-fade" style={at(100, 600)}>
							{n}
						</Layer>
					)
				if (k === "ring")
					return (
						<Layer key={k} className="lpc-r5score-pop" style={at(ringAt, 800)}>
							<div style={{ display: "contents", "--dur": `${fillMs}ms` } as CSSProperties}>{n}</div>
						</Layer>
					)
				return (
					<Layer key={k} className="lpc-r5score-rise" style={at(verdictAt)}>
						{n}
					</Layer>
				)
			}}
		/>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// (a) Aside: the five line up, then step aside, two left of the ring and three right, while it fills.

// Where each card goes beside the ring: left column for 0-1, right column for 2-4, at 62%.
const ASIDE_SCALE = 0.7
const ASIDE: { x: number; y: number }[] = [
	{ x: 25, y: 40 },
	{ x: 25, y: 65 },
	{ x: 75, y: 28 },
	{ x: 75, y: 52 },
	{ x: 75, y: 76 },
]

export function ScoreAside({ data }: ClipProps) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	return (
		<div className="lpc-r5score lpc-r6score">
			<Head text="Five opinions." inAt={250} outAt={2900} amber="Five" />
			{sources.map((s, i) => (
				<Placed
					key={s.id}
					s={s}
					i={i}
					wraps={[
						{ className: "lpc-r5score-fadeout", style: at(6400 + i * 60, 500) },
						{
							className: "lpc-r5score-to",
							style: {
								...at(3100 + i * 90, 950),
								"--tx": `${ASIDE[i].x - rowX(i)}cqw`,
								"--ty": `${ASIDE[i].y - ROW_Y}cqh`,
								"--ts": ASIDE_SCALE,
							} as CSSProperties,
						},
						{ className: "lpc-r5score-deal", style: at(550 + i * 150) },
					]}
				/>
			))}
			<Ending data={data} headAt={3100} ringAt={3500} fillAt={3900} verdictAt={6500} />
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// (b) Feed: the five line up over the ring; one after another each card flies into it, and the ring fills from them.

const FEED_ORDER = [0, 4, 1, 3, 2]

export function ScoreFeed({ data }: ClipProps) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	const flyAt = (i: number) => 3300 + FEED_ORDER.indexOf(i) * 380
	return (
		<div className="lpc-r5score lpc-r6score">
			<Head text="Five opinions." inAt={250} outAt={2800} amber="Five" />
			{/* The ring sits under the row; it shows as the cards leave. */}
			<Ending data={data} headAt={2950} ringAt={3150} fillAt={3350} fillMs={2300} verdictAt={6000} />
			{sources.map((s, i) => (
				<Placed
					key={s.id}
					s={s}
					i={i}
					wraps={[
						{
							className: "lpc-r6score-intoring",
							style: { ...at(flyAt(i), 700), "--tx": `${50 - rowX(i)}cqw`, "--ty": `${52 - ROW_Y}cqh` } as CSSProperties,
						},
						{ className: "lpc-r5score-deal", style: at(550 + i * 150) },
					]}
				/>
			))}
			{/* A flash in the ring as each card lands. */}
			{sources.map((s, i) => (
				<div key={`f${s.id}`} className="lpc-r6score-flash" style={at(flyAt(i) + 560, 500)} />
			))}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// (c) Fan: the five arrive as a hand of cards, fanned; the hand folds and sinks into the ring as it fills.

const FAN_Y = 50 // cqh: the fan's centre
const fanRot = (i: number) => (i - 2) * 6 // deg
const fanX = (i: number) => 50 + (i - 2) * 15 // cqw
const fanLift = (i: number) => Math.abs(i - 2) * 2 // cqh

export function ScoreFan({ data }: ClipProps) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	return (
		<div className="lpc-r5score lpc-r6score">
			<Head text="Five opinions." inAt={250} outAt={3100} amber="Five" />
			{sources.map((s, i) => {
				const x = fanX(i)
				const y = FAN_Y + fanLift(i)
				return (
					<Layer key={s.id} className="lpc-r6score-fold" style={{ ...at(3200 + (4 - i) * 70, 1100), transformOrigin: `${x}cqw ${y}cqh`, "--tx": `${50 - x}cqw`, "--ty": `${52 - y}cqh`, "--r": `${-fanRot(i)}deg` } as CSSProperties}>
						<Layer className="lpc-r6score-fanin" style={{ ...at(500 + i * 160, 800), transformOrigin: `${x}cqw ${y}cqh` }}>
							<div className="lpc-r6score-place" style={{ left: `${x}cqw`, top: `${y}cqh`, transform: `rotate(${fanRot(i)}deg)`, zIndex: i === 2 ? 3 : 2 - Math.abs(i - 2) + 1 }}>
								<BrandCard s={s} />
							</div>
						</Layer>
					</Layer>
				)
			})}
			<Ending data={data} headAt={3300} ringAt={3900} fillAt={4100} verdictAt={6300} />
		</div>
	)
}

export const SCORE_MS = { aside: 8400, feed: 8000, fan: 8200 }
