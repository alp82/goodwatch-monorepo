// PROTOTYPE - throwaway. Round 2 of Watch next (#176). The owner kept round 1's start-page hero and
// Tonight; this round replaces the "Recommended for you" grid below them with seven ways to grow and
// manage the Wishlist, from a near-empty list to one with hundreds of titles.
//   /prototype/rec-watch-next-2?variant=<key>&top=hero|tonight&wishlist=me|empty|few|many
// `me` (the default when signed in) reads your real Wishlist, ratings, and services, read-only.
// Every change stays in memory; nothing is written anywhere.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useState } from "react"
import { getWatchNext2 } from "~/server/prototype-rec-watch-next-2.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { HeroPeek, RateDialog, ToastBar } from "~/ui/prototype-rec-watch-next/kit"
import type { Title } from "~/ui/prototype-rec-watch-next/model"
import { DemoBar } from "~/ui/prototype-rec-watch-next-2/kit2"
import { type LoaderData, type TopKind, useWishlistStore } from "~/ui/prototype-rec-watch-next-2/model"
import { CSS } from "~/ui/prototype-rec-watch-next-2/styles"
import { HeroTop, TonightTop } from "~/ui/prototype-rec-watch-next-2/tops"
import { Duel, Swipe, Wall } from "~/ui/prototype-rec-watch-next-2/variants-bolder"
import { Backlog, ByService, Pipeline, Shelves, type VariantProps } from "~/ui/prototype-rec-watch-next-2/variants-existing"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getWatchNext2(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" }]
export const meta = () => [{ title: "Watch next prototype, round 2 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

// Only the Wishlist state and country need new data; variant and top switch on the client.
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("wishlist") !== nextUrl.searchParams.get("wishlist") || currentUrl.searchParams.get("country") !== nextUrl.searchParams.get("country")

const VARIANTS: Record<string, { name: string; look: "existing" | "bolder"; View: (p: VariantProps) => JSX.Element }> = {
	shelves: { name: "Shelves", look: "existing", View: Shelves },
	backlog: { name: "Backlog grid", look: "existing", View: Backlog },
	"by-service": { name: "By service", look: "existing", View: ByService },
	pipeline: { name: "Pipeline", look: "existing", View: Pipeline },
	duel: { name: "This or that", look: "bolder", View: Duel },
	swipe: { name: "Swipe deck", look: "bolder", View: Swipe },
	wall: { name: "Poster wall", look: "bolder", View: Wall },
}

export default function WatchNextRound2() {
	const data = useLoaderData<typeof loader>() as unknown as LoaderData
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "shelves"
	const v = VARIANTS[key] ?? VARIANTS.shelves
	const top: TopKind = params.get("top") === "tonight" ? "tonight" : "hero"
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			{/* Remount on every switch so each combination starts from the same seeded state. */}
			<Page key={`${key}:${top}:${data.mode}:${data.titles.length}`} data={data} v={v} top={top} />
			<DemoBar signedIn={data.signedIn} mode={data.mode} top={top} count={data.wishlist.length} />
			<PrototypeSwitcher
				variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, x]) => [k, `${x.name} (${x.look})`]))}
				position="top-[4.5rem] right-2 scale-75 origin-top-right"
			/>
		</>
	)
}

function Page({ data, v, top }: { data: LoaderData; v: (typeof VARIANTS)[string]; top: TopKind }) {
	const store = useWishlistStore(data, top === "tonight" ? 3 : 5, top === "tonight" ? "top" : "end")
	const [peek, setPeek] = useState<Title | null>(null)
	const Top = top === "tonight" ? TonightTop : HeroTop
	return (
		<div className="overflow-x-clip pb-40">
			<Top store={store} onPeek={setPeek} />
			<v.View store={store} data={data} onPeek={setPeek} />
			<div className="mx-auto mt-10 max-w-7xl px-4 text-xs text-gray-500 sm:px-6 lg:px-8">
				Prototype. Changes stay on this page until you reload. Leaving dates are simulated.{data.demoServices ? " Services shown are Netflix, Prime Video, and Disney+ for the demo." : ""}
			</div>
			<HeroPeek title={peek} store={store} onClose={() => setPeek(null)} />
			<RateDialog store={store} />
			<ToastBar store={store} />
		</div>
	)
}
