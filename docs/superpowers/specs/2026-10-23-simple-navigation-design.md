# Simple navigation for Kirat Lead Desk

Status: approved by the user. Scope: simplify navigation, labels and review screens in the existing native app. User requires individual approval for each outgoing message.

## Problem and decision

The app currently renders Daily Review, research controls, mailbox setup, the entire Outbox, replies and the lead register on one long page. Mailbox settings are nested inside research. Lead details combine evidence, contact lookup, draft generation, three draft editors, another composer and sales fields. This makes the next action difficult to find.

Recommend five top tabs: Today, Leads, Emails, Replies, Settings. This follows the user's request for tabs and gives each task a stable place. A sidebar would suit a larger app but consumes space without reducing the number of decisions here. A step-by-step wizard would help initial setup but make repeated lead and reply work harder; use a short guided email review within Emails instead.

## Screens

**Today** is the default landing page: a compact summary of today's batch and a list of items requiring attention. Show company, location, one-line opportunity, status and one next action. Statuses: Ready to review, Contact needed, In email queue, Skipped. Open the appropriate saved lead or exact queued email with that action. Keep research evidence and optional follow-ups behind detail disclosure. Daily preparation status has one clear primary action when useful, such as Prepare today's leads or Retry; schedule configuration lives in Settings.

**Leads** contains the saved register, search and basic status filters. Compact columns: Company, Location, Opportunity, Status, Next action. Detailed scores, source timestamps, secondary filters and exports move to contextual details or a More menu. Find leads opens focused research controls; import/export stay here. Selecting a lead opens a detail pane with three sections: Overview, Contacts, Email. Keep sales notes editable in Overview. Email uses one initial draft editor; optional follow-ups are collapsed. Reuse existing source checks, stale-result protection and persistence.

**Emails** contains Needs approval, Scheduled and Sent segments, with a visible Needs attention count for failed or uncertain deliveries. A message list shows company, recipient, subject and human-readable status. Selecting one shows the complete branded preview including signature, logo and website. Edit, Approve email and Skip/cancel apply only to that message. Any edit invalidates approval and requires a fresh preview. Never approve a batch or automatically enable sending. Sending paused must be visible and explained before approval; an approved message stays waiting while paused. Keep a direct path to sending readiness in Settings.

**Replies** contains received messages, associated lead and a Reply action. Reply drafts go through the same exact-message preview and individual approval in Emails. Unmatched replies offer the existing manual association; opt-outs and bounces remain visibly blocked and continue stopping follow-ups.

**Settings** contains Mail account, Signature, Daily preparation, and Advanced. Account setup and connection diagnostics stay here. The signature shows the existing Business Development Team identity, phone, logo, tagline and website. Daily preparation shows 09:00 IST, pause/resume and the optional paid verification budget. Advanced contains provider credentials, repair/setup, job diagnostics, suppression management and local service controls. Use plain labels and put technical details behind disclosure. Backups remain accessible from Leads.

## Email flow shown in the product

1. App researches opportunities and writes drafts; it never guesses a recipient.
2. If a business contact is missing or unsuitable, show Find contact. An unverified recipient requires the existing explicit contact review.
3. Send the initial draft to Needs approval. This action does not send email.
4. User reviews the recipient, subject, body and complete signature, edits if needed, then approves that exact email.
5. When sending is enabled, the existing queue sends individually approved messages within weekday 10:00–17:00 IST, maximum 10 attempts/day and at least five minutes between attempts. When paused, approved messages wait.
6. Sent status and replies appear in their respective tabs. Follow-ups and replies need their own approval. Bounces/opt-outs stop further outreach.

## Interaction and visual treatment

Use a smaller Kirat logo and compact title bar, clear selected-tab styling and badge counts for action items. Show a small sending status indicator with a direct settings link. Maintain one dominant action per screen, predictable Back/Close actions and visible keyboard focus. Use system typography, existing brand accent and more whitespace; remove repeated explanatory paragraphs from normal screens. Short inline explanations appear only where the decision needs them.

Tabs have ARIA tab roles, associated panels and arrow-key navigation. Retain focus when switching views; do not move focus during background polling. Narrow windows keep the tab row usable and show a single detail view. Avoid relying on color alone to express readiness or errors.

## Implementation boundaries

Reuse the existing React/htm, lead register, daily controller, mail queue, Keychain and SMTP/IMAP transport. No new dependencies or storage migration. Separate presentation from the existing API operations. Daily synchronization and mail presence must continue while their views are hidden: tab switches must not pause sending, lose unsaved draft edits, trigger a new research run, reset contact acknowledgement, or duplicate queue entries. The sending timer remains controlled by the existing open-window lease, not by the active tab. Load and share mail state at the app level rather than mounting independent sending engines per view.

Local-only panels remain excluded from static builds. Browser-only register behavior remains isolated from the native mirror. Preserve all 15 lead IDs, notes, statuses and saved drafts, the prior sent controlled test, and existing mailbox credentials.

## Verification

Test the whole user journey with fictional leads and transport: navigate tabs, open a daily lead, resolve a contact hold, edit the initial draft, stage pending review, preview the branded message, approve one exact message, show paused versus scheduled state, and open a reply. Check that switching tabs preserves unsaved edits and cannot duplicate staging or alter sending readiness. Confirm empty states and keyboard navigation, narrow layout, source links and static build isolation. Run existing relevant regressions and reinstall/reopen the native app. Visually verify all 15 real leads remain and sending stays paused; do not send a new live email.
