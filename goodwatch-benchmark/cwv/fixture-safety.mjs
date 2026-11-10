import net from "node:net";
import { syncBuiltinESMExports } from "node:module";

/** Call before dynamically importing any application bundle. Accepting local requests remains possible. */
export function denyOutboundConnections() {
	const denied = (kind) => {
		throw new Error(`Fixture forbids outbound ${kind}`);
	};
	net.Socket.prototype.connect = function () {
		return denied("socket");
	};
	globalThis.fetch = async () => denied("fetch");
	syncBuiltinESMExports();
}
