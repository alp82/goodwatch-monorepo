// The start page's scene with the new TV: the room (TvRoom.tsx), the TV's state (use-tv.ts), what is on the TV
// (TvScreen.tsx), the data behind it and the effects the machine names. The route hands it the loader's data.
import { useLocation } from "@remix-run/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useContinueWithGoogle } from "~/ui/taste-quiz/continue-with-google"
import { onFirstInteraction } from "~/utils/first-interaction"
import { TvRoom } from "./TvRoom"
import { TvScreen } from "./TvScreen"
import { loadFirstScreens } from "./screen-code"
import { type TvHomeData, homeApps, tvContextOf } from "./tv-home"
import type { TvEffect } from "./tv-machine"
import { useTv } from "./use-tv"
import { useTvPool } from "./use-tv-pool"

/** How long the TV's toast stays. */
const TOAST_MS = 2400

/** The TV's own toast: one line for a moment ("On your Wishlist"). */
function useTvToast() {
	const [text, setText] = useState<string | null>(null)
	const timer = useRef<ReturnType<typeof setTimeout>>()
	useEffect(() => () => clearTimeout(timer.current), [])
	const say = useCallback((next: string) => {
		setText(next)
		clearTimeout(timer.current)
		timer.current = setTimeout(() => setText(null), TOAST_MS)
	}, [])
	return [text, say] as const
}

export function TvLivingRoom({ data }: { data: TvHomeData }) {
	// The first sign that a person uses the page: the screens any key can open are asked for, and a guest's pool.
	const [interacted, setInteracted] = useState(false)
	useEffect(
		() =>
			onFirstInteraction(() => {
				setInteracted(true)
				loadFirstScreens()
			}),
		[],
	)
	// A member's Tonight came with the loader; they need the pool only for the Discover tile's posters, so it waits
	// until that tile first has the focus. A member with nothing to pick from gets the pool's best, as a guest does.
	const [discoverSeen, setDiscoverSeen] = useState(false)
	const own = data.member && data.tonight.length > 0
	const pool = useTvPool(data.member, own ? discoverSeen : interacted)
	const ctx = useMemo(() => tvContextOf(data, pool), [data, pool])
	const apps = useMemo(() => homeApps(data, pool), [data, pool])

	const [toast, say] = useTvToast()
	const google = useContinueWithGoogle()
	const location = useLocation()
	const here = useRef(location)
	here.current = location
	const onEffect = useCallback(
		(effect: TvEffect) => {
			switch (effect.type) {
				// Continue with Google, back to the same TV screen.
				case "sign-in":
					google(`${here.current.pathname}${here.current.search}`).catch(() =>
						say("Sign in isn't working right now"),
					)
					return
				// SEAM (slice 5): `expand` and `watch` leave through the TV (`useLeaveThroughTv`); `want-to-see`, `seen`
				// and `rate` are the title's mutations. SEAM (slice 8): `quiz-rate` and `quiz-skip` go to `useTasteQuiz`.
				default:
					return
			}
		},
		[google, say],
	)
	const tv = useTv(ctx, onEffect)
	useEffect(() => {
		if (tv.screen.name === "home" && tv.focused === "app:discover")
			setDiscoverSeen(true)
	}, [tv.screen.name, tv.focused])

	return (
		<TvRoom
			tv={tv.room}
			startTitles={data.startTitles}
			renderScreen={(canvas) => (
				<TvScreen tv={tv} canvas={canvas} ctx={ctx} apps={apps} toast={toast} />
			)}
		/>
	)
}
