// Small shared pieces for character portraits: the picture itself and TheTVDB's credit.
import { PORTRAIT_HEIGHT, PORTRAIT_WIDTH } from "~/domain/character-portraits"

/**
 * A TheTVDB portrait (an external 300×450 picture), cropped from the top so small crops keep the face. Its width and
 * height give the box its 2:3 shape before it loads; `className` sizes it.
 */
export function PortraitImg({
	src,
	alt,
	className = "",
	eager = false,
}: {
	src: string
	alt: string
	className?: string
	/** Pictures that start on screen in a view that just opened. */
	eager?: boolean
}) {
	return (
		<img
			src={src}
			alt={alt}
			width={PORTRAIT_WIDTH}
			height={PORTRAIT_HEIGHT}
			loading={eager ? "eager" : "lazy"}
			decoding="async"
			draggable={false}
			className={`object-cover object-top ${className}`}
		/>
	)
}

/** TheTVDB asks for credit wherever its pictures show. */
export function TvdbCredit({ className = "" }: { className?: string }) {
	return (
		<p className={`text-[11px] text-gray-500 ${className}`}>
			Character images:{" "}
			<a
				href="https://thetvdb.com"
				target="_blank"
				rel="noreferrer"
				className="underline decoration-gray-600 underline-offset-2 hover:text-gray-300"
			>
				TheTVDB
			</a>
		</p>
	)
}
