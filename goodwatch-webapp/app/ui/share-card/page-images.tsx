// A card on a page shows its title images at a fraction of the card's native size, but the card data carries one large
// file per image, because the PNG export draws the card at full size. This module gives the images of a rendered card
// a srcSet and sizes for the width the page shows them at, and marks the largest one as the page's largest image.
//
// The designs stay untouched: they are plain functions without hooks (the image renderer calls them that way too), so
// the card's element tree can be resolved here and its <img> elements adjusted before React renders them.
import {
	type ReactElement,
	type ReactNode,
	cloneElement,
	isValidElement,
} from "react"
import {
	type SizeRule,
	TMDB_IMAGE_BASE,
	type TmdbImageKind,
	imageLoadingProps,
	tmdbFluidImage,
} from "~/utils/tmdb-image"
import type { CardDesign, CardTitle } from "./model"

/** How wide a page shows a whole card: sizes rules as for tmdbSizes, and the widest it gets in CSS pixels. */
export interface CardDisplay {
	rules: SizeRule[]
	maxWidth: number
}

type Props = Record<string, unknown> & { children?: ReactNode }

const tmdbPath = (src: string) =>
	src.startsWith(`${TMDB_IMAGE_BASE}/`)
		? src.slice(TMDB_IMAGE_BASE.length + 1).replace(/^[^/]+\//, "")
		: null

const scaleLength = (length: string, factor: number) => {
	const px = /^(\d+(?:\.\d+)?)px$/.exec(length)
	return px
		? `${Math.ceil(Number(px[1]) * factor)}px`
		: `calc(${length} * ${factor.toFixed(4)})`
}

// Calls the function components down to host elements, keeping keys.
function resolve(
	node: ReactNode,
	visit: (img: ReactElement<Props>) => ReactElement<Props>,
): ReactNode {
	if (Array.isArray(node)) return node.map((child) => resolve(child, visit))
	if (!isValidElement<Props>(node)) return node
	if (typeof node.type === "function") {
		const rendered = resolve(
			(node.type as (props: Props) => ReactNode)(node.props),
			visit,
		)
		return node.key != null && isValidElement(rendered)
			? cloneElement(rendered, { key: node.key })
			: rendered
	}
	if (node.type === "img") return visit(node)
	const { children } = node.props
	if (children == null) return node
	// Spread, so that children written in JSX don't become a list that needs keys.
	return Array.isArray(children)
		? cloneElement(
				node,
				undefined,
				...children.map((child) => resolve(child, visit)),
			)
		: cloneElement(node, undefined, resolve(children, visit))
}

/**
 * The card's element tree, with every title image sized for `display`. An image is sized by the width of its box in
 * the design. The image with the largest box is fetched with high priority.
 */
export function cardForPage(
	design: CardDesign,
	card: Parameters<CardDesign["Card"]>[0],
	display: CardDisplay,
): ReactNode {
	const kinds = new Map<string, TmdbImageKind>()
	for (const item of card.items as CardTitle[]) {
		if (item.poster) kinds.set(item.poster, "poster")
		if (item.backdrop) kinds.set(item.backdrop, "backdrop")
	}
	const boxWidth = (img: ReactElement<Props>) => Number(img.props.width) || 0
	const titleImage = (img: ReactElement<Props>) =>
		typeof img.props.src === "string" &&
		kinds.has(img.props.src) &&
		boxWidth(img) > 0

	const area = (img: ReactElement<Props>) =>
		boxWidth(img) * (Number(img.props.height) || 0)

	// First pass: find the largest title image.
	const largest = { src: "", area: 0 }
	const tree = resolve(design.Card(card), (img) => {
		if (titleImage(img) && area(img) > largest.area)
			Object.assign(largest, { src: img.props.src, area: area(img) })
		return img
	})
	let prioritized = false
	return resolve(tree, (img) => {
		if (!titleImage(img)) return img
		const src = img.props.src as string
		const path = tmdbPath(src)
		if (!path) return img
		const share = boxWidth(img) / design.w
		const source = tmdbFluidImage(
			kinds.get(src) as TmdbImageKind,
			path,
			display.rules.map(([condition, length]) => [
				condition,
				scaleLength(length, share),
			]),
			{
				fallbackWidth: display.maxWidth * share,
				maxWidth: display.maxWidth * share,
			},
		)
		const high =
			!prioritized && largest.src === src && area(img) === largest.area
		if (high) prioritized = true
		return cloneElement(img, {
			...(high ? imageLoadingProps("high") : {}),
			sizes: source.sizes,
			srcSet: source.srcSet,
			src: source.src,
		})
	})
}
