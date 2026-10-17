// "Change password" in Account and sign-in. With the cut-over notice on (AUTH_MAINTENANCE, #552) the section says so
// instead of showing its fields: a new password would not reach the final export of the Supabase users.
import React from "react";
import SubmitButton from "~/ui/button/SubmitButton";
import { MaintenanceMessage } from "~/ui/auth/kit";
import { PasswordInput } from "~/ui/form/PasswordInput";
import { useSupabase } from "~/utils/auth";
import { PASSWORD_MIN, useAuthClient } from "~/utils/auth-client";

export function ChangePasswordSection() {
	const { betterAuth, maintenance } = useSupabase();
	const auth = useAuthClient();

	const [currentPassword, setCurrentPassword] = React.useState("");
	const [password, setPassword] = React.useState("");
	const [status, setStatus] = React.useState<
		"idle" | "loading" | "success" | "error" | "maintenance"
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
			// A page that a cache served from before the notice came on: it says so now.
			if (result.failure === "maintenance") {
				setStatus("maintenance");
				return;
			}
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

	return (
		<section className="flex flex-col gap-2">
			<h3 className="font-semibold text-white">Change password</h3>

			{maintenance || status === "maintenance" ? (
				<MaintenanceMessage />
			) : (
				<>
					{status === "success" ? (
						<p className="py-3 px-5 text-base border-l-8 border-green-700 text-green-200 bg-green-900">
							Password changed. Other devices are signed out.
						</p>
					) : null}

					<div className="max-w-80 flex flex-col gap-2">
						{betterAuth && (
							<PasswordInput
								id="password-current"
								label="Current password"
								placeholder=""
								value={currentPassword}
								onChange={setCurrentPassword}
							/>
						)}

						<PasswordInput
							id="password-new"
							label="New password"
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
				</>
			)}
		</section>
	);
}
