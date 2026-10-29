// PROTOTYPE (start-streamline, round 6): which flow is on show (`?flow=`), and a floating bar to switch flows and personas.
// The bar sits at the top, under the header, because the bottom of the screen is what the prototype is about.
import { useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect } from "react"

export const FLOWS = {
	l: "New member's card: Path, rating as the big step",
	r: "New member's card: Wall of posters behind one call",
	s: "New member's card: three tiles with pictures",
	old: "Today's page",
} as const

export type Flow = keyof typeof FLOWS

/** Rounds 3 and 4: the room set lower (the window in view), the ledge on the floor, the card growing up from it. */
export const ROUND3: readonly Flow[] = ["l", "r", "s"]

const KEYS = Object.keys(FLOWS) as Flow[]
const PERSONAS = ["guest", "full", "few", "new"] as const

export function useFlow(): Flow {
	const [params] = useSearchParams()
	const f = params.get("flow")
	return f && f in FLOWS ? (f as Flow) : "l"
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
		<div className="fixed top-[72px] left-2 z-[1100] flex items-center gap-1 rounded-full bg-fuchsia-950/95 p-1 text-xs font-semibold text-white shadow-[0_8px_30px_rgb(0_0_0/.6)] ring-2 ring-fuchsia-400/70">
			<button
				type="button"
				onClick={() => step(-1)}
				className="h-7 w-7 cursor-pointer rounded-full hover:bg-white/15"
				aria-label="Previous flow"
			>
				←
			</button>
			<span className="max-w-[46vw] truncate px-1 sm:max-w-[34vw]">
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
