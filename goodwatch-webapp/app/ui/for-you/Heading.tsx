import { FingerPrintIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { createContext, useContext } from "react"
import { RecsSwitch } from "~/ui/trope-recs/RecsSwitch"

/** The member has a trope profile: the row leads with "Curated for you | By your tropes" (the route provides it). */
export const TropeSwitchContext = createContext(false)

/**
 * The slim row over the page: what the picks come from, and the way to the Taste page at the right end. Watch's tabs
 * name the page, so it has no big heading. The caller passes the display class (flex, or hidden lg:flex).
 */
export function Heading({ className = "" }: { className?: string }) {
	const tropes = useContext(TropeSwitchContext)
	return (
		<header className={`${className} items-center justify-between gap-3`}>
			<div className="flex min-w-0 items-center gap-4">
				{tropes && <RecsSwitch here="curated" />}
				<h2
					className={`text-sm text-gray-400 ${tropes ? "hidden lg:block" : ""}`}
				>
					Picked from your taste, steered by mood.
				</h2>
			</div>
			<TasteButton compact={tropes} />
		</header>
	)
}

/** Phones while steering: the same slim row. */
export function PhoneHeadingRow() {
	return <Heading className="mb-3 flex lg:hidden" />
}

/** `compact`: beside the switch, a phone shows the icon alone (the row has to fit 390 px). */
function TasteButton({ compact = false }: { compact?: boolean }) {
	return (
		<Link
			to="/taste"
			prefetch="intent"
			className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold text-gray-200 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-white hover:ring-white/30 ${compact ? "max-sm:size-10 max-sm:justify-center max-sm:px-0" : ""}`}
		>
			<FingerPrintIcon className="size-4 text-amber-400" aria-hidden />
			<span className={compact ? "max-sm:sr-only" : ""}>Your taste</span>
		</Link>
	)
}
