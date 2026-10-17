// PROTOTYPE - throwaway. /how-it-works variant B, "One screen": like /use-with-ai's sticky chat demo, one screen
// stays in view while the features scroll past; the screen plays the scene of the feature in the middle of the
// window. Wide screens: the list on the left, the screen on the right. Phones: the screen sticks under the header.
// A chapter bar under the screen shows where you are and jumps to a feature.
import { useEffect, useRef, useState } from "react"
import { ChatDemo } from "~/ui/use-with-ai/ChatDemo"
import { HIW_FEATURES, HIW_INTRO } from "./features"
import { IntroDataProvider, SceneScreen } from "./scene-screen"
import { Cta, Kicker, MoreLink } from "./ui"

const FILM_FEATURES = HIW_FEATURES.filter((f) => f.scene !== "ai")
const AI = HIW_FEATURES.find((f) => f.scene === "ai")

export function HiwB() {
	const [active, setActive] = useState(0)
	const [run, setRun] = useState(1)
	const rows = useRef<(HTMLLIElement | null)[]>([])

	useEffect(() => {
		const io = new IntersectionObserver(
			(entries) => {
				for (const e of entries) {
					if (!e.isIntersecting) continue
					const i = rows.current.indexOf(e.target as HTMLLIElement)
					if (i >= 0) {
						setActive((was) => {
							if (was !== i) setRun((n) => n + 1)
							return i
						})
					}
				}
			},
			// Wide screens: the row across the window's middle. Phones: the middle of what the sticky screen leaves free.
			{ rootMargin: window.innerWidth >= 1024 ? "-48% 0px -48% 0px" : "-62% 0px -36% 0px" },
		)
		for (const r of rows.current) if (r) io.observe(r)
		return () => io.disconnect()
	}, [])

	const jump = (i: number) => rows.current[i]?.scrollIntoView({ behavior: "smooth", block: "center" })
	const f = FILM_FEATURES[active]

	return (
		<IntroDataProvider>
			<div className="mx-auto w-full max-w-6xl px-4 pt-8 pb-24 text-gray-300 sm:px-8 md:pt-14">
				<header className="flex max-w-2xl flex-col gap-3">
					<h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">{HIW_INTRO.title}</h1>
					<p className="text-lg leading-relaxed text-gray-300">{HIW_INTRO.line}</p>
				</header>

				<div className="mt-6 grid gap-x-14 lg:mt-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
					{/* The screen: sticky under the header on phones, beside the list on wide screens. */}
					<div className="sticky top-[3.75rem] z-10 -mx-4 bg-gray-900 px-4 pt-2 pb-3 sm:-mx-8 sm:px-8 lg:order-2 lg:top-[max(6rem,calc(50vh-13rem))] lg:mx-0 lg:self-start lg:bg-transparent lg:p-0">
						<SceneScreen
							id={f.scene}
							run={run}
							className="aspect-video rounded-xl ring-1 ring-white/10 lg:rounded-2xl"
						/>
						<Chapters active={active} onJump={jump} />
					</div>

					<ol className="lg:order-1">
						{FILM_FEATURES.map((x, i) => (
							<li
								key={x.id}
								id={x.id}
								ref={(el) => {
									rows.current[i] = el
								}}
								className="flex min-h-[46vh] scroll-mt-80 flex-col justify-center gap-2.5 py-8 lg:min-h-[64vh] lg:scroll-mt-24"
							>
								<div className={`flex flex-col gap-2.5 transition-opacity duration-300 ${i === active ? "opacity-100" : "opacity-40"}`}>
									<Kicker>
										<span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
										<span className="mx-2 text-amber-400/50">·</span>
										{x.kicker}
									</Kicker>
									<h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{x.title}</h2>
									<p className="text-lg leading-relaxed text-gray-300">{x.line}</p>
									<MoreLink to={x.link.to}>{x.link.label}</MoreLink>
								</div>
							</li>
						))}
					</ol>
				</div>

				{AI && (
					<section
						id={AI.id}
						className="mt-16 grid items-center gap-8 border-t border-white/10 pt-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-14"
					>
						<div className="flex flex-col gap-3">
							<Kicker>{AI.kicker}</Kicker>
							<h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{AI.title}</h2>
							<p className="text-lg leading-relaxed text-gray-300">{AI.line}</p>
							<MoreLink to={AI.link.to}>{AI.link.label}</MoreLink>
						</div>
						<ChatDemo className="mx-auto w-full max-w-xl" />
					</section>
				)}

				<section className="mt-16 flex flex-col items-start gap-4 border-t border-white/10 pt-12 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h2 className="text-2xl font-bold tracking-tight text-white">Your turn</h2>
						<p className="text-gray-400">Rate a few titles you loved. Your picks are ready in a minute.</p>
					</div>
					<div className="flex flex-wrap gap-3">
						<Cta to="/taste" primary>
							Find your taste
						</Cta>
						<Cta to="/discover">Open Discover</Cta>
					</div>
				</section>
			</div>
		</IntroDataProvider>
	)
}

/** One segment per feature, like the intro's chapter bar: the one showing is amber, a click scrolls to it. */
function Chapters({ active, onJump }: { active: number; onJump: (i: number) => void }) {
	return (
		<nav aria-label="Features" className="mt-2.5 flex gap-1 lg:mt-4">
			{FILM_FEATURES.map((x, i) => (
				<button
					key={x.id}
					type="button"
					onClick={() => onJump(i)}
					aria-label={x.title}
					aria-current={i === active || undefined}
					className="group flex h-5 flex-1 cursor-pointer items-center"
				>
					<span
						className={`block h-1 w-full rounded-full transition-colors duration-300 ${i === active ? "bg-amber-400" : i < active ? "bg-white/40" : "bg-white/15 group-hover:bg-white/30"}`}
					/>
				</button>
			))}
		</nav>
	)
}
