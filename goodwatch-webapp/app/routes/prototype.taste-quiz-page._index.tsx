// PROTOTYPE - throwaway (#220 round 4). What /taste/quiz becomes: the locked living room quiz (rate + stack +
// moment) as a regular page in the site layout, reached from the Taste page's banner.
//   /prototype/taste-quiz-page?variant=page|backdrop|dock&as=guest|new|me&from=0|3|5
// from = answers a guest already gave (3: left mid-quiz, 5: Rate more after the picks). Mock titles only: no
// database, nothing persists. Keyboard: 1-9 and 0 score, S skips, P back to picks, arrows turn the picks' pages.
import { json } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import {
	type As,
	PAGE_VARIANTS,
	type PageVariant,
	QuizPage,
	usePageQuiz,
} from "~/ui/prototype-taste-quiz-page/page"
import { ProtoBar } from "~/ui/prototype-taste-quiz-page/bar"

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(null)
}
export const meta = () => [
	{ title: "Taste quiz page, round 4 · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function TasteQuizPage() {
	const [p] = useSearchParams()
	const variant = (
		p.get("variant") && p.get("variant")! in PAGE_VARIANTS
			? p.get("variant")
			: "page"
	) as PageVariant
	const as = (
		["guest", "new", "me"].includes(p.get("as") ?? "") ? p.get("as") : "guest"
	) as As
	const from = Number(p.get("from") ?? 0) || 0
	return (
		<>
			<ProtoBar page="quiz" />
			<Quiz
				key={`${variant}:${as}:${from}`}
				variant={variant}
				as={as}
				from={from}
			/>
		</>
	)
}

function Quiz({
	variant,
	as,
	from,
}: { variant: PageVariant; as: As; from: number }) {
	const q = usePageQuiz(as, from)
	return <QuizPage q={q} variant={variant} />
}
