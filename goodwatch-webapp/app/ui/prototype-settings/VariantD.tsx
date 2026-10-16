// PROTOTYPE - throwaway. Variant D, "Tiles" (the bolder one): a profile header, then big tiles that show each setting's
// effect instead of its name: the flag and your service logos, a poster in your title language. A tile opens its editor
// in a sheet: from the right on a desktop, from the bottom on a phone. Motion is transform and opacity only.
import { XMarkIcon } from "@heroicons/react/24/solid"
import { type ReactNode, useEffect, useState } from "react"
import { ConnectAppBadge } from "~/ui/auth/connect"
import { regionName } from "~/utils/display-names"
import { tmdbImageUrl } from "~/utils/tmdb-image"
import { APPS, IMPORTS, MEMBER, SAMPLE_POSTER, sampleFor } from "./data"
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
	TextButton,
	languageLabel,
	shownLanguage,
	usePrefs,
} from "./parts"

type Sheet = "where" | "language" | "data" | "apps" | "account" | "profile"

export function VariantD() {
	const p = usePrefs()
	const [sheet, setSheet] = useState<Sheet | null>(null)
	const [last, setLast] = useState<Sheet>("where")
	const open = (s: Sheet) => {
		setLast(s)
		setSheet(s)
	}
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null)
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [])
	const sample = sampleFor(shownLanguage(p.language, p.browserLanguage))

	return (
		<div className="mx-auto max-w-6xl px-4 py-4 pb-32 md:px-8 md:py-8">
			{/* Profile header */}
			<header className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-br from-indigo-950 via-gray-900 to-gray-900 p-5 ring-1 ring-white/10 md:p-6">
				<span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-800 text-2xl font-black text-white md:h-20 md:w-20 md:text-3xl" aria-hidden="true">
					{MEMBER.name.slice(0, 1)}
				</span>
				<div className="min-w-0 flex-1">
					<p className="text-sm text-gray-400">Your settings</p>
					<h1 className="truncate text-2xl font-black text-white md:text-3xl">@{MEMBER.handle}</h1>
					<p className="truncate text-sm text-gray-400">
						{MEMBER.email} · member since {MEMBER.memberSince}
					</p>
				</div>
				<div className="flex gap-2">
					<TextButton onClick={() => open("profile")}>Public profile</TextButton>
					<TextButton onClick={() => open("account")}>Account</TextButton>
				</div>
			</header>

			<div className="mt-6 grid gap-4 md:grid-cols-2">
				<Tile label={NAMES.where} hint={NAMES.countryShort} onClick={() => open("where")}>
					<div className="flex items-center gap-3">
						<Flag code={p.country} className="h-8 md:h-10" />
						<span className="text-2xl font-black text-white md:text-3xl">{regionName(p.country)}</span>
					</div>
					<div className="mt-4">
						<ServiceLogos max={6} size="h-10 w-10" />
					</div>
				</Tile>

				<Tile label={NAMES.language} hint={NAMES.languageShort} onClick={() => open("language")}>
					<div className="flex gap-4">
						<img src={tmdbImageUrl(SAMPLE_POSTER, "w154")} alt="" className="h-28 w-[4.7rem] shrink-0 rounded-md object-cover shadow-lg" />
						<div className="min-w-0">
							<p lang={sample.title.lang} dir="auto" className="line-clamp-2 text-xl font-black text-white md:text-2xl">
								{sample.title.text}
							</p>
							<p className="mt-1 text-sm text-gray-400">{languageLabel(p.language, p.browserLanguage)}</p>
						</div>
					</div>
				</Tile>

				<Tile label={NAMES.library} hint="Imports and hidden titles" onClick={() => open("data")}>
					<div className="flex gap-8">
						<Stat value="1,696" label={`from ${IMPORTS.length} imports`} />
						<Stat value="27" label="hidden titles" />
					</div>
				</Tile>

				<Tile label={NAMES.apps} hint="Assistants that can reach your GoodWatch" onClick={() => open("apps")}>
					<div className="flex items-center gap-3">
						{APPS.map((a) => (
							<ConnectAppBadge key={a.id} app={a.app} />
						))}
						<span className="text-sm text-gray-400">{APPS.length} connected</span>
					</div>
				</Tile>
			</div>

			{/* Sheet: always mounted, so it slides in and out. */}
			<div
				aria-hidden={!sheet}
				onClick={() => setSheet(null)}
				className={`fixed inset-0 z-[1100] bg-black/60 transition-opacity duration-200 ${sheet ? "opacity-100" : "pointer-events-none opacity-0"}`}
			/>
			<aside
				role="dialog"
				aria-modal="true"
				aria-label={TITLES[last]}
				className={`fixed inset-x-0 bottom-0 z-[1101] flex max-h-[88vh] flex-col rounded-t-2xl bg-gray-900 ring-1 ring-white/10 transition-[transform,opacity] duration-300 ease-out will-change-transform md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[36rem] md:rounded-none md:rounded-l-2xl ${sheet ? "translate-x-0 translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0 md:translate-x-full md:translate-y-0"}`}
			>
				<div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
					<h2 className="flex-1 text-lg font-bold text-white">{TITLES[last]}</h2>
					<button type="button" onClick={() => setSheet(null)} aria-label="Close" className="cursor-pointer rounded-full p-1.5 text-gray-300 hover:bg-white/10">
						<XMarkIcon className="h-5 w-5" />
					</button>
				</div>
				<div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
					<SheetBody which={last} />
				</div>
			</aside>
		</div>
	)
}

const TITLES: Record<Sheet, string> = {
	where: NAMES.where,
	language: NAMES.language,
	data: NAMES.library,
	apps: NAMES.apps,
	account: NAMES.account,
	profile: NAMES.profile,
}

function Tile({ label, hint, onClick, children }: { label: string; hint: string; onClick: () => void; children: ReactNode }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="group flex min-h-48 cursor-pointer flex-col rounded-2xl bg-white/[0.04] p-5 text-left ring-1 ring-white/10 transition-transform duration-150 hover:-translate-y-0.5 hover:bg-white/[0.06] md:p-6"
		>
			<span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{label}</span>
			<span className="mb-4 text-sm text-gray-400">{hint}</span>
			<span className="mt-auto">{children}</span>
			<span className="mt-4 text-sm font-semibold text-amber-500 group-hover:text-amber-400">Change</span>
		</button>
	)
}

function Stat({ value, label }: { value: string; label: string }) {
	return (
		<span>
			<span className="block text-3xl font-black text-white">{value}</span>
			<span className="block text-sm text-gray-400">{label}</span>
		</span>
	)
}

function SheetBody({ which }: { which: Sheet }) {
	switch (which) {
		case "where":
			return (
				<div className="flex flex-col gap-6">
					<div>
						<h3 className="text-base font-semibold text-white">{NAMES.country}</h3>
						<p className="mt-1 mb-3 text-sm text-gray-400">{NAMES.countryHelp}</p>
						<CountryList className="h-56" />
					</div>
					<div>
						<h3 className="text-base font-semibold text-white">{NAMES.services}</h3>
						<p className="mt-1 mb-3 text-sm text-gray-400">{NAMES.servicesHelp}</p>
						<ServicesGrid limit={12} compact />
					</div>
				</div>
			)
		case "language":
			return (
				<div className="flex flex-col gap-3">
					<p className="text-sm text-gray-400">{NAMES.languageHelp}</p>
					<LanguageList className="h-[26rem]" />
				</div>
			)
		case "data":
			return (
				<div className="flex flex-col gap-6">
					<div className="flex flex-col gap-3">
						<h3 className="text-base font-semibold text-white">{NAMES.imports}</h3>
						<ImportsBlock compact />
					</div>
					<div className="flex flex-col gap-3">
						<h3 className="text-base font-semibold text-white">{NAMES.hidden}</h3>
						<HiddenBlock max={3} />
					</div>
				</div>
			)
		case "apps":
			return <AppsBlock />
		case "profile":
			return <ProfileBlock />
		case "account":
			return (
				<div className="flex flex-col gap-6">
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
