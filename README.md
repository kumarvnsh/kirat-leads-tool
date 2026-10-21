# Kirat Lead Desk

A local research tool and a browser-local dashboard for Kirat Creations signage, graphics, display and installation opportunities across India and Delhi NCR.

**Dashboard:** https://kumarvnsh.github.io/kirat-leads-tool/

## Start locally

Requires Node 20+; Harvey discovery also needs Python 3.11+ and Git.

```sh
npm start
```

Open http://127.0.0.1:4173. Only application assets are served. Stop with Ctrl+C.

The dashboard works on GitHub Pages too. Each browser and each origin has a separate register: localhost, GitHub Pages and the Claude Artifact do not share storage. To migrate, export a JSON backup in the old dashboard, import it in the new one, review, then confirm. The app starts empty. Records remain in IndexedDB on that browser; clearing site data removes them. Export backups regularly.

## Research workflow

```sh
node bin/kirat.js doctor
node bin/kirat.js harvey-setup
node bin/kirat.js discover 'New Delhi, India' 5
node bin/kirat.js prompt /path/to/latest-backup.json .local/candidates.json
```

Use `-` instead of the backup path only for an empty register. `harvey-setup python3.11` selects another supported Python command. The default is `python3.12`.

1. Export your latest register from the dashboard for exclusions.
2. Discovery queries OpenStreetMap and profiles business websites through Harvey. It enables free listing/website signals; paid providers, email and LinkedIn are disabled. A local adapter adds OSM clothing, shoes, jewellery and supermarket tags because upstream maps trades only. Supported cities: `New Delhi, India`, `Noida, India`, `Gurugram, India`, `Faridabad, India`, `Ghaziabad, India`, `Greater Noida, India`. Default is Delhi; limit is 1–25 per query. OSM coverage varies and does not establish buying intent.
3. Open `.local/research-prompt.txt` in a web-enabled Codex/Claude session on your Mac. Ask it to research one batch and save final JSON to `.local/batch.json`. The prompt includes the schema, candidate data and existing opportunities to exclude. National retail expansion research comes from web sources rather than the local OSM list. This handoff is deliberate: CLI login does not guarantee a session has web-search tools. If those tools are unavailable, use a web-enabled Claude Project and paste the prompt. Never accept unsourced model output.
4. Validate and import:

```sh
node bin/kirat.js validate .local/batch.json
```

5. Select the resulting file in **Import batch** on the dashboard. Review evidence and duplicates, then confirm. Export a fresh backup. Research never writes directly into your register.

Harvey candidates lack project dates and evidence; the adapter never invents those or maps Harvey's score onto Kirat's qualification score. Research aims for up to five qualified opportunities (roughly three national retail, two NCR), with fewer when evidence is weak. Find project/fit-out/expansion/regional/marketing managers, rather than company leadership. No command sends outreach.

### Existing Harvey data

```sh
node bin/kirat.js harvey-export 25
node bin/kirat.js candidates /path/to/harvey-export.csv
```

The first exports discovered companies from the local Harvey database. The second converts contact CSV into an unqualified candidate file, preserving email risk labels. It does not mark addresses verified.

## Storage and costs

- Lead batches, exports, credentials, Harvey checkout and database stay out of Git.
- `.local/` contains research work and installed dependencies. Protect it like your backups.
- GitHub Pages publishes only the app shell. A public page does not make your browser's records public or synchronize them elsewhere.
- Research runs only when started locally. It pauses while your Mac is off.
- Discovery uses free OSM; locally authenticated model research consumes the selected subscription's usage. There is no enforced subscription percentage or automatic paid API fallback.
- The dashboard loads React/htm and fonts from external CDNs, so it needs an internet connection on first load.

## Test and deploy

```sh
npm test
npm run build
```

The build allowlists four files: `index.html`, `lead-core.js`, `browser-store.js`, `.nojekyll`. GitHub Actions tests every push/PR and deploys only main to Pages. It never executes research or needs model/mail credentials. To deploy elsewhere, enable Pages with **GitHub Actions** as source.

Harvey is installed separately at commit `0041b6a3a9930426fb8f9beba64eb62438c96711`. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Transitive Python packages resolve at installation within upstream's ranges; re-run the pilot when updating dependencies.
