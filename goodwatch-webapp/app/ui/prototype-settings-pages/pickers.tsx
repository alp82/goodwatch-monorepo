// PROTOTYPE - throwaway (settings subpages, round 2). The country and language pickers, after the owner found the
// plain scroll lists ugly and wasteful of the page's width. Both are grids of flag buttons that use the width:
// the language picker shows all 15 choices at once; the country picker shows a dozen likely countries, a search over
// all of them, and "All countries" to open the full grid. The choice is an amber ring with a check.
import { CheckIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/20/solid"
import { useMemo, useState } from "react"
import { useCountries } from "~/routes/api.countries"
import { englishName, ownName } from "~/ui/media-preference/languages"
import { BROWSER } from "~/ui/media-preference/machine"
import { MEDIA_LANGUAGES } from "~/utils/media-language"
import { Flag, usePrefs } from "./parts"

/** The flag a language is shown with: the country most of its titles come from. */
const LANGUAGE_FLAG: Record<string, string> = {
	en: "US",
	de: "DE",
	fr: "FR",
	es: "ES",
	it: "IT",
	"pt-BR": "BR",
	"pt-PT": "PT",
	ja: "JP",
	ko: "KR",
	"zh-Hans": "CN",
	"zh-Hant": "TW",
	pl: "PL",
	ru: "RU",
	ar: "SA",
}
export const languageFlag = (language: string) => LANGUAGE_FLAG[language] ?? "US"

const choice = (selected: boolean) =>
	`relative flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-white ${selected ? "bg-amber-400/10 ring-2 ring-amber-400" : "bg-white/[0.04] ring-1 ring-white/10 hover:bg-white/[0.08]"}`

function Picked() {
	return (
		<span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-amber-400 text-gray-950">
			<CheckIcon className="size-3.5" aria-label="Current" />
		</span>
	)
}

// ---------------------------------------------------------------------------------------------------------------------
// Language

export function LanguagePicker() {
	const p = usePrefs()
	const options = [BROWSER, ...MEDIA_LANGUAGES]
	return (
		<ul aria-label="Show titles in" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
			{options.map((l) => {
				const selected = l === p.language
				const shown = l === BROWSER ? p.browserLanguage : l
				return (
					<li key={l} className={l === BROWSER ? "col-span-2 sm:col-span-1" : ""}>
						<button type="button" aria-current={selected || undefined} onClick={() => p.setLanguage(l)} className={choice(selected)}>
							<Flag code={languageFlag(shown)} className="h-5 shrink-0 shadow" />
							<span className="min-w-0 flex-1 pr-4">
								{l === BROWSER ? (
									<>
										<span className="block truncate text-sm font-semibold text-white">Browser default</span>
										<span className="block truncate text-xs text-gray-400">{englishName(p.browserLanguage)} right now</span>
									</>
								) : (
									<>
										<span className="block truncate text-sm font-semibold text-white">{englishName(l)}</span>
										<span lang={l} className="block truncate text-xs text-gray-400">
											{ownName(l)}
										</span>
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

// ---------------------------------------------------------------------------------------------------------------------
// Country

/** Shown before any search: the current country first, then the likeliest ones. */
const LIKELY = ["US", "GB", "DE", "FR", "ES", "IT", "NL", "CA", "AU", "BR", "MX", "IN", "JP", "AT", "CH", "PL"]

export function CountryPicker() {
	const p = usePrefs()
	const countries = useCountries()
	const [query, setQuery] = useState("")
	const [all, setAll] = useState(false)
	const list = useMemo(
		() => (countries.data ?? []).filter((c) => c.name.length > 2).sort((a, b) => a.name.localeCompare(b.name)),
		[countries.data],
	)
	const q = query.trim().toLowerCase()
	const likely = [p.country, ...LIKELY.filter((c) => c !== p.country)]
		.slice(0, 12)
		.map((code) => list.find((c) => c.code === code))
		.filter((c) => c !== undefined)
	const rows = q ? list.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q) : all ? list : likely
	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-3">
				<label className="flex h-11 min-w-0 flex-1 basis-64 items-center gap-2 rounded-xl bg-white/[0.06] px-3 ring-1 ring-white/10 focus-within:ring-white/30 sm:max-w-md">
					<MagnifyingGlassIcon className="size-5 shrink-0 text-gray-400" aria-hidden />
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={`Search ${list.length || ""} countries`}
						aria-label="Search countries"
						className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-gray-500 [&::-webkit-search-cancel-button]:hidden"
					/>
					{query && (
						<button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="cursor-pointer rounded-full p-1 text-gray-400 hover:text-white">
							<XMarkIcon className="size-4" />
						</button>
					)}
				</label>
				{!q && (
					<button type="button" onClick={() => setAll(!all)} className="min-h-11 cursor-pointer text-sm font-semibold text-amber-500 hover:text-amber-400">
						{all ? "Fewer countries" : `All ${list.length || ""} countries`}
					</button>
				)}
			</div>
			<ul aria-label="Countries" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
				{rows.map((c) => {
					const selected = c.code === p.country
					return (
						<li key={c.code}>
							<button type="button" aria-current={selected || undefined} onClick={() => p.setCountry(c.code)} className={choice(selected)}>
								<Flag code={c.code} className="h-5 shrink-0 shadow" />
								<span className="min-w-0 flex-1 truncate pr-4 text-sm font-semibold text-white">{c.name}</span>
								{selected && <Picked />}
							</button>
						</li>
					)
				})}
			</ul>
			{countries.isPending && <p className="text-sm text-gray-500">Loading countries…</p>}
			{q && rows.length === 0 && <p className="text-sm text-gray-400">No country called "{query.trim()}".</p>}
		</div>
	)
}
