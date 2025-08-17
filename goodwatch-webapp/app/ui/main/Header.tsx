import {
	Menu,
	MenuButton,
	MenuItem,
	MenuItems,
	Transition,
} from "@headlessui/react"
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline"
import React, { Fragment } from "react"
import { useLocation } from "react-router"

import {
	ArrowTopRightOnSquareIcon,
	BookmarkIcon,
} from "@heroicons/react/20/solid"
import {
	Cog6ToothIcon,
	EyeIcon,
	UserCircleIcon,
} from "@heroicons/react/24/solid"
import { Link } from "@remix-run/react"
import logoCircle from "~/img/goodwatch-logo-circle.svg"
import logo from "~/img/goodwatch-logo-white.svg"
import Search from "~/ui/Search"
import { SignInButton } from "~/ui/auth/SignInButton"
import { SignOutLink } from "~/ui/auth/SignOutLink"
import { GlobalLoading } from "~/ui/nav/GlobalLoading"
import { useUser } from "~/utils/auth"

const mainNav = [
	{
		label: "Movies",
		path: "/movies",
	},
	{
		label: "Shows",
		path: "/shows",
	},
	{
		label: "Discover",
		path: "/discover",
	},
]

export default function Header() {
	const location = useLocation()
	const isPage = (pathname: string) => location.pathname.startsWith(pathname)
	const isPageExact = (pathname: string) => location.pathname === pathname

	const { user, loading } = useUser()

	return (
		<div className="fixed top-0 z-50 w-full bg-gray-900">
			<GlobalLoading />
			<nav className="bg-gray-950/35">
				<div className="mx-auto max-w-7xl px-4">
					<div className="relative flex h-16 items-center justify-between">
						{/* Mobile menu button */}
						<div className="flex lg:hidden">
							<Menu as="div" className="relative inline-block text-left">
								{({ open }) => (
									<>
										<MenuButton className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-white">
											<span className="sr-only">Open main menu</span>
											{open ? (
												<XMarkIcon
													className="block h-6 w-6"
													aria-hidden="true"
												/>
											) : (
												<Bars3Icon
													className="block h-6 w-6"
													aria-hidden="true"
												/>
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
											<MenuItems className="absolute left-0 z-50 mt-2 w-64 origin-top-left rounded-md bg-gray-950 py-2 shadow-lg ring-1 ring-black/5 focus:outline-hidden">
												<MenuItem>
													{({ focus }) => (
														<Link
															to="/"
															prefetch="render"
															className={`block px-4 py-2 text-base font-medium ${
																isPageExact("/")
																	? "bg-amber-900 text-white"
																	: "text-gray-300"
															} ${focus ? "bg-gray-700 text-white" : ""}`}
														>
															Home
														</Link>
													)}
												</MenuItem>
												{mainNav.map((nav) => (
													<MenuItem key={nav.path}>
														{({ focus }) => (
															<Link
																to={nav.path}
																prefetch="render"
																className={`block px-4 py-2 text-base font-medium ${
																	isPage("/discover")
																		? "bg-amber-900 text-white"
																		: "text-gray-300"
																} ${focus ? "bg-gray-700 text-white" : ""}`}
															>
																{nav.label}
															</Link>
														)}
													</MenuItem>
												))}
												<div className="border-t border-gray-500">
													<MenuItem>
														{({ focus }) => (
															<Link
																to="/about"
																prefetch="viewport"
																className={`block px-4 py-2 text-base font-medium ${
																	isPage("/about")
																		? "bg-amber-900 text-white"
																		: "text-gray-300"
																} ${focus ? "bg-gray-700 text-white" : ""}`}
															>
																About
															</Link>
														)}
													</MenuItem>
													<MenuItem>
														{({ focus }) => (
															<Link
																to="/disclaimer"
																prefetch="viewport"
																className={`block px-4 py-2 text-base font-medium ${
																	isPage("/disclaimer")
																		? "bg-amber-900 text-white"
																		: "text-gray-300"
																} ${focus ? "bg-gray-700 text-white" : ""}`}
															>
																Disclaimer
															</Link>
														)}
													</MenuItem>
												</div>
												<div className="border-t border-gray-500">
													<MenuItem>
														{({ focus }) => (
															<a
																href="https://dev.to/t/goodwatch"
																className={`flex items-center px-4 py-2 text-base font-medium ${
																	focus
																		? "bg-gray-700 text-white"
																		: "text-gray-300"
																}`}
															>
																Blog
																<ArrowTopRightOnSquareIcon className="ml-2 h-5 w-5" />
															</a>
														)}
													</MenuItem>
													<MenuItem>
														{({ focus }) => (
															<a
																href="https://status.goodwatch.app/status/services"
																className={`flex items-center px-4 py-2 text-base font-medium ${
																	focus
																		? "bg-gray-700 text-white"
																		: "text-gray-300"
																}`}
															>
																Status Page
																<ArrowTopRightOnSquareIcon className="ml-2 h-5 w-5" />
															</a>
														)}
													</MenuItem>
												</div>
											</MenuItems>
										</Transition>
									</>
								)}
							</Menu>
						</div>
						{/* Logo and desktop links */}
						<div className="flex items-baseline px-2 lg:px-0">
							<div className="shrink-0">
								<Link to="/" prefetch="render">
									<img className="h-7 w-auto" src={logo} alt="GoodWatch Logo" />
								</Link>
							</div>
							<Link to="/" prefetch="render">
								<div className="brand-header hidden md:block ml-0.5 text-4xl text-gray-100">
									<span className="hidden">G</span>oodWatch
								</div>
							</Link>
						</div>
						{/* Main nav */}
						<div className="hidden lg:ml-6 lg:block">
							<div className="flex space-x-4">
								{mainNav.map((nav) => (
									<Link
										key={nav.path}
										className={`rounded-md px-3 py-2 text-md font-semibold ${
											isPage(nav.path)
												? "text-white bg-amber-800"
												: "text-gray-300"
										} hover:bg-amber-900 hover:text-white`}
										to={nav.path}
										prefetch="render"
									>
										{nav.label}
									</Link>
								))}
							</div>
						</div>
						{/* Search bar */}
						<div className="flex flex-1 justify-center px-2 lg:ml-6 lg:justify-end">
							<div className="max-w-lg lg:max-w-7xl">
								<Search />
							</div>
						</div>
						{/* Profile and Sign-In/Out */}
						<div className="lg:ml-2">
							<div className="flex items-center">
								{loading ? null : user ? (
									<Menu as="div" className="relative ml-2 shrink-0">
										<MenuButton className="flex rounded-full bg-gray-800 text-sm text-white focus:outline-hidden focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
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
															to="/discover?type=all&watchedType=plan-to-watch&streamingPreset=mine"
															prefetch="viewport"
															className={`flex gap-2 items-center px-4 py-2 text-base font-medium ${
																focus
																	? "bg-gray-700 text-white"
																	: "text-amber-500"
															}`}
														>
															<BookmarkIcon className="w-5 h-5" />
															<span>
																What I{" "}
																<span className="font-extrabold">
																	Plan to Watch
																</span>
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
																focus
																	? "bg-gray-700 text-white"
																	: "text-green-500"
															}`}
														>
															<EyeIcon className="w-5 h-5" />
															<span>
																What I{" "}
																<span className="font-extrabold">
																	Already Watched
																</span>
															</span>
														</Link>
													)}
												</MenuItem>
												<MenuItem>
													{({ focus }) => (
														<Link
															to="/settings/country"
															className={`w-full flex gap-2 items-center px-4 py-2 text-base font-medium ${
																focus
																	? "bg-gray-700 text-white"
																	: "text-gray-200"
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
								) : (
									<SignInButton />
								)}
							</div>
						</div>
					</div>
				</div>
			</nav>
		</div>
	)
}
