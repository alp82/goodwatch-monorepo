// PROTOTYPE - throwaway. The one feedback entry point (round 2, variant C): a quiet "Feedback" tab on the right edge of
// every page that opens the docked panel (a bottom sheet on phones). The panel offers two paths:
// - "Fix something on this page" on pages with correctable data: the page's fix mode marks every block with a dashed
//   outline and a Fix/Flag badge; the panel shows a short hint and Exit, and the picked block's questions.
// - "Send feedback": one text box, bug or idea, and "Include a screenshot" (off by default) with a preview of what
//   gets sent. Nothing is sent.
// Pages without correctable data go straight to Send feedback. Contact stays on /support.
// The root layout mounts it on every page in development; the feedback prototype mounts its own with the fix path.
// It imports no fixtures, so it can live in the root layout.
import { ArrowLeftIcon, BugAntIcon, ChatBubbleLeftEllipsisIcon, CheckCircleIcon, ChevronRightIcon, LightBulbIcon, PencilSquareIcon } from "@heroicons/react/20/solid"
import { XMarkIcon } from "@heroicons/react/24/solid"
import { Link, useMatches } from "@remix-run/react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { PrimaryButton } from "~/ui/auth/kit"
import { useUser } from "~/utils/auth"

export const INPUT =
	"min-h-11 w-full rounded-lg bg-gray-900 px-3 text-gray-100 ring-1 ring-white/15 placeholder:text-gray-600 focus:ring-2 focus:ring-amber-400 focus:outline-none"

type Kind = "bug" | "idea"

function useIsWide() {
	const [wide, setWide] = useState(false)
	useEffect(() => {
		const m = window.matchMedia("(min-width: 768px)")
		const on = () => setWide(m.matches)
		on()
		m.addEventListener("change", on)
		return () => m.removeEventListener("change", on)
	}, [])
	return wide
}

/** A scaled copy of what's on screen now, without the feedback panel, the switcher, form fields or avatars. */
function Snapshot() {
	const box = useRef<HTMLDivElement>(null)
	const [ratio, setRatio] = useState(0.5625)
	useEffect(() => {
		const host = box.current
		const page = document.querySelector<HTMLElement>("[data-feedback-page]") ?? document.querySelector<HTMLElement>("main") ?? document.body
		if (!host || !page) return
		const w = window.innerWidth
		const h = window.innerHeight
		setRatio(h / w)
		const clone = page.cloneNode(true) as HTMLElement
		for (const el of clone.querySelectorAll("[data-feedback-private], .search-private, [data-member-avatar], script")) el.remove()
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

export function FeedbackForm({ style, onClose, guest }: { style: "tiles" | "textFirst" | "tabs"; onClose: () => void; guest: boolean }) {
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
							We read every message. {guest ? "Want an answer? Use the contact form on Support." : "If we have a question, we'll email you."}
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

// --- The tab ---

/** Hidden while the page scrolls down on phones, back on the first scroll up (transform only). */
function useHideOnScrollDown(active: boolean) {
	const [hidden, setHidden] = useState(false)
	useEffect(() => {
		if (!active) {
			setHidden(false)
			return
		}
		let last = window.scrollY
		let frame = 0
		const onScroll = () => {
			if (frame) return
			frame = requestAnimationFrame(() => {
				frame = 0
				const y = window.scrollY
				if (Math.abs(y - last) < 8) return
				setHidden(y > last && y > 80)
				last = y
			})
		}
		window.addEventListener("scroll", onScroll, { passive: true })
		return () => {
			window.removeEventListener("scroll", onScroll)
			cancelAnimationFrame(frame)
		}
	}, [active])
	return hidden
}

/**
 * Desktop: a vertical "Feedback" label on the right edge, in the lower third. Phones: the icon alone, above the dock.
 * The placement is `?tab=2` aware: 2 puts it at the bottom right corner as a small round key instead (comparison).
 */
function Tab({ open, onOpen, wide, alt }: { open: boolean; onOpen: () => void; wide: boolean; alt: boolean }) {
	const hidden = useHideOnScrollDown(!wide)
	const away = open || hidden
	if (alt)
		return (
			<button
				type="button"
				onClick={onOpen}
				aria-expanded={open}
				aria-label="Feedback"
				data-feedback-private
				data-feedback-tab
				className={`fixed right-3 z-[45] grid size-10 cursor-pointer place-items-center rounded-full bg-gray-950 text-gray-300 shadow-lg ring-1 ring-white/15 transition-[transform,opacity] duration-200 hover:text-white bottom-[calc(var(--nav-dock-height,72px)+0.75rem)] lg:right-5 lg:bottom-5 ${away ? "pointer-events-none translate-y-3 opacity-0" : ""}`}
			>
				<ChatBubbleLeftEllipsisIcon className="size-5" />
			</button>
		)
	return (
		<button
			type="button"
			onClick={onOpen}
			aria-expanded={open}
			aria-label="Feedback"
			data-feedback-private
			data-feedback-tab
			className={`group fixed right-0 z-[45] flex cursor-pointer flex-col items-center gap-1.5 rounded-l-lg bg-gray-950/95 text-gray-300 shadow-lg ring-1 ring-white/15 transition-transform duration-200 ease-out hover:text-white max-md:bottom-[calc(var(--nav-dock-height,72px)+6.5rem)] max-md:h-11 max-md:w-7 max-md:justify-center md:top-[62%] md:px-1.5 md:py-2.5 ${away ? "translate-x-full" : ""}`}
		>
			<ChatBubbleLeftEllipsisIcon className="size-4 shrink-0 text-amber-400/90 group-hover:text-amber-400" aria-hidden />
			{wide && <span className="rotate-180 text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl]">Feedback</span>}
		</button>
	)
}

// --- The panel ---

/** The page's fix mode, when the page has correctable data. */
export type FixPath = {
	on: boolean
	setOn: (on: boolean) => void
	/** Trusted members' fixes go live at once; everyone else's are checked first. */
	trusted: boolean
	/** The picked block's title ("Fix where to watch") and its questions; null while nothing is picked. */
	picked: { title: string; flow: ReactNode } | null
	closePicked: () => void
}

type Mode = "choose" | "fix" | "send"

function Choice({ icon, title, body, onClick }: { icon: ReactNode; title: string; body: string; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-white/[0.04] p-3 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.07] hover:ring-white/25"
		>
			<span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/10 text-amber-400">{icon}</span>
			<span className="min-w-0 flex-1">
				<span className="block font-semibold text-gray-100">{title}</span>
				<span className="block text-sm text-gray-400">{body}</span>
			</span>
			<ChevronRightIcon className="size-5 shrink-0 text-gray-500" aria-hidden />
		</button>
	)
}

const ContactLine = () => (
	<p className="text-xs text-gray-500">
		Need an answer from us?{" "}
		<Link to="/support" className="font-semibold text-gray-300 underline decoration-white/30 underline-offset-2 hover:text-white">
			Contact us on Support
		</Link>
	</p>
)

export function FeedbackDock({ fix, guest, startWith }: { fix?: FixPath; guest: boolean; startWith?: "send" }) {
	const wide = useIsWide()
	const [open, setOpen] = useState(startWith === "send")
	const [mode, setMode] = useState<Mode>(startWith ?? (fix ? "choose" : "send"))
	const [alt, setAlt] = useState(false)
	useEffect(() => setAlt(new URLSearchParams(window.location.search).get("tab") === "2"), [])
	// A page without the fix path (or one that lost it) only sends feedback.
	const current: Mode = fix ? mode : "send"
	const fixing = current === "fix" && Boolean(fix?.on)

	const close = () => {
		setOpen(false)
		fix?.closePicked()
		fix?.setOn(false)
		setMode(fix ? "choose" : "send")
	}
	const back = () => {
		if (fix?.picked) return fix.closePicked()
		fix?.setOn(false)
		setMode("choose")
	}
	useEffect(() => {
		if (!open) return
		const esc = (e: KeyboardEvent) => e.key === "Escape" && close()
		window.addEventListener("keydown", esc)
		return () => window.removeEventListener("keydown", esc)
	})

	const title = fix?.picked && fixing ? fix.picked.title : current === "fix" ? "Fix something" : current === "send" ? "Send feedback" : "Feedback"
	const canGoBack = Boolean(fix) && current !== "choose"

	let body: ReactNode = null
	if (current === "choose" && fix)
		body = (
			<div className="flex flex-col gap-2.5">
				<Choice
					icon={<PencilSquareIcon className="size-5" />}
					title="Fix something on this page"
					body={fix.trusted ? "Your fixes go live at once." : "A wrong service, cast or date. We check fixes first."}
					onClick={() => {
						fix.setOn(true)
						setMode("fix")
					}}
				/>
				<Choice icon={<ChatBubbleLeftEllipsisIcon className="size-5" />} title="Send feedback" body="A bug or an idea, in your words." onClick={() => setMode("send")} />
				<div className="mt-2">
					<ContactLine />
				</div>
			</div>
		)
	else if (fixing && fix?.picked) body = fix.picked.flow
	else if (fixing)
		body = (
			<div className="flex flex-col gap-3 pb-1">
				<p className="flex items-start gap-2.5 text-sm text-gray-200">
					<PencilSquareIcon className="mt-0.5 size-5 shrink-0 text-amber-400" aria-hidden />
					<span>
						Tap a dashed outline to fix it.{" "}
						<span className="text-gray-400">{fix?.trusted ? "Your fixes go live at once." : "We check fixes before they show."}</span>
					</span>
				</p>
				<button
					type="button"
					onClick={close}
					className="min-h-10 cursor-pointer self-end rounded-xl bg-white px-5 font-semibold text-black hover:bg-gray-200"
				>
					Exit
				</button>
			</div>
		)
	else
		body = (
			<div className="flex flex-col gap-4">
				<p className="text-sm text-gray-400">Found a bug or have an idea? One message is enough.</p>
				<FeedbackForm style="tabs" guest={guest} onClose={close} />
				<ContactLine />
			</div>
		)

	return (
		<>
			<Tab open={open} wide={wide} alt={alt} onOpen={() => setOpen(true)} />
			<aside
				aria-hidden={!open}
				aria-label="Feedback"
				data-feedback-private
				data-feedback-panel
				{...(!open && { inert: "" })}
				className={`fixed inset-x-0 bottom-0 z-[1001] flex max-h-[80dvh] flex-col overflow-hidden rounded-t-[28px] bg-gray-950 shadow-[0_-20px_60px_-10px_rgba(0,0,0,.8)] ring-1 ring-amber-500/30 transition-[transform,opacity] duration-300 ease-out will-change-transform md:inset-x-auto md:top-auto md:right-4 md:bottom-6 md:max-h-[calc(100dvh-8rem)] md:w-[24rem] md:rounded-2xl ${open ? "translate-y-0 opacity-100 md:translate-x-0" : "pointer-events-none translate-y-full opacity-0 md:translate-y-0 md:translate-x-[110%]"}`}
			>
				<div className="shrink-0">
					<div className="flex justify-center pt-2.5 pb-1 md:hidden">
						<span className="h-1.5 w-10 rounded-full bg-white/25" />
					</div>
					<div className="flex items-center gap-1 px-4 pt-1 pb-3 sm:px-5 md:pt-4">
						{canGoBack && (
							<button type="button" onClick={back} aria-label="Back" className="-ml-1.5 cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10">
								<ArrowLeftIcon className="size-5" />
							</button>
						)}
						<h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-white">{title}</h2>
						<button type="button" onClick={close} aria-label="Close" className="cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10">
							<XMarkIcon className="size-5" />
						</button>
					</div>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">{open && body}</div>
			</aside>
		</>
	)
}

/** The root layout's tab: every page but the feedback prototype, which mounts its own with the fix path. */
export function RootFeedbackDock() {
	const { user } = useUser()
	const own = useMatches().some((m) => m.id === "routes/prototype.feedback")
	if (own) return null
	return <FeedbackDock guest={!user} />
}
