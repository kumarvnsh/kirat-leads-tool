# Kirat Lead Desk

A local research tool and a browser-local dashboard for Kirat Creations signage, graphics, display and installation opportunities across India and Delhi NCR.

**Dashboard:** https://kumarvnsh.github.io/kirat-leads-tool/

## Mac app

On this Mac, open **Kirat Lead Desk.app** in your Applications folder (also searchable in Spotlight). It starts the local service and displays the dashboard inside its own native Mac window, with standard menus, file pickers and Save dialogs. No browser or Terminal is needed for normal use. First launch installs Harvey project dependencies if needed. Open **Leads → Find leads → Start research** to discover candidates and run Codex web research, then **Review researched leads** to check/import results. Use **Stop** to cancel a job. Service repair and shutdown are under **Settings → Advanced**.

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

A named person, a direct work address, and a company inbox/switchboard are distinct records. Every new result has a checked date and source. The checker opens HTML or text-based PDF sources, rejects missing details and unsupported direct associations, and does not treat search snippets as proof. Scanned PDFs and inaccessible profiles may produce no result. **Published only does not mean email deliverability is verified.** No email patterns, SMTP probes, paid services, logged-in social scraping or private phone lookups are enabled. The separate optional verification action is described below. Contact discovery itself does not use paid services.

The Mac app can find contacts; Pages can display/export already saved contacts but cannot run local jobs. Additional PDF-reading dependency is installed by Repair setup. Existing installations can use Repair setup if a PDF source cannot be read.

## Better discovery and outreach preparation

**Find leads** researches upcoming rollouts and ongoing fit-out, renovation and rebranding, with completed openings ranked lower when the project stage is supported by evidence. Stage annotations include the source, checked date and uncertainty. Existing leads without an annotation show **Stage unknown**; no stage is guessed from an event date. A project announcement does not establish an available procurement requirement.

Under **Local provider settings (optional)**, add a [Serper](https://serper.dev/) key for broader project discovery and/or a [Hunter](https://hunter.io/api-documentation/v2#email-verifier) key for email verification. These are optional third-party services with their own credits and costs. Serper uses at most five searches per user-started discovery/research job; search results are starting points, not qualified leads. Research falls back to fresh Codex web research if discovery fails. Without Serper, existing Harvey OSM discovery remains available.

Every discovery/research run also adds two free, keyless sources: Google News RSS (three queries, last 90 days; Google's feed terms describe personal, non-commercial reading) and open GeM tenders for signage, signboard and display board (three searches, linking to the bid PDF). If either is unavailable the run continues without it. Both are unqualified candidates. Research includes a GeM tender only for Delhi-NCR signage/graphics/display supply. CPPP is not used because it blocks scripted requests.

Keys are stored in `.local/provider-settings.json` with owner-only file permissions. The app displays only configured/not configured. Blank password fields keep existing keys; use the separate Remove buttons to delete a key. They are excluded from Git, Pages, prompts and register backups. Provider calls use fixed HTTPS endpoints and do not automatically retry.

Open a lead and select **Verify [email]** to submit that one saved address to Hunter. Review the result and choose **Save verification result**. Deliverable, risky/catch-all, undeliverable, pending and unknown remain distinct. A publication check stays separate from the provider's deliverability assessment; neither guarantees delivery. The request date and Hunter's verification date (when supplied) are shown separately because Hunter may return a cached check. Pending results require a new explicit action to check again. Risky or undeliverable addresses do not count as usable channels or display the Email shortcut.

Choose **Draft outreach** to create one initial email and two optional follow-ups using the local Codex login and saved project evidence. This uses Kirat-specific prompts rather than enabling Harvey's autonomous campaign engine. Review, choose **Save generated drafts**, edit the subject/body, and choose **Save draft edits**. Drafts are included in JSON/CSV exports. Replacing saved drafts requires explicit confirmation. Results from changed source facts cannot be applied. Merging research preserves saved drafts; merging a backup fills a missing draft and carries newer delivery evidence without discarding contact publication sources.

Draft generation itself never sends. Mailbox connection and individually approved sending are available separately in the Mac app as described below. The Mac must be running for local jobs. The Pages dashboard can display/edit imported drafts and export saved metadata, but provider settings and generation/verification jobs are available only in the Mac app.

## Individually approved email sending (Mac only)

**Settings → Email settings** connects `sales@kiratcreations.com` to its cPanel SMTP/IMAP server. Open **Mailbox setup**, enter the mailbox password and save it in macOS Keychain. Kirat never reads the account password from Apple Mail. If the helper is missing, run `npm run install:mac`. The sender defaults to Business Development Team; the company signature includes Kirat's logo, tagline, phone, email and website. Email uses plain text plus HTML and an embedded high-resolution PNG, with no remote image requirement.

1. Use **Test connection without sending**. The app checks SMTP/IMAP login and the Sent folder; choose a folder explicitly if the server cannot advertise one.
2. Under **Controlled test and sending readiness**, queue a test to an address you control. Open its complete preview in **Emails → Needs approval**, then **Approve this email**. Enable **approved test only** to submit that exact test. The app pauses after it. Check receipt and signature, then review SPF/DKIM/DMARC and your provider's sending policy before confirming readiness.
3. Open a saved lead, generate and save outreach drafts, then select a published contact under **Prepare email for approval**. Unknown/risky delivery requires explicit acknowledgement; undeliverable and suppressed addresses are blocked. Select a saved draft or write/edit the email and queue it. The company website is included as a link; no brochure is attached automatically.
4. Open **Emails → Needs approval**, preview the complete recipient/subject/body/signature and approve that one email. Every follow-up and reply needs its own approval. Editing a queued item revokes its approval. A follow-up references a preceding email and waits three or seven business days after it was sent.
5. Enable individually approved sending after the controlled test. The default limit is 10 submission attempts per Kolkata calendar day, at least five minutes apart, weekdays 10:00–17:00 Asia/Kolkata. These are starting limits, not an inbox-placement guarantee. Closing/reopening the native app pauses sending. Browser fallback uses an open-window lease and a best-effort page-close pause; an already submitted message cannot be recalled.

IMAP sync reads new UIDs whether already read in Apple Mail or not, without marking messages read. Replies stop follow-ups. Opt-outs and bounces suppress the address across all leads. Ambiguous matches pause sending and wait for manual association. Long replies have bounded previews, with a separate expanded view; Apple Mail retains the full mailbox content. Initial sync covers a bounded recent UID range; large backlogs or incomplete sync pause sending rather than skipping messages. No automatic reply agent or full Harvey heartbeat is enabled: prepare replies from the inbox section and approve them individually.

The Outbox shows every active item and the latest 50 closed items (up to 200 active items). “Sent” means SMTP acceptance, not inbox delivery. A failed Sent-folder copy warns without sending again. Interrupted or uncertain SMTP submissions become **delivery unknown** and block resumed sending until you check the mailbox and record the outcome. Failed/unknown items are never automatically retried. After confirming not sent and closing an item, you may stage a replacement from the lead.

Mail queue/history and immutable reviewed MIME snapshots are stored in `.local/mail/harvey.db`, isolated from Harvey discovery. This private operational state is not in the register's JSON backup; protect/back up `.local/mail` separately while the app is stopped, and keep Keychain credentials separate. No password, inbox content or mail queue enters GitHub Pages, model prompts, Git or register exports. Disconnect removes only Kirat's Keychain item and leaves Apple Mail configured.

Run `npm run test:mail`, `.local/venv/bin/python test/test-mail-wire.py`, `node test/test-mail-presence.js`, `.local/venv/bin/python test/browser-mail.py`, and `zsh test/test-keychain.sh` for the additional local mail checks. Tests use fictional addresses, a temporary queue and localhost TLS servers; they send no external email. Live cPanel login and controlled delivery remain user setup steps.

## Storage and costs

- Lead batches, exports, credentials, Harvey checkout and database stay out of Git.
- `.local/` contains research work and installed dependencies. Protect it like your backups.
- GitHub Pages publishes only the app shell. The Mac app has its own persistent register, separate from Safari, Chrome and Pages. Use JSON backup/import to move records. A public page does not publish or synchronize these records.
- Research runs only when started locally. It pauses while your Mac is off.
- Discovery uses free OSM by default; optional Serper/Hunter calls use your provider credits; locally authenticated model research consumes the selected subscription's usage. There is no enforced subscription percentage or automatic paid API fallback.
- React/htm are bundled locally. Fonts may load from Google Fonts, with system-font fallbacks. Discovery and research require internet access.

## Test and deploy

```sh
npm test
npm run build
```

The build allowlists `index.html`, `lead-core.js`, `browser-store.js`, `.nojekyll`, the two logo assets and vendored browser libraries. Local controls and job endpoints are excluded. GitHub Actions tests every push/PR and deploys only main to Pages. It never executes research or needs model/mail credentials. To deploy elsewhere, enable Pages with **GitHub Actions** as source.

Harvey is installed separately at commit `0041b6a3a9930426fb8f9beba64eb62438c96711`. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). Transitive Python packages resolve at installation within upstream's ranges; re-run the pilot when updating dependencies.

The company logo is supplied by Kirat Creations. The app icon uses the logo symbol on a light rounded square; the original SVG is retained in assets.

### Daily lead and email preparation

The native app’s **Today** tab prepares up to five source-backed opportunities and three draft messages per lead. The local daily heartbeat is scheduled for **09:00 Asia/Kolkata**. This Mac must be awake with Codex running; reopening Lead Desk after 09:00 catches up at most today’s batch. Missing evidence can produce fewer leads. A failed batch has an explicit retry; completed batches do not repeat.

New records save into the native register without replacing existing notes, statuses or IDs. Published contacts and evidence appear on each card. Unknown delivery status requires a contact-risk acknowledgement; customer-care contacts are routing only. Initial emails enter the Outbox as **pending review**. Preview and approve each email individually. Follow-ups and replies require separate approval. Daily preparation never enables sending.

Paid Hunter checks default to **zero**; configure a key and an explicit daily limit to use them. Reservations survive retries. At 20 outstanding cards/initial emails, preparation holds until the backlog is reviewed. Use Settings to pause daily preparation, or Today to cancel a running batch; these controls are separate from mail sending.

CLI: `node bin/kirat.js daily`, `daily-status`, or `daily --retry`. Before the first headless run, seed exclusions with `daily-seed <native-backup.json>`. Private state lives under `.local/daily/` and is excluded from static builds. Source-backed lead discovery uses the signed-in Codex CLI and needs available account usage. Public source attestation checks contact excerpts; email verification does not establish buying intent or procurement availability.

### Simple app navigation

- **Today:** new opportunities and the next action for each. Review a lead, preview and approve its email, then track replies.
- **Leads:** saved register, notes, contact lookup and one email composer. Research starts with Find leads; import/export and backup tools are here.
- **Emails:** Needs approval, Scheduled, Sent and Needs attention. Open one message to edit, preview the complete branded email, and approve it individually. Approved messages wait while sending is paused.
- **Replies:** received messages, matched lead and reply preparation. Every reply still requires approval in Emails.
- **Settings:** mailbox account, signature, sending readiness and daily schedule; provider keys and service diagnostics are under Advanced.

Switching tabs preserves unsaved email edits and does not pause sending or restart research. Lead detail has Overview, Contacts and Email sections. No mailbox credentials or private data enter the static build.
