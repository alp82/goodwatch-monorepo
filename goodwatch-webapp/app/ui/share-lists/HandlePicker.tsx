// The one place a person chooses their handle: the onboarding step, the share flow, and profile settings all use it.
// A handle is permanent, so the form says so before anyone claims one.
import { useQueryClient } from "@tanstack/react-query"
import { useId, useState } from "react"
import { useClaimHandle } from "~/routes/api.handle"
import { shareViewerQueryKey } from "~/routes/api.share-lists"
import { useHandleAvailability } from "~/ui/share-lists/useHandleAvailability"
import { HANDLE_MAX, HANDLE_MIN } from "~/utils/handles"

export function HandlePicker({
	suggestion = "",
	submitLabel = "Claim handle",
	autoFocus = false,
	id: givenId,
	onClaimed,
}: {
	suggestion?: string
	submitLabel?: string
	autoFocus?: boolean
	id?: string
	onClaimed: (handle: string) => void
}) {
	// Unique per mount unless given: the onboarding banner renders its content twice (desktop and phone drawer).
	const autoId = useId()
	const id = givenId ?? `handle${autoId.replace(/:/g, "")}`
	const [input, setInput] = useState(suggestion)
	const status = useHandleAvailability(input)
	const claim = useClaimHandle()
	const queryClient = useQueryClient()
	const canClaim = !!status.handle && !status.problem && status.available && !claim.isPending

	let message: string | null = null
	let tone: "ok" | "error" | "muted" = "muted"
	if (status.problem) [message, tone] = [status.problem, "error"]
	else if (!status.handle) message = null
	else if (status.checking) message = "Checking…"
	else if (status.checkFailed) [message, tone] = ["Couldn't check that handle. Try again.", "error"]
	else if (status.unavailable) [message, tone] = [status.unavailableReason, "error"]
	else if (status.available) [message, tone] = [`@${status.handle} is available.`, "ok"]
	if (claim.isError) [message, tone] = [claim.error.message, "error"]

	return (
		<form
			className="flex w-full flex-col gap-3"
			onSubmit={(e) => {
				e.preventDefault()
				if (!canClaim) return
				claim.mutate(
					{ handle: status.handle },
					{
						onSuccess: (profile) => {
							queryClient.invalidateQueries({ queryKey: shareViewerQueryKey })
							onClaimed(profile.handle)
						},
					},
				)
			}}
		>
			<div className="flex flex-col gap-1.5">
				<label htmlFor={`${id}-input`} className="text-xs font-bold tracking-[0.2em] text-neutral-400 uppercase">
					Handle
				</label>
				<div className="flex items-center rounded-full bg-white/10 px-4 focus-within:ring-2 focus-within:ring-white">
					<span className="text-neutral-400" aria-hidden>
						@
					</span>
					<input
						id={`${id}-input`}
						autoFocus={autoFocus}
						value={input}
						onChange={(e) => setInput(e.target.value.replace(/\s/g, "").toLowerCase())}
						maxLength={HANDLE_MAX + 1}
						autoComplete="off"
						autoCapitalize="none"
						spellCheck={false}
						placeholder="your_handle"
						aria-describedby={`${id}-status ${id}-help`}
						aria-invalid={tone === "error"}
						className="w-full min-w-0 border-0 bg-transparent py-2.5 pl-1 text-white outline-none placeholder:text-neutral-500 focus:ring-0 focus:outline-none"
					/>
				</div>
				<p
					id={`${id}-status`}
					aria-live="polite"
					className={`min-h-5 text-sm ${tone === "ok" ? "text-emerald-400" : tone === "error" ? "text-red-400" : "text-neutral-400"}`}
				>
					{message}
				</p>
				<p id={`${id}-help`} className="text-sm text-neutral-400">
					goodwatch.app/u/<span className="text-neutral-200">{status.handle || "your_handle"}</span> · {HANDLE_MIN} to{" "}
					{HANDLE_MAX} lowercase letters, digits, and underscores, starting with a letter. Your handle signs every
					list you share, and you can't change it later.
				</p>
			</div>
			<button
				type="submit"
				disabled={!canClaim}
				className="rounded-full bg-white px-6 py-2.5 font-black text-black transition hover:bg-neutral-200 disabled:opacity-40"
			>
				{claim.isPending ? "Saving…" : submitLabel}
			</button>
		</form>
	)
}
