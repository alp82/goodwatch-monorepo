// PROTOTYPE (start-streamline): which flow is on show (`?flow=`), and a floating bar to switch flows and personas.
// The bar sits at the top, under the header, because the bottom of the screen is what the prototype is about.
import { useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect } from "react"

export const FLOWS = {
	d: "Preview: a compact card under the sofa grows into the card",
	e: "Ledge: posters on the room's floor grow into the card",
	f: "Open: the card from the start, the lamp comes on",
	old: "Today's page",
} as const

export type Flow = keyof typeof FLOWS

const KEYS = Object.keys(FLOWS) as Flow[]
const PERSONAS = ["guest", "full", "few", "new"] as const

export function useFlow(): Flow {
	const [params] = useSearchParams()
	const f = params.get("flow")
	return f && f in FLOWS ? (f as Flow) : "d"
}

export function ProtoSwitcher() {
	const flow = useFlow()
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const persona = params.get("member") ?? "guest"
	const go = (next: { flow?: Flow; persona?: string }) => {
		const p = new URLSearchParams(window.location.search)
		if (next.flow) p.set("flow", next.flow)
		if (next.persona) {
			if (next.persona === "guest") p.delete("member")
			else p.set("member", next.persona)
		}
		// A new persona or flow starts fresh: no query, top of the page.
		for (const k of ["q", "moods", "themes", "styles"]) p.delete(k)
		window.scrollTo(0, 0)
		navigate({ search: `?${p}` }, { replace: true })
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null
			if (t?.closest("input, textarea, [contenteditable]")) return
			if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
			const i = KEYS.indexOf(flow)
			const n = (i + (e.key === "ArrowRight" ? 1 : -1) + KEYS.length) % KEYS.length
			go({ flow: KEYS[n] })
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	})
	const step = (d: number) =>
		go({ flow: KEYS[(KEYS.indexOf(flow) + d + KEYS.length) % KEYS.length] })
	return (
		<div className="fixed top-[72px] left-1/2 z-[1100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-950/95 p-1 text-xs font-semibold text-white shadow-[0_8px_30px_rgb(0_0_0/.6)] ring-2 ring-fuchsia-400/70">
			<button
				type="button"
				onClick={() => step(-1)}
				className="h-7 w-7 cursor-pointer rounded-full hover:bg-white/15"
				aria-label="Previous flow"
			>
				←
			</button>
			<span className="max-w-[46vw] truncate px-1 sm:max-w-none">
				<b>{flow.toUpperCase()}</b>
				<span className="hidden sm:inline"> · {FLOWS[flow]}</span>
			</span>
			<button
				type="button"
				onClick={() => step(1)}
				className="h-7 w-7 cursor-pointer rounded-full hover:bg-white/15"
				aria-label="Next flow"
			>
				→
			</button>
			<select
				value={persona}
				onChange={(e) => go({ persona: e.target.value })}
				className="h-7 cursor-pointer rounded-full border-0 bg-white/10 py-0 pr-7 pl-2.5 text-xs font-semibold text-white"
				aria-label="Persona"
			>
				{PERSONAS.map((p) => (
					<option key={p} value={p} className="text-black">
						{p === "guest" ? "Guest" : `Member: ${p}`}
					</option>
				))}
			</select>
		</div>
	)
}
