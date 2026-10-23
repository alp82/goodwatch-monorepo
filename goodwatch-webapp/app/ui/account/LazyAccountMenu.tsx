// The account menu without its code in every page's first load: only members have it. Until the code is there, the
// avatar shows as the menu's button draws it.
import type { User } from "@supabase/auth-js"
import { Suspense, lazy } from "react"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const AccountMenu = lazy(
	reloadOnStaleChunk(() =>
		import("~/ui/account/AccountMenu").then((module) => ({
			default: module.AccountMenu,
		})),
	),
)

// Keep in step with the button in AccountMenu.tsx, so nothing moves when the menu takes over.
function Placeholder({ user }: { user: User }) {
	const url = user.user_metadata?.avatar_url as string | undefined
	return (
		<div className="relative ml-2 shrink-0">
			{url ? (
				<img src={url} alt="" className="h-8 w-8 rounded-full object-cover" />
			) : (
				<span className="block h-8 w-8 rounded-full bg-gray-800" />
			)}
		</div>
	)
}

export function LazyAccountMenu({
	user,
	compact,
}: { user: User; compact?: boolean }) {
	return (
		<Suspense fallback={<Placeholder user={user} />}>
			<AccountMenu compact={compact} />
		</Suspense>
	)
}
