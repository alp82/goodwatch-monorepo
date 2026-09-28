// The living room (#229): on phones the phone scene takes over (#230, `PhoneLivingRoom`). On the desktop: the room photo, the TV on the wall, and the Remote in a hand below it. The TV
// flow (`useTvFlow`) drives both; the keyboard works like the Remote. The Remote leans back toward the screen and
// turns at most 6 degrees toward what it points at: the pointer over the TV, else the focused item. No beam.
//
// Rendering budget (#190): only transform and opacity follow the pointer or animate, nothing loops at idle, and
// nothing blends or blurs over the room photo.
import { useLocation, useSearchParams } from "@remix-run/react"
import { motion, useReducedMotion, useSpring } from "framer-motion"
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import type { Score as RatingScore } from "~/server/scores.server"
import { useContinueWithGoogle } from "~/ui/taste-quiz/continue-with-google"
import {
	QUIZ_GOAL,
	type QuizState,
	readQuizKey,
} from "~/ui/taste-quiz/quiz-flow"
import { useTasteQuiz } from "~/ui/taste-quiz/use-taste-quiz"
import { titleToDashed } from "~/utils/helpers"
import {
	PHONE_PORTRAIT_QUERY,
	PhoneLivingRoom,
	usePhoneOrientation,
} from "./PhoneLivingRoom"
import { PhoneTvScreens } from "./PhoneTvScreens"
import { Remote, type RemoteProps } from "./Remote"
import { pickKey } from "./TvQuiz"
import { LivingRoomLinks, TvScreens, type TvView, lcdLines } from "./TvScreens"
import {
	type LivingRoomChoices,
	type LivingRoomData,
	NO_CHOICES,
	remoteServiceName,
	tvContextOf,
} from "./living-room-data"
import {
	HAND_IMAGE,
	PHONE_ROOM,
	PHONE_TV_CANVAS,
	REMOTE_H,
	REMOTE_TILT_DEG,
	REMOTE_W,
	ROOM,
	TV_CANVAS,
	layoutRoom,
	remoteTurnToward,
} from "./room"
import {
	type Night,
	type TvEffect,
	type TvScreen,
	readTvState,
	writeTvParams,
} from "./tv-flow"
import { TV_SCREEN_ATTR, useReturnIntoTv } from "./tv-transition"
import { useTvFlow } from "./use-tv-flow"

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

// Until the window is measured (on the server and while hydrating), the scene is laid out by CSS: the
// `living-room-first` rules in living-room.css mirror `layoutRoom` and `layoutPhone`, and media queries pick the
// desktop, phone portrait, or phone landscape layout and the phone room photo, so the first paint needs no script
// and the HTML stays the same for every visitor (#233).
const ROOM_SIZES =
	"max(100vw, calc((100vh - 64px) * 1.777), calc(min(80vw, (100vh - 64px) * 0.759) * 2.7365))"

export type LivingRoomProps = {
	data: LivingRoomData
	/**
	 * Effects the page carries out: `leave`, `watch`, `want-to-see`, `seen`, and `not-for-me`. The living room
	 * handles `toggle-service` and `answer-pair` itself (in `choices`) and reports them here too.
	 */
	onEffect: (effect: TvEffect, choices: LivingRoomChoices) => void
	signInHref: string
	/** Rates a title from 1 to 10 (the phone title screen's rating). */
	onRate?: (titleKey: string, score: RatingScore) => void
}

function nightOf(screen: TvScreen): Night | null {
	return screen.name === "moods" ||
		screen.name === "source" ||
		screen.name === "picks"
		? screen.night
		: null
}

export function LivingRoom({
	data,
	onEffect,
	signInHref,
	onRate,
}: LivingRoomProps) {
	const phone = usePhoneOrientation()
	useReturnIntoTv()
	const [params] = useSearchParams()
	const [choices, setChoices] = useState<LivingRoomChoices>(NO_CHOICES)
	const [draft, setDraftState] = useState("")
	const screen = useMemo(() => readTvState(params).screen, [params])
	const night = useMemo(() => nightOf(screen), [screen])

	// The taste quiz (#226): titles and picks load only once the TV shows it.
	const quizStep = screen.name === "quiz" ? screen.quiz : null
	const quiz = useTasteQuiz({
		titles: [],
		member: data.member,
		enabled: quizStep != null,
		wantPicks: quizStep != null && quizStep.screen !== "quiz",
	})
	const quizPicks = useMemo(() => quiz.picks.map(pickKey), [quiz.picks])
	const ctx = useMemo(
		() => ({
			...tvContextOf(data, choices, night),
			quizProgress: quiz.progress,
			quizPicks,
		}),
		[data, choices, night, quiz.progress, quizPicks],
	)
	// Continue with Google returns to the quiz's picks.
	const google = useContinueWithGoogle()
	const { pathname } = useLocation()
	const quizRef = useRef({ quiz, google, pathname, params })
	quizRef.current = { quiz, google, pathname, params }

	const choicesRef = useRef(choices)
	choicesRef.current = choices
	const handleEffect = useCallback(
		(effect: TvEffect) => {
			let next = choicesRef.current
			if (effect.type === "toggle-service") {
				const on = next.services.includes(effect.service)
				next = {
					...next,
					services: on
						? next.services.filter((s) => s !== effect.service)
						: [...next.services, effect.service],
				}
			} else if (effect.type === "answer-pair") {
				next = { ...next, answers: [...next.answers, effect.side] }
			} else if (effect.type.startsWith("quiz-")) {
				handleQuizEffect(effect, quizRef.current, (e) =>
					onEffect(e, choicesRef.current),
				)
				return
			}
			choicesRef.current = next
			setChoices(next)
			onEffect(effect, next)
		},
		[onEffect],
	)
	const flow = useTvFlow(ctx, handleEffect)
	const { state, dispatch } = flow
	const searching = state.screen.name === "search" && !state.screen.query

	const setDraft = useCallback(
		(update: (d: string) => string) => setDraftState(update),
		[],
	)
	const ok = useCallback(() => {
		if (searching) dispatch({ type: "submit-search", query: draft })
		else dispatch({ type: "ok" })
	}, [searching, draft, dispatch])

	// A fresh keyboard each time search opens.
	useEffect(() => {
		if (searching) setDraftState("")
	}, [searching])

	useRemoteKeys({
		power: state.power,
		searching,
		quiz: state.screen.name === "quiz" ? state.screen.quiz : null,
		dispatch,
		ok,
		setDraft,
	})

	// ---- Layout: measured once per resize, never per pointer move.
	const root = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState<{ w: number; h: number } | null>(null)
	useIsoLayoutEffect(() => {
		const el = root.current
		if (!el) return
		const measure = () =>
			setSize((s) =>
				s && s.w === el.clientWidth && s.h === el.clientHeight
					? s
					: { w: el.clientWidth, h: el.clientHeight },
			)
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		return () => ro.disconnect()
	}, [])
	const L = useMemo(() => (size ? layoutRoom(size.w, size.h) : null), [size])

	// ---- The Remote turns toward its target: springs only, so pointer moves never re-render the page.
	const reduceMotion = useReducedMotion()
	const turn = useSpring(0, { stiffness: 900, damping: 60 })
	const pointing = useRef(false)
	const aimAt = useCallback(
		(point: { x: number; y: number } | null) => {
			if (reduceMotion || !L) return
			turn.set(point ? remoteTurnToward(L, point) : 0)
		},
		[L, reduceMotion, turn],
	)
	const toWindow = (e: { clientX: number; clientY: number }) => {
		const b = root.current?.getBoundingClientRect()
		return b ? { x: e.clientX - b.left, y: e.clientY - b.top } : null
	}
	// Without the pointer on the TV, the Remote points at the focused item.
	useEffect(() => {
		if (pointing.current || !flow.focused || state.power !== "on") {
			if (!pointing.current) aimAt(null)
			return
		}
		const el = root.current?.querySelector<HTMLElement>(
			`[data-tv-item="${CSS.escape(flow.focused)}"]`,
		)
		const b = el?.getBoundingClientRect()
		aimAt(
			b
				? toWindow({
						clientX: b.left + b.width / 2,
						clientY: b.top + b.height / 2,
					})
				: null,
		)
	}, [flow.focused, state.power, aimAt])

	const view: TvView = {
		state,
		focused: flow.focused,
		dispatch,
		data,
		choices,
		draft,
		setDraft,
		signInHref,
		onRate,
		quiz,
	}
	const activeService = night?.service ?? null
	const remote: RemoteProps = {
		screen: state.screen,
		power: state.power,
		lcd: lcdLines(state, flow.focused, data, draft),
		serviceName: (key) => remoteServiceName(key, data.catalog),
		activeService,
		dispatch,
		onOk: ok,
	}
	if (phone)
		return <PhoneLivingRoom orientation={phone} view={view} remote={remote} />

	const on = state.power !== "off"
	const tvCenter = {
		x: `${((ROOM.tv.x + ROOM.tv.w / 2) / ROOM.w) * 100}%`,
		y: `${((ROOM.tv.y + ROOM.tv.h / 2) / ROOM.h) * 100}%`,
	}
	const canvasOffset = L && {
		x: (L.tv.width - TV_CANVAS.w * L.canvasScale) / 2,
		y: (L.tv.height - TV_CANVAS.h * L.canvasScale) / 2,
	}
	// Before the window is measured, CSS places the photo, the TV, and the Remote (see ROOM_SIZES above).
	const first = !L
	return (
		<div
			ref={root}
			className={`living-room fixed inset-x-0 bottom-16 top-16 z-40 overflow-clip bg-[#07080b] text-white lg:bottom-0 ${first ? "living-room-first" : ""}`}
		>
			<LivingRoomLinks />
			{/* The photo covers the window; the TV and its light sit on it in the photo's own coordinates. */}
			<div
				className="lr-photo absolute"
				style={
					L
						? {
								left: L.photo.left,
								top: L.photo.top,
								width: L.photo.width,
								height: L.photo.height,
							}
						: undefined
				}
			>
				<picture>
					{first && (
						<>
							<source
								media={PHONE_PORTRAIT_QUERY}
								type="image/avif"
								srcSet={PHONE_ROOM.avif}
							/>
							<source
								media={PHONE_PORTRAIT_QUERY}
								type="image/webp"
								srcSet={PHONE_ROOM.webp}
							/>
						</>
					)}
					<source type="image/avif" srcSet={ROOM.avif} sizes={ROOM_SIZES} />
					<img
						{...{ fetchpriority: "high" }}
						src={ROOM.fallback}
						srcSet={ROOM.webp}
						sizes={ROOM_SIZES}
						alt={ROOM.alt}
						width={ROOM.w}
						height={ROOM.h}
						className="absolute inset-0 h-full w-full select-none"
						draggable={false}
					/>
				</picture>
				<div
					className="absolute inset-0 bg-[#05060a] transition-opacity duration-[1400ms] ease-out"
					style={{ opacity: on ? 0.12 : 0.6 }}
				/>
				{/* The TV's light on the room: a plain translucent gradient, no blend mode. */}
				<div
					className="pointer-events-none absolute inset-0 transition-opacity duration-500"
					style={{
						opacity: on ? 0.28 : 0,
						background: `radial-gradient(40% 55% at ${tvCenter.x} ${tvCenter.y}, #fbbf2466 0%, #fbbf2422 45%, #fbbf2400 100%)`,
					}}
				/>
			</div>
			<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_100%_at_40%_40%,transparent_60%,rgba(0,0,0,0.55)_100%)]" />

			{/* The TV. Its screens are drawn on a fixed canvas, scaled to cover the screen. */}
			<div
				{...{ [TV_SCREEN_ATTR]: "" }}
				className="lr-tv absolute overflow-hidden rounded-[3px] bg-black"
				style={{
					...(L && {
						left: L.tv.left,
						top: L.tv.top,
						width: L.tv.width,
						height: L.tv.height,
					}),
					boxShadow: on
						? "0 0 90px 8px rgba(251,191,36,0.16), 0 0 18px 1px rgba(251,191,36,0.2)"
						: "none",
				}}
				onPointerEnter={() => {
					pointing.current = true
				}}
				onPointerMove={(e) => {
					if (e.pointerType === "mouse") aimAt(toWindow(e))
				}}
				onPointerLeave={() => {
					pointing.current = false
					aimAt(null)
				}}
			>
				<div
					className="lr-canvas absolute left-0 top-0 origin-top-left"
					style={{
						width: TV_CANVAS.w,
						height: TV_CANVAS.h,
						transform:
							L && canvasOffset
								? `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${L.canvasScale})`
								: undefined,
					}}
				>
					<TvScreens view={view} />
				</div>
				{/* Phones get the phone edition of the first screen before the phone scene takes over. */}
				{first && (
					<div
						className="lr-canvas-phone absolute left-0 top-0 origin-top-left"
						style={{ width: PHONE_TV_CANVAS.w, height: PHONE_TV_CANVAS.h }}
					>
						<PhoneTvScreens view={view} />
					</div>
				)}
				<div className="tv-glass pointer-events-none absolute inset-0 rounded-[3px]" />
			</div>

			<div className="lr-caption pointer-events-none absolute bottom-6 left-8 flex max-w-[30%] items-center gap-3 [text-shadow:0_2px_14px_rgba(0,0,0,0.9)]">
				<img src={gwLogo} alt="" className="h-6" />
				<span className="text-[15px] font-bold uppercase tracking-[0.28em] text-white/90">
					GoodWatch
				</span>
				<span className="text-[15px] text-white/70">Pull up a seat.</span>
			</div>

			{/* The hand holds the Remote from behind: in the photo the fingers tuck behind it, so nothing goes in
			    front. The pair leans back toward the screen and turns from the bottom toward the target. */}
			<motion.div
				className="lr-remote absolute will-change-transform"
				style={{
					...(L && {
						left: L.remote.left,
						top: L.remote.top,
						width: REMOTE_W * L.remote.scale,
						height: REMOTE_H * L.remote.scale,
					}),
					originX: 0.5,
					originY: 1,
					transformPerspective: 1400,
					rotateX: REMOTE_TILT_DEG,
					rotate: turn,
				}}
			>
				<picture>
					<source type="image/avif" srcSet={HAND_IMAGE.avif} />
					<img
						src={HAND_IMAGE.webp}
						alt=""
						aria-hidden
						className="lr-hand pointer-events-none absolute max-w-none select-none"
						style={
							L
								? {
										left: L.hand.left,
										top: L.hand.top,
										width: L.hand.width,
										height: L.hand.height,
									}
								: undefined
						}
						draggable={false}
					/>
				</picture>
				<div
					className="lr-remote-scale absolute left-0 top-0 origin-top-left"
					style={L ? { transform: `scale(${L.remote.scale})` } : undefined}
				>
					<Remote {...remote} />
				</div>
			</motion.div>
		</div>
	)
}

// The keyboard works like the Remote: arrows turn the wheel, Enter is OK, Escape and Backspace are Back, H is
// Home. On the search keyboard, typing goes to the TV. While the set is off, any key turns it on.
function useRemoteKeys({
	power,
	searching,
	quiz,
	dispatch,
	ok,
	setDraft,
}: {
	power: "off" | "booting" | "on"
	searching: boolean
	/** The taste quiz step on screen: 1-9 and 0 score, S skips, P goes back to the picks. */
	quiz: QuizState | null
	dispatch: ReturnType<typeof useTvFlow>["dispatch"]
	ok: () => void
	setDraft: (update: (d: string) => string) => void
}) {
	const latest = useRef({ power, searching, quiz, dispatch, ok, setDraft })
	latest.current = { power, searching, quiz, dispatch, ok, setDraft }
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement
			if (target.closest("input, textarea, select, [contenteditable]")) return
			if (e.metaKey || e.ctrlKey || e.altKey) return
			// Buttons have their own Enter and Space.
			if ((e.key === "Enter" || e.key === " ") && target.closest("button, a"))
				return
			const k = latest.current
			if (k.power === "off") {
				k.dispatch({ type: "power", on: true })
				e.preventDefault()
				return
			}
			if (k.searching) {
				if (e.key === "Backspace") {
					k.setDraft((d) => d.slice(0, -1))
					e.preventDefault()
					return
				}
				if (e.key.length === 1) {
					k.setDraft((d) => (d + e.key).slice(0, 120))
					e.preventDefault()
					return
				}
			}
			const intent = k.quiz ? readQuizKey(e.key, k.quiz) : null
			if (intent && intent.type !== "turn") {
				k.dispatch({
					type: "choose",
					item:
						intent.type === "score"
							? `score:${intent.score}`
							: intent.type === "skip"
								? "quiz-skip"
								: "back-to-picks",
				})
				e.preventDefault()
				return
			}
			switch (e.key) {
				case "ArrowUp":
				case "ArrowLeft":
					k.dispatch({ type: "step", by: -1 })
					break
				case "ArrowDown":
				case "ArrowRight":
					k.dispatch({ type: "step", by: 1 })
					break
				case "Enter":
					k.ok()
					break
				case "Escape":
				case "Backspace":
					k.dispatch({ type: "back" })
					break
				case "h":
				case "H":
					k.dispatch({ type: "home" })
					break
				default:
					return
			}
			e.preventDefault()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])
}

/** Carries out a taste quiz effect with the quiz hook, or turns a pick into a page to leave for. */
function handleQuizEffect(
	effect: TvEffect,
	{
		quiz,
		google,
		pathname,
		params,
	}: {
		quiz: ReturnType<typeof useTasteQuiz>
		google: ReturnType<typeof useContinueWithGoogle>
		pathname: string
		params: URLSearchParams
	},
	leave: (effect: TvEffect) => void,
) {
	switch (effect.type) {
		case "quiz-rate":
			return quiz.rate(effect.score)
		case "quiz-skip":
			return quiz.skip()
		case "quiz-want":
			return quiz.wantToSee()
		case "quiz-save": {
			const current = readTvState(params).screen
			const picks = writeTvParams(
				{
					screen: {
						name: "quiz",
						quiz: {
							...(current.name === "quiz"
								? current.quiz
								: { goal: QUIZ_GOAL, page: 0 }),
							screen: "picks",
							pickedBefore: true,
						},
					},
					focus: null,
				},
				params,
			).toString()
			return google(`${pathname}?${picks}`)
		}
		case "quiz-pick": {
			const pick = quiz.picks.find((p) => pickKey(p) === effect.pick)
			if (pick)
				leave({
					type: "leave",
					to: {
						kind: "page",
						href: `/${pick.media_type}/${pick.tmdb_id}-${titleToDashed(pick.title)}`,
					},
				})
			return
		}
	}
}
