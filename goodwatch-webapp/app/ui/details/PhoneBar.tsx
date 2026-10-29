// Phones: a slim bar between the opener and the sections that sticks under the title bar. It names the sections on
// screen, shows the page's progress, and opens the index or find in its own flow (the page below moves down; nothing
// covers it).
import {
	ChevronDownIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/24/outline"
import { type ReactNode, useEffect, useRef } from "react"
import { type IndexItem, ProgressIndex } from "~/ui/details/ProgressIndex"

/** A line that fills with the whole page's reading progress (transform only, written once per frame). */
function PageProgress() {
	const bar = useRef<HTMLSpanElement>(null)
	useEffect(() => {
		let frame = 0
		const write = () => {
			frame = 0
			const max = document.documentElement.scrollHeight - window.innerHeight
			const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
			if (bar.current) bar.current.style.transform = `scaleX(${p})`
		}
		const on = () => {
			if (!frame) frame = requestAnimationFrame(write)
		}
		write()
		window.addEventListener("scroll", on, { passive: true })
		window.addEventListener("resize", on)
		return () => {
			if (frame) cancelAnimationFrame(frame)
			window.removeEventListener("scroll", on)
			window.removeEventListener("resize", on)
		}
	}, [])
	return (
		<span
			aria-hidden="true"
			className="block h-0.5 overflow-hidden bg-white/[.06]"
		>
			<span
				ref={bar}
				className="block h-full origin-left bg-amber-500/80"
				style={{ transform: "scaleX(0)" }}
			/>
		</span>
	)
}

export function PhoneBar({
	items,
	visible,
	panel,
	setPanel,
	onJump,
	find,
}: {
	items: IndexItem[]
	visible: string[]
	panel: "index" | "find" | null
	setPanel: (p: "index" | "find" | null) => void
	onJump: (id: string) => void
	find: ReactNode
}) {
	const shown = items.filter((i) => visible.includes(i.id))
	const first = shown[0]
	const at = first ? items.indexOf(first) + 1 : 0
	const Icon = first?.icon
	return (
		// The page's sticky bar on a phone (fix mode and the episode list's float read it as the header).
		<div
			data-details-header
			className="sticky top-[116px] z-20 -mx-4 mt-8 lg:hidden"
		>
			<div className="border-y border-white/10 bg-stone-950">
				<div className="flex h-12 items-center gap-1 pl-4 pr-2">
					<button
						type="button"
						aria-expanded={panel === "index"}
						onClick={() => setPanel(panel === "index" ? null : "index")}
						className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
					>
						{Icon ? (
							<Icon className="h-4 w-4 shrink-0 text-amber-400" />
						) : (
							<span className="h-4 w-4 shrink-0" />
						)}
						<span className="min-w-0 flex-1 truncate text-sm">
							<span className="font-semibold text-white">
								{first ? first.label : "On this page"}
							</span>
							{shown.length > 1 && (
								<span className="text-gray-400">
									{" "}
									·{" "}
									{shown
										.slice(1)
										.map((s) => s.label)
										.join(" · ")}
								</span>
							)}
						</span>
						<span className="shrink-0 text-xs tabular-nums text-gray-500">
							{at ? `${at}/${items.length}` : `${items.length}`}
						</span>
						<ChevronDownIcon
							className={`h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150 ${panel === "index" ? "rotate-180" : ""}`}
						/>
					</button>
					<button
						type="button"
						aria-label={panel === "find" ? "Close find" : "Find in this title"}
						aria-expanded={panel === "find"}
						onClick={() => setPanel(panel === "find" ? null : "find")}
						className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-300 hover:bg-white/5"
					>
						{panel === "find" ? (
							<XMarkIcon className="h-5 w-5" />
						) : (
							<MagnifyingGlassIcon className="h-5 w-5" />
						)}
					</button>
				</div>
				<PageProgress />
				{panel && (
					<div className="max-h-[65dvh] overflow-y-auto overscroll-contain border-t border-white/10 px-2 py-3">
						{panel === "index" ? (
							<ProgressIndex
								items={items}
								visible={visible}
								onJump={(id) => {
									setPanel(null)
									requestAnimationFrame(() => onJump(id))
								}}
							/>
						) : (
							find
						)}
					</div>
				)}
			</div>
		</div>
	)
}
