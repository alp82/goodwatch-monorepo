// Vs me on the fingerprint. The print keeps its size and its rim dots become tracks: each of the owner's dots slides out
// from where it sat when they seek the attribute (in when they avoid it), and the visitor's white ring slides out of the
// same spot. A red line joins the two where the gap is wide. Pointing at a track or at its row in the list lights both
// and the attribute's ridges; the line at the top names it in a fixed place, so nothing moves.
// Motion is transform and opacity only; reduced motion shows the end state at once.
import { AnimatePresence, motion } from "framer-motion"
import { useMemo } from "react"
import { build } from "./Whorl"
import {
	FAMILY_COLOR,
	type FamilyId,
	type TasteAttribute,
	signed,
} from "./model"

const BOX = 236 // the Whorl's viewBox half-size with a rim
const VIEW = `${-BOX} ${-BOX - 10} ${BOX * 2} ${BOX * 2}`
const HALF = 22 // half a track, in viewBox units
const EASE = [0.2, 0.7, 0.2, 1] as const

/** One decimal, without a "−0.0". */
const sg = (n: number) => signed(Math.round(n * 10) / 10 || 0)

export function RimTracks({
	vs,
	attributes,
	yours,
	family,
	selected,
	hover,
	onHover,
	onPick,
	handle,
	still,
}: {
	vs: boolean
	attributes: TasteAttribute[]
	yours: (key: string) => number
	family: FamilyId | null
	selected: string
	hover: string | null
	onHover: (key: string | null) => void
	onPick: (key: string) => void
	handle: string
	still: boolean
}) {
	const tracks = useMemo(() => {
		const max = Math.max(
			...attributes.map((a) => Math.abs(a.edge)),
			...attributes.map((a) => Math.abs(yours(a.key))),
			0.01,
		)
		return {
			max,
			list: build(attributes, 18, true).markers.map((m) => {
				const angle = Math.atan2(m.y, m.x)
				const u = { x: Math.cos(angle), y: Math.sin(angle) }
				const at = (d: number) => ({ x: m.x + u.x * d, y: m.y + u.y * d })
				const y = yours(m.a.key)
				return {
					a: attributes.find((a) => a.key === m.a.key) as TasteAttribute,
					m,
					u,
					at,
					them: (m.a.edge / max) * HALF,
					you: (y / max) * HALF,
					gap: Math.abs(m.a.edge - y),
				}
			}),
		}
	}, [attributes, yours])
	const shown = attributes.find((a) => a.key === (hover ?? selected))
	const t = still ? { duration: 0 } : { duration: 0.65, ease: EASE }
	const wideGap = 0.45 * tracks.max
	return (
		<>
			<AnimatePresence>
				{vs && (
					<motion.svg
						key="tracks"
						viewBox={VIEW}
						className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
						initial={{ opacity: 1 }}
						exit={{ opacity: 1 }}
						role="img"
						aria-label={`A track per attribute on the rim: @${handle}'s dot in colour, yours as a white ring; outward is sought, inward avoided`}
					>
						{tracks.list.map((k) => {
							const lit = k.a.key === hover || k.a.key === selected
							const dim =
								(family && family !== k.a.family) ||
								(hover != null && k.a.key !== hover)
							const wide = k.gap >= wideGap
							const from = k.at(-HALF)
							const to = k.at(HALF)
							const them = k.at(k.them)
							const you = k.at(k.you)
							return (
								// biome-ignore lint/a11y/useKeyWithClickEvents: the attribute rows beside the print are the keyboard way
								<g
									key={k.a.key}
									className="cursor-pointer"
									pointerEvents="all"
									style={{ opacity: dim ? 0.3 : 1, transition: "opacity .15s" }}
									onMouseEnter={() => onHover(k.a.key)}
									onMouseLeave={() => onHover(null)}
									onClick={() => onPick(k.a.key)}
								>
									<motion.line
										x1={from.x}
										y1={from.y}
										x2={to.x}
										y2={to.y}
										stroke="#fff"
										strokeWidth={lit ? 1.6 : 1}
										initial={{ opacity: 0 }}
										animate={{ opacity: lit ? 0.6 : 0.16 }}
										exit={{ opacity: 0 }}
										transition={t}
									/>
									<motion.line
										x1={them.x}
										y1={them.y}
										x2={you.x}
										y2={you.y}
										stroke={wide ? "#fb7185" : "#fff"}
										strokeWidth={wide ? 2.4 : 1.2}
										strokeLinecap="round"
										initial={{ opacity: 0 }}
										animate={{
											opacity: wide ? 0.9 : 0.3,
											transition: { ...t, delay: still ? 0 : 0.45 },
										}}
										exit={{ opacity: 0, transition: { duration: 0.15 } }}
									/>
									<motion.circle
										cx={k.m.x}
										cy={k.m.y}
										r={lit ? k.m.r + 1.5 : k.m.r}
										fill={FAMILY_COLOR[k.a.family]}
										initial={{ x: 0, y: 0 }}
										animate={{ x: k.u.x * k.them, y: k.u.y * k.them }}
										exit={{ x: 0, y: 0 }}
										transition={t}
									/>
									<motion.circle
										cx={k.m.x}
										cy={k.m.y}
										r={lit ? 3.8 : 2.8}
										fill="#030712"
										stroke="#fff"
										strokeWidth={1.4}
										initial={{ x: 0, y: 0, opacity: 0 }}
										animate={{ x: k.u.x * k.you, y: k.u.y * k.you, opacity: 1 }}
										exit={{ x: 0, y: 0, opacity: 0 }}
										transition={t}
									/>
									{/* A wider invisible line, so a track is easy to point at. */}
									<line
										x1={from.x}
										y1={from.y}
										x2={to.x}
										y2={to.y}
										stroke="transparent"
										strokeWidth={11}
									/>
									<title>{`${k.a.label}: @${handle} ${sg(k.a.edge)}, you ${sg(yours(k.a.key))}`}</title>
								</g>
							)
						})}
					</motion.svg>
				)}
			</AnimatePresence>
			<div
				className={`pointer-events-none absolute inset-x-0 top-0 flex h-10 flex-col items-center text-center transition-opacity duration-300 ${vs ? "opacity-100" : "opacity-0"}`}
				aria-hidden={!vs}
			>
				{shown && (
					<>
						<span className="text-sm leading-tight font-black text-white">
							<span aria-hidden>{shown.emoji}</span> {shown.label}
						</span>
						<span className="text-xs font-bold tabular-nums">
							<span style={{ color: FAMILY_COLOR[shown.family] }}>
								@{handle} {sg(shown.edge)}
							</span>
							<span className="text-gray-500"> · </span>
							<span className="text-white">you {sg(yours(shown.key))}</span>
						</span>
					</>
				)}
			</div>
			<div
				className={`pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap max-sm:relative max-sm:mt-1 justify-center gap-x-3 gap-y-1 text-[11px] font-semibold text-gray-300 transition-opacity duration-300 ${vs ? "opacity-100" : "opacity-0"}`}
				aria-hidden={!vs}
			>
				<span className="inline-flex items-center gap-1.5">
					<span className="size-2.5 rounded-full bg-gray-300" aria-hidden />@
					{handle}
				</span>
				<span className="inline-flex items-center gap-1.5">
					<span
						className="size-2.5 rounded-full ring-[1.5px] ring-white"
						aria-hidden
					/>
					you
				</span>
				<span>outward seeks, inward avoids</span>
				<span className="inline-flex items-center gap-1.5">
					<span className="h-0.5 w-4 rounded-full bg-rose-400" aria-hidden />
					big gap
				</span>
			</div>
		</>
	)
}
