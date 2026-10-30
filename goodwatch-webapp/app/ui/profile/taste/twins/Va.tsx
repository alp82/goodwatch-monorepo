// Variant a, three blocks: their avatar, the score and yours on the left; the bold tier word over the tier-colored bar
// in the middle; the three counts as big numbers on the right. Collapsed: one strip about 100 px tall (phones: the
// counts drop to a second row), the strip is the button. Expanded: the pulls line, the overlap, then splits and picks.
import { Cue, Dashboard, FRAME, Metric, PullsLead, STRIP, TierBar, TierWord, Trio, Wash, counts, stripLabel, useMatchFacts } from "./V4-kit"
import type { TwinsProps } from "./types"

export default function TwinsVa({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = useMatchFacts(compare)
	return (
		<div ref={topRef} className={FRAME(open)}>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={sectionId}
				onClick={toggle}
				aria-label={stripLabel(f, shell.handle, label)}
				className={`${STRIP} grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-3 py-3.5 sm:px-5 sm:py-4 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:gap-x-8`}
			>
				<Wash f={f} />
				<span className="sm:hidden">
					<Trio shell={shell} f={f} px={30} ring={48} still={still} />
				</span>
				<span className="max-sm:hidden">
					<Trio shell={shell} f={f} px={40} ring={62} still={still} />
				</span>
				<span className="relative flex min-w-0 flex-col gap-2">
					<span className="truncate text-[11px] font-bold tracking-[0.16em] text-gray-500 uppercase">
						You and <span className="text-gray-300">@{shell.handle}</span>
					</span>
					<TierWord f={f} className="text-2xl max-sm:whitespace-normal sm:text-[2rem]" />
					<TierBar p={f.p} still={still} height={6} className="mt-0.5 max-w-xs" />
				</span>
				<span className="relative order-last col-span-3 grid grid-cols-3 gap-3 border-t border-white/10 pt-3 lg:order-none lg:col-span-1 lg:flex lg:gap-7 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
					{counts(f).map(([k, n]) => (
						<Metric key={k} n={n} label={k} numberClass="text-2xl sm:text-3xl lg:text-4xl" />
					))}
				</span>
				<Cue open={open} className="self-start lg:self-center" />
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
