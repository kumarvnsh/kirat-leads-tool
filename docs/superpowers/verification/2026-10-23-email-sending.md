# Kirat individually approved sending — verification

Date: 2026-10-23 (Asia/Kolkata)

## Implemented

The Mac app now exposes mailbox setup, test connection, a controlled test queue, complete branded MIME previews, individually approved outbound messages, follow-up dependencies, replies, suppression, pause/resume and uncertain-delivery reconciliation. Each queued revision holds a durable MIME snapshot reused by preview and approval. Passwords use a fixed-identity native Keychain helper and private pipes. A separate pinned Harvey SQLite outbox is the queue authority; discovery configuration and upstream checkout are unchanged.

The installed app is version 1.2 (build 3) at `/Users/vnshkumar/Applications/Kirat Lead Desk.app`. Its runtime remains the existing project folder. Computer Use verified the new Email sending and expanded Mailbox setup controls, default cPanel server/ports, company signature and website, **Sending paused**, **Mailbox setup · not configured**, zero queued emails and the same 10 saved leads as before installation.

## Automated checks

- `npm test`: existing lead/core/tool/server/local/contact/quality suites, mail API protection and UI-presence checks.
- `npm run build`: static allowlist build. Mail controller, local mail panel, operational database and high-resolution email logo remain excluded from Pages.
- `npm run test:mail`: 25 queue tests, 12 transport tests and one real TLS localhost protocol test.
- `.local/venv/bin/python test/browser-local.py`: existing research, draft/edit/import/export/verification/contact flow.
- `.local/venv/bin/python test/browser-mail.py`: temporary real queue with fictional transport; local password form, authentication-only check, full CID image preview, independent approval, editing revokes approval, controlled test then pause, selected saved-lead draft staging.
- `zsh test/test-keychain.sh`: compiled/signed Swift helper, isolated test identity write/read/update/delete. No production mailbox item accessed.
- `npm run install:mac`: native launcher/helper compile, ad-hoc signature and installation.
- `git diff --check`: whitespace validation.

Queue coverage includes missing/stale approval, immutable reviewed snapshots, duplicate initial staging, profile invalidation, independent follow-up approval and threading, business-day delay, weekday send window, five-minute pacing, daily cap and rollover, production file locking across concurrent workers, definite versus ambiguous outcomes, interrupted-send recovery, Sent-copy failure without resend, read replies stopping follow-ups, reply drafting/individual approval, incomplete sync pausing, address suppression, ambiguous incoming association, ambiguous opt-out cancelling an already approved reply, large inbound response bounds, and active items retained beyond recent history.

Transport coverage includes MIME plain/HTML alternatives, escaped content, decoded/CRC-validated PNG with CID and explicit compact width, header rejection, TLS contexts with certificate verification, configured Sent-folder existence, read-only UID/BODY.PEEK sync regardless of read state, UIDVALIDITY rollover, bounded initial UID range, size preflight before body download, incomplete/over-deadline sync failure, DSN recipient extraction, and Message-ID reconciliation before Sent append. The real wire test uses temporary localhost-only SMTP and IMAP TLS servers and a generated test certificate trusted only inside that test; it verifies a disconnect after DATA is classified as uncertain.

## Review fixes

Separate spec and quality reviews identified transport bounds, invalid PNG acceptance, configured Sent folder checks, end-of-sync deadline checks, follow-up threading, snapshot consistency, ambiguous opt-outs, inactive-window behavior, large status responses and older active queue visibility. Regressions were added and findings repaired. Targeted re-reviews confirmed those findings resolved. A subsequent reply-staging regression caught and repaired an overbroad duplicate-initial guard.

## Remaining live setup

No mailbox password was retrieved from Apple Mail or entered into Kirat, and no email was sent externally. The user must enter the mailbox password locally, pass cPanel SMTP/IMAP authentication, approve one exact controlled test to an address they control, check its receipt and signature, and review SPF/DKIM/DMARC/provider policy before enabling lead sending. Those live checks are not claimed as verified.

Version one runs on the awake Mac while the app is open; there is no cloud/background deployment. Browser fallback has a best-effort page-close pause and a 15-second presence lease checked by the 30-second sender timer. A message already submitted cannot be recalled. Only currently matched lead replies are retained in the app; very long messages remain fully available in Mac Mail. This is a conservative bounded sender, not an inbox-placement guarantee.

Queue operational data lives in `.local/mail`; register backups do not include it. Protect and back up that private directory separately with the app stopped. All existing unrelated working-tree changes were preserved. No merge, push or public deployment was performed.
