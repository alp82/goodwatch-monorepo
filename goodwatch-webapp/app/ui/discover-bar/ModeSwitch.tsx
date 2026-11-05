// Easy | Advanced: the only way between the modes. One switch (on = Advanced) with a "Mode" caption over the current
// mode's name; the caption and the name together are exactly the switch's height. It sits at the right of the title
// row: beside the title and count on desktop, beside the count on phones (where the nav bar already names the page).
import { AnimatePresence, motion } from "framer-motion"
import type { DiscoverMode } from "./mode"

const SIZE = {
	phone: { column: "h-6", track: "h-6 w-[42px]", knob: "h-5 w-5", travel: 18, cap: "text-[8px] leading-[8px]", word: "h-[14px] w-[60px] text-[12px] leading-[14px]", shift: 14 },
	desktop: { column: "h-7", track: "h-7 w-12", knob: "h-6 w-6", travel: 20, cap: "text-[9px] leading-[9px]", word: "h-[17px] w-[64px] text-[13px] leading-[17px]", shift: 17 },
}
const SPRING = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const

export function ModeSwitch({
	mode,
	onChange,
	large = false,
}: {
	mode: DiscoverMode
	onChange: (mode: DiscoverMode) => void
	/** Desktop: 28 px instead of 24 px. */
	large?: boolean
}) {
	const size = SIZE[large ? "desktop" : "phone"]
	const on = mode === "advanced"
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label="Advanced mode"
			onClick={() => onChange(on ? "easy" : "advanced")}
			className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
		>
			<span aria-hidden className={`flex flex-col items-end justify-between ${size.column}`}>
				<span className={`font-bold tracking-[0.14em] text-gray-500 uppercase ${size.cap}`}>Mode</span>
				<span className={`relative overflow-hidden text-right font-bold text-white ${size.word}`}>
					<AnimatePresence initial={false}>
						<motion.span
							key={mode}
							initial={{ y: on ? size.shift : -size.shift, opacity: 0 }}
							animate={{ y: 0, opacity: 1 }}
							exit={{ y: on ? -size.shift : size.shift, opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="absolute inset-0"
						>
							{on ? "Advanced" : "Easy"}
						</motion.span>
					</AnimatePresence>
				</span>
			</span>
			<span
				aria-hidden
				className={`flex items-center rounded-full p-0.5 transition-colors duration-200 ${size.track} ${on ? "bg-amber-500" : "bg-white/15"}`}
			>
				<motion.span
					initial={false}
					animate={{ x: on ? size.travel : 0 }}
					transition={SPRING}
					className={`rounded-full bg-white shadow ${size.knob}`}
				/>
			</span>
		</button>
	)
}
