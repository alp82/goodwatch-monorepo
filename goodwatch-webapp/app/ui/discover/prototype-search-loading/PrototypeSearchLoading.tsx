// PROTOTYPE ONLY (branch prototype/search-loading): five loading states for Discover's described search, switched with
// `?loading=A|B|C|D|E`. Without the parameter the page behaves as on main. Remove this folder and the `prototype`
// marked lines in DescribeField, DiscoverGrid, DiscoverPage and ReadStrip once a variant is picked.
//
// The phases are the search's real stages: the typing pause (the field has words it hasn't sent yet), reading the
// words (/api/discover/interpret), finding matches (/api/combined-search), loading the result cards
// (/api/discover/results), and, for a title-name search, the partial list the stream sends ahead of the ranking.
import { CheckIcon } from "@heroicons/react/20/solid"
import { useSearchParams } from "@remix-run/react"
import {
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore,
} from "react"
import { DISCOVER_GRID } from "~/ui/discover/DiscoverGrid"

export type PrototypeLoadingVariant = "A" | "B" | "C" | "D" | "E"

export const PROTOTYPE_LOADING_VARIANTS: Record<PrototypeLoadingVariant, string> = {
	A: "Dim the old grid, line on the field",
	B: "Skeleton cards, spinner in Search",
	C: "Three steps above the grid",
	D: "Search button and read strip say the step",
	E: "Skeletons, cards arrive as posters load",
}

/**
 * typing: words in the field the search hasn't been sent yet. reading: interpret. searching: the combined search.
 * posters: the result cards. refining: a partial list is on screen while the ranking finishes.
 */
export type PrototypeLoadingPhase = "typing" | "reading" | "searching" | "posters" | "refining"

export const PHASE_TEXT: Record<PrototypeLoadingPhase, string> = {
	typing: "Searching when you pause",
	reading: "Reading your words",
	searching: "Finding matches",
	posters: "Loading posters",
	refining: "Ranking more matches",
}

/** The short word for the Search button (variant D). */
const PHASE_WORD: Record<PrototypeLoadingPhase, string> = {
	typing: "Search",
	reading: "Reading",
	searching: "Searching",
	posters: "Loading",
	refining: "Ranking",
}

export function usePrototypeLoadingVariant(): PrototypeLoadingVariant | null {
	const [params] = useSearchParams()
	const value = params.get("loading")?.toUpperCase()
	return value && value in PROTOTYPE_LOADING_VARIANTS ? (value as PrototypeLoadingVariant) : null
}

// What the field is about to search: set on the first keystroke that arms the typing pause, so the page can show the
// loading state within the same frame, not after the pause. Null when the field will send nothing.
let armed: string | null = null
const listeners = new Set<() => void>()
export const prototypeTyping = {
	set(next: string | null) {
		if (next === armed) return
		armed = next
		for (const listener of listeners) listener()
	},
}
const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}
export const usePrototypeArmed = () =>
	useSyncExternalStore(
		subscribe,
		() => armed,
		() => null,
	)

/** The phase from the page's own state; null when nothing loads (or the search failed). */
export function prototypePhase({
	waitingForWords,
	searching,
	failed,
	readingPending,
	catalogue,
	hasSearchAnswer,
	partial,
	stale,
}: {
	waitingForWords: boolean
	searching: boolean
	failed: boolean
	readingPending: boolean
	catalogue: boolean
	hasSearchAnswer: boolean
	partial: boolean
	stale: boolean
}): PrototypeLoadingPhase | null {
	if (waitingForWords) return "typing"
	if (!searching || failed) return null
	if (readingPending) return "reading"
	if (!catalogue && !hasSearchAnswer) return "searching"
	if (stale) return "posters"
	if (partial) return "refining"
	return null
}

interface PrototypeLoading {
	variant: PrototypeLoadingVariant
	phase: PrototypeLoadingPhase | null
}

const Context = createContext<PrototypeLoading | null>(null)
export const PrototypeLoadingProvider = Context.Provider
export const usePrototypeLoading = () => useContext(Context)

// Transform-only keyframes for the indeterminate line.
const KEYFRAMES = `@keyframes proto-search-slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`

/** A thin amber line sliding along the field's foot (variant A). */
export function PrototypeFieldLine({ on }: { on: boolean }) {
	return (
		<span
			aria-hidden
			className={`pointer-events-none absolute inset-x-6 bottom-0 h-0.5 overflow-hidden rounded-full transition-opacity duration-150 lg:inset-x-10 ${on ? "opacity-100" : "opacity-0"}`}
		>
			<style>{KEYFRAMES}</style>
			<span className="block h-full w-1/3 rounded-full bg-amber-400 animate-[proto-search-slide_1.1s_ease-in-out_infinite] motion-reduce:animate-none" />
		</span>
	)
}

/** The ring spinner the filter sheet uses, dark on the amber button. */
function ButtonSpinner() {
	return (
		<span
			aria-hidden
			className="block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-gray-950/25 border-t-gray-950 motion-reduce:animate-none"
		/>
	)
}

/** The Search button's content while loading (variants B and D); null when it shows as on main. */
export function PrototypeButtonContent({ loading }: { loading: PrototypeLoading | null }) {
	if (!loading?.phase || loading.phase === "typing") return null
	if (loading.variant === "B")
		return (
			<>
				<span className="lg:hidden">
					<ButtonSpinner />
				</span>
				{/* Keeps the button's width: the word stays, invisible, under the spinner. */}
				<span className="relative hidden lg:inline">
					<span className="invisible">Search</span>
					<span className="absolute inset-0 flex items-center justify-center">
						<ButtonSpinner />
					</span>
				</span>
				<span className="sr-only">{PHASE_TEXT[loading.phase]}</span>
			</>
		)
	if (loading.variant === "D")
		return (
			<>
				<ButtonSpinner />
				<span className="hidden lg:inline">{PHASE_WORD[loading.phase]}</span>
				<span className="sr-only">{PHASE_TEXT[loading.phase]}</span>
			</>
		)
	return null
}

/** The step in the read strip (variant D). */
export function PrototypeStripStep({ phase }: { phase: PrototypeLoadingPhase }) {
	return (
		<span className="flex shrink-0 items-center gap-2 text-[12px] text-amber-300/80" role="status">
			<span
				aria-hidden
				className="block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-amber-400 motion-reduce:animate-none"
			/>
			{PHASE_TEXT[phase]}
		</span>
	)
}

/** Where the cards' bounding box sits: the real card's frame, with the poster's 2:3 box pulsing in it. */
function SkeletonCard() {
	return (
		<div className="@container/card relative w-full min-w-0">
			<div className="overflow-hidden rounded-lg border-2 border-gray-800 bg-gray-900 @min-[8rem]/card:border-4">
				<div className="relative block aspect-[2/3] w-full animate-pulse rounded-md bg-gray-800/70 motion-reduce:animate-none">
					<span className="absolute inset-x-1.5 bottom-1.5 flex flex-col gap-1 @min-[11rem]/card:inset-x-2.5 @min-[11rem]/card:bottom-2.5">
						<span className="h-2 w-3/4 rounded bg-white/[0.06]" />
						<span className="h-2 w-1/3 rounded bg-white/[0.06]" />
					</span>
				</div>
			</div>
		</div>
	)
}

export function PrototypeSkeletonGrid({ count }: { count: number }) {
	return (
		<div className={DISCOVER_GRID} aria-hidden>
			{Array.from({ length: count }, (_, i) => (
				<SkeletonCard key={i} />
			))}
		</div>
	)
}

const ORDER: PrototypeLoadingPhase[] = ["reading", "searching", "posters"]

/** Three steps with a segmented bar (variant C). The typing pause shows all three still to come. */
export function PrototypeSteps({ phase }: { phase: PrototypeLoadingPhase | null }) {
	const at = phase === null ? ORDER.length : phase === "typing" ? -1 : phase === "refining" ? 2 : ORDER.indexOf(phase)
	return (
		<div
			className={`transition-opacity duration-150 ${phase ? "opacity-100" : "pointer-events-none opacity-0"}`}
			role="status"
			aria-live="polite"
		>
			<div className="flex h-5 items-center gap-4 text-[12px] lg:text-[13px]">
				{phase === "typing" ? (
					<span className="text-gray-400">{PHASE_TEXT.typing}</span>
				) : (
					ORDER.map((step, i) => (
						<span
							key={step}
							className={`items-center gap-1.5 ${i === at ? "flex text-amber-300" : i < at ? "hidden text-gray-400 sm:flex" : "hidden text-gray-500 sm:flex"}`}
						>
							{i < at ? (
								<CheckIcon className="h-3.5 w-3.5 text-amber-400" aria-hidden />
							) : (
								<span
									aria-hidden
									className={`block h-1.5 w-1.5 rounded-full ${i === at ? "animate-pulse bg-amber-400 motion-reduce:animate-none" : "bg-gray-600"}`}
								/>
							)}
							{phase === "refining" && i === at ? PHASE_TEXT.refining : PHASE_TEXT[step]}
						</span>
					))
				)}
			</div>
			<div className="mt-2 grid grid-cols-3 gap-1.5" aria-hidden>
				{ORDER.map((step, i) => (
					<span key={step} className="relative h-0.5 overflow-hidden rounded-full bg-white/10">
						<span
							className={`absolute inset-0 origin-left rounded-full bg-amber-400 transition-transform duration-300 ease-out ${i < at ? "scale-x-100" : i === at ? "scale-x-50" : "scale-x-0"}`}
						/>
					</span>
				))}
			</div>
		</div>
	)
}

/** One line with the step (variant E, over the skeletons). */
export function PrototypePhaseLine({ phase }: { phase: PrototypeLoadingPhase | null }) {
	return (
		<div
			className={`flex h-5 items-center gap-2 text-[12px] transition-opacity duration-150 lg:text-[13px] ${phase ? "text-gray-400 opacity-100" : "opacity-0"}`}
			role="status"
			aria-live="polite"
		>
			{phase && (
				<>
					<span
						aria-hidden
						className="block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/15 border-t-amber-400 motion-reduce:animate-none"
					/>
					{PHASE_TEXT[phase]}
				</>
			)}
		</div>
	)
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect
// A poster that never loads (far down, lazy) shows anyway after this long.
const REVEAL_FALLBACK_MS = 2500

/** A card held over its skeleton until its poster has loaded (variant E). */
export function PrototypeRevealCard({ children }: { children: ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	const [shown, setShown] = useState(false)
	useIsoLayoutEffect(() => {
		const image = ref.current?.querySelector("img")
		if (!image || (image.complete && image.naturalWidth > 0)) return setShown(true)
		const done = () => setShown(true)
		image.addEventListener("load", done, { once: true })
		image.addEventListener("error", done, { once: true })
		const timer = setTimeout(done, REVEAL_FALLBACK_MS)
		return () => {
			image.removeEventListener("load", done)
			image.removeEventListener("error", done)
			clearTimeout(timer)
		}
	}, [])
	return (
		<div ref={ref} className="relative">
			{!shown && (
				<div className="absolute inset-0" aria-hidden>
					<SkeletonCard />
				</div>
			)}
			<div
				className={`transition duration-300 ease-out ${shown ? "scale-100 opacity-100" : "pointer-events-none scale-[0.97] opacity-0"}`}
			>
				{children}
			</div>
		</div>
	)
}

/** The fixed note naming the variant on screen, with links to the others. */
export function PrototypeLoadingNote({
	variant,
	phase,
}: {
	variant: PrototypeLoadingVariant | null
	phase: PrototypeLoadingPhase | null
}) {
	const [, setParams] = useSearchParams()
	const pick = (next: PrototypeLoadingVariant | null) =>
		setParams(
			(previous) => {
				const out = new URLSearchParams(previous)
				if (next) out.set("loading", next)
				else out.delete("loading")
				return out
			},
			{ replace: true, preventScrollReset: true },
		)
	return (
		<div className="fixed bottom-3 left-3 z-[60] max-w-[calc(100vw-1.5rem)] rounded-xl bg-gray-950/90 px-3 py-2 text-[12px] text-gray-300 shadow-lg ring-1 ring-white/10 backdrop-blur">
			<div className="flex items-center gap-1">
				<span className="mr-1 font-bold text-amber-300">Loading prototype</span>
				{(Object.keys(PROTOTYPE_LOADING_VARIANTS) as PrototypeLoadingVariant[]).map((key) => (
					<button
						key={key}
						type="button"
						onClick={() => pick(key)}
						className={`h-6 w-6 cursor-pointer rounded-md font-bold ${key === variant ? "bg-amber-400 text-gray-950" : "text-gray-300 hover:bg-white/10"}`}
					>
						{key}
					</button>
				))}
				<button
					type="button"
					onClick={() => pick(null)}
					className={`h-6 cursor-pointer rounded-md px-1.5 ${variant === null ? "bg-amber-400 font-bold text-gray-950" : "text-gray-300 hover:bg-white/10"}`}
				>
					Today
				</button>
			</div>
			<div className="mt-1 truncate text-gray-400">
				{variant ? PROTOTYPE_LOADING_VARIANTS[variant] : "As on main"}
				{phase ? ` · ${PHASE_TEXT[phase]}` : ""}
			</div>
		</div>
	)
}
