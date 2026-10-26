# Kirat lead quality and outreach

Date: 2026-10-21
Status: Proposed implementation design, awaiting written-spec review.

## Approved intent
Improve actionable signage leads through broader discovery, project prioritization, email verification support, and personalized outreach drafts. Retain the installed local Mac app, source review, and manual control over outreach.

## Approach
Recommended: extend the current bounded job workflow. Keep Codex web research available without additional API credentials. Add optional Serper discovery and Hunter email verification, following Harvey's supported integrations where their contracts fit the pinned version. Use Kirat-specific qualification and draft generation around those integrations.

Alternatives considered: enabling Harvey's full autonomous campaign engine would introduce mailbox and sending setup beyond this request; requiring paid providers would prevent immediate use without credentials. Neither is needed for this release.

## Discovery and qualification
The existing Find leads action still produces at most five source-backed records per batch and excludes existing company/project combinations. Broaden queries around upcoming openings, announced expansion, fit-out, renovation and rebranding. Search national retail and NCR opportunities, rather than relying on business directory listings alone.

When configured, Serper supplies bounded candidate search results, which are research inputs only. Default to existing web research when credentials are absent; clearly report provider failures and any fallback. Do not silently present old candidate files as fresh results. Limit optional discovery to five search requests per user-started job; no recurring jobs or account purchases.

Add optional project-stage annotations: planned, in_progress, completed, or unknown, with source and checked date. Prioritize evidence-backed upcoming or ongoing projects over completed openings, without treating an announcement as proof of an open procurement requirement. Preserve the existing score scale and saved sales fields. Explain the priority and uncertainties in the lead view. Older backups remain valid.

## Verification
Add an optional local settings section for Serper and Hunter credentials. Store secrets only in a private ignored local file with owner-only permissions; never include secrets in UI status responses, logs, exports, prompts, GitHub Pages, or version control. Show configured/not configured and allow removal. Existing local API origin/session protections apply to settings mutations.

A per-email Verify action submits only the selected address to Hunter's verifier. Separate publication status from deliverability status. Save provider, status, check date and verification evidence; preserve raw status distinctions such as deliverable, risky/catch-all, undeliverable, unknown or pending. Never upgrade a contact on timeout, provider error or ambiguous response. Do not guess addresses. Limit verification to one explicit address per action, with no automatic retry that consumes credits. Missing credentials produce setup guidance; do not claim verification worked.

## Outreach drafts
Add Draft outreach to saved lead details. Generate a short editable initial email and two follow-up drafts using the existing Codex login and bounded worker. Use only saved lead evidence and approved Kirat services. Separate opportunity assumptions from established facts; never claim a prior relationship, procurement need, customers or credentials not provided by the user. Do not invent a recipient name or direct address.

Store drafts with the lead locally, preserve user edits, and support copy and export through the register backup. Replacing an edited draft requires an explicit regenerate action with confirmation. Render generated content as text. No mailbox connection or automatic sending is included.

## Architecture and persistence
Reuse the existing single-job coordinator, cancellation, worker dispatch and local-only panel. Add focused provider/configuration helpers and validation for new request and result shapes. Keep static Pages builds free of local settings/API functionality. Extend optional lead fields with validation and backward-compatible backup/import behavior. Job results must be bound to the selected saved lead and staged for review before applying.

## Failure handling and validation
Preserve saved leads, draft edits and previous evidence on failure. Bound external requests with timeouts, fixed provider endpoints, input validation and sanitized errors. Reject malformed results and prevent secrets from appearing in exceptions. Provider quota/credential errors must be visible without exposing credentials.

Test qualification prompts and stage validation, backward-compatible import/export, provider response mapping and failures, credential redaction and private storage, stale-result/lead binding, draft preservation, job cancellation and local API protections. Run existing tests, static build and meaningful browser checks. Rebuild and install the Mac app, verify its new controls, then publish the authorized code updates and static site through the existing GitHub workflow. Live paid-provider checks require user-supplied credentials and will be reported as untested if unavailable.

## Completion criteria
The Mac app can discover source-backed opportunities without paid credentials, explain project priority, generate reviewable outreach drafts, and verify selected emails when Hunter is configured. Existing leads and backups survive the upgrade. No message is sent automatically and no credential is published.
