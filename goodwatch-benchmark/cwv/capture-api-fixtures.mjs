// Run once; both builds reuse this immutable API snapshot alongside loader-data.json.
import { access, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
	PUBLIC_API_PATHS,
	apiKey,
	validateApiFixtures,
} from "./fixture-api.mjs";

import { freezeAvatar, selectedAvatarPath } from "./fixture-avatar.mjs";

const [directory, origin = "https://goodwatch.app"] = process.argv.slice(2);
if (!directory) throw new Error("Expected OUTPUT_DIR [PUBLIC_ORIGIN]");
for (const file of ["api-responses.json", "api-capture.json", "avatar-response.json"]) {
	try {
		await access(path.join(directory, file));
		throw new Error(`Refusing to recapture frozen API data: ${file}`);
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
}
const pages = JSON.parse(
	await readFile(path.join(directory, "loader-data.json"), "utf8")
);
const avatarPath = selectedAvatarPath(pages);
let avatar;
if (avatarPath) {
	const response = await fetch(new URL(avatarPath, origin), {
		redirect: "error",
	});
	avatar = freezeAvatar(response, Buffer.from(await response.arrayBuffer()));
}
const responses = {};
for (const pathname of PUBLIC_API_PATHS) {
	const response = await fetch(new URL(pathname, origin), {
		method: "GET",
		headers: {
			Accept: "application/json",
			"Accept-Language": "en-US,en;q=0.9",
		},
	});
	if (!response.ok) throw new Error(`${pathname}: HTTP ${response.status}`);
	const body = await response.text();
	JSON.parse(body);
	responses[apiKey(pathname)] = { status: response.status, body };
	console.log(
		`${response.status} ${pathname}: ${Buffer.byteLength(body)} bytes`,
	);
}
validateApiFixtures(responses);
const snapshot = JSON.stringify(responses);
if (avatar)
	await writeFile(
		path.join(directory, "avatar-response.json"),
		JSON.stringify(avatar),
		{
			flag: "wx",
		}
	);

await writeFile(path.join(directory, "api-responses.json"), snapshot, {
	flag: "wx",
});
await writeFile(
	path.join(directory, "api-capture.json"),
	JSON.stringify(
		{
			origin,
			capturedAt: new Date().toISOString(),
			paths: PUBLIC_API_PATHS,
			frozenPayloadSHA256: createHash("sha256").update(snapshot).digest("hex"),
		},
		null,
		2,
	) + "\n",
	{ flag: "wx" },
);
