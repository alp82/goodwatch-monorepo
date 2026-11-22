// A few posters as a fan of cards: one link to their category (a genre or
// a kind), never to the titles one by one. On hover or focus the fan opens a little; transform only.
import { TmdbImage } from "~/ui/TmdbImage"
import { Link } from "@remix-run/react"
import type { CSSProperties } from "react"
import { FOCUS } from "~/ui/browse/index"
import type { Lite } from "~/ui/browse/genres/shared"

const SIZE = {
	s: { w: 40, box: "h-[4.4rem] w-[6.5rem]" },
	m: { w: 58, box: "h-[6.2rem] w-[9rem]" },
	l: { w: 92, box: "h-[9.6rem] w-[13.5rem]" },
} as const

export function PosterFan({
	titles,
	to,
	label,
	size = "m",
	className = "",
}: {
	titles: Lite[]
	to: string
	/** What the link opens: "All feel-good dramas". */
	label: string
	size?: keyof typeof SIZE
	className?: string
}) {
	const shown = titles.filter((t) => t.poster).slice(0, size === "s" ? 3 : 4)
	if (!shown.length) return null
	const { w, box } = SIZE[size]
	const mid = (shown.length - 1) / 2
	return (
		<Link
			to={to}
			prefetch="intent"
			aria-label={label}
			title={label}
			className={`group/fan relative block shrink-0 rounded-lg ${box} ${FOCUS} ${className}`}
		>
			{shown.map((t, i) => {
				const d = i - mid
				return (
					<span
						key={t.key}
						aria-hidden
						style={
							{
								width: w,
								zIndex: 10 - Math.round(Math.abs(d) * 2),
								"--x": `${d * 38}%`,
								"--r": `${d * 6}deg`,
								"--y": `${Math.abs(d) * 4}%`,
								"--xh": `${d * 58}%`,
								"--rh": `${d * 9}deg`,
							} as CSSProperties
						}
						className="absolute bottom-0 left-1/2 origin-bottom overflow-hidden rounded-[5px] bg-gray-800 shadow-[0_6px_16px_-4px_rgb(0_0_0/0.7)] ring-1 ring-white/15 transition-transform duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] [transform:translateX(calc(-50%_+_var(--x)))_translateY(var(--y))_rotate(var(--r))] group-hover/fan:[transform:translateX(calc(-50%_+_var(--xh)))_translateY(calc(var(--y)_-_6%))_rotate(var(--rh))] group-focus-visible/fan:[transform:translateX(calc(-50%_+_var(--xh)))_translateY(calc(var(--y)_-_6%))_rotate(var(--rh))] motion-reduce:transition-none"
					>
						<TmdbImage
							kind="poster"
							path={t.poster}
							width={w}
							alt=""
							className="block aspect-[2/3] w-full object-cover"
						/>
					</span>
				)
			})}
		</Link>
	)
}
