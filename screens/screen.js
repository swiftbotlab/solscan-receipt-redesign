/* Renders one screen at a fixed size. Config comes from <body data-screen data-device>. */
(function () {
  'use strict';
  var body = document.body;
  var screen = body.getAttribute('data-screen');
  var device = body.getAttribute('data-device');
  var mobile = device === 'mobile';
  var C = {
    receipt: {},
    /* desktop has room for both splits and the total; a phone keeps them closed so the total stays above the dock */
    ledger: mobile ? { scrollTo: 'ledger' } : { scrollTo: 'ledger', feeOpen: true, poolOpen: true },
    route: { scrollTo: 'route' },
    'route-detailed': { scrollTo: 'route', view: 'detailed' },
    exact: mobile ? { demo: ['gave', 'sheet'] } : { demo: ['got', 'pop'] },
    details: mobile ? { scrollTo: 'tech', techOpen: true } : { demo: ['finalized', 'pop'] },
    glossary: { demo: ['final', 'sheet'] },
    failed: { status: 'failed' },
    visitor: { viewer: 'visitor' }
  };
  var cfg = C[screen] || {};
  var canvas = document.querySelector('.canvas');
  var scroller = document.querySelector('.canvas__scroll');
  var root = document.getElementById('app');
  if (mobile) {
    var sb = document.createElement('div');
    sb.className = 'statusbar';
    sb.setAttribute('aria-hidden', 'true');
    sb.innerHTML = '<span>9:41</span><span class="statusbar__icons">' +
      '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>' +
      '<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.2 10.2 0 0 0 8 .4C5.2.4 2.7 1.5.8 3.3L2 4.6a8.4 8.4 0 0 1 6-2.4zm0 3.6c1.4 0 2.6.5 3.6 1.4l1.2-1.3a7 7 0 0 0-9.6 0l1.2 1.3c1-.9 2.2-1.4 3.6-1.4zm0 3.5c-.6 0-1.2.2-1.6.6L8 11.6l1.6-1.7c-.4-.4-1-.6-1.6-.6z" fill="currentColor"/></svg>' +
      '<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor"/><rect x="23.6" y="4" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".45"/></svg></span>';
    canvas.appendChild(sb);
    var home = document.createElement('div');
    home.className = 'home';
    canvas.appendChild(home);
  }
  var api = SS.mount(root, {
    scroller: scroller, layerHost: canvas, width: mobile ? 390 : 1440,
    viewer: cfg.viewer, status: cfg.status, view: cfg.view, feeOpen: cfg.feeOpen, poolOpen: cfg.poolOpen, techOpen: cfg.techOpen
  });
  function settle() {
    if (cfg.scrollTo) api.scrollTo(cfg.scrollTo);
    if (cfg.demo) api.demo(cfg.demo[0], cfg.demo[1]);
    document.documentElement.setAttribute('data-ready', '1');
  }
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(settle);
})();
