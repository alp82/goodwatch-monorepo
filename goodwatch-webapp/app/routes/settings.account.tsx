// Settings, Account and sign-in: who is signed in, one card per way of signing in (the email card changes the
// password), and Restart setup. Only what works today: no placeholders for controls not built yet.
import {
	ArrowPathIcon,
	CheckCircleIcon,
	EnvelopeIcon,
	KeyIcon,
} from "@heroicons/react/24/outline"
import type { MetaFunction } from "@remix-run/node"
import React from "react"
import { useSetUserSettings } from "~/routes/api.user-settings.set"
import { ChangePasswordSection } from "~/ui/settings/ChangePasswordSection"
import { SettingsPage } from "~/ui/settings/SettingsPage"
import { useUser } from "~/utils/auth"
import { useAuthClient } from "~/utils/auth-client"

const googleLogo = (
	<svg aria-hidden="true" viewBox="0 0 24 24" className="size-6">
		<path
			d="M12.0003 4.75C13.7703 4.75 15.3553 5.36002 16.6053 6.54998L20.0303 3.125C17.9502 1.19 15.2353 0 12.0003 0C7.31028 0 3.25527 2.69 1.28027 6.60998L5.27028 9.70498C6.21525 6.86002 8.87028 4.75 12.0003 4.75Z"
			fill="#EA4335"
		/>
		<path
			d="M23.49 12.275C23.49 11.49 23.415 10.73 23.3 10H12V14.51H18.47C18.18 15.99 17.34 17.25 16.08 18.1L19.945 21.1C22.2 19.01 23.49 15.92 23.49 12.275Z"
			fill="#4285F4"
		/>
		<path
			d="M5.26498 14.2949C5.02498 13.5699 4.88501 12.7999 4.88501 11.9999C4.88501 11.1999 5.01998 10.4299 5.26498 9.7049L1.275 6.60986C0.46 8.22986 0 10.0599 0 11.9999C0 13.9399 0.46 15.7699 1.28 17.3899L5.26498 14.2949Z"
			fill="#FBBC05"
		/>
		<path
			d="M12.0004 24.0001C15.2404 24.0001 17.9654 22.935 19.9454 21.095L16.0804 18.095C15.0054 18.82 13.6204 19.245 12.0004 19.245C8.8704 19.245 6.21537 17.135 5.2654 14.29L1.27539 17.385C3.25539 21.31 7.3104 24.0001 12.0004 24.0001Z"
			fill="#34A853"
		/>
	</svg>
)

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	return [
		{ title: "Account Settings | GoodWatch" },
		{
			description:
				"Change your GoodWatch password. All movie and tv show ratings and streaming providers on the same page",
		},
		{ name: "robots", content: "noindex, follow" },
	]
}

const card =
	"flex flex-col rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:p-6"
const button =
	"inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-gray-600 px-4 text-sm font-semibold text-gray-200 hover:border-gray-400 hover:text-white disabled:cursor-wait disabled:opacity-60"

/** One way to sign in: its mark, its name, the address it uses, and what can be done with it. */
function MethodCard({
	icon,
	name,
	detail,
	children,
}: {
	icon: React.ReactNode
	name: string
	detail: string | null
	children?: React.ReactNode
}) {
	return (
		<div className={card} data-sign-in-method={name}>
			<div className="flex items-center gap-4">
				<span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
					{icon}
				</span>
				<div className="min-w-0 flex-1">
					<p className="font-semibold text-white">{name}</p>
					{detail && <p className="truncate text-sm text-gray-400">{detail}</p>}
				</div>
				<CheckCircleIcon
					className="size-6 shrink-0 text-emerald-400"
					aria-label="In use"
				/>
			</div>
			{children}
		</div>
	)
}

function PasswordChange() {
	const [open, setOpen] = React.useState(false)
	return (
		<div className="mt-5 border-t border-white/10 pt-4">
			{open ? (
				<ChangePasswordSection onCancel={() => setOpen(false)} />
			) : (
				<button type="button" className={button} onClick={() => setOpen(true)}>
					<KeyIcon className="size-4" aria-hidden /> Change password
				</button>
			)}
		</div>
	)
}

export default function SettingsAccount() {
	const auth = useAuthClient()
	const { user } = useUser()
	const email = user?.email ?? null

	// How the member signs in: one card each, and only a member with a password can change it.
	const [methods, setMethods] = React.useState<("email" | "google")[] | null>(
		null,
	)
	React.useEffect(() => {
		let current = true
		auth.signInMethods().then((found) => {
			if (current) setMethods(found ?? [])
		})
		return () => {
			current = false
		}
	}, [auth])

	const setUserSettings = useSetUserSettings()
	const handleResetOnboardingFlag = () => {
		setUserSettings.mutate({
			settings: {
				onboarding_country_completed: "no",
				onboarding_streaming_completed: "no",
				onboarding_ratings_completed: "no",
			},
		})
	}

	return (
		<SettingsPage
			title="Account and sign-in"
			intro="How you sign in, your password, and starting setup again."
		>
			<div className="flex max-w-4xl flex-col gap-10">
				<section
					aria-label="Your account"
					className="flex flex-wrap items-center gap-5 rounded-2xl bg-gradient-to-br from-indigo-950 via-gray-900 to-gray-900 p-5 ring-1 ring-white/10 md:p-6"
				>
					<span
						aria-hidden="true"
						className="flex size-16 shrink-0 items-center justify-center rounded-full bg-indigo-800 text-2xl font-black text-white uppercase"
					>
						{(email ?? "?").slice(0, 1)}
					</span>
					<div className="min-w-0 flex-1">
						<p className="text-sm text-gray-400">Signed in as</p>
						<p className="truncate text-xl font-black text-white md:text-2xl">
							{email}
						</p>
					</div>
				</section>

				{methods?.length !== 0 && (
					<section className="flex flex-col gap-3">
						<div>
							<h2 className="text-lg font-bold text-white">How you sign in</h2>
							{methods && methods.length > 1 && (
								<p className="text-sm text-gray-400">
									Either way opens the same account.
								</p>
							)}
						</div>
						{methods === null ? (
							<p className="text-sm text-gray-500">Reading how you sign in…</p>
						) : (
							<div className="grid items-start gap-4 md:grid-cols-2">
								{methods.includes("email") && (
									<MethodCard
										icon={
											<EnvelopeIcon
												className="size-6 text-gray-300"
												aria-hidden
											/>
										}
										name="Email and password"
										detail={email}
									>
										<PasswordChange />
									</MethodCard>
								)}
								{methods.includes("google") && (
									<MethodCard
										icon={googleLogo}
										name="Google"
										detail={email ? `Signed in with ${email}` : null}
									/>
								)}
							</div>
						)}
					</section>
				)}

				<section className="flex flex-col gap-3">
					<h2 className="text-lg font-bold text-white">Start over</h2>
					<div className={`${card} md:flex-row md:items-center md:gap-6`}>
						<span className="mb-3 flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] ring-1 ring-white/10 md:mb-0">
							<ArrowPathIcon className="size-6 text-gray-300" aria-hidden />
						</span>
						<div className="min-w-0 flex-1">
							<p className="font-semibold text-white">Restart setup</p>
							<p className="text-sm text-gray-400">
								Go through the first steps again: your country, your services
								and your scores. Nothing you saved is lost.
							</p>
							<output
								aria-live="polite"
								className="mt-1 block text-sm text-gray-300 empty:hidden"
							>
								{setUserSettings.isSuccess
									? "Done. The first steps show up again."
									: setUserSettings.isError
										? "That didn't work. Try again in a moment."
										: ""}
							</output>
						</div>
						<button
							type="button"
							onClick={handleResetOnboardingFlag}
							disabled={setUserSettings.isPending}
							className={`${button} mt-3 self-start md:mt-0 md:self-center`}
						>
							Restart setup
						</button>
					</div>
				</section>
			</div>
		</SettingsPage>
	)
}
