# YepWatch room ideas and streaming union

Status: owner-approved 2026-11-01; implemented on `feat/yepwatch-room-redesign`, not deployed.

This supersedes the description, service selection and deck exhaustion rules in [the earlier room-description decision](yepwatch-shared-room-description.md). Leave, participant identity, account grants and proposal anonymity retain their established meanings. The implementation follows [the room redesign specification](../../yepwatch-app/docs/room-redesign.md).

A room shares up to eight ideas, each with its author, interpretation and host-controlled on/off switch. Anyone may suggest; host suggestions start on, others start off. Authors edit their own ideas; the host may remove any idea. Each add/edit makes one search before the command publication retry loop. A CAS reservation caps searches at 24 over the room's lifetime, including failures and the retained draft-preview endpoint. Restart does not renew that budget. Search results are immutable idea records referenced by the room head, rather than ranked lists embedded in that head.

Each present participant contributes their selected services. A null pick contributes no services and still counts fully for voting and agreement. The room's enabled selection is the union minus the host's disabled services. While choosing, a settings command cannot remove the last enabled service. Country remains shared. A guest host may initially have no nickname; Start requires a nickname and an enabled service.

Ideas, services and kinds change without restarting a round. Unanswered cards that no longer qualify are removed and their canonical keys become eligible for delivery again. Any answer record, including an undo, retains the card and its votes. Candidate idea attribution is a set: removing one idea does not remove a title still wanted by another enabled idea. Matches and proposals become unavailable when their title no longer meets the active idea/kind/service selection; retained historical answers remain private.

The deck interleaves enabled ideas and falls back to popularity when a lane runs out. With no enabled ideas it uses popularity directly. The 120 active-card and 2000 seen-key limits remain server resource bounds. They are quiet stops for the client, not completion screens or promises to enumerate an unlimited catalog.

Linked members default to excluding their GoodWatch seen titles. Only their own snapshot exposes their show-seen setting. The server reads seen titles through the existing account resource and read grant, caches by room/member/roster version, and refreshes when someone joins. Member-disabled releases have no remote member reader and perform no account reads.
