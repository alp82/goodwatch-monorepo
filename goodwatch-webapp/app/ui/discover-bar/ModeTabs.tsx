// Easy | Advanced: the only way between the modes. Beside the title on desktop; on phones two full-width tabs over the
// search field.
import type { DiscoverMode } from "./mode"

const MODES: { mode: DiscoverMode; label: string }[] = [
	{ mode: "easy", label: "Easy" },
	{ mode: "advanced", label: "Advanced" },
]

export function ModeTabs({
	mode,
	onChange,
	wide = false,
}: {
	mode: DiscoverMode
	onChange: (mode: DiscoverMode) => void
	wide?: boolean
}) {
	return (
		<div
			role="group"
			aria-label="Discover mode"
			className={wide ? "grid grid-cols-2" : "flex gap-5"}
		>
			{MODES.map((item) => {
				const on = mode === item.mode
				return (
					<button
						key={item.mode}
						type="button"
						aria-pressed={on}
						onClick={() => onChange(item.mode)}
						className={`relative cursor-pointer font-semibold outline-none transition focus-visible:text-white ${
							wide ? "h-9 border-b border-white/10 text-sm" : "pb-1.5 text-[13px]"
						} ${on ? "text-white" : "text-gray-500 hover:text-gray-300"}`}
					>
						{item.label}
						{on && (
							<span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-amber-400" />
						)}
					</button>
				)
			})}
		</div>
	)
}
