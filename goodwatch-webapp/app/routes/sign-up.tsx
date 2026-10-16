import { getAuthPosters } from "~/server/auth-posters.server"
import type { AuthPoster } from "~/ui/auth/PosterSpotlight"
import { discoveryReturnTo } from "~/utils/account-transfer"
import type { LoaderFunction, LoaderFunctionArgs, MetaFunction } from "@remix-run/node"
import { json, redirect } from "@remix-run/node"
import { Link, useLoaderData, useNavigate } from "@remix-run/react"
import { hasBrowserCookie, isCrawler } from "~/server/crawlers.server"
import { useUser } from "~/utils/auth"
import { type FormEvent, useEffect, useState } from "react"
import { type PageMeta, buildMeta } from "~/utils/meta"
import { type AuthFailure, PASSWORD_MIN, useAuthClient } from "~/utils/auth-client"
import { useAuthHref } from "~/utils/auth-href"
import { useGuestInteractions } from "~/utils/guest-progress"
import {
	AuthSplit,
	EmailField,
	GoogleButton,
	Heading,
	Notice,
	OrDivider,
	PasswordField,
	PasswordRule,
	PrimaryButton,
	ServiceNotice,
	textLink,
} from "~/ui/auth/kit"

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Sign Up | GoodWatch",
		description: "Create your GoodWatch account. All movie and tv show ratings and streaming providers on the same page",
		url: "https://goodwatch.app/sign-up",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Sign up for GoodWatch",
	}

	return buildMeta({ pageMeta, items: [] })
}

export type LoaderData = {
	redirectUri: string
	posters: AuthPoster[]
}

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	// Every page links here with its own return page, which is an endless set of URLs for a crawler. One that names
	// itself is sent to the bare page for good; a visitor without the cookie that pages set with a script (a crawler
	// pretending to be a browser) only this time.
	if (url.searchParams.has("redirectTo")) {
		if (isCrawler(request)) return redirect("/sign-up", 301)
		if (!hasBrowserCookie(request))
			return redirect("/sign-up", {
				status: 302,
				headers: { "Cache-Control": "private, no-store" },
			})
	}
	const redirectUri = url.searchParams.get("redirectTo") || ""

	return json({ redirectUri, posters: await getAuthPosters() })
}

/** What the "Check your inbox" page knows from here: the address, and where a confirmed account goes. */
export type SentState = { email: string; returnTo: string }

export default function SignUpRoute() {
	const { redirectUri } = useLoaderData<LoaderData>()
	const { user } = useUser()
	const navigate = useNavigate()
	const auth = useAuthClient()
	const authHref = useAuthHref()

	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [busy, setBusy] = useState(false)
	const [googleBusy, setGoogleBusy] = useState(false)
	const [failure, setFailure] = useState<AuthFailure | null>(null)

	useEffect(() => {
		if (user?.id) {
			navigate(discoveryReturnTo(redirectUri))
		}
	}, [user, navigate, redirectUri])

	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (busy) return
		setBusy(true)
		setFailure(null)
		const returnTo = discoveryReturnTo(redirectUri)
		const result = await auth.signUp({ email, password, returnTo })
		setBusy(false)
		if (!result.ok) {
			// "invalid" is an address the server turned away (it never says an account exists); show the rule again.
			setFailure(result.failure)
			return
		}
		navigate("/verify-email?state=sent", { state: { email, returnTo } satisfies SentState })
	}

	const google = async () => {
		setGoogleBusy(true)
		setFailure(null)
		const result = await auth.google(redirectUri)
		if (!result.ok) {
			setFailure(result.failure)
			setGoogleBusy(false)
		}
	}

	return (
		<AuthSplit>
			<Heading srOnly title="Create your account" sub="Free. Your ratings, Wishlist and shows, on every device." />
			<GuestDataNotice />
			<GoogleButton onClick={google} busy={googleBusy} />
			<OrDivider />
			{failure === "password" && <Notice tone="error">Choose a password with at least {PASSWORD_MIN} characters.</Notice>}
			{failure === "invalid" && <Notice tone="error">That didn't work. Check the email address and try again.</Notice>}
			<ServiceNotice failure={failure} />
			<form method="post" onSubmit={submit} className="space-y-5">
				<EmailField value={email} onChange={setEmail} error={failure === "invalid"} />
				<PasswordField value={password} onChange={setPassword} isNew error={failure === "password"} hint={<PasswordRule password={password} />} />
				<PrimaryButton busy={busy} disabled={password.length < PASSWORD_MIN}>
					Create account
				</PrimaryButton>
				<p className="text-center text-xs text-gray-500">
					By creating an account you agree to the{" "}
					<Link to="/privacy" className="underline hover:text-gray-300">
						Privacy Policy
					</Link>
					.
				</p>
			</form>
			<p className="text-center text-gray-400">
				Already have an account?{" "}
				<Link rel="nofollow" to={authHref("sign-in", redirectUri || undefined)} className={textLink}>
					Sign in
				</Link>
			</p>
		</AuthSplit>
	)
}

// What a guest made in this browser and the new account takes along (the account transfer moves it on first sign-in).
function GuestDataNotice() {
	const interactions = useGuestInteractions()
	const ratings = interactions.filter((i) => i.type === "score").length
	const wishlist = interactions.filter((i) => i.type === "plan").length
	if (!ratings && !wishlist) return null
	const parts = [
		ratings ? `${ratings} ${ratings === 1 ? "rating" : "ratings"}` : null,
		wishlist ? `${wishlist} Wishlist ${wishlist === 1 ? "title" : "titles"}` : null,
	].filter(Boolean)
	return (
		<Notice tone="ok">
			<span className="font-semibold">
				Your {parts.join(" and ")} {ratings + wishlist === 1 ? "comes" : "come"} along.
			</span> We move them from this browser into your new account.
		</Notice>
	)
}
