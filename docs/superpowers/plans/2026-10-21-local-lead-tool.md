# Kirat Local Lead Tool Implementation Plan

> Execute inline using executing-plans. Track each task below; preserve the approved local research and static hosting boundary.

**Goal:** Deploy an empty, persistent lead dashboard and provide local discovery and qualification commands.

**Architecture:** Reuse the existing UI and validation core. IndexedDB replaces Artifact storage. A Node CLI serves loopback files, validates batches, prepares exclusion-aware research prompts and invokes pinned Harvey discovery commands. Only allowlisted static assets deploy.

**Tech Stack:** Node standard library, React/htm existing UI, IndexedDB, Python Harvey venv, GitHub Actions/Pages.

## Tasks
- [ ] 1. Add .gitignore and build allowlist; write build assertions checking no research data is deployed. Run existing core tests before changes.
- [ ] 2. Extract browser persistence into browser-store.js, using IndexedDB transactions and serialized UI writes. Test persistence, deletes and failures through browser checks; preserve backup and memory recovery.
- [ ] 3. Add CLI commands: serve, doctor, harvey-setup, discover, candidates, prompt, validate. Inspect pinned upstream CLI before integrating. Keep channels disabled, paid providers opt-in, raw data local and atomic writes. Test CSV quotes/newlines, invalid batches and exclusions using fictional data.
- [ ] 4. Update dashboard text and documentation for Pages/local separation, manual JSON migration and local workflow. Remove Artifact inbox assumptions from the deployed application.
- [ ] 5. Add Actions test/build/deploy workflow. Build dist with only index.html, lead-core.js and browser-store.js. Run node tests, syntax checks and browser checks. Review git tracked files for real research data.
- [ ] 6. Create kumarvnsh/kirat-leads-tool, push source, enable Pages workflow deployment. Check workflow completion and deployed URL. Run local doctor and discovery pilot if runtime/network permit. Report provider/web research limitations truthfully.

## Acceptance commands
`node test/test-core.js`, `node test/test-tool.js`, `node scripts/build.js`, `node bin/kirat.js doctor`, `node bin/kirat.js serve`.

Browser acceptance: import fictional fixture; confirm preview; edit notes; reload; merge duplicate retaining sales fields; export backup; inspect console and failed-save recovery. Deployment acceptance: Actions passes, published URL responds, source distribution excludes research, tokens and local configuration.
