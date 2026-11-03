/* settings.js — bind every setting to app data, live */

(function () {
  'use strict';
  const w = PW.data.world;
  const s = PW.data.settings;

  const $ = (id) => document.getElementById(id);

  function bindRange(id, out, get, set, fmt = (v) => v) {
    const el = $(id);
    el.value = get();
    $(out).textContent = fmt(get());
    el.addEventListener('input', () => {
      set(Number(el.value));
      $(out).textContent = fmt(Number(el.value));
      PW.save();
    });
  }
  function bindCheck(id, get, set) {
    const el = $(id);
    el.checked = get();
    el.addEventListener('change', () => { set(el.checked); PW.save(); });
  }

  /* Baseplate */
  bindRange('s-plate-size', 'o-plate-size', () => w.plateSize, (v) => { w.plateSize = v; }, (v) => v);
  const colorBind = (id, get, set) => {
    const el = $(id);
    el.value = get();
    el.addEventListener('input', () => { set(el.value); PW.save(); });
  };
  colorBind('s-plate-color', () => w.plateColor, (v) => { w.plateColor = v; });
  colorBind('s-sky', () => w.sky, (v) => { w.sky = v; });
  bindCheck('s-grid', () => w.grid, (v) => { w.grid = v; });
  bindCheck('s-fog', () => w.fog, (v) => { w.fog = v; });
  bindCheck('s-shadows', () => w.shadows, (v) => { w.shadows = v; });
  bindCheck('s-particles', () => w.particles, (v) => { w.particles = v; });
  bindCheck('s-autorotate', () => w.autoRotate, (v) => { w.autoRotate = v; });

  /* AI cubes */
  bindRange('s-tick', 'o-tick', () => s.tickSec, (v) => { s.tickSec = v; });
  bindRange('s-speed', 'o-speed', () => s.moveSpeed, (v) => { s.moveSpeed = v; }, (v) => v.toFixed(1));
  bindRange('s-speech', 'o-speech', () => s.speechSec, (v) => { s.speechSec = v; });
  bindRange('s-history', 'o-history', () => s.maxHistory, (v) => { s.maxHistory = v; });

  /* Appearance */
  function bindSeg(id, get, set) {
    const seg = $(id);
    seg.querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.val === get()));
      b.addEventListener('click', () => {
        set(b.dataset.val);
        seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        PW.save();
        PW.applyTheme();
      });
    });
  }
  bindSeg('seg-theme', () => s.theme, (v) => { s.theme = v; });
  bindSeg('seg-accent', () => s.accent, (v) => { s.accent = v; });

  /* Data */
  $('btn-export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(PW.data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pastel-world-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('btn-import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== 'object') throw new Error('bad file');
        PW.data.models = parsed.models || [];
        PW.data.agents = parsed.agents || [];
        PW.data.world = { ...PW.data.world, ...(parsed.world || {}) };
        PW.data.settings = { ...PW.data.settings, ...(parsed.settings || {}) };
        PW.saveNow();
        PW.applyTheme();
        PW.toast('Imported — reload the world to see it');
      } catch (err) {
        PW.toast('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('btn-reset').addEventListener('click', async () => {
    const ok = await PW.confirm('Delete all models, cubes and world objects? This cannot be undone.');
    if (!ok) return;
    PW.reset();
    location.reload();
  });

  const note = document.createElement('p');
  note.className = 'card-sub';
  note.style.marginTop = 'var(--space-4)';
  note.textContent = 'World changes (baseplate size, sky, shadows…) apply when you open or reload the World page.';
  document.querySelector('.card .field:last-child')?.closest('.card')?.appendChild(note);
})();
