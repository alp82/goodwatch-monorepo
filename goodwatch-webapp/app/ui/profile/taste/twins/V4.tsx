// Variant 4, compact strip (round 14, the reference for a to e): the whole match fits one slim row (ring, tier,
// counts, avatars), and the row is the button. Collapsed: just the strip, about 72 px tall, ending in "Compare side by
// side" and a chevron. Expanded: the strip heads a dashboard: stat tiles, the overlap, then splits and picks.
import { DISPLAY } from "~/ui/my-pages/bits"
import { Cue, Dashboard, FRAME, Pair, Ring, STRIP, Wash, pullLines, stripLabel, useMatchFacts } from "./V4-kit"
import type { TwinsProps } from "./types"

export default function TwinsV4({ shell, compare, open, toggle, topRef, still, label, sectionId }: TwinsProps) {
	const f = useMatchFacts(compare)
	const lines = pullLines(compare)
	const tiles: [string, number, string][] = [
		["Both love", f.both, "Both scored 8 or more"],
		["Rated by both", f.rated, "Titles you can compare"],
		["Big splits", f.splits, "3 points apart or more"],
	]
	return (
		<div ref={topRef} className={FRAME(open)}>
			<button
				type="button"
				aria-expanded={open}
				aria-controls={sectionId}
				onClick={toggle}
				aria-label={stripLabel(f, shell.handle, label)}
				className={`${STRIP} flex min-h-[4.5rem] items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4`}
			>
				<Wash f={f} />
				<Ring p={f.p} color={f.color} size={48} stroke={9} still={still}>
					<span className="text-sm font-black tabular-nums" style={{ color: f.color }}>{f.p}</span>
				</Ring>
				<span className="relative flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
					<span className={`${DISPLAY} truncate text-xl leading-tight sm:text-2xl`} style={{ color: f.color }}>
						{f.tier}
					</span>
					<span className="truncate text-xs text-gray-400 sm:text-sm">
						with <span className="text-gray-200">@{shell.handle}</span>
					</span>
				</span>
				<span className={`relative hidden items-center gap-5 pr-2 text-xs text-gray-500 tabular-nums transition-opacity duration-200 lg:flex ${open ? "opacity-0" : ""}`}>
					<span><b className="text-sm text-white">{f.both}</b> both love</span>
					<span><b className="text-sm text-white">{f.rated}</b> rated by both</span>
					<span><b className="text-sm text-white">{f.splits}</b> big splits</span>
				</span>
				<span className={`relative hidden transition-opacity duration-200 sm:block ${open ? "opacity-0" : ""}`}>
					<Pair shell={shell} px={34} />
				</span>
				<Cue open={open} />
			</button>
			<Dashboard
				shell={shell}
				compare={compare}
				open={open}
				still={still}
				label={label}
				sectionId={sectionId}
				lead={
					<div className="grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)] lg:items-stretch">
						<div className="flex flex-col justify-center gap-3 rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/10 sm:p-5">
							<div className="flex items-center gap-3">
								<Pair shell={shell} px={40} />
								<p className="text-sm text-gray-400">
									You and <b className="text-white">@{shell.handle}</b>
								</p>
							</div>
							{(lines.both || lines.apart) && (
								<p className="text-[15px] leading-relaxed text-gray-200">{lines.both} {lines.apart}</p>
							)}
						</div>
						<dl className="grid grid-cols-3 gap-2 sm:gap-3">
							{tiles.map(([t, n, note]) => (
								<div key={t} className="flex flex-col justify-between gap-2 rounded-2xl bg-white/[0.035] p-4 ring-1 ring-white/10">
									<dt className="text-xs font-semibold text-gray-400">{t}</dt>
									<dd className="flex flex-col">
										<span className={`${DISPLAY} text-3xl leading-none tabular-nums`}>{n}</span>
										<span className="mt-1 text-[11px] text-gray-500 max-sm:hidden">{note}</span>
									</dd>
								</div>
							))}
						</dl>
					</div>
				}
			/>
		</div>
	)
}
