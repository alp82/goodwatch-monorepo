import { Link } from "@remix-run/react"
import { useCookieConsent } from "~/routes/api.user-settings.get"
import { useSetUserSettings } from "~/routes/api.user-settings.set"

export const CookieConsent = () => {
	const { consentGiven, setConsentGiven } = useCookieConsent()

	const setUserSettings = useSetUserSettings()
	const setConsent = (consent: "yes" | "no") => {
		localStorage.setItem("cookie_consent", consent)
		setUserSettings.mutate({
			settings: {
				cookie_consent: consent,
			},
		})
		setConsentGiven(consent)
	}
	const handleAcceptCookies = () => {
		setConsent("yes")
	}
	const handleDeclineCookies = () => {
		setConsent("no")
	}

	return (
		<>
			{consentGiven === "undecided" ? (
				<div className="fixed z-[200] bottom-0 left-1/2 transform -translate-x-1/2 w-full sm:max-w-4xl transition-transform duration-75">
					<div className=" m-2 bg-slate-900 border-4 border-slate-700 rounded-lg text-gray-200">
						<div className="grid gap-2">
							<div className="border-b border-slate-700 h-14 flex items-center justify-between p-4 text-2xl ">
								<h3 className="font-medium">We use cookies</h3>
								<span>🍪</span>
							</div>
							<div className="flex flex-col sm:flex-row justify-between">
								<div className="p-4">
									<p className="flex flex-col gap-2 text-base font-normal">
										<span>
											This website uses cookies to ensure you get the best
											experience on our website.
										</span>
										<Link
											className="text-xs underline"
											to="/privacy"
											prefetch="viewport"
										>
											Learn more about our privacy policy
										</Link>
									</p>
								</div>
								<div className="flex flex-col sm:flex-row items-center gap-4 p-4 py-5 bg-background/20 text-lg">
									<button
										type="button"
										className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 ring-1 ring-inset ring-gray-600 focus:z-10"
										onClick={handleDeclineCookies}
									>
										Decline
									</button>
									<button
										type="button"
										className="w-full py-2 px-4  bg-blue-800 hover:bg-blue-700 ring-1 ring-inset ring-gray-600 focus:z-10 font-semibold"
										onClick={handleAcceptCookies}
									>
										Accept
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			) : null}
		</>
	)
}
