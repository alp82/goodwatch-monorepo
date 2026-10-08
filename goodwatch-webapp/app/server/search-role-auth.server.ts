import { createHash, timingSafeEqual } from "node:crypto";
import { runsSearch, searchRoleKey } from "./role.server.ts";

export function searchRoleAuthorized(request: Request): boolean {
	const key = searchRoleKey();
	if (!runsSearch() || !key) return false;
	const supplied = request.headers.get("X-Search-Role-Key") ?? "";
	const digest = (value: string) => createHash("sha256").update(value).digest();
	return timingSafeEqual(digest(key), digest(supplied));
}
