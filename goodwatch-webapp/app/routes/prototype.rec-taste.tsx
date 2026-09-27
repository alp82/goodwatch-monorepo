// PROTOTYPE - throwaway. Question (#177): what should the Taste page become so it's useful on every visit?
// Eight variants on one route (?variant=<key>), labeled "existing" (existing components, new layout)
// or "bolder". All share a demo member with ~40 ratings and a client-side taste vector over ~440 real
// titles from Crate, so every rating, triage answer, and dial visibly reshuffles the picks.
// Read-only: ratings live in memory and nothing is written to production.
import { json, type LoaderFunctionArgs } from "@remix-run/node"
import { useLoaderData, useSearchParams } from "@remix-run/react"
import { getTastePool } from "~/server/prototype-rec-taste.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { useTaste } from "~/ui/prototype-rec-taste/useTaste"
import { VARIANTS } from "~/ui/prototype-rec-taste/variants"

export async function loader(_: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json({ pool: await getTastePool() })
}

export const meta = () => [{ title: "Taste page prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate = () => false

export default function RecTastePrototype() {
	const { pool } = useLoaderData<typeof loader>()
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "hub"
	const variant = VARIANTS[key] ?? VARIANTS.hub
	const taste = useTaste(pool)
	return (
		<>
			<variant.View key={key} taste={taste} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, `${v.name} (${v.style})`]))}
				position="bottom-3 left-1/2 -translate-x-1/2 scale-90 origin-bottom"
			/>
		</>
	)
}
