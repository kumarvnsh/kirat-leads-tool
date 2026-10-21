# Public contact enrichment verification

## Delivered

Saved lead details have a local Find contacts action. It uses pinned Harvey Scout public-site/team collection and restricted Codex public web research, then independently reads each supporting HTML/PDF source through Harvey's public HTTP boundary. Results are previewed with source passages, dates and direct/company/unknown ownership. Add selected contacts appends without replacing existing records and updates only the contactability score component. Manual Email/Call links are available for appropriate saved channels.

The contact schema remains version 1 with optional metadata; old records still import. New metadata survives backup/import and CSV export. No paid services, pattern guesses, SMTP checks, social login automation or outreach are enabled. Published-only email is not delivery-verified. Shell/app/plugin tools remain disabled in the reused Codex research runner.

## Verification evidence

- npm test passes core behavior, metadata round-trip, direct-association validation, public-only status enforcement, contact deduplication and local API contacts-job validation/result delivery. Existing server authentication, Origin/Host boundaries, busy/cancellation and static asset allowlist checks pass.
- Python evidence tests cover visible email/tel extraction, script exclusion, nonexistent emails, mismatched people, nonexistent passages, recovery of an actual adjacent person/title passage, PDF signature detection and extracted PDF evidence.
- Browser integration tests cover the per-lead lookup, preview, explicit application, persisted contact addition, contactability score update and retention of sales notes. The broader import/export/storage suite passes.
- The native Mac app displayed Find contacts on a real saved lead. Starting it in the native window completed with three source-checked records: one relevant named professional and two separate general company channels. Results were left at Add selected contacts for user review; the user's register was not altered by the live check.
- The live check exposed a PDF agenda served at a URL without a PDF suffix. PDF detection/extraction was added and the actual person's name and stated projects-related role were confirmed in that public PDF. No direct work address/phone for that person was established; generic channels were not attributed to them.

The source check establishes public publication, not current employment, purchasing authority or email deliverability. Inaccessible sources, scanned PDFs and missing direct details can yield fewer results. Optional paid verification remains deferred. Real lookup results and source excerpts are stored only in ignored .local files.
