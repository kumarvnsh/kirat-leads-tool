# Kirat local lead tool and GitHub Pages

Date: 21 October 2026

## Accepted direction
Run research on the user's Mac, host the dashboard on GitHub Pages under kumarvnsh, and use GitHub Actions for tests and deployment. Research stops while the Mac is off. Keep outreach manual and lead data local. Preserve the existing dashboard layout and qualification rules.

Alternatives considered: a self-hosted Actions runner adds maintenance and still needs the Mac; hosted research needs separate credentials and potentially API spend. Neither is part of this version.

## Repository and deployment
Create kumarvnsh/kirat-leads-tool if available; inspect an existing repository before reusing it. Track application source, tests, sanitized fixtures and instructions. Exclude research batches, outbox records, local databases, exports, credentials, logs and downloaded Harvey files. Stage files explicitly rather than uploading the workspace wholesale.

Actions runs core and integration checks on pushes and pull requests. Deploy only a deliberately assembled static application directory from the main branch. Publish the application shell, never research data. Repository visibility and Pages availability must be checked against the account before creation; public application source is acceptable for the requested Pages setup, while business records remain excluded.

## Dashboard
Reuse kirat-lead-desk.html and lead-core.js. Replace Artifact-specific persistence with browser IndexedDB storage, including a visible save state and backup download when saving fails. Preserve JSON batch preview, duplicate decisions, sales-field retention, search, filters, notes, follow-ups and exports. Keep the Signage Studio link.

The Pages dashboard is publicly reachable, starts empty and stores records in that browser's origin. Localhost, Pages, other browsers and the Claude Artifact have separate storage. Existing Artifact records move only through an explicit JSON backup/import. No automatic cloud sync or authenticated shared database is included.

## Local research tool
Provide a loopback-only launcher and CLI for configuration, discovery, candidate export, batch validation and dashboard startup. Run bounded batches on demand, defaulting to up to five qualified opportunities with approximately three national and two NCR when evidence supports it. No background service or self-hosted Actions runner.

Use Harvey as a separately installed, version-pinned upstream dependency for local business discovery and profiling, retaining its MIT license attribution. Document setup requirements and provider login checks. Disable email and LinkedIn channels; do not configure mail credentials or start Harvey's autonomous campaign loop. Prefer explicit discovery/profile commands, verified against the pinned release before implementation. Provider credentials stay with the local CLI and are never sent to GitHub.

Harvey CSV records are candidates, not qualified leads. A conversion step maps available company/contact fields into a candidate file without inventing project evidence or converting Harvey's score into Kirat's score. Preserve risky, guessed and invalid contact states in candidate metadata; never mark them verified or silently promote them to dashboard contacts.

Qualification uses a research prompt generated from the current exported register and candidate list in a locally authenticated research-capable CLI session. Record accessible source URLs, publication and event dates, project location and opening/expansion/renovation/rebranding evidence. Target project, fit-out, expansion, regional or marketing managers; do not default to CEOs or founders. No automated signed-in LinkedIn browsing. Missing facts stay unknown. A logged-in CLI alone does not guarantee web tools: setup verifies available research capabilities and gives an actionable manual research handoff if unavailable. No paid API fallback is enabled automatically.

Reuse the existing schema and validator. Return fewer opportunities when evidence is weak. Validation must exit unsuccessfully on malformed rows and produce a report; it must not overwrite the register. The user downloads/selects the local batch in the Pages dashboard, reviews sources and confirms import. No direct connection from the public site to localhost, no browser-stored GitHub token, no automatic publication of batches.

## Failure handling
Missing runtime, missing provider login, upstream discovery failure and blocked sources produce readable errors and retain prior output. Write batch files atomically. Keep research artifacts outside version control. Failed persistence keeps an explicit unsaved state and permits backup. No failure triggers outreach or weakens evidence requirements.

## Verification and acceptance
Run existing core tests and add focused checks for candidate conversion, invalid batch rejection, exclusion handling and storage failure. Browser-check empty startup, import preview, duplicate merge retaining notes/status, reload persistence, backup round trip, exports and source/Studio links. Test local launcher startup and shutdown. Ensure built deployment and tracked files contain no real batches or credentials. Confirm Actions succeeds and the actual Pages URL loads after deployment.

Perform a small live discovery pilot only after upstream setup and login checks succeed; report separately which research stages actually ran and which require manual input. Never claim qualification or verification merely because a candidate was found.

## Review status
Architecture direction accepted in chat. Written implementation contract awaits user review before planning and coding, as requested by the brainstorming workflow.
