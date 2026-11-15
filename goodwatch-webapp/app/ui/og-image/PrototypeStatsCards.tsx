// PROTOTYPE (throwaway, branch prototype/stats-og): five link-preview card variants for /stats ("GoodWatch in
// numbers"). Today the page gets the generic static card (stock backdrop + "GOODWATCH IN NUMBERS"). Drawn by
// scripts/prototype-stats-og/render.tsx from the live snapshot.
//
//   A  Hero number: the page's hero total, giant, on amber
//   B  Scoreboard: six totals as tiles on ink
//   C  Records: headline on amber, five catalog records ranked on ink
//   D  Poster wall: the best-scored posters as a wall, the catalog count on a band
//   E  Decades: movies by decade as a bar chart across the card
import type { ReactNode } from "react"
import { AMBER, Brand, Frame, HEIGHT, Headline, INK, Picture, Tag, WIDTH, col, row } from "~/ui/og-image/parts"

export interface StatsCardContent {
	hero: { n: string; line: string }
	tiles: { n: string; label: string }[]
	records: { value: string; label: string; title: string }[]
	posters: string[]
	catalog: { movies: string; shows: string; episodes: string }
	decades: { decade: number; titles: number }[]
	decadeTotal: string
	asOf: string
}

export const STATS_VARIANTS = [
	{ key: "A", name: "Hero number — the page's hero total, giant, on amber" },
	{ key: "B", name: "Scoreboard — six totals as tiles on ink" },
	{ key: "C", name: "Records — headline on amber, five records ranked on ink" },
	{ key: "D", name: "Poster wall — best-scored posters, catalog count on an amber band" },
	{ key: "E", name: "Decades — movies by decade as a bar chart" },
] as const
export type StatsVariant = (typeof STATS_VARIANTS)[number]["key"]

const SIDE = 56

const Num = ({ text, size, color = AMBER }: { text: string; size: number; color?: string }) => (
	<div style={{ display: "flex", fontFamily: "Anton", fontSize: size, lineHeight: 0.95, color, letterSpacing: 1 }}>
		{text.toUpperCase()}
	</div>
)

const Line = ({ children, size = 30, color = INK, width }: { children: ReactNode; size?: number; color?: string; width?: number }) => (
	<div style={{ display: "flex", fontSize: size, fontWeight: 700, lineHeight: 1.2, color, ...(width ? { maxWidth: width } : {}) }}>{children}</div>
)

function HeroNumber({ c }: { c: StatsCardContent }) {
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: SIDE, right: SIDE, bottom: 56, gap: 22 })}>
				<Tag text="GoodWatch in numbers" />
				<Num text={c.hero.n} size={230} color={INK} />
				<Line size={38} width={1000}>
					{c.hero.line}
				</Line>
			</div>
		</Frame>
	)
}

function Scoreboard({ c }: { c: StatsCardContent }) {
	return (
		<Frame bg={INK}>
			<div style={row({ position: "absolute", top: 44, left: SIDE, right: SIDE, justifyContent: "space-between", alignItems: "center" })}>
				<Brand />
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: 44, color: AMBER, letterSpacing: 1 }}>IN NUMBERS</div>
			</div>
			<div style={row({ position: "absolute", left: SIDE, right: SIDE, top: 150, bottom: 48, flexWrap: "wrap", gap: 20 })}>
				{c.tiles.slice(0, 6).map((t) => (
					<div
						key={t.label}
						style={col({
							width: (WIDTH - 2 * SIDE - 40) / 3,
							height: 205,
							padding: "22px 26px",
							borderRadius: 18,
							backgroundColor: "#1c1c1c",
							justifyContent: "space-between",
						})}
					>
						<Num text={t.n} size={86} />
						<Line size={26} color="#e5e5e5">
							{t.label}
						</Line>
					</div>
				))}
			</div>
		</Frame>
	)
}

function Records({ c }: { c: StatsCardContent }) {
	const PANEL = 520
	const rowH = Math.floor((HEIGHT - 80) / 5)
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: SIDE, top: 150, bottom: 52, width: 420, gap: 18, justifyContent: "flex-end" })}>
				<Tag text="Records" />
				<Headline text="GoodWatch in numbers" width={420} height={300} max={120} />
			</div>
			<div style={col({ position: "absolute", top: 0, left: PANEL, right: 0, height: HEIGHT, backgroundColor: INK, padding: "40px 48px", justifyContent: "center" })}>
				{c.records.slice(0, 5).map((r) => (
					<div key={r.label} style={row({ height: rowH, alignItems: "center", gap: 24 })}>
						<div style={{ display: "flex", width: 230 }}>
							<Num text={r.value} size={r.value.length > 9 ? 44 : 54} />
						</div>
						<div style={col({ width: 340, gap: 2 })}>
							<div style={{ display: "flex", fontSize: 20, fontWeight: 900, letterSpacing: 2, color: "#a3a3a3" }}>
								{r.label.toUpperCase()}
							</div>
							<div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#fff", lineHeight: 1.1 }}>{r.title}</div>
						</div>
					</div>
				))}
			</div>
		</Frame>
	)
}

function PosterWall({ c }: { c: StatsCardContent }) {
	const COLS = 8
	const PW = WIDTH / COLS
	const PH = PW * 1.5
	const band = 250
	return (
		<Frame bg={INK}>
			{c.posters.slice(0, COLS * 2).map((src, i) => (
				<Picture
					key={src.slice(-40) + i}
					src={src}
					style={{ left: (i % COLS) * PW, top: Math.floor(i / COLS) * PH - 70, width: PW, height: PH }}
				/>
			))}
			<div style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT - band, backgroundColor: "rgba(10,10,10,0.35)", display: "flex" }} />
			<div style={{ position: "absolute", top: 40, left: SIDE, display: "flex" }}>
				<Brand dark />
			</div>
			<div
				style={col({
					position: "absolute",
					left: 0,
					bottom: 0,
					width: WIDTH,
					height: band,
					backgroundColor: AMBER,
					padding: `30px ${SIDE}px`,
					gap: 14,
					justifyContent: "center",
				})}
			>
				<Tag text="GoodWatch in numbers" />
				<Num text={`${c.catalog.movies} movies`} size={96} color={INK} />
				<Line size={30}>{`${c.catalog.shows} shows · ${c.catalog.episodes} episodes · counted every day`}</Line>
			</div>
		</Frame>
	)
}

function Decades({ c }: { c: StatsCardContent }) {
	const top = Math.max(...c.decades.map((d) => d.titles))
	const CHART_H = 330
	const gap = 10
	const barW = (WIDTH - 2 * SIDE - gap * (c.decades.length - 1)) / c.decades.length
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", top: 44, right: SIDE, alignItems: "flex-end", gap: 4 })}>
				<Num text={c.decadeTotal} size={64} color={INK} />
				<Line size={24}>movies with 1,000+ IMDb votes, by decade</Line>
			</div>
			<div style={col({ position: "absolute", left: SIDE, top: 150, width: 640 })}>
				<Headline text="GoodWatch in numbers" width={640} height={120} max={110} />
			</div>
			<div style={row({ position: "absolute", left: SIDE, right: SIDE, bottom: 60, height: CHART_H, alignItems: "flex-end", gap })}>
				{c.decades.map((d) => (
					<div key={d.decade} style={{ display: "flex", width: barW, height: Math.max(4, (d.titles / top) * CHART_H), backgroundColor: INK, borderRadius: "6px 6px 0 0" }} />
				))}
			</div>
			<div style={row({ position: "absolute", left: SIDE, right: SIDE, bottom: 18, gap })}>
				{c.decades.map((d) => (
					<div key={d.decade} style={{ display: "flex", width: barW, justifyContent: "center", fontSize: 20, fontWeight: 700, color: INK }}>
						{`'${String(d.decade).slice(2)}`}
					</div>
				))}
			</div>
		</Frame>
	)
}

export function PrototypeStatsCard({ variant, content }: { variant: StatsVariant; content: StatsCardContent }) {
	if (variant === "A") return <HeroNumber c={content} />
	if (variant === "B") return <Scoreboard c={content} />
	if (variant === "C") return <Records c={content} />
	if (variant === "D") return <PosterWall c={content} />
	return <Decades c={content} />
}
