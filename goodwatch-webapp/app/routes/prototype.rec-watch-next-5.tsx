// PROTOTYPE - throwaway. Round 5 of Watch next (#176). Owner on round 4: the mood dial is right for what it
// makes possible, but it takes too much space and isn't pleasant. Six compact takes on the same model: a
// continuous mood, length, services, and order, ranked softly into "Fits all of it / Also fits / Close".
// Page order stays selection, hero, stepped grid. A selection is only a view until "Use this order".
//   /prototype/rec-watch-next-5?variant=<key>&wishlist=me|empty|few|many
// `me` (the default when signed in) reads your real Wishlist, ratings, and services, read-only. On localhost in
// development, ?as=<user uuid> reads that person instead. Every change stays in memory; nothing is written.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import { getWatchNext3 } from "~/server/prototype-rec-watch-next-3.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { RateDialog, ToastBar } from "~/ui/prototype-rec-watch-next/kit"
import type { LoaderData, WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { DemoBar, Peek, SuggestShelf } from "~/ui/prototype-rec-watch-next-3/kit3"
import { type Queue, useQueue } from "~/ui/prototype-rec-watch-next-3/model"
import { Tiers, byFit, byRank } from "~/ui/prototype-rec-watch-next-4/kit4"
import { ANY, type Sel } from "~/ui/prototype-rec-watch-next-4/select"
import { type Ctx, DISPLAY, Hero5, type M, THEN, WRAP } from "~/ui/prototype-rec-watch-next-5/kit5"
import { apply5, fitting, suggest5 } from "~/ui/prototype-rec-watch-next-5/mood"
import { CSS } from "~/ui/prototype-rec-watch-next-5/styles"
import { type VariantFn, knob, pad, slider, strip, swatches, title } from "~/ui/prototype-rec-watch-next-5/variants"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	// Round 3's loader and its process cache: no new queries.
	return json(await getWatchNext3(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" }]
export const meta = () => [{ title: "Watch next prototype, round 5 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	["wishlist", "country", "as"].some((k) => currentUrl.searchParams.get(k) !== nextUrl.searchParams.get(k))

const VARIANTS: Record<string, { name: string; look: "existing" | "bolder"; fn: VariantFn }> = {
	slider: { name: "Mood slider, then column", look: "bolder", fn: slider },
	knob: { name: "Knob in the hero corner", look: "bolder", fn: knob },
	pad: { name: "Mood pad as the poster", look: "bolder", fn: pad },
	swatches: { name: "Swatches that blend, then column", look: "existing", fn: swatches },
	strip: { name: "Strip that folds on scroll, then column", look: "existing", fn: strip },
	title: { name: "Mood in the title line, then column", look: "bolder", fn: title },
}

export default function WatchNextRound5() {
	const data = useLoaderData<typeof loader>() as unknown as LoaderData
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "slider"
	const v = VARIANTS[key] ?? VARIANTS.slider
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			{/* Remount on every switch so each variant starts from the same seeded queue and an open selection. */}
			<Page key={`${key}:${data.mode}:${data.wishlist.length}`} data={data} fn={v.fn} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, x]) => [k, `${x.name} (${x.look})`]))}
				position="bottom-32 right-2 scale-75 origin-bottom-right md:bottom-20"
			/>
		</>
	)
}

function Page({ data, fn }: { data: LoaderData; fn: VariantFn }) {
	const q = useQueue(data)
	const [sel, setSelRaw] = useState<Sel>(ANY)
	// The mood as the control shows it right now, and the one the page has settled on. Dragging updates the
	// first on every move; the hero and grid follow once the hand rests for a moment.
	const [m, setMRaw] = useState<M>(null)
	const [settled, setSettled] = useState<M>(null)
	useEffect(() => {
		const id = setTimeout(() => setSettled(m), m === null ? 0 : 140)
		return () => clearTimeout(id)
	}, [m])
	const [passed, setPassed] = useState<string[]>([])
	const [pin, setPin] = useState<string | null>(null)
	const [peek, setPeek] = useState<string | null>(null)
	const [sims, setSims] = useState(0)

	const setSel = (s: Sel) => (setPin(null), setSelRaw(s))
	const setM = (x: M) => (setPin(null), setMRaw(x))
	const reset = () => (setPin(null), setSelRaw(ANY), setMRaw(null))

	const view = useMemo(() => apply5(q, sel, settled?.p ?? null, passed, pin), [q.order, sel, settled, passed, pin])
	const live = useMemo(() => fitting(apply5(q, sel, m?.p ?? null)), [q.order, sel, m])
	const c: Ctx = { q, v: view, sel, setSel, m, setM, n: live, reset }
	const first = view.keys[0] ? q.T(view.keys[0]) : undefined
	const offer = first ? undefined : suggest5(q, sel, settled?.p ?? null)
	const parts = fn(c, first)
	const then = parts.aside === "then"

	// With the Then column showing the next three, the grid starts after them.
	const gridView = then ? { ...view, keys: [view.keys[0], ...view.keys.slice(1 + THEN)].filter(Boolean) } : view
	const tiers = view.need ? byFit(gridView) : byRank(gridView.keys)
	const rest = gridView.keys.length > 1

	const onPeek = (t: { key: string }) => setPeek(t.key)
	const peekQ = { ...q, toTop: (k: string) => (q.toTop(k), setPin(k)), addQ: (k: string, how: Parameters<Queue["addQ"]>[1]) => (q.addQ(k, how), how === "top" && setPin(k)) } as Queue
	const sim = () => {
		const pick = q.suggest.forYou(30)[sims % 30]
		setSims(sims + 1)
		if (pick) q.addQ(pick.key, q.count === 0 ? "top" : "bottom")
	}

	return (
		<div className="overflow-x-clip pb-40">
			{parts.sticky}
			{parts.above && (
				<section className={`${WRAP} relative z-30 pb-4 pt-5 md:pt-7`} aria-label="Selection">
					{parts.above}
				</section>
			)}
			<Hero5 c={c} onPeek={onPeek} onPass={(k) => setPassed((p) => [...p.filter((x) => x !== k), k])} top={parts.top} eyebrow={parts.eyebrow} aside={parts.aside} offer={offer} />

			<div className={`${WRAP} pt-8`}>
				{rest && (
					<header className="mb-6 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
						<span className="hidden md:block" />
						<div>
							<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>{view.need ? "How the rest fits" : "After that"}</h2>
							<p className="mt-1 text-sm text-gray-400">{view.need ? "Titles that match everything you picked come first and largest; near misses follow." : "The rest of your Wishlist, in order. Each step further down gets smaller."}</p>
						</div>
					</header>
				)}
				<Tiers q={q} tiers={tiers} onPeek={onPeek} />
				<SuggestShelf q={q} onOpen={onPeek} className="mt-4" />
			</div>
			<div className={`${WRAP} mt-10 text-xs text-gray-500`}>
				Prototype. Changes stay on this page until you reload. Leaving dates are simulated. Mood positions come from each title's mood flags and genres.
				{data.demoServices ? " Services shown are Netflix, Prime Video, and Disney+ for the demo." : ""}
			</div>
			<Peek q={peekQ} t={peek ? ((q.T(peek) as WTitle) ?? null) : null} onClose={() => setPeek(null)} />
			<RateDialog store={q} />
			<ToastBar store={q} />
			<DemoBar signedIn={data.signedIn} mode={data.mode} count={q.count} onReset={q.reset} onSim={sim} />
		</div>
	)
}
