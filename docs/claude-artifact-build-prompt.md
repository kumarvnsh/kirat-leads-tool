# Paste this into a new chat in your Kirat Claude Project

Create a working private React Artifact named **Kirat Lead Desk**, following the requirements below. Build the dashboard now; do not start lead research during the build. Use the Artifact capabilities actually supported by this runtime and do not invent storage APIs, browser access or integrations. If a capability is unavailable, use the explicit fallback below.

## Purpose
Kirat Creations designs, fabricates and installs signage, graphics, retail displays and branding across India. This dashboard tracks a manually researched daily shortlist, covering:
1. `national_retail`: retail chains and franchises across India.
2. `ncr_local`: local businesses in Delhi, Gurugram, Noida, Greater Noida, Faridabad and Ghaziabad.

Research occurs in a separate Project conversation using web search. I manually import the resulting JSON. Do not add a Find leads button that pretends to browse, an automatic daily scheduler, API keys, external API calls, automatic outreach or a fake usage-percentage meter. Ordinary UI actions must not invoke AI. The existing Claude subscription is already paid for; introduce no additional paid services.

## UI
Create a clean, readable dashboard suitable for daily use on desktop and mobile. Use a restrained cream/charcoal palette with a warm orange accent, clear typography and visible save/error states. Prioritize useful controls over decoration.

Header: Kirat Lead Desk; Import batch; Export backup; Export CSV; Open Signage Studio.
Summary: total leads, new leads, qualified leads and follow-ups due. Follow-ups due means a non-Closed record with a follow-up date on or before today's date in Asia/Kolkata.
Filters: text search, segment, city, service, minimum score and status. Include a clear-filters control. CSV export defaults to the filtered view and states the count; full JSON backup always includes all records.
Lead list: company, branch/project, location, opportunity, score, confidence, research date, status and follow-up date. Clicking a lead opens readable details with clickable evidence URLs, contact source, score breakdown and sales edits.
Editable sales fields: owner, status, notes, follow-up date and Studio proposal reference. Status values: `New`, `Reviewed`, `Contacted`, `Follow-up`, `Qualified`, `Closed`.
Show factual signal evidence separately from inferred signage opportunity. A contact being public does not mean its deliverability has been verified.
Start with zero real records. Include an explanatory empty state. Never invent real leads or contacts. If demo mode is offered, isolate its fictional records from the real register and label all demo views and exports.

## Research batch contract
Accept this JSON shape. Every lead must include all listed fields; unknown optional information uses null or an empty array as shown. Input sales fields are allowed only for backup restoration; new research batches initialize the sales values locally.

```json
{
  "schema_version": 1,
  "batch_date": "2026-10-19",
  "leads": [
    {
      "id": null,
      "company": "Fictional Example Retail",
      "domain": "example.com",
      "branch_project": "Fictional Delhi outlet",
      "segment": "ncr_local",
      "city": "Delhi",
      "state": "Delhi",
      "website": "https://example.com/",
      "signal_type": "opening",
      "opportunity": "Potential storefront signage; requirement is inferred, not confirmed.",
      "services": ["Signage"],
      "publication_date": null,
      "event_date": null,
      "researched_on": "2026-10-19",
      "evidence": [
        {
          "url": "https://example.com/",
          "title": "Fictional schema example — not a real opportunity",
          "summary": "This record explains the format only and must not be loaded as a real lead."
        }
      ],
      "contacts": [],
      "buyer_role": "Projects or procurement team — role to seek, not an identified person",
      "score": {"service_fit": 2, "project_evidence": 1, "timing": 0, "contactability": 0},
      "confidence": "low",
      "next_action": "Verify actual project details before approaching.",
      "owner": "",
      "status": "New",
      "follow_up_date": null,
      "notes": "",
      "studio_reference": ""
    }
  ]
}
```

The example is a contract illustration only. Do not preload it or count it as qualified. Use today's actual date for future real batches; never reuse the illustrated date as a default.

Contacts use `{"type":"email|phone|contact_page|person","value":"publicly listed value","source_url":"https://...","verification":"published_only|verified"}`. A `person` is the manager who handles the work (store projects or fit-out, retail expansion, area or regional manager, or marketing for in-store branding), not the CEO, MD or founder, named in a public source or LinkedIn: `value` is their name and `role` (required) is their title as stated, with the source's date if it may be old. Never guess personal emails or phone numbers. Default to `published_only`; research cannot claim verified deliverability without actual verification evidence. Reject verified contacts lacking an additional `verification_evidence` explanation.

Signal types: `opening`, `expansion`, `renovation`, `rebranding`, `other`. Confidence: `low`, `medium`, `high`. Services: `Signage`, `Graphics`, `Display Units`, `Turnkey Solutions`, `Installation`, `Maintenance`.

Required qualification: nonempty company, project/branch, city, segment, dated research record, opportunity, at least one accessible-format HTTP(S) evidence URL with a nonempty summary, service_fit ≥1 and project_evidence ≥1. URL format validation does not establish that a page is reachable or true. Preserve a clear manual source-verification reminder. Do not reject a genuine record just because contacts, domain, publication date or event date are unknown.

Validate enum values, field types, real ISO calendar dates and integer scores within their ranges. Ranges: service_fit 0–3, project_evidence 0–3, timing 0–2, contactability 0–2. Derive total 0–10 rather than accepting an independent total. Missing timing evidence scores zero. Missing contact information scores zero. Allow historical backups; flag old records rather than deleting them. Never treat an inferred opportunity as a confirmed buying requirement.

## Import, identity and merging
Support file upload and pasted JSON. Reject oversized input above 5 MB with a clear message before parsing. Ignore unexpected fields by selecting allowed properties; render imported text as text, never raw HTML. Only HTTP(S) website/source links are clickable, using safe new-tab behavior.
Validate every row and show row-specific errors. Keep existing saved data intact. Preview valid rows and duplicates before any write; let me confirm or cancel. Do not silently discard invalid rows or silently import the valid subset.
Generate a stable ID once when a new lead is accepted, using a supported unique-ID mechanism. Preserve it on export/import.
Normalize domains by lowercasing and removing scheme, path and leading www. Compare company domain (or normalized company name when absent), normalized branch/location and signal/event to flag likely duplicates. A matching known ID is an update candidate, not permission to overwrite sales fields. Same brand at different sites can remain separate leads.
Default duplicate action is Skip. Offer explicit Merge or Keep separate. Merge retains existing ID, notes, owner, status, follow-up date and Studio reference; show proposed research-field changes before confirmation. Never overwrite existing evidence with an empty list. De-duplicate evidence URLs and contacts when combining them.

## Storage and backup
Use personal persistent Artifact storage only if a documented capability is actually available. Never use shared/global storage for this private register. Version the saved envelope with schema_version, exported_at and leads. Saved records include the same lead fields, non-null stable IDs and sales edits.
Read existing records before enabling imports that could replace them. On load errors, preserve the stored value and do not automatically initialize over it. Clearly distinguish Saved, Saving and Unsaved states. Avoid stale autosave writes overwriting newer edits.
If persistence is unsupported or fails, keep in-memory functionality, display `Unsaved — download backup`, and offer full JSON download. Do not claim in-memory data survives reloads. Never silently replace a personal store with a shared one.
Backup restore uses a preview. Match IDs and provide explicit choices for updates; preserve existing sales fields unless I explicitly approve replacing them from the backup. JSON export/import must retain every allowed field. Treat the latest exported JSON as tomorrow's research exclusion register.
CSV export must quote values containing separators, quotes or newlines; double embedded quotes; prefix formula-like string cells beginning with optional whitespace followed by =, +, -, @ or control characters with an apostrophe. Apply spreadsheet formula protection to every exported textual cell. Keep the JSON backup values unchanged. Flatten evidence/contact fields into readable text columns.
Use ISO date-only values for follow-up and event dates; display them without UTC conversion that shifts the calendar day. Show research dates and age transparently.

## Studio handoff
Open Signage Studio links to https://kiiratstudio.netlify.app/ in a new tab. This is a separate tool for logo/artwork, constructions and presentation visuals after a real brief exists. Do not imply common storage, upload artwork, pass contact information in the URL or invent a Studio API. Studio reference is just a manually entered project/proposal reference.

## Usage and privacy
Show a small note: `Research is manual in your Claude Project. Check Claude's usage screen before and after each batch; this app cannot enforce a subscription percentage.` Do not promise five researched leads fit 10–20% of a five-hour allowance. No AI call should fire at startup, filtering, editing or exporting. Do not send lead data to analytics or other services. Keep all contact and outreach actions manual.

## Verify before claiming completion
Check these behaviors in the available runtime and report what was actually tested:
- Empty batch changes nothing; malformed JSON and wrong schema version preserve the register.
- Missing evidence or out-of-range scores produce row errors before saving.
- Same ID or same domain/site/event prompts for duplicate review; a separate branch can be retained.
- Re-import cannot silently overwrite notes or status.
- Storage failure visibly offers backup; reopening preserves data only when supported persistence succeeds.
- JSON round-trip retains notes, score parts, evidence and status.
- CSV safely handles commas, quotes, newlines and a formula-like company name.
- Search, segment/city/service/status/score filters and follow-ups due work.
- Source links and the exact Studio URL work; no outreach or AI request is triggered.

After building, explain in a few sentences: how to import today's batch, how to back up, which storage mode is actually active, and any checks you could not execute. Do not mistake successful rendering for verified persistence.
