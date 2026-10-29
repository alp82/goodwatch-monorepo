// PROTOTYPE (Discover lab): the country pieces Made in and Age and content share. A country is a flag chip (the
// filter sheet's Chip with Settings' flag), and "Find a country" lists its matches as the same chips, in place.
import { productionCountryName } from "~/domain/production-country"
import { Chip } from "~/ui/filter-bar/SheetControls"
import { flagUrl, searchCountries } from "./parts"

export interface Country {
	code: string
	name: string
}

/** One country as a flag chip. `short` shows its code (a row of quick picks). */
export function CountryChip({
	code,
	active,
	count = null,
	short,
	onClick,
}: { code: string; active: boolean; count?: number | null; short?: boolean; onClick: () => void }) {
	return <Chip img={flagUrl(code)} o={{ id: code, label: short ? code : productionCountryName(code), active, count, toggle: onClick }} />
}

/** The countries a search matches, as flag chips. */
export function CountryMatches({
	list,
	term,
	loading,
	isOn,
	countOf,
	onPick,
	className = "flex flex-wrap content-start gap-1.5",
}: {
	list: Country[]
	term: string
	loading?: boolean
	isOn: (code: string) => boolean
	countOf?: (code: string) => number | null
	onPick: (code: string) => void
	className?: string
}) {
	const matches = searchCountries(list, term).slice(0, 60)
	return (
		<div className={className}>
			{matches.map((c) => (
				<CountryChip key={c.code} code={c.code} active={isOn(c.code)} count={countOf?.(c.code) ?? null} onClick={() => onPick(c.code)} />
			))}
			{!matches.length && <p className="py-1.5 text-[13px] text-gray-500">{loading ? "Loading countries…" : "No matching country."}</p>}
		</div>
	)
}
