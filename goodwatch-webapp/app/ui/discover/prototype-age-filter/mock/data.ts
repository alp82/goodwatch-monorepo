// PROTOTYPE (throwaway): made-up Discover titles for the mock page. The ratings are written from memory and the
// advisory wording is invented; they only need to be plausible, with realistic gaps (no local rating, no rating at
// all, no advisories).
import type { LadderRow, TitleRating } from "../ratings"

export interface MockCard {
	key: number
	title: string
	year: number
	show: boolean
	hue: number
}

type Row = [
	title: string,
	year: number,
	show: boolean,
	certs: string,
	advisories: string,
	kids?: boolean,
	teens?: boolean,
]

const V = "Graphic violence"
const S = "Sexual content and nudity"
const F = "Frightening scenes"
const L = "Strong language"
const D = "Drug and alcohol use"

const ROWS: Row[] = [
	["Dune: Part Two", 2024, false, "DE_12 US_PG-13 GB_12A FR_TP NL_12 AU_M", `${V}`],
	["Bluey", 2018, true, "DE_0 US_TV-Y GB_U AU_G", "", true, true],
	["The Bear", 2022, true, "DE_12 US_TV-MA GB_15 AU_MA 15+", `${L}|${D}`],
	["Oppenheimer", 2023, false, "DE_12 US_R GB_15 FR_TP NL_12 AU_MA 15+", `${S}|${L}`],
	["Inside Out 2", 2024, false, "DE_0 US_PG GB_U FR_TP NL_AL AU_PG", "", true, true],
	["Shōgun", 2024, true, "US_TV-MA GB_18 AU_MA 15+", `${V}|${S}`],
	["The Substance", 2024, false, "DE_16 US_R GB_18 FR_16 NL_16", `${V}|${S}|${F}`],
	["Paddington 2", 2017, false, "DE_0 US_PG GB_PG FR_TP NL_AL AU_G", "", true, true],
	["Severance", 2022, true, "DE_16 US_TV-MA GB_15", `${F}|${L}`],
	["Spider-Man: Across the Spider-Verse", 2023, false, "DE_6 US_PG GB_PG NL_9 AU_PG", "", true, true],
	["A Quiet Afternoon in Lisbon", 2021, false, "", "", false, true],
	["The Last of Us", 2023, true, "DE_16 US_TV-MA GB_15 NL_16 AU_MA 15+", `${V}|${F}|${L}`],
	["Past Lives", 2023, false, "US_PG-13 GB_12A FR_TP", `${L}`, false, true],
	["Arcane", 2021, true, "DE_16 US_TV-14 GB_15 NL_12", `${V}|${D}`],
	["Kiki's Delivery Service", 1989, false, "DE_0 US_G GB_U FR_TP", "", true, true],
	["Poor Things", 2023, false, "DE_16 US_R GB_18 FR_12 NL_16 AU_MA 15+", `${S}|${V}|${L}`],
	["Small Harbour Stories", 2019, true, "", "", true, true],
	["The Wild Robot", 2024, false, "DE_6 US_PG GB_U NL_6 AU_PG", `${F}`, true, true],
	["Baby Reindeer", 2024, true, "US_TV-MA GB_18", `${S}|${D}|${L}`],
	["Everything Everywhere All at Once", 2022, false, "DE_16 US_R GB_15 FR_TP NL_12", `${V}|${S}|${L}`],
	["Night Shift at the Morgue", 2022, false, "", `${V}|${F}`],
	["Heartstopper", 2022, true, "DE_6 US_TV-14 GB_12 NL_12", `${L}`, false, true],
	["Talk to Me", 2023, false, "DE_16 US_R GB_15 AU_MA 15+", `${V}|${F}|${D}`],
	["My Neighbor Totoro", 1988, false, "DE_0 US_G GB_U FR_TP NL_AL", "", true, true],
	["Slow Horses", 2022, true, "DE_16 US_TV-MA GB_15", `${V}|${L}`],
	["The Holdovers", 2023, false, "US_R GB_15 FR_TP", `${L}|${D}`, false, true],
	["Avatar: The Last Airbender", 2005, true, "DE_6 US_TV-Y7 GB_PG", "", true, true],
	["Anora", 2024, false, "DE_16 US_R GB_18 FR_TP NL_16", `${S}|${L}|${D}`],
	["Grandma's Kitchen Garden", 2020, true, "", ""],
	["Godzilla Minus One", 2023, false, "DE_12 US_PG-13 GB_12A", `${F}|${V}`, false, true],
	["Wednesday", 2022, true, "DE_12 US_TV-14 GB_12 NL_12", `${F}`, false, true],
	["Parasite", 2019, false, "DE_16 US_R GB_15 FR_TP NL_16 AU_MA 15+", `${V}|${S}|${L}`],
	["The Mitchells vs. the Machines", 2021, false, "DE_6 US_PG GB_U", "", true, true],
	["Chernobyl", 2019, true, "DE_16 US_TV-MA GB_15", `${F}|${V}`],
	["Flow", 2024, false, "US_PG GB_U FR_TP", `${F}`, true, true],
	["Blue Eye Samurai", 2023, true, "US_TV-MA", `${V}|${S}`],
]

export const MOCK_CARDS: MockCard[] = ROWS.map(([title, year, show], i) => ({
	key: i + 1,
	title,
	year,
	show,
	hue: (i * 47) % 360,
}))

export const MOCK_TITLES = new Map<number, TitleRating>(
	ROWS.map(([, , , certs, advisories, kids, teens], i) => [
		i + 1,
		{
			// "AU_MA 15+" keeps its space: split on a space only before a country code.
			certs: certs ? certs.split(/ (?=[A-Z]{2}_)/) : [],
			advisories: advisories ? advisories.split("|") : [],
			kids: kids ?? (certs || advisories ? false : null),
			teens: teens ?? (certs || advisories ? false : null),
			family: kids ?? null,
		},
	]),
)

const ladder = (movie: string[], show: string[] = movie): LadderRow[] => [
	...movie.map((code, i) => ({ code, media_type: "movie" as const, meaning: "", order_default: i })),
	...show.map((code, i) => ({ code, media_type: "show" as const, meaning: "", order_default: i })),
]

export const MOCK_LADDERS: Record<string, LadderRow[]> = {
	DE: ladder(["0", "6", "12", "16", "18"]),
	GB: ladder(["U", "PG", "12A", "15", "18"], ["U", "PG", "12", "15", "18"]),
	FR: ladder(["TP", "12", "16", "18"]),
	NL: ladder(["AL", "6", "9", "12", "14", "16", "18"]),
	AU: ladder(["G", "PG", "M", "MA 15+", "R 18+"]),
	// ES and BR have no ladder here on purpose: the fallback to plain ages.
}
