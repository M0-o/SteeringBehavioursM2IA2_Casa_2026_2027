import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Seules les fonctions pures sont testées ici ; le rendu WEBGL se vérifie dans le navigateur.
function smoke() {
  const context = vm.createContext({});
  vm.runInContext(readFileSync(new URL('../smokeTrails.js', import.meta.url), 'utf8'), context);
  return vm.runInContext('SmokeTrails', context);
}
const vehicle = (x, y, vx, vy) => ({
  pos: { x, y }, vel: { x: vx, y: vy, mag() { return Math.hypot(this.x, this.y); } },
  r: 16, maxSpeed: 4,
});
const close = (a, b) => Math.abs(a - b) < 1e-9;

test('hsvToRgb : couleurs primaires, gris et teinte bouclée', () => {
  const { hsvToRgb: rgbInVm } = smoke();
  // tableau recopié dans ce contexte (sinon prototypes d'Array différents)
  const hsvToRgb = (...args) => Array.from(rgbInVm(...args));
  assert.deepEqual(hsvToRgb(0, 1, 1), [255, 0, 0]);
  assert.deepEqual(hsvToRgb(1 / 3, 1, 1), [0, 255, 0]);
  assert.deepEqual(hsvToRgb(2 / 3, 1, 1), [0, 0, 255]);
  assert.deepEqual(hsvToRgb(0.4, 0, 0.5), [127.5, 127.5, 127.5]);
  assert.deepEqual(hsvToRgb(1, 1, 1), hsvToRgb(0, 1, 1));
});

test('puffFor : bouffée à l’arrière du véhicule, à un rayon du centre', () => {
  const { puffFor } = smoke();
  const puff = puffFor(vehicle(100, 100, 4, 0), 0, 0);
  assert.ok(close(puff.x, 84) && close(puff.y, 100));
  const diag = puffFor(vehicle(0, 0, 3, 4), 0, 0);
  assert.ok(close(Math.hypot(diag.x, diag.y), 16) && diag.x < 0 && diag.y < 0);
});

test('puffFor : véhicule à l’arrêt, taille selon la vitesse, véhicule intact', () => {
  const { puffFor, PUFF_SIZE } = smoke();
  const still = vehicle(50, 60, 0, 0);
  const puff = puffFor(still, 0, 0);
  assert.deepEqual([puff.x, puff.y], [50, 60]);
  assert.equal(puff.size, PUFF_SIZE / 2);
  assert.equal(puffFor(vehicle(0, 0, 4, 0), 0, 0).size, PUFF_SIZE);
  assert.equal(puffFor(vehicle(0, 0, 40, 0), 0, 0).size, PUFF_SIZE);
  assert.deepEqual([still.pos.x, still.pos.y, still.vel.x], [50, 60, 0]);
});

test('puffFor : teintes distinctes par indice, dans [0, 1[, dérive dans le temps', () => {
  const { puffFor } = smoke();
  const v = vehicle(0, 0, 1, 0);
  const hues = Array.from({ length: 200 }, (_, i) => puffFor(v, i, 0).hue);
  assert.ok(hues.every(h => h >= 0 && h < 1));
  assert.equal(new Set(hues.map(h => h.toFixed(6))).size, 200);
  assert.notEqual(puffFor(v, 3, 0).hue, puffFor(v, 3, 2).hue);
});

test('render sans état WebGL2 ou scène vide : aucun effet', () => {
  const { render } = smoke();
  assert.doesNotThrow(() => { render(null, [], 0, 100, 100, null); render(null, [], 0, 0, 0, null, 0.5); });
});

test('PUFF_CORNERS : triangle équilatéral circonscrit au disque de rayon 1', () => {
  const { PUFF_CORNERS } = smoke();
  const corners = [0, 1, 2].map(i => [PUFF_CORNERS[i * 2], PUFF_CORNERS[i * 2 + 1]]);
  // sommets à 2 rayons du centre
  // Float32Array : √3 arrondi en simple précision
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  for (const [u, v] of corners) assert.ok(near(Math.hypot(u, v), 2));
  // cercle inscrit de rayon 1 : chaque côté est à distance 1 du centre
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % 3];
    assert.ok(near(Math.abs(ax * by - ay * bx) / Math.hypot(bx - ax, by - ay), 1));
  }
});

test('fillPuffInstances : 6 nombres par bouffée, cohérents avec puffFor et hsvToRgb', () => {
  const { fillPuffInstances, puffFor, hsvToRgb, PUFF_FLOATS } = smoke();
  const vehicles = [vehicle(100, 100, 4, 0), vehicle(50, 60, 0, 0)];
  const data = new Float32Array(PUFF_FLOATS * 3).fill(-1);
  assert.equal(fillPuffInstances(vehicles, data, 1.5), 2);
  vehicles.forEach((v, i) => {
    const puff = puffFor(v, i, 1.5), rgb = hsvToRgb(puff.hue, 0.85, 1);
    const row = Array.from(data.slice(i * PUFF_FLOATS, (i + 1) * PUFF_FLOATS));
    const expected = [puff.x, puff.y, puff.size / 2, rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
    row.forEach((value, j) => assert.ok(Math.abs(value - expected[j]) < 1e-5, `bouffée ${i}, valeur ${j}`));
  });
  assert.equal(data[PUFF_FLOATS * 2], -1, 'rien écrit après la dernière bouffée');
});
