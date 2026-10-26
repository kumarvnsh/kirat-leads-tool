# Kirat Lead Finder — approved direction and proposed integration

Date: 19 October 2026

## Objective
Help Kirat Creations identify timely signage, graphics, retail display and installation opportunities. Use a manually started Claude Project research session and a private Artifact dashboard. Target pan-India retail chains/franchises and local businesses in Delhi NCR.

## Existing Signage Studio
Reviewed https://kiiratstudio.netlify.app/ and its publicly served application bundle. The page describes a logo-to-sign prototype. The bundle includes artwork import, construction selection, 3D presentation, PNG/presentation exports, DXF/CSV exports and local project backups. This is a source inspection, not a functional test. Browser-local autosave is present; a shared backend or lead-management API has not been established.

Use the Studio after qualification: lead discovery → human contact → obtain brief/artwork → open Signage Studio → create a proposal visual. Version one adds an ordinary link to the Studio and optional manually entered proposal/project reference. It does not transfer artwork, share storage or modify the existing Studio. The two sites' browser storage must not be treated as shared.

## Daily workflow
1. User opens a fresh chat in the Claude Project and supplies the current lead register/export or an explicit existing-company exclusion list.
2. User starts one bounded research batch, targeting up to five new qualified leads, approximately three national and two NCR when evidence supports the split.
3. Claude searches public sources for new openings, expansion, refurbishment or rebranding. Start with announcements within 90 days and record opening dates separately from publication dates.
4. Claude returns a concise shortlist plus structured data suitable for dashboard import. The user explicitly imports/pastes the batch. Conversation output is not assumed to update Artifact storage automatically.
5. Dashboard previews additions, flags duplicates, then saves approved records. User reviews evidence, chooses whom to contact and updates status.
6. Export a full JSON backup after each batch; CSV is for sales use. Contacting people remains a manual action.

Five leads is a target, not a guarantee. Return fewer rather than dilute evidence. The 90-day window is a proposed pilot default, adjustable later.

## Record fields
Stable lead ID; company/brand; branch or project; segment; city/state; website; opportunity summary; suggested Kirat service; publication date; event date if known; source URL and supporting excerpt/paraphrase; date researched; publicly listed business contact and its source; buyer role to seek; score breakdown; confidence; next action; owner; status; follow-up date; notes; optional Studio project/proposal reference.

Unknown values remain blank. Distinguish headquarters from project location and decision makers from inferred buyer roles. Never invent people, email patterns, phone numbers, dates or buying intent. Store contact verification state separately from whether an address is published.

## Qualification and deduplication
Score 0–10: service fit 0–3, specific project evidence 0–3, timing 0–2, business contactability 0–2. Require an attributable project signal and service fit for the qualified shortlist; a high score cannot compensate for missing evidence. Scores prioritize research, not predict sales or confirmed purchase intent.

Compare normalized company domain + branch/project location + signal/event. Flag same-brand opportunities for review rather than merging all branches automatically. Records without a domain use normalized company name and location. Import never overwrites sales notes or statuses silently.

## Dashboard scope
Search and filters for segment, location, service, score and status; lead cards/table; source links; detail view; notes; follow-up dates; manual statuses New, Reviewed, Contacted, Follow-up, Qualified, Closed; CSV export; JSON backup/import; ordinary Open Signage Studio link. Status does not itself send messages or trigger research.

Use personal persistent Artifact storage if supported by the user's plan and environment. Check availability during implementation. If unavailable or saving fails, use explicit JSON import/export and a clear unsaved indicator. Keep the dashboard private. Avoid relying on Claude Project memory as the lead database.

## Components and boundaries
- Project instructions: customer profile, research rules, scoring and output contract.
- Research conversation: web discovery and source-backed qualification, initiated by user.
- Import validator: schema checks, duplicate preview and safe merge.
- Artifact dashboard: deterministic filtering, editing, storage and exports. Ordinary clicks do not need AI calls.
- Signage Studio: independent proposal/design tool, opened by link.

Flow: public source → research record → user-reviewed import → saved lead register → manual sales follow-up → Studio when a real brief is available.

## Cost and usage
Incremental external-service budget: under ₹2,000/month, excluding the existing Claude subscription. Version one introduces no paid API, hosting or crawler account. Claude research and Artifact creation still consume subscription usage. There is no established programmatic percentage meter or enforceable 10–20% quota cap.

Use one small batch, concise outputs, fresh daily chats and the latest exclusion register. Check the Claude usage screen before and after initial pilot runs. Reduce batch size or skip a run when necessary; do not enable paid extra usage for this workflow. Initial dashboard creation consumes usage separately from steady daily research. No guarantee that five researched leads fit the desired percentage.

## Open-source decisions
Reviewed candidates: Crawl4AI (https://github.com/unclecode/crawl4ai), Firecrawl (https://github.com/firecrawl/firecrawl), Fire Enrich (https://github.com/firecrawl/fire-enrich), Twenty (https://github.com/twentyhq/twenty), Activepieces (https://github.com/activepieces/activepieces).

Defer all five integrations for this manual subscription-based version. Their services do not automatically run inside a Claude Artifact or draw on the chat subscription. Crawl4AI is a future extraction candidate, Fire Enrich an enrichment reference, Twenty a possible CRM and Activepieces a future scheduler. Recheck license files, maintenance, dependencies and costs at the chosen version before adoption. Repository documentation was reviewed; these integrations were not installed or tested.

## Failure handling and validation
Blocked/inaccessible sources: record the failure and seek an accessible source; no bypass dependency. Conflicting dates: preserve uncertainty and do not label the event confirmed. Missing contacts: keep blank and suggest a buyer role. Import errors: explain rejected rows without discarding the current register. Storage failure: show unsaved state and allow backup download.

Acceptance checks: import a valid batch; reject malformed rows; flag duplicates; retain notes/status on re-import; reopen and confirm storage where supported; round-trip JSON without data loss; safely export CSV including formula-like cell values; filter both segments; open evidence and Studio links; verify no contact is sent automatically. Manually check every source in the first research batch and record lead acceptance and usage observations.

## Next step
User reviews this written spec, including the proposed Studio handoff, 90-day evidence window and manual import boundary. After approval, prepare the implementation plan and complete ready-to-paste Artifact build prompt. This document contains design and operating instructions, not an implemented dashboard.
