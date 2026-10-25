// All feedback dependencies are mocked: no network services are used.
export default {
	test: {
		include: ["scripts/feedback-tests/feedback.test.ts"],
		environment: "node",
	},
}
