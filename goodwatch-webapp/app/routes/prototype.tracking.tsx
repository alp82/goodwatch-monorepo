// PROTOTYPE - throwaway (map #365). The hub of the tracking prototypes: every open question of the four prototypes
// as an answerable item, with a link that opens the prototype where the question shows, and the answers as text to
// copy. Answers stay in this browser's localStorage ("PROTOTYPE-tracking-answers-wipe-me"), shared with the
// playground at /prototype/tracking-rules. The route has no data of its own and calls no endpoint.
import type { ShouldRevalidateFunction } from "@remix-run/react"
import { startTransition, useEffect, useState } from "react"
import { Hub } from "~/ui/prototype-tracking-hub/hub"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [{ title: "Tracking decisions · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

export default function TrackingHubPrototype() {
	const [mounted, setMounted] = useState(false)
	useEffect(() => startTransition(() => setMounted(true)), [])
	if (!mounted) return <p className="p-8 text-gray-400">Loading the tracking decisions.</p>
	return <Hub />
}
