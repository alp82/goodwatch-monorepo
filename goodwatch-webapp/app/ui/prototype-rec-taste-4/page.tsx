// PROTOTYPE - throwaway. The round 4 Taste page: a three-tab subnav (?view=sides|crowd|third) over round 2's
// Sides and Crowd and one third-view candidate (?variant=<key>). Flipping the variant switcher jumps to the
// third tab, since that is the only view it changes.
import { Link, useNavigate, useSearchParams } from "@remix-run/react"
import { useEffect, useRef } from "react"
import type { Report } from "~/ui/prototype-rec-taste-2/model"
import { CANDIDATES, DEFAULT_CANDIDATE } from "./candidates"
import type { Payload4 } from "./model"
import Crowd from "./views/Crowd"
import Sides from "./views/Sides"

type View = "sides" | "crowd" | "third"

export function TastePage({ data }: { data: Payload4 }) {
	const [params] = useSearchParams()
	const navigate = useNavigate()
	const key =
		params.get("variant") && CANDIDATES[params.get("variant") ?? ""]
			? (params.get("variant") as string)
			: DEFAULT_CANDIDATE
	const candidate = CANDIDATES[key]
	const raw = params.get("view")
	const view: View = raw === "crowd" || raw === "third" ? raw : "sides"

	const last = useRef(key)
	useEffect(() => {
		if (last.current === key) return
		last.current = key
		if (view === "third") return
		const next = new URLSearchParams(params)
		next.set("view", "third")
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
		{ id: "third", name: candidate.name },
	]

	return (
		<>
			<nav
				aria-label="Your taste"
				className="border-b border-white/10 bg-gray-950"
			>
				<div className="t4-noscroll mx-auto flex max-w-7xl gap-5 overflow-x-auto px-4 md:gap-8 md:px-8">
					{tabs.map((t) => (
						<Link
							key={t.id}
							to={to(t.id)}
							replace
							aria-current={view === t.id ? "page" : undefined}
							className={`-mb-px shrink-0 whitespace-nowrap border-b-2 py-3 text-sm font-semibold transition md:py-4 md:text-base ${view === t.id ? "border-amber-400 text-white" : "border-transparent text-gray-400 hover:text-gray-200"}`}
						>
							{t.name}
						</Link>
					))}
				</div>
			</nav>
			{view === "sides" && <Sides data={data} />}
			{view === "crowd" && <Crowd data={data} />}
			{view === "third" && <candidate.View key={key} data={data} />}
		</>
	)
}

/** Which data the page shows, with a one-tap switch. Prototype chrome, kept clear of the site header. */
export function DataToggle({ who }: { who: Report["who"] }) {
	const [params] = useSearchParams()
	const other = new URLSearchParams(params)
	other.set("as", who.mode === "me" ? "demo" : "me")
	return (
		<div className="fixed bottom-32 left-2 z-40 max-w-[70vw] rounded-lg border border-white/15 bg-black/80 px-3 py-2 text-xs text-gray-200 backdrop-blur lg:bottom-3 lg:left-3">
			{who.mode === "me"
				? `Your real data, read-only: ${who.rated} ratings. `
				: who.fellBack
					? "Not signed in, so this is the demo member. "
					: "Demo member. "}
			<Link
				to={`?${other}`}
				className="font-semibold text-amber-300 underline underline-offset-2"
			>
				{who.mode === "me" ? "Show demo" : "Use my data"}
			</Link>
		</div>
	)
}
