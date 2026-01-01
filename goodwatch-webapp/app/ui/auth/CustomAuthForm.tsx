import { useState } from "react"
import { Link, useNavigate } from "@remix-run/react"
import { toast } from "react-toastify"
import { useSupabase } from "~/utils/auth"
import { Spinner } from "~/ui/wait/Spinner"

interface CustomAuthFormProps {
	mode: "sign-in" | "sign-up"
	redirectTo?: string
}

export default function CustomAuthForm({ mode, redirectTo }: CustomAuthFormProps) {
	const { supabase } = useSupabase()
	const navigate = useNavigate()
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [loading, setLoading] = useState(false)
	const [oauthLoading, setOAuthLoading] = useState(false)
	const [rememberMe, setRememberMe] = useState(false)

	const handleEmailAuth = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!supabase) return

		setLoading(true)
		try {
			if (mode === "sign-up") {
				const { error, data } = await supabase.auth.signUp({
					email,
					password,
					options: {
						emailRedirectTo: `${window.location.origin}${redirectTo || "/"}`,
					},
				})
				if (error) throw error
				
				// Check if email confirmation is required
				if (data.user && !data.user.identities?.length) {
					toast.success("Account created! Please check your email to confirm your account.")
				} else if (data.session) {
					// User is automatically signed in
					toast.success("Account created successfully!")
					navigate(redirectTo || "/")
				} else {
					toast.success("Check your email to confirm your account!")
				}
				
				// Reset form
				setEmail("")
				setPassword("")
			} else {
				const { error, data } = await supabase.auth.signInWithPassword({
					email,
					password,
				})
				if (error) throw error
				
				// Note: Supabase handles session persistence automatically
				// The remember me option is mainly for UX at this point
				// Future implementation could use custom session storage
				
				toast.success("Welcome back!")
				navigate(redirectTo || "/")
			}
		} catch (error: any) {
			console.error("Auth error:", error)
			// Provide more specific error messages
			toast.error(error.message || "An error occurred")
		} finally {
			setLoading(false)
		}
	}

	const handleGoogleSignIn = async () => {
		if (!supabase) return

		setOAuthLoading(true)
		try {
			const { error } = await supabase.auth.signInWithOAuth({
				provider: "google",
				options: {
					redirectTo: `${window.location.origin}${redirectTo || "/"}`,
					queryParams: {
						access_type: rememberMe ? "offline" : "online",
						prompt: "consent",
					},
				},
			})
			if (error) throw error
		} catch (error: any) {
			console.error("OAuth error:", error)
			toast.error(error.message || "Failed to sign in with Google")
		} finally {
			setOAuthLoading(false)
		}
	}

	return (
		<div className="min-h-screen flex bg-gray-900">
			{/* Left side - Form */}
			<div className="flex-1 flex items-center justify-center p-8 lg:p-16">
				<div className="flex flex-col gap-8 w-full max-w-md">
					<div className="text-center">
						<h1 className="text-4xl font-bold text-white mb-2">
							{mode === "sign-up" ? "Create Account" : "Sign In"}
						</h1>
						<p className="text-gray-400">
							{mode === "sign-up"
								? "Join GoodWatch to find your next favorite movies and shows"
								: "Welcome back to GoodWatch"}
						</p>
					</div>

					<button
						onClick={handleGoogleSignIn}
						disabled={oauthLoading}
						className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-300 border border-gray-700 text-lg text-black font-medium rounded-lg transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{oauthLoading ? (
							<svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						) : (
							<svg viewBox="0 0 48 48" width="22px" height="22px">
								<path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
								<path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
								<path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path>
								<path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
							</svg>
						)}
						<span>
							{mode === "sign-up" ? "Sign up with Google" : "Sign in with Google"}
						</span>
					</button>
					
					<div className="my-2">
						<div className="relative">
							<div className="absolute inset-0 flex items-center">
								<div className="w-full border-t border-gray-700" />
							</div>
							<div className="relative flex justify-center text-sm">
								<span className="px-2 bg-gray-900 text-gray-400">Or continue with</span>
							</div>
						</div>
					</div>

					<form onSubmit={handleEmailAuth} className="space-y-6">
						<div>
							<label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
								Email address
							</label>
							<input
								id="email"
								name="email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
								placeholder="you@example.com"
							/>
						</div>

						<div>
							<label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
								Password
							</label>
							<input
								id="password"
								name="password"
								type="password"
								autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
								required
								minLength={10}
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
								placeholder="••••••••"
							/>
							{mode === "sign-up" && password && password.length < 6 && (
								<p className="mt-2 text-sm text-amber-400">Password must be at least 6 characters</p>
							)}
						</div>

						{mode === "sign-in" && (
							<div className="flex items-center mt-4">
								<input
									id="remember-me"
									name="remember-me"
									type="checkbox"
									checked={rememberMe}
									onChange={(e) => setRememberMe(e.target.checked)}
									className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-amber-600 focus:ring-amber-500 focus:ring-2"
								/>
								<label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
									Remember me
								</label>
							</div>
						)}

						<button
							type="submit"
							disabled={loading || (mode === "sign-up" && password.length < 6)}
							className="w-full flex justify-center items-center px-4 py-3 bg-amber-700 hover:bg-amber-600 disabled:bg-gray-700 text-white font-semibold rounded-lg transition duration-200 disabled:cursor-not-allowed cursor-pointer"
						>
							{loading ? <Spinner size="small" /> : mode === "sign-up" ? "Sign Up" : "Sign In"}
						</button>
					</form>

					<div className="text-center">
						{mode === "sign-up" ? (
							<p className="text-gray-400">
								Already have an account?{" "}
								<Link to="/sign-in" className="text-amber-500 hover:text-amber-400 font-medium">
									Sign in
								</Link>
							</p>
						) : (
							<>
								<p className="text-gray-400">
									<Link to="/forgot-password" className="text-amber-500 hover:text-amber-400 font-medium">
										Forgot your password?
									</Link>
								</p>
								<p className="text-gray-400 mt-2">
									Don't have an account?{" "}
									<Link to="/sign-up" className="text-amber-500 hover:text-amber-400 font-medium">
										Sign up
									</Link>
								</p>
							</>
						)}
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
