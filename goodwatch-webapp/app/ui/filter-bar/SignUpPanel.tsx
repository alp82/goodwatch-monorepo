// The sign-up entry in Discover's Best match sort menu.
import { FingerPrintIcon } from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import { useAuthHref } from "~/utils/auth-href"

/**
 * Best match for a visitor, in the sort menu: the same box as a sort item (SortItems), tinted amber, with the
 * fingerprint where the check goes. `dense` matches the phone menu's tighter rows.
 */
export function BestMatchSignUp({ dense = false }: { dense?: boolean }) {
	const authHref = useAuthHref()
	return (
		<Link
			to={authHref("sign-up")}
			rel="nofollow"
			role="menuitem"
			className={`mb-1 flex items-center gap-3 rounded-xl bg-amber-500/[0.07] px-3 ${dense ? "py-2" : "py-2.5"} text-left outline-none transition-colors cursor-pointer hover:bg-amber-500/[0.12] focus-visible:ring-2 focus-visible:ring-amber-400`}
		>
			<span className="min-w-0 flex-1">
				<span className="block text-sm font-bold text-amber-100">
					Best match
				</span>
				<span className="block text-xs text-amber-200/60">
					Sign up free to order by your taste
				</span>
			</span>
			<FingerPrintIcon
				className="h-5 w-5 shrink-0 text-amber-500"
				aria-hidden
			/>
		</Link>
	)
}
