// OPTION upnext=menu: Up next's heading line. Next episodes is the main view and has no third-level row; one button
// leads to the other show lists. It reads "All my shows" on Next episodes and names the status on a status page. It
// opens a navigation menu in the account menu's panel look (a disclosure with links, not an ARIA menu): Next episodes
// first, then Not started · Watching · On hold · Dropped with their counts. A choice goes to the view's own address.
// The panel fades and scales in with opacity and transform only, over the page and under the sticky rows.
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/20/solid"
import { Link, useLocation } from "@remix-run/react"
import { useEffect, useId, useRef, useState } from "react"
import type { NavChoice } from "~/ui/navigation/areas"

const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
const count = (n: number) => n.toLocaleString("en-US")

function Row({ choice, close }: { choice: NavChoice; close: () => void }) {
	return (
		<Link
			to={choice.href}
			replace
			prefetch="intent"
			onClick={close}
			aria-current={choice.here ? "page" : undefined}
			data-view={choice.key}
			className={`flex min-h-11 w-full items-center gap-3 px-4 text-left text-[15px] font-medium hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.06] focus-visible:outline-hidden lg:min-h-9 ${
				choice.here ? "text-white" : "text-gray-200"
			}`}
		>
			<CheckIcon
				className={`h-5 w-5 shrink-0 text-amber-400 ${choice.here ? "" : "invisible"}`}
				aria-hidden
			/>
			<span className="grow truncate">{choice.label}</span>
			{choice.count != null && (
				<span className="text-sm tabular-nums text-gray-500">
					{count(choice.count)}
				</span>
			)}
		</Link>
	)
}

/** `views`: Next episodes, then the four statuses (upNextViews in ./watch-views.ts). */
export function StatusMenu({ views }: { views: NavChoice[] }) {
	const [open, setOpen] = useState(false)
	const root = useRef<HTMLDivElement>(null)
	const button = useRef<HTMLButtonElement>(null)
	const menuId = useId()
	const { pathname } = useLocation()

	// A new view closes the menu (the links close it too; this covers back and forward).
	useEffect(() => setOpen(false), [pathname])

	useEffect(() => {
		if (!open) return
		const onDown = (event: PointerEvent) => {
			if (!root.current?.contains(event.target as Node)) setOpen(false)
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return
			setOpen(false)
			button.current?.focus({ preventScroll: true })
		}
		document.addEventListener("pointerdown", onDown)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("pointerdown", onDown)
			document.removeEventListener("keydown", onKey)
		}
	}, [open])

	const close = () => setOpen(false)
	const [next, ...statuses] = views
	const current = statuses.find((view) => view.here)
	return (
		<div className={`${WRAP} flex h-14 items-end pb-1`} data-status-menu>
			<div ref={root} className="relative">
				<button
					ref={button}
					type="button"
					aria-expanded={open}
					aria-controls={menuId}
					aria-label={
						current
							? `Showing ${current.label}. Choose a show list`
							: "All my shows. Choose a show list"
					}
					onClick={() => setOpen((was) => !was)}
					className={`flex h-9 cursor-pointer items-center gap-2 rounded-full pr-2.5 pl-3.5 text-sm font-semibold ring-1 transition-colors ${
						open
							? "bg-white/[0.1] text-white ring-white/25"
							: "bg-white/[0.05] text-gray-100 ring-white/10 hover:bg-white/[0.1]"
					}`}
				>
					{current ? current.label : "All my shows"}
					{current?.count != null && (
						<span className="text-xs font-medium tabular-nums text-gray-400">
							{count(current.count)}
						</span>
					)}
					<ChevronDownIcon
						className={`size-5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
						aria-hidden
					/>
				</button>
				{open && (
					<nav
						id={menuId}
						aria-label="Your shows"
						data-view-menu
						className="absolute top-full left-0 z-[25] mt-2 w-[min(320px,calc(100vw-2rem))] origin-top-left overflow-hidden rounded-2xl bg-gray-950 py-1.5 text-gray-100 shadow-2xl ring-1 ring-white/10 transition-[opacity,transform] duration-150 ease-out starting:scale-95 starting:opacity-0 motion-reduce:transition-none"
					>
						<Row choice={next} close={close} />
						<div className="mt-1.5 border-t border-white/10 pt-1.5">
							<p className="px-4 pt-1 pb-1 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
								All my shows
							</p>
							{statuses.map((choice) => (
								<Row key={choice.key} choice={choice} close={close} />
							))}
						</div>
					</nav>
				)}
			</div>
		</div>
	)
}
