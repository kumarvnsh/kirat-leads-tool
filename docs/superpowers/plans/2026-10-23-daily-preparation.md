# Daily Lead Preparation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Preserve existing work in the current feature checkout.

**Goal:** Prepare up to five qualified lead records and email drafts daily at 09:00 Asia/Kolkata, pending individual approval.

**Architecture:** A protected local daily controller and CLI share private durable state and a cross-process job claim. The native app mirrors its register and automatically saves new daily records without overwriting existing sales edits. Native Codex heartbeat invokes the CLI; a bounded worker researches, attests and drafts but cannot approve/send.

**Tech Stack:** Existing Node/React/htm/Python source-attestation stack, private JSON state, existing mail bridge, native automation_update heartbeat.

### Task 1 — Durable daily controller and bounded worker
Files: create `lib/daily.js`, `scripts/daily-worker.js`, `test/test-daily.js`.
- [ ] Write and run failing tests for once-per-Kolkata-day runs, cross-process lock, stale claim, zero paid budget, partial result retry, duplicate companies/addresses, suppressions and backlog limits.
- [ ] Implement `createDaily({directory,worker,mail,...})` exposing sync/register additions, status, run, cancel, settings and stage. Persist run and card checkpoints with private atomic writes; stage only pending messages with replay-safe IDs.
- [ ] Worker uses existing Codex live research and source attestation, then factual no-web draft calls. Enforce 5 records and optional Hunter budget; produce checked structured results, no mail/approval tools.
- [ ] Verify fictional fixture runs, then spec and correctness reviews.

### Task 2 — Mail idempotency, protected routes and CLI
Files: modify `lib/mail.js`, `scripts/kirat_mail.py`, `lib/local-server.js`, `bin/kirat.js`; create `test/test-daily-api.js`.
- [ ] Add failing queue test proving repeated daily stage key returns the original pending item, not another email, and never accepts altered content.
- [ ] Add deterministic daily stage-key mapping in the existing queue and a no-startup/no-poll mail facade for CLI use, without changing sending state.
- [ ] Validate daily GET/POST routes with existing session/Origin protections. Only the native app can write the production register mirror. CLI `daily` waits for bounded preparation, reports counts and exits without sending. CLI status/seed options are fixed commands, not arbitrary execution.
- [ ] Run API and existing queue tests; assert no route provides approval-all or background send enable.

### Task 3 — Native daily review and register handoff
Files: create `daily-panel.js`, `test/browser-daily.py`; modify `kirat-lead-desk.html`, local script allowlist and tests.
- [ ] Add browser regression for snapshot sync/new-record save/reload with preserved user edits and explicit unknown-recipient acknowledgement.
- [ ] Poll daily status, mirror register, acknowledge saved daily IDs and save only unseen additions. Render Daily Review cards with evidence, held status, saved draft and Outbox handoff; preparation pause/cancel/budget controls remain separate from sending.
- [ ] Run browser flows and static allowlist checks; no daily code/private state deployed to Pages.

### Task 4 — Pilot, scheduling and installation
Files: README, daily verification record, native installer version.
- [ ] Run npm test, mail suites, daily fixtures, browser tests and build; fix review findings.
- [ ] Seed the actual 10-lead export and private prepared outreach plan; run one bounded live preparation pilot (no email sending).
- [ ] Build/install/reopen native app; verify 10 existing leads/sales data and new daily controls. Leave all email sending paused.
- [ ] Activate the existing heartbeat for daily 09:00 Asia/Kolkata using automation_update; read back to confirm. Document local runtime dependency and actual live pilot outcome.
