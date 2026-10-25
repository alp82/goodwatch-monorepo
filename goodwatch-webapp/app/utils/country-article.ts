// Country names that English says with "the": "in the United States", "from the Netherlands". Used by the Discord
// cards and the "New on your services" pages.
const WITH_THE =
	/^(United |Netherlands$|Philippines$|Bahamas$|Gambia$|Maldives$|Seychelles$|Comoros$|Vatican$|Palestinian Territory$|.*Republic|.* Islands$)/

/** "the United States", "Germany". */
export const withArticle = (name: string) =>
	WITH_THE.test(name) ? `the ${name}` : name
