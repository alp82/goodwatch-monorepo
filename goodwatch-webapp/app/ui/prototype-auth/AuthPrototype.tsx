// THROWAWAY #534. A = compact/task-first; B = split/context-first. No auth SDK, API, storage or real redirects.
import { useSearchParams } from "@remix-run/react"
import { type ReactNode, useEffect, useState } from "react"
import { GoodWatchWordmark } from "~/ui/brand/GoodWatchWordmark"

const screens = [
	"sign-in",
	"sign-up",
	"reset-request",
	"reset-new",
	"verify",
	"cutover",
	"consent",
	"connected",
] as const
type Screen = (typeof screens)[number]
const names: Record<Screen, string> = {
	"sign-in": "Sign in",
	"sign-up": "Sign up",
	"reset-request": "Reset request",
	"reset-new": "New password",
	verify: "Verification",
	cutover: "Cut-over",
	consent: "Consent",
	connected: "Connected apps",
}
const reads = [
	"Your watches and show progress",
	"Your Wishlist, ratings and Not interested titles",
	"Your taste, country and streaming services",
]
const writes = [
	"Log watches and update show progress",
	"Change your Wishlist, ratings and Not interested titles",
	"Change your country and streaming services",
	"Remove watches and undo changes",
]
const accountEmail = "alex@example.com"

export default function AuthPrototype() {
	const [params, setParams] = useSearchParams()
	const rawScreen = params.get("screen")
	const screen: Screen = screens.includes(rawScreen as Screen)
		? (rawScreen as Screen)
		: "sign-in"
	const variant = params.get("variant") === "B" ? "B" : "A"
	const scenario = params.get("state") ?? "default"
	const [email, setEmail] = useState(accountEmail)
	const [password, setPassword] = useState("")
	const [confirm, setConfirm] = useState("")
	const [showPassword, setShowPassword] = useState(false)
	const [message, setMessage] = useState("")
	const [outcome, setOutcome] = useState("")
	const [signedIn, setSignedIn] = useState(false)
	const [verified, setVerified] = useState(false)
	const [cutoverSeen, setCutoverSeen] = useState(false)
	const [apps, setApps] = useState<string[]>(["Claude", "ChatGPT"])
	const [disconnect, setDisconnect] = useState<string | null>(null)
	const [expanded, setExpanded] = useState<string | null>("Claude")
	const [accountTab, setAccountTab] = useState("initial")
	const currentTab =
		accountTab === "initial"
			? variant === "A"
				? "Connected apps"
				: "Account"
			: accountTab
	const [resendWait, setResendWait] = useState(0)

	function go(next: Screen, state?: string) {
		setParams(
			{ screen: next, variant, ...(state ? { state } : {}) },
			{ preventScrollReset: true },
		)
	}
	function toggleVariant() {
		setAccountTab("initial")
		setParams(
			{
				screen,
				variant: variant === "A" ? "B" : "A",
				...(scenario !== "default" ? { state: scenario } : {}),
			},
			{ preventScrollReset: true },
		)
	}
	useEffect(() => {
		setMessage("")
		setOutcome("")
		setDisconnect(null)
		setPassword("")
		setConfirm("")
		setShowPassword(false)
	}, [screen, scenario])
	useEffect(() => {
		if (resendWait <= 0) return
		const timer = window.setTimeout(() => setResendWait(resendWait - 1), 1000)
		return () => window.clearTimeout(timer)
	}, [resendWait])
	useEffect(() => {
		function keys(event: KeyboardEvent) {
			if (
				!(event.target instanceof HTMLElement) ||
				event.target.closest("input,textarea,select,[contenteditable]")
			)
				return
			if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
				event.preventDefault()
				toggleVariant()
			}
		}
		window.addEventListener("keydown", keys)
		return () => window.removeEventListener("keydown", keys)
	}, [toggleVariant])

	const emailField = (
		<label className="ap-field">
			Email
			<input
				type="email"
				autoComplete="email"
				required
				value={email}
				onChange={(e) => setEmail(e.target.value)}
			/>
		</label>
	)
	const passwordField = (newPassword = false) => (
		<label className="ap-field">
			{newPassword ? "New password" : "Password"}
			<span className="ap-input-wrap">
				<input
					type={showPassword ? "text" : "password"}
					aria-label={newPassword ? "New password" : "Password"}
					autoComplete={newPassword ? "new-password" : "current-password"}
					minLength={newPassword ? 12 : 1}
					required
					value={password}
					onChange={(e) => setPassword(e.target.value)}
				/>
				<button
					type="button"
					aria-label={showPassword ? "Hide password" : "Show password"}
					onClick={() => setShowPassword(!showPassword)}
				>
					{showPassword ? "Hide" : "Show"}
				</button>
			</span>
			{newPassword && (
				<small>Use at least 12 characters. A few words work well.</small>
			)}
		</label>
	)
	function completeSignIn(provider = "email") {
		setSignedIn(true)
		setCutoverSeen(true)
		if (scenario === "oauth") {
			go("consent")
			return
		}
		setOutcome(
			provider === "Google" ? "Signed in with Google" : "You're signed in",
		)
	}
	const reassurance = (
		<div className="ap-notice">
			<strong>Please sign in once more</strong>
			<p>
				We’ve updated GoodWatch’s sign-in. Use your usual email and password, or
				Google. Your ratings, Wishlist and show progress are still here.
			</p>
		</div>
	)
	const authTitle =
		screen === "sign-up" ? "Make it your GoodWatch" : "Good to have you back"
	const authForm = (
		<>
			{screen === "cutover" && !cutoverSeen && reassurance}
			{scenario === "oauth" && (
				<p className="ap-context">
					Sign in to connect Claude. You’ll review access next.
				</p>
			)}
			<p className="ap-eyebrow">
				{screen === "sign-up" ? "Your next great watch" : "Welcome back"}
			</p>
			<h1>{authTitle}</h1>
			<p className="ap-subtitle">
				{screen === "sign-up"
					? "Keep your Wishlist, ratings and show progress together."
					: "Your Wishlist and next episode are waiting."}
			</p>
			<button
				type="button"
				className="ap-google"
				onClick={() => {
					if (screen === "sign-up") {
						setSignedIn(true)
						setVerified(true)
						setOutcome("Your GoodWatch is ready")
					} else completeSignIn("Google")
				}}
			>
				<span aria-hidden="true">G</span>Continue with Google
			</button>
			<div className="ap-divider">or use your email</div>
			<form
				onSubmit={(e) => {
					e.preventDefault()
					if (scenario === "error") {
						setMessage(
							"That email and password don’t match. Try again or reset your password.",
						)
						return
					}
					screen === "sign-up" ? go("verify") : completeSignIn()
				}}
			>
				{emailField}
				{passwordField(screen === "sign-up")}
				{screen !== "sign-up" && (
					<div className="ap-form-row">
						<label className="ap-check">
							<input type="checkbox" defaultChecked />
							Keep me signed in
						</label>
						<button
							type="button"
							className="ap-link"
							onClick={() => go("reset-request")}
						>
							Forgot password?
						</button>
					</div>
				)}
				{screen === "sign-up" && (
					<p className="ap-small">
						We’ll email you a link to verify your address. Already tried
						GoodWatch? Your guest progress can come with you.
					</p>
				)}
				{message && (
					<p role="alert" className="ap-error">
						{message}
					</p>
				)}
				<button className="ap-primary" type="submit">
					{screen === "sign-up" ? "Create account" : "Sign in"}
				</button>
			</form>
			<p className="ap-bottom">
				{screen === "sign-up" ? "Already a member?" : "New to GoodWatch?"}{" "}
				<button
					type="button"
					className="ap-link"
					onClick={() => go(screen === "sign-up" ? "sign-in" : "sign-up")}
				>
					{screen === "sign-up" ? "Sign in" : "Create an account"}
				</button>
			</p>
		</>
	)
	const permissionGroups = (
		<div className="ap-permissions">
			<section>
				<h2>Read your GoodWatch</h2>
				<ul>
					{reads.map((text) => (
						<li key={text}>
							<span aria-hidden="true">✓</span>
							{text}
						</li>
					))}
				</ul>
			</section>
			<section>
				<h2>Change your GoodWatch</h2>
				<ul>
					{writes.map((text) => (
						<li key={text}>
							<span aria-hidden="true">↗</span>
							{text}
						</li>
					))}
				</ul>
			</section>
		</div>
	)
	const connectionIdentity = (
		<div className="ap-identity">
			<span className="ap-client-icon" aria-hidden="true">
				✳
			</span>
			<div>
				<strong>Claude</strong>
				<span>claude.ai</span>
			</div>
			<span className="ap-to" aria-hidden="true">
				→
			</span>
			<GoodWatchWordmark fontSize={23} />
		</div>
	)
	const consentActions = (
		<>
			<p className="ap-small">
				This connection stays active until you disconnect it in Settings →{" "}
				{variant === "A" ? "Connected apps" : "Account → Connected apps"}.
				Disconnecting stops future access; it doesn’t undo changes already made
				or erase information Claude has received.
			</p>
			<div className="ap-actions">
				<button
					type="button"
					className="ap-secondary"
					onClick={() => setOutcome("Connection cancelled")}
				>
					Cancel
				</button>
				<button
					type="button"
					className="ap-primary"
					onClick={() => {
						setApps((current) =>
							current.includes("Claude") ? current : [...current, "Claude"],
						)
						setOutcome("Claude is connected")
					}}
				>
					Allow access
				</button>
			</div>
		</>
	)

	let content: ReactNode
	if (outcome) {
		content = (
			<div className="ap-card ap-compact">
				<span className="ap-status-icon" aria-hidden="true">
					{outcome === "Connection cancelled" ? "×" : "✓"}
				</span>
				<h1>{outcome}</h1>
				<p className="ap-subtitle">
					{outcome === "Connection cancelled"
						? "No access was granted. You can close this window and return to Claude."
						: outcome === "Claude is connected"
							? "Return to Claude to use GoodWatch. You can review or disconnect this app in settings."
							: outcome === "Password updated"
								? "Your new password is ready. Sign in to continue."
								: outcome === "Keep browsing"
									? "GoodWatch is still open to explore. Sign in when you’re ready to return to your account."
									: "Your ratings, Wishlist and show progress are ready for you."}
				</p>
				<button
					type="button"
					className="ap-primary"
					onClick={() =>
						go(
							outcome === "Password updated" || outcome === "Keep browsing"
								? "sign-in"
								: "connected",
						)
					}
				>
					{outcome === "Password updated" || outcome === "Keep browsing"
						? "Sign in"
						: "View connected apps"}
				</button>
				<button
					type="button"
					className="ap-link ap-bottom"
					onClick={() => {
						setOutcome("")
						go("sign-in")
					}}
				>
					Back to sign in
				</button>
			</div>
		)
	} else if (["sign-in", "sign-up", "cutover"].includes(screen)) {
		if (screen === "cutover" && variant === "B" && !cutoverSeen)
			content = (
				<div className="ap-card ap-compact">
					<p className="ap-eyebrow">A quick account update</p>
					<h1>
						Same GoodWatch.
						<br />
						One more sign-in.
					</h1>
					<p className="ap-subtitle">
						We’ve updated how you sign in. Your account and everything you’ve
						marked are still here.
					</p>
					<ul className="ap-reassurance">
						<li>✓ Keep your usual email and password</li>
						<li>✓ Continue with Google if that’s how you joined</li>
						<li>✓ Your ratings, Wishlist and show progress stay with you</li>
					</ul>
					<button
						type="button"
						className="ap-primary"
						onClick={() => {
							setCutoverSeen(true)
							go("sign-in")
						}}
					>
						Sign in again
					</button>
					<button
						type="button"
						className="ap-link ap-bottom"
						onClick={() => {
							setCutoverSeen(true)
							setOutcome("Keep browsing")
						}}
					>
						Keep browsing for now
					</button>
				</div>
			)
		else if (variant === "B")
			content = (
				<div className="ap-split">
					<aside className="ap-story">
						<p className="ap-eyebrow">Your kind of evening</p>
						<h2>
							Less searching.
							<br />
							More watching.
						</h2>
						<p>
							One place for what you love, what’s next and where to watch it.
						</p>
						<div className="ap-taste">
							<span className="ap-small">YOUR GOODWATCH</span>
							<div>
								<span>Wishlist</span>
								<strong>All the ones you want to see</strong>
							</div>
							<div>
								<span>My shows</span>
								<strong>Pick up at your next episode</strong>
							</div>
							<div>
								<span>Your taste</span>
								<strong>Discover something that fits</strong>
							</div>
						</div>
					</aside>
					<div className="ap-form-panel">{authForm}</div>
				</div>
			)
		else content = <div className="ap-card ap-compact">{authForm}</div>
	} else if (screen === "reset-request")
		content = (
			<div className="ap-card ap-compact">
				<p className="ap-eyebrow">Back to your account</p>
				<h1>
					{scenario === "sent" ? "Check your inbox" : "Forgot your password?"}
				</h1>
				<p className="ap-subtitle">
					{scenario === "sent"
						? `If there’s an account for ${email}, we’ll send a link to reset its password.`
						: "Enter the email you use for GoodWatch and we’ll send a reset link."}
				</p>
				{scenario !== "sent" ? (
					<form
						onSubmit={(e) => {
							e.preventDefault()
							go("reset-request", "sent")
						}}
					>
						{emailField}
						<button type="submit" className="ap-primary">
							Send reset link
						</button>
					</form>
				) : (
					<>
						<p className="ap-small">
							Check your spam folder too. Signed up with Google? Continue with
							Google on the sign-in page.
						</p>
						<button
							type="button"
							className="ap-secondary"
							onClick={() => {
								go("reset-request")
								setMessage("Enter your address to request another link.")
							}}
						>
							Try another email
						</button>
					</>
				)}
				<button
					type="button"
					className="ap-link ap-bottom"
					onClick={() => go("sign-in")}
				>
					Back to sign in
				</button>
			</div>
		)
	else if (screen === "reset-new")
		content = (
			<div className="ap-card ap-compact">
				<p className="ap-eyebrow">Back to your account</p>
				<h1>
					{scenario === "expired"
						? "This reset link has expired"
						: "Set a new password"}
				</h1>
				<p className="ap-subtitle">
					{scenario === "expired"
						? "Request a fresh link to reset your password."
						: "Choose a new password for your GoodWatch account."}
				</p>
				{scenario === "expired" ? (
					<button
						type="button"
						className="ap-primary"
						onClick={() => go("reset-request")}
					>
						Get a new reset link
					</button>
				) : (
					<form
						onSubmit={(e) => {
							e.preventDefault()
							if (password !== confirm) {
								setMessage("The passwords don’t match. Please try again.")
								return
							}
							setOutcome("Password updated")
							setSignedIn(false)
						}}
					>
						{passwordField(true)}
						<label className="ap-field">
							Confirm new password
							<input
								type={showPassword ? "text" : "password"}
								autoComplete="new-password"
								required
								value={confirm}
								onChange={(e) => setConfirm(e.target.value)}
							/>
						</label>
						{message && (
							<p className="ap-error" role="alert">
								{message}
							</p>
						)}
						<button type="submit" className="ap-primary">
							Update password
						</button>
					</form>
				)}
				<button
					type="button"
					className="ap-link ap-bottom"
					onClick={() => go("sign-in")}
				>
					Back to sign in
				</button>
			</div>
		)
	else if (screen === "verify")
		content = (
			<div className="ap-card ap-compact">
				<span className="ap-status-icon" aria-hidden="true">
					{scenario === "success" ? "✓" : "@"}
				</span>
				<h1>
					{scenario === "success"
						? "Email verified"
						: scenario === "expired"
							? "This verification link has expired"
							: "Check your email"}
				</h1>
				<p className="ap-subtitle">
					{scenario === "success" ? (
						"Your email is verified. Sign in to continue to your GoodWatch."
					) : scenario === "expired" ? (
						"We can send you a fresh verification link."
					) : (
						<>
							We sent a verification link to <strong>{email}</strong>. Open it
							to finish creating your account.
						</>
					)}
				</p>
				{scenario !== "success" && (
					<>
						<p className="ap-small">
							Check your spam folder if it doesn’t arrive.
						</p>
						<button
							type="button"
							className="ap-primary"
							disabled={resendWait > 0}
							onClick={() => {
								setResendWait(60)
								setMessage("Verification email sent. Check your inbox.")
							}}
						>
							{resendWait > 0
								? `Email sent · wait ${resendWait}s`
								: "Resend verification email"}
						</button>
						<output className="ap-small">{message}</output>
						<button
							type="button"
							className="ap-link ap-bottom"
							onClick={() => go("sign-up")}
						>
							Use a different email
						</button>
					</>
				)}
				<button
					type="button"
					className={
						scenario === "success" ? "ap-primary" : "ap-link ap-bottom"
					}
					onClick={() => {
						if (scenario === "success") setVerified(true)
						go("sign-in")
					}}
				>
					Back to sign in
				</button>
			</div>
		)
	else if (screen === "consent")
		content = (
			<div
				className={`ap-card ap-consent ${variant === "B" ? "ap-consent-split" : ""}`}
			>
				<header>
					{connectionIdentity}
					<p className="ap-eyebrow">Connect an app</p>
					<h1>Claude wants to access your GoodWatch</h1>
					<p className="ap-subtitle">
						Signed in as <strong>{signedIn ? email : accountEmail}</strong> ·{" "}
						<button
							type="button"
							className="ap-link"
							onClick={() => {
								setSignedIn(false)
								go("sign-in", "oauth")
							}}
						>
							Use another account
						</button>
					</p>
					{variant === "B" && (
						<div className="ap-connection-note">
							<h2>Bring your next watch into the conversation</h2>
							<p>
								Ask where you are in a show, choose tonight’s title or update
								your Wishlist through Claude.
							</p>
							<p className="ap-small">
								Returning to claude.ai after you decide.
							</p>
						</div>
					)}
				</header>
				<div>
					{variant === "B" ? (
						<>
							<div className="ap-access-choice">
								<strong>Requested access</strong>
								<span>Read and change</span>
							</div>
							<p className="ap-small">
								Claude will be able to read and change the items below.
							</p>
						</>
					) : (
						<p className="ap-small">Claude is requesting permission to:</p>
					)}
					{permissionGroups}
					<details className="ap-detail">
						<summary>About this connection</summary>
						<p>
							App website: claude.ai
							<br />
							Return address: https://claude.ai/api/mcp/auth_callback
						</p>
						<p>
							Connecting gives Claude ongoing access within these permissions.
							Only connect apps you trust.
						</p>
					</details>
					{consentActions}
				</div>
			</div>
		)
	else {
		const displayedApps = scenario === "empty" ? [] : apps
		const appList = (
			<>
				<div className="ap-section-heading">
					<div>
						<h2>Connected apps</h2>
						<p>Apps you’ve allowed to access your GoodWatch.</p>
					</div>
					<span className="ap-count">{displayedApps.length}</span>
				</div>
				{displayedApps.length === 0 ? (
					<div className="ap-empty">
						<span className="ap-status-icon" aria-hidden="true">
							↗
						</span>
						<h3>No apps connected</h3>
						<p>
							You can connect GoodWatch from an assistant’s connector settings.
							You’ll review its access here first.
						</p>
						<button
							type="button"
							className="ap-secondary"
							onClick={() => go("consent")}
						>
							Preview connecting Claude
						</button>
					</div>
				) : (
					displayedApps.map((app) => (
						<article className="ap-app" key={app}>
							<div className="ap-app-head">
								<span className="ap-client-icon" aria-hidden="true">
									{app === "Claude" ? "✳" : "◎"}
								</span>
								<div>
									<h3>{app}</h3>
									<p>
										{app === "Claude" ? "claude.ai" : "chatgpt.com"} · Connected
										14 October 2026
									</p>
								</div>
								<button
									type="button"
									className="ap-link"
									aria-expanded={expanded === app}
									onClick={() => setExpanded(expanded === app ? null : app)}
								>
									{expanded === app ? "Hide access" : "View access"}
								</button>
							</div>
							{expanded === app && (
								<div className="ap-app-body">
									<p>
										<strong>Can read</strong> your watches, progress, Wishlist,
										ratings, Not interested titles, taste, country and services.
									</p>
									<p>
										<strong>Can change</strong> watches, progress, Wishlist,
										ratings, Not interested titles, country and services,
										including removal and undo.
									</p>
									<p className="ap-small">
										Last used:{" "}
										{app === "Claude" ? "Today at 18:42" : "Not used yet"}
									</p>
									<button
										type="button"
										className="ap-danger"
										onClick={() => setDisconnect(app)}
									>
										Disconnect {app}
									</button>
								</div>
							)}
						</article>
					))
				)}
				<p className="ap-small">
					Disconnecting stops future access. It doesn’t undo earlier changes or
					erase information an app has already received.
				</p>
			</>
		)
		content = (
			<div className="ap-settings">
				<h1>Your Settings</h1>
				<div className="ap-settings-grid">
					<nav aria-label="Settings">
						{[
							"Country",
							"Streaming",
							"Profile",
							"Hidden titles",
							"Imports",
							"Account",
							...(variant === "A" ? ["Connected apps"] : []),
						].map((tab) => (
							<button
								type="button"
								key={tab}
								className={tab === currentTab ? "active" : ""}
								onClick={() => setAccountTab(tab)}
							>
								{tab}
							</button>
						))}
					</nav>
					<section className="ap-settings-content">
						{currentTab !== "Account" && currentTab !== "Connected apps" ? (
							<>
								<h2>{currentTab}</h2>
								<p>
									Existing settings section, included here to show placement.
								</p>
								<button
									type="button"
									className="ap-link"
									onClick={() => setAccountTab("initial")}
								>
									Back to {variant === "A" ? "Connected apps" : "Account"}
								</button>
							</>
						) : (
							<>
								{currentTab === "Account" && (
									<>
										<h2>Account</h2>
										<div className="ap-account-summary">
											<div>
												<span className="ap-small">EMAIL</span>
												<p>{accountEmail}</p>
											</div>
											<button
												type="button"
												className="ap-secondary"
												onClick={() => go("reset-request")}
											>
												Change password
											</button>
										</div>
										<hr />
									</>
								)}
								{currentTab === "Account" && variant === "A" ? (
									<button
										type="button"
										className="ap-link"
										onClick={() => setAccountTab("Connected apps")}
									>
										Review connected apps →
									</button>
								) : (
									appList
								)}
							</>
						)}
					</section>
				</div>
			</div>
		)
	}
	return (
		<div className="auth-prototype">
			<div className="ap-workbench">
				<span>PROTOTYPE · #534 · local demo</span>
				<nav aria-label="Prototype screens">
					{screens.map((item) => (
						<button
							type="button"
							aria-current={screen === item ? "page" : undefined}
							key={item}
							onClick={() => {
								setAccountTab("initial")
								go(item)
							}}
						>
							{names[item]}
						</button>
					))}
				</nav>
			</div>
			<div className={`ap-surface ap-screen-${screen}`}>{content}</div>
			{disconnect && (
				<div className="ap-modal-backdrop">
					<dialog
						open
						aria-modal="true"
						aria-labelledby="disconnect-title"
						className="ap-modal ap-card"
					>
						<h2 id="disconnect-title">Disconnect {disconnect}?</h2>
						<p>
							{disconnect} will lose access to your GoodWatch. You can reconnect
							later. Changes it already made will stay.
						</p>
						<div className="ap-actions">
							<button
								type="button"
								className="ap-secondary"
								onClick={() => setDisconnect(null)}
							>
								Keep connected
							</button>
							<button
								type="button"
								className="ap-danger"
								onClick={() => {
									setApps(apps.filter((app) => app !== disconnect))
									setMessage(`${disconnect} disconnected`)
									setDisconnect(null)
								}}
							>
								Disconnect
							</button>
						</div>
					</dialog>
				</div>
			)}
			<footer className="ap-demo-state">
				<output>
					{message ||
						"No real accounts, email or app connections. Reload clears this demo."}
				</output>
				<details>
					<summary>Demo controls & state</summary>
					<div className="ap-demo-controls">
						<button type="button" onClick={() => go(screen, "error")}>
							Bad sign-in
						</button>
						<button type="button" onClick={() => go("reset-request", "sent")}>
							Reset email sent
						</button>
						<button
							type="button"
							onClick={() =>
								go(screen === "verify" ? "verify" : "reset-new", "expired")
							}
						>
							Expired link
						</button>
						<button
							type="button"
							onClick={() => {
								setVerified(true)
								go("verify", "success")
							}}
						>
							Email verified
						</button>
						<button type="button" onClick={() => go("connected", "empty")}>
							No apps
						</button>
						<button
							type="button"
							onClick={() => {
								setCutoverSeen(false)
								go("cutover")
							}}
						>
							Replay cut-over
						</button>
					</div>
					<pre>
						{JSON.stringify(
							{
								screen,
								variant,
								scenario,
								signedIn,
								verified,
								cutoverSeen,
								apps,
								outcome,
							},
							null,
							2,
						)}
					</pre>
				</details>
			</footer>
			{process.env.NODE_ENV !== "production" && (
				<div className="ap-switcher" aria-label="Layout variant">
					<button
						type="button"
						aria-label="Previous variant"
						onClick={toggleVariant}
					>
						←
					</button>
					<span>
						{["reset-request", "reset-new", "verify"].includes(screen)
							? "Shared layout"
							: `${variant} · ${variant === "A" ? "Compact / dedicated" : "Split / inside Account"}`}
					</span>
					<button
						type="button"
						aria-label="Next variant"
						onClick={toggleVariant}
					>
						→
					</button>
				</div>
			)}
		</div>
	)
}
