// PROTOTYPE - throwaway. Variant C, "Grouped tabs": today's sidebar of tabs, regrouped under three headings and
// renamed, with one topic per tab. The closest to today's Settings, so links like /settings/streaming keep a home. On
// a phone the tabs become a scrolling row under the heading.
import { useState } from "react"
import { regionName } from "~/utils/display-names"
import {
	AppsBlock,
	CountryList,
	DeleteAccount,
	Flag,
	HiddenBlock,
	ImportsBlock,
	LanguageList,
	NAMES,
	PasswordBlock,
	Panel,
	ProfileBlock,
	RestartSetup,
	ServiceLogos,
	ServicesGrid,
	SignInMethods,
	TitlePreview,
	languageLabel,
	usePrefs,
} from "./parts"

type Tab = "where" | "language" | "profile" | "imports" | "hidden" | "apps" | "account"

const NAV: { heading: string; tabs: { key: Tab; name: string; path: string }[] }[] = [
	{
		heading: "Watching",
		tabs: [
			{ key: "where", name: NAMES.where, path: "/settings/streaming" },
			{ key: "language", name: NAMES.language, path: "/settings/language" },
		],
	},
	{
		heading: NAMES.library,
		tabs: [
			{ key: "imports", name: NAMES.imports, path: "/settings/imports" },
			{ key: "hidden", name: NAMES.hidden, path: "/settings/hidden" },
		],
	},
	{
		heading: "Account",
		tabs: [
			{ key: "profile", name: NAMES.profile, path: "/settings/profile" },
			{ key: "apps", name: NAMES.apps, path: "/settings/connected-apps" },
			{ key: "account", name: NAMES.account, path: "/settings/account" },
		],
	},
]

export function VariantC() {
	const [tab, setTab] = useState<Tab>("where")
	const all = NAV.flatMap((g) => g.tabs)
	const current = all.find((t) => t.key === tab)
	return (
		<div className="mx-auto max-w-7xl px-4 py-4 pb-32 md:px-8 lg:py-8">
			<h1 className="my-3 text-center text-2xl font-bold tracking-tight text-gray-100 sm:my-6 sm:text-3xl md:text-4xl lg:text-5xl">Your settings</h1>
			<hr className="mb-4 hidden border-gray-700 md:block" />

			<nav aria-label="Settings" className="-mx-4 overflow-x-auto px-4 pb-3 md:hidden">
				<ul className="flex gap-2">
					{all.map((t) => (
						<li key={t.key}>
							<button
								type="button"
								onClick={() => setTab(t.key)}
								className={`rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${tab === t.key ? "bg-indigo-800 text-gray-50" : "bg-white/[0.06] text-gray-300"}`}
							>
								{t.name}
							</button>
						</li>
					))}
				</ul>
			</nav>

			<div className="flex gap-4 lg:gap-8">
				<nav aria-label="Settings" className="hidden md:block">
					<div className="flex w-44 flex-col gap-5 lg:w-52">
						{NAV.map((g) => (
							<div key={g.heading}>
								<h2 className="mb-1 px-2 text-xs font-semibold tracking-wide text-gray-500 uppercase">{g.heading}</h2>
								<ul className="space-y-1">
									{g.tabs.map((t) => (
										<li key={t.key}>
											<button
												type="button"
												onClick={() => setTab(t.key)}
												className={`flex w-full cursor-pointer rounded-md p-2 text-left text-sm/6 font-semibold ${tab === t.key ? "bg-indigo-800 text-gray-50" : "text-gray-400 hover:bg-indigo-900 hover:text-gray-100"}`}
											>
												{t.name}
											</button>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
				</nav>
				<div className="min-w-0 flex-1 md:px-4 lg:px-8">
					<div className="flex flex-col gap-1">
						<h2 className="text-lg font-bold tracking-tight text-gray-100 md:text-xl lg:text-2xl">{current?.name}</h2>
						<p className="text-xs text-gray-500">{current?.path}</p>
					</div>
					<div className="mt-4">
						<Page tab={tab} />
					</div>
				</div>
			</div>
		</div>
	)
}

function Page({ tab }: { tab: Tab }) {
	const p = usePrefs()
	switch (tab) {
		case "where":
			return (
				<div className="flex flex-col gap-6">
					<Panel>
						<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
							<span className="flex items-center gap-2 text-lg font-semibold text-white">
								<Flag code={p.country} className="h-4" /> {regionName(p.country)}
							</span>
							<ServiceLogos max={8} />
						</div>
					</Panel>
					<div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
						<div>
							<h3 className="text-base font-semibold text-white">{NAMES.country}</h3>
							<p className="mt-1 mb-3 text-sm text-gray-400">{NAMES.countryHelp}</p>
							<CountryList className="h-72" />
						</div>
						<div>
							<h3 className="text-base font-semibold text-white">{NAMES.services}</h3>
							<p className="mt-1 mb-3 text-sm text-gray-400">{NAMES.servicesHelp}</p>
							<ServicesGrid limit={18} compact />
						</div>
					</div>
				</div>
			)
		case "language":
			return (
				<div className="flex flex-col gap-4">
					<p className="max-w-prose text-sm text-gray-400">{NAMES.languageHelp}</p>
					<div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
						<Panel>
							<h3 className="flex items-center gap-2 text-base font-semibold text-white">
								Show titles in <span className="truncate text-sm font-normal text-gray-400">{languageLabel(p.language, p.browserLanguage)}</span>
							</h3>
							<LanguageList className="mt-3 h-[22rem]" />
						</Panel>
						<TitlePreview />
					</div>
				</div>
			)
		case "profile":
			return (
				<div className="max-w-lg">
					<ProfileBlock />
				</div>
			)
		case "imports":
			return (
				<div className="max-w-2xl">
					<ImportsBlock />
				</div>
			)
		case "hidden":
			return (
				<div className="flex max-w-2xl flex-col gap-3">
					<p className="text-sm text-gray-400">Titles you marked Not interested. They stay out of your recommendations.</p>
					<HiddenBlock />
				</div>
			)
		case "apps":
			return (
				<div className="max-w-2xl">
					<AppsBlock />
				</div>
			)
		case "account":
			return (
				<div className="flex max-w-xl flex-col gap-6">
					<SignInMethods />
					<div className="flex flex-col gap-2">
						<h3 className="text-base font-semibold text-white">Password</h3>
						<PasswordBlock />
					</div>
					<RestartSetup />
					<DeleteAccount />
				</div>
			)
	}
}
