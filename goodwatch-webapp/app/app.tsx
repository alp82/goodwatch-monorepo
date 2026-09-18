import { AccountTransferPrototype } from "~/ui/onboarding/AccountTransferPrototype"
import { GuestProgressNotice } from "~/ui/GuestProgressNotice"
import { Outlet, useLocation } from "@remix-run/react"
import { AnimatePresence, motion } from "framer-motion"
import React from "react"

import Footer from "~/ui/Footer"
import Header from "~/ui/main/Header"
import BottomNav from "~/ui/nav/BottomNav"
import { SmartOnboardingBanner } from "~/ui/onboarding/SmartOnboardingBanner"
import { useUser } from "~/utils/auth"
import { useInvalidateOnVisibility } from "~/hooks/useInvalidateOnVisibility"

function App() {
	const location = useLocation()
	const { user } = useUser()
	const transferPreview = import.meta.env.DEV && new URLSearchParams(location.search).get("prototype") === "account-transfer"

	useInvalidateOnVisibility()

	return (
		<>
			<Header />
			{/* Show smart onboarding banner for logged-in users */}
			{transferPreview ? <AccountTransferPrototype /> : user && <SmartOnboardingBanner />}
			<main className="relative grow mx-auto mt-16 pb-2 w-full text-neutral-300">
				<GuestProgressNotice />
				<AnimatePresence mode="wait">
					{/*<motion.div*/}
					{/*	key={location.pathname}*/}
					{/*	initial={{ x: "-2%", opacity: 0 }}*/}
					{/*	animate={{ x: "0", opacity: 1 }}*/}
					{/*	exit={{ x: "2%", opacity: 0 }}*/}
					{/*	transition={{ duration: 0.2, type: "tween" }}*/}
					{/*>*/}
					<Outlet />
					{/*</motion.div>*/}
				</AnimatePresence>
			</main>
			<Footer />
			<BottomNav />
		</>
	)
}

export default App
