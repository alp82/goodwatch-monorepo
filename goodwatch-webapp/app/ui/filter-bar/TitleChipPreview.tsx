import {
	type ReactNode,
	Suspense,
	lazy,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import type { ActiveChip } from "./labels"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"
const TitlePreviewContent = lazy(
	reloadOnStaleChunk(() => import("./TitlePreviewContent")),
)

/** Native top-layer preview escapes scrolling chip rows and the sheet's clipping. */
export function TitleChipPreview({
	chip,
	children,
}: { chip: ActiveChip; children: ReactNode }) {
	const [open, setOpen] = useState(false)
	const anchor = useRef<HTMLSpanElement>(null)
	const popup = useRef<HTMLDivElement | null>(null)
	const id = useId()
	const closing = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => () => clearTimeout(closing.current), [])
	const show = () => {
		clearTimeout(closing.current)
		setOpen(true)
	}
	const hide = () => {
		closing.current = setTimeout(() => setOpen(false), 150)
	}
	useEffect(() => {
		const element = popup.current
		if (!element || !open) return
		const rect = anchor.current?.getBoundingClientRect()
		if (!rect) return
		element.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 328))}px`
		element.style.top = `${Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 340))}px`
		element.showPopover()
		return () => {
			if (element.isConnected && element.matches(":popover-open"))
				element.hidePopover()
		}
	}, [open])
	if (!chip.preview?.length) return children
	return (
		<span
			ref={anchor}
			className="inline-flex"
			onMouseEnter={show}
			onMouseLeave={hide}
			onFocus={() => setOpen(true)}
			onBlur={(e) => {
				if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
			}}
			onKeyDown={(e) => {
				if (e.key === "Escape" && open) {
					e.stopPropagation()
					setOpen(false)
				}
			}}
			aria-describedby={open ? id : undefined}
		>
			{children}
			<div
				id={id}
				ref={(element) => {
					popup.current = element
					if (element && !element.hasAttribute("popover"))
						element.setAttribute("popover", "manual")
				}}
				hidden={!open}
				role="tooltip"
				className="m-0 max-h-80 w-80 overflow-y-auto rounded-xl border border-white/20 bg-gray-950 p-3 text-white shadow-2xl"
			>
				{open && (
					<Suspense fallback={<p className="text-sm">Loading titles…</p>}>
						<TitlePreviewContent chip={chip} />
					</Suspense>
				)}
			</div>
		</span>
	)
}
