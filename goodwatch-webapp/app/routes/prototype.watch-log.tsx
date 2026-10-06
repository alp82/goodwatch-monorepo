// PROTOTYPE - throwaway (issue #370). The watch log of a film and what Seen does once a watch has a date.
//   /prototype/watch-log?variant=A|B|C&remove=latest|all|log&order=dated|recorded&film=<sample>
// Three variants of the Seen control and of where the log lives, on copies of the title page's action area, the poster
// card's row of actions, and Watch next's "I watched it". Every watch stays in this browser (localStorage key
// "PROTOTYPE-watch-log-wipe-me"); the route has no data of its own and calls no endpoint.
import { type ShouldRevalidateFunction, useSearchParams } from "@remix-run/react"
import { startTransition, useEffect, useState } from "react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { FILMS, type OrderMode, type RemoveMode, type VariantKey } from "~/ui/prototype-watch-log/model"
import { StoreProvider } from "~/ui/prototype-watch-log/store"
import { CardsSection, FilmPicker, HeroSection, Section, StatePanel, Toast, WatchNextSection } from "~/ui/prototype-watch-log/surfaces"

export async function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [{ title: "Watch log prototype · GoodWatch" }, { name: "robots", content: "noindex, nofollow" }]
export const shouldRevalidate: ShouldRevalidateFunction = () => false

const VARIANTS: Record<VariantKey, string> = {
	A: "Split button, log under the actions",
	B: "Plain button, follow-up strip, log always shown",
	C: "Seen opens the log",
}
// What pressing Seen again does by default in each variant.
const DEFAULT_REMOVE: Record<VariantKey, RemoveMode> = { A: "log", B: "log", C: "log" }

const HERO_NOTE: Record<VariantKey, string> = {
	A: "One tap on Seen records a watch for now. The arrow beside it opens the date choice (Just now, Yesterday, Another day, Don't know when), before the first watch and for every later one. Under the actions a line sums the watches up and opens the log.",
	B: "One tap on Seen records a watch for now, and a strip under the actions offers to correct it; it never blocks. The log is always there under the actions, and adding an earlier or a second watch happens in it.",
	C: "One tap on Seen records a watch for now; the toast offers Change date. Once the film is Seen the button stops being a toggle: it opens the log (a popover here, a sheet on phones), where watches are added, changed and deleted.",
}
const CARD_NOTE: Record<VariantKey, string> = {
	A: "The row has no room for a second button, so the eye is one tap for now and the toast carries Change date. A film with several watches shows the count on the eye. Pressing the eye again follows the switch above; when it can't just remove, it opens the log in a popover.",
	B: "The same card in every variant except for what pressing the eye again does: here it follows the switch above. The phone sheet shows this variant's full control.",
	C: "The eye is one tap for now; once Seen it opens the log in a popover (a sheet on phones), whatever the switch says.",
}
const NEXT_NOTE: Record<VariantKey, string> = {
	A: "I watched it records a watch for now, as today. The dialog that asks for the score gains one line: Watched today, Change.",
	B: "I watched it records a watch for now, as today. The dialog that asks for the score shows the date choice open, with Just now chosen.",
	C: "I watched it records a watch for now, as today. The dialog that asks for the score gains one line: Watched today, Change.",
}

export default function WatchLogPrototype() {
	const [params] = useSearchParams()
	const key = (params.get("variant") ?? "A") as VariantKey
	const variant: VariantKey = key in VARIANTS ? key : "A"
	const removeParam = params.get("remove") as RemoveMode | null
	const remove: RemoveMode = removeParam && ["latest", "all", "log"].includes(removeParam) ? removeParam : DEFAULT_REMOVE[variant]
	const order: OrderMode = params.get("order") === "recorded" ? "recorded" : "dated"
	const film = FILMS.find((sample) => sample.id === params.get("film")) ?? FILMS[3]
	// The samples are dated from "now" and the store reads localStorage, so the page renders in the browser only.
	const [mounted, setMounted] = useState(false)
	useEffect(() => startTransition(() => setMounted(true)), [])
	if (!mounted) return <p className="p-8 text-gray-400">Loading the watch log prototype.</p>
	return (
		<StoreProvider variant={variant} remove={remove} order={order}>
			<div className="mx-auto max-w-7xl overflow-x-clip px-4 pb-48 pt-6 text-white sm:px-6 lg:px-8" data-variant={variant}>
				<h1 className="text-2xl font-bold">Watch log: variant {variant}</h1>
				<p className="mt-1 max-w-3xl text-sm text-gray-400">
					Prototype for issue #370. {VARIANTS[variant]}. Everything you do stays in this browser; nothing is saved to your account. Use the arrows (or the arrow
					keys) to switch variants.
				</p>
				<div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start lg:gap-8">
					<div className="lg:sticky lg:top-24 lg:order-2">
						<StatePanel />
					</div>
					<div className="min-w-0">
						<Section n={1} title="Film page: the actions and the watch log" note={HERO_NOTE[variant]}>
							<FilmPicker current={film.id} />
							<HeroSection film={film} />
						</Section>
						<Section n={2} title="Poster cards" note={CARD_NOTE[variant]}>
							<CardsSection />
						</Section>
						<Section n={3} title="Watch next: I watched it" note={NEXT_NOTE[variant]}>
							<WatchNextSection />
						</Section>
					</div>
				</div>
			</div>
			<Toast />
			<PrototypeSwitcher variants={VARIANTS} position="top-[4.5rem] right-2 scale-75 origin-top-right md:top-auto md:right-auto md:scale-100 md:bottom-6 md:left-1/2 md:-translate-x-1/2" />
		</StoreProvider>
	)
}
