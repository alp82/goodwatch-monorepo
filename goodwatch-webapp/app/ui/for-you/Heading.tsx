import { FingerPrintIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"

/**
 * The slim row over the page: what the picks come from, and the way to the Taste page at the right end. Watch's tabs
 * name the page, so it has no big heading. The caller passes the display class (flex, or hidden lg:flex).
 */
export function Heading({ className = "" }: { className?: string }) {
	return (
		<header className={`${className} items-center justify-between gap-3`}>
			<h2 className="text-sm text-gray-400">
				Picked from your taste, steered by mood.
			</h2>
			<TasteButton />
		</header>
	)
}

/** Phones while steering: the same slim row. */
export function PhoneHeadingRow() {
	return <Heading className="mb-3 flex lg:hidden" />
}

function TasteButton() {
	return (
		<Link
			to="/taste"
			prefetch="intent"
			className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold text-gray-200 ring-1 ring-white/15 transition-colors hover:bg-white/5 hover:text-white hover:ring-white/30"
		>
			<FingerPrintIcon className="size-4 text-amber-400" aria-hidden />
			Your taste
		</Link>
	)
}
