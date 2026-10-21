# Daily use

1. Run `npm start` or open https://kumarvnsh.github.io/kirat-leads-tool/.
2. Export your latest register as a JSON backup.
3. Run `node bin/kirat.js discover 'New Delhi, India' 5`.
4. Run `node bin/kirat.js prompt /path/to/backup.json .local/candidates.json`.
5. Open `.local/research-prompt.txt` in a local web-enabled Codex/Claude session. Ask for one bounded batch saved to `.local/batch.json`.
6. Run `node bin/kirat.js validate .local/batch.json`.
7. Import the JSON in the dashboard, review source links and duplicate decisions, then confirm. Export a backup.

For a fresh install, first run `node bin/kirat.js harvey-setup` (Python 3.12 by default). See README for supported cities and runtime alternatives. For an empty register use `-` as the prompt command's first argument.

Research results do not appear automatically. Browser storage is separate between the local dashboard, Pages and the original Claude Artifact. Move data using JSON backup/import. Contacts and outreach remain manual.
