import type { LoaderFunctionArgs } from "@remix-run/node"
import { importId, withMember } from "~/server/imports/http.server"
import { getSkippedCsv } from "~/server/imports/service.server"
export const loader = ({ request, params }: LoaderFunctionArgs) =>
	withMember(request, async (userId, headers) => {
		headers.set("Content-Type", "text/csv; charset=utf-8")
		headers.set(
			"Content-Disposition",
			'attachment; filename="import-skipped.csv"',
		)
		return new Response(`﻿${await getSkippedCsv(userId, importId(params))}`, {
			headers,
		})
	})
