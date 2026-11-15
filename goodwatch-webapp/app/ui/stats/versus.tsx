// The Disagreements rows' score standoff under each poster. Two sources face each other across a slanted seam in
// their brand colors (the intro's brand cards, ui/living-room/intro/parts/brand-cards.tsx), a VS badge on the seam, the
// winner bright and big, the loser dimmed and small, and a tug-of-war bar under them on a common 0-100 scale: the knot
// sits half the gap away from the middle, toward the winner. The badge is where the standoff's lightning clash lands
// (effects/spots.ts, `dis-row`).
import type { CSSProperties } from "react"
import imdbLogo from "~/img/imdb-logo-250.webp?no-inline"
import letterboxdLogo from "~/img/letterboxd-dots.svg?no-inline"
import metacriticLogo from "~/img/metacritic-logo-icon-64.webp?no-inline"
import rottenLogo from "~/img/rotten-logo-icon-64.webp"
import { assetUrl } from "~/utils/asset-url"

export type VsSource = "imdb" | "lb" | "rt" | "rta" | "mc" | "mcu"

export type VsSide = {
	source: VsSource
	/** The score as the source writes it: "5.7", "1.6", "15", "84", "4.3". */
	n: string
	/** The same score on 0-100. */
	pct: number
}

/** Metacritic's own score colors, as the brand cards use them. */
const metaColor = (pct: number) =>
	pct >= 61 ? "#00ce7a" : pct >= 40 ? "#ffbd3f" : "#ff6874"

type Brand = {
	/** The half's background and text. */
	bg: string
	fg: string
	/** The tug bar's color for this side (Letterboxd's slate would vanish on the page, so its green dot). */
	bar: string
	logo: string
	alt: string
	/** Square icons sit on a white disc, as on the brand cards. */
	disc?: boolean
	/** Who speaks, where the logo alone doesn't say (both Rotten Tomatoes sides, both Metacritic sides). */
	who?: string
	unit?: string
}

function brandOf(s: VsSide): Brand {
	switch (s.source) {
		case "imdb":
			return {
				bg: "#f5c518",
				fg: "#000",
				bar: "#f5c518",
				logo: imdbLogo,
				alt: "IMDb",
			}
		case "lb":
			return {
				bg: "#2c3440",
				fg: "#fff",
				bar: "#00e054",
				logo: letterboxdLogo,
				alt: "Letterboxd",
				unit: "/5",
			}
		case "rt":
			return {
				bg: "#fa320a",
				fg: "#fff",
				bar: "#fa320a",
				logo: rottenLogo,
				alt: "Rotten Tomatoes",
				disc: true,
				who: "Critics",
				unit: "%",
			}
		case "rta":
			return {
				bg: "#ff8a00",
				fg: "#1a0d00",
				bar: "#ff8a00",
				logo: rottenLogo,
				alt: "Rotten Tomatoes",
				disc: true,
				who: "Audience",
				unit: "%",
			}
		case "mc":
			return {
				bg: metaColor(s.pct),
				fg: "#04120a",
				bar: metaColor(s.pct),
				logo: metacriticLogo,
				alt: "Metacritic",
				disc: true,
				who: "Critics",
			}
		case "mcu":
			return {
				bg: "#14161c",
				fg: metaColor(s.pct),
				bar: metaColor(s.pct),
				logo: metacriticLogo,
				alt: "Metacritic",
				disc: true,
				who: "Users",
			}
	}
}

const NAME: Record<VsSource, string> = {
	imdb: "IMDb",
	lb: "Letterboxd",
	rt: "Rotten Tomatoes critics",
	rta: "Rotten Tomatoes audience",
	mc: "Metacritic critics",
	mcu: "Metacritic users",
}

/** The seam's slant: the two halves meet on a line from SEAM_TOP at the top to SEAM_BOTTOM at the bottom. */
const SEAM_TOP = "56%"
const SEAM_BOTTOM = "44%"

function Half({
	s,
	side,
	wins,
}: { s: VsSide; side: "left" | "right"; wins: boolean }) {
	const b = brandOf(s)
	const left = side === "left"
	return (
		<div
			className={`relative flex min-w-0 flex-col gap-0.5 px-2 py-1.5 ${left ? "items-start pr-4" : "items-end pl-4"} ${wins ? "" : "opacity-90"}`}
			style={{ color: wins ? b.fg : b.bar } as CSSProperties}
		>
			<span className="flex h-4 items-center">
				{b.disc ? (
					<span className="flex size-4 items-center justify-center rounded-full bg-white p-[2px] shadow-sm">
						<img src={assetUrl(b.logo)} alt={b.alt} className="h-full w-auto" />
					</span>
				) : (
					<img
						src={assetUrl(b.logo)}
						alt={b.alt}
						className={
							s.source === "imdb"
								? "h-3 rounded-[2px] shadow-[0_0_0_1.5px_rgba(0,0,0,.85)]"
								: "h-3"
						}
					/>
				)}
			</span>
			<span
				data-vs-n
				className={`font-['Gabarito'] leading-none font-extrabold tracking-[-0.02em] tabular-nums ${wins ? "text-[22px]" : "text-[15px]"}`}
			>
				{s.n}
				{b.unit && (
					<small className="ml-px text-[0.5em] font-bold opacity-70">
						{b.unit}
					</small>
				)}
			</span>
			{b.who && (
				<span className="text-[9px] leading-none font-extrabold tracking-[0.12em] uppercase opacity-80">
					{b.who}
				</span>
			)}
		</div>
	)
}

/** Two scores facing off: `a` on the left, `b` on the right. */
export function VsStandoff({ a, b }: { a: VsSide; b: VsSide }) {
	const A = brandOf(a)
	const B = brandOf(b)
	const aWins = a.pct >= b.pct
	const gap = Math.round(Math.abs(a.pct - b.pct))
	// the knot: half the gap from the middle, toward the winner
	const knot = Math.min(96, Math.max(4, 50 + (a.pct - b.pct) / 2))
	// the winner's half in its brand color, the loser's in shadow: the page's dark with a tint of its brand
	// (Metacritic's users card is dark already: when it wins, its score color lights it a little more)
	const face = (x: Brand, s: VsSide, wins: boolean) =>
		!wins
			? `color-mix(in srgb, ${x.bar} 16%, #0d0f14)`
			: s.source === "mcu"
				? `color-mix(in srgb, ${x.bar} 26%, ${x.bg})`
				: x.bg
	const label = `${NAME[a.source]} ${a.n}${A.unit ?? ""} against ${NAME[b.source]} ${b.n}${B.unit ?? ""}, ${gap} points apart`
	return (
		<div
			data-fx-spot="dis-row"
			role="img"
			aria-label={label}
			className="flex flex-col gap-1.5"
		>
			<div className="relative isolate overflow-hidden rounded-lg shadow-[0_6px_16px_rgba(0,0,0,.45),inset_0_0_0_1px_rgba(255,255,255,.12)]">
				<span
					aria-hidden
					className="absolute inset-0 -z-10"
					style={{
						background: face(A, a, aWins),
						clipPath: `polygon(0 0, ${SEAM_TOP} 0, ${SEAM_BOTTOM} 100%, 0 100%)`,
					}}
				/>
				<span
					aria-hidden
					className="absolute inset-0 -z-10"
					style={{
						background: face(B, b, !aWins),
						clipPath: `polygon(${SEAM_TOP} 0, 100% 0, 100% 100%, ${SEAM_BOTTOM} 100%)`,
					}}
				/>
				{/* the seam: a dark hairline along the slant */}
				{/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative, the halves carry the text */}
				<svg
					aria-hidden
					className="absolute inset-0 -z-10 size-full"
					preserveAspectRatio="none"
					viewBox="0 0 100 100"
				>
					<line
						x1="56"
						y1="0"
						x2="44"
						y2="100"
						stroke="#0b0d12"
						strokeWidth="3"
						vectorEffect="non-scaling-stroke"
					/>
				</svg>
				<div className="grid grid-cols-2 items-center">
					<Half s={a} side="left" wins={aWins} />
					<Half s={b} side="right" wins={!aWins} />
				</div>
				<span
					data-fx-vs
					aria-hidden
					className="absolute top-1/2 left-1/2 flex size-[26px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gray-950 font-['Gabarito'] text-[10px] font-black tracking-[-0.02em] text-amber-300 italic shadow-[0_0_0_2px_rgba(251,191,36,.8),0_2px_6px_rgba(0,0,0,.6)]"
				>
					VS
				</span>
			</div>
			{/* the tug of war on 0-100: the winner's color pulls the knot past the middle */}
			<div aria-hidden className="relative h-1.5">
				<span
					className="absolute inset-y-0 left-0 rounded-l-full"
					style={{
						width: `${knot}%`,
						background: A.bar,
						opacity: aWins ? 1 : 0.45,
					}}
				/>
				<span
					className="absolute inset-y-0 right-0 rounded-r-full"
					style={{
						width: `${100 - knot}%`,
						background: B.bar,
						opacity: aWins ? 0.45 : 1,
					}}
				/>
				<span className="absolute -top-0.5 -bottom-0.5 left-1/2 w-px -translate-x-1/2 bg-white/50" />
				<span
					className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-gray-900"
					style={{ left: `${knot}%` }}
				/>
			</div>
		</div>
	)
}
