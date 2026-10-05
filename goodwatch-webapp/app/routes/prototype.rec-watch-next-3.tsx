// PROTOTYPE - throwaway. Round 3 of Watch next (#176). Owner decision after round 2: Want to See is the only
// interest signal. The Wishlist is one ordered priority queue and "Watch next" is simply its top, shown by
// round 2's unchanged start hero. Below it, six ways to live with that order, from an empty list to hundreds.
//   /prototype/rec-watch-next-3?variant=<key>&wishlist=me|empty|few|many
// `me` (the default when signed in) reads your real Wishlist, ratings, and services, read-only. On localhost in
// development, ?as=<user uuid> reads that person instead. Every change stays in memory; nothing is written.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useRef, useState } from "react"
import { getWatchNext3 } from "~/server/prototype-rec-watch-next-3.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { RateDialog, ToastBar } from "~/ui/prototype-rec-watch-next/kit"
import type { LoaderData, Store2, WTitle } from "~/ui/prototype-rec-watch-next-2/model"
import { HeroTop } from "~/ui/prototype-rec-watch-next-2/tops"
import { DemoBar, EmptyHero, Peek } from "~/ui/prototype-rec-watch-next-3/kit3"
import { type Queue, useQueue } from "~/ui/prototype-rec-watch-next-3/model"
import { CSS } from "~/ui/prototype-rec-watch-next-3/styles"
import { Evenings, WhichFirst } from "~/ui/prototype-rec-watch-next-3/variants-bolder"
import { AutoPlaced, Posters, Ranked, SortTonight, type VariantProps } from "~/ui/prototype-rec-watch-next-3/variants-existing"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getWatchNext3(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" }]
export const meta = () => [{ title: "Watch next prototype, round 3 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

// Only the Wishlist state, person, and country need new data; the variant switches on the client.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	["wishlist", "country", "as"].some((k) => currentUrl.searchParams.get(k) !== nextUrl.searchParams.get(k))

type Enter = "bottom" | "auto" | "ask"
const VARIANTS: Record<string, { name: string; look: "existing" | "bolder"; enter: Enter; View: (p: VariantProps) => JSX.Element }> = {
	ranked: { name: "Ranked list", look: "existing", enter: "bottom", View: Ranked },
	posters: { name: "Numbered posters", look: "existing", enter: "bottom", View: Posters },
	auto: { name: "Auto-placed", look: "existing", enter: "auto", View: AutoPlaced },
	sort: { name: "Sort for tonight", look: "existing", enter: "bottom", View: SortTonight },
	"which-first": { name: "Which first?", look: "bolder", enter: "ask", View: WhichFirst },
	evenings: { name: "Evenings ahead", look: "bolder", enter: "bottom", View: Evenings },
}

export default function WatchNextRound3() {
	const data = useLoaderData<typeof loader>() as unknown as LoaderData
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "ranked"
	const v = VARIANTS[key] ?? VARIANTS.ranked
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			{/* Remount on every switch so each variant starts from the same seeded queue. */}
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
	const [peek, setPeek] = useState<string | null>(null)
	const sims = useRef(0)
	const below = useRef<HTMLDivElement>(null)
	const onPeek = (t: { key: string }) => setPeek(t.key)

	// Stands in for a Want to See tap on another page: the next best suggestion enters the way this variant enters titles.
	const sim = () => {
		const pick = q.suggest.forYou(30)[sims.current++ % 30]
		if (!pick) return
		if (v.enter === "ask" && q.count >= 2) q.setPending(pick.key)
		else q.addQ(pick.key, v.enter === "auto" ? "auto" : q.count === 0 ? "top" : "bottom")
		below.current?.scrollIntoView({ behavior: "smooth", block: "start" })
	}

	return (
		<div className="overflow-x-clip pb-40">
			{q.count > 0 ? <HeroTop store={q as unknown as Store2} onPeek={onPeek} /> : <EmptyHero q={q} onPeek={onPeek} />}
			<div ref={below} className="scroll-mt-16">
				<v.View q={q as Queue} onPeek={onPeek} />
			</div>
			<div className="mx-auto mt-10 max-w-7xl px-4 text-xs text-gray-500 sm:px-6 lg:px-8">
				Prototype. Changes stay on this page until you reload. Leaving dates are simulated.{data.demoServices ? " Services shown are Netflix, Prime Video, and Disney+ for the demo." : ""}
			</div>
			<Peek q={q} t={peek ? (q.T(peek) as WTitle) ?? null : null} onClose={() => setPeek(null)} />
			<RateDialog store={q} />
			<ToastBar store={q} />
			<DemoBar signedIn={data.signedIn} mode={data.mode} count={q.count} onReset={q.reset} onSim={sim} />
		</div>
	)
}
