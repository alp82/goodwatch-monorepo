// Curated country groups for Made in. Co-productions match any listed country.
export const POPULAR = [
	"US",
	"GB",
	"FR",
	"JP",
	"KR",
	"DE",
	"IT",
	"ES",
	"IN",
	"CA",
	"AU",
	"SE",
	"DK",
	"MX",
	"BR",
	"CN",
]

interface Region {
	id: string
	name: string
	codes: string[]
}

export const REGIONS: Region[] = [
	{ id: "na", name: "North America", codes: ["US", "CA"] },
	{
		id: "eu",
		name: "Europe",
		codes: [
			"GB",
			"FR",
			"DE",
			"IT",
			"ES",
			"SE",
			"DK",
			"NO",
			"FI",
			"NL",
			"BE",
			"IE",
			"PL",
			"AT",
			"CH",
			"PT",
			"CZ",
			"HU",
			"GR",
			"IS",
			"RO",
		],
	},
	{
		id: "asia",
		name: "Asia",
		codes: [
			"JP",
			"KR",
			"CN",
			"HK",
			"TW",
			"IN",
			"TH",
			"ID",
			"PH",
			"MY",
			"SG",
			"VN",
		],
	},
	{
		id: "latam",
		name: "Latin America",
		codes: ["MX", "BR", "AR", "CL", "CO", "PE", "CU", "UY"],
	},
	{
		id: "mea",
		name: "Middle East and Africa",
		codes: ["TR", "IL", "IR", "EG", "LB", "SA", "AE", "ZA", "NG", "MA", "TN"],
	},
	{ id: "oc", name: "Oceania", codes: ["AU", "NZ"] },
]

interface Industry {
	id: string
	name: string
	codes: string[]
}

/** Film industries as country sets. Each is "made with at least one of these countries", co-productions included,
 * since productionCountries can only include (there's no exclusion). */
export const INDUSTRIES: Industry[] = [
	{ id: "hollywood", name: "Hollywood", codes: ["US"] },
	{ id: "bollywood", name: "Bollywood", codes: ["IN"] },
	{ id: "korean", name: "Korean", codes: ["KR"] },
	{ id: "japanese", name: "Japanese", codes: ["JP"] },
	{ id: "british", name: "British", codes: ["GB"] },
	{ id: "french", name: "French", codes: ["FR"] },
	{ id: "nollywood", name: "Nollywood", codes: ["NG"] },
	{ id: "hongkong", name: "Hong Kong", codes: ["HK"] },
	{ id: "chinese", name: "Chinese", codes: ["CN"] },
	{ id: "spanish", name: "Spanish", codes: ["ES"] },
	{ id: "italian", name: "Italian", codes: ["IT"] },
	{ id: "turkish", name: "Turkish", codes: ["TR"] },
	{ id: "nordic", name: "Nordic", codes: ["SE", "DK", "NO", "FI", "IS"] },
]

/** The big industries "Rest of the world" leaves out. */
export const BIG_EIGHT = ["US", "IN", "KR", "JP", "GB", "FR", "CN", "HK"]
