import { browsePath, ing, place, type Kind } from "../browse/address"
import { tropeDiscoverPath, tropeUrl } from "../trope-filter"
import { tropeById } from "./catalog"

export function tropePath(url: string, kind: Kind = "all"): string {
	const id = tropeUrl(url)?.split("/").at(-1)
	const trope = id && tropeById(id)
	if (trope) return browsePath(place(kind, [ing("trope", trope.slug)]))
	const href = tropeDiscoverPath(url)
	return kind !== "all" && id ? href + "&type=" + kind : href
}
