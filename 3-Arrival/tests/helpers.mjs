import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Adaptateur vectoriel minimal (même sémantique que p5.Vector pour les
// méthodes utilisées) pour exercer les vraies classes sans DOM ni p5.
export class Vector {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  // comme p5 : normalize().mult(n), donc n négatif inverse le sens
  setMag(n) { const m = this.mag(); return m ? this.mult(n / m) : this; }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  dist(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  heading() { return Math.atan2(this.y, this.x); }
  static add(a, b) { return new Vector(a.x + b.x, a.y + b.y); }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static mult(a, n) { return new Vector(a.x * n, a.y * n); }
  static dist(a, b) { return a.dist(b); }
  static random2D() { return new Vector(1, 0); }
}

export const EPS = 1e-9;
const noop = () => {};

// Générateur pseudo-aléatoire déterministe (mulberry32) dans [0, 1[.
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Couleur p5 factice : garde la valeur et l'alpha.
class FakeColor {
  constructor(value) { this.value = value; this.alpha = 255; }
  setAlpha(a) { this.alpha = a; }
}

/* Charge les fichiers dans un contexte isolé. random() de p5 renvoie le
   milieu de l'intervalle (aléatoire fixé). */
export function scene(files, expose, extra = {}) {
  const calls = [];
  const context = vm.createContext({
    createVector: (x, y) => new Vector(x, y),
    p5: { Vector },
    width: 800,
    height: 600,
    frameCount: 0,
    CENTER: 'center', BOTTOM: 'bottom',
    random: (a, b) => (b === undefined ? a / 2 : (a + b) / 2),
    map: (v, a, b, c, d) => c + ((v - a) * (d - c)) / (b - a),
    cos: Math.cos, sin: Math.sin,
    color: v => (v instanceof FakeColor ? v : new FakeColor(v)),
    lerpColor: (a, b, t) => new FakeColor(`lerp(${a.value},${b.value},${t})`),
    push: noop, pop: noop, stroke: noop, strokeWeight: noop, noStroke: noop, noFill: noop,
    translate: noop, rotate: noop, triangle: noop, textAlign: noop, textSize: noop,
    fill: c => calls.push(['fill', c]),
    circle: (x, y, d) => calls.push(['circle', x, y, d]),
    line: (...p) => calls.push(['line', ...p]),
    rect: (...p) => calls.push(['rect', ...p]),
    text: (t, x, y) => calls.push(['text', t, x, y]),
    drawingContext: { setLineDash: noop },
    ...extra,
  });
  for (const file of files) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
  }
  const exposed = vm.runInContext(`({ ${expose.join(', ')} })`, context);
  return { ...exposed, calls, context };
}

export const GAME_FILES = ['vehicle.js', 'snakeSettings.js', 'snakeSegment.js', 'snake.js', 'food.js', 'game.js'];
export const GAME_CLASSES = [
  'Vehicle', 'SnakeSegment', 'Snake', 'Food', 'Game',
  'SNAKE_SLIDERS', 'SNAKE_MODES', 'SNAKE_PATTERNS',
  'defaultSnakeSettings', 'clampSnakeSettings', 'randomSnakeSettings',
];
export const loadGame = extra => scene(GAME_FILES, GAME_CLASSES, extra);
