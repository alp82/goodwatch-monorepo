import { ClockIcon } from "@heroicons/react/24/solid"
import { useEffect, useRef, useState } from "react"

export interface StepView {
	key: string
	label: string
	kind: "map" | "island" | "bridge"
	/** The island's or bridge's color. */
	color: string | null
}

const KIND: Record<StepView["kind"], string> = {
	map: "Map",
	island: "Island",
	bridge: "Bridge",
}

/**
 * Where the person has been: one icon button that opens every step of the visit (newest first). Moving to a step
 * goes through the browser's history.
 */
export function HistoryBar({
	steps,
	at,
	onGo,
}: {
	steps: StepView[]
	/** The step shown. */
	at: number
	/** Moves this many steps (negative is back). */
	onGo: (delta: number) => void
}) {
	const [open, setOpen] = useState(false)
	const box = useRef<HTMLDivElement>(null)
	const toggle = useRef<HTMLButtonElement>(null)
	useEffect(() => {
		if (!open) return
		const away = (e: PointerEvent) => {
			if (!box.current?.contains(e.target as Node)) setOpen(false)
		}
		const esc = (e: KeyboardEvent) => {
			if (e.key !== "Escape") return
			e.stopPropagation()
			setOpen(false)
			toggle.current?.focus()
		}
		window.addEventListener("pointerdown", away)
		window.addEventListener("keydown", esc, true)
		return () => {
			window.removeEventListener("pointerdown", away)
			window.removeEventListener("keydown", esc, true)
		}
	}, [open])
	const dot = (s: StepView) =>
		s.color ? (
			<span
				className="ex-dot"
				style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
			/>
		) : null
	return (
		<div ref={box} className="ex-hist">
			<button
				ref={toggle}
				type="button"
				aria-expanded={open}
				aria-label={`Where you've been: ${steps.length} ${steps.length === 1 ? "step" : "steps"}`}
				title="Where you've been"
				onClick={() => setOpen((o) => !o)}
				className="ex-hist-btn"
			>
				<ClockIcon className="ex-i" />
			</button>
			{open && (
				<ol className="ex-hist-menu" aria-label="Steps, newest first">
					{steps
						.map((s, n) => ({ s, n }))
						.reverse()
						.map(({ s, n }) => (
							<li key={s.key}>
								<button
									type="button"
									aria-current={n === at ? "step" : undefined}
									onClick={() => {
										setOpen(false)
										if (n !== at) onGo(n - at)
									}}
									className={`ex-hist-item ${n === at ? "ex-hist-cur" : ""}`}
								>
									<span className="ex-hist-kind">{KIND[s.kind]}</span>
									{dot(s)}
									<span className="ex-hist-t">{s.label}</span>
									{n === at && (
										<span className="ex-hist-here">You're here</span>
									)}
								</button>
							</li>
						))}
				</ol>
			)}
		</div>
	)
}
