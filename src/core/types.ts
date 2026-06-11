/* ============================================================
   Shared domain types used across the world, entities, content,
   and UI modules. Kept framework-free — these describe the plain
   data the canvas game already passes around.
   ============================================================ */

export type Dir = "up" | "down" | "left" | "right";
export type RoomKey = "lounge" | "gym" | "game" | "music";

/** A station an NPC or object can launch (drives the end-of-dialogue menu). */
export type ActivityKind = "chess" | "music" | "workout" | "pool" | "rack";

/** Header panel a character can pull up at the end of dialogue. */
export type PanelKey = "about" | "experience" | "projects" | "contact" | "trophies";

// ---- geometry / camera ----------------------------------------------------

export interface Point {
  x: number;
  y: number;
}
export interface Camera {
  s: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
}

// ---- entities -------------------------------------------------------------

export interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export type Behavior = "wander" | "watch" | "work" | "box" | "groove" | "idle";

export interface Player {
  char: string;
  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  frame: number;
  animT: number;
  speed: number;
}
export interface NPC {
  char: string;
  key: string;
  name: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  dir: Dir;
  moving: boolean;
  frame: number;
  animT: number;
  behavior: Behavior;
  speed: number;
  region?: Region;
  interact?: ActivityKind;
  hint?: string;
  state: string;
  timer: number;
  tx: number;
  ty: number;
  watchDir: Dir;
  bob: number;
  tgtX?: number;
  tgtY?: number;
}
export interface Pet {
  kind: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hint: string;
  state: "idle" | "petted";
  frame: number;
  animT: number;
  petTimer: number;
  petDur: number;
  idleFps: number;
  petFps: number;
}
export interface GameObject {
  type: string;
  name: string;
  /** Tile anchor (speaker) — or use px/py for a world-pixel anchor (TV, pool). */
  tx?: number;
  ty?: number;
  px?: number;
  py?: number;
  hint: string;
  sprite?: string;
  /** Resolved feet/base point in world px (computed in buildRoom). */
  x: number;
  y: number;
  /** Optional fixed float-height for the interaction marker (e.g. tall props). */
  markerY?: number;
}
export interface Room {
  npcs: NPC[];
  objs: GameObject[];
  pets: Pet[];
}

/**
 * The public surface of the GAME module that other modules (header, editor)
 * depend on. Injected rather than reached through a global, so dependencies
 * are explicit.
 */
export interface GameApi {
  start(): void;
  resize(): void;
  pause(v: boolean): void;
  currentRoom(): RoomKey;
  travelTo(to: RoomKey): void;
  toggleSound(btn?: HTMLElement): void;
  isPaused(): boolean;
  isIntro(): boolean;
  setHitboxes(v: boolean): void;
  toggleHitboxes(): boolean;
  camera(): Camera;
  canvasEl(): HTMLCanvasElement;
  screenToWorld(clientX: number, clientY: number): Point;
}

// ---- portfolio content ----------------------------------------------------

export interface Owner {
  name: string;
  email: string;
  phone: string;
  phoneIntl: string;
  phoneDisplay: string;
  linkedin: string;
  instagram: string;
}

export interface Fact {
  label: string;
  value: string;
}

export interface About {
  kicker: string;
  name: string;
  role: string;
  location: string;
  photo: string;
  lead: string;
  bio: string;
  facts: Fact[];
  skills: string[];
}

export interface ExperienceItem {
  company: string;
  role: string;
  logo: string;
  period: string;
  p: string;
}

export interface Experience {
  kicker: string;
  title: string;
  items: ExperienceItem[];
}

export interface ProjectItem {
  h: string;
  link?: string;
  p: string;
}

export interface Projects {
  kicker: string;
  title: string;
  lead: string;
  items: ProjectItem[];
}

export interface Contact {
  kicker: string;
  title: string;
  lead: string;
}

/** What a dialogue reaction can see — keeps content.ts free of imports. */
export interface ReactionCtx {
  num(key: string): number;
  has(flag: string): boolean;
  /** Name of the track currently playing site-wide, or null. */
  trackName: string | null;
}
/**
 * A session-memory opener: the first matching reaction replaces the
 * character's first line, once per page load. `flag` is shorthand for
 * `when: (c) => c.has(flag)`. Lines may interpolate `{track}` or any
 * numeric progress key, e.g. `{gymBest}`.
 */
export interface Reaction {
  flag?: string;
  when?: (ctx: ReactionCtx) => boolean;
  lines: string[];
}

export interface Character {
  name: string;
  room: RoomKey;
  color: string;
  lines: string[];
  /** Header panel this character can open at the end of dialogue. */
  opens?: PanelKey;
  openLabel?: string;
  /** Pixel-icon override for the open choice (defaults to the panel's icon). */
  openIcon?: string;
  actLabel?: string;
  noLabel?: string;
  /** Session-memory openers, checked in order — first match wins. */
  reactions?: Reaction[];
}

export interface Track {
  name: string;
  file: string;
}

export interface Content {
  owner: Owner;
  about: About;
  experience: Experience;
  projects: Projects;
  contact: Contact;
  characters: Record<string, Character>;
  tracks: Track[];
}
