// PROTOTYPE (throwaway, branch prototype/discover-og): five designs for the /discover link-preview card. Question: how
// does one image say "the search understands anything you describe" in a simple way? Queries, chips and posters are
// real answers from the live search (2026-11-02).
import type { ReactNode } from "react"
import { AMBER, Brand, Frame, INK, col, row } from "~/ui/og-image/parts"

export const VARIANTS = [
	{ key: "A", name: "The field: one giant search, its answers under it" },
	{ key: "B", name: "Amber split: today's card, the wall answers a search" },
	{ key: "C", name: "Three searches: the range" },
	{ key: "D", name: "It understood: the words turn into what it looks for" },
	{ key: "E", name: "The words: huge search over a dimmed wall" },
]

export interface Search {
	q: string
	posters: string[]
	chips: { text: string; avoid?: boolean }[]
}
export interface DiscoverCardContent {
	main: Search
	others: Search[]
}

const SLATE = "#151b1c"
const LINE = "#343f42"

const Glass = ({ size, color }: { size: number; color: string }) => (
	<svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
		<circle cx="10.5" cy="10.5" r="7" stroke={color} strokeWidth="3" />
		<path d="M16 16 L22 22" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
	</svg>
)

const Field = ({
	q,
	size,
	height,
	width,
	light = false,
}: { q: string; size: number; height: number; width?: number; light?: boolean }) => (
	<div
		style={row({
			alignItems: "center",
			gap: Math.round(size * 0.42),
			height,
			width,
			padding: `0 ${Math.round(size * 0.7)}px`,
			borderRadius: 16,
			backgroundColor: light ? "#fff" : SLATE,
			border: light ? `4px solid ${INK}` : `4px solid ${AMBER}`,
		})}
	>
		<Glass size={Math.round(size * 0.92)} color={light ? INK : AMBER} />
		<div style={{ display: "flex", fontSize: size, fontWeight: 700, color: light ? INK : "#fff", whiteSpace: "nowrap" }}>
			{q}
		</div>
		<div style={{ display: "flex", width: 5, height: Math.round(size * 1.1), marginLeft: -Math.round(size * 0.28), backgroundColor: light ? INK : AMBER }} />
	</div>
)

const Poster = ({ src, width }: { src: string; width: number }) => {
	const height = Math.round(width * 1.5)
	return (
		<div style={{ display: "flex", width, height, flexShrink: 0, borderRadius: Math.round(width / 16), overflow: "hidden", backgroundColor: SLATE }}>
			<img alt="" src={src} width={width} height={height} style={{ objectFit: "cover" }} />
		</div>
	)
}

const Chip = ({ text, avoid }: { text: string; avoid?: boolean }) => (
	<div
		style={{
			display: "flex",
			padding: "12px 26px",
			borderRadius: 999,
			fontSize: 38,
			fontWeight: 700,
			whiteSpace: "nowrap",
			color: avoid ? "#fca5a5" : "#0a0a0a",
			backgroundColor: avoid ? "#3b1414" : AMBER,
		}}
	>
		{text}
	</div>
)

function FieldCard({ main }: { main: Search }) {
	return (
		<Frame bg={INK}>
			<div style={{ display: "flex", position: "absolute", left: 48, top: 34 }}>
				<Brand size={48} />
			</div>
			<div style={{ display: "flex", position: "absolute", left: 48, top: 112 }}>
				<Field q={main.q} size={74} height={148} width={1104} />
			</div>
			<div style={row({ position: "absolute", left: 48, top: 296, gap: 18 })}>
				{main.posters.slice(0, 5).map((src) => (
					<Poster key={src} src={src} width={206} />
				))}
			</div>
			<div style={{ display: "flex", position: "absolute", left: 0, top: 500, width: 1200, height: 130, backgroundImage: "linear-gradient(to bottom, rgba(10,10,10,0), rgba(10,10,10,1))" }} />
		</Frame>
	)
}

function AmberCard({ main }: { main: Search }) {
	const offsets = [-120, -30, -170]
	return (
		<Frame>
			<div style={{ display: "flex", position: "absolute", left: 620, top: 0, width: 580, height: 630, backgroundColor: INK, overflow: "hidden" }}>
				<div style={row({ position: "absolute", left: 20, top: 0, gap: 16 })}>
					{offsets.map((offset, c) => (
						<div key={offset} style={col({ marginTop: offset, gap: 16 })}>
							{[0, 1, 2, 3].map((r) => (
								<Poster key={r} src={main.posters[(r * 3 + c) % main.posters.length]} width={170} />
							))}
						</div>
					))}
				</div>
			</div>
			<div style={{ display: "flex", position: "absolute", left: 48, top: 40 }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 48, bottom: 48, width: 530, gap: 26 })}>
				<div style={col({ fontFamily: "Anton", fontSize: 104, lineHeight: 1, color: INK, whiteSpace: "nowrap" })}>
					<div>DESCRIBE IT.</div>
					<div>WE FIND IT.</div>
				</div>
				<Field q={main.q} size={42} height={96} width={530} light />
			</div>
		</Frame>
	)
}

function RangeCard({ main, others }: { main: Search; others: Search[] }) {
	const rows = [main, ...others].slice(0, 3)
	return (
		<Frame bg={INK}>
			<div style={col({ position: "absolute", left: 40, top: 8, gap: 8 })}>
				{rows.map((search) => (
					<div key={search.q} style={row({ alignItems: "center", gap: 20, height: 168 })}>
						<Field q={search.q} size={38} height={104} width={770} />
						<div style={row({ gap: 12 })}>
							{search.posters.slice(0, 3).map((src) => (
								<Poster key={src} src={src} width={110} />
							))}
						</div>
					</div>
				))}
			</div>
			<div style={{ display: "flex", position: "absolute", left: 40, bottom: 22 }}>
				<Brand size={48} />
			</div>
		</Frame>
	)
}

function ReadCard({ main }: { main: Search }) {
	return (
		<Frame>
			<div style={{ display: "flex", position: "absolute", left: 0, top: 262, width: 1200, height: 368, backgroundColor: INK }} />
			<div style={{ display: "flex", position: "absolute", right: 44, top: 34 }}>
				<Brand dark />
			</div>
			<div style={col({ position: "absolute", left: 48, top: 118, gap: 18 })}>
				<Field q={main.q} size={62} height={120} width={1104} light />
			</div>
			<div style={row({ position: "absolute", left: 48, top: 288, width: 650, flexWrap: "wrap", gap: 18 })}>
				{main.chips.map((chip) => (
					<Chip key={chip.text} {...chip} />
				))}
			</div>
			<div style={row({ position: "absolute", left: 712, top: 284, gap: 14 })}>
				{main.posters.slice(0, 2).map((src) => (
					<Poster key={src} src={src} width={213} />
				))}
			</div>
			<div style={{ display: "flex", position: "absolute", left: 48, top: 40, fontSize: 40, fontWeight: 900, color: INK }}>
				Say it your way
			</div>
		</Frame>
	)
}

function WordsCard({ main }: { main: Search }) {
	const slots: ReactNode[] = []
	for (let r = 0; r < 2; r++)
		for (let c = 0; c < 6; c++)
			slots.push(<Poster key={`${r}${c}`} src={main.posters[(r * 5 + c) % main.posters.length]} width={190} />)
	return (
		<Frame bg={INK}>
			<div style={row({ position: "absolute", left: 6, top: -40, width: 1190, flexWrap: "wrap", gap: 8, opacity: 0.42 })}>
				{slots}
			</div>
			<div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: 1200, height: 630, backgroundImage: "linear-gradient(to bottom, rgba(10,10,10,0.25), rgba(10,10,10,0.92))" }} />
			<div style={col({ position: "absolute", left: 0, top: 150, width: 1200, alignItems: "center", gap: 6 })}>
				<div style={row({ alignItems: "center", gap: 30 })}>
					<Glass size={120} color={AMBER} />
					<div style={{ display: "flex", fontFamily: "Anton", fontSize: 200, lineHeight: 1.05, color: "#fff" }}>VAMPIRES</div>
				</div>
				<div style={{ display: "flex", fontFamily: "Anton", fontSize: 150, lineHeight: 1.05, color: AMBER }}>BUT FUNNY</div>
			</div>
			<div style={{ display: "flex", position: "absolute", left: 0, bottom: 28, width: 1200, justifyContent: "center" }}>
				<Brand size={48} />
			</div>
		</Frame>
	)
}

export function PrototypeDiscoverCard({ variant, content }: { variant: string; content: DiscoverCardContent }) {
	if (variant === "A") return <FieldCard main={content.main} />
	if (variant === "B") return <AmberCard main={content.main} />
	if (variant === "C") return <RangeCard main={content.main} others={content.others} />
	if (variant === "D") return <ReadCard main={content.main} />
	return <WordsCard main={content.main} />
}
