// PROTOTYPE - throwaway. The global Feedback tab: collapsed, it's a small nudge; open, it's one text box, bug or idea,
// and "Include a screenshot" (off by default) with a preview of exactly what gets sent. The preview here is a scaled
// copy of the page's DOM with the private parts left out; the real one would use modern-screenshot. Nothing is sent.
// - A: a vertical tab on the right edge; the panel slides in from the right.
// - B: a round button at the bottom left with a one-time hint; the panel grows out of the button.
// - C: a tab docked to the bottom edge; the panel rises from it like a tray.
// On phones every variant opens a bottom sheet.
import { BugAntIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, LightBulbIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { ChevronUpIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"
import { PrimaryButton } from "~/ui/auth/kit"
import { INPUT } from "~/ui/prototype-feedback/ReportFlow"
import { Sheet } from "~/ui/prototype-feedback/Sheet"
import { useFeedback } from "~/ui/prototype-feedback/store"
import { useIsWide } from "~/ui/prototype-feedback/TitlePage"

type Kind = "bug" | "idea"

/** A scaled copy of what's on screen now, without the feedback panel, the switcher, form fields or avatars. */
function Snapshot() {
	const box = useRef<HTMLDivElement>(null)
	const [ratio, setRatio] = useState(0.5625)
	useEffect(() => {
		const host = box.current
		const page = document.querySelector<HTMLElement>("[data-feedback-page]")
		if (!host || !page) return
		const w = window.innerWidth
		const h = window.innerHeight
		setRatio(h / w)
		const clone = page.cloneNode(true) as HTMLElement
		for (const el of clone.querySelectorAll("[data-feedback-private], .search-private, [data-member-avatar]")) el.remove()
		for (const el of clone.querySelectorAll("input, textarea, select")) {
			const bar = document.createElement("div")
			bar.style.cssText = "height:2.5rem;border-radius:.5rem;background:#1f2937"
			el.replaceWith(bar)
		}
		for (const el of clone.querySelectorAll("[id]")) el.removeAttribute("id")
		const top = page.getBoundingClientRect().top
		clone.style.cssText = `position:absolute;left:0;top:${top}px;width:${w}px;pointer-events:none`
		const frame = document.createElement("div")
		const scale = host.clientWidth / w
		frame.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform:scale(${scale});transform-origin:0 0;overflow:hidden;background:#111827`
		frame.appendChild(clone)
		host.replaceChildren(frame)
	}, [])
	return (
		<div className="overflow-hidden rounded-lg ring-1 ring-white/15">
			<div ref={box} {...{ inert: "" }} aria-hidden className="relative w-full overflow-hidden bg-gray-900" style={{ aspectRatio: `1 / ${ratio}`, maxHeight: "11rem" }} />
		</div>
	)
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			onClick={() => onChange(!on)}
			className="flex w-full cursor-pointer items-center gap-3 text-left text-sm font-medium text-gray-100"
		>
			<span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-amber-500" : "bg-white/15"}`} aria-hidden>
				<span className={`absolute top-1 left-1 size-4 rounded-full bg-white transition-transform duration-200 ${on ? "translate-x-4" : ""}`} />
			</span>
			{label}
		</button>
	)
}

function KindTabs({ kind, setKind }: { kind: Kind; setKind: (k: Kind) => void }) {
	return (
		<div role="tablist" aria-label="Kind" className="flex rounded-full bg-white/8 p-0.5 text-sm">
			{(["bug", "idea"] as const).map((k) => (
				<button
					key={k}
					type="button"
					role="tab"
					aria-selected={kind === k}
					onClick={() => setKind(k)}
					className={`flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 ${kind === k ? "bg-white font-semibold text-black" : "text-gray-300 hover:text-white"}`}
				>
					{k === "bug" ? <BugAntIcon className="size-4" /> : <LightBulbIcon className="size-4" />}
					{k === "bug" ? "A bug" : "An idea"}
				</button>
			))}
		</div>
	)
}

function KindTiles({ kind, setKind }: { kind: Kind; setKind: (k: Kind) => void }) {
	return (
		<div className="grid grid-cols-2 gap-2">
			{(["bug", "idea"] as const).map((k) => (
				<button
					key={k}
					type="button"
					aria-pressed={kind === k}
					onClick={() => setKind(k)}
					className={`flex cursor-pointer flex-col items-start gap-1 rounded-xl p-3 text-left ring-1 transition-colors ${kind === k ? "bg-amber-500/10 ring-amber-500/60" : "bg-white/[0.04] ring-white/10 hover:ring-white/25"}`}
				>
					{k === "bug" ? <BugAntIcon className="size-5 text-amber-400" /> : <LightBulbIcon className="size-5 text-amber-400" />}
					<span className="text-sm font-semibold text-gray-100">{k === "bug" ? "Something's broken" : "An idea"}</span>
					<span className="text-xs text-gray-500">{k === "bug" ? "Tell us what happened" : "What would help you?"}</span>
				</button>
			))}
		</div>
	)
}

export function FeedbackForm({ style, onClose }: { style: "tiles" | "textFirst" | "tabs"; onClose: () => void }) {
	const { viewer } = useFeedback()
	const [kind, setKind] = useState<Kind>("bug")
	const [text, setText] = useState("")
	const [shot, setShot] = useState(false)
	const [sent, setSent] = useState(false)
	if (sent)
		return (
			<div className="flex flex-col gap-4 py-2" aria-live="polite">
				<div className="flex items-start gap-3">
					<span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-300">
						<CheckCircleIcon className="size-6" />
					</span>
					<div>
						<p className="text-lg font-semibold text-white">Thanks! It's with us.</p>
						<p className="mt-0.5 text-sm text-gray-400">
							We read every message.{" "}
							{viewer === "guest" ? "Want an answer? Use the contact form on Support." : "If we have a question, we'll email you."}
						</p>
					</div>
				</div>
				<div className="flex gap-2">
					<button
						type="button"
						onClick={() => {
							setSent(false)
							setText("")
							setShot(false)
						}}
						className="min-h-10 cursor-pointer rounded-xl px-4 font-semibold text-gray-300 hover:bg-white/10"
					>
						Send another
					</button>
					<button type="button" onClick={onClose} className="ml-auto min-h-10 cursor-pointer rounded-xl bg-white px-5 font-semibold text-black hover:bg-gray-200">
						Done
					</button>
				</div>
			</div>
		)
	const box = (
		<textarea
			value={text}
			onChange={(e) => setText(e.target.value)}
			rows={style === "textFirst" ? 5 : 4}
			aria-label="Your message"
			placeholder={kind === "bug" ? "What happened, and where?" : "What would make GoodWatch better for you?"}
			className={`${INPUT} py-2.5`}
		/>
	)
	return (
		<div className="flex flex-col gap-4">
			{style === "tiles" && <KindTiles kind={kind} setKind={setKind} />}
			{style === "tabs" && <KindTabs kind={kind} setKind={setKind} />}
			{box}
			{style === "textFirst" && <KindTabs kind={kind} setKind={setKind} />}
			<div className="flex flex-col gap-3 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/10">
				<Switch on={shot} onChange={setShot} label="Include a screenshot" />
				{shot ? (
					<>
						<Snapshot />
						<p className="text-xs text-gray-500">This is what we get. What you type and other members' pictures are left out.</p>
					</>
				) : (
					<p className="text-xs text-gray-500">Helps us see what you see. Off unless you turn it on.</p>
				)}
			</div>
			<p className="text-xs text-gray-500">We also get the page address, your browser and the app version.</p>
			<PrimaryButton type="button" disabled={!text.trim()} onClick={() => setSent(true)}>
				Send
			</PrimaryButton>
		</div>
	)
}

export default function FeedbackTab() {
	const { variant } = useFeedback()
	const wide = useIsWide()
	const [open, setOpen] = useState(false)
	const [hint, setHint] = useState(true)
	const style = variant === "A" ? "tiles" : variant === "B" ? "textFirst" : "tabs"
	const form = <FeedbackForm key={variant} style={style} onClose={() => setOpen(false)} />
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

	// C: docked to the bottom edge (desktop), or to the right edge above the dock (phone).
	return (
		<div data-feedback-private>
			{wide ? (
				<div className={`fixed right-8 bottom-0 z-[46] w-[24rem] transition-transform duration-300 ease-out ${open ? "translate-y-0" : "translate-y-[calc(100%-2.5rem)]"}`}>
					<button
						type="button"
						onClick={() => setOpen((o) => !o)}
						aria-expanded={open}
						className="ml-auto flex h-10 cursor-pointer items-center gap-2 rounded-t-xl bg-gray-950 px-4 text-sm font-semibold text-gray-200 ring-1 ring-white/15 hover:text-white"
					>
						<ChatBubbleLeftEllipsisIcon className="size-4 text-amber-400" />
						Feedback
						<ChevronUpIcon className={`size-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
					</button>
					<div className="max-h-[70dvh] overflow-y-auto rounded-tl-2xl bg-gray-950 p-4 shadow-2xl ring-1 ring-white/15" aria-hidden={!open}>
						<KindHeader />
						{open ? form : <div className="h-64" />}
					</div>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="fixed right-0 bottom-[6.5rem] z-[46] flex cursor-pointer items-center gap-1.5 rounded-l-full bg-gray-950 py-2 pr-2 pl-3 text-xs font-semibold text-gray-200 shadow-xl ring-1 ring-white/15"
				>
					<ChatBubbleLeftEllipsisIcon className="size-4 text-amber-400" />
					Feedback
				</button>
			)}
			{phoneSheet}
		</div>
	)
}

function KindHeader() {
	return <p className="mb-3 text-sm text-gray-400">Found a bug or have an idea? One message is enough.</p>
}
