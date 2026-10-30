// PROTOTYPE OPTIONS (member nav, round 11): the orbit round the profile picture, in five styles (nav-options.ts
// `orbit`): dots (the sought attributes as family-colored dots on a dotted track), comets (the strongest ones with short
// fading trails), constellation (stars joined by thin lines within each family), bands (one short arc per family, each
// on its own radius and turning at its own pace) and sparks (tiny points, brighter for stronger attributes, that
// twinkle). At rest the orbit is still; `live` (hover, touch, focus, or the open key facts) sets it moving and brightens
// it with a soft glow. Motion is transform and opacity only, and stops under reduced motion. `split` draws the halves
// comparison in place of the orbit: their print on the left half, yours on the right, shared families lit.
import type { CSSProperties, ReactNode } from "react"
import type { ProfileShell } from "~/domain/profile"
import type { NavOptions } from "~/ui/navigation/nav-options"
import { ProfileAvatar } from "../ProfileFrame"
import type { WhorlAttribute } from "../taste/Whorl"
import { FAMILY_COLOR, FAMILY_ORDER, type FamilyId } from "../taste/model"
import { familyPulls, sharedFamilies } from "./facts"

export type OrbitStyle = NavOptions["orbit"]

const TAU = Math.PI * 2
const GAP = 0.06
const R = 88
// Server and browser Math can differ in the last digit; round so hydration matches.
const r1 = (n: number) => Math.round(n * 10) / 10
// A fixed-seed hash, so every visit draws the same orbit.
const hash = (n: number) => {
	const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
	return x - Math.floor(x)
}

interface Sector {
	id: FamilyId
	from: number
	to: number
	strength: number
}

/** The five family sectors over `[start, start + span]` (Feel first, clockwise), sized by their attribute counts. */
function sectorsOf(print: WhorlAttribute[], start = -Math.PI / 2, span = TAU) {
	const pulls = familyPulls(print)
	const gap = (GAP * span) / TAU
	const free = span - gap * FAMILY_ORDER.length
	let angle = start + gap / 2
	return FAMILY_ORDER.map((id, i): Sector => {
		const n = print.filter((a) => a.family === id).length
		const from = angle
		angle += (free * n) / Math.max(1, print.length)
		const sector = { id, from, to: angle, strength: pulls[i].strength }
		angle += gap
		return sector
	})
}

/** Each attribute's angle in its family's sector, with its strength against the strongest edge. */
function placed(print: WhorlAttribute[], start?: number, span?: number) {
	const max = Math.max(...print.map((a) => a.edge), 0.01)
	return sectorsOf(print, start, span).flatMap((sector) => {
		const attrs = print.filter((a) => a.family === sector.id)
		const w = (sector.to - sector.from) / Math.max(1, attrs.length)
		return attrs.map((a, i) => ({
			a,
			angle: sector.from + w * (i + 0.5),
			strength: Math.max(0, a.edge) / max,
		}))
	})
}

const at = (r: number, angle: number) =>
	[r1(r * Math.cos(angle)), r1(r * Math.sin(angle))] as const

function arc(r: number, from: number, to: number) {
	const [x0, y0] = at(r, from)
	const [x1, y1] = at(r, to)
	const large = to - from > Math.PI ? 1 : 0
	return `M${x0} ${y0}A${r} ${r} 0 ${large} 1 ${x1} ${y1}`
}

// Each spinning layer turns while the orbit is live and pauses where it is when it rests, so it never jumps back.
const STYLE = `
@keyframes gw-orbit-turn { to { transform: rotate(360deg); } }
@keyframes gw-orbit-twinkle { 0%, 100% { opacity: var(--o, .5); } 50% { opacity: 1; } }
.gw-orbit [data-spin] { animation: gw-orbit-turn var(--turn, 30s) linear infinite; animation-play-state: paused; transform-origin: 50% 50%; will-change: transform; }
.gw-orbit [data-spin=back] { animation-direction: reverse; }
.gw-orbit[data-live] [data-spin] { animation-play-state: running; }
.gw-orbit [data-twinkle] { opacity: var(--o, .5); }
.gw-orbit[data-live] [data-twinkle] { animation: gw-orbit-twinkle var(--tw, 1.6s) ease-in-out var(--delay, 0s) infinite; }
.gw-orbit [data-bright] { opacity: .78; transition: opacity .3s ease; }
.gw-orbit[data-live] [data-bright] { opacity: 1; }
.gw-orbit [data-glow] { opacity: 0; transition: opacity .4s ease; }
.gw-orbit[data-live] [data-glow] { opacity: 1; }
.gw-orbit [data-lines] { opacity: .3; transition: opacity .3s ease; }
.gw-orbit[data-live] [data-lines] { opacity: .65; }
@media (prefers-reduced-motion: reduce) {
	.gw-orbit [data-spin], .gw-orbit[data-live] [data-twinkle] { animation: none; }
	.gw-orbit [data-bright], .gw-orbit [data-glow], .gw-orbit [data-lines] { transition: none; }
}
`

/** The profile picture in the middle; `className` moves it (the morph shrinks it). */
function Picture({
	shell,
	className = "",
}: { shell: ProfileShell; className?: string }) {
	return (
		<span
			className={`absolute top-[20%] left-[20%] size-[60%] @container ${className}`}
		>
			<span className="block size-full *:size-full! *:text-[44cqw]! *:ring-2!">
				<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="sm" />
			</span>
		</span>
	)
}

const Svg = ({ children }: { children: ReactNode }) => (
	<svg
		aria-hidden="true"
		viewBox="-100 -100 200 200"
		className="absolute inset-0 size-full overflow-visible"
	>
		{children}
	</svg>
)

/** A layer that turns while live, once every `turn` seconds. */
const Spin = ({
	turn,
	back = false,
	children,
}: { turn: number; back?: boolean; children: ReactNode }) => (
	<span
		aria-hidden
		data-spin={back ? "back" : ""}
		className="absolute inset-0"
		style={{ "--turn": `${turn}s` } as CSSProperties}
	>
		<Svg>{children}</Svg>
	</span>
)

/**
 * The orbit with the picture in it. `className` sets the box (the layout's size per width). Without a print, a dashed
 * ring of the same size. `children` draw inside the box, over the orbit and under the picture (the morph's print).
 */
export function OrbitRing({
	look,
	shell,
	print,
	live,
	split = null,
	className,
	orbitClassName = "",
	pictureClassName = "",
	children,
}: {
	look: OrbitStyle
	shell: ProfileShell
	print: WhorlAttribute[] | null
	live: boolean
	/** The visitor's print, to draw the halves comparison in place of the orbit. */
	split?: WhorlAttribute[] | null
	className: string
	/** Moves the orbit layer (the morph grows it). */
	orbitClassName?: string
	pictureClassName?: string
	children?: ReactNode
}) {
	const top = print
		? [...familyPulls(print)].sort((a, b) => b.strength - a.strength)[0]
		: null
	return (
		<div
			className={`gw-orbit relative shrink-0 ${className}`}
			data-orbit={split ? "halves" : look}
			data-live={live || undefined}
		>
			<style>{STYLE}</style>
			{print && top ? (
				<>
					<span
						aria-hidden
						data-glow
						className="absolute -inset-[10%] rounded-full"
						style={{
							background: `radial-gradient(closest-side, ${FAMILY_COLOR[top.id]}40, ${FAMILY_COLOR[top.id]}14 62%, transparent 76%)`,
						}}
					/>
					<span
						data-bright
						className={`absolute inset-0 transition-[transform,opacity] duration-500 ease-out ${orbitClassName}`}
					>
						{split ? (
							<Halves theirs={print} yours={split} />
						) : (
							<Orbit look={look} print={print} />
						)}
					</span>
				</>
			) : (
				<span
					aria-hidden
					className="absolute inset-[6%] rounded-full ring-1 ring-white/10 ring-dashed"
				/>
			)}
			{children}
			<Picture shell={shell} className={pictureClassName} />
		</div>
	)
}

function Orbit({ look, print }: { look: OrbitStyle; print: WhorlAttribute[] }) {
	if (look === "comets") return <Comets print={print} />
	if (look === "constellation") return <Constellation print={print} />
	if (look === "bands") return <Bands print={print} />
	if (look === "sparks") return <Sparks print={print} />
	return <Dots print={print} />
}

const dotSize = (strength: number) => r1(1.6 + 4.2 * strength)

// OPTION orbit=dots
/** The sought attributes as family-colored dots on a dotted track. */
function Dots({ print }: { print: WhorlAttribute[] }) {
	return (
		<Spin turn={36}>
			<circle
				r={R}
				fill="none"
				stroke="rgba(255,255,255,.24)"
				strokeWidth={1.4}
				strokeDasharray="0.1 5.2"
				strokeLinecap="round"
			/>
			{placed(print)
				.filter((p) => p.strength > 0)
				.map(({ a, angle, strength }) => {
					const [x, y] = at(R, angle)
					return (
						<circle
							key={a.key}
							cx={x}
							cy={y}
							r={dotSize(strength)}
							fill={FAMILY_COLOR[a.family]}
						/>
					)
				})}
		</Spin>
	)
}

// OPTION orbit=comets
/** The strongest attributes as comets: a head and a short trail fading behind it, on a faint track. */
function Comets({ print }: { print: WhorlAttribute[] }) {
	const heads = placed(print)
		.filter((p) => p.strength >= 0.35)
		.sort((a, b) => b.strength - a.strength)
		.slice(0, 14)
	return (
		<Spin turn={16}>
			<circle
				r={R}
				fill="none"
				stroke="rgba(255,255,255,.08)"
				strokeWidth={1}
			/>
			{heads.map(({ a, angle, strength }) => {
				const size = r1(2 + 3.4 * strength)
				const color = FAMILY_COLOR[a.family]
				return (
					<g key={a.key}>
						{[1, 2, 3, 4, 5].map((k) => {
							const [x, y] = at(R, angle - k * 0.045 * (0.7 + strength))
							return (
								<circle
									key={k}
									cx={x}
									cy={y}
									r={r1(size * (1 - k * 0.15))}
									fill={color}
									fillOpacity={r1(0.55 - k * 0.1)}
								/>
							)
						})}
						<circle
							cx={at(R, angle)[0]}
							cy={at(R, angle)[1]}
							r={size}
							fill={color}
						/>
					</g>
				)
			})}
		</Spin>
	)
}

// OPTION orbit=constellation
/** The sought attributes as stars at slightly different radii, joined by thin lines within each family. */
function Constellation({ print }: { print: WhorlAttribute[] }) {
	const stars = placed(print)
		.filter((p) => p.strength >= 0.3)
		.map((p, i) => {
			const r = R - 9 + hash(i + 1) * 15
			const [x, y] = at(r, p.angle)
			return { ...p, x, y }
		})
	const lines = stars.flatMap((s, i) => {
		const next = stars[i + 1]
		return next && next.a.family === s.a.family ? [[s, next] as const] : []
	})
	return (
		<Spin turn={48}>
			<g data-lines>
				{lines.map(([s, t]) => (
					<line
						key={`${s.a.key}-${t.a.key}`}
						x1={s.x}
						y1={s.y}
						x2={t.x}
						y2={t.y}
						stroke={FAMILY_COLOR[s.a.family]}
						strokeWidth={0.9}
						strokeLinecap="round"
					/>
				))}
			</g>
			{stars.map(({ a, x, y, strength }) => (
				<g key={a.key}>
					<circle
						cx={x}
						cy={y}
						r={r1(2.4 + 3.2 * strength)}
						fill={FAMILY_COLOR[a.family]}
						fillOpacity={0.22}
					/>
					<circle cx={x} cy={y} r={r1(1.1 + 1.6 * strength)} fill="#fff" />
				</g>
			))}
		</Spin>
	)
}

// OPTION orbit=bands
/** One short arc per family, as long as its pull, each on its own radius and turning at its own pace and way. */
function Bands({ print }: { print: WhorlAttribute[] }) {
	const radii = [94, 86, 78, 90, 82]
	const turns = [14, 22, 18, 26, 20]
	return (
		<>
			{sectorsOf(print).map((s, i) => {
				const mid = (s.from + s.to) / 2
				const half = r1(0.25 + 0.75 * s.strength)
				return (
					<Spin key={s.id} turn={turns[i]} back={i % 2 === 1}>
						<circle
							r={radii[i]}
							fill="none"
							stroke="rgba(255,255,255,.05)"
							strokeWidth={1}
						/>
						<path
							d={arc(radii[i], mid - half, mid + half)}
							fill="none"
							stroke={FAMILY_COLOR[s.id]}
							strokeOpacity={r1(0.35 + 0.65 * s.strength)}
							strokeWidth={r1(2.4 + 2.2 * s.strength)}
							strokeLinecap="round"
						/>
					</Spin>
				)
			})}
		</>
	)
}

/** A four-point star round x,y. */
const star = (x: number, y: number, s: number) =>
	`M${x} ${r1(y - s)}Q${x} ${y} ${r1(x + s)} ${y}Q${x} ${y} ${x} ${r1(y + s)}Q${x} ${y} ${r1(x - s)} ${y}Q${x} ${y} ${x} ${r1(y - s)}Z`

// OPTION orbit=sparks
/** Every sought attribute as a tiny point of light, brighter and bigger for stronger ones; live, they twinkle. */
function Sparks({ print }: { print: WhorlAttribute[] }) {
	return (
		<Spin turn={60}>
			{placed(print)
				.filter((p) => p.strength > 0.05)
				.map(({ a, angle, strength }, i) => {
					const [x, y] = at(R - 6 + hash(i + 7) * 12, angle)
					const style = {
						"--o": r1(0.25 + 0.7 * strength),
						"--delay": `${r1(hash(i + 3) * 1.6)}s`,
						"--tw": `${r1(1.1 + hash(i + 5) * 1.2)}s`,
					} as CSSProperties
					return (
						<path
							key={a.key}
							data-twinkle
							style={style}
							d={star(x, y, r1(2 + 4.6 * strength))}
							fill={strength > 0.6 ? "#fff" : FAMILY_COLOR[a.family]}
						/>
					)
				})}
		</Spin>
	)
}

// OPTION compare=halves
/**
 * Their print on the left half, yours mirrored on the right, so each family faces itself across the picture. Families
 * you both lean toward keep their color on both sides; the others go gray.
 */
function Halves({
	theirs,
	yours,
}: { theirs: WhorlAttribute[]; yours: WhorlAttribute[] }) {
	const shared = new Set(sharedFamilies(theirs, yours).map((f) => f.id))
	const side = (print: WhorlAttribute[], left: boolean) =>
		placed(print, Math.PI / 2 + 0.12, Math.PI - 0.24)
			.filter((p) => p.strength > 0)
			.map(({ a, angle, strength }) => {
				const [x, y] = at(R, left ? angle : Math.PI - angle)
				const lit = shared.has(a.family)
				return (
					<circle
						key={`${left ? "t" : "y"}-${a.key}`}
						cx={x}
						cy={y}
						r={dotSize(strength)}
						fill={lit ? FAMILY_COLOR[a.family] : "#9ca3af"}
						fillOpacity={lit ? 1 : 0.35}
					/>
				)
			})
	return (
		<Svg>
			<path
				d={arc(R, Math.PI / 2 + 0.12, (3 * Math.PI) / 2 - 0.12)}
				fill="none"
				stroke="rgba(255,255,255,.2)"
				strokeWidth={1.4}
				strokeDasharray="0.1 5.2"
				strokeLinecap="round"
			/>
			<path
				d={arc(R, -Math.PI / 2 + 0.12, Math.PI / 2 - 0.12)}
				fill="none"
				stroke="rgba(251,191,36,.3)"
				strokeWidth={1.4}
				strokeDasharray="0.1 5.2"
				strokeLinecap="round"
			/>
			<line x1={0} y1={-96} x2={0} y2={-80} stroke="rgba(255,255,255,.35)" />
			{side(theirs, true)}
			{side(yours, false)}
		</Svg>
	)
}
