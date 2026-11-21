// PROTOTYPE - throwaway (prototype/explore-r5). Pieces the eras variants share: numerals that roll like a counter,
// an obsession as a colored word, and the sentence that joins words.
import { Link } from "@remix-run/react"
import { Fragment, type ReactNode } from "react"
import { FOCUS } from "../../../../kit/ui"

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

/**
 * Numerals that roll to a new value, digit by digit, like a counter: time passing is the roll. Other characters
 * ("s" in "1990s") stand still. The value is read out by `label` on the caller's side; this is the picture.
 */
export function Odometer({
	value,
	className = "",
	ms = 520,
}: {
	value: string
	className?: string
	ms?: number
}) {
	return (
		<span
			aria-hidden
			className={`inline-flex overflow-hidden leading-none tabular-nums ${className}`}
			style={{ height: "1em" }}
		>
			{value.split("").map((ch, i) => {
				const n = DIGITS.indexOf(ch)
				if (n < 0)
					return (
						// oxlint-disable-next-line react/no-array-index-key -- a character's place in the number is its identity
						<span key={i} className="inline-block h-[1em]">
							{ch}
						</span>
					)
				return (
					// oxlint-disable-next-line react/no-array-index-key -- a digit's place in the number is its identity
					<span key={i} className="relative inline-block h-[1em]">
						<span className="invisible">0</span>
						<span
							className="absolute inset-x-0 top-0 flex flex-col items-center motion-safe:transition-transform motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
							style={{ transform: `translateY(-${n}em)`, transitionDuration: `${ms}ms` }}
						>
							{DIGITS.map((d) => (
								<span key={d} className="block h-[1em]">
									{d}
								</span>
							))}
						</span>
					</span>
				)
			})}
		</span>
	)
}

/** "a, b and c" around any nodes. */
export function joined(items: ReactNode[], last = "and"): ReactNode {
	return items.map((item, i) => (
		// oxlint-disable-next-line react/no-array-index-key -- a fixed sentence
		<Fragment key={i}>
			{i > 0 && (i === items.length - 1 ? ` ${last} ` : ", ")}
			{item}
		</Fragment>
	))
}

/** An obsession inside a sentence: the noun in its fingerprint family's color, as a link to those titles. */
export function ObsessionLink({
	noun,
	color,
	to,
	title,
}: {
	noun: string
	color: string
	to: string
	title?: string
}) {
	return (
		<Link
			to={to}
			prefetch="intent"
			title={title}
			className={`rounded-sm font-semibold underline decoration-white/20 decoration-dotted underline-offset-4 transition-[text-decoration-color] hover:decoration-current hover:decoration-solid ${FOCUS}`}
			style={{ color }}
		>
			{noun}
		</Link>
	)
}

/** The pill that leads onward from a stage: amber for the main way, quiet for the second. */
export function OnwardLink({
	to,
	children,
	quiet = false,
}: {
	to: string
	children: ReactNode
	quiet?: boolean
}) {
	return (
		<Link
			to={to}
			prefetch="intent"
			className={`group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[15px] font-bold transition-colors ${FOCUS} ${
				quiet
					? "bg-white/[0.06] text-gray-100 ring-1 ring-white/10 hover:bg-white/[0.1] hover:ring-white/25"
					: "bg-amber-400 text-gray-950 hover:bg-amber-300"
			}`}
		>
			{children}
			<span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">
				›
			</span>
		</Link>
	)
}
