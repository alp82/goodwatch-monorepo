// PROTOTYPE - throwaway. Round 7 of Watch next (#176). Owner on round 6: keep `docked`; the poster chips
// become a dropdown (picked moods show in the strip, all of them open on a tap), simple toggles up to three,
// a reworked mood list built from the title data, no length, "On my services" on by default, and sort views
// that never replace the saved order. Four variants differ only in how the dropdown and the picked chips look.
//   /prototype/rec-watch-next-7?variant=grid|list|carousel|sheet&wishlist=me|empty|few|many
// `me` (the default when signed in) reads your real Wishlist, ratings, and services, read-only. On localhost in
// development, ?as=<user uuid> reads that person instead. Every change stays in memory; nothing is written.
import { json, type LinksFunction, type LoaderFunctionArgs } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useMemo, useState } from "react"
import { getWatchNext7, type LoaderData7 } from "~/server/prototype-rec-watch-next-7.server"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { RateDialog, ToastBar } from "~/ui/prototype-rec-watch-next/kit"
import { type WTitle, onMine } from "~/ui/prototype-rec-watch-next-2/model"
import { DemoBar, Peek, SuggestShelf } from "~/ui/prototype-rec-watch-next-3/kit3"
import { type Queue, useQueue } from "~/ui/prototype-rec-watch-next-3/model"
import { Tiers } from "~/ui/prototype-rec-watch-next-4/kit4"
import { ANY } from "~/ui/prototype-rec-watch-next-4/select"
import { DISPLAY, Hero5, THEN, WRAP } from "~/ui/prototype-rec-watch-next-5/kit5"
import { type Ctx7, Docked7, Eyebrow, type Look } from "~/ui/prototype-rec-watch-next-7/kit7"
import type { MoodKey } from "~/ui/prototype-rec-watch-next-7/moods"
import { CSS } from "~/ui/prototype-rec-watch-next-7/styles"
import { carousel, grid, list, sheet } from "~/ui/prototype-rec-watch-next-7/variants"
import { SORT, START, type Sel7, apply7, fitCount, hits, moodWords, perMood, tiers7, toggleMood } from "~/ui/prototype-rec-watch-next-7/view"

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return json(await getWatchNext7(request))
}

export const links: LinksFunction = () => [{ rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Gabarito:wght@400..900&display=swap" }]
export const meta = () => [{ title: "Watch next prototype, round 7 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	["wishlist", "country", "as"].some((k) => currentUrl.searchParams.get(k) !== nextUrl.searchParams.get(k))

const VARIANTS: Record<string, Look> = { grid, list, carousel, sheet }

export default function WatchNextRound7() {
	const data = useLoaderData<typeof loader>() as unknown as LoaderData7
	const [params] = useSearchParams()
	const key = params.get("variant") ?? "grid"
	const look = VARIANTS[key] ?? grid
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: CSS }} />
			{/* Remount on every switch so each variant starts from the same seeded queue and selection. */}
			<Page key={`${key}:${data.mode}:${data.wishlist.length}`} data={data} look={look} />
			<PrototypeSwitcher variants={Object.fromEntries(Object.entries(VARIANTS).map(([k, x]) => [k, x.name]))} position="bottom-32 right-2 scale-75 origin-bottom-right md:bottom-20" />
		</>
	)
}

function Page({ data, look }: { data: LoaderData7; look: Look }) {
	const q = useQueue(data)
	const x = data.extra
	const [sel, setSelRaw] = useState<Sel7>(START)
	const [open, setOpen] = useState(false)
	const [blocked, setBlocked] = useState<Ctx7["blocked"]>(null)
	const [passed, setPassed] = useState<string[]>([])
	const [pin, setPin] = useState<string | null>(null)
	const [peek, setPeek] = useState<string | null>(null)
	const [sims, setSims] = useState(0)

	const setSel = (s: Sel7) => (setPin(null), setSelRaw(s))
	const tap = (m: MoodKey) => {
		const r = toggleMood(sel, m)
		if (r.blocked) setBlocked({ m, at: Date.now() })
		else setSel(r.sel)
	}
	const v = useMemo(() => apply7(q, x, sel, passed, pin), [q.order, sel, passed, pin])
	const per = useMemo(() => perMood(q, x, sel, data.pool), [q.order, sel.everywhere, sel.by])
	const c: Ctx7 = { q, x, sel, setSel, v, n: fitCount(v), per, tap, blocked, open, setOpen, services: data.services, reset: () => setSel(START) }

	const first = v.keys[0] ? (q.T(v.keys[0]) as WTitle) : undefined
	const offer = first
		? undefined
		: (q.suggest.forYou(80).find((t) => (!sel.moods.length || hits(x, t.key, sel.moods) > 0) && (sel.everywhere || onMine(t))) ?? q.suggest.forYou(1)[0])

	// With the Then column showing the next three, the grid starts after them.
	const gridView = { ...v, keys: [v.keys[0], ...v.keys.slice(1 + THEN)].filter(Boolean) }
	const tiers = tiers7(gridView, sel)
	const rest = gridView.keys.length > 1

	const onPeek = (t: { key: string }) => setPeek(t.key)
	// "Play this next" from a peek is a deliberate move in the saved order, the one place it changes here.
	const peekQ = { ...q, toTop: (k: string) => (q.toTop(k), setPin(k)), addQ: (k: string, how: Parameters<Queue["addQ"]>[1]) => (q.addQ(k, how), how === "top" && setPin(k)) } as Queue
	const sim = () => {
		const pick = q.suggest.forYou(30)[sims % 30]
		setSims(sims + 1)
		if (pick) q.addQ(pick.key, q.count === 0 ? "top" : "bottom")
	}
	// Round 5's hero reads a round-4 selection; the eyebrow here replaces everything it would say with it.
	const heroCtx = { q, v, sel: ANY, setSel: () => {}, m: null, setM: () => {}, n: c.n, reset: c.reset }
	const fitWords = sel.moods.length ? `${moodWords(sel.moods)}${sel.everywhere ? "" : " on your services"}` : "What's on your services"
	const sortNote = sel.by === "mine" ? "in your order" : `sorted by ${SORT[sel.by].label.toLowerCase()} for now`

	return (
		<div className="overflow-x-clip pb-40" data-saved-order={q.order.slice(0, 12).join(",")}>
			<Hero5
				c={heroCtx}
				onPeek={onPeek}
				onPass={(k) => setPassed((p) => [...p.filter((y) => y !== k), k])}
				top={<Docked7 c={c} look={look} />}
				eyebrow={first ? <Eyebrow c={c} t={first} /> : undefined}
				aside="then"
				offer={offer}
			/>

			<div className={`${WRAP} pt-8`}>
				{rest && (
					<header className="mb-6 md:grid md:grid-cols-[12rem_1fr] md:gap-8">
						<span className="hidden md:block" />
						<div>
							<h2 className={`${DISPLAY} text-2xl text-white md:text-3xl`}>After that</h2>
							<p className="mt-1 text-sm text-gray-400">
								{v.need ? `${fitWords} first and largest, ${sortNote}; near misses follow, smaller.` : `The rest of your Wishlist, ${sortNote}. Each step further down gets smaller.`}
							</p>
						</div>
					</header>
				)}
				<Tiers q={q} tiers={tiers} onPeek={onPeek} />
				<SuggestShelf q={q} onOpen={onPeek} className="mt-4" />
			</div>
			<div className={`${WRAP} mt-10 text-xs text-gray-500`}>
				Prototype. Changes stay on this page until you reload. Moods come from each title's fingerprint (from the title analysis) and genres; sort views use stored scores, dates and popularity. No view changes your order.
				{data.demoServices ? " Services shown are Netflix, Prime Video, and Disney+ for the demo." : ""}
			</div>
			<Peek q={peekQ} t={peek ? ((q.T(peek) as WTitle) ?? null) : null} onClose={() => setPeek(null)} />
			<RateDialog store={q} />
			<ToastBar store={q} />
			<DemoBar signedIn={data.signedIn} mode={data.mode} count={q.count} onReset={q.reset} onSim={sim} />
		</div>
	)
}
