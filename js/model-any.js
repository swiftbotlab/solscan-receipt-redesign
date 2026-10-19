/* Receipt model for any Solana transaction.

   deriveReceipt(rpcTx, tokenInfo, solPriceUsd) turns the raw `result` of getTransaction
   (encoding jsonParsed) into a plain receipt object. It is a pure function: no window, no DOM,
   no network. Every amount comes from the chain data (pre/post balances, token balances,
   meta.fee and parsed System / Token instructions). Token metadata only supplies names.

   When the story cannot be told with confidence, the receipt drops to mode "reduced": exact balance
   changes, the fee and the programs involved, with the reasons listed. It never guesses a story.

   Runs in the browser (window.TxModel) and in node (module.exports) so tests can run it. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TxModel = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SOL_MINT = 'So11111111111111111111111111111111111111112';
  var SYSTEM = '11111111111111111111111111111111';
  var COMPUTE_BUDGET = 'ComputeBudget111111111111111111111111111111';
  var TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  var TOKEN22 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
  var ATA = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
  var MEMO = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
  var MEMO1 = 'Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo';
  var LAMPORTS_PER_SIGNATURE = 5000;
  /* Every map keyed by chain data (addresses, error names) has no prototype, so a key such as "__proto__" or
     "constructor" can never resolve to an inherited Object member. */
  function dict() { return Object.create(null); }
  function set(list) { var o = dict(); list.forEach(function (k) { o[k] = 1; }); return o; }
  /* signature-verification precompiles: each verified signature costs a base fee too (data[0] = count) */
  var PRECOMPILES = set([
    'Ed25519SigVerify111111111111111111111111111',
    'KeccakSecp256k11111111111111111111111111111',
    'Secp256r1SigVerify1111111111111111111111111'
  ]);
  /* Known MEV-tip receivers (Jito). Other tips stay plain "sent to" lines: no guessing. */
  var JITO_TIPS = set([
    '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5', 'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
    'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY', 'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
    'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh', 'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
    'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL', '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT'
  ]);

  /* Program names. Only ids we are sure of: a wrong name would be a wrong story.
     kind: infra (plumbing), agg (aggregator), dex (pool or curve), helper (known, moves nothing), other */
  var PROGRAMS = dict();
  function prog(id, name, kind) { PROGRAMS[id] = { name: name, kind: kind }; }
  prog(SYSTEM, 'System Program', 'infra');
  prog(COMPUTE_BUDGET, 'Compute Budget', 'infra');
  prog(TOKEN, 'Token Program', 'infra');
  prog(TOKEN22, 'Token-2022 Program', 'infra');
  prog(ATA, 'Associated Token Account Program', 'infra');
  prog(MEMO, 'Memo Program', 'infra');
  prog(MEMO1, 'Memo Program (v1)', 'infra');
  prog('AddressLookupTab1e1111111111111111111111111', 'Address Lookup Table Program', 'other');
  prog('Ed25519SigVerify111111111111111111111111111', 'Ed25519 signature check', 'infra');
  prog('KeccakSecp256k11111111111111111111111111111', 'Secp256k1 signature check', 'infra');
  prog('Secp256r1SigVerify1111111111111111111111111', 'Secp256r1 signature check', 'infra');
  prog('Stake11111111111111111111111111111111111111', 'Stake Program', 'other');
  prog('Vote111111111111111111111111111111111111111', 'Vote Program', 'other');
  prog('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', 'Jupiter', 'agg');
  prog('DF1ow4tspfHX9JwWJsAb9epbkA8hmpSEAtxXy1V27QBH', 'DFlow', 'agg');
  prog('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'Raydium AMM v4', 'dex');
  prog('CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', 'Raydium CPMM', 'dex');
  prog('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', 'Raydium CLMM', 'dex');
  prog('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', 'Orca Whirlpool', 'dex');
  prog('LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', 'Meteora DLMM', 'dex');
  prog('Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB', 'Meteora Pools', 'dex');
  prog('cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG', 'Meteora DAMM v2', 'dex');
  prog('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', 'Pump.fun', 'dex');
  prog('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA', 'Pump.fun AMM', 'dex');
  prog('pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ', 'Pump.fun fee program', 'helper');
  prog('PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY', 'Phoenix', 'dex');
  /* the vault Meteora Pools keeps its tokens in: called by the pool, never a pool of its own */
  prog('24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi', 'Meteora Vault', 'helper');
  /* built-in programs: they do not log the compute units they use */
  var BUILTIN = set([SYSTEM, COMPUTE_BUDGET, 'AddressLookupTab1e1111111111111111111111111', 'Stake11111111111111111111111111111111111111',
    'Vote111111111111111111111111111111111111111', 'Config1111111111111111111111111111111111111',
    'Ed25519SigVerify111111111111111111111111111', 'KeccakSecp256k11111111111111111111111111111', 'Secp256r1SigVerify1111111111111111111111111']);

  /* Programs a plain transfer may use. Anything else means it is not a plain transfer. */
  var SIMPLE = set([SYSTEM, COMPUTE_BUDGET, TOKEN, TOKEN22, ATA, MEMO, MEMO1]);

  /* Program errors we can name without a log line. Jupiter 6001 is its slippage check. */
  var KNOWN_ERRORS = dict();
  KNOWN_ERRORS['JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4:6001'] = ['SlippageToleranceExceeded', 'Slippage tolerance exceeded'];

  /* ---------- base58 ---------- */
  var B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  /* O(n^2): only ever run on short strings (signatures, top-level instruction data of at most 1232 bytes) */
  var B58_MAX = 2000;
  function base58Decode(s) {
    if (typeof s !== 'string' || s.length > B58_MAX) return null;
    var bytes = [0];
    for (var i = 0; i < s.length; i++) {
      var v = B58.indexOf(s[i]);
      if (v < 0) return null;
      var carry = v;
      for (var j = 0; j < bytes.length; j++) {
        carry += bytes[j] * 58;
        bytes[j] = carry & 0xff;
        carry >>= 8;
      }
      while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
    }
    /* leading '1's are leading zero bytes; drop the placeholder zero when the value is 0 */
    while (bytes.length > 1 && bytes[bytes.length - 1] === 0) bytes.pop();
    if (bytes.length === 1 && bytes[0] === 0) bytes = [];
    for (var k = 0; k < s.length && s[k] === '1'; k++) bytes.push(0);
    return bytes.reverse();
  }
  function readLE(bytes, start, len) {
    var n = 0;
    for (var i = len - 1; i >= 0; i--) n = n * 256 + (bytes[start + i] || 0);
    return n;
  }
  var SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
  var ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  function isSignature(s) {
    if (typeof s !== 'string' || !SIG_RE.test(s)) return false;
    var b = base58Decode(s);
    return !!b && b.length === 64;
  }
  function isAddress(s) { return typeof s === 'string' && ADDR_RE.test(s); }

  /* Accepts a bare signature, or a solscan.io / explorer.solana.com (or any https) link with /tx/<sig>.
     Returns { ok: true, sig } or { ok: false, error, code }. */
  function parseInput(text) {
    var s = String(text == null ? '' : text).trim();
    if (!s) return { ok: false, code: 'empty', error: 'Paste a transaction signature or an explorer link.' };
    if (s.length > 600) return { ok: false, code: 'invalid', error: 'That is too long to be a transaction signature or link.' };
    var sig = s;
    if (/^https?:\/\//i.test(s) || /^(www\.)?(solscan\.io|explorer\.solana\.com)\//i.test(s)) {
      var url;
      try { url = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { url = null; }
      if (!url) return { ok: false, code: 'invalid', error: 'That link could not be read.' };
      var m = /\/tx\/([^/?#]+)/.exec(url.pathname);
      if (!m) return { ok: false, code: 'invalid', error: 'That link does not point to a transaction (it needs /tx/ followed by the signature).' };
      var cluster = (url.searchParams.get('cluster') || '').toLowerCase();
      if (cluster && cluster !== 'mainnet' && cluster !== 'mainnet-beta') {
        return { ok: false, code: 'cluster', error: 'Only Solana mainnet transactions are supported (this link is for ' + cluster.replace(/[^a-z0-9-]/g, '').slice(0, 20) + ').' };
      }
      try { sig = decodeURIComponent(m[1]); } catch (e) { sig = m[1]; }
    }
    if (!isSignature(sig)) {
      return { ok: false, code: 'invalid', error: 'That is not a valid transaction signature: it should be a long run of letters and digits (base58), usually 87 or 88 characters.' };
    }
    return { ok: true, sig: sig };
  }

  /* ---------- formatting (exact, no floating point for amounts) ---------- */
  function group(intStr) { return String(intStr).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function units(raw, decimals, opts) {
    opts = opts || {};
    var s = String(raw);
    var neg = false;
    if (s[0] === '-') { neg = true; s = s.slice(1); }
    if (!/^\d+$/.test(s)) return '?';
    s = s.replace(/^0+(?=\d)/, '');
    while (s.length <= decimals) s = '0' + s;
    var int = s.slice(0, s.length - decimals);
    var frac = decimals ? s.slice(s.length - decimals) : '';
    if (opts.trim !== false) frac = frac.replace(/0+$/, '');
    var out = (opts.group === false ? int : group(int)) + (frac ? '.' + frac : '');
    return (neg ? '-' : '') + out;
  }
  function sig(value, digits) {
    if (!value) return '0';
    var v = Math.abs(value);
    var mag = Math.floor(Math.log10(v));
    var dp = Math.max(0, digits - 1 - mag);
    var s = v.toFixed(Math.min(dp, 12));
    if (s.indexOf('.') > -1) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }
  /* rounds first, then carries into the next unit, so 999,960 reads 1M (not 1000K) */
  var TIERS = [[1e3, 'K', 1], [1e6, 'M', 2], [1e9, 'B', 2], [1e12, 'T', 2]];
  function compact(value) {
    var v = Math.abs(value);
    if (!isFinite(v)) return '?';
    if (v < 1e4) {
      if (v < 1) return sig(v, 3);
      var two = Math.round(v * 100) / 100;
      return two >= 1e4 ? '10K' : group(String(two));
    }
    var i = v >= 1e12 ? 3 : (v >= 1e9 ? 2 : (v >= 1e6 ? 1 : 0));
    var r = Number((v / TIERS[i][0]).toFixed(TIERS[i][2]));
    if (r >= 1000 && i < 3) { i++; r = Number((v / TIERS[i][0]).toFixed(TIERS[i][2])); }
    return String(r) + TIERS[i][1];
  }
  /* rounded display of a raw integer amount (string), via float: for headlines only, never for sums */
  function approx(raw, decimals) {
    var s = String(raw).replace(/^-/, '');
    var n = Number(s) / Math.pow(10, decimals);
    return compact(n);
  }
  function short(addr) {
    if (!addr || addr.length < 14) return addr || '';
    return addr.slice(0, 4) + '…' + addr.slice(-4);
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dateUTC(sec, withSeconds) {
    var d = new Date(sec * 1000);
    var t = pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + (withSeconds ? ':' + pad2(d.getUTCSeconds()) : '');
    return { date: MONTHS[d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear(), time: t + ' UTC' };
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

  /* ---------- token metadata (attacker-controlled: sanitize, never trust) ---------- */
  var RESERVED_SYMBOLS = set(['SOL', 'WSOL', 'USDC', 'USDT', 'PYUSD', 'USDS', 'USD', 'JUP', 'BTC', 'WBTC', 'ETH', 'WETH']);
  /* control, format (bidi, zero-width, soft hyphen, tag characters), invisible fillers and variation selectors,
     line/paragraph separators, private-use and lone surrogates */
  var INVISIBLE = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}\p{Zl}\p{Zp}\p{Co}\p{Cs}]/gu;
  function cleanText(s, max) {
    if (typeof s !== 'string') return '';
    var t = s.slice(0, 4 * max + 64).replace(INVISIBLE, '').replace(/\s+/g, ' ').trim();
    if (t.length > max) t = t.slice(0, max - 1) + '…';
    return t;
  }
  /* Latin look-alikes from Cyrillic and Greek, folded before the reserved-symbol check */
  var CONFUSABLE = { 'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'І': 'I', 'Ј': 'J', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Ѕ': 'S', 'Т': 'T', 'Х': 'X', 'У': 'Y',
    'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'у': 'y', 'ѕ': 's', 'і': 'i', 'ј': 'j', 'ԁ': 'd', 'һ': 'h', 'ⅼ': 'l',
    'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ζ': 'Z', 'Η': 'H', 'Ι': 'I', 'Κ': 'K', 'Μ': 'M', 'Ν': 'N', 'Ο': 'O', 'Ρ': 'P', 'Τ': 'T', 'Υ': 'Y', 'Χ': 'X', 'ο': 'o', 'ν': 'v', 'υ': 'u', 'Ꮪ': 'S', 'Ꭰ': 'D', 'Ꮯ': 'C' };
  /* what a symbol looks like: compatibility forms folded (full-width, styled letters), invisible characters and
     combining marks dropped, look-alike letters folded to Latin, case and punctuation ignored */
  function skeleton(s) {
    var t = String(s);
    try { t = t.normalize('NFKC'); } catch (e) { /* very old engines */ }
    t = t.replace(INVISIBLE, '').replace(/\p{M}/gu, '');
    var out = '';
    for (var i = 0; i < t.length; i++) out += Object.prototype.hasOwnProperty.call(CONFUSABLE, t[i]) ? CONFUSABLE[t[i]] : t[i];
    return out.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }
  /* an unverified token gets only plain ASCII: no look-alike letters, no invisible characters, no emoji */
  var PLAIN_SYMBOL = /^[A-Za-z0-9 ._$-]{1,12}$/;
  var PLAIN_NAME = /^[A-Za-z0-9 ._$,'&()!?:+#\/-]{1,40}$/;
  function cleanIcon(u) {
    if (typeof u !== 'string' || u.length > 512 || !/^https:\/\//i.test(u)) return null;
    if (/[\s"'<>\\]/.test(u)) return null;
    return u;
  }
  var RESERVED_LIST = Object.keys(RESERVED_SYMBOLS);
  /* an unverified symbol may not be, start with or end with a well-known one (USDC, USDC2, xUSDC) */
  function reservedSymbol(text) {
    var k = skeleton(text);
    if (RESERVED_SYMBOLS[k]) return true;
    return RESERVED_LIST.some(function (r) { return r.length >= 4 && (k.indexOf(r) === 0 || k.slice(-r.length) === r); });
  }
  /* The address shown in place of a symbol. A mint address can be ground so that it starts with "USDC" or "SOL",
     so the short form is used only when no well-known symbol appears in it; otherwise the end of the address. */
  function fallbackSymbol(mint) {
    function risky(t) { var k = skeleton(t); return RESERVED_LIST.some(function (r) { return r.length >= 3 && k.indexOf(r) >= 0; }); }
    var a = short(mint);
    if (!risky(a)) return a;
    var b = '…' + String(mint).slice(-6);
    return risky(b) ? 'Unknown token' : b;
  }
  function tokenMeta(mint, tokenInfo) {
    if (mint === SOL_MINT) return { symbol: 'WSOL', name: 'Wrapped SOL', icon: null, verified: true, known: true };
    var t = tokenInfo && Object.prototype.hasOwnProperty.call(tokenInfo, mint) ? tokenInfo[mint] : null;
    if (t && typeof t !== 'object') t = null;
    var verified = !!(t && (t.verified === true || t.isVerified === true));
    var symbol = t ? cleanText(t.symbol, 12) : '';
    var name = t ? cleanText(t.name, 40) : '';
    if (!verified) {
      if (!PLAIN_SYMBOL.test(symbol)) symbol = '';
      if (!PLAIN_NAME.test(name)) name = '';
    }
    /* nobody but a verified token may look like a well-known symbol: show its address instead */
    if (!symbol || (!verified && reservedSymbol(symbol))) symbol = fallbackSymbol(mint);
    if (!verified && name && reservedSymbol(name)) name = '';
    return { symbol: symbol, name: name, icon: verified && t ? cleanIcon(t.icon) : null, verified: verified, known: !!t };
  }

  /* ---------- shape check (RPC data is untrusted) ---------- */
  function fail(msg) { var e = new Error(msg); e.code = 'bad-data'; throw e; }
  function isInt(n) { return typeof n === 'number' && Number.isInteger(n) && n >= 0; }
  function checkShape(tx) {
    if (!tx || typeof tx !== 'object') fail('No transaction data.');
    if (!tx.meta || typeof tx.meta !== 'object') fail('This transaction has no status data.');
    var t = tx.transaction;
    if (!t || typeof t !== 'object' || !t.message || !Array.isArray(t.message.accountKeys)) fail('Unexpected transaction format.');
    if (!Array.isArray(t.signatures) || !t.signatures.length || t.signatures.length > 64) fail('Unexpected signature list.');
    var keys = t.message.accountKeys;
    if (!keys.length || keys.length > 512) fail('Unexpected account list.');
    keys.forEach(function (k) {
      var pk = typeof k === 'string' ? k : (k && k.pubkey);
      if (!isAddress(pk)) fail('Unexpected account address.');
    });
    var m = tx.meta;
    if (!Array.isArray(m.preBalances) || !Array.isArray(m.postBalances) || m.preBalances.length !== keys.length || m.postBalances.length !== keys.length) fail('Balances do not line up with accounts.');
    m.preBalances.concat(m.postBalances).forEach(function (b) { if (typeof b !== 'number' || !Number.isInteger(b) || b < 0) fail('Unexpected balance value.'); });
    if (!isInt(m.fee)) fail('Unexpected fee value.');
    if (!Array.isArray(t.message.instructions) || t.message.instructions.length > 256) fail('Unexpected instruction list.');
    /* every instruction names a real program address and real account addresses; numbers are plain integers */
    var count = 0;
    function checkIx(ix, top) {
      if (++count > 8192) fail('Too many instructions.');
      if (!ix || typeof ix !== 'object' || !isAddress(ix.programId)) fail('Unexpected program address.');
      if (ix.accounts != null) {
        if (!Array.isArray(ix.accounts) || ix.accounts.length > 256) fail('Unexpected instruction accounts.');
        ix.accounts.forEach(function (a) { if (!isAddress(a)) fail('Unexpected instruction account.'); });
      }
      if (ix.data != null && typeof ix.data !== 'string') fail('Unexpected instruction data.');
      if (!top && ix.stackHeight != null && !(isInt(ix.stackHeight) && ix.stackHeight >= 2 && ix.stackHeight <= 64)) fail('Unexpected call depth.');
    }
    t.message.instructions.forEach(function (ix) { checkIx(ix, true); });
    if (m.innerInstructions != null) {
      if (!Array.isArray(m.innerInstructions)) fail('Unexpected inner instructions.');
      m.innerInstructions.forEach(function (g) {
        if (!g || !isInt(g.index) || g.index >= t.message.instructions.length || !Array.isArray(g.instructions)) fail('Unexpected inner instructions.');
        g.instructions.forEach(function (ix) { checkIx(ix, false); });
      });
    }
    var cfg = t.message.transactionConfig;
    if (cfg != null && (typeof cfg !== 'object' || ['computeUnitLimit', 'priorityFee'].some(function (k) { return cfg[k] != null && !safeInt(cfg[k]); }))) fail('Unexpected transaction settings.');
    if (m.computeUnitsConsumed != null && !safeInt(m.computeUnitsConsumed)) fail('Unexpected compute value.');
    /* one entry per account at most: a list longer than the account list cannot be real */
    [m.preTokenBalances, m.postTokenBalances].forEach(function (list) {
      if (list == null) return;
      if (!Array.isArray(list) || list.length > keys.length) fail('Unexpected token balances.');
      var seenIdx = dict();
      list.forEach(function (b) {
        if (!b || !isInt(b.accountIndex) || b.accountIndex >= keys.length || seenIdx[b.accountIndex] || !isAddress(b.mint) || !b.uiTokenAmount ||
          !/^\d{1,40}$/.test(String(b.uiTokenAmount.amount)) || !isInt(b.uiTokenAmount.decimals) || b.uiTokenAmount.decimals > 30 ||
          (b.owner != null && !isAddress(b.owner))) fail('Unexpected token balance entry.');
        seenIdx[b.accountIndex] = 1;
      });
    });
  }
  function safeInt(n) { return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0; }

  /* ---------- the derivation ---------- */
  function deriveReceipt(tx, tokenInfo, solPriceUsd) {
    checkShape(tx);
    tokenInfo = tokenInfo || {};
    var meta = tx.meta;
    var msg = tx.transaction.message;
    var keys = msg.accountKeys.map(function (k) { return typeof k === 'string' ? k : k.pubkey; });
    var writable = msg.accountKeys.map(function (k) { return typeof k === 'object' && !!k.writable; });
    var isSignerFlag = msg.accountKeys.map(function (k, i) { return typeof k === 'object' ? !!k.signer : i === 0; });
    var idx = dict();
    keys.forEach(function (k, i) { if (!(k in idx)) idx[k] = i; });
    var pre = meta.preBalances, post = meta.postBalances;
    var feePayer = keys[0];
    var P = feePayer;
    var signers = keys.filter(function (k, i) { return isSignerFlag[i]; });
    if (signers.indexOf(P) < 0) signers.unshift(P);
    var ok = meta.err === null || meta.err === undefined;
    var precise = pre.concat(post).every(function (b) { return Number.isSafeInteger(b); }) && Number.isSafeInteger(meta.fee);
    var reasons = [];
    function reason(code, text) { if (!reasons.some(function (r) { return r.code === code; })) reasons.push({ code: code, text: text }); }

    function preOf(a) { return a in idx ? pre[idx[a]] : null; }
    function postOf(a) { return a in idx ? post[idx[a]] : null; }
    function deltaOf(a) { return a in idx ? post[idx[a]] - pre[idx[a]] : 0; }

    /* --- instructions, flattened in execution order, with call depth --- */
    var innerByTop = dict();
    (meta.innerInstructions || []).forEach(function (g) {
      if (g && isInt(g.index) && Array.isArray(g.instructions)) innerByTop[g.index] = (innerByTop[g.index] || []).concat(g.instructions);
    });
    var flat = [];
    msg.instructions.forEach(function (ix, i) {
      flat.push({ ix: ix || {}, top: i, depth: 1 });
      (innerByTop[i] || []).forEach(function (j) { flat.push({ ix: j || {}, top: i, depth: isInt(j && j.stackHeight) ? j.stackHeight : null }); });
    });
    var stackKnown = flat.every(function (f) { return f.depth !== null; });
    if (!stackKnown) {
      /* older transactions: recover call depth from the "invoke [n]" log lines when they line up exactly */
      var inv = [];
      (meta.logMessages || []).forEach(function (line) {
        var mm = /^Program (\w+) invoke \[(\d+)\]$/.exec(String(line));
        if (mm) inv.push({ p: mm[1], d: Number(mm[2]) });
      });
      if (inv.length === flat.length && inv.every(function (x, i) { return x.p === flat[i].ix.programId; })) {
        flat.forEach(function (f, i) { f.depth = inv[i].d; });
        stackKnown = true;
      } else {
        flat.forEach(function (f) { if (f.depth === null) f.depth = 2; });
      }
    }
    /* parent links (nearest caller) */
    (function () {
      var stack = [];
      flat.forEach(function (f, i) {
        if (f.depth === 1) stack = [];
        stack[f.depth] = i;
        stack.length = f.depth + 1;
        f.parent = f.depth > 1 && stack[f.depth - 1] != null ? stack[f.depth - 1] : null;
      });
    })();
    function ancestors(i) {
      var out = [];
      var p = flat[i].parent;
      while (p != null) { out.push(flat[p]); p = flat[p].parent; }
      return out;
    }
    function kindOf(pid) { return PROGRAMS[pid] ? PROGRAMS[pid].kind : null; }
    function inSwap(i) {
      return ancestors(i).some(function (a) { var k = kindOf(a.ix.programId); return k === 'agg' || k === 'dex'; });
    }

    /* --- token accounts: mint, owner, decimals. The owner is the one the account had when the transaction started
       (pre balances), or the one it was opened with here. Older RPC data has no owner field at all: then the owner
       is recovered only from an instruction that opened the account in this transaction, never guessed from who
       signed. An owner handed over during the transaction (setAuthority) is kept apart in handedOver. --- */
    var tokenAcct = dict();
    var postOwner = dict();
    var recovered = dict();    /* account -> owner it was opened with in this transaction */
    var handedOver = dict();   /* account -> { to, index } */
    (meta.preTokenBalances || []).concat(meta.postTokenBalances || []).forEach(function (b) {
      var a = keys[b.accountIndex];
      var t0 = tokenAcct[a];
      tokenAcct[a] = { owner: (t0 && t0.owner) || b.owner || null, mint: b.mint, decimals: b.uiTokenAmount.decimals, program: b.programId || (t0 && t0.program) || null };
    });
    (meta.postTokenBalances || []).forEach(function (b) { postOwner[keys[b.accountIndex]] = b.owner || null; });
    flat.forEach(function (f, i) {
      var p = f.ix.parsed;
      if (!p || typeof p !== 'object' || !p.info) return;
      var info = p.info;
      var isTok = f.ix.programId === TOKEN || f.ix.programId === TOKEN22;
      if (isTok && /^initializeAccount[23]?$/.test(p.type) && isAddress(info.account)) {
        var t0 = tokenAcct[info.account] || {};
        if (isAddress(info.owner) && !recovered[info.account]) recovered[info.account] = info.owner;
        tokenAcct[info.account] = { owner: t0.owner || (isAddress(info.owner) ? info.owner : null), mint: t0.mint || info.mint, decimals: t0.decimals != null ? t0.decimals : (info.mint === SOL_MINT ? 9 : null), program: f.ix.programId };
      }
      if (f.ix.programId === ATA && (p.type === 'create' || p.type === 'createIdempotent') && isAddress(info.account)) {
        var t1 = tokenAcct[info.account] || {};
        if (isAddress(info.wallet) && !recovered[info.account]) recovered[info.account] = info.wallet;
        tokenAcct[info.account] = { owner: t1.owner || (isAddress(info.wallet) ? info.wallet : null), mint: t1.mint || info.mint, decimals: t1.decimals != null ? t1.decimals : (info.mint === SOL_MINT ? 9 : null), program: t1.program || info.tokenProgram || null };
      }
      if (isTok && p.type === 'setAuthority' && info.authorityType === 'accountOwner' && isAddress(info.account) && !handedOver[info.account]) {
        handedOver[info.account] = { to: isAddress(info.newAuthority) ? info.newAuthority : null, index: i };
      }
    });
    function ownerOf(a) { return tokenAcct[a] && tokenAcct[a].owner ? tokenAcct[a].owner : a; }
    function ownerKnown(a) { return !!(tokenAcct[a] && tokenAcct[a].owner); }
    /* wrapped-SOL accounts owned by the fee payer: inside its "SOL boundary" */
    var W = dict();
    Object.keys(tokenAcct).forEach(function (a) { if (tokenAcct[a].mint === SOL_MINT && tokenAcct[a].owner === P) W[a] = true; });
    function inS(a) { return a === P || !!W[a]; }

    /* --- pools: each call that filled part of the trade. A known DEX is a pool; an unrecognized program is one
       only when the aggregator called it directly and it calls no known DEX itself. Anything a pool calls (its
       vault, its fee program, its event log) is part of that pool, never a pool of its own. --- */
    function spanEnd(i) {
      var end = i + 1;
      while (end < flat.length && flat[end].top === flat[i].top && flat[end].depth > flat[i].depth) end++;
      return end;
    }
    var poolSpans = [];
    var poolAccts = dict();   /* every account a pool call touched or was handed */
    flat.forEach(function (f, i) {
      var pid = f.ix.programId;
      var k = kindOf(pid);
      if (k !== 'dex' && (PROGRAMS[pid] || f.depth === 1)) return;
      if (!stackKnown && f.depth > 1) return;
      var parent = f.parent != null ? flat[f.parent] : null;
      if (parent && parent.ix.programId === pid) return;   /* a program calling itself: event logging */
      var anc = ancestors(i);
      if (anc.some(function (a) { return a.isPool; })) return;
      var end = spanEnd(i);
      if (k !== 'dex') {
        var near = anc.filter(function (a) { return kindOf(a.ix.programId) !== 'infra'; })[0];
        if (!near || kindOf(near.ix.programId) !== 'agg') return;
        if (flat.slice(i + 1, end).some(function (g) { return kindOf(g.ix.programId) === 'dex'; })) return;
      }
      f.isPool = true;
      poolSpans.push({ i: i, end: end, id: pid });
      flat.slice(i, end).forEach(function (g) {
        (Array.isArray(g.ix.accounts) ? g.ix.accounts : []).forEach(function (a) { poolAccts[a] = 1; });
        var inf = g.ix.parsed && typeof g.ix.parsed === 'object' && g.ix.parsed.info;
        if (inf && typeof inf === 'object') ['source', 'destination', 'account', 'authority', 'owner', 'newAccount', 'wallet', 'multisigAuthority'].forEach(function (key) {
          if (isAddress(inf[key])) poolAccts[inf[key]] = 1;
        });
      });
    });
    /* An app fee taken through an aggregator: a transfer the aggregator itself makes (a direct child of its call),
       after at least one pool has filled, out of this wallet's own account, to an account no pool touched. */
    function isAppFee(j, src, dst) {
      var f = flat[j];
      if (f.parent == null || kindOf(flat[f.parent].ix.programId) !== 'agg') return false;
      if (!poolSpans.some(function (s) { return s.i > f.parent && s.end <= j; })) return false;
      if (!(src === P || W[src] || (tokenAcct[src] && tokenAcct[src].owner === P))) return false;
      var dstOwner = ownerOf(dst);
      if (dst === P || W[dst] || dstOwner === P) return false;
      return !poolAccts[dst] && !poolAccts[dstOwner];
    }

    /* --- fees --- */
    var sigCount = tx.transaction.signatures.length;
    var precompileSigs = 0;
    var cuLimit = null, cuPrice = null, cbSource = null, v1Priority = null;
    msg.instructions.forEach(function (ix) {
      if (!ix) return;
      if (PRECOMPILES[ix.programId] && typeof ix.data === 'string') {
        var d = base58Decode(ix.data);
        if (d && d.length) precompileSigs += d[0];
      }
      if (ix.programId === COMPUTE_BUDGET) {
        cbSource = 'ComputeBudget';
        if (ix.parsed && ix.parsed.info) {
          if (ix.parsed.type === 'setComputeUnitLimit') cuLimit = safeInt(ix.parsed.info.units) ? ix.parsed.info.units : null;
          if (ix.parsed.type === 'setComputeUnitPrice') cuPrice = safeInt(ix.parsed.info.microLamports) ? ix.parsed.info.microLamports : null;
          return;
        }
        var b = base58Decode(ix.data || '');
        if (!b || !b.length) return;
        if (b[0] === 2 && b.length >= 5) cuLimit = readLE(b, 1, 4);
        if (b[0] === 3 && b.length >= 9) cuPrice = readLE(b, 1, 8);
      }
    });
    if (msg.transactionConfig && typeof msg.transactionConfig === 'object') {
      cbSource = 'transactionConfig';
      if (isInt(msg.transactionConfig.computeUnitLimit)) cuLimit = msg.transactionConfig.computeUnitLimit;
      if (isInt(msg.transactionConfig.priorityFee)) v1Priority = msg.transactionConfig.priorityFee;
    }
    var baseFee = LAMPORTS_PER_SIGNATURE * (sigCount + precompileSigs);
    var priorityFee = meta.fee - baseFee;
    var derivedPriority = null;
    if (v1Priority !== null) derivedPriority = v1Priority;
    else if (cuPrice !== null && cuLimit !== null) derivedPriority = Math.ceil(cuPrice * cuLimit / 1e6);
    else if (!cuPrice) derivedPriority = 0;
    var fee = {
      total: meta.fee, base: baseFee, priority: priorityFee, signatures: sigCount, precompileSigs: precompileSigs,
      perSignature: LAMPORTS_PER_SIGNATURE, cuLimit: cuLimit, cuPrice: cuPrice, cuUsed: isInt(meta.computeUnitsConsumed) ? meta.computeUnitsConsumed : null,
      source: cbSource, derivedPriority: derivedPriority, derivedMatches: derivedPriority === priorityFee
    };
    if (priorityFee < 0) { fee.base = meta.fee; fee.priority = 0; }

    /* --- balance changes from pre/post balances (chain truth) --- */
    var tokSum = dict();   /* owner|mint -> totals */
    var unownedAccts = dict();   /* token accounts whose owner the data does not record */
    var listedOwner = dict();
    (meta.preTokenBalances || []).concat(meta.postTokenBalances || []).forEach(function (b) { var a = keys[b.accountIndex]; if (b.owner && !listedOwner[a]) listedOwner[a] = b.owner; });
    function addTok(list, field) {
      (list || []).forEach(function (b) {
        var acct0 = keys[b.accountIndex];
        var owner = b.owner || listedOwner[acct0] || (!handedOver[acct0] && recovered[acct0]) || null;
        if (!owner) { unownedAccts[acct0] = true; owner = acct0; }
        var k = owner + '|' + b.mint;
        var r = tokSum[k] = tokSum[k] || { owner: owner, ownerKnown: owner !== acct0 || !unownedAccts[acct0], mint: b.mint, decimals: b.uiTokenAmount.decimals, pre: 0n, post: 0n, program: b.programId || null, accounts: [] };
        r[field] += BigInt(b.uiTokenAmount.amount);
        var acct = keys[b.accountIndex];
        if (r.accounts.indexOf(acct) < 0) r.accounts.push(acct);
      });
    }
    addTok(meta.preTokenBalances, 'pre');
    addTok(meta.postTokenBalances, 'post');
    function tokenChangesOf(owner) {
      return Object.keys(tokSum).filter(function (k) { return tokSum[k].owner === owner && tokSum[k].post !== tokSum[k].pre; })
        .sort(function (a, b) { return tokSum[a].mint < tokSum[b].mint ? -1 : 1; })
        .map(function (k) { return tokenRow(tokSum[k]); });
    }
    function tokenRow(r) {
      var m = tokenMeta(r.mint, tokenInfo);
      var accounts = r.accounts.slice();
      return {
        owner: r.owner, mint: r.mint, decimals: r.decimals, pre: r.pre.toString(), post: r.post.toString(), delta: (r.post - r.pre).toString(),
        program: r.program, accounts: accounts, symbol: m.symbol, name: m.name, icon: m.icon, verified: m.verified, isWsol: r.mint === SOL_MINT,
        /* rent still sitting in a token account the owner emptied but did not close (and still owns) */
        rentHeld: r.post === 0n && r.pre > 0n ? accounts.reduce(function (s, a) { return s + (postOwner[a] === r.owner && !handedOver[a] ? (postOf(a) || 0) : 0); }, 0) : 0,
        ownerKnown: r.ownerKnown
      };
    }
    var allTokenChanges = Object.keys(tokSum).filter(function (k) { return tokSum[k].post !== tokSum[k].pre; })
      .sort(function (a, b) { return a < b ? -1 : 1; }).map(function (k) { return tokenRow(tokSum[k]); });
    var lamportChanges = [];
    keys.forEach(function (k, i) {
      if (pre[i] !== post[i]) lamportChanges.push({ pubkey: k, index: i, pre: pre[i], post: post[i], delta: post[i] - pre[i], isSigner: isSignerFlag[i], isFeePayer: i === 0 });
    });
    var perSigner = signers.map(function (s) {
      var i = idx[s];
      return { pubkey: s, index: i, isFeePayer: s === P, sol: { pre: pre[i], post: post[i], delta: post[i] - pre[i] }, tokens: tokenChangesOf(s) };
    });
    var feePayerTokens = perSigner[0].tokens;
    var sol = { pre: pre[0], post: post[0], delta: post[0] - pre[0] };
    var otherSignersMoved = perSigner.slice(1).filter(function (s) { return s.sol.delta !== 0 || s.tokens.length; });
    var coSigners = perSigner.slice(1).filter(function (s) { return s.sol.delta === 0 && !s.tokens.length; }).map(function (s) { return s.pubkey; });

    /* --- programs --- */
    var programs = [];
    var progIdx = dict();
    flat.forEach(function (f, i) {
      var pid = f.ix.programId;
      if (typeof pid !== 'string') return;
      var p = progIdx[pid];
      if (!p) {
        p = progIdx[pid] = { id: pid, name: PROGRAMS[pid] ? PROGRAMS[pid].name : null, kind: kindOf(pid) || 'unknown', known: !!PROGRAMS[pid], top: false, inner: false, writes: false, seesFeePayer: false };
        programs.push(p);
      }
      if (f.depth === 1) p.top = true; else p.inner = true;
      var accts = Array.isArray(f.ix.accounts) ? f.ix.accounts : [];
      accts.forEach(function (a) {
        if (a in idx && writable[idx[a]]) p.writes = true;
        if (a === P || W[a]) p.seesFeePayer = true;
      });
      if (f.ix.parsed) { p.writes = true; }
      f.index = i;
    });
    /* an unrecognized top-level program that was handed accounts it could change: we cannot vouch for it */
    var unknownWriters = programs.filter(function (p) { return !p.known && p.top && p.writes; });
    var unknownSeeingPayer = programs.filter(function (p) { return !p.known && p.seesFeePayer; });
    var swapPrograms = programs.filter(function (p) { return p.kind === 'agg' || p.kind === 'dex'; });

    /* --- SOL flows of the fee payer (success only: a failed transaction moves nothing but the fee) --- */
    var cur = dict();
    keys.forEach(function (k, i) { cur[k] = pre[i]; });
    cur[P] -= meta.fee;
    var lines = {
      swapIn: [], swapOut: [], deposits: [], refunds: [], payments: [], received: [], tempOut: [], tempIn: [], appFees: []
    };
    var tokenFees = [];   /* app fees taken in a token other than SOL */
    var assigned = dict();   /* accounts given an owner in this tx (allocate/assign/initialize): a transfer into them is a deposit */
    flat.forEach(function (f) {
      var p = f.ix.parsed;
      if (!p || !p.info) return;
      if (f.ix.programId === SYSTEM && (p.type === 'assign' || p.type === 'allocate' || p.type === 'assignWithSeed' || p.type === 'allocateWithSeed')) assigned[p.info.account] = true;
      if ((f.ix.programId === TOKEN || f.ix.programId === TOKEN22) && /^initializeAccount/.test(p.type)) assigned[p.info.account] = true;
      if (f.ix.programId === ATA && /^create/.test(p.type)) assigned[p.info.account] = true;
    });
    function isTemp(a) { return a !== P && !W[a] && a in idx && pre[idx[a]] === 0 && post[idx[a]] === 0; }
    var visibleOut = dict();   /* lamports we saw leave each account */
    var tokenMoves = [];   /* every token transfer, for routes */
    var wsolDecimals = 9;
    var flowError = null;
    /* The fee payer's own token flows (wrapped SOL is counted with SOL above), per mint: what went into and came out
       of the swap calls (inside an aggregator or pool), the app fees, and what moved outside the swap. The trade is
       read from the swap calls; anything else the wallet sent is shown on its own, never folded into the trade. */
    var tokFlow = dict();
    function tf(m) { return tokFlow[m] || (tokFlow[m] = { swapIn: 0n, swapOut: 0n, fee: 0n, outIn: 0n, outOut: 0n, untraced: 0n, decimals: null }); }
    var tokSent = [];   /* token transfers from the fee payer to other wallets, outside the swap */
    var seenHandover = dict();

    function classifyOut(f, kind, from, to, lamports, extra) {
      /* lamports leave the SOL boundary (fee payer + its wrapped SOL) */
      var swap = inSwap(f.index);
      if (kind === 'create') {
        if (isTemp(to)) { lines.tempOut.push({ to: to, lamports: lamports }); return; }
        lines.deposits.push(depositEntry(to, lamports, extra && extra.owner));
        return;
      }
      if (swap && f.appFee) { lines.appFees.push({ to: kind === 'wsol' ? ownerOf(to) : to, account: to, lamports: lamports, wrapped: kind === 'wsol' }); return; }
      if (isTemp(to) && kind === 'sys') { lines.tempOut.push({ to: to, lamports: lamports }); return; }
      if (kind === 'sys' && pre[idx[to]] === 0 && (assigned[to] || tokenAcct[to])) { lines.deposits.push(depositEntry(to, lamports, null)); return; }
      var entry = { to: kind === 'wsol' ? ownerOf(to) : to, account: to, lamports: lamports, wrapped: kind === 'wsol' || kind === 'close', top: f.depth === 1 };
      if (swap) lines.swapIn.push(entry);
      else { entry.tip = !!JITO_TIPS[to]; lines.payments.push(entry); }
    }
    function classifyIn(f, kind, from, to, lamports) {
      var swap = inSwap(f.index);
      if (kind === 'close' && from !== P && !W[from]) {
        if (isTemp(from)) { lines.tempIn.push({ from: from, lamports: lamports }); return; }
        var ta = tokenAcct[from] || {};
        var m = ta.mint ? tokenMeta(ta.mint, tokenInfo) : null;
        lines.refunds.push({ account: from, lamports: lamports, mint: ta.mint || null, symbol: m ? m.symbol : null, own: ta.owner === P });
        return;
      }
      if (isTemp(from)) { lines.tempIn.push({ from: from, lamports: lamports }); return; }
      var entry = { from: kind === 'wsol' ? ownerOf(from) : from, account: from, lamports: lamports, wrapped: kind === 'wsol' };
      if (swap) lines.swapOut.push(entry); else lines.received.push(entry);
    }
    function depositEntry(acct, lamports, ownerProgram) {
      var ta = tokenAcct[acct];
      var m = ta && ta.mint ? tokenMeta(ta.mint, tokenInfo) : null;
      var progName = ownerProgram && PROGRAMS[ownerProgram] ? PROGRAMS[ownerProgram].name : null;
      return {
        account: acct, lamports: lamports, ownerProgram: ownerProgram || null, ownerProgramName: progName,
        tokenAccount: !!ta, mint: ta ? ta.mint : null, symbol: m ? m.symbol : null, wallet: ta ? ta.owner : null, own: ta ? ta.owner === P : false
      };
    }
    function flow(f, kind, from, to, lamports, extra) {
      if (!isInt(lamports) || !Number.isSafeInteger(lamports)) { flowError = 'amount'; return; }
      if (!(from in cur) || !(to in cur)) { flowError = 'account'; return; }
      cur[from] -= lamports; cur[to] += lamports;
      visibleOut[from] = (visibleOut[from] || 0) + lamports;
      var fromS = inS(from), toS = inS(to);
      if (fromS && toS) return;              /* wrap, unwrap: inside the boundary */
      if (fromS) classifyOut(f, kind, from, to, lamports, extra);
      else if (toS) classifyIn(f, kind, from, to, lamports);
    }
    if (ok) {
      flat.forEach(function (f) {
        var p = f.ix.parsed;
        if (!p || typeof p !== 'object' || !p.info) return;
        var info = p.info;
        var pid = f.ix.programId;
        if (pid === SYSTEM) {
          if (p.type === 'transfer' || p.type === 'transferWithSeed') { f.appFee = isAppFee(f.index, info.source, info.destination); flow(f, 'sys', info.source, info.destination, info.lamports); }
          else if (p.type === 'createAccount' || p.type === 'createAccountWithSeed') flow(f, 'create', info.source, info.newAccount, info.lamports, { owner: info.owner });
          else if (p.type === 'withdrawFromNonce' || p.type === 'withdrawNonceAccount') flow(f, 'sys', info.nonceAccount, info.destination, info.lamports);
          return;
        }
        if (pid === TOKEN || pid === TOKEN22) {
          if (p.type === 'transfer' || p.type === 'transferChecked' || p.type === 'transferCheckedWithFee') {
            var src = info.source, dst = info.destination;
            var amt = info.tokenAmount ? info.tokenAmount.amount : info.amount;
            var mint = info.mint || (tokenAcct[src] || {}).mint || (tokenAcct[dst] || {}).mint || null;
            var dec = info.tokenAmount && isInt(info.tokenAmount.decimals) ? info.tokenAmount.decimals : ((tokenAcct[src] || {}).decimals != null ? tokenAcct[src].decimals : (tokenAcct[dst] || {}).decimals);
            if (typeof amt !== 'string' && typeof amt !== 'number') return;
            amt = String(amt);
            if (!/^\d{1,40}$/.test(amt)) { flowError = 'amount'; return; }
            var feeAmt = p.type === 'transferCheckedWithFee' && info.feeAmount && /^\d{1,40}$/.test(String(info.feeAmount.amount)) ? String(info.feeAmount.amount) : '0';
            f.appFee = isAppFee(f.index, src, dst);
            tokenMoves.push({ index: f.index, top: f.top, depth: f.depth, mint: mint, decimals: dec, amount: amt, fee: feeAmt, source: src, destination: dst, from: ownerOf(src), to: ownerOf(dst), authority: info.authority || info.multisigAuthority || null, appFee: f.appFee });
            if (f.appFee && mint !== SOL_MINT) tokenFees.push({ mint: mint, decimals: dec, amount: amt, to: ownerOf(dst), account: dst });
            /* an account whose owner changed earlier in this transaction: its later moves are not traced */
            if (seenHandover[src] || seenHandover[dst]) flowError = 'owner-change';
            var fromOwn = ownerOf(src) === P, toOwn = ownerOf(dst) === P;
            if (mint !== SOL_MINT && fromOwn !== toOwn) {
              if (!mint) { flowError = 'token'; return; }
              var tfl = tf(mint);
              if (tfl.decimals == null && isInt(dec)) tfl.decimals = dec;
              var big = BigInt(amt);
              var swapNow = inSwap(f.index);
              if (fromOwn) {
                if (f.appFee) tfl.fee += big;
                else if (swapNow) tfl.swapOut += big;
                else { tfl.outOut += big; tokSent.push({ mint: mint, decimals: dec, amount: amt, to: ownerOf(dst), account: dst, top: f.depth === 1 }); }
              } else {
                /* a Token-2022 fee charged on the way in never reaches the wallet */
                var credited = big - BigInt(feeAmt);
                if (swapNow) tfl.swapIn += credited; else tfl.outIn += credited;
              }
            }
            if (mint === SOL_MINT) {
              var n = Number(amt);
              if (!Number.isSafeInteger(n)) { flowError = 'amount'; return; }
              flow(f, 'wsol', src, dst, n);
            }
            return;
          }
          if (p.type === 'closeAccount') {
            if (!(info.account in cur)) { flowError = 'account'; return; }
            var amount = cur[info.account];
            if (amount < 0) { flowError = 'close'; return; }
            flow(f, 'close', info.account, info.destination, amount);
            return;
          }
          if ((p.type === 'burn' || p.type === 'burnChecked') && ((info.mint === SOL_MINT) || (tokenAcct[info.account] || {}).mint === SOL_MINT)) flowError = 'wsol-burn';
          if (/^(mintTo|mintToChecked|burn|burnChecked)$/.test(p.type) && isAddress(info.account) && ownerOf(info.account) === P) {
            var mm = info.mint || (tokenAcct[info.account] || {}).mint;
            var ma = info.tokenAmount ? info.tokenAmount.amount : info.amount;
            if (!mm || !/^\d{1,40}$/.test(String(ma))) { flowError = 'token'; return; }
            if (mm === SOL_MINT) return;
            var tm = tf(mm);
            var minted = /^mintTo/.test(p.type);
            /* tokens created or destroyed by a pool are part of the trade; anywhere else they are not traced */
            if (inSwap(f.index)) { if (minted) tm.swapIn += BigInt(ma); else tm.swapOut += BigInt(ma); }
            else tm.untraced += BigInt(ma);
            return;
          }
          if (p.type === 'setAuthority' && info.authorityType === 'accountOwner' && isAddress(info.account)) seenHandover[info.account] = true;
        }
      });
    }

    /* wrapped SOL accounts must end exactly where our tracking says they end */
    var wMismatch = Object.keys(W).filter(function (a) { return a in cur && ok && cur[a] !== postOf(a); });
    /* accounts that lost all their lamports without an instruction we could see (closed by a program) */
    var programClosed = ok ? lamportChanges.filter(function (c) {
      return c.pubkey !== P && c.pre > 0 && c.post === 0 && !W[c.pubkey] && cur[c.pubkey] !== 0;
    }) : [];

    function sum(list) { return list.reduce(function (s, x) { return s + x.lamports; }, 0); }
    var wDelta = 0;   /* change in the fee payer's persistent wrapped SOL accounts */
    Object.keys(W).forEach(function (a) { if (a in idx) wDelta += post[idx[a]] - pre[idx[a]]; });
    var t = {
      swapIn: sum(lines.swapIn), swapOut: sum(lines.swapOut), deposits: sum(lines.deposits), refunds: sum(lines.refunds),
      payments: sum(lines.payments), received: sum(lines.received), appFees: sum(lines.appFees)
    };
    /* everything we can see, against the real change; the rest moved without an instruction (a program credited it) */
    var boundaryDelta = sol.delta + wDelta;
    var explained = ok ? -meta.fee - t.swapIn + t.swapOut - t.deposits + t.refunds - t.payments + t.received - t.appFees : -meta.fee;
    var residual = boundaryDelta - explained;
    if (!ok) residual = sol.delta - (-meta.fee);

    /* An "app fee" larger than a twentieth of the trade in that asset is not a fee: it is the aggregator sending the
       output (or the input) on to another wallet. It becomes a plain send, never a cost. Both kinds subtract the
       same amount from the wallet, so the ledger still adds up. */
    if (ok) {
      var solTrade = Math.max(t.swapIn, t.swapOut + Math.max(residual, 0));
      lines.appFees = lines.appFees.filter(function (x) {
        if (x.lamports * 20 <= solTrade) return true;
        lines.payments.push({ to: x.to, account: x.account, lamports: x.lamports, wrapped: x.wrapped, top: false, tip: false, forwarded: true });
        return false;
      });
      tokenFees = tokenFees.filter(function (x) {
        var fl = tf(x.mint);
        var big = BigInt(x.amount);
        var trade = fl.swapIn > fl.swapOut ? fl.swapIn : fl.swapOut;
        if (big * 20n <= trade) return true;
        fl.fee -= big; fl.outOut += big;
        tokSent.push({ mint: x.mint, decimals: x.decimals, amount: x.amount, to: x.to, account: x.account, top: false, forwarded: true });
        return false;
      });
      t.appFees = sum(lines.appFees);
      t.payments = sum(lines.payments);
    }

    /* --- integrity: real transactions conserve lamports (only the fee leaves) and tokens (except mint, burn and
       withheld transfer fees). Data that breaks this is not trusted for a story. --- */
    var lamportSum = lamportChanges.reduce(function (s2, c) { return s2 + c.delta; }, 0);
    var conserved = lamportSum === -meta.fee;
    var tokenConserved = true;
    /* Token-2022 mints can charge a transfer fee that the token program withholds on its own, even on a plain
       transferChecked: the receiver gets less than was sent. That shortfall is the only gap allowed. */
    var withheldByMint = dict();
    (function () {
      var net = dict(), prog2022 = dict();
      allTokenChanges.forEach(function (c) {
        if (c.mint === SOL_MINT) return;
        net[c.mint] = (net[c.mint] || 0n) + BigInt(c.delta);
        if (c.program === TOKEN22) prog2022[c.mint] = true;
      });
      if (ok) {
        flat.forEach(function (f) {
          var p2 = f.ix.parsed;
          if (!p2 || !p2.info || (f.ix.programId !== TOKEN && f.ix.programId !== TOKEN22)) return;
          var minted = p2.type === 'mintTo' || p2.type === 'mintToChecked';
          var burned = p2.type === 'burn' || p2.type === 'burnChecked';
          if (!minted && !burned) return;
          var mint = p2.info.mint || (tokenAcct[p2.info.account] || {}).mint;
          var a = p2.info.tokenAmount ? p2.info.tokenAmount.amount : p2.info.amount;
          if (!mint || mint === SOL_MINT || !/^\d{1,40}$/.test(String(a))) { tokenConserved = false; return; }
          net[mint] = (net[mint] || 0n) + (minted ? -BigInt(a) : BigInt(a));
        });
      }
      Object.keys(net).forEach(function (m2) {
        if (net[m2] === 0n) return;
        if (net[m2] < 0n && prog2022[m2] && ok) withheldByMint[m2] = (-net[m2]).toString();
        else tokenConserved = false;
      });
    })();

    /* --- assets of the fee payer, for the story --- */
    var solNet = t.swapOut - t.swapIn;
    var residualIsSwap = false;
    var feeByMint = dict();
    var tokenAssets = feePayerTokens.filter(function (r) { return !r.isWsol; });

    /* a token the wallet holds no net change in, but which went through it (received in the swap, then sent on) */
    function quietRow(m, fl) {
      var k = P + '|' + m;
      if (tokSum[k]) return tokenRow(tokSum[k]);
      var dec = fl.decimals != null ? fl.decimals : null;
      if (dec == null) Object.keys(tokenAcct).forEach(function (a) { if (tokenAcct[a].mint === m && isInt(tokenAcct[a].decimals) && dec == null) dec = tokenAcct[a].decimals; });
      return dec == null ? null : tokenRow({ owner: P, ownerKnown: true, mint: m, decimals: dec, pre: 0n, post: 0n, program: null, accounts: [] });
    }
    function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }

    /* --- decide the mode: every condition that blocks a confident story is listed as a reason --- */
    var mode, story = null, transferSends = null;
    if (!precise) {
      mode = 'reduced';
      reason('imprecise', 'Some balances are too large to show to the lamport in a browser.');
    } else if (!conserved || !tokenConserved) {
      mode = 'reduced';
      reason('balances', 'The balances in this data do not add up (' + (!conserved ? 'SOL' : 'tokens') + ' are not conserved), so this page will not tell a story from it.');
    } else if (!ok) {
      mode = 'failed';
    } else if (Object.keys(unownedAccts).length && allTokenChanges.some(function (c) { return !c.ownerKnown; })) {
      /* older data: token balances without owners. Wallet-level claims ("nothing was sent", "no balance change")
         would be false, so the receipt lists the token accounts that changed instead. */
      mode = 'reduced';
      reason('owners', 'This is an older transaction: its data does not record which wallet owns each token account, so this page lists the token accounts that changed instead of wallets.');
      if (unknownWriters.length) reason('unknown-program', 'An unrecognized program (' + unknownWriters.map(function (p) { return short(p.id); }).join(', ') + ') had write access to accounts in this transaction.');
    } else {
      var blockers = [];
      var PW = 'wallet ' + short(P);   /* named: a reduced receipt can show several wallets */
      /* with a second signer that moved funds, that is the reason; the fee payer's own shape adds nothing */
      var complexOk = !otherSignersMoved.length;
      if (flowError) blockers.push(['flow', (flowError === 'token' || flowError === 'owner-change' ? 'Some tokens' : 'Some SOL') + ' moved in a way this page cannot trace instruction by instruction.']);
      if (wMismatch.length) blockers.push(['wrapped', 'A wrapped SOL account ended with a balance this page cannot account for.']);
      if (otherSignersMoved.length) blockers.push(['multi-signer', signers.length + ' wallets signed this transaction and more than one of them changed balance.']);
      if (unknownWriters.length) blockers.push(['unknown-program', 'An unrecognized program (' + unknownWriters.map(function (p) { return short(p.id); }).join(', ') + ') had write access to accounts in this transaction.']);
      if (residual < 0) blockers.push(['unexplained', 'SOL left ' + PW + ' without an instruction this page can trace.']);
      var simpleOnly = programs.every(function (p) { return SIMPLE[p.id] || PRECOMPILES[p.id]; });
      if (swapPrograms.length) {
        /* SOL credited directly by a program counts as swap output only when every program that could see
           this wallet is known and no other account was emptied by a program */
        var directOk = residual > 0 && !unknownSeeingPayer.length && !programClosed.length;
        if (residual > 0 && !directOk) blockers.push(['unexplained', 'SOL arrived from a program without a transfer instruction, and this page cannot tell which part was the trade.']);
        var net = solNet + (residual > 0 ? residual : 0);
        /* the trade in each token: the wallet's real change with its app fees and its sends outside the swap put
           back. It must equal what moved in and out of the swap calls, or no story is told. */
        var tokMints = dict();
        tokenAssets.forEach(function (r) { tokMints[r.mint] = r; });
        Object.keys(tokFlow).forEach(function (m) { if (!(m in tokMints)) tokMints[m] = null; });
        var assets = [], flowBad = [], gotOutside = [];
        Object.keys(tokMints).sort().forEach(function (m) {
          var fl = tokFlow[m] || tf(m);
          var r = tokMints[m] || quietRow(m, fl);
          var adj = BigInt(r ? r.delta : '0') + fl.fee + fl.outOut - fl.outIn;
          var swapNet = fl.swapIn - fl.swapOut;
          var withheld = BigInt(withheldByMint[m] || '0');
          var sym = r ? r.symbol : tokenMeta(m, tokenInfo).symbol;
          if (!r || fl.untraced !== 0n || !(adj === swapNet || (withheld > 0n && adj < swapNet && adj >= swapNet - withheld))) flowBad.push(sym);
          if (fl.outIn > 0n) gotOutside.push(sym);
          if (adj !== 0n && r) assets.push({ kind: 'token', row: r, adj: adj, flow: fl, sign: adj < 0n ? -1 : 1 });
        });
        /* with an earlier reason (an unrecognized program, a second signer), these would only restate it */
        var firstReason = !blockers.length;
        if (flowBad.length && firstReason) blockers.push(['token-flow', 'Some ' + uniq(flowBad).join(', ') + ' moved in or out of ' + PW + ' in a way this page cannot trace instruction by instruction.']);
        if (gotOutside.length && firstReason) blockers.push(['complex', uniq(gotOutside).join(', ') + ' also arrived in ' + PW + ' outside the swap, so this page will not fold it into the trade.']);
        if (net !== 0) assets.push({ kind: 'sol', sign: net < 0 ? -1 : 1 });
        /* behind an earlier reason no story is told, so the shape is described from the wallet's real changes */
        if (!firstReason) {
          assets = tokenAssets.map(function (r) { return { kind: 'token', row: r, sign: r.delta[0] === '-' ? -1 : 1 }; });
          if (net !== 0) assets.push({ kind: 'sol', sign: net < 0 ? -1 : 1 });
        }
        var gave = assets.filter(function (a) { return a.sign < 0; });
        var got = assets.filter(function (a) { return a.sign > 0; });
        if ((gave.length !== 1 || got.length !== 1) && complexOk) {
          blockers.push(['complex', gave.length + got.length > 2
            ? 'The balance of ' + PW + ' changed in ' + (gave.length + got.length) + ' different assets, more than a simple swap.'
            : (got.length === 0 ? 'Nothing came back to ' + PW + ', so this is not a swap.'
              : (gave.length === 0 ? 'Only incoming amounts changed for ' + PW + ' (nothing went out), so this is not a swap.' : 'This is not a simple swap.'))]);
        }
        /* app fees taken in a token: the trade's own amount is the wallet's change without the fee */
        if (gave.length === 1 && got.length === 1) {
          tokenFees.forEach(function (x) {
            var side = gave[0].kind === 'token' && gave[0].row.mint === x.mint ? 'gave' : (got[0].kind === 'token' && got[0].row.mint === x.mint ? 'got' : null);
            if (!side) { blockers.push(['complex', 'An app fee was taken in a token this page cannot place in the trade.']); return; }
            feeByMint[x.mint] = (feeByMint[x.mint] || 0n) + BigInt(x.amount);
          });
          /* a buy and a sell in one transaction (or a wash trade): the asset given also came back inside the swap, or
             the asset received also went in. Netting those would show a trade that never happened. */
          var g0 = gave[0], o0 = got[0];
          var backIn = !firstReason ? false : g0.kind === 'token' ? g0.flow.swapIn > 0n : lines.swapOut.length > 0;
          var backOut = !firstReason ? false : o0.kind === 'token' ? o0.flow.swapOut > 0n : lines.swapIn.length > 0;
          if (backIn || backOut) blockers.push(['round-trip', PW.charAt(0).toUpperCase() + PW.slice(1) + ' both paid in and received ' + (backIn ? (g0.kind === 'sol' ? 'SOL' : g0.row.symbol) : (o0.kind === 'sol' ? 'SOL' : o0.row.symbol)) +
            ' inside the swap calls (for example a buy and a sell in one transaction), so there is no single trade to show.']);
          if (!blockers.length) {
            var hops0 = findHops(g0.kind === 'sol' ? SOL_MINT : g0.row.mint, o0.kind === 'sol' ? SOL_MINT : o0.row.mint);
            if (hops0.list.some(function (hp) { return (hp.in && hp.in === (o0.kind === 'sol' ? SOL_MINT : o0.row.mint)) || (hp.out && hp.out === (g0.kind === 'sol' ? SOL_MINT : g0.row.mint)); })) {
              blockers.push(['round-trip', 'Part of the route ran in the opposite direction (back into what was given), so there is no single trade to show.']);
            }
          }
        } else if (tokenFees.length && !blockers.length) blockers.push(['complex', 'This is not a simple swap.']);
        if (!blockers.length) {
          mode = 'swap';
          residualIsSwap = directOk;
          solNet = net;
          story = { gave: gave[0], got: got[0] };
        }
      } else if (simpleOnly) {
        if (residual > 0) blockers.push(['unexplained', 'SOL arrived in ' + PW + ' without a transfer instruction this page can trace.']);
        var tokOut = tokenAssets.filter(function (r) { return r.delta[0] === '-'; });
        var tokIn = tokenAssets.filter(function (r) { return r.delta[0] !== '-'; });
        var wsolMoves = lines.payments.some(function (x) { return x.wrapped; }) || feePayerTokens.some(function (r) { return r.isWsol; });
        if (tokIn.length && complexOk) blockers.push(['complex', PW.charAt(0).toUpperCase() + PW.slice(1) + ' also received tokens, so this is not a plain send.']);
        if (wsolMoves) blockers.push(['wrapped', 'Wrapped SOL moved; this page shows that as balance changes only.']);
        if ((lines.received.length || lines.refunds.length) && complexOk) blockers.push(['complex', 'SOL also came back to ' + PW + ' in this transaction.']);
        if (!lines.payments.length && !tokOut.length && complexOk) blockers.push(['complex', 'Nothing was sent to another wallet.']);
        var sends = [];
        /* a Jito tip next to a real send is a cost, not a recipient; a tip on its own is what was sent */
        var sendPays = lines.payments.filter(function (x) { return !x.tip; });
        var tipPays = lines.payments.filter(function (x) { return x.tip; });
        if (!sendPays.length && !tokOut.length) { sendPays = tipPays; tipPays = []; }
        if (!blockers.length) {
          if (sendPays.length) {
            var byTo = dict();
            var order = [];
            sendPays.forEach(function (x) {
              x.sent = true;
              if (!(x.to in byTo)) { byTo[x.to] = 0; order.push(x.to); }
              byTo[x.to] += x.lamports;
            });
            sends.push({ asset: { kind: 'sol', mint: SOL_MINT, symbol: 'SOL', name: 'Solana', decimals: 9, verified: true }, total: String(sum(sendPays)), withheld: '0',
              recipients: order.map(function (a) { return { owner: a, amount: String(byTo[a]), tip: !!JITO_TIPS[a] }; }) });
          }
          tokOut.forEach(function (r) {
            var outAmt = BigInt(r.delta.slice(1));
            var recips = allTokenChanges.filter(function (c) { return c.mint === r.mint && c.owner !== P && c.delta[0] !== '-'; });
            var losers = allTokenChanges.filter(function (c) { return c.mint === r.mint && c.owner !== P && c.delta[0] === '-'; });
            var withheld = BigInt(withheldByMint[r.mint] || '0');
            var got2 = recips.reduce(function (s, c) { return s + BigInt(c.delta); }, 0n);
            if (losers.length || got2 + withheld !== outAmt) {
              blockers.push(['complex', 'The ' + r.symbol + ' that left ' + PW + ' does not match what other wallets received.']);
              return;
            }
            sends.push({
              asset: { kind: 'token', mint: r.mint, symbol: r.symbol, name: r.name, icon: r.icon, verified: r.verified, decimals: r.decimals, program: r.program },
              total: outAmt.toString(), withheld: withheld.toString(),
              recipients: recips.map(function (c) { return { owner: c.owner, amount: c.delta }; })
            });
          });
        }
        if (!blockers.length) { mode = 'transfer'; transferSends = sends; }
      } else {
        blockers.push(['no-story', 'This transaction uses programs this page does not have a plain-words story for.']);
      }
      if (!mode) {
        mode = 'reduced';
        blockers.forEach(function (b) { reason(b[0], b[1]); });
      }
    }

    var roundTrip = mode === 'reduced' && reasons.some(function (x) { return x.code === 'round-trip'; }) && !flowError && !wMismatch.length;
    /* reduced: SOL that came from accounts a program closed, itemized only when it is certain. It is certain when
       those closed accounts are the only ones that lost lamports we could not see, and they add up exactly. */
    var closedBack = [];
    if (ok && mode === 'reduced' && residual > 0 && programClosed.length) {
      var closedSum = programClosed.reduce(function (s, c) { return s + c.pre; }, 0);
      var closedSet = dict();
      programClosed.forEach(function (c) { closedSet[c.pubkey] = true; });
      var inflowFromS = dict();
      lines.deposits.concat(lines.payments, lines.swapIn).forEach(function (x) { var a = x.account || x.to; inflowFromS[a] = (inflowFromS[a] || 0) + x.lamports; });
      var othersOk = lamportChanges.every(function (c) {
        return c.pubkey === P || closedSet[c.pubkey] || W[c.pubkey] || (c.delta > 0 && c.delta === inflowFromS[c.pubkey]);
      });
      if (closedSum === residual && othersOk) closedBack = programClosed.map(function (c) { return { account: c.pubkey, lamports: c.pre }; });
    }

    /* --- the ledger: lines that add up, to the lamport, to the fee payer's real SOL change --- */
    var L = [];
    function line(o) { L.push(o); }
    if (ok && mode !== 'reduced') {
      if (t.swapIn) line({ kind: 'swapIn', lamports: -t.swapIn, parts: groupParts(lines.swapIn, 'to') });
      if (t.swapOut) line({ kind: 'swapOut', lamports: t.swapOut, parts: groupParts(lines.swapOut, 'from') });
      if (residualIsSwap && residual) line({ kind: 'direct', lamports: residual, payer: directPayer() });
      if (wDelta) line({ kind: 'wrapped', lamports: -wDelta });
      /* in a swap, a SOL transfer to another wallet is shown on its own ("also sent"): it is not part of the trade,
         and only a tip is known to be a cost. In a transfer, every payment that is not the send is a tip. */
      lines.payments.forEach(function (x) {
        if (mode === 'transfer' && x.sent) line({ kind: 'sent', lamports: -x.lamports, to: x.to, tip: x.tip });
        else line({ kind: 'payment', lamports: -x.lamports, to: x.to, tip: x.tip, wrapped: x.wrapped, forwarded: !!x.forwarded, inCost: mode === 'swap' ? !!x.tip : true });
      });
      lines.appFees.forEach(function (x) { line({ kind: 'appFee', lamports: -x.lamports, to: x.to, account: x.account, wrapped: x.wrapped, inCost: true }); });
      lines.received.forEach(function (x) { line({ kind: 'received', lamports: x.lamports, from: x.from }); });
      /* a deposit that opens another wallet's account stays with that account: a cost, in a swap as in a transfer */
      lines.deposits.forEach(function (x) { line({ kind: 'deposit', lamports: -x.lamports, deposit: x, inCost: !x.own && !!x.tokenAccount }); });
      lines.refunds.forEach(function (x) { line({ kind: 'refund', lamports: x.lamports, refund: x }); });
    } else if (ok) {
      /* reduced: itemize only what is certain (deposits, plain sends), the rest stays one honest line.
         Only a tip counts toward the fee shown on top: what the rest paid for is not known. */
      lines.deposits.forEach(function (x) { line({ kind: 'deposit', lamports: -x.lamports, deposit: x }); });
      lines.payments.filter(function (x) { return !x.wrapped; }).forEach(function (x) { line({ kind: 'payment', lamports: -x.lamports, to: x.to, tip: x.tip, inCost: x.tip }); });
      /* a round trip: both legs were traced transfer by transfer, so they are shown as they happened, never netted */
      if (roundTrip) {
        if (t.swapIn) line({ kind: 'swapIn', lamports: -t.swapIn, parts: groupParts(lines.swapIn, 'to'), legs: true });
        if (t.swapOut) line({ kind: 'swapOut', lamports: t.swapOut, parts: groupParts(lines.swapOut, 'from'), legs: true });
      }
      closedBack.forEach(function (x) { line({ kind: 'closedBack', lamports: x.lamports, account: x.account }); });
    }
    line({ kind: 'fee', lamports: -meta.fee, parts: [
      { kind: 'base', lamports: -fee.base }, { kind: 'priority', lamports: -fee.priority }
    ] });
    var lineSum = L.reduce(function (s, x) { return s + x.lamports; }, 0);
    if (lineSum !== sol.delta) {
      /* failed: anything beyond the fee; reduced: everything not itemized */
      line({ kind: 'other', lamports: sol.delta - lineSum });
      lineSum = sol.delta;
    }
    /* order: what the story is about first, the fee last */
    var ORDER = { swapIn: 1, swapOut: 2, direct: 3, wrapped: 4, sent: 5, appFee: 6, payment: 7, received: 8, deposit: 9, refund: 10, closedBack: 11, other: 12, fee: 13 };
    L.sort(function (a, b) { return ORDER[a.kind] - ORDER[b.kind]; });
    function groupParts(list, field) {
      var by = dict(), order = [];
      list.forEach(function (x) {
        var k = x[field];
        if (!(k in by)) { by[k] = 0; order.push(k); }
        by[k] += x.lamports;
      });
      return order.map(function (k) { return { addr: k, lamports: by[k] }; }).sort(function (a, b) { return b.lamports - a.lamports; });
    }
    function directPayer() {
      var cands = programs.filter(function (p) { return p.kind === 'dex' && p.seesFeePayer; });
      if (cands.length === 1) return { id: cands[0].id, name: cands[0].name };
      var tops = programs.filter(function (p) { return (p.kind === 'dex' || p.kind === 'agg') && p.top; });
      return tops.length === 1 ? { id: tops[0].id, name: tops[0].name } : null;
    }

    /* --- steps (top-level instructions), compute units from the logs --- */
    var steps = msg.instructions.map(function (ix, i) {
      ix = ix || {};
      return { n: i + 1, programId: typeof ix.programId === 'string' ? ix.programId : '', name: PROGRAMS[ix.programId] ? PROGRAMS[ix.programId].name : null, known: !!PROGRAMS[ix.programId], type: ix.parsed && typeof ix.parsed === 'object' && ix.parsed.type ? String(ix.parsed.type) : null, cu: null, status: 'ok', info: ix.parsed && typeof ix.parsed === 'object' && ix.parsed.info ? ix.parsed.info : null, created: false };
    });
    (function () {
      var top = -1, depth = 0;
      (meta.logMessages || []).forEach(function (line) {
        line = String(line);
        var inv = /^Program (\w+) invoke \[(\d+)\]/.exec(line);
        if (inv) { depth = Number(inv[2]); if (depth === 1) top++; return; }
        var used = /^Program (\w+) consumed (\d+) of (\d+) compute units/.exec(line);
        if (used && depth === 1 && steps[top]) steps[top].cu = Number(used[2]);
        if (/^Program (\w+) (success|failed)/.test(line)) depth = Math.max(0, depth - 1);
      });
    })();
    flat.forEach(function (f) {
      var p = f.ix.parsed;
      if (f.depth > 1 && f.ix.programId === SYSTEM && p && (p.type === 'createAccount' || p.type === 'createAccountWithSeed') && steps[f.top]) steps[f.top].created = true;
    });
    /* plain words for each top-level step, as parts: plain text, { addr } for an address (self: the fee payer;
       tokenAccount: a token account whose owner the data does not record) and { tok } for a token symbol with its
       verified flag, so the page can mark unverified tokens and keep addresses whole. Amounts are exact. */
    function who(a) { return { addr: a, self: a === P }; }
    function holder(acct) { return ownerKnown(acct) ? who(ownerOf(acct)) : { addr: acct, tokenAccount: true }; }
    function tokPart(mint) {
      if (mint === SOL_MINT) return 'wrapped SOL';
      if (!mint) return 'tokens';
      var m = tokenMeta(mint, tokenInfo);
      return { tok: m.symbol, verified: m.verified, mint: mint };
    }
    function amountParts(raw, decimals, mint) {
      if (mint === SOL_MINT && decimals != null) return [units(raw, decimals) + ' SOL (wrapped)'];
      if (decimals == null) return [String(raw) + ' base units of ', tokPart(mint)];
      return [units(raw, decimals) + ' ', tokPart(mint)];
    }
    function partsText(parts) {
      return parts.map(function (x) {
        if (typeof x === 'string') return x;
        if (x.addr) return x.self ? 'this wallet' : (x.tokenAccount ? 'token account ' : '') + short(x.addr);
        return x.tok + (x.verified ? '' : ' (unverified)');
      }).join('');
    }
    steps.forEach(function (st, i) {
      var ix = msg.instructions[i] || {};
      var info = st.info || {};
      var pid = st.programId;
      var T = null, sub = null;
      if (pid === COMPUTE_BUDGET) {
        var b = base58Decode(ix.data || '') || [];
        if (b[0] === 2) T = ['Set the compute limit to ' + group(String(readLE(b, 1, 4))) + ' units'];
        else if (b[0] === 3) T = ['Set the priority price to ' + group(String(readLE(b, 1, 8))) + ' micro-lamports per unit'];
        else if (b[0] === 1) T = ['Asked for extra memory'];
        else if (b[0] === 4) T = ['Capped the account data it may load'];
        else T = ['Set the compute budget'];
      } else if (pid === SYSTEM) {
        var lam = isInt(info.lamports) ? units(info.lamports, 9) + ' SOL' : 'SOL';
        if (st.type === 'transfer' || st.type === 'transferWithSeed') {
          if (info.source === info.destination) T = ['Sent ' + lam + ' to itself (does nothing)'];
          else if (W[info.destination]) T = ['Moved ' + lam + ' into ' + (info.source === P ? 'its' : 'a') + ' wrapped SOL account'];
          else T = ['Sent ' + lam + ' from ', who(info.source), ' to ', who(info.destination)];
        } else if (st.type === 'createAccount' || st.type === 'createAccountWithSeed') {
          T = ['Opened account ', { addr: info.newAccount }, ' with a ' + lam + ' deposit'];
        } else if (st.type === 'advanceNonce') {
          T = ['Used a durable nonce'];
          sub = 'Lets a transaction be signed ahead of time and sent later';
        } else T = ['System: ' + humanize(st.type)];
      } else if (pid === ATA) {
        var acct = info.account;
        if (st.created) {
          if (info.mint === SOL_MINT && acct in idx && pre[idx[acct]] === 0 && post[idx[acct]] === 0) T = ['Opened a temporary wrapped SOL account'];
          else T = ['Opened a token account for ', tokPart(info.mint), ', owned by ', who(info.wallet)];
        } else T = ['Checked that ', who(info.wallet), ' has a token account for ', tokPart(info.mint)];
      } else if (pid === TOKEN || pid === TOKEN22) {
        var ta = tokenAcct[info.source] || tokenAcct[info.account] || {};
        var mint = info.mint || ta.mint || (tokenAcct[info.destination] || {}).mint;
        var amt = info.tokenAmount ? info.tokenAmount.amount : info.amount;
        var dec = info.tokenAmount && isInt(info.tokenAmount.decimals) ? info.tokenAmount.decimals : ta.decimals;
        if (/^transfer/.test(st.type || '') && amt != null && /^\d{1,40}$/.test(String(amt))) {
          T = ['Moved '].concat(amountParts(String(amt), dec, mint), [' from ', holder(info.source), ' to ', holder(info.destination)]);
        } else if (st.type === 'closeAccount') {
          T = W[info.account] ? ['Closed the wrapped SOL account, unwrapping it to plain SOL'] : ['Closed a ', tokPart(mint), ' account; its deposit went to ', who(info.destination)];
        } else if (st.type === 'syncNative') T = ['Updated the wrapped SOL balance'];
        else if (/^initializeAccount/.test(st.type || '')) T = ['Set up a ', tokPart(mint), ' token account'];
        else if (/^mintTo/.test(st.type || '') && amt != null) T = ['Created '].concat(amountParts(String(amt), dec, mint));
        else if (/^burn/.test(st.type || '') && amt != null) T = ['Burned '].concat(amountParts(String(amt), dec, mint));
        else if (st.type === 'setAuthority' && info.authorityType === 'accountOwner' && isAddress(info.newAuthority)) {
          T = ownerOf(info.account) === P ? ['Handed its ', tokPart(mint), ' token account to ', who(info.newAuthority)]
            : ['Changed the owner of a ', tokPart(mint), ' token account to ', who(info.newAuthority)];
          sub = 'The account and the deposit inside it now belong to the new owner';
        } else if (st.type === 'setAuthority' && info.authorityType === 'closeAccount' && isAddress(info.newAuthority)) {
          T = ['Let ', who(info.newAuthority), ' close a ', tokPart(mint), ' token account'];
        } else T = [(pid === TOKEN22 ? 'Token-2022: ' : 'Token: ') + humanize(st.type)];
      } else if (pid === MEMO || pid === MEMO1) {
        T = ['Added a memo'];
      } else if (PROGRAMS[pid]) {
        var k2 = PROGRAMS[pid].kind;
        if (k2 === 'agg') T = ['Routed the trade through ' + PROGRAMS[pid].name];
        else if (k2 === 'dex') T = ['Traded on ' + PROGRAMS[pid].name];
        else T = [PROGRAMS[pid].name];
      } else {
        var pr = progIdx[pid];
        T = ['Called an unrecognized program'];
        sub = pr && !pr.writes ? 'It was given no accounts it could change' : 'This page cannot say what it did';
      }
      st.parts = T;
      st.sub = sub;
      delete st.info;
    });
    function humanize(t) { return t ? String(t).replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().slice(0, 60) : 'instruction'; }

    var error = null;
    if (!ok) {
      error = describeError(meta.err, steps, meta.logMessages || []);
      steps.forEach(function (s, i) {
        if (error.index != null) {
          if (i === error.index) s.status = 'failed';
          else if (i > error.index) s.status = 'skipped';
          /* what a failed transaction still keeps: its compute budget (it set the fee that was charged) and,
             for a durable-nonce transaction, the nonce advance */
          else if (s.programId === COMPUTE_BUDGET) s.status = 'applied';
          else if (s.programId === SYSTEM && s.type === 'advanceNonce') s.status = 'kept';
          else s.status = 'undone';
        }
      });
    }
    /* the step that failed did not happen: "Traded on X" becomes "Tried to trade on X" */
    var TRIED = { Traded: 'trade', Routed: 'route', Sent: 'send', Moved: 'move', Opened: 'open', Closed: 'close', Set: 'set', Created: 'create', Burned: 'burn',
      Checked: 'check', Added: 'add', Used: 'use', Updated: 'update', Asked: 'ask', Capped: 'cap', Handed: 'hand', Changed: 'change', Let: 'let' };
    steps.forEach(function (st) {
      if (st.status === 'failed' && typeof st.parts[0] === 'string') {
        var mm = /^(\w+)(.*)$/.exec(st.parts[0]);
        if (mm && Object.prototype.hasOwnProperty.call(TRIED, mm[1])) st.parts = ['Tried to ' + TRIED[mm[1]] + mm[2]].concat(st.parts.slice(1));
      }
      st.title = partsText(st.parts);
    });
    /* compute units: programs log their own use; built-in programs do not, so the rest is theirs only when every
       step without a log line is built in */
    var cuLogged = steps.reduce(function (s2, st) { return s2 + (st.cu || 0); }, 0);
    var unlogged = steps.filter(function (st) { return st.cu == null && st.status !== 'skipped'; });
    var compute = fee.cuUsed == null ? null : {
      used: fee.cuUsed, logged: cuLogged, rest: fee.cuUsed - cuLogged, restSteps: unlogged.length,
      restBuiltin: unlogged.length > 0 && fee.cuUsed - cuLogged >= 0 && unlogged.every(function (st) { return BUILTIN[st.programId]; })
    };
    unlogged.forEach(function (st) { st.builtin = !!BUILTIN[st.programId]; });
    var memos = [];
    flat.forEach(function (f) {
      if ((f.ix.programId === MEMO || f.ix.programId === MEMO1) && typeof f.ix.parsed === 'string') memos.push(cleanText(f.ix.parsed, 280));
    });
    var durableNonce = !!(msg.instructions[0] && msg.instructions[0].programId === SYSTEM && msg.instructions[0].parsed && msg.instructions[0].parsed.type === 'advanceNonce');

    /* --- story --- */
    var out = {
      signature: tx.transaction.signatures[0],
      slot: isInt(tx.slot) ? tx.slot : null,
      blockTime: isInt(tx.blockTime) ? tx.blockTime : null,
      version: tx.version === undefined ? 'legacy' : tx.version,
      ok: ok, err: ok ? null : meta.err,
      mode: mode, reasons: reasons,
      feePayer: P, signers: signers, coSigners: coSigners,
      fee: fee,
      sol: sol,
      tokens: feePayerTokens,
      perSigner: perSigner,
      allTokenChanges: allTokenChanges,
      lamportChanges: lamportChanges,
      ledger: { lines: L, sum: lineSum, total: sol.delta, reconciles: lineSum === sol.delta, pre: sol.pre, post: sol.post, wrappedChange: wDelta, residual: residual },
      temp: { count: lines.tempOut.length, lamports: sum(lines.tempOut), visibleBack: sum(lines.tempIn), wrappedTemp: Object.keys(W).filter(function (a) { return a in idx && pre[idx[a]] === 0 && post[idx[a]] === 0; }).length },
      totals: t,
      programs: programs.map(function (p) { return { id: p.id, name: p.name, kind: p.kind, known: p.known, top: p.top, inner: p.inner, writes: p.writes }; }),
      steps: steps,
      error: error,
      memos: memos,
      durableNonce: durableNonce,
      nonceAdvanced: durableNonce && !ok,
      compute: compute,
      lookups: Array.isArray(msg.addressTableLookups) ? msg.addressTableLookups.length : 0,
      loadedAccounts: msg.accountKeys.filter(function (k) { return k && k.source === 'lookupTable'; }).length,
      blockhash: typeof msg.recentBlockhash === 'string' ? msg.recentBlockhash : null,
      price: typeof solPriceUsd === 'number' && isFinite(solPriceUsd) && solPriceUsd > 0 ? solPriceUsd : null,
      withheld: withheldByMint,
      flags: { precise: precise, conserved: conserved && tokenConserved, stackKnown: stackKnown, residual: residual, residualIsSwap: residualIsSwap, programClosed: programClosed.map(function (c) { return c.pubkey; }) }
    };

    /* older data: token accounts with no recorded owner, listed as accounts (with who signed for a move out of them) */
    out.ownersUnknown = allTokenChanges.some(function (c) { return !c.ownerKnown; });
    out.unownedChanges = allTokenChanges.filter(function (c) { return !c.ownerKnown; }).map(function (c) {
      var by = null;
      tokenMoves.forEach(function (mv) { if (!by && mv.source === c.owner && signers.indexOf(mv.authority) >= 0) by = mv.authority; });
      return { account: c.owner, mint: c.mint, symbol: c.symbol, verified: c.verified, icon: c.icon, decimals: c.decimals, delta: c.delta, post: c.post, isWsol: c.isWsol, signedBy: by };
    });
    /* token accounts of the fee payer handed to a new owner here: the deposit inside went with them */
    /* a round trip: what went into and came out of the swap calls, per token, both ways */
    out.legs = roundTrip ? Object.keys(tokFlow).filter(function (m) { return tokFlow[m].swapIn > 0n || tokFlow[m].swapOut > 0n; }).map(function (m) {
      return { mint: m, in: tokFlow[m].swapIn.toString(), out: tokFlow[m].swapOut.toString() };
    }) : [];
    out.handovers = [];
    Object.keys(handedOver).forEach(function (a) {
      if (!ok || ownerOf(a) !== P || !handedOver[a].to || handedOver[a].to === P) return;
      var ta = tokenAcct[a] || {};
      var m = ta.mint ? tokenMeta(ta.mint, tokenInfo) : null;
      out.handovers.push({ account: a, to: handedOver[a].to, mint: ta.mint || null, symbol: ta.mint === SOL_MINT ? 'WSOL' : (m ? m.symbol : null), verified: ta.mint === SOL_MINT || (m ? m.verified : false), lamports: postOf(a) || 0 });
    });
    if (mode === 'swap') {
      out.story = swapStory(story);
    } else if (mode === 'transfer') {
      out.story = { kind: 'transfer', sends: transferSends };
    } else if (mode === 'failed') {
      var others = lamportChanges.filter(function (c) { return c.index !== 0; });
      out.story = {
        kind: 'failed',
        attempted: programs.filter(function (p) { return p.top && p.kind !== 'infra'; }).map(function (p) { return { id: p.id, name: p.name, known: p.known }; }),
        nothingMoved: others.length === 0 && allTokenChanges.length === 0 && sol.delta === -meta.fee
      };
    } else {
      out.story = { kind: 'reduced' };
    }

    /* costs shown on the receipt: the network fee plus every extra the wallet paid outside the story. Each extra is
       a ledger line marked inCost, so the cost and the ledger can never disagree. */
    var items = L.filter(function (l) { return l.inCost; }).map(function (l) {
      return { kind: l.kind === 'deposit' ? 'deposit' : (l.kind === 'appFee' ? 'appFee' : (l.tip ? 'tip' : 'payment')), lamports: -l.lamports, to: l.to || (l.deposit && l.deposit.wallet) || null };
    });
    function itemSum(kind) { return items.filter(function (x) { return x.kind === kind; }).reduce(function (s, x) { return s + x.lamports; }, 0); }
    out.costs = {
      fee: meta.fee,
      items: items,
      tips: itemSum('tip'),
      appFees: itemSum('appFee'),
      payments: itemSum('payment'),
      depositsForOthers: itemSum('deposit'),
      outside: items.reduce(function (s, x) { return s + x.lamports; }, 0),
      deposits: lines.deposits.slice(),
      depositsTotal: t.deposits,
      tokenFees: mode === 'swap' ? tokenFees.map(function (x) {
        var m = tokenMeta(x.mint, tokenInfo);
        return { mint: x.mint, amount: x.amount, decimals: x.decimals, symbol: m.symbol, verified: m.verified, to: x.to, account: x.account };
      }) : []
    };
    out.costs.total = meta.fee + out.costs.outside;
    /* swap: what the wallet also sent to other wallets in the same transaction, outside the trade (never a cost) */
    out.costs.also = [];
    if (mode === 'swap') {
      L.forEach(function (l) {
        if (l.kind === 'payment' && !l.inCost) out.costs.also.push({ kind: 'sol', mint: SOL_MINT, symbol: 'SOL', verified: true, decimals: 9, amount: String(-l.lamports), to: l.to, forwarded: l.forwarded });
      });
      tokSent.forEach(function (x) {
        var m = tokenMeta(x.mint, tokenInfo);
        out.costs.also.push({ kind: 'token', mint: x.mint, symbol: m.symbol, verified: m.verified, decimals: x.decimals, amount: x.amount, to: x.to, account: x.account, forwarded: !!x.forwarded });
      });
    }
    return out;

    function swapStory(s) {
      function asset(a, which) {
        if (a.kind === 'sol') {
          var lam = Math.abs(solNet);
          /* 'all' when its wrapped SOL account covered (or kept) the whole amount, 'part' when only some of it */
          var fromW = which === 'gave' && wDelta < 0 ? (-wDelta >= lam ? 'all' : 'part') : false;
          var intoW = which === 'got' && wDelta > 0 ? (wDelta >= lam ? 'all' : 'part') : false;
          return { kind: 'sol', mint: SOL_MINT, symbol: 'SOL', name: 'Solana', decimals: 9, raw: String(lam), verified: true, icon: null, fromWrapped: fromW, intoWrapped: intoW };
        }
        var r = a.row;
        var feeTok = feeByMint[r.mint] || 0n;
        /* what went into (or came out of) the swap calls: the wallet's change with app fees and outside sends put back */
        var moved = which === 'gave' ? -a.adj : a.adj;
        return { kind: 'token', mint: r.mint, symbol: r.symbol, name: r.name, icon: r.icon, verified: r.verified, decimals: r.decimals, raw: moved.toString(), appFee: feeTok.toString(), sentOutside: a.flow.outOut.toString(), walletChange: r.delta, post: r.post, program: r.program, rentHeld: r.rentHeld, accounts: r.accounts };
      }
      var gaveA = asset(s.gave, 'gave'), gotA = asset(s.got, 'got');
      var hops = findHops(gaveA.mint, gotA.mint);
      var agg = programs.filter(function (p) { return p.kind === 'agg'; });
      var dexes = programs.filter(function (p) { return p.kind === 'dex'; });
      var venue = agg.length ? agg[0] : (dexes.length ? dexes[0] : null);
      var wrapper = programs.filter(function (p) { return p.top && !p.known && p.writes; });
      return {
        kind: 'swap', gave: gaveA, got: gotA,
        venue: venue ? { id: venue.id, name: venue.name, kind: venue.kind } : null,
        aggregator: agg.length ? { id: agg[0].id, name: agg[0].name } : null,
        hops: hops.list, route: hops.shape, wrapper: wrapper.length ? wrapper[0].id : null
      };
    }

    /* Pools the trade went through (see poolSpans), with the token mints that moved inside each */
    function findHops(gaveMint, gotMint) {
      var groups = [];
      poolSpans.forEach(function (sp) {
        var i = sp.i, end = sp.end, pid = sp.id;
        var mints = [];
        var inMint = null, outMint = null;
        tokenMoves.forEach(function (m) {
          if (m.index <= i || m.index >= end || !m.mint) return;
          var mm = m.mint;
          if (mints.indexOf(mm) < 0) mints.push(mm);
          if (m.authority === P || m.from === P) inMint = inMint || mm;
          if (m.to === P) outMint = outMint || mm;
        });
        /* SOL paid straight from the wallet inside this pool (bonding curves) */
        flat.slice(i + 1, end).forEach(function (g) {
          var p = g.ix.parsed;
          if (g.ix.programId === SYSTEM && p && p.type === 'transfer' && p.info && p.info.source === P) { if (mints.indexOf(SOL_MINT) < 0) mints.push(SOL_MINT); inMint = inMint || SOL_MINT; }
        });
        /* a call that moved no tokens (bookkeeping, events) is not a leg of the trade */
        if (!mints.length) return;
        groups.push({ id: pid, name: PROGRAMS[pid] ? PROGRAMS[pid].name : null, known: !!PROGRAMS[pid], mints: mints, inMint: inMint, outMint: outMint });
      });
      /* orient each pool: input is what the wallet (or the previous pool) handed in */
      var have = [gaveMint];
      groups.forEach(function (g) {
        var ms = g.mints;
        if (ms.length === 2) {
          var a = ms[0], b = ms[1];
          if (g.inMint && ms.indexOf(g.inMint) >= 0) { g.in = g.inMint; g.out = g.inMint === a ? b : a; }
          else if (have.indexOf(a) >= 0 && have.indexOf(b) < 0) { g.in = a; g.out = b; }
          else if (have.indexOf(b) >= 0 && have.indexOf(a) < 0) { g.in = b; g.out = a; }
          else if ((a === gaveMint && b === gotMint) || (b === gaveMint && a === gotMint)) { g.in = gaveMint; g.out = gotMint; }
          else {
            /* a parallel leg of a split: the same two tokens as an earlier pool, in the same direction */
            var twin = groups.filter(function (o) { return o !== g && o.in && o.out && ms.indexOf(o.in) >= 0 && ms.indexOf(o.out) >= 0; })[0];
            if (twin) { g.in = twin.in; g.out = twin.out; }
          }
        } else if (ms.length === 1) {
          if (ms[0] === gaveMint) { g.in = gaveMint; g.out = gotMint; }
          else if (ms[0] === gotMint) { g.in = gaveMint; g.out = gotMint; }
        }
        if (g.out && have.indexOf(g.out) < 0) have.push(g.out);
      });
      var list = groups.map(function (g) {
        return { id: g.id, name: g.name, known: g.known, in: g.in || null, out: g.out || null,
          inSymbol: g.in ? symbolOf(g.in) : null, outSymbol: g.out ? symbolOf(g.out) : null,
          inVerified: g.in ? verifiedOf(g.in) : null, outVerified: g.out ? verifiedOf(g.out) : null };
      });
      var shape = 'unknown';
      if (list.length && list.every(function (h) { return h.in && h.out; })) {
        if (list.every(function (h) { return h.in === gaveMint && h.out === gotMint; })) shape = list.length === 1 ? 'single' : 'split';
        else {
          var chain = list[0].in === gaveMint && list[list.length - 1].out === gotMint && list.every(function (h, i) { return i === 0 || h.in === list[i - 1].out; });
          shape = chain ? 'multihop' : 'mixed';
        }
      }
      return { list: list, shape: shape };
    }
    function symbolOf(mint) { return mint === SOL_MINT ? 'SOL' : tokenMeta(mint, tokenInfo).symbol; }
    function verifiedOf(mint) { return mint === SOL_MINT || tokenMeta(mint, tokenInfo).verified; }
  }

  /* ---------- errors in plain words ---------- */
  var PLAIN_ERRORS = dict();
  [['InsufficientFunds', 'There was not enough balance to cover it.'],
    ['InsufficientFundsForFee', 'There was not enough SOL to pay the fee.'],
    ['InsufficientFundsForRent', 'An account would have been left below its rent deposit.'],
    ['AccountNotFound', 'An account it needed does not exist.'],
    ['InvalidAccountData', 'An account had data the program did not expect.'],
    ['AccountAlreadyInUse', 'An account it tried to create already exists.'],
    ['ComputationalBudgetExceeded', 'It ran out of compute units before finishing.'],
    ['ProgramFailedToComplete', 'The program could not finish (often out of compute units).'],
    ['MissingRequiredSignature', 'A required signature was missing.'],
    ['BlockhashNotFound', 'It was sent too late: its blockhash had expired.']].forEach(function (e) { PLAIN_ERRORS[e[0]] = e[1]; });
  function describeError(err, steps, logs) {
    var out = { index: null, programId: null, programName: null, code: null, name: null, message: null, source: null, plain: null, slippage: false, raw: null, label: null };
    try { out.raw = JSON.stringify(err).slice(0, 300); } catch (e) { out.raw = 'unknown'; }
    var detail = null;
    if (err && typeof err === 'object' && Array.isArray(err.InstructionError) && isInt(err.InstructionError[0])) {
      out.index = err.InstructionError[0];
      detail = err.InstructionError[1];
      var st = steps[out.index];
      if (st) { out.programId = st.programId; out.programName = st.name; }
    } else if (typeof err === 'string') {
      out.name = cleanText(err, 60);
    } else if (err && typeof err === 'object') {
      out.name = cleanText(Object.keys(err)[0] || '', 60);
    }
    if (detail && typeof detail === 'object' && isInt(detail.Custom)) {
      out.code = detail.Custom;
    } else if (typeof detail === 'string') {
      out.name = cleanText(detail, 60);
    } else if (detail && typeof detail === 'object') {
      out.name = cleanText(Object.keys(detail)[0] || '', 60);
    }
    /* Anchor programs log a readable error line */
    for (var i = logs.length - 1; i >= 0; i--) {
      var m = /Error Code: (\w{1,60})\. Error Number: (\d{1,6})\. Error Message: (.{0,200})$/.exec(String(logs[i]));
      if (m && (out.code === null || Number(m[2]) === out.code)) { out.name = m[1]; out.message = cleanText(m[3], 160); out.source = 'log'; break; }
    }
    if (!out.message && out.code !== null && out.programId) {
      var k = KNOWN_ERRORS[out.programId + ':' + out.code];
      if (k) { out.name = k[0]; out.message = k[1]; out.source = 'known'; }
    }
    if (out.name && /slippage|toolittle|toomuch|minimumamount|belowminimum|exceededslippage|amountout/i.test(out.name)) {
      out.slippage = true;
      out.plain = 'The price moved more than the slippage limit allowed, so nothing was traded.';
    } else if (out.name && PLAIN_ERRORS[out.name]) {
      out.plain = PLAIN_ERRORS[out.name];
    }
    if (!out.plain && logs.some(function (l) { return /exceeded CUs meter|ComputationalBudgetExceeded|exceeded maximum compute/i.test(String(l)); })) {
      out.plain = PLAIN_ERRORS.ComputationalBudgetExceeded;
    }
    /* a short technical label: "Instruction 2 · custom error 6001 (0x1771)" */
    var what = out.code !== null ? 'custom error ' + out.code + ' (0x' + out.code.toString(16) + ')' : (out.name || 'error');
    out.label = out.index != null ? 'Instruction ' + (out.index + 1) + ' · ' + what : what;
    return out;
  }

  return {
    deriveReceipt: deriveReceipt,
    checkShape: checkShape,
    parseInput: parseInput,
    isSignature: isSignature,
    isAddress: isAddress,
    tokenMeta: tokenMeta,
    cleanText: cleanText,
    cleanIcon: cleanIcon,
    base58Decode: base58Decode,
    PROGRAMS: PROGRAMS,
    SOL_MINT: SOL_MINT,
    fmt: { units: units, group: group, sig: sig, compact: compact, approx: approx, short: short, dateUTC: dateUTC, ago: ago }
  };
}));
