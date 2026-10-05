// PROTOTYPE - throwaway. Round 6 of Watch next (#176). Owner on round 5: `strip` and `swatches` go in the
// right direction but need more exploration. Seven takes between and around them: colour swatches pick a
// mood (two blend), with length, services, order, the "N fit" count, and the line that says whether you
// see a view or your saved order. Page order stays selection, hero, stepped grid.
//   /prototype/rec-watch-next-6?variant=<key>&wishlist=me|empty|few|many
// `me` (the default when signed in) reads your real Wishlist, ratings, and services, read-only. On localhost in
// development, ?as=<user uuid> reads that person instead. Every change stays in memory; nothing is written.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useEffect, useMemo, useState } from "react"
import { getWatchNext3 } from "~/server/prototype-rec-watch-next-3.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { RateDialog, ToastBar } from "~/ui/prototype-rec-watch-next/kit"
import type { LoaderData, Mood, WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { DemoBar, Peek, SuggestShelf } from "~/ui/prototype-rec-watch-next-3/kit3"
import { type Queue, useQueue } from "~/ui/prototype-rec-watch-next-3/model"
import { Tiers, byFit, byRank } from "~/ui/prototype-rec-watch-next-4/kit4"
import { ANY, type Sel } from "~/ui/prototype-rec-watch-next-4/select"
import { DISPLAY, Hero5, type M, THEN, WRAP } from "~/ui/prototype-rec-watch-next-5/kit5"
import { ANCHOR, PATH, apply5, fitting, suggest5 } from "~/ui/prototype-rec-watch-next-5/mood"
import type { Ctx6, Per } from "~/ui/prototype-rec-watch-next-6/kit6"
import { type Mix, NONE, toM } from "~/ui/prototype-rec-watch-next-6/mix"
import { CSS } from "~/ui/prototype-rec-watch-next-6/styles"
import { type VariantFn6, counts, docked, dots, drag, posters, thumb, words } from "~/ui/prototype-rec-watch-next-6/variants"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	// Round 3's loader and its process cache: no new queries.
	return json(await getWatchNext3(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" }]
export const meta = () => [{ title: "Watch next prototype, round 6 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	["wishlist", "country", "as"].some((k) => currentUrl.searchParams.get(k) !== nextUrl.searchParams.get(k))

const VARIANTS: Record<string, { name: string; look: "existing" | "bolder"; fn: VariantFn6 }> = {
	dots: { name: "Strip with swatches, folds to chips", look: "existing", fn: dots },
	words: { name: "A line of coloured chips", look: "existing", fn: words },
	counts: { name: "Swatches with counts, hover previews", look: "existing", fn: counts },
	posters: { name: "Poster chips", look: "bolder", fn: posters },
	drag: { name: "One bar, drag across to blend", look: "bolder", fn: drag },
	docked: { name: "Strip docked to the hero", look: "bolder", fn: docked },
	thumb: { name: "Bottom strip for the thumb", look: "existing", fn: thumb },
}

export default function WatchNextRound6() {
	const data = useLoaderData<typeof loader>() as unknown as LoaderData
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "dots"
	const v = VARIANTS[key] ?? VARIANTS.dots
	const low = key === "thumb"
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			{/* Remount on every switch so each variant starts from the same seeded queue and an open selection. */}
			<Page key={`${key}:${data.mode}:${data.wishlist.length}`} data={data} fn={v.fn} lift={low} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, x]) => [k, `${x.name} (${x.look})`]))}
				position={low ? "bottom-[18rem] right-2 scale-75 origin-bottom-right lg:bottom-36" : "bottom-32 right-2 scale-75 origin-bottom-right md:bottom-20"}
			/>
		</>
	)
}

function Page({ data, fn, lift }: { data: LoaderData; fn: VariantFn6; lift: boolean }) {
	const q = useQueue(data)
	const [sel, setSelRaw] = useState<Sel>(ANY)
	const [mix, setMixRaw] = useState<Mix>(NONE)
	const m: M = useMemo(() => toM(mix), [mix])
	// The hero and grid follow once a drag rests for a moment.
	const [settled, setSettled] = useState<M>(null)
	useEffect(() => {
		const id = setTimeout(() => setSettled(m), m === null ? 0 : 120)
		return () => clearTimeout(id)
	}, [m])
	const [pv, setPv] = useState<Mix | null>(null)
	const [passed, setPassed] = useState<string[]>([])
	const [pin, setPin] = useState<string | null>(null)
	const [peek, setPeek] = useState<string | null>(null)
	const [sims, setSims] = useState(0)

	const setSel = (s: Sel) => (setPin(null), setSelRaw(s))
	const setMix = (x: Mix) => (setPin(null), setMixRaw(x))
	const reset = () => (setPin(null), setSelRaw(ANY), setMixRaw(NONE), setPv(null))

	const shown = pv ? toM(pv) : settled
	const view = useMemo(() => apply5(q, sel, shown?.p ?? null, passed, pin), [q.order, sel, shown, passed, pin])
	const live = useMemo(() => fitting(apply5(q, sel, m?.p ?? null)), [q.order, sel, m])
	// Per mood: how many fit with the other choices, and the first of them (for poster chips).
	const per = useMemo(() => {
		const out = {} as Per
		for (const md of PATH as Mood[]) {
			const v = apply5(q, sel, ANCHOR[md])
			const fits = v.keys.filter((k) => v.fit.get(k) === v.need)
			const withArt = fits.map(q.T).find((t) => t?.backdrop)
			out[md] = { n: fits.length, top: (withArt ?? q.T(fits[0] ?? v.keys[0])) as WTitle | undefined }
		}
		return out
	}, [q.order, sel])
	const c: Ctx6 = { q, v: view, sel, setSel, m, setM: (x) => !x && setMix(NONE), n: live, reset, mix, setMix, pv, setPv, per }
	const first = view.keys[0] ? q.T(view.keys[0]) : undefined
	const offer = first ? undefined : suggest5(q, sel, shown?.p ?? null)
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
		<div className={`overflow-x-clip ${parts.dock ? "pb-72 lg:pb-48" : "pb-40"}`}>
			{parts.sticky}
			{parts.above && (
				<section className={`${WRAP} relative z-30 pb-4 pt-5 md:pt-6`} aria-label="Selection">
					{parts.above}
				</section>
			)}
			<Hero5 c={{ ...c, m: shown }} onPeek={onPeek} onPass={(k) => setPassed((p) => [...p.filter((x) => x !== k), k])} top={parts.top} eyebrow={parts.eyebrow} aside={parts.aside} offer={offer} />

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
			{parts.dock}
			<Peek q={peekQ} t={peek ? ((q.T(peek) as WTitle) ?? null) : null} onClose={() => setPeek(null)} />
			<RateDialog store={q} />
			<ToastBar store={q} />
			{/* The bottom strip needs the demo controls out of its way. */}
			<div className={lift ? "[&>div]:bottom-[14.5rem]! lg:[&>div]:bottom-[8.5rem]!" : ""}>
				<DemoBar signedIn={data.signedIn} mode={data.mode} count={q.count} onReset={q.reset} onSim={sim} />
			</div>
		</div>
	)
}
