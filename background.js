// Distraction Blocker - background service worker

const STORAGE_KEY = 'blockedRules';
const NEXT_ID_KEY = 'nextRuleId';

// Helpers for storage
function getState() {
  return new Promise((resolve) => {
    chrome.storage.local.get({ [STORAGE_KEY]: [], [NEXT_ID_KEY]: 1 }, (data) => {
      resolve({
        blockedRules: data[STORAGE_KEY] || [],
        nextRuleId: data[NEXT_ID_KEY] || 1,
      });
    });
  });
}

function setState(partial) {
  return new Promise((resolve) => {
    chrome.storage.local.set(partial, resolve);
  });
}

function toRegistrableDomain(hostname) {
  if (!hostname) return '';
  // Simple heuristic: strip leading 'www.'
  if (hostname.startsWith('www.')) return hostname.slice(4);
  return hostname;
}

function normalizeInputToFilter(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;
  try {
    // If it parses as a URL, block the registrable domain for broader coverage
    const u = new URL(trimmed);
    const host = toRegistrableDomain(u.hostname);
    if (!host) return null;
    return `||${host}^`;
  } catch (_) {
    // Not a URL; treat as domain or keyword filter
    // If input looks like a bare domain, prefix with || to match any scheme/subdomain
    // Otherwise just use as substring filter.
    const domainLike = /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(trimmed);
    if (domainLike) {
      // Declarative Net Request filter syntax: ||example.com^ matches the domain and subdomains
      return `||${toRegistrableDomain(trimmed)}^`;
    }
    return trimmed;
  }
}

function buildRule(id, urlFilter) {
  return {
    id,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: {
      urlFilter,
      resourceTypes: ['main_frame', 'sub_frame']
    }
  };
}

async function applyAllRules(blockedRules) {
  // Replace all dynamic rules with our set
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const existingIds = existing.map(r => r.id);
  const rules = blockedRules.map(r => buildRule(r.id, r.urlFilter));
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: existingIds,
    addRules: rules,
  });
}

async function addBlock(input) {
  const urlFilter = normalizeInputToFilter(input);
  if (!urlFilter) return { ok: false, error: 'Empty input' };

  const { blockedRules, nextRuleId } = await getState();

  // Prevent duplicates (same filter)
  if (blockedRules.some(r => r.urlFilter === urlFilter)) {
    return { ok: true, duplicate: true };
  }

  const id = nextRuleId;
  const entry = { id, input: input.trim(), urlFilter };

  // Update dynamic rules
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [buildRule(id, urlFilter)],
    removeRuleIds: [],
  });

  blockedRules.push(entry);
  await setState({ [STORAGE_KEY]: blockedRules, [NEXT_ID_KEY]: id + 1 });
  return { ok: true, entry };
}

async function removeBlock(id) {
  const { blockedRules } = await getState();
  const idx = blockedRules.findIndex(r => r.id === id);
  if (idx === -1) return { ok: false, error: 'Not found' };

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [id],
    addRules: [],
  });

  blockedRules.splice(idx, 1);
  await setState({ [STORAGE_KEY]: blockedRules });
  return { ok: true };
}

async function blockCurrentSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url) return { ok: false, error: 'No active tab' };
  try {
    const u = new URL(tab.url);
    const domain = toRegistrableDomain(u.hostname);
    return await addBlock(domain);
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function redirectActiveToBlocked() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  const blockedUrl = chrome.runtime.getURL('blocked.html');
  try {
    await chrome.tabs.update(tab.id, { url: blockedUrl });
  } catch (_) {
    // ignore navigation failures
  }
}

// Message handling for popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      if (msg && msg.type === 'add') {
        const result = await addBlock(msg.input);
        sendResponse(result);
      } else if (msg && msg.type === 'remove') {
        const result = await removeBlock(Number(msg.id));
        sendResponse(result);
      } else if (msg && msg.type === 'list') {
        const state = await getState();
        sendResponse({ ok: true, blockedRules: state.blockedRules });
      } else if (msg && msg.type === 'block-current') {
        const result = await blockCurrentSite();
        if (result && result.ok) {
          await redirectActiveToBlocked();
        }
        sendResponse(result);
      }
    } catch (e) {
      sendResponse({ ok: false, error: String(e) });
    }
  })();
  // Keep the message channel open for async response
  return true;
});

// Context menu for quick blocking
chrome.runtime.onInstalled.addListener(async () => {
  try {
    await chrome.contextMenus.removeAll();
  } catch (_) {}
  chrome.contextMenus.create({ id: 'block-current-site', title: 'Block this site', contexts: ['page', 'action'] });
  chrome.contextMenus.create({ id: 'block-link', title: 'Block this link', contexts: ['link'] });

  // Re-apply rules from storage on install/update
  const { blockedRules } = await getState();
  await applyAllRules(blockedRules);
});

// Ensure rules are applied when the browser starts
chrome.runtime.onStartup.addListener(async () => {
  const { blockedRules } = await getState();
  await applyAllRules(blockedRules);
});

chrome.contextMenus.onClicked.addListener(async (info, _tab) => {
  if (info.menuItemId === 'block-current-site') {
    const res = await blockCurrentSite();
    if (res && res.ok) {
      await redirectActiveToBlocked();
    }
  } else if (info.menuItemId === 'block-link' && info.linkUrl) {
    await addBlock(info.linkUrl);
  }
});
