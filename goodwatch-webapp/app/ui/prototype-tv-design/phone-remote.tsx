// PROTOTYPE - throwaway. The phone's Remote. The Remote in the hand is 866 units long and does not fit under a TV
// on a phone, so the phone gets a shorter one. It is the same object: the desktop Remote's dark body, its wheel
// with OK, its round keys with their icons and words, its streaming keys (the classes of living-room.css).
// Every key is 44 px or more in both directions. It sends what the Remote's keys send.
//
// Two forms, for the owner to choose (K, `&form=table`):
//   hand    upright, held in the hand, rising from the bottom edge: the wheel with a round key in each of its
//           corners (Search, Menu, Back, Home), the streaming keys under it, then the grip and the fingers
//   table   lying in front of the TV: a wide, short body, the wheel in the middle and three keys on either side
// Neither has the power key: "Turn off" is in the Menu, and a dark set turns on with any key here.
import type { ReactNode } from "react"
import netflixMark from "~/img/netflix-logo.svg"
import primeMark from "~/img/primevideo-logo.svg"
import { ICON, Icon } from "~/ui/living-room/Remote"
import type { Tv } from "~/ui/prototype-tv-flow/engine"
import { assetUrl } from "~/utils/asset-url"

export const PHONE_REMOTES = { hand: "In the hand", table: "On the table" } as const
export type PhoneRemoteKey = keyof typeof PHONE_REMOTES

/**
 * Each form at its smallest, where a key is 44 px: its width, how far down its keys end, how much it may grow, the
 * share of the phone's width it may take, and (held) where the fingers come round it.
 */
export const PHONE_REMOTE: Record<PhoneRemoteKey, { w: number; keys: number; grow: number; share: number; fingers: number }> = {
	hand: { w: 236, keys: 222, grow: 1.3, share: 0.68, fingers: 168 },
	table: { w: 336, keys: 176, grow: 1.25, share: 0.935, fingers: 0 },
}

const WHEEL = 156
const KEY = 44
const MENU_ICON = "M4 7h16M4 12h16M4 17h16"
const ARROW = { up: "M6 15l6-6 6 6", down: "M6 9l6 6 6-6", left: "M15 6l-6 6 6 6", right: "M9 6l6 6-6 6" } as const
const ARROW_LABEL = { up: "Up", down: "Down", left: "Previous", right: "Next" } as const
const ARROW_AT = { up: "left-1/2 top-[3px] -translate-x-1/2", down: "bottom-[3px] left-1/2 -translate-x-1/2", left: "left-[3px] top-1/2 -translate-y-1/2", right: "right-[3px] top-1/2 -translate-y-1/2" } as const
const WORD = "pointer-events-none whitespace-nowrap text-[8px] font-semibold uppercase leading-[11px] tracking-[0.08em] text-white/60"

type Layout = { left: number; top: number; u: number; width: number }

export function PhoneRemote({ tv, form, at, bottom }: { tv: Tv; form: PhoneRemoteKey; at: Layout; bottom: number }) {
	// A dark set: the first key only turns it on.
	const press = (run: () => void) => () => (tv.store.power === "off" ? tv.power(true) : run())
	const round = (label: string, d: string, run: () => void, pressed?: boolean) => (
		<button type="button" aria-label={label} aria-pressed={pressed} onClick={press(run)} className="remote-key flex shrink-0 items-center justify-center rounded-full" style={{ width: KEY, height: KEY }}>
			<Icon d={d} className="h-[19px] w-[19px]" />
		</button>
	)
	const service = (name: string, mark: string, ink: string, logo: number) => {
		const src = `url("${assetUrl(mark)}") center / contain no-repeat`
		return (
			<button type="button" aria-label={`Only ${name}`} aria-pressed={tv.store.service === name} onClick={press(() => tv.service(name))} className="remote-key remote-service flex w-full items-center justify-center rounded-full" style={{ height: KEY }}>
				<span aria-hidden className="block" style={{ width: logo, height: logo * 0.42, background: ink, WebkitMask: src, mask: src }} />
			</button>
		)
	}
	const keys = {
		back: round("Back", ICON.back, tv.back),
		home: round("Home", ICON.home, tv.home),
		search: round("Search", ICON.search, tv.openSearch, tv.top === "search"),
		menu: round("Menu", MENU_ICON, tv.toggleMenu, tv.top === "menu"),
	}
	const wheel = (
		<div className="remote-wheel relative shrink-0 rounded-full" style={{ width: WHEEL, height: WHEEL }}>
			<div className="remote-face pointer-events-none absolute inset-[10px] rounded-full" />
			{(Object.keys(ARROW) as (keyof typeof ARROW)[]).map((dir) => (
				<button key={dir} type="button" aria-label={ARROW_LABEL[dir]} onClick={press(() => tv.move(dir))} className={`remote-arrow absolute flex items-center justify-center rounded-full text-white/60 active:scale-90 active:text-white ${ARROW_AT[dir]}`} style={{ width: KEY, height: KEY }}>
					<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
						<path d={ARROW[dir]} />
					</svg>
				</button>
			))}
			<button type="button" onClick={press(tv.ok)} className="remote-ok absolute left-1/2 top-1/2 flex h-[40%] w-[40%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[13px] font-bold tracking-wider text-white/85 active:scale-95">
				OK
			</button>
		</div>
	)
	const netflix = (logo: number) => service("Netflix", netflixMark, "#e50914", logo)
	const prime = (logo: number) => service("Prime Video", primeMark, "#ffffff", logo)
	const R = PHONE_REMOTE[form]
	let body: ReactNode
	if (form === "hand") {
		// A key in each corner of the wheel's square: the wheel is round, so the corners are free.
		const corner = (key: ReactNode, word: string, where: string, wordAt: string) => (
			<>
				<div className={`absolute ${where}`}>{key}</div>
				<span className={`absolute ${WORD} ${wordAt}`}>{word}</span>
			</>
		)
		body = (
			// The body runs on under the window's edge, into the hand: only its top is rounded in view.
			<div className="remote-body relative" style={{ width: R.w, height: (bottom - at.top) / at.u + 60, borderRadius: 34, padding: 10 }}>
				<div className="relative flex items-center justify-center" style={{ height: WHEEL }}>
					{wheel}
					{corner(keys.search, "Search", "left-0 top-0", "left-0 top-[46px]")}
					{corner(keys.menu, "Menu", "right-0 top-0", "right-0 top-[46px]")}
					{corner(keys.back, "Back", "bottom-0 left-0", "bottom-[46px] left-0")}
					{corner(keys.home, "Home", "bottom-0 right-0", "bottom-[46px] right-0")}
				</div>
				<div className="mt-2 grid grid-cols-2 gap-2">
					{netflix(58)}
					{prime(60)}
				</div>
			</div>
		)
	} else {
		const column = (a: ReactNode, wordA: string, b: ReactNode, wordB: string, c: ReactNode) => (
			<div className="flex w-[72px] shrink-0 flex-col items-center">
				{a}
				<span className={WORD}>{wordA}</span>
				{b}
				<span className={WORD}>{wordB}</span>
				{c}
			</div>
		)
		body = (
			<div className="remote-body flex items-center justify-between" style={{ width: R.w, height: R.keys, borderRadius: 40, padding: 10 }}>
				{column(keys.back, "Back", keys.search, "Search", netflix(50))}
				{wheel}
				{column(keys.home, "Home", keys.menu, "Menu", prime(52))}
			</div>
		)
	}
	return (
		<section data-remote data-phone-remote={form} aria-label="Remote control" className="absolute select-none" style={{ left: at.left, top: at.top, width: at.width }}>
			<div className="origin-top-left" style={{ width: R.w, transform: `scale(${at.u})` }}>
				{body}
			</div>
		</section>
	)
}
