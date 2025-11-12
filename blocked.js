// Blocked page script (MV3: no inline scripts allowed)
(function () {
  // Try to show the referring URL if available
  const ref = document.referrer;
  if (ref) {
    const p = document.getElementById('info');
    if (p) {
      p.style.display = 'block';
      p.innerHTML = 'Referrer: <code>' + ref.replace(/</g,'&lt;') + '</code>';
    }
  }

  function sendMessage(msg) {
    return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
  }

  async function refreshList() {
    const res = await sendMessage({ type: 'list' });
    const list = document.getElementById('list');
    const empty = document.getElementById('empty');
    if (!list || !empty) return;
    list.innerHTML = '';
    if (!res || !res.ok) {
      empty.style.display = 'block';
      empty.textContent = 'Error loading list';
      return;
    }
    const rules = res.blockedRules || [];
    empty.style.display = rules.length ? 'none' : 'block';
    if (!rules.length) return;

    for (const r of rules) {
      const li = document.createElement('li');
      const left = document.createElement('div');
      left.className = 'filter';
      left.textContent = r.input + ' ';
      const sub = document.createElement('span');
      sub.className = 'muted';
      sub.textContent = `→ ${r.urlFilter}`;
      left.appendChild(sub);

      const btn = document.createElement('button');
      btn.textContent = 'Remove';
      btn.addEventListener('click', async () => {
        await sendMessage({ type: 'remove', id: r.id });
        await refreshList();
      });

      li.appendChild(left);
      li.appendChild(btn);
      list.appendChild(li);
    }
  }

  const manage = document.getElementById('manage');
  if (manage) {
    manage.addEventListener('click', async () => {
      const wrap = document.getElementById('listWrap');
      if (wrap) wrap.style.display = 'block';
      await refreshList();
    });
  }
})();

