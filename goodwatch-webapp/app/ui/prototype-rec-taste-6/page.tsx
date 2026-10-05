// PROTOTYPE - throwaway. The round 6 Taste page: three tabs (?view=sides|crowd|fingerprint). Sides of you in
// one of several variants (?variant=<key>); You vs everyone is round 4's, unchanged; Fingerprint is #181's
// families view, refined. Flipping the variant switcher jumps to Sides, the only view it changes.
import { Link, useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect, useRef } from "react"
import Crowd from "~/ui/prototype-rec-taste-4/views/Crowd"
import type { Payload6 } from "./model"
import { DEFAULT_VARIANT, VARIANTS } from "./variants"
import Fingerprint from "./views/Fingerprint"

type View = "sides" | "crowd" | "fingerprint"

export function TastePage6({ data }: { data: Payload6 }) {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const raw = params.get("variant") ?? ""
	const key = VARIANTS[raw] ? raw : DEFAULT_VARIANT
	const variant = VARIANTS[key]
	const v = params.get("view")
	const view: View = v === "crowd" || v === "fingerprint" ? v : "sides"

	const last = useRef(key)
	useEffect(() => {
		if (last.current === key) return
		last.current = key
		if (view === "sides") return
		const next = new URLSearchParams(params)
		next.set("view", "sides")
		navigate(`?${next}`, { replace: true, preventScrollReset: true })
	}, [key, view, params, navigate])

	const to = (t: View) => {
		const next = new URLSearchParams(params)
		next.set("view", t)
		return `?${next}`
	}
	const tabs: { id: View; name: string }[] = [
		{ id: "sides", name: "Sides of you" },
		{ id: "crowd", name: "You vs everyone" },
		{ id: "fingerprint", name: "Fingerprint" },
	]

	return (
		<>
			<nav aria-label="Your taste" className="border-b border-white/10 bg-gray-950">
				<div className="t6-noscroll mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 md:gap-8 md:px-8">
					{tabs.map((t) => (
						<Link
							key={t.id}
							to={to(t.id)}
							replace
							preventScrollReset
							aria-current={view === t.id ? "page" : undefined}
							className={`-mb-px shrink-0 whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition md:py-4 md:text-base ${view === t.id ? "border-amber-400 text-white" : "border-transparent text-gray-400 hover:text-gray-200"}`}
						>
							{t.name}
						</Link>
					))}
				</div>
			</nav>
			{view === "sides" && <variant.View key={key} data={data} />}
			{view === "crowd" && <Crowd data={data} />}
			{view === "fingerprint" && <Fingerprint data={data.fp} />}
		</>
	)
}
