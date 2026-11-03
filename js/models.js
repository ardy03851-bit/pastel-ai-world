/* models.js — manage AI models: free keyless discovery, custom models, directory */

(function () {
  'use strict';

  /* ---------------- Presets ---------------- */
  const chips = document.getElementById('preset-chips');
  PWAI.PRESETS.forEach((p) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost btn-sm';
    b.textContent = p.name;
    b.addEventListener('click', () => {
      document.getElementById('f-kind').value = p.kind;
      document.getElementById('f-baseurl').value = p.baseUrl;
      document.getElementById('f-modelid').value = p.modelId;
      if (p.baseUrl && !document.getElementById('f-name').value) {
        document.getElementById('f-name').value = p.name.replace(/\s*\(.*\)$/, '');
      }
      PW.toast(p.baseUrl ? 'Preset filled in — add your API key' : 'Blank custom provider — paste any API URL and model ID');
    });
    chips.appendChild(b);
  });

  /* ---------------- Free models ---------------- */
  const freeGrid = document.getElementById('free-grid');
  const freeStatus = document.getElementById('free-status');

  function freeCard(m) {
    const card = document.createElement('div');
    card.className = 'free-card';
    const saved = PW.data.models.some((x) => x.kind === m.kind && x.modelId === m.id);
    const kindLabels = { puter: 'free · puter', horde: 'free · horde', ovh: 'free · ovh', llm7: 'free · llm7' };
    card.innerHTML = `
      <div class="free-head">
        <strong>${PW.escapeHtml(m.name)}</strong>
        <span class="badge badge-free">${kindLabels[m.kind] || 'free · no key'}</span>
      </div>
      <p>${PW.escapeHtml(m.description || '')}</p>
      <button class="btn ${saved ? 'btn-ghost' : 'btn-primary'} btn-sm">${saved ? 'Added ✓' : 'Add to my models'}</button>
    `;
    card.querySelector('button').addEventListener('click', () => {
      const dup = PW.data.models.some((x) => x.kind === m.kind && x.modelId === m.id);
      if (!dup) {
        PW.data.models.push({
          id: PW.uid(), name: m.name, kind: m.kind, modelId: m.id,
          baseUrl: m.baseUrl || '', apiKey: m.defaultKey || '', proxyUrl: m.proxyUrl || '', free: true, keyless: true,
        });
        PW.save();
        PW.toast(`Added ${m.name}`);
        card.querySelector('button').textContent = 'Added ✓';
        card.querySelector('button').className = 'btn btn-ghost btn-sm';
        renderSaved();
      }
    });
    return card;
  }

  async function loadFree() {
    freeStatus.textContent = 'Fetching free models…';
    freeGrid.innerHTML = '<div class="skeleton skeleton-text" style="width:60%"></div><div class="skeleton skeleton-text" style="width:90%"></div><div class="skeleton skeleton-text" style="width:75%"></div>';
    try {
      const res = await PWAI.fetchFreeModels();
      freeGrid.innerHTML = '';
      const all = [
        ...res.pollinations,
        ...res.puter,
        ...res.ovh,
        ...res.llm7,
        ...res.horde,
      ];
      if (!all.length) {
        freeGrid.innerHTML = '<div class="empty-state"><div class="empty-art"><i data-lucide="wind"></i></div><h3>No free models available right now</h3><p>The keyless providers are unreachable. You can still add your own model below, or try again in a moment.</p></div>';
        lucide.createIcons();
      } else {
        all.forEach((m) => freeGrid.appendChild(freeCard(m)));
      }
      const bits = [];
      if (res.pollinations.length) bits.push(`${res.pollinations.length} Pollinations`);
      if (res.puter.length) bits.push(`${res.puter.length} Puter`);
      if (res.ovh.length) bits.push(`${res.ovh.length} OVHcloud`);
      if (res.llm7.length) bits.push(`${res.llm7.length} LLM7`);
      if (res.horde.length) bits.push(`${res.horde.length} AI Horde`);
      freeStatus.textContent = bits.length ? 'Found ' + bits.join(' · ') : 'No keyless models found';
      if (res.errors.length) freeStatus.title = res.errors.join('\n');
    } catch (e) {
      freeGrid.innerHTML = '';
      freeStatus.textContent = 'Fetch failed — ' + e.message;
    }
  }
  document.getElementById('refresh-free').addEventListener('click', loadFree);
  loadFree();

  /* ---------------- Custom model form ---------------- */
  const form = document.getElementById('model-form');
  const result = document.getElementById('f-result');

  function readForm() {
    return {
      id: document.getElementById('f-id').value || null,
      name: document.getElementById('f-name').value.trim(),
      kind: document.getElementById('f-kind').value,
      modelId: document.getElementById('f-modelid').value.trim(),
      baseUrl: document.getElementById('f-baseurl').value.trim(),
      apiKey: document.getElementById('f-apikey').value.trim(),
      proxyUrl: document.getElementById('f-proxy').value.trim(),
    };
  }

  document.getElementById('f-test').addEventListener('click', async () => {
    const m = readForm();
    result.textContent = 'Testing…';
    try {
      const r = await PWAI.test(m);
      result.innerHTML = `<span style="color:var(--color-success)">✓ Connected in ${r.ms} ms — replied “${PW.escapeHtml(r.reply)}”</span>`;
    } catch (e) {
      result.innerHTML = `<span style="color:var(--color-error)">✗ ${PW.escapeHtml(e.message)}</span>`;
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const m = readForm();
    if (!m.name) { result.textContent = 'Give the model a name.'; return; }
    if (!m.modelId && !['puter'].includes(m.kind)) { result.textContent = 'Model ID is required (the name the API expects).'; return; }
    if (!m.baseUrl && ['openai', 'gemini', 'anthropic'].includes(m.kind)) { result.textContent = 'API base URL is required for this API style.'; return; }
    if (m.id) {
      const idx = PW.data.models.findIndex((x) => x.id === m.id);
      if (idx >= 0) PW.data.models[idx] = { ...PW.data.models[idx], ...m };
    } else {
      PW.data.models.push({ ...m, id: PW.uid() });
    }
    PW.save();
    form.reset();
    document.getElementById('f-id').value = '';
    result.textContent = '';
    renderSaved();
    PW.toast(`Saved ${m.name}`);
  });

  document.getElementById('f-apikey').addEventListener('dblclick', (e) => {
    e.target.type = e.target.type === 'password' ? 'text' : 'password';
  });

  /* ---------------- Saved list ---------------- */
  const savedList = document.getElementById('saved-list');

  function renderSaved() {
    const models = PW.data.models;
    if (!models.length) {
      savedList.innerHTML = `<div class="empty-state"><div class="empty-art"><i data-lucide="brain"></i></div><h3>No models yet</h3><p>Add your own below, or pick one from the free section above — it takes seconds.</p></div>`;
      lucide.createIcons();
      return;
    }
    savedList.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>API</th><th>Model ID</th><th>Key</th><th></th></tr></thead>
      <tbody>${models.map((m) => `
        <tr>
          <td><strong>${PW.escapeHtml(m.name)}</strong> ${m.keyless || m.free ? '<span class="badge badge-free">free</span>' : ''}</td>
          <td>${PW.escapeHtml(PWAI.KINDS[m.kind]?.label || m.kind).split(' (')[0]}</td>
          <td style="font-family:monospace;font-size:12px">${PW.escapeHtml(m.modelId || '—')}</td>
          <td>${m.apiKey ? '<span class="badge badge-key">saved</span>' : m.keyless || m.free ? '<span class="badge badge-free">none needed</span>' : '<span class="badge badge-off">none</span>'}</td>
          <td style="white-space:nowrap">
            <button class="icon-btn" data-edit="${m.id}" aria-label="Edit ${PW.escapeHtml(m.name)}"><i data-lucide="pencil"></i></button>
            <button class="icon-btn" data-del="${m.id}" aria-label="Delete ${PW.escapeHtml(m.name)}"><i data-lucide="trash-2"></i></button>
          </td>
        </tr>`).join('')}
      </tbody></table></div>`;
    lucide.createIcons();

    savedList.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
      const m = PW.data.models.find((x) => x.id === b.dataset.edit);
      if (!m) return;
      document.getElementById('f-id').value = m.id;
      document.getElementById('f-name').value = m.name;
      document.getElementById('f-kind').value = m.kind;
      document.getElementById('f-modelid').value = m.modelId || '';
      document.getElementById('f-baseurl').value = m.baseUrl || '';
      document.getElementById('f-apikey').value = m.apiKey || '';
      document.getElementById('f-proxy').value = m.proxyUrl || '';
      document.getElementById('f-save').innerHTML = '<i data-lucide="check"></i>Update model';
      lucide.createIcons();
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }));
    savedList.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const m = PW.data.models.find((x) => x.id === b.dataset.del);
      if (!m) return;
      const used = PW.data.agents.filter((a) => a.modelKey === 'custom:' + m.id);
      const msg = used.length
        ? `${m.name} is used by ${used.length} cube${used.length > 1 ? 's' : ''}. Delete anyway?`
        : `Delete ${m.name}?`;
      const ok = await PW.confirm(msg);
      if (!ok) return;
      PW.data.models = PW.data.models.filter((x) => x.id !== m.id);
      PW.save();
      renderSaved();
      PW.toast('Deleted');
    }));
  }
  renderSaved();

  /* ---------------- Provider directory ---------------- */
  const DIRECTORY = [
    ['Pollinations.ai', 'Completely free, no key, no account. Live model list fetched above.', 'No'],
    ['OVHcloud AI Endpoints', 'EU-hosted open models, anonymous tier, no key. ~2 requests/min per model.', 'No'],
    ['LLM7.io', 'Turbo models work anonymously (~60 requests/hour). Can be busy at peak times.', 'No'],
    ['AI Horde', 'Community-powered. Anonymous key 0000000000. Can be slow.', 'No'],
    ['Puter.js', 'Browser SDK; a free Puter account covers usage on first chat.', 'No (free account)'],
    ['BlockRun.ai', 'Keyless NVIDIA-hosted models — works, but needs a CORS proxy in the browser.', 'No (proxy)'],
    ['Kilo Gateway', 'Free routes like reflection/beam-free (~200 requests/hour) — needs a CORS proxy.', 'No (proxy)'],
    ['Hack Club AI', 'Every OpenRouter model behind one key — free for Hack Clubbers.', 'Free key'],
    ['Groq', 'Free plan: fast open models, ~1k requests/day.', 'Free key'],
    ['Google Gemini', 'Free tier on Flash models, generous limits.', 'Free key'],
    ['OpenRouter', '17+ models tagged :free — 50 requests/day.', 'Free key'],
    ['Mistral', 'Free mode on their API, no credit card.', 'Free key'],
    ['Cohere', 'Trial key: 1,000 calls/month.', 'Free key'],
    ['SambaNova', 'Free tier: 20 requests/day per model.', 'Free key'],
    ['Cerebras', 'Free tier: 1M tokens/day, ultra fast.', 'Free key'],
    ['Cloudflare Workers AI', '10,000 neurons/day free.', 'Free key'],
    ['NVIDIA API catalog', 'Free prototyping endpoints for many models.', 'Free key'],
    ['Z.ai (GLM)', 'Free tier on GLM flash models.', 'Free key'],
    ['free.ai', '30,000 tokens/day free pool — needs a free signup.', 'Free key'],
    ['Hetzner Inference', 'Experimental free Qwen endpoints (EU).', 'Free account'],
    ['Together AI', '$5 free credit on signup.', 'Free key'],
    ['DeepSeek', 'Very cheap, occasional free promos.', 'Paid'],
  ];
  const dir = document.getElementById('dir-body');
  dir.innerHTML = DIRECTORY.map(([name, how, key]) => `
    <tr><td><strong>${name}</strong></td><td>${how}</td><td><span class="badge ${key === 'No' ? 'badge-free' : key === 'Paid' ? 'badge-off' : 'badge-key'}">${key}</span></td></tr>`).join('');
})();
