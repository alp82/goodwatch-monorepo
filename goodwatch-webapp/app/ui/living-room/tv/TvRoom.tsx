import type { TalkedRow } from "~/domain/talked-about-now"
import { useNavigationType } from "@remix-run/react"
// The new TV's room (docs/implementation/tv-screen-revamp, slice 2): the softened room photo, the TV as large as
// the window allows, and the Remote in the hand centred under it, at every size. A scene narrower than
// PHONE_BELOW is the phone's room: a wide framed TV on the wall, the sideboard under it, and the phone's Remote
// held under it; a phone in landscape the same, in front of the desktop's photo. The section with the
// start titles and the hubs follows the room, as on the start page today (BelowRoom.tsx).
//
// The room draws no TV screen and holds no TV state: `tv` is the seam to the machine (room-tv.ts) and
// `renderScreen` draws what is on the TV, on the canvas the room hands it.
//
// Rendering budget (#190): the photo's softening is in its file, the lights are plain translucent layers, and
// nothing here animates but one-shot opacity and shadow changes with the power.
//
// The first paint (slice 12): the scene is laid out by script once it has measured itself. Until then (on the
// server, and while the page hydrates) the room holds the parts of every layout at once, both editions of the TV's
// screen and both forms of the phone's Remote, and living-room.css places them where `layoutRoom`, `layoutPhoneRoom` and
// `layoutPhoneLandscape` will, and shows the ones the window's layout has. So the HTML is the same for every
// window, it paints the room before any script runs, and hydration moves nothing.
// Pointing (TvPointer.tsx, pointing.ts): the room hands it the measured scene, the element that turns (`remoteEl`)
// and the ring. It moves both by `transform` and sets no state here.
// The keyboard is the TV's (use-tv.ts), which leaves the keys alone while the room is `inert`.
import {
	memo,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import type { ReactNode } from "react"
import { assetBase, assetUrl } from "~/utils/asset-url"
import { HERO_TIMING } from "~/utils/start-after-paint"
import type { NewWeekRow } from "~/server/new-on-services-page.server"
import { BelowRoom } from "../BelowRoom"
import { Remote, type RemoteService } from "../Remote"
import type { StartTitle } from "../living-room-data"
import { HAND_IMAGE, PHONE_LIP, ROOM } from "../room"
import { TV_SCREEN_ATTR, wayBackScroll } from "../tv-transition"
import { bracketArm } from "../tv-way-back"
import { ROOM_ID, useBelowRoom } from "../use-below-room"
import { PhoneRemote } from "./PhoneRemote"
import { LandscapeRoom, PhoneRoom } from "./PhoneRoom"
import { TvPointer, usePointing } from "./TvPointer"
import type { PointingScene } from "./pointing"
import { NO_PICTURE, ROOM_ART, UPRIGHT_PHONE } from "./room-art"
import {
	PHONE_BELOW,
	PHONE_TV_CANVAS,
	type PhoneRemoteForm,
	REMOTE_H,
	REMOTE_REST_TRANSFORM,
	REMOTE_W,
	REMOTE_WRIST,
	ROOM_PHOTO,
	type RemotePlace,
	TV_CANVAS,
	layoutPhoneLandscape,
	layoutPhoneRoom,
	layoutRoom,
} from "./room-layout"
import type { RoomTv, TvCanvas } from "./room-tv"
import { TV_ITEM_ATTR, bringIntoView } from "./tv-dom"

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * A phone in landscape: a window wider than tall and at most 540 px tall. living-room.css has the same query;
 * from 768 px of width the room is the whole window there, above the site's header, and the lip is a tab.
 */
const LANDSCAPE = "(orientation: landscape) and (max-height: 540px)"
/**
 * A phone's room: a window narrower than PHONE_BELOW. The window's width, not the room's, as living-room.css lays
 * out the lip and living-room.css the first paint: on a desktop with a scrollbar's gutter the two differ by its width.
 */
const PHONE = `(max-width: ${PHONE_BELOW - 0.02}px)`
export type TvRoomProps = {
	tv: RoomTv
	/** Draws the TV's screen on the canvas of the edition the window has. Nothing is drawn while the TV is off. */
	renderScreen?: (canvas: TvCanvas) => ReactNode
	/** The titles the section below the room links to. */
	startTitles: StartTitle[]
	/** "Talked about now" below the room (#557). */
	talked?: TalkedRow | null
	/** This week's arrivals on a member's services (#489), below the room. */
	newOn?: NewWeekRow | null
	/** The person's own two streaming services: the Remotes' two keys, in their order. */
	services: readonly RemoteService[]
	/** Forces the Remote's place or the phone Remote's form, whatever the window would choose: for checks. */
	want?: { place?: RemotePlace; form?: PhoneRemoteForm }
	/** Drawn over the TV's picture, under its frame: the intro's boot screen and film (intro/HomeIntro.tsx). */
	screenOverlay?: ReactNode
	/** At the top of the section below the room: "How GoodWatch works" for a guest. */
	belowIntro?: ReactNode
}

/** The canvases the screen is drawn on before the window is measured: one per edition, at their full size. */
const FIRST_CANVASES: TvCanvas[] = [
	{ edition: "desktop", ...TV_CANVAS, scale: 1, first: true },
	{ edition: "phone", ...PHONE_TV_CANVAS, scale: 1, first: true },
]

/**
 * What does not change when the TV's focus moves is not drawn again when it does: the Remotes and the section
 * below the room. A focus move draws the screen anew; on a phone with a slow CPU the room around it doubled that.
 */
const StillRemote = memo(Remote)
const StillPhoneRemote = memo(PhoneRemote)
const StillBelowRoom = memo(BelowRoom)

export function TvRoom({
	tv,
	renderScreen,
	startTitles,
	talked,
	newOn = null,
	services,
	want,
	screenOverlay,
	belowIntro,
}: TvRoomProps) {
	// The room is the first screen of the page; use-below-room.ts owns how the page moves between it and the
	// section below. Its contract: a block with the room's id that takes no input while it is away.
	const travel = useBelowRoom()

	// ---- Layout: measured once per resize.
	const root = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState<{
		w: number
		h: number
		landscape: boolean
		phone: boolean
	} | null>(null)
	useIsoLayoutEffect(() => {
		const el = root.current
		if (!el) return
		const landscape = window.matchMedia(LANDSCAPE)
		const phone = window.matchMedia(PHONE)
		// To the fraction of a pixel, as living-room.css's first paint reads the room's size (a phone's window often has a
		// fractional height). The room has no border, no padding and no transform but a slide up.
		const measure = () => {
			const { width: w, height: h } = el.getBoundingClientRect()
			setSize((s) =>
				s &&
				s.w === w &&
				s.h === h &&
				s.landscape === landscape.matches &&
				s.phone === phone.matches
					? s
					: { w, h, landscape: landscape.matches, phone: phone.matches },
			)
		}
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		landscape.addEventListener("change", measure)
		phone.addEventListener("change", measure)
		return () => {
			ro.disconnect()
			landscape.removeEventListener("change", measure)
			phone.removeEventListener("change", measure)
		}
	}, [])
	const room: "landscape" | "phone" | "desktop" | null = !size
		? null
		: size.landscape
			? "landscape"
			: size.phone
				? "phone"
				: "desktop"
	const P = useMemo(
		() =>
			size && room === "phone"
				? layoutPhoneRoom(size.w, size.h, PHONE_LIP, want?.form ?? "auto")
				: null,
		[size, room, want?.form],
	)
	const S = useMemo(
		() =>
			size && room === "landscape"
				? layoutPhoneLandscape(
						size.w,
						size.h,
						// The lip is a tab at the right, clear of the Remote in the middle, at every width.
						0,
						want?.form ?? "auto",
					)
				: null,
		[size, room, want?.form],
	)
	const D = useMemo(
		() => (size && room === "desktop" ? layoutRoom(size.w, size.h) : null),
		[size, room],
	)
	const L = P ?? S ?? D

	// ---- Back from a page the TV opened: the room shows what it showed on leaving, once, as soon as it has
	// measured the window and drawn its screen at its size. Before that the canvas is drawn at the first paint's
	// size, so an item paged into view then lands short. The room's scroll and its screen's columns come back from
	// the trip; the focused item (the key that left) is paged into view if it still needs it; and if the window still
	// cuts it (a trip an older build stored), the room centers it. Once only, before any input: a scroll after it
	// is the person's own.
	const navigationType = useNavigationType()
	const wayBack = useRef<ReturnType<typeof wayBackScroll> | undefined>(
		undefined,
	)
	useIsoLayoutEffect(() => {
		if (wayBack.current === undefined)
			wayBack.current = wayBackScroll(navigationType)
		const back = wayBack.current
		const el = root.current
		if (!back || !L || !el) return
		wayBack.current = null
		el.scrollTop = back.room
		// The same screen comes back, with the same columns: each where it was (the focused item's growth isn't in
		// a paging, which stops at the item's edge).
		const columns = el.querySelectorAll<HTMLElement>(
			`[${TV_SCREEN_ATTR}] [data-tv-scroll]`,
		)
		if (columns.length === back.columns.length)
			columns.forEach((column, i) => {
				column.scrollTop = back.columns[i]
			})
		const item = el.querySelector<HTMLElement>(
			`[${TV_ITEM_ATTR}][aria-current="true"]`,
		)
		if (!item) return
		bringIntoView(item, false)
		const box = el.getBoundingClientRect()
		const r = item.getBoundingClientRect()
		// Centered then, clear of what stands at the window's edges (the lip, the header).
		if (r.bottom > box.bottom || r.top < box.top)
			el.scrollTop += r.top + r.height / 2 - (box.top + box.height / 2)
	}, [L])
	/** The phone's Remote and its hand, upright or sideways. */
	const held = P ?? S

	const on = tv.power !== "off"
	const { press } = tv
	const [raise, setRaise] = useState(false)

	// ---- Pointing moves this element, the desktop Remote in its hand or the phone's Remote with its, and the ring.
	const remoteEl = useRef<HTMLDivElement>(null)
	const pointerEl = useRef<HTMLDivElement>(null)
	// Nothing points while the TV is off or booting, or the room is out of the window.
	const live = tv.power === "on" && !travel.away
	const point = tv.point
	const scene = useMemo<PointingScene | null>(
		() =>
			L && size
				? {
						tv: L.tv,
						width: size.w,
						height: size.h,
						live,
						hand: D && { ...D.remote, place: D.place },
						rig: held?.rig ?? null,
						focus: point,
					}
				: null,
		[L, D, held, size, live, point],
	)
	usePointing({ root, remote: remoteEl, pointer: pointerEl }, scene)

	const canvas: TvCanvas | null = L && {
		edition: held ? "phone" : "desktop",
		w: L.canvas.w,
		h: L.canvas.h,
		scale: L.canvas.scale,
	}
	// Before the window is measured (on the server and while the page hydrates) the room is drawn for every
	// window at once: the parts of each layout, placed by living-room.css (`tvr-f-*`), which shows the ones the window's
	// layout has. Once measured, each part that stays keeps its node, so a picture is not drawn anew.
	const first = !L
	const canvases = canvas ? [canvas] : FIRST_CANVASES
	const forms: PhoneRemoteForm[] = held ? [held.form] : first ? ["hand"] : []
	// The phone's Remote where its keys don't all show at rest: a tap raises it over the TV's lower part, a tap
	// beside it lowers it again. While it rests, a tap on it only raises it: no key is pressed by the tap that
	// brings it up.
	const peek = Boolean(held?.remote.peek)
	const raised = peek && raise
	useEffect(() => {
		if (!peek) setRaise(false)
	}, [peek])
	// The frame's brackets are as long as those of the way out, which stand in the same place at the press.
	const arm = L && tv.framed ? bracketArm(L.tv) : 0
	const tvCenter = {
		x: ((ROOM_PHOTO.tv.x + ROOM_PHOTO.tv.w / 2) / ROOM_PHOTO.w) * 100,
		y: ((ROOM_PHOTO.tv.y + ROOM_PHOTO.tv.h / 2) / ROOM_PHOTO.h) * 100,
	}
	return (
		<>
			<div
				ref={root}
				id={ROOM_ID}
				data-room={room ?? "unmeasured"}
				data-remote-place={D?.place}
				data-remote-form={held?.form}
				// The room is taller than the window: a swipe over the picture scrolls it too (living-room.css).
				data-room-scrolls={L && size && L.height > size.h + 1 ? "" : undefined}
				// Not `data-power`: that marks the Remote's power key (Remote.tsx).
				data-tv-power={on ? "on" : "off"}
				// Scrolled out of the window, the room takes no input: the keys and the pointer are the page's.
				{...(travel.away && { inert: "" })}
				className={`living-room lr-page tvr tvr-scroll bg-[#07080b] text-white ${held ? "select-none [-webkit-touch-callout:none]" : ""}`}
			>
				{/* The stage: as tall as the room's content (`height` of the layout), which may be taller than the room
				    where the TV at the room's width and the Remote under it don't both fit; the room then scrolls to the
				    Remote (living-room.css, `tvr-scroll`). It clips what reaches past it: the photos and the hand. */}
				<div
					className="tvr-stage relative overflow-clip"
					style={L ? { height: L.height } : undefined}
				>
					{/* The room photo: the desktop's, and a phone's in landscape, where the framed TV stands in front of it. */}
					{(first || D || S) && (
						<div
							key="photo"
							data-tvr-part="photo"
							className={`absolute ${first ? "tvr-f-photo" : ""}`}
							style={D?.photo ?? S?.photo}
						>
							<picture>
								{/* A phone upright draws its own photo: before the window is measured this one asks for nothing there. */}
								{first && <source media={UPRIGHT_PHONE} srcSet={NO_PICTURE} />}
								<source type="image/avif" srcSet={assetUrl(ROOM_ART.avif)} />
								{/* Without credentials on the static hostname, as the 103 Early Hints response preloads it (server/early-hints.ts). */}
								<img
									{...{ fetchpriority: "high" }}
									{...HERO_TIMING}
									crossOrigin={assetBase() ? "anonymous" : undefined}
									src={assetUrl(ROOM_ART.webp)}
									alt={ROOM.alt}
									width={ROOM_PHOTO.w}
									height={ROOM_PHOTO.h}
									className="absolute inset-0 h-full w-full select-none"
									draggable={false}
								/>
							</picture>
							{(first || D) && (
								<>
									{/* The lights are low: the TV is the brightest thing in the room. Lower still with the TV off. */}
									<div
										className={`tvr-dim absolute inset-0 ${first ? "tvr-f-desk" : ""}`}
										style={{ opacity: on ? 0.34 : 0.66 }}
									/>
									{/* And they fall off toward the corners: a plain gradient around the TV, no blend mode. */}
									<div
										className={`absolute inset-0 ${first ? "tvr-f-desk" : ""}`}
										style={{
											background: `radial-gradient(62% 70% at ${tvCenter.x}% ${tvCenter.y}%, rgba(5,6,10,0) 45%, rgba(5,6,10,.5) 100%)`,
										}}
									/>
								</>
							)}
						</div>
					)}
					{(first || P) && <PhoneRoom key="phone" L={P} on={on} />}
					{(first || S) && <LandscapeRoom key="landscape" L={S} on={on} />}

					{/* The TV's picture. Its screens are drawn on a fixed canvas, scaled to cover it; before the window is
				    measured, in both editions, and CSS shows the one the window's layout draws. */}
					<div
						key="tv"
						{...{ [TV_SCREEN_ATTR]: "" }}
						data-tvr-part="tv"
						data-tv-framed={tv.framed ? "" : undefined}
						className={`tvr-tv absolute touch-none select-none overflow-hidden bg-black [-webkit-touch-callout:none] ${first ? "tvr-f-tv" : held ? "rounded-[3px]" : "rounded-[4px]"}`}
						style={L?.tv}
					>
						{canvases.map((one) => (
							<div
								key={one.edition}
								data-tv-canvas={one.edition}
								className={`absolute left-0 top-0 origin-top-left ${one.first ? `tvr-f-cv tvr-f-cv-${one.edition}` : ""}`}
								style={
									L
										? {
												width: one.w,
												height: one.h,
												transform: `translate(${L.canvas.x}px, ${L.canvas.y}px) scale(${one.scale})`,
											}
										: undefined
								}
							>
								{on && renderScreen?.(one)}
							</div>
						))}
						{screenOverlay}
						{/* The hint while the Expand key has the focus: brackets that come out to the picture's corners. */}
						{tv.framed &&
							L &&
							[0, 1, 2, 3].map((corner) => (
								<i
									key={corner}
									aria-hidden
									className="tvr-bracket"
									data-corner={corner}
									style={{ width: arm, height: arm }}
								/>
							))}
					</div>

					{/* The desktop: the hand holds the Remote from behind, and the pair leans back toward the screen. */}
					{(first || D) && (
						<div
							key="remote"
							ref={D ? remoteEl : undefined}
							data-remote
							data-tvr-part="remote"
							className={`absolute will-change-transform ${first ? "tvr-f-remote" : ""}`}
							style={
								D
									? {
											left: D.remote.left,
											top: D.remote.top,
											width: REMOTE_W * D.remote.scale,
											height: REMOTE_H * D.remote.scale,
											transformOrigin: `50% ${REMOTE_WRIST * 100}%`,
											transform: REMOTE_REST_TRANSFORM,
										}
									: undefined
							}
						>
							<Hand style={D?.hand} className={first ? "tvr-f-dhand" : ""} />
							<div
								className={`absolute left-0 top-0 origin-top-left ${first ? "tvr-f-rscale" : ""}`}
								style={
									D ? { transform: `scale(${D.remote.scale})` } : undefined
								}
							>
								<StillRemote
									power={tv.power}
									menuOpen={tv.menuOpen}
									searching={tv.searching}
									services={services}
									openService={tv.openService}
									press={press}
								/>
							</div>
						</div>
					)}

					{/* A tap beside the raised Remote lowers it, and reaches nothing under it. */}
				{raised && (
					<button
						key="lower"
						type="button"
						aria-label="Lower the Remote"
						data-remote-lower
						className="absolute inset-0 cursor-default"
						onClick={() => setRaise(false)}
					/>
				)}
				{/* The phone: the Remote and the hand that holds it move as one when the Remote aims, and rise as one. Before
				    the window is measured the form is placed by living-room.css. */}
				{(first || held) && (
					<div
						key="lift"
						data-remote-lift={peek ? (raised ? "up" : "rest") : undefined}
						className="tvr-lift pointer-events-none absolute inset-0"
						style={
							held && raised
								? { transform: `translateY(${-held.remote.lift}px)` }
								: undefined
						}
						// A key reached by Tab raises the Remote, so the key it focuses is in view.
						onFocus={() => {
							if (peek) setRaise(true)
						}}
					>
						<div
							key="rig"
							ref={held ? remoteEl : undefined}
							data-remote-rig
							className={`absolute left-0 top-0 will-change-transform ${first ? "tvr-f-rig" : ""}`}
							style={
								held
									? { transformOrigin: `${held.rig.x}px ${held.rig.y}px` }
									: undefined
							}
						>
							{forms.map((form) => (
								<div
									key={form}
									data-tvr-form={form}
									className={first ? "tvr-f-form" : undefined}
								>
									<Hand
										style={held?.hand ?? undefined}
										className={first ? "tvr-f-phand" : ""}
									/>
									<StillPhoneRemote
										tv={tv}
										services={services}
										form={form}
										at={held?.remote}
									/>
								</div>
							))}
						</div>
						{/* At rest a tap on the Remote raises it and presses nothing. */}
						{held && peek && !raised && (
							<button
								type="button"
								aria-label="Raise the Remote"
								data-remote-raise
								tabIndex={-1}
								className="pointer-events-auto absolute cursor-pointer"
								style={{
									left: held.remote.left,
									top: held.remote.top,
									width: held.remote.width,
									height: held.height - held.remote.top,
								}}
								onClick={() => setRaise(true)}
							/>
						)}
					</div>
				)}

				{/* The TV's own pointer: over the picture it takes the system cursor's place. */}
					{L && (
						<TvPointer
							key="pointer"
							pointer={pointerEl}
							small={Boolean(held)}
						/>
					)}
				</div>
			</div>
			<StillBelowRoom
				intro={belowIntro}
				titles={startTitles}
				talked={talked}
				newOn={newOn}
				onDown={travel.onDown}
				onBack={travel.onBack}
			/>
		</>
	)
}

function Hand({
	style,
	className = "",
}: {
	/** Its box, once the window is measured; before, living-room.css places it (`className`). */
	style?: { left: number; top: number; width: number; height: number }
	className?: string
}) {
	return (
		<picture>
			<source type="image/avif" srcSet={assetUrl(HAND_IMAGE.avif)} />
			{/* The hand around the phone's Remote is the largest picture of a phone's first screen (its LCP). The page's
			    scripts start once it has painted (HERO_TIMING). The 103 Early Hints response preloads it without credentials
			    on the static hostname (server/early-hints.ts), so the picture asks the same way. */}
			<img
				{...{ fetchpriority: "high" }}
				{...HERO_TIMING}
				crossOrigin={assetBase() ? "anonymous" : undefined}
				src={assetUrl(HAND_IMAGE.webp)}
				alt=""
				aria-hidden
				className={`pointer-events-none absolute max-w-none select-none ${className}`}
				style={style}
				draggable={false}
			/>
		</picture>
	)
}
