// The Taste start's three steps across the top: numbered dots on a line that fills in amber as the member moves on.
// The fill and the current dot's growth are transforms, so they stay smooth.
import { CheckIcon } from "@heroicons/react/20/solid"
import {
	STEP_LABELS,
	type StartState,
	type StartStep,
	stepNote,
	stepsReached,
} from "./steps"

export function StartStepper({
	state,
	done,
	canOpen,
	onOpen,
}: {
	state: StartState
	done: (n: StartStep) => boolean
	canOpen: (n: StartStep) => boolean
	onOpen: (n: StartStep) => void
}) {
	return (
		<nav aria-label="Getting started" className="mx-auto w-full max-w-3xl">
			<div className="relative">
				{/* The line runs between the first and the last dot's centers. */}
				<div
					aria-hidden
					className="absolute inset-x-[16.66%] top-[22px] h-1 overflow-hidden rounded-full bg-white/15"
				>
					<div
						className="h-full origin-left rounded-full bg-linear-to-r from-amber-500 to-amber-300 transition-transform duration-700 ease-out"
						style={{ transform: `scaleX(${stepsReached(state) / 2})` }}
					/>
				</div>
				<ol className="relative grid grid-cols-3">
					{([1, 2, 3] as const).map((n) => {
						const on = state.step === n
						const finished = done(n)
						return (
							<li key={n} className="flex flex-col items-center text-center">
								<button
									type="button"
									onClick={() => onOpen(n)}
									disabled={!canOpen(n)}
									aria-current={on ? "step" : undefined}
									aria-label={`Step ${n}: ${STEP_LABELS[n]}${finished ? ", done" : ""}`}
									className={`flex size-12 cursor-pointer items-center justify-center rounded-full text-base font-black ring-4 transition-transform duration-300 disabled:cursor-default ${on ? "scale-110" : ""} ${finished ? "bg-amber-400 text-gray-950 ring-gray-950" : on ? "bg-gray-950 text-amber-300 shadow-[0_0_0_8px_var(--color-gray-950)] ring-amber-400" : "bg-gray-900 text-gray-400 ring-gray-950"}`}
								>
									{finished ? <CheckIcon className="size-6" aria-hidden /> : n}
								</button>
								<span
									className={`mt-3 text-sm font-bold md:text-base ${on ? "text-white" : "text-gray-400"}`}
								>
									{STEP_LABELS[n]}
								</span>
								<span
									className={`text-xs md:text-sm ${on ? "text-amber-300/90" : "text-gray-500"}`}
								>
									{stepNote(n, state) || " "}
								</span>
							</li>
						)
					})}
				</ol>
			</div>
		</nav>
	)
}
