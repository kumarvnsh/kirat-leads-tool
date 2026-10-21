# Kirat Lead Desk Mac app — proposed design

## User outcome
Double-click Kirat Lead Desk.app in Applications. Following user clarification, this is a native Swift/AppKit window embedding the dashboard in WKWebView, not a browser-opening launcher. First launch checks local runtimes and installs missing project dependencies, showing progress and actionable setup errors. Later launches reuse setup, start the local service and show the embedded dashboard. Native Open/Save dialogs support imports and backups. App quit stops local jobs/service. No Terminal commands are part of normal use.

## Options
Recommended: a lightweight macOS app launcher around the existing local web application. This reuses the current dashboard and avoids an Electron runtime. A .command launcher is simpler but exposes Terminal; a full Electron app gives a dedicated window but adds packaging and update maintenance. Neither alternative is needed for the requested first Mac version.

## Local workflow
Add local-only controls for Setup status, Find candidates, Research leads and Stop job. Find candidates invokes the existing pinned Harvey discovery adapter with the selected NCR city and bounded count. Research leads uses the saved local register as exclusions and the signed-in Codex CLI with web search, returning schema-validated JSON for the existing review/import sheet. Capability or login failures are visible and preserve previous results; no paid API fallback. Keep a manual research-prompt fallback if the installed CLI cannot complete web research. No automatic email or LinkedIn actions.

## Boundaries and lifecycle
The launcher installs to the user's Applications directory without administrator privileges, retains project data under the existing ignored .local directory, and detects an already-running owned service rather than starting duplicate servers. Provide a Quit local service control. Initial network access is needed for dependencies and research. Use a stable localhost origin so saved browser records remain accessible. Keep JSON backup/import migration from Pages explicit.

Only loopback clients can access local job endpoints. Require a per-launch session secret and validate Host and Origin for mutations; expose fixed operations rather than arbitrary command execution. Run one job at a time with a timeout, cancellation and visible progress. Keep provider credentials in their existing CLI credential store. Validate model output and require source review before saving leads. Model research must have restricted tools and filesystem access; do not run arbitrary unsandboxed agent commands.

GitHub Pages keeps its static dashboard and hides local-only controls. No local service is exposed over the internet. Do not bundle research outputs, tokens or a Python virtualenv into published artifacts.

## Verification
Test launcher paths containing spaces, runtime discovery from Finder's environment, existing-server reuse, setup failures, job start/status/cancellation, Host/Origin/session rejection, malformed research output, preview import and persistence. Open the actual .app on this Mac and verify that it starts the local service and dashboard without requiring Terminal. Run existing tests and retain the static deployment allowlist.

## Review
Approved in chat; user additionally requested a native app window and the supplied company logo as icon and in-app branding. This extends the approved CLI-based local tool into a Mac launcher with local job controls.
