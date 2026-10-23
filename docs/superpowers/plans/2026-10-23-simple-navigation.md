# Simple Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Work in current checkout because the installed app depends on existing uncommitted features.

**Goal:** A five-tab app that makes daily lead and individual email review clear.

**Architecture:** Keep view controllers mounted and use hidden tab panels so background synchronization and unsaved editors survive navigation. Mail uses one shared provider and explicit emails/replies/settings views; daily uses one mounted controller with Today and settings regions. Existing queue APIs and persistence remain authoritative.

**Tech Stack:** Existing React/htm, browser IndexedDB, Node loopback service, WKWebView, CSS. No dependencies or transport changes.

### Task 1 — Email presentation and shared state
Files: mail-panel.js; test/browser-mail.py.
- [ ] Add a browser flow assertion for emails/settings/replies tabs and retained draft edits; run to observe pre-change failure.
- [ ] Export KiratMailProvider, KiratMailStatus and KiratMailPanel({view,onNavigate}); provider polls once across tab switches and remains mounted. Keep legacy standalone hook fallback for lead composer.
- [ ] Split mailbox/setup/readiness/suppression into settings, replies into replies, and message queue into emails. Use Needs approval/Scheduled/Sent/Needs attention segments and compact message disclosures with complete preview and individual approval. Expose counts through the shared context and a compact global sending status.
- [ ] Preserve exact revision approval, editing invalidation, uncertain delivery holds, suppression and reply association. Test with fictional transport; never send a new real email.

### Task 2 — Daily Today presentation
Files: daily-panel.js.
- [ ] Render compact Today rows with company, location, short opportunity, human status and next action. Display draft/source details only after disclosure.
- [ ] Route Open lead to Leads and queued email to Emails using onOpenLead/onNavigate. Keep recipient acknowledgement and pending-only stage; stage routes directly to Emails.
- [ ] Keep controller mounted; render preparation settings separately with hidden controls based on current view. Schedule/budget/pause belong in Settings; Today has run/retry/cancel and progress.
- [ ] Verify native sync and acknowledgement still persist new leads once and preserve edits/deletes.

### Task 3 — App shell, register and focused lead detail
Files: kirat-lead-desk.html, local-panel.js, test/browser-navigation.py.
- [ ] Write five-tab fixture assertions, verify failure, then implement accessible stable tabs with keyboard navigation and hidden associated panels; global alerts/status persist.
- [ ] Mount shared mail provider around App; move research/settings/mail to explicit tabs. Export ProviderSettings from local-panel and remove nested mail/settings; research controls appear only when Find leads opens. Move repair/debug/quit under Advanced settings.
- [ ] Compact header/logo and lead table, preserve search/status, move secondary filters into disclosure. Place import/export/prompt/links in Leads controls. Lead detail uses Overview/Contacts/Email sections, one composer and collapsed optional follow-ups.
- [ ] Preserve all live IDs/notes/drafts, browser-only behavior, no static local-service leakage. Keep all hidden view controllers mounted and route actions to the appropriate tab.

### Task 4 — Regression, review and native update
Files: browser test fixtures, README, installer, verification record.
- [ ] Adapt existing browser tests to navigation and renamed controls, then run npm test, browser navigation/daily/mail/local flows, static build and git diff check.
- [ ] Review spec compliance and correctness; resolve important findings.
- [ ] Increment launcher version, quit app, install/reopen, visually verify Today, Leads, Emails, Replies, Settings; 15 real records and sending paused. No real research or email sending for navigation tests.
- [ ] Document the simple flow and tested limits.
