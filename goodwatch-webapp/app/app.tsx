import { Outlet, useLocation } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import React from "react"

import { useOnboardingRequired } from "~/routes/api.user-settings.get"
import Footer from "~/ui/Footer"
import Header from "~/ui/main/Header"
import BottomNav from "~/ui/nav/BottomNav"
import Onboarding from "~/ui/onboarding/Onboarding"

function App() {
	const location = useLocation()

	const onboardingRequired = useOnboardingRequired()
	if (onboardingRequired) return <Onboarding />

	return (
		<>
			<Header />
			<main className="relative flex-grow mx-auto mt-16 pb-2 w-full text-neutral-300">
				<AnimatePresence mode="wait">
					<motion.div
						key={location.pathname}
						initial={{ x: "-2%", opacity: 0 }}
						animate={{ x: "0", opacity: 1 }}
						exit={{ x: "2%", opacity: 0 }}
						transition={{ duration: 0.2, type: "tween" }}
					>
						<Outlet />
					</motion.div>
				</AnimatePresence>
			</main>
			<Footer />
			<BottomNav />
		</>
	)
}

export default App
