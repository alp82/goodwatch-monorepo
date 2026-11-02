// PROTOTYPE (discover-easy) round 4 H "Peek": nothing in the page flow but Ready. A small "Read as" button sits on
// Ready's row; it opens the Advanced card as a popover over the grid, so nothing moves.
import { SparklesIcon } from "@heroicons/react/20/solid"
import { useEffect, useRef, useState } from "react"
import { Readout } from "./Readout"
import { qualitiesOf } from "./reading"
import type { Easy } from "./bits"

export const name = "Peek"

export function EasyH({ e }: { e: Easy }) {
	const [open, setOpen] = useState(false)
	const box = useRef<HTMLDivElement>(null)
	const filters = e.chips.filter((c) => c.kind !== "query")
	const has = qualitiesOf(e.reading).length > 0 || filters.length > 0
	useEffect(() => {
		if (!open) return
		const close = (ev: PointerEvent) => !box.current?.contains(ev.target as Node) && setOpen(false)
		window.addEventListener("pointerdown", close)
		return () => window.removeEventListener("pointerdown", close)
	}, [open])
	return (
		<div ref={box} className="relative mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
			<div className="shrink-0">{e.ready}</div>
			{has && (
				<button
					type="button"
					aria-expanded={open}
					onClick={() => setOpen(!open)}
					className={`inline-flex cursor-pointer items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 transition lg:self-auto ${
						open ? "bg-white/10 text-white ring-white/20" : "text-gray-300 ring-white/10 hover:text-white"
					}`}
				>
					<SparklesIcon className="h-4 w-4 text-amber-400" />
					How we read it
					<span className="rounded-full bg-white/10 px-1.5 text-[11px] text-gray-300">{filters.length + qualitiesOf(e.reading).length}</span>
				</button>
			)}
			{open && has && (
				<div className="absolute top-full right-0 left-0 z-30 rounded-[24px] bg-gray-900 shadow-2xl shadow-black/70 lg:left-auto lg:w-[640px] [&>div]:mt-2 [&>div]:bg-gray-900">
					<Readout query={e.query} reading={e.reading} chips={e.chips} onRemove={e.remove} onOpen={e.open} onCustomize={e.customize} easy />
				</div>
			)}
		</div>
	)
}
