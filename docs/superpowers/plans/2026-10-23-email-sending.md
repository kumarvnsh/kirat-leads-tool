# Individually Approved Email Sending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Send individually approved branded emails from Kirat Lead Desk using the user's cPanel mailbox.

**Architecture:** A local-only JS API calls a Python mail bridge over stdin/stdout. An isolated Harvey SQLite outbox is the sending authority, extended with revision, exact MIME, sync and suppression tables. A native Security.framework helper keeps the password in Keychain. The UI stages saved-lead drafts and reviews one exact message at a time. Existing discovery configuration and unrelated changes remain intact in the current feature checkout, because the draft integration depends on uncommitted work there.

**Tech Stack:** Node HTTP/React/htm, Python standard-library SMTP/IMAP/email/sqlite3 and pinned Harvey migrations, Swift Security.framework.

---

### Task 1: MIME and transport
**Files:** Create `scripts/kirat_mail_transport.py`, `test/test-mail-transport.py`; add `assets/kirat-email-logo.png`.
- [x] Write failing tests for multipart plain/HTML email, escaped content, CID PNG dimensions, header validation, UID/PEEK reply parsing, SMTP uncertain outcomes and Sent-folder handling.
- [x] Run `.local/venv/bin/python test/test-mail-transport.py` and observe missing implementation failure.
- [x] Implement `render_message(item, profile, logo_bytes) -> bytes`, `test_connection(config, password)`, `sync_inbox(config, password, checkpoint) -> {uidvalidity,last_uid,messages}`, `submit(config,password,raw) -> {status,error}`, and `save_sent(config,password,raw)`. Use TLS, read-only UID sync including read messages, DSN parsing and no automatic retry after DATA uncertainty.
- [x] Run transport tests, then inspect a generated MIME message with Python's email parser.

### Task 2: Durable queue and credential helper
**Files:** Create `scripts/kirat_mail.py`, `mac/KiratKeychain.swift`, `test/test-mail.py`; modify `scripts/install-mac-app.sh`.
- [x] Write failing tests using temporary SQLite directories and fake transport for revision approval, edit invalidation, suppression, send windows/caps, claims, incomplete sync, crash recovery and Sent-copy failure without resend.
- [x] Run `.local/venv/bin/python test/test-mail.py` and observe missing bridge failure.
- [x] Initialize pinned Harvey StateManager against `.local/mail/harvey.db`, then extend with Kirat metadata. Expose `status`, `configure`, `disconnect`, `test`, `stage`, `edit`, `approve`, `reject`, `suppress`, `enable`, `sync`, `tick`, `reply`, and `reconcile` operations. Staging produces only pending_review rows. Persist generated MIME bytes/Message-ID before claim. Approval compares an immutable revision. Ambiguous sends become delivery_unknown and pause.
- [x] Compile a helper taking JSON through stdin and using SecItemAdd/CopyMatching/Delete with fixed service/account; no secret in arguments/output except private helper-to-bridge pipe.
- [x] Run tests and helper self-check using an isolated temporary Keychain item, deleting that test item afterward.

### Task 3: Local API and review UI
**Files:** Create `lib/mail.js`, `mail-panel.js`, `test/test-mail-api.js`; modify `lib/local-server.js`, `local-panel.js`, `kirat-lead-desk.html`, `package.json`.
- [x] Write failing HTTP tests for session/Origin/mutation protections, saved-lead email selection, secret redaction, malformed requests and no approve-all endpoint.
- [x] Run `node test/test-mail-api.js` and observe missing routes failure.
- [x] Add narrowly validated mail routes; require saved-lead/contact evidence for staging; use fixed bridge actions and pipe input. Run one bounded tick at a time, stop on service exit. Avoid blocking the UI during sync.
- [x] Add Mailbox and Outbox panels with password setup, connection test, explicit readiness acknowledgement, enable/pause, per-message preview/edit/approve/reject, suppressed addresses, inbound conversation replies and delivery_unknown reconciliation. Add per-lead saved-draft selection and visible verification acknowledgement. Never expose bulk approval.
- [x] Run API and UI tests with temporary storage and fictional contacts; verify no external emails are attempted.

### Task 4: End-to-end verification and installation
**Files:** Create `test/browser-mail.py`, update README and `docs/superpowers/verification/2026-10-23-email-sending.md`.
- [x] Run `npm test` and `npm run build`; verify static output contains no mail UI, credentials or mailbox APIs.
- [x] Run browser tests for setup, staging, exact preview, stale approval rejection, pause and independent follow-up approval with fake transport.
- [x] Review implementation first against the approved spec, then for correctness/security; repair actionable findings and rerun affected checks.
- [x] Build/install Mac launcher, open the app through Computer Use, verify new controls and preserved leads; leave sending paused and credentials unset.
- [x] Record live cPanel authentication, DNS/provider-policy review and approved controlled test as pending user setup; do not claim inbox delivery from SMTP acceptance.

## Execution outcome

Implemented and installed; see `docs/superpowers/verification/2026-10-23-email-sending.md` for fresh checks and live setup boundaries. Existing feature checkout retained to preserve the pre-existing uncommitted draft/enrichment implementation. No merge or public deployment.
