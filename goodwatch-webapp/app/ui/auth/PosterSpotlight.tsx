// The poster wall behind the auth pages: a dim, grey mosaic of posters with a soft spotlight that follows the
// cursor and shows the posters under it in color. A poster flips to another title once when the spotlight
// reaches it, and again only after the spotlight has left it and comes back. When the cursor rests, the spotlight
// drifts on its own. The design came out of the sign-in prototype (branch prototype/sign-in).
//
// It aims for 60 fps, so nothing repaints while the spotlight moves: the color view is a round window moved with a
// transform while the color mosaic inside it moves the opposite way, and the window's soft edge is a fixed mask.
// Only the color copy of a poster animates its flip; the grey copy under it swaps at once.
//
// The wall shows only on wide screens, after the page has loaded: on a phone each poster would be a sliver, and
// the wall would cost 168 image requests. With reduced motion the spotlight stands still and nothing flips.
import { memo, useEffect, useMemo, useRef, useState } from "react"
import { tmdbFixedImage } from "~/utils/tmdb-image"

export type AuthPoster = { key: string; title: string; posterPath: string }

const COLS = 14
const ROWS = 6
const TILES = COLS * ROWS
// Radius of the color window, and the distances at which a poster counts as entering and leaving the spotlight.
// Leaving takes a larger distance than entering, so a poster on the edge doesn't flip back and forth.
const RADIUS = 280
const ENTER = 150
const EXIT = 200
// A tile is about 130 px wide on a 1440 px screen.
const TILE_WIDTH = 140

type Dir = "l" | "r" | "u" | "d"
type Tile = { poster: AuthPoster; prev?: AuthPoster; flips: number; dir: Dir }

const VEC: Record<Dir, [number, number]> = { r: [1, 0], l: [-1, 0], d: [0, 1], u: [0, -1] }
// A new poster lands from the side the spotlight came from.
const WALL_CSS = (Object.keys(VEC) as Dir[])
	.map((d) => {
		const [x, y] = VEC[d]
		return `@keyframes auth-deal-${d} { from { opacity: 0; transform: translate(${-x * 14}%, ${-y * 14}%) scale(1.12) } to { opacity: 1; transform: none } }`
	})
	.join("\n")

const dirOf = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "r" : "l") : dy > 0 ? "d" : "u")

function shuffle<T>(items: T[]): T[] {
	const out = [...items]
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[out[i], out[j]] = [out[j], out[i]]
	}
	return out
}

function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(false)
	useEffect(() => {
		const list = window.matchMedia(query)
		setMatches(list.matches)
		const onChange = () => setMatches(list.matches)
		list.addEventListener("change", onChange)
		return () => list.removeEventListener("change", onChange)
	}, [query])
	return matches
}

export function PosterSpotlight({ posters }: { posters: AuthPoster[] }) {
	const wide = useMediaQuery("(min-width: 1024px)")
	if (!wide || posters.length < 12) return null
	return <Wall posters={posters} />
}

function PosterImage({ poster, color, style, onAnimationEnd }: { poster: AuthPoster; color: boolean; style?: React.CSSProperties; onAnimationEnd?: () => void }) {
	const { src, srcSet } = tmdbFixedImage("poster", poster.posterPath, TILE_WIDTH)
	return (
		<img
			src={src}
			srcSet={srcSet}
			alt=""
			decoding="async"
			draggable={false}
			className={`absolute inset-0 h-full w-full rounded-lg object-cover ${color ? "" : "grayscale brightness-[.3] contrast-125"}`}
			style={style}
			onAnimationEnd={onAnimationEnd}
		/>
	)
}

/** Lands the new poster on top of the old one, then settles into one flat image so it stops being a layer. */
function FlipTile({ tile, color, animate }: { tile: Tile; color: boolean; animate: boolean }) {
	const [settled, setSettled] = useState(false)
	if (!animate || settled || !tile.prev) return <PosterImage poster={tile.poster} color={color} />
	return (
		<>
			<PosterImage poster={tile.prev} color={color} />
			<PosterImage
				poster={tile.poster}
				color={color}
				style={{ animation: `auth-deal-${tile.dir} .75s cubic-bezier(.25,.8,.25,1) both` }}
				onAnimationEnd={() => setSettled(true)}
			/>
		</>
	)
}

const TileView = memo(function TileView({ tile, color }: { tile: Tile; color: boolean }) {
	return (
		<div className="relative aspect-[2/3]">
			<FlipTile key={tile.flips} tile={tile} color={color} animate={color} />
		</div>
	)
})

const Mosaic = memo(function Mosaic({ tiles, color, gridRef }: { tiles: Tile[]; color: boolean; gridRef?: React.Ref<HTMLDivElement> }) {
	return (
		<div className="absolute inset-0 flex items-center">
			<div
				ref={gridRef}
				className="grid h-full w-[118%] -translate-x-[8%] -rotate-3 scale-110 gap-2"
				style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
			>
				{tiles.map((tile, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: a tile is a fixed slot in the grid
					<TileView key={i} tile={tile} color={color} />
				))}
			</div>
		</div>
	)
})

function Wall({ posters }: { posters: AuthPoster[] }) {
	const pool = useMemo(() => shuffle(posters), [posters])
	const [tiles, setTiles] = useState<Tile[]>(() =>
		Array.from({ length: TILES }, (_, i) => ({ poster: pool[i % pool.length], flips: 0, dir: "r" as Dir })),
	)
	const [shown, setShown] = useState(false)
	const stage = useRef<HTMLDivElement>(null)
	const lens = useRef<HTMLDivElement>(null)
	const lensContent = useRef<HTMLDivElement>(null)
	const glow = useRef<HTMLDivElement>(null)
	const grid = useRef<HTMLDivElement>(null)
	const next = useRef(TILES)

	useEffect(() => {
		const id = requestAnimationFrame(() => setShown(true))
		return () => cancelAnimationFrame(id)
	}, [])

	// Warm the cache once the page is idle, so a poster never flips to an image that is still loading.
	useEffect(() => {
		const warm = () => {
			for (const poster of pool.slice(TILES)) new Image().src = tmdbFixedImage("poster", poster.posterPath, TILE_WIDTH).src
		}
		if ("requestIdleCallback" in window) {
			const id = window.requestIdleCallback(warm, { timeout: 3000 })
			return () => window.cancelIdleCallback(id)
		}
		const id = setTimeout(warm, 1500)
		return () => clearTimeout(id)
	}, [pool])

	useEffect(() => {
		const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		const target = { x: 0.3, y: 0.5, last: 0 }
		const cur = { x: 0.3, y: 0.5 }
		const prev = { x: 0, y: 0 }
		const vel = { x: 1, y: 0 }
		const inside = new Uint8Array(TILES)
		let primed = false
		let lastNow = performance.now()
		let raf = 0

		// Tile centers in stage pixels, measured on mount and on resize.
		let centers: { x: number; y: number }[] = []
		const measure = () => {
			const box = stage.current?.getBoundingClientRect()
			if (!box || !grid.current) return
			centers = [...grid.current.children].map((el) => {
				const r = el.getBoundingClientRect()
				return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top }
			})
			const content = lensContent.current?.firstElementChild as HTMLElement | null
			if (content) Object.assign(content.style, { width: `${box.width}px`, height: `${box.height}px` })
		}
		const resize = new ResizeObserver(measure)
		if (stage.current) resize.observe(stage.current)

		const place = (cx: number, cy: number) => {
			const x = cx - RADIUS
			const y = cy - RADIUS
			if (lens.current) lens.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
			if (lensContent.current) lensContent.current.style.transform = `translate3d(${-x}px, ${-y}px, 0)`
			if (glow.current) glow.current.style.transform = `translate3d(${x - RADIUS / 2}px, ${y - RADIUS / 2}px, 0)`
		}

		const flips = new Map<number, Dir>()
		const loop = (now: number) => {
			const wandering = now - target.last > 2500
			const tx = wandering ? 0.32 + Math.sin(now / 2600) * 0.22 : target.x
			const ty = wandering ? 0.5 + Math.sin(now / 1700) * 0.28 : target.y
			// Close most of the gap within about 100 ms while following the cursor; drift slowly on its own.
			const k = 1 - (1 - (wandering ? 0.05 : 0.3)) ** ((now - lastNow) / 16.7)
			lastNow = now
			cur.x += (tx - cur.x) * k
			cur.y += (ty - cur.y) * k
			const w = stage.current?.clientWidth ?? 0
			const h = stage.current?.clientHeight ?? 0
			const cx = cur.x * w
			const cy = cur.y * h
			vel.x = vel.x * 0.85 + (cx - prev.x) * 0.15
			vel.y = vel.y * 0.85 + (cy - prev.y) * 0.15
			prev.x = cx
			prev.y = cy

			for (let i = 0; i < centers.length; i++) {
				const d = Math.hypot(centers[i].x - cx, centers[i].y - cy)
				if (!inside[i] && d < ENTER) {
					inside[i] = 1
					if (primed) flips.set(i, dirOf(vel.x, vel.y))
				} else if (inside[i] && d > EXIT) inside[i] = 0
			}
			if (centers.length) primed = true
			if (flips.size) {
				const batch = new Map(flips)
				flips.clear()
				setTiles((ts) => {
					const copy = [...ts]
					for (const [i, dir] of batch) {
						copy[i] = { poster: pool[next.current++ % pool.length], prev: ts[i].poster, flips: ts[i].flips + 1, dir }
					}
					return copy
				})
			}
			place(cx, cy)
			raf = requestAnimationFrame(loop)
		}

		const onMove = (e: PointerEvent) => {
			const box = stage.current?.getBoundingClientRect()
			if (box) Object.assign(target, { x: (e.clientX - box.left) / box.width, y: (e.clientY - box.top) / box.height, last: performance.now() })
		}

		measure()
		if (still) {
			place(cur.x * (stage.current?.clientWidth ?? 0), cur.y * (stage.current?.clientHeight ?? 0))
		} else {
			window.addEventListener("pointermove", onMove, { passive: true })
			raf = requestAnimationFrame(loop)
		}
		return () => {
			cancelAnimationFrame(raf)
			resize.disconnect()
			window.removeEventListener("pointermove", onMove)
		}
	}, [pool])

	return (
		<div
			ref={stage}
			aria-hidden
			className={`pointer-events-none absolute inset-0 transition-opacity duration-1000 ${shown ? "opacity-100" : "opacity-0"}`}
		>
			<style dangerouslySetInnerHTML={{ __html: WALL_CSS }} />
			<Mosaic tiles={tiles} color={false} gridRef={grid} />
			<div
				ref={lens}
				className="absolute left-0 top-0 overflow-hidden rounded-full will-change-transform"
				style={{
					width: RADIUS * 2,
					height: RADIUS * 2,
					transform: "translate3d(-9999px, 0, 0)",
					maskImage: "radial-gradient(closest-side, #000 40%, transparent 100%)",
					WebkitMaskImage: "radial-gradient(closest-side, #000 40%, transparent 100%)",
				}}
			>
				<div ref={lensContent} className="absolute left-0 top-0 h-full w-full will-change-transform">
					<div className="absolute left-0 top-0">
						<Mosaic tiles={tiles} color />
					</div>
				</div>
			</div>
			<div
				ref={glow}
				className="absolute left-0 top-0 opacity-25 will-change-transform"
				style={{
					width: RADIUS * 3,
					height: RADIUS * 3,
					transform: "translate3d(-9999px, 0, 0)",
					background: "radial-gradient(closest-side, rgba(251,191,36,.8), transparent)",
				}}
			/>
		</div>
	)
}
