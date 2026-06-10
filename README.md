# Ryan's World — Interactive Portfolio

A walkable pixel-art world that doubles as my portfolio. Instead of scrolling a page, you wander a little four-room apartment, talk to its characters, and play with the things inside it — a chess engine, a music studio, and a gym mini-game — while a website-style header gives you the "normal" way to read about my work.

## The world

Four rooms, connected through doorways with a soft phase in/out transition:

- **Lounge** (center) — the hub. Home to **Bob** and **Dino**.
- **Gym** (north) — **Amelia** and **Gojo**. Step up to the heavy bag for the **Combo Trainer** mini-game.
- **Game Room** (west) — **Drod**. Sit at the board to play **chess** against real **Stockfish** (with a from-scratch engine as the offline fallback), or step up to the **pool table** for a game of **8-ball**.
- **Music Studio** (east) — **Alex** and **DJ**. A **jukebox** + tap-to-play **beat pad** with a live visualizer.

Each room is alive: NPCs wander and do their own thing, tall objects (TVs, plants, mic stands) correctly draw in front of or behind you via baseline depth-sorting.

## Features

- **Interactive 2D world** — walk room to room, full-screen canvas rendering
- **Modern dialogue** — animated talking portraits, typewriter text, per-character personality, all about the portfolio
- **Chess vs. Drod** — play as White, Black, or random; choose your promotion piece; four difficulty tiers; powered by real **Stockfish** (WebAssembly) with a complete from-scratch engine (legal moves, castling, en passant, checkmate, quiescence search) as the offline fallback — and a trash-talking opponent throughout
- **8-Ball vs. Drod** — a physics pool game (ball-to-ball + cushion collisions, six pockets, full 8-ball rules with groups, fouls, and ball-in-hand), slingshot aiming with a live trajectory guide, a ghost-ball AI opponent, and synthesized table SFX
- **Music Studio** — jukebox playing 5 tracks + a beat pad with a Web Audio visualizer
- **Gym Combo Trainer** — call-and-respond directional punch combos with a pixel-art heavy bag and POW bursts
- **Website header** — About / Experience / Projects / Contact slide-over panels, room-map fast-travel, sound toggle, and résumé download, with smooth motion throughout
- **Animated loading screen** — title card over a live, animated room scene
- **Dev level editor** — load with **`?dev=1`** to show the hitbox overlay; the editor supports free-form collision boxes, depth baselines, door zones, and spawn points (saved to your browser, exportable as JSON)

## Controls

| Action | Keys |
| --- | --- |
| Move | `W` `A` `S` `D` or arrow keys |
| Interact | `Enter` (near an NPC or activity) |
| Close dialog / overlay | `Esc` |
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
├── src/
│   ├── main.ts             # entry: loader screen, wires header/editor → GAME, starts the world
│   ├── game.ts             # main loop: render, input, transitions, intro cinematic, TV
│   ├── content.ts          # portfolio data + per-character dialogue (typed)
│   ├── world.ts            # room registry + collision query
│   ├── hitboxes.ts         # free-form collision + depth + door + spawn data
│   ├── assets.ts           # image loader + sprite/sheet metadata
│   ├── sprites.ts          # spritesheet drawing (chars, pets, speaker, portraits)
│   ├── entities.ts         # player + NPC behaviour, objects, pets
│   ├── dialogue.ts         # animated portrait dialogue
│   ├── header.ts           # header nav + content panels + room map
│   ├── editor.ts           # dev-only level editor (?dev=1)
│   ├── stockfish-engine.ts # Stockfish (WASM) Web Worker bridge
│   ├── core/               # shared types, constants (TS grid, dir maps), helpers (pick/clamp)
│   ├── chess/
│   │   ├── engine.ts       # from-scratch rules + alpha-beta + quiescence + FEN/UCI bridge
│   │   └── engine.test.ts  # Vitest perft + rules tests
│   └── activities/
│       ├── base.ts         # shared overlay lifecycle + RAF dt-loop (chess/pool/music/workout)
│       ├── chess.ts        # chess UI (vs. Drod) — Stockfish + fallback
│       ├── pool.ts         # 8-ball pool: physics, rules, ghost-ball AI, UI (vs. Drod)
│       ├── music.ts        # jukebox + beat pad
│       └── workout.ts      # gym combo trainer
└── public/
    └── assets/             # static art/audio served at /assets/** (rooms, chars, portraits,
                            #   chess, engine/ Stockfish WASM, props/ TV, audio, og, résumé)
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

## Credits

- Chess opponent: [**Stockfish**](https://stockfishchess.org/), the open-source chess engine, compiled to WebAssembly by [Niklas Fiekas](https://github.com/niklasf/stockfish.js). Distributed under the **GNU GPL v3** — the build and its license live in [`assets/engine/`](assets/engine/) (`Copying.txt`).

## Contact

Collaborations, opportunities, or just to say hi:

- **Email**: ryanhuang1234567890@gmail.com
- **LinkedIn**: [kerui-huang](https://www.linkedin.com/in/kerui-huang/)

---

*Built with passion for interactive experiences and pixel-art aesthetics* 🎨
