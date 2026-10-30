import type { ProfileShell } from "~/domain/profile"
// PROTOTYPE OPTIONS (member nav, round 10): the fingerprint ring round the profile picture (nav-options.ts `ring`).
// The layout sets the ring's box (one size per width); each style draws inside it and picks its own picture size:
// classic (the taste print behind the picture), halo (thick glowing family bands), orbit (the sought attributes as
// dots on a dotted track, turning slowly), pulse (the print with a soft breathing glow), duo (a quiet ring with an
// amber arc over the strongest family). Motion is transform and opacity only, and stops under reduced motion. With
// `yours` (a member on someone else's profile), orbit and duo also draw the visitor's print (an inner track, an outer arc).
import { FAMILY_NAMES } from "~/domain/taste-attributes"
import type { NavOptions } from "~/ui/navigation/nav-options"
import { ProfileAvatar } from "../ProfileFrame"
import { Whorl, type WhorlAttribute } from "../taste/Whorl"
import { FAMILY_COLOR, FAMILY_ORDER, type FamilyId } from "../taste/model"

export type RingLook = NavOptions["ring"]

const TAU = Math.PI * 2
const GAP = 0.06
const r1 = (n: number) => Math.round(n * 10) / 10

interface Sector {
	id: FamilyId
	from: number
	to: number
	/** 0..1: how strongly the member seeks the family's attributes, against the strongest family. */
	strength: number
}

/** The five family sectors round the circle (Feel at the top, clockwise), sized by their attribute counts. */
function sectorsOf(print: WhorlAttribute[]): Sector[] {
	const free = TAU - GAP * FAMILY_ORDER.length
	const raw = FAMILY_ORDER.map((id) => {
		const attrs = print.filter((a) => a.family === id)
		const pull = attrs.reduce((sum, a) => sum + Math.max(0, a.edge), 0)
		return { id, n: attrs.length, pull: attrs.length ? pull / attrs.length : 0 }
	})
	const max = Math.max(...raw.map((f) => f.pull), 0.0001)
	let angle = -Math.PI / 2 + GAP / 2
	return raw.map((f) => {
		const from = angle
		angle += (free * f.n) / Math.max(1, print.length)
		const sector = { id: f.id, from, to: angle, strength: f.pull / max }
		angle += GAP
		return sector
	})
}

const strongest = (print: WhorlAttribute[]) =>
	[...sectorsOf(print)].sort((a, b) => b.strength - a.strength)[0]

/** An accent arc over a sector: centred on it, at least `min` radians long so a small family still reads. */
function accent(sector: Sector, min = 1.25) {
	const mid = (sector.from + sector.to) / 2
	const half = Math.max(sector.to - sector.from, min) / 2
	return { from: mid - half, to: mid + half }
}

/** Each attribute's angle, in the same sectors. */
function anglesOf(print: WhorlAttribute[]) {
	const sectors = sectorsOf(print)
	return sectors.flatMap((sector) => {
		const attrs = print.filter((a) => a.family === sector.id)
		const w = (sector.to - sector.from) / Math.max(1, attrs.length)
		return attrs.map((a, i) => ({ a, angle: sector.from + w * (i + 0.5) }))
	})
}

const at = (r: number, angle: number) =>
	[r1(r * Math.cos(angle)), r1(r * Math.sin(angle))] as const

/** An SVG arc path on a circle round 0,0. */
function arc(r: number, from: number, to: number) {
	const [x0, y0] = at(r, from)
	const [x1, y1] = at(r, to)
	const large = to - from > Math.PI ? 1 : 0
	return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`
}

const STYLE = `
@keyframes gw-ring-turn { to { transform: rotate(360deg); } }
@keyframes gw-ring-breathe { from { opacity: .35; transform: scale(.9); } to { opacity: .85; transform: scale(1.06); } }
.gw-ring-turn { animation: gw-ring-turn 120s linear infinite; }
.gw-ring-turn-back { animation: gw-ring-turn 160s linear infinite reverse; }
.gw-ring-breathe { animation: gw-ring-breathe 4.8s ease-in-out infinite alternate; }
@media (prefers-reduced-motion: reduce) {
	.gw-ring-turn, .gw-ring-turn-back { animation: none; }
	.gw-ring-breathe { animation: none; opacity: .6; }
}
`

/** The picture's share of the ring's box, per style. */
const PICTURE: Record<RingLook, string> = {
	classic: "56%",
	halo: "64%",
	orbit: "60%",
	pulse: "54%",
	duo: "74%",
}

/** The profile picture, filling `size` of the ring's box. The initial scales with it. */
function Picture({
	shell,
	size,
	ring,
}: { shell: ProfileShell; size: string; ring: string }) {
	return (
		<span
			className="absolute top-1/2 left-1/2 -translate-1/2 @container"
			style={{ width: size, height: size }}
		>
			<span className={`block size-full *:size-full! *:text-[44cqw]! ${ring}`}>
				<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="sm" />
			</span>
		</span>
	)
}

const label = (handle: string) => `@${handle}'s taste print`

/**
 * The fingerprint ring with the picture in it. `className` sets the box (the layout's size per width). Without a print,
 * a dashed ring of the same size.
 */
export function PrintRing({
	look,
	shell,
	print,
	yours = null,
	className,
}: {
	look: RingLook
	shell: ProfileShell
	print: WhorlAttribute[] | null
	/** The visitor's print, on someone else's profile. */
	yours?: WhorlAttribute[] | null
	className: string
}) {
	return (
		<div className={`relative shrink-0 ${className}`} data-ring={look}>
			<style>{STYLE}</style>
			{print ? (
				<Drawn look={look} shell={shell} print={print} yours={yours} />
			) : (
				<span
					aria-hidden
					className="absolute inset-[6%] rounded-full ring-1 ring-white/10 ring-dashed"
				/>
			)}
			<Picture
				shell={shell}
				size={PICTURE[look]}
				ring={look === "duo" ? "*:ring-0!" : "*:ring-2!"}
			/>
		</div>
	)
}

function Drawn({
	look,
	shell,
	print,
	yours,
}: {
	look: RingLook
	shell: ProfileShell
	print: WhorlAttribute[]
	yours: WhorlAttribute[] | null
}) {
	if (look === "halo") return <Halo shell={shell} print={print} />
	if (look === "orbit")
		return <Orbit shell={shell} print={print} yours={yours} />
	if (look === "duo") return <Duo shell={shell} print={print} yours={yours} />
	const top = strongest(print)
	return (
		<>
			{look === "pulse" && (
				<span
					aria-hidden
					className="gw-ring-breathe absolute -inset-[8%] rounded-full"
					style={{
						background: `radial-gradient(closest-side, ${FAMILY_COLOR[top.id]}66, ${FAMILY_COLOR[top.id]}22 55%, transparent 72%)`,
					}}
				/>
			)}
			<span
				aria-hidden
				className="absolute inset-[18%] rounded-full bg-white/[0.04] shadow-[0_0_40px_rgba(167,139,250,0.18)]"
			/>
			<Whorl
				attributes={print}
				turns={look === "pulse" ? 9 : 11}
				rim={false}
				markers={false}
				animate={false}
				label={label(shell.handle)}
				className="absolute inset-0 size-full"
			/>
			{look === "classic" && (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-[3%] rounded-full ring-1 ring-white/[0.07]"
				/>
			)}
		</>
	)
}

// OPTION ring=halo
/** Thick family bands round the picture, each as bright as the member's pull to it, glowing softly. */
function Halo({
	shell,
	print,
}: { shell: ProfileShell; print: WhorlAttribute[] }) {
	const sectors = sectorsOf(print)
	const deg = (a: number) => r1(((a + Math.PI / 2) / TAU) * 360)
	const stops = sectors
		.flatMap((s) => {
			const alpha = Math.round((0.18 + 0.82 * s.strength) * 255)
				.toString(16)
				.padStart(2, "0")
			const color = `${FAMILY_COLOR[s.id]}${alpha}`
			return [
				`transparent ${deg(s.from - GAP / 2)}deg`,
				`transparent ${deg(s.from)}deg`,
				`${color} ${deg(s.from)}deg`,
				`${color} ${deg(s.to)}deg`,
				`transparent ${deg(s.to)}deg`,
			]
		})
		.join(", ")
	const band = {
		background: `conic-gradient(from 0deg, ${stops})`,
		mask: "radial-gradient(closest-side, transparent 66%, #000 67.5%, #000 98%, transparent 100%)",
		WebkitMask:
			"radial-gradient(closest-side, transparent 66%, #000 67.5%, #000 98%, transparent 100%)",
	}
	const name = sectors
		.slice()
		.sort((a, b) => b.strength - a.strength)
		.map((s) => FAMILY_NAMES[s.id].name)
		.join(", ")
	return (
		<span role="img" aria-label={`${label(shell.handle)}: ${name}`}>
			<span
				aria-hidden
				className="absolute inset-[2%] rounded-full opacity-70 blur-md"
				style={band}
			/>
			<span
				aria-hidden
				className="absolute inset-[2%] rounded-full"
				style={band}
			/>
			<span
				aria-hidden
				className="absolute inset-[17%] rounded-full bg-gray-950/60"
			/>
		</span>
	)
}

// OPTION ring=orbit
/** The sought attributes as dots on a dotted track, turning slowly; the visitor's own on an inner track, turning back. */
function Orbit({
	shell,
	print,
	yours,
}: {
	shell: ProfileShell
	print: WhorlAttribute[]
	yours: WhorlAttribute[] | null
}) {
	const dots = (attrs: WhorlAttribute[], r: number, own: boolean) => {
		const max = Math.max(...attrs.map((a) => Math.abs(a.edge)), 0.01)
		return anglesOf(attrs)
			.filter(({ a }) => a.edge > 0)
			.map(({ a, angle }) => {
				const [x, y] = at(r, angle)
				const size = r1(1.6 + 4.4 * Math.min(1, a.edge / max))
				return (
					<circle
						key={a.key}
						cx={x}
						cy={y}
						r={own ? size : r1(size * 0.8)}
						fill={own ? FAMILY_COLOR[a.family] : "#fff"}
						fillOpacity={own ? 0.95 : 0.7}
					/>
				)
			})
	}
	return (
		<span role="img" aria-label={label(shell.handle)}>
			<span aria-hidden className="gw-ring-turn absolute inset-0">
				<svg
					aria-hidden="true"
					viewBox="-100 -100 200 200"
					className="size-full overflow-visible"
				>
					<circle
						r={88}
						fill="none"
						stroke="rgba(255,255,255,.22)"
						strokeWidth={1.4}
						strokeDasharray="0.1 5.2"
						strokeLinecap="round"
					/>
					{dots(print, 88, true)}
				</svg>
			</span>
			{yours && (
				<span aria-hidden className="gw-ring-turn-back absolute inset-0">
					<svg
						aria-hidden="true"
						viewBox="-100 -100 200 200"
						className="size-full overflow-visible"
					>
						<circle
							r={72}
							fill="none"
							stroke="rgba(255,255,255,.12)"
							strokeWidth={1}
							strokeDasharray="0.1 4"
							strokeLinecap="round"
						/>
						{dots(yours, 72, false)}
					</svg>
				</span>
			)}
		</span>
	)
}

// OPTION ring=duo
/** A quiet ring with an amber arc over the strongest family; the visitor's strongest as a thin white arc just outside it. */
function Duo({
	shell,
	print,
	yours,
}: {
	shell: ProfileShell
	print: WhorlAttribute[]
	yours: WhorlAttribute[] | null
}) {
	const strong = strongest(print)
	const top = accent(strong)
	const mine = yours ? accent(strongest(yours), 0.9) : null
	const name = FAMILY_NAMES[strong.id].name
	return (
		<svg
			viewBox="-100 -100 200 200"
			className="absolute inset-0 size-full overflow-visible"
			role="img"
			aria-label={`${label(shell.handle)}: strongest in ${name}`}
		>
			<title>{`Strongest in ${name}`}</title>
			<circle
				r={90}
				fill="none"
				stroke="rgba(255,255,255,.1)"
				strokeWidth={4}
			/>
			{anglesOf(print).map(({ a, angle }) => {
				const [x0, y0] = at(84, angle)
				const [x1, y1] = at(84 - 2 - 4 * Math.max(0, a.edge), angle)
				return (
					<line
						key={a.key}
						x1={x0}
						y1={y0}
						x2={x1}
						y2={y1}
						stroke="rgba(255,255,255,.26)"
						strokeWidth={1.3}
						strokeLinecap="round"
					/>
				)
			})}
			<path
				d={arc(90, top.from, top.to)}
				fill="none"
				stroke="#fbbf24"
				strokeOpacity={0.25}
				strokeWidth={12}
				strokeLinecap="round"
			/>
			<path
				d={arc(90, top.from, top.to)}
				fill="none"
				stroke="#fbbf24"
				strokeWidth={5}
				strokeLinecap="round"
			/>
			{mine && (
				<path
					d={arc(97.5, mine.from, mine.to)}
					fill="none"
					stroke="#fff"
					strokeOpacity={0.85}
					strokeWidth={2.5}
					strokeLinecap="round"
				/>
			)}
		</svg>
	)
}
