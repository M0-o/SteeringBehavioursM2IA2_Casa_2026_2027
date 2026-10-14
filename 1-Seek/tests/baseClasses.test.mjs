import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, Vector, EPS } from './helpers.mjs';

const load = () => scene(['vehicle.js', 'target.js'], ['Vehicle', 'Target']);

test('Vehicle : couleurs par défaut et modifiables, utilisées par show', () => {
  const { Vehicle, calls } = load();
  const v = new Vehicle(0, 0);
  assert.deepEqual([v.fillColor, v.strokeColor], ['blue', 'white']);
  v.fillColor = 'purple'; v.show();
  assert.ok(calls.some(([name, c]) => name === 'fill' && c === 'purple'));
});

test('predictPosition / pursue / evade : position future, forces opposées et bornées', () => {
  const { Vehicle } = load();
  const me = new Vehicle(0, 0);
  const other = new Vehicle(100, 0); other.vel.set(0, 3);
  const future = me.predictPosition(other, 10);
  assert.deepEqual([future.x, future.y], [100, 30]);
  assert.deepEqual([other.pos.x, other.pos.y], [100, 0], 'véhicule observé intact');
  const p = me.pursue(other, 10), e = me.evade(other, 10);
  assert.ok(p.x > 0 && p.y > 0, 'pursue vise la position future');
  assert.ok(Math.abs(p.x + e.x) < EPS && Math.abs(p.y + e.y) < EPS, 'evade = -pursue');
  assert.ok(p.mag() <= me.maxForce + EPS);
  const still = me.pursue(other, 0);
  assert.ok(Math.abs(still.y) < EPS, 'anticipation 0 = seek de la position actuelle');
});

test('wander : variation continue de l’angle, bornée par wanderJitter, force bornée', () => {
  const { Vehicle } = load();
  const v = new Vehicle(100, 100); v.vel.set(2, 0);
  v.wanderJitter = 0.3;
  const f1 = v.wander(() => 1);       // +0.3
  assert.ok(Math.abs(v.wanderTheta - 0.3) < EPS);
  v.wander(() => 0);                  // -0.3
  assert.ok(Math.abs(v.wanderTheta) < EPS);
  v.wander(() => 0.5);                // inchangé
  assert.ok(Math.abs(v.wanderTheta) < EPS);
  assert.ok(f1.mag() <= v.maxForce + EPS);
  // angle positif (sens horaire écran, y vers le bas) : la force tire vers +y
  assert.ok(f1.y > 0);
  v.wanderJitter = 0; v.wanderTheta = 0;
  const straight = v.wander(() => 1);
  assert.ok(Math.abs(straight.y) < EPS, 'sans variation : tout droit');
});

test('Target : mouvement erratique d’origine, compté en images, sans setInterval', () => {
  const { Target } = load();
  const t = new Target(0, 0);       // setInterval lèverait une erreur
  assert.equal(t.erratic, true);
  assert.equal(t.r, 50);
  for (let i = 0; i < t.erraticPeriod - 1; i++) t.update();
  assert.equal(t.r, 50, 'pas encore de changement');
  t.update();
  assert.equal(t.r, 35, 'randomize() appelé à la fin de la période (random fixé)');
  assert.equal(t.erraticFrames, 0);
  assert.match(String(t.color), /^color\(/);
});

test('Target : erratic = false désactive changements et rotation de la vitesse', () => {
  const { Target } = load();
  const t = new Target(0, 0);
  t.erratic = false; t.vel.set(2, 0);
  for (let i = 0; i < 200; i++) t.update();
  assert.deepEqual([t.vel.x, t.vel.y, t.r, t.color], [2, 0, 50, 'red']);
  assert.equal(t.pos.x, 400);
});
