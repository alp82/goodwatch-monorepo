// PROTOTYPE - throwaway (issue #368, map #365). Episode tracking and show statuses as a state machine: the
// statechart, the transition table that is the specification, a small show to press through, what the member reads,
// and the decisions that are left. The machine is app/domain/prototype-tracking-machine.
//   /prototype/tracking-machine?scenario=<preset id>[&step=<n>|all]
//   /prototype/tracking-machine?show=<ended|weekly|specials|nolist>
// Events, switches and answers stay in this browser's localStorage ("PROTOTYPE-tracking-machine-wipe-me",
// "PROTOTYPE-tracking-answers-wipe-me"). The route has no data of its own and calls no endpoint.
import type { ShouldRevalidateFunction } from "@remix-run/react"
import { startTransition, useEffect, useState } from "react"
import { MachinePage } from "~/ui/prototype-tracking-hub/machine/machine-page"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [{ title: "Tracking state machine · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

export default function TrackingMachinePrototype() {
	// The page reads localStorage, so it renders in the browser only.
	const [mounted, setMounted] = useState(false)
	useEffect(() => startTransition(() => setMounted(true)), [])
	if (!mounted) return <p className="p-8 text-gray-400">Loading the tracking state machine.</p>
	return <MachinePage />
}
