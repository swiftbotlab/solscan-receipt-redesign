# Solscan, as a receipt

A concept redesign of Solscan's transaction page: **your receipt first, the blockchain second.**

After a swap, the current page answers "did it work, what did I get, what did it cost?" in the
protocol's words, with casino ads above the numbers and the network fee a screen and a half down.
This concept rebuilds the page as a receipt for the person who signed it, with every figure computed
live from a real Jupiter swap.

- **Live case study (before / after):** https://swiftbotlab.github.io/solscan-receipt-redesign/
- **Live prototype:** https://swiftbotlab.github.io/solscan-receipt-redesign/prototype.html
- **All standalone screens:** https://swiftbotlab.github.io/solscan-receipt-redesign/screens/

## What it is

Four features, each built as working HTML for desktop and mobile, in light and dark, on a real
Jupiter swap (DICE → SOL through Pump.fun AMM), signature `3ae8jL…efShWURb`, slot 458450284.

1. **Receipt header** — status, what you gave, what you actually got after fees, and what it cost, on the first screen.
2. **Where the money went** — a ledger that adds up to the wallet's real balance change to the lamport, including a 1.25% Pump.fun pool fee no explorer shows today.
3. **How it happened** — the route in plain words (wallet → Jupiter → Pump.fun AMM → wallet). One Simple/Detailed switch replaces 12 view controls.
4. **Exact values, plain words** — every rounded number opens its exact value and copies it correctly; jargon gets one-sentence definitions where it appears.

## How it's built

Static site, no backend. The redesigned screens are rendered with vanilla JavaScript from one
bundled, public transaction (`js/tx-data.js`); the page makes no RPC calls and needs no keys. The
"before" images are real screenshots of solscan.io captured on October 18, 2026. See
[`WRITEUP.md`](WRITEUP.md) for the full design write-up and [`SECURITY.md`](SECURITY.md) for notes.

```
index.html          case study: problems found + before/after, per feature
prototype.html      the live, interactive redesigned transaction page
screens/            standalone screens (receipt, ledger, route, failed, …) desktop + mobile
css/  js/           tokens, app styles, the render model, and the view code
img/                real "before" screenshots of solscan.io
```

## Run locally

It's a static site — open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000   # then visit http://localhost:8000
```

---

Concept redesign by Swift Bot Labs ([github.com/swiftbotlab](https://github.com/swiftbotlab)).
Not affiliated with Solscan. Transaction data was fetched from public Solana RPC.
