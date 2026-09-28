import { ArrowUturnLeftIcon, ChevronDownIcon } from "@heroicons/react/24/solid"
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
 * Where the person has been, like a browser's back button: a back button, the last two steps, and every step of the
 * visit in a dropdown (newest first). Moving to a step goes through the browser's history.
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
	const cur = steps[at]
	const prev = at > 0 ? steps[at - 1] : null
	const dot = (s: StepView) =>
		s.color ? (
			<span
				className="ex-dot"
				style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}
			/>
		) : null
	return (
		<div ref={box} className="ex-hist">
			<nav aria-label="Where you've been" className="ex-crumbs">
				<button
					type="button"
					disabled={!prev}
					onClick={() => onGo(-1)}
					aria-label={prev ? `Back to ${prev.label}` : "Back"}
					className="ex-back"
				>
					<ArrowUturnLeftIcon className="ex-i" />
				</button>
				{prev && (
					<>
						<button
							type="button"
							onClick={() => onGo(-1)}
							className="ex-crumb"
							title={prev.label}
							tabIndex={-1}
						>
							{dot(prev)}
							<span className="ex-crumb-t">{prev.label}</span>
						</button>
						<span className="ex-sep" aria-hidden="true">
							/
						</span>
					</>
				)}
				<span
					className="ex-crumb ex-crumb-on"
					aria-current="step"
					title={cur?.label}
				>
					{cur && dot(cur)}
					<span className="ex-crumb-t">{cur?.label}</span>
				</span>
				<button
					ref={toggle}
					type="button"
					aria-expanded={open}
					aria-label={`All ${steps.length} steps`}
					onClick={() => setOpen((o) => !o)}
					className="ex-hist-btn"
				>
					<span className="ex-hist-n" aria-hidden="true">
						{steps.length}
					</span>
					<ChevronDownIcon className="ex-i" />
				</button>
			</nav>
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
