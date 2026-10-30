// What a click on the orbit opens in the header: the fingerprint's key facts (the viewer type, the strongest families,
// the top attributes) and, for a member visitor, their match on a half-round pill that slides out from behind the
// picture across the name and facts. The header keeps its height; motion is transform and opacity only. The header
// (Layouts.tsx) owns the open state; the pill lives in Pills.tsx; this file holds the pieces they share.
import type { ReactNode } from "react"
import type { MatchView } from "./Compare"
import type { KeyFacts } from "./facts"

export interface RevealProps {
	open: boolean
	id: string
	handle: string
	identity: string | null
	facts: KeyFacts
	/** The signed-in visitor's match; null for the owner and guests. */
	match: MatchView | null
}

/** `inert` while hidden, so its links leave the tab order (React 18 passes the attribute through as a string). */
export const inertUnless = (shown: boolean) =>
	(shown ? {} : { inert: "" }) as Record<string, string>

const FADE = "transition-[opacity,transform] duration-300 ease-out"

/** A layer over the content column that fades in when open. */
export function Layer({
	open,
	id,
	className,
	children,
}: { open: boolean; id: string; className: string; children: ReactNode }) {
	return (
		<section
			id={id}
			aria-label="Taste at a glance"
			aria-hidden={!open}
			{...inertUnless(open)}
			className={`absolute ${FADE} ${open ? "opacity-100" : "pointer-events-none opacity-0"} ${className}`}
		>
			{children}
		</section>
	)
}

/**
 * The pill's frame behind the picture: closed, only its round end sits under the picture (hidden); open, it slides out
 * to the right across the content column. `surface` styles the pill itself.
 */
export function PillFrame({
	open,
	surface,
	style,
}: { open: boolean; surface: string; style?: React.CSSProperties }) {
	return (
		<span
			aria-hidden
			className="pointer-events-none absolute top-1/2 left-0 h-[88px] w-full -translate-y-1/2 overflow-hidden rounded-full sm:h-[132px]"
		>
			<span
				className={`absolute inset-0 rounded-full transition-[transform,opacity] duration-500 ease-out ${surface} ${
					open
						? "translate-x-0 opacity-100"
						: "-translate-x-[calc(100%-88px)] opacity-0 sm:-translate-x-[calc(100%-132px)]"
				}`}
				style={style}
			/>
		</span>
	)
}
