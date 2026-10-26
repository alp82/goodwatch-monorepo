// The phone's Remote: the desktop Remote's dark body, its wheel with OK, its round keys with their icons and words,
// its streaming keys (the `remote-*` classes of living-room.css), on a body as long as its keys and a short grip
// with the mark, held in the hand. Every key is 44 px or more in both directions.
//
// The two streaming keys stand for the person's own two services (`services`): each shows its service's mark,
// opens the TV screen "On <service>", and is pressed while that screen shows.
//
// The wheel, a round key in each corner of a box a little taller than it (Search, Menu, Back, Home), the
// streaming keys under it, then the grip. It has no power key: "Turn off" is in the TV's menu, and a dark TV turns
// on with any key here. Where the window is short it rests with its top showing and a tap raises it (TvRoom.tsx).
import type { ReactNode } from "react"
import { whiteMark } from "~/ui/brand/white-mark"
import {
	ICON,
	Icon,
	type RemoteService,
	ServiceMark,
	hasServiceMark,
} from "../Remote"
import { PHONE_REMOTE, type PhoneRemoteForm } from "./room-layout"
import type { RoomDirection, RoomKey, RoomTv } from "./room-tv"

const WHEEL = 156
const KEY = 44
/**
 * Held, the wheel stands in the middle of a box this tall, a round key in each corner: a little taller than the
 * wheel, so the keys stand clear of its ring (about 123 units from its centre, not 103) and the Remote's keys
 * fill more of its body (PHONE_REMOTE.hand.keys: 10 + 216 + 14 + 44, and a little slack).
 */
const HELD = 216
const ARROW: Record<RoomDirection, string> = {
	up: "M6 15l6-6 6 6",
	down: "M6 9l6 6 6-6",
	left: "M15 6l-6 6 6 6",
	right: "M9 6l6 6-6 6",
}
const ARROW_LABEL: Record<RoomDirection, string> = {
	up: "Up",
	down: "Down",
	left: "Previous",
	right: "Next",
}
const ARROW_AT: Record<RoomDirection, string> = {
	up: "left-1/2 top-[3px] -translate-x-1/2",
	down: "bottom-[3px] left-1/2 -translate-x-1/2",
	left: "left-[3px] top-1/2 -translate-y-1/2",
	right: "right-[3px] top-1/2 -translate-y-1/2",
}
/** A key's printed word: a key has its own name, so a screen reader does not hear it twice. */
const WORD =
	"pointer-events-none whitespace-nowrap text-[8px] font-semibold uppercase leading-[11px] tracking-[0.08em] text-white/60"

/**
 * How large a streaming key's print is: a drawn mark's width against the desktop Remote's key (58 and 60 px), and
 * a catalog logo's side.
 */
const MARK: Record<PhoneRemoteForm, { drawn: number; logo: number }> = {
	hand: { drawn: 0.85, logo: 30 },
}

export type PhoneRemoteProps = {
	tv: RoomTv
	/** The person's own two services, in the keys' order. */
	services: readonly RemoteService[]
	form: PhoneRemoteForm
	/**
	 * Its box in the scene, at its scale `u` (`layoutPhoneRoom`). None before the window is measured: living-room.css
	 * places it then (`tvr-f-*`, the first paint).
	 */
	at?: { left: number; top: number; u: number; width: number }
}

export function PhoneRemote({
	tv,
	services,
	form,
	at,
}: PhoneRemoteProps) {
	// A dark TV: the first key only turns it on.
	const press = (key: RoomKey) => () =>
		tv.press(tv.power === "off" ? { type: "power", on: true } : key)
	const round = (label: string, d: string, key: RoomKey, pressed?: boolean) => (
		<button
			type="button"
			aria-label={label}
			aria-pressed={pressed}
			onClick={press(key)}
			className="remote-key flex shrink-0 items-center justify-center rounded-full"
			style={{ width: KEY, height: KEY }}
		>
			<Icon d={d} className="h-[19px] w-[19px]" />
		</button>
	)
	const service = (one: RemoteService) => (
		<button
			key={one.id}
			type="button"
			data-service-key={one.id}
			aria-label={`On ${one.name}`}
			aria-pressed={tv.openService === one.id}
			onClick={press({ type: "service", service: one.id })}
			className="remote-key remote-service flex w-full min-w-0 items-center justify-center rounded-full px-2"
			style={{ height: KEY }}
		>
			<ServiceMark
				service={one}
				height={MARK[form].logo}
				onKey={MARK[form].drawn}
			/>
			{!hasServiceMark(one) && (
				<span className="truncate text-[11px] font-bold">{one.name}</span>
			)}
		</button>
	)
	const keys = {
		back: round("Back", ICON.back, { type: "back" }),
		home: round("Home", ICON.home, { type: "home" }),
		search: round("Search", ICON.search, { type: "search" }, tv.searching),
		menu: round("Menu", ICON.menu, { type: "menu" }, tv.menuOpen),
	}
	// The first service's key is on the left, the second's on the right.
	const [first = null, second = null] = services.map(service)
	const wheel = (
		<div
			className="remote-wheel relative shrink-0 rounded-full"
			style={{ width: WHEEL, height: WHEEL }}
		>
			<div className="remote-face pointer-events-none absolute inset-[10px] rounded-full" />
			{(Object.keys(ARROW) as RoomDirection[]).map((dir) => (
				<button
					key={dir}
					type="button"
					aria-label={ARROW_LABEL[dir]}
					onClick={press({ type: "move", dir })}
					className={`remote-arrow absolute flex items-center justify-center rounded-full text-white/60 active:scale-90 active:text-white ${ARROW_AT[dir]}`}
					style={{ width: KEY, height: KEY }}
				>
					<svg
						viewBox="0 0 24 24"
						className="h-[18px] w-[18px]"
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
			))}
			<button
				type="button"
				onClick={press({ type: "ok" })}
				className="remote-ok absolute left-1/2 top-1/2 flex h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[13px] font-bold tracking-wider text-white/85 active:scale-95"
			>
				OK
			</button>
		</div>
	)
	const R = PHONE_REMOTE[form]
	// A key in each corner of a box a little taller than the wheel: the wheel is round, so the corners are free.
	const corner = (key: ReactNode, word: string, where: string, wordAt: string) => (
		<>
			<div className={`absolute ${where}`}>{key}</div>
			<span aria-hidden className={`absolute ${WORD} ${wordAt}`}>
				{word}
			</span>
		</>
	)
	const body = (
		<div
			className="remote-body relative flex flex-col"
			style={{ width: R.w, height: R.body, borderRadius: 34, padding: 10 }}
		>
			<div
				className="relative flex shrink-0 items-center justify-center"
				style={{ height: HELD }}
			>
				{wheel}
				{corner(keys.search, "Search", "left-0 top-0", "left-0 top-[46px]")}
				{corner(keys.menu, "Menu", "right-0 top-0", "right-0 top-[46px]")}
				{corner(keys.back, "Back", "bottom-0 left-0", "bottom-[46px] left-0")}
				{corner(keys.home, "Home", "bottom-0 right-0", "bottom-[46px] right-0")}
			</div>
			<div className="mt-[14px] grid shrink-0 grid-cols-2 gap-2">
				{first}
				{second}
			</div>
			{/* The grip: the mark, where the palm holds it. */}
			<img
				{...whiteMark()}
				alt=""
				aria-hidden
				draggable={false}
				className="mx-auto mb-3 mt-auto h-5 opacity-20"
			/>
		</div>
	)
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: only drops focus after pointer presses; keys need nothing
		<section
			data-remote
			data-phone-remote={form}
			aria-label="Remote control"
			className={`pointer-events-auto absolute select-none ${at ? "" : "tvr-f-premote"}`}
			style={at && { left: at.left, top: at.top, width: at.width }}
			// As on the desktop Remote: a press by a finger or the pointer must not leave the key focused, or the
			// next Enter of a keyboard repeats it instead of reaching the TV's focused item, and a streaming key
			// pressed again would close the screen it just opened. Keyboard presses (detail 0) keep their focus.
			onClick={(e) => {
				if (e.detail === 0) return
				const button = (e.target as HTMLElement).closest("button")
				if (button === document.activeElement) button?.blur()
			}}
		>
			<div
				className={`origin-top-left ${at ? "" : "tvr-f-pscale"}`}
				style={{ width: R.w, ...(at && { transform: `scale(${at.u})` }) }}
			>
				{body}
			</div>
		</section>
	)
}
