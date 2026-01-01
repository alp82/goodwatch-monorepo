import type { LoaderFunction, LoaderFunctionArgs, MetaFunction, ActionFunction } from "@remix-run/node"
import { json } from "@remix-run/node"
import { Form, Link, useActionData, useLoaderData, useNavigate } from "@remix-run/react"
import { useState, useEffect } from "react"
import { toast } from "react-toastify"
import { createServerClient } from "@supabase/ssr"
import { parse, serialize } from "@supabase/ssr"
import { type PageMeta, buildMeta } from "~/utils/meta"

export function headers() {
	return {
		"Cache-Control": "max-age=300, s-maxage=1800, stale-while-revalidate=7200, stale-if-error=86400",
	}
}

export const meta: MetaFunction = () => {
	const pageMeta: PageMeta = {
		title: "Reset Password | GoodWatch",
		description: "Reset your GoodWatch password",
		url: "https://goodwatch.app/reset-password",
		image: "https://goodwatch.app/images/heroes/hero-movies.png",
		alt: "Reset Password - GoodWatch",
	}

	return buildMeta({ pageMeta, items: [] })
}

export type LoaderData = {
	error?: string
}

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
	const url = new URL(request.url)
	const error = url.searchParams.get("error")

	return json({ error: error || undefined })
}

export const action: ActionFunction = async ({ request }: LoaderFunctionArgs) => {
	const formData = await request.formData()
	const password = formData.get("password") as string
	const code = formData.get("code") as string

	if (!password || !code) {
		return json({ error: "Password and reset code are required" }, { status: 400 })
	}

	if (password.length < 6) {
		return json({ error: "Password must be at least 6 characters" }, { status: 400 })
	}

	const cookies = parse(request.headers.get("Cookie") ?? "")
	const headers = new Headers()
	const supabase = createServerClient(
		process.env.SUPABASE_URL!,
		process.env.SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(key) {
					return cookies[key]
				},
				set(key, value, options) {
					headers.append("Set-Cookie", serialize(key, value, options))
				},
				remove(key, options) {
					headers.append("Set-Cookie", serialize(key, "", options))
				},
			},
		},
	)

	const { error } = await supabase.auth.exchangeCodeForSession(code)

	if (error) {
		return json({ error: "Invalid or expired reset code" }, { status: 400 })
	}

	const { error: updateError } = await supabase.auth.updateUser({
		password,
	})

	if (updateError) {
		return json({ error: updateError.message }, { status: 400 })
	}

	return json(
		{ success: true },
		{
			headers,
		}
	)
}

export default function ResetPassword() {
	const { error: loaderError } = useLoaderData<LoaderData>()
	const actionData = useActionData<typeof action>()
	const navigate = useNavigate()
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [code, setCode] = useState("")

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search)
		const codeParam = urlParams.get("code")
		if (codeParam) {
			setCode(codeParam)
		} else {
			navigate("/forgot-password")
		}
	}, [navigate])

	const message = actionData?.success ? "Password reset successfully! You can now sign in." : null
	const error = loaderError || actionData?.error

	return (
		<div className="min-h-screen flex bg-gray-900">
			{/* Left side - Form */}
			<div className="flex-1 flex items-center justify-center p-8 lg:p-16">
				<div className="w-full max-w-md">
					<div className="text-center mb-8">
						<h1 className="text-4xl font-bold text-white mb-2">Reset Password</h1>
						<p className="text-gray-400">
							Enter your new password below.
						</p>
					</div>

					{message && (
						<div className="mb-6 p-4 bg-green-900/50 border border-green-700 rounded-lg">
							<p className="text-green-300 text-sm">{message}</p>
							<Link to="/sign-in" className="text-green-300 hover:text-green-200 underline text-sm mt-2 inline-block">
								Go to sign in
							</Link>
						</div>
					)}

					{error && (
						<div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg">
							<p className="text-red-300 text-sm">{error}</p>
						</div>
					)}

					{!actionData?.success && (
						<Form
							method="post"
							onSubmit={() => setIsSubmitting(true)}
							className="space-y-6"
						>
							<input type="hidden" name="code" value={code} />
							
							<div>
								<label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
									New Password
								</label>
								<input
									id="password"
									name="password"
									type="password"
									autoComplete="new-password"
									required
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
									placeholder="••••••••"
								/>
							</div>

							<div>
								<label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
									Confirm New Password
								</label>
								<input
									id="confirmPassword"
									name="confirmPassword"
									type="password"
									autoComplete="new-password"
									required
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
									placeholder="••••••••"
								/>
								{password !== confirmPassword && confirmPassword && (
									<p className="mt-2 text-sm text-red-400">Passwords do not match</p>
								)}
							</div>

							<button
								type="submit"
								disabled={isSubmitting || password !== confirmPassword || password.length < 6}
								className="w-full flex justify-center items-center px-4 py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 text-white font-semibold rounded-lg transition duration-200 disabled:cursor-not-allowed cursor-pointer"
							>
								{isSubmitting ? (
									<svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
								) : (
									"Reset Password"
								)}
							</button>
						</Form>
					)}

					<div className="mt-8 text-center">
						<p className="text-gray-400">
							<Link to="/sign-in" className="text-amber-500 hover:text-amber-400 font-medium">
								Back to sign in
							</Link>
						</p>
					</div>
				</div>
			</div>

			{/* Right side - Imagery/Video */}
			<div className="hidden lg:block lg:flex-1 relative shadow-xl overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-br from-green-600/20 to-orange-600/20 z-10" />
				<img
					src="/images/hooks/sign-up-hook.png"
					alt="Movies and Shows"
					className="absolute inset-0 w-full h-full object-cover opacity-25"
				/>
				<div className="absolute inset-0 flex items-center justify-center z-20">
					<div className="text-center text-white p-8">
						<h2 className="text-5xl font-bold mb-8">
							Your Personal Movie Guide
						</h2>
						<p className="text-xl text-gray-200 max-w-md mx-auto">
							Track, rate, and discover your next favorite movies and shows all in one place.
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}
