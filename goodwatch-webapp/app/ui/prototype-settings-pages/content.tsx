// PROTOTYPE - throwaway (settings subpages). The bodies of the subpages that every variant shares as they are: each
// variant decides the frame around them (heading, back link, side list) and builds its own Imports page. The pieces
// come from parts.tsx (real lists on fake member state). Nothing saves.
import { useId, useState } from "react"
import { Switch } from "~/ui/toggle/Switch"
import { regionName } from "~/utils/display-names"
import {
	AppsBlock,
	CountryList,
	DeleteAccount,
	Flag,
	LanguageList,
	PasswordBlock,
	ProfileBlock,
	RestartSetup,
	ServicesGrid,
	SignInMethods,
	TitlePreview,
	languageLabel,
	usePrefs,
} from "./parts"
import type { PageSlug } from "./pages"

/** A titled part of a subpage. */
export function Part({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
	return (
		<section className="flex flex-col gap-3">
			<div>
				<h2 className="text-lg font-bold text-white">{title}</h2>
				{hint && <p className="max-w-prose text-sm text-gray-400">{hint}</p>}
			</div>
			{children}
		</section>
	)
}

export function WhereYouWatchBody() {
	const p = usePrefs()
	return (
		<div className="flex flex-col gap-10">
			<Part title="Watching from" hint="Your country. It decides where to watch each title, which services you can pick, and the age ratings you see.">
				<p className="flex items-center gap-2 text-sm text-gray-400">
					Now: <Flag code={p.country} className="h-3.5" /> <b className="text-white">{regionName(p.country)}</b>
				</p>
				<div className="max-w-md">
					<CountryList className="h-56" />
				</div>
			</Part>
			<Part title="Your services" hint="On my services keeps the titles on these, and you hear when a title you want lands on one.">
				<ServicesGrid limit={24} />
			</Part>
		</div>
	)
}

export function LanguageBody() {
	const p = usePrefs()
	return (
		<div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div className="flex flex-col gap-3">
				<p className="text-sm text-gray-400">
					Now: <b className="text-white">{languageLabel(p.language, p.browserLanguage)}</b>
				</p>
				<TitlePreview />
			</div>
			<LanguageList className="h-[26rem]" />
		</div>
	)
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (on: boolean) => void }) {
	const id = useId()
	return (
		<div className="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
			<div className="min-w-0 flex-1">
				<p id={`${id}-l`} className="font-semibold text-gray-100">
					{label}
				</p>
				<p id={`${id}-h`} className="text-sm text-gray-400">
					{hint}
				</p>
			</div>
			<Switch checked={checked} onChange={onChange} labelledBy={`${id}-l`} describedBy={`${id}-h`} />
		</div>
	)
}

export function DiscoverPrivacyBody() {
	const [forYou, setForYou] = useState(true)
	const [cookies, setCookies] = useState(true)
	return (
		<div className="flex max-w-2xl flex-col gap-8">
			<Part title="Discover">
				<SwitchRow
					label="For you in Discover"
					hint="Lifts the titles that match your taste in the order you pick."
					checked={forYou}
					onChange={setForYou}
				/>
			</Part>
			<Part title="Privacy">
				<SwitchRow
					label="Cookies"
					hint={cookies ? "Allowed. See the privacy policy for what they do." : "Declined. See the privacy policy for what they do."}
					checked={cookies}
					onChange={setCookies}
				/>
			</Part>
		</div>
	)
}

export function AppsBody() {
	return <AppsBlock />
}

export function ProfileBody() {
	return (
		<div className="max-w-2xl rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
			<ProfileBlock />
		</div>
	)
}

export function AccountBody() {
	return (
		<div className="flex max-w-2xl flex-col gap-10">
			<Part title="Sign-in methods">
				<SignInMethods />
			</Part>
			<Part title="Password">
				<PasswordBlock />
			</Part>
			<Part title="Restart setup">
				<RestartSetup />
			</Part>
			<Part title="Delete account">
				<DeleteAccount />
			</Part>
		</div>
	)
}

/** The shared body of a subpage, or null for Imports, which each variant builds. */
export function SharedBody({ slug }: { slug: PageSlug }) {
	switch (slug) {
		case "where-you-watch":
			return <WhereYouWatchBody />
		case "language":
			return <LanguageBody />
		case "discover-privacy":
			return <DiscoverPrivacyBody />
		case "connected-apps":
			return <AppsBody />
		case "profile":
			return <ProfileBody />
		case "account":
			return <AccountBody />
		default:
			return null
	}
}
