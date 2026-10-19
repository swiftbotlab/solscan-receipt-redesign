/* tx.html: paste a Solana transaction signature (or a Solscan / Solana Explorer link) and get a receipt.

   Data: public Solana JSON-RPC (getTransaction, jsonParsed), Jupiter token names and today's SOL price.
   Every figure comes from js/model-any.js (TxModel.deriveReceipt). Everything from the network is treated
   as hostile: the page is built with DOM APIs and textContent only, never innerHTML with data. */
(function () {
  'use strict';

  var M = window.TxModel;
  var root = document.getElementById('app');
  if (!M || !root) return;
  var F = M.fmt;
  var SOL_MINT = M.SOL_MINT;

  /* Public RPCs that answer browser requests (CORS). Left out: api.mainnet-beta.solana.com answers any request
     sent with a browser Origin header with HTTP 403, and solana.drpc.org's free plan refuses mainnet calls.
     The footer names exactly these services. */
  var RPCS = ['https://solana-rpc.publicnode.com', 'https://rpc.solanatracker.io/public'];
  var JUP_TOKENS = 'https://lite-api.jup.ag/tokens/v2/search?query=';
  var JUP_PRICE = 'https://lite-api.jup.ag/price/v3?ids=' + SOL_MINT;
  var MAX_BYTES = 8 * 1024 * 1024;
  var EXAMPLES = [
    { kind: 'Swap', text: 'SOL for zkat, through 3 pools', sig: '4Lmn1QiQDiqZCb7w1AaE1kLJoS7C1QjPx3AtDDyu45CRwSXovZwFtutKydXoest8q2TgMhHF2FFCtGL7srTBvor8' },
    { kind: 'Transfer', text: '289.7 USDC to a new account', sig: '3AC2ZbJ66HvYnwBLe6xrn1gHPd2s7E5yphW5odMc1jgYufZW83nhoPoczc6A1TT9Xm1UFmhRejFZeq1s3kkadYwY' },
    { kind: 'Failed', text: 'a swap stopped by slippage', sig: '46HwtmzetUY6wb8zQxhxfDWDuAKHWQ1CWYvwAKhn3ZehZnaF8ifKgNYR77YEgThXBrDj3e98TfhQo89jUnP62M25' }
  ];

  /* ---------- DOM helpers ---------- */
  function h(tag, a, kids) {
    var el = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = String(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    });
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    if (kids == null || kids === false) return el;
    if (Array.isArray(kids)) { kids.forEach(function (k) { add(el, k); }); return el; }
    if (typeof kids === 'string' || typeof kids === 'number') el.appendChild(document.createTextNode(String(kids)));
    else el.appendChild(kids);
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  var SVGNS = 'http://www.w3.org/2000/svg';
  var ICON = {
    check: [2.2, [['path', 'M5 12.5l4.2 4.2L19 7']]],
    x: [2.2, [['path', 'M6 6l12 12M18 6L6 18']]],
    right: [1.8, [['path', 'M5 12h14M13 6l6 6-6 6']]],
    down: [1.8, [['path', 'M12 5v14M6 13l6 6 6-6']]],
    chev: [1.8, [['path', 'M6 9l6 6 6-6']]],
    copy: [1.8, [['rect', { x: 9, y: 9, width: 11, height: 11, rx: 2.5 }], ['path', 'M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15']]],
    wallet: [1.8, [['path', 'M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3'], ['rect', { x: 4, y: 8, width: 16, height: 11, rx: 2.5 }], ['circle', { cx: 16, cy: 13.5, r: 1.2, fill: 'currentColor', stroke: 'none' }]]],
    search: [1.8, [['circle', { cx: 11, cy: 11, r: 6.5 }], ['path', 'M16 16l4 4']]],
    contrast: [1.8, [['circle', { cx: 12, cy: 12, r: 8 }], ['path', { d: 'M12 4a8 8 0 0 1 0 16z', fill: 'currentColor', stroke: 'none' }]]],
    info: [2, [['circle', { cx: 12, cy: 12, r: 9 }], ['path', 'M12 11v5.5M12 7.6v.1']]],
    alert: [2, [['circle', { cx: 12, cy: 12, r: 9 }], ['path', 'M12 7.5v5.5M12 16.4v.1']]],
    link: [1.8, [['path', 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1'], ['path', 'M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1']]],
    ext: [1.8, [['path', 'M14 5h5v5M19 5l-8 8'], ['path', 'M17 14v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4']]],
    retry: [1.8, [['path', 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3'], ['path', 'M19.5 4.5v4h-4']]],
    pool: [1.8, [['path', 'M12 3.5c3.5 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2-6 5.5-10z']]],
    split: [1.8, [['path', 'M4 12h5c3 0 4-5 7-5h4M9 12c3 0 4 5 7 5h4M17 4l3 3-3 3M17 14l3 3-3 3']]]
  };
  function icon(name, size) {
    var spec = ICON[name];
    var svg = document.createElementNS(SVGNS, 'svg');
    var s = String(size || 16);
    [['width', s], ['height', s], ['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', String(spec[0])],
      ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true'], ['focusable', 'false']].forEach(function (p) { svg.setAttribute(p[0], p[1]); });
    spec[1].forEach(function (p) {
      var el = document.createElementNS(SVGNS, p[0]);
      if (typeof p[1] === 'string') el.setAttribute('d', p[1]);
      else Object.keys(p[1]).forEach(function (k) { el.setAttribute(k, String(p[1][k])); });
      svg.appendChild(el);
    });
    return svg;
  }

  /* ---------- numbers ---------- */
  var price = null;   /* today's SOL price, or null when unavailable */
  function solShort(lamports) {
    var v = Math.abs(lamports) / 1e9;
    return v >= 1 ? F.compact(v) : F.sig(v, 3);
  }
  function solFull(lamports) { return F.units(String(Math.abs(lamports)), 9, { trim: false }); }
  function usdOf(lamports) { return price ? Math.abs(lamports) / 1e9 * price : null; }
  function usdText(d) {
    if (d == null) return '';
    if (d === 0) return '$0';
    if (d < 0.001) return 'under $0.001';
    if (d < 1) return '$' + F.sig(d, 2);
    return '$' + F.group(d.toFixed(2));
  }
  function usdApprox(d) { var t = usdText(d); return !t ? '' : (/^under/.test(t) ? t : '≈ ' + t); }
  function tokShort(raw, decimals) { return F.approx(raw, decimals); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* ---------- per-render context: popover registry ---------- */
  var reg = {}, regN = 0;
  function key(o) { var k = 'k' + (++regN); reg[k] = o; return k; }

  function tokGlyph(a) {
    if (!a || a.kind === 'sol' || a.symbol === 'SOL') return h('span', { class: 'ss-tok ss-tok--sol', 'aria-hidden': 'true' }, h('i'));
    var sym = String(a.symbol || '?');
    var glyph = h('span', { class: 'ss-tok ss-tok--gen', 'aria-hidden': 'true', text: sym.charAt(0).toUpperCase() });
    if (a.icon) {
      var img = h('img', { class: 'tx-tokimg', alt: '', width: '18', height: '18', loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' });
      img.addEventListener('error', function () { if (img.parentNode) img.parentNode.replaceChild(document.createTextNode(sym.charAt(0).toUpperCase()), img); });
      img.src = a.icon;   /* https only, verified tokens only: checked in the model */
      clear(glyph).appendChild(img);
      glyph.classList.add('tx-tok--img');
    }
    return glyph;
  }

  /* amount button: rounded on screen; exact value for copy, screen readers and the popover */
  function amt(raw, decimals, sym, shown, o) {
    o = o || {};
    var s = String(raw);
    var neg = s[0] === '-';
    var abs = neg ? s.slice(1) : s;
    var exact = F.units(abs, decimals, { group: false });
    var grouped = F.units(abs, decimals);
    var sign = o.sign ? (neg ? '−' : '+') : '';
    var text = shown != null ? shown : grouped;
    var k = key({ kind: 'amt', raw: abs, decimals: decimals, sym: sym, exact: exact, grouped: grouped, what: o.what || '', mint: o.mint || null, usd: o.usd });
    return h('button', {
      type: 'button', class: 'ss-x' + (o.cls ? ' ' + o.cls : ''), 'data-k': k, 'data-exact': (o.sign && neg ? '-' : '') + exact,
      'aria-label': o.aria || (sign + text + ' ' + sym + ', exactly ' + sign + grouped + ' ' + sym), 'aria-haspopup': 'dialog'
    }, sign + text);
  }
  function lamAmt(lamports, o) {
    o = o || {};
    return amt(String(lamports), 9, 'SOL', o.shown != null ? o.shown : (o.full ? solFull(lamports) : null), { sign: o.sign, cls: o.cls, what: o.what, usd: usdOf(lamports), mint: SOL_MINT });
  }
  function addr(a, label, o) {
    o = o || {};
    var k = key({ kind: 'addr', addr: a, label: label || 'Address' });
    return h('button', { type: 'button', class: 'ss-addr' + (o.cls ? ' ' + o.cls : ''), 'data-k': k, 'data-exact': a, 'aria-label': (label ? label + ', ' : '') + 'address ' + F.short(a), 'aria-haspopup': 'dialog' }, F.short(a));
  }

  /* ---------- state ---------- */
  var current = null;     /* { sig, receipt, raw, finalized } */
  var cache = {};
  var reqId = 0;

  /* ---------- shell ---------- */
  var els = {};
  function shell() {
    root.classList.add('ss');
    clear(root);
    els.price = h('span', { class: 'ss-price mono', title: 'Today’s SOL price, used for the dollar estimates on this page', hidden: true });
    var nav = h('header', { class: 'ss-nav' }, [
      h('a', { class: 'ss-brand', href: 'tx.html', 'aria-label': 'Receipt, start over' }, [h('span', { class: 'ss-brand__mark', 'aria-hidden': 'true' }), 'receipt']),
      h('div', { class: 'ss-nav__end' }, [
        els.price,
        h('a', { class: 'tx-navlink', href: 'index.html' }, 'Case study'),
        h('button', { type: 'button', class: 'ss-icon-btn', 'data-act': 'theme', 'aria-label': 'Switch light or dark theme' }, icon('contrast', 18))
      ])
    ]);
    els.input = h('input', {
      id: 'tx-q', class: 'tx-field__input mono', type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
      maxlength: '600', placeholder: 'Signature or solscan.io / explorer.solana.com link', 'aria-describedby': 'tx-q-hint tx-q-err'
    });
    els.err = h('p', { class: 'tx-form__err', id: 'tx-q-err', role: 'alert', hidden: true });
    els.form = h('form', { class: 'tx-form', role: 'search', 'aria-label': 'Look up a transaction', novalidate: true }, [
      h('label', { class: 'vh', for: 'tx-q' }, 'Transaction signature or explorer link'),
      h('div', { class: 'tx-field' }, [
        h('span', { class: 'tx-field__icon', 'aria-hidden': 'true' }, icon('search', 18)),
        els.input,
        h('button', { type: 'submit', class: 'ss-btn ss-btn--primary tx-field__go' }, 'Show receipt')
      ]),
      els.err
    ]);
    var chips = h('div', { class: 'tx-examples' }, [h('span', { class: 'tx-examples__k', id: 'tx-q-hint' }, 'Or try a real one:')].concat(EXAMPLES.map(function (e) {
      return h('button', { type: 'button', class: 'tx-chip', 'data-act': 'example', 'data-sig': e.sig, 'aria-label': e.kind + ': ' + e.text }, [h('b', null, e.kind), h('span', null, e.text)]);
    })));
    els.hero = h('div', { class: 'tx-hero' }, [
      h('h1', { class: 'tx-hero__title' }, 'Any Solana transaction, as a receipt'),
      h('p', { class: 'tx-hero__lede' }, 'Paste a transaction signature or an explorer link. You get what was given, what came back, what it cost, and where every lamport went, checked against the chain.')
    ]);
    els.lookup = h('section', { class: 'tx-lookup', 'aria-label': 'Look up a transaction' }, [els.hero, els.form, chips]);
    els.out = h('div', { class: 'tx-out' });
    els.live = h('div', { class: 'vh', 'aria-live': 'polite', role: 'status' });
    var main = h('main', { class: 'ss-main', id: 'main' }, [h('div', { class: 'tx-top' }, els.lookup), els.out, els.live]);
    var foot = h('footer', { class: 'ss-foot' }, h('div', { class: 'ss-foot__in' }, [
      h('div', null, ['Reads public data: the free Solana mainnet RPC servers of PublicNode and Solana Tracker for the transaction, Jupiter for token names and today’s SOL price. Dollar amounts use today’s price, not the price at the time. Nothing you paste leaves your browser except to those services.']),
      h('div', null, ['Concept by Swiftbot (', h('a', { href: 'https://github.com/swiftbotlab', rel: 'noopener noreferrer', target: '_blank' }, 'github.com/swiftbotlab'), '). Not affiliated with Solscan. ', h('a', { href: 'index.html' }, 'Read the case study')])
    ]));
    els.dock = h('div', { class: 'ss-dock', hidden: true });
    add(root, [nav, main, foot, els.dock]);
  }

  /* ---------- states: empty, loading, error ---------- */
  function setCompact(on) {
    els.lookup.classList.toggle('is-compact', !!on);
    els.hero.hidden = !!on;
  }
  function showEmpty() {
    current = null;
    setCompact(false);
    clear(els.out);
    els.dock.hidden = true;
    document.title = 'Solana Tx Receipt';
  }
  function showLoading(sig) {
    setCompact(true);
    clear(els.out);
    els.dock.hidden = true;
    var box = h('section', { class: 'tx-state', 'aria-busy': 'true' }, [
      h('div', { class: 'ss-receipt__status' }, [h('span', { class: 'ss-stamp ss-stamp--wait' }, [h('span', { class: 'ss-pulse', 'aria-hidden': 'true' }), 'Looking it up']),
        h('span', { class: 'ss-final mono', text: F.short(sig) })]),
      h('div', { class: 'tx-skel', 'aria-hidden': 'true' }, [h('i', { class: 'w60' }), h('i', { class: 'w40' }), h('i', { class: 'w80 tall' }), h('i', { class: 'w50' })])
    ]);
    add(els.out, h('div', { class: 'tx-statewrap' }, box));
    els.live.textContent = 'Looking up the transaction.';
  }
  function showError(kind, sig, detail) {
    setCompact(true);
    clear(els.out);
    els.dock.hidden = true;
    var T = {
      notfound: ['Transaction not found', 'The free Solana servers this page asks (PublicNode and Solana Tracker) returned nothing for this signature. Check that it was copied in full. A transaction from the last few seconds may not be visible yet, so try again in a moment. Older transactions may not be kept by these servers: Solscan can still show them.'],
      rate: ['The public Solana servers are busy', 'They are limiting requests right now (rate limited). Wait a minute and try again.'],
      network: ['Could not reach Solana', 'None of the public Solana servers answered. Check your connection, or try again in a minute.'],
      data: ['This transaction could not be read', 'The server sent data this page does not understand' + (detail ? ': ' + detail : '.')]
    }[kind] || ['Something went wrong', 'Try again in a minute.'];
    var actions = [];
    if (kind !== 'data') actions.push(h('button', { type: 'button', class: 'ss-btn', 'data-act': 'retry' }, [icon('retry', 16), 'Try again']));
    if (sig) actions.push(h('a', { class: 'ss-btn', href: 'https://solscan.io/tx/' + sig, target: '_blank', rel: 'noopener noreferrer' }, [icon('ext', 16), 'Open on Solscan']));
    var box = h('section', { class: 'tx-state tx-state--err', 'aria-labelledby': 'tx-err-t' }, [
      h('div', { class: 'ss-receipt__status' }, h('span', { class: 'ss-stamp ss-stamp--fail' }, [icon('alert', 14), kind === 'notfound' ? 'Not found' : (kind === 'rate' ? 'Busy' : 'Error')])),
      h('h1', { class: 'tx-state__title', id: 'tx-err-t' }, T[0]),
      h('p', { class: 'tx-state__p' }, T[1]),
      sig ? h('p', { class: 'tx-state__sig mono' }, sig) : null,
      h('div', { class: 'tx-state__actions' }, actions)
    ]);
    add(els.out, h('div', { class: 'tx-statewrap' }, box));
    els.live.textContent = T[0] + '. ' + T[1];
    document.title = T[0] + ' · Solana Tx Receipt';
  }
  function inputError(msg) {
    els.err.textContent = msg;
    els.err.hidden = !msg;
    els.input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  /* ---------- network ---------- */
  function timedFetch(url, opts, ms) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    var o = { method: opts.method || 'GET', headers: opts.headers || {}, body: opts.body, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', redirect: 'error', mode: 'cors' };
    if (ctl) o.signal = ctl.signal;
    return fetch(url, o).then(function (res) {
      return readCapped(res, ctl).then(function (text) {
        clearTimeout(timer);
        return { status: res.status, text: text };
      });
    }).catch(function (e) { clearTimeout(timer); if (ctl) ctl.abort(); throw e; });
  }
  /* the size cap holds while reading: a body that announces or streams more than MAX_BYTES is dropped
     before it is buffered */
  function readCapped(res, ctl) {
    var len = Number(res.headers.get('content-length'));
    if (len > MAX_BYTES) return Promise.reject(new Error('too large'));
    if (!res.body || typeof res.body.getReader !== 'function' || typeof TextDecoder !== 'function') {
      return res.text().then(function (t) { if (t.length > MAX_BYTES) throw new Error('too large'); return t; });
    }
    var reader = res.body.getReader();
    var dec = new TextDecoder('utf-8');
    var parts = [], n = 0;
    function pump() {
      return reader.read().then(function (x) {
        if (x.done) { parts.push(dec.decode()); return parts.join(''); }
        n += x.value.byteLength;
        if (n > MAX_BYTES) {
          try { reader.cancel(); } catch (e) { /* already closed */ }
          if (ctl) ctl.abort();
          throw new Error('too large');
        }
        parts.push(dec.decode(x.value, { stream: true }));
        return pump();
      });
    }
    return pump();
  }
  function rpc(endpoint, sig, commitment) {
    var body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: [sig, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 1, commitment: commitment }] });
    return timedFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body }, 15000).then(function (r) {
      if (r.status === 429) return { kind: 'rate' };
      if (r.status < 200 || r.status >= 300) return { kind: 'error' };
      var j;
      try { j = JSON.parse(r.text); } catch (e) { return { kind: 'error' }; }
      if (!j || typeof j !== 'object') return { kind: 'error' };
      if (j.error) {
        var msg = String(j.error.message || '');
        if (j.error.code === 429 || j.error.code === -32429 || /rate|too many|limit/i.test(msg)) return { kind: 'rate' };
        return { kind: 'error' };
      }
      return { kind: 'ok', result: j.result || null };
    }, function () { return { kind: 'error' }; });
  }
  /* finalized first; a transaction from the last few seconds may only be confirmed. Every server is asked: one
     server's "nothing" proves little (Solana Tracker keeps no deep history). */
  function fetchTx(sig) {
    var i = 0, nulls = 0, rate = false;
    function next() {
      if (i >= RPCS.length) {
        var e = new Error(nulls ? 'notfound' : (rate ? 'rate' : 'network'));
        e.kind = nulls ? 'notfound' : (rate ? 'rate' : 'network');
        return Promise.reject(e);
      }
      var ep = RPCS[i++];
      return rpc(ep, sig, 'finalized').then(function (a) {
        if (a.kind === 'ok' && a.result) return { tx: a.result, finalized: true };
        if (a.kind === 'rate') { rate = true; return next(); }
        if (a.kind === 'error') return next();
        return rpc(ep, sig, 'confirmed').then(function (b) {
          if (b.kind === 'ok' && b.result) return { tx: b.result, finalized: false };
          if (b.kind === 'rate') rate = true;
          if (b.kind === 'ok') nulls++;
          return next();
        });
      });
    }
    return next();
  }
  function fetchTokens(mints) {
    var list = mints.filter(function (m) { return M.isAddress(m) && m !== SOL_MINT; });
    if (!list.length) return Promise.resolve({ info: {}, ok: true });
    var chunks = [];
    for (var i = 0; i < list.length; i += 40) chunks.push(list.slice(i, i + 40));
    return Promise.all(chunks.map(function (c) {
      return timedFetch(JUP_TOKENS + c.join(','), {}, 8000).then(function (r) {
        if (r.status !== 200) throw new Error('tokens');
        var arr = JSON.parse(r.text);
        if (!Array.isArray(arr)) throw new Error('tokens');
        return arr;
      });
    })).then(function (parts) {
      var info = {};
      parts.forEach(function (arr) {
        arr.forEach(function (t) {
          if (!t || typeof t !== 'object' || list.indexOf(t.id) < 0) return;
          info[t.id] = { symbol: typeof t.symbol === 'string' ? t.symbol : '', name: typeof t.name === 'string' ? t.name : '', icon: typeof t.icon === 'string' ? t.icon : null, verified: t.isVerified === true };
        });
      });
      return { info: info, ok: true };
    }).catch(function () { return { info: {}, ok: false }; });
  }
  function fetchPrice() {
    return timedFetch(JUP_PRICE, {}, 6000).then(function (r) {
      if (r.status !== 200) return null;
      var j = JSON.parse(r.text);
      var p = j && j[SOL_MINT] && j[SOL_MINT].usdPrice;
      return typeof p === 'number' && isFinite(p) && p > 0 && p < 1e6 ? p : null;
    }).catch(function () { return null; });
  }
  /* distinct mints, at most 120, read in one linear pass with a capped number of entries (the model rejects
     longer lists anyway: a transaction has one balance entry per account at most) */
  function mintsOf(tx) {
    var out = [], seen = Object.create(null);
    var m = tx && tx.meta;
    var keys = tx && tx.transaction && tx.transaction.message && tx.transaction.message.accountKeys;
    var cap = Array.isArray(keys) ? Math.min(keys.length, 512) : 0;
    [(m && m.preTokenBalances) || [], (m && m.postTokenBalances) || []].forEach(function (list) {
      if (!Array.isArray(list)) return;
      for (var i = 0; i < list.length && i < cap && out.length < 120; i++) {
        var b = list[i];
        if (b && typeof b.mint === 'string' && b.mint.length <= 44 && !seen[b.mint]) { seen[b.mint] = 1; out.push(b.mint); }
      }
    });
    return out;
  }

  /* ---------- lookup ---------- */
  function lookup(sig, push) {
    var id = ++reqId;
    inputError('');
    closeAll();
    if (push) {
      try { window.history.pushState({ sig: sig }, '', '?sig=' + sig); } catch (e) { /* file:// */ }
    }
    if (cache[sig]) { render(cache[sig]); return; }
    showLoading(sig);
    fetchTx(sig).then(function (got) {
      if (id !== reqId) return;
      var tx = got.tx;
      var sigs = tx && tx.transaction && tx.transaction.signatures;
      if (!Array.isArray(sigs) || sigs[0] !== sig) { showError('data', sig, 'the transaction returned does not match this signature.'); return; }
      /* the whole shape is checked before anything else reads it (token names are fetched for its mints) */
      try { M.checkShape(tx); }
      catch (e) { showError('data', sig, e && e.code === 'bad-data' ? e.message.replace(/\.$/, '') + '.' : null); return; }
      return Promise.all([fetchTokens(mintsOf(tx)), fetchPrice()]).then(function (extra) {
        if (id !== reqId) return;
        price = extra[1];
        var receipt;
        try { receipt = M.deriveReceipt(tx, extra[0].info, price); }
        catch (e) { showError('data', sig, e && e.code === 'bad-data' ? e.message.replace(/\.$/, '') + '.' : null); return; }
        var state = { sig: sig, receipt: receipt, raw: tx, finalized: got.finalized, tokensOk: extra[0].ok };
        if (got.finalized) cache[sig] = state;
        render(state);
      });
    }).catch(function (e) {
      if (id !== reqId) return;
      showError(e && e.kind ? e.kind : 'network', sig);
    });
  }
  function fromLocation(push) {
    var q = null;
    try { q = new URLSearchParams(window.location.search).get('sig'); } catch (e) { q = null; }
    if (!q) { reqId++; showEmpty(); return; }
    var p = M.parseInput(q);
    if (!p.ok) { reqId++; showEmpty(); inputError(p.error); els.input.value = q.slice(0, 600); return; }
    els.input.value = p.sig;
    lookup(p.sig, push);
  }

  /* ---------- the receipt ---------- */
  function render(state) {
    current = state;
    var r = state.receipt;
    price = r.price;
    reg = {}; regN = 0;
    setCompact(true);
    els.input.value = state.sig;
    clear(els.out);
    els.price.hidden = !price;
    els.price.textContent = price ? 'SOL $' + price.toFixed(2) : '';
    var col = h('div', { class: 'ss-col' }, [receipt(r, state), ledger(r), how(r)]);
    var rail = h('div', { class: 'ss-rail' }, tech(r, state));
    add(els.out, h('div', { class: 'ss-wrap' }, [col, rail]));
    clear(els.dock);
    add(els.dock, actions(r, true));
    els.dock.hidden = false;
    document.title = titleText(r) + ' · Solana Tx Receipt';
    els.live.textContent = 'Receipt loaded: ' + titleText(r) + '.';
  }

  function assetSym(a) { return a.kind === 'sol' ? 'SOL' : a.symbol; }
  function unverified(a) { return !!a && a.kind !== 'sol' && a.symbol !== 'SOL' && !a.verified; }
  /* plain text (tab title, live region): an unverified symbol always carries the word */
  function symWords(a) { return assetSym(a) + (unverified(a) ? ' (unverified)' : ''); }
  /* the one "unverified" mark on the page: a small amber pill after the symbol */
  var UNV_TITLE = 'Jupiter has not verified this token. Names and symbols can be copied; the mint address is its real identity.';
  function unvPill() { return h('span', { class: 'tx-unv', title: UNV_TITLE }, 'unverified'); }
  function symNodes(a) { return unverified(a) ? [assetSym(a), ' ', unvPill()] : [assetSym(a)]; }
  /* a token in running text: { symbol, verified } */
  function tokText(sym, verified) { return verified === false ? [sym, ' ', unvPill()] : [sym]; }
  function titleText(r) {
    var s = r.story;
    if (r.mode === 'swap') return 'Swapped ' + symWords(s.gave) + ' for ' + symWords(s.got);
    if (r.mode === 'transfer') {
      var one = s.sends.length === 1 ? s.sends[0] : null;
      if (one && one.recipients.length === 1) return 'Sent ' + amountNum(one.total, one.asset) + ' ' + symWords(one.asset) + ' to ' + F.short(one.recipients[0].owner);
      if (one) return 'Sent ' + amountNum(one.total, one.asset) + ' ' + symWords(one.asset) + ' to ' + one.recipients.length + ' wallets';
      return 'Sent ' + s.sends.map(function (x) { return symWords(x.asset); }).join(' and ');
    }
    if (r.mode === 'failed') return 'Didn’t go through';
    return 'Balance changes';
  }
  function titleNodes(r) {
    var s = r.story;
    if (r.mode === 'swap') return ['Swapped '].concat(symNodes(s.gave), [' for '], symNodes(s.got));
    if (r.mode === 'transfer') {
      var one = s.sends.length === 1 ? s.sends[0] : null;
      if (one && one.recipients.length === 1) return ['Sent ' + amountNum(one.total, one.asset) + ' '].concat(symNodes(one.asset), [' to ', addr(one.recipients[0].owner, 'Recipient')]);
      if (one) return ['Sent ' + amountNum(one.total, one.asset) + ' '].concat(symNodes(one.asset), [' to ' + one.recipients.length + ' wallets']);
      var out = ['Sent '];
      s.sends.forEach(function (x, i) { if (i) out.push(' and '); out = out.concat(symNodes(x.asset)); });
      return out;
    }
    return titleText(r);
  }
  function amountNum(raw, asset) { return asset.kind === 'sol' ? solShort(Number(raw)) : tokShort(raw, asset.decimals); }

  function stamp(r, state) {
    var finalText = state.finalized ? 'Final, can’t be reversed' : 'Confirmed, not final yet';
    if (r.mode === 'failed') return [h('span', { class: 'ss-stamp ss-stamp--fail' }, [icon('x', 14), 'Didn’t go through']),
      h('span', { class: 'ss-final' }, r.story.nothingMoved ? (state.finalized ? 'Final, nothing moved' : 'Nothing moved') : finalText)];
    var label = r.mode === 'swap' ? 'Swap complete' : (r.mode === 'transfer' ? 'Sent' : 'Went through');
    var out = [h('span', { class: 'ss-stamp' }, [icon('check', 14), label]), h('span', { class: 'ss-final' }, finalText)];
    if (r.mode === 'reduced') out.push(h('span', { class: 'ss-flag tx-flag' }, 'Simplified receipt'));
    return out;
  }

  function metaLine(r) {
    var segs = [];
    var lead;
    if (r.mode === 'failed') lead = ['Wallet ', addr(r.feePayer, 'Wallet that signed and paid')];
    else if (r.mode === 'transfer') lead = ['From ', addr(r.feePayer, 'Sender')];
    else if (r.mode === 'reduced') lead = ['Fee paid by ', addr(r.feePayer, 'Fee payer')];
    else lead = ['Wallet ', addr(r.feePayer, 'Wallet that swapped')];
    segs.push(h('span', { class: 'ss-seg-t' }, lead));
    if (r.mode === 'swap' && r.story.venue) segs.push(h('span', { class: 'ss-seg-t' }, 'Via ' + r.story.venue.name));
    if (r.mode === 'failed' && r.story.attempted.length) {
      var named = r.story.attempted.filter(function (p) { return p.known; }).map(function (p) { return p.name; });
      if (named.length) segs.push(h('span', { class: 'ss-seg-t' }, 'Tried ' + named.slice(0, 2).join(', ')));
    }
    var tail = null;
    if (r.blockTime) {
      var when = F.dateUTC(r.blockTime);
      segs.push(h('span', { class: 'ss-seg-t' }, when.date + ', ' + when.time + ','));
      tail = h('time', { class: 'ss-seg-t', datetime: new Date(r.blockTime * 1000).toISOString() }, F.ago(r.blockTime));
    }
    var kids = [];
    segs.forEach(function (s, i) {
      /* a dot wraps together with the segment after it, and "… ago" follows the date after a comma, so a line
         never starts or ends on a dot */
      if (i) kids.push(' ', h('span', { class: 'tx-seg' + (i === 1 ? ' tx-seg--first' : '') }, [h('span', { class: 'ss-dot' + (i === 1 ? ' ss-dot--first' : ''), 'aria-hidden': 'true' }, '·'), s]));
      else kids.push(s);
    });
    if (tail) kids.push(' ', tail);
    return h('p', { class: 'ss-receipt__meta' }, kids);
  }

  function side(label, big, sub, o) {
    o = o || {};
    return h('div', { class: 'ss-side' }, [
      h('div', { class: 'ss-side__label' }, label),
      h('div', { class: 'ss-big' + (o.none ? ' ss-big--none' : '') }, big),
      sub ? h('div', { class: 'ss-side__sub' }, sub) : null
    ]);
  }
  function bigAsset(a, rawShown) {
    var sym = assetSym(a);
    var text = a.kind === 'sol' ? solShort(Number(a.raw)) : tokShort(a.raw, a.decimals);
    var what = rawShown || '';
    return [amt(a.raw, a.decimals, sym, text, { cls: 'ss-big__num', what: what, mint: a.mint, usd: a.kind === 'sol' ? usdOf(Number(a.raw)) : null }),
      h('span', { class: 'ss-big__sym' }, [tokGlyph(a), h('span', { class: 'tx-sym' }, sym)])];
  }
  function arrow() {
    return h('div', { class: 'ss-pair__arrow', 'aria-hidden': 'true' }, h('span', null, [h('span', { class: 'ss-arrow-d' }, icon('down', 16)), h('span', { class: 'ss-arrow-r' }, icon('right', 16))]));
  }
  function unverifiedTag(a) { return a && a.kind !== 'sol' && !a.verified ? unvPill() : null; }

  function receipt(r, state) {
    var s = r.story;
    var body = [h('div', { class: 'ss-receipt__status' }, stamp(r, state))];
    var title;
    if (r.mode === 'swap' || r.mode === 'transfer') {
      title = titleNodes(r);
    } else if (r.mode === 'failed') {
      title = 'This transaction didn’t go through';
    } else if (r.mode === 'reduced') {
      title = r.ownersUnknown ? 'What changed in this transaction' : (multiWallet(r) ? 'What changed for each wallet' : 'What changed in this wallet');
    }
    body.push(h('h1', { class: 'ss-receipt__title', id: 'tx-title' }, title));
    body.push(metaLine(r));

    if (r.mode === 'swap') {
      var gave = s.gave, got = s.got;
      var gaveSub = gave.kind === 'sol'
        ? [gave.fromWrapped === 'all' ? 'Paid from its wrapped SOL (WSOL)' : (gave.fromWrapped === 'part' ? 'Paid partly from its wrapped SOL (WSOL)' : 'Paid into the swap'), price ? ', ' + usdApprox(usdOf(Number(gave.raw))) : '']
        : [gave.post === '0' && gave.sentOutside === '0' && gave.appFee === '0' ? 'All of it: balance now ' : 'Balance now ', h('b', null, tokShort(gave.post, gave.decimals))];
      var gotSub = got.kind === 'sol'
        ? [got.intoWrapped === 'all' ? 'Kept as wrapped SOL (WSOL)' : (got.intoWrapped === 'part' ? 'Partly kept as wrapped SOL (WSOL)' : (r.flags.residualIsSwap ? 'Paid out directly by the pool' : 'Back as plain SOL')), price ? ', ' + usdApprox(usdOf(Number(got.raw))) : '']
        : ['Balance now ', h('b', null, tokShort(got.post, got.decimals))];
      body.push(h('div', { class: 'ss-pair' }, [
        side('Gave', bigAsset(gave, 'Given in the swap'), [h('span', null, gaveSub), unverifiedTag(gave)]),
        arrow(),
        side('Got', bigAsset(got, 'Received from the swap'), [h('span', null, gotSub), unverifiedTag(got)])
      ]));
    } else if (r.mode === 'transfer') {
      var single = s.sends.length === 1 ? s.sends[0] : null;
      var left = single
        ? side('Sent', bigAsset({ kind: single.asset.kind, raw: single.total, decimals: single.asset.decimals, symbol: single.asset.symbol, mint: single.asset.mint || SOL_MINT, icon: single.asset.icon, verified: single.asset.verified }, 'Sent'),
          [h('span', null, single.recipients.length === 1 ? 'To one wallet' : 'Split across ' + single.recipients.length + ' wallets'), unverifiedTag(single.asset)])
        : side('Sent', h('span', { class: 'ss-big__num tx-big-words' }, s.sends.length + ' assets'), 'Listed below');
      var recips = [];
      s.sends.forEach(function (sd) { sd.recipients.forEach(function (x) { recips.push({ owner: x.owner, amount: x.amount, asset: sd.asset, tip: x.tip }); }); });
      var right = h('div', { class: 'ss-side' }, [
        h('div', { class: 'ss-side__label' }, recips.length === 1 ? 'To' : 'To ' + recips.length + ' wallets'),
        h('ul', { class: 'tx-recips' }, recips.slice(0, 6).map(function (x) {
          return h('li', null, [addr(x.owner, x.tip ? 'Jito tip account' : 'Recipient'), h('span', { class: 'tx-recips__amt' }, ['got ', amt(x.amount, x.asset.decimals, x.asset.symbol, x.asset.kind === 'sol' ? solShort(Number(x.amount)) : tokShort(x.amount, x.asset.decimals), { what: 'Received by this wallet', mint: x.asset.mint }), ' '].concat(symNodes(x.asset), x.tip ? [', a Jito tip account'] : []))]);
        })),
        recips.length > 6 ? h('div', { class: 'ss-side__sub' }, 'and ' + (recips.length - 6) + ' more, listed in Technical details') : null
      ]);
      body.push(h('div', { class: 'ss-pair' }, [left, arrow(), right]));
    } else if (r.mode === 'failed') {
      /* the fee sits in the cost line right below, so the stamp, "nothing moved", the fee and the reason fit on a phone */
      body.push(h('div', { class: 'ss-pair tx-pair--one' }, [
        side('Moved', h('span', { class: 'ss-big__num' }, r.story.nothingMoved ? 'Nothing' : 'See below'),
          r.story.nothingMoved ? 'No tokens or SOL changed hands. Only the fee below was charged.' : 'Some balances changed: see below', { none: true })
      ]));
    } else {
      body.push(changes(r));
    }

    var foot = [costLine(r)];
    if (r.mode === 'swap' && r.costs.also.length) foot.push(alsoLine(r));
    if (r.mode === 'failed') foot.push(reasonBox(r));
    if (r.mode === 'reduced') foot.push(reducedNote(r));
    foot.push(h('div', { class: 'ss-receipt__actions' }, actions(r, false)));
    return h('section', { class: 'ss-receipt', 'data-sec': 'receipt', 'aria-labelledby': 'tx-title' }, [
      h('div', { class: 'ss-receipt__body' }, body),
      h('div', { class: 'ss-perf', 'aria-hidden': 'true' }),
      h('div', { class: 'ss-receipt__foot' }, foot)
    ]);
  }

  /* a reduced receipt that shows more than one wallet names the fee payer instead of saying "this wallet" */
  function multiWallet(r) { return r.perSigner.filter(function (x) { return x.sol.delta !== 0 || x.tokens.length; }).length > 1; }
  /* reduced receipt: each wallet that changed, with exact amounts */
  function changes(r) {
    var blocks = r.perSigner.filter(function (x) { return x.isFeePayer || x.sol.delta !== 0 || x.tokens.length; }).map(function (x) {
      var role = x.isFeePayer ? (r.signers.length > 1 ? 'Signed, paid the fee' : 'Signed and paid the fee') : 'Signed';
      var rows = [];
      if (x.sol.delta !== 0) rows.push(changeRow({ kind: 'sol', symbol: 'SOL', mint: SOL_MINT }, String(x.sol.delta), 9, String(x.sol.post), x.isFeePayer ? 'Includes the network fee' : null));
      x.tokens.forEach(function (t) {
        rows.push(changeRow({ kind: 'token', symbol: t.isWsol ? 'WSOL' : t.symbol, mint: t.mint, icon: t.icon, verified: t.verified || t.isWsol }, t.delta, t.decimals, t.post, t.isWsol ? 'Wrapped SOL' : (!t.verified ? ['Token ', addr(t.mint, 'Token mint')] : null)));
      });
      if (!rows.length) rows.push(h('li', { class: 'tx-chg__none' }, 'No balance change'));
      return h('div', { class: 'tx-chg' }, [
        h('div', { class: 'tx-chg__head' }, [h('span', { class: 'tx-chg__who' }, ['Wallet ', addr(x.pubkey, 'Signer')]), h('span', { class: 'tx-chg__role' }, role)]),
        h('ul', { class: 'tx-chg__rows' }, rows)
      ]);
    });
    /* older data: token accounts whose owner is not recorded, listed as accounts */
    if (r.ownersUnknown && r.unownedChanges.length) {
      blocks.push(h('div', { class: 'tx-chg' }, [
        h('div', { class: 'tx-chg__head' }, [h('span', { class: 'tx-chg__who' }, 'Token accounts'), h('span', { class: 'tx-chg__role' }, 'Owner not recorded')]),
        h('ul', { class: 'tx-chg__rows' }, r.unownedChanges.map(function (t) {
          var note = ['Account ', addr(t.account, 'Token account')];
          if (t.signedBy) note.push(', moved with the signature of ', addr(t.signedBy, 'Signer'));
          return changeRow({ kind: 'token', symbol: t.isWsol ? 'WSOL' : t.symbol, mint: t.mint, icon: t.icon, verified: t.verified || t.isWsol }, t.delta, t.decimals, t.post, note);
        }))
      ]));
    }
    if (r.coSigners.length) {
      blocks.push(h('p', { class: 'tx-chg__also' }, [r.ownersUnknown ? 'Also signed (no SOL change; token owners not recorded): ' : 'Also signed, no balance change: '].concat(r.coSigners.map(function (a, i) { return [i ? ', ' : '', addr(a, 'Co-signer')]; }))));
    }
    return h('div', { class: 'tx-changes' }, blocks);
  }
  function changeRow(asset, delta, decimals, post, note) {
    var neg = delta[0] === '-';
    var abs = neg ? delta.slice(1) : delta;
    return h('li', { class: 'tx-chg__row' }, [
      h('span', { class: 'tx-chg__asset' }, [tokGlyph(asset), h('span', { class: 'tx-sym' }, asset.symbol), asset.kind === 'token' && asset.verified === false ? unvPill() : null, note ? h('small', null, note) : null]),
      h('span', { class: 'tx-chg__val ' + (neg ? 'is-out' : 'is-in') }, [
        h('span', { class: 'ss-num' }, amt(delta, decimals, asset.symbol, F.units(abs, decimals), { sign: true, what: 'Balance change', mint: asset.mint, usd: asset.kind === 'sol' ? usdOf(Number(abs)) : null })),
        h('small', null, 'Balance now ' + (asset.kind === 'sol' ? solShort(Number(post)) : tokShort(post, decimals)))
      ])
    ]);
  }

  function costLine(r) {
    var c = r.costs;
    var total = c.total;
    var how = [];
    var parts = ['network fee'];
    var label = r.mode === 'swap' || r.mode === 'transfer' ? 'Cost' : (c.tips ? 'Fee and tip' : 'Fee');
    var agg = r.mode === 'swap' && r.story.aggregator ? r.story.aggregator.name : null;
    function sol(l) { return F.units(String(l), 9) + ' SOL'; }
    if (r.mode === 'failed') how.push('The network fee is charged even when a transaction fails.');
    else {
      how.push('Network fee ' + sol(r.fee.total));
      if (c.tips) { how.push(', plus a ' + sol(c.tips) + ' tip to a Jito validator'); parts.push('Jito tip'); }
      if (c.appFees) { how.push(', plus a ' + sol(c.appFees) + ' app fee' + (agg ? ' taken through ' + agg : '')); parts.push('app fee'); }
      /* sends to other wallets are never costs: a swap lists them under "Also sent", a transfer as what was sent */
      if (c.depositsForOthers) { how.push(', plus a ' + sol(c.depositsForOthers) + (r.mode === 'transfer' ? ' deposit to open the recipient’s account' : ' deposit to open another wallet’s token account')); parts.push('deposit'); }
      c.tokenFees.forEach(function (x) { how.push(', plus a ', amt(x.amount, x.decimals, x.symbol, F.units(x.amount, x.decimals), { what: 'App fee, in ' + x.symbol, mint: x.mint }), ' '); how = how.concat(tokText(x.symbol, x.verified)); how.push(' app fee' + (agg ? ' taken through ' + agg : '')); });
      if (r.mode === 'reduced' && r.signers.length > 1) how.push(', paid by ' + F.short(r.feePayer));
      how.push('. ');
      how.push(h('a', { href: '#ledger', 'data-act': 'goto', 'data-to': 'ledger' }, 'Where the money went'));
    }
    var what = parts.length === 1 ? 'Network fee' : parts.slice(0, -1).join(', ').replace(/^n/, 'N') + ' and ' + parts[parts.length - 1];
    var value = [price ? usdText(usdOf(total)) + ' ' : '', h('span', { class: 'mono' }, [lamAmt(total, { shown: F.units(String(total), 9), what: what }), ' SOL'])];
    c.tokenFees.forEach(function (x) {
      value.push(h('span', { class: 'mono tx-cost__tok' }, [' + ', amt(x.amount, x.decimals, x.symbol, tokShort(x.amount, x.decimals), { what: 'App fee, in ' + x.symbol, mint: x.mint }), ' ' + x.symbol]));
      if (!x.verified) value.push(' ', unvPill());
    });
    return h('div', { class: 'ss-cost' }, [
      h('span', { class: 'ss-cost__k' }, label),
      h('span', { class: 'ss-cost__v' }, value),
      h('span', { class: 'ss-cost__how' }, how)
    ]);
  }

  /* swap: transfers to other wallets in the same transaction, outside the trade. Not a cost: what they paid for is
     not known. A small one next to a trade is most often a trading app's fee, and the note says so only then. */
  function alsoLine(r) {
    var list = r.costs.also;
    var s = r.story;
    var solSide = s.gave.kind === 'sol' ? Number(s.gave.raw) : (s.got.kind === 'sol' ? Number(s.got.raw) : null);
    var allSmall = list.every(function (x) {
      if (x.kind === 'sol') return solSide != null && Number(x.amount) * 50 <= solSide;
      var side = x.mint === s.gave.mint ? s.gave : (x.mint === s.got.mint ? s.got : null);
      return !!side && BigInt(x.amount) * 50n <= BigInt(side.raw);
    });
    var value = h('ul', { class: 'tx-also' }, list.map(function (x) {
      var shown = x.kind === 'sol' ? solShort(Number(x.amount)) : tokShort(x.amount, x.decimals);
      return h('li', null, [h('span', { class: 'mono' }, amt(x.amount, x.decimals, x.symbol, shown, { what: 'Also sent, outside the trade', mint: x.mint, usd: x.kind === 'sol' ? usdOf(Number(x.amount)) : null })), ' ']
        .concat(tokText(x.symbol, x.verified), [' to ', addr(x.to, 'Receiving wallet')]));
    }));
    var one = list.length === 1;
    var how = [list.some(function (x) { return x.forwarded; }) ? (one ? 'Sent on to another wallet' : 'Sent on to other wallets') + ' in the same transaction, after the trade. '
      : (one ? 'A separate transfer' : 'Separate transfers') + ' in the same transaction, outside the swap. ',
      'Not part of the trade above, and not counted in the cost' + (allSmall ? ': a small transfer like this is often a trading app’s fee.' : '.')];
    return h('div', { class: 'ss-cost tx-also-line' }, [
      h('span', { class: 'ss-cost__k' }, 'Also sent'),
      h('span', { class: 'ss-cost__v' }, value),
      h('span', { class: 'ss-cost__how' }, how)
    ]);
  }

  function reasonBox(r) {
    var e = r.error || {};
    var parts = [h('b', null, 'Why: ')];
    if (e.plain) parts.push(e.plain + ' ');
    else parts.push('a program stopped it' + (e.index != null ? ' at step ' + (e.index + 1) : '') + '. ');
    var where = [];
    if (e.index != null) where.push('at step ' + (e.index + 1) + (e.programName ? ' in ' + e.programName : ''));
    var code = e.name || (e.code != null ? 'code ' + e.code : null);
    if (e.message && e.source === 'log') parts.push(h('span', { class: 'tx-errmsg' }, ['The program logged: “', e.message, '”' + (code ? ' (' + code + (where.length ? ', ' + where[0] : '') + ').' : '.')]));
    else if (e.message) parts.push(h('span', { class: 'tx-errmsg' }, [(e.programName || 'The program') + ' error ' + e.code + ' means “' + e.message + '”' + (where.length ? ', ' + where[0] : '') + '.']));
    else if (code) parts.push(h('span', { class: 'tx-errmsg' }, 'Error ' + code + (where.length ? ', ' + where[0] : '') + '.'));
    return h('p', { class: 'ss-reason' }, [icon('alert', 16), h('span', null, parts)]);
  }
  function reducedNote(r) {
    return h('div', { class: 'tx-why' }, [
      h('div', { class: 'tx-why__t' }, [icon('info', 16), 'Why a simplified receipt']),
      h('p', null, 'The amounts here are exact, read from the chain. This page only tells the story of a transaction when it can account for every lamport; here it won’t guess, because:'),
      h('ul', null, r.reasons.map(function (x) { return h('li', null, x.text); }))
    ]);
  }

  function solscanUrl(sig) { return 'https://solscan.io/tx/' + sig; }
  function actions(r, dock) {
    return [
      h('button', { type: 'button', class: 'ss-btn', 'data-act': 'copylink' }, [icon('link', 16), 'Copy link']),
      h('a', { class: 'ss-btn' + (dock ? ' ss-btn--ink' : ''), href: solscanUrl(r.signature), target: '_blank', rel: 'noopener noreferrer' }, [icon('ext', 16), dock ? 'Solscan' : 'View on Solscan'])
    ];
  }

  /* ---------- where the money went ---------- */
  function ledger(r) {
    var rows = [];
    var feeRowsId = 'tx-fee-rows';
    function num(lamports, sign) {
      return h('span', { class: 'ss-num' }, lamAmt(lamports, { sign: sign !== false, full: true }));
    }
    function row(what, note, lamports, cls) {
      return h('tr', cls ? { class: cls } : null, [
        h('th', { scope: 'row' }, [h('span', { class: 'ss-ledger__what' }, what), note ? h('span', { class: 'ss-ledger__note' }, note) : null]),
        h('td', null, num(lamports))
      ]);
    }
    function subRows(name, list, open) {
      return list.map(function (p) {
        return h('tr', { class: 'is-sub', 'data-rows': name, hidden: !open }, [h('th', { scope: 'row' }, p[0]), h('td', null, h('span', { class: 'ss-num' }, lamAmt(p[1], { full: true })))]);
      });
    }
    function disclosed(name, what, note, lamports, parts) {
      var btn = h('button', { type: 'button', class: 'ss-disclose', 'data-act': 'rows', 'data-rows': name, 'aria-expanded': 'false', 'aria-controls': feeRowsId },
        [h('span', { class: 'ss-ledger__what' }, what), icon('chev', 16)]);
      return [h('tr', null, [h('th', { scope: 'row' }, [btn, h('span', { class: 'ss-ledger__note' }, note)]), h('td', null, num(lamports))])].concat(subRows(name, parts, false));
    }
    var swapVenue = r.mode === 'swap' && r.story.venue ? r.story.venue.name : null;
    var swapAgg = r.mode === 'swap' && r.story.aggregator ? r.story.aggregator.name : null;
    r.ledger.lines.forEach(function (l, i) {
      var parts;
      switch (l.kind) {
        case 'swapIn':
          parts = l.parts.map(function (p) { return [['To ', addr(p.addr, 'Receiving account')], p.lamports]; });
          var inWhat = l.legs ? 'Paid into the swap calls' : 'Paid into the swap';
          if (parts.length > 1) rows = rows.concat(disclosed('in' + i, inWhat, 'SOL that went to ' + plural(parts.length, 'account', 'accounts') + (swapVenue ? ' in the ' + swapVenue + ' trade' : ''), l.lamports, parts));
          else rows.push(row(inWhat, parts.length ? ['To ', addr(l.parts[0].addr, 'Receiving account')] : null, l.lamports));
          break;
        case 'swapOut':
          parts = l.parts.map(function (p) { return [['From ', addr(p.addr, 'Paying account')], p.lamports]; });
          var outWhat = l.legs ? 'Received from the swap calls' : 'Received from the swap';
          if (parts.length > 1) rows = rows.concat(disclosed('out' + i, outWhat, 'SOL paid by ' + plural(parts.length, 'account', 'accounts'), l.lamports, parts.map(function (p) { return [p[0], p[1]]; })));
          else rows.push(row(outWhat, parts.length ? ['From ', addr(l.parts[0].addr, 'Paying account')] : null, l.lamports));
          break;
        case 'direct':
          rows.push(row('Paid out directly' + (l.payer ? ' by ' + l.payer.name : ''), 'The program credited this wallet itself, so no transfer instruction records it. Read from the balance change.', l.lamports));
          break;
        case 'wrapped':
          rows.push(row(l.lamports > 0 ? 'Covered by its wrapped SOL' : 'Kept as wrapped SOL', l.lamports > 0 ? 'The swap was paid from its WSOL account, so its plain SOL balance didn’t pay for it' : 'Moved into its WSOL account, still its own', l.lamports));
          break;
        case 'sent':
          rows.push(row(['Sent to ', addr(l.to, l.tip ? 'Jito tip account' : 'Recipient')], l.tip ? 'A plain SOL transfer to a Jito tip account: a tip to land the transaction faster' : 'Plain SOL transfer', l.lamports));
          break;
        case 'payment':
          rows.push(row([l.tip ? 'Tip to ' : (r.mode === 'swap' ? 'Also sent to ' : 'Sent to '), addr(l.to, l.tip ? 'Jito tip account' : 'Recipient')], l.tip ? 'Tip to a Jito validator, to land the transaction faster' + (l.inCost ? '. Counted in the ' + (r.mode === 'reduced' ? 'fee' : 'cost') + ' above' : '')
            : (r.mode === 'swap' ? (l.forwarded ? 'Sent on to another wallet by ' + (swapAgg || 'the aggregator') + ' after the trade. Not part of the trade, not counted in the cost' : 'A separate SOL transfer to another wallet, outside the swap. Not part of the trade, not counted in the cost') : 'A plain SOL transfer'), l.lamports));
          break;
        case 'appFee':
          rows.push(row(['App fee, to ', addr(l.to, 'App fee receiver')], (swapAgg ? swapAgg + ' sent this' : 'Sent') + ' from ' + (l.wrapped ? 'its wrapped SOL' : 'this wallet') + ' after the trade, to an account outside the pools. Apps built on ' + (swapAgg || 'an aggregator') + ' collect their fee this way.', l.lamports));
          break;
        case 'received':
          rows.push(row(['Received from ', addr(l.from, 'Sender')], 'A plain SOL transfer in', l.lamports));
          break;
        case 'deposit':
          var d = l.deposit;
          var what, note;
          if (d.tokenAccount && d.own) { what = 'Deposit for its new ' + (d.mint === SOL_MINT ? 'WSOL' : d.symbol) + ' account'; note = 'Rent deposit, still its own: it comes back if the account is closed'; }
          else if (d.tokenAccount) { what = ['Deposit for the recipient’s new ' + d.symbol + ' account']; note = ['Rent deposit. It stays with that account, owned by ', addr(d.wallet, 'Account owner'), l.inCost ? '. Counted in the cost above' : '']; }
          else { what = 'Deposit for a ' + (d.ownerProgramName || 'program') + ' account'; note = ['Rent deposit held in account ', addr(d.account, 'Account opened'), ', opened for this transaction']; }
          rows.push(row(what, note, l.lamports));
          break;
        case 'refund':
          rows.push(row('Deposit back: closed ' + (l.refund.own ? 'its ' : 'a ') + (l.refund.symbol || 'token') + ' account', ['Account ', addr(l.refund.account, 'Closed account')], l.lamports));
          break;
        case 'closedBack':
          rows.push(row('Deposit back from a closed account', ['A program closed ', addr(l.account, 'Closed account'), ' and its SOL came here (the only account that lost SOL)'], l.lamports));
          break;
        case 'other':
          rows.push(row(r.mode === 'failed' ? 'Other change' : 'Everything else, not itemized', r.mode === 'failed' ? 'Not the fee' : 'The rest of the real balance change. This page won’t split it into a story it can’t prove.', l.lamports));
          break;
        case 'fee':
          var fp = [
            ['Base fee, ' + plural(r.fee.signatures + r.fee.precompileSigs, 'signature', 'signatures'), -r.fee.base],
            [priorityLabel(r), -r.fee.priority]
          ];
          rows = rows.concat(disclosed('fee', 'Network fee', 'Paid to Solana to process the transaction', l.lamports, fp));
          break;
      }
    });
    var net = r.sol.delta;
    var total = h('tr', { class: 'is-total' }, [
      h('th', { scope: 'row' }, h('span', { class: 'ss-ledger__what' }, 'Change in its SOL balance')),
      h('td', null, [h('span', { class: 'ss-num' }, lamAmt(net, { sign: true, full: true, what: 'Real change in the wallet’s SOL balance' })), h('span', { class: 'ss-unit' }, 'SOL'),
        price ? h('span', { class: 'ss-ledger__usd' }, usdApprox(usdOf(net))) : null])
    ]);
    var check = r.ledger.reconciles ? h('p', { class: 'ss-check' }, [icon('check', 14), h('span', null, ['Adds up to its real balance, ',
      h('span', { class: 'mono' }, F.units(String(r.sol.pre), 9, { trim: false })), ' → ', h('span', { class: 'mono' }, F.units(String(r.sol.post), 9, { trim: false })), ' SOL, read from the chain'])]) : null;
    var tokRows = r.tokens.map(function (t) {
      var neg = t.delta[0] === '-';
      var sym = t.isWsol ? 'WSOL' : t.symbol;
      var fees = (r.costs.tokenFees || []).filter(function (x) { return x.mint === t.mint; });
      var sent = (r.costs.also || []).filter(function (x) { return x.kind === 'token' && x.mint === t.mint; });
      var legs = (r.legs || []).filter(function (x) { return x.mint === t.mint; })[0];
      return h('div', { class: 'ss-tokrow' }, [
        h('div', { class: 'ss-tokrow__k' }, [tokGlyph({ kind: 'token', symbol: sym, icon: t.icon }), h('span', null, [sym, !t.isWsol && !t.verified ? [' ', unvPill()] : null,
          t.isWsol ? h('small', { class: 'tx-tokrow__sub' }, 'Wrapped SOL') : (!t.verified ? h('small', { class: 'tx-tokrow__sub' }, ['Token ', addr(t.mint, 'Token mint')]) : null),
          fees.map(function (x) { return h('small', { class: 'tx-tokrow__sub' }, ['Includes a ', amt(x.amount, x.decimals, sym, F.units(x.amount, x.decimals), { what: 'App fee, in ' + sym, mint: x.mint }), ' ' + sym + ' app fee to ', addr(x.to, 'App fee receiver')]); }),
          sent.map(function (x) { return h('small', { class: 'tx-tokrow__sub' }, ['Includes ', amt(x.amount, x.decimals, sym, F.units(x.amount, x.decimals), { what: 'Also sent, outside the trade', mint: x.mint }), ' ' + sym + ' sent to ', addr(x.to, 'Receiving wallet'), x.forwarded ? ' after the trade' : ' outside the swap']); }),
          legs ? h('small', { class: 'tx-tokrow__sub' }, ['Inside the swap calls: received ', amt(legs.in, t.decimals, sym, tokShort(legs.in, t.decimals), { what: 'Received inside the swap calls', mint: t.mint }),
            ', paid back ', amt(legs.out, t.decimals, sym, tokShort(legs.out, t.decimals), { what: 'Paid in inside the swap calls', mint: t.mint })]) : null])]),
        h('div', { class: 'ss-tokrow__v' }, [h('span', { class: 'ss-num' }, amt(t.delta, t.decimals, sym, null, { sign: true, what: neg ? 'Left this wallet' : 'Arrived in this wallet', mint: t.mint })), h('span', { class: 'ss-unit' }, sym),
          h('span', { class: 'ss-ledger__usd' }, 'Balance now ' + F.units(t.post, t.decimals))])
      ]);
    });
    var notes = [];
    r.tokens.forEach(function (t) {
      if (t.rentHeld > 0 && !t.isWsol) {
        notes.push(h('aside', { class: 'ss-note', 'aria-label': 'Good to know' }, [icon('info', 18), h('div', null, [
          h('div', { class: 'ss-note__title' }, 'Good to know'),
          h('p', null, ['Its ' + t.symbol + ' token account is now empty but still open. It holds ', h('b', null, [lamAmt(t.rentHeld, { what: 'Rent deposit still held' }), ' SOL' + (price ? ' (' + usdApprox(usdOf(t.rentHeld)) + ')' : '')]),
            ' as a rent deposit. Closing the empty account in a wallet returns it.']),
          h('p', { class: 'ss-note__foot' }, t.accounts.map(function (a) { return addr(a, t.symbol + ' token account'); }))
        ])]));
      }
    });
    (r.handovers || []).forEach(function (x) {
      var sym = x.symbol || 'token';
      notes.push(h('aside', { class: 'ss-note', 'aria-label': 'Good to know' }, [icon('info', 18), h('div', null, [
        h('div', { class: 'ss-note__title' }, 'Good to know'),
        h('p', null, ['It handed its '].concat(tokText(sym, x.verified), [' token account to ', addr(x.to, 'New owner'), ' in this transaction, so that account now belongs to them',
          x.lamports ? [', with the ', h('b', null, [lamAmt(x.lamports, { what: 'Rent deposit inside the account' }), ' SOL']), ' rent deposit inside it. That deposit no longer comes back to this wallet.'] : '.'])),
        h('p', { class: 'ss-note__foot' }, addr(x.account, sym + ' token account'))
      ])]));
    });
    Object.keys(r.withheld || {}).forEach(function (mint) {
      var meta = M.tokenMeta(mint, null);
      var t = r.allTokenChanges.filter(function (c) { return c.mint === mint; })[0];
      var sym = t ? t.symbol : meta.symbol;
      var ver = t ? t.verified : meta.verified;
      notes.push(h('aside', { class: 'ss-note', 'aria-label': 'Token transfer fee' }, [icon('info', 18), h('div', null, [
        h('div', { class: 'ss-note__title' }, tokText(sym, ver).concat([' charges its own transfer fee'])),
        h('p', null, ['The token held back ', h('b', null, [amt(r.withheld[mint], t ? t.decimals : 0, sym, null, { what: 'Withheld by the token’s transfer fee', mint: mint }), ' ' + sym]),
          ' on its way in this transaction. That is why the amounts sent and received differ.'])
      ])]));
    });
    var foot = [];
    if (r.temp.count) foot.push(plural(r.temp.count, 'temporary account was', 'temporary accounts were') + ' opened and closed again inside this transaction; ' + (r.temp.count === 1 ? 'its deposit is' : 'their deposits are') + ' not counted above.');
    if (r.temp.wrappedTemp) foot.push('A temporary wrapped SOL account held the SOL during the trade; it was closed in the same transaction and its deposit came back.');
    var lede = r.mode === 'failed'
      ? (r.story.nothingMoved ? 'Only the network fee left this wallet. Nothing else moved' + (r.nonceAdvanced ? ' (the durable nonce advanced, which moves no money).' : '.') : 'The network fee, and every balance change read from the chain.')
      : 'The SOL of wallet ' + F.short(r.feePayer) + '. Read down: the signed lines add up to its real balance change, to the lamport.';
    return h('section', { class: 'ss-sec', 'data-sec': 'ledger', id: 'ledger', 'aria-labelledby': 'tx-ledger-t' }, [
      h('div', { class: 'ss-sec__head' }, h('div', null, [h('h2', { class: 'ss-sec__title', id: 'tx-ledger-t' }, 'Where the money went'), h('p', { class: 'ss-sec__lede' }, lede)])),
      h('table', { class: 'ss-ledger' }, [h('caption', { class: 'vh' }, 'Where the money went, in SOL'), h('tbody', { id: feeRowsId }, rows), h('tfoot', null, total)]),
      check,
      tokRows.length ? h('div', { class: 'tx-tokrows' }, tokRows) : null,
      notes,
      foot.length ? h('p', { class: 'ss-foot-note' }, foot.join(' ')) : null
    ]);
  }
  function priorityLabel(r) {
    var f = r.fee;
    if (!f.priority) return 'Priority fee: none';
    if (f.source === 'transactionConfig' && f.derivedMatches) return 'Priority fee, set in the transaction';
    if (f.source === 'ComputeBudget' && f.derivedMatches && f.cuPrice != null && f.cuLimit != null) return 'Priority fee, ' + F.group(String(f.cuPrice)) + ' µ-lamports × ' + F.group(String(f.cuLimit)) + ' units';
    return 'Priority fee, to get in faster';
  }

  /* ---------- how it happened ---------- */
  function how(r) {
    var kids = [];
    var lede;
    if (r.mode === 'swap') {
      var s = r.story;
      var agg = s.aggregator ? s.aggregator.name : null;
      var named = s.hops.map(function (x) { return x.name || 'an unrecognized pool'; });
      if (s.route === 'single') lede = agg ? 'One pool: ' + agg + ' sent the whole trade through ' + named[0] + '.' : 'Traded directly on ' + named[0] + ', one pool.';
      else if (s.route === 'split') lede = (agg || 'The trade') + ' split the trade across ' + s.hops.length + ' pools: ' + unique(named).join(' and ') + '.';
      else if (s.route === 'multihop') {
        var chainSyms = [[s.hops[0].inSymbol, s.hops[0].inVerified]].concat(s.hops.map(function (x) { return [x.outSymbol, x.outVerified]; }));
        lede = [(agg || 'The trade') + ' went through ' + s.hops.length + ' pools in a row: '];
        chainSyms.forEach(function (c, i) { if (i) lede.push(' → '); lede = lede.concat(tokText(c[0], c[1] !== false)); });
        lede.push('.');
      }
      else lede = (agg ? agg + ' routed the trade through ' : 'The trade used ') + (named.length ? unique(named).join(', ') : 'the programs below') + '.';
      kids.push(route(r));
    } else if (r.mode === 'transfer') {
      lede = 'A plain transfer: no swap, only standard Solana programs.';
    } else if (r.mode === 'failed') {
      var e = r.error || {};
      var nonceStep = r.steps.filter(function (st) { return st.status === 'kept'; })[0];
      lede = (e.index != null ? 'Step ' + (e.index + 1) + ' failed' : 'It failed') + (nonceStep
        ? '. Solana kept only two things: the fee, and the durable nonce advance in step ' + nonceStep.n + '. Everything else was undone.'
        : ', so Solana undid everything the transaction did. Only the fee was charged.');
    } else {
      lede = 'The steps and programs, without a story this page can’t prove.';
    }
    /* compute: each program's own log line, plus what built-in programs used (they log nothing), so the column adds up */
    var cm = r.compute;
    var cuText = cm ? ' · ' + F.group(String(cm.used)) + ' compute units' : '';
    var cuNote = null;
    if (cm && cm.rest > 0) {
      cuNote = cm.restBuiltin
        ? F.group(String(cm.logged)) + ' units logged by the programs + ' + F.group(String(cm.rest)) + ' used by ' + plural(cm.restSteps, 'built-in step', 'built-in steps') + ', which log nothing = ' + F.group(String(cm.used)) + ' in all.'
        : F.group(String(cm.logged)) + ' units logged by the programs; the other ' + F.group(String(cm.rest)) + ' are not itemized in the logs.';
    }
    kids.push(h('div', { class: 'ss-subhead' }, [h('h3', { class: 'ss-subhead__t' }, 'Every step'), h('span', { class: 'ss-count' }, plural(r.steps.length, 'step', 'steps') + cuText)]));
    var maxCu = (cm && cm.used) || 1;
    var STATUS = { failed: ['Failed', ' tx-st--fail'], undone: ['Undone', ''], skipped: ['Never ran', ''], applied: ['Applied', ' tx-st--kept'], kept: ['Kept: nonce advanced', ' tx-st--kept'] };
    kids.push(h('ol', { class: 'ss-steps tx-steps' }, r.steps.map(function (st) {
      var stx = STATUS[st.status];
      var status = stx ? h('span', { class: 'tx-st' + stx[1] }, stx[0]) : null;
      var progName = st.name || ('Unrecognized program ' + F.short(st.programId));
      var bar = st.cu != null ? h('span', { class: 'ss-steps__bar', 'aria-hidden': 'true' }, (function () { var i = h('i'); i.style.width = Math.max(1.5, Math.min(100, st.cu / maxCu * 100)).toFixed(1) + '%'; return i; })()) : null;
      var cuCell = st.cu != null ? F.group(String(st.cu)) : (st.builtin && cm && cm.restBuiltin ? h('span', { class: 'tx-cu-builtin', title: 'Built-in programs do not log their compute use; it is counted in the note below' }, 'built-in') : '');
      return h('li', { class: st.status === 'failed' ? 'is-failed' : null }, [
        h('span', { class: 'ss-steps__n' }, String(st.n)),
        h('span', null, [h('span', { class: 'tx-step__t' }, stepNodes(st.parts, r)), status, h('span', { class: 'ss-steps__prog' }, st.sub ? progName + ' · ' + st.sub : progName)]),
        h('span', { class: 'ss-steps__cu' }, cuCell),
        bar
      ]);
    })));
    if (cuNote) kids.push(h('p', { class: 'tx-cu-note' }, cuNote));
    kids.push(h('div', { class: 'ss-subhead' }, [h('h3', { class: 'ss-subhead__t' }, 'Programs involved'), h('span', { class: 'ss-count' }, String(r.programs.length))]));
    kids.push(h('ul', { class: 'tx-progs' }, r.programs.map(function (p) {
      return h('li', { class: p.known ? null : 'is-unknown' }, [
        h('span', { class: 'tx-progs__id' }, [h('span', { class: 'tx-progs__name' }, p.known ? p.name : 'Unrecognized program'), ' ', addr(p.id, p.known ? p.name : 'Unrecognized program')]),
        h('span', { class: 'tx-progs__how' }, p.top ? (p.inner ? 'called directly and by others' : 'called directly') : 'called by another program')
      ]);
    })));
    if (r.memos.length) {
      kids.push(h('div', { class: 'ss-subhead' }, [h('h3', { class: 'ss-subhead__t' }, 'Memo'), h('span', { class: 'ss-count' }, String(r.memos.length))]));
      r.memos.forEach(function (m) { kids.push(h('p', { class: 'tx-memo' }, [h('span', { class: 'tx-memo__k' }, 'Written by the sender, shown as plain text: '), h('span', { class: 'mono' }, m)])); });
    }
    return h('section', { class: 'ss-sec', 'data-sec': 'route', 'aria-labelledby': 'tx-how-t' }, [
      h('div', { class: 'ss-sec__head' }, h('div', null, [h('h2', { class: 'ss-sec__title', id: 'tx-how-t' }, 'How it happened'), h('p', { class: 'ss-sec__lede' }, lede)])),
      kids
    ]);
  }
  function unique(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
  /* a step title from the model's parts: addresses stay whole (as buttons), unverified tokens carry the mark */
  function stepNodes(parts, r) {
    var named = r.mode === 'reduced' && (multiWallet(r) || r.ownersUnknown);
    return (parts || []).map(function (x) {
      if (typeof x === 'string') return x;
      if (x.addr) {
        if (x.self && !named) return 'this wallet';
        if (x.self) return ['the fee payer ', addr(x.addr, 'Fee payer')];
        return [x.tokenAccount ? 'token account ' : '', addr(x.addr, x.tokenAccount ? 'Token account' : 'Address')];
      }
      return tokText(String(x.tok), x.verified);
    });
  }
  function route(r) {
    var s = r.story;
    var feeSol = r.costs.appFees, feeToks = r.costs.tokenFees || [];
    var feeTo = null;
    r.ledger.lines.forEach(function (l) { if (l.kind === 'appFee' && !feeTo) feeTo = l.to; });
    feeToks.forEach(function (x) { if (!feeTo) feeTo = x.to; });
    function amtOf(a, what) { return amt(a.raw, a.decimals, assetSym(a), amountNum(a.raw, a), { what: what, mint: a.mint }); }
    var stops = [];
    /* the receipt above already marks unverified tokens; the route stays a plain map of the trade */
    function sym(t) { return h('span', { class: 'tx-sym' }, t); }
    stops.push({ cls: 'is-you', icon: icon('wallet', 20), name: 'This wallet', what: ['Gave ', amtOf(s.gave, 'Given in the swap'), ' ', sym(assetSym(s.gave))] });
    if (s.aggregator) {
      var aggWhat = ['Picked the route' + (s.hops.length > 1 ? ' and ran ' + s.hops.length + ' trades' : '')];
      var feeBits = [];
      if (feeSol) feeBits.push([lamAmt(feeSol, { shown: solShort(feeSol), what: 'App fee' }), ' SOL']);
      feeToks.forEach(function (x) { feeBits.push([amt(x.amount, x.decimals, x.symbol, tokShort(x.amount, x.decimals), { what: 'App fee, in ' + x.symbol, mint: x.mint }), ' ' + x.symbol]); });
      stops.push({ icon: initial(s.aggregator.name), name: s.aggregator.name, what: aggWhat,
        amt: feeBits.length ? ['Sent a '].concat(feeBits.reduce(function (o, b, i) { return o.concat(i ? [' and '] : [], b); }, []), [' app fee to ', addr(feeTo, 'App fee receiver')]) : null });
    }
    s.hops.forEach(function (x) {
      /* "A → B": a line may break only before the arrow, never leave it hanging at the end */
      var hopWhat = x.in && x.out ? [sym(x.inSymbol), ' ', h('span', { class: 'tx-hop' }, ['→\u00a0', sym(x.outSymbol)])] : ['Pool ', addr(x.id, 'Unrecognized program')];
      stops.push({ icon: x.known ? initial(x.name) : icon('pool', 20), name: x.name || 'Unrecognized pool', what: hopWhat, cls: 'is-pool', hop: x });
    });
    stops.push({ cls: 'is-you', icon: icon('wallet', 20), name: 'This wallet', what: ['Got ', amtOf(s.got, 'Received from the swap'), ' ', sym(assetSym(s.got))] });
    /* a line of stops reads left to right on wide screens when the trade is one pool or pools in a row; the money
       rides on the connectors as chips (decorative: the same amounts are in the stops) */
    var row = (s.route === 'single' || s.route === 'multihop') && stops.length <= 5;
    /* the chip fits the gap between two stops: the amount stays whole, a long symbol is cut with an ellipsis */
    function chip(text, symbol) { return h('span', { class: 'tx-flow', 'aria-hidden': 'true' }, h('span', { class: 'tx-flow__chip' }, [text ? h('b', null, text) : null, h('span', { class: 'tx-flow__sym' }, symbol)])); }
    if (row) {
      var firstPool = s.aggregator ? 2 : 1;
      stops[0].flow = chip(amountNum(s.gave.raw, s.gave), assetSym(s.gave));
      for (var i = firstPool; i < stops.length - 2; i++) if (stops[i].hop && stops[i].hop.out) stops[i].flow = chip(null, stops[i].hop.outSymbol);
      stops[stops.length - 2].flow = chip(amountNum(s.got.raw, s.got), assetSym(s.got));
    }
    var ol = h('ol', { class: 'tx-route' + (row ? ' tx-route--row' : ''), 'aria-label': 'Route of the swap' }, stops.map(function (st) {
      return h('li', { class: 'tx-stop ' + (st.cls || '') }, [h('span', { class: 'tx-stop__dot' }, st.icon), h('div', { class: 'tx-stop__body' }, [
        h('div', { class: 'tx-stop__name' }, st.name), h('div', { class: 'tx-stop__what' }, st.what), st.amt ? h('div', { class: 'tx-stop__amt' }, st.amt) : null]), st.flow || null]);
    }));
    if (row) ol.style.setProperty('--n', String(stops.length));
    return ol;
  }
  function initial(name) { return h('span', { class: 'ss-stop__ini', 'aria-hidden': 'true' }, String(name || '?').charAt(0)); }

  /* ---------- technical details ---------- */
  function tech(r, state) {
    var when = r.blockTime ? F.dateUTC(r.blockTime, true) : null;
    function row(k, v) { return h('div', null, [h('dt', null, k), h('dd', null, v)]); }
    function sub(t) { return h('span', { class: 'ss-sub' }, t); }
    var f = r.fee;
    var feeSub = 'Base ' + F.units(String(f.base), 9) + ' + priority ' + F.units(String(f.priority), 9);
    var cuSub = f.source === 'transactionConfig' ? 'Limit and priority fee set in the transaction itself (version 1)'
      : (f.cuPrice != null ? 'Priority price ' + F.group(String(f.cuPrice)) + ' micro-lamports per unit' : 'No priority price set');
    var signerList = r.signers.map(function (a, i) { return [i ? ' ' : '', addr(a, a === r.feePayer ? 'Fee payer' : 'Signer')]; });
    var list = h('dl', { class: 'ss-tech__list' }, [
      row('Signature', h('span', { class: 'ss-tech__row' }, [addr(r.signature, 'Transaction signature'), h('button', { type: 'button', class: 'ss-copy', 'data-act': 'copy', 'data-copy': r.signature, 'aria-label': 'Copy full signature' }, icon('copy', 15))])),
      row('Block', r.slot != null ? F.group(String(r.slot)) : 'Unknown'),
      row('Time', when ? [when.time, sub(when.date + ', ' + F.ago(r.blockTime))] : 'Not recorded'),
      row('Fee payer', [addr(r.feePayer, 'Fee payer'), sub(r.signers.length > 1 ? plural(r.signers.length, 'signer', 'signers') + ' in all' : 'Also the only signer')]),
      r.signers.length > 1 ? row('Signers', h('span', { class: 'tx-addrs' }, signerList)) : null,
      row('Status', r.ok ? [state.finalized ? 'Success, finalized' : 'Success, confirmed', sub(state.finalized ? 'Can’t be rolled back' : 'Not final yet: reload in a few seconds')]
        : ['Failed', r.error && r.error.label ? h('span', { class: 'ss-sub mono' }, r.error.label) : null]),
      row('Network fee', [F.units(String(f.total), 9) + ' SOL', sub(feeSub)]),
      row('Compute', [f.cuUsed != null ? F.group(String(f.cuUsed)) + (f.cuLimit ? ' of ' + F.group(String(f.cuLimit)) : '') + ' units' : 'Not reported', sub(cuSub)]),
      row('Version', [String(r.version), sub(r.lookups ? plural(r.lookups, 'lookup table', 'lookup tables') + ', ' + plural(r.loadedAccounts, 'account', 'accounts') + ' loaded from them' : 'No lookup tables')]),
      r.durableNonce ? row('Nonce', ['Durable nonce', sub('Signed ahead of time; the blockhash below is the nonce value')]) : null,
      r.blockhash ? row('Blockhash', addr(r.blockhash, 'Recent blockhash')) : null
    ]);
    var pre = h('pre', { tabindex: '0', 'data-raw': '', hidden: true });
    var links = h('div', { class: 'ss-tech__links' }, [
      h('a', { href: solscanUrl(r.signature), target: '_blank', rel: 'noopener noreferrer' }, 'Solscan'),
      h('a', { href: 'https://explorer.solana.com/tx/' + r.signature, target: '_blank', rel: 'noopener noreferrer' }, 'Solana Explorer'),
      h('a', { href: '#raw', 'data-act': 'raw' }, 'Raw JSON')
    ]);
    var balances = allChanges(r);
    /* open beside the receipt on wide screens; on phones it starts closed, after the story */
    var open = root.clientWidth >= 1120;
    return h('section', { class: 'ss-tech', 'data-sec': 'tech', 'aria-labelledby': 'tx-tech-t' }, [
      h('button', { type: 'button', class: 'ss-tech__toggle', 'data-act': 'tech', 'aria-expanded': String(open), 'aria-controls': 'tx-tech', id: 'tx-tech-t' },
        [h('span', null, ['Technical details', h('small', null, 'Signature, block, fee, compute')]), icon('chev', 18)]),
      h('div', { id: 'tx-tech', hidden: !open }, [list, balances, links, h('div', { class: 'ss-raw', id: 'raw' }, pre)])
    ]);
  }
  /* every balance change in the transaction, any account: the chain truth behind everything above */
  function allChanges(r) {
    var items = [];
    r.lamportChanges.forEach(function (c) { items.push({ who: c.pubkey, sym: 'SOL', delta: String(c.delta), decimals: 9, mint: SOL_MINT, verified: true }); });
    r.allTokenChanges.forEach(function (c) { items.push({ who: c.owner, sym: c.isWsol ? 'WSOL' : c.symbol, delta: c.delta, decimals: c.decimals, mint: c.mint, verified: c.isWsol || c.verified, tokenAccount: c.ownerKnown === false }); });
    var det = h('details', { class: 'tx-all' }, [
      h('summary', null, ['All balance changes', h('span', { class: 'ss-count' }, String(items.length))]),
      h('ul', null, items.map(function (x) {
        return h('li', null, [h('span', null, [x.tokenAccount ? 'Token account ' : '', addr(x.who, x.tokenAccount ? 'Token account (owner not recorded)' : 'Account')]),
          h('span', { class: 'tx-all__v' }, [amt(x.delta, x.decimals, x.sym, null, { sign: true, what: 'Balance change of this account', mint: x.mint }), ' ' + x.sym, x.verified === false ? [' ', unvPill()] : null])]);
      }))
    ]);
    return det;
  }

  /* ---------- popover and sheet for exact values ---------- */
  var pop = { el: null, trigger: null };
  var layer = null, sheetTrigger = null;
  function compact() { return root.clientWidth < 600; }
  function contentFor(t) {
    var o = reg[t.getAttribute('data-k')];
    if (!o) return null;
    if (o.kind === 'amt') {
      var lamportsName = o.sym === 'SOL' || o.sym === 'WSOL' ? 'lamports' : 'base units';
      var kids = [
        h('div', { class: 'ss-pop__k' }, o.what || 'Exact amount'),
        h('div', { class: 'ss-pop__v' }, [o.grouped + ' ', h('span', null, o.sym)]),
        h('p', { class: 'ss-pop__meta' }, [h('span', { class: 'mono' }, F.group(o.raw)), ' ' + lamportsName + ', ' + o.decimals + ' decimals'])
      ];
      if (o.mint && o.mint !== SOL_MINT) kids.push(h('p', { class: 'ss-pop__meta' }, ['Token ', h('span', { class: 'mono' }, F.short(o.mint)), ' (mint address)']));
      if (o.usd != null && price) kids.push(h('p', { class: 'ss-pop__meta' }, usdApprox(o.usd) + ' at today’s SOL price, $' + price.toFixed(2)));
      return { copy: o.exact, label: 'Copy exact', kids: kids, foot: 'Copies as ' + o.exact };
    }
    if (o.kind === 'addr') {
      return { copy: o.addr, label: 'Copy', kids: [h('div', { class: 'ss-pop__k' }, o.label || 'Address'), h('div', { class: 'ss-pop__v ss-pop__v--addr' }, o.addr)], foot: 'Full value, ' + o.addr.length + ' characters' };
    }
    return null;
  }
  function copyBtn(c, big) {
    return h('button', { type: 'button', class: 'ss-btn' + (big ? '' : ' ss-btn--sm'), 'data-act': 'copy', 'data-copy': c.copy }, [icon('copy', 14), c.label]);
  }
  function closePop(refocus) {
    if (!pop.el) return;
    var t = pop.trigger;
    if (pop.el.parentNode) pop.el.parentNode.removeChild(pop.el);
    if (t) { t.setAttribute('aria-expanded', 'false'); t.removeAttribute('aria-controls'); }
    pop.el = null; pop.trigger = null;
    if (refocus && t) t.focus();
  }
  function openPop(t) {
    if (pop.trigger === t) { closePop(false); return; }
    closePop(false);
    var c = contentFor(t);
    if (!c) return;
    var el = h('div', { class: 'ss-pop', id: 'tx-pop', role: 'dialog', 'aria-label': t.getAttribute('aria-label') || t.textContent }, c.kids.concat([
      h('div', { class: 'ss-pop__foot' }, [h('span', null, c.foot), copyBtn(c, false)])
    ]));
    root.appendChild(el);
    t.setAttribute('aria-expanded', 'true');
    t.setAttribute('aria-controls', 'tx-pop');
    pop.el = el; pop.trigger = t;
    var rr = root.getBoundingClientRect(), r = t.getBoundingClientRect();
    var w = el.offsetWidth, hgt = el.offsetHeight;
    var left = Math.max(rr.left + 12, Math.min(r.left + r.width / 2 - w / 2, rr.right - w - 12));
    var top = r.bottom + 8;
    if (top + hgt > window.innerHeight - 8 && r.top - hgt - 8 > 0) top = r.top - hgt - 8;
    el.style.left = (left - rr.left) + 'px';
    el.style.top = (top - rr.top) + 'px';
  }
  function ensureLayer() {
    if (layer) return layer;
    layer = h('div', { class: 'ss-layer is-fixed' }, [h('div', { class: 'ss-scrim', 'data-act': 'sheetclose' }), h('div', { class: 'ss-sheet', role: 'dialog', 'aria-modal': 'true', tabindex: '-1', inert: true, 'aria-hidden': 'true' }), h('div', { class: 'ss-toast', role: 'status', 'aria-live': 'polite' })]);
    root.appendChild(layer);
    layer.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    return layer;
  }
  function openSheet(t) {
    var c = contentFor(t);
    if (!c) return;
    ensureLayer();
    var sheet = layer.querySelector('.ss-sheet');
    clear(sheet);
    sheet.setAttribute('aria-label', t.getAttribute('aria-label') || t.textContent);
    add(sheet, [h('div', { class: 'ss-sheet__grab', 'aria-hidden': 'true' })].concat(c.kids, [
      h('div', { class: 'ss-pop__foot' }, h('span', null, c.foot)),
      h('div', { class: 'ss-sheet__actions' }, [copyBtn(c, true), h('button', { type: 'button', class: 'ss-btn', 'data-act': 'sheetclose' }, 'Done')])
    ]));
    sheetTrigger = t;
    Array.prototype.forEach.call(root.children, function (c) { if (c !== layer) c.setAttribute('inert', ''); });
    sheet.removeAttribute('inert');
    sheet.removeAttribute('aria-hidden');
    void layer.offsetWidth;
    layer.classList.add('is-open');
    var b = sheet.querySelector('button');
    if (b) b.focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!layer || !layer.classList.contains('is-open')) return;
    var sheet = layer.querySelector('.ss-sheet');
    layer.classList.remove('is-open');
    Array.prototype.forEach.call(root.children, function (c) { if (c !== layer) c.removeAttribute('inert'); });
    sheet.setAttribute('inert', '');
    sheet.setAttribute('aria-hidden', 'true');
    if (sheetTrigger) sheetTrigger.focus({ preventScroll: true });
    sheetTrigger = null;
  }
  function closeAll() { closePop(false); closeSheet(); }
  function toast(msg) {
    ensureLayer();
    var el = layer.querySelector('.ss-toast');
    clear(el);
    add(el, [icon('check', 14), msg]);
    el.classList.add('is-on');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('is-on'); }, 1600);
  }

  /* ---------- clipboard ---------- */
  function copyText(text) {
    function fallback() {
      var ta = h('textarea', { readonly: true });
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    return Promise.resolve(fallback());
  }
  function markDone(b, text) {
    if (!b || b.classList.contains('is-done')) return;
    var kids = Array.prototype.slice.call(b.childNodes);
    b.classList.add('is-done');
    clear(b);
    add(b, b.classList.contains('ss-copy') ? icon('check', 15) : [icon('check', 14), text || 'Copied']);
    setTimeout(function () { b.classList.remove('is-done'); clear(b); kids.forEach(function (k) { b.appendChild(k); }); }, 1400);
  }
  function shareLink() {
    var sig = current ? current.sig : '';
    var base = /^https?:$/.test(window.location.protocol) ? window.location.origin + window.location.pathname : 'tx.html';
    return base + '?sig=' + sig;
  }
  function store(k, v) {
    try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) { return null; }
    return null;
  }

  /* ---------- events ---------- */
  function onClick(e) {
    var t = e.target.closest('.ss-x, .ss-addr');
    if (t && root.contains(t) && !(layer && layer.contains(t))) {
      e.preventDefault();
      if (compact()) { closePop(false); openSheet(t); } else openPop(t);
      return;
    }
    var a = e.target.closest('[data-act]');
    if (!a) { if (pop.el && !pop.el.contains(e.target)) closePop(false); return; }
    var act = a.getAttribute('data-act');
    if (act === 'example') { var sg = a.getAttribute('data-sig'); if (M.isSignature(sg)) { els.input.value = sg; lookup(sg, true); } return; }
    if (act === 'retry') { if (current || els.input.value) submit(); return; }
    if (act === 'rows') {
      var open = a.getAttribute('aria-expanded') !== 'true';
      var name = a.getAttribute('data-rows');
      a.setAttribute('aria-expanded', String(open));
      Array.prototype.forEach.call(root.querySelectorAll('tr[data-rows]'), function (row) { if (row.getAttribute('data-rows') === name) row.hidden = !open; });
      return;
    }
    if (act === 'tech') {
      var o2 = a.getAttribute('aria-expanded') !== 'true';
      a.setAttribute('aria-expanded', String(o2));
      var list = document.getElementById(a.getAttribute('aria-controls'));
      if (list) list.hidden = !o2;
      return;
    }
    if (act === 'raw') {
      e.preventDefault();
      var pre = root.querySelector('[data-raw]');
      if (!pre || !current) return;
      var panel = document.getElementById('tx-tech');
      if (panel && panel.hidden) { panel.hidden = false; var tg = root.querySelector('[data-act="tech"]'); if (tg) tg.setAttribute('aria-expanded', 'true'); }
      if (!pre.textContent) pre.textContent = JSON.stringify(current.raw, null, 2);
      pre.hidden = !pre.hidden;
      if (!pre.hidden) pre.focus({ preventScroll: false });
      return;
    }
    if (act === 'goto') {
      e.preventDefault();
      var sec = root.querySelector('[data-sec="' + a.getAttribute('data-to') + '"]');
      if (sec) { var y = sec.getBoundingClientRect().top + window.scrollY - 72; window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' }); }
      return;
    }
    if (act === 'copy') { copyText(a.getAttribute('data-copy')).then(function () { markDone(a); if (compact()) toast('Copied'); }); return; }
    if (act === 'copylink') { copyText(shareLink()).then(function () { markDone(a, 'Link copied'); if (compact()) toast('Link copied'); }); return; }
    if (act === 'theme') {
      var d = document.documentElement;
      var cur = d.getAttribute('data-theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var nextTheme = cur === 'dark' ? 'light' : 'dark';
      d.setAttribute('data-theme', nextTheme);
      store('ss:theme', nextTheme);
      return;
    }
    if (act === 'sheetclose') { closeSheet(); return; }
  }
  function submit() {
    var p = M.parseInput(els.input.value);
    if (!p.ok) { inputError(p.error); els.input.focus(); return; }
    els.input.value = p.sig;
    if (current && current.sig === p.sig && cache[p.sig]) { render(cache[p.sig]); return; }
    lookup(p.sig, !(current && current.sig === p.sig));
  }

  /* ---------- start ---------- */
  shell();
  root.addEventListener('click', onClick);
  els.form.addEventListener('submit', function (e) { e.preventDefault(); submit(); });
  els.input.addEventListener('input', function () { if (!els.err.hidden) inputError(''); });
  els.input.addEventListener('paste', function () {
    /* a pasted link or signature looks up right away */
    setTimeout(function () { var p = M.parseInput(els.input.value); if (p.ok) { els.input.value = p.sig; submit(); } }, 0);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (pop.el) closePop(true); closeSheet(); }
    if (e.key === '/' && document.activeElement !== els.input && !/input|textarea/i.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); els.input.focus(); els.input.select(); }
  });
  window.addEventListener('popstate', function () { closeAll(); fromLocation(false); });
  window.addEventListener('resize', function () { closePop(false); });
  fromLocation(false);

  /* test hook: render a transaction already in hand (same derivation, no network) */
  window.TxApp = {
    renderRaw: function (tx, tokenInfo, solPrice, finalized) {
      var receiptObj = M.deriveReceipt(tx, tokenInfo || {}, solPrice);
      var sig = receiptObj.signature;
      els.input.value = sig;
      render({ sig: sig, receipt: receiptObj, raw: tx, finalized: finalized !== false, tokensOk: true });
      return receiptObj.mode;
    }
  };
})();
