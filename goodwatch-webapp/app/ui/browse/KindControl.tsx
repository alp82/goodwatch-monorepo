import { useNavigation } from "@remix-run/react"
import type { Kind } from "~/domain/browse/address"
import { TitleKindControl } from "~/ui/title-kind/TitleKindControl"
export interface KindChoice {
	kind: Kind
	label: string
	/** The same page for this kind. */
	href: string
	/** Whether the page is this kind. */
	on: boolean
	count?: number
}

const byKind = (kinds: KindChoice[]) => {
	const of = (kind: Kind) => kinds.find((k) => k.kind === kind) as KindChoice
	return { movie: of("movie"), show: of("show"), all: of("all") }
}

/** The kind to show: the one a click is already loading, else the page's. The pill moves on the click. */
function useShownKind(kinds: KindChoice[]): Kind {
	const navigation = useNavigation()
	const here = kinds.find((k) => k.on)?.kind ?? "movie"
	if (navigation.state === "idle" || !navigation.location) return here
	const going = navigation.location.pathname + navigation.location.search
	return kinds.find((k) => k.href === going)?.kind ?? here
}

export function KindControl({ kinds }: { kinds: KindChoice[] }) {
	const choices = byKind(kinds)
	return (
		<TitleKindControl
			value={useShownKind(kinds)}
			counts={{ movie: choices.movie.count, all: choices.all.count, show: choices.show.count }}
			hrefs={{ movie: choices.movie.href, all: choices.all.href, show: choices.show.href }}
		/>
	)
}
