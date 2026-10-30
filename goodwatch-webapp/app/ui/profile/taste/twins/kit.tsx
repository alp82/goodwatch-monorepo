// The strip's pieces (Strip.tsx): the shown match numbers (honoring the `match` simulation), the avatars, the score
// between the two avatars, the tier-colored 0 to 100 bar on the strip's edge, the bold tier word, the counts and the
// Compare cue. The panels that open under it are in ./Panels.tsx.
import { ChevronDownIcon } from "@heroicons/react/20/solid"
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import type { ProfileShell } from "~/domain/profile"
import { matchTier } from "~/domain/profile-taste"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { DISPLAY } from "~/ui/my-pages/bits"
import { useShownMatch } from "~/ui/navigation/nav-options"
import { ProfileAvatar } from "../../ProfileFrame"
import { matchColor, matchStrength } from "../../match"
import { CountUp, type Ready, splitsOf } from "./parts"

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
		splits: splitsOf(c).length,
	}
}
export type Facts = ReturnType<typeof useMatchFacts>

/** The counts with their labels, in a fixed order. */
export const counts = (f: Facts): [string, number][] => [
	["Both love", f.both],
	["Rated by both", f.rated],
	["Big splits", f.splits],
]

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

/** The 0 to 100 bar on the strip's bottom edge: one fill from the left up to the match, in the tier colors blending
 * into each other, over a quiet track that shows the five tier zones as faint tints split by ticks. A thin white
 * line, centered on the bar, marks the match; fill and line travel together (transform only). `rounded` rounds the
 * bar's ends with the strip's bottom corners. */
export function EdgeBar({ p, still, rounded }: { p: number; still: boolean; rounded: boolean }) {
	const blend = ZONES.map(([a, b]) => `${matchColor((a + b) / 2)} ${(a + b) / 2}%`).join(", ")
	const t = { duration: still ? 0 : 0.9, ease: EASE, delay: still ? 0 : 0.1 }
	return (
		<span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[5px]" aria-hidden>
			<span
				className={`absolute inset-x-0 -top-4 bottom-0 overflow-hidden transition-[border-radius] duration-300 ${rounded ? "rounded-b-2xl" : ""}`}
			>
				<span className="absolute inset-x-0 bottom-0 flex h-[5px]">
					{ZONES.map(([a, b], i) => (
						<span
							key={a}
							className={`h-full ${i ? "border-l border-gray-950" : ""}`}
							style={{ width: `${b - a}%`, background: `color-mix(in srgb, ${matchColor((a + b) / 2)} 14%, rgb(255 255 255 / .04))` }}
						/>
					))}
				</span>
				{/* The fill: a window sliding right reveals a gradient that stays put. */}
				<motion.span
					className="absolute inset-x-0 bottom-0 h-[5px] overflow-hidden"
					initial={still ? false : { x: "-100%" }}
					animate={{ x: `${p - 100}%` }}
					transition={t}
				>
					<motion.span
						className="absolute inset-0"
						style={{ background: `linear-gradient(90deg, ${blend})` }}
						initial={still ? false : { x: "100%" }}
						animate={{ x: `${100 - p}%` }}
						transition={t}
					/>
				</motion.span>
				{/* The tier dividers stay visible over the fill too. */}
				<span className="absolute inset-x-0 bottom-0 h-[5px]">
					{ZONES.slice(1).map(([a]) => (
						<span
							key={a}
							className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-gray-950"
							style={{ left: `${a}%` }}
						/>
					))}
				</span>
			</span>
			{/* The marker: a line 13 px tall, centered on the 5 px bar. */}
			<motion.span
				className="absolute inset-x-0 -top-1 -bottom-1"
				initial={still ? false : { x: "0%" }}
				animate={{ x: `${p}%` }}
				transition={t}
			>
				<span className="absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgb(3_7_18/.85)]" />
			</motion.span>
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

/** The strip's cue: "Compare side by side" and a chevron, which turns amber with the strip's hover. `short` hides the
 * words on phones. */
export function Cue({ open, short = true, className = "" }: { open: boolean; short?: boolean; className?: string }) {
	return (
		<span
			className={`relative flex shrink-0 items-center gap-1.5 rounded-full bg-white/[0.06] py-2 pr-2.5 pl-3 text-sm font-bold text-amber-300 ring-1 ring-white/10 transition-colors group-hover:bg-amber-400 group-hover:text-gray-950 group-hover:ring-amber-400 ${short ? "max-sm:pl-2.5" : ""} ${className}`}
		>
			{/* Both labels share one grid cell, so the button keeps its width and nothing beside it moves. */}
			<span className={`grid ${short ? "max-sm:sr-only" : ""}`}>
				<span className={`col-start-1 row-start-1 ${open ? "invisible" : ""}`}>Compare side by side</span>
				<span className={`col-start-1 row-start-1 ${open ? "" : "invisible"}`}>Hide the comparison</span>
			</span>
			<ChevronDownIcon className={`size-5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} aria-hidden />
		</span>
	)
}

/** The strip button's base classes: full width, the hover wash, a visible focus ring. */
export const STRIP =
	"group relative w-full cursor-pointer overflow-hidden rounded-2xl text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white"

/** The strip button's accessible name. */
export const stripLabel = (f: Facts, handle: string, label: string) => `${f.p}% match with @${handle}, ${f.tier}. ${label}`
