// The orbit round the profile picture: the sought attributes as family-colored dots on a dotted track. At rest it is
// still. Hover, touch or focus (`motion="wake"`) turns it a few degrees with an eased stop, then lets it drift very
// slowly; while the key facts are open (`motion="open"`) it turns once every 36 seconds. Each layer pauses where it is
// when it rests, so it never jumps back. Motion is transform and opacity only, and stops under reduced motion.
import type { ReactNode } from "react"
import type { ProfileShell } from "~/domain/profile"
import { ProfileAvatar } from "../ProfileFrame"
import type { WhorlAttribute } from "../taste/Whorl"
import { FAMILY_COLOR, FAMILY_ORDER, type FamilyId } from "../taste/model"
import { familyPulls } from "./facts"

export type OrbitMotion = "rest" | "wake" | "open"

const TAU = Math.PI * 2
const GAP = 0.06
const R = 88
// Server and browser Math can differ in the last digit; round so hydration matches.
const r1 = (n: number) => Math.round(n * 10) / 10

interface Sector {
	id: FamilyId
	from: number
	to: number
	strength: number
}

/** The five family sectors round the circle (Feel first at the top, clockwise), sized by their attribute counts. */
function sectorsOf(print: WhorlAttribute[]) {
	const pulls = familyPulls(print)
	const free = TAU - GAP * FAMILY_ORDER.length
	let angle = -Math.PI / 2 + GAP / 2
	return FAMILY_ORDER.map((id, i): Sector => {
		const n = print.filter((a) => a.family === id).length
		const from = angle
		angle += (free * n) / Math.max(1, print.length)
		const sector = { id, from, to: angle, strength: pulls[i].strength }
		angle += GAP
		return sector
	})
}

/** Each attribute's angle in its family's sector, with its strength against the strongest edge. */
function placed(print: WhorlAttribute[]) {
	const max = Math.max(...print.map((a) => a.edge), 0.01)
	return sectorsOf(print).flatMap((sector) => {
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

// The nudge is a transition, so leaving eases it back; the drift and the turn are paused animations.
const STYLE = `
@keyframes gw-orbit-turn { to { transform: rotate(360deg); } }
.gw-orbit [data-turn] { animation: gw-orbit-turn var(--turn) linear infinite; animation-play-state: paused; transform-origin: 50% 50%; }
.gw-orbit [data-turn=drift] { --turn: 320s; animation-delay: .7s; }
.gw-orbit [data-turn=open] { --turn: 36s; }
.gw-orbit:not([data-motion=rest]) [data-turn=drift], .gw-orbit[data-motion=open] [data-turn=open] { animation-play-state: running; }
.gw-orbit [data-nudge] { transform: rotate(0deg); transition: transform 1.1s cubic-bezier(.22, 1, .36, 1); }
.gw-orbit:not([data-motion=rest]) [data-nudge] { transform: rotate(9deg); transition-duration: .8s; }
.gw-orbit [data-bright] { opacity: .78; transition: opacity .3s ease; }
.gw-orbit:not([data-motion=rest]) [data-bright] { opacity: 1; }
.gw-orbit [data-glow] { opacity: 0; transition: opacity .4s ease; }
.gw-orbit:not([data-motion=rest]) [data-glow] { opacity: 1; }
@media (prefers-reduced-motion: reduce) {
	.gw-orbit [data-turn] { animation: none; }
	.gw-orbit [data-nudge], .gw-orbit:not([data-motion=rest]) [data-nudge] { transform: none; transition: none; }
	.gw-orbit [data-bright], .gw-orbit [data-glow] { transition: none; }
}
`

/** The profile picture in the middle. */
function Picture({ shell }: { shell: ProfileShell }) {
	return (
		<span className="absolute top-[20%] left-[20%] size-[60%] @container">
			<span className="block size-full *:size-full! *:text-[44cqw]! *:ring-2!">
				<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="sm" />
			</span>
		</span>
	)
}

const Layer = ({
	children,
	...data
}: { children: ReactNode } & Record<`data-${string}`, string>) => (
	<span aria-hidden className="absolute inset-0 will-change-transform" {...data}>
		{children}
	</span>
)

/**
 * The orbit with the picture in it. `className` sets the box (the header's size per width). Without a print, a dashed
 * ring of the same size.
 */
export function OrbitRing({
	shell,
	print,
	motion,
	className,
}: {
	shell: ProfileShell
	print: WhorlAttribute[] | null
	motion: OrbitMotion
	className: string
}) {
	const top = print
		? [...familyPulls(print)].sort((a, b) => b.strength - a.strength)[0]
		: null
	return (
		<div
			className={`gw-orbit relative shrink-0 ${className}`}
			data-orbit="dots"
			data-motion={motion}
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
					<span data-bright className="absolute inset-0">
						<Layer data-nudge="">
							<Layer data-turn="drift">
								<Layer data-turn="open">
									<Dots print={print} />
								</Layer>
							</Layer>
						</Layer>
					</span>
				</>
			) : (
				<span
					aria-hidden
					className="absolute inset-[6%] rounded-full ring-1 ring-white/10 ring-dashed"
				/>
			)}
			<Picture shell={shell} />
		</div>
	)
}

const dotSize = (strength: number) => r1(1.6 + 4.2 * strength)

/** The sought attributes as family-colored dots on a dotted track. */
function Dots({ print }: { print: WhorlAttribute[] }) {
	return (
		<svg
			aria-hidden="true"
			viewBox="-100 -100 200 200"
			className="absolute inset-0 size-full overflow-visible"
		>
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
		</svg>
	)
}
