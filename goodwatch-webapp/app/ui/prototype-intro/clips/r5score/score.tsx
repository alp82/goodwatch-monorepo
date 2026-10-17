// PROTOTYPE - throwaway. Chapter 2, "One score", round 5: five real numbers (IMDb, Rotten Tomatoes critics and
// audience, Metacritic critics and users) feed the GoodWatch score; they keep circling the ring while it fills, then
// leave the hand-over frame (RingEnd) that chapter 3 starts from.
import type { CSSProperties } from "react"
import type { ClipProps } from "../../clip"
import { Layer, Orbit, RingEnd, at, orbitPos, poster, scoreTitle } from "./common"

const ROW_GAP = 17 // cqw between chips in the opening row

/** Where chip i sits in a centred row, as an offset from its orbit place. */
const fromRow = (i: number): CSSProperties => {
	const o = orbitPos(i)
	return { "--fx": `${(i - 2) * ROW_GAP - o.x}cqw`, "--fy": `${-o.y}cqh` } as CSSProperties
}
const fromCentre = (i: number): CSSProperties => {
	const o = orbitPos(i)
	return { "--fx": `${-o.x}cqw`, "--fy": `${-o.y}cqh`, "--fs": 0.3, "--fo": 0 } as CSSProperties
}

/** A headline that rises at `inAt` and, with `outAt`, leaves again. */
function Head({ text, inAt, outAt, amber }: { text: string; inAt: number; outAt?: number; amber?: string }) {
	const words = text.split(" ")
	const body = (
		<div className="lpc-r5score-head lpc-r5score-at-head">
			{words.map((w, i) => (
				<span key={`${w}${i}`} className={`lpc-r5score-rise ${w === amber ? "lpc-r5score-amber" : ""}`} style={{ ...at(inAt + i * 170), display: "inline-block", whiteSpace: "pre" }}>
					{w}
					{i < words.length - 1 ? " " : ""}
				</span>
			))}
		</div>
	)
	return outAt ? (
		<Layer className="lpc-r5score-fadeout" style={at(outAt, 500)}>
			{body}
		</Layer>
	) : (
		body
	)
}

/** (a) The five line up, then swing into an orbit around the ring as it fills. */
export function ScoreOrbit({ data }: ClipProps) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	return (
		<div className="lpc-r5score">
			<Head text="Five opinions." inAt={300} outAt={2900} amber="Five" />
			<Orbit
				sources={sources}
				spinAt={4000}
				spinMs={3400}
				turn={75}
				leaveAt={6600}
				enter={(i) => ({
					className: "lpc-r5score-from",
					style: { ...at(3000 + i * 70, 1100), ...fromRow(i) },
					inner: { className: "lpc-r5score-deal", style: at(700 + i * 170) },
				})}
			/>
			<RingEnd
				card={card}
				fillAt={4300}
				wrap={(k, n) => {
					const style = { kick: at(150), head: at(3300), ring: at(3900, 900), verdict: at(6900) }[k]
					const cls = { kick: "lpc-r5score-fade", head: "lpc-r5score-rise", ring: "lpc-r5score-pop", verdict: "lpc-r5score-rise" }[k]
					return k === "head" ? (
						<Head key={k} text="One score." inAt={3300} amber="score." />
					) : (
						<Layer key={k} className={cls} style={style}>
							{n}
						</Layer>
					)
				}}
			/>
		</div>
	)
}

/** (b) The five sit around an empty ring; each sends its number in, and the ring fills from them. */
export function ScorePulse({ data }: ClipProps) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	return (
		<div className="lpc-r5score">
			<Head text="Five opinions." inAt={300} outAt={3000} amber="Five" />
			<Orbit
				sources={sources}
				spinAt={900}
				spinMs={6000}
				turn={130}
				leaveAt={6400}
				enter={(i) => ({ className: "lpc-r5score-pop", style: at(800 + i * 200, 800) })}
			/>
			{/* Each chip's number travels into the ring, from where the turning chip is at that moment. */}
			{sources.map((s, i) => {
				const t = 2500 + i * 230
				const o = orbitPos(i, 5, (130 * (t - 900)) / 6000)
				return <div key={s.id} className="lpc-r5score-dot" style={{ ...at(2500 + i * 230), "--fx": `${o.x}cqw`, "--fy": `${o.y}cqh` } as CSSProperties} />
			})}
			<RingEnd
				card={card}
				fillAt={3000}
				wrap={(k, n) =>
					k === "head" ? (
						<Head key={k} text="One score." inAt={3300} amber="score." />
					) : (
						<Layer
							key={k}
							className={{ kick: "lpc-r5score-fade", ring: "lpc-r5score-pop", verdict: "lpc-r5score-rise" }[k]}
							style={{ kick: at(150), ring: at(500, 800), verdict: at(6700) }[k]}
						>
							{n}
						</Layer>
					)
				}
			/>
		</div>
	)
}

/** (c) One number at a time, huge, then all five circle the ring as it fills. */
export function ScoreBeats({ data }: ClipProps) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	const say: Record<string, string> = {
		imdb: "IMDb",
		rt: "Critics on Rotten Tomatoes",
		rta: "Audience on Rotten Tomatoes",
		mc: "Critics on Metacritic",
		mcu: "Users on Metacritic",
	}
	const BEAT = 1150
	const after = 300 + sources.length * BEAT
	return (
		<div className="lpc-r5score">
			{sources.map((s, i) => (
				<div key={s.id} className="lpc-r5score-beat" style={at(300 + i * BEAT, BEAT)}>
					<img src={s.logo} alt="" />
					<div className="lpc-r5score-beat-n">
						{s.n}
						{s.n !== "–" && <small>{s.unit}</small>}
					</div>
					<div className="lpc-r5score-kick">{say[s.id]}</div>
				</div>
			))}
			<Orbit
				sources={sources}
				spinAt={after}
				spinMs={2900}
				turn={60}
				leaveAt={after + 2300}
				enter={(i) => ({ className: "lpc-r5score-from", style: { ...at(after + i * 90, 900), ...fromCentre(i) } })}
			/>
			<RingEnd
				card={card}
				fillAt={after + 400}
				wrap={(k, n) =>
					k === "head" ? (
						<Head key={k} text="One score." inAt={after + 100} amber="score." />
					) : (
						<Layer
							key={k}
							className={{ kick: "lpc-r5score-fade", ring: "lpc-r5score-pop", verdict: "lpc-r5score-rise" }[k]}
							style={{ kick: at(150), ring: at(after, 800), verdict: at(after + 2700) }[k]}
						>
							{n}
						</Layer>
					)
				}
			/>
		</div>
	)
}
export const BEATS_MS = 300 + 5 * 1150 + 4300

/** (d) Exploration: the five circle the poster like moons, then the poster turns over into its score. */
export function ScoreFlip({ data }: ClipProps) {
	const { card, sources } = scoreTitle(data)
	if (!card) return null
	return (
		<div className="lpc-r5score">
			<Head text="Five opinions." inAt={400} outAt={3500} amber="Five" />
			<Orbit
				sources={sources}
				spinAt={1000}
				spinMs={6100}
				turn={140}
				leaveAt={7000}
				enter={(i) => ({ className: "lpc-r5score-pop", style: at(1000 + i * 200, 800) })}
			/>
			<div className="lpc-r5score-3d">
				<div className="lpc-r5score-flipper lpc-r5score-turn" style={at(3700, 1200)}>
					<div className="lpc-r5score-face">
						<Layer className="lpc-r5score-deal" style={at(300)}>
							<img src={poster(card.poster_path, "w500")} alt="" className="lpc-r5score-orbit-poster" />
						</Layer>
					</div>
					<div className="lpc-r5score-face lpc-r5score-face-back">
						<RingEnd card={card} fillAt={4600} wrap={(k, n) => (k === "ring" ? <Layer key={k}>{n}</Layer> : null)} />
					</div>
				</div>
			</div>
			<RingEnd
				card={card}
				wrap={(k, n) =>
					k === "ring" ? null : k === "head" ? (
						<Head key={k} text="One score." inAt={4000} amber="score." />
					) : (
						<Layer key={k} className={k === "kick" ? "lpc-r5score-fade" : "lpc-r5score-rise"} style={k === "kick" ? at(150) : at(7300)}>
							{n}
						</Layer>
					)
				}
			/>
		</div>
	)
}
