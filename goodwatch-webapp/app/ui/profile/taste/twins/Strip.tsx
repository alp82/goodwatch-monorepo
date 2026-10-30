// The comparison strip (round 15 design b): their avatar, the score and yours, the bold tier word, then the counts as
// big numbers. Its bottom edge is the 0 to 100 bar, filled from the left up to the match with a thin line marking it.
// The whole strip is the button; the panels open under it (Panels.tsx, nav option `panels`), and the strip's own
// surface stays the same open or closed.
import { useNavOptions } from "~/ui/navigation/nav-options"
import { DISPLAY } from "~/ui/my-pages/bits"
import { Cue, EdgeBar, STRIP, TierWord, Trio, counts, stripLabel, useMatchFacts } from "./kit"
import { CARD, Panels, attached } from "./Panels"
import type { TwinsProps } from "./types"

export default function TwinsStrip({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = useMatchFacts(compare)
	const look = "3" as const // Panels 3 locked (round 17)
	const inCard = attached(look)
	// Open inside the card, the bar becomes the seam, so the strip's bottom corners go square.
	const seam = open && inCard
	const strip = (
		<div className="relative">
			<button
				type="button"
				aria-expanded={open}
				aria-controls={sectionId}
				onClick={toggle}
				aria-label={stripLabel(f, shell.handle, label)}
				className={`${STRIP} flex flex-wrap items-center gap-x-4 gap-y-3 px-3 pt-3.5 pb-6 sm:gap-x-5 sm:px-5 sm:pt-4 sm:pb-7 ${seam ? "rounded-b-none" : ""}`}
				style={{
					backgroundImage: `radial-gradient(60% 110% at ${f.p}% 100%, color-mix(in srgb, ${f.color} ${3 + f.strength * 4}%, transparent), transparent 70%)`,
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
			</button>
			<EdgeBar p={f.p} still={still} rounded={!seam} />
		</div>
	)
	const panels = (
		<Panels
			look={look}
			shell={shell}
			compare={compare}
			f={f}
			open={open}
			still={still}
			label={label}
			sectionId={sectionId}
		/>
	)
	if (inCard)
		return (
			<div ref={topRef} data-compare-top className={CARD}>
				{strip}
				{panels}
			</div>
		)
	return (
		<div ref={topRef} data-compare-top>
			<div className={CARD}>{strip}</div>
			{panels}
		</div>
	)
}
