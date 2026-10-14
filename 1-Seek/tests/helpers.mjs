import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Adaptateur vectoriel minimal pour exercer les vraies classes sans DOM ni p5.
export class Vector {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  setMag(n) { const m = this.mag(); return m ? this.mult(n / m) : this; }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  dist(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  heading() { return Math.atan2(this.y, this.x); }
  setHeading(a) { const m = this.mag(); return this.set(Math.cos(a) * m, Math.sin(a) * m); }
  static add(a, b) { return new Vector(a.x + b.x, a.y + b.y); }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static mult(a, n) { return new Vector(a.x * n, a.y * n); }
  static dist(a, b) { return a.dist(b); }
  // aléatoire fixé : direction initiale déterministe
  static random2D() { return new Vector(1, 0); }
}

export const EPS = 1e-9;
const noop = () => {};

/* Charge les fichiers dans un contexte isolé. random() de p5 est remplacé par
   une valeur fixe (milieu de l'intervalle) ; setInterval échoue s'il est utilisé. */
export function scene(files, expose, extra = {}) {
  const calls = [];
  const context = vm.createContext({
    createVector: (x, y) => new Vector(x, y), p5: { Vector }, width: 800, height: 600,
    random: (a, b) => (b === undefined ? a / 2 : (a + b) / 2),
    color: (...c) => `color(${c.join(',')})`,
    setInterval: () => { throw new Error('setInterval interdit'); },
    push: noop, pop: noop, stroke: noop, strokeWeight: noop, noStroke: noop, noFill: noop,
    translate: noop, rotate: noop, triangle: noop, line: noop,
    fill: c => calls.push(['fill', c]),
    circle: (x, y, d) => calls.push(['circle', x, y, d]),
    quad: (...p) => calls.push(['quad', ...p]),
    rect: (x, y, w, h) => calls.push(['rect', x, y, w, h]),
    drawingContext: {},
    ...extra,
  });
  for (const file of files) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  }
  const exposed = vm.runInContext(`({ ${expose.join(', ')} })`, context);
  return { ...exposed, calls, context };
}

export const TARGET_FILES = ['vehicle.js', 'target.js', 'population.js', 'evadingTarget.js'];
