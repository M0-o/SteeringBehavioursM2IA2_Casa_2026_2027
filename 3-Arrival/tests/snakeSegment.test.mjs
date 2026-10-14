import test from 'node:test';
import assert from 'node:assert/strict';
import { scene, EPS } from './helpers.mjs';

const load = () => scene(['vehicle.js', 'snakeSegment.js'], ['Vehicle', 'SnakeSegment']);

test('SnakeSegment hérite de Vehicle et réutilise arrive()', () => {
  const { Vehicle, SnakeSegment } = load();
  const s = new SnakeSegment(0, 0, 10);
  assert.ok(s instanceof Vehicle);
  assert.equal(s.r, 10);
  assert.equal(SnakeSegment.prototype.arrive, Vehicle.prototype.arrive);
  assert.equal(SnakeSegment.prototype.update, Vehicle.prototype.update);
});

test('follow : espacement = (r + r du meneur) * recouvrement', () => {
  const { SnakeSegment } = load();
  const leader = new SnakeSegment(0, 0, 10);
  const s = new SnakeSegment(50, 0, 6);
  assert.equal(s.spacingTo(leader), 16 * SnakeSegment.overlap);
});

test('follow : zone de freinage = espacement + maxSpeed (pas d\'oscillation)', () => {
  const { SnakeSegment } = load();
  const leader = new SnakeSegment(0, 0, 10);
  const s = new SnakeSegment(50, 0, 10);
  s.maxSpeed = 12;
  s.follow(leader);
  assert.equal(s.rayonZoneDeFreinage, s.spacingTo(leader) + 12 * SnakeSegment.brakingReach);
});

test('follow : loin du meneur, force vers lui limitée à maxForce', () => {
  const { SnakeSegment } = load();
  const leader = new SnakeSegment(0, 0, 10);
  const s = new SnakeSegment(300, 0, 10);
  s.maxForce = 0.5;
  const f = s.follow(leader);
  assert.ok(f.x < 0 && Math.abs(f.y) < EPS);
  assert.ok(Math.abs(f.mag() - 0.5) < EPS);
});

test('follow : plus près que l\'espacement, l\'anneau recule', () => {
  const { SnakeSegment } = load();
  const leader = new SnakeSegment(0, 0, 10);
  const s = new SnakeSegment(3, 0, 10);
  const f = s.follow(leader);
  assert.ok(f.x > 0, 'force qui éloigne du meneur');
});

test('follow : à l\'espacement et à l\'arrêt, aucune force', () => {
  const { SnakeSegment } = load();
  const leader = new SnakeSegment(0, 0, 10);
  const s = new SnakeSegment(0, 0, 10);
  s.pos.x = s.spacingTo(leader);
  assert.ok(s.follow(leader).mag() < EPS);
});

test('follow + update : une chaîne converge vers l\'espacement de repos', () => {
  const { SnakeSegment } = load();
  const leader = new SnakeSegment(0, 0, 10);
  const s = new SnakeSegment(200, 50, 10);
  s.maxSpeed = 8; s.maxForce = 1;
  for (let i = 0; i < 600; i++) { s.applyForce(s.follow(leader)); s.update(); }
  assert.ok(Math.abs(s.pos.dist(leader.pos) - s.spacingTo(leader)) < 0.5);
});
