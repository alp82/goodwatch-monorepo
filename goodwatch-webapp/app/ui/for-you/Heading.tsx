import { FingerPrintIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import { DISPLAY } from "~/ui/my-pages/bits"

const EYEBROW =
	"text-[11px] font-bold tracking-[0.18em] text-amber-400/80 uppercase"

/**
 * The page's heading with the way to the Taste page at the right end: shown on desktop over the steering, and on every
 * screen over the other states. The caller passes the display class (flex, or hidden lg:flex).
 */
export function Heading({ className = "" }: { className?: string }) {
	return (
		<header className={`${className} items-end justify-between gap-4`}>
			<div>
				<p className={EYEBROW}>For you</p>
				<h1 className={`${DISPLAY} text-3xl leading-tight text-white`}>
					<span className="font-light text-gray-300">What are you </span>
					<span className="text-amber-400">in the mood for?</span>
				</h1>
			</div>
			<TasteButton />
		</header>
	)
}

/** Phones while steering, where the page has no heading: a slim row with the way to the Taste page on the right. */
export function PhoneHeadingRow() {
	return (
		<div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
			<p className={EYEBROW}>For you</p>
			<TasteButton />
		</div>
	)
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
