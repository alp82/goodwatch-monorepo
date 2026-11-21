// How much of it: a touch, plenty, all the way. Three stops as links; the
// mark beside each name fills by one, two or three steps, in the trait's color, so the control reads without words.
// "Any" is the place as it is.
import { Link } from "@remix-run/react"
import { LEVELS, type Level } from "~/domain/browse/address"
import { SELECTED_SOLID } from "~/ui/selection/selected"
import type { Intensity } from "~/domain/browse/types"

const STEPS: Record<Level, number> = { touch: 1, plenty: 2, full: 3 }

function Steps({ n, color, on }: { n: number; color: string; on: boolean }) {
	return (
		<span aria-hidden className="flex items-end gap-[3px]">
			{[1, 2, 3].map((i) => (
				<span
					key={i}
					className="w-[5px] rounded-[2px] transition-colors duration-200"
					style={{
						height: 5 + i * 4,
						background:
							i <= n ? (on ? "#030712" : color) : on ? "rgba(3,7,18,.18)" : "rgba(255,255,255,.14)",
					}}
				/>
			))}
		</span>
	)
}

export function IntensityScale({
	intensity,
	value,
	to,
	label,
}: {
	intensity: Intensity
	value: Level | undefined
	/** A band's address; `undefined` is the place without a band. */
	to: (level: Level | undefined) => string
	/** "How scary?" */
	label?: string
}) {
	const item =
		"flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 sm:gap-2 sm:px-3.5 sm:text-sm"
	const idle = "text-gray-300 hover:bg-white/10 hover:text-white"
	return (
		<nav
			aria-label={label ?? `How ${intensity.trait.word}`}
			className="flex w-fit max-w-full items-center gap-0.5 overflow-x-auto sm:gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10 [scrollbar-width:none]"
		>
			<Link
				to={to(undefined)}
				preventScrollReset
				aria-current={value ? undefined : "true"}
				className={`${item} ${value ? idle : SELECTED_SOLID}`}
			>
				Any
			</Link>
			{LEVELS.map((level) => {
				const band = intensity.bands.find((b) => b.level === level)
				if (!band || !band.titles.length) return null
				const on = value === level
				return (
					<Link
						key={level}
						to={to(level)}
						preventScrollReset
						title={band.blurb}
						aria-current={on ? "true" : undefined}
						className={`${item} ${on ? SELECTED_SOLID : idle}`}
					>
						<Steps n={STEPS[level]} color={intensity.trait.color} on={on} />
						{band.name}
					</Link>
				)
			})}
		</nav>
	)
}
