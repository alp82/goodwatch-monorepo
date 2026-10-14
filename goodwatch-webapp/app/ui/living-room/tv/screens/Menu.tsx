// The menu: an overlay on every screen, at the picture's right edge. What it lists is the machine's (`menuItems`):
// Home, Search, Sign in for a guest, What is GoodWatch?, Turn off. The phone's Remote has no power key, so Turn off
// is here for everyone. A chunk the TV asks for at the first interaction (screen-code.tsx).
//
// On the phone every key is a touch target, 44 px or more on the phone's screen (`keySize` in kit.tsx): up to 67
// canvas px each on the narrowest phone. Five of them fill a short phone's picture, so the word "Menu" over them
// is there only where it has room (`menuLayout`), and the gaps between the keys are narrower where it has none.
import { Item, keySize, useTvView } from "../kit"
import type { TvCanvas } from "../room-tv"

const LABEL: Record<string, string> = {
	"menu:home": "Home",
	"menu:search": "Search",
	"menu:sign-in": "Sign in",
	"menu:about": "What is GoodWatch?",
	"menu:off": "Turn off",
}

/** The word "Menu" over the keys on the phone, with the space under it, and the least the column keeps free at each end. */
const HEAD = 30
const EDGE = 6

/**
 * The phone's menu: how tall a key is, the gap between two keys, and whether the word "Menu" stands over them.
 * The keys keep their height on every phone. The word goes first when the picture is too short for all of it,
 * then the gaps narrow from 8 to no less than 4.
 */
export function menuLayout(
	canvas: TvCanvas,
	count: number,
): { key: number; gap: number; head: boolean } {
	const key = keySize(canvas, 48)
	const gaps = Math.max(1, count - 1)
	const room = canvas.h - 2 * EDGE - count * key
	const head = room >= HEAD + gaps * 8
	const gap = Math.max(4, Math.min(8, Math.floor(room / gaps)))
	return { key, gap: head ? 8 : gap, head }
}

export default function Menu({ items }: { items: readonly string[] }) {
	const { canvas } = useTvView()
	const P = canvas.edition === "phone"
	const phone = menuLayout(canvas, items.length)
	return (
		<div
			role="menu"
			aria-label="Menu"
			className={`absolute inset-y-0 right-0 flex flex-col justify-center bg-[#0b0c11]/95 ${P ? "w-[78%] px-5" : "w-[440px] gap-4 px-10"}`}
			style={P ? { gap: phone.gap } : undefined}
		>
			{(!P || phone.head) && (
				<div
					className={`font-bold uppercase tracking-[0.2em] text-white/60 ${P ? "text-[20px] leading-[22px]" : "mb-2 text-[22px]"}`}
				>
					Menu
				</div>
			)}
			{items.map((id) => (
				<Item
					key={id}
					id={id}
					role="menuitem"
					className={`tvc-btn flex shrink-0 items-center ${P ? "px-6 text-[21px]" : "h-[76px] px-9 text-[30px]"}`}
					style={P ? { height: phone.key } : undefined}
				>
					{LABEL[id] ?? id}
				</Item>
			))}
		</div>
	)
}
