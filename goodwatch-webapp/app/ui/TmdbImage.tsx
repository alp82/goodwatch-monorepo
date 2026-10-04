import type React from "react"
import {
	type ImagePriority,
	type SizeRule,
	type TmdbImageKind,
	imageLoadingProps,
	tmdbFixedImage,
	tmdbFluidImage,
} from "~/utils/tmdb-image"

type ImgProps = Omit<
	React.ImgHTMLAttributes<HTMLImageElement>,
	"src" | "srcSet" | "sizes" | "loading" | "decoding" | "width" | "height"
>

export interface TmdbImageProps extends ImgProps {
	kind: TmdbImageKind
	path: string
	/**
	 * The displayed width in CSS pixels, for an image that is the same width in every layout.
	 * For an image whose width follows the viewport, pass `sizes` instead, and the largest
	 * displayed width as `maxWidth`.
	 */
	width?: number
	sizes?: SizeRule[]
	maxWidth?: number
	/** The narrowest the image is displayed, with `sizes`. */
	minWidth?: number
	/** Height over width, to set the height attribute. Posters and portraits are 1.5, backdrops 0.5625. */
	ratio?: number
	/** "lazy" by default. A page sets "eager" or "high" on the images it shows without scrolling. */
	priority?: ImagePriority
	imgRef?: React.Ref<HTMLImageElement>
}

const DEFAULT_RATIO: Record<TmdbImageKind, number | undefined> = {
	poster: 1.5,
	profile: 1.5,
	backdrop: 0.5625,
	logo: undefined,
}

/**
 * An image from TMDB at the size it is displayed. The real `src` is in the server HTML, so crawlers
 * and image search see it. The width and height attributes reserve the space, so nothing shifts.
 */
export function TmdbImage({
	kind,
	path,
	width,
	sizes,
	maxWidth,
	minWidth,
	ratio = DEFAULT_RATIO[kind],
	priority = "lazy",
	imgRef,
	alt = "",
	...rest
}: TmdbImageProps) {
	const base = width ?? maxWidth ?? 300
	const source = sizes
		? tmdbFluidImage(kind, path, sizes, {
				fallbackWidth: base,
				minWidth,
				maxWidth,
			})
		: tmdbFixedImage(kind, path, base)
	return (
		<img
			// loading comes before src: a browser starts the request when it sees src.
			{...imageLoadingProps(priority)}
			ref={imgRef}
			width={base}
			height={ratio ? Math.round(base * ratio) : undefined}
			sizes={source.sizes}
			srcSet={source.srcSet}
			src={source.src}
			{...rest}
			alt={alt}
		/>
	)
}
