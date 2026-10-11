import {
	ChevronRightIcon,
	MagnifyingGlassIcon,
} from "@heroicons/react/24/solid"
import type React from "react"
import { useState } from "react"
import { useCountries } from "~/routes/api.countries"
import { useStreamingCountries } from "~/routes/api.streaming-countries"
import { LogoStack } from "~/ui/details/hero/LogoStack"
import {
	type CountryCount,
	plural,
	rankCountries,
	toServices,
} from "~/ui/details/hero/countryOffers"
import { countryFlagUrl } from "~/utils/country-flag"
import { OFFER_TABS, type OfferTab } from "~/utils/streaming-links"

function Row({
	code,
	name,
	current,
	onChoose,
	right,
	dim = false,
}: {
	code: string
	name: string
	current: string
	onChoose: (code: string) => void
	right?: React.ReactNode
	dim?: boolean
}) {
	const selected = code === current
	return (
		<li>
			<button
				type="button"
				onClick={() => onChoose(code)}
				aria-current={selected || undefined}
				className={`flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 text-left text-sm hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-white ${selected ? "bg-white/[0.1] ring-1 ring-white/20" : ""} ${dim ? "text-gray-500" : "text-white"}`}
			>
				<img
					src={countryFlagUrl(code)}
					alt=""
					className={`h-3 rounded-[1px] ${dim ? "opacity-50" : ""}`}
				/>
				<span className="min-w-0 flex-1 truncate">{name}</span>
				{selected && (
					<span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
						Current
					</span>
				)}
				{right}
			</button>
		</li>
	)
}

// The country list of the where-to-watch block: the countries with the title first, most services first, each with
// the logos of its services. The other countries fold away under one button; the current one always shows. The
// counts come with the page and order the list until every country's services have loaded, which then order it and
// show the logos. A page whose details were cached before they carried counts has none: the list waits for the load.
export default function CountryList({
	mediaType,
	titleId,
	tab,
	rows,
	current,
	verb,
	onChoose,
}: {
	mediaType: "movie" | "show"
	titleId: number
	tab: OfferTab
	rows: CountryCount[]
	current: string
	verb: string
	onChoose: (code: string) => void
}) {
	const offers = useStreamingCountries(mediaType, titleId, current)
	const catalog = new Map(
		(offers.data?.services ?? []).map((s) => [s.tmdb_id, s]),
	)
	const logos = (code: string) => {
		const ids = offers.data?.countries[code]?.[OFFER_TABS.indexOf(tab)]
		return ids ? toServices(ids, catalog) : []
	}
	const loaded = offers.data
		? rankCountries(
				Object.fromEntries(
					Object.entries(offers.data.countries).map(([code, lists]) => [
						code,
						lists.map((ids) => ids.length),
					]),
				),
				tab,
			)
		: null
	const withAnyOffer = loaded ?? rows
	const [query, setQuery] = useState("")
	const [rest, setRest] = useState(false)
	const countries = useCountries()
	const q = query.trim().toLowerCase()
	const matches = (code: string, name: string) =>
		!q || name.toLowerCase().includes(q) || code.toLowerCase() === q
	const withOffers = withAnyOffer.filter((r) => matches(r.code, r.name))
	const offered = new Set(withAnyOffer.map((r) => r.code))
	// Which countries have nothing is known once some country has something, or every country's services loaded.
	const known = loaded !== null || rows.length > 0
	const without = known
		? (countries.data ?? []).filter(
				(c) => !offered.has(c.code) && matches(c.code, c.name),
			)
		: []
	// A search shows every match; otherwise the countries without offers wait behind their button, except the current.
	const shownWithout =
		q || rest ? without : without.filter((c) => c.code === current)

	return (
		<div>
			<label className="flex h-8 items-center gap-2 rounded-lg bg-white/[0.07] px-2 ring-1 ring-white/10 focus-within:ring-white/30">
				<MagnifyingGlassIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
				<input
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search countries"
					aria-label="Search countries"
					className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
				/>
			</label>
			<div className="mt-2 max-h-80 overflow-y-auto overscroll-contain pr-1">
				{withOffers.length > 0 && (
					<ul>
						{withOffers.map((r) => (
							<Row
								key={r.code}
								code={r.code}
								name={r.name}
								current={current}
								onChoose={onChoose}
								right={
									logos(r.code).length ? (
										<LogoStack services={logos(r.code)} size={20} />
									) : (
										<span className="text-xs tabular-nums text-gray-400">
											{plural(r.count, "service", "services")}
										</span>
									)
								}
							/>
						))}
					</ul>
				)}
				{!q && withAnyOffer.length === 0 && loaded && (
					<p className="px-2 py-2 text-sm text-gray-500">
						Not {verb} in any country.
					</p>
				)}
				{withAnyOffer.length === 0 && offers.isPending && (
					<p className="px-2 py-2 text-xs text-gray-500" aria-busy="true">
						Loading where it is {verb}…
					</p>
				)}
				{offers.isError && (
					<output className="block px-2 py-2 text-xs text-gray-400">
						The services of other countries could not be loaded.{" "}
						<button
							type="button"
							className="cursor-pointer underline"
							disabled={offers.isFetching}
							onClick={() => offers.refetch()}
						>
							Try again
						</button>
					</output>
				)}
				{shownWithout.length > 0 && (
					<ul>
						{shownWithout.map((c) => (
							<Row
								key={c.code}
								code={c.code}
								name={c.name}
								current={current}
								onChoose={onChoose}
								dim
							/>
						))}
					</ul>
				)}
				{!q && !rest && without.length > 0 && (
					<button
						type="button"
						onClick={() => setRest(true)}
						className="mt-1 flex h-8 w-full cursor-pointer items-center gap-1 px-2 text-xs font-semibold text-gray-400 hover:text-white"
					>
						Show {plural(without.length, "country", "countries")} without offers
						<ChevronRightIcon className="h-3 w-3" />
					</button>
				)}
				{countries.isPending && (
					<p className="px-2 py-2 text-xs text-gray-500" aria-busy="true">
						Loading countries…
					</p>
				)}
				{countries.isError && (
					<output className="block px-2 py-2 text-xs text-gray-400">
						Countries could not be loaded.{" "}
						<button
							type="button"
							className="cursor-pointer underline"
							disabled={countries.isFetching}
							onClick={() => countries.refetch()}
						>
							Try again
						</button>
					</output>
				)}
				{q &&
					known &&
					withOffers.length === 0 &&
					without.length === 0 &&
					!countries.isPending && (
						<p className="px-2 py-2 text-sm text-gray-500">
							No country matches.
						</p>
					)}
			</div>
		</div>
	)
}
