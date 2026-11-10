// PROTOTYPE (throwaway, branch prototype/yepwatch-og): link-preview card variants for yepwatch.com.
// Start page: A hero, B poster fan, C yep or nope, D app icon.
// Room invite (/r/<code>): A invitation, B amber split, C ticket, D faces.
// Room data is the public invite preview: host name, enabled ideas, kinds, phase, people count.
import type { ReactNode } from "react"

export const W = 1200
export const H = 630
const C = {
	bg: "#070707",
	panel: "#131313",
	line: "rgba(255,255,255,.12)",
	muted: "#a3a3a3",
	soft: "#d4d4d4",
	ink: "#fafafa",
	amber: "#fbbf24",
	amberInk: "#201400",
	red: "#ef4444",
	green: "#22c55e",
}

export type Kind = "movie" | "show_start" | "show_continue"
export type RoomPreview = {
	hostName: string | null
	ideas: { text: string }[]
	kinds: Kind[]
	phase: "setup" | "choosing" | "decided"
	people: number
}
export type CardContent = { posters: string[]; room?: RoomPreview }

export const VARIANTS = {
	start: [
		{ key: "A", name: "Hero: headline left, glowing moon card and faces right (like the page)" },
		{ key: "B", name: "Poster fan: tilted posters, the middle one stamped Yep" },
		{ key: "C", name: "Yep or Nope: one poster between the two vote buttons" },
		{ key: "D", name: "App icon: big icon, wordmark, one line" },
	],
	room: [
		{ key: "A", name: "Invitation: who invited you, ideas as chips, Join button" },
		{ key: "B", name: "Amber split: Join <host>'s room panel, poster fan right" },
		{ key: "C", name: "Ticket: the room as an admission ticket" },
		{ key: "D", name: "Faces: the people in the room plus an open seat for you" },
	],
} as const

const KIND_LABELS: Record<Kind, string> = { movie: "Movies", show_start: "New shows", show_continue: "Continuing shows" }

// All card text in one place.
export const COPY = {
	tagline: ["Choose something", "to watch,", "together."],
	match: "Find your match.",
	swipe: "Swipe together. Watch the match.",
	platforms: "iPhone, Android and the web",
	invited: (host: string | null) => (host ? `${host} invited you` : "You're invited"),
	roomOf: (host: string | null) => (host ? `${host}'s room` : "A YepWatch room"),
	join: (host: string | null) => (host ? `Join ${host}'s room` : "Join the room"),
	decided: (host: string | null) => (host ? `${host}'s room found a match` : "This room found a match"),
	choosing: (people: number) => (people === 1 ? "1 person is choosing" : `${people} people are choosing`),
	inRoom: (people: number) => (people === 1 ? "1 person in the room" : `${people} people in the room`),
	toWatch: "to choose something to watch, together.",
	button: "Join the room",
	seeMatch: "See the match",
	kinds: (kinds: Kind[]) => kinds.map((k) => KIND_LABELS[k]).join(" · "),
}

const font = "Gabarito"

function Row({ children, style }: { children: ReactNode; style?: object }) {
	return <div style={{ display: "flex", flexDirection: "row", ...style }}>{children}</div>
}
function Col({ children, style }: { children: ReactNode; style?: object }) {
	return <div style={{ display: "flex", flexDirection: "column", ...style }}>{children}</div>
}

function Frame({ children, bg = C.bg }: { children: ReactNode; bg?: string }) {
	return (
		<div
			style={{
				width: W,
				height: H,
				display: "flex",
				position: "relative",
				overflow: "hidden",
				background: bg,
				color: C.ink,
				fontFamily: font,
			}}
		>
			{children}
		</div>
	)
}

function Wordmark({ size = 44, ink = C.ink, accent = C.amber }: { size?: number; ink?: string; accent?: string }) {
	return (
		<div style={{ display: "flex", fontSize: size, fontWeight: 700, letterSpacing: -size * 0.03, lineHeight: 1 }}>
			<span style={{ color: ink }}>Yep</span>
			<span style={{ color: accent }}>Watch</span>
		</div>
	)
}

function Glow({ x, y, r, opacity = 0.35 }: { x: number; y: number; r: number; opacity?: number }) {
	return (
		<div
			style={{
				position: "absolute",
				left: x - r,
				top: y - r,
				width: r * 2,
				height: r * 2,
				borderRadius: r,
				background: `radial-gradient(circle, rgba(251,191,36,${opacity}) 0%, rgba(251,191,36,0) 70%)`,
			}}
		/>
	)
}

const svg = (markup: string, w: number, h: number) => (
	<img width={w} height={h} src={`data:image/svg+xml,${encodeURIComponent(markup)}`} />
)

// The app icon (assets/icon.svg) without its square background.
function Icon({ size, bg = true }: { size: number; bg?: boolean }) {
	return svg(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${bg ? '<rect width="128" height="128" rx="28" fill="#141414"/>' : ""}<defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ffdb64"/><stop offset="1" stop-color="#f5a900"/></linearGradient></defs><rect x="25" y="25" width="55" height="77" rx="11" transform="rotate(-14 52 64)" fill="#6c5723" stroke="#dca92b" stroke-width="2"/><rect x="49" y="23" width="55" height="77" rx="11" transform="rotate(10 76 62)" fill="url(#g)"/><g transform="rotate(10 76 62)"><path d="M338 324H269L449 681H606L364 215L374 299V0H228V299L238 215L-3 681H159Z" transform="translate(60.692 80) scale(0.052 -0.052)" fill="#19160e"/></g></svg>`,
		size,
		size,
	)
}

// The start page's moon card illustration.
function MoonCard({ w }: { w: number }) {
	const h = Math.round(w * 1.42)
	return svg(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 142"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#3b3a5e"/><stop offset="1" stop-color="#1c1c2c"/></linearGradient><clipPath id="c"><rect x="1.5" y="1.5" width="97" height="139" rx="9"/></clipPath></defs><g clip-path="url(#c)"><rect width="100" height="142" fill="url(#s)"/><circle cx="52" cy="42" r="26" fill="#fff3c4"/><path d="M0 84 L100 52 L100 142 L0 142Z" fill="#15151f"/><rect x="26" y="114" width="48" height="4" rx="2" fill="#8a8aa0"/><rect x="36" y="124" width="36" height="3" rx="1.5" fill="#55556a"/></g><rect x="1.5" y="1.5" width="97" height="139" rx="9" fill="none" stroke="#fbbf24" stroke-width="3"/></svg>`,
		w,
		h,
	)
}

function Sparkle({ size, outline = false }: { size: number; outline?: boolean }) {
	const d = "M50 0 C54 34 66 46 100 50 C66 54 54 66 50 100 C46 66 34 54 0 50 C34 46 46 34 50 0Z"
	return svg(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 108 108"><path d="${d}" fill="${outline ? "none" : "#fbbf24"}" stroke="#fbbf24" stroke-width="${outline ? 7 : 0}"/></svg>`,
		size,
		size,
	)
}

function Face({ size, tone = "#262626", ink = "#4a4a4a", letter }: { size: number; tone?: string; ink?: string; letter?: string }) {
	if (letter)
		return (
			<div
				style={{
					width: size,
					height: size,
					borderRadius: size,
					background: C.amber,
					color: C.amberInk,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: size * 0.46,
					fontWeight: 700,
				}}
			>
				{letter}
			</div>
		)
	return svg(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="${tone}"/><circle cx="36" cy="42" r="5" fill="${ink}"/><circle cx="64" cy="42" r="5" fill="${ink}"/><path d="M33 60 Q50 74 67 60" stroke="${ink}" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,
		size,
		size,
	)
}

function OpenSeat({ size }: { size: number }) {
	return (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: size,
				border: `4px dashed ${C.amber}`,
				color: C.amber,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: size * 0.32,
				fontWeight: 700,
			}}
		>
			You
		</div>
	)
}

function Poster({ src, w, style }: { src: string; w: number; style?: object }) {
	const h = Math.round(w * 1.5)
	return (
		<div
			style={{
				display: "flex",
				width: w,
				height: h,
				borderRadius: w * 0.08,
				overflow: "hidden",
				boxShadow: "0 18px 40px rgba(0,0,0,.6)",
				...style,
			}}
		>
			<img src={src} width={w} height={h} style={{ objectFit: "cover" }} />
		</div>
	)
}

function Stamp({ size = 40 }: { size?: number }) {
	return (
		<div
			style={{
				display: "flex",
				padding: `${size * 0.12}px ${size * 0.4}px`,
				border: `${size * 0.1}px solid ${C.green}`,
				borderRadius: size * 0.25,
				color: C.green,
				fontSize: size,
				fontWeight: 700,
				transform: "rotate(-14deg)",
				background: "rgba(7,7,7,.55)",
			}}
		>
			YEP
		</div>
	)
}

function VoteButton({ yep, size }: { yep: boolean; size: number }) {
	const color = yep ? C.green : C.red
	const mark = yep
		? `<path d="M28 52 L44 68 L74 34" stroke="${color}" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
		: `<path d="M32 32 L68 68 M68 32 L32 68" stroke="${color}" stroke-width="9" fill="none" stroke-linecap="round"/>`
	return (
		<Col style={{ alignItems: "center", gap: 14 }}>
			{svg(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#131313" stroke="${color}" stroke-width="4"/>${mark}</svg>`,
				size,
				size,
			)}
			<div style={{ display: "flex", fontSize: 30, fontWeight: 700, color }}>{yep ? "Yep" : "Nope"}</div>
		</Col>
	)
}

function Chip({ text, size = 28, solid = false }: { text: string; size?: number; solid?: boolean }) {
	return (
		<div
			style={{
				display: "flex",
				padding: `${size * 0.32}px ${size * 0.7}px`,
				borderRadius: size * 2,
				border: `2px solid ${solid ? C.amber : "rgba(251,191,36,.55)"}`,
				background: solid ? C.amber : "rgba(251,191,36,.1)",
				color: solid ? C.amberInk : C.amber,
				fontSize: size,
				fontWeight: 700,
				maxWidth: 1000,
			}}
		>
			{text}
		</div>
	)
}

function Button({ text, size = 34 }: { text: string; size?: number }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: size * 0.5,
				padding: `${size * 0.5}px ${size * 0.9}px`,
				borderRadius: size * 0.45,
				background: C.amber,
				color: C.amberInk,
				fontSize: size,
				fontWeight: 700,
			}}
		>
			{text}
			<span style={{ fontSize: size * 1.1 }}>→</span>
		</div>
	)
}

// Ideas shown on a card: at most three, cut at 34 characters each.
function ideaTexts(room: RoomPreview, max = 3, len = 34) {
	return room.ideas.slice(0, max).map((i) => (i.text.length > len ? `${i.text.slice(0, len - 1).trimEnd()}…` : i.text))
}

// Shrinks a headline until a rough width estimate fits (Gabarito Bold ≈ 0.52 em per character).
function fit(text: string, max: number, width: number, min = 40) {
	let size = max
	while (size > min && text.length * size * 0.52 > width) size -= 2
	return size
}

function headlineOf(room: RoomPreview) {
	return room.phase === "decided" ? COPY.decided(room.hostName) : COPY.invited(room.hostName)
}

function metaLine(room: RoomPreview) {
	const parts = [room.phase === "choosing" ? COPY.choosing(room.people) : COPY.inRoom(room.people)]
	if (room.kinds.length) parts.push(COPY.kinds(room.kinds))
	return parts.join("  ·  ")
}

// ---------- Start page ----------

function StartA() {
	return (
		<Frame>
			<Glow x={930} y={300} r={330} opacity={0.32} />
			<Col style={{ position: "absolute", left: 80, top: 70, bottom: 70, justifyContent: "space-between" }}>
				<Wordmark size={48} />
				<Col style={{ fontSize: 80, fontWeight: 700, letterSpacing: -2.2, lineHeight: 1.06 }}>
					<div style={{ display: "flex" }}>{COPY.tagline[0]}</div>
					<div style={{ display: "flex" }}>{COPY.tagline[1]}</div>
					<div style={{ display: "flex", color: C.amber }}>{COPY.tagline[2]}</div>
				</Col>
				<div style={{ display: "flex", fontSize: 28, color: C.muted }}>yepwatch.com</div>
			</Col>
			<Col style={{ position: "absolute", left: 760, top: 70, width: 340, alignItems: "center" }}>
				<Row style={{ alignItems: "center", gap: 20 }}>
					<Sparkle size={54} />
					<MoonCard w={210} />
					<Col style={{ gap: 30 }}>
						<Sparkle size={60} outline />
						<Sparkle size={34} />
					</Col>
				</Row>
				<Row style={{ gap: 14, marginTop: -26 }}>
					<Face size={74} />
					<Face size={74} />
					<Face size={74} />
				</Row>
				<Row style={{ marginTop: 34, fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>
					<span>Find&nbsp;</span>
					<span style={{ color: C.amber }}>your match.</span>
				</Row>
			</Col>
		</Frame>
	)
}

function StartB({ posters }: CardContent) {
	const fan = [
		{ x: 60, y: 80, r: -16, w: 190 },
		{ x: 250, y: 46, r: -8, w: 210 },
		{ x: 640, y: 46, r: 8, w: 210 },
		{ x: 850, y: 80, r: 16, w: 190 },
	]
	return (
		<Frame>
			<Glow x={600} y={240} r={360} opacity={0.28} />
			{fan.map((p, i) => (
				<Poster key={i} src={posters[i]} w={p.w} style={{ position: "absolute", left: p.x + 50, top: p.y, transform: `rotate(${p.r}deg)`, opacity: 0.75 }} />
			))}
			<Poster
				src={posters[4]}
				w={250}
				style={{ position: "absolute", left: 475, top: 20, border: `5px solid ${C.amber}`, boxShadow: "0 0 60px rgba(251,191,36,.45)" }}
			/>
			<div style={{ display: "flex", position: "absolute", left: 610, top: 300 }}>
				<Stamp size={48} />
			</div>
			<Row
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					bottom: 0,
					height: 190,
					alignItems: "center",
					justifyContent: "space-between",
					padding: "0 70px",
					background: "linear-gradient(180deg, rgba(7,7,7,0) 0%, rgba(7,7,7,.94) 30%, #070707 100%)",
				}}
			>
				<Wordmark size={64} />
				<div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>{COPY.swipe}</div>
			</Row>
		</Frame>
	)
}

function StartC({ posters }: CardContent) {
	return (
		<Frame>
			<Glow x={600} y={290} r={300} opacity={0.3} />
			<Row style={{ position: "absolute", left: 70, top: 60, right: 70, justifyContent: "space-between", alignItems: "center" }}>
				<Wordmark size={46} />
				<Row style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
					<span>Find&nbsp;</span>
					<span style={{ color: C.amber }}>your match.</span>
				</Row>
			</Row>
			<Row style={{ position: "absolute", left: 0, right: 0, top: 125, justifyContent: "center", alignItems: "center", gap: 90 }}>
				<VoteButton yep={false} size={150} />
				<Poster src={posters[2]} w={250} style={{ border: `4px solid ${C.amber}` }} />
				<VoteButton yep size={150} />
			</Row>
			<Row style={{ position: "absolute", left: 0, right: 0, bottom: 30, justifyContent: "center", gap: 12 }}>
				<Face size={58} />
				<Face size={58} />
				<Face size={58} />
			</Row>
		</Frame>
	)
}

function StartD() {
	return (
		<Frame>
			<Glow x={330} y={315} r={300} opacity={0.3} />
			<div style={{ display: "flex", position: "absolute", left: 120, top: 125 }}>
				<Icon size={380} />
			</div>
			<Col style={{ position: "absolute", left: 590, top: 0, bottom: 0, right: 60, justifyContent: "center", gap: 26 }}>
				<Wordmark size={118} />
				<Col style={{ fontSize: 50, fontWeight: 700, letterSpacing: -1, lineHeight: 1.12 }}>
					<div style={{ display: "flex" }}>Choose something</div>
					<Row>
						<span>to watch,&nbsp;</span>
						<span style={{ color: C.amber }}>together.</span>
					</Row>
				</Col>
				<div style={{ display: "flex", fontSize: 30, color: C.muted }}>{COPY.platforms}</div>
			</Col>
		</Frame>
	)
}

// ---------- Room invite ----------

function RoomA({ room }: CardContent) {
	const r = room!
	const head = headlineOf(r)
	const ideas = ideaTexts(r)
	return (
		<Frame>
			<Glow x={1080} y={110} r={300} opacity={0.22} />
			<Col style={{ position: "absolute", left: 80, top: 64, right: 80, bottom: 64, justifyContent: "space-between" }}>
				<Row style={{ alignItems: "center", gap: 18 }}>
					<Icon size={64} />
					<Wordmark size={44} />
				</Row>
				<Col style={{ gap: 22 }}>
					<div style={{ display: "flex", fontSize: fit(head, 96, 1040, 56), fontWeight: 700, letterSpacing: -2.4, lineHeight: 1.04 }}>{head}</div>
					{r.phase === "decided" ? null : <div style={{ display: "flex", fontSize: 38, color: C.soft }}>{COPY.toWatch}</div>}
					{ideas.length ? (
						<Row style={{ gap: 14, flexWrap: "wrap", marginTop: 6 }}>
							{ideas.map((t) => (
								<Chip key={t} text={t} size={30} />
							))}
						</Row>
					) : null}
				</Col>
				<Row style={{ justifyContent: "space-between", alignItems: "center" }}>
					<div style={{ display: "flex", fontSize: 28, color: C.muted }}>{metaLine(r)}</div>
					<Button text={r.phase === "decided" ? COPY.seeMatch : COPY.button} size={34} />
				</Row>
			</Col>
		</Frame>
	)
}

function RoomB({ room, posters }: CardContent) {
	const r = room!
	const head = r.phase === "decided" ? COPY.decided(r.hostName) : COPY.join(r.hostName)
	const ideas = ideaTexts(r, 3, 28)
	return (
		<Frame>
			<Col style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 660, background: C.amber, color: C.amberInk, padding: "60px 64px", justifyContent: "space-between" }}>
				<Wordmark size={46} ink={C.amberInk} accent="#ffffff" />
				<Col style={{ gap: 20 }}>
					<div style={{ display: "flex", fontSize: fit(head, 88, 540 * 2, 50) , fontWeight: 700, letterSpacing: -2.2, lineHeight: 1.02 }}>{head}</div>
					{ideas.map((t) => (
						<div key={t} style={{ display: "flex", fontSize: 34, fontWeight: 700, opacity: 0.78 }}>
							“{t}”
						</div>
					))}
				</Col>
				<div style={{ display: "flex", fontSize: 27, fontWeight: 700, opacity: 0.7 }}>{metaLine(r)}</div>
			</Col>
			<Glow x={930} y={315} r={280} opacity={0.25} />
			<Poster src={posters[5]} w={190} style={{ position: "absolute", left: 700, top: 150, transform: "rotate(-12deg)", opacity: 0.8 }} />
			<Poster src={posters[6]} w={190} style={{ position: "absolute", left: 960, top: 150, transform: "rotate(12deg)", opacity: 0.8 }} />
			<Poster src={posters[7]} w={220} style={{ position: "absolute", left: 820, top: 110, border: `4px solid ${C.amber}` }} />
		</Frame>
	)
}

function RoomC({ room }: CardContent) {
	const r = room!
	const ideas = ideaTexts(r, 2, 30)
	const title = COPY.roomOf(r.hostName)
	const notch = (side: "left" | "right") => (
		<div style={{ position: "absolute", [side]: -26, top: 199, width: 52, height: 52, borderRadius: 26, background: C.bg }} />
	)
	return (
		<Frame>
			<Glow x={600} y={315} r={420} opacity={0.18} />
			<Row style={{ position: "absolute", left: 70, top: 90, width: 1060, height: 450, borderRadius: 34, background: C.panel, border: `2px solid ${C.line}` }}>
				<Col style={{ flex: 1, padding: "46px 56px", justifyContent: "space-between" }}>
					<Row style={{ fontSize: 24, fontWeight: 700, color: C.amber, letterSpacing: 4 }}>
						{r.phase === "decided" ? "MATCH FOUND" : "ADMIT ONE MORE"}
					</Row>
					<Col style={{ gap: 16 }}>
						<div style={{ display: "flex", fontSize: fit(title, 82, 700, 50), fontWeight: 700, letterSpacing: -2, lineHeight: 1.04 }}>{title}</div>
						{ideas.length ? (
							<div style={{ display: "flex", fontSize: 34, color: C.soft }}>{ideas.join("  ·  ")}</div>
						) : (
							<div style={{ display: "flex", fontSize: 34, color: C.soft }}>{COPY.match}</div>
						)}
					</Col>
					<div style={{ display: "flex", fontSize: 27, color: C.muted }}>{metaLine(r)}</div>
				</Col>
				<div style={{ display: "flex", width: 0, borderLeft: `4px dashed ${C.line}`, margin: "30px 0" }} />
				<Col style={{ width: 300, alignItems: "center", justifyContent: "center", gap: 22 }}>
					<Icon size={150} bg={false} />
					<Wordmark size={40} />
				</Col>
				{notch("left")}
			</Row>
			<div style={{ position: "absolute", left: 806, top: 64, width: 52, height: 52, borderRadius: 26, background: C.bg }} />
			<div style={{ position: "absolute", left: 806, top: 514, width: 52, height: 52, borderRadius: 26, background: C.bg }} />
		</Frame>
	)
}

function RoomD({ room }: CardContent) {
	const r = room!
	const others = Math.max(0, r.people - 1)
	const who = r.hostName ?? "Your friends"
	const head =
		r.phase === "decided"
			? COPY.decided(r.hostName)
			: r.hostName
				? others
					? `${who} and ${others} ${others === 1 ? "friend are" : "friends are"} choosing`
					: `${who} wants to choose with you`
				: `${r.people} ${r.people === 1 ? "person is" : "people are"} choosing`
	const shown = Math.min(r.people, 5)
	const ideas = ideaTexts(r)
	return (
		<Frame>
			<Glow x={600} y={180} r={320} opacity={0.3} />
			<Row style={{ position: "absolute", left: 70, top: 56, right: 70, justifyContent: "space-between" }}>
				<Wordmark size={42} />
				<div style={{ display: "flex", fontSize: 26, color: C.muted }}>{r.kinds.length ? COPY.kinds(r.kinds) : ""}</div>
			</Row>
			<Row style={{ position: "absolute", left: 0, right: 0, top: 120, justifyContent: "center", alignItems: "center", gap: 18 }}>
				{Array.from({ length: shown }, (_, i) =>
					i === 0 && r.hostName ? <Face key={i} size={130} letter={r.hostName[0]!.toUpperCase()} /> : <Face key={i} size={130} />,
				)}
				{r.people > 5 ? <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: C.muted }}>+{r.people - 5}</div> : null}
				{r.phase === "decided" ? null : <OpenSeat size={130} />}
			</Row>
			<Col style={{ position: "absolute", left: 70, right: 70, top: 300, alignItems: "center", gap: 20 }}>
				<div style={{ display: "flex", fontSize: fit(head, 72, 1060, 46), fontWeight: 700, letterSpacing: -1.6, textAlign: "center" }}>{head}</div>
				{ideas.length ? (
					<Row style={{ gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
						{ideas.map((t) => (
							<Chip key={t} text={t} size={28} />
						))}
					</Row>
				) : (
					<div style={{ display: "flex", fontSize: 34, color: C.soft }}>{COPY.toWatch}</div>
				)}
			</Col>
		</Frame>
	)
}

const CARDS = {
	start: { A: StartA, B: StartB, C: StartC, D: StartD },
	room: { A: RoomA, B: RoomB, C: RoomC, D: RoomD },
}

export function PrototypeYepWatchCard({ page, variant, content }: { page: "start" | "room"; variant: "A" | "B" | "C" | "D"; content: CardContent }) {
	const Card = CARDS[page][variant]
	return <Card {...content} />
}
