// PROTOTYPE - throwaway (#369, round 3). The owner picked round 2's variant B (the season rail) and said it still
// uses a lot of space, that drilling down has to be quicker, and that ratings and watches might combine in a
// meaningful way or might overwhelm.
//   /prototype/episode-list-3?variant=A|B|C&show=supernatural|chernobyl|slow-horses|sherlock
//   optional: &scenario=fresh|watching|on_hold|dropped|all|seen_new  &today=2026-10-06
//             &imdb=differs (simulates IMDb numbering a season differently)
//             &ratings=watched (holds back the ratings of episodes not watched yet)
// Three dense variants of the season rail under round 2's hero, from ratings kept apart (A) to the ratings grid as
// the navigation (C), switchable with the floating bar or the arrow keys. The model, the store and the fixtures are
// round 1's (app/ui/prototype-episode-list), the hero is round 2's (app/ui/prototype-episode-list-2). Every mark
// stays in this browser's localStorage, shared with rounds 1 and 2. The loader reads no database and the page calls
// no endpoint.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { Link, type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { VariantA, VariantB, VariantC } from "~/ui/prototype-episode-list-3/variants"
import chernobyl from "~/ui/prototype-episode-list/fixtures/chernobyl.json"
import sherlock from "~/ui/prototype-episode-list/fixtures/sherlock.json"
import slowHorses from "~/ui/prototype-episode-list/fixtures/slow-horses.json"
import supernatural from "~/ui/prototype-episode-list/fixtures/supernatural.json"
import { SCENARIOS, type Scenario, type Show } from "~/ui/prototype-episode-list/model"
import { BulkDialog, PrototypePanel, type SHOWS, ToastBar } from "~/ui/prototype-episode-list/parts"
import { StoreProvider } from "~/ui/prototype-episode-list/store"

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

export const meta = () => [{ title: "Episode list prototype, round 3 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("show") !== nextUrl.searchParams.get("show") || currentUrl.searchParams.get("today") !== nextUrl.searchParams.get("today")

const VARIANTS = {
	A: "Light: rail with rating strips",
	B: "Medium: rating in every row",
	C: "Full: the grid is the navigation",
} as const
type Key = keyof typeof VARIANTS
const NOTES: Record<Key, string[]> = {
	A: [
		"Ratings stay out of the rows. Each season in the rail has a strip with one sliver per episode, solid where you've watched and hollow where you haven't, in the rating's colour, beside the season score. On a phone the seasons are squares you can all see at once.",
		"The list is one line per episode in a box of fixed height that scrolls inside the page, opened at your next episode. The ratings grid is still its own section below.",
	],
	B: [
		"Every row carries its rating as a small tile. The seasons are one line of chips with season score and progress; it sticks under the site bar on a phone. The ratings grid folds to a link.",
		"No box that scrolls: two columns on a wide screen, and on a phone a window of eight rows around your next episode with the rest folded into one line above and one below.",
	],
	C: [
		"The grid is the navigation: one cell per episode, solid where watched and hollow where not. A press on a cell opens that episode's row, with its tick, beside the grid (below it on a phone). The arrow keys walk the cells.",
		"The cells are TMDB's episodes, so a rating appears only where IMDb's episode could be matched. The separate ratings grid folds to a link.",
	],
}

const PILL = "rounded-full px-2.5 py-1 font-semibold"

export default function EpisodeListPrototype3() {
	const { showKey, show, today } = useLoaderData<typeof loader>() as unknown as { showKey: keyof typeof SHOWS; show: Show; today: string }
	const [params] = useSearchParams()
	const asked = params.get("variant") ?? "A"
	const variant = (asked in VARIANTS ? asked : "A") as Key
	const scenario = params.get("scenario") ?? ""
	const differs = params.get("imdb") === "differs"
	const held = params.get("ratings") === "watched"
	const flip = (name: string, value: string, on: boolean) => {
		const p = new URLSearchParams(params)
		on ? p.delete(name) : p.set(name, value)
		p.delete("scenario")
		return `?${p}`
	}
	return (
		// Round 1's store with its variant B rules: bulk marks apply at once and the toast offers the date; a mark
		// past a gap offers the earlier episodes.
		<StoreProvider key={showKey} show={show} today={today} variant="B" initial={scenario in SCENARIOS ? (scenario as Scenario) : null}>
			<div className="mx-auto max-w-6xl overflow-x-clip px-4 pb-40 pt-6 text-white sm:px-6 lg:px-8" data-variant={variant}>
				<h1 className="text-2xl font-bold">
					Episode list, round 3: {variant} <span className="font-normal text-gray-400">· {VARIANTS[variant]}</span>
				</h1>
				<ul className="mt-2 max-w-4xl list-disc space-y-0.5 pl-5 text-sm text-gray-400">
					{NOTES[variant].map((note) => (
						<li key={note}>{note}</li>
					))}
					<li>Same in every variant: round 2's hero, one-line rows that open in place, a finder (“9x14”, “s9e14”, part of a name), a jump to your next episode, and no season navigation for a limited series.</li>
				</ul>
				<div className="mt-4">
					<PrototypePanel showKey={showKey} />
					<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-white p-3 text-xs text-black ring-2 ring-fuchsia-500">
						<span className="font-bold">Round 3 switches</span>
						<Link to={flip("ratings", "watched", held)} replace preventScrollReset data-switch="ratings" className={`${PILL} ${held ? "bg-black text-white" : "bg-neutral-200 hover:bg-neutral-300"}`}>
							Ratings of unwatched episodes: {held ? "held back" : "shown"}
						</Link>
						<Link to={flip("imdb", "differs", differs)} replace preventScrollReset data-switch="imdb" className={`${PILL} ${differs ? "bg-amber-300" : "bg-neutral-200 hover:bg-neutral-300"}`}>
							IMDb numbers a season differently: {differs ? "on" : "off"}
						</Link>
						<span className="text-neutral-600">Simulated: IMDb counts the first season's two-part opener as one episode. Open season 1.</span>
						<Link to={`/prototype/episode-list-2?variant=B&show=${showKey}`} className="underline underline-offset-2">
							Round 2, variant B
						</Link>
					</div>
				</div>
				<div className="mt-8" key={variant}>
					{variant === "A" && <VariantA />}
					{variant === "B" && <VariantB />}
					{variant === "C" && <VariantC />}
				</div>
			</div>
			<BulkDialog />
			<ToastBar />
			<PrototypeSwitcher variants={VARIANTS} position="bottom-[5.25rem] left-2 scale-75 origin-bottom-left md:left-1/2 md:bottom-6 md:scale-100 md:-translate-x-1/2" />
		</StoreProvider>
	)
}
