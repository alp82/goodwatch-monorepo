// What Your services tells a member whose saved services don't all stream in their country: services are saved apart
// from the country, so a country change can leave some behind, or all of them, which empties On my services.

export interface ServicesNotice {
	/** None of the saved services streams in the country. */
	empty: boolean
	/** The saved services the country doesn't offer. */
	missing: string[]
	text: string
}

export function servicesNotice({
	saved,
	offered,
	countryName,
}: {
	/** The member's saved service ids. */
	saved: string[]
	/** The services that stream in the country. */
	offered: { id: number }[]
	countryName: string
}): ServicesNotice | null {
	const here = new Set(offered.map((service) => String(service.id)))
	const missing = saved.filter((id) => !here.has(id))
	if (missing.length === 0) return null
	if (missing.length === saved.length)
		return {
			empty: true,
			missing,
			text: `None of your services stream in ${countryName}, so On my services shows nothing. Pick the ones you have there.`,
		}
	return {
		empty: false,
		missing,
		text: `${missing.length} of your services ${missing.length === 1 ? "doesn't" : "don't"} stream in ${countryName}.`,
	}
}
