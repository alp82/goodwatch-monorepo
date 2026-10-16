// PROTOTYPE - throwaway. Variant A, "One page": every setting on one scrolling page in six groups, with a sticky index
// (a sidebar on a desktop, a row of chips on a phone). Nothing hides behind a tab.
import { useEffect, useState } from "react"
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
	SectionTitle,
	ServicesGrid,
	SignInMethods,
	TitlePreview,
	languageLabel,
	usePrefs,
} from "./parts"

const SECTIONS = [
	{ id: "where", name: NAMES.where },
	{ id: "language", name: NAMES.language },
	{ id: "profile", name: NAMES.profile },
	{ id: "data", name: NAMES.library },
	{ id: "apps", name: NAMES.apps },
	{ id: "account", name: NAMES.account },
]

export function VariantA() {
	const p = usePrefs()
	const [active, setActive] = useState("where")
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
				if (top) setActive(top.target.id)
			},
			{ rootMargin: "-20% 0px -70% 0px" },
		)
		for (const s of SECTIONS) {
			const el = document.getElementById(s.id)
			if (el) observer.observe(el)
		}
		return () => observer.disconnect()
	}, [])

	return (
		<div className="mx-auto max-w-6xl px-4 py-4 md:px-8 md:py-8">
			<h1 className="text-2xl font-bold tracking-tight text-gray-100 sm:text-3xl md:text-4xl">Your settings</h1>

			{/* Phone: chips under the header. */}
			<nav aria-label="Settings sections" className="sticky top-16 z-20 -mx-4 mt-4 overflow-x-auto bg-gray-950/95 px-4 py-2 md:hidden">
				<ul className="flex gap-2">
					{SECTIONS.map((s) => (
						<li key={s.id}>
							<a
								href={`#${s.id}`}
								className={`block rounded-full px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${active === s.id ? "bg-indigo-800 text-gray-50" : "bg-white/[0.06] text-gray-300"}`}
							>
								{s.name}
							</a>
						</li>
					))}
				</ul>
			</nav>

			<div className="mt-6 flex gap-10">
				<nav aria-label="Settings sections" className="hidden w-48 shrink-0 md:block">
					<ul className="sticky top-24 space-y-1">
						{SECTIONS.map((s) => (
							<li key={s.id}>
								<a
									href={`#${s.id}`}
									className={`block rounded-md p-2 text-sm/6 font-semibold ${active === s.id ? "bg-indigo-800 text-gray-50" : "text-gray-400 hover:bg-indigo-900 hover:text-gray-100"}`}
								>
									{s.name}
								</a>
							</li>
						))}
					</ul>
				</nav>

				<div className="flex min-w-0 flex-1 flex-col gap-14 pb-32">
					<section className="flex flex-col gap-4">
						<SectionTitle id="where" help="Which services you can watch a title on. Both depend on your country.">
							{NAMES.where}
						</SectionTitle>
						<div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
							<Panel>
								<h3 className="flex items-center gap-2 text-base font-semibold text-white">
									{NAMES.country}
									<span className="flex items-center gap-1.5 truncate text-sm font-normal text-gray-400">
										<Flag code={p.country} />
										{regionName(p.country)}
									</span>
								</h3>
								<p className="mt-1 mb-3 text-sm text-gray-400">{NAMES.countryHelp}</p>
								<CountryList className="h-64" />
							</Panel>
							<Panel>
								<h3 className="text-base font-semibold text-white">{NAMES.services}</h3>
								<p className="mt-1 mb-3 text-sm text-gray-400">{NAMES.servicesHelp}</p>
								<ServicesGrid limit={16} compact />
							</Panel>
						</div>
					</section>

					<section className="flex flex-col gap-4">
						<SectionTitle id="language" help={NAMES.languageHelp}>
							{NAMES.language}
						</SectionTitle>
						<div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
							<Panel>
								<h3 className="flex items-center gap-2 text-base font-semibold text-white">
									Show titles in
									<span className="truncate text-sm font-normal text-gray-400">{languageLabel(p.language, p.browserLanguage)}</span>
								</h3>
								<LanguageList className="mt-3 h-72" />
							</Panel>
							<div className="flex flex-col gap-3">
								<TitlePreview />
								<p className="text-sm text-gray-500">
									Your streaming country doesn't change the language. Someone in Germany can read titles in English, and the other way round.
								</p>
							</div>
						</div>
					</section>

					<section className="flex max-w-2xl flex-col gap-4">
						<SectionTitle id="profile" help="Your handle is the address of your public profile, where the lists you share appear.">
							{NAMES.profile}
						</SectionTitle>
						<ProfileBlock />
					</section>

					<section className="flex max-w-2xl flex-col gap-6">
						<SectionTitle id="data" help="What you brought in from other sites, and what you asked not to see.">
							{NAMES.library}
						</SectionTitle>
						<div className="flex flex-col gap-3">
							<h3 className="text-base font-semibold text-white">{NAMES.imports}</h3>
							<ImportsBlock />
						</div>
						<div className="flex flex-col gap-3">
							<h3 className="text-base font-semibold text-white">
								{NAMES.hidden} <span className="font-normal text-gray-500">27</span>
							</h3>
							<p className="text-sm text-gray-400">Titles you marked Not interested. They stay out of your recommendations.</p>
							<HiddenBlock max={3} />
						</div>
					</section>

					<section className="flex max-w-2xl flex-col gap-4">
						<SectionTitle id="apps" help="Assistants that can reach your GoodWatch. Disconnecting stops them right away; nothing you saved is lost.">
							{NAMES.apps}
						</SectionTitle>
						<AppsBlock />
					</section>

					<section className="flex max-w-2xl flex-col gap-6">
						<SectionTitle id="account">{NAMES.account}</SectionTitle>
						<SignInMethods />
						<div className="flex flex-col gap-2">
							<h3 className="text-base font-semibold text-white">Password</h3>
							<PasswordBlock />
						</div>
						<div className="flex flex-col gap-2">
							<h3 className="text-base font-semibold text-white">Setup</h3>
							<RestartSetup />
						</div>
						<DeleteAccount />
					</section>
				</div>
			</div>
		</div>
	)
}
