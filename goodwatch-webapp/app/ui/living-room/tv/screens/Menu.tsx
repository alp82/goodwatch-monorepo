// The menu: an overlay on every screen, at the picture's right edge, under the GoodWatch wordmark. It lists the TV's
// own screens and nothing else (the machine's `menuItems`): Start, Watch next, Popular, Discover, Search, Taste,
// Your taste and What is GoodWatch?. The pages of the site open from the screen they belong to, with its Expand key.
// The screen on show is marked, and the menu opens on it. A chunk the TV asks for at the first interaction
// (screen-code.tsx).
//
// On the phone the menu covers the picture, its keys two to a row, every key a touch target of 44 px or more on
// the phone's screen (`keySize` in kit.tsx): up to 67 canvas px each on the narrowest phone. The wordmark is there
// only where it has room (`menuLayout`).
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"
import { Item, keySize, useTvView } from "../kit"
import type { TvCanvas } from "../room-tv"

const LABEL: Record<string, string> = {
	"menu:tonight": "Watch next",
	"menu:popular": "Popular",
	"menu:discover": "Discover",
	"menu:search": "Search",
	"menu:quiz": "Taste",
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

/** The wordmark over the keys on the phone, with the space under it, and the least the column keeps free at each end. */
const HEAD = 44
const EDGE = 6

/**
 * The phone's menu: how tall a key is, the gap between two rows of keys, and whether the wordmark stands over them.
 * The keys keep their height on every phone. The wordmark goes first when the picture is too short for all of it,
 * then the gaps narrow from 8 to no less than 4.
 */
export function menuLayout(
	canvas: TvCanvas,
	count: number,
): { key: number; gap: number; head: boolean } {
	const key = keySize(canvas, 48)
	const rows = Math.ceil(count / 2)
	const gaps = Math.max(1, rows - 1)
	const room = canvas.h - 2 * EDGE - rows * key
	const head = room >= HEAD + gaps * 8
	const gap = Math.max(4, Math.min(8, Math.floor(room / gaps)))
	return { key, gap: head ? 8 : gap, head }
}

export default function Menu({ items }: { items: readonly string[] }) {
	const { canvas, here, member } = useTvView()
	const P = canvas.edition === "phone"
	const phone = menuLayout(canvas, items.length)
	return (
		<div
			role="menu"
			aria-label="Menu"
			// On the phone it scrolls when a short picture can't hold its keys (living-room.css), centred while it fits:
			// the auto margins of the column inside, not justify-center, so its top stays in reach.
			{...(P ? { "data-tv-scroll": "" } : {})}
			className={`absolute inset-y-0 right-0 flex flex-col bg-[#0b0c11]/95 ${P ? "w-full px-5" : "w-[440px] justify-center gap-1.5 border-l border-white/10 px-9"}`}
		>
			<div className={P ? "my-auto flex flex-col py-1.5" : "contents"} style={P ? { gap: phone.gap } : undefined}>
			{(!P || phone.head) && (
				<GoodWatchWordmark
					fontSize={P ? 24 : 30}
					className={P ? "mb-1" : "mb-2"}
				/>
			)}
			<div className={P ? "grid grid-cols-2" : "grid gap-1.5"} style={P ? { gap: phone.gap } : undefined}>
				{items.map((id) => {
					const on = here === id
					return (
						<Item
							key={id}
							id={id}
							role="menuitem"
							label={on ? `${label(id, member)}, showing now` : undefined}
							className={`tvc-btn tvc-menu-key flex min-w-0 shrink-0 items-center ${on ? "tvc-here" : ""} ${P ? "gap-2.5 px-4 text-[19px]" : "h-[54px] gap-4 px-6 text-[23px]"}`}
							style={P ? { height: phone.key } : undefined}
						>
							<svg
								viewBox="0 0 24 24"
								aria-hidden="true"
								className={`shrink-0 ${P ? "h-[22px] w-[22px]" : "h-[24px] w-[24px]"} ${on ? "text-amber-400" : "opacity-70"}`}
							>
								<path d={ICON[id]} fill="currentColor" />
							</svg>
							<span className="min-w-0 flex-1 truncate">{label(id, member)}</span>
							{on && (
								<span
									aria-hidden
									className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400"
								/>
							)}
						</Item>
					)
				})}
			</div>
			</div>
		</div>
	)
}

/** A member's home is Start; a guest's is Home. */
const label = (id: string, member?: boolean) =>
	id === "menu:home" ? (member ? "Start" : "Home") : (LABEL[id] ?? id)
