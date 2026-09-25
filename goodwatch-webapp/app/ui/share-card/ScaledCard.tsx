// A share card rendered in the page at its native pixel size and scaled to fit. With `fill`, it fits the box it
// is given (the parent must give it a definite height); otherwise it fits the width, capped at maxHeight.
import {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react"
import { cardFontFaceCss } from "~/ui/share-card/fonts"
import type { CardDesign, CardProps } from "~/ui/share-card/model"

// Measures before paint in the browser; on the server there is nothing to measure.
export const useIsomorphicLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

export function ScaledCard({
	design,
	card,
	maxHeight = 10000,
	fill,
	editing,
	className = "",
	children,
}: {
	design: CardDesign
	card: Omit<CardProps, "editing">
	maxHeight?: number
	fill?: boolean
	editing?: boolean
	className?: string
	children?: ReactNode
}) {
	const ref = useRef<HTMLDivElement>(null)
	const [box, setBox] = useState({ w: 0, h: 0 })
	useIsomorphicLayoutEffect(() => {
		const el = ref.current
		if (!el) return
		const observer = new ResizeObserver(([entry]) =>
			setBox({ w: entry.contentRect.width, h: entry.contentRect.height }),
		)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])
	const scale = box.w
		? Math.min(box.w / design.w, (fill ? box.h : maxHeight) / design.h)
		: 0
	return (
		<div
			ref={ref}
			className={`flex w-full min-w-0 items-center justify-center ${fill ? "h-full min-h-0 [contain:size]" : "[contain:inline-size]"}`}
		>
			<div
				className={`relative shrink-0 overflow-hidden ${className}`}
				style={{
					width: design.w * scale,
					height: design.h * scale,
					visibility: scale ? "visible" : "hidden",
				}}
			>
				<div
					className="absolute top-0 left-0 origin-top-left"
					style={{
						width: design.w,
						height: design.h,
						transform: `scale(${scale})`,
					}}
				>
					<design.Card {...card} editing={editing} />
					{children}
				</div>
			</div>
		</div>
	)
}

/** The @font-face rules for card fonts. Render once on any page that shows cards. */
// Set as raw HTML: as a text child, the quotes would be escaped differently on the server and in the browser.
export const CardFonts = () => (
	<style dangerouslySetInnerHTML={{ __html: cardFontFaceCss }} />
)
