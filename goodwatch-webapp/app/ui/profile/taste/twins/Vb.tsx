// Variant b, edge meter: the strip's bottom edge is the tier-colored 0 to 100 bar, a knob in the tier color riding it
// at the match. Above it: their avatar, the score and yours, the bold tier word, then the counts as big numbers with
// their labels beside them. Collapsed: one strip about 96 px tall; phones put the counts on a second row.
// Expanded: the bar becomes the seam between the strip and the dashboard (pulls line, overlap, splits and picks).
import { DISPLAY } from "~/ui/my-pages/bits"
import { Cue, Dashboard, FRAME, PullsLead, STRIP, TierBar, TierWord, Trio, counts, stripLabel, useMatchFacts } from "./V4-kit"
import type { TwinsProps } from "./types"

export default function TwinsVb({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = useMatchFacts(compare)
	return (
		<div ref={topRef} className={FRAME(open)}>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={sectionId}
				onClick={toggle}
				aria-label={stripLabel(f, shell.handle, label)}
				className={`${STRIP} flex flex-wrap items-center gap-x-4 gap-y-3 px-3 pt-3.5 pb-6 sm:gap-x-5 sm:px-5 sm:pt-4 sm:pb-7 ${open ? "rounded-b-none" : ""}`}
				style={{
					backgroundImage: `radial-gradient(70% 140% at ${f.p}% 100%, color-mix(in srgb, ${f.color} ${8 + f.strength * 8}%, transparent), transparent 70%)`,
				}}
			>
				<span className="sm:hidden">
					<Trio shell={shell} f={f} px={30} ring={48} still={still} />
				</span>
				<span className="max-sm:hidden">
					<Trio shell={shell} f={f} px={38} ring={58} still={still} />
				</span>
				<span className="relative flex min-w-0 flex-1 flex-col gap-1">
					<TierWord f={f} className="text-2xl max-sm:whitespace-normal sm:text-3xl" />
					<span className="truncate text-xs text-gray-400 sm:text-sm">
						You and <span className="text-gray-200">@{shell.handle}</span>
					</span>
				</span>
				<span className="relative flex w-full items-center justify-between gap-4 lg:w-auto lg:justify-end lg:gap-7 max-lg:order-last">
					{counts(f).map(([k, n]) => (
						<span key={k} className="flex items-center gap-2">
							<span className={`${DISPLAY} text-2xl leading-none text-white tabular-nums sm:text-4xl`}>{n}</span>
							<span className="w-14 text-[11px] leading-tight font-semibold text-gray-500 sm:text-xs">{k}</span>
						</span>
					))}
				</span>
				<Cue open={open} />
				{/* The meter along the bottom edge, with the knob riding it at the match. */}
				<span className="absolute inset-x-0 bottom-0" aria-hidden>
					<TierBar p={f.p} still={still} height={5} tick={false} rounded={false} />
					<span
						className="absolute bottom-0 size-3.5 -translate-x-1/2 translate-y-[-1px] rounded-full ring-[3px] ring-gray-950"
						style={{
							left: `clamp(10px, ${f.p}%, calc(100% - 10px))`,
							background: f.color,
							boxShadow: `0 0 12px 2px color-mix(in srgb, ${f.color} 60%, transparent)`,
						}}
					/>
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
