// The menu: an overlay on every screen, at the picture's right edge. What it lists is the machine's (`menuItems`):
// Home, Search, Sign in for a guest, What is GoodWatch?, Turn off. The phone's Remote has no power key, so Turn off
// is here for everyone. A chunk the TV asks for at the first interaction (screen-code.tsx).
import { Item, usePhone } from "../kit"

const LABEL: Record<string, string> = {
	"menu:home": "Home",
	"menu:search": "Search",
	"menu:sign-in": "Sign in",
	"menu:about": "What is GoodWatch?",
	"menu:off": "Turn off",
}

export default function Menu({ items }: { items: readonly string[] }) {
	const P = usePhone()
	return (
		<div
			role="menu"
			aria-label="Menu"
			className={`absolute inset-y-0 right-0 flex flex-col justify-center bg-[#0b0c11]/95 ${P ? "w-[78%] gap-2 px-5" : "w-[440px] gap-4 px-10"}`}
		>
			<div
				className={`font-bold uppercase tracking-[0.2em] text-white/60 ${P ? "text-[20px]" : "mb-2 text-[22px]"}`}
			>
				Menu
			</div>
			{items.map((id) => (
				<Item
					key={id}
					id={id}
					className={`tvc-btn flex shrink-0 items-center ${P ? "h-[48px] px-6 text-[21px]" : "h-[76px] px-9 text-[30px]"}`}
				>
					{LABEL[id] ?? id}
				</Item>
			))}
		</div>
	)
}
