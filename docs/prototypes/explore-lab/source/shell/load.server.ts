// PROTOTYPE - throwaway (prototype/explore-r4). The one route's loader: which concept, which address, the data kit,
// then the concept's own loader. Read-only.
import { json, redirect } from "@remix-run/node"
import {
	type Address,
	PREFIX,
	type Kind,
	canonicalPath,
	kindLabel,
	kindOfSeg,
	parse,
} from "../kit/address"
import type { ConceptLoader } from "../kit/contract"
import { KitNotReady, MIN_PAGE, openKit } from "../kit/data.server"
import { loadGallery } from "../gallery/loader.server"
import { concepts } from "./registry"

const loaders = import.meta.glob<{ load?: ConceptLoader }>("../concepts/*/loader.server.ts", {
	eager: true,
})
const loaderOf = (id: string) =>
	Object.entries(loaders).find(([path]) => path.includes(`/concepts/${id}/`))?.[1].load
const firstConcept = () =>
	Object.keys(loaders)
		.map((p) => p.split("/concepts/")[1]?.split("/")[0])
		.filter(Boolean)
		.sort()[0]

export interface ExploreData {
	status: "ok"
	concept: string
	address: Address
	data: unknown
	viewer: import("../kit/types").Viewer
	/** The page's name: "Cozy comedies", "Movies", "Best movies of all time". */
	title: string
	/** The real address, and whether it would be indexable. */
	canonical: string
	titles: number
	indexable: boolean
	ms: number
}

export async function loadExplore(request: Request, splat: string) {
	const url = new URL(request.url)
	const [concept, ...rest] = splat.split("/").filter(Boolean)
	if (!concept) {
		// The first concept of the switcher (round 5: the lab).
		const first = concepts()[0]?.id ?? firstConcept()
		return redirect(first ? `${PREFIX}/${first}/movies` : `${PREFIX}/_kit`)
	}
	const gallery = concept === "_kit"
	const path = gallery ? "/_kit" : `/${rest.join("/")}`
	if (!gallery && !rest.length) return redirect(`${PREFIX}/${concept}/movies`)
	const load = gallery ? null : loaderOf(concept)
	if (!gallery && !load) throw new Response(`No such concept: ${concept}`, { status: 404 })
	const kind: Kind =
		kindOfSeg(rest[0]) ?? (url.searchParams.get("kind") === "show" ? "show" : "movie")
	const country = rest[1] === "streaming" && rest[2] ? rest[2] : "us"
	const started = performance.now()
	try {
		const kit = await openKit(request, kind, country)
		const address = parse(path, url.searchParams, kit)
		if (!address) throw new Response(`No such page: ${path}`, { status: 404 })
		address.kind = kind
		const data = gallery
			? await loadGallery({ request, url, address, kit, concept })
			: await (load as ConceptLoader)({ request, url, address, kit, concept })
		const titles = address.view === "place" ? kit.count(address.parts) : 0
		const title =
			address.view === "best"
				? kit.name(address.parts, { best: true, year: address.year })
				: address.view === "place"
					? kit.name(address.parts)
					: kindLabel(kind)
		return json<ExploreData>({
			status: "ok",
			concept,
			address,
			data,
			viewer: kit.viewer,
			title,
			canonical: canonicalPath(address),
			titles,
			indexable: address.view !== "place" || titles >= MIN_PAGE,
			ms: Math.round(performance.now() - started),
		})
	} catch (error) {
		if (error instanceof KitNotReady) return json({ status: "loading" as const })
		throw error
	}
}
