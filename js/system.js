/* System sheet: the rules behind the screens, rendered with the real components. */
(function () {
  'use strict';
  var T = window.TX, F = T.fmt;

  var SW = [
    ['paper', 'Paper', '#FAFAF8', '#0E1012', 'Page'],
    ['surface', 'Surface', '#FFFFFF', '#15181B', 'Receipt, popovers'],
    ['ink', 'Ink', '#15171A', '#ECEDEE', 'Text and amounts'],
    ['ink-2', 'Ink 2', '#454A52', '#B3B8BF', 'Secondary text'],
    ['ink-3', 'Ink 3', '#646A73', '#8D939B', 'Notes, addresses'],
    ['line', 'Line', '#E7E6E1', '#24292E', 'Hairlines'],
    ['accent', 'Green', '#14B57A', '#14B57A', 'Success, one primary action'],
    ['amber', 'Amber', '#B7791F', '#E6AE5C', 'Good to know'],
    ['red', 'Red', '#B42318', '#F2786D', 'Failure only']
  ];

  function swatches(theme) {
    return '<div class="sy-theme" data-theme="' + theme + '"><div class="sy-theme__k">' + (theme === 'light' ? 'Light' : 'Dark') + '</div>' +
      SW.map(function (s) {
        return '<div class="sy-sw"><span class="sy-sw__chip" style="background:var(--' + s[0] + ')"></span><span class="sy-sw__n">' + s[1] +
          '<small>' + s[4] + '</small></span><span class="sy-sw__hex">' + (theme === 'light' ? s[2] : s[3]) + '</span></div>';
      }).join('') + '</div>';
  }

  var rows = [
    ['24,785,431.639664 DICE', '24.79M DICE', 'Millions and up: two decimals and a suffix'],
    ['0.000494183 SOL', '0.000494 SOL', 'Under 1: three significant figures'],
    ['0.000014595 SOL', '$0.0015', 'Costs: dollars first, two significant figures, SOL beside'],
    ['0.000000502 SOL', '0.000000502', 'Never 0.0₆502. Copies exactly'],
    /* exact USD of the net change: lamports × price in cents, so nothing is rounded before it is shown */
    ['$' + F.units(T.signerDelta * Math.round(T.price * 100), 11, { trim: true }), '≈ $0.051', 'Two significant figures, one fixed price per swap'],
    ['458450284', '458450284', 'Identifiers stay whole, never grouped']
  ];

  function ty(k, use, style, sample) {
    return '<div class="sy-ty"><span class="sy-ty__k">' + k + '<small>' + use + '</small></span><span class="sy-ty__s" style="' + style + '">' + sample + '</span></div>';
  }

  function render(el) {
    var sig = F.short(T.signature);
    el.innerHTML =
      '<div class="ss sy">' +
      '<div class="sy-grid">' +

      '<section class="sy-card sy-type"><h3 class="sy-h">Type</h3>' +
        /* exactly the sizes the screens use: tokens.css type scale, nothing off-scale */
        ty('Geist 40 / 500', 'Amount, desktop', 'font:500 var(--t-40)/1.05 var(--font-sans);letter-spacing:-0.035em', '0.000494') +
        ty('Geist 32 / 500 · 600', 'Amount, phone · title, desktop', 'font:600 var(--t-32)/1.15 var(--font-sans);letter-spacing:-0.025em', 'You swapped') +
        ty('Geist 24 / 600', 'Title, phone', 'font:600 var(--t-24)/1.2 var(--font-sans);letter-spacing:-0.025em', 'You swapped DICE') +
        ty('Geist 20 / 600', 'Section title', 'font:600 var(--t-20)/1.3 var(--font-sans);letter-spacing:-0.02em', 'Where the money went') +
        ty('Geist 17 / 500', 'Cost, panel titles', 'font:500 var(--t-17)/1.35 var(--font-sans)', '$0.0015 cost') +
        ty('Geist 15 / 400', 'Body, ledger labels', 'font:400 var(--t-15)/1.5 var(--font-sans)', 'Paid by the Pump.fun pool') +
        ty('Geist 14 · 13 · 12', 'Notes, labels, caps', 'font:400 var(--t-14)/1.4 var(--font-sans)', 'Notes 14 <span style="font-size:var(--t-13)">Labels 13</span> <span style="font-size:var(--t-12);font-weight:600;letter-spacing:.08em;text-transform:uppercase">Caps 12</span>') +
        ty('Mono 20 · 17 · 15 · 14 · 13 · 12', 'Exact values, ledger, IDs', 'font:400 var(--t-15)/1.5 var(--font-mono)', '+0.000494183 SOL') +
        '<p class="sy-note">Sans for reading amounts, mono for columns and identifiers. Tabular figures everywhere, so ledgers align.</p>' +
      '</section>' +

      '<section class="sy-card sy-color"><h3 class="sy-h">Colour</h3><div class="sy-themes">' + swatches('light') + swatches('dark') + '</div>' +
        '<p class="sy-note">Amounts stay ink with + and −. Selling is not a loss, so it is never red.</p></section>' +

      '<section class="sy-card sy-num"><h3 class="sy-h">Numbers</h3><table class="sy-table"><thead><tr><th>Exact</th><th>Shown</th><th>Rule</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td class="mono">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td></tr>'; }).join('') +
        '</tbody></table>' +
        '<p class="sy-note">Every rounded value carries its exact value for copy and screen readers. One number per fact.</p></section>' +

      '<section class="sy-card sy-status"><h3 class="sy-h">Status</h3>' +
        '<div class="sy-st"><span class="ss-stamp"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>Swap complete</span><p>Final, can’t be reversed.</p></div>' +
        '<div class="sy-st"><span class="ss-stamp ss-stamp--wait"><span class="ss-pulse" aria-hidden="true"></span>Confirming</span><p>Usually a few seconds. No need to send it again.<span class="sy-plan">Planned state, not in the prototype yet</span></p></div>' +
        '<div class="sy-st"><span class="ss-stamp ss-stamp--fail"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Didn’t go through</span><p>Your DICE was not moved. You still paid the network fee.</p></div>' +
        '<p class="sy-note">Icon, word and colour together, so status never depends on colour alone.</p></section>' +

      '<section class="sy-card sy-words"><h3 class="sy-h">Plain words, exact values</h3><div class="sy-pops">' +
        '<div class="ss-pop sy-pop"><div class="ss-pop__k">In plain words</div><div class="ss-pop__title">Finalized</div><p class="ss-pop__p">Enough of the network has confirmed this transaction that it can no longer be reversed. It is permanent.</p></div>' +
        '<div class="ss-pop sy-pop"><div class="ss-pop__k">Jupiter fee</div><div class="ss-pop__v">0.000000502 <span>SOL</span></div><p class="ss-pop__meta"><span class="mono">502</span> lamports, 9 decimals</p>' +
          '<div class="ss-pop__foot"><span>Copies as <code>0.000000502</code></span><span class="ss-btn ss-btn--sm">Copy exact</span></div></div>' +
        '</div><p class="sy-note">Dotted underline = a definition. Desktop: popover on hover, focus or click. Phone: bottom sheet on tap or long-press.</p></section>' +

      /* the identity shift, with colours sampled from the solscan.io capture (before/solscan_tx_desktop.png) */
      '<section class="sy-card sy-misc sy-id"><h3 class="sy-h">From Solscan’s identity to the receipt system</h3>' +
        '<div class="sy-id__k">Solscan today</div><div class="sy-id__row">' +
          [['#009978', 'Buttons'], ['#00E8B4', 'Logo'], ['#1890FF', 'Links'], ['#C74AE3', 'Search']].map(function (c) {
            return '<span><i style="background:' + c[0] + '"></i>' + c[1] + '<code>' + c[0] + '</code></span>'; }).join('') + '</div>' +
        '<div class="sy-id__k">Receipt system</div><div class="sy-id__row">' +
          [['#14B57A', 'Accent'], ['#0A7A52', 'Accent ink'], ['#15171A', 'Ink'], ['#FAFAF8', 'Paper']].map(function (c) {
            return '<span><i style="background:' + c[0] + '"></i>' + c[1] + '<code>' + c[0] + '</code></span>'; }).join('') + '</div>' +
        '<ul class="sy-id__why">' +
          '<li>Green stays as the bridge to Solscan’s brand: two jobs (success, the one primary action), not seven.</li>' +
          '<li>Blue links and magenta go, so nothing competes with the status.</li>' +
          '<li>Paper and ink: a receipt should read like one.</li>' +
          '<li>Mono for exact figures.</li>' +
        '</ul></section>' +

      '</div></div>';
  }

  window.SSSystem = { render: render };
})();
