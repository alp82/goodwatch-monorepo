// PROTOTYPE - throwaway. The phone's Remote. The Remote in the hand is 866 units long and does not fit under a TV
// on a phone, so the phone gets its own: short and as wide as the screen, the wheel in the middle and the keys in a
// column on either side. Every key is 44 px or more in both directions. It sends what the Remote's keys send.
//
// Two arrangements, for the owner to choose:
//   all   Back, Home, Netflix | wheel | Search, Menu, Prime Video
//   few   Back, Netflix | wheel | Home, Prime Video: fewer, taller keys. Search and Menu are left to the TV's own
//         top bar, which has them on every screen.
// Neither has the power key: "Turn off" is in the Menu, and a dark set turns on with any key here.
import type { ReactNode } from "react"
import netflixMark from "~/img/netflix-logo.svg"
import primeMark from "~/img/primevideo-logo.svg"
import { ICON, Icon } from "~/ui/living-room/Remote"
import type { Tv } from "~/ui/prototype-tv-flow/engine"
import { assetUrl } from "~/utils/asset-url"

export const PHONE_REMOTES = { all: "All keys", few: "Few keys" } as const
export type PhoneRemoteKey = keyof typeof PHONE_REMOTES

/** The shortest the phone's Remote can be with three keys of 52 px in a column. */
export const PHONE_REMOTE_MIN = 192

const MENU_ICON = "M4 7h16M4 12h16M4 17h16"
const ARROW = { up: "M6 15l6-6 6 6", down: "M6 9l6 6 6-6", left: "M15 6l-6 6 6 6", right: "M9 6l6 6-6 6" } as const
const ARROW_LABEL = { up: "Up", down: "Down", left: "Previous", right: "Next" } as const
const ARROW_AT = { up: "left-1/2 top-1 -translate-x-1/2", down: "bottom-1 left-1/2 -translate-x-1/2", left: "left-1 top-1/2 -translate-y-1/2", right: "right-1 top-1/2 -translate-y-1/2" } as const

const KEY = "flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-b from-[#3a3d45] to-[#24262c] text-[14px] font-semibold text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_2px_0_rgba(0,0,0,.6)] active:translate-y-px active:from-[#2c2f36]"

export function PhoneRemote({ tv, arrangement, top, height, width }: { tv: Tv; arrangement: PhoneRemoteKey; top: number; height: number; width: number }) {
	// A dark set: the first key only turns it on.
	const press = (run: () => void) => () => (tv.store.power === "off" ? tv.power(true) : run())
	const key = (label: string, d: string, run: () => void) => (
		<button key={label} type="button" onClick={press(run)} className={KEY}>
			<Icon d={d} className="h-[18px] w-[18px] shrink-0" />
			{label}
		</button>
	)
	const service = (name: string, mark: string, ink: string) => {
		const src = `url("${assetUrl(mark)}") center / contain no-repeat`
		return (
			<button key={name} type="button" aria-label={`Only ${name}`} aria-pressed={tv.store.service === name} onClick={press(() => tv.service(name))} className={`${KEY} aria-pressed:shadow-[inset_0_-3px_0_#fdba74,inset_0_1px_0_rgba(255,255,255,.14)]`}>
				<span aria-hidden className="block h-[20px] w-[58px]" style={{ background: ink, WebkitMask: src, mask: src }} />
			</button>
		)
	}
	const back = key("Back", ICON.back, tv.back)
	const home = key("Home", ICON.home, tv.home)
	const netflix = service("Netflix", netflixMark, "#e50914")
	const prime = service("Prime Video", primeMark, "#ffffff")
	const columns: [ReactNode[], ReactNode[]] = arrangement === "few" ? [[back, netflix], [home, prime]] : [[back, home, netflix], [key("Search", ICON.search, tv.openSearch), key("Menu", MENU_ICON, tv.toggleMenu), prime]]
	// The wheel takes the height, but never so much of the width that a key beside it is narrower than its word.
	const pad = Math.min(height - 20, 208, width * 0.46)
	return (
		<section data-remote data-phone-remote={arrangement} aria-label="Remote control" className="absolute inset-x-0 flex select-none items-stretch gap-2 rounded-t-[26px] bg-gradient-to-b from-[#2a2c33] to-[#17181c] px-3 py-[10px] shadow-[inset_0_1px_0_rgba(255,255,255,.12)]" style={{ top, height }}>
			<div className="flex min-w-0 flex-1 flex-col gap-2">{columns[0]}</div>
			<div className="relative shrink-0 self-center rounded-full bg-[#101114] shadow-[inset_0_2px_6px_rgba(0,0,0,.8),0_1px_0_rgba(255,255,255,.08)]" style={{ width: pad, height: pad }}>
				{(Object.keys(ARROW) as (keyof typeof ARROW)[]).map((dir) => (
					<button key={dir} type="button" aria-label={ARROW_LABEL[dir]} onClick={press(() => tv.move(dir))} className={`absolute flex h-[48px] w-[48px] items-center justify-center rounded-full text-white/70 active:scale-90 active:text-white ${ARROW_AT[dir]}`}>
						<svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
							<path d={ARROW[dir]} />
						</svg>
					</button>
				))}
				<button type="button" onClick={press(tv.ok)} className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-b from-[#3a3d45] to-[#24262c] text-[16px] font-bold tracking-wider text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,.14),0_2px_0_rgba(0,0,0,.6)] active:scale-95" style={{ width: pad * 0.4, height: pad * 0.4 }}>
					OK
				</button>
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-2">{columns[1]}</div>
		</section>
	)
}
