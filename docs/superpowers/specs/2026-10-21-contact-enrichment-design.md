# Public contact enrichment

Approved by the user's “do it” following the proposed Find contacts workflow: add public-first contact enrichment to each qualified opportunity, with optional paid verification deferred.

Find contacts in a saved lead's details starts one local cancellable job. Harvey Scout public-site fetching and team parsing collect website contact candidates; the existing restricted Codex web research finds relevant projects, fit-out, expansion, regional or marketing people. No full autonomous Harvey loop, paid lookup, email guessing, SMTP probing, account scraping or outreach is enabled.

The job validates contacts and opens supporting URLs through Harvey's public HTTP boundary. New contacts carry source excerpts, check dates and direct/company/unknown ownership. A direct address must have a named person and a supporting passage associating them; a business inbox or switchboard remains a separate company channel. Published means observed in a public source, not delivery-verified. Unreachable, guessed, risky or invalid contacts are not promoted to usable contacts. Missing details remain unknown.

Results are previewed in the lead detail. The user explicitly adds contacts; names, sources and dates remain inspectable. Existing contacts, sales notes, owner, follow-up, status and project evidence stay intact. Optional contact metadata survives JSON backup/import and CSV export. The static Pages site displays saved contact metadata but does not run local jobs. All actual contacts/results remain local.

Tests cover malformed results, association validation, source matching, missing/blocked pages, metadata round trips, local job validation/cancellation, duplicate-safe application and notes retention. Smoke-test a real known company and the native preview before pushing and deploying.
