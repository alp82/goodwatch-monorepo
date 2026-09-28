// PROTOTYPE - throwaway (#220 round 4). The Taste page (a mock of the REC_TASTE_PAGE tabs on origin/main) with the
// banner into the quiz page.
//   /prototype/taste-quiz-page/taste?as=guest|new|me&state=zero|mid|five|joined   (state is for guests)
import { json } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { ProtoBar } from "~/ui/prototype-taste-quiz-page/bar"
import {
	TastePage,
	type TasteState,
	type Who,
} from "~/ui/prototype-taste-quiz-page/taste"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(null)
}
export const meta = () => [
	{ title: "Taste page banner, round 4 · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function TasteBannerPage() {
	const [p] = useSearchParams()
	const who = (
		["guest", "new", "me"].includes(p.get("as") ?? "") ? p.get("as") : "guest"
	) as Who
	const state = (
		["zero", "mid", "five", "joined"].includes(p.get("state") ?? "")
			? p.get("state")
			: "zero"
	) as TasteState
	return (
		<>
			<ProtoBar page="taste" />
			<TastePage who={who} state={state} />
		</>
	)
}
