import { discoveryReturnTo } from "~/utils/account-transfer"
import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { hasBrowserCookie, isCrawler } from "~/server/crawlers.server";
import CustomAuthForm, { AuthPanel } from "~/ui/auth/CustomAuthForm";
import { getSignInTitles } from "~/server/prototype-sign-in.server";
import { PrototypeSwitcher } from "~/ui/prototype/PrototypeSwitcher";
import { VARIANTS } from "~/ui/prototype-sign-in/variants";
import { FLIPS } from "~/ui/prototype-sign-in/Spotlight";
import { BORDERS, SHARED_CSS } from "~/ui/prototype-sign-in/shared";
import type { SignInTitle } from "~/ui/prototype-sign-in/types";
import { useSearchParams } from "@remix-run/react";
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
	// PROTOTYPE - poster pool for the redesign variants; empty in production.
	titles: SignInTitle[];
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

	const titles = process.env.NODE_ENV === "production" ? [] : await getSignInTitles();
	return json({ redirectUri, titles });
};

export default function SignInRedirectTo() {
	const { redirectUri, titles } = useLoaderData<LoaderData>();
	const [params] = useSearchParams();
	const { user } = useUser();
	const navigate = useNavigate();

	useEffect(() => {
		if (user?.id) {
			navigate(discoveryReturnTo(redirectUri));
		}
	}, [user, navigate, redirectUri]);

	// PROTOTYPE - redesign variants (?variant=), dev only. Production keeps the current page.
	const key = params.get("variant") ?? Object.keys(VARIANTS)[0];
	const names = Object.fromEntries(Object.entries(VARIANTS).map(([k, v]) => [k, v.name]));
	if (!titles.length || key === "current" || !VARIANTS[key]) {
		return (
			<>
				<CustomAuthForm mode="sign-in" redirectTo={redirectUri} />
				{titles.length > 0 && <PrototypeSwitcher variants={names} />}
			</>
		);
	}
	const { View } = VARIANTS[key];
	return (
		<>
			<style dangerouslySetInnerHTML={{ __html: SHARED_CSS }} />
			<View key={key} titles={titles} form={<AuthPanel mode="sign-in" redirectTo={redirectUri} glass hideHeading />} />
			<PrototypeSwitcher variants={names} />
			<PrototypeSwitcher variants={BORDERS} param="border" arrowKeys={["ArrowUp", "ArrowDown"]} position="bottom-6 left-6 scale-90 origin-bottom-left" />
			<PrototypeSwitcher variants={FLIPS} param="flip" arrowKeys={[",", "."]} position="bottom-20 right-6 scale-90 origin-bottom-right" />
		</>
	);
}
