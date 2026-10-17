// PROTOTYPE - throwaway. One intro scene full width, for screenshots while designing /how-it-works:
// /prototype/hiw-scenes?scene=one-score
import { useSearchParams } from "@remix-run/react"
import { IntroDataProvider, SceneScreen } from "~/ui/prototype-hiw/scene-screen"

export function loader() {
	if (process.env.NODE_ENV === "production") throw new Response("Not found", { status: 404 })
	return null
}

export const meta = () => [{ title: "Scenes · prototype" }, { name: "robots", content: "noindex, nofollow" }]

export default function HiwScenes() {
	const [params] = useSearchParams()
	const id = params.get("scene") ?? "one-score"
	const shape = params.get("shape") ?? "aspect-video"
	return (
		<IntroDataProvider>
			<div className="mx-auto max-w-5xl p-4">
				<SceneScreen id={id} className={`rounded-2xl ${shape}`} />
			</div>
		</IntroDataProvider>
	)
}
