# Pastel World 🧊

A pastel 3D playground where AI cubes live. Drop an AI model into a rounded cube, set it free or give it a prompt, and watch it move, speak, jump, spin and recolour itself on a soft baseplate.

**Live site:** published via GitHub Pages — see the Pages link on the right side of this repo.

## Features

- **3D world** — pastel baseplate with soft shadows, fog, floating particles and a grid. Orbit, zoom, drag objects around.
- **AI cubes** — every AI is a rounded cube with cute eyes and a name tag. It thinks on a timer, returns JSON actions (`move`, `rotate`, `jump`, `spin`, `color`, `say`, `wait`) and executes them in the world.
- **Freedom or prompt mode** — let the AI do whatever it wants, or give it a mission prompt.
- **Bring any model** — add models from any website with a display name, model ID, API base URL, API key and an optional proxy URL (three proxy styles supported). Works with OpenAI-compatible endpoints (Groq, Gemini, OpenRouter, Mistral, Cohere, DeepSeek, Hetzner, Cerebras, SambaNova, NVIDIA, Together, Hugging Face…), native Gemini and Anthropic APIs.
- **Free models with no key** — a live selector fetches keyless models automatically:
  - [Pollinations.ai](https://pollinations.ai) — no key, no account, instant
  - [Puter.js](https://puter.com) — free browser SDK, free account covers usage
  - [AI Horde](https://aihorde.net) — community-powered, anonymous key `0000000000`
- **World decoration** — trees, rocks, balls, lamps, pillars, rings, flowers and stars. Resize, recolour, rotate and duplicate them.
- **Everything saves** in your browser (models, cubes, world layout, settings). Export and import as JSON.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Landing + live stats |
| `world.html` | The 3D world, inspector and world log |
| `models.html` | Add custom models, fetch free keyless models, provider directory |
| `settings.html` | Baseplate, sky, agent behaviour, theme, data |

## Privacy

API keys are stored only in your browser's local storage and sent only to the endpoint you configure. This is a static site — there is no backend.

## Tech

Vanilla HTML/CSS/JS + [Three.js](https://threejs.org) (rounded box geometry, CSS2D labels, orbit controls) loaded from CDN. No build step. Fonts: Chillax + Satoshi via Fontshare.

## Run locally

Just open `index.html` in a browser, or serve the folder with any static server (e.g. `python3 -m http.server`).
