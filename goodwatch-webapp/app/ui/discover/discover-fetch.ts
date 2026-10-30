// Keep large fallback ranked lists out of request URLs. A shared search snapshot normally needs only its token.
export function discoverFetch(
	url: string,
	guest: unknown,
	signal?: AbortSignal,
) {
	const [path, query = ""] = url.split("?")
	const params = new URLSearchParams(query)
	const value = params.get("ranked")
	const ranked =
		value !== null && value.length > 1000
			? value.split(",").map(Number)
			: undefined
	if (ranked) params.delete("ranked")
	return fetch(
		ranked ? `${path}?${params}` : url,
		guest || ranked
			? {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						...(guest ? { guest } : {}),
						...(ranked ? { ranked } : {}),
					}),
					signal,
				}
			: { signal },
	)
}
