# YepWatch Maestro flows

The journeys as portable Maestro flows (Android emulator here, iOS simulator on EAS Workflows, see
`../ci/eas-maestro-ios.yml`). The app animates continuously (intro film, breathing mood field, LIVE dot), so
Maestro's "wait until the screen settles" never succeeds and costs 8-9 s per command; every tap passes
`waitToSettleTimeoutMs`. Gate timings are not measured here: `../run.mjs` measures them from 60 fps recordings.

Single-phone flows run as is. Two-phone flows take `INVITE_URL` (from the host's share row) via `-e`.

    maestro --device emulator-5570 test --no-reinstall-driver smoke-create-room.yaml
    maestro --device emulator-5572 test -e INVITE_URL=https://yepwatch.com/r/ABC123 -e NAME=Bob join-by-link.yaml
