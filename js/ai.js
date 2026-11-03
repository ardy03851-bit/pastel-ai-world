/* ai.js — model registry, provider clients, free keyless model discovery */

(function () {
  'use strict';
  const AI = {};

  /* ---------------- Provider kinds ---------------- */
  const KINDS = {
    openai: { label: 'OpenAI-compatible (works with most providers)', baseUrl: '' },
    gemini: { label: 'Google Gemini (native)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
    anthropic: { label: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com/v1' },
    pollinations: { label: 'Pollinations.ai (free, no key)', baseUrl: 'https://text.pollinations.ai' },
    puter: { label: 'Puter.js (free browser SDK)', baseUrl: '' },
    horde: { label: 'AI Horde (free, community)', baseUrl: 'https://aihorde.net/api/v2' },
    ovh: { label: 'OVHcloud AI Endpoints (free, no key)', baseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1' },
    llm7: { label: 'LLM7.io (free, no key)', baseUrl: 'https://api.llm7.io/v1' },
  };
  AI.KINDS = KINDS;

  /* Presets for well-known providers (user supplies their own API key) */
  AI.PRESETS = [
    { name: 'Start blank (any provider)', kind: 'openai', baseUrl: '', modelId: '' },
    { name: 'Groq (free tier)', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1', modelId: 'llama-3.3-70b-versatile' },
    { name: 'Google Gemini (free tier)', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', modelId: 'gemini-2.0-flash' },
    { name: 'OpenRouter (free models)', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', modelId: 'meta-llama/llama-3.3-70b-instruct:free' },
    { name: 'Mistral (free mode)', kind: 'openai', baseUrl: 'https://api.mistral.ai/v1', modelId: 'mistral-small-latest' },
    { name: 'Cohere (trial key)', kind: 'openai', baseUrl: 'https://api.cohere.ai/compatibility/v1', modelId: 'command-r7b-12-2024' },
    { name: 'SambaNova (free tier)', kind: 'openai', baseUrl: 'https://api.sambanova.ai/v1', modelId: 'Meta-Llama-3.1-8B-Instruct' },
    { name: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1', modelId: 'deepseek-chat' },
    { name: 'Hetzner Inference (experimental)', kind: 'openai', baseUrl: 'https://inference.hetzner.com/api/v1', modelId: 'Qwen/Qwen3.6-35B-A3B-FP8' },
    { name: 'NVIDIA API catalog', kind: 'openai', baseUrl: 'https://integrate.api.nvidia.com/v1', modelId: 'meta/llama-3.1-8b-instruct' },
    { name: 'Together AI', kind: 'openai', baseUrl: 'https://api.together.xyz/v1', modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free' },
    { name: 'Cerebras (free tier)', kind: 'openai', baseUrl: 'https://api.cerebras.ai/v1', modelId: 'llama-3.3-70b' },
    { name: 'SambaNova 2', kind: 'openai', baseUrl: 'https://api.sambanova.ai/v1', modelId: 'Llama-4-Maverick-17B-128E-Instruct' },
    { name: 'Hugging Face Router', kind: 'openai', baseUrl: 'https://router.huggingface.co/v1', modelId: 'meta-llama/Llama-3.3-70B-Instruct' },
    { name: 'OVHcloud AI (keyless)', kind: 'ovh', baseUrl: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', modelId: 'Qwen3.6-27B' },
    { name: 'LLM7.io (keyless)', kind: 'llm7', baseUrl: 'https://api.llm7.io/v1', modelId: 'GLM-5.3-Flash' },
    { name: 'BlockRun.ai (needs proxy)', kind: 'openai', baseUrl: 'https://blockrun.ai/api/v1', modelId: 'llama-3.2-11b-vision' },
    { name: 'Kilo Gateway free (needs proxy)', kind: 'openai', baseUrl: 'https://api.kilo.ai/api/gateway', modelId: 'reflection/beam-free' },
    { name: 'Z.ai GLM (free tier)', kind: 'openai', baseUrl: 'https://api.z.ai/api/paas/v4', modelId: 'glm-4-flash' },
  ];

  /* ---------------- Proxy URL handling ----------------
     Supports three common proxy styles:
       https://proxy.example/?url={url}   (placeholder)
       https://proxy.example/?url=        (append encoded)
       https://proxy.example/             (prefix, raw url appended) */
  AI.applyProxy = function (url, proxy) {
    if (!proxy) return url;
    const p = proxy.trim();
    if (!p) return url;
    if (p.includes('{url}')) return p.replace('{url}', encodeURIComponent(url));
    if (/[?&](url|target)=$/.test(p)) return p + encodeURIComponent(url);
    return p.replace(/\/?$/, '/') + url.replace(/^https?:\/\//, '');
  };

  /* ---------------- HTTP helpers ---------------- */
  async function httpJson(url, opts, timeoutMs = 45000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch (e) { /* plain text */ }
      if (!res.ok) {
        const detail = (json && (json.error?.message || json.message)) || text.slice(0, 200) || res.statusText;
        throw new Error(`HTTP ${res.status} — ${detail}`);
      }
      return { json, text, res };
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------------- Chat clients ---------------- */
  AI.chat = async function (model, messages, opts = {}) {
    const kind = model.kind;
    if (kind === 'pollinations') return chatPollinations(model, messages, opts);
    if (kind === 'puter') return chatPuter(model, messages, opts);
    if (kind === 'horde') return chatHorde(model, messages, opts);
    if (kind === 'gemini') return chatGemini(model, messages, opts);
    if (kind === 'anthropic') return chatAnthropic(model, messages, opts);
    return chatOpenAI(model, messages, opts);
  };

  async function chatOpenAI(model, messages, opts) {
    const base = (model.baseUrl || KINDS[model.kind]?.baseUrl || '').replace(/\/$/, '');
    if (!base) throw new Error('Missing API base URL');
    const url = AI.applyProxy(base + '/chat/completions', model.proxyUrl);
    const headers = { 'Content-Type': 'application/json' };
    const key = model.apiKey || KINDS[model.kind]?.defaultKey || '';
    if (key) headers.Authorization = 'Bearer ' + key;
    const body = {
      model: model.modelId,
      messages,
      temperature: opts.temperature ?? 0.8,
      max_tokens: opts.maxTokens ?? 500,
    };
    const { json } = await httpJson(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const message = json?.choices?.[0]?.message;
    /* Reasoning models (gpt-oss, Qwen3, DeepSeek-R1…) can leave content empty
       and put text in reasoning fields — fall back so the cube still gets a reply. */
    const msg = message?.content
      || (Array.isArray(message?.reasoning_content) ? message.reasoning_content.join('') : message?.reasoning_content)
      || (Array.isArray(message?.reasoning) ? message.reasoning.join('') : message?.reasoning);
    if (!msg) throw new Error('Empty response from provider');
    return typeof msg === 'string' ? msg : JSON.stringify(msg);
  }

  async function chatGemini(model, messages, opts) {
    const base = (model.baseUrl || KINDS.gemini.baseUrl).replace(/\/$/, '');
    const url = AI.applyProxy(`${base}/models/${encodeURIComponent(model.modelId)}:generateContent`, model.proxyUrl);
    const headers = { 'Content-Type': 'application/json' };
    if (model.apiKey) headers['x-goog-api-key'] = model.apiKey;
    const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const body = {
      contents,
      generationConfig: { temperature: opts.temperature ?? 0.8, maxOutputTokens: opts.maxTokens ?? 500 },
    };
    if (sys) body.systemInstruction = { parts: [{ text: sys }] };
    const { json } = await httpJson(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const parts = json?.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error('Empty response from Gemini');
    return parts.map((p) => p.text || '').join('');
  }

  async function chatAnthropic(model, messages, opts) {
    const base = (model.baseUrl || KINDS.anthropic.baseUrl).replace(/\/$/, '');
    const url = AI.applyProxy(base + '/messages', model.proxyUrl);
    const headers = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    if (model.apiKey) headers['x-api-key'] = model.apiKey;
    const sys = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
    const body = {
      model: model.modelId,
      max_tokens: opts.maxTokens ?? 500,
      temperature: opts.temperature ?? 0.8,
      messages: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content })),
    };
    if (sys) body.system = sys;
    const { json } = await httpJson(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const txt = json?.content?.map((c) => c.text || '').join('');
    if (!txt) throw new Error('Empty response from Anthropic');
    return txt;
  }

  async function chatPollinations(model, messages, opts) {
    const base = (model.baseUrl || KINDS.pollinations.baseUrl).replace(/\/$/, '');
    const url = AI.applyProxy(base + '/', model.proxyUrl);
    const { text } = await httpJson(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model: model.modelId, temperature: opts.temperature ?? 0.8 }),
    }, 60000);
    return text;
  }

  let puterLoading = null;
  function loadPuter() {
    if (window.puter) return Promise.resolve();
    if (puterLoading) return puterLoading;
    puterLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://js.puter.com/v2/';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load Puter.js'));
      document.head.appendChild(s);
    });
    return puterLoading;
  }

  async function chatPuter(model, messages) {
    await loadPuter();
    // Puter uses "user"/"assistant" roles like OpenAI; system becomes part of first user turn
    const msgs = messages.map((m) => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content }));
    const resp = await window.puter.ai.chat(msgs, { model: model.modelId });
    if (typeof resp === 'string') return resp;
    if (resp?.message?.content) {
      const c = resp.message.content;
      return typeof c === 'string' ? c : c.map((p) => p.text || '').join('');
    }
    return JSON.stringify(resp);
  }

  async function chatHorde(model, messages, opts) {
    const base = (model.baseUrl || KINDS.horde.baseUrl).replace(/\/$/, '');
    const headers = { 'Content-Type': 'application/json', apikey: model.apiKey || '0000000000' };
    const prompt = messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n') + '\n\nASSISTANT (reply with only valid JSON):';
    const submit = await httpJson(AI.applyProxy(base + '/generate/text/async', model.proxyUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, models: [model.modelId], max_new_tokens: opts.maxTokens ?? 400 }),
    }, 30000);
    const id = submit.json?.id;
    if (!id) throw new Error('AI Horde rejected the request');
    // poll until done (community service — can be slow)
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const st = await httpJson(AI.applyProxy(`${base}/generate/text/status/${id}`, model.proxyUrl), {}, 20000);
      const j = st.json;
      if (!j || j.error) throw new Error(j?.error?.message || 'Horde status error');
      if (j.done) {
        const gen = j.generations?.[0]?.text;
        if (!gen) throw new Error('Empty generation from AI Horde');
        return gen;
      }
    }
    throw new Error('AI Horde timed out (community queue is busy)');
  }

  /* ---------------- Free model discovery ---------------- */
  AI.fetchFreeModels = async function () {
    const results = { pollinations: [], horde: [], puter: [], ovh: [], llm7: [], errors: [] };

    // Pollinations — live model list, keyless
    try {
      const { json } = await httpJson('https://text.pollinations.ai/models', {}, 15000);
      const list = Array.isArray(json) ? json : [];
      results.pollinations = list
        .filter((m) => m && m.name)
        .map((m) => ({
          id: m.name,
          name: m.name,
          kind: 'pollinations',
          description: m.description || '',
          free: true,
          keyless: true,
          aliases: m.aliases || [],
        }));
    } catch (e) {
      results.errors.push('Pollinations: ' + e.message);
    }

    // AI Horde — community text models (may be empty)
    try {
      const { json } = await httpJson('https://aihorde.net/api/v2/status/models/text', {}, 15000);
      const list = Array.isArray(json) ? json : [];
      results.horde = list
        .filter((m) => m && m.name && (m.count ?? 1) > 0)
        .slice(0, 30)
        .map((m) => ({
          id: m.name,
          name: m.name,
          kind: 'horde',
          description: `${m.count ?? '?'} active worker${(m.count ?? 1) === 1 ? '' : 's'} · community-powered, can be slow`,
          free: true,
          keyless: true,
        }));
    } catch (e) {
      results.errors.push('AI Horde: ' + e.message);
    }

    // Puter — list models via SDK (may prompt sign-in on first use)
    try {
      await loadPuter();
      let models = [];
      try {
        const listed = await window.puter.ai.listModels();
        if (Array.isArray(listed)) models = listed;
        else if (listed && typeof listed === 'object') {
          for (const prov of Object.keys(listed)) {
            for (const m of listed[prov]) models.push({ id: typeof m === 'string' ? m : m.id, provider: prov });
          }
        }
      } catch (e) { /* listModels may be unavailable */ }
      if (models.length) {
        results.puter = models.slice(0, 60).map((m) => ({
          id: typeof m === 'string' ? m : m.id,
          name: typeof m === 'string' ? m : m.id,
          kind: 'puter',
          description: 'via Puter.js — free account handles usage' + (m.provider ? ` (${m.provider})` : ''),
          free: true,
          keyless: true,
        }));
      } else {
        results.puter = [
          { id: 'gpt-5-nano', name: 'gpt-5-nano', kind: 'puter', description: 'via Puter.js — free account handles usage', free: true, keyless: true },
          { id: 'claude-sonnet-4-5', name: 'claude-sonnet-4-5', kind: 'puter', description: 'via Puter.js — free account handles usage', free: true, keyless: true },
          { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash', kind: 'puter', description: 'via Puter.js — free account handles usage', free: true, keyless: true },
        ];
      }
    } catch (e) {
      results.errors.push('Puter: ' + e.message);
    }

    // OVHcloud AI Endpoints — EU-hosted open models, anonymous tier, no key
    try {
      const { json } = await httpJson('https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/models', {}, 15000);
      const list = Array.isArray(json?.data) ? json.data : [];
      results.ovh = list
        .filter((m) => m && m.id)
        .slice(0, 20)
        .map((m) => ({
          id: m.id,
          name: m.id,
          kind: 'ovh',
          description: `EU-hosted · anonymous tier (~2 requests/min per model${m.context_length ? `, ${Math.round(m.context_length / 1000)}K context` : ''})`,
          free: true,
          keyless: true,
        }));
    } catch (e) {
      results.errors.push('OVHcloud: ' + e.message);
    }

    // LLM7 — turbo-tier models work anonymously (no auth header; CORS blocks it)
    try {
      const { json } = await httpJson('https://api.llm7.io/v1/models', {}, 15000);
      const list = Array.isArray(json?.data) ? json.data : [];
      results.llm7 = list
        .filter((m) => m && m.id && m.tier === 'turbo')
        .map((m) => ({
          id: m.id,
          name: m.id,
          kind: 'llm7',
          description: `Anonymous tier (~60 requests/hour${m.context_window?.tokens ? `, ${Math.round(m.context_window.tokens / 1000)}K context` : ''}) · can be busy at peak times`,
          free: true,
          keyless: true,
        }));
    } catch (e) {
      results.errors.push('LLM7: ' + e.message);
    }

    return results;
  };

  /* ---------------- Model registry (resolution for agents) ---------------- */
  // modelKey formats: "free:<kind>:<id>" or "custom:<id>"
  AI.resolve = function (modelKey) {
    if (!modelKey) return null;
    if (modelKey.startsWith('free:')) {
      const rest = modelKey.slice(5);
      const idx = rest.indexOf(':');
      const kind = rest.slice(0, idx);
      const id = rest.slice(idx + 1);
      return { id, name: id, kind, modelId: id, free: true };
    }
    if (modelKey.startsWith('custom:')) {
      const m = (PW.data.models || []).find((x) => x.id === modelKey.slice(7));
      return m || null;
    }
    return null;
  };

  AI.test = async function (model) {
    const t0 = performance.now();
    const reply = await AI.chat(model, [
      { role: 'system', content: 'You are a connection test. Reply with exactly: OK' },
      { role: 'user', content: 'Reply with exactly: OK' },
    ], { maxTokens: 20, temperature: 0 });
    const ms = Math.round(performance.now() - t0);
    return { ok: true, reply: String(reply).trim().slice(0, 60), ms };
  };

  window.PWAI = AI;
})();
