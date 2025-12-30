interface ToggleProps {
	checked: boolean
	onChange: (checked: boolean) => void
	disabled?: boolean
	size?: "sm" | "md" | "lg"
	className?: string
}

const sizeClasses = {
	sm: {
		wrapper: "p-1.5 rounded-full",
		label: "h-6 w-12",
		knob: "h-6 w-6 after:inset-1 after:rounded-md",
		translate: "peer-checked:translate-x-6",
	},
	md: {
		wrapper: "p-2 rounded-full",
		label: "h-8 w-16",
		knob: "h-8 w-8 after:inset-1.5 after:rounded-lg",
		translate: "peer-checked:translate-x-8",
	},
	lg: {
		wrapper: "p-2.5 rounded-full",
		label: "h-10 w-20",
		knob: "h-10 w-10 after:inset-1.5 after:rounded-lg",
		translate: "peer-checked:translate-x-10",
	},
}

export default function Toggle({
	checked,
	onChange,
	disabled = false,
	size = "md",
	className = "",
}: ToggleProps) {
	const sizes = sizeClasses[size]

	return (
		<div className={`relative bg-gradient-to-b from-primary-200/60 to-primary-500 ${sizes.wrapper} ${className}`}>
			<label className={`relative block ${sizes.label} ${disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}>
				<input
					type="checkbox"
					checked={checked}
					onChange={(e) => !disabled && onChange(e.target.checked)}
					disabled={disabled}
					className="peer absolute inset-0 appearance-none border-none shadow-none outline-none cursor-pointer disabled:cursor-not-allowed"
				/>
				{/* Track */}
				<div className="
					bg-radial-toggle pointer-events-none absolute inset-0 overflow-hidden rounded-full
					shadow-[inset_0_2px_8px_3px_rgba(0,0,0,0.3)]
					after:absolute after:inset-0 after:transform-gpu after:rounded-full
					after:bg-accent-500 after:opacity-0 after:mix-blend-color
					after:transition-opacity after:duration-200
					peer-checked:after:opacity-100
				" />
				{/* Knob */}
				<div className={`
					pointer-events-none absolute top-1/2 left-0 -translate-y-1/2
					rounded-full bg-gradient-to-b from-primary-300 to-primary-600
					drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]
					transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)]
					after:absolute after:rounded-full after:bg-gradient-to-b after:from-primary-400 after:to-primary-500
					${sizes.knob}
					${sizes.translate}
				`} />
			</label>
		</div>
	)
}
