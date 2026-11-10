// PROTOTYPE (throwaway, branch prototype/yepwatch-og), round 2.
// Start page: hybrids of round 1 C (the vote demo) and D (big wordmark + tagline), one per vote look.
// Room invite: static cards (host name only; no phase, people or ideas, since previews stay cached),
// each showing how a room works.
// YEP / NOPE / MATCH are drawn as Gabarito Bold outlines (opentype), like the app's Word and Outline.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import opentype from "@shuding/opentype.js"
import type { ReactNode } from "react"

export const W = 1200
export const H = 630
export const C = {
	bg: "#070707",
	panel: "#131313",
	line: "rgba(255,255,255,.12)",
	muted: "#a3a3a3",
	soft: "#d4d4d4",
	ink: "#fafafa",
	amber: "#fbbf24",
	amberDeep: "#b45309",
	ink2: "#201400",
	red: "#ef4444",
	redDeep: "#7f1d1d",
	cream: "#fff7ec",
}

export type PosterSet = { plain: string; wash: string; washNope: string; warm: string; cold: string; bleed: string; bleedNope: string; gray: string }
export type Content2 = { posters: PosterSet[]; host: string | null }

export const VARIANTS2 = {
	start: [
		["01", "Vote buttons: Nope, poster, Yep (C's demo in D's layout)"],
		["02", "Stamp: YEP rubber stamp on a tilted poster"],
		["03", "Wash: a Yep card over a Nope card"],
		["04", "Filter: amber halo and the YEP band"],
		["05", "Neon: YEP sign lit over the poster"],
		["06", "Giant: NOPE outline, poster, YEP; wordmark row under"],
		["07", "Wall: rows of YEP behind the poster"],
		["08", "Burst: amber rays and a tilted YEP"],
		["09", "Split: the Yep half lit, poster on its edge"],
		["10", "Bleed: the poster's colors fill the side"],
		["11", "Echo: YEP with its trail"],
		["12", "Glitch: torn YEP over glitch bands"],
		["13", "Match: MATCH poster, three friends said Yep"],
		["14", "Story: Nope, Yep, Match in a row"],
	],
	room: [
		["01", "Three steps: Join, Swipe, Match tiles"],
		["02", "Invite + vote demo (start 01 with the invite)"],
		["03", "Equation: Yep + Yep + Yep = MATCH"],
		["04", "Wall: invite on a wall of YEP"],
		["05", "Split: Nope panel, invite, Yep panel"],
		["06", "Stamp: invite left, stamped poster right"],
		["07", "Neon: YEP sign over the invite"],
		["08", "Burst: MATCH poster in amber rays"],
		["09", "Swipe stack: top card leaving with Yep"],
		["10", "Ticket: stub with the three steps"],
		["11", "Echo: invite over a YEP trail"],
		["12", "Phone: the voting screen, cut off at the bottom"],
	],
} as const

// All card text in one place.
export const COPY2 = {
	tagline: ["Choose something", "to watch,", "together."],
	platforms: "iPhone, Android and the web",
	invited: (host: string | null) => (host ? `${host} invited you` : "You're invited"),
	sub1: "Swipe Yep or Nope together.",
	sub2: "When everyone says Yep, it's a match.",
	join: "Join the room",
	steps: ["Join", "Swipe", "Match"],
	stepNotes: ["Open the link", "Yep or Nope", "Everyone said Yep"],
	room: (host: string | null) => (host ? `${host}'s room` : "A YepWatch room"),
}

// ---------- words as outlines ----------

const fontFile = readFileSync(join(process.cwd(), "app/server/og-image/fonts/Gabarito-Bold.ttf"))
const font = opentype.parse(fontFile.buffer.slice(fontFile.byteOffset, fontFile.byteOffset + fontFile.byteLength))
const TRACK = -0.03
const CAP = (font.tables.os2?.sCapHeight ?? 700) / font.unitsPerEm

export function geom(text: string, size: number) {
	const scale = size / font.unitsPerEm
	const base = size / 2 + (CAP * size) / 2
	let x = 0
	const parts: string[] = []
	for (const g of font.stringToGlyphs(text)) {
		parts.push(g.getPath(x, base, size).toPathData(2))
		x += g.advanceWidth * scale + TRACK * size
	}
	return { d: parts.join(""), w: Math.ceil(x - TRACK * size) }
}
/** Font size so `text` is `width` wide. */
export const fitTo = (text: string, width: number) => width / (geom(text, 100).w / 100)

type Glow = { color: string; blur: number; opacity?: number }
type WordOpts = { fill?: string; stroke?: string; sw?: number; glows?: Glow[]; drop?: { dy: number; color: string }; opacity?: number }

export function wordSvg(text: string, size: number, o: WordOpts, pad: number) {
	const { d, w } = geom(text, size)
	const glows = (o.glows ?? [])
		.map(
			(g, i) =>
				`<filter id="f${i}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${g.blur}"/></filter><path d="${d}" fill="${g.color}" opacity="${g.opacity ?? 1}" filter="url(#f${i})"/>`,
		)
		.join("")
	const drop = o.drop ? `<path d="${d}" fill="${o.drop.color}" transform="translate(0 ${o.drop.dy})"/>` : ""
	const main = `<path d="${d}" fill="${o.fill ?? "none"}" ${o.stroke ? `stroke="${o.stroke}" stroke-width="${o.sw ?? 2}" stroke-linejoin="round"` : ""}/>`
	return {
		w,
		markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${size + pad * 2}" viewBox="${-pad} ${-pad} ${w + pad * 2} ${size + pad * 2}">${glows}${drop}${main}</svg>`,
	}
}

export const uri = (markup: string) => `data:image/svg+xml,${encodeURIComponent(markup)}`

/** A word whose layout box is its own width × size; glow and drop paint outside it. */
export function Word({ text, size, style, ...o }: { text: string; size: number; style?: object } & WordOpts) {
	const pad = Math.ceil(Math.max(0, ...(o.glows ?? []).map((g) => g.blur * 3), o.drop?.dy ?? 0, o.sw ?? 0))
	const { w, markup } = wordSvg(text, size, o, pad)
	return (
		<div style={{ display: "flex", position: "relative", width: w, height: size, opacity: o.opacity ?? 1, ...style }}>
			<img src={uri(markup)} width={w + pad * 2} height={size + pad * 2} style={{ position: "absolute", left: -pad, top: -pad }} />
		</div>
	)
}

// ---------- shared parts ----------

export function Frame({ children, bg = C.bg }: { children: ReactNode; bg?: string }) {
	return (
		<div style={{ width: W, height: H, display: "flex", position: "relative", overflow: "hidden", background: bg, color: C.ink, fontFamily: "Gabarito" }}>
			{children}
		</div>
	)
}
export function Abs({ children, style }: { children?: ReactNode; style: object }) {
	return <div style={{ display: "flex", position: "absolute", ...style }}>{children}</div>
}
export function Col({ children, style }: { children: ReactNode; style?: object }) {
	return <div style={{ display: "flex", flexDirection: "column", ...style }}>{children}</div>
}
export function Row({ children, style }: { children: ReactNode; style?: object }) {
	return <div style={{ display: "flex", flexDirection: "row", ...style }}>{children}</div>
}
export function T({ children, size, color = C.ink, bold = true, style }: { children: ReactNode; size: number; color?: string; bold?: boolean; style?: object }) {
	return (
		<div style={{ display: "flex", fontSize: size, fontWeight: bold ? 700 : 400, color, letterSpacing: bold ? -size * 0.025 : 0, lineHeight: 1.12, ...style }}>{children}</div>
	)
}

export function Wordmark({ size = 44, ink = C.ink, accent = C.amber }: { size?: number; ink?: string; accent?: string }) {
	return (
		<div style={{ display: "flex", fontSize: size, fontWeight: 700, letterSpacing: -size * 0.03, lineHeight: 1 }}>
			<span style={{ color: ink }}>Yep</span>
			<span style={{ color: accent }}>Watch</span>
		</div>
	)
}

export function Halo({ x, y, r, opacity = 0.3, color = "251,191,36" }: { x: number; y: number; r: number; opacity?: number; color?: string }) {
	return (
		<Abs
			style={{
				left: x - r,
				top: y - r,
				width: r * 2,
				height: r * 2,
				borderRadius: r,
				background: `radial-gradient(circle, rgba(${color},${opacity}) 0%, rgba(${color},0) 70%)`,
			}}
		/>
	)
}

export function Icon({ size }: { size: number }) {
	return (
		<img
			width={size}
			height={size}
			src={uri(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#141414"/><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#ffdb64"/><stop offset="1" stop-color="#f5a900"/></linearGradient></defs><rect x="25" y="25" width="55" height="77" rx="11" transform="rotate(-14 52 64)" fill="#6c5723" stroke="#dca92b" stroke-width="2"/><rect x="49" y="23" width="55" height="77" rx="11" transform="rotate(10 76 62)" fill="url(#g)"/><g transform="rotate(10 76 62)"><path d="M338 324H269L449 681H606L364 215L374 299V0H228V299L238 215L-3 681H159Z" transform="translate(60.692 80) scale(0.052 -0.052)" fill="#19160e"/></g></svg>`,
			)}
		/>
	)
}

export function Poster({ src, w, style, children, radius }: { src: string; w: number; style?: object; children?: ReactNode; radius?: number }) {
	const h = Math.round(w * 1.5)
	return (
		<div style={{ display: "flex", position: "relative", width: w, height: h, borderRadius: radius ?? Math.round(w * 0.06), overflow: "hidden", boxShadow: "0 22px 50px rgba(0,0,0,.65)", ...style }}>
			<img src={src} width={w} height={h} style={{ position: "absolute", left: 0, top: 0, objectFit: "cover" }} />
			{children}
		</div>
	)
}

/** Centers a child over a poster-sized box. */
export function Center({ children, top = "44%" }: { children: ReactNode; top?: string }) {
	return (
		<Abs style={{ left: 0, right: 0, top, height: 0, alignItems: "center", justifyContent: "center" }}>
			{children}
		</Abs>
	)
}

export function Face({ size, letter, yep = false }: { size: number; letter?: string; yep?: boolean }) {
	const face = letter ? (
		<div style={{ display: "flex", width: size, height: size, borderRadius: size, background: C.amber, color: C.ink2, alignItems: "center", justifyContent: "center", fontSize: size * 0.46, fontWeight: 700 }}>
			{letter}
		</div>
	) : (
		<img
			width={size}
			height={size}
			src={uri(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="#262626"/><circle cx="36" cy="42" r="5" fill="#5a5a5a"/><circle cx="64" cy="42" r="5" fill="#5a5a5a"/><path d="M33 60 Q50 74 67 60" stroke="#5a5a5a" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,
			)}
		/>
	)
	if (!yep) return face
	const b = Math.round(size * 0.42)
	return (
		<div style={{ display: "flex", position: "relative", width: size, height: size }}>
			{face}
			<Abs style={{ right: -b * 0.15, bottom: -b * 0.15, width: b, height: b, borderRadius: b, background: C.amber, border: `3px solid ${C.bg}`, alignItems: "center", justifyContent: "center" }}>
				<img width={b * 0.62} height={b * 0.62} src={uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M20 54 L42 74 L82 28" stroke="${C.ink2}" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`)} />
			</Abs>
		</div>
	)
}

export function OpenSeat({ size }: { size: number }) {
	return (
		<div style={{ display: "flex", width: size, height: size, borderRadius: size, border: `3px dashed ${C.amber}`, color: C.amber, alignItems: "center", justifyContent: "center", fontSize: size * 0.32, fontWeight: 700 }}>
			You
		</div>
	)
}

export function VoteButton({ yep, size, label = true }: { yep: boolean; size: number; label?: boolean }) {
	const color = yep ? C.amber : C.red
	const mark = yep
		? `<path d="M30 52 L45 67 L72 36" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
		: `<path d="M34 34 L66 66 M66 34 L34 66" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round"/>`
	return (
		<Col style={{ alignItems: "center", gap: 10 }}>
			<img width={size} height={size} src={uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#131313" stroke="${color}" stroke-width="4"/>${mark}</svg>`)} />
			{label ? <T size={Math.round(size * 0.3)} color={color}>{yep ? "Yep" : "Nope"}</T> : null}
		</Col>
	)
}

export function StampImg({ text, size, color, bias = 7.6 }: { text: string; size: number; color: string; bias?: number }) {
	const { d, w } = geom(text, size)
	const border = Math.max(7, Math.round(size * 0.11))
	const bw = w + size * 0.26 * 2 + border * 2
	const bh = size + size * 0.2 * 2 + border * 2
	const inset = border * 1.7
	const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${bw}" height="${bh}" viewBox="0 0 ${bw} ${bh}"><defs><filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.045 0.06" numOctaves="3" seed="7" result="t"/><feColorMatrix in="t" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -11 0 0 0 ${bias}" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter></defs><g filter="url(#n)"><rect x="${border / 2}" y="${border / 2}" width="${bw - border}" height="${bh - border}" rx="${size * 0.16}" fill="none" stroke="${color}" stroke-width="${border}"/><rect x="${inset}" y="${inset}" width="${bw - inset * 2}" height="${bh - inset * 2}" rx="${size * 0.08}" fill="none" stroke="${color}" stroke-width="${Math.max(2, border * 0.38)}"/><path d="${d}" fill="${color}" transform="translate(${(bw - w) / 2} ${(bh - size) / 2})"/></g></svg>`
	return <img src={uri(markup)} width={bw} height={bh} />
}

export function Rays({ size, color, opacity = 1, widthDeg = 8, from = 0 }: { size: number; color: string; opacity?: number; widthDeg?: number; from?: number }) {
	const r = size / 2
	const wedges = Array.from({ length: 16 }, (_, i) => {
		const a0 = ((from + i * 22.5 - widthDeg / 2) * Math.PI) / 180
		const a1 = ((from + i * 22.5 + widthDeg / 2) * Math.PI) / 180
		return `<path d="M${r} ${r} L${r + r * Math.cos(a0)} ${r + r * Math.sin(a0)} L${r + r * Math.cos(a1)} ${r + r * Math.sin(a1)}Z"/>`
	}).join("")
	return <img width={size} height={size} src={uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><g fill="${color}" opacity="${opacity}">${wedges}</g></svg>`)} />
}

export function WallImg({ w, h, size, color, opacity = 1, text = "YEP" }: { w: number; h: number; size: number; color: string; opacity?: number; text?: string }) {
	const { d, w: ww } = geom(text, size)
	const step = ww + size * 0.5
	const rowH = size * 1.06
	const rows = Math.ceil(h / rowH) + 1
	const cols = Math.ceil(w / step) + 2
	let body = ""
	for (let r = 0; r < rows; r++) {
		const phase = ((r * 0.37) % 1) * step
		for (let k = -1; k < cols; k++) {
			const x = k * step - phase
			const y = r * rowH - size * 0.3
			body += r % 2 ? `<path d="${d}" transform="translate(${x} ${y})" fill="none" stroke="${color}" stroke-width="2.5"/>` : `<path d="${d}" transform="translate(${x} ${y})" fill="${color}"/>`
		}
	}
	return <img width={w} height={h} src={uri(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g opacity="${opacity}">${body}</g></svg>`)} />
}

export function GlitchBands({ w, h }: { w: number; h: number }) {
	const bands = [
		[0.12, 0.05, C.amber, 0.55],
		[0.24, 0.018, "#ffffff", 0.5],
		[0.4, 0.09, C.amberDeep, 0.5],
		[0.58, 0.03, C.red, 0.6],
		[0.7, 0.012, "#ffffff", 0.7],
		[0.83, 0.06, C.amber, 0.4],
	] as const
	const offsets = [-80, 60, -30, 110, -120, 40]
	return (
		<Abs style={{ left: 0, top: 0, width: w, height: h }}>
			{bands.map(([y, hh, color, o], k) => (
				<Abs
					key={k}
					style={{
						left: offsets[k],
						width: w,
						top: y * h,
						height: Math.max(3, hh * h),
						opacity: o,
						background: `linear-gradient(90deg, ${color}00 0%, ${color} 30%, ${color} 70%, ${color}00 100%)`,
					}}
				/>
			))}
		</Abs>
	)
}

export function GlitchWord({ text, size, color = C.amber, shadow = C.red }: { text: string; size: number; color?: string; shadow?: string }) {
	const { d, w } = geom(text, size)
	const dx = size * 0.045
	const pad = Math.ceil(size * 0.25)
	const slice = (y0: number, y1: number, shift: number, id: string) =>
		`<clipPath id="${id}"><rect x="${-pad}" y="${y0 * size}" width="${w + pad * 2}" height="${(y1 - y0) * size}"/></clipPath><g clip-path="url(#${id})"><path d="${d}" fill="${color}" transform="translate(${shift} 0)"/></g>`
	const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${w + pad * 2}" height="${size + pad * 2}" viewBox="${-pad} ${-pad} ${w + pad * 2} ${size + pad * 2}"><path d="${d}" fill="${shadow}" opacity="0.9" transform="translate(${-dx} ${dx * 0.3})"/><path d="${d}" fill="#ffffff" opacity="0.9" transform="translate(${dx} ${-dx * 0.3})"/><path d="${d}" fill="${color}"/>${slice(0.18, 0.34, size * 0.12, "a")}${slice(0.6, 0.72, -size * 0.09, "b")}</svg>`
	return (
		<div style={{ display: "flex", position: "relative", width: w, height: size }}>
			<img src={uri(markup)} width={w + pad * 2} height={size + pad * 2} style={{ position: "absolute", left: -pad, top: -pad }} />
		</div>
	)
}

export function Echo({ text, size, dir = 1, color = C.amber, deep = C.amberDeep }: { text: string; size: number; dir?: number; color?: string; deep?: string }) {
	const TRAIL = [0, 0.75, 0.52, 0.34, 0.2, 0.1]
	const { w } = geom(text, size)
	const step = w * 0.55
	const total = w + step * (TRAIL.length - 1)
	return (
		<div style={{ display: "flex", position: "relative", width: total, height: size }}>
			{TRAIL.map((o, k) => TRAIL.length - 1 - k)
				.filter((k) => k > 0)
				.map((k) => (
					<Abs key={k} style={{ left: dir > 0 ? k * step : total - w - k * step, top: 0, opacity: TRAIL[k], transform: `scale(${1 - k * 0.04})` }}>
						{k === 1 ? <Word text={text} size={size} fill={deep} /> : <Word text={text} size={size} stroke={color} sw={2.5} />}
					</Abs>
				))}
			<Abs style={{ left: dir > 0 ? 0 : total - w, top: 0 }}>
				<Word text={text} size={size} fill={color} glows={[{ color: "#000", blur: 14, opacity: 0.8 }]} />
			</Abs>
		</div>
	)
}

export function Neon({ text, size, color = C.amber, fill = "#fff8e6" }: { text: string; size: number; color?: string; fill?: string }) {
	return (
		<div style={{ display: "flex", position: "relative" }}>
			<Halo x={geom(text, size).w / 2} y={size / 2} r={size * 1.3} opacity={0.85} color="11,8,6" />
			<Word
				text={text}
				size={size}
				fill={fill}
				glows={[
					{ color, blur: size * 0.22, opacity: 0.9 },
					{ color, blur: size * 0.1 },
					{ color, blur: size * 0.04 },
				]}
			/>
		</div>
	)
}

/** Poster with the wash look (amber duotone, band, ink YEP) or its Nope twin. */
export function WashCard({ p, w, nope = false, word, style }: { p: PosterSet; w: number; nope?: boolean; word?: string; style?: object }) {
	const h = Math.round(w * 1.5)
	const text = word ?? (nope ? "NOPE" : "YEP")
	const band = nope
		? "linear-gradient(180deg, rgba(220,38,38,0) 18%, rgba(185,28,28,.8) 36%, rgba(153,27,27,.93) 50%, rgba(185,28,28,.8) 64%, rgba(220,38,38,0) 82%)"
		: "linear-gradient(180deg, rgba(251,191,36,0) 18%, rgba(251,191,36,.8) 36%, rgba(251,191,36,.93) 50%, rgba(251,191,36,.8) 64%, rgba(251,191,36,0) 82%)"
	return (
		<Poster src={nope ? p.washNope : p.wash} w={w} style={style}>
			<Abs style={{ left: 0, top: 0, width: w, height: h, background: band }} />
			<Abs style={{ left: 0, width: w, top: Math.round(h * 0.44 - fitTo(text, w * 0.82) / 2), justifyContent: "center" }}>
				<Word text={text} size={fitTo(text, w * 0.82)} fill={nope ? C.cream : C.ink2} />
			</Abs>
		</Poster>
	)
}

/** MATCH on a washed poster, the match moment of the wash look. */
export function MatchCard({ p, w, style }: { p: PosterSet; w: number; style?: object }) {
	return <WashCard p={p} w={w} word="MATCH" style={{ border: `4px solid ${C.amber}`, boxShadow: "0 0 60px rgba(251,191,36,.45)", ...style }} />
}

/** The right-hand column of round 1 D. */
export function StartText({ left = 600, size = 104 }: { left?: number; size?: number }) {
	return (
		<Col style={{ position: "absolute", left, top: 0, bottom: 0, right: 50, justifyContent: "center", gap: 24 }}>
			<Wordmark size={size} />
			<Col style={{ fontSize: 48, fontWeight: 700, letterSpacing: -1, lineHeight: 1.12 }}>
				<div style={{ display: "flex" }}>{COPY2.tagline[0]}</div>
				<Row>
					<span>{COPY2.tagline[1]}&nbsp;</span>
					<span style={{ color: C.amber }}>{COPY2.tagline[2]}</span>
				</Row>
			</Col>
			<T size={28} color={C.muted} bold={false}>
				{COPY2.platforms}
			</T>
		</Col>
	)
}

export function fit(text: string, max: number, width: number, min = 40) {
	let size = max
	while (size > min && text.length * size * 0.52 > width) size -= 2
	return size
}

export function InviteText({ host, width = 560, head = 76, button = true, align = "flex-start" }: { host: string | null; width?: number; head?: number; button?: boolean; align?: string }) {
	const h = COPY2.invited(host)
	const size = fit(h, head, width, 44)
	const center = align === "center"
	return (
		<Col style={{ gap: 18, width, alignItems: align }}>
			<Row style={{ alignItems: "center", gap: 14 }}>
				<Icon size={50} />
				<Wordmark size={36} />
			</Row>
			<T size={size} style={{ letterSpacing: -size * 0.03, lineHeight: 1.04, textAlign: center ? "center" : "left", justifyContent: center ? "center" : "flex-start" }}>
				{h}
			</T>
			<Col style={{ gap: 4, alignItems: align }}>
				<T size={30} color={C.soft} bold={false}>
					{COPY2.sub1}
				</T>
				<T size={30} color={C.soft} bold={false}>
					{COPY2.sub2}
				</T>
			</Col>
			{button ? (
				<div style={{ display: "flex", marginTop: 8, padding: "16px 30px", borderRadius: 16, background: C.amber, color: C.ink2, fontSize: 32, fontWeight: 700, gap: 14 }}>
					{COPY2.join}
					<span>→</span>
				</div>
			) : null}
		</Col>
	)
}

// ---------- start page ----------

export function S01({ posters }: Content2) {
	return (
		<Frame>
			<Halo x={300} y={300} r={300} />
			<Row style={{ position: "absolute", left: 40, top: 80, width: 520, alignItems: "center", justifyContent: "center", gap: 24 }}>
				<VoteButton yep={false} size={96} />
				<Poster src={posters[0].plain} w={230} style={{ border: `4px solid ${C.amber}` }} />
				<VoteButton yep size={96} />
			</Row>
			<Row style={{ position: "absolute", left: 40, width: 520, top: 455, justifyContent: "center", gap: 12 }}>
				<Face size={58} yep />
				<Face size={58} yep />
				<Face size={58} />
			</Row>
			<StartText />
		</Frame>
	)
}

export function S02({ posters }: Content2) {
	return (
		<Frame>
			<Halo x={300} y={315} r={300} />
			<Abs style={{ left: 175, top: 95, transform: "rotate(-6deg)" }}>
				<Poster src={posters[0].plain} w={260} />
			</Abs>
			<Abs style={{ left: 80, top: 210, transform: "rotate(-9deg)" }}>
				<StampImg text="YEP" size={150} color={C.amber} />
			</Abs>
			<StartText />
		</Frame>
	)
}

export function S03({ posters }: Content2) {
	return (
		<Frame>
			<Halo x={300} y={315} r={300} />
			<Abs style={{ left: 70, top: 120, transform: "rotate(-10deg)", opacity: 0.9 }}>
				<WashCard p={posters[1]} w={220} nope />
			</Abs>
			<Abs style={{ left: 240, top: 80, transform: "rotate(5deg)" }}>
				<WashCard p={posters[0]} w={260} />
			</Abs>
			<StartText />
		</Frame>
	)
}

export function S04({ posters }: Content2) {
	const w = 260
	const h = w * 1.5
	const band = h * 0.2
	const len = Math.hypot(w, h) * 1.2
	return (
		<Frame>
			<Halo x={300} y={315} r={280} opacity={0.25} />
			<Abs style={{ left: 170, top: 120, borderRadius: 16 }}>
				<Poster src={posters[0].warm} w={w} style={{ boxShadow: `0 0 42px 15px ${C.amber}` }}>
					<Abs style={{ left: (w - len) / 2, top: h * 0.42 - band / 2, width: len, height: band, transform: "rotate(-14deg)", background: C.amber, borderTop: "3px solid rgba(0,0,0,.25)", borderBottom: "3px solid rgba(0,0,0,.25)", alignItems: "center", justifyContent: "center" }}>
						<Word text="YEP" size={band * 0.8} fill={C.ink2} />
					</Abs>
				</Poster>
			</Abs>
			<StartText />
		</Frame>
	)
}

export function S05({ posters }: Content2) {
	return (
		<Frame>
			<Abs style={{ left: 175, top: 140 }}>
				<Poster src={posters[0].plain} w={250} style={{ border: "2px solid #ffe6a8", boxShadow: "0 0 40px rgba(251,191,36,.6)" }} />
			</Abs>
			<Abs style={{ left: 140, top: 70 }}>
				<Neon text="YEP" size={180} />
			</Abs>
			<StartText />
		</Frame>
	)
}

export function S06({ posters }: Content2) {
	const s = 170
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0, width: 260, height: H, background: "linear-gradient(90deg, rgba(239,68,68,.33), rgba(239,68,68,0))" }} />
			<Abs style={{ right: 0, top: 0, width: 260, height: H, background: "linear-gradient(270deg, rgba(251,191,36,.33), rgba(251,191,36,0))" }} />
			<Row style={{ position: "absolute", left: 0, right: 0, top: 40, height: 380, alignItems: "center", justifyContent: "center", gap: 40 }}>
				<Word text="NOPE" size={fitTo("NOPE", 340)} stroke={C.red} sw={3} />
				<Poster src={posters[0].plain} w={230} style={{ border: `4px solid ${C.amber}` }} />
				<Word text="YEP" size={s * 1.1} fill={C.amber} glows={[{ color: C.amber, blur: 30, opacity: 0.45 }]} />
			</Row>
			<Row style={{ position: "absolute", left: 70, right: 70, bottom: 56, alignItems: "flex-end", justifyContent: "space-between" }}>
				<Wordmark size={80} />
				<Row style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1, paddingBottom: 6 }}>
					<span>Choose something to watch,&nbsp;</span>
					<span style={{ color: C.amber }}>together.</span>
				</Row>
			</Row>
		</Frame>
	)
}

export function S07({ posters }: Content2) {
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0 }}>
				<WallImg w={600} h={H} size={86} color={C.amber} opacity={0.85} />
			</Abs>
			<Abs style={{ left: 0, top: 0, width: W, height: H, background: "linear-gradient(90deg, rgba(7,7,7,.15) 0%, rgba(7,7,7,.4) 30%, #070707 50%)" }} />
			<Abs style={{ left: 180, top: 120 }}>
				<Poster src={posters[0].plain} w={260} />
			</Abs>
			<StartText left={620} />
		</Frame>
	)
}

export function S08({ posters }: Content2) {
	const D = 1300
	return (
		<Frame>
			<Abs style={{ left: 300 - D / 2, top: 315 - D / 2, opacity: 0.85 }}>
				<Rays size={D} color="#f59e0b" opacity={0.4} widthDeg={4} from={11.25} />
			</Abs>
			<Abs style={{ left: 300 - D / 2, top: 315 - D / 2, opacity: 0.85 }}>
				<Rays size={D} color={C.amber} widthDeg={8} />
			</Abs>
			<Halo x={300} y={315} r={330} opacity={0.75} color="253,230,138" />
			<Abs style={{ left: 570, top: 0, width: 630, height: H, background: "linear-gradient(90deg, rgba(7,7,7,0) 0%, #070707 14%)" }} />
			<Abs style={{ left: 180, top: 70 }}>
				<Poster src={posters[0].plain} w={240} />
			</Abs>
			<Abs style={{ left: 115, top: 330, transform: "rotate(-5deg)" }}>
				<Word text="YEP" size={190} fill="#fff8e6" drop={{ dy: 11, color: C.amberDeep }} glows={[{ color: "#000", blur: 20, opacity: 0.6 }]} />
			</Abs>
			<StartText left={620} />
		</Frame>
	)
}

export function S09({ posters }: Content2) {
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0, width: 400, height: H, borderTopRightRadius: 28, borderBottomRightRadius: 28, background: `linear-gradient(135deg, ${C.amber} 0%, #f59e0b 50%, ${C.amberDeep} 100%)` }} />
			<Abs style={{ left: 18, top: 0, width: 140, height: H, alignItems: "center", justifyContent: "center" }}>
				<Word text="YEP" size={150} fill={C.ink2} style={{ transform: "rotate(-90deg)" }} />
			</Abs>
			<Abs style={{ left: 270, top: 120 }}>
				<Poster src={posters[0].plain} w={260} />
			</Abs>
			<StartText left={620} size={96} />
		</Frame>
	)
}

export function S10({ posters }: Content2) {
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0, width: 620, height: H, overflow: "hidden" }}>
				<img src={posters[0].bleed} width={620} height={930} style={{ position: "absolute", left: 0, top: -150 }} />
			</Abs>
			<Abs style={{ left: 0, top: 0, width: 640, height: H, background: "linear-gradient(90deg, rgba(32,20,0,.15) 0%, rgba(32,20,0,.25) 70%, #070707 100%)" }} />
			<Abs style={{ left: 180, top: 80 }}>
				<Poster src={posters[0].plain} w={250} />
			</Abs>
			<Abs style={{ left: 85, top: 300 }}>
				<Word text="YEP" size={200} fill="#fffaf0" drop={{ dy: 6, color: "rgba(32,20,0,.35)" }} glows={[{ color: "#000", blur: 22, opacity: 0.6 }]} />
			</Abs>
			<StartText left={640} size={96} />
		</Frame>
	)
}

export function S11({ posters }: Content2) {
	return (
		<Frame>
			<Halo x={300} y={315} r={300} opacity={0.22} />
			<Abs style={{ left: 190, top: 70, opacity: 0.85 }}>
				<Poster src={posters[0].plain} w={230} />
			</Abs>
			<Abs style={{ left: 50, top: 300 }}>
				<Echo text="YEP" size={130} />
			</Abs>
			<StartText left={640} size={96} />
		</Frame>
	)
}

export function S12({ posters }: Content2) {
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0, width: 620, height: H, overflow: "hidden" }}>
				<GlitchBands w={620} h={H} />
			</Abs>
			<Abs style={{ left: 185, top: 80 }}>
				<Poster src={posters[0].plain} w={240} />
			</Abs>
			<Abs style={{ left: 120, top: 250 }}>
				<GlitchWord text="YEP" size={190} />
			</Abs>
			<StartText left={640} size={96} />
		</Frame>
	)
}

export function S13({ posters }: Content2) {
	return (
		<Frame>
			<Halo x={300} y={290} r={320} opacity={0.35} />
			<Abs style={{ left: 175, top: 50 }}>
				<MatchCard p={posters[0]} w={250} />
			</Abs>
			<Row style={{ position: "absolute", left: 40, width: 520, top: 480, justifyContent: "center", gap: 14 }}>
				<Face size={70} yep />
				<Face size={70} yep />
				<Face size={70} yep />
			</Row>
			<StartText />
		</Frame>
	)
}

export function S14({ posters }: Content2) {
	const w = 150
	return (
		<Frame>
			<Halo x={300} y={315} r={300} opacity={0.2} />
			<Row style={{ position: "absolute", left: 50, top: 140, gap: 22, alignItems: "flex-start" }}>
				<Col style={{ alignItems: "center", gap: 14 }}>
					<Poster src={posters[1].gray} w={w}>
						<Abs style={{ left: 0, width: w, top: Math.round(w * 1.5 * 0.44 - 36), justifyContent: "center", transform: "rotate(8deg)" }}>
							<StampImg text="NOPE" size={40} color={C.red} />
						</Abs>
					</Poster>
					<T size={28} color={C.red}>Nope</T>
				</Col>
				<Col style={{ alignItems: "center", gap: 14 }}>
					<WashCard p={posters[2]} w={w} />
					<T size={28} color={C.amber}>Yep</T>
				</Col>
				<Col style={{ alignItems: "center", gap: 14 }}>
					<MatchCard p={posters[0]} w={w} />
					<T size={28}>Match</T>
				</Col>
			</Row>
			<StartText left={640} size={96} />
		</Frame>
	)
}

// ---------- room invite (static) ----------

export function Tile({ n, children }: { n: number; children: ReactNode }) {
	return (
		<Col style={{ width: 330, height: 270, borderRadius: 24, background: C.panel, border: `2px solid ${C.line}`, padding: "18px 22px", justifyContent: "space-between" }}>
			<Row style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{children}</Row>
			<Col style={{ gap: 2 }}>
				<Row style={{ alignItems: "baseline", gap: 10 }}>
					<T size={30} color={C.amber}>{`${n}`}</T>
					<T size={30}>{COPY2.steps[n - 1]}</T>
				</Row>
				<T size={22} color={C.muted} bold={false}>
					{COPY2.stepNotes[n - 1]}
				</T>
			</Col>
		</Col>
	)
}

export function R01({ posters, host }: Content2) {
	const h = COPY2.invited(host)
	return (
		<Frame>
			<Halo x={1000} y={60} r={280} opacity={0.2} />
			<Row style={{ position: "absolute", left: 60, top: 50, right: 60, alignItems: "center", justifyContent: "space-between" }}>
				<T size={fit(h, 76, 760, 46)} style={{ letterSpacing: -2 }}>
					{h}
				</T>
				<Row style={{ alignItems: "center", gap: 12 }}>
					<Icon size={50} />
					<Wordmark size={36} />
				</Row>
			</Row>
			<Row style={{ position: "absolute", left: 60, right: 60, top: 160, justifyContent: "space-between", alignItems: "center", fontSize: 1 }}>
				<T size={30} color={C.soft} bold={false}>
					{`${COPY2.sub1} ${COPY2.sub2}`}
				</T>
			</Row>
			<Row style={{ position: "absolute", left: 60, right: 60, bottom: 44, justifyContent: "space-between" }}>
				<Tile n={1}>
					<Row style={{ gap: 10, alignItems: "center" }}>
						{host ? <Face size={66} letter={host[0]!.toUpperCase()} /> : <Face size={66} />}
						<Face size={66} />
						<OpenSeat size={66} />
					</Row>
				</Tile>
				<Tile n={2}>
					<Row style={{ gap: 14, alignItems: "center" }}>
						<VoteButton yep={false} size={56} label={false} />
						<Poster src={posters[0].plain} w={100} style={{ border: `3px solid ${C.amber}` }} />
						<VoteButton yep size={56} label={false} />
					</Row>
				</Tile>
				<Tile n={3}>
					<MatchCard p={posters[0]} w={110} />
				</Tile>
			</Row>
		</Frame>
	)
}

export function R02({ posters, host }: Content2) {
	return (
		<Frame>
			<Halo x={300} y={300} r={300} />
			<Row style={{ position: "absolute", left: 30, top: 70, width: 520, alignItems: "center", justifyContent: "center", gap: 22 }}>
				<VoteButton yep={false} size={90} />
				<Poster src={posters[0].plain} w={220} style={{ border: `4px solid ${C.amber}` }} />
				<VoteButton yep size={90} />
			</Row>
			<Row style={{ position: "absolute", left: 30, width: 520, top: 435, justifyContent: "center", gap: 12 }}>
				{host ? <Face size={58} letter={host[0]!.toUpperCase()} yep /> : <Face size={58} yep />}
				<Face size={58} yep />
				<OpenSeat size={58} />
			</Row>
			<Abs style={{ left: 590, top: 0, bottom: 0, alignItems: "center" }}>
				<InviteText host={host} width={560} head={72} />
			</Abs>
		</Frame>
	)
}

export function Plus({ children = "+" }: { children?: string }) {
	return <T size={64} color={C.muted}>{children}</T>
}

export function R03({ posters, host }: Content2) {
	const h = COPY2.invited(host)
	return (
		<Frame>
			<Halo x={960} y={330} r={300} opacity={0.35} />
			<Col style={{ position: "absolute", left: 70, top: 56, gap: 10 }}>
				<Row style={{ alignItems: "center", gap: 12 }}>
					<Icon size={46} />
					<Wordmark size={34} />
				</Row>
				<T size={fit(h, 72, 1060, 46)} style={{ letterSpacing: -2 }}>
					{h}
				</T>
			</Col>
			<Row style={{ position: "absolute", left: 70, right: 70, top: 225, alignItems: "center", justifyContent: "space-between" }}>
				{host ? <Face size={120} letter={host[0]!.toUpperCase()} yep /> : <Face size={120} yep />}
				<Plus />
				<Face size={120} yep />
				<Plus />
				<OpenSeat size={120} />
				<Plus>=</Plus>
				<MatchCard p={posters[0]} w={200} />
			</Row>
			<T size={30} color={C.soft} bold={false} style={{ position: "absolute", left: 70, bottom: 56 }}>
				{`${COPY2.sub1} ${COPY2.sub2}`}
			</T>
		</Frame>
	)
}

export function R04({ host }: Content2) {
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0 }}>
				<WallImg w={W} h={H} size={96} color={C.amber} opacity={0.5} />
			</Abs>
			<Abs style={{ left: 0, top: 0, width: W, height: H, background: "radial-gradient(circle at 50% 50%, rgba(7,7,7,.92) 0%, rgba(7,7,7,.85) 40%, rgba(7,7,7,.2) 80%)" }} />
			<Abs style={{ left: 150, top: 80, width: 900, height: 470, borderRadius: 32, background: "rgba(13,13,13,.92)", border: `2px solid ${C.line}`, alignItems: "center", justifyContent: "center" }}>
				<InviteText host={host} width={800} head={78} align="center" />
			</Abs>
		</Frame>
	)
}

export function R05({ posters, host }: Content2) {
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0, width: 220, height: H, borderTopRightRadius: 24, borderBottomRightRadius: 24, background: `linear-gradient(225deg, #f87171 0%, ${C.red} 50%, ${C.redDeep} 100%)`, alignItems: "center", justifyContent: "center" }}>
				<Word text="NOPE" size={130} fill={C.cream} style={{ transform: "rotate(-90deg)" }} />
			</Abs>
			<Abs style={{ right: 0, top: 0, width: 220, height: H, borderTopLeftRadius: 24, borderBottomLeftRadius: 24, background: `linear-gradient(135deg, ${C.amber} 0%, #f59e0b 50%, ${C.amberDeep} 100%)`, alignItems: "center", justifyContent: "center" }}>
				<Word text="YEP" size={130} fill={C.ink2} style={{ transform: "rotate(90deg)" }} />
			</Abs>
			<Col style={{ position: "absolute", left: 260, right: 260, top: 46, bottom: 40, alignItems: "center", justifyContent: "space-between" }}>
				<Row style={{ alignItems: "center", gap: 12 }}>
					<Icon size={44} />
					<Wordmark size={32} />
				</Row>
				<T size={fit(COPY2.invited(host), 64, 660, 40)} style={{ letterSpacing: -1.6, textAlign: "center" }}>
					{COPY2.invited(host)}
				</T>
				<Row style={{ alignItems: "center", gap: 26 }}>
					<T size={34} color={C.red}>← Nope</T>
					<Poster src={posters[0].plain} w={150} style={{ border: `3px solid ${C.amber}` }} />
					<T size={34} color={C.amber}>Yep →</T>
				</Row>
				<T size={26} color={C.soft} bold={false}>
					{COPY2.sub2}
				</T>
			</Col>
		</Frame>
	)
}

export function R06({ posters, host }: Content2) {
	return (
		<Frame>
			<Halo x={930} y={315} r={300} />
			<Abs style={{ left: 70, top: 0, bottom: 0, alignItems: "center" }}>
				<InviteText host={host} width={600} head={76} />
			</Abs>
			<Abs style={{ left: 800, top: 95, transform: "rotate(6deg)" }}>
				<Poster src={posters[0].plain} w={260} />
			</Abs>
			<Abs style={{ left: 760, top: 230, transform: "rotate(-9deg)" }}>
				<StampImg text="YEP" size={140} color={C.amber} />
			</Abs>
		</Frame>
	)
}

export function R07({ posters, host }: Content2) {
	const h = COPY2.invited(host)
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0, width: W, height: H, opacity: 0.22 }}>
				<img src={posters[0].bleed} width={W} height={1800} style={{ position: "absolute", left: 0, top: -600 }} />
			</Abs>
			<Abs style={{ left: 0, right: 0, top: 40, justifyContent: "center" }}>
				<Neon text="YEP" size={210} />
			</Abs>
			<Col style={{ position: "absolute", left: 60, right: 60, top: 300, alignItems: "center", gap: 14 }}>
				<T size={fit(h, 76, 1060, 46)} style={{ letterSpacing: -2 }}>
					{h}
				</T>
				<T size={30} color={C.soft} bold={false}>
					{`${COPY2.sub1} ${COPY2.sub2}`}
				</T>
				<Row style={{ alignItems: "center", gap: 12, marginTop: 26 }}>
					<Icon size={46} />
					<Wordmark size={34} />
				</Row>
			</Col>
		</Frame>
	)
}

export function R08({ posters, host }: Content2) {
	const D = 1500
	return (
		<Frame>
			<Abs style={{ left: 920 - D / 2, top: 315 - D / 2, opacity: 0.8 }}>
				<Rays size={D} color={C.amber} widthDeg={8} />
			</Abs>
			<Halo x={920} y={315} r={330} opacity={0.75} color="253,230,138" />
			<Abs style={{ left: 0, top: 0, width: 760, height: H, background: "linear-gradient(90deg, #070707 0%, #070707 78%, rgba(7,7,7,0) 100%)" }} />
			<Abs style={{ left: 70, top: 0, bottom: 0, alignItems: "center" }}>
				<InviteText host={host} width={600} head={76} />
			</Abs>
			<Abs style={{ left: 800, top: 80 }}>
				<MatchCard p={posters[0]} w={245} />
			</Abs>
		</Frame>
	)
}

export function R09({ posters, host }: Content2) {
	return (
		<Frame>
			<Halo x={900} y={315} r={320} opacity={0.25} />
			<Abs style={{ left: 70, top: 0, bottom: 0, alignItems: "center" }}>
				<InviteText host={host} width={580} head={74} />
			</Abs>
			<Abs style={{ left: 760, top: 110, transform: "rotate(-4deg)", opacity: 0.6 }}>
				<Poster src={posters[2].plain} w={240} />
			</Abs>
			<Abs style={{ left: 775, top: 100 }}>
				<Poster src={posters[1].plain} w={240} />
			</Abs>
			<Abs style={{ left: 860, top: 80, transform: "rotate(13deg)" }}>
				<WashCard p={posters[0]} w={250} />
			</Abs>
			<Abs style={{ left: 820, bottom: 18 }}>
				<T size={30} color={C.amber}>Yep →</T>
			</Abs>
		</Frame>
	)
}

export function R10({ posters, host }: Content2) {
	const title = COPY2.room(host)
	const notch = { width: 52, height: 52, borderRadius: 26, background: C.bg }
	return (
		<Frame>
			<Halo x={600} y={315} r={420} opacity={0.18} />
			<Row style={{ position: "absolute", left: 60, top: 70, width: 1080, height: 490, borderRadius: 34, background: C.panel, border: `2px solid ${C.line}` }}>
				<Col style={{ width: 620, padding: "44px 50px", justifyContent: "space-between" }}>
					<Row style={{ alignItems: "center", gap: 12 }}>
						<Icon size={44} />
						<Wordmark size={32} />
					</Row>
					<Col style={{ gap: 12 }}>
						<T size={22} color={C.amber} style={{ letterSpacing: 4 }}>
							ADMIT ONE MORE
						</T>
						<T size={fit(title, 78, 540, 46)} style={{ letterSpacing: -2 }}>
							{title}
						</T>
					</Col>
					<T size={28} color={C.soft} bold={false}>
						{COPY2.sub2}
					</T>
				</Col>
				<div style={{ display: "flex", width: 0, borderLeft: `4px dashed ${C.line}`, margin: "30px 0" }} />
				<Col style={{ flex: 1, padding: "40px 34px", justifyContent: "center", gap: 22 }}>
					{[0, 1, 2].map((i) => (
						<Row key={i} style={{ alignItems: "center", gap: 18 }}>
							{i === 0 ? <OpenSeat size={78} /> : i === 1 ? <VoteButton yep size={78} label={false} /> : <MatchCard p={posters[0]} w={52} style={{ border: `2px solid ${C.amber}`, boxShadow: "none" }} />}
							<Col>
								<T size={32}>{COPY2.steps[i]}</T>
								<T size={22} color={C.muted} bold={false}>
									{COPY2.stepNotes[i]}
								</T>
							</Col>
						</Row>
					))}
				</Col>
			</Row>
			<Abs style={{ left: 680 - 26, top: 70 - 26, ...notch }} />
			<Abs style={{ left: 680 - 26, top: 560 - 26, ...notch }} />
		</Frame>
	)
}

export function R11({ posters, host }: Content2) {
	return (
		<Frame>
			<Abs style={{ left: 0, top: 0, width: W, height: H, opacity: 0.18 }}>
				<img src={posters[0].bleed} width={W} height={1800} style={{ position: "absolute", left: 0, top: -400 }} />
			</Abs>
			<Abs style={{ left: 70, top: 50 }}>
				<InviteText host={host} width={1060} head={76} button={false} />
			</Abs>
			<Abs style={{ left: 60, bottom: -10 }}>
				<Echo text="YEP" size={200} />
			</Abs>
		</Frame>
	)
}

export function R12({ posters, host }: Content2) {
	const pw = 330
	return (
		<Frame>
			<Halo x={880} y={330} r={330} opacity={0.3} />
			<Abs style={{ left: 70, top: 0, bottom: 0, alignItems: "center" }}>
				<InviteText host={host} width={580} head={74} />
			</Abs>
			<Col style={{ position: "absolute", left: 715, top: 50, width: pw, height: 700, borderRadius: 52, background: "#000", border: "10px solid #2a2a2a", padding: "26px 18px", gap: 16, alignItems: "center" }}>
				<Row style={{ width: "100%", justifyContent: "space-between", alignItems: "center" }}>
					<Wordmark size={22} />
					<Row style={{ gap: 4 }}>
						{host ? <Face size={28} letter={host[0]!.toUpperCase()} /> : <Face size={28} />}
						<Face size={28} />
						<Face size={28} />
					</Row>
				</Row>
				<div style={{ display: "flex", position: "relative", width: 270, height: 405 }}>
					<Abs style={{ left: 0, top: 0, transform: "rotate(9deg) translateX(22px)" }}>
						<Poster src={posters[0].plain} w={270} radius={18}>
							<Abs style={{ left: 0, top: 0, width: 270, height: 405, background: "rgba(251,191,36,.18)" }} />
						</Poster>
					</Abs>
					<Abs style={{ left: 40, top: 30, transform: "rotate(-9deg)" }}>
						<StampImg text="YEP" size={64} color={C.amber} />
					</Abs>
				</div>
				<Row style={{ gap: 60, marginTop: 4 }}>
					<VoteButton yep={false} size={66} label={false} />
					<VoteButton yep size={66} label={false} />
				</Row>
			</Col>
		</Frame>
	)
}

const START = { "01": S01, "02": S02, "03": S03, "04": S04, "05": S05, "06": S06, "07": S07, "08": S08, "09": S09, "10": S10, "11": S11, "12": S12, "13": S13, "14": S14 }
const ROOM = { "01": R01, "02": R02, "03": R03, "04": R04, "05": R05, "06": R06, "07": R07, "08": R08, "09": R09, "10": R10, "11": R11, "12": R12 }

export function PrototypeYepWatchCard2({ page, variant, content }: { page: "start" | "room"; variant: string; content: Content2 }) {
	const Card = (page === "start" ? START : ROOM)[variant as "01"]
	return <Card {...content} />
}
