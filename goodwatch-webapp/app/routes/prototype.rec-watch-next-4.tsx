// PROTOTYPE - throwaway. Round 4 of Watch next (#176). Owner feedback on round 3: the "sort for tonight"
// idea should drive the hero, the stepped "evenings ahead" grid is the right shape, and a few filters
// should narrow things down. Every variant is: 1. the selection (an ordering plus filters), 2. the hero,
// showing the top title under that selection, 3. a stepped grid, large first and smaller further out.
// A selection is only a view; the saved Wishlist order changes only through "Use this order".
//   /prototype/rec-watch-next-4?variant=<key>&wishlist=me|empty|few|many
// `me` (the default when signed in) reads your real Wishlist, ratings, and services, read-only. On localhost in
// development, ?as=<user uuid> reads that person instead. Every change stays in memory; nothing is written.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useMemo, useRef, useState } from "react"
import { getWatchNext3 } from "~/server/prototype-rec-watch-next-3.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { RateDialog, ToastBar } from "~/ui/prototype-rec-watch-next/kit"
import type { LoaderData, WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { DemoBar, Peek, SuggestShelf } from "~/ui/prototype-rec-watch-next-3/kit3"
import { type Queue, useQueue } from "~/ui/prototype-rec-watch-next-3/model"
import { DISPLAY, Hero4, OrderLine, type Tier, Tiers, WRAP, byEvening, byFit, byRank } from "~/ui/prototype-rec-watch-next-4/kit4"
import { ANY, type Sel, type View, apply, topGenres } from "~/ui/prototype-rec-watch-next-4/select"
import { BarSel, ChipsSel, DialSel, PresetsSel, type SelProps, SentenceSel } from "~/ui/prototype-rec-watch-next-4/selectors"
import { CSS } from "~/ui/prototype-rec-watch-next-4/styles"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	// Round 3's loader and its process cache: no new queries.
	return json(await getWatchNext3(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" }]
export const meta = () => [{ title: "Watch next prototype, round 4 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	["wishlist", "country", "as"].some((k) => currentUrl.searchParams.get(k) !== nextUrl.searchParams.get(k))

type Place = "above" | "inside" | "sticky"
type Step = "evening" | "rank" | "fit"
const VARIANTS: Record<string, { name: string; look: "existing" | "bolder"; Sel: (p: SelProps) => JSX.Element; place: Place; step: Step; filters: "hard" | "soft" }> = {
	sentence: { name: "Tonight, in a sentence", look: "bolder", Sel: SentenceSel, place: "inside", step: "evening", filters: "hard" },
	chips: { name: "Chips, rank bands", look: "existing", Sel: ChipsSel, place: "above", step: "rank", filters: "hard" },
	bar: { name: "Sticky bar, evenings", look: "existing", Sel: BarSel, place: "sticky", step: "evening", filters: "hard" },
	dial: { name: "Mood dial, by fit", look: "bolder", Sel: DialSel, place: "inside", step: "fit", filters: "soft" },
	presets: { name: "Kinds of evening, by fit", look: "existing", Sel: PresetsSel, place: "above", step: "fit", filters: "soft" },
}

const STEP_HEAD: Record<Step, { title: string; note: string }> = {
	evening: { title: "The evenings after", note: "At four evenings a week, a film takes one evening and a series two to get into." },
	rank: { title: "After that", note: "The rest of this selection, in order. Each step further down gets smaller." },
	fit: { title: "How the rest fits", note: "Titles that match everything you picked come first and largest." },
}

export default function WatchNextRound4() {
	const data = useLoaderData<typeof loader>() as unknown as LoaderData
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "sentence"
	const v = VARIANTS[key] ?? VARIANTS.sentence
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			{/* Remount on every switch so each variant starts from the same seeded queue and an open selection. */}
			<Page key={`${key}:${data.mode}:${data.wishlist.length}`} data={data} v={v} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, x]) => [k, `${x.name} (${x.look})`]))}
				position="top-[4.5rem] right-2 scale-75 origin-top-right"
			/>
		</>
	)
}

function Page({ data, v }: { data: LoaderData; v: (typeof VARIANTS)[string] }) {
	const q = useQueue(data)
	const [sel, setSel] = useState<Sel>(ANY)
	// "Not tonight" sends the hero to the end of this view for this visit; the saved order stays.
	const [passed, setPassed] = useState<string[]>([])
	// "Play this next" from a peek puts that title in the hero, whatever the selection.
	const [pin, setPin] = useState<string | null>(null)
	const [peek, setPeek] = useState<string | null>(null)
	const sims = useRef(0)
	const genres = useMemo(() => topGenres(q, 6), [data.wishlist.length])
	const view: View = useMemo(() => apply(q, sel, v.filters, passed, pin), [q.order, sel, passed, pin, v.filters])
	const tiers: Tier[] = v.step === "evening" ? byEvening(q, view.keys) : v.step === "rank" ? byRank(view.keys) : byFit(view)
	const choose = (s: Sel) => {
		setPin(null)
		setSel(s)
	}
	const onPeek = (t: { key: string }) => setPeek(t.key)
	const peekQ = { ...q, toTop: (k: string) => (q.toTop(k), setPin(k)), addQ: (k: string, how: Parameters<Queue["addQ"]>[1]) => (q.addQ(k, how), how === "top" && setPin(k)) } as Queue

	const sim = () => {
		const pick = q.suggest.forYou(30)[sims.current++ % 30]
		if (pick) q.addQ(pick.key, q.count === 0 ? "top" : "bottom")
	}

	const selector = <v.Sel q={q} sel={sel} setSel={choose} genres={genres} />
	const line = <OrderLine q={q} v={view} sel={sel} setSel={choose} dark={v.place === "inside"} />
	const head = STEP_HEAD[v.step === "fit" && !view.need ? "rank" : v.step]
	const rest = view.keys.length > 1

	return (
		<div className="overflow-x-clip pb-40">
			{v.place === "above" && (
				<section className={`${WRAP} pb-6 pt-6 md:pt-10`} aria-label="Selection">
					{selector}
					<div className="mt-4">{line}</div>
				</section>
			)}
			{v.place === "sticky" && (
				<section className="sticky top-16 z-40 border-b border-white/10 bg-gray-900/90 backdrop-blur-md" aria-label="Selection">
					<div className={WRAP}>{selector}</div>
				</section>
			)}
			{v.place === "sticky" && <div className={`${WRAP} py-3`}>{line}</div>}
			<Hero4
				q={q}
				v={view}
				sel={sel}
				setSel={choose}
				onPeek={onPeek}
				onPass={(k) => setPassed((p) => [...p.filter((x) => x !== k), k])}
				top={
					v.place === "inside" ? (
						<>
							{selector}
							<div className="mt-4">{line}</div>
						</>
					) : undefined
				}
				bold={v.look === "bolder"}
			/>

			<div className={`${WRAP} pt-8`}>
				{rest && (
					<header className="mb-6 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
						<span className="hidden md:block" />
						<div>
							<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>{head.title}</h2>
							<p className="mt-1 text-sm text-gray-400">{head.note}</p>
						</div>
					</header>
				)}
				<Tiers q={q} tiers={tiers} onPeek={onPeek} />
				<SuggestShelf q={q} onOpen={onPeek} className="mt-4" />
			</div>
			<div className={`${WRAP} mt-10 text-xs text-gray-500`}>
				Prototype. Changes stay on this page until you reload. Leaving dates are simulated.{data.demoServices ? " Services shown are Netflix, Prime Video, and Disney+ for the demo." : ""}
			</div>
			<Peek q={peekQ} t={peek ? (q.T(peek) as WTitle) ?? null : null} onClose={() => setPeek(null)} />
			<RateDialog store={q} />
			<ToastBar store={q} />
			<DemoBar signedIn={data.signedIn} mode={data.mode} count={q.count} onReset={q.reset} onSim={sim} />
		</div>
	)
}
