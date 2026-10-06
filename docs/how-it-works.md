# How it works

## Actors
| Actor | Does | Gets |
|---|---|---|
| Viewer | opts in once, watches ads in a host app, claims | 70% of the price of every qualified view, in USDC |
| Host app | integrates the SDK, renders the ad slot | 20% of every view served in it |
| Advertiser | creates a campaign, funds it over x402, picks an audience | verified human attention, paid per qualified view |
| Attester | the Adrop server key that co-signs every payout | 10% to the protocol treasury |

## One view, start to finish
1. The viewer connects a wallet in the host app and calls `optIn()`. The SDK finds the proof of
   personhood (Seeker Genesis Token) and registers an on-chain `Identity` bound to it. Once.
2. The host calls `loadAd()`. The server picks an active campaign whose audience contains this identity,
   under the campaign's frequency cap and the global daily cap, and issues an *impression* with a one-time nonce.
3. `show(container)` renders the creative with a "Sponsored" label. The SDK measures attention:
   the creative at least 50% visible for the campaign's minimum dwell (default 3 s), the document focused,
   a pointer event on the creative. Only then is the Claim button enabled. Nothing is ever auto-claimed.
4. On Claim, the SDK sends the attention report and a wallet signature of the nonce. The server verifies,
   builds the `pay_view` transaction, co-signs it as attester and fee payer, and returns it.
5. The viewer signs. The server submits and confirms. The program checks everything again (identity, audience
   proof, unused nonce, daily cap, escrow balance) and pays viewer, host and protocol in one transaction.

## Qualified view
A view is paid only if all of these hold at claim time:
- the identity is registered and bound to exactly one proof of personhood;
- the identity's wallet was in the campaign's audience when the campaign was created (Merkle proof against the
  root stored on the campaign);
- the impression nonce is unexpired (10 minutes) and unused;
- the attention thresholds above were met;
- the global daily cap (10 paid views per identity per day) is not exceeded;
- the campaign escrow holds at least the price of one view.

## Money
- Price per view is set by the advertiser per campaign, in USDC. Split 70 / 20 / 10.
- Advertisers pay over x402 (`exact` scheme, USDC). The server forwards the payment into the campaign's
  escrow account and activates the campaign. Payouts are plain program transfers from that escrow.
- Viewers need no SOL: the fee payer covers transaction fees and the viewer's first USDC account.

## Roadmap
A second price per campaign for a verified *action* after the view (on-chain action against the advertiser's
program, a Solana Action signed in the ad slot, an in-ad quiz), from a separate action budget. Never a paid click.
Also: more proofs of personhood (World ID next), Android and Unity hosts, EVM settlement.
