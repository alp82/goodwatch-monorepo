// An on/off switch in the look of Discover's For you switch (filter-bar/motion.tsx Knob): an amber track with a glow
// when on, a lighter track with a ring when off, so off still reads as something to press, and a white thumb that
// slides. Disabled is faded and can't be pressed, on or off. Only the thumb's transform, the press's scale and the
// amber layer's opacity move, and none of them with reduced motion. The hit area reaches past the track to 44 px high.
type Name =
	/** The id of the visible name beside the switch. */
	| { labelledBy: string; label?: never }
	/** The name, when there is no visible one. */
	| { label: string; labelledBy?: never }

export function Switch({
	checked,
	onChange,
	disabled = false,
	describedBy,
	...name
}: {
	checked: boolean
	onChange: (checked: boolean) => void
	disabled?: boolean
	describedBy?: string
} & Name) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-labelledby={name.labelledBy}
			aria-label={name.labelledBy ? undefined : name.label}
			aria-describedby={describedBy}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className="group relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full outline-none transition-transform duration-100 before:absolute before:-inset-x-2 before:-inset-y-2 before:content-[''] focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 enabled:active:scale-95 disabled:cursor-not-allowed motion-reduce:transition-none"
		>
			<span
				aria-hidden="true"
				className="absolute inset-0 rounded-full bg-white/20 ring-1 ring-white/25 ring-inset group-hover:bg-white/25 group-hover:ring-white/40 group-disabled:bg-white/[0.06] group-disabled:ring-white/10"
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
