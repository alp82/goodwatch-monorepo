import { getAuthPosters } from "~/server/auth-posters.server"
import type { AuthPoster } from "~/ui/auth/PosterSpotlight"
import { discoveryReturnTo } from "~/utils/account-transfer"
import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSearchParams } from "@remix-run/react";
import { hasBrowserCookie, isCrawler } from "~/server/crawlers.server";
import { useUser } from "~/utils/auth";
import { type FormEvent, useEffect, useState } from "react";
import { type PageMeta, buildMeta } from "~/utils/meta";
import { type AuthFailure, useAuthClient } from "~/utils/auth-client";
import { useAuthHref } from "~/utils/auth-href";
import {
	AuthSplit,
	EmailField,
	GoogleButton,
	Heading,
	Notice,
	OrDivider,
	PasswordField,
	PrimaryButton,
	ServiceNotice,
	TextLink,
	textLink,
} from "~/ui/auth/kit";
import { Link } from "@remix-run/react";
import { SIGN_IN_AGAIN_REASON } from "~/ui/auth/SignInAgainBanner";

export { pageHeaders as headers } from "~/utils/headers"

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Sign In | GoodWatch",
		description:
			"Sign in to GoodWatch. All movie and tv show ratings and streaming providers on the same page",
		url: "https://goodwatch.app/sign-in",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Sign in to GoodWatch",
	};

	return buildMeta({ pageMeta, items: [] });
};

export type LoaderData = {
	redirectUri: string;
	posters: AuthPoster[];
};

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url);
	// Every page links here with its own return page, which is an endless set of URLs for a crawler. One that names
	// itself is sent to the bare page for good; a visitor without the cookie that pages set with a script (a crawler
	// pretending to be a browser) only this time.
	if (url.searchParams.has("redirectTo")) {
		if (isCrawler(request)) return redirect("/sign-in", 301);
		if (!hasBrowserCookie(request))
			return redirect("/sign-in", {
				status: 302,
				headers: { "Cache-Control": "private, no-store" },
			});
	}
	const redirectUri = url.searchParams.get("redirectTo") || "";

	return json({ redirectUri, posters: await getAuthPosters() });
};

export default function SignIn() {
	const { redirectUri } = useLoaderData<LoaderData>();
	const [params] = useSearchParams();
	const again = params.get("reason") === SIGN_IN_AGAIN_REASON;
	const { user } = useUser();
	const navigate = useNavigate();
	const auth = useAuthClient();
	const authHref = useAuthHref();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [stay, setStay] = useState(true);
	const [busy, setBusy] = useState(false);
	const [googleBusy, setGoogleBusy] = useState(false);
	// A Google sign-in that came back with an error lands here.
	const [failure, setFailure] = useState<AuthFailure | "google" | null>(
		params.has("error") ? "google" : null,
	);

	useEffect(() => {
		if (user?.id) {
			navigate(discoveryReturnTo(redirectUri));
		}
	}, [user, navigate, redirectUri]);

	const submit = async (event: FormEvent) => {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		setFailure(null);
		const result = await auth.signIn({
			email,
			password,
			remember: stay,
			returnTo: discoveryReturnTo(redirectUri),
		});
		// A sign-in stays busy until the member arrives and the page moves on.
		if (!result.ok) {
			setFailure(result.failure);
			setBusy(false);
		}
	};

	const google = async () => {
		setGoogleBusy(true);
		setFailure(null);
		const result = await auth.google(redirectUri);
		if (!result.ok) {
			setFailure(result.failure);
			setGoogleBusy(false);
		}
	};

	return (
		<AuthSplit>
			<Heading
				title={again ? "Sign in again" : "Sign in"}
				sub={again ? undefined : "Welcome back to GoodWatch"}
			/>
			{again && (
				<Notice tone="info">
					<p className="font-semibold">GoodWatch has a new sign-in.</p>
					<p className="mt-1">
						Your ratings, Wishlist and shows are all still here. Sign in once
						with the same email and password, or with Google, and you're set.
					</p>
				</Notice>
			)}
			<GoogleButton onClick={google} busy={googleBusy} />
			<OrDivider />
			{failure === "invalid" && (
				<Notice tone="error">
					That email and password don't match, or the email isn't confirmed
					yet. Check both, or{" "}
					<TextLink to="/forgot-password">set a new password</TextLink>. New
					here and still waiting for the email?{" "}
					<TextLink to="/verify-email?state=resend">
						Send a new confirmation link
					</TextLink>
					.
				</Notice>
			)}
			{failure === "google" && (
				<Notice tone="error">
					Signing in with Google didn't finish. Try again, or sign in with your
					email.
				</Notice>
			)}
			<ServiceNotice failure={failure === "google" ? null : failure} />
			<form method="post" onSubmit={submit} className="space-y-5">
				<EmailField
					value={email}
					onChange={setEmail}
					error={failure === "invalid"}
				/>
				<PasswordField
					value={password}
					onChange={setPassword}
					error={failure === "invalid"}
					labelAside={
						<Link to="/forgot-password" className="text-sm text-amber-500 hover:text-amber-400">
							Forgot password?
						</Link>
					}
				/>
				<label className="flex items-center gap-2 text-sm text-gray-300">
					<input
						type="checkbox"
						name="remember"
						checked={stay}
						onChange={(e) => setStay(e.target.checked)}
						className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-amber-600 focus:ring-2 focus:ring-amber-500"
					/>
					Stay signed in on this device
				</label>
				<PrimaryButton busy={busy}>Sign in</PrimaryButton>
			</form>
			<p className="text-center text-gray-400">
				New to GoodWatch?{" "}
				<Link rel="nofollow" to={authHref("sign-up", redirectUri || undefined)} className={textLink}>
					Create an account
				</Link>
			</p>
		</AuthSplit>
	);
}
