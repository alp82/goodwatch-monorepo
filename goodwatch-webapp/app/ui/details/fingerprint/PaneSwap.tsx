import { type ReactNode, useEffect, useLayoutEffect, useRef } from "react"

// Before paint in the browser, while focus is still on the control in the pane that is hiding: the browser drops
// focus from an inert pane on its next rendering step. On the server there is no focus.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect

export interface Pane {
	id: string
	/** Names the pane as a region for screen readers. */
	label?: string
	node: ReactNode
}

/**
 * Panes that take turns in one place. Every pane sits in the same grid cell, so the cell is always as tall as the
 * tallest pane and nothing around it moves when the active pane changes. Every pane stays in the HTML; the hidden
 * ones are inert, so they can't be focused or read. The swap crossfades with opacity and a small lift only.
 */
export default function PaneSwap({
	active,
	panes,
}: {
	active: string
	panes: Pane[]
}) {
	const ref = useRef<HTMLDivElement>(null)
	// When focus was inside a pane that just hid, move it to the new pane, so keyboard users don't land nowhere.
	useBeforePaint(() => {
		const root = ref.current
		const focused = document.activeElement
		if (!root || !focused || !root.contains(focused)) return
		const pane = focused.closest("[data-pane]")
		if (pane && pane.getAttribute("data-pane") !== active)
			root
				.querySelector<HTMLElement>(`[data-pane="${active}"]`)
				?.focus({ preventScroll: true })
	}, [active])
	return (
		<div ref={ref} className="grid">
			{panes.map((pane) => {
				const on = pane.id === active
				return (
					<div
						key={pane.id}
						data-pane={pane.id}
						tabIndex={-1}
						role={pane.label ? "region" : undefined}
						aria-label={pane.label}
						aria-hidden={!on}
						// React 18 has no boolean `inert`; an empty string sets the attribute.
						{...(on ? {} : { inert: "" })}
						// The incoming pane is visible at once, so it can take focus; the outgoing one stays visible
						// until it has faded out.
						className={`min-w-0 outline-none [grid-area:1/1] motion-safe:duration-300 motion-safe:ease-out ${
							on
								? "visible translate-y-0 opacity-100 motion-safe:transition-[opacity,transform]"
								: "pointer-events-none invisible translate-y-1 opacity-0 motion-safe:transition-[opacity,transform,visibility]"
						}`}
					>
						{pane.node}
					</div>
				)
			})}
		</div>
	)
}
