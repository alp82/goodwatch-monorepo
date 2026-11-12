/** Canonical TV Tropes identity, never an essence tag or a free-text SQL condition. */
export function tropeUrl(value: unknown): string | undefined {
	if (typeof value !== "string" || value.length > 300) return
	const match =
		/^https?:\/\/(?:www\.)?tvtropes\.org\/pmwiki\/pmwiki\.php\/(Main\/[A-Za-z0-9_-]+)\/?$/.exec(
			value,
		)
	return match
		? `https://tvtropes.org/pmwiki/pmwiki.php/${match[1]}`
		: undefined
}

export function tropeLabel(url: string): string {
	return (url.split("/").at(-1) ?? "Trope")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.replace(/_/g, " ")
}

export function tropeDiscoverPath(url: string): string {
	const canonical = tropeUrl(url)
	return canonical
		? `/discover?${new URLSearchParams({ trope: canonical })}`
		: "/discover"
}
