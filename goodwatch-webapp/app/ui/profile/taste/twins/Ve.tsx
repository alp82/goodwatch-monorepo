// Variant e, the track: the tier-colored 0 to 100 bar runs the strip's width, and the pair rides it at the match: their
// avatar, the score and yours sit on the bar where the percent falls, so a closer match sits further right. Above the
// track: the bold tier word, the counts as big numbers and the Compare cue. Collapsed: one strip about 140 px tall;
// phones move the counts under the track. Expanded: the pulls line, the overlap, then splits and picks.
import { Cue, Dashboard, FRAME, Metric, PullsLead, STRIP, TierBar, TierWord, Trio, counts, stripLabel, useMatchFacts } from "./V4-kit"
import type { TwinsProps } from "./types"

/** Half the pair's width, so it never hangs over the track's ends. */
const HALF = 70

export default function TwinsVe({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = useMatchFacts(compare)
	return (
		<div ref={topRef} className={FRAME(open)}>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={sectionId}
				onClick={toggle}
				aria-label={stripLabel(f, shell.handle, label)}
				className={`${STRIP} flex flex-col gap-2 px-3 pt-3.5 pb-3 sm:px-5 sm:pt-4 sm:pb-3.5`}
				style={{
					backgroundImage: `radial-gradient(35% 90% at ${f.p}% 100%, color-mix(in srgb, ${f.color} ${8 + f.strength * 10}%, transparent), transparent 75%)`,
				}}
			>
				<span className="relative flex items-center gap-4 lg:gap-8">
					<span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
						<TierWord f={f} className="text-2xl sm:text-[2rem]" />
						<span className="truncate text-xs text-gray-400 sm:text-sm">
							You and <span className="text-gray-200">@{shell.handle}</span>
						</span>
					</span>
					<span className="hidden items-start gap-7 lg:flex">
						{counts(f).map(([k, n]) => (
							<Metric key={k} n={n} label={k} numberClass="text-3xl" />
						))}
					</span>
					<Cue open={open} />
				</span>
				{/* The track: the bar through the middle, the pair riding it at the match. */}
				<span className="relative block h-16" aria-hidden>
					<span className="absolute inset-x-0 top-1/2 -translate-y-1/2">
						<TierBar p={f.p} still={still} height={6} tick={false} />
					</span>
					<span
						className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
						style={{ left: `clamp(${HALF}px, ${f.p}%, calc(100% - ${HALF}px))` }}
					>
						<Trio shell={shell} f={f} px={32} ring={52} still={still} />
					</span>
				</span>
				<span className="relative grid grid-cols-3 gap-3 border-t border-white/10 pt-3 lg:hidden">
					{counts(f).map(([k, n]) => (
						<Metric key={k} n={n} label={k} numberClass="text-2xl sm:text-3xl" />
					))}
				</span>
			</button>
			<Dashboard
				shell={shell}
				compare={compare}
				open={open}
				still={still}
				label={label}
				sectionId={sectionId}
				lead={<PullsLead compare={compare} shell={shell} />}
			/>
		</div>
	)
}
