first commit
## Chrome Extension: Distraction Blocker

This folder contains a Chrome Manifest V3 extension that lets you block any site or specific link you add.

### Files
- `manifest.json` — MV3 manifest with permissions and popup.
- `background.js` — Service worker managing dynamic blocking rules and storage.
- `popup.html`, `popup.js` — Simple UI to add/remove blocks and block the current site.
- `blocked.html` — Local page shown when a URL is blocked.
- `content_script.js` — Fallback to redirect early if a page loads from cache.

### How to load it
1. Open Chrome and go to `chrome://extensions`.
2. Enable `Developer mode` (top right).
3. Click `Load unpacked` and select this folder (`DistractionBlockerExtension`).

### Usage
- Click the extension icon to open the popup.
- Add a full URL (e.g. `https://news.example.com/path`) or a domain (e.g. `example.com`).
  - Domains become rules like `||example.com^` (blocks all subdomains).
  - Full URLs are used as substring filters and will block that exact page and matching URLs.
- Use `Block current site` to block the active tab’s domain quickly.
- Right‑click a link and choose `Block this link`, or right‑click the page to `Block this site`.
- Remove any entry from the list to unblock it.

When blocked, the browser redirects to the local Blocked page for a consistent experience, even on refresh.

### Notes
- The extension uses the `declarativeNetRequest` API with dynamic rules for reliability and low overhead.
- Rules persist in `chrome.storage.local` and are re-applied on browser start/update.
