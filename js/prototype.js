/* Full-page prototype. URL state: ?view=detailed, ?as=visitor, ?state=failed, ?theme=dark */
(function () {
  'use strict';
  var q;
  try { q = new URLSearchParams(window.location.search); } catch (e) { q = { get: function () { return null; } }; }
  var view = q.get('view') === 'detailed' ? 'detailed' : (q.get('view') === 'simple' ? 'simple' : null);
  var viewer = q.get('as') === 'visitor' ? 'visitor' : 'signer';
  var status = q.get('state') === 'failed' ? 'failed' : 'success';
  function href(p) {
    var u = new URLSearchParams();
    if (p.as) u.set('as', p.as);
    if (p.state) u.set('state', p.state);
    var s = u.toString();
    return 'prototype.html' + (s ? '?' + s : '');
  }
  function opt(label, on, url) {
    return on ? '<strong>' + label + '</strong>' : '<a href="' + url + '">' + label + '</a>';
  }
  var footer =
    '<div>Prototype states: ' +
      opt('Your swap', viewer === 'signer' && status === 'success', href({})) + ' · ' +
      opt('Someone else’s swap', viewer === 'visitor' && status === 'success', href({ as: 'visitor' })) + ' · ' +
      opt('Failed (example)', status === 'failed', href({ state: 'failed', as: viewer === 'visitor' ? 'visitor' : null })) +
    '</div>' +
    '<div>Rendered from the real transaction 3ae8jL…efShWURb (slot 458450284), fetched from public Solana RPC. USD uses SOL at $103.85, the price shown 11 seconds after the swap.</div>' +
    '<div>Concept redesign by Swiftbot (<a href="https://github.com/swiftbotlab">github.com/swiftbotlab</a>). Not affiliated with Solscan. <a href="index.html">Read the case study</a></div>';
  SS.mount(document.getElementById('app'), {
    view: view, viewer: viewer, status: status, persist: true, url: true, footer: footer
  });
})();
