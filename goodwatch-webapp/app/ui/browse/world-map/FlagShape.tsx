// A country as its shape filled with its flag: the place's
// identity at a glance (the owner asked for it by name). The outline comes from the atlas's globe-facing projection, the
// flag from public/flags (3:2 SVGs). A territory too small for an outline (Hong Kong) is a round flag.
//
// the flag covers the whole shape (placed by hand: an SVG flag ignores `slice`), and `state` says how loud it
// is. Many flags at full strength at once are busy on the eye, so a list or a map hints them at rest:
//   "on"    full flag (the default; one flag beside its name, or the one that is picked)
//   "hover" almost full (the one under the pointer)
//   "rest"  hinted: the flag faint and nearly grey on the land color, the outline a little brighter
//   "hint"  "rest" that rises to "hover" while a parent with the class `group` is hovered or holds keyboard focus
import { useId } from "react"
import { countryFlagUrl } from "~/utils/country-flag"
import { countryOutline } from "~/ui/browse/world-map/CountryShape"
import { flagCover } from "~/ui/browse/world-map/flagBox"

export type FlagState = "on" | "hover" | "rest" | "hint"

// The image's look per state. Filter and opacity only, eased (the site's ease-out), so a change glides.
const LOOK: Record<FlagState, string> = {
	on: "opacity-100",
	hover: "opacity-90 saturate-[0.9]",
	rest: "opacity-45 saturate-[0.3]",
	hint: "opacity-45 saturate-[0.3] group-hover:opacity-90 group-hover:saturate-[0.9] group-focus-visible:opacity-90 group-focus-visible:saturate-[0.9]",
}
const EASE =
	"transition-[opacity,filter] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"

export function FlagShape({
	code,
	size = 48,
	className = "",
	title,
	state = "on",
}: {
	/** How loud the flag is (see the file's header). */
	state?: FlagState
	/** ISO 3166-1 alpha-2, any case. */
	code: string
	/** The box's longer side in px. */
	size?: number
	className?: string
	/** Read aloud; leave out when the name stands next to it. */
	title?: string
}) {
	const uid = useId().replace(/:/g, "")
	const outline = countryOutline(code)
	const flag = countryFlagUrl(code)
	const label = {
		role: title ? ("img" as const) : undefined,
		"aria-label": title,
		"aria-hidden": title ? undefined : (true as const),
	}
	if (!outline)
		return (
			<svg viewBox="0 0 100 100" width={size} height={size} {...label} className={className}>
				<clipPath id={`${uid}c`}>
					<circle cx={50} cy={50} r={46} />
				</clipPath>
				<circle cx={50} cy={50} r={46} fill="#334155" />
				<image
					href={flag}
					x={-25}
					y={0}
					width={150}
					height={100}
					preserveAspectRatio="none"
					clipPath={`url(#${uid}c)`}
					className={`${EASE} ${LOOK[state]}`}
				/>
				<circle
					cx={50}
					cy={50}
					r={46}
					fill="none"
					stroke="white"
					strokeOpacity={0.35}
					strokeWidth={2}
				/>
			</svg>
		)
	const { d, w, h } = outline
	const cover = flagCover(0, 0, w, h)
	const quiet = state === "rest" || state === "hint"
	const pad = 2
	const scale = size / 100
	return (
		<svg
			viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}
			width={Math.max(1, Math.round((w + pad * 2) * scale))}
			height={Math.max(1, Math.round((h + pad * 2) * scale))}
			{...label}
			className={`shrink-0 overflow-visible ${className}`}
		>
			<defs>
				<clipPath id={`${uid}c`}>
					<path d={d} />
				</clipPath>
				{/* A soft light from the top left, so the flag reads as a surface and not as a sticker. */}
				<linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
					<stop offset="0" stopColor="white" stopOpacity={0.22} />
					<stop offset="0.55" stopColor="white" stopOpacity={0} />
					<stop offset="1" stopColor="black" stopOpacity={0.25} />
				</linearGradient>
			</defs>
			<g clipPath={`url(#${uid}c)`}>
				<rect x={0} y={0} width={w} height={h} fill="#334155" />
				<image
					href={flag}
					{...cover}
					preserveAspectRatio="none"
					className={`${EASE} ${LOOK[state]}`}
				/>
				<rect x={0} y={0} width={w} height={h} fill={`url(#${uid}g)`} />
			</g>
			<path
				d={d}
				fill="none"
				stroke="white"
				strokeOpacity={quiet ? 0.5 : 0.4}
				strokeWidth={1}
				vectorEffect="non-scaling-stroke"
				strokeLinejoin="round"
			/>
		</svg>
	)
}
