# Daily preparation verification — 2026-10-23

Implemented the approved 09:00 Asia/Kolkata daily preparation workflow in the current feature checkout, preserving existing mail and lead-quality work. The native Codex heartbeat `kirat-daily-lead-and-email-preparation` is ACTIVE with the daily 09:00 rule. Read back with automation_update and the saved configuration; no cron/LaunchAgent workaround was created.

The live pilot completed with five new research cards and three messages per lead: P N Gadgil Jewellers Limited, Patel Retail Limited, KIKO Milano India, IThum World, and Nubo. Zero paid Hunter checks were reserved or used. No lead emails were sent or approved. IThum has an unverified published company address; PNG has a customer-service routing address, held from daily staging. Three other cards need a suitable published business recipient. Unsupported addresses were removed by source attestation rather than guessed.

The native register now contains 15 records. All ten original IDs, notes and statuses match the exported backup; all five new card IDs were acknowledged after IndexedDB persistence. The successful prior controlled Gmail test remains the only sent message. Sending remains paused. Native app version 1.3/build 4 was installed and reopened; Daily Review and its running/completed state were visually verified.

Verification:

- `npm test`: core, tools, loopback server, local jobs, contacts, quality, mail API/presence, daily controller/API and shared model claims.
- `npm run test:mail`: 26 queue tests, 12 transport tests and local TLS wire test; daily-key replay returns the original item after edits/sending and rejects altered requests.
- `node test/test-daily.js`: Kolkata schedule, once/day, partial recovery, budget reservations, streamed five-card cap, durable acknowledgement, skip/backlog release, competing instances, cancellation of a separately owned worker and checkpoint staging failure.
- `.local/venv/bin/python test/browser-daily.py`: native additions, persisted sales notes, reload, acknowledged deletion, recipient acknowledgement, draft preview, pending-only staging, nonnative sync rejection.
- `.local/venv/bin/python test/browser-mail.py`: existing approval/preview/edit/test/staging flow still passes.
- `npm run build` and `git diff --check`: static allowlist excludes daily/mail service code and private state.

Review fixes: historical queued cards no longer consume the acquisition cap; checkpoint rejection is handled immediately; short metadata writes merge concurrent field changes under a process lock; cancellation persists across dashboard/CLI instances; a shared Codex claim prevents concurrent model calls. Held cards direct the user to the register for contact research, or can be skipped without sending.

Runtime limits: the Mac must be awake and Codex running for the heartbeat. A closed native app receives new records on reopening; only the current missed day is prepared. Successful account login and available model usage remain external dependencies. Missing contact evidence can leave researched drafts held; daily acquisition does not promise five sendable recipients. Initial pilot failed before returning any leads; explicit retry completed and retained the once/day record.
