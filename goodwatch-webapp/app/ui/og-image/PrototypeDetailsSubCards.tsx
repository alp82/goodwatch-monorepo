// PROTOTYPE (throwaway, branch prototype/details-og): link-preview card variants for a title's sub-pages
// (/movie|show/<key>/fingerprint, /tropes, /at-a-glance). Today they share the title's card. Rendered by
// scripts/prototype-details-og/render.tsx into a gallery; nothing in the app imports this file.
// Satori: flex only, every multi-child element needs display:flex, no text inside <svg>.
import type { ReactNode } from "react"
import {
	AMBER,
	Brand,
	Frame,
	Headline,
	INK,
	Picture,
	Tag,
	col,
	row,
} from "~/ui/og-image/parts"
import { type WhorlAttribute, build } from "~/ui/profile/taste/Whorl"
import { FAMILY_COLOR } from "~/ui/profile/taste/model"

export type SubKind = "fingerprint" | "tropes" | "glance"

export interface SubCardContent {
	kind: SubKind
	title: string
	/** "MOVIE · 2021" */
	meta: string
	poster: string | null
	backdrop: string | null
	fp: {
		attributes: WhorlAttribute[]
		/** The eight axes clockwise from the top, strength 0-10. */
		axes: { label: string; strength: number; color: string; bold: boolean }[]
		/** The leading effects, strongest first: name, color, size 0-1. */
		rows: { text: string; color: string; k: number }[]
	}
	tropes: { total: number; names: string[] }
	glance: {
		facts: { label: string; value: string }[]
		directors: string[]
		directorPhoto: string | null
		stars: { name: string; photo: string | null }[]
		rated: string | null
		advisories: string[]
	}
}

export const VARIANTS: Record<SubKind, { key: string; name: string }[]> = {
	fingerprint: [
		{ key: "A", name: "Title split, the print where the poster was" },
		{ key: "B", name: "Print hero on ink, the strongest feelings as lines" },
		{ key: "C", name: "Poster + eight feeling bars" },
		{ key: "D", name: "Backdrop band, the print over the seam" },
	],
	tropes: [
		{ key: "A", name: "Title split, trope count in place of the score" },
		{ key: "B", name: "Cloud of this title's tropes, small poster" },
		{ key: "C", name: "Poster + numbered list of signature tropes" },
		{ key: "D", name: "Backdrop with trope chips" },
	],
	glance: [
		{ key: "A", name: "Title split, one fact line" },
		{ key: "B", name: "Poster + fact tiles" },
		{ key: "C", name: "Backdrop band with the director and star faces" },
		{ key: "D", name: "Poster + ledger rows" },
	],
}

const SIDE = 56
const SUB_TAG: Record<SubKind, string> = {
	fingerprint: "FINGERPRINT",
	tropes: "TROPES",
	glance: "AT A GLANCE",
}
const DARK = "#0b0f17"

// --- Shared bits -------------------------------------------------------------------------------------------------

function TopBar({ dark = true, kind }: { dark?: boolean; kind: SubKind }) {
	return (
		<>
			<div style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}>
				<Brand dark={dark} />
			</div>
			<div style={{ position: "absolute", top: 44, right: SIDE, display: "flex" }}>
				<Tag text={SUB_TAG[kind]} />
			</div>
		</>
	)
}

function PrintDrawing({
	attributes,
	size,
	turns = 18,
	stroke = 2.4,
}: { attributes: WhorlAttribute[]; size: number; turns?: number; stroke?: number }) {
	const g = build(attributes, turns, true)
	const b = g.box + 6
	return (
		<div style={{ display: "flex", width: size, height: size }}>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: prototype card image */}
			<svg width={size} height={size} viewBox={`${-b} ${-b} ${b * 2} ${b * 2}`}>
				{g.turns.flatMap((turn, i) =>
					turn.paths.map((p, j) => (
						<path
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed geometry
							key={`${i}-${j}`}
							d={p.d}
							fill="none"
							stroke={FAMILY_COLOR[p.family]}
							strokeOpacity={p.opacity}
							strokeWidth={stroke}
							strokeLinecap="round"
						/>
					)),
				)}
				{g.markers.map((m) => (
					<circle
						key={m.a.key}
						cx={m.x}
						cy={m.y}
						r={m.r}
						fill={m.a.edge > 0 ? FAMILY_COLOR[m.a.family] : "none"}
						stroke={FAMILY_COLOR[m.a.family]}
						strokeWidth={m.a.edge > 0 ? 0 : 1.2}
					/>
				))}
			</svg>
		</div>
	)
}

function PosterBox({
	src,
	w,
	style = {},
}: { src: string | null; w: number; style?: React.CSSProperties }) {
	const h = Math.round(w * 1.5)
	return (
		<div
			style={{
				display: "flex",
				position: "relative",
				width: w,
				height: h,
				borderRadius: Math.round(w / 14),
				overflow: "hidden",
				backgroundColor: "#1f2937",
				...style,
			}}
		>
			<Picture src={src} alignTop style={{ top: 0, left: 0, width: w, height: h }} />
		</div>
	)
}

const Ink = ({ children, size = 28, weight = 700, color = INK, style = {} }: {
	children: ReactNode
	size?: number
	weight?: number
	color?: string
	style?: React.CSSProperties
}) => (
	<div style={{ display: "flex", fontSize: size, fontWeight: weight, color, ...style }}>{children}</div>
)

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** The title split: amber text column left, a dark or picture panel right. */
function TitleSplit({
	c,
	right,
	under,
	underHeight,
	rightWidth = 420,
}: {
	c: SubCardContent
	right: ReactNode
	under: ReactNode
	underHeight: number
	rightWidth?: number
}) {
	const textW = 1200 - rightWidth - SIDE - 54
	return (
		<Frame>
			<div style={{ position: "absolute", top: 0, right: 0, width: rightWidth, height: 630, display: "flex" }}>
				{right}
			</div>
			<div style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}>
				<Brand dark />
			</div>
			<div
				style={col({
					position: "absolute",
					left: SIDE,
					top: 120,
					bottom: 52,
					width: textW,
					gap: 18,
					justifyContent: "flex-end",
				})}
			>
				<Tag text={`${SUB_TAG[c.kind]} · ${c.meta}`} />
				<Headline text={c.title} width={textW} height={630 - 120 - 52 - 44 - 36 - underHeight} max={150} />
				{under}
			</div>
		</Frame>
	)
}

// --- Fingerprint -------------------------------------------------------------------------------------------------

function FpA({ c }: { c: SubCardContent }) {
	const top = c.fp.rows.slice(0, 3)
	return (
		<TitleSplit
			c={c}
			rightWidth={500}
			right={
				<div style={{ display: "flex", width: 500, height: 630, backgroundColor: DARK, alignItems: "center", justifyContent: "center" }}>
					<PrintDrawing attributes={c.fp.attributes} size={470} />
				</div>
			}
			underHeight={top.length * 44}
			under={
				<div style={col({ gap: 4 })}>
					{top.map((r) => (
						<Ink key={r.text} size={34} weight={900}>{r.text}</Ink>
					))}
				</div>
			}
		/>
	)
}

function FpB({ c }: { c: SubCardContent }) {
	const rows = c.fp.rows.slice(0, 4)
	return (
		<Frame bg={DARK}>
			<div style={{ position: "absolute", left: -30, top: 15, display: "flex" }}>
				<PrintDrawing attributes={c.fp.attributes} size={600} />
			</div>
			<div style={{ position: "absolute", top: 44, right: SIDE, display: "flex" }}>
				<Brand />
			</div>
			<div style={col({ position: "absolute", left: 600, top: 130, width: 544, bottom: 50, justifyContent: "flex-end", gap: 10 })}>
				<Ink size={24} weight={900} color={AMBER} style={{ letterSpacing: 3 }}>
					{`FINGERPRINT · ${c.meta}`}
				</Ink>
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: c.title.length > 18 ? 52 : 72, lineHeight: 1.05, color: "#fff", marginBottom: 12 }}>
					{clip(c.title.toUpperCase(), 34)}
				</div>
				{rows.map((r) => (
					<Ink key={r.text} size={Math.round(30 + r.k * 18)} weight={900} color={r.color}>
						{r.text}
					</Ink>
				))}
			</div>
		</Frame>
	)
}

function FpC({ c }: { c: SubCardContent }) {
	const axes = [...c.fp.axes].sort((a, b) => b.strength - a.strength)
	const barMax = 520
	return (
		<Frame>
			<div style={{ position: "absolute", top: 0, left: 0, width: 420, height: 630, display: "flex" }}>
				<Picture src={c.poster} alignTop style={{ top: 0, left: 0, width: 420, height: 630 }} />
			</div>
			<div style={{ position: "absolute", top: 44, left: 476, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 476, top: 128, width: 670, gap: 10 })}>
				<Ink size={30} weight={900} style={{ letterSpacing: 1 }}>{`How ${clip(c.title, 26)} feels`}</Ink>
				{axes.map((a) => (
					<div key={a.label} style={row({ alignItems: "center", gap: 14, height: 46 })}>
						<Ink size={24} weight={a.bold ? 900 : 700} style={{ width: 130, opacity: a.bold ? 1 : 0.7 }}>{a.label}</Ink>
						<div style={{ display: "flex", width: barMax, height: 30, backgroundColor: "rgba(10,10,10,0.12)", borderRadius: 15 }}>
							<div
								style={{
									display: "flex",
									width: Math.max(18, (a.strength / 10) * barMax),
									height: 30,
									borderRadius: 15,
									backgroundColor: a.bold ? a.color : "rgba(10,10,10,0.45)",
									border: a.bold ? `3px solid ${INK}` : "none",
								}}
							/>
						</div>
					</div>
				))}
			</div>
		</Frame>
	)
}

function FpD({ c }: { c: SubCardContent }) {
	const bandTop = 330
	return (
		<Frame>
			<Picture src={c.backdrop} style={{ top: 0, left: 0, width: 1200, height: bandTop }} />
			<div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: bandTop, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.55), rgba(0,0,0,0) 60%)" }} />
			<div style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}>
				<Brand />
			</div>
			<div style={{ position: "absolute", right: 30, top: 70, width: 500, height: 500, display: "flex", borderRadius: 250, backgroundColor: DARK, alignItems: "center", justifyContent: "center", border: `8px solid ${AMBER}` }}>
				<PrintDrawing attributes={c.fp.attributes} size={440} />
			</div>
			<div style={col({ position: "absolute", left: SIDE, top: bandTop + 26, width: 600, gap: 12 })}>
				<Tag text={`FINGERPRINT · ${c.meta}`} />
				<Headline text={c.title} width={600} height={630 - bandTop - 26 - 44 - 12 - 40} max={110} />
			</div>
		</Frame>
	)
}

// --- Tropes ------------------------------------------------------------------------------------------------------

function TrA({ c }: { c: SubCardContent }) {
	return (
		<TitleSplit
			c={c}
			right={<Picture src={c.poster} alignTop style={{ top: 0, left: 0, width: 420, height: 630 }} />}
			underHeight={156}
			under={
				<div style={row()}>
					<div style={col({ alignItems: "center", backgroundColor: INK, borderRadius: 20, padding: "8px 30px 14px" })}>
						<div style={{ display: "flex", fontFamily: "Anton", fontSize: 108, color: AMBER, lineHeight: 1.05 }}>{String(c.tropes.total)}</div>
						<Ink size={24} weight={900} color={AMBER} style={{ letterSpacing: 3 }}>TROPES</Ink>
					</div>
				</div>
			}
		/>
	)
}

function TrB({ c }: { c: SubCardContent }) {
	const names = c.tropes.names.slice(0, 10)
	const size = (i: number) => (i < 2 ? 64 : i < 5 ? 46 : 34)
	return (
		<Frame>
			<div style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}>
				<Brand dark />
			</div>
			<PosterBox src={c.poster} w={200} style={{ position: "absolute", left: SIDE, top: 150, border: `4px solid ${INK}` }} />
			<div style={col({ position: "absolute", left: SIDE, top: 470, width: 200, gap: 2 })}>
				<Ink size={22} weight={900} style={{ letterSpacing: 2 }}>{clip(c.title.toUpperCase(), 32)}</Ink>
				<Ink size={20} weight={700} style={{ opacity: 0.7 }}>{`${c.tropes.total} tropes`}</Ink>
			</div>
			<div style={{ position: "absolute", top: 44, right: SIDE, display: "flex" }}>
				<Tag text="TROPES" />
			</div>
			<div style={{ display: "flex", flexWrap: "wrap", position: "absolute", left: 300, top: 120, width: 1200 - 300 - SIDE, height: 470, alignItems: "center", alignContent: "center", justifyContent: "center", columnGap: 26, rowGap: 6 }}>
				{names.map((n, i) => (
					<div key={n} style={{ display: "flex", fontFamily: "Anton", fontSize: size(i), lineHeight: 1.08, letterSpacing: 1, color: i >= 5 ? "rgba(10,10,10,0.62)" : INK, whiteSpace: "nowrap" }}>
						{clip(n.toUpperCase(), 30)}
					</div>
				))}
			</div>
		</Frame>
	)
}

function TrC({ c }: { c: SubCardContent }) {
	const names = c.tropes.names.slice(0, 5)
	return (
		<Frame>
			<div style={{ position: "absolute", top: 0, left: 0, width: 420, height: 630, display: "flex" }}>
				<Picture src={c.poster} alignTop style={{ top: 0, left: 0, width: 420, height: 630 }} />
			</div>
			<div style={{ position: "absolute", top: 44, left: 476, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 476, top: 128, width: 680, gap: 4 })}>
				<Ink size={28} weight={900} style={{ letterSpacing: 2, marginBottom: 10 }}>
					{`${clip(c.title.toUpperCase(), 24)} · ${c.tropes.total} TROPES`}
				</Ink>
				{names.map((n, i) => (
					<div key={n} style={row({ alignItems: "baseline", gap: 18, height: 78 })}>
						<div style={{ display: "flex", fontFamily: "Anton", fontSize: 48, color: "rgba(10,10,10,0.35)", width: 40 }}>{String(i + 1)}</div>
						<div style={{ display: "flex", fontFamily: "Anton", fontSize: 54, color: INK, whiteSpace: "nowrap" }}>{clip(n.toUpperCase(), 24)}</div>
					</div>
				))}
			</div>
		</Frame>
	)
}

function TrD({ c }: { c: SubCardContent }) {
	const names = c.tropes.names.slice(0, 7)
	return (
		<Frame bg={INK}>
			<Picture src={c.backdrop} style={{ top: 0, left: 0, width: 1200, height: 630 }} />
			<div style={{ position: "absolute", inset: 0, display: "flex", backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.85) 75%)" }} />
			<TopBar dark={false} kind="tropes" />
			<div style={col({ position: "absolute", left: SIDE, right: SIDE, bottom: 48, gap: 18 })}>
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: 76, lineHeight: 1.05, color: "#fff" }}>
					{clip(c.title.toUpperCase(), 30)}
				</div>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
					{names.map((n) => (
						<div key={n} style={{ display: "flex", backgroundColor: AMBER, color: INK, fontSize: 28, fontWeight: 900, padding: "8px 18px", borderRadius: 999 }}>
							{clip(n, 30)}
						</div>
					))}
					<div style={{ display: "flex", border: `3px solid ${AMBER}`, color: AMBER, fontSize: 28, fontWeight: 900, padding: "5px 16px", borderRadius: 999 }}>
						{`+${Math.max(0, c.tropes.total - names.length)}`}
					</div>
				</div>
			</div>
		</Frame>
	)
}

// --- At a glance -------------------------------------------------------------------------------------------------

const factLine = (c: SubCardContent) =>
	c.glance.facts
		.filter((f) => ["Runtime", "Rated", "Seasons", "Made in"].includes(f.label))
		.map((f) => f.value)
		.slice(0, 3)
		.join(" · ")

function GlA({ c }: { c: SubCardContent }) {
	const by = c.glance.directors.length ? `By ${c.glance.directors.slice(0, 2).join(" & ")}` : null
	return (
		<TitleSplit
			c={c}
			right={<Picture src={c.poster} alignTop style={{ top: 0, left: 0, width: 420, height: 630 }} />}
			underHeight={by ? 96 : 44}
			under={
				<div style={col({ gap: 6 })}>
					{by && <Ink size={34} weight={900}>{clip(by, 34)}</Ink>}
					<Ink size={30} weight={700} style={{ opacity: 0.8 }}>{factLine(c)}</Ink>
				</div>
			}
		/>
	)
}

function GlB({ c }: { c: SubCardContent }) {
	const tiles = c.glance.facts.slice(0, 6)
	return (
		<Frame>
			<div style={{ position: "absolute", top: 0, left: 0, width: 420, height: 630, display: "flex" }}>
				<Picture src={c.poster} alignTop style={{ top: 0, left: 0, width: 420, height: 630 }} />
			</div>
			<div style={{ position: "absolute", top: 44, left: 476, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 476, top: 130, width: 680, gap: 16 })}>
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: c.title.length > 20 ? 50 : 70, lineHeight: 1.05, color: INK }}>
					{clip(c.title.toUpperCase(), 36)}
				</div>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
					{tiles.map((t) => (
						<div key={t.label} style={col({ width: 216, height: 120, backgroundColor: INK, borderRadius: 16, padding: "14px 18px", justifyContent: "space-between" })}>
							<Ink size={18} weight={900} color="rgba(251,191,36,0.75)" style={{ letterSpacing: 2 }}>{t.label.toUpperCase()}</Ink>
							<Ink size={t.value.length > 11 ? 26 : 36} weight={900} color={AMBER}>{clip(t.value, 18)}</Ink>
						</div>
					))}
				</div>
			</div>
		</Frame>
	)
}

function Face({ src, name, role, size = 150 }: { src: string | null; name: string; role?: string; size?: number }) {
	return (
		<div style={col({ alignItems: "center", width: size + 40, gap: 8 })}>
			<div style={{ display: "flex", position: "relative", width: size, height: size, borderRadius: size, overflow: "hidden", backgroundColor: "#374151", border: `5px solid ${INK}` }}>
				<Picture src={src} alignTop style={{ top: 0, left: 0, width: size, height: size }} />
			</div>
			<Ink size={22} weight={900} style={{ textAlign: "center", justifyContent: "center" }}>{clip(name, 18)}</Ink>
			{role && <Ink size={18} weight={700} style={{ opacity: 0.65 }}>{role}</Ink>}
		</div>
	)
}

function GlC({ c }: { c: SubCardContent }) {
	const bandTop = 330
	const stars = c.glance.stars.slice(0, c.glance.directors.length ? 4 : 5)
	return (
		<Frame>
			<Picture src={c.backdrop} style={{ top: 0, left: 0, width: 1200, height: bandTop }} />
			<div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: bandTop, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(0,0,0,0.65), rgba(0,0,0,0.1) 70%)" }} />
			<div style={{ position: "absolute", top: 44, left: SIDE, display: "flex" }}>
				<Brand />
			</div>
			<div style={{ position: "absolute", top: 130, left: SIDE, display: "flex", fontFamily: "Anton", fontSize: 72, color: "#fff", lineHeight: 1.05 }}>
				{clip(c.title.toUpperCase(), 28)}
			</div>
			<div style={{ position: "absolute", top: 44, right: SIDE, display: "flex" }}>
				<Tag text="AT A GLANCE" />
			</div>
			<div style={row({ position: "absolute", top: bandTop - 70, left: SIDE - 20, right: SIDE - 20, justifyContent: "space-between" })}>
				{c.glance.directors[0] && <Face src={c.glance.directorPhoto} name={c.glance.directors[0]} role="Director" />}
				{stars.map((s) => (
					<Face key={s.name} src={s.photo} name={s.name} role=" " />
				))}
			</div>
			<div style={{ position: "absolute", bottom: 40, left: SIDE, display: "flex", fontSize: 28, fontWeight: 700, color: INK, opacity: 0.85 }}>
				{c.glance.facts.slice(0, 4).map((f) => f.value).join(" · ")}
			</div>
		</Frame>
	)
}

function GlD({ c }: { c: SubCardContent }) {
	const rows: [string, string][] = []
	if (c.glance.directors.length) rows.push(["Made by", c.glance.directors.slice(0, 2).join(", ")])
	if (c.glance.stars.length) rows.push(["Starring", c.glance.stars.slice(0, 2).map((s) => s.name).join(", ")])
	const facts = c.glance.facts.filter((f) => f.label !== "Rated").slice(0, 3).map((f) => f.value).join(" · ")
	if (facts) rows.push(["Facts", facts])
	if (c.glance.rated || c.glance.advisories.length)
		rows.push(["Content", [c.glance.rated, ...c.glance.advisories.slice(0, 2)].filter(Boolean).join(" · ")])
	return (
		<Frame>
			<PosterBox src={c.poster} w={300} style={{ position: "absolute", left: SIDE, top: 90, border: `4px solid ${INK}` }} />
			<div style={{ position: "absolute", top: 44, right: SIDE, display: "flex" }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 410, top: 130, width: 734 })}>
				<Ink size={24} weight={900} style={{ letterSpacing: 3, marginBottom: 4 }}>{`AT A GLANCE · ${c.meta}`}</Ink>
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: c.title.length > 20 ? 48 : 64, lineHeight: 1.08, color: INK, marginBottom: 14 }}>
					{clip(c.title.toUpperCase(), 32)}
				</div>
				{rows.map(([label, value]) => (
					<div key={label} style={row({ alignItems: "center", borderTop: "3px solid rgba(10,10,10,0.85)", height: 72 })}>
						<Ink size={22} weight={900} style={{ width: 150, letterSpacing: 2, opacity: 0.7 }}>{label.toUpperCase()}</Ink>
						<Ink size={30} weight={900}>{clip(value, 36)}</Ink>
					</div>
				))}
			</div>
		</Frame>
	)
}

const CARDS: Record<SubKind, Record<string, (p: { c: SubCardContent }) => ReactNode>> = {
	fingerprint: { A: FpA, B: FpB, C: FpC, D: FpD },
	tropes: { A: TrA, B: TrB, C: TrC, D: TrD },
	glance: { A: GlA, B: GlB, C: GlC, D: GlD },
}

export function PrototypeSubCard({ variant, content }: { variant: string; content: SubCardContent }) {
	const Card = CARDS[content.kind][variant]
	return <Card c={content} />
}
