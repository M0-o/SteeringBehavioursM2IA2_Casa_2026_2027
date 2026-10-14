import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, Vector, EPS, TARGET_FILES } from './helpers.mjs';

function load() {
  return scene([...TARGET_FILES, 'mitoticTarget.js', 'hunter.js', 'spatialGrid.js'],
    ['Vehicle', 'Hunter', 'MitoticTarget', 'SpatialGrid']);
}

// générateur pseudo-aléatoire reproductible (LCG)
function seeded(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
const item = (x, y) => ({ pos: new Vector(x, y) });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('query : contient tous les éléments du disque, y compris coordonnées négatives et bords de case', () => {
  const { SpatialGrid } = load();
  const rng = seeded(1);
  const items = Array.from({ length: 500 }, () => item(rng() * 1000 - 100, rng() * 800 - 100));
  items.push(item(0, 0), item(100, 100), item(-0.001, 99.999));
  const grid = SpatialGrid.from(items, 100);
  for (let q = 0; q < 200; q++) {
    const pos = new Vector(rng() * 1000 - 100, rng() * 800 - 100);
    const radius = 10 + rng() * 200;
    const candidates = new Set(grid.query(pos, radius));
    for (const it of items) {
      if (dist(it.pos, pos) <= radius) assert.ok(candidates.has(it), 'élément du disque manquant');
    }
    // sur-ensemble borné : seulement les cases qui touchent le carré englobant
    for (const it of candidates) {
      assert.ok(Math.abs(it.pos.x - pos.x) <= radius + 100 && Math.abs(it.pos.y - pos.y) <= radius + 100);
    }
  }
});

test('nearest : identique à la recherche exhaustive, grille vide, élément très lointain', () => {
  const { SpatialGrid } = load();
  assert.equal(new SpatialGrid(50).nearest(new Vector(0, 0)), null);
  const rng = seeded(7);
  for (const count of [1, 2, 10, 300]) {
    const items = Array.from({ length: count }, () => item(rng() * 1200 - 200, rng() * 900 - 200));
    const grid = SpatialGrid.from(items, 60);
    for (let q = 0; q < 150; q++) {
      const pos = new Vector(rng() * 1600 - 400, rng() * 1300 - 400);
      const brute = Math.min(...items.map(it => dist(it.pos, pos)));
      assert.ok(Math.abs(dist(grid.nearest(pos).pos, pos) - brute) < EPS);
    }
  }
  const far = item(5000, -3000);
  assert.equal(SpatialGrid.from([far], 10).nearest(new Vector(0, 0)), far);
});

test('clear : vide la grille et change la taille de case', () => {
  const { SpatialGrid } = load();
  const grid = SpatialGrid.from([item(10, 10)], 100);
  grid.clear(25);
  assert.equal(grid.size, 0);
  assert.equal(grid.cellSize, 25);
  assert.equal(grid.query(new Vector(10, 10), 50).length, 0);
  assert.equal(grid.nearest(new Vector(10, 10)), null);
  grid.insert(item(30, 30));
  assert.equal(grid.query(new Vector(0, 0), 10).length, 0, 'case (1,1) hors du carré [-10,10]');
});

test('Hunter.selectPrey avec grille = sans grille', () => {
  const { Hunter, MitoticTarget, SpatialGrid } = load();
  const rng = seeded(3);
  const targets = Array.from({ length: 40 }, () => new MitoticTarget(rng() * 800, rng() * 600));
  const grid = SpatialGrid.from(targets, 100);
  for (let i = 0; i < 200; i++) {
    const h = new Hunter(rng() * 900 - 50, rng() * 700 - 50);
    const withGrid = h.selectPrey(targets, grid);
    assert.equal(h.prey, withGrid);
    const brute = h.selectPrey(targets);
    assert.ok(Math.abs(dist(withGrid.pos, h.pos) - dist(brute.pos, h.pos)) < EPS);
  }
  assert.equal(new Hunter(0, 0).selectPrey([], new SpatialGrid(100)), null);
});

test('perception des cibles : voisins de la grille = tous les véhicules (mêmes forces)', () => {
  const { Vehicle, MitoticTarget, SpatialGrid } = load();
  const rng = seeded(11);
  const vehicles = Array.from({ length: 400 }, () => {
    const v = new Vehicle(rng() * 800, rng() * 600);
    v.vel.set(rng() * 8 - 4, rng() * 8 - 4);
    return v;
  });
  for (const radius of [40, 100, 230]) {
    const grid = SpatialGrid.from(vehicles, radius);
    for (let i = 0; i < 50; i++) {
      const a = new MitoticTarget(rng() * 800, rng() * 600), b = new MitoticTarget(a.pos.x, a.pos.y);
      a.rayonDetection = b.rayonDetection = radius;
      const full = a.behaviors(vehicles, null);
      const local = b.behaviors(grid.query(b.pos, b.rayonDetection), null);
      assert.ok(Math.abs(full.x - local.x) < 1e-9 && Math.abs(full.y - local.y) < 1e-9);
      assert.equal(a.enFuite, b.enFuite);
      assert.ok(Math.abs(a.maxSpeed - b.maxSpeed) < EPS);
    }
  }
});
