// PROTOTYPE - throwaway. Question: what does ONE page look like that replaces /connect and /use-with-ai, with far
// less on it? Four layouts on /prototype/ai-page, switched with ?v=A..D (arrow keys too). #<app> picks an app, as on
// /connect. Read-only: nothing here writes anything.
import { useSearchParams } from "@remix-run/react"
import { VARIANTS } from "~/ui/prototype-ai-page/variants"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [{ title: "AI page prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export default function AiPagePrototype() {
	const [params] = useSearchParams()
	const key = params.get("v") ?? "A"
	const variant = VARIANTS[key] ?? VARIANTS.A
	return (
		<>
			<variant.View key={key} />
			<PrototypeSwitcher
				param="v"
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.name]))}
				position="bottom-[5.75rem] left-1/2 -translate-x-1/2 lg:bottom-4 scale-90 origin-bottom"
			/>
		</>
	)
}
