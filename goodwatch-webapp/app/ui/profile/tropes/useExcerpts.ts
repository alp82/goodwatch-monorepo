// How a trope shows up in a few of the owner's titles: the excerpts from /u/:handle/tropes/excerpts, one query per
// trope and title list, so a hero band's preview and its open band share one request. A failed request isn't kept:
// opening the band again retries it.
import { useQuery } from "@tanstack/react-query"

interface Example {
	key: string
	text: string
	label?: string
	labels?: string[]
}

export function useExcerpts(handle: string, trope: string, keys: string[]) {
	const joined = keys.join(",")
	const query = useQuery<Example[]>({
		queryKey: ["profile-trope-excerpts-v2", handle, trope, joined],
		enabled: keys.length > 0,
		queryFn: async ({ signal }) => {
			const q = new URLSearchParams({ trope, keys: joined })
			const response = await fetch(
				`/u/${encodeURIComponent(handle)}/tropes/excerpts?${q}`,
				{ signal },
			)
			if (!response.ok) throw new Error("Loading the excerpts failed.")
			const data: { examples: Example[] } = await response.json()
			return data.examples
		},
	})
	const list = query.data
	return {
		loading: keys.length > 0 && query.isPending && !query.isError,
		textOf: (key: string) => list?.find((e) => e.key === key)?.text ?? null,
		labelOf: (key: string) => list?.find((e) => e.key === key)?.label ?? null,
	}
}
