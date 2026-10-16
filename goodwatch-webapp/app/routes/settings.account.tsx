import { EnvelopeIcon } from "@heroicons/react/24/solid";
import type { MetaFunction } from "@remix-run/node";
import React from "react";
import { useSetUserSettings } from "~/routes/api.user-settings.set";
import SubmitButton from "~/ui/button/SubmitButton";
import { PasswordInput } from "~/ui/form/PasswordInput";
import { SettingsSheet } from "~/ui/settings/SettingsSheet";
import { useSupabase } from "~/utils/auth";
import { PASSWORD_MIN, useAuthClient } from "~/utils/auth-client";

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

export { pageHeaders as headers } from "~/utils/headers"

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
	const { betterAuth } = useSupabase();
	const auth = useAuthClient();

	// How the member signs in: shown as icons, and only a member with a password can change it.
	const [methods, setMethods] = React.useState<("email" | "google")[]>([]);
	React.useEffect(() => {
		let current = true;
		auth.signInMethods().then((found) => {
			if (current && found) setMethods(found);
		});
		return () => {
			current = false;
		};
	}, [auth]);
	const userHasEmailIdentity = methods.includes("email");

	const [currentPassword, setCurrentPassword] = React.useState("");
	const [password, setPassword] = React.useState("");
	const [status, setStatus] = React.useState<
		"idle" | "loading" | "success" | "error"
	>("idle");
	const [errors, setErrors] = React.useState<string[]>([]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		setStatus("idle");
		setErrors([]);

		if (password.length < PASSWORD_MIN) {
			setErrors([`Choose a password with at least ${PASSWORD_MIN} characters`]);
			setStatus("error");
			return;
		}

		setStatus("loading");
		const result = await auth.changePassword(currentPassword, password);
		if (!result.ok) {
			setErrors([
				result.failure === "invalid"
					? betterAuth
						? "Your current password isn't right"
						: "The password could not be changed"
					: result.failure === "password"
						? `Choose a password with at least ${PASSWORD_MIN} characters`
						: result.failure === "throttled"
							? "Too many tries in a row. Wait a few minutes, then try again"
							: "Changing the password isn't working right now. Try again in a few minutes",
			]);
			setStatus("error");
			return;
		}

		setStatus("success");
		setCurrentPassword("");
		setPassword("");
	};

	const setUserSettings = useSetUserSettings();
	const handleResetOnboardingFlag = () => {
		setUserSettings.mutate({
			settings: {
				onboarding_country_completed: "no",
				onboarding_streaming_completed: "no",
				onboarding_ratings_completed: "no",
			},
		});
	};

	return (
		<SettingsSheet title="Account and sign-in">
			<div className="flex flex-col gap-8 text-base text-gray-300">
				<section className="flex flex-col gap-2">
					<h3 className="font-semibold text-white">Sign-in</h3>
					<div className="flex flex-wrap items-center gap-2">
						<span>You sign in with</span>
						{methods.map((provider) => (
							<span key={provider} className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-sm ring-1 ring-white/10">
								<span className="h-4 w-4">
									{provider === "google" ? googleLogo : <EnvelopeIcon aria-hidden="true" />}
								</span>
								{provider === "google" ? "Google" : "Email"}
							</span>
						))}
					</div>
				</section>

				{userHasEmailIdentity ? (
					<section className="flex flex-col gap-2">
						<h3 className="font-semibold text-white">Change password</h3>

						{status === "success" ? (
							<p className="py-3 px-5 text-base border-l-8 border-green-700 text-green-200 bg-green-900">
								Password changed. Other devices are signed out.
							</p>
						) : null}

						<div className="max-w-80 flex flex-col gap-2">
							{betterAuth && (
								<PasswordInput
									id="password-current"
									label="Current Password"
									placeholder=""
									value={currentPassword}
									onChange={setCurrentPassword}
								/>
							)}

							<PasswordInput
								id="password-new"
								label="New Password"
								placeholder={`at least ${PASSWORD_MIN} characters`}
								value={password}
								error={errors.length > 0 ? errors[0] : undefined}
								onChange={setPassword}
							/>

							<p className="text-sm text-gray-400">
								Other devices are signed out.
								{/* Apps connect through the new sign-in only (#570). */}
								{betterAuth && " Connected apps keep working."}
							</p>

							<SubmitButton
								loading={status === "loading"}
								onSubmit={handleSubmit}
							>
								Change Password
							</SubmitButton>
						</div>
					</section>
				) : null}

				<section className="flex flex-col gap-2">
					<h3 className="font-semibold text-white">Restart setup</h3>
					<p className="text-sm text-gray-400">
						Go through the first steps again: your country, your services and
						your scores. Nothing you saved is lost.
					</p>
					<div className="flex flex-wrap items-center gap-3">
						<button
							type="button"
							onClick={handleResetOnboardingFlag}
							disabled={setUserSettings.isPending}
							className="cursor-pointer rounded-lg border border-gray-600 px-3 py-2 text-sm font-semibold text-gray-200 hover:border-gray-400 hover:text-white disabled:cursor-wait disabled:opacity-60"
						>
							Restart setup
						</button>
						<output aria-live="polite" className="text-sm text-gray-400">
							{setUserSettings.isSuccess
								? "Done. The first steps show up again."
								: setUserSettings.isError
									? "That didn't work. Try again in a moment."
									: ""}
						</output>
					</div>
				</section>
			</div>
		</SettingsSheet>
	);
}
