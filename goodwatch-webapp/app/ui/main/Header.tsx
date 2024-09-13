import {
	Disclosure,
	DisclosureButton,
	DisclosurePanel,
	Menu,
	MenuButton,
	MenuItem,
	MenuItems,
	Transition,
} from "@headlessui/react"
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline"
import React, { Fragment } from "react"
import { useLocation } from "react-router"

import Search from "~/ui/Search"
import { useUser } from "~/utils/auth"

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import logo from "~/img/goodwatch-logo.png"
import { GoogleSignInButton } from "~/ui/auth/GoogleSignInButton"
import { SignOutLink } from "~/ui/auth/SignOutLink"

export default function Header() {
	const location = useLocation()
	const isPage = (pathname: string) => location.pathname === pathname

	const { user, loading } = useUser()

	return (
		<Disclosure as="nav" className="bg-gray-950/35 fixed top-0 z-50 w-full">
			{({ open }) => (
				<>
					<div className="mx-auto max-w-7xl px-2 sm:px-4 lg:px-8">
						<div className="relative flex h-16 items-center justify-between">
							<div className="flex lg:hidden">
								{/* Mobile menu button */}
								<DisclosureButton className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
									<span className="sr-only">Open main menu</span>
									{open ? (
										<XMarkIcon className="block h-6 w-6" aria-hidden="true" />
									) : (
										<Bars3Icon className="block h-6 w-6" aria-hidden="true" />
									)}
								</DisclosureButton>
							</div>
							<div className="flex items-center px-2 lg:px-0">
								<div className="flex-shrink-0">
									<a href="/">
										<img
											className="h-10 w-auto"
											src={logo}
											alt="GoodWatch Logo"
										/>
									</a>
								</div>
								<a href="/">
									<div className="brand-header hidden md:block ml-2 text-2xl text-gray-100">
										GoodWatch
									</div>
								</a>
								<div className="hidden lg:ml-6 lg:block">
									<div className="flex space-x-4">
										<a
											href="/discover"
											className={`rounded-md px-3 py-2 text-md font-semibold ${isPage("/discover") ? "text-white bg-indigo-800" : "text-gray-300"} hover:bg-indigo-900 hover:text-white`}
										>
											Discover
										</a>
									</div>
								</div>
							</div>
							<div className="flex flex-1 justify-center px-2 lg:ml-6 lg:justify-end">
								<div className="w-full max-w-lg lg:max-w-xl">
									<Search />
								</div>
							</div>
							<div className="lg:ml-4">
								<div className="flex items-center">
									{loading ? (
										<></>
									) : user ? (
										<>
											{/* Profile dropdown */}
											<Menu as="div" className="relative ml-4 flex-shrink-0">
												<MenuButton className="flex rounded-full bg-gray-800 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
													<span className="sr-only">Open user menu</span>
													<img
														className="h-8 w-8 rounded-full"
														src={user.user_metadata.avatar_url}
														alt={user?.user_metadata.name}
														title={user?.user_metadata.name}
													/>
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
													<MenuItems
														anchor="bottom"
														className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-gray-950 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
													>
														<MenuItem>
															<a
																href="/wishlist"
																className={`
                                  ${isPage("/wishlist") ? "bg-gray-800 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}
                                  block px-4 py-2 text-base
                                `}
															>
																Wishlist
															</a>
														</MenuItem>
														<MenuItem>
															<SignOutLink active={false} />
														</MenuItem>
													</MenuItems>
												</Transition>
											</Menu>
										</>
									) : (
										<GoogleSignInButton />
									)}
								</div>
							</div>
						</div>
					</div>

					<Transition
						enter="duration-200 ease-out"
						enterFrom="opacity-0 -translate-y-6"
						enterTo="opacity-100 translate-y-0"
						leave="duration-300 ease-out"
						leaveFrom="opacity-100 translate-y-0"
						leaveTo="opacity-0 -translate-y-6"
					>
						<DisclosurePanel className="lg:hidden text-lg">
							<div className="space-y-1 px-2 pt-2 pb-3">
								<a
									href="/"
									className={`block rounded-md px-3 py-2 font-medium ${isPage("/") ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
								>
									Home
								</a>
								<a
									href="/discover"
									className={`flex items-center rounded-md px-3 py-2 font-medium ${isPage("/discover") ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
								>
									Discover
								</a>
							</div>
							<div className="border-t border-gray-500 space-y-1 px-2 pt-2 pb-3">
								<a
									href="/about"
									className={`flex items-center rounded-md px-3 py-2 font-medium ${isPage("/about") ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
								>
									About
								</a>
								<a
									href="/disclaimer"
									className={`flex items-center rounded-md px-3 py-2 font-medium ${isPage("/disclaimer") ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
								>
									Disclaimer
								</a>
							</div>
							<div className="border-t border-gray-500 space-y-1 px-2 pt-2 pb-3">
								<a
									href="https://dev.to/t/goodwatch"
									className={`flex items-center rounded-md px-3 py-2 font-medium ${isPage("/blog") ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
								>
									Blog
									<ArrowTopRightOnSquareIcon className="ml-2 h-5 w-5" />
								</a>
								<a
									href="https://status.goodwatch.app/status/services"
									className={`flex items-center rounded-md px-3 py-2 font-medium ${isPage("/status") ? "bg-gray-900 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`}
								>
									Status Page
									<ArrowTopRightOnSquareIcon className="ml-2 h-5 w-5" />
								</a>
							</div>
						</DisclosurePanel>
					</Transition>
				</>
			)}
		</Disclosure>
	)
}
