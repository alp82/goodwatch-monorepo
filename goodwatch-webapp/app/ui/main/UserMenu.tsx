import {
	Menu,
	MenuButton,
	MenuItem,
	MenuItems,
	Transition,
} from "@headlessui/react"
import { BookmarkIcon } from "@heroicons/react/20/solid"
import {
	Cog6ToothIcon,
	EyeIcon,
	QueueListIcon,
	UserCircleIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import type { User } from "@supabase/auth-js"
import { Fragment } from "react"
import { SignOutLink } from "~/ui/auth/SignOutLink"
import { myListsPath } from "~/ui/share-card/links"

// The signed-in member's avatar and account menu: Want to See, Already Watched, Lists, Settings, and Sign out.
export function UserMenu({ user }: { user: User }) {
	return (
		<Menu as="div" className="relative ml-2 shrink-0">
			<MenuButton className="flex rounded-full bg-gray-800 text-sm text-white focus:outline-hidden focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800 cursor-pointer">
				<span className="sr-only">Open user menu</span>
				{user?.user_metadata?.avatar_url ? (
					<img
						className="h-8 w-8 rounded-[16px] hover:rounded-lg brightness-75 hover:brightness-100 transition duration-200"
						src={user?.user_metadata?.avatar_url}
						alt={user?.user_metadata?.name}
						title={user?.user_metadata?.name}
					/>
				) : (
					<UserCircleIcon className="h-8 w-8 rounded-[16px] brightness-75 hover:brightness-100 transition duration-200" />
				)}
			</MenuButton>
			<Transition
				as={Fragment}
				enter="transition ease-out duration-100"
				enterFrom="transform opacity-0 scale-95"
				enterTo="transform opacity-100 scale-100"
				leave="transition ease-in duration-75"
				leaveFrom="transform opacity-100 scale-100"
				leaveTo="transform opacity-0 scale-95"
			>
				<MenuItems className="absolute right-0 z-50 mt-2 w-72 origin-top-right border-2 border-gray-800 rounded-md bg-gray-950 py-1 shadow-lg ring-1 ring-black/5 focus:outline-hidden">
					<MenuItem>
						{({ focus }) => (
							<Link
								to="/discover?type=all&watchedType=want-to-watch&streamingPreset=mine"
								prefetch="viewport"
								className={`flex gap-2 items-center px-4 py-2 text-base font-medium ${
									focus ? "bg-gray-700 text-white" : "text-amber-500"
								}`}
							>
								<BookmarkIcon className="w-5 h-5" />
								<span>
									What I <span className="font-extrabold">Want to See</span>
								</span>
							</Link>
						)}
					</MenuItem>
					<MenuItem>
						{({ focus }) => (
							<Link
								to="/discover?type=all&watchedType=watched"
								prefetch="viewport"
								className={`flex gap-2 items-center px-4 py-2 text-base font-medium ${
									focus ? "bg-gray-700 text-white" : "text-green-500"
								}`}
							>
								<EyeIcon className="w-5 h-5" />
								<span>
									What I <span className="font-extrabold">Already Watched</span>
								</span>
							</Link>
						)}
					</MenuItem>
					<MenuItem>
						{({ focus }) => (
							<Link
								to={myListsPath}
								className={`flex gap-2 items-center px-4 py-2 text-base font-medium ${
									focus ? "bg-gray-700 text-white" : "text-sky-400"
								}`}
							>
								<QueueListIcon className="w-5 h-5" />
								<span>
									My <span className="font-extrabold">Lists</span>
								</span>
							</Link>
						)}
					</MenuItem>
					<MenuItem>
						{({ focus }) => (
							<Link
								to="/settings/country"
								className={`w-full flex gap-2 items-center px-4 py-2 text-base font-medium ${
									focus ? "bg-gray-700 text-white" : "text-gray-200"
								}`}
							>
								<Cog6ToothIcon className="w-5 h-5" />
								<span>User Settings</span>
							</Link>
						)}
					</MenuItem>
					<MenuItem>
						<SignOutLink active={false} />
					</MenuItem>
				</MenuItems>
			</Transition>
		</Menu>
	)
}
