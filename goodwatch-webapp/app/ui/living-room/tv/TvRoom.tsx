// The new TV's room (docs/implementation/tv-screen-revamp, slice 2): the softened room photo, the TV as large as
// the window allows, and the Remote in the hand under it, or beside it in a small window. A scene narrower than
// PHONE_BELOW is the phone's room: a framed TV on the wall, the sideboard under it, and the phone's Remote. A
// phone in landscape has the framed TV on the left and the phone's Remote on the right. The section with the
// start titles and the hubs follows the room, as on the start page today (BelowRoom.tsx).
//
// The room draws no TV screen and holds no TV state: `tv` is the seam to the machine (room-tv.ts) and
// `renderScreen` draws what is on the TV, on the canvas the room hands it.
//
// Rendering budget (#190): the photo's softening is in its file, the lights are plain translucent layers, and
// nothing here animates but one-shot opacity and shadow changes with the power.
//
// Not here yet, on purpose:
// - The first paint (slice 12). The scene is laid out once it has measured itself. Until then the room's block
//   holds the TV's screen alone, in both editions and not painted, so that the HTML has the home's H1 for every
//   window (tv.css, `tvr-first`). tv.css gets the mirror of `layoutRoom` and `layoutPhoneRoom` then.
// Pointing (TvPointer.tsx, pointing.ts): the room hands it the measured scene, the element that turns (`remoteEl`)
// and the ring. It moves both by `transform` and sets no state here.
// The keyboard is the TV's (use-tv.ts), which leaves the keys alone while the room is `inert`.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useHasDock } from "~/ui/navigation"
import { assetUrl } from "~/utils/asset-url"
import { BelowRoom } from "../BelowRoom"
import { Remote } from "../Remote"
import type { StartTitle } from "../living-room-data"
import { HAND_IMAGE, PHONE_LIP, ROOM } from "../room"
import type { TvAction } from "../tv-flow"
import { TV_SCREEN_ATTR } from "../tv-transition"
import { bracketArm } from "../tv-way-back"
import { ROOM_ID, useBelowRoom } from "../use-below-room"
import { PhoneRemote } from "./PhoneRemote"
import { LandscapeRoom, PhoneRoom } from "./PhoneRoom"
import { TvPointer, usePointing } from "./TvPointer"
import type { PointingScene } from "./pointing"
import { ROOM_ART } from "./room-art"
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
import type { RoomKey, RoomTv, TvCanvas } from "./room-tv"

const useIsoLayoutEffect =
	typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * A phone in landscape: a window wider than tall and at most 540 px tall. living-room.css has the same query;
 * from 768 px of width the room is the whole window there, above the site's header, and the lip is a tab.
 */
const LANDSCAPE = "(orientation: landscape) and (max-height: 540px)"
/** The lip in landscape: a tab of 46 px (living-room.css), which tv.css puts under the Remote. */
const LANDSCAPE_TAB = { tv: 0, remote: 46 }
/** Under 768 px of width the room is not the whole window in landscape, and the lip is a bar across it. */
const LANDSCAPE_BAR = { tv: PHONE_LIP, remote: PHONE_LIP }

export type TvRoomProps = {
	tv: RoomTv
	/** Draws the TV's screen on the canvas of the edition the window has. Nothing is drawn while the TV is off. */
	renderScreen?: (canvas: TvCanvas) => ReactNode
	/** The titles the section below the room links to. */
	startTitles: StartTitle[]
	/** Forces the Remote's place or the phone Remote's form, whatever the window would choose: for checks. */
	want?: { place?: RemotePlace; form?: PhoneRemoteForm }
}

/** The canvases the screen is drawn on before the window is measured: one per edition, at their full size. */
const FIRST_CANVASES: TvCanvas[] = [
	{ edition: "desktop", ...TV_CANVAS, scale: 1, first: true },
	{ edition: "phone", ...PHONE_TV_CANVAS, scale: 1, first: true },
]

/** The desktop Remote speaks the old TV's actions (ui/living-room/tv-flow.ts) until the old TV is gone. */
function keyOf(action: TvAction): RoomKey | null {
	switch (action.type) {
		case "step":
			return { type: "step", by: action.by }
		case "back":
			return { type: "back" }
		case "home":
			return { type: "home" }
		case "toggle-menu":
			return { type: "menu" }
		case "open-search":
			return { type: "search" }
		case "service-key":
			return { type: "service", service: action.service }
		case "power":
			return { type: "power", on: action.on }
		default:
			return null
	}
}

export function TvRoom({ tv, renderScreen, startTitles, want }: TvRoomProps) {
	// The room is the first screen of the page; use-below-room.ts owns how the page moves between it and the
	// section below. Its contract: a block with the room's id that takes no input while it is away.
	const travel = useBelowRoom()
	const docked = useHasDock()

	// ---- Layout: measured once per resize.
	const root = useRef<HTMLDivElement>(null)
	const [size, setSize] = useState<{
		w: number
		h: number
		landscape: boolean
	} | null>(null)
	useIsoLayoutEffect(() => {
		const el = root.current
		if (!el) return
		const landscape = window.matchMedia(LANDSCAPE)
		const measure = () =>
			setSize((s) =>
				s &&
				s.w === el.clientWidth &&
				s.h === el.clientHeight &&
				s.landscape === landscape.matches
					? s
					: {
							w: el.clientWidth,
							h: el.clientHeight,
							landscape: landscape.matches,
						},
			)
		measure()
		const ro = new ResizeObserver(measure)
		ro.observe(el)
		landscape.addEventListener("change", measure)
		return () => {
			ro.disconnect()
			landscape.removeEventListener("change", measure)
		}
	}, [])
	const room: "landscape" | "phone" | "desktop" | null = !size
		? null
		: size.landscape
			? "landscape"
			: size.w < PHONE_BELOW
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
						size.w < PHONE_BELOW ? LANDSCAPE_BAR : LANDSCAPE_TAB,
						want?.form ?? "auto",
					)
				: null,
		[size, room, want?.form],
	)
	const D = useMemo(
		() =>
			size && room === "desktop"
				? layoutRoom(size.w, size.h, want?.place ?? "auto")
				: null,
		[size, room, want?.place],
	)
	const L = P ?? S ?? D
	/** The phone's Remote and its hand, upright or sideways. */
	const held = P ?? S

	const on = tv.power !== "off"

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
				// Not `data-power`: that marks the Remote's power key (Remote.tsx).
				data-tv-power={on ? "on" : "off"}
				// Scrolled out of the window, the room takes no input: the keys and the pointer are the page's.
				{...(travel.away && { inert: "" })}
				className={`living-room lr-page tvr overflow-clip bg-[#07080b] text-white ${docked ? "lr-docked" : ""} ${held ? "select-none [-webkit-touch-callout:none]" : ""}`}
			>
				{D && (
					<div className="absolute" style={D.photo}>
						<picture>
							<source type="image/avif" srcSet={assetUrl(ROOM_ART.avif)} />
							<img
								{...{ fetchpriority: "high" }}
								src={assetUrl(ROOM_ART.webp)}
								alt={ROOM.alt}
								width={ROOM_PHOTO.w}
								height={ROOM_PHOTO.h}
								className="absolute inset-0 h-full w-full select-none"
								draggable={false}
							/>
						</picture>
						{/* The lights are low: the TV is the brightest thing in the room. Lower still with the TV off. */}
						<div
							className="tvr-dim absolute inset-0"
							style={{ opacity: on ? 0.34 : 0.66 }}
						/>
						{/* And they fall off toward the corners: a plain gradient around the TV, no blend mode. */}
						<div
							className="absolute inset-0"
							style={{
								background: `radial-gradient(62% 70% at ${tvCenter.x}% ${tvCenter.y}%, rgba(5,6,10,0) 45%, rgba(5,6,10,.5) 100%)`,
							}}
						/>
					</div>
				)}
				{/* Before the window is measured: the screen in both editions, so the HTML is the same for every window. */}
				{!L &&
					renderScreen &&
					FIRST_CANVASES.map((first) => (
						<div
							key={first.edition}
							data-tv-canvas={first.edition}
							className={`tvr-first tvr-first-${first.edition}`}
							style={{ width: first.w, height: first.h }}
						>
							{on && renderScreen(first)}
						</div>
					))}
				{P && <PhoneRoom L={P} on={on} />}
				{S && <LandscapeRoom L={S} on={on} />}

				{/* The TV's picture. Its screens are drawn on a fixed canvas, scaled to cover it. */}
				{L && canvas && (
					<div
						{...{ [TV_SCREEN_ATTR]: "" }}
						data-tv-framed={tv.framed ? "" : undefined}
						className={`tvr-tv absolute touch-none select-none overflow-hidden bg-black [-webkit-touch-callout:none] ${held ? "rounded-[3px]" : "rounded-[4px]"}`}
						style={L.tv}
					>
						<div
							data-tv-canvas={canvas.edition}
							className="absolute left-0 top-0 origin-top-left"
							style={{
								width: canvas.w,
								height: canvas.h,
								transform: `translate(${L.canvas.x}px, ${L.canvas.y}px) scale(${canvas.scale})`,
							}}
						>
							{on && renderScreen?.(canvas)}
						</div>
						{/* The frame the picture stands in while the Expand key has the focus. */}
						{tv.framed &&
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
				)}

				{/* The desktop: the hand holds the Remote from behind, and the pair leans back toward the screen. */}
				{D && (
					<div
						ref={remoteEl}
						data-remote
						className="absolute will-change-transform"
						style={{
							left: D.remote.left,
							top: D.remote.top,
							width: REMOTE_W * D.remote.scale,
							height: REMOTE_H * D.remote.scale,
							transformOrigin: `50% ${REMOTE_WRIST * 100}%`,
							transform: REMOTE_REST_TRANSFORM,
						}}
					>
						<Hand style={D.hand} />
						<div
							className="absolute left-0 top-0 origin-top-left"
							style={{ transform: `scale(${D.remote.scale})` }}
						>
							<Remote
								// The old TV's screen type: the Remote reads it only to light its Search key.
								screen={
									tv.searching
										? { name: "search", query: null }
										: { name: "home" }
								}
								power={tv.power}
								menuOpen={tv.menuOpen}
								serviceName={tv.serviceName}
								activeService={tv.activeService}
								dispatch={(action) => {
									const key = keyOf(action)
									if (key) tv.press(key)
								}}
								onOk={() => tv.press({ type: "ok" })}
								onDirection={(dir) => tv.press({ type: "move", dir })}
							/>
						</div>
					</div>
				)}

				{/* The phone: the Remote and the hand that holds it move as one when the Remote aims. */}
				{held && (
					<div
						ref={remoteEl}
						data-remote-rig
						className="absolute left-0 top-0 will-change-transform"
						style={{ transformOrigin: `${held.rig.x}px ${held.rig.y}px` }}
					>
						{held.hand && <Hand style={held.hand} />}
						<PhoneRemote
							tv={tv}
							form={held.form}
							at={held.remote}
							bottom={held.h}
						/>
					</div>
				)}

				{/* The TV's own pointer: over the picture it takes the system cursor's place. */}
				{L && <TvPointer pointer={pointerEl} small={Boolean(held)} />}
			</div>
			<BelowRoom
				titles={startTitles}
				docked={docked}
				onDown={travel.onDown}
				onBack={travel.onBack}
			/>
		</>
	)
}

function Hand({
	style,
}: { style: { left: number; top: number; width: number; height: number } }) {
	return (
		<picture>
			<source type="image/avif" srcSet={assetUrl(HAND_IMAGE.avif)} />
			<img
				src={assetUrl(HAND_IMAGE.webp)}
				alt=""
				aria-hidden
				className="pointer-events-none absolute max-w-none select-none"
				style={style}
				draggable={false}
			/>
		</picture>
	)
}
