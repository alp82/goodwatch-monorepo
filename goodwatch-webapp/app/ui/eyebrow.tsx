import type { ReactNode } from "react"

/** The caption (D6): a section label such as ON THIS PAGE, a footer group or a form label. */
export const CAPTION = "text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500"
/** The kicker (D6): the amber line above a page or card title. */
export const KICKER = "text-xs font-bold uppercase tracking-[0.18em] text-amber-400"

type EyebrowProps = {
	as?: "p" | "span" | "h2" | "h3" | "dt"
	id?: string
	className?: string
	children: ReactNode
}

/** A section label. `className` is for layout. Tiny labels inside a control keep their own look. */
export function Caption({ as: Tag = "p", id, className = "", children }: EyebrowProps) {
	return (
		<Tag id={id} className={`${CAPTION} ${className}`}>
			{children}
		</Tag>
	)
}

/** The line above a page or card title. `className` is for layout. */
export function Kicker({ as: Tag = "p", id, className = "", children }: EyebrowProps) {
	return (
		<Tag id={id} className={`${KICKER} ${className}`}>
			{children}
		</Tag>
	)
}
