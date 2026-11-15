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
	/** Round 2: the page's fun facts. */
	fun: {
		bento: { big: { n: string; text: string }; small: { n: string; text: string }[] }
		vs: { title: string; year: number; poster: string | null; left: { score: string; of: string; source: string }; right: { score: string; of: string; source: string } }
		quiz: { question: string; answers: { title: string; poster: string | null }[] }
		counts: { n: string; text: string }[]
		mix: { n: string; text: string }[]
		pressPlay: { year: number; years: number }
	}
}

export const STATS_VARIANTS = [
	{ key: "A", name: "Hero number — the page's hero total, giant, on amber" },
	{ key: "B", name: "Scoreboard — six totals as tiles on ink" },
	{ key: "C", name: "Records — headline on amber, five records ranked on ink" },
	{ key: "D", name: "Poster wall — best-scored posters, catalog count on an amber band" },
	{ key: "E", name: "Decades — movies by decade as a bar chart" },
	{ key: "F", name: "Fact bento — one giant fact, four small ones" },
	{ key: "G", name: "Standoff — one movie, two crowds, two scores" },
	{ key: "H", name: "Quiz — a question from the page, three poster answers" },
	{ key: "I", name: "Tabloid — stacked counts: Christmas, zombies, sharks, Friday the 13th" },
	{ key: "K", name: "Tabloid mix — titles, years, movies called Home, longest movie" },
	{ key: "J", name: "Press play — start in 1618, finish about now" },
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

const STATS_TAG = "GoodWatch stats"
const DARK_TILE = "#1c1c1c"

function Bento({ c }: { c: StatsCardContent }) {
	const b = c.fun.bento
	const TOP = 128
	const H = HEIGHT - TOP - 40
	const LEFT_W = 520
	const gap = 16
	const smallW = (WIDTH - 2 * 40 - LEFT_W - 2 * gap) / 2
	const smallH = (H - gap) / 2
	return (
		<Frame>
			<div style={row({ position: "absolute", top: 40, left: 40, right: 40, justifyContent: "space-between", alignItems: "center" })}>
				<Brand dark />
				<Tag text={STATS_TAG} />
			</div>
			<div style={row({ position: "absolute", top: TOP, left: 40, right: 40, height: H, gap })}>
				<div style={col({ width: LEFT_W, height: H, backgroundColor: INK, borderRadius: 22, padding: "30px 34px", justifyContent: "flex-end", gap: 6 })}>
					<Num text={b.big.n} size={190} />
					<Line size={40} color="#fff">{b.big.text}</Line>
				</div>
				<div style={row({ width: WIDTH - 80 - LEFT_W - gap, flexWrap: "wrap", gap })}>
					{b.small.slice(0, 4).map((f) => (
						<div key={f.text} style={col({ width: smallW, height: smallH, backgroundColor: INK, borderRadius: 18, padding: "18px 22px", justifyContent: "space-between" })}>
							<Num text={f.n} size={f.n.length > 7 ? 46 : 62} />
							<Line size={23} color="#e5e5e5">{f.text}</Line>
						</div>
					))}
				</div>
			</div>
		</Frame>
	)
}

function Standoff({ c }: { c: StatsCardContent }) {
	const v = c.fun.vs
	const side = (x: typeof v.left, align: "flex-start" | "flex-end") => (
		<div style={col({ width: 360, alignItems: align, gap: 6 })}>
			<div style={{ display: "flex", fontSize: 26, fontWeight: 900, letterSpacing: 3, color: "#a3a3a3" }}>{x.source.toUpperCase()}</div>
			<div style={row({ alignItems: "flex-end", gap: 8 })}>
				<Num text={x.score} size={170} />
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: 44, color: "#737373", paddingBottom: 14 }}>{x.of}</div>
			</div>
		</div>
	)
	return (
		<Frame bg={INK}>
			<div style={row({ position: "absolute", top: 40, left: SIDE, right: SIDE, justifyContent: "space-between", alignItems: "center" })}>
				<Brand />
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: 40, color: AMBER, letterSpacing: 1 }}>GOODWATCH STATS</div>
			</div>
			<div style={row({ position: "absolute", top: 130, left: SIDE, right: SIDE, height: 330, alignItems: "center", justifyContent: "space-between" })}>
				{side(v.left, "flex-start")}
				<div style={{ display: "flex", position: "relative", width: 220, height: 330, borderRadius: 14, overflow: "hidden" }}>
					<Picture src={v.poster} style={{ left: 0, top: 0, width: 220, height: 330 }} />
				</div>
				{side(v.right, "flex-end")}
			</div>
			<div style={col({ position: "absolute", left: 0, right: 0, bottom: 0, height: 140, backgroundColor: AMBER, padding: `0 ${SIDE}px`, justifyContent: "center", gap: 4 })}>
				<Num text={`Same movie. ${v.title}.`} size={v.title.length > 26 ? 44 : 54} color={INK} />
				<Line size={26}>Where the crowds disagree, and every other number on GoodWatch.</Line>
			</div>
		</Frame>
	)
}

function Quiz({ c }: { c: StatsCardContent }) {
	const q = c.fun.quiz
	const PW = 170
	const PH = 255
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: SIDE, top: 150, bottom: 52, width: 520, gap: 20, justifyContent: "flex-end" })}>
				<Tag text={`${STATS_TAG} · quiz`} />
				<Headline text={q.question} width={520} height={330} max={92} />
			</div>
			<div style={row({ position: "absolute", right: SIDE, top: 0, bottom: 0, alignItems: "center", gap: 22 })}>
				{q.answers.slice(0, 3).map((a, i) => (
					<div key={a.title} style={col({ alignItems: "center", gap: 14 })}>
						<div style={{ display: "flex", position: "relative", width: PW, height: PH, borderRadius: 12, overflow: "hidden", border: `4px solid ${INK}` }}>
							<Picture src={a.poster} style={{ left: 0, top: 0, width: PW - 8, height: PH - 8 }} />
						</div>
						<div style={{ display: "flex", width: 64, height: 64, borderRadius: 32, backgroundColor: INK, color: AMBER, fontFamily: "Anton", fontSize: 38, alignItems: "center", justifyContent: "center" }}>
							{"ABC"[i]}
						</div>
					</div>
				))}
			</div>
		</Frame>
	)
}

// Anton runs about 0.45 em per uppercase character: the label takes the largest size (up to 58) that fits beside its number.
const labelSize = (l: { n: string; text: string }) =>
	Math.min(58, Math.floor((790 - 22 - (l.n.replace(/ /g, "").length * 0.45 + (l.n.split(" ").length - 1) * 0.2) * 118) / (l.text.length * 0.46)))

function Tabloid({ c, mix = false }: { c: StatsCardContent; mix?: boolean }) {
	const lines = (mix ? c.fun.mix : c.fun.counts).slice(0, 4)
	return (
		<Frame bg={INK}>
			<div style={col({ position: "absolute", left: SIDE, top: 0, bottom: 0, width: 790, justifyContent: "center", gap: 18 })}>
				{lines.map((l) => (
					// Labels sit on the number's baseline: bottom-aligned, lifted by Anton's descent at each size.
					<div key={l.text} style={row({ alignItems: "flex-end", gap: 22 })}>
						<Num text={l.n} size={118} />
						<div style={{ display: "flex", paddingBottom: 8 }}>
							<Num text={l.text} size={labelSize(l)} color="#fff" />
						</div>
					</div>
				))}
			</div>
			<div style={col({ position: "absolute", top: 0, right: 0, bottom: 0, width: 330, backgroundColor: AMBER, padding: "44px 36px", justifyContent: "space-between" })}>
				<Brand dark size={44} />
				<div style={col({ gap: 14 })}>
					<Num text="Stats" size={120} color={INK} />
					<Line size={26}>Updated every day.</Line>
				</div>
			</div>
		</Frame>
	)
}

function PressPlay({ c }: { c: StatsCardContent }) {
	const p = c.fun.pressPlay
	return (
		<Frame>
			<div style={row({ position: "absolute", top: 44, left: SIDE, right: SIDE, justifyContent: "space-between", alignItems: "center" })}>
				<Brand dark />
				<Tag text={STATS_TAG} />
			</div>
			<div style={col({ position: "absolute", left: SIDE, right: SIDE, bottom: 56, gap: 10 })}>
				<Num text={`Press play in ${p.year}.`} size={128} color={INK} />
				<Num text="Finish about now." size={96} color={INK} />
				<div style={{ display: "flex", marginTop: 18 }}>
					<Line size={34}>{`Every movie and episode on GoodWatch, back to back: ${p.years} years.`}</Line>
				</div>
			</div>
		</Frame>
	)
}

export function PrototypeStatsCard({ variant, content }: { variant: StatsVariant; content: StatsCardContent }) {
	if (variant === "A") return <HeroNumber c={content} />
	if (variant === "B") return <Scoreboard c={content} />
	if (variant === "C") return <Records c={content} />
	if (variant === "D") return <PosterWall c={content} />
	if (variant === "E") return <Decades c={content} />
	if (variant === "F") return <Bento c={content} />
	if (variant === "G") return <Standoff c={content} />
	if (variant === "H") return <Quiz c={content} />
	if (variant === "I") return <Tabloid c={content} />
	if (variant === "K") return <Tabloid c={content} mix />
	return <PressPlay c={content} />
}
