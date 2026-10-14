import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, EPS } from './helpers.mjs';

// Le pipeline WebGL se vérifie dans le navigateur ; ici, les données envoyées au GPU.
const load = () => scene(['vehicle.js', 'hunter.js', 'vehicleBatch.js', 'vehicleGL.js'],
  ['Vehicle', 'Hunter', 'VehicleBatch', 'VehicleGL']);
const close = (a, b) => Math.abs(a - b) < 1e-6;

test('parseCanvasColor : formes canoniques du navigateur', () => {
  const { VehicleGL } = load();
  const rgb = t => Array.from(VehicleGL.parseCanvasColor(t));
  assert.deepEqual(rgb('#0000ff'), [0, 0, 1]);
  assert.deepEqual(rgb('#ffffff'), [1, 1, 1]);
  assert.ok(rgb('#800080').every((v, i) => close(v, [128 / 255, 0, 128 / 255][i])));
  assert.ok(rgb('rgba(255, 0, 51, 0.5)').every((v, i) => close(v, [1, 0, 0.2][i])));
  assert.deepEqual(rgb('inconnu'), [1, 1, 1]);
});

test('colorCache : normalise chaque couleur une seule fois', () => {
  const { VehicleGL } = load();
  const seen = [];
  const toRgb = VehicleGL.colorCache(c => { seen.push(c); return { blue: '#0000ff', purple: '#800080' }[c]; });
  for (let i = 0; i < 100; i++) { toRgb('blue'); toRgb('purple'); }
  assert.deepEqual(seen, ['blue', 'purple']);
  assert.deepEqual(Array.from(toRgb('blue')), [0, 0, 1]);
});

test('fillInstances : 11 nombres par véhicule (pose, rayon, couleurs)', () => {
  const { Hunter, VehicleGL } = load();
  const a = new Hunter(10, 20); a.vel.set(0, 3);
  const b = new Hunter(30, 40); b.setMode('pursue'); b.r = 8;   // à l'arrêt
  const toRgb = c => ({ blue: [0, 0, 1], purple: [0.5, 0, 0.5], white: [1, 1, 1] })[c];
  const data = new Float32Array(VehicleGL.FLOATS * 4).fill(-1);
  assert.equal(VehicleGL.fillInstances([a, b], data, toRgb), 2);
  assert.deepEqual(Array.from(data.slice(0, 11)), [10, 20, 0, 1, 16, 0, 0, 1, 1, 1, 1]);
  assert.deepEqual(Array.from(data.slice(11, 22)), [30, 40, 1, 0, 8, 0.5, 0, 0.5, 1, 1, 1]);
  assert.equal(data[22], -1, 'rien écrit après le dernier véhicule');
});

test('les sommets calculés par le vertex shader = triangle de Vehicle.show()', () => {
  const { Vehicle, VehicleBatch, VehicleGL } = load();
  const { CORNERS, FLOATS } = VehicleGL;
  for (const [vx, vy] of [[3, 0], [0, -2], [-1, 1], [2.5, -4], [0, 0]]) {
    const v = new Vehicle(120, 80); v.vel.set(vx, vy); v.r = 12;
    const data = new Float32Array(FLOATS);
    VehicleGL.fillInstances([v], data, () => [1, 1, 1]);
    const [x, y, c, s, r] = data;
    const expected = VehicleBatch.triangleFor(v);
    for (let i = 0; i < 3; i++) {
      // même calcul que le vertex shader
      const lx = CORNERS[i * 5] * r, ly = CORNERS[i * 5 + 1] * r;
      const wx = x + lx * c - ly * s, wy = y + lx * s + ly * c;
      assert.ok(close(wx, expected[i][0]) && close(wy, expected[i][1]), `sommet ${i}, v=(${vx},${vy})`);
    }
    // barycentriques : un 1 par sommet
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(Array.from(CORNERS.slice(i * 5 + 2, i * 5 + 5)), [0, 1, 2].map(j => (j === i ? 1 : 0)));
    }
  }
});

test('render sans état WebGL2 : aucun effet', () => {
  const { VehicleGL } = load();
  assert.doesNotThrow(() => VehicleGL.render(null, [], 100, 100, 1, null));
});
