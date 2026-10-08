// Applies the theme before the first paint (loaded as a blocking script in <head>), so the page
// never flashes the wrong theme. Mirrors src/lib/theme.ts: a stored choice wins, otherwise the
// operating system setting.
(function () {
  var theme;
  try {
    theme = localStorage.getItem('sf-theme');
  } catch {
    theme = null;
  }
  if (theme !== 'light' && theme !== 'dark') {
    var light = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    theme = light ? 'light' : 'dark';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
