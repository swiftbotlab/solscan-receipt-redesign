# Security notes

Static site. It has no backend, no forms that send data anywhere, no cookies and no third-party scripts.

- **Data.** It renders one bundled, public transaction (`js/tx-data.js`). The page makes no RPC calls and needs no keys. No secrets are in the repo.
- **Rendering.** Every dynamic string goes through `esc()` before it is inserted into HTML. The raw JSON viewer uses `textContent`.
- **Decoding.** The Pump.fun fee is read from the bundled transaction's own log (`atob` on a base64 line capped at 4,096 characters, fixed discriminator and offsets). It is shown only when it reconciles to the lamport with the real transfer; otherwise the row is hidden.
- **URL parameters.** `view`, `as`, `state` and `theme` are matched against fixed allowlists, and anything else is ignored. A test feeds hostile values and checks for no injection and safe defaults.
- **Storage.** `localStorage` holds only the Simple/Detailed and theme preferences. Every access is wrapped in try/catch.
- **External requests.** Google Fonts stylesheets only. Outbound links use `rel="noopener noreferrer"`.
