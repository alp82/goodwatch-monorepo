// An app's picture on home: real art, posters side by side, or a drawing for Explorer and Taste. Home's row and
// home's guide (HomeGuide.tsx) draw the same pictures.
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { Img } from "../kit"
import type { TvAppArt } from "../tv-home"

/** Explorer's identity: islands on the sea, joined by dotted bridges. Fills its box. */
export function MapArt({ className = "" }: { className?: string }) {
	const islands = [
		[70, 62, 46, 30, 40],
		[200, 44, 54, 34, 150],
		[322, 78, 44, 28, 15],
		[110, 150, 50, 30, 200],
		[250, 150, 56, 34, 320],
	]
	return (
		<svg
			viewBox="0 0 400 220"
			preserveAspectRatio="xMidYMid slice"
			className={className}
			aria-hidden="true"
		>
			<rect width="400" height="220" fill="#0d2a3a" />
			<path
				d="M70 62L200 44L322 78M70 62L110 150L250 150L322 78M200 44L250 150"
				fill="none"
				stroke="rgba(255,255,255,.4)"
				strokeWidth="3"
				strokeDasharray="1 10"
				strokeLinecap="round"
			/>
			{islands.map(([x, y, rx, ry, hue]) => (
				<ellipse
					key={hue}
					cx={x}
					cy={y}
					rx={rx}
					ry={ry}
					fill={`hsl(${hue} 62% 52%)`}
				/>
			))}
		</svg>
	)
}

/** Taste's identity: the ridges of a fingerprint. Fills its box. */
export function PrintArt({ className = "" }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 400 220"
			preserveAspectRatio="xMidYMid slice"
			className={className}
			aria-hidden="true"
		>
			<rect width="400" height="220" fill="#241538" />
			{[26, 48, 70, 92, 114, 136].map((r, i) => (
				<path
					key={r}
					d={`M${200 - r} 150a${r} ${r * 1.05} 0 0 1 ${r * 2} 0${i % 2 ? `v${20 + i * 4}` : ""}`}
					fill="none"
					stroke="#c4b5fd"
					strokeWidth="10"
					strokeLinecap="round"
					opacity={1 - i * 0.11}
				/>
			))}
		</svg>
	)
}

/** The image files of an app's picture, at the size it is drawn: the whole picture, or a tile. */
export function artFiles(
	art: TvAppArt,
	backdrop: string,
	poster: string,
): string[] {
	if (art.kind === "backdrop")
		return art.path ? [tmdbImageUrl(art.path, backdrop)] : []
	if (art.kind === "posters")
		return art.paths.map((path) => tmdbImageUrl(path, poster))
	return []
}

/** A TMDB poster file's own size, from its width in the address (`/t/p/w154/`): posters are 2 by 3. */
function posterSize(
	src: string,
): { width: number; height: number } | undefined {
	const width = Number(src.match(/\/t\/p\/w(\d+)\//)?.[1])
	return width ? { width, height: Math.round(width * 1.5) } : undefined
}

/** An app's picture. Fills its box. */
export function AppArt({
	art,
	files,
	className,
}: { art: TvAppArt; files: readonly string[]; className: string }) {
	if (art.kind === "map") return <MapArt className={className} />
	if (art.kind === "print") return <PrintArt className={className} />
	if (art.kind === "posters")
		return (
			<span className={`flex bg-[#10131c] ${className}`}>
				{files.map((src) => (
					<Img
						key={src}
						src={src}
						{...posterSize(src)}
						className="h-full min-w-0 flex-1"
					/>
				))}
			</span>
		)
	// Without a picture the tile is the dark of the room, or its service's own colour, and its name or mark says
	// what it is.
	return files[0] ? (
		<Img src={files[0]} className={className} />
	) : (
		<span
			className={`block ${className}`}
			style={{
				background: art.color
					? `linear-gradient(160deg, color-mix(in srgb, ${art.color} 58%, #05060a) 0%, color-mix(in srgb, ${art.color} 20%, #05060a) 100%)`
					: "linear-gradient(160deg,#1c2433,#0b0e15)",
			}}
		/>
	)
}
