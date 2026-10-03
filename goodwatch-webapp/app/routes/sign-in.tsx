import { discoveryReturnTo } from "~/utils/account-transfer"
import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { hasBrowserCookie, isCrawler } from "~/server/crawlers.server";
import CustomAuthForm from "~/ui/auth/CustomAuthForm";
import { useUser } from "~/utils/auth";
import { useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import { type PageMeta, buildMeta } from "~/utils/meta";

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
		if (!hasBrowserCookie(request)) return redirect("/sign-in", 302);
	}
	const redirectUri = url.searchParams.get("redirectTo") || "";

	return json({ redirectUri });
};

export default function SignInRedirectTo() {
	const { redirectUri } = useLoaderData<LoaderData>();
	const { user } = useUser();
	const navigate = useNavigate();

	useEffect(() => {
		if (user?.id) {
			navigate(discoveryReturnTo(redirectUri));
		}
	}, [user, navigate, redirectUri]);

	return <CustomAuthForm mode="sign-in" redirectTo={redirectUri} />;
}
