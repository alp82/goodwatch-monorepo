import { type ReactNode, useEffect, useRef } from "react"
import { stepHeading } from "./shared"

/**
 * The heading of a step that replaced another in place. With `focus` it takes keyboard and screen reader focus when
 * it appears, so the person lands on the new step and not on a control that is gone.
 */
export function FocusHeading({
	focus,
	id,
	children,
}: { focus: boolean; id?: string; children: ReactNode }) {
	const ref = useRef<HTMLHeadingElement>(null)
	useEffect(() => {
		if (focus) ref.current?.focus()
	}, [])
	return (
		<h3 ref={ref} id={id} tabIndex={-1} className={stepHeading}>
			{children}
		</h3>
	)
}
