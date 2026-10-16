// Static loopback-only profiles; no arbitrary inherited database/mail endpoint.
// Wiring/MCP use 155xx/156xx, maintenance 156xx/157xx, account deletion (#553) 162xx.
const suite = process.env.AUTH_TEST_SUITE
const maintenance = suite === "maintenance"
const deletion = suite === "deletion"
export const authTestCrateOrigins = [48, 49, 50].map(
	(port) => `http://127.0.0.1:${(deletion ? 16200 : maintenance ? 15600 : 15500) + port}`,
)
export const authTestValkeyPort = deletion ? 16201 : maintenance ? 15701 : 15601
export const authTestSmtpPort = deletion ? 16225 : maintenance ? 15625 : 15525
export const authTestMailpitURL = `http://127.0.0.1:${deletion ? 16280 : maintenance ? 15680 : 15580}`
