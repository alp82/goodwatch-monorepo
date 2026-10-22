// The Remote ("Arc", round 6 of the prototype on branch prototype/living-room-remote): power, the IR window, and
// the Menu key; the D-pad wheel with OK; Back, Search, and Home as round keys in an arc under the wheel, each with
// its word printed on the body; and two streaming keys. It has no screen: the TV shows what is focused. Every
// control presses a key of the room (`RoomKey`, tv/room-tv.ts); the Remote keeps no state of its own besides the
// wheel's arrow flash.
//
// The streaming keys stand for the person's own two services (`services`): a key shows that service's mark
// (`ServiceMark`), opens the TV screen "On <service>" and is pressed while that screen shows.
import { assetUrl } from "~/utils/asset-url"
import { type ReactNode, useEffect, useRef, useState } from "react"
import gwLogo from "~/img/goodwatch-logo-white.svg"
import { REMOTE_H } from "./room"
import type { RoomKey } from "./tv/room-tv"

export const ICON = {
	back: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
	home: "M3 11l9-7 9 7M5 10v10h14V10",
	search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5",
	power: "M12 3v8M6.3 7.3a8 8 0 1 0 11.4 0",
	menu: "M4 7h16M4 12h16M4 17h16",
	mood: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8.5 14.5c1 1.2 2.1 1.8 3.5 1.8s2.5-.6 3.5-1.8M9 9.5h.01M15 9.5h.01",
	heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
	info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01",
} as const

export function Icon({
	d,
	className = "h-[18px] w-[18px]",
}: { d: string; className?: string }) {
	return (
		<svg
			viewBox="0 0 24 24"
			className={className}
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d={d} />
		</svg>
	)
}

/** A streaming service a key stands for (`TvService`, ui/living-room/tv/tv-home.ts). */
export type RemoteService = {
	/** Its TMDB provider id. */
	id: number
	name: string
	/** The catalog's logo, a TMDB path. */
	logo_path: string | null
}

/**
 * The services the Remote has a drawn mark for, by TMDB provider id: how wide the mark is for its height and on
 * a key of this Remote (in Remote pixels), and the service's own colour. The mark's
 * shape and ink are in living-room.css (`tv-mark-<id>`).
 */
const DRAWN: Record<number, { ratio: number; key: number; color: string }> = {
	8: { ratio: 3.7, key: 68, color: "#e50914" },
	9: { ratio: 3.25, key: 71, color: "#1a98ff" },
}

/** A length to a tenth of a pixel: the server's HTML holds it. */
const px = (length: number) => Math.round(length * 10) / 10

/** Whether the Remote has a drawn mark for a service: the mark then says its name. */
export const hasDrawnMark = (service: Pick<RemoteService, "id">) =>
	service.id in DRAWN

/** Whether a service has a mark at all: a drawn one, or a logo in the catalog. Without one its name is written. */
export const hasServiceMark = (
	service: Pick<RemoteService, "id" | "logo_path">,
) => hasDrawnMark(service) || Boolean(service.logo_path)

/** A service's own colour, for the services the Remote has a mark for; null for any other. */
export const serviceColor = (service: Pick<RemoteService, "id">) =>
	DRAWN[service.id]?.color ?? null

/**
 * A streaming service's mark: the Remote's own drawn mark where it has one (Netflix, Prime Video), else the
 * service's logo from the catalog, `height` tall, else nothing (`hasServiceMark`: the caller then writes the
 * name). On a key of the Remotes, on the service's tile on home and at the head of its screen.
 */
export function ServiceMark({
	service,
	height,
	onKey,
	className = "",
}: {
	service: RemoteService
	height: number
	/**
	 * On a key of a Remote, a drawn mark is as wide as that key's print: this times its width on the desktop
	 * Remote's key. `height` is then the logo's alone.
	 */
	onKey?: number
	className?: string
}) {
	const drawn = DRAWN[service.id]
	if (drawn) {
		const width = onKey ? drawn.key * onKey : height * drawn.ratio
		// The shape is a class and not a style: home's tiles are in the server's HTML, in both editions, and a small
		// mark is a data URL of 1.5 KB.
		return (
			<span
				aria-hidden
				data-service-mark="drawn"
				className={`tv-mark tv-mark-${service.id} block shrink-0 ${className}`}
				style={{ width: px(width), height: px(width / drawn.ratio) }}
			/>
		)
	}
	if (!service.logo_path) return null
	return (
		<img
			src={`https://image.tmdb.org/t/p/w92${service.logo_path}`}
			alt=""
			aria-hidden
			data-service-mark="logo"
			draggable={false}
			decoding="async"
			// Home's tiles are in the server's HTML in both editions, one of them not shown: its logo is not asked for.
			loading="lazy"
			className={`block shrink-0 object-cover ${className}`}
			style={{ height, width: height, borderRadius: height * 0.22 }}
		/>
	)
}

export type RemoteProps = {
	power: "off" | "booting" | "on"
	menuOpen: boolean
	/** The search screen is showing: the Search key is pressed. */
	searching: boolean
	/** The person's own two services, in the keys' order. A key presses `service` with its id. */
	services: readonly RemoteService[]
	/** The service whose screen is showing, by its id, if any: its key is pressed. */
	openService: number | null
	press: (key: RoomKey) => void
}

export function Remote({
	power,
	menuOpen,
	searching,
	services,
	openService,
	press,
}: RemoteProps) {
	const waking = useRef(false)
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: only drops focus after pointer presses; keys need nothing
		<section
			className="relative select-none"
			aria-label="Remote control"
			// While the set is off, any press only turns it on.
			onPointerDownCapture={(e) => {
				if (power !== "off") return
				if ((e.target as HTMLElement).closest("[data-power]")) return
				waking.current = true
				e.stopPropagation()
				press({ type: "power", on: true })
			}}
			onClickCapture={(e) => {
				if (!waking.current) return
				waking.current = false
				e.stopPropagation()
				e.preventDefault()
			}}
			// A pointer press must not leave the button focused, or the next Enter repeats it instead of
			// reaching the TV's focused item. Keyboard presses (detail 0) keep their focus.
			onClick={(e) => {
				if (e.detail === 0) return
				const button = (e.target as HTMLElement).closest("button")
				if (button === document.activeElement) button?.blur()
			}}
		>
			<div
				className="remote-body relative flex flex-col px-5 pb-6 pt-4"
				style={{ height: REMOTE_H }}
			>
				<div className="flex w-full items-center justify-between">
					<button
						type="button"
						data-power
						aria-label={power === "off" ? "Turn on" : "Turn off"}
						onClick={() => press({ type: "power", on: power === "off" })}
						className="remote-key flex h-11 w-11 items-center justify-center rounded-full text-rose-400"
					>
						<Icon d={ICON.power} className="h-5 w-5" />
					</button>
					<div className="h-2 w-20 rounded-full bg-black/70" aria-hidden />
					<button
						type="button"
						aria-label="Menu"
						title="Menu"
						aria-pressed={menuOpen}
						onClick={() => press({ type: "menu" })}
						className="remote-key flex h-11 w-11 items-center justify-center rounded-full"
					>
						<Icon d={ICON.menu} className="h-5 w-5" />
					</button>
				</div>
				{/* The arc: Back and Home sit against the wheel's lower corners, Search hangs between them. */}
				<div className="relative mt-10 h-[346px] w-full">
					<div className="absolute left-1/2 top-0 -translate-x-1/2">
						<Wheel press={press} />
					</div>
					<RoundKey
						d={ICON.back}
						label="Back"
						at="left-0 top-[216px]"
						onClick={() => press({ type: "back" })}
					/>
					<RoundKey
						d={ICON.search}
						label="Search"
						at="left-1/2 top-[252px] -translate-x-1/2"
						pressed={searching}
						onClick={() => press({ type: "search" })}
					/>
					<RoundKey
						d={ICON.home}
						label="Home"
						at="right-0 top-[216px]"
						onClick={() => press({ type: "home" })}
					/>
				</div>
				{/* Inset like the round keys, which are centered over their wider words. */}
				<div className="mt-6 grid grid-cols-2 gap-3 px-[7px]">
					{services.map((service) => (
						<button
							key={service.id}
							type="button"
							data-service-key={service.id}
							aria-pressed={openService === service.id}
							aria-label={`On ${service.name}`}
							title={`On ${service.name}`}
							onClick={() => press({ type: "service", service: service.id })}
							className="remote-key remote-service flex h-[52px] min-w-0 items-center justify-center rounded-full px-3"
						>
							<ServiceMark service={service} height={32} onKey={1} />
							{!hasServiceMark(service) && (
								<span className="truncate text-[15px] font-bold">
									{service.name}
								</span>
							)}
						</button>
					))}
				</div>
				<div className="flex-1" />
				<img
					src={assetUrl(gwLogo)}
					alt=""
					className="mx-auto mb-2 h-7 opacity-20"
				/>
			</div>
		</section>
	)
}

/** A round key with its word printed on the body under it. */
function RoundKey({
	d,
	label,
	at,
	pressed,
	onClick,
}: {
	d: string
	label: string
	/** Where it sits in the arc. */
	at: string
	pressed?: boolean
	onClick: () => void
}) {
	return (
		<div className={`absolute ${at} flex w-[76px] flex-col items-center gap-2`}>
			<button
				type="button"
				aria-label={label}
				aria-pressed={pressed}
				onClick={onClick}
				className="remote-key flex h-[62px] w-[62px] items-center justify-center rounded-full"
			>
				<Icon d={d} className="h-[26px] w-[26px]" />
			</button>
			<span
				aria-hidden
				className="text-[13px] font-semibold uppercase leading-tight tracking-[0.1em] text-white/60"
			>
				{label}
			</span>
		</div>
	)
}

// ---------------------------------------------------------------------------------------------------------
// The D-pad wheel. The ring doesn't move: the arrow in the direction you move lights up briefly. Dragging
// around the ring and scrolling step too; the four arrows and OK work as buttons.

const STEP_DEG = 30
const SIZE = 236
type Dir = "top" | "bottom" | "left" | "right"

const GLOW_AT: Record<Dir, string> = {
	top: "left-1/2 -translate-x-1/2 top-0.5",
	bottom: "left-1/2 -translate-x-1/2 bottom-0.5",
	left: "top-1/2 -translate-y-1/2 left-0.5",
	right: "top-1/2 -translate-y-1/2 right-0.5",
}
const ARROW: Record<Dir, string> = {
	top: "M6 15l6-6 6 6",
	bottom: "M6 9l6 6 6-6",
	left: "M15 6l-6 6 6 6",
	right: "M9 6l6 6-6 6",
}
const ARROW_AT: Record<Dir, string> = {
	top: "left-1/2 top-3.5 -translate-x-1/2",
	bottom: "bottom-3.5 left-1/2 -translate-x-1/2",
	left: "left-3.5 top-1/2 -translate-y-1/2",
	right: "right-3.5 top-1/2 -translate-y-1/2",
}
const ARROW_LABEL: Record<Dir, string> = {
	top: "Up",
	bottom: "Down",
	left: "Previous",
	right: "Next",
}

function Wheel({ press }: { press: (key: RoomKey) => void }) {
	const ref = useRef<HTMLDivElement>(null)
	const drag = useRef<{ angle: number; acc: number } | null>(null)
	const [flash, setFlash] = useState<{ dir: Dir; n: number } | null>(null)
	const latest = useRef(press)
	latest.current = press

	const turn = (by: 1 | -1, dir: Dir = by > 0 ? "right" : "left") => {
		setFlash((f) => ({ dir, n: (f?.n ?? 0) + 1 }))
		latest.current({ type: "step", by })
	}
	const turnRef = useRef(turn)
	turnRef.current = turn

	const angle = (e: { clientX: number; clientY: number }) => {
		const b = (ref.current as HTMLDivElement).getBoundingClientRect()
		return (
			(Math.atan2(
				e.clientY - (b.top + b.height / 2),
				e.clientX - (b.left + b.width / 2),
			) *
				180) /
			Math.PI
		)
	}

	// Scrolling over the wheel steps; a passive listener couldn't stop the page from scrolling.
	useEffect(() => {
		const el = ref.current
		if (!el) return
		let acc = 0
		const onWheel = (e: WheelEvent) => {
			e.preventDefault()
			acc += e.deltaY
			if (Math.abs(acc) >= 40) {
				const by = acc > 0 ? 1 : -1
				acc = 0
				turnRef.current(by)
			}
		}
		el.addEventListener("wheel", onWheel, { passive: false })
		return () => el.removeEventListener("wheel", onWheel)
	}, [])

	useEffect(() => {
		if (!flash) return
		const id = setTimeout(() => setFlash(null), 260)
		return () => clearTimeout(id)
	}, [flash])

	return (
		<div
			ref={ref}
			className="remote-wheel relative touch-none rounded-full"
			style={{ width: SIZE, height: SIZE }}
			onPointerDown={(e) => {
				if ((e.target as HTMLElement).closest("button")) return
				e.currentTarget.setPointerCapture(e.pointerId)
				drag.current = { angle: angle(e), acc: 0 }
			}}
			onPointerMove={(e) => {
				const d = drag.current
				if (!d) return
				const a = angle(e)
				let delta = a - d.angle
				if (delta > 180) delta -= 360
				if (delta < -180) delta += 360
				d.angle = a
				d.acc += delta
				while (Math.abs(d.acc) >= STEP_DEG) {
					const by = d.acc > 0 ? 1 : -1
					d.acc -= by * STEP_DEG
					turn(by)
				}
			}}
			onPointerUp={() => {
				drag.current = null
			}}
			onPointerCancel={() => {
				drag.current = null
			}}
			title="Wheel: drag around or scroll to step"
		>
			{(Object.keys(GLOW_AT) as Dir[]).map((dir) => (
				<span
					key={dir}
					aria-hidden
					className={`remote-glow pointer-events-none absolute ${GLOW_AT[dir]} h-14 w-14 rounded-full transition-opacity duration-200`}
					style={{ opacity: flash?.dir === dir ? 1 : 0 }}
				/>
			))}
			<div className="remote-face pointer-events-none absolute inset-[14px] rounded-full" />
			{(Object.keys(ARROW) as Dir[]).map((dir) => (
				<ArrowKey
					key={dir}
					dir={dir}
					onClick={() => {
						setFlash((f) => ({ dir, n: (f?.n ?? 0) + 1 }))
						press({
							type: "move",
							dir: dir === "top" ? "up" : dir === "bottom" ? "down" : dir,
						})
					}}
				/>
			))}
			<button
				type="button"
				onClick={() => press({ type: "ok" })}
				className="remote-ok absolute left-1/2 top-1/2 flex h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[16px] font-bold tracking-wider text-white/85 transition-transform active:scale-95"
			>
				OK
			</button>
		</div>
	)
}

function ArrowKey({
	dir,
	onClick,
}: { dir: Dir; onClick: () => void }): ReactNode {
	return (
		<button
			type="button"
			aria-label={ARROW_LABEL[dir]}
			title={ARROW_LABEL[dir]}
			onClick={onClick}
			className={`remote-arrow absolute ${ARROW_AT[dir]} flex h-11 w-11 items-center justify-center rounded-full text-white/55 transition hover:text-white active:scale-90`}
		>
			<svg
				viewBox="0 0 24 24"
				className="h-5 w-5"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.6"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
			>
				<path d={ARROW[dir]} />
			</svg>
		</button>
	)
}
