// The world map: real country outlines (Natural Earth, Equal Earth projection; shapes.ts is generated), where every
// country that has a page is a link.
//
// What each element means:
// - a brighter country has a page; the brightness follows its `weight` (how much there is to see), within a narrow band;
// - the amber country is the page you are on (`active`);
// - a small dot marks a listed territory too small to draw (Hong Kong, Singapore);
// - a name appears for the country under the pointer or the keyboard focus only, so names never collide.
//
// Two shapes of the same map:
// - `page`: the whole world with a switch that moves in on a region (Europe's countries are a few pixels wide at
//   world scale), and a list of the countries by region beside it. The list and the map light each other up.
// - `hero`: a wide strip around the active country, for the top of a country's page. The title goes beside it, or
//   over its left with `fade="left"`. The frame keeps the country in its middle at any width.
import { Link, useNavigate } from "@remix-run/react"
import {
	type CSSProperties,
	type MouseEvent,
	memo,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import { SegmentedTabs } from "~/ui/details/SegmentedTabs"
import { Caption } from "~/ui/eyebrow"
import {
	type Box,
	REGION_NAME,
	REGION_ORDER,
	SHAPE_BY_CODE,
	emphasisOf,
	fitTransform,
	gainOf,
	heroBoxOf,
	isSmall,
	isTiny,
	regionsOf,
	tallFrameOf,
	viewBoxOf,
} from "./geometry"
import { VIEW_BOX, WORLD_SHAPES, type WorldRegion, type WorldShape, type WorldView } from "./shapes"

export interface WorldMapCountry {
	/** ISO 3166-1 alpha-2, such as "JP". */
	code: string
	name: string
	/** The country's page. */
	href: string
	/** How much there is to see, in any unit; only the order and rough proportion among the countries matter. */
	weight?: number
}

export interface WorldMapProps {
	countries: readonly WorldMapCountry[]
	/** The country of the current page, drawn in amber. */
	active?: string
	variant?: "page" | "hero"
	/** `page`: the view to start with. */
	initialView?: WorldView
	/** `page`: the countries by region beside the map (below it on a phone). */
	list?: boolean
	/**
	 * `hero`: how the strip ends. `edges` (default) lets it fade out on every side, for a title beside it. `left` puts
	 * the country in the right half and fades the left half out, for a title over the left 40% of the strip.
	 */
	fade?: "edges" | "left"
	/** Tells the page which country is under the pointer or focus, for a preview of its own. */
	onHotChange?: (code: string | null) => void
	/** Layout only. For `hero` it sets the frame's shape (default: 16:10 on a phone, 2.4:1 from `sm`). */
	className?: string
}

const SEA_LINE = "stroke-gray-900"
const MOVE =
	"transition-transform duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"

const PANEL =
	"w-full rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.08] aspect-[3/2] sm:[aspect-ratio:var(--wm-aspect)]"
// The hero has no frame: the land thins out toward its edges instead of ending at a cut.
const FADE_EDGES =
	"[mask-image:linear-gradient(to_right,transparent,black_16%,black_84%,transparent),linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)] [mask-composite:intersect] [-webkit-mask-composite:source-in]"
const FADE_LEFT =
	"[mask-image:linear-gradient(to_right,transparent_20%,black_52%,black_92%,transparent),linear-gradient(to_bottom,transparent,black_14%,black_86%,transparent)] [mask-composite:intersect] [-webkit-mask-composite:source-in]"

const boxString = (box: Box) => `${box[0]} ${box[1]} ${box[2] - box[0]} ${box[3] - box[1]}`

/** Every country without a page, as one quiet shape. It never changes, so it renders once. */
const Land = memo(function Land({ skip }: { skip: string }) {
	const d = useMemo(() => {
		const listed = new Set(skip.split(","))
		return WORLD_SHAPES.filter((shape) => shape.d && !listed.has(shape.code))
			.map((shape) => shape.d)
			.join("")
	}, [skip])
	return (
		<path
			d={d}
			className={`fill-white/[0.055] ${SEA_LINE}`}
			strokeWidth={1}
			vectorEffect="non-scaling-stroke"
			strokeLinejoin="round"
		/>
	)
})

type Placed = WorldMapCountry & { shape: WorldShape }

const tabsOf = (regions: readonly WorldRegion[]) => [
	{ key: "world", label: REGION_NAME.world },
	...regions.map((region) => ({ key: region, label: REGION_NAME[region] })),
]

export function WorldMap({
	countries,
	active,
	variant = "page",
	initialView = "world",
	list = variant === "page",
	fade = "edges",
	onHotChange,
	className = "",
}: WorldMapProps) {
	const navigate = useNavigate()
	const frameRef = useRef<HTMLDivElement>(null)
	const [view, setView] = useState<WorldView>(initialView)
	const [hot, setHot] = useState<string | null>(null)
	const [focused, setFocused] = useState<string | null>(null)
	const [label, setLabel] = useState<{
		x: number
		y: number
		below: boolean
		glide: boolean
	} | null>(null)
	const shown = useRef(false)

	// Largest first, so a small country is drawn (and hit) over a large neighbor's wide hit area.
	const placed = useMemo(() => {
		const out: Placed[] = []
		for (const country of countries) {
			const shape = SHAPE_BY_CODE.get(country.code.toUpperCase())
			if (shape) out.push({ ...country, code: shape.code, shape })
		}
		const size = (p: Placed) =>
			(p.shape.box[2] - p.shape.box[0]) * (p.shape.box[3] - p.shape.box[1])
		return out.sort((a, b) => size(b) - size(a))
	}, [countries])
	const codes = useMemo(() => placed.map((p) => p.code), [placed])
	const maxWeight = useMemo(() => Math.max(0, ...placed.map((p) => p.weight ?? 0)), [placed])
	const activeCode = active?.toUpperCase()
	const activeShape = activeCode ? SHAPE_BY_CODE.get(activeCode) : undefined
	const activeListed = placed.some((p) => p.code === activeCode)

	const hero = variant === "hero" && activeShape
	const frame: Box = hero
		? heroBoxOf(activeShape, 2.4, fade === "left" ? 0.72 : 0.5)
		: VIEW_BOX.world
	const regions = useMemo(() => regionsOf(codes), [codes])
	const target = hero ? frame : viewBoxOf(view, codes)
	const move = hero ? { scale: 1, x: 0, y: 0 } : fitTransform(frame, target)
	// A phone's frame is taller (3:2), so a region comes closer there; the SVG shows what lies above and below its
	// view box, and a media query picks the transform.
	const tall = tallFrameOf(frame)
	const moveTall = hero ? move : fitTransform(tall, target)
	// A dot is a fixed share of what the frame shows, so it keeps its size on screen through every view.
	const dot = ((frame[2] - frame[0]) * 0.0045) / move.scale

	const heat = (code: string | null) => {
		setHot(code)
		onHotChange?.(code)
	}

	// The name sits over the country's label point, wherever the current view puts it on screen.
	useLayoutEffect(() => {
		const host = frameRef.current
		const marker = hot && host?.querySelector<SVGCircleElement>(`[data-at="${hot}"]`)
		if (!host || !marker) {
			shown.current = false
			setLabel(null)
			return
		}
		const box = host.getBoundingClientRect()
		const at = marker.getBoundingClientRect()
		const x = Math.min(Math.max(at.left + at.width / 2 - box.left, 64), box.width - 64)
		const y = Math.min(Math.max(at.top + at.height / 2 - box.top, 0), box.height)
		setLabel({ x, y, below: y < 52, glide: shown.current })
		shown.current = true
	}, [hot])

	// A view change moves every country: drop the name instead of leaving it behind.
	useEffect(() => {
		setHot(null)
	}, [view])

	const go = (event: MouseEvent, href: string) => {
		if (
			event.defaultPrevented ||
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		)
			return
		event.preventDefault()
		navigate(href)
	}

	const focusShape = focused ? SHAPE_BY_CODE.get(focused) : undefined
	const hotName = hot ? (placed.find((p) => p.code === hot)?.name ?? null) : null

	const map = (
		<div
			ref={frameRef}
			className={`relative overflow-hidden ${
				hero
					? `${className || "aspect-[16/10] sm:aspect-[2.4/1]"} ${fade === "left" ? FADE_LEFT : FADE_EDGES}`
					: PANEL
			}`}
			style={
				hero
					? undefined
					: ({ "--wm-aspect": `${frame[2] - frame[0]} / ${frame[3] - frame[1]}` } as CSSProperties)
			}
		>
			<svg
				viewBox={boxString(frame)}
				preserveAspectRatio={
					hero ? (fade === "left" ? "xMaxYMid slice" : "xMidYMid slice") : "xMidYMid meet"
				}
				className="absolute inset-0 h-full w-full"
			>
				<g
					className={`${MOVE} [transform:var(--wm-tall)] sm:[transform:var(--wm-wide)]`}
					style={
						{
							"--wm-wide": `translate(${move.x}px, ${move.y}px) scale(${move.scale})`,
							"--wm-tall": `translate(${moveTall.x}px, ${moveTall.y}px) scale(${moveTall.scale})`,
							transformOrigin: "0 0",
						} as CSSProperties
					}
				>
					<Land skip={codes.join(",")} />
					{activeShape && !activeListed && activeShape.d && (
						<path
							d={activeShape.d}
							className={`fill-amber-400 ${SEA_LINE}`}
							strokeWidth={1}
							vectorEffect="non-scaling-stroke"
						/>
					)}
					{placed.map((p) => {
						const on = p.code === activeCode
						const lit = p.code === hot
						const tiny = isTiny(p.shape)
						return (
							<a
								key={p.code}
								href={p.href}
								aria-label={p.name}
								aria-current={on ? "page" : undefined}
								onClick={(event) => go(event, p.href)}
								onPointerEnter={(event) => event.pointerType === "mouse" && heat(p.code)}
								onPointerLeave={(event) => event.pointerType === "mouse" && heat(null)}
								onFocus={(event) => {
									heat(p.code)
									if (event.currentTarget.matches(":focus-visible")) setFocused(p.code)
								}}
								onBlur={() => {
									heat(null)
									setFocused(null)
								}}
								className="cursor-pointer outline-none"
							>
								{/* A wider area to hit, for the countries a pointer would miss. */}
								{isSmall(p.shape) && !tiny && (
									<path
										d={p.shape.d}
										fill="none"
										stroke="transparent"
										strokeWidth={12}
										vectorEffect="non-scaling-stroke"
										pointerEvents="stroke"
									/>
								)}
								{p.shape.d && (
									<path
										d={p.shape.d}
										className={`${SEA_LINE} transition-[fill,fill-opacity] duration-200 ${
											on ? "fill-amber-400" : "fill-white"
										}`}
										style={{
											fillOpacity: on
												? lit
													? 0.85
													: 1
												: lit
													? 0.9
													: emphasisOf(p.weight, maxWeight) * (hero ? 0.6 : 1),
										}}
										strokeWidth={1}
										vectorEffect="non-scaling-stroke"
										strokeLinejoin="round"
									/>
								)}
								{tiny && (
									<>
										<circle
											cx={p.shape.at[0]}
											cy={p.shape.at[1]}
											r={dot * 3.2}
											fill="transparent"
										/>
										<circle
											cx={p.shape.at[0]}
											cy={p.shape.at[1]}
											r={dot}
											className={`transition-[fill,fill-opacity] duration-200 ${on ? "fill-amber-400" : "fill-white"}`}
											style={{ fillOpacity: on || lit ? 1 : 0.6 }}
										/>
									</>
								)}
								{/* Where the name goes; measured on screen, never drawn. */}
								<circle
									data-at={p.code}
									cx={p.shape.at[0]}
									cy={p.shape.at[1]}
									r={0.01}
									fill="none"
									pointerEvents="none"
								/>
							</a>
						)
					})}
					{/* The keyboard's place: an outline over every neighbor's border. */}
					{focusShape && (
						<>
							{focusShape.d && (
								<path
									d={focusShape.d}
									fill="none"
									className="stroke-amber-400"
									strokeWidth={2}
									vectorEffect="non-scaling-stroke"
									strokeLinejoin="round"
									pointerEvents="none"
								/>
							)}
							{isTiny(focusShape) && (
								<circle
									cx={focusShape.at[0]}
									cy={focusShape.at[1]}
									r={dot * 2.2}
									fill="none"
									className="stroke-amber-400"
									strokeWidth={2}
									vectorEffect="non-scaling-stroke"
									pointerEvents="none"
								/>
							)}
						</>
					)}
				</g>
			</svg>
			<div
				aria-hidden
				className={`pointer-events-none absolute left-0 top-0 z-10 motion-reduce:transition-none ${
					label?.glide
						? "transition-[transform,opacity] duration-200 ease-out"
						: "transition-opacity duration-150"
				} ${label && hotName ? "opacity-100" : "opacity-0"}`}
				style={{ transform: `translate3d(${label?.x ?? 0}px, ${label?.y ?? 0}px, 0)` }}
			>
				<div
					className={`absolute left-0 whitespace-nowrap rounded-md bg-gray-950/95 px-2.5 py-1 text-[13px] font-semibold text-white shadow-lg shadow-black/40 ring-1 ring-white/15 ${
						label?.below ? "top-3 -translate-x-1/2" : "bottom-3 -translate-x-1/2"
					}`}
				>
					{hotName}
				</div>
			</div>
		</div>
	)

	if (hero || variant === "hero") return map

	const wideRegions = regions.filter((region) => gainOf(frame, viewBoxOf(region, codes)) >= 1.6)
	const groups = REGION_ORDER.map((region) => ({
		region,
		items: placed
			.filter((p) => p.shape.region === region)
			.sort((a, b) => a.name.localeCompare(b.name)),
	}))
		.filter((group) => group.items.length)
		.sort((a, b) => b.items.length - a.items.length)

	return (
		<div className={`flex flex-col gap-4 ${className}`}>
			{/* A region earns a tab where it brings its countries clearly closer: every region on a phone's taller frame,
			    on a wide screen only the dense ones (Europe). */}
			{regions.length > 1 && (
				<>
					<SegmentedTabs
						label="Part of the world"
						value={view}
						onChange={(key) => setView(key as WorldView)}
						tabs={tabsOf(regions)}
						className="sm:hidden"
					/>
					{wideRegions.length > 0 && (
						<SegmentedTabs
							label="Part of the world"
							value={wideRegions.includes(view as WorldRegion) ? view : "world"}
							onChange={(key) => setView(key as WorldView)}
							tabs={tabsOf(wideRegions)}
							className="max-sm:hidden"
						/>
					)}
				</>
			)}
			<div
				className={
					list ? "grid items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_19rem]" : ""
				}
			>
				{map}
				{list && (
					<nav
						aria-label="Countries"
						className="columns-2 gap-x-8 [&>div]:mb-5 [&>div]:break-inside-avoid"
					>
						{groups.map((group) => (
							<div key={group.region}>
								<Caption as="h3" className="mb-1.5">
									{REGION_NAME[group.region]}
								</Caption>
								<ul>
									{group.items.map((p) => {
										const on = p.code === activeCode
										const lit = p.code === hot
										return (
											<li key={p.code}>
												<Link
													to={p.href}
													prefetch="intent"
													aria-current={on ? "page" : undefined}
													onPointerEnter={(event) => event.pointerType === "mouse" && heat(p.code)}
													onPointerLeave={(event) => event.pointerType === "mouse" && heat(null)}
													onFocus={() => heat(p.code)}
													onBlur={() => heat(null)}
													className={`flex items-center gap-2 rounded py-1 text-sm font-semibold outline-none transition-[color,transform] duration-150 focus-visible:ring-2 focus-visible:ring-amber-400 motion-reduce:transition-none ${
														on
															? "text-amber-300"
															: lit
																? "translate-x-0.5 text-white"
																: "text-gray-300"
													}`}
												>
													{on && (
														<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
													)}
													{p.name}
												</Link>
											</li>
										)
									})}
								</ul>
							</div>
						))}
					</nav>
				)}
			</div>
		</div>
	)
}
