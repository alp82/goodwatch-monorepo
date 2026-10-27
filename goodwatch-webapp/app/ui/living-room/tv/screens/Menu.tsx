// The menu: an overlay on every screen, at the picture's right edge, under the GoodWatch wordmark. It lists the TV's
// own screens and nothing else (the machine's `menuItems`): Start, Watch next, Popular, Discover, Search, Rate
// titles, Your taste and What is GoodWatch?. At a milestone of Rate titles, Your taste lights amber and says so
// ("Your taste is ready", "Your picks changed"), as the taste key on the desktop's Rate titles does. The pages of the site open from the screen they belong to, with its Expand key.
// The screen on show is marked, and the menu opens on it. A chunk the TV asks for at the first interaction
// (screen-code.tsx).
//
// On the phone the menu covers the picture, its keys three to a row, every key a touch target of 44 px or more on
// the phone's screen (`keySize` in kit.tsx). Nothing scrolls.
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { Item, PHONE_FOOT, PHONE_HEAD, PHONE_SIDE, keySize, phoneSpan, useTvView } from "../kit"

const LABEL: Record<string, string> = {
	"menu:tonight": "Watch next",
	"menu:popular": "Popular",
	"menu:discover": "Discover",
	"menu:search": "Search",
	"menu:quiz": "Rate titles",
	"menu:taste": "Your taste",
	"menu:shows": "My shows",
	"menu:about": "What is GoodWatch?",
}

/** Each key's icon, a 24 px path. */
const ICON: Record<string, string> = {
	"menu:home": "M12 3 2 12h3v8h6v-6h2v6h6v-8h3L12 3Z",
	"menu:tonight": "M6 3h12a1 1 0 0 1 1 1v17l-7-4.5L5 21V4a1 1 0 0 1 1-1Z",
	"menu:popular":
		"M13.5 1s1 3-1 6-5 4.5-5 9a6.5 6.5 0 0 0 13 0c0-4-2.5-6-3-8 0 0-1 2-2.5 2.5C16 7 13.5 1 13.5 1Z",
	"menu:discover": "M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z",
	"menu:search":
		"M10.5 3a7.5 7.5 0 0 1 5.96 12.06l4.24 4.24-1.4 1.4-4.24-4.24A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z",
	"menu:quiz":
		"M12 21.35 10.55 20C5.4 15.36 2 12.27 2 8.5A5.5 5.5 0 0 1 12 5.09 5.5 5.5 0 0 1 22 8.5c0 3.77-3.4 6.86-8.55 11.54L12 21.35Z",
	"menu:taste": "M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2Z",
	"menu:shows":
		"M21 6h-7.6l3.3-3.3-.7-.7L12 6 8 2l-.7.7L10.6 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm0 13H3V8h18v11Z",
	"menu:about":
		"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 15h-2v-6h2v6Zm0-8h-2V7h2v2Z",
}

export default function Menu({ items }: { items: readonly string[] }) {
	const { canvas } = useTvView()
	return canvas.edition === "phone" ? <PhoneMenu items={items} /> : <TvMenu items={items} />
}

/**
 * The phone's menu (nothing scrolls): over the whole picture, every TV screen three to a row under a band with the
 * wordmark and Close. The band takes no item: a press there reaches the shade under the menu, which closes it, as
 * Back does. Each key's words may take two lines, so none is cut.
 */
function PhoneMenu({ items }: { items: readonly string[] }) {
	const { canvas, here, member, tasteLit } = useTvView()
	const key = keySize(canvas, 54)
	// Three to a row upright, four on a phone's wide canvas.
	const cols = phoneSpan(canvas) >= 600 ? 4 : 3
	const rows = Math.ceil(items.length / cols)
	// The band gives way where a narrow phone's keys are taller: the rows always fit the picture.
	const band = Math.min(PHONE_HEAD, canvas.h - PHONE_FOOT - rows * key - (rows - 1) * 6)
	return (
		<div
			role="menu"
			aria-label="Menu"
			className="pointer-events-none absolute inset-0 flex flex-col bg-[#0b0c11]/95"
			style={{ paddingLeft: PHONE_SIDE, paddingRight: PHONE_SIDE, paddingBottom: PHONE_FOOT }}
		>
			<div aria-hidden className="flex shrink-0 items-center justify-between" style={{ height: band }}>
				<GoodWatchWordmark fontSize={22} />
				<span className="flex items-center gap-2 text-[18px] font-bold text-white/75">
					Close
					<svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				</span>
			</div>
			<div
				className="pointer-events-auto grid min-h-0 flex-1 gap-[6px]"
				style={{
					gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
					gridTemplateRows: `repeat(${rows}, ${key}px)`,
				}}
			>
				{items.map((id) => {
					const on = here === id
					return (
						<Item
							key={id}
							id={id}
							role="menuitem"
							label={on ? `${label(id, member, tasteLit)}, showing now` : undefined}
							className={`tvc-btn tvc-menu-key flex h-full min-w-0 items-center gap-2 px-3 text-[17px] leading-[1.1] ${on ? "tvc-here" : ""} ${lights(id, tasteLit)}`}
						>
							<svg
								viewBox="0 0 24 24"
								aria-hidden="true"
								className={`h-[20px] w-[20px] shrink-0 ${on ? "text-amber-400" : "opacity-70"}`}
							>
								<path d={ICON[id]} fill="currentColor" />
							</svg>
							<span className="min-w-0 flex-1">{label(id, member, tasteLit)}</span>
						</Item>
					)
				})}
			</div>
		</div>
	)
}

function TvMenu({ items }: { items: readonly string[] }) {
	const { here, member, tasteLit } = useTvView()
	return (
		<div
			role="menu"
			aria-label="Menu"
			className="absolute inset-y-0 right-0 flex flex-col bg-[#0b0c11]/95 w-[440px] justify-center gap-1.5 border-l border-white/10 px-9"
		>
			<GoodWatchWordmark fontSize={30} className="mb-2" />
			<div className="grid gap-1.5">
				{items.map((id) => {
					const on = here === id
					return (
						<Item
							key={id}
							id={id}
							role="menuitem"
							label={on ? `${label(id, member, tasteLit)}, showing now` : undefined}
							className={`tvc-btn tvc-menu-key flex min-w-0 shrink-0 items-center ${on ? "tvc-here" : ""} ${lights(id, tasteLit)} h-[54px] gap-4 px-6 text-[23px]`}
						>
							<svg
								viewBox="0 0 24 24"
								aria-hidden="true"
								className={`h-[24px] w-[24px] shrink-0 ${on ? "text-amber-400" : "opacity-70"}`}
							>
								<path d={ICON[id]} fill="currentColor" />
							</svg>
							<span className="min-w-0 flex-1 truncate">{label(id, member, tasteLit)}</span>
							{on && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />}
						</Item>
					)
				})}
			</div>
		</div>
	)
}

/** A member's home is Start; a guest's is Home. Your taste at a milestone says so. */
const label = (id: string, member?: boolean, tasteLit?: string | null) =>
	id === "menu:home"
		? member
			? "Start"
			: "Home"
		: id === "menu:taste" && tasteLit
			? tasteLit
			: (LABEL[id] ?? id)

/** Your taste at a milestone is amber, as the taste key on the desktop's Rate titles is. */
const lights = (id: string, tasteLit?: string | null) =>
	id === "menu:taste" && tasteLit ? "tvc-cta score-ack-enter" : ""
