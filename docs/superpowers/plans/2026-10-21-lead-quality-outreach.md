# Lead Quality and Outreach Implementation Plan

**Goal:** Deliver the approved discovery, priority, verification and draft workflows in the local Mac app.
**Architecture:** Reuse the single-job worker and local-only UI. Optional fixed-endpoint providers keep credentials server-side. Optional validated lead fields preserve backup compatibility.
**Tech stack:** Node standard library, React/htm, existing Codex research worker, native WKWebView host.

Execute inline in this session; existing authorization includes installation and GitHub deployment.

- [ ] Add failing tests in test/test-quality.js for private settings, sanitized provider failures, Hunter status mapping, bounded Serper results, project-stage validation, draft validation and backup preservation. Run `node test/test-quality.js` and confirm missing functionality.
- [ ] Add lib/providers.js for private settings, fixed-endpoint bounded HTTP requests, Hunter email verification and five-query Serper discovery. Keep response errors generic and never log credentials.
- [ ] Extend lead-core.js optional project-stage, deliverability and draft fields; validate nested shapes and preserve local drafts during research merge. Add stage priority ordering and CSV fields.
- [ ] Add lib/outreach.js for grounded prompt and exact three-email response validation. Extend worker and coordinator with draft/verify jobs, target binding, staged results and cancellation. Research must not reuse stale candidates after discovery failure.
- [ ] Extend local-server.js settings endpoints; use existing cookie/origin protections. Add settings and quality panels in local-panel.js; add detail/table stage and priority UI in kirat-lead-desk.html. Persist edits through existing store callbacks; confirm replacement of existing drafts.
- [ ] Extend fake-worker and API/browser tests for credentials, staged jobs, draft edits, verification review, malformed input and static exclusion. Run `npm test`, Python evidence checks, browser suites and `npm run build`.
- [ ] Rebuild/install Mac app, exercise native controls and a live draft job without paid keys. Record actual checks and limits in verification document. Commit reviewed changes, merge to main, push existing authorized repository and confirm Actions deployment.
