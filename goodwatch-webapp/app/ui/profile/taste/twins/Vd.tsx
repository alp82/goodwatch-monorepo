// Variant d, centre stage: "You and @x" and the bold tier word on top, their avatar, the score and yours under it, the tier-colored bar
// beneath them, all centred; what you share (Both love, Rated by both) to the left, where you split to the right.
// Collapsed: one strip about 150 px tall (phones stack the centre over a numbers row, the cue in the corner), the strip is the button.
// Expanded: the pulls line, the overlap, then splits and picks.
import { Cue, Dashboard, FRAME, Metric, PullsLead, STRIP, TierBar, TierWord, Trio, counts, stripLabel, useMatchFacts } from "./V4-kit"
import type { TwinsProps } from "./types"

export default function TwinsVd({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = useMatchFacts(compare)
	const [both, rated, splits] = counts(f)
	return (
		<div ref={topRef} className={FRAME(open)}>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={sectionId}
				onClick={toggle}
				aria-label={stripLabel(f, shell.handle, label)}
				className={`${STRIP} grid grid-cols-3 items-center gap-x-3 gap-y-3 px-3 py-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-10`}
				style={{
					backgroundImage: `radial-gradient(45% 120% at 50% 0%, color-mix(in srgb, ${f.color} ${8 + f.strength * 10}%, transparent), transparent 70%)`,
				}}
			>
				<span className="flex items-center justify-end gap-8 max-lg:contents">
					<Metric n={both[1]} label={both[0]} className="items-end text-right max-lg:items-start max-lg:text-left" numberClass="text-3xl lg:text-4xl" />
					<Metric n={rated[1]} label={rated[0]} className="items-end text-right max-lg:items-start max-lg:text-left" numberClass="text-3xl lg:text-4xl" />
				</span>
				<span className="relative col-span-3 flex flex-col items-center gap-2 max-lg:order-first lg:col-span-1">
					<span className="flex flex-col items-center gap-1">
						<span className="max-w-full truncate text-[11px] font-bold tracking-[0.16em] text-gray-500 uppercase">
							You and <span className="text-gray-300">@{shell.handle}</span>
						</span>
						<TierWord f={f} className="text-[1.75rem] sm:text-[2rem]" />
					</span>
					<span className="sm:hidden">
						<Trio shell={shell} f={f} px={32} ring={50} still={still} />
					</span>
					<span className="max-sm:hidden">
						<Trio shell={shell} f={f} px={38} ring={58} still={still} />
					</span>
					<span className="w-48 sm:w-56">
						<TierBar p={f.p} still={still} height={5} />
					</span>
				</span>
				<span className="flex items-center justify-between gap-6 max-lg:contents">
					<Metric n={splits[1]} label={splits[0]} numberClass="text-3xl lg:text-4xl" />
					<Cue open={open} className="max-lg:absolute max-lg:top-3 max-lg:right-3" />
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
