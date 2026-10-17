// PROTOTYPE - throwaway. One intro scene (living-room/intro/scenes) on its own small screen, for /how-it-works rows.
// The scene plays when its screen scrolls into view and holds its last frame; scrolled out and back, it plays again.
// The intro's data comes from /api/intro once per page (the start page's TV asks for the same thing).
import "~/ui/living-room/intro/intro.css"
import {
	type CSSProperties,
	type ReactNode,
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react"
import { Stage } from "~/ui/living-room/intro/player"
import type { IntroData, Scene } from "~/ui/living-room/intro/scene"
import { FILM } from "~/ui/living-room/intro/film"

const IntroDataContext = createContext<IntroData | null>(null)

export function IntroDataProvider({ children }: { children: ReactNode }) {
	const [data, setData] = useState<IntroData | null>(null)
	useEffect(() => {
		let gone = false
		fetch("/api/intro")
			.then((r) => (r.ok ? (r.json() as Promise<IntroData>) : null))
			.then((d) => {
				if (!gone && d?.pool?.length) setData(d)
			})
			.catch(() => {})
		return () => {
			gone = true
		}
	}, [])
	return <IntroDataContext.Provider value={data}>{children}</IntroDataContext.Provider>
}

export const useIntroData = () => useContext(IntroDataContext)

export const sceneById = (id: string): Scene | undefined => FILM.find((s) => s.id === id)

/** True once the element is at least `ratio` in view; `again` turns it false when it leaves, so it can replay. */
export function useInView<T extends HTMLElement>(ratio = 0.45) {
	const ref = useRef<T>(null)
	const [seen, setSeen] = useState(0)
	const [inView, setInView] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el) return
		const io = new IntersectionObserver(
			([e]) => {
				if (e.isIntersecting && e.intersectionRatio >= ratio) {
					setInView((was) => {
						if (!was) setSeen((n) => n + 1)
						return true
					})
				} else if (!e.isIntersecting) setInView(false)
			},
			{ threshold: [0, ratio] },
		)
		io.observe(el)
		return () => io.disconnect()
	}, [ratio])
	return { ref, inView, seen }
}

/**
 * A scene on its own screen. The box's shape comes from `className` (aspect-video by default). `k` is the stage's
 * speed: < 1 plays faster. With `run` set, the parent decides when it plays (a sticky screen); otherwise it plays on
 * scroll into view. `replay` adds a small Replay button once it has played.
 */
export function SceneScreen({
	id,
	k = 1,
	className = "aspect-video",
	style,
	run,
	replay = false,
}: {
	id: string
	k?: number
	className?: string
	style?: CSSProperties
	/** A number that changes to replay the scene; when set, the screen doesn't watch the scroll itself. */
	run?: number
	replay?: boolean
}) {
	const data = useIntroData()
	const { ref, seen } = useInView<HTMLDivElement>()
	const [again, setAgain] = useState(0)
	const scene = sceneById(id)
	const key = (run ?? seen) + again * 1000
	return (
		<div ref={ref} className={`relative overflow-hidden bg-[#05060a] ${className}`} style={style}>
			{data && scene && key > 0 && (
				<Stage k={k}>
					<div
						key={key}
						className={`film-slot ${run !== undefined && key > 1 ? "film-in film-tr-fade" : "film-on"}`}
						style={{ "--o": "450ms" } as CSSProperties}
						data-scene={scene.id}
					>
						<scene.C data={data} />
					</div>
				</Stage>
			)}
			{replay && key > 0 && (
				<button
					type="button"
					onClick={() => setAgain((n) => n + 1)}
					className="absolute right-2.5 bottom-2.5 z-10 flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white/85 ring-1 ring-white/15 transition hover:bg-black/75 hover:text-white"
				>
					<svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden="true">
						<path d="M12 5a7 7 0 1 1-6.6 4.7l1.9.6A5 5 0 1 0 12 7v3L7.5 6 12 2v3z" fill="currentColor" />
					</svg>
					Replay
				</button>
			)}
		</div>
	)
}
