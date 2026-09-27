// PROTOTYPE - throwaway. Round 8 of Watch next (#176): the decided model from the ticket's Resolution.
// One interest signal (Want to See); "Watch next" is the top of the Wishlist under the chosen sort and moods.
// No manual order anywhere. Sorts: Best match (default), Waiting longest, Last added, Newest release, Top rated,
// Popular now. Desktop: round 6's docked strip with round 7's `grid` mood dropdown. Phone: the controls sit at
// the bottom and open a drawer sheet. The two variants differ only in that phone bar:
//   /prototype/rec-watch-next-8?variant=slab|float&wishlist=me|empty|few|many
// `me` (the default when signed in) reads your real Wishlist, ratings, and services, read-only. On localhost in
// development, ?as=<user uuid> reads that person instead. Every change stays in memory; nothing is written.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useMemo, useState } from "react"
import { getWatchNext7, type LoaderData7 } from "~/server/prototype-rec-watch-next-7.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { RateDialog, ToastBar } from "~/ui/prototype-rec-watch-next/kit"
import { type WTitle, onMine } from "~/ui/prototype-rec-watch-next-2/model"
import { useQueue } from "~/ui/prototype-rec-watch-next-3/model"
import { ANY } from "~/ui/prototype-rec-watch-next-4/select"
import { DISPLAY, Hero5, THEN, WRAP } from "~/ui/prototype-rec-watch-next-5/kit5"
import type { Ctx7 } from "~/ui/prototype-rec-watch-next-7/kit7"
import type { MoodKey } from "~/ui/prototype-rec-watch-next-7/moods"
import { grid } from "~/ui/prototype-rec-watch-next-7/variants"
import { type Sel7, fitCount, hits, moodWords, tiers7, toggleMood } from "~/ui/prototype-rec-watch-next-7/view"
import { type Ctx8, DemoBar8, Docked8, Eyebrow8, Peek8, Suggest8, Tiers8 } from "~/ui/prototype-rec-watch-next-8/kit8"
import { type BarKind, MobileControls } from "~/ui/prototype-rec-watch-next-8/mobile8"
import { CSS } from "~/ui/prototype-rec-watch-next-8/styles"
import { SORT8, START8, type Sel8, apply8, perMood8 } from "~/ui/prototype-rec-watch-next-8/view8"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getWatchNext7(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" }]
export const meta = () => [{ title: "Watch next prototype, round 8 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	["wishlist", "country", "as"].some((k) => currentUrl.searchParams.get(k) !== nextUrl.searchParams.get(k))

const VARIANTS: Record<BarKind, string> = { slab: "Phone bar merged with the site nav", float: "Phone capsule above the site nav" }

export default function WatchNextRound8() {
	const data = useLoaderData<typeof loader>() as unknown as LoaderData7
	const [params] = useSearchParams()
	const key = (params.get("variant") ?? "slab") as BarKind
	const kind: BarKind = key in VARIANTS ? key : "slab"
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			<Page key={`${data.mode}:${data.wishlist.length}`} data={data} kind={kind} />
			<PrototypeSwitcher variants={VARIANTS} position="top-[4.5rem] right-2 scale-75 origin-top-right md:top-auto md:bottom-20" />
		</>
	)
}

function Page({ data, kind }: { data: LoaderData7; kind: BarKind }) {
	const q = useQueue(data)
	const x = data.extra
	const [sel, setSel] = useState<Sel8>(START8)
	const [open, setOpen] = useState(false)
	const [blocked, setBlocked] = useState<Ctx7["blocked"]>(null)
	const [passed, setPassed] = useState<string[]>([])
	const [peek, setPeek] = useState<string | null>(null)
	const [sims, setSims] = useState(0)

	const tap = (m: MoodKey) => {
		const r = toggleMood(sel as unknown as Sel7, m)
		if (r.blocked) setBlocked({ m, at: Date.now() })
		else setSel(r.sel as unknown as Sel8)
	}
	const v = useMemo(() => apply8(q, x, sel, passed), [q.order, sel, passed])
	const per = useMemo(() => perMood8(q, x, sel, data.pool), [q.order, sel.everywhere])
	const c: Ctx8 = { q, x, sel, setSel, v, n: fitCount(v), per, tap, blocked, open, setOpen, services: data.services, reset: () => setSel(START8) }

	const first = v.keys[0] ? (q.T(v.keys[0]) as WTitle) : undefined
	const offer = first
		? undefined
		: (q.suggest.forYou(80).find((t) => (!sel.moods.length || hits(x, t.key, sel.moods) > 0) && (sel.everywhere || onMine(t))) ?? q.suggest.forYou(1)[0])

	// With the Then column showing the next three, the grid starts after them.
	const gridView = { ...v, keys: [v.keys[0], ...v.keys.slice(1 + THEN)].filter(Boolean) }
	const tiers = tiers7(gridView, sel as unknown as Sel7)
	const rest = gridView.keys.length > 1

	const onPeek = (t: { key: string }) => setPeek(t.key)
	const sim = () => {
		const pick = q.suggest.forYou(30)[sims % 30]
		setSims(sims + 1)
		if (pick) q.addQ(pick.key, "bottom")
	}
	const heroCtx = { q, v, sel: ANY, setSel: () => {}, m: null, setM: () => {}, n: c.n, reset: c.reset }
	const fitWords = sel.moods.length ? `${moodWords(sel.moods)}${sel.everywhere ? "" : " on your services"}` : "What's on your services"
	const by = SORT8[sel.by].label.toLowerCase()

	// The shared store words an add by queue position and names the old queue's top after a score. There is
	// no position here, and the next title is the top of the current sort.
	const next = (skip: string) => v.keys.find((k) => k !== skip)
	const store = {
		...q,
		toast: q.toast && { ...q.toast, text: q.toast.text.replace(/^(.*) is (up next|#\d+ on your Wishlist)$/, "Added $1 to your Wishlist") },
		score: (k: string, n: number | null) => {
			q.score(k, n)
			const up = next(k)
			const tail = up ? ` Watch next: ${q.T(up)?.title.replace(/\.$/, "")}.` : ""
			q.say(n == null ? `${q.T(k)?.title} moved to Seen.${tail}` : `Scored ${q.T(k)?.title} ${n}.${tail}`)
		},
	}

	return (
		<div className="overflow-x-clip pb-52 md:pb-40" data-by={sel.by}>
			<Hero5
				c={heroCtx}
				onPeek={onPeek}
				onPass={(k) => setPassed((p) => [...p.filter((y) => y !== k), k])}
				top={<Docked8 c={c} look={grid} />}
				eyebrow={first ? <Eyebrow8 c={c} t={first} /> : undefined}
				aside="then"
				offer={offer}
			/>

			<div className={`${WRAP} pt-8`}>
				{rest && (
					<header className="mb-6 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
						<span className="hidden md:block" />
						<div>
							<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>After that</h2>
							<p className="mt-1 text-sm text-gray-400">{v.need ? `${fitWords} first and largest, by ${by}; near misses follow, smaller.` : `The rest of your Wishlist, by ${by}. Each step further down gets smaller.`}</p>
						</div>
					</header>
				)}
				<Tiers8 c={c} tiers={tiers} onPeek={onPeek} />
				<Suggest8 q={q} onOpen={onPeek} className="mt-4" />
			</div>
			<div className={`${WRAP} mt-10 text-xs text-gray-500`}>
				Prototype. Changes stay on this page until you reload. Moods come from each title's fingerprint (from the title analysis) and genres. Sorts read stored fields: taste match, the time a title was added (the Wishlist entry's last update in this prototype), release or latest episode date, GoodWatch score, and TMDB popularity.
				{data.demoServices ? " Services shown are Netflix, Prime Video, and Disney+ for the demo." : ""}
			</div>
			<MobileControls c={c} kind={kind} />
			<Peek8 q={q} t={peek ? ((q.T(peek) as WTitle) ?? null) : null} onClose={() => setPeek(null)} />
			<RateDialog store={store} />
			<ToastBar store={store} bottom={kind === "slab" ? "bottom-40 md:bottom-6" : "bottom-44 md:bottom-6"} />
			<DemoBar8 signedIn={data.signedIn} mode={data.mode} count={q.count} onReset={q.reset} onSim={sim} />
		</div>
	)
}
