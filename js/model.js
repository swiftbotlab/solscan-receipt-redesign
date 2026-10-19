/* Derives every figure on the page from the raw RPC transaction (window.TX_RPC).
   Nothing below is typed in by hand: amounts, fees, rent and counts all come from the JSON. */
(function () {
  'use strict';

  var R = window.TX_RPC;
  var LABELS = window.TX_LABELS || {};
  var TOKENS = window.TX_TOKENS || {};
  var PRICE = (window.TX_PRICE && window.TX_PRICE.SOL) || 0;

  var SOL_MINT = 'So11111111111111111111111111111111111111112';
  var SYSTEM = '11111111111111111111111111111111';
  var COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111';
  var LAMPORTS_PER_SIGNATURE = 5000;

  /* ---------- formatting helpers ---------- */

  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  function base58Decode(s) {
    var bytes = [0];
    for (var i = 0; i < s.length; i++) {
      var v = B58.indexOf(s[i]);
      if (v < 0) return [];
      var carry = v;
      for (var j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }
      while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    for (var k = 0; k < s.length && s[k] === '1'; k++) bytes.push(0);
    return bytes.reverse();
  }
  function readLE(bytes, start, len) {
    var n = 0;
    for (var i = len - 1; i >= 0; i--) n = n * 256 + (bytes[start + i] || 0);
    return n;
  }

  function group(intStr) {
    return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  /* exact decimal string from integer base units, no floating point */
  function units(raw, decimals, opts) {
    opts = opts || {};
    var neg = false;
    var s = String(raw);
    if (s[0] === '-') { neg = true; s = s.slice(1); }
    s = s.replace(/^0+(?=\d)/, '');
    while (s.length <= decimals) s = '0' + s;
    var int = s.slice(0, s.length - decimals);
    var frac = decimals ? s.slice(s.length - decimals) : '';
    if (opts.trim) frac = frac.replace(/0+$/, '');
    var out = (opts.group === false ? int : group(int)) + (frac ? '.' + frac : '');
    return (neg ? '-' : '') + out;
  }
  function signed(raw, decimals, opts) {
    var n = Number(raw);
    var body = units(Math.abs(n), decimals, opts);
    if (n > 0) return '+' + body;
    if (n < 0) return '−' + body;
    return body;
  }
  /* significant-figure rounding that never falls into exponent notation */
  function sig(value, digits) {
    if (!value) return '0';
    var v = Math.abs(value);
    var mag = Math.floor(Math.log10(v));
    var dp = Math.max(0, digits - 1 - mag);
    var s = v.toFixed(Math.min(dp, 12));
    if (s.indexOf('.') > -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  function compact(value) {
    var v = Math.abs(value);
    if (v >= 1e9) return (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (v >= 1e4) return (v / 1e3).toFixed(1).replace(/\.?0+$/, '') + 'K';
    if (v >= 1) return group(String(Math.round(v * 100) / 100));
    return sig(v, 3);
  }
  function usd(lamports) { return Math.abs(lamports) / 1e9 * PRICE; }
  function fmtUsd(dollars, opts) {
    opts = opts || {};
    if (dollars === 0) return '$0';
    if (dollars < 0.001) return opts.exact ? '$' + sig(dollars, 3) : 'under $0.001';
    if (opts.exact) return '$' + sig(dollars, 3);
    if (dollars < 1) return '$' + dollars.toFixed(2);
    return '$' + group(dollars.toFixed(2));
  }
  function short(addr) {
    if (!addr || addr.length < 14) return addr || '';
    return addr.slice(0, 6) + '…' + addr.slice(-6);
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateUTC(sec, withSeconds) {
    var d = new Date(sec * 1000);
    var t = pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + (withSeconds ? ':' + pad2(d.getUTCSeconds()) : '');
    return {
      date: MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(),
      time: t + ' UTC'
    };
  }
  function ago(sec, now) {
    var diff = Math.max(0, Math.round(((now || Date.now()) - sec * 1000) / 1000));
    if (diff < 45) return 'just now';
    var m = Math.round(diff / 60);
    if (m < 60) return m + (m === 1 ? ' minute ago' : ' minutes ago');
    var h = Math.round(diff / 3600);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(diff / 86400);
    if (d < 30) return d + (d === 1 ? ' day ago' : ' days ago');
    var mo = Math.round(d / 30.4);
    if (mo < 12) return mo + (mo === 1 ? ' month ago' : ' months ago');
    var y = Math.round(d / 365);
    return y + (y === 1 ? ' year ago' : ' years ago');
  }

  /* ---------- derivations ---------- */

  var meta = R.meta;
  var msg = R.transaction.message;
  var keys = msg.accountKeys.map(function (k) { return k.pubkey; });
  var signerIdx = msg.accountKeys.findIndex(function (k) { return k.signer; });
  var signer = keys[signerIdx];
  var signatures = R.transaction.signatures;

  function idx(addr) { return keys.indexOf(addr); }
  function pre(addr) { var i = idx(addr); return i < 0 ? null : meta.preBalances[i]; }
  function post(addr) { var i = idx(addr); return i < 0 ? null : meta.postBalances[i]; }

  /* flatten instructions in execution order */
  var flat = [];
  msg.instructions.forEach(function (ix, i) {
    flat.push({ ix: ix, top: i, depth: 1 });
    (meta.innerInstructions || []).forEach(function (inner) {
      if (inner.index === i) inner.instructions.forEach(function (j) { flat.push({ ix: j, top: i, depth: j.stackHeight || 2 }); });
    });
  });

  /* token account -> owner and mint, from balances and account-init instructions */
  var tokenAcct = {};
  (meta.preTokenBalances || []).concat(meta.postTokenBalances || []).forEach(function (b) {
    tokenAcct[keys[b.accountIndex]] = { owner: b.owner, mint: b.mint, decimals: b.uiTokenAmount.decimals, program: b.programId };
  });
  flat.forEach(function (f) {
    var p = f.ix.parsed;
    if (!p || !p.info) return;
    if (p.type === 'initializeAccount3' || p.type === 'initializeAccount') {
      tokenAcct[p.info.account] = tokenAcct[p.info.account] || { owner: p.info.owner, mint: p.info.mint, decimals: p.info.mint === SOL_MINT ? 9 : null };
    }
  });
  function ownerOf(addr) { return tokenAcct[addr] ? tokenAcct[addr].owner : addr; }

  /* fees */
  var fee = meta.fee;
  var baseFee = LAMPORTS_PER_SIGNATURE * signatures.length;
  var priorityFee = fee - baseFee;
  var cuLimit = null, cuPrice = null;
  msg.instructions.forEach(function (ix) {
    if (ix.programId !== COMPUTE_BUDGET || !ix.data) return;
    var b = base58Decode(ix.data);
    if (b[0] === 2) cuLimit = readLE(b, 1, 4);
    if (b[0] === 3) cuPrice = readLE(b, 1, 8);
  });

  /* signer's SOL change, and token changes for accounts the signer owns */
  var signerDelta = meta.postBalances[signerIdx] - meta.preBalances[signerIdx];
  var tokenChanges = {};
  function addTok(list, field) {
    (list || []).forEach(function (b) {
      if (b.owner !== signer) return;
      var t = tokenChanges[b.mint] = tokenChanges[b.mint] || { mint: b.mint, decimals: b.uiTokenAmount.decimals, pre: '0', post: '0', account: keys[b.accountIndex], accountIndex: b.accountIndex, program: b.programId };
      t[field] = b.uiTokenAmount.amount;
    });
  }
  addTok(meta.preTokenBalances, 'pre');
  addTok(meta.postTokenBalances, 'post');
  var sold = null;
  Object.keys(tokenChanges).forEach(function (m) {
    var t = tokenChanges[m];
    t.delta = Number(t.post) - Number(t.pre);
    if (t.delta < 0 && m !== SOL_MINT) sold = t;
  });

  /* movements in execution order (the transfer-type instructions Solscan counts) */
  var movements = [];
  var tempRentOpened = 0;
  var tempAccounts = [];
  var wsolTemp = null;
  var swapOut = 0, aggFee = 0, aggFeeTo = null, poolOwner = null;

  var created = {};   /* temp accounts opened by the signer in this tx: addr -> { lamports, owner, refunded } */
  flat.forEach(function (f) {
    var p = f.ix.parsed;
    if (!p || !p.info) {
      /* A program closing its own temporary account returns the deposit with a direct lamport move,
         not a transfer instruction. Detect it: an unparsed instruction of the account's owner program
         that lists the account after it was created, where the account ends the tx at 0 lamports. */
      (f.ix.accounts || []).forEach(function (a) {
        var c = created[a];
        if (!c || c.refunded || c.owner !== f.ix.programId) return;
        c.refunded = true;
        var name = LABELS[c.owner] || short(c.owner);
        movements.push({
          kind: 'refund', from: a, to: signer, raw: c.lamports, decimals: 9, symbol: 'SOL', derived: true,
          label: name + ' closed its tracking account',
          sub: 'Your deposit came back. This is not a transfer instruction, so today’s page never lists it.'
        });
      });
      return;
    }
    var info = p.info;
    if (f.ix.programId === SYSTEM && p.type === 'createAccount' && info.source === signer) {
      var closedSameTx = pre(info.newAccount) === 0 && post(info.newAccount) === 0;
      if (closedSameTx) {
        tempRentOpened += info.lamports; tempAccounts.push(info.newAccount);
        if (info.owner !== 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' && info.owner !== 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
          created[info.newAccount] = { lamports: info.lamports, owner: info.owner, refunded: false };
        }
      }
      var isWsol = tokenAcct[info.newAccount] && tokenAcct[info.newAccount].mint === SOL_MINT;
      if (isWsol) wsolTemp = info.newAccount;
      var ownerName = LABELS[info.owner] || null;
      movements.push({
        kind: 'deposit', from: signer, to: info.newAccount, raw: info.lamports, decimals: 9, symbol: 'SOL',
        temp: closedSameTx,
        label: isWsol ? 'Rent deposit to open a temporary SOL account' : 'Rent deposit for a ' + (ownerName && !/^Token|^System/.test(ownerName) ? ownerName + ' ' : '') + 'tracking account',
        sub: isWsol ? 'Holds the SOL you receive while it is still wrapped' : (closedSameTx ? 'Opened and closed again in this transaction' : 'Opened in this transaction')
      });
    }
    if (p.type === 'transferChecked' || p.type === 'transfer') {
      if (!info.source || !info.destination || !(info.tokenAmount || info.amount)) return;
      var src = tokenAcct[info.source] || {};
      var mint = info.mint || src.mint || (tokenAcct[info.destination] || {}).mint;
      var decimals = info.tokenAmount ? info.tokenAmount.decimals : (mint === SOL_MINT ? 9 : src.decimals);
      var raw = info.tokenAmount ? info.tokenAmount.amount : info.amount;
      var fromOwner = ownerOf(info.source), toOwner = ownerOf(info.destination);
      var tok = TOKENS[mint] || { symbol: short(mint) };
      var sym = mint === SOL_MINT ? 'WSOL' : tok.symbol;
      var mv = { kind: 'token', from: fromOwner, to: toOwner, fromAcct: info.source, toAcct: info.destination, raw: Number(raw), decimals: decimals, symbol: sym, mint: mint };
      if (fromOwner === signer && mint !== SOL_MINT) {
        poolOwner = toOwner;
        mv.label = 'You sent ' + sym + ' to the pool';
        mv.sub = 'From your ' + sym + ' account to the pool’s vault';
      } else if (toOwner === signer && mint === SOL_MINT) {
        swapOut += Number(raw);
        mv.label = 'The pool paid you in WSOL';
        mv.sub = 'Into your temporary SOL account';
      } else if (fromOwner === signer && mint === SOL_MINT) {
        aggFee += Number(raw); aggFeeTo = toOwner;
        mv.label = 'Jupiter fee';
        mv.sub = 'Taken from the swap output';
      } else {
        mv.label = 'Transfer';
        mv.sub = '';
      }
      movements.push(mv);
    }
    if (p.type === 'closeAccount' && info.destination === signer) {
      movements.push({ kind: 'close', from: info.account, to: signer, raw: null, decimals: 9, symbol: 'SOL', label: 'Temporary account closed', sub: 'WSOL unwrapped to SOL and its rent deposit returned' });
    }
  });
  /* value released when the temporary WSOL account closed = its rent + WSOL left in it */
  var wsolRent = 0;
  movements.forEach(function (m) { if (m.kind === 'deposit' && m.to === wsolTemp) wsolRent = m.raw; });
  movements.forEach(function (m) { if (m.kind === 'close') m.raw = wsolRent + swapOut - aggFee; });

  /* number the movements and check that the wallet-level SOL rows add up to the real balance change */
  var walletSum = -meta.fee;
  movements.forEach(function (m, i) {
    m.n = i + 1;
    m.wallet = m.kind === 'deposit' ? -m.raw : (m.kind === 'close' || m.kind === 'refund') ? m.raw : null;
    if (m.wallet !== null) walletSum += m.wallet;
  });
  var movementsReconcile = walletSum === (meta.postBalances[signerIdx] - meta.preBalances[signerIdx]);

  var arrived = swapOut - aggFee;
  var netCheck = arrived - fee;
  var reconciles = netCheck === signerDelta;
  var aggFeePct = swapOut ? Math.round(aggFee / swapOut * 1000) / 10 : 0;

  /* Pump.fun AMM fee, decoded from the pool's own SellEvent ("Program data:" log after "Instruction: SellV2",
     Anchor discriminator 3e2f370aa503dc2a). u64 little-endian fields at byte offsets (discriminator included):
     64 quote_amount_out (gross), 72 lp_fee_bps, 80 lp_fee, 88 protocol_fee_bps, 96 protocol_fee,
     112 user_quote_amount_out (net to the user), 344 coin_creator_fee_bps, 352 coin_creator_fee.
     Used only when it agrees with the real transfer: net === swapOut and gross - lp - protocol - creator === net. */
  var POOL_PROGRAM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';
  var SELL_EVENT = [0x3e, 0x2f, 0x37, 0x0a, 0xa5, 0x03, 0xdc, 0x2a];
  var pool = null;
  (function decodeSellEvent() {
    var logs = meta.logMessages || [];
    var inSell = false;
    for (var i = 0; i < logs.length; i++) {
      var line = logs[i];
      if (line === 'Program log: Instruction: SellV2') { inSell = true; continue; }
      if (!inSell || line.indexOf('Program data: ') !== 0) continue;
      var b64 = line.slice(14);
      if (b64.length > 4096 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return;
      var bin;
      try { bin = atob(b64); } catch (e) { return; }
      var bytes = new Array(bin.length);
      for (var j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
      if (bytes.length < 360) return;
      for (var d = 0; d < 8; d++) if (bytes[d] !== SELL_EVENT[d]) return;
      var ev = {
        gross: readLE(bytes, 64, 8),
        lpBps: readLE(bytes, 72, 8), lp: readLE(bytes, 80, 8),
        protocolBps: readLE(bytes, 88, 8), protocol: readLE(bytes, 96, 8),
        net: readLE(bytes, 112, 8),
        creatorBps: readLE(bytes, 344, 8), creator: readLE(bytes, 352, 8)
      };
      var kept = ev.lp + ev.protocol + ev.creator;
      var sane = ev.net === swapOut && ev.gross - kept === ev.net && kept > 0 && ev.lpBps + ev.protocolBps + ev.creatorBps < 10000 &&
        msg.instructions.some(function (ix, k) { return ix.programId === POOL_PROGRAM || (meta.innerInstructions || []).some(function (inner) { return inner.index === k && inner.instructions.some(function (x) { return x.programId === POOL_PROGRAM; }); }); });
      if (sane) {
        ev.fee = kept;
        ev.bps = ev.lpBps + ev.protocolBps + ev.creatorBps;
        pool = ev;
      }
      return;
    }
  })();
  var poolFee = pool ? pool.fee : 0;

  /* rent still locked in token accounts the signer emptied but did not close */
  var rentHeld = [];
  Object.keys(tokenChanges).forEach(function (m) {
    var t = tokenChanges[m];
    var lamports = meta.postBalances[t.accountIndex];
    if (t.post === '0' && lamports > 0 && m !== SOL_MINT) rentHeld.push({ mint: m, account: t.account, lamports: lamports, program: t.program });
  });

  /* program steps with compute units, parsed from logs */
  var steps = msg.instructions.map(function (ix, i) {
    return { index: i + 1, programId: ix.programId, program: LABELS[ix.programId] || short(ix.programId), name: ix.parsed ? ix.parsed.type : null, cu: null };
  });
  (function parseLogs() {
    var top = -1, depth = 0;
    (meta.logMessages || []).forEach(function (line) {
      var inv = /^Program (\w+) invoke \[(\d+)\]/.exec(line);
      if (inv) { depth = Number(inv[2]); if (depth === 1) top++; return; }
      var used = /^Program (\w+) consumed (\d+) of (\d+) compute units/.exec(line);
      if (used && depth === 1 && steps[top]) steps[top].cu = Number(used[2]);
      var done = /^Program (\w+) (success|failed)/.exec(line);
      if (done) depth = Math.max(0, depth - 1);
    });
    var known = 0, missing = [];
    steps.forEach(function (s) { if (s.cu === null) missing.push(s); else known += s.cu; });
    var rest = meta.computeUnitsConsumed - known;
    missing.forEach(function (s) { s.cu = Math.round(rest / missing.length); });
  })();
  var STEP_NAMES = {
    'Compute Budget': ['Set compute limit', 'Set priority price'],
    'Associated Token Program': 'Create temporary SOL account',
    'Jupiter Aggregator v6': 'Route the swap (route_v2)',
    'Token Program': 'Close temporary account'
  };
  var cbSeen = 0;
  steps.forEach(function (s) {
    var n = STEP_NAMES[s.program];
    if (Array.isArray(n)) { s.title = n[cbSeen++] || 'Compute budget'; }
    else s.title = n || (s.name || 'Instruction');
  });

  var lookups = (msg.addressTableLookups || []).map(function (l) { return l.accountKey; });

  var M = window.TX = {
    signature: signatures[0],
    slot: R.slot,
    blockTime: R.blockTime,
    version: R.version,
    ok: meta.err === null,
    err: meta.err,
    signer: signer,
    fee: fee, baseFee: baseFee, priorityFee: priorityFee, signatures: signatures.length,
    cuUsed: meta.computeUnitsConsumed, cuLimit: cuLimit, cuPrice: cuPrice, costUnits: meta.costUnits,
    signerDelta: signerDelta,
    signerPre: meta.preBalances[signerIdx], signerPost: meta.postBalances[signerIdx],
    movementsReconcile: movementsReconcile,
    swapOut: swapOut, aggFee: aggFee, aggFeePct: aggFeePct, aggFeeTo: aggFeeTo, arrived: arrived,
    /* pool fee: null when the SellEvent is missing or does not reconcile with the real transfer */
    pool: pool,
    poolFee: poolFee,
    poolGross: pool ? pool.gross : null,
    poolFeePct: pool ? pool.bps / 100 : null,
    cost: fee + aggFee + poolFee,
    reconciles: reconciles,
    sold: sold,
    soldToken: sold ? (TOKENS[sold.mint] || { symbol: short(sold.mint) }) : null,
    poolOwner: poolOwner,
    movements: movements,
    tempAccounts: tempAccounts, tempRentOpened: tempRentOpened,
    rentHeld: rentHeld,
    steps: steps,
    lookups: lookups,
    blockhash: msg.recentBlockhash,
    price: PRICE,
    labels: LABELS,
    tokens: TOKENS,
    SOL_MINT: SOL_MINT,
    raw: R
  };

  M.fmt = { units: units, signed: signed, sig: sig, compact: compact, usd: usd, fmtUsd: fmtUsd, short: short, dateUTC: dateUTC, ago: ago, group: group };
  M.label = function (addr) {
    if (addr === signer) return null;
    return LABELS[addr] || null;
  };
})();
