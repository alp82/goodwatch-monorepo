// Phones: the shelves of More like this's expanded view, where the desktop has them in the rail. While the view is
// open, the title bar's row that holds the page's section nav (PhoneBar.tsx) holds the shelves instead: one chip per
// shelf (its caption and count) in a row that scrolls sideways. The block being read is the raised chip, kept in view
// as the reader scrolls; a tap hops to its block. Closed, the row is the section nav again (`children`).
// The rail's list (rail/TitleRail.tsx) and this row read the same shelfBridge (expanded-view.tsx).
import { type ReactNode, useEffect, useRef } from "react"
import { useShelves } from "~/ui/details/rail/rail-model"

const reducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches

export function PhoneShelfNav({ children }: { children: ReactNode }) {
	const shelves = useShelves()
	const row = useRef<HTMLDivElement>(null)
	const opened = shelves?.opened ?? null

	// The chip of the block being read stays in view: the row scrolls to center it (scrolling only, nothing reflows).
	useEffect(() => {
		const el = row.current
		if (!el || !opened) return
		const chip = el.querySelector<HTMLElement>(
			`[data-shelf-chip="${CSS.escape(opened)}"]`,
		)
		if (!chip) return
		const left = chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2
		el.scrollTo({
			left: Math.max(0, left),
			behavior: reducedMotion() ? "auto" : "smooth",
		})
	}, [opened])

	if (!shelves || !opened) return children
	return (
		// Inside TitleBar, where PhoneBar is: the same height, so the header's bottom stays where it was.
		<nav aria-label="Shelves" className="lg:hidden">
			<div className="border-y border-white/10 bg-stone-950">
				<div
					ref={row}
					className="flex h-12 items-center gap-1.5 overflow-x-auto overscroll-x-contain px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					{shelves.shelves.map((s) => {
						const on = s.id === opened
						return (
							<button
								key={s.id}
								type="button"
								data-shelf-chip={s.id}
								aria-current={on ? "true" : undefined}
								aria-label={`${s.kind}: ${s.title}, ${s.count}`}
								onClick={() => shelves.hop(s.id)}
								className={`flex h-8 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-sm ring-1 transition-colors duration-150 ${
									on
										? "bg-white/[0.12] font-semibold text-white ring-white/20"
										: "text-gray-300 ring-white/10 active:bg-white/[0.06]"
								}`}
							>
								{s.kind || s.title}
								<span
									className={`text-xs tabular-nums ${on ? "text-amber-300" : "text-gray-500"}`}
								>
									{s.count}
								</span>
							</button>
						)
					})}
				</div>
				{/* PhoneBar's progress line's place. */}
				<span aria-hidden="true" className="block h-0.5 bg-white/[.06]" />
			</div>
		</nav>
	)
}
