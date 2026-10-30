// Small pieces shared by variants 6 to 10 (round 14): the match numbers, the pulls sentence, a match ring, the two
// avatars at any size, and the three panels laid out with a frame each variant chooses. The panels themselves are the
// shared ones in parts.tsx, unchanged.
import { matchTier } from "~/domain/profile-taste"
import type { ProfileShell } from "~/domain/profile"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { ProfileAvatar } from "../../ProfileFrame"
import { matchColor, matchStrength } from "../../match"
import { CountUp, Overlap, Picks, type Ready, Splits } from "./parts"

export const EASE = [0.16, 1, 0.3, 1] as const

/** The numbers every variant shows. */
export function matchFacts(c: Ready) {
	const p = c.percent
	return {
		p,
		color: matchColor(p),
		strength: matchStrength(p),
		tier: matchTier(p),
		both: c.overlap.bothCount,
		rated: c.shared.length,
		splits: c.shared.filter((r) => Math.abs(r.yours - r.theirs) >= 3).length,
		forYou: Math.min(4, c.overlap.onlyThem.length),
		forThem: c.overlap.onlyYou.filter((x) => x.wished).slice(0, 4).length,
	}
}

/** "You both go for novelty and futuristic. They chase melancholy; you chase physical comedy." with the pulls in
 * brighter type; null when there is nothing to say. */
export function PullsSentence({ c, className = "" }: { c: Ready; className?: string }) {
	const { both, onlyThem, onlyYou } = c.pulls
	const pair = onlyThem[0] && onlyYou[0]
	if (!both.length && !pair) return null
	return (
		<p className={className}>
			{both.length > 0 && (
				<>
					You both go for{" "}
					<b className="font-semibold text-white">{both.slice(0, 2).join(" and ").toLowerCase()}</b>.{" "}
				</>
			)}
			{pair && (
				<>
					They chase <b className="font-semibold text-amber-300">{onlyThem[0].toLowerCase()}</b>; you chase{" "}
					<b className="font-semibold text-white">{onlyYou[0].toLowerCase()}</b>.
				</>
			)}
		</p>
	)
}

/** A match ring with the percentage inside. `px` is its rendered size. */
export function Ring({
	p,
	color,
	still,
	px,
	stroke = 8,
	label = true,
}: { p: number; color: string; still: boolean; px: number; stroke?: number; label?: boolean }) {
	const R = 60 - stroke / 2 - 1
	const C = 2 * Math.PI * R
	return (
		<span className="relative block shrink-0" style={{ width: px, height: px }}>
			{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the number inside carries the meaning */}
			<svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
				<circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth={stroke} />
				<motion.circle
					cx="60"
					cy="60"
					r={R}
					fill="none"
					stroke={color}
					strokeWidth={stroke}
					strokeLinecap="round"
					strokeDasharray={`${((C * p) / 100).toFixed(1)} ${C.toFixed(1)}`}
					initial={still ? false : { opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.8 }}
				/>
			</svg>
			<span className="absolute inset-0 flex flex-col items-center justify-center">
				<span className="leading-none font-black tabular-nums" style={{ color, fontSize: px * 0.27 }}>
					<CountUp to={p} still={still} />
					<span style={{ fontSize: px * 0.14 }}>%</span>
				</span>
				{label && (
					<span className="mt-1 text-[10px] font-bold tracking-wider text-gray-500 uppercase">match</span>
				)}
			</span>
		</span>
	)
}

/** The owner's avatar or the visitor's, at a size given as Tailwind classes that win over ProfileAvatar's own. */
export function Face({ who, shell, size }: { who: "them" | "you"; shell: ProfileShell; size: string }) {
	const me = useAccountSummary()
	return (
		<span className={`block shrink-0 ${size}`} aria-hidden>
			{who === "them" ? (
				<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="md" />
			) : (
				<ProfileAvatar
					handle={me.handle ?? me.initial}
					avatar={{ url: me.avatarUrl, color: me.color }}
					size="md"
				/>
			)}
		</span>
	)
}

/** The three panels: the overlap, then the splits and the picks side by side on wide screens (as in Meet), each one
 * passed through `frame`, so a variant can restyle or label the frame. */
export function Panels({
	handle,
	c,
	frame = (_k, node) => node,
	columns = true,
}: {
	handle: string
	c: Ready
	frame?: (key: "overlap" | "splits" | "picks", node: ReactNode) => ReactNode
	columns?: boolean
}) {
	const hasSplits = c.shared.length > 0
	const hasPicks = c.overlap.onlyThem.length > 0 || c.overlap.onlyYou.some((x) => x.wished)
	return (
		<>
			{frame("overlap", <Overlap handle={handle} c={c} />)}
			{(hasSplits || hasPicks) && (
				<div className={columns ? "grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : "flex flex-col gap-4"}>
					{hasSplits && frame("splits", <Splits handle={handle} c={c} />)}
					{hasPicks && frame("picks", <Picks handle={handle} c={c} />)}
				</div>
			)}
		</>
	)
}
