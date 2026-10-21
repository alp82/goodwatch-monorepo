// PROTOTYPE - throwaway. The sort menu's way in to Best match for visitors, as a row shaped like the other sorts.
// Three variants, switched with ?variant= on /discover:
//   1  Badge: the plain row, with an amber "Sign up free" tag where the check goes.
//   2  Amber row: the row tinted amber, the fingerprint where the check goes.
//   3  Tag and link: "Best match" with a small "Free" tag, its hint, and an amber sign-up line under it.
import { ChevronRightIcon } from "@heroicons/react/20/solid"
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link, useSearchParams } from "@remix-run/react"
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher"
import { useAuthHref } from "~/utils/auth-href"

export const SORT_ROW_VARIANTS = {
	"1": "Badge",
	"2": "Amber row",
	"3": "Tag and link",
} as const
type RowVariant = keyof typeof SORT_ROW_VARIANTS

export function SortRowSwitcher() {
	return <PrototypeSwitcher variants={SORT_ROW_VARIANTS} />
}

// The same box as a sort item in SortItems: rounded-xl, px-3, py-2.5, bold 14 px label, 12 px hint.
const ROW =
	"relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400"

export function BestMatchSignUpRow() {
	const [params] = useSearchParams()
	const v = params.get("variant")
	const variant: RowVariant = v && v in SORT_ROW_VARIANTS ? (v as RowVariant) : "1"
	const authHref = useAuthHref()
	const to = authHref("sign-up")

	if (variant === "2")
		return (
			<Link
				to={to}
				rel="nofollow"
				role="menuitem"
				className={`${ROW} group mb-1 bg-amber-500/[0.07] hover:bg-amber-500/[0.12]`}
			>
				<span className="min-w-0 flex-1">
					<span className="block text-sm font-bold text-amber-100">
						Best match
					</span>
					<span className="block text-xs text-amber-200/60">
						Sign up free to order by your taste
					</span>
				</span>
				<FingerPrintIcon className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
			</Link>
		)

	if (variant === "3")
		return (
			<Link
				to={to}
				rel="nofollow"
				role="menuitem"
				className={`${ROW} group hover:bg-white/5`}
			>
				<span className="min-w-0 flex-1">
					<span className="flex items-center gap-1.5 text-sm font-bold text-gray-300">
						Best match
						<span className="rounded-md bg-amber-500/15 px-1.5 py-px text-[10px] font-bold text-amber-300">
							Free
						</span>
					</span>
					<span className="block text-xs text-gray-500">
						Closest to your taste
					</span>
					<span className="mt-1 flex items-center gap-0.5 text-xs font-semibold text-amber-400 group-hover:text-amber-300">
						Sign up to turn it on
						<ChevronRightIcon className="h-3.5 w-3.5" aria-hidden />
					</span>
				</span>
			</Link>
		)

	return (
		<Link
			to={to}
			rel="nofollow"
			role="menuitem"
			className={`${ROW} group hover:bg-white/5`}
		>
			<span className="min-w-0 flex-1">
				<span className="block text-sm font-bold text-gray-300 group-hover:text-white">
					Best match
				</span>
				<span className="block text-xs text-gray-500">
					Closest to your taste
				</span>
			</span>
			<span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-bold text-amber-300 ring-1 ring-inset ring-amber-500/30 group-hover:bg-amber-500/25">
				Sign up free
			</span>
		</Link>
	)
}
