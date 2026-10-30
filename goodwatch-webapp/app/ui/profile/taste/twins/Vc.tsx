// Variant c, two rows: an identity row (their avatar, the score, yours; the bold tier word; the Compare cue), the
// tier-colored 0 to 100 bar with its tier names across the strip, then a row of the three counts as big numbers.
// Collapsed: one card about 175 px tall, all of it the button. Expanded: the dashboard opens under the numbers row:
// the pulls line, the overlap, then splits and picks.
import { Cue, Dashboard, FRAME, Metric, PullsLead, STRIP, TierBar, TierWord, Trio, Wash, counts, stripLabel, useMatchFacts } from "./V4-kit"
import type { TwinsProps } from "./types"

const NOTES: Record<string, string> = {
	"Both love": "Both scored 8 or more",
	"Rated by both": "Titles you can compare",
	"Big splits": "3 points apart or more",
}

export default function TwinsVc({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = useMatchFacts(compare)
	return (
		<div ref={topRef} className={FRAME(open)}>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={sectionId}
				onClick={toggle}
				aria-label={stripLabel(f, shell.handle, label)}
				className={`${STRIP} flex flex-col gap-2.5 px-3 pt-3 pb-3 sm:px-5 sm:pt-3.5`}
			>
				<Wash f={f} />
				<span className="relative flex items-center gap-3 sm:gap-5">
					<span className="sm:hidden">
						<Trio shell={shell} f={f} px={30} ring={48} still={still} />
					</span>
					<span className="max-sm:hidden">
						<Trio shell={shell} f={f} px={34} ring={52} still={still} />
					</span>
					<span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
						<TierWord f={f} className="text-2xl max-sm:whitespace-normal sm:text-[2rem]" />
						<span className="truncate text-xs text-gray-400 sm:text-sm">
							You and <span className="text-gray-200">@{shell.handle}</span>
						</span>
					</span>
					<Cue open={open} />
				</span>
				<TierBar p={f.p} still={still} height={6} labels className="relative" />
				<span className="relative grid grid-cols-3 divide-x divide-white/10 pt-1">
					{counts(f).map(([k, n], i) => (
						<span key={k} className={`flex items-end gap-3 ${i ? "pl-3 sm:pl-5" : ""}`}>
							<Metric n={n} label={k} numberClass="text-3xl" />
							<span className="mb-0.5 hidden text-[11px] leading-tight text-gray-600 lg:block">{NOTES[k]}</span>
						</span>
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
