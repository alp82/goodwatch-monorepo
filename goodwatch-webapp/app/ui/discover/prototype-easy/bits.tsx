// PROTOTYPE (discover-easy): small pieces the round 3 easy variants share.
import { XMarkIcon } from "@heroicons/react/20/solid"
import { useState } from "react"
import type { BarChip } from "~/ui/discover-bar/chips"
import { getFingerprintMeta } from "~/ui/fingerprint/fingerprintMeta"
import type { EasyContext } from "./kit"
import type { EasyApi } from "~/ui/discover-bar/DiscoverControls"

export type Easy = EasyContext & EasyApi

export const filtersOf = (e: Easy) => e.chips.filter((c) => c.kind !== "query")
export const wantsOf = (e: Easy) =>
	(e.reading ?? []).filter((t) => t.kind === "want" && t.key).map((t) => getFingerprintMeta(t.key!))
export const EXAMPLES = ["funny 90s movies on netflix", "a cozy mystery", "like Severance but lighter"]

/** A word in a sentence that opens a tiny menu: Remove, or Change (in Advanced). */
export function Token({ chip, e, children }: { chip: BarChip; e: Easy; children?: React.ReactNode }) {
	const [open, setOpen] = useState(false)
	return (
		<span
			className="relative inline-block"
			onBlur={(ev) => !ev.currentTarget.contains(ev.relatedTarget as Node) && setOpen(false)}
		>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className="cursor-pointer font-semibold text-white underline decoration-white/25 decoration-dotted underline-offset-[5px] hover:decoration-amber-400"
			>
				{children ?? chip.label}
			</button>
			{open && (
				<span className="absolute top-full left-0 z-30 mt-1 flex w-max flex-col rounded-xl bg-gray-800 p-1 text-sm shadow-xl ring-1 ring-white/10">
					<button type="button" onClick={() => e.open(chip)} className="cursor-pointer rounded-lg px-3 py-1.5 text-left text-white hover:bg-white/10">
						Change…
					</button>
					<button type="button" onClick={() => e.remove(chip)} className="cursor-pointer rounded-lg px-3 py-1.5 text-left text-gray-300 hover:bg-white/10">
						Remove
					</button>
				</span>
			)}
		</span>
	)
}

/** A filter as a small pill with ×. */
export function Pill({ chip, e }: { chip: BarChip; e: Easy }) {
	return (
		<span className="inline-flex shrink-0 items-center rounded-full bg-white/[0.08] ring-1 ring-white/10">
			<button type="button" onClick={() => e.open(chip)} className="flex cursor-pointer items-center gap-1.5 py-0.5 pr-0.5 pl-2.5 text-[14px] font-semibold text-white">
				{chip.hue && <span className="h-2 w-2 rounded-full" style={{ background: chip.hue }} />}
				{chip.label}
			</button>
			<button
				type="button"
				aria-label={`Remove ${chip.label}`}
				onClick={() => e.remove(chip)}
				className="mr-0.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:text-white"
			>
				<XMarkIcon className="h-3.5 w-3.5" />
			</button>
		</span>
	)
}

/** "A and B", "A, B and C". */
export const and = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`)
