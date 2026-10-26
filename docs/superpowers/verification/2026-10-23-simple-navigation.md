# Simple navigation verification — 2026-10-23

Approved design implemented in the current feature checkout. Kirat Lead Desk 1.4/build 5 is installed and reopened with Today, Leads, Emails, Replies and Settings. Native UI inspection verified all five screens, 15 saved companies/projects, signature disclosure, daily preparation controls, compact lead columns and the global Sending paused indicator. The final assets were refreshed in the native window; Today is the selected screen.

Today shows compact source-backed opportunities, contact holds and the next useful action. Completed batches no longer offer an ineffective Prepare action. Leads has search/status and contextual secondary filters; research opens only on request. Detail is a nonmodal pane with Overview, Contacts and Email. One composer replaces the duplicate editor/composer flow; optional follow-up controls are collapsed. Import remains a separate modal with its shade and explicit confirmation.

Emails has Needs approval, Scheduled, Sent and Needs attention. One shared mailbox provider polls across all hidden tab panels. Message editors remain mounted across navigation and segments. Today staging and queued-message actions open the exact email, including its correct segment. Full branded preview and revision-specific individual approval remain mandatory. Reply drafting, suppression, bounce/opt-out handling and uncertain-delivery reconciliation remain available. Mailbox account, signature, readiness and daily schedule are under Settings; credentials/diagnostics/service repair are under Advanced.

Regression evidence:

- `npm test`: all existing core, research, server, local job, contacts, quality, mail API/presence, daily and model-claim checks passed.
- `test/browser-navigation.py`: five tabs, arrow-key navigation, focused research/detail sections, retained unqueued email body and acknowledgement across navigation, saved notes, narrow viewport.
- `test/browser-mail.py`: fictional account setup, preview/signature, individual approval, edit invalidation, retained unsaved edits across tabs/segments, exact-message routing, first email arriving after composer mount, recipient replacement resetting acknowledgement, and accepted draft replacement. Fictional controlled send only.
- `test/browser-local.py`: stale draft protection, saved edited drafts, replacement confirmation, verification/contact lookup, backups, reload, cancellation and service shutdown.
- `test/browser-daily.py`: preparation settings portal, persistent expansion across tabs, exact-email staging navigation, acknowledged native additions, preserved notes and deletion persistence.
- `test/browser-check.py` against static loopback server: import, duplicate merge, notes, backup/CSV, failed storage loading/writing recovery, backup round-trip and deletion persistence.
- `npm run build`, JavaScript syntax checks and `git diff --check` passed. Static output retains the public-only allowlist and excludes local mail/daily panels, credentials and private state.

Review fixes included retaining the selected lead pane across navigation, synchronizing newly found recipients, selecting the exact queued message, restoring Import's modal behavior, and replacing a passive draft initializer with content-keyed layout synchronization. This preserves edits during unrelated contact/status updates while applying explicitly accepted replacement drafts before paint.

Live private-state checks: 15 register records; all ten original IDs, notes and statuses match the exported backup; five daily additions remain acknowledged. The mail database contains only the earlier single sent controlled test. No new real email, approval, paid verification or research batch was performed for this UI update. Sending remains paused. The user's configured daily verification budget remains unchanged at one.
