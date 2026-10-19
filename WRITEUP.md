# Solscan, as a receipt

A newcomer swaps on Jupiter, taps "View on explorer" and lands on Solscan wanting three answers: did it work, what did I get, what did it cost? This concept redesign of Solscan's transaction page answers them first. It is built on a real Jupiter swap (3ae8jL…ShWURb, slot 458450284), and every figure comes from that transaction.

## Problems found

- **No plain answer to "did it work, what did I get, what did it cost?"** You are "Signer".
- **The headline isn't the outcome.** It says 0.000502417 WSOL, which is after the pool's fee but before the others. The wallet changed by +0.000494183 SOL after a 0.1% Jupiter fee and the network fee.
- **Fees are hidden.** The swap paid three fees: the network fee (0.000007732 SOL), a 1.25% Pump.fun pool fee (0.000006361 SOL) and a 0.1% Jupiter fee (0.000000502 SOL), about $0.0015 in all. The network fee is 868px down on desktop, under the cookie banner, and 1,263px down on a phone. The pool fee is never shown, only in the program's event log. At this pool's current 1.25% rate, a $1,000 sale pays $12.50 to the pool, and today's page never shows it. "Transaction cost: 94,738" is a block-space score[^cost], not a price, yet it is the row a newcomer reads as the price.
- **Noise.** The swap is stated three times on the first screen, with 15 copy icons and 12 view controls. Green has seven jobs, and casino ads sit above the numbers.
- **Misleading numbers.** "0.0₆502" copies as 0.06502, 129,522× the real fee. USD reprices a finalized swap on every load.
- **Unmentioned costs.** The emptied DICE account still holds 0.00151 SOL of rent, about 3× the swap's value.
- **Inconsistency.** Defaults differ by breakpoint, and a 0.0013462 SOL deposit is never shown returning.

## Design decisions

1. **Receipt header.** A status stamp, then "You gave 24.79M DICE", "You got 0.000494 SOL" and "Cost $0.0015" (network, the 1.25% pool fee and the 0.1% Jupiter fee). The amount is net and the token is plain SOL. The copy says "You" only when the connected wallet signed.
2. **Where the money went.** Read down: the signed lines (sale value before the pool's fee, the 1.25% pool fee decoded from the pool's own SellEvent, Jupiter fee, network fee) add up to +0.000494183 SOL. The fee splits and the "Pool paid out" subtotal carry no sign, so nobody adds them twice. The total is checked against the wallet's real balances. An amber note appears only while rent sits in the empty account.
3. **How it happened.** Simple shows a route, wallet → Jupiter → Pump.fun AMM → wallet. Jupiter picked the route but never held the DICE: it went from the wallet straight to the pool, and the route says so. The amounts ride on the line (24.79M DICE, wallet → pool; 0.000502 SOL back) and the Jupiter fee drops off as a labelled branch. Detailed shows all 7 movements ("7 of 7") and the sum that proves them. One switch, Simple by default on every screen size, saved and kept in the URL.
4. **Exact values, plain words.** Every rounded value opens its exact value and base units (popover or sheet), and copies exactly. Terms get one-sentence definitions in place.

Green means success or the one primary action, amber means good to know, and red means failure. Amounts stay ink. A failed swap says why in plain words ("the price moved more than your slippage limit allowed before the swap landed, so nothing was traded") and suggests a smaller amount, never a looser limit. Its next step, "Try again on Jupiter", is a neutral ink button, never green.

## Kept for power users: where every control went

Nothing on the transaction is removed; it is reordered. Every movement, program steps, raw JSON and all technical fields live in Detailed and in a sticky desktop rail. The site-wide header (Analytics, Defi, Leaderboard, Blockchain, Resources and API menus, Sign in, settings, Avg Fee) is out of scope and stays as Solscan has it.

| Today on solscan.io | In the redesign |
|---|---|
| Overview, Balance Changes and Raw tabs | One page, read top to bottom: receipt, Where the money went (your balance changes, reconciled), How it happened. Raw JSON is in Detailed and the rail. |
| Legacy Mode and Summary Mode | The Simple / Detailed switch, Simple by default everywhere |
| Key Actions and Token Account toggles, the action list | Detailed: all 7 movements in order, each token account shown with its address and named for its owner (pool vault, Jupiter fee account) |
| Blue links to the block, signer, DICE and WSOL token pages, Jupiter Aggregator v6, Pump.fun AMM and Jupiter Aggregator Authority 11 | Every address opens its account page from its popover, and a token account's popover also links its owner; DICE and WSOL amounts open the token page; Jupiter and Pump.fun AMM open their program pages from their definitions and from Program steps; the block number links to its block |
| Tx Maps, Inspect Tx and API buttons | Rail links: Transaction map, Inspect, API |
| The Explanation button | The receipt answers in plain words first; "Explain this transaction" stays in the rail |
| The menu (Update Name Tag or Label, Update Token Information, Report/Flag address) | Rail links: Update name tag, Update token info, Report address, plus Personal label |
| Copy icons (15 on the first screen) and "?" icons (22 in the page markup) | Every value is a button with its exact value and Copy exact; dotted terms open a one-sentence definition |
| Signature, block, result, signer, fees, "Transaction cost 94,738", compute, version, lookup tables, instruction logs, and the Instruction Details list / tree toggle | Receipt header, ledger and rail; the 94,738 sits under Compute, labelled as a block-space score, not a price. Program steps with compute are in Detailed, as one ordered list in place of the list / tree toggle; the full logs are in Raw JSON |
| Sponsored line, banner, and the Buy, Prediction, Play and Gaming menus (merged) | One labelled "Sponsored" box after the answer. Ads keep Solscan free, but they shouldn't sit above "did it work?" |

## Accessibility

- AA contrast for every text pair, in both themes.
- Status is never colour alone.
- Accessible names carry exact amounts.
- Real buttons, visible focus, Escape closes overlays.
- Phone controls are 44px or taller, and rows 48px.
- Reduced motion is respected.

*Concept redesign by Swiftbot (github.com/swiftbotlab). Not affiliated with Solscan.*

[^cost]: 94,738 is the transaction's cost-model total: its 87,640 compute units plus signature, account-lock and other block-space costs. Validators use it to pack blocks; it is not what the transaction paid.
