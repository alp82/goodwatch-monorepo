// Shared parts of the Feedback drawer: the input style, a guest's email field, the chips, the context a picked part's
// questions talk to the drawer through, sending with retries that keep their key, and the thanks screen with Undo.
import {
	ArrowUturnLeftIcon,
	CheckCircleIcon,
	ClockIcon,
	FlagIcon,
} from "@heroicons/react/20/solid"
import { Link, useMatches, useRevalidator } from "@remix-run/react"
import { useQueryClient } from "@tanstack/react-query"
import {
	type ReactNode,
	createContext,
	useContext,
	useRef,
	useState,
} from "react"
import { holdBeforeSend, newIdempotencyKey } from "~/ui/support/contact"
import { clearLoaderCache } from "~/navigation/instant-navigation"
import {
	FeedbackError,
	type FeedbackOutcome,
	type FeedbackRequest,
	type FeedbackResponse,
	submitFeedback,
	undoCorrection,
} from "~/utils/feedback"
import {
	type Envelope,
	FAILURE_COPY,
	OUTCOME_COPY,
	type SendFailure,
	sendFailure,
} from "./request"

export const INPUT =
	"min-h-11 w-full rounded-lg bg-gray-900 px-3 text-gray-100 ring-1 ring-white/15 placeholder:text-gray-600 focus:ring-2 focus:ring-amber-400 focus:outline-none"
export const LABEL =
	"mb-2 block text-[11px] font-semibold uppercase tracking-[.12em] text-gray-500"

/**
 * What a picked part's questions tell the drawer: a report went out (fix mode's page layer goes, the thanks stay), the
 * person reports something else (it comes back), or Done (the drawer closes). Also the page spots a chip points at.
 */
export type FixFlow = {
	guest: boolean
	sent: () => void
	again: () => void
	done: () => void
	/** The page part a hovered or focused chip stands for ("provider:8"). */
	setSpot: (spot: string | null) => void
	/** The page part the picked answers point at. */
	setPinned: (spot: string | null) => void
}
export const FixFlowContext = createContext<FixFlow | null>(null)
export const useFixFlow = () => useContext(FixFlowContext)

/** Guests only: members get answers at their account's email. Optional. */
export function GuestEmail({
	value,
	onChange,
	invalid = false,
}: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
	return (
		<label className="flex flex-col gap-1.5" data-guest-email>
			<span className="text-sm font-medium text-gray-300">
				Your email{" "}
				<span className="font-normal text-gray-500">
					(if you want an answer)
				</span>
			</span>
			<input
				type="email"
				maxLength={254}
				inputMode="email"
				autoComplete="email"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="you@example.com"
				aria-invalid={invalid || undefined}
				className={INPUT}
			/>
			{invalid && (
				<span className="text-xs text-amber-300">
					That doesn't look like an email address.
				</span>
			)}
		</label>
	)
}

/** The "it's with us" line after sending, for who sent it and how. */
export const thanksLine = (guest: boolean, email: string) =>
	guest
		? email.trim()
			? `We'll answer at ${email.trim()}.`
			: "We read every message."
		: "If we have a question, we'll email you."

/** A chip. `spot` names the page part it stands for, which lights up while the chip is hovered or focused. */
export function Chip({
	on,
	onClick,
	children,
	className = "",
	spot,
}: {
	on: boolean
	onClick: () => void
	children: ReactNode
	className?: string
	spot?: string
}) {
	const flow = useFixFlow()
	const point =
		spot && flow
			? {
					onPointerEnter: () => flow.setSpot(spot),
					onPointerLeave: () => flow.setSpot(null),
					onFocus: () => flow.setSpot(spot),
					onBlur: () => flow.setSpot(null),
				}
			: {}
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			{...point}
			className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${on ? "bg-white font-semibold text-black" : "bg-white/8 text-gray-200 hover:bg-white/15"} ${className}`}
		>
			{children}
		</button>
	)
}

/** The client does not know who is trusted; the server decides whether a fix goes live. */
export function BeforeSendLine({ kind }: { kind: "fix" | "flag" }) {
	return kind === "fix" ? (
		<p className="flex items-center gap-1.5 text-xs text-gray-400">
			<ClockIcon className="size-4" aria-hidden /> Fixes may go live now or wait
			for staff review
		</p>
	) : (
		<p className="flex items-center gap-1.5 text-xs text-gray-400">
			<FlagIcon className="size-4" aria-hidden /> We look into it. This part
			isn't edited by hand.
		</p>
	)
}

/** The sticky row at the drawer's bottom with Send. */
export function SendFooter({ children }: { children: ReactNode }) {
	return (
		<div className="sticky -bottom-4 -mx-4 mt-1 border-t border-white/10 bg-gray-950 px-4 pt-3 pb-5 sm:-mx-5 sm:px-5">
			{children}
		</div>
	)
}

export function FailureLine({ failure }: { failure: SendFailure | null }) {
	return (
		<p
			role="alert"
			className={failure ? "mb-2 text-sm text-amber-300" : "sr-only"}
		>
			{failure ? FAILURE_COPY[failure] : ""}
		</p>
	)
}

/** Where the report came from: the page, the screen, the language. No form contents. */
function useMetadata(): () => FeedbackRequest["metadata"] {
	const matches = useMatches()
	const routeId = matches[matches.length - 1]?.id
	return () => ({
		url: `${window.location.pathname}${window.location.search}`.slice(0, 4000),
		...(routeId ? { routeId: routeId.slice(0, 200) } : {}),
		viewport: {
			width: Math.min(20000, Math.max(1, Math.round(window.innerWidth))),
			height: Math.min(20000, Math.max(1, Math.round(window.innerHeight))),
		},
		dpr: Math.min(10, window.devicePixelRatio || 1),
		locale: navigator.language.slice(0, 50),
		colorScheme: "dark",
		time: new Date().toISOString(),
	})
}

/**
 * Sends one report. The form's opening time is `startedAt`; an unchanged retry keeps its idempotency key, a changed
 * report gets a new one. Waits out the endpoint's minimum fill time.
 */
export function useSender() {
	const refresh = useRefreshCorrections()
	const startedAt = useRef(Date.now())
	const key = useRef<string | null>(null)
	const last = useRef("")
	const [sending, setSending] = useState(false)
	const [failure, setFailure] = useState<SendFailure | null>(null)
	const metadata = useMetadata()
	const send = async (
		build: (envelope: Envelope) => FeedbackRequest,
		email?: string,
	): Promise<FeedbackResponse | null> => {
		if (sending) return null
		const now = Date.now()
		if (now - startedAt.current > 86_400_000) startedAt.current = now
		const envelope = (k: string): Envelope => ({
			idempotencyKey: k,
			startedAt: startedAt.current,
			email,
			metadata: metadata(),
		})
		const signature = JSON.stringify({ ...build(envelope("")), metadata: 0 })
		if (signature !== last.current) key.current = null
		last.current = signature
		key.current ??= newIdempotencyKey(window.crypto)
		setSending(true)
		setFailure(null)
		try {
			await new Promise((r) =>
				setTimeout(r, holdBeforeSend(startedAt.current, Date.now())),
			)
			const response = await submitFeedback(build(envelope(key.current)))
			if (response.outcome === "live") refresh()
			key.current = null
			last.current = ""
			startedAt.current = Date.now()
			return response
		} catch (error) {
			setFailure(sendFailure(error instanceof FeedbackError ? error.status : 0))
			return null
		} finally {
			setSending(false)
		}
	}
	const reset = () => {
		startedAt.current = Date.now()
		setFailure(null)
	}
	return { send, sending, failure, reset }
}

/** Fetch mutations do not trigger Remix's loader revalidation automatically. */
function useRefreshCorrections() {
	const revalidator = useRevalidator()
	const queryClient = useQueryClient()
	return () => {
		clearLoaderCache()
		revalidator.revalidate()
		void queryClient.invalidateQueries({ queryKey: ["episode-grid"] })
		void queryClient.invalidateQueries({ queryKey: ["show-tracking"] })
	}
}

/** The thanks after a report; members can undo their live or pending corrections here. */
export function Result({
	outcome,
	correctionId,
	before,
	after,
	email = "",
	thanks = "always",
	onAnother,
	onDone,
}: {
	outcome: FeedbackOutcome
	correctionId: string | null
	/** What the page showed and what the member suggested, for a fix. */
	before?: string
	after?: string
	email?: string
	/** When the "we'll answer" line shows: always, or only for a guest who left an email. */
	thanks?: "always" | "email"
	onAnother: () => void
	onDone: () => void
}) {
	const flow = useFixFlow()
	const guest = flow?.guest ?? false
	const refresh = useRefreshCorrections()
	const [undo, setUndo] = useState<"idle" | "busy" | "done" | "failed">("idle")
	const undone = undo === "done"
	const copy = OUTCOME_COPY[outcome]
	const canUndo = !guest && outcome !== "flag" && correctionId && !undone
	return (
		<div className="flex flex-col gap-4 py-1" data-feedback-result={outcome}>
			<div className="flex items-start gap-3">
				<span
					className={`grid size-10 shrink-0 place-items-center rounded-full ${outcome === "live" ? "bg-emerald-500/15 text-emerald-300" : outcome === "pending" ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-gray-200"}`}
				>
					{outcome === "live" ? (
						<CheckCircleIcon className="size-6" aria-hidden />
					) : outcome === "pending" ? (
						<ClockIcon className="size-6" aria-hidden />
					) : (
						<FlagIcon className="size-5" aria-hidden />
					)}
				</span>
				<div aria-live="polite">
					<p className="text-lg font-semibold text-white">
						{undone ? "Undone" : copy.title}
					</p>
					<p className="mt-0.5 text-sm text-gray-400">
						{undone
							? outcome === "pending"
								? "Your suggested change was withdrawn."
								: "The page shows the old value again soon."
							: copy.body}{" "}
						{!undone &&
							(thanks === "always" || (guest && email.trim())) &&
							thanksLine(guest, email)}
					</p>
				</div>
			</div>
			{outcome !== "flag" && before && after && (
				<div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl bg-white/[0.04] p-3 text-sm ring-1 ring-white/10">
					<span className="text-gray-500">Was</span>
					<span className="min-w-0 break-words text-gray-400 line-through decoration-gray-600">
						{before}
					</span>
					<span className="text-gray-500">Now</span>
					<span className="min-w-0 break-words font-medium text-gray-100">
						{after}
					</span>
				</div>
			)}
			{guest && outcome === "pending" && (
				<p className="text-sm text-gray-400">
					Signed-in members see their changes go live once we know them.{" "}
					<Link
						to="/sign-up"
						className="font-semibold text-amber-500 hover:text-amber-400"
					>
						Sign up
					</Link>
				</p>
			)}
			{undo === "failed" && (
				<p role="alert" className="text-sm text-amber-300">
					Undo didn't go through. Try again.
				</p>
			)}
			<div className="flex flex-wrap gap-2">
				{canUndo && (
					<button
						type="button"
						disabled={undo === "busy"}
						onClick={async () => {
							setUndo("busy")
							try {
								await undoCorrection(correctionId)
								refresh()
								setUndo("done")
							} catch {
								setUndo("failed")
							}
						}}
						className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-4 font-semibold text-gray-100 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
					>
						<ArrowUturnLeftIcon className="size-4" aria-hidden /> Undo
					</button>
				)}
				<button
					type="button"
					onClick={onAnother}
					className="min-h-10 cursor-pointer rounded-xl px-4 font-semibold text-gray-300 hover:bg-white/10"
				>
					Report something else
				</button>
				<button
					type="button"
					onClick={onDone}
					className="ml-auto min-h-10 cursor-pointer rounded-xl bg-white px-5 font-semibold text-black hover:bg-gray-200"
				>
					Done
				</button>
			</div>
		</div>
	)
}

/** One part of the page, listed while fix mode is on. */
export type FixArea = { id: string; label: string; flagOnly: boolean }

/** The page's fix mode, when the page shows parts to fix or flag. */
export type FixPath = {
	on: boolean
	setOn: (on: boolean) => void
	/** The picked part's title ("Fix where to watch") and its questions; null while nothing is picked. */
	picked: { id: string; title: string; flow: ReactNode } | null
	/** A report was sent: the page layer (scrim, outlines, badges) goes while the drawer thanks. */
	done: boolean
	setDone: (done: boolean) => void
	/** The part's element on the page (phones scroll to it). */
	element: (id: string) => HTMLElement | null
	closePicked: () => void
	/** The parts, in page order; the drawer lists them so a part can be picked from the page or the list. */
	areas: FixArea[]
	/** The part under the pointer or focus, on either side; both light up. */
	hot: string | null
	setHot: (id: string | null) => void
	pick: (id: string) => void
	/** Scrolls the part into view when it's off screen. */
	reveal: (id: string) => void
}
