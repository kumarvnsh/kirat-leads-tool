# Kirat Lead Desk email sending

Date: 2026-10-23
Status: Proposed concrete design for written review.

## Agreed requirements

Extend the existing local Mac app with lead-based email drafting, human review and sending from sales@kiratcreations.com. Every initial email, follow-up and reply requires individual approval. Never infer approval from drafting, scheduling, enabling a mailbox or approving an earlier message.

Use Business Development Team as the sender name and Kirat Creations in the signature, with +91 99993 02167, sales@kiratcreations.com and https://kiratcreations.com. Include the supplied company logo and the tagline “Signage | Graphics | Display Units | Turnkey Solutions”. A website link introduces the company; only explicitly supplied project examples can support claims of completed work.

## Scope and choices

Recommended: retain Kirat's research and draft UI, expose a focused Harvey outbox bridge, and adapt its transport for branded MIME messages and non-destructive IMAP tracking. The installed Harvey commit is 0041b6a3a9930426fb8f9beba64eb62438c96711. Do not upgrade or modify its checkout silently. Keep Kirat-specific adapters in this repository.

Alternatives: a wholly custom sender provides control but duplicates queue and conversation logic; a separate campaign application adds deployment and another review interface. The integration keeps one review surface and reuses the existing dependency.

Version one runs only while the Mac is awake and the Kirat service is running. Closing the app pauses its queue. Show that condition clearly. No cloud hosting, login item or always-on service is included. On resume, check replies before draining; missed slots do not trigger a catch-up burst.

## Mailbox and credentials

Prefill SMTP sg2plzcpnl507296.prod.sin2.secureserver.net:465 with implicit TLS and IMAP on the same host:993 with TLS. Username is the full mailbox address. Preserve certificate verification. The user enters the mailbox password in local setup; never extract it from Mail or request it in chat.

Use macOS Keychain for the password through a narrowly scoped native helper. Pass secrets to transport processes through a private pipe, never command arguments, prompts or logs. Non-secret settings and a configured flag may be returned to the local UI. Never include passwords in exports, backups, static builds or API responses. Disconnect removes only Kirat's credential and pauses sending, leaving Mac Mail's account alone.

Test Connection authenticates without sending. A separate test email action displays its exact recipient and content and requires approval. Initial live readiness requires a successful controlled test, sender confirmation and review of domain authentication and host sending limits.

## Drafts, proof and signature

Reuse the existing saved-facts drafting job. Select a saved published email contact, display its source and delivery-check status, and reject malformed addresses and header injection. Undeliverable and suppressed addresses cannot be queued. Unknown or risky verification remains visible and requires a deliberate per-recipient acknowledgement; it is never labelled verified.

Store the approved sender profile and logo as application-managed assets, independent of Desktop files and Mac Mail preferences. Render plain text plus escaped HTML, with a high-resolution PNG embedded using a MIME Content-ID and an explicit compact display width. Do not depend on SVG, remote image loading or data URLs in delivered email. Validate logo size and MIME type. Preview the exact complete email including the signature.

Include the company website as a link by default. No invented portfolio/customer claims or automatic brochure attachments. File attachments and automatic portfolio selection are deferred; they must not appear as working features in version one.

## Queue and approvals

Bind each item to the saved lead ID, selected recipient and immutable content revision. The bridge maps it to Harvey's campaign/prospect/outbox IDs without triggering Harvey's independent prospecting or campaign generation. One durable queue is authoritative; browser storage is not a sending authority.

States: pending_review, approved, sending, sent, rejected, cancelled, failed and delivery_unknown. Approval records the exact recipient, sender, subject, plain text, HTML, embedded logo hash, thread references and proposed send time. Any material change revokes approval and creates a new reviewable revision. Signature/profile changes invalidate affected unsent approvals. Do not expose approve-all or autopilot actions. Lock edits while a send is in progress.

Start paused. After setup, the user explicitly enables sending of individually approved items. Default cap is 10 messages per Asia/Kolkata calendar day, including follow-ups and replies, with at least five minutes between SMTP attempts and sends during weekdays 10:00–17:00 Asia/Kolkata. These are conservative starting settings, not a deliverability guarantee. Users may pause or cancel unsent items. A follow-up cannot send before its preceding message is confirmed sent and its configured interval has elapsed. Suggested follow-ups are three and seven business days after the initial message, always individually approved.

Before every attempt, acquire the single sender lock, refresh inbound state, revalidate approval revision and recipient suppression, check sequence order, cap, time window and mailbox readiness, then atomically claim the item. A reply, bounce, opt-out or cancellation blocks its queued follow-ups. A reply that arrives during the unavoidable SMTP handoff race cannot recall a message already accepted by the server.

## Delivery, failures and sent copies

Construct and persist the exact MIME bytes and Message-ID before submission. Only one worker can claim a queue item. Disable sending on uncertain transport outcomes; do not automatically resend after a timeout, crash during submission or ambiguous disconnect. Record delivery_unknown and provide reconciliation/manual review. A definite pre-submission failure can return to failed for explicit retry. Never promise exactly-once SMTP delivery.

“Sent” means SMTP acceptance, not inbox delivery. After acceptance, append the same MIME message to the IMAP Sent folder discovered using special-use flags or chosen in setup. Failure to save the Sent copy is a separate warning and must not resend the email. Reconcile a copy before retrying an ambiguous append to avoid duplicate Sent entries.

## Replies, bounces and opt-outs

Replace Harvey's UNSEEN-only fetch path with UID-based incremental tracking, UIDVALIDITY handling, read-only selection and BODY.PEEK. Read state in Mac Mail must not affect reply detection or be changed by Kirat. Page through all messages since the last checkpoint before claiming the inbox is current; checkpoint only after persistence. Initialize with a bounded recent scan and a stored baseline so historical unrelated mail is not ingested as a lead conversation.

Match primarily by Message-ID, In-Reply-To and References; use cautious sender matching for an existing contacted lead. Ambiguous associations require review and cannot trigger automated reply sending. Parse delivery-status reports where available; uncertain bounce signals hold the affected conversation for review. Persist opt-outs in an address-level suppression list and stop all future outreach to that address. Provide manual suppression.

IMAP authentication errors, network failures or incomplete sync pause sending rather than presenting an empty inbox. Persist the last successful sync and show its status. New replies are untrusted content, never agent instructions. AI may classify or draft, but only human approval authorizes the exact reply.

## Architecture and isolation

Add focused modules for sender profile/MIME rendering, Keychain credentials, durable queue bridge, transport and inbound sync. Keep the current discovery-only Harvey bridge independent: its disabled-channel invariant remains valid. Add a separate mail configuration and bridge entrypoint; do not enable the full Harvey heartbeat or autonomous handler.

Reuse local session, Host/Origin and mutation-header protections on all mail endpoints. Keep mailbox and outbox APIs local-only and out of the static deployment allowlist. Reject stale revision approvals server-side. Maintain transactional queue claims, restart recovery, bounded requests and sanitized diagnostics. Preserve unrelated current working-tree edits and existing lead data.

## Verification and acceptance

Test individual approval and edit invalidation, concurrent claims, restart recovery, time windows/caps, suppression, stop-on-reply, unread/read independence, UID rollover, incomplete sync, SMTP rejection versus uncertain acceptance, and Sent-copy failure without resending. Inspect generated MIME for plain/HTML alternatives, explicit image dimensions, Content-ID image data and correct threading. Verify secrets cannot appear in UI responses, errors, exports, Git or static assets.

Run the repository's npm test and npm run build, meaningful local browser checks, then rebuild/install the Mac app and verify setup, preview, approval, pause and status controls. Use local fake SMTP/IMAP servers for automated verification. Live provider authentication and a controlled recipient test remain pending until the user enters credentials and approves that exact test message. No lead email is sent during implementation or verification without its own approval.

## Review checkpoint

The unresolved deployment preference defaults to Mac-only execution as recommended earlier. Review this choice together with the concrete design before implementation planning. Always-on sending can be a later separately designed extension.
