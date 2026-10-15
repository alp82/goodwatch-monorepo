// PROTOTYPE - throwaway (#617). A static copy of the settings frame (heading, sidebar with Imports chosen) so the
// variants sit where the real Imports page sits. No sign-in, no loader data.
import {
	ArrowDownTrayIcon,
	AtSymbolIcon,
	EyeSlashIcon,
	FlagIcon,
	TvIcon,
	UserIcon,
} from "@heroicons/react/24/solid"
import type { ReactNode } from "react"

const NAVIGATION = [
	{ name: "Country & titles", icon: FlagIcon },
	{ name: "Streaming", icon: TvIcon },
	{ name: "Profile", icon: AtSymbolIcon },
	{ name: "Imports", icon: ArrowDownTrayIcon },
	{ name: "Hidden titles", icon: EyeSlashIcon },
	{ name: "Account", icon: UserIcon },
]

export function SettingsShell({
	children,
	wide = false,
}: { children: ReactNode; wide?: boolean }) {
	return (
		<div className="max-w-7xl mx-auto px-8 lmt-0 py-2 md:py-4 lg:py-8 pb-32">
			<div className="flex flex-col gap-4 text-sm sm:text-md md:text-lg lg:text-xl text-gray-300">
				<h1 className="my-3 sm:my-6 font-bold tracking-tight text-center text-gray-100 text-2xl sm:text-3xl md:text-4xl lg:text-5xl">
					Your Settings
				</h1>
				<hr className="mb-4 border-gray-700" />
				<div className="flex gap-4 lg:gap-8 flex-wrap">
					<nav aria-label="Sidebar">
						<ul className="-mx-2 space-y-1 w-36 lg:w-48">
							{NAVIGATION.map((item) => {
								const current = item.name === "Imports"
								return (
									<li key={item.name}>
										<span
											className={`${current ? "bg-indigo-800 text-gray-50" : "text-gray-400"} group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold`}
										>
											<item.icon
												aria-hidden="true"
												className={`${current ? "text-gray-50" : "text-gray-400"} h-6 w-6`}
											/>
											{item.name}
										</span>
									</li>
								)
							})}
						</ul>
					</nav>
					<div className="min-w-0 flex-1 basis-full md:basis-0">
						<div className="px-2 md:px-4 lg:px-8">
							<div
								className={`flex ${wide ? "max-w-5xl" : "max-w-2xl"} flex-col gap-6 text-base text-gray-300`}
							>
								{children}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export function PageIntro({ children }: { children?: ReactNode }) {
	return (
		<div>
			<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
				Import your library
			</h2>
			<p className="mt-2 text-gray-400">
				{children ??
					"Bring your ratings and activity into GoodWatch. Choose where your export comes from, preview it, and decide what to import."}
			</p>
		</div>
	)
}
