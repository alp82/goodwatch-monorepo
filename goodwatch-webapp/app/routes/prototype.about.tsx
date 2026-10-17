// PROTOTYPE - throwaway. Question: what should /about look like, as clear and calm as /use-with-ai? Three layouts on
// /prototype/about, switched with ?v=A..C (arrow keys too). The live /about is untouched. Read-only.
import { useSearchParams } from "@remix-run/react"
import { AboutA } from "~/ui/prototype-hiw/about-a"
import { AboutB } from "~/ui/prototype-hiw/about-b"
import { AboutC } from "~/ui/prototype-hiw/about-c"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [{ title: "About prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

const VARIANTS = {
	A: { name: "Note", View: AboutA },
	B: { name: "Before and after", View: AboutB },
	C: { name: "Questions", View: AboutC },
} as const

export default function AboutPrototype() {
	const [params] = useSearchParams()
	const key = (params.get("v") ?? "A") as keyof typeof VARIANTS
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
