// PROTOTYPE - throwaway. Chapter 10, "bring your ratings" (round 6). The owner: "the 'bring your own ratings' from
// the prev round is better than the new variations and should be its own section after this". Round 4's
// tracking-import, refined: bigger source tiles with their names, a smoother pour into the G, and famous pool
// posters coming out the other side. The sources are the importers GoodWatch has (ui/imports/ImportSources.ts),
// with the owner's letter tiles where a brand forbids its logo.
import type { CSSProperties } from "react"
import { GoodWatchG } from "~/ui/brand/GoodWatchWordmark"
import { IMPORT_SOURCE_LIST } from "~/ui/imports/ImportSources"
import type { ClipProps } from "../../clip"
import { A, DEAL, Headline, Poster, at } from "./kit"

const SOURCES = IMPORT_SOURCE_LIST.filter((s) => s.id !== "csv").slice(0, 8)

function Tile({ s, className = "" }: { s: (typeof SOURCES)[number]; className?: string }) {
	return (
		<span className={`lpc-r6track-src ${className}`} title={s.name}>
			{s.logo ? <img src={s.logo} alt={s.name} /> : <span className="lpc-r6track-src-tile">{s.tile}</span>}
		</span>
	)
}

/** A. Into the G: eight big tiles pour into the G, and your picks fan out on the other side. */
export function ImportsInto({ data }: ClipProps) {
	const posters = data.pool.slice(1).flatMap((c) => c.poster_path ?? []).slice(0, 6)
	const g = { x: 55, y: 56 }
	return (
		<>
			<div className="lpc-r6track-glow" style={{ left: "0%" }} />
			<div className="lpc-r6track-imports-head">
				<div className="lpc-r6track-kicker lpc-r6track-a" style={at(["lpc-r6track-rise", 100, 700])}>
					Your history
				</div>
				<Headline text="Bring your *ratings* with you." delay={200} className="lpc-r6track-h-mid" />
			</div>
			{SOURCES.map((s, i) => {
				const x = 8 + (i % 4) * 11
				const y = 44 + Math.floor(i / 4) * 26
				const fly = 2700 + i * 120
				return (
					<div
						key={s.id}
						className={`lpc-r6track-srcwrap ${A(1)}`}
						style={{
							left: `${x}cqw`,
							top: `${y}cqh`,
							...at(["lpc-r6track-pop", 700 + i * 110, 650, DEAL], ["lpc-r6track-to", fly, 750, "cubic-bezier(.55,0,.75,.2)"]),
							"--tx": `${g.x - x}cqw`,
							"--ty": `${g.y - y}cqh`,
							"--ts": "0.25",
							"--to": "0",
						} as CSSProperties}
					>
						<Tile s={s} />
						<span className={`lpc-r6track-src-name ${A(1)}`} style={at(["lpc-r6track-fade", 1000 + i * 110, 500], ["lpc-r6track-out", fly - 300, 250])}>
							{s.name}
						</span>
					</div>
				)
			})}
			<div className={`lpc-r6track-g ${A(1, 1)}`} style={{ left: `${g.x}cqw`, top: `${g.y}cqh`, ...at(["lpc-r6track-pop", 1700, 800, DEAL], ["lpc-r6track-gulp", 3500, 600, "ease-in-out"], ["lpc-r6track-gulp", 4000, 600, "ease-in-out"]) }}>
				<GoodWatchG height="11cqw" />
			</div>
			{/* Your picks come out the other side. */}
			{posters.map((p, i) => {
				const x = 69 + (i % 3) * 10
				const y = 45 + Math.floor(i / 3) * 24
				return (
					<div
						key={p}
						className="lpc-r6track-out-poster lpc-r6track-a"
						style={{
							left: `${x}cqw`,
							top: `${y}cqh`,
							...at(["lpc-r6track-from", 4300 + i * 150, 900, DEAL]),
							"--fx": `${g.x - x}cqw`,
							"--fy": `${g.y - y}cqh`,
							"--fs": "0.2",
						} as CSSProperties}
					>
						<Poster path={p} size="w185" />
					</div>
				)
			})}
			<p className="lpc-r6track-imports-line lpc-r6track-line lpc-r6track-a" style={at(["lpc-r6track-rise", 5400, 800])}>
				IMDb, Letterboxd, Trakt, Plex and more. <b>Your taste is ready on day one.</b>
			</p>
		</>
	)
}

/** B. Streams: each source sends its titles along a stream into the G; your picks deal in on the right. */
export function ImportsStream({ data }: ClipProps) {
	const pool = data.pool.slice(1).flatMap((c) => c.poster_path ?? [])
	const picks = pool.slice(0, 5)
	const g = { x: 54, y: 56 }
	const rowY = (i: number) => 24 + i * 8
	return (
		<>
			<div className="lpc-r6track-glow" style={{ left: "10%" }} />
			<div className="lpc-r6track-imports-head lpc-r6track-imports-head-right">
				<div className="lpc-r6track-kicker lpc-r6track-a" style={at(["lpc-r6track-rise", 100, 700])}>
					Your history
				</div>
				<Headline text="Your ratings come *with you.*" delay={200} className="lpc-r6track-h-mid" />
			</div>
			{SOURCES.map((s, i) => (
				<div key={s.id} className="lpc-r6track-srcrow lpc-r6track-a" style={{ top: `${rowY(i)}cqh`, ...at(["lpc-r6track-from", 500 + i * 100, 700, DEAL], undefined, undefined, { "--fx": "-6cqw" } as CSSProperties) }}>
					<Tile s={s} className="lpc-r6track-src-small" />
					<span>{s.name}</span>
				</div>
			))}
			{/* Each source's titles travel into the G. */}
			{SOURCES.flatMap((s, i) =>
				[0, 1, 2].map((n) => {
					const x = 22
					const y = rowY(i)
					const go = 1700 + i * 140 + n * 260
					return (
						<div
							key={`${s.id}-${n}`}
							className="lpc-r6track-dot lpc-r6track-a"
							style={{
								left: `${x}cqw`,
								top: `${y}cqh`,
								...at(["lpc-r6track-travel", go, 1100, "cubic-bezier(.45,0,.55,1)"]),
								"--tx": `${g.x - x}cqw`,
								"--ty": `${g.y - y}cqh`,
							} as CSSProperties}
						>
							<Poster path={pool[(i * 3 + n + 5) % pool.length]} size="w92" />
						</div>
					)
				}),
			)}
			<div className={`lpc-r6track-g ${A(1, 1)}`} style={{ left: `${g.x}cqw`, top: `${g.y}cqh`, ...at(["lpc-r6track-pop", 1300, 800, DEAL], ["lpc-r6track-gulp", 3200, 700, "ease-in-out"], ["lpc-r6track-gulp", 4300, 700, "ease-in-out"]) }}>
				<GoodWatchG height="10cqw" />
			</div>
			<div className="lpc-r6track-picks">
				<div className="lpc-r6track-kicker lpc-r6track-a" style={at(["lpc-r6track-rise", 5000, 700])}>
					Ready on day one
				</div>
				<div className="lpc-r6track-picks-row">
					{picks.map((p, i) => (
						<div key={p} className="lpc-r6track-a" style={at(["lpc-r6track-deal", 5200 + i * 150, 750, DEAL])}>
							<Poster path={p} size="w185" />
						</div>
					))}
				</div>
			</div>
			<p className="lpc-r6track-imports-line lpc-r6track-line lpc-r6track-a" style={at(["lpc-r6track-rise", 6000, 800])}>
				IMDb, Letterboxd, Trakt, Plex and more. <b>Your picks start where you left off.</b>
			</p>
		</>
	)
}
