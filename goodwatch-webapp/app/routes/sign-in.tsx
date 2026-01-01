import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import CustomAuthForm from "~/ui/auth/CustomAuthForm";
import { useUser } from "~/utils/auth";
import { useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import { type PageMeta, buildMeta } from "~/utils/meta";

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	};
}

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
	const redirectUri = url.searchParams.get("redirectTo") || "";

	return json({ redirectUri });
};

export default function SignInRedirectTo() {
	const { redirectUri } = useLoaderData<LoaderData>();
	const { user } = useUser();
	const navigate = useNavigate();

	useEffect(() => {
		if (user?.id) {
			navigate(redirectUri || "/");
		}
	}, [user, navigate, redirectUri]);

	return <CustomAuthForm mode="sign-in" redirectTo={redirectUri} />;
}
