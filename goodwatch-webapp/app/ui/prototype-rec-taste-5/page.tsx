// PROTOTYPE - throwaway. The round 5 Taste page: two tabs (?view=sides|crowd). Sides of you is the merged
// view (round 4's Sides and Your edges in one sidebar-and-detail layout), in one of several variants
// (?variant=<key>); You vs everyone is round 4's, unchanged. Flipping the variant switcher jumps to Sides,
// since that is the only view it changes.
import { Link, useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect, useRef } from "react"
import type { Payload4 } from "~/ui/prototype-rec-taste-4/model"
import Crowd from "~/ui/prototype-rec-taste-4/views/Crowd"
import { DEFAULT_VARIANT, VARIANTS } from "./variants"

type View = "sides" | "crowd"

export function TastePage5({ data }: { data: Payload4 }) {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const raw = params.get("variant") ?? ""
	const key = VARIANTS[raw] ? raw : DEFAULT_VARIANT
	const variant = VARIANTS[key]
	const view: View = params.get("view") === "crowd" ? "crowd" : "sides"

	const last = useRef(key)
	useEffect(() => {
		if (last.current === key) return
		last.current = key
		if (view === "sides") return
		const next = new URLSearchParams(params)
		next.set("view", "sides")
		navigate(`?${next}`, { replace: true, preventScrollReset: true })
	}, [key, view, params, navigate])

	const to = (v: View) => {
		const next = new URLSearchParams(params)
		next.set("view", v)
		return `?${next}`
	}
	const tabs: { id: View; name: string }[] = [
		{ id: "sides", name: "Sides of you" },
		{ id: "crowd", name: "You vs everyone" },
	]

	return (
		<>
			<nav aria-label="Your taste" className="border-b border-white/10 bg-gray-950">
				<div className="mx-auto flex max-w-7xl gap-6 px-4 md:gap-8 md:px-8">
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
			{view === "sides" ? <variant.View key={key} data={data} /> : <Crowd data={data} />}
		</>
	)
}
