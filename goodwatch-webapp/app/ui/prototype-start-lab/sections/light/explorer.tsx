// PROTOTYPE (start page lab, round 14): the effect explorer for mood lighting e. `?fx=leak,rain` forces those
// effects on regardless of mood; while `fx` is in the URL (even empty, `?fx=`), a small list of every effect name
// sits in the top left corner as toggles. Toggling rewrites `fx` in place (history.replaceState, no navigation; the
// lab bar carries it along, lab/choice.ts paramsFromChoice).
import { useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { type Effect, FX_E, fxOfParam } from "./tables"

/** The forced effects (from `?fx=`), whether the explorer shows, and a toggle. */
export function useFx() {
	const [params] = useSearchParams()
	const param = params.get("fx")
	const [force, setForce] = useState<Effect[]>(() => fxOfParam(param))
	useEffect(() => setForce(fxOfParam(param)), [param])
	const toggle = (e: Effect) =>
		setForce((was) => {
			const next = was.includes(e) ? was.filter((x) => x !== e) : [...was, e]
			const url = new URL(window.location.href)
			url.searchParams.set("fx", next.join(","))
			window.history.replaceState(window.history.state, "", url)
			return next
		})
	return { force, open: param !== null, toggle }
}

export function FxExplorer({ force, toggle }: { force: Effect[]; toggle: (e: Effect) => void }) {
	const [host, setHost] = useState<HTMLElement | null>(null)
	useEffect(() => setHost(document.body), [])
	if (!host) return null
	return createPortal(
		<div className="fixed left-2 top-2 z-[80] w-[7.5rem] rounded-md bg-gray-950/85 p-1.5 text-[11px] leading-tight text-gray-300 shadow-lg ring-1 ring-white/10">
			<div className="mb-1 px-1 text-[10px] uppercase tracking-wide text-gray-500">Effects</div>
			<div className="flex max-h-[60vh] flex-col overflow-y-auto">
				{FX_E.map((e) => {
					const on = force.includes(e)
					return (
						<button
							key={e}
							type="button"
							onClick={() => toggle(e)}
							className={`rounded px-1 py-0.5 text-left ${on ? "bg-amber-500/20 text-amber-300" : "hover:bg-white/5"}`}
						>
							{on ? "● " : "○ "}
							{e}
						</button>
					)
				})}
			</div>
		</div>,
		host,
	)
}
