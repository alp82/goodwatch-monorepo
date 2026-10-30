// Small pieces shared by variants 1 to 5 (round 14): the match numbers, a crisp ring, the pulls sentence, and the two
// avatars at any size. The panels themselves come from ./parts unchanged.
import { motion } from "framer-motion"
import type { ProfileShell } from "~/domain/profile"
import { matchTier } from "~/domain/profile-taste"
import { useAccountSummary } from "~/ui/account/useAccountSummary"
import { ProfileAvatar } from "../../ProfileFrame"
import { matchColor, matchStrength } from "../../match"
import type { Ready } from "./parts"

/** The numbers every card shows. */
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
	}
}

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

/** The tier as the end of "You and @x …". */
export const TIER_PHRASE: Record<string, string> = {
	"Taste twins": "are taste twins",
	"Like-minded": "are like-minded",
	"Common ground": "share common ground",
	"Some overlap": "have some overlap",
	"Different worlds": "live in different worlds",
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
	children?: React.ReactNode
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
function Sized({ px, children }: { px: number; children: React.ReactNode }) {
	return (
		<span className="relative block shrink-0" style={{ width: px, height: px }}>
			<span className="absolute top-0 left-0 block origin-top-left" style={{ transform: `scale(${px / 64})` }}>
				{children}
			</span>
		</span>
	)
}

/** Their avatar, then yours overlapping it. */
export function Pair({ shell, px = 40, overlap = 0.35 }: { shell: ProfileShell; px?: number; overlap?: number }) {
	const me = useAccountSummary()
	return (
		<span className="flex shrink-0 items-center" aria-hidden>
			<Sized px={px}>
				<ProfileAvatar handle={shell.handle} avatar={shell.avatar} size="md" />
			</Sized>
			<span style={{ marginLeft: -px * overlap }}>
				<Sized px={px}>
					<ProfileAvatar handle={me.handle ?? me.initial} avatar={{ url: me.avatarUrl, color: me.color }} size="md" />
				</Sized>
			</span>
		</span>
	)
}

/** Which of the three panels have something to show. */
export function panelsFor(c: Ready) {
	return {
		overlap: true,
		splits: c.shared.length > 0,
		picks: c.overlap.onlyThem.length > 0 || c.overlap.onlyYou.some((x) => x.wished),
	}
}

/** Strips a shared panel's own frame when it sits inside a variant's surface. */
export const FRAMELESS = "[&>div]:rounded-none [&>div]:bg-transparent [&>div]:ring-0"

export const EASE = [0.16, 1, 0.3, 1] as const
