// The country pieces Made in and Age and content share: a country as a flag chip (the sheet's Chip with Settings'
// flag), and "Find a country" matches as the same chips, shown in place of the content they search for.
import { productionCountryName } from "~/domain/production-country"
import { Chip } from "~/ui/filter-bar/SheetControls"
import { countryFlagUrl } from "~/utils/country-flag"
import { type Country, searchCountries } from "./watch-choices"

/** One country as a flag chip. `short` shows its code, for a row of quick picks. */
export function CountryChip({
	code,
	active,
	count = null,
	short = false,
	stableWidth = false,
	onClick,
}: {
	code: string
	active: boolean
	count?: number | null
	short?: boolean
	stableWidth?: boolean
	onClick: () => void
}) {
	return (
		<Chip
			stableWidth={stableWidth}
			img={countryFlagUrl(code)}
			o={{
				id: code,
				label: short ? code : productionCountryName(code),
				active,
				count,
				toggle: onClick,
			}}
		/>
	)
}

/** Codes as countries with their names, sorted by name. */
export const countriesOf = (codes: Iterable<string>): Country[] =>
	[...new Set(codes)]
		.filter((code) => /^[A-Z]{2}$/.test(code))
		.map((code) => ({ code, name: productionCountryName(code) }))
		.sort((a, b) => a.name.localeCompare(b.name))

/** The countries a search matches, as flag chips. */
export function CountryMatches({
	list,
	term,
	isOn,
	countOf,
	onPick,
	className = "flex flex-wrap content-start gap-1.5",
	max = 60,
	stableWidth = false,
}: {
	list: readonly Country[]
	term: string
	isOn: (code: string) => boolean
	countOf?: (code: string) => number | null
	onPick: (code: string) => void
	className?: string
	max?: number
	stableWidth?: boolean
}) {
	const matches = searchCountries(list, term).slice(0, max)
	return (
		<div className={className}>
			{matches.map((country) => (
				<CountryChip
					stableWidth={stableWidth}
					key={country.code}
					code={country.code}
					active={isOn(country.code)}
					count={countOf?.(country.code) ?? null}
					onClick={() => onPick(country.code)}
				/>
			))}
			{!matches.length && (
				<p className="py-1.5 text-[13px] text-gray-500">No matching country</p>
			)}
		</div>
	)
}
