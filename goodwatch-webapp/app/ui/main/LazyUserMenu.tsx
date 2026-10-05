// The member's account menu without its code in every page's first load: only members have it, and it brings the
// dialog library (40 KB compressed). Until the code is there, the avatar shows as it does in the menu's button.
import { UserCircleIcon } from "@heroicons/react/24/solid"
import type { User } from "@supabase/auth-js"
import { Suspense, lazy } from "react"
import { reloadOnStaleChunk } from "~/utils/stale-chunk"

const UserMenu = lazy(
	reloadOnStaleChunk(() =>
		import("~/ui/main/UserMenu").then((module) => ({
			default: module.UserMenu,
		})),
	),
)

// Keep the classes in step with the button in UserMenu.tsx, so nothing moves when the menu takes over.
function Avatar({ user }: { user: User }) {
	return (
		<div className="relative ml-2 shrink-0">
			<span className="flex rounded-full bg-gray-800 text-sm text-white">
				{user?.user_metadata?.avatar_url ? (
					<img
						className="h-8 w-8 rounded-[16px] brightness-75"
						src={user?.user_metadata?.avatar_url}
						alt={user?.user_metadata?.name}
					/>
				) : (
					<UserCircleIcon className="h-8 w-8 rounded-[16px] brightness-75" />
				)}
			</span>
		</div>
	)
}

export function LazyUserMenu({ user }: { user: User }) {
	return (
		<Suspense fallback={<Avatar user={user} />}>
			<UserMenu user={user} />
		</Suspense>
	)
}
