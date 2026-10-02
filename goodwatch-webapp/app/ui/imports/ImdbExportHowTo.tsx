import { PauseIcon, PlayIcon } from "@heroicons/react/20/solid"
import { type CSSProperties, useEffect, useState } from "react"
import { SCENES } from "./howto/Scenes"
import { HOWTO_CSS } from "./howto/styles"

// A looping, four-scene explainer of how to get the ratings file out of IMDb. Each step plays its scene for
// `seconds`; the step's progress bar is the clock, so pausing the CSS animations pauses the whole thing.
const STEPS = [
	{
		label: "Start the export",
		caption: "Open your ratings on IMDb and click Export.",
		seconds: 4.2,
	},
	{
		label: "Wait a few minutes",
		caption: "IMDb prepares your file. This takes a few minutes.",
		seconds: 3.4,
	},
	{
		label: "Download the file",
		caption: "On the exports page, download the Ratings file once it is ready.",
		seconds: 4.6,
	},
	{
		label: "Upload it here",
		caption: "Drop the downloaded CSV file into GoodWatch.",
		seconds: 4.4,
	},
]

const SUMMARY = `How to export your ratings from IMDb, in four steps. ${STEPS.map(
	(step, index) => `${index + 1}: ${step.caption}`,
).join(" ")}`

/** False on the server and on the first client render, so hydration matches. */
function usePrefersReducedMotion() {
	const [reduced, setReduced] = useState(false)
	useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)")
		const update = () => setReduced(query.matches)
		update()
		query.addEventListener("change", update)
		return () => query.removeEventListener("change", update)
	}, [])
	return reduced
}

function Stage({ step }: { step: number }) {
	const Scene = SCENES[step]
	return (
		<div
			className="h-56 overflow-hidden rounded-lg bg-gray-950 p-2 ring-1 ring-white/10 select-none"
			aria-hidden="true"
		>
			<Scene />
		</div>
	)
}

export function ImdbExportHowTo({ className = "" }: { className?: string }) {
	const reducedMotion = usePrefersReducedMotion()
	const [step, setStep] = useState(0)
	// Counts every (re)start of a scene, so that jumping to the step already showing replays it.
	const [run, setRun] = useState(0)
	const [playing, setPlaying] = useState(true)

	const show = (next: number) => {
		setStep(next % STEPS.length)
		setRun((count) => count + 1)
	}

	if (reducedMotion) {
		return (
			<div className={`gwhowto @container ${className}`} data-static="true">
				<style>{HOWTO_CSS}</style>
				<ol
					className="grid gap-4 @xl:grid-cols-2"
					aria-label="How to export your ratings from IMDb"
				>
					{STEPS.map((item, index) => (
						<li key={item.label} className="space-y-2">
							<Stage step={index} />
							<p className="flex gap-2 text-sm text-gray-200">
								<span
									className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white"
									aria-hidden="true"
								>
									{index + 1}
								</span>
								<span>
									<span className="font-semibold text-white">
										{item.label}.
									</span>{" "}
									{item.caption}
								</span>
							</p>
						</li>
					))}
				</ol>
			</div>
		)
	}

	const current = STEPS[step]
	return (
		<section
			className={`gwhowto @container ${className}`}
			data-paused={!playing}
			aria-label={SUMMARY}
		>
			<style>{HOWTO_CSS}</style>
			<div key={run} className="gwhowto-in">
				<Stage step={step} />
			</div>

			<div className="mt-3 flex items-start gap-3">
				<button
					type="button"
					onClick={() => setPlaying(!playing)}
					aria-label={playing ? "Pause animation" : "Play animation"}
					className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-gray-800 text-gray-100 ring-1 ring-white/10 hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
				>
					{playing ? (
						<PauseIcon className="size-5" aria-hidden="true" />
					) : (
						<PlayIcon className="size-5" aria-hidden="true" />
					)}
				</button>
				<p className="min-h-10 text-sm leading-5 text-gray-200">
					<span className="font-semibold text-white">
						Step {step + 1} of {STEPS.length}:
					</span>{" "}
					{current.caption}
				</p>
			</div>

			<ol className="mt-2 grid grid-cols-4 gap-2">
				{STEPS.map((item, index) => {
					const active = index === step
					return (
						<li key={item.label}>
							<button
								type="button"
								onClick={() => {
									show(index)
									setPlaying(true)
								}}
								aria-label={`Step ${index + 1}: ${item.label}`}
								aria-current={active ? "step" : undefined}
								className="group block w-full cursor-pointer rounded pb-1 pt-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
							>
								<span className="block h-1 overflow-hidden rounded-full bg-gray-700">
									{index < step && (
										<span className="block h-full bg-indigo-400" />
									)}
									{active && (
										<span
											key={run}
											className="gwhowto-fill block h-full bg-indigo-400"
											style={{ "--dur": `${item.seconds}s` } as CSSProperties}
											onAnimationEnd={() => show(step + 1)}
										/>
									)}
								</span>
								<span
									className={`mt-2 flex items-start gap-1.5 text-xs leading-5 ${
										active
											? "text-white"
											: "text-gray-400 group-hover:text-gray-200"
									}`}
								>
									<span
										className={`flex size-5 shrink-0 items-center justify-center rounded-full font-semibold ${
											active
												? "bg-indigo-600 text-white"
												: "bg-gray-800 text-gray-300"
										}`}
									>
										{index + 1}
									</span>
									<span className="hidden @md:block">{item.label}</span>
								</span>
							</button>
						</li>
					)
				})}
			</ol>
		</section>
	)
}
