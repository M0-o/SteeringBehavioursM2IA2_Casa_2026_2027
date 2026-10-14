import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, Vector, EPS } from './helpers.mjs';

const load = () => scene(['vehicle.js', 'hunter.js'], ['Vehicle', 'Hunter']);

test('Hunter : hérite de Vehicle, mode et couleur, mode inconnu ramené à seek', () => {
  const { Vehicle, Hunter } = load();
  const h = new Hunter(0, 0);
  assert.ok(h instanceof Vehicle);
  assert.equal(h.mode, 'seek');
  h.setMode('pursue'); assert.deepEqual([h.mode, h.fillColor], ['pursue', 'purple']);
  h.setMode('nimporte'); assert.deepEqual([h.mode, h.fillColor], ['seek', 'blue']);
});

test('selectPrey : cible la plus proche, null sans cible', () => {
  const { Vehicle, Hunter } = load();
  const h = new Hunter(0, 0);
  const far = new Vehicle(300, 0), near = new Vehicle(0, 50);
  assert.equal(h.selectPrey([far, near]), near);
  assert.equal(h.prey, near);
  assert.equal(h.selectPrey([]), null);
});

test('applyBehaviors : seek du point en mode seek, pursue de la proie en mode pursue', () => {
  const { Vehicle, Hunter } = load();
  const prey = new Vehicle(100, 0); prey.vel.set(0, 5);

  const seeker = new Hunter(0, 0);
  seeker.selectPrey([prey]);
  seeker.applyBehaviors(prey.pos);
  assert.ok(Math.abs(seeker.acc.y) < EPS && seeker.acc.x > 0);

  const pursuer = new Hunter(0, 0);
  pursuer.setMode('pursue');
  pursuer.selectPrey([prey]);
  pursuer.applyBehaviors(prey.pos);
  assert.ok(pursuer.acc.y > 0, 'vise devant la proie');
  assert.ok(pursuer.acc.mag() <= pursuer.maxForce + EPS);

  const lost = new Hunter(0, 0);
  lost.setMode('pursue');
  lost.applyBehaviors(new Vector(50, 0));
  assert.ok(lost.acc.x > 0, 'sans proie : repli sur seek du point');
});
