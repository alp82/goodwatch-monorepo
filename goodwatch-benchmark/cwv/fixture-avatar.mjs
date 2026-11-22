import { createHash } from "node:crypto";

// The shared-list owner's selected Google picture is the only photo the anonymous snapshot captures.
const listPath = "/u/alperortac/lists/o1H79d4fVu";
export const publicAvatarPath = "/api/avatar/alperortac?source=google";

export function selectedAvatarPath(pages) {
	const avatar = pages[listPath]?.["routes/u.$handle"]?.shell?.avatar;
	return avatar?.url === publicAvatarPath ? publicAvatarPath : null;
}

export function freezeAvatar(response, bytes) {
	const contentType = response.headers.get("content-type");
	if (
		response.status !== 200 ||
		contentType !== "image/webp" ||
		bytes.length < 12 ||
		bytes.toString("ascii", 0, 4) !== "RIFF" ||
		bytes.toString("ascii", 8, 12) !== "WEBP"
	)
		throw new Error(
			"Expected a successful WebP response from the selected avatar endpoint"
		);
	const expectedETag =
		'"' + createHash("sha256").update(bytes).digest("hex") + '"';
	if (response.headers.get("etag") !== expectedETag)
		throw new Error("Avatar bytes differ from the stored version");
	const headers = {};
	for (const name of [
		"content-type",
		"cache-control",
		"etag",
		"x-content-type-options",
		"content-security-policy",
	]) {
		const value = response.headers.get(name);
		if (value) headers[name] = value;
	}
	return { headers, body: bytes.toString("base64") };
}
