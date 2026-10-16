// An on/off switch in the look of Discover's For you switch (filter-bar/motion.tsx Knob): an amber track with a glow
// when on, a lighter track with a ring when off, so off still reads as something to press, and a white thumb that
// slides. Disabled is faded and can't be pressed, apart from off. Only the thumb's transform and the amber layer's
// opacity move, and neither with reduced motion.
export function Switch({
	checked,
	onChange,
	disabled = false,
	labelledBy,
	describedBy,
	label,
}: {
	checked: boolean
	onChange: (checked: boolean) => void
	disabled?: boolean
	/** The id of the visible name beside it; or `label` when there is none. */
	labelledBy?: string
	describedBy?: string
	label?: string
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-labelledby={labelledBy}
			aria-describedby={describedBy}
			aria-label={labelledBy ? undefined : label}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className="group relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed"
		>
			<span
				aria-hidden="true"
				className="absolute inset-0 rounded-full bg-white/20 ring-1 ring-white/25 ring-inset group-hover:bg-white/25 group-hover:ring-white/40 group-disabled:bg-white/[0.06] group-disabled:ring-white/10 group-disabled:group-hover:bg-white/[0.06]"
			/>
			<span
				aria-hidden="true"
				className={`absolute inset-0 rounded-full bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,.55)] transition-opacity duration-200 group-disabled:bg-amber-500/30 group-disabled:shadow-none motion-reduce:transition-none ${checked ? "opacity-100" : "opacity-0"}`}
			/>
			<span
				aria-hidden="true"
				className={`relative ml-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-out group-disabled:bg-gray-500 motion-reduce:transition-none ${checked ? "translate-x-5" : "translate-x-0"}`}
			/>
		</button>
	)
}
