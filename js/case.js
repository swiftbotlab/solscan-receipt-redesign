/* Case study: builds the device frames, mounts a live copy of the redesign in each, wires the toggles. */
(function () {
  'use strict';

  var SIG_SHORT = '3ae8jL…efShWURb';
  var frames = [];
  var viewer = 'signer';

  var STATUS_ICONS =
    '<svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor"/><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor"/></svg>' +
    '<svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 2.2c2.3 0 4.4.9 6 2.4l1.2-1.3A10.2 10.2 0 0 0 8 .4C5.2.4 2.7 1.5.8 3.3L2 4.6a8.4 8.4 0 0 1 6-2.4zm0 3.6c1.4 0 2.6.5 3.6 1.4l1.2-1.3a7 7 0 0 0-9.6 0l1.2 1.3c1-.9 2.2-1.4 3.6-1.4zm0 3.5c-.6 0-1.2.2-1.6.6L8 11.6l1.6-1.7c-.4-.4-1-.6-1.6-.6z" fill="currentColor"/></svg>' +
    '<svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true"><rect x=".5" y=".5" width="22" height="11" rx="3.2" fill="none" stroke="currentColor" opacity=".45"/><rect x="2" y="2" width="17" height="8" rx="2" fill="currentColor"/><rect x="23.6" y="4" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".45"/></svg>';

  function cfgOf(el) {
    try { return JSON.parse(el.getAttribute('data-cfg') || '{}'); } catch (e) { return {}; }
  }

  var nid = 0;
  var FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

  /* Frames are live copies of the app. Until a frame is tried, its content is inert: out of the tab order and the
     accessibility tree, and the page wheel-scrolls past it. A mouse over the frame wakes it for hover popovers;
     a click or the "Try it" button makes it scrollable; leaving it (focus or pointer) puts it back to sleep. */
  function setInert(f) {
    var on = !f.active && !f.hover;
    var els = [f.scroller].concat(Array.prototype.slice.call(f.dev.querySelectorAll('.ss-layer')));
    els.forEach(function (x) { if (on) x.setAttribute('inert', ''); else x.removeAttribute('inert'); });
  }
  function setActive(f, on) {
    if (f.active === on) return;
    f.active = on;
    f.el.classList.toggle('is-active', on);
    f.scroller.classList.toggle('is-active', on);
    f.btn.textContent = on ? 'Done' : 'Try it';
    f.hint.textContent = on ? f.hintOn : f.hintOff;
    setInert(f);
  }
  function firstFocusable(f) {
    var list = f.dev.querySelectorAll(FOCUSABLE);
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (!x.closest('[inert]') && !x.disabled && x.getClientRects().length) {
        var r = x.getBoundingClientRect(), v = f.scroller.getBoundingClientRect();
        if (!f.scroller.contains(x) || (r.bottom > v.top && r.top < v.bottom)) return x;
      }
    }
    return null;
  }

  function build(el) {
    var cfg = cfgOf(el);
    var kind = el.getAttribute('data-frame');
    var id = el.getAttribute('data-fid') || ('frame' + (++nid));
    el.setAttribute('data-fid', id);
    var label = el.getAttribute('data-label') || (kind === 'desktop' ? 'Live demo, desktop' : 'Live demo, phone');
    var scroller, host, dev, hintOff, hintOn;
    var skip = '<a class="cs-skip" href="#' + id + '-end" data-skip>Skip the live demo</a>';
    var bar = '<div class="cs-frame__bar"><button type="button" class="cs-tryit" aria-describedby="' + id + '-hint">Try it</button><span class="cs-frame__hint" id="' + id + '-hint"></span></div>';
    var end = '<span class="cs-frame__end" id="' + id + '-end" tabindex="-1"></span>';
    if (kind === 'desktop') {
      el.innerHTML = skip + '<div class="cs-dev cs-desk" role="group" aria-label="' + label + '"><div class="cs-desk__chrome" aria-hidden="true"><span class="cs-desk__dots"><i></i><i></i><i></i></span>' +
        '<span class="cs-desk__url">solscan.io/tx/' + SIG_SHORT + '</span><span class="cs-desk__tag">Concept</span></div>' +
        '<div class="cs-desk__view"></div></div>' + bar + end;
      dev = el.querySelector('.cs-dev');
      scroller = el.querySelector('.cs-desk__view');
      host = dev;
      hintOff = 'Hover the numbers, or click the page to scroll inside';
      hintOn = 'Scroll inside the page. Done, Escape or a click outside leaves it';
    } else if (kind === 'bare') {
      el.innerHTML = '<div class="cs-dev"></div>';
      dev = scroller = el.querySelector('.cs-dev');
      host = null;
    } else {
      el.innerHTML = skip + '<div class="cs-dev"><div class="cs-phone" role="group" aria-label="' + label + '"><div class="cs-phone__screen">' +
        '<div class="cs-phone__status" aria-hidden="true"><span>9:41</span><span class="cs-phone__icons">' + STATUS_ICONS + '</span></div>' +
        '<div class="cs-phone__island" aria-hidden="true"></div><div class="cs-phone__scroll"></div><div class="cs-phone__home" aria-hidden="true"></div></div></div></div>' +
        bar + end;
      dev = el.querySelector('.cs-dev');
      scroller = el.querySelector('.cs-phone__scroll');
      host = el.querySelector('.cs-phone__screen');
      hintOff = 'Tap a number, or tap the phone to scroll inside';
      hintOn = 'Scroll inside the phone. Done, Escape or a tap outside leaves it';
    }
    var root = document.createElement('div');
    scroller.appendChild(root);
    var opts = {
      scroller: kind === 'bare' ? null : scroller, layerHost: host, embedded: true,
      viewer: cfg.viewer || (el.hasAttribute('data-viewer-toggle') ? viewer : 'signer'),
      status: cfg.status, view: cfg.view, feeOpen: cfg.feeOpen, poolOpen: cfg.poolOpen, techOpen: cfg.techOpen,
      only: cfg.only, popovers: cfg.popovers
    };
    var api = SS.mount(root, opts);
    var f = { el: el, dev: dev, scroller: scroller, api: api, cfg: cfg, active: false, hover: false, hintOff: hintOff, hintOn: hintOn,
      btn: el.querySelector('.cs-tryit'), hint: el.querySelector('.cs-frame__hint'), bar: el.querySelector('.cs-frame__bar') };
    frames = frames.filter(function (x) { return x.el !== el; });
    if (kind === 'bare') return f;
    frames.push(f);
    f.hint.textContent = hintOff;
    setInert(f);

    f.btn.addEventListener('click', function () {
      if (f.active) { setActive(f, false); f.btn.focus(); return; }
      frames.forEach(function (o) { if (o !== f) setActive(o, false); });
      setActive(f, true);
      var first = firstFocusable(f);
      if (first) first.focus({ preventScroll: true });
    });
    el.querySelector('[data-skip]').addEventListener('click', function (e) {
      e.preventDefault();
      setActive(f, false);
      el.querySelector('.cs-frame__end').focus();
    });
    dev.addEventListener('pointerenter', function (e) {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      f.hover = true; setInert(f);
    });
    dev.addEventListener('pointerleave', function (e) {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      f.hover = false;
      if (f.active && !dev.contains(document.activeElement)) setActive(f, false);
      else setInert(f);
    });
    /* capture phase: decide before the app closes an open popover or sheet with the same Escape */
    dev.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && f.active && !dev.querySelector('.ss-layer.is-open, .ss-pop')) { setActive(f, false); f.btn.focus(); }
    }, true);
    return f;
  }

  function settle(f) {
    if (f.cfg.scrollTo) f.api.scrollTo(f.cfg.scrollTo);
    if (f.cfg.demo) f.api.demo(f.cfg.demo[0], f.cfg.demo[1]);
    if (f.btn) setInert(f);   /* a demo may have just created the sheet layer */
  }

  /* pointer or focus inside a frame wakes it; anywhere else (except its own Try it / Done bar) puts it to sleep */
  function activate(target) {
    frames.forEach(function (f) {
      if (!target) { setActive(f, false); return; }
      if (f.dev.contains(target)) setActive(f, true);
      else if (!f.bar.contains(target)) setActive(f, false);
    });
  }

  function init() {
    var els = Array.prototype.slice.call(document.querySelectorAll('[data-frame]'));
    els.forEach(build);
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function () { frames.forEach(settle); });

    document.addEventListener('pointerdown', function (e) { activate(e.target); });
    document.addEventListener('focusin', function (e) { activate(e.target); });

    /* viewer toggle for the receipt feature */
    Array.prototype.forEach.call(document.querySelectorAll('[data-viewer]'), function (b) {
      b.addEventListener('click', function () {
        viewer = b.getAttribute('data-viewer');
        Array.prototype.forEach.call(document.querySelectorAll('[data-viewer]'), function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        Array.prototype.forEach.call(document.querySelectorAll('[data-viewer-toggle]'), function (el) { settle(build(el)); });
      });
    });

    /* pins light up with their list item */
    Array.prototype.forEach.call(document.querySelectorAll('.cs-issues li[data-n]'), function (li) {
      var sec = li.closest('section');
      var n = li.getAttribute('data-n');
      function hot(on) { Array.prototype.forEach.call(sec.querySelectorAll('.cs-pin[data-n="' + n + '"]'), function (p) { p.classList.toggle('is-hot', on); }); }
      li.addEventListener('mouseenter', function () { hot(true); });
      li.addEventListener('mouseleave', function () { hot(false); });
    });

    /* page theme */
    var tb = document.querySelector('[data-cs-theme]');
    if (tb) tb.addEventListener('click', function () {
      var d = document.documentElement;
      var cur = d.getAttribute('data-theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = cur === 'dark' ? 'light' : 'dark';
      d.setAttribute('data-theme', next);
      SS.store('ss:theme', next);
    });

    var sys = document.getElementById('system-sheet');
    if (sys && window.SSSystem) window.SSSystem.render(sys);

    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () { frames.forEach(function (f) { if (f.cfg.scrollTo && !f.el.classList.contains('is-active')) f.api.scrollTo(f.cfg.scrollTo); }); }, 200);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
