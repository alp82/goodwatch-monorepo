// Published blog posts, discovery vocabularies and navigation lists available without catalog reads.
import posts from "~/content/blog/posts.json"
import { MOODS } from "~/domain/moods"
import { STYLES, THEMES } from "~/domain/themes-styles"
import { mainHierarchy } from "~/ui/explore/main-nav"
import { type Entry, discover } from "./matching.server"

export const moods: Entry[] = [
	...MOODS.map((m) => ({
		names: [m.name, ...m.aliases],
		popularity: 1,
		item: {
			key: `mood-${m.key}`,
			label: m.name,
			sub: m.description,
			href: discover({ moods: m.key }),
			image: { kind: "hue" as const, hue: m.hue },
		},
	})),
	...THEMES.map((m) => ({
		names: [m.name],
		popularity: 1,
		item: {
			key: `theme-${m.id}`,
			label: m.name,
			href: discover({ themes: m.id }),
			image: { kind: "hue" as const, hue: m.color },
		},
	})),
	...STYLES.map((m) => ({
		names: [m.name],
		popularity: 1,
		item: {
			key: `style-${m.id}`,
			label: m.name,
			href: discover({ styles: m.id }),
			image: { kind: "hue" as const, hue: m.color },
		},
	})),
]
export const lists: Entry[] = [
	...(["movies", "shows"] as const).map((type) => ({
		names: [`best ${type}`, `top ${type}`, `best of ${type}`],
		popularity: 1,
		item: {
			key: `list-best-${type}`,
			label: `Best ${type}`,
			href: `/${type}/best`,
			sub: "Ranked by GoodWatch score",
		},
	})),
	...Object.entries(mainHierarchy).flatMap(([category, pages]) =>
		Object.values(pages).flatMap((page) =>
			(page.type === "all" ? ["movies", "shows"] : [page.type]).map((type) => ({
				names: [
					page.label,
					`${page.label} ${type}`,
					`best ${page.label} ${type}`,
				],
				popularity: 0.8,
				item: {
					key: `list-${type}-${category}-${page.path}`,
					label: `${page.label} ${type}`,
					sub: page.subtitle,
					href: `/${type}/${category}/${page.path}`,
				},
			})),
		),
	),
]
export const blog: Entry[] = (
	posts as {
		slug: string
		title: string
		description: string
		published?: string
		draft?: boolean
	}[]
)
	.filter(
		(post) =>
			!post.draft &&
			!!post.published &&
			post.published <= new Date().toISOString().slice(0, 10),
	)
	.map((post) => ({
		names: [post.title, "blog"],
		textPrefix: post.description,
		popularity: 1,
		item: {
			key: `blog-${post.slug}`,
			label: post.title,
			sub: post.description,
			href: `/blog/${post.slug}`,
		},
	}))
