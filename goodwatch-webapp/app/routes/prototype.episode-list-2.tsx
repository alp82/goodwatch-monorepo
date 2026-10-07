// PROTOTYPE - throwaway (#369, round 2). The owner picked round 1's variant B and asked for other ways to lay out
// the content area, which stacked a tab bar (Your episodes | Episode ratings) on a season sub-navigation, and for
// one score control instead of two when the show is watched through.
//   /prototype/episode-list-2?variant=A|B|C|D|E&show=supernatural|chernobyl|slow-horses|sherlock
//   optional: &scenario=fresh|watching|on_hold|dropped|all|seen_new  &today=2026-10-06
//             &imdb=differs (simulates IMDb numbering a season differently)  &sheet=1 (variant E)
// Five variants of the content area under one fixed hero, switchable with the floating bar or the arrow keys. The
// model, the store, the rows and the fixtures are round 1's (app/ui/prototype-episode-list); round 1 stays at
// /prototype/episode-list. Every mark stays in this browser's localStorage, shared with round 1. The loader reads
// no database and the page calls no endpoint.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { Link, type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { startTransition, useEffect } from "react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { VariantA, VariantB, VariantC, VariantD, VariantE } from "~/ui/prototype-episode-list-2/variants"
import chernobyl from "~/ui/prototype-episode-list/fixtures/chernobyl.json"
import sherlock from "~/ui/prototype-episode-list/fixtures/sherlock.json"
import slowHorses from "~/ui/prototype-episode-list/fixtures/slow-horses.json"
import supernatural from "~/ui/prototype-episode-list/fixtures/supernatural.json"
import { SCENARIOS, type Scenario, type Show } from "~/ui/prototype-episode-list/model"
import { BulkDialog, PrototypePanel, type SHOWS, ToastBar } from "~/ui/prototype-episode-list/parts"
import { StoreProvider, useStore } from "~/ui/prototype-episode-list/store"

const FIXTURES: Record<string, unknown> = { supernatural, chernobyl, "slow-horses": slowHorses, sherlock }

export async function loader({ request }: LoaderFunctionArgs) {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	const params = new URL(request.url).searchParams
	const key = params.get("show") ?? ""
	const showKey = key in FIXTURES ? key : "supernatural"
	const asked = params.get("today") ?? ""
	const today = /^\d{4}-\d{2}-\d{2}$/.test(asked) ? asked : new Date().toISOString().slice(0, 10)
	return json({ showKey, show: FIXTURES[showKey] as Show, today })
}

export const meta = () => [{ title: "Episode list prototype, round 2 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("show") !== nextUrl.searchParams.get("show") || currentUrl.searchParams.get("today") !== nextUrl.searchParams.get("today")

const VARIANTS = {
	A: "One scroll, season scrubber",
	B: "Season rail",
	C: "Season cards",
	D: "One grid: ratings are the marks",
	E: "Ratings on the page, list in a sheet",
} as const
type Key = keyof typeof VARIANTS
const NOTES: Record<Key, string[]> = {
	A: [
		"Every season in one scroll under sticky season headers. The strip that sticks above them has one segment per season, as wide as the season is long and filled as far as you've watched: press one to jump, or drag along it.",
		"Seasons you had watched through when the page opened, and the specials, start folded to one line. The ratings are their own section above the list.",
	],
	B: [
		"Desktop: a rail of seasons, each with its count and its season score, and the picked season beside it. Phone: one bar that names the season, with arrows either side, and opens the same rail as a sheet.",
		"The rail is the only navigation. The ratings are their own section below.",
	],
	C: [
		"Each season is a card: a progress ring, the season score, and a strip with one sliver per episode in its rating's colour. A card opens its episodes in the row under it; the season with your next episode starts open.",
		"The ratings stay as their own section below. A show with one season has no cards.",
	],
	D: [
		"One object instead of two: the rating tiles are the marks. A press picks a tile and the row above the grid shows that episode (the same row as in the list); a press on the picked tile marks it. A season label picks the season, to mark it whole.",
		"The rows are TMDB's episodes and the numbers on the tiles are IMDb's ratings looked up by season and number. Switch on “IMDb numbers a season differently” below to see what that does.",
	],
	E: [
		"The page keeps the ratings alone. The list opens from the hero box in a sheet (a side panel on desktop): every season in one scroll with the scrubber, opened at your next episode.",
		"Round 1's variant C idea under B's hero. The hero box gets one more row, “All episodes”.",
	],
}

function OpenSheetFromUrl({ variant }: { variant: Key }) {
	const s = useStore()
	const [params] = useSearchParams()
	const wanted = params.get("sheet") === "1" && variant === "E"
	useEffect(() => {
		// A transition, because the page around it may still be hydrating.
		startTransition(() => s.setSheet(wanted))
	}, [wanted])
	return null
}

export default function EpisodeListPrototype2() {
	const { showKey, show, today } = useLoaderData<typeof loader>() as unknown as { showKey: keyof typeof SHOWS; show: Show; today: string }
	const [params] = useSearchParams()
	const asked = params.get("variant") ?? "A"
	const variant = (asked in VARIANTS ? asked : "A") as Key
	const scenario = params.get("scenario") ?? ""
	const differs = params.get("imdb") === "differs"
	const toggled = new URLSearchParams(params)
	differs ? toggled.delete("imdb") : toggled.set("imdb", "differs")
	toggled.delete("scenario")
	return (
		// Round 1's store with its variant B rules: bulk marks apply at once and the toast offers the date; a mark
		// past a gap offers the earlier episodes.
		<StoreProvider key={showKey} show={show} today={today} variant="B" initial={scenario in SCENARIOS ? (scenario as Scenario) : null}>
			<div className="mx-auto max-w-6xl overflow-x-clip px-4 pb-40 pt-6 text-white sm:px-6 lg:px-8" data-variant={variant}>
				<h1 className="text-2xl font-bold">
					Episode list, round 2: {variant} <span className="font-normal text-gray-400">· {VARIANTS[variant]}</span>
				</h1>
				<ul className="mt-2 max-w-4xl list-disc space-y-0.5 pl-5 text-sm text-gray-400">
					{NOTES[variant].map((note) => (
						<li key={note}>{note}</li>
					))}
					<li>Same in every variant: round 1's hero B, and one score control. Watch a show through (start from “All aired watched”, then press Watched) and the control's heading becomes the question.</li>
				</ul>
				<div className="mt-4">
					<PrototypePanel showKey={showKey} />
					<p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
						<Link to={`?${toggled}`} replace preventScrollReset className={`rounded-full px-2.5 py-1 font-semibold ${differs ? "bg-amber-300 text-black" : "bg-white/10 text-gray-100 hover:bg-white/20"}`}>
							IMDb numbers a season differently: {differs ? "on" : "off"}
						</Link>
						<span>Simulated: IMDb counts the first season's two-part opener as one episode. Look at D, then at the ratings in the others.</span>
						<Link to={`/prototype/episode-list?variant=B&show=${showKey}`} className="underline underline-offset-2 hover:text-white">
							Round 1, variant B
						</Link>
					</p>
				</div>
				<div className="mt-8" key={variant}>
					{variant === "A" && <VariantA />}
					{variant === "B" && <VariantB />}
					{variant === "C" && <VariantC />}
					{variant === "D" && <VariantD />}
					{variant === "E" && <VariantE />}
				</div>
			</div>
			<OpenSheetFromUrl variant={variant} />
			<BulkDialog />
			<ToastBar />
			<PrototypeSwitcher variants={VARIANTS} position="bottom-[5.25rem] left-2 scale-75 origin-bottom-left md:left-1/2 md:bottom-6 md:scale-100 md:-translate-x-1/2" />
		</StoreProvider>
	)
}
