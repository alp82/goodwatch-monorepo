// Static loopback-only profiles; no arbitrary inherited database/mail endpoint.
const maintenance = process.env.AUTH_TEST_SUITE === "maintenance"
export const authTestCrateOrigins = [48, 49, 50].map(
	(port) => `http://127.0.0.1:${(maintenance ? 15600 : 15500) + port}`,
)
export const authTestValkeyPort = maintenance ? 15701 : 15601
export const authTestSmtpPort = maintenance ? 15625 : 15525
export const authTestMailpitURL = `http://127.0.0.1:${maintenance ? 15680 : 15580}`
