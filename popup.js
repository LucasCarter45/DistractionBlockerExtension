function sendMessage(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

async function refreshList() {
  const res = await sendMessage({ type: 'list' });
  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  list.innerHTML = '';
  if (!res || !res.ok) {
    empty.style.display = 'block';
    empty.textContent = 'Error loading list';
    return;
  }

  const rules = res.blockedRules || [];
  if (!rules.length) {
    empty.style.display = 'block';
    empty.textContent = 'No blocked links yet.';
    return;
  }
  empty.style.display = 'none';

  for (const r of rules) {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.className = 'filter';
    left.textContent = r.input + ' '; // original input
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

async function onAdd() {
  const input = document.getElementById('input');
  const val = input.value.trim();
  if (!val) return;
  await sendMessage({ type: 'add', input: val });
  input.value = '';
  await refreshList();
}

async function onBlockCurrent() {
  await sendMessage({ type: 'block-current' });
  await refreshList();
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('add').addEventListener('click', onAdd);
  document.getElementById('blockCurrent').addEventListener('click', onBlockCurrent);
  document.getElementById('input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onAdd();
  });
  await refreshList();
});

