// Turns a pathname into the pattern of the route that serves it: `/movie/603-the-matrix` becomes `/movie/:movieKey`.
// The browser tags its Web Vitals with the pattern and the server labels its response metrics with it, so both report
// under the same name and neither stores a concrete URL, a handle or a title key.
import { matchRoutes } from "@remix-run/react"

/** The fields of a Remix manifest route that decide which path it answers. The browser and server manifests both have them. */
export interface ManifestRoute {
	id: string
	parentId?: string
	path?: string
	index?: boolean
	caseSensitive?: boolean
}

export type RoutePatternMatcher = (pathname: string) => string | null

interface RouteNode {
	id: string
	path?: string
	index?: boolean
	caseSensitive?: boolean
	children?: RouteNode[]
}

/**
 * Returns a function that answers the route pattern for a pathname, or `null` when no route serves it (static files,
 * unknown paths). The patterns come from the manifest alone, so the set of answers is as small as the set of routes.
 */
export function createRoutePatternMatcher(
	manifest: Record<string, ManifestRoute | undefined>,
): RoutePatternMatcher {
	const byParent = new Map<string, ManifestRoute[]>()
	for (const route of Object.values(manifest)) {
		if (!route) continue
		const siblings = byParent.get(route.parentId ?? "") ?? []
		siblings.push(route)
		byParent.set(route.parentId ?? "", siblings)
	}
	const nodesUnder = (parentId: string): RouteNode[] =>
		(byParent.get(parentId) ?? []).map((route) =>
			route.index
				? {
						// An index route can have its own path: `$type._index` answers `/:type`.
						id: route.id,
						index: true,
						path: route.path,
						caseSensitive: route.caseSensitive,
					}
				: {
						id: route.id,
						path: route.path,
						caseSensitive: route.caseSensitive,
						children: nodesUnder(route.id),
					},
		)
	const tree = nodesUnder("")

	return (pathname) => {
		const matches = matchRoutes(
			tree as Parameters<typeof matchRoutes>[0],
			pathname,
		)
		if (!matches) return null
		const segments = matches
			.map((match) => match.route.path)
			.filter((path): path is string => Boolean(path))
			.map((path) => path.replace(/^\/+|\/+$/g, ""))
			.filter(Boolean)
		return `/${segments.join("/")}`
	}
}
