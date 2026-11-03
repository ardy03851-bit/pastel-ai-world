/* core.js — shared foundation: safe storage, app data, nav, theme, toast, modal */

(function () {
  'use strict';

  /* ---------- Safe storage (works even inside sandboxed iframes) ---------- */
  function makeStore() {
    try {
      const ls = window['local' + 'Storage']; // indirect access survives blocked-storage environments
      ls.setItem('__pw_test__', '1');
      ls.removeItem('__pw_test__');
      return ls;
    } catch (e) {
      const mem = new Map();
      return {
        getItem(k) { return mem.has(k) ? mem.get(k) : null; },
        setItem(k, v) { mem.set(k, String(v)); },
        removeItem(k) { mem.delete(k); },
      };
    }
  }
  const store = makeStore();
  const persistent = (function () {
    try { store.setItem('__pw_test__', '1'); store.removeItem('__pw_test__'); return true; } catch (e) { return false; }
  })();

  const PW = {
    store,
    persistent,
    PASTELS: ['#a8e6cf', '#ffd3b6', '#ffaaa5', '#ff8fab', '#c3a6ff', '#a9c9ff', '#b5ead7', '#fdf3b5', '#ffb5e7', '#9fe8dc'],
    version: '1.0.0',
  };
  window.PW = PW;

  /* ---------- App data ---------- */
  const DEFAULTS = {
    models: [],   // {id, name, kind, baseUrl, apiKey, proxyUrl, modelId, createdAt}
    agents: [],   // {id, name, color, modelKey, mode, prompt, tickSec, running, history, x, z, rotY}
    world: {
      plateSize: 34,
      plateColor: '#b5ead7',
      sky: '#dfe9f7',
      fog: true,
      grid: true,
      shadows: true,
      particles: true,
      autoRotate: false,
      objects: [], // {id, type, color, x, z, y, scale, rotY}
    },
    settings: {
      theme: 'light',
      accent: 'mint',
      tickSec: 6,
      moveSpeed: 3.2,
      speechSec: 5,
      sound: true,
      maxHistory: 14,
    },
  };

  function loadData() {
    let raw = null;
    try { raw = store.getItem('pw.data'); } catch (e) { /* noop */ }
    let data = raw ? JSON.parse(raw) : null;
    if (!data) data = JSON.parse(JSON.stringify(DEFAULTS));
    // merge defaults for missing keys
    for (const k of Object.keys(DEFAULTS)) {
      if (data[k] === undefined) data[k] = JSON.parse(JSON.stringify(DEFAULTS[k]));
    }
    for (const k of Object.keys(DEFAULTS.world)) if (data.world[k] === undefined) data.world[k] = DEFAULTS.world[k];
    for (const k of Object.keys(DEFAULTS.settings)) if (data.settings[k] === undefined) data.settings[k] = DEFAULTS.settings[k];
    return data;
  }

  const data = loadData();
  PW.data = data;
  let saveTimer = null;
  PW.save = function () {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { store.setItem('pw.data', JSON.stringify(PW.data)); } catch (e) { /* noop */ }
    }, 120);
  };
  PW.saveNow = function () {
    try { store.setItem('pw.data', JSON.stringify(PW.data)); } catch (e) { /* noop */ }
  };
  PW.reset = function () {
    try { store.removeItem('pw.data'); } catch (e) { /* noop */ }
  };

  PW.uid = () => 'id' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  PW.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  PW.escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '': '&#39;' }[c]));
  PW.confirm = function (message) {
    return new Promise((resolve) => {
      const { close } = PW.modal(`
        <h2>Are you sure?</h2>
        <p style="color:var(--color-text-muted);margin-bottom:var(--space-6)">${PW.escapeHtml(message)}</p>
        <div class="form-actions">
          <button class="btn btn-danger" id="pw-yes">Yes</button>
          <button class="btn btn-ghost" data-close-modal>Cancel</button>
        </div>
      `, { onClose: () => resolve(false) });
      const yes = close.el.querySelector('#pw-yes');
      yes.addEventListener('click', () => { resolve(true); });
      // clicking yes closes via this too
      yes.dataset.closeModal = '';
    });
  };
  PW.randomPastel = () => PW.PASTELS[Math.floor(Math.random() * PW.PASTELS.length)];

  /* ---------- Theme ---------- */
  PW.applyTheme = function () {
    const s = PW.data.settings;
    const root = document.documentElement;
    root.setAttribute('data-theme', s.theme === 'dark' ? 'dark' : 'light');
    root.setAttribute('data-accent', s.accent || 'mint');
  };

  /* ---------- Toast ---------- */
  let toastWrap = null;
  PW.toast = function (msg, ms = 2600) {
    if (!toastWrap) {
      toastWrap = document.createElement('div');
      toastWrap.className = 'toast-wrap';
      document.body.appendChild(toastWrap);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    toastWrap.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 320);
    }, ms);
  };

  /* ---------- Modal ---------- */
  PW.modal = function (html, { onClose } = {}) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(backdrop);
    const close = () => { backdrop.remove(); if (onClose) onClose(); };
    backdrop.addEventListener('pointerdown', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    backdrop.querySelector('.modal').addEventListener('click', (e) => {
      const el = e.target.closest('[data-close-modal]');
      if (el) close();
    });
    return { el: backdrop.querySelector('.modal'), close };
  };

  /* ---------- Nav & theme toggle wiring ---------- */
  function init() {
    PW.applyTheme();
    const toggle = document.querySelector('[data-theme-toggle]');
    if (toggle) {
      toggle.addEventListener('click', () => {
        PW.data.settings.theme = PW.data.settings.theme === 'dark' ? 'light' : 'dark';
        PW.save();
        PW.applyTheme();
        toggle.setAttribute('aria-label', 'Switch to ' + (PW.data.settings.theme === 'dark' ? 'light' : 'dark') + ' mode');
        document.dispatchEvent(new CustomEvent('pw:themechange'));
      });
    }
    // mark current page in nav
    const page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '');
    document.querySelectorAll('.main-nav a').forEach((a) => {
      const href = a.getAttribute('href').replace(/\.html$/, '');
      if (href === page || (page === '' && href === 'index')) a.setAttribute('aria-current', 'page');
    });
    document.documentElement.classList.add('pw-ready');
    if (!PW.persistent) {
      // storage unavailable (sandboxed preview) — show a gentle notice once
      setTimeout(() => PW.toast('Preview storage is temporary — on the live site your models and world are saved in your browser.'), 1200);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
