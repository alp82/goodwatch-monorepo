// PROTOTYPE - throwaway. Variant B, "Summary list": a grouped list of rows, each saying what is set now ("Germany",
// four service logos, "German, follows your browser"). A row opens its editor beside the list on a desktop, or in place
// of the list on a phone, with a way back.
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/solid"
import { type ReactNode, useState } from "react"
import { ConnectAppBadge } from "~/ui/auth/connect"
import { regionName } from "~/utils/display-names"
import { APPS, IMPORTS, MEMBER } from "./data"
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
	ProfileBlock,
	RestartSetup,
	ServiceLogos,
	ServicesGrid,
	SignInMethods,
	TitlePreview,
	languageLabel,
	usePrefs,
} from "./parts"

type Key = "country" | "services" | "language" | "profile" | "imports" | "hidden" | "apps" | "account"

export function VariantB() {
	const p = usePrefs()
	const [open, setOpen] = useState<Key | null>(null)
	// A desktop always shows an editor: the first one until a row is picked.
	const shown: Key = open ?? "country"

	const groups: { title: string; rows: { key: Key; name: string; value: ReactNode }[] }[] = [
		{
			title: NAMES.where,
			rows: [
				{
					key: "country",
					name: NAMES.country,
					value: (
						<span className="flex items-center gap-1.5">
							<Flag code={p.country} />
							{regionName(p.country)}
						</span>
					),
				},
				{ key: "services", name: NAMES.services, value: <ServiceLogos max={4} size="h-6 w-6" /> },
			],
		},
		{
			title: "Language",
			rows: [{ key: "language", name: NAMES.language, value: languageLabel(p.language, p.browserLanguage) }],
		},
		{
			title: "You",
			rows: [
				{ key: "profile", name: NAMES.profile, value: `@${MEMBER.handle}` },
				{ key: "account", name: NAMES.account, value: MEMBER.email },
				{
					key: "apps",
					name: NAMES.apps,
					value: (
						<span className="flex items-center gap-1">
							{APPS.map((a) => (
								<span key={a.id} className="origin-right scale-[0.7]">
									<ConnectAppBadge app={a.app} size="sm" />
								</span>
							))}
						</span>
					),
				},
			],
		},
		{
			title: NAMES.library,
			rows: [
				{ key: "imports", name: NAMES.imports, value: `${IMPORTS.length} sources` },
				{ key: "hidden", name: NAMES.hidden, value: "27 titles" },
			],
		},
	]
	const all = groups.flatMap((g) => g.rows)

	const list = (
		<nav aria-label="Settings" className="flex flex-col gap-6">
			{groups.map((g) => (
				<div key={g.title}>
					<h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-gray-500 uppercase">{g.title}</h2>
					<ul className="divide-y divide-white/5 overflow-hidden rounded-xl bg-white/[0.04] ring-1 ring-white/10">
						{g.rows.map((r) => {
							const current = r.key === shown
							return (
								<li key={r.key}>
									<button
										type="button"
										onClick={() => setOpen(r.key)}
										aria-current={current || undefined}
										className={`flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.06] ${current ? "md:bg-indigo-800/60" : ""}`}
									>
										<span className="min-w-0 flex-1">
											<span className="block font-semibold text-gray-100">{r.name}</span>
											<span className="mt-0.5 block truncate text-sm text-gray-400">{r.value}</span>
										</span>
										<ChevronRightIcon className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
									</button>
								</li>
							)
						})}
					</ul>
				</div>
			))}
		</nav>
	)

	const name = all.find((r) => r.key === shown)?.name
	const detail = (
		<div key={shown} className={`flex flex-col gap-4 ${open ? "animate-[proto-settings-in_180ms_ease-out]" : ""}`}>
			<button type="button" onClick={() => setOpen(null)} className="flex cursor-pointer items-center gap-1 self-start text-sm font-semibold text-gray-300 md:hidden">
				<ChevronLeftIcon className="h-4 w-4" aria-hidden="true" /> Settings
			</button>
			<h2 className="text-xl font-bold tracking-tight text-gray-100 md:text-2xl">{name}</h2>
			<Detail which={shown} />
		</div>
	)

	return (
		<div className="mx-auto max-w-6xl px-4 py-4 pb-32 md:px-8 md:py-8">
			<style>{"@keyframes proto-settings-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"}</style>
			<h1 className={`text-2xl font-bold tracking-tight text-gray-100 sm:text-3xl md:text-4xl ${open ? "hidden md:block" : ""}`}>Your settings</h1>
			<div className="mt-6 grid gap-8 md:grid-cols-[20rem_1fr]">
				<div className={open ? "hidden md:block" : ""}>{list}</div>
				<div className={open ? "" : "hidden md:block"}>{detail}</div>
			</div>
		</div>
	)
}

function Detail({ which }: { which: Key }) {
	switch (which) {
		case "country":
			return (
				<>
					<p className="max-w-prose text-sm text-gray-400">{NAMES.countryHelp}</p>
					<div className="max-w-md">
						<CountryList className="h-[26rem]" />
					</div>
				</>
			)
		case "services":
			return (
				<>
					<p className="max-w-prose text-sm text-gray-400">{NAMES.servicesHelp}</p>
					<ServicesGrid limit={24} />
				</>
			)
		case "language":
			return (
				<>
					<p className="max-w-prose text-sm text-gray-400">{NAMES.languageHelp}</p>
					<div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
						<LanguageList className="h-[24rem]" />
						<TitlePreview />
					</div>
				</>
			)
		case "profile":
			return <ProfileBlock />
		case "imports":
			return <ImportsBlock />
		case "hidden":
			return (
				<>
					<p className="text-sm text-gray-400">Titles you marked Not interested. They stay out of your recommendations. You can still find them in search.</p>
					<HiddenBlock />
				</>
			)
		case "apps":
			return <AppsBlock />
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
