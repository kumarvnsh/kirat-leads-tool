# Kirat local tool verification

Date: 21 October 2026

## Delivered

- Repository: https://github.com/kumarvnsh/kirat-leads-tool
- Dashboard: https://kumarvnsh.github.io/kirat-leads-tool/
- Local loopback launcher, IndexedDB persistence, native JSON/CSV downloads, validation, candidate conversion, exclusion-aware research prompts and pinned Harvey discovery/profile integration.
- GitHub Actions runs tests/build and deploys the static application only. No research, email or model credentials in Actions.

## Evidence

`npm test` passes core qualification/import/export tests, CSV parsing and candidate conversion, malformed batch rejection, prompt exclusions, atomic writes, deployment allowlist and local server file/Host/method boundaries. `npm run build` produces only index.html, browser-store.js, lead-core.js and .nojekyll. Python bridge and browser test compile; browser and inline JavaScript parse.

`test/browser-check.py` passed against both localhost and the deployed Pages URL in isolated Chromium contexts: import preview and confirmation, notes surviving reload, duplicate merge preserving sales notes, JSON and CSV downloads, backup restore to a fresh browser store, persisted deletion, failed reads blocking imports, memory recovery, failed write and successful retry. No page JavaScript errors in the normal flow. The deployed URL returned HTTP 200. Initial GitHub Actions test/build and deployment both succeeded (run 39613439184).

The local Harvey pilot queried three New Delhi retail candidates at reported $0 cost, storing three companies and six source observations. None had a website, so website profiling had no eligible sites in this pilot. Candidates remain unqualified in the ignored .local directory. No messages were sent. Website profiling is wired to the pinned upstream stage but not established by this particular live sample.

## Operating limits

Qualification still requires a web-enabled research session and human evidence review; the tool does not infer buying intent from a listing. Codex CLI login status passed; Claude auth status did not pass the local readiness check. No automatic paid fallback is configured. Existing Claude Artifact records were not accessed or migrated: use explicit backup/import. GitHub Pages, localhost and the Artifact have separate storage. Records are not synchronized across browsers. Export backups regularly.

Browser checks are optional integration tests using the Playwright Python dependency installed with Harvey and an installed Chrome:

```sh
npm start
.local/venv/bin/python test/browser-check.py
.local/venv/bin/python test/browser-check.py https://kumarvnsh.github.io/kirat-leads-tool/
```

Tests use fictional data and isolated browser contexts. They do not touch the user's normal browser profile. Downloaded test artifacts go to a temporary directory.
