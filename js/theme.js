/* Applies the saved or requested theme before first paint. ?theme=dark|light wins over the saved choice. */
(function () {
  var t = null;
  try { t = new URLSearchParams(window.location.search).get('theme'); } catch (e) { t = null; }
  if (t !== 'dark' && t !== 'light') {
    try { t = window.localStorage.getItem('ss:theme'); } catch (e) { t = null; }
  }
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
})();
