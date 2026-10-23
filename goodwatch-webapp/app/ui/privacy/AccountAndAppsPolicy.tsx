// The privacy policy's sections for self-hosted sign-in, account email, the move from Supabase and connected AI apps
// (#571, behind REC_CONNECTOR). Facts come from the build: Better Auth on CrateDB and Valkey (#549), Purelymail for
// mail (#532), the cut-over plan (#536) and the MCP tool set (#535). The owner kept every statement as written
// (2026-10-15).
import { Link } from "@remix-run/react"
import type { ReactNode } from "react"
import {
	APP_CAN_CHANGE,
	APP_CAN_NEVER,
	APP_CAN_SEE,
	CONNECTED_APPS_PATH,
	RANKED_SEARCHES_PER_DAY,
	USE_WITH_AI_PATH,
} from "~/ui/connector/connector"

export function AccountAndAppsPolicy() {
	return (
		<div className="flex flex-col gap-12">
			<Summary />

			<Section id="account" title="Signing in and your account">
				<p>GoodWatch runs its own sign-in, on its own servers.</p>
				<p>For your account we store:</p>
				<Bullets>
					<li>Your email address, and whether you confirmed it.</li>
					<li>
						Your password, only as a one-way hash. Nobody at GoodWatch can read
						it.
					</li>
					<li>
						If you sign in with Google: your Google account ID, and the name,
						email address and profile picture Google shares with us. Google also
						gives us sign-in keys, which we store encrypted.
					</li>
					<li>
						For each device you sign in on: a session, with when it started, the
						IP address and the browser it came from. A session lasts 90 days and
						is renewed while you use GoodWatch. Signing out or changing your
						password ends it at once.
					</li>
				</Bullets>
				<p>
					Signing in sets one cookie,{" "}
					<code className="text-gray-100">gw.session_token</code>. It only keeps
					you signed in.
				</p>
				<p>
					To stop abuse, we count requests for sign-in emails for one hour: per
					email address, which we store only as a hash, and per IP address.
				</p>
				<p>
					Account data is kept in GoodWatch's database and, for sessions, also
					in its cache.
				</p>
			</Section>

			<Section id="emails" title="Emails we send">
				<p>We only send emails about your account:</p>
				<Bullets>
					<li>To confirm your email address when you sign up</li>
					<li>
						To reset your password when you ask for it, or to remind you that
						you sign in with Google
					</li>
					<li>To tell you your password changed</li>
					<li>To tell you someone tried to sign up with your email address</li>
				</Bullets>
				<p>
					No newsletters and no ads. The emails come from hello@goodwatch.app
					and are sent through Purelymail, which sees the address and the
					content of each email.
				</p>
			</Section>

			<Section id="supabase" title="The move from Supabase">
				<p>Until the move, sign-in ran on Supabase, a hosted service.</p>
				<p>
					For the move we copied your email address, your password hash, your
					Google link and whether you had confirmed your email to our own
					servers. Your user ID stayed the same. Your ratings, lists and
					everything else you saved were always on GoodWatch's own servers, so
					they didn't move. Everyone signs in once more after the move.
				</p>
				<p>
					Supabase keeps a read-only copy for 30 days after the move, in case we
					have to switch back. Then we delete the Supabase project.
				</p>
			</Section>

			<Section id="connected-apps" title="Connected apps">
				<p>
					You can connect AI assistants such as Claude (made by Anthropic) and
					ChatGPT (made by OpenAI) to your GoodWatch account.{" "}
					<Link
						to={USE_WITH_AI_PATH}
						className="font-semibold text-amber-500 hover:text-amber-400"
					>
						Here's how
					</Link>
					. An app gets access only after you sign in to GoodWatch and press
					Allow.
				</p>
				<div className="my-3 grid gap-3 md:grid-cols-3">
					<AccessBox title="A connected app can see" items={APP_CAN_SEE} />
					<AccessBox title="It can change" items={APP_CAN_CHANGE} />
					<AccessBox title="It can never" items={APP_CAN_NEVER} />
				</div>
				<p>
					When you ask the app something, GoodWatch sends it what it needs for
					the answer, such as your ratings or where you are in a show. What the
					app does with that is up to its maker and their privacy policy, not
					ours.
				</p>
				<p>
					What an app changes is saved like a change you make on the site: a
					watch Claude logs for you is a normal watch in your history.
				</p>
				<p>For each connected app we store:</p>
				<Bullets>
					<li>
						The app's name, and where its details come from (its own website, or
						the app itself)
					</li>
					<li>
						That you allowed it, and when you connected it and last used it
					</li>
					<li>
						The keys the app uses to reach your account, stored so they can't be
						read back
					</li>
				</Bullets>
				<p>
					We count how often each app feature is used, to keep GoodWatch running
					well. When an app searches by description, it counts toward your limit
					of {RANKED_SEARCHES_PER_DAY} such searches a day.
				</p>
				<h3 className="mt-3 font-semibold text-gray-100">
					To disconnect an app
				</h3>
				<Bullets>
					<li>
						Open{" "}
						<Link
							to={CONNECTED_APPS_PATH}
							className="font-semibold text-amber-500 hover:text-amber-400"
						>
							Settings → Connected apps
						</Link>{" "}
						and press Disconnect. The app loses access right away; nothing you
						saved on GoodWatch is lost.
					</li>
					<li>You can also remove GoodWatch in the app itself.</li>
					<li>Deleting your GoodWatch account disconnects every app.</li>
				</Bullets>
				<p>
					Disconnecting doesn't delete what the app already received, such as
					earlier chats. To delete that, ask the app's maker.
				</p>
			</Section>

			<Section id="discord" title="The GoodWatch Discord bot">
				<p>
					You can use the GoodWatch bot in Discord without a GoodWatch account.
					When you use a command or press a button, Discord sends GoodWatch what
					it needs to answer: your Discord user ID, the server and channel IDs,
					your Discord language setting, and the command with its options.
				</p>
				<p>
					For each command we log only the command, where it ran (a server or a
					direct message), whether you have a linked account, how long it took
					and whether it worked. We don't log message content, names or what you
					searched for. To stop abuse, we count commands per Discord user ID.
				</p>
				<p>
					Searches by description from <code className="text-gray-100">/search</code>{" "}
					run on GoodWatch's search service, the same way as searches on the
					website. You can make 20 such searches a day, counted per Discord user
					ID.
				</p>
				<h3 className="mt-3 font-semibold text-gray-100">
					Linking your GoodWatch account
				</h3>
				<p>
					When you link your Discord account to your GoodWatch account, you sign
					in with Discord, and Discord shares only your user ID and username. We
					use the sign-in key Discord gives us once to read them, then cancel it.
					We store with your GoodWatch account:
				</p>
				<Bullets>
					<li>Your Discord user ID and username</li>
					<li>When you linked them</li>
				</Bullets>
				<p>
					With a linked account, the bot's answers can show your matches, ratings
					and lists. Only you see these answers. When you press Share to channel,
					the bot posts a card to the channel without your personal part.
				</p>
				<p>
					To unlink, use <code className="text-gray-100">/unlink</code> in
					Discord, or the Discord section in Settings, Account and sign-in on
					GoodWatch. Deleting your GoodWatch account also unlinks it. When you
					unlink, we mark the link as removed and no longer use it.
				</p>
				<h3 className="mt-3 font-semibold text-gray-100">Server settings</h3>
				<p>
					A server admin can use <code className="text-gray-100">/setup</code>{" "}
					to choose a country and streaming services for the server. We store
					these with the server's ID, the Discord user ID of the admin who last
					changed them, and when.
				</p>
				<h3 className="mt-3 font-semibold text-gray-100">
					Choosing together
				</h3>
				<p>
					During a <code className="text-gray-100">/together</code> session,
					votes and picks are kept in GoodWatch's cache for up to 24 hours.
					Nobody else sees your votes. After a session closes, its live data
					expires within 48 hours.
				</p>
				<p>We keep only the outcome of each session:</p>
				<Bullets>
					<li>The server, channel and message IDs</li>
					<li>The Discord user ID of the person who started it</li>
					<li>What was being chosen, such as movies or a mood</li>
					<li>How it ended, and the chosen title</li>
					<li>How many people took part</li>
					<li>When it started and ended</li>
				</Bullets>
				<p>We never keep individual votes or picks.</p>
				<p>
					Discord's own handling of your data is covered by the{" "}
					<a
						href="https://discord.com/privacy"
						target="_blank"
						rel="noreferrer"
						className="font-semibold text-amber-500 hover:text-amber-400"
					>
						Discord Privacy Policy
					</a>
					.
				</p>
			</Section>
		</div>
	)
}

function Summary() {
	return (
		<div className="rounded-2xl border border-gray-700 bg-gray-800/40 p-5 sm:p-6">
			<h2 className="mb-3 text-xl font-bold text-white">In short</h2>
			<Bullets>
				<li>
					GoodWatch runs its own sign-in now. Your account and everything you
					saved are on our own servers.
				</li>
				<li>We only email you about your account. No newsletters, no ads.</li>
				<li>
					Apps like Claude and ChatGPT reach your GoodWatch only after you allow
					them, and never see your password.
				</li>
				<li>You can disconnect an app any time in Settings, Connected apps.</li>
			</Bullets>
		</div>
	)
}

function Section({
	id,
	title,
	children,
}: { id: string; title: string; children: ReactNode }) {
	return (
		<section
			id={id}
			aria-labelledby={`${id}-title`}
			className="flex scroll-mt-24 flex-col gap-1 leading-relaxed"
		>
			<h2 id={`${id}-title`} className="text-2xl font-bold text-white">
				{title}
			</h2>
			{children}
		</section>
	)
}

function Bullets({ children }: { children: ReactNode }) {
	return (
		<ul className="my-2 flex list-disc flex-col gap-2 pl-5 marker:text-gray-500">
			{children}
		</ul>
	)
}

function AccessBox({
	title,
	items,
}: { title: string; items: readonly string[] }) {
	return (
		<div className="rounded-xl border border-gray-700 bg-gray-800/30 p-4">
			<h3 className="mb-2 font-semibold text-gray-100">{title}</h3>
			<ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm marker:text-gray-500">
				{items.map((item) => (
					<li key={item}>{item}</li>
				))}
			</ul>
		</div>
	)
}
