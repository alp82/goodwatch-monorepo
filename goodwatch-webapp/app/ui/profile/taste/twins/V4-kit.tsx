// Pieces shared by the compact strip (4) and its round 15 variations (a to e): the shown match numbers (honoring the
// `match` simulation), the avatars, the score between the two avatars, the tier-colored 0 to 100 bar, the big counts,
// the strip's Compare cue, and the dashboard that opens under the strip. The panels come from ./parts unchanged.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { AnimatePresence, motion } from "framer-motion"
import type { ReactNode } from "react"
import type { ProfileShell } from "~/domain/profile"
import { matchTier } from "~/domain/profile-taste"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { DISPLAY } from "~/ui/my-pages/bits"
import { useShownMatch } from "~/ui/navigation/nav-options"
import { ProfileAvatar } from "../../ProfileFrame"
import { matchColor, matchStrength } from "../../match"
import { CountUp, Overlap, Picks, type Ready, Splits } from "./parts"

export const EASE = [0.16, 1, 0.3, 1] as const

/** The numbers every strip shows; the percentage, tier and colors follow the shown (maybe simulated) match. */
export function useMatchFacts(c: Ready) {
	const p = useShownMatch(c.percent)
	return {
		p,
		color: matchColor(p),
		strength: matchStrength(p),
		tier: matchTier(p),
		both: c.overlap.bothCount,
		rated: c.shared.length,
		splits: c.shared.filter((r) => Math.abs(r.yours - r.theirs) >= 3).length,
	}
}
export type Facts = ReturnType<typeof useMatchFacts>

/** The counts with their labels, in a fixed order. */
export const counts = (f: Facts): [string, number][] => [
	["Both love", f.both],
	["Rated by both", f.rated],
	["Big splits", f.splits],
]

/** "You both go for novelty and futuristic." and "They chase melancholy; you chase physical comedy.", either may be
 * missing. */
export function pullLines(c: Ready) {
	const { both, onlyThem, onlyYou } = c.pulls
	return {
		both: both.length ? `You both go for ${both.slice(0, 2).join(" and ").toLowerCase()}.` : null,
		apart:
			onlyThem[0] && onlyYou[0]
				? `They chase ${onlyThem[0].toLowerCase()}; you chase ${onlyYou[0].toLowerCase()}.`
				: null,
	}
}

/** A thin, even ring: a quiet track and the match arc with round ends. Children sit in its middle. */
export function Ring({
	p,
	color,
	size,
	stroke = 6,
	still,
	children,
	className = "",
}: {
	p: number
	color: string
	/** Pixels. */
	size: number
	stroke?: number
	still: boolean
	children?: ReactNode
	className?: string
}) {
	const r = 50 - stroke / 2 - 1
	const c = 2 * Math.PI * r
	return (
		<span className={`relative inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the numbers carry the meaning */}
			<svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
				<circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth={stroke} />
				<motion.circle
					cx="50"
					cy="50"
					r={r}
					fill="none"
					stroke={color}
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={`${((c * p) / 100).toFixed(2)} ${c.toFixed(2)}`}
					initial={still ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.6 }}
				/>
			</svg>
			<span className="relative flex flex-col items-center justify-center">{children}</span>
		</span>
	)
}

/** An avatar at a pixel size: ProfileAvatar's "md" (64 px) scaled down by transform, inside a box of the right size. */
function Sized({ px, children }: { px: number; children: ReactNode }) {
	return (
		<span className="relative block shrink-0" style={{ width: px, height: px }}>
			{/* Sized at 64 px before scaling, so an image avatar's max-width doesn't squeeze it. */}
			<span className="absolute top-0 left-0 block size-16 origin-top-left" style={{ transform: `scale(${px / 64})` }}>
				{children}
			</span>
		</span>
	)
}

/** The owner's avatar or the visitor's at a pixel size. */
export function Face({ who, shell, px }: { who: "them" | "you"; shell: ProfileShell; px: number }) {
	const me = useAccountSummary()
	return (
		<Sized px={px}>
			{who === "them" ? (
				<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="md" />
			) : (
				<ProfileAvatar handle={me.handle ?? me.initial} avatar={{ url: me.avatarUrl, color: me.color }} size="md" />
			)}
		</Sized>
	)
}

/** Their avatar, then yours overlapping it. */
export function Pair({ shell, px = 40, overlap = 0.35 }: { shell: ProfileShell; px?: number; overlap?: number }) {
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			<Face who="them" shell={shell} px={px} />
			<span style={{ marginLeft: -px * overlap }}>
				<Face who="you" shell={shell} px={px} />
			</span>
		</span>
	)
}

/** Their avatar, the score, your avatar (from variant 6): the score is a ring in the tier color between the two avatars,
 * joined by a hairline from their amber to your white. `ring` is the score's size in pixels. */
export function Trio({
	shell,
	f,
	px = 40,
	ring = 56,
	still,
}: { shell: ProfileShell; f: Facts; px?: number; ring?: number; still: boolean }) {
	const gap = Math.max(4, Math.round(px * 0.14))
	return (
		<span className="relative flex shrink-0 items-center" aria-hidden>
			<span
				className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2"
				style={{ background: `linear-gradient(90deg, #fbbf24, ${f.color} 40%, ${f.color} 60%, #fff)` }}
			/>
			<span className="relative rounded-full ring-2 ring-amber-400/70 ring-offset-2 ring-offset-gray-950">
				<Face who="them" shell={shell} px={px} />
			</span>
			<span className="relative z-10 rounded-full bg-gray-950" style={{ marginInline: gap }}>
				<Ring p={f.p} color={f.color} size={ring} stroke={8} still={still}>
					<span className="leading-none font-black tabular-nums" style={{ color: f.color, fontSize: ring * 0.32 }}>
						<CountUp to={f.p} still={still} />
						<span style={{ fontSize: ring * 0.17 }}>%</span>
					</span>
				</Ring>
			</span>
			<span className="relative rounded-full ring-2 ring-white/70 ring-offset-2 ring-offset-gray-950">
				<Face who="you" shell={shell} px={px} />
			</span>
		</span>
	)
}

/** The tier zones on the 0 to 100 scale, as matchTier draws them. */
export const ZONES = [
	[0, 45],
	[45, 60],
	[60, 75],
	[75, 90],
	[90, 100],
] as const

/** The tier-colored 0 to 100 bar (from variant 10): five zones, each filled in its tier color up to the match, a white
 * tick at the match. `labels` adds the tier names under it, the current one in its color. */
export function TierBar({
	p,
	still,
	height = 8,
	labels = false,
	tick = true,
	rounded = true,
	className = "",
}: {
	p: number
	still: boolean
	/** Pixels. */
	height?: number
	labels?: boolean
	tick?: boolean
	rounded?: boolean
	className?: string
}) {
	const here = ZONES.findIndex(([a, b]) => p >= a && (p < b || b === 100))
	return (
		<span className={`relative block ${className}`} aria-hidden>
			<span className="relative flex gap-0.5" style={{ height }}>
				{ZONES.map(([a, b], i) => {
					const fill = Math.max(0, Math.min(1, (p - a) / (b - a)))
					const color = matchColor((a + b) / 2)
					return (
						<span
							key={a}
							className={`relative h-full overflow-hidden ${rounded && i === 0 ? "rounded-l-full" : ""} ${rounded && i === ZONES.length - 1 ? "rounded-r-full" : ""}`}
							style={{ width: `${b - a}%`, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
						>
							<motion.span
								className="absolute inset-0 origin-left"
								style={{ background: color }}
								initial={still ? false : { scaleX: 0 }}
								animate={{ scaleX: fill }}
								transition={{ duration: 0.45, delay: still ? 0 : 0.1 + i * 0.1, ease: "easeOut" }}
							/>
						</span>
					)
				})}
				{tick && (
					<span
						className="absolute w-1 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_2px_rgb(3_7_18)]"
						style={{ left: `${p}%`, top: -3, bottom: -3 }}
					/>
				)}
			</span>
			{labels && (
				<span className="mt-1.5 flex text-[10px] font-bold tracking-wide uppercase">
					{ZONES.map(([a, b], i) => (
						<span
							key={a}
							className={`flex min-w-0 px-0.5 whitespace-nowrap ${i === ZONES.length - 1 ? "justify-end" : ""} ${i === here ? "" : "text-gray-600 max-md:invisible"}`}
							style={{ width: `${b - a}%`, color: i === here ? matchColor((a + b) / 2) : undefined }}
						>
							<span className={i === here ? "" : "truncate"}>{matchTier(a)}</span>
						</span>
					))}
				</span>
			)}
		</span>
	)
}

/** The bold tier word ("Taste twins") in the tier color. */
export function TierWord({ f, className = "" }: { f: Facts; className?: string }) {
	return (
		<span className={`${DISPLAY} block truncate leading-none ${className}`} style={{ color: f.color }}>
			{f.tier}
		</span>
	)
}

/** One big count over its label. */
export function Metric({
	n,
	label,
	className = "",
	numberClass = "text-3xl",
}: { n: number; label: string; className?: string; numberClass?: string }) {
	return (
		<span className={`flex min-w-0 flex-col ${className}`}>
			<span className={`${DISPLAY} leading-none text-white tabular-nums ${numberClass}`}>{n}</span>
			<span className="mt-1 truncate text-[11px] font-semibold text-gray-500 sm:text-xs">{label}</span>
		</span>
	)
}

/** The strip's cue: "Compare side by side" and a chevron, which turns amber with the strip's hover. `short` hides the
 * words on phones. */
export function Cue({ open, short = true, className = "" }: { open: boolean; short?: boolean; className?: string }) {
	return (
		<span
			className={`relative flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] py-2 pr-2.5 pl-3 text-sm font-bold text-amber-300 ring-1 ring-white/10 transition-colors group-hover:bg-amber-400 group-hover:text-gray-950 group-hover:ring-amber-400 ${short ? "max-sm:pl-2.5" : ""} ${className}`}
		>
			<span className={short ? "max-sm:sr-only" : ""}>{open ? "Hide" : "Compare side by side"}</span>
			<ChevronDownIcon className={`size-5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
		</span>
	)
}

/** The strip's shell: the outer frame (gets topRef) whose first child is the strip button. */
export const FRAME = (open: boolean) =>
	`relative rounded-2xl ring-1 transition-colors duration-300 ${open ? "bg-gray-900/60 ring-white/15" : "bg-gray-950 ring-white/10"}`

/** The strip button's base classes: full width, the hover wash, a visible focus ring. */
export const STRIP =
	"group relative w-full cursor-pointer overflow-hidden rounded-2xl text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"

/** The match color washing in from the left as far as the percent reaches (variant 4's fill). */
export function Wash({ f }: { f: Facts }) {
	return (
		<span
			aria-hidden
			className="pointer-events-none absolute inset-y-0 left-0"
			style={{
				width: `${f.p}%`,
				background: `linear-gradient(90deg, color-mix(in srgb, ${f.color} ${6 + f.strength * 6}%, transparent), transparent)`,
			}}
		/>
	)
}

/** The dashboard that opens under the strip: an optional lead row (variant 4 puts its stat tiles there), then the
 * overlap across, then the splits and the picks side by side. Cells fade and rise in one after another. */
export function Dashboard({
	shell,
	compare,
	open,
	still,
	label,
	sectionId,
	lead,
}: {
	shell: ProfileShell
	compare: Ready
	open: boolean
	still: boolean
	label: string
	sectionId: string
	lead?: ReactNode
}) {
	return (
		<AnimatePresence initial={false}>
			{open && (
				<motion.section
					key="dash"
					id={sectionId}
					aria-label={label}
					className="grid gap-3 border-t border-white/10 p-3 sm:gap-4 sm:p-4"
					initial="hidden"
					animate="shown"
					exit={{ opacity: 0, transition: { duration: still ? 0 : 0.12 } }}
					variants={{
						hidden: { opacity: 0 },
						shown: { opacity: 1, transition: { duration: still ? 0 : 0.2, staggerChildren: still ? 0 : 0.05 } },
					}}
				>
					{lead && <Cell still={still}>{lead}</Cell>}
					<Cell still={still}>
						<Overlap handle={shell.handle} c={compare} />
					</Cell>
					<Cell still={still}>
						<div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
							{compare.shared.length > 0 && <Splits handle={shell.handle} c={compare} />}
							<Picks handle={shell.handle} c={compare} />
						</div>
					</Cell>
				</motion.section>
			)}
		</AnimatePresence>
	)
}

/** The lead row of a–e: the pulls sentence as one quiet line, since the strip already shows the numbers. */
export function PullsLead({ compare, shell }: { compare: Ready; shell: ProfileShell }) {
	const lines = pullLines(compare)
	if (!lines.both && !lines.apart) return null
	return (
		<p className="rounded-2xl bg-white/[0.035] px-4 py-3 text-[15px] leading-relaxed text-gray-300 ring-1 ring-white/10 sm:px-5">
			<span className="font-semibold text-white">You and @{shell.handle}. </span>
			{lines.both} {lines.apart}
		</p>
	)
}

function Cell({ still, children }: { still: boolean; children: ReactNode }) {
	return (
		<motion.div
			variants={{
				hidden: { opacity: 0, y: still ? 0 : 10 },
				shown: { opacity: 1, y: 0, transition: { duration: still ? 0 : 0.28, ease: EASE } },
			}}
		>
			{children}
		</motion.div>
	)
}

/** The strip button's accessible name. */
export const stripLabel = (f: Facts, handle: string, label: string) => `${f.p}% match with @${handle}, ${f.tier}. ${label}`
