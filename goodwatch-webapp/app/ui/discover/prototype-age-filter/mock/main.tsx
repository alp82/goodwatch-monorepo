// PROTOTYPE (throwaway): the age-filter variants on a stand-in for Discover, with made-up titles and ratings, so it
// runs without the server. The filter row and cards imitate Discover's; only the age filter is the thing to judge.
//   npm run prototype:age-filter   →   http://localhost:3011/?variant=A
import "./mock.css"
import {
	AdjustmentsHorizontalIcon,
	ArrowsUpDownIcon,
	EyeSlashIcon,
} from "@heroicons/react/20/solid"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type ReactNode, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, useSearchParams } from "react-router-dom"
import { SHELL } from "~/ui/filter-bar/motion"
import { type MockRatings, useAgeFilterPrototype } from "../AgeFilterPrototype"
import { MOCK_CARDS, MOCK_LADDERS, MOCK_TITLES } from "./data"

const MOCK: MockRatings = { titles: MOCK_TITLES, ladders: MOCK_LADDERS }

// Discover's grid columns (DISCOVER_GRID in DiscoverGrid.tsx).
const GRID =
	"grid grid-cols-2 gap-3 xs:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 lg:gap-5 xl:grid-cols-6"

function Fake({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
	return (
		<span
			className={`flex h-12 items-center gap-2 px-3.5 text-sm font-bold whitespace-nowrap text-gray-400 ${wide ? "w-56" : ""} ${SHELL}`}
		>
			{children}
		</span>
	)
}

function Page() {
	const [params, setParams] = useSearchParams()
	// The mock page always shows a variant.
	const missing = !params.get("variant")
	useEffect(() => {
		if (missing) setParams({ variant: "A" }, { replace: true })
	}, [missing, setParams])
	const proto = useAgeFilterPrototype(MOCK_CARDS, { country: "DE", mock: MOCK })
	const cards = proto?.cards ?? MOCK_CARDS
	return (
		<div className="mx-auto max-w-7xl px-4 pt-16 pb-40 lg:pt-8">
			<p className="text-xs font-bold tracking-wide text-fuchsia-400 uppercase">
				Prototype · made-up titles and ratings
			</p>
			<h1 className="mt-1 text-3xl font-black text-white lg:text-4xl">Discover</h1>
			<div className="mt-5 hidden flex-wrap items-center gap-2.5 lg:mt-7 lg:flex">
				<Fake wide>On my services</Fake>
				<Fake wide>
					<EyeSlashIcon className="h-4 w-4" /> Not seen yet
				</Fake>
				<Fake>
					<ArrowsUpDownIcon className="h-4 w-4" /> Popular
				</Fake>
				<div className="ml-auto flex items-center gap-2.5">
					{proto?.rowTrail}
					<Fake>
						<AdjustmentsHorizontalIcon className="h-4 w-4" /> Filters
					</Fake>
				</div>
			</div>
			{proto?.panel}
			{proto?.switcher}
			<p className="mt-5 text-sm text-gray-400">
				{cards.length} of {MOCK_CARDS.length} titles showing
			</p>
			<div className={`mt-4 ${GRID}`}>
				{cards.map((card) => (
					<div key={card.key} className="relative">
						<div
							className="flex aspect-[2/3] scale-95 flex-col justify-end rounded-xl p-3"
							style={{
								background: `linear-gradient(160deg, hsl(${card.hue} 45% 32%), hsl(${(card.hue + 40) % 360} 50% 12%))`,
							}}
						>
							<span className="text-sm leading-tight font-bold text-white">
								{card.title}
							</span>
							<span className="mt-0.5 text-xs text-white/60">
								{card.year} · {card.show ? "Show" : "Movie"}
							</span>
						</div>
						{proto?.overlay(card)}
					</div>
				))}
			</div>
		</div>
	)
}

const root = document.getElementById("root")
if (root)
	createRoot(root).render(
		<QueryClientProvider client={new QueryClient()}>
			<BrowserRouter>
				<Page />
			</BrowserRouter>
		</QueryClientProvider>,
	)
