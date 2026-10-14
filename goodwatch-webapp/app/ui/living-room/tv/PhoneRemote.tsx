// The phone's Remote. The Remote in the hand is 866 units long and does not fit under a TV on a phone, so the
// phone gets a shorter one. It is the same object: the desktop Remote's dark body, its wheel with OK, its round
// keys with their icons and words, its streaming keys (the `remote-*` classes of living-room.css). Every key is
// 44 px or more in both directions.
//
// The two streaming keys stand for the person's own two services (`services`): each shows its service's mark,
// opens the TV screen "On <service>", and is pressed while that screen shows.
//
// Two forms; the scene's height chooses (`layoutPhoneRoom`):
//   hand    upright, held in the hand, rising from the bottom edge: the wheel with a round key in each of its
//           corners (Search, Menu, Back, Home), the streaming keys under it, then the grip and the fingers
//   table   lying in front of the TV: a wide, short body, the wheel in the middle and three keys on either side
// Neither has the power key: "Turn off" is in the TV's menu, and a dark TV turns on with any key here.
import type { ReactNode } from "react"
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
const WORD =
	"pointer-events-none whitespace-nowrap text-[8px] font-semibold uppercase leading-[11px] tracking-[0.08em] text-white/60"

/**
 * How large a streaming key's print is in each form: a drawn mark's width against the desktop Remote's key (58
 * and 60 px in the hand, 50 and 52 on the table), and a catalog logo's side.
 */
const MARK: Record<PhoneRemoteForm, { drawn: number; logo: number }> = {
	hand: { drawn: 0.85, logo: 30 },
	table: { drawn: 0.735, logo: 30 },
}

export type PhoneRemoteProps = {
	tv: RoomTv
	/** The person's own two services, in the keys' order. */
	services: readonly RemoteService[]
	form: PhoneRemoteForm
	/** Its box in the scene, at its scale `u` (`layoutPhoneRoom`). */
	at: { left: number; top: number; u: number; width: number }
	/** The scene's height: held, the body runs on under the scene's bottom edge, into the hand. */
	bottom: number
}

export function PhoneRemote({
	tv,
	services,
	form,
	at,
	bottom,
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
	let body: ReactNode
	if (form === "hand") {
		// A key in each corner of the wheel's square: the wheel is round, so the corners are free.
		const corner = (
			key: ReactNode,
			word: string,
			where: string,
			wordAt: string,
		) => (
			<>
				<div className={`absolute ${where}`}>{key}</div>
				<span className={`absolute ${WORD} ${wordAt}`}>{word}</span>
			</>
		)
		body = (
			// The body runs on under the scene's edge, into the hand: only its top is rounded in view.
			<div
				className="remote-body relative"
				style={{
					width: R.w,
					height: (bottom - at.top) / at.u + 60,
					borderRadius: 34,
					padding: 10,
				}}
			>
				<div
					className="relative flex items-center justify-center"
					style={{ height: WHEEL }}
				>
					{wheel}
					{corner(keys.search, "Search", "left-0 top-0", "left-0 top-[46px]")}
					{corner(keys.menu, "Menu", "right-0 top-0", "right-0 top-[46px]")}
					{corner(keys.back, "Back", "bottom-0 left-0", "bottom-[46px] left-0")}
					{corner(
						keys.home,
						"Home",
						"bottom-0 right-0",
						"bottom-[46px] right-0",
					)}
				</div>
				<div className="mt-2 grid grid-cols-2 gap-2">
					{first}
					{second}
				</div>
			</div>
		)
	} else {
		const column = (
			a: ReactNode,
			wordA: string,
			b: ReactNode,
			wordB: string,
			c: ReactNode,
		) => (
			<div className="flex w-[72px] shrink-0 flex-col items-center">
				{a}
				<span className={WORD}>{wordA}</span>
				{b}
				<span className={WORD}>{wordB}</span>
				{c}
			</div>
		)
		body = (
			<div
				className="remote-body flex items-center justify-between"
				style={{ width: R.w, height: R.keys, borderRadius: 40, padding: 10 }}
			>
				{column(keys.back, "Back", keys.search, "Search", first)}
				{wheel}
				{column(keys.home, "Home", keys.menu, "Menu", second)}
			</div>
		)
	}
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: only drops focus after pointer presses; keys need nothing
		<section
			data-remote
			data-phone-remote={form}
			aria-label="Remote control"
			className="absolute select-none"
			style={{ left: at.left, top: at.top, width: at.width }}
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
				className="origin-top-left"
				style={{ width: R.w, transform: `scale(${at.u})` }}
			>
				{body}
			</div>
		</section>
	)
}
