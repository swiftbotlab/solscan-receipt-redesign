# Security notes: tx.html (live lookup)

`SECURITY.md` covers the bundled prototype (`prototype.html`, one built-in transaction, no network). `tx.html` is
different: it fetches any transaction the visitor pastes. Everything it receives is treated as hostile.

- **External requests.** Only these, all listed in the page's Content-Security-Policy `connect-src`:
  `solana-rpc.publicnode.com` and `rpc.solanatracker.io` (Solana mainnet RPC, `getTransaction`), and
  `lite-api.jup.ag` (token names and today's SOL price). `api.mainnet-beta.solana.com` is not used: it answers
  browser-origin requests with HTTP 403. The footer names the same services. Fetches send no credentials or
  referrer, refuse redirects, time out (15 s RPC, 8 s tokens, 6 s price), and stop reading a body past 8 MiB while
  it streams.
- **CSP.** `default-src 'none'; script-src 'self'`. Styles from self and Google Fonts, fonts from Google Fonts, images
  from self, `https:` and `data:`. No `unsafe-inline`, no `eval`, `base-uri 'none'`, `object-src 'none'`,
  `frame-src 'none'`.
- **Input.** The pasted text is accepted only as a base58 signature (64 to 88 characters that decode to exactly 64
  bytes) or a `/tx/<signature>` link. Non-mainnet `cluster=` links are refused. Nothing else reaches a request.
- **Rendering.** The DOM is built with `createElement` and `textContent` only. No `innerHTML` with data and no inline
  handlers. Token icons load only for Jupiter-verified tokens, only over `https:`, with `referrerpolicy=no-referrer`.
- **Token names are attacker-controlled.** Symbols and names are cleaned of control, format, bidi, invisible and
  private-use characters and capped in length. Unverified tokens may use plain ASCII only. They may not equal,
  start with or end with a well-known symbol (SOL, USDC, USDT and others), compared after normalisation (NFKC, marks
  and invisible characters removed, Cyrillic and Greek look-alikes folded, punctuation ignored). Otherwise the mint
  address is shown, and if a ground mint address itself contains a well-known symbol, its end or "Unknown token" is
  shown instead. Every unverified symbol shown in words carries an "unverified" mark.
- **RPC data shape.** The response must echo the requested signature. It is shape-checked before anything reads it:
  addresses are base58, balances are safe integers, there are at most 512 accounts and 256 top-level instructions,
  each token-balance list has at most one entry per account, and call depth is bounded. Maps keyed by chain data have
  no prototype, so `__proto__` or `constructor` cannot reach `Object.prototype`. Amounts are exact (BigInt), never
  floats. A story is told only when every lamport and token unit reconciles; otherwise the page shows a reduced
  receipt.
- **Storage.** `localStorage` holds only the theme. Every access is wrapped in try/catch.
- **Not for publishing.** `tests/` holds fixtures, screenshots and local DevTools test tools (they take the helper's
  path from `CDP_PY` and may bypass the CSP in their own tab, only to read fixtures). Publish the site without
  `tests/`.
