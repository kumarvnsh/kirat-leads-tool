# Contact Enrichment Implementation Plan

Use the existing local worker, API, sandboxed Codex runner and import boundaries.

- [x] Extend optional contact metadata in lead-core.js; add meaningful round-trip and validation tests.
- [x] Extract reusable restricted Codex invocation; add contact prompts/result normalization and strict public-only labels.
- [x] Add a Python bridge using pinned Harvey Scout and public HTTP for bounded contact collection and source attestation. Test with fictional HTML and mocked HTTP.
- [x] Add contacts jobs to the current manager; validate lead snapshots and stage per-lead output separately from lead research batches.
- [x] Add a local-only per-lead Find contacts panel with progress/cancel, source preview and explicit duplicate-safe apply. Preserve all sales fields.
- [x] Run Node tests, Python contact parser/source tests, browser contact flow and native smoke check. Run one live company lookup, document limits, commit/push and verify Pages deployment.
