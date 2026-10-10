// PROTOTYPE - throwaway (issue #368, map #365). A playground for the tracking rule decisions: a small show page
// driven by app/domain/prototype-tracking-rules, a clock, and one card per decision that sets a case up and flips
// the rule under the same presses.
//   /prototype/tracking-rules?case=<case id>[.<set-up key>]
// Presses, rule switches and answers stay in this browser's localStorage ("PROTOTYPE-tracking-rules-wipe-me",
// "PROTOTYPE-tracking-answers-wipe-me"). The route has no data of its own and calls no endpoint.
import type { ShouldRevalidateFunction } from "@remix-run/react"
import { startTransition, useEffect, useState } from "react"
import { Playground } from "~/ui/prototype-tracking-hub/playground"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [{ title: "Tracking rules playground · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

export default function TrackingRulesPrototype() {
	// The page reads localStorage, so it renders in the browser only.
	const [mounted, setMounted] = useState(false)
	useEffect(() => startTransition(() => setMounted(true)), [])
	if (!mounted) return <p className="p-8 text-gray-400">Loading the tracking rules playground.</p>
	return <Playground />
}
