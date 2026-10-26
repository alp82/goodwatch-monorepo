// PROTOTYPE (README pictures): shows one README scene alone on a 1440x770 stage at the top left, over the app's
// layout, so a recorder can screenshot or screencast it. Data is a snapshot of goodwatch.app's /api/intro.
// ?k=2 slows the scene down (the intro's --k), ?pause=<ms> freezes every animation at that time for stills.
import { useParams, useSearchParams } from "@remix-run/react"
import { useEffect, useState } from "react"
import { Stage } from "~/ui/living-room/intro/player"
import "~/ui/living-room/intro/intro.css"
import type { IntroData } from "~/ui/living-room/intro/scene"
import data from "~/ui/prototype-readme/intro-data.json"
import { SCENES } from "~/ui/prototype-readme/scenes"

export default function PrototypeReadmeScene() {
	const { scene = "" } = useParams()
	const [params] = useSearchParams()
	const k = Number(params.get("k") ?? 1)
	const pause = params.get("pause")
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])
	useEffect(() => {
		if (!mounted || pause == null) return
		const t = Number(pause)
		const id = setTimeout(() => {
			for (const a of document.getAnimations()) {
				a.pause()
				a.currentTime = t
			}
			document.documentElement.dataset.paused = "1"
		}, 300)
		return () => clearTimeout(id)
	}, [mounted, pause])
	const entry = SCENES[scene]
	if (!entry) return <div style={{ padding: 40 }}>No scene "{scene}". Scenes: {Object.keys(SCENES).join(", ")}</div>
	return (
		<div id="readme-scene" style={{ position: "fixed", left: 0, top: 0, width: 1440, height: 770, zIndex: 2147483000, background: "#05060a" }}>
			{mounted ? (
				<Stage k={k}>
					<entry.C data={data as unknown as IntroData} />
				</Stage>
			) : null}
		</div>
	)
}
