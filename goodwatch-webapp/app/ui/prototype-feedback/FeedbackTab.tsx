// PROTOTYPE - throwaway. The global Feedback tab: collapsed, it's a small nudge; open, it's one text box, bug or idea,
// and "Include a screenshot" (off by default) with a preview of exactly what gets sent. The preview here is a scaled
// copy of the page's DOM with the private parts left out; the real one would use modern-screenshot. Nothing is sent.
// - A: a vertical tab on the right edge; the panel slides in from the right.
// - B: a round button at the bottom left with a one-time hint; the panel grows out of the button.
// - C (round 1: a tab docked to the bottom edge) became the one global Feedback tab, see FeedbackDock.tsx.
// On phones every variant opens a bottom sheet.
import { ChatBubbleLeftEllipsisIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import { FeedbackForm } from "~/ui/prototype-feedback/FeedbackDock"
import { Sheet } from "~/ui/prototype-feedback/Sheet"
import { useFeedback } from "~/ui/prototype-feedback/store"
import { useIsWide } from "~/ui/prototype-feedback/TitlePage"

export default function FeedbackTab() {
	const { variant, viewer } = useFeedback()
	const wide = useIsWide()
	const [open, setOpen] = useState(false)
	const [hint, setHint] = useState(true)
	const style = variant === "A" ? "tiles" : variant === "B" ? "textFirst" : "tabs"
	const form = <FeedbackForm key={variant} style={style} guest={viewer === "guest"} onClose={() => setOpen(false)} />
	const title = variant === "B" ? "Tell us" : "Feedback"

	const phoneSheet = !wide && (
		<Sheet open={open} onClose={() => setOpen(false)} title={title} placement="bottom">
			{open && form}
		</Sheet>
	)
	const close = (
		<button type="button" onClick={() => setOpen(false)} aria-label="Close" className="cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10">
			<XMarkIcon className="size-5" />
		</button>
	)
	const panelHead = (
		<div className="mb-3 flex items-center gap-2">
			<h2 className="flex-1 text-lg font-semibold text-white">{title}</h2>
			{close}
		</div>
	)

	if (variant === "A")
		return (
			<div data-feedback-private>
				<button
					type="button"
					onClick={() => setOpen(true)}
					aria-expanded={open}
					className={`fixed top-1/2 right-0 z-[46] flex -translate-y-1/2 cursor-pointer items-center gap-1.5 rounded-l-lg bg-gray-950 px-1.5 py-3 text-xs font-semibold text-gray-200 shadow-xl ring-1 ring-white/15 transition-transform duration-200 hover:text-white md:px-2 md:text-sm ${open && wide ? "translate-x-full" : ""}`}
				>
					<span className="[writing-mode:vertical-rl] rotate-180">Feedback</span>
				</button>
				{wide && (
					<div
						role="dialog"
						aria-label="Feedback"
						aria-hidden={!open}
						className={`fixed top-1/2 right-4 z-[47] max-h-[calc(100dvh-6rem)] w-[24rem] -translate-y-1/2 overflow-y-auto rounded-2xl bg-gray-950 p-4 shadow-2xl ring-1 ring-white/15 transition-[transform,opacity] duration-300 ease-out ${open ? "opacity-100" : "pointer-events-none translate-x-[110%] opacity-0"}`}
					>
						{panelHead}
						{open && form}
					</div>
				)}
				{phoneSheet}
			</div>
		)

	if (variant === "B")
		return (
			<div data-feedback-private className="fixed bottom-[5.75rem] left-3 z-[46] lg:bottom-6 lg:left-6">
				{wide && (
					<div
						role="dialog"
						aria-label="Tell us"
						aria-hidden={!open}
						className={`absolute bottom-14 left-0 w-[24rem] origin-bottom-left rounded-2xl bg-gray-950 p-4 shadow-2xl ring-1 ring-white/15 transition-[transform,opacity] duration-200 ease-out ${open ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"}`}
					>
						{panelHead}
						{open && form}
					</div>
				)}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => {
							setOpen((o) => !o)
							setHint(false)
						}}
						aria-expanded={open}
						aria-label="Feedback"
						className="grid size-12 cursor-pointer place-items-center rounded-full bg-gray-950 text-amber-400 shadow-xl ring-1 ring-white/15 hover:ring-white/40"
					>
						{open && wide ? <XMarkIcon className="size-5 text-gray-200" /> : <ChatBubbleLeftEllipsisIcon className="size-6" />}
					</button>
					<div
						className={`flex items-center gap-1 rounded-full bg-gray-950 py-1.5 pr-1 pl-3 text-sm text-gray-200 shadow-xl ring-1 ring-white/15 transition-[transform,opacity] duration-300 ${hint && !open ? "opacity-100" : "pointer-events-none -translate-x-2 opacity-0"}`}
					>
						<button type="button" tabIndex={hint ? 0 : -1} onClick={() => (setOpen(true), setHint(false))} className="cursor-pointer">
							Bug or idea? Tell us
						</button>
						<button type="button" tabIndex={hint ? 0 : -1} onClick={() => setHint(false)} aria-label="Hide hint" className="cursor-pointer rounded-full p-1 text-gray-500 hover:text-gray-200">
							<XMarkIcon className="size-4" />
						</button>
					</div>
				</div>
				{phoneSheet}
			</div>
		)

	// C is the global Feedback tab now (FeedbackDock).
	return null
}
