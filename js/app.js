/* Renders the redesigned transaction page from window.TX (built by model.js from the real RPC JSON).
   SS.mount(el, opts) renders one independent copy; the case study mounts several (desktop + phone frames). */
(function () {
  'use strict';

  var T = window.TX;
  var F = T.fmt;
  var SOL = T.SOL_MINT;
  var uid = 0;
  var COMPACT = 600;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- icons (inline, stroke = currentColor) ---------- */
  function ic(path, size, sw) {
    size = size || 16;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }
  var I = {
    check: function (s) { return ic('<path d="M5 12.5l4.2 4.2L19 7"/>', s, 2.2); },
    x: function (s) { return ic('<path d="M6 6l12 12M18 6L6 18"/>', s, 2.2); },
    right: function (s) { return ic('<path d="M5 12h14M13 6l6 6-6 6"/>', s); },
    down: function (s) { return ic('<path d="M12 5v14M6 13l6 6 6-6"/>', s); },
    chev: function (s) { return ic('<path d="M6 9l6 6 6-6"/>', s); },
    chevR: function (s) { return ic('<path d="M9 6l6 6-6 6"/>', s, 2.2); },
    copy: function (s) { return ic('<rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/>', s); },
    wallet: function (s) { return ic('<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="4" y="8" width="16" height="11" rx="2.5"/><circle cx="16" cy="13.5" r="1.2" fill="currentColor" stroke="none"/>', s); },
    split: function (s) { return ic('<path d="M4 12h5c3 0 4-5 7-5h4M9 12c3 0 4 5 7 5h4M17 4l3 3-3 3M17 14l3 3-3 3"/>', s); },
    pool: function (s) { return ic('<path d="M12 3.5c3.5 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2-6 5.5-10z"/><path d="M8.5 14.5c.6 1.6 1.9 2.5 3.5 2.5"/>', s); },
    search: function (s) { return ic('<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>', s); },
    contrast: function (s) { return ic('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none"/>', s); },
    info: function (s) { return ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>', s, 2); },
    alert: function (s) { return ic('<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4v.1"/>', s, 2); },
    link: function (s) { return ic('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>', s); },
    share: function (s) { return ic('<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6"/>', s); },
    ext: function (s) { return ic('<path d="M14 5h5v5M19 5l-8 8"/><path d="M17 14v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4"/>', s); },
    retry: function (s) { return ic('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>', s); },
    device: function (s) { return ic('<rect x="7" y="2.5" width="10" height="19" rx="3"/><rect x="9.5" y="5.5" width="5" height="4.5" rx="1"/><circle cx="12" cy="15.5" r="1.8"/>', s, 1.6); }
  };
  function tok(sym) {
    if (sym === 'SOL' || sym === 'WSOL') return '<span class="ss-tok ss-tok--sol" aria-hidden="true"><i></i></span>';
    return '<span class="ss-tok ss-tok--gen" aria-hidden="true">' + esc(sym.charAt(0)) + '</span>';
  }

  /* ---------- glossary: one sentence each ---------- */
  var TERMS = {
    finalized: ['Finalized', 'Enough of the network has confirmed this transaction that it can no longer be reversed. It is permanent.'],
    wsol: ['WSOL (wrapped SOL)', 'The pool paid in wrapped SOL; this transaction then closed the temporary account, unwrapping it back to plain SOL.'],
    signer: ['Signer', 'The wallet that approved this transaction with its key. It also paid the fees.'],
    rent: ['Rent deposit', 'Solana keeps a small amount of SOL in every account to hold it open. It comes back when the account is closed.'],
    netfee: ['Network fee', 'What Solana charges to process a transaction: 0.000005 SOL per signature, plus any priority fee.'],
    priority: ['Priority fee', 'An optional extra, paid so validators include the transaction sooner when the network is busy.'],
    jupiter: ['Jupiter', 'A swap aggregator. It compares prices across exchanges and sends the trade where you get the most back.'],
    pool: ['Pool (AMM)', 'A shared pot of two tokens that trades automatically, at a price set by how much of each it holds.'],
    tokenacct: ['Token account', 'A small account that holds one kind of token for one wallet. Each one needs its own rent deposit.'],
    cu: ['Compute units', 'How much work the transaction asked validators to do. The limit sets the priority fee; it is not the price of the swap.'],
    lookup: ['Lookup table', 'A saved list of addresses, so a transaction can use many accounts and still fit in one packet.'],
    slippage: ['Slippage limit', 'The most the price may move against you before the swap cancels itself. A higher limit fails less often but can cost you more.']
  };

  /* links out to the pages today's blue links open: accounts, tokens, programs and the block */
  var SOLSCAN = 'https://solscan.io';
  function goLink(href, text) {
    return '<p class="ss-pop__go"><a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + text + I.ext(13) + '</a></p>';
  }
  function labelled(name) { for (var k in T.labels) if (T.labels[k] === name) return k; return null; }
  var TERM_PAGES = {};
  if (labelled('Jupiter Aggregator v6')) TERM_PAGES.jupiter = { id: labelled('Jupiter Aggregator v6'), label: 'Jupiter Aggregator v6' };
  if (labelled('Pump.fun AMM')) TERM_PAGES.pool = { id: labelled('Pump.fun AMM'), label: 'Pump.fun AMM program' };

  /* ---------- derived display values ---------- */
  var SOLD = T.sold;
  var SOLD_SYM = T.soldToken.symbol;
  var price = T.price;
  function usdOf(lamports) { return Math.abs(lamports) / 1e9 * price; }
  function usdText(d) {
    if (d === 0) return '$0';
    if (d < 0.001) return 'under $0.001';
    if (d < 1) return '$' + F.sig(d, 2);
    return '$' + F.group(d.toFixed(2));
  }
  function usdExact(d) { return '$' + F.sig(d, 2); }
  /* "≈ $0.051", but plain "under $0.001": an approximation sign in front of "under" reads as noise */
  function usdApprox(d) { var t = usdText(d); return /^under/.test(t) ? t : '≈ ' + t; }
  function pct(n) { return (Math.round(n * 100) / 100) + '%'; }
  function bps(n) { return (n / 100).toFixed(2) + '%'; }   /* fee splits keep two decimals: 0.02%, 0.93%, 0.30% */
  var POOL = T.pool;   /* decoded Pump.fun fee, or null when it does not reconcile */
  if (POOL) TERMS.poolfee = ['Pool fee', 'The share of the trade the pool keeps before it pays you: ' + bps(POOL.lpBps) + ' to liquidity providers, ' +
    bps(POOL.protocolBps) + ' to Pump.fun and ' + bps(POOL.creatorBps) + ' to the coin creator. Read from the pool’s own event log.'];
  function solRound(lamports) { return F.sig(Math.abs(lamports) / 1e9, 3); }
  var soldUi = Math.abs(SOLD.delta) / Math.pow(10, SOLD.decimals);
  var rentHeld = T.rentHeld[0] || null;
  var labels = {
    pool: T.labels[T.poolOwner] || 'Pool',
    jupFee: T.labels[T.aggFeeTo] || 'Jupiter fee account'
  };

  /* ---------- context: per mounted copy ---------- */
  function Ctx(root, opts) {
    this.root = root; this.opts = opts; this.reg = {}; this.n = 0; this.id = 'ss' + (++uid);
  }
  Ctx.prototype.key = function (o) { var k = 'k' + (++this.n); this.reg[k] = o; return k; };
  Ctx.prototype.signer = function () { return this.opts.viewer !== 'visitor'; };
  Ctx.prototype.you = function (a, b) { return this.signer() ? a : b; };
  Ctx.prototype.ok = function () { return this.opts.status !== 'failed'; };
  /* embedded copies (case-study frames) sit inside a host page: no landmarks, headings start at h3 */
  Ctx.prototype.h = function (n) { return 'h' + Math.min(6, n + (this.opts.embedded ? 2 : 0)); };
  Ctx.prototype.lab = function (id) { return this.opts.embedded ? '' : ' aria-labelledby="' + id + '"'; };

  /* amount chip: rounded text on screen, exact value for copy, screen readers and the popover */
  function amt(ctx, raw, decimals, sym, text, o) {
    o = o || {};
    var abs = Math.abs(Number(raw));
    var exact = F.units(abs, decimals, { trim: true, group: false });
    var grouped = F.units(abs, decimals, { trim: true });
    var mint = sym === 'WSOL' ? SOL : (T.sold && sym === T.soldToken.symbol ? T.sold.mint : null);
    var k = ctx.key({ kind: 'amt', raw: abs, decimals: decimals, sym: sym, exact: exact, grouped: grouped, what: o.what || '', usd: o.usd, mint: mint });
    var shown = text != null ? text : grouped;
    var sign = o.sign ? (Number(raw) < 0 ? '−' : '+') : '';
    var copySign = o.sign && Number(raw) < 0 ? '-' : '';
    return '<button type="button" class="ss-x' + (o.cls ? ' ' + o.cls : '') + '" data-k="' + k + '" data-exact="' + copySign + exact + '"' +
      (o.demo ? ' data-demo="' + o.demo + '"' : '') + (o.tab != null ? ' tabindex="' + o.tab + '"' : '') +
      ' aria-label="' + esc(o.aria || (sign + shown + ' ' + sym + ', exactly ' + sign + grouped + ' ' + sym)) + '">' + (o.html != null ? o.html : esc(sign + shown)) + '</button>';
  }
  function addr(ctx, a, label, o) {
    o = o || {};
    var k = ctx.key({ kind: 'addr', addr: a, label: label || '', note: o.note || '', page: o.page === false ? null : SOLSCAN + '/account/' + a,
      owner: o.owner || null, ownerName: o.ownerName || '' });
    return '<button type="button" class="ss-addr" data-k="' + k + '" data-exact="' + esc(a) + '"' + (o.demo ? ' data-demo="' + o.demo + '"' : '') +
      ' aria-label="' + esc((label ? label + ', ' : '') + 'address ' + F.short(a)) + '">' + esc(F.short(a)) + '</button>';
  }
  function term(ctx, key, text, demo) {
    var k = ctx.key({ kind: 'term', term: key });
    return '<button type="button" class="ss-term" data-k="' + k + '"' + (demo ? ' data-demo="' + demo + '"' : '') + ' aria-haspopup="dialog">' + esc(text) + '</button>';
  }

  /* ---------- sections ---------- */
  function nav(ctx) {
    var wallet = ctx.signer()
      ? '<button type="button" class="ss-wallet" aria-label="Connected wallet ' + esc(F.short(T.signer)) + '"><span class="ss-avatar" aria-hidden="true"></span><span class="mono">' + esc(F.short(T.signer)) + '</span></button>'
      : '<button type="button" class="ss-btn ss-btn--sm">Connect wallet</button>';
    var tag = ctx.opts.embedded ? 'div' : 'header';
    return '<' + tag + ' class="ss-nav">' +
      '<a class="ss-brand" href="#" aria-label="Solscan home" data-act="noop"><span class="ss-brand__mark" aria-hidden="true"></span>solscan</a>' +
      '<label class="ss-search">' + I.search(16) + '<input type="search" placeholder="Search transactions, wallets and tokens" aria-label="Search Solana" autocomplete="off" spellcheck="false"><span class="ss-kbd" aria-hidden="true">/</span></label>' +
      '<div class="ss-nav__end">' +
        '<span class="ss-price mono" title="SOL price used for USD estimates on this page">SOL $' + price.toFixed(2) + '</span>' +
        '<button type="button" class="ss-icon-btn ss-search-btn" aria-label="Search">' + I.search(18) + '</button>' +
        '<button type="button" class="ss-icon-btn" data-act="theme" aria-label="Switch light or dark theme">' + I.contrast(18) + '</button>' +
        wallet +
      '</div></' + tag + '>';
  }

  function crumbs(ctx) {
    var tag = ctx.opts.embedded ? 'div' : 'nav';
    return '<' + tag + ' class="ss-crumbs"' + (ctx.opts.embedded ? '' : ' aria-label="Breadcrumb"') + '><a href="#" data-act="noop">Transactions</a><span aria-hidden="true">/</span>' +
      (ctx.ok() ? '<span class="mono">' + esc(F.short(T.signature)) + '</span>' : '<span class="ss-flag">Example, not a real transaction</span>') + '</' + tag + '>';
  }

  /* the two actions: share a success; on a failure the next step is to try again, so no green */
  function actions(ctx) {
    var copy = '<button type="button" class="ss-btn" data-act="copylink">' + I.link(16) + 'Copy link</button>';
    if (ctx.ok()) return copy + '<button type="button" class="ss-btn ss-btn--primary" data-act="share">' + I.share(16) + 'Share receipt</button>';
    return copy + '<a class="ss-btn ss-btn--ink" href="https://jup.ag/" target="_blank" rel="noopener noreferrer">' + I.retry(16) + 'Try again on Jupiter</a>';
  }

  function receipt(ctx) {
    var ok = ctx.ok();
    var when = F.dateUTC(T.blockTime);
    var ago = F.ago(T.blockTime, ctx.opts.now);
    var gotUsd = usdOf(T.signerDelta);
    var stamp = ok
      ? '<span class="ss-stamp">' + I.check(14) + 'Swap complete</span><span class="ss-final">' + term(ctx, 'finalized', 'Final', 'final') + ', can’t be reversed</span>'
      : '<span class="ss-stamp ss-stamp--fail">' + I.x(14) + 'Didn’t go through</span><span class="ss-final">' + term(ctx, 'finalized', 'Final', 'final') + ', nothing was swapped</span>';
    var who = ctx.you('You', 'This wallet');
    var title = ok
      ? (ctx.signer() ? 'You swapped ' + esc(SOLD_SYM) + ' for SOL' : addr(ctx, T.signer, 'Signer') + ' swapped ' + esc(SOLD_SYM) + ' for SOL')
      : (ctx.signer() ? 'Your swap didn’t go through' : 'This swap didn’t go through');
    var gave = '<div class="ss-side">' +
      '<div class="ss-side__label">' + (ok ? who + ' gave' : who + ' tried to sell') + '</div>' +
      '<div class="ss-big">' + amt(ctx, SOLD.delta, SOLD.decimals, SOLD_SYM, F.compact(soldUi), { cls: 'ss-big__num', what: ok ? 'Sold' : 'Not sold', demo: 'gave' }) +
        '<span class="ss-big__sym">' + tok(SOLD_SYM) + esc(SOLD_SYM) + '</span></div>' +
      '<div class="ss-side__sub">' + (ok ? ctx.you('All of your ', 'All of its ') + esc(SOLD_SYM) + ', balance now <b>0</b>' : '<b>' + ctx.you('Your ', 'Its ') + esc(SOLD_SYM) + ' was not moved</b>') + '</div></div>';
    var got = ok
      ? '<div class="ss-side"><div class="ss-side__label">' + who + ' got</div>' +
        '<div class="ss-big">' + amt(ctx, T.signerDelta, 9, 'SOL', solRound(T.signerDelta), { cls: 'ss-big__num', what: 'Net change in SOL, after fees', usd: gotUsd, demo: 'got' }) +
        '<span class="ss-big__sym">' + tok('SOL') + 'SOL</span></div>' +
        '<div class="ss-side__sub">' + usdApprox(gotUsd) + ' after fees, as plain SOL, not ' + term(ctx, 'wsol', 'WSOL', 'wsol') + '</div></div>'
      : '<div class="ss-side"><div class="ss-side__label">' + who + ' got</div>' +
        '<div class="ss-big ss-big--none"><span class="ss-big__num">Nothing</span></div></div>';
    var fees = POOL
      ? ', the ' + pct(T.poolFeePct) + ' Pump.fun ' + term(ctx, 'poolfee', 'pool fee', null) + ' and the ' + pct(T.aggFeePct) + ' Jupiter fee. '
      : ' and the ' + pct(T.aggFeePct) + ' Jupiter fee. ';
    var costLine = ok
      ? '<div class="ss-cost"><span class="ss-cost__k">Cost</span>' +
          '<span class="ss-cost__v">' + usdText(usdOf(T.cost)) + ' <span class="mono">' + amt(ctx, T.cost, 9, 'SOL', solRound(T.cost), { what: POOL ? 'Network fee, pool fee and Jupiter fee' : 'Network fee plus Jupiter fee', usd: usdOf(T.cost) }) + ' SOL</span></span>' +
          '<span class="ss-cost__how">' + term(ctx, 'netfee', 'Network fee', null) + fees + '<a href="#" data-act="goto" data-to="ledger">Where the money went</a></span></div>'
      : '<div class="ss-cost"><span class="ss-cost__k">Cost</span>' +
          '<span class="ss-cost__v">' + usdText(usdOf(T.fee)) + ' <span class="mono">' + amt(ctx, T.fee, 9, 'SOL', F.units(T.fee, 9, { trim: true }), { what: 'Network fee', usd: usdOf(T.fee) }) + ' SOL</span></span>' +
          '<span class="ss-cost__how">' + ctx.you('You still paid the ', 'It still paid the ') + term(ctx, 'netfee', 'network fee', null) + '.</span></div>';
    var reason = ok ? '' :
      '<p class="ss-reason">' + I.alert(16) + '<span><b>Why:</b> the price moved more than ' + ctx.you('your', 'the') + ' ' + term(ctx, 'slippage', 'slippage limit', 'slippage') +
        ' allowed before the swap landed, so nothing was traded.' + ctx.you(' Try again; if it keeps failing, try a smaller amount.', '') + '</span></p>';
    var h = ctx.h(1);
    return '<section class="ss-receipt" data-sec="receipt"' + ctx.lab(ctx.id + '-t') + '>' +
      '<div class="ss-receipt__body">' +
        '<div class="ss-receipt__status">' + stamp + '</div>' +
        '<' + h + ' class="ss-receipt__title" id="' + ctx.id + '-t">' + title + '</' + h + '>' +
        '<p class="ss-receipt__meta"><span class="ss-seg-t">Via Jupiter</span><span class="ss-dot ss-dot--first" aria-hidden="true">·</span><span class="ss-seg-t">' + esc(when.date) + ', ' + esc(when.time) + '</span>' +
          '<span class="ss-dot" aria-hidden="true">·</span><time class="ss-seg-t" datetime="' + new Date(T.blockTime * 1000).toISOString() + '">' + esc(ago) + '</time></p>' +
        '<div class="ss-pair">' + gave +
          '<div class="ss-pair__arrow" aria-hidden="true"><span>' + '<span class="ss-arrow-d">' + I.down(16) + '</span><span class="ss-arrow-r">' + I.right(16) + '</span></span></div>' +
          got + '</div>' +
      '</div>' +
      '<div class="ss-perf" aria-hidden="true"></div>' +
      /* failed: what it cost comes before why, so stamp, "not moved", the fee and the reason all fit above a phone's dock */
      '<div class="ss-receipt__foot">' + costLine + reason +
        '<div class="ss-receipt__actions">' + actions(ctx) + '</div>' +
      '</div></section>';
  }

  function ledger(ctx) {
    var ok = ctx.ok();
    var rowsId = ctx.id + '-fee';
    /* signed lines add up to the total; split rows and the subtotal carry no sign, so nobody adds them twice */
    var lam = function (raw, demo, how) {
      var o = { sign: !how, demo: demo };
      return '<span class="ss-num">' + (how === 'sum' ? '<span class="ss-eq" aria-hidden="true">= </span>' : '') + amt(ctx, raw, 9, 'SOL', F.units(Math.abs(raw), 9), o) + '</span>';
    };
    /* a row whose label opens sub-rows (network fee split, pool fee split) */
    function disclosed(name, label, note, raw, open, subs) {
      return '<tr><th scope="row"><button type="button" class="ss-disclose" data-act="rows" data-rows="' + name + '" aria-expanded="' + open + '" aria-controls="' + rowsId + '">' +
          '<span class="ss-ledger__what">' + label + '</span>' + I.chev(16) + '</button>' +
          '<span class="ss-ledger__note">' + note + '</span></th><td>' + lam(raw) + '</td></tr>' +
        subs.map(function (r) { return '<tr class="is-sub" data-rows="' + name + '"' + (open ? '' : ' hidden') + '><th scope="row">' + r[0] + '</th><td>' + lam(r[1], null, 'part') + '</td></tr>'; }).join('');
    }
    var feeOpen = !!ctx.opts.feeOpen;
    var feeRows = disclosed('fee', 'Network fee', 'Paid to Solana to process the transaction', -T.fee, feeOpen, [
      ['Base fee, 1 signature', -T.baseFee],
      [term(ctx, 'priority', 'Priority fee', null) + ', to get in faster', -T.priorityFee]
    ]);
    var body;
    if (!ok) body = feeRows;
    else if (POOL) {
      var poolOpen = ctx.opts.poolOpen != null ? !!ctx.opts.poolOpen : feeOpen;
      body =
        '<tr><th scope="row"><span class="ss-ledger__what">Sale value, before the pool’s fee</span><span class="ss-ledger__note">' + esc(F.compact(soldUi)) + ' ' + esc(SOLD_SYM) + ' at the Pump.fun pool’s price</span></th><td>' + lam(T.poolGross) + '</td></tr>' +
        disclosed('pool', '<span class="ss-c">Pool fee</span><span class="ss-w">Pump.fun pool fee</span>, ' + pct(T.poolFeePct), 'Kept by the Pump.fun pool, read from its own event log', -T.poolFee, poolOpen, [
          ['Liquidity providers, ' + bps(POOL.lpBps), -POOL.lp],
          ['Pump.fun protocol, ' + bps(POOL.protocolBps), -POOL.protocol],
          ['Coin creator, ' + bps(POOL.creatorBps), -POOL.creator]
        ]) +
        '<tr class="is-subtotal"><th scope="row"><span class="ss-ledger__what">Pool paid out, after its fee<span class="vh">, subtotal</span></span><span class="ss-ledger__note">Subtotal. Today’s headline shows this, in WSOL</span></th><td>' + lam(T.swapOut, 'swapout', 'sum') + '</td></tr>' +
        '<tr><th scope="row"><span class="ss-ledger__what">Jupiter fee</span><span class="ss-ledger__note">' + pct(T.aggFeePct) + ' of the output</span></th><td>' + lam(-T.aggFee, 'jupfee') + '</td></tr>' +
        feeRows;
    } else {
      body =
        '<tr><th scope="row"><span class="ss-ledger__what">Swap output</span><span class="ss-ledger__note">Paid by the Pump.fun pool</span></th><td>' + lam(T.swapOut, 'swapout') + '</td></tr>' +
        '<tr><th scope="row"><span class="ss-ledger__what">Jupiter fee</span><span class="ss-ledger__note">' + pct(T.aggFeePct) + ' of the output</span></th><td>' + lam(-T.aggFee, 'jupfee') + '</td></tr>' +
        feeRows;
    }
    var net = ok ? T.signerDelta : -T.fee;
    var total = '<tr class="is-total"><th scope="row"><span class="ss-ledger__what">Change in ' + ctx.you('your', 'this') + ' wallet</span></th><td>' +
      '<span class="ss-num">' + amt(ctx, net, 9, 'SOL', F.units(Math.abs(net), 9), { sign: true, usd: usdOf(net) }) + '</span><span class="ss-unit">SOL</span>' +
      '<span class="ss-ledger__usd">' + usdApprox(usdOf(net)) + '</span></td></tr>';
    var check = ok && T.reconciles
      ? '<p class="ss-check">' + I.check(14) + '<span>Matches ' + ctx.you('your', 'this') + ' wallet’s real balance, ' +
        '<span class="mono">' + F.units(T.signerPre, 9) + '</span> → <span class="mono">' + F.units(T.signerPost, 9) + '</span> SOL</span></p>'
      : '';
    var tokRow = '<div class="ss-tokrow"><div class="ss-tokrow__k">' + tok(SOLD_SYM) + esc(SOLD_SYM) + '</div><div class="ss-tokrow__v">' +
      (ok ? '<span class="ss-num">' + amt(ctx, SOLD.delta, SOLD.decimals, SOLD_SYM, null, { sign: true }) + '</span><span class="ss-unit">' + esc(SOLD_SYM) + '</span><span class="ss-ledger__usd">Balance now 0</span>'
          : '<span class="ss-num">0</span><span class="ss-unit">' + esc(SOLD_SYM) + '</span><span class="ss-ledger__usd">Unchanged</span>') + '</div></div>';
    var note = '';
    if (ok && rentHeld) {
      var times = Math.round(rentHeld.lamports / T.signerDelta);
      var noteTag = ctx.opts.embedded ? 'div' : 'aside';
      note = '<' + noteTag + ' class="ss-note"' + (ctx.opts.embedded ? ' role="note"' : '') + ' aria-label="Good to know">' + I.info(18) + '<div>' +
        '<div class="ss-note__title">Good to know</div>' +
        '<p>' + ctx.you('Your ', 'This wallet’s ') + esc(SOLD_SYM) + ' ' + term(ctx, 'tokenacct', 'token account', null) + ' is empty but still open. It holds <b>' +
          amt(ctx, rentHeld.lamports, 9, 'SOL', solRound(rentHeld.lamports), { usd: usdOf(rentHeld.lamports), what: 'Rent still held' }) + ' SOL (' + usdApprox(usdOf(rentHeld.lamports)) + ')</b> as a ' +
          term(ctx, 'rent', 'rent deposit', null) + ', about ' + times + '× what this swap was worth. ' +
          ctx.you('Close the empty account in your wallet to get it back.', 'The owner can close the empty account to get it back.') + '</p>' +
        '<p class="ss-note__foot">Shown only while that account is open and empty. ' + addr(ctx, rentHeld.account, esc(SOLD_SYM) + ' token account (Token-2022)') + '</p>' +
      '</div></' + noteTag + '>';
    }
    var h = ctx.h(2);
    return '<section class="ss-sec" data-sec="ledger"' + ctx.lab(ctx.id + '-l') + '>' +
      '<div class="ss-sec__head"><div><' + h + ' class="ss-sec__title" id="' + ctx.id + '-l">Where the money went</' + h + '>' +
      '<p class="ss-sec__lede">' + (ok ? 'Read down: the signed lines add up. The last line is the real change in ' + ctx.you('your', 'this') + ' wallet, to the lamport.' : 'Only the network fee left ' + ctx.you('your', 'this') + ' wallet.') + '</p></div></div>' +
      '<table class="ss-ledger"><caption class="vh">Where the money went, in SOL</caption><tbody id="' + rowsId + '">' + body + '</tbody><tfoot>' + total + '</tfoot></table>' +
      check + tokRow + note + '</section>';
  }

  function route(ctx) {
    var ok = ctx.ok();
    var view = ctx.opts.view === 'detailed' ? 'detailed' : 'simple';
    var you = ctx.you('Your wallet', 'This wallet');
    var arrow = '<span class="ss-stop__arrow" aria-hidden="true">' + I.chevR(12) + '</span>';
    /* the money on the line: a chip on each connector. It repeats the stop text, so it is hidden from screen
       readers and kept out of the tab order, but a pointer still opens its exact value. */
    function flow(raw, decimals, sym, text, via) {
      return '<span class="ss-flow" aria-hidden="true">' +
        amt(ctx, raw, decimals, sym, text, { cls: 'ss-flow__chip', tab: -1, html: esc(text) + ' <span>' + esc(sym) + '</span>' +
          (via ? '<em class="ss-flow__via">' + via + '</em>' : '') + I.chevR(12) }) + '</span>';
    }
    function initial(ch) { return '<span class="ss-stop__ini" aria-hidden="true">' + ch + '</span>'; }
    var sold = F.compact(soldUi);
    var stops = ok ? [
      /* non-custodial, shown honestly: the DICE moved from the wallet straight to the pool's vault, so it rides
         on one chip, and Jupiter's stop says it never held it */
      { cls: 'is-you is-short', icon: I.wallet(20), name: esc(you), what: 'Approved the swap' },
      { icon: initial('J'), name: term(ctx, 'jupiter', 'Jupiter', null), what: 'Picked the route',
        amt: 'Never held ' + ctx.you('your', 'its') + ' ' + esc(SOLD_SYM) + ': it went straight to the pool',
        flow: flow(SOLD.delta, SOLD.decimals, SOLD_SYM, sold, 'wallet → pool') },
      { icon: initial('P'), name: term(ctx, 'pool', 'Pump.fun AMM', null), what: 'The pool that filled the trade',
        amt: (POOL ? 'Kept a ' + pct(T.poolFeePct) + ' fee, paid ' : 'Paid ') + amt(ctx, T.swapOut, 9, 'SOL', solRound(T.swapOut)) + ' SOL',
        flow: flow(T.swapOut, 9, 'SOL', solRound(T.swapOut)) },
      { cls: 'is-you', icon: I.wallet(20), name: esc(you), what: 'Received the SOL', amt: amt(ctx, T.signerDelta, 9, 'SOL', solRound(T.signerDelta), { sign: true }) + ' SOL after fees' }
    ] : [
      { cls: 'is-you', icon: I.wallet(20), name: esc(you), what: 'Approved the swap', amt: 'Offered ' + esc(sold) + ' ' + esc(SOLD_SYM) },
      { cls: 'is-stopped', icon: I.x(20), name: term(ctx, 'jupiter', 'Jupiter', null), what: 'Stopped here', amt: 'Output was below ' + ctx.you('your', 'the') + ' minimum, so it cancelled' },
      { icon: initial('P'), name: term(ctx, 'pool', 'Pump.fun AMM', null), what: 'Swap undone', amt: 'Rolled back with the rest' },
      { cls: 'is-you is-muted', icon: I.wallet(20), name: esc(you), what: 'Nothing came back', amt: esc(SOLD_SYM) + ' never left' }
    ];
    var html = '';
    stops.forEach(function (s, i) {
      html += '<li class="ss-stop ' + (s.cls || '') + '"><span class="ss-stop__dot">' + s.icon + '</span>' + (ok ? '' : arrow) +
        '<div class="ss-stop__body"><div class="ss-stop__name">' + s.name + '</div><div class="ss-stop__what">' + s.what + '</div>' + (s.amt ? '<div class="ss-stop__amt">' + s.amt + '</div>' : '') + '</div>' +
        (s.flow || '') + '</li>';
      if (ok && i === 2) {
        html += '<li class="ss-branch">' +
          amt(ctx, T.aggFee, 9, 'SOL', null, { cls: 'ss-branch__tag', demo: 'branchfee', what: 'Jupiter fee, ' + pct(T.aggFeePct) + ' of the output', usd: usdOf(T.aggFee),
            html: '<span class="ss-branch__k">Jupiter fee</span><span class="ss-branch__v">−' + esc(F.units(T.aggFee, 9, { trim: true })) + ' SOL, ' + pct(T.aggFeePct) + '</span>',
            aria: 'Jupiter fee, minus ' + F.units(T.aggFee, 9, { trim: true }) + ' SOL, ' + pct(T.aggFeePct) + ' of the output' }) + '</li>';
      }
    });
    var simple = '<ol class="ss-route' + (ok ? ' ss-route--flow' : '') + '" aria-label="Route of the swap">' + html + '</ol>' +
      (ok ? '' : '<p class="ss-route__foot">Nothing moved except the network fee.</p>');
    var seg = '<div class="ss-seg" role="radiogroup" aria-label="Level of detail">' +
      '<button type="button" role="radio" data-act="view" data-v="simple" aria-checked="' + (view === 'simple') + '" tabindex="' + (view === 'simple' ? 0 : -1) + '">Simple</button>' +
      '<button type="button" role="radio" data-act="view" data-v="detailed" aria-checked="' + (view === 'detailed') + '" tabindex="' + (view === 'detailed' ? 0 : -1) + '">Detailed</button></div>';
    var h = ctx.h(2);
    return '<section class="ss-sec" data-sec="route"' + ctx.lab(ctx.id + '-r') + '>' +
      '<div class="ss-sec__head"><div><' + h + ' class="ss-sec__title" id="' + ctx.id + '-r">How it happened</' + h + '>' +
      '<p class="ss-sec__lede">' + (view === 'simple' ? (ok ? 'One hop, one pool: Jupiter sent the whole trade through Pump.fun AMM.' : 'The short version. Switch to Detailed for every movement.') : 'Every movement, in the order it ran.') + '</p></div>' + seg + '</div>' +
      (view === 'simple' ? simple : detail(ctx)) + '</section>';
  }

  var PARTY = {};
  PARTY[T.tempAccounts[0]] = 'Temporary SOL account';
  PARTY[T.tempAccounts[1]] = 'Pump.fun tracking account';
  PARTY[T.poolOwner] = 'Pump.fun pool';

  function party(ctx, a) {
    if (a === T.signer) return '<span class="ss-party">' + ctx.you('You', 'This wallet') + '</span>';
    var name = PARTY[a] || T.labels[a] || 'Account';
    return '<span class="ss-party">' + esc(name) + '</span> ' + addr(ctx, a, (T.labels[a] ? T.labels[a] : name));
  }
  /* a token transfer moves between token accounts: show the account itself, named for its owner */
  function acctParty(ctx, acct, owner, sym) {
    if (PARTY[acct]) return party(ctx, acct);
    var ownerName = owner === T.signer ? ctx.you('your wallet', 'this wallet') : (T.labels[owner] || F.short(owner));
    var name = owner === T.signer ? ctx.you('Your ', 'Its ') + sym + ' account'
      : owner === T.poolOwner ? 'Pump.fun pool vault'
      : owner === T.aggFeeTo ? 'Jupiter fee account' : sym + ' account';
    return '<span class="ss-party">' + esc(name) + '</span> ' + addr(ctx, acct, sym + ' token account, owned by ' + ownerName,
      owner === T.signer ? null : { owner: owner, ownerName: ownerName });
  }

  function detail(ctx) {
    var ok = ctx.ok();
    if (!ok) {
      return '<div class="ss-detail"><div class="ss-subhead"><' + ctx.h(3) + ' class="ss-subhead__t">Every movement</' + ctx.h(3) + '><span class="ss-count">0 of 0</span></div>' +
        '<p class="ss-foot-note">The swap instruction failed, so Solana rolled back every movement. Only the network fee was charged.</p></div>';
    }
    var arrow = I.right(12) + '<span class="vh"> to </span>';
    var h3 = ctx.h(3);
    var mv = T.movements;
    var items = mv.map(function (m) {
      var what, sub, amount, from, to;
      if (m.kind === 'deposit') {
        var isWsol = m.to === T.tempAccounts[0];
        what = term(ctx, 'rent', 'Rent deposit', null) + ': ' + (isWsol ? 'temporary SOL account' : 'Pump.fun tracking account');
        sub = isWsol ? 'Opened to receive the swap output' : 'Pump.fun opens it to record trading volume';
        amount = amt(ctx, -m.raw, 9, 'SOL', null, { sign: true }) + '<span class="ss-unit">SOL</span>';
      } else if (m.kind === 'refund') {
        what = 'Deposit returned<span class="ss-tag">Missing today</span>';
        sub = 'Pump.fun closed its tracking account. This isn’t a transfer instruction, so the current page never shows it.';
        amount = amt(ctx, m.raw, 9, 'SOL', null, { sign: true }) + '<span class="ss-unit">SOL</span>';
      } else if (m.kind === 'close') {
        what = 'Temporary account closed';
        sub = F.units(T.arrived, 9, { trim: true }) + ' SOL of swap output plus its ' + F.units(m.raw - T.arrived, 9, { trim: true }) + ' deposit, unwrapped back to plain SOL';
        amount = amt(ctx, m.raw, 9, 'SOL', null, { sign: true }) + '<span class="ss-unit">SOL</span>';
      } else if (m.mint !== SOL) {
        what = 'Sold to the pool';
        sub = 'From ' + ctx.you('your', 'its') + ' ' + esc(m.symbol) + ' account to the pool’s vault';
        amount = amt(ctx, -m.raw, m.decimals, m.symbol, null, { sign: true }) + '<span class="ss-unit">' + esc(m.symbol) + '</span>';
      } else if (m.to === T.signer) {
        what = 'Pool paid out';
        sub = 'In ' + term(ctx, 'wsol', 'wrapped SOL', null) + (POOL ? ', after the pool’s ' + pct(T.poolFeePct) + ' fee' : '') + ', into the temporary account';
        amount = amt(ctx, m.raw, 9, 'WSOL', null, { sign: true }) + '<span class="ss-unit">WSOL</span>';
      } else {
        what = 'Jupiter fee, ' + pct(T.aggFeePct);
        sub = 'Taken from the swap output';
        amount = amt(ctx, -m.raw, 9, 'WSOL', null, { sign: true }) + '<span class="ss-unit">WSOL</span>';
      }
      if (m.kind === 'token') { from = acctParty(ctx, m.fromAcct, m.from, m.symbol); to = acctParty(ctx, m.toAcct, m.to, m.symbol); }
      else { from = party(ctx, m.from); to = party(ctx, m.to); }
      return '<li><span class="ss-moves__n">' + m.n + '</span><div class="ss-moves__what">' + what + '<small>' + sub + '</small></div>' +
        '<div class="ss-moves__amt">' + amount + '</div><div class="ss-moves__path">' + from + arrow + to + '</div></li>';
    }).join('');
    items += '<li class="is-fee"><span class="ss-moves__n">fee</span><div class="ss-moves__what">' + term(ctx, 'netfee', 'Network fee', null) +
      '<small>Base ' + F.units(T.baseFee, 9, { trim: true }) + ' plus priority ' + F.units(T.priorityFee, 9, { trim: true }) + '</small></div>' +
      '<div class="ss-moves__amt">' + amt(ctx, -T.fee, 9, 'SOL', null, { sign: true }) + '<span class="ss-unit">SOL</span></div>' +
      '<div class="ss-moves__path">' + party(ctx, T.signer) + arrow + '<span class="ss-party">Solana network</span></div></li>';

    var walletRows = mv.filter(function (m) { return m.wallet !== null; });
    var sum = walletRows.map(function (m) { return (m.wallet < 0 ? '− ' : '+ ') + F.units(Math.abs(m.wallet), 9, { trim: true }); }).join(' ') +
      ' − ' + F.units(T.fee, 9, { trim: true }) + ' = +' + F.units(T.signerDelta, 9, { trim: true }) + ' SOL';
    var rows = walletRows.map(function (m) { return m.n; });
    var steps = T.steps.map(function (s) {
      var pct = Math.max(1.5, s.cu / T.cuUsed * 100);
      return '<li><span class="ss-steps__n">' + s.index + '</span><span>' + esc(s.title) + '<a class="ss-steps__prog" href="' + SOLSCAN + '/account/' + esc(s.programId) + '" target="_blank" rel="noopener noreferrer">' + esc(s.program) + '</a></span>' +
        '<span class="ss-steps__cu">' + F.group(String(s.cu)) + '</span><span class="ss-steps__bar" aria-hidden="true"><i style="width:' + pct.toFixed(1) + '%"></i></span></li>';
    }).join('');
    var rawOpen = !!ctx.opts.rawOpen;
    return '<div class="ss-detail">' +
      '<div class="ss-subhead"><' + h3 + ' class="ss-subhead__t">Every movement</' + h3 + '><span class="ss-count" aria-label="' + mv.length + ' of ' + mv.length + ' movements shown">' + mv.length + ' of ' + mv.length + '</span></div>' +
      '<ol class="ss-moves">' + items + '</ol>' +
      '<div class="ss-sum">Rows ' + rows.slice(0, -1).join(', ') + ' and ' + rows[rows.length - 1] + ', plus the network fee, are the ones that change ' + ctx.you('your', 'this') + ' SOL balance:' +
        '<span class="mono">' + sum + (T.movementsReconcile ? I.check(14) : '') + '</span></div>' +
      '<p class="ss-foot-note">' + T.tempAccounts.length + ' temporary accounts were opened and closed; their ' + F.units(T.tempRentOpened, 9, { trim: true }) +
        ' SOL of rent came back in full. ' + (rentHeld ? 'The ' + solRound(rentHeld.lamports) + ' SOL in the empty ' + esc(SOLD_SYM) + ' account is different: it is still held.' : '') + '</p>' +
      '<div class="ss-subhead"><' + h3 + ' class="ss-subhead__t">Program steps</' + h3 + '><span class="ss-count">' + T.steps.length + ' steps · ' + F.group(String(T.cuUsed)) + ' ' + term(ctx, 'cu', 'units', null) + '</span></div>' +
      '<ol class="ss-steps">' + steps + '</ol>' +
      '<div class="ss-raw"><button type="button" class="ss-disclose" data-act="raw" aria-expanded="' + rawOpen + '">Raw transaction (JSON) ' + I.chev(16) + '</button>' +
        '<pre tabindex="0" data-raw' + (rawOpen ? '' : ' hidden') + '></pre></div>' +
      '</div>';
  }

  function tech(ctx, expanded) {
    var when = F.dateUTC(T.blockTime, true);
    var ok = ctx.ok();
    var listId = ctx.id + '-tech';
    var lookups = T.lookups.map(function (l) { return addr(ctx, l, 'Address lookup table'); }).join(' ');
    var link = 'https://solscan.io/tx/' + T.signature;
    /* the failed state is an illustration: never pair the real signature, block or blockhash with "Failed" */
    var ph = '<span class="mono ss-ph">Example…</span>';
    var sig = ok
      ? '<span class="ss-tech__row">' + addr(ctx, T.signature, 'Transaction signature', { demo: 'sig', page: false }) +
          '<button type="button" class="ss-copy" data-act="copy" data-copy="' + esc(T.signature) + '" aria-label="Copy full signature">' + I.copy(15) + '</button></span>'
      : ph;
    /* every tool from today's page has a place: tabs, tool buttons and the menu all land here */
    var ext = function (href, text) { return '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + text + '</a>'; };
    var links = ok
      ? '<a href="#" data-act="goto" data-to="ledger">Balance changes</a><a href="#" data-act="rawlink">Raw JSON</a>' + ext(link, 'Inspect') +
        ext('https://pro-api.solscan.io/pro-api-docs/v2.0', 'API') + ext(link, 'Transaction map') + ext(link, 'Explain this transaction') +
        '<span class="ss-tech__more">' + ext(link, 'Personal label') + ext(link, 'Update name tag') + ext(link, 'Update token info') + ext(link, 'Report address') + '</span>'
      : ext('https://pro-api.solscan.io/pro-api-docs/v2.0', 'API') + '<span class="ss-tech__off">Raw JSON, Inspect and Transaction map open on a real transaction</span>';
    return '<section class="ss-tech" data-sec="tech"' + ctx.lab(ctx.id + '-tt') + '>' +
      '<button type="button" class="ss-tech__toggle" data-act="tech" aria-expanded="' + expanded + '" aria-controls="' + listId + '" id="' + ctx.id + '-tt">' +
        '<span>Technical details<small>' + (ok ? 'Signature, block, status, compute' : 'Example, not a real transaction') + '</small></span>' + I.chev(18) + '</button>' +
      '<div id="' + listId + '"' + (expanded ? '' : ' hidden') + '>' +
      (ok ? '' : '<dl class="ss-tech__list">' +
        '<div><dt>Status</dt><dd>Failed, finalized<span class="ss-sub">Error 6001 in instruction 4 (Jupiter): slippage limit exceeded</span></dd></div>' +
        '<div><dt>Example</dt><dd>Not a real transaction<span class="ss-sub">On a real failed swap, its signature, block, time, signer and compute appear here.</span></dd></div>' +
      '</dl>') +
      (!ok ? '' : '<dl class="ss-tech__list">' +
        '<div><dt>Signature</dt><dd>' + sig + '</dd></div>' +
        '<div><dt>Block</dt><dd><a class="ss-tech__a" href="' + SOLSCAN + '/block/' + T.slot + '" target="_blank" rel="noopener noreferrer">' + T.slot + '</a></dd></div>' +
        '<div><dt>Time</dt><dd>' + esc(when.time) + '<span class="ss-sub">' + esc(when.date) + ', ' + esc(F.ago(T.blockTime, ctx.opts.now)) + '</span></dd></div>' +
        '<div><dt>Approved by</dt><dd>' + ctx.you('Your wallet', 'This wallet') + '<span class="ss-sub">' + addr(ctx, T.signer, 'Signer') + ', the ' + term(ctx, 'signer', 'signer', 'signer') + ' and fee payer</span></dd></div>' +
        /* "Final" is defined once, on the stamp; here the plain line says what it means */
        '<div><dt>Status</dt><dd>Finalized<span class="ss-sub">Confirmed by the network; can’t be reversed</span></dd></div>' +
        '<div><dt>' + term(ctx, 'cu', 'Compute', null) + '</dt><dd>' + F.group(String(T.cuUsed)) + ' of ' + F.group(String(T.cuLimit)) + ' units' +
          '<span class="ss-sub">Priority price ' + F.group(String(T.cuPrice)) + ' micro-lamports per unit</span>' +
          (ok && T.costUnits ? '<span class="ss-sub">Transaction cost ' + F.group(String(T.costUnits)) + ': a block-space score, not a price</span>' : '') + '</dd></div>' +
        '<div><dt>Version</dt><dd>' + T.version + ', with ' + T.lookups.length + ' ' + term(ctx, 'lookup', 'lookup tables', null) + '<span class="ss-sub">' + lookups + '</span></dd></div>' +
        '<div><dt>Blockhash</dt><dd>' + addr(ctx, T.blockhash, 'Recent blockhash', { page: false }) + '</dd></div>' +
      '</dl>') +
      '<div class="ss-tech__links">' + links + '</div>' +
      '</div></section>';
  }

  function ad(ctx) {
    var tag = ctx.opts.embedded ? 'div' : 'aside';
    return '<' + tag + ' class="ss-ad"' + (ctx.opts.embedded ? ' role="group"' : '') + ' aria-label="Sponsored"><div class="ss-ad__label">Sponsored <span>Ads keep Solscan free</span></div>' +
      '<a class="ss-ad__card" href="#" data-act="noop"><span class="ss-ad__mark">' + I.device(22) + '</span>' +
        '<span class="ss-ad__t">Hardware wallet</span><span class="ss-ad__p">Keep your keys offline and approve every swap on the device.</span>' +
        '<span class="ss-ad__cta">Learn more</span></a></' + tag + '>';
  }

  function dock(ctx) {
    return '<div class="ss-dock">' + actions(ctx) + '</div>';
  }

  function footer(ctx) {
    if (!ctx.opts.footer) return '';
    return '<footer class="ss-foot"><div class="ss-foot__in">' + ctx.opts.footer + '</div></footer>';
  }

  function page(ctx) {
    if (ctx.opts.only === 'receipt') return receipt(ctx);
    /* a failed example has no real signature or block to show, so its rail starts closed */
    var techOpen = ctx.opts.techOpen != null ? ctx.opts.techOpen : (ctx.ok() && (ctx.wide || ctx.opts.view === 'detailed'));
    var main = ctx.opts.embedded ? 'div' : 'main';
    return nav(ctx) +
      '<' + main + ' class="ss-main"><div class="ss-wrap">' +
        '<div class="ss-col">' + crumbs(ctx) + receipt(ctx) + ledger(ctx) + route(ctx) + '</div>' +
        '<div class="ss-rail">' + tech(ctx, techOpen) + ad(ctx) + '</div>' +
      '</div></' + main + '>' + footer(ctx) + dock(ctx);
  }

  /* ---------- clipboard ---------- */
  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta); return ok;
    }
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  /* selecting and copying a rounded or formatted number gives its exact plain value */
  document.addEventListener('copy', function (e) {
    var sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !e.clipboardData) return;
    var range = sel.getRangeAt(0);
    var anc = range.commonAncestorContainer;
    var el = anc.nodeType === 1 ? anc : anc.parentElement;
    if (!el || !el.closest('.ss')) return;
    var single = el.closest('[data-exact]');
    if (single) { e.clipboardData.setData('text/plain', single.getAttribute('data-exact')); e.preventDefault(); return; }
    var frag = range.cloneContents();
    var chips = frag.querySelectorAll('[data-exact]');
    if (!chips.length) return;
    Array.prototype.forEach.call(chips, function (c) { c.textContent = c.getAttribute('data-exact'); });
    var box = document.createElement('div');
    box.className = 'ss-copybuf';
    box.appendChild(frag);
    el.closest('.ss').appendChild(box);
    var text = box.innerText.replace(/−/g, '-');
    box.parentNode.removeChild(box);
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
  });

  function store(k, v) {
    try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; }
    return null;
  }

  /* ---------- mount ---------- */
  function mount(root, opts) {
    opts = opts || {};
    opts.viewer = opts.viewer || 'signer';
    opts.status = opts.status || 'success';
    if (opts.persist) {
      var saved = store('ss:view');
      if (!opts.view && (saved === 'detailed' || saved === 'simple')) opts.view = saved;
    }
    opts.view = opts.view || 'simple';
    var ctx = new Ctx(root, opts);
    root.classList.add('ss');
    root.classList.toggle('ss--failed', opts.status === 'failed');
    root.innerHTML = '';
    ctx.wide = (opts.width || root.clientWidth) >= 1120;
    root.innerHTML = page(ctx);
    var scroller = opts.scroller || null;   /* null = window */
    var host = opts.layerHost || null;
    var layer = null, sheetTrigger = null;
    var pop = { el: null, trigger: null, pinned: false };
    var hoverT = 0, leaveT = 0, pressT = 0, longPressed = false, demoing = false;

    function compact() { return !opts.popovers && root.clientWidth < COMPACT; }

    /* ----- content for popover and sheet ----- */
    function contentFor(t) {
      var o = ctx.reg[t.getAttribute('data-k')];
      if (!o) return null;
      if (o.kind === 'amt') {
        var unitsName = o.sym === 'SOL' || o.sym === 'WSOL' ? 'lamports' : 'base units';
        var usd = o.usd != null ? o.usd : (o.sym === 'SOL' || o.sym === 'WSOL' ? usdOf(o.raw) : null);
        return { copy: o.exact, label: 'Copy exact', html:
          '<div class="ss-pop__k">' + (o.what ? esc(o.what) : 'Exact amount') + '</div>' +
          '<div class="ss-pop__v">' + esc(o.grouped) + ' <span>' + esc(o.sym) + '</span></div>' +
          '<p class="ss-pop__meta"><span class="mono">' + F.group(String(o.raw)) + '</span> ' + unitsName + ', ' + o.decimals + ' decimals</p>' +
          (usd != null ? '<p class="ss-pop__meta">≈ ' + usdExact(usd) + ' at SOL $' + price.toFixed(2) + ', fixed for this swap so it doesn’t drift</p>' : '') +
          (o.mint ? goLink(SOLSCAN + '/token/' + o.mint, esc(o.sym) + ' token page on Solscan') : '') +
          '<div class="ss-pop__foot"><span>Copies as <code>' + esc(o.exact) + '</code></span>' + '[[btn]]</div>' };
      }
      if (o.kind === 'addr') {
        return { copy: o.addr, label: 'Copy', html:
          '<div class="ss-pop__k">' + esc(o.label || 'Address') + '</div>' +
          '<div class="ss-pop__v ss-pop__v--addr">' + esc(o.addr) + '</div>' +
          (o.page ? goLink(o.page, 'Account page on Solscan') : '') +
          (o.owner ? goLink(SOLSCAN + '/account/' + o.owner, 'Owner: ' + esc(o.ownerName)) : '') +
          '<div class="ss-pop__foot"><span>Full value, ' + o.addr.length + ' characters</span>[[btn]]</div>' };
      }
      if (o.kind === 'term') {
        var d = TERMS[o.term];
        var prog = TERM_PAGES[o.term];
        return { html: '<div class="ss-pop__k">In plain words</div><div class="ss-pop__title">' + esc(d[0]) + '</div><p class="ss-pop__p">' + esc(d[1]) + '</p>' +
          (prog ? goLink(SOLSCAN + '/account/' + prog.id, esc(prog.label) + ' on Solscan') : '') };
      }
      return null;
    }
    function btn(c, big) {
      if (!c.copy) return '';
      return '<button type="button" class="ss-btn ' + (big ? '' : 'ss-btn--sm') + '" data-act="copy" data-copy="' + esc(c.copy) + '">' + I.copy(14) + esc(c.label) + '</button>';
    }

    /* ----- desktop popover ----- */
    function closePop(refocus) {
      clearTimeout(hoverT); clearTimeout(leaveT);
      if (!pop.el) return;
      var t = pop.trigger;
      if (pop.el.parentNode) pop.el.parentNode.removeChild(pop.el);
      if (t) { t.setAttribute('aria-expanded', 'false'); t.removeAttribute('aria-controls'); }
      pop.el = null; pop.trigger = null; pop.pinned = false;
      if (refocus && t) t.focus();
    }
    function openPop(t, pinned) {
      if (pop.trigger === t) { pop.pinned = pop.pinned || pinned; return; }
      closePop(false);
      var c = contentFor(t); if (!c) return;
      var el = document.createElement('div');
      el.className = 'ss-pop';
      el.id = ctx.id + '-pop';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-label', t.getAttribute('aria-label') || t.textContent);
      el.innerHTML = c.html.replace('[[btn]]', btn(c, false));
      t.parentNode.insertBefore(el, t.nextSibling);
      t.setAttribute('aria-expanded', 'true');
      t.setAttribute('aria-controls', el.id);
      pop.el = el; pop.trigger = t; pop.pinned = !!pinned;
      place(el, t);
    }
    function place(el, t) {
      var op = el.offsetParent || root;
      var o = op.getBoundingClientRect();
      var r = t.getBoundingClientRect();
      var rr = root.getBoundingClientRect();
      var w = el.offsetWidth, h = el.offsetHeight;
      var left = r.left + r.width / 2 - w / 2;
      left = Math.max(rr.left + 12, Math.min(left, rr.right - w - 12));
      var viewBottom = scroller ? scroller.getBoundingClientRect().bottom : window.innerHeight;
      var top = r.bottom + 8;
      if (top + h > viewBottom - 8 && r.top - h - 8 > (scroller ? scroller.getBoundingClientRect().top : 0)) top = r.top - h - 8;
      el.style.left = (left - o.left + (op.scrollLeft || 0)) + 'px';
      el.style.top = (top - o.top + (op.scrollTop || 0)) + 'px';
    }

    /* ----- phone bottom sheet ----- */
    /* The sheet is a modal dialog only while open. Closed, it is inert and hidden from the accessibility tree,
       so its buttons leave the tab order. Open, the page behind it is inert and Tab cycles inside the sheet.
       (A native <dialog> would escape the phone frame into the top layer, so this is done by hand.) */
    function setInert(el, on) {
      if (!el) return;
      if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert');
    }
    function focusables(el) {
      return Array.prototype.filter.call(el.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])'), function (x) {
        return !x.disabled && x.getClientRects().length > 0;
      });
    }
    function ensureLayer() {
      if (layer) return layer;
      layer = document.createElement('div');
      layer.className = 'ss-layer' + (host ? '' : ' is-fixed');
      layer.innerHTML = '<div class="ss-scrim" data-act="sheetclose"></div><div class="ss-sheet" role="dialog" aria-modal="true" tabindex="-1" inert aria-hidden="true"></div><div class="ss-toast" role="status" aria-live="polite"></div>';
      (host || document.body).appendChild(layer);
      layer.addEventListener('click', onClick);
      layer.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeSheet(); return; }
        if (e.key !== 'Tab' || !layer.classList.contains('is-open')) return;
        var sheet = layer.querySelector('.ss-sheet');
        var f = focusables(sheet);
        if (!f.length) { e.preventDefault(); sheet.focus(); return; }
        var first = f[0], last = f[f.length - 1], cur = document.activeElement;
        if (e.shiftKey && (cur === first || cur === sheet || !sheet.contains(cur))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (cur === last || !sheet.contains(cur))) { e.preventDefault(); first.focus(); }
      });
      return layer;
    }
    function openSheet(t) {
      var c = contentFor(t); if (!c) return;
      ensureLayer();
      var sheet = layer.querySelector('.ss-sheet');
      sheet.setAttribute('aria-label', t.getAttribute('aria-label') || t.textContent);
      sheet.innerHTML = '<div class="ss-sheet__grab" aria-hidden="true"></div>' + c.html.replace('[[btn]]', '') +
        '<div class="ss-sheet__actions">' + (c.copy ? btn(c, true) : '') + '<button type="button" class="ss-btn' + (c.copy ? '' : ' ss-btn--primary') + '" data-act="sheetclose"' + (c.copy ? '' : ' style="grid-column:1 / -1"') + '>Done</button></div>';
      sheetTrigger = t;
      t.setAttribute('aria-expanded', 'true');
      setInert(sheet, false);
      sheet.removeAttribute('aria-hidden');
      setInert(root, true);
      layer.offsetWidth; /* reflow so the transition runs */
      layer.classList.add('is-open');
      var first = sheet.querySelector('button');
      if (first && !demoing) first.focus({ preventScroll: true });
    }
    function closeSheet() {
      if (!layer || !layer.classList.contains('is-open')) return;
      var sheet = layer.querySelector('.ss-sheet');
      layer.classList.remove('is-open');
      setInert(sheet, true);
      sheet.setAttribute('aria-hidden', 'true');
      setInert(root, false);
      if (sheetTrigger) { sheetTrigger.setAttribute('aria-expanded', 'false'); sheetTrigger.focus({ preventScroll: true }); }
      sheetTrigger = null;
    }
    function toast(msg) {
      if (!compact()) return;
      ensureLayer();
      var el = layer.querySelector('.ss-toast');
      el.innerHTML = I.check(14) + esc(msg);
      el.classList.add('is-on');
      clearTimeout(el._t);
      el._t = setTimeout(function () { el.classList.remove('is-on'); }, 1600);
    }
    function markDone(b, text) {
      if (!b) return;
      var old = b.innerHTML;
      b.classList.add('is-done');
      if (b.classList.contains('ss-copy')) b.innerHTML = I.check(15); else b.innerHTML = I.check(14) + esc(text || 'Copied');
      setTimeout(function () { b.classList.remove('is-done'); b.innerHTML = old; }, 1400);
    }

    /* ----- state changes ----- */
    function rerender(sel, html) {
      var cur = root.querySelector(sel);
      if (!cur) return null;
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      var next = tmp.firstElementChild;
      cur.parentNode.replaceChild(next, cur);
      return next;
    }
    function setView(v, focus) {
      if (v !== 'simple' && v !== 'detailed') return;
      closePop(false);
      opts.view = v;
      var sec = rerender('[data-sec="route"]', route(ctx));
      if (focus && sec) { var b = sec.querySelector('[data-v="' + v + '"]'); if (b) b.focus({ preventScroll: true }); }
      if (opts.persist) store('ss:view', v);
      if (opts.url) {
        try {
          var u = new URL(window.location.href);
          if (v === 'detailed') u.searchParams.set('view', 'detailed'); else u.searchParams.delete('view');
          window.history.replaceState(null, '', u.toString());
        } catch (e) { /* file:// or sandboxed: keep going */ }
      }
    }
    function fillRaw(pre) {
      if (pre && !pre.textContent) pre.textContent = JSON.stringify(T.raw, null, 2);
    }
    /* room: when the section is near the end of the page, the scroll would be clamped and the section would open
       halfway down, half hidden under the sticky header. Pad the end of the page so it can sit right under it. */
    function scrollToSec(name, smooth, room) {
      var el = root.querySelector('[data-sec="' + name + '"]') || root.querySelector(name);
      if (!el) return;
      var navH = (root.querySelector('.ss-nav') || { offsetHeight: 0 }).offsetHeight;
      var y, max;
      if (scroller) {
        y = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - navH - 16;
        max = scroller.scrollHeight - scroller.clientHeight;
      } else {
        y = el.getBoundingClientRect().top + window.scrollY - navH - 16;
        max = document.documentElement.scrollHeight - window.innerHeight;
      }
      if (room && y > max) {
        /* pad the column the section lives in, so a sticky rail beside it keeps its place too */
        var pad = el.closest('.ss-col') || root.querySelector('.ss-main');
        if (pad) pad.style.paddingBottom = (parseFloat(window.getComputedStyle(pad).paddingBottom) + Math.ceil(y - max)) + 'px';
      }
      if (scroller) scroller.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
      else window.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' });
    }

    function link() {
      var u = window.location.href;
      return /^https?:/.test(u) ? u : 'https://solscan.io/tx/' + T.signature;
    }

    /* ----- events ----- */
    function onClick(e) {
      var t = e.target.closest('.ss-x, .ss-addr, .ss-term');
      if (t && (root.contains(t))) {
        e.preventDefault();
        if (longPressed) { longPressed = false; return; }
        if (compact()) { closePop(false); openSheet(t); }
        else if (pop.trigger === t && pop.pinned) closePop(false);
        else { openPop(t, true); pop.pinned = true; }
        return;
      }
      var a = e.target.closest('[data-act]');
      if (!a) {
        if (pop.el && !pop.el.contains(e.target)) closePop(false);
        return;
      }
      var act = a.getAttribute('data-act');
      if (act === 'noop') { e.preventDefault(); return; }
      if (act === 'view') { setView(a.getAttribute('data-v'), true); return; }
      if (act === 'rows') {
        var open = a.getAttribute('aria-expanded') !== 'true';
        var name = a.getAttribute('data-rows');
        a.setAttribute('aria-expanded', String(open));
        Array.prototype.forEach.call(root.querySelectorAll('tr[data-rows]'), function (r) { if (r.getAttribute('data-rows') === name) r.hidden = !open; });
        return;
      }
      if (act === 'tech') {
        var o2 = a.getAttribute('aria-expanded') !== 'true';
        a.setAttribute('aria-expanded', String(o2));
        var list = root.querySelector('#' + a.getAttribute('aria-controls'));
        if (list) list.hidden = !o2;
        return;
      }
      if (act === 'raw') {
        var o3 = a.getAttribute('aria-expanded') !== 'true';
        a.setAttribute('aria-expanded', String(o3));
        var pre = a.parentNode.querySelector('[data-raw]');
        fillRaw(pre); pre.hidden = !o3;
        return;
      }
      if (act === 'rawlink') {
        e.preventDefault();
        opts.rawOpen = true;
        setView('detailed', false);
        fillRaw(root.querySelector('[data-raw]'));
        scrollToSec('.ss-raw', true);
        return;
      }
      if (act === 'goto') { e.preventDefault(); scrollToSec(a.getAttribute('data-to'), true); return; }
      if (act === 'copy') {
        copyText(a.getAttribute('data-copy')).then(function () { markDone(a); toast('Copied'); });
        return;
      }
      if (act === 'copylink') {
        copyText(link()).then(function () { markDone(a, 'Link copied'); toast('Link copied'); });
        return;
      }
      if (act === 'share') {
        var data = { title: 'Swap receipt', text: 'Swap complete: ' + F.compact(soldUi) + ' ' + SOLD_SYM + ' for ' + solRound(T.signerDelta) + ' SOL', url: link() };
        if (navigator.share && compact()) { navigator.share(data).catch(function () {}); }
        else copyText(data.text + ' ' + data.url).then(function () { markDone(a, 'Copied to share'); toast('Copied to share'); });
        return;
      }
      if (act === 'theme') {
        var d = document.documentElement;
        var cur = d.getAttribute('data-theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        var next = cur === 'dark' ? 'light' : 'dark';
        d.setAttribute('data-theme', next);
        store('ss:theme', next);
        if (typeof opts.onTheme === 'function') opts.onTheme(next);
        return;
      }
      if (act === 'sheetclose') { closeSheet(); return; }
    }
    root.addEventListener('click', onClick);

    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && pop.el) { closePop(true); return; }
      var r = e.target.closest('[role="radio"]');
      if (r && (e.key === 'ArrowRight' || e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        setView(opts.view === 'simple' ? 'detailed' : 'simple', true);
      }
    });
    root.addEventListener('pointerover', function (e) {
      if (e.pointerType === 'touch' || compact()) return;
      if (pop.el && pop.el.contains(e.target)) { clearTimeout(leaveT); return; }
      var t = e.target.closest('.ss-x, .ss-addr, .ss-term');
      if (!t) return;
      clearTimeout(leaveT);
      if (pop.trigger === t) return;
      if (pop.pinned) return;
      clearTimeout(hoverT);
      hoverT = setTimeout(function () { openPop(t, false); }, 260);
    });
    root.addEventListener('pointerout', function (e) {
      if (e.pointerType === 'touch') return;
      var t = e.target.closest('.ss-x, .ss-addr, .ss-term');
      var inPop = pop.el && pop.el.contains(e.target);
      if (!t && !inPop) return;
      var to = e.relatedTarget;
      if (to && ((pop.el && pop.el.contains(to)) || (pop.trigger && pop.trigger.contains(to)))) return;
      clearTimeout(hoverT);
      if (pop.pinned) return;
      leaveT = setTimeout(function () { closePop(false); }, 180);
    });
    /* long press on phones opens the same sheet */
    root.addEventListener('pointerdown', function (e) {
      if (pop.el && !pop.el.contains(e.target) && !(pop.trigger && pop.trigger.contains(e.target))) closePop(false);
      if (e.pointerType !== 'touch') return;
      var t = e.target.closest('.ss-x, .ss-addr, .ss-term');
      if (!t) return;
      clearTimeout(pressT);
      pressT = setTimeout(function () { longPressed = true; openSheet(t); }, 450);
    });
    ['pointerup', 'pointercancel', 'pointermove'].forEach(function (ev) {
      root.addEventListener(ev, function (e) { if (ev !== 'pointermove' || Math.abs(e.movementY) > 4) clearTimeout(pressT); });
    });
    root.addEventListener('contextmenu', function (e) { if (e.target.closest('.ss-x, .ss-addr, .ss-term')) e.preventDefault(); });
    root.addEventListener('submit', function (e) { e.preventDefault(); });

    var api = {
      root: root,
      setView: setView,
      scrollTo: function (n) { scrollToSec(n, false, true); },
      demo: function (key, how) {
        var t = root.querySelector('[data-demo="' + key + '"]');
        if (!t) return;
        demoing = true;
        if (how === 'sheet') openSheet(t); else openPop(t, true);
        demoing = false;
      },
      closeAll: function () { closePop(false); closeSheet(); }
    };
    return api;
  }

  window.SS = { mount: mount, terms: TERMS, store: store };
})();
