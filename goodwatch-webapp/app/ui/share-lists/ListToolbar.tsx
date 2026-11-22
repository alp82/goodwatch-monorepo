import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { Link } from "@remix-run/react"

/**
 * The Profile tab row's height, as a CSS variable for the offsets under the sticky rows (the h-16 header, the visitor
 * bar's --visitor-bar-h, then this row). The values are TAB_ROW_PX.one in ui/navigation/AreaTabs.tsx, written out
 * because Tailwind only sees literal class names.
 */
export const TAB_ROW_H = "[--tab-row-h:45px] lg:[--tab-row-h:49px]"

/** The toolbar's Lists key: back to the lists. */
export function BackToLists({ href }: { href: string }) {
	return (
		<Link
			to={href}
			prefetch="intent"
			className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 py-2.5 pr-4 pl-3 font-bold text-white transition hover:bg-white/15"
		>
			<ChevronLeftIcon className="size-5" aria-hidden />
			Lists
		</Link>
	)
}
