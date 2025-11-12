// Fallback: if a page loads from cache/SW without a network request,
// check against the stored domain rules and redirect early.
(async () => {
  try {
    // Skip extension pages
    if (location.protocol === 'chrome-extension:') return;

    const getDomain = (h) => h && h.startsWith('www.') ? h.slice(4) : h;
    const host = getDomain(location.hostname || '');
    if (!host) return;

    const data = await new Promise((r) => chrome.storage.local.get({ blockedRules: [] }, r));
    const rules = data.blockedRules || [];

    // Match rules of the form ||example.com^
    const isBlocked = rules.some((r) => {
      const f = r && r.urlFilter;
      if (!f) return false;
      // Only consider our domain rules
      if (!f.startsWith('||') || !f.endsWith('^')) return false;
      const d = f.slice(2, -1); // example.com
      return host === d || host.endsWith('.' + d);
    });

    if (isBlocked) {
      const url = chrome.runtime.getURL('blocked.html');
      // Replace so the original page isn’t in history
      location.replace(url);
    }
  } catch (_) {
    // ignore
  }
})();

