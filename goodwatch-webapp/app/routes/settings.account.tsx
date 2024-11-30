import { EnvelopeIcon } from "@heroicons/react/24/solid";
import type { MetaFunction } from "@remix-run/node";
import React from "react";
import { useSetUserSettings } from "~/routes/api.user-settings.set";
import SubmitButton from "~/ui/button/SubmitButton";
import { PasswordInput } from "~/ui/form/PasswordInput";
import { Spinner } from "~/ui/wait/Spinner";
import { useSupabase, useUser } from "~/utils/auth";
import { useAutoFocus } from "~/utils/form";
import { validatePassword } from "~/utils/password";

const googleLogo = (
	<svg aria-hidden="true" viewBox="0 0 24 24">
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
);

export function headers() {
	return {
		"Cache-Control":
			"max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	};
}

export const meta: MetaFunction = () => {
	return [
		{ title: "Account Settings | GoodWatch" },
		{
			description:
				"Change your GoodWatch password. All movie and tv show ratings and streaming providers on the same page",
		},
	];
};

export default function SettingsAccount() {
	const autoFocusRef = useAutoFocus<HTMLInputElement>();
	const { supabase } = useSupabase();
	const { user } = useUser();

	const userIdentityProviders = (user?.identities || []).map(
		(identity) => identity.provider,
	);
	const userHasEmailIdentity = userIdentityProviders.some(
		(provider) => provider === "email",
	);

	const [password, setPassword] = React.useState("");
	const [confirmPassword, setConfirmPassword] = React.useState("");
	const [status, setStatus] = React.useState<
		"idle" | "loading" | "success" | "error"
	>("idle");
	const [errors, setErrors] = React.useState<string[]>([]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Reset status and errors
		setStatus("idle");
		setErrors([]);

		if (!supabase) return;

		// Validate password
		const validation = validatePassword(password);
		if (!validation.isValid) {
			setErrors(validation.errors);
			setStatus("error");
			return;
		}

		// Check if passwords match
		if (password !== confirmPassword) {
			setErrors(["Passwords do not match"]);
			setStatus("error");
			return;
		}

		// Simulate API call
		setStatus("loading");
		const { data, error } = await supabase.auth.updateUser({
			password,
		});

		if (error) {
			setErrors([error.message]);
			setStatus("error");
			return;
		}

		setStatus("success");
		setPassword("");
		setConfirmPassword("");
	};

	const setUserSettings = useSetUserSettings();
	const handleResetOnboardingFlag = () => {
		setUserSettings.mutate({
			settings: {
				onboarding_status: "incomplete",
			},
		});
	};

	return (
		<div className="px-2 md:px-4 lg:px-8">
			<div className="flex flex-col gap-4 text-lg lg:text-2xl text-gray-300">
				<h2 className="font-bold tracking-tight text-gray-100 text-base sm:text-lg md:text-xl lg:text-2xl">
					Account
				</h2>

				<div className="flex gap-2 items-center text-base md:text-lg">
					<span>You are logged in via:</span>
					{userIdentityProviders.map((provider) => (
						<span key={provider} className="h-5 w-5">
							{provider === "google" && (
								<span title="Google">{googleLogo}</span>
							)}
							{provider === "email" && <EnvelopeIcon title="Email" />}
						</span>
					))}
				</div>

				{userHasEmailIdentity ? (
					<>
						<h3 className="mt-8 font-bold tracking-tight text-gray-100 text-base md:text-lg lg:text-xl">
							Change Password
						</h3>

						{status === "success" ? (
							<p className="py-3 px-5 text-lg border-l-8 border-green-700 text-green-200 bg-green-900">
								Password changed successfully
							</p>
						) : null}

						<div className="max-w-80 flex flex-col gap-2">
							<PasswordInput
								id="password-new"
								label="New Password"
								placeholder="at least 10 characters"
								value={password}
								error={errors.length > 0 ? errors[0] : undefined}
								onChange={setPassword}
								ref={autoFocusRef}
							/>

							<PasswordInput
								id="password-repeat"
								label="Repeat Password"
								placeholder=""
								value={confirmPassword}
								error={errors.length > 0 ? errors[0] : undefined}
								onChange={setConfirmPassword}
							/>

							<SubmitButton
								loading={status === "loading"}
								onSubmit={handleSubmit}
							>
								Change Password
							</SubmitButton>
						</div>
					</>
				) : null}

				<h3 className="mt-8 font-bold tracking-tight text-gray-100 text-base md:text-lg lg:text-xl">
					Restart Onboarding
				</h3>

				<button
					type="button"
					className="
								flex items-center gap-2 flex-wrap max-w-80 px-4 py-2
								border border-slate-700 rounded-md bg-slate-800 hover:bg-slate-900
								text-xl text-gray-200 hover:text-white
								group
							"
					onClick={handleResetOnboardingFlag}
				>
					Select{" "}
					<span>
						<span className="font-extrabold text-emerald-300 group-hover:text-emerald-500">
							Country
						</span>
						,
					</span>
					<span className="font-extrabold text-sky-300 group-hover:text-skyd-500">
						Streaming
					</span>{" "}
					and{" "}
					<span className="font-extrabold text-rose-300 group-hover:text-rose-500">
						Scores
					</span>
				</button>

				<p className="max-w-80 py-2 px-5 text-sm border-l-8 border-blue-700 text-blue-200 bg-blue-900">
					Don't worry, you won't lose any previously saved settings.
				</p>
			</div>
		</div>
	);
}
