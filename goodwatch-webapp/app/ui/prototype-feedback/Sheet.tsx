// PROTOTYPE - throwaway. One sheet with three placements, in the look of the filter sheet (filter-bar/SnapSheet) and the
// header pair's dialog: on phones always a bottom sheet with a handle; on desktop a bottom sheet, a full-height panel on
// the right, or a docked panel that leaves the page usable (no backdrop). It moves with transform and opacity only and
// has no backdrop blur, so it stays at 60 fps over a moving page.
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react"
import { XMarkIcon } from "@heroicons/react/24/solid"
import type { ReactNode } from "react"

export type Placement = "bottom" | "right" | "dock"

const PANEL: Record<Placement, string> = {
	// Phones first: a bottom sheet. md+: per placement.
	bottom:
		"md:left-1/2 md:w-[34rem] md:-translate-x-1/2 md:rounded-t-[28px] data-closed:translate-y-full md:data-closed:translate-y-[105%]",
	right:
		"md:inset-y-0 md:right-0 md:left-auto md:bottom-auto md:h-full md:max-h-none md:w-[30rem] md:rounded-none md:rounded-l-2xl data-closed:translate-y-full md:data-closed:translate-y-0 md:data-closed:translate-x-full",
	dock: "",
}

export function Sheet({
	open,
	onClose,
	title,
	placement,
	children,
	footer,
}: {
	open: boolean
	onClose: () => void
	title: ReactNode
	placement: Placement
	children: ReactNode
	footer?: ReactNode
}) {
	if (placement === "dock") return <Dock open={open} onClose={onClose} title={title} footer={footer}>{children}</Dock>
	return (
		<Dialog open={open} onClose={onClose} className="relative z-[1001]">
			<DialogBackdrop transition className="fixed inset-0 bg-black/60 transition-opacity duration-200 data-closed:opacity-0" />
			<DialogPanel
				transition
				data-feedback-private
				className={`fixed inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[28px] bg-gray-950 shadow-[0_-20px_60px_-10px_rgba(0,0,0,.8),inset_0_1px_0_rgba(255,255,255,.08)] ring-1 ring-white/10 transition-transform duration-300 ease-out will-change-transform ${PANEL[placement]}`}
			>
				<Head title={title} onClose={onClose} handle={placement === "bottom" ? "always" : "phone"} />
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5">{children}</div>
				{footer && <div className="shrink-0 border-t border-white/10 px-4 py-3 sm:px-5">{footer}</div>}
			</DialogPanel>
		</Dialog>
	)
}

function Head({ title, onClose, handle, dock = false }: { title: ReactNode; onClose: () => void; handle: "always" | "phone" | "never"; dock?: boolean }) {
	return (
		<div className="shrink-0">
			{handle !== "never" && (
				<div className={`flex justify-center pt-2.5 pb-1 ${handle === "phone" ? "md:hidden" : ""}`}>
					<span className="h-1.5 w-10 rounded-full bg-white/25" />
				</div>
			)}
			<div className="flex items-center gap-2 px-4 pt-2 pb-3 sm:px-5 md:pt-4">
				{dock ? (
					<h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-white">{title}</h2>
				) : (
					<DialogTitle className="min-w-0 flex-1 truncate text-lg font-semibold text-white">{title}</DialogTitle>
				)}
				<button
					type="button"
					onClick={onClose}
					aria-label="Close"
					className="cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10"
				>
					<XMarkIcon className="h-5 w-5" />
				</button>
			</div>
		</div>
	)
}

/** Docked: the page stays usable next to it, so the member can pick the next field without closing it. */
function Dock({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
	return (
		<aside
			aria-hidden={!open}
			aria-label="Fix panel"
			data-feedback-private
			className={`fixed inset-x-0 bottom-0 z-[1001] flex max-h-[70dvh] flex-col overflow-hidden rounded-t-[28px] bg-gray-950 shadow-[0_-20px_60px_-10px_rgba(0,0,0,.8)] ring-1 ring-amber-500/30 transition-[transform,opacity] duration-300 ease-out will-change-transform md:inset-x-auto md:top-32 md:right-4 md:bottom-6 md:max-h-none md:w-[24rem] md:rounded-2xl ${open ? "translate-y-0 opacity-100 md:translate-x-0" : "pointer-events-none translate-y-full opacity-0 md:translate-y-0 md:translate-x-[110%]"}`}
		>
			<Head title={title} onClose={onClose} handle="phone" dock />
			<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5">{open && children}</div>
			{footer && open && <div className="shrink-0 border-t border-white/10 px-4 py-3">{footer}</div>}
		</aside>
	)
}
