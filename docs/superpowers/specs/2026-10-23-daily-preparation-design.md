# Kirat daily lead and email preparation

Date: 2026-10-23, Asia/Kolkata. Approved through the outreach proposal and the user's confirmation of daily 09:00 preparation.

## Outcome

Every day at 09:00 Asia/Kolkata, prepare up to five source-backed new signage/graphics/display opportunities and factual, personalized email drafts. Human review of each exact message remains mandatory. Weekday sending keeps the existing 10-attempt/day cap, pacing, reply/opt-out checks and sender-readiness gate. No daily process can approve, enable sending or submit a form.

## Execution

Use a native Codex thread heartbeat scheduled daily, calling `node bin/kirat.js daily`. Keep it paused until implementation and verification finish. Local access needs this Mac awake and the desktop scheduling app running; opening Kirat after a missed run can prepare at most the current day's batch after 09:00. Never replay a backlog of dates. Provide a manual Run today's preparation action with the same once-per-day idempotency. An explicit retry is available only after a failed/cancelled run, retaining prior successful cards.

One bounded live-web research call discovers and checks up to five qualified signals, aims for three national retail and two NCR, and researches appropriate public business contacts. Prefer planned/ongoing work. Return fewer rather than manufacture evidence, buyers or requirements. Contacts need attributable source URLs, excerpts and ownership labels; attest published email evidence using the existing public-source checker. A bounded no-web drafting call uses saved verified project facts per accepted lead. Reuse the Codex login; daily research does not automatically invoke paid Serper. Hunter is disabled by default for daily work; a separate explicit budget of 0–5 checks/day permits configured verification, never exceeding the persisted budget even across retries.

## Persistence and exclusions

Store a private daily register mirror, durable seen-project/company/recipient keys, run day/state/checkpoints and review cards under `.local/daily`. Seed it from the actual exported 10-lead register. Sync the active native register through the existing protected loopback API, never scrape IndexedDB. Browser-only mirrors must not overwrite the native register. Return only genuinely new daily records to the native app for automatic save as New/unreviewed. Preserve all existing sales fields, edits, deletions and IDs. New research never overwrites an existing record. Hold duplicate company outreach even when a distinct location is a legitimate research signal.

Check exclusions against register, daily cards, outbox recipients/company IDs, past sends, replies and suppression. Unknown or risky deliverability goes to Needs contact review. Unsupported, suppressed or undeliverable contacts never become sendable. General customer-service addresses are routing-only and require review. Only an explicitly sourced business recipient with independently deliverable status may be staged automatically, always pending_review. Otherwise show the draft plus source evidence and require explicit per-recipient acknowledgement before staging. Preview/approve then use the existing exact-MIME outbox; do not build another sending authority. Restarts must not duplicate queue entries.

## Daily Review interface

Show schedule, scheduler/local runtime dependency, most recent run status, progress/failure, verification budget, preparation pause/resume and Run today's preparation. Display source-backed leads, project uncertainty, buyer/recipient source, verification status, draft and hold reason. Automatically import new daily records into the native register, with durable acknowledgement so deleting a daily lead does not recreate it. Provide a clear transition to the Outbox for complete branded preview and individual approval. Optional follow-ups remain draft-only until separately reviewed.

## Safety, recovery and limits

Use cross-process run claims, atomic private writes, day keys in Asia/Kolkata, stale-job recovery and unique card IDs. Persist each completed card before continuing. Reconcile existing queue identity before staging after a crash. Stop acquisition at 20 outstanding initial review cards/emails; do not consume model/provider usage while held. Running manual research and daily research cannot silently overwrite their outputs or compete for the same model job. Cancel preparation without touching email approvals. Failures preserve previous results and show a usable retry state. Fresh research failure never masquerades as old results.

Notify only for new ready review work, failure or required user action. Repeated/unchanged/held runs stay quiet. No infrastructure purchases, hosted worker, daily sending autopilot, automatic follow-up approval or new standalone chats are included.

## Verification

Use fictional provider/worker/mail fixtures for daily-once, timezone boundary, missed-run behavior, cross-process lock, stale/retry/partial result recovery, deduplication, suppression, verification-budget persistence, unchanged sales metadata, native-origin sync, no paid calls by default, pending-only queue staging and backlog holds. Browser tests cover automatic lead save, review status, contact acknowledgement, Outbox handoff, pause and safe reload. Run existing tests, mail tests, static build and native installation checks. A live pilot may research and draft but cannot send any lead email. Activate the saved native schedule only after verification.
