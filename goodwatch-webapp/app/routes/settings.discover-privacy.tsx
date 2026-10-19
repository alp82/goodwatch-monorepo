// Settings, Discover and privacy: whether Discover lifts the titles that match the member's taste (For you), and the
// cookie choice. Each switch moves at once; its save follows, and a failed save puts it back with Retry.
import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import { type ReactNode, useId, useState } from "react"
import { useUserSettings } from "~/routes/api.user-settings.get"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import { useCookieChoice } from "~/ui/CookieConsent"
import { PagePart, SettingsPage } from "~/ui/settings/SettingsPage"
import { Switch } from "~/ui/toggle/Switch"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => [
	{ title: "Discover and privacy | GoodWatch" },
	{ name: "robots", content: "noindex, nofollow" },
]

export default function SettingsDiscoverPrivacy() {
	const settings = useUserSettings()
	const save = useSetUserSettings()
	const [forYouNow, setForYouNow] = useState<boolean | null>(null)
	const forYou = forYouNow ?? settings.data?.for_you !== "no"
	const saveForYou = (on: boolean) => {
		setForYouNow(on)
		save.mutate({ settings: { for_you: on ? "yes" : "no" } }, { onError: () => setForYouNow(null) })
	}
	const [forYouTried, setForYouTried] = useState<boolean | null>(null)
	const cookies = useCookieChoice()
	const { consentGiven, setConsent } = cookies
	return (
		<SettingsPage
			title="Discover and privacy"
			intro="Choose whether Discover lifts titles that match your taste, and whether GoodWatch may use cookies."
		>
			<div className="flex max-w-2xl flex-col gap-8">
				<PagePart title="Discover">
					<SwitchRow
						label="For you in Discover"
						hint="Lifts the titles that match your taste in the order you pick."
						checked={forYou}
						disabled={!settings.data}
						onChange={(on) => {
							setForYouTried(on)
							saveForYou(on)
						}}
					/>
					{save.isError && forYouTried !== null && <SaveFailed what="For you" onRetry={() => saveForYou(forYouTried)} />}
				</PagePart>
				<PagePart title="Privacy">
					<SwitchRow
						label="Cookies"
						hint={
							<>
								{consentGiven === "yes" ? "Allowed." : consentGiven === "no" ? "Declined." : "Not chosen yet."}{" "}
								<Link to="/privacy" className="underline underline-offset-2 hover:text-gray-200">
									Privacy policy
								</Link>
							</>
						}
						checked={consentGiven === "yes"}
						disabled={consentGiven === ""}
						onChange={(on) => setConsent(on ? "yes" : "no")}
					/>
					{cookies.saveFailed && <SaveFailed what="your cookie choice" onRetry={cookies.retry} />}
				</PagePart>
			</div>
		</SettingsPage>
	)
}

function SaveFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
	return (
		<p className="flex flex-wrap items-center gap-2 text-sm text-red-300">
			<span role="alert">Couldn't save {what}.</span>
			<button
				type="button"
				onClick={onRetry}
				className="h-8 cursor-pointer rounded-full bg-white px-3 font-semibold text-black hover:bg-gray-200"
			>
				Retry
			</button>
		</p>
	)
}

function SwitchRow({
	label,
	hint,
	checked,
	disabled,
	onChange,
}: {
	label: string
	hint: ReactNode
	checked: boolean
	disabled?: boolean
	onChange: (on: boolean) => void
}) {
	const id = useId()
	return (
		<div className="flex items-center gap-4 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
			<div className="min-w-0 flex-1">
				<p id={`${id}-label`} className="font-semibold text-gray-100">
					{label}
				</p>
				<p id={`${id}-hint`} className="text-sm text-gray-400">
					{hint}
				</p>
			</div>
			<Switch checked={checked} disabled={disabled} onChange={onChange} labelledBy={`${id}-label`} describedBy={`${id}-hint`} />
		</div>
	)
}
