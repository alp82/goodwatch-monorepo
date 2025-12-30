import { ArrowRightIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid"
import { Link } from "@remix-run/react"
import discordColor from "~/img/discord-mark-blue.svg"
import redditColor from "~/img/reddit-color.svg"
import tmdbLogo from "~/img/tmdb-logo.svg"
import shieldazeBanner from "~/img/secured-by-shieldaze-transparent.webp"

const DISCORD_GOODWATCH_URL = "https://discord.gg/TVAcrfQzcA"

const navigation = {
	main: [
		{ name: "Movies", href: "/movies" },
		{ name: "Shows", href: "/shows" },
		{ name: "Discover", href: "/discover" },
	],
	social: [
		// {
		//   name: 'Facebook',
		//   href: '#',
		//   icon: (props) => (
		//     <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
		//       <path
		//         fillRule="evenodd"
		//         d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
		//         clipRule="evenodd"
		//       />
		//     </svg>
		//   ),
		// },
		// {
		//   name: 'Instagram',
		//   href: '#',
		//   icon: (props) => (
		//     <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
		//       <path
		//         fillRule="evenodd"
		//         d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
		//         clipRule="evenodd"
		//       />
		//     </svg>
		//   ),
		// },
		// {
		//   name: 'Twitter',
		//   href: '#',
		//   icon: (props) => (
		//     <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
		//       <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
		//     </svg>
		//   ),
		// },
		// {
		//   name: 'YouTube',
		//   href: '#',
		//   icon: (props) => (
		//     <svg fill="currentColor" viewBox="0 0 24 24" {...props}>
		//       <path
		//         fillRule="evenodd"
		//         d="M19.812 5.418c.861.23 1.538.907 1.768 1.768C21.998 8.746 22 12 22 12s0 3.255-.418 4.814a2.504 2.504 0 0 1-1.768 1.768c-1.56.419-7.814.419-7.814.419s-6.255 0-7.814-.419a2.505 2.505 0 0 1-1.768-1.768C2 15.255 2 12 2 12s0-3.255.417-4.814a2.507 2.507 0 0 1 1.768-1.768C5.744 5 11.998 5 11.998 5s6.255 0 7.814.418ZM15.194 12 10 15V9l5.194 3Z"
		//         clipRule="evenodd"
		//       />
		//     </svg>
		//   ),
		// },
		{
			name: "Discord",
			href: DISCORD_GOODWATCH_URL,
			icon: (props: Record<string, string>) => (
				<img
					className={`opacity-75 hover:opacity-100 ${props.className}`}
					src={discordColor}
					alt="Join Discord Server"
				/>
			),
		},
		{
			name: "Reddit",
			href: "https://www.reddit.com/r/goodwatchapp/",
			icon: (props: Record<string, string>) => (
				<img
					className={`opacity-50 hover:opacity-75 ${props.className}`}
					src={redditColor}
					alt="Join Subreddit"
				/>
			),
		},
		{
			name: "GitHub",
			href: "https://github.com/alp82/goodwatch-monorepo",
			icon: (props: Record<string, string>) => (
				<svg fill="currentColor" viewBox="0 0 24 24" {...props}>
					<path
						fillRule="evenodd"
						d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
						clipRule="evenodd"
					/>
				</svg>
			),
		},
	],
}

export type FooterProps = {}

export default function Footer({}: FooterProps) {
	return (
		<footer className="mt-48">
			<section className="pb-16 px-4 sm:px-6 lg:px-8">
				<div className="max-w-7xl mx-auto">
					<div className="relative rounded-3xl overflow-hidden bg-[#5865F2] p-1">
						<div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10"></div>
						
						<div className="relative bg-indigo-950/90 backdrop-blur-xl rounded-[22px] p-8 md:p-12 overflow-hidden">
							<div className="absolute -top-24 -right-24 w-64 h-64 bg-[#5865F2] rounded-full blur-[100px] opacity-40"></div>
							<div className="absolute -bottom-24 -left-24 w-64 h-64 bg-primary-500 rounded-full blur-[100px] opacity-20"></div>
							
							<div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
								<div className="flex-1 text-center md:text-left">
									<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-400/20 text-indigo-300 border border-indigo-400/30 text-xs font-bold uppercase tracking-wider mb-4">
										<span className="w-2 h-2 rounded-full bg-[#5865F2] animate-pulse" />
										Community First
									</div>
									<h3 className="text-3xl md:text-4xl font-bold text-white mb-4">Join the Chat</h3>
									<p className="text-gray-300 text-lg max-w-xl leading-relaxed">
										Discuss the latest episodes, request new features, or just argue about whether <span className="text-white font-medium">Die Hard</span> is a Christmas movie.
									</p>
									
									<div className="flex items-center justify-center md:justify-start mt-6 -space-x-3">
										<div className="w-10 h-10 rounded-full border-2 border-indigo-900 bg-gray-700 overflow-hidden"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" /></div>
										<div className="w-10 h-10 rounded-full border-2 border-indigo-900 bg-gray-700 overflow-hidden"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka" alt="User" /></div>
										<div className="w-10 h-10 rounded-full border-2 border-indigo-900 bg-gray-700 overflow-hidden"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Mark" alt="User" /></div>
										<div className="w-10 h-10 rounded-full border-2 border-indigo-900 bg-gray-700 overflow-hidden"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah" alt="User" /></div>
										<div className="w-10 h-10 rounded-full border-2 border-indigo-900 bg-[#5865F2] text-white flex items-center justify-center text-xs font-bold">+100</div>
									</div>
								</div>
								
								<div>
									<a
										href={DISCORD_GOODWATCH_URL}
										target="_blank"
										rel="noreferrer"
										className="
											group relative inline-flex items-center gap-3 px-8 py-4
											bg-[#5865F2] hover:bg-[#4752C4] border-2 border-[#5865F2] hover:border-[#5865F2] text-white rounded-2xl font-bold text-lg
											transition-all duration-300 hover:scale-105 shadow-[0_0_40px_rgba(88,101,242,0.4)]
										"
									>
										<svg className="w-8 h-8 fill-current group-hover:-translate-x-1 transition-transform" viewBox="0 0 127.14 96.36" xmlns="http://www.w3.org/2000/svg"><path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.11,77.11,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.89,105.89,0,0,0,126.6,80.22c1.24-23.28-3.28-47.54-18.9-72.15ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.25-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"></path></svg>
										<span>Join Discord</span>
										<ArrowRightIcon className="h-6 group-hover:translate-x-1 transition-transform" />
									</a>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			<div className="bg-gray-950">
				<div className="max-w-7xl mx-auto overflow-hidden py-12 px-6 sm:py-16 lg:px-8 flex flex-col gap-8">
					{/*<div className="flex justify-center">/!*TODO DISCORD BLOCK*!/</div>*/}

					<div className="flex flex-col items-center">
						<span className="text-xl text-gray-200 mb-2">
							Join the Community:
						</span>
						<div className="flex justify-center space-x-10">
							{navigation.social.map((item) => (
								<a
									key={item.name}
									href={item.href}
									target="_blank"
									rel="noreferrer"
									className="text-gray-400 hover:text-gray-200"
								>
									<span className="sr-only">{item.name}</span>
									<item.icon className="h-16 w-16" aria-hidden="true" />
								</a>
							))}
						</div>
					</div>

					<nav
						className="columns-2 flex justify-center space-x-12"
						aria-label="Footer"
					>
						<div>
							{navigation.main.map((item) => (
								<div key={item.name} className="mt-2">
									<Link
										className="text-sm leading-6 underline underline-offset-4 text-gray-400 hover:text-gray-100"
										to={item.href}
										prefetch="viewport"
									>
										{item.name}
									</Link>
								</div>
							))}
							<div className="mt-6">
								<a
									href="https://status.goodwatch.app/status/services"
									className="flex items-center text-sm leading-6 text-gray-400 hover:text-gray-100"
									target="_blank"
									rel="noreferrer"
								>
									Status Page
									<ArrowTopRightOnSquareIcon className="ml-1 h-4 w-4" />
								</a>
							</div>
						</div>
						<div>
							<div className="mt-2">
								<Link
									className="text-sm leading-6 underline underline-offset-4 text-gray-400 hover:text-gray-100"
									to="/about"
									prefetch="viewport"
								>
									About
								</Link>
							</div>
							<div className="mt-2">
								<Link
									className="text-sm leading-6 underline underline-offset-4 text-gray-400 hover:text-gray-100"
									to="/how-it-works"
									prefetch="viewport"
								>
									How it works
								</Link>
							</div>
							<div className="mt-2">
								<Link
									className="text-sm leading-6 underline underline-offset-4 text-gray-400 hover:text-gray-100"
									to="/disclaimer"
									prefetch="viewport"
								>
									Disclaimer
								</Link>
							</div>
							<div className="mt-6">
								<a
									href="https://dev.to/t/goodwatch"
									className="flex items-center text-sm leading-6 text-gray-400 hover:text-gray-100"
									target="_blank"
									rel="noreferrer"
								>
									Blog
									<ArrowTopRightOnSquareIcon className="ml-1 h-4 w-4" />
								</a>
							</div>
						</div>
					</nav>

					<div className="mt-8 flex gap-2 items-center justify-center leading-5 text-gray-400">
						<small>powered by</small>
						<a
							href="https://www.themoviedb.org"
							target="_blank"
							className=""
							rel="noreferrer"
						>
							<img alt="TMDB" className="h-3 w-auto" src={tmdbLogo} />
						</a>
						<small>and</small>
						<a
							href="https://justwatch.com"
							target="_blank"
							className="scale-125 ml-2"
							data-original="https://www.justwatch.com"
							rel="noreferrer"
						>
							<img
								alt="JustWatch"
								className="h-3 w-16"
								src="https://widget.justwatch.com/assets/JW_logo_color_10px.svg"
							/>
						</a>
					</div>

					<div className="mt-4 mb-16 flex justify-center">
						<a
							href="https://shieldaze.com"
							target="_blank"
							className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
							rel="noreferrer"
						>
							<img
								alt="Shieldaze"
								className="h-10 w-auto"
								src={shieldazeBanner}
							/>
						</a>
					</div>
				</div>
			</div>
		</footer>
	)
}
