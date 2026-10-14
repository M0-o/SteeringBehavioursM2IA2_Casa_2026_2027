import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, Vector, EPS } from './helpers.mjs';

test('Food hérite de Vehicle, taille selon la valeur', () => {
  const { Vehicle, Food } = loadGame();
  const small = new Food(0, 0, 1), big = new Food(0, 0, 3);
  assert.ok(small instanceof Vehicle);
  assert.ok(big.r > small.r);
  assert.equal(small.vel.mag(), 0, 'immobile à l\'apparition');
  for (const m of ['update', 'applyForce', 'seek', 'arrive']) assert.equal(Food.prototype[m], Vehicle.prototype[m]);
});

test('findAttractor : tête la plus proche dont le champ touche, null sinon', () => {
  const { Food, Snake } = loadGame();
  const food = new Food(100, 100);
  const a = new Snake(160, 100, { magnetRadius: 80 });
  const b = new Snake(130, 100, { magnetRadius: 80 });
  const out = new Snake(400, 100, { magnetRadius: 80 });
  assert.equal(food.findAttractor([a, b, out]), b);
  assert.equal(food.attractor, b);
  assert.equal(food.findAttractor([out]), null);
  assert.equal(food.attractor, null);
});

test('magnetForce : seek vers la tête, limité à maxForce, plus fort de près', () => {
  const { Food, Snake } = loadGame();
  const snake = new Snake(0, 0, { magnetRadius: 100, magnetStrength: 1 });

  const edge = new Food(100, 0);
  const fEdge = edge.magnetForce(snake);
  assert.ok(fEdge.x < 0 && Math.abs(fEdge.y) < EPS, 'dirigée vers la tête');
  assert.ok(fEdge.mag() <= edge.maxForce + EPS);

  const near = new Food(20, 0);
  const fNear = near.magnetForce(snake);
  assert.ok(near.maxForce > edge.maxForce);
  assert.ok(fNear.mag() > fEdge.mag(), 'aimant plus fort près de la tête');
  assert.ok(near.maxForce <= Food.pullForce + EPS);
});

test('magnetForce : la force de l\'aimant du serpent multiplie l\'aspiration', () => {
  const { Food, Snake } = loadGame();
  const weak = new Snake(0, 0, { magnetRadius: 100, magnetStrength: 0.5 });
  const strong = new Snake(0, 0, { magnetRadius: 100, magnetStrength: 2 });
  const a = new Food(50, 0), b = new Food(50, 0);
  assert.ok(b.magnetForce(strong).mag() > a.magnetForce(weak).mag());
  assert.ok(b.maxSpeed > a.maxSpeed);
});

test('brake : s\'oppose à la vitesse et finit par arrêter la nourriture', () => {
  const { Food } = loadGame();
  const food = new Food(100, 100);
  food.vel = new Vector(3, -2);
  const f = food.brake();
  assert.ok(f.x < 0 && f.y > 0 && f.mag() <= Food.brakeForce + EPS);
  for (let i = 0; i < 100; i++) { food.applyForce(food.brake()); food.update(); }
  assert.ok(food.vel.mag() < EPS);
});

test('behave : aspirée vers une tête proche, immobile hors champ', () => {
  const { Food, Snake } = loadGame();
  const snake = new Snake(0, 0, { magnetRadius: 100 });
  const pulled = new Food(80, 0);
  const idle = new Food(400, 0);
  for (let i = 0; i < 5; i++) { pulled.behave([snake]); idle.behave([snake]); }
  assert.ok(pulled.pos.x < 80);
  assert.deepEqual([idle.pos.x, idle.pos.y], [400, 0]);
});

test('show : faisceau vers la tête attirante uniquement', () => {
  const env = loadGame();
  const snake = new env.Snake(0, 0, { magnetRadius: 100 });
  const food = new env.Food(50, 0);
  food.show();
  assert.ok(!env.calls.some(c => c[0] === 'line'));
  food.findAttractor([snake]);
  food.show();
  assert.ok(env.calls.some(c => c[0] === 'line' && c[3] === 0 && c[4] === 0));
});
