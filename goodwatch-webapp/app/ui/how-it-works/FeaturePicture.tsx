// A /how-it-works row's picture. The box is in the server's HTML at its final size, so nothing shifts; the picture
// itself (pictures.tsx, with the intro's styles) loads on demand and mounts the first time the box scrolls into view,
// once the intro's data has arrived. The pictures repeat what the row's text says, so screen readers skip them.
import {
	type ReactNode,
	Suspense,
	createContext,
	lazy,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react"
import type { IntroData } from "~/ui/living-room/intro/scene"
import type { Feature, PictureId } from "./features"

const Picture = lazy(() => import("./pictures"))

const IntroDataContext = createContext<IntroData | null>(null)

/** Reads /api/intro once for every picture on the page: the same answer the start page's TV reads. */
export function IntroDataProvider({ children }: { children: ReactNode }) {
	const [data, setData] = useState<IntroData | null>(null)
	useEffect(() => {
		let gone = false
		fetch("/api/intro")
			.then((res) => (res.ok ? (res.json() as Promise<IntroData>) : null))
			.then((body) => {
				if (!gone && body?.pool?.length) setData(body)
			})
			.catch((error) =>
				console.error("The intro's data couldn't be read", error),
			)
		return () => {
			gone = true
		}
	}, [])
	return (
		<IntroDataContext.Provider value={data}>
			{children}
		</IntroDataContext.Provider>
	)
}

/** True from the first time a third of the element is in view. */
function useShown<T extends HTMLElement>() {
	const ref = useRef<T>(null)
	const [shown, setShown] = useState(false)
	useEffect(() => {
		const el = ref.current
		if (!el || shown) return
		const io = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) setShown(true)
			},
			{ threshold: 0.35 },
		)
		io.observe(el)
		return () => io.disconnect()
	}, [shown])
	return { ref, shown }
}

export function FeaturePicture({
	id,
	phone,
}: { id: PictureId; phone: Feature["phone"] }) {
	const data = useContext(IntroDataContext)
	const { ref, shown } = useShown<HTMLDivElement>()
	return (
		<div
			ref={ref}
			aria-hidden="true"
			className={`hiw-pic-host ${id === "taste" || id === "discord" ? "hiw-pic-film" : ""} relative w-full ${phone === "tall" ? "aspect-[4/5]" : "aspect-square"} sm:aspect-[2/1]`}
		>
			{data && shown && (
				<Suspense fallback={null}>
					<Picture id={id} data={data} />
				</Suspense>
			)}
		</div>
	)
}
