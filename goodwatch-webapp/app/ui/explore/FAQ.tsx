import React from "react"
import type { PageFAQ } from "~/ui/explore/config"

interface FAQProps {
	faq: PageFAQ
}

export default function FAQ({ faq }: FAQProps) {
	return (
		<div className="max-w-7xl mx-auto px-8 py-12">
			<h2 className="text-4xl font-serif font-medium text-gray-100 mb-12">
				Frequently Asked Questions
			</h2>

			<div className="space-y-12">
				{faq.map((item) => (
					<div key={item.q} className="group">
						<h3 className="text-xl font-semibold text-gray-100 mb-4 tracking-tight">
							{item.q}
						</h3>
						<p className="text-lg leading-relaxed text-gray-300 font-medium">
							{item.a}
						</p>
					</div>
				))}
			</div>
		</div>
	)
}
