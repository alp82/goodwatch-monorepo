// The trail of a page in the site's hierarchy: hub, list, page. The visible breadcrumb (Breadcrumbs.tsx) and the
// BreadcrumbList structured data come from the same items, so they always agree.
import { convertHyphensToWords } from "~/utils/string"

export interface Crumb {
	label: string
	/** The page's path on goodwatch.app. */
	path: string
}

/** A category page's label as a breadcrumb says it: without the emoji a mood's label ends with. */
export const crumbLabel = (label: string) =>
	label.replace(/(?:\s|\p{Extended_Pictographic}|\uFE0F)+$/u, "")

/**
 * The trail of a category page from its path: `/movies/moods/mind-bending` is Movies › Moods › Mind-Bending. The
 * last item takes the page's own label when there is one, as in Sci-Fi & Fantasy.
 */
export const categoryCrumbs = (path: string, pageLabel?: string): Crumb[] => {
	const parts = path.split("/").filter(Boolean)
	return parts.map((part, index) => ({
		label:
			pageLabel && index === parts.length - 1
				? crumbLabel(pageLabel)
				: convertHyphensToWords(part),
		path: `/${parts.slice(0, index + 1).join("/")}`,
	}))
}

/** A title page's trail: the hub and genre page above it, then the title. */
export const titleTrail = (
	above: readonly Crumb[],
	title: string,
	path: string,
): Crumb[] => (above.length ? [...above, { label: title, path }] : [])

/** The BreadcrumbList for a trail of at least two items; null for a shorter one, which is no trail. */
export const breadcrumbJsonLd = (crumbs: readonly Crumb[]) =>
	crumbs.length < 2
		? null
		: {
				"@context": "https://schema.org",
				"@type": "BreadcrumbList",
				itemListElement: crumbs.map((crumb, index) => ({
					"@type": "ListItem",
					position: index + 1,
					name: crumb.label,
					item: `https://goodwatch.app${crumb.path}`,
				})),
			}
