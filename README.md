# Ryan's World — Interactive Portfolio

A walkable pixel-art world that doubles as my portfolio. Instead of scrolling a page, you wander a little four-room apartment, talk to its characters, and play with the things inside it — a chess engine, a music studio, and a gym mini-game — while a website-style header gives you the "normal" way to read about my work.

## The world

Four rooms, connected through doorways with a soft phase in/out transition:

- **Lounge** (center) — the hub. Home to **Bob** and **Dino**, plus a **guestbook** real visitors can sign.
- **Gym** (north) — **Amelia** and **Gojo**. Step up to the heavy bag for the **Combo Trainer**, or help Amelia **re-rack the weights** (a sneaky logic puzzle).
- **Game Room** (west) — **Drod**. Sit at the board to play **chess** against real **Stockfish** (with a from-scratch engine as the offline fallback), step up to the **pool table** for **8-ball** or the **Trick-Shot Gauntlet**, pull up a chair for **heads-up poker** — and whatever you do, don't press the red button.
- **Music Studio** (east) — **Alex** and **DJ**. A **jukebox**, a two-section **step sequencer** (keys + drums), and a **grand piano** you can actually play.

Each room is alive: NPCs wander and do their own thing, tall objects (TVs, plants, mic stands) correctly draw in front of or behind you via baseline depth-sorting.

## Features

- **Interactive 2D world** — walk room to room, full-screen canvas rendering
- **Modern dialogue** — animated talking portraits, typewriter text, per-character personality, all about the portfolio — and the NPCs **remember your session** (lose to Drod and he *will* bring it up)
- **Chess vs. Drod** — play as White, Black, or random; choose your promotion piece; four difficulty tiers; powered by real **Stockfish** (WebAssembly) with a complete from-scratch engine (legal moves, castling, en passant, checkmate, quiescence search) as the offline fallback — and a trash-talking opponent throughout
- **8-Ball vs. Drod** — a physics pool game (ball-to-ball + cushion collisions, six pockets, full 8-ball rules with groups, fouls, and ball-in-hand), slingshot aiming with a live trajectory guide, a ghost-ball AI opponent, and synthesized table SFX
- **Trick-Shot Gauntlet** — 8 set-piece pool puzzles (banks, combos, threading the needle, a called 8-ball) with 3 attempts and a ★★★ rating each, on the same physics
- **Heads-up poker vs. Drod** — real Texas Hold'em: escalating blinds, min-raise/BB-option rules, all-in run-outs, a Monte-Carlo opponent with a signature bluff, chip stacks that survive page reloads
- **Playable grand piano** — pixel-art keys (RagnaPixel's *Pixel Piano*), real sampled piano (FreePats, CC0) with a synth fallback, DAW-style keybinds on desktop and multi-touch chords + glissando on phones
- **Step sequencer** — a melody grid (pentatonic keys) over a 5-instrument drum machine with real CC0 one-shots (VCSL), hi-hat choking, a jitter-free lookahead scheduler, auto-saved patterns, and a **"Download my beat"** button that hands you an audio file
- **Jukebox** — 18 lo-fi tracks that keep playing site-wide while you explore
- **Gym Combo Trainer** — call-and-respond directional punch combos with a pixel-art heavy bag and POW bursts
- **Rack 'em Right** — Amelia's weight-plate logic puzzle: move the whole stack across three uprights without resting a big plate on a small one (move counter, par, stars)
- **Guestbook** — a real one; entries live in Cloudflare KV (rate-limited, honeypotted) and the last 50 visitors are on the page
- **Trophy Shelf** — a header panel tracking your whole visit (chess record, trick-shot stars, poker peak, pets befriended…) with 15 achievements, several of them hidden
- **A red button** — it says DO NOT PRESS
- **Website header** — About / Experience / Projects / Contact / Trophies slide-over panels, room-map fast-travel, and a sound toggle, with smooth motion throughout
- **Animated loading screen** — title card over a live, animated room scene
- **Dev level editor** — load with **`?dev=1`** to show the hitbox overlay; the editor supports free-form collision boxes, depth baselines, door zones, and spawn points (saved to your browser, exportable as JSON)

## Controls

| Action | Keys |
| --- | --- |
| Move | `W` `A` `S` `D` or arrow keys |
| Interact | `Enter` (near an NPC or activity) |
| Close dialog / overlay | `Esc` |
| Poker | `F` fold · `C` check/call · `R` raise · `A` all-in · `←`/`→` size the raise |
| Pool / trick shots | drag to aim — or `←`/`→` aim, `↑`/`↓` power, `Space` shoots |
| Piano | `A S D F G H J K L ; '` white keys · `W E T Y U O P` black keys · `Z`/`X` octave |
| Dev hitbox overlay | load with `?dev=1` |

On-screen touch controls (d-pad + action button) appear on mobile/touch devices.

## Technologies

- **Frontend**: HTML5, CSS3, **TypeScript** (ES modules) — no UI framework; bundled with **Vite**, unit-tested with **Vitest**
- **Graphics**: HTML5 Canvas 2D
- **Audio**: Web Audio API (jukebox, beat pad, sound effects)
- **Chess engine**: official [Stockfish](https://stockfishchess.org/) compiled to WebAssembly (single-threaded, driven over UCI in a Web Worker), with a hand-written alpha–beta + quiescence engine as the offline fallback
- **Art**: LimeZu-style pixel tilesets; rooms authored in [Tiled](https://www.mapeditor.org/) and pre-rendered to layered PNGs (base / props / top)
- **Fonts**: Pixelify Sans & Silkscreen

## Project structure

```
MyWebsite/
├── index.html              # entry HTML — loads a single module: /src/main.ts
├── package.json            # scripts: dev / build / preview / typecheck / test
├── tsconfig.json           # strict TypeScript config
├── vite.config.ts          # Vite + Vitest config
├── css/
│   ├── style.css           # world, header, loader
│   ├── ui.css              # dialogue, slide-over panels, room map, activity host
│   └── activity.css        # chess / pool / music / gym overlays
├── functions/
│   └── api/guestbook.ts    # Cloudflare Pages Function: guestbook GET/POST over KV
├── scripts/                # dev-only: fetch + trim the CC0 audio samples
├── src/
│   ├── main.ts             # entry: loader screen, wires header/editor → GAME, starts the world
│   ├── game.ts             # main loop: render, input, transitions, intro cinematic, TV, red button
│   ├── content.ts          # portfolio data + per-character dialogue + session-memory reactions
│   ├── progress.ts         # visit tracking, achievements + toasts (drives the Trophy Shelf)
│   ├── world.ts            # room registry + collision query
│   ├── hitboxes.ts         # free-form collision + depth + door + spawn data
│   ├── assets.ts           # image loader + sprite/sheet metadata
│   ├── sprites.ts          # spritesheet drawing (chars, pets, speaker, portraits)
│   ├── entities.ts         # player + NPC behaviour, objects, pets
│   ├── dialogue.ts         # animated portrait dialogue
│   ├── header.ts           # header nav + content panels (incl. Trophy Shelf) + room map
│   ├── editor.ts           # dev-only level editor (?dev=1)
│   ├── stockfish-engine.ts # Stockfish (WASM) Web Worker bridge
│   ├── core/               # shared types, constants (TS grid, dir maps), helpers (pick/clamp)
│   ├── chess/
│   │   ├── engine.ts       # from-scratch rules + alpha-beta + quiescence + FEN/UCI bridge
│   │   └── engine.test.ts  # Vitest perft + rules tests
│   ├── poker/
│   │   ├── eval.ts         # 5/7-card hand evaluator + Chen-style preflop strength
│   │   └── eval.test.ts    # Vitest category/kicker/wheel tests
│   └── activities/
│       ├── base.ts         # shared overlay lifecycle + RAF dt-loop
│       ├── chess.ts        # chess UI (vs. Drod) — Stockfish + fallback
│       ├── pool.ts         # 8-ball + trick-shot gauntlet: physics, rules, ghost-ball AI
│       ├── poker.ts        # heads-up hold'em: state machine, Monte-Carlo AI, canvas table
│       ├── music.ts        # jukebox + step sequencer (keys + drum kit, lookahead scheduler, recorder)
│       ├── rack.ts         # Rack 'em Right: Amelia's weight-plate logic puzzle
│       ├── beat-util.ts    # beat-pad pattern (de)serialization (+ tests)
│       ├── piano.ts        # playable grand piano: sprite keyboard, sampler + synth voices
│       ├── guestbook.ts    # guestbook overlay (optimistic sign, dev mock)
│       └── workout.ts      # gym combo trainer
└── public/
    └── assets/             # static art/audio served at /assets/** (rooms, chars, portraits,
                            #   chess, engine/ Stockfish WASM, props/ TV, piano/ key sprites,
                            #   audio/ incl. piano + drum samples, og)
```

## Getting started

Visit **[ryanhuang.work](https://ryanhuang.work)**.

Or run locally with [Node.js](https://nodejs.org/):

```bash
npm install
npm run dev        # Vite dev server with hot-reload
# build / preview / quality gates:
npm run build      # type-check (tsc) + production bundle to dist/
npm run preview     # serve the production build
npm run typecheck  # tsc --noEmit
npm test           # Vitest (chess-engine perft + rules)
```

## Guestbook backend (one-time setup)

The guestbook is a Cloudflare Pages Function (`functions/api/guestbook.ts`) backed by KV. To enable it on a deployment:

1. Cloudflare dashboard → **Storage & Databases → KV** → *Create namespace* (e.g. `ryans-place-guestbook`).
2. **Workers & Pages →** your Pages project → **Settings → Bindings → Add → KV namespace** — variable name **`GUESTBOOK`**, select the namespace (set it for both Production and Preview).
3. Redeploy. Until then the API answers 503 and the site shows a friendly "book's at the binders" state (and a local mock in `npm run dev`).

Local end-to-end test: `npm run build && npx wrangler pages dev dist --kv GUESTBOOK`.

## Credits

- Chess opponent: [**Stockfish**](https://stockfishchess.org/), the open-source chess engine, compiled to WebAssembly by [Niklas Fiekas](https://github.com/niklasf/stockfish.js). Distributed under the **GNU GPL v3** — the build and its license live in [`assets/engine/`](assets/engine/) (`Copying.txt`).
- Piano keys artwork: [**Pixel Piano**](https://ragnapixel.itch.io/) by **Raphael Hatencia** (RagnaPixel Studio) — used with the pack's license; crediting appreciated, so: thank you!
- Piano samples: [**Upright Piano KW**](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html) by the **FreePats project** — CC0 1.0 public domain.
- Drum one-shots: [**Versilian Community Sample Library**](https://github.com/sgossner/VCSL) by Versilian Studios / Sam Gossner — CC0 1.0 public domain.

## Contact

Collaborations, opportunities, or just to say hi:

- **Email**: ryanhuang1234567890@gmail.com
- **LinkedIn**: [kerui-huang](https://www.linkedin.com/in/kerui-huang/)

---

*Built with passion for interactive experiences and pixel-art aesthetics* 🎨
