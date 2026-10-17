// "Streaming": the big brands, then a wall of every service as the camera pulls back, the count ("325 services in 139
// countries"), then one title's services country by country, landing on the visitor's own (with Netflix first), and
// an example alert for when a wanted title lands on a member's service. The wall is light: 128 small logos in four
// fading groups under one moving camera layer, and no wide shadows.
import type { CSSProperties, ReactNode } from "react"
import { Fragment } from "react"
import type { AtlasData, Service, Where } from "~/ui/living-room/intro/data"
import type { NetflixData } from "~/ui/living-room/intro/data"
import {
	COUNTRY,
	DEAL,
	GLIDE,
	Headline,
	Logo,
	fmt,
	img,
	mapData,
	play,
} from "~/ui/living-room/intro/parts/map-kit"
import { Push } from "~/ui/living-room/intro/parts/push"
import type { SceneProps } from "~/ui/living-room/intro/scene"

type Anim = Parameters<typeof play>[0]

const empty = <div className="intro-atlas-root" />

/**
 * The best-known title on Netflix where the visitor is, its services there (Netflix first), and the countries it
 * visits before; `you` marks the last row as the visitor's. Without such a title, the snapshot's title and rows,
 * with no row marked.
 */
function homeOf(m: AtlasData, n: NetflixData | null) {
	const w = n?.netflix[0]
	if (w && n?.service) {
		const here =
			w.countries.find((c) => c.country === n.home) ?? w.countries.at(-1)!
		const services = [
			n.service,
			...here.services.filter((s) => s.id !== n.service!.id),
		].slice(0, 4)
		return {
			w,
			here: { ...here, services },
			others: w.countries.filter((c) => c.country !== here.country).slice(0, 4),
			pick: n.service,
			you: true,
		}
	}
	const w7 =
		m.where.find(
			(x) =>
				x.countries.some((c) => c.country === m.home) &&
				x.countries.length >= 4,
		) ?? m.where[0]
	if (!w7) return null
	const here = w7.countries.find((c) => c.country === m.home) ?? w7.countries[0]
	const others = w7.countries.filter((c) => c !== here).slice(0, 4)
	const pick =
		here.services.find((s) => m.popular.some((p) => p.id === s.id)) ??
		here.services[0]
	return { w: w7, here, others, pick, you: false }
}

// ---------------------------------------------------------------------------------------------------------------
// The wall

/** When things happen in the wall's first seconds. */
const BRANDS_AT = 250
const BRAND_GAP = 130
const RINGS = 4

/**
 * The big brands deal in as one row; as the last one lands the camera starts its one long pull-back and the wall
 * grows around them, ring by ring (four groups that only fade), until the whole wall is there. It dims for the count,
 * then leaves at `out`.
 */
function Wall({ m, dimAt, out }: { m: AtlasData; dimAt: number; out: number }) {
	const cols = 15
	const rows = 9
	const tile = 6
	const gap = tile * 0.14
	const midRow = Math.floor(rows / 2)
	const brands = m.popular.slice(0, 7)
	const startCol = Math.floor((cols - brands.length) / 2)
	const grow = BRANDS_AT + (brands.length - 1) * BRAND_GAP + 450
	const camera = out - grow + 300
	const rings: { s: Service; r: number; c: number }[][] = Array.from(
		{ length: RINGS },
		() => [],
	)
	const brandCells: { s: Service; c: number }[] = []
	const maxD = Math.hypot((cols - 1) / 2, ((rows - 1) / 2) * 1.25)
	let w = 0
	for (let r = 0; r < rows; r++)
		for (let c = 0; c < cols; c++) {
			if (r === midRow && c >= startCol && c < startCol + brands.length) {
				brandCells.push({ s: brands[c - startCol], c })
				continue
			}
			const s = m.wall[w++ % Math.max(1, m.wall.length)]
			if (!s) continue
			const d = Math.hypot(c - (cols - 1) / 2, (r - midRow) * 1.25) / maxD
			rings[Math.min(RINGS - 1, Math.floor(d * RINGS))].push({ s, r, c })
		}
	const width = cols * tile + (cols - 1) * gap
	const height = rows * tile + (rows - 1) * gap
	const at = (c: number, r: number) => ({
		left: `${c * (tile + gap)}cqw`,
		top: `${r * (tile + gap)}cqw`,
	})
	// The rings arrive on a gentle ease-in, each overlapping the next, while the camera keeps pulling back.
	const ringAt = (k: number) => grow + 1900 * Math.pow(k / (RINGS - 1), 0.8)
	return (
		<div className="intro-isle-at" style={{ left: "50cqw", top: "47cqh" }}>
			<div style={{ transform: "translate(-50%, -50%)" }}>
				{/* Leaving, and dimming for the count. */}
				<div
					className="intro-atlas-a"
					style={play(
						["intro-calm-dim", dimAt, 700, "ease-out"],
						["intro-atlas-zoom-away", out, 350, GLIDE],
					)}
				>
					{/* The camera: one move, the whole way, on one layer. */}
					<div
						className="intro-atlas-a intro-lite-camera"
						style={{
							width: `${width}cqw`,
							height: `${height}cqw`,
							...play([
								"intro-lite-pull",
								grow - 200,
								camera,
								"cubic-bezier(.45,0,.2,1)",
							]),
						}}
					>
						{rings.map((cells, k) => (
							<div
								key={k}
								className="intro-atlas-abs intro-atlas-a intro-calm-ring"
								style={play([
									"intro-atlas-fade-in",
									ringAt(k),
									900,
									"ease-out",
								])}
							>
								{cells.map(({ s, r, c }) => (
									<img
										key={`${r}-${c}`}
										src={img(s.logo, "w92")}
										alt=""
										decoding="async"
										draggable={false}
										className="intro-atlas-abs intro-lite-tile"
										style={{
											...at(c, r),
											width: `${tile}cqw`,
											height: `${tile}cqw`,
											borderRadius: `${tile * 0.22}cqw`,
										}}
									/>
								))}
							</div>
						))}
						{brandCells.map(({ s, c }, k) => (
							<div key={c} className="intro-atlas-abs" style={at(c, midRow)}>
								<div
									className="intro-atlas-a"
									style={play([
										"intro-atlas-deal",
										BRANDS_AT + k * BRAND_GAP,
										700,
										DEAL,
									])}
								>
									<Logo s={s} w={tile} />
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	)
}

/** The count, huge, over a soft dark vignette: no panel. */
function Count({ m, at, out }: { m: AtlasData; at: number; out: number }) {
	return (
		<>
			<div
				className="intro-calm-vignette intro-atlas-a"
				style={play(
					["intro-atlas-fade-in", at - 300, 900, "ease-out"],
					["intro-atlas-fade-out", out, 350],
				)}
			/>
			<div
				className="intro-isle-at"
				style={{ left: "50cqw", top: "44cqh", zIndex: 6 }}
			>
				<div style={{ transform: "translate(-50%, -50%)" }}>
					<div
						className="intro-atlas-a"
						style={play(
							["intro-calm-count-in", at, 900, DEAL],
							["intro-atlas-zoom-away", out, 300, GLIDE],
						)}
					>
						<div className="intro-calm-countwrap">
							<div className="intro-isle-count intro-calm-count">
								{fmt(m.serviceCount)}
							</div>
							<div className="intro-isle-count-line intro-calm-count-line">
								services in {fmt(m.countryCount)} countries. <em>One place.</em>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	)
}

/** The kit's Headline, quicker: a 550 ms rise, 90 ms between words, and a 350 ms exit, for the snappy hand-overs. */
function QuickHeadline({
	kicker,
	text,
	delay,
	out,
	sub,
}: {
	kicker?: string
	text: string
	delay: number
	out?: number
	sub?: ReactNode
}) {
	const words = text.split(" ")
	const leave: Anim | undefined =
		out === undefined ? undefined : ["intro-atlas-out", out, 350, GLIDE]
	return (
		<div className="intro-atlas-head">
			{kicker && (
				<div
					className="intro-atlas-kicker intro-atlas-a"
					style={play(["intro-atlas-rise", delay, 500], leave)}
				>
					{kicker}
				</div>
			)}
			<h2 className="intro-atlas-h">
				{words.map((w, i) => (
					<Fragment key={i}>
						<span className="intro-atlas-word">
							<span
								className={`intro-atlas-a ${w.includes("*") ? "intro-atlas-accent" : ""}`}
								style={play(
									["intro-atlas-word-in", delay + 60 + i * 90, 550],
									leave,
								)}
							>
								{w.replace(/\*/g, "")}
							</span>
						</span>{" "}
					</Fragment>
				))}
			</h2>
			{sub && (
				<div
					className="intro-atlas-sub intro-atlas-a"
					style={play(
						["intro-atlas-rise", delay + 120 + words.length * 90, 550],
						leave,
					)}
				>
					{sub}
				</div>
			)}
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The example alert

function Alert({ w, pick, at }: { w: Where; pick: Service; at: number }) {
	return (
		<>
			<div
				className="intro-isle-at"
				style={{ left: "50cqw", top: "57cqh", zIndex: 6 }}
			>
				<div style={{ transform: "translate(-50%, -50%)" }}>
					<div
						className="intro-atlas-a"
						style={play(["intro-atlas-deal-up", at, ALERT_IN, DEAL])}
					>
						<div
							className="intro-atlas-note"
							style={{ position: "relative", width: "66cqw" }}
						>
							{w.poster && (
								<img
									src={img(w.poster, "w185")}
									alt=""
									className="intro-atlas-poster"
									style={{ width: "9cqw", borderRadius: "0.6cqw" }}
								/>
							)}
							<div style={{ flex: 1, minWidth: 0 }}>
								<div className="intro-atlas-note-app">GoodWatch · now</div>
								<div className="intro-atlas-note-title">
									It's on {pick.name} now
								</div>
								<div className="intro-atlas-note-line">
									{w.title} just landed on your service.
								</div>
							</div>
							<div
								className="intro-atlas-a"
								style={play(["intro-atlas-pop", at + 400, 500, DEAL])}
							>
								<Logo s={pick} w={8.5} />
							</div>
						</div>
					</div>
				</div>
			</div>
			<div
				className="intro-atlas-abs"
				style={{ left: 0, right: 0, top: "79cqh", textAlign: "center" }}
			>
				<span
					className="intro-atlas-example intro-atlas-a"
					style={play(["intro-atlas-rise", at + 600, 500])}
				>
					Example
				</span>
			</div>
		</>
	)
}

// ---------------------------------------------------------------------------------------------------------------
// The country rows

type Stop = Where["countries"][0]

function CountryRow({ c, you }: { c: Stop; you: boolean }) {
	return (
		<>
			<span className="intro-isle-row-name">
				{COUNTRY[c.country] ?? c.country}
				{you && <span className="intro-atlas-pin">You</span>}
			</span>
			<span className="intro-isle-row-logos">
				{c.services.slice(0, 4).map((s) => (
					<Logo key={s.id} s={s} w={5} />
				))}
			</span>
		</>
	)
}

/** Steps a track by `dy` per stop: one wrapper per step, each moving once, so the moves add up. */
function Track({
	steps,
	dy,
	children,
}: { steps: number[]; dy: number; children: ReactNode }) {
	return steps.reduceRight<ReactNode>(
		(inner, at) => (
			<div
				className="intro-atlas-a"
				style={{
					position: "absolute",
					inset: 0,
					...play(
						["intro-isle-step", at, 700, "cubic-bezier(.65,0,.35,1)"],
						undefined,
						undefined,
						{ "--ty": `${dy}cqh` } as CSSProperties,
					),
				}}
			>
				{inner}
			</div>
		),
		children,
	)
}

/** A row lit while it's the one in the middle: a lit copy over a dim one. */
function Lit({
	from,
	to,
	children,
	style,
	className,
}: {
	from: number
	to?: number
	children: ReactNode
	style: CSSProperties
	className: string
}) {
	return (
		<>
			<div className={className} style={{ ...style, opacity: 0.32 }}>
				{children}
			</div>
			<div
				className={`${className} intro-atlas-a`}
				style={{
					...style,
					...play(
						["intro-atlas-fade-in", from, 350],
						to === undefined ? undefined : ["intro-atlas-fade-out", to, 350],
					),
				}}
			>
				{children}
			</div>
		</>
	)
}

const STEP = 820
/** The wall leaves here; the country screen arrives while it goes. */
const WALL_OUT = 5300
const COUNT_AT = 3100
/** Into the country screen: poster, headline and first lit row, counted from WALL_OUT. */
const POSTER_IN = 40
const HEAD_IN = 60
const FIRST_LIT = 200
/** The rows start stepping this long after the first is lit. */
const FIRST_STEP = 450
/** Out of it: the poster and rows leave in OUT_MS; the alert lands ALERT_AFTER later, in ALERT_IN. */
const OUT_MS = 380
const YOU_HOLD = 900
const ALERT_AFTER = 200
const ALERT_IN = 650
const ALERT_HOLD = 1700

export function Streaming({ data }: SceneProps) {
	const m = mapData(data)
	const h = m && homeOf(m, (data.extra.netflix ?? null) as NetflixData | null)
	if (!m || !h || !m.popular.length) return empty
	const stops = [...h.others, h.here]
	const FLIP = WALL_OUT + HEAD_IN
	const first = WALL_OUT + FIRST_LIT
	const steps = stops.slice(1).map((_, k) => first + FIRST_STEP + k * STEP)
	const settled = steps.at(-1)! + 700
	const OUT = settled + YOU_HOLD
	const ALERT = OUT + ALERT_AFTER
	const END = ALERT + ALERT_IN + ALERT_HOLD
	const ROW = 15
	return (
		<div className="intro-atlas-root intro-lite-stream">
			<Wall m={m} dimAt={COUNT_AT - 300} out={WALL_OUT} />
			<Headline
				kicker="Streaming"
				text="Every *service.*"
				delay={150}
				out={1150}
			/>
			<Count m={m} at={COUNT_AT} out={WALL_OUT} />
			{/* While "You" is read, the poster and the rows push in, slowly, until they leave. */}
			<Push
				from={settled - 300}
				dur={YOU_HOLD + 900}
				scale={1.04}
				origin="45% 55%"
			>
				<div className="intro-atlas-abs" style={{ left: "7cqw", top: "33cqh" }}>
					{h.w.poster && (
						<img
							className="intro-atlas-poster intro-atlas-a"
							src={img(h.w.poster)}
							alt=""
							style={{
								height: "44cqh",
								...play(
									["intro-atlas-deal", WALL_OUT + POSTER_IN, 550, DEAL],
									["intro-atlas-zoom-away", OUT, OUT_MS, GLIDE],
								),
							}}
						/>
					)}
				</div>
				<div
					className="intro-isle-carousel intro-atlas-a"
					style={{
						left: "34cqw",
						right: "5cqw",
						top: "33cqh",
						height: "50cqh",
						maskImage:
							"linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)",
						WebkitMaskImage:
							"linear-gradient(180deg, transparent 0%, #000 30%, #000 70%, transparent 100%)",
						...play(
							["intro-atlas-fade-in", WALL_OUT + 150, 350],
							["intro-atlas-zoom-away", OUT, OUT_MS, GLIDE],
						),
					}}
				>
					<Track steps={steps} dy={-ROW}>
						{stops.map((c, k) => {
							const last = k === stops.length - 1
							const you = last && h.you
							return (
								<Lit
									key={c.country}
									from={k ? steps[k - 1] + 120 : first}
									to={last ? undefined : steps[k]}
									className={`intro-isle-row ${you ? "intro-isle-you" : ""}`}
									style={{ top: `${25 - 6.5 + k * ROW}cqh` }}
								>
									<CountryRow c={c} you={you} />
								</Lit>
							)
						})}
					</Track>
				</div>
			</Push>
			<QuickHeadline
				kicker="Streaming"
				text={h.you ? "In *your* country." : "Country by *country.*"}
				delay={FLIP}
				out={OUT - 80}
				sub={
					<span>
						{h.w.title} streams on different services in every country.
					</span>
				}
			/>
			<QuickHeadline
				kicker="Streaming"
				text="Want it? We'll tell you *when* *it's* *on.*"
				delay={OUT + 60}
			/>
			{/* The alert lands, then keeps a slow push-in until the hand-over. */}
			<Push
				from={ALERT + ALERT_IN - 150}
				dur={END - ALERT - ALERT_IN + 150}
				scale={1.03}
				origin="50% 58%"
			>
				<Alert w={h.w} pick={h.pick} at={ALERT} />
			</Push>
		</div>
	)
}

/** The scene's length for the usual five country rows. */
export const STREAMING_MS =
	WALL_OUT +
	FIRST_LIT +
	FIRST_STEP +
	3 * STEP +
	700 +
	YOU_HOLD +
	ALERT_AFTER +
	ALERT_IN +
	ALERT_HOLD
