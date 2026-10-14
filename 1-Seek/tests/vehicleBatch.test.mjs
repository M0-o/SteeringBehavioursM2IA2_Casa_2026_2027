import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, EPS } from './helpers.mjs';

/* Contexte où translate/rotate/triangle de p5 sont suivis : on récupère les
   sommets que Vehicle.show() dessine réellement, dans le repère de l'écran. */
function loadWithTransforms() {
  const stack = [];
  let m = { x: 0, y: 0, a: 0 };
  const triangles = [];
  const extra = {
    push: () => stack.push({ ...m }),
    pop: () => { m = stack.pop(); },
    translate: (x, y) => { m = { ...m, x: m.x + x * Math.cos(m.a) - y * Math.sin(m.a), y: m.y + x * Math.sin(m.a) + y * Math.cos(m.a) }; },
    rotate: a => { m = { ...m, a: m.a + a }; },
    triangle: (...p) => {
      const pts = [];
      for (let i = 0; i < 6; i += 2) {
        pts.push([m.x + p[i] * Math.cos(m.a) - p[i + 1] * Math.sin(m.a), m.y + p[i] * Math.sin(m.a) + p[i + 1] * Math.cos(m.a)]);
      }
      triangles.push(pts);
    },
  };
  const loaded = scene(['vehicle.js', 'hunter.js', 'vehicleBatch.js'], ['Vehicle', 'Hunter', 'VehicleBatch'], extra);
  return { ...loaded, triangles };
}

// contexte Canvas 2D factice qui enregistre les appels
function fakeContext() {
  const calls = [];
  const ctx = { calls };
  for (const name of ['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke']) {
    ctx[name] = (...args) => calls.push([name, ...args, name === 'fill' ? ctx.fillStyle : name === 'stroke' ? ctx.strokeStyle : undefined]);
  }
  return ctx;
}

const close = (p, q) => Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS;

test('triangleFor : mêmes sommets que Vehicle.show(), quelle que soit l’orientation', () => {
  const { Vehicle, VehicleBatch, triangles } = loadWithTransforms();
  for (const [vx, vy] of [[3, 0], [0, -2], [-1, 1], [2.5, -4], [0, 0]]) {
    const v = new Vehicle(120, 80);
    v.vel.set(vx, vy);
    triangles.length = 0;
    v.show();
    const body = triangles[0];
    const batch = VehicleBatch.triangleFor(v);
    batch.forEach((p, i) => assert.ok(close(p, body[i]), `sommet ${i} pour v=(${vx},${vy})`));
    if (vx || vy) {
      const head = VehicleBatch.arrowFor(v).head;
      head.forEach((p, i) => assert.ok(close(p, triangles[1][i]), `pointe de flèche ${i}`));
    }
  }
});

test('draw : un seul chemin rempli par style, pas de flèches hors debug', () => {
  const { Hunter, VehicleBatch } = loadWithTransforms();
  const vehicles = Array.from({ length: 50 }, (_, i) => { const h = new Hunter(i * 10, 20); h.vel.set(1, 0); return h; });
  vehicles.slice(0, 20).forEach(h => h.setMode('pursue'));
  const ctx = fakeContext();
  VehicleBatch.draw(ctx, vehicles);
  const count = name => ctx.calls.filter(c => c[0] === name).length;
  assert.equal(count('beginPath'), 2, 'un chemin pour les violets, un pour les bleus');
  assert.equal(count('fill'), 2);
  assert.equal(count('moveTo'), 50);
  assert.equal(count('closePath'), 50);
  assert.deepEqual(ctx.calls.filter(c => c[0] === 'fill').map(c => c[1]).sort(), ['blue', 'purple']);
  assert.equal(count('save'), 1); assert.equal(count('restore'), 1);
  // contour puis remplissage, pour chaque groupe
  const order = ctx.calls.filter(c => c[0] === 'fill' || c[0] === 'stroke').map(c => c[0]);
  assert.deepEqual(order, ['stroke', 'fill', 'stroke', 'fill']);
  assert.ok(!ctx.calls.some(c => c[0] === 'stroke' && c[1] === 'red'));
});

test('draw en debug : flèches de vitesse groupées en deux chemins rouges', () => {
  const { Hunter, VehicleBatch } = loadWithTransforms();
  const vehicles = Array.from({ length: 30 }, (_, i) => { const h = new Hunter(i, i); h.vel.set(2, 1); return h; });
  const ctx = fakeContext();
  VehicleBatch.draw(ctx, vehicles, { arrows: true });
  assert.equal(ctx.calls.filter(c => c[0] === 'beginPath').length, 3);
  assert.equal(ctx.calls.filter(c => c[0] === 'moveTo').length, 30 * 3);
  assert.ok(ctx.calls.some(c => c[0] === 'stroke' && c[1] === 'red'));
});

test('draw : aucun véhicule, aucun chemin', () => {
  const { VehicleBatch } = loadWithTransforms();
  const ctx = fakeContext();
  VehicleBatch.draw(ctx, [], { arrows: true });
  assert.equal(ctx.calls.filter(c => c[0] === 'moveTo').length, 0);
});
