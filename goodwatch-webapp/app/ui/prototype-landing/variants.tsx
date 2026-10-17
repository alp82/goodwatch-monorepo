// PROTOTYPE - throwaway. The landing variants of the start page. Each returns what goes over the TV's picture
// (`screen`), over the room (`room`), and above the room (`above`); the room, the TV and the section below stay
// the real ones.
import { Link } from "@remix-run/react"
import { type CSSProperties, type ReactNode, useEffect, useState } from "react"
import type { TvHomeData } from "~/ui/living-room/tv/tv-home"
import type { LandingCard } from "~/server/prototype-landing.server"
import type { IntroData } from "~/ui/prototype-intro/clip"
import { Art, BOOT_MS, Boot, CAPABILITIES, Ping, Say, useAfter, useOpenOnTv } from "./shared"

export type Landing = {
	screen?: ReactNode
	room?: ReactNode
	above?: ReactNode
	/** At the top of the section below the room. */
	below?: ReactNode
	/** The TV home headline's tag: "p" when the page brings its own H1. */
	homeHeadingAs?: "h1" | "p"
}
export type VariantProps = { data: TvHomeData & { landing: LandingCard[]; intro?: IntroData | null }; tvOpen: boolean }

/**
 * Whether the intro is still wanted. A guest sees it on every load in the prototype (no persistence); a member skips
 * to the boot alone. The real thing would remember the dismissal in a cookie, so the server leaves it out.
 */
function useFirstVisit(member: boolean, _key: string) {
	const [first, setFirst] = useState(!member)
	return [first, () => setFirst(false)] as const
}

// ---------------------------------------------------------------------------------------------------------------
// current: today's page, plus the boot.
export function useCurrent(): Landing {
	return { screen: <Boot /> }
}

// ---------------------------------------------------------------------------------------------------------------
// A. Intro channel: after the boot the TV plays five short slides (what GoodWatch is, then four apps), timed by CSS
// so they play from the first paint. Then home, with a ping on Tonight. Skip any time.
const SLIDE_MS = 3200

export function useChannel({ data, tvOpen }: VariantProps): Landing {
	const [first, done] = useFirstVisit(data.member, "channel")
	const slides = [
		{
			kicker: "What is GoodWatch?",
			big: "One score, how it feels, where it streams.",
			line: "IMDb, Rotten Tomatoes and Metacritic in one number. Free, no account needed.",
			art: { kind: "posters" as const, paths: data.startTitles.flatMap((t) => t.poster_path ?? []).slice(0, 6) },
		},
		...["tonight", "discover", "explorer", "taste"].map((id) => {
			const c = CAPABILITIES.find((one) => one.id === id)!
			return { kicker: "On your TV", big: c.name, line: c.line, art: c.art(data) }
		}),
	]
	const end = BOOT_MS - 400 + slides.length * SLIDE_MS
	const over = useAfter(end + 600)
	const [skipped, setSkipped] = useState(false)
	const playing = first && !skipped && !over && !tvOpen
	const [pinged, setPinged] = useState(false)
	useEffect(() => {
		if (!first || !(over || skipped)) return
		const stop = () => {
			setPinged(true)
			done()
		}
		addEventListener("keydown", stop, { once: true })
		addEventListener("pointerdown", stop, { once: true })
		return () => {
			removeEventListener("keydown", stop)
			removeEventListener("pointerdown", stop)
		}
	}, [first, over, skipped])
	return {
		screen: (
			<>
				{playing && (
					<div className="lp-ch" style={{ "--lp-end": `${end}ms` } as CSSProperties}>
						{slides.map((s, i) => {
							const at = { "--lp-at": `${BOOT_MS - 400 + i * SLIDE_MS}ms`, "--lp-each": `${SLIDE_MS}ms` } as CSSProperties
							return (
								<section key={s.big} className="lp-ch-slide" style={at}>
									<div className="lp-ch-art">
										<Art art={s.art} className="h-full w-full" big />
									</div>
									<div className="lp-ch-shade" />
									<div className="lp-ch-text">
										<div className="lp-ch-kicker">{s.kicker}</div>
										<h2 className="lp-ch-big">{s.big}</h2>
										<p className="lp-ch-line">{s.line}</p>
									</div>
								</section>
							)
						})}
						<div className="lp-ch-bars" aria-hidden="true">
							{slides.map((s, i) => (
								<i key={s.big}>
									<b style={{ "--lp-at": `${BOOT_MS - 400 + i * SLIDE_MS}ms`, "--lp-each": `${SLIDE_MS}ms` } as CSSProperties} />
								</i>
							))}
						</div>
						<button type="button" className="lp-ch-skip" onClick={() => setSkipped(true)}>
							Skip intro
						</button>
					</div>
				)}
				<Boot />
			</>
		),
		room: first && (over || skipped) && !pinged && !tvOpen && (
			<>
				<Ping target={'[data-tv-item="app:tonight"]'} />
				<Say
					actions={
						<button type="button" className="lp-primary" onClick={() => { setPinged(true); done() }}>
							Got it
						</button>
					}
				>
					Start with Tonight
					<small>Click a tile, or use the Remote and your arrow keys.</small>
				</Say>
			</>
		),
	}
}

// ---------------------------------------------------------------------------------------------------------------
// B. Intro band: a short landing band above the room, plain page content in the server HTML. A heading, one line,
// and the capabilities as links to their real pages. Hovering one pings its tile on the TV; a click opens it there.
export function useBand({ data, tvOpen }: VariantProps): Landing {
	const open = useOpenOnTv()
	const [target, setTarget] = useState<string | null>(null)
	return {
		screen: <Boot />,
		room: <Ping target={target} />,
		above: (
			<section className="lp-band" aria-labelledby="lp-band-h">
				<div className="mx-auto flex h-full max-w-7xl flex-col justify-center gap-3 px-4 md:px-8">
					<div className="flex flex-col gap-1 md:flex-row md:items-baseline md:gap-4">
						<h2 id="lp-band-h" className="text-xl font-bold leading-tight md:text-3xl">
							Find your next movie or show by mood and taste.
						</h2>
						<p className="lp-band-line text-sm text-white/70 md:text-base">One score from IMDb, Rotten Tomatoes and Metacritic. Free, no account needed.</p>
					</div>
					<ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0">
						{CAPABILITIES.map((c) => (
							<li key={c.id} className="w-40 flex-none snap-start md:w-auto">
								<Link
									to={c.href}
									onClick={(e) => {
										e.preventDefault()
										setTarget(null)
										open(c.tv)
									}}
									onMouseEnter={() => setTarget(tvOpen ? null : `[data-tv-item="${c.item}"]`)}
									onMouseLeave={() => setTarget(null)}
									className="lp-band-tile group relative block h-[92px] overflow-hidden rounded-xl bg-[#10131c] ring-1 ring-white/10 transition-transform hover:scale-[1.03] hover:ring-white"
								>
									<Art art={c.art(data)} className="absolute inset-0 h-full w-full opacity-60" />
									<span className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
									<span className="absolute inset-x-2.5 bottom-2 block">
										<span className="block text-[15px] font-bold leading-tight">{c.name}</span>
										<span className="mt-0.5 block text-[11.5px] leading-tight text-white/75">{c.line}</span>
									</span>
								</Link>
							</li>
						))}
					</ul>
				</div>
			</section>
		),
	}
}

// ---------------------------------------------------------------------------------------------------------------
// C. Welcome tiles: after the boot a guest's TV shows a welcome screen in place of home: a heading and six big
// tiles, one per capability. A tile opens it on the TV; "Show me home" or any Remote key goes to the usual home.
export function useWelcome({ data, tvOpen }: VariantProps): Landing {
	const [first, done] = useFirstVisit(data.member, "welcome")
	const open = useOpenOnTv()
	useEffect(() => {
		if (!first) return
		const key = (e: KeyboardEvent) => {
			if (["ArrowUp", "ArrowDown", "Enter", "Escape"].includes(e.key)) done()
		}
		addEventListener("keydown", key)
		return () => removeEventListener("keydown", key)
	}, [first])
	return {
		screen: (
			<>
				{first && !tvOpen && (
					<div className="lp-wel">
						<div className="absolute inset-0 flex flex-col px-[5cqw] pb-[5cqh] pt-[6cqh]">
							<div className="flex items-end justify-between gap-[3cqw]">
								<div>
									<div className="lp-ch-kicker">Welcome to GoodWatch</div>
									<h2 className="mt-[0.5cqw] font-bold leading-[1.02] tracking-tight" style={{ fontSize: "max(20px, 4.4cqw)" }}>
										Find something good for tonight.
									</h2>
								</div>
								<button
									type="button"
									onClick={done}
									className="tvc-btn flex-none rounded-full px-[2.4cqw] py-[1cqw] font-bold"
									style={{ fontSize: "max(12px, 1.9cqw)" }}
								>
									Show me home
								</button>
							</div>
							<ul className="mt-[3cqh] grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-[1.6cqw]">
								{CAPABILITIES.map((c) => (
									<li key={c.id} className="min-h-0">
										<a
											href={c.href}
											onClick={(e) => {
												e.preventDefault()
												done()
												open(c.tv)
											}}
											className="lp-wel-tile block h-full w-full"
										>
											<Art art={c.art(data)} className="lp-wel-art" />
											<span className="lp-wel-fade" />
											<span className="lp-wel-words">
												<span className="lp-wel-name block">{c.name}</span>
												<span className="lp-wel-line block">{c.line}</span>
											</span>
										</a>
									</li>
								))}
							</ul>
						</div>
					</div>
				)}
				<Boot />
			</>
		),
	}
}

// ---------------------------------------------------------------------------------------------------------------
// D. Guided tour: the TV boots to home as today, then the Explorer tutorial's pointer walks a guest through the
// room in five steps, one line each. Next, Skip, or doing the thing moves it on.
const TOUR = [
	{ target: '[data-tv-item="app:tonight"]', say: "This is your TV. Tonight shows one pick at a time, best rated right now." },
	{ target: '[data-remote] [aria-label="Next"], [data-remote-rig] [aria-label="Next"]', say: "Move with the Remote, the arrow keys, or your mouse." },
	{ target: '[data-tv-item="app:discover"]', say: "Discover: pick a mood, get titles that fit it." },
	{ target: '[data-tv-item="app:explorer"]', say: "Explorer: a map of titles that belong together." },
	{ target: ".lrb-lip", say: "More below: what's popular now, and every way to browse." },
]

export function useTour({ data, tvOpen }: VariantProps): Landing {
	const [first, done] = useFirstVisit(data.member, "tour")
	const ready = useAfter(BOOT_MS)
	const [step, setStep] = useState(0)
	const on = first && ready && !tvOpen
	const last = step === TOUR.length - 1
	return {
		screen: <Boot />,
		room: on && (
			<>
				<Ping target={TOUR[step].target} />
				<Say
					actions={
						<>
							<button type="button" onClick={done}>
								Skip
							</button>
							<button type="button" className="lp-primary" onClick={() => (last ? done() : setStep(step + 1))}>
								{last ? "Got it" : "Next"}
							</button>
						</>
					}
				>
					<span className="text-white/55">
						{step + 1}/{TOUR.length}{" "}
					</span>
					{TOUR[step].say}
				</Say>
			</>
		),
	}
}
