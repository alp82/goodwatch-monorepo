// PROTOTYPE - throwaway (#369). The episode list on the show page: marking episodes, seasons and "up to here", the
// date of a watch, specials, progress, the show status, and how it all sits with Seen and the episode grid.
//   /prototype/episode-list?variant=A|B|C&show=supernatural|chernobyl|slow-horses|sherlock
//   optional: &scenario=fresh|watching|on_hold|dropped|all|seen_new  &today=2026-10-06  &sheet=1 (variant C)
// Three variants, switchable with the floating bar or the arrow keys. Episodes are TMDB snapshots committed as JSON
// (app/ui/prototype-episode-list/fixtures). Every mark stays in this browser's localStorage. The loader reads no
// database and the page calls no endpoint.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { useEffect } from "react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import chernobyl from "~/ui/prototype-episode-list/fixtures/chernobyl.json"
import sherlock from "~/ui/prototype-episode-list/fixtures/sherlock.json"
import slowHorses from "~/ui/prototype-episode-list/fixtures/slow-horses.json"
import supernatural from "~/ui/prototype-episode-list/fixtures/supernatural.json"
import { SCENARIOS, type Scenario, type Show } from "~/ui/prototype-episode-list/model"
import { BulkDialog, PrototypePanel, type SHOWS, ToastBar } from "~/ui/prototype-episode-list/parts"
import { StoreProvider, type VariantKey, useStore } from "~/ui/prototype-episode-list/store"
import { VariantA, VariantB, VariantC } from "~/ui/prototype-episode-list/variants"

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

export const meta = () => [{ title: "Episode list prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("show") !== nextUrl.searchParams.get("show") || currentUrl.searchParams.get("today") !== nextUrl.searchParams.get("today")

const VARIANTS: Record<VariantKey, string> = {
	A: "On the page, seasons fold open",
	B: "Next-episode card, season tabs",
	C: "Progress strip, list in a sheet",
}
const NOTES: Record<VariantKey, string[]> = {
	A: [
		"The list is its own section above the episode ratings; seasons fold open, the one with your next episode starts open.",
		"Status: once an episode is watched, On hold and Dropped are buttons beside Want to See and Seen; Not interested is gone. Neither pressed means Watching.",
		"Bulk marks (Mark season, Watched up to here in a row's ⋯) ask for the date first, with Don't know when preselected.",
	],
	B: [
		"The hero leads with a next-episode card: one press marks it. The status is a pill on that card that opens a menu.",
		"Dropped takes Not interested's place in the three buttons. The list and the episode ratings are two tabs of one section; seasons are tabs, rows carry stills.",
		"Bulk marks apply at once with no date, and the toast offers Set a date. Marking an episode past a gap offers Mark the earlier ones too.",
	],
	C: [
		"The page only carries progress and the next episode. The list opens in a sheet (a side panel on desktop) with every season in one scroll, opened at your next episode.",
		"Status: a three-way switch takes Not interested's row, and repeats in the sheet.",
		"Marking an episode past a gap asks in the row: this one, or everything up to here. Bulk marks ask for the date first.",
	],
}

function OpenSheetFromUrl() {
	const s = useStore()
	const [params] = useSearchParams()
	const wanted = params.get("sheet") === "1" && s.variant === "C"
	useEffect(() => {
		if (wanted) s.setSheet(true)
	}, [wanted])
	return null
}

export default function EpisodeListPrototype() {
	const { showKey, show, today } = useLoaderData<typeof loader>() as unknown as { showKey: keyof typeof SHOWS; show: Show; today: string }
	const [params] = useSearchParams()
	const asked = params.get("variant") ?? "A"
	const variant = (asked in VARIANTS ? asked : "A") as VariantKey
	const scenario = params.get("scenario") ?? ""
	return (
		<StoreProvider key={showKey} show={show} today={today} variant={variant} initial={scenario in SCENARIOS ? (scenario as Scenario) : null}>
			<div className="mx-auto max-w-6xl overflow-x-clip px-4 pb-40 pt-6 text-white sm:px-6 lg:px-8" data-variant={variant}>
				<h1 className="text-2xl font-bold">
					Episode list: {variant} <span className="font-normal text-gray-400">· {VARIANTS[variant]}</span>
				</h1>
				<ul className="mt-2 max-w-4xl list-disc space-y-0.5 pl-5 text-sm text-gray-400">
					{NOTES[variant].map((note) => (
						<li key={note}>{note}</li>
					))}
				</ul>
				<div className="mt-4">
					<PrototypePanel showKey={showKey} />
				</div>
				<div className="mt-8" key={variant}>
					{variant === "A" && <VariantA />}
					{variant === "B" && <VariantB />}
					{variant === "C" && <VariantC />}
				</div>
			</div>
			<OpenSheetFromUrl />
			<BulkDialog />
			<ToastBar />
			<PrototypeSwitcher variants={VARIANTS} position="top-[4.5rem] right-2 scale-75 origin-top-right md:top-auto md:right-auto md:scale-100 md:bottom-6 md:left-1/2 md:-translate-x-1/2" />
		</StoreProvider>
	)
}
