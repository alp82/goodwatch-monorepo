// PROTOTYPE (throwaway, branch prototype/yepwatch-og), round 3.
// Start page: round 2 card 06 for every vote look. NOPE on the left, YEP on the right, and the logo +
// wordmark (+ short slogan) in the middle instead of a poster.
// Room invite: round 2 card 05 (Nope panel, invite, Yep panel) with a bigger, shorter middle.
import type { ReactNode } from "react"
import {
	Abs,
	C,
	Col,
	COPY2,
	Face,
	fitTo,
	Frame,
	geom,
	GlitchBands,
	GlitchWord,
	H,
	Halo,
	Icon,
	Neon,
	OpenSeat,
	type Content2,
	type PosterSet,
	Rays,
	Row,
	StampImg,
	T,
	W,
	WallImg,
	Word,
	Wordmark,
} from "./PrototypeYepWatchCards2"

export const VARIANTS3 = {
	start: [
		["01", "Giant: NOPE outline and YEP standing on the edges"],
		["02", "Stamp: NOPE and YEP rubber stamps"],
		["03", "Wash: red and amber washed poster panels"],
		["04", "Filter: cold poster with the NOPE band, warm poster with the YEP band"],
		["05", "Neon: red NOPE sign, amber YEP sign"],
		["06", "Wall: a wall of NOPE fading into a wall of YEP"],
		["07", "Burst: red rays from the left, amber rays from the right"],
		["08", "Split: red Nope panel, amber Yep panel"],
		["09", "Bleed: poster colors fill each side"],
		["10", "Echo: NOPE and YEP with a trail"],
		["11", "Glitch: torn NOPE and YEP over glitch bands"],
		["12", "Giant, middle try: big wordmark + 'Choose together.'"],
		["13", "Giant, middle try: big app icon + small wordmark"],
		["14", "Giant, middle try: wordmark + full tagline + platforms"],
		["15", "Neon, middle try: neon wordmark"],
	],
	room: [
		["01", "Big name: host name, 'invited you', Join button"],
		["02", "Faces: host and a friend said Yep, your seat is open"],
		["03", "Join headline: 'Join Alp's room'"],
		["04", "Steps: Join → Swipe → Match in one line"],
		["05", "Icon: big app icon over the invite"],
		["06", "Neon panels + big name"],
		["07", "Wash poster panels + big name"],
		["08", "Stamp panels + big name"],
	],
} as const

const SIDE = 330

function Side({ right = false, children, style }: { right?: boolean; children?: ReactNode; style?: object }) {
	return <Abs style={{ [right ? "right" : "left"]: 0, top: 0, width: SIDE, height: H, alignItems: "center", justifyContent: "center", ...style }}>{children}</Abs>
}

/** Bold line sized to fill `width`, capped at `max`. */
function Head({ text, max, width, color = C.ink, style }: { text: string; max: number; width: number; color?: string; style?: object }) {
	const size = Math.floor(Math.min(max, fitTo(text, width)))
	return (
		<T size={size} color={color} style={{ letterSpacing: -size * 0.03, lineHeight: 1, ...style }}>
			{text}
		</T>
	)
}

// ---------- start page ----------

type Mid = "stack" | "mark" | "icon" | "full" | "neon"

function Brand({ kind = "stack", inset = SIDE }: { kind?: Mid; inset?: number }) {
	const body = {
		stack: (
			<>
				<Icon size={124} />
				<Wordmark size={86} />
				<Col style={{ alignItems: "center", fontSize: 34, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.15, color: C.soft }}>
					<div style={{ display: "flex" }}>Choose something to watch,</div>
					<div style={{ display: "flex", color: C.amber }}>together.</div>
				</Col>
			</>
		),
		mark: (
			<>
				<Wordmark size={112} />
				<Row style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1.2 }}>
					<span>Choose&nbsp;</span>
					<span style={{ color: C.amber }}>together.</span>
				</Row>
			</>
		),
		icon: (
			<>
				<div style={{ display: "flex", position: "relative", width: 230, height: 230 }}>
					<Halo x={115} y={115} r={230} opacity={0.35} />
					<Icon size={230} />
				</div>
				<Wordmark size={60} />
			</>
		),
		full: (
			<>
				<Wordmark size={96} />
				<Col style={{ alignItems: "center", fontSize: 42, fontWeight: 700, letterSpacing: -1, lineHeight: 1.12 }}>
					<div style={{ display: "flex" }}>Choose something</div>
					<Row>
						<span>to watch,&nbsp;</span>
						<span style={{ color: C.amber }}>together.</span>
					</Row>
				</Col>
				<T size={26} color={C.muted} bold={false}>
					{COPY2.platforms}
				</T>
			</>
		),
		neon: (
			<>
				<Row style={{ alignItems: "flex-end" }}>
					<Neon text="Yep" size={96} color="#ffffff" fill="#ffffff" />
					<Neon text="Watch" size={96} />
				</Row>
				<Row style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1, marginTop: 10 }}>
					<span style={{ color: C.soft }}>Choose&nbsp;</span>
					<span style={{ color: C.amber }}>together.</span>
				</Row>
			</>
		),
	}[kind]
	return <Col style={{ position: "absolute", left: inset, right: inset, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 22 }}>{body}</Col>
}

/** Soft red glow on the left, amber on the right. */
function SideGlows({ o = 0.3 }: { o?: number }) {
	return (
		<>
			<Abs style={{ left: 0, top: 0, width: 340, height: H, background: `linear-gradient(90deg, rgba(239,68,68,${o}), rgba(239,68,68,0))` }} />
			<Abs style={{ right: 0, top: 0, width: 340, height: H, background: `linear-gradient(270deg, rgba(251,191,36,${o}), rgba(251,191,36,0))` }} />
		</>
	)
}

function Giant({ mid = "stack" }: { mid?: Mid }) {
	const s = Math.floor(fitTo("NOPE", 560))
	return (
		<Frame>
			<SideGlows />
			<Side>
				<Word text="NOPE" size={s} stroke={C.red} sw={4} style={{ transform: "rotate(-90deg)" }} />
			</Side>
			<Side right>
				<Word text="YEP" size={s} fill={C.amber} glows={[{ color: C.amber, blur: 30, opacity: 0.45 }]} style={{ transform: "rotate(90deg)" }} />
			</Side>
			<Brand kind={mid} />
		</Frame>
	)
}

function SStamp() {
	return (
		<Frame>
			<SideGlows o={0.16} />
			<Side>
				<div style={{ display: "flex", transform: "rotate(-12deg)" }}>
					<StampImg text="NOPE" size={74} color={C.red} bias={8.8} />
				</div>
			</Side>
			<Side right>
				<div style={{ display: "flex", transform: "rotate(9deg)" }}>
					<StampImg text="YEP" size={96} color={C.amber} bias={8.8} />
				</div>
			</Side>
			<Brand />
		</Frame>
	)
}

const BAND = {
	nope: "linear-gradient(180deg, rgba(220,38,38,0) 22%, rgba(185,28,28,.8) 38%, rgba(153,27,27,.93) 50%, rgba(185,28,28,.8) 62%, rgba(220,38,38,0) 78%)",
	yep: "linear-gradient(180deg, rgba(251,191,36,0) 22%, rgba(251,191,36,.8) 38%, rgba(251,191,36,.93) 50%, rgba(251,191,36,.8) 62%, rgba(251,191,36,0) 78%)",
}

/** A tall poster strip; the image covers it. */
function Strip({ src, w, h, right = false, children, style }: { src: string; w: number; h: number; right?: boolean; children?: ReactNode; style?: object }) {
	const iw = Math.max(w, Math.round(h / 1.5))
	const ih = Math.round(iw * 1.5)
	return (
		<div style={{ display: "flex", position: "relative", width: w, height: h, borderRadius: 26, overflow: "hidden", ...style }}>
			<img src={src} width={iw} height={ih} style={{ position: "absolute", left: (w - iw) / 2, top: (h - ih) / 2 }} />
			{children}
		</div>
	)
}

function Fill({ children, style }: { children?: ReactNode; style?: object }) {
	return <Abs style={{ left: 0, top: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", ...style }}>{children}</Abs>
}

function SWash({ posters }: Content2) {
	const w = 280
	const h = 570
	return (
		<Frame>
			<Side>
				<Strip src={posters[1].washNope} w={w} h={h}>
					<Fill style={{ background: BAND.nope }}>
						<Word text="NOPE" size={fitTo("NOPE", w * 0.84)} fill={C.cream} />
					</Fill>
				</Strip>
			</Side>
			<Side right>
				<Strip src={posters[0].wash} w={w} h={h}>
					<Fill style={{ background: BAND.yep }}>
						<Word text="YEP" size={fitTo("YEP", w * 0.76)} fill={C.ink2} />
					</Fill>
				</Strip>
			</Side>
			<Brand />
		</Frame>
	)
}

function SFilter({ posters }: Content2) {
	const w = 260
	const h = 540
	const band = 92
	const len = Math.hypot(w, h)
	const bar = (color: string, deg: number, word: ReactNode) => (
		<Abs style={{ left: (w - len) / 2, top: h * 0.5 - band / 2, width: len, height: band, transform: `rotate(${deg}deg)`, background: color, borderTop: "3px solid rgba(0,0,0,.25)", borderBottom: "3px solid rgba(0,0,0,.25)", alignItems: "center", justifyContent: "center" }}>
			{word}
		</Abs>
	)
	return (
		<Frame>
			<Side>
				<Strip src={posters[1].cold} w={w} h={h} style={{ border: "2px solid rgba(239,68,68,.5)" }}>
					{bar(C.red, 14, <Word text="NOPE" size={band * 0.78} fill={C.cream} />)}
				</Strip>
			</Side>
			<Side right>
				<Strip src={posters[0].warm} w={w} h={h} style={{ boxShadow: `0 0 40px 12px ${C.amber}` }}>
					{bar(C.amber, -14, <Word text="YEP" size={band * 0.78} fill={C.ink2} />)}
				</Strip>
			</Side>
			<Brand />
		</Frame>
	)
}

function SNeon({ mid = "stack" }: { mid?: Mid }) {
	return (
		<Frame>
			<Side>
				<Neon text="NOPE" size={Math.floor(fitTo("NOPE", 250))} color={C.red} fill="#fff1f1" />
			</Side>
			<Side right>
				<Neon text="YEP" size={Math.floor(fitTo("YEP", 220))} />
			</Side>
			<Brand kind={mid} />
		</Frame>
	)
}

function SWall() {
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0 }}>
				<WallImg w={520} h={H} size={74} color={C.red} opacity={0.8} text="NOPE" />
			</Abs>
			<Abs style={{ left: 680, top: 0 }}>
				<WallImg w={520} h={H} size={74} color={C.amber} opacity={0.8} />
			</Abs>
			<Abs
				style={{
					left: 0,
					top: 0,
					width: W,
					height: H,
					background: "linear-gradient(90deg, rgba(7,7,7,.1) 0%, rgba(7,7,7,.45) 18%, #070707 33%, #070707 67%, rgba(7,7,7,.45) 82%, rgba(7,7,7,.1) 100%)",
				}}
			/>
			<Brand />
		</Frame>
	)
}

function SBurst() {
	const D = 1100
	return (
		<Frame>
			<Abs style={{ left: -D / 2, top: H / 2 - D / 2, opacity: 0.75 }}>
				<Rays size={D} color={C.red} widthDeg={8} />
			</Abs>
			<Abs style={{ left: W - D / 2, top: H / 2 - D / 2, opacity: 0.8 }}>
				<Rays size={D} color={C.amber} widthDeg={8} from={11.25} />
			</Abs>
			<Halo x={60} y={H / 2} r={300} opacity={0.6} color="254,202,202" />
			<Halo x={W - 60} y={H / 2} r={300} opacity={0.7} color="253,230,138" />
			<Abs style={{ left: 0, top: 0, width: W, height: H, background: "linear-gradient(90deg, rgba(7,7,7,0) 0%, rgba(7,7,7,0) 20%, #070707 36%, #070707 64%, rgba(7,7,7,0) 80%)" }} />
			<Side>
				<Word text="NOPE" size={Math.floor(fitTo("NOPE", 270))} fill={C.cream} drop={{ dy: 9, color: C.redDeep }} glows={[{ color: "#000", blur: 18, opacity: 0.6 }]} style={{ transform: "rotate(-7deg)" }} />
			</Side>
			<Side right>
				<Word text="YEP" size={Math.floor(fitTo("YEP", 250))} fill="#fff8e6" drop={{ dy: 10, color: C.amberDeep }} glows={[{ color: "#000", blur: 18, opacity: 0.6 }]} style={{ transform: "rotate(7deg)" }} />
			</Side>
			<Brand />
		</Frame>
	)
}

function SplitPanels({ width = 300, word = 0 }: { width?: number; word?: number }) {
	const s = word || Math.floor(Math.min(width * 0.72, fitTo("NOPE", 540)))
	return (
		<>
			<Abs style={{ left: 0, top: 0, width, height: H, borderTopRightRadius: 28, borderBottomRightRadius: 28, background: `linear-gradient(225deg, #f87171 0%, ${C.red} 50%, ${C.redDeep} 100%)`, alignItems: "center", justifyContent: "center" }}>
				<Word text="NOPE" size={s} fill={C.cream} style={{ transform: "rotate(-90deg)" }} />
			</Abs>
			<Abs style={{ right: 0, top: 0, width, height: H, borderTopLeftRadius: 28, borderBottomLeftRadius: 28, background: `linear-gradient(135deg, ${C.amber} 0%, #f59e0b 50%, ${C.amberDeep} 100%)`, alignItems: "center", justifyContent: "center" }}>
				<Word text="YEP" size={s} fill={C.ink2} style={{ transform: "rotate(90deg)" }} />
			</Abs>
		</>
	)
}

function SSplit() {
	return (
		<Frame>
			<SplitPanels />
			<Brand inset={300} />
		</Frame>
	)
}

function SBleed({ posters }: Content2) {
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0, width: 460, height: H, overflow: "hidden" }}>
				<img src={posters[1].bleedNope} width={460} height={690} style={{ position: "absolute", left: 0, top: -30 }} />
			</Abs>
			<Abs style={{ right: 0, top: 0, width: 460, height: H, overflow: "hidden" }}>
				<img src={posters[0].bleed} width={460} height={690} style={{ position: "absolute", left: 0, top: -30 }} />
			</Abs>
			<Abs style={{ left: 0, top: 0, width: W, height: H, background: "linear-gradient(90deg, rgba(7,7,7,.1) 0%, rgba(7,7,7,.2) 18%, #070707 36%, #070707 64%, rgba(7,7,7,.2) 82%, rgba(7,7,7,.1) 100%)" }} />
			<Side>
				<Word text="NOPE" size={Math.floor(fitTo("NOPE", 270))} fill="#fff5f5" drop={{ dy: 6, color: "rgba(60,0,0,.4)" }} glows={[{ color: "#000", blur: 22, opacity: 0.55 }]} />
			</Side>
			<Side right>
				<Word text="YEP" size={Math.floor(fitTo("YEP", 240))} fill="#fffaf0" drop={{ dy: 6, color: "rgba(32,20,0,.4)" }} glows={[{ color: "#000", blur: 22, opacity: 0.55 }]} />
			</Side>
			<Brand />
		</Frame>
	)
}

/** The word with a trail stacked above it. */
function EchoY({ text, size, color }: { text: string; size: number; color: string; deep?: string }) {
	const TRAIL = [0, 0.55, 0.3, 0.14]
	const n = TRAIL.length - 1
	const step = size * 0.2
	const { w } = geom(text, size)
	return (
		<div style={{ display: "flex", position: "relative", width: w, height: size + step * n }}>
			{[3, 2, 1].map((k) => (
				<Abs key={k} style={{ left: 0, top: (n - k) * step, opacity: TRAIL[k] }}>
					<Word text={text} size={size} stroke={color} sw={2.5} />
				</Abs>
			))}
			<Abs style={{ left: 0, top: n * step }}>
				<Word text={text} size={size} fill={color} glows={[{ color: "#000", blur: 14, opacity: 0.8 }]} />
			</Abs>
		</div>
	)
}

function SEcho() {
	return (
		<Frame>
			<SideGlows o={0.14} />
			<Side>
				<EchoY text="NOPE" size={Math.floor(fitTo("NOPE", 260))} color={C.red} deep={C.redDeep} />
			</Side>
			<Side right>
				<EchoY text="YEP" size={Math.floor(fitTo("YEP", 230))} color={C.amber} deep={C.amberDeep} />
			</Side>
			<Brand />
		</Frame>
	)
}

function SGlitch() {
	return (
		<Frame>
			<GlitchBands w={W} h={H} />
			<Abs style={{ left: 0, top: 0, width: W, height: H, background: "linear-gradient(90deg, rgba(7,7,7,0) 0%, rgba(7,7,7,.3) 22%, #070707 36%, #070707 64%, rgba(7,7,7,.3) 78%, rgba(7,7,7,0) 100%)" }} />
			<Side>
				<GlitchWord text="NOPE" size={Math.floor(fitTo("NOPE", 250))} color={C.red} shadow={C.amber} />
			</Side>
			<Side right>
				<GlitchWord text="YEP" size={Math.floor(fitTo("YEP", 220))} />
			</Side>
			<Brand />
		</Frame>
	)
}

// ---------- room invite ----------

const lines = (host: string | null) => (host ? [host, "invited you"] : ["You're", "invited"])
const MID = 680

function BrandRow({ size = 32 }: { size?: number }) {
	return (
		<Row style={{ alignItems: "center", gap: 12 }}>
			<Icon size={Math.round(size * 1.4)} />
			<Wordmark size={size} />
		</Row>
	)
}

function JoinButton({ size = 42 }: { size?: number }) {
	return (
		<div style={{ display: "flex", padding: `${size * 0.45}px ${size * 1.05}px`, borderRadius: size * 0.5, background: C.amber, color: C.ink2, fontSize: size, fontWeight: 700, letterSpacing: -size * 0.02, gap: size * 0.35, boxShadow: "0 10px 40px rgba(251,191,36,.35)" }}>
			{COPY2.join}
			<span>→</span>
		</div>
	)
}

function Middle({ children, inset = 200, gap = 30 }: { children: ReactNode; inset?: number; gap?: number }) {
	return <Col style={{ position: "absolute", left: inset, right: inset, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap }}>{children}</Col>
}

function BigName({ host }: { host: string | null }) {
	const [a, b] = lines(host)
	return (
		<Col style={{ alignItems: "center", gap: 6 }}>
			<Head text={a!} max={140} width={MID} color={C.amber} />
			<Head text={b!} max={88} width={MID} />
		</Col>
	)
}

function MidBigName({ host }: { host: string | null }) {
	return (
		<Middle>
			<BrandRow />
			<BigName host={host} />
			<JoinButton />
		</Middle>
	)
}

function RoomPanels({ kind, posters }: { kind: "split" | "neon" | "wash" | "stamp"; posters: PosterSet[] }) {
	if (kind === "split") return <SplitPanels width={200} word={130} />
	const w = 176
	const h = 582
	const box = (right: boolean, children: ReactNode, style: object) => (
		<Abs style={{ [right ? "right" : "left"]: 24, top: 24, width: w, height: h, borderRadius: 26, overflow: "hidden", alignItems: "center", justifyContent: "center", ...style }}>{children}</Abs>
	)
	if (kind === "neon")
		return (
			<>
				{box(false, <div style={{ display: "flex", transform: "rotate(-90deg)" }}><Neon text="NOPE" size={104} color={C.red} fill="#fff1f1" /></div>, { background: "#0d0d0d", border: "2px solid rgba(239,68,68,.45)" })}
				{box(true, <div style={{ display: "flex", transform: "rotate(90deg)" }}><Neon text="YEP" size={120} /></div>, { background: "#0d0d0d", border: "2px solid rgba(251,191,36,.5)" })}
			</>
		)
	if (kind === "wash")
		return (
			<>
				{box(
					false,
					<Strip src={posters[1].washNope} w={w} h={h} style={{ borderRadius: 0 }}>
						<Fill style={{ background: BAND.nope.replace("180deg", "90deg") }}>
							<Word text="NOPE" size={118} fill={C.cream} style={{ transform: "rotate(-90deg)" }} />
						</Fill>
					</Strip>,
					{},
				)}
				{box(
					true,
					<Strip src={posters[0].wash} w={w} h={h} style={{ borderRadius: 0 }}>
						<Fill style={{ background: BAND.yep.replace("180deg", "90deg") }}>
							<Word text="YEP" size={130} fill={C.ink2} style={{ transform: "rotate(90deg)" }} />
						</Fill>
					</Strip>,
					{},
				)}
			</>
		)
	return (
		<>
			{box(false, <div style={{ display: "flex", transform: "rotate(-82deg)" }}><StampImg text="NOPE" size={84} color={C.red} bias={8.8} /></div>, { background: C.panel, border: `2px solid ${C.line}` })}
			{box(true, <div style={{ display: "flex", transform: "rotate(84deg)" }}><StampImg text="YEP" size={96} color={C.amber} bias={8.8} /></div>, { background: C.panel, border: `2px solid ${C.line}` })}
		</>
	)
}

function R01({ posters, host }: Content2) {
	return (
		<Frame>
			<RoomPanels kind="split" posters={posters} />
			<MidBigName host={host} />
		</Frame>
	)
}

function R02({ posters, host }: Content2) {
	const s = 124
	return (
		<Frame>
			<RoomPanels kind="split" posters={posters} />
			<Middle gap={34}>
				<Row style={{ alignItems: "center", gap: 22 }}>
					{host ? <Face size={s} letter={host[0]!.toUpperCase()} yep /> : <Face size={s} yep />}
					<Face size={s} yep />
					<OpenSeat size={s} />
				</Row>
				<Head text={COPY2.invited(host)} max={84} width={MID} />
				<JoinButton />
			</Middle>
		</Frame>
	)
}

function R03({ posters, host }: Content2) {
	return (
		<Frame>
			<RoomPanels kind="split" posters={posters} />
			<Middle gap={26}>
				<Col style={{ alignItems: "center", gap: 4 }}>
					<Head text="Join" max={118} width={MID} />
					<Head text={host ? `${host}'s room` : "the room"} max={118} width={MID} color={C.amber} />
				</Col>
				<T size={36} color={C.soft} bold={false}>
					Swipe until everyone says Yep.
				</T>
				<BrandRow size={36} />
			</Middle>
		</Frame>
	)
}

function R04({ posters, host }: Content2) {
	const steps = "Join → Swipe → Match"
	const s = Math.floor(Math.min(72, fitTo(steps, MID - 140)))
	return (
		<Frame>
			<RoomPanels kind="split" posters={posters} />
			<Middle gap={40}>
				<BrandRow />
				<Head text={COPY2.invited(host)} max={86} width={MID} />
				<Row style={{ alignItems: "center", gap: s * 0.3, fontSize: s, fontWeight: 700, letterSpacing: -s * 0.03, padding: "18px 34px", borderRadius: 999, background: C.panel, border: `2px solid ${C.line}` }}>
					<span>Join</span>
					<span style={{ color: C.muted }}>→</span>
					<span>Swipe</span>
					<span style={{ color: C.muted }}>→</span>
					<span style={{ color: C.amber }}>Match</span>
				</Row>
			</Middle>
		</Frame>
	)
}

function R05({ posters, host }: Content2) {
	return (
		<Frame>
			<RoomPanels kind="split" posters={posters} />
			<Middle gap={30}>
				<div style={{ display: "flex", position: "relative", width: 190, height: 190 }}>
					<Halo x={95} y={95} r={200} opacity={0.3} />
					<Icon size={190} />
				</div>
				<Head text={COPY2.invited(host)} max={84} width={MID} />
				<JoinButton />
			</Middle>
		</Frame>
	)
}

function R06({ posters, host }: Content2) {
	return (
		<Frame>
			<RoomPanels kind="neon" posters={posters} />
			<MidBigName host={host} />
		</Frame>
	)
}

function R07({ posters, host }: Content2) {
	return (
		<Frame>
			<RoomPanels kind="wash" posters={posters} />
			<MidBigName host={host} />
		</Frame>
	)
}

function R08({ posters, host }: Content2) {
	return (
		<Frame>
			<RoomPanels kind="stamp" posters={posters} />
			<MidBigName host={host} />
		</Frame>
	)
}

const START: Record<string, (c: Content2) => ReactNode> = {
	"01": () => <Giant />,
	"02": () => <SStamp />,
	"03": SWash,
	"04": SFilter,
	"05": () => <SNeon />,
	"06": () => <SWall />,
	"07": () => <SBurst />,
	"08": () => <SSplit />,
	"09": SBleed,
	"10": () => <SEcho />,
	"11": () => <SGlitch />,
	"12": () => <Giant mid="mark" />,
	"13": () => <Giant mid="icon" />,
	"14": () => <Giant mid="full" />,
	"15": () => <SNeon mid="neon" />,
}
const ROOM: Record<string, (c: Content2) => ReactNode> = { "01": R01, "02": R02, "03": R03, "04": R04, "05": R05, "06": R06, "07": R07, "08": R08 }

export function PrototypeYepWatchCard3({ page, variant, content }: { page: "start" | "room"; variant: string; content: Content2 }) {
	return (page === "start" ? START : ROOM)[variant]!(content) as never
}
