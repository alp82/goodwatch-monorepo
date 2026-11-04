// One-of tabs in a tray: the offer types of Where to watch (Stream 5 · Rent 6 · Buy 4) and any other one-of filter
// with counts. The picked tab is a raised pill with its count in amber; empty tabs stay pressable but quieter.
export interface SegmentedTab {
	key: string
	label: string
	count?: number
	/** The name a screen reader hears, when the label and count alone don't say it ("Stream 5 services"). */
	ariaLabel?: string
	/** For the early-tap replay script (utils/replay-tap.ts). */
	replayTap?: string
}

export function SegmentedTabs({
	tabs,
	value,
	onChange,
	label,
	className = "",
}: {
	tabs: SegmentedTab[]
	value: string
	onChange: (key: string) => void
	/** The group's name for screen readers. */
	label: string
	className?: string
}) {
	return (
		<div
			role="tablist"
			aria-label={label}
			className={`flex w-fit max-w-full overflow-x-auto rounded-lg bg-white/[0.05] p-0.5 ring-1 ring-white/10 [scrollbar-width:none] ${className}`}
		>
			{tabs.map((t) => {
				const on = t.key === value
				const empty = t.count === 0
				return (
					<button
						key={t.key}
						type="button"
						role="tab"
						aria-selected={on}
						aria-label={t.ariaLabel}
						data-replay-tap={t.replayTap}
						onClick={() => onChange(t.key)}
						className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-sm transition-colors duration-150 sm:px-3 ${
							on
								? "bg-white/[0.12] font-semibold text-white"
								: empty
									? "text-gray-500 hover:text-gray-300"
									: "text-gray-300 hover:text-white"
						}`}
					>
						{t.label}
						{t.count != null && (
							<span
								className={`text-xs tabular-nums ${on ? "text-amber-300" : "text-gray-500"}`}
							>
								{t.count}
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}
