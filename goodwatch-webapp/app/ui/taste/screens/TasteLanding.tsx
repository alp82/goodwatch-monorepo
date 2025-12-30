import { motion } from "framer-motion"
import { GUEST_LIMITS } from "../features"
import TasteRotator from "../components/TasteRotator"
import { Link } from "@remix-run/react";

interface TasteLandingProps {}

const INITIAL_DELAY = 0

export default function TasteLanding({}: TasteLandingProps) {
	return (
		<div className="flex justify-center mb-32 px-4 py-4">
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className="w-full text-center"
			>
				{/* Heading */}
				<motion.h1
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: INITIAL_DELAY + 0.3 }}
					className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6"
				>
					Find Your<br />Perfect Watch
				</motion.h1>

				{/* Subheading */}
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: INITIAL_DELAY + 0.4 }}
					className="text-2xl md:text-3xl lg:text-4xl text-gray-300 mb-12"
				>
					Rate just <strong>{GUEST_LIMITS.FIRST_UNLOCK}</strong> movies to see the magic
				</motion.p>

				<motion.div
					initial={{ opacity: 0, scale: 0 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ delay: INITIAL_DELAY + 0.5 }}
					className="mb-12"
				>
					<TasteRotator />
				</motion.div>

				{/* CTA Button */}
				<motion.button
					initial={{ opacity: 0, scale: 0.9 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ delay: INITIAL_DELAY + 0.6 }}
					whileHover={{ scale: 1.05 }}
					whileTap={{ scale: 0.95 }}
					type="button"
					className="px-12 py-4 bg-amber-700 hover:bg-amber-600 text-white text-2xl font-semibold rounded-2xl shadow-lg transition-colors cursor-pointer"
				>
					<Link to="/taste" prefetch="render">
						Start Taste Quiz
					</Link>
				</motion.button>

				{/* Social Proof */}
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: INITIAL_DELAY + 0.75 }}
					className="mt-2 mb-16 text-sm text-gray-500"
				>
					Join 300+ users curating their personal taste
				</motion.p>

				{/* Features */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: INITIAL_DELAY + 0.9 }}
					className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12 text-gray-400"
				>
					<div className="flex items-center gap-2">
						<svg
							className="w-5 h-5 text-green-500"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fillRule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clipRule="evenodd"
							/>
						</svg>
						<span>No signup required</span>
					</div>
					<div className="flex items-center gap-2">
						<svg
							className="w-5 h-5 text-green-500"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fillRule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clipRule="evenodd"
							/>
						</svg>
						<span>Takes 30 seconds</span>
					</div>
					<div className="flex items-center gap-2">
						<svg
							className="w-5 h-5 text-green-500"
							fill="currentColor"
							viewBox="0 0 20 20"
						>
							<path
								fillRule="evenodd"
								d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
								clipRule="evenodd"
							/>
						</svg>
						<span>Free & No Ads</span>
					</div>
				</motion.div>

			</motion.div>
		</div>
	)
}
