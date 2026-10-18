# Solscan, as a receipt

Concept redesign of Solscan's transaction page, built on a real Jupiter swap (3ae8jL…efShWURb, slot 458450284).

## Problems found

- **No plain answer to "did it work, what did I get, what did it cost?"** You are "Signer".
- **The headline isn't the outcome.** It says 0.000502417 WSOL, which is after the pool's fee but before the others. The wallet changed by +0.000494183 SOL after a 0.1% Jupiter fee and the network fee.
- **Fees are hidden.** The swap paid three fees: the network fee (0.000007732 SOL), a 1.25% Pump.fun pool fee (0.000006361 SOL) and a 0.1% Jupiter fee (0.000000502 SOL), about $0.0015 in all. The network fee is 868px down on desktop, under the cookie banner, and 1,263px down on a phone. The pool fee is never shown, only in the program's event log. "Transaction cost: 94,738" is a block-space score (87,640 compute units plus signature and account-lock costs), not a price, yet it is the row a newcomer reads as the price.
- **Noise.** The swap is stated three times on the first screen, with 15 copy icons and 12 view controls. Green has seven jobs, and casino ads sit above the numbers.
- **Misleading numbers.** "0.0₆502" copies as 0.06502, 129,522× the real fee. USD reprices a finalized swap on every load.
- **Unmentioned costs.** The emptied DICE account still holds 0.00151 SOL of rent, about 3× the swap's value.
- **Inconsistency.** Defaults differ by breakpoint, and a 0.0013462 SOL deposit is never shown returning.

## Design decisions

1. **Receipt header.** A status stamp, then "You gave 24.79M DICE", "You got 0.000494 SOL" and "Fees about $0.0015" (network, the 1.25% pool fee and the 0.1% Jupiter fee). The amount is net and the token is plain SOL. The copy says "You" only when the connected wallet signed.
2. **Where the money went.** One signed column (pool price, the 1.25% pool fee decoded from the pool's own SellEvent, Jupiter fee, network fee) totals +0.000494183 SOL. It is checked against the wallet's real balances. An amber note appears only while rent sits in the empty account.
3. **How it happened.** Simple shows a route, wallet → Jupiter → Pump.fun AMM → wallet, with the amounts on the line (24.79M DICE in, 0.000502 SOL out) and the Jupiter fee as a branch with its amount. Detailed shows all 7 movements ("7 of 7") and the sum that proves them. One switch, the same default everywhere, saved and kept in the URL.
4. **Exact values, plain words.** Every rounded value opens its exact value and base units (popover or sheet), and copies exactly. Terms get one-sentence definitions in place.

Green means success or the one primary action, amber means good to know, and red means failure. Amounts stay ink. A failed swap's next step, "Try again on Jupiter", is a neutral ink button, never green.

## Kept for power users

Every movement, program steps, raw JSON, and all technical fields with Raw/Inspect/Map/API links, in a sticky desktop rail. Ads stay, boxed, after the answer.

## Accessibility

- AA contrast for every text pair, in both themes.
- Status is never colour alone.
- Accessible names carry exact amounts.
- Real buttons, visible focus, Escape closes overlays.
- Phone controls are 44px or taller, and rows 48px.
- Reduced motion is respected.

*Concept redesign by Swiftbot (github.com/swiftbotlab). Not affiliated with Solscan.*
