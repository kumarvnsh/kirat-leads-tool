# Kirat Lead Finder Implementation Plan

> **For agentic workers:** Use the executing-plans skill if implementing locally. This plan targets creation inside the user's Claude account; local files are handoff documents, not a deployed Artifact.

**Goal:** Create a private, manually updated Claude Artifact for reviewing and tracking source-backed sales opportunities for Kirat Creations.

**Architecture:** Research runs in a Claude Project conversation. The user transfers a validated JSON batch into a persistent dashboard; ordinary dashboard actions use no AI calls. An external link opens the independent Signage Studio.

**Tech Stack:** Claude Projects, Claude web search, a React Artifact, supported personal Artifact storage with explicit JSON backup fallback. No paid external APIs or scheduled backend.

## Deliverables and boundaries
- `claude-project-setup.md`: approved company context and bounded daily research workflow.
- `claude-artifact-build-prompt.md`: self-contained build instructions, schema and acceptance cases.
- `kirat-lead-batch-template.json`: empty schema-versioned research envelope.
- Artifact created by Claude: dashboard UI, record validation, merge preview, persistence, CSV and JSON export.

All handoff files live alongside this plan in outputs. No changes to the existing Studio, Git initialization, deployment, real outreach or third-party accounts are required. No subagents are needed. The initial dashboard build consumes Claude usage separately from daily research.

## Task 1: Establish the Project
- [ ] Create a private Claude Project named `Kirat — Lead Finder`.
- [ ] Paste the Project instructions from `claude-project-setup.md`.
- [ ] Add the approved design and `claude-artifact-build-prompt.md` as Project knowledge.
- [ ] Confirm web search is available in a research conversation; if unavailable, gather source URLs manually and label discovery as manual.
- [ ] Record the Claude usage reading before building; disable paid extra usage for this workflow if enabled.

## Task 2: Create the dashboard Artifact
- [ ] Paste the entire build prompt into a new Project conversation.
- [ ] Ask Claude to create one working React Artifact, with clearly named pure validation, scoring, deduplication and export helpers separated from UI logic within the supported Artifact structure.
- [ ] Require an empty production register. Any demo is an explicit, isolated mode using fictional data and no plausible personal contacts.
- [ ] Inspect the dashboard: import area, two lead segments, filters, evidence details, notes, statuses, follow-up date, save state, backup controls and Studio link must all be present.

## Task 3: Verify import and merge behavior
- [ ] Import an envelope with zero leads: accept it without changing the register.
- [ ] Import malformed JSON: show a parse error and preserve existing data.
- [ ] Import a lead missing source evidence: reject that record with a field-specific error and show remaining valid rows for review.
- [ ] Import the same domain/location/event twice: flag the duplicate and default to skip.
- [ ] Import a second branch for the same brand: flag related company, allow separate lead.
- [ ] Update a known lead: default to preserving ID, notes, owner, status, follow-up date and proposal reference; show changes before user confirmation.

## Task 4: Verify persistence and exports
- [ ] Save a record and reopen the Artifact: confirm it remains if the current runtime supports personal persistent storage.
- [ ] Simulate unavailable or failed storage: dashboard stays usable, displays `Unsaved — download backup`, and does not claim success.
- [ ] Export a JSON backup, clear only a temporary test register, then import it: compare every field including sales notes and status.
- [ ] Export a CSV containing commas, quotes, newlines and a company beginning `=1+1`: verify escaping and formula-injection protection.
- [ ] Confirm dates without times do not shift a day when rendered in India.

## Task 5: Run the pilot research batch
- [ ] Record current usage and provide the current register or explicitly state it is empty.
- [ ] Run the daily prompt with the exact envelope contract from the build prompt.
- [ ] Check every source URL, publication/event date, location, signal and public contact manually. Record unsupported fields as unknown; remove unqualified leads.
- [ ] Import, preview and approve the batch. Confirm no outreach or automatic AI requests occur.
- [ ] Record usage after the batch. Reduce the next batch if usage exceeds the user's intended allowance. Do not promise a numerical cap.

## Task 6: Check sales and Studio handoff
- [ ] Move one test record through New → Reviewed → Contacted → Follow-up → Qualified → Closed; retain notes.
- [ ] Open the Studio link in a new tab and confirm it points to `https://kiiratstudio.netlify.app/`.
- [ ] Confirm the dashboard makes no claim of uploading a brief or opening a project in the Studio. Manually enter a proposal reference after creating one there.
- [ ] Export a final JSON backup and retain the latest register for tomorrow's exclusion check.

## Completion criteria
Dashboard works in the user's Claude account; import validation, duplicate handling, sales-field preservation, storage failure, JSON round-trip, safe CSV and Studio link checks pass. At least one real bounded research batch has been source-checked. Any runtime limitation is documented accurately. Documents alone do not establish completion of these checks.

## Plan self-review
Covered: both customer segments; five-lead target; 90-day pilot window; source evidence and uncertainty; scoring; deduplication; manual transfer; private persistence and fallback; export backups; sales tracking; Studio boundary; budget/usage; no automatic outreach. No external crawler integration is required for this scope.
