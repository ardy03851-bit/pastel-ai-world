/* world.js — the 3D pastel world: scene, entities, AI control loop, inspector */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/* ================================================================
   Scene setup
   ================================================================ */
const stage = document.getElementById('stage');
const W = PW.data.world;
const S = PW.data.settings;

const scene = new THREE.Scene();
scene.background = new THREE.Color(W.sky);
scene.fog = W.fog ? new THREE.Fog(W.sky, 26, 90) : null;

const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 400);
camera.position.set(18, 16, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = W.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
stage.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.inset = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
stage.appendChild(labelRenderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 6;
controls.maxDistance = 90;
controls.target.set(0, 1, 0);
controls.autoRotate = W.autoRotate;
controls.autoRotateSpeed = 0.7;
controls.saveState();

/* Lights */
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
scene.add(new THREE.HemisphereLight(0xfff6e5, 0xcdeed9, 0.75));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
sun.position.set(24, 34, 16);
sun.castShadow = W.shadows;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0004;
scene.add(sun);

/* Baseplate */
const plate = new THREE.Mesh(
  new RoundedBoxGeometry(W.plateSize, 1.4, W.plateSize, 4, 0.45),
  new THREE.MeshStandardMaterial({ color: W.plateColor, roughness: 0.85 })
);
plate.position.y = -0.71;
plate.receiveShadow = true;
plate.name = 'plate';
scene.add(plate);

let grid = null;
function buildGrid() {
  if (grid) scene.remove(grid);
  grid = new THREE.GridHelper(W.plateSize, Math.round(W.plateSize / 2), 0xffffff, 0xffffff);
  grid.material.transparent = true;
  grid.material.opacity = 0.18;
  grid.position.y = 0.02;
  grid.visible = W.grid;
  scene.add(grid);
}
buildGrid();

/* Pastel particles */
let particles = null;
function buildParticles() {
  if (particles) scene.remove(particles);
  if (!W.particles) return;
  const N = 260;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * W.plateSize * 1.6;
    pos[i * 3 + 1] = Math.random() * 16 + 0.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * W.plateSize * 1.6;
    c.set(PW.PASTELS[i % PW.PASTELS.length]);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  particles = new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.14, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false,
  }));
  scene.add(particles);
}
buildParticles();

/* Selection ring */
const selRing = new THREE.Mesh(
  new THREE.RingGeometry(0.95, 1.1, 40),
  new THREE.MeshBasicMaterial({ color: 0x6bb8a9, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
);
selRing.rotation.x = -Math.PI / 2;
selRing.visible = false;
scene.add(selRing);

/* ================================================================
   Entity builders
   ================================================================ */
function std(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
}
function shadowify(g) {
  g.traverse((m) => { if (m.isMesh) { m.castShadow = W.shadows; } });
  return g;
}

const BUILDERS = {
  tree(color) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.1, 8), std('#c9a27c'));
    trunk.position.y = 0.55;
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.5, 9), std(color));
    c1.userData.primary = true;
    c1.position.y = 1.7;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.78, 1.25, 9), std(color, { roughness: 0.65 }));
    c2.userData.primary = true;
    c2.position.y = 2.5;
    g.add(trunk, c1, c2);
    return shadowify(g);
  },
  rock(color) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), std(color, { roughness: 1, flatShading: true }));
    m.userData.primary = true;
    m.scale.set(1.25, 0.75, 1.1);
    m.position.y = 0.32;
    const g = new THREE.Group(); g.add(m);
    return shadowify(g);
  },
  ball(color) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 18), std(color));
    m.userData.primary = true;
    m.position.y = 0.45;
    const g = new THREE.Group(); g.add(m);
    return shadowify(g);
  },
  lamp(color) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.7, 10), std(color));
    post.userData.primary = true;
    post.position.y = 0.85;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 18, 14), std('#ffe9a8', { emissive: '#ffd770', emissiveIntensity: 1.2 }));
    bulb.position.y = 1.8;
    const light = new THREE.PointLight(0xffe2a0, 8, 9, 2);
    light.position.y = 1.8;
    g.add(post, bulb, light);
    return shadowify(g);
  },
  pillar(color) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.85, 2.6, 0.85, 3, 0.18), std(color));
    m.userData.primary = true;
    m.position.y = 1.3;
    const g = new THREE.Group(); g.add(m);
    return shadowify(g);
  },
  ring(color) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.16, 14, 36), std(color));
    m.userData.primary = true;
    m.position.y = 1.05;
    const g = new THREE.Group(); g.add(m);
    return shadowify(g);
  },
  flower(color) {
    const g = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.9, 7), std('#9fd6ae'));
    stem.position.y = 0.45;
    g.add(stem);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), std('#fdf3b5'));
    center.position.y = 0.95;
    g.add(center);
    for (let i = 0; i < 6; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 9), std(color));
      p.userData.primary = true;
      const a = (i / 6) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.28, 0.95, Math.sin(a) * 0.28);
      g.add(p);
    }
    return shadowify(g);
  },
  star(color) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), std(color, { emissive: color, emissiveIntensity: 0.35, flatShading: true }));
    m.userData.primary = true;
    m.position.y = 1.35;
    const g = new THREE.Group(); g.add(m);
    return shadowify(g);
  },
  house(color) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.1, 1.3, 3, 0.06), std(color));
    walls.userData.primary = true;
    walls.position.y = 0.55;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.85, 4), std('#e8a3a0'));
    roof.userData.primary = true;
    roof.position.y = 1.52;
    roof.rotation.y = Math.PI / 4;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.55, 0.06), std('#b98a63'));
    door.position.set(0, 0.28, 0.68);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.45, 0.22), std('#d9cfc4'));
    chimney.position.set(0.45, 1.7, 0.35);
    g.add(walls, roof, door, chimney);
    return shadowify(g);
  },
  cloud(color) {
    const g = new THREE.Group();
    const mat = std(color, { roughness: 0.9, transparent: true, opacity: 0.92 });
    const puffs = [
      [0, 1.9, 0, 0.52],
      [0.55, 1.78, 0.1, 0.38],
      [-0.55, 1.8, -0.08, 0.36],
      [0.18, 2.1, -0.15, 0.34],
    ];
    for (const [px, py, pz, r] of puffs) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
      p.userData.primary = true;
      p.position.set(px, py, pz);
      g.add(p);
    }
    return shadowify(g);
  },
  crystal(color) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), std(color, { roughness: 0.15, transparent: true, opacity: 0.85, emissive: color, emissiveIntensity: 0.25, flatShading: true }));
    m.userData.primary = true;
    m.position.y = 0.75;
    m.scale.y = 1.6;
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.26, 0), std(color, { roughness: 0.15, transparent: true, opacity: 0.8 }));
    shard.userData.primary = true;
    shard.position.set(0.42, 0.4, 0.18);
    shard.scale.y = 1.3;
    g.add(m, shard);
    return shadowify(g);
  },
  pond(color) {
    const g = new THREE.Group();
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.1, 28), std(color, { roughness: 0.08, transparent: true, opacity: 0.75 }));
    water.userData.primary = true;
    water.position.y = 0.06;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.09, 10, 28), std('#c9b8a4'));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.08;
    g.add(water, rim);
    return g;
  },
  bush(color) {
    const g = new THREE.Group();
    const mat = std(color, { roughness: 0.85 });
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.42, 14, 11), mat);
    b1.userData.primary = true;
    b1.position.set(-0.22, 0.36, 0);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 11), mat);
    b2.userData.primary = true;
    b2.position.set(0.24, 0.28, 0.12);
    const b3 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 11), mat);
    b3.userData.primary = true;
    b3.position.set(0.05, 0.5, -0.18);
    g.add(b1, b2, b3);
    return shadowify(g);
  },
  bench(color) {
    const g = new THREE.Group();
    const wood = std('#c9a27c');
    const seat = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.12, 0.5, 2, 0.05), std(color));
    seat.userData.primary = true;
    seat.position.y = 0.62;
    const back = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.5, 0.12, 2, 0.05), std(color, { roughness: 0.7 }));
    back.userData.primary = true;
    back.position.set(0, 0.92, -0.24);
    const l1 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.62, 8), wood);
    l1.position.set(-0.55, 0.31, 0);
    const l2 = l1.clone();
    l2.position.x = 0.55;
    g.add(seat, back, l1, l2);
    return shadowify(g);
  },
  arch(color) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.14, 12, 32, Math.PI), std(color));
    m.userData.primary = true;
    m.position.y = 0.02;
    g.add(m);
    return shadowify(g);
  },
};

/* Agent cube — rounded */
function buildAgentMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(1.15, 1.15, 1.15, 6, 0.12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
  );
  body.position.y = 0.62;
  body.castShadow = W.shadows;
  body.receiveShadow = W.shadows;
  g.add(body);
  return g;
}

/* ================================================================
   Entity registry (meshes ↔ data)
   ================================================================ */
const entities = new Map(); // id -> {mesh, tag?, speechEl?, kind, data, anim}

function plateBounds() { return W.plateSize / 2 - 0.9; }

function makeLabel(agent) {
  const wrap = document.createElement('div');
  wrap.className = 'label-wrap';
  const tag = document.createElement('div');
  tag.className = 'cube-tag';
  tag.textContent = agent.name;
  const speech = document.createElement('div');
  speech.className = 'cube-speech';
  wrap.append(tag, speech);
  const obj = new CSS2DObject(wrap);
  obj.position.set(0, 1.9, 0);
  return { obj, tag, speech };
}

function spawnAgent(agent, { select = false } = {}) {
  const mesh = buildAgentMesh(agent.color);
  mesh.position.set(agent.x, 0, agent.z);
  mesh.rotation.y = agent.rotY || 0;
  const label = makeLabel(agent);
  mesh.add(label.obj);
  mesh.userData = { entityId: agent.id };
  scene.add(mesh);
  entities.set(agent.id, {
    mesh, kind: 'agent', data: agent, label,
    tx: agent.x, tz: agent.z, baseY: 0, bobPhase: Math.random() * Math.PI * 2,
    jump: null, spinLeft: 0, busy: false, speakTimer: null,
  });
  if (select) selectEntity(agent.id);
}

function spawnObject(o, { select = false } = {}) {
  const build = BUILDERS[o.type];
  if (!build) return;
  if (!o.color) o.color = PW.randomPastel();
  const mesh = build(o.color);
  mesh.position.set(o.x, 0, o.z);
  mesh.rotation.y = o.rotY || 0;
  mesh.scale.setScalar(o.scale || 1);
  mesh.userData = { entityId: o.id };
  scene.add(mesh);
  entities.set(o.id, {
    mesh, kind: 'object', data: o,
    bobPhase: Math.random() * Math.PI * 2, spinRate: o.type === 'ring' || o.type === 'star' ? 0.6 : 0,
  });
  if (select) selectEntity(o.id);
}

function removeEntity(id) {
  const e = entities.get(id);
  if (!e) return;
  scene.remove(e.mesh);
  e.mesh.traverse((m) => {
    if (m.geometry) m.geometry.dispose();
    if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
  });
  entities.delete(id);
  if (selectedId === id) { selectedId = null; renderInspector(); }
}

function rebuildAll() {
  for (const id of [...entities.keys()]) removeEntity(id);
  PW.data.agents.forEach((a) => spawnAgent(a));
  W.objects.forEach((o) => spawnObject(o));
}

rebuildAll();

/* ================================================================
   Selection, placement, dragging
   ================================================================ */
let selectedId = null;
let placing = null;      // {type:'ai', agent} | {type:'object', objType}
let dragging = null;     // {id, offset}
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const platePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const hint = document.getElementById('stage-hint');
function showHint(text, ms = 3200) {
  hint.textContent = text;
  hint.classList.add('show');
  clearTimeout(showHint._t);
  showHint._t = setTimeout(() => hint.classList.remove('show'), ms);
}

function setPointer(event) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((event.clientY - r.top) / r.height) * 2 + 1;
}

function pick(event) {
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    let node = h.object;
    while (node && !node.userData?.entityId) node = node.parent;
    if (node) return { entityId: node.userData.entityId, point: h.point };
    if (h.object === plate) return { plate: true, point: h.point };
  }
  return null;
}

function placeAt(point) {
  const b = plateBounds();
  return {
    x: PW.clamp(Math.round(point.x * 10) / 10, -b, b),
    z: PW.clamp(Math.round(point.z * 10) / 10, -b, b),
  };
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const hit = pick(e);
  if (placing) {
    if (hit && (hit.plate || hit.point)) {
      const p = placeAt(hit.point);
      if (placing.type === 'ai') {
        const agent = placing.agent;
        agent.x = p.x; agent.z = p.z;
        PW.data.agents.push(agent);
        spawnAgent(agent, { select: true });
        addLog(`<b>${PW.escapeHtml(agent.name)}</b> joined the world`);
        startAgent(agent);
      } else {
        const obj = { id: PW.uid(), type: placing.objType, color: PW.randomPastel(), ...p, scale: 1, rotY: 0 };
        W.objects.push(obj);
        spawnObject(obj, { select: true });
        addLog(`Added ${placing.objType}`);
      }
      PW.save();
      setPlacing(null);
    }
    return;
  }
  if (hit && hit.entityId) {
    selectEntity(hit.entityId);
    const ent = entities.get(hit.entityId);
    dragging = { id: hit.entityId, offset: new THREE.Vector3().subVectors(ent.mesh.position, hit.point).setY(0), moved: false };
    controls.enabled = false;
  } else {
    selectEntity(null);
  }
});

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  setPointer(e);
  raycaster.setFromCamera(pointer, camera);
  const p = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(platePlane, p)) {
    const ent = entities.get(dragging.id);
    if (!ent) return;
    const b = plateBounds();
    const nx = PW.clamp(p.x + dragging.offset.x, -b, b);
    const nz = PW.clamp(p.z + dragging.offset.z, -b, b);
    if (Math.abs(nx - ent.mesh.position.x) + Math.abs(nz - ent.mesh.position.z) > 0.05) dragging.moved = true;
    ent.mesh.position.x = nx;
    ent.mesh.position.z = nz;
    if (ent.kind === 'agent') { ent.data.x = nx; ent.data.z = nz; ent.tx = nx; ent.tz = nz; ent.move = null; }
    else { ent.data.x = nx; ent.data.z = nz; }
  }
});

window.addEventListener('pointerup', () => {
  if (dragging) {
    controls.enabled = true;
    if (dragging.moved) PW.save();
    dragging = null;
  }
});

/* Toolbar */
let activeTool = null;
function setPlacing(p) {
  placing = p;
  document.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', false));
  activeTool = null;
  if (!p) return;
  if (p.type === 'ai') showHint('Click the baseplate to place your AI cube');
  else showHint(`Click the baseplate to place a ${p.objType}`);
}
document.querySelectorAll('.tool-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    if (tool === 'ai') { openAddAI(); return; }
    const wasActive = btn.classList.contains('active');
    document.querySelectorAll('.tool-btn').forEach((b) => b.classList.remove('active'));
    if (wasActive) { setPlacing(null); return; }
    btn.classList.add('active');
    activeTool = tool;
    setPlacing({ type: 'object', objType: tool });
  });
});

/* ================================================================
   Add AI modal
   ================================================================ */
function modelOptions(selectedKey) {
  const models = PW.data.models;
  if (!models.length) return '<option value="">— no models yet —</option>';
  return models.map((m) => {
    const key = 'custom:' + m.id;
    const sel = key === selectedKey ? ' selected' : '';
    const tag = m.keyless || m.free ? ' ✓' : '';
    return `<option value="${key}"${sel}>${PW.escapeHtml(m.name)}${tag}</option>`;
  }).join('');
}

function openAddAI() {
  const pastel = PW.randomPastel();
  const { el, close } = PW.modal(`
    <h2><i data-lucide="bot"></i> Add an AI cube</h2>
    <div class="field">
      <label for="ai-name">Name</label>
      <input type="text" id="ai-name" value="Cube-${PW.data.agents.length + 1}" />
    </div>
    <div class="field">
      <label for="ai-model">Brain (model)</label>
      <select id="ai-model">${modelOptions()}</select>
      <span class="hint">Free models are marked with ✓. Using your own provider? <a href="models.html">Add any model here</a> — paste its URL, no presets needed.</span>
    </div>
    <div class="field">
      <label>Behaviour</label>
      <div class="seg" id="ai-mode">
        <button type="button" data-val="freedom" aria-pressed="true">Freedom</button>
        <button type="button" data-val="prompt" aria-pressed="false">Prompt</button>
      </div>
    </div>
    <div class="field" id="ai-prompt-field" hidden>
      <label for="ai-prompt">Mission prompt</label>
      <textarea id="ai-prompt" placeholder="e.g. Patrol the baseplate and greet anyone you meet"></textarea>
    </div>
    <div class="field">
      <label for="ai-color">Cube colour</label>
      <input type="color" id="ai-color" value="${pastel}" />
    </div>
    <div class="field">
      <label for="ai-tick">Thinks every <output id="ai-tick-o">${S.tickSec}</output> s</label>
      <input type="range" id="ai-tick" min="2" max="20" step="1" value="${S.tickSec}" />
    </div>
    <div class="insp-actions">
      <button class="btn btn-primary" id="ai-create"><i data-lucide="check"></i>Create & place</button>
      <button class="btn btn-ghost" data-close-modal>Cancel</button>
    </div>
    <div class="field" id="ai-fetch-row" style="margin-top:var(--space-4)">
      <button type="button" class="btn btn-soft btn-sm" id="ai-fetch-free"><i data-lucide="gift"></i>Fetch free models</button>
      <span class="hint" id="ai-fetch-status"></span>
    </div>
  `);
  lucide.createIcons();

  let mode = 'freedom';
  el.querySelector('#ai-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    mode = b.dataset.val;
    el.querySelectorAll('#ai-mode button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    el.querySelector('#ai-prompt-field').hidden = mode !== 'prompt';
  });
  el.querySelector('#ai-tick').addEventListener('input', (e) => {
    el.querySelector('#ai-tick-o').textContent = e.target.value;
  });
  el.querySelector('#ai-fetch-free').addEventListener('click', async (e) => {
    const st = el.querySelector('#ai-fetch-status');
    st.textContent = 'Fetching…';
    try {
      const res = await PWAI.fetchFreeModels();
      let added = 0;
      for (const m of [...res.pollinations, ...res.puter, ...res.horde]) {
        const dup = PW.data.models.some((x) => x.kind === m.kind && x.modelId === m.id);
        if (!dup) {
          PW.data.models.push({ id: PW.uid(), name: m.name, kind: m.kind, modelId: m.id, free: true, keyless: true, baseUrl: '', apiKey: '', proxyUrl: '' });
          added++;
        }
      }
      PW.save();
      st.textContent = added ? `Added ${added} free models` : 'Already up to date';
      el.querySelector('#ai-model').innerHTML = modelOptions();
    } catch (err) {
      st.textContent = 'Failed — ' + err.message;
    }
  });
  el.querySelector('#ai-create').addEventListener('click', () => {
    const name = el.querySelector('#ai-name').value.trim() || 'Cube';
    const modelKey = el.querySelector('#ai-model').value;
    if (!modelKey) { PW.toast('Add a model first — try “Fetch free models”'); return; }
    const agent = {
      id: PW.uid(), name, color: el.querySelector('#ai-color').value,
      modelKey, mode, prompt: el.querySelector('#ai-prompt')?.value || '',
      tickSec: Number(el.querySelector('#ai-tick').value), running: false,
      history: [], x: 0, z: 0, rotY: 0,
    };
    close();
    setPlacing({ type: 'ai', agent });
    showHint('Click the baseplate to place ' + name);
  });
}

document.getElementById('add-ai-btn').addEventListener('click', openAddAI);

/* ================================================================
   AI control loop
   ================================================================ */
const logLines = document.getElementById('log-lines');
function addLog(html) {
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = html;
  logLines.appendChild(div);
  while (logLines.children.length > 40) logLines.firstChild.remove();
  const box = document.getElementById('world-log');
  box.scrollTop = box.scrollHeight;
}
document.getElementById('clear-log').addEventListener('click', () => { logLines.innerHTML = ''; });

let paused = false;
document.getElementById('btn-pause').addEventListener('click', () => {
  paused = !paused;
  document.getElementById('pause-label').textContent = paused ? 'Resume all' : 'Pause all';
  PW.toast(paused ? 'All AI paused' : 'AI resumed');
});

document.getElementById('btn-cam-reset').addEventListener('click', () => { controls.reset(); });

function lastSayOf(agent) {
  for (let i = agent.history.length - 1; i >= 0; i--) {
    if (agent.history[i].role === 'assistant') {
      try {
        const p = JSON.parse(agent.history[i].content);
        const say = (p.actions || []).find((a) => a.action === 'say');
        if (say) return String(say.text).slice(0, 60);
      } catch (e) { /* not json */ }
    }
  }
  return '';
}

function buildSystemPrompt(agent) {
  const half = plateBounds();
  const others = PW.data.agents.filter((a) => a.id !== agent.id).map((a) => ({
    name: a.name, color: a.color,
    position: [Math.round(a.x), Math.round(a.z)],
    lastSaid: lastSayOf(a) || undefined,
  }));
  const objects = W.objects.slice(0, 50).map((o) => ({ type: o.type, position: [Math.round(o.x), Math.round(o.z)] }));
  const state = {
    you: { name: agent.name, color: agent.color, position: [Math.round(agent.x), Math.round(agent.z)], facingDeg: Math.round(THREE.MathUtils.radToDeg(agent.rotY || 0)) },
    baseplate: { size: W.plateSize, movementBounds: [-half, half] },
    otherAgents: others,
    objects,
  };
  const directive = agent.mode === 'prompt' && agent.prompt
    ? `MISSION (follow it): ${agent.prompt}`
    : 'You have COMPLETE FREEDOM. Decide for yourself what to do — explore, play with objects, talk to other cubes, be curious, rest, daydream.';
  return `You are "${agent.name}", a friendly AI living inside a small rounded cube in a pastel 3D world. You control your own cube body.

WORLD STATE (JSON):
${JSON.stringify(state)}

${directive}

HOW YOU ACT: reply with ONLY valid JSON — no markdown, no code fences, nothing outside JSON:
{"thought":"one short sentence about what you want to do","actions":[ ...1 to 5 actions... ]}

ACTIONS you can use:
{"action":"move","dx":-5,"dz":3}        — walk by dx/dz units (each between -5 and 5)
{"action":"rotate","degrees":90}        — turn in place
{"action":"jump","height":2}            — hop, height 0-3
{"action":"spin","turns":1}             — joyful spin, 1-3 turns
{"action":"color","hex":"#a8e6cf"}      — change your colour to a pastel hex
{"action":"say","text":"hi!"}           — speak (shown above you, under 110 characters)
{"action":"wait","seconds":2}          — pause

Rules: stay inside movementBounds. Keep "say" text short. Vary what you do. Respond with the JSON object only.`;
}

function parseAgentJson(raw) {
  let text = String(raw).trim();
  text = text.replace(/```json/gi, '```').replace(/```/g, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('no JSON object found');
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!parsed || typeof parsed !== 'object') throw new Error('bad JSON');
  let actions = Array.isArray(parsed.actions) ? parsed.actions : [];
  actions = actions.filter((a) => a && typeof a.action === 'string').slice(0, 6);
  return { thought: String(parsed.thought || '').slice(0, 200), actions };
}

const HEX_RE = /^#[0-9a-f]{6}$/i;
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

async function executeActions(ent, parsed) {
  for (const a of parsed.actions) {
    if (!ent.data.running && !ent.manual) break;
    switch (a.action) {
      case 'move': {
        const dx = PW.clamp(Number(a.dx) || 0, -6, 6);
        const dz = PW.clamp(Number(a.dz) || 0, -6, 6);
        const b = plateBounds();
        const fx = PW.clamp(ent.tx + dx, -b, b);
        const fz = PW.clamp(ent.tz + dz, -b, b);
        ent.tx = fx;
        ent.tz = fz;
        ent.data.x = fx;
        ent.data.z = fz;
        const dist = Math.hypot(fx - ent.mesh.position.x, fz - ent.mesh.position.z);
        if (dist > 0.05) {
          // smooth glide: duration scales with distance, eased in and out
          const dur = PW.clamp(dist / Math.max(0.8, S.moveSpeed), 0.35, 2.6);
          ent.move = { sx: ent.mesh.position.x, sz: ent.mesh.position.z, fx, fz, t: 0, dur };
          ent.targetYaw = Math.atan2(fx - ent.mesh.position.x, fz - ent.mesh.position.z);
        }
        break;
      }
      case 'rotate': {
        const deg = PW.clamp(Number(a.degrees) || 0, -360, 360);
        if (ent.targetYaw === undefined) ent.targetYaw = ent.mesh.rotation.y;
        ent.targetYaw += THREE.MathUtils.degToRad(deg);
        break;
      }
      case 'jump': {
        const h = PW.clamp(Number(a.height) || 1, 0.5, 3.5);
        ent.jump = { t: 0, h };
        await sleep(500);
        break;
      }
      case 'spin': {
        ent.spinLeft += PW.clamp(Number(a.turns) || 1, 1, 3) * Math.PI * 2;
        await sleep(600);
        break;
      }
      case 'color': {
        if (HEX_RE.test(a.hex)) {
          ent.data.color = a.hex;
          ent.mesh.children[0].material.color.set(a.hex);
          if (selectedId === ent.data.id) renderInspector();
        }
        break;
      }
      case 'say': {
        const text = String(a.text || '').slice(0, 110);
        if (text) speak(ent, text);
        break;
      }
      case 'wait': {
        await sleep(PW.clamp(Number(a.seconds) || 1, 0.5, 6) * 1000);
        break;
      }
    }
    await sleep(350);
  }
}

function speak(ent, text) {
  if (!ent.label) return;
  ent.label.speech.textContent = text;
  ent.label.speech.classList.add('show');
  clearTimeout(ent.speakTimer);
  ent.speakTimer = setTimeout(() => ent.label.speech.classList.remove('show'), S.speechSec * 1000);
  addLog(`<b>${PW.escapeHtml(ent.data.name)}</b>: ${PW.escapeHtml(text)}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runTick(agent, { manual = false } = {}) {
  const ent = entities.get(agent.id);
  if (!ent || (paused && !manual)) return;
  const model = PWAI.resolve(agent.modelKey);
  if (!model) {
    addLog(`<span class="err"><b>${PW.escapeHtml(agent.name)}</b>: model missing</span>`);
    agent.running = false;
    renderInspector();
    return;
  }
  const messages = [
    { role: 'system', content: buildSystemPrompt(agent) },
    ...agent.history.slice(-S.maxHistory),
    { role: 'user', content: manual ? agent._pendingUser || 'Hello!' : 'Your turn — act now. Reply with the JSON object only.' },
  ];
  let raw;
  try {
    raw = await PWAI.chat(model, messages, { temperature: 0.9, maxTokens: 900 });
    agent._backoff = false;
  } catch (err) {
    addLog(`<span class="err"><b>${PW.escapeHtml(agent.name)}</b>: ${PW.escapeHtml(err.message.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')).slice(0, 120)}</span>`);
    const rateLimited = /402|429|rate|limit|quota/i.test(err.message);
    if (rateLimited) {
      agent._backoff = true; // slow down until the provider lets us through
    } else {
      const last = agent.history[agent.history.length - 1];
      if (!last || last.role !== 'user' || !last.content.startsWith('Your last reply failed')) {
        agent.history.push({ role: 'user', content: 'Your last reply failed (' + err.message.slice(0, 80) + '). Try again with ONLY the JSON object.' });
      }
    }
    if (!manual) return; // will retry next tick
  }
  delete agent._pendingUser;
  let parsed;
  try {
    parsed = parseAgentJson(raw);
  } catch (e) {
    agent.history.push({ role: 'assistant', content: String(raw).slice(0, 400) });
    agent.history.push({ role: 'user', content: 'That was not valid JSON. Reply again with ONLY the JSON object: {"thought":..., "actions":[...]}' });
    addLog(`<span class="err"><b>${PW.escapeHtml(agent.name)}</b>: reply wasn't valid JSON, asking again…</span>`);
    return;
  }
  agent.history.push({ role: 'assistant', content: JSON.stringify(parsed) });
  if (agent.history.length > S.maxHistory * 2) agent.history = agent.history.slice(-S.maxHistory);
  if (parsed.thought) addLog(`<b>${PW.escapeHtml(agent.name)}</b> <span style="color:var(--color-lavender)">thought</span>: ${PW.escapeHtml(parsed.thought)}`);
  ent.manual = manual;
  await executeActions(ent, parsed);
  ent.manual = false;
  PW.save();
}

const timers = new Map();
function scheduleAgent(agent) {
  clearTimeout(timers.get(agent.id));
  if (!agent.running || paused) return;
  const wait = (agent._backoff ? Math.max(agent.tickSec, 25) : Math.max(2, agent.tickSec)) * 1000;
  timers.set(agent.id, setTimeout(async () => {
    await runTick(agent).catch(() => {});
    scheduleAgent(agent);
  }, wait));
}
function startAgent(agent) {
  agent.running = true;
  runTick(agent).catch(() => {});
  scheduleAgent(agent);
  PW.save();
}
function stopAgent(agent) {
  agent.running = false;
  clearTimeout(timers.get(agent.id));
  PW.save();
}

/* resume agents that were running last session */
PW.data.agents.filter((a) => a.running).forEach((a) => scheduleAgent(a));

/* ================================================================
   Inspector
   ================================================================ */
const inspBody = document.getElementById('insp-body');
const inspEmpty = document.getElementById('insp-empty');

function selectEntity(id) {
  selectedId = id;
  selRing.visible = !!id;
  renderInspector();
}

function renderInspector() {
  if (!selectedId) {
    inspEmpty.hidden = false;
    inspBody.hidden = true;
    selRing.visible = false;
    return;
  }
  const ent = entities.get(selectedId);
  if (!ent) { selectedId = null; renderInspector(); return; }
  inspEmpty.hidden = true;
  inspBody.hidden = false;
  if (ent.kind === 'agent') renderAgentInspector(ent);
  else renderObjectInspector(ent);
}

function renderAgentInspector(ent) {
  const a = ent.data;
  inspBody.innerHTML = `
    <div class="agent-head">
      <div class="agent-swatch" id="ia-swatch" style="background:${a.color}"></div>
      <div style="min-width:0;flex:1">
        <input type="text" id="ia-name" value="${PW.escapeHtml(a.name)}" style="width:100%;font-weight:700;border:none;background:transparent;font-family:var(--font-display);font-size:var(--text-base)" aria-label="Agent name" />
        <div class="agent-status ${a.running && !paused ? '' : 'stopped'}" id="ia-status">
          <span class="dot"></span><span id="ia-status-text">${a.running ? (paused ? 'paused' : 'thinking & moving') : 'stopped'}</span>
        </div>
      </div>
    </div>
    <div class="field">
      <label for="ia-model">Brain (model)</label>
      <select id="ia-model">${modelOptions(a.modelKey)}</select>
    </div>
    <div class="field">
      <label>Behaviour</label>
      <div class="seg" id="ia-mode">
        <button type="button" data-val="freedom" aria-pressed="${a.mode === 'freedom'}">Freedom</button>
        <button type="button" data-val="prompt" aria-pressed="${a.mode === 'prompt'}">Prompt</button>
      </div>
    </div>
    <div class="field" id="ia-prompt-field" ${a.mode === 'prompt' ? '' : 'hidden'}>
      <label for="ia-prompt">Mission prompt</label>
      <textarea id="ia-prompt" placeholder="Tell it what to do…">${PW.escapeHtml(a.prompt || '')}</textarea>
    </div>
    <div class="form-row">
      <div class="field">
        <label for="ia-color">Colour</label>
        <input type="color" id="ia-color" value="${a.color}" />
      </div>
      <div class="field">
        <label for="ia-tick">Thinks every</label>
        <input type="number" id="ia-tick" min="2" max="30" step="1" value="${a.tickSec}" />
        <span class="hint">seconds</span>
      </div>
    </div>
    <div class="insp-actions">
      <button class="btn ${a.running ? 'btn-ghost' : 'btn-primary'}" id="ia-toggle">${a.running ? '<i data-lucide="pause"></i>Stop' : '<i data-lucide="play"></i>Start'}</button>
      <button class="btn btn-danger" id="ia-remove"><i data-lucide="trash-2"></i>Remove</button>
    </div>
    <div class="talk-box">
      <input type="text" id="ia-talk" placeholder="Say something to ${PW.escapeHtml(a.name)}…" aria-label="Talk to agent" />
      <button class="btn btn-soft btn-sm" id="ia-send" aria-label="Send"><i data-lucide="send"></i></button>
    </div>
    <div class="convo" id="ia-convo"></div>
  `;
  lucide.createIcons();
  renderConvo(ent);

  inspBody.querySelector('#ia-name').addEventListener('change', (e) => {
    a.name = e.target.value.trim() || a.name;
    ent.label.tag.textContent = a.name;
    PW.save();
  });
  inspBody.querySelector('#ia-model').addEventListener('change', (e) => { a.modelKey = e.target.value; PW.save(); });
  inspBody.querySelector('#ia-mode').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    a.mode = b.dataset.val;
    inspBody.querySelectorAll('#ia-mode button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.val === a.mode)));
    inspBody.querySelector('#ia-prompt-field').hidden = a.mode !== 'prompt';
    PW.save();
  });
  inspBody.querySelector('#ia-prompt').addEventListener('change', (e) => { a.prompt = e.target.value; PW.save(); });
  inspBody.querySelector('#ia-color').addEventListener('input', (e) => {
    a.color = e.target.value;
    ent.mesh.children[0].material.color.set(a.color);
    inspBody.querySelector('#ia-swatch').style.background = a.color;
    PW.save();
  });
  inspBody.querySelector('#ia-tick').addEventListener('change', (e) => {
    a.tickSec = PW.clamp(Number(e.target.value) || 6, 2, 30);
    if (a.running) scheduleAgent(a);
    PW.save();
  });
  inspBody.querySelector('#ia-toggle').addEventListener('click', () => {
    if (a.running) stopAgent(a); else startAgent(a);
    renderInspector();
  });
  inspBody.querySelector('#ia-remove').addEventListener('click', () => {
    stopAgent(a);
    PW.data.agents = PW.data.agents.filter((x) => x.id !== a.id);
    removeEntity(a.id);
    PW.save();
    addLog(`<b>${PW.escapeHtml(a.name)}</b> left the world`);
  });
  const send = () => {
    const input = inspBody.querySelector('#ia-talk');
    const text = input.value.trim();
    if (!text) return;
    a.history.push({ role: 'user', content: text });
    input.value = '';
    renderConvo(ent);
    runTick(a, { manual: true }).then(() => renderConvo(ent)).catch(() => {});
  };
  inspBody.querySelector('#ia-send').addEventListener('click', send);
  inspBody.querySelector('#ia-talk').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
}

function renderConvo(ent) {
  const box = inspBody.querySelector('#ia-convo');
  if (!box) return;
  const a = ent.data;
  box.innerHTML = a.history.slice(-14).map((m) => {
    let body = m.content;
    try {
      const p = JSON.parse(m.content);
      body = (p.actions || []).map((x) => x.action + (x.text ? ` “${x.text}”` : x.dx !== undefined ? ` (${x.dx},${x.dz})` : '')).join(', ');
      if (p.thought) body = 'Thought: ' + p.thought + ' → ' + body;
    } catch (e) { /* plain */ }
    const cls = m.role === 'assistant' ? 'thought' : m.role === 'user' ? '' : 'err';
    return `<div class="convo-line ${cls}"><span class="who">${m.role === 'assistant' ? a.name : m.role === 'user' ? 'you' : m.role}</span><br>${PW.escapeHtml(body).slice(0, 300)}</div>`;
  }).join('') || '<div class="convo-line" style="color:var(--color-text-faint)">No conversation yet — start it and the cube will reply.</div>';
}

const OBJ_ICONS = {
  tree: 'tree-pine', bush: 'sprout', flower: 'flower-2', rock: 'mountain', pond: 'droplets',
  house: 'home', pillar: 'landmark', bench: 'armchair', arch: 'rainbow', lamp: 'lamp',
  ball: 'circle', ring: 'circle-dashed', cloud: 'cloud', crystal: 'gem', star: 'star',
};

function renderObjectInspector(ent) {
  const o = ent.data;
  inspBody.innerHTML = `
    <h2><i data-lucide="${OBJ_ICONS[o.type] || 'shapes'}"></i>${o.type.charAt(0).toUpperCase() + o.type.slice(1)}</h2>
    <div class="field">
      <label for="io-color">Colour</label>
      <input type="color" id="io-color" value="${o.color}" />
    </div>
    <div class="field">
      <label for="io-scale">Size: <output id="io-scale-o">${(o.scale || 1).toFixed(1)}</output>×</label>
      <input type="range" id="io-scale" min="0.4" max="2.5" step="0.1" value="${o.scale || 1}" />
    </div>
    <div class="field">
      <label for="io-rot">Rotation: <output id="io-rot-o">${Math.round(THREE.MathUtils.radToDeg(o.rotY || 0))}°</output></label>
      <input type="range" id="io-rot" min="0" max="360" step="5" value="${THREE.MathUtils.radToDeg(o.rotY || 0)}" />
    </div>
    <div class="insp-actions">
      <button class="btn btn-ghost" id="io-duplicate"><i data-lucide="copy"></i>Duplicate</button>
      <button class="btn btn-danger" id="io-remove"><i data-lucide="trash-2"></i>Remove</button>
    </div>
  `;
  lucide.createIcons();
  inspBody.querySelector('#io-color').addEventListener('input', (e) => {
    o.color = e.target.value;
    ent.mesh.traverse((m) => { if (m.isMesh && m.userData.primary && m.material?.color) m.material.color.set(e.target.value); });
    PW.save();
  });
  const scaleEl = inspBody.querySelector('#io-scale');
  scaleEl.addEventListener('input', (e) => {
    o.scale = Number(e.target.value);
    ent.mesh.scale.setScalar(o.scale);
    inspBody.querySelector('#io-scale-o').textContent = o.scale.toFixed(1);
    PW.save();
  });
  const rotEl = inspBody.querySelector('#io-rot');
  rotEl.addEventListener('input', (e) => {
    const deg = Number(e.target.value);
    o.rotY = THREE.MathUtils.degToRad(deg);
    ent.mesh.rotation.y = o.rotY;
    inspBody.querySelector('#io-rot-o').textContent = deg + '°';
    PW.save();
  });
  inspBody.querySelector('#io-duplicate').addEventListener('click', () => {
    const b = plateBounds();
    const copy = { ...o, id: PW.uid(), x: PW.clamp(o.x + 1.5, -b, b), z: PW.clamp(o.z + 1.5, -b, b) };
    W.objects.push(copy);
    spawnObject(copy, { select: true });
    PW.save();
  });
  inspBody.querySelector('#io-remove').addEventListener('click', () => {
    W.objects = W.objects.filter((x) => x.id !== o.id);
    removeEntity(o.id);
    PW.save();
  });
}

renderInspector();

/* ================================================================
   Animation loop
   ================================================================ */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  controls.update();

  for (const ent of entities.values()) {
    const m = ent.mesh;
    if (ent.kind === 'agent') {
      const body = m.children[0];
      // smooth glide toward target (eased in and out)
      if (ent.move) {
        ent.move.t += delta / ent.move.dur;
        const k = ent.move.t >= 1 ? 1 : easeInOutCubic(ent.move.t);
        m.position.x = ent.move.sx + (ent.move.fx - ent.move.sx) * k;
        m.position.z = ent.move.sz + (ent.move.fz - ent.move.sz) * k;
        if (ent.move.t >= 1) { ent.move = null; PW.save(); }
      } else {
        // fallback: drift toward target (dragging, external changes)
        const dx = ent.tx - m.position.x;
        const dz = ent.tz - m.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.02) {
          const step = Math.min(dist, S.moveSpeed * 2.5 * delta);
          m.position.x += (dx / dist) * step;
          m.position.z += (dz / dist) * step;
        }
      }
      const moving = !!(ent.move && ent.move.t < 0.97);
      // gentle idle bob + waddle while moving
      body.position.y = 0.62 + Math.sin(t * 2 + ent.bobPhase) * 0.045;
      if (moving) m.rotation.z = Math.sin(t * 11 + ent.bobPhase) * 0.06;
      else m.rotation.z *= Math.max(0, 1 - delta * 7);
      // smooth turn toward facing direction
      if (ent.targetYaw !== undefined && !ent.spinLeft) {
        let d = ((ent.targetYaw - m.rotation.y + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (Math.abs(d) < 0.015) m.rotation.y = ent.targetYaw;
        else m.rotation.y += d * Math.min(1, delta * 9);
      }
      // jump with squash and stretch
      if (ent.jump) {
        ent.jump.t += delta * 2.2;
        if (ent.jump.t >= 1) {
          ent.jump = null;
          body.position.y = 0.62;
          ent.land = 0.16;
        } else {
          body.position.y = 0.62 + Math.sin(ent.jump.t * Math.PI) * ent.jump.h * 0.5;
          const s = 1 + Math.sin(ent.jump.t * Math.PI) * 0.12;
          body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
        }
      } else if (ent.land > 0) {
        // landing squash, springs back
        ent.land -= delta;
        if (ent.land <= 0) body.scale.set(1, 1, 1);
        else {
          const k = ent.land / 0.16;
          const s = 1 - Math.sin(k * Math.PI) * 0.14;
          body.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
        }
      }
      // spin
      if (ent.spinLeft > 0.01) {
        const s = Math.min(ent.spinLeft, delta * 9);
        m.rotation.y += s;
        ent.spinLeft -= s;
        if (ent.spinLeft <= 0.01 && ent.targetYaw !== undefined) ent.targetYaw = undefined;
      }
    } else if (ent.kind === 'object') {
      // idle animations handled below
    }
  }

  // object idle animations
  for (const ent of entities.values()) {
    if (ent.kind !== 'object') continue;
    const o = ent.data;
    if (o.type === 'ball') {
      const ball = ent.mesh.children[0];
      ball.position.y = 0.45 + Math.abs(Math.sin(t * 2.2 + ent.bobPhase)) * 0.28;
    } else if (o.type === 'star') {
      const star = ent.mesh.children[0];
      star.position.y = 1.35 + Math.sin(t * 1.6 + ent.bobPhase) * 0.18;
      star.rotation.y += delta * 0.9;
    } else if (o.type === 'ring') {
      ent.mesh.children[0].rotation.y += delta * 0.7;
    } else if (o.type === 'flower') {
      ent.mesh.rotation.z = Math.sin(t * 1.4 + ent.bobPhase) * 0.05;
    } else if (o.type === 'cloud') {
      ent.mesh.position.y = Math.sin(t * 0.8 + ent.bobPhase) * 0.09;
    } else if (o.type === 'crystal') {
      ent.mesh.children[0].rotation.y += delta * 0.45;
    }
  }

  // selection ring follows
  if (selectedId) {
    const ent = entities.get(selectedId);
    if (ent) {
      selRing.position.set(ent.mesh.position.x, 0.06, ent.mesh.position.z);
      const pulse = 1 + Math.sin(t * 4) * 0.06;
      selRing.scale.setScalar(pulse * (ent.kind === 'object' ? (ent.data.scale || 1) : 1));
    }
  }

  // particles drift
  if (particles) {
    particles.rotation.y += delta * 0.02;
    particles.position.y = Math.sin(t * 0.3) * 0.3;
  }

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}


function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
}
window.addEventListener('resize', resize);
resize();
animate();
lucide.createIcons();

/* welcome hint */
if (!PW.data.agents.length) {
  showHint('Welcome! Click “Add AI” to drop your first thinking cube', 6000);
}
