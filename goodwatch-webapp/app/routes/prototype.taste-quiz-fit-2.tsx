// PROTOTYPE - throwaway. Where the taste quiz fits (#220), round 2: the quiz inside the real living room.
//   /prototype/taste-quiz-fit-2?variant=duel|rate|seen|warmup|shelf|live|swap&rating=stack|fused|reveal|dpad|after&as=guest|new|me
// The room is the locked r5-A with the graded hand, the remote is the final Remote ("Grid, tiles"), and the TV
// runs the `ask` flow's look: home (quiz is the second tile), the quiz, tonight's picks, then the sign-up.
// See ~/ui/prototype-taste-quiz-fit-2/quiz.tsx for what each variant and rating control tries.
// Mock titles only: no database is read and nothing persists. Keyboard: arrows are the D-pad, Enter is OK,
// Escape is Back, H is Home.
import { type LinksFunction, json } from "@remix-run/node"
import { useSearchParams } from "@remix-run/react"
import { useEffect } from "react"
import handGraded from "~/img/prototype-living-room/rooms188/hand-graded.webp"
import tvs from "~/img/prototype-living-room/rooms188/r4.json"
import r5Room from "~/img/prototype-living-room/rooms188/r5-A.webp"
import type { LRData } from "~/server/prototype-start-living-room.server"
import {
	LivingRoom3,
	type Room3,
	type TvSlot,
} from "~/ui/prototype-start-living-room/r3"
import type { Tv4 } from "~/ui/prototype-start-living-room/r4"
import { LR5_CSS } from "~/ui/prototype-start-living-room/r5"
import { LR6_CSS } from "~/ui/prototype-start-living-room/r6"
import { Remote7 } from "~/ui/prototype-start-living-room/r7"
import { LR_CSS } from "~/ui/prototype-start-living-room/tv"
import {
	type As,
	QuizScreen,
	type QuizT,
	RATINGS,
	type Rating,
	VARIANTS,
	type Variant,
	useQuiz,
} from "~/ui/prototype-taste-quiz-fit-2/quiz"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"

const ROOM: Room3 = {
	name: "Round 5",
	alt: "A living room at dusk with a rust sofa, a paper lantern, a teal wall, Blu-rays and a film camera on the shelves",
	src: r5Room,
	w: 1672,
	h: 941,
	tv: (tvs as Record<string, Room3["tv"]>).A,
}
// LivingRoom3 wants the old lineup data; this round's TV brings its own titles.
const LR: LRData = {
	country: "US",
	signedIn: false,
	lineup: [],
	recs: [],
	trending: [],
}

export async function loader() {
	if (process.env.NODE_ENV === "production")
		throw new Response("Not found", { status: 404 })
	return json(null)
}

export const links: LinksFunction = () => [
	{ rel: "preconnect", href: "https://fonts.googleapis.com" },
	{
		rel: "stylesheet",
		href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&family=VT323&display=swap",
	},
]
export const meta = () => [
	{ title: "Taste quiz in the living room, round 2 · GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

const V_ORDER = Object.keys(VARIANTS) as Variant[]
const R_ORDER = Object.keys(RATINGS) as Rating[]

export default function TasteQuizFit2() {
	const [params] = useSearchParams()
	const variant = (
		V_ORDER.includes(params.get("variant") as Variant)
			? params.get("variant")
			: "rate"
	) as Variant
	const rating = (
		R_ORDER.includes(params.get("rating") as Rating)
			? params.get("rating")
			: "stack"
	) as Rating
	const as = (
		["guest", "new", "me"].includes(params.get("as") ?? "")
			? params.get("as")
			: "guest"
	) as As
	// Remount on every switch, so each combination starts from a fresh TV.
	return (
		<Room
			key={`${variant}:${rating}:${as}`}
			variant={variant}
			rating={rating}
			as={as}
		/>
	)
}

function Room({
	variant,
	rating,
	as,
}: { variant: Variant; rating: Rating; as: As }) {
	const tv: TvSlot = {
		use: (z, services) => {
			const t = useQuiz(z, variant, rating, as, services)
			useArrows(t)
			return t as unknown as Tv4
		},
		screen: (t) => <QuizScreen t={t as unknown as QuizT} />,
	}
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: LR_CSS }} />
			<LivingRoom3
				data={LR}
				room={ROOM}
				pose="hand"
				round4
				tvSlot={tv}
				remote={(p) => <Remote7 layout="tiles" {...p} />}
				handSrc={handGraded}
			/>
			<style dangerouslySetInnerHTML={{ __html: `${LR5_CSS} ${LR6_CSS}` }} />
			<PrototypeSwitcher
				variants={Object.fromEntries(V_ORDER.map((k) => [k, VARIANTS[k].name]))}
				position="top-[4.5rem] left-1/2 -translate-x-1/2 scale-75 origin-top"
			/>
			<Panel variant={variant} rating={rating} as={as} />
		</>
	)
}

// The arrow keys are the remote's D-pad here (they switch prototype variants elsewhere): capture them first.
function useArrows(t: QuizT) {
	useEffect(() => {
		const dirs: Record<string, "top" | "bottom" | "left" | "right"> = {
			ArrowUp: "top",
			ArrowDown: "bottom",
			ArrowLeft: "left",
			ArrowRight: "right",
		}
		const on = (e: KeyboardEvent) => {
			const d = dirs[e.key]
			if (
				!d ||
				(e.target as HTMLElement).closest("input, textarea, [contenteditable]")
			)
				return
			e.preventDefault()
			e.stopImmediatePropagation()
			t.dpad(d)
		}
		window.addEventListener("keydown", on, true)
		return () => window.removeEventListener("keydown", on, true)
	})
}

// Rating control and audience, top left; the variant switcher is the pill at the top.
function Panel({
	variant,
	rating,
	as,
}: { variant: Variant; rating: Rating; as: As }) {
	const [params, setParams] = useSearchParams()
	const set = (k: string, v: string) => {
		const p = new URLSearchParams(params)
		p.set(k, v)
		setParams(p, { replace: true, preventScrollReset: true })
	}
	const chip = (on: boolean) =>
		`rounded-full px-2.5 py-1 text-left ${on ? "bg-white text-black" : "bg-white/10 text-white/80 hover:bg-white/20"}`
	return (
		<div className="fixed left-4 top-[4.75rem] z-[60] flex w-[250px] flex-col gap-2 rounded-xl bg-black/80 p-3 text-xs text-white ring-1 ring-white/15">
			<div className="text-[10px] font-bold uppercase tracking-wider text-white/50">
				Quiz · {variant}
			</div>
			<div className="leading-snug text-white/70">{VARIANTS[variant].idea}</div>
			<div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
				Rating control
			</div>
			<div className="flex flex-wrap gap-1">
				{R_ORDER.map((r) => (
					<button
						key={r}
						type="button"
						className={chip(r === rating)}
						onClick={() => set("rating", r)}
						title={RATINGS[r].idea}
					>
						{RATINGS[r].name}
					</button>
				))}
			</div>
			<div className="leading-snug text-white/70">{RATINGS[rating].idea}</div>
			<div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
				Audience
			</div>
			<div className="flex gap-1">
				{(["guest", "new", "me"] as As[]).map((a) => (
					<button
						key={a}
						type="button"
						className={chip(a === as)}
						onClick={() => set("as", a)}
					>
						{a === "guest"
							? "Guest"
							: a === "new"
								? "New member"
								: "Member, 42"}
					</button>
				))}
			</div>
		</div>
	)
}
