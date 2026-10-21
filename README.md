# Kirat Lead Desk

A local research tool and a browser-local dashboard for Kirat Creations signage, graphics, display and installation opportunities across India and Delhi NCR.

**Dashboard:** https://kumarvnsh.github.io/kirat-leads-tool/

## Mac app

On this Mac, open **Kirat Lead Desk.app** in your Applications folder (also searchable in Spotlight). It starts the local service and displays the dashboard inside its own native Mac window, with standard menus, file pickers and Save dialogs. No browser or Terminal is needed for normal use. First launch installs Harvey project dependencies if needed. Use **Find leads** to discover candidates and run Codex web research, then **Review researched leads** to check/import results. Use **Stop** to cancel a job and **Quit local service** when finished.

For another checkout on a Mac, double-click `Install Kirat Lead Desk.command` once. It builds a native Swift/WebKit app under `~/Applications` (requires Apple Command Line Tools); keep the project folder in place because the launcher points to it. Node 20+ and Python 3.11+ must be installed; setup reports a missing runtime. The installed Codex CLI must be signed in for web research. Dependencies and runtime setup need internet access.

Research uses your local ChatGPT/Codex login, live web search, an empty temporary working directory, a read-only sandbox, and disabled shell/app/plugin tools. The model returns JSON; the local app validates and stages it for review. Pages has no local controls or job API. A bounded research job can take several minutes and consumes subscription usage. If web research fails, a manual prompt is kept in `.local/research-prompt.txt`.

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

## Find people and business contacts

Open a saved lead and choose **Find contacts** under **People and public contacts**. The local job uses pinned Harvey Scout public company/contact/team pages plus restricted Codex public web research. It looks for projects, fit-out, expansion, regional, procurement or marketing staff and any published work channels.

Review the proposed contacts and their supporting passages, then choose **Add selected contacts**. Contacts are added without replacing existing contacts or sales notes/status. The contactability part of the score updates from the accepted people and business channels. Duplicate values are skipped. You can use Copy, Email or Call manually after adding an appropriate channel; nothing is sent automatically.

A named person, a direct work address, and a company inbox/switchboard are distinct records. Every new result has a checked date and source. The checker opens HTML or text-based PDF sources, rejects missing details and unsupported direct associations, and does not treat search snippets as proof. Scanned PDFs and inaccessible profiles may produce no result. **Published only does not mean email deliverability is verified.** No email patterns, SMTP probes, paid services, logged-in social scraping or private phone lookups are enabled. Optional paid verification is deferred.

The Mac app can find contacts; Pages can display/export already saved contacts but cannot run local jobs. Additional PDF-reading dependency is installed by Repair setup. Existing installations can use Repair setup if a PDF source cannot be read.

## Storage and costs

- Lead batches, exports, credentials, Harvey checkout and database stay out of Git.
- `.local/` contains research work and installed dependencies. Protect it like your backups.
- GitHub Pages publishes only the app shell. The Mac app has its own persistent register, separate from Safari, Chrome and Pages. Use JSON backup/import to move records. A public page does not publish or synchronize these records.
- Research runs only when started locally. It pauses while your Mac is off.
- Discovery uses free OSM; locally authenticated model research consumes the selected subscription's usage. There is no enforced subscription percentage or automatic paid API fallback.
- React/htm are bundled locally. Fonts may load from Google Fonts, with system-font fallbacks. Discovery and research require internet access.

## Test and deploy

```sh
npm test
npm run build
```

The build allowlists `index.html`, `lead-core.js`, `browser-store.js`, `.nojekyll`, the two logo assets and vendored browser libraries. Local controls and job endpoints are excluded. GitHub Actions tests every push/PR and deploys only main to Pages. It never executes research or needs model/mail credentials. To deploy elsewhere, enable Pages with **GitHub Actions** as source.

Harvey is installed separately at commit `0041b6a3a9930426fb8f9beba64eb62438c96711`. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Transitive Python packages resolve at installation within upstream's ranges; re-run the pilot when updating dependencies.

The company logo is supplied by Kirat Creations. The app icon uses the logo symbol on a light rounded square; the original SVG is retained in assets.
