// PROTOTYPE - throwaway (#369, round 4). The owner liked the navigation of round 3's A and the scores in the rows of
// round 3's B, wants the two combined, wants the section to start small and go to detail by choice, and found the
// hollow-or-solid cells of round 3's C too weak a signal and its tiny cells hard to navigate.
//   /prototype/episode-list-4?variant=A|B|C|D&show=supernatural|chernobyl|slow-horses|sherlock
//   optional: &scenario=fresh|watching|on_hold|dropped|all|seen_new  &today=2026-10-06
//             &imdb=differs (simulates IMDb numbering a season differently)
//             &ratings=watched (holds back the ratings of episodes not watched yet)
//             &mark=line|tick|fade and &fit=cols|wrap|zoom (override the variant's watched mark and phone layout)
// One design (A) and three experiments around it (B, C, D), switchable with the floating bar or the arrow keys.
// The model, the store and the fixtures are round 1's, the hero is round 2's, the rows and the finder round 3's.
// Every mark stays in this browser's localStorage, shared with the earlier rounds. The loader reads no database and
// the page calls no endpoint.
import { type LoaderFunctionArgs, json } from "@remix-run/node"
import { Link, type ShouldRevalidateFunction, useLoaderData, useSearchParams } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { FITS, type Fit, MARKS, type Mark } from "~/ui/prototype-episode-list-4/matrix"
import { SETUPS, VariantA, VariantB, VariantC, VariantD } from "~/ui/prototype-episode-list-4/variants"
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

export const meta = () => [{ title: "Episode list prototype, round 4 · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) =>
	currentUrl.searchParams.get("show") !== nextUrl.searchParams.get("show") || currentUrl.searchParams.get("today") !== nextUrl.searchParams.get("today")

const VARIANTS = {
	A: "Matrix, line under watched",
	B: "Big cells, a tick in each",
	C: "One strip first",
	D: "Thin rows, watched faded",
} as const
type Key = keyof typeof VARIANTS
const NOTES: Record<Key, string[]> = {
	A: [
		"The design. The section starts as a small matrix: a row per season, a cell per episode in its rating's colour whether you've watched it or not, a white line under the cells you've watched, a white ring on your next one, then the count and the season score.",
		"Press a season row and its episodes open right under it as one-line rows with the rating; the other seasons stay as they are. Press a row for the still, the description and the date. On a phone the seasons stand in two columns so each is 40 pixels high and all fit on one screen.",
	],
	B: [
		"The watched mark as a tick in every watched cell instead of a line under them. A tick needs room, so on a phone every season gets two lines of twelve big cells, and each cell can be pressed to go to its episode.",
		"On a wide screen only the mark differs from A.",
	],
	C: [
		"How small is small: the section starts as one strip for the whole show, a block per season in the season score's colour with a line under it as far as you've watched. A press opens A's matrix, a season row opens the rows.",
		"For a show you don't track it starts at the matrix, which is the ratings overview.",
	],
	D: [
		"Watched cells fade and what's left keeps its full colour. On a phone all seasons are thin rows in one true matrix; the open season is enlarged and has arrows to the seasons beside it.",
		"On a wide screen the open season's rows stand beside the matrix instead of under the season's row.",
	],
}

const PILL = "rounded-full px-2.5 py-1 font-semibold"
const after = <T extends string>(all: Record<T, string>, now: T) => {
	const keys = Object.keys(all) as T[]
	return keys[(keys.indexOf(now) + 1) % keys.length]
}

export default function EpisodeListPrototype4() {
	const { showKey, show, today } = useLoaderData<typeof loader>() as unknown as { showKey: keyof typeof SHOWS; show: Show; today: string }
	const [params] = useSearchParams()
	const asked = params.get("variant") ?? "A"
	const variant = (asked in VARIANTS ? asked : "A") as Key
	const scenario = params.get("scenario") ?? ""
	const differs = params.get("imdb") === "differs"
	const held = params.get("ratings") === "watched"
	const askedMark = params.get("mark") ?? ""
	const askedFit = params.get("fit") ?? ""
	const mark: Mark = askedMark in MARKS ? (askedMark as Mark) : SETUPS[variant].mark
	const fit: Fit = askedFit in FITS ? (askedFit as Fit) : SETUPS[variant].fit
	const overridden = mark !== SETUPS[variant].mark || fit !== SETUPS[variant].fit
	const set = (change: Record<string, string | null>) => {
		const p = new URLSearchParams(params)
		for (const [name, value] of Object.entries(change)) value == null ? p.delete(name) : p.set(name, value)
		p.delete("scenario")
		return `?${p}`
	}
	return (
		// Round 1's store with its variant B rules: bulk marks apply at once and the toast offers the date; a mark
		// past a gap offers the earlier episodes.
		<StoreProvider key={showKey} show={show} today={today} variant="B" initial={scenario in SCENARIOS ? (scenario as Scenario) : null}>
			<div className="mx-auto max-w-6xl overflow-x-clip px-4 pb-40 pt-6 text-white sm:px-6 lg:px-8" data-variant={variant}>
				<h1 className="text-2xl font-bold">
					Episode list, round 4: {variant} <span className="font-normal text-gray-400">· {VARIANTS[variant]}</span>
				</h1>
				<ul className="mt-2 max-w-4xl list-disc space-y-0.5 pl-5 text-sm text-gray-400">
					{NOTES[variant].map((note) => (
						<li key={note}>{note}</li>
					))}
					<li>Same in every variant: round 2's hero, the finder (the magnifier on a phone: “9x14”, “s9e14”, part of a name), “Next” to your next episode, and plain rows with no matrix for a limited series.</li>
				</ul>
				<div className="mt-4">
					<PrototypePanel showKey={showKey} />
					<div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-white p-3 text-xs text-black ring-2 ring-fuchsia-500">
						<span className="font-bold">Round 4 switches</span>
						<Link to={set({ mark: after(MARKS, mark) })} replace preventScrollReset data-switch="mark" className={`${PILL} ${mark !== SETUPS[variant].mark ? "bg-black text-white" : "bg-neutral-200 hover:bg-neutral-300"}`}>
							Watched mark: {MARKS[mark]}
						</Link>
						<Link to={set({ fit: after(FITS, fit) })} replace preventScrollReset data-switch="fit" className={`${PILL} ${fit !== SETUPS[variant].fit ? "bg-black text-white" : "bg-neutral-200 hover:bg-neutral-300"}`}>
							Layout: {FITS[fit]}
						</Link>
						{overridden && (
							<Link to={set({ mark: null, fit: null })} replace preventScrollReset data-switch="reset" className="underline underline-offset-2">
								Back to {variant}'s own
							</Link>
						)}
						<Link to={set({ ratings: held ? null : "watched" })} replace preventScrollReset data-switch="ratings" className={`${PILL} ${held ? "bg-black text-white" : "bg-neutral-200 hover:bg-neutral-300"}`}>
							Ratings of unwatched episodes: {held ? "held back" : "shown"}
						</Link>
						<Link to={set({ imdb: differs ? null : "differs" })} replace preventScrollReset data-switch="imdb" className={`${PILL} ${differs ? "bg-amber-300" : "bg-neutral-200 hover:bg-neutral-300"}`}>
							IMDb numbers a season differently: {differs ? "on" : "off"}
						</Link>
						<Link to={`/prototype/episode-list-3?variant=B&show=${showKey}`} className="underline underline-offset-2">
							Round 3, variant B
						</Link>
					</div>
				</div>
				<div className="mt-8" key={variant}>
					{variant === "A" && <VariantA />}
					{variant === "B" && <VariantB />}
					{variant === "C" && <VariantC />}
					{variant === "D" && <VariantD />}
				</div>
			</div>
			<BulkDialog />
			<ToastBar />
			<PrototypeSwitcher variants={VARIANTS} position="bottom-[5.25rem] left-2 scale-75 origin-bottom-left md:left-1/2 md:bottom-6 md:scale-100 md:-translate-x-1/2" />
		</StoreProvider>
	)
}
