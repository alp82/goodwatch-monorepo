// PROTOTYPE - throwaway (prototype/explore-r5, slot "places"). Pieces the places variants share: a country's outline
// and the compact head.
import type { ReactNode } from "react"
import { Kicker } from "~/ui/eyebrow"
import { PageTitle } from "~/ui/heading"
import { CountryShape } from "../../../../kit/world-map/CountryShape"
import { WRAP } from "../../../../kit/ui"
import { SHAPE_BY_CODE, isTiny } from "../../../../kit/world-map/geometry"

/**
 * A country's outline in the text color. A territory too small to have a real outline at the map's detail (Hong Kong)
 * is the dot it is on the map.
 */
export function Outline({ code, size }: { code: string; size: number }) {
	const shape = SHAPE_BY_CODE.get(code.toUpperCase())
	if (shape && isTiny(shape)) {
		const d = Math.max(8, Math.round(size * 0.3))
		return (
			<span
				aria-hidden
				className="block rounded-full bg-current"
				style={{
					width: d,
					height: d,
					boxShadow: `0 0 0 ${Math.round(d * 0.55)}px color-mix(in oklab, currentColor 22%, transparent)`,
				}}
			/>
		)
	}
	return <CountryShape code={code} size={size} />
}

/** A head that leaves the first screen to the map: the title, one line, and the page's own control beside it. */
export function PlacesHead({
	kicker,
	title,
	lede,
	children,
}: {
	kicker: string
	title: string
	lede?: string | null
	children?: ReactNode
}) {
	return (
		<header className={`${WRAP} pt-6 pb-4 sm:pt-7`}>
			<Kicker>{kicker}</Kicker>
			{/* On a phone the control sits last, right over the map it moves. */}
			<div className="mt-1.5 grid gap-x-8 gap-y-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
				<PageTitle className="text-3xl leading-[1.05] tracking-tight text-white sm:text-4xl">
					{title}
				</PageTitle>
				{children && <div className="max-sm:order-3 max-sm:mt-1">{children}</div>}
				{lede && (
					<p className="leading-relaxed text-pretty text-gray-300 max-sm:order-2 sm:col-span-2">
						{lede}
					</p>
				)}
			</div>
		</header>
	)
}
