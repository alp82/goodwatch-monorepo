// PROTOTYPE (start page lab, round 12): search bar b · "Split button": the lifted field with an amber Search button
// joined to its right edge (the full height of the bar, "Search" over a ↵ key cap), and the "Try" presets as small chips
// inside the bar under the input line, which turn into Discover's "Read as" chips while a search is on.
import { MagnifyingGlassIcon } from "@heroicons/react/20/solid"
import { useRef } from "react"
import type { StageFlow } from "../stage/ab-shared"
import { BAR_CSS, BAR_SHADOW, BarChipRow, BarInput, EnterKey, useBarSearch } from "./shared"

export function SearchBarB({ f }: { f: StageFlow }) {
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
			<div className="relative flex h-[100px] overflow-hidden rounded-2xl bg-gray-900 ring-1 ring-white/12 sm:h-[116px] sm:rounded-[22px] lg:h-[124px]">
				<div className="flex min-w-0 flex-1 flex-col pl-4 sm:pl-6">
					<BarInput f={f} inputRef={input} onChange={s.onChange} onClear={s.clear} text="text-[20px] sm:text-[28px] lg:text-[34px]" className="h-[54px] pr-1.5 sm:h-[66px] lg:h-[70px]" />
					<div className="mr-2 h-px bg-linear-to-r from-white/15 via-white/[0.06] to-transparent" />
					<BarChipRow f={f} className="-ml-4 mr-0 h-[45px] [&>div]:px-4 [&>div]:pr-6 sm:-ml-6 sm:h-[49px] sm:[&>div]:px-6 lg:h-[53px]" />
				</div>
				{/* The split: one amber block flush with the bar's right edge, the label over its key. */}
				<button
					type="submit"
					aria-label="Search"
					className="group relative flex w-[76px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1.5 bg-amber-400 font-bold text-gray-950 outline-none transition-colors hover:bg-amber-300 focus-visible:bg-amber-300 sm:w-[118px] lg:w-[132px]"
				>
					<span aria-hidden className="absolute inset-y-0 left-0 w-px bg-amber-200/70" />
					<MagnifyingGlassIcon className="h-5 w-5 sm:hidden" aria-hidden />
					<span className="text-[13px] sm:text-[17px] lg:text-lg">Search</span>
					<EnterKey label className="max-sm:hidden" />
				</button>
			</div>
		</form>
	)
}
