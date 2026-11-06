// Previous / next arrows for any sideways-scrolling row: the title page shelves' round StepButton and their 75 % page
// step, hidden on phones (they swipe).
//
//   const row = useStepRow<HTMLDivElement>([items.length])
//   <RowArrows row={row} label="characters" />
//   <div ref={row.ref} onScroll={row.measure} className="overflow-x-auto">…</div>
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid"
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react"

/** `deps`: what changes the row's content, so its edges are measured again. */
export function useStepRow<T extends HTMLElement>(deps: unknown[] = []) {
	const ref = useRef<T>(null)
	const [edges, setEdges] = useState({ start: true, end: true })
	const measure = useCallback(() => {
		const el = ref.current
		if (!el) return
		setEdges({
			start: el.scrollLeft <= 4,
			end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
		})
	}, [])
	useEffect(() => {
		const el = ref.current
		if (!el) return
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [measure, ...deps])
	const step = (d: -1 | 1) => {
		const el = ref.current
		if (!el) return
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		el.scrollBy({
			left: d * el.clientWidth * 0.75,
			behavior: reduce ? "auto" : "smooth",
		})
	}
	return { ref, edges, measure, step, scrolls: !(edges.start && edges.end) }
}

export function RowArrows({
	row,
	label,
}: {
	row: ReturnType<typeof useStepRow>
	/** "characters": the buttons read "Previous characters", "More characters". */
	label: string
}) {
	if (!row.scrolls) return null
	return (
		<div className="hidden shrink-0 items-center gap-1 lg:flex">
			<StepButton
				label={`Previous ${label}`}
				disabled={row.edges.start}
				onClick={() => row.step(-1)}
			>
				<ChevronLeftIcon className="h-5 w-5" />
			</StepButton>
			<StepButton
				label={`More ${label}`}
				disabled={row.edges.end}
				onClick={() => row.step(1)}
			>
				<ChevronRightIcon className="h-5 w-5" />
			</StepButton>
		</div>
	)
}

/** A round arrow button, as the title page shelves have beside their heading. */
export function StepButton({
	label,
	disabled,
	onClick,
	children,
}: {
	label: string
	disabled: boolean
	onClick: () => void
	children: ReactNode
}) {
	return (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-gray-300 ring-1 ring-white/15 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300 disabled:cursor-default disabled:text-gray-700 disabled:ring-white/[0.06] disabled:hover:bg-transparent"
		>
			{children}
		</button>
	)
}
