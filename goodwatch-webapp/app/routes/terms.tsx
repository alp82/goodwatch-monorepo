import type { MetaFunction } from "@remix-run/node"
import { Link } from "@remix-run/react"
import { type PageMeta, buildMeta } from "~/utils/meta"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Terms of Service | GoodWatch",
		description:
			"Terms for using GoodWatch, including accounts, viewing records, share lists and connected AI apps.",
		url: "https://goodwatch.app/terms",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "GoodWatch Terms of Service",
	}
	return buildMeta({ pageMeta, items: [] })
}

const linkClass = "text-amber-500 underline hover:text-amber-400"
const headingClass = "mt-8 mb-3 text-xl font-semibold text-white"

export default function Terms() {
	return (
		<article className="mx-auto max-w-3xl px-4 py-8 pb-24 leading-relaxed text-gray-300 sm:px-8 md:py-12 [&_p]:my-3">
			<h1 className="mb-4 text-3xl font-semibold text-white">
				Terms of Service
			</h1>
			<p>Effective October 20, 2026</p>
			<p>
				These terms cover goodwatch.app and its connected-app integration.
				GoodWatch is operated by Alper Ortac in Kassel, Germany. You can reach
				us at{" "}
				<a className={linkClass} href="mailto:hello@goodwatch.app">
					hello@goodwatch.app
				</a>
				. By using GoodWatch, you agree to these terms.
			</p>

			<h2 className={headingClass}>What GoodWatch provides</h2>
			<p>
				GoodWatch is a free service for discovering movies and shows, comparing
				scores and streaming availability, and keeping your ratings, Wishlist
				and viewing progress. Recommendations and availability can change or be
				incomplete. Check the streaming provider before relying on an offer.
				GoodWatch does not play videos, sell streaming subscriptions or give you
				rights to third-party content.
			</p>

			<h2 className={headingClass}>Your account and use of the service</h2>
			<p>
				Keep your sign-in details secure and use only accounts and data you are
				authorized to access. If applicable law requires a parent or
				guardian&apos;s permission, obtain it before creating an account. Do not
				use GoodWatch unlawfully, infringe others&apos; rights, bypass access
				controls or usage limits, or interfere with the service.
			</p>

			<h2 className={headingClass}>Your records and share lists</h2>
			<p>
				You remain responsible for the information you add and the changes you
				request. You keep any rights you have in your contributions and permit
				GoodWatch to store, display and process them as needed to provide the
				features you use. Public share lists can be discovered by others;
				unlisted lists can be read by anyone with their link. Share only
				information you are entitled and willing to make available to that
				audience. Catalog information, images and other third-party material
				remain subject to their owners&apos; rights.
			</p>

			<h2 className={headingClass}>Connected AI apps</h2>
			<p>
				Connecting an app authorizes it to read your GoodWatch data. If you also
				grant write access, it can change viewing records, ratings, preferences
				and lists on your behalf. Review the requested permissions and proposed
				changes, especially deletions, bulk changes and public sharing. Write
				permission does not authorize changes you did not request.
			</p>
			<p>
				You can revoke access in{" "}
				<Link className={linkClass} to="/settings/connected-apps">
					Connected apps
				</Link>
				. Signing out of GoodWatch alone does not revoke an app&apos;s access.
				Revocation stops future access; it does not remove information already
				provided to the app. Third-party apps and streaming providers have their
				own terms and privacy practices.
			</p>

			<h2 className={headingClass}>Privacy and help</h2>
			<p>
				Our{" "}
				<Link className={linkClass} to="/privacy">
					privacy policy
				</Link>{" "}
				explains how we handle personal data, retention and deletion requests.
				You can stop using GoodWatch at any time. For account deletion,
				corrections or problems with a connected app, visit{" "}
				<Link className={linkClass} to="/support">
					Support
				</Link>{" "}
				or email us.
			</p>

			<h2 className={headingClass}>Service changes and restrictions</h2>
			<p>
				We may update features or apply usage limits to maintain the service. We
				may restrict access when necessary to address misuse, security issues or
				legal requirements. Where permitted, we will explain the reason; contact
				us if you believe a restriction is a mistake. We will give reasonable
				notice of material changes to these terms, which apply prospectively,
				and update the effective date here.
			</p>

			<h2 className={headingClass}>Your legal rights</h2>
			<p>
				Nothing in these terms or our disclaimer excludes or limits mandatory
				consumer rights or liability that cannot lawfully be excluded or
				limited. This includes liability for intentional misconduct, gross
				negligence, and injury to life, body or health. Applicable law governs
				any rights or obligations not addressed here.
			</p>
		</article>
	)
}
