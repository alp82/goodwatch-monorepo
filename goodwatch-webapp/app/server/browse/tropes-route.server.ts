// The splat route's part for tropes: the tropes index (`/<kind>/tropes`) and a single trope's page
// (`/<kind>/tropes/<slug>`). A trope blended with anything else is a place page and isn't handled here. Returns null
// for every other address.
import { type Address, canonicalPath, browsePath, familyPage, hub } from "~/domain/browse/address"
import { notFound } from "~/domain/browse/not-found"
import type { MetaOptions } from "~/utils/meta"
import { loadAddEntry } from "./add-entry.server"
import { MIN_PAGE, type Places } from "./places.server"
import { loadTropePage, loadTropesIndex } from "./tropes-page.server"

const site = (path: string) => `https://goodwatch.app${path}`
const NOUN = { movie: "movies", show: "shows", all: "movies and shows" } as const
const KIND_LABEL = { movie: "Movies", show: "Shows", all: "Movies & shows" } as const
const image = (a: Address) =>
	`https://goodwatch.app/images/heroes/hero-${a.kind === "show" ? "shows" : "movies"}.png`

export async function tropesRoute(atlas: Places, address: Address) {
	const kind = address.kind
	if (address.view === "family" && address.family === "trope") {
		const data = await loadTropesIndex(atlas)
		const canonical = canonicalPath(address)
		const title = `Tropes in ${NOUN[kind]}: the tricks stories play`
		const meta: MetaOptions = {
			pageMeta: {
				title: `${title} | GoodWatch`,
				description: `${data.groups.reduce((n, g) => n + g.tropes.length, 0)} storytelling tropes, from the Final Girl to Chekhov's Gun, and the ${NOUN[kind]} that play them straight or twist them.`,
				url: site(canonical),
				image: image(address),
				alt: title,
			},
			breadcrumbs: [
				{ label: KIND_LABEL[kind], path: browsePath(hub(kind)) },
				{ label: "Tropes", path: canonical },
			],
			robots: kind === "all" ? "noindex, follow" : undefined,
		}
		return {
			page: "tropes" as const,
			address,
			data,
			meta,
			entry: null,
			country: atlas.viewer.country.toLowerCase(),
		}
	}
	if (
		address.view === "place" &&
		address.parts.length === 1 &&
		address.parts[0].family === "trope"
	) {
		const data = await loadTropePage(atlas, address.parts[0].slug)
		if (!data) throw notFound()
		const canonical = canonicalPath(address)
		const t = data.trope
		const title = `${NOUN[kind].charAt(0).toUpperCase()}${NOUN[kind].slice(1)} ${t.say}`
		const meta: MetaOptions = {
			pageMeta: {
				title: `${t.label}: ${title} | GoodWatch`,
				description: `${t.line} ${t.opening ?? ""}`.trim().slice(0, 300),
				url: site(canonical),
				image: image(address),
				alt: title,
			},
			breadcrumbs: [
				{ label: KIND_LABEL[kind], path: browsePath(hub(kind)) },
				{ label: "Tropes", path: browsePath(familyPage(kind, "trope")) },
				{ label: t.label, path: canonical },
			],
			robots: kind === "all" || t.n < MIN_PAGE ? "noindex, follow" : undefined,
		}
		return {
			page: "trope" as const,
			address,
			data,
			meta,
			entry: await loadAddEntry(atlas, address),
			country: atlas.viewer.country.toLowerCase(),
		}
	}
	return null
}
