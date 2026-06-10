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
- **Dev level editor** — press **`H`** in-game to toggle the hitbox overlay; editing supports free-form collision boxes, depth baselines, door zones, and spawn points (saved to your browser, exportable as JSON)

## Controls

| Action | Keys |
| --- | --- |
| Move | `W` `A` `S` `D` or arrow keys |
| Interact | `Enter` (near an NPC or activity) |
| Close dialog / overlay | `Esc` |
| Dev hitbox overlay | `H` (or load with `?dev=1`) |

On-screen touch controls (d-pad + action button) appear on mobile/touch devices.

## Technologies

- **Frontend**: HTML5, CSS3, vanilla JavaScript (ES6+) — no frameworks
- **Graphics**: HTML5 Canvas 2D
- **Audio**: Web Audio API (jukebox, beat pad, sound effects)
- **Chess engine**: official [Stockfish](https://stockfishchess.org/) compiled to WebAssembly (single-threaded, driven over UCI in a Web Worker), with a hand-written alpha–beta + quiescence engine as the offline fallback
- **Art**: LimeZu-style pixel tilesets; rooms authored in [Tiled](https://www.mapeditor.org/) and pre-rendered to layered PNGs (base / props / top)
- **Fonts**: Pixelify Sans & Silkscreen

## Project structure

```
MyWebsite/
├── index.html              # Ryan's World — the site entry point
├── css/
│   ├── style.css           # world, header, loader
│   ├── ui.css              # dialogue, slide-over panels, room map
│   └── activity.css        # chess / music / gym overlays
├── js/
│   ├── content.js          # portfolio data + per-character dialogue
│   ├── collision.js        # tile collision (legacy/fallback)
│   ├── hitboxes.js         # free-form collision + depth data
│   ├── assets.js           # image loader + sprite metadata
│   ├── world.js            # rooms, doors, cameras
│   ├── sprites.js          # spritesheet drawing
│   ├── entities.js         # player + NPC behaviour
│   ├── dialogue.js         # animated portrait dialogue
│   ├── header.js           # header nav + content panels
│   ├── chess-engine.js     # chess rules + fallback AI (alpha-beta + quiescence) + FEN/UCI bridge
│   ├── stockfish-engine.js # Stockfish (WASM) Web Worker wrapper
│   ├── chess.js            # chess UI (vs. Drod)
│   ├── pool.js             # 8-ball pool: physics, rules, AI, UI (vs. Drod)
│   ├── music.js            # jukebox + beat pad
│   ├── workout.js          # gym combo trainer
│   ├── game.js             # main loop: render, input, transitions
│   ├── editor.js           # dev-only level editor (press H)
│   └── boot.js             # loader + start sequence
├── assets/
│   ├── rooms/              # 4 rooms × base/props/top PNGs
│   ├── chars/              # 8 character spritesheets (32×64 frames)
│   ├── portraits/          # 8 talking portraits (64×64 frames)
│   ├── chess/              # board + piece sheets
│   ├── engine/             # Stockfish WASM build (stockfish.wasm.js + .wasm)
│   ├── ui/                 # heavy bag, UI tiles
│   ├── audio/              # 5 music tracks
│   └── Ryan_Huang_Resume.pdf
└── README.md
```

## Getting started

Visit **[ryanhuang.work](https://ryanhuang.work)**.

Or run locally — because everything loads via relative paths and the browser blocks some of them from `file://`, serve the folder over HTTP:

```bash
# from the project root
python3 -m http.server 8000
# then open http://localhost:8000
```

## Credits

- Chess opponent: [**Stockfish**](https://stockfishchess.org/), the open-source chess engine, compiled to WebAssembly by [Niklas Fiekas](https://github.com/niklasf/stockfish.js). Distributed under the **GNU GPL v3** — the build and its license live in [`assets/engine/`](assets/engine/) (`Copying.txt`).

## Contact

Collaborations, opportunities, or just to say hi:

- **Email**: ryanhuang1234567890@gmail.com
- **LinkedIn**: [kerui-huang](https://www.linkedin.com/in/kerui-huang/)

---

*Built with passion for interactive experiences and pixel-art aesthetics* 🎨
