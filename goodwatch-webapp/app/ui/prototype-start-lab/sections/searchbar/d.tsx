// PROTOTYPE (start page lab, round 12): search bar d · "Two-row bar": a taller bar. Row 1 is the input and a split
// button (amber "Search" joined to a ↵ key segment); row 2, under a thin divider inside the bar, holds the "Try"
// presets, or Discover's "Read as" chips while a search is on.
import { useRef } from "react"
import type { StageFlow } from "../stage/ab-shared"
import { BAR_CSS, BAR_SHADOW, BarChipRow, BarInput, EnterKey, useBarSearch } from "./shared"

export function SearchBarD({ f }: { f: StageFlow }) {
	const input = useRef<HTMLInputElement>(null)
	const s = useBarSearch(f, input)
	return (
		<form
			role="search"
			className="sb-field pointer-events-auto relative mx-auto w-full"
			onSubmit={(e) => {
				e.preventDefault()
				s.submit()
			}}
		>
			<style>{BAR_CSS}</style>
			<span aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl sm:rounded-[22px]" style={{ boxShadow: BAR_SHADOW }} />
			<span
				aria-hidden
				className="sb-glow pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-amber-400/80 shadow-[0_0_0_6px_rgb(251_191_36/.12),0_0_70px_10px_rgb(251_191_36/.28)] sm:rounded-[22px]"
			/>
			<div className="relative overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-white/12 sm:rounded-[22px]">
				<div className="flex h-[58px] items-center gap-2 pl-4 pr-2 sm:h-[70px] sm:gap-3 sm:pl-6 sm:pr-3 lg:h-[74px]">
					<BarInput f={f} inputRef={input} onChange={s.onChange} onClear={s.clear} text="text-[20px] sm:text-[28px] lg:text-[34px]" className="h-full" />
					{/* The split button: the action and its key, two joined segments. */}
					<button
						type="submit"
						aria-label="Search"
						className="group flex h-10 shrink-0 cursor-pointer items-stretch overflow-hidden rounded-xl font-bold text-gray-950 shadow-[0_6px_18px_-6px_rgb(251_191_36/.6)] outline-none focus-visible:ring-2 focus-visible:ring-amber-200 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 sm:h-12"
					>
						<span className="flex items-center bg-amber-400 px-3.5 text-sm transition-colors group-hover:bg-amber-300 sm:px-5 sm:text-base">Search</span>
						<span className="flex items-center border-l border-amber-600/40 bg-amber-500 px-2.5 transition-colors group-hover:bg-amber-400 max-sm:hidden">
							<EnterKey />
						</span>
					</button>
				</div>
				<div className="mx-4 h-px bg-white/[0.08] sm:mx-6" />
				<BarChipRow f={f} className="h-[44px] [&>div]:px-4 sm:h-[48px] sm:[&>div]:px-6 lg:h-[50px]" />
			</div>
		</form>
	)
}
