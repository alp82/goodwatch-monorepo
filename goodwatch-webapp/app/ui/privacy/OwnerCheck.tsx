import type { ReactNode } from "react"

// A statement in the privacy policy the owner has to confirm, word or decide before REC_CONNECTOR goes on (#571).
// Visible on purpose: a policy with an open check must not go out unnoticed. Remove each one once it is settled.
export function OwnerCheck({ children }: { children: ReactNode }) {
	return (
		<span
			data-owner-check
			className="my-2 block rounded-lg border border-dashed border-fuchsia-500/70 bg-fuchsia-950/40 px-3 py-2 text-sm leading-relaxed text-fuchsia-100"
		>
			<span className="font-bold text-fuchsia-300">Owner to confirm: </span>
			{children}
		</span>
	)
}
