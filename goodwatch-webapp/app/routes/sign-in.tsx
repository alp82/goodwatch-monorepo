import type {
	LoaderFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useSupabase, useUser } from "~/utils/auth";
import loading = toast.loading;
import { Spinner } from "~/ui/wait/Spinner";
import type { ColorName } from "~/utils/color";

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	};
}

export const meta: MetaFunction = () => {
	return [
		{ title: "Sign In | GoodWatch" },
		{
			description:
				"Sign in to GoodWatch. All movie and tv show ratings and streaming providers on the same page",
		},
	];
};

export type LoaderData = {
	redirectUri: string;
};

export const loader: LoaderFunction = async ({
	request,
}: LoaderFunctionArgs) => {
	const url = new URL(request.url);
	const redirectUri = url.searchParams.get("redirectTo") || "";

	return {
		redirectUri,
	};
};

export default function SignInRedirectTo() {
	const { redirectUri } = useLoaderData<LoaderData>();

	const [redirectTo, setRedirectTo] = useState("");
	useEffect(() => {
		setRedirectTo(`${window.location.origin}${redirectUri}`);
	}, [redirectUri]);

	const { user, loading } = useUser();
	const { supabase } = useSupabase();

	let content = null;
	let color: ColorName = "gray";
	if (!supabase) {
		content = (
			<p>
				Sign In currently not available. Please contact support if this issue
				persists.
			</p>
		);
	} else if (loading) content = <Spinner size="medium" />;
	else if (user?.id) {
		color = "green";
		content = (
			<p className="flex gap-2 items-center justify-center">
				🎉 <span className="font-semibold">You successfully logged in.</span>{" "}
				Now you can return to
				<Link to="/">
					<button
						type="button"
						className="
						px-2 py-1
						bg-indigo-800 hover:bg-indigo-700
						border-2 border-indigo-700 rounded
					"
					>
						Home
					</button>
				</Link>
			</p>
		);
	} else
		content = (
			<Auth
				supabaseClient={supabase}
				appearance={{ theme: ThemeSupa }}
				theme="dark"
				providers={["google"]}
				redirectTo={redirectTo}
			/>
		);

	return (
		<div className={`
			mt-16 mx-auto p-8 max-w-xl
			text-center
			rounded-xl shadow-black/70
			bg-${color}-950/70 shadow-xl
		`}>
			{content}
		</div>
	);
}
