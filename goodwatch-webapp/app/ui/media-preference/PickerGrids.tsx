// The country and language pickers of Settings: grids of flag buttons that use the page's width. The language grid shows
// every choice at once. The country grid shows a dozen likely countries, a search over all of them, and "All countries"
// to open the whole grid. The current choice has an amber ring and a check. The header pair's dialog keeps its lists.
import { CheckIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useMemo, useState } from "react"
import { useCountries } from "~/routes/api.countries"
import { countryFlagUrl } from "~/utils/country-flag"
import { MEDIA_LANGUAGES } from "~/utils/media-language"
import { englishName, languageFlag, ownName } from "./languages"
import { BROWSER } from "./machine"

const choice = (selected: boolean) =>
	`relative flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-white disabled:cursor-wait ${selected ? "bg-amber-400/10 ring-2 ring-amber-400" : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.08]"}`

function Picked() {
	return (
		<span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-amber-400 text-gray-950">
			<CheckIcon className="size-3.5" aria-label="Current" />
		</span>
	)
}

export function Flag({ code, className = "h-5" }: { code: string; className?: string }) {
	return <img src={countryFlagUrl(code)} alt="" className={`shrink-0 rounded-[2px] shadow ${className}`} />
}

/** "Browser default" and every offered language, each with its flag and its own name. */
export function LanguageGrid({
	value,
	browserLanguage,
	onPick,
}: {
	value: string
	browserLanguage: string
	onPick: (choice: string) => void
}) {
	const options = [BROWSER, ...MEDIA_LANGUAGES]
	return (
		<ul aria-label="Show titles in" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
			{options.map((l) => {
				const selected = l === value
				const shown = l === BROWSER ? browserLanguage : l
				return (
					<li key={l} className={l === BROWSER ? "col-span-2 sm:col-span-1" : ""}>
						<button
							type="button"
							data-language={l}
							aria-current={selected || undefined}
							onClick={() => onPick(l)}
							className={choice(selected)}
						>
							<Flag code={languageFlag(shown)} />
							<span className="min-w-0 flex-1 pr-4">
								{l === BROWSER ? (
									<>
										<span className="block truncate text-sm font-semibold text-white">Browser default</span>
										<span className="block truncate text-xs text-gray-400">
											{englishName(browserLanguage)} right now
										</span>
									</>
								) : (
									<>
										<span className="block truncate text-sm font-semibold text-white">{englishName(l)}</span>
										{ownName(l) && (
											<span lang={l} className="block truncate text-xs text-gray-400">
												{ownName(l)}
											</span>
										)}
									</>
								)}
							</span>
							{selected && <Picked />}
						</button>
					</li>
				)
			})}
		</ul>
	)
}

/** Shown before a search, after the current country: the countries most members watch from. */
const LIKELY = ["US", "GB", "DE", "FR", "ES", "IT", "CA", "AU", "BR", "JP", "IN", "MX", "NL"]

/** A dozen likely countries, a search over every country, and the whole grid on request. */
export function CountryGrid({ current, onPick }: { current: string; onPick: (code: string) => void }) {
	const countries = useCountries()
	const [query, setQuery] = useState("")
	const [all, setAll] = useState(false)
	const list = useMemo(
		() => [...(countries.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
		[countries.data],
	)
	const q = query.trim().toLowerCase()
	const likely = [current, ...LIKELY.filter((c) => c !== current)]
		.slice(0, 12)
		.map((code) => list.find((c) => c.code === code))
		.filter((c) => c !== undefined)
	const rows = q
		? list.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q)
		: all
			? list
			: likely
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-3">
				<label className="flex h-11 min-w-0 flex-1 basis-64 items-center gap-2 rounded-xl bg-white/[0.06] px-3 ring-1 ring-white/10 focus-within:ring-white/30 sm:max-w-md">
					<MagnifyingGlassIcon className="size-5 shrink-0 text-gray-400" aria-hidden />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={list.length ? `Search ${list.length} countries` : "Search countries"}
						aria-label="Search countries"
						className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-gray-500 [&::-webkit-search-cancel-button]:hidden"
					/>
					{query && (
						<button
							type="button"
							onClick={() => setQuery("")}
							aria-label="Clear search"
							className="cursor-pointer rounded-full p-1 text-gray-400 hover:text-white"
						>
							<XMarkIcon className="size-4" />
						</button>
					)}
				</label>
				{!q && list.length > 0 && (
					<button
						type="button"
						aria-expanded={all}
						onClick={() => setAll(!all)}
						className="min-h-11 cursor-pointer text-sm font-semibold text-amber-500 hover:text-amber-400"
					>
						{all ? "Fewer countries" : `All ${list.length} countries`}
					</button>
				)}
			</div>
			<ul aria-label="Countries" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
				{rows.map((c) => {
					const selected = c.code === current
					return (
						<li key={c.code}>
							<button
								type="button"
								data-country-code={c.code}
								aria-current={selected || undefined}
								onClick={() => onPick(c.code)}
								className={choice(selected)}
							>
								<Flag code={c.code} />
								<span className="min-w-0 flex-1 truncate pr-4 text-sm font-semibold text-white">{c.name}</span>
								{selected && <Picked />}
							</button>
						</li>
					)
				})}
			</ul>
			{countries.isPending && (
				<p className="text-sm text-gray-500" aria-busy="true">
					Loading countries…
				</p>
			)}
			{countries.isError && (
				<p className="text-sm text-gray-400">
					Countries could not be loaded.{" "}
					<button type="button" className="cursor-pointer underline" onClick={() => countries.refetch()}>
						Try again
					</button>
				</p>
			)}
			{q && countries.data && rows.length === 0 && <p className="text-sm text-gray-400">No country called "{query.trim()}".</p>}
		</div>
	)
}
