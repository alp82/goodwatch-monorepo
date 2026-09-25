// Sharing a new list. Share needs an account and a handle, because list links live at /u/:handle/lists/:id:
// 1. A guest is asked to sign up or sign in. The draft stays in this browser, and authentication returns to
//    /lists/new?share=1, which picks the flow up again.
// 2. A signed-in person without a handle claims one in a dialog, prefilled with a free suggestion.
// 3. The draft is saved as a list on the account, the link is copied, and the browser moves to the list's editor.
import { useQueryClient } from "@tanstack/react-query"
import { useLocation, useNavigate } from "@remix-run/react"
import { Link } from "@remix-run/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "react-toastify"
import { useClaimHandle } from "~/routes/api.handle"
import {
	fetchShareViewer,
	type ShareViewer,
	useCreateShareList,
} from "~/routes/api.share-lists"
import {
	shareListEditPath,
	shareListPath,
	publicOrigin,
} from "~/ui/share-card/links"
import {
	clearBrowserDraft,
	listInput,
	writeBrowserDraft,
} from "~/ui/share-list-editor/autosave"
import type { ListDraft } from "~/ui/share-list-editor/list-state"
import { sectionLabel } from "~/ui/share-list-editor/parts"
import type { ShareAction } from "~/ui/share-list-editor/ShareListEditor"
import { useHandleAvailability } from "~/ui/share-lists/useHandleAvailability"
import { HANDLE_MAX } from "~/utils/handles"

/** Where authentication returns to, so the flow continues with the saved draft. */
export const RESUME_SHARE_PATH = "/lists/new?share=1"

/** Passed to the list's editor after the first share, so it can confirm the link. */
export type SharedState = { shared: { url: string; copied: boolean } }

type Step =
	| { kind: "idle" }
	| { kind: "working" }
	| { kind: "account" }
	| { kind: "handle"; draft: ListDraft; suggestion: string }
	| { kind: "error"; message: string }

async function copy(url: string) {
	try {
		await navigator.clipboard.writeText(url)
		return true
	} catch {
		return false
	}
}

export function useShareFlow() {
	const [step, setStep] = useState<Step>({ kind: "idle" })
	const queryClient = useQueryClient()
	const create = useCreateShareList()
	const navigate = useNavigate()

	const publish = useCallback(
		async (draft: ListDraft, handle: string) => {
			setStep({ kind: "working" })
			try {
				// New lists sign with the handle unless the person typed a signature.
				const signature = draft.signature.trim() || `@${handle}`
				const list = await create.mutateAsync({
					...listInput({ ...draft, signature }),
					visibility: "public",
				})
				clearBrowserDraft()
				const url = `${publicOrigin()}${shareListPath(handle, list.id)}`
				const copied = await copy(url)
				setStep({ kind: "idle" })
				navigate(shareListEditPath(handle, list.id), {
					replace: true,
					state: { shared: { url, copied } } satisfies SharedState,
				})
			} catch (error) {
				setStep({
					kind: "error",
					message:
						error instanceof Error
							? error.message
							: "Sharing failed. Try again.",
				})
			}
		},
		[create, navigate],
	)

	const share: ShareAction = useCallback(
		async (draft) => {
			// Keep the latest draft even if the person leaves to sign up before autosave runs.
			writeBrowserDraft(draft)
			setStep({ kind: "working" })
			let viewer: ShareViewer
			try {
				viewer = await queryClient.fetchQuery({
					queryKey: ["share-viewer", draft.signature],
					queryFn: () => fetchShareViewer(draft.signature),
				})
			} catch (error) {
				setStep({
					kind: "error",
					message:
						error instanceof Error
							? error.message
							: "Sharing failed. Try again.",
				})
				return null
			}
			if (!viewer.signedIn) setStep({ kind: "account" })
			else if (!viewer.handle)
				setStep({
					kind: "handle",
					draft,
					suggestion: viewer.suggestedHandle ?? "",
				})
			else await publish(draft, viewer.handle)
			// The flow copies the link itself, after the list exists.
			return null
		},
		[publish, queryClient],
	)

	const close = () => setStep({ kind: "idle" })
	const dialogs =
		step.kind === "account" ? (
			<AccountDialog onClose={close} />
		) : step.kind === "handle" ? (
			<HandleDialog
				suggestion={step.suggestion}
				onClose={close}
				onClaimed={(handle) => publish(step.draft, handle)}
			/>
		) : step.kind === "working" ? (
			<DialogShell label="Sharing" onClose={() => {}}>
				<p className="text-center text-neutral-300" aria-live="polite">
					Saving your list…
				</p>
			</DialogShell>
		) : step.kind === "error" ? (
			<DialogShell label="Sharing failed" onClose={close}>
				<p className="text-red-300" role="alert">
					{step.message}
				</p>
				<button
					type="button"
					onClick={close}
					className="rounded-full bg-white py-2.5 font-black text-black"
				>
					OK
				</button>
			</DialogShell>
		) : null

	return { share, dialogs }
}

/** A bottom sheet on phones, a centered dialog on larger screens. Sits above the mobile bottom nav. */
export function DialogShell({
	label,
	onClose,
	children,
}: { label: string; onClose: () => void; children: React.ReactNode }) {
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])
	return (
		<div
			className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
			onClick={onClose}
		>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={label}
				className="flex w-full max-w-md flex-col gap-4 rounded-t-[28px] bg-neutral-900 p-6 pb-10 text-white shadow-2xl ring-1 ring-white/10 sm:rounded-[28px] sm:pb-6"
				onClick={(e) => e.stopPropagation()}
			>
				{children}
			</div>
		</div>
	)
}

function AccountDialog({ onClose }: { onClose: () => void }) {
	const returnTo = encodeURIComponent(RESUME_SHARE_PATH)
	return (
		<DialogShell label="Create an account to share" onClose={onClose}>
			<h2 className="text-2xl font-black">Share your list</h2>
			<p className="text-neutral-300">
				Sharing needs a free account. Your list is saved in this browser, and
				after you sign up it's saved to your account and the link is copied.
			</p>
			<Link
				to={`/sign-up?redirectTo=${returnTo}`}
				className="rounded-full bg-white py-2.5 text-center font-black text-black"
			>
				Sign up
			</Link>
			<p className="text-center text-sm text-neutral-400">
				Already have an account?{" "}
				<Link
					to={`/sign-in?redirectTo=${returnTo}`}
					className="font-semibold text-white underline underline-offset-4"
				>
					Sign in
				</Link>
			</p>
		</DialogShell>
	)
}

function HandleDialog({
	suggestion,
	onClose,
	onClaimed,
}: {
	suggestion: string
	onClose: () => void
	onClaimed: (handle: string) => void
}) {
	const [input, setInput] = useState(suggestion)
	const status = useHandleAvailability(input)
	const claim = useClaimHandle()
	const canClaim =
		!!status.handle && !status.problem && status.available && !claim.isPending

	let message: string | null = null
	let tone: "ok" | "error" | "muted" = "muted"
	if (status.problem) [message, tone] = [status.problem, "error"]
	else if (!status.handle) message = null
	else if (status.checking) message = "Checking…"
	else if (status.checkFailed)
		[message, tone] = ["Couldn't check that handle. Try again.", "error"]
	else if (status.unavailable)
		[message, tone] = [status.unavailableReason, "error"]
	else if (status.available)
		[message, tone] = [`@${status.handle} is available.`, "ok"]
	if (claim.isError) [message, tone] = [claim.error.message, "error"]

	return (
		<DialogShell label="Choose a handle" onClose={onClose}>
			<form
				className="flex flex-col gap-4"
				onSubmit={(e) => {
					e.preventDefault()
					if (!canClaim) return
					claim.mutate(
						{ handle: status.handle, displayName: null },
						{ onSuccess: (profile) => onClaimed(profile.handle) },
					)
				}}
			>
				<h2 className="text-2xl font-black">Choose your handle</h2>
				<p className="text-neutral-300">
					Your lists live on your public profile. You can change the handle
					later in settings.
				</p>
				<div className="flex flex-col gap-1.5">
					<label htmlFor="share-handle" className={sectionLabel}>
						Handle
					</label>
					<div className="flex items-center rounded-full bg-white/10 px-4 focus-within:ring-2 focus-within:ring-white">
						<span className="text-neutral-400" aria-hidden>
							@
						</span>
						<input
							id="share-handle"
							autoFocus
							value={input}
							onChange={(e) =>
								setInput(e.target.value.replace(/\s/g, "").toLowerCase())
							}
							maxLength={HANDLE_MAX + 1}
							autoComplete="off"
							autoCapitalize="none"
							spellCheck={false}
							placeholder="your_handle"
							aria-describedby="share-handle-status"
							aria-invalid={tone === "error"}
							className="w-full min-w-0 border-0 bg-transparent py-2.5 pl-1 text-white outline-none placeholder:text-neutral-500 focus:ring-0 focus:outline-none"
						/>
					</div>
					<p
						id="share-handle-status"
						aria-live="polite"
						className={`min-h-5 text-sm ${tone === "ok" ? "text-emerald-400" : tone === "error" ? "text-red-400" : "text-neutral-400"}`}
					>
						{message}
					</p>
					<p className="text-sm text-neutral-500">
						goodwatch.app/u/
						<span className="text-neutral-300">
							{status.handle || "your_handle"}
						</span>
					</p>
				</div>
				<button
					type="submit"
					disabled={!canClaim}
					className="rounded-full bg-white py-2.5 font-black text-black disabled:opacity-40"
				>
					{claim.isPending ? "Saving…" : "Share"}
				</button>
			</form>
		</DialogShell>
	)
}

/**
 * Confirms the first share on the list's editor. A copied link gets a short confirmation; when the browser didn't
 * allow copying (no click came before it, for example after returning from sign-up), the link is shown to copy.
 */
export function SharedNotice() {
	const location = useLocation()
	const shared = (location.state as SharedState | null)?.shared
	const [manual, setManual] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)
	const handled = useRef(false)
	const navigate = useNavigate()

	useEffect(() => {
		if (!shared || handled.current) return
		handled.current = true
		if (shared.copied) toast.success("Your list is live. The link is copied.")
		else setManual(shared.url)
		// Drop the state so a reload doesn't confirm again.
		navigate(`${location.pathname}${location.search}`, {
			replace: true,
			state: null,
		})
	}, [shared, navigate, location.pathname, location.search])

	if (!manual) return null
	const close = () => setManual(null)
	return (
		<DialogShell label="Your list is live" onClose={close}>
			<h2 className="text-2xl font-black">Your list is live</h2>
			<p className="text-neutral-300">
				Copy the link and share it anywhere. The card is its preview image.
			</p>
			<input
				readOnly
				value={manual}
				onFocus={(e) => e.currentTarget.select()}
				aria-label="List link"
				className="w-full rounded-full border-0 bg-white/10 px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-white"
			/>
			<button
				type="button"
				onClick={async () => {
					if (await copy(manual)) {
						setCopied(true)
						setTimeout(close, 900)
					}
				}}
				className="rounded-full bg-white py-2.5 font-black text-black"
			>
				{copied ? "Link copied ✓" : "Copy link"}
			</button>
		</DialogShell>
	)
}
