# Ryan's World

A walkable pixel-art world that doubles as my portfolio. Instead of scrolling a page, you wander a little four-room apartment, talk to its characters, and play with the things inside it. A website-style header gives you the "normal" way to read about my work.

## The world

Four rooms, connected through doorways with a soft fade between them.

- **Lounge** (center). The hub. Home to **Bob** and **Dino**, plus a **guestbook** real visitors can sign.
- **Gym** (north). **Amelia** and **Gojo**. Step up to the heavy bag for the **Combo Trainer**, or help Amelia **re-rack the weights** (a sneaky logic puzzle).
- **Game Room** (west). **Drod**. Sit at the board to play **chess** against real **Stockfish** (with a from-scratch engine as the offline fallback), step up to the **pool table** for **8-ball** or the **Trick-Shot Gauntlet**, pull up a chair for **heads-up poker**. And whatever you do, don't press the red button.
- **Music Studio** (east). **Alex** and **DJ**. A **jukebox**, a two-section **step sequencer** (keys and drums), and a **grand piano** you can actually play.

NPCs wander and do their own thing, and tall objects (TVs, plants, mic stands) draw in front of or behind you correctly via baseline depth-sorting.

## Features

- **Interactive 2D world.** Walk room to room on a full-screen canvas.
- **Dialogue with memory.** Animated talking portraits, typewriter text, per-character personality, all about the portfolio. The NPCs remember your session (lose to Drod and he *will* bring it up).
- **Chess vs. Drod.** Play as White, Black, or random, pick your promotion piece, four difficulty tiers. Powered by real **Stockfish** (WebAssembly), with a complete from-scratch engine (legal moves, castling, en passant, checkmate, quiescence search) as the offline fallback. Drod trash-talks throughout.
- **8-Ball vs. Drod.** A physics pool game (ball and cushion collisions, six pockets, full 8-ball rules with groups, fouls, and ball-in-hand), slingshot aiming with a live trajectory guide, a ghost-ball AI opponent, and synthesized table sounds.
- **Trick-Shot Gauntlet.** 8 set-piece pool challenges testing the fundamentals (straight pots, cuts, side-pocket shots, a bank off the cushion), each with 3 attempts and a ★★★ rating, on the same physics.
- **Heads-up poker vs. Drod.** Real Texas Hold'em. Escalating blinds, min-raise and BB-option rules, all-in run-outs, a Monte-Carlo opponent with a signature bluff, and chip stacks that survive page reloads.
- **Playable grand piano.** Pixel-art keys (RagnaPixel's *Pixel Piano*), real sampled piano (FreePats, CC0) with a synth fallback, DAW-style keybinds on desktop, multi-touch chords and glissando on phones.
- **Step sequencer.** A melody grid (pentatonic keys) over a 5-instrument drum machine with real CC0 one-shots (VCSL), hi-hat choking, a jitter-free lookahead scheduler, auto-saved patterns, and a "Download my beat" button that hands you an audio file.
- **Jukebox.** 18 lo-fi tracks that keep playing site-wide while you explore.
- **Gym Combo Trainer.** Call-and-respond directional punch combos with a pixel-art heavy bag and POW bursts.
- **Rack 'em Right.** Amelia's weight-plate logic puzzle. Move the whole stack across three uprights without resting a big plate on a small one (move counter, par, stars).
- **Guestbook with moderation.** A real one. Entries live in Cloudflare KV (rate-limited, honeypotted). New signatures wait for my approval before they hit the page, and I get a push or an email the moment someone signs.
- **Trophy Shelf.** A header panel tracking your whole visit (chess record, trick-shot stars, poker peak, pets befriended) with 15 achievements, several of them hidden.
- **A red button.** It says DO NOT PRESS.
- **Website header.** About / Experience / Projects / Contact / Trophies windows, room-map fast travel, and a sound toggle.
- **Animated loading screen.** Title card over a live, animated room scene.
- **Dev level editor.** Load with `?dev=1` to show the hitbox overlay. The editor supports free-form collision boxes, depth baselines, door zones, and spawn points (saved to your browser, exportable as JSON).

## Controls

| Action | Keys |
| --- | --- |
| Move | `W` `A` `S` `D` or arrow keys |
| Interact | `Enter` (near an NPC or activity) |
| Close dialog / overlay | `Esc` |
| Poker | `F` fold · `C` check/call · `R` raise · `A` all-in · `←`/`→` size the raise |
| Pool / trick shots | drag to aim, or `←`/`→` aim, `↑`/`↓` power, `Space` shoots |
| Piano | `A S D F G H J K L ; '` white keys · `W E T Y U O P` black keys · `Z`/`X` octave |
| Dev hitbox overlay | load with `?dev=1` |

On-screen touch controls (d-pad + action button) appear on mobile/touch devices.

## Technologies

- **Frontend.** HTML5, CSS3, **TypeScript** (ES modules), no UI framework. Bundled with **Vite**, unit-tested with **Vitest**.
- **Graphics.** HTML5 Canvas 2D.
- **Audio.** Web Audio API (jukebox, beat pad, sound effects).
- **Chess engine.** Official [Stockfish](https://stockfishchess.org/) compiled to WebAssembly (single-threaded, driven over UCI in a Web Worker), with a hand-written alpha-beta + quiescence engine as the offline fallback.
- **Art.** LimeZu-style pixel tilesets. Rooms authored in [Tiled](https://www.mapeditor.org/) and pre-rendered to layered PNGs (base / props / top).
- **Fonts.** Pixelify Sans & Silkscreen.

## Project structure

```
MyWebsite/
├── index.html              # entry HTML, loads a single module: /src/main.ts
├── package.json            # scripts: dev / build / preview / typecheck / test
├── tsconfig.json           # strict TypeScript config
├── vite.config.ts          # Vite + Vitest config
├── css/
│   ├── style.css           # world, header, loader
│   ├── ui.css              # dialogue, content windows, room map, activity host
│   └── activity.css        # chess / pool / music / gym overlays
├── functions/
│   ├── api/guestbook.ts    # Pages Function: guestbook GET/POST over KV + owner notify
│   └── admin/guestbook.ts  # Pages Function: approve/reject queue (key-protected)
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
│   ├── header.ts           # header nav + content windows (incl. Trophy Shelf) + room map
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
│       ├── chess.ts        # chess UI (vs. Drod), Stockfish + fallback
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
                            #   projects/ logos, audio/ incl. piano + drum samples, og)
```

## Getting started

Visit **[ryanhuang.work](https://ryanhuang.work)**.

Or run locally with [Node.js](https://nodejs.org/):

```bash
npm install
npm run dev        # Vite dev server with hot-reload
# build / preview / quality gates:
npm run build      # type-check (tsc) + production bundle to dist/
npm run preview    # serve the production build
npm run typecheck  # tsc --noEmit
npm test           # Vitest (chess-engine perft + rules)
```

## Guestbook backend (one-time setup)

The guestbook is a pair of Cloudflare Pages Functions backed by KV. `functions/api/guestbook.ts` takes signatures and reads the book. New entries land in a moderation queue instead of going live, and `functions/admin/guestbook.ts` serves a small approval page.

1. Cloudflare dashboard → **Storage & Databases → KV** → *Create namespace* (e.g. `ryans-place-guestbook`).
2. **Workers & Pages →** your Pages project → **Settings → Bindings → Add → KV namespace**. Variable name **`GUESTBOOK`**, select the namespace (set it for both Production and Preview).
3. Same settings page, add environment variables.
   - **`GUESTBOOK_ADMIN_KEY`** (required for moderation). Unlocks the approval queue at `/admin/guestbook?key=<your key>`. Without it that route is a 404.
   - **`NTFY_TOPIC`** (optional). An [ntfy.sh](https://ntfy.sh) topic name. Every new signature sends a push notification that links straight to the approval page.
   - **`RESEND_API_KEY`** and **`GUESTBOOK_NOTIFY_EMAIL`** (optional). The same notification as an email, sent through [Resend](https://resend.com).
4. Redeploy. Until then the API answers 503 and the site shows a friendly "book's at the binders" state (and a local mock in `npm run dev`).

Visitors see their entry right away, marked "awaiting approval". It joins the public book once approved. Entries that were already in the book stay there.

Local end-to-end test: `npm run build && npx wrangler pages dev dist --kv GUESTBOOK --binding GUESTBOOK_ADMIN_KEY=test`.

## Credits

- Chess opponent: [**Stockfish**](https://stockfishchess.org/), the open-source chess engine, compiled to WebAssembly by [Niklas Fiekas](https://github.com/niklasf/stockfish.js). Distributed under the **GNU GPL v3**. The build and its license live in [`assets/engine/`](assets/engine/) (`Copying.txt`).
- Piano keys artwork: [**Pixel Piano**](https://ragnapixel.itch.io/) by **Raphael Hatencia** (RagnaPixel Studio), used with the pack's license. Crediting is appreciated, so, thank you!
- Piano samples: [**Upright Piano KW**](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html) by the **FreePats project**, CC0 1.0 public domain.
- Drum one-shots: [**Versilian Community Sample Library**](https://github.com/sgossner/VCSL) by Versilian Studios / Sam Gossner, CC0 1.0 public domain.

## Contact

Collaborations, opportunities, or just to say hi.

- **Email**: ryanhuang1234567890@gmail.com
- **LinkedIn**: [kerui-huang](https://www.linkedin.com/in/kerui-huang/)
