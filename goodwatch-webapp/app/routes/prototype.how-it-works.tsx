// PROTOTYPE - throwaway. Question: what should /how-it-works look like, rebuilt from the start page intro's parts with
// one feature per row? Three layouts on /prototype/how-it-works, switched with ?v=A..C (arrow keys too). The live
// /how-it-works is untouched. Read-only: the only data is /api/intro, the same the start page's TV reads.
import { useSearchParams } from "@remix-run/react"
import { HiwA } from "~/ui/prototype-hiw/hiw-a"
import { HiwB } from "~/ui/prototype-hiw/hiw-b"
import { HiwC } from "~/ui/prototype-hiw/hiw-c"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

export function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [{ title: "How it works prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

const VARIANTS = {
	A: { name: "Screens", View: HiwA },
	B: { name: "One screen", View: HiwB },
	C: { name: "Pictures", View: HiwC },
} as const

export default function HowItWorksPrototype() {
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
