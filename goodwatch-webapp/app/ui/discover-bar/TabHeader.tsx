// The tab header row, the same 48 px row in every tab: the sub-tabs on the left, each with a count of its active
// choices, and Find on the right. Desktop: Find is the field, 320 px or 34% of the row, whichever is smaller. Phones:
// the sub-tabs scroll sideways (the open one kept in view) and Find is a magnifier that opens the field over them.
import { motion } from "framer-motion"
import { type ReactNode, useEffect, useRef } from "react"
import { TabBadge } from "./DiscoverBar"
import type { SubTab, SubTabId } from "./tabs"

const UNDERLINE_SPRING = {
	type: "spring",
	stiffness: 520,
	damping: 42,
} as const

export const HEADER_HEIGHT = 48

export function TabHeader({
	subTabs,
	active,
	badges,
	onPick,
	dim,
	phone,
	find,
	overlay,
	layoutId,
}: {
	subTabs: SubTab[]
	active: SubTabId
	/** The count on each sub-tab. */
	badges: Partial<Record<SubTabId, number>>
	onPick: (id: SubTabId) => void
	/** Find shows results in place of the sub-tab: the sub-tabs dim, and a tap ends Find. */
	dim: boolean
	phone: boolean
	/** Desktop: the field. Phones: the magnifier that opens it. */
	find: ReactNode
	/** Phones: the open field, over the whole row. */
	overlay?: ReactNode
	/** Tells the underline of this row apart from another row's on the page. */
	layoutId: string
}) {
	const row = useRef<HTMLDivElement>(null)
	// Phones: a chip can open the last sub-tab, so scroll the open one into view.
	useEffect(() => {
		const el = row.current
		if (!phone || !el) return
		const tab = el.querySelector<HTMLElement>(`[data-sub-tab="${active}"]`)
		if (!tab) return
		const left = tab.offsetLeft - 12
		const right = tab.offsetLeft + tab.offsetWidth + 12 - el.clientWidth
		if (el.scrollLeft > left) el.scrollLeft = left
		else if (el.scrollLeft < right) el.scrollLeft = right
	}, [active, phone])
	return (
		<div
			className={`relative flex shrink-0 items-center border-b border-white/[0.07] ${phone ? "" : "px-5"}`}
			style={{ height: HEADER_HEIGHT }}
		>
			<div
				ref={row}
				role="tablist"
				aria-label="Sections"
				className={`relative flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${phone ? "px-3" : ""}`}
			>
				{subTabs.map((sub) => {
					const on = sub.id === active && !dim
					return (
						<button
							key={sub.id}
							type="button"
							role="tab"
							data-sub-tab={sub.id}
							aria-selected={on}
							onClick={() => onPick(sub.id)}
							className={`relative flex h-full shrink-0 items-center gap-2 px-3 text-[14px] font-semibold whitespace-nowrap cursor-pointer outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 ${
								on ? "text-white" : "text-gray-400 hover:text-gray-200"
							} ${dim ? "opacity-50" : ""}`}
						>
							{sub.label}
							<TabBadge n={badges[sub.id] ?? 0} size="md" />
							{on && (
								<motion.span
									layoutId={layoutId}
									transition={UNDERLINE_SPRING}
									className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-amber-400"
								/>
							)}
						</button>
					)
				})}
			</div>
			<div
				className={
					phone ? "shrink-0 pr-1.5 pl-1" : "ml-4 w-[min(320px,34%)] shrink-0"
				}
			>
				{find}
			</div>
			{overlay}
		</div>
	)
}
